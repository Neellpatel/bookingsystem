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

let dbInstance = null;

function toPgSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export async function getDb() {
  if (dbInstance) return dbInstance;

  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || '';

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    // PostgreSQL Mode (Neon / Supabase / Vercel Postgres)
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }
    });

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
        if (/^insert\s+into/i.test(sql.trim()) && !/returning/i.test(sql)) {
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

  // Initialize schema & seed
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
  } catch (err) {
    console.error('Error during database initialization/seeding:', err);
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

  const doctorRows = await db.all('SELECT id FROM doctors');
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

  for (const doc of doctorRows) {
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().slice(0, 10);
      for (const t of times) {
        if (Math.random() < 0.15) continue;
        const [h, m] = t.split(':').map(Number);
        const endM = m + 30;
        const end = endM === 60 ? `${String(h + 1).padStart(2, '0')}:00` : `${String(h).padStart(2, '0')}:${endM}`;
        await db.run(
          `INSERT INTO doctor_slots (doctor_id, slot_date, start_time, end_time) VALUES (?, ?, ?, ?)`,
          [doc.id, dateStr, t, end]
        );
      }
    }
  }
}

async function seedUsers(db) {
  const staffPass = hashPassword('reception123');
  await db.run(
    `INSERT INTO users (name, email, phone, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Front Desk Staff', 'reception@meridianhealth.example', '+1 555 0100', staffPass.hash, staffPass.salt, 'staff']
  );

  const demoPass = hashPassword('patient123');
  await db.run(
    `INSERT INTO users (name, email, phone, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Aarav Patel', 'patient@meridianhealth.example', '+91 98765 43210', demoPass.hash, demoPass.salt, 'patient']
  );
}
