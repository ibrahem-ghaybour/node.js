const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/reviews
 * @desc    Get all reviews (with filters)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { product, user, rating, page = 1, limit = 10 } = req.query;
    
    const query = { isActive: true };
    
    if (product) query.product = product;
    if (user) query.user = user;
    if (rating) query.rating = Number(rating);
    
    const skip = (page - 1) * limit;
    
    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('user', 'name email avatar')
        .populate('product', 'name primaryImage price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      count: reviews.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/reviews/product/:productId
 * @desc    Get all reviews for a specific product
 * @access  Public
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const [reviews, total, stats] = await Promise.all([
      Review.find({ product: productId, isActive: true })
        .populate('user', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments({ product: productId, isActive: true }),
      Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId), isActive: true } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            ratings: {
              $push: '$rating'
            }
          }
        }
      ])
    ]);
    
    // Calculate rating distribution
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0 && stats[0].ratings) {
      stats[0].ratings.forEach(rating => {
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });
    }
    
    res.json({
      success: true,
      count: reviews.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      stats: {
        averageRating: stats.length > 0 ? Number(stats[0].averageRating.toFixed(1)) : 0,
        totalReviews: stats.length > 0 ? stats[0].totalReviews : 0,
        ratingDistribution
      },
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product reviews',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/reviews/:id
 * @desc    Get single review
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate('product', 'name primaryImage price');
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/reviews
 * @desc    Create a new review
 * @access  Private (authenticated users only)
 */
router.post('/', protect, async (req, res) => {
  try {
    const { product, rating, comment } = req.body;
    
    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user._id,
      product
    });
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. Please update your existing review instead.'
      });
    }
    
    const review = await Review.create({
      user: req.user._id,
      product,
      rating,
      comment
    });
    
    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name email avatar')
      .populate('product', 'name primaryImage price');
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: populatedReview
    });
  } catch (error) {
    console.error('Error creating review:', error);
    
    // Handle duplicate review error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update a review
 * @access  Private (owner or admin)
 */
router.put('/:id', protect, async (req, res) => {
  try {
    let review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user is the owner or admin
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }
    
    const { rating, comment } = req.body;
    
    review = await Review.findByIdAndUpdate(
      req.params.id,
      { rating, comment },
      { new: true, runValidators: true }
    )
      .populate('user', 'name email avatar')
      .populate('product', 'name primaryImage price');
    
    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review (soft delete)
 * @access  Private (owner or admin)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user is the owner or admin
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }
    
    // Soft delete
    review.isActive = false;
    await review.save();
    
    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/reviews/:id/permanent
 * @desc    Permanently delete a review
 * @access  Private (admin only)
 */
router.delete('/:id/permanent', protect, authorize('admin'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    await review.deleteOne();
    
    res.json({
      success: true,
      message: 'Review permanently deleted'
    });
  } catch (error) {
    console.error('Error permanently deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting review',
      error: error.message
    });
  }
});

module.exports = router;
