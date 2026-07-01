// ─────────────────────────────────────────────────────────────────────────────
// controllers/dashboardController.js
// Dashboard & Analytics — Manager Only
// ─────────────────────────────────────────────────────────────────────────────

const Hospital         = require("../models/Hospital");
const Doctor           = require("../models/doctorModel");
const EmergencyRequest = require("../models/EmergencyRequest");
const Notification     = require("../models/Notification");
const AuditLog         = require("../models/AuditLog");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: standard success envelope
// ─────────────────────────────────────────────────────────────────────────────
const sendSuccess = (res, data, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: standard error envelope
// ─────────────────────────────────────────────────────────────────────────────
const sendError = (res, message = "Server Error", statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/dashboard/stats
// @desc    Full dashboard statistics (single aggregated call)
// @access  Manager only
// ─────────────────────────────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    // ── Run all independent queries in parallel ──────────────────────────────
    const [
      hospitalStats,
      doctorStats,
      emergencyStats,
      severityStats,
      aiStats,
      notificationStats,
      auditStats,
    ] = await Promise.all([
      // 1. Hospital stats
      Hospital.aggregate([
        {
          $group: {
            _id: null,
            total:    { $sum: 1 },
            active:   { $sum: { $cond: [{ $eq: ["$status", "Active"] },   1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ["$status", "Inactive"] }, 1, 0] } },
            suspended:{ $sum: { $cond: [{ $eq: ["$status", "Suspended"] },1, 0] } },
          },
        },
      ]),

      // 2. Doctor stats
      Doctor.aggregate([
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ["$availability", "Available"] }, 1, 0] } },
            onCall:    { $sum: { $cond: [{ $eq: ["$availability", "On-Call"] },   1, 0] } },
            verified:  { $sum: { $cond: ["$verified", 1, 0] } },
          },
        },
      ]),

      // 3. Emergency stats (status breakdown)
      EmergencyRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // 4. Severity stats
      EmergencyRequest.aggregate([
        {
          $group: {
            _id: "$severity",
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. AI recommendation stats
      EmergencyRequest.aggregate([
        {
          $match: {
            "aiRecommendation.generatedAt": { $ne: null },
          },
        },
        {
          $count: "totalAiRecommendations",
        },
      ]),

      // 6. Notification stats (isDeleted guard already in model's pre-find hook;
      //    we use aggregate to bypass the hook for a raw count)
      Notification.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            total:  { $sum: 1 },
            unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
          },
        },
      ]),

      // 7. Audit log stats
      AuditLog.aggregate([
        { $count: "totalAuditLogs" },
      ]),
    ]);

    // ── Shape hospital statistics ────────────────────────────────────────────
    const hs = hospitalStats[0] || { total: 0, active: 0, inactive: 0, suspended: 0 };

    // ── Shape doctor statistics ──────────────────────────────────────────────
    const ds = doctorStats[0] || { total: 0, available: 0, onCall: 0, verified: 0 };

    // ── Shape emergency statistics ───────────────────────────────────────────
    const emergencyStatusMap = {
      Pending:     0,
      Assigned:    0,
      "In Progress": 0,
      Completed:   0,
      Cancelled:   0,
    };
    let totalEmergencies = 0;
    emergencyStats.forEach(({ _id, count }) => {
      if (_id in emergencyStatusMap) emergencyStatusMap[_id] = count;
      totalEmergencies += count;
    });

    // ── Shape severity statistics ────────────────────────────────────────────
    const severityMap = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    severityStats.forEach(({ _id, count }) => {
      if (_id in severityMap) severityMap[_id] = count;
    });

    // ── Shape AI statistics ──────────────────────────────────────────────────
    const totalAiRecommendations = aiStats[0]?.totalAiRecommendations ?? 0;

    // ── Shape notification statistics ────────────────────────────────────────
    const ns = notificationStats[0] || { total: 0, unread: 0 };

    // ── Shape audit statistics ───────────────────────────────────────────────
    const totalAuditLogs = auditStats[0]?.totalAuditLogs ?? 0;

    // ── Compose final response ───────────────────────────────────────────────
    const data = {
      hospitals: {
        total:     hs.total,
        active:    hs.active,
        inactive:  hs.inactive,
        suspended: hs.suspended,
      },
      doctors: {
        total:       ds.total,
        available:   ds.available,
        onCall:      ds.onCall,
        unavailable: ds.total - ds.available - ds.onCall,
        verified:    ds.verified,
        unverified:  ds.total - ds.verified,
      },
      emergencies: {
        total:      totalEmergencies,
        pending:    emergencyStatusMap["Pending"],
        assigned:   emergencyStatusMap["Assigned"],
        inProgress: emergencyStatusMap["In Progress"],
        completed:  emergencyStatusMap["Completed"],
        cancelled:  emergencyStatusMap["Cancelled"],
      },
      severity: {
        low:      severityMap.Low,
        medium:   severityMap.Medium,
        high:     severityMap.High,
        critical: severityMap.Critical,
      },
      ai: {
        totalRecommendations: totalAiRecommendations,
      },
      notifications: {
        total:  ns.total,
        unread: ns.unread,
        read:   ns.total - ns.unread,
      },
      auditLogs: {
        total: totalAuditLogs,
      },
    };

    return sendSuccess(res, data, "Dashboard statistics fetched successfully");
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return sendError(res, "Failed to fetch dashboard statistics");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/dashboard/recent-activity
// @desc    Latest emergency requests, notifications, and audit logs
// @access  Manager only
// Query Params:
//   limit  – items per section (default 10, max 50)
// ─────────────────────────────────────────────────────────────────────────────
const getRecentActivity = async (req, res) => {
  try {
    // ── Parse & clamp limit ──────────────────────────────────────────────────
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50
    );

    // ── Fetch the three recent feeds in parallel ─────────────────────────────
    const [recentEmergencies, recentNotifications, recentAuditLogs] =
      await Promise.all([
        EmergencyRequest.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .select(
            "patientName patientAge gender emergencyType severity status hospital requestedBy createdAt"
          )
          .populate("hospital",     "name address.city")
          .populate("requestedBy",  "name email role")
          .lean(),

        Notification.find({ isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(limit)
          .select("title message type isRead recipient emergencyRequest createdAt")
          .populate("recipient",        "name email role")
          .populate("emergencyRequest", "patientName emergencyType status")
          .lean(),

        AuditLog.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .select("action entityType entityId description status riskLevel user createdAt")
          .populate("user", "name email role")
          .lean(),
      ]);

    const data = {
      recentEmergencies,
      recentNotifications,
      recentAuditLogs,
      meta: { limit },
    };

    return sendSuccess(res, data, "Recent activity fetched successfully");
  } catch (err) {
    console.error("getRecentActivity error:", err);
    return sendError(res, "Failed to fetch recent activity");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/dashboard/emergency-trends
// @desc    Emergency counts grouped by day for the last N days
// @access  Manager only
// Query Params:
//   days   – lookback window in days (default 7, max 90)
// ─────────────────────────────────────────────────────────────────────────────
const getEmergencyTrends = async (req, res) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 7, 1),
      90
    );

    const since = new Date();
    since.setDate(since.getDate() - days);

    const trends = await EmergencyRequest.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year:  { $year:        "$createdAt" },
            month: { $month:       "$createdAt" },
            day:   { $dayOfMonth:  "$createdAt" },
          },
          total:      { $sum: 1 },
          pending:    { $sum: { $cond: [{ $eq: ["$status", "Pending"] },      1, 0] } },
          assigned:   { $sum: { $cond: [{ $eq: ["$status", "Assigned"] },     1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] },  1, 0] } },
          completed:  { $sum: { $cond: [{ $eq: ["$status", "Completed"] },    1, 0] } },
          cancelled:  { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] },    1, 0] } },
          critical:   { $sum: { $cond: [{ $eq: ["$severity", "Critical"] },   1, 0] } },
        },
      },
      {
        $addFields: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year:  "$_id.year",
                  month: "$_id.month",
                  day:   "$_id.day",
                },
              },
            },
          },
        },
      },
      { $sort: { date: 1 } },
      { $project: { _id: 0 } },
    ]);

    return sendSuccess(
      res,
      { trends, meta: { days, since } },
      "Emergency trends fetched successfully"
    );
  } catch (err) {
    console.error("getEmergencyTrends error:", err);
    return sendError(res, "Failed to fetch emergency trends");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/dashboard/hospital-stats
// @desc    Per-hospital emergency breakdown (paginated)
// @access  Manager only
// Query Params:
//   page   – page number  (default 1)
//   limit  – items per page (default 10, max 50)
// ─────────────────────────────────────────────────────────────────────────────
const getHospitalStats = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1,  1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip  = (page - 1) * limit;

    const [stats, totalHospitals] = await Promise.all([
      EmergencyRequest.aggregate([
        {
          $group: {
            _id: "$hospital",
            totalEmergencies: { $sum: 1 },
            pending:    { $sum: { $cond: [{ $eq: ["$status", "Pending"] },      1, 0] } },
            assigned:   { $sum: { $cond: [{ $eq: ["$status", "Assigned"] },     1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] },  1, 0] } },
            completed:  { $sum: { $cond: [{ $eq: ["$status", "Completed"] },    1, 0] } },
            cancelled:  { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] },    1, 0] } },
            critical:   { $sum: { $cond: [{ $eq: ["$severity", "Critical"] },   1, 0] } },
            high:       { $sum: { $cond: [{ $eq: ["$severity", "High"] },       1, 0] } },
          },
        },
        {
          $lookup: {
            from:         "hospitals",
            localField:   "_id",
            foreignField: "_id",
            as:           "hospitalInfo",
          },
        },
        {
  $unwind: {
    path: "$hospitalInfo",
    preserveNullAndEmptyArrays: true
  },
},
        {
          $project: {
            hospitalId:       "$_id",
            hospitalName:     "$hospitalInfo.name",
            hospitalCity:     "$hospitalInfo.address.city",
            hospitalStatus:   "$hospitalInfo.status",
            totalEmergencies: 1,
            pending:          1,
            assigned:         1,
            inProgress:       1,
            completed:        1,
            cancelled:        1,
            critical:         1,
            high:             1,
            _id:              0,
          },
        },
        { $sort: { totalEmergencies: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),

      // Count distinct hospitals that have emergencies
      EmergencyRequest.aggregate([
        { $group: { _id: "$hospital" } },
        { $count: "total" },
      ]),
    ]);

    const total      = totalHospitals[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(
      res,
      {
        hospitalStats: stats,
        pagination: { page, limit, total, totalPages },
      },
      "Hospital statistics fetched successfully"
    );
  } catch (err) {
    console.error("getHospitalStats error:", err);
    return sendError(res, "Failed to fetch hospital statistics");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/dashboard/doctor-stats
// @desc    Doctor availability & assignment overview (paginated)
// @access  Manager only
// Query Params:
//   page   – page number  (default 1)
//   limit  – items per page (default 10, max 50)
// ─────────────────────────────────────────────────────────────────────────────
const getDoctorStats = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1,  1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip  = (page - 1) * limit;

    const [doctors, total] = await Promise.all([
      Doctor.find()
        .skip(skip)
        .limit(limit)
        .select("userId specialization fee availability verified")
        .populate("userId", "name email")
        .lean(),

      Doctor.countDocuments(),
    ]);

    // Attach assignment count for each doctor
    const doctorIds = doctors.map((d) => d.userId?._id).filter(Boolean);

    const assignmentCounts = await EmergencyRequest.aggregate([
      { $unwind: "$assignedDoctors" },
      { $match: { "assignedDoctors.doctor": { $in: doctorIds } } },
      {
        $group: {
          _id:   "$assignedDoctors.doctor",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    assignmentCounts.forEach(({ _id, count }) => {
      countMap[_id.toString()] = count;
    });

    const enriched = doctors.map((d) => ({
      ...d,
      totalAssignments: countMap[d.userId?._id?.toString()] ?? 0,
    }));

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(
      res,
      {
        doctors: enriched,
        pagination: { page, limit, total, totalPages },
      },
      "Doctor statistics fetched successfully"
    );
  } catch (err) {
    console.error("getDoctorStats error:", err);
    return sendError(res, "Failed to fetch doctor statistics");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getDashboardStats,
  getRecentActivity,
  getEmergencyTrends,
  getHospitalStats,
  getDoctorStats,
};