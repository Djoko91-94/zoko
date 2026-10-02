/* eslint-env node */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import pg from 'pg';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'backend-data.json');
const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((v) => v.trim()).filter(Boolean);
const DATABASE_URL = process.env.DATABASE_URL || '';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 200);

app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAny = allowedOrigins.includes('*');
  const canAllowOrigin = origin && allowedOrigins.includes(origin);
  if (allowAny) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (canAllowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later.' },
});

app.use('/api', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/users', authLimiter);
app.use('/api/password', authLimiter);

function cleanText(value, maxLength = 300) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLength);
}

function cleanUsername(value) {
  return cleanText(value, 50);
}

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidBirthdate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return year >= 1900
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date <= today;
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function isValidTaskStatus(status) {
  return status === 'active' || status === 'completed';
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    salt,
    passwordHash: derivedKey.toString('hex'),
  };
}

function verifyPassword(password, passwordHash, salt) {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), derivedKey);
  } catch {
    return false;
  }
}

async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!data.users) data.users = {};
    if (!data.tasks) data.tasks = [];
    if (!data.authTokens) data.authTokens = {};

    let migrated = false;
    for (const [username, value] of Object.entries(data.users)) {
      if (typeof value === 'string') {
        data.users[username] = hashPassword(value);
        migrated = true;
        continue;
      }

      if (value && typeof value === 'object') {
        if (value.dateNaissance === undefined) value.dateNaissance = '';
        if (value.gender === undefined) value.gender = '';
        if (value.telephone === undefined) value.telephone = '';
        if (value.email === undefined) value.email = '';
        if (value.emailReminderEnabled === undefined) value.emailReminderEnabled = false;
      }
    }

    if (migrated) {
      await writeData(data);
    }

    return data;
  } catch {
    return {
      users: {},
      tasks: [],
      authTokens: {},
    };
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function createAuthToken() {
  return crypto.randomBytes(32).toString('hex');
}

const passwordResetTokens = new Map();

function createPasswordResetToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  passwordResetTokens.set(token, {
    username,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return token;
}

async function sendEmail(to, subject, text) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@zoko.local';
  if (!resendApiKey) throw new Error('Email service is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, text }),
  });

  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

function normalizeTask(task) {
  return {
    id: String(task.id ?? ''),
    owner: task.owner || '',
    text: task.text || '',
    date: task.date || '',
    time: task.time || '',
    category: task.category || '',
    priority: task.priority || '',
    status: task.status === 'completed' ? 'completed' : 'active',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
  };
}

function makeTaskId() {
  return `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

const jsonStore = {
  async init() {
    await readData();
  },
  async getUser(username) {
    const data = await readData();
    return data.users[username] || null;
  },
  async updatePassword(username, passwordHash, salt) {
    const data = await readData();
    if (!data.users[username]) return false;
    data.users[username].passwordHash = passwordHash;
    data.users[username].salt = salt;
    await writeData(data);
    return true;
  },
  async createUser(userRecord) {
    const data = await readData();
    if (data.users[userRecord.username]) return false;
    data.users[userRecord.username] = {
      passwordHash: userRecord.passwordHash,
      salt: userRecord.salt,
      dateNaissance: userRecord.dateNaissance,
      gender: userRecord.gender,
      telephone: userRecord.telephone,
      email: userRecord.email,
      emailReminderEnabled: Boolean(userRecord.emailReminderEnabled),
      createdAt: userRecord.createdAt,
    };
    await writeData(data);
    return true;
  },
  async saveAuthToken(token, username, expiresAt) {
    const data = await readData();
    data.authTokens[token] = { username, expiresAt };
    await writeData(data);
  },
  async getAuthToken(token) {
    const data = await readData();
    const value = data.authTokens[token];
    if (!value) return null;
    if (value.expiresAt < Date.now()) return null;
    return value;
  },
  async revokeAuthToken(token) {
    const data = await readData();
    if (data.authTokens[token]) {
      delete data.authTokens[token];
      await writeData(data);
    }
  },
  async cleanupExpiredTokens() {
    const data = await readData();
    const now = Date.now();
    let changed = false;
    for (const [token, entry] of Object.entries(data.authTokens)) {
      if (!entry || Number(entry.expiresAt) < now) {
        delete data.authTokens[token];
        changed = true;
      }
    }
    if (changed) await writeData(data);
  },
  async listUsers() {
    const data = await readData();
    return Object.keys(data.users);
  },
  async getTasksByOwner(owner) {
    const data = await readData();
    return data.tasks.filter((task) => task.owner === owner).map(normalizeTask);
  },
  async createTask(owner, payload) {
    const data = await readData();
    const now = new Date().toISOString();
    const task = normalizeTask({
      id: makeTaskId(),
      owner,
      text: payload.text,
      date: payload.date || '',
      time: payload.time || '',
      category: payload.category || '',
      priority: payload.priority || '',
      status: payload.status || 'active',
      createdAt: now,
      updatedAt: now,
    });
    data.tasks.push(task);
    await writeData(data);
    return task;
  },
  async updateTask(owner, id, updates) {
    const data = await readData();
    const task = data.tasks.find((item) => String(item.id) === String(id) && item.owner === owner);
    if (!task) return null;

    if (updates.text !== undefined) task.text = updates.text;
    if (updates.date !== undefined) task.date = updates.date;
    if (updates.time !== undefined) task.time = updates.time;
    if (updates.category !== undefined) task.category = updates.category;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.status !== undefined) task.status = updates.status === 'completed' ? 'completed' : 'active';
    task.updatedAt = new Date().toISOString();
    await writeData(data);
    return normalizeTask(task);
  },
  async deleteTask(owner, id) {
    const data = await readData();
    const index = data.tasks.findIndex((task) => String(task.id) === String(id) && task.owner === owner);
    if (index === -1) return false;
    data.tasks.splice(index, 1);
    await writeData(data);
    return true;
  },
  async replaceTasks(owner, tasks) {
    const data = await readData();
    data.tasks = data.tasks.filter((task) => task.owner !== owner);
    const now = new Date().toISOString();
    const restoredTasks = tasks.map((task) => normalizeTask({
      id: task.id || makeTaskId(),
      owner,
      text: task.text || '',
      date: task.date || '',
      time: task.time || '',
      category: task.category || '',
      priority: task.priority || '',
      status: task.status || 'active',
      createdAt: task.createdAt || now,
      updatedAt: now,
    }));
    data.tasks.push(...restoredTasks);
    await writeData(data);
    return restoredTasks.length;
  },
};

const pgStore = {
  pool: null,
  async init() {
    const { Pool } = pg;
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        date_naissance TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        telephone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        email_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT ''`);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        text TEXT NOT NULL,
        due_date TEXT NOT NULL DEFAULT '',
        due_time TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  },
  async getUser(username) {
    const result = await this.pool.query(
      `SELECT username, password_hash, salt, date_naissance, gender, telephone, email, email_reminder_enabled, created_at
       FROM users WHERE username = $1 LIMIT 1`,
      [username],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      username: row.username,
      passwordHash: row.password_hash,
      salt: row.salt,
      dateNaissance: row.date_naissance,
      gender: row.gender,
      telephone: row.telephone,
      email: row.email,
      emailReminderEnabled: row.email_reminder_enabled,
      createdAt: row.created_at,
    };
  },
  async updatePassword(username, passwordHash, salt) {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1, salt = $2 WHERE username = $3',
      [passwordHash, salt, username],
    );
    return result.rowCount > 0;
  },
  async createUser(userRecord) {
    const result = await this.pool.query(
      `INSERT INTO users (username, password_hash, salt, date_naissance, gender, telephone, email, email_reminder_enabled, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (username) DO NOTHING`,
      [
        userRecord.username,
        userRecord.passwordHash,
        userRecord.salt,
        userRecord.dateNaissance,
        userRecord.gender,
        userRecord.telephone,
        userRecord.email,
        Boolean(userRecord.emailReminderEnabled),
        userRecord.createdAt,
      ],
    );
    return result.rowCount > 0;
  },
  async saveAuthToken(token, username, expiresAt) {
    await this.pool.query(
      `INSERT INTO auth_tokens (token, username, expires_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (token) DO UPDATE SET username = EXCLUDED.username, expires_at = EXCLUDED.expires_at`,
      [token, username, expiresAt],
    );
  },
  async getAuthToken(token) {
    const result = await this.pool.query(
      `SELECT token, username, expires_at FROM auth_tokens WHERE token = $1 LIMIT 1`,
      [token],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    if (Number(row.expires_at) < Date.now()) return null;
    return { token: row.token, username: row.username, expiresAt: Number(row.expires_at) };
  },
  async revokeAuthToken(token) {
    await this.pool.query('DELETE FROM auth_tokens WHERE token = $1', [token]);
  },
  async cleanupExpiredTokens() {
    await this.pool.query('DELETE FROM auth_tokens WHERE expires_at < $1', [Date.now()]);
  },
  async listUsers() {
    const result = await this.pool.query('SELECT username FROM users ORDER BY username ASC');
    return result.rows.map((row) => row.username);
  },
  async getTasksByOwner(owner) {
    const result = await this.pool.query(
      `SELECT id, owner, text, due_date, due_time, category, priority, status, created_at, updated_at
       FROM tasks WHERE owner = $1 ORDER BY updated_at DESC`,
      [owner],
    );
    return result.rows.map((row) => normalizeTask({
      id: row.id,
      owner: row.owner,
      text: row.text,
      date: row.due_date,
      time: row.due_time,
      category: row.category,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },
  async createTask(owner, payload) {
    const now = new Date().toISOString();
    const id = makeTaskId();
    const status = payload.status === 'completed' ? 'completed' : 'active';
    await this.pool.query(
      `INSERT INTO tasks (id, owner, text, due_date, due_time, category, priority, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        owner,
        payload.text,
        payload.date || '',
        payload.time || '',
        payload.category || '',
        payload.priority || '',
        status,
        now,
        now,
      ],
    );
    return normalizeTask({ id, owner, text: payload.text, date: payload.date, time: payload.time, category: payload.category, priority: payload.priority, status, createdAt: now, updatedAt: now });
  },
  async updateTask(owner, id, updates) {
    const current = await this.pool.query('SELECT * FROM tasks WHERE id = $1 AND owner = $2 LIMIT 1', [String(id), owner]);
    if (!current.rowCount) return null;
    const row = current.rows[0];
    const next = {
      text: updates.text !== undefined ? updates.text : row.text,
      due_date: updates.date !== undefined ? updates.date : row.due_date,
      due_time: updates.time !== undefined ? updates.time : row.due_time,
      category: updates.category !== undefined ? updates.category : row.category,
      priority: updates.priority !== undefined ? updates.priority : row.priority,
      status: updates.status !== undefined ? (updates.status === 'completed' ? 'completed' : 'active') : row.status,
      updated_at: new Date().toISOString(),
    };

    await this.pool.query(
      `UPDATE tasks
       SET text = $1, due_date = $2, due_time = $3, category = $4, priority = $5, status = $6, updated_at = $7
       WHERE id = $8 AND owner = $9`,
      [next.text, next.due_date, next.due_time, next.category, next.priority, next.status, next.updated_at, String(id), owner],
    );

    return normalizeTask({
      id: String(id),
      owner,
      text: next.text,
      date: next.due_date,
      time: next.due_time,
      category: next.category,
      priority: next.priority,
      status: next.status,
      createdAt: row.created_at,
      updatedAt: next.updated_at,
    });
  },
  async deleteTask(owner, id) {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1 AND owner = $2', [String(id), owner]);
    return result.rowCount > 0;
  },
  async replaceTasks(owner, tasks) {
    await this.pool.query('DELETE FROM tasks WHERE owner = $1', [owner]);
    const now = new Date().toISOString();
    for (const task of tasks) {
      const normalized = normalizeTask({
        ...task,
        id: task.id || makeTaskId(),
        owner,
        createdAt: task.createdAt || now,
        updatedAt: now,
      });
      await this.pool.query(
        `INSERT INTO tasks (id, owner, text, due_date, due_time, category, priority, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, text = EXCLUDED.text, due_date = EXCLUDED.due_date,
           due_time = EXCLUDED.due_time, category = EXCLUDED.category, priority = EXCLUDED.priority,
           status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
        [
          normalized.id,
          normalized.owner,
          normalized.text,
          normalized.date,
          normalized.time,
          normalized.category,
          normalized.priority,
          normalized.status,
          normalized.createdAt,
          normalized.updatedAt,
        ],
      );
    }
    return tasks.length;
  },
};

const store = DATABASE_URL ? pgStore : jsonStore;

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const tokenEntry = await store.getAuthToken(token);
  if (!tokenEntry) {
    return null;
  }

  return tokenEntry.username;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

async function authenticate(req, res, next) {
  const username = await getAuthenticatedUser(req);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.username = username;
  next();
}

app.post('/api/users', async (req, res) => {
  const body = req.body || {};
  const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
  const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';
  const username = cleanUsername(body.username);
  const password = cleanText(rawPassword, 256);
  const dateNaissance = cleanText(body.dateNaissance, 20);
  const gender = cleanText(body.gender, 10);
  const telephone = cleanText(body.telephone, 30);
  const email = cleanEmail(body.email);
  const emailReminderEnabled = Boolean(body.emailReminderEnabled);

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  if (rawUsername.length > 50) {
    return res.status(400).json({ error: 'Username must be 50 characters or fewer' });
  }
  if (rawPassword.length > 256) {
    return res.status(400).json({ error: 'Password must be 256 characters or fewer' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must include uppercase, lowercase, number and symbol' });
  }
  if (!isValidBirthdate(dateNaissance)) {
    return res.status(400).json({ error: 'Invalid birthdate' });
  }
  if (!['male', 'female'].includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender' });
  }
  if (!/^[0-9\s+\-().]{6,20}$/.test(telephone)) {
    return res.status(400).json({ error: 'Invalid phone' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const existingUser = await store.getUser(username);
  if (existingUser) {
    return res.status(409).json({ error: 'User exists' });
  }

  const hashed = hashPassword(password);
  const created = await store.createUser({
    username,
    passwordHash: hashed.passwordHash,
    salt: hashed.salt,
    dateNaissance,
    gender,
    telephone,
    email,
    emailReminderEnabled: Boolean(emailReminderEnabled),
    createdAt: new Date().toISOString(),
  });

  if (!created) {
    return res.status(409).json({ error: 'User exists' });
  }

  const token = createAuthToken();
  await store.saveAuthToken(token, username, Date.now() + TOKEN_TTL_MS);
  return res.status(201).json({ message: 'User created', username, token });
});

app.post('/api/login', async (req, res) => {
  const body = req.body || {};
  const username = cleanUsername(body.username);
  const password = cleanText(body.password, 256);

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const user = await store.getUser(username);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createAuthToken();
  await store.saveAuthToken(token, username, Date.now() + TOKEN_TTL_MS);
  return res.json({ message: 'Login success', username, token });
});

app.get('/api/users', authenticate, async (req, res) => {
  const users = await store.listUsers();
  return res.json(users);
});

app.get('/api/tasks', authenticate, async (req, res) => {
  const tasks = await store.getTasksByOwner(req.username);
  return res.json(tasks);
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const body = req.body || {};
  const text = cleanText(body.text, 500);
  const date = cleanText(body.date, 20);
  const time = cleanText(body.time, 20);
  const category = cleanText(body.category, 80);
  const priority = cleanText(body.priority, 20);
  const status = cleanText(body.status, 20);

  if (!text) {
    return res.status(400).json({ error: 'text required' });
  }
  if (status && !isValidTaskStatus(status)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }

  const task = await store.createTask(req.username, { text, date, time, category, priority, status });
  return res.status(201).json({ id: task.id, task });
});

app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = req.params.id;
  const body = req.body || {};
  const updates = {
    text: body.text !== undefined ? cleanText(body.text, 500) : undefined,
    date: body.date !== undefined ? cleanText(body.date, 20) : undefined,
    time: body.time !== undefined ? cleanText(body.time, 20) : undefined,
    category: body.category !== undefined ? cleanText(body.category, 80) : undefined,
    priority: body.priority !== undefined ? cleanText(body.priority, 20) : undefined,
    status: body.status !== undefined ? cleanText(body.status, 20) : undefined,
  };

  if (updates.status !== undefined && !isValidTaskStatus(updates.status)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }

  const task = await store.updateTask(req.username, taskId, updates);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.json(task);
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = req.params.id;
  const deleted = await store.deleteTask(req.username, taskId);

  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }
  return res.json({ message: 'Deleted' });
});

app.get('/api/backup', authenticate, async (req, res) => {
  const tasks = await store.getTasksByOwner(req.username);
  return res.json({ username: req.username, tasks });
});

app.post('/api/backup', authenticate, async (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Backup payload must contain an array of tasks' });
  }

  const count = await store.replaceTasks(req.username, tasks);
  return res.json({ message: 'Backup restored', count });
});

app.post('/api/password/reset/request', async (req, res) => {
  const body = req.body || {};
  const username = cleanUsername(body.username);
  const dateNaissance = cleanText(body.dateNaissance, 20);
  const telephone = cleanText(body.telephone, 30);
  const user = await store.getUser(username);

  if (!user || user.dateNaissance !== dateNaissance || user.telephone !== telephone || !isValidEmail(user.email)) {
    return res.status(202).json({ message: 'If the details match, a reset code will be sent.' });
  }

  const token = createPasswordResetToken(username);
  try {
    await sendEmail(
      user.email,
      '[Zoko] Password reset code',
      `Your Zoko password reset code is:\n\n${token}\n\nThis code expires in 15 minutes and can only be used once.`,
    );
  } catch {
    passwordResetTokens.delete(token);
    return res.status(503).json({ error: 'Password reset email is unavailable' });
  }

  return res.status(202).json({ message: 'Reset code sent' });
});

app.post('/api/password/reset/confirm', async (req, res) => {
  const body = req.body || {};
  const token = cleanText(body.token, 128);
  const password = typeof body.password === 'string' ? body.password : '';
  const reset = passwordResetTokens.get(token);

  if (!reset || reset.expiresAt < Date.now()) {
    passwordResetTokens.delete(token);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must contain 8 characters, uppercase, lowercase, number, and symbol' });
  }

  const hashed = hashPassword(password);
  const updated = await store.updatePassword(reset.username, hashed.passwordHash, hashed.salt);
  passwordResetTokens.delete(token);
  if (!updated) return res.status(400).json({ error: 'Invalid or expired reset code' });

  return res.json({ message: 'Password reset successfully' });
});

app.post('/api/reminders/email', authenticate, async (req, res) => {
  const body = req.body || {};
  const user = await store.getUser(req.username);
  const to = cleanEmail(user?.email);
  const subject = cleanText(body.subject, 180);
  const text = cleanText(body.text, 5000);

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'A verified email, subject, and text are required' });
  }
  if (!isValidEmail(to)) {
    return res.status(400).json({ error: 'Invalid recipient email' });
  }

  try {
    await sendEmail(to, subject, text);
    return res.json({ message: 'Email sent' });
  } catch (error) {
    return res.status(502).json({ error: 'Email provider error', details: String(error) });
  }
});

app.get('/api/health', async (_req, res) => {
  return res.json({ status: 'ok', service: 'zoko-backend', timestamp: new Date().toISOString() });
});

app.post('/api/logout', authenticate, async (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    await store.revokeAuthToken(token);
  }
  return res.json({ message: 'Logout success' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
store.init().then(() => {
  void store.cleanupExpiredTokens();
  setInterval(() => {
    void store.cleanupExpiredTokens();
  }, 60 * 60 * 1000);

  const storageMode = DATABASE_URL ? 'postgresql' : 'json-file';
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port} (storage: ${storageMode})`);
  });
}).catch((error) => {
  console.error('Failed to initialize storage layer:', error);
  process.exit(1);
});
