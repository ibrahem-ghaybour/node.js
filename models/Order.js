const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: [arr => arr.length > 0, "Order must have at least one item"],
      required: true,
    },
    totalAmount: { type: Number, required: true, min: 0, index: true },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    shippingAddress: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      governorate: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    notes: { type: String, default: "", maxlength: 2000 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Auto-generate sequential human-readable order codes like ORD-1002
orderSchema.pre("save", async function (next) {
  if (!this.isNew || this.orderCode) return next();
  try {
    const Counter = require("./Counter");
    const c = await Counter.findOneAndUpdate(
      { _id: "orderCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    // Format: ORD-<number> (no padding to match sample like ORD-1002)
    this.orderCode = `ORD-${c.seq}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Order", orderSchema);

