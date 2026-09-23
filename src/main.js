// Metro Rewind teaser — Three.js scene: wall → desk cube-pitch transition, relit image layers, typing sheet.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FRAME_W = 1728, FRAME_H = 1038, DESK_Y = 1038;       // design px; desk frame sits under the wall frame
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a1f18');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// Cube-interior rig (from the motion spec): camera stands FRAME_H/2 from the wall and FRAME_H/2 above the desk,
// vertical FOV 90° so the wall fills the frame at 0° pitch and the desk fills it at 90°. It only rotates.
const D = FRAME_H / 2;
const HOLD_END = .14, MOVE_END = .78, K_MAX = .35, BLUR_MAX = 22, BLUR_CAP = 30, SMOOTH = .14;
const camera = new THREE.PerspectiveCamera(90, 1, 5, 20000);
let VW = FRAME_W, pan = 12;
const W = (x, y, z = 0) => new THREE.Vector3(x, -y, z);   // design coords → world (y up)

/* ---------- state ---------- */
const S = { relight: 1, shadows: 0, normals: 0 };
const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: .35, py: .45, has: false, last: -99 };  // -1..1 and 0..1
let scrollP = 0, viewT = 0, sm = 0, prevSm = 0, modalOpen = false;
const aim = { x: 858, y: -405 };

/* ---------- relight shader ---------- */
const sprites = [], casters = [];
const common = {
  uLight: { value: new THREE.Vector3() }, uLightCol: { value: new THREE.Color(1, .93, .82) },
  uAmb: { value: .97 }, uKey: { value: .5 }, uFall: { value: 900 }, uFill: { value: .55 }, uRelief: { value: 0 },
  uRelight: { value: 1 }, uNormals: { value: 0 }, uFrame: { value: new THREE.Matrix4() },
  uSpotDir: { value: new THREE.Vector3(0, 0, -1) }, uCosIn: { value: Math.cos(.26) }, uCosOut: { value: Math.cos(.56) }, uSpill: { value: .14 },
  sunMap: { value: null }, uSun: { value: 0 }, uTime: { value: 0 }, uSunLevel: { value: 1 }
};
const wallU = {
  uLight: { value: new THREE.Vector3() }, uLightCol: { value: new THREE.Color(1, .93, .82) },
  uAmb: { value: 1 }, uKey: { value: .06 }, uFall: { value: 1e6 }, uFill: { value: .7 }, uRelief: common.uRelief,
  uRelight: common.uRelight, uNormals: common.uNormals, uFrame: { value: new THREE.Matrix4() },
  uSpotDir: { value: new THREE.Vector3(0, 0, -1) }, uCosIn: { value: -1.9 }, uCosOut: { value: -2 }, uSpill: { value: 1 },
  sunMap: { value: null }, uSun: { value: 1 }, uTime: { value: 0 }, uSunLevel: { value: 1 }
};
const vert = `
  uniform mat4 uFrame; varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = (uFrame * w).xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const frag = `
  uniform sampler2D map, nmap; uniform vec3 uLight, uLightCol;
  uniform float uAmb, uKey, uFall, uFill, uSpec, uGloss, uBaked, uRelight, uNormals, uZ, uCosIn, uCosOut, uSpill, uRelief; uniform vec2 uPad; uniform vec3 uSpotDir;
  uniform sampler2D sunMap; uniform float uSun, uTime, uSunLevel;
  uniform float uClipY, uClipTop, uTypeOn, uTypeLine, uTypeU;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.03+3.1)*.3 + vn(p*4.1+7.7)*.15; }
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vec2 uv = clamp((vUv - .5) * uPad + .5, 0., 1.);        // padded plates smear their edge pixels outward
    vec4 c = texture2D(map, uv);
    vec4 nm = texture2D(nmap, uv);
    vec3 N = normalize(mix(vec3(0., 0., 1.), nm.xyz * 2. - 1., uRelief));
    float core = smoothstep(.85, .95, c.a);
    vec3 P = vec3(vW.xy, uZ);
    vec3 Lv = uLight - P; float d = length(Lv); vec3 L = Lv / d;
    float att = 1. / (1. + (d / uFall) * (d / uFall));
    att *= mix(uSpill, 1., smoothstep(uCosOut, uCosIn, dot(-L, uSpotDir)));   // lamp cone
    float lam = max(dot(N, L), 0.);
    vec3 F = normalize(vec3(-.45, .55, .7));                 // soft room fill, upper-left
    float relief = dot(N, F) - F.z;                          // 0 on flat areas, carves bevels everywhere
    vec3 shade = vec3(uAmb) + uLightCol * (uKey * att * mix(1., lam, uRelief)) + uFill * relief * uRelief;
    vec3 H = normalize(L + vec3(0., 0., 1.));
    float sp = pow(max(dot(N, H), 0.), uGloss) * uSpec * att * core * uRelief;
    vec3 lit = c.rgb * shade + uLightCol * sp;
    float a = c.a * mix(mix(1., uBaked, uRelief), 1., core);                   // fade the shadow painted into the image
    vec3 col = mix(c.rgb, lit, uRelight);
    a = mix(c.a, a, uRelight);
    a *= step(uClipY, vW.y) * step(vW.y, uClipTop);           // …and the chair disappears under the desk edge                                  // paper disappears into the typewriter below the bail
    if (uTypeOn > .5) {                                       // only what has been struck so far
      float vt = 1. - uv.y; float li = vt < .28 ? 0. : (vt < .70 ? 1. : 2.);
      a *= li < uTypeLine ? 1. : (li == uTypeLine && uv.x < uTypeU ? 1. : 0.);
    }
    if (uSun > .5) {                                          // window light: wavering edge, leaf dapple, cloud breathing
      vec2 suv = vec2((vW.x + 66.) / 1859., 1. + vW.y / 1038.);
      vec2 wv = vec2(vn(suv * vec2(3., 2.) + uTime * .05), vn(suv * vec2(3., 2.) - uTime * .04 + 7.)) - .5;
      vec2 sway = vec2(sin(uTime * .23) * .007 + sin(uTime * .71 + 2.) * .0025, sin(uTime * .17 + 1.) * .0045 + sin(uTime * .53) * .0015);
      float m0 = texture2D(sunMap, clamp(suv + wv * .004, 0., 1.)).r;                 // where the painted patch is
      float m = texture2D(sunMap, clamp(suv - sway + wv * .011, 0., 1.)).r;          // where the light is right now
      col *= 1. + (m - m0) * .42 * uRelight;                                         // brighten the leading edge, dim the trailing one
      float leaf = fbm(suv * vec2(9., 6.) + vec2(uTime * .045, -uTime * .03)) * .6 + fbm(suv * vec2(15., 10.) - vec2(uTime * .08, uTime * .025)) * .4;
      float k = (uSunLevel - 1.) + (leaf - .5) * .2;
      col *= 1. + m * k * uRelight;
      col += m * vec3(1., .85, .6) * max(k, 0.) * .1 * uRelight;
    }
    if (uNormals > .5) { col = mix(vec3(.5,.5,1.), nm.xyz, step(.5, core)); a = step(.02, c.a); }
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;
const shFrag = `
  uniform sampler2D nmap; uniform vec2 uOff; uniform float uK, uCast, uOn;
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vec2 uv = (vUv - .5) * uK + .5 - uOff;
    float m = texture2D(nmap, clamp(uv, 0., 1.)).a;
    m *= step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
    gl_FragColor = vec4(.10, .06, .035, m * uCast * uOn);
    #include <colorspace_fragment>
  }`;

