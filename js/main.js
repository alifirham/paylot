import { TELEGRAM_URL, REBATE_PER_LOT } from './config.js?v=20261114d';

const root = document.documentElement;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const hasGSAP = Boolean(gsap);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const params = new URLSearchParams(location.search);

const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');

// ---------- Values from config.js ----------
document.querySelectorAll('[data-telegram]').forEach((a) => { a.href = TELEGRAM_URL; });
document.querySelectorAll('[data-rebate]').forEach((el) => { el.textContent = fmtUSD(REBATE_PER_LOT); });

// ---------- GSAP + Lenis smooth scroll ----------
let lenis = null;
if (hasGSAP) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'expo.out', duration: 1.2 });

  if (!reducedMotion && Lenis) {
    lenis = new Lenis({ autoRaf: false, anchors: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

// Route in-page links through Lenis (or native scroll as a fallback)
function scrollToHash(hash) {
  const target = hash === '#top' ? 0 : document.querySelector(hash);
  if (target === null) return;
  if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(2, -10 * t) });
  else if (target === 0) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  e.preventDefault();
  const hash = a.getAttribute('href');
  scrollToHash(hash);
  // Move keyboard focus to the target section for accessibility
  const el = hash === '#top' ? document.getElementById('main') : document.querySelector(hash);
  if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
});

// ---------- Nav background after scrolling ----------
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- Mobile menu ----------
const toggle = document.querySelector('.nav__toggle');
const menu = document.getElementById('menu');

function openMenu() {
  menu.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Close menu');
  document.body.classList.add('menu-open');
  lenis?.stop();
  menu.querySelector('a')?.focus({ preventScroll: true });
}
function closeMenu({ restoreFocus = true } = {}) {
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  document.body.classList.remove('menu-open');
  lenis?.start();
  setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
  if (restoreFocus) toggle.focus({ preventScroll: true });
}
toggle.addEventListener('click', () => {
  toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
});
menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu({ restoreFocus: false }); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
});
matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
  if (e.matches && !menu.hidden) closeMenu({ restoreFocus: false });
});

// ---------- Sticky Telegram bar: visible whenever the hero buttons are off-screen ----------
const sticky = document.querySelector('[data-sticky-cta]');
const heroActions = document.querySelector('.hero__actions');
if (sticky && heroActions && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting;
    sticky.classList.toggle('is-visible', show);
    sticky.querySelector('a').tabIndex = show ? 0 : -1;
  }).observe(heroActions);
}

// ---------- Hero ----------
const heroTitle = document.querySelector('.hero__title');
const heroNums = document.querySelectorAll('.hero__num-solid, .hero__num-outline');  // solid + outline $14
const heroSplitTargets = [heroTitle, ...heroNums];
const heroReveals = document.querySelectorAll('.hero [data-reveal]');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function showWithoutMotion() {
  heroSplitTargets.forEach((t) => { t.style.visibility = 'visible'; });
  heroReveals.forEach((el) => { el.style.opacity = 1; });
  document.querySelector('.preloader')?.remove();
  root.classList.remove('has-preloader');
}

// ---------- Preloader: $0 → $14, then the number flies into the hero ----------
async function runPreloader() {
  const pre = document.querySelector('.preloader');
  if (!pre || !root.classList.contains('has-preloader')) return false;
  if (!hasGSAP) { showWithoutMotion(); return false; }
  const panel = pre.querySelector('.preloader__panel');
  const numEl = pre.querySelector('.preloader__num');
  const countEl = pre.querySelector('.preloader__count');
  const caption = pre.querySelector('.preloader__caption');
  const mark = pre.querySelector('.preloader__mark');
  lenis?.stop();
  window.scrollTo(0, 0);
  try { await Promise.race([document.fonts.ready, wait(1500)]); } catch (_) { /* ignore */ }

  // 1. The P-arrow symbol draws itself on the lime screen
  const strokes = mark.querySelectorAll('.stem, .bowl');
  strokes.forEach((path) => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  });
  const intro = gsap.timeline();
  intro.to(strokes, { strokeDashoffset: 0, duration: 0.7, ease: 'power3.inOut', stagger: 0.15 })
    .from(mark.querySelector('.tip'), { scale: 0, transformOrigin: '30% 50%', duration: 0.5, ease: 'expo.out' }, '-=0.15')
    .from(caption, { opacity: 0, y: 12, duration: 0.5, ease: 'power3.out' }, 0.2)
    .fromTo(numEl, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, 0.3);

  // 2. Count $0 → $14
  const o = { v: 0 };
  intro.to(o, {
    v: REBATE_PER_LOT, duration: 1.5, ease: 'power3.inOut',
    onUpdate: () => { countEl.textContent = fmtUSD(o.v); },
  }, 0.5);
  await intro;
  await wait(120);

  // 3. FLIP: the number flies into the hero (turning lime) while the lime panel lifts away
  const target = document.querySelector('.hero__num-solid > span').getBoundingClientRect();
  const from = countEl.getBoundingClientRect();
  const sc = target.height / from.height;
  const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
  const dy = (target.top + target.height / 2) - (from.top + from.height / 2);
  const tl = gsap.timeline();
  tl.to([caption, mark], { opacity: 0, y: -24, duration: 0.35, ease: 'power2.in', stagger: 0.05 }, 0)
    .to(panel, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.15)
    .to(numEl, { x: dx, y: dy, scale: sc, duration: 1.1, ease: 'expo.inOut' }, 0.15)
    .to(numEl, { color: '#B8FF2E', duration: 0.5, ease: 'power1.out' }, 0.45);
  await tl;
  gsap.set(heroNums, { visibility: 'visible' });
  pre.remove();
  root.classList.remove('has-preloader');
  try { sessionStorage.setItem('paylot-intro', '1'); } catch (_) { /* ignore */ }
  lenis?.start();
  return true;
}

