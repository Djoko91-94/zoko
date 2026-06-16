import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'backend-data.json');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static(path.join(__dirname)));

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
      }
    }

    if (migrated) {
      await writeData(data);
    }

    return data;
  } catch (error) {
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

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const data = await readData();
  const tokenEntry = data.authTokens[token];
  if (!tokenEntry || tokenEntry.expiresAt < Date.now()) {
    return null;
  }

  return tokenEntry.username;
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
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const data = await readData();
  if (data.users[username]) {
    return res.status(409).json({ error: 'User exists' });
  }

  data.users[username] = hashPassword(password);
  const token = createAuthToken();
  data.authTokens[token] = {
    username,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  await writeData(data);
  return res.status(201).json({ message: 'User created', username, token });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const data = await readData();
  const user = data.users[username];

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createAuthToken();
  data.authTokens[token] = {
    username,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  await writeData(data);
  return res.json({ message: 'Login success', username, token });
});

app.get('/api/users', authenticate, async (req, res) => {
  const data = await readData();
  return res.json(Object.keys(data.users));
});

app.get('/api/tasks', authenticate, async (req, res) => {
  const data = await readData();
  const tasks = data.tasks.filter((task) => task.owner === req.username);
  return res.json(tasks);
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { text, date, time, category, priority, status } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text required' });
  }

  const data = await readData();
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();

  const task = {
    id,
    owner: req.username,
    text,
    date: date || '',
    time: time || '',
    category: category || '',
    priority: priority || '',
    status: status === 'completed' ? 'completed' : 'active',
    createdAt: now,
    updatedAt: now,
  };

  data.tasks.push(task);
  await writeData(data);
  return res.status(201).json({ id, task });
});

app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = Number(req.params.id);
  const data = await readData();
  const task = data.tasks.find((item) => item.id === taskId && item.owner === req.username);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { text, date, time, category, priority, status } = req.body;

  if (text !== undefined) task.text = text;
  if (date !== undefined) task.date = date;
  if (time !== undefined) task.time = time;
  if (category !== undefined) task.category = category;
  if (priority !== undefined) task.priority = priority;
  if (status !== undefined) task.status = status === 'completed' ? 'completed' : 'active';

  task.updatedAt = new Date().toISOString();
  await writeData(data);

  return res.json(task);
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = Number(req.params.id);
  const data = await readData();
  const index = data.tasks.findIndex((task) => task.id === taskId && task.owner === req.username);

  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  data.tasks.splice(index, 1);
  await writeData(data);
  return res.json({ message: 'Deleted' });
});

app.get('/api/backup', authenticate, async (req, res) => {
  const data = await readData();
  const tasks = data.tasks.filter((task) => task.owner === req.username);
  return res.json({ username: req.username, tasks });
});

app.post('/api/backup', authenticate, async (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Backup payload must contain an array of tasks' });
  }

  const data = await readData();
  data.tasks = data.tasks.filter((task) => task.owner !== req.username);

  const now = new Date().toISOString();
  const restoredTasks = tasks.map((task) => ({
    id: typeof task.id === 'number' ? task.id : Date.now() + Math.floor(Math.random() * 1000),
    owner: req.username,
    text: task.text || '',
    date: task.date || '',
    time: task.time || '',
    category: task.category || '',
    priority: task.priority || '',
    status: task.status === 'completed' ? 'completed' : 'active',
    createdAt: task.createdAt || now,
    updatedAt: now,
  }));

  data.tasks.push(...restoredTasks);
  await writeData(data);
  return res.json({ message: 'Backup restored', count: restoredTasks.length });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'zoko.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
