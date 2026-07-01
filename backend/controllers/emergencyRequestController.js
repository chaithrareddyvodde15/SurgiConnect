"use strict";

const mongoose            = require("mongoose");
const { validationResult } = require("express-validator");

const Hospital = require("../models/Hospital");
const EmergencyRequest   = require("../models/EmergencyRequest");
const Notification       = require("../models/Notification");
const Doctor             = require("../models/doctorModel");

const { createAuditLog }         = require("./auditLogController");
const { sendNotificationToUser } = require("../socket/socketManager");

// ─────────────────────────────────────────────
// Shared Helpers
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
    .populate("hospital",                    "name address contact")
    .populate("requestedBy",                 "name email role")
    .populate("assignedDoctors.doctor",      "name email")
    .populate("assignedDoctors.assignedBy",  "name email")
    .populate("doctorResponses.doctor",      "name email")
    .populate("confirmedDoctor",             "name email");

/**
 * Persist a Notification to DB and emit a real-time Socket.IO event.
 *
 * Never throws — failures are logged but never break the calling flow.
 * This mirrors the pattern used in doctorAssignmentController.js.
 *
 * @param {object} opts
 * @param {string|ObjectId} opts.recipient        - User._id
 * @param {string|ObjectId} [opts.emergencyRequest]
 * @param {string}          opts.title
 * @param {string}          opts.message
 * @param {string}          opts.type             - Notification type enum
 * @param {string|ObjectId} [opts.createdBy]
 * @param {string}          [opts.socketEvent]    - defaults to "notification:new"
 */
const notifyUser = async ({
  recipient,
  emergencyRequest = null,
  title,
  message,
  type,
  createdBy = null,
  socketEvent = "notification:new",
}) => {
  try {
    const notification = await Notification.create({
      recipient,
      emergencyRequest,
      title,
      message,
      type,
      createdBy,
    });

    // Real-time delivery — silent no-op when user is offline
    sendNotificationToUser(recipient.toString(), socketEvent, {
      _id:              notification._id,
      title,
      message,
      type,
      emergencyRequest,
      isRead:           false,
      createdAt:        notification.createdAt,
    });
  } catch (err) {
    console.error("notifyUser error:", err.message);
  }
};

