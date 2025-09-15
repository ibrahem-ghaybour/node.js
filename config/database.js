// config/database.js
const mongoose = require("mongoose");

if (!global.__mongoose) {
  global.__mongoose = { conn: null, promise: null };
}
const cached = global.__mongoose;

async function connectDB() {
  // إن كان فيه اتصال جاهز، رجّعه فورًا
  if (cached.conn) return cached.conn;

  // لا نعيد إنشاء الوعد إلا إذا كان null
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("❌ MONGODB_URI is missing!");
      throw new Error("MONGODB_URI is missing");
    }

    // ملاحظة: useNewUrlParser / useUnifiedTopology لم تعد مطلوبة في v6+
    cached.promise = mongoose
      .connect(uri, {
        maxPoolSize: 5, // قلّل الاستهلاك على السيرفرليس
      })
      .then((m) => {
        console.log("✅ MongoDB Connected:", m.connection.host);
        return m;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        cached.promise = null; // حتى نسمح بمحاولة لاحقة
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
