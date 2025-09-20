const mongoose = require("mongoose");

// Generic counter collection used for generating sequential codes
// Document _id is the counter name (e.g., "orderCode"), seq is the current number
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 1000 },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

counterSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Counter", counterSchema);
