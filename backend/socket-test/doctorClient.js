"use strict";

const { io } = require("socket.io-client");

// ==========================================
// PASTE DOCTOR JWT TOKEN HERE
// ==========================================
const TOKEN =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMzRmZGU2YTA4NTQ2MmNkMWY1MGQ4OSIsImlhdCI6MTc4Mjk2NjQxNCwiZXhwIjoxNzgzMDUyODE0fQ.yK2cJpnhQrL1FyHLlE7NbBHqt9p-VOtfXMaeZKVcssA";

// ==========================================

const socket = io("http://localhost:5000", {
    auth: {
        token: TOKEN,
    },
    transports: ["websocket"],
});

socket.on("connect", () => {
    console.log("\n==================================");
    console.log("✅ Doctor Connected");
    console.log("Socket ID:", socket.id);
    console.log("==================================\n");
});

socket.on("disconnect", (reason) => {
    console.log("\n❌ Doctor Disconnected");
    console.log(reason);
});

socket.on("connect_error", (err) => {
    console.log("\n❌ Connection Error");
    console.log(err.message);
});

socket.on("auth:success", (data) => {
    console.log("\n✅ AUTH SUCCESS");
    console.log(data);
});

socket.on("auth:error", (data) => {
    console.log("\n❌ AUTH ERROR");
    console.log(data);
});

// Emergency Broadcast
socket.on("emergency:new", (data) => {
    console.log("\n========================================");
    console.log("🚨 NEW EMERGENCY RECEIVED");
    console.log("========================================");
    console.log(data);
});

// Notification
socket.on("notification:new", (data) => {
    console.log("\n========================================");
    console.log("🔔 NEW NOTIFICATION");
    console.log("========================================");
    console.log(data);
});

// Presence
socket.on("presence:update", (data) => {
    console.log("\n👤 Presence Update");
    console.log(data);
});

// Pong
socket.on("pong:server", (data) => {
    console.log("\n🏓 Pong");
    console.log(data);
});