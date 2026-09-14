const btn = document.getElementById('play');
const status = document.getElementById('status');
const connectBtn = document.getElementById('connect');
const badge = document.getElementById('wallet-badge');

let session = null;
let lastEvmAddress = null;
try { session = JSON.parse(localStorage.getItem('cc_session') || 'null'); } catch {}
let engineReady = false;
let pendingNick = null;

function handleAuthResult(d, sourceLabel) {
  if (d.needNick) {
    pendingNick = d;
    const input = document.getElementById('nc-nick');
    input.value = '';
    input.placeholder = `choose your nick (suggested: ${d.suggested})`;
    status.innerHTML = `${sourceLabel} verified — now claim your nick (permanent!)`;
    renderAuth();
    document.getElementById('nick-claim').style.display = 'flex';
    input.focus();
    return;
  }
  session = d;
  if (!session.address && lastEvmAddress) session.address = lastEvmAddress;
  pendingNick = null;
  localStorage.setItem('cc_session', JSON.stringify(session));
  if (localStorage.getItem('cc_credits') == null) localStorage.setItem('cc_credits', '500');
  status.innerHTML = `${sourceLabel} linked — playing as <b>${session.nick}</b>`;
  renderAuth();
}

async function claimNick() {
  if (!pendingNick) return;
  const nick = document.getElementById('nc-nick').value.trim() || pendingNick.suggested;
  try {
    const r = await fetch('/api/auth/nick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: pendingNick.ticket, nick }),
    });
    const d = await r.json();
    if (r.ok && d.nick) {
      document.getElementById('nick-claim').style.display = 'none';
      handleAuthResult(d, 'nick');
      return;
    }
    status.textContent = 'nick: ' + (d.error || 'claim failed');
  } catch {
    document.getElementById('nick-claim').style.display = 'none';
    handleAuthResult({ nick, password: 'local', address: lastEvmAddress || null }, 'nick');
  }
}

function shortAddr(a) { return a.slice(0, 4) + '…' + a.slice(-4); }

function renderAuth() {
  const altRow = document.querySelector('.alt-login');
  if (session) {
    connectBtn.style.display = 'none';
    badge.style.display = 'flex';
    document.getElementById('wb-nick').textContent = session.nick;
    document.getElementById('wb-addr').textContent =
      session.address ? shortAddr(session.address) : (session.email || 'local save');
    if (altRow) altRow.style.display = 'none';
  } else if (pendingNick) {
    connectBtn.style.display = 'none';
    badge.style.display = 'none';
    if (altRow) altRow.style.display = 'none';
  } else {
    connectBtn.style.display = '';
    badge.style.display = 'none';
    if (altRow) altRow.style.display = '';
    document.getElementById('nick-claim').style.display = 'none';
  }
  updatePlayButton();
  renderCashout();
}

const CASHOUT_ENABLED = true;
const cashoutRow = document.getElementById('cashout-row');
const cashoutControls = document.getElementById('cashout-controls');
const cashoutBtn = document.getElementById('cashout-btn');
const cashoutStatus = document.getElementById('cashout-status');
const cashoutLabel = document.getElementById('cashout-label');
const cashoutBalanceEl = document.getElementById('cashout-balance');
const cashoutBalanceVal = document.getElementById('cashout-balance-val');
let cashoutTier = null;

function cashoutAddress() {
  return (session && session.address)
    || (window.__minestockPrivy && window.__minestockPrivy.address) || null;
}
function fmtCredits(n) { return Math.floor(Number(n) || 0).toLocaleString('en-US'); }
function paintBalance() {
  if (!cashoutBalanceEl || !cashoutBalanceVal) return;
  const b = cashoutTier ? cashoutTier.balance : Number(localStorage.getItem('cc_credits'));
  if (b == null || Number.isNaN(b)) { cashoutBalanceEl.style.display = 'none'; return; }
  cashoutBalanceEl.style.display = 'block';
  let txt = fmtCredits(b) + ' credits';
  if (CASHOUT_ENABLED && cashoutTier && cashoutTier.credits && b < cashoutTier.credits) {
    txt += ' · need ' + fmtCredits(cashoutTier.credits - b) + ' more for $' + cashoutTier.usd;
  }
  cashoutBalanceVal.textContent = txt;
}

