const express = require('express')
const path = require('path')
const http = require('http')
const redis = require('redis')
const bodyParser = require('body-parser')
const { Server } = require('socket.io')
const dotenv = require('dotenv')
const formatMessage = require('./message')
const {
    initRedisClient,
    userJoin,
    getUser,
    userLeft,
    getRoomUsers
} = require('./users')

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const bot = 'GossiBot'
const port = process.env.PORT || 5000

// Redis setup
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || redis,
        port: process.env.REDIS_PORT || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined
})

const redisPublisher = redisClient.duplicate()
const redisSubscriber = redisClient.duplicate()

// Connect to Redis
const connectRedis = async () => {
    try {
        await redisClient.connect()
        await redisPublisher.connect()
        await redisSubscriber.connect()
        console.log('Connected to Redis')
        initRedisClient(redisClient)
    } catch (error) {
        console.error('Redis connection error:', error)
        process.exit(1)
    }
}

connectRedis()

// Express config
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json())

// Routes
app.get('/', (req, res) => {
    res.render('index')
})

app.post('/join', (req, res) => {
    const { user, room } = req.body
    res.render('chat', {
        username: user,
        roomname: room,
        port: port
    })
})

// Redis Subscriber: listen for messages across instances
redisSubscriber.pSubscribe('chat:*', async (message, channel) => {
    const data = JSON.parse(message)
    const room = channel.split(':')[1]

    switch (data.type) {
        case 'message':
            io.to(room).emit('message', data.payload)
            break
        case 'userJoined':
            io.to(room).emit('message', formatMessage(bot, '1357', `${data.payload.username} has joined the room`))
            break
        case 'userLeft':
            io.to(room).emit('message', formatMessage(bot, '1357', `${data.payload.username} has left the room`))
            break
    }
})

// Socket.io logic
io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id)

    socket.on('user-joined', async (newUser) => {
        const user = await userJoin(socket.id, newUser.username, newUser.roomname)
        socket.join(user.room)

        socket.emit('message', formatMessage(bot, '1357', 'Welcome to Gossip'))

        await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
            type: 'userJoined',
            payload: { username: user.name }
        }))

        socket.broadcast.to(user.room).emit('message', formatMessage(bot, '1357', `${user.name} has joined the room`))
    })

    socket.on('chatMessage', async (msg) => {
        const user = await getUser(socket.id)
        if (user) {
            const messageData = formatMessage(user.name, user.id, msg)

            await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                type: 'message',
                payload: messageData
            }))

        }
    })
    

    socket.on('disconnect', async () => {
        const user = await userLeft(socket.id)
        if (user) {
            await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                type: 'userLeft',
                payload: { username: user.name }
            }))
            io.to(user.room).emit('message', formatMessage(bot, '1357', `${user.name} has left the room`))
        }
    })
})

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...')
    await redisClient.quit()
    await redisPublisher.quit()
    await redisSubscriber.quit()
    server.close(() => {
        console.log('HTTP server closed')
        process.exit(0)
    })
})

server.listen(port, () => {
    console.log('server is up and running on port: ' + port)
})
