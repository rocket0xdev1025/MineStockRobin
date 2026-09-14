const ORES = [
  { id: 'COAL', name: 'CoalCorp', base: 0.30, vol: 0.035 },
  { id: 'REDST', name: 'RedSignal', base: 5.80, vol: 0.028 },
  { id: 'LAPIS', name: 'Lapis Ledger', base: 2.15, vol: 0.032 },
  { id: 'CU', name: 'Copper United', base: 1.52, vol: 0.022 },
  { id: 'IRON', name: 'Iron Industries', base: 2.90, vol: 0.030 },
  { id: 'GOLD', name: 'GoldChain', base: 12.4, vol: 0.026 },
  { id: 'DMND', name: 'Diamond Hands', base: 96, vol: 0.018 },
  { id: 'EMRLD', name: 'Emerald DAO', base: 228, vol: 0.016 },
];

const NEWS_UP = [
  'Influencer shills {name} on MeseTube! ${id} +{pct}%',
  'WHALE ALERT: fund accumulates {name}! ${id} +{pct}%',
  'Short squeeze on {name}! ${id} +{pct}%',
  '{name} wins a state contract! ${id} +{pct}%',
];
const NEWS_DOWN = [
  'SEC of the Overworld probes {name}! ${id} -{pct}%',
  'MINE COLLAPSE at {name} facilities! ${id} -{pct}%',
  'Whale dumps {name} bags! ${id} -{pct}%',
  'RUG RUMOR around {name}! ${id} -{pct}%',
];

function fmtN(n) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1);
}

