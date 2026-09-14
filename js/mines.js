try {
  const grid = document.getElementById('dig-grid');
  const digStart = document.getElementById('dig-start');
  const digMsg = document.getElementById('dig-msg');
  const betRow = document.getElementById('bet-row');
  const MINES_BETS = [50, 100, 250, 500];
  let minesBet = 100;
  let minesRound = null;
  let minesBusy = false;

  function minesSession() {
    try { return JSON.parse(localStorage.getItem('cc_session') || 'null'); } catch { return null; }
  }
  function getCredits() {
    const n = Number(localStorage.getItem('cc_credits'));
    return Number.isFinite(n) ? n : 500;
  }
  function setCredits(n) {
    localStorage.setItem('cc_credits', String(Math.max(0, Math.floor(n))));
  }

  function minesStats(txt) {
    const el = document.getElementById('dig-stats');
    if (el) el.innerHTML = txt || '';
  }

  function renderBets() {
    betRow.innerHTML = MINES_BETS.map((b) =>
      `<button data-b="${b}" class="${b === minesBet ? 'on' : ''}">${b}</button>`).join('');
    betRow.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (minesRound && minesRound.state === 'ready') return;
      minesBet = Number(b.dataset.b);
      digStart.textContent = 'DIG FOR ' + minesBet;
      renderBets();
    }));
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = '';
    const active = minesRound && minesRound.state === 'ready';
    grid.classList.toggle('locked', !active);
    const opened = new Set(minesRound ? minesRound.opened : []);
    const ended = minesRound && minesRound.state !== 'ready';
    const bombs = new Set(ended && minesRound.bombs ? minesRound.bombs : []);
    const diamond = minesRound ? minesRound.diamond : null;
    const img = (src) => `<img class="dig-img" src="${src}" alt="">`;
    for (let i = 0; i < 25; i++) {
      const c = document.createElement('div');
      c.className = 'dig-cell';
      if (bombs.has(i)) {
        c.classList.add(i === minesRound.hit ? 'boom' : 'opened');
        c.innerHTML = img('icons/tnt.png');
      } else if (diamond === i && (minesRound.state === 'won' || minesRound.state === 'paying' || minesRound.state === 'lost')) {
        c.classList.add('diamond');
        c.innerHTML = img('icons/almaz.png');
      } else if (opened.has(i)) {
        c.classList.add('opened');
      } else {
        c.innerHTML = img('icons/badrock.png');
        if (active) c.addEventListener('click', () => minesDig(i));
      }
      grid.appendChild(c);
    }
  }

  async function minesApi(path, body) {
    const r = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, code: r.status, data: await r.json().catch(() => ({})) };
  }

  function localStart(bet) {
    const cells = Array.from({ length: 25 }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const bombs = cells.slice(0, 4);
    const diamond = cells[4];
    const balance = getCredits() - bet;
    setCredits(balance);
    return { id: 'local-' + Date.now(), state: 'ready', bet, bombs, diamond, opened: [], balance, local: true };
  }

  async function minesStart() {
    const s = minesSession();
    if (!s || !s.nick) {
      digMsg.innerHTML = '<span class="lose">connect wallet up top to play for credits</span>';
      return;
    }
    if (minesBusy) return;
    if (getCredits() < minesBet) {
      digMsg.innerHTML = '<span class="lose">not enough credits</span>';
      return;
    }
    minesBusy = true;
    digStart.disabled = true;
    digMsg.textContent = 'placing bet…';
    try {
      let resp = await minesApi('/api/casino/start', { nick: s.nick, password: s.password, bet: minesBet });
      if (resp.code === 409 && resp.data.round) { minesRound = resp.data.round; }
      else if (!resp.ok) throw new Error(resp.data.error || 'failed');
      else minesRound = resp.data;
      for (let i = 0; i < 20 && minesRound.state === 'placing'; i++) {
        await new Promise((ok) => setTimeout(ok, 700));
        const st = await fetch('/api/casino/state?id=' + minesRound.id, { cache: 'no-store' });
        if (st.ok) minesRound = await st.json();
      }
    } catch {
      minesRound = localStart(minesBet);
    }
    minesBusy = false;
    if (minesRound.state === 'rejected') {
      digMsg.innerHTML = '<span class="lose">' + (minesRound.error || 'bet rejected') + '</span>';
      minesRound = null; digStart.disabled = false; renderGrid();
      return;
    }
    if (minesRound.state !== 'ready') {
      digMsg.innerHTML = '<span class="lose">server is slow — try again</span>';
      minesRound = null; digStart.disabled = false; renderGrid();
      return;
    }
    digMsg.textContent = 'bet placed — dig!';
    if (typeof minesRound.balance === 'number')
      minesStats('credits: <b>' + minesRound.balance.toFixed(0) + '</b>');
    renderGrid();
  }

  async function minesDig(i) {
    if (!minesRound || minesRound.state !== 'ready' || minesBusy) return;
    minesBusy = true;
    if (minesRound.local) {
      minesRound.opened.push(i);
      minesRound.hit = i;
      if (minesRound.bombs.includes(i)) {
        minesRound.state = 'lost';
      } else if (minesRound.diamond === i) {
        minesRound.state = 'won';
        minesRound.balance = getCredits() + minesRound.bet * 2;
        setCredits(minesRound.balance);
      }
      minesBusy = false;
    } else {
      const resp = await minesApi('/api/casino/dig', { id: minesRound.id, cell: i });
      minesBusy = false;
      if (!resp.ok) { digMsg.textContent = resp.data.error || 'dig failed'; return; }
      minesRound = resp.data;
    }
    renderGrid();
    if (minesRound.state === 'lost') {
      digMsg.innerHTML = '<span class="lose">💥 BOOM — ' + minesRound.bet + ' credits gone</span>';
      digStart.disabled = false;
      minesRound = null;
    } else if (minesRound.state === 'paying' || minesRound.state === 'won') {
      digMsg.innerHTML = '<span class="win">💎 DIAMOND! +' + (minesRound.bet * 2) + ' credits incoming…</span>';
      if (!minesRound.local) {
        for (let k = 0; k < 20 && minesRound.state === 'paying'; k++) {
          await new Promise((ok) => setTimeout(ok, 700));
          const st = await fetch('/api/casino/state?id=' + minesRound.id, { cache: 'no-store' });
          if (st.ok) minesRound = await st.json();
        }
      }
      if (typeof minesRound.balance === 'number')
        minesStats('credits: <b>' + minesRound.balance.toFixed(0) + '</b>');
      digMsg.innerHTML = '<span class="win">💎 paid: +' + (minesRound.bet * 2) + ' credits</span>';
      digStart.disabled = false;
      minesRound = null;
    } else {
      minesStats('credits: <b>' + getCredits() + '</b> · keep digging');
    }
  }

  if (grid) {
    renderBets();
    renderGrid();
    digStart.disabled = false;
    digStart.textContent = 'DIG FOR ' + minesBet;
    digStart.addEventListener('click', minesStart);
    minesStats(minesSession() ? 'credits: <b>' + getCredits() + '</b>' : 'connect wallet to play');
  }

  const blVid = document.getElementById('blocklom');
  const blBox = document.getElementById('clickbox');
  const blCount = document.getElementById('click-count');
  if (blVid && blBox && blCount) {
    let mined = +(localStorage.getItem('cc_blocklom') || 0);
    blCount.textContent = mined;
    const bcv = document.getElementById('blockcanvas');
    const bctx = bcv && bcv.getContext('2d');
    function drawBlock() {
      if (!bctx) return;
      const w = blVid.videoWidth || 300, h = blVid.videoHeight || 300;
      if (bcv.width !== w) { bcv.width = w; bcv.height = h; }
      bctx.clearRect(0, 0, w, h);
      try { bctx.drawImage(blVid, 0, 0, w, h); } catch (e) { return; }
      let img;
      try { img = bctx.getImageData(0, 0, w, h); } catch (e) { return; }
      const d = img.data, LO = 18, HI = 46;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (L <= LO) d[i + 3] = 0;
        else if (L < HI) d[i + 3] = ((L - LO) / (HI - LO)) * 255;
      }
      bctx.putImageData(img, 0, 0);
    }
    let blRaf = 0;
    function blockLoop() { drawBlock(); if (!blVid.paused && !blVid.ended) blRaf = requestAnimationFrame(blockLoop); }
    blVid.addEventListener('play', () => { cancelAnimationFrame(blRaf); blockLoop(); });
    blVid.addEventListener('seeked', drawBlock);
    blVid.addEventListener('loadeddata', drawBlock);
    if (blVid.readyState >= 2) drawBlock();
    blVid.addEventListener('ended', () => { blVid.currentTime = 0; blVid.pause(); drawBlock(); });
    blBox.addEventListener('click', () => {
      blVid.currentTime = 0;
      blVid.play().catch(() => {});
      mined++;
      blCount.textContent = mined;
      localStorage.setItem('cc_blocklom', mined);
    });
  }
} catch (e) { console.log('landing extras error', e); }
