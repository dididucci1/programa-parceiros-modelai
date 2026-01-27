const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, enum: ['admin', 'parceiro'], default: 'parceiro' },
    status: { type: String, enum: ['ativo', 'inativo'], default: 'ativo' },
    // Guardar hash da senha; não selecionar por padrão
    senha: { type: String, required: true, select: false },
    // Fluxo de primeiro acesso: exige troca de senha e aceite de termo
    primeiraSenha: { type: Boolean, default: true },
    termoAceite: { type: Boolean, default: false },
    dataAceiteTermo: { type: Date, default: null },
    ultimoAcesso: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Usuario', UsuarioSchema);