const mgr = new THREE.LoadingManager();
const tl = new THREE.TextureLoader(mgr);
const loadTex = (n, srgb) => { const t = tl.load('/assets/' + n); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
let order = 0;
{ const sm = loadTex('wall_sun.webp', false); common.sunMap.value = sm; wallU.sunMap.value = sm; }
const PAD = { wall_bg: [2.6, 1.3], d00_base: [2.4, 1] };
function addSprite(e, parent, U, recvZ = 0) {
  const map = loadTex(e.name + '.webp', true), nmap = loadTex(e.name + '_n.webp', false);
  const uniforms = { ...U, map: { value: map }, nmap: { value: nmap }, uSpec: { value: e.spec }, uGloss: { value: e.gloss },
                     uBaked: { value: e.baked }, uZ: { value: e.z },
                     uPad: { value: new THREE.Vector2(...(PAD[e.name] || [1, 1])) },
                     uClipY: { value: e.clipY ? -e.clipY : -1e9 }, uClipTop: { value: e.name === 'd00b_chair' ? -865 : 1e9 }, uTypeOn: { value: 0 }, uTypeLine: { value: 9 }, uTypeU: { value: 1 } };
  if (e.name === 'd33_sheet' || e.name === 'd29_tw_copy') {   // printed sheet reads as the picture: full white, only a warm touch from the lamp
    uniforms.uAmb = { value: 1 }; uniforms.uKey = { value: .35 }; uniforms.uFill = { value: 0 };
  }
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  m.position.copy(W(cx, cy, e.z));
  m.userData = e; m.onDesk = parent !== scene; m.pad = PAD[e.name] || [1, 1]; m.cx = cx; m.cy = cy; m.off = { x: 0, y: 0 };
  if (e.cast > 0 && e.name !== 'd32_lamp') {
    const K = 1.7;
    const su = { uFrame: U.uFrame, nmap: { value: nmap }, uOff: { value: new THREE.Vector2() }, uK: { value: K }, uCast: { value: e.cast }, uOn: { value: 1 } };
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ uniforms: su, vertexShader: vert, fragmentShader: shFrag, transparent: true, depthTest: false, depthWrite: false }));
    sm.position.copy(W(cx, cy, recvZ));
    sm.renderOrder = order++;
    sm.userData = { e, su, K, recvZ, cx, cy, U };
    parent.add(sm); casters.push(sm); sm.userData.owner = null;
  }
  m.renderOrder = order++;
  if (casters.length && casters[casters.length - 1].userData.owner === null) casters[casters.length - 1].userData.owner = m;
  parent.add(m); sprites.push(m);
  return m;
}
// raised layers are pulled toward the camera axis and shrunk so that, at rest, each lands exactly where the comp has it
function placeSprites(ax, lift) {
  for (const m of sprites) {
    const e = m.userData, z = m.onDesk ? e.z * lift : e.z, k = (D - z) / D;
    let px = m.cx + m.off.x, py = m.cy + m.off.y;
    if (m.rot && m.pivot) {                                  // turn around the sheet itself, not the whole layer
      const c = Math.cos(m.rot), s = Math.sin(m.rot), vx = -m.pivot.x, vy = -m.pivot.y;
      px += m.pivot.x + vx * c + vy * s; py += m.pivot.y - vx * s + vy * c;
    }
    m.position.set(ax + (px - ax) * k, -D + (-py + D) * k, z); m.rotation.z = m.rot || 0;
    m.scale.set(e.w * m.pad[0] * k, e.h * m.pad[1] * k, 1);
  }
  for (const s of casters) { const { e, K, cx, cy, owner } = s.userData; s.scale.set(e.w * K, e.h * K, 1);
    if (owner) s.position.set(cx + owner.off.x, -(cy + owner.off.y), 0); }
}
const _v = new THREE.Vector3();
function updateShadows() {
  for (const s of casters) {
    const { e, su, cx, cy, U } = s.userData, L = U.uLight.value;
    const z = e.z - s.userData.recvZ, lz = Math.max(L.z - e.z, 40);
    let ox = (cx - L.x) * z / lz, oy = (-cy - L.y) * z / lz;
    const lim = Math.min(e.w, e.h) * .32 + 6; const len = Math.hypot(ox, oy); if (len > lim) { ox *= lim / len; oy *= lim / len; }
    su.uOff.value.set(ox / e.w, oy / e.h);
    let near = 1;
    if (U === common) { _v.set(cx - L.x, -cy - L.y, e.z - L.z).normalize(); near = THREE.MathUtils.smoothstep(_v.dot(U.uSpotDir.value), Math.cos(.75), Math.cos(.3)); }
    su.uOn.value = S.shadows * S.relight * (0.3 + 0.7 * near) * (S.normals ? 0 : 1);
  }
}

