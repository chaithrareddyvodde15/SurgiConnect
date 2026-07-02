"use strict";

const { io } = require("socket.io-client");

// ==========================================
// PASTE HOSPITAL JWT TOKEN HERE
// ==========================================
const TOKEN =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNDU2NzUzNzcyOGNmNzg4NTEyYzgxNCIsImlhdCI6MTc4Mjk2NjM2NCwiZXhwIjoxNzgzMDUyNzY0fQ.0urP78gomskJ0a62H8YIlitERyceHVGNUiKmGV-iNEI";

// ==========================================

const socket = io("http://localhost:5000", {
    auth: {
        token: TOKEN,
    },
    transports: ["websocket"],
});

socket.on("connect", () => {
    console.log("\n==================================");
    console.log("✅ Hospital Connected");
    console.log("Socket ID:", socket.id);
    console.log("==================================\n");
});

socket.on("disconnect", (reason) => {
    console.log("\n❌ Hospital Disconnected");
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

socket.on("emergency:response", (data) => {
    console.log("\n========================================");
    console.log("🚑 EMERGENCY RESPONSE RECEIVED");
    console.log("========================================");
    console.log(data);
});