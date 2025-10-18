const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { getCurrency } = require("../utils/settings");

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
};

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    const currency = await getCurrency();
    cart = await Cart.create({ user: userId, items: [], totalAmount: 0, currency });
    return cart;
  }
  // keep currency in sync with global setting
  try {
    const currency = await getCurrency();
    if (!cart.currency || cart.currency !== currency) {
      cart.currency = currency;
      await cart.save();
    }
  } catch (e) {
    // non-fatal; proceed with existing cart currency
  }
  return cart;
}

function recalcCart(cart) {
  let total = 0;
  for (const it of cart.items) {
    it.subtotal = it.price * it.quantity;
    total += it.subtotal;
  }
  cart.totalAmount = total;
}

// Get current user's cart
router.get("/", protect, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    await cart.populate("items.product", "name price");
    res.json({ success: true, data: cart });
  } catch (e) {
    console.error("Error getting cart:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get all user carts (admin/manager only)
router.get("/all", protect, authorize("admin", "manager"), async (req, res) => {
  try {
    const carts = await Cart.find()
      .populate("user", "name email role")
      .populate("items.product", "name price description category imageUrl");
    
    res.json({ 
      success: true, 
      count: carts.length,
      data: carts 
    });
  } catch (e) {
    console.error("Error getting all carts:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Add item to cart (or increase quantity)
router.post(
  "/add",
  [
    protect,
    body("productId").isMongoId().withMessage("Valid productId required"),
    body("quantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Quantity must be >= 1")
      .toInt(),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { productId } = req.body;
      const qty = Number.isInteger(req.body.quantity) ? req.body.quantity : Number.parseInt(req.body.quantity ?? 1, 10);
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) return res.status(400).json({ success: false, error: "Product not found or inactive" });

      const cart = await getOrCreateCart(req.user.id);
      const idx = cart.items.findIndex((i) => i.product.toString() === productId);
      if (idx >= 0) {
        cart.items[idx].quantity += qty;
      } else {
        cart.items.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: qty,
          subtotal: product.price * qty,
        });
      }
      recalcCart(cart);
      await cart.save();
      await cart.populate("items.product", "name price");
      res.status(201).json({ success: true, data: cart });
    } catch (e) {
      console.error("Error adding to cart:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Update item quantity (set absolute quantity; if 0, remove)
router.patch(
  "/item/:productId",
  [
    protect,
    param("productId").isMongoId(),
    body("quantity").isInt({ min: 0 }).toInt(),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { productId } = req.params;
      const { quantity } = req.body;
      const qty = Number.isInteger(quantity) ? quantity : Number.parseInt(quantity, 10);
      const cart = await getOrCreateCart(req.user.id);
      const idx = cart.items.findIndex((i) => i.product.toString() === productId);
      if (idx === -1) return res.status(404).json({ success: false, error: "Item not found in cart" });
      if (qty === 0) {
        cart.items.splice(idx, 1);
      } else {
        cart.items[idx].quantity = qty;
      }
      recalcCart(cart);
      await cart.save();
      await cart.populate("items.product", "name price");
      res.json({ success: true, data: cart });
    } catch (e) {
      console.error("Error updating cart item:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Remove item from cart
router.delete(
  "/item/:productId",
  [protect, param("productId").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { productId } = req.params;
      const cart = await getOrCreateCart(req.user.id);
      const before = cart.items.length;
      cart.items = cart.items.filter((i) => i.product.toString() !== productId);
      if (cart.items.length === before) return res.status(404).json({ success: false, error: "Item not found in cart" });
      recalcCart(cart);
      await cart.save();
      await cart.populate("items.product", "name price");
      res.json({ success: true, data: cart });
    } catch (e) {
      console.error("Error removing cart item:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Clear cart
router.delete("/", protect, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();
    res.json({ success: true, data: cart });
  } catch (e) {
    console.error("Error clearing cart:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Checkout: create order from cart, then clear cart
router.post(
  "/checkout",
  [
    protect,
    body("userId").optional().isMongoId().withMessage("Invalid userId"),
    body("shippingAddress").optional().isObject(),
    body("notes").optional().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { shippingAddress = {}, notes = "" } = req.body;

      // Determine target user (admins/managers can act on behalf of others)
      const isAdmin = req.user && ["admin", "manager"].includes(req.user.role);
      const targetUserId = isAdmin && req.body.userId ? req.body.userId : req.user.id;

      const cart = await getOrCreateCart(targetUserId);
      if (cart.items.length === 0) {
        return res.status(400).json({ success: false, error: "Cart is empty" });
      }

      // Verify each product still exists and is active and price may have changed
      const ids = cart.items.map((i) => i.product);
      const products = await Product.find({ _id: { $in: ids }, isActive: true });
      const map = new Map(products.map((p) => [p._id.toString(), p]));

      const orderItems = [];
      let total = 0;
      for (const i of cart.items) {
        const p = map.get(i.product.toString());
        if (!p) {
          return res.status(400).json({ success: false, error: `Product no longer available: ${i.product}` });
        }
        const price = p.price; // use current price
        const quantity = i.quantity;
        const subtotal = price * quantity;
        total += subtotal;
        orderItems.push({ product: p._id, name: p.name, price, quantity, subtotal });
      }

      const currencyValue = await getCurrency();
      const order = await Order.create({
        user: targetUserId,
        items: orderItems,
        totalAmount: total,
        currency: currencyValue,
        shippingAddress,
        notes,
      });

      // clear cart
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();

      res.status(201).json({ success: true, data: order });
    } catch (e) {
      console.error("Error during checkout:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
