"use strict";

const express    = require("express");
const router     = express.Router();
const { body }   = require("express-validator");

const {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  assignDoctors,
  updateEmergencyStatus,
  respondToEmergency,
  confirmDoctor,
  startEmergency,
  completeEmergency,
} = require("../controllers/emergencyRequestController");

const protect        = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Specialization enum — mirrors EmergencyRequest model constant.
// Kept here so validation stays in sync with route layer.
// Single source of truth is EmergencyRequest.SPECIALIZATIONS (via statics).
// ─────────────────────────────────────────────
const SPECIALIZATIONS = [
  "Cardiology",
  "Neurology",
  "Neurosurgery",
  "Orthopedics",
  "Anesthesiology",
  "Critical Care",
  "Pediatrics",
  "General Surgery",
];

// ─────────────────────────────────────────────
// Validation: Create Emergency Request
// ─────────────────────────────────────────────
const createValidation = [
  body("patientName")
    .trim()
    .notEmpty().withMessage("Patient name is required")
    .isLength({ max: 100 }).withMessage("Patient name cannot exceed 100 characters"),

  body("patientAge")
    .isInt({ min: 0, max: 130 })
    .withMessage("Patient age must be between 0 and 130"),

  body("gender")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Gender must be Male, Female, or Other"),

  body("emergencyType")
    .trim()
    .notEmpty().withMessage("Emergency type is required"),

  body("symptoms")
    .isArray({ min: 1 }).withMessage("At least one symptom is required"),

  body("symptoms.*")
    .trim()
    .notEmpty().withMessage("Symptom entries cannot be empty strings"),

  body("severity")
    .isIn(["Low", "Medium", "High", "Critical"])
    .withMessage("Severity must be Low, Medium, High, or Critical"),

  body("hospital")
    .notEmpty().withMessage("Hospital ID is required")
    .isMongoId().withMessage("Invalid hospital ID"),

  body("requiredSpecialization")
    .notEmpty().withMessage("requiredSpecialization is required")
    .isIn(SPECIALIZATIONS)
    .withMessage(`requiredSpecialization must be one of: ${SPECIALIZATIONS.join(", ")}`),

  body("notes")
    .optional()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Validation: Update Emergency Request
// ─────────────────────────────────────────────
const updateValidation = [
  body("patientName")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Patient name cannot exceed 100 characters"),

  body("patientAge")
    .optional()
    .isInt({ min: 0, max: 130 }).withMessage("Patient age must be between 0 and 130"),

  body("gender")
    .optional()
    .isIn(["Male", "Female", "Other"]).withMessage("Invalid gender value"),

  body("severity")
    .optional()
    .isIn(["Low", "Medium", "High", "Critical"]).withMessage("Invalid severity value"),

  body("symptoms")
    .optional()
    .isArray({ min: 1 }).withMessage("At least one symptom is required"),

  body("requiredSpecialization")
    .optional()
    .isIn(SPECIALIZATIONS)
    .withMessage(`requiredSpecialization must be one of: ${SPECIALIZATIONS.join(", ")}`),

  body("notes")
    .optional()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Validation: Doctor Respond (Accept or Decline)
// ─────────────────────────────────────────────
const respondValidation = [
  body("action")
    .notEmpty().withMessage("action is required")
    .isIn(["Accepted", "Declined"])
    .withMessage("action must be Accepted or Declined"),

  // Accept-only: ETA in minutes (optional)
  body("eta")
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage("eta must be an integer between 1 and 480 minutes"),

  // Decline-only: structured reason (required when action is Declined)
  body("reasonType")
    .if(body("action").equals("Declined"))
    .notEmpty().withMessage("reasonType is required when action is Declined")
    .isIn(["Unavailable", "OutOfSpecialization", "TooFar", "Other"])
    .withMessage("Invalid reasonType value"),

  // customReason: required when reasonType is "Other"
  body("customReason")
    .if(body("reasonType").equals("Other"))
    .notEmpty().withMessage("customReason is required when reasonType is Other")
    .isLength({ max: 300 }).withMessage("customReason cannot exceed 300 characters"),
];

// ─────────────────────────────────────────────
// Validation: Hospital Confirms Doctor
// ─────────────────────────────────────────────
const confirmValidation = [
  body("doctorId")
    .notEmpty().withMessage("doctorId is required")
    .isMongoId().withMessage("doctorId must be a valid MongoDB ID"),

  body("role")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("role cannot exceed 100 characters"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// POST   /api/emergency-requests       → Create  (Manager)
// GET    /api/emergency-requests       → List    (Manager)
router
  .route("/")
  .post(protect, authorizeRoles("manager"), createValidation, createEmergencyRequest)
  .get(protect,  authorizeRoles("admin", "manager"),          getAllEmergencyRequests);

// GET    /api/emergency-requests/:id   → Get by ID (Manager, Doctor)
// PUT    /api/emergency-requests/:id   → Update    (Manager)
router
  .route("/:id")
  .get(protect, authorizeRoles("admin", "manager", "doctor"), getEmergencyRequestById)
  .put(protect, authorizeRoles("manager"),                    updateValidation, updateEmergencyRequest);

// PATCH  /api/emergency-requests/:id/assign-doctors  (Manager)
// Legacy endpoint — doctorAssignmentController routes are preferred
router.patch(
  "/:id/assign-doctors",
  protect,
  authorizeRoles("manager"),
  assignDoctors
);

// PATCH  /api/emergency-requests/:id/status  (Manager, Doctor)
router.patch(
  "/:id/status",
  protect,
  authorizeRoles("manager", "doctor"),
  updateEmergencyStatus
);

// POST   /api/emergency-requests/:id/respond  (Doctor)
// Doctor accepts or declines an emergency request.
// Only doctors whose specialization matches receive the broadcast;
// this endpoint enforces that the doctor actually responded.
router.post(
  "/:id/respond",
  protect,
  authorizeRoles("doctor"),
  respondValidation,
  respondToEmergency
);

// PATCH  /api/emergency-requests/:id/confirm-doctor  (Manager)
// Hospital confirms a specific doctor who accepted.
// Triggers formal assignment and notifies the doctor.
router.patch(
  "/:id/confirm-doctor",
  protect,
  authorizeRoles("manager"),
  confirmValidation,
  confirmDoctor
);

// PATCH  /api/emergency-requests/:id/start  (Doctor — must be assigned)
router.patch(
  "/:id/start",
  protect,
  authorizeRoles("doctor"),
  startEmergency
);

// PATCH  /api/emergency-requests/:id/complete  (Doctor — must be assigned)
router.patch(
  "/:id/complete",
  protect,
  authorizeRoles("doctor"),
  completeEmergency
);

module.exports = router;