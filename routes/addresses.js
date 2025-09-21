const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { protect } = require("../middleware/auth");
const Address = require("../models/Address");
const City = require("../models/City");
const Governorate = require("../models/Governorate");

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
};

// List current user's addresses
router.get("/", protect, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id, isActive: true }).sort({ isDefault: -1, updatedAt: -1 });
    res.json({ success: true, count: addresses.length, data: addresses });
  } catch (e) {
    console.error("Error listing addresses:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get single address (must be owner's)
router.get(
  "/:id",
  [protect, param("id").isMongoId().withMessage("Invalid address id")],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const addr = await Address.findOne({ _id: req.params.id, user: req.user.id, isActive: true });
      if (!addr) return res.status(404).json({ success: false, error: "Address not found" });
      res.json({ success: true, data: addr });
    } catch (e) {
      console.error("Error getting address:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Create address
router.post(
  "/",
  [
    protect,
    body("fullName").optional().isLength({ max: 120 }),
    body("phone").notEmpty().isLength({ max: 40 }),
    body("line1").notEmpty().isLength({ max: 200 }),
    body("line2").optional().isLength({ max: 200 }),
    body("cityId").notEmpty().isMongoId().withMessage("Invalid cityId"),
    body("governorateId").notEmpty().isMongoId().withMessage("Invalid governorateId"),
    body("postalCode").optional().isLength({ max: 20 }),
    body("country").notEmpty().isLength({ min: 2, max: 2 }),
    body("isDefault").optional().isBoolean(),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const payload = { ...req.body, user: req.user.id };
      // For authenticated users, always take the name from the account
      if (req.user && req.user.name) {
        payload.fullName = req.user.name;
      } else {
        // Fallback in case of optional/guest flows: require fullName when no authenticated user
        if (!payload.fullName) {
          return res.status(400).json({ success: false, error: "fullName is required for guests" });
        }
      }

      // Resolve governorate and city by IDs and validate relationship
      const { governorateId, cityId } = req.body;
      const gov = await Governorate.findOne({ _id: governorateId, isActive: true });
      if (!gov) return res.status(404).json({ success: false, error: "Governorate not found" });
      const city = await City.findOne({ _id: cityId, isActive: true }).populate("governorate", "_id");
      if (!city) return res.status(404).json({ success: false, error: "City not found" });
      if (city.governorate && city.governorate._id.toString() !== governorateId) {
        return res.status(400).json({ success: false, error: "City does not belong to the specified governorate" });
      }

      // Store normalized names in Address schema (which expects strings)
      payload.city = city.name;
      payload.governorate = gov.name;
      // Remove IDs that are not part of Address schema to avoid unintended persistence
      delete payload.cityId;
      delete payload.governorateId;

      const address = await Address.create(payload);
      // If isDefault true, unset others
      if (address.isDefault) {
        await Address.updateMany({ user: req.user.id, _id: { $ne: address._id } }, { $set: { isDefault: false } });
      }
      res.status(201).json({ success: true, data: address });
    } catch (e) {
      console.error("Error creating address:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Update address (owner only)
router.put(
  "/:id",
  [
    protect,
    param("id").isMongoId(),
    body("fullName").optional().isLength({ max: 120 }),
    body("phone").optional().isLength({ max: 40 }),
    body("line1").optional().isLength({ max: 200 }),
    body("line2").optional().isLength({ max: 200 }),
    body("cityId").optional().isMongoId().withMessage("Invalid cityId"),
    body("governorateId").optional().isMongoId().withMessage("Invalid governorateId"),
    body("postalCode").optional().isLength({ max: 20 }),
    body("country").optional().isLength({ min: 2, max: 2 }),
    body("isDefault").optional().isBoolean(),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const addr = await Address.findOne({ _id: req.params.id, user: req.user.id, isActive: true });
      if (!addr) return res.status(404).json({ success: false, error: "Address not found" });
      const updates = { ...req.body };

      // If user is authenticated, keep fullName aligned with account unless explicitly changing policy
      if (req.user && req.user.name) {
        updates.fullName = req.user.name;
      }

      // Handle optional city/governorate updates via IDs
      const { governorateId, cityId } = updates;
      if (governorateId || cityId) {
        let gov = null;
        let city = null;
        if (governorateId) {
          gov = await Governorate.findOne({ _id: governorateId, isActive: true });
          if (!gov) return res.status(404).json({ success: false, error: "Governorate not found" });
        }
        if (cityId) {
          city = await City.findOne({ _id: cityId, isActive: true }).populate("governorate", "_id");
          if (!city) return res.status(404).json({ success: false, error: "City not found" });
        }
        // Validate relationship if both provided; if only one provided, attempt consistency check with existing values cannot be guaranteed
        const govIdToCheck = governorateId || undefined;
        if (city && city.governorate && govIdToCheck && city.governorate._id.toString() !== govIdToCheck) {
          return res.status(400).json({ success: false, error: "City does not belong to the specified governorate" });
        }
        if (city) updates.city = city.name;
        if (gov) updates.governorate = gov.name;
        delete updates.cityId;
        delete updates.governorateId;
      }

      Object.assign(addr, updates);
      await addr.save();
      if (addr.isDefault) {
        await Address.updateMany({ user: req.user.id, _id: { $ne: addr._id } }, { $set: { isDefault: false } });
      }
      res.json({ success: true, data: addr });
    } catch (e) {
      console.error("Error updating address:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Delete (soft) address
router.delete(
  "/:id",
  [protect, param("id").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const addr = await Address.findOne({ _id: req.params.id, user: req.user.id, isActive: true });
      if (!addr) return res.status(404).json({ success: false, error: "Address not found" });
      addr.isActive = false;
      await addr.save();
      res.json({ success: true, data: {} });
    } catch (e) {
      console.error("Error deleting address:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Set default address
router.post(
  "/:id/default",
  [protect, param("id").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const addr = await Address.findOne({ _id: req.params.id, user: req.user.id, isActive: true });
      if (!addr) return res.status(404).json({ success: false, error: "Address not found" });
      addr.isDefault = true;
      await addr.save();
      await Address.updateMany({ user: req.user.id, _id: { $ne: addr._id } }, { $set: { isDefault: false } });
      res.json({ success: true, data: addr });
    } catch (e) {
      console.error("Error setting default address:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
