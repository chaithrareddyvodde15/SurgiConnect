"use strict";

const mongoose    = require("mongoose");
const { validationResult } = require("express-validator");

// ── Model imports — exact filenames from your project ──────
const EmergencyRequest = require("../models/EmergencyRequest");
const Doctor           = require("../models/doctorModel");

// ── Internal helper from Audit module ──────────────────────
// Wrapped in try/catch so a missing export never crashes boot
let createAuditLog;
try {
  ({ createAuditLog } = require("./auditLogController"));
} catch (_) {
  createAuditLog = async () => null; // graceful no-op if not found
}

// ═══════════════════════════════════════════════════════════
// SECTION 1 — RECOMMENDATION ENGINE
// Pure functions — no DB calls, fully testable in isolation
// ═══════════════════════════════════════════════════════════

/**
 * Master rules map.
 * Key   : lowercase normalized emergency type (supports partial match)
 * Value : { specializations[], urgencyScore, urgencyLabel, notes }
 *
 * To add a new condition: add one entry here — no other code changes needed.
 */
const RECOMMENDATION_RULES = {
  // ── Cardiac ───────────────────────────────────────────────
  "cardiac arrest": {
    specializations: ["Cardiology", "Critical Care", "Anesthesiology"],
    urgencyScore:    98,
    urgencyLabel:    "Critical",
    notes:           "Immediate defibrillation team required",
  },
  "heart attack": {
    specializations: ["Cardiology", "Critical Care", "Anesthesiology"],
    urgencyScore:    95,
    urgencyLabel:    "Critical",
    notes:           "Cath lab activation recommended",
  },
  "chest pain": {
    specializations: ["Cardiology", "Internal Medicine", "Critical Care"],
    urgencyScore:    75,
    urgencyLabel:    "High",
    notes:           "Rule out ACS — ECG and troponin required",
  },

  // ── Neurological ─────────────────────────────────────────
  "brain hemorrhage": {
    specializations: ["Neurosurgery", "Critical Care", "Anesthesiology"],
    urgencyScore:    97,
    urgencyLabel:    "Critical",
    notes:           "Immediate CT scan and neurosurgery consult",
  },
  "stroke": {
    specializations: ["Neurology", "Neurosurgery", "Critical Care"],
    urgencyScore:    96,
    urgencyLabel:    "Critical",
    notes:           "Thrombolysis window — act within 4.5 hours",
  },
  "seizure": {
    specializations: ["Neurology", "Critical Care", "Anesthesiology"],
    urgencyScore:    80,
    urgencyLabel:    "High",
    notes:           "Airway management and anti-epileptic protocol",
  },
  "head injury": {
    specializations: ["Neurosurgery", "Critical Care", "Orthopedics"],
    urgencyScore:    85,
    urgencyLabel:    "High",
    notes:           "Rule out intracranial bleed — CT head stat",
  },

  // ── Trauma ───────────────────────────────────────────────
  "road accident": {
    specializations: ["Orthopedics", "General Surgery", "Critical Care"],
    urgencyScore:    90,
    urgencyLabel:    "Critical",
    notes:           "Trauma protocol — assess ABCDE",
  },
  "multiple trauma": {
    specializations: [
      "General Surgery",
      "Orthopedics",
      "Critical Care",
      "Anesthesiology",
    ],
    urgencyScore:    95,
    urgencyLabel:    "Critical",
    notes:           "Full trauma team activation",
  },
  "fall injury": {
    specializations: ["Orthopedics", "General Surgery", "Neurosurgery"],
    urgencyScore:    70,
    urgencyLabel:    "High",
    notes:           "Check for spinal injury before mobilizing",
  },

  // ── Burns ────────────────────────────────────────────────
  "burn": {
    specializations: [
      "Plastic Surgery",
      "Critical Care",
      "General Surgery",
    ],
    urgencyScore:    88,
    urgencyLabel:    "Critical",
    notes:           "Fluid resuscitation — Parkland formula",
  },

  // ── Respiratory ──────────────────────────────────────────
  "respiratory failure": {
    specializations: [
      "Pulmonology",
      "Critical Care",
      "Anesthesiology",
    ],
    urgencyScore:    93,
    urgencyLabel:    "Critical",
    notes:           "Immediate intubation team on standby",
  },
  "asthma": {
    specializations: ["Pulmonology", "Critical Care", "Internal Medicine"],
    urgencyScore:    72,
    urgencyLabel:    "High",
    notes:           "Nebulization, steroids, and O2 therapy",
  },

  // ── Abdominal ────────────────────────────────────────────
  "abdominal pain": {
    specializations: ["General Surgery", "Gastroenterology", "Internal Medicine"],
    urgencyScore:    65,
    urgencyLabel:    "Medium",
    notes:           "Rule out acute abdomen — surgical consult",
  },
  "appendicitis": {
    specializations: ["General Surgery", "Anesthesiology"],
    urgencyScore:    85,
    urgencyLabel:    "High",
    notes:           "Emergency appendectomy likely required",
  },
  "gastrointestinal bleed": {
    specializations: [
      "Gastroenterology",
      "General Surgery",
      "Critical Care",
    ],
    urgencyScore:    88,
    urgencyLabel:    "Critical",
    notes:           "Urgent endoscopy and cross-match blood",
  },

  // ── Obstetric ────────────────────────────────────────────
  "obstetric emergency": {
    specializations: [
      "Obstetrics and Gynecology",
      "Critical Care",
      "Anesthesiology",
      "Neonatology",
    ],
    urgencyScore:    95,
    urgencyLabel:    "Critical",
    notes:           "OB emergency team — fetal monitoring stat",
  },

  // ── Pediatric ────────────────────────────────────────────
  "pediatric emergency": {
    specializations: ["Pediatrics", "Critical Care", "Anesthesiology"],
    urgencyScore:    90,
    urgencyLabel:    "Critical",
    notes:           "Pediatric resuscitation protocols apply",
  },

  // ── Renal ────────────────────────────────────────────────
  "renal failure": {
    specializations: ["Nephrology", "Critical Care", "Internal Medicine"],
    urgencyScore:    78,
    urgencyLabel:    "High",
    notes:           "Dialysis team alert — check potassium levels",
  },

  // ── Sepsis ───────────────────────────────────────────────
  "sepsis": {
    specializations: [
      "Critical Care",
      "Infectious Disease",
      "Internal Medicine",
    ],
    urgencyScore:    94,
    urgencyLabel:    "Critical",
    notes:           "Sepsis bundle — blood cultures before antibiotics",
  },

  // ── Poisoning ────────────────────────────────────────────
  "poisoning": {
    specializations: [
      "Emergency Medicine",
      "Critical Care",
      "Gastroenterology",
    ],
    urgencyScore:    85,
    urgencyLabel:    "High",
    notes:           "Identify toxin — contact poison control",
  },

  // ── Ophthalmic ───────────────────────────────────────────
  "eye injury": {
    specializations: ["Ophthalmology", "General Surgery"],
    urgencyScore:    70,
    urgencyLabel:    "High",
    notes:           "Protect eye from pressure — urgent ophthalmology",
  },
};

