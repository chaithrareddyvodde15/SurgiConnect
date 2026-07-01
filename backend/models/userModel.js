"use strict";

const mongoose = require("mongoose");

/**
 * User Model — Authentication & Role Identity
 *
 * Roles:
 *   "hospital" — replaces the old "manager" role. Represents a hospital
 *                administrator who creates emergency requests, receives doctor
 *                responses, and confirms assignments. Linked to a Hospital
 *                document via `hospitalId`.
 *   "doctor"   — individual clinician. Linked to a Doctor document via
 *                `doctorId` (managed by doctorModel.js userId field).
 *   "patient"  — patient user who can browse doctors and book appointments.
 *                Linked to a Patient document via `patientId`.
 *
 * Migration note:
 *   The previous "manager" role is replaced by "hospital". All emergency
 *   request, notification, and audit-log documents that referenced a User with
 *   role "manager" are now understood to be hospital accounts. No data
 *   migration is required — those documents remain valid; only new registrations
 *   use "hospital". The role enum no longer includes "manager".
 */

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },

    password: {
      type:     String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select:   false, // never returned by default — always explicitly selected
    },

    // ── Role ─────────────────────────────────────────────────────────────────
    /**
     * "hospital" replaces the legacy "manager" role.
     * All role-guard middleware in routes uses "hospital" going forward.
     */
    role: {
      type:     String,
      enum:     {
        values:  ["hospital", "doctor", "patient"],
        message: "role must be hospital, doctor, or patient",
      },
      required: [true, "Role is required"],
      index:    true,
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: {
      type:    String,
      trim:    true,
      match:   [/^\+?[0-9]{7,15}$/, "Please enter a valid phone number"],
      default: null,
    },

    // ── Profile document links (one per role) ─────────────────────────────────
    /**
     * Set during registration for hospital users.
     * Points to the Hospital document that owns this account.
     * Populated by authMiddleware when role === "hospital".
     */
    hospitalId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Hospital",
      default: null,
    },

    /**
     * Set during registration for patient users.
     * Points to the Patient document for this account.
     * Populated by authMiddleware when role === "patient".
     */
    patientId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Patient",
      default: null,
    },

    // doctorId is not stored here — the Doctor model stores userId → User._id.
    // Use Doctor.findOne({ userId: user._id }) to get the doctor profile.

    // ── Account state ─────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
      index:   true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model("User", userSchema);