let cashoutCdEnd = 0;
let cashoutCdTick = null;
function fmtDur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (h > 0) return h + 'h ' + m + 'm ' + ss + 's';
  if (m > 0) return m + 'm ' + ss + 's';
  return ss + 's';
}
function stopCd() { if (cashoutCdTick) { clearInterval(cashoutCdTick); cashoutCdTick = null; } cashoutCdEnd = 0; }
function tickCd() {
  const rem = cashoutCdEnd - Date.now();
  if (rem <= 0) {
    stopCd();
    if (cashoutTier) cashoutTier.cooldownMs = 0;
    cashoutBtn.disabled = false;
    cashoutStatus.style.color = 'var(--green)';
    cashoutStatus.textContent = 'ready — cash out $' + (cashoutTier ? cashoutTier.usd : '');
    return;
  }
  cashoutBtn.disabled = true;
  cashoutStatus.style.color = 'var(--muted)';
  cashoutStatus.textContent = '⏳ next cash-out in ' + fmtDur(rem);
}
function startCd(ms, writeDelayMs) {
  stopCd();
  cashoutCdEnd = Date.now() + ms;
  cashoutBtn.disabled = true;
  const begin = () => { if (cashoutCdEnd && Date.now() < cashoutCdEnd) { tickCd(); cashoutCdTick = setInterval(tickCd, 1000); } };
  if (writeDelayMs) setTimeout(begin, writeDelayMs); else begin();
}
function paintCashout(silent) {
  if (!cashoutTier || !cashoutLabel) return;
  if (!CASHOUT_ENABLED) { paintBalance(); return; }
  cashoutLabel.textContent = cashoutTier.credits + ' credits → $' + cashoutTier.usd;
  cashoutBtn.textContent = 'CASH OUT $' + cashoutTier.usd;
  paintBalance();
  if (cashoutTier.cooldownMs > 0) startCd(cashoutTier.cooldownMs, silent ? 6000 : 0);
  else { stopCd(); cashoutBtn.disabled = false; }
}
async function loadCashoutTier(silent) {
  if (!session || !session.nick || !session.password) return;
  try {
    const r = await fetch('/api/cashout/tier', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: session.nick, password: session.password }),
    });
    if (!r.ok) throw 0;
    cashoutTier = await r.json();
    paintCashout(silent);
  } catch {
    const bal = Number(localStorage.getItem('cc_credits') || 500);
    cashoutTier = { level: 1, credits: 500, usd: 4, cooldownMs: 0, balance: bal };
    paintCashout(silent);
  }
}
async function refreshBalance() {
  if (!session || !session.nick || !session.password) return;
  try {
    const r = await fetch('/api/cashout/tier', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: session.nick, password: session.password }),
    });
    if (!r.ok) throw 0;
    const d = await r.json();
    if (cashoutTier) cashoutTier.balance = d.balance; else cashoutTier = d;
    paintBalance();
  } catch {
    if (cashoutTier) cashoutTier.balance = Number(localStorage.getItem('cc_credits') || 500);
    paintBalance();
  }
}
let cashoutBalPoll = null;
function startBalancePoll() { stopBalancePoll(); cashoutBalPoll = setInterval(refreshBalance, 12000); }
function stopBalancePoll() { if (cashoutBalPoll) { clearInterval(cashoutBalPoll); cashoutBalPoll = null; } }
function renderCashout() {
  if (!cashoutRow) return;
  const show = !!(session);
  cashoutRow.style.display = show ? 'block' : 'none';
  if (cashoutControls) cashoutControls.style.display = CASHOUT_ENABLED ? 'flex' : 'none';
  if (cashoutStatus) cashoutStatus.style.display = CASHOUT_ENABLED ? 'block' : 'none';
  if (show) { loadCashoutTier(); startBalancePoll(); }
  else { stopCd(); stopBalancePoll(); }
}
async function doCashout() {
  if (!CASHOUT_ENABLED) return;
  const addr = cashoutAddress();
  if (!session || !addr) {
    cashoutStatus.textContent = 'connect an EVM wallet to cash out (this static fork has no payouts)';
    return;
  }
  cashoutBtn.disabled = true;
  cashoutStatus.style.color = 'var(--muted)';
  cashoutStatus.textContent = 'requesting…';
  try {
    const r = await fetch('/api/cashout/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: session.nick, password: session.password, address: addr }),
    });
    const d = await r.json();
    if (!r.ok) {
      cashoutStatus.style.color = 'var(--coral)';
      cashoutStatus.textContent = '✖ ' + (d.error || 'cash-out failed');
      cashoutBtn.disabled = false;
      return;
    }
    const id = d.id;
    const done = (ok, msg) => {
      cashoutStatus.style.color = ok ? 'var(--green)' : 'var(--coral)';
      cashoutStatus.innerHTML = (ok ? '✔ ' : '✖ ') + msg;
      cashoutBtn.disabled = false;
      loadCashoutTier(true);
    };
    const poll = async () => {
      try {
        const sr = await fetch('/api/cashout/state?id=' + encodeURIComponent(id));
        const s = await sr.json();
        if (s.state === 'burning') { cashoutStatus.textContent = 'burning ' + d.credits + ' credits…'; setTimeout(poll, 1500); }
        else if (s.state === 'paying') { cashoutStatus.textContent = 'sending $' + (s.usd || d.usd) + ' to your wallet…'; setTimeout(poll, 2500); }
        else if (s.state === 'paid') { done(true, 'paid $' + (s.usd || d.usd) + (s.ethTx ? ' — tx ' + String(s.ethTx).slice(0, 12) + '…' : '')); }
        else if (s.state === 'rejected') { done(false, s.error || ('need ' + d.credits + ' credits')); }
        else if (s.state === 'failed') { done(false, 'payment failed (credits refunded): ' + (s.error || '')); }
        else { setTimeout(poll, 2000); }
      } catch { setTimeout(poll, 2500); }
    };
    poll();
  } catch (err) {
    cashoutStatus.style.color = 'var(--coral)';
    cashoutStatus.textContent = '✖ static fork — no cash-out server';
    cashoutBtn.disabled = false;
  }
}
if (cashoutBtn) cashoutBtn.addEventListener('click', doCashout);

