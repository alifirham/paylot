// PAYLOT hero model — "behind the mask" liquid reveal.
// One full-screen WebGL quad draws the model photo into the hero figure box:
//   base layer  : model with a soft-focus face
//   reveal layer: the same model wearing the black faceted mask
// A liquid blob follows the finger / cursor and leaves a fading trail; where the
// blob is, the mask layer shows through. A depth map adds a slight 3D tilt.
// When nobody is touching, the blob drifts around the face on its own.

const LIME = [184 / 255, 1, 46 / 255];
const SRC = { L0: 'assets/model-base.webp', L1: 'assets/model-mask.webp', D: 'assets/model-depth.webp' };
const IW = 755, IH = 1165;               // source image size (all layers share it)
const FACE = [375 / IW, 240 / IH];       // face centre in image space

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;
uniform sampler2D L0,L1,D,B; uniform vec2 res; uniform vec4 rect; uniform vec2 tilt; uniform vec2 light;
uniform float t, alpha, lock; uniform vec3 lime;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 fc=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);
  vec2 uv=(fc-rect.xy)/rect.zw;
  if(uv.x<-.05||uv.x>1.05||uv.y<-.05||uv.y>1.){gl_FragColor=vec4(0);return;}
  vec4 d=texture2D(D,uv);
  float dep=d.r, cov=d.g;
  vec2 o=tilt*vec2(-1,1)*(dep-.25)*.022;
  vec2 o1=o+tilt*vec2(-1,1)*cov*dep*.018;
  vec4 c0=texture2D(L0,uv+o);
  vec4 c1=texture2D(L1,uv+o1);
  // liquid reveal mask (trail texture + moving noise on the edge)
  vec2 su=fc/res;
  float w=n(fc*.008+t*.35)*.6+n(fc*.02-t*.5)*.4;
  float b=texture2D(B,su+(vec2(n(fc*.01+t*.2),n(fc*.01-t*.2))-.5)*.035).a;
  float v=max(b+(w-.5)*.35, lock*1.2-.5+(w-.5)*.3);
  float r=smoothstep(.28,.34,v);
  // glossy highlight on the mask
  vec2 e=vec2(9./rect.z,9./rect.w);
  float dl=texture2D(D,uv+o1-vec2(e.x,0)).r,dr=texture2D(D,uv+o1+vec2(e.x,0)).r,du=texture2D(D,uv+o1-vec2(0,e.y)).r,dd=texture2D(D,uv+o1+vec2(0,e.y)).r;
  vec3 N=normalize(vec3((dl-dr)*3.,(du-dd)*3.,1.));
  vec3 Ld=normalize(vec3(light,1.1)), H=normalize(Ld+vec3(0,0,1));
  float cv1=texture2D(D,uv+o1).g;
  c1.rgb+=vec3(pow(max(dot(N,H),0.),120.)*.45*cv1)*c1.a;
  vec4 col=mix(c0,c1,r);
  // lime rim light on the silhouette, on the side away from the light
  vec2 ro=normalize(vec2(-light.x,light.y)+vec2(.001))*vec2(4./rect.z,4./rect.w)*2.;
  float rim=col.a*(1.-texture2D(L0,uv+o+ro).a);
  col.rgb+=lime*rim*.55;
  // thin lime line on the edge of the blob, only over the body
  float edge=(smoothstep(.22,.25,v)-smoothstep(.25,.28,v))*max(c0.a,c1.a)*(1.-lock);
  col=mix(col,vec4(lime,1.),edge*.9);
  // fade out the bottom (the photo is cropped at the hips)
  col*=smoothstep(1.,.84,uv.y)*alpha;
  gl_FragColor=col;
}`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

export async function initModel({ canvas, anchor, hero, finePointer, mobile }) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const pr = gl.createProgram();
  gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(pl);
  gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['L0', 'L1', 'D', 'B', 'res', 'rect', 'tilt', 'light', 't', 'alpha', 'lock', 'lime'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
  gl.uniform3fv(U.lime, LIME);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  function texture(unit, name) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U[name], unit);
    return tex;
  }

  const [i0, i1, iD] = await Promise.all([loadImage(SRC.L0), loadImage(SRC.L1), loadImage(SRC.D)]);
  [[i0, 0, 'L0'], [i1, 1, 'L1'], [iD, 2, 'D']].forEach(([im, unit, name]) => {
    texture(unit, name);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  });
  const blobTex = texture(3, 'B');

  // Trail canvas (quarter resolution, faded a little every frame)
  const bc = document.createElement('canvas');
  const bx = bc.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bc.width = Math.max(64, (W / 4) | 0); bc.height = Math.max(64, (H / 4) | 0);
  }
  layout();
  window.addEventListener('resize', layout);

  // Fit the photo (contain, bottom-centre) into the anchor box
  const state = { alpha: 0, rise: 0, lock: 0, lockTo: 0 };
  function figureRect() {
    const b = anchor.getBoundingClientRect();
    const s = Math.min(b.width / IW, b.height / IH);
    const w = IW * s, h = IH * s;
    return [b.left + (b.width - w) / 2, b.bottom - h + state.rise, w, h];
  }

  // Pointer / touch
  const ptr = { x: 0, y: 0, px: -1e5, py: -1e5, active: false, last: 0 };
  let tx = 0, ty = 0, sx = 0, sy = 0;
  function move(x, y) { ptr.x = x; ptr.y = y; ptr.active = true; ptr.last = performance.now(); }
  const onMouse = (e) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); };
  const onTouch = (e) => { const t0 = e.touches[0]; if (t0) move(t0.clientX, t0.clientY); };
  window.addEventListener('pointermove', onMouse, { passive: true });
  hero.addEventListener('touchstart', onTouch, { passive: true });
  hero.addEventListener('touchmove', onTouch, { passive: true }); // never blocks scrolling
  const onLeave = () => { ptr.active = false; };
  document.documentElement.addEventListener('pointerleave', onLeave);

  function stamp(x, y, rad, a) {
    const k = bc.width / W, X = x * k, Y = y * k, R = rad * k;
    const g = bx.createRadialGradient(X, Y, 0, X, Y, R);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.85})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    bx.fillStyle = g; bx.beginPath(); bx.arc(X, Y, R, 0, 7); bx.fill();
  }

  // Only draw while the hero is on screen
  let visible = true, raf = 0, running = false;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }, { rootMargin: '100px' });
  io.observe(hero);

  function frame(ms) {
    raf = 0;
    if (!visible) { running = false; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const t = ms / 1000, now = performance.now();
    const rect = figureRect();

    bx.globalCompositeOperation = 'destination-out';
    bx.fillStyle = 'rgba(0,0,0,0.045)';
    bx.fillRect(0, 0, bc.width, bc.height);
    bx.globalCompositeOperation = 'source-over';

    const base = Math.min(W, H) * 0.16;
    let x = ptr.x, y = ptr.y;
    const live = ptr.active && now - ptr.last < 2500;
    if (live) {
      tx = ((x - (rect[0] + rect[2] / 2)) / Math.max(rect[2], 1)) * 1.4;
      ty = ((y - (rect[1] + rect[3] * 0.4)) / Math.max(rect[3], 1)) * 1.4;
      tx = Math.max(-1, Math.min(1, tx)); ty = Math.max(-1, Math.min(1, ty));
    } else {
      // idle: drift around the face so people know to try
      const fx = rect[0] + rect[2] * FACE[0], fy = rect[1] + rect[3] * FACE[1];
      x = fx + Math.cos(t * 0.9) * rect[2] * 0.16;
      y = fy + Math.sin(t * 1.3) * rect[3] * 0.08;
      tx = Math.cos(t * 0.5) * 0.35; ty = Math.sin(t * 0.7) * 0.25;
    }
    if (ptr.px < -9e4) { ptr.px = x; ptr.py = y; }
    const dx = x - ptr.px, dy = y - ptr.py, dist = Math.hypot(dx, dy);
    const sp = Math.min(dist / 40, 1), steps = Math.min(40, Math.max(1, Math.ceil(dist / (base * 0.25))));
    for (let i = 1; i <= steps; i++) {
      stamp(ptr.px + (dx * i) / steps, ptr.py + (dy * i) / steps, base * (live ? 1 + sp * 0.5 : 0.75), live ? 0.9 : 0.6);
    }
    ptr.px = x; ptr.py = y;

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, blobTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);

    sx += (tx - sx) * 0.06; sy += (ty - sy) * 0.06;
    state.lock += (state.lockTo - state.lock) * 0.07;
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform4f(U.rect, rect[0] * dpr, rect[1] * dpr, rect[2] * dpr, rect[3] * dpr);
    gl.uniform2f(U.tilt, sx, sy);
    gl.uniform2f(U.light, sx * 1.4, -sy * 1.4 + 0.4);
    gl.uniform1f(U.t, t);
    gl.uniform1f(U.alpha, state.alpha);
    gl.uniform1f(U.lock, state.lock);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    onTilt?.(sx, sy);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }

  let onTilt = null;
  start();

  return {
    // fade + rise in after the preloader
    intro() {
      const gsap = window.gsap;
      if (gsap) {
        gsap.fromTo(state, { alpha: 0 }, { alpha: 1, duration: 1.2, ease: 'power2.out' });
        gsap.fromTo(state, { rise: 80 }, { rise: 0, duration: 1.6, ease: 'expo.out' });
      } else { state.alpha = 1; }
    },
    setLock(on) { state.lockTo = on ? 1 : 0; },
    onTilt(fn) { onTilt = fn; },
    dispose() {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('pointermove', onMouse);
      hero.removeEventListener('touchstart', onTouch);
      hero.removeEventListener('touchmove', onTouch);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    },
  };
}
