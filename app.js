(() => {
'use strict';

/* ---------- Constants ---------- */

// Change this with every release, together with VERSION in sw.js.
const APP_VERSION = '31';
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
  ['saving', '', 'General savings', '🏦'], ['saving', '', 'Children’s fund', '🧸'], ['saving', '', 'Emergency fund', '🛟']
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
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());
const isYM = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const monthsBetween = (a, b) => (b.slice(0, 4) - a.slice(0, 4)) * 12 + (b.slice(5, 7) - a.slice(5, 7));
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dateIn = (ym, day) => `${ym}-${pad(Math.min(Math.max(1, day), daysInMonth(ym)))}`;
const ymLabel = (ym) => toDate(ym + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const ymShort = (ym) => toDate(ym + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const monthNameOf = (m) => new Date(2024, m - 1, 1).toLocaleDateString(undefined, { month: 'long' });
const fmtDay = (s) => toDate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDayLong = (s) => toDate(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (s) => toDate(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

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
    settings: { currency: guessCurrency(), theme: 'auto', started: false },
    categories: [], transactions: [], recurring: [], emis: [], plans: [], debts: []
  };
}

const validState = (s) => s && typeof s === 'object' && s.version === 2 && s.settings && typeof s.settings === 'object' && Array.isArray(s.transactions);

// Rebuild stored or imported data field by field, so a damaged or hand-edited file cannot break the app.
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
  out.categories = arr(s.categories).map((c) => ({
    id: c.id, type: type(c.type), group: c.group === 'secondary' ? 'secondary' : 'primary',
    name: str(c.name, 40) || 'Category', emoji: str(c.emoji, 8), budget: pos(c.budget),
    // Money that was already in a savings fund before the app was used.
    opening: c.type === 'saving' ? pos(c.opening) : 0,
    // The amount a savings fund is meant to reach.
    target: c.type === 'saving' ? pos(c.target) : 0
  }));
  out.transactions = arr(s.transactions).filter((t) => isDate(t.date)).map((t) => ({
    id: t.id, type: type(t.type), amount: Math.abs(num(t.amount)), categoryId: ref(t.categoryId), date: t.date,
    note: str(t.note, 120), created: num(t.created), recurringId: ref(t.recurringId), emiId: ref(t.emiId),
    planId: ref(t.planId), period: isYM(t.period) ? t.period : ''
  }));
  out.recurring = arr(s.recurring).map((r) => ({
    id: r.id, type: type(r.type), name: str(r.name, 60) || 'Repeating item', amount: pos(r.amount), categoryId: ref(r.categoryId),
    frequency: r.frequency === 'yearly' ? 'yearly' : 'monthly', day: day(r.day), month: Math.min(12, Math.max(1, Math.round(num(r.month)) || 1)),
    start: isYM(r.start) ? r.start : curYM(), end: isYM(r.end) ? r.end : '', paused: !!r.paused,
    skips: Array.isArray(r.skips) ? r.skips.filter(isYM) : [], note: str(r.note, 120),
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
    id: p.id, name: str(p.name, 60) || 'Plan', price: pos(p.price), target: isYM(p.target) ? p.target : '',
    priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium', note: str(p.note, 120), done: !!p.done
  }));
  out.debts = arr(s.debts).map((d) => ({
    id: d.id, kind: d.kind === 'payable' ? 'payable' : 'receivable', person: str(d.person, 60) || 'Someone', amount: pos(d.amount),
    date: isDate(d.date) ? d.date : today(), due: isDate(d.due) ? d.due : '', note: str(d.note, 120), settled: !!d.settled,
    payments: arr(d.payments).filter((p) => isDate(p.date)).map((p) => ({ id: p.id, amount: pos(p.amount), date: p.date }))
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
  if (!sync.session) return;
  sync.dirty = true;
  saveSync();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 1500);
}

let state = load();
const ui = {
  tab: 'home', home: 'month', saveYear: curYM().slice(0, 4), month: curYM(), filter: 'all', search: '', bar: null, bills: 'month', horizon: 12,
  rep: { period: 'month', cursor: today(), measure: 'expense' },
  planner: 'plans'
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

function loadSync() {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY));
    if (s && typeof s === 'object') return { session: s.session || null, rev: Number(s.rev) || 0, dirty: !!s.dirty, last: s.last || '', error: '' };
  } catch (e) { /* start signed out */ }
  return { session: null, rev: 0, dirty: false, last: '', error: '' };
}
function saveSync() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify({ session: sync.session, rev: sync.rev, dirty: sync.dirty, last: sync.last })); } catch (e) { /* ignore */ }
}

let sync = loadSync();
let changeSeq = 0;
let pushTimer = null;
let syncing = null;
let pendingRemote = null;

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
  sync.session = null; sync.rev = 0; sync.dirty = false; sync.last = ''; sync.error = '';
  pendingRemote = null;
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
  if (token) sb('/auth/v1/logout', { method: 'POST', token }).catch(() => {});
  clearTimeout(pushTimer);
  if (sync.dirty) setAside();
  dropSession();
  try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignore */ }
  resetState();
  Object.assign(ui, { tab: 'home', home: 'month', month: curYM(), filter: 'all', search: '', bar: null, bills: 'month', planner: 'plans' });
  lastTabIndex = null;
  render(); window.scrollTo(0, 0); toast('Signed out');
}

async function freshToken() {
  const s = sync.session;
  if (s.expires_at - Date.now() > 60000) return s.access_token;
  try {
    setSession(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }));
  } catch (e) {
    if (e.status === 400 || e.status === 401 || e.status === 403) { dropSession(); toast('Please sign in again.'); render(); }
    throw e;
  }
  return sync.session.access_token;
}

const hasData = (s) => COLLECTIONS.some((k) => Array.isArray(s[k]) && s[k].length > 0);

async function pullRow() {
  const token = await freshToken();
  const rows = await sb(`/rest/v1/user_data?select=data,rev&user_id=eq.${encodeURIComponent(sync.session.user.id)}`, { token });
  return (rows && rows[0]) || null;
}

