const mongoose = require('mongoose');

// Conexão mínima e direta usando a URI fornecida via ambiente
let connection = null;

function maskURI(uri) {
  try {
    return String(uri).replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/i, '$1***@');
  } catch {
    return '<redacted>';
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const msg = 'Banco de dados não configurado: defina MONGODB_URI';
    console.error(`[mongo] ${msg}`);
    const err = new Error(msg);
    err.statusCode = 500;
    throw err;
  }

  if (connection && connection.readyState === 1) return connection;

  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  const start = Date.now();
  console.log('[mongo] conectando...', maskURI(uri));

  connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  }).then(m => {
    const ms = Date.now() - start;
    console.log(`[mongo] conectado em ${ms}ms`);
    return m.connection;
  }).catch(err => {
    console.error(`[mongo] falha ao conectar ${maskURI(uri)}: ${err.message}`);
    throw err;
  });

  return connection;
}

module.exports = { connectDB };
