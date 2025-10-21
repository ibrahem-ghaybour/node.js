const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');

/**
 * @route   GET /api/home
 * @desc    Get home page data (public)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // 1. Get statistics
    const [totalUsers, totalProducts, totalOrders, totalCategories] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Category.countDocuments({ isActive: true })
    ]);

    // Calculate average rating from all reviews
    const ratingStats = await Review.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalUsers,
      totalProducts,
      totalOrders,
      totalCategories,
      averageRating: ratingStats.length > 0 ? Number(ratingStats[0].averageRating.toFixed(1)) : 0,
      totalReviews: ratingStats.length > 0 ? ratingStats[0].totalReviews : 0
    };

    // 2. Get latest 10 products
    const latestProducts = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('category', 'name description')
      .populate('createdBy', 'name email')
      .select('name description price stock images primaryImage category createdAt');

    // 3. Get all active categories
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .populate('createdBy', 'name email')
      .select('name description createdAt');

    // 4. Get latest customer reviews (with user and product details)
    const customerReviews = await Review.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email avatar')
      .populate('product', 'name primaryImage')
      .select('rating comment createdAt');

    // 5. Get featured/top-rated products
    const topRatedProducts = await Review.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      },
      { $match: { totalReviews: { $gte: 1 } } }, // At least 1 review
      { $sort: { averageRating: -1, totalReviews: -1 } },
      { $limit: 6 }
    ]);

    // Populate product details for top-rated products
    const topRatedProductIds = topRatedProducts.map(p => p._id);
    const topRatedProductDetails = await Product.find({
      _id: { $in: topRatedProductIds },
      isActive: true
    })
      .populate('category', 'name')
      .select('name description price stock images primaryImage category');

    // Merge ratings with product details
    const featuredProducts = topRatedProductDetails.map(product => {
      const ratingInfo = topRatedProducts.find(r => r._id.toString() === product._id.toString());
      return {
        ...product.toObject(),
        averageRating: ratingInfo ? Number(ratingInfo.averageRating.toFixed(1)) : 0,
        totalReviews: ratingInfo ? ratingInfo.totalReviews : 0
      };
    });

    // 6. Additional data - Why Choose Us features
    const whyChooseUs = [
      {
        title: 'Free Shipping',
        description: 'Free shipping on orders over $100',
        icon: 'truck'
      },
      {
        title: 'Secure Payment',
        description: '100% secure payment methods',
        icon: 'shield'
      },
      {
        title: 'Easy Returns',
        description: '30-day return policy',
        icon: 'refresh'
      },
      {
        title: 'Premium Quality',
        description: 'High-quality products guaranteed',
        icon: 'award'
      }
    ];

    // Return all data
    res.json({
      success: true,
      data: {
        stats,
        latestProducts,
        featuredProducts,
        categories,
        customerReviews,
        whyChooseUs
      }
    });

  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching home page data',
      error: error.message
    });
  }
});

module.exports = router;