function sparkline(canvas, hist, up) {
  const w = 72, h = 20, dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const min = Math.min(...hist), max = Math.max(...hist);
  const span = (max - min) || 1;
  ctx.beginPath();
  hist.forEach((v, i) => {
    const x = (i / (hist.length - 1 || 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = up ? '#7fb23a' : '#d9524a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

const DemoMarket = {
  tickers: ORES.map((o) => {
    const hist = [];
    let p = o.base;
    for (let i = 0; i < 40; i++) {
      p = Math.max(o.base * 0.25, p * (1 + (Math.random() - 0.48) * o.vol));
      hist.push(p);
    }
    return { ...o, price: p, hist, dir: '=', pct: 0 };
  }),
  news: [],
  rich: [
    { name: 'Coos', nw: 2823 }, { name: 'Artic', nw: 1885 }, { name: 'jack779', nw: 562 },
    { name: 'prout', nw: 532 }, { name: 'zezzie', nw: 521 }, { name: 'Rodecon', nw: 508 },
    { name: 'Hypixel', nw: 505 }, { name: 'rotator', nw: 502 }, { name: 'fishy', nw: 500 },
    { name: 'Mrazi', nw: 500 },
  ],
  online: 14 + Math.floor(Math.random() * 9),
  tick() {
    this.tickers.forEach((t) => {
      const prev = t.price;
      const shock = Math.random() < 0.08 ? (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.28) : 0;
      t.price = Math.max(t.base * 0.2, t.price * (1 + (Math.random() - 0.49) * t.vol + shock));
      t.hist.push(t.price);
      if (t.hist.length > 40) t.hist.shift();
      const first = t.hist[0];
      const chg = (t.price / first - 1) * 100;
      t.pct = Math.abs(chg);
      t.dir = t.price > prev * 1.002 ? '+' : (t.price < prev * 0.998 ? '-' : '=');
      if (Math.abs(shock) > 0.1) {
        const up = shock > 0;
        const tpl = (up ? NEWS_UP : NEWS_DOWN)[Math.floor(Math.random() * 4)];
        const pct = Math.round(Math.abs(shock) * 100);
        this.news.push({
          t: Date.now() / 1000,
          up,
          text: tpl.replace('{name}', t.name).replace('{id}', t.id).replace('{pct}', pct),
        });
        if (this.news.length > 20) this.news.shift();
      }
    });
    this.online = Math.max(8, this.online + Math.floor(Math.random() * 3) - 1);
    return this.snapshot();
  },
  snapshot() {
    return {
      online: this.online,
      news: this.news.slice(),
      rich: this.rich.slice(),
      tickers: this.tickers.map((t) => ({
        id: t.id, name: t.name, price: t.price, hist: t.hist.slice(), dir: t.dir, pct: t.pct,
      })),
    };
  },
};

let lastMarket = null;
let lastTapeUpdate = 0;
let tickerSel = 'EMRLD';
let usingLiveFeed = false;

function updateTape(m) {
  const now = Date.now();
  if (now - lastTapeUpdate < 60000) return;
  lastTapeUpdate = now;
  const inner = document.querySelector('.tape-inner');
  if (!inner) return;
  const prices = m.tickers.map((t) =>
    `<span>$${t.id} ${fmtN(t.price)} ${t.dir === '-' ? '▼' : '▲'}</span><span>·</span>`).join('');
  inner.dataset.base = prices +
    '<span>THE MINE IS THE MARKET</span><span>·</span><span>MINE TO CRASH · BUY TO PUMP</span><span>·</span>' +
    '<span>500 CREDITS ON SPAWN</span><span>·</span>';
  if (typeof initTapes === 'function') initTapes();
}

function paintMarket(m) {
  lastMarket = m;
  const _mm = document.getElementById('mkt-meta');
  if (_mm) _mm.textContent = `${m.online} ONLINE` + (usingLiveFeed ? '' : ' · DEMO');
  const _so = document.getElementById('stat-online');
  if (_so) _so.textContent = m.online;

  const rows = m.tickers.map((t) => {
    const cls = t.dir === '+' ? 'up' : (t.dir === '-' ? 'down' : '');
    const arrow = t.dir === '+' ? '▲' : (t.dir === '-' ? '▼' : '—');
    const real = t.real
      ? `<span class="real">${t.real}${t.realPrice ? ' $' + fmtN(t.realPrice) : ''}` +
        `${typeof t.realDay === 'number' ? ` <span class="${t.realDay >= 0 ? 'up' : 'down'}">` +
        `${t.realDay >= 0 ? '+' : ''}${t.realDay.toFixed(1)}%</span>` : ''}</span>`
      : '';
    return `<tr><td class="tick">$${t.id}</td><td class="co">${real || t.name}</td>` +
      `<td>${fmtN(t.price)}</td><td class="${cls}">${arrow} ${t.pct.toFixed(1)}%</td>` +
      `<td><canvas data-id="${t.id}"></canvas></td></tr>`;
  }).join('');
  document.getElementById('mkt-body').innerHTML = `<table class="mkt">${rows}</table>`;
  m.tickers.forEach((t) => {
    const c = document.querySelector(`canvas[data-id="${t.id}"]`);
    if (c && t.hist && t.hist.length > 1) sparkline(c, t.hist, t.dir !== '-');
  });

  const newsItems = (m.news || []).slice(-4).reverse().map((n) =>
    `<div class="${n.up ? 'up' : 'down'}">${n.up ? '▲' : '▼'} ${n.text}</div>`).join('');
  document.getElementById('mkt-news').innerHTML = newsItems;

  const rich = (m.rich || []).slice(0, 5).map((r, i) =>
    `${i + 1}. <b>${r.name}</b> ${fmtN(r.nw)}`).join(' &nbsp;•&nbsp; ');
  document.getElementById('mkt-rich').innerHTML = rich ? '🏆 ' + rich : '';

  updateTape(m);
  renderTicker(m);
}

function renderTicker(m) {
  const cv = document.getElementById('tchart');
  if (!cv || !m || !m.tickers) return;
  const ids = m.tickers.map((t) => t.id);
  if (!ids.includes(tickerSel)) tickerSel = ids[0];

  const tt = document.getElementById('tticks');
  if (tt) {
    tt.innerHTML = m.tickers.map((t) =>
      `<button data-t="${t.id}" class="${t.id === tickerSel ? 'on' : ''}">$${t.id}</button>`).join('');
    tt.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { tickerSel = b.dataset.t; renderTicker(lastMarket); }));
  }

  const t = m.tickers.find((x) => x.id === tickerSel);
  if (!t || !t.hist || t.hist.length < 2) return;
  const hist = t.hist;

  const first = hist[0], last = hist[hist.length - 1];
  const up = last >= first;
  const pEl = document.getElementById('tp'), chgEl = document.getElementById('tchg');
  if (pEl) {
    pEl.textContent = '$' + tickerSel + ' ' + fmtN(last) + (t.real ? '  (' + t.real + ')' : '');
    pEl.className = 'tp ' + (up ? 'up' : 'down');
  }
  if (chgEl) {
    const chg = (last / first - 1) * 100;
    chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
    chgEl.className = 'tchg ' + (up ? 'up' : 'down');
  }
  const moodEl = document.getElementById('tmood');
  if (moodEl) moodEl.textContent = up ? '(⛏^-^) DIG IT' : '(💎°-°) BUY THE DIP';

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#241a12'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#33251a';
  for (let g = 0; g < H; g += 16) ctx.fillRect(0, g, W, 1);
  const candles = [];
  for (let i = 1; i < hist.length; i++) {
    const o = hist[i - 1], c = hist[i];
    candles.push({ o, c, h: Math.max(o, c) * 1.004, l: Math.min(o, c) * 0.996 });
  }
  let hi = -1e9, lo = 1e9;
  candles.forEach((c) => { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
  const pad = (hi - lo) * 0.15 || hi * 0.1; hi += pad; lo -= pad;
  const n = candles.length, cw = Math.floor(W / n), bw = Math.max(2, cw - 2);
  const Y = (v) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  candles.forEach((c, i) => {
    const x = i * cw, cUp = c.c >= c.o, col = cUp ? '#7fb23a' : '#d9524a';
    ctx.fillStyle = col;
    ctx.fillRect(x + Math.floor(bw / 2), Math.round(Y(c.h)), 1, Math.round(Y(c.l) - Y(c.h)) || 1);
    const yo = Y(c.o), yc = Y(c.c), top = Math.min(yo, yc), hgt = Math.max(2, Math.abs(yc - yo));
    ctx.fillStyle = '#3d2a20'; ctx.fillRect(x - 1, top - 1, bw + 2, hgt + 2);
    ctx.fillStyle = col; ctx.fillRect(x, top, bw, hgt);
  });
  ctx.fillStyle = 'rgba(255,210,63,.5)';
  const ly = Y(last);
  for (let lx = 0; lx < W; lx += 6) ctx.fillRect(lx, Math.round(ly), 3, 1);
}

async function pollMarket() {
  if (!document.getElementById('mkt-card')) return;
  try {
    const res = await fetch('/api/market.json', { cache: 'no-store' });
    if (!res.ok) throw 0;
    usingLiveFeed = true;
    paintMarket(await res.json());
  } catch {
    usingLiveFeed = false;
    paintMarket(DemoMarket.tick());
  }
}

pollMarket();
setInterval(pollMarket, 7000);

setInterval(() => {
  const clk = document.getElementById('tclock');
  if (!clk) return;
  const d = new Date();
  clk.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((x) => ('' + x).padStart(2, '0')).join(':');
}, 1000);
