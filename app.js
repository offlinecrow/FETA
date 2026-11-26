(() => {
'use strict';

/* ---------- Constants ---------- */

// Change this with every release, together with VERSION in sw.js.
const APP_VERSION = '71';
const KEY = 'budgetnest.v2';
const OLD_KEY = 'budgetnest.v1';
const TYPES = ['expense', 'income', 'saving'];
const TYPE_LABEL = { expense: 'Expense', income: 'Income', saving: 'Savings' };
const TYPE_PLURAL = { expense: 'Expenses', income: 'Income', saving: 'Savings' };
const ADD_TITLE = { expense: 'Add an expense', income: 'Add income', saving: 'Add savings' };

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'LKR', 'NPR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
  'JOD', 'EGP', 'MAD', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'HKD', 'SGD', 'MYR', 'IDR', 'PHP', 'THB', 'VND', 'KRW',
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'ZAR', 'NGN', 'KES', 'GHS', 'BRL', 'MXN'];

const REGION_CURRENCY = { BD: 'BDT', US: 'USD', GB: 'GBP', IN: 'INR', PK: 'PKR', LK: 'LKR', NP: 'NPR', AE: 'AED', SA: 'SAR',
  QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', EG: 'EGP', MA: 'MAD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY',
  CN: 'CNY', HK: 'HKD', SG: 'SGD', MY: 'MYR', ID: 'IDR', PH: 'PHP', TH: 'THB', VN: 'VND', KR: 'KRW', CH: 'CHF', SE: 'SEK',
  NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS', BR: 'BRL', MX: 'MXN', DE: 'EUR',
  FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR' };

/* ---------- Languages ---------- */

// The app is written in English. For the other languages, lang.js holds a list of every piece of text with its
// translation, and whatever appears on screen is swapped for its translation as it is shown. Text with no
// translation yet simply stays in English. The choice is kept on the device, so each phone can have its own.
const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা']];
const LANG_KEY = 'budgetnest.lang';

// First guess: Bangla in Bangladesh, Hindi in India (from the device's time zone), then the device's own language.
function guessLang() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* unknown */ }
  if (zone === 'Asia/Dhaka') return 'bn';
  if (zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta') return 'hi';
  const own = (navigator.language || '').toLowerCase();
  if (own.startsWith('bn')) return 'bn';
  if (own.startsWith('hi')) return 'hi';
  return 'en';
}
function storedLang() {
  try { const v = localStorage.getItem(LANG_KEY); return LANGS.some(([id]) => id === v) ? v : ''; } catch (e) { return ''; }
}
let lang = storedLang() || guessLang();
// Dates are written in the chosen language, with the same digits as the amounts.
const LOCALE = () => ({ hi: 'hi-IN-u-nu-latn', bn: 'bn-BD-u-nu-latn' }[lang]);

const langPack = () => (lang === 'en' ? null : (window.FETA_LANG || {})[lang] || null);
let langCompiled = { lang: '', patterns: [], cache: new Map() };
function langPatterns() {
  if (langCompiled.lang === lang) return langCompiled;
  const pack = langPack();
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strict = new Set((pack && pack.numbersOnly) || []);
  const patterns = Object.entries((pack && pack.patterns) || {}).map(([from, to]) => {
    const order = [];
    const re = new RegExp('^' + from.split(/(\{\d\})/).map((part) => {
      const m = /^\{(\d)\}$/.exec(part);
      if (!m) return esc(part);
      order.push(Number(m[1]));
      return '(.+?)';
    }).join('') + '$');
    return { re, to, order, weight: from.replace(/\{\d\}/g, '').length, joined: from.includes(' · '), numbersOnly: strict.has(from) };
  }).sort((a, b) => b.weight - a.weight);
  langCompiled = { lang, patterns, cache: new Map() };
  return langCompiled;
}

// Translates one piece of text. Sentences with changing parts (amounts, names, dates) are matched by their fixed words.
function tr(text) {
  const pack = langPack();
  if (!pack || typeof text !== 'string' || !/[A-Za-z]/.test(text)) return text;
  const { patterns, cache } = langPatterns();
  if (cache.has(text)) return cache.get(text);
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const core = m[2].replace(/\s+/g, ' ');
  const joined = core.includes(' · ');
  let found = null;
  const word = pack.words && pack.words[core];
  if (typeof word === 'string') found = word;
  if (found == null) {
    for (const p of patterns) {
      // Text that is several facts joined by dots is only matched whole by a sentence written that way.
      if (joined && !p.joined) continue;
      const g = p.re.exec(core);
      if (!g || (p.numbersOnly && !g.slice(1).every((v) => /\d/.test(v)))) continue;
      const parts = {};
      p.order.forEach((slot, i) => { parts[slot] = tr(g[i + 1]); });
      found = p.to.replace(/\{(\d)\}/g, (all, slot) => (slot in parts ? parts[slot] : all));
      break;
    }
  }
  if (found == null && joined) {
    // "Due 15 Nov · EMI 3 of 6": translate each fact on its own.
    const parts = core.split(' · ');
    const done = parts.map((part) => tr(part));
    if (done.some((v, i) => v !== parts[i])) found = done.join(' · ');
  }
  if (found == null) {
    // A symbol or emoji in front ("✓ Paid", "🏠 House", "+ Add"): translate the words after it.
    const lead = /^([^\p{L}\p{N}]+\s)(.+)$/u.exec(core);
    if (lead && tr(lead[2]) !== lead[2]) found = lead[1] + tr(lead[2]);
  }
  const out = found == null ? text : m[1] + found + m[3];
  if (cache.size < 5000) cache.set(text, out);
  return out;
}

const TR_ATTRS = ['placeholder', 'aria-label', 'title'];
function trTree(node) {
  if (node.nodeType === 3) {
    // Never touch code, styles or what someone is typing.
    const host = node.parentElement;
    if (host && /^(SCRIPT|STYLE|TEXTAREA)$/.test(host.tagName)) return;
    const next = tr(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
  for (const a of TR_ATTRS) {
    if (node.hasAttribute(a)) { const v = node.getAttribute(a); const next = tr(v); if (next !== v) node.setAttribute(a, next); }
  }
  for (const child of node.childNodes) trTree(child);
}
// Everything put on screen passes through here: pages, pop-ups and the short messages at the bottom.
function watchLanguage() {
  new MutationObserver((changes) => {
    if (!langPack()) return;
    for (const c of changes) {
      if (c.type === 'characterData') trTree(c.target);
      else for (const node of c.addedNodes) trTree(node);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
function setLang(next) {
  if (!LANGS.some(([id]) => id === next)) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
  document.documentElement.lang = next;
  fmtCache = {};
}
const langOptions = () => LANGS.map(([id, name]) => `<option value="${id}" ${id === lang ? 'selected' : ''}>${name}</option>`).join('');

// The kinds of reminders, each with its own switch under Setup.
const NOTIFY_KINDS = [
  ['bills', 'Bills to pay', 'On the day a bill or instalment is due, and again if it is still unpaid 3 days later.'],
  ['weekreport', 'Weekly report', 'On the last evening of each week.'],
  ['report', 'Monthly report', 'On the last evening of each month.'],
  ['plans', 'Planner reminders', 'When the month you planned to buy something arrives, and the month before.'],
  ['budget', 'Spending limits', 'When a category reaches 80% and 100% of its monthly limit.'],
  ['debts', 'Money owed', 'On the due date of money you owe or are owed.'],
  ['goals', 'Savings targets', 'When savings reach the target you set.'],
  ['updates', 'App updates', 'Once a week while a newer Android app is waiting.'],
  ['comments', 'Comments', 'When someone writes a comment or a reply on a transaction.'],
  ['leftover', 'Money left over', 'On the first day of a month, when the month before ended with money left.']
];
const NOTIFY_EMOJI = { bills: '🧾', report: '📊', plans: '🎯', budget: '⚠️', debts: '🤝', goals: '🏆', updates: '⬇️', comments: '💬', invites: '✉️', leftover: '💵' };

const DEFAULT_CATEGORIES = [
  ['income', 'primary', 'Job salary', '💼'], ['income', 'primary', 'Business profit', '🏪'], ['income', 'primary', 'Rent received', '🏘️'],
  ['income', 'secondary', 'Side hustle', '💻'], ['income', 'secondary', 'Bonus', '🎉'], ['income', 'secondary', 'Gift received', '🎁'],
  ['income', 'secondary', 'Other income', '➕'],
  ['expense', '', 'House', '🏠'], ['expense', '', 'Groceries', '🛒'], ['expense', '', 'Bills & utilities', '💡'],
  ['expense', '', 'Children', '🧒'], ['expense', '', 'Family', '👪'], ['expense', '', 'Pet', '🐾'], ['expense', '', 'Health', '💊'],
  ['expense', '', 'Household help', '🧹'], ['expense', '', 'Subscriptions', '📺'], ['expense', '', 'EMI & loans', '💳'],
  ['expense', '', 'Clothing', '👕'], ['expense', '', 'Transport', '🚌'], ['expense', '', 'Eating out', '🍽️'],
  ['expense', '', 'Gym', '🏋️'], ['expense', '', 'Hobby', '🎨'], ['expense', '', 'Travel', '✈️'],
  ['expense', '', 'Gifts & donations', '🤲'], ['expense', '', 'Other', '📦'],
  ['saving', '', 'General savings', '🏦'], ['saving', '', 'Children’s savings', '🧸'], ['saving', '', 'Emergency savings', '🛟']
];

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>',
  bills: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  savings: '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6M5 10v8M9.500 10v8M14.500 10v8M19 10v8M3 20h18"/></svg>',
  planner: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>'
};

/* ---------- Small helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const r3 = (n) => Math.round(n * 1000) / 1000;
const sum = (arr, fn) => r3(arr.reduce((a, x) => a + fn(x), 0));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function parseAmount(v) {
  const n = parseFloat(String(v ?? '').replace(/[\s,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? r3(n) : NaN;
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const today = () => iso(new Date());
const curYM = () => today().slice(0, 7);
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
// Weeks run from Sunday to Saturday.
const weekStartOf = (s) => addDays(s, -toDate(s).getDay());
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());
const isYM = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
// What a payment of a repeating item stands for: a month, or for a weekly item the day it was due.
const isPeriod = (s) => isYM(s) || isDate(s);
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const monthsBetween = (a, b) => (b.slice(0, 4) - a.slice(0, 4)) * 12 + (b.slice(5, 7) - a.slice(5, 7));
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dateIn = (ym, day) => `${ym}-${pad(Math.min(Math.max(1, day), daysInMonth(ym)))}`;
const ymLabel = (ym) => toDate(ym + '-01').toLocaleDateString(LOCALE(), { month: 'long', year: 'numeric' });
const ymShort = (ym) => toDate(ym + '-01').toLocaleDateString(LOCALE(), { month: 'short', year: 'numeric' });
const monthNameOf = (m) => new Date(2024, m - 1, 1).toLocaleDateString(LOCALE(), { month: 'long' });
// 0 is Sunday, as in Date.getDay().
const weekdayNameOf = (d) => new Date(2024, 0, 7 + d).toLocaleDateString(LOCALE(), { weekday: 'long' });
const fmtDay = (s) => toDate(s).toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDayLong = (s) => toDate(s).toLocaleDateString(LOCALE(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (s) => toDate(s).toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short' });

let fmtCache = {};
function fmt(n) {
  const cur = state.settings.currency || 'USD';
  if (!fmtCache[cur]) {
    try {
      fmtCache[cur] = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } catch (e) { fmtCache[cur] = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); }
  }
  return fmtCache[cur].format(n || 0);
}
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const fmtK = (n) => (Math.abs(n) < 10000 ? String(Math.round(n)) : compact.format(n));

/* ---------- State ---------- */

function guessCurrency() {
  const region = (navigator.language || '').split('-')[1];
  return REGION_CURRENCY[(region || '').toUpperCase()] || 'BDT';
}

function defaultCategories() {
  return DEFAULT_CATEGORIES.map(([type, group, name, emoji]) => ({ id: uid(), type, group: group || 'primary', name, emoji, budget: 0 }));
}

function blankState() {
  return {
    version: 2,
    settings: { currency: guessCurrency(), theme: 'auto', started: false, notify: {} },
    categories: [], transactions: [], recurring: [], emis: [], plans: [], debts: [],
    // The reminders already read. Kept with the data, so one read on any device is read on all of them.
    seen: [],
    // What the person chose to do with the money left at the end of a month: 'carry', 'expense' or 'saving', by month.
    leftover: {}
  };
}

// Two lists of read reminders as one, newest last. Only the latest few hundred are kept.
const mergeSeen = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]
  .filter((x) => typeof x === 'string' && x && x.length <= 120))].slice(-300);

const validState = (s) => s && typeof s === 'object' && s.version === 2 && s.settings && typeof s.settings === 'object' && Array.isArray(s.transactions);

// Rebuild stored or imported data field by field, so a damaged or hand-edited file cannot break the app.
const FREQS = ['weekly', 'monthly', 'yearly'];
const PER = { weekly: 'a week', monthly: 'a month', yearly: 'a year' };

function sanitize(s) {
  const okId = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  const ref = (v) => (okId(v) ? v : '');
  const num = (v) => (Number.isFinite(+v) ? r3(+v) : 0);
  const pos = (v) => Math.max(0, num(v));
  const str = (v, n) => String(v ?? '').slice(0, n);
  const day = (v) => Math.min(31, Math.max(1, Math.round(num(v)) || 1));
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && okId(x.id)) : []);
  const type = (v) => (TYPES.includes(v) ? v : 'expense');
  const out = blankState();
  if (/^[A-Z]{3}$/.test(s.settings.currency)) out.settings.currency = s.settings.currency;
  if (['auto', 'light', 'dark'].includes(s.settings.theme)) out.settings.theme = s.settings.theme;
  out.settings.started = !!s.settings.started;
  // Which kinds of reminders are switched off. Anything not listed is on.
  const off = s.settings.notify && typeof s.settings.notify === 'object' ? s.settings.notify : {};
  for (const [kind] of NOTIFY_KINDS) if (off[kind] === false) out.settings.notify[kind] = false;
  out.seen = mergeSeen(s.seen, []);
  // Money left at the end of a month is carried into the next one, starting with this month. Earlier months are left as they were.
  if (isYM(s.settings.carryFrom)) out.settings.carryFrom = s.settings.carryFrom;
  if (s.leftover && typeof s.leftover === 'object') {
    for (const [ym, how] of Object.entries(s.leftover)) if (isYM(ym) && ['carry', 'expense', 'saving'].includes(how)) out.leftover[ym] = how;
  }
  out.categories = arr(s.categories).map((c) => ({
    id: c.id, type: type(c.type), group: c.group === 'secondary' ? 'secondary' : 'primary',
    name: str(c.name, 40) || 'Category', emoji: str(c.emoji, 8), budget: pos(c.budget),
    // Money that was already in a savings fund before the app was used.
    opening: c.type === 'saving' ? pos(c.opening) : 0,
    // The amount a savings fund is meant to reach.
    target: c.type === 'saving' ? pos(c.target) : 0,
    // A savings fund made for a plan on the Planner, and whether the plan was bought with it: the money is then spent,
    // so the fund no longer counts in what is saved.
    ...(c.type === 'saving' && okId(c.planId) ? { planId: c.planId } : {}),
    ...(c.type === 'saving' && c.used ? { used: true } : {})
  }));
  out.transactions = arr(s.transactions).filter((t) => isDate(t.date)).map((t) => ({
    id: t.id, type: type(t.type), amount: Math.abs(num(t.amount)), categoryId: ref(t.categoryId), date: t.date,
    note: str(t.note, 120), created: num(t.created), recurringId: ref(t.recurringId), emiId: ref(t.emiId),
    planId: ref(t.planId), period: isPeriod(t.period) ? t.period : '',
    // Set on an expense a guest added: who it was.
    ...(okId(t.by) ? { by: t.by, byName: str(t.byName, 40) } : {})
  }));
  out.recurring = arr(s.recurring).map((r) => ({
    id: r.id, type: type(r.type), name: str(r.name, 60) || 'Repeating item', amount: pos(r.amount), categoryId: ref(r.categoryId),
    frequency: FREQS.includes(r.frequency) ? r.frequency : 'monthly', day: day(r.day),
    // Weekly items: the day of the week, and the first day they count from, so earlier weeks are not shown as unpaid.
    weekday: Math.min(6, Math.max(0, Math.round(num(r.weekday)) || 0)), since: isDate(r.since) ? r.since : '', month: Math.min(12, Math.max(1, Math.round(num(r.month)) || 1)),
    start: isYM(r.start) ? r.start : curYM(), end: isYM(r.end) ? r.end : '', paused: !!r.paused,
    skips: Array.isArray(r.skips) ? r.skips.filter(isPeriod) : [], note: str(r.note, 120),
    // Amount changes: from the given month onward the item costs the new amount.
    changes: (Array.isArray(r.changes) ? r.changes : []).filter((c) => c && isYM(c.from) && pos(c.amount) > 0)
      .map((c) => ({ from: c.from, amount: pos(c.amount) })).sort((a, b) => (a.from < b.from ? -1 : 1))
  }));
  out.emis = arr(s.emis).map((e) => {
    const monthly = pos(e.monthly);
    // Older entries stored a total and an amount already paid instead of a tenure.
    const legacy = monthly > 0 ? Math.ceil((pos(e.total) - pos(e.alreadyPaid)) / monthly) : 1;
    const tenure = Math.min(360, Math.max(1, Math.round(num(e.tenure)) || legacy || 1));
    return {
      id: e.id, name: str(e.name, 60) || 'EMI', monthly, tenure, paidBefore: Math.min(tenure, Math.max(0, Math.round(num(e.paidBefore)) || 0)),
      day: day(e.day), start: isYM(e.start) ? e.start : curYM(), categoryId: ref(e.categoryId), note: str(e.note, 120)
    };
  });
  out.plans = arr(s.plans).map((p) => ({
    id: p.id, name: str(p.name, 60) || 'Plan', price: pos(p.price),
    // The day the plan is for. Older plans only had a month ("target"), which is kept in step with the day.
    date: isDate(p.date) ? p.date : '', target: isDate(p.date) ? p.date.slice(0, 7) : isYM(p.target) ? p.target : '',
    // The savings fund this plan is saved up in.
    fundId: ref(p.fundId),
    priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium', note: str(p.note, 120), done: !!p.done
  }));
  out.debts = arr(s.debts).map((d) => ({
    id: d.id, kind: d.kind === 'payable' ? 'payable' : 'receivable', person: str(d.person, 60) || 'Someone', amount: pos(d.amount),
    date: isDate(d.date) ? d.date : today(), due: isDate(d.due) ? d.due : '', note: str(d.note, 120), settled: !!d.settled,
    // txId: the income or expense that recording this payment added.
    payments: arr(d.payments).filter((p) => isDate(p.date)).map((p) => ({ id: p.id, amount: pos(p.amount), date: p.date, ...(okId(p.txId) ? { txId: p.txId } : {}) }))
  }));
  return out;
}

// Carries anything entered in the first version of the app over to the new layout.
function migrateV1(old) {
  const s = blankState();
  if (old.settings && /^[A-Z]{3}$/.test(old.settings.currency)) s.settings.currency = old.settings.currency;
  s.categories = defaultCategories();
  const map = {};
  for (const b of old.budgets || []) {
    for (const c of b.categories || []) {
      const type = c.type === 'income' ? 'income' : 'expense';
      let hit = s.categories.find((x) => x.type === type && x.name.toLowerCase() === String(c.name).toLowerCase());
      if (!hit) { hit = { id: uid(), type, group: 'primary', name: String(c.name), emoji: String(c.emoji || ''), budget: 0 }; s.categories.push(hit); }
      map[c.id] = hit.id;
    }
  }
  s.transactions = (old.transactions || []).map((t) => ({ ...t, categoryId: map[t.categoryId] || '' }));
  s.settings.started = s.transactions.length > 0;
  return sanitize(s);
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (validState(s)) return sanitize(s);
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old && Array.isArray(old.budgets) && old.budgets.length) return migrateV1(old);
  } catch (e) { /* fall through to a fresh state */ }
  return blankState();
}

function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save. Storage is full or blocked.'); }
}

// Every change is saved on the device first, then sent to the online account shortly after.
function save() {
  saveLocal();
  changeSeq++;
  if (!sync.session || isGuest()) return;
  sync.dirty = true;
  saveSync();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 1500);
}

let state = load();
const ui = {
  tab: 'home', home: 'month', saveYear: curYM().slice(0, 4), month: curYM(), filter: 'all', search: '', bar: null, bills: 'month', horizon: 12,
  rep: { period: 'month', cursor: today(), measure: 'expense' },
  planner: 'plans',
  // Which list under Setup is open on its own page, if any.
  setup: null,
  // 'notices' while the full-screen list of notifications is open, and which of them were new when it was opened.
  page: null, noticeNew: []
};
let pendingConfirm = null;

/* ---------- Online account and sync ---------- */

// These two values are public by design: they only identify the project. Each person's rows are protected by their sign-in.
const SB_URL = 'https://snfcjitzkglpqetglize.supabase.co';
const SB_KEY = 'sb_publishable_iFD2y5yQJqnl7jPigiwCGA_AKhxuPhe';
const SYNC_KEY = 'budgetnest.sync';
// Data set aside when a device is signed out with entries that may not be in the account. Offered back at the next sign-in.
const LEFT_KEY = 'budgetnest.leftover';
const COLLECTIONS = ['transactions', 'recurring', 'emis', 'plans', 'debts'];

// The Android app keeps its own copy of the sign-in, written to the phone at once. The page's storage is written a
// little later, so it can be missing or out of date when Android closes the app to install an update, and a sign-in
// that has since been renewed no longer works. On opening, the newer of the two copies is used.
function keptSession() {
  try {
    const app = window.FetaAndroid;
    const s = app && app.sessionLoad ? JSON.parse(app.sessionLoad() || 'null') : null;
    return s && s.access_token && s.refresh_token && s.user && s.user.id ? s : null;
  } catch (e) { return null; }
}
let keptText = null;
function keepSession() {
  try {
    const app = window.FetaAndroid;
    if (!app || !app.sessionSave) return;
    const text = sync.session ? JSON.stringify(sync.session) : '';
    if (text === keptText) return;
    if (app.sessionSave(text)) keptText = text;
  } catch (e) { /* the page's own copy is still there */ }
}

function loadSync() {
  // v2: the account's database has profiles, guests and comments. profile: the one on screen (id, kind 'own' or 'guest', ...).
  const out = { session: null, rev: 0, dirty: false, last: '', error: '', v2: false, profile: null };
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY));
    if (s && typeof s === 'object') Object.assign(out, { session: s.session || null, rev: Number(s.rev) || 0, dirty: !!s.dirty, last: s.last || '', v2: !!s.v2,
      profile: s.profile && typeof s.profile === 'object' && typeof s.profile.id === 'string' ? s.profile : null });
  } catch (e) { /* start signed out */ }
  const kept = keptSession();
  const mine = out.session;
  if (kept && (!mine || (mine.user && mine.user.id === kept.user.id && Number(kept.expires_at) > Number(mine.expires_at)))) out.session = kept;
  return out;
}
function saveSync() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify({ session: sync.session, rev: sync.rev, dirty: sync.dirty, last: sync.last, v2: sync.v2, profile: sync.profile })); } catch (e) { /* ignore */ }
  keepSession();
}

let sync = loadSync();
let changeSeq = 0;
let pushTimer = null;
let syncing = null;
let pendingRemote = null;

const isGuest = () => !!(sync.profile && sync.profile.kind === 'guest');
const guestCanAdd = () => isGuest() && sync.profile.role === 'add';
const myId = () => (sync.session ? sync.session.user.id : '');
const first = (rows) => (rows && rows[0]) || null;

// Profiles, invitations, guests, names and pictures, and comments: see "Profiles, guests and comments" further down.
const SHARE_KEY = 'budgetnest.share';
// What a guest has read. A guest cannot save into the profile, so this stays on the device.
const GSEEN_KEY = 'budgetnest.gseen';
const blankShare = () => ({ profiles: [], guests: [], guestOf: [], invites: [], people: {}, comments: [] });
function readShare() {
  const out = blankShare();
  try {
    const v = JSON.parse(localStorage.getItem(SHARE_KEY));
    if (v && typeof v === 'object') {
      for (const k of ['profiles', 'guests', 'guestOf', 'invites', 'comments']) if (Array.isArray(v[k])) out[k] = v[k].filter((x) => x && typeof x === 'object');
      if (v.people && typeof v.people === 'object') out.people = v.people;
    }
  } catch (e) { /* start empty */ }
  return out;
}
let share = readShare();
const saveShare = () => { try { localStorage.setItem(SHARE_KEY, JSON.stringify(share)); } catch (e) { /* ignore */ } };
// Set while a guest is leaving a profile on purpose, so they are not told they lost access.
let quietLeave = false;

// Read reminders used to be remembered on each device only. Move that list into the data, so it reaches the account.
try {
  const old = JSON.parse(localStorage.getItem('budgetnest.seen'));
  if (Array.isArray(old)) {
    state.seen = mergeSeen(state.seen, old);
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.removeItem('budgetnest.seen');
    if (sync.session) { sync.dirty = true; saveSync(); }
  }
} catch (e) { /* nothing to move */ }

async function sb(path, { method = 'GET', body, token, prefer } = {}) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(SB_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
  if (!res.ok) {
    const err = new Error((data && (data.msg || data.message || data.error_description)) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = (data && (data.error_code || data.code)) || '';
    throw err;
  }
  return data;
}

function authMessage(e) {
  if (e instanceof TypeError) return 'No internet connection. Try again when you are online.';
  if (e.code === 'PGRST205' || e.status === 404) return 'Your sign-in worked, but the online database is not set up yet, so nothing can be saved to your account.';
  const known = {
    invalid_credentials: 'Wrong email or password.',
    email_not_confirmed: 'Confirm your email first: open the link we sent you, then sign in.',
    user_already_exists: 'That email already has an account. Sign in instead.',
    email_exists: 'That email already has an account. Sign in instead.',
    weak_password: 'Choose a longer password, at least 6 characters.',
    over_email_send_rate_limit: 'Too many emails were sent. Wait a few minutes and try again.',
    email_address_invalid: 'That email address is not valid.',
    same_password: 'Choose a password different from the old one.'
  };
  return known[e.code] || e.message || 'Something went wrong. Try again.';
}

function setSession(d, user) {
  const u = user || d.user;
  sync.session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000,
    user: { id: String(u.id), email: String(u.email || '') } };
  saveSync();
}

function dropSession() {
  sync.session = null; sync.rev = 0; sync.dirty = false; sync.last = ''; sync.error = ''; sync.v2 = false; sync.profile = null;
  pendingRemote = null;
  sharingAsked = false;
  share = blankShare();
  try { localStorage.removeItem(SHARE_KEY); localStorage.removeItem(GSEEN_KEY); } catch (e) { /* ignore */ }
  saveSync();
}

// Empties the device's data but keeps the currency and appearance, so the welcome screen is shown.
function resetState() {
  const { currency, theme } = state.settings;
  state = blankState();
  state.settings.currency = currency; state.settings.theme = theme;
  fmtCache = {};
  try { localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ }
  saveLocal();
}

function readLeftover() {
  try {
    const left = JSON.parse(localStorage.getItem(LEFT_KEY));
    return validState(left) ? sanitize(left) : null;
  } catch (e) { return null; }
}
// Sets the current data aside (adding to anything already set aside) so it can be offered back after signing in.
function setAside() {
  if (!hasData(state)) return;
  const earlier = readLeftover();
  try { localStorage.setItem(LEFT_KEY, JSON.stringify(earlier ? mergeStates(earlier, state) : state)); } catch (e) { /* ignore */ }
}
const dropLeftover = () => { try { localStorage.removeItem(LEFT_KEY); } catch (e) { /* ignore */ } };
// Entries set aside on this device that the signed-in account does not have.
function leftoverExtras(left) {
  return sum(COLLECTIONS, (k) => left[k].filter((x) => !state[k].some((y) => y.id === x.id)).length);
}
function offerLeftover() {
  const left = readLeftover();
  if (!left || !sync.session) return;
  const n = leftoverExtras(left);
  if (!n) return dropLeftover();
  openSheet('Entries left on this device', `
    <p>This device still has ${plural(n, 'entry').replace('entrys', 'entries')} from before you signed out that ${n === 1 ? 'is' : 'are'} not in this account.</p>
    <button class="btn" data-act="leftover" data-id="add">Add ${n === 1 ? 'it' : 'them'} to this account</button>
    <button class="btn ghost" data-act="leftover" data-id="drop">Discard ${n === 1 ? 'it' : 'them'}</button>`);
}

// Ends the session and clears the account's data from this device, leaving the welcome screen.
// Changes that could not be saved online are set aside and offered back at the next sign-in.
function signOutNow() {
  const token = sync.session && sync.session.access_token;
  // Only this device is signed out. Without the scope, every phone and browser using the account would be.
  if (token) sb('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
  clearTimeout(pushTimer);
  if (sync.dirty) setAside();
  dropSession();
  try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignore */ }
  resetState();
  Object.assign(ui, { tab: 'home', home: 'month', month: curYM(), filter: 'all', search: '', bar: null, bills: 'month', planner: 'plans', setup: null, page: null });
  lastTabIndex = null;
  render(); window.scrollTo(0, 0); toast('Signed out');
}

async function freshToken() {
  const s = sync.session;
  if (s.expires_at - Date.now() > 60000) return s.access_token;
  try {
    setSession(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }));
  } catch (e) {
    if (e.status === 400 || e.status === 401 || e.status === 403) {
      // A guest is looking at someone else's data: that is never set aside as this person's own.
      if (!isGuest()) setAside();
      dropSession();
      try { localStorage.removeItem(SYNC_KEY); } catch (err) { /* ignore */ }
      resetState(); closeSheet(); render(); toast('Please sign in again.');
    }
    throw e;
  }
  return sync.session.access_token;
}

const hasData = (s) => COLLECTIONS.some((k) => Array.isArray(s[k]) && s[k].length > 0);

// Asks once whether the account's database has profiles, guests and comments (supabase/sharing.sql has been run).
// Until it has, everything works as before, with one set of data per person.
let sharingAsked = false;
async function detectSharing(token) {
  if (sync.v2 || sharingAsked) return;
  sharingAsked = true;
  try {
    await sb('/rest/v1/profiles?select=id&limit=1', { token });
    // Revision numbers start again in the new table, so whatever is found there is taken as new.
    sync.v2 = true; sync.rev = -1;
    saveSync();
  } catch (e) { if (e instanceof TypeError) { sharingAsked = false; throw e; } }
}

