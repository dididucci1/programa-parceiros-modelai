const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db');
const Usuario = require('./models/Usuario');
const Indicacao = require('./models/Indicacao');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

// Middleware: garante conexão ativa apenas para rotas da API
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: 'Serviço indisponível. Tente novamente mais tarde.' });
  }
});

// Observabilidade: health com ping e tempo
app.get('/api/health', async (req, res) => {
  const t0 = process.hrtime.bigint();
  let mongoOk = false;
  try {
    const conn = await connectDB();
    if (conn && conn.db) {
      await conn.db.admin().command({ ping: 1 });
      mongoOk = true;
    }
  } catch {
    mongoOk = false;
  }
  const t1 = process.hrtime.bigint();
  const ms = Number((t1 - t0) / 1000000n);
  res.json({ ok: true, mongo: mongoOk, ms });
});

// Auth middleware
function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || String(req.user.role).toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Rate limit simples para login (IP+email)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;
function rateLimitKey(req, email) {
  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  return `${ip}|${email}`;
}
function isRateLimited(key) {
  const now = Date.now();
  const arr = loginAttempts.get(key) || [];
  const recent = arr.filter(ts => now - ts < WINDOW_MS);
  recent.push(now);
  loginAttempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

// Usuários
app.get('/api/usuarios', authRequired, requireAdmin, async (req, res) => {
  const list = await Usuario.find().select('-senha').sort({ createdAt: -1 }).lean();
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
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }
    res.status(400).json({ error: 'Não foi possível salvar o usuário' });
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
    const updated = await Usuario.findByIdAndUpdate(req.params.id, body, { new: true }).select('-senha').lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }
    res.status(400).json({ error: 'Não foi possível atualizar o usuário' });
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

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const senha = String(req.body.senha || '');

    const key = rateLimitKey(req, email);
    if (isRateLimited(key)) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
    }

    const user = await Usuario.findOne({ email }).select('+senha').lean();
    const stored = String(user && user.senha || '');
    const ok = !!user && (stored.startsWith('$2') ? await bcrypt.compare(senha, stored) : senha === stored);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const payload = { id: String(user._id), email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const safeUser = { id: user._id, nome: user.nome, email: user.email, role: user.role, status: user.status };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível processar o login' });
  }
});

// Indicações
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
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Registro duplicado' });
    }
    res.status(400).json({ error: 'Não foi possível salvar a indicação' });
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

module.exports = app;

// Static site: serve frontend files on root (local dev convenience)
const ROOT_DIR = path.resolve(__dirname, '..', '..');
app.use(express.static(ROOT_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});
