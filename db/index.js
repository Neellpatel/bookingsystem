// db/index.js
// Universal multi-database layer supporting:
// 1. PostgreSQL (Neon, Supabase, Vercel Postgres, Railway) via POSTGRES_URL / DATABASE_URL
// 2. Cloud SQLite (Turso / LibSQL) via TURSO_DATABASE_URL / DATABASE_URL
// 3. Local / Serverless SQLite fallback (node:sqlite using /tmp on Vercel if no cloud DB configured).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use /tmp on Vercel/serverless environments to avoid read-only filesystem errors
const isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_PATH = isServerless
  ? path.join(os.tmpdir(), 'clinic.db')
  : path.join(__dirname, '..', 'data', 'clinic.db');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const test = scryptSync(password, salt, 64).toString('hex');
  return test === hash;
}

let dbPromise = null;
let dbType = 'uninitialised';

export function getDbType() { return dbType; }
export function isEphemeralDb() { return dbType === 'sqlite' && isServerless; }

// Tables whose primary key is NOT a column called "id" (INSERT ... RETURNING id would fail on them).
const NO_ID_TABLES = new Set(['sessions']);

function toPgSql(sql) {
  let index = 1;
  return sql
    .replace(/\?/g, () => `$${index++}`)
    // SQLite LIKE is case-insensitive, Postgres LIKE is not -> keep search behaviour identical
    .replace(/\bLIKE\b/g, 'ILIKE');
}

// Create the connection + schema exactly once, even when many requests arrive together
// (cold start on a serverless platform). Every caller awaits the SAME promise, so no request
// can ever touch the database before the schema exists.
export function getDb() {
  if (!dbPromise) {
    dbPromise = createDb().catch((err) => {
      dbPromise = null; // allow a retry on the next request instead of caching a failure
      throw err;
    });
  }
  return dbPromise;
}

async function createDb() {
  let dbInstance;

  const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || '';
  const dbUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '');

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    // PostgreSQL Mode (Neon / Supabase / Vercel Postgres)
    const { default: pg } = await import('pg');
    // Return NUMERIC (fees, ratings, amounts) and COUNT(*) (bigint) as JS numbers, like SQLite does
    pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
    pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
    const pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }
    });

    dbType = 'postgres';
    dbInstance = {
      type: 'postgres',
      async get(sql, args = []) {
        const res = await pool.query(toPgSql(sql), args);
        return res.rows[0] || null;
      },
      async all(sql, args = []) {
        const res = await pool.query(toPgSql(sql), args);
        return res.rows;
      },
      async run(sql, args = []) {
        let pgSql = toPgSql(sql);
        const ins = sql.trim().match(/^insert\s+into\s+([a-z_]+)/i);
        if (ins && !NO_ID_TABLES.has(ins[1].toLowerCase()) && !/returning/i.test(sql)) {
          pgSql += ' RETURNING id';
        }
        const res = await pool.query(pgSql, args);
        const lastInsertRowid = res.rows[0]?.id ? Number(res.rows[0].id) : null;
        return { lastInsertRowid, changes: res.rowCount };
      },
      async exec(sql) {
        await pool.query(sql);
      }
    };
  } else if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    // Turso / LibSQL Mode
    const { createClient } = await import('@libsql/client');
    const client = createClient({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN || ''
    });

    dbType = 'turso';
    dbInstance = {
      type: 'turso',
      async get(sql, args = []) {
        const res = await client.execute({ sql, args });
        return res.rows[0] ? Object.fromEntries(res.columns.map((c, i) => [c, res.rows[0][i]])) : null;
      },
      async all(sql, args = []) {
        const res = await client.execute({ sql, args });
        return res.rows.map(row => Object.fromEntries(res.columns.map((c, i) => [c, row[i]])));
      },
      async run(sql, args = []) {
        const res = await client.execute({ sql, args });
        return { lastInsertRowid: res.lastInsertRowid ? Number(res.lastInsertRowid) : null, changes: res.rowsAffected };
      },
      async exec(sql) {
        await client.executeMultiple(sql);
      }
    };
  } else {
    // Local / Serverless SQLite Fallback (node:sqlite using /tmp if serverless)
    const { DatabaseSync } = await import('node:sqlite');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const sqlite = new DatabaseSync(DB_PATH);
    sqlite.exec('PRAGMA foreign_keys = ON;');

    dbType = 'sqlite';
    if (isServerless) {
      console.warn('[db] WARNING: no DATABASE_URL / POSTGRES_URL / TURSO_DATABASE_URL set. Using SQLite in /tmp, which is wiped on every cold start and NOT shared between serverless instances. Accounts and bookings will disappear. Configure a cloud database.');
    }
    dbInstance = {
      type: 'sqlite',
      async get(sql, args = []) {
        const stmt = sqlite.prepare(sql);
        return stmt.get(...args) || null;
      },
      async all(sql, args = []) {
        const stmt = sqlite.prepare(sql);
        return stmt.all(...args);
      },
      async run(sql, args = []) {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...args);
        return { lastInsertRowid: info.lastInsertRowid ? Number(info.lastInsertRowid) : null, changes: info.changes };
      },
      async exec(sql) {
        sqlite.exec(sql);
      }
    };
  }

  // Initialize schema & seed (errors are thrown, not swallowed, so a broken DB is visible)
  await initSchemaAndSeed(dbInstance);
  return dbInstance;
}

