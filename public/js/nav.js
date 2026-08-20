// public/js/nav.js
// Renders responsive mobile top header and sticky mobile bottom navigation bar.

function renderHeader(active) {
  const el = document.getElementById('site-header');
  if (!el) return;
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();
  const isStaff = Auth.isStaff();

  const isHome = active === 'home';
  const isDoctors = active === 'doctors';
  const isDashboard = active === 'dashboard';
  const isReception = active === 'reception';

  el.innerHTML = `
    <!-- Top Mobile & Desktop Navigation Header -->
    <header class="sticky top-0 z-40 border-b border-[var(--border-light)] backdrop-blur-md bg-[var(--header-bg)]">
      <div class="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between">
        <a href="/index.html" class="flex items-center gap-2.5 shrink-0" aria-label="Doctor on Call home">
          <div class="w-9 h-9 rounded-xl bg-teal/20 border border-teal/40 flex items-center justify-center shadow-inner">
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M13 2 L13 24 M2 13 L24 13" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="13" cy="13" r="10" stroke="#F4F7F6" stroke-width="1.5" opacity="0.4"/>
            </svg>
          </div>
          <span class="font-display text-lg tracking-tight font-semibold text-white">Doctor on Call</span>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="hidden md:flex items-center gap-8">
          <a href="/index.html" class="text-sm font-medium transition hover:text-brass ${isHome ? 'text-brass font-semibold' : 'text-white/80'}">Home</a>
          <a href="/doctors.html" class="text-sm font-medium transition hover:text-brass ${isDoctors ? 'text-brass font-semibold' : 'text-white/80'}">Find a Doctor</a>
          ${loggedIn && !isStaff ? `<a href="/dashboard.html" class="text-sm font-medium transition hover:text-brass ${isDashboard ? 'text-brass font-semibold' : 'text-white/80'}">My Appointments</a>` : ''}
          ${isStaff ? `<a href="/reception/index.html" class="text-sm font-medium transition hover:text-brass ${isReception ? 'text-brass font-semibold' : 'text-white/80'}">Reception Desk</a>` : `<a href="/reception/login.html" class="text-sm font-medium transition hover:text-brass ${isReception ? 'text-brass font-semibold' : 'text-white/80'}">Staff Portal</a>`}
          ${isStaff ? `<a href="/refunds.html" class="text-sm font-medium transition hover:text-brass ${active === 'refunds' ? 'text-brass font-semibold' : 'text-white/80'}">Refunds</a>` : ''}
        </nav>

        <!-- Right Header User Controls -->
        <div class="flex items-center gap-3">
          <!-- Theme Toggle -->
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode" title="Toggle theme">
            <svg class="moon-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
            <svg class="sun-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </button>
          ${loggedIn
            ? `<div class="flex items-center gap-2">
                 <span class="hidden sm:inline text-xs font-mono text-[var(--ink)]/70 bg-[var(--bg-card)] px-2.5 py-1 rounded-full border border-[var(--border-light)]">${user?.name || 'User'}</span>
                 <button id="logout-btn" class="text-xs font-medium px-3.5 py-2 rounded-full border border-[var(--border-light)] hover:bg-[var(--bg-input)] transition active:scale-95 text-[var(--ink)]">Sign out</button>
               </div>`
            : `<div class="flex items-center gap-2">
                 <a href="/login.html" class="text-xs font-medium px-3.5 py-2 rounded-full border border-[var(--border-light)] hover:bg-[var(--bg-input)] transition active:scale-95 text-[var(--ink)]">Sign in</a>
                 <a href="/register.html" class="text-xs font-semibold px-4 py-2 rounded-full bg-brass text-ink hover:brightness-110 transition shadow-sm active:scale-95">Book Now</a>
               </div>`
          }
        </div>
      </div>
    </header>

    <!-- Sticky Mobile Bottom Navigation Bar (Visible on mobile screens) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 flex justify-around items-center">
      <a href="/index.html" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition ${isHome ? 'active text-teal' : ''}">
        <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        <span>Home</span>
      </a>

      <a href="/doctors.html" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition ${isDoctors ? 'active text-teal' : ''}">
        <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <span>Doctors</span>
      </a>

      ${loggedIn && !isStaff ? `
        <a href="/dashboard.html" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition ${isDashboard ? 'active text-teal' : ''}">
          <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>Appointments</span>
        </a>
      ` : ''}

      ${isStaff ? `
        <a href="/reception/index.html" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition ${isReception ? 'active text-teal' : ''}">
          <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span>Desk</span>
        </a>
        <a href="/refunds.html" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition ${active === 'refunds' ? 'active text-teal' : ''}">
          <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h2m4 0h2M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>Refunds</span>
        </a>
      ` : ''}

      <a href="${loggedIn ? (isStaff ? '/reception/index.html' : '/dashboard.html') : '/login.html'}" class="nav-item flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal transition">
        <svg class="w-5 h-5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <span>${loggedIn ? 'Account' : 'Sign in'}</span>
      </a>
    </nav>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await Api.post('/auth/logout'); } catch {}
      Auth.clear();
      window.location.href = '/index.html';
    });
  }
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
    <footer class="bg-ink text-white/70 border-t border-white/10 mt-16">
      <div class="mx-auto max-w-7xl px-5 sm:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="font-display text-lg text-white mb-2">Doctor on Call</div>
          <p class="text-xs text-white/60 leading-relaxed max-w-xs">Premium doctor appointments with real-time doctor availability and instant booking.</p>
        </div>
        <div>
          <div class="text-white text-xs font-mono uppercase tracking-wider mb-3">Quick Navigation</div>
          <ul class="space-y-2 text-xs">
            <li><a href="/doctors.html" class="hover:text-white transition">Find a doctor</a></li>
            <li><a href="/doctors.html" class="hover:text-white transition">Book an appointment</a></li>
            <li><a href="/register.html" class="hover:text-white transition">Create an account</a></li>
            <li><a href="/dashboard.html" class="hover:text-white transition">My appointments</a></li>
            <li><a href="/feedback.html" class="hover:text-white transition">Send feedback</a></li>
          </ul>
        </div>
        <div>
          <div class="text-white text-xs font-mono uppercase tracking-wider mb-3">Contact us</div>
          <ul class="space-y-2.5 text-xs">
            <li>
              <a href="https://wa.me/919173740210?text=I%20need%20emergency%20help" target="_blank" rel="noopener" class="flex items-center gap-2 hover:text-white transition">
                <svg class="w-3.5 h-3.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                Emergency helpline
              </a>
            </li>
            <li>
              <a href="https://wa.me/919173740210" target="_blank" rel="noopener" class="flex items-center gap-2 hover:text-white transition">
                <svg class="w-3.5 h-3.5 shrink-0 text-teal" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                +91 91737 40210
              </a>
            </li>
            <li>
              <a href="mailto:np799519@gmail.com" class="flex items-center gap-2 hover:text-white transition">
                <svg class="w-3.5 h-3.5 shrink-0 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                np799519@gmail.com
              </a>
            </li>
            <li class="flex items-start gap-2 leading-relaxed text-white/60">
              <svg class="w-3.5 h-3.5 shrink-0 text-teal mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <a href="https://www.google.com/maps/search/?api=1&query=Vision%20Tower%20MG%20Road%20Pune%20Maharashtra%20411001" target="_blank" rel="noopener" class="hover:text-white transition">Vision Tower, 3rd Floor, MG Road, Pune, Maharashtra 411001<br><span class="text-teal">Open in Google Maps →</span></a>
            </li>
          </ul>
        </div>
        <div>
          <div class="text-white text-xs font-mono uppercase tracking-wider mb-3">Staff Portal</div>
          <ul class="space-y-2 text-xs">
            <li><a href="/reception/login.html" class="hover:text-white transition">Reception desk sign in</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 py-4 text-center text-xs text-white/40">© ${new Date().getFullYear()} Doctor on Call Platform.</div>
    </footer>
  `;
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const page = document.body.getAttribute('data-page') || '';
  renderHeader(page);
  renderFooter();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});
