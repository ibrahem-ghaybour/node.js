const express = require("express");
const { body, validationResult, query } = require("express-validator");
const Governorate = require("../models/Governorate");
const City = require("../models/City");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/governorates
// @desc    Get all governorates with pagination and search
// @access  Private
router.get(
  "/",
  [
    protect,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
    query("status")
      .optional()
      .isIn(["active", "inactive", "maintenance"])
      .withMessage("Invalid status"),
    query("sortBy")
      .optional()
      .isIn(["name", "nameAr", "code", "status", "createdAt", "updatedAt"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Build query
      let query = { isActive: true };

      if (req.query.search) {
        query.$text = { $search: req.query.search };
      }

      if (req.query.status) {
        query.status = req.query.status;
      }

      // Build sort object
      let sort = {};
      if (req.query.sortBy) {
        sort[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
      } else {
        sort.name = 1; // Default sort by name ascending
      }

      const governorates = await Governorate.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email");

      const total = await Governorate.countDocuments(query);

      res.status(200).json({
        success: true,
        count: governorates.length,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        data: governorates,
      });
    } catch (error) {
      console.error("Error fetching governorates:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   GET /api/governorates/:id
// @desc    Get single governorate by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const governorate = await Governorate.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!governorate) {
      return res.status(404).json({
        success: false,
        error: "Governorate not found",
      });
    }

    // Get cities for this governorate
    const cities = await City.find({ 
      governorate: governorate._id, 
      isActive: true 
    }).populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: {
        governorate,
        cities,
      },
    });
  } catch (error) {
    console.error("Error fetching governorate:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

// @route   POST /api/governorates
// @desc    Create a new governorate
// @access  Private (Admin/Manager only)
router.post(
  "/",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .notEmpty()
      .withMessage("Please add a governorate name")
      .isLength({ max: 50 })
      .withMessage("Governorate name cannot exceed 50 characters"),
    body("nameAr")
      .notEmpty()
      .withMessage("Please add an Arabic governorate name")
      .isLength({ max: 50 })
      .withMessage("Arabic governorate name cannot exceed 50 characters"),
    body("code")
      .notEmpty()
      .withMessage("Please add a governorate code")
      .isLength({ max: 10 })
      .withMessage("Governorate code cannot exceed 10 characters"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "maintenance"])
      .withMessage("Invalid status"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if governorate already exists
      const existingGovernorate = await Governorate.findOne({
        $or: [
          { name: req.body.name },
          { nameAr: req.body.nameAr },
          { code: req.body.code },
        ],
      });

      if (existingGovernorate) {
        return res.status(400).json({
          success: false,
          error: "Governorate with this name, Arabic name, or code already exists",
        });
      }

      const governorate = await Governorate.create({
        ...req.body,
        createdBy: req.user.id,
      });

      res.status(201).json({
        success: true,
        data: governorate,
      });
    } catch (error) {
      console.error("Error creating governorate:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   PUT /api/governorates/:id
// @desc    Update governorate
// @access  Private (Admin/Manager only)
router.put(
  "/:id",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Governorate name cannot exceed 50 characters"),
    body("nameAr")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Arabic governorate name cannot exceed 50 characters"),
    body("code")
      .optional()
      .isLength({ max: 10 })
      .withMessage("Governorate code cannot exceed 10 characters"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "maintenance"])
      .withMessage("Invalid status"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const governorate = await Governorate.findById(req.params.id);

      if (!governorate) {
        return res.status(404).json({
          success: false,
          error: "Governorate not found",
        });
      }

      // Check for duplicate names/Arabic names/codes (excluding current governorate)
      if (req.body.name || req.body.nameAr || req.body.code) {
        const existingGovernorate = await Governorate.findOne({
          _id: { $ne: req.params.id },
          $or: [
            ...(req.body.name ? [{ name: req.body.name }] : []),
            ...(req.body.nameAr ? [{ nameAr: req.body.nameAr }] : []),
            ...(req.body.code ? [{ code: req.body.code }] : []),
          ],
        });

        if (existingGovernorate) {
          return res.status(400).json({
            success: false,
            error: "Governorate with this name, Arabic name, or code already exists",
          });
        }
      }

      const updatedGovernorate = await Governorate.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate("createdBy", "name email");

      res.status(200).json({
        success: true,
        data: updatedGovernorate,
      });
    } catch (error) {
      console.error("Error updating governorate:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   DELETE /api/governorates/:id
// @desc    Delete governorate (soft delete)
// @access  Private (Admin only)
router.delete("/:id", [protect, authorize("admin")], async (req, res) => {
  try {
    const governorate = await Governorate.findById(req.params.id);

    if (!governorate) {
      return res.status(404).json({
        success: false,
        error: "Governorate not found",
      });
    }

    // Check if there are cities associated with this governorate
    const citiesCount = await City.countDocuments({ 
      governorate: governorate._id, 
      isActive: true 
    });

    if (citiesCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete governorate with associated cities. Please delete or reassign cities first.",
      });
    }

    governorate.isActive = false;
    await governorate.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Error deleting governorate:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

// @route   GET /api/governorates/status-summary
// @desc    Get status summary for all governorates
// @access  Private
router.get("/status-summary", protect, async (req, res) => {
  try {
    const summary = await Governorate.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Governorate.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        summary,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching governorate status summary:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

module.exports = router;
