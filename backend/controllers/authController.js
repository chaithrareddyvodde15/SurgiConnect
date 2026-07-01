"use strict";

const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");
const mongoose = require("mongoose");

const User     = require("../models/userModel");
const Hospital = require("../models/Hospital");
const Patient  = require("../models/patientModel");
const Doctor   = require("../models/doctorModel");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Sign a JWT valid for 1 day */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });

/**
 * Build the public user payload returned on login / register.
 * Role-specific profile is embedded so clients don't need a second request.
 */
const buildUserPayload = (user, profile = null) => ({
  _id:       user._id,
  name:      user.name,
  email:     user.email,
  role:      user.role,
  phone:     user.phone || null,
  isActive:  user.isActive,
  createdAt: user.createdAt,
  // Role-specific profile embedded under a typed key
  ...(user.role === "hospital" && { hospitalProfile: profile }),
  ...(user.role === "patient"  && { patientProfile:  profile }),
  ...(user.role === "doctor"   && { doctorProfile:   profile }),
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a Hospital
//          Creates User (role: hospital) + Hospital document atomically.
//          The Hospital owner account email is the User email; the hospital's
//          public contact email is supplied in the body under contact.email.
//
// @route   POST /api/auth/register/hospital
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.registerHospital = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      // User account fields
      name,
      email,
      password,
      phone,
      // Hospital document fields
      hospitalName,
      registrationNumber,
      type,
      contact,        // { phone, email, emergencyLine }
      address,        // { street, city, state, zip, country }
      specializations,
      facilities,
    } = req.body;

    // ── 1. Required field validation ──────────────────────────────────────────
    if (!name || !email || !password || !hospitalName || !registrationNumber || !type) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "name, email, password, hospitalName, registrationNumber, and type are required",
      });
    }

    if (!contact?.phone || !contact?.email) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "contact.phone and contact.email are required",
      });
    }

    if (!address?.street || !address?.city || !address?.state || !address?.zip) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "address.street, address.city, address.state, and address.zip are required",
      });
    }

    // ── 2. Check for duplicates before creating anything ──────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const existingHospital = await Hospital.findOne({
      $or: [
        { registrationNumber: registrationNumber.toUpperCase() },
        { "contact.email": contact.email.toLowerCase() },
      ],
    }).session(session);

    if (existingHospital) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message:
          existingHospital.registrationNumber === registrationNumber.toUpperCase()
            ? "A hospital with this registration number already exists"
            : "A hospital with this contact email already exists",
      });
    }

    // ── 3. Hash password ───────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── 4. Create User (role: "hospital") ─────────────────────────────────────
    const [user] = await User.create(
      [
        {
          name,
          email,
          password:   hashedPassword,
          role:       "hospital",
          phone:      phone || null,
          hospitalId: null, // will be set after hospital doc is created
        },
      ],
      { session }
    );

    // ── 5. Create Hospital document ────────────────────────────────────────────
    const [hospital] = await Hospital.create(
      [
        {
          name:               hospitalName,
          registrationNumber: registrationNumber.toUpperCase(),
          type,
          contact: {
            phone:         contact.phone,
            email:         contact.email.toLowerCase(),
            emergencyLine: contact.emergencyLine || undefined,
          },
          address: {
            street:  address.street,
            city:    address.city,
            state:   address.state,
            zip:     address.zip,
            country: address.country || "India",
          },
          specializations: specializations || [],
          facilities:      facilities      || {},
          managers:        [user._id], // owner is the first manager
          createdBy:       user._id,
        },
      ],
      { session }
    );

    // ── 6. Link hospitalId back to User ────────────────────────────────────────
    user.hospitalId = hospital._id;
    await user.save({ session });

    // ── 7. Commit transaction ──────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    const token   = generateToken(user._id);
    const payload = buildUserPayload(user, hospital);

    return res.status(201).json({
      success: true,
      message: "Hospital registered successfully",
      token,
      user:    payload,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("registerHospital error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      return res.status(409).json({ success: false, message: `Duplicate value for: ${field}` });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a Patient
//          Creates User (role: patient) + Patient profile document atomically.
//
// @route   POST /api/auth/register/patient
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.registerPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password, phone, gender, dateOfBirth } = req.body;

    // ── 1. Required field validation ──────────────────────────────────────────
    if (!name || !email || !password || !gender || !dateOfBirth) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "name, email, password, gender, and dateOfBirth are required",
      });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob >= new Date()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "dateOfBirth must be a valid date in the past",
      });
    }

    // ── 2. Duplicate check ─────────────────────────────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    // ── 3. Hash password ───────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── 4. Create User (role: "patient") ──────────────────────────────────────
    const [user] = await User.create(
      [
        {
          name,
          email,
          password:  hashedPassword,
          role:      "patient",
          phone:     phone || null,
          patientId: null, // set after Patient doc is created
        },
      ],
      { session }
    );

    // ── 5. Create Patient profile ──────────────────────────────────────────────
    const [patient] = await Patient.create(
      [
        {
          userId:      user._id,
          phone:       phone || null,
          gender,
          dateOfBirth: dob,
        },
      ],
      { session }
    );

    // ── 6. Link patientId back to User ─────────────────────────────────────────
    user.patientId = patient._id;
    await user.save({ session });

    // ── 7. Commit ──────────────────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    const token   = generateToken(user._id);
    const payload = buildUserPayload(user, patient);

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      token,
      user:    payload,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("registerPatient error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      return res.status(409).json({ success: false, message: `Duplicate value for: ${field}` });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a Doctor (existing flow — unchanged)
//          Creates User (role: doctor). Doctor profile doc is created
//          separately via the doctor profile endpoint.
//
// @route   POST /api/auth/register/doctor
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.registerDoctor = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role:     "doctor",
      phone:    phone || null,
    });

    const token   = generateToken(user._id);
    const payload = buildUserPayload(user, null);

    return res.status(201).json({
      success: true,
      message: "Doctor registered successfully",
      token,
      user:    payload,
    });
  } catch (error) {
    console.error("registerDoctor error:", error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Unified Login
//          Single endpoint for all roles. The backend determines the role
//          automatically from the User document and returns the appropriate
//          populated profile in the response.
//
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    // ── 1. Find user + include password for comparison ─────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact support." });
    }

    // ── 2. Verify password ─────────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ── 3. Load role-specific profile ─────────────────────────────────────────
    let profile = null;

    if (user.role === "hospital" && user.hospitalId) {
      profile = await Hospital.findById(user.hospitalId)
        .populate("managers", "name email")
        .lean();
    } else if (user.role === "patient" && user.patientId) {
      profile = await Patient.findById(user.patientId).lean();
    } else if (user.role === "doctor") {
      profile = await Doctor.findOne({ userId: user._id }).lean();
    }

    // ── 4. Sign token and respond ──────────────────────────────────────────────
    const token   = generateToken(user._id);
    const payload = buildUserPayload(user, profile);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: payload,
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current authenticated user with full profile
// @route   GET /api/auth/me
// @access  Private (all roles)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    // req.user is set by authMiddleware (without password, without profile)
    const user = req.user;

    let profile = null;

    if (user.role === "hospital" && user.hospitalId) {
      profile = await Hospital.findById(user.hospitalId)
        .populate("managers", "name email")
        .lean();
    } else if (user.role === "patient" && user.patientId) {
      profile = await Patient.findById(user.patientId).lean();
    } else if (user.role === "doctor") {
      profile = await Doctor.findOne({ userId: user._id }).lean();
    }

    return res.status(200).json({
      success: true,
      user: buildUserPayload(user, profile),
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy generic register — kept for backward compatibility.
// Routes should prefer the role-specific endpoints above.
// This endpoint only supports "doctor" role going forward.
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Route hospital/patient registrations to their dedicated handlers
    if (role === "hospital") {
      return exports.registerHospital(req, res);
    }
    if (role === "patient") {
      return exports.registerPatient(req, res);
    }

    // Default: doctor registration
    if (!["doctor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Use POST /api/auth/register/hospital or /patient for non-doctor roles",
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed, role, phone: phone || null });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token:   generateToken(user._id),
      user:    buildUserPayload(user, null),
    });
  } catch (error) {
    console.error("register error:", error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};