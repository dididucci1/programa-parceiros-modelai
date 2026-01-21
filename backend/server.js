const path = require('path');
const app = require('./src/server');

if (require.main === module) {
  // Carrega variáveis de ambiente em dev/local
  try { require('dotenv').config(); } catch {}
  // Fallback: tenta carregar .env.local na raiz do workspace
  try {
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
      require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
    }
  } catch {}

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
