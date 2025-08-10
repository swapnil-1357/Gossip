const express = require("express");
const path = require("path");
const http = require("http");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const formatMessage = require("./message");
const {
    initRedisClient,
    userJoin,
    getUser,
    userLeft
} = require("./users");
const { initRedis, getRedisClients } = require("./redis");

dotenv.config();

const pid = process.pid;
const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

console.log(`🚀 [${pid}] Starting server.js on PORT=${port}`);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const bot = "GossiBot";

// --- Redis Setup ---
(async () => {
    try {
        await initRedis();
        const { redisClient, redisPublisher, redisSubscriber } = getRedisClients();

        initRedisClient(redisClient);

        // Listen for messages on Redis
        redisSubscriber.pSubscribe("chat:*", async (message, channel) => {
            try {
                const data = JSON.parse(message);
                const room = channel.split(":")[1];

                console.log(`📨 [${pid}] [Redis] Received on ${channel}:`, data);

                switch (data.type) {
                    case "message":
                        io.to(room).emit("message", data.payload);
                        break;
                    case "userJoined":
                        io.to(room).emit("message",
                            formatMessage(bot, "1357", `${data.payload.username} has joined the room`)
                        );
                        break;
                    case "userLeft":
                        io.to(room).emit("message",
                            formatMessage(bot, "1357", `${data.payload.username} has left the room`)
                        );
                        break;
                    default:
                        console.warn(`⚠️ [${pid}] Unknown message type: ${data.type}`);
                }
            } catch (err) {
                console.error(`❌ [${pid}] Error processing Redis message:`, err);
            }
        });

        // --- Socket.IO Events ---
        io.on("connection", (socket) => {
            console.log(`🟢 [${pid}] New user connected: ${socket.id}`);

            socket.on("user-joined", async ({ username, roomname }) => {
                const user = await userJoin(socket.id, username, roomname);
                socket.join(user.room);
                socket.username = user.name;

                socket.emit("message", formatMessage(bot, "1357", "Welcome to Gossip"));

                await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                    type: "userJoined",
                    payload: { username: user.name }
                }));

                console.log(`📤 [${pid}] Published userJoined to chat:${user.room}`);
            });

            socket.on("chatMessage", async (msg) => {
                const user = await getUser(socket.id);
                if (!user) return;

                let messageContent = (typeof msg === "string" || typeof msg === "object") ? msg : null;
                if (!messageContent) return console.warn(`⚠️ [${pid}] Invalid message:`, msg);

                const messageData = formatMessage(
                    (typeof messageContent === "object" && messageContent.username) ? messageContent.username : user.name,
                    user.id,
                    messageContent
                );

                await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                    type: "message",
                    payload: messageData
                }));

                console.log(`📤 [${pid}] Published message to chat:${user.room}`);
            });

            socket.on("disconnect", async () => {
                const user = await userLeft(socket.id);
                if (user) {
                    await redisPublisher.publish(`chat:${user.room}`, JSON.stringify({
                        type: "userLeft",
                        payload: { username: user.name }
                    }));
                    console.log(`📤 [${pid}] Published userLeft to chat:${user.room}`);
                }
            });
        });

        // --- Express Routes ---
        app.set("view engine", "ejs");
        app.use(express.static(path.join(__dirname, "public")));
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(express.json());

        app.get("/", (req, res) => res.render("index"));

        app.post("/join", (req, res) => {
            const { user, room } = req.body;
            res.render("chat", {
                username: user,
                roomname: room,
                port,
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                unsignedPreset: process.env.CLOUDINARY_UNSIGNED_PRESET
            });
        });

        // Graceful shutdown
        process.on("SIGINT", async () => {
            console.log(`🛑 [${pid}] SIGINT received. Closing connections...`);
            await redisClient.quit();
            await redisPublisher.quit();
            await redisSubscriber.quit();
            server.close(() => {
                console.log(`✅ [${pid}] Server closed gracefully`);
                process.exit(0);
            });
        });

        // Start server
        server.listen(port, () => {
            console.log(`🚀 [${pid}] Server running on port ${port}`);
        });

    } catch (error) {
        console.error(`❌ [${pid}] Failed to start server:`, error);
        process.exit(1);
    }
})();