function updatePlayButton() {
  if (!session) {
    btn.disabled = true;
    btn.textContent = pendingNick ? 'CLAIM YOUR NICK' : 'CONNECT WALLET TO PLAY';
  } else if (typeof LuantiLauncher === 'undefined') {
    btn.disabled = true;
    btn.textContent = 'PREVIEW ONLY';
  } else if (!engineReady) {
    btn.disabled = true; btn.textContent = 'LOADING…';
  } else {
    btn.disabled = false; btn.textContent = 'ENTER THE MINE';
  }
}

let privyLoading = false, wantLogin = false;
function loadPrivy() {
  if (window.__minestockPrivy || privyLoading) return;
  privyLoading = true;
  const s = document.createElement('script');
  s.src = '/privy-widget.js?v=evm2';
  s.async = true;
  s.onerror = () => {
    privyLoading = false; wantLogin = false;
    spawnLocalGuest();
  };
  document.head.appendChild(s);
}
function spawnLocalGuest() {
  const existing = session && session.nick;
  const nick = existing || ('Miner' + Math.floor(100 + Math.random() * 900));
  connectBtn.textContent = 'CONNECT WALLET';
  handleAuthResult({ nick, password: 'local', address: null }, 'local save');
  status.innerHTML = `local save — playing as <b>${nick}</b> (no live wallet server)`;
}
window.addEventListener('minestock-privy-ready', (e) => {
  if (e.detail && e.detail.ready && wantLogin) {
    wantLogin = false;
    connectBtn.textContent = 'CONNECT WALLET';
    window.__minestockPrivy.login();
  }
});
window.addEventListener('minestock-privy-auth', async (e) => {
  const token = e.detail && e.detail.token;
  if (e.detail && e.detail.address) lastEvmAddress = e.detail.address;
  if (!token) { status.textContent = 'login failed (no token)'; return; }
  try {
    const r = await fetch('/api/auth/privy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const creds = await r.json();
    if (!r.ok || (!creds.nick && !creds.needNick)) throw new Error(creds.error || 'login failed');
    handleAuthResult(creds, 'wallet');
  } catch (err) {
    spawnLocalGuest();
    status.innerHTML = `wallet server offline — local save as <b>${session.nick}</b>`;
  }
});
function connectWallet() {
  warmEngine();
  if (window.__minestockPrivy && window.__minestockPrivy.ready) {
    window.__minestockPrivy.login();
    return;
  }
  wantLogin = true;
  connectBtn.textContent = 'LOADING…';
  loadPrivy();
  setTimeout(() => {
    if (!session && !window.__minestockPrivy) spawnLocalGuest();
  }, 1800);
}

connectBtn.addEventListener('click', connectWallet);
document.getElementById('disconnect').addEventListener('click', () => {
  session = null;
  localStorage.removeItem('cc_session');
  if (window.__minestockPrivy) window.__minestockPrivy.logout();
  renderAuth();
  status.textContent = 'wallet disconnected — connect to play';
});

const emailAuth = document.getElementById('email-auth');
document.getElementById('email-toggle').addEventListener('click', (e) => {
  e.preventDefault();
  emailAuth.style.display = emailAuth.style.display === 'none' ? 'flex' : 'none';
});

document.getElementById('em-send').addEventListener('click', async () => {
  const email = document.getElementById('em-email').value.trim();
  try {
    const r = await fetch('/api/privy-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', email }),
    });
    const d = await r.json();
    if (r.ok) {
      document.getElementById('em-code-row').style.display = 'flex';
      status.textContent = 'code sent — check your inbox';
    } else {
      throw new Error(d.error || 'send failed');
    }
  } catch {
    document.getElementById('em-code-row').style.display = 'flex';
    status.textContent = 'no mail server — enter any 6 digits to continue locally';
  }
});

