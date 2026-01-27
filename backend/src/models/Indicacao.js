const mongoose = require('mongoose');

const IndicacaoSchema = new mongoose.Schema(
  {
    incorporadora: { type: String, required: true },
    contatoNome: { type: String, required: true },
    cargoRepresentante: { type: String },
    contatoTelefone: { type: String, required: true },
    contatoEmail: { type: String },
    servicoInteresse: { type: String, required: true },
    observacoes: { type: String },
    status: { type: String, enum: ['Novo', 'Em Andamento', 'Reunião Agendada', 'Reunião Realizada', 'Fechado', 'Cancelado/Sem resposta'], default: 'Em Andamento' },
    dataUltimaModificacaoStatus: { type: Date },
    dataRegistro: { type: String },
    dataVencimento: { type: String },
    urgencia: { type: String },
    valorComissao: { type: Number },
    prazoComissao: { type: Number },
    pagamentos: [{ type: Date }],
    usuarioEmail: { type: String, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Indicacao', IndicacaoSchema);
