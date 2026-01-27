const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const Indicacao = require('./src/models/Indicacao');

async function migrate() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado!');

    console.log('Atualizando indicações antigas...');
    const result = await Indicacao.updateMany(
      { dataUltimaModificacaoStatus: { $exists: false } },
      { $set: { dataUltimaModificacaoStatus: new Date() } }
    );

    console.log(`✓ ${result.modifiedCount} indicações atualizadas com sucesso!`);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

migrate();