/* ---------- wall: the comp's clock, with flip cards laid over its windows while they turn ---------- */
const clock = new THREE.Group(); scene.add(clock);
const CLOCK_BODY = { x0: 884, x1: 1279, y0: 615, y1: 765 };              // design px, for clicks
const CARD_Y = 685.35, CARD_H = 59.3;                                     // card face; the stacked edges below stay from the photo
const texCache = new Map();
function cardTex(txt, w, h) {
  const key = txt + '|' + w;
  if (texCache.has(key)) return texCache.get(key);
  const s = 4, c = document.createElement('canvas'); c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, c.height); grd.addColorStop(0, '#1a1516'); grd.addColorStop(.48, '#120e0f'); grd.addColorStop(.52, '#0c0909'); grd.addColorStop(1, '#171213');
  g.fillStyle = grd; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 5 * s); g.fill();
  g.fillStyle = '#d8d3cb'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${53 * s}px Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const tw = g.measureText(txt).width, maxW = c.width * .86;
  g.save(); g.translate(c.width / 2, c.height * .53); g.scale(Math.min(1, maxW / tw), 1); g.fillText(txt, 0, 0); g.restore();
  g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(0, c.height / 2 - s * .6, c.width, s * 1.2);   // split line
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); return t;
}
function halfGeo(w, h, top, mirror) {           // plane hinged at y=0, extending up (top) or down
  const g = new THREE.PlaneGeometry(w, h / 2);
  g.translate(0, top ? h / 4 : -h / 4, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i), v = uv.getY(i);
    v = top ? .5 + v * .5 : v * .5;
    if (mirror) { u = 1 - u; v = .5 - (v - .5); }   // back of the falling leaf shows next card's bottom half
    uv.setXY(i, u, v);
  }
  return g;
}
class Flip {
  constructor(cx, w, h, cur) {
    this.w = w; this.h = h; this.cur = cur; this.final = cur; this.queue = []; this.t = 1;
    const mk = () => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    this.g = new THREE.Group(); this.g.position.copy(W(cx, CARD_Y, 1)); clock.add(this.g);
    this.topS = new THREE.Mesh(halfGeo(w, h, true), mk());
    this.botS = new THREE.Mesh(halfGeo(w, h, false), mk());
    this.leaf = new THREE.Group(); this.leaf.position.z = .6;
    this.front = new THREE.Mesh(halfGeo(w, h, true), mk());
    this.back = new THREE.Mesh(halfGeo(w, h, true, true), mk()); this.back.rotation.y = Math.PI;
    this.leaf.add(this.front, this.back);
    this.g.add(this.topS, this.botS, this.leaf);
    [this.topS, this.botS, this.front, this.back].forEach((m, i) => m.renderOrder = 60 + (i > 1 ? 1 : 0));
    this.set(cur, cur); this.g.visible = false;
  }
  set(cur, next) {
    this.topS.material.map = cardTex(next, this.w, this.h);
    this.botS.material.map = cardTex(cur, this.w, this.h);
    this.front.material.map = cardTex(cur, this.w, this.h);
    this.back.material.map = cardTex(next, this.w, this.h);
    [this.topS, this.botS, this.front, this.back].forEach(m => m.material.needsUpdate = true);
  }
  push(vals) { this.queue.push(...vals); this.g.visible = true; }
  tick(dt) {
    if (this.t >= 1) {
      if (!this.queue.length) { if (this.cur === this.final) this.g.visible = false; return; }   // at rest the photo shows again
      this.next = this.queue.shift(); this.set(this.cur, this.next); this.t = 0; window.tick?.();
    }
    this.t = Math.min(1, this.t + dt / .16);
    const e = this.t * this.t;
    this.leaf.rotation.x = e * Math.PI;
    const shade = 1 - .45 * Math.sin(e * Math.PI);                       // the leaf darkens as it turns edge-on
    this.front.material.color.setScalar(shade); this.back.material.color.setScalar(shade);
    if (this.t >= 1) { this.cur = this.next; this.set(this.cur, this.cur); this.leaf.rotation.x = 0; }
  }
}
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const units = [
  new Flip(966.3, 99, CARD_H, 'JAN'),
  new Flip(1070.1, 76.7, CARD_H, '15'),
  new Flip(1184.8, 120.7, CARD_H, '2027'),
];
function spin() {
  const r = (a, n) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]);
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const yrs = ['1976','1983','1991','2001','2014','2020','2026'];
  units[0].push([...r(MONTHS, 7), 'JAN']);
  units[1].push([...r(days, 10), '15']);
  units[2].push([...r(yrs, 13), '2027']);
}
function wallCopy() {}                                                     // the comp's own subheader is a wall sprite now

