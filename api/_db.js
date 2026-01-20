const mongoose = require('mongoose');

let cached = global.__mongooseConn;
if (!cached) {
  cached = global.__mongooseConn = { conn: null, promise: null };
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI');
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