/**
 * Severity multiplier applied on top of rule-base urgency score.
 * Ensures a manually-set Critical severity always elevates the score.
 */
const SEVERITY_MULTIPLIERS = {
  Critical: 1.0,   // keep as-is (already at ceiling)
  High:     0.95,
  Medium:   0.85,
  Low:      0.70,
};

/**
 * Fallback when no rule matches the emergency type.
 * Uses severity to derive a reasonable default score.
 */
const FALLBACK_BY_SEVERITY = {
  Critical: {
    specializations: ["Critical Care", "General Surgery", "Anesthesiology"],
    urgencyScore:    90,
    urgencyLabel:    "Critical",
    notes:           "No specific rule matched — general emergency team",
  },
  High: {
    specializations: ["Critical Care", "General Surgery", "Internal Medicine"],
    urgencyScore:    70,
    urgencyLabel:    "High",
    notes:           "No specific rule matched — general emergency team",
  },
  Medium: {
    specializations: ["Internal Medicine", "General Surgery"],
    urgencyScore:    50,
    urgencyLabel:    "Medium",
    notes:           "No specific rule matched — general assessment team",
  },
  Low: {
    specializations: ["Internal Medicine"],
    urgencyScore:    25,
    urgencyLabel:    "Low",
    notes:           "No specific rule matched — routine assessment",
  },
};