/* ---------- build from manifest ---------- */
const man = await (await fetch('/assets/manifest.json')).json();
await Promise.race([document.fonts.load('800 30px "Barlow Condensed"'), new Promise(r => setTimeout(r, 2500))]);
await document.fonts.load('600 60px "Barlow Condensed"').catch(() => {});
for (const e of man.wall) addSprite(e, scene, wallU, 0);
wallCopy();
// dust motes drifting through the beam (brightness comes from the same sun mask)
const DUST = 260, dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) { dpos[i*3] = 560 + Math.random() * 1150; dpos[i*3+1] = -(20 + Math.random() * 900); dpos[i*3+2] = 20 + Math.random() * 380; dseed[i] = Math.random(); }
const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dg.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
const dustU = { uTime: wallU.uTime, sunMap: wallU.sunMap, uLevel: wallU.uSunLevel, uOn: { value: 1 }, uPx: { value: 1 } };
const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dustU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vA; varying vec2 vS;
    void main(){ vec3 p = position; float t = uTime * (.25 + seed * .35) + seed * 50.;
      p.x += sin(t * .7) * 26. + t * 3.; p.y += sin(t * .5 + seed * 9.) * 18. - mod(t * 6., 60.) + 30.; p.z += cos(t * .6) * 14.;
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.4 + seed * 2.6) * uPx * 420. / -mv.z;
      vS = vec2((p.x + 66.) / 1859., 1. + p.y / 1038.); vA = .35 + .65 * (.5 + .5 * sin(uTime * (1. + seed * 2.) + seed * 30.)); }`,
  fragmentShader: `uniform sampler2D sunMap; uniform float uLevel, uOn; varying float vA; varying vec2 vS;
    void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .1, d);
      float m = texture2D(sunMap, clamp(vS, 0., 1.)).r;
      gl_FragColor = vec4(vec3(1., .9, .72) * a * m * vA * .55 * uLevel * uOn, 1.);
      #include <colorspace_fragment>
    }` }));
dust.renderOrder = 56; scene.add(dust);
order = 100;
// the desk is a real floor plane: its top edge meets the foot of the wall, it lies toward the viewer
const desk = new THREE.Group();
desk.position.set(0, -FRAME_H, 0); desk.rotation.x = -Math.PI / 2; scene.add(desk);
desk.updateMatrixWorld(true); common.uFrame.value.copy(desk.matrixWorld).invert();
for (const e of man.desk) addSprite(e, desk, common, 0);
const copy = sprites.find(m => m.userData.name === 'd29_tw_copy'), sheet = sprites.find(m => m.userData.name === 'd33_sheet');
const paper = [sheet, copy].filter(Boolean);
/* lamp beam: one continuous cone from the shade to where it lands — white and tight at the lamp,
   widening, warming to yellow and fading toward the pool at the target */
const PIVOT = W(240, 372, 0), REST = W(858, 405, 0);
const tw = sprites.find(m => m.userData.name === 'd28_typewriter'), lampS = sprites.find(m => m.userData.name === 'd32_lamp');
const beamU = { uFrame: common.uFrame, uP: { value: new THREE.Vector2(PIVOT.x, PIVOT.y) }, uT: { value: new THREE.Vector2(REST.x, REST.y) },
                uOp: { value: .6 }, uTime: wallU.uTime };
const beam = new THREE.Mesh(new THREE.PlaneGeometry(3200, 1500), new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: vert,
  transparent: true, depthTest: false, depthWrite: false,
  fragmentShader: `uniform vec2 uP, uT; uniform float uOp, uTime; varying vec2 vUv; varying vec3 vW;
    void main(){
      vec2 ax = uT - uP; float len = length(ax); vec2 d = ax / len;
      vec2 P0 = uP + d * 48.;                                   // start at the rim of the shade
      vec2 q = vW.xy - P0; float L = len - 48.;
      float t = dot(q, d) / L, r = abs(q.x * d.y - q.y * d.x);
      float w = mix(30., 250., clamp(t, 0., 1.15));             // cone widens toward the target
      float along = smoothstep(-.02, .04, t) * mix(1., .5, clamp(t, 0., 1.)) * exp(-pow(max(t - 1., 0.), 2.) * 9.);
      float beamI = along * exp(-pow(r / w, 2.) * 1.7);
      float pool = .6 * exp(-dot(vW.xy - uT, vW.xy - uT) / (250. * 250.));   // soft landing, joined to the cone
      float I = max(beamI, pool);
      vec3 col = mix(vec3(1., .98, .93), vec3(.95, .80, .52), smoothstep(0., 1., clamp(t, 0., 1.)));
      gl_FragColor = vec4(col, clamp(I, 0., 1.) * uOp);
      #include <colorspace_fragment>
    }` }));
beam.position.set(FRAME_W / 2, -FRAME_H / 2, 0); beam.renderOrder = tw.renderOrder - 1.5; desk.add(beam);   // under the typewriter and its sheet: they stay the hero                             // “Be Part of Metro Rewind” sheet in the typewriter
/* coffee steam: two soft, curling wisp layers rising off the cup toward the camera */
const STEAM_C = W(1068, 596, 0);
const steamMat = (seed, scale, speed, op) => new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uTime: wallU.uTime, uSeed: { value: seed }, uScale: { value: scale }, uSpeed: { value: speed }, uOp: { value: op }, uOn: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float uTime, uSeed, uScale, uSpeed, uOp, uOn; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + 1.7; a *= .5; } return v; }
    void main(){
      vec2 p = (vUv - .5) * 2.;                                   // -1..1 around the cup
      float t = uTime * uSpeed + uSeed;
      p += vec2(.18, .28) * (length(p) * .8);                     // plume leans with a faint room draft
      float r = length(p), ang = atan(p.y, p.x);
      vec2 q = vec2(ang * 1.2 + sin(t * .3) * .6, r * 2.6 - t * .55);   // rings travel outward = rising toward us
      vec2 w = vec2(fbm(q * uScale + t * .12), fbm(q * uScale - t * .1 + 4.3));
      float d = fbm(q * uScale * 1.3 + w * 2.2 + vec2(0., -t * .35));
      float wisps = smoothstep(.48, .78, d);
      float fall = smoothstep(1., .25, r) * smoothstep(.02, .22, r);     // born over the coffee, gone before the rim of the quad
      float flick = .8 + .2 * sin(t * 1.7 + ang * 3.);
      gl_FragColor = vec4(vec3(1., .985, .96), wisps * fall * flick * uOp * uOn);
      #include <colorspace_fragment>
    }` });
