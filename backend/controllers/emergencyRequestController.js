const EmergencyRequest = require("../models/EmergencyRequest");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Return formatted validation errors or null if none */
const getValidationErrors = (req) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return result.array().map((e) => ({ field: e.path, message: e.msg }));
  }
  return null;
};

/** Standard populate chain reused across queries */
const populateRequest = (query) =>
  query
    .populate("hospital",        "name address contact")
    .populate("requestedBy",     "name email role")
    .populate("assignedDoctors.doctor",  "name email specialization")
    .populate("assignedDoctors.assignedBy", "name email");

// ─────────────────────────────────────────────
// @desc    Create a new emergency request
// @route   POST /api/emergency-requests
// @access  Manager
// ─────────────────────────────────────────────
const createEmergencyRequest = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const {
      patientName,
      patientAge,
      gender,
      emergencyType,
      symptoms,
      severity,
      hospital,
      notes,
    } = req.body;

    const request = await EmergencyRequest.create({
      patientName,
      patientAge,
      gender,
      emergencyType,
      symptoms,
      severity,
      hospital,
      notes,
      requestedBy: req.user._id,
      status: "Pending",
      timeline: [
        {
          status:    "Pending",
          changedBy: req.user._id,
          note:      "Emergency request created",
          changedAt: new Date(),
        },
      ],
    });

    const populated = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    return res.status(201).json({
      success: true,
      message: "Emergency request created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("createEmergencyRequest error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all emergency requests (filtered + paginated)
// @route   GET /api/emergency-requests
// @access  Admin, Manager
// ─────────────────────────────────────────────
const getAllEmergencyRequests = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      status,
      severity,
      hospital,
      sortBy   = "createdAt",
      order    = "desc",
    } = req.query;

    const filter = {};

    if (status)   filter.status   = status;
    if (severity) filter.severity = severity;
    if (hospital) {
      if (!mongoose.Types.ObjectId.isValid(hospital)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid hospital ID" });
      }
      filter.hospital = hospital;
    }

    // Managers see only their own hospital's requests
    if (req.user.role === "manager" && req.user.hospital) {
      filter.hospital = req.user.hospital;
    }

    const skip      = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [requests, total] = await Promise.all([
      populateRequest(
        EmergencyRequest.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(Number(limit))
      ).lean(),
      EmergencyRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Emergency requests fetched successfully",
      data: requests,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getAllEmergencyRequests error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get single emergency request by ID
// @route   GET /api/emergency-requests/:id
// @access  Admin, Manager, Doctor
// ─────────────────────────────────────────────
const getEmergencyRequestById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await populateRequest(
      EmergencyRequest.findById(req.params.id)
    );

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    // Doctors can only view requests they are assigned to
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
      message: "Emergency request fetched successfully",
      data: request,
    });
  } catch (error) {
    console.error("getEmergencyRequestById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Update emergency request details
// @route   PUT /api/emergency-requests/:id
// @access  Manager
// ─────────────────────────────────────────────
const updateEmergencyRequest = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    // Block edits on terminal states
    const existing = await EmergencyRequest.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    if (["Completed", "Cancelled"].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a request that is already ${existing.status}`,
      });
    }

    // Strip fields that have dedicated endpoints
    const {
      status,
      assignedDoctors,
      timeline,
      aiRecommendation,
      requestedBy,
      ...safeUpdate
    } = req.body;

    const updated = await populateRequest(
      EmergencyRequest.findByIdAndUpdate(
        req.params.id,
        { $set: safeUpdate },
        { new: true, runValidators: true }
      )
    );

    return res.status(200).json({
      success: true,
      message: "Emergency request updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateEmergencyRequest error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Assign doctors to an emergency request
// @route   PATCH /api/emergency-requests/:id/assign-doctors
// @access  Manager
// ─────────────────────────────────────────────
const assignDoctors = async (req, res) => {
  try {
    const { doctors } = req.body;
    // doctors: [{ doctorId: "...", role: "Lead Surgeon" }, ...]

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "doctors array is required and must not be empty",
      });
    }

    // Validate each doctor ID
    for (const entry of doctors) {
      if (!mongoose.Types.ObjectId.isValid(entry.doctorId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid doctor ID: ${entry.doctorId}`,
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await EmergencyRequest.findById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    if (["Completed", "Cancelled"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign doctors to a ${request.status} request`,
      });
    }

    // Build assignment entries, skip already-assigned doctors
    const existingIds = request.assignedDoctors.map((d) =>
      d.doctor.toString()
    );

    const newAssignments = doctors
      .filter((entry) => !existingIds.includes(entry.doctorId))
      .map((entry) => ({
        doctor:     entry.doctorId,
        role:       entry.role || "",
        assignedBy: req.user._id,
        assignedAt: new Date(),
      }));

    if (newAssignments.length === 0) {
      return res.status(409).json({
        success: false,
        message: "All provided doctors are already assigned to this request",
      });
    }

    // Push new assignments and update status to Assigned
    request.assignedDoctors.push(...newAssignments);

    if (request.status === "Pending") {
      request.status = "Assigned";
      request.timeline.push({
        status:    "Assigned",
        changedBy: req.user._id,
        note:      `${newAssignments.length} doctor(s) assigned`,
        changedAt: new Date(),
      });
    }

    await request.save();

    const populated = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    return res.status(200).json({
      success: true,
      message: `${newAssignments.length} doctor(s) assigned successfully`,
      data: populated,
    });
  } catch (error) {
    console.error("assignDoctors error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Update the status of an emergency request
// @route   PATCH /api/emergency-requests/:id/status
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const updateEmergencyStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const allowedStatuses = [
      "Pending",
      "Assigned",
      "In Progress",
      "Completed",
      "Cancelled",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await EmergencyRequest.findById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    // Block re-opening terminal states
    if (["Completed", "Cancelled"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status} and cannot be changed`,
      });
    }

    // Doctors can only move status to In Progress or Completed
    if (req.user.role === "doctor") {
      const isAssigned = request.assignedDoctors.some(
        (d) => d.doctor.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied — you are not assigned to this request",
        });
      }
      if (!["In Progress", "Completed"].includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Doctors can only set status to In Progress or Completed",
        });
      }
    }

    request.status = status;
    request.timeline.push({
      status,
      changedBy: req.user._id,
      note:      note || "",
      changedAt: new Date(),
    });

    await request.save(); // pre-save hook handles resolvedAt

    const populated = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    return res.status(200).json({
      success: true,
      message: `Emergency request status updated to "${status}"`,
      data: populated,
    });
  } catch (error) {
    console.error("updateEmergencyStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  assignDoctors,
  updateEmergencyStatus,
};