// Owner's Manual reader: dialog wiring. The 3D book itself (book.js) loads on first open.
const $ = q => document.querySelector(q);
const root = $('#book'), canvas = $('#bookCanvas'), label = $('#bPage'), prevB = $('#bPrev'), nextB = $('#bNext');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let book = null, lastFocus = null, busy = false;

const PAGES = 20, SHEETS = PAGES / 2;                          // keep in step with book.js
const describe = k => k === 0 ? 'Cover' : k === SHEETS ? 'Back cover' : `Pages ${2 * k}–${2 * k + 1} of ${PAGES}`;
function onPage(k) { label.textContent = describe(k); prevB.disabled = k === 0; nextB.disabled = k === SHEETS; }
const setInert = on => { for (const el of document.body.children) if (el !== root && el.tagName !== 'SCRIPT') el.inert = on; };

window.openManual = async () => {
  if (!root.hidden || busy) return;
  busy = true; lastFocus = document.activeElement;
  root.hidden = false; document.body.style.overflow = 'hidden'; setInert(true);
  dispatchEvent(new CustomEvent('manual', { detail: true }));
  if (!book) { const { createBook } = await import('./book.js'); book = createBook({ root, canvas, reduce, onPage }); }
  onPage(0); book.open(); root.classList.add('on'); nextB.focus({ preventScroll: true }); busy = false;
};
function close() {
  if (root.hidden || busy) return;
  busy = true;
  book.close(() => {
    root.hidden = true; document.body.style.overflow = ''; setInert(false); busy = false;
    dispatchEvent(new CustomEvent('manual', { detail: false }));
    lastFocus?.focus?.();
  }, window.__manualRect?.(), () => root.classList.remove('on'));
}
root.addEventListener('click', ev => { if (ev.target.closest('[data-bclose]')) close(); });
prevB.addEventListener('click', () => book?.prev());
nextB.addEventListener('click', () => book?.next());
// the pages themselves: tap/click a side to turn that way, or swipe
let down = null;
canvas.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
canvas.addEventListener('pointerup', ev => {
  if (!down || !book) return; const dx = ev.clientX - down.x, dy = ev.clientY - down.y; down = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? book.next() : book.prev();
  if (Math.hypot(dx, dy) < 8) ev.clientX > innerWidth / 2 ? book.next() : book.prev();
});
addEventListener('keydown', ev => {
  if (root.hidden) return;
  if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  else if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); book?.next(); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); book?.prev(); }
  else if (ev.key === 'Home') { ev.preventDefault(); book?.go(0); }
  else if (ev.key === 'End') { ev.preventDefault(); book?.go(SHEETS); }
  else if (ev.key === 'Tab') {                                   // keep focus inside the reader
    const f = [...root.querySelectorAll('button,[href]')].filter(e => !e.disabled && e.offsetParent !== null);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
    else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
  }
}, true);
$('#manualBtn')?.addEventListener('click', () => window.openManual());
