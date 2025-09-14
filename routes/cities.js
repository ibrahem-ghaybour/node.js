const express = require("express");
const { body, validationResult, query } = require("express-validator");
const City = require("../models/City");
const Governorate = require("../models/Governorate");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/cities
// @desc    Get all cities with pagination, search, and filtering
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
    query("governorate")
      .optional()
      .isMongoId()
      .withMessage("Invalid governorate ID"),
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

      if (req.query.governorate) {
        query.governorate = req.query.governorate;
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

      const cities = await City.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("governorate", "name nameAr code")
        .populate("createdBy", "name email");

      const total = await City.countDocuments(query);

      res.status(200).json({
        success: true,
        count: cities.length,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        data: cities,
      });
    } catch (error) {
      console.error("Error fetching cities:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   GET /api/cities/:id
// @desc    Get single city by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const city = await City.findById(req.params.id)
      .populate("governorate", "name nameAr code status")
      .populate("createdBy", "name email");

    if (!city) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    res.status(200).json({
      success: true,
      data: city,
    });
  } catch (error) {
    console.error("Error fetching city:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

// @route   POST /api/cities
// @desc    Create a new city
// @access  Private (Admin/Manager only)
router.post(
  "/",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .notEmpty()
      .withMessage("Please add a city name")
      .isLength({ max: 50 })
      .withMessage("City name cannot exceed 50 characters"),
    body("nameAr")
      .notEmpty()
      .withMessage("Please add an Arabic city name")
      .isLength({ max: 50 })
      .withMessage("Arabic city name cannot exceed 50 characters"),
    body("code")
      .notEmpty()
      .withMessage("Please add a city code")
      .isLength({ max: 10 })
      .withMessage("City code cannot exceed 10 characters"),
    body("governorate")
      .notEmpty()
      .withMessage("Please add a governorate")
      .isMongoId()
      .withMessage("Invalid governorate ID"),
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
      // Check if governorate exists
      const governorate = await Governorate.findById(req.body.governorate);
      if (!governorate) {
        return res.status(400).json({
          success: false,
          error: "Governorate not found",
        });
      }

      // Check if city already exists in the same governorate
      const existingCity = await City.findOne({
        governorate: req.body.governorate,
        $or: [
          { name: req.body.name },
          { nameAr: req.body.nameAr },
          { code: req.body.code },
        ],
      });

      if (existingCity) {
        return res.status(400).json({
          success: false,
          error: "City with this name, Arabic name, or code already exists in this governorate",
        });
      }

      const city = await City.create({
        ...req.body,
        createdBy: req.user.id,
      });

      const populatedCity = await City.findById(city._id)
        .populate("governorate", "name nameAr code")
        .populate("createdBy", "name email");

      res.status(201).json({
        success: true,
        data: populatedCity,
      });
    } catch (error) {
      console.error("Error creating city:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   PUT /api/cities/:id
// @desc    Update city
// @access  Private (Admin/Manager only)
router.put(
  "/:id",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .optional()
      .isLength({ max: 50 })
      .withMessage("City name cannot exceed 50 characters"),
    body("nameAr")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Arabic city name cannot exceed 50 characters"),
    body("code")
      .optional()
      .isLength({ max: 10 })
      .withMessage("City code cannot exceed 10 characters"),
    body("governorate")
      .optional()
      .isMongoId()
      .withMessage("Invalid governorate ID"),
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
      const city = await City.findById(req.params.id);

      if (!city) {
        return res.status(404).json({
          success: false,
          error: "City not found",
        });
      }

      // If governorate is being updated, check if it exists
      if (req.body.governorate) {
        const governorate = await Governorate.findById(req.body.governorate);
        if (!governorate) {
          return res.status(400).json({
            success: false,
            error: "Governorate not found",
          });
        }
      }

      // Check for duplicate names/Arabic names/codes in the same governorate (excluding current city)
      if (req.body.name || req.body.nameAr || req.body.code || req.body.governorate) {
        const governorateId = req.body.governorate || city.governorate;
        const existingCity = await City.findOne({
          _id: { $ne: req.params.id },
          governorate: governorateId,
          $or: [
            ...(req.body.name ? [{ name: req.body.name }] : []),
            ...(req.body.nameAr ? [{ nameAr: req.body.nameAr }] : []),
            ...(req.body.code ? [{ code: req.body.code }] : []),
          ],
        });

        if (existingCity) {
          return res.status(400).json({
            success: false,
            error: "City with this name, Arabic name, or code already exists in this governorate",
          });
        }
      }

      const updatedCity = await City.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate("governorate", "name nameAr code")
        .populate("createdBy", "name email");

      res.status(200).json({
        success: true,
        data: updatedCity,
      });
    } catch (error) {
      console.error("Error updating city:", error);
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
);

// @route   DELETE /api/cities/:id
// @desc    Delete city (soft delete)
// @access  Private (Admin only)
router.delete("/:id", [protect, authorize("admin")], async (req, res) => {
  try {
    const city = await City.findById(req.params.id);

    if (!city) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    city.isActive = false;
    await city.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Error deleting city:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

// @route   GET /api/cities/by-governorate/:governorateId
// @desc    Get all cities for a specific governorate
// @access  Private
router.get("/by-governorate/:governorateId", protect, async (req, res) => {
  try {
    const governorate = await Governorate.findById(req.params.governorateId);
    if (!governorate) {
      return res.status(404).json({
        success: false,
        error: "Governorate not found",
      });
    }

    const cities = await City.find({ 
      governorate: req.params.governorateId, 
      isActive: true 
    })
      .sort({ name: 1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities,
    });
  } catch (error) {
    console.error("Error fetching cities by governorate:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

// @route   GET /api/cities/status-summary
// @desc    Get status summary for all cities
// @access  Private
router.get("/status-summary", protect, async (req, res) => {
  try {
    const summary = await City.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await City.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        summary,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching city status summary:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
});

module.exports = router;
