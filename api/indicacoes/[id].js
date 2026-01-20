const { connectDB } = require('../_db');
const { ensureAdmin } = require('../_auth');
const Indicacao = require('../../backend/src/models/Indicacao');

module.exports = async (req, res) => {
  try{
    await connectDB();
    const user = ensureAdmin(req, res);
    if(!user) return;

    const id = req.query.id; // Vercel captures param in req.query for [id].js

    if(req.method === 'PUT'){
      const updated = await Indicacao.findByIdAndUpdate(id, req.body, { new: true });
      if(!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }

    if(req.method === 'DELETE'){
      const removed = await Indicacao.findByIdAndDelete(id);
      if(!removed) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e){
    res.status(400).json({ error: e.message });
  }
};
