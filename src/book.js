// Metro Owner's Manual reader: a 3D book whose pages bend as they turn.
// Loaded on first open (dynamic import), in its own canvas over the page, so the desk scene is untouched.
//
// Each sheet (two pages, front and back) is a thin box skinned to a chain of bones along its width.
// Turning rotates the chain about the spine; while a sheet is in flight part of that rotation is
// spread down the chain, so the paper curls and then lies flat again. 28 pages = 14 sheets.
import * as THREE from 'three';

const PAGES = 20, SHEETS = PAGES / 2;            // the 1976 manual: cover, pages 2–19, back cover
const PAGE_W = 1, PAGE_H = 1245 / 1000, THICK = .0025, SEG = 40;
const GUTTER = .75, GUTTER_L = .15;               // open spread: pages rise out of the spine along a smooth curve (rad, page widths)
const TURN = .9;                                     // seconds per page turn
const src = n => `/manual/p${String(n).padStart(2, '0')}.webp`;

export function createBook({ root, canvas, reduce, onPage }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 2.1));
  const key = new THREE.DirectionalLight(0xffe7c2, 1.5); key.position.set(-1.5, 2, 3); scene.add(key);

  // textures: covers first, the rest as soon as the reader is open
  const loader = new THREE.TextureLoader(), tex = [];
  const texFor = n => {
    if (!tex[n]) { tex[n] = loader.load(src(n)); tex[n].colorSpace = THREE.SRGBColorSpace; tex[n].anisotropy = renderer.capabilities.getMaxAnisotropy(); }
    return tex[n];
  };

  // one skinned geometry for every sheet
  const geo = new THREE.BoxGeometry(PAGE_W, PAGE_H, THICK, SEG, 2);
  geo.translate(PAGE_W / 2, 0, 0);                    // hinge on the spine at x = 0
  const pos = geo.attributes.position, idx = [], wts = [], segW = PAGE_W / SEG;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), b = Math.min(SEG - 1, Math.max(0, Math.floor(x / segW))), w = (x - b * segW) / segW;
    idx.push(b, b + 1, 0, 0); wts.push(1 - w, w, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));

  const edge = new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: .9 });
  const book = new THREE.Group(); scene.add(book);
  const sheets = [];
  for (let s = 0; s < SHEETS; s++) {
    const face = n => new THREE.MeshStandardMaterial({ map: texFor(n), roughness: .82 });
    // BoxGeometry groups: +x, -x, +y, -y, +z (front), -z (back)
    const mesh = new THREE.SkinnedMesh(geo, [edge, edge, edge, edge, face(2 * s + 1), face(2 * s + 2)]);
    const bones = [];
    for (let b = 0; b <= SEG; b++) { const bone = new THREE.Bone(); bone.position.x = b ? segW : 0; if (b) bones[b - 1].add(bone); bones.push(bone); }
    mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    book.add(mesh);
    const z = -s * THICK; mesh.position.z = z;
    sheets.push({ mesh, bones, a: 0, t0: 0, from: 0, to: 0, z0: z, z1: z, flips: false });
  }

  let spread = 0, target = 0, open = false, t = 0, gOpen = 0;   // spread k: sheets 0..k-1 have turned
  // Both piles are measured from their top sheet, which sits at z = 0 and lies exactly flat (0 or −π),
  // so the two visible pages meet the spine at the same depth and their outer edges line up.
  // Sheets underneath step back and fan a hair away from the camera: no z-fighting.
  const angleFor = (s, k) => (s < k ? -Math.PI - (k - 1 - s) * .002 : (s - k) * .002);
  const zFor = (s, k) => -(s < k ? k - 1 - s : s - k) * THICK;
  const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function setSpread(k, speed = 1) {
    k = Math.max(0, Math.min(SHEETS, k));
    if (k === target) return;
    target = k;
    sheets.forEach((sh, s) => {
      const to = angleFor(s, k), z1 = zFor(s, k);
      if (Math.abs(to - sh.to) < 1e-6 && Math.abs(z1 - sh.z1) < 1e-6) return;
      sh.flips = Math.abs(to - sh.to) > 1;
      // sheets that change sides turn one after another when jumping several spreads; a pile only
      // rises to meet the spine once the sheet in flight has lifted off it, or it pokes through its edge
      const order = !sh.flips ? 0 : k > spread ? s - spread : spread - 1 - s;
      const wait = !sh.flips && z1 > sh.mesh.position.z + 1e-6 ? .45 : 0;
      sh.from = sh.a; sh.to = to; sh.z0 = sh.mesh.position.z; sh.z1 = z1; sh.dur = TURN / speed;
      sh.t0 = t + (reduce ? 0 : (Math.max(0, order) * .12 + wait * TURN) / speed);
    });
    spread = k;
    onPage?.(k);
  }

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // fit an open spread (2 pages wide) with a margin, whichever axis is tighter
    const fitH = PAGE_H * 1.55, fitW = 2 * PAGE_W * 1.3;          // room for the close button and the page bar
    const dist = Math.max(fitH / 2 / Math.tan(THREE.MathUtils.degToRad(15)), fitW / 2 / Math.tan(THREE.MathUtils.degToRad(15)) / camera.aspect);
    camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }
  addEventListener('resize', () => open && resize());

  let raf = 0, last = 0, shown = 0, away = null;                  // shown: 0 closed → 1 in front of the reader
  const clock = new THREE.Clock(false);
  function frame() {
    const dt = Math.min(clock.getDelta(), .05); t += dt;
    shown += ((open ? 1 : 0) - shown) * (reduce ? 1 : 1 - Math.pow(.002, dt));
    let flying = false;
    for (let s = 0; s < SHEETS; s++) {
      const sh = sheets[s];
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - sh.t0) / (sh.dur || TURN)));
      sh.a = sh.from + (sh.to - sh.from) * ease(k);
      const mid = sh.flips ? Math.sin(Math.PI * k) : 0;                          // how much this sheet is in flight
      // the curl is gone before the sheet lands, and the lift comes down early, so the landing page
      // arrives flat and at the pile's depth: its outer edge doesn't shrink and grow back
      const bend = sh.flips ? Math.sin(Math.PI * Math.min(1, k / .8)) : 0;
      const lift = !sh.flips ? 0 : k < .5 ? Math.sqrt(mid) : mid * mid;
      if (k < 1) flying = true;
      const cover = s === 0 || s === SHEETS - 1, curl = (cover ? .15 : .55) * bend;
      // root takes the turn, the chain carries a lagging curl that vanishes at both ends of the turn
      // gutter: the slope starts at GUTTER out of the spine and eases to flat (cos(a) mirrors it for left pages,
      // and it fades out while a sheet stands up in flight); the flight curl lags the tip behind the root
      const g = GUTTER * gOpen * Math.cos(sh.a), dir = Math.sign(sh.to - sh.from);
      let prev = 0;
      for (let b = 0; b < sh.bones.length; b++) {
        const u = b / SEG, slope = -g * Math.exp(-u / GUTTER_L);
        const lag = curl * dir * Math.sin(u * Math.PI) * (2.2 / SEG);          // the free edge leads, lifting toward the reader
        sh.bones[b].rotation.y = (b ? 0 : sh.a) + slope - prev + (b ? lag : 0);
        prev = slope;
      }
      // stacking: each pile keeps its top sheet nearest; a sheet in flight lifts clear of both
      sh.mesh.position.z = sh.z0 + (sh.z1 - sh.z0) * ease(k) + lift * .07;          // lifts clear at once, settles before landing
    }
    // closed on the cover: the book sits right of the spine; closed on the back: left; open: centred
    gOpen += ((spread > 0 && spread < SHEETS ? 1 : 0) - gOpen) * (reduce ? 1 : 1 - Math.pow(.02, dt));   // closed books lie flat
    const cx = spread === 0 ? -PAGE_W / 2 : spread === SHEETS ? PAGE_W / 2 : 0;
    book.position.x += (cx - book.position.x) * (reduce ? 1 : 1 - Math.pow(.02, dt));
    book.position.y = (1 - shown) * -1.2;
    book.rotation.x = -.3 - (1 - shown) * .5;                // tipped back a little, like a book held open: the gutter curve reads
    book.scale.setScalar(.75 + .25 * shown);
    if (away) {                                              // closing: once shut, shrink onto the manual lying on the desk
      if (away.t < 0 && !flying) { away.t = 0; away.x0 = book.position.x; away.onShrink?.(); }
      if (away.t >= 0) {
        away.t = Math.min(1, away.t + dt / (reduce ? 1e-3 : .6));
        const e = ease(away.t), g = away.to;
        book.position.set(away.x0 + (g.x - away.x0) * e, g.y * e, 0);
        book.rotation.x = -.3 * (1 - e); book.scale.setScalar(1 + (g.s - 1) * e);
        canvas.style.opacity = String(1 - Math.max(0, (away.t - .7) / .3));
        if (away.t >= 1) { const d = away.done; away = null; open = false; shown = 0; renderer.render(scene, camera); d?.(); return (raf = 0); }
      }
    }
    renderer.render(scene, camera);
    if (open || shown > .005 || flying) raf = requestAnimationFrame(frame); else raf = 0;
  }
  const run = () => { if (!raf) { clock.start(); raf = requestAnimationFrame(frame); } };

  return {
    open() {
      open = true; away = null; canvas.style.opacity = ''; resize(); run();
      for (let n = 1; n <= PAGES; n++) texFor(n);
      setTimeout(() => open && spread === 0 && setSpread(1), reduce ? 0 : 450);   // the cover lifts once it is in front
    },
    // target: the manual's rectangle on screen (px). Pages shut at double speed, then the closed
    // book shrinks onto it and fades.
    close(done, target, onShrink) {
      setSpread(0, 2);
      let g = { x: -PAGE_W / 2, y: -1.2, s: .5 };
      if (target) {
        const ndc = new THREE.Vector3((target.x + target.w / 2) / innerWidth * 2 - 1, -((target.y + target.h / 2) / innerHeight * 2 - 1), .5).unproject(camera);
        const dir = ndc.sub(camera.position).normalize(), p = camera.position.clone().addScaledVector(dir, -camera.position.z / dir.z);
        const perPx = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
        const sc = Math.min(target.w / PAGE_W, target.h / PAGE_H) * perPx;
        g = { x: p.x - sc * PAGE_W / 2, y: p.y, s: sc };
      }
      away = { t: -1, to: g, onShrink, done: () => { canvas.style.opacity = ''; done(); } };
      run();
    },
    next() { setSpread(target + 1); },
    prev() { setSpread(target - 1); },
    go(k) { setSpread(k); },
    get spread() { return target; },
    SHEETS, PAGES,
  };
}