// Fetches the profile on screen. Without one yet, that is the person's main profile.
async function pullRow() {
  const token = await freshToken();
  await detectSharing(token);
  const me = encodeURIComponent(sync.session.user.id);
  const before = async () => first(await sb(`/rest/v1/user_data?select=data,rev&user_id=eq.${me}`, { token }));
  if (!sync.v2) return before();
  const filter = sync.profile ? `id=eq.${encodeURIComponent(sync.profile.id)}` : `owner_id=eq.${me}&is_main=is.true`;
  const row = first(await sb(`/rest/v1/profiles?select=id,name,data,rev&${filter}`, { token }));
  if (row) {
    if (!sync.profile) sync.profile = { id: row.id, kind: 'own', main: true, name: row.name || '' };
    // The name may have been changed on another device, or by the owner of a profile this person is a guest in.
    else sync.profile.name = row.name || '';
    return row;
  }
  if (sync.profile) return null;
  // No main profile yet: this person's data is still where it was kept before profiles existed. It is marked "old"
  // so that it is taken over and then saved as their main profile.
  const old = await before();
  return old ? { ...old, old: true } : null;
}

// Saves the whole data set as revision baseRev + 1. Returns false if another device saved first.
async function pushRow(baseRev) {
  if (isGuest()) return true;
  const token = await freshToken();
  const seq = changeSeq;
  const uid = sync.session.user.id;
  const payload = { data: state, rev: baseRev + 1, updated_at: new Date().toISOString() };
  const table = sync.v2 ? 'profiles' : 'user_data';
  let rows;
  if (baseRev === 0 && !(sync.v2 && sync.profile)) {
    const owner = sync.v2 ? { owner_id: uid, is_main: true } : { user_id: uid };
    try { rows = await sb('/rest/v1/' + table, { method: 'POST', token, prefer: 'return=representation', body: { ...owner, ...payload } }); }
    catch (e) { if (e.status === 409) return false; throw e; }
    if (sync.v2 && rows && rows[0] && rows[0].id) sync.profile = { id: rows[0].id, kind: 'own', main: true, name: '' };
  } else {
    const filter = sync.v2 ? `id=eq.${encodeURIComponent(sync.profile.id)}` : `user_id=eq.${encodeURIComponent(uid)}`;
    rows = await sb(`/rest/v1/${table}?${filter}&rev=eq.${baseRev}`, { method: 'PATCH', token, prefer: 'return=representation', body: payload });
  }
  if (!rows || !rows.length) return false;
  sync.rev = baseRev + 1;
  if (seq === changeSeq) sync.dirty = false;
  saveSync();
  return true;
}

// Combines two copies: everything from both is kept, and where both have the same entry this device's version wins.
function mergeStates(local, remote) {
  const out = sanitize(local);
  const other = sanitize(remote);
  const map = {};
  for (const c of other.categories) {
    const hit = out.categories.find((x) => x.id === c.id) || out.categories.find((x) => x.type === c.type && x.name.toLowerCase() === c.name.toLowerCase());
    if (hit) map[c.id] = hit.id; else { out.categories.push(c); map[c.id] = c.id; }
  }
  for (const k of COLLECTIONS) {
    const ids = new Set(out[k].map((x) => x.id));
    for (const x of other[k]) {
      if (ids.has(x.id)) continue;
      if (x.categoryId) x.categoryId = map[x.categoryId] || '';
      out[k].push(x);
    }
  }
  out.seen = mergeSeen(other.seen, out.seen);
  out.leftover = { ...other.leftover, ...out.leftover };
  if (!out.settings.carryFrom && other.settings.carryFrom) out.settings.carryFrom = other.settings.carryFrom;
  out.settings.started = true;
  return out;
}

function adopt(remote) {
  const seen = state.seen;
  const carryFrom = state.settings.carryFrom;
  state = sanitize(remote);
  // A copy saved by an older version of the app does not say when carrying over started: keep what this device knows.
  if (!state.settings.carryFrom && carryFrom) state.settings.carryFrom = carryFrom;
  // A reminder read on this device stays read, also if the account's copy does not know about it.
  state.seen = mergeSeen(state.seen, seen);
  state.settings.started = true;
  if (!state.categories.length) state.categories = defaultCategories();
  fmtCache = {};
  saveLocal(); applyTheme(); render();
}

// Puts another profile's data on screen. Nothing from the profile shown before is carried over.
function showState(data) {
  state = sanitize(data);
  state.settings.started = true;
  if (!isGuest() && !state.categories.length) state.categories = defaultCategories();
  if (!isGuest() && !state.settings.carryFrom) { state.settings.carryFrom = curYM(); sync.dirty = true; }
  fmtCache = {};
  saveLocal(); applyTheme(); render();
}

function syncNow() {
  if (!sync.session || pendingRemote) return Promise.resolve();
  if (!syncing) {
    syncing = doSync().finally(() => { syncing = null; if (ui.tab === 'more' && !$('#sheet-root').firstChild) render(); });
  }
  return syncing;
}

async function doSync() {
  clearTimeout(pushTimer);
  try {
    // Set when the profile on screen had to change, so the data that arrives replaces what is shown instead of being combined with it.
    let swapped = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await pullRow();
      if (!row && sync.profile) {
        // The profile on screen was deleted, or this guest was removed from it: go back to the person's own main profile.
        if (!sync.profile.main) {
          swapped = true; sync.dirty = false;
          Object.assign(ui, { tab: 'home', home: 'month', month: curYM(), filter: 'all', search: '', bar: null, setup: null, page: null });
          toast(quietLeave ? 'You left the profile' : 'That profile is no longer available to you.');
          quietLeave = false;
        }
        sync.profile = null; sync.rev = -1;
        saveSync();
        continue;
      }
      const fromOld = !!(row && row.old);
      const remoteRev = row && !fromOld ? Number(row.rev) || 0 : 0;
      if (row && (Number(row.rev) || 0) !== sync.rev) {
        // Another device, or a guest, saved since this one last synced.
        if (validState(row.data)) {
          if (swapped) showState(row.data);
          else if (sync.dirty && !isGuest()) { state = mergeStates(state, row.data); fmtCache = {}; saveLocal(); render(); }
          else adopt(row.data);
        }
        if (!fromOld) { sync.rev = remoteRev; saveSync(); }
      }
      if (isGuest()) break;
      if (row && !fromOld && !sync.dirty) break;
      if (await pushRow(remoteRev)) break;
    }
    sync.error = '';
    sync.last = new Date().toISOString();
    try { await loadShare(); } catch (e) { /* the lists are fetched again with the next sync */ }
  } catch (e) {
    sync.error = e instanceof TypeError ? 'offline' : e.status === 404 ? 'The online database has not been set up yet.' : (e.message || 'Unknown error');
  }
  saveSync();
}

function syncStatus() {
  if (syncing) return 'Syncing…';
  if (sync.error === 'offline') return 'Offline. Changes are saved on this device and will sync when you are back online.';
  if (sync.error) return `Could not sync: ${sync.error}`;
  if (sync.dirty) return 'Changes waiting to sync.';
  return sync.last ? `Synced ${new Date(sync.last).toLocaleString(LOCALE(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet.';
}

function startApp() {
  state.settings.started = true;
  if (!state.settings.carryFrom) state.settings.carryFrom = curYM();
  if (!state.categories.length) state.categories = defaultCategories();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Runs once after signing in: decide between the data on this device and the data already in the account.
async function afterSignIn() {
  const row = await pullRow();
  const remote = row && validState(row.data) ? row.data : null;
  sync.rev = row && !row.old ? Number(row.rev) || 0 : 0;
  if (remote && hasData(remote) && hasData(state)) {
    pendingRemote = remote;
    saveSync();
    return chooseSheet();
  }
  if (remote && hasData(remote)) { adopt(remote); sync.dirty = false; }
  else { startApp(); saveLocal(); sync.dirty = true; }
  saveSync();
  closeSheet(); render();
  await syncNow();
  offerLeftover();
}

function chooseSheet() {
  const n = (s) => plural(s.transactions.length, 'transaction');
  openSheet('Which data do you want?', `
    <p>This device has ${n(state)} and your account already has ${n(pendingRemote)}.</p>
    <button class="btn" data-act="sync-choose" data-id="merge">Combine both</button>
    <button class="btn ghost" data-act="sync-choose" data-id="remote">Use the account’s data and discard this device’s</button>
    <button class="btn ghost" data-act="sync-choose" data-id="local">Use this device’s data and replace the account’s</button>`);
}

// A password box with a Show/Hide button, so people can check what they typed.
function passwordField(label, autocomplete, autofocus) {
  return `<label class="field"><span>${label}</span>
    <span class="pass-wrap"><input type="password" name="password" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" ${autofocus ? 'data-autofocus' : ''}>
      <button type="button" class="pass-toggle" data-act="toggle-pass" aria-pressed="false" aria-label="Show password">Show</button></span></label>`;
}

function accountSheet(mode) {
  const up = mode === 'signup';
  openSheet(up ? 'Create an account' : 'Sign in', `
    <form data-form="auth" novalidate>
      <input type="hidden" name="mode" value="${up ? 'signup' : 'signin'}">
      <label class="field"><span>Email</span><input type="email" inputmode="email" name="email" autocomplete="username" autocapitalize="none" spellcheck="false" data-autofocus></label>
      ${passwordField(`Password${up ? ' (at least 6 characters)' : ''}`, up ? 'new-password' : 'current-password')}
      ${up ? '<p class="note">Your data is saved to your account so it is backed up and the same on every device you sign in on.</p>' : ''}
      <button class="btn">${up ? 'Create account' : 'Sign in'}</button>
      <button type="button" class="btn ghost" data-act="open-account" data-id="${up ? 'signin' : 'signup'}">${up ? 'I already have an account' : 'Create a new account'}</button>
      ${up ? '' : '<button type="button" class="link center" data-act="forgot">Forgot password?</button>'}
    </form>`);
  centerSheet();
}

function newPasswordSheet() {
  openSheet('Set a new password', `
    <form data-form="newpass" novalidate>
      ${passwordField('New password (at least 6 characters)', 'new-password', true)}
      <button class="btn">Save password</button>
    </form>`);
  centerSheet();
}

// Lets the phone's password manager (Google on Android, the keychain on an iPhone) offer to save the sign-in, so next
// time it fills it in after a fingerprint, face or screen-lock check. The form must still be on screen when this runs.
async function offerToSavePassword(email, password) {
  try {
    const app = window.FetaAndroid;
    if (app && app.loginDone) { app.loginDone(); await new Promise((r) => setTimeout(r, 300)); }
    else if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
      navigator.credentials.store(new PasswordCredential({ id: email, password, name: email })).catch(() => {});
    }
  } catch (e) { /* saving the password is optional */ }
}

const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
let authBusy = false;

async function submitAuth(f) {
  if (authBusy) return;
  const email = f.email.trim().toLowerCase();
  if (!validEmail(email)) return toast('Enter your email address.');
  if (f.password.length < 6) return toast('The password needs at least 6 characters.');
  authBusy = true;
  try {
    if (f.mode === 'signup') {
      const d = await sb('/auth/v1/signup', { method: 'POST', body: { email, password: f.password } });
      await offerToSavePassword(email, f.password);
      if (d && d.access_token) { setSession(d); await afterSignIn(); toast('Account created'); }
      else {
        openSheet('Check your email', `<p>We sent a confirmation link to ${esc(email)}. Open it, then come back to this app and sign in with your email and password.</p>
        <p class="note">On an iPhone the link opens in Safari. That is fine: return to the app from your home screen afterwards.</p>
        <button class="btn" data-act="open-account" data-id="signin">Sign in</button>`);
        centerSheet();
      }
    } else {
      setSession(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: f.password } }));
      await offerToSavePassword(email, f.password);
      await afterSignIn();
      if (!pendingRemote) toast('Signed in');
    }
  } catch (e) { toast(authMessage(e)); }
  authBusy = false;
}

async function submitNewPass(f) {
  if (f.password.length < 6) return toast('The password needs at least 6 characters.');
  try {
    await sb('/auth/v1/user', { method: 'PUT', token: await freshToken(), body: { password: f.password } });
    closeSheet(); toast('Password changed');
    await afterSignIn();
  } catch (e) { toast(authMessage(e)); }
}

// Confirmation and password-reset emails send the person back here with their sign-in in the address.
async function handleAuthLink() {
  if (!/access_token=|error_description=/.test(location.hash)) return false;
  const h = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  if (h.get('error_description')) { toast(h.get('error_description')); return false; }
  try {
    const token = h.get('access_token');
    const user = await sb('/auth/v1/user', { token });
    setSession({ access_token: token, refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') }, user);
    if (h.get('type') === 'recovery') newPasswordSheet();
    else { await afterSignIn(); if (!pendingRemote) toast('Email confirmed. You are signed in.'); }
    return true;
  } catch (e) { toast(authMessage(e)); return false; }
}

/* ---------- Android app updates ---------- */

// The screens and features update themselves from the website. Only the small Android shell around them
// needs a new install now and then; when GitHub has a newer one, the app offers it.
const android = window.FetaAndroid || null;
let androidUpdate = null;

function androidVersion() {
  // The first Android build could not report its version, so a missing answer means version 1.
  try { return android && android.versionCode ? Number(android.versionCode()) || 1 : 1; } catch (e) { return 1; }
}

// Newer Android apps download and install the update themselves; older ones can only open the download in the browser.
const androidInApp = () => !!(android && android.updateStart && android.updateInstall);
// stage: 'offer' (nothing downloaded yet), 'downloading', 'ready' (downloaded, waiting for the person to tap Update).
const updateUi = { stage: 'offer', pct: 0, error: '', later: false };

async function checkAndroidUpdate() {
  if (!android) return;
  try {
    const res = await fetch('android.json', { cache: 'no-store' });
    if (!res.ok) return;
    const info = await res.json();
    const url = String(info.url || '');
    const newer = Number(info.versionCode) > androidVersion() && url.startsWith('https://github.com/offlinecrow/FETA/releases/');
    const next = newer ? { name: String(info.versionName || '').slice(0, 20), url } : null;
    const changed = !!next !== !!androidUpdate;
    androidUpdate = next;
    if (next && androidInApp() && updateUi.stage === 'offer') {
      let now = '';
      try { now = android.updateState ? String(android.updateState()) : ''; } catch (e) { /* treat as not started */ }
      if (now === 'ready' || now === 'downloading') updateUi.stage = now;
    }
    if (changed && !$('#sheet-root').firstChild) {
      render();
      // On entering the app, say so once. "Later" keeps it quiet until the app is opened again.
      if (next && !updateUi.later) androidUpdateSheet();
    }
  } catch (e) { /* offline: try again next time */ }
}

function androidUpdateSheet() {
  if (!androidUpdate) return;
  const name = androidUpdate.name ? ` ${esc(androidUpdate.name)}` : '';
  const pct = updateUi.pct >= 0 ? Math.min(100, updateUi.pct) : -1;
  let body;
  if (updateUi.stage === 'downloading') {
    body = `<p>Downloading the update${pct >= 0 ? `… ${pct}%` : '…'}</p>
      <span class="rank-track" style="margin-bottom:14px"><span class="rank-bar" style="display:block;width:${pct >= 0 ? pct : 100}%"></span></span>
      <p class="note">Keep FETA open until it finishes.</p>`;
  } else if (updateUi.stage === 'ready') {
    body = `<p>The update is downloaded and ready.</p>
      <p class="note">Tap Update. Android asks you to confirm, replaces the app, and FETA opens again. You stay signed in and your data stays as it is.</p>
      <button class="btn" data-act="android-install">Update</button>
      <button class="btn ghost" data-act="android-later">Later</button>`;
  } else {
    body = `${updateUi.error ? `<p class="over">${esc(updateUi.error)}</p>` : ''}
      <p>A new version of the Android app${name} is ready.</p>
      <p class="note">${androidInApp() ? 'It downloads inside FETA. You stay signed in and your data stays as it is.' : 'When the download finishes, open it and choose Install. Your data stays as it is.'}</p>
      <button class="btn" data-act="android-download">${updateUi.error ? 'Try again' : 'Download'}</button>
      <button class="btn ghost" data-act="android-later">Later</button>`;
  }
  openSheet('Update available', `<div data-update hidden></div>${body}`);
  centerSheet();
}

// Called by the Android app while it downloads: ('progress', percent), ('ready') or ('error', reason).
window.fetaUpdate = (state, value) => {
  if (state === 'progress') { updateUi.stage = 'downloading'; updateUi.pct = Number(value); updateUi.error = ''; }
  else if (state === 'ready') { updateUi.stage = 'ready'; updateUi.error = ''; }
  else if (state === 'error') { updateUi.stage = 'offer'; updateUi.error = String(value || 'The download did not finish.'); }
  else return;
  // Keep the card on Home and More in step, then the pop-up.
  if (state !== 'progress') render();
  const open = $('#sheet-root').firstChild;
  // Refresh the update pop-up if it is showing. When the download ends and nothing else is open, show it again.
  if ($('#sheet-root [data-update]') || (!open && state !== 'progress')) androidUpdateSheet();
  else if (!open) render();
};

// The version numbers are only shown in the Android app. There, Setup says which version this is and which one is
// released, read from the website each time the app is opened.
let releasedVersion = '';
async function checkReleased() {
  if (!android) return;
  try {
    const res = await fetch(`sw.js?check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const m = /const VERSION = '(\d+)'/.exec(await res.text());
    if (!m || m[1] === releasedVersion) return;
    releasedVersion = m[1];
    if (ui.tab === 'more' && !ui.setup && !$('#sheet-root').firstChild) render();
  } catch (e) { /* offline: try again next time */ }
}
function versionNote() {
  if (!releasedVersion) return `This is version ${APP_VERSION}. The released version could not be checked. Connect to the internet and open the app again.`;
  if (Number(releasedVersion) > Number(APP_VERSION)) return `This is version ${APP_VERSION}. The released version is ${releasedVersion}. Tap “Update the app” to get it. Your data is not affected.`;
  return `This is version ${APP_VERSION}. The released version is ${releasedVersion}. You have the newest version.`;
}

function androidUpdateCard() {
  if (!androidUpdate) return '';
  const stage = updateUi.stage;
  return `<section class="card">
    <div class="name" style="white-space:normal">A new version of the Android app is ready${androidUpdate.name ? ` (${esc(androidUpdate.name)})` : ''}</div>
    <p class="note" style="margin:6px 0 14px">${stage === 'ready' ? 'It is downloaded. Tap Update to install it.' : stage === 'downloading' ? 'It is downloading.' : 'Tap Update to get it.'} Your data stays as it is.</p>
    <button class="btn" data-act="android-update">${stage === 'downloading' ? `Downloading${updateUi.pct >= 0 ? `… ${Math.min(100, updateUi.pct)}%` : '…'}` : 'Update'}</button>
  </section>`;
}

/* ---------- Derived data ---------- */

const cat = (id) => state.categories.find((c) => c.id === id) || null;
const catsOf = (type) => state.categories.filter((c) => c.type === type);
const catLabel = (c) => (c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : 'Uncategorised');

function totalsOf(list) {
  const t = { income: 0, expense: 0, saving: 0 };
  for (const x of list) t[x.type] += x.amount;
  for (const k of TYPES) t[k] = r3(t[k]);
  t.balance = r3(t.income - t.expense - t.saving);
  return t;
}
const txInMonth = (ym) => state.transactions.filter((t) => t.date.startsWith(ym));

// Money left at the end of a month is carried into the next one, until the person decides otherwise (see leftoverSheet).
// This is the amount a month starts with: what the months before it left, counted from the month carrying over began.
// A month that ended short carries nothing. A month that has not come yet shows nothing, as the one before it is not over.
function carryInto(ym) {
  const from = state.settings.carryFrom;
  if (!isYM(from) || !isYM(ym) || ym <= from || ym > curYM()) return 0;
  const sums = {};
  for (const t of state.transactions) {
    const m = t.date.slice(0, 7);
    if (m >= from && m < ym) sums[m] = (sums[m] || 0) + (t.type === 'income' ? t.amount : -t.amount);
  }
  let carry = 0;
  for (let m = from; m < ym; m = addMonths(m, 1)) carry = Math.max(0, r3(carry + (sums[m] || 0)));
  return carry;
}
const monthName = (ym) => monthNameOf(Number(ym.slice(5, 7)));
// The month whose leftover still waits for a decision: the one before this month, if it ended with money left.
function leftoverWaiting() {
  if (isGuest()) return null;
  const ym = addMonths(curYM(), -1);
  const amount = carryInto(curYM());
  return amount > 0 && !(state.leftover || {})[ym] ? { ym, amount } : null;
}

// An EMI runs for `tenure` months from `start`. Each month is one instalment, paid or still open.
function emiStats(e) {
  const pays = state.transactions.filter((t) => t.emiId === e.id);
  const months = Array.from({ length: e.tenure }, (_, i) => {
    const ym = addMonths(e.start, i);
    return { ym, seq: i + 1, before: i < e.paidBefore, tx: pays.find((t) => t.period === ym) || null };
  });
  const open = months.filter((m) => !m.before && !m.tx);
  return { months, open, end: addMonths(e.start, e.tenure - 1), paidCount: e.tenure - open.length,
    total: r3(e.monthly * e.tenure), left: r3(open.length * e.monthly) };
}

// What a repeating item costs in a given month: its starting amount, or the latest change that has taken effect by then.
function recAmount(r, ym) {
  let amount = r.amount;
  for (const c of r.changes || []) if (c.from <= ym) amount = c.amount;
  return amount;
}
// The first month, from this month on, that has not been paid yet.
function firstUnpaidMonth(r) {
  let ym = r.start > curYM() ? r.start : curYM();
  for (let i = 0; i < 36 && state.transactions.some((t) => t.recurringId === r.id && t.period === ym); i++) ym = addMonths(ym, 1);
  return ym;
}

