"use strict";

const express = require("express");
const router = express.Router();

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

const {
  getDoctors,
  getDoctorById,
  updateDoctorProfile,
  updateAvailability,
} = require("../controllers/doctorController");

// -----------------------------------------------------------------------------
// GET /api/doctors
// Get all doctors with filtering, search, sorting and pagination
// Accessible by all authenticated users
// -----------------------------------------------------------------------------
router.get(
  "/",
  protect,
  getDoctors
);

// -----------------------------------------------------------------------------
// PUT /api/doctors/availability
// Doctor updates own availability
// -----------------------------------------------------------------------------
router.put(
  "/availability",
  protect,
  authorizeRoles("doctor"),
  updateAvailability
);

// -----------------------------------------------------------------------------
// PATCH /api/doctors/profile
// Doctor updates own profile
// -----------------------------------------------------------------------------
router.patch(
  "/profile",
  protect,
  authorizeRoles("doctor"),
  updateDoctorProfile
);

// -----------------------------------------------------------------------------
// GET /api/doctors/:id
// Get one doctor's complete profile
// Accessible by all authenticated users
// -----------------------------------------------------------------------------
router.get(
  "/:id",
  protect,
  getDoctorById
);

module.exports = router;