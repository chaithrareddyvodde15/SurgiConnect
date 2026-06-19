// socketClientTest.js
// Run: node socketClientTest.js <JWT_TOKEN>
// Example: node socketClientTest.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

const { io } = require("socket.io-client");

const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error("❌ No token provided.");
  console.error("   Usage: node socketClientTest.js <JWT_TOKEN>");
  process.exit(1);
}

console.log("🔌 Connecting to ws://localhost:5000 ...\n");

const socket = io("http://localhost:5000", {
  auth: { token: TOKEN },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log(`✅ Connected | socket ID: ${socket.id}\n`);
});

socket.on("auth:success", (data) => {
  console.log("🔐 auth:success");
  console.log(JSON.stringify(data, null, 2), "\n");
});

socket.on("auth:error", (data) => {
  console.error("❌ auth:error");
  console.error(JSON.stringify(data, null, 2), "\n");
  socket.disconnect();
});

socket.on("presence:update", (data) => {
  console.log("👥 presence:update");
  console.log(JSON.stringify(data, null, 2), "\n");
});

socket.on("notification:new", (data) => {
  console.log("🔔 notification:new");
  console.log(JSON.stringify(data, null, 2), "\n");
});

socket.on("ai:recommendation_ready", (data) => {
  console.log("🤖 ai:recommendation_ready");
  console.log(JSON.stringify(data, null, 2), "\n");
});

socket.on("disconnect", (reason) => {
  console.log(`🔴 Disconnected | reason: ${reason}\n`);
});

socket.on("connect_error", (err) => {
  console.error(`❌ Connection error: ${err.message}\n`);
});