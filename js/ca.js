try {
  const caEl = document.getElementById('ca');
  const caBox = caEl && caEl.closest('.ca');
  const caIsAddr = () => caEl && !/\s/.test(caEl.textContent.trim()) && caEl.textContent.trim().length >= 20;
  if (caBox) {
    if (caIsAddr()) { caBox.style.cursor = 'pointer'; caBox.title = 'click to copy'; }
    caBox.addEventListener('click', () => {
      if (!caIsAddr()) return;
      const addr = caEl.textContent.trim();
      navigator.clipboard.writeText(addr).then(() => {
        caEl.textContent = 'copied ✓';
        setTimeout(() => { caEl.textContent = addr; }, 900);
      }).catch(() => {});
    });
  }
} catch (e) {}
