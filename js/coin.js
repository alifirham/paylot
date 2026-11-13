// PAYLOT 3D coin — built procedurally, no external models or HDR files.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LIME = 0xb8ff2e;
const BG = 0x0c0e10;

// ---------- Coin dimensions (world units, radius = 1) ----------
const FIELD_Z = 0.06;   // flat face height
const RIM_Z = 0.1;      // raised rim height
const EDGE_Z = 0.075;   // reeded edge half height

// ---------- The P-arrow symbol (same numbers as assets/logo.svg, 64-unit box) ----------
function symbolShapes() {
  const S = 0.0185, CX = 31.5, CY = 32;
  const P = (x, y) => new THREE.Vector2((x - CX) * S, -(y - CY) * S);
  const sw = 8.5, stemX = 15.5, cx = 34, cy = 23.5, r = 13.5;
  const top = cy - r, bot = cy + r;
  const tipX = stemX + sw / 2 + 3.2, baseX = tipX + 10, hw = 8.5;

  const stem = new THREE.Shape([
    P(stemX - sw / 2, top - sw / 2), P(stemX + sw / 2, top - sw / 2),
    P(stemX + sw / 2, 58), P(stemX - sw / 2, 58),
  ]);

  const R1 = r + sw / 2, R0 = r - sw / 2, pts = [];
  pts.push(P(stemX, top - sw / 2));
  for (let i = 0; i <= 48; i++) {           // outer arc, top → bottom (right side)
    const a = -Math.PI / 2 + Math.PI * (i / 48);
    pts.push(P(cx + R1 * Math.cos(a), cy + R1 * Math.sin(a)));
  }
  pts.push(P(baseX, bot + sw / 2), P(baseX, bot - sw / 2));
  for (let i = 0; i <= 48; i++) {           // inner arc, bottom → top
    const a = Math.PI / 2 - Math.PI * (i / 48);
    pts.push(P(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)));
  }
  pts.push(P(stemX, top + sw / 2));
  const bowl = new THREE.Shape(pts);

  const head = new THREE.Shape([P(baseX, bot - hw), P(tipX, bot), P(baseX, bot + hw)]);
  return [stem, bowl, head];
}

// Inverse of three.js NeutralToneMapping for very dark colours (the toe region)
function inverseNeutralToneMap(color) {
  const c = color.clone(); // working (linear) values
  const m = Math.sqrt(Math.min(c.r, c.g, c.b) / 6.25);
  const o = m - Math.min(c.r, c.g, c.b);
  c.r += o; c.g += o; c.b += o;
  return c;
}

function buildCoin({ mobile }) {
  const group = new THREE.Group();

  const metal = new THREE.MeshPhysicalMaterial({
    color: 0x5a6068, metalness: 1, roughness: 0.35,
    clearcoat: 0.35, clearcoatRoughness: 0.25,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x1a2408, emissive: LIME, emissiveIntensity: 0.85, metalness: 0.6, roughness: 0.4,
  });
  const rimGlow = new THREE.MeshBasicMaterial({ color: LIME, toneMapped: false });

  // Body: lathe profile with flat field, raised bevelled rim
  const profile = [
    [0, -FIELD_Z], [0.8, -FIELD_Z], [0.84, -RIM_Z], [0.95, -RIM_Z], [0.995, -EDGE_Z],
    [0.995, EDGE_Z], [0.95, RIM_Z], [0.84, RIM_Z], [0.8, FIELD_Z], [0, FIELD_Z],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(profile, mobile ? 96 : 160);
  body.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(body, metal));

  // Reeded edge: open cylinder with ridges pushed out
  const ridges = 120;
  const edge = new THREE.CylinderGeometry(1, 1, EDGE_Z * 2, ridges * 3, 1, true);
  const pos = edge.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.009 * Math.cos(a * ridges);
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  edge.computeVertexNormals();
  edge.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(edge, metal));

  // Glowing lime ring on the inner rim, both sides
  const ringGeo = new THREE.TorusGeometry(0.818, 0.008, 8, 160);
  [1, -1].forEach((side) => {
    const ring = new THREE.Mesh(ringGeo, rimGlow);
    ring.position.z = side * (FIELD_Z + 0.018);
    group.add(ring);
  });

  // Embossed symbol on both faces
  const shapes = symbolShapes();
  const depths = [0.03, 0.031, 0.032]; // tiny offsets avoid z-fighting where shapes overlap
  shapes.forEach((shape, i) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: depths[i], bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2,
      curveSegments: 8,
    });
    const front = new THREE.Mesh(geo, glow);
    front.position.z = FIELD_Z;
    group.add(front);
    const back = new THREE.Mesh(geo, glow);
    back.rotation.y = Math.PI;      // mirrored so it reads correctly from behind
    back.position.z = -FIELD_Z;
    group.add(back);
  });

  return group;
}

