const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const {
  assignDoctorsToRequest,
  unassignDoctor,
  getAssignedDoctors,
  getEmergenciesForDoctor,
} = require("../controllers/doctorAssignmentController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Validation: Assign doctors
// ─────────────────────────────────────────────
const assignValidation = [
  body("doctors")
    .isArray({ min: 1 })
    .withMessage("doctors array is required and must contain at least one entry"),

  body("doctors.*.doctorId")
    .notEmpty()
    .withMessage("doctorId is required for each entry")
    .isMongoId()
    .withMessage("doctorId must be a valid Mongo ID"),

  body("doctors.*.role")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("role cannot exceed 100 characters"),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("note cannot exceed 500 characters"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// POST   /api/assignments/:requestId/assign
// Assign one or more doctors to an emergency request (Manager only)
router.post(
  "/:requestId/assign",
  protect,
  authorizeRoles("manager"),
  assignValidation,
  assignDoctorsToRequest
);

// DELETE /api/assignments/:requestId/doctors/:doctorId
// Unassign a doctor from an emergency request (Manager only)
router.delete(
  "/:requestId/doctors/:doctorId",
  protect,
  authorizeRoles("manager"),
  unassignDoctor
);

// GET    /api/assignments/:requestId/doctors
// Get all doctors assigned to a request (Manager, or assigned Doctor)
router.get(
  "/:requestId/doctors",
  protect,
  authorizeRoles("manager", "doctor"),
  getAssignedDoctors
);

// GET    /api/assignments/doctor/:doctorId
// Get all emergency requests assigned to a doctor, paginated
// (Manager — any doctor; Doctor — own records only)
router.get(
  "/doctor/:doctorId",
  protect,
  authorizeRoles("manager", "doctor"),
  getEmergenciesForDoctor
);

module.exports = router;