/**
 * Symptom booster map.
 * If any symptom keyword matches, urgency score is boosted
 * and specializations may be extended.
 *
 * Design: kept additive so base rule still drives primary specializations.
 */
const SYMPTOM_BOOSTERS = {
  "unconscious":       { scoreBoost: 8,  extraSpecializations: ["Critical Care"] },
  "not breathing":     { scoreBoost: 10, extraSpecializations: ["Critical Care", "Anesthesiology"] },
  "heavy bleeding":    { scoreBoost: 7,  extraSpecializations: ["General Surgery"] },
  "paralysis":         { scoreBoost: 6,  extraSpecializations: ["Neurology", "Neurosurgery"] },
  "chest pain":        { scoreBoost: 5,  extraSpecializations: ["Cardiology"] },
  "high fever":        { scoreBoost: 3,  extraSpecializations: ["Infectious Disease"] },
  "difficulty breathing": { scoreBoost: 6, extraSpecializations: ["Pulmonology"] },
  "vomiting blood":    { scoreBoost: 7,  extraSpecializations: ["Gastroenterology"] },
};

/**
 * Core recommendation engine.
 * Pure function — no DB calls, deterministic, easily unit-testable.
 *
 * @param {string}   emergencyType
 * @param {string[]} symptoms
 * @param {string}   severity  — "Low" | "Medium" | "High" | "Critical"
 * @returns {{ specializations, urgencyScore, urgencyLabel, notes, matchedRule }}
 */
const runRecommendationEngine = (emergencyType, symptoms = [], severity = "Medium") => {
  const normalizedType = (emergencyType || "").toLowerCase().trim();

  // ── Step 1: Find best matching rule ──────────────────────
  let matchedRuleKey  = null;
  let matchedRule     = null;

  // Try exact match first, then partial match
  for (const [key, rule] of Object.entries(RECOMMENDATION_RULES)) {
    if (normalizedType === key) {
      matchedRuleKey = key;
      matchedRule    = rule;
      break;
    }
  }

  if (!matchedRule) {
    for (const [key, rule] of Object.entries(RECOMMENDATION_RULES)) {
      if (normalizedType.includes(key) || key.includes(normalizedType)) {
        matchedRuleKey = key;
        matchedRule    = rule;
        break;
      }
    }
  }

  // ── Step 2: Fallback if no rule found ────────────────────
  const base = matchedRule
    ? { ...matchedRule }
    : { ...(FALLBACK_BY_SEVERITY[severity] || FALLBACK_BY_SEVERITY["Medium"]) };

  // ── Step 3: Apply symptom boosters ───────────────────────
  let scoreBoostTotal        = 0;
  const extraSpecializations = [];
  const normalizedSymptoms   = symptoms.map((s) => s.toLowerCase().trim());

  for (const [keyword, booster] of Object.entries(SYMPTOM_BOOSTERS)) {
    const matched = normalizedSymptoms.some(
      (s) => s.includes(keyword) || keyword.includes(s)
    );
    if (matched) {
      scoreBoostTotal += booster.scoreBoost;
      extraSpecializations.push(...booster.extraSpecializations);
    }
  }

  // ── Step 4: Merge and deduplicate specializations ────────
  const mergedSpecializations = [
    ...new Set([...base.specializations, ...extraSpecializations]),
  ];

  // ── Step 5: Apply severity multiplier ────────────────────
  const multiplier  = SEVERITY_MULTIPLIERS[severity] || 0.85;
  let   finalScore  = Math.round((base.urgencyScore + scoreBoostTotal) * multiplier);
  finalScore        = Math.min(finalScore, 100); // cap at 100

  // ── Step 6: Derive urgency label from final score ────────
  let urgencyLabel;
  if      (finalScore >= 90) urgencyLabel = "Critical";
  else if (finalScore >= 70) urgencyLabel = "High";
  else if (finalScore >= 40) urgencyLabel = "Medium";
  else                       urgencyLabel = "Low";

  return {
    specializations: mergedSpecializations,
    urgencyScore:    finalScore,
    urgencyLabel,
    notes:           base.notes || "",
    matchedRule:     matchedRuleKey || "fallback",
  };
};