// Everything that repeats and falls in the given month: repeating items and EMI instalments, each paid or not.
function dueItems(ym) {
  const month = Number(ym.slice(5, 7));
  const items = [];
  for (const r of state.recurring) {
    if (r.start > ym || (r.end && ym > r.end)) continue;
    if (r.frequency === 'yearly' && r.month !== month) continue;
    // A weekly item is due once for every time its weekday falls in the month. Each of those is paid or skipped on its own.
    const weekly = r.frequency === 'weekly';
    const dates = !weekly ? [dateIn(ym, r.day)]
      : Array.from({ length: daysInMonth(ym) }, (_, i) => dateIn(ym, i + 1)).filter((d) => toDate(d).getDay() === r.weekday && d >= (r.since || ''));
    for (const date of dates) {
      const period = weekly ? date : ym;
      const paid = state.transactions.find((t) => t.recurringId === r.id && t.period === period) || null;
      if (r.paused && !paid) continue;
      items.push({ key: 'rec:' + r.id + (weekly ? ':' + date : ''), kind: 'rec', ref: r, name: r.name, type: r.type, amount: recAmount(r, ym), categoryId: r.categoryId,
        date, period, weekly, paid, skipped: !paid && r.skips.includes(period) });
    }
  }
  for (const e of state.emis) {
    const i = monthsBetween(e.start, ym);
    if (i < e.paidBefore || i >= e.tenure) continue;
    const paid = state.transactions.find((t) => t.emiId === e.id && t.period === ym) || null;
    items.push({ key: 'emi:' + e.id, kind: 'emi', ref: e, name: e.name, type: 'expense', amount: e.monthly, categoryId: e.categoryId,
      date: dateIn(ym, e.day), period: ym, paid, skipped: false, seq: i + 1 });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
// A bill is Unpaid from the first day of its month until it is marked paid, whatever its due day.
// Months that have not started yet are only "Upcoming". Expected income is never shown as unpaid.
// A weekly bill is Unpaid from its own day, so the weeks still to come do not all show red at once.
function dueStatus(it) {
  if (it.paid) return 'done';
  if (it.skipped) return 'skipped';
  if (it.type === 'income') return 'expected';
  return (it.weekly ? it.date > today() : it.date.slice(0, 7) > curYM()) ? 'upcoming' : 'unpaid';
}
const isOpen = (it) => !it.paid && !it.skipped;

// Opens the right sheet for one due item: its payment if already paid, otherwise a pre-filled entry for that month.
function openDue(it, ym) {
  if (it.paid) return txSheet(it.paid);
  if (it.skipped) { it.ref.skips = it.ref.skips.filter((m) => m !== it.period); save(); render(); return toast('Back on the list'); }
  const income = it.type === 'income';
  txSheet(null, { title: `${income ? 'Received' : it.type === 'saving' ? 'Save' : 'Pay'}: ${it.name}`, cta: income ? 'Mark as received' : 'Mark as paid',
    type: it.type, amount: it.amount, categoryId: it.categoryId, note: it.name, date: ym === curYM() ? today() : it.date,
    recurringId: it.kind === 'rec' ? it.ref.id : '', emiId: it.kind === 'emi' ? it.ref.id : '', period: it.period, canSkip: it.kind === 'rec' });
}

const debtPaid = (d) => sum(d.payments, (p) => p.amount);
const debtLeft = (d) => (d.settled ? 0 : Math.max(0, r3(d.amount - debtPaid(d))));
const debtTotal = (kind) => sum(state.debts.filter((d) => d.kind === kind), debtLeft);

// Every plan has a savings fund of its own, with the plan's cost as its target, so money can be set aside for it.
const savedIn = (c) => (c ? r3(sum(state.transactions.filter((t) => t.type === 'saving' && t.categoryId === c.id), (t) => t.amount) + (c.opening || 0)) : 0);
const planFund = (p) => (p.fundId && cat(p.fundId) && cat(p.fundId).type === 'saving' ? cat(p.fundId) : null);
function ensurePlanFund(p) {
  let c = planFund(p);
  if (!c) {
    c = { id: uid(), type: 'saving', group: 'primary', name: p.name, emoji: '🎯', budget: 0, opening: 0, target: p.price, planId: p.id };
    state.categories.push(c);
    p.fundId = c.id;
  }
  return c;
}
// A fund whose plan was bought holds no money any more.
const liveFunds = () => catsOf('saving').filter((c) => !c.used);

// The day a plan is for. A plan from before plans had a day counts from the first of its month.
const planDate = (p) => p.date || (p.target ? `${p.target}-01` : '');
// Planner items whose reminder has come: their day is tomorrow, today or already past, and they are still open.
// They are counted on the Planner tab until they are paid, received, bought or given another date.
function plannerDue() {
  const until = addDays(today(), 1);
  const debts = state.debts.filter((d) => !d.settled && isDate(d.due) && d.due <= until && debtLeft(d) > 0);
  return {
    plans: state.plans.filter((p) => !p.done && planDate(p) && planDate(p) <= until),
    receivable: debts.filter((d) => d.kind === 'receivable'),
    payable: debts.filter((d) => d.kind === 'payable')
  };
}
// "Due tomorrow", "Due today" or "Overdue" for such an item, as a small label; nothing for a day further away.
function duePill(date, open) {
  if (!open || !date || date > addDays(today(), 1)) return '';
  return date < today() ? '<span class="pill overdue">⚠ Overdue</span>' : `<span class="pill unpaid">${date === today() ? 'Due today' : 'Due tomorrow'}</span>`;
}

/* ---------- Reminders ---------- */

// Everything FETA would remind about, worked out from the data: what happened already and what is coming in the next weeks.
// The bell on Home lists the ones whose time has come. The Android app is handed the whole list and shows each one
// as a phone notification at its time, also when FETA is closed.
const atHour = (date, hour) => { const d = toDate(date); d.setHours(hour, 0, 0, 0); return d.getTime(); };

function buildNotices() {
  if (!state.settings.started) return [];
  const off = state.settings.notify || {};
  // A guest is only told about comments: the bills, plans and limits are the owner's business.
  const guest = isGuest();
  const want = (kind) => !guest && off[kind] !== false;
  const now = Date.now();
  const ymNow = curYM();
  const list = [];
  const add = (kind, id, at, title, body, tab, month) => list.push({ kind, id, at, title, body, tab, month: month || '' });

  if (want('bills')) {
    for (const ym of [ymNow, addMonths(ymNow, 1)]) {
      for (const it of dueItems(ym)) {
        if (it.type === 'income' || !isOpen(it)) continue;
        const what = it.kind === 'emi' ? `${it.name} (instalment ${it.seq} of ${it.ref.tenure})` : it.name;
        const late = atHour(addDays(it.date, 3), 9);
        // Once the "still unpaid" reminder has come, it replaces the "due today" one.
        if (now < late) add('bills', `due:${it.key}:${ym}`, atHour(it.date, 9), `${what} is due today`, `${fmt(it.amount)} to pay.`, 'home', ym);
        add('bills', `late:${it.key}:${ym}`, late, `${what} is still unpaid`, `${fmt(it.amount)} was due on ${fmtShort(it.date)}.`, 'home', ym);
      }
    }
  }

  if (want('weekreport')) {
    const thisWeek = weekStartOf(today());
    for (const from of [addDays(thisWeek, -7), thisWeek]) {
      const to = addDays(from, 6);
      const at = atHour(to, 20);
      const t = totalsOf(state.transactions.filter((x) => x.date >= from && x.date <= to));
      const past = at <= now;
      if (past && !(t.income || t.expense || t.saving)) continue;
      add('weekreport', `week:${from}`, at, 'Your weekly report is ready',
        past ? `Income ${fmt(t.income)} · spent ${fmt(t.expense)} · saved ${fmt(t.saving)} · left ${fmt(t.balance)}.` : 'See where your money went this week.', 'reports', from);
    }
  }

  if (want('report')) {
    for (const ym of [addMonths(ymNow, -1), ymNow]) {
      const at = atHour(dateIn(ym, 31), 20);
      const t = totalsOf(txInMonth(ym));
      const past = at <= now;
      if (past && !(t.income || t.expense || t.saving)) continue;
      add('report', `report:${ym}`, at, `Your ${ymLabel(ym)} report is ready`,
        past ? `Income ${fmt(t.income)} · spent ${fmt(t.expense)} · saved ${fmt(t.saving)} · left ${fmt(t.balance)}.` : 'See where your money went this month.', 'reports', ym);
    }
  }

  if (want('plans')) {
    const open = state.plans.filter((p) => !p.done);
    for (const p of open.filter((x) => planDate(x))) {
      const day = planDate(p);
      const price = p.price > 0 ? `About ${fmt(p.price)}.` : 'Open the planner to see it.';
      add('plans', `plan:${p.id}:${p.target}:before`, atHour(addMonths(p.target, -1) + '-01', 9), `${p.name} is planned for next month`, price, 'planner', 'plans');
      add('plans', `plan:${p.id}:${day}:eve`, atHour(addDays(day, -1), 9), `${p.name} is planned for tomorrow`, price, 'planner', 'plans');
      add('plans', `plan:${p.id}:${day}`, atHour(day, 9), `${p.name} is planned for today`, price, 'planner', 'plans');
    }
    const loose = open.filter((x) => !isYM(x.target));
    if (loose.length) {
      const names = loose.slice(0, 3).map((x) => x.name).join(', ') + (loose.length > 3 ? ` and ${loose.length - 3} more` : '');
      for (const ym of [ymNow, addMonths(ymNow, 1)]) add('plans', `plans:${ym}`, atHour(ym + '-01', 10), 'Still on your plan list', names, 'planner', 'plans');
    }
  }

  if (want('budget')) {
    const spent = {};
    for (const t of txInMonth(ymNow)) if (t.type === 'expense') spent[t.categoryId] = r3((spent[t.categoryId] || 0) + t.amount);
    for (const c of catsOf('expense')) {
      if (!(c.budget > 0)) continue;
      const used = spent[c.id] || 0;
      if (used >= c.budget) add('budget', `limit:${c.id}:${ymNow}:100`, now, `${c.name} is over its limit`, `${fmt(used)} spent of the ${fmt(c.budget)} limit this month.`, 'reports', ymNow);
      else if (used >= c.budget * 0.8) add('budget', `limit:${c.id}:${ymNow}:80`, now, `${c.name} is close to its limit`, `${fmt(used)} spent of ${fmt(c.budget)}. ${fmt(r3(c.budget - used))} left this month.`, 'reports', ymNow);
    }
  }

  if (want('debts')) {
    for (const d of state.debts) {
      const left = debtLeft(d);
      if (!isDate(d.due) || !(left > 0)) continue;
      add('debts', `debt:${d.id}:${d.due}:eve`, atHour(addDays(d.due, -1), 9), d.kind === 'payable' ? `Tomorrow you owe ${d.person} ${fmt(left)}` : `${d.person} owes you ${fmt(left)} tomorrow`, `Due ${fmtDay(d.due)}.`, 'planner', d.kind);
      add('debts', `debt:${d.id}:${d.due}`, atHour(d.due, 9), d.kind === 'payable' ? `You owe ${d.person} ${fmt(left)}` : `${d.person} owes you ${fmt(left)}`, `Due ${fmtDay(d.due)}.`, 'planner', d.kind);
    }
  }

  if (want('goals')) {
    const saved = {};
    for (const t of state.transactions) if (t.type === 'saving') saved[t.categoryId] = r3((saved[t.categoryId] || 0) + t.amount);
    for (const c of liveFunds()) {
      const have = r3((saved[c.id] || 0) + (c.opening || 0));
      if (c.target > 0 && have >= c.target) add('goals', `goal:${c.id}:${c.target}`, now, `${c.name} reached its target`, `${fmt(have)} saved. The target was ${fmt(c.target)}.`, 'savings');
    }
  }

  if (want('updates') && androidUpdate) {
    const name = androidUpdate.name || 'new';
    const body = 'Open FETA and tap Update. You stay signed in.';
    add('updates', `update:${name}`, now, 'A new version of FETA is ready', body, 'update');
    list[list.length - 1].inAppOnly = true;
    for (let week = 1; week <= 4; week++) add('updates', `update:${name}:${week}`, atHour(addDays(today(), 7 * week), 10), 'A new version of FETA is ready', body, 'update');
  }

  if (guest || off.comments !== false) {
    const me = myId();
    for (const c of share.comments) {
      const t = c.author_id !== me && state.transactions.find((x) => x.id === c.tx_id);
      if (!t) continue;
      const k = cat(t.categoryId);
      add('comments', `comment:${c.id}`, Math.min(Date.parse(c.created_at) || now, now), `${c.author_name || 'Someone'} commented on ${t.note || (k ? k.name : 'a transaction')}`, String(c.body || ''), 'home', t.date.slice(0, 7));
      list[list.length - 1].tx = t.id;
    }
  }

  if (want('leftover')) {
    const waiting = leftoverWaiting();
    const text = 'It is carried over to this month for now. Tap to choose what to do with it.';
    if (waiting) add('leftover', `leftover:${waiting.ym}`, atHour(ymNow + '-01', 9), `${fmt(waiting.amount)} was left from ${monthName(waiting.ym)}`, text, 'leftover', waiting.ym);
    // The same question for this month, for the phone to ask on the first day of the next one.
    const next = addMonths(ymNow, 1);
    if (isYM(state.settings.carryFrom) && ymNow >= state.settings.carryFrom && !(state.leftover || {})[ymNow]) {
      add('leftover', `leftover:${ymNow}`, atHour(next + '-01', 9), `Money was left from ${monthName(ymNow)}`, text, 'leftover', ymNow);
    }
  }

  // An invitation to someone else's profile, until it is accepted or declined. It is also marked on Setup, where it is answered.
  if (sync.session) {
    for (const g of share.invites) {
      const who = person(g.owner_id).name || g.owner_email || 'Someone';
      add('invites', `invite:${g.id}`, Math.min(Date.parse(g.created_at) || now, now), `${who} invited you to their profile`,
        g.role === 'add' ? 'Invites you to see the reports and add expenses.' : 'Invites you to see the reports.', 'profile');
    }
  }

  // Nothing older than five weeks, nothing further ahead than six.
  return list.filter((n) => n.at > now - 35 * 864e5 && n.at < now + 42 * 864e5).sort((a, b) => a.at - b.at);
}

const currentNotices = () => { const now = Date.now(); return buildNotices().filter((n) => n.at <= now).reverse(); };
function seenNotices() {
  if (!isGuest()) return new Set(state.seen || []);
  try { return new Set(mergeSeen(JSON.parse(localStorage.getItem(GSEEN_KEY)), [])); } catch (e) { return new Set(); }
}
const unreadCount = () => { const seen = seenNotices(); return currentNotices().filter((n) => !seen.has(n.id)).length; };

// The bell opens the notifications as a full-screen list. Opening it counts as having read them, on this device and on
// every other one using the account; the ones that were new are still marked New while the list stays open.
function openNotices() {
  const list = currentNotices();
  const seen = seenNotices();
  ui.noticeNew = list.filter((n) => !seen.has(n.id)).map((n) => n.id);
  if (ui.noticeNew.length) {
    const ids = list.map((n) => n.id);
    if (isGuest()) { try { localStorage.setItem(GSEEN_KEY, JSON.stringify(mergeSeen([...seen], ids))); } catch (e) { /* ignore */ } }
    else { state.seen = mergeSeen(state.seen, ids); save(); }
  }
  ui.page = 'notices';
  nextSlide = 'from-right';
  closeSheet(); render(); window.scrollTo(0, 0);
}
function viewNotices() {
  const list = currentNotices();
  const fresh = new Set(ui.noticeNew);
  return `<header class="top sub-top"><button class="x" data-act="notices-back" aria-label="Back">‹</button><h1>Notifications</h1></header>
    <div class="list">${list.length ? list.map((n) => `<button class="row" data-act="notice-go" data-id="${esc(n.tab)}" data-month="${esc(n.month)}" data-tx="${esc(n.tx || '')}">
      <span class="emoji" aria-hidden="true">${NOTIFY_EMOJI[n.kind] || '🔔'}</span>
      <span class="row-main"><span class="row-top"><span class="name" style="white-space:normal">${esc(n.title)}</span>${fresh.has(n.id) ? '<span class="pill">New</span>' : ''}</span>
      <span class="row-sub" style="white-space:normal">${esc(n.body)}</span></span></button>`).join('')
      : '<div class="empty">Nothing to tell you right now. Bills that are due, the monthly report, planner reminders and app updates show up here.</div>'}</div>
    ${isGuest() ? '' : '<button class="btn ghost" style="margin-top:14px" data-act="notice-go" data-id="more">Choose what to be notified about</button>'}`;
}

// Called by the Android app when a notification is tapped, and by the list above.
window.fetaGo = (tab, month, tx) => {
  if (!state.settings.started) return;
  closeSheet();
  if (tab === 'update') { ui.tab = 'home'; render(); if (androidUpdate) androidUpdateSheet(); return; }
  // Money left from last month: open Home on this month with the question.
  if (tab === 'leftover') {
    if (isGuest()) return;
    ui.tab = 'home'; ui.home = 'month'; ui.month = curYM(); ui.page = null; ui.bar = null;
    render(); window.scrollTo(0, 0);
    if (isYM(month)) leftoverSheet(month);
    return;
  }
  // An invitation is answered on the profile page under Setup.
  if (tab === 'profile') { profileSheet(); window.scrollTo(0, 0); return; }
  if (!['home', 'bills', 'savings', 'reports', 'planner', 'more'].includes(tab)) return;
  if (isGuest() && tab !== 'home' && tab !== 'reports') return;
  ui.tab = tab; ui.bar = null; ui.page = null;
  // The only way here with Setup is the bell's "Choose what to be notified about".
  ui.setup = tab === 'more' ? 'notify' : null;
  if (tab === 'home') { ui.home = 'month'; if (isYM(month)) ui.month = month; }
  // A planner reminder opens the list it is about.
  if (tab === 'planner' && ['plans', 'receivable', 'payable'].includes(month)) ui.planner = month;
  if (tab === 'reports' && isYM(month)) { ui.rep.period = 'month'; ui.rep.cursor = month + '-01'; }
  // A weekly report is opened with the first day of its week.
  if (tab === 'reports' && isDate(month)) { ui.rep.period = 'week'; ui.rep.cursor = month; }
  render(); window.scrollTo(0, 0);
  // A comment's notification opens the transaction it was written on.
  if (tx) reopenTx(tx);
};

const notifyState = () => { try { return android && android.notifyState ? String(android.notifyState()) : ''; } catch (e) { return ''; } };
// The Android app tells the page when the phone's notification permission changed.
window.fetaNotifyChanged = () => { queueNotify(); if (ui.tab === 'more' && !$('#sheet-root').firstChild) render(); };

// Hands the reminders to the Android app a moment after the data last changed.
let notifyTimer = null;
function queueNotify() {
  if (!android || !android.notifySchedule) return;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    const now = Date.now();
    const seen = seenNotices();
    // A reminder already read, here or on another device, is not put on the phone again.
    const items = buildNotices().filter((n) => !n.inAppOnly && !seen.has(n.id) && n.at > now - 12 * 36e5).slice(0, 80)
      .map((n) => ({ id: n.id, at: n.at, title: tr(n.title), body: tr(n.body), tab: n.tab, month: n.month }));
    try { android.notifySchedule(JSON.stringify(items)); } catch (e) { /* the app is too old for reminders */ }
  }, 900);
}

function notifyCard(withHead = true) {
  const off = state.settings.notify || {};
  const st = notifyState();
  const phone = !android || !android.notifySchedule
    ? `<p class="note" style="margin:0 0 14px">On this device, reminders show inside FETA: tap the bell on Home. Notifications on the phone itself need the FETA Android app.</p>`
    : st === 'granted' ? '<p class="note" style="margin:0 0 14px">✓ This phone shows FETA’s notifications, also when the app is closed.</p>'
      : `<p class="note" style="margin:0 0 10px">This phone is not showing FETA’s notifications yet.</p>
        <button class="btn" data-act="notify-ask" style="margin-bottom:14px">Turn on notifications</button>`;
  return `${withHead ? '<div class="sec-head"><h2>Notifications</h2></div>' : ''}
    <section class="card">
      ${phone}
      ${NOTIFY_KINDS.map(([kind, label, hint]) => `<label class="check notify-row"><input type="checkbox" data-notify="${kind}" ${off[kind] === false ? '' : 'checked'}>
        <span><span class="name">${label}</span><span class="row-sub" style="white-space:normal;display:block">${hint}</span></span></label>`).join('')}
    </section>`;
}

// Only in the Android app: approximate location, asked for so that ads can fit the person's area once FETA shows ads.
const locationState = () => { try { return android && android.locationState ? String(android.locationState()) : ''; } catch (e) { return ''; } };
function locationCard() {
  const st = locationState();
  if (!st) return '';
  return `<div class="sec-head"><h2>Location</h2></div>
    <section class="card">
      <p class="note" style="margin:0 0 ${st === 'granted' ? 0 : 10}px">${st === 'granted' ? '✓ FETA may use this phone’s approximate location.' : 'FETA does not have this phone’s location.'} It is only used to choose ads that fit your area. It is never saved with your income and expenses.</p>
      ${st === 'granted' ? '' : '<button class="btn" data-act="location-ask">Allow approximate location</button>'}
    </section>`;
}

/* ---------- Theme, toast, sheets ---------- */

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

let toastTimer;
// A message stays long enough to be read: 3 seconds, or longer when asked.
function toast(msg, ms = 3000) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), Math.max(3000, ms));
}

function openSheet(title, body) {
  $('#sheet-root').innerHTML = `
    <div class="backdrop" data-act="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="x" data-act="close-sheet" aria-label="Close">✕</button></div>
      ${body}
    </div>`;
  const focus = $('#sheet-root [data-autofocus]');
  if (focus) focus.focus();
}
// Shows the open pop-up in the middle of the screen instead of at the bottom.
function centerSheet() { const el = $('#sheet-root .sheet'); if (el) el.classList.add('center'); }
function closeSheet() { $('#sheet-root').innerHTML = ''; pendingConfirm = null; }

function confirmSheet(title, message, label, fn) {
  openSheet(title, `<p>${esc(message)}</p>
    <button class="btn danger" data-act="confirm-yes">${esc(label)}</button>
    <button class="btn ghost" data-act="close-sheet">Cancel</button>`);
  pendingConfirm = fn;
}

/* ---------- Shared pieces ---------- */

// The + button adds whatever belongs to the screen you are on. Only Home offers every kind of entry.
function fabHtml() {
  const recv = ui.planner === 'receivable';
  const fab = {
    home: ['add-tx', 'Add income, an expense or savings'],
    bills: ['add-bill', ui.bills === 'emi' ? 'Add an EMI' : 'Add a monthly bill'],
    savings: ['add-saving', 'Add savings'],
    reports: ['add-tx', ADD_TITLE[ui.rep.measure]],
    planner: ui.planner === 'plans' ? ['add-plan', 'Add a plan'] : ['add-debt', recv ? 'Add money someone owes you' : 'Add money you owe']
  }[ui.tab];
  if (isGuest()) return guestCanAdd() ? '<button class="fab" data-act="add-tx" aria-label="Add an expense">+</button>' : '';
  return fab ? `<button class="fab" data-act="${fab[0]}" aria-label="${fab[1]}">+</button>` : '';
}

function render() {
  const app = $('#app');
  queueNotify();
  if (!state.settings.started) { app.innerHTML = viewWelcome(); return; }
  const views = { home: viewHome, bills: viewBills, savings: viewSavings, reports: viewReports, planner: viewPlanner, more: viewMore };
  // A guest has Home and Reports, and a Setup that only holds their own profile. Bills, Savings and Planner belong to the owner.
  const guest = isGuest();
  const guestTabs = ['home', 'reports', 'more'];
  if (guest && !guestTabs.includes(ui.tab)) ui.tab = 'home';
  const tabs = [['home', 'Home'], ['bills', 'Bills'], ['savings', 'Savings'], ['reports', 'Reports'], ['planner', 'Planner'], ['more', 'Setup']]
    .filter(([id]) => !guest || guestTabs.includes(id));
  // Invitations waiting for an answer are marked on Setup, where the profile is.
  const invites = sync.session ? share.invites.length : 0;
  const notices = ui.page === 'notices';
  const due = guest ? null : plannerDue();
  const planned = due ? due.plans.length + due.receivable.length + due.payable.length : 0;
  const overdue = guest ? 0 : dueItems(curYM()).filter((it) => dueStatus(it) === 'unpaid').length;
  // Anything other than the person's own main profile is named at the top, so it is clear whose money this is.
  const shown = sync.profile && !sync.profile.main ? sync.profile : null;
  const profileBar = shown ? `<button class="profile-bar" data-act="profile"><span class="pill ${guest ? '' : 'done'}">${guest ? 'Guest' : 'Own'}</span>
    <span class="name">${esc(profileLabel(shown))}</span>${guest ? `<span class="row-sub">${ROLE_TEXT[shown.role === 'add' ? 'add' : 'view']}</span>` : ''}</button>` : '';
  // When the tab changes, the glass capsule slides from the old tab to the new one and the page slides in from that side.
  const index = tabs.findIndex(([id]) => id === ui.tab);
  const from = lastTabIndex == null ? index : lastTabIndex;
  const slide = index > from ? 'from-right' : index < from ? 'from-left' : nextSlide;
  nextSlide = '';
  lastTabIndex = index;
  app.innerHTML = `
    <div class="view ${slide}">${notices ? viewNotices() : profileBar + views[ui.tab]()}</div>
    ${notices ? '' : fabHtml()}
    <nav class="tabbar"><div class="tabbar-in" style="--n:${tabs.length}">
      <i class="tab-pill" style="--i:${from}" aria-hidden="true"></i>
      ${tabs.map(([id, label]) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>
        ${ICONS[id]}${id === 'home' && overdue ? `<i class="badge" aria-label="${overdue} unpaid">${overdue}</i>` : ''}${id === 'more' && invites ? `<i class="badge">${invites}</i>` : ''}${id === 'planner' && planned ? `<i class="badge" aria-label="${planned} due">${planned}</i>` : ''}<span>${label}</span></button>`).join('')}
    </div></nav>`;
  if (from !== index) {
    requestAnimationFrame(() => requestAnimationFrame(() => { const pill = $('.tab-pill'); if (pill) pill.style.setProperty('--i', index); }));
  }
  if (navSlide) { const nav = $('.view .month-nav'); if (nav) nav.classList.add(navSlide); navSlide = ''; }
  slidePills();
}
let lastTabIndex = null;
// Set just before drawing a page that is opened from, or goes back to, the screen it belongs to: it slides in from that side.
let nextSlide = '';
// Set just before drawing a screen whose month, week, day or year was changed with its arrows: what is under the
// arrows slides in from the right when going forward in time and from the left when going back.
let navSlide = '';
const dateSlide = (d) => { navSlide = d > 0 ? 'changed-right' : d < 0 ? 'changed-left' : ''; };

function currencyOptions(selected) {
  const list = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
  return list.map((c) => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

function catOptions(type, selected) {
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(catLabel(c))}</option>`;
  const cats = catsOf(type).filter((c) => !c.used || c.id === selected);
  if (!cats.length) return '<option value="">No categories yet</option>';
  if (type !== 'income') return cats.map(opt).join('');
  return ['primary', 'secondary'].map((g) => {
    const list = cats.filter((c) => c.group === g);
    return list.length ? `<optgroup label="${g === 'primary' ? 'Primary income' : 'Secondary income'}">${list.map(opt).join('')}</optgroup>` : '';
  }).join('');
}

// A switch between a few choices, drawn like the bottom bar: a glass capsule sits under the chosen one and slides
// to the new choice when it changes. Each switch remembers where its capsule was, so it can start the slide from there.
const segLast = {};
function segButtons(act, options, current) {
  const to = Math.max(0, options.findIndex(([v]) => v === current));
  const from = act in segLast ? segLast[act] : to;
  segLast[act] = to;
  // When the choice changed, whatever is shown under the switch slides in from the side of the new choice.
  const moved = to > from ? 'changed-right' : to < from ? 'changed-left' : '';
  return `<div class="seg ${moved}" style="--n:${options.length};grid-template-columns:repeat(${options.length},1fr)">
    <i class="seg-pill" style="--i:${from}" ${from === to ? '' : `data-to="${to}"`} aria-hidden="true"></i>${options.map(([v, l]) =>
    `<button type="button" class="${v === current ? 'on' : ''}" data-act="${act}" data-id="${v}" aria-pressed="${v === current}">${l}</button>`).join('')}</div>`;
}
// Starts the slide of every capsule that was drawn at its old place.
function slidePills() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const pill of document.querySelectorAll('.seg-pill[data-to]')) { pill.style.setProperty('--i', pill.dataset.to); pill.removeAttribute('data-to'); }
  }));
}

function monthNav(ym, act) {
  return `<div class="month-nav">
    <button class="nav-btn" data-act="${act}" data-d="-1" aria-label="Previous">‹</button>
    <div class="month-title">${ymLabel(ym)}</div>
    <button class="nav-btn" data-act="${act}" data-d="1" aria-label="Next">›</button>
  </div>`;
}

