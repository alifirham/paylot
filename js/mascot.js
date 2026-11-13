// PAYLOT mascot — a friendly robot trader holding the PAYLOT coin.
// Built from simple shapes only (no external models).
// Two variants share identical geometry and pose:
//   'main'  : gunmetal body, lime eyes          (what you normally see)
//   'alt'   : lime body, black visor, ^ ^ eyes  (revealed under the cursor)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { buildCoin, symbolShapes } from './coin.js?v=20261113c';

const LIME = 0xb8ff2e;

// The "$" glyph from Anton (unit height, centred, y-up) for the money eyes
const DOLLAR_PATH = 'M-0.049 -0.5V-0.417Q-0.154 -0.405 -0.199 -0.343Q-0.245 -0.282 -0.245 -0.165V-0.134H-0.051V-0.157Q-0.051 -0.243 0.004 -0.243Q0.027 -0.243 0.038 -0.229Q0.049 -0.214 0.049 -0.195Q0.049 -0.16 0.014 -0.124L-0.146 0.037Q-0.235 0.125 -0.235 0.228Q-0.235 0.284 -0.209 0.327Q-0.184 0.369 -0.142 0.396Q-0.1 0.424 -0.049 0.432V0.5H0.047V0.434Q0.143 0.422 0.192 0.355Q0.242 0.289 0.242 0.18H0.043V0.216Q0.043 0.24 0.03 0.253Q0.017 0.266 -0.004 0.266Q-0.028 0.266 -0.039 0.254Q-0.051 0.242 -0.051 0.223Q-0.051 0.195 0.004 0.14L0.16 -0.014Q0.195 -0.048 0.22 -0.097Q0.245 -0.145 0.245 -0.206Q0.245 -0.299 0.188 -0.354Q0.132 -0.408 0.047 -0.418V-0.5Z';
let dollarGeoCache = null;
function dollarGeometry() {
  if (dollarGeoCache) return dollarGeoCache;
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${DOLLAR_PATH}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  dollarGeoCache = new THREE.ShapeGeometry(shapes, 6);
  return dollarGeoCache;
}

// Rough figure bounds in local units (used to fit the figure into its DOM box)
export const FIGURE_BOUNDS = { width: 3.0, height: 3.6, centerY: 0.15 };

