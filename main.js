const input = document.getElementById('msg')
const button = document.getElementById('btn')
const msgContainer = document.getElementById('msg-container')

const username = '<%= username %>'
const roomname = '<%= roomname %>'

const socket = io()

// Join chatroom
socket.emit('user-joined', { username, roomname })

// Receive message from server
socket.on('message', (data) => {
    addMessage(data)
    msgContainer.scrollTop = msgContainer.scrollHeight
})

// Send message on button click
button.addEventListener('click', (e) => {
    e.preventDefault()
    sendMessage()
})

// Send message on Enter key press
input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        sendMessage()
    }
})

function sendMessage() {
    const msg = input.value.trim()
    if (msg !== '') {
        socket.emit('chatMessage', msg)
        input.value = ''
        input.focus()
    }
}

function addMessage(data) {
    const newChild = document.createElement('div')
    newChild.classList.add('p-2', 'my-2', 'rounded-xl', 'max-w-[70%]')

    if (data.id === socket.id) {
        newChild.classList.add('ml-auto', 'bg-blue-100', 'text-right')
        newChild.innerHTML = `
            <p class="font-bold text-sm text-black">You</p>
            <p class="text-md">${data.text}</p>
            <span class="text-xs text-gray-500">${data.time}</span>
        `
    } else if (data.id === '1357') {
        newChild.classList.add('text-center', 'text-gray-500', 'italic', 'mx-auto')
        newChild.innerHTML = `<p>${data.text}</p><span class="text-xs">${data.time}</span>`
    } else {
        newChild.classList.add('mr-auto', 'bg-gray-100')
        newChild.innerHTML = `
            <p class="font-bold text-sm text-black">${data.username}</p>
            <p class="text-md">${data.text}</p>
            <span class="text-xs text-gray-500">${data.time}</span>
        `
    }

    msgContainer.appendChild(newChild)
}
