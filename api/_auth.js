const jwt = require('jsonwebtoken');

function getUserFromReq(req){
  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if(!token) return null;
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret);
    return payload || null;
  }catch(e){ return null; }
}

function ensureAuth(req, res){
  const user = getUserFromReq(req);
  if(!user){ res.status(401).json({ error: 'Unauthorized' }); return null; }
  return user;
}

function ensureAdmin(req, res){
  const user = ensureAuth(req, res);
  if(!user) return null;
  if(String(user.role||'').toLowerCase() !== 'admin'){
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

module.exports = { getUserFromReq, ensureAuth, ensureAdmin };
