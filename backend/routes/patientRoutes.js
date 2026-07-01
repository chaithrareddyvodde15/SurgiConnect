"use strict";

const express = require("express");
const router  = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  getPatientById,
} = require("../controllers/patientController");

const protect        = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// Patient profile routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET   /api/patients/me  — patient reads their own profile
 * PATCH /api/patients/me  — patient updates name, phone, gender, dateOfBirth
 *
 * Doctor discovery for patients is handled by the existing /api/doctors endpoint.
 * Patients may call GET /api/doctors with query params:
 *   ?specialization=Cardiology
 *   ?availability=Available
 *   ?minFee=500&maxFee=2000
 *   ?q=search+term
 *   ?page=1&limit=10
 */
router
  .route("/me")
  .get(  protect, authorizeRoles("patient"), getMyProfile)
  .patch(protect, authorizeRoles("patient"), updateMyProfile);

/**
 * GET /api/patients/:id
 * Fetch a specific patient by ID — accessible to hospital role for
 * administrative lookups (e.g. viewing a patient's basic info).
 * Patient can also access their own record.
 */
router.get(
  "/:id",
  protect,
  authorizeRoles("hospital", "patient"),
  getPatientById
);

module.exports = router;