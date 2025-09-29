// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const connectDB = require("./config/database");

const app = express();

// 🔐 مهم لو تشغّل خلف بروكسي/HTTPS (Vercel/NGINX...)
app.set("trust proxy", 1);

connectDB();

// ⚠️ اضبط Helmet (الإعداد الافتراضي جيد عادة)
app.use(helmet());

// ✅ CORS مضبوط مع credentials (السماح لأي Origin)
// ملاحظة: استخدام origin: true يعكس Origin الوارد من الطلب ويسمح للجميع،
// وهو متوافق مع credentials: true (بعكس "*" التي لا تعمل مع credentials)
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// (اختياري) لبعض بيئات الاستضافة يمكنك إضافة:
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

(function sanityEnvCheck() {
  const has = (k) => (process.env[k] ? "OK" : "MISSING");
  console.log("[ENV] MONGODB_URI:", has("MONGODB_URI"));
  console.log("[ENV] JWT_SECRET:", has("JWT_SECRET"));
  console.log("[ENV] JWT_REFRESH_SECRET:", has("JWT_REFRESH_SECRET"));
  console.log("[ENV] NODE_ENV:", process.env.NODE_ENV);
  console.log("[ENV] APP_ORIGINS:", process.env.APP_ORIGINS); // 👈 لتتأكد
})();

// المسارات
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/governorates", require("./routes/governorates"));
app.use("/api/cities", require("./routes/cities"));
app.use("/api/wishlist", require("./routes/wishlist"));
app.use("/api/requests", require("./routes/requests"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/addresses", require("./routes/addresses"));
app.use("/api/settings", require("./routes/settings"));

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
      login: "/api/auth/login",
      register: "/api/auth/register",
      refresh: "/api/auth/refresh",
      users: "/api/users",
      products: "/api/products",
      health: "/api/health",
      categories: "/api/categories",
      governorates: "/api/governorates",
      cities: "/api/cities",
      wishlist: "/api/wishlist",
      requests: "/api/requests",
      orders: "/api/orders",
      cart: "/api/cart",
      stats: "/api/stats",
      addresses: "/api/addresses",
      settings: "/api/settings",
    },
  });
});

app.use(require("./middleware/errorHandler"));
module.exports = app;

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
