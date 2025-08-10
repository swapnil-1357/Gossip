const redis = require("redis");

let redisClient, redisPublisher, redisSubscriber;

async function initRedis() {
    if (!process.env.UPSTASH_REDIS_URL) {
        throw new Error("❌ UPSTASH_REDIS_URL is not set in environment variables");
    }

    // Main client
    redisClient = redis.createClient({
        url: process.env.UPSTASH_REDIS_URL
    });

    // Publisher & subscriber
    redisPublisher = redisClient.duplicate();
    redisSubscriber = redisClient.duplicate();

    // Connect all
    await Promise.all([
        redisClient.connect(),
        redisPublisher.connect(),
        redisSubscriber.connect()
    ]);

    console.log("✅ Redis main client connected");
    console.log("✅ Redis publisher connected");
    console.log("✅ Redis subscriber connected");

    // Basic error handling
    [redisClient, redisPublisher, redisSubscriber].forEach((client) => {
        client.on("error", (err) => console.error("❌ Redis error:", err));
        client.on("reconnecting", () => console.log("🔁 Redis reconnecting..."));
        client.on("end", () => console.log("🚪 Redis connection closed"));
    });

    return { redisClient, redisPublisher, redisSubscriber };
}

function getRedisClients() {
    if (!redisClient || !redisPublisher || !redisSubscriber) {
        throw new Error("Redis clients not initialized. Call initRedis() first.");
    }
    return { redisClient, redisPublisher, redisSubscriber };
}

module.exports = { initRedis, getRedisClients };