// Saves the whole data set as revision baseRev + 1. Returns false if another device saved first.
async function pushRow(baseRev) {
  const token = await freshToken();
  const seq = changeSeq;
  const uid = sync.session.user.id;
  const payload = { data: state, rev: baseRev + 1, updated_at: new Date().toISOString() };
  let rows;
  if (baseRev === 0) {
    try { rows = await sb('/rest/v1/user_data', { method: 'POST', token, prefer: 'return=representation', body: { user_id: uid, ...payload } }); }
    catch (e) { if (e.status === 409) return false; throw e; }
  } else {
    rows = await sb(`/rest/v1/user_data?user_id=eq.${encodeURIComponent(uid)}&rev=eq.${baseRev}`, { method: 'PATCH', token, prefer: 'return=representation', body: payload });
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
  out.settings.started = true;
  return out;
}

function adopt(remote) {
  state = sanitize(remote);
  state.settings.started = true;
  if (!state.categories.length) state.categories = defaultCategories();
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
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await pullRow();
      const remoteRev = row ? Number(row.rev) || 0 : 0;
      if (row && remoteRev !== sync.rev) {
        // Another device saved since this one last synced.
        if (validState(row.data)) {
          if (sync.dirty) { state = mergeStates(state, row.data); fmtCache = {}; saveLocal(); render(); }
          else adopt(row.data);
        }
        sync.rev = remoteRev;
        saveSync();
      }
      if (row && !sync.dirty) break;
      if (await pushRow(remoteRev)) break;
    }
    sync.error = '';
    sync.last = new Date().toISOString();
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
  return sync.last ? `Synced ${new Date(sync.last).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet.';
}

function startApp() {
  state.settings.started = true;
  if (!state.categories.length) state.categories = defaultCategories();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Runs once after signing in: decide between the data on this device and the data already in the account.
async function afterSignIn() {
  const row = await pullRow();
  const remote = row && validState(row.data) ? row.data : null;
  sync.rev = row ? Number(row.rev) || 0 : 0;
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
      <label class="field"><span>Email</span><input type="text" inputmode="email" name="email" autocomplete="email" autocapitalize="none" spellcheck="false" data-autofocus></label>
      ${passwordField(`Password${up ? ' (at least 6 characters)' : ''}`, up ? 'new-password' : 'current-password')}
      ${up ? '<p class="note">Your data is saved to your account so it is backed up and the same on every device you sign in on.</p>' : ''}
      <button class="btn">${up ? 'Create account' : 'Sign in'}</button>
      <button type="button" class="btn ghost" data-act="open-account" data-id="${up ? 'signin' : 'signup'}">${up ? 'I already have an account' : 'Create a new account'}</button>
      ${up ? '' : '<button type="button" class="link center" data-act="forgot">Forgot password?</button>'}
    </form>`);
}

function newPasswordSheet() {
  openSheet('Set a new password', `
    <form data-form="newpass" novalidate>
      ${passwordField('New password (at least 6 characters)', 'new-password', true)}
      <button class="btn">Save password</button>
    </form>`);
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
      if (d && d.access_token) { setSession(d); await afterSignIn(); toast('Account created'); }
      else openSheet('Check your email', `<p>We sent a confirmation link to ${esc(email)}. Open it, then come back to this app and sign in with your email and password.</p>
        <p class="note">On an iPhone the link opens in Safari. That is fine: return to the app from your home screen afterwards.</p>
        <button class="btn" data-act="open-account" data-id="signin">Sign in</button>`);
    } else {
      setSession(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: f.password } }));
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
    if (changed && !$('#sheet-root').firstChild) render();
  } catch (e) { /* offline: try again next time */ }
}

