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
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gradeLabel = (g) => (/[۰-۹\d]/.test(g) ? `سایز ${g} انس` : g);
  // the same, for HTML: a size range never breaks after its dash ("۲۰–" on one line, "۲۲" on the next)
  const gradeHtml = (g) => (/[۰-۹\d]/.test(g) ? `سایز <span class="nw">${escapeHtml(g)}</span> انس` : escapeHtml(g));

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
  const groups = ['all', ...new Set(items.map((it) => it.group))];
  const lastDate = items[0].history[items[0].history.length - 1].date;
  const [, updatedTime = ''] = String(data.updatedAt || '').split('T');
  const time = toFa(updatedTime.replace(/^0(?=\d)/, ''));   // "۹:۳۰", not "۰۹:۳۰"

  /* ---------- freshness ---------- */
  // Prices come out once a day. Until today's board is published (early morning, Fridays,
  // holidays, a late update) the page names the last board's weekday instead of saying "today".
  const tehranToday = (() => {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day}`;
    } catch (_) { return ''; }
  })();
  const fresh = !tehranToday || lastDate >= tehranToday;
  const dayWord = fresh ? 'امروز' : faDate(lastDate, { weekday: 'long' });
  const statusText = fresh
    ? (time ? `به‌روزرسانی امروز، ساعت ${time}` : 'به‌روزرسانی امروز')
    : day(tehranToday).getUTCDay() === 5 ? 'جمعه‌ها قیمت اعلام نمی‌شود' : 'قیمت امروز هنوز اعلام نشده';

  $$('[data-day-text]').forEach((el) => { el.textContent = el.dataset.dayText.replace('{day}', dayWord); });
  if (!fresh) $$('.live-dot').forEach((el) => el.classList.add('is-stale'));

  /* ---------- sparkline ---------- */
  const sparkline = (values, w = 96, h = 34) => {
    if (values.length < 2) return '';
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

  /* ---------- ticker (home page) ---------- */
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

  /* ---------- date and status labels ---------- */
  $$('[data-price-pill-date]').forEach((el) => { el.textContent = faDate(lastDate, { day: 'numeric', month: 'long' }); });
  $$('[data-price-date]').forEach((el) => { el.textContent = faFullDate(lastDate); });
  $$('[data-price-status-title]').forEach((el) => { el.textContent = fresh ? 'قیمت‌های امروز' : 'آخرین قیمت‌های اعلام‌شده'; });
  $$('[data-price-status]').forEach((el) => { el.textContent = statusText; });
  $$('[data-price-time]').forEach((el) => { el.textContent = time; });
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
  // the average day-on-day change, how many items rose or fell, and an equal-weighted
  // trend line of the whole board over the last month (27 trading days)
  const avgChange = items.reduce((s, it) => s + it.changePct, 0) / items.length;
  const marketDir = trend(Math.round(avgChange * 1000));   // under 0.05% reads as unchanged
  $$('[data-market-change]').forEach((el) => {
    el.classList.add(`is-${marketDir}`);
    el.innerHTML = marketDir === 'flat' ? 'بدون تغییر' : `${triangle(marketDir)}<span class="sr-only">${TREND_TEXT[marketDir]} </span>${pct(avgChange)}`;
  });
  $$('[data-market-breadth]').forEach((el) => {
    el.innerHTML = [['up', 'گران‌تر'], ['down', 'ارزان‌تر'], ['flat', 'بدون تغییر']]
      .map(([dir, word]) => [dir, word, items.filter((it) => trend(it.change) === dir).length])
      .filter(([, , n]) => n)
      .map(([dir, word, n]) => `<span class="is-${dir}"><b>${toFa(n)}</b> قلم ${word}</span>`).join('');
  });
  const span = Math.min(27, ...items.map((it) => it.history.length));
  const tails = items.map((it) => it.history.slice(-span).map((p) => p.price));
  const marketSeries = tails[0].map((_, k) => tails.reduce((s, t) => s + t[k] / t[0], 0) / tails.length);
  $$('[data-market-spark]').forEach((el) => { el.innerHTML = sparkline(marketSeries, 160, 44); });
  $$('[data-market-span]').forEach((el) => {
    el.textContent = span === 27 ? 'روند یک ماه اخیر' : `روند ${toFa(span)} روز اخیر`;
    el.hidden = span < 2;
  });

  const ranked = [...items].sort((a, b) => b.changePct - a.changePct);
  const moverHtml = (it) => `<b>${escapeHtml(it.name)} <small>${gradeHtml(it.grade)}</small></b>${changePill(it.changePct)}`;
  const gainer = ranked[0], loser = ranked[ranked.length - 1];
  $$('[data-price-gainer]').forEach((el) => { el.innerHTML = gainer.changePct > 0 ? moverHtml(gainer) : `<b>${dayWord} رشدی ثبت نشد</b>`; });
  $$('[data-price-loser]').forEach((el) => { el.innerHTML = loser.changePct < 0 ? moverHtml(loser) : `<b>${dayWord} افتی ثبت نشد</b>`; });

  /* ---------- board ---------- */
  const list = $('[data-price-list]');
  const tabs = $('[data-price-tabs]');
  const detail = $('[data-price-detail]');
  // up to 1099px the detail panel is a bottom sheet that a row opens
  const sheetQuery = window.matchMedia('(max-width: 1099px)');
  // prices.html?g=akbari opens the board on one variety
  const linked = new URLSearchParams(location.search).get('g');
  let group = groups.includes(linked) ? linked : 'all';
  let rows = [];
  let selected = items.find((it) => group === 'all' || it.group === group);
  let picked = false;              // on phones no row looks selected until one is tapped
  let period = 27;
  let calcFollow = () => {};       // set by the calculator below

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

  const markSelected = () => {
    const show = picked || !sheetQuery.matches;
    $$('.br', list).forEach((b) => {
      const on = show && b.dataset.id === selected.id;
      b.classList.toggle('is-selected', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      if (sheetQuery.matches) b.setAttribute('aria-haspopup', 'dialog'); else b.removeAttribute('aria-haspopup');
    });
  };

  const renderBoard = (animate) => {
    rows = items.filter((it) => group === 'all' || it.group === group);
    list.innerHTML = rows.map((it, i) => `<li>
      <button class="br" type="button" data-id="${it.id}" aria-controls="price-detail" style="--i:${i}">
        <span class="br-name"><b>${escapeHtml(it.name)}</b> <small>${gradeHtml(it.grade)}</small></span>
        <span class="br-price"><b>${money(it.price)}</b> <small>تومان</small></span>
        <span class="br-change">${changePill(it.changePct)}${it.change ? ` <small dir="ltr">${signed(it.change)}</small>` : ''}</span>
        <span class="br-spark">${sparkline(it.week)}</span>
        <svg class="icon br-go" aria-hidden="true"><use href="#i-chevron-left"/></svg>
      </button>
    </li>`).join('');
    markSelected();
    if (animate) {
      countUp(rows.map((it) => ({ el: $(`[data-id="${it.id}"] .br-price b`, list), from: it.prev, to: it.price })));
    }
  };

  if (list && tabs) {
    tabs.innerHTML = groups.map((g) => `<button type="button" class="chip${g === group ? ' is-active' : ''}" data-group="${g}" aria-pressed="${g === group}">${g === 'all' ? 'همه' : escapeHtml(GROUPS[g] || g)}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-group]');
      if (!btn) return;
      group = btn.dataset.group;
      $$('.chip', tabs).forEach((c) => { const on = c === btn; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      // keep the address in step, so a filtered board can be bookmarked or sent
      try {
        const url = new URL(location.href);
        if (group === 'all') url.searchParams.delete('g'); else url.searchParams.set('g', group);
        history.replaceState(history.state, '', url);
      } catch (_) { /* file:// pages may refuse */ }
      renderBoard(false);
      // on wide screens the side panel follows the filter
      if (!sheetQuery.matches && !rows.includes(selected)) select(rows[0], false);
    });
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      select(byId.get(btn.dataset.id), true);
    });
    renderBoard(true);
    // a linked variety's chip may sit past the end of the scrolling chip row
    const chip = $('.chip.is-active', tabs);
    const r = chip.getBoundingClientRect(), t = tabs.getBoundingClientRect();
    if (r.left < t.left || r.right > t.right) tabs.scrollBy({ left: r.left < t.left ? r.left - t.left - 12 : r.right - t.right + 12 });
  }

  /* ---------- detail chart ---------- */
  const chartBox = detail && $('[data-detail-chart]', detail);
  const tooltip = chartBox && $('.chart-tip', chartBox);
  const chartLive = detail && $('[data-chart-live]', detail);

  const drawChart = () => {
    if (!chartBox) return;
    // a read-out left over from the previous chart would point at the wrong day
    tooltip.hidden = true;
    chartBox.querySelector('svg')?.remove();
    const series = selected.history.slice(-period);
    if (series.length < 2) return;
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
    // the time axis runs left to right, but each date is Persian text: written right to left,
    // so the first label ends at its tick (anchor "end") and the last one starts at it
    const ticks = Math.min(series.length - 1, w < 460 ? 3 : 4);
    const xlabs = Array.from({ length: ticks + 1 }, (_, k) => Math.round((k * (series.length - 1)) / ticks)).map((i, k, arr) => {
      const anchor = k === 0 ? 'end' : k === arr.length - 1 ? 'start' : 'middle';
      return `<text class="xlab" x="${x(i).toFixed(1)}" y="${h - 8}" direction="rtl" text-anchor="${anchor}">${faDate(series[i].date, { day: 'numeric', month: 'long' })}</text>`;
    }).join('');
    const lx = x(series.length - 1), ly = y(prices[prices.length - 1]);
    const periodText = $('[data-period].is-active', detail)?.textContent.trim() || '';
    const label = `نمودار قیمت ${selected.name} ${gradeLabel(selected.grade)} در ${periodText} اخیر، از ${money(prices[0])} تا ${money(prices[prices.length - 1])} تومان. با کلیدهای جهت‌نما روزها را مرور کنید.`;

    chartBox.insertAdjacentHTML('afterbegin', `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" tabindex="0"
        aria-label="${escapeHtml(label)}">
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

    // hover / touch / keyboard read-out
    const svg = chartBox.querySelector('svg');
    const cross = svg.querySelector('.cross');
    const crossDot = svg.querySelector('.cross-dot');
    let cur = series.length - 1;
    const readout = (i) => `${faDate(series[i].date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${money(series[i].price)} تومان`;
    const show = (i) => {
      cur = i;
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
    const indexAt = (clientX) => {
      const r = svg.getBoundingClientRect();
      return Math.max(0, Math.min(series.length - 1, Math.round(((clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (series.length - 1))));
    };
    svg.addEventListener('pointermove', (e) => show(indexAt(e.clientX)));
    svg.addEventListener('pointerdown', (e) => show(indexAt(e.clientX)));
    // on touch the read-out stays after the finger lifts; a mouse hides it on leaving the chart
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('focus', () => show(cur));
    svg.addEventListener('blur', hide);
    // arrows step through the days (older to the left, as drawn), Home and End jump to the ends
    svg.addEventListener('keydown', (e) => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, PageDown: -5, PageUp: 5, Home: -Infinity, End: Infinity };
      if (!(e.key in steps)) return;
      e.preventDefault();
      show(Math.max(0, Math.min(series.length - 1, cur + steps[e.key])));
      if (chartLive) chartLive.textContent = readout(cur);
    });
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

  /* ---------- phones and tablets: the detail panel is a bottom sheet ---------- */
  const backdrop = $('[data-detail-backdrop]');
  const setSheet = (open, { restoreFocus = true } = {}) => {
    if (!detail) return;
    const wasOpen = detail.classList.contains('is-open');
    detail.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('sheet-open', open);
    if (open) {
      detail.setAttribute('role', 'dialog');
      detail.setAttribute('aria-modal', 'true');
      requestAnimationFrame(drawChart);
      $('[data-detail-close]', detail)?.focus({ preventScroll: true });
    } else {
      detail.removeAttribute('role');
      detail.removeAttribute('aria-modal');
      // back to the row that opened the sheet
      if (wasOpen && restoreFocus && list) $(`.br[data-id="${selected.id}"]`, list)?.focus({ preventScroll: true });
    }
  };
  $('[data-detail-close]')?.addEventListener('click', () => setSheet(false));
  backdrop?.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detail?.classList.contains('is-open')) setSheet(false); });
  sheetQuery.addEventListener('change', (e) => {
    if (!e.matches) setSheet(false, { restoreFocus: false });
    if (list) markSelected();
  });

  if (detail) {
    // keep Tab inside the open sheet
    detail.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !detail.classList.contains('is-open')) return;
      const stops = $$('button, a[href], [tabindex="0"]', detail).filter((el) => el.getClientRects().length);
      const first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // pull the sheet down to close it, as its handle suggests; the chart keeps its own touch read-out
    let drag = null;
    detail.addEventListener('touchstart', (e) => {
      if (!detail.classList.contains('is-open') || e.touches.length > 1 || e.target.closest('.chart-box')) return;
      drag = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0, on: false };
    }, { passive: true });
    detail.addEventListener('touchmove', (e) => {
      if (!drag) return;
      const dy = e.touches[0].clientY - drag.y;
      if (!drag.on) {
        // moving up, or with the sheet's own content scrolled: an ordinary scroll
        if (dy <= 0 || detail.scrollTop > 0) { drag = null; return; }
        e.preventDefault();
        if (dy < 6) return;
        drag.on = true;
        detail.classList.add('is-dragging');
        backdrop?.classList.add('is-dragging');
      }
      e.preventDefault();
      drag.dy = dy;
      detail.style.transform = `translateY(${Math.max(0, dy)}px)`;
      if (backdrop) backdrop.style.opacity = String(Math.max(0, 1 - dy / 500));
    }, { passive: false });
    const endDrag = (e) => {
      if (!drag) return;
      const { dy, t, on } = drag;
      drag = null;
      if (!on) return;
      detail.classList.remove('is-dragging');
      detail.style.transform = '';
      if (backdrop) { backdrop.classList.remove('is-dragging'); backdrop.style.opacity = ''; }
      if (dy > 120 || (dy > 40 && dy / Math.max(1, e.timeStamp - t) > 0.5)) setSheet(false);
    };
    detail.addEventListener('touchend', endDrag);
    detail.addEventListener('touchcancel', endDrag);
  }

  function select(item, fromUser) {
    if (!item) return;
    selected = item;
    if (fromUser) picked = true;
    if (list) markSelected();
    renderDetail();
    calcFollow(item);
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
    const tons = $('[data-calc-tons]', calc);
    const sell = $('[data-calc-sell]', calc);
    const rateDate = faDate(lastDate, { day: 'numeric', month: 'long' });
    // grouped by variety, so the sizes are easy to find in the phone's picker
    product.innerHTML = groups.filter((g) => g !== 'all').map((g) => `<optgroup label="${escapeHtml(GROUPS[g] || g)}">${items.filter((it) => it.group === g)
      .map((it) => `<option value="${it.id}">${escapeHtml(it.name)} — ${escapeHtml(gradeLabel(it.grade))}</option>`).join('')}</optgroup>`).join('');
    product.value = selected.id;

    // "۱٬۲۵۰٫۵", "1,250.5" and "۱۲۵۰/۵" all mean 1250.5 kg: Persian or Latin digits,
    // ٫ / or . for the decimal point, ٬ or , between thousands
    const clean = (s) => toEn(s).replace(/[٫/]/g, '.').replace(/[^\d.]/g, '');
    const parseKg = (s) => {
      const [int = '', ...dec] = clean(s).split('.');
      return Number(`${int || 0}.${dec.join('') || 0}`);
    };
    const kgText = (kg) => kg.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
    // thousands separators while typing; the caret stays after the same digit
    const formatWeight = () => {
      const raw = weight.value;
      const caret = weight.selectionStart ?? raw.length;
      const before = clean(raw.slice(0, caret)).length;
      const [int = '', ...dec] = clean(raw).split('.');
      const digits = int.replace(/^0+(?=\d)/, '').slice(0, 7);          // up to 9٬999٬999 kg
      const fraction = clean(raw).includes('.') ? `٫${toFa(dec.join('').slice(0, 2))}` : '';
      const out = (digits ? Number(digits).toLocaleString('fa-IR') : fraction ? '۰' : '') + fraction;
      if (out === raw) return;
      weight.value = out;
      if (document.activeElement !== weight) return;
      let pos = 0;
      for (let n = 0; pos < out.length && n < before; pos++) if (/[۰-۹٫]/.test(out[pos])) n++;
      weight.setSelectionRange(pos, pos);
    };

    let touched = false;             // the farmer picked a product in the calculator itself
    const update = () => {
      const it = byId.get(product.value) || items[0];
      const kg = parseKg(weight.value);
      const amount = it.price * kg;
      total.textContent = kg ? money(amount) : '—';
      words.textContent = kg ? `یعنی حدود ${spokenAmount(amount)} تومان` : 'وزن محصول را وارد کنید';
      unit.innerHTML = `نرخ ${rateDate}: ${money(it.price)} تومان برای هر کیلوگرم <span class="nw">${escapeHtml(it.name)} ${escapeHtml(gradeLabel(it.grade))}</span>`;
      if (tons) tons.textContent = kg >= 1000 ? `یعنی ${kgText(kg / 1000)} تن` : '';
      $$('[data-kg]', calc).forEach((c) => c.classList.toggle('is-active', Number(c.dataset.kg) === kg));
      // the sale request on the home page arrives filled in with what the farmer entered here
      if (sell) {
        const params = new URLSearchParams({ request: 'sell', product: it.group });
        if (kg) {
          params.set('amount', kg < 100 ? 'lt100' : kg < 500 ? '100-500' : kg <= 5000 ? '500-5000' : 'gt5000');
          params.set('note', `${it.name} ${gradeLabel(it.grade)}، حدود ${kgText(kg)} کیلوگرم؛ ارزش تقریبی با نرخ ${rateDate}: ${spokenAmount(amount)} تومان`);
        }
        sell.href = `index.html?${params}#contact`;
      }
    };
    product.addEventListener('change', () => { touched = true; update(); });
    weight.addEventListener('input', (e) => { if (!e.isComposing) formatWeight(); update(); });
    $$('[data-kg]', calc).forEach((chip) => chip.addEventListener('click', () => { weight.value = Number(chip.dataset.kg).toLocaleString('fa-IR'); update(); }));
    formatWeight();
    update();

    // the calculator shows whatever the farmer last looked at on the board, until they choose here
    calcFollow = (item) => {
      if (touched) return;
      product.value = item.id;
      update();
    };

    $$('[data-detail-calc]').forEach((btn) => btn.addEventListener('click', () => {
      product.value = selected.id;
      touched = true;
      update();
      setSheet(false, { restoreFocus: false });
      $('#calculator')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => weight.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
    }));
  }

  /* ---------- share today's prices ---------- */
  const shareButtons = $$('[data-price-share]');
  if (shareButtons.length) {
    const toast = document.createElement('p');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
    let toastTimer;
    const notify = (message) => {
      toast.textContent = message;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
    };

    shareButtons.forEach((btn) => btn.addEventListener('click', async () => {
      // the board's button sends the variety on screen; the one in the channel box sends the whole board
      const filtered = !!btn.closest('.board') && group !== 'all';
      const lines = (filtered ? rows : items).map((it) => `${it.name} ${it.grade}: ${money(it.price)} تومان (${it.change > 0 ? '▲' : it.change < 0 ? '▼' : '●'} ${pct(it.changePct)})`);
      const title = `قیمت روز پسته ایلیا — ${faFullDate(lastDate)}`;
      const text = `${title}\n${data.priceType} (تومان / کیلوگرم)\n\n${lines.join('\n')}${data.sample ? '\n\n(قیمت‌ها نمونه است)' : ''}`;
      const url = new URL(location.href);
      url.hash = '';
      if (!filtered) url.searchParams.delete('g');
      try {
        if (navigator.share) { await navigator.share({ title, text, url: url.href }); return; }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
      // no share sheet (most desktop browsers): copy the message rather than open WhatsApp Web
      try {
        await navigator.clipboard.writeText(`${text}\n\n${url.href}`);
        notify('قیمت‌ها کپی شد؛ در واتس‌اپ یا هر پیام‌رسان دیگری بچسبانید.');
      } catch (_) {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url.href}`)}`, '_blank', 'noopener');
      }
    }));
  }
})();
