// Metro Owner's Manual reader: a 3D book whose pages bend as they turn.
// Loaded on first open (dynamic import), in its own canvas over the page, so the desk scene is untouched.
//
// Each sheet (two pages, front and back) is a thin box skinned to a chain of bones along its width.
// Turning rotates the chain about the spine; while a sheet is in flight part of that rotation is
// spread down the chain, so the paper curls and then lies flat again. 28 pages = 14 sheets.
import * as THREE from 'three';

const PAGES = 28, SHEETS = PAGES / 2;
const PAGE_W = 1, PAGE_H = 648 / 522, THICK = .004, SEG = 30;
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
    const z = (SHEETS - s) * THICK; mesh.position.z = z;
    sheets.push({ mesh, bones, a: 0, t0: 0, from: 0, to: 0, z0: z, z1: z, flips: false });
  }

  let spread = 0, target = 0, open = false, t = 0;   // spread k: sheets 0..k-1 have turned
  const angleFor = (s, k) => (s < k ? -Math.PI + s * .004 : s * .004);    // both stacks fan a hair, top sheet nearest: no z-fighting
  const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function setSpread(k) {
    k = Math.max(0, Math.min(SHEETS, k));
    if (k === target) return;
    target = k;
    sheets.forEach((sh, s) => {
      const to = angleFor(s, k), z1 = s < k ? s * THICK : (SHEETS - s) * THICK;   // turned pile: last turned on top
      if (Math.abs(to - sh.to) < 1e-6) return;
      sh.flips = Math.abs(to - sh.to) > 1;
      // sheets that change sides turn one after another when jumping several spreads
      const order = !sh.flips ? 0 : k > spread ? s - spread : spread - 1 - s;
      sh.from = sh.a; sh.to = to; sh.z0 = sh.mesh.position.z; sh.z1 = z1; sh.t0 = t + (reduce ? 0 : Math.max(0, order) * .12);
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

  let raf = 0, last = 0, shown = 0;                  // shown: 0 closed → 1 in front of the reader
  const clock = new THREE.Clock(false);
  function frame() {
    const dt = Math.min(clock.getDelta(), .05); t += dt;
    shown += ((open ? 1 : 0) - shown) * (reduce ? 1 : 1 - Math.pow(.002, dt));
    let flying = false;
    for (let s = 0; s < SHEETS; s++) {
      const sh = sheets[s];
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - sh.t0) / TURN));
      sh.a = sh.from + (sh.to - sh.from) * ease(k);
      const mid = sh.flips ? Math.sin(Math.PI * k) : 0;                          // how much this sheet is in flight
      if (k < 1) flying = true;
      const cover = s === 0 || s === SHEETS - 1, curl = (cover ? .15 : .55) * mid;
      // root takes the turn, the chain carries a lagging curl that vanishes at both ends of the turn
      sh.bones[0].rotation.y = sh.a;
      for (let b = 1; b < sh.bones.length; b++) sh.bones[b].rotation.y = curl * Math.sign(sh.to - sh.from) * -Math.sin((b / SEG) * Math.PI) * (2.2 / SEG);
      // stacking: each pile keeps its top sheet nearest; a sheet in flight lifts clear of both
      sh.mesh.position.z = sh.z0 + (sh.z1 - sh.z0) * ease(k) + mid * .06;
    }
    // closed on the cover: the book sits right of the spine; closed on the back: left; open: centred
    const cx = spread === 0 ? -PAGE_W / 2 : spread === SHEETS ? PAGE_W / 2 : 0;
    book.position.x += (cx - book.position.x) * (reduce ? 1 : 1 - Math.pow(.02, dt));
    book.position.y = (1 - shown) * -1.2;
    book.rotation.x = -.12 - (1 - shown) * .6;
    book.scale.setScalar(.75 + .25 * shown);
    renderer.render(scene, camera);
    if (open || shown > .005 || flying) raf = requestAnimationFrame(frame); else raf = 0;
  }
  const run = () => { if (!raf) { clock.start(); raf = requestAnimationFrame(frame); } };

  return {
    open() {
      open = true; resize(); run();
      for (let n = 1; n <= PAGES; n++) texFor(n);
      setTimeout(() => open && spread === 0 && setSpread(1), reduce ? 0 : 450);   // the cover lifts once it is in front
    },
    close(done) {
      open = false; setSpread(0);
      setTimeout(done, reduce ? 0 : 1000);
    },
    next() { setSpread(target + 1); },
    prev() { setSpread(target - 1); },
    go(k) { setSpread(k); },
    get spread() { return target; },
    SHEETS, PAGES,
  };
}