function materials(variant, stencil) {
  const m = variant === 'main'
    ? {
      body: new THREE.MeshPhysicalMaterial({ color: 0x5a6068, metalness: 1, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      dark: new THREE.MeshPhysicalMaterial({ color: 0x1a1d21, metalness: 0.9, roughness: 0.45 }),
      visor: new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }),
      glow: new THREE.MeshBasicMaterial({ color: LIME, toneMapped: false }),
      emblem: new THREE.MeshStandardMaterial({ color: 0x1a2408, emissive: LIME, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.4 }),
    }
    : {
      body: new THREE.MeshPhysicalMaterial({ color: LIME, metalness: 0.05, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      dark: new THREE.MeshPhysicalMaterial({ color: 0x0c0e10, metalness: 0.3, roughness: 0.4 }),
      visor: new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0.4, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      emblem: new THREE.MeshStandardMaterial({ color: 0x0c0e10, metalness: 0.6, roughness: 0.3 }),
    };
  if (stencil) {
    // Only draw where the reveal circle wrote 1 into the stencil buffer
    Object.values(m).forEach((mat) => {
      mat.stencilWrite = true;
      mat.stencilRef = 1;
      mat.stencilFunc = THREE.EqualStencilFunc;
      mat.stencilFail = THREE.KeepStencilOp;
      mat.stencilZFail = THREE.KeepStencilOp;
      mat.stencilZPass = THREE.KeepStencilOp;
    });
  }
  return m;
}

// A capsule stretched between two points
function limb(a, b, radius, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(len - radius * 2, 0.01), 8, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function buildMascot(variant = 'main', { stencil = false, mobile = false } = {}) {
  const M = materials(variant, stencil);
  const root = new THREE.Group();

  // ---------- Torso ----------
  const torso = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.7, 1.25, 6, 0.48), M.body);
  torso.position.y = -1.0;
  root.add(torso);

  // Chest plate + emblem
  const plate = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.9, 0.12, 4, 0.06), M.dark);
  plate.position.set(0, -0.78, 0.6);
  root.add(plate);
  const emblem = new THREE.Group();
  symbolShapes().forEach((shape, i) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04 + i * 0.002, bevelEnabled: false, curveSegments: 6 });
    emblem.add(new THREE.Mesh(g, M.emblem));
  });
  emblem.scale.setScalar(0.62);
  emblem.position.set(0.0, -0.78, 0.66);
  root.add(emblem);

  // Shoulders
  [-1, 1].forEach((s) => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), M.dark);
    sh.position.set(s * 1.12, -0.45, 0.05);
    root.add(sh);
  });

  // ---------- Neck ----------
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.4, 24), M.dark);
  neck.position.y = -0.05;
  root.add(neck);

  // ---------- Head (pivots for look-at) ----------
  const head = new THREE.Group();
  head.position.y = 0.2;
  root.add(head);

  const skull = new THREE.Mesh(new RoundedBoxGeometry(1.75, 1.42, 1.4, 6, 0.5), M.body);
  skull.position.y = 0.66;
  head.add(skull);

  const visor = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.86, 0.14, 5, 0.12), M.visor);
  visor.position.set(0, 0.64, 0.66);
  head.add(visor);

  // ---------- Face: swappable eyes + mouths (expressions are driven from coin.js) ----------
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.7, 0.75);
  head.add(eyes);
  const eyeSets = { pill: [], happy: [], dollar: [] };
  const dollarGeo = dollarGeometry();
  [-1, 1].forEach((s) => {
    const slot = new THREE.Group();
    slot.position.x = s * 0.32;
    eyes.add(slot);
    const pill = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.16, 6, 12), M.glow);
    const happy = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 24, Math.PI), M.glow);
    happy.position.y = -0.04;
    const dollar = new THREE.Mesh(dollarGeo, M.glow);
    dollar.scale.setScalar(0.36);
    dollar.position.z = 0.01;
    slot.add(pill, happy, dollar);
    eyeSets.pill.push(pill); eyeSets.happy.push(happy); eyeSets.dollar.push(dollar);
  });

  const mouth = new THREE.Group();
  mouth.position.set(0, 0.42, 0.75);
  head.add(mouth);
  const mouths = {
    smile: new THREE.Mesh(new THREE.TorusGeometry(variant === 'main' ? 0.16 : 0.2, 0.028, 8, 24, Math.PI), M.glow),
    grin: new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 28, Math.PI), M.glow),
    o: new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 8, 24), M.glow),
  };
  mouths.smile.rotation.z = Math.PI;
  mouths.grin.rotation.z = Math.PI;
  mouths.grin.position.y = 0.04;
  mouths.o.position.y = -0.04;
  Object.values(mouths).forEach((m) => mouth.add(m));

  const defaultEyes = variant === 'main' ? 'pill' : 'happy';
  function setFace({ eyes: e = defaultEyes, mouth: m = 'smile' } = {}) {
    if (e === 'pill' && variant !== 'main') e = 'happy';
    Object.entries(eyeSets).forEach(([k, arr]) => arr.forEach((mesh) => { mesh.visible = k === e; }));
    Object.entries(mouths).forEach(([k, mesh]) => { mesh.visible = k === m; });
  }
  setFace();

  // Ears + antenna
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 24), M.dark);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.93, 0.66, 0);
    head.add(ear);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 24), M.glow);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(s * 1.03, 0.66, 0);
    head.add(ring);
  });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 8), M.dark);
  stalk.position.set(0.3, 1.52, 0);
  head.add(stalk);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.glow);
  bulb.position.set(0.3, 1.74, 0);
  head.add(bulb);

  // ---------- Arms holding the coin ----------
  const handY = -0.72, handZ = 1.0, handX = 0.7;
  const arms = new THREE.Group();   // moved as one for the coin toss
  root.add(arms);
  [-1, 1].forEach((s) => {
    const shoulder = new THREE.Vector3(s * 1.12, -0.45, 0.05);
    const elbow = new THREE.Vector3(s * 1.2, -1.15, 0.55);
    const hand = new THREE.Vector3(s * handX, handY, handZ);
    arms.add(limb(shoulder, elbow, 0.17, M.body));
    arms.add(limb(elbow, hand, 0.15, M.body));
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), M.dark);
    fist.position.copy(hand);
    arms.add(fist);
  });

  const coin = buildCoin({ mobile, stencil, variant });
  coin.scale.setScalar(0.6);
  coin.position.set(0, handY + 0.05, handZ + 0.06);
  coin.rotation.x = -0.15;
  root.add(coin);

  return { root, head, eyes, mouth, setFace, coin, arms, coinBaseY: coin.position.y };
}
