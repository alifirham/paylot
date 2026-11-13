import { TELEGRAM_URL } from './config.js';

// ---------- Telegram links: one source of truth ----------
document.querySelectorAll('[data-telegram]').forEach((a) => {
  a.href = TELEGRAM_URL;
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
  menu.querySelector('a')?.focus({ preventScroll: true });
}

function closeMenu({ restoreFocus = true } = {}) {
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  document.body.classList.remove('menu-open');
  setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
  if (restoreFocus) toggle.focus({ preventScroll: true });
}

toggle.addEventListener('click', () => {
  toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
});
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) closeMenu({ restoreFocus: false });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
});
// Close the menu if the screen grows to desktop size
matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
  if (e.matches && !menu.hidden) closeMenu({ restoreFocus: false });
});
