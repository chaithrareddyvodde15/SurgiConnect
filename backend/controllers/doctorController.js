"use strict";

/**
 * doctorController.js
 *
 * Populate fix note:
 * Doctor.populate("userId") requires the `ref` value in doctorModel.js to
 * exactly match the registered model name. The User model is registered as
 * mongoose.model("User", userSchema) and the Doctor schema must declare:
 *   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
 * Both models are explicitly required at the top of this file to guarantee
 * Mongoose has registered "User" before any populate call is executed,
 * regardless of import order elsewhere in the application.
 */

const mongoose = require("mongoose");

// Require User FIRST — guarantees "User" is registered in Mongoose's model
// registry before Doctor.populate("userId") is called anywhere in this file.
const User     = require("../models/userModel");
const Doctor   = require("../models/doctorModel");
const Hospital = require("../models/Hospital");

// ─────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────
const VALID_SPECIALIZATIONS = [
  "Cardiology",
  "Neurology",
  "Neurosurgery",
  "Orthopedics",
  "Anesthesiology",
  "Critical Care",
  "Pediatrics",
  "General Surgery",
];

const VALID_AVAILABILITY = ["Available", "Unavailable", "On-Call"];

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update the authenticated doctor's availability and future leaves
// @route   PUT /api/doctors/availability
// @access  Doctor
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAvailability = async (req, res) => {
  try {
    const { availability, futureLeaves } = req.body;

    if (availability && !VALID_AVAILABILITY.includes(availability)) {
      return res.status(400).json({
        success: false,
        message: `availability must be one of: ${VALID_AVAILABILITY.join(", ")}`,
      });
    }

    const updatePayload = {};
    if (availability !== undefined) updatePayload.availability = availability;
    if (futureLeaves !== undefined) updatePayload.futureLeaves = futureLeaves;

    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updatePayload },
      { new: true, upsert: true, runValidators: true }
    ).populate("userId", "name email phone role isActive");

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data:    doctor,
    });
  } catch (error) {
    console.error("updateAvailability error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all doctors with rich filtering
//          Consumed by hospitals (admin view), patients (doctor discovery),
//          and doctors (view colleagues).
//
// @route   GET /api/doctors
// @access  All authenticated roles
//
// Query parameters:
//   specialization  — exact match,  e.g. "Cardiology"
//   availability    — "Available" | "Unavailable" | "On-Call"
//   verified        — "true" | "false"
//   minFee          — minimum consultation fee (inclusive)
//   maxFee          — maximum consultation fee (inclusive)
//   q               — name search (partial, case-insensitive)
//   page            — default 1
//   limit           — default 10, max 50
//   sortBy          — "fee" | "createdAt"  (default: "createdAt")
//   order           — "asc" | "desc"       (default: "desc")
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctors = async (req, res) => {
  try {
    const {
      specialization,
      availability,
      verified,
      minFee,
      maxFee,
      q,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // -----------------------------
    // Build Doctor Filter
    // -----------------------------
    const doctorFilter = {};

    if (specialization) {
      if (!VALID_SPECIALIZATIONS.includes(specialization)) {
        return res.status(400).json({
          success: false,
          message: `specialization must be one of: ${VALID_SPECIALIZATIONS.join(", ")}`,
        });
      }

      doctorFilter.specialization = specialization;
    }

    if (availability) {
      if (!VALID_AVAILABILITY.includes(availability)) {
        return res.status(400).json({
          success: false,
          message: `availability must be one of: ${VALID_AVAILABILITY.join(", ")}`,
        });
      }

      doctorFilter.availability = availability;
    }

    if (verified !== undefined) {
      doctorFilter.verified = verified === "true";
    }

    if (minFee !== undefined || maxFee !== undefined) {
      doctorFilter.fee = {};

      if (minFee !== undefined) {
        const min = Number(minFee);

        if (isNaN(min)) {
          return res.status(400).json({
            success: false,
            message: "minFee must be a valid number",
          });
        }

        doctorFilter.fee.$gte = min;
      }

      if (maxFee !== undefined) {
        const max = Number(maxFee);

        if (isNaN(max)) {
          return res.status(400).json({
            success: false,
            message: "maxFee must be a valid number",
          });
        }

        doctorFilter.fee.$lte = max;
      }
    }

    // -----------------------------
    // Search by Doctor Name
    // -----------------------------
    if (q && q.trim()) {
      const matchingUsers = await User.find({
        name: {
          $regex: q.trim(),
          $options: "i",
        },
        role: "doctor",
      }).select("_id");

      doctorFilter.userId = {
        $in: matchingUsers.map((u) => u._id),
      };
    }

    // -----------------------------
    // Pagination
    // -----------------------------
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = sortBy === "fee" ? "fee" : "createdAt";

    // -----------------------------
    // Fetch Doctors
    // -----------------------------
    const [doctors, total] = await Promise.all([
      Doctor.find(doctorFilter)
        .populate("userId", "name email phone role isActive createdAt")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Doctor.countDocuments(doctorFilter),
    ]);

    // -----------------------------
    // Remove orphan doctor records
    // -----------------------------
    const validDoctors = doctors.filter((doctor) => doctor.userId);

    return res.status(200).json({
      success: true,
      message: "Doctors fetched successfully",
      data: validDoctors,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error("getDoctors error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single doctor's full profile by Doctor document _id
//          Returns doctor profile + User details + hospital affiliation.
//          Used by patients on doctor detail pages and by the emergency system.
//
// @route   GET /api/doctors/:id
// @access  All authenticated roles
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Doctor ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID",
      });
    }

    // Find Doctor
    const doctor = await Doctor.findById(id)
      .populate("userId", "name email phone role isActive createdAt updatedAt")
      .lean();

    // Doctor doesn't exist OR linked user deleted
    if (!doctor || !doctor.userId) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // User account inactive
    if (doctor.userId.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Doctor account is inactive",
      });
    }

    // Find Hospital associated with doctor
    const hospital = await Hospital.findOne({
      doctors: doctor.userId._id,
      status: "Active",
    })
      .select("name address contact.phone")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Doctor profile fetched successfully",
      data: {
        ...doctor,
        hospital: hospital || null,
      },
    });

  } catch (error) {
    console.error("getDoctorById error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update the authenticated doctor's own profile
//          Updates specialization and fee on the Doctor document.
//          Updates name and phone on the linked User document.
//
// @route   PATCH /api/doctors/profile
// @access  Doctor
// ─────────────────────────────────────────────────────────────────────────────
exports.updateDoctorProfile = async (req, res) => {
  try {
    const { specialization, fee, name, phone } = req.body;

    // ─────────────────────────────────────────────────────────────
    // Validate specialization
    // ─────────────────────────────────────────────────────────────
    if (
      specialization !== undefined &&
      !VALID_SPECIALIZATIONS.includes(specialization)
    ) {
      return res.status(400).json({
        success: false,
        message: `specialization must be one of: ${VALID_SPECIALIZATIONS.join(", ")}`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Validate fee
    // ─────────────────────────────────────────────────────────────
    if (fee !== undefined) {
      const feeNum = Number(fee);

      if (isNaN(feeNum) || feeNum < 0) {
        return res.status(400).json({
          success: false,
          message: "fee must be a non-negative number",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validate name
    // ─────────────────────────────────────────────────────────────
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validate phone
    // ─────────────────────────────────────────────────────────────
    if (phone !== undefined) {
      if (phone.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Phone number cannot be empty",
        });
      }

      const phoneRegex = /^\+?[0-9]{7,15}$/;

      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Prepare updates
    // ─────────────────────────────────────────────────────────────
    const doctorUpdate = {};

    if (specialization !== undefined)
      doctorUpdate.specialization = specialization;

    if (fee !== undefined)
      doctorUpdate.fee = Number(fee);

    const userUpdate = {};

    if (name !== undefined)
      userUpdate.name = name.trim();

    if (phone !== undefined)
      userUpdate.phone = phone.trim();

    // ─────────────────────────────────────────────────────────────
    // Update Doctor Profile
    // ─────────────────────────────────────────────────────────────
    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      { $set: doctorUpdate },
      {
        new: true,
        runValidators: true,
      }
    ).populate(
      "userId",
      "name email phone role isActive createdAt"
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Update User Profile
    // ─────────────────────────────────────────────────────────────
    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: userUpdate,
        },
        {
          new: true,
          runValidators: true,
        }
      );
    }

    // Fetch latest profile
    const updatedDoctor = await Doctor.findById(doctor._id).populate(
      "userId",
      "name email phone role isActive createdAt"
    );

    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    console.error("updateDoctorProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};