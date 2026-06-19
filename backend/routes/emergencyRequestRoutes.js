const express = require("express");
const router  = express.Router();
const { body } = require("express-validator");

const {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  assignDoctors,
  updateEmergencyStatus,
  startEmergency,
  completeEmergency,
} = require("../controllers/emergencyRequestController");

const protect        = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Validation: Create
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

  body("notes")
    .optional()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Validation: Update
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

  body("notes")
    .optional()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// POST   /api/emergency-requests       → Create  (Manager)
// GET    /api/emergency-requests       → List    (Admin, Manager)
router
  .route("/")
  .post(protect, authorizeRoles("manager"),          createValidation, createEmergencyRequest)
  .get( protect, authorizeRoles("admin", "manager"), getAllEmergencyRequests);

// GET    /api/emergency-requests/:id   → Get by ID (Admin, Manager, Doctor)
// PUT    /api/emergency-requests/:id   → Update    (Manager)
router
  .route("/:id")
  .get(protect, authorizeRoles("admin", "manager", "doctor"), getEmergencyRequestById)
  .put(protect, authorizeRoles("manager"),                    updateValidation, updateEmergencyRequest);

// PATCH  /api/emergency-requests/:id/assign-doctors  (Manager)
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