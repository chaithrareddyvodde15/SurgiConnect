const Doctor = require('../models/doctorModel');
const AuditLog = require('../models/auditLogModel');

exports.broadcastEmergency = async (req, res) => {
  const { specialization } = req.body;
  const doctors = await Doctor.find({ specialization, availability: 'Available' });

  for (let doc of doctors) {
    await AuditLog.create({
      doctorId: doc._id,
      managerId: req.user._id,
      action: `Emergency alert sent to ${specialization}`,
    });
  }

  res.json({ message: `Alert sent to ${doctors.length} doctors.` });
};
