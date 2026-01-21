const mongoose = require('mongoose');

// Global cache para reutilizar conexão em ambiente serverless
const globalCache = globalThis.__MONGO_CACHE__ || { conn: null, promise: null };
globalThis.__MONGO_CACHE__ = globalCache;

// Mascara senha na URI para logs
function maskURI(uri) {
  try {
    return String(uri).replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/i, '$1***@');
  } catch {
    return '<redacted>';
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    const msg = 'Banco de dados não configurado: defina MONGODB_URI';
    console.error(`[mongo] ${msg}`);
    const err = new Error(msg);
    err.statusCode = 500;
    throw err;
  }

  if (globalCache.conn) return globalCache.conn;
  if (!globalCache.promise) {
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);

    const start = Date.now();
    console.log('[mongo] conectando...', maskURI(uri));
    globalCache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1
    }).then((mongooseInstance) => {
      const ms = Date.now() - start;
      console.log(`[mongo] conectado em ${ms}ms`);
      return mongooseInstance.connection;
    }).catch((err) => {
      console.error(`[mongo] falha ao conectar ${maskURI(uri)}: ${err.message}`);
      throw err;
    });

    const conn = mongoose.connection;
    conn.on('connected', () => console.log('[mongo] event: connected'));
    conn.on('disconnected', () => console.warn('[mongo] event: disconnected'));
    conn.on('error', (err) => console.error('[mongo] event: error', err.message));
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

module.exports = { connectDB };
