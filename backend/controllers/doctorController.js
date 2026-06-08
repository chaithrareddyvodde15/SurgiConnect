const Doctor = require('../models/doctorModel');

exports.updateAvailability = async (req, res) => {
  const { availability, futureLeaves } = req.body;
  const doctor = await Doctor.findOneAndUpdate(
    { userId: req.user._id },
    { availability, futureLeaves },
    { new: true, upsert: true }
  );
  res.json(doctor);
};

exports.getDoctors = async (req, res) => {
  const { specialization } = req.query;
  const filter = specialization ? { specialization } : {};
  const doctors = await Doctor.find(filter).populate('userId', 'name email');
  res.json(doctors);
};
