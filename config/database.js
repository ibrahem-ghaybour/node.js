// config/database.js
const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        // هذي الخيارات لم تعد ضرورية بالإصدارات الحديثة، بس نحطها للأمان
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 5, // لتقليل الاستهلاك
      })
      .then((mongooseInstance) => {
        console.log("MongoDB Connected:", mongooseInstance.connection.host);
        return mongooseInstance;
      })
      .catch((err) => {
        console.error("MongoDB connection error:", err);
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
