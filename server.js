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

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const bot = 'GossiBot';

// ✅ Redis client config for Railway-compatible deployment
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

// ✅ Connect Redis and attach listeners
const connectRedis = async () => {
    try {
        await redisClient.connect();
        await redisPublisher.connect();
        await redisSubscriber.connect();

        console.log('✅ Redis client connected');
        console.log('✅ Redis publisher connected');
        console.log('✅ Redis subscriber connected');

        initRedisClient(redisClient);

        redisClient.on('error', (err) => console.error('❌ Redis error:', err));
        redisClient.on('connect', () => console.log('🔌 Redis main client connected'));
        redisClient.on('reconnecting', () => console.log('🔁 Redis client reconnecting...'));
        redisClient.on('end', () => console.log('🚪 Redis connection closed'));

        // Optional periodic Redis stats
        setInterval(async () => {
            const info = await redisClient.info();
            console.log('📊 Redis INFO Snapshot:\n', info.split('\n').slice(0, 8).join('\n'));
        }, 60000);

    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        process.exit(1);
    }
};

connectRedis();

// ✅ Static & view config
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/join', (req, res) => {
    const { user, room } = req.body;
    res.render('chat', {
        username: user,
        roomname: room,
        port
    });
});

// ✅ Redis Subscriber - Pub/Sub message relay
redisSubscriber.pSubscribe('chat:*', async (message, channel) => {
    const data = JSON.parse(message);
    const room = channel.split(':')[1];

    console.log(`📨 [Redis] Received on ${channel}:`, data);

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
    }
});

// ✅ Socket.IO logic
io.on('connection', (socket) => {
    console.log('🔌 New user connected:', socket.id);

    socket.on('user-joined', async ({ username, roomname }) => {
        const user = await userJoin(socket.id, username, roomname);
        socket.join(user.room);

        socket.emit('message', formatMessage(bot, '1357', 'Welcome to Gossip'));

        await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
            type: 'userJoined',
            payload: { username: user.name }
        }));
        console.log(`📤 [Redis] Published userJoined to chat:${user.room}`);
    });

    socket.on('chatMessage', async (msg) => {
        const user = await getUser(socket.id);
        if (user) {
            const messageData = formatMessage(user.name, user.id, msg);

            await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                type: 'message',
                payload: messageData
            }));
            console.log(`📤 [Redis] Published message to chat:${user.room}`);
        }
    });

    socket.on('disconnect', async () => {
        const user = await userLeft(socket.id);
        if (user) {
            await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                type: 'userLeft',
                payload: { username: user.name }
            }));
            console.log(`📤 [Redis] Published userLeft to chat:${user.room}`);
        }
    });
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received. Closing connections...');
    await redisClient.quit();
    await redisPublisher.quit();
    await redisSubscriber.quit();
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});

// ✅ Start HTTP server
server.listen(port, () => {
    console.log(`🚀 Server running on port ${port} | PID: ${process.pid}`);
});
