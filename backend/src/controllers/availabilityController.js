const Availability = require("../models/Availability");

// CREATE / UPDATE availability
const setAvailability = async (req, res) => {
  try {
    const { status, startTime, endTime } = req.body;

    const availability = await Availability.create({
      doctor: req.user._id,
      status,
      startTime,
      endTime,
    });

    res.status(201).json({
      message: "Availability set successfully",
      availability,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET all available doctors
const getAvailableDoctors = async (req, res) => {
  try {
    const doctors = await Availability.find({ status: "available" })
      .populate("doctor", "name email role");

    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { setAvailability, getAvailableDoctors };