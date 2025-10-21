require('dotenv').config();
const mongoose = require('mongoose');
const Review = require('./models/Review');
const Product = require('./models/Product');
const User = require('./models/User');

const seedReviews = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get some products and users
    const products = await Product.find({ isActive: true }).limit(5);
    const users = await User.find({ isActive: true }).limit(5);

    if (products.length === 0 || users.length === 0) {
      console.log('❌ No products or users found. Please add some first.');
      process.exit(1);
    }

    console.log(`Found ${products.length} products and ${users.length} users`);

    // Sample reviews data
    const reviewsData = [
      {
        rating: 5,
        comment: 'منتج ممتاز! جودة عالية وسعر مناسب. أنصح بشدة بالشراء.'
      },
      {
        rating: 4,
        comment: 'منتج جيد جداً، لكن التوصيل كان متأخر قليلاً.'
      },
      {
        rating: 5,
        comment: 'رائع! تماماً كما في الوصف. شكراً للبائع.'
      },
      {
        rating: 3,
        comment: 'المنتج مقبول، لكن كنت أتوقع أفضل من ذلك.'
      },
      {
        rating: 5,
        comment: 'Excellent product! Fast shipping and great quality.'
      },
      {
        rating: 4,
        comment: 'Good value for money. Would buy again.'
      },
      {
        rating: 5,
        comment: 'أفضل منتج اشتريته هذا العام! جودة ممتازة.'
      },
      {
        rating: 4,
        comment: 'منتج جيد، التغليف كان ممتاز والتوصيل سريع.'
      },
      {
        rating: 5,
        comment: 'Perfect! Exactly what I was looking for.'
      },
      {
        rating: 3,
        comment: 'المنتج جيد لكن السعر مرتفع قليلاً.'
      }
    ];

    // Create reviews
    const reviews = [];
    let reviewIndex = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Add 2-3 reviews per product
      const numReviews = Math.floor(Math.random() * 2) + 2; // 2 or 3 reviews
      
      for (let j = 0; j < numReviews && reviewIndex < reviewsData.length; j++) {
        const userIndex = (i + j) % users.length;
        
        try {
          // Check if review already exists
          const existingReview = await Review.findOne({
            user: users[userIndex]._id,
            product: product._id
          });

          if (!existingReview) {
            const review = await Review.create({
              user: users[userIndex]._id,
              product: product._id,
              rating: reviewsData[reviewIndex].rating,
              comment: reviewsData[reviewIndex].comment
            });
            reviews.push(review);
            console.log(`✅ Created review for product: ${product.name}`);
          } else {
            console.log(`⚠️  Review already exists for product: ${product.name}`);
          }
        } catch (error) {
          if (error.code === 11000) {
            console.log(`⚠️  Duplicate review skipped for product: ${product.name}`);
          } else {
            console.error(`❌ Error creating review:`, error.message);
          }
        }
        
        reviewIndex++;
      }
    }

    console.log(`\n✅ Successfully created ${reviews.length} reviews!`);
    console.log('\nSample review:');
    console.log(reviews[0]);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding reviews:', error);
    process.exit(1);
  }
};

seedReviews();
