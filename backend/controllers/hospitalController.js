const Hospital = require("../models/Hospital");
const { validationResult } = require("express-validator");

// ─────────────────────────────────────────────
// Helper: Validation Errors
// ─────────────────────────────────────────────
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  return null;
};

// ─────────────────────────────────────────────
// Create Hospital
// POST /api/hospitals
// ─────────────────────────────────────────────
const createHospital = async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const existing = await Hospital.findOne({
      $or: [
        {
          registrationNumber:
            req.body.registrationNumber?.toUpperCase(),
        },
        {
          "contact.email":
            req.body.contact?.email?.toLowerCase(),
        },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.registrationNumber ===
          req.body.registrationNumber?.toUpperCase()
            ? "Hospital registration number already exists"
            : "Hospital email already exists",
      });
    }

    const hospital = await Hospital.create({
      ...req.body,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Hospital created successfully",
      data: hospital,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Get Logged-in Hospital Profile
// GET /api/hospitals/profile
// ─────────────────────────────────────────────
const getHospitalProfile = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({
      createdBy: req.user._id,
    })
      .populate("managers", "name email phone")
      .populate("doctors", "name email")
      .populate("createdBy", "name email");

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: hospital,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Update Logged-in Hospital Profile
// PATCH /api/hospitals/profile
// ─────────────────────────────────────────────
const updateHospitalProfile = async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const hospital = await Hospital.findOne({
      createdBy: req.user._id,
    });

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital profile not found",
      });
    }

    const {
      name,
      registrationNumber,
      type,
      status,
      contact,
      address,
      facilities,
      specializations,
      location,
    } = req.body;

    // Name
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Hospital name cannot be empty",
        });
      }

      hospital.name = name.trim();
    }

    // Registration Number
    if (registrationNumber !== undefined) {
      if (!registrationNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: "Registration number cannot be empty",
        });
      }

      hospital.registrationNumber =
        registrationNumber.trim().toUpperCase();
    }

    // Type
    if (type !== undefined) {
      const validTypes = [
        "Government",
        "Private",
        "Semi-Government",
        "Trust",
        "Clinic",
      ];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hospital type",
        });
      }

      hospital.type = type;
    }

    // Status
    if (status !== undefined) {
      const validStatus = [
        "Active",
        "Inactive",
        "Suspended",
      ];

      if (!validStatus.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hospital status",
        });
      }

      hospital.status = status;
    }

    // Contact
    if (contact) {
      hospital.contact = {
        ...hospital.contact,
        ...contact,
      };
    }

    // Address
    if (address) {
      hospital.address = {
        ...hospital.address,
        ...address,
      };
    }

    // Facilities
    if (facilities) {
      hospital.facilities = {
        ...hospital.facilities,
        ...facilities,
      };
    }

    // Specializations
    if (specializations !== undefined) {
      hospital.specializations = specializations;
    }

    // Location
    if (location) {
      hospital.location = {
        ...hospital.location,
        ...location,
      };
    }

    await hospital.save();

    const updatedHospital = await Hospital.findById(hospital._id)
      .populate("managers", "name email phone")
      .populate("doctors", "name email")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Hospital profile updated successfully",
      data: updatedHospital,
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];

      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Get All Hospitals
// GET /api/hospitals
// ─────────────────────────────────────────────
const getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate("managers", "name email")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: hospitals,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Get Hospital By ID
// GET /api/hospitals/:id
// ─────────────────────────────────────────────
const getHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .populate("managers", "name email phone")
      .populate("doctors", "name email")
      .populate("createdBy", "name email");

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    res.status(200).json({
      success: true,
      data: hospital,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Update Hospital By ID
// PUT /api/hospitals/:id
// ─────────────────────────────────────────────
const updateHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Hospital updated successfully",
      data: hospital,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Soft Delete Hospital
// DELETE /api/hospitals/:id
// ─────────────────────────────────────────────
const deleteHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    hospital.status = "Suspended";

    await hospital.save();

    res.status(200).json({
      success: true,
      message: "Hospital suspended successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// Assign Manager
// PATCH /api/hospitals/:id/assign-manager
// ─────────────────────────────────────────────
const assignManager = async (req, res) => {
  try {
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: "managerId is required",
      });
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: {
          managers: managerId,
        },
      },
      {
        new: true,
      }
    ).populate("managers", "name email");

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager assigned successfully",
      data: hospital,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createHospital,
  getHospitalProfile,
  updateHospitalProfile,
  getAllHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  assignManager,
};