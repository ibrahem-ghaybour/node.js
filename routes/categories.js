const express = require("express");
const { body, validationResult, query } = require("express-validator");
const Category = require("../models/Category");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all categories with pagination
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
    query("sortBy")
      .optional()
      .isIn(["name", "createdAt", "updatedAt"])
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

      // Build sort object
      let sort = {};
      if (req.query.sortBy) {
        sort[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
      } else {
        sort.name = 1; // Default sort by name ascending
      }

      const categories = await Category.find(query)
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Category.countDocuments(query);

      res.status(200).json({
        success: true,
        count: categories.length,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        data: categories,
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  }
);

// @route   GET /api/categories/:id
// @desc    Get single category by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private (Admin/Manager only)
router.post(
  "/",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .notEmpty()
      .withMessage("Category name is required")
      .isLength({ max: 60 })
      .withMessage("Category name cannot exceed 60 characters"),
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
      const { name, description } = req.body;

      // Check if category already exists
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: "Category with this name already exists",
        });
      }

      const category = await Category.create({
        name,
        description,
        createdBy: req.user.id,
      });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  }
);

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private (Admin/Manager only)
router.put(
  "/:id",
  [
    protect,
    authorize("admin", "manager"),
    body("name")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Category name cannot exceed 50 characters"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, isActive } = req.body;

      // Check if category exists
      let category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      // If updating name, check if it's already taken by another category
      if (name && name !== category.name) {
        const existingCategory = await Category.findOne({
          name,
          _id: { $ne: req.params.id },
        });
        if (existingCategory) {
          return res.status(400).json({
            success: false,
            error: "Category with this name already exists",
          });
        }
      }

      // Update category
      category = await Category.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description,
          isActive,
          updatedAt: Date.now(),
        },
        { new: true, runValidators: true }
      ).populate("createdBy", "name email");

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  }
);

// @route   DELETE /api/categories/:id
// @desc    Delete a category (soft delete by setting isActive to false)
// @access  Private (Admin only)
router.delete("/:id", [protect, authorize("admin")], async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Check if there are products using this category
    const Product = require("../models/Product");
    const productsWithCategory = await Product.countDocuments({
      category: req.params.id,
      isActive: true,
    });

    if (productsWithCategory > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category. It is being used by ${productsWithCategory} product(s).`,
      });
    }

    // Soft delete by setting isActive to false
    category.isActive = false;
    await category.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

module.exports = router;
