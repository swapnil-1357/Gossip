
const formatMessage = (username, id, text) => {
    return {
        username,
        id,
        text,
        time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
}

module.exports = formatMessage
