const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, enum: ['admin', 'parceiro'], default: 'parceiro' },
    status: { type: String, enum: ['ativo', 'inativo'], default: 'ativo' },
    senha: { type: String, required: true }, // Observação: somente para demo
    ultimoAcesso: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Usuario', UsuarioSchema);
