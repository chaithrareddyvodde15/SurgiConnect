const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Sub-Schema: Request Context
// Captures HTTP metadata for security monitoring
// and compliance tracking
// ─────────────────────────────────────────────
const requestContextSchema = new mongoose.Schema(
  {
    ipAddress: {
      type:    String,
      trim:    true,
      default: "",
    },
    userAgent: {
      type:    String,
      trim:    true,
      default: "",
    },
    method: {
      type:    String,
      trim:    true,
      default: "",
    },
    endpoint: {
      type:    String,
      trim:    true,
      default: "",
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Sub-Schema: Change Diff
// Stores before/after values for UPDATE actions
// Ready for AI activity analysis and compliance
// ─────────────────────────────────────────────
const changeDiffSchema = new mongoose.Schema(
  {
    before: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Main AuditLog Schema
// ─────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    // ── Who performed the action ─────────────
    user: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   "User",
      index: true,
      // Nullable: system-generated logs have no user
      default: null,
    },

    // ── What action was performed ────────────
    action: {
      type: String,
      enum: {
        values: [
          "CREATE",
          "UPDATE",
          "DELETE",
          "ASSIGN",
          "LOGIN",
          "LOGOUT",
          "STATUS_CHANGE",
          // Future-ready actions
          "EXPORT",
          "IMPORT",
          "AI_RECOMMENDATION",
          "AI_URGENCY_PREDICTION",
          "PASSWORD_CHANGE",
          "PERMISSION_CHANGE",
        ],
        message: "Invalid action type: {VALUE}",
      },
      required: [true, "Action is required"],
      index:    true,
    },

    // ── What type of entity was affected ─────
    entityType: {
      type: String,
      enum: {
        values: [
          "User",
          "Doctor",
          "Hospital",
          "EmergencyRequest",
          "Notification",
          // Future-ready entity types
          "AuditLog",
          "System",
        ],
        message: "Invalid entity type: {VALUE}",
      },
      required: [true, "Entity type is required"],
      index:    true,
    },

    // ── Which specific entity was affected ───
    entityId: {
      type:    mongoose.Schema.Types.ObjectId,
      index:   true,
      default: null,
    },

    // ── Human-readable summary ───────────────
    description: {
      type:      String,
      required:  [true, "Description is required"],
      trim:      true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // ── Flexible key-value metadata ──────────
    // Stores action-specific data without schema changes
    // e.g. { severity: "Critical", previousStatus: "Pending" }
    metadata: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Before / After diff for UPDATE actions
    changeDiff: {
      type:    changeDiffSchema,
      default: () => ({}),
    },

    // ── HTTP request context ─────────────────
    // For security monitoring and compliance
    requestContext: {
      type:    requestContextSchema,
      default: () => ({}),
    },

    // ── Outcome of the action ────────────────
    status: {
      type: String,
      enum: {
        values: ["SUCCESS", "FAILURE", "WARNING"],
        message: "Status must be SUCCESS, FAILURE, or WARNING",
      },
      default: "SUCCESS",
      index:   true,
    },

    // ── Risk classification ──────────────────
    // Ready for AI security analysis
    riskLevel: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High", "Critical"],
        message: "Invalid risk level",
      },
      default: "Low",
      index:   true,
    },
  },
  {
    // createdAt only — audit logs are immutable, no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─────────────────────────────────────────────
// Compound Indexes
// Optimized for the 6 query patterns used in controller
// ─────────────────────────────────────────────
auditLogSchema.index({ user: 1,        createdAt: -1 });
auditLogSchema.index({ entityType: 1,  entityId: 1   });
auditLogSchema.index({ action: 1,      createdAt: -1 });
auditLogSchema.index({ status: 1,      createdAt: -1 });
auditLogSchema.index({ riskLevel: 1,   createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────
// Immutability Guard
// Audit logs must NEVER be modified after creation
// ─────────────────────────────────────────────
auditLogSchema.pre("save", function (next) {
  if (!this.isNew) {
    const err = new Error("Audit logs are immutable and cannot be modified");
    err.status = 403;
    return next(err);
  }
  next();
});

// Block findOneAndUpdate / updateMany on audit logs
auditLogSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function (next) {
    const err = new Error("Audit logs cannot be updated");
    err.status = 403;
    next(err);
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);