const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");

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

// @route   GET /api/wishlist/all
// @desc    Get all user wishlists grouped by user (admin/manager only)
// @access  Private (Admin/Manager)
router.get("/all", protect, authorize("admin", "manager"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get distinct users who have wishlist items
    const usersWithWishlists = await Wishlist.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const userIds = usersWithWishlists.map(u => u._id);
    
    const [wishlists, totalUsers] = await Promise.all([
      Wishlist.find({ userId: { $in: userIds } })
        .populate("userId", "name email role")
        .populate("productId", "name price description category imageUrl")
        .sort({ createdAt: -1 })
        .lean(),
      Wishlist.distinct("userId").then(users => users.length)
    ]);

    // Group wishlists by user
    const groupedData = userIds.map(userId => {
      const userWishlists = wishlists.filter(w => w.userId._id.toString() === userId.toString());
      return {
        user: userWishlists[0]?.userId,
        wishlistCount: userWishlists.length,
        items: userWishlists.map(w => ({
          _id: w._id,
          product: w.productId,
          createdAt: w.createdAt
        }))
      };
    });

    res.json({
      success: true,
      count: groupedData.length,
      total: totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
      data: groupedData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/wishlist/:id
// @desc    Get specific user's wishlist by user ID (admin/manager only)
// @access  Private (Admin/Manager)
router.get("/:id", protect, authorize("admin", "manager"), async (req, res) => {
  try {
    const { id } = req.params;

    const wishlists = await Wishlist.find({ userId: id })
      .populate("userId", "name email role")
      .populate("productId", "name price description category imageUrl")
      .sort({ createdAt: -1 })
      .lean();

    if (!wishlists || wishlists.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No wishlist items found for this user" 
      });
    }

    res.json({
      success: true,
      user: wishlists[0].userId,
      count: wishlists.length,
      data: wishlists.map(w => ({
        _id: w._id,
        product: w.productId,
        createdAt: w.createdAt
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
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
