let allUsers = []

const userJoin = (id, name, room) => {
    const user = { id, name, room }
    allUsers.push(user)
    return user
}

const getUser = (id) => {
    return allUsers.find(user => user.id === id)
}

const userLeft = (id) => {
    const index = allUsers.findIndex(user => user.id === id)
    if (index !== -1) {
        return allUsers.splice(index, 1)[0]
    }
}

module.exports = { userJoin, getUser, userLeft }
