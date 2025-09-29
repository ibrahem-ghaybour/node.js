const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

// Multer setup: use memory storage to be compatible with serverless (no disk writes)
const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files are allowed'));
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }
});

// @route   GET /api/products
// @desc    Get all products with pagination
// @access  Private
router.get('/', [
  protect,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isMongoId().withMessage('Category must be a valid ObjectId'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'updatedAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res) => {
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
    
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      query.price = {};
      if (req.query.minPrice !== undefined) {
        query.price.$gte = parseFloat(req.query.minPrice);
      }
      if (req.query.maxPrice !== undefined) {
        query.price.$lte = parseFloat(req.query.maxPrice);
      }
    }

    // Build sort
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sort = { [req.query.sortBy]: sortOrder };
    }

    // Get total count
    const total = await Product.countDocuments(query);
    
    // Get products
    const products = await Product.find(query)
      .populate('createdBy', 'name email')
      .populate('category', 'name description')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: products.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: products
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Private
router.get('/:id', [
  protect
], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('category', 'name description');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private
router.post('/', [
  protect,
  body('name').notEmpty().withMessage('Product name is required').isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description').notEmpty().withMessage('Product description is required').isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').notEmpty().withMessage('Product category is required').isMongoId().withMessage('Category must be a valid ObjectId'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if category exists and is active
    const Category = require('../models/Category');
    const category = await Category.findOne({ 
      _id: req.body.category, 
      isActive: true 
    });
    
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or inactive category' 
      });
    }
    
    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      stock: req.body.stock,
      createdBy: req.user.id
    });

    const createdProduct = await product.save();
    
    // Populate category for response
    await createdProduct.populate('category', 'name description');

    res.status(201).json({
      success: true,
      data: createdProduct
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products/:id/images
// @desc    Upload up to 5 images for a product
// @access  Private
router.post('/:id/images', [protect, upload.array('images', 5)], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Check ownership/admin
    if (product.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'No images uploaded' });

    // Hotfix behavior: without cloud storage configured, reject to avoid crashing on serverless
    const hasCloud = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
    if (!hasCloud) {
      return res.status(503).json({
        success: false,
        message: 'Image storage is not configured for this deployment. Please configure Cloudinary or another storage provider.'
      });
    }

    // If storage is configured, this route should be updated to upload buffers to the provider.
    return res.status(501).json({ success: false, message: 'Upload handler not implemented yet for the configured storage.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PATCH /api/products/:id/primary-image
// @desc    Set the primary image for a product
// @access  Private
router.patch('/:id/primary-image', [protect, body('url').isString().notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const { url } = req.body;
    if (!product.images.includes(url)) {
      return res.status(400).json({ message: 'URL is not part of product images' });
    }
    product.primaryImage = url;
    await product.save();
    res.json({ success: true, data: { primaryImage: product.primaryImage } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/products/:id/images
// @desc    Remove a specific image from a product
// @access  Private
router.delete('/:id/images', [protect, body('url').isString().notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const { url } = req.body;
    if (!product.images.includes(url)) return res.status(404).json({ message: 'Image not found on product' });

    // Remove from array
    product.images = product.images.filter(u => u !== url);
    if (product.primaryImage === url) product.primaryImage = product.images[0] || '';

    await product.save();
    res.json({ success: true, data: { images: product.images, primaryImage: product.primaryImage } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id', [
  protect,
  body('name').optional().isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').optional().isMongoId().withMessage('Category must be a valid ObjectId'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a positive integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user is the creator or admin
    if (product.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    // Update product fields
    const updateFields = {};
    if (req.body.name !== undefined) updateFields.name = req.body.name;
    if (req.body.description !== undefined) updateFields.description = req.body.description;
    if (req.body.price !== undefined) updateFields.price = req.body.price;
    if (req.body.stock !== undefined) updateFields.stock = req.body.stock;
    if (req.body.isActive !== undefined) updateFields.isActive = req.body.isActive;
    updateFields.updatedAt = Date.now();

    // Check if category is being updated and validate it
    if (req.body.category !== undefined) {
      const Category = require('../models/Category');
      const category = await Category.findOne({ 
        _id: req.body.category, 
        isActive: true 
      });
      
      if (!category) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid or inactive category' 
        });
      }
      updateFields.category = req.body.category;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('category', 'name description');

    res.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete('/:id', [
  protect
], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user is the creator or admin
    if (product.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await product.remove();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