// ═══════════════════════════════════════════════════════════
// SECTION 2 — HELPERS
// ═══════════════════════════════════════════════════════════

/** Format express-validator errors or return null */
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

/**
 * Find available doctors matching a list of specializations.
 * Queries doctorModel — uses `specialization` and `availability` fields.
 */
const findMatchingDoctors = async (specializations, hospitalId = null) => {
  const query = {
    specialization: { $in: specializations },
    availability:   "Available",
    verified:       true,
  };

  // Optionally scope to the same hospital
  

  const doctors = await Doctor.find(query)
    .select("name email specialization availability verified")
    .lean();

  // Group doctors by their specialization for structured response
  const grouped = {};
  for (const spec of specializations) {
    grouped[spec] = doctors.filter(
      (d) =>
        typeof d.specialization === "string"
          ? d.specialization === spec
          : Array.isArray(d.specialization) && d.specialization.includes(spec)
    );
  }

  return { doctors, grouped };
};

// ═══════════════════════════════════════════════════════════
// SECTION 3 — CONTROLLER HANDLERS
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// @desc    Generate AI recommendations for an emergency request
// @route   POST /api/ai-recommendations/recommend
// @access  Manager
// ─────────────────────────────────────────────
const generateRecommendation = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    const { emergencyRequestId } = req.body;

    if (!isValidObjectId(emergencyRequestId, res, "emergency request ID")) return;

    // ── Fetch the emergency request ───────────
    const emergencyRequest = await EmergencyRequest.findById(
      emergencyRequestId
    ).populate("hospital", "_id name");

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    if (["Completed", "Cancelled"].includes(emergencyRequest.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot generate recommendations for a ${emergencyRequest.status} request`,
      });
    }

    // ── Run the recommendation engine ─────────
    const {
      specializations,
      urgencyScore,
      urgencyLabel,
      notes,
      matchedRule,
    } = runRecommendationEngine(
      emergencyRequest.emergencyType,
      emergencyRequest.symptoms,
      emergencyRequest.severity
    );

    // ── Find matching available doctors ───────
    const hospitalId =
      emergencyRequest.hospital?._id || emergencyRequest.hospital;
    const { doctors, grouped } = await findMatchingDoctors(
      specializations,
      hospitalId
    );

    // ── Persist into the existing aiRecommendation slot ───
    emergencyRequest.aiRecommendation = {
      recommendedSpecializations: specializations,
      urgencyScore,
      urgencyLabel,
      reportSummary: notes,
      generatedAt:   new Date(),
    };

    await emergencyRequest.save();

    // ── Audit log ─────────────────────────────
    await createAuditLog({
      user:        req.user._id,
      action:      "AI_RECOMMENDATION",
      entityType:  "EmergencyRequest",
      entityId:    emergencyRequest._id,
      description: `AI recommendations generated for emergency: ${emergencyRequest.emergencyType}`,
      metadata: {
        urgencyScore,
        urgencyLabel,
        specializations,
        matchedRule,
        doctorsFound: doctors.length,
      },
      riskLevel: urgencyLabel === "Critical" ? "Critical" : "Medium",
      req,
    });

    return res.status(200).json({
      success: true,
      message: "AI recommendations generated successfully",
      data: {
        emergencyRequestId: emergencyRequest._id,
        emergencyType:      emergencyRequest.emergencyType,
        severity:           emergencyRequest.severity,
        matchedRule,
        aiRecommendation: {
          recommendedSpecializations: specializations,
          urgencyScore,
          urgencyLabel,
          reportSummary: notes,
          generatedAt:   emergencyRequest.aiRecommendation.generatedAt,
        },
        matchingDoctors: {
          total:    doctors.length,
          bySpecialization: grouped,
        },
      },
    });
  } catch (error) {
    console.error("generateRecommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get stored AI recommendation for an emergency request
// @route   GET /api/ai-recommendations/:emergencyRequestId
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const getRecommendation = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;

    if (!isValidObjectId(emergencyRequestId, res, "emergency request ID")) return;

    const emergencyRequest = await EmergencyRequest.findById(
      emergencyRequestId
    )
      .populate("hospital",      "name address")
      .populate("requestedBy",   "name email")
      .lean();

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    const { aiRecommendation } = emergencyRequest;

    if (
      !aiRecommendation ||
      !aiRecommendation.generatedAt
    ) {
      return res.status(404).json({
        success: false,
        message:
          "No AI recommendation found for this request. Use POST /recommend to generate one.",
      });
    }

    // Doctor access guard — only assigned doctors can view
    if (req.user.role === "doctor") {
      const isAssigned = (emergencyRequest.assignedDoctors || []).some(
        (entry) => entry.doctor?.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied — you are not assigned to this emergency request",
        });
      }
    }

    // Fetch current available doctors for recommended specializations
    const hospitalId =
      emergencyRequest.hospital?._id || emergencyRequest.hospital;
    const { doctors, grouped } = await findMatchingDoctors(
      aiRecommendation.recommendedSpecializations || [],
      hospitalId
    );

    return res.status(200).json({
      success: true,
      message: "AI recommendation fetched successfully",
      data: {
        emergencyRequestId: emergencyRequest._id,
        emergencyType:      emergencyRequest.emergencyType,
        severity:           emergencyRequest.severity,
        aiRecommendation,
        currentlyAvailableDoctors: {
          total:            doctors.length,
          bySpecialization: grouped,
        },
      },
    });
  } catch (error) {
    console.error("getRecommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Refresh (regenerate) AI recommendation
// @route   PATCH /api/ai-recommendations/refresh/:emergencyRequestId
// @access  Manager
// ─────────────────────────────────────────────
const refreshRecommendation = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;

    if (!isValidObjectId(emergencyRequestId, res, "emergency request ID")) return;

    const emergencyRequest = await EmergencyRequest.findById(
      emergencyRequestId
    ).populate("hospital", "_id name");

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    if (["Completed", "Cancelled"].includes(emergencyRequest.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot refresh recommendations for a ${emergencyRequest.status} request`,
      });
    }

    const previousUrgencyScore = emergencyRequest.aiRecommendation?.urgencyScore || null;

    // ── Re-run the engine ─────────────────────
    const {
      specializations,
      urgencyScore,
      urgencyLabel,
      notes,
      matchedRule,
    } = runRecommendationEngine(
      emergencyRequest.emergencyType,
      emergencyRequest.symptoms,
      emergencyRequest.severity
    );

    const hospitalId =
      emergencyRequest.hospital?._id || emergencyRequest.hospital;
    const { doctors, grouped } = await findMatchingDoctors(
      specializations,
      hospitalId
    );

    // ── Overwrite existing aiRecommendation ───
    emergencyRequest.aiRecommendation = {
      recommendedSpecializations: specializations,
      urgencyScore,
      urgencyLabel,
      reportSummary: notes,
      generatedAt:   new Date(),
    };

    await emergencyRequest.save();

    await createAuditLog({
      user:        req.user._id,
      action:      "AI_RECOMMENDATION",
      entityType:  "EmergencyRequest",
      entityId:    emergencyRequest._id,
      description: `AI recommendations refreshed for emergency: ${emergencyRequest.emergencyType}`,
      metadata: {
        urgencyScore,
        urgencyLabel,
        previousUrgencyScore,
        specializations,
        matchedRule,
        doctorsFound: doctors.length,
      },
      riskLevel: urgencyLabel === "Critical" ? "Critical" : "Medium",
      req,
    });

    return res.status(200).json({
      success: true,
      message: "AI recommendations refreshed successfully",
      data: {
        emergencyRequestId: emergencyRequest._id,
        emergencyType:      emergencyRequest.emergencyType,
        severity:           emergencyRequest.severity,
        matchedRule,
        previousUrgencyScore,
        aiRecommendation: {
          recommendedSpecializations: specializations,
          urgencyScore,
          urgencyLabel,
          reportSummary: notes,
          generatedAt:   emergencyRequest.aiRecommendation.generatedAt,
        },
        matchingDoctors: {
          total:            doctors.length,
          bySpecialization: grouped,
        },
      },
    });
  } catch (error) {
    console.error("refreshRecommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Get available doctors for a specialization list
// @route   GET /api/ai-recommendations/doctors/:emergencyRequestId
// @access  Manager, Doctor
// ─────────────────────────────────────────────
const getMatchingDoctors = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;

    if (!isValidObjectId(emergencyRequestId, res, "emergency request ID")) return;

    const {
      page  = 1,
      limit = 10,
    } = req.query;

    const emergencyRequest = await EmergencyRequest.findById(
      emergencyRequestId
    ).lean();

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: "Emergency request not found",
      });
    }

    const { aiRecommendation } = emergencyRequest;

    if (!aiRecommendation?.recommendedSpecializations?.length) {
      return res.status(400).json({
        success: false,
        message:
          "No recommendation exists for this request. Generate one first via POST /recommend.",
      });
    }

    // Doctor guard — only assigned doctors can view
    if (req.user.role === "doctor") {
      const isAssigned = (emergencyRequest.assignedDoctors || []).some(
        (entry) => entry.doctor?.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied — you are not assigned to this emergency request",
        });
      }
    }

    const specializations = aiRecommendation.recommendedSpecializations;
    const hospitalId      = emergencyRequest.hospital;

    // Paginated doctor query
    const skip = (Number(page) - 1) * Number(limit);

    const doctorQuery = {
  specialization: { $in: specializations },
  availability: "Available",
  verified: true,
};

    

    const [allDoctors, total] = await Promise.all([
      Doctor.find(doctorQuery)
        .select("name email specialization availability verified")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Doctor.countDocuments(doctorQuery),
    ]);

    // Group by specialization for readability
    const grouped = {};
    for (const spec of specializations) {
      grouped[spec] = allDoctors.filter((d) =>
        typeof d.specialization === "string"
          ? d.specialization === spec
          : Array.isArray(d.specialization) && d.specialization.includes(spec)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Matching doctors fetched successfully",
      data: {
        emergencyRequestId,
        recommendedSpecializations: specializations,
        urgencyScore:  aiRecommendation.urgencyScore,
        urgencyLabel:  aiRecommendation.urgencyLabel,
        doctors: {
          bySpecialization: grouped,
        },
      },
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getMatchingDoctors error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────
// @desc    Preview recommendation without saving
//          (useful for UI preview before committing)
// @route   POST /api/ai-recommendations/preview
// @access  Manager
// ─────────────────────────────────────────────
const previewRecommendation = async (req, res) => {
  try {
    const errors = getValidationErrors(req);
    if (errors) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    const {
      emergencyType,
      symptoms = [],
      severity = "Medium",
    } = req.body;

    const result = runRecommendationEngine(emergencyType, symptoms, severity);

    return res.status(200).json({
      success: true,
      message: "Preview generated (not saved)",
      data: {
        input: { emergencyType, symptoms, severity },
        recommendation: {
          recommendedSpecializations: result.specializations,
          urgencyScore:               result.urgencyScore,
          urgencyLabel:               result.urgencyLabel,
          notes:                      result.notes,
          matchedRule:                result.matchedRule,
        },
      },
    });
  } catch (error) {
    console.error("previewRecommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
  generateRecommendation,
  getRecommendation,
  refreshRecommendation,
  getMatchingDoctors,
  previewRecommendation,

  // Export engine for unit testing
  runRecommendationEngine,
};