function txRow(t) {
  const c = cat(t.categoryId);
  const title = t.note || (c ? c.name : 'Uncategorised');
  const talk = share.comments.filter((x) => x.tx_id === t.id).length;
  const tags = [t.type === 'saving' ? 'Savings' : '', t.note && c ? c.name : '', t.emiId ? 'EMI' : t.recurringId ? 'Repeating' : '', t.byName ? `Added by ${t.byName}` : '', talk ? `💬 ${talk}` : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-act="edit-tx" data-id="${t.id}">
    <span class="emoji" aria-hidden="true">${esc((c && c.emoji) || (t.type === 'income' ? '💰' : t.type === 'saving' ? '🏦' : '•'))}</span>
    <span class="row-main">
      <span class="row-top"><span class="name">${esc(title)}</span>
        <span class="amt ${t.type === 'income' ? 'inc' : ''}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span></span>
      ${tags ? `<span class="row-sub">${esc(tags)}</span>` : ''}
    </span></button>`;
}

const sortedTx = (list) => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));

function txGroups(list, emptyText) {
  if (!list.length) return `<div class="list"><div class="empty">${emptyText}</div></div>`;
  const days = [];
  for (const t of sortedTx(list)) {
    if (!days.length || days[days.length - 1].date !== t.date) days.push({ date: t.date, items: [] });
    days[days.length - 1].items.push(t);
  }
  return days.map((d) => {
    const net = sum(d.items, (t) => (t.type === 'income' ? t.amount : -t.amount));
    return `<div class="day-head"><span>${fmtDay(d.date)}</span><span>${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}</span></div>
      <div class="list">${d.items.map(txRow).join('')}</div>`;
  }).join('');
}

/* ---------- Welcome ---------- */

const LOGO_SVG = `<svg class="brand-logo" role="img" aria-label="FETA" viewBox="0 0 2884 990" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M190.404 62.4195C204.604 24.8549 240.571 0 280.73 0H594.764C662.295 0 708.97 67.5427 685.09 130.711L501.013 617.653C486.813 655.218 450.846 680.073 410.687 680.073H96.6536C29.1224 680.073 -17.5524 612.53 6.3269 549.362L190.404 62.4195Z" fill="url(#paint0_linear_178_28)"/><path d="M306.915 371.744C321.116 334.179 357.083 309.324 397.242 309.324H711.275C778.807 309.324 825.481 376.867 801.602 440.035L617.525 926.977C603.325 964.542 567.358 989.397 527.198 989.397H213.165C145.634 989.397 98.9593 921.854 122.839 858.686L306.915 371.744Z" fill="url(#paint1_linear_178_28)"/><path d="M501.014 617.652C486.813 655.217 450.846 680.072 410.687 680.072H190.359L306.915 371.744C321.116 334.179 357.083 309.324 397.242 309.324H617.57L501.014 617.652Z" fill="#5CB3C7"/><path d="M1101.77 805.232V175.4H1544.62V313.176H1272.76V421.428H1517.55V559.204H1272.76V805.232H1101.77Z" fill="currentColor"/><path d="M1801.64 813.843C1751.2 813.843 1707.74 804.207 1671.24 784.935C1634.96 765.457 1606.97 737.574 1587.29 701.285C1567.81 664.791 1558.07 621.121 1558.07 570.275C1558.07 521.48 1567.91 478.835 1587.59 442.341C1607.28 405.847 1635.06 377.451 1670.94 357.154C1706.82 336.856 1749.15 326.708 1797.95 326.708C1833.62 326.708 1865.91 332.243 1894.82 343.314C1923.73 354.386 1948.44 370.48 1968.94 391.597C1989.44 412.51 2005.23 437.933 2016.3 467.866C2027.37 497.8 2032.91 531.526 2032.91 569.045V608.41H1610.97V514.919H1876.68C1876.47 501.387 1872.99 489.496 1866.22 479.245C1859.66 468.789 1850.74 460.69 1839.47 454.95C1828.39 449.004 1815.79 446.031 1801.64 446.031C1787.9 446.031 1775.29 449.004 1763.81 454.95C1752.33 460.69 1743.11 468.686 1736.13 478.937C1729.37 489.189 1725.78 501.182 1725.37 514.919V615.79C1725.37 630.962 1728.55 644.494 1734.9 656.385C1741.26 668.276 1750.38 677.605 1762.27 684.371C1774.17 691.136 1788.52 694.519 1805.33 694.519C1817.02 694.519 1827.68 692.879 1837.31 689.599C1847.15 686.318 1855.56 681.603 1862.53 675.452C1869.5 669.096 1874.63 661.511 1877.91 652.695H2032.91C2027.57 685.498 2014.97 713.997 1995.08 738.189C1975.19 762.177 1948.85 780.834 1916.04 794.161C1883.44 807.282 1845.31 813.843 1801.64 813.843Z" fill="currentColor"/><path d="M2383.88 332.858V455.872H2072.65V332.858H2383.88ZM2132.93 219.685H2302.69V653.31C2302.69 659.87 2303.82 665.406 2306.07 669.917C2308.33 674.222 2311.81 677.502 2316.53 679.758C2321.25 681.808 2327.29 682.833 2334.67 682.833C2339.8 682.833 2345.75 682.218 2352.51 680.988C2359.48 679.758 2364.61 678.733 2367.89 677.912L2392.49 797.236C2384.9 799.491 2374.04 802.259 2359.89 805.539C2345.95 808.82 2329.34 810.973 2310.07 811.998C2271.12 814.048 2238.42 810.05 2211.97 800.004C2185.52 789.753 2165.63 773.658 2152.31 751.721C2138.98 729.783 2132.52 702.31 2132.93 669.301V219.685Z" fill="currentColor"/><path d="M2584.78 812.613C2554.64 812.613 2527.99 807.692 2504.82 797.851C2481.86 787.805 2463.81 772.633 2450.69 752.336C2437.57 732.039 2431.01 706.206 2431.01 674.837C2431.01 649.004 2435.42 626.964 2444.23 608.717C2453.05 590.265 2465.35 575.196 2481.14 563.509C2496.92 551.823 2515.27 542.905 2536.19 536.754C2557.3 530.603 2580.06 526.605 2604.46 524.76C2630.91 522.71 2652.13 520.25 2668.12 517.379C2684.32 514.304 2696 510.101 2703.18 504.77C2710.35 499.235 2713.94 491.956 2713.94 482.935V481.705C2713.94 469.404 2709.23 459.973 2699.8 453.412C2690.36 446.851 2678.27 443.571 2663.51 443.571C2647.31 443.571 2634.09 447.159 2623.83 454.335C2613.79 461.305 2607.74 472.069 2605.69 486.626H2449.46C2451.51 457.922 2460.64 431.474 2476.83 407.282C2493.23 382.884 2517.12 363.407 2548.49 348.85C2579.86 334.088 2619.02 326.708 2665.97 326.708C2699.8 326.708 2730.14 330.706 2757 338.701C2783.85 346.492 2806.71 357.461 2825.58 371.608C2844.44 385.549 2858.79 401.951 2868.63 420.813C2878.68 439.47 2883.7 459.768 2883.7 481.705V805.232H2725.01V738.804H2721.32C2711.89 756.436 2700.41 770.686 2686.88 781.552C2673.55 792.418 2658.28 800.311 2641.06 805.232C2624.04 810.153 2605.28 812.613 2584.78 812.613ZM2640.13 705.591C2653.05 705.591 2665.15 702.925 2676.42 697.595C2687.9 692.264 2697.23 684.576 2704.41 674.53C2711.58 664.483 2715.17 652.285 2715.17 637.933V598.568C2710.66 600.414 2705.84 602.156 2700.72 603.797C2695.8 605.437 2690.47 606.974 2684.73 608.41C2679.19 609.845 2673.24 611.177 2666.89 612.408C2660.74 613.638 2654.28 614.765 2647.51 615.79C2634.39 617.841 2623.63 621.224 2615.22 625.939C2607.02 630.45 2600.87 636.088 2596.77 642.853C2592.88 649.414 2590.93 656.795 2590.93 664.996C2590.93 678.117 2595.54 688.164 2604.77 695.134C2613.99 702.105 2625.78 705.591 2640.13 705.591Z" fill="currentColor"/><defs><linearGradient id="paint0_linear_178_28" x1="345.709" y1="0" x2="345.709" y2="680.073" gradientUnits="userSpaceOnUse"><stop stop-color="#5CB3C7"/><stop offset="1" stop-color="#2D5761"/></linearGradient><linearGradient id="paint1_linear_178_28" x1="616.408" y1="989.397" x2="616.408" y2="309.324" gradientUnits="userSpaceOnUse"><stop stop-color="#5CB3C7"/><stop offset="1" stop-color="#2D5761"/></linearGradient></defs></svg>`;

const WELCOME_POINTS = [
  ['💰', 'Income and expenses', 'Record what comes in and what goes out, with a category and a note for each.'],
  ['📅', 'Bills and EMIs', 'Rent, school fees, subscriptions and instalments show up every month until you mark them paid.'],
  ['🏦', 'Savings', 'Set money aside for what matters, such as your children or an emergency, and set a target for each.'],
  ['🔮', 'Upcoming months', 'See the fixed expenses waiting in each coming month, with a total.'],
  ['🎯', 'Plans', 'List what you want to buy later and how much to save for it each month.'],
  ['🤝', 'Money owed', 'Keep track of money people owe you and money you owe.'],
  ['📊', 'Reports', 'Totals by day, month and year, and by category.']
];

function viewWelcome() {
  return `<div class="welcome">
    <div class="welcome-main">
      <h1 class="brand">${LOGO_SVG}</h1>
      <p class="tagline">Family Expense Tracker App</p>
      <p class="lead">A simple way to track your family’s money. Note your income and spending as it happens, and always know what is left for the month.</p>
      <button class="link welcome-more" data-act="welcome-points">What you can do <span aria-hidden="true">›</span></button>
      <div class="two">
        <label class="field"><span>Language</span><select data-lang>${langOptions()}</select></label>
        <label class="field"><span>Your currency</span><select data-setting="currency">${currencyOptions(state.settings.currency)}</select></label>
      </div>
      <button class="btn" data-act="open-account" data-id="signup">Create an account</button>
      <button class="btn ghost" data-act="open-account" data-id="signin">I already have an account</button>
      <p class="note">Your data is backed up online in your account and stays the same on every device you sign in on.</p>
    </div>
    <div class="welcome-foot">
      ${android ? `<p class="note">Version ${APP_VERSION}</p>` : ''}
    </div>
  </div>`;
}

function welcomePointsSheet() {
  openSheet('What you can do', `
    <div class="list points">${WELCOME_POINTS.map(([emoji, title, text]) => `<div class="row">
      <span class="emoji" aria-hidden="true">${emoji}</span>
      <span class="row-main"><span class="name">${title}</span><span class="point-text">${text}</span></span></div>`).join('')}</div>
    <button class="btn ghost" data-act="close-sheet" style="margin-top:14px">Close</button>`);
  centerSheet();
}

/* ---------- Home ---------- */

function homeListHtml() {
  const q = ui.search.trim().toLowerCase();
  const list = txInMonth(ui.month).filter((t) => (ui.filter === 'all' || t.type === ui.filter)
    && (!q || t.note.toLowerCase().includes(q) || ((cat(t.categoryId) || {}).name || '').toLowerCase().includes(q)));
  return txGroups(list, q || ui.filter !== 'all' ? 'Nothing matches.' : 'Nothing recorded for this month yet. Tap + to add income, an expense or savings.');
}

const BELL_ICON = '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg>';
function homeSwitch() {
  const n = unreadCount();
  return `<div class="home-top">${segButtons('home-mode', [['month', 'Month report'], ['year', 'Year report']], ui.home)}
    <button class="bell" data-act="notices" aria-label="Notifications${n ? `, ${n} new` : ''}">${BELL_ICON}${n ? `<i class="badge">${n}</i>` : ''}</button></div>`;
}

// The whole year at a glance: totals, then one line per month. Tapping a month opens it.
// A ring showing how much of the income has been spent. It is green when little is spent and turns red as it nears 100%.
function spendRing(income, expense) {
  if (!(income > 0) && !(expense > 0)) return '';
  const share = income > 0 ? expense / income : 1;
  const fill = Math.min(1, share);
  const pct = income > 0 ? `${Math.round(share * 100)}%` : '100%+';
  const C = 2 * Math.PI * 15.5;
  return `<div class="ring" role="img" aria-label="${income > 0 ? `${pct} of income spent` : 'Spending with no income recorded'}" style="--ring:hsl(${Math.round(130 * (1 - fill))} 68% 44%)">
    <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-track" cx="18" cy="18" r="15.5"/>
      <circle class="ring-arc" cx="18" cy="18" r="15.5" stroke-dasharray="${(fill * C).toFixed(2)} ${C.toFixed(2)}"/></svg>
    <div class="ring-text"><span class="ring-pct">${pct}</span><span>spent</span></div></div>`;
}

function viewHomeYear() {
  const year = ui.month.slice(0, 4);
  const list = state.transactions.filter((t) => t.date.startsWith(year));
  const t = totalsOf(list);
  const rows = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`).map((ym) => ({ ym, t: totalsOf(list.filter((x) => x.date.startsWith(ym))) }));
  const active = rows.filter((r) => r.t.income || r.t.expense || r.t.saving);
  const rate = t.income > 0 ? Math.round((t.saving / t.income) * 100) : 0;
  return `<header class="top sticky-top">
      ${homeSwitch()}
      <div class="month-nav">
        <button class="nav-btn" data-act="home-year" data-d="-1" aria-label="Previous year">‹</button>
        <div class="month-title">${year}</div>
        <button class="nav-btn" data-act="home-year" data-d="1" aria-label="Next year">›</button>
      </div>
      ${year === curYM().slice(0, 4) ? '' : '<button class="link center" data-act="month-now">Back to this year</button>'}
    </header>
    ${androidUpdateCard()}
    <section class="card">
      <div class="hero-row"><div class="hero-main">
      <div class="label">Left this year</div>
      <div class="hero-num ${t.balance < 0 ? 'neg' : ''}">${fmt(t.balance)}</div>
      <div class="sub">Income minus expenses and savings${active.length ? ` · about ${fmt(Math.round(t.expense / active.length))} spent a month` : ''}</div>
      </div>${spendRing(t.income, t.expense)}</div>
      <div class="kpis three" style="margin-top:14px">
        <div class="kpi"><div class="label">Income</div><div class="v">${fmt(t.income)}</div></div>
        <div class="kpi"><div class="label">Expenses</div><div class="v">${fmt(t.expense)}</div></div>
        <div class="kpi"><div class="label">Savings</div><div class="v">${fmt(t.saving)}</div>${rate ? `<div class="s">${rate}% of income</div>` : ''}</div>
      </div>
    </section>
    <section class="card">
      <div class="sec-head" style="margin-top:0"><h2>Month by month</h2></div>
      ${active.length ? `<table class="tbl"><thead><tr><th>Month</th><th>In</th><th>Out</th><th>Saved</th><th>Left</th></tr></thead><tbody>
        ${active.map((r) => `<tr data-act="home-month" data-id="${r.ym}"><td>${toDate(r.ym + '-01').toLocaleDateString(LOCALE(), { month: 'short' })}</td>
          <td>${fmtK(r.t.income)}</td><td>${fmtK(r.t.expense)}</td><td>${fmtK(r.t.saving)}</td><td class="${r.t.balance < 0 ? 'over' : ''}">${fmtK(r.t.balance)}</td></tr>`).join('')}
        <tr class="tbl-total"><td>Total</td><td>${fmtK(t.income)}</td><td>${fmtK(t.expense)}</td><td>${fmtK(t.saving)}</td><td class="${t.balance < 0 ? 'over' : ''}">${fmtK(t.balance)}</td></tr>
        </tbody></table><p class="note" style="margin:10px 0 0">Tap a month to open it.</p>`
        : '<div class="empty">Nothing recorded in this year.</div>'}
    </section>
    <button class="btn ghost" data-act="year-report">Charts and categories for ${year}</button>`;
}

function viewHome() {
  if (ui.home === 'year') return viewHomeYear();
  const ym = ui.month;
  const t = totalsOf(txInMonth(ym));
  const open = dueItems(ym).filter(isOpen);
  const openOut = sum(open.filter((it) => it.type !== 'income'), (it) => it.amount);
  const openIn = sum(open.filter((it) => it.type === 'income'), (it) => it.amount);
  const isNow = ym === curYM();
  // What last month left is part of what there is to spend this month.
  const carry = carryInto(ym);
  const before = addMonths(ym, -1);
  const left = r3(t.balance + carry);
  const decided = !!(state.leftover || {})[before];
  const after = r3(left - openOut);
  const daysLeft = daysInMonth(ym) - Number(today().slice(8, 10)) + 1;
  const recv = debtTotal('receivable');
  const pay = debtTotal('payable');

  // This month's bills and repeating items: each one is Unpaid until it is marked paid here.
  const due = dueItems(ym);
  const out = due.filter((it) => it.type !== 'income');
  const inc = due.filter((it) => it.type === 'income');
  const paidCount = out.filter((it) => it.paid).length;
  // Paid items leave this list: their payment is in the transactions below. Only what still needs attention stays on top.
  const outLeft = out.filter((it) => !it.paid);
  const incLeft = inc.filter((it) => !it.paid);
  const toPay = `${outLeft.length ? `<div class="sec-head"><h2>To pay</h2><span class="sub">${paidCount} of ${out.length} paid · ${fmt(openOut)} unpaid</span></div>
    <div class="list">${outLeft.map(dueRow).join('')}</div>` : out.length ? `<p class="note all-paid">✓ All ${plural(out.length, 'bill')} paid for this month</p>` : ''}
    ${outLeft.length ? `
    ${isNow && openOut ? `<p class="note" style="margin-top:8px">After paying them: <strong class="${after < 0 ? 'over' : ''}">${fmt(after)}</strong>${after > 0 ? ` · about ${fmt(Math.floor(after / daysLeft))} a day for ${plural(daysLeft, 'day')}` : ''}</p>` : ''}` : ''}
    ${incLeft.length ? `<div class="sec-head"><h2>Expected income</h2>${openIn ? `<span class="sub">${fmt(openIn)} expected</span>` : ''}</div><div class="list">${incLeft.map(dueRow).join('')}</div>` : ''}`;

  return `<header class="top sticky-top">
      ${homeSwitch()}
      ${monthNav(ym, 'month')}
      ${isNow ? '' : '<button class="link center" data-act="month-now">Back to this month</button>'}
    </header>
    ${androidUpdateCard()}
    <section class="card">
      <div class="hero-row"><div class="hero-main">
      <div class="label">Left this month</div>
      <div class="hero-num ${left < 0 ? 'neg' : ''}">${fmt(left)}</div>
      <div class="sub">${carry ? `Income minus expenses and savings, plus ${fmt(carry)} carried over from ${monthName(before)}` : 'Income minus expenses and savings'}</div>
      </div>${spendRing(t.income, t.expense)}</div>
      <div class="kpis three" style="margin-top:14px">
        <div class="kpi"><div class="label">Income</div><div class="v">${fmt(t.income)}</div>${carry ? `<div class="s">+ ${fmt(carry)} carried over</div>` : ''}</div>
        <div class="kpi"><div class="label">Expenses</div><div class="v">${fmt(t.expense)}</div></div>
        <div class="kpi"><div class="label">Savings</div><div class="v">${fmt(t.saving)}</div></div>
      </div>
      ${carry && decided && !isGuest() ? `<button class="link" style="margin-top:8px" data-act="leftover-open" data-id="${before}">Change what happens to the carried-over money</button>` : ''}
    </section>
    ${carry && !decided && !isGuest() ? `<button class="card tap" data-act="leftover-open" data-id="${before}">
      <div class="name" style="white-space:normal">${fmt(carry)} was left from ${monthName(before)}</div>
      <div class="sub">It is carried over to this month for now. Tap to choose what to do with it.</div></button>` : ''}
    ${isGuest() ? '' : toPay}
    ${!isGuest() && (recv || pay) ? `<button class="card tap" data-act="open-owed">
      <div class="kpis" style="margin:0;padding:0;border:0">
        <div class="kpi"><div class="label">Owed to me</div><div class="v">${fmt(recv)}</div></div>
        <div class="kpi"><div class="label">I owe</div><div class="v">${fmt(pay)}</div></div>
      </div></button>` : ''}
    <div class="sec-head"><h2>Transactions</h2></div>
    ${segButtons('filter', [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['saving', 'Savings']], ui.filter)}
    <input type="search" id="tx-search" placeholder="Search" value="${esc(ui.search)}" aria-label="Search this month’s transactions">
    <div id="tx-list">${homeListHtml()}</div>`;
}

/* ---------- Bills ---------- */

function dueRow(it) {
  const st = dueStatus(it);
  const c = cat(it.categoryId);
  const pill = { done: it.type === 'income' ? '✓ Received' : '✓ Paid', unpaid: '⚠ Unpaid', upcoming: 'Upcoming', expected: 'Expected', skipped: 'Skipped' }[st];
  const when = it.paid ? `${it.type === 'income' ? 'Received' : 'Paid'} ${fmtShort(it.paid.date)}` : st === 'skipped' ? (it.weekly ? 'Not this week' : 'Not this month') : `Due ${fmtShort(it.date)}`;
  return `<button class="row ${st === 'unpaid' ? 'is-unpaid' : ''}" data-act="due" data-key="${it.key}">
    <span class="emoji" aria-hidden="true">${esc((c && c.emoji) || '•')}</span>
    <span class="row-main">
      <span class="row-top"><span class="name">${esc(it.name)}</span><span class="amt">${fmt(it.paid ? it.paid.amount : it.amount)}</span></span>
      <span class="row-top"><span class="row-sub">${when}${it.kind === 'emi' ? ` · EMI ${it.seq} of ${it.ref.tenure}` : it.ref.frequency !== 'monthly' ? ` · ${it.ref.frequency}` : ''}</span><span class="pill ${st}">${pill}</span></span>
    </span></button>`;
}

function emiRow(e) {
  const st = emiStats(e);
  return `<button class="row" data-act="open-emi" data-id="${e.id}">
    <span class="row-main">
      <span class="row-top"><span class="name">${esc(e.name)}</span><span class="amt">${fmt(e.monthly)}<span class="of"> a month</span></span></span>
      <span class="meter"><span style="width:${(st.paidCount / e.tenure) * 100}%"></span></span>
      <span class="row-sub">${!st.open.length ? `✓ All ${e.tenure} instalments paid`
        : e.start > curYM() ? `Starts ${ymShort(e.start)} · ${plural(e.tenure, 'instalment')} · ends ${ymShort(st.end)}`
        : `${st.paidCount} of ${e.tenure} paid · ${fmt(st.left)} left · ${ymShort(e.start)} to ${ymShort(st.end)}`}</span>
    </span></button>`;
}

function recurLine(r) {
  const when = r.frequency === 'weekly' ? `every week on ${weekdayNameOf(r.weekday)}`
    : r.frequency === 'yearly' ? `every year on ${r.day} ${monthNameOf(r.month)}` : `every month on day ${r.day}`;
  const next = (r.changes || []).find((c) => c.from > curYM());
  return `${fmt(recAmount(r, curYM()))} · ${when}${next ? ` · ${fmt(next.amount)} from ${ymShort(next.from)}` : ''}${r.paused ? ' · paused' : ''}`;
}

function billsHead() {
  return segButtons('bills', [['month', 'Bills'], ['emi', 'EMI'], ['upcoming', 'Upcoming']], ui.bills);
}

function viewBills() {
  return ui.bills === 'emi' ? viewEmi() : ui.bills === 'upcoming' ? viewUpcoming() : viewBillsMonth();
}

// The Bills tab is where repeating items are set up. Paying them happens on Home, under "To pay".
function viewBillsMonth() {
  const yearly = state.recurring.filter((r) => r.frequency === 'yearly' && !r.paused && r.type !== 'income');
  const setAside = sum(yearly, (r) => recAmount(r, curYM()) / 12);

  return `<header class="top"><h1>Bills</h1></header>
    <div class="sticky-top">${billsHead()}</div>
    <div class="sec-head" style="margin-top:0"><h2>All your bills and repeating items</h2><button class="link" data-act="add-rec">+ Add</button></div>
    <div class="list">${state.recurring.length ? state.recurring.map((r) => `<button class="row" data-act="edit-rec" data-id="${r.id}">
        <span class="emoji" aria-hidden="true">${esc((cat(r.categoryId) || {}).emoji || '•')}</span>
        <span class="row-main"><span class="row-top"><span class="name">${esc(r.name)}</span><span class="pill">${TYPE_LABEL[r.type]}</span></span>
        <span class="row-sub">${recurLine(r)}</span></span></button>`).join('')
      : '<div class="empty">Nothing repeating yet. Add your rent, school fee, utility bills and subscriptions once. Each month they show on Home under “To pay” until you pay them.</div>'}</div>
    <button class="btn ghost" style="margin-top:12px" data-act="add-rec">+ Add a monthly bill</button>
    <p class="note" style="margin-top:10px">Set up what repeats here. You mark each month’s payment on Home, under “To pay”.</p>
    ${setAside ? `<p class="note" style="margin-top:10px">Your yearly items add up to ${fmt(sum(yearly, (r) => recAmount(r, curYM())))}. Setting aside about ${fmt(Math.ceil(setAside))} a month covers them.</p>` : ''}`;
}

function viewEmi() {
  const now = curYM();
  const stats = state.emis.map((e) => ({ e, st: emiStats(e) }));
  const running = stats.filter((x) => x.st.open.length);
  const finished = stats.filter((x) => !x.st.open.length);
  const thisMonth = sum(dueItems(now).filter((it) => it.kind === 'emi'), (it) => it.amount);
  const lastEnd = running.map((x) => x.st.end).sort().pop();
  return `<header class="top"><h1>Bills</h1></header>
    <div class="sticky-top">${billsHead()}</div>
    <section class="card">
      <div class="label">EMI still to pay</div>
      <div class="hero-num small">${fmt(sum(running, (x) => x.st.left))}</div>
      <div class="sub">${running.length ? `${fmt(thisMonth)} this month · ${plural(running.length, 'EMI')} running · all clear after ${ymShort(lastEnd)}` : 'No EMI running'}</div>
    </section>
    <div class="sec-head"><h2>Running</h2><button class="link" data-act="add-emi">+ Add EMI</button></div>
    <div class="list">${running.length ? running.map((x) => emiRow(x.e)).join('') : '<div class="empty">Add a phone, laptop, AC or loan paid in monthly instalments. Choose the tenure and it repeats in Bills every month until the last instalment.</div>'}</div>
    ${finished.length ? `<div class="sec-head"><h2>Finished</h2></div><div class="list">${finished.map((x) => emiRow(x.e)).join('')}</div>` : ''}`;
}

// Preset expenses for each coming month: repeating expenses, savings and EMI instalments.
function viewUpcoming() {
  const months = Array.from({ length: ui.horizon }, (_, i) => addMonths(curYM(), i + 1)).map((ym) => {
    const items = dueItems(ym).filter((it) => !it.skipped);
    const out = items.filter((it) => it.type !== 'income');
    return { ym, out, total: sum(out, (it) => (it.paid ? it.paid.amount : it.amount)), income: sum(items.filter((it) => it.type === 'income'), (it) => it.amount) };
  });
  const grand = sum(months, (m) => m.total);
  const peak = months.reduce((a, m) => (m.total > a.total ? m : a), months[0]);
  return `<header class="top"><h1>Bills</h1></header>
    <div class="sticky-top">${billsHead()}</div>
    <section class="card">
      <div class="label">Preset expenses, next ${ui.horizon} months</div>
      <div class="hero-num small">${fmt(grand)}</div>
      <div class="sub">${grand ? `About ${fmt(Math.round(grand / ui.horizon))} a month · highest in ${ymShort(peak.ym)} (${fmt(peak.total)})` : 'Nothing preset yet. Add repeating items and EMIs to see them here.'}</div>
    </section>
    ${segButtons('horizon', [['6', '6 months'], ['12', '12 months'], ['24', '24 months']], String(ui.horizon))}
    ${months.map((m) => `<div class="sec-head"><h2>${ymLabel(m.ym)}</h2><button class="link" data-act="goto-month" data-id="${m.ym}">Open</button></div>
      <div class="list">
        ${m.out.length ? m.out.map((it) => `<div class="row">
          <span class="emoji" aria-hidden="true">${esc((cat(it.categoryId) || {}).emoji || '•')}</span>
          <span class="row-main"><span class="row-top"><span class="name">${esc(it.name)}</span><span class="amt">${fmt(it.paid ? it.paid.amount : it.amount)}</span></span>
          <span class="row-sub">${it.paid ? '✓ Already paid' : `Due ${fmtShort(it.date)}`}${it.kind === 'emi' ? ` · EMI ${it.seq} of ${it.ref.tenure}` : it.type === 'saving' ? ' · savings' : it.ref.frequency !== 'monthly' ? ` · ${it.ref.frequency}` : ''}</span></span></div>`).join('')
          : '<div class="empty">Nothing preset for this month.</div>'}
        ${m.out.length ? `<div class="row total"><span class="row-main"><span class="row-top"><span class="name">Total · ${plural(m.out.length, 'item')}</span><span class="amt">${fmt(m.total)}</span></span>
          ${m.income ? `<span class="row-sub">Expected income ${fmt(m.income)} · ${fmt(m.income - m.total)} left after these</span>` : ''}</span></div>` : ''}
      </div>`).join('')}
    <section class="card" style="margin-top:20px"><div class="row-top"><span class="name">Total for ${ui.horizon} months</span><span class="amt">${fmt(grand)}</span></div></section>`;
}

/* ---------- Savings ---------- */

// How far a savings fund is from the target set for it.
function targetLine(v, target) {
  if (v >= target) return `🎯 Target of ${fmt(target)} reached`;
  return `${Math.floor((v / target) * 100)}% of the ${fmt(target)} target · ${fmt(r3(target - v))} to go`;
}

function viewSavings() {
  const all = state.transactions.filter((t) => t.type === 'saving');
  const year = ui.saveYear;
  const inYear = all.filter((t) => t.date.startsWith(year));
  // A fund whose plan was bought is spent: it is left out of what is saved now, but stays in the months it was saved in.
  const usedIds = new Set(catsOf('saving').filter((c) => c.used).map((c) => c.id));
  const kept = all.filter((t) => !usedIds.has(t.categoryId));
  const opening = sum(liveFunds(), (c) => c.opening || 0);
  const total = r3(sum(kept, (t) => t.amount) + opening);
  const yearTotal = sum(inYear, (t) => t.amount);
  const thisMonth = sum(all.filter((t) => t.date.startsWith(curYM())), (t) => t.amount);
  const monthsUsed = new Set(inYear.map((t) => t.date.slice(0, 7))).size;
  const yearIncome = sum(state.transactions.filter((t) => t.type === 'income' && t.date.startsWith(year)), (t) => t.amount);
  const rate = yearIncome > 0 ? Math.round((yearTotal / yearIncome) * 100) : 0;

  const byFund = {};
  for (const c of liveFunds()) if (c.opening > 0 || c.target > 0) byFund[c.id] = c.opening || 0;
  for (const t of kept) { const k = cat(t.categoryId) ? t.categoryId : ''; byFund[k] = r3((byFund[k] || 0) + t.amount); }
  const funds = Object.entries(byFund).map(([id, v]) => ({ id, c: cat(id), v })).sort((a, z) => z.v - a.v);
  const top = funds.length ? funds[0].v : 0;

  const buckets = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${pad(i + 1)}`;
    return { label: ymLabel(ym), value: sum(inYear.filter((t) => t.date.startsWith(ym)), (t) => t.amount) };
  });
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.value)));
  const sel = ui.bar != null && buckets[ui.bar] ? buckets[ui.bar] : null;

  return `<header class="top"><h1>Savings</h1></header>
    <section class="card">
      <div class="label">Saved in total</div>
      <div class="hero-num">${fmt(total)}</div>
      <div class="sub">${opening > 0 ? `Includes ${fmt(opening)} you already had` : 'Everything you have set aside so far'}</div>
      <div class="kpis three" style="margin-top:14px">
        <div class="kpi"><div class="label">This month</div><div class="v">${fmt(thisMonth)}</div></div>
        <div class="kpi"><div class="label">In ${year}</div><div class="v">${fmt(yearTotal)}</div>${rate ? `<div class="s">${rate}% of income</div>` : ''}</div>
        <div class="kpi"><div class="label">Monthly average</div><div class="v">${fmt(monthsUsed ? Math.round(yearTotal / monthsUsed) : 0)}</div></div>
      </div>
    </section>

    ${funds.length ? `<section class="card">
      <div class="sec-head" style="margin-top:0"><h2>By category</h2></div>
      <div class="rank">${funds.map(({ id, c, v }) => `<button class="rank-row" data-act="fund" data-id="${id}">
        <span class="row-top"><span class="name">${esc(catLabel(c))}</span><span class="amt">${fmt(v)}${total > 0 ? `<span class="share">${Math.round((v / total) * 100)}%</span>` : ''}</span></span>
        ${c && c.target > 0 ? `<span class="rank-track"><span class="rank-bar" style="width:${Math.min(100, (v / c.target) * 100)}%"></span></span>
        <span class="row-sub">${targetLine(v, c.target)}</span>`
          : `<span class="rank-bar" style="width:${top > 0 ? (v / top) * 100 : 0}%"></span>`}</button>`).join('')}</div>
    </section>` : ''}

    <div class="month-nav" style="margin-bottom:14px">
      <button class="nav-btn" data-act="save-year" data-d="-1" aria-label="Previous year">‹</button>
      <div class="month-title small">Savings in ${year}</div>
      <button class="nav-btn" data-act="save-year" data-d="1" aria-label="Next year">›</button>
    </div>
    <section class="card">
      <div class="sec-head" style="margin-top:0"><h2>Saved per month</h2></div>
      <div class="readout">${sel ? `<b>${fmt(sel.value)}</b> · ${esc(sel.label)}` : 'Tap a bar to see the amount.'}</div>
      <div class="chart" role="img" aria-label="Savings per month in ${year}">
        <div class="grid-line" style="top:0"><span>${fmt(max)}</span></div>
        <div class="grid-line" style="top:50%"><span>${fmt(max / 2)}</span></div>
        <div class="cols">${buckets.map((b, i) => `<button class="col ${ui.bar === i ? 'sel' : ''}" data-act="bar" data-id="${i}" aria-label="${esc(b.label)}: ${esc(fmt(b.value))}"><span style="height:${(b.value / max) * 100}%"></span></button>`).join('')}</div>
      </div>
      <div class="x-axis"><span>${monthNameOf(1).slice(0, 3)}</span><span>${monthNameOf(12).slice(0, 3)}</span></div>
    </section>
    <div class="sec-head"><h2>Entries in ${year}</h2></div>
    ${txGroups(inYear, `No savings recorded in ${year}.`)}`;
}

/* ---------- Reports ---------- */

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

// A report covers one day, one week (Sunday to Saturday), one month or one year.
function scopeOf(period, cursor) {
  let from, to, label;
  if (period === 'day') { from = to = cursor; label = fmtDayLong(cursor); }
  else if (period === 'week') { from = weekStartOf(cursor); to = addDays(from, 6); label = `${fmtShort(from)} – ${fmtShort(to)} ${to.slice(0, 4)}`; }
  else if (period === 'month') { from = cursor.slice(0, 7) + '-01'; to = dateIn(cursor.slice(0, 7), 31); label = ymLabel(cursor.slice(0, 7)); }
  else { from = cursor.slice(0, 4) + '-01-01'; to = cursor.slice(0, 4) + '-12-31'; label = cursor.slice(0, 4); }
  return { period, from, to, prefix: from.slice(0, { day: 10, week: 10, month: 7, year: 4 }[period]), label,
    list: state.transactions.filter((t) => t.date >= from && t.date <= to) };
}
const repScope = () => scopeOf(ui.rep.period, ui.rep.cursor);

