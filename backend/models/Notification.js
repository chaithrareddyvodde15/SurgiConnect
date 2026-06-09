const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Delivery Channel Sub-Schema
// Ready for Email / SMS / Socket.IO integration
// ─────────────────────────────────────────────
const deliveryStatusSchema = new mongoose.Schema(
  {
    inApp: {
      sent: { type: Boolean, default: true },
      sentAt: { type: Date, default: Date.now },
    },

    // ── Email (future) ──────────────────────
    email: {
      enabled: { type: Boolean, default: false },
      sent:    { type: Boolean, default: false },
      sentAt:  { type: Date,    default: null  },
      error:   { type: String,  default: ""    },
    },

    // ── SMS (future) ────────────────────────
    sms: {
      enabled: { type: Boolean, default: false },
      sent:    { type: Boolean, default: false },
      sentAt:  { type: Date,    default: null  },
      error:   { type: String,  default: ""    },
    },

    // ── Socket.IO (future) ──────────────────
    socket: {
      enabled:   { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      socketId:  { type: String,  default: ""    },
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// AI Metadata Sub-Schema
// Ready for AI recommendation / urgency alerts
// ─────────────────────────────────────────────
const aiMetadataSchema = new mongoose.Schema(
  {
    isAiGenerated:          { type: Boolean, default: false },

    // AI Doctor Recommendation alert
    recommendedSpecializations: { type: [String], default: [] },

    // AI Urgency Prediction alert
    urgencyScore: {
      type: Number,
      min:  0,
      max:  100,
      default: null,
    },
    urgencyLabel: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical", null],
      default: null,
    },

    // Which AI feature generated this notification
    aiSource: {
      type: String,
      enum: [
        "DoctorRecommendation",
        "UrgencyPrediction",
        "ReportSummarization",
        "HospitalChatbot",
        null,
      ],
      default: null,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Main Notification Schema
// ─────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    // ── Core Recipients ──────────────────────
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Recipient is required"],
      index:    true,
    },

    // ── Linked Emergency Request ─────────────
    emergencyRequest: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "EmergencyRequest",
      default: null,
    },

    // ── Content ──────────────────────────────
    title: {
      type:      String,
      required:  [true, "Title is required"],
      trim:      true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    message: {
      type:      String,
      required:  [true, "Message is required"],
      trim:      true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },

    type: {
      type: String,
      enum: {
        values: [
          "EmergencyCreated",
          "DoctorAssigned",
          "EmergencyUpdated",
          "EmergencyCompleted",
          "General",
          // AI alert types — ready for future use
          "AIDoctorRecommendation",
          "AIUrgencyAlert",
        ],
        message: "Invalid notification type",
      },
      required: [true, "Notification type is required"],
      index:    true,
    },

    // ── Read State ───────────────────────────
    isRead: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    readAt: {
      type:    Date,
      default: null,
    },

    // ── Sender (optional, for audit) ─────────
    createdBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ── Delivery Channels ────────────────────
    // Future: email, SMS, Socket.IO
    delivery: {
      type:    deliveryStatusSchema,
      default: () => ({}),
    },

    // ── AI Metadata ──────────────────────────
    // Future: AI recommendation & urgency alerts
    aiMetadata: {
      type:    aiMetadataSchema,
      default: () => ({}),
    },

    // ── Soft Delete ──────────────────────────
    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─────────────────────────────────────────────
// Compound Indexes
// ─────────────────────────────────────────────
notificationSchema.index({ recipient: 1, isRead: 1, isDeleted: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ emergencyRequest: 1 });

// ─────────────────────────────────────────────
// Pre-save: set readAt when isRead flips to true
// ─────────────────────────────────────────────
notificationSchema.pre("save", function (next) {
  if (this.isModified("isRead") && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  if (this.isModified("isDeleted") && this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

// ─────────────────────────────────────────────
// Query Helper: always exclude soft-deleted docs
// ─────────────────────────────────────────────
notificationSchema.pre(/^find/, function (next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model("Notification", notificationSchema);