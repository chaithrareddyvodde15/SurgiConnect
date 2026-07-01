const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Constants — single source of truth for enums
// shared between sub-schemas and the main schema
// ─────────────────────────────────────────────

/**
 * Full specialization list.
 * Matches Hospital.specializations[] exactly so the AI recommendation
 * module can write to `aiRecommendation.recommendedSpecializations` and
 * the manager can select from the same set when creating an emergency.
 *
 * Future: AI module can populate `requiredSpecialization` automatically
 * after analyzing `emergencyType` + `symptoms` — no schema change needed.
 */
const SPECIALIZATIONS = [
  "Cardiology",
  "Neurology",
  "Neurosurgery",
  "Orthopedics",
  "Anesthesiology",
  "Critical Care",
  "Pediatrics",
  "General Surgery",
];

/**
 * Status lifecycle:
 *   Pending → Accepted → Confirmed → Assigned → In Progress → Completed
 *
 * Terminal states (no further transitions allowed):
 *   Completed, Cancelled
 *
 * Future states — add here without breaking existing data:
 *   Expired, Escalated
 *
 * Backward-compatible: existing records with "Pending", "Assigned",
 * "In Progress", "Completed", "Cancelled" remain valid.
 */
const EMERGENCY_STATUSES = [
  "Pending",      // Created by manager; awaiting doctor responses
  "Accepted",     // At least one doctor has accepted; awaiting hospital confirmation
  "Confirmed",    // Hospital confirmed a specific doctor; triggers formal assignment
  "Assigned",     // Doctor formally assigned via doctorAssignmentController
  "In Progress",  // Doctor started treatment (startEmergency)
  "Completed",    // Doctor completed treatment (completeEmergency)
  "Cancelled",    // Cancelled before treatment began
  // "Expired",   // Future: no doctor responded within SLA window
  // "Escalated", // Future: escalated to a higher-tier specialist
];

