const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["doctor", "manager", "patient"],
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false, // mainly for doctors
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
