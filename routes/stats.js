const express = require("express");
const { query, validationResult } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
};

// دالة لإرجاع start/end
function getDateRange(req) {
  let start, end;

  if (req.query.start && req.query.end) {
    start = new Date(req.query.start);
    end = new Date(req.query.end);
  } else {
    // الحالة الافتراضية: آخر شهر من اليوم
    end = new Date();
    start = new Date();
    start.setMonth(end.getMonth() - 1);
  }

  return { start, end };
}

// GET /api/stats/dashboard
router.get(
  "/dashboard",
  [
    protect,
    authorize("admin", "manager"),
    query("start").optional().isISO8601(),
    query("end").optional().isISO8601(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;

    try {
      const { start, end } = getDateRange(req);

      // الفترة السابقة للمقارنة
      const prevEnd = new Date(start);
      const prevStart = new Date(start);
      prevStart.setTime(start.getTime() - (end.getTime() - start.getTime()));

      const limit = parseInt(req.query.limit) || 10;

      const revenueStatuses = ["paid", "shipped", "delivered"];

      // Revenue & Sales (الحالي)
      const revenueAgg = await Order.aggregate([
        {
          $match: {
            isActive: true,
            status: { $in: revenueStatuses },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
          },
        },
      ]);
      const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
      const sales = revenueAgg[0]?.salesCount || 0;

      // Revenue & Sales (الفترة السابقة)
      const revenueAggPrev = await Order.aggregate([
        {
          $match: {
            isActive: true,
            status: { $in: revenueStatuses },
            createdAt: { $gte: prevStart, $lte: prevEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
          },
        },
      ]);
      const totalRevenuePrev = revenueAggPrev[0]?.totalRevenue || 0;
      const salesPrev = revenueAggPrev[0]?.salesCount || 0;

      // Subscriptions (مستخدمين جدد)
      const [subscriptions, subscriptionsPrev] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
        User.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
      ]);

      // Active users
      const [activeNow, activeNowPrev] = await Promise.all([
        User.countDocuments({
          status: "active",
          isActive: true,
          updatedAt: { $gte: start, $lte: end },
        }),
        User.countDocuments({
          status: "active",
          isActive: true,
          updatedAt: { $gte: prevStart, $lte: prevEnd },
        }),
      ]);

      // Overview: الإيراد يوم بيوم
      const overviewAgg = await Order.aggregate([
        {
          $match: {
            isActive: true,
            status: { $in: revenueStatuses },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const byDate = new Map(overviewAgg.map((r) => [r._id, r]));
      const series = [];
      const iter = new Date(start);
      while (iter <= end) {
        const key = iter.toISOString().slice(0, 10);
        const v = byDate.get(key) || { revenue: 0, orders: 0 };
        series.push({
          date: key,
          revenue: v.revenue || 0,
          orders: v.orders || 0,
        });
        iter.setDate(iter.getDate() + 1);
      }

      // Recent Sales
      const recentSales = await Order.find({
        isActive: true,
        status: { $in: revenueStatuses },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "name email")
        .select("totalAmount currency status createdAt user");

      const pct = (curr, prev) => {
        if (prev === 0 && curr === 0) return 0;
        if (prev === 0) return 100;
        return ((curr - prev) / prev) * 100;
      };

      res.json({
        success: true,
        range: { start, end },
        data: {
          totalRevenue,
          subscriptions,
          sales,
          activeNow,
          overview: series,
          recentSales,
          change: {
            totalRevenue: pct(totalRevenue, totalRevenuePrev),
            subscriptions: pct(subscriptions, subscriptionsPrev),
            sales: pct(sales, salesPrev),
            activeNow: pct(activeNow, activeNowPrev),
          },
          current: {
            totalRevenue,
            subscriptions,
            sales,
            activeNow,
          },
          previous: {
            totalRevenue: totalRevenuePrev,
            subscriptions: subscriptionsPrev,
            sales: salesPrev,
            activeNow: activeNowPrev,
          },
        },
      });
    } catch (e) {
      console.error("Error computing dashboard stats:", e);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
