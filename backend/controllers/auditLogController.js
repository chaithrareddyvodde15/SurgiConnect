const AuditLog = require("../models/AuditLog");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const ALLOWED_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "LOGIN",
  "LOGOUT",
  "STATUS_CHANGE",
  "EXPORT",
  "IMPORT",
  "AI_RECOMMENDATION",
  "AI_URGENCY_PREDICTION",
  "PASSWORD_CHANGE",
  "PERMISSION_CHANGE",
];

const ALLOWED_ENTITY_TYPES = [
  "User",
  "Doctor",
  "Hospital",
  "EmergencyRequest",
  "Notification",
  "AuditLog",
  "System",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Return formatted validation errors or null */
const getValidationErrors = (req) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return result.array().map((e) => ({ field: e.path, message: e.msg }));
  }
  return null;
};

/** Validate ObjectId and send 400 if invalid */
const isValidObjectId = (id, res, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({
      success: false,
      message: `Invalid ${label} format`,
    });
    return false;
  }
  return true;
};

/** Standard populate chain */
const populateLog = (query) =>
  query.populate("user", "name email role");

/**
 * Build a consistent date range filter from query params.
 * Accepts: ?startDate=2024-01-01&endDate=2024-12-31
 */
const buildDateFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // include full end day
      filter.createdAt.$lte = end;
    }
  }
  return filter;
};

// ─────────────────────────────────────────────
// Exported Helper — createAuditLog()
// Used internally by other controllers
// e.g. await createAuditLog({ user, action, ... })
// ─────────────────────────────────────────────
const createAuditLog = async ({
  user       = null,
  action,
  entityType,
  entityId   = null,
  description,
  metadata   = {},
  changeDiff = {},
  status     = "SUCCESS",
  riskLevel  = "Low",
  req        = null,   // pass Express req for IP/userAgent capture
}) => {
  try {
    const requestContext = {};

    if (req) {
      requestContext.ipAddress =
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "";
      requestContext.userAgent = req.headers["user-agent"] || "";
      requestContext.method    = req.method || "";
      requestContext.endpoint  = req.originalUrl || "";
    }

    const log = await AuditLog.create({
      user,
      action,
      entityType,
      entityId,
      description,
      metadata,
      changeDiff,
      requestContext,
      status,
      riskLevel,
    });

    return log;
  } catch (error) {
    // Never throw — audit failure must not break the main flow
    console.error("createAuditLog internal error:", error.message);
    return null;
  }
};

// ─────────────────────────────────────────────
// @desc    Create audit log via REST API
// @route   POST /api/audit-logs
// @access  Manager
// ─────────────────────────────────────────────
const createAuditLogHandler = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const {
      entityId,
      description,
      metadata,
      changeDiff,
      status,
      riskLevel,
      action,
      entityType,
    } = req.body;

    const log = await createAuditLog({
      user:       req.user._id,
      action,
      entityType,
      entityId:   entityId   || null,
      description,
      metadata:   metadata   || {},
      changeDiff: changeDiff || {},
      status:     status     || "SUCCESS",
      riskLevel:  riskLevel  || "Low",
      req,
    });

    if (!log) {
      return res.status(500).json({
        success: false,
        message: "Failed to create audit log",
      });
    }

    const populated = await populateLog(AuditLog.findById(log._id));

    return res.status(201).json({
      success: true,
      message: "Audit log created successfully",
      data:    populated,
    });
  } catch (error) {
    console.error("createAuditLogHandler error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all audit logs (filtered + paginated)
// @route   GET /api/audit-logs
// @access  Manager
// ─────────────────────────────────────────────
const getAllAuditLogs = async (req, res) => {
  try {
    const {
      page       = 1,
      limit      = 10,
      action,
      entityType,
      status,
      riskLevel,
      startDate,
      endDate,
      sortBy     = "createdAt",
      order      = "desc",
    } = req.query;

    const filter = {};

    if (action     && ALLOWED_ACTIONS.includes(action))           filter.action     = action;
    if (entityType && ALLOWED_ENTITY_TYPES.includes(entityType))  filter.entityType = entityType;
    if (status     && ["SUCCESS","FAILURE","WARNING"].includes(status)) filter.status = status;
    if (riskLevel  && ["Low","Medium","High","Critical"].includes(riskLevel)) filter.riskLevel = riskLevel;

    const dateFilter = buildDateFilter(startDate, endDate);
    Object.assign(filter, dateFilter);

    const skip      = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const allowedSortFields = [
      "createdAt", "action", "entityType", "status", "riskLevel",
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const [logs, total] = await Promise.all([
      populateLog(
        AuditLog.find(filter)
          .sort({ [safeSortBy]: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Audit logs fetched successfully",
      data:    logs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getAllAuditLogs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get audit log by ID
// @route   GET /api/audit-logs/:id
// @access  Manager
// ─────────────────────────────────────────────
const getAuditLogById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id, res, "audit log ID")) return;

    const log = await populateLog(AuditLog.findById(req.params.id));

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Audit log fetched successfully",
      data:    log,
    });
  } catch (error) {
    console.error("getAuditLogById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all logs for a specific user
// @route   GET /api/audit-logs/user/:userId
// @access  Manager (any user), Doctor (own only)
// ─────────────────────────────────────────────
const getLogsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId, res, "user ID")) return;

    // Doctors can only view their own audit logs
    if (
      req.user.role === "doctor" &&
      req.user._id.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you can only view your own audit logs",
      });
    }

    const {
      page      = 1,
      limit     = 10,
      action,
      startDate,
      endDate,
      order     = "desc",
    } = req.query;

    const filter = { user: userId };

    if (action && ALLOWED_ACTIONS.includes(action)) filter.action = action;

    const dateFilter = buildDateFilter(startDate, endDate);
    Object.assign(filter, dateFilter);

    const skip      = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [logs, total] = await Promise.all([
      populateLog(
        AuditLog.find(filter)
          .sort({ createdAt: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: `Audit logs for user fetched successfully`,
      data:    logs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getLogsByUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get logs by entity type and entity ID
// @route   GET /api/audit-logs/entity/:entityType/:entityId
// @access  Manager
// ─────────────────────────────────────────────
const getLogsByEntity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!ALLOWED_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid entityType. Must be one of: ${ALLOWED_ENTITY_TYPES.join(", ")}`,
      });
    }

    if (!isValidObjectId(entityId, res, "entity ID")) return;

    const {
      page  = 1,
      limit = 10,
      order = "desc",
    } = req.query;

    const filter    = { entityType, entityId };
    const skip      = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [logs, total] = await Promise.all([
      populateLog(
        AuditLog.find(filter)
          .sort({ createdAt: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: `Audit logs for ${entityType} fetched successfully`,
      data:    logs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getLogsByEntity error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get recent activity across the system
// @route   GET /api/audit-logs/recent
// @access  Manager
// ─────────────────────────────────────────────
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Cap at 100 to prevent over-fetching
    const safeLimit = Math.min(Number(limit), 100);

    const logs = await populateLog(
      AuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(safeLimit)
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Recent activity fetched successfully",
      data:    logs,
      count:   logs.length,
    });
  } catch (error) {
    console.error("getRecentActivity error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

module.exports = {
  // REST handlers
  createAuditLogHandler,
  getAllAuditLogs,
  getAuditLogById,
  getLogsByUser,
  getLogsByEntity,
  getRecentActivity,

  // Internal helper — import this in other controllers
  createAuditLog,
};