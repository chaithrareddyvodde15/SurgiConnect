const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Sub-schema: Timeline entry for audit trail
// ─────────────────────────────────────────────
const timelineEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["Pending", "Assigned", "In Progress", "Completed", "Cancelled"],
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
// Kept separate so AI module writes here cleanly
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
      min: [0,   "Age cannot be negative"],
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
          // e.g. "Lead Surgeon", "Anesthesiologist"
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
        values: ["Pending", "Assigned", "In Progress", "Completed", "Cancelled"],
        message: "Invalid status value",
      },
      default: "Pending",
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

// ─────────────────────────────────────────────
// Pre-save: auto-set resolvedAt when Completed
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

module.exports = mongoose.model("EmergencyRequest", emergencyRequestSchema);