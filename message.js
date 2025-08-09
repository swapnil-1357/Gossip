const formatMessage = (username, id, content) => {
    const time = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // If content is an object and has a "type" property, treat as structured message (image/file)
    if (typeof content === 'object' && content !== null && content.type) {
        return {
            username,
            id,
            ...content,
            time
        };
    }

    // Otherwise, treat as simple text message
    return {
        username,
        id,
        text: content,
        time
    };
};

module.exports = formatMessage;
