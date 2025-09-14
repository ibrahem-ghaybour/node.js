const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");

// @route   GET /api/wishlist
// @desc    Get all wishlist items
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ userId: req.user.id })
      .populate("productId") // بيجيب المنتج كامل
      .lean();

    res.json(wishlist.map((item) => item.productId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const { productId } = req.body;
    const wishlist = await Wishlist.create({
      productId,
      userId: req.user.id,
    });
    res.json(wishlist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
