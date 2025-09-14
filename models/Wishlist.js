const mongoose = require("mongoose");

const WishlistSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ما بتخلي المنتج ينضاف مرتين لنفس المستخدم
WishlistSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Wishlist", WishlistSchema);
