const mongoose = require("mongoose");

const governorateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a governorate name"],
      trim: true,
      maxlength: [50, "Governorate name cannot exceed 50 characters"],
      unique: true,
    },
    nameAr: {
      type: String,
      required: [true, "Please add an Arabic governorate name"],
      trim: true,
      maxlength: [50, "Arabic governorate name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      required: [true, "Please add a governorate code"],
      trim: true,
      maxlength: [10, "Governorate code cannot exceed 10 characters"],
      unique: true,
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

// Create text index for search functionality
governorateSchema.index({
  name: "text",
  nameAr: "text",
  description: "text",
});

module.exports = mongoose.model("Governorate", governorateSchema);
