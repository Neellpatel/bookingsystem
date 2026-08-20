// server.js
// Doctor on Call — appointment booking platform.
// Pure Node.js + Multi-Database (PostgreSQL / Turso / Local SQLite).
// Frontend: static HTML5 + Tailwind CSS served from /public.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { getDb, hashPassword, verifyPassword } from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// ---------- helpers ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
    }
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2_000_000) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export async function getSessionUser(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const db = await getDb();
  const session = await db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    return null;
  }
  const user = await db.get('SELECT id, name, email, phone, role FROM users WHERE id = ?', [session.user_id]);
  return user || null;
}

export async function createSession(userId) {
  const token = randomUUID() + randomBytes(8).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const db = await getDb();
  await db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expires]);
  return token;
}

function publicDoctor(d) {
  return {
    id: d.id, name: d.name, specialty: d.specialty, bio: d.bio, photoSeed: d.photo_seed,
    experienceYears: d.experience_years, consultationFee: d.consultation_fee, rating: d.rating,
    location: d.location, availabilityStatus: d.availability_status, statusNote: d.status_note,
    statusUpdatedAt: d.status_updated_at,
  };
}

function publicAppointment(a) {
  return {
    id: a.id, patientId: a.patient_id, doctorId: a.doctor_id, doctorName: a.doctor_name,
    specialty: a.specialty, patientName: a.patient_name, patientPhone: a.patient_phone,
    date: a.appointment_date, startTime: a.start_time, endTime: a.end_time, reason: a.reason,
    status: a.status, paymentMethod: a.payment_method, paymentStatus: a.payment_status,
    amount: a.amount, createdAt: a.created_at,
  };
}

// ---------- static file serving ----------

export async function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  let fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  try {
    let stat = fs.statSync(fullPath);
    if (stat.isDirectory()) fullPath = path.join(fullPath, 'index.html');
    const data = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const data = fs.readFileSync(path.join(PUBLIC_DIR, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  }
}

// ---------- API router ----------

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, regex, keys, handler });
}

export async function handleApi(req, res, pathname, query) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = pathname.match(r.regex);
    if (!match) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
    try {
      await r.handler(req, res, params, query);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return true;
  }
  return false;
}

// ---- Auth ----

route('POST', '/api/auth/register', async (req, res) => {
  const body = await readBody(req);
  const { name, email, phone, password } = body;
  if (!name || !email || !password || password.length < 6) {
    return sendJson(res, 400, { error: 'Please provide your name, a valid email, and a password of at least 6 characters.' });
  }
  const db = await getDb();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) return sendJson(res, 409, { error: 'An account with that email already exists. Try signing in instead.' });
  const { hash, salt } = hashPassword(password);
  const info = await db.run(
    'INSERT INTO users (name, email, phone, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)',
    [name.trim(), email.toLowerCase().trim(), phone || '', hash, salt, 'patient']
  );
  const token = await createSession(info.lastInsertRowid);
  sendJson(res, 201, { token, user: { id: info.lastInsertRowid, name, email, role: 'patient' } });
});

route('POST', '/api/auth/login', async (req, res) => {
  const { email, password, staff } = await readBody(req);
  if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return sendJson(res, 401, { error: 'Incorrect email or password.' });
  }
  if (staff && user.role === 'patient') {
    return sendJson(res, 403, { error: 'This account does not have staff access.' });
  }
  const token = await createSession(user.id);
  sendJson(res, 200, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

route('GET', '/api/me', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Not signed in.' });
  sendJson(res, 200, { user });
});

route('POST', '/api/auth/logout', async (req, res) => {
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) {
    const db = await getDb();
    await db.run('DELETE FROM sessions WHERE token = ?', [auth.slice(7)]);
  }
  sendJson(res, 200, { ok: true });
});

// ---- Doctors ----

