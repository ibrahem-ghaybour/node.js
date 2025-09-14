const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a city name"],
      trim: true,
      maxlength: [50, "City name cannot exceed 50 characters"],
    },
    nameAr: {
      type: String,
      required: [true, "Please add an Arabic city name"],
      trim: true,
      maxlength: [50, "Arabic city name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      required: [true, "Please add a city code"],
      trim: true,
      maxlength: [10, "City code cannot exceed 10 characters"],
    },
    governorate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Governorate",
      required: [true, "Please add a governorate"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index to ensure unique city names within a governorate
citySchema.index(
  { name: 1, governorate: 1 },
  { unique: true }
);

// Create text index for search functionality
citySchema.index({
  name: "text",
  nameAr: "text",
  description: "text",
});

module.exports = mongoose.model("City", citySchema);
