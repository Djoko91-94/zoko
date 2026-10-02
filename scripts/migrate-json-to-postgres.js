import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const dataFile = path.join(rootDir, 'backend-data.json');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL is required to run migration.');
    process.exit(1);
}

function normalizeTask(task) {
    return {
        id: String(task.id ?? `${Date.now()}_${Math.floor(Math.random() * 1000000)}`),
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

async function readJsonData() {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
        users: parsed.users || {},
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        authTokens: parsed.authTokens || {},
    };
}

async function ensureSchema(pool) {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      date_naissance TEXT NOT NULL DEFAULT '',
      telephone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      email_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );
  `);

    await pool.query(`
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
}

async function migrate() {
    const { Pool } = pg;
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
    });

    try {
        await ensureSchema(pool);
        const data = await readJsonData();

        for (const [username, value] of Object.entries(data.users)) {
            if (!value) continue;

            const isLegacyPlainPassword = typeof value === 'string';
            if (isLegacyPlainPassword) {
                console.warn(`Skipping legacy plain-password user "${username}". Run app once to hash users first.`);
                continue;
            }

            await pool.query(
                `INSERT INTO users (username, password_hash, salt, date_naissance, telephone, email, email_reminder_enabled, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           salt = EXCLUDED.salt,
           date_naissance = EXCLUDED.date_naissance,
           telephone = EXCLUDED.telephone,
           email = EXCLUDED.email,
           email_reminder_enabled = EXCLUDED.email_reminder_enabled`,
                [
                    username,
                    value.passwordHash,
                    value.salt,
                    value.dateNaissance || '',
                    value.telephone || '',
                    value.email || '',
                    Boolean(value.emailReminderEnabled),
                    value.createdAt || new Date().toISOString(),
                ],
            );
        }

        for (const task of data.tasks) {
            const t = normalizeTask(task);
            if (!t.owner) continue;

            await pool.query(
                `INSERT INTO tasks (id, owner, text, due_date, due_time, category, priority, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           owner = EXCLUDED.owner,
           text = EXCLUDED.text,
           due_date = EXCLUDED.due_date,
           due_time = EXCLUDED.due_time,
           category = EXCLUDED.category,
           priority = EXCLUDED.priority,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at`,
                [
                    t.id,
                    t.owner,
                    t.text,
                    t.date,
                    t.time,
                    t.category,
                    t.priority,
                    t.status,
                    t.createdAt,
                    t.updatedAt,
                ],
            );
        }

        for (const [token, tokenEntry] of Object.entries(data.authTokens)) {
            if (!tokenEntry || !tokenEntry.username || !tokenEntry.expiresAt) continue;
            await pool.query(
                `INSERT INTO auth_tokens (token, username, expires_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (token) DO UPDATE SET username = EXCLUDED.username, expires_at = EXCLUDED.expires_at`,
                [token, tokenEntry.username, Number(tokenEntry.expiresAt)],
            );
        }

        console.log('Migration to PostgreSQL completed successfully.');
    } finally {
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