route('GET', '/api/doctors', async (req, res, params, query) => {
  const db = await getDb();
  let sql = 'SELECT * FROM doctors WHERE 1=1';
  const args = [];
  if (query.specialty) { sql += ' AND specialty = ?'; args.push(query.specialty); }
  if (query.q) { sql += ' AND (name LIKE ? OR specialty LIKE ?)'; args.push(`%${query.q}%`, `%${query.q}%`); }
  if (query.available === '1') { sql += ` AND availability_status = 'available'`; }
  sql += ' ORDER BY name';
  const rows = await db.all(sql, args);
  sendJson(res, 200, { doctors: rows.map(publicDoctor) });
});

route('GET', '/api/doctors/specialties', async (req, res) => {
  const db = await getDb();
  const rows = await db.all('SELECT DISTINCT specialty FROM doctors ORDER BY specialty');
  sendJson(res, 200, { specialties: rows.map(r => r.specialty) });
});

route('GET', '/api/doctors/:id', async (req, res, params) => {
  const db = await getDb();
  const d = await db.get('SELECT * FROM doctors WHERE id = ?', [params.id]);
  if (!d) return sendJson(res, 404, { error: 'Doctor not found.' });
  sendJson(res, 200, { doctor: publicDoctor(d) });
});

route('GET', '/api/doctors/:id/slots', async (req, res, params, query) => {
  const db = await getDb();
  const date = query.date;
  let sql = 'SELECT * FROM doctor_slots WHERE doctor_id = ? AND is_booked = 0';
  const args = [params.id];
  if (date) {
    sql += ' AND slot_date = ?';
    args.push(date);
  } else {
    const todayStr = new Date().toISOString().slice(0, 10);
    sql += ' AND slot_date >= ?';
    args.push(todayStr);
  }
  sql += ' ORDER BY slot_date, start_time';
  const slots = await db.all(sql, args);
  sendJson(res, 200, { slots: slots.map(s => ({ id: s.id, date: s.slot_date, startTime: s.start_time, endTime: s.end_time })) });
});

route('PATCH', '/api/doctors/:id/availability', async (req, res, params) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const { status, note } = await readBody(req);
  if (!['available', 'busy', 'off_duty'].includes(status)) return sendJson(res, 400, { error: 'Invalid status.' });
  const db = await getDb();
  const nowISO = new Date().toISOString();
  await db.run(`UPDATE doctors SET availability_status = ?, status_note = ?, status_updated_at = ? WHERE id = ?`,
    [status, note || '', nowISO, params.id]);
  const d = await db.get('SELECT * FROM doctors WHERE id = ?', [params.id]);
  sendJson(res, 200, { doctor: publicDoctor(d) });
});

// ---- Appointments ----

const APPT_SELECT = `SELECT a.*, d.name AS doctor_name, d.specialty AS specialty, u.name AS patient_name, u.phone AS patient_phone
  FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = a.patient_id`;

route('GET', '/api/patients/lookup', async (req, res, params, query) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const email = (query.email || '').toLowerCase().trim();
  if (!email) return sendJson(res, 400, { error: 'Email is required.' });
  const db = await getDb();
  const patient = await db.get(`SELECT id, name, email, phone, role FROM users WHERE email = ?`, [email]);
  if (!patient || patient.role !== 'patient') return sendJson(res, 404, { error: 'No patient account found with that email.' });
  sendJson(res, 200, { patient });
});

