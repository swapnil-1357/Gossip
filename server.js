const express = require('express');
const path = require('path');
const http = require('http');
const redis = require('redis');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const formatMessage = require('./message');
const {
    initRedisClient,
    userJoin,
    getUser,
    userLeft,
    getRoomUsers
} = require('./users');

dotenv.config();

const pid = process.pid;
const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

console.log(`🚀 [${pid}] Starting server.js on PORT=${port}`);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const bot = 'GossiBot';

// Redis client config
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        tls: process.env.NODE_ENV === 'production' ? {} : undefined
    },
    password: process.env.REDIS_PASSWORD || undefined
});

const redisPublisher = redisClient.duplicate();
const redisSubscriber = redisClient.duplicate();

const connectRedis = async () => {
    try {
        await redisClient.connect();
        await redisPublisher.connect();
        await redisSubscriber.connect();

        console.log(`✅ [${pid}] Redis client connected`);
        console.log(`✅ [${pid}] Redis publisher connected`);
        console.log(`✅ [${pid}] Redis subscriber connected`);

        initRedisClient(redisClient);

        redisClient.on('error', (err) => console.error(`❌ [${pid}] Redis error:`, err));
        redisClient.on('connect', () => console.log(`🔌 [${pid}] Redis main client connected`));
        redisClient.on('reconnecting', () => console.log(`🔁 [${pid}] Redis reconnecting...`));
        redisClient.on('end', () => console.log(`🚪 [${pid}] Redis connection closed`));

        setInterval(async () => {
            const info = await redisClient.info();
            console.log(`📊 [${pid}] Redis INFO Snapshot:\n`, info.split('\n').slice(0, 6).join('\n'));
        }, 15000);
    } catch (error) {
        console.error(`❌ [${pid}] Failed to connect to Redis:`, error);
        process.exit(1);
    }
};

connectRedis();

// View engine & static files
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/join', (req, res) => {
    const { user, room } = req.body;
    res.render('chat', {
        username: user,
        roomname: room,
        port,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        unsignedPreset: process.env.CLOUDINARY_UNSIGNED_PRESET
    });
});


// Redis subscriber listens and forwards messages to socket.io rooms
redisSubscriber.pSubscribe('chat:*', async (message, channel) => {
    try {
        const data = JSON.parse(message);
        const room = channel.split(':')[1];

        console.log(`📨 [${pid}] [Redis] Received on ${channel}:`, data);

        switch (data.type) {
            case 'message':
                io.to(room).emit('message', data.payload);
                break;
            case 'userJoined':
                io.to(room).emit('message', formatMessage(bot, '1357', `${data.payload.username} has joined the room`));
                break;
            case 'userLeft':
                io.to(room).emit('message', formatMessage(bot, '1357', `${data.payload.username} has left the room`));
                break;
            default:
                console.warn(`⚠️ [${pid}] Unknown message type from Redis: ${data.type}`);
        }
    } catch (err) {
        console.error(`❌ [${pid}] Error processing Redis message:`, err);
    }
});

// Socket.IO connection handlers
io.on('connection', (socket) => {
    console.log(`🟢 [${pid}] New user connected: ${socket.id}`);

    socket.on('user-joined', async ({ username, roomname }) => {
        const user = await userJoin(socket.id, username, roomname);
        socket.join(user.room);

        socket.username = user.name;

        socket.emit('message', formatMessage(bot, '1357', 'Welcome to Gossip'));

        await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
            type: 'userJoined',
            payload: { username: user.name }
        }));

        console.log(`📤 [${pid}] Published userJoined to chat:${user.room}`);
    });

    socket.on('chatMessage', async (msg) => {
        const user = await getUser(socket.id);
        if (!user) return;

        let messageContent;
        if (typeof msg === 'string') {
            messageContent = msg;
        } else if (typeof msg === 'object' && msg !== null) {
            messageContent = msg;
        } else {
            console.warn(`⚠️ [${pid}] Received invalid message format from client:`, msg);
            return;
        }

        const messageData = formatMessage(
            (typeof messageContent === 'object' && messageContent.username) ? messageContent.username : user.name,
            user.id,
            messageContent
        );

        await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
            type: 'message',
            payload: messageData
        }));

        console.log(`📤 [${pid}] Published message to chat:${user.room}`);
    });

    socket.on('disconnect', async () => {
        const user = await userLeft(socket.id);
        if (user) {
            await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                type: 'userLeft',
                payload: { username: user.name }
            }));
            console.log(`📤 [${pid}] Published userLeft to chat:${user.room}`);
        }
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(`🛑 [${pid}] SIGINT received. Closing connections...`);
    await redisClient.quit();
    await redisPublisher.quit();
    await redisSubscriber.quit();
    server.close(() => {
        console.log(`✅ [${pid}] Server closed gracefully`);
        process.exit(0);
    });
});

// Start server
server.listen(port, () => {
    console.log(`🚀 [${pid}] Server running on port ${port}`);
});
