const mongoose = require('mongoose');

let cached = global.__mongooseConn;
if (!cached) {
  cached = global.__mongooseConn = { conn: null, promise: null };
}

function maskURI(uri) {
  try {
    return String(uri).replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/i, '$1***@');
  } catch {
    return '<redacted>';
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI');
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);
    const start = Date.now();
    console.log('[api mongo] connecting...', maskURI(uri));
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    }).then((m) => {
      console.log('[api mongo] connected in', Date.now() - start, 'ms');
      return m.connection;
    }).catch((err) => {
      console.error('[api mongo] connect error:', err.message);
      throw err;
    });
    const conn = mongoose.connection;
    conn.on('connected', () => console.log('[api mongo] event: connected'));
    conn.on('disconnected', () => console.warn('[api mongo] event: disconnected'));
    conn.on('error', (err) => console.error('[api mongo] event: error', err.message));
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
