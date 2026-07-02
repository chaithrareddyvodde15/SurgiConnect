const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

dotenv.config();

const connectDB = require("./config/db");

// Force load every model
require("./models/userModel");
require("./models/doctorModel");
require("./models/Hospital");
require("./models/patientModel");
require("./models/AuditLog");
require("./models/EmergencyRequest");
require("./models/Notification");

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
const patientRoutes = require("./routes/patientRoutes");

// Socket
const { initSocketManager } = require("./socket/socketManager");
const { registerSocketHandlers } = require("./socket/socketHandlers");

const app = express();
const httpServer = http.createServer(app);

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(express.json());

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true,
    },
});

app.set("io", io);

initSocketManager(io);
registerSocketHandlers(io);

// Routes
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
app.use("/api/patients", patientRoutes);
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});