// ─────────────────────────────────────────────
// @desc    Create a new emergency request
//          AND broadcast to specialization-matched doctors
// @route   POST /api/emergency-requests
// @access  Manager
// ─────────────────────────────────────────────
const createEmergencyRequest = async (req, res) => {
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
      patientName,
      patientAge,
      gender,
      emergencyType,
      symptoms,
      severity,
      hospital,
      notes,
      requiredSpecialization,
    } = req.body;

    // Verify hospital exists
    const hospitalExists = await Hospital.findById(hospital);

    if (!hospitalExists) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    // Create emergency request
    const request = await EmergencyRequest.create({
      patientName,
      patientAge,
      gender,
      emergencyType,
      symptoms,
      severity,
      hospital,
      notes,
      requiredSpecialization,
      requestedBy: req.user._id,
      status: "Pending",
      timeline: [
        {
          status: "Pending",
          changedBy: req.user._id,
          note: "Emergency request created by hospital",
          changedAt: new Date(),
        },
      ],
    });

    // Audit Log
    await createAuditLog({
      user: req.user._id,
      action: "CREATE",
      entityType: "EmergencyRequest",
      entityId: request._id,
      description: `Emergency request created - ${emergencyType}`,
      metadata: {
        severity,
        emergencyType,
        requiredSpecialization,
        hospitalId: hospital,
      },
      status: "SUCCESS",
      riskLevel:
        severity === "Critical"
          ? "Critical"
          : severity === "High"
          ? "High"
          : "Medium",
      req,
    });

    // Find matching doctors
    const matchedDoctors = await Doctor.find({
      specialization: requiredSpecialization,
      verified: true,
      availability: {
        $in: ["Available", "On-Call"],
      },
    }).select("userId specialization availability");

    // Send notification to doctors
    if (matchedDoctors.length > 0) {
      const title = `🚨 Emergency: ${emergencyType}`;

      const message =
        `A ${severity} severity emergency requires a ${requiredSpecialization} specialist.\n` +
        `Patient: ${patientName}, ${patientAge} years old.\n` +
        `Please respond immediately.`;

      await Promise.all(
        matchedDoctors.map((doctor) =>
          notifyUser({
            recipient: doctor.userId,
            emergencyRequest: request._id,
            title,
            message,
            type: "EmergencyBroadcast",
            createdBy: req.user._id,
            socketEvent: "emergency:new",
          })
        )
      );

      console.log(
        `Emergency broadcast sent to ${matchedDoctors.length} doctors.`
      );
    } else {
      console.log(
        `No available doctor found for specialization ${requiredSpecialization}`
      );
    }

    const populatedRequest = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    return res.status(201).json({
      success: true,
      message: "Emergency request created successfully",
      data: populatedRequest,
      broadcast: {
        specialization: requiredSpecialization,
        doctorsNotified: matchedDoctors.length,
      },
    });
  } catch (error) {
    console.error("createEmergencyRequest:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// ─────────────────────────────────────────────
// @desc    Get all emergency requests (filtered + paginated)
// @route   GET /api/emergency-requests
// @access  Manager
// ─────────────────────────────────────────────
const getAllEmergencyRequests = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      status,
      severity,
      hospital,
      requiredSpecialization,
      sortBy   = "createdAt",
      order    = "desc",
    } = req.query;

    const filter = {};

    if (status)                 filter.status                 = status;
    if (severity)               filter.severity               = severity;
    if (requiredSpecialization) filter.requiredSpecialization = requiredSpecialization;

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
      data:    requests,
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
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const getEmergencyRequestById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await populateRequest(EmergencyRequest.findById(req.params.id));

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    // Doctors can view a request if:
    //   (a) they have formally responded (accepted or declined), OR
    //   (b) they are formally assigned
    // This allows doctors to see the full detail when deciding to respond.
    if (req.user.role === "doctor") {
      const hasResponded = request.doctorResponses.some(
        (r) => r.doctor._id
          ? r.doctor._id.toString() === req.user._id.toString()
          : r.doctor.toString() === req.user._id.toString()
      );
      const isAssigned = request.assignedDoctors.some(
        (entry) => entry.doctor._id
          ? entry.doctor._id.toString() === req.user._id.toString()
          : entry.doctor.toString() === req.user._id.toString()
      );
      const isConfirmed =
        request.confirmedDoctor &&
        request.confirmedDoctor._id
          ? request.confirmedDoctor._id.toString() === req.user._id.toString()
          : request.confirmedDoctor &&
            request.confirmedDoctor.toString() === req.user._id.toString();

      if (!hasResponded && !isAssigned && !isConfirmed) {
        return res.status(403).json({
          success: false,
          message: "Access denied — you have not responded to or been assigned to this request",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Emergency request fetched successfully",
      data:    request,
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
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

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
      doctorResponses,
      confirmedDoctor,
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
      data:    updated,
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
//          (legacy endpoint — doctorAssignmentController is preferred)
// @route   PATCH /api/emergency-requests/:id/assign-doctors
// @access  Manager
// ─────────────────────────────────────────────
const assignDoctors = async (req, res) => {
  try {
    const { doctors } = req.body;

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "doctors array is required and must not be empty",
      });
    }

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

    const existingIds = request.assignedDoctors.map((d) => d.doctor.toString());

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

    request.assignedDoctors.push(...newAssignments);

    if (request.status === "Pending" || request.status === "Confirmed") {
      request.status = "Assigned";
      request.timeline.push({
        status:    "Assigned",
        changedBy: req.user._id,
        note:      `${newAssignments.length} doctor(s) assigned`,
        changedAt: new Date(),
      });
    }

    await request.save();

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: `${newAssignments.length} doctor(s) assigned successfully`,
      data:    populated,
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
      "Accepted",
      "Confirmed",
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

    if (["Completed", "Cancelled"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status} and cannot be changed`,
      });
    }

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

    await request.save();

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: `Emergency request status updated to "${status}"`,
      data:    populated,
    });
  } catch (error) {
    console.error("updateEmergencyStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Doctor responds to an emergency request (Accept or Decline)
//
//          Accept:
//            - Stores response with optional ETA
//            - If this is the FIRST acceptance, moves status Pending → Accepted
//            - Notifies manager in real-time (emergency:response event)
//            - Audit log created
//
//          Decline:
//            - Stores response with reasonType + optional customReason
//            - Status does NOT change (other doctors may still accept)
//            - Notifies manager in real-time
//            - Audit log created
//
// @route   POST /api/emergency-requests/:id/respond
// @access  Doctor
// ─────────────────────────────────────────────────────────────────────────────
const respondToEmergency = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, eta, reasonType, customReason } = req.body;

    // Validate Emergency Request ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid emergency request ID",
      });
    }

    // Validate action
    if (!["Accepted", "Declined"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be Accepted or Declined",
      });
    }

    // Validate ETA
    if (action === "Accepted" && eta !== undefined) {
      const etaNumber = Number(eta);

      if (!Number.isInteger(etaNumber) || etaNumber < 1 || etaNumber > 480) {
        return res.status(400).json({
          success: false,
          message: "eta must be between 1 and 480 minutes",
        });
      }
    }

    // Validate decline reason
    if (action === "Declined") {
      const validReasons = [
        "Unavailable",
        "OutOfSpecialization",
        "TooFar",
        "Other",
      ];

      if (!reasonType || !validReasons.includes(reasonType)) {
        return res.status(400).json({
          success: false,
          message: `reasonType must be one of: ${validReasons.join(", ")}`,
        });
      }

      if (
        reasonType === "Other" &&
        (!customReason || customReason.trim() === "")
      ) {
        return res.status(400).json({
          success: false,
          message: "customReason is required when reasonType is Other",
        });
      }
    }

    // Fetch emergency
    const request = await EmergencyRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    // Only Pending / Accepted can receive responses
    if (!["Pending", "Accepted"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot respond when request status is ${request.status}`,
      });
    }

    // Doctor already responded?
    const alreadyResponded = request.doctorResponses.some(
      (response) =>
        response.doctor.toString() === req.user._id.toString()
    );

    if (alreadyResponded) {
      return res.status(409).json({
        success: false,
        message: "You have already responded to this emergency request",
      });
    }

    // Build response
    const doctorResponse = {
      doctor: req.user._id,
      action,
      respondedAt: new Date(),
    };

    if (action === "Accepted") {
      doctorResponse.eta = eta ? Number(eta) : undefined;
    } else {
      doctorResponse.reasonType = reasonType;
      doctorResponse.customReason = customReason || "";
    }

    request.doctorResponses.push(doctorResponse);

    const previousStatus = request.status;

    if (action === "Accepted" && request.status === "Pending") {
      request.status = "Accepted";

      request.timeline.push({
        status: "Accepted",
        changedBy: req.user._id,
        note: "Doctor accepted emergency request",
        changedAt: new Date(),
      });
    }

    await request.save();

    // Notify hospital
    const title =
      action === "Accepted"
        ? "Doctor Accepted Emergency"
        : "Doctor Declined Emergency";

    const message =
      action === "Accepted"
        ? `A ${request.requiredSpecialization} specialist accepted your emergency request${
            eta ? ` (ETA: ${eta} minutes)` : ""
          }.`
        : `A ${request.requiredSpecialization} specialist declined your emergency request. Reason: ${
            reasonType === "Other" ? customReason : reasonType
          }.`;

    await notifyUser({
      recipient: request.requestedBy,
      emergencyRequest: request._id,
      title,
      message,
      type: "DoctorResponded",
      createdBy: req.user._id,
      socketEvent: "emergency:response",
    });

    // Audit Log
    await createAuditLog({
      user: req.user._id,
      action: "UPDATE",
      entityType: "EmergencyRequest",
      entityId: request._id,
      description: `Doctor ${action.toLowerCase()} emergency request`,
      metadata: {
        doctorId: req.user._id,
        action,
        eta,
        reasonType,
        customReason,
        previousStatus,
        newStatus: request.status,
      },
      changeDiff:
        previousStatus !== request.status
          ? {
              before: { status: previousStatus },
              after: { status: request.status },
            }
          : undefined,
      status: "SUCCESS",
      riskLevel: "Medium",
      req,
    });

    const populatedRequest = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    return res.status(200).json({
      success: true,
      message: `Doctor ${action.toLowerCase()} the emergency request successfully`,
      data: populatedRequest,
    });
  } catch (error) {
    console.error("respondToEmergency error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Hospital confirms a specific doctor who accepted
//
//          Flow:
//            1. Validate the target doctor actually accepted
//            2. Move status Accepted → Confirmed
//            3. Set confirmedDoctor on the request
//            4. Call the existing formal assignment mechanism
//               (pushes into assignedDoctors[], moves status to Assigned)
//            5. Notify the confirmed doctor (DB + Socket.IO)
//            6. Audit log
//
// @route   PATCH /api/emergency-requests/:id/confirm-doctor
// @access  Manager
// ─────────────────────────────────────────────────────────────────────────────
const confirmDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorId, role } = req.body;

    console.log("\n================ CONFIRM DOCTOR =================");
    console.log("Emergency ID:", id);
    console.log("Request Body:", req.body);
    console.log("Doctor ID from body:", doctorId);
    console.log("Doctor ID type:", typeof doctorId);

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid emergency request ID",
      });
    }

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "doctorId must be a valid MongoDB ID",
      });
    }

    // Fetch Emergency Request
    const request = await EmergencyRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    console.log("Emergency Request Found:", request._id);

    // Emergency must already have accepted responses
    if (request.status !== "Accepted") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm a doctor when emergency status is "${request.status}"`,
      });
    }

    // ---------------- DEBUG ----------------

    console.log("\nSearching Doctor collection...");

    const doctor = await Doctor.findOne({
      userId: new mongoose.Types.ObjectId(doctorId),
    });

    console.log("Doctor Query Result:");
    console.log(doctor);

    const allDoctors = await Doctor.find();

    console.log("\nAll Doctors in Database:");
    allDoctors.forEach((doc) => {
      console.log({
        doctorDocumentId: doc._id.toString(),
        userId: doc.userId.toString(),
        specialization: doc.specialization,
      });
    });

    // --------------------------------------

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    console.log("Doctor found successfully.");

    // Verify doctor accepted the request
    const doctorResponse = request.doctorResponses.find(
      (response) =>
        response.doctor.toString() === doctorId.toString() &&
        response.action === "Accepted"
    );

    console.log("Doctor Response:");
    console.log(doctorResponse);

    if (!doctorResponse) {
      return res.status(400).json({
        success: false,
        message: "Doctor has not accepted this emergency request",
      });
    }

    // Prevent duplicate confirmation
    if (
      request.confirmedDoctor &&
      request.confirmedDoctor.toString() === doctorId.toString()
    ) {
      return res.status(409).json({
        success: false,
        message: "Doctor has already been confirmed",
      });
    }

    const previousStatus = request.status;

    // Save confirmed doctor
    request.confirmedDoctor = doctorId;

    request.timeline.push({
      status: "Confirmed",
      changedBy: req.user._id,
      note:
        "Doctor confirmed by hospital" +
        (doctorResponse.eta
          ? ` (ETA: ${doctorResponse.eta} minutes)`
          : ""),
      changedAt: new Date(),
    });

    // Assign doctor
    const alreadyAssigned = request.assignedDoctors.some(
      (assignment) =>
        assignment.doctor.toString() === doctorId.toString()
    );

    if (!alreadyAssigned) {
      request.assignedDoctors.push({
        doctor: doctorId,
        role: role || "",
        assignedBy: req.user._id,
        assignedAt: new Date(),
      });
    }

    request.status = "Assigned";

    request.timeline.push({
      status: "Assigned",
      changedBy: req.user._id,
      note: "Doctor assigned by hospital",
      changedAt: new Date(),
    });

    await request.save();

    // Notify doctor
    await notifyUser({
      recipient: doctorId,
      emergencyRequest: request._id,
      title: "Emergency Assignment Confirmed",
      message: `You have been assigned to a ${request.severity} severity ${request.emergencyType} emergency.`,
      type: "DoctorConfirmed",
      createdBy: req.user._id,
      socketEvent: "emergency:confirmed",
    });

    // Audit Log
    await createAuditLog({
      user: req.user._id,
      action: "ASSIGN",
      entityType: "EmergencyRequest",
      entityId: request._id,
      description: "Hospital confirmed and assigned doctor",
      metadata: {
        doctorId,
        role: role || "",
        eta: doctorResponse.eta || null,
        previousStatus,
        newStatus: "Assigned",
      },
      changeDiff: {
        before: {
          status: previousStatus,
          confirmedDoctor: null,
        },
        after: {
          status: "Assigned",
          confirmedDoctor: doctorId,
        },
      },
      status: "SUCCESS",
      riskLevel: "High",
      req,
    });

    const populatedRequest = await populateRequest(
      EmergencyRequest.findById(request._id)
    );

    console.log("\nDoctor confirmed successfully.");
    console.log("=================================================\n");

    return res.status(200).json({
      success: true,
      message: "Doctor confirmed successfully",
      data: populatedRequest,
    });
  } catch (error) {
    console.error("\n================ ERROR =================");
    console.error(error);
    console.error("========================================\n");

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Doctor starts treatment — moves status Assigned → In Progress
// @route   PATCH /api/emergency-requests/:id/start
// @access  Doctor (must be assigned to this emergency)
// ─────────────────────────────────────────────────────────────────────────────
const startEmergency = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await EmergencyRequest.findById(id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    const isAssigned = request.assignedDoctors.some(
      (d) => d.doctor.toString() === req.user._id.toString()
    );
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you are not assigned to this emergency",
      });
    }

    if (request.status !== "Assigned") {
      return res.status(400).json({
        success: false,
        message: `Cannot start treatment — current status is "${request.status}". Expected "Assigned".`,
      });
    }

    request.status = "In Progress";
    request.timeline.push({
      status:    "In Progress",
      changedBy: req.user._id,
      note:      "Treatment started by assigned doctor",
      changedAt: new Date(),
    });

    await request.save();

    // Notify manager
    await notifyUser({
      recipient:        request.requestedBy.toString(),
      emergencyRequest: request._id,
      title:            "Treatment Started",
      message:          "Doctor has started treatment for the emergency case",
      type:             "EmergencyUpdated",
      createdBy:        req.user._id,
      socketEvent:      "emergency:started",
    });

    await createAuditLog({
      user:        req.user._id,
      action:      "STATUS_CHANGE",
      entityType:  "EmergencyRequest",
      entityId:    request._id,
      description: "Doctor started treatment — status changed to In Progress",
      metadata: {
        doctorId:       req.user._id,
        previousStatus: "Assigned",
        newStatus:      "In Progress",
      },
      changeDiff: {
        before: { status: "Assigned" },
        after:  { status: "In Progress" },
      },
      status:    "SUCCESS",
      riskLevel: "Medium",
      req,
    });

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Emergency treatment started successfully",
      data:    populated,
    });
  } catch (error) {
    console.error("startEmergency error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Doctor completes treatment — moves status In Progress → Completed
// @route   PATCH /api/emergency-requests/:id/complete
// @access  Doctor (must be assigned to this emergency)
// ─────────────────────────────────────────────────────────────────────────────
const completeEmergency = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid emergency request ID" });
    }

    const request = await EmergencyRequest.findById(id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency request not found" });
    }

    const isAssigned = request.assignedDoctors.some(
      (d) => d.doctor.toString() === req.user._id.toString()
    );
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you are not assigned to this emergency",
      });
    }

    if (request.status !== "In Progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete treatment — current status is "${request.status}". Expected "In Progress".`,
      });
    }

    request.status = "Completed";
    request.timeline.push({
      status:    "Completed",
      changedBy: req.user._id,
      note:      "Treatment completed by assigned doctor",
      changedAt: new Date(),
    });

    await request.save(); // pre-save hook sets resolvedAt

    // Notify manager
    await notifyUser({
      recipient:        request.requestedBy.toString(),
      emergencyRequest: request._id,
      title:            "Treatment Completed",
      message:          "Doctor has completed treatment for the emergency case",
      type:             "EmergencyCompleted",
      createdBy:        req.user._id,
      socketEvent:      "emergency:completed",
    });

    await createAuditLog({
      user:        req.user._id,
      action:      "STATUS_CHANGE",
      entityType:  "EmergencyRequest",
      entityId:    request._id,
      description: "Doctor completed treatment — status changed to Completed",
      metadata: {
        doctorId:       req.user._id,
        previousStatus: "In Progress",
        newStatus:      "Completed",
        resolvedAt:     request.resolvedAt,
      },
      changeDiff: {
        before: { status: "In Progress" },
        after:  { status: "Completed", resolvedAt: request.resolvedAt },
      },
      status:    "SUCCESS",
      riskLevel: "Low",
      req,
    });

    const populated = await populateRequest(EmergencyRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Emergency treatment completed successfully",
      data:    populated,
    });
  } catch (error) {
    console.error("completeEmergency error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────
module.exports = {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  assignDoctors,
  updateEmergencyStatus,
  respondToEmergency,
  confirmDoctor,
  startEmergency,
  completeEmergency,
};