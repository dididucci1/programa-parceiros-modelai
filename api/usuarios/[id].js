const { connectDB } = require('../_db');
const { ensureAdmin } = require('../_auth');
const Usuario = require('../../backend/src/models/Usuario');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  try{
    await connectDB();
    const user = ensureAdmin(req, res);
    if(!user) return;

    const id = req.query.id;

    if(req.method === 'PUT'){
      const body = { ...(req.body || {}) };
      if (typeof body.senha === 'string' && body.senha.trim() !== '') {
        body.senha = await bcrypt.hash(String(body.senha), 10);
      } else {
        delete body.senha;
      }
      const updated = await Usuario.findByIdAndUpdate(id, body, { new: true }).select('-senha');
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }

    if(req.method === 'DELETE'){
      const removed = await Usuario.findByIdAndDelete(id);
      if (!removed) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e){
    res.status(400).json({ error: e.message });
  }
};
