const express  = require("express");
const router   = express.Router();
const { body } = require("express-validator");

const {
  createAuditLogHandler,
  getAllAuditLogs,
  getAuditLogById,
  getLogsByUser,
  getLogsByEntity,
  getRecentActivity,
} = require("../controllers/auditLogController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
// ─────────────────────────────────────────────
// Validation Rules — Create
// ─────────────────────────────────────────────
const createAuditLogValidation = [
  body("action")
    .notEmpty().withMessage("Action is required")
    .isIn([
      "CREATE", "UPDATE", "DELETE", "ASSIGN",
      "LOGIN",  "LOGOUT", "STATUS_CHANGE",
      "EXPORT", "IMPORT", "AI_RECOMMENDATION",
      "AI_URGENCY_PREDICTION", "PASSWORD_CHANGE", "PERMISSION_CHANGE",
    ])
    .withMessage("Invalid action value"),

  body("entityType")
    .notEmpty().withMessage("Entity type is required")
    .isIn([
      "User", "Doctor", "Hospital",
      "EmergencyRequest", "Notification", "AuditLog", "System",
    ])
    .withMessage("Invalid entity type"),

  body("description")
    .trim()
    .notEmpty().withMessage("Description is required")
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  body("entityId")
    .optional()
    .isMongoId().withMessage("entityId must be a valid MongoDB ObjectId"),

  body("status")
    .optional()
    .isIn(["SUCCESS", "FAILURE", "WARNING"])
    .withMessage("Status must be SUCCESS, FAILURE, or WARNING"),

  body("riskLevel")
    .optional()
    .isIn(["Low", "Medium", "High", "Critical"])
    .withMessage("Risk level must be Low, Medium, High, or Critical"),
];

// ─────────────────────────────────────────────
// IMPORTANT: Specific string routes MUST come
// before /:id to avoid Express treating
// "recent", "user", "entity" as Mongo IDs
// ─────────────────────────────────────────────

// GET /api/audit-logs/recent
router.get(
  "/recent",
  protect,
  authorizeRoles("manager"),
  getRecentActivity
);

// GET /api/audit-logs/user/:userId
router.get(
  "/user/:userId",
  protect,
  authorizeRoles("manager", "doctor"),
  getLogsByUser
);

// GET /api/audit-logs/entity/:entityType/:entityId
router.get(
  "/entity/:entityType/:entityId",
  protect,
  authorizeRoles("manager"),
  getLogsByEntity
);

// POST /api/audit-logs        → Create  (Manager)
// GET  /api/audit-logs        → Get all (Manager)
router
  .route("/")
  .post(protect, authorizeRoles("manager"), createAuditLogValidation, createAuditLogHandler)
  .get( protect, authorizeRoles("manager"), getAllAuditLogs);

// GET /api/audit-logs/:id     → Get by ID (Manager)
router
  .route("/:id")
  .get(protect, authorizeRoles("manager"), getAuditLogById);

module.exports = router;