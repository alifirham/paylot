// PAYLOT 3D stage: the procedural coin + the mascot that holds it.
// One transparent WebGL canvas, fixed behind the page content.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMascot, FIGURE_BOUNDS } from './mascot.js';

const LIME = 0xb8ff2e;

// ---------- Coin dimensions (radius = 1) ----------
const FIELD_Z = 0.06;   // flat face
const RIM_Z = 0.1;      // raised rim
const EDGE_Z = 0.075;   // reeded edge half height

// ---------- The P-arrow symbol (same numbers as assets/logo.svg, 64-unit box) ----------
export function symbolShapes() {
  const S = 0.0185, CX = 31.5, CY = 32;
  const P = (x, y) => new THREE.Vector2((x - CX) * S, -(y - CY) * S);
  const sw = 8.5, stemX = 15.5, cx = 34, cy = 23.5, r = 13.5;
  const top = cy - r, bot = cy + r;
  const tipX = stemX + sw / 2 + 3.2, baseX = tipX + 10, hw = 8.5;

  const stem = new THREE.Shape([
    P(stemX - sw / 2, top - sw / 2), P(stemX + sw / 2, top - sw / 2),
    P(stemX + sw / 2, 58), P(stemX - sw / 2, 58),
  ]);
  const R1 = r + sw / 2, R0 = r - sw / 2, pts = [P(stemX, top - sw / 2)];
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI / 2 + Math.PI * (i / 48);
    pts.push(P(cx + R1 * Math.cos(a), cy + R1 * Math.sin(a)));
  }
  pts.push(P(baseX, bot + sw / 2), P(baseX, bot - sw / 2));
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI / 2 - Math.PI * (i / 48);
    pts.push(P(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)));
  }
  pts.push(P(stemX, top + sw / 2));
  const bowl = new THREE.Shape(pts);
  const head = new THREE.Shape([P(baseX, bot - hw), P(tipX, bot), P(baseX, bot + hw)]);
  return [stem, bowl, head];
}

function stencilize(mat) {
  mat.stencilWrite = true;
  mat.stencilRef = 1;
  mat.stencilFunc = THREE.EqualStencilFunc;
  mat.stencilZPass = THREE.KeepStencilOp;
  return mat;
}

export function buildCoin({ mobile = false, stencil = false, variant = 'main' } = {}) {
  const group = new THREE.Group();
  const alt = variant === 'alt';
  const metal = new THREE.MeshPhysicalMaterial({
    color: alt ? 0x101214 : 0x5a6068, metalness: 1, roughness: alt ? 0.2 : 0.35,
    clearcoat: 0.35, clearcoatRoughness: 0.25,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x1a2408, emissive: LIME, emissiveIntensity: alt ? 1.2 : 0.85, metalness: 0.6, roughness: 0.4,
  });
  const rimGlow = new THREE.MeshBasicMaterial({ color: LIME, toneMapped: false });
  if (stencil) [metal, glow, rimGlow].forEach(stencilize);

  // Body: lathe profile with a flat field and a raised bevelled rim
  const profile = [
    [0, -FIELD_Z], [0.8, -FIELD_Z], [0.84, -RIM_Z], [0.95, -RIM_Z], [0.995, -EDGE_Z],
    [0.995, EDGE_Z], [0.95, RIM_Z], [0.84, RIM_Z], [0.8, FIELD_Z], [0, FIELD_Z],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(profile, mobile ? 96 : 160);
  body.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(body, metal));

  // Reeded edge
  const ridges = 120;
  const edge = new THREE.CylinderGeometry(1, 1, EDGE_Z * 2, ridges * 3, 1, true);
  const pos = edge.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const k = 1 + 0.009 * Math.cos(Math.atan2(z, x) * ridges);
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  edge.computeVertexNormals();
  edge.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(edge, metal));

  // Glowing ring on the inner rim, both faces
  const ringGeo = new THREE.TorusGeometry(0.818, 0.008, 8, 160);
  [1, -1].forEach((side) => {
    const ring = new THREE.Mesh(ringGeo, rimGlow);
    ring.position.z = side * (FIELD_Z + 0.018);
    group.add(ring);
  });

  // Embossed symbol, both faces
  symbolShapes().forEach((shape, i) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03 + i * 0.001, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 8,
    });
    const front = new THREE.Mesh(geo, glow);
    front.position.z = FIELD_Z;
    group.add(front);
    const back = new THREE.Mesh(geo, glow);
    back.rotation.y = Math.PI;
    back.position.z = -FIELD_Z;
    group.add(back);
  });
  return group;
}