async function initSchemaAndSeed(db) {
  try {
    if (db.type === 'postgres') {
      const pgSchema = fs.readFileSync(path.join(__dirname, 'schema.pg.sql'), 'utf-8');
      await db.exec(pgSchema);
    } else {
      const sqliteSchema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      await db.exec(sqliteSchema);
    }

    const docRow = await db.get('SELECT COUNT(*) AS c FROM doctors');
    const docCount = Number(docRow?.c || docRow?.count || 0);

    if (docCount === 0) {
      await seedDoctorsAndSlots(db);
    }

    const userRow = await db.get('SELECT COUNT(*) AS c FROM users');
    const userCount = Number(userRow?.c || userRow?.count || 0);

    if (userCount === 0) {
      await seedUsers(db);
    }
    await ensureSlots(db);
  } catch (err) {
    console.error('Error during database initialization/seeding:', err);
    throw err;
  }
}

async function seedDoctorsAndSlots(db) {
  const doctors = [
    ['Dr. Arjun Mehta', 'Cardiology', 'Specialist in interventional cardiology and preventive heart care, focused on long-term wellbeing.', 'arjun', 14, 1200, 4.9, 'Tower A · Floor 3'],
    ['Dr. Rajiv Menon', 'Orthopedics', 'Orthopedic surgeon specializing in sports injuries and joint replacement.', 'rajiv', 11, 1000, 4.8, 'Tower B · Floor 1'],
    ['Dr. Ananya Sharma', 'Dermatology', 'Board-certified dermatologist focused on medical and cosmetic skin health.', 'ananya', 9, 900, 4.9, 'Tower A · Floor 2'],
    ['Dr. Kavya Iyer', 'Pediatrics', 'Pediatrician dedicated to compassionate, family-centered child healthcare.', 'kavya', 8, 800, 4.7, 'Tower C · Floor 1'],
    ['Dr. Vikram Shah', 'Neurology', 'Neurologist with expertise in migraine management and stroke rehabilitation.', 'vikram', 16, 1500, 4.9, 'Tower B · Floor 4'],
    ['Dr. Rohan Deshmukh', 'General Medicine', 'Primary care physician providing holistic, everyday family healthcare.', 'rohan', 6, 600, 4.6, 'Tower A · Floor 1'],
    ['Dr. Priya Nair', 'Gynecology', "Women's health specialist covering prenatal care through menopause.", 'priya', 12, 1100, 4.9, 'Tower C · Floor 2'],
    ['Dr. Sanjay Gupta', 'Dentistry', 'Dental surgeon focused on restorative and cosmetic dentistry.', 'sanjay', 10, 700, 4.7, 'Tower D · Floor 1'],
  ];

  const statuses = ['available', 'available', 'busy', 'available', 'off_duty', 'available', 'available', 'busy'];
  const notes = ['In clinic now', 'In clinic now', 'With a patient — back in ~20 min', 'In clinic now', 'Off today, back tomorrow', 'In clinic now', 'In clinic now', 'In surgery — back in ~1 hr'];

  for (let i = 0; i < doctors.length; i++) {
    const d = doctors[i];
    await db.run(
      `INSERT INTO doctors (name, specialty, bio, photo_seed, experience_years, consultation_fee, rating, location, availability_status, status_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...d, statuses[i], notes[i]]
    );
  }

  await ensureSlots(db);
}

const SLOT_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
let lastSlotTopUp = 0;

// Make sure every doctor has slots for today + the next 6 days. Slots used to be created only
// once at first seed, so after a week the booking calendar went empty. Days that already have
// any slot rows (booked or not) are left alone.
export async function ensureSlots(db, { force = false } = {}) {
  if (!force && Date.now() - lastSlotTopUp < 10 * 60 * 1000) return;
  lastSlotTopUp = Date.now();
  const doctorRows = await db.all('SELECT id FROM doctors');
  if (!doctorRows || !doctorRows.length) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const existingRows = await db.all(
    'SELECT doctor_id, slot_date FROM doctor_slots WHERE slot_date >= ? GROUP BY doctor_id, slot_date',
    [todayStr]
  );
  const existingSet = new Set(existingRows.map(r => `${r.doctor_id}_${r.slot_date}`));

  const toInsert = [];
  for (const doc of doctorRows) {
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().slice(0, 10);
      if (existingSet.has(`${doc.id}_${dateStr}`)) continue;

      for (const t of SLOT_TIMES) {
        if (Math.random() < 0.15) continue;
        const [h, m] = t.split(':').map(Number);
        const end = m + 30 === 60 ? `${String(h + 1).padStart(2, '0')}:00` : `${String(h).padStart(2, '0')}:${m + 30}`;
        toInsert.push([doc.id, dateStr, t, end]);
      }
    }
  }

  if (toInsert.length === 0) return;

  const chunkSize = 50;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const params = chunk.flat();
    await db.run(
      `INSERT INTO doctor_slots (doctor_id, slot_date, start_time, end_time) VALUES ${placeholders}`,
      params
    );
  }
}

async function seedUsers(db) {
  const staffPass = hashPassword('reception123');
  await db.run(
    `INSERT INTO users (name, email, phone, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Front Desk Staff', 'reception@doctoroncall.example', '+1 555 0100', staffPass.hash, staffPass.salt, 'staff']
  );

  const demoPass = hashPassword('patient123');
  await db.run(
    `INSERT INTO users (name, email, phone, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Aarav Patel', 'patient@doctoroncall.example', '+91 98765 43210', demoPass.hash, demoPass.salt, 'patient']
  );
}
