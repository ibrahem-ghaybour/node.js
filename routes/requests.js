const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const Request = require("../models/Request");

const router = express.Router();

// Helpers
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
};

// Create a request (card) linked to current user
router.post(
  "/",
  [
    protect,
    body("title").notEmpty().withMessage("Title is required").isLength({ max: 120 }),
    body("description").optional().isLength({ max: 2000 }),
    body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { title, description = "", priority = "medium" } = req.body;
      const doc = await Request.create({
        user: req.user.id,
        title,
        description,
        priority,
      });
      res.status(201).json({ success: true, data: doc });
    } catch (e) {
      console.error("Error creating request:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// List requests (own by default). Admin/manager can see all.
router.get(
  "/",
  [
    protect,
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isIn(["open", "in_progress", "resolved", "closed"]),
    query("search").optional().isString(),
    query("sortBy").optional().isIn(["createdAt", "updatedAt", "priority", "status"]),
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

      // Ownership
      if (!req.user || !["admin", "manager"].includes(req.user.role)) {
        filter.user = req.user.id;
      }

      if (req.query.status) filter.status = req.query.status;
      if (req.query.search) filter.$text = { $search: req.query.search };

      const sort = {};
      if (req.query.sortBy) {
        sort[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
      } else {
        sort.createdAt = -1;
      }

      const [data, total] = await Promise.all([
        Request.find(filter)
          .populate("user", "name email role")
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Request.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: data.length,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        data,
      });
    } catch (e) {
      console.error("Error listing requests:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Get single request (owner or admin/manager)
router.get(
  "/:id",
  [protect, param("id").isMongoId().withMessage("Invalid ID")],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const doc = await Request.findById(req.params.id).populate("user", "name email role");
      if (!doc || !doc.isActive) return res.status(404).json({ success: false, error: "Not found" });
      if (doc.user._id.toString() !== req.user.id && !["admin", "manager"].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      res.json({ success: true, data: doc });
    } catch (e) {
      console.error("Error fetching request:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Update request (owner can edit title/description/priority; status requires admin/manager)
router.put(
  "/:id",
  [
    protect,
    param("id").isMongoId(),
    body("title").optional().isLength({ max: 120 }),
    body("description").optional().isLength({ max: 2000 }),
    body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
    body("status").optional().isIn(["open", "in_progress", "resolved", "closed"]),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const doc = await Request.findById(req.params.id);
      if (!doc || !doc.isActive) return res.status(404).json({ success: false, error: "Not found" });

      const isOwner = doc.user.toString() === req.user.id;
      const isAdmin = ["admin", "manager"].includes(req.user.role);
      if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: "Forbidden" });

      const update = {};
      const { title, description, priority, status } = req.body;
      if (title !== undefined) update.title = title;
      if (description !== undefined) update.description = description;
      if (priority !== undefined) update.priority = priority;
      if (status !== undefined) {
        if (!isAdmin) return res.status(403).json({ success: false, error: "Only admin/manager can update status" });
        update.status = status;
      }
      update.updatedAt = Date.now();

      const updated = await Request.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        .populate("user", "name email role");
      res.json({ success: true, data: updated });
    } catch (e) {
      console.error("Error updating request:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Delete (soft) a request
router.delete(
  "/:id",
  [protect, param("id").isMongoId()],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const doc = await Request.findById(req.params.id);
      if (!doc || !doc.isActive) return res.status(404).json({ success: false, error: "Not found" });
      const isOwner = doc.user.toString() === req.user.id;
      const isAdmin = ["admin", "manager"].includes(req.user.role);
      if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: "Forbidden" });
      // If not admin, only allow delete when status is open
      if (!isAdmin && doc.status !== "open") {
        return res.status(400).json({ success: false, error: "Only open requests can be deleted by owner" });
      }
      doc.isActive = false;
      await doc.save();
      res.json({ success: true, data: {} });
    } catch (e) {
      console.error("Error deleting request:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
