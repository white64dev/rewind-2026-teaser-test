// Page UI outside the WebGL scene: newsletter form, "Calling for Your Metro Stories" modal, sound.
/* ---------- page UI: forms, modal, sound (plain script so it works even if WebGL fails) ---------- */
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const setScale = () => document.documentElement.style.setProperty('--s', Math.min(1.2, Math.max(.56, innerWidth / 1728)).toFixed(3));
  addEventListener('resize', setScale); setScale();

  // newsletter
  const cta = $('#cta'), nEmail = $('#nEmail'), nMsg = $('#nMsg');
  cta.addEventListener('submit', ev => {
    ev.preventDefault();
    const v = nEmail.value.trim();
    if (!EMAIL.test(v)) { nEmail.setAttribute('aria-invalid', 'true'); nMsg.textContent = v ? 'Check the email address.' : 'Enter your email first.'; nEmail.focus(); return; }
    nEmail.removeAttribute('aria-invalid');
    nMsg.textContent = 'Signup isn\u2019t connected yet \u2014 nothing was sent.';
  });
  nEmail.addEventListener('input', () => { nEmail.removeAttribute('aria-invalid'); nMsg.textContent = ''; });

  // modal
  const modal = $('#modal'), form = $('#story');
  let lastFocus = null;
  const steps = [...form.querySelectorAll('[data-step]')];
  const show = n => { steps.forEach(s => s.hidden = s.dataset.step != n); form.scrollTop = 0; const f = steps[n - 1].querySelector('input,select,textarea,button'); f && f.focus({ preventScroll: true }); };
  window.openStories = () => {
    if (!modal.hidden) return;
    lastFocus = document.activeElement; modal.hidden = false; document.body.style.overflow = 'hidden'; show(1);
    dispatchEvent(new CustomEvent('stories', { detail: true }));
  };
  const close = () => { modal.hidden = true; document.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus(); dispatchEvent(new CustomEvent('stories', { detail: false })); };
  modal.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) close(); });
  addEventListener('keydown', ev => {
    if (modal.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    if (ev.key === 'Tab') {                                   // keep focus inside the dialog
      const f = [...modal.querySelectorAll('button,input,select,textarea,[href]')].filter(e => !e.disabled && e.offsetParent !== null);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
    }
  });
  document.querySelectorAll('[data-open-stories]').forEach(b => b.addEventListener('click', () => window.openStories()));
  form.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(+b.dataset.go)));
  // step 1 → 2: picking a card moves on, carrying the category
  form.querySelectorAll('input[name=cat]').forEach(r => r.addEventListener('change', () => { $('#cat2').value = r.value; setTimeout(() => show(2), 220); }));
  form.querySelectorAll('.rc').forEach(c => c.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const r = c.querySelector('input'); r.checked = true; r.dispatchEvent(new Event('change')); } }));
  // step 2
  const txt = $('#storyText'), count = $('#count'), sErr = $('#storyErr');
  txt.addEventListener('input', () => { count.textContent = txt.value.length + '/500'; sErr.hidden = true; txt.removeAttribute('aria-invalid'); });
  $('#next2').addEventListener('click', () => {
    if (!txt.value.trim()) { sErr.hidden = false; txt.setAttribute('aria-invalid', 'true'); txt.focus(); return; }
    show(3);
  });
  const photo = $('#photo'), prev = $('#preview');
  photo.addEventListener('change', () => {
    const f = photo.files[0]; if (!f) { prev.hidden = true; return; }
    const img = prev.querySelector('img'); if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(f); prev.querySelector('span').textContent = f.name; prev.hidden = false;
  });
  $('#rmPhoto').addEventListener('click', () => { photo.value = ''; prev.hidden = true; });
  // step 3
  const fN = $('#fName'), lN = $('#lName'), em = $('#sEmail'), cs = $('#consent'), sub = $('#submit3'), eErr = $('#emailErr'), alert = $('#submitErr');
  const valid = () => fN.value.trim() && lN.value.trim() && EMAIL.test(em.value.trim()) && cs.checked;
  [fN, lN, em, cs].forEach(i => i.addEventListener('input', () => { sub.disabled = !valid(); alert.hidden = true; }));
  cs.addEventListener('change', () => { sub.disabled = !valid(); });
  em.addEventListener('blur', () => { const bad = em.value.trim() && !EMAIL.test(em.value.trim()); eErr.hidden = !bad; bad ? em.setAttribute('aria-invalid', 'true') : em.removeAttribute('aria-invalid'); });
  $('#termsBtn').addEventListener('click', ev => { const t = $('#terms'); t.hidden = !t.hidden; ev.currentTarget.setAttribute('aria-expanded', String(!t.hidden)); });
  form.addEventListener('submit', ev => { ev.preventDefault(); if (!valid()) return; alert.hidden = false; alert.focus?.(); });

  // sound: synthesized room tone + clock ticks, starts only after the viewer opts in
  let ac = null, gain = null;
  const snd = $('#sound');
  function startAudio() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }   // brown noise
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    gain = ac.createGain(); gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(ac.destination); src.start();
  }
  snd.addEventListener('click', () => {
    const on = snd.getAttribute('aria-pressed') !== 'true';
    snd.setAttribute('aria-pressed', String(on));
    if (on && !ac) startAudio();
    if (ac) { ac.resume(); gain.gain.setTargetAtTime(on ? .09 : 0, ac.currentTime, .25); }
  });
  window.ding = () => {                                        // carriage-return bell
    if (!ac || snd.getAttribute('aria-pressed') !== 'true') return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = 2350; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1);
  };
  window.tick = () => {                                        // one flap of the flip clock
    if (!ac || snd.getAttribute('aria-pressed') !== 'true') return;
    const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * .03, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.4;
    const g = ac.createGain(); g.gain.value = .35; s.connect(f).connect(g).connect(ac.destination); s.start(t);
  };
})();
