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
    // Session is invalid/expired on the server (e.g. DB was reset, token expired) -> drop the stale
    // local login and send the user to the right sign-in page. Login/register 401s are real errors.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      const wasStaff = Auth.isStaff();
      Auth.clear();
      const here = location.pathname;
      const onAuthPage = /\/(login|register)\.html$/.test(here);
      if (!onAuthPage) {
        const target = (wasStaff || here.startsWith('/reception')) ? '/reception/login.html'
          : '/login.html?redirect=' + encodeURIComponent(here + location.search);
        location.href = target;
      }
    }
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

function formatLocalDate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const str = String(dateStr).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? str : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

// Returns the verified user, or null (and clears the local session) if the server doesn't accept the token.
Auth.verify = async function () {
  if (!Auth.getToken()) return null;
  try {
    const { user } = await Api.get('/me');
    localStorage.setItem(Auth.USER_KEY, JSON.stringify(user));
    return user;
  } catch (e) {
    if (e.status === 401) Auth.clear();
    return null;
  }
};

window.Auth = Auth;
window.Api = Api;
window.formatLocalDate = formatLocalDate;
window.fmtDate = fmtDate;
window.fmtTime = fmtTime;
window.money = money;
window.statusBadge = statusBadge;
window.apptStatusBadge = apptStatusBadge;
