const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  action: String,
  timestamp: { type: Date, default: Date.now },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