const steam = [ [ 7.1, 1.1, .9, .5, 260, 30 ], [ 2.3, 1.6, .7, .34, 360, 75 ] ].map(([seed, sc, sp, op, size, z]) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), steamMat(seed, sc, sp, op));
  m.position.set(STEAM_C.x, STEAM_C.y, z); m.userData.z = z; m.renderOrder = 400; desk.add(m); return m;
});
/* typing: the sheet feeds up out of the platen, the carriage steps left one letter at a time, returns, feeds a line */
const TY = (() => {
  const e = copy.userData, L = e.lines, xT = e.x + e.w / 2;
  const lineY = l => e.y + (l.v0 + l.v1) / 2 * e.h, yT = lineY(L[2]);
  const ev = []; let t = 0;
  const dyOf = i => yT - lineY(L[i]), dxOf = (i, k) => xT - (e.x + (L[i].u0 + (L[i].u1 - L[i].u0) * k / L[i].n) * e.w);
  ev.push({ t, dur: .8, from: { x: dxOf(0, 0), y: dyOf(0) + 170 }, to: { x: dxOf(0, 0), y: dyOf(0) }, line: 0, u: 0 }); t += .95;
  L.forEach((l, i) => {
    for (let k = 0; k < l.n; k++) {
      const d = .07 + Math.random() * .05;
      ev.push({ t, dur: d * .45, from: { x: dxOf(i, k), y: dyOf(i) }, to: { x: dxOf(i, k + 1), y: dyOf(i) }, line: i, u: l.u0 + (l.u1 - l.u0) * (k + 1) / l.n, strike: true });
      t += d;
    }
    t += .18;
    const last = i === L.length - 1;
    ev.push({ t, dur: last ? .7 : .42, from: { x: dxOf(i, l.n), y: dyOf(i) }, to: last ? { x: 0, y: 0 } : { x: dxOf(i + 1, 0), y: dyOf(i + 1) }, line: last ? 9 : i + 1, u: last ? 1 : 0, bell: true });
    t += last ? .7 : .55;
  });
  const maxX = Math.max(...ev.flatMap(v => [Math.abs(v.from.x), Math.abs(v.to.x)])), kx = Math.min(1, sheet.userData.w * .1 / maxX);
  ev.forEach(v => { v.from.x *= kx; v.to.x *= kx; });
  return { ev, total: t };
})();
let typeT = -1, typeDone = false, evIdx = 0;
/* arrival: lamp clicks on, chair slides in under the desk, the Metrorail map drops into its folder, the SmarTrip card nudges up */
const byName = n => sprites.find(m => m.userData.name === n);
// paper-straightening keyframes: each tap drops the sheet a little and flicks the angle the other way
const TAPS = [{ x: -6, y: -130, r: 0 }, { x: 4, y: -92, r: .085 }, { x: -3, y: -56, r: -.065 }, { x: 2, y: -24, r: .04 }, { x: 0, y: -6, r: -.018 }, { x: 0, y: 0, r: 0 }];
function tapIn(k) {
  const n = TAPS.length - 1, f = Math.min(k, .9999) * n, i = Math.floor(f), u = f - i;
  const snap = 1 - Math.pow(1 - Math.min(1, u / .32), 3);          // quick flick, then rest until the next tap
  const a = TAPS[i], b = TAPS[i + 1];
  return k >= 1 ? { x: 0, y: 0, rot: 0 } : { x: a.x + (b.x - a.x) * snap, y: a.y + (b.y - a.y) * snap, rot: a.r + (b.r - a.r) * snap };
}
const MOVERS = [
  { m: byName('d00b_chair'), from: { x: 0, y: 0 }, to: { x: 0, y: -152 }, t0: .25, dur: 1.3 },          // comp position → seat under the desk, backrest against its edge
  { m: byName('d21b_map'), t0: .4, dur: 1.5, path: k => tapIn(k), pivot: { x: 10, y: -74 } },   // squared up like tapping papers: snap, tilt, snap
].filter(v => v.m);
// loose pieces start scattered (position + angle) and tidy themselves into the comp layout on arrival
const LOOSE = ['d07_img10', 'd11_photocard', 'd12_photo', 'd13_img9', 'd14_puzzle', 'd19_photo', 'd20_metrocard'].map(byName).filter(Boolean)
  .map((m, i) => ({ m, t0: .3 + i * .09, dur: .9 + Math.random() * .3, from: null }));
