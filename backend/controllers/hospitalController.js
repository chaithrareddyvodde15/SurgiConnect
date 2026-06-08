const Hospital = require("../models/Hospital");
const { validationResult } = require("express-validator");

// ─────────────────────────────────────────────
// Helper: format validation errors
// ─────────────────────────────────────────────
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return null;
};

// ─────────────────────────────────────────────
// @desc    Create a new hospital
// @route   POST /api/hospitals
// @access  Admin only
// ─────────────────────────────────────────────
const createHospital = async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const existing = await Hospital.findOne({
      $or: [
        { registrationNumber: req.body.registrationNumber?.toUpperCase() },
        { "contact.email": req.body.contact?.email?.toLowerCase() },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.registrationNumber === req.body.registrationNumber?.toUpperCase()
            ? "A hospital with this registration number already exists"
            : "A hospital with this email already exists",
      });
    }

    const hospital = await Hospital.create({
      ...req.body,
      createdBy: req.user._id, // from auth middleware
    });

    return res.status(201).json({
      success: true,
      message: "Hospital created successfully",
      data: hospital,
    });
  } catch (error) {
    console.error("createHospital error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `Duplicate value for field: ${field}`,
      });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all hospitals (with filters & pagination)
// @route   GET /api/hospitals
// @access  Admin, Hospital Manager
// ─────────────────────────────────────────────
const getAllHospitals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      city,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (status)  filter.status = status;
    if (type)    filter.type = type;
    if (city)    filter["address.city"] = { $regex: city, $options: "i" };
    if (search)  filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [hospitals, total] = await Promise.all([
      Hospital.find(filter)
        .populate("managers", "name email")
        .populate("createdBy", "name email")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Hospital.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Hospitals fetched successfully",
      data: hospitals,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getAllHospitals error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get hospital by ID
// @route   GET /api/hospitals/:id
// @access  Admin, Hospital Manager
// ─────────────────────────────────────────────
const getHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .populate("managers", "name email phone")
      .populate("doctors",  "name email specialization")
      .populate("createdBy","name email");

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Hospital fetched successfully",
      data: hospital,
    });
  } catch (error) {
    console.error("getHospitalById error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid hospital ID format" });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Update hospital
// @route   PUT /api/hospitals/:id
// @access  Admin only
// ─────────────────────────────────────────────
const updateHospital = async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    // Prevent overwriting protected fields
    const { createdBy, doctors, ...updateData } = req.body;

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("managers", "name email")
      .populate("createdBy", "name email");

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Hospital updated successfully",
      data: hospital,
    });
  } catch (error) {
    console.error("updateHospital error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid hospital ID format" });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ success: false, message: `Duplicate value for: ${field}` });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Delete hospital (soft delete via status)
// @route   DELETE /api/hospitals/:id
// @access  Admin only
// ─────────────────────────────────────────────
const deleteHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    // Soft delete — mark as Suspended instead of removing from DB
    hospital.status = "Suspended";
    await hospital.save();

    return res.status(200).json({
      success: true,
      message: "Hospital suspended (soft deleted) successfully",
      data: { id: hospital._id, status: hospital.status },
    });
  } catch (error) {
    console.error("deleteHospital error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid hospital ID format" });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Assign a manager to a hospital
// @route   PATCH /api/hospitals/:id/assign-manager
// @access  Admin only
// ─────────────────────────────────────────────
const assignManager = async (req, res) => {
  try {
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({ success: false, message: "managerId is required" });
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { managers: managerId } }, // addToSet prevents duplicates
      { new: true }
    ).populate("managers", "name email");

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Manager assigned successfully",
      data: hospital,
    });
  } catch (error) {
    console.error("assignManager error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  createHospital,
  getAllHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  assignManager,
};