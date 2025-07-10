
const formatMessage = (username, id, text) => {
    const time = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return {
        username,
        id,
        text,
        time
    };
};

module.exports = formatMessage;
