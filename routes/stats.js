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

function parseRange(rangeStr) {
  // Accept forms like 7d, 30d, 12w, 6m; default 30d
  const m = /^([0-9]{1,3})([dwmy])$/i.exec(rangeStr || "30d");
  const now = new Date();
  if (!m) {
    const d = new Date(now);
    d.setDate(now.getDate() - 30);
    return { start: d, end: now, unit: "day", count: 30 };
  }
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const d = new Date(now);
  let count = n;
  switch (unit) {
    case "d":
      d.setDate(now.getDate() - n);
      count = n;
      return { start: d, end: now, unit: "day", count };
    case "w":
      d.setDate(now.getDate() - n * 7);
      count = n * 7;
      return { start: d, end: now, unit: "day", count };
    case "m":
      d.setMonth(now.getMonth() - n);
      // We'll return days approximation (30*n) for the series
      count = n * 30;
      return { start: d, end: now, unit: "day", count };
    case "y":
      d.setFullYear(now.getFullYear() - n);
      count = n * 365;
      return { start: d, end: now, unit: "day", count };
    default: {
      const dd = new Date(now);
      dd.setDate(now.getDate() - 30);
      return { start: dd, end: now, unit: "day", count: 30 };
    }
  }
}

// GET /api/stats/dashboard
router.get(
  "/dashboard",
  [
    protect,
    authorize("admin", "manager"),
    query("range").optional().isString(), // e.g., 30d
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const err = handleValidation(req, res);
    if (err) return;
    try {
      const { start, end } = parseRange(req.query.range);
      const prevEnd = new Date(start);
      const prevStart = new Date(start);
      prevStart.setTime(start.getTime() - (end.getTime() - start.getTime()));
      const limit = parseInt(req.query.limit) || 10;

      // Definitions (sensible defaults)
      const revenueStatuses = ["paid", "shipped", "delivered"]; // count towards revenue & sales

      // Total Revenue & Sales (current period)
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

      // Total Revenue & Sales (previous equivalent period)
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

      // Subscriptions: new users created within range (current and previous)
      const [subscriptions, subscriptionsPrev] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
        User.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
      ]);

      // Active Now: users with status 'active' updated within range (current and previous)
      const [activeNow, activeNowPrev] = await Promise.all([
        User.countDocuments({ status: "active", isActive: true, updatedAt: { $gte: start, $lte: end } }),
        User.countDocuments({ status: "active", isActive: true, updatedAt: { $gte: prevStart, $lte: prevEnd } }),
      ]);

      // Overview: revenue per day within range
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
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Fill missing days with zeros
      const byDate = new Map(overviewAgg.map((r) => [r._id, r]));
      const series = [];
      const iter = new Date(start);
      while (iter <= end) {
        const key = iter.toISOString().slice(0, 10);
        const v = byDate.get(key) || { revenue: 0, orders: 0 };
        series.push({ date: key, revenue: v.revenue || 0, orders: v.orders || 0 });
        iter.setDate(iter.getDate() + 1);
      }

      // Recent Sales: latest orders
      const recentSales = await Order.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "name email")
        .select("totalAmount currency status createdAt user");

      // Helper to compute percentage change vs previous period
      const pct = (curr, prev) => {
        if (prev === 0 && curr === 0) return 0;
        if (prev === 0) return 100;
        return ((curr - prev) / prev) * 100;
      };

      res.json({
        success: true,
        range: { start, end },
        data: {
          totalRevenue: pct(totalRevenue, totalRevenuePrev),
          subscriptions: pct(subscriptions, subscriptionsPrev),
          sales: pct(sales, salesPrev),
          activeNow: pct(activeNow, activeNowPrev),
          overview: series,
          recentSales,
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
