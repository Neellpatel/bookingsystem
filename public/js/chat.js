// public/js/chat.js
// Floating AI chat widget — bottom right, loads on every page.

(function () {
  const AVATAR_SVG = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 2 L13 24 M2 13 L24 13" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/><circle cx="13" cy="13" r="10" stroke="#F4F7F6" stroke-width="1.5" opacity="0.4"/></svg>';
  const CHAT_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';
  const SEND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>';

  function loadStyles() {
    const css = `
      #doc-chat-btn{position:fixed;right:18px;bottom:78px;z-index:70;width:58px;height:58px;border-radius:50%;background:#0D9488;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 30px -6px rgba(13,148,136,.55);border:none;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}
      #doc-chat-btn:hover{transform:scale(1.08)}
      #doc-chat-btn:active{transform:scale(.94)}
      #doc-chat-btn .doc-chat-pulse{position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(13,148,136,.45);animation:docPing 2s cubic-bezier(.2,.7,.4,1) infinite}
      @keyframes docPing{0%{transform:scale(.7);opacity:.9}80%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}
      #doc-chat-wrap{position:fixed;right:14px;bottom:150px;z-index:71;width:min(94vw,380px);height:min(72vh,520px);background:var(--bg-card,#fff);border:1px solid var(--border-light,#E5E7EB);border-radius:20px;box-shadow:0 24px 60px -12px rgba(7,25,29,.35);display:none;flex-direction:column;overflow:hidden;color:var(--text-primary,#111827);font-family:Inter,ui-sans-serif,sans-serif}
      #doc-chat-wrap.open{display:flex;animation:docPop .28s cubic-bezier(.22,1,.36,1) both}
      @keyframes docPop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
      #doc-chat-head{background:linear-gradient(135deg,#0D9488,#0F766E);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}
      #doc-chat-head .doc-chat-logo{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center}
      #doc-chat-title{flex:1;min-width:0}
      #doc-chat-title b{display:block;font-size:14px}
      #doc-chat-title span{display:block;font-size:11px;opacity:.85}
      #doc-chat-close{background:none;border:none;color:#fff;cursor:pointer;padding:6px;border-radius:8px;display:flex}
      #doc-chat-close:hover{background:rgba(255,255,255,.15)}
      #doc-chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--canvas,#F4F7F6)}
      .doc-msg{max-width:84%;padding:9px 13px;border-radius:16px;font-size:13px;line-height:1.5;white-space:pre-line;animation:docMsg .25s ease both}
      @keyframes docMsg{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .doc-msg.bot{align-self:flex-start;background:var(--bg-card,#fff);border:1px solid var(--border-light,#E5E7EB);border-bottom-left-radius:4px;color:var(--text-primary,#111827)}
      .doc-msg.user{align-self:flex-end;background:#0D9488;color:#fff;border-bottom-right-radius:4px}
      .doc-msg.typing{display:flex;gap:4px;align-items:center;padding:12px 14px}
      .doc-msg.typing i{width:6px;height:6px;border-radius:50%;background:#0D9488;opacity:.5;animation:docDot 1s infinite}
      .doc-msg.typing i:nth-child(2){animation-delay:.15s}
      .doc-msg.typing i:nth-child(3){animation-delay:.3s}
      @keyframes docDot{0%,60%,100%{transform:none;opacity:.4}30%{transform:translateY(-3px);opacity:1}}
      .doc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
      .doc-chip{font-size:11.5px;padding:6px 11px;border-radius:999px;border:1px solid var(--teal,#0D9488);color:var(--teal,#0D9488);background:transparent;cursor:pointer;transition:all .15s}
      .doc-chip:hover{background:var(--teal,#0D9488);color:#fff}
      #doc-chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border-light,#E5E7EB);background:var(--bg-card,#fff)}
      #doc-chat-input input{flex:1;border:1px solid var(--border-light,#E5E7EB);background:var(--bg-input,#fff);color:var(--text-primary,#111827);border-radius:12px;padding:9px 12px;font-size:13px;outline:none}
      #doc-chat-input input:focus{border-color:var(--teal,#0D9488)}
      #doc-chat-send{width:38px;height:38px;border-radius:12px;background:#0D9488;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s}
      #doc-chat-send:disabled{opacity:.4;cursor:default}
      @media (min-width:768px){#doc-chat-btn{bottom:22px}#doc-chat-wrap{bottom:92px}}
      @media (max-width:380px){#doc-chat-wrap{right:8px;left:8px;width:auto}}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildWidget() {
    const wrap = document.createElement('div');
    wrap.id = 'doc-chat-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Doctor on Call assistant chat');
    wrap.innerHTML = `
      <div id="doc-chat-head">
        <div class="doc-chat-logo">${AVATAR_SVG}</div>
        <div id="doc-chat-title"><b>Doctor on Call</b><span class="pulse-dot" style="display:inline-block;width:8px;height:8px;margin-right:4px;vertical-align:-1px"></span><span>Assistant · online now</span></div>
        <button id="doc-chat-close" aria-label="Close chat">${'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}</button>
      </div>
      <div id="doc-chat-msgs"></div>
      <div id="doc-chat-chips" class="doc-chips"></div>
      <div id="doc-chat-input">
        <input id="doc-chat-field" type="text" maxlength="500" placeholder="Ask about bookings, fees, symptoms…" autocomplete="off">
        <button id="doc-chat-send" aria-label="Send message">${SEND_SVG}</button>
      </div>`;
    document.body.appendChild(wrap);

    const btn = document.createElement('button');
    btn.id = 'doc-chat-btn';
    btn.setAttribute('aria-label', 'Open chat assistant');
    btn.innerHTML = CHAT_SVG + '<span class="doc-chat-pulse"></span>';
    document.body.appendChild(btn);
  }

  function openPanel() {
    const wrap = document.getElementById('doc-chat-wrap');
    wrap.classList.add('open');
    document.getElementById('doc-chat-field').focus();
    if (!document.getElementById('doc-chat-msgs').childElementCount) {
      addMsg('bot', "Hi! 👋 I'm the Doctor on Call assistant.\n\nAsk me about booking a doctor, fees & refunds, symptoms, or our location — I'm here 24×7.");
    }
  }

  function addMsg(role, text) {
    const msgs = document.getElementById('doc-chat-msgs');
    const el = document.createElement('div');
    el.className = 'doc-msg ' + role;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function addTyping() {
    const msgs = document.getElementById('doc-chat-msgs');
    const el = document.createElement('div');
    el.className = 'doc-msg bot typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setChips(chips) {
    const box = document.getElementById('doc-chat-chips');
    box.innerHTML = '';
    (chips || []).forEach((c) => {
      const b = document.createElement('button');
      b.className = 'doc-chip';
      b.textContent = c;
      b.addEventListener('click', () => send(c));
      box.appendChild(b);
    });
  }

  let busy = false;
  async function send(text) {
    const field = document.getElementById('doc-chat-field');
    const value = (text || '').trim();
    if (!value || busy) return;
    field.value = '';
    setChips([]);
    addMsg('user', value.slice(0, 500));
    busy = true;
    const typing = addTyping();
    try {
      const res = await Api.post('/chat', { message: value });
      typing.remove();
      addMsg('bot', res.reply);
      setChips(res.suggestions);
    } catch (e) {
      typing.remove();
      addMsg('bot', 'Sorry, I hit a snag. Please try again in a moment 🙏');
    } finally {
      busy = false;
    }
  }

  function init() {
    loadStyles();
    buildWidget();

    document.getElementById('doc-chat-btn').addEventListener('click', () => {
      const wrap = document.getElementById('doc-chat-wrap');
      if (wrap.classList.contains('open')) { wrap.classList.remove('open'); return; }
      openPanel();
    });
    document.getElementById('doc-chat-close').addEventListener('click', () => {
      document.getElementById('doc-chat-wrap').classList.remove('open');
    });
    document.getElementById('doc-chat-send').addEventListener('click', () => send(document.getElementById('doc-chat-field').value));
    document.getElementById('doc-chat-field').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send(e.target.value);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();