route('POST', '/api/appointments', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in to book an appointment.' });
  const isStaff = user.role === 'staff' || user.role === 'admin';
  const { doctorId, slotId, reason, paymentMethod, patientId } = await readBody(req);
  if (!doctorId || !slotId || !paymentMethod) return sendJson(res, 400, { error: 'Doctor, time slot, and payment method are required.' });
  if (!['online', 'pay_at_hospital'].includes(paymentMethod)) return sendJson(res, 400, { error: 'Invalid payment method.' });

  const db = await getDb();
  let targetPatientId = user.id;
  if (isStaff && patientId) {
    const patient = await db.get(`SELECT id FROM users WHERE id = ? AND role = 'patient'`, [patientId]);
    if (!patient) return sendJson(res, 404, { error: 'Patient account not found.' });
    targetPatientId = patient.id;
  } else if (isStaff && !patientId) {
    return sendJson(res, 400, { error: 'Select a patient before booking on the reception desk.' });
  }

  const slot = await db.get('SELECT * FROM doctor_slots WHERE id = ? AND doctor_id = ?', [slotId, doctorId]);
  if (!slot || Number(slot.is_booked) === 1) return sendJson(res, 409, { error: 'That slot is no longer available. Please pick another time.' });
  const doctor = await db.get('SELECT * FROM doctors WHERE id = ?', [doctorId]);
  if (!doctor) return sendJson(res, 404, { error: 'Doctor not found.' });

  const status = (!isStaff && paymentMethod === 'online') ? 'pending' : 'confirmed';
  const paymentStatus = (isStaff && paymentMethod === 'online') ? 'paid' : 'unpaid';

  const info = await db.run(`INSERT INTO appointments
    (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, reason, status, payment_method, payment_status, amount, booked_by_staff_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [targetPatientId, doctorId, slotId, slot.slot_date, slot.start_time, slot.end_time, reason || '', status, paymentMethod, paymentStatus, doctor.consultation_fee, isStaff ? user.id : null]);

  await db.run('UPDATE doctor_slots SET is_booked = 1 WHERE id = ?', [slotId]);

  const appt = await db.get(APPT_SELECT + ' WHERE a.id = ?', [info.lastInsertRowid]);
  sendJson(res, 201, { appointment: publicAppointment(appt) });
});

route('GET', '/api/appointments/mine', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in.' });
  const db = await getDb();
  const rows = await db.all(APPT_SELECT + ' WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.start_time DESC', [user.id]);
  sendJson(res, 200, { appointments: rows.map(publicAppointment) });
});

route('GET', '/api/appointments', async (req, res, params, query) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const db = await getDb();
  let sql = APPT_SELECT + ' WHERE 1=1';
  const args = [];
  if (query.date) { sql += ' AND a.appointment_date = ?'; args.push(query.date); }
  if (query.status) { sql += ' AND a.status = ?'; args.push(query.status); }
  if (query.doctorId) { sql += ' AND a.doctor_id = ?'; args.push(query.doctorId); }
  if (query.q) { sql += ' AND (u.name LIKE ? OR d.name LIKE ?)'; args.push(`%${query.q}%`, `%${query.q}%`); }
  sql += ' ORDER BY a.appointment_date, a.start_time';
  const rows = await db.all(sql, args);
  sendJson(res, 200, { appointments: rows.map(publicAppointment) });
});

route('PATCH', '/api/appointments/:id', async (req, res, params) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in.' });
  const db = await getDb();
  const appt = await db.get('SELECT * FROM appointments WHERE id = ?', [params.id]);
  if (!appt) return sendJson(res, 404, { error: 'Appointment not found.' });

  const isOwner = Number(appt.patient_id) === Number(user.id);
  const isStaff = user.role === 'staff' || user.role === 'admin';
  if (!isOwner && !isStaff) return sendJson(res, 403, { error: 'Not authorized.' });

  const { status } = await readBody(req);
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return sendJson(res, 400, { error: 'Invalid status.' });
  if (isOwner && !isStaff && status !== 'cancelled') return sendJson(res, 403, { error: 'Patients can only cancel their own appointments.' });

  const nowISO = new Date().toISOString();
  await db.run(`UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?`, [status, nowISO, params.id]);
  if (status === 'cancelled' && appt.slot_id) {
    await db.run('UPDATE doctor_slots SET is_booked = 0 WHERE id = ?', [appt.slot_id]);
  }
  const updated = await db.get(APPT_SELECT + ' WHERE a.id = ?', [params.id]);
  sendJson(res, 200, { appointment: publicAppointment(updated) });
});

// ---- Payments (mock gateway) ----

route('POST', '/api/payments/mock', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in.' });
  const { appointmentId, cardNumber, expiry, cvv, cardName } = await readBody(req);
  const db = await getDb();
  const appt = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
  if (!appt) return sendJson(res, 404, { error: 'Appointment not found.' });
  if (Number(appt.patient_id) !== Number(user.id)) return sendJson(res, 403, { error: 'Not authorized.' });

  const digits = String(cardNumber || '').replace(/\s+/g, '');
  if (digits.length < 12 || !expiry || !cvv || !cardName) {
    return sendJson(res, 400, { error: 'Please enter valid card details.' });
  }

  const ref = 'TXN' + randomBytes(6).toString('hex').toUpperCase();
  await db.run(`INSERT INTO payments (appointment_id, amount, method, status, transaction_ref, card_last4) VALUES (?, ?, 'online', 'success', ?, ?)`,
    [appt.id, appt.amount, ref, digits.slice(-4)]);
  const nowISO = new Date().toISOString();
  await db.run(`UPDATE appointments SET payment_status = 'paid', status = 'confirmed', updated_at = ? WHERE id = ?`, [nowISO, appt.id]);

  const updated = await db.get(APPT_SELECT + ' WHERE a.id = ?', [appt.id]);
  sendJson(res, 200, { appointment: publicAppointment(updated), transactionRef: ref });
});

route('POST', '/api/payments/refund', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in.' });
  const { appointmentId, reason } = await readBody(req);
  const db = await getDb();
  const appt = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
  if (!appt) return sendJson(res, 404, { error: 'Appointment not found.' });

  const isOwner = Number(appt.patient_id) === Number(user.id);
  const isStaff = user.role === 'staff' || user.role === 'admin';
  if (!isOwner && !isStaff) return sendJson(res, 403, { error: 'Not authorized.' });

  if (appt.payment_status !== 'paid') {
    return sendJson(res, 400, { error: 'This appointment was not paid online, so there is nothing to refund.' });
  }
  if (appt.status === 'completed') {
    return sendJson(res, 400, { error: 'Completed appointments cannot be refunded.' });
  }
  const existing = await db.get('SELECT * FROM refunds WHERE appointment_id = ?', [appt.id]);
  if (existing) return sendJson(res, 409, { error: 'This appointment has already been refunded.' });

  const ref = 'RFD' + randomBytes(6).toString('hex').toUpperCase();
  const nowISO = new Date().toISOString();
  const refundAmount = Math.round(Number(appt.amount) * 30) / 100;
  await db.run(`INSERT INTO refunds (appointment_id, amount, reason, transaction_ref, status, refunded_by) VALUES (?, ?, ?, ?, 'refunded', ?)`,
    [appt.id, refundAmount, (reason || '').trim(), ref, user.id]);

  await db.run(`UPDATE appointments SET payment_status = 'refunded', status = 'cancelled', updated_at = ? WHERE id = ?`, [nowISO, appt.id]);
  if (appt.slot_id) {
    await db.run('UPDATE doctor_slots SET is_booked = 0 WHERE id = ?', [appt.slot_id]);
  }

  const updated = await db.get(APPT_SELECT + ' WHERE a.id = ?', [appt.id]);
  sendJson(res, 200, { appointment: publicAppointment(updated), refund: { transactionRef: ref, amount: refundAmount, originalAmount: Number(appt.amount) } });
});

// ---- Dashboard stats (staff) ----

route('GET', '/api/staff/summary', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const r1 = await db.get(`SELECT COUNT(*) c FROM appointments WHERE appointment_date = ?`, [today]);
  const r2 = await db.get(`SELECT COUNT(*) c FROM appointments WHERE status = 'pending'`);
  const r3 = await db.get(`SELECT COUNT(*) c FROM appointments WHERE status = 'confirmed' AND appointment_date = ?`, [today]);
  const r4 = await db.get(`SELECT COUNT(*) c FROM doctors WHERE availability_status = 'available'`);
  const r5 = await db.get(`SELECT COUNT(*) c FROM doctors`);

  sendJson(res, 200, {
    todayCount: Number(r1?.c || r1?.count || 0),
    pending: Number(r2?.c || r2?.count || 0),
    confirmed: Number(r3?.c || r3?.count || 0),
    doctorsAvailable: Number(r4?.c || r4?.count || 0),
    doctorsTotal: Number(r5?.c || r5?.count || 0)
  });
});

// ---- Feedback ----

route('POST', '/api/feedback', async (req, res) => {
  const user = await getSessionUser(req);
  const body = await readBody(req);
  const { rating, doctorName, message } = body;
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  if (!message || !String(message).trim()) {
    return sendJson(res, 400, { error: 'Please write your feedback message.' });
  }
  const stars = Number(rating);
  if (![1, 2, 3, 4, 5].includes(stars)) {
    return sendJson(res, 400, { error: 'Please choose a rating between 1 and 5 stars.' });
  }
  const db = await getDb();
  const info = await db.run(
    `INSERT INTO feedback (user_id, name, email, rating, doctor_name, message) VALUES (?, ?, ?, ?, ?, ?)`,
    [user ? user.id : null, name || (user ? user.name : 'Anonymous'), email || (user ? user.email : ''), stars, (doctorName || '').trim(), String(message).trim()]
  );
  sendJson(res, 201, { feedback: { id: info.lastInsertRowid, rating: stars } });
});

route('GET', '/api/feedback', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const db = await getDb();
  const rows = await db.all('SELECT * FROM feedback ORDER BY created_at DESC, id DESC LIMIT 200');
  sendJson(res, 200, { feedback: rows.map((f) => ({
    id: f.id, name: f.name, email: f.email, rating: f.rating,
    doctorName: f.doctor_name, message: f.message, createdAt: f.created_at,
  })) });
});

route('GET', '/api/feedback/public', async (req, res) => {
  const db = await getDb();
  const rows = await db.all(`SELECT * FROM feedback WHERE rating >= 4 AND length(trim(message)) > 0 ORDER BY created_at DESC, id DESC LIMIT 6`);
  sendJson(res, 200, { testimonials: rows.map((f) => ({
    id: f.id, name: f.name, rating: f.rating, doctorName: f.doctor_name || '', message: f.message, createdAt: f.created_at,
  })) });
});

// ---- Refunds ----

route('GET', '/api/refunds', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return sendJson(res, 403, { error: 'Staff access required.' });
  const db = await getDb();
  const rows = await db.all(`SELECT r.id, r.amount, r.reason, r.transaction_ref, r.status, r.created_at,
    r.refunded_by, rb.name AS refunded_by_name,
    a.patient_id, a.amount AS original_amount, u.name AS patient_name, u.email AS patient_email,
    a.doctor_id, d.name AS doctor_name, d.specialty AS specialty
    FROM refunds r
    JOIN appointments a ON a.id = r.appointment_id
    JOIN users u ON u.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN users rb ON rb.id = r.refunded_by
    ORDER BY r.created_at DESC, r.id DESC LIMIT 500`);
  sendJson(res, 200, { refunds: rows.map((r) => ({
    id: r.id, transactionRef: r.transaction_ref, amount: r.amount, originalAmount: r.original_amount, reason: r.reason,
    status: r.status, patientName: r.patient_name, patientEmail: r.patient_email,
    doctorName: r.doctor_name, specialty: r.specialty,
    refundedBy: r.refunded_by_name || 'Patient', createdAt: r.created_at,
  })) });
});

// ---- AI health assistant (rule-based) ----

const ASSISTANT = {
  greeting: {
    match: /^(hi|hii+|hello|hey|namaste|good (morning|afternoon|evening)|yo|hola)\b/i,
    reply: `Hello! 👋 I'm your Doctor on Call assistant.\n\nI can help you with:\n• Finding & booking a doctor\n• Payments, refunds & cancellations\n• Clinic contact & address\n• Simple symptom guidance\n\nWhat do you need help with today?`,
    suggestions: ['Book an appointment', 'Fees & payments', 'Symptom advice', 'Where are you located?'],
  },
  booking: {
    match: /(book|appointment|slot|schedule|reserve|booking)/i,
    reply: `Booking is easy: 1) Create a free account (Register → Book Now), 2) Find a doctor and see their live availability, 3) Pick a 30-minute slot in the next 7 days, 4) Pay online or at the hospital.\n\nWant me to help you find a doctor for a specific problem? Just tell me your symptoms.`,
    suggestions: ['Fever and cold', 'What doctors are available?', 'Do I pay online?', 'Where are you located?'],
  },
  doctors: {
    match: /(which doctor|what doctor|special|available doctors|find a doctor|doctor for|best doctor|who is free)/i,
    reply: `We have specialists in: Cardiology, Orthopedics, Dermatology, Pediatrics, Neurology, General Medicine, Gynecology, and Dentistry.\n\nEvery doctor shows a live status — Available now / With a patient / Off duty — so you always know who you can actually see.`,
    suggestions: ['Book for headache', 'Fees & payments', 'Which doctor for skin problem?', 'Where are you located?'],
  },
  fees: {
    match: /(fee|fees|price|cost|charge|paid|payment|pay|rate|how much|consultation)/i,
    reply: `Consultation fees vary by specialist (from around ₹400–₹900 per visit).\n\nYou can pay in two ways:\n• 💳 Online now — card payment, confirmed instantly\n• 🏥 At the hospital — pay at the front desk when you arrive\n\nOnline-paid appointments can be refunded before the visit if you can't make it.`,
    suggestions: ['How do I get a refund?', 'Book a doctor', 'Where are you located?'],
  },
  refund: {
    match: /(refund|money back|reimburse)/i,
    reply: `If you paid online and haven't completed your visit yet:\n\n1) Go to My Appointments, 2) tap "Request refund", or ask the reception desk.\n\n30% of the paid amount is refunded (70% is a cancellation fee). The appointment is cancelled and the slot is freed for someone else. Completed or unpaid appointments can't be refunded.`,
    suggestions: ['Book a doctor', 'Fees & payments', 'Cancel my appointment'],
  },
  cancel: {
    match: /(cancel|can'?t make|couldn'?t come)/i,
    reply: `You can cancel an upcoming appointment anytime from "My Appointments" on the dashboard.\n\nThe slot is freed right away. If you already paid online, request a refund at the same time and your money comes back.`,
    suggestions: ['How do I get a refund?', 'Book a doctor', 'Where are you located?'],
  },
  emergency: {
    match: /(emergency|urgent|serious|severe|ambulance|heart attack|chest pain|unconscious|breathing|bleeding)/i,
    reply: `⚠️ This sounds serious — please don't wait.\n\n• Call 108 (ambulance) or 112 (National Emergency Number) right now\n• Our emergency helpline: +91 95863 33534 on WhatsApp\n• If you're near us, come in immediately — we'll see you first.\n\nI'm an assistant, not a doctor — for symptoms that worry you, real medical care comes first.`,
    suggestions: ['I still want to see a doctor today', 'Where are you located?'],
  },
  symptoms: {
    match: /(fever|cold|cough|headache|pain|dizzy|vomit|rash|skin|stomach|tummy|back|knee|joint|throat|flu|covid|diabetic|bp|blood pressure|sugar|sleep|anxiety|depress|allergy|infection)/i,
    reply: `I can point you to the right specialist, but always confirm with a real doctor:\n\n• Fever, cold, cough, flu → General Medicine\n• Headache, fits, numbness → Neurology\n• Rash, acne, skin issues → Dermatology\n• Stomach pain, acidity → General Medicine\n• Back / knee / joint pain → Orthopedics\n• Child unwell → Pediatrics\n\nI'm not a doctor — this is just a starting point so you book the right department.`,
    suggestions: ['Book an appointment', 'Available doctors', 'Fees & payments'],
  },
  location: {
    match: /(where|location|address|reach|locate|direction|map|campus|near|clinic)/i,
    reply: `📍 We're at:\n\nIndus University, Rancharda, via Shilaj, Gujarat 382115\n\nTap "Visit us" on our homepage to open the exact location in Google Maps.`,
    suggestions: ['Book an appointment', 'Contact numbers', 'Emergency help'],
  },
  contact: {
    match: /(contact|phone|number|call|whatsapp|mail|email|reach you)/i,
    reply: `You can reach us at:\n\n• WhatsApp / Phone: +91 91737 40210\n• Email: np799519@gmail.com\n• Emergency helpline (WhatsApp): +91 95863 33534\n• Address: Indus University, Rancharda, via Shilaj, Gujarat 382115`,
    suggestions: ['Open location', 'Book an appointment', 'Emergency help'],
  },
  hours: {
    match: /(open|close|timing|time (do|are)|hour|working)/i,
    reply: `You can browse and book online 24×7 — slots open across the next 7 days.\n\nReception is staffed during regular hospital hours, and our WhatsApp/emergency line (+91 95863 33534) is always available for urgent help.`,
    suggestions: ['Book an appointment', 'Where are you located?', 'Emergency help'],
  },
  thanks: {
    match: /(thank|thanks|thx|great|awesome|nice help|perfect)/i,
    reply: `You're welcome! 😊 If you're ready, you can book in under a minute. Need anything else?`,
    suggestions: ['Book an appointment', 'Fees & payments', 'Where are you located?'],
  },
};

