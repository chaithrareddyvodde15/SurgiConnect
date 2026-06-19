// ─────────────────────────────────────────────────────────────────────────────
// server.js  (complete replacement — only additions are the Socket.IO lines)
// ─────────────────────────────────────────────────────────────────────────────

const http    = require("http");                            // ← NEW
const express = require("express");
const dotenv  = require("dotenv");
const { Server } = require("socket.io");                   // ← NEW

const connectDB = require("./config/db");

// ── Route imports (unchanged) ──────────────────────────────────────────────
const authRoutes              = require("./routes/authRoutes");
const doctorRoutes            = require("./routes/doctorRoutes");
const managerRoutes           = require("./routes/managerRoutes");
const hospitalRoutes          = require("./routes/hospitalRoutes");
const emergencyRequestRoutes  = require("./routes/emergencyRequestRoutes");
const notificationRoutes      = require("./routes/notificationRoutes");
const auditLogRoutes          = require("./routes/auditLogRoutes");
const aiRecommendationRoutes  = require("./routes/aiRecommendationRoutes");
const doctorAssignmentRoutes  = require("./routes/doctorAssignmentRoutes");
const dashboardRoutes         = require("./routes/dashboardRoutes");

// ── Socket imports ─────────────────────────────────────────────────────────
const { initSocketManager }      = require("./socket/socketManager");   // ← NEW
const { registerSocketHandlers } = require("./socket/socketHandlers");  // ← NEW

// ─────────────────────────────────────────────────────────────────────────────
dotenv.config();

const app        = express();
const httpServer = http.createServer(app);                 // ← NEW (wrap express)

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO server setup
// ─────────────────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {                        // ← NEW
  cors: {
    origin: process.env.CLIENT_URL || "*",   // tighten in production
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

// Make `io` available on the Express app so any controller can reach it via:
//   const io = req.app.get("io");
app.set("io", io);                                         // ← NEW

// Initialise the user-socket map and register all connection handlers
initSocketManager(io);                                     // ← NEW
registerSocketHandlers(io);                                // ← NEW

// ─────────────────────────────────────────────────────────────────────────────
// Express middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// REST Routes (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api/auth",               authRoutes);
app.use("/api/doctors",            doctorRoutes);
app.use("/api/managers",           managerRoutes);
app.use("/api/hospitals",          hospitalRoutes);
app.use("/api/emergency-requests", emergencyRequestRoutes);
app.use("/api/notifications",      notificationRoutes);
app.use("/api/audit-logs",         auditLogRoutes);
app.use("/api/ai-recommendations", aiRecommendationRoutes);
app.use("/api/assignments",        doctorAssignmentRoutes);
app.use("/api/dashboard",          dashboardRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Start — use httpServer so Socket.IO shares the same port as Express
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB();
httpServer.listen(PORT, () => {                            // ← CHANGED (was app.listen)
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO listening on ws://localhost:${PORT}`);
});