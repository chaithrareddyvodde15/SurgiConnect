// ─────────────────────────────────────────────────────────────────────────────
// controllers/doctorAssignmentController.js
// (Socket.IO integration patch — only the notifyDoctor helper changes)
//
// WHAT CHANGED vs your original file:
//   1. Import sendNotificationToUser from socketManager
//   2. notifyDoctor() now also emits a real-time event after DB save
//   3. Everything else is 100% identical to your existing controller
//
// HOW TO APPLY:
//   Replace your existing controllers/doctorAssignmentController.js with
//   this file. No other controllers need to change.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const { validationResult } = require("express-validator");

const EmergencyRequest   = require("../models/EmergencyRequest");
const Doctor             = require("../models/doctorModel");
const Notification       = require("../models/Notification");
const { createAuditLog } = require("./auditLogController");

// ── Socket helper ──────────────────────────────────────────────────────────
const { sendNotificationToUser } = require("../socket/socketManager"); // ← NEW

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TERMINAL_STATUSES = ["Completed", "Cancelled"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getValidationErrors = (req) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return result.array().map((e) => ({ field: e.path, message: e.msg }));
  }
  return null;
};

const isValidObjectId = (id, res, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, message: `Invalid ${label}` });
    return false;
  }
  return true;
};

const populateRequest = (query) =>
  query
    .populate("hospital", "name address contact")
    .populate("requestedBy", "name email role")
    .populate("assignedDoctors.doctor", "name email specialization")
    .populate("assignedDoctors.assignedBy", "name email");

/**
 * Create an in-app notification AND emit a real-time Socket.IO event.
 *
 * Flow:
 *   1. Save Notification to MongoDB (existing behaviour — unchanged)
 *   2. Attempt real-time delivery via Socket.IO (NEW)
 *      - If the doctor is offline, the DB record still exists for polling
 *      - Socket failure never throws — notification is still persisted
 *
 * @param {object} opts
 * @param {string} opts.recipient        - userId of the doctor
 * @param {string} opts.emergencyRequest - emergencyRequest ObjectId
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} opts.type             - Notification.type enum value
 * @param {string} opts.createdBy        - userId of the manager
 * @param {string} [opts.socketEvent]    - override the emitted event name
 */
const notifyDoctor = async ({
  recipient,
  emergencyRequest,
  title,
  message,
  type,
  createdBy,
  socketEvent = "notification:new",  // ← default real-time event name
}) => {
  try {
    // Step 1 — Persist to MongoDB (unchanged from original)
    const notification = await Notification.create({
      recipient,
      emergencyRequest,
      title,
      message,
      type,
      createdBy,
    });

    // Step 2 — Real-time delivery via Socket.IO (NEW)
    // sendNotificationToUser is a no-op when the user is offline or io is null
    sendNotificationToUser(recipient.toString(), socketEvent, {
      _id:              notification._id,
      title,
      message,
      type,
      emergencyRequest,
      isRead:           false,
      createdAt:        notification.createdAt,
    });

  } catch (error) {
    // Intentionally swallowed — notification failure must never break the
    // doctor assignment flow (same pattern as original).
    console.error("notifyDoctor error:", error.message);
  }
};

