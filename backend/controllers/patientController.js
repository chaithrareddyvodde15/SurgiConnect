"use strict";

const mongoose = require("mongoose");
const Patient  = require("../models/patientModel");
const User     = require("../models/userModel");

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get the authenticated patient's own profile
// @route   GET /api/patients/me
// @access  Patient role (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyProfile = async (req, res) => {
  try {
    if (!req.user.patientId) {
      return res.status(404).json({
        success: false,
        message: "No patient profile linked to this account",
      });
    }

    const patient = await Patient.findById(req.user.patientId)
      .populate("userId", "name email phone isActive createdAt");

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient profile not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Patient profile fetched successfully",
      data:    patient,
    });
  } catch (error) {
    console.error("getMyProfile (patient) error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update the authenticated patient's own profile
//          Fields allowed: phone, gender, dateOfBirth.
//          Email and password changes are handled via dedicated auth endpoints
//          (not yet implemented, intentionally excluded here).
//
// @route   PATCH /api/patients/me
// @access  Patient role (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateMyProfile = async (req, res) => {
  try {
    if (!req.user.patientId) {
      return res.status(404).json({
        success: false,
        message: "No patient profile linked to this account",
      });
    }

    const { phone, gender, dateOfBirth, name } = req.body;

    // ── Validate gender if provided ───────────────────────────────────────────
    if (gender && !["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "gender must be Male, Female, or Other",
      });
    }

    // ── Validate dateOfBirth if provided ──────────────────────────────────────
    let dob;
    if (dateOfBirth) {
      dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime()) || dob >= new Date()) {
        return res.status(400).json({
          success: false,
          message: "dateOfBirth must be a valid date in the past",
        });
      }
    }

    // ── Validate phone if provided ────────────────────────────────────────────
    if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number",
      });
    }

    // ── Build Patient update payload ──────────────────────────────────────────
    const patientUpdate = {};
    if (phone)  patientUpdate.phone       = phone;
    if (gender) patientUpdate.gender      = gender;
    if (dob)    patientUpdate.dateOfBirth = dob;

    // ── Build User update payload (name, phone synced) ────────────────────────
    const userUpdate = {};
    if (name)  userUpdate.name  = name;
    if (phone) userUpdate.phone = phone;

    // ── Apply updates ─────────────────────────────────────────────────────────
    const [patient] = await Promise.all([
      Patient.findByIdAndUpdate(
        req.user.patientId,
        { $set: patientUpdate },
        { new: true, runValidators: true }
      ).populate("userId", "name email phone"),

      Object.keys(userUpdate).length > 0
        ? User.findByIdAndUpdate(req.user._id, { $set: userUpdate })
        : Promise.resolve(),
    ]);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient profile not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Patient profile updated successfully",
      data:    patient,
    });
  } catch (error) {
    console.error("updateMyProfile (patient) error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a patient by ID (admin / internal use)
// @route   GET /api/patients/:id
// @access  Hospital role
// ─────────────────────────────────────────────────────────────────────────────
exports.getPatientById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid patient ID" });
    }

    const patient = await Patient.findById(req.params.id)
      .populate("userId", "name email phone isActive createdAt");

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    return res.status(200).json({
      success: true,
      data:    patient,
    });
  } catch (error) {
    console.error("getPatientById error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};