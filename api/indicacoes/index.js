const { connectDB } = require('../_db');
const { ensureAuth } = require('../_auth');
const Indicacao = require('../../backend/src/models/Indicacao');

module.exports = async (req, res) => {
  try{
    await connectDB();
    const user = ensureAuth(req, res);
    if(!user) return;

    if(req.method === 'GET'){
      const { userEmail } = req.query || {};
      const filter = {};
      const isAdmin = String(user.role||'').toLowerCase() === 'admin';
      if(isAdmin){ if(userEmail) filter.usuarioEmail = String(userEmail).toLowerCase(); }
      else { filter.usuarioEmail = String(user.email).toLowerCase(); }
      const list = await Indicacao.find(filter).sort({ createdAt: -1 });
      return res.json(list);
    }

    if(req.method === 'POST'){
      const body = req.body || {};
      const isAdmin = String(user.role||'').toLowerCase() === 'admin';
      if(!isAdmin){ body.usuarioEmail = String(user.email).toLowerCase(); }
      else if(body.usuarioEmail){ body.usuarioEmail = String(body.usuarioEmail).toLowerCase(); }
      const created = await Indicacao.create(body);
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e){
    res.status(400).json({ error: e.message });
  }
};
