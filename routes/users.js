// routes/users.js
const express = require("express");
const path = require("path");
const multer = require("multer");
const { body, validationResult, query } = require("express-validator");
const mongoose = require("mongoose");

const User = require("../models/User"); // عدّل المسار حسب مشروعك
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

/* ---------- Multer setup (upload avatar from device) ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(process.cwd(), "uploads", "avatars")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const fileFilter = (req, file, cb) => {
  // صور فقط
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
    return cb(null, true);
  cb(new Error("Only image files are allowed (png, jpg, jpeg, webp, gif)"));
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}); // 5MB

/* ---------- POST /api/users  (create user) ---------- */
// Admin only - يدعم multipart/form-data مع حقل ملف اسمه avatar
router.post(
  "/",
  [
    protect,
    authorize("admin"),
    upload.single("avatar"),
    body("name", "Name is required").trim().notEmpty(),
    body("email", "Please include a valid email")
      .trim()
      .isEmail()
      .normalizeEmail(),
    body(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    body("role").optional().isIn(["user", "customer", "manager", "admin"]),
    body("status").optional().isIn(["active", "inactive", "maintenance"]),
    body("isActive").optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // حذف الملف المرفوع إن وجد عند وجود أخطاء تحقّق
      if (req.file) {
        /* يمكنك حذف الملف من القرص إذا رغبت */
      }
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        email,
        password,
        role = "user",
        status = "active",
        isActive = true,
      } = req.body;

      // Email unique check
      const exists = await User.findOne({ email });
      if (exists) {
        if (req.file) {
          /* يمكنك حذف الملف من القرص إذا رغبت */
        }
        return res
          .status(400)
          .json({ errors: [{ msg: "User already exists" }] });
      }

      // مسار الصورة إن وُجدت
      const avatarPath = req.file
        ? `/uploads/avatars/${req.file.filename}`
        : "";

      const user = new User({
        name,
        email,
        password, // سيُعمل له hash في pre-save hook
        role,
        status,
        isActive,
        avatar: avatarPath,
      });

      await user.save();

      res.status(201).json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ---------- GET /api/users  (list with pagination & filters) ---------- */
router.get(
  "/",
  [
    protect,
    authorize("admin"),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().isString(),
    query("role").optional().isIn(["user", "customer", "manager", "admin"]),
    query("status").optional().isIn(["active", "inactive", "maintenance"]),
    query("isActive").optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const skip = (page - 1) * limit;

      const filter = {};

      if (req.query.search) {
        const rx = new RegExp(req.query.search, "i");
        filter.$or = [{ name: rx }, { email: rx }];
      }
      if (req.query.role) filter.role = req.query.role;
      if (req.query.status) filter.status = req.query.status;
      if (typeof req.query.isActive === "boolean")
        filter.isActive = req.query.isActive;

      const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .select("-password")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      const pages = Math.ceil(total / limit);

      res.json({
        success: true,
        count: users.length,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1,
        },
        data: users,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ---------- GET /api/users/:id ---------- */
router.get("/:id", [protect, authorize("admin")], async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- PUT /api/users/:id  (update) ---------- */
router.put(
  "/:id",
  [
    protect,
    authorize("admin"),
    body("name").optional().isLength({ min: 1, max: 50 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("role").optional().isIn(["user", "customer", "manager", "admin"]),
    body("status").optional().isIn(["active", "inactive", "maintenance"]),
    body("isActive").optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // إذا تغيّر الإيميل تأكد من عدم وجوده
      if (req.body.email && req.body.email !== user.email) {
        const emailExists = await User.findOne({ email: req.body.email });
        if (emailExists)
          return res.status(400).json({ message: "Email already exists" });
      }

      const updateFields = {};
      ["name", "email", "role", "status"].forEach((k) => {
        if (req.body[k] !== undefined) updateFields[k] = req.body[k];
      });
      if (req.body.isActive !== undefined)
        updateFields.isActive = req.body.isActive;

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateFields,
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

      res.json({ success: true, data: updatedUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ---------- DELETE /api/users/:id ---------- */
router.delete("/:id", [protect, authorize("admin")], async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // منع حذف النفس
    if (req.user.id === req.params.id) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- GET /api/users/status-summary ---------- */
router.get(
  "/status-summary",
  [protect, authorize("admin")],
  async (req, res) => {
    try {
      const summary = await User.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
        { $sort: { status: 1 } },
      ]);

      const totalActive = await User.countDocuments({ isActive: true });

      res.json({
        success: true,
        data: { summary, totalActive },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
