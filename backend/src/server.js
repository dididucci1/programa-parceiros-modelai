const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connect } = require('./db');
const Usuario = require('./models/Usuario');
const Indicacao = require('./models/Indicacao');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Auth middleware
function authRequired(req, res, next){
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(err){
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function requireAdmin(req, res, next){
  if (!req.user || String(req.user.role).toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Mongo-backed routes
app.get('/api/usuarios', authRequired, requireAdmin, async (req, res) => {
  const list = await Usuario.find().select('-senha').sort({ createdAt: -1 });
  res.json(list);
});

app.post('/api/usuarios', authRequired, requireAdmin, async (req, res) => {
  try {
    const { nome, email, role = 'parceiro', senha, status = 'ativo' } = req.body;
    const hashed = senha ? await bcrypt.hash(String(senha), 10) : undefined;
    const created = await Usuario.create({ nome, email, role, senha: hashed, status });
    const { senha: _, ...safe } = created.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.senha === 'string' && body.senha.trim() !== '') {
      body.senha = await bcrypt.hash(String(body.senha), 10);
    } else {
      delete body.senha;
    }
    const updated = await Usuario.findByIdAndUpdate(req.params.id, body, { new: true }).select('-senha');
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/usuarios/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const removed = await Usuario.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const senha = String(req.body.senha || '');
    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const stored = String(user.senha || '');
    let ok = false;
    if (stored.startsWith('$2')) {
      ok = await bcrypt.compare(senha, stored);
    } else {
      ok = senha === stored; // compatibilidade com dados legados sem hash
    }
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const payload = { id: user._id.toString(), email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const safeUser = { id: user._id, nome: user.nome, email: user.email, role: user.role, status: user.status };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/indicacoes', authRequired, async (req, res) => {
  const { userEmail } = req.query;
  const filter = {};
  const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
  if (isAdmin) {
    if (userEmail) filter.usuarioEmail = String(userEmail).toLowerCase();
  } else {
    filter.usuarioEmail = String(req.user.email).toLowerCase();
  }
  const list = await Indicacao.find(filter).sort({ createdAt: -1 });
  res.json(list);
});

app.post('/api/indicacoes', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      body.usuarioEmail = String(req.user.email).toLowerCase();
    } else if (body.usuarioEmail) {
      body.usuarioEmail = String(body.usuarioEmail).toLowerCase();
    }
    const created = await Indicacao.create(body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/indicacoes/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const updated = await Indicacao.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/indicacoes/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const removed = await Indicacao.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Initialize DB connection on module load (works in serverless too)
(async () => {
  try {
    await connect(process.env.MONGODB_URI);
    const count = await Usuario.countDocuments();
    if (count === 0) {
      const adminPass = await bcrypt.hash('admin', 10);
      await Usuario.create({ nome: 'Administrador', email: 'admin@modelai.com', role: 'admin', senha: adminPass, status: 'ativo' });
    }
  } catch (err) {
    console.error('DB init error:', err.message);
  }
})();

module.exports = app;
