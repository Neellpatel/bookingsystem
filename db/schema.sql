-- Meridian Health Clinic — SQL Schema (SQLite)
-- All persistent data for the platform lives in this relational schema.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient',      -- patient | staff | admin
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  bio TEXT,
  photo_seed TEXT,
  experience_years INTEGER DEFAULT 0,
  consultation_fee REAL DEFAULT 0,
  rating REAL DEFAULT 4.8,
  location TEXT DEFAULT 'Main Campus',
  availability_status TEXT NOT NULL DEFAULT 'available', -- available | busy | off_duty
  status_note TEXT,
  status_updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctor_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_date TEXT NOT NULL,      -- YYYY-MM-DD
  start_time TEXT NOT NULL,     -- HH:MM (24h)
  end_time TEXT NOT NULL,
  is_booked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES doctor_slots(id) ON DELETE SET NULL,
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | confirmed | completed | cancelled
  payment_method TEXT NOT NULL DEFAULT 'pay_at_hospital', -- online | pay_at_hospital
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- paid | unpaid | refunded
  amount REAL NOT NULL DEFAULT 0,
  booked_by_staff_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT NOT NULL,               -- online | pay_at_hospital
  status TEXT NOT NULL,               -- success | pending | failed
  transaction_ref TEXT,
  card_last4 TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_doctor_date ON doctor_slots(doctor_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_appts_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appts_doctor ON appointments(doctor_id);
