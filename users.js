// users.js
let redisClient
let allUsers = []  // Fallback storage for dev mode

function initRedisClient(client) {
    redisClient = client
    console.log('Users module connected to Redis')
}

// Join user
const userJoin = async (id, name, room) => {
    const user = { id, name, room }
    try {
        await redisClient.setEx(`user:${id}`, 3600, JSON.stringify(user))
        await redisClient.sAdd(`room:${room}`, id)
        console.log(`User ${name} joined room ${room}`)
    } catch (error) {
        console.error('Redis error in userJoin:', error)
        allUsers.push(user)
    }
    return user
}

// Get a single user
const getUser = async (id) => {
    try {
        const data = await redisClient.get(`user:${id}`)
        return data ? JSON.parse(data) : null
    } catch (error) {
        console.error('Redis error in getUser:', error)
        return allUsers.find(user => user.id === id)
    }
}

// Remove user and return their info
const userLeft = async (id) => {
    try {
        const data = await redisClient.get(`user:${id}`)
        if (data) {
            const user = JSON.parse(data)
            await redisClient.del(`user:${id}`)
            await redisClient.sRem(`room:${user.room}`, id)
            console.log(`User ${user.name} left room ${user.room}`)
            return user
        }
    } catch (error) {
        console.error('Redis error in userLeft:', error)
        const index = allUsers.findIndex(user => user.id === id)
        if (index !== -1) return allUsers.splice(index, 1)[0]
    }
    return null
}

// Get all users in a room
const getRoomUsers = async (room) => {
    try {
        const ids = await redisClient.sMembers(`room:${room}`)
        const users = []
        for (const id of ids) {
            const userData = await redisClient.get(`user:${id}`)
            if (userData) users.push(JSON.parse(userData))
        }
        return users
    } catch (error) {
        console.error('Redis error in getRoomUsers:', error)
        return allUsers.filter(user => user.room === room)
    }
}

// Get user count in a room
const getUserCount = async (room) => {
    try {
        return await redisClient.sCard(`room:${room}`)
    } catch (error) {
        console.error('Redis error in getUserCount:', error)
        return allUsers.filter(user => user.room === room).length
    }
}

// Periodic cleanup for keys with no expiration
const cleanupExpiredUsers = async () => {
    try {
        const keys = await redisClient.keys('user:*')
        for (const key of keys) {
            const ttl = await redisClient.ttl(key)
            if (ttl === -1) {
                await redisClient.expire(key, 3600)
            }
        }
    } catch (error) {
        console.error('Error in cleanupExpiredUsers:', error)
    }
}

// Run every 10 minutes
setInterval(cleanupExpiredUsers, 10 * 60 * 1000)

module.exports = {
    initRedisClient,
    userJoin,
    getUser,
    userLeft,
    getRoomUsers,
    getUserCount
}