document.getElementById('em-verify').addEventListener('click', async () => {
  const email = document.getElementById('em-email').value.trim();
  const code = document.getElementById('em-code').value.trim();
  try {
    const r = await fetch('/api/privy-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', email, code }),
    });
    const d = await r.json();
    if (r.ok && (d.nick || d.needNick)) {
      emailAuth.style.display = 'none';
      handleAuthResult(d, 'email');
      return;
    }
    throw new Error(d.error || 'invalid code');
  } catch {
    if (code.length < 4) { status.textContent = 'email login: enter a code'; return; }
    emailAuth.style.display = 'none';
    const nick = (email.split('@')[0] || 'miner').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
    handleAuthResult({ nick: nick || 'miner', password: 'local', email, address: null }, 'email');
  }
});

document.getElementById('nc-claim').addEventListener('click', claimNick);
document.getElementById('nc-nick').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') claimNick();
});

function goHome() {
  window.__ccHomeReload = true;
  location.reload();
}

let wasInGame = false;
setInterval(() => {
  const t = document.title;
  if (/\[(Multiplayer|Singleplayer)\]/i.test(t)) wasInGame = true;
  if (wasInGame && /Main Menu/i.test(t)) { goHome(); return; }
  if (/minetest|luanti/i.test(t)) document.title = 'MINESTOCK';
}, 1200);

const WS_PROXY = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/proxy';
self.proxyUrl = WS_PROXY;

let launcher = null, launcherWarming = false;
function warmEngine() {
  if (launcher || launcherWarming) return;
  if (typeof LuantiLauncher === 'undefined') {
    status.textContent = 'game engine not served here — this is a layout preview';
    updatePlayButton();
    return;
  }
  launcherWarming = true;
  launcher = new LuantiLauncher();
  launcher.setProxy(WS_PROXY);
  launcher.setLang('en');
  launcher.setConf('viewing_range', 60);
  launcher.setConf('client_mapblock_limit', 800);
  launcher.setConf('enable_shaders', 'false');
  launcher.setConf('keymap_inventory', 'KEY_KEY_E');
  launcher.setConf('keymap_aux1', 'KEY_LCONTROL');

  launcher.onprogress = (name, pct) => {
    if (pct < 1) status.innerHTML = `loading <b>${name}</b> — ${(pct * 100).toFixed(0)}%`;
  };
  launcher.onerror = (msg) => { status.innerHTML = `error: ${msg}`; };
  launcher.onprint = (text) => {
    if (/main\(\) exited/.test(text)) setTimeout(goHome, 800);
  };
  launcher.onready = () => {
    engineReady = true;
    updatePlayButton();
    status.innerHTML = session
      ? `engine ready — playing as <b>${session.nick}</b>`
      : 'engine ready — connect your wallet to play';
  };
}
btn.addEventListener('mouseenter', warmEngine);
btn.addEventListener('focus', warmEngine);

btn.addEventListener('click', () => {
  if (!session || !launcher) return;
  const args = new LuantiArgs();
  args.go = true;
  args.name = session.nick;
  args.password = session.password;
  args.address = '10.20.30.40';
  args.port = 30000;
  launcher.launch(args);
});

if (typeof LuantiLauncher === 'undefined') {
  status.textContent = 'booting local preview… connect for a save file';
}
renderAuth();