export async function initCoin({ canvas, mobile = false, finePointer = false, skipFpsCheck = false }) {
  const gsap = window.gsap;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Lime "coin light" + a cool key light for the gunmetal
  const limeLight = new THREE.PointLight(LIME, 2.2, 6, 2);
  scene.add(limeLight);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const pivot = new THREE.Group();   // positioned on the DOM anchor
  const tilt = new THREE.Group();    // mouse / device tilt
  const coin = buildCoin({ mobile });
  tilt.add(coin);
  pivot.add(tilt);
  scene.add(pivot);

  // Bloom (desktop only)
  let composer = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.35, 0.72));
    composer.addPass(new OutputPass());
    // OutputPass tone-maps the background too. Pre-compensate so the page colour stays exactly #0C0E10.
    scene.background = inverseNeutralToneMap(new THREE.Color(BG));
  }

  // ---------- Size + anchor mapping ----------
  let W = 0, H = 0, unitPerPx = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    composer?.setSize(W, H);
    composer?.setPixelRatio?.(dpr);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    unitPerPx = visibleH / H;
  }
  resize();
  window.addEventListener('resize', resize);

  let anchor = document.querySelector('[data-coin-anchor="hero"]');
  const anim = { drop: 0, spin: 0, scale: 1 };   // driven by GSAP
  const pointer = { x: 0, y: 0 };                 // -1..1
  const tiltNow = { x: 0, y: 0 };

  function placeOnAnchor() {
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    pivot.position.set((cx - W / 2) * unitPerPx, -(cy - H / 2) * unitPerPx, 0);
    const s = (r.width / 2) * unitPerPx * 0.94;
    pivot.scale.setScalar(s * anim.scale);
    limeLight.position.set(pivot.position.x - s * 1.4, pivot.position.y + s * 0.6, s * 2.2);
    return r.bottom > -40 && r.top < H + 40;
  }

  // ---------- Input: mouse (desktop) / device orientation (where no permission is needed) ----------
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / W) * 2 - 1;
      pointer.y = (e.clientY / H) * 2 - 1;
    }, { passive: true });
  } else if (typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      pointer.x = THREE.MathUtils.clamp(e.gamma / 35, -1, 1);
      pointer.y = THREE.MathUtils.clamp((e.beta - 45) / 35, -1, 1);
    }, { passive: true });
  }

  // ---------- Render loop ----------
  const t0 = performance.now();
  let running = false, raf = 0, frames = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    const visible = placeOnAnchor();
    if (!visible && frames > 2) { stop(); return; }

    tiltNow.x += (pointer.y * 0.35 - tiltNow.x) * 0.06;
    tiltNow.y += (pointer.x * 0.5 - tiltNow.y) * 0.06;
    tilt.rotation.set(0.18 + tiltNow.x + Math.sin(t * 0.9) * 0.04, -0.42 + tiltNow.y + anim.spin, Math.sin(t * 0.6) * 0.03);
    coin.position.y = Math.sin(t * 1.2) * 0.04 + anim.drop;

    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++;
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // Resume when the anchor scrolls back into view; pause when the tab is hidden
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !document.hidden) start();
  }, { rootMargin: '40px' });
  io.observe(anchor);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  window.addEventListener('scroll', () => { if (!running && !document.hidden) placeOnAnchor() && start(); }, { passive: true });

  // ---------- Performance check: fall back if < 30 fps in the first second ----------
  start();
  const fpsOK = await new Promise((resolve) => {
    const f0 = frames;
    setTimeout(() => resolve(skipFpsCheck || frames - f0 >= 30), 1000);
  });

  function dispose() {
    stop(); io.disconnect();
    window.removeEventListener('resize', resize);
    renderer.dispose();
  }
  if (!fpsOK) { dispose(); return null; }

  return {
    drop() {
      if (!gsap) return;
      gsap.fromTo(anim, { drop: 4, spin: -Math.PI * 4, scale: 0.7 },
        { drop: 0, spin: 0, scale: 1, duration: 1.8, ease: 'expo.out' });
    },
    setAnchor(el) { anchor = el; io.disconnect(); io.observe(el); start(); },
    dispose,
  };
}
