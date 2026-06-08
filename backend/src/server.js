const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db"); // ✅ THIS LINE IS IMPORTANT
const authRoutes = require("./routes/authRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");

console.log("Starting server...");

// connect DB
connectDB();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);

// test route
app.get("/", (req, res) => {
  res.json({ message: "SurgiConnect API is running 🚀" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});