// If this tab is not compositing (hidden panel, background prerender),
// requestAnimationFrame never fires and the launcher stalls forever.
// Fall back to a setTimeout driver when no frame arrives quickly.
(function () {
  let ticked = false;
  window.requestAnimationFrame(() => { ticked = true; });
  setTimeout(() => {
    if (!ticked) {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
      console.log('[stonks] rAF stalled — switched to setTimeout frame driver');
      if (typeof mtScheduler !== 'undefined') mtScheduler.invokeCallbacks();
    }
  }, 1200);

  window.addEventListener('beforeunload', (e) => {
    if (window.__ccHomeReload) e.stopImmediatePropagation();
  }, true);
})();
