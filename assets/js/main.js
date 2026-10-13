/* پسته ایلیا — interactions */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (value) => String(value).replace(/\d/g, (d) => FA_DIGITS[d]);
  const toEn = (value) => String(value)
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  /* ---------- Header state, scroll progress, back-to-top ---------- */
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const toTop = $('[data-to-top]');
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('is-scrolled', y > 30);
    progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    toTop.classList.toggle('is-visible', y > window.innerHeight * 1.2);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Mobile menu ---------- */
  const menuToggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');

  const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'بستن منو' : 'منو');
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    document.body.classList.toggle('menu-open', open);
  };
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuToggle.focus(); }
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  // Only elements that start below the fold are hidden, so nothing visible ever flickers.
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('reveal-pending');
      io.observe(el);
    });
  }

  /* ---------- Process line ---------- */
  const steps = $('[data-steps]');
  if (steps) {
    if ('IntersectionObserver' in window) {
      const so = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { steps.classList.add('is-in'); so.disconnect(); }
      }, { threshold: 0.35 });
      so.observe(steps);
    } else {
      steps.classList.add('is-in');
    }
  }

  /* ---------- Counters ---------- */
  const animateCount = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = toFa(target); return; }
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = toFa(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = toFa(0);
    requestAnimationFrame(step);
  };
  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        co.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Active nav link ---------- */
  const navLinks = $$('.nav a');
  const sections = navLinks
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const no = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => no.observe(s));
    // clear the highlight while the hero is on screen
    const hero = $('#home');
    if (hero) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) navLinks.forEach((a) => a.classList.remove('is-active'));
      }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
    }
  }

  /* ---------- Hero medallion tilt (pointer) ---------- */
  const heroEl = $('.hero');
  const heroVisual = $('.hero-visual');
  if (heroEl && heroVisual && finePointer && !reduceMotion) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      heroVisual.style.transform = `perspective(1000px) rotateY(${(cx * 10).toFixed(2)}deg) rotateX(${(-cy * 8).toFixed(2)}deg)`;
      raf = (Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005) ? requestAnimationFrame(tick) : null;
    };
    heroEl.addEventListener('pointermove', (e) => {
      const r = heroEl.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    heroEl.addEventListener('pointerleave', () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  /* ---------- Card spotlight ---------- */
  if (finePointer) {
    $$('.spot').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Quote form ---------- */
  const form = $('[data-form]');
  const success = $('[data-form-success]');
  const productSelect = $('[data-product-select]');
  const requestSelect = $('[data-request-select]');

  const flash = (select) => {
    const field = select.closest('.field');
    field.classList.remove('is-flash');
    void field.offsetWidth; // restart the highlight
    field.classList.add('is-flash');
    setTimeout(() => field.classList.remove('is-flash'), 2200);
  };

  // "استعلام قیمت" on a variety card pre-selects that variety in the form
  $$('[data-product]').forEach((link) => {
    link.addEventListener('click', () => {
      productSelect.value = link.dataset.product;
      flash(productSelect);
    });
  });
  $$('[data-request]').forEach((link) => {
    link.addEventListener('click', () => {
      requestSelect.value = link.dataset.request;
      flash(requestSelect);
    });
  });
  // links from other pages, e.g. index.html?request=sell#contact from the price board
  const requested = new URLSearchParams(location.search).get('request');
  if (requestSelect && requested && $(`option[value="${CSS.escape(requested)}"]`, requestSelect)) requestSelect.value = requested;

  const phoneOk = (value) => {
    const digits = toEn(value).replace(/[\s\-()]/g, '');
    return /^\+?\d{8,15}$/.test(digits);
  };

  const validateField = (input) => {
    const field = input.closest('.field');
    let ok = input.value.trim() !== '';
    if (ok && input.hasAttribute('data-phone')) ok = phoneOk(input.value);
    field.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };

  if (form) {
    const required = $$('[required]', form);
    required.forEach((input) => {
      input.addEventListener('blur', () => { if (input.value) validateField(input); });
      input.addEventListener('input', () => {
        if (input.closest('.field').classList.contains('is-invalid')) validateField(input);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = required.filter((input) => !validateField(input));
      if (invalid.length) { invalid[0].focus(); return; }

      // نسخه‌ی نمایشی: درخواست به سرور ارسال نمی‌شود.
      // برای نسخه‌ی رسمی، اینجا به API یا سرویس ایمیل متصل شود.
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      setTimeout(() => {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        button.disabled = false;
        form.reset();
      }, 700);
    });

    $('[data-form-reset]').addEventListener('click', () => {
      success.hidden = true;
      form.hidden = false;
      $('input', form).focus();
    });
  }

  /* ---------- Persian year in footer ---------- */
  try {
    const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' })
      .format(new Date())
      .replace(/[^۰-۹]/g, '');
    if (year) $$('[data-year]').forEach((el) => { el.textContent = year; });
  } catch (_) { /* keep the static year */ }
})();
