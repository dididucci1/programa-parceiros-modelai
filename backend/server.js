const app = require('./src/server');

if (require.main === module) {
  // Carrega .env apenas em dev local
  try { require('dotenv').config(); } catch {}
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