function scatter() {
  for (const v of LOOSE) {
    const sgn = Math.random() < .5 ? -1 : 1;             // only a slight twist: they square up in place
    v.from = { x: 0, y: 0, rot: sgn * (.05 + Math.random() * .07) };
  }
}
scatter();
const easeOutBack = k => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
let arriveT = -1, lampOn = false, lampLevel = 0, flickUntil = 0;
const easeOut = k => 1 - Math.pow(1 - k, 3);
function placeMovers(k0) {
  for (const v of MOVERS) {
    const r = k0 === undefined ? 0 : Math.min(1, Math.max(0, (k0 - v.t0) / v.dur));
    if (v.path) { const q = v.path(r); v.m.off.x = q.x; v.m.off.y = q.y; v.m.rot = q.rot || 0; v.m.pivot = v.pivot; continue; }
    const k = easeOut(r); v.m.off.x = v.from.x + (v.to.x - v.from.x) * k; v.m.off.y = v.from.y + (v.to.y - v.from.y) * k;
  }
  for (const v of LOOSE) {
    const r = k0 === undefined ? 0 : Math.min(1, Math.max(0, (k0 - v.t0) / v.dur)), k = r >= 1 ? 1 : easeOutBack(r);
    v.m.off.x = v.from.x * (1 - k); v.m.off.y = v.from.y * (1 - k); v.m.rot = v.from.rot * (1 - k);
  }
}
placeMovers();
function setLamp(on, t) { lampOn = on; if (on) flickUntil = t + .45; window.tick?.(); }
const HEAD = W(240, 372, 0);                                             // lamp shade, desk-local
function setType(line, u, off) {
  for (const m of paper) { m.off.x = off.x; m.off.y = off.y; }
  const U = copy.material.uniforms; U.uTypeOn.value = line < 9 ? 1 : 0; U.uTypeLine.value = line; U.uTypeU.value = u;
}
function typeTick(dt) {
  if (typeT < 0) return;
  typeT += dt;
  while (evIdx < TY.ev.length - 1 && typeT >= TY.ev[evIdx + 1].t) { evIdx++; const n = TY.ev[evIdx]; if (n.strike) window.tick?.(); if (n.bell) window.ding?.(); }
  const e = TY.ev[evIdx], k = Math.min(1, Math.max(0, (typeT - e.t) / e.dur)), q = 1 - Math.pow(1 - k, 3);
  const prevLine = evIdx > 0 ? TY.ev[evIdx - 1] : e;
  setType(e.strike ? e.line : (k < 1 ? prevLine.line : e.line), e.strike ? e.u : (k < 1 ? prevLine.u : e.u),
          { x: e.from.x + (e.to.x - e.from.x) * q, y: e.from.y + (e.to.y - e.from.y) * q });
  if (typeT >= TY.total) { typeT = -1; typeDone = true; setType(9, 1, { x: 0, y: 0 }); }
}
function resetType() { arriveT = -1; scatter(); placeMovers(); lampOn = false; lampLevel = 0; typeDone = false; typeT = -1; evIdx = 0; const f = TY.ev[0]; setType(0, 0, f.from); }
resetType();
const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), FRAME_H);   // y = -FRAME_H
// room shell so the swing never shows the void: wall continues past the art, floor runs under the desk
const shellWall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 5000), new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(142,106,82)'), depthTest: false }));
shellWall.position.set(FRAME_W / 2, -FRAME_H + 2500, -2); shellWall.renderOrder = -2; scene.add(shellWall);
const shellFloor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(118,89,75)'), depthTest: false }));
shellFloor.rotation.x = -Math.PI / 2; shellFloor.position.set(FRAME_W / 2, -FRAME_H - 1, 3000); shellFloor.renderOrder = 99; scene.add(shellFloor);

/* ---------- post pass: fisheye + vertical motion blur, both zero at rest ---------- */
const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
const post = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture }, uK: { value: 0 }, uBlur: { value: 0 }, uAspect: { value: 1 }, uResY: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uK, uBlur, uAspect, uResY; varying vec2 vUv;
    vec2 distort(vec2 uv){
      vec2 p = uv - .5; p.x *= uAspect;
      float f = (1. + uK * dot(p, p)) / (1. + uK * .25 * (uAspect * uAspect + 1.));   // corners pinned, centre magnified
      p *= f; p.x /= uAspect; return p + .5;
    }
    void main(){
      vec2 uv = distort(vUv); float rad = uBlur / uResY; vec4 acc = vec4(0.);
      for (int i = 0; i < 9; i++) { float o = (float(i) / 8. - .5) * 2. * rad; acc += texture2D(tDiffuse, vec2(uv.x, clamp(uv.y + o, 0., 1.))); }
      gl_FragColor = acc / 9.;
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

/* ---------- layout ---------- */
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = a;
  // 90° keeps the cube tiling; wider-than-comp screens narrow it just enough to still cover the width
  camera.fov = a > FRAME_W / FRAME_H ? THREE.MathUtils.radToDeg(2 * Math.atan(FRAME_W / a / 2 / D)) : 90;
  camera.updateProjectionMatrix();
  VW = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * a;
  pan = Math.max(12, (FRAME_W - VW) / 2);
  const pr = renderer.getPixelRatio(); rt.setSize(w * pr, h * pr); post.uniforms.uAspect.value = a; post.uniforms.uResY.value = h * pr;
}
addEventListener('resize', resize); resize();

