const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../_db');
const Usuario = require('../../backend/src/models/Usuario');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    await connectDB();
    const email = String((req.body && req.body.email) || '').toLowerCase();
    const senha = String((req.body && req.body.senha) || '');
    const user = await Usuario.findOne({ email });
    if(!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const stored = String(user.senha || '');
    let ok = false;
    if (stored.startsWith('$2')) ok = await bcrypt.compare(senha, stored);
    else ok = senha === stored;
    if(!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = { id: user._id.toString(), email: user.email, role: user.role };
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });
    const safeUser = { id: user._id, nome: user.nome, email: user.email, role: user.role, status: user.status };
    res.json({ token, user: safeUser });
  }catch(e){
    res.status(400).json({ error: e.message });
  }
};
