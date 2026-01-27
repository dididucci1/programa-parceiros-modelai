const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const Indicacao = require('./src/models/Indicacao');

async function checkReuniaoRealizada() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado!');

    console.log('Verificando indicações com "Reunião Realizada" há mais de 3 meses...');
    
    const treseMesesAtras = new Date();
    treseMesesAtras.setMonth(treseMesesAtras.getMonth() - 3);

    const result = await Indicacao.updateMany(
      {
        status: 'Reunião Realizada',
        dataUltimaModificacaoStatus: { $lte: treseMesesAtras }
      },
      {
        $set: { 
          status: 'Cancelado/Sem resposta',
          dataUltimaModificacaoStatus: new Date()
        }
      }
    );

    console.log(`✓ ${result.modifiedCount} indicações atualizadas para "Cancelado/Sem resposta"`);
    
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

checkReuniaoRealizada();
