"use strict";

const express  = require("express");
const router   = express.Router();
const { body } = require("express-validator");

const {
  generateRecommendation,
  getRecommendation,
  refreshRecommendation,
  getMatchingDoctors,
  previewRecommendation,
} = require("../controllers/aiRecommendationController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// ─────────────────────────────────────────────
// Validation — Generate
// ─────────────────────────────────────────────
const generateValidation = [
  body("emergencyRequestId")
    .notEmpty().withMessage("emergencyRequestId is required")
    .isMongoId().withMessage("emergencyRequestId must be a valid MongoDB ID"),
];

// ─────────────────────────────────────────────
// Validation — Preview
// ─────────────────────────────────────────────
const previewValidation = [
  body("emergencyType")
    .trim()
    .notEmpty().withMessage("emergencyType is required"),

  body("symptoms")
    .optional()
    .isArray().withMessage("symptoms must be an array"),

  body("severity")
    .optional()
    .isIn(["Low", "Medium", "High", "Critical"])
    .withMessage("severity must be Low, Medium, High, or Critical"),
];

// ─────────────────────────────────────────────
// IMPORTANT: Static string routes BEFORE /:param
// routes to prevent Express CastError on strings
// ─────────────────────────────────────────────

// POST /api/ai-recommendations/recommend
// Generate and save recommendations for an emergency request
router.post(
  "/recommend",
  protect,
  authorizeRoles("hospital"),
  generateValidation,
  generateRecommendation
);

// POST /api/ai-recommendations/preview
// Preview recommendations without saving (no DB write)
router.post(
  "/preview",
  protect,
  authorizeRoles("hospital"),
  previewValidation,
  previewRecommendation
);

// PATCH /api/ai-recommendations/refresh/:emergencyRequestId
// Refresh (regenerate and overwrite) existing recommendation
router.patch(
  "/refresh/:emergencyRequestId",
  protect,
  authorizeRoles("hospital"),
  refreshRecommendation
);

// GET /api/ai-recommendations/doctors/:emergencyRequestId
// Get paginated matching available doctors
router.get(
  "/doctors/:emergencyRequestId",
  protect,
 authorizeRoles("hospital", "doctor"),
  getMatchingDoctors
);

// GET /api/ai-recommendations/:emergencyRequestId
// Get stored recommendation — MUST be last to avoid swallowing above routes
router.get(
  "/:emergencyRequestId",
  protect,
  authorizeRoles("hospital", "doctor"),
  getRecommendation
);

module.exports = router;