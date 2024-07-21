const formatMessage = (user, id, msg) => {
    let obj = { user, msg, id }
    return obj;
}

module.exports = formatMessage