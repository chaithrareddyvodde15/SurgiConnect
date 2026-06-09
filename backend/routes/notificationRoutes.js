const express = require("express");
const router  = express.Router();
const { body } = require("express-validator");

const {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/notificationController");

const protect = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
// ─────────────────────────────────────────────
// Validation Rules
// ─────────────────────────────────────────────
const createNotificationValidation = [
  body("recipient")
    .notEmpty().withMessage("Recipient is required")
    .isMongoId().withMessage("Recipient must be a valid user ID"),

  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 150 }).withMessage("Title cannot exceed 150 characters"),

  body("message")
    .trim()
    .notEmpty().withMessage("Message is required")
    .isLength({ max: 1000 }).withMessage("Message cannot exceed 1000 characters"),

  body("type")
    .notEmpty().withMessage("Notification type is required")
    .isIn([
      "EmergencyCreated",
      "DoctorAssigned",
      "EmergencyUpdated",
      "EmergencyCompleted",
      "General",
      "AIDoctorRecommendation",
      "AIUrgencyAlert",
    ])
    .withMessage("Invalid notification type"),

  body("emergencyRequest")
    .optional()
    .isMongoId().withMessage("emergencyRequest must be a valid ID"),
];

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// GET  /api/notifications/unread-count
// Must be defined BEFORE /:id to avoid "unread-count" being treated as an ID
router.get(
  "/unread-count",
  protect,
  authorizeRoles("manager", "doctor"),
  getUnreadCount
);

// PATCH /api/notifications/read-all
// Must be defined BEFORE /:id for the same reason
router.patch(
  "/read-all",
  protect,
  authorizeRoles("manager", "doctor"),
  markAllAsRead
);

// POST  /api/notifications        → Create       (Manager)
// GET   /api/notifications        → Get own list (Manager, Doctor)
router
  .route("/")
  .post(protect, authorizeRoles("manager"), createNotificationValidation, createNotification)
  .get( protect, authorizeRoles("manager", "doctor"), getUserNotifications);

// GET    /api/notifications/:id   → Get by ID   (Manager, Doctor)
// DELETE /api/notifications/:id   → Soft delete (Manager, Doctor)
router
  .route("/:id")
  .get(   protect, authorizeRoles("manager", "doctor"), getNotificationById)
  .delete(protect, authorizeRoles("manager", "doctor"), deleteNotification);

// PATCH /api/notifications/:id/read  → Mark single as read (Manager, Doctor)
router.patch(
  "/:id/read",
  protect,
  authorizeRoles("manager", "doctor"),
  markAsRead
);

module.exports = router;