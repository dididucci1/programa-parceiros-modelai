const { connectDB } = require('../_db');
const { ensureAdmin } = require('../_auth');
const Usuario = require('../../backend/src/models/Usuario');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  try{
    await connectDB();
    const user = ensureAdmin(req, res);
    if(!user) return;

    if(req.method === 'GET'){
      const list = await Usuario.find().select('-senha').sort({ createdAt: -1 });
      return res.json(list);
    }

    if(req.method === 'POST'){
      const { nome, email, role = 'parceiro', senha, status = 'ativo' } = req.body || {};
      const hashed = senha ? await bcrypt.hash(String(senha), 10) : undefined;
      const created = await Usuario.create({ nome, email, role, senha: hashed, status });
      const { senha: _, ...safe } = created.toObject();
      return res.status(201).json(safe);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e){
    res.status(400).json({ error: e.message });
  }
};
