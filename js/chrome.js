document.querySelectorAll('.meter').forEach(function (m) {
  var on = +m.dataset.on, hot = m.dataset.hot;
  for (var i = 0; i < 10; i++) {
    var seg = document.createElement('i');
    if (i < on) seg.className = hot ? 'on hot' : 'on';
    m.appendChild(seg);
  }
});

(function () {
  var specs = document.querySelector('.specs');
  if (!specs) return;
  specs.querySelectorAll('.meter i.on').forEach(function (s) { s.classList.add('pending'); });
  function roll(el, tg, suf, dur) {
    var iv = setInterval(function () {
      el.textContent = Math.floor(Math.random() * (tg >= 1000 ? 9999 : 100)) + suf;
    }, 55);
    setTimeout(function () {
      clearInterval(iv);
      el.textContent = tg + suf;
      el.classList.add('lock');
      setTimeout(function () { el.classList.remove('lock'); }, 340);
    }, dur);
  }
  function scram(el, fin, dur) {
    var C = 'ABCDEFGHKMNPRSTUVXYZ#@%';
    var iv = setInterval(function () {
      el.textContent = fin.replace(/[^ ]/g, function () { return C[Math.floor(Math.random() * C.length)]; });
    }, 55);
    setTimeout(function () {
      clearInterval(iv);
      el.textContent = fin;
      el.classList.add('lock');
      setTimeout(function () { el.classList.remove('lock'); }, 340);
    }, dur);
  }
  function run() {
    var rows = specs.querySelectorAll('.spec');
    rows.forEach(function (row, ri) {
      var segs = row.querySelectorAll('.meter i.on'), v = row.querySelector('.v');
      var rd = ri * 190;
      segs.forEach(function (s, k) {
        setTimeout(function () { s.classList.remove('pending'); s.classList.add('lit'); }, rd + k * 55);
      });
      var txt = v.textContent.trim(), num = txt.replace(/[^0-9]/g, ''), suf = (txt.indexOf('%') > -1) ? '%' : '';
      setTimeout(function () {
        if (num !== '') roll(v, +num, suf, Math.max(380, segs.length * 55));
        else scram(v, txt, Math.max(380, segs.length * 55));
      }, rd);
    });
    specs.querySelectorAll('.specfoot b').forEach(function (el, i) {
      var fin = el.textContent;
      setTimeout(function () { scram(el, fin, 440); }, rows.length * 190 + i * 130);
    });
  }
  var seen = false;
  var io2 = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !seen) { seen = true; run(); io2.disconnect(); }
    });
  }, { threshold: .2 });
  io2.observe(specs);
})();

function initTapes() {
  document.querySelectorAll('.tape-inner').forEach(function (inner) {
    var tape = inner.parentElement;
    if (!inner.dataset.base) inner.dataset.base = inner.innerHTML;
    var base = inner.dataset.base;
    inner.innerHTML = base + base;
    var g = 0;
    while (inner.scrollWidth / 2 < tape.clientWidth + 40 && g < 40) {
      inner.innerHTML += base + base;
      g++;
    }
    inner.style.animationDuration = Math.max(12, (inner.scrollWidth / 2) / 80) + 's';
  });
}
initTapes();
addEventListener('load', initTapes);
var _rt;
addEventListener('resize', function () {
  clearTimeout(_rt);
  _rt = setTimeout(initTapes, 200);
});

if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.rv').forEach(function (el, i) {
    el.style.transitionDelay = (i % 3 * 80) + 'ms';
    io.observe(el);
  });
} else {
  document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
}

var burgerBtn = document.getElementById('burger'), mobileMenu = document.getElementById('mobile');
burgerBtn.addEventListener('click', function () { mobileMenu.classList.toggle('open'); });
mobileMenu.querySelectorAll('a').forEach(function (a) {
  a.addEventListener('click', function () { mobileMenu.classList.remove('open'); });
});
var toTopBtn = document.getElementById('toTop');
addEventListener('scroll', function () { toTopBtn.classList.toggle('show', scrollY > 620); });
toTopBtn.addEventListener('click', function () { scrollTo({ top: 0, behavior: 'smooth' }); });
