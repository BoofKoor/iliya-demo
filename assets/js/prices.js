/* پسته ایلیا — تابلوی قیمت روز
 * Renders whatever parts exist on the page: price ticker, hero pill, market summary,
 * price board, detail chart, value calculator and share button. Data: window.ILIYA_PRICES.
 */
(() => {
  'use strict';

  const data = window.ILIYA_PRICES;
  if (!data || !Array.isArray(data.items) || !data.items.length) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- formatting ---------- */
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
  const toEn = (v) => String(v)
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const money = (n) => Math.round(n).toLocaleString('fa-IR');
  const pct = (x) => `${(Math.abs(x) * 100).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
  const millions = (n) => (n / 1e6).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const day = (iso) => new Date(`${iso}T12:00:00Z`);
  const faDate = (iso, opts) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', ...opts }).format(day(iso));
  // "سه‌شنبه ۲۱ مهر ۱۴۰۵" — weekday and year together come out in an odd order from Intl, so join the parts
  const faFullDate = (iso) => `${faDate(iso, { weekday: 'long' })} ${faDate(iso, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const trend = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
  const TREND_TEXT = { up: 'افزایش', down: 'کاهش', flat: 'بدون تغییر' };
  const gradeLabel = (g) => (/[۰-۹\d]/.test(g) ? `سایز ${g} انس` : g);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // "۲ میلیارد و ۱۵۰ میلیون" — easier to read than a ten-digit number
  const spokenAmount = (n) => {
    n = Math.round(n);
    if (n === 0) return '۰';
    const scales = [[1e12, 'هزار میلیارد'], [1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار'], [1, '']];
    const parts = [];
    for (const [size, name] of scales) {
      const chunk = Math.floor(n / size);
      if (chunk) { parts.push(`${chunk.toLocaleString('fa-IR')}${name ? ` ${name}` : ''}`); n -= chunk * size; }
    }
    return parts.join(' و ');
  };

  const triangle = (dir) => (dir === 'flat'
    ? '<svg class="tri" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="4" width="8" height="2" rx="1"/></svg>'
    : `<svg class="tri" viewBox="0 0 10 10" aria-hidden="true"><path d="${dir === 'up' ? 'M5 1.5 9 8.5H1Z' : 'M5 8.5 1 1.5h8Z'}"/></svg>`);
  const changePill = (x) => {
    const dir = trend(x);
    return `<span class="chg is-${dir}">${triangle(dir)}<span class="sr-only">${TREND_TEXT[dir]} </span>${dir === 'flat' ? 'ثابت' : pct(x)}</span>`;
  };

  /* ---------- derived data ---------- */
  const GROUPS = { akbari: 'اکبری', 'ahmad-aghaei': 'احمدآقایی', 'kalleh-ghouchi': 'کله‌قوچی', fandoghi: 'فندقی', badami: 'بادامی', other: 'سایر' };
  const items = data.items.map((it) => {
    const h = it.history;
    const last = h[h.length - 1];
    const prev = h[h.length - 2] || last;
    return {
      ...it,
      price: last.price,
      prev: prev.price,
      change: last.price - prev.price,
      changePct: (last.price - prev.price) / prev.price,
      week: h.slice(-7).map((p) => p.price),
    };
  });
  const byId = new Map(items.map((it) => [it.id, it]));
  const lastDate = items[0].history[items[0].history.length - 1].date;
  const [, updatedTime = ''] = String(data.updatedAt || '').split('T');

  // equal-weighted price index, 1000 = first day of the history
  const indexSeries = items[0].history.map((_, i) => 1000 * items.reduce((s, it) => s + it.history[i].price / it.history[0].price, 0) / items.length);

  /* ---------- sparkline ---------- */
  const sparkline = (values, w = 96, h = 34) => {
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    const dir = trend(values[values.length - 1] - values[0]);
    const last = pts[pts.length - 1];
    return `<svg class="spark is-${dir}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${line}L${w} ${h}L0 ${h}Z" fill="url(#spark-${dir})"/>
      <path class="spark-line" d="${line}"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.2"/>
    </svg>`;
  };
  if (!$('#spark-up')) {
    document.body.insertAdjacentHTML('afterbegin', `<svg class="sprite" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="spark-up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A6CE39" stop-opacity=".32"/><stop offset="1" stop-color="#A6CE39" stop-opacity="0"/></linearGradient>
      <linearGradient id="spark-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0643C" stop-opacity=".3"/><stop offset="1" stop-color="#F0643C" stop-opacity="0"/></linearGradient>
      <linearGradient id="spark-flat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9D29A" stop-opacity=".25"/><stop offset="1" stop-color="#E9D29A" stop-opacity="0"/></linearGradient>
      <linearGradient id="chart-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9D29A" stop-opacity=".34"/><stop offset=".7" stop-color="#C9A45C" stop-opacity=".06"/><stop offset="1" stop-color="#C9A45C" stop-opacity="0"/></linearGradient>
    </defs></svg>`);
  }

  /* ---------- ticker (home page and price page) ---------- */
  $$('[data-price-ticker]').forEach((ticker) => {
    const track = $('.marquee-track', ticker);
    if (!track) return;
    const group = items.map((it) => `<span class="tk">
        <span class="tk-name">${escapeHtml(it.name)} <small>${escapeHtml(it.grade)}</small></span>
        <span class="tk-price">${money(it.price)}</span>${changePill(it.changePct)}
      </span><i class="tk-sep">✦</i>`).join('');
    track.innerHTML = `<div class="marquee-group">${group}</div><div class="marquee-group">${group}</div>`;
    // constant reading speed, whatever the number of items
    requestAnimationFrame(() => {
      const width = track.firstElementChild.getBoundingClientRect().width;
      if (width) track.style.animationDuration = `${Math.max(30, width / 45)}s`;
    });
  });

  /* ---------- small date labels ---------- */
  $$('[data-price-pill-date]').forEach((el) => { el.textContent = faDate(lastDate, { day: 'numeric', month: 'long' }); });
  $$('[data-price-weekday]').forEach((el) => { el.textContent = faDate(lastDate, { weekday: 'long' }); });
  $$('[data-price-date]').forEach((el) => { el.textContent = faDate(lastDate, { day: 'numeric', month: 'long', year: 'numeric' }); });
  $$('[data-price-time]').forEach((el) => { el.textContent = toFa(updatedTime); });
  $$('[data-price-type]').forEach((el) => { el.textContent = data.priceType; });
  if (data.sample) $$('[data-sample-note]').forEach((el) => { el.hidden = false; });

  /* ---------- channel message preview ---------- */
  $$('[data-price-preview-title]').forEach((el) => { el.textContent = `قیمت روز پسته — ${faDate(lastDate, { weekday: 'long', day: 'numeric', month: 'long' })}`; });
  $$('[data-price-preview]').forEach((el) => {
    el.innerHTML = items.slice(0, 5).map((it) => {
      const dir = trend(it.changePct);
      return `<li><b>${escapeHtml(it.name)} ${escapeHtml(it.grade)}</b><span>${money(it.price)} <i class="cp-dir is-${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●'}</i></span></li>`;
    }).join('');
  });

  /* ---------- market summary ---------- */
  const idxNow = indexSeries[indexSeries.length - 1];
  const idxPrev = indexSeries[indexSeries.length - 2] || idxNow;
  $$('[data-price-index]').forEach((el) => {
    el.textContent = idxNow.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  });
  $$('[data-price-index-change]').forEach((el) => { el.innerHTML = changePill((idxNow - idxPrev) / idxPrev); });
  $$('[data-price-index-spark]').forEach((el) => { el.innerHTML = sparkline(indexSeries.slice(-30), 160, 44); });
  const ranked = [...items].sort((a, b) => b.changePct - a.changePct);
  const moverHtml = (it) => `<b>${escapeHtml(it.name)} <small>${escapeHtml(gradeLabel(it.grade))}</small></b>${changePill(it.changePct)}`;
  const gainer = ranked[0], loser = ranked[ranked.length - 1];
  $$('[data-price-gainer]').forEach((el) => { el.innerHTML = gainer.changePct > 0 ? moverHtml(gainer) : '<b>امروز رشدی ثبت نشد</b>'; });
  $$('[data-price-loser]').forEach((el) => { el.innerHTML = loser.changePct < 0 ? moverHtml(loser) : '<b>امروز افتی ثبت نشد</b>'; });

  /* ---------- board ---------- */
  const list = $('[data-price-list]');
  const tabs = $('[data-price-tabs]');
  const detail = $('[data-price-detail]');
  let selected = items[0];
  let period = 27;

  const countUp = (els) => {
    if (reduceMotion) return;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1100);
      const e = 1 - Math.pow(1 - t, 3);
      els.forEach(({ el, from, to }) => { el.textContent = money(from + (to - from) * e); });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const renderBoard = (groupKey, animate) => {
    const rows = items.filter((it) => groupKey === 'all' || it.group === groupKey);
    list.innerHTML = rows.map((it, i) => `<li>
      <button class="br${it === selected ? ' is-selected' : ''}" type="button" data-id="${it.id}" aria-pressed="${it === selected}" style="--i:${i}">
        <span class="br-name"><b>${escapeHtml(it.name)}</b><small>${escapeHtml(gradeLabel(it.grade))}</small></span>
        <span class="br-price"><b>${money(it.price)}</b><small>تومان</small></span>
        <span class="br-change">${changePill(it.changePct)}${it.change ? `<small dir="ltr">${signed(it.change)}</small>` : ''}</span>
        <span class="br-spark">${sparkline(it.week)}</span>
      </button>
    </li>`).join('');
    if (animate) {
      countUp(rows.map((it, i) => ({ el: $(`[data-id="${it.id}"] .br-price b`, list), from: it.prev, to: it.price, i })));
    }
  };

  if (list && tabs) {
    const groups = ['all', ...new Set(items.map((it) => it.group))];
    tabs.innerHTML = groups.map((g, i) => `<button type="button" class="chip${i === 0 ? ' is-active' : ''}" data-group="${g}" aria-pressed="${i === 0}">${g === 'all' ? 'همه' : escapeHtml(GROUPS[g] || g)}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-group]');
      if (!btn) return;
      $$('.chip', tabs).forEach((c) => { const on = c === btn; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      renderBoard(btn.dataset.group, false);
    });
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      select(byId.get(btn.dataset.id), true);
    });
    renderBoard('all', true);
  }

  /* ---------- detail chart ---------- */
  const chartBox = detail && $('[data-detail-chart]', detail);
  const tooltip = chartBox && $('.chart-tip', chartBox);

  const drawChart = () => {
    if (!chartBox) return;
    const series = selected.history.slice(-period);
    const w = Math.max(280, chartBox.clientWidth);
    const h = chartBox.clientHeight || 260;
    const pad = { t: 18, r: 58, b: 30, l: 8 };
    const prices = series.map((p) => p.price);
    let min = Math.min(...prices), max = Math.max(...prices);
    const margin = (max - min || max * 0.02) * 0.18;
    min -= margin; max += margin;
    const x = (i) => pad.l + (i / (series.length - 1)) * (w - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

    const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join('');
    const area = `${line}L${x(series.length - 1).toFixed(1)} ${h - pad.b}L${x(0).toFixed(1)} ${h - pad.b}Z`;
    const grid = [0, 1, 2, 3].map((k) => {
      const v = min + ((max - min) * (k + 0.5)) / 4;
      return `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
        <text class="ylab" x="${w - pad.r + 10}" y="${(y(v) + 4).toFixed(1)}">${millions(v)}</text>`;
    }).join('');
    const ticks = Math.min(series.length - 1, w < 460 ? 3 : 4);
    const xlabs = Array.from({ length: ticks + 1 }, (_, k) => Math.round((k * (series.length - 1)) / ticks)).map((i, k, arr) => {
      const anchor = k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle';
      return `<text class="xlab" x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="${anchor}">${faDate(series[i].date, { day: 'numeric', month: 'long' })}</text>`;
    }).join('');
    const lx = x(series.length - 1), ly = y(prices[prices.length - 1]);

    chartBox.querySelector('svg')?.remove();
    chartBox.insertAdjacentHTML('afterbegin', `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"
        aria-label="نمودار قیمت ${escapeHtml(selected.name)} ${escapeHtml(gradeLabel(selected.grade))}">
      ${grid}
      <path class="chart-area" d="${area}" fill="url(#chart-gold)"/>
      <path class="chart-line" d="${line}"/>
      <line class="last-line" x1="${pad.l}" x2="${w - pad.r}" y1="${ly.toFixed(1)}" y2="${ly.toFixed(1)}"/>
      <rect class="last-tag" x="${w - pad.r + 4}" y="${(ly - 11).toFixed(1)}" width="${pad.r - 6}" height="22" rx="6"/>
      <text class="last-tag-text" x="${(w - pad.r / 2 + 1).toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle">${millions(prices[prices.length - 1])}</text>
      <circle class="last-glow" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="9"/>
      <circle class="last-dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4"/>
      ${xlabs}
      <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${h - pad.b}"/>
      <circle class="cross-dot" cx="0" cy="0" r="5"/>
    </svg>`);

    // hover / touch read-out
    const svg = chartBox.querySelector('svg');
    const cross = svg.querySelector('.cross');
    const crossDot = svg.querySelector('.cross-dot');
    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(series.length - 1, Math.round(((clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (series.length - 1))));
      const px = x(i), py = y(series[i].price);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px);
      crossDot.setAttribute('cx', px); crossDot.setAttribute('cy', py);
      svg.classList.add('is-hover');
      tooltip.innerHTML = `<span>${faDate(series[i].date, { weekday: 'long', day: 'numeric', month: 'long' })}</span><b>${money(series[i].price)} <small>تومان</small></b>`;
      tooltip.hidden = false;
      const tw = tooltip.offsetWidth;
      tooltip.style.left = `${Math.min(Math.max(px - tw / 2, 4), w - tw - 4)}px`;
      tooltip.style.top = `${Math.max(py - 70, 0)}px`;
    };
    const hide = () => { svg.classList.remove('is-hover'); tooltip.hidden = true; };
    svg.addEventListener('pointermove', (e) => show(e.clientX));
    svg.addEventListener('pointerdown', (e) => show(e.clientX));
    // on touch the read-out stays after the finger lifts; a mouse hides it on leaving the chart
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  };

  const renderDetail = () => {
    if (!detail) return;
    $('[data-detail-name]', detail).textContent = selected.name;
    $('[data-detail-grade]', detail).textContent = gradeLabel(selected.grade);
    $('[data-detail-price]', detail).textContent = money(selected.price);
    $('[data-detail-change]', detail).innerHTML = `${changePill(selected.changePct)}<small>${selected.change
      ? `<span dir="ltr">${signed(selected.change)}</span> تومان نسبت به روز قبل`
      : 'بدون تغییر نسبت به روز قبل'}</small>`;
    const series = selected.history.slice(-period).map((p) => p.price);
    const first = series[0], last = series[series.length - 1];
    const stats = [
      ['بیشترین', money(Math.max(...series))],
      ['کمترین', money(Math.min(...series))],
      ['میانگین', money(Math.round(series.reduce((s, v) => s + v, 0) / series.length / 1000) * 1000)],
      ['تغییر دوره', changePill((last - first) / first)],
    ];
    $('[data-detail-stats]', detail).innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    drawChart();
  };

  /* ---------- mobile bottom sheet ---------- */
  const sheetQuery = window.matchMedia('(max-width: 1023px)');
  const backdrop = $('[data-detail-backdrop]');
  const setSheet = (open) => {
    if (!detail) return;
    detail.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('sheet-open', open);
    if (open) {
      requestAnimationFrame(drawChart);
      $('[data-detail-close]', detail)?.focus({ preventScroll: true });
    }
  };
  $('[data-detail-close]')?.addEventListener('click', () => setSheet(false));
  backdrop?.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detail?.classList.contains('is-open')) setSheet(false); });
  sheetQuery.addEventListener('change', (e) => { if (!e.matches) setSheet(false); });

  function select(item, fromUser) {
    if (!item) return;
    selected = item;
    $$('.br', list).forEach((b) => { const on = b.dataset.id === item.id; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', String(on)); });
    renderDetail();
    if (fromUser && sheetQuery.matches) setSheet(true);
  }

  if (detail) {
    $('[data-detail-periods]', detail).addEventListener('click', (e) => {
      const btn = e.target.closest('[data-period]');
      if (!btn) return;
      period = Number(btn.dataset.period);
      $$('[data-period]', detail).forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
      renderDetail();
    });
    if ('ResizeObserver' in window) {
      let raf;
      new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawChart); }).observe(chartBox);
    }
    renderDetail();
  }

  /* ---------- value calculator ---------- */
  const calc = $('[data-calc]');
  if (calc) {
    const product = $('[data-calc-product]', calc);
    const weight = $('[data-calc-weight]', calc);
    const total = $('[data-calc-total]', calc);
    const words = $('[data-calc-words]', calc);
    const unit = $('[data-calc-unit]', calc);
    product.innerHTML = items.map((it) => `<option value="${it.id}">${escapeHtml(it.name)} — ${escapeHtml(gradeLabel(it.grade))}</option>`).join('');

    const update = () => {
      const it = byId.get(product.value) || items[0];
      const kg = Math.min(1e7, Number(toEn(weight.value).replace(/[^\d.]/g, '')) || 0);
      const amount = it.price * kg;
      total.textContent = money(amount);
      words.textContent = kg ? `یعنی حدود ${spokenAmount(amount)} تومان` : 'وزن محصول را وارد کنید';
      unit.textContent = `${money(it.price)} تومان برای هر کیلوگرم ${it.name} ${gradeLabel(it.grade)}`;
      $$('[data-kg]', calc).forEach((c) => c.classList.toggle('is-active', Number(c.dataset.kg) === kg));
    };
    product.addEventListener('change', update);
    weight.addEventListener('input', update);
    $$('[data-kg]', calc).forEach((chip) => chip.addEventListener('click', () => { weight.value = toFa(chip.dataset.kg); update(); }));
    update();

    $$('[data-detail-calc]').forEach((btn) => btn.addEventListener('click', () => {
      product.value = selected.id;
      update();
      setSheet(false);
      $('#calculator')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => weight.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
    }));
  }

  /* ---------- share today's prices ---------- */
  $$('[data-price-share]').forEach((btn) => btn.addEventListener('click', async () => {
    const lines = items.map((it) => `${it.name} ${it.grade}: ${money(it.price)} تومان (${it.change > 0 ? '▲' : it.change < 0 ? '▼' : '●'} ${pct(it.changePct)})`);
    const title = `قیمت روز پسته ایلیا — ${faFullDate(lastDate)}`;
    const text = `${title}\n${data.priceType} (تومان / کیلوگرم)\n\n${lines.join('\n')}${data.sample ? '\n\n(قیمت‌ها نمونه است)' : ''}`;
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`, '_blank', 'noopener');
  }));
})();