route('POST', '/api/chat', async (req, res) => {
  const { message } = await readBody(req);
  const text = String(message || '').trim();
  if (!text) return sendJson(res, 400, { error: 'Please type a message.' });
  if (text.length > 500) return sendJson(res, 400, { error: 'Message too long (500 characters max).' });

  const priority = ['emergency', 'greeting', 'booking', 'doctors', 'symptoms', 'fees', 'refund', 'cancel', 'location', 'contact', 'hours', 'thanks'];
  let reply = null, suggestions = [];
  for (const key of priority) {
    const rule = ASSISTANT[key];
    if (rule.match.test(text)) { reply = rule.reply; suggestions = rule.suggestions; break; }
  }
  if (!reply) {
    reply = `I'm not 100% sure about that one. 🙏 Here's what I can help with:\n\n• Booking appointments & finding doctors\n• Fees, refunds & cancellations\n• Clinic location & contact\n• Simple symptom guidance\n\nTry one of these, or ask me again in different words.`;
    suggestions = ['Book an appointment', 'Symptom advice', 'Where are you located?', 'Emergency help'];
  }
  sendJson(res, 200, { reply, suggestions });
});

// ---------- Serverless & HTTP server ----------

export default async function handler(req, res) {
  try {
    await getDb();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());

    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, pathname, query);
      if (!handled) sendJson(res, 404, { error: 'Not found' });
      return;
    }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

if (!process.env.VERCEL && !process.env.NOW_REGION) {
  const server = http.createServer(handler);

  server.listen(PORT, async () => {
    await getDb();
    console.log(`Doctor on Call server running → http://localhost:${PORT}`);
    console.log(`Staff/reception login → reception@doctoroncall.example / reception123`);
    console.log(`Demo patient login    → patient@doctoroncall.example / patient123`);
  });
}
