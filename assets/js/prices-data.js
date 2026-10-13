/* داده‌ی تابلوی قیمت روز — نسخه‌ی نمایشی
 *
 * قیمت‌های این فایل «نمونه» هستند و هر بار نسبت به تاریخ امروز ساخته می‌شوند تا دمو همیشه به‌روز به نظر برسد.
 * در نسخه‌ی رسمی، این فایل با داده‌ی واقعی (پنل مدیریت یا API) جایگزین می‌شود و فقط باید همین ساختار را بسازد:
 *
 *   window.ILIYA_PRICES = {
 *     sample: false,
 *     priceType: 'نرخ خرید پسته‌ی خشک از باغداران',
 *     updatedAt: '2026-10-13T09:30',          // زمان تهران
 *     items: [
 *       { id, group, name, grade, history: [{ date: 'YYYY-MM-DD', price }, …] }   // قدیمی به جدید، تومان برای هر کیلوگرم
 *     ]
 *   };
 */
(function () {
  'use strict';

  // [id, group, name, grade, today's price (Toman / kg)]
  const ITEMS = [
    ['akbari-20-22', 'akbari', 'اکبری', '۲۰–۲۲', 2150000],
    ['akbari-22-24', 'akbari', 'اکبری', '۲۲–۲۴', 1980000],
    ['akbari-24-26', 'akbari', 'اکبری', '۲۴–۲۶', 1840000],
    ['ahmad-22-24', 'ahmad-aghaei', 'احمدآقایی', '۲۲–۲۴', 1870000],
    ['ahmad-24-26', 'ahmad-aghaei', 'احمدآقایی', '۲۴–۲۶', 1760000],
    ['ahmad-26-28', 'ahmad-aghaei', 'احمدآقایی', '۲۶–۲۸', 1650000],
    ['kalleh-20-22', 'kalleh-ghouchi', 'کله‌قوچی', '۲۰–۲۲', 2060000],
    ['kalleh-22-24', 'kalleh-ghouchi', 'کله‌قوچی', '۲۲–۲۴', 1920000],
    ['fandoghi-28-30', 'fandoghi', 'فندقی', '۲۸–۳۰', 1480000],
    ['fandoghi-30-32', 'fandoghi', 'فندقی', '۳۰–۳۲', 1390000],
    ['fandoghi-32-34', 'fandoghi', 'فندقی', '۳۲–۳۴', 1310000],
    ['badami-26-28', 'badami', 'بادامی', '۲۶–۲۸', 1620000],
    ['badami-28-30', 'badami', 'بادامی', '۲۸–۳۰', 1540000],
    ['closed-mixed', 'other', 'دهان‌بست', 'مخلوط', 980000],
    ['kernel-green', 'other', 'مغز پسته', 'سبز', 4350000],
  ];
  const TRADING_DAYS = 130;          // about five months of history
  const PUBLISH = { hour: 9, minute: 30 };

  // --- deterministic pseudo-random numbers, so the sample looks the same on every visit
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gaussian = (rand) => {
    const u = Math.max(rand(), 1e-9), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const hash = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

  // --- calendar days in Tehran time; Friday has no market
  const tehranNow = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { day: Date.UTC(+parts.year, +parts.month - 1, +parts.day), minutes: +parts.hour * 60 + +parts.minute };
  };
  const DAY = 86400000;
  const isFriday = (t) => new Date(t).getUTCDay() === 5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  const now = tehranNow();
  let latest = now.day;
  if (now.minutes < PUBLISH.hour * 60 + PUBLISH.minute) latest -= DAY;   // today's board is not published yet
  while (isFriday(latest)) latest -= DAY;

  const days = [];
  for (let t = latest; days.length < TRADING_DAYS; t -= DAY) if (!isFriday(t)) days.unshift(iso(t));

  // --- random walk backwards from today's price: a shared market move plus a per-item move
  const marketRand = mulberry32(247);
  const market = days.map(() => 0.0007 + 0.0055 * gaussian(marketRand));
  const round = (price, step) => Math.round(price / step) * step;

  const items = ITEMS.map(([id, group, name, grade, today]) => {
    const rand = mulberry32(hash(id));
    const step = today >= 3000000 ? 10000 : 5000;
    const prices = new Array(days.length);
    let p = today;
    for (let i = days.length - 1; i >= 0; i--) {
      prices[i] = round(p, step);
      p /= 1 + market[i] + 0.0045 * gaussian(rand);
    }
    return { id, group, name, grade, history: days.map((date, i) => ({ date, price: prices[i] })) };
  });

  window.ILIYA_PRICES = {
    sample: true,
    priceType: 'نرخ خرید پسته‌ی خشک از باغداران',
    updatedAt: `${iso(latest)}T${String(PUBLISH.hour).padStart(2, '0')}:${String(PUBLISH.minute).padStart(2, '0')}`,
    items,
  };
})();
