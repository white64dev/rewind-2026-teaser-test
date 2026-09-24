// Crumpled-edge reveal for DOM panels: a clip-path polygon that grows from one corner with an
// irregular, torn-looking edge. Ported from MTRO-18796-Replica/src/lib/reveal.js (the "...You!" box),
// which in turn ports the w64 theme's createSpikeAnimation. Same seeded spokes and defaults, so the
// edge is identical on every play and on scrub-back; here it drives clip-path instead of a mask.

/** Seeded xorshift32 in [0, 1). */
function xorshift(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** Per-spoke radius multipliers: most spokes just inside 1, about a third poking past it. */
function spikeSpokes(nPts, seed, spread) {
  const rnd = xorshift(seed);
  return Array.from({ length: nPts }, () => {
    const v = rnd();
    return v > 0.65 ? 1 + spread * 0.1 + ((v - 0.65) / 0.35) * spread * 0.9 : 1 - spread + (v / 0.65) * spread * 0.9;
  });
}

const ORIGINS = { 'top-left': [0, 0], 'top-right': [1, 0], 'bottom-left': [0, 1], 'bottom-right': [1, 1], centre: [.5, .5] };

/** power2.inOut, the theme's panelGrow ease. */
export const easeInOut2 = t => { const x = Math.min(Math.max(t, 0), 1); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };

/**
 * Returns paint(t): t = 0 hides the element, 1 shows it whole (no clip-path at all), anything
 * between clips it to the torn polygon at that eased fraction. Only repaints when t changes.
 */
export function crumpleReveal(el, spec = {}) {
  const d = { origin: 'bottom-right', seed: 1337, nPts: 72, spread: .12, waveAmp: .05, waveCount: 2, overshoot: 1.25, ...spec };
  const spokes = spikeSpokes(d.nPts, d.seed, d.spread);
  let last = -1;
  return function paint(t) {
    t = Math.min(Math.max(t, 0), 1);
    if (Math.abs(t - last) < 1e-4) return;
    last = t;
    el.classList.toggle('anim', t > 0 && t < 1);
    if (t <= 0) { el.style.visibility = 'hidden'; el.style.clipPath = ''; return; }
    el.style.visibility = '';
    if (t >= 1) { el.style.clipPath = ''; return; }
    const W = el.offsetWidth, H = el.offsetHeight, [ox, oy] = ORIGINS[d.origin] ?? ORIGINS['bottom-right'];
    const r = easeInOut2(t) * Math.hypot(W, H) * d.overshoot;
    const pts = spokes.map((m, i) => {
      const a = i / spokes.length * 2 * Math.PI, rad = r * m * (1 + d.waveAmp * Math.sin(d.waveCount * a));
      return `${(ox * W + rad * Math.cos(a)).toFixed(1)}px ${(oy * H + rad * Math.sin(a)).toFixed(1)}px`;
    });
    el.style.clipPath = `polygon(${pts.join(',')})`;
  };
}
