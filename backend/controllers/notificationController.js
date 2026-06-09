const Notification = require("../models/Notification");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Format express-validator errors */
const getValidationErrors = (req) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return result.array().map((e) => ({ field: e.path, message: e.msg }));
  }
  return null;
};

/** Reusable populate chain */
const populateNotification = (query) =>
  query
    .populate("recipient",        "name email role")
    .populate("createdBy",        "name email role")
    .populate("emergencyRequest", "patientName emergencyType severity status");

/** Validate MongoDB ObjectId and send 400 if invalid */
const isValidObjectId = (id, res, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, message: `Invalid ${label}` });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────
// @desc    Create a notification
// @route   POST /api/notifications
// @access  Manager
// ─────────────────────────────────────────────
const createNotification = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    const {
      recipient,
      emergencyRequest,
      title,
      message,
      type,
    } = req.body;

    const notification = await Notification.create({
      recipient,
      emergencyRequest: emergencyRequest || null,
      title,
      message,
      type,
      createdBy: req.user._id,
    });

    const populated = await populateNotification(
      Notification.findById(notification._id)
    );

    // ── Socket.IO hook (future) ───────────────
    // const io = req.app.get("io");
    // if (io) {
    //   io.to(recipient.toString()).emit("notification:new", populated);
    // }

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data:    populated,
    });
  } catch (error) {
    console.error("createNotification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const getUserNotifications = async (req, res) => {
  try {
    const {
      page   = 1,
      limit  = 10,
      isRead,
      type,
      sortBy = "createdAt",
      order  = "desc",
    } = req.query;
    
    const filter = { recipient: req.user._id };

    // isRead filter: accept "true" / "false" as strings from query
    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    if (type) filter.type = type;

    const skip      = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [notifications, total] = await Promise.all([
      populateNotification(
        Notification.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data:    notifications,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getUserNotifications error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get notification by ID
// @route   GET /api/notifications/:id
// @access  Manager, Doctor (own only)
// ─────────────────────────────────────────────
const getNotificationById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id, res, "notification ID")) return;

    const notification = await populateNotification(
      Notification.findById(req.params.id)
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    // Users can only read their own notifications
    if (notification.recipient._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    return res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data:    notification,
    });
  } catch (error) {
    console.error("getNotificationById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Manager, Doctor (own only)
// ─────────────────────────────────────────────
const markAsRead = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id, res, "notification ID")) return;

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    if (notification.isRead) {
      return res.status(200).json({
        success: true,
        message: "Notification was already marked as read",
        data:    notification,
      });
    }

    notification.isRead = true;  // pre-save hook sets readAt automatically
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data:    notification,
    });
  } catch (error) {
    console.error("markAsRead error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Mark ALL notifications as read for user
// @route   PATCH /api/notifications/read-all
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const markAllAsRead = async (req, res) => {
  try {
    const now = new Date();

    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false, isDeleted: false },
      { $set: { isRead: true, readAt: now } }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
      data:    { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("markAllAsRead error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Delete (soft) a notification
// @route   DELETE /api/notifications/:id
// @access  Manager (any), Doctor (own only)
// ─────────────────────────────────────────────
const deleteNotification = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id, res, "notification ID")) return;

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    // Doctors can only delete their own notifications
    if (
      req.user.role === "doctor" &&
      notification.recipient.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    // Soft delete — pre-save hook sets deletedAt automatically
    notification.isDeleted = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data:    { id: notification._id, isDeleted: true },
    });
  } catch (error) {
    console.error("deleteNotification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get unread notification count for user
// @route   GET /api/notifications/unread-count
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead:    false,
      isDeleted: false,
    });

    return res.status(200).json({
      success: true,
      message: "Unread notification count fetched successfully",
      data:    { unreadCount: count },
    });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
};