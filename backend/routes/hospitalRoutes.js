const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const {
  createHospital,
  getAllHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  assignManager,
  getHospitalProfile,
  updateHospitalProfile,
} = require("../controllers/hospitalController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Validation Rules
// ─────────────────────────────────────────────

const createHospitalValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Hospital name is required"),

  body("registrationNumber")
    .trim()
    .notEmpty()
    .withMessage("Registration number is required"),

  body("type")
    .isIn([
      "Government",
      "Private",
      "Semi-Government",
      "Trust",
      "Clinic",
    ])
    .withMessage("Invalid hospital type"),

  body("contact.phone")
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage("Invalid phone number"),

  body("contact.email")
    .isEmail()
    .withMessage("Invalid email address"),

  body("address.street")
    .trim()
    .notEmpty()
    .withMessage("Street is required"),

  body("address.city")
    .trim()
    .notEmpty()
    .withMessage("City is required"),

  body("address.state")
    .trim()
    .notEmpty()
    .withMessage("State is required"),

  body("address.zip")
    .trim()
    .notEmpty()
    .withMessage("ZIP code is required"),
];

const updateHospitalValidation = [
  body("contact.email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),

  body("contact.phone")
    .optional()
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage("Invalid phone number"),

  body("contact.emergencyLine")
    .optional()
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage("Invalid emergency line"),

  body("type")
    .optional()
    .isIn([
      "Government",
      "Private",
      "Semi-Government",
      "Trust",
      "Clinic",
    ])
    .withMessage("Invalid hospital type"),

  body("status")
    .optional()
    .isIn(["Active", "Inactive", "Suspended"])
    .withMessage("Invalid status"),

  body("specializations")
    .optional()
    .isArray()
    .withMessage("Specializations must be an array"),
];

// ─────────────────────────────────────────────
// Hospital Profile Routes
// ─────────────────────────────────────────────

// Logged-in hospital profile
router.get(
  "/profile",
  protect,
  authorizeRoles("hospital"),
  getHospitalProfile
);

router.patch(
  "/profile",
  protect,
  authorizeRoles("hospital"),
  updateHospitalValidation,
  updateHospitalProfile
);

// ─────────────────────────────────────────────
// Admin Routes
// ─────────────────────────────────────────────

// Create hospital
router.post(
  "/",
  protect,
  authorizeRoles("hospital"),
  createHospitalValidation,
  createHospital
);

// Get all hospitals
router.get(
  "/",
  protect,
  authorizeRoles("hospital"),
  getAllHospitals
);

// Get hospital by ID
router.get(
  "/:id",
  protect,
  authorizeRoles("hospital"),
  getHospitalById
);

// Update hospital
router.put(
  "/:id",
  protect,
  authorizeRoles("hospital"),
  updateHospitalValidation,
  updateHospital
);

// Delete hospital
router.delete(
  "/:id",
  protect,
  authorizeRoles("hospital"),
  deleteHospital
);

// Assign manager
router.patch(
  "/:id/assign-manager",
  protect,
  authorizeRoles("hospital"),
  assignManager
);

module.exports = router;