const validateDoctorUserIds = async (userIds) => {
  const doctorProfiles = await Doctor.find({
    userId: { $in: userIds },
  })
    .select("userId verified availability")
    .lean();

  const validIds = new Set(doctorProfiles.map((d) => d.userId.toString()));
  const invalidIds = userIds.filter((id) => !validIds.has(id));

  return { doctorProfiles, validIds, invalidIds };
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Assign one or more doctors to an emergency request
// @route   POST /api/assignments/:requestId/assign
// @access  Manager
// ─────────────────────────────────────────────────────────────────────────────
const assignDoctorsToRequest = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const { requestId } = req.params;
    const { doctors, note } = req.body;

    if (!isValidObjectId(requestId, res, "emergency request ID")) return;

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "doctors array is required and must contain at least one entry",
      });
    }

    for (const entry of doctors) {
      if (!entry.doctorId || !mongoose.Types.ObjectId.isValid(entry.doctorId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid or missing doctorId: ${entry.doctorId}`,
        });
      }
    }

    const request = await EmergencyRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    if (TERMINAL_STATUSES.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign doctors to a ${request.status} request`,
      });
    }

    const requestedIds = doctors.map((d) => d.doctorId.toString());
    const { invalidIds } = await validateDoctorUserIds(requestedIds);

    if (invalidIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: "One or more doctorIds do not correspond to a registered doctor",
        invalidDoctorIds: invalidIds,
      });
    }

    const alreadyAssignedIds = request.assignedDoctors.map((d) => d.doctor.toString());
    const duplicates = requestedIds.filter((id) => alreadyAssignedIds.includes(id));
    const newEntries = doctors.filter((d) => !alreadyAssignedIds.includes(d.doctorId.toString()));

    if (newEntries.length === 0) {
      return res.status(409).json({
        success: false,
        message: "All provided doctors are already assigned to this request",
        duplicateDoctorIds: duplicates,
      });
    }

    const newAssignments = newEntries.map((entry) => ({
      doctor:     entry.doctorId,
      role:       entry.role || "",
      assignedBy: req.user._id,
      assignedAt: new Date(),
    }));

    request.assignedDoctors.push(...newAssignments);

    const previousStatus = request.status;
    if (request.status === "Pending") {
      request.status = "Assigned";
    }

    request.timeline.push({
      status:    request.status,
      changedBy: req.user._id,
      note:
        note ||
        `${newAssignments.length} doctor(s) assigned: ${newEntries
          .map((d) => d.role || "Doctor")
          .join(", ")}`,
      changedAt: new Date(),
    });

    await request.save();

    // Notify each newly-assigned doctor (DB + real-time via Socket.IO)
    await Promise.all(
      newEntries.map((entry) =>
        notifyDoctor({
          recipient:        entry.doctorId,
          emergencyRequest: request._id,
          title:            "New Emergency Assignment",
          message:          `You have been assigned to a ${request.severity} severity ${request.emergencyType} case${
            entry.role ? ` as ${entry.role}` : ""
          }.`,
          type:             "DoctorAssigned",
          createdBy:        req.user._id,
          socketEvent:      "notification:new",  // doctors listen for this
        })
      )
    );

    await createAuditLog({
      user:        req.user._id,
      action:      "ASSIGN",
      entityType:  "EmergencyRequest",
      entityId:    request._id,
      description: `${newAssignments.length} doctor(s) assigned to emergency request`,
      metadata:    {
        assignedDoctorIds: newEntries.map((d) => d.doctorId),
        previousStatus,
        newStatus:         request.status,
        duplicatesSkipped: duplicates,
      },
      changeDiff: {
        before: { status: previousStatus },
        after:  { status: request.status },
      },
      status:    "SUCCESS",
      riskLevel: "Low",
      req,
    });

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: `${newAssignments.length} doctor(s) assigned successfully`,
      data:    populated,
      skipped:
        duplicates.length > 0
          ? { reason: "already assigned", doctorIds: duplicates }
          : undefined,
    });
  } catch (error) {
    console.error("assignDoctorsToRequest error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Unassign a doctor from an emergency request
// @route   DELETE /api/assignments/:requestId/doctors/:doctorId
// @access  Manager
// ─────────────────────────────────────────────────────────────────────────────
const unassignDoctor = async (req, res) => {
  try {
    const { requestId, doctorId } = req.params;
    const { note } = req.body;

    if (!isValidObjectId(requestId, res, "emergency request ID")) return;
    if (!isValidObjectId(doctorId,  res, "doctor ID"))            return;

    const request = await EmergencyRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    if (TERMINAL_STATUSES.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify assignments on a ${request.status} request`,
      });
    }

    const existingEntry = request.assignedDoctors.find(
      (d) => d.doctor.toString() === doctorId
    );

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: "This doctor is not assigned to the specified request",
      });
    }

    request.assignedDoctors = request.assignedDoctors.filter(
      (d) => d.doctor.toString() !== doctorId
    );

    const previousStatus = request.status;
    if (request.assignedDoctors.length === 0 && request.status === "Assigned") {
      request.status = "Pending";
    }

    request.timeline.push({
      status:    request.status,
      changedBy: req.user._id,
      note:      note || "Doctor unassigned from request",
      changedAt: new Date(),
    });

    await request.save();

    // Notify the unassigned doctor (DB + real-time via Socket.IO)
    await notifyDoctor({
      recipient:        doctorId,
      emergencyRequest: request._id,
      title:            "Emergency Assignment Removed",
      message:          `You have been unassigned from a ${request.emergencyType} case.`,
      type:             "EmergencyUpdated",
      createdBy:        req.user._id,
      socketEvent:      "notification:unassigned",  // separate event so clients can handle differently
    });

    await createAuditLog({
      user:        req.user._id,
      action:      "ASSIGN",
      entityType:  "EmergencyRequest",
      entityId:    request._id,
      description: "Doctor unassigned from emergency request",
      metadata:    { unassignedDoctorId: doctorId, previousStatus, newStatus: request.status },
      changeDiff: {
        before: { status: previousStatus },
        after:  { status: request.status },
      },
      status:    "SUCCESS",
      riskLevel: "Low",
      req,
    });

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Doctor unassigned successfully",
      data:    populated,
    });
  } catch (error) {
    console.error("unassignDoctor error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all doctors assigned to a given emergency request
// @route   GET /api/assignments/:requestId/doctors
// @access  Manager, Doctor (must be assigned)
// ─────────────────────────────────────────────────────────────────────────────
const getAssignedDoctors = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!isValidObjectId(requestId, res, "emergency request ID")) return;

    const request = await populateRequest(
      EmergencyRequest.findById(requestId).select(
        "assignedDoctors status emergencyType severity"
      )
    );

    if (!request) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    if (req.user.role === "doctor") {
      const isAssigned = request.assignedDoctors.some(
        (entry) => entry.doctor._id.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied — you are not assigned to this request",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Assigned doctors fetched successfully",
      data:    {
        requestId:       request._id,
        status:          request.status,
        assignedDoctors: request.assignedDoctors,
      },
      count: request.assignedDoctors.length,
    });
  } catch (error) {
    console.error("getAssignedDoctors error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all emergency requests assigned to a given doctor (paginated)
// @route   GET /api/assignments/doctor/:doctorId
// @access  Manager (any doctor), Doctor (own only)
// ─────────────────────────────────────────────────────────────────────────────
const getEmergenciesForDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!isValidObjectId(doctorId, res, "doctor ID")) return;

    if (req.user.role === "doctor" && req.user._id.toString() !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you can only view your own assignments",
      });
    }

    const {
      page   = 1,
      limit  = 10,
      status,
      sortBy = "createdAt",
      order  = "desc",
    } = req.query;

    const filter = { "assignedDoctors.doctor": doctorId };
    if (status) filter.status = status;

    const skip       = (Number(page) - 1) * Number(limit);
    const sortOrder  = order === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "severity", "status", "updatedAt"];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const [requests, total] = await Promise.all([
      populateRequest(
        EmergencyRequest.find(filter)
          .sort({ [safeSortBy]: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      EmergencyRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Emergency requests for doctor fetched successfully",
      data:    requests,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getEmergenciesForDoctor error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  assignDoctorsToRequest,
  unassignDoctor,
  getAssignedDoctors,
  getEmergenciesForDoctor,
};