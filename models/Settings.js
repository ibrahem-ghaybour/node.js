const mongoose = require("mongoose");

// A single-document collection to hold global app settings
// We will upsert and always use the same _id = 'global'
const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    currency: {
      type: String,
      required: true,
      default: "USD",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Settings", settingsSchema);
