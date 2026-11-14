// Market calendar: TradingView Economic Calendar widget + impact filter pills.
// The widget loads only when the section is close to the screen, and is rebuilt
// with a new `importanceFilter` whenever a pill is chosen.

const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
const IMPORTANCE = { high: '1', medium: '0', low: '-1' };

export function initCalendar(section, { gsap, reducedMotion } = {}) {
  if (!section) return;
  const frame = section.querySelector('[data-cal-frame]');
  const status = section.querySelector('[data-cal-status]');
  const group = section.querySelector('.pills');
  const thumb = section.querySelector('.pills__thumb');
  const buttons = [...section.querySelectorAll('.pills__btn')];
  const legend = [...section.querySelectorAll('.cal__legend li')];

  let level = 'high';
  let started = false;
  let build = 0;

  // ---- Sliding lime highlight behind the active pill ----
  function moveThumb(instant) {
    const btn = buttons.find((b) => b.dataset.level === level);
    if (!btn || !thumb) return;
    if (instant) thumb.style.transition = 'none';
    thumb.style.width = btn.offsetWidth + 'px';
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (instant) { thumb.offsetWidth; thumb.style.transition = ''; }
  }

  function setLevel(next) {
    if (next === level) return;
    level = next;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
    legend.forEach((li) => li.classList.toggle('is-active', li.dataset.level === level));
    moveThumb(false);
    if (started) load();
  }

  buttons.forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
  legend.forEach((li) => li.classList.toggle('is-active', li.dataset.level === level));
  moveThumb(true);
  group.classList.add('is-ready');
  window.addEventListener('resize', () => moveThumb(true), { passive: true });
  document.fonts?.ready.then(() => moveThumb(true));

  // ---- Widget ----
  function load() {
    const id = ++build;
    const old = frame.querySelector('.tradingview-widget-container');

    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    const target = document.createElement('div');
    target.className = 'tradingview-widget-container__widget';
    wrap.appendChild(target);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = WIDGET_SRC;
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      importanceFilter: IMPORTANCE[level],
    });
    script.onerror = () => { if (id === build) fail(); };
    wrap.appendChild(script);

    frame.classList.add('is-loading');
    status.textContent = 'Loading calendar…';
    status.hidden = false;

    const show = () => {
      if (id !== build) return;
      clearTimeout(timer);
      frame.querySelectorAll('.tradingview-widget-container').forEach((n) => { if (n !== wrap) n.remove(); });
      frame.classList.remove('is-loading');
      status.hidden = true;
    };
    // Wait for the widget's iframe to finish loading, then cross-fade
    const mo = new MutationObserver(() => {
      const iframe = wrap.querySelector('iframe');
      if (iframe) { mo.disconnect(); iframe.addEventListener('load', () => setTimeout(show, 150), { once: true }); }
    });
    mo.observe(wrap, { childList: true, subtree: true });
    const timer = setTimeout(() => { if (wrap.querySelector('iframe')) show(); else if (id === build) fail(); }, 12000);

    if (old) old.classList.add('is-old');
    frame.appendChild(wrap);
  }

  function fail() {
    frame.classList.remove('is-loading');
    frame.querySelectorAll('.tradingview-widget-container').forEach((n) => n.remove());
    status.hidden = false;
    status.textContent = 'The calendar could not load. Check your connection or ad blocker, then refresh the page.';
  }

  function start() {
    if (started) return;
    started = true;
    load();
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '600px 0px' });
    io.observe(section);
  } else {
    start();
  }

  // ---- Card slides + fades in ----
  const card = section.querySelector('[data-cal-card]');
  if (gsap && !reducedMotion && card) {
    gsap.from(card, {
      y: 80, opacity: 0, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 88%', once: true },
    });
  }
}