/* ---------- input ---------- */
addEventListener('pointermove', ev => {
  if (ev.pointerType !== 'mouse') return;                 // hover parallax is for mice; touch pans by dragging
  mouse.tx = ev.clientX / innerWidth * 2 - 1; mouse.ty = ev.clientY / innerHeight * 2 - 1;
  mouse.px = ev.clientX / innerWidth; mouse.py = ev.clientY / innerHeight; mouse.has = true; mouse.last = clk ? clk.elapsedTime : 0;
}, { passive: true });
const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; scrollP = max > 0 ? scrollY / max : 0; };
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function overClock() {
  if (viewT > .3) return false;
  const h = ray.ray.intersectPlane(wallPlane, new THREE.Vector3()); if (!h) return false;
  return h.x > CLOCK_BODY.x0 && h.x < CLOCK_BODY.x1 && -h.y > CLOCK_BODY.y0 && -h.y < CLOCK_BODY.y1;
}
function overHead() {                                     // is the pointer on the lamp shade?
  const hit = ray.ray.intersectPlane(deskPlane, new THREE.Vector3()); if (!hit) return false;
  desk.worldToLocal(hit); return Math.hypot(hit.x - HEAD.x, hit.y - HEAD.y) < 80;
}
let tween = null;
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
function goTo(p, dur = 2.2) {
  if (reduce) { scrollTo(0, p * maxScroll()); return; }
  tween = { from: scrollY, to: p * maxScroll(), t: 0, dur };
}
const stopTween = () => { tween = null; };
addEventListener('wheel', stopTween, { passive: true }); addEventListener('touchstart', stopTween, { passive: true });
/* drag to move: mouse drag or finger/trackpad swipe. Vertical travels the wall→desk move, horizontal pans across the frame */
let dragPan = 0, panVel = 0, scrollVel = 0, drag = null, dragMoved = false;
canvas.addEventListener('pointerdown', ev => {
  if (ev.button > 0) return;
  drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now(), type: ev.pointerType }; dragMoved = false; tween = null; panVel = scrollVel = 0;
  if (ev.pointerType === 'mouse') canvas.setPointerCapture(ev.pointerId);
});
canvas.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
  if (!dragMoved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) dragMoved = true;
  const ux = VW / innerWidth;                                   // screen px → design px
  dragPan -= dx * ux; panVel = -dx * ux / dt * 16;
  if (drag.type === 'mouse') { const k = 1.6; scrollBy(0, -dy * k); scrollVel = -dy * k / dt * 16; }   // touch scrolls natively
  drag.x = ev.clientX; drag.y = ev.clientY; drag.t = now;
  if (dragMoved) canvas.style.cursor = 'grabbing';
});
const endDrag = ev => { if (drag && ev.pointerId === drag.id) { drag = null; canvas.style.cursor = ''; } };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
addEventListener('wheel', ev => { if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) { dragPan += ev.deltaX * VW / innerWidth; panVel = 0; } }, { passive: true });   // trackpad sideways swipe
canvas.addEventListener('click', ev => {
  if (dragMoved) { dragMoved = false; return; }             // a drag is not a click
  ndc.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight * 2 - 1)); ray.setFromCamera(ndc, camera);
  if (overClock()) { spin(); return; }
  if (viewT > .9 && overHead()) { setLamp(!lampOn, clk.elapsedTime); return; }
  if (viewT > .9 && ray.intersectObjects(paper).length) { window.openStories?.(); return; }
  if (viewT < .5) goTo(1);            // click the wall: play the full tilt down
});
addEventListener('stories', ev => { modalOpen = ev.detail; });
canvas.addEventListener('pointermove', ev => {
  ndc.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight * 2 - 1)); ray.setFromCamera(ndc, camera);
  const over = (viewT > .9 && (overHead() || ray.intersectObjects(paper).length)) || overClock() || viewT < .5;
  canvas.style.cursor = over ? 'pointer' : '';
});
addEventListener('keydown', ev => { if (modalOpen || ev.target.closest?.('input,textarea,select')) return; if (ev.key === 'ArrowDown' || ev.key === 'PageDown') { ev.preventDefault(); goTo(1); } if (ev.key === 'ArrowUp' || ev.key === 'PageUp') { ev.preventDefault(); goTo(0); } });
const tog = (id, k) => { const b = document.getElementById(id); b.addEventListener('click', () => { S[k] = S[k] ? 0 : 1; b.setAttribute('aria-pressed', !!S[k]); }); };

const back = document.getElementById('back'), hint = document.getElementById('hint'), wallcard = document.getElementById('wallcard');
document.getElementById('scrollDown').addEventListener('click', () => goTo(1));
back.addEventListener('click', () => goTo(0));

