// public/js/nav.js
// Renders the site header/footer into #site-header / #site-footer, aware of auth state.

function renderHeader(active) {
  const el = document.getElementById('site-header');
  if (!el) return;
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();

  const link = (href, label, key) => `<a href="${href}" class="text-sm font-medium transition hover:text-brass ${active === key ? 'text-brass' : 'text-white/85'}">${label}</a>`;

  el.innerHTML = `
    <header class="bg-ink text-white">
      <div class="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="/index.html" class="flex items-center gap-2 shrink-0" aria-label="Meridian Health home">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M13 2 L13 24 M2 13 L24 13" stroke="#C99A44" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="13" cy="13" r="11" stroke="#F7F5F0" stroke-width="1.2" opacity="0.35"/>
          </svg>
          <span class="font-display text-lg tracking-tight">Meridian <span class="text-brass">Health</span></span>
        </a>
        <nav class="hidden md:flex items-center gap-7">
          ${link('/index.html', 'Home', 'home')}
          ${link('/doctors.html', 'Find a Doctor', 'doctors')}
          ${loggedIn && !Auth.isStaff() ? link('/dashboard.html', 'My Appointments', 'dashboard') : ''}
          ${link('/reception/login.html', 'Staff Portal', 'reception')}
        </nav>
        <div class="flex items-center gap-3">
          ${loggedIn
            ? `<span class="hidden sm:inline text-sm text-white/70 font-mono">${user?.name || ''}</span>
               <button id="logout-btn" class="text-sm font-medium px-4 py-2 rounded-full border border-white/25 hover:bg-white/10 transition">Sign out</button>`
            : `<a href="/login.html" class="text-sm font-medium px-4 py-2 rounded-full border border-white/25 hover:bg-white/10 transition">Sign in</a>
               <a href="/register.html" class="text-sm font-semibold px-4 py-2 rounded-full bg-brass text-ink hover:brightness-110 transition">Book now</a>`
          }
        </div>
      </div>
    </header>
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
    <footer class="bg-ink text-white/70 mt-24">
      <div class="mx-auto max-w-7xl px-5 sm:px-8 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <div class="font-display text-lg text-white mb-2">Meridian <span class="text-brass">Health</span></div>
          <p class="text-sm leading-relaxed max-w-xs">Premium, unhurried care — book real appointments with real specialists, on your schedule.</p>
        </div>
        <div>
          <div class="text-white text-sm font-semibold mb-3 font-mono uppercase tracking-wide">Patients</div>
          <ul class="space-y-2 text-sm">
            <li><a href="/doctors.html" class="hover:text-white transition">Find a doctor</a></li>
            <li><a href="/register.html" class="hover:text-white transition">Create an account</a></li>
            <li><a href="/dashboard.html" class="hover:text-white transition">My appointments</a></li>
          </ul>
        </div>
        <div>
          <div class="text-white text-sm font-semibold mb-3 font-mono uppercase tracking-wide">Clinic staff</div>
          <ul class="space-y-2 text-sm">
            <li><a href="/reception/login.html" class="hover:text-white transition">Reception portal</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 py-5 text-center text-xs text-white/40">© ${new Date().getFullYear()} Meridian Health. A demonstration clinic — not a real medical provider.</div>
    </footer>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page') || '';
  renderHeader(page);
  renderFooter();
});
