const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  specialization: String,
  fee: Number,
  availability: {
    type: String,
    enum: ['Available', 'Unavailable', 'On-Call'],
    default: 'Unavailable',
  },
  futureLeaves: [Date],
  verified: { type: Boolean, default: false },
});

module.exports = mongoose.model('Doctor', doctorSchema);