function rankRows(list, measure, period) {
  const sums = {};
  for (const t of list) { const k = cat(t.categoryId) ? t.categoryId : ''; sums[k] = r3((sums[k] || 0) + t.amount); }
  const rows = Object.entries(sums).map(([id, v]) => ({ id, c: cat(id), v })).sort((a, z) => z.v - a.v);
  const total = sum(rows, (x) => x.v);
  const top = rows.length ? rows[0].v : 0;
  if (!rows.length) return `<div class="empty">No ${TYPE_PLURAL[measure].toLowerCase()} recorded in this period.</div>`;
  return `<div class="rank">${rows.map(({ id, c, v }) => {
    const budget = measure === 'expense' && c && c.budget > 0 ? c.budget * (period === 'year' ? 12 : 1) : 0;
    const limits = period === 'month' || period === 'year';
    const over = limits && budget > 0 && v > budget;
    return `<button class="rank-row" data-act="rep-cat" data-id="${id}">
      <span class="row-top"><span class="name">${esc(catLabel(c))}</span>
        <span class="amt">${fmt(v)}<span class="share">${Math.round((v / total) * 100)}%</span></span></span>
      <span class="rank-bar" style="width:${(v / top) * 100}%"></span>
      ${measure === 'income' && c ? `<span class="row-sub">${c.group === 'secondary' ? 'Secondary' : 'Primary'} income</span>` : ''}
      ${limits && budget > 0 ? `<span class="row-sub">${over ? `<span class="over">⚠ Over the ${fmt(budget)} limit by ${fmt(v - budget)}</span>` : `${fmt(budget - v)} left of the ${fmt(budget)} limit`}</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

// Every expense category with a bar showing how much of its monthly limit is used: green when little is spent,
// turning red as it fills. A category with no limit is listed too, so one can be set from here. Limits are per month,
// so a day or week report shows the month it falls in, and a year report compares the year with twelve times the limit.
function limitsSection(period, prefix, from) {
  const year = period === 'year';
  const scope = year ? prefix : period === 'month' ? prefix : from.slice(0, 7);
  const spent = {};
  for (const t of state.transactions) if (t.type === 'expense' && t.date.startsWith(scope)) spent[t.categoryId] = r3((spent[t.categoryId] || 0) + t.amount);
  const guest = isGuest();
  const rows = catsOf('expense').map((c) => ({ c, used: spent[c.id] || 0, limit: c.budget > 0 ? c.budget * (year ? 12 : 1) : 0 }))
    .filter((x) => x.limit > 0 || !guest)
    .sort((a, b) => (b.limit > 0) - (a.limit > 0) || (b.limit ? b.used / b.limit - a.used / a.limit : b.used - a.used));
  if (!rows.length) return '';
  const row = ({ c, used, limit }) => {
    const share = limit > 0 ? used / limit : 0;
    const fill = Math.min(1, share);
    const sub = !limit ? (guest ? 'No limit set' : 'No limit set. Tap to set one.')
      : used > limit ? `<span class="over">⚠ Over the limit by ${fmt(r3(used - limit))}</span>` : `${fmt(r3(limit - used))} left · ${Math.round(share * 100)}% used`;
    const inner = `<span class="emoji" aria-hidden="true">${esc(c.emoji || '•')}</span>
      <span class="row-main"><span class="row-top"><span class="name">${esc(c.name)}</span><span class="amt">${fmt(used)}${limit ? `<span class="of"> / ${fmt(limit)}</span>` : ''}</span></span>
      ${limit ? `<span class="meter" role="img" aria-label="${Math.round(share * 100)}% of the limit used"><span style="width:${fill * 100}%;background:hsl(${Math.round(130 * (1 - fill))} 68% 44%)"></span></span>` : ''}
      <span class="row-sub" style="white-space:normal">${sub}</span></span>`;
    return guest ? `<div class="row limit-row">${inner}</div>` : `<button class="row limit-row" data-act="edit-cat" data-id="${c.id}">${inner}</button>`;
  };
  return `<div class="sec-head"><h2>Spending limits</h2><span class="sub">${year ? prefix : monthName(scope)}</span></div>
    <div class="list">${rows.map(row).join('')}</div>`;
}

function viewReports() {
  const { period, prefix, from, to, label, list } = repScope();
  const measure = ui.rep.measure;
  const t = totalsOf(list);
  const mlist = list.filter((x) => x.type === measure);
  const rate = t.income > 0 ? Math.round((t.saving / t.income) * 100) : 0;
  // A month's report says what was carried over into it; that is part of what is left, not of the income earned.
  const carry = period === 'month' ? carryInto(prefix) : 0;
  const carried = carry ? `Carried over from ${monthName(addMonths(prefix, -1))}` : '';

  let buckets = [];
  if (period === 'week') {
    buckets = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => ({ key: d, label: fmtDay(d), value: 0 }));
  } else if (period === 'month') {
    buckets = Array.from({ length: daysInMonth(prefix) }, (_, i) => ({ key: `${prefix}-${pad(i + 1)}`, label: fmtDay(`${prefix}-${pad(i + 1)}`), value: 0 }));
  } else if (period === 'year') {
    buckets = Array.from({ length: 12 }, (_, i) => ({ key: `${prefix}-${pad(i + 1)}`, label: ymLabel(`${prefix}-${pad(i + 1)}`), value: 0 }));
  }
  for (const b of buckets) b.value = sum(mlist.filter((x) => x.date.startsWith(b.key)), (x) => x.amount);
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.value)));
  const sel = ui.bar != null && buckets[ui.bar] ? buckets[ui.bar] : null;

  let split = '';
  if (measure === 'income' && t.income > 0) {
    const sec = sum(mlist.filter((x) => (cat(x.categoryId) || {}).group === 'secondary'), (x) => x.amount);
    split = `<div class="kpis" style="margin:0 0 16px;padding:0 0 14px;border-top:0;border-bottom:1px solid var(--line)">
      <div class="kpi"><div class="label">Primary income</div><div class="v">${fmt(t.income - sec)}</div></div>
      <div class="kpi"><div class="label">Secondary income</div><div class="v">${fmt(sec)}</div></div></div>`;
  }

  let yearTable = '';
  if (period === 'year') {
    const rows = Array.from({ length: 12 }, (_, i) => `${prefix}-${pad(i + 1)}`).map((ym) => ({ ym, t: totalsOf(list.filter((x) => x.date.startsWith(ym))) }))
      .filter((r) => r.t.income || r.t.expense || r.t.saving);
    yearTable = `<section class="card"><div class="sec-head" style="margin-top:0"><h2>Month by month</h2></div>
      ${rows.length ? `<table class="tbl"><thead><tr><th>Month</th><th>In</th><th>Out</th><th>Saved</th><th>Left</th></tr></thead><tbody>
        ${rows.map((r) => `<tr data-act="rep-goto" data-id="${r.ym}-01"><td>${toDate(r.ym + '-01').toLocaleDateString(LOCALE(), { month: 'short' })}</td>
          <td>${fmtK(r.t.income)}</td><td>${fmtK(r.t.expense)}</td><td>${fmtK(r.t.saving)}</td><td class="${r.t.balance < 0 ? 'over' : ''}">${fmtK(r.t.balance)}</td></tr>`).join('')}
        </tbody></table><p class="note" style="margin:10px 0 0">Tap a month to open it.</p>` : '<div class="empty">Nothing recorded this year.</div>'}
    </section>`;
  }

  return `<header class="top"><h1>Reports</h1></header>
    <div class="sticky-top">${segButtons('rep-period', [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], period)}
    <div class="month-nav">
      <button class="nav-btn" data-act="rep-nav" data-d="-1" aria-label="Previous">‹</button>
      <div class="month-title small">${label}</div>
      <button class="nav-btn" data-act="rep-nav" data-d="1" aria-label="Next">›</button>
    </div></div>
    <section class="card">
      <div class="kpis" style="margin:0;padding:0;border:0">
        <div class="kpi"><div class="label">Income</div><div class="v">${fmt(t.income)}</div></div>
        <div class="kpi"><div class="label">Expenses</div><div class="v">${fmt(t.expense)}</div></div>
        <div class="kpi"><div class="label">Savings</div><div class="v">${fmt(t.saving)}</div>${rate ? `<div class="s">${rate}% of income</div>` : ''}</div>
        <div class="kpi"><div class="label">Left</div><div class="v ${t.balance + carry < 0 ? 'over' : ''}">${fmt(r3(t.balance + carry))}</div></div>
      </div>
      ${carry ? `<p class="note" style="margin:12px 0 0">Left includes ${fmt(carry)} carried over from ${monthName(addMonths(prefix, -1))}.</p>` : ''}
    </section>
    <div class="two" style="margin-bottom:14px">
      <button class="btn ghost" data-act="rep-share">Share report</button>
      <button class="btn ghost" data-act="rep-download">Download PDF</button>
    </div>
    ${segButtons('rep-measure', [['expense', 'Expenses'], ['income', 'Income'], ['saving', 'Savings']], measure)}
    ${buckets.length ? `<section class="card">
      <div class="sec-head" style="margin-top:0"><h2>${TYPE_PLURAL[measure]} per ${period === 'year' ? 'month' : 'day'}</h2></div>
      <div class="readout">${sel ? `<b>${fmt(sel.value)}</b> · ${esc(sel.label)}` : 'Tap a bar to see the amount.'}</div>
      <div class="chart" role="img" aria-label="${TYPE_PLURAL[measure]} over ${esc(label)}">
        <div class="grid-line" style="top:0"><span>${fmt(max)}</span></div>
        <div class="grid-line" style="top:50%"><span>${fmt(max / 2)}</span></div>
        <div class="cols">${buckets.map((b, i) => `<button class="col ${ui.bar === i ? 'sel' : ''}" data-act="bar" data-id="${i}" aria-label="${esc(b.label)}: ${esc(fmt(b.value))}"><span style="height:${(b.value / max) * 100}%"></span></button>`).join('')}</div>
      </div>
      <div class="x-axis"><span>${period === 'week' ? weekdayNameOf(toDate(from).getDay()) : period === 'month' ? '1' : monthNameOf(1).slice(0, 3)}</span><span>${period === 'week' ? weekdayNameOf(toDate(to).getDay()) : period === 'month' ? buckets.length : monthNameOf(12).slice(0, 3)}</span></div>
    </section>` : ''}
    <section class="card">
      <div class="sec-head" style="margin-top:0"><h2>${TYPE_PLURAL[measure]} by category</h2></div>
      ${measure === 'income' && carry ? `<div class="row-top" style="margin-bottom:14px"><span class="name">${carried}</span><span class="amt inc">+${fmt(carry)}</span></div>` : ''}
      ${split}${rankRows(mlist, measure, period)}
    </section>
    ${limitsSection(period, prefix, from)}
    ${yearTable}
    ${period === 'day' ? `<div class="sec-head"><h2>That day</h2></div>${txGroups(list, 'Nothing recorded on this day.')}` : ''}
    ${period === 'week' ? `<div class="sec-head"><h2>That week</h2></div>${txGroups(list, 'Nothing recorded in this week.')}` : ''}`;
}

/* ---------- Report as a PDF ---------- */

// The report is drawn as pictures of A4 pages and those are put into a PDF. Drawing lets the phone write Bangla and
// Hindi properly, which a PDF made of plain text could not do without carrying its own fonts.
const PDF_W = 1240, PDF_H = 1754, PDF_M = 90;
const PDF_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", "Noto Sans Devanagari", sans-serif';
const REPORT_TITLE = { day: 'Day report', week: 'Week report', month: 'Month report', year: 'Year report' };

function reportCanvases(scope) {
  const pages = [];
  const right = PDF_W - PDF_M, width = PDF_W - 2 * PDF_M;
  let ctx, y;
  const fit = (text, max) => {
    const chars = Array.from(String(text));
    if (ctx.measureText(chars.join('')).width <= max) return chars.join('');
    while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > max) chars.pop();
    return chars.join('') + '…';
  };
  const put = (text, x, at, { size = 26, weight = 400, color = '#16181a', align = 'left', max = width } = {}) => {
    ctx.font = `${weight} ${size}px ${PDF_FONT}`; ctx.fillStyle = color; ctx.textAlign = align;
    ctx.fillText(fit(text, max), x, at);
  };
  const box = (x, at, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, at, w, h); };
  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = PDF_W; c.height = PDF_H;
    ctx = c.getContext('2d');
    box(0, 0, PDF_W, PDF_H, '#ffffff');
    ctx.textBaseline = 'alphabetic';
    pages.push(c); y = PDF_M;
  };
  const need = (h) => { if (y + h > PDF_H - PDF_M - 40) newPage(); };
  const heading = (text) => { need(170); y += 34; put(text, PDF_M, y + 30, { size: 32, weight: 700 }); y += 48; box(PDF_M, y, width, 2, '#d5d9dc'); y += 16; };
  const grey = '#5b6166';
  const t = totalsOf(scope.list);

  newPage();
  put('FETA', PDF_M, y + 46, { size: 54, weight: 800, color: '#2f7183' });
  put(tr(REPORT_TITLE[scope.period]), right, y + 40, { size: 30, weight: 700, align: 'right', max: width - 260 });
  y += 84;
  put(scope.label, PDF_M, y + 36, { size: 38, weight: 700 });
  y += 60; box(PDF_M, y, width, 3, '#2f7183'); y += 30;

  const carry = scope.period === 'month' ? carryInto(scope.prefix) : 0;
  const kpis = [['Income', t.income], ['Expenses', t.expense], ['Savings', t.saving], ['Left', r3(t.balance + carry)]];
  const bw = (width - 60) / 4;
  kpis.forEach(([label, v], i) => {
    const x = PDF_M + i * (bw + 20);
    box(x, y, bw, 130, '#f1f4f5');
    put(tr(label), x + 18, y + 44, { size: 22, color: grey, max: bw - 36 });
    put(fmt(v), x + 18, y + 98, { size: 32, weight: 700, color: label === 'Left' && v < 0 ? '#b3261e' : '#16181a', max: bw - 36 });
  });
  y += 150;
  if (carry) { put(tr(`Left includes ${fmt(carry)} carried over from ${monthName(addMonths(scope.prefix, -1))}.`), PDF_M, y + 12, { size: 22, color: grey, max: width }); y += 44; }

  for (const type of ['expense', 'income', 'saving']) {
    const sums = {};
    for (const x of scope.list) if (x.type === type) { const k = cat(x.categoryId) ? x.categoryId : ''; sums[k] = r3((sums[k] || 0) + x.amount); }
    const rows = Object.entries(sums).map(([id, v]) => ({ c: cat(id), v })).sort((a, z) => z.v - a.v);
    if (!rows.length) continue;
    const total = sum(rows, (x) => x.v);
    heading(tr(`${TYPE_PLURAL[type]} by category`));
    for (const { c, v } of rows) {
      need(66);
      put(tr(catLabel(c)), PDF_M, y + 30, { max: width - 400 });
      put(`${Math.round((v / total) * 100)}%`, right - 270, y + 30, { size: 22, color: grey, align: 'right' });
      put(fmt(v), right, y + 30, { weight: 600, align: 'right', max: 250 });
      box(PDF_M, y + 44, width, 6, '#e6e9eb');
      box(PDF_M, y + 44, Math.max(4, width * (v / rows[0].v)), 6, '#2f7183');
      y += 66;
    }
  }

  if (scope.period === 'year') {
    const year = scope.from.slice(0, 4);
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`).map((ym) => ({ ym, t: totalsOf(scope.list.filter((x) => x.date.startsWith(ym))) }))
      .filter((m) => m.t.income || m.t.expense || m.t.saving);
    if (months.length) {
      heading(tr('Month by month'));
      const col = (i) => PDF_M + width * (0.28 + 0.18 * (i + 1));
      const row = (cells, opt) => { need(52); put(cells[0], PDF_M, y + 30, { ...opt, max: width * 0.26 }); cells.slice(1).forEach((v, i) => put(v, col(i), y + 30, { ...opt, align: 'right', max: width * 0.17 })); y += 52; };
      row(['Month', 'In', 'Out', 'Saved', 'Left'].map((w) => tr(w)), { size: 22, color: grey });
      for (const m of months) row([monthNameOf(Number(m.ym.slice(5, 7))), fmt(m.t.income), fmt(m.t.expense), fmt(m.t.saving), fmt(m.t.balance)], { size: 24 });
    }
  } else {
    heading(tr('Transactions'));
    const list = scope.list.slice().sort((a, z) => (a.date < z.date ? -1 : a.date > z.date ? 1 : (a.created || 0) - (z.created || 0)));
    if (!list.length) { need(60); put(tr('Nothing recorded in this period.'), PDF_M, y + 30, { color: grey }); y += 60; }
    for (const x of list) {
      need(58);
      const c = cat(x.categoryId);
      put(fmtShort(x.date), PDF_M, y + 30, { size: 22, color: grey, max: 140 });
      put(x.note || tr(catLabel(c)), PDF_M + 160, y + 30, { size: 24, max: width - 160 - 470 });
      put(tr(x.note && c ? c.name : TYPE_LABEL[x.type]), right - 250, y + 30, { size: 20, color: grey, align: 'right', max: 200 });
      put(`${x.type === 'income' ? '+' : '−'} ${fmt(x.amount)}`, right, y + 30, { size: 24, weight: 600, align: 'right', max: 240, color: x.type === 'income' ? '#1b6e3c' : '#16181a' });
      box(PDF_M, y + 46, width, 1, '#eceef0');
      y += 58;
    }
  }

  pages.forEach((c, i) => {
    ctx = c.getContext('2d');
    put(`FETA · ${fmtDayLong(today())}`, PDF_M, PDF_H - 60, { size: 20, color: '#8a9096', max: width - 160 });
    put(`${i + 1} / ${pages.length}`, right, PDF_H - 60, { size: 20, color: '#8a9096', align: 'right' });
  });
  return pages;
}

