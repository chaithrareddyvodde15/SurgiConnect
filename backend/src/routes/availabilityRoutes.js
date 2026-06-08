const express = require("express");
const router = express.Router();

const {
  setAvailability,
  getAvailableDoctors,
} = require("../controllers/availabilityController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

// 🔥 Only DOCTOR can set availability
router.post("/", protect, authorizeRoles("doctor"), setAvailability);

// ✅ Any logged-in user can view
router.get("/", protect, getAvailableDoctors);

module.exports = router;