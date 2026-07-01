"use strict";

const mongoose = require("mongoose");

/**
 * Patient Model — Profile document linked to User (role: "patient")
 *
 * Scope (v1): authentication + basic profile only.
 * Future versions will add: bloodGroup, medicalHistory, allergies,
 * insurance, emergency contacts, appointment history.
 *
 * Relationship: Patient.userId → User._id (one-to-one)
 * Auth middleware populates req.user.patientProfile from this model.
 */
const patientSchema = new mongoose.Schema(
  {
    // ── Link to User account ─────────────────────────────────────────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "User reference is required"],
      unique:   true,
      index:    true,
    },

    // ── Basic profile ─────────────────────────────────────────────────────────
    phone: {
      type:    String,
      trim:    true,
      match:   [/^\+?[0-9]{7,15}$/, "Please enter a valid phone number"],
      default: null,
    },

    gender: {
      type: String,
      enum: {
        values:  ["Male", "Female", "Other"],
        message: "Gender must be Male, Female, or Other",
      },
      required: [true, "Gender is required"],
    },

    dateOfBirth: {
      type:     Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: (v) => v < new Date(),
        message:   "Date of birth must be in the past",
      },
    },

    // ── Placeholder sub-documents (to be populated in future versions) ────────
    // bloodGroup, medicalHistory, allergies, emergencyContact, insurance
    // are intentionally omitted from v1 per product specification.
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtual: age (computed from dateOfBirth) ──────────────────────────────────
patientSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - this.dateOfBirth.getFullYear();
  const m = today.getMonth() - this.dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < this.dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
});

module.exports = mongoose.model("Patient", patientSchema);