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

// Função para verificar e cancelar indicações em "Reunião Realizada" há mais de 3 meses
async function verificarReuniaoRealizadaExpirada() {
  try {
    const treseMesesAtras = new Date();
    treseMesesAtras.setMonth(treseMesesAtras.getMonth() - 3);

    const result = await Indicacao.updateMany(
      {
        status: 'Reunião Realizada',
        dataUltimaModificacaoStatus: { $lte: treseMesesAtras }
      },
      {
        $set: { 
          status: 'Cancelado/Sem resposta',
          dataUltimaModificacaoStatus: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[auto-cancel] ${result.modifiedCount} indicações movidas de "Reunião Realizada" para "Cancelado/Sem resposta"`);
    }
  } catch (err) {
    console.error('[auto-cancel] Erro ao verificar indicações expiradas:', err.message);
  }
}

// Executar verificação a cada 1 hora (3600000ms)
setInterval(verificarReuniaoRealizadaExpirada, 3600000);

// Executar verificação ao iniciar o servidor
setTimeout(verificarReuniaoRealizadaExpirada, 5000);

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

// Bloqueio de acesso até concluir o setup inicial (troca de senha + termo)
async function requireSetupCompleted(req, res, next) {
  try {
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    if (isAdmin) return next();
    const user = await Usuario.findById(req.user.id).select('primeiraSenha termoAceite').lean();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    // Bloqueia se não estiver explicitamente concluído (primeiraSenha=false e termoAceite=true)
    if (user.primeiraSenha !== false || user.termoAceite !== true) {
      return res.status(403).json({ error: 'SetupRequired', message: 'Troque a senha e aceite o termo para acessar.' });
    }
    next();
  } catch (err) {
    return res.status(400).json({ error: 'Não foi possível validar o acesso' });
  }
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
    const created = await Usuario.create({ nome, email, role, senha: hashed, status, primeiraSenha: true, termoAceite: false });
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
    const safeUser = { id: user._id, nome: user.nome, email: user.email, role: user.role, status: user.status, primeiraSenha: !!user.primeiraSenha, termoAceite: !!user.termoAceite };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível processar o login' });
  }
});

// Setup inicial: troca de senha + aceite de termo
app.post('/api/auth/setup-inicial', authRequired, async (req, res) => {
  try {
    const { novaSenha, aceitouTermo } = req.body || {};
    if (!novaSenha || String(novaSenha).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }
    if (!aceitouTermo) {
      return res.status(400).json({ error: 'É necessário aceitar o termo de confidencialidade' });
    }
    const user = await Usuario.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    user.senha = await bcrypt.hash(String(novaSenha), 10);
    user.primeiraSenha = false;
    user.termoAceite = true;
    user.dataAceiteTermo = new Date();
    await user.save();
    const safeUser = { id: user._id, nome: user.nome, email: user.email, role: user.role, status: user.status, primeiraSenha: false, termoAceite: true };
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível concluir o setup inicial' });
  }
});

// Indicações
app.get('/api/indicacoes', authRequired, requireSetupCompleted, async (req, res) => {
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

app.post('/api/indicacoes', authRequired, requireSetupCompleted, async (req, res) => {
  try {
    const body = req.body || {};
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      body.usuarioEmail = String(req.user.email).toLowerCase();
    } else if (body.usuarioEmail) {
      body.usuarioEmail = String(body.usuarioEmail).toLowerCase();
    }
    // Define a data de modificação do status na criação
    body.dataUltimaModificacaoStatus = new Date();
    const created = await Indicacao.create(body);
    res.status(201).json(created);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Registro duplicado' });
    }
    res.status(400).json({ error: 'Não foi possível salvar a indicação' });
  }
});

app.put('/api/indicacoes/:id', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const current = await Indicacao.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    const isOwner = String(current.usuarioEmail || '').toLowerCase() === String(req.user.email || '').toLowerCase();

    // Parceiro só pode alterar o campo 'oculta' de suas próprias indicações
    const keys = Object.keys(body || {});
    const onlyOcultaChange = keys.length === 1 && keys[0] === 'oculta';
    if (!isAdmin && !(isOwner && onlyOcultaChange)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Se o status foi alterado, atualiza a data de modificação
    if (body.status && body.status !== current.status) {
      body.dataUltimaModificacaoStatus = new Date();
    }

    const updated = await Indicacao.findByIdAndUpdate(req.params.id, body, { new: true });
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

// Migração: adicionar dataUltimaModificacaoStatus para indicações antigas
app.post('/api/indicacoes/migrate-status-date', authRequired, requireAdmin, async (req, res) => {
  try {
    const result = await Indicacao.updateMany(
      { dataUltimaModificacaoStatus: { $exists: false } },
      { $set: { dataUltimaModificacaoStatus: new Date() } }
    );
    res.json({ ok: true, modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

// Static site: serve frontend files on root (local dev convenience)
const ROOT_DIR = path.resolve(__dirname, '..', '..');
app.use(express.static(ROOT_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});
