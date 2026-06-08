const express = require("express");
const router  = express.Router();
const { body } = require("express-validator");

const {
  createHospital,
  getAllHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  assignManager,
} = require("../controllers/hospitalController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
// ─────────────────────────────────────────────
// Validation rules
// ─────────────────────────────────────────────
const createHospitalValidation = [
  body("name").trim().notEmpty().withMessage("Hospital name is required"),

  body("registrationNumber")
    .trim()
    .notEmpty()
    .withMessage("Registration number is required"),

  body("type")
    .isIn(["Government", "Private", "Semi-Government", "Trust", "Clinic"])
    .withMessage("Invalid hospital type"),

  body("contact.phone")
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage("Invalid phone number"),

  body("contact.email")
    .isEmail()
    .withMessage("Invalid email address"),

  body("address.street").trim().notEmpty().withMessage("Street is required"),
  body("address.city").trim().notEmpty().withMessage("City is required"),
  body("address.state").trim().notEmpty().withMessage("State is required"),
  body("address.zip").trim().notEmpty().withMessage("ZIP code is required"),
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

  body("type")
    .optional()
    .isIn(["Government", "Private", "Semi-Government", "Trust", "Clinic"])
    .withMessage("Invalid hospital type"),

  body("status")
    .optional()
    .isIn(["Active", "Inactive", "Suspended"])
    .withMessage("Invalid status value"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// POST   /api/hospitals          → Create hospital (Admin only)
// GET    /api/hospitals          → Get all hospitals (Admin, Manager)
router
  .route("/")
  .post(protect, authorizeRoles("manager"), createHospitalValidation, createHospital)
  .get(protect, authorizeRoles("manager"), getAllHospitals);

router
  .route("/:id")
  .get(protect, authorizeRoles("manager"), getHospitalById)
  .put(protect, authorizeRoles("manager"), updateHospitalValidation, updateHospital)
  .delete(protect, authorizeRoles("manager"), deleteHospital);

router.patch(
  "/:id/assign-manager",
  protect,
  authorizeRoles("manager"),
  assignManager
);

module.exports = router;