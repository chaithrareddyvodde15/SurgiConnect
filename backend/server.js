const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const managerRoutes = require('./routes/managerRoutes');
const hospitalRoutes = require("./routes/hospitalRoutes");
const emergencyRequestRoutes = require("./routes/emergencyRequestRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const aiRecommendationRoutes = require("./routes/aiRecommendationRoutes");
const doctorAssignmentRoutes = require("./routes/doctorAssignmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");


dotenv.config();
const app = express();
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/managers', managerRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/emergency-requests", emergencyRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/ai-recommendations", aiRecommendationRoutes);
app.use("/api/assignments", doctorAssignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
connectDB();
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
