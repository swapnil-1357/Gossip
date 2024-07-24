const express = require('express')
const path = require('path')
const http = require('http')
const formatMessage = require('./message')
const { userJoin, getUser, userLeft } = require('./users')

const app = express()
const server = http.createServer(app)
const bodyparser = require('body-parser')
const { Server } = require('socket.io')
const io = new Server(server)

const bot = 'GossiBot'
const port = process.env.PORT || 5000

app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname + '')))
app.use(express.json())
app.use(bodyparser.urlencoded({ extended: true }))
app.use(express.static('public'))

// route handling
app.get('/', (req, res) => {
    res.render("index")
})

app.post('/join', (req, res) => {
    const { user, room } = req.body
    res.render("chat", {
        username: user,
        roomname: room,
    })
})

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id)

    socket.on('user-joined', (newUser) => {
        const user = userJoin(socket.id, newUser.username, newUser.roomname)
        socket.join(user.room)
        console.log(user)

        socket.emit('message', formatMessage(bot, '1357', 'Welcome to Gossip'))
        socket.broadcast.to(user.room).emit('message', formatMessage(bot, '1357', `${user.name} has joined this room`))
    })

    socket.on('chatMessage', (msg) => {
        const user = getUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', formatMessage(user.name, user.id, msg))
        }
    })

 
    socket.on('disconnect', () => {
        const user = userLeft(socket.id)
        if (user) {
            io.to(user.room).emit('message', formatMessage(bot, '1357', `${user.name} has left the room`))
        }
    })
})


server.listen(port, () => console.log('server is up and running on port: ' + port))