async function heroIntro() {
  if (!hasGSAP) { showWithoutMotion(); introDone(); return; }
  if (reducedMotion) {
    showWithoutMotion();
    gsap.set(heroSplitTargets, { opacity: 0 });
    gsap.to([...heroSplitTargets, ...heroReveals], { opacity: 1, duration: 0.8, ease: 'power1.out', stagger: 0.1 });
    introDone();
    return;
  }
  try { await document.fonts.ready; } catch (_) { /* ignore */ }
  const titleChars = SplitText.create(heroTitle, { type: 'chars' }).chars;
  const numSplits = [...heroNums].map((n) => SplitText.create(n.firstElementChild, { type: 'chars', aria: 'none' }));
  gsap.set(heroTitle, { visibility: 'visible' });

  const landed = await runPreloader();
  const tl = gsap.timeline({ onComplete: startShine });
  if (!landed) {
    // No preloader this visit: digits punch up from below
    gsap.set(heroNums, { visibility: 'visible' });
    numSplits.forEach((sp) => tl.from(sp.chars, { yPercent: 105, duration: 1.4, ease: 'expo.out', stagger: 0.08 }, 0));
  } else {
    // Landing "thump": the number settles with a quick squash
    tl.fromTo(heroNums, { scaleY: 0.92, scaleX: 1.04, transformOrigin: '50% 100%' },
      { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'expo.out' }, 0);
  }
  tl.from(titleChars, { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.025 }, landed ? 0 : 0.25)
    .fromTo(heroReveals, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: 'power4.out', stagger: 0.08 }, landed ? 0.3 : 0.7);
  introDone();

  // A light sweep runs across $14 every few seconds once the intro has finished
  function startShine() {
    numSplits.forEach((sp) => sp.revert());
    gsap.set(heroNums, { clearProps: 'transform' });
    document.querySelector('.hero__num-solid').classList.add('is-shining');
  }

  // Scroll: $14 swells and drifts, headline slides away, figure sinks and turns
  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
    },
  })
    .to(heroNums, { scale: 2.2, xPercent: -10, transformOrigin: '0% 60%', ease: 'none' }, 0)
    .to('.hero__head', { xPercent: -14, opacity: 0, ease: 'none' }, 0)
    .to('.hero__bottom, .hero__num-label', { opacity: 0, y: -60, ease: 'none' }, 0)
    .to('.ticker', { yPercent: -120, ease: 'none' }, 0);

  // Scroll velocity: $14 leans into fast scrolls, ticker speeds up
  const skewTo = gsap.quickTo(heroNums, 'skewX', { duration: 0.5, ease: 'power3.out' });
  const tickerTl = gsap.to('.ticker__track', { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  document.querySelector('.ticker__track').style.animation = 'none';
  ScrollTrigger.create({
    onUpdate: (self) => {
      const v = self.getVelocity();
      skewTo(gsap.utils.clamp(-14, 14, -v / 220));
      tickerTl.timeScale(1 + Math.min(Math.abs(v) / 300, 6));
      gsap.to(tickerTl, { timeScale: 1, duration: 1.2, ease: 'power2.out', overwrite: true, delay: 0.1 });
    },
  });
}

// ---------- Contour lines: slow drift + scroll parallax ----------
const contours = document.querySelector('.hero__contours');
if (contours && hasGSAP && !reducedMotion) {
  gsap.to(contours, { rotation: 6, xPercent: -4, yPercent: 3, duration: 18, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.to(contours, { y: () => innerHeight * 0.35, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

let introDone;
const introReady = new Promise((r) => { introDone = r; });

// Safety net: never leave the hero hidden if something fails
setTimeout(() => {
  if (getComputedStyle(heroTitle).visibility === 'hidden' || document.querySelector('.preloader')) {
    showWithoutMotion(); lenis?.start(); introDone();
  }
}, 9000);

// ---------- Custom cursor + magnetic buttons (desktop only) ----------
if (finePointer && !reducedMotion && hasGSAP) {
  const cursor = document.querySelector('.cursor');
  root.classList.add('has-cursor');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    xTo(e.clientX); yTo(e.clientY);
    cursor.classList.toggle('is-link', Boolean(e.target.closest('a, button, [role="button"]')));
  }, { passive: true });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.3 }));

  document.querySelectorAll('.btn').forEach((btn) => {
    const bx = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
    const by = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      bx((e.clientX - (r.left + r.width / 2)) * 0.3);
      by((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    btn.addEventListener('pointerleave', () => { bx(0); by(0); });
  });
}

// ---------- Hero model (WebGL, loaded after first paint) ----------
const canvas = document.getElementById('webgl');
const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
// Low-tier = clearly weak hardware only. (iPhone Safari under-reports CPU cores for privacy,
// so a core count alone would wrongly send every iPhone to the static fallback.
// Everything else gets the WebGL model; it is a single light shader.)
const lowTier = isMobileUA && (
  (navigator.deviceMemory && navigator.deviceMemory <= 2)
  || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2 && !/iPhone|iPad/.test(navigator.userAgent))
);
const debug = params.has('debug');
function debugNote(msg) {
  console.info('[PAYLOT 3D]', msg);
  if (!debug) return;
  let el = document.getElementById('paylot-debug');
  if (!el) {
    el = document.createElement('div');
    el.id = 'paylot-debug';
    el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;padding:6px 10px;border-radius:8px;background:#000;color:#B8FF2E;font:12px/1.4 monospace;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}
const forceCoin = params.get('coin') === '3d';     // for testing: ?coin=3d
const staticCoin = params.get('coin') === 'static'; // for testing: ?coin=static

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}

let figure = null;
async function loadFigure() {
  if (staticCoin) return debugNote('static: ?coin=static');
  if (reducedMotion) return debugNote('static: reduced motion is on');
  if (!webglAvailable()) return debugNote('static: no WebGL');
  if (lowTier && !forceCoin) return debugNote('static: low-tier device');
  try {
    const { initModel } = await import('./model.js?v=20261114d');
    figure = await initModel({
      canvas,
      anchor: document.querySelector('[data-figure-anchor]'),
      hero: document.querySelector('.hero'),
      finePointer,
      mobile: isMobileUA || innerWidth < 768,
    });
    debugNote(figure ? 'model on' : 'static: WebGL failed');
    if (!figure) return;
    await introReady;            // wait for the preloader to land first
    root.classList.add('webgl-on');
    figure.intro();
    // $14 drifts the opposite way to the model's tilt (uses CSS "translate", separate from GSAP transforms)
    const nums = document.querySelectorAll('.hero__num-solid, .hero__num-outline');
    figure.onTilt((x, y) => { const v = `${(x * -14).toFixed(2)}px ${(y * -8).toFixed(2)}px`; nums.forEach((el) => { el.style.translate = v; }); });
    // "Tap to flip": keep the masked look on / off
    const flip = document.querySelector('[data-flip]');
    if (flip) {
      const idle = finePointer ? 'Click to reveal' : 'Tap to reveal';
      flip.querySelector('.hero__flip-label').textContent = idle;
      flip.hidden = false;
      gsap?.from(flip, { opacity: 0, x: 20, duration: 0.8, ease: 'expo.out', delay: 1.6 });
      flip.addEventListener('click', () => {
        const on = flip.getAttribute('aria-pressed') !== 'true';
        flip.setAttribute('aria-pressed', String(on));
        flip.querySelector('.hero__flip-label').textContent = on ? 'Hide' : idle;
        figure.setLock(on);
      });
    }
  } catch (err) {
    console.warn('Hero model unavailable, using the static image.', err);
    debugNote('static: ' + err.message);
    root.classList.remove('webgl-on');
  }
}

function afterFirstPaint(fn) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

// ---------- Start ----------
heroIntro();
afterFirstPaint(loadFigure);