// =====================================================================
//  Stage
// =====================================================================
export async function initCoin({ canvas, mobile = false, finePointer = false, skipFpsCheck = false }) {
  const gsap = window.gsap;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // Two scenes, same pose: main figure + alt figure revealed under the cursor
  function makeScene(variant) {
    const scene = new THREE.Scene();
    scene.environment = env;
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-4, 5, 6);
    scene.add(key);
    const lime = new THREE.PointLight(LIME, variant === 'main' ? 3 : 1.5, 10, 2);
    scene.add(lime);
    const rim = new THREE.DirectionalLight(variant === 'main' ? LIME : 0xffffff, 1.2);
    rim.position.set(5, 2, -4);
    scene.add(rim);
    const pivot = new THREE.Group();
    const fig = buildMascot(variant, { stencil: variant === 'alt', mobile });
    pivot.add(fig.root);
    scene.add(pivot);
    return { scene, pivot, lime, ...fig };
  }
  const A = makeScene('main');
  const B = makeScene('alt');
  const figures = [A, B];

  // Reveal mask (screen-space circle, drawn into the stencil buffer)
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const maskScene = new THREE.Scene();
  const mask = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, blending: THREE.NoBlending,
      depthTest: false, depthWrite: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    }),
  );
  maskScene.add(mask);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({ color: LIME, toneMapped: false, depthTest: false }));
  maskScene.add(ring);

  // ---------- Fit figure to its DOM box ----------
  let W = 0, H = 0, unitPerPx = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    unitPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / H;
    ortho.left = -W / 2; ortho.right = W / 2; ortho.top = H / 2; ortho.bottom = -H / 2;
    ortho.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const anchor = document.querySelector('[data-figure-anchor]');
  const anim = { rise: 0, spin: 0, scroll: 0 };
  let anchorRect = anchor.getBoundingClientRect();

  function place() {
    const r = anchor.getBoundingClientRect();
    anchorRect = r;
    const s = (r.width / FIGURE_BOUNDS.width) * unitPerPx;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    figures.forEach((f) => {
      f.pivot.scale.setScalar(s);
      f.pivot.position.set((cx - W / 2) * unitPerPx, -(cy - H / 2) * unitPerPx - FIGURE_BOUNDS.centerY * s + anim.rise * s, 0);
      f.lime.position.set(f.pivot.position.x - s * 1.6, f.pivot.position.y - s * 0.4, s * 3);
    });
    return r.bottom > -40 && r.top < H + 40;
  }

  // ---------- Input ----------
  const look = { x: 0, y: 0 };          // target, -1..1
  const lookNow = { x: 0, y: 0 };
  const reveal = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, r: 0, tr: 0 };
  const REVEAL_R = mobile ? 110 : 150;
  let autoReveal = false;

  function overFigure(x, y) {
    const r = anchorRect;
    return x > r.left + r.width * 0.12 && x < r.right - r.width * 0.12 && y > r.top && y < r.bottom;
  }
  function pointAt(x, y, pressed) {
    const r = anchorRect;
    // Head sits around 30% down the figure box
    look.x = THREE.MathUtils.clamp((x - (r.left + r.width / 2)) / (W * 0.4), -1, 1);
    look.y = THREE.MathUtils.clamp((y - (r.top + r.height * 0.3)) / (H * 0.5), -1, 1);
    reveal.tx = x; reveal.ty = y;
    if (!autoReveal) reveal.tr = pressed && overFigure(x, y) ? REVEAL_R : 0;
  }

  const cursorEl = document.querySelector('.cursor');
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      pointAt(e.clientX, e.clientY, true);
      cursorEl?.classList.toggle('is-figure', reveal.tr > 0 && !e.target.closest('a, button'));
    }, { passive: true });
    document.addEventListener('pointerleave', () => { reveal.tr = 0; });
  } else {
    // Touch: reveal follows the finger while it is on the figure
    const onTouch = (e) => { const t = e.touches[0]; if (t) pointAt(t.clientX, t.clientY, true); };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', () => { if (!autoReveal) reveal.tr = 0; }, { passive: true });
    // Tilt to look around (only where no permission prompt is needed)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        look.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
        look.y = THREE.MathUtils.clamp((e.beta - 50) / 30, -1, 1);
      }, { passive: true });
    }
  }

  // ---------- Loop ----------
  const t0 = performance.now();
  let running = false, raf = 0, frames = 0, nextBlink = 2.5, blinkT = -1, lastT = 0;

  function pose(t) {
    const dt = Math.min(t - lastT, 0.05); lastT = t;
    lookNow.x += (look.x - lookNow.x) * 0.07;
    lookNow.y += (look.y - lookNow.y) * 0.07;
    const idle = finePointer ? 0 : Math.sin(t * 0.7) * 0.25;
    // Blink
    if (t > nextBlink && blinkT < 0) blinkT = 0;
    let eyeScale = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      eyeScale = Math.max(0.08, Math.abs(Math.cos((blinkT / 0.16) * Math.PI)));
      if (blinkT > 0.16) { blinkT = -1; nextBlink = t + 2.5 + Math.random() * 3; eyeScale = 1; }
    }
    figures.forEach((f) => {
      f.root.rotation.y = (lookNow.x + idle) * 0.22 + anim.scroll * 0.5;
      f.root.position.y = Math.sin(t * 1.1) * 0.03;
      f.head.rotation.y = (lookNow.x + idle) * 0.45;
      f.head.rotation.x = lookNow.y * 0.28 - anim.scroll * 0.3;
      f.head.rotation.z = -lookNow.x * 0.06;
      f.eyes.position.x = lookNow.x * 0.07;
      f.eyes.position.y = 0.7 - lookNow.y * 0.04;
      f.eyes.scale.y = eyeScale;
      f.coin.rotation.y = Math.sin(t * 0.8) * 0.35 + anim.spin;
      f.coin.rotation.z = Math.sin(t * 0.5) * 0.05;
    });
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    if (!place() && frames > 2) { stop(); return; }
    pose(t);

    reveal.x += (reveal.tx - reveal.x) * 0.16;
    reveal.y += (reveal.ty - reveal.y) * 0.16;
    reveal.r += (reveal.tr - reveal.r) * 0.12;

    renderer.clear(true, true, true);
    renderer.render(A.scene, camera);
    if (reveal.r > 0.5) {
      const px = reveal.x - W / 2, py = H / 2 - reveal.y;
      mask.position.set(px, py, 0); mask.scale.setScalar(reveal.r);
      ring.position.set(px, py, 0); ring.scale.setScalar(reveal.r);
      ring.visible = false;
      renderer.render(maskScene, ortho);     // erase + mark circle in stencil
      renderer.clearDepth();
      renderer.render(B.scene, camera);      // alt figure, only inside circle
      ring.visible = true; mask.visible = false;
      renderer.render(maskScene, ortho);     // thin lime outline
      mask.visible = true;
    }
    frames++;
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !document.hidden) start();
  }, { rootMargin: '40px' });
  io.observe(anchor);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

  // ---------- Performance check (fallback if < 30 fps in the first second) ----------
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
    // Figure rises in, coin spins, then a reveal sweep hints at the hidden version
    intro() {
      if (!gsap) return;
      const tl = gsap.timeline();
      tl.fromTo(anim, { rise: -2.6 }, { rise: 0, duration: 1.6, ease: 'expo.out' })
        .fromTo(anim, { spin: -Math.PI * 4 }, { spin: 0, duration: 2, ease: 'expo.out' }, 0.1)
        .add(() => {
          const r = anchorRect;
          autoReveal = true;
          reveal.x = reveal.tx = r.left + r.width * 0.2;
          reveal.y = reveal.ty = r.top + r.height * 0.3;
          reveal.tr = REVEAL_R * 0.9;
        }, 1.4)
        .to(reveal, { tx: () => anchorRect.left + anchorRect.width * 0.8, duration: 1.4, ease: 'power2.inOut' }, 1.5)
        .add(() => { reveal.tr = 0; autoReveal = false; }, 2.9);
    },
    setScroll(p) { anim.scroll = p; },
    dispose,
  };
}
