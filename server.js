// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const connectDB = require("./config/database"); // يستخدم كاش

// ملاحظة: على Vercel متغيرات البيئة موجودة جاهزة، dotenv ليس ضروري
// لو عندك .env محلي للتطوير، يبقى ممكن تستخدمه محلياً فقط
// const dotenv = require('dotenv'); dotenv.config();

const app = express();

// اتصل بقاعدة البيانات (مرّة واحدة مع كاش)
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/governorates", require("./routes/governorates"));
app.use("/api/cities", require("./routes/cities"));
app.use("/api/wishlist", require("./routes/wishlist"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Express MongoDB Backend API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      products: "/api/products",
      health: "/api/health",
      categories: "/api/categories",
      governorates: "/api/governorates",
      cities: "/api/cities",
      wishlist: "/api/wishlist",
    },
  });
});

// Error handler (آخر middleware)
app.use(require("./middleware/errorHandler"));

// لا يوجد app.listen على Vercel
module.exports = app;

// لوج للأخطاء غير الملتقطة (بدون server.close)
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
