// PAYLOT 3D stage: the procedural coin + the mascot that holds it.
// One transparent WebGL canvas, fixed behind the page content.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMascot, FIGURE_BOUNDS } from './mascot.js?v=20261113c';

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

  // ---------- Coin rain: 14 small coins falling behind the figure ----------
  function makeRain(count = 14) {
    const geo = new THREE.CylinderGeometry(1, 1, 0.14, 32);
    const side = new THREE.MeshPhysicalMaterial({ color: 0x5a6068, metalness: 1, roughness: 0.3 });
    const face = new THREE.MeshPhysicalMaterial({ color: 0x3a4030, emissive: LIME, emissiveIntensity: 0.12, metalness: 1, roughness: 0.3 });
    const mesh = new THREE.InstancedMesh(geo, [side, face, face], count);
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    const items = Array.from({ length: count }, (_, i) => ({
      x: 0, y: 0, z: -4 - Math.random() * 5,
      r: 0.1 + Math.random() * 0.12,
      v: 0.35 + Math.random() * 0.5,
      rx: Math.random() * 6, ry: Math.random() * 6,
      sx: (Math.random() - 0.5) * 3, sy: 1 + Math.random() * 2.5,
      seed: i / count,
    }));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const halfH = (z) => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z);
    function spawn(c, first) {
      const hh = halfH(c.z), hw = hh * camera.aspect;
      c.x = (Math.random() * 2 - 1) * hw * 0.95;
      c.y = first ? (c.seed * 2 - 1) * hh : hh + c.r + Math.random() * hh * 0.6;
    }
    items.forEach((c) => spawn(c, true));
    function update(dt) {
      items.forEach((c, i) => {
        c.y -= c.v * dt;
        c.rx += c.sx * dt; c.ry += c.sy * dt;
        if (c.y < -halfH(c.z) - c.r) spawn(c, false);
        p.set(c.x, c.y, c.z);
        q.setFromEuler(e.set(c.rx, c.ry, 0));
        sc.setScalar(c.r);
        mesh.setMatrixAt(i, m.compose(p, q, sc));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    return { group, update, respawnAll: () => items.forEach((c) => spawn(c, true)) };
  }
  const A = makeScene('main');
  const B = makeScene('alt');
  const figures = [A, B];
  const rain = makeRain();
  A.scene.add(rain.group);

  // Reveal mask (screen-space organic blob, drawn into the stencil buffer)
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
  // Wobble the circle's edge so the reveal feels liquid rather than a hard circle
  const maskPos = mask.geometry.attributes.position;
  const SEG = maskPos.count - 2;
  function wobble(t, amount) {
    for (let i = 1; i < maskPos.count; i++) {
      const a = ((i - 1) / SEG) * Math.PI * 2;
      const k = 1 + amount * (0.09 * Math.sin(3 * a + t * 1.3) + 0.06 * Math.sin(5 * a - t * 2.1) + 0.035 * Math.sin(8 * a + t * 0.7));
      maskPos.setXY(i, Math.cos(a) * k, Math.sin(a) * k);
    }
    maskPos.needsUpdate = true;
  }

  // ---------- Fit figure to its DOM box ----------
  let W = 0, H = 0, unitPerPx = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    rain?.respawnAll();
    unitPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / H;
    ortho.left = -W / 2; ortho.right = W / 2; ortho.top = H / 2; ortho.bottom = -H / 2;
    ortho.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const anchor = document.querySelector('[data-figure-anchor]');
  const anim = { rise: 0, spin: 0, scroll: 0, tossY: 0, flip: 0, arms: 0, squint: 0 };

  let anchorRect = anchor.getBoundingClientRect();

  function place() {
    const r = anchor.getBoundingClientRect();
    anchorRect = r;
    const s = (r.width / FIGURE_BOUNDS.width) * unitPerPx;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const baseY = -(cy - H / 2) * unitPerPx;
    rain.group.position.y = window.scrollY * unitPerPx;   // rain scrolls away with the hero
    figures.forEach((f) => {
      f.pivot.scale.setScalar(s);
      f.pivot.position.set((cx - W / 2) * unitPerPx, baseY - FIGURE_BOUNDS.centerY * s + (anim.rise - anim.scroll * 1.4) * s, 0);
      f.lime.position.set(f.pivot.position.x - s * 1.6, f.pivot.position.y - s * 0.4, s * 3);
    });
    return r.bottom > -40 && r.top < H + 40;
  }

  // ---------- Input ----------
  const look = { x: 0, y: 0 };          // target, -1..1
  const lookNow = { x: 0, y: 0 };
  const reveal = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, r: 0, tr: 0 };
  const REVEAL_R = mobile ? 100 : 150;
  let autoReveal = false;   // intro sweep in progress
  let wander = false;       // touch devices: the reveal drifts over the figure on its own
  let touching = false;
  let locked = false;       // "Tap to flip": whole figure switches to the lime version

  function overFigure(x, y) {
    const r = anchorRect;
    return x > r.left + r.width * 0.12 && x < r.right - r.width * 0.12 && y > r.top && y < r.bottom;
  }
  function pointAt(x, y, pressed) {
    const r = anchorRect;
    // Head sits around 30% down the figure box
    look.x = THREE.MathUtils.clamp((x - (r.left + r.width / 2)) / (W * 0.4), -1, 1);
    look.y = THREE.MathUtils.clamp((y - (r.top + r.height * 0.3)) / (H * 0.5), -1, 1);
    if (locked || autoReveal) return;
    if (!finePointer && !overFigure(x, y)) return;   // a scroll swipe elsewhere doesn't steal the reveal
    reveal.tx = x; reveal.ty = y;
    reveal.tr = pressed && overFigure(x, y) ? REVEAL_R * (finePointer ? 1 : 1.2) : 0;
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
    const onTouch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      touching = overFigure(t.clientX, t.clientY);
      pointAt(t.clientX, t.clientY, true);
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', () => { touching = false; }, { passive: true });
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

  // ---------- Face: expression state, glances and chatter ----------
  const face = { eyes: 'pill', mouth: 'smile' };
  let faceKey = '';
  const glance = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };
  let talkUntil = 0, nextTalk = 5;
  function applyFace(f) {
    const key = f.eyes + f.mouth;
    if (key === faceKey) return;
    faceKey = key;
    figures.forEach((fig) => fig.setFace(f));
  }

  function pose(t) {
    const dt = Math.min(t - lastT, 0.05); lastT = t;
    rain.update(dt);

    // Quick eye glances to random spots (like a person looking around)
    if (t > glance.next) {
      const wide = Math.random() < 0.3;
      glance.tx = (Math.random() * 2 - 1) * (wide ? 0.09 : 0.05);
      glance.ty = (Math.random() * 2 - 1) * 0.04;
      glance.next = t + 0.6 + Math.random() * 1.8;
    }
    glance.x += (glance.tx - glance.x) * 0.3;
    glance.y += (glance.ty - glance.y) * 0.3;

    // Every few seconds the mouth chatters for a moment
    if (t > nextTalk && anim.tossY === 0) { talkUntil = t + 1.1 + Math.random() * 0.8; nextTalk = t + 5 + Math.random() * 4; }
    const talking = t < talkUntil && face.mouth === 'smile';
    const mouthY = talking ? 0.45 + 0.75 * Math.abs(Math.sin(t * 13)) : 1;

    // Touching the figure (phones) makes it beam
    applyFace(touching && face.eyes === 'pill' ? { eyes: 'happy', mouth: 'grin' } : face);
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
    if (blinkT < 0 && t > nextBlink - 0.01 && Math.random() < 0.002) nextBlink = t; // occasional double blink
    eyeScale = Math.min(eyeScale, 1 - anim.squint * 0.65);
    figures.forEach((f) => {
      f.root.rotation.y = (lookNow.x + idle) * 0.22 + anim.scroll * 0.5;
      f.root.position.y = Math.sin(t * 1.1) * 0.03;
      f.head.rotation.y = (lookNow.x + idle) * 0.45;
      f.head.rotation.x = lookNow.y * 0.28 - anim.scroll * 0.3 - Math.min(anim.tossY, 2) * 0.16;
      f.head.rotation.z = -lookNow.x * 0.06;
      f.eyes.position.x = lookNow.x * 0.07 + glance.x;
      f.eyes.position.y = 0.7 - lookNow.y * 0.04 + glance.y + Math.min(anim.tossY, 2) * 0.03;
      f.eyes.scale.y = eyeScale;
      f.mouth.scale.y = mouthY;
      f.coin.rotation.y = Math.sin(t * 0.8) * 0.35 + anim.spin;
      f.coin.rotation.z = Math.sin(t * 0.5) * 0.05;
      f.coin.rotation.x = -0.15 + anim.flip;
      f.coin.position.y = f.coinBaseY + anim.tossY;
      f.arms.position.y = anim.arms;
    });
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    if (!place() && frames > 2) { stop(); return; }
    pose(t);

    const r = anchorRect;
    if (locked) {
      // Flood the whole figure from its centre
      reveal.tx = r.left + r.width / 2; reveal.ty = r.top + r.height * 0.45;
      reveal.tr = Math.hypot(W, H);
    } else if (wander && !touching && !autoReveal) {
      // Drift lazily over the head and coin, breathing in size
      reveal.tx = r.left + r.width * (0.5 + 0.26 * Math.sin(t * 0.55));
      reveal.ty = r.top + r.height * (0.38 + 0.16 * Math.sin(t * 0.83 + 1.2));
      reveal.tr = REVEAL_R * (0.9 + 0.25 * Math.sin(t * 0.9));
    }
    const ease = locked ? 0.07 : 0.1;
    reveal.x += (reveal.tx - reveal.x) * ease;
    reveal.y += (reveal.ty - reveal.y) * ease;
    reveal.r += (reveal.tr - reveal.r) * (locked ? 0.06 : 0.1);

    renderer.clear(true, true, true);
    renderer.render(A.scene, camera);
    if (reveal.r > 0.5) {
      const px = reveal.x - W / 2, py = H / 2 - reveal.y;
      mask.position.set(px, py, 0); mask.scale.setScalar(reveal.r);
      wobble(t, Math.max(0, 1 - reveal.r / 900));
      renderer.render(maskScene, ortho);     // erase + mark the blob in the stencil buffer
      renderer.clearDepth();
      renderer.render(B.scene, camera);      // alt figure, only inside the blob
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

  // ---------- Coin toss: every few seconds the mascot flips the coin and catches it ----------
  function toss() {
    if (!gsap || !running) return;
    const tl = gsap.timeline({ onComplete: () => { anim.flip = 0; } });
    tl.to(anim, { arms: -0.08, duration: 0.18, ease: 'power2.in' }, 0)
      .to(anim, { arms: 0.12, duration: 0.15, ease: 'power2.out' }, 0.18)
      .to(anim, { tossY: 3.4, duration: 0.7, ease: 'power2.out' }, 0.18)
      .to(anim, { flip: Math.PI * 6, duration: 1.4, ease: 'none' }, 0.18)
      .to(anim, { arms: 0, duration: 0.4, ease: 'power2.out' }, 0.33)
      .to(anim, { tossY: 0, duration: 0.7, ease: 'power2.in' }, 0.88)
      .to(anim, { arms: -0.07, duration: 0.1, ease: 'power2.out' }, 1.58)
      .to(anim, { arms: 0, duration: 0.5, ease: 'expo.out' }, 1.68)
      // Expressions: surprised "O" on launch → money eyes $ $ in the air → big grin on the catch
      .call(() => { face.mouth = 'o'; }, null, 0.15)
      .call(() => { face.eyes = 'dollar'; }, null, 0.55)
      .call(() => { face.mouth = 'grin'; }, null, 1.58)
      .call(() => { face.eyes = 'pill'; face.mouth = 'smile'; }, null, 2.9);
  }
  function tossLoop() {
    gsap?.delayedCall(3.2 + Math.random() * 2, () => {
      if (running && !document.hidden && anim.tossY === 0) toss();
      tossLoop();
    });
  }

  return {
    // Figure rises in, coin spins, then a reveal sweep hints at the hidden version
    intro() {
      if (!gsap) return;
      gsap.delayedCall(3.4, () => { toss(); tossLoop(); });
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
        .add(() => { reveal.tr = 0; autoReveal = false; wander = !finePointer; }, 2.9);
    },
    setScroll(p) { anim.scroll = p; },
    setLock(on) { locked = on; if (!on) { reveal.tr = 0; } },
    dispose,
  };
}