function androidUpdateCard() {
  if (!androidUpdate) return '';
  return `<section class="card">
    <div class="name" style="white-space:normal">A new version of the Android app is ready${androidUpdate.name ? ` (${esc(androidUpdate.name)})` : ''}</div>
    <p class="note" style="margin:6px 0 14px">Tap Update. When the download finishes, open it and choose Install. Your data stays as it is.</p>
    <button class="btn" data-act="android-update">Update</button>
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
    const paid = state.transactions.find((t) => t.recurringId === r.id && t.period === ym) || null;
    if (r.paused && !paid) continue;
    items.push({ key: 'rec:' + r.id, kind: 'rec', ref: r, name: r.name, type: r.type, amount: recAmount(r, ym), categoryId: r.categoryId,
      date: dateIn(ym, r.day), paid, skipped: !paid && r.skips.includes(ym) });
  }
  for (const e of state.emis) {
    const i = monthsBetween(e.start, ym);
    if (i < e.paidBefore || i >= e.tenure) continue;
    const paid = state.transactions.find((t) => t.emiId === e.id && t.period === ym) || null;
    items.push({ key: 'emi:' + e.id, kind: 'emi', ref: e, name: e.name, type: 'expense', amount: e.monthly, categoryId: e.categoryId,
      date: dateIn(ym, e.day), paid, skipped: false, seq: i + 1 });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
// A bill is Unpaid from the first day of its month until it is marked paid, whatever its due day.
// Months that have not started yet are only "Upcoming". Expected income is never shown as unpaid.
function dueStatus(it) {
  if (it.paid) return 'done';
  if (it.skipped) return 'skipped';
  if (it.type === 'income') return 'expected';
  return it.date.slice(0, 7) > curYM() ? 'upcoming' : 'unpaid';
}
const isOpen = (it) => !it.paid && !it.skipped;

// Opens the right sheet for one due item: its payment if already paid, otherwise a pre-filled entry for that month.
function openDue(it, ym) {
  if (it.paid) return txSheet(it.paid);
  if (it.skipped) { it.ref.skips = it.ref.skips.filter((m) => m !== ym); save(); render(); return toast('Back on the list'); }
  const income = it.type === 'income';
  txSheet(null, { title: `${income ? 'Received' : it.type === 'saving' ? 'Save' : 'Pay'}: ${it.name}`, cta: income ? 'Mark as received' : 'Mark as paid',
    type: it.type, amount: it.amount, categoryId: it.categoryId, note: it.name, date: ym === curYM() ? today() : it.date,
    recurringId: it.kind === 'rec' ? it.ref.id : '', emiId: it.kind === 'emi' ? it.ref.id : '', period: ym, canSkip: it.kind === 'rec' });
}

const debtPaid = (d) => sum(d.payments, (p) => p.amount);
const debtLeft = (d) => (d.settled ? 0 : Math.max(0, r3(d.amount - debtPaid(d))));
const debtTotal = (kind) => sum(state.debts.filter((d) => d.kind === kind), debtLeft);

/* ---------- Theme, toast, sheets ---------- */

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
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
  return fab ? `<button class="fab" data-act="${fab[0]}" aria-label="${fab[1]}">+</button>` : '';
}

function render() {
  const app = $('#app');
  if (!state.settings.started) { app.innerHTML = viewWelcome(); return; }
  const views = { home: viewHome, bills: viewBills, savings: viewSavings, reports: viewReports, planner: viewPlanner, more: viewMore };
  const tabs = [['home', 'Home'], ['bills', 'Bills'], ['savings', 'Savings'], ['reports', 'Reports'], ['planner', 'Planner'], ['more', 'More']];
  const overdue = dueItems(curYM()).filter((it) => dueStatus(it) === 'unpaid').length;
  // When the tab changes, the glass capsule slides from the old tab to the new one and the page slides in from that side.
  const index = tabs.findIndex(([id]) => id === ui.tab);
  const from = lastTabIndex == null ? index : lastTabIndex;
  const slide = index > from ? 'from-right' : index < from ? 'from-left' : '';
  lastTabIndex = index;
  app.innerHTML = `
    <div class="view ${slide}">${views[ui.tab]()}</div>
    ${fabHtml()}
    <nav class="tabbar"><div class="tabbar-in" style="--n:${tabs.length}">
      <i class="tab-pill" style="--i:${from}" aria-hidden="true"></i>
      ${tabs.map(([id, label]) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>
        ${ICONS[id]}${id === 'bills' && overdue ? `<i class="badge" aria-label="${overdue} unpaid">${overdue}</i>` : ''}<span>${label}</span></button>`).join('')}
    </div></nav>`;
  if (from !== index) {
    requestAnimationFrame(() => requestAnimationFrame(() => { const pill = $('.tab-pill'); if (pill) pill.style.setProperty('--i', index); }));
  }
}
let lastTabIndex = null;

function currencyOptions(selected) {
  const list = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
  return list.map((c) => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

function catOptions(type, selected) {
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(catLabel(c))}</option>`;
  const cats = catsOf(type);
  if (!cats.length) return '<option value="">No categories yet</option>';
  if (type !== 'income') return cats.map(opt).join('');
  return ['primary', 'secondary'].map((g) => {
    const list = cats.filter((c) => c.group === g);
    return list.length ? `<optgroup label="${g === 'primary' ? 'Primary income' : 'Secondary income'}">${list.map(opt).join('')}</optgroup>` : '';
  }).join('');
}

function segButtons(act, options, current) {
  return `<div class="seg" style="grid-template-columns:repeat(${options.length},1fr)">${options.map(([v, l]) =>
    `<button type="button" class="${v === current ? 'on' : ''}" data-act="${act}" data-id="${v}" aria-pressed="${v === current}">${l}</button>`).join('')}</div>`;
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
  const tags = [t.type === 'saving' ? 'Savings' : '', t.note && c ? c.name : '', t.emiId ? 'EMI' : t.recurringId ? 'Repeating' : ''].filter(Boolean).join(' · ');
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
  ['🏦', 'Savings', 'Set money aside into funds, such as a children’s fund or an emergency fund.'],
  ['🔮', 'Upcoming months', 'See the fixed expenses waiting in each coming month, with a total.'],
  ['🎯', 'Plans', 'List what you want to buy later and how much to save for it each month.'],
  ['🤝', 'Money owed', 'Keep track of money people owe you and money you owe.'],
  ['📊', 'Reports', 'Totals by day, month and year, and by category.']
];

function viewWelcome() {
  return `<div class="welcome">
    <h1 class="brand">${LOGO_SVG}</h1>
    <p class="tagline">Family Expense Tracker App</p>
    <p class="lead">A simple way to track your family’s money. Note your income and spending as it happens, and always know what is left for the month.</p>

    <h3>What you can do</h3>
    <div class="list points">${WELCOME_POINTS.map(([emoji, title, text]) => `<div class="row">
      <span class="emoji" aria-hidden="true">${emoji}</span>
      <span class="row-main"><span class="name">${title}</span><span class="point-text">${text}</span></span></div>`).join('')}</div>

    <h3>Get started</h3>
    <label class="field"><span>Your currency</span><select data-setting="currency">${currencyOptions(state.settings.currency)}</select></label>
    <button class="btn" data-act="open-account" data-id="signup">Create an account</button>
    <button class="btn ghost" data-act="open-account" data-id="signin">I already have an account</button>
    <button class="btn ghost" data-act="start">Use without an account</button>
    <p class="note" style="margin-top:14px">With an account your data is backed up online and stays the same on every device you sign in on. Without one it stays only on this device. You can create an account later under More.</p>
    <p class="note" style="text-align:center;margin-top:24px">Version ${APP_VERSION}</p>
  </div>`;
}

/* ---------- Home ---------- */

function homeListHtml() {
  const q = ui.search.trim().toLowerCase();
  const list = txInMonth(ui.month).filter((t) => (ui.filter === 'all' || t.type === ui.filter)
    && (!q || t.note.toLowerCase().includes(q) || ((cat(t.categoryId) || {}).name || '').toLowerCase().includes(q)));
  return txGroups(list, q || ui.filter !== 'all' ? 'Nothing matches.' : 'Nothing recorded for this month yet. Tap + to add income, an expense or savings.');
}

const homeSwitch = () => segButtons('home-mode', [['month', 'Month report'], ['year', 'Year report']], ui.home);

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
        ${active.map((r) => `<tr data-act="home-month" data-id="${r.ym}"><td>${toDate(r.ym + '-01').toLocaleDateString(undefined, { month: 'short' })}</td>
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
  const after = r3(t.balance - openOut);
  const daysLeft = daysInMonth(ym) - Number(today().slice(8, 10)) + 1;
  const recv = debtTotal('receivable');
  const pay = debtTotal('payable');

  let dueCard = '';
  if (open.length) {
    const bits = [];
    if (openOut) bits.push(`${fmt(openOut)} still to pay`);
    if (openIn) bits.push(`${fmt(openIn)} income expected`);
    dueCard = `<button class="card tap" data-act="open-bills">
      <div class="row-top"><span class="name">${openOut ? `${plural(open.filter((it) => it.type !== 'income').length, 'bill')} unpaid this month` : `${plural(open.length, 'item')} expected this month`}</span><span class="chev-r">›</span></div>
      <div class="sub">${bits.join(' · ')}</div>
      ${isNow && openOut ? `<div class="sub">After paying them: <b class="${after < 0 ? 'over' : ''}">${fmt(after)}</b>${after > 0 ? ` · about ${fmt(Math.floor(after / daysLeft))} a day for ${plural(daysLeft, 'day')}` : ''}</div>` : ''}
    </button>`;
  }

  return `<header class="top sticky-top">
      ${homeSwitch()}
      ${monthNav(ym, 'month')}
      ${isNow ? '' : '<button class="link center" data-act="month-now">Back to this month</button>'}
    </header>
    ${androidUpdateCard()}
    <section class="card">
      <div class="hero-row"><div class="hero-main">
      <div class="label">Left this month</div>
      <div class="hero-num ${t.balance < 0 ? 'neg' : ''}">${fmt(t.balance)}</div>
      <div class="sub">Income minus expenses and savings</div>
      </div>${spendRing(t.income, t.expense)}</div>
      <div class="kpis three" style="margin-top:14px">
        <div class="kpi"><div class="label">Income</div><div class="v">${fmt(t.income)}</div></div>
        <div class="kpi"><div class="label">Expenses</div><div class="v">${fmt(t.expense)}</div></div>
        <div class="kpi"><div class="label">Savings</div><div class="v">${fmt(t.saving)}</div></div>
      </div>
    </section>
    ${dueCard}
    ${recv || pay ? `<button class="card tap" data-act="open-owed">
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
  const when = it.paid ? `${it.type === 'income' ? 'Received' : 'Paid'} ${fmtShort(it.paid.date)}` : st === 'skipped' ? 'Not this month' : `Due ${fmtShort(it.date)}`;
  return `<button class="row ${st === 'unpaid' ? 'is-unpaid' : ''}" data-act="due" data-key="${it.key}">
    <span class="emoji" aria-hidden="true">${esc((c && c.emoji) || '•')}</span>
    <span class="row-main">
      <span class="row-top"><span class="name">${esc(it.name)}</span><span class="amt">${fmt(it.paid ? it.paid.amount : it.amount)}</span></span>
      <span class="row-top"><span class="row-sub">${when}${it.kind === 'emi' ? ` · EMI ${it.seq} of ${it.ref.tenure}` : it.ref.frequency === 'yearly' ? ' · yearly' : ''}</span><span class="pill ${st}">${pill}</span></span>
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
  const when = r.frequency === 'yearly' ? `every year on ${r.day} ${monthNameOf(r.month)}` : `every month on day ${r.day}`;
  const next = (r.changes || []).find((c) => c.from > curYM());
  return `${fmt(recAmount(r, curYM()))} · ${when}${next ? ` · ${fmt(next.amount)} from ${ymShort(next.from)}` : ''}${r.paused ? ' · paused' : ''}`;
}

function billsHead() {
  return segButtons('bills', [['month', 'This month'], ['emi', 'EMI'], ['upcoming', 'Upcoming']], ui.bills);
}

function viewBills() {
  return ui.bills === 'emi' ? viewEmi() : ui.bills === 'upcoming' ? viewUpcoming() : viewBillsMonth();
}

function viewBillsMonth() {
  const ym = ui.month;
  const items = dueItems(ym);
  const out = items.filter((it) => it.type !== 'income');
  const inc = items.filter((it) => it.type === 'income');
  const paidCount = out.filter((it) => it.paid).length;
  const openOut = sum(out.filter(isOpen), (it) => it.amount);
  const yearly = state.recurring.filter((r) => r.frequency === 'yearly' && !r.paused && r.type !== 'income');
  const setAside = sum(yearly, (r) => recAmount(r, curYM()) / 12);

  return `<header class="top"><h1>Bills</h1></header>
    <div class="sticky-top">
      ${billsHead()}
      ${monthNav(ym, 'month')}
      ${ym === curYM() ? '' : '<button class="link center" data-act="month-now">Back to this month</button>'}
    </div>
    <div class="sec-head"><h2>To pay</h2><span class="sub">${out.length ? `${paidCount} of ${out.length} paid · ${fmt(openOut)} unpaid` : ''}</span></div>
    <div class="list">${out.length ? out.map(dueRow).join('') : '<div class="empty">No bills in this month yet. Add your rent, school fee, utility bills and subscriptions once, and they come back here every month as Unpaid until you pay them.</div>'}</div>
    <button class="btn ghost" style="margin-top:12px" data-act="add-rec">+ Add a monthly bill</button>
    ${inc.length ? `<div class="sec-head"><h2>Expected income</h2></div><div class="list">${inc.map(dueRow).join('')}</div>` : ''}

    <div class="sec-head"><h2>All your bills and repeating items</h2><button class="link" data-act="add-rec">+ Add</button></div>
    <div class="list">${state.recurring.length ? state.recurring.map((r) => `<button class="row" data-act="edit-rec" data-id="${r.id}">
        <span class="emoji" aria-hidden="true">${esc((cat(r.categoryId) || {}).emoji || '•')}</span>
        <span class="row-main"><span class="row-top"><span class="name">${esc(r.name)}</span><span class="pill">${TYPE_LABEL[r.type]}</span></span>
        <span class="row-sub">${recurLine(r)}</span></span></button>`).join('')
      : '<div class="empty">Nothing repeating yet.</div>'}</div>
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
          <span class="row-sub">${it.paid ? '✓ Already paid' : `Due ${fmtShort(it.date)}`}${it.kind === 'emi' ? ` · EMI ${it.seq} of ${it.ref.tenure}` : it.type === 'saving' ? ' · savings' : it.ref.frequency === 'yearly' ? ' · yearly' : ''}</span></span></div>`).join('')
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
  const opening = sum(catsOf('saving'), (c) => c.opening || 0);
  const total = r3(sum(all, (t) => t.amount) + opening);
  const yearTotal = sum(inYear, (t) => t.amount);
  const thisMonth = sum(all.filter((t) => t.date.startsWith(curYM())), (t) => t.amount);
  const monthsUsed = new Set(inYear.map((t) => t.date.slice(0, 7))).size;
  const yearIncome = sum(state.transactions.filter((t) => t.type === 'income' && t.date.startsWith(year)), (t) => t.amount);
  const rate = yearIncome > 0 ? Math.round((yearTotal / yearIncome) * 100) : 0;

  const byFund = {};
  for (const c of catsOf('saving')) if (c.opening > 0 || c.target > 0) byFund[c.id] = c.opening || 0;
  for (const t of all) { const k = cat(t.categoryId) ? t.categoryId : ''; byFund[k] = r3((byFund[k] || 0) + t.amount); }
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
    <button class="btn" data-act="add-saving" style="margin-bottom:16px">+ Add savings</button>

    <section class="card">
      <div class="sec-head" style="margin-top:0"><h2>By fund</h2><button class="link" data-act="add-cat" data-type="saving">+ New fund</button></div>
      ${funds.length ? `<div class="rank">${funds.map(({ id, c, v }) => `<button class="rank-row" data-act="fund" data-id="${id}">
        <span class="row-top"><span class="name">${esc(catLabel(c))}</span><span class="amt">${fmt(v)}${total > 0 ? `<span class="share">${Math.round((v / total) * 100)}%</span>` : ''}</span></span>
        ${c && c.target > 0 ? `<span class="rank-track"><span class="rank-bar" style="width:${Math.min(100, (v / c.target) * 100)}%"></span></span>
        <span class="row-sub">${targetLine(v, c.target)}</span>`
          : `<span class="rank-bar" style="width:${top > 0 ? (v / top) * 100 : 0}%"></span>`}</button>`).join('')}</div>`
        : '<div class="empty">Nothing saved yet. Tap “Add savings” to record money you set aside, such as a children’s fund or an emergency fund.</div>'}
    </section>

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

function repScope() {
  const { period, cursor } = ui.rep;
  const prefix = cursor.slice(0, { day: 10, month: 7, year: 4 }[period]);
  const label = period === 'day' ? fmtDayLong(cursor) : period === 'month' ? ymLabel(prefix) : prefix;
  return { period, prefix, label, list: state.transactions.filter((t) => t.date.startsWith(prefix)) };
}

function rankRows(list, measure, period) {
  const sums = {};
  for (const t of list) { const k = cat(t.categoryId) ? t.categoryId : ''; sums[k] = r3((sums[k] || 0) + t.amount); }
  const rows = Object.entries(sums).map(([id, v]) => ({ id, c: cat(id), v })).sort((a, z) => z.v - a.v);
  const total = sum(rows, (x) => x.v);
  const top = rows.length ? rows[0].v : 0;
  if (!rows.length) return `<div class="empty">No ${TYPE_PLURAL[measure].toLowerCase()} recorded in this period.</div>`;
  return `<div class="rank">${rows.map(({ id, c, v }) => {
    const budget = measure === 'expense' && c && c.budget > 0 ? c.budget * (period === 'year' ? 12 : 1) : 0;
    const over = period !== 'day' && budget > 0 && v > budget;
    return `<button class="rank-row" data-act="rep-cat" data-id="${id}">
      <span class="row-top"><span class="name">${esc(catLabel(c))}</span>
        <span class="amt">${fmt(v)}<span class="share">${Math.round((v / total) * 100)}%</span></span></span>
      <span class="rank-bar" style="width:${(v / top) * 100}%"></span>
      ${measure === 'income' && c ? `<span class="row-sub">${c.group === 'secondary' ? 'Secondary' : 'Primary'} income</span>` : ''}
      ${period !== 'day' && budget > 0 ? `<span class="row-sub">${over ? `<span class="over">⚠ Over the ${fmt(budget)} limit by ${fmt(v - budget)}</span>` : `${fmt(budget - v)} left of the ${fmt(budget)} limit`}</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

function viewReports() {
  const { period, prefix, label, list } = repScope();
  const measure = ui.rep.measure;
  const t = totalsOf(list);
  const mlist = list.filter((x) => x.type === measure);
  const rate = t.income > 0 ? Math.round((t.saving / t.income) * 100) : 0;

  let buckets = [];
  if (period === 'month') {
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
        ${rows.map((r) => `<tr data-act="rep-goto" data-id="${r.ym}-01"><td>${toDate(r.ym + '-01').toLocaleDateString(undefined, { month: 'short' })}</td>
          <td>${fmtK(r.t.income)}</td><td>${fmtK(r.t.expense)}</td><td>${fmtK(r.t.saving)}</td><td class="${r.t.balance < 0 ? 'over' : ''}">${fmtK(r.t.balance)}</td></tr>`).join('')}
        </tbody></table><p class="note" style="margin:10px 0 0">Tap a month to open it.</p>` : '<div class="empty">Nothing recorded this year.</div>'}
    </section>`;
  }

  return `<header class="top"><h1>Reports</h1></header>
    <div class="sticky-top">${segButtons('rep-period', [['day', 'Day'], ['month', 'Month'], ['year', 'Year']], period)}
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
        <div class="kpi"><div class="label">Left</div><div class="v ${t.balance < 0 ? 'over' : ''}">${fmt(t.balance)}</div></div>
      </div>
    </section>
    ${segButtons('rep-measure', [['expense', 'Expenses'], ['income', 'Income'], ['saving', 'Savings']], measure)}
    ${buckets.length ? `<section class="card">
      <div class="sec-head" style="margin-top:0"><h2>${TYPE_PLURAL[measure]} per ${period === 'month' ? 'day' : 'month'}</h2></div>
      <div class="readout">${sel ? `<b>${fmt(sel.value)}</b> · ${esc(sel.label)}` : 'Tap a bar to see the amount.'}</div>
      <div class="chart" role="img" aria-label="${TYPE_PLURAL[measure]} over ${esc(label)}">
        <div class="grid-line" style="top:0"><span>${fmt(max)}</span></div>
        <div class="grid-line" style="top:50%"><span>${fmt(max / 2)}</span></div>
        <div class="cols">${buckets.map((b, i) => `<button class="col ${ui.bar === i ? 'sel' : ''}" data-act="bar" data-id="${i}" aria-label="${esc(b.label)}: ${esc(fmt(b.value))}"><span style="height:${(b.value / max) * 100}%"></span></button>`).join('')}</div>
      </div>
      <div class="x-axis"><span>${period === 'month' ? '1' : monthNameOf(1).slice(0, 3)}</span><span>${period === 'month' ? buckets.length : monthNameOf(12).slice(0, 3)}</span></div>
    </section>` : ''}
    <section class="card">
      <div class="sec-head" style="margin-top:0"><h2>${TYPE_PLURAL[measure]} by category</h2></div>
      ${split}${rankRows(mlist, measure, period)}
    </section>
    ${yearTable}
    ${period === 'day' ? `<div class="sec-head"><h2>That day</h2></div>${txGroups(list, 'Nothing recorded on this day.')}` : ''}`;
}

/* ---------- Planner: plans, receivable, payable ---------- */

function planRow(p) {
  const months = p.target ? monthsBetween(curYM(), p.target) : null;
  let sub = p.done ? '✓ Done' : p.target ? `By ${ymShort(p.target)}` : 'No date set';
  if (!p.done && months != null) sub += months > 0 ? ` · save ${fmt(Math.ceil(p.price / months))} a month` : months === 0 ? ' · due this month' : ' · date has passed';
  return `<button class="row" data-act="edit-plan" data-id="${p.id}">
    <span class="row-main"><span class="row-top"><span class="name">${esc(p.name)}</span><span class="amt">${fmt(p.price)}</span></span>
    <span class="row-top"><span class="row-sub">${sub}${p.note ? ' · ' + esc(p.note) : ''}</span>${p.done ? '' : `<span class="pill">${p.priority[0].toUpperCase() + p.priority.slice(1)}</span>`}</span>
    </span></button>`;
}

function debtRow(d) {
  const left = debtLeft(d);
  const late = !d.settled && d.due && d.due < today();
  const sub = d.settled ? '✓ Settled' : `${fmt(left)} left${d.due ? ` · due ${fmtShort(d.due)}` : ''}`;
  return `<button class="row" data-act="open-debt" data-id="${d.id}">
    <span class="row-main"><span class="row-top"><span class="name">${esc(d.person)}</span><span class="amt">${fmt(d.settled ? d.amount : left)}${!d.settled && left !== d.amount ? `<span class="of"> / ${fmt(d.amount)}</span>` : ''}</span></span>
    <span class="row-top"><span class="row-sub">${sub}${d.note ? ' · ' + esc(d.note) : ''}</span>${late ? '<span class="pill overdue">⚠ Overdue</span>' : ''}</span>
    </span></button>`;
}

function viewPlanner() {
  const tab = ui.planner;
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
    <div class="sticky-top">${segButtons('planner', [['plans', 'Plans'], ['receivable', 'Owed to me'], ['payable', 'I owe']], tab)}</div>
    ${body}`;
}

/* ---------- More: categories, settings, data ---------- */

function viewMore() {
  const th = state.settings.theme;
  const catList = (title, list, type, group) => `<div class="sec-head"><h2>${title}</h2><button class="link" data-act="add-cat" data-type="${type}" data-group="${group || ''}">+ Add</button></div>
    <div class="list">${list.length ? list.map((c) => `<button class="row" data-act="edit-cat" data-id="${c.id}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji || '•')}</span>
      <span class="row-main"><span class="row-top"><span class="name">${esc(c.name)}</span>${c.budget ? `<span class="row-sub">limit ${fmt(c.budget)}/month</span>` : c.opening || c.target ? `<span class="row-sub">${[c.opening ? `already had ${fmt(c.opening)}` : '', c.target ? `target ${fmt(c.target)}` : ''].filter(Boolean).join(' · ')}</span>` : ''}</span></span></button>`).join('')
      : '<div class="empty">None yet.</div>'}</div>`;
  const inc = catsOf('income');
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
  return `<header class="top"><h1>More</h1></header>
    <div class="sec-head" style="margin-top:0"><h2>Account</h2></div>
    ${account}
    ${catList('Primary income sources', inc.filter((c) => c.group === 'primary'), 'income', 'primary')}
    ${catList('Secondary income sources', inc.filter((c) => c.group === 'secondary'), 'income', 'secondary')}
    ${catList('Expense categories', catsOf('expense'), 'expense')}
    ${catList('Savings funds', catsOf('saving'), 'saving')}

    <div class="sec-head"><h2>Settings</h2></div>
    <section class="card">
      <label class="field"><span>Currency</span><select data-setting="currency">${currencyOptions(state.settings.currency)}</select></label>
      <label class="field" style="margin-bottom:0"><span>Appearance</span><select data-setting="theme">
        ${[['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${th === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
    </section>
    <div class="sec-head"><h2>Your data</h2></div>
    <section class="card">
      <p class="note" style="margin:0 0 14px">${sync.session ? 'Your data is saved to your account. A backup file is an extra copy you keep yourself.' : 'Everything lives only on this device. Save a backup now and then, because clearing Safari website data or deleting the app icon removes it.'}</p>
      <button class="btn" data-act="backup">Save a backup file</button>
      <label class="btn ghost" style="text-align:center;margin-top:10px">Restore from a backup<input type="file" id="restore-file" accept="application/json,.json" class="hidden"></label>
      <button class="btn ghost" data-act="export-csv">Export transactions (CSV)</button>
      <button class="btn danger" data-act="erase">Erase everything</button>
    </section>
    ${window.FetaAndroid ? '' : `<div class="sec-head"><h2>Put it on your home screen</h2></div>
    <section class="card"><p class="note" style="margin:0">In Safari, tap the Share button, then “Add to Home Screen”. The app then opens full screen and works without internet.</p></section>`}
    <div class="sec-head"><h2>App version</h2></div>
    ${androidUpdateCard()}
    <section class="card">
      <p class="note" style="margin:0 0 14px">You have version ${APP_VERSION}. ${android ? ` Android app ${androidVersion()}.` : ''} The app updates itself when you open it with internet. If something looks out of date, tap the button. Your data is not affected.</p>
      <button class="btn ghost" data-act="update-app">Get the latest version</button>
    </section>
    <div class="brand-foot">${LOGO_SVG}<p class="note">Family Expense Tracker App · version ${APP_VERSION} · ${plural(state.transactions.length, 'transaction')}</p></div>`;
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
  return `<div class="seg" role="radiogroup" aria-label="Type" style="grid-template-columns:repeat(${types.length},1fr)">
    ${types.map((v) => `<label><input type="radio" name="type" value="${v}" ${v === current ? 'checked' : ''}><span>${TYPE_LABEL[v]}</span></label>`).join('')}</div>`;
}

function txSheet(tx, preset = {}) {
  const v = tx || preset;
  const type = v.type || 'expense';
  const linked = !!(v.recurringId || v.emiId);
  const fixedType = linked || (!tx && !!preset.lockType);
  const date = tx ? tx.date : preset.date || (ui.month === curYM() || ui.tab !== 'home' ? today() : ui.month + '-01');
  const bill = v.recurringId ? state.recurring.find((r) => r.id === v.recurringId) : null;
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
        <label class="field"><span>Category</span><select name="categoryId">${catOptions(type, v.categoryId)}</select></label>
        <label class="field"><span>Date</span><input type="date" name="date" value="${date}"></label>
      </div>
      <button class="btn">${tx ? 'Save changes' : preset.cta || 'Add'}</button>
      ${!tx && preset.canSkip ? `<button type="button" class="btn ghost" data-act="skip-due" data-id="${v.recurringId}" data-period="${v.period}">Skip this month</button>` : ''}
      ${tx && !linked && tx.type !== 'income' ? `<button type="button" class="btn ghost" data-act="tx-to-bill" data-id="${tx.id}">Make this a monthly bill</button>` : ''}
      ${tx ? `<button type="button" class="btn danger" data-act="del-tx" data-id="${tx.id}">Delete</button>` : ''}
      ${bill ? billBlock(bill) : ''}
    </form>`);
}

function catSheet(c, type, group) {
  const kind = c ? c.type : type;
  const title = { expense: 'expense category', income: 'income source', saving: 'savings fund' }[kind];
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
      ${kind === 'saving' && !c ? `<label class="field"><span>Amount already in this fund (optional)</span>
        <input type="text" inputmode="decimal" name="opening" placeholder="0" autocomplete="off"></label>
        <p class="note" style="margin:-4px 0 14px">Money you had saved before you started using the app. It counts in your total, not in any month.</p>` : ''}
      ${kind === 'saving' ? `<label class="field"><span>Target amount (optional)</span>
        <input type="text" inputmode="decimal" name="target" placeholder="No target" autocomplete="off" value="${c && c.target ? c.target : ''}"></label>` : ''}
      <button class="btn">${c ? 'Save changes' : 'Add'}</button>
      ${c ? `<button type="button" class="btn danger" data-act="del-cat" data-id="${c.id}">Delete</button>` : ''}
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
  const per = r.frequency === 'yearly' ? 'a year' : 'a month';
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
          <option value="monthly" ${freq === 'monthly' ? 'selected' : ''}>Every month</option>
          <option value="yearly" ${freq === 'yearly' ? 'selected' : ''}>Every year</option></select></label>
        <label class="field"><span>Day of the month</span><input type="text" inputmode="numeric" name="day" autocomplete="off" value="${r ? r.day : 1}"></label>
      </div>
      <label class="field ${freq === 'yearly' ? '' : 'hidden'}" data-month-wrap><span>Month</span><select name="month">
        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${(r ? r.month : Number(ui.month.slice(5, 7))) === i + 1 ? 'selected' : ''}>${monthNameOf(i + 1)}</option>`).join('')}</select></label>
      ${monthPicker('Starts from', 'start', r ? r.start : ui.month)}
      <p class="note">It appears in Bills on its date each time. You confirm the amount when you pay, so a fee that changes is no problem.</p>
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
  const per = r.frequency === 'yearly' ? 'a year' : 'a month';
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
        <div class="seg" role="radiogroup" aria-label="Tenure in months" style="grid-template-columns:repeat(5,1fr);margin-bottom:0">
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
    ? `${tenure} instalments of ${fmt(monthly)} = ${fmt(monthly * tenure)} in total. It appears in Bills every month from ${ymLabel(start)} and stops after the last instalment in ${ymLabel(addMonths(start, tenure - 1))}.`
    : 'It repeats in Bills every month until the last instalment.';
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
      ${monthPicker('By when (optional)', 'target', p ? p.target : '', true)}
      <label class="field"><span>Priority</span><select name="priority">
        ${['high', 'medium', 'low'].map((v) => `<option value="${v}" ${(p ? p.priority : 'medium') === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></label>
      <label class="field"><span>Note (optional)</span><input type="text" name="note" maxlength="120" autocomplete="off" value="${esc(p ? p.note : '')}"></label>
      ${p ? `<label class="check"><input type="checkbox" name="done" ${p.done ? 'checked' : ''}><span>Done</span></label>` : ''}
      <button class="btn">${p ? 'Save changes' : 'Add plan'}</button>
      ${p && !p.done ? `<button type="button" class="btn ghost" data-act="plan-bought" data-id="${p.id}">I bought it, add as an expense</button>` : ''}
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
    <button class="btn ghost" data-act="toggle-debt" data-id="${d.id}">${d.settled ? 'Reopen' : 'Mark as settled'}</button>
    <button class="btn ghost" data-act="edit-debt" data-id="${d.id}">Edit</button>
    <p class="note" style="margin-top:12px">Money owed to you and money you owe are tracked on their own and do not change your monthly income or expenses.</p>`);
}

function syncRecForm(form) {
  $('[data-month-wrap]', form).classList.toggle('hidden', form.elements.frequency.value !== 'yearly');
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
  const c = cat(f.categoryId);
  const data = { type: f.type, amount, categoryId: c && c.type === f.type ? c.id : '', date: f.date, note: f.note.trim(),
    recurringId: f.recurringId || '', emiId: f.emiId || '', planId: f.planId || '', period: f.period || '' };
  const existing = f.id && state.transactions.find((t) => t.id === f.id);
  if (existing) Object.assign(existing, data);
  else state.transactions.push({ id: uid(), created: Date.now(), ...data });
  if (data.planId) { const p = state.plans.find((x) => x.id === data.planId); if (p) p.done = true; }
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
  const day = dayOf(f.day);
  if (Number.isNaN(day)) return toast('The day must be between 1 and 31.');
  const start = pickedMonth(f, 'start');
  if (!isYM(start)) return toast('Pick the month it starts from.');
  const c = cat(f.categoryId);
  const data = { type: f.type, name, amount, categoryId: c && c.type === f.type ? c.id : '', frequency: f.frequency === 'yearly' ? 'yearly' : 'monthly',
    day, month: Number(f.month) || 1, start, paused: !!f.paused };
  const existing = f.id && state.recurring.find((r) => r.id === f.id);
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
  const data = { name, price, target: isYM(pickedMonth(f, 'target')) ? pickedMonth(f, 'target') : '', priority: ['high', 'medium', 'low'].includes(f.priority) ? f.priority : 'medium', note: f.note.trim() };
  const existing = f.id && state.plans.find((p) => p.id === f.id);
  if (existing) Object.assign(existing, data, { done: !!f.done });
  else state.plans.push({ id: uid(), done: false, ...data });
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

function submitDebtPay(f) {
  const d = state.debts.find((x) => x.id === f.id);
  if (!d) return closeSheet();
  const amount = parseAmount(f.amount);
  if (!(amount > 0)) return toast('Enter an amount above zero.');
  if (!isDate(f.date)) return toast('Pick a date.');
  d.payments.push({ id: uid(), amount, date: f.date });
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

/* ---------- Events ---------- */

const find = (list, el) => list.find((x) => x.id === el.dataset.id);
const remove = (key, id) => { state[key] = state[key].filter((x) => x.id !== id); };

const actions = {
  'tab': (el) => { ui.tab = el.dataset.id; ui.bar = null; render(); window.scrollTo(0, 0); },
  'start': () => { startApp(); save(); render(); },
  'android-update': () => { if (androidUpdate) location.href = androidUpdate.url; },
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
  'month': (el) => { ui.month = addMonths(ui.month, Number(el.dataset.d)); render(); },
  'month-now': () => { ui.month = curYM(); render(); },
  'home-mode': (el) => { ui.home = el.dataset.id === 'year' ? 'year' : 'month'; render(); window.scrollTo(0, 0); },
  'home-year': (el) => { ui.month = `${Number(ui.month.slice(0, 4)) + Number(el.dataset.d)}${ui.month.slice(4)}`; render(); },
  'home-month': (el) => { if (isYM(el.dataset.id)) { ui.month = el.dataset.id; ui.home = 'month'; render(); window.scrollTo(0, 0); } },
  'year-report': () => { ui.tab = 'reports'; ui.rep.period = 'year'; ui.rep.cursor = `${ui.month.slice(0, 4)}-01-01`; ui.bar = null; render(); window.scrollTo(0, 0); },
  'open-bills': () => { ui.tab = 'bills'; ui.bills = 'month'; render(); window.scrollTo(0, 0); },
  'filter': (el) => { ui.filter = el.dataset.id; render(); },
  'open-owed': () => { ui.tab = 'planner'; ui.planner = debtTotal('receivable') ? 'receivable' : 'payable'; render(); window.scrollTo(0, 0); },

  'add-tx': () => txSheet(null, ui.tab === 'reports' ? { type: ui.rep.measure, lockType: true } : {}),
  'add-saving': () => txSheet(null, { type: 'saving', lockType: true }),
  'save-year': (el) => { ui.saveYear = String(Number(ui.saveYear) + Number(el.dataset.d)); ui.bar = null; render(); },
  'fund': (el) => {
    const id = el.dataset.id;
    const rows = state.transactions.filter((t) => t.type === 'saving' && (cat(t.categoryId) ? t.categoryId : '') === id);
    const c = cat(id);
    const had = (c && c.opening) || 0;
    const saved = r3(sum(rows, (t) => t.amount) + had);
    openSheet(catLabel(c), `<p>${fmt(saved)} saved in total${c && c.target > 0 ? `<br>${targetLine(saved, c.target)}` : ''}</p>
      <div class="list">${c ? `${had ? `<div class="row"><span class="row-main">
        <span class="row-top"><span class="name">Already in this fund</span><span class="amt">${fmt(had)}</span></span>
        <span class="row-sub">Saved before you started using the app.</span></span></div>` : ''}
        <button class="row" data-act="edit-cat" data-id="${id}"><span class="row-main">
        <span class="row-top"><span class="name">Target</span><span class="amt">${c.target > 0 ? fmt(c.target) : 'Not set'}</span></span>
        <span class="row-sub">${c.target > 0 ? 'The amount you want this fund to reach. Tap to change.' : 'Tap to set an amount you want this fund to reach.'}</span></span></button>` : ''}${sortedTx(rows).map((t) => `<button class="row" data-act="edit-tx" data-id="${t.id}"><span class="row-main">
        <span class="row-top"><span class="name">${fmtDay(t.date)}, ${t.date.slice(0, 4)}</span><span class="amt">${fmt(t.amount)}</span></span>
        ${t.note ? `<span class="row-sub">${esc(t.note)}</span>` : ''}</span></button>`).join('')}</div>
      <button class="btn" data-act="add-saving-to" data-id="${id}">Add savings to this fund</button>`);
  },
  'add-saving-to': (el) => txSheet(null, { type: 'saving', lockType: true, categoryId: el.dataset.id }),
  'edit-tx': (el) => { const t = find(state.transactions, el); if (t) txSheet(t); },
  'del-tx': (el) => { remove('transactions', el.dataset.id); done(); toast('Deleted'); },

  'due': (el) => { const it = dueItems(ui.month).find((x) => x.key === el.dataset.key); if (it) openDue(it, ui.month); },
  'emi-month': (el) => {
    const ym = el.dataset.period;
    const it = isYM(ym) && dueItems(ym).find((x) => x.key === 'emi:' + el.dataset.id);
    if (it) openDue(it, ym);
  },
  'bills': (el) => { ui.bills = el.dataset.id; render(); window.scrollTo(0, 0); },
  'horizon': (el) => { ui.horizon = Number(el.dataset.id) || 12; render(); },
  'goto-month': (el) => { if (isYM(el.dataset.id)) { ui.month = el.dataset.id; ui.bills = 'month'; render(); window.scrollTo(0, 0); } },
  'skip-due': (el) => {
    const r = find(state.recurring, el);
    if (r && isYM(el.dataset.period) && !r.skips.includes(el.dataset.period)) r.skips.push(el.dataset.period);
    done(); toast('Skipped for this month');
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
    ui.tab = 'bills'; ui.bills = 'month'; ui.month = t.date.slice(0, 7);
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
  'del-rec': (el) => confirmSheet('Delete this repeating item?', 'It stops appearing in Bills. Payments you already recorded stay in your history.', 'Delete', () => { remove('recurring', el.dataset.id); save(); render(); }),

  'add-emi': () => emiSheet(null),
  'open-emi': (el) => { const e = find(state.emis, el); if (e) emiDetailSheet(e); },
  'edit-emi': (el) => { const e = find(state.emis, el); if (e) emiSheet(e); },
  'del-emi': (el) => confirmSheet('Delete this EMI?', 'It stops repeating in Bills. Instalments you already recorded stay in your history as expenses.', 'Delete', () => { remove('emis', el.dataset.id); save(); render(); }),

  'planner': (el) => { ui.planner = el.dataset.id; render(); },
  'add-plan': () => planSheet(null),
  'edit-plan': (el) => { const p = find(state.plans, el); if (p) planSheet(p); },
  'del-plan': (el) => { remove('plans', el.dataset.id); done(); },
  'plan-bought': (el) => {
    const p = find(state.plans, el);
    if (p) txSheet(null, { title: `Bought: ${p.name}`, type: 'expense', amount: p.price, note: p.name, planId: p.id, date: today() });
  },

  'add-debt': () => debtSheet(null, ui.planner === 'payable' ? 'payable' : 'receivable'),
  'open-debt': (el) => { const d = find(state.debts, el); if (d) debtDetailSheet(d); },
  'edit-debt': (el) => { const d = find(state.debts, el); if (d) debtSheet(d); },
  'toggle-debt': (el) => { const d = find(state.debts, el); if (d) { d.settled = !d.settled; done(); } },
  'del-debt': (el) => confirmSheet('Delete this entry?', 'It is removed along with its payment history.', 'Delete', () => { remove('debts', el.dataset.id); save(); render(); }),
  'del-debtpay': (el) => {
    const d = find(state.debts, el);
    if (!d) return;
    d.payments = d.payments.filter((p) => p.id !== el.dataset.pay);
    save(); render(); debtDetailSheet(d);
  },

  'add-cat': (el) => catSheet(null, el.dataset.type, el.dataset.group),
  'edit-cat': (el) => { const c = cat(el.dataset.id); if (c) catSheet(c); },
  'del-cat': (el) => {
    const id = el.dataset.id;
    const n = state.transactions.filter((t) => t.categoryId === id).length;
    const go = () => { remove('categories', id); save(); render(); toast('Deleted'); };
    if (n) confirmSheet('Delete this category?', `Its ${plural(n, 'transaction')} will be kept and shown as “Uncategorised”.`, 'Delete category', go);
    else { closeSheet(); go(); }
  },

  'rep-period': (el) => { ui.rep.period = el.dataset.id; ui.bar = null; render(); },
  'rep-measure': (el) => { ui.rep.measure = el.dataset.id; ui.bar = null; render(); },
  'rep-nav': (el) => {
    const d = Number(el.dataset.d);
    const { period, cursor } = ui.rep;
    ui.rep.cursor = period === 'day' ? addDays(cursor, d) : period === 'month' ? addMonths(cursor.slice(0, 7), d) + '-01' : `${Number(cursor.slice(0, 4)) + d}-01-01`;
    ui.bar = null; render();
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

  'backup': () => shareOrDownload(`feta-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json'),
  'export-csv': () => exportCsv(),
  'erase': () => confirmSheet('Erase everything?', 'All income, expenses, savings, bills, EMIs, plans and money owed on this device will be deleted. This cannot be undone.', 'Erase everything', () => {
    const { currency, theme } = state.settings;
    state = blankState();
    Object.assign(state.settings, { currency, theme });
    localStorage.removeItem(OLD_KEY);
    ui.tab = 'home'; ui.bar = null; ui.search = ''; ui.month = curYM();
    save(); render();
  })
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el);
});

const submitters = { auth: submitAuth, newpass: submitNewPass, tx: submitTx, cat: submitCat, rec: submitRec, recchange: submitRecChange, emi: submitEmi, plan: submitPlan, debt: submitDebt, debtpay: submitDebtPay };
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  submitters[form.dataset.form](Object.fromEntries(new FormData(form)), form);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const form = el.closest('[data-form]');
  if (form && el.name === 'type' && el.type === 'radio') {
    form.elements.categoryId.innerHTML = catOptions(el.value);
    const label = $('[data-note-label]', form);
    if (label) { label.textContent = NOTE_LABEL[el.value]; form.elements.note.placeholder = NOTE_HINT[el.value]; }
  } else if (form && form.dataset.form === 'rec' && el.name === 'frequency') {
    syncRecForm(form);
  } else if (form && form.dataset.form === 'emi') {
    syncEmiForm(form);
  } else if (form && form.dataset.form === 'recchange') {
    syncRecChangeForm(form);
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
  const form = e.target.closest('[data-form="emi"]');
  if (form) return syncEmiForm(form);
  const changeForm = e.target.closest('[data-form="recchange"]');
  if (changeForm) return syncRecChangeForm(changeForm);
  if (e.target.id !== 'tx-search') return;
  ui.search = e.target.value;
  $('#tx-list').innerHTML = homeListHtml();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#sheet-root').firstChild) closeSheet();
});

// Called by the Android app when the phone's Back button is pressed. Returns true if FETA used it.
window.fetaBack = () => {
  if ($('#sheet-root').firstChild) { closeSheet(); return true; }
  if (state.settings.started && ui.tab !== 'home') { ui.tab = 'home'; ui.bar = null; render(); window.scrollTo(0, 0); return true; }
  return false;
};

/* ---------- Start ---------- */

// A device that is signed out but still holds an account's data (an older version left it there, or the sign-in expired)
// shows the welcome screen instead. The data is set aside and offered back after signing in.
(() => {
  let wasSignedIn = false;
  try { wasSignedIn = localStorage.getItem(SYNC_KEY) != null; } catch (e) { /* ignore */ }
  if (!wasSignedIn || sync.session) return;
  setAside();
  resetState();
  try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignore */ }
})();

applyTheme();
render();

handleAuthLink().then((handled) => { if (!handled) syncNow(); });
checkAndroidUpdate();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncNow(); checkAndroidUpdate(); } });
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
