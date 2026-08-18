// public/js/api.js
// Thin fetch wrapper + auth/session helpers shared by every page.

const API_BASE = '/api';

const Auth = {
  TOKEN_KEY: 'mh_token',
  USER_KEY: 'mh_user',

  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); }
    catch { return null; }
  },
  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },
  isLoggedIn() { return !!this.getToken(); },
  isStaff() { const u = this.getUser(); return u && (u.role === 'staff' || u.role === 'admin'); },
};

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const Api = {
  get: (path) => api('GET', path),
  post: (path, body) => api('POST', path, body),
  patch: (path, body) => api('PATCH', path, body),
};

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function money(n) { return `₹${Number(n).toFixed(0)}`; }

function statusBadge(status) {
  const map = {
    available: { label: 'Available now', dot: 'pulse-dot', cls: 'text-emerald-800 bg-emerald-50 ring-emerald-600/20' },
    busy: { label: 'With a patient', dot: 'pulse-dot status-dot-busy', cls: 'text-amber-800 bg-amber-50 ring-amber-600/20' },
    off_duty: { label: 'Off duty', dot: 'pulse-dot status-dot-off', cls: 'text-stone-600 bg-stone-100 ring-stone-500/20' },
  };
  return map[status] || map.off_duty;
}

function apptStatusBadge(status) {
  const map = {
    pending: 'text-amber-800 bg-amber-50 ring-amber-600/20',
    confirmed: 'text-emerald-800 bg-emerald-50 ring-emerald-600/20',
    completed: 'text-teal-800 bg-teal-50 ring-teal-600/20',
    cancelled: 'text-stone-600 bg-stone-100 ring-stone-500/20',
  };
  return map[status] || map.pending;
}

window.Auth = Auth;
window.Api = Api;
window.fmtDate = fmtDate;
window.fmtTime = fmtTime;
window.money = money;
window.statusBadge = statusBadge;
window.apptStatusBadge = apptStatusBadge;
