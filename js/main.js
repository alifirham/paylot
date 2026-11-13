import { TELEGRAM_URL, REBATE_PER_LOT } from './config.js';

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

// ---------- Hero intro ----------
const heroTitle = document.querySelector('.hero__title');
const heroReveals = document.querySelectorAll('.hero [data-reveal]');

function showWithoutMotion() {
  heroTitle.style.visibility = 'visible';
  heroReveals.forEach((el) => { el.style.opacity = 1; });
}

async function heroIntro() {
  if (!hasGSAP) return showWithoutMotion();
  if (reducedMotion) {
    gsap.set(heroTitle, { visibility: 'visible', opacity: 0 });
    gsap.to([heroTitle, ...heroReveals], { opacity: 1, duration: 0.8, ease: 'power1.out', stagger: 0.1 });
    return;
  }
  try { await document.fonts.ready; } catch (_) { /* ignore */ }
  const split = SplitText.create(heroTitle, { type: 'lines,chars', mask: 'lines', linesClass: 'line' });
  gsap.set(heroTitle, { visibility: 'visible' });
  const tl = gsap.timeline();
  tl.from(split.chars, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.03 })
    .fromTo(heroReveals, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: 'power4.out', stagger: 0.1 }, '-=0.8');
}

// Safety net: never leave the hero hidden if something fails
setTimeout(() => {
  if (getComputedStyle(heroTitle).visibility === 'hidden') showWithoutMotion();
}, 4000);

// ---------- 3D coin (loaded after first paint) ----------
const canvas = document.getElementById('webgl');
const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
const lowTier = isMobileUA && (navigator.hardwareConcurrency || 4) <= 4;
const forceCoin = params.get('coin') === '3d';     // for testing: ?coin=3d
const staticCoin = params.get('coin') === 'static'; // for testing: ?coin=static

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}

let coin = null;
async function loadCoin() {
  if (staticCoin || reducedMotion || !webglAvailable() || (lowTier && !forceCoin)) return;
  try {
    const { initCoin } = await import('./coin.js');
    coin = await initCoin({
      canvas,
      mobile: isMobileUA || innerWidth < 768,
      finePointer,
      skipFpsCheck: forceCoin,
    });
    if (coin) {
      root.classList.add('webgl-on');
      coin.drop();
    }
  } catch (err) {
    console.warn('3D coin unavailable, using static coin.', err);
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
afterFirstPaint(loadCoin);
