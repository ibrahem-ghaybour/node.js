const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
};

// Create order for current user
router.post(
  "/",
  [
    protect,
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.productId").notEmpty().isMongoId().withMessage("Valid productId required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be >= 1"),
    body("shippingAddress").optional().isObject(),
    body("notes").optional().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { items, shippingAddress = {}, notes = "", currency = "USD" } = req.body;

      // Fetch products and build order items
      const productIds = items.map((i) => i.productId);
      const products = await Product.find({ _id: { $in: productIds }, isActive: true });
      const map = new Map(products.map((p) => [p._id.toString(), p]));

      const orderItems = [];
      let totalAmount = 0;
      for (const i of items) {
        const p = map.get(i.productId);
        if (!p) {
          return res.status(400).json({ success: false, error: `Product not found or inactive: ${i.productId}` });
        }
        const price = p.price;
        const quantity = i.quantity;
        const subtotal = price * quantity;
        totalAmount += subtotal;
        orderItems.push({ product: p._id, name: p.name, price, quantity, subtotal });
      }

      const order = await Order.create({
        user: req.user.id,
        items: orderItems,
        totalAmount,
        currency,
        shippingAddress,
        notes,
      });

      res.status(201).json({ success: true, data: order });
    } catch (e) {
      console.error("Error creating order:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// List current user's orders; admins see all
router.get(
  "/",
  [
    protect,
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isIn(["pending", "paid", "shipped", "delivered", "cancelled"]),
    query("sortBy").optional().isIn(["createdAt", "updatedAt", "totalAmount", "status"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const filter = { isActive: true };
      if (!req.user || !["admin", "manager"].includes(req.user.role)) {
        filter.user = req.user.id;
      }
      if (req.query.status) filter.status = req.query.status;

      const sort = {};
      if (req.query.sortBy) {
        sort[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
      } else {
        sort.createdAt = -1;
      }

      const [data, total] = await Promise.all([
        Order.find(filter)
          .populate("user", "name email role")
          .populate("items.product", "name price")
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: data.length,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        data,
      });
    } catch (e) {
      console.error("Error listing orders:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Get single order (owner or admin/manager)
router.get(
  "/:id",
  [protect, param("id").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const order = await Order.findById(req.params.id)
        .populate("user", "name email role")
        .populate("items.product", "name price");
      if (!order || !order.isActive) return res.status(404).json({ success: false, error: "Not found" });
      const isOwner = order.user._id.toString() === req.user.id;
      const isAdmin = ["admin", "manager"].includes(req.user.role);
      if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: "Forbidden" });
      res.json({ success: true, data: order });
    } catch (e) {
      console.error("Error fetching order:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Update order status (admin/manager)
router.patch(
  "/:id/status",
  [protect, authorize("admin", "manager"), param("id").isMongoId(), body("status").isIn(["pending", "paid", "shipped", "delivered", "cancelled"])],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status, updatedAt: Date.now() },
        { new: true, runValidators: true }
      )
        .populate("user", "name email role")
        .populate("items.product", "name price");
      if (!order) return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, data: order });
    } catch (e) {
      console.error("Error updating status:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Cancel order by owner if still pending
router.post(
  "/:id/cancel",
  [protect, param("id").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const order = await Order.findById(req.params.id);
      if (!order || !order.isActive) return res.status(404).json({ success: false, error: "Not found" });
      if (order.user.toString() !== req.user.id) return res.status(403).json({ success: false, error: "Forbidden" });
      if (order.status !== "pending") return res.status(400).json({ success: false, error: "Only pending orders can be cancelled" });
      order.status = "cancelled";
      await order.save();
      res.json({ success: true, data: order });
    } catch (e) {
      console.error("Error cancelling order:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
