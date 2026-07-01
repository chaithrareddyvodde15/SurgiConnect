"use strict";

const express = require("express");
const router  = express.Router();

const {
  register,
  registerHospital,
  registerPatient,
  registerDoctor,
  login,
  getMe,
} = require("../controllers/authController");

const protect = require("../middlewares/authMiddleware");

// ─────────────────────────────────────────────
// Public routes — no auth required
// ─────────────────────────────────────────────

/**
 * POST /api/auth/register/hospital
 * Creates a User (role: hospital) + Hospital document atomically.
 * Required body fields:
 *   name, email, password,
 *   hospitalName, registrationNumber, type,
 *   contact: { phone, email },
 *   address: { street, city, state, zip }
 * Optional: phone, contact.emergencyLine, address.country,
 *           specializations[], facilities{}
 */
router.post("/register/hospital", registerHospital);

/**
 * POST /api/auth/register/patient
 * Creates a User (role: patient) + Patient profile document atomically.
 * Required body fields: name, email, password, gender, dateOfBirth
 * Optional: phone
 */
router.post("/register/patient", registerPatient);

/**
 * POST /api/auth/register/doctor
 * Creates a User (role: doctor). Doctor profile (specialization, fee, etc.)
 * is set separately via PUT /api/doctors/availability or a profile endpoint.
 * Required body fields: name, email, password
 * Optional: phone
 */
router.post("/register/doctor", registerDoctor);

/**
 * POST /api/auth/register
 * Legacy generic register — kept for backward compatibility.
 * Routes to role-specific handler based on the `role` field in the body.
 * New clients should use the role-specific endpoints above.
 */
router.post("/register", register);

/**
 * POST /api/auth/login
 * Single unified login for ALL roles (hospital, doctor, patient).
 * The backend detects the role automatically and returns the appropriate
 * populated profile in the response. No separate login endpoints exist.
 * Required body fields: email, password
 */
router.post("/login", login);

// ─────────────────────────────────────────────
// Protected routes — require valid JWT
// ─────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns the currently authenticated user with their full role-specific
 * profile embedded. Useful for app initialization after token restore.
 */
router.get("/me", protect, getMe);

module.exports = router;