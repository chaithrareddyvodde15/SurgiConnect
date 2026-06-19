// ─────────────────────────────────────────────────────────────────────────────
// routes/dashboardRoutes.js
// Dashboard & Analytics — Manager Only
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const { query, validationResult } = require("express-validator");

const authMiddleware  = require("../middlewares/authMiddleware");
const authorizeRoles  = require("../middlewares/roleMiddleware");

const {
  getDashboardStats,
  getRecentActivity,
  getEmergencyTrends,
  getHospitalStats,
  getDoctorStats,
} = require("../controllers/dashboardController");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: all dashboard routes require auth + manager role
// ─────────────────────────────────────────────────────────────────────────────
router.use(authMiddleware);
router.use(authorizeRoles("manager"));

// ─────────────────────────────────────────────────────────────────────────────
// Reusable validation middleware runner
// ─────────────────────────────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors:  errors.array(),
    });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────────────────────
const paginationValidators = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be between 1 and 50")
    .toInt(),
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/stats
 * Full dashboard statistics — hospitals, doctors, emergencies,
 * severity, AI, notifications, audit logs
 */
router.get("/stats", getDashboardStats);

/**
 * GET /api/dashboard/recent-activity
 * Latest emergency requests, notifications, and audit logs
 * ?limit=10  (max 50)
 */
router.get(
  "/recent-activity",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("limit must be between 1 and 50")
      .toInt(),
  ],
  validate,
  getRecentActivity
);

/**
 * GET /api/dashboard/emergency-trends
 * Daily emergency counts for the last N days
 * ?days=7   (max 90)
 */
router.get(
  "/emergency-trends",
  [
    query("days")
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage("days must be between 1 and 90")
      .toInt(),
  ],
  validate,
  getEmergencyTrends
);

/**
 * GET /api/dashboard/hospital-stats
 * Per-hospital emergency breakdown (paginated)
 * ?page=1&limit=10
 */
router.get(
  "/hospital-stats",
  paginationValidators,
  validate,
  getHospitalStats
);

/**
 * GET /api/dashboard/doctor-stats
 * Doctor availability & assignment overview (paginated)
 * ?page=1&limit=10
 */
router.get(
  "/doctor-stats",
  paginationValidators,
  validate,
  getDoctorStats
);

module.exports = router;