// Puts the page pictures into a PDF file, one A4 page each.
function pdfFromCanvases(canvases) {
  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let pos = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const images = canvases.map((c) => {
    const bin = atob(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, w: c.width, h: c.height };
  });
  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${images.length} >>`));
  images.forEach((im, i) => {
    const p = 3 + i * 3;
    const draw = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    obj(p + 1, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    obj(p + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
      push(im.bytes); push('\nendstream');
    });
  });
  const count = 2 + images.length * 3;
  const xref = pos;
  push(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos);
  let at = 0;
  for (const b of parts) { out.set(b, at); at += b.length; }
  return out;
}

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function saveBlob(file, filename) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Makes the PDF of the report on screen and either hands it to the phone's share list (WhatsApp, Messenger, Telegram,
// email and so on) or saves it on the device. Everything up to the share runs in one go, as phones require for sharing.
function sendReport(mode) {
  const scope = repScope();
  let bytes;
  try { bytes = pdfFromCanvases(reportCanvases(scope)); } catch (e) { return toast('Could not make the PDF.'); }
  const name = `FETA-${scope.period}-report-${scope.from}${scope.to !== scope.from ? '_' + scope.to : ''}.pdf`;
  const app = window.FetaAndroid;
  if (app) {
    // Inside the Android app the page cannot share or save files itself, so the app does it.
    if (!app.shareFile || !app.saveFileBase64) return toast('Update the FETA Android app to share or download reports.');
    let ok = false;
    try { ok = mode === 'share' ? app.shareFile(name, 'application/pdf', toBase64(bytes)) : app.saveFileBase64(name, 'application/pdf', toBase64(bytes)); } catch (e) { /* told below */ }
    if (!ok) toast(mode === 'share' ? 'Could not share the report.' : 'Could not save the file.');
    return;
  }
  const file = new File([bytes], name, { type: 'application/pdf' });
  if (mode === 'share') {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: `FETA · ${scope.label}` }).catch((e) => { if (!e || e.name !== 'AbortError') saveBlob(file, name); });
      return;
    }
    toast('This browser cannot share files, so the PDF was downloaded instead.', 5000);
  }
  saveBlob(file, name);
}

/* ---------- Planner: plans, receivable, payable ---------- */

function planRow(p) {
  const day = planDate(p);
  const months = p.target ? monthsBetween(curYM(), p.target) : null;
  const fund = planFund(p);
  const saved = fund && !fund.used ? savedIn(fund) : 0;
  const toGo = Math.max(0, r3(p.price - saved));
  let sub = p.done ? '✓ Done' : day ? `By ${fmtShort(day)}${day.slice(0, 4) === today().slice(0, 4) ? '' : ` ${day.slice(0, 4)}`}` : 'No date set';
  if (!p.done && months != null && months > 0 && toGo > 0) sub += ` · save ${fmt(Math.ceil(toGo / months))} a month`;
  const pill = duePill(day, !p.done) || (p.done ? '' : `<span class="pill">${p.priority[0].toUpperCase() + p.priority.slice(1)}</span>`);
  // How much of the cost is already saved.
  const bar = !p.done && p.price > 0 ? `<span class="meter" role="img" aria-label="${Math.round(Math.min(1, saved / p.price) * 100)}% saved"><span style="width:${Math.min(1, saved / p.price) * 100}%"></span></span>
    <span class="row-sub">${saved >= p.price ? `🎯 ${fmt(saved)} saved, enough to buy it` : `${fmt(saved)} saved of ${fmt(p.price)}`}</span>` : '';
  return `<button class="row ${!p.done && day && day < today() ? 'is-unpaid' : ''}" data-act="edit-plan" data-id="${p.id}">
    <span class="row-main"><span class="row-top"><span class="name">${esc(p.name)}</span><span class="amt">${fmt(p.price)}</span></span>
    ${bar}
    <span class="row-top"><span class="row-sub">${sub}${p.note ? ' · ' + esc(p.note) : ''}</span>${pill}</span>
    </span></button>`;
}

function debtRow(d) {
  const left = debtLeft(d);
  const sub = d.settled ? '✓ Settled' : `${fmt(left)} left${d.due ? ` · due ${fmtShort(d.due)}` : ''}`;
  return `<button class="row" data-act="open-debt" data-id="${d.id}">
    <span class="row-main"><span class="row-top"><span class="name">${esc(d.person)}</span><span class="amt">${fmt(d.settled ? d.amount : left)}${!d.settled && left !== d.amount ? `<span class="of"> / ${fmt(d.amount)}</span>` : ''}</span></span>
    <span class="row-top"><span class="row-sub">${sub}${d.note ? ' · ' + esc(d.note) : ''}</span>${duePill(d.due, !d.settled && left > 0)}</span>
    </span></button>`;
}

function viewPlanner() {
  const tab = ui.planner;
  // Each list shows how many of its items are due.
  const due = plannerDue();
  let body;
  if (tab === 'plans') {
    const order = { high: 0, medium: 1, low: 2 };
    const open = state.plans.filter((p) => !p.done).sort((a, b) => order[a.priority] - order[b.priority] || (a.target || '9999') .localeCompare(b.target || '9999'));
    const done = state.plans.filter((p) => p.done);
    body = `<section class="card"><div class="label">Planned spending</div><div class="hero-num small">${fmt(sum(open, (p) => p.price))}</div>
        <div class="sub">${plural(open.length, 'plan')} waiting</div></section>
      <div class="sec-head"><h2>Plans</h2><button class="link" data-act="add-plan">+ Add plan</button></div>
      <div class="list">${open.length ? open.map(planRow).join('') : '<div class="empty">Things you want to buy or do later, such as a phone next year or a family trip.</div>'}</div>
      ${done.length ? `<div class="sec-head"><h2>Done</h2></div><div class="list">${done.map(planRow).join('')}</div>` : ''}`;
  } else {
    const list = state.debts.filter((d) => d.kind === tab);
    const open = list.filter((d) => !d.settled);
    const closed = list.filter((d) => d.settled);
    const recv = tab === 'receivable';
    body = `<section class="card"><div class="label">${recv ? 'People owe you' : 'You owe'}</div><div class="hero-num small">${fmt(debtTotal(tab))}</div>
        <div class="sub">${plural(open.length, 'open item')}</div></section>
      <div class="sec-head"><h2>${recv ? 'Owed to me' : 'I owe'}</h2><button class="link" data-act="add-debt">+ Add</button></div>
      <div class="list">${open.length ? open.map(debtRow).join('') : `<div class="empty">${recv ? 'Money someone owes you, such as a loan to a friend or unpaid salary.' : 'Money you owe, such as a loan from family or a credit card balance.'}</div>`}</div>
      ${closed.length ? `<div class="sec-head"><h2>Settled</h2></div><div class="list">${closed.map(debtRow).join('')}</div>` : ''}`;
  }
  return `<header class="top"><h1>Planner</h1></header>
    <div class="sticky-top">${segButtons('planner', [['plans', 'Plans'], ['receivable', 'Owed to me'], ['payable', 'I owe']].map(([id, label]) => [id, `${label}${due[id].length ? `<i class="seg-count">${due[id].length}</i>` : ''}`]), tab)}</div>
    ${body}`;
}

/* ---------- Setup: account, categories, settings, data ---------- */

// The lists under Setup. Each one is a row on the Setup screen and opens on a page of its own.
const SETUP_LISTS = [
  ['profile', 'Profile', '👤', '', ''],
  ['income-primary', 'Primary income sources', '💼', 'income', 'primary'],
  ['income-secondary', 'Secondary income sources', '💵', 'income', 'secondary'],
  ['expense', 'Expense categories', '🛒', 'expense', ''],
  ['saving', 'Savings categories', '🏦', 'saving', ''],
  ['notify', 'Notifications', '🔔', '', '']
];
const setupCats = (type, group) => catsOf(type).filter((c) => !group || c.group === group);

// One list from Setup on its own page, with a Back button at the top left.
function viewSetupList([id, title, , type, group]) {
  const head = (extra) => `<header class="top sub-top"><button class="x" data-act="setup-back" aria-label="Back">‹</button><h1>${title}</h1>${extra}</header>`;
  if (id === 'profile') return head('') + profileBody();
  if (id === 'notify') return head('') + notifyCard(false);
  const list = setupCats(type, group);
  return `${head(`<button class="link" data-act="add-cat" data-type="${type}" data-group="${group}">+ Add</button>`)}
    <div class="list">${list.length ? list.map((c) => `<button class="row" data-act="edit-cat" data-id="${c.id}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji || '•')}</span>
      <span class="row-main"><span class="row-top"><span class="name">${esc(c.name)}</span>${c.budget ? `<span class="row-sub">limit ${fmt(c.budget)}/month</span>` : c.opening || c.target ? `<span class="row-sub">${[c.opening ? `already had ${fmt(c.opening)}` : '', c.target ? `target ${fmt(c.target)}` : ''].filter(Boolean).join(' · ')}</span>` : ''}</span></span></button>`).join('')
      : '<div class="empty">None yet.</div>'}</div>`;
}

function viewMore() {
  // A guest's Setup holds their own profile, the language and the app version. The rest is the owner's.
  const guest = isGuest();
  const mine = SETUP_LISTS.filter((x) => !guest || x[0] === 'profile');
  const open = mine.find((x) => x[0] === ui.setup);
  if (open) return viewSetupList(open);
  const th = state.settings.theme;
  const invites = sync.session ? share.invites.length : 0;
  const lists = `<div class="list" style="margin-top:16px">${mine.map(([id, title, emoji, type, group]) => `<button class="row go" data-act="setup-open" data-id="${id}">
      <span class="emoji" aria-hidden="true">${emoji}</span>
      <span class="row-main"><span class="row-top"><span class="name" style="white-space:normal">${title}</span>${type ? `<span class="row-sub">${setupCats(type, group).length}</span>` : ''}${id === 'profile' && invites ? `<span class="pill unpaid">${invites} new</span>` : ''}</span></span>
      <span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>`;
  const account = sync.session
    ? `<section class="card">
        <div class="label">Signed in as</div>
        <div class="name" style="margin:2px 0 6px;white-space:normal;overflow-wrap:anywhere">${esc(sync.session.user.email)}</div>
        <p class="note" style="margin:0 0 14px">${esc(syncStatus())}</p>
        <button class="btn ghost" data-act="sync-now">Sync now</button>
        <button class="btn ghost" data-act="sign-out">Sign out</button>
      </section>`
    : `<section class="card">
        <p class="note" style="margin:0 0 14px">Create an account to back up your data online and use it on more than one device. Right now it is stored only on this device.</p>
        <button class="btn" data-act="open-account" data-id="signup">Create an account</button>
        <button class="btn ghost" data-act="open-account" data-id="signin">Sign in</button>
      </section>`;
  return `<header class="top"><h1>Setup</h1></header>
    <div class="sec-head" style="margin-top:0"><h2>Account</h2></div>
    ${account}
    ${lists}
    ${guest ? '' : locationCard()}
    <div class="sec-head"><h2>Settings</h2></div>
    <section class="card">
      <label class="field"><span>Language</span><select data-lang>${langOptions()}</select></label>
      ${guest ? '' : `<label class="field"><span>Currency</span><select data-setting="currency">${currencyOptions(state.settings.currency)}</select></label>
      <label class="field" style="margin-bottom:0"><span>Appearance</span><select data-setting="theme">
        ${[['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${th === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>`}
    </section>
    ${guest ? '' : `<div class="sec-head"><h2>Your data</h2></div>
    <section class="card">
      <p class="note" style="margin:0 0 14px">${sync.session ? 'Your data is saved to your account. A backup file is an extra copy you keep yourself.' : 'Everything lives only on this device. Save a backup now and then, because clearing Safari website data or deleting the app icon removes it.'}</p>
      <button class="btn" data-act="backup">Save a backup file</button>
      <label class="btn ghost" style="text-align:center;margin-top:10px">Restore from a backup<input type="file" id="restore-file" accept="application/json,.json" class="hidden"></label>
      <button class="btn ghost" data-act="export-csv">Export transactions (CSV)</button>
    </section>`}
    ${window.FetaAndroid ? '' : `<div class="sec-head"><h2>Put it on your home screen</h2></div>
    <section class="card"><p class="note" style="margin:0">In Safari, tap the Share button, then “Add to Home Screen”. The app then opens full screen and works without internet.</p></section>`}
    ${android ? `<div class="sec-head"><h2>App version</h2></div>
    ${androidUpdateCard()}
    <section class="card">
      <p class="note" style="margin:0 0 14px">${versionNote()}</p>
      <button class="btn ghost" data-act="update-app">Update the app</button>
    </section>` : ''}
    <div class="brand-foot">${LOGO_SVG}<p class="note">${android ? `Family Expense Tracker App · version ${APP_VERSION} · ${plural(state.transactions.length, 'transaction')}` : 'Family Expense Tracker App'}</p></div>`;
}

/* ---------- Sheets ---------- */

const NOTE_LABEL = { expense: 'What was it for?', income: 'Where did it come from?', saving: 'Note (optional)' };
const NOTE_HINT = { expense: 'House rent, school fee…', income: 'Client name, who gave it…', saving: '' };

// A month chooser made of two plain lists (month and year), which works the same on every phone.
function monthPicker(label, name, value, optional) {
  const [y, m] = isYM(value) ? value.split('-').map(Number) : [Number(curYM().slice(0, 4)), 0];
  const thisYear = Number(curYM().slice(0, 4));
  const years = [];
  for (let i = thisYear - 5; i <= thisYear + 15; i++) years.push(i);
  if (!years.includes(y)) { years.push(y); years.sort((a, b) => a - b); }
  return `<div class="field"><span>${label}</span><div class="two">
    <select name="${name}M" aria-label="${label}: month">${optional ? `<option value="" ${m ? '' : 'selected'}>No date</option>` : ''}
      ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${monthNameOf(i + 1)}</option>`).join('')}</select>
    <select name="${name}Y" aria-label="${label}: year">${years.map((v) => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>
  </div></div>`;
}
const pickedMonth = (f, name) => (f[name + 'M'] && f[name + 'Y'] ? `${f[name + 'Y']}-${pad(Number(f[name + 'M']))}` : '');

function typeRadios(current, types = TYPES) {
  return `<div class="seg" role="radiogroup" aria-label="Type" style="--n:${types.length};grid-template-columns:repeat(${types.length},1fr)">
    <i class="seg-pill" aria-hidden="true"></i>${types.map((v) => `<label><input type="radio" name="type" value="${v}" ${v === current ? 'checked' : ''}><span>${TYPE_LABEL[v]}</span></label>`).join('')}</div>`;
}

const NEW_CAT = '__new';
const NEW_CAT_OPTION = `<option value="${NEW_CAT}">＋ New category…</option>`;
const CAT_ICONS = ['🏦', '🧸', '🛟', '🎓', '🏠', '🚗', '✈️', '💍', '🕋', '🩺', '🎁', '📱', '💻', '🛒', '💡', '🍽️', '🚌', '👕', '💊', '🐾', '🎨', '🏋️', '💼', '📦'];

function txSheet(tx, preset = {}) {
  // A guest only gets the form for a new expense, or for an expense they added themselves. Anything else is shown, not edited.
  const guest = isGuest();
  if (guest && !(guestCanAdd() && (!tx || tx.by === myId()))) { if (tx) txViewSheet(tx); return; }
  const v = tx || preset;
  const type = guest ? 'expense' : v.type || 'expense';
  const linked = !!(v.recurringId || v.emiId);
  const fixedType = guest || linked || (!tx && !!preset.lockType);
  const date = tx ? tx.date : preset.date || (ui.month === curYM() || ui.tab !== 'home' ? today() : ui.month + '-01');
  const bill = !guest && v.recurringId ? state.recurring.find((r) => r.id === v.recurringId) : null;
  const hidden = ['recurringId', 'emiId', 'planId', 'period'].map((k) => `<input type="hidden" name="${k}" value="${esc(v[k] || '')}">`).join('');
  openSheet(preset.title || (tx ? 'Edit' : preset.lockType ? ADD_TITLE[type] : 'Add'), `
    <form data-form="tx" novalidate>
      <input type="hidden" name="id" value="${tx ? tx.id : ''}">${hidden}
      ${fixedType ? `<input type="hidden" name="type" value="${type}">` : typeRadios(type)}
      <label class="field"><span>Amount</span>
        <input class="amount-input" type="text" inputmode="decimal" name="amount" placeholder="0" autocomplete="off" value="${v.amount || ''}" ${tx || v.amount ? '' : 'data-autofocus'}></label>
      <label class="field"><span data-note-label>${NOTE_LABEL[type]}</span>
        <input type="text" name="note" maxlength="120" autocomplete="off" placeholder="${NOTE_HINT[type]}" value="${esc(v.note || '')}"></label>
      <div class="two">
        <label class="field"><span>Category</span><select name="categoryId">${catOptions(type, v.categoryId)}${guest ? '' : NEW_CAT_OPTION}</select></label>
        <label class="field"><span>Date</span><input type="date" name="date" value="${date}"></label>
      </div>
      <div class="newcat hidden" data-newcat>
        <label class="field"><span>New category name</span><input type="text" name="newCatName" maxlength="40" autocomplete="off"></label>
        <div class="field"><span>Icon</span><div class="emoji-pick" role="radiogroup" aria-label="Icon">${CAT_ICONS.map((e) =>
          `<label><input type="radio" name="newCatEmoji" value="${e}"><span>${e}</span></label>`).join('')}</div></div>
      </div>
      ${!tx && preset.hint ? `<p class="note">${esc(preset.hint)}</p>` : ''}
      <button class="btn">${tx ? 'Save changes' : preset.cta || 'Add'}</button>
      ${!tx && preset.canSkip ? `<button type="button" class="btn ghost" data-act="skip-due" data-id="${v.recurringId}" data-period="${v.period}">${isDate(v.period) ? 'Skip this week' : 'Skip this month'}</button>` : ''}
      ${tx && !guest && !linked && tx.type !== 'income' ? `<button type="button" class="btn ghost" data-act="tx-to-bill" data-id="${tx.id}">Make this a monthly bill</button>` : ''}
      ${tx ? `<button type="button" class="btn danger" data-act="del-tx" data-id="${tx.id}">Delete</button>` : ''}
      ${bill ? billBlock(bill) : ''}
    </form>${commentsBlock(tx)}`);
}

// Asks what to do with the money a month ended with. Until this is answered, it is carried over to the next month.
function leftoverSheet(ym) {
  const next = addMonths(ym, 1);
  const amount = carryInto(next);
  if (isGuest() || !(amount > 0)) return closeSheet();
  const funds = liveFunds();
  openSheet(`Left from ${monthName(ym)}`, `
    <p>${ymLabel(ym)} ended with ${fmt(amount)} left. What do you want to do with it?</p>
    <button class="btn" data-act="leftover-do" data-id="${ym}" data-how="carry">Carry it over to ${monthName(next)}</button>
    <button class="btn ghost" data-act="leftover-do" data-id="${ym}" data-how="expense">Count it as an “Others” expense</button>
    ${funds.length ? `<div class="field" style="margin:16px 0 0"><span>Or put it in a savings fund</span><select name="leftoverFund">${funds.map((c) => `<option value="${c.id}">${esc(catLabel(c))}</option>`).join('')}</select></div>
    <button class="btn ghost" data-act="leftover-do" data-id="${ym}" data-how="saving">Add it to savings</button>` : ''}
    <p class="note" style="margin:14px 0 0">An expense or savings entry is dated the last day of ${monthName(ym)}, so that month ends at zero.</p>`);
}

// The category that takes over what was in a deleted one: "Other", "Others", "Other income"... of the same kind.
const isOthers = (c) => /^others?( income| savings)?$/i.test(String(c.name).trim());

// Categories are added, changed and deleted under Setup. Elsewhere this form opens without the Delete button.
function catSheet(c, type, group) {
  const kind = c ? c.type : type;
  const title = { expense: 'expense category', income: 'income source', saving: 'savings category' }[kind];
  openSheet(c ? `Edit ${title}` : `New ${title}`, `
    <form data-form="cat" novalidate>
      <input type="hidden" name="id" value="${c ? c.id : ''}"><input type="hidden" name="type" value="${kind}">
      <div class="two" style="grid-template-columns:1fr 84px">
        <label class="field"><span>Name</span><input type="text" name="name" maxlength="40" autocomplete="off" value="${esc(c ? c.name : '')}" ${c ? '' : 'data-autofocus'}></label>
        <label class="field"><span>Emoji</span><input type="text" name="emoji" maxlength="8" autocomplete="off" value="${esc(c ? c.emoji : '')}" style="text-align:center"></label>
      </div>
      ${kind === 'income' ? `<label class="field"><span>Kind of income</span><select name="group">
        <option value="primary" ${(c ? c.group : group) !== 'secondary' ? 'selected' : ''}>Primary (salary, business, rent)</option>
        <option value="secondary" ${(c ? c.group : group) === 'secondary' ? 'selected' : ''}>Secondary (side hustle, bonus, gifts)</option></select></label>` : ''}
      ${kind === 'expense' ? `<label class="field"><span>Monthly limit (optional)</span>
        <input type="text" inputmode="decimal" name="budget" placeholder="No limit" autocomplete="off" value="${c && c.budget ? c.budget : ''}"></label>` : ''}
      ${kind === 'saving' && !c ? `<label class="field"><span>Amount already saved (optional)</span>
        <input type="text" inputmode="decimal" name="opening" placeholder="0" autocomplete="off"></label>
        <p class="note" style="margin:-4px 0 14px">Money you had saved before you started using the app. It counts in your total, not in any month.</p>` : ''}
      ${kind === 'saving' ? `<label class="field"><span>Target amount (optional)</span>
        <input type="text" inputmode="decimal" name="target" placeholder="No target" autocomplete="off" value="${c && c.target ? c.target : ''}"></label>` : ''}
      <button class="btn">${c ? 'Save changes' : 'Add'}</button>
      ${!c || ui.tab !== 'more' ? '' : isOthers(c) ? '<p class="note" style="margin:14px 0 0">What was in a deleted category is kept here, so this one cannot be deleted.</p>'
        : `<button type="button" class="btn danger" data-act="del-cat" data-id="${c.id}">Delete</button>`}
    </form>`);
}

const recChangeButtons = (r) => `<button type="button" class="btn ghost" data-act="rec-change" data-id="${r.id}" data-dir="up">▲ Increase</button>
        <button type="button" class="btn ghost" data-act="rec-change" data-id="${r.id}" data-dir="down">▼ Decrease</button>`;

// When a bill's amount went up or down, oldest first. Empty when it never changed.
function recHistoryHtml(r, removable) {
  const changes = r.changes || [];
  if (!changes.length) return '';
  return `<div class="field"><span>Amount history</span><div class="list">
    <div class="row"><span class="row-main"><span class="row-top"><span class="name">Started at ${fmt(r.amount)}</span></span>
      <span class="row-sub">From ${ymLabel(r.start)}</span></span></div>
    ${changes.map((c, i) => {
      const diff = r3(c.amount - (i ? changes[i - 1].amount : r.amount));
      return `<div class="row"><span class="row-main">
      <span class="row-top"><span class="name">${diff >= 0 ? '▲ Increased' : '▼ Decreased'} by ${fmt(Math.abs(diff))} to ${fmt(c.amount)}</span>
      ${removable ? `<button type="button" class="link" data-act="del-rec-change" data-id="${r.id}" data-from="${c.from}">Remove</button>` : ''}</span>
      <span class="row-sub">From ${ymLabel(c.from)}</span></span></div>`;
    }).join('')}</div></div>`;
}

// Shown when a bill is opened from the Bills list: what it costs now, buttons to raise or lower it, and its history.
function billBlock(r) {
  const per = PER[r.frequency];
  const next = (r.changes || []).find((c) => c.from > curYM());
  return `<div class="bill-block">
    <div class="sec-head"><h2>Bill amount</h2><button type="button" class="link" data-act="edit-rec" data-id="${r.id}">Edit bill</button></div>
    <p class="note" style="margin:0 0 12px">${fmt(recAmount(r, curYM()))} ${per} now${next ? `, ${fmt(next.amount)} from ${ymLabel(next.from)}` : ''}. Increase or decrease it for the months not paid yet.</p>
    <div class="two" style="margin-bottom:14px">${recChangeButtons(r)}</div>
    ${recHistoryHtml(r, false)}
  </div>`;
}

function recSheet(r) {
  const type = r ? r.type : 'expense';
  const freq = r ? r.frequency : 'monthly';
  const changes = (r && r.changes) || [];
  openSheet(r ? 'Edit bill or repeating item' : 'New monthly bill', `
    <form data-form="rec" novalidate>
      <input type="hidden" name="id" value="${r ? r.id : ''}">
      ${typeRadios(type)}
      <label class="field"><span>Name</span><input type="text" name="name" maxlength="60" autocomplete="off" placeholder="House rent, school fee, salary…" value="${esc(r ? r.name : '')}" ${r ? '' : 'data-autofocus'}></label>
      <div class="two">
        <label class="field"><span>${changes.length ? 'Starting amount' : 'Amount'}</span><input type="text" inputmode="decimal" name="amount" placeholder="0" autocomplete="off" value="${r ? r.amount : ''}"></label>
        <label class="field"><span>Category</span><select name="categoryId">${catOptions(type, r && r.categoryId)}</select></label>
      </div>
      ${r ? recHistoryHtml(r, true) : ''}
      ${r ? `<div class="two" style="margin-bottom:14px">
        ${recChangeButtons(r)}</div>` : ''}
      <div class="two">
        <label class="field"><span>Repeats</span><select name="frequency">
          <option value="weekly" ${freq === 'weekly' ? 'selected' : ''}>Every week</option>
          <option value="monthly" ${freq === 'monthly' ? 'selected' : ''}>Every month</option>
          <option value="yearly" ${freq === 'yearly' ? 'selected' : ''}>Every year</option></select></label>
        <label class="field ${freq === 'weekly' ? 'hidden' : ''}" data-day-wrap><span>Day of the month</span><input type="text" inputmode="numeric" name="day" autocomplete="off" value="${r ? r.day : 1}"></label>
        <label class="field ${freq === 'weekly' ? '' : 'hidden'}" data-weekday-wrap><span>Day of the week</span><select name="weekday">
          ${Array.from({ length: 7 }, (_, i) => `<option value="${i}" ${(freq === 'weekly' ? r.weekday : new Date().getDay()) === i ? 'selected' : ''}>${weekdayNameOf(i)}</option>`).join('')}</select></label>
      </div>
      <label class="field ${freq === 'yearly' ? '' : 'hidden'}" data-month-wrap><span>Month</span><select name="month">
        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${(r ? r.month : Number(ui.month.slice(5, 7))) === i + 1 ? 'selected' : ''}>${monthNameOf(i + 1)}</option>`).join('')}</select></label>
      ${monthPicker('Starts from', 'start', r ? r.start : ui.month)}
      <p class="note">It appears on Home under “To pay” each time it is due. You confirm the amount when you pay, so a fee that changes is no problem.</p>
      ${r ? `<label class="check"><input type="checkbox" name="paused" ${r.paused ? 'checked' : ''}><span>Paused</span></label>` : ''}
      <button class="btn">${r ? 'Save changes' : 'Add'}</button>
      ${r ? `<button type="button" class="btn danger" data-act="del-rec" data-id="${r.id}">Delete</button>` : ''}
    </form>`);
}

// A rent or fee that goes up: the new amount applies from the chosen month, and earlier months keep the old one.
function recChangeSheet(r, dir) {
  const up = dir !== 'down';
  const from = firstUnpaidMonth(r);
  openSheet(`${up ? 'Increase' : 'Decrease'} amount: ${r.name}`, `
    <form data-form="recchange" novalidate>
      <input type="hidden" name="id" value="${r.id}"><input type="hidden" name="dir" value="${up ? 'up' : 'down'}">
      <label class="field"><span>${up ? 'Increase by' : 'Decrease by'}</span><input type="text" inputmode="decimal" name="amount" placeholder="0" autocomplete="off" data-autofocus></label>
      ${monthPicker('From which month', 'from', from)}
      <p data-change-preview>${recChangePreview(r, up, '', from)}</p>
      <p class="note">It applies from that month onward, so this month changes only if it is not paid yet. Payments you have already made stay as they are.</p>
      <button class="btn">${up ? 'Increase the amount' : 'Decrease the amount'}</button>
      <button type="button" class="btn ghost" data-act="edit-rec" data-id="${r.id}">Back</button>
    </form>`);
}

// The line under the form that says what the amount is now and what it becomes.
function recChangePreview(r, up, typed, from) {
  const month = isYM(from) ? from : firstUnpaidMonth(r);
  const base = recAmount(r, month);
  const delta = parseAmount(typed);
  const per = PER[r.frequency];
  if (!(delta > 0)) return `Now ${fmt(base)} ${per}.`;
  const next = r3(up ? base + delta : base - delta);
  if (!(next > 0)) return `Now ${fmt(base)} ${per}. The decrease must be smaller than that.`;
  return `Now ${fmt(base)} ${per}. It becomes <strong>${fmt(next)}</strong> from ${ymLabel(month)}.`;
}
function syncRecChangeForm(form) {
  const r = state.recurring.find((x) => x.id === form.elements.id.value);
  if (!r) return;
  const from = pickedMonth({ fromM: form.elements.fromM.value, fromY: form.elements.fromY.value }, 'from');
  $('[data-change-preview]', form).innerHTML = recChangePreview(r, form.elements.dir.value !== 'down', form.elements.amount.value, from);
}

function emiSheet(e) {
  const emiCat = catsOf('expense').find((c) => /emi|loan/i.test(c.name));
  const tenure = e ? e.tenure : 12;
  const pick = [3, 6, 12, 24].includes(tenure) ? String(tenure) : 'other';
  openSheet(e ? 'Edit EMI' : 'New EMI', `
    <form data-form="emi" novalidate>
      <input type="hidden" name="id" value="${e ? e.id : ''}">
      <label class="field"><span>What is it for?</span><input type="text" name="name" maxlength="60" autocomplete="off" placeholder="Phone, laptop, AC…" value="${esc(e ? e.name : '')}" ${e ? '' : 'data-autofocus'}></label>
      <div class="two">
        <label class="field"><span>Monthly instalment</span><input type="text" inputmode="decimal" name="monthly" placeholder="0" autocomplete="off" value="${e ? e.monthly : ''}"></label>
        <label class="field"><span>Day of the month</span><input type="text" inputmode="numeric" name="day" autocomplete="off" value="${e ? e.day : 1}"></label>
      </div>
      <div class="field"><span>Tenure in months</span>
        <div class="seg" role="radiogroup" aria-label="Tenure in months" style="--n:5;grid-template-columns:repeat(5,1fr);margin-bottom:0">
          <i class="seg-pill" aria-hidden="true"></i>
          ${['3', '6', '12', '24', 'other'].map((v) => `<label><input type="radio" name="tenurePick" value="${v}" ${v === pick ? 'checked' : ''}><span>${v === 'other' ? 'Other' : v}</span></label>`).join('')}
        </div></div>
      <label class="field ${pick === 'other' ? '' : 'hidden'}" data-tenure-wrap><span>Number of months</span>
        <input type="text" inputmode="numeric" name="tenureOther" autocomplete="off" placeholder="For example 18" value="${pick === 'other' ? tenure : ''}"></label>
      ${monthPicker('Starting month (first instalment)', 'start', e ? e.start : curYM())}
      <label class="field"><span>Instalments already paid, if it started earlier</span><input type="text" inputmode="numeric" name="paidBefore" autocomplete="off" placeholder="0" value="${e && e.paidBefore ? e.paidBefore : ''}"></label>
      <label class="field"><span>Expense category</span><select name="categoryId">${catOptions('expense', e ? e.categoryId : emiCat && emiCat.id)}</select></label>
      <p class="note" data-emi-summary></p>
      <button class="btn">${e ? 'Save changes' : 'Add EMI'}</button>
      ${e ? `<button type="button" class="btn danger" data-act="del-emi" data-id="${e.id}">Delete</button>` : ''}
    </form>`);
  syncEmiForm($('#sheet-root form'));
}

function emiTenure(form) {
  const pick = form.elements.tenurePick.value;
  const n = pick === 'other' ? Number(String(form.elements.tenureOther.value).trim()) : Number(pick);
  return Number.isInteger(n) && n >= 1 && n <= 360 ? n : NaN;
}

function syncEmiForm(form) {
  $('[data-tenure-wrap]', form).classList.toggle('hidden', form.elements.tenurePick.value !== 'other');
  const tenure = emiTenure(form);
  const monthly = parseAmount(form.elements.monthly.value);
  const start = pickedMonth({ startM: form.elements.startM.value, startY: form.elements.startY.value }, 'start');
  $('[data-emi-summary]', form).textContent = tenure && monthly > 0 && isYM(start)
    ? `${tenure} instalments of ${fmt(monthly)} = ${fmt(monthly * tenure)} in total. It appears on Home under “To pay” every month from ${ymLabel(start)} and stops after the last instalment in ${ymLabel(addMonths(start, tenure - 1))}.`
    : 'It repeats on Home under “To pay” every month until the last instalment.';
}

function emiDetailSheet(e) {
  const st = emiStats(e);
  const now = curYM();
  openSheet(e.name, `
    <div class="kpis three" style="margin-bottom:14px">
      <div class="kpi"><div class="label">Total</div><div class="v">${fmt(st.total)}</div></div>
      <div class="kpi"><div class="label">Paid</div><div class="v">${st.paidCount} of ${e.tenure}</div></div>
      <div class="kpi"><div class="label">Left</div><div class="v">${fmt(st.left)}</div></div>
    </div>
    <p>${fmt(e.monthly)} a month for ${plural(e.tenure, 'month')}, from ${ymShort(e.start)} to ${ymShort(st.end)}.</p>
    <div class="list">${st.months.map((m) => {
      const [cls, label] = m.before ? ['done', '✓ Paid earlier'] : m.tx ? ['done', '✓ Paid'] : m.ym <= now ? ['unpaid', '⚠ Unpaid'] : ['', 'Upcoming'];
      const inner = `<span class="row-main"><span class="row-top"><span class="name">${m.seq}. ${ymLabel(m.ym)}</span><span class="amt">${fmt(m.tx ? m.tx.amount : e.monthly)}</span></span>
        <span class="row-top"><span class="row-sub">${m.tx ? `Paid ${fmtShort(m.tx.date)}` : m.before ? '' : 'Tap to mark as paid'}</span><span class="pill ${cls}">${label}</span></span></span>`;
      return m.before ? `<div class="row">${inner}</div>` : `<button class="row" data-act="emi-month" data-id="${e.id}" data-period="${m.ym}">${inner}</button>`;
    }).join('')}</div>
    <button class="btn ghost" data-act="edit-emi" data-id="${e.id}">Edit EMI</button>`);
}

function planSheet(p) {
  openSheet(p ? 'Edit plan' : 'New plan', `
    <form data-form="plan" novalidate>
      <input type="hidden" name="id" value="${p ? p.id : ''}">
      <label class="field"><span>What do you plan to buy or do?</span><input type="text" name="name" maxlength="60" autocomplete="off" placeholder="New phone, family trip…" value="${esc(p ? p.name : '')}" ${p ? '' : 'data-autofocus'}></label>
      <label class="field"><span>Expected cost</span><input type="text" inputmode="decimal" name="price" placeholder="0" autocomplete="off" value="${p ? p.price : ''}"></label>
      <label class="field"><span>By when (optional)</span><input type="date" name="date" value="${p ? planDate(p) : ''}"></label>
      <p class="note">You are reminded the day before. The plan stays marked on the Planner tab until you buy it or change the date.</p>
      <label class="field"><span>Priority</span><select name="priority">
        ${['high', 'medium', 'low'].map((v) => `<option value="${v}" ${(p ? p.priority : 'medium') === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></label>
      <label class="field"><span>Note (optional)</span><input type="text" name="note" maxlength="120" autocomplete="off" value="${esc(p ? p.note : '')}"></label>
      ${p ? `<label class="check"><input type="checkbox" name="done" ${p.done ? 'checked' : ''}><span>Done</span></label>` : ''}
      ${p ? '' : '<p class="note">The plan also gets a savings fund of its own, so you can set money aside for it and see how far you are.</p>'}
      <button class="btn">${p ? 'Save changes' : 'Add plan'}</button>
      ${p && !p.done ? `<button type="button" class="btn ghost" data-act="plan-save" data-id="${p.id}">Add savings for this plan</button>
      <button type="button" class="btn ghost" data-act="plan-bought" data-id="${p.id}">I bought it, add as an expense</button>` : ''}
      ${p ? `<button type="button" class="btn danger" data-act="del-plan" data-id="${p.id}">Delete</button>` : ''}
    </form>`);
}

function debtSheet(d, kind) {
  const k = d ? d.kind : kind;
  const recv = k === 'receivable';
  openSheet(d ? 'Edit' : recv ? 'Money someone owes you' : 'Money you owe', `
    <form data-form="debt" novalidate>
      <input type="hidden" name="id" value="${d ? d.id : ''}"><input type="hidden" name="kind" value="${k}">
      <label class="field"><span>${recv ? 'Who owes you?' : 'Who do you owe?'}</span><input type="text" name="person" maxlength="60" autocomplete="off" value="${esc(d ? d.person : '')}" ${d ? '' : 'data-autofocus'}></label>
      <label class="field"><span>Amount</span><input type="text" inputmode="decimal" name="amount" placeholder="0" autocomplete="off" value="${d ? d.amount : ''}"></label>
      <div class="two">
        <label class="field"><span>Date</span><input type="date" name="date" value="${d ? d.date : today()}"></label>
        <label class="field"><span>Due by (optional)</span><input type="date" name="due" value="${d ? d.due : ''}"></label>
      </div>
      <label class="field"><span>Note (optional)</span><input type="text" name="note" maxlength="120" autocomplete="off" value="${esc(d ? d.note : '')}"></label>
      <button class="btn">${d ? 'Save changes' : 'Add'}</button>
      ${d ? `<button type="button" class="btn danger" data-act="del-debt" data-id="${d.id}">Delete</button>` : ''}
    </form>`);
}

function debtDetailSheet(d) {
  const recv = d.kind === 'receivable';
  const left = debtLeft(d);
  openSheet(d.person, `
    <div class="kpis three" style="margin-bottom:14px">
      <div class="kpi"><div class="label">Amount</div><div class="v">${fmt(d.amount)}</div></div>
      <div class="kpi"><div class="label">${recv ? 'Received' : 'Paid back'}</div><div class="v">${fmt(debtPaid(d))}</div></div>
      <div class="kpi"><div class="label">Left</div><div class="v">${fmt(left)}</div></div>
    </div>
    <p>${recv ? 'Owes you since' : 'You owe since'} ${fmtDay(d.date)}${d.due ? ` · due ${fmtDay(d.due)}` : ''}${d.note ? ` · ${esc(d.note)}` : ''}</p>
    ${d.payments.length ? `<div class="list">${d.payments.map((p) => `<div class="row"><span class="row-main"><span class="row-top">
      <span class="name">${fmtDay(p.date)}</span><span class="amt">${fmt(p.amount)}</span></span></span>
      <button class="x" data-act="del-debtpay" data-id="${d.id}" data-pay="${p.id}" aria-label="Remove this payment">✕</button></div>`).join('')}</div>` : ''}
    ${d.settled ? '' : `<form data-form="debtpay" novalidate>
      <input type="hidden" name="id" value="${d.id}">
      <div class="two">
        <label class="field"><span>${recv ? 'Amount received' : 'Amount paid back'}</span><input type="text" inputmode="decimal" name="amount" autocomplete="off" value="${left || ''}"></label>
        <label class="field"><span>Date</span><input type="date" name="date" value="${today()}"></label>
      </div>
      <button class="btn">${recv ? 'Record money received' : 'Record payment'}</button>
    </form>`}
    <button class="btn ghost" data-act="toggle-debt" data-id="${d.id}">${d.settled ? 'Reopen' : left > 0 ? (recv ? 'I received all of it' : 'I paid all of it back') : 'Mark as settled'}</button>
    <button class="btn ghost" data-act="edit-debt" data-id="${d.id}">Edit</button>
    <p class="note" style="margin-top:12px">${recv ? 'Money you record as received is added to that day’s income.' : 'Money you record as paid back is added to that day’s expenses.'} You are reminded the day before it is due.</p>`);
}

function syncRecForm(form) {
  const freq = form.elements.frequency.value;
  $('[data-month-wrap]', form).classList.toggle('hidden', freq !== 'yearly');
  $('[data-day-wrap]', form).classList.toggle('hidden', freq === 'weekly');
  $('[data-weekday-wrap]', form).classList.toggle('hidden', freq !== 'weekly');
}

/* ---------- Saving forms ---------- */

const amountOf = (v) => (String(v ?? '').trim() ? parseAmount(v) : 0);
const dayOf = (v) => { const n = Math.round(Number(String(v).trim())); return n >= 1 && n <= 31 ? n : NaN; };
const done = () => { save(); closeSheet(); render(); };

function submitTx(f) {
  const amount = parseAmount(f.amount);
  if (!(amount > 0)) return toast('Enter an amount above zero.');
  if (!TYPES.includes(f.type)) return;
  if (!isDate(f.date)) return toast('Pick a date.');
  let c = cat(f.categoryId);
  if (isGuest()) {
    if (!guestCanAdd()) return;
    return guestSaveTx({ id: f.id || uid(), amount, categoryId: c && c.type === 'expense' ? c.id : '', date: f.date, note: f.note.trim().slice(0, 120) }, !!f.id);
  }
  if (f.categoryId === NEW_CAT) {
    const name = String(f.newCatName || '').trim().slice(0, 40);
    if (!name) return toast('Give the new category a name.');
    c = catsOf(f.type).find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!c) {
      c = { id: uid(), type: f.type, group: 'primary', name, emoji: f.newCatEmoji || '', budget: 0, opening: 0, target: 0 };
      state.categories.push(c);
    }
  }
  const data = { type: f.type, amount, categoryId: c && c.type === f.type ? c.id : '', date: f.date, note: f.note.trim(),
    recurringId: f.recurringId || '', emiId: f.emiId || '', planId: f.planId || '', period: f.period || '' };
  const existing = f.id && state.transactions.find((t) => t.id === f.id);
  if (existing) Object.assign(existing, data);
  else state.transactions.push({ id: uid(), created: Date.now(), ...data });
  if (data.planId) {
    const p = state.plans.find((x) => x.id === data.planId);
    if (p) p.done = true;
    // Buying a plan uses up what was saved for it. That money was already taken out of earlier months as savings, so it
    // comes back in on the day of the purchase as income "From savings", and the fund stops counting as money saved.
    const fund = p && !existing ? planFund(p) : null;
    const saved = fund && !fund.used ? savedIn(fund) : 0;
    if (fund) fund.used = true;
    if (saved > 0) {
      let other = state.categories.find((x) => x.type === 'income' && isOthers(x));
      if (!other) { other = { id: uid(), type: 'income', group: 'secondary', name: 'Others', emoji: '📦', budget: 0, opening: 0, target: 0 }; state.categories.push(other); }
      state.transactions.push({ id: uid(), created: Date.now(), type: 'income', amount: saved, categoryId: other.id, date: data.date, note: `From savings for ${p.name}`,
        recurringId: '', emiId: '', planId: '', period: '' });
    }
  }
  done();
  toast(existing ? 'Saved' : `${TYPE_LABEL[f.type]} added`);
}

function submitCat(f) {
  const name = f.name.trim();
  if (!name) return toast('Give it a name.');
  const budget = amountOf(f.budget);
  if (Number.isNaN(budget) || budget < 0) return toast('That limit is not a valid number.');
  const opening = amountOf(f.opening);
  if (Number.isNaN(opening) || opening < 0) return toast('That amount is not a valid number.');
  const target = amountOf(f.target);
  if (Number.isNaN(target) || target < 0) return toast('That target is not a valid number.');
  const data = { name, emoji: f.emoji.trim(), group: f.group === 'secondary' ? 'secondary' : 'primary', budget, opening, target };
  const existing = f.id && cat(f.id);
  // The amount already in a fund is set once, when the fund is created.
  if (existing) Object.assign(existing, data, { opening: existing.opening || 0 });
  else state.categories.push({ id: uid(), type: TYPES.includes(f.type) ? f.type : 'expense', ...data });
  done();
}

function submitRec(f) {
  const name = f.name.trim();
  if (!name) return toast('Give it a name.');
  const amount = parseAmount(f.amount);
  if (!(amount > 0)) return toast('Enter an amount above zero.');
  const frequency = FREQS.includes(f.frequency) ? f.frequency : 'monthly';
  const weekly = frequency === 'weekly';
  // A weekly item has no day of the month, so whatever is in that hidden box is not checked.
  const day = weekly ? dayOf(f.day) || 1 : dayOf(f.day);
  if (Number.isNaN(day)) return toast('The day must be between 1 and 31.');
  const start = pickedMonth(f, 'start');
  if (!isYM(start)) return toast('Pick the month it starts from.');
  const c = cat(f.categoryId);
  const existing = f.id && state.recurring.find((r) => r.id === f.id);
  const weekday = Math.min(6, Math.max(0, Math.round(Number(f.weekday)) || 0));
  // A weekly item that starts this month counts from today: the weeks already gone are not listed as unpaid.
  const kept = existing && existing.frequency === 'weekly' && existing.start === start;
  const since = !weekly ? '' : kept ? existing.since || '' : start === curYM() ? today() : '';
  const data = { type: f.type, name, amount, categoryId: c && c.type === f.type ? c.id : '', frequency,
    day, weekday, since, month: Number(f.month) || 1, start, paused: !!f.paused };
  if (existing) Object.assign(existing, data);
  else state.recurring.push({ id: uid(), end: '', skips: [], note: '', changes: [], ...data });
  done();
}

function submitRecChange(f) {
  const r = state.recurring.find((x) => x.id === f.id);
  if (!r) return closeSheet();
  const up = f.dir !== 'down';
  const delta = parseAmount(f.amount);
  if (!(delta > 0)) return toast(`Enter how much to ${up ? 'increase' : 'decrease'} it by.`);
  const from = pickedMonth(f, 'from');
  if (!isYM(from)) return toast('Pick the month the new amount starts from.');
  const amount = r3(up ? recAmount(r, from) + delta : recAmount(r, from) - delta);
  if (!(amount > 0)) return toast('The decrease must be smaller than the amount itself.');
  r.changes = (r.changes || []).filter((c) => c.from !== from).concat({ from, amount }).sort((a, b) => (a.from < b.from ? -1 : 1));
  done();
  toast(`${up ? 'Increased' : 'Decreased'} to ${fmt(amount)} from ${ymLabel(from)}`);
}

function submitEmi(f, form) {
  const name = f.name.trim();
  if (!name) return toast('Say what the EMI is for.');
  const monthly = parseAmount(f.monthly);
  if (!(monthly > 0)) return toast('Enter the monthly instalment.');
  const tenure = emiTenure(form);
  if (!tenure) return toast('Enter the tenure as a number of months, from 1 to 360.');
  const day = dayOf(f.day);
  if (Number.isNaN(day)) return toast('The day must be between 1 and 31.');
  const start = pickedMonth(f, 'start');
  if (!isYM(start)) return toast('Pick the starting month.');
  const paidBefore = String(f.paidBefore).trim() ? Number(String(f.paidBefore).trim()) : 0;
  if (!Number.isInteger(paidBefore) || paidBefore < 0 || paidBefore > tenure) return toast(`Instalments already paid must be a number from 0 to ${tenure}.`);
  const data = { name, monthly, tenure, paidBefore, day, start, categoryId: cat(f.categoryId) ? f.categoryId : '' };
  const existing = f.id && state.emis.find((e) => e.id === f.id);
  if (existing) Object.assign(existing, data);
  else state.emis.push({ id: uid(), note: '', ...data });
  ui.bills = 'emi';
  done();
}

function submitPlan(f) {
  const name = f.name.trim();
  if (!name) return toast('Say what the plan is.');
  const price = amountOf(f.price);
  if (Number.isNaN(price) || price < 0) return toast('That cost is not a valid number.');
  const date = isDate(f.date) ? f.date : '';
  const data = { name, price, date, target: date.slice(0, 7), priority: ['high', 'medium', 'low'].includes(f.priority) ? f.priority : 'medium', note: f.note.trim() };
  const existing = f.id && state.plans.find((p) => p.id === f.id);
  if (existing) Object.assign(existing, data, { done: !!f.done });
  else state.plans.push({ id: uid(), done: false, ...data });
  const plan = existing || state.plans[state.plans.length - 1];
  // A new plan gets its savings fund; a changed one keeps the fund's name and target the same as the plan's.
  if (!plan.done) {
    const fund = ensurePlanFund(plan);
    if (!fund.used) { fund.name = plan.name.slice(0, 40); fund.target = plan.price; }
  }
  done();
}

function submitDebt(f) {
  const person = f.person.trim();
  if (!person) return toast('Enter a name.');
  const amount = parseAmount(f.amount);
  if (!(amount > 0)) return toast('Enter an amount above zero.');
  if (!isDate(f.date)) return toast('Pick a date.');
  const data = { person, amount, date: f.date, due: isDate(f.due) ? f.due : '', note: f.note.trim() };
  const existing = f.id && state.debts.find((d) => d.id === f.id);
  if (existing) Object.assign(existing, data);
  else state.debts.push({ id: uid(), kind: f.kind === 'payable' ? 'payable' : 'receivable', settled: false, payments: [], ...data });
  done();
}

// Records money received for a debt owed to the person, or money they paid back on one they owe. It is also added to
// that day's income (received) or expenses (paid back), under the "Other" category of that kind.
function payDebt(d, amount, date) {
  const type = d.kind === 'receivable' ? 'income' : 'expense';
  let c = state.categories.find((x) => x.type === type && isOthers(x));
  if (!c) { c = { id: uid(), type, group: type === 'income' ? 'secondary' : 'primary', name: 'Others', emoji: '📦', budget: 0, opening: 0, target: 0 }; state.categories.push(c); }
  const tx = { id: uid(), created: Date.now(), type, amount, categoryId: c.id, date, note: d.kind === 'receivable' ? `Received from ${d.person}` : `Paid back to ${d.person}`,
    recurringId: '', emiId: '', planId: '', period: '' };
  state.transactions.push(tx);
  d.payments.push({ id: uid(), amount, date, txId: tx.id });
}

function submitDebtPay(f) {
  const d = state.debts.find((x) => x.id === f.id);
  if (!d) return closeSheet();
  const amount = parseAmount(f.amount);
  if (!(amount > 0)) return toast('Enter an amount above zero.');
  if (!isDate(f.date)) return toast('Pick a date.');
  payDebt(d, amount, f.date);
  if (debtPaid(d) >= d.amount) d.settled = true;
  save(); render(); debtDetailSheet(d);
  toast(d.settled ? 'Fully settled' : 'Recorded');
}

/* ---------- Export, backup, restore ---------- */

async function shareOrDownload(filename, text, mime) {
  // Inside the Android app a web page cannot save files itself, so the app does it.
  if (window.FetaAndroid && window.FetaAndroid.saveFile) {
    if (window.FetaAndroid.saveFile(filename, mime, text)) return;
    return toast('Could not save the file.');
  }
  const file = new File([text], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportCsv() {
  if (!state.transactions.length) return toast('There are no transactions to export yet.');
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheets treating text as a formula
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Date', 'Type', 'Category', 'Income kind', 'Description', 'Amount']];
  for (const t of sortedTx(state.transactions).reverse()) {
    const c = cat(t.categoryId);
    rows.push([t.date, TYPE_LABEL[t.type], cell(c ? c.name : ''), t.type === 'income' && c ? c.group : '', cell(t.note), t.amount]);
  }
  shareOrDownload(`feta-${today()}.csv`, '﻿' + rows.map((r) => r.join(',')).join('\r\n'), 'text/csv');
}

function restoreFrom(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { data = null; }
    if (!validState(data)) return toast('That file is not a FETA backup.');
    confirmSheet('Restore this backup?', `This replaces everything on this device with the backup (${plural(data.transactions.length, 'transaction')}).`,
      'Replace my data', () => {
        state = sanitize(data);
        state.settings.started = true;
        fmtCache = {}; ui.tab = 'home'; ui.bar = null; ui.month = curYM();
        save(); applyTheme(); render(); toast('Backup restored');
      });
  };
  reader.onerror = () => toast('Could not read that file.');
  reader.readAsText(file);
}

/* ---------- Profiles, guests and comments ---------- */

// A person has one main profile and may add more. They can also be a guest in someone else's profile: a guest sees
// the reports and transactions, and, if the owner allows it, adds expenses. Guests never save the profile's data
// themselves; the database adds their expense for them after checking that they may.
const APP_URL = 'https://offlinecrow.github.io/FETA/';
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
// Profile pictures are switched off for now, to save space on the free online plan: people are shown by the first
// letter of their name. Everything for pictures is still here; set this to true to switch them on again.
const PICTURES = false;
const api = async (path, opt = {}) => sb(path, { ...opt, token: await freshToken() });
const person = (id) => share.people[id] || {};
const myName = () => person(myId()).name || (sync.session ? sync.session.user.email.split('@')[0] : '');
const fmtWhen = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(LOCALE(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };

function avatarHtml(who, cls = '') {
  const pic = PICTURES && who && AVATAR_RE.test(who.avatar || '') ? who.avatar : '';
  const letter = String((who && who.name) || '').trim().charAt(0).toUpperCase() || '•';
  return `<span class="avatar ${cls}" aria-hidden="true">${pic ? `<img src="${pic}" alt="">` : esc(letter)}</span>`;
}

// Every profile this person can open: their own first, then the ones they are a guest in.
function allProfiles() {
  const own = share.profiles.map((p) => ({ id: p.id, kind: 'own', main: !!p.is_main, name: p.name || '' }));
  const guest = share.guestOf.map((g) => ({ id: g.profile_id, kind: 'guest', role: g.role === 'add' ? 'add' : 'view',
    name: g.profile_name || '', owner: g.owner_email || '', ownerId: g.owner_id }));
  return [...own, ...guest];
}
function profileLabel(p) {
  if (!p) return 'My profile';
  if (p.kind !== 'guest') return p.name || 'My profile';
  const owner = person(p.ownerId).name || p.owner || 'Shared profile';
  return p.name ? `${owner} · ${p.name}` : owner;
}
const ROLE_TEXT = { view: 'Reports only', add: 'Reports and adding expenses' };

// The lists behind the profile screen: profiles, invitations, guests, names and pictures, and the comments
// of the profile on screen. Fetched with every sync and kept on the device so they show without internet.
async function loadShare() {
  if (!sync.v2 || !sync.session) return;
  const me = myId();
  const active = sync.profile ? sync.profile.id : '';
  const [profiles, guestRows, people, comments] = await Promise.all([
    api(`/rest/v1/profiles?select=id,name,is_main&owner_id=eq.${encodeURIComponent(me)}&order=is_main.desc,name.asc`),
    api('/rest/v1/profile_guests?select=*&order=created_at.asc'),
    api('/rest/v1/people?select=user_id,name,avatar'),
    active ? api(`/rest/v1/comments?select=*&profile_id=eq.${encodeURIComponent(active)}&order=created_at.asc&limit=1000`) : []
  ]);
  const rows = Array.isArray(guestRows) ? guestRows : [];
  const next = {
    profiles: Array.isArray(profiles) ? profiles : [],
    guests: rows.filter((g) => g.owner_id === me),
    guestOf: rows.filter((g) => g.owner_id !== me && g.status === 'accepted' && g.guest_id === me),
    invites: rows.filter((g) => g.owner_id !== me && g.status === 'invited'),
    people: Object.fromEntries((Array.isArray(people) ? people : []).map((p) => [p.user_id, { name: String(p.name || ''), avatar: String(p.avatar || '') }])),
    comments: Array.isArray(comments) ? comments : []
  };
  if (isGuest()) {
    // The owner may have changed what this guest is allowed to do.
    const g = next.guestOf.find((x) => x.profile_id === sync.profile.id);
    if (g && g.role !== sync.profile.role) { sync.profile.role = g.role === 'add' ? 'add' : 'view'; saveSync(); }
  }
  const changed = JSON.stringify(next) !== JSON.stringify(share);
  share = next;
  saveShare();
  if (!changed) return;
  if (!$('#sheet-root').firstChild) render();
}

// Shows another profile. Needs internet, and anything not yet saved online is sent first, so nothing is lost.
async function switchProfile(p) {
  if (!sync.session || !p) return;
  if (syncing) await syncing;
  if (sync.dirty) await syncNow();
  if (sync.dirty) return toast('Your latest changes are not saved online yet. Connect to the internet, then try again.');
  const before = { profile: sync.profile, rev: sync.rev };
  clearTimeout(pushTimer);
  sync.profile = p;
  try {
    const row = await pullRow();
    if (!row || row.old || !validState(row.data)) throw new Error('gone');
    sync.rev = Number(row.rev) || 0; sync.dirty = false;
    saveSync();
    share.comments = [];
    Object.assign(ui, { tab: 'home', home: 'month', month: curYM(), filter: 'all', search: '', bar: null, setup: null, page: null });
    lastTabIndex = null;
    closeSheet();
    showState(row.data);
    window.scrollTo(0, 0);
    toast(`Now showing: ${profileLabel(p)}`);
    syncNow();
  } catch (e) {
    Object.assign(sync, before);
    saveSync();
    toast(e instanceof TypeError ? 'No internet connection. Try again when you are online.' : 'That profile could not be opened.');
    syncNow();
  }
}
const mainProfile = () => allProfiles().find((p) => p.kind === 'own' && p.main) || null;

// The profile page under Setup: the person's name and picture, their profiles and invitations, and the guests of
// the profile on screen.
function profileBody() {
  const signedIn = !!sync.session;
  const active = sync.profile ? sync.profile.id : '';
  let body = signedIn ? `<div class="me-head">${avatarHtml({ name: myName(), avatar: person(myId()).avatar }, 'big')}
      <div class="me-text"><div class="name">${esc(myName())}</div><div class="row-sub">${esc(sync.session.user.email)}</div></div>
      ${sync.v2 ? '<button class="link" data-act="edit-me">Edit</button>' : ''}</div>` : '<p class="note" style="margin:0">Sign in to use profiles, guests and comments.</p>';
  if (signedIn && !sync.v2) body += '<p class="note" style="margin:0">Profiles, guests and comments are not switched on yet. They start working once the database update (sharing.sql) has been run in Supabase.</p>';
  if (signedIn && sync.v2) {
    if (share.invites.length) {
      body += `<div class="sec-head"><h2>Invitations</h2></div><div class="list">${share.invites.map((g) => `<div class="row"><span class="row-main">
        <span class="name" style="white-space:normal">${esc(profileLabel({ kind: 'guest', name: g.profile_name, owner: g.owner_email, ownerId: g.owner_id }))}</span>
        <span class="row-sub" style="white-space:normal">${g.role === 'add' ? 'Invites you to see the reports and add expenses.' : 'Invites you to see the reports.'}</span>
        <span class="btn-row"><button class="btn small" data-act="invite-accept" data-id="${esc(g.id)}">Accept</button>
          <button class="btn ghost small" data-act="invite-decline" data-id="${esc(g.id)}">Decline</button></span></span></div>`).join('')}</div>`;
    }
    const list = allProfiles();
    body += `<div class="sec-head"><h2>Profiles</h2><button class="link" data-act="new-profile">+ New profile</button></div>
      <div class="list">${list.length ? list.map((p) => {
        const on = p.id === active;
        const sub = [p.kind === 'guest' ? ROLE_TEXT[p.role] : '', on ? 'Showing now' : ''].filter(Boolean).join(' · ');
        return `<button class="row go" data-act="open-profile" data-id="${esc(p.id)}" ${on ? 'aria-current="true"' : ''}>
          <span class="row-main"><span class="row-top"><span class="name">${esc(profileLabel(p))}</span><span class="pill ${p.kind === 'guest' ? '' : 'done'}">${p.kind === 'guest' ? 'Guest' : 'Own'}</span></span>
          ${sub ? `<span class="row-sub">${sub}</span>` : ''}</span><span class="chev" aria-hidden="true">›</span></button>`;
      }).join('') : '<div class="empty">Your profile appears here after the next sync.</div>'}</div>`;
    if (active && !isGuest()) {
      const guests = share.guests.filter((g) => g.profile_id === active);
      body += `<div class="sec-head"><h2>Guests of this profile</h2><button class="link" data-act="invite-guest">+ Invite</button></div>
        <div class="list">${guests.length ? guests.map((g) => `<button class="row go" data-act="open-guest" data-id="${esc(g.id)}">
          <span class="row-main"><span class="row-top"><span class="name">${esc(person(g.guest_id).name || g.email)}</span><span class="pill ${g.status === 'accepted' ? 'done' : ''}">${g.status === 'accepted' ? 'Joined' : 'Invited'}</span></span>
          <span class="row-sub">${esc(g.email)} · ${ROLE_TEXT[g.role === 'add' ? 'add' : 'view']}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('')
          : '<div class="empty">Nobody else can see this profile.</div>'}</div>`;
    }
  }
  return body;
}
// Opens the profile page, from wherever the person is.
function profileSheet() {
  closeSheet();
  ui.tab = 'more'; ui.setup = 'profile'; ui.page = null; ui.bar = null;
  render();
}

// A new picture waiting to be saved: undefined when the picture was not touched, '' when it was removed.
let pendingAvatar;
function meSheet() {
  pendingAvatar = undefined;
  const me = person(myId());
  openSheet(PICTURES ? 'Your name and picture' : 'Your name', `
    <form data-form="me" novalidate>
      ${PICTURES ? `<div class="me-head"><span data-avatar-preview>${avatarHtml({ name: myName(), avatar: me.avatar }, 'big')}</span>
        <div class="me-text"><label class="btn ghost small">Choose a picture<input type="file" id="avatar-file" accept="image/*" class="hidden"></label>
        ${AVATAR_RE.test(me.avatar || '') ? '<button type="button" class="link" data-act="avatar-remove">Remove picture</button>' : ''}</div></div>` : ''}
      <label class="field"><span>Name</span><input type="text" name="name" maxlength="40" autocomplete="name" value="${esc(myName())}" ${PICTURES ? '' : 'data-autofocus'}></label>
      <p class="note">${PICTURES ? 'People you share a profile with see this name and picture.' : 'People you share a profile with see this name.'}</p>
      <button class="btn">Save</button>
    </form>`);
  centerSheet();
}

// Shrinks a chosen photo to a small square, so it is quick to load and cheap to store.
function readAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 160, 160);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) { reject(e); }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}
async function pickAvatar(file) {
  try {
    const pic = await readAvatar(file);
    if (!AVATAR_RE.test(pic) || pic.length > 60000) throw new Error('too big');
    pendingAvatar = pic;
    const box = $('#sheet-root [data-avatar-preview]');
    if (box) box.innerHTML = avatarHtml({ name: myName(), avatar: pic }, 'big');
  } catch (e) { toast('That picture could not be used. Try another one.'); }
}

async function submitMe(f) {
  const name = String(f.name || '').trim().slice(0, 40);
  if (!name) return toast('Give it a name.');
  const avatar = !PICTURES ? '' : pendingAvatar === undefined ? person(myId()).avatar || '' : pendingAvatar;
  try {
    await api('/rest/v1/people', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: myId(), name, avatar } });
    share.people[myId()] = { name, avatar };
    saveShare();
    render(); profileSheet(); toast('Saved');
  } catch (e) { toast(authMessage(e)); }
}

// What can be done with one profile from the list: open it, rename it, delete it, or (for a guest) leave it.
function profileOptionsSheet(p) {
  const on = !!sync.profile && sync.profile.id === p.id;
  const own = p.kind !== 'guest';
  const id = esc(p.id);
  openSheet(profileLabel(p), `
    <p>${own ? 'Own' : 'Guest'}${own ? '' : ` · ${ROLE_TEXT[p.role]}`}${on ? ' · Showing now' : ''}</p>
    ${on ? '' : `<button class="btn" data-act="switch-profile" data-id="${id}">Switch to this profile</button>`}
    ${own ? `<button class="btn ghost" data-act="rename-profile" data-id="${id}">Rename</button>` : ''}
    ${own && !p.main ? `<button class="btn danger" data-act="del-profile" data-id="${id}">Delete this profile</button>` : ''}
    ${own ? '' : `<button class="btn danger" data-act="leave-profile" data-id="${id}">Leave this profile</button>`}
    <button class="btn ghost" data-act="close-sheet">Close</button>`);
  centerSheet();
}

// The form for a new profile, or (given one of the person's own profiles) for renaming it.
function profileNameSheet(p) {
  openSheet(p ? 'Rename profile' : 'New profile', `
    <form data-form="profilename" novalidate>
      <input type="hidden" name="id" value="${p ? esc(p.id) : ''}">
      <label class="field"><span>Profile name</span><input type="text" name="name" maxlength="40" autocomplete="off" placeholder="For example Family or Business" value="${p ? esc(p.name || '') : ''}" data-autofocus></label>
      ${p ? '' : '<p class="note">A new profile starts empty, with its own income, expenses, bills and reports. Your other profiles stay as they are.</p>'}
      <button class="btn">${p ? 'Save' : 'Create profile'}</button>
    </form>`);
  centerSheet();
}

async function submitProfileName(f) {
  const name = String(f.name || '').trim().slice(0, 40);
  if (!name) return toast('Give it a name.');
  try {
    if (f.id) {
      // Only the person's own profiles can be renamed; the database refuses anything else.
      const p = allProfiles().find((x) => x.id === f.id && x.kind === 'own');
      if (!p) return;
      await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { name } });
      if (sync.profile && sync.profile.id === p.id) { sync.profile.name = name; saveSync(); }
      await loadShare();
      render(); profileSheet(); toast('Saved');
      return;
    }
    const data = blankState();
    data.settings.currency = state.settings.currency; data.settings.theme = state.settings.theme; data.settings.started = true;
    data.categories = defaultCategories();
    data.settings.carryFrom = curYM();
    const rows = await api('/rest/v1/profiles', { method: 'POST', prefer: 'return=representation', body: { owner_id: myId(), name, is_main: false, data, rev: 1 } });
    const made = first(rows);
    if (!made) throw new Error('The profile could not be created.');
    await switchProfile({ id: made.id, kind: 'own', main: false, name });
  } catch (e) { toast(authMessage(e)); }
}

function inviteSheet() {
  openSheet('Invite a guest', `
    <form data-form="invite" novalidate>
      <label class="field"><span>Guest’s email</span><input type="email" inputmode="email" name="email" autocomplete="off" autocapitalize="none" spellcheck="false" data-autofocus></label>
      <div class="field"><span>What the guest can do</span>
        <label class="check"><input type="radio" name="role" value="view" checked><span><span class="name">Reports only</span><span class="row-sub" style="white-space:normal;display:block">Sees the reports and the transactions. Cannot change anything.</span></span></label>
        <label class="check"><input type="radio" name="role" value="add"><span><span class="name">Reports and adding expenses</span><span class="row-sub" style="white-space:normal;display:block">Also adds expenses. Cannot add income, bills, savings or plans, and cannot open Setup.</span></span></label>
      </div>
      <p class="note">The guest finds the invitation in FETA after creating an account or signing in with this email address.</p>
      <button class="btn">Invite</button>
    </form>`);
  centerSheet();
}

async function submitInvite(f) {
  const email = String(f.email || '').trim().toLowerCase();
  if (!validEmail(email)) return toast('Enter the guest’s email address.');
  if (email === sync.session.user.email.toLowerCase()) return toast('That is your own email address.');
  if (!sync.profile || isGuest()) return;
  try {
    await api('/rest/v1/profile_guests', { method: 'POST', body: { profile_id: sync.profile.id, owner_email: sync.session.user.email, profile_name: sync.profile.name || '', email, role: f.role === 'add' ? 'add' : 'view' } });
    await loadShare();
    openSheet('Invitation saved', `<p>${esc(email)} finds the invitation in FETA after creating an account or signing in with that email address.</p>
      <button class="btn" data-act="invite-share" data-id="${esc(email)}">Send them a message</button>
      <button class="btn ghost" data-act="profile">Done</button>`);
    centerSheet();
  } catch (e) { toast(e.status === 409 ? 'That person is already invited to this profile.' : authMessage(e)); }
}

let openGuestId = '';
function guestSheet(g) {
  openGuestId = g.id;
  const role = g.role === 'add' ? 'add' : 'view';
  openSheet(person(g.guest_id).name || g.email, `
    <p>${esc(g.email)} · ${g.status === 'accepted' ? 'Joined' : 'Invited, has not joined yet'}</p>
    <div class="field"><span>What the guest can do</span>${segButtons('guest-role', [['view', 'Reports only'], ['add', 'Add expenses too']], role)}</div>
    <button class="btn danger" data-act="guest-remove">${g.status === 'accepted' ? 'Remove this guest' : 'Cancel the invitation'}</button>
    <button class="btn ghost" data-act="profile">Back</button>`);
  slidePills();
}

// Comments under a transaction. A reply sits under the comment it answers.
function commentsBlock(tx) {
  if (!tx || !sync.v2 || !sync.session || !sync.profile) return '';
  const all = share.comments.filter((c) => c.tx_id === tx.id);
  const me = myId();
  const one = (c, top) => `<div class="comment ${top === c.id ? '' : 'reply'}">${avatarHtml({ name: c.author_name, avatar: person(c.author_id).avatar })}
    <div class="comment-main"><div class="comment-head"><span class="name">${esc(c.author_name || 'Someone')}</span><span class="row-sub">${esc(fmtWhen(c.created_at))}</span></div>
      <div class="comment-body">${esc(c.body)}</div>
      <div class="comment-acts"><button type="button" class="link" data-act="comment-reply" data-id="${esc(top)}" data-name="${esc(c.author_name || '')}">Reply</button>
        ${c.author_id === me || !isGuest() ? `<button type="button" class="link" data-act="comment-del" data-id="${esc(c.id)}" data-tx="${esc(tx.id)}">Delete</button>` : ''}</div></div></div>`;
  const tops = all.filter((c) => !c.parent_id || !all.some((p) => p.id === c.parent_id));
  return `<div class="comments"><div class="sec-head"><h2>Comments</h2></div>
    ${tops.length ? tops.map((c) => one(c, c.id) + all.filter((r) => r.parent_id === c.id).map((r) => one(r, c.id)).join('')).join('') : '<p class="note" style="margin:0 0 12px">No comments yet.</p>'}
    <form data-form="comment" novalidate>
      <input type="hidden" name="tx" value="${esc(tx.id)}"><input type="hidden" name="parent" value="">
      <p class="note hidden" data-replying></p>
      <div class="comment-box"><input type="text" name="body" maxlength="500" autocomplete="off" placeholder="Write a comment" aria-label="Write a comment"><button class="btn small">Send</button></div>
    </form></div>`;
}
function reopenTx(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (t) txSheet(t); else closeSheet();
}

async function submitComment(f) {
  const body = String(f.body || '').trim().slice(0, 500);
  if (!body) return toast('Write something first.');
  if (!sync.profile) return;
  try {
    const rows = await api('/rest/v1/comments', { method: 'POST', prefer: 'return=representation',
      body: { profile_id: sync.profile.id, tx_id: f.tx, parent_id: f.parent || null, author_name: myName().slice(0, 40), body } });
    if (first(rows)) { share.comments.push(first(rows)); saveShare(); }
    render(); reopenTx(f.tx);
  } catch (e) { toast(authMessage(e)); }
}

// What a guest sees when opening a transaction they may not change: its details and the comments.
function txViewSheet(tx) {
  const c = cat(tx.categoryId);
  const facts = [tx.note && c ? c.name : '', `${fmtDay(tx.date)}, ${tx.date.slice(0, 4)}`, tx.byName ? `Added by ${tx.byName}` : ''].filter(Boolean);
  openSheet(TYPE_LABEL[tx.type], `<div class="list"><div class="row">
      <span class="emoji" aria-hidden="true">${esc((c && c.emoji) || (tx.type === 'income' ? '💰' : tx.type === 'saving' ? '🏦' : '•'))}</span>
      <span class="row-main"><span class="row-top"><span class="name" style="white-space:normal">${esc(tx.note || (c ? c.name : 'Uncategorised'))}</span>
        <span class="amt ${tx.type === 'income' ? 'inc' : ''}">${tx.type === 'income' ? '+' : '−'}${fmt(tx.amount)}</span></span>
      ${facts.map((x) => `<span class="row-sub" style="white-space:normal">${esc(x)}</span>`).join('')}</span></div></div>
    ${commentsBlock(tx)}`);
}

// A guest's expense goes through the database, which checks that the guest may add it.
async function guestSaveTx(tx, existing) {
  try {
    await api('/rest/v1/rpc/guest_save_expense', { method: 'POST', body: { p_profile: sync.profile.id, p_tx: tx } });
    closeSheet(); toast(existing ? 'Saved' : 'Expense added');
    await syncNow(); render();
  } catch (e) { toast(e instanceof TypeError ? authMessage(e) : 'You can no longer add expenses to this profile.'); syncNow(); }
}
async function guestDeleteTx(id) {
  try {
    await api('/rest/v1/rpc/guest_delete_expense', { method: 'POST', body: { p_profile: sync.profile.id, p_tx_id: id } });
    closeSheet(); toast('Deleted');
    await syncNow(); render();
  } catch (e) { toast(authMessage(e)); }
}

// After a change to profiles or guests: fetch the lists again and show the profile screen.
async function shareDone(msg) {
  try { await loadShare(); } catch (e) { /* the next sync fetches them */ }
  render(); profileSheet();
  if (msg) toast(msg);
}

const shareActions = {
  'profile': () => { profileSheet(); window.scrollTo(0, 0); },
  'edit-me': () => meSheet(),
  'avatar-remove': (el) => { pendingAvatar = ''; const box = $('#sheet-root [data-avatar-preview]'); if (box) box.innerHTML = avatarHtml({ name: myName(), avatar: '' }, 'big'); el.remove(); },
  'new-profile': () => profileNameSheet(null),
  'open-profile': (el) => { const p = allProfiles().find((x) => x.id === el.dataset.id); if (p) profileOptionsSheet(p); },
  'rename-profile': (el) => { const p = allProfiles().find((x) => x.id === el.dataset.id && x.kind === 'own'); if (p) profileNameSheet(p); },
  'switch-profile': (el) => {
    const p = allProfiles().find((x) => x.id === el.dataset.id);
    if (!p) return;
    if (sync.profile && p.id === sync.profile.id) return closeSheet();
    switchProfile(p);
  },
  'del-profile': (el) => {
    const p = allProfiles().find((x) => x.id === el.dataset.id && x.kind === 'own' && !x.main);
    if (!p) return;
    confirmSheet('Delete this profile?', 'Everything in this profile is deleted for good: its income, expenses, bills, savings and plans. Your other profiles are not touched.', 'Delete profile', async () => {
      const on = !!sync.profile && sync.profile.id === p.id;
      try {
        if (on) { clearTimeout(pushTimer); if (syncing) await syncing; }
        await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(p.id)}`, { method: 'DELETE' });
        if (!on) return shareDone('Deleted');
        sync.dirty = false; saveSync();
        const main = mainProfile();
        if (main) await switchProfile(main); else { sync.profile = null; sync.rev = -1; saveSync(); await syncNow(); }
      } catch (e) { toast(authMessage(e)); }
    });
  },
  'leave-profile': (el) => {
    const g = share.guestOf.find((x) => x.profile_id === el.dataset.id);
    if (!g) return;
    confirmSheet('Leave this profile?', 'You will no longer see it. The owner can invite you again.', 'Leave', async () => {
      const on = !!sync.profile && sync.profile.id === g.profile_id;
      try {
        await api(`/rest/v1/profile_guests?id=eq.${encodeURIComponent(g.id)}`, { method: 'DELETE' });
        if (!on) return shareDone('You left the profile');
        // The next sync finds the profile gone and goes back to the person's own.
        quietLeave = true;
        closeSheet();
        await syncNow();
      } catch (e) { toast(authMessage(e)); }
    });
  },
  'invite-guest': () => inviteSheet(),
  'invite-share': async (el) => {
    const text = tr(`I invited you to my profile in FETA, the family expense tracker. Open ${APP_URL} and create an account or sign in with ${el.dataset.id}. Then tap your picture at the top of Home and accept the invitation.`);
    if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* closed without sending */ } return; }
    location.href = `mailto:${encodeURIComponent(el.dataset.id)}?subject=${encodeURIComponent('FETA')}&body=${encodeURIComponent(text)}`;
  },
  'invite-accept': async (el) => {
    try { await api('/rest/v1/rpc/accept_invite', { method: 'POST', body: { p_id: el.dataset.id } }); await shareDone('Invitation accepted. The profile is in your list.'); }
    catch (e) { toast(authMessage(e)); }
  },
  'invite-decline': async (el) => {
    try { await api(`/rest/v1/profile_guests?id=eq.${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' }); await shareDone('Invitation declined'); }
    catch (e) { toast(authMessage(e)); }
  },
  'open-guest': (el) => { const g = find(share.guests, el); if (g) guestSheet(g); },
  'guest-role': async (el) => {
    const g = share.guests.find((x) => x.id === openGuestId);
    if (!g) return;
    try {
      await api(`/rest/v1/profile_guests?id=eq.${encodeURIComponent(g.id)}`, { method: 'PATCH', body: { role: el.dataset.id === 'add' ? 'add' : 'view' } });
      await loadShare();
      const now = share.guests.find((x) => x.id === openGuestId);
      if (now) guestSheet(now);
      toast('Saved');
    } catch (e) { toast(authMessage(e)); }
  },
  'guest-remove': () => {
    const g = share.guests.find((x) => x.id === openGuestId);
    if (!g) return;
    confirmSheet(g.status === 'accepted' ? 'Remove this guest?' : 'Cancel the invitation?', `${g.email} will no longer be able to open this profile.`, g.status === 'accepted' ? 'Remove guest' : 'Cancel invitation', async () => {
      try { await api(`/rest/v1/profile_guests?id=eq.${encodeURIComponent(g.id)}`, { method: 'DELETE' }); await shareDone(g.status === 'accepted' ? 'Guest removed' : 'Invitation cancelled'); }
      catch (e) { toast(authMessage(e)); }
    });
  },
  'comment-reply': (el) => {
    const form = $('#sheet-root [data-form="comment"]');
    if (!form) return;
    form.elements.parent.value = el.dataset.id;
    const note = $('[data-replying]', form);
    note.innerHTML = `<span>${esc(`Replying to ${el.dataset.name || 'this comment'}`)}</span> <button type="button" class="link" data-act="comment-cancel">Cancel</button>`;
    note.classList.remove('hidden');
    form.elements.body.focus();
  },
  'comment-cancel': () => {
    const form = $('#sheet-root [data-form="comment"]');
    if (!form) return;
    form.elements.parent.value = '';
    $('[data-replying]', form).classList.add('hidden');
  },
  'comment-del': async (el) => {
    try {
      await api(`/rest/v1/comments?id=eq.${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' });
      // Its replies are deleted with it.
      share.comments = share.comments.filter((c) => c.id !== el.dataset.id && c.parent_id !== el.dataset.id);
      saveShare();
      render(); reopenTx(el.dataset.tx);
    } catch (e) { toast(authMessage(e)); }
  }
};

// What a guest may tap. Everything else that changes the profile is refused, whatever is on screen.
const GUEST_ACTS = new Set(['tab', 'setup-open', 'setup-back', 'notices', 'notices-back', 'notice-go', 'close-sheet', 'confirm-yes', 'month', 'month-now', 'home-mode', 'home-year', 'home-month',
  'year-report', 'filter', 'add-tx', 'edit-tx', 'del-tx', 'rep-period', 'rep-measure', 'rep-nav', 'rep-goto', 'rep-cat', 'bar', 'rep-share', 'rep-download',
  'sign-out', 'sync-now', 'android-update', 'android-later', 'android-download', 'android-install', 'update-app', 'toggle-pass',
  'profile', 'edit-me', 'avatar-remove', 'new-profile', 'open-profile', 'rename-profile', 'del-profile', 'switch-profile', 'leave-profile', 'invite-accept', 'invite-decline',
  'comment-reply', 'comment-cancel', 'comment-del']);
const GUEST_FORMS = new Set(['tx', 'comment', 'me', 'profilename']);

/* ---------- Events ---------- */

const find = (list, el) => list.find((x) => x.id === el.dataset.id);
const remove = (key, id) => { state[key] = state[key].filter((x) => x.id !== id); };

const actions = {
  'tab': (el) => { ui.tab = el.dataset.id; ui.bar = null; ui.setup = null; ui.page = null; render(); window.scrollTo(0, 0); },
  'setup-open': (el) => { if (isGuest() && el.dataset.id !== 'profile') return; ui.setup = el.dataset.id; nextSlide = 'from-right'; render(); window.scrollTo(0, 0); },
  'setup-back': () => { ui.setup = null; nextSlide = 'from-left'; render(); window.scrollTo(0, 0); },
  // Using the app without an account is switched off: the welcome screen no longer offers it. The action is kept for the tests.
  'start': () => { startApp(); save(); render(); },
  'welcome-points': () => welcomePointsSheet(),
  'notices': () => openNotices(),
  'notices-back': () => { ui.page = null; nextSlide = 'from-left'; render(); window.scrollTo(0, 0); },
  'notice-go': (el) => window.fetaGo(el.dataset.id, el.dataset.month, el.dataset.tx),
  'notify-ask': () => { try { android.notifyAsk(); } catch (e) { toast('Open your phone’s settings and allow notifications for FETA.'); } },
  'android-update': () => androidUpdateSheet(),
  'android-later': () => { updateUi.later = true; closeSheet(); render(); },
  'android-download': () => {
    if (!androidUpdate) return closeSheet();
    // An older Android app cannot download by itself: open the file in the phone's browser, as before.
    if (!androidInApp()) { closeSheet(); location.href = androidUpdate.url; return; }
    let started = false;
    try { started = !!android.updateStart(androidUpdate.url); } catch (e) { /* handled below */ }
    if (started) { updateUi.stage = 'downloading'; updateUi.pct = 0; updateUi.error = ''; }
    else { updateUi.stage = 'offer'; updateUi.error = 'The download could not start. Try again.'; }
    androidUpdateSheet();
  },
  'android-install': () => {
    let ok = false;
    try { ok = !!android.updateInstall(); } catch (e) { /* handled below */ }
    if (ok) return closeSheet();
    updateUi.stage = 'offer'; updateUi.error = 'The update file is missing. Download it again.';
    androidUpdateSheet();
  },
  'update-app': async () => {
    toast('Getting the latest version…');
    try {
      if (navigator.serviceWorker) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
      if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } catch (e) { /* reload anyway */ }
    location.reload();
  },
  'toggle-pass': (el) => {
    const input = el.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.textContent = show ? 'Hide' : 'Show';
    el.setAttribute('aria-pressed', String(show));
    el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    input.focus();
  },
  'open-account': (el) => accountSheet(el.dataset.id === 'signin' ? 'signin' : 'signup'),
  'forgot': async () => {
    const email = ($('#sheet-root [name="email"]').value || '').trim().toLowerCase();
    if (!validEmail(email)) return toast('Type your email address first, then tap “Forgot password?”.');
    try {
      await sb('/auth/v1/recover', { method: 'POST', body: { email } });
      openSheet('Check your email', `<p>If ${esc(email)} has an account, we sent it a link to set a new password.</p><button class="btn ghost" data-act="close-sheet">Close</button>`);
      centerSheet();
    } catch (e) { toast(authMessage(e)); }
  },
  'sync-now': async () => { await syncNow(); render(); toast(sync.error ? syncStatus() : 'Synced'); },
  'sync-choose': async (el) => {
    const remote = pendingRemote;
    if (!remote) return closeSheet();
    pendingRemote = null;
    if (el.dataset.id === 'remote') { adopt(remote); sync.dirty = false; }
    else {
      if (el.dataset.id === 'merge') { state = mergeStates(state, remote); fmtCache = {}; }
      saveLocal(); sync.dirty = true;
    }
    saveSync(); closeSheet(); render();
    await syncNow();
    toast(sync.error ? syncStatus() : 'Synced');
    offerLeftover();
  },
  'leftover': (el) => {
    const left = readLeftover();
    dropLeftover();
    if (left && el.dataset.id === 'add') { state = mergeStates(state, left); fmtCache = {}; save(); toast('Added to your account'); }
    closeSheet(); render();
  },
  // Signing out removes the account's data from this device. Anything not yet saved online is sent first.
  'sign-out': () => confirmSheet('Sign out?', 'Your data stays safe in your account and is removed from this device. Sign in again to get it back.', 'Sign out', async () => {
    if (sync.dirty) {
      toast('Saving your latest changes…');
      await syncNow();
    }
    if (sync.dirty) {
      return confirmSheet('Some changes are not saved online', 'Your latest changes could not be saved to your account, probably because there is no internet. They are kept aside on this device, and you are asked about them when you sign in again.',
        'Sign out anyway', signOutNow);
    }
    signOutNow();
  }),
  'close-sheet': () => closeSheet(),
  'confirm-yes': () => { const fn = pendingConfirm; closeSheet(); if (fn) fn(); },
  'month': (el) => { ui.month = addMonths(ui.month, Number(el.dataset.d)); dateSlide(Number(el.dataset.d)); render(); },
  'month-now': () => { dateSlide(curYM() > ui.month ? 1 : curYM() < ui.month ? -1 : 0); ui.month = curYM(); render(); },
  'home-mode': (el) => { ui.home = el.dataset.id === 'year' ? 'year' : 'month'; render(); window.scrollTo(0, 0); },
  'home-year': (el) => { ui.month = `${Number(ui.month.slice(0, 4)) + Number(el.dataset.d)}${ui.month.slice(4)}`; dateSlide(Number(el.dataset.d)); render(); },
  'home-month': (el) => { if (isYM(el.dataset.id)) { ui.month = el.dataset.id; ui.home = 'month'; render(); window.scrollTo(0, 0); } },
  'year-report': () => { ui.tab = 'reports'; ui.rep.period = 'year'; ui.rep.cursor = `${ui.month.slice(0, 4)}-01-01`; ui.bar = null; render(); window.scrollTo(0, 0); },
  'filter': (el) => { ui.filter = el.dataset.id; render(); },
  'open-owed': () => { ui.tab = 'planner'; ui.planner = debtTotal('receivable') ? 'receivable' : 'payable'; render(); window.scrollTo(0, 0); },

  'add-tx': () => txSheet(null, isGuest() ? { type: 'expense', lockType: true } : ui.tab === 'reports' ? { type: ui.rep.measure, lockType: true } : {}),
  'add-saving': () => txSheet(null, { type: 'saving', lockType: true }),
  'save-year': (el) => { ui.saveYear = String(Number(ui.saveYear) + Number(el.dataset.d)); ui.bar = null; dateSlide(Number(el.dataset.d)); render(); },
  'fund': (el) => {
    const id = el.dataset.id;
    const rows = state.transactions.filter((t) => t.type === 'saving' && (cat(t.categoryId) ? t.categoryId : '') === id);
    const c = cat(id);
    const had = (c && c.opening) || 0;
    const saved = r3(sum(rows, (t) => t.amount) + had);
    openSheet(catLabel(c), `<p>${fmt(saved)} saved in total${c && c.target > 0 ? `<br>${targetLine(saved, c.target)}` : ''}</p>
      <div class="list">${c ? `${had ? `<div class="row"><span class="row-main">
        <span class="row-top"><span class="name">Already saved</span><span class="amt">${fmt(had)}</span></span>
        <span class="row-sub">Saved before you started using the app.</span></span></div>` : ''}
        <button class="row" data-act="edit-cat" data-id="${id}"><span class="row-main">
        <span class="row-top"><span class="name">Target</span><span class="amt">${c.target > 0 ? fmt(c.target) : 'Not set'}</span></span>
        <span class="row-sub">${c.target > 0 ? 'The amount you want to reach. Tap to change.' : 'Tap to set an amount you want to reach.'}</span></span></button>` : ''}${sortedTx(rows).map((t) => `<button class="row" data-act="edit-tx" data-id="${t.id}"><span class="row-main">
        <span class="row-top"><span class="name">${fmtDay(t.date)}, ${t.date.slice(0, 4)}</span><span class="amt">${fmt(t.amount)}</span></span>
        ${t.note ? `<span class="row-sub">${esc(t.note)}</span>` : ''}</span></button>`).join('')}</div>
      <button class="btn" data-act="add-saving-to" data-id="${id}">Add savings to this</button>`);
  },
  'add-saving-to': (el) => txSheet(null, { type: 'saving', lockType: true, categoryId: el.dataset.id }),
  'edit-tx': (el) => { const t = find(state.transactions, el); if (t) txSheet(t); },
  'del-tx': (el) => { if (isGuest()) return guestDeleteTx(el.dataset.id); remove('transactions', el.dataset.id); done(); toast('Deleted'); },

  'due': (el) => { const it = dueItems(ui.month).find((x) => x.key === el.dataset.key); if (it) openDue(it, ui.month); },
  'emi-month': (el) => {
    const ym = el.dataset.period;
    const it = isYM(ym) && dueItems(ym).find((x) => x.key === 'emi:' + el.dataset.id);
    if (it) openDue(it, ym);
  },
  'bills': (el) => { ui.bills = el.dataset.id; render(); window.scrollTo(0, 0); },
  'horizon': (el) => { ui.horizon = Number(el.dataset.id) || 12; render(); },
  'goto-month': (el) => { if (isYM(el.dataset.id)) { ui.month = el.dataset.id; ui.tab = 'home'; ui.home = 'month'; render(); window.scrollTo(0, 0); } },
  'skip-due': (el) => {
    const r = find(state.recurring, el);
    if (r && isPeriod(el.dataset.period) && !r.skips.includes(el.dataset.period)) r.skips.push(el.dataset.period);
    done(); toast(isDate(el.dataset.period) ? 'Skipped for this week' : 'Skipped for this month');
  },

  'add-rec': () => recSheet(null),
  'add-bill': () => (ui.bills === 'emi' ? emiSheet(null) : recSheet(null)),
  // Turns a one-off entry into a bill that repeats every month, and counts this entry as that month's payment.
  'tx-to-bill': (el) => {
    const t = find(state.transactions, el);
    if (!t || t.recurringId || t.emiId) return;
    const c = cat(t.categoryId);
    const name = t.note || (c ? c.name : 'Bill');
    const r = { id: uid(), type: t.type, name, amount: t.amount, categoryId: t.categoryId, frequency: 'monthly', day: Number(t.date.slice(8, 10)),
      month: Number(t.date.slice(5, 7)), start: t.date.slice(0, 7), end: '', paused: false, skips: [], note: '' };
    state.recurring.push(r);
    Object.assign(t, { recurringId: r.id, period: t.date.slice(0, 7), note: name });
    ui.tab = 'home'; ui.home = 'month'; ui.month = t.date.slice(0, 7);
    done(); window.scrollTo(0, 0);
    toast('Now a monthly bill. It is marked paid for this month.');
  },
  'edit-rec': (el) => { const r = find(state.recurring, el); if (r) recSheet(r); },
  'rec-change': (el) => { const r = find(state.recurring, el); if (r) recChangeSheet(r, el.dataset.dir); },
  'del-rec-change': (el) => {
    const r = find(state.recurring, el);
    if (!r) return;
    r.changes = (r.changes || []).filter((c) => c.from !== el.dataset.from);
    save(); render(); recSheet(r);
  },
  'del-rec': (el) => confirmSheet('Delete this repeating item?', 'It stops appearing under “To pay”. Payments you already recorded stay in your history.', 'Delete', () => { remove('recurring', el.dataset.id); save(); render(); }),

  'add-emi': () => emiSheet(null),
  'open-emi': (el) => { const e = find(state.emis, el); if (e) emiDetailSheet(e); },
  'edit-emi': (el) => { const e = find(state.emis, el); if (e) emiSheet(e); },
  'del-emi': (el) => confirmSheet('Delete this EMI?', 'It stops repeating under “To pay”. Instalments you already recorded stay in your history as expenses.', 'Delete', () => { remove('emis', el.dataset.id); save(); render(); }),

  'planner': (el) => { ui.planner = el.dataset.id; render(); },
  'add-plan': () => planSheet(null),
  'edit-plan': (el) => { const p = find(state.plans, el); if (p) planSheet(p); },
  'del-plan': (el) => { remove('plans', el.dataset.id); done(); },
  'plan-save': (el) => {
    const p = find(state.plans, el);
    if (!p) return;
    const fund = ensurePlanFund(p);
    save();
    txSheet(null, { title: `Save for: ${p.name}`, type: 'saving', lockType: true, categoryId: fund.id });
  },
  'plan-bought': (el) => {
    const p = find(state.plans, el);
    if (!p) return;
    const fund = planFund(p);
    const saved = fund && !fund.used ? savedIn(fund) : 0;
    txSheet(null, { title: `Bought: ${p.name}`, type: 'expense', amount: p.price, note: p.name, planId: p.id, date: today(),
      hint: saved > 0 ? `The ${fmt(saved)} you saved for this is added to the same day as income “From savings”, so it is not counted against this month twice.` : '' });
  },

  'add-debt': () => debtSheet(null, ui.planner === 'payable' ? 'payable' : 'receivable'),
  'open-debt': (el) => { const d = find(state.debts, el); if (d) debtDetailSheet(d); },
  'edit-debt': (el) => { const d = find(state.debts, el); if (d) debtSheet(d); },
  // Settling a debt records whatever was still open as received or paid back today.
  'toggle-debt': (el) => {
    const d = find(state.debts, el);
    if (!d) return;
    if (!d.settled && debtLeft(d) > 0) payDebt(d, debtLeft(d), today());
    d.settled = !d.settled;
    done();
  },
  'del-debt': (el) => confirmSheet('Delete this entry?', 'It is removed along with its payment history.', 'Delete', () => { remove('debts', el.dataset.id); save(); render(); }),
  'del-debtpay': (el) => {
    const d = find(state.debts, el);
    if (!d) return;
    // Removing a payment also takes back the income or expense it added.
    const gone = d.payments.find((p) => p.id === el.dataset.pay);
    if (gone && gone.txId) remove('transactions', gone.txId);
    d.payments = d.payments.filter((p) => p.id !== el.dataset.pay);
    save(); render(); debtDetailSheet(d);
  },

  'add-cat': (el) => catSheet(null, el.dataset.type, el.dataset.group),
  'edit-cat': (el) => { const c = cat(el.dataset.id); if (c) catSheet(c); },
  'leftover-open': (el) => { if (isYM(el.dataset.id)) leftoverSheet(el.dataset.id); },
  'leftover-do': (el) => {
    const ym = el.dataset.id;
    const how = el.dataset.how;
    const amount = isYM(ym) ? carryInto(addMonths(ym, 1)) : 0;
    if (!(amount > 0) || !['carry', 'expense', 'saving'].includes(how)) return closeSheet();
    const entry = (type, categoryId) => state.transactions.push({ id: uid(), created: Date.now(), type, amount, categoryId, date: dateIn(ym, 31),
      note: 'Left over at the end of the month', recurringId: '', emiId: '', planId: '', period: '' });
    if (how === 'expense') {
      let c = state.categories.find((x) => x.type === 'expense' && isOthers(x));
      if (!c) { c = { id: uid(), type: 'expense', group: 'primary', name: 'Others', emoji: '📦', budget: 0, opening: 0, target: 0 }; state.categories.push(c); }
      entry('expense', c.id);
    } else if (how === 'saving') {
      const pick = $('#sheet-root [name="leftoverFund"]');
      const c = pick && cat(pick.value);
      if (!c || c.type !== 'saving') return;
      entry('saving', c.id);
    }
    if (!state.leftover) state.leftover = {};
    state.leftover[ym] = how;
    done();
    toast(how === 'carry' ? 'Carried over' : how === 'expense' ? 'Added as an expense' : 'Added to savings');
  },
  // Deleting a category moves everything recorded in it (transactions, bills, EMIs, money already in a savings fund)
  // to the "Others" category of the same kind, which is created if there is none yet.
  'del-cat': (el) => {
    const c = cat(el.dataset.id);
    if (!c || isOthers(c)) return;
    const lists = ['transactions', 'recurring', 'emis'];
    const n = sum(lists, (k) => state[k].filter((x) => x.categoryId === c.id).length);
    const kept = state.categories.find((x) => x.id !== c.id && x.type === c.type && isOthers(x));
    const go = () => {
      if (n || c.opening) {
        let to = kept;
        if (!to) { to = { id: uid(), type: c.type, group: c.type === 'income' ? 'secondary' : 'primary', name: 'Others', emoji: '📦', budget: 0, opening: 0, target: 0 }; state.categories.push(to); }
        for (const k of lists) for (const x of state[k]) if (x.categoryId === c.id) x.categoryId = to.id;
        if (c.opening) to.opening = r3((to.opening || 0) + c.opening);
      }
      remove('categories', c.id); save(); render(); toast('Deleted');
    };
    if (n || c.opening) confirmSheet('Delete this category?', `Everything recorded in ${c.name} moves to “${kept ? kept.name : 'Others'}”. Nothing is lost.`, 'Delete category', go);
    else { closeSheet(); go(); }
  },

  'rep-period': (el) => { ui.rep.period = el.dataset.id; ui.bar = null; render(); },
  'rep-measure': (el) => { ui.rep.measure = el.dataset.id; ui.bar = null; render(); },
  'rep-nav': (el) => {
    const d = Number(el.dataset.d);
    const { period, cursor } = ui.rep;
    ui.rep.cursor = period === 'day' ? addDays(cursor, d) : period === 'week' ? addDays(cursor, 7 * d) : period === 'month' ? addMonths(cursor.slice(0, 7), d) + '-01' : `${Number(cursor.slice(0, 4)) + d}-01-01`;
    ui.bar = null; dateSlide(d); render();
  },
  'rep-goto': (el) => { ui.rep.period = 'month'; ui.rep.cursor = el.dataset.id; ui.bar = null; render(); window.scrollTo(0, 0); },
  'rep-cat': (el) => {
    const { label, list } = repScope();
    const id = el.dataset.id;
    const rows = list.filter((t) => t.type === ui.rep.measure && (cat(t.categoryId) ? t.categoryId : '') === id);
    openSheet(catLabel(cat(id)), `<p>${fmt(sum(rows, (t) => t.amount))} in ${esc(label)} · ${plural(rows.length, 'entry').replace('entrys', 'entries')}</p>
      <div class="list">${sortedTx(rows).map((t) => `<button class="row" data-act="edit-tx" data-id="${t.id}"><span class="row-main">
        <span class="row-top"><span class="name">${esc(t.note || fmtDay(t.date))}</span><span class="amt">${fmt(t.amount)}</span></span>
        ${t.note ? `<span class="row-sub">${fmtDay(t.date)}</span>` : ''}</span></button>`).join('')}</div>`);
  },
  'bar': (el) => { ui.bar = Number(el.dataset.id); render(); },
  'rep-share': () => sendReport('share'),
  'rep-download': () => sendReport('download'),
  'location-ask': () => { try { android.locationAsk(); } catch (e) { toast('Open your phone’s settings and allow location for FETA.'); } },

  'backup': () => shareOrDownload(`feta-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json'),
  'export-csv': () => exportCsv(),
};
Object.assign(actions, shareActions);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (isGuest() && !GUEST_ACTS.has(el.dataset.act)) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el);
});

// Numbers are typed with the digits 0-9 only. Digits of another script (Bengali, Hindi, Arabic...) are not read as
// numbers, and a mix such as "1২০০" would be cut short, so the person is told as they type and nothing is saved.
const NUMBER_BOXES = 'input[inputmode="decimal"], input[inputmode="numeric"]';
const USE_ENGLISH_DIGITS = 'Please use English numbers (0-9).';
const otherDigits = (v) => /[^\d\P{Nd}]/u.test(String(v ?? ''));

const submitters = { auth: submitAuth, newpass: submitNewPass, tx: submitTx, cat: submitCat, rec: submitRec, recchange: submitRecChange, emi: submitEmi, plan: submitPlan, debt: submitDebt, debtpay: submitDebtPay,
  me: submitMe, profilename: submitProfileName, invite: submitInvite, comment: submitComment };
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (isGuest() && !GUEST_FORMS.has(form.dataset.form)) return;
  const odd = [...form.querySelectorAll(NUMBER_BOXES)].find((box) => otherDigits(box.value));
  if (odd) { if (!odd.closest('.hidden')) odd.focus(); return toast(USE_ENGLISH_DIGITS, 5000); }
  submitters[form.dataset.form](Object.fromEntries(new FormData(form)), form);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'avatar-file') { if (PICTURES && el.files[0]) pickAvatar(el.files[0]); el.value = ''; return; }
  // A guest cannot change the owner's settings.
  if (isGuest() && (el.dataset.notify || el.dataset.setting || el.id === 'restore-file')) return;
  const form = el.closest('[data-form]');
  if (form && form.dataset.form === 'tx' && el.name === 'categoryId') {
    const box = $('[data-newcat]', form);
    box.classList.toggle('hidden', el.value !== NEW_CAT);
    if (el.value === NEW_CAT) form.elements.newCatName.focus();
  } else if (form && el.name === 'type' && el.type === 'radio') {
    form.elements.categoryId.innerHTML = catOptions(el.value) + (form.dataset.form === 'tx' ? NEW_CAT_OPTION : '');
    const box = $('[data-newcat]', form);
    if (box) box.classList.add('hidden');
    const label = $('[data-note-label]', form);
    if (label) { label.textContent = NOTE_LABEL[el.value]; form.elements.note.placeholder = NOTE_HINT[el.value]; }
  } else if (form && form.dataset.form === 'rec' && el.name === 'frequency') {
    syncRecForm(form);
  } else if (form && form.dataset.form === 'emi') {
    syncEmiForm(form);
  } else if (form && form.dataset.form === 'recchange') {
    syncRecChangeForm(form);
  } else if (el.hasAttribute('data-lang')) {
    setLang(el.value);
    render();
    queueNotify();
  } else if (el.dataset.notify) {
    if (!state.settings.notify) state.settings.notify = {};
    if (el.checked) delete state.settings.notify[el.dataset.notify]; else state.settings.notify[el.dataset.notify] = false;
    save(); render();
  } else if (el.dataset.setting) {
    state.settings[el.dataset.setting] = el.value;
    fmtCache = {};
    save(); applyTheme(); render();
  } else if (el.id === 'restore-file' && el.files[0]) {
    restoreFrom(el.files[0]);
    el.value = '';
  }
});

document.addEventListener('input', (e) => {
  if (e.target.matches && e.target.matches(NUMBER_BOXES) && otherDigits(e.target.value)) toast(USE_ENGLISH_DIGITS, 5000);
  const form = e.target.closest('[data-form="emi"]');
  if (form) return syncEmiForm(form);
  const changeForm = e.target.closest('[data-form="recchange"]');
  if (changeForm) return syncRecChangeForm(changeForm);
  if (e.target.id !== 'tx-search') return;
  ui.search = e.target.value;
  $('#tx-list').innerHTML = homeListHtml();
});

// While a pop-up is open, a finger drag must not move the page behind it. iPhones ignore the page being marked
// as not scrollable, so the drag itself is refused unless it scrolls the pop-up, and the pop-up has room left to scroll.
let dragY = 0;
document.addEventListener('touchstart', (e) => { if (e.touches.length === 1) dragY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', (e) => {
  const root = $('#sheet-root');
  if (!root.firstChild || !e.cancelable) return;
  const dy = e.touches[0].clientY - dragY;
  for (let el = e.target; el && el !== root && el.nodeType === 1; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1 || !/auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
    const atTop = el.scrollTop <= 0;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (root.contains(el) && !((dy > 0 && atTop) || (dy < 0 && atEnd))) return;
    break;
  }
  e.preventDefault();
}, { passive: false });

// The on-screen keyboard. On an iPhone it slides over the bottom of the screen without making the page any shorter,
// so a pop-up would sit behind it with its typing fields hidden. While the keyboard is up, the pop-up is lifted to
// sit on top of it and made no taller than the space that is left, and the field being typed in is scrolled into view.
const viewport = window.visualViewport;
function showTyping() {
  const sheet = $('#sheet-root .sheet');
  const el = document.activeElement;
  if (!sheet || !el || !sheet.contains(el) || !el.matches('input, select, textarea')) return;
  const box = sheet.getBoundingClientRect();
  const field = el.getBoundingClientRect();
  // The pop-up's title stays at its top, so a field must clear that too.
  const head = 64;
  if (field.bottom > box.bottom - 14) sheet.scrollTop += field.bottom - box.bottom + 14;
  else if (field.top < box.top + head) sheet.scrollTop -= box.top + head - field.top;
}
function fitToKeyboard() {
  const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  const keyboard = covered > 80 ? covered : 0;
  const root = document.documentElement;
  root.classList.toggle('kb-open', keyboard > 0);
  root.style.setProperty('--kb', `${keyboard}px`);
  root.style.setProperty('--vvh', `${viewport.height}px`);
  root.style.setProperty('--vvtop', `${viewport.offsetTop}px`);
  if (keyboard) { showTyping(); requestAnimationFrame(showTyping); }
}
if (viewport) {
  viewport.addEventListener('resize', fitToKeyboard);
  viewport.addEventListener('scroll', fitToKeyboard);
}
// Moving from one field to the next, with the keyboard up or not, keeps the field in view inside the pop-up.
document.addEventListener('focusin', () => setTimeout(showTyping, 80));

// Pulling the page down from its top syncs with the account, like refreshing in other apps. The page itself comes
// down with the finger and a round arrow shows in the gap above it; let go once it has come far enough and the page
// stays down a little while the arrow spins, then goes back up when the sync is done.
const puller = document.createElement('div');
puller.className = 'ptr';
puller.setAttribute('aria-hidden', 'true');
puller.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>';
document.body.append(puller);
const PULL_ENOUGH = 60;
let pull = null;
let refreshing = false;
function showPuller(depth) {
  // The screen's content is moved by this much (see .view in the styles); the arrow sits in the middle of the gap.
  document.documentElement.style.setProperty('--pull', `${depth}px`);
  puller.style.transform = `translateY(${depth / 2 - 27}px)`;
  puller.style.opacity = String(Math.min(1, depth / 40));
  puller.firstChild.style.transform = `rotate(${depth * 4}deg)`;
  puller.classList.toggle('ready', depth >= PULL_ENOUGH);
}
async function pullRefresh() {
  refreshing = true;
  puller.classList.add('back', 'spin');
  document.documentElement.classList.add('pull-back');
  showPuller(64);
  puller.firstChild.style.transform = '';
  await Promise.all([syncNow(), new Promise((r) => setTimeout(r, 700))]);
  if (!$('#sheet-root').firstChild) render();
  // The screen was just drawn again. It has to be seen held down first, or it would jump back up instead of easing back.
  const view = $('.view');
  if (view) void view.offsetHeight;
  puller.classList.remove('spin');
  showPuller(0);
  refreshing = false;
  if (sync.error) toast(syncStatus());
}
document.addEventListener('touchstart', (e) => {
  const usable = !refreshing && e.touches.length === 1 && window.scrollY <= 0 && !$('#sheet-root').firstChild && state.settings.started && !!sync.session;
  pull = usable ? { x: e.touches[0].clientX, y: e.touches[0].clientY, depth: 0, on: false } : null;
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!pull) return;
  const dx = e.touches[0].clientX - pull.x;
  const dy = e.touches[0].clientY - pull.y;
  if (!pull.on) {
    // Only a clear downward drag that starts at the very top counts; scrolling up or sideways is left alone.
    if (dy < -4 || Math.abs(dx) > 14 || window.scrollY > 0) { pull = null; return; }
    if (dy < 10) return;
    pull.on = true;
    puller.classList.remove('back');
    document.documentElement.classList.remove('pull-back');
  }
  pull.depth = Math.max(0, Math.min(130, dy * 0.5));
  showPuller(pull.depth);
}, { passive: true });
const endPull = () => {
  if (!pull || !pull.on) { pull = null; return; }
  const far = pull.depth >= PULL_ENOUGH;
  pull = null;
  puller.classList.add('back');
  document.documentElement.classList.add('pull-back');
  if (far) pullRefresh(); else showPuller(0);
};
document.addEventListener('touchend', endPull, { passive: true });
document.addEventListener('touchcancel', () => { if (pull && pull.on) { puller.classList.add('back'); document.documentElement.classList.add('pull-back'); showPuller(0); } pull = null; }, { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#sheet-root').firstChild) closeSheet();
});

// Called by the Android app when the phone's Back button is pressed. Returns true if FETA used it.
window.fetaBack = () => {
  if ($('#sheet-root').firstChild) { closeSheet(); return true; }
  if (state.settings.started && ui.page) { ui.page = null; render(); window.scrollTo(0, 0); return true; }
  if (state.settings.started && ui.tab === 'more' && ui.setup) { ui.setup = null; render(); window.scrollTo(0, 0); return true; }
  if (state.settings.started && ui.tab !== 'home') { ui.tab = 'home'; ui.bar = null; render(); window.scrollTo(0, 0); return true; }
  return false;
};

/* ---------- Start ---------- */

// The app is used with an account. A device that is not signed in but is past the welcome screen (it was used without an
// account, an older version left data behind, or the sign-in expired) goes back to the welcome screen.
// Whatever it holds is set aside and offered back after signing in. FetaAllowLocal is only set by the local test page.
(() => {
  if (sync.session || window.FetaAllowLocal) return;
  let wasSignedIn = false;
  try { wasSignedIn = localStorage.getItem(SYNC_KEY) != null; } catch (e) { /* ignore */ }
  if (!wasSignedIn && !state.settings.started) return;
  setAside();
  resetState();
  try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignore */ }
})();

if (state.settings.started && !isGuest() && !state.settings.carryFrom) { state.settings.carryFrom = curYM(); save(); }

document.documentElement.lang = lang;
watchLanguage();
applyTheme();
render();

handleAuthLink().then((handled) => { if (!handled) syncNow(); });
// The Android app asks once, the first time it is used, whether it may show notifications.
try { if (android && android.notifyAskFirst && state.settings.started) android.notifyAskFirst(); } catch (e) { /* older app */ }
checkAndroidUpdate();
checkReleased();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncNow(); checkAndroidUpdate(); checkReleased(); } });
window.addEventListener('online', () => syncNow());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  // When a newer version takes over, reload once so the screen shows it (never while a form is open).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || $('#sheet-root').firstChild) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // A home-screen app can stay open in the background for days, so look for an update each time it comes back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

})();