// ─────────────────────────────────────────────
// Sub-schema: Individual doctor response
// Records every doctor's accept or decline for
// a given emergency request.
// ─────────────────────────────────────────────
const doctorResponseSchema = new mongoose.Schema(
  {
    // The doctor who responded (User._id with role "doctor")
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Whether the doctor accepted or declined
    action: {
      type: String,
      enum: {
        values: ["Accepted", "Declined"],
        message: "action must be Accepted or Declined",
      },
      required: true,
    },

    // ── Accept-specific fields ────────────────
    // Estimated time of arrival in minutes (optional, doctor-provided)
    eta: {
      type: Number,
      min: [1, "ETA must be at least 1 minute"],
      max: [480, "ETA cannot exceed 480 minutes (8 hours)"],
      default: null,
    },

    // ── Decline-specific fields ───────────────
    // Structured reason for declining (drives analytics without free-text noise)
    reasonType: {
      type: String,
      enum: {
        values: [
          "Unavailable",        // Doctor is currently busy / on-call elsewhere
          "OutOfSpecialization", // Emergency outside doctor's area of expertise
          "TooFar",             // Hospital location not reachable in time
          "Other",              // Custom reason provided in customReason
        ],
        message: "Invalid reasonType value",
      },
      default: null,
    },

    // Free-text reason — required when reasonType is "Other"
    customReason: {
      type: String,
      trim: true,
      maxlength: [300, "customReason cannot exceed 300 characters"],
      default: "",
    },

    // When the doctor submitted their response
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // Embedded sub-docs don't need their own _id
);

// ─────────────────────────────────────────────
// Sub-schema: Timeline entry for audit trail
// ─────────────────────────────────────────────
const timelineEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: EMERGENCY_STATUSES,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Sub-schema: AI recommendation result
// Kept separate so the AI module writes here
// cleanly without touching other fields.
//
// Future AI integration:
//   The AI module can write `recommendedSpecializations[0]` to
//   `requiredSpecialization` on the parent document after analysis.
//   No schema change is needed — the slot already exists.
// ─────────────────────────────────────────────
const aiRecommendationSchema = new mongoose.Schema(
  {
    recommendedSpecializations: {
      type: [String],
      default: [],
    },
    urgencyScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    urgencyLabel: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical", null],
      default: null,
    },
    reportSummary: {
      type: String,
      trim: true,
      default: "",
    },
    generatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────
const emergencyRequestSchema = new mongoose.Schema(
  {
    // ── Patient Information ──────────────────
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
      maxlength: [100, "Patient name cannot exceed 100 characters"],
    },

    patientAge: {
      type: Number,
      required: [true, "Patient age is required"],
      min: [0, "Age cannot be negative"],
      max: [130, "Age cannot exceed 130"],
    },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: {
        values: ["Male", "Female", "Other"],
        message: "Gender must be Male, Female, or Other",
      },
    },

    // ── Emergency Details ────────────────────
    emergencyType: {
      type: String,
      required: [true, "Emergency type is required"],
      trim: true,
      maxlength: [150, "Emergency type cannot exceed 150 characters"],
    },

    symptoms: {
      type: [String],
      required: [true, "At least one symptom is required"],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one symptom must be provided",
      },
    },

    severity: {
      type: String,
      required: [true, "Severity is required"],
      enum: {
        values: ["Low", "Medium", "High", "Critical"],
        message: "Severity must be Low, Medium, High, or Critical",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },

    // ── Required Specialization ──────────────
    // Selected by the hospital manager at request creation.
    // Only doctors whose Doctor.specialization matches this value
    // will receive the real-time emergency broadcast.
    //
    // AI integration path (no schema change needed):
    //   After aiRecommendation is generated, the AI module can suggest
    //   or override this field by writing:
    //     request.requiredSpecialization = aiRecommendation.recommendedSpecializations[0]
    //   This field is intentionally a simple String (not embedded in AI sub-schema)
    //   so it can be queried efficiently in Doctor.find({ specialization: value }).
    requiredSpecialization: {
      type: String,
      required: [true, "Required specialization is required"],
      enum: {
        values: SPECIALIZATIONS,
        message: `requiredSpecialization must be one of: ${SPECIALIZATIONS.join(", ")}`,
      },
      index: true, // queried on every emergency broadcast
    },

    // ── References ───────────────────────────
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Hospital reference is required"],
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Requesting user is required"],
    },

    // ── Doctor Responses ─────────────────────
    // Tracks every doctor's accept / decline for this emergency.
    // The hospital reads these to decide whom to confirm.
    // One doctor can only respond once — enforced in the controller.
    doctorResponses: {
      type: [doctorResponseSchema],
      default: [],
    },

    // ── Confirmed Doctor ─────────────────────
    // Set when the hospital calls confirmDoctor().
    // Triggers the existing formal assignment mechanism
    // (doctorAssignmentController.assignDoctorsToRequest).
    confirmedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Formal Assignment (existing) ─────────
    assignedDoctors: [
      {
        doctor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],

    // ── Status & Lifecycle ───────────────────
    status: {
      type: String,
      enum: {
        values: EMERGENCY_STATUSES,
        message: "Invalid status value",
      },
      default: "Pending",
      index: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    // ── Audit Trail ──────────────────────────
    timeline: {
      type: [timelineEntrySchema],
      default: [],
    },

    // ── AI Integration Slot ──────────────────
    // AI module writes here — no schema change needed later
    aiRecommendation: {
      type: aiRecommendationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
emergencyRequestSchema.index({ hospital: 1, status: 1 });
emergencyRequestSchema.index({ requestedBy: 1 });
emergencyRequestSchema.index({ severity: 1, status: 1 });
emergencyRequestSchema.index({ createdAt: -1 });
emergencyRequestSchema.index({ requiredSpecialization: 1, status: 1 }); // broadcast query

// ─────────────────────────────────────────────
// Pre-save: auto-set resolvedAt when terminal
// ─────────────────────────────────────────────
emergencyRequestSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    (this.status === "Completed" || this.status === "Cancelled") &&
    !this.resolvedAt
  ) {
    this.resolvedAt = new Date();
  }
  next();
});

// ─────────────────────────────────────────────
// Export constants so controllers can import
// them without re-declaring
// ─────────────────────────────────────────────
emergencyRequestSchema.statics.SPECIALIZATIONS = SPECIALIZATIONS;
emergencyRequestSchema.statics.STATUSES = EMERGENCY_STATUSES;

module.exports = mongoose.model("EmergencyRequest", emergencyRequestSchema);