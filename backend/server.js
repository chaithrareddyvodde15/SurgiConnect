const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const managerRoutes = require("./routes/managerRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const emergencyRequestRoutes = require("./routes/emergencyRequestRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const aiRecommendationRoutes = require("./routes/aiRecommendationRoutes");
const doctorAssignmentRoutes = require("./routes/doctorAssignmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Socket
const { initSocketManager } = require("./socket/socketManager");
const { registerSocketHandlers } = require("./socket/socketHandlers");

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// =======================
// CORS FIX
// =======================
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// =======================
// Socket.IO
// =======================
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set("io", io);

initSocketManager(io);
registerSocketHandlers(io);

// =======================
// Routes
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/emergency-requests", emergencyRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/ai-recommendations", aiRecommendationRoutes);
app.use("/api/assignments", doctorAssignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;

connectDB();

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO listening on ws://localhost:${PORT}`);
});