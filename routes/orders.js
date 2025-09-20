const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Address = require("../models/Address");

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
    // If client sends items, validate them; otherwise we'll fallback to cart.
    body("items").optional().isArray({ min: 1 }).withMessage("Items must be a non-empty array when provided"),
    body("items.*.productId").optional().notEmpty().isMongoId().withMessage("Valid productId required"),
    body("items.*.quantity").optional().isInt({ min: 1 }).withMessage("Quantity must be >= 1"),
    body("userId").optional().isMongoId().withMessage("Invalid userId"),
    body("addressId").optional().isMongoId().withMessage("Invalid addressId"),
    body("shippingAddress").optional().isObject(),
    body("notes").optional().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      let { shippingAddress = {}, notes = "", currency, addressId } = req.body;

      // Determine target user (admins/managers can act on behalf of others)
      const isAdmin = req.user && ["admin", "manager"].includes(req.user.role);
      const targetUserId = isAdmin && req.body.userId ? req.body.userId : req.user.id;

      // If addressId is provided, resolve the address for this user and override shippingAddress
      if (addressId) {
        const addr = await Address.findOne({ _id: addressId, user: targetUserId, isActive: true });
        if (!addr) return res.status(404).json({ success: false, error: "Address not found" });
        shippingAddress = {
          fullName: addr.fullName,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          governorate: addr.governorate,
          postalCode: addr.postalCode,
          country: addr.country,
        };
      }

      // Decide source of items: request body (if provided) else user's cart
      let sourceItems = Array.isArray(req.body.items) ? req.body.items : null;
      let currencyFromCart = null;
      if (!sourceItems) {
        const cart = await Cart.findOne({ user: targetUserId });
        if (!cart || cart.items.length === 0) {
          return res.status(400).json({ success: false, error: "No items provided and cart is empty" });
        }
        // Map cart format to { productId, quantity }
        sourceItems = cart.items.map((ci) => ({ productId: ci.product.toString(), quantity: ci.quantity }));
        currencyFromCart = cart.currency || null;
      }

      // Fetch products and build order items using current product data
      const productIds = sourceItems.map((i) => i.productId);
      const products = await Product.find({ _id: { $in: productIds }, isActive: true });
      const map = new Map(products.map((p) => [p._id.toString(), p]));

      const orderItems = [];
      let totalAmount = 0;
      for (const i of sourceItems) {
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
        user: targetUserId,
        items: orderItems,
        totalAmount,
        currency: currency || currencyFromCart || "USD",
        shippingAddress,
        notes,
      });

      // If we used the cart, clear it after successful order creation
      if (!Array.isArray(req.body.items)) {
        const cart = await Cart.findOne({ user: targetUserId });
        if (cart) {
          cart.items = [];
          cart.totalAmount = 0;
          await cart.save();
        }
      }

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

// Bulk update order status by array of IDs or orderCodes (admin/manager)
router.patch(
  "/status/bulk",
  [
    protect,
    authorize("admin", "manager"),
    body("orderIds").isArray({ min: 1 }).withMessage("orderIds must be a non-empty array"),
    body("orderIds.*").isString().withMessage("Each order identifier must be a string"),
    body("status").isIn(["pending", "paid", "shipped", "delivered", "cancelled"]).withMessage("Invalid status"),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { orderIds, status } = req.body;

      // Separate provided identifiers into Mongo ObjectIds and human codes like ORD-1002
      const isObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(v);
      const mongoIds = orderIds.filter((v) => isObjectId(v));
      const orderCodes = orderIds.filter((v) => !isObjectId(v));

      const filter = { $or: [] };
      if (mongoIds.length) filter.$or.push({ _id: { $in: mongoIds } });
      if (orderCodes.length) filter.$or.push({ orderCode: { $in: orderCodes } });

      if (filter.$or.length === 0) {
        return res.status(400).json({ success: false, error: "No valid order identifiers provided" });
      }

      // Find matching orders first to report which were found vs not
      const foundOrders = await Order.find(filter).select("_id orderCode status");
      if (!foundOrders.length) {
        return res.status(404).json({ success: false, error: "No matching orders found" });
      }

      const idsToUpdate = foundOrders.map((o) => o._id);
      const updateRes = await Order.updateMany(
        { _id: { $in: idsToUpdate } },
        { $set: { status, updatedAt: Date.now() } }
      );

      // Fetch updated docs
      const updated = await Order.find({ _id: { $in: idsToUpdate } })
        .populate("user", "name email role")
        .populate("items.product", "name price");

      // Compute not found identifiers
      const normalizedFound = new Set([
        ...foundOrders.map((o) => o._id.toString()),
        ...foundOrders.filter((o) => o.orderCode).map((o) => o.orderCode),
      ]);
      const notFound = orderIds.filter((id) => !normalizedFound.has(id));

      res.json({
        success: true,
        matchedCount: foundOrders.length,
        modifiedCount: updateRes.modifiedCount || 0,
        notFound,
        data: updated,
      });
    } catch (e) {
      console.error("Error bulk updating status:", e);
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
