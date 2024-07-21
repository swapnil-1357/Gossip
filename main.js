


let input = document.getElementById('msg')
let button = document.getElementById('btn')
let roomNameDisplay = document.getElementById('roomNameDisplay')
let msgContainer = document.getElementById('msg-container')

const params = new URLSearchParams(window.location.search)
const username = params.get('user')
const roomname = params.get('room')



const socket = io()

socket.emit('user-joined', { username, roomname })

socket.on('message', (data) => {
    addMessage(data)
    msgContainer.scrollTop = msgContainer.scrollHeight
})

button.addEventListener('click', (e) => {
    e.preventDefault()
    sendMessage()
})

input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        sendMessage()
    }
});

function sendMessage() {
    let msg = input.value

    if (msg !== '') 
    {
        socket.emit('chatMessage', msg)
        input.value = ''
        input.focus()
    }
}

function addMessage(data) {
    let newChild = document.createElement('div')
    if (data.id === socket.id) {
        newChild.classList.add('right')
        newChild.innerHTML = `<p class="font-bold text-sm text-black">You : </p><p class="text-lg">${data.msg}</p>`
    } else if (data.id === '1357') {
        newChild.classList.add('middle');
        newChild.innerHTML = `<p>${data.msg}</p>`
    } else {
        newChild.classList.add('left')
        newChild.innerHTML = `<p class="font-bold text-sm text-black">${data.user} : </p><p class="text-lg">${data.msg}</p>`
    }
    msgContainer.appendChild(newChild)
}
