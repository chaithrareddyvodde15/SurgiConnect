"use strict";

const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

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

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Specializations
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
  "Gynecology",
  "Urology",
  "Emergency Medicine",
  "Dermatology",
  "Psychiatry",
  "ENT",
  "Ophthalmology",
  "Pulmonology",
  "Nephrology",
  "Gastroenterology",
  "Oncology",
  "Radiology",
  "Pathology",
  "Plastic Surgery",
  "Dentistry",
];

// ─────────────────────────────────────────────
// Validation: Create Emergency Request
// ─────────────────────────────────────────────
const createValidation = [
  body("patientName")
    .trim()
    .notEmpty()
    .withMessage("Patient name is required")
    .isLength({ max: 100 })
    .withMessage("Patient name cannot exceed 100 characters"),

  body("patientAge")
    .isInt({ min: 0, max: 130 })
    .withMessage("Patient age must be between 0 and 130"),

  body("gender")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Gender must be Male, Female, or Other"),

  body("emergencyType")
    .trim()
    .notEmpty()
    .withMessage("Emergency type is required"),

  body("symptoms")
    .isArray({ min: 1 })
    .withMessage("At least one symptom is required"),

  body("symptoms.*")
    .trim()
    .notEmpty()
    .withMessage("Symptom entries cannot be empty strings"),

  body("severity")
    .isIn(["Low", "Medium", "High", "Critical"])
    .withMessage("Severity must be Low, Medium, High, or Critical"),

  body("hospital")
    .notEmpty()
    .withMessage("Hospital ID is required")
    .isMongoId()
    .withMessage("Invalid hospital ID"),

  body("requiredSpecialization")
    .notEmpty()
    .withMessage("requiredSpecialization is required")
    .isIn(SPECIALIZATIONS)
    .withMessage(
      `requiredSpecialization must be one of: ${SPECIALIZATIONS.join(", ")}`
    ),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Validation: Update Emergency Request
// ─────────────────────────────────────────────
const updateValidation = [
  body("patientName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Patient name cannot exceed 100 characters"),

  body("patientAge")
    .optional()
    .isInt({ min: 0, max: 130 })
    .withMessage("Patient age must be between 0 and 130"),

  body("gender")
    .optional()
    .isIn(["Male", "Female", "Other"])
    .withMessage("Invalid gender value"),

  body("severity")
    .optional()
    .isIn(["Low", "Medium", "High", "Critical"])
    .withMessage("Invalid severity value"),

  body("symptoms")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one symptom is required"),

  body("requiredSpecialization")
    .optional()
    .isIn(SPECIALIZATIONS)
    .withMessage(
      `requiredSpecialization must be one of: ${SPECIALIZATIONS.join(", ")}`
    ),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Doctor Response Validation
// ─────────────────────────────────────────────
const respondValidation = [
  body("action")
    .notEmpty()
    .withMessage("action is required")
    .isIn(["Accepted", "Declined"])
    .withMessage("action must be Accepted or Declined"),

  body("eta")
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage("eta must be between 1 and 480 minutes"),

  body("reasonType")
    .if(body("action").equals("Declined"))
    .notEmpty()
    .withMessage("reasonType is required")
    .isIn(["Unavailable", "OutOfSpecialization", "TooFar", "Other"])
    .withMessage("Invalid reasonType"),

  body("customReason")
    .if(body("reasonType").equals("Other"))
    .notEmpty()
    .withMessage("customReason is required")
    .isLength({ max: 300 })
    .withMessage("customReason cannot exceed 300 characters"),
];

// ─────────────────────────────────────────────
// Confirm Doctor Validation
// ─────────────────────────────────────────────
const confirmValidation = [
  body("doctorId")
    .notEmpty()
    .withMessage("doctorId is required")
    .isMongoId()
    .withMessage("doctorId must be a valid MongoDB ID"),

  body("role")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("role cannot exceed 100 characters"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

router
  .route("/")
  .post(
    protect,
    authorizeRoles("hospital"),
    createValidation,
    createEmergencyRequest
  )
  .get(
    protect,
    authorizeRoles("hospital"),
    getAllEmergencyRequests
  );

router
  .route("/:id")
  .get(
    protect,
    authorizeRoles("hospital", "doctor"),
    getEmergencyRequestById
  )
  .put(
    protect,
    authorizeRoles("hospital"),
    updateValidation,
    updateEmergencyRequest
  );

router.patch(
  "/:id/assign-doctors",
  protect,
  authorizeRoles("hospital"),
  assignDoctors
);

router.patch(
  "/:id/status",
  protect,
  authorizeRoles("hospital", "doctor"),
  updateEmergencyStatus
);

router.post(
  "/:id/respond",
  protect,
  authorizeRoles("doctor"),
  respondValidation,
  respondToEmergency
);

router.patch(
  "/:id/confirm-doctor",
  protect,
  authorizeRoles("hospital"),
  confirmValidation,
  confirmDoctor
);

router.patch(
  "/:id/start",
  protect,
  authorizeRoles("doctor"),
  startEmergency
);

router.patch(
  "/:id/complete",
  protect,
  authorizeRoles("doctor"),
  completeEmergency
);

module.exports = router;