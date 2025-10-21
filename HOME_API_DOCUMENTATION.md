# Home API Documentation

## Overview
الـ Home API هو endpoint عام (public) يوفر جميع البيانات اللازمة لصفحة الهوم في التطبيق.

## Endpoint
```
GET /api/home
```

## Access
- **Public** - لا يتطلب تسجيل دخول

## Response Structure

### 1. Statistics (الإحصائيات)
```json
{
  "stats": {
    "totalUsers": 11,
    "totalProducts": 5,
    "totalOrders": 28,
    "totalCategories": 2,
    "averageRating": 4.5,
    "totalReviews": 150
  }
}
```

### 2. Latest Products (آخر 10 منتجات)
```json
{
  "latestProducts": [
    {
      "_id": "...",
      "name": "Product Name",
      "description": "Product Description",
      "price": 199.99,
      "stock": 25,
      "images": ["url1", "url2"],
      "primaryImage": "main_image_url",
      "category": {
        "_id": "...",
        "name": "Category Name",
        "description": "Category Description"
      },
      "createdBy": {
        "_id": "...",
        "name": "User Name",
        "email": "user@email.com"
      },
      "createdAt": "2025-10-18T19:12:09.152Z"
    }
  ]
}
```

### 3. Featured Products (المنتجات المميزة - الأعلى تقييماً)
```json
{
  "featuredProducts": [
    {
      "_id": "...",
      "name": "Product Name",
      "description": "Product Description",
      "price": 299.99,
      "stock": 15,
      "images": ["url1", "url2"],
      "primaryImage": "main_image_url",
      "category": {
        "_id": "...",
        "name": "Category Name"
      },
      "averageRating": 4.8,
      "totalReviews": 45
    }
  ]
}
```

### 4. Categories (الفئات)
```json
{
  "categories": [
    {
      "_id": "...",
      "name": "Category Name",
      "description": "Category Description",
      "createdBy": {
        "_id": "...",
        "name": "User Name",
        "email": "user@email.com"
      },
      "createdAt": "2025-09-20T07:28:57.784Z"
    }
  ]
}
```

### 5. Customer Reviews (آراء العملاء)
```json
{
  "customerReviews": [
    {
      "_id": "...",
      "rating": 5,
      "comment": "Excellent product!",
      "user": {
        "_id": "...",
        "name": "Customer Name",
        "email": "customer@email.com",
        "avatar": "avatar_url"
      },
      "product": {
        "_id": "...",
        "name": "Product Name",
        "primaryImage": "product_image_url"
      },
      "createdAt": "2025-10-18T19:12:09.152Z"
    }
  ]
}
```

### 6. Why Choose Us (لماذا تختارنا)
```json
{
  "whyChooseUs": [
    {
      "title": "Free Shipping",
      "description": "Free shipping on orders over $100",
      "icon": "truck"
    },
    {
      "title": "Secure Payment",
      "description": "100% secure payment methods",
      "icon": "shield"
    },
    {
      "title": "Easy Returns",
      "description": "30-day return policy",
      "icon": "refresh"
    },
    {
      "title": "Premium Quality",
      "description": "High-quality products guaranteed",
      "icon": "award"
    }
  ]
}
```

## Complete Response Example
```json
{
  "success": true,
  "data": {
    "stats": { ... },
    "latestProducts": [ ... ],
    "featuredProducts": [ ... ],
    "categories": [ ... ],
    "customerReviews": [ ... ],
    "whyChooseUs": [ ... ]
  }
}
```

## Usage Examples

### cURL
```bash
curl http://localhost:5000/api/home
```

### JavaScript (Fetch)
```javascript
fetch('http://localhost:5000/api/home')
  .then(response => response.json())
  .then(data => {
    console.log('Stats:', data.data.stats);
    console.log('Latest Products:', data.data.latestProducts);
    console.log('Categories:', data.data.categories);
  });
```

### Axios
```javascript
import axios from 'axios';

const getHomeData = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/home');
    return response.data;
  } catch (error) {
    console.error('Error fetching home data:', error);
  }
};
```

## Notes
- جميع البيانات المعروضة هي للعناصر النشطة فقط (`isActive: true`)
- المنتجات المميزة يتم ترتيبها حسب التقييم الأعلى
- آخر 10 منتجات يتم ترتيبها حسب تاريخ الإنشاء (الأحدث أولاً)
- آراء العملاء محدودة بـ 10 مراجعات (الأحدث أولاً)

---

# Reviews API Documentation

## Endpoints

### 1. Get All Reviews
```
GET /api/reviews
```
**Query Parameters:**
- `product` - Filter by product ID
- `user` - Filter by user ID
- `rating` - Filter by rating (1-5)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

### 2. Get Reviews for Specific Product
```
GET /api/reviews/product/:productId
```
**Response includes:**
- Reviews list
- Average rating
- Total reviews count
- Rating distribution (1-5 stars)

### 3. Get Single Review
```
GET /api/reviews/:id
```

### 4. Create Review
```
POST /api/reviews
```
**Authentication:** Required
**Body:**
```json
{
  "product": "product_id",
  "rating": 5,
  "comment": "Great product!"
}
```

### 5. Update Review
```
PUT /api/reviews/:id
```
**Authentication:** Required (Owner or Admin)
**Body:**
```json
{
  "rating": 4,
  "comment": "Updated comment"
}
```

### 6. Delete Review (Soft Delete)
```
DELETE /api/reviews/:id
```
**Authentication:** Required (Owner or Admin)

### 7. Permanently Delete Review
```
DELETE /api/reviews/:id/permanent
```
**Authentication:** Required (Admin only)

## Features
- ✅ منع المستخدم من إضافة أكثر من مراجعة واحدة لنفس المنتج
- ✅ حساب متوسط التقييم تلقائياً
- ✅ توزيع التقييمات (Rating Distribution)
- ✅ Soft delete للمراجعات
- ✅ التحقق من صلاحيات المستخدم
