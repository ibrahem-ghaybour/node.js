const express = require("express");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const { getCurrency, setCurrency } = require("../utils/settings");

const router = express.Router();

// Get current settings (currency) or update if currency provided
router.get("/", async (req, res) => {
  try {
    // If currency is provided in body, update it
    if (req.body.currency) {
      const newCurrency = await setCurrency(req.body.currency);
      res.json({ success: true, data: { currency: newCurrency } });
    } else {
      // Otherwise, just return current currency
      const currency = await getCurrency();
      res.json({ success: true, data: { currency } });
    }
  } catch (e) {
    console.error("Error getting/updating settings:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Update currency (admin/manager)
router.put(
  "/currency",
  [
    protect,
    authorize("admin", "manager"),
    body("currency").isString().isLength({ min: 3, max: 3 }),
  ],
  async (req, res) => {
    try {
      const newCur = await setCurrency(req.body.currency);
      res.json({ success: true, data: { currency: newCur } });
    } catch (e) {
      console.error("Error updating currency:", e);
      res
        .status(400)
        .json({ success: false, error: e.message || "Invalid currency" });
    }
  }
);

module.exports = router;
