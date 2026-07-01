const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
      maxlength: [150, "Hospital name cannot exceed 150 characters"],
    },

    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    type: {
      type: String,
      enum: ["Government", "Private", "Semi-Government", "Trust", "Clinic"],
      required: [true, "Hospital type is required"],
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },

    contact: {
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        match: [/^\+?[0-9]{7,15}$/, "Please enter a valid phone number"],
      },
      email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      },
      emergencyLine: {
        type: String,
        match: [/^\+?[0-9]{7,15}$/, "Please enter a valid emergency line number"],
      },
    },

    address: {
      street: { type: String, required: [true, "Street address is required"], trim: true },
      city:   { type: String, required: [true, "City is required"],           trim: true },
      state:  { type: String, required: [true, "State is required"],          trim: true },
      zip:    { type: String, required: [true, "ZIP code is required"],       trim: true },
      country:{ type: String, required: [true, "Country is required"],        trim: true, default: "India" },
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    facilities: {
      totalBeds:    { type: Number, default: 0, min: 0 },
      icuBeds:      { type: Number, default: 0, min: 0 },
      operatingRooms:{ type: Number, default: 0, min: 0 },
      emergencyUnit: { type: Boolean, default: false },
      bloodBank:     { type: Boolean, default: false },
      trauma:        { type: Boolean, default: false },
    },

    specializations: [{
  type: String,
  enum: [
    "Cardiology",
    "Neurology",
    "Neurosurgery",
    "Orthopedics",
    "Anesthesiology",
    "Critical Care",
    "Pediatrics",
    "General Surgery",
    "Gynaecology",
    "Urology",
    "Oncology",
    "Nephrology",
    "Gastroenterology",
    "Pulmonology",
    "Dermatology",
    "ENT",
    "Ophthalmology",
    "Psychiatry",
    "Radiology",
    "Emergency Medicine",
    "Endocrinology",
    "Hematology",
    "Rheumatology",
    "Plastic Surgery",
    "Vascular Surgery",
    "Cardiothoracic Surgery",
    "Oral & Maxillofacial Surgery",
    "Physical Medicine & Rehabilitation",
    "Infectious Diseases",
    "Allergy & Immunology"
  ]
}],

    managers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    doctors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// Geo index for future proximity-based searches (AI feature ready)
hospitalSchema.index({ location: "2dsphere" });

// Text index for search
hospitalSchema.index({ name: "text", "address.city": "text", "address.state": "text" });

module.exports = mongoose.model("Hospital", hospitalSchema);