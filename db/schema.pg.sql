-- Doctor on Call Clinic — SQL Schema (PostgreSQL)
-- Compatible with Neon, Supabase, Vercel Postgres, Railway, and standard PostgreSQL.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'patient',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255) NOT NULL,
  bio TEXT,
  photo_seed VARCHAR(100),
  experience_years INTEGER DEFAULT 0,
  consultation_fee NUMERIC(10, 2) DEFAULT 0,
  rating NUMERIC(3, 2) DEFAULT 4.8,
  location VARCHAR(255) DEFAULT 'Main Campus',
  availability_status VARCHAR(50) NOT NULL DEFAULT 'available',
  status_note TEXT,
  status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_slots (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_date VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  is_booked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES doctor_slots(id) ON DELETE SET NULL,
  appointment_date VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'pay_at_hospital',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  booked_by_staff_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  transaction_ref VARCHAR(100),
  card_last4 VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_slots_doctor_date ON doctor_slots(doctor_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_appts_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appts_doctor ON appointments(doctor_id);
