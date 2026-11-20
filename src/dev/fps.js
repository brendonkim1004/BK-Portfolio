// Dev-only frames-per-second readout in the corner. Not included in the production build's behaviour.
export function createFpsMeter() {
  const el = document.createElement('div');
  el.className = 'fps';
  document.body.append(el);
  let frames = 0;
  let since = performance.now();
  return () => {
    frames++;
    const now = performance.now();
    if (now - since >= 500) {
      el.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
      frames = 0;
      since = now;
    }
  };
}