/* ---------- loop ---------- */
const clk = new THREE.Clock();
let started = false;
mgr.onLoad = () => { document.getElementById('loading').classList.add('done'); if (!started) { started = true; setTimeout(spin, 500); } };
function frame() {
  const dt = Math.min(clk.getDelta(), .05), t = clk.elapsedTime;
  const ease = reduce ? 1 : 1 - Math.pow(.001, dt);
  mouse.x += (mouse.tx - mouse.x) * ease; mouse.y += (mouse.ty - mouse.y) * ease;
  // scripted transitions drive the real scroll position, so scroll and click share one timeline
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const k = tween.t < .5 ? 4 * tween.t ** 3 : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
    scrollTo(0, tween.from + (tween.to - tween.from) * k);
    if (tween.t >= 1) tween = null;
  }
  sm += (scrollP - sm) * (reduce ? 1 : 1 - Math.pow(1 - SMOOTH, dt * 60));
  const vel = sm - prevSm; prevSm = sm;
  const rampT = Math.min(1, Math.max(0, (sm - HOLD_END) / (MOVE_END - HOLD_END)));
  viewT = rampT < .5 ? 4 * rampT ** 3 : 1 - Math.pow(-2 * rampT + 2, 3) / 2;          // easeInOutCubic
  const e = viewT;
  // coast after a flick, then keep the pan inside the frame
  if (!drag) { dragPan += panVel; panVel *= Math.pow(.9, dt * 60); if (Math.abs(scrollVel) > .5) { scrollBy(0, scrollVel); scrollVel *= Math.pow(.9, dt * 60); } else scrollVel = 0; }
  const panMax = Math.max(0, (FRAME_W - VW) / 2) + 40;
  if (dragPan > panMax) { dragPan += (panMax - dragPan) * .2; panVel = 0; } else if (dragPan < -panMax) { dragPan += (-panMax - dragPan) * .2; panVel = 0; }
  const cx = FRAME_W / 2 + dragPan + mouse.x * Math.min(pan, 24);   // drag/swipe pan + a touch of hover parallax
  camera.position.set(cx + mouse.x * 6, -D - mouse.y * 4, D);
  camera.rotation.set(-Math.PI / 2 * e, 0, 0);            // 0° wall → 90° desk
  camera.updateMatrixWorld();
  // desk objects rest flat while seen edge-on, and rise to their heights as the view turns overhead
  const lift = THREE.MathUtils.smoothstep(e, .35, .95);
  placeSprites(cx, lift);
  const bell = Math.sin(Math.PI * e);
  post.uniforms.uK.value = reduce ? 0 : K_MAX * bell;
  post.uniforms.uBlur.value = reduce || e <= 0 || e >= 1 ? 0 : Math.min(Math.pow(bell, 1.5) * BLUR_MAX + Math.min(Math.abs(vel) * 900, 12), BLUR_CAP) * renderer.getPixelRatio();
  // sunlight breathing: slow cloud drift plus a faint flutter, shared by wall, dust and the clock's shadow
  const sunLevel = reduce ? 1 : 1 + .05 * Math.sin(t * .31) + .035 * Math.sin(t * .83 + 1.3) + .018 * Math.sin(t * 2.3 + .4) - .06 * Math.max(0, Math.sin(t * .09 - 1)) ** 3;
  wallU.uTime.value = reduce ? 0 : t; wallU.uSunLevel.value = sunLevel;
  dustU.uOn.value = (reduce ? 0 : 1) * (1 - e) * S.relight * (S.normals ? 0 : 1); dustU.uPx.value = renderer.getPixelRatio();
  // wall light: low sun from upper-left, nudged by cursor
  wallU.uLight.value.set(-900 + mouse.x * 700, 1100 - mouse.y * 500, 2400);
  const wl = wallU.uLight.value;
  // desk lamp light: rests over the typewriter, follows the cursor while the desk is in view
  const deskIn = viewT > .7 ? 1 : 0;
  const flick = reduce ? 0 : Math.sin(t * 7.3) * .01 + Math.sin(t * 2.1) * .012, flickFx = flick * 2;
  // desk lamp: the light stays under the shade; the cursor swings where it points
  const LAMP = W(240, 372, 118), rest = W(858, 405, 0);     // desk-local; resting aim = the typewriter sheet
  let ax = rest.x, ay = rest.y;
  if (false) {                                             // cursor-aimed lamp disabled for now
    ndc.set(mouse.px * 2 - 1, -(mouse.py * 2 - 1)); ray.setFromCamera(ndc, camera);
    const hit = ray.ray.intersectPlane(deskPlane, new THREE.Vector3());
    if (hit) { desk.worldToLocal(hit); ax = hit.x; ay = hit.y; }
  }
  // keep the aim in front of the lamp, within the arm's reach
  _v.set(ax - LAMP.x, ay - LAMP.y, 0); const r = Math.min(Math.max(_v.length(), 160), 1150); _v.setLength(r);
  aim.x += (LAMP.x + _v.x - aim.x) * ease * .5; aim.y += (LAMP.y + _v.y - aim.y) * ease * .5;
  common.uLight.value.copy(LAMP);
  common.uSpotDir.value.set(aim.x - LAMP.x, aim.y - LAMP.y, -LAMP.z).normalize();
  beamU.uT.value.set(aim.x, aim.y);
  beamU.uOp.value = .85 * S.relight * lampLevel * (reduce ? 1 : 1 + flickFx);
  common.uKey.value = (.24 + flick * 2) * lampLevel;
  common.uRelight.value = S.relight; common.uNormals.value = S.normals;
  updateShadows();
  for (const u of units) u.tick(dt);
  if (viewT > .97 && arriveT < 0) {
    arriveT = 0; setLamp(true, t);
    if (reduce) { placeMovers(99); typeDone = true; setType(9, 1, { x: 0, y: 0 }); arriveT = 99; }
  }
  if (arriveT >= 0 && arriveT < 99) {
    arriveT += dt; placeMovers(arriveT);
    if (arriveT > 1.1 && typeT < 0 && !typeDone) { typeT = 0; evIdx = 0; }
    if (arriveT > 3.2) { placeMovers(99); arriveT = 99; }
  }
  if (viewT < .2 && arriveT >= 0) resetType();
  typeTick(dt);
  // lamp level: off until the desk arrives; switching on stutters for a moment like a real bulb
  const flickOn = t < flickUntil ? (Math.sin(t * 90) > .2 ? 1 : .15) : 1;
  lampLevel += ((lampOn ? flickOn : 0) - lampLevel) * (t < flickUntil ? 1 : 1 - Math.pow(.0001, dt));
  common.uAmb.value = .76 + .21 * lampLevel;
  back.classList.toggle('show', viewT > .95);
  for (const m of steam) { m.material.uniforms.uOn.value = THREE.MathUtils.smoothstep(viewT, .6, 1); m.position.z = m.userData.z * THREE.MathUtils.smoothstep(viewT, .35, .95); }
  wallcard.classList.toggle('gone', viewT > .06);
  hint.style.opacity = viewT > .03 ? 0 : 1;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}
frame();
window.__ready = true;
