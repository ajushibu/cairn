/* Cairn — a personal index for the books you read: on paper, on Kindle, and EPUBs read right here.
 * Local-first: everything lives in localStorage and syncs to Supabase when you're signed in
 * (the same account as margin and recall). Claude runs on the server (/api/suggest, /api/ask,
 * /api/kindle, /api/draft); the key never reaches the browser.
 */
(() => {
'use strict';

/* ───────────── utils ───────────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const nowISO = () => new Date().toISOString();
const isoAt = (t) => new Date(t).toISOString();
const ms = (s) => Date.parse(s) || 0;
const isoNorm = (s) => (s ? new Date(s).toISOString() : s);
const DAY = 864e5;
const STEPS = [1, 3, 7, 16, 35, 90];
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const fmtN = (n) => Number(n).toLocaleString('en-US');
const intOrNull = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };
const loadJSON = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const quoteKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
const titleKey = (s) => String(s || '').toLowerCase().split(':')[0].replace(/[^a-z0-9]+/g, ' ').trim();

/* ───────────── colours (margin's palette plus moss, ember and stone) ───────────── */
const PAL = {
  moss: { name: 'Moss', a: '#4AA37C', b: '#2B7556', d: '#6ED0A4' },
  indigo: { name: 'Indigo', a: '#6A67F0', b: '#4440D0', d: '#8E8BFF' },
  ocean: { name: 'Ocean', a: '#2F8CFF', b: '#005ED6', d: '#4DA3FF' },
  lagoon: { name: 'Lagoon', a: '#1A9AB0', b: '#0D6F84', d: '#45C6DC' },
  grape: { name: 'Grape', a: '#B160E6', b: '#7B35B8', d: '#C98BF2' },
  ember: { name: 'Ember', a: '#F08A4B', b: '#B8501A', d: '#FF9F6B' },
  stone: { name: 'Stone', a: '#A39280', b: '#6E5E4E', d: '#C9B8A5' },
  dusk: { name: 'Dusk', a: '#7D839C', b: '#4E5369', d: '#A9AEC4' }
};
const PKEYS = Object.keys(PAL);
const pal = (k) => PAL[k] || PAL.moss;
const accStyle = (k) => { const p = pal(k); return `--acc-a:${p.a};--acc-b:${p.b};--acc-d:${p.d}`; };
const dotStyle = (k) => { const p = pal(k); return `--a:${p.a};--b:${p.b}`; };
function setAcc(node, k) { const p = pal(k); node.setAttribute('data-acc', ''); node.style.setProperty('--acc-a', p.a); node.style.setProperty('--acc-b', p.b); node.style.setProperty('--acc-d', p.d); }
function nextColor() { const used = new Set(S.books.map((x) => x.color)); return PKEYS.find((k) => !used.has(k)) || PKEYS[S.books.length % PKEYS.length]; }

const I = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  link: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  spark: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  check: '<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  import: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  file: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  pen: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  fwd: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z"/><path d="M12 6v13.5"/></svg>',
  cairn: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="19.6" rx="9" ry="3.2"/><ellipse cx="11.4" cy="13.8" rx="6.2" ry="2.8"/><ellipse cx="12.5" cy="8.6" rx="4.2" ry="2.4"/><ellipse cx="11.8" cy="4.2" rx="2.5" ry="1.8"/></svg>',
  cairnLg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="19.6" rx="9" ry="3.2"/><ellipse cx="11.4" cy="13.8" rx="6.2" ry="2.8"/><ellipse cx="12.5" cy="8.6" rx="4.2" ry="2.4"/><ellipse cx="11.8" cy="4.2" rx="2.5" ry="1.8"/></svg>'
};

/* ───────────── store + config ───────────── */
// Records are flat rows, the same shape as the Supabase tables. `_dirty` marks rows still to be pushed.
// `drafted` (this device only) remembers which inbox lines are still Claude's draft.
const STORE_KEY = 'cairn.store.v1', CONFIG_KEY = 'cairn.config.v1';
const EPOCH = '1970-01-01T00:00:00.000Z';
// pendingFiles (this device only): EPUBs added here that still have to be uploaded to your account.
const emptyStore = () => ({ books: {}, marks: {}, links: {}, lastSync: {}, owner: null, drafted: {}, pendingFiles: {} });
let store = Object.assign(emptyStore(), loadJSON(STORE_KEY, {}));
store.drafted = store.drafted || {};
store.pendingFiles = store.pendingFiles || {};
const CFG = window.CAIRN_CONFIG || {};
// startOn: what opening the app shows ('shelf' or 'mark'). lastBookId: the book you last marked, picked first next time.
let config = Object.assign({ theme: 'system', sort: 'page', startOn: 'shelf', lastBookId: null }, loadJSON(CONFIG_KEY, {}));

let persistTimer;
function persist() { clearTimeout(persistTimer); persistTimer = setTimeout(persistNow, 200); }
function persistNow() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  catch { toast('This device’s storage is full. Export a backup from More.'); }
}
const saveConfig = () => { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* storage unavailable */ } };

function touch(rec) { rec.updated_at = nowISO(); rec._dirty = true; }
// Call after any change to the store: saves on this device, queues a sync, rebuilds the view model.
function changed() { persist(); scheduleSync(); derive(); }

function addBook({ title, author = '', pages = null, color, kind = 'paper', example = false, created, touched }) {
  const t = nowISO();
  const b = { id: uid(), title, author, pages, color: color || nextColor(), kind, example, created_at: created || t, updated_at: t, touched_at: touched || t, deleted: false, _dirty: true };
  if (kind === 'epub') Object.assign(b, { file_path: null, file_size: null, last_cfi: null, last_pct: null });
  store.books[b.id] = b; derive(); return b;
}
function addMark(bookId, { page = null, loc = null, text = '', quote = null, status = 'kept', source = null, cfi = null, chapter = null, created, due, n = 0 } = {}) {
  const t = Date.now();
  const m = { id: uid(), book_id: bookId, page, loc, text, quote, status, source, rev_n: n, rev_due: isoAt(due || t + DAY), rev_last: null,
    created_at: created ? isoAt(created) : isoAt(t), updated_at: nowISO(), deleted: false, _dirty: true };
  if (cfi) Object.assign(m, { cfi, chapter });
  store.marks[m.id] = m; return m;
}
function addLink(a, b, because, example = false) {
  const t = nowISO();
  const l = { id: uid(), a, b, because, example, created_at: t, updated_at: t, deleted: false, _dirty: true };
  store.links[l.id] = l; return l;
}
function bump(bookId) { const b = store.books[bookId]; if (b) { b.touched_at = nowISO(); touch(b); } }

/* ───────────── view model ───────────── */
// S is rebuilt from the store after every change: live books with their kept marks nested,
// live links, and the inbox (imported Kindle highlights still waiting for your line).
let S = { books: [], links: [], inbox: [], examples: false };
function derive() {
  const books = Object.values(store.books).filter((b) => !b.deleted).map((b) => ({
    id: b.id, title: b.title, author: b.author || '', pages: b.pages || null, color: b.color, kind: b.kind === 'kindle' || b.kind === 'epub' ? b.kind : 'paper', example: !!b.example,
    created: ms(b.created_at), touched: ms(b.touched_at || b.updated_at), marks: [],
    filePath: b.file_path || null, fileSize: b.file_size || null, lastCfi: b.last_cfi || null, lastPct: b.last_pct ?? null
  }));
  const byId = new Map(books.map((b) => [b.id, b]));
  const live = new Set(), inbox = [];
  for (const r of Object.values(store.marks)) {
    if (r.deleted) continue;
    const b = byId.get(r.book_id); if (!b) continue;
    const m = { id: r.id, page: r.page ?? null, loc: r.loc ?? null, text: r.text || '', quote: r.quote || null, source: r.source || null, cfi: r.cfi || null, chapter: r.chapter || null,
      at: ms(r.created_at), rev: { n: r.rev_n || 0, due: r.rev_due ? ms(r.rev_due) : ms(r.created_at) + DAY } };
    if (r.status === 'inbox') { inbox.push({ ...m, b }); continue; }
    live.add(r.id); b.marks.push(m);
  }
  inbox.sort((x, y) => (x.b.title).localeCompare(y.b.title) || pos(x.b, x) - pos(y.b, y));
  const links = Object.values(store.links).filter((l) => !l.deleted && live.has(l.a) && live.has(l.b))
    .map((l) => ({ id: l.id, a: l.a, b: l.b, because: l.because, at: ms(l.created_at), example: !!l.example }));
  S = { books, links, inbox, examples: books.some((b) => b.example) };
}

const shelfOrder = () => [...S.books].sort((a, b) => (b.touched || b.created || 0) - (a.touched || a.created || 0));
function allMarks() { const out = []; for (const b of S.books) for (const m of b.marks) out.push({ m, b }); return out; }
function findMark(id) { for (const b of S.books) { const m = b.marks.find((x) => x.id === id); if (m) return { m, b }; } return null; }
const linksOf = (id) => S.links.filter((l) => l.a === id || l.b === id).map((l) => ({ l, other: l.a === id ? l.b : l.a }));
const isLinked = (a, b) => S.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
function shortRef(b) { const last = (b.author || '').trim().split(/\s+/).pop(); return last || b.title.split(/\s+/).slice(0, 2).join(' '); }
function gist(t) { const s = String(t).split(/\s[—–-]\s|:\s/)[0]; const w = s.split(/\s+/); return w.length <= 5 ? s : w.slice(0, 4).join(' ') + '…'; }
const dueAt = (m) => m.rev.due;
const dueList = () => { const now = Date.now(); return allMarks().filter(({ m }) => dueAt(m) <= now).sort((x, y) => dueAt(x.m) - dueAt(y.m)); };

// Paper books are numbered by page; Kindle books by location (a page too, when the book has real page numbers);
// EPUBs read in Cairn by epub.js location.
const useLoc = (b) => b.kind !== 'paper';
const unitWord = (b, n = 2) => (useLoc(b) ? (n === 1 ? 'location' : 'locations') : (n === 1 ? 'page' : 'pages'));
const pos = (b, m) => (useLoc(b) ? (m.loc ?? (m.page != null ? m.page * 15 : 0)) : (m.page ?? (m.loc != null ? m.loc / 15 : 0)));
const reach = (b) => b.marks.reduce((n, m) => Math.max(n, useLoc(b) ? (m.loc ?? 0) : (m.page ?? 0)), 0);
const refNum = (m) => (m.page != null ? String(m.page) : m.loc != null ? 'loc ' + m.loc : '?');
const whereShort = (m) => (m.page != null ? `p.${m.page}` : m.loc != null ? `loc ${fmtN(m.loc)}` : '');
const whereLong = (m) => (m.page != null ? `page ${m.page}` : m.loc != null ? `location ${fmtN(m.loc)}` : 'this mark');
const whereBoth = (m) => [m.page != null ? `p.${m.page}` : '', m.loc != null ? `loc ${fmtN(m.loc)}` : ''].filter(Boolean).join(' · ');
function cellNum(b, m) {
  const showLoc = useLoc(b) ? m.loc != null : m.page == null && m.loc != null;
  return showLoc ? `<span class="u">loc</span>${fmtN(m.loc)}` : (m.page != null ? String(m.page) : '?');
}
const reachLabel = (b, r) => (useLoc(b) ? `loc ${fmtN(r)}` : `p.${r}`);
function relDays(t) { const d = Math.round((t - Date.now()) / DAY); if (d <= 0) return 'today'; if (d === 1) return 'tomorrow'; return 'in ' + d + ' days'; }
function agoDays(t) { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }
function ring(size, stroke, frac) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, frac)));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg>`;
}

/* ───────────── server API (Claude runs on the server; the key never reaches the browser) ───────────── */
const API_ERRORS = {
  signed_out: 'Sign in with your margin account to use Claude.',
  not_allowed: 'This account isn’t allowed to use Claude here. Check ALLOWED_EMAIL in Vercel.',
  no_api_key: 'The server has no ANTHROPIC_API_KEY. Add it in Vercel and redeploy.',
  no_supabase: 'The server is missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.',
  bad_api_key: 'Anthropic rejected the API key set in Vercel.',
  billing: 'Your Anthropic account is out of credit.',
  rate_limited: 'Claude is rate-limiting requests. Try again in a minute.',
  overloaded: 'Claude is overloaded right now. Try again in a minute.',
  bad_model: 'The model name set in Vercel doesn’t exist.',
  bad_reply: 'Claude’s answer couldn’t be read. Try again.',
  bad_request: 'That request was empty or too large. Try fewer photos at a time.'
};
const aiOn = () => !!(sb && user);
async function api(path, payload, signal) {
  if (!sb) throw new Error('Claude isn’t set up on this server.');
  let token = null;
  try { const { data } = await sb.auth.getSession(); token = data.session?.access_token || null; } catch { /* offline */ }
  if (!token) throw new Error(API_ERRORS.signed_out);
  let res;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(payload), signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new Error('You’re offline. Claude works again when you’re back online.');
  }
  if (res.status === 413) throw new Error(API_ERRORS.bad_request);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(API_ERRORS[j.error] || `Claude couldn’t answer (${j.error || res.status}). Try again.`);
  return j;
}
const noteFor = ({ m, b }) => ({ id: m.id, book: b.title, author: b.author, page: m.page, loc: m.loc, chapter: m.chapter || '', text: m.text, quote: m.quote ? m.quote.slice(0, 600) : '' });
// For link suggestions the reasons already written on a mark go along too, so Claude sees how the reader connects things.
const noteForLink = (x) => Object.assign(noteFor(x), { see: linksOf(x.m.id).slice(0, 3).map((y) => y.l.because) });

/* ───────────── Supabase sync (same scheme as recall) ───────────── */
let sb = null, user = null, syncing = false, syncTimer;
let syncState = { state: 'off', text: 'This device only' };
const TABLES = [['cairn_books', 'books'], ['cairn_marks', 'marks'], ['cairn_links', 'links']];
const DATE_FIELDS = ['created_at', 'updated_at', 'touched_at', 'rev_due', 'rev_last'];
// Kindle support needs the newer columns. Until the schema update has been run, the shelf stays on this device.
let schemaOk = null, schemaHintShown = false;

function setSync(state, text) {
  syncState = { state, text };
  const el = $('#syncStatus'); if (el) { el.dataset.state = state; el.querySelector('span').textContent = text; }
}
function scheduleSync() { if (!sb || !user) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 2500); }
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const toRow = (r) => { const { _dirty, ...rest } = r; return { ...rest, user_id: user.id }; };

async function probeSchema() {
  const a = await sb.from('cairn_marks').select('loc,quote,status,source,cfi,chapter').limit(1);
  const b = await sb.from('cairn_books').select('kind,file_path,file_size,last_cfi,last_pct').limit(1);
  schemaOk = !a.error && !b.error;
}
async function pushTable(table, map) {
  const dirty = Object.values(map).filter((r) => r._dirty);
  if (!dirty.length) return;
  const snap = new Map(dirty.map((r) => [r.id, r.updated_at]));
  for (const part of chunks(dirty, 200)) {
    const { error } = await sb.from(table).upsert(part.map(toRow), { onConflict: 'id' });
    if (error) throw error;
  }
  dirty.forEach((r) => { if (map[r.id] && map[r.id].updated_at === snap.get(r.id)) map[r.id]._dirty = false; });
}
async function pullTable(table, map, key) {
  let since = store.lastSync[key] || EPOCH;
  for (;;) {
    const { data, error } = await sb.from(table).select('*').gt('server_ts', since).order('server_ts', { ascending: true }).limit(1000);
    if (error) throw error;
    for (const row of data) {
      const { user_id, server_ts, ...rec } = row;
      DATE_FIELDS.forEach((f) => { if (rec[f]) rec[f] = isoNorm(rec[f]); });
      const local = map[rec.id];
      if (!local) map[rec.id] = { ...rec, _dirty: false };
      else if (!local._dirty || ms(rec.updated_at) >= ms(local.updated_at)) { Object.assign(local, rec); local._dirty = false; }
      if (server_ts > since) since = server_ts;
    }
    store.lastSync[key] = since;
    if (data.length < 1000) break;
  }
}
async function syncNow() {
  if (!sb || !user || syncing) return;
  if (!navigator.onLine) { setSync('err', 'Offline'); return; }
  if (store.owner && store.owner !== user.id) {
    if (!confirm('This device holds a shelf from a different account. Replace it with this account’s shelf?')) { await sb.auth.signOut(); return; }
    store = emptyStore();
  }
  store.owner = user.id;
  syncing = true; setSync('busy', 'Syncing…');
  try {
    if (schemaOk !== true) await probeSchema();
    if (!schemaOk) {
      setSync('err', 'Run supabase/schema.sql');
      if (!schemaHintShown) { schemaHintShown = true; toast('Cairn’s tables in Supabase are missing or out of date. Run supabase/schema.sql again; until then your shelf stays on this device.', 8000); }
      return;
    }
    for (const [table, key] of TABLES) await pushTable(table, store[key]);
    for (const [table, key] of TABLES) await pullTable(table, store[key], key);
    persistNow(); derive();
    setSync('ok', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    queueRender();
    uploadPending();
  } catch (e) {
    console.error(e);
    setSync('err', 'Sync error');
    toast('Sync failed: ' + (e.message || e), 6000);
  } finally { syncing = false; }
}
async function initSupabase() {
  sb = null; user = null;
  if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) { setSync('off', 'This device only'); return; }
  try {
    sb = window.supabase.createClient(CFG.supabaseUrl.trim(), CFG.supabaseKey.trim());
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    sb.auth.onAuthStateChange((_e, s) => {
      user = s?.user || null;
      if (user) syncNow(); else setSync('off', 'Signed out');
      queueRender();
      if ($('#sheetMenu').open) renderMenu();
    });
    if (user) syncNow(); else setSync('off', 'Signed out');
    queueRender();
  } catch (e) { setSync('err', 'Config error'); toast('Supabase config problem: ' + e.message); }
}

/* ───────────── UI state ───────────── */
const V = { name: 'shelf', bookId: null, flash: null, inboxShow: 30,
  ask: { q: '', res: null, ai: null, ctl: null }, rv: { id: null, shown: false, done: 0, started: false } };
let deferredInstall = null;

let renderQueued = false;
// Background refreshes (sync, timers) skip while you're typing in the page, so they never steal the cursor.
function queueRender() {
  const a = document.activeElement;
  if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && $('#main').contains(a) && a.id !== 'askQ') return;
  if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); });
}
function applyTheme() {
  const t = config.theme || 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
}

/* ───────────── search ───────────── */
const STOP = new Set(('a an the and or but of to in on at for from by with about as is are was were be been being it its this that these those i you he she we they them his her their our your my me do does did why what how when where who which whom can could should would will just not no so than then too very into over under again there here have has had more most some such only own same other get got make makes made thing things way people').split(' '));
function stem(w) { const t = w.replace(/ies$/, 'y').replace(/(ing|ed|es|s|ly)$/, ''); return t.length >= 3 ? t : w; }
function toks(s) { return (String(s).toLowerCase().match(/[a-z0-9']+/g) || []).map((w) => w.replace(/'s$/, '').replace(/'/g, '')).filter((w) => w.length > 1 && !STOP.has(w)).map(stem); }
function score(qt, tt) {
  let s = 0;
  for (const q of qt) { let best = 0; for (const t of tt) { if (t === q) { best = 3; break; } if (q.length >= 3 && t.length >= 3 && (t.startsWith(q) || q.startsWith(t))) best = 2; } s += best; }
  return s;
}
function search(q) {
  const qt = toks(q), order = shelfOrder();
  if (!qt.length) return { q, walk: order.map((b) => ({ b, status: 'not' })), top: null, others: [], animate: true };
  const hits = [];
  for (const { m, b } of allMarks()) {
    const extra = linksOf(m.id).map((x) => x.l.because).join(' ') + ' ' + (m.quote || '');
    const s = score(qt, toks(m.text)) + 0.5 * score(qt, toks(extra)) + 0.25 * score(qt, toks(b.title + ' ' + (b.author || '')));
    if (s > 0) hits.push({ id: m.id, bid: b.id, s });
  }
  hits.sort((x, y) => y.s - x.s);
  const top = hits.length ? hits[0].id : null, topB = hits.length ? hits[0].bid : null;
  const via = new Set(top ? linksOf(top).map((x) => { const f = findMark(x.other); return f && f.b.id; }).filter(Boolean) : []);
  const hitBooks = new Set(hits.map((h) => h.bid));
  const walk = order.map((b) => ({ b, status: b.id === topB ? 'that' : hitBooks.has(b.id) ? 'also' : via.has(b.id) ? 'via' : 'not' }));
  return { q, walk, top, others: hits.slice(1, 5).map((h) => h.id), animate: true };
}

/* ───────────── views ───────────── */
function headHtml(title, extra = '') {
  return `<header class="h-head"><div class="h-title"><p class="eyebrow brand"><span class="logo">${I.cairn}</span>Cairn</p><h1>${title}</h1></div>${extra}</header>`;
}
const signinHint = () => (sb && !user ? `<div class="signin"><span>Sign in with your margin account to sync and use Claude.</span><button type="button" class="btn tinted" data-act="signin">Sign in</button></div>` : '');
const inboxBanner = () => (S.inbox.length ? `<div class="banner"><span>${plural(S.inbox.length, 'highlight')} waiting for your line.</span><button type="button" class="link strong" data-act="go" data-to="inbox">Review</button></div>` : '');

function viewShelf() {
  const books = shelfOrder();
  const tools = `<button type="button" class="btn primary" data-act="book-new">${I.plus}Book</button><button type="button" class="round-btn" data-act="import" aria-label="Import an EPUB or Kindle highlights">${I.import}</button><button type="button" class="round-btn" data-act="menu" aria-label="Account, export and settings">${I.more}</button>`;
  let h = headHtml('Shelf', tools);
  if (!books.length) {
    return h + signinHint() + `<section class="empty-card">
      <p class="eyebrow">Your shelf is empty</p>
      <h2>Index the book in your hands</h2>
      <p>Add the book you’re reading, or open an EPUB and read it here. When a page matters, write its number and one line in your own words. Later, ask a question and Cairn points you to the book and the page.</p>
      <ol class="steps"><li><span><b>Mark</b> a page: its number and one line.</span></li><li><span><b>Link</b> it when it’s like something in another book, and say why.</span></li><li><span><b>Ask</b> your shelf, and <b>revisit</b> pages before you forget them.</span></li></ol>
      <div class="specimen" aria-label="What an index line looks like">
        <p class="eyebrow" style="margin-bottom:2px">An index line</p>
        <div class="entry" style="cursor:default"><span class="e-text">Opportunity cost: the real price is the next-best option</span><span class="e-lead" aria-hidden="true"></span><span class="e-page">83</span></div>
        <div class="seealso"><span class="sa">see also</span><span class="ref">Kahneman 344</span><span class="gist">Sunk cost</span></div>
      </div>
      <div class="row"><button type="button" class="btn primary" data-act="book-new">${I.plus}Add a book</button><button type="button" class="btn" data-act="import" data-mode="epub">${I.book}Open an EPUB</button><button type="button" class="btn" data-act="import" data-mode="photos">${I.import}Kindle highlights</button><button type="button" class="btn" data-act="load-examples">Try an example shelf</button></div>
    </section>`;
  }
  h += signinHint() + inboxBanner();
  if (S.examples) h += `<div class="banner"><span>Example shelf. Its page numbers are made up.</span><button type="button" class="link" data-act="clear-examples">Remove</button></div>`;
  const nDue = dueList().length;
  h += `<section class="summary" aria-label="Totals">
    <div class="stat"><p class="k">Marks</p><p class="v">${allMarks().length}</p></div>
    <div class="stat s"><p class="k">See-alsos</p><p class="v">${S.links.length}</p></div>
    <div class="stat${nDue ? ' d' : ''}"><p class="k">To revisit</p><p class="v">${nDue}</p></div></section>`;
  h += `<div class="grid">` + books.map((b) => {
    const n = b.marks.length, r = reach(b), waiting = S.inbox.filter((x) => x.b.id === b.id).length;
    const kindChip = b.kind === 'kindle' ? `<span class="chip">Kindle${waiting ? ' · ' + waiting + ' new' : ''}</span>`
      : b.kind === 'epub' ? `<span class="chip">EPUB${b.lastPct ? ' · ' + Math.round(b.lastPct * 100) + '%' : ''}${waiting ? ' · ' + waiting + ' new' : ''}</span>` : '';
    return `<button type="button" class="tile" style="${accStyle(b.color)}" data-act="${b.kind === 'epub' ? 'read' : 'open-book'}" data-id="${esc(b.id)}" data-book="${esc(b.id)}"${b.kind === 'epub' ? ` aria-label="Read ${esc(b.title)}"` : ''}>
      <span class="tile-top"><span class="chip">${plural(n, 'mark')}</span>${kindChip}</span>
      <span><h3>${esc(b.title)}</h3>${b.author ? `<p class="tm">${esc(b.author)}</p>` : ''}${r ? `<span class="lead"><span>to ${useLoc(b) ? 'loc' : 'page'}</span><i aria-hidden="true"></i><span>${fmtN(r)}</span></span>` : ''}</span>
    </button>`;
  }).join('') + `</div>`;
  return h;
}

function entryHtml(b, m) {
  const see = linksOf(m.id).map(({ other }) => findMark(other)).filter(Boolean);
  return `<li id="m-${esc(m.id)}"${V.flash === m.id ? ' class="flash"' : ''}><button type="button" class="entry" data-act="open-mark" data-id="${esc(m.id)}"><span class="e-text">${esc(m.text)}</span><span class="e-lead" aria-hidden="true"></span><span class="e-page"><span class="sr">${useLoc(b) && m.loc != null ? 'location' : 'page'} </span>${cellNum(b, m)}</span></button>${see.length ? `<div class="seealso"><span class="sa">see also</span>${see.map((o) => `<button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${refNum(o.m)}</button><span class="gist">${esc(gist(o.m.text))}</span>`).join('')}</div>` : ''}</li>`;
}
const sortKey = (t) => String(t).replace(/^(the|a|an)\s+/i, '').toLowerCase();

function viewBook() {
  const b = S.books.find((x) => x.id === V.bookId);
  if (!b) return null;
  const marks = [...b.marks];
  const nLinks = marks.reduce((n, m) => n + linksOf(m.id).length, 0);
  const waiting = S.inbox.filter((x) => x.b.id === b.id).length;
  const az = config.sort === 'az';
  let h = `<div class="topbar"><div class="tb-in">
    <div class="nav"><button type="button" class="link" data-act="go" data-to="shelf">${I.back}Shelf</button><button type="button" class="icon-btn" data-act="book-edit" data-id="${esc(b.id)}" aria-label="Edit book">${I.more}</button></div>
    ${marks.length > 1 ? `<div class="seg" role="group" aria-label="Order of the index" style="--n:2"><span class="thumb" aria-hidden="true" style="transform:translateX(${az ? '100%' : '0'})"></span><button type="button" aria-pressed="${!az}" data-act="sort" data-sort="page">By ${useLoc(b) ? 'location' : 'page'}</button><button type="button" aria-pressed="${az}" data-act="sort" data-sort="az">A–Z</button></div>` : ''}
  </div></div><div class="doc">
    <div class="s-head"><p class="eyebrow">${b.kind === 'kindle' ? 'Kindle · ' : b.kind === 'epub' ? 'EPUB · ' : ''}Your index · ${plural(marks.length, 'mark')}${nLinks ? ' · ' + plural(nLinks, 'see-also') : ''}</p><h1>${esc(b.title)}</h1>${b.author ? `<p class="meta">${esc(b.author)}</p>` : ''}</div>`;
  if (waiting) h += `<div class="banner"><span>${plural(waiting, 'highlight')} from this book waiting for your line.</span><button type="button" class="link strong" data-act="go" data-to="inbox">Review</button></div>`;
  if (!marks.length) {
    if (b.kind === 'epub') h += `<div class="empty-card"><h2>No marks yet</h2><p>Open the book and select a line you want to keep. Cairn saves the quote, you write your line, and it lands here with its location.</p><button type="button" class="btn primary" data-act="read" data-book="${esc(b.id)}">${I.book}Read</button></div>`;
    else h += `<div class="empty-card"><h2>No marks yet</h2><p>When a ${unitWord(b, 1)} matters, tap Mark below and write one line in your own words.${b.kind === 'kindle' ? ' Or import your Kindle highlights.' : ''}</p>${b.kind === 'kindle' ? `<button type="button" class="btn" data-act="import" data-mode="photos" data-book="${esc(b.id)}">${I.import}Import from Kindle</button>` : ''}</div>`;
  } else {
    h += `<ul class="index">`;
    if (!az) { marks.sort((x, y) => pos(b, x) - pos(b, y) || x.at - y.at); h += marks.map((m) => entryHtml(b, m)).join(''); }
    else {
      marks.sort((x, y) => sortKey(x.text).localeCompare(sortKey(y.text)));
      let last = '';
      for (const m of marks) {
        const L = (sortKey(m.text)[0] || '#').toUpperCase(), letter = /[A-Z]/.test(L) ? L : '#';
        if (letter !== last) { h += `<li class="letter" aria-hidden="true">${letter}</li>`; last = letter; }
        h += entryHtml(b, m);
      }
    }
    h += `</ul>`;
    const r = reach(b);
    if (b.pages && r && r < b.pages) h += `<div class="think"><span>Not yet indexed</span><b>${useLoc(b) ? `loc ${fmtN(r + 1)} – ${fmtN(b.pages)}` : `p.${r + 1} – ${b.pages}`}</b></div>`;
  }
  return h + `</div>`;
}

function bookBarHtml(b) {
  const r = reach(b), n = b.marks.length;
  if (b.kind === 'epub') {
    const pct = b.lastPct != null ? Math.round(b.lastPct * 100) : null;
    return `<span class="bar-ic">${pct != null ? ring(44, 5, b.lastPct) : `<span class="bar-ic tint">${I.book}</span>`}</span><span class="bar-t"><b>${pct != null ? (pct >= 99 ? 'Finished' : `${pct}% read`) : 'Not started'}</b><span>${plural(n, 'mark')}${r ? ` · indexed to loc ${fmtN(r)}` : ''}</span></span><button type="button" class="btn primary" data-act="read" data-book="${esc(b.id)}">${pct ? 'Continue' : 'Read'}</button>`;
  }
  const lead = b.pages ? ring(44, 5, r / b.pages) : `<span class="bar-ic tint">${I.cairnLg}</span>`;
  const title = r ? `Indexed to ${reachLabel(b, fmtN(r))}` : 'Start your index';
  const sub = b.pages ? `${Math.round((r / b.pages) * 100)}% of ${fmtN(b.pages)} ${unitWord(b)}` : `${plural(n, 'mark')}${n ? '' : ' so far'}`;
  return `<span class="bar-ic">${lead}</span><span class="bar-t"><b>${title}</b><span>${sub}</span></span><button type="button" class="btn primary" data-act="mark-new" data-book="${esc(b.id)}">${useLoc(b) ? 'Mark' : 'Mark page'}</button>`;
}

function viewAskShell() {
  return headHtml('Ask') + `<form id="askForm" class="askbox" autocomplete="off">
      <label class="search"><span class="sr">Ask your shelf</span>${I.search}<input id="askQ" type="search" placeholder="Ask your shelf" value="${esc(V.ask.q)}" enterkeyhint="search"></label>
      <button type="submit" class="btn primary">Walk</button></form><div id="askResults"></div>`;
}

function viewAskResults() {
  if (!allMarks().length) return `<p class="help">There’s nothing to walk yet. Add a book and a few marks, then ask.</p>`;
  const r = V.ask.res;
  if (!r) {
    let h = `<p class="help">Ask in plain words. Cairn walks your shelf book by book and points to the page. Answers come only from your own marks.</p>`;
    if (S.examples) h += `<div class="tries" style="margin-top:14px"><button type="button" class="try" data-act="ask-try">Why do people hold on to losing bets?</button><button type="button" class="try" data-act="ask-try">What do prices tell us?</button></div>`;
    return h;
  }
  const anim = r.animate && !reduce ? ' animate' : '';
  const label = { not: 'not that one', that: 'that book', also: 'also here', via: 'via a see-also' };
  let h = `<p class="sec-h">Walking the shelf</p><ol class="group walk${anim}">` + r.walk.map((w, i) => `<li class="${w.status}" style="--i:${i}"><div class="w"><span class="wt">${esc(w.b.title)}</span><span class="ws">${label[w.status]}</span></div></li>`).join('') + `</ol>`;
  const top = r.top && findMark(r.top);
  if (top) {
    const { m, b } = top;
    const byLoc = m.page == null && m.loc != null;
    h += `<div class="found${anim}" data-acc style="--n:${r.walk.length};${accStyle(b.color)}"><p class="eyebrow">That ${byLoc ? 'location' : 'page'} · ${esc(b.title)}</p>
      <div class="pgline"><span class="p">${byLoc ? 'loc' : 'p.'}</span><span class="pg">${byLoc ? fmtN(m.loc) : m.page}</span></div>
      <p class="found-text">${esc(m.text)}</p>${m.quote ? `<p class="quote clamp">${esc(m.quote)}</p>` : ''}
      <div class="row"><button type="button" class="btn primary" data-act="goto-mark" data-id="${esc(m.id)}">Open in index</button>${m.cfi ? `<button type="button" class="btn" data-act="read-mark" data-id="${esc(m.id)}">${I.book}Open in book</button>` : ''}</div></div>`;
    const trail = linksOf(m.id).map(({ l, other }) => ({ l, o: findMark(other) })).filter((x) => x.o);
    if (trail.length) h += `<p class="sec-h">Your see-also trail</p><ul class="group">` + trail.map(({ l, o }) => `<li class="g-stack"><span class="top"><button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${refNum(o.m)}</button><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p></li>`).join('') + `</ul>`;
    const others = r.others.map(findMark).filter(Boolean);
    if (others.length) h += `<p class="sec-h">Also on your shelf</p><ul class="group">` + others.map(({ m: om, b: ob }) => `<li><button type="button" class="g-row" data-act="goto-mark" data-id="${esc(om.id)}"><span class="ref" style="${accStyle(ob.color)}" data-acc>${esc(shortRef(ob))} ${refNum(om)}</span><span class="lt">${esc(om.text)}</span></button></li>`).join('') + `</ul>`;
  } else {
    h += `<div class="found"><p class="found-text" style="margin:0">None of your marks use those words.</p><p class="help">Try other words${aiOn() ? ', or let Claude look for the idea instead of the words' : ''}.</p></div>`;
  }
  if (sb) h += viewAskAi();
  return h;
}

function viewAskAi() {
  const a = V.ask.ai;
  let h = `<p class="sec-h">Look deeper</p><div class="ai">`;
  if (!user) h += `<div class="think"><span>Sign in with your margin account and Claude can match ideas, not just words.</span><button type="button" class="btn tinted" data-act="signin">Sign in</button></div>`;
  else if (!a) h += `<div class="think"><span>Claude matches ideas, not just words. It reads only your marks and links.</span><button type="button" class="btn tinted" data-act="ask-ai">${I.spark}Look deeper</button></div>`;
  else if (a.status === 'loading') h += `<div class="think"><span>Claude is reading your marks…</span><button type="button" class="btn" data-act="ask-stop">Stop</button></div>`;
  else if (a.status === 'error') h += `<div class="think"><span>${esc(a.msg)}</span><button type="button" class="btn" data-act="ask-ai">Try again</button></div>`;
  else {
    const cites = a.ids.map(findMark).filter(Boolean);
    h += `<div class="answer-card"><p class="eyebrow">From your marks</p>`;
    if (a.answer) h += `<p class="ai-answer">${esc(a.answer)}</p>`;
    if (cites.length) h += `<div class="row">${cites.map(({ m, b }) => `<button type="button" class="ref" data-acc style="${accStyle(b.color)}" data-act="goto-mark" data-id="${esc(m.id)}">${esc(shortRef(b))} ${refNum(m)}</button>`).join('')}</div>`;
    if (!a.answer && !cites.length) h += `<p class="help">Nothing on your shelf answers this yet.</p>`;
    h += `</div>`;
    if (a.gap) h += `<p class="notice"><b>Gap</b>${esc(a.gap)}</p>`;
  }
  return h + `</div>`;
}

/* revisit: the passage comes back with its key words hidden. Say the idea in your own words, then check. */
const RV_STOP = new Set('about above after again against almost already also although always among another because before being below between both cannot could does doing during each either enough even every first from further having here however into itself just least less like made make many might more most much must never next once only other over own same several should since some still such than that their them then there these they this those though through thus under until upon very were what when where whether which while whom whose will with within without would your yours'.split(' '));
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Splits text into pieces; some are "hidden": numbers and the longer, less common words. Which ones change a little each time.
function cloze(text, seed) {
  const re = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]*|\d[\d,.]*/g;
  const words = []; let m;
  while ((m = re.exec(text))) words.push({ w: m[0], i: m.index });
  const cand = []; const seen = new Set();
  words.forEach((x, k) => {
    const lw = x.w.toLowerCase(); if (seen.has(lw)) return;
    const num = /^\d/.test(x.w);
    if (!num && (x.w.length < 6 || STOP.has(lw) || RV_STOP.has(lw))) return;
    seen.add(lw);
    cand.push({ k, score: (num ? 9 : x.w.length) + ((hashStr(seed + lw) % 100) / 50) });
  });
  const want = Math.max(2, Math.min(6, Math.round(words.length / 11)));
  const pick = new Set(cand.sort((x, y) => y.score - x.score).slice(0, want).map((x) => x.k));
  const parts = []; let at = 0;
  words.forEach((x, k) => {
    if (!pick.has(k)) return;
    if (x.i > at) parts.push({ t: text.slice(at, x.i) });
    parts.push({ t: x.w, hide: true }); at = x.i + x.w.length;
  });
  if (at < text.length) parts.push({ t: text.slice(at) });
  return parts;
}
function clozeHtml(parts, reveal) {
  return parts.map((x) => !x.hide ? esc(x.t) : reveal ? `<mark class="rv-fill">${esc(x.t)}</mark>` : `<span class="rv-blank" style="width:${Math.max(3, Math.min(12, x.t.length))}ch" aria-label="hidden word"></span>`).join('');
}
const rvText = (m) => {
  const src = (m.quote || m.text || '').replace(/\s+/g, ' ').trim();
  if (src.length <= 400) return src;
  const cut = src.slice(0, 400); return cut.slice(0, cut.lastIndexOf(' ')) + ' …';
};
// Jump from a Revisit card to the spot: the exact line in the reader for EPUBs, the book's index for everything else.
const whereBtn = (m) => m.cfi
  ? `<button type="button" class="btn lg block" data-act="read-mark" data-id="${esc(m.id)}">${I.book}Open in book · ${whereLong(m)}</button>`
  : `<button type="button" class="btn lg block" data-act="goto-mark" data-id="${esc(m.id)}">${I.book}Open in the book’s index · ${whereLong(m)}</button>`;
function viewRevisit() {
  let h = headHtml('Revisit');
  if (!allMarks().length) return h + `<section class="empty-card"><h2>Nothing to revisit yet</h2><p>Revisit brings back a passage you marked with its key words hidden, and asks you for the idea. Add a few marks first.</p></section>`;
  const due = dueList();
  let cur = V.rv.id ? findMark(V.rv.id) : null;
  if (!V.rv.started || (!cur && !due.length)) {
    const n = due.length, done = V.rv.done;
    const frac = n + done ? done / (n + done) : 1;
    const next = !n ? allMarks().sort((x, y) => dueAt(x.m) - dueAt(y.m))[0] : null;
    h += `<section class="rv-home"><div class="ring-wrap">${ring(156, 13, frac)}<div class="ring-center">${n ? `<strong>${n}</strong><span>to recall</span>` : `<span style="color:var(--acc);margin:0">${I.check}</span>`}</div></div>
      <h2 class="rv-headline">${n ? plural(n, 'idea') + ' to recall' : 'All caught up'}</h2>
      <p class="rv-sub">${n ? 'You’ll see a passage you marked with its key words hidden. Say the idea in your own words, then check it against your line.' : `Next up: ${esc(next.b.title)}, ${relDays(dueAt(next.m))}.`}</p>
      <div class="rv-actions">${n ? `<button type="button" class="btn primary lg block" data-act="rv-start">Start</button>` : `<button type="button" class="btn lg block" data-act="rv-practice">Practice a random idea</button>`}</div></section>`;
    return h;
  }
  if (!cur) { V.rv.id = due[0].m.id; V.rv.shown = false; V.rv.draft = ''; cur = due[0]; }
  const { m, b } = cur;
  const parts = cloze(rvText(m), m.id + ':' + (m.rev?.n || 0));
  const hasQuote = !!m.quote;
  h += `<section class="rv-card" data-acc style="${accStyle(b.color)}">
    <p class="rv-src">${esc(b.title)}${m.chapter ? ' · ' + esc(m.chapter) : ''}${due.length ? ' · ' + due.length + ' left' : ''}</p>
    <h2 class="rv-q">${hasQuote ? 'What’s the idea in this passage?' : 'What was the idea here?'}</h2>
    <p class="rv-passage">${clozeHtml(parts, V.rv.shown)}</p>`;
  if (!V.rv.shown) {
    h += `<label class="rv-draft-l" for="rvDraft">In your own words</label>
      <textarea id="rvDraft" class="rv-draft" rows="3" placeholder="The idea is…" autocomplete="off">${esc(V.rv.draft || '')}</textarea>
      <button type="button" class="btn primary lg block" data-act="rv-show">Check</button>
      <button type="button" class="btn lg block" data-act="rv-show">Skip, show me</button>
      ${whereBtn(m)}`;
  } else {
    const see = linksOf(m.id).map(({ l, other }) => ({ l, o: findMark(other) })).filter((x) => x.o);
    if ((V.rv.draft || '').trim()) h += `<div class="rv-mine"><span class="lbl">You said</span><p>${esc(V.rv.draft.trim())}</p></div>`;
    h += `<div class="rv-mine"><span class="lbl">Your line</span><p class="rv-ans">${esc(m.text || '(no line yet)')}</p></div>`;
    h += `<p class="help">${whereLong(m)}${m.chapter ? ' · ' + esc(m.chapter) : ''}</p>${whereBtn(m)}`;
    if (see.length) h += see.map(({ l, o }) => `<div class="g-stack" style="padding:0"><span class="top"><span class="ref">${esc(shortRef(o.b))} ${refNum(o.m)}</span><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p></div>`).join('');
    h += `<p class="rv-ask">How close was your idea?</p><div class="rv-foot"><button type="button" class="btn lg miss" data-act="rv-forgot">Missed it</button><button type="button" class="btn lg" data-act="rv-fuzzy">Partly</button><button type="button" class="btn primary lg" data-act="rv-got">Got it</button></div>`;
  }
  return h + `</section>`;
}

/* inbox: imported highlights waiting for your line */
function viewInbox() {
  let h = `<header class="h-head"><div class="h-title"><button type="button" class="link" data-act="go" data-to="shelf" style="margin-left:-6px">${I.back}Shelf</button><h1>Inbox</h1></div><button type="button" class="round-btn" data-act="import" data-mode="file" aria-label="Import more highlights">${I.import}</button></header>`;
  const items = S.inbox;
  if (!items.length) return h + `<section class="empty-card"><h2>Nothing waiting</h2><p>Kindle highlights you import land here. Each one waits until you give it a line in your own words, then moves into the book’s index.</p><button type="button" class="btn primary" data-act="import">${I.import}Import from Kindle</button></section>`;
  h += `<p class="intro">Each highlight needs one line in your words before it joins your index. Keep it, edit it, or skip it.</p>`;
  const blank = items.filter((x) => !x.text.trim() && x.quote);
  if (blank.length) {
    if (aiOn()) h += `<div class="think"><span>${plural(blank.length, 'highlight')} ${blank.length === 1 ? 'has' : 'have'} no line yet. Claude can draft them, 25 at a time; you edit before keeping.</span><button type="button" class="btn tinted" data-act="draft"${V.drafting ? ' disabled' : ''}>${I.spark}${V.drafting ? 'Drafting…' : 'Draft lines'}</button></div>`;
    else if (sb) h += `<div class="think"><span>Sign in and Claude can draft lines for these highlights.</span><button type="button" class="btn tinted" data-act="signin">Sign in</button></div>`;
  }
  let last = null, shown = 0;
  for (const it of items) {
    if (shown >= V.inboxShow) break;
    if (it.b.id !== last) {
      const n = items.filter((x) => x.b.id === it.b.id).length;
      h += `${last ? '</div>' : ''}<div class="ib-head"><h2>${esc(it.b.title)}</h2><span class="n">${n} waiting</span></div><div class="nudges" data-acc style="${accStyle(it.b.color)}">`;
      last = it.b.id;
    }
    const drafted = store.drafted[it.id] && it.text.trim();
    h += `<article class="ib" id="ib-${esc(it.id)}">
      <p class="ib-where">${[it.chapter, whereBoth(it)].filter(Boolean).map(esc).join(' · ') || 'No position'}</p>
      ${it.quote ? `<p class="quote">${esc(it.quote)}</p>` : ''}
      <label class="lbl" for="ibt-${esc(it.id)}">Your line</label>
      <textarea class="tx" id="ibt-${esc(it.id)}" data-ib="${esc(it.id)}" rows="2" maxlength="280" placeholder="This passage says… in your own words">${esc(it.text)}</textarea>
      ${drafted ? `<span class="draft-tag" id="ibd-${esc(it.id)}">Claude’s draft. Make it yours.</span>` : ''}
      <div class="row"><button type="button" class="btn" data-act="ib-skip" data-id="${esc(it.id)}">Skip</button><button type="button" class="btn primary" data-act="ib-keep" data-id="${esc(it.id)}"${it.text.trim() ? '' : ' disabled'}>Keep</button></div>
    </article>`;
    shown++;
  }
  if (last) h += `</div>`;
  if (items.length > shown) h += `<div class="row" style="justify-content:center"><button type="button" class="btn" data-act="ib-more">Show ${Math.min(30, items.length - shown)} more</button></div>`;
  return h;
}

/* discover: nudges from your shelf, then ways to use Cairn over the long run */
const IDEAS = [
  { when: 'Every reading session', items: [
    { t: 'One page, one line', d: 'End each sitting by marking the one page you’d want to find again. One good line beats five copied sentences.', a: ['mark-new', 'Mark a page'] },
    { t: 'Read EPUBs in Cairn', d: 'Open a DRM-free EPUB and read it here. Select a line when it matters and write your line on the spot, or tap Later and do it when you stop reading.', a: ['import:epub', 'Open an EPUB'] },
    { t: 'Phone beside the book', d: 'In ⋯, set Open Cairn on to Mark a page. Opening the app then goes straight to the mark sheet with your book picked and your last page or location filled in. Change the last digits, write one line, done.', a: ['menu', 'Open settings'] },
    { t: 'Mark the claim, not the fact', d: 'Write what the page argues or why it matters (“rent control shrinks supply”), not a date or a name. Claims are what you’ll search for later.' },
    { t: 'Mark disagreements too', d: 'When you think the author is wrong, mark it and say why. Your objections belong in your index as much as your agreements.' }
  ] },
  { when: 'Every week', items: [
    { t: 'The Sunday walk', d: 'Ten minutes: clear Revisit, then make one new link between two books. Most connections show up on the second look, not the first.', a: ['go:revisit', 'Open Revisit'] },
    { t: 'Empty the inbox', d: 'Turn the week’s Kindle highlights into lines. If you can’t explain a highlight in your own words, skip it: it wasn’t yours yet.', a: ['go:inbox', 'Open inbox'] },
    { t: 'Import from your Kindle', d: 'Plug the Kindle into your computer and import My Clippings.txt. Cairn only adds highlights it hasn’t seen, so importing the same file again is safe.', a: ['import:file', 'Import from Kindle'] }
  ] },
  { when: 'When you finish a book', items: [
    { t: 'Read your own index', d: 'Read the book’s index top to bottom. If a line no longer makes sense, reopen the page and rewrite it.' },
    { t: 'Three see-alsos', d: 'Link the book’s three strongest marks to anything else on your shelf. A book with no links is the first one you’ll forget.' },
    { t: 'The one-sentence book', d: 'Say what the book argues in one sentence, using only your marks. If you can’t, that’s the part to re-read.' }
  ] },
  { when: 'Thinking with your shelf', items: [
    { t: 'Ask before you search', d: 'Before you search the web, ask your shelf. You’ll find what you already know, and see the gaps.', a: ['go:ask', 'Open Ask'] },
    { t: 'Let gaps pick your next book', d: 'When Look deeper names a gap, write it down. Your next book should fill one.' },
    { t: 'The decision check', d: 'Facing a decision? Ask the shelf about it, then reopen the pages it points to. Reading the original beats remembering it.' },
    { t: 'Follow a trail', d: 'Start at one mark and follow its see-alsos from book to book. Write a paragraph about where the trail ends up: that’s the start of an essay.' },
    { t: 'Explain it in two minutes', d: 'Pick a mark and explain it to someone without the book. If you stall, the line needs work or the page needs a re-read.' }
  ] },
  { when: 'Beyond reading alone', items: [
    { t: 'Studying for an exam', d: 'Index the textbook as you go and let Revisit quiz you. Rebuilding an idea from a page number is the same work an exam asks for.' },
    { t: 'Book club', d: 'Before the meeting, export your index. Your own lines make better talking points than the blurb.', a: ['export-md', 'Export index'] },
    { t: 'Writing and work', d: 'Writing an essay, a talk or a proposal? Ask your shelf about the topic, open the pages it points to, and cite them properly.' },
    { t: 'Long articles and papers', d: 'Add a long report or paper as a book with its page count. Anything with page numbers can be indexed.' }
  ] },
  { when: 'Over the years', items: [
    { t: 'A yearly read-through', d: 'Each December, export your index and read it in one sitting. Pick the ten ideas that changed how you act.', a: ['export-md', 'Export index'] },
    { t: 'Your core library', d: 'The books that collect the most see-alsos are your core library. Re-read one every year or two; you’ll mark different pages.' },
    { t: 'Re-read against your old index', d: 'When you re-read a book, compare your old lines with what you notice now. Edit them. The difference is how much you’ve changed.' },
    { t: 'One shelf for paper and Kindle', d: 'Mark paper books as you read and import Kindle highlights once a month. One index, every book, searchable in one place.' }
  ] }
];
function actionButton(a, tint = true) {
  if (!a) return '';
  const [act, label] = a;
  const [name, to] = act.split(':');
  return `<button type="button" class="btn${tint ? ' tinted' : ''}" data-act="${name}"${to ? (name === 'import' ? ` data-mode="${to}"` : ` data-to="${to}"`) : ''}>${esc(label)}</button>`;
}
function nudges() {
  const out = [], now = Date.now(), marks = allMarks();
  if (!S.books.length) {
    out.push({ k: 'Start', t: 'Add the book you’re reading', d: 'Paper, Kindle, or an EPUB you read here. Mark a page the next time something matters.', btn: `<button type="button" class="btn tinted" data-act="book-new">Add a book</button>` });
    return out;
  }
  const reading = S.books.filter((b) => b.kind === 'epub' && b.lastPct > 0.01 && b.lastPct < 0.98).sort((a, b) => b.touched - a.touched)[0];
  if (reading) out.push({ k: 'Keep reading', t: `${reading.title}, ${Math.round(reading.lastPct * 100)}% in`, d: 'Pick up where you left off. Select a line when something matters.', btn: `<button type="button" class="btn tinted" data-act="read" data-book="${esc(reading.id)}">Continue</button>` });
  if (S.inbox.length) out.push({ k: 'Inbox', t: `${plural(S.inbox.length, 'highlight')} waiting`, d: 'Give each one a line in your own words, or skip it.', btn: actionButton(['go:inbox', 'Review']) });
  const due = dueList().length;
  if (due) out.push({ k: 'Revisit', t: `${plural(due, 'idea')} to recall today`, d: 'A passage with its key words hidden. Say the idea in your own words first.', btn: actionButton(['go:revisit', 'Start']) });
  const last = marks.reduce((t, x) => Math.max(t, x.m.at), 0);
  if (last && now - last > 7 * DAY) {
    const lb = marks.find((x) => x.m.at === last).b;
    out.push({ k: 'Keep going', t: `Your last mark was ${agoDays(last)}`, d: `It was in ${lb.title}. Even one line keeps the habit alive.`, btn: `<button type="button" class="btn tinted" data-act="mark-new" data-book="${esc(lb.id)}">Mark a page</button>` });
  }
  if (S.books.length > 1) {
    const lonely = S.books.filter((b) => b.marks.length >= 4 && !b.marks.some((m) => linksOf(m.id).length)).sort((a, b) => b.marks.length - a.marks.length)[0];
    if (lonely) out.push({ k: 'Link', t: `${lonely.title} doesn’t link to anything yet`, d: 'Pick its strongest mark and ask: what else on my shelf is this like?', btn: `<button type="button" class="btn tinted" data-act="open-book" data-id="${esc(lonely.id)}">Open the index</button>` });
  }
  const stalled = S.books.filter((b) => b.pages && reach(b) && reach(b) / b.pages < 0.9 && now - b.touched > 14 * DAY).sort((a, b) => a.touched - b.touched)[0];
  if (stalled) out.push({ k: 'Unfinished', t: `${stalled.title} stops at ${reachLabel(stalled, fmtN(reach(stalled)))}`, d: `That’s ${Math.round(reach(stalled) / stalled.pages * 100)}% of the way. Still reading it, or done with it?`, btn: `<button type="button" class="btn tinted" data-act="open-book" data-id="${esc(stalled.id)}">Open the index</button>` });
  const hub = marks.map((x) => ({ ...x, n: linksOf(x.m.id).length })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n)[0];
  if (hub) out.push({ k: 'Core idea', t: `“${gist(hub.m.text)}” connects ${hub.n} of your marks`, d: 'Ideas that keep coming back across books are worth a re-read of the original page.', btn: `<button type="button" class="btn tinted" data-act="goto-mark" data-id="${esc(hub.m.id)}">Open it</button>` });
  const old = marks.filter((x) => now - x.m.at > 30 * DAY);
  if (old.length) {
    const day = Math.floor(now / DAY), pick = old[day % old.length];   // the same old mark all day, a different one tomorrow
    out.push({ k: 'From your past', t: null, lt: pick.m.text, d: `${pick.b.title}, ${whereShort(pick.m)}, marked ${agoDays(pick.m.at)}. Do you still agree?`, btn: `<button type="button" class="btn tinted" data-act="goto-mark" data-id="${esc(pick.m.id)}">Open it</button>` });
  }
  if (!out.length) out.push({ k: 'All clear', t: 'Nothing needs you right now', d: 'Pick an idea below, or go read.', btn: '' });
  return out.slice(0, 5);
}
function viewDiscover() {
  let h = headHtml('Discover');
  h += `<p class="sec-h" style="margin-top:0">From your shelf</p><div class="nudges">` + nudges().map((n) => `<section class="nudge"><p class="k">${esc(n.k)}</p>${n.t ? `<p class="t">${esc(n.t)}</p>` : ''}${n.lt ? `<p class="lt">${esc(n.lt)}</p>` : ''}<p class="d">${esc(n.d)}</p>${n.btn ? `<div class="row">${n.btn}</div>` : ''}</section>`).join('') + `</div>`;
  h += `<p class="intro" style="margin-top:8px">Ways to use Cairn over months and years. None of them need more than a few minutes.</p>`;
  for (const sec of IDEAS) {
    h += `<p class="sec-h">${esc(sec.when)}</p><ul class="group">` + sec.items.map((it) => `<li class="idea"><p class="t">${esc(it.t)}</p><p class="d">${esc(it.d)}</p>${actionButton(it.a)}</li>`).join('') + `</ul>`;
  }
  return h;
}

function render() {
  const main = $('#main');
  let html = null;
  if (V.name === 'book') { html = viewBook(); if (html === null) V.name = 'shelf'; }
  const inBook = V.name === 'book';
  document.body.classList.toggle('in-book', inBook);
  const book = inBook ? S.books.find((x) => x.id === V.bookId) : null;
  setAcc(document.body, book ? book.color : 'moss');
  if (V.name === 'ask') {
    if (!$('#askForm')) { main.className = 'page'; main.innerHTML = viewAskShell(); }
    $('#askResults').innerHTML = viewAskResults();
    if (V.ask.res) V.ask.res.animate = false;
  } else {
    main.className = inBook ? '' : 'page';
    main.innerHTML = inBook ? html : V.name === 'revisit' ? viewRevisit() : V.name === 'discover' ? viewDiscover() : V.name === 'inbox' ? viewInbox() : viewShelf();
  }
  const bar = $('#bookBar');
  if (book) { bar.innerHTML = bookBarHtml(book); bar.hidden = false; } else bar.hidden = true;
  const cur = inBook || V.name === 'inbox' ? 'shelf' : V.name;
  for (const [id, name] of [['tabShelf', 'shelf'], ['tabAsk', 'ask'], ['tabRevisit', 'revisit'], ['tabDiscover', 'discover']]) {
    const t = document.getElementById(id);
    if (name === cur) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  const n = dueList().length, badge = $('#rvBadge');
  badge.textContent = n > 9 ? '9+' : String(n); badge.hidden = !n;
  if (R.open) paintHighlights();
  if (V.flash) {
    const el = document.getElementById('m-' + V.flash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    const f = V.flash; setTimeout(() => { if (V.flash === f) V.flash = null; }, 1600);
  }
}

function go(name) {
  closeSheets();
  V.name = name;
  if (name === 'revisit') V.rv = { id: null, shown: false, draft: '', done: 0, started: false };
  if (name === 'inbox') V.inboxShow = 30;
  render();
  if (!V.flash) window.scrollTo(0, 0);
}

/* ───────────── sheets ───────────── */
function openSheet(id) { const d = document.getElementById(id); $$('dialog[open]').forEach((x) => { if (x !== d) x.close(); }); if (!d.open) d.showModal(); return d; }
function closeSheets() { $$('dialog[open]').forEach((d) => d.close()); }

// Tap-twice confirm, as in margin.
const armedState = { key: null, t: null };
function armed(key, btn, label, fn) {
  if (armedState.key === key) { clearTimeout(armedState.t); armedState.key = null; fn(); return; }
  clearTimeout(armedState.t);
  const orig = btn.textContent; btn.textContent = label; armedState.key = key;
  armedState.t = setTimeout(() => { armedState.key = null; if (btn.isConnected) btn.textContent = orig; }, 3000);
}
const miniSeg = (act, cur, opts) => `<span class="mini-seg" role="group">${opts.map(([v, l]) => `<button type="button" aria-pressed="${cur === v}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</span>`;

/* mark a page (or a Kindle location) */
let MK = { unit: 'page' };
function openMark(bookId) {
  if (!S.books.length) { openBook(null); toast('Add the book first, then mark its pages.'); return; }
  const order = shelfOrder();
  const last = S.books.some((b) => b.id === config.lastBookId) ? config.lastBookId : null;
  const bid = bookId || (V.name === 'book' && V.bookId) || last || order[0].id;
  $('#markBooks').innerHTML = order.map((b) => `<label class="bk"><input type="radio" name="markBook" value="${esc(b.id)}"${b.id === bid ? ' checked' : ''}><span class="d" style="${dotStyle(b.color)}" aria-hidden="true"></span><span>${esc(b.title)}</span></label>`).join('');
  $('#markPage').value = ''; $('#markText').value = ''; $('#markErr').textContent = '';
  $('#markHint').textContent = 'Short beats complete. Six to twelve words is plenty.';
  const b = S.books.find((x) => x.id === bid);
  MK.unit = b && useLoc(b) ? 'loc' : 'page';
  renderMarkUnit();
  openSheet('sheetMark');
  const chk = $('#markBooks input:checked'); if (chk) chk.parentElement.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  setTimeout(focusSpot, 60);
}
// The page or location box starts at your last spot in that book, cursor at the end, so you change only the last digits.
function lastSpot(b, unit) {
  const m = [...b.marks].sort((x, y) => y.at - x.at).find((x) => (unit === 'loc' ? x.loc : x.page) != null);
  return m ? (unit === 'loc' ? m.loc : m.page) : null;
}
function prefillSpot() {
  const sel = $('input[name="markBook"]:checked');
  const b = sel && S.books.find((x) => x.id === sel.value);
  const v = b ? lastSpot(b, MK.unit) : null;
  $('#markPage').value = v ? String(v) : '';
  $('#markSpotHint').textContent = v ? `Starts at your last ${MK.unit === 'loc' ? 'location' : 'page'}, ${fmtN(v)}. Change the end.` : '';
}
function focusSpot() {
  const i = $('#markPage'); if (!i) return;
  i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch { /* some inputs refuse */ }
}
function renderMarkUnit() {
  const sel = $('input[name="markBook"]:checked');
  const b = sel && S.books.find((x) => x.id === sel.value);
  const kindle = b && b.kind === 'kindle';
  if (!kindle) MK.unit = b && useLoc(b) ? 'loc' : 'page';
  $('#markUnit').innerHTML = kindle ? miniSeg('mark-unit', MK.unit, [['loc', 'Location'], ['page', 'Page']]) : '';
  $('#markPageLbl').textContent = MK.unit === 'loc' ? 'Location' : 'Page';
  prefillSpot();
}
function submitMark(e) {
  e.preventDefault();
  const err = $('#markErr');
  const sel = $('input[name="markBook"]:checked');
  const b = sel && S.books.find((x) => x.id === sel.value);
  const n = intOrNull($('#markPage').value);
  const text = $('#markText').value.trim().replace(/\s+/g, ' ');
  const word = MK.unit === 'loc' ? 'location' : 'page number';
  if (!b) { err.textContent = 'Pick the book this is from.'; return; }
  if (!n) { err.textContent = `Enter the ${word}, like ${MK.unit === 'loc' ? '1203' : '83'}.`; $('#markPage').focus(); return; }
  const sameUnit = (MK.unit === 'loc') === useLoc(b);
  if (b.pages && sameUnit && n > b.pages) { err.textContent = `This book has ${fmtN(b.pages)} ${unitWord(b)}. Check the ${word}.`; $('#markPage').focus(); return; }
  if (!text) { err.textContent = 'Write one line about it in your own words.'; $('#markText').focus(); return; }
  const m = addMark(b.id, MK.unit === 'loc' ? { loc: n, text } : { page: n, text });
  bump(b.id); config.lastBookId = b.id; saveConfig();
  changed(); closeSheets();
  if (V.name === 'book' && V.bookId === b.id) V.flash = m.id;
  render();
  toast(`Marked ${MK.unit === 'loc' ? 'location ' + fmtN(n) : 'page ' + n}`, allMarks().length > 1 ? { label: 'Link it', act: () => openLink(m.id) } : null);
}

/* add or edit a book */
let BK = null;
function openBook(id, preset = {}) {
  const b = id ? store.books[id] : null;
  BK = { id: b ? b.id : null, kind: b ? (b.kind === 'kindle' || b.kind === 'epub' ? b.kind : 'paper') : (preset.kind || 'paper') };
  $('#bookH').textContent = b ? 'Edit book' : 'New book';
  $('#bookSave').textContent = b ? 'Save' : 'Add';
  $('#bTitle').value = b ? b.title : (preset.title || ''); $('#bAuthor').value = b ? (b.author || '') : (preset.author || ''); $('#bPages').value = b && b.pages ? b.pages : '';
  const cur = b ? (PAL[b.color] ? b.color : 'moss') : nextColor();
  $('#bColors').innerHTML = PKEYS.map((k) => `<label class="sw"><input type="radio" name="bColor" value="${k}"${k === cur ? ' checked' : ''}><span class="d" style="${dotStyle(k)}" aria-hidden="true"></span><span class="sr">${PAL[k].name}</span></label>`).join('');
  renderBookKind();
  $('#bookErr').textContent = '';
  $('#bookDanger').innerHTML = b ? `<button type="button" class="link danger" data-act="book-del">Delete book</button>` : '';
  openSheet('sheetBook');
  if (!b) setTimeout(() => $('#bTitle').focus(), 60);
}
function renderBookKind() {
  const epub = BK.kind === 'epub';
  $('#bPages').closest('.field').hidden = epub;
  $('#bKind').innerHTML = epub ? '<p class="help" style="margin:0">EPUB, read in Cairn. Locations are counted from the file.</p>' : miniSeg('book-kind', BK.kind, [['paper', 'Paper'], ['kindle', 'Kindle']]);
  $('#bPagesLbl').textContent = BK.kind === 'kindle' ? 'Total locations (optional)' : 'Total pages (optional)';
}
function submitBook(e) {
  e.preventDefault();
  const title = $('#bTitle').value.trim().replace(/\s+/g, ' ');
  const author = $('#bAuthor').value.trim().replace(/\s+/g, ' ');
  const pages = BK && BK.kind === 'epub' && BK.id ? (store.books[BK.id].pages || null) : intOrNull($('#bPages').value);
  const color = ($('input[name="bColor"]:checked') || {}).value || 'moss';
  if (!title) { $('#bookErr').textContent = 'Give the book a title.'; $('#bTitle').focus(); return; }
  if (BK && BK.id) {
    const rec = store.books[BK.id];
    const vb = S.books.find((x) => x.id === BK.id);
    const r = vb ? (BK.kind === 'kindle' ? vb.marks.reduce((n, m) => Math.max(n, m.loc ?? 0), 0) : vb.marks.reduce((n, m) => Math.max(n, m.page ?? 0), 0)) : 0;
    if (BK.kind !== 'epub' && pages && r > pages) { $('#bookErr').textContent = `You have marks past ${BK.kind === 'kindle' ? 'location' : 'page'} ${fmtN(pages)}. Check the total.`; return; }
    Object.assign(rec, { title, author, pages, color, kind: BK.kind }); touch(rec);
    changed(); closeSheets(); render(); toast('Book updated');
  } else {
    const b = addBook({ title, author, pages, color, kind: BK.kind });
    config.lastBookId = b.id; saveConfig();
    changed(); closeSheets();
    V.name = 'book'; V.bookId = b.id; render(); window.scrollTo(0, 0);
    toast(`Added ${title}`, { label: BK.kind === 'kindle' ? 'Import highlights' : 'Mark a page', act: () => (BK.kind === 'kindle' ? openImport(b.id) : openMark(b.id)) });
  }
}
function deleteBook() {
  const rec = store.books[BK.id]; if (!rec) return;
  const ids = new Set(Object.values(store.marks).filter((m) => m.book_id === rec.id && !m.deleted).map((m) => m.id));
  rec.deleted = true; touch(rec);
  ids.forEach((id) => { store.marks[id].deleted = true; touch(store.marks[id]); });
  Object.values(store.links).forEach((l) => { if (!l.deleted && (ids.has(l.a) || ids.has(l.b))) { l.deleted = true; touch(l); } });
  if (config.lastBookId === rec.id) { config.lastBookId = null; saveConfig(); }
  if (rec.kind === 'epub') { if (R.open && R.bookId === rec.id) closeReader(true); forgetFile(rec); }
  changed(); closeSheets(); V.name = 'shelf'; render(); toast(`Deleted ${rec.title}`);
}

/* one mark: edit, links, delete */
let DT = null;
function openDetail(id) { DT = { id }; renderDetail(); openSheet('sheetDetail'); }
function renderDetail() {
  const f = DT && findMark(DT.id);
  if (!f) { closeSheets(); return; }
  const { m, b } = f;
  const ls = linksOf(m.id).map(({ l, other }) => ({ l, o: findMark(other) })).filter((x) => x.o);
  const body = $('#detailBody');
  setAcc(body, b.color);
  const both = useLoc(b) || m.loc != null, epub = b.kind === 'epub';
  const pageField = `<div class="field"><label class="lbl" for="dPage">Page</label><input id="dPage" class="input page-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${m.page ?? ''}"></div>`;
  const locField = `<div class="field"><label class="lbl" for="dLoc">Location</label><input id="dLoc" class="input page-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${m.loc ?? ''}"></div>`;
  body.innerHTML = `
    <div class="sheet-head"><button type="button" class="link" data-act="close">Close</button><h2>${useLoc(b) && m.loc != null ? 'Location ' + fmtN(m.loc) : m.page != null ? 'Page ' + m.page : 'Mark'}</h2><button type="submit" form="detailForm" class="link strong">Save</button></div>
    <p class="eyebrow" style="color:var(--acc)">${esc(b.title)} · revisit ${relDays(dueAt(m))}</p>
    <form id="detailForm" class="sheet-in" style="padding:0" novalidate>
      ${epub ? `<p class="help" style="margin:0">${esc([m.chapter, m.loc ? 'location ' + fmtN(m.loc) : ''].filter(Boolean).join(' · ') || 'In the book')}</p>${m.cfi ? `<button type="button" class="btn block" data-act="read-mark" data-id="${esc(m.id)}">${I.book}Open in book</button>` : ''}` : both ? `<div class="two">${locField}${pageField}</div>` : pageField}
      <div class="field"><label class="lbl" for="dText">Your line</label><textarea id="dText" class="tx" rows="3" maxlength="280">${esc(m.text)}</textarea></div>
      ${m.quote ? `<div class="field"><div class="lbl-row"><span class="lbl">${epub ? 'Highlighted' : 'Highlighted on Kindle'}</span><button type="button" class="link copy-btn" data-act="copy-quote">${I.copy}Copy</button></div><p class="quote">${esc(m.quote)}</p></div>` : ''}
      <p class="err-msg" id="dErr" role="alert"></p>
    </form>
    <div class="field"><span class="lbl">See also</span>
    ${ls.length ? `<ul class="group" style="box-shadow:none;background:var(--fill)">${ls.map(({ l, o }) => `<li class="g-stack"><span class="top"><button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${refNum(o.m)}</button><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p><span><button type="button" class="link danger" style="font-size:15px" data-act="unlink" data-id="${esc(l.id)}">Remove link</button></span></li>`).join('')}</ul>`
      : `<p class="help" style="padding:0 4px">No links yet. Is this like something you marked in another book?</p>`}</div>
    <button type="button" class="btn primary lg block" data-act="link-from" data-id="${esc(m.id)}"${allMarks().length > 1 ? '' : ' disabled'}>${I.link}This is like…</button>
    <button type="button" class="link danger" style="align-self:center" data-act="del-mark">Delete mark</button>`;
}
function submitDetail(e) {
  e.preventDefault();
  const f = findMark(DT.id); if (!f) return;
  if (f.b.kind === 'epub' && !$('#dPage')) {
    const text = $('#dText').value.trim().replace(/\s+/g, ' ');
    if (!text) { $('#dErr').textContent = 'The line can’t be empty.'; return; }
    const rec = store.marks[DT.id]; rec.text = text; touch(rec); bump(rec.book_id);
    changed(); closeSheets(); render(); toast('Mark updated'); return;
  }
  const page = intOrNull($('#dPage') && $('#dPage').value);
  const loc = $('#dLoc') ? intOrNull($('#dLoc').value) : f.m.loc;
  const text = $('#dText').value.trim().replace(/\s+/g, ' ');
  if (!page && !loc) { $('#dErr').textContent = 'Give it a page or a location.'; return; }
  const n = useLoc(f.b) ? loc : page;
  if (f.b.pages && n && n > f.b.pages) { $('#dErr').textContent = `This book has ${fmtN(f.b.pages)} ${unitWord(f.b)}.`; return; }
  if (!text) { $('#dErr').textContent = 'The line can’t be empty.'; return; }
  const rec = store.marks[DT.id];
  Object.assign(rec, { page, loc, text }); touch(rec); bump(rec.book_id);
  changed(); closeSheets(); render(); toast('Mark updated');
}
function deleteMark() {
  const rec = store.marks[DT.id]; if (!rec) return;
  rec.deleted = true; touch(rec);
  Object.values(store.links).forEach((l) => { if (!l.deleted && (l.a === rec.id || l.b === rec.id)) { l.deleted = true; touch(l); } });
  changed(); closeSheets(); render(); toast('Mark deleted');   // render() also clears its highlight if the reader is open
}

/* link: "this is like that" */
let LK = null;
function openLink(fromId, toId) {
  const f = findMark(fromId); if (!f) return;
  LK = { from: fromId, to: toId || null, q: '', ai: null, because: '' };
  setAcc($('#linkBody'), f.b.color);
  renderLink(); openSheet('sheetLink');
}
const pairHtml = (label, f) => `<div class="pair"><span class="src">${label} · ${esc(f.b.title)} · ${whereShort(f.m)}</span><p>${esc(f.m.text)}</p></div>`;
function renderLink() {
  const f = findMark(LK.from);
  $('#linkBody').innerHTML = `
    <div class="sheet-head"><button type="button" class="link" data-act="close">Cancel</button><h2>This is like that</h2><button type="button" class="link strong" id="linkSave" data-act="link-save" disabled>Connect</button></div>
    ${pairHtml('This', f)}
    <div class="islike"><i aria-hidden="true"></i>is like</div>
    <div id="linkThat"></div>
    <div class="field"><label class="lbl" for="linkBecause">Because…</label>
      <textarea id="linkBecause" class="tx" rows="2" maxlength="240" placeholder="What do they share? Say it in your words."></textarea>
      <p class="help">You write the why. That sentence is the part that sticks.</p></div>
    <p class="err-msg" id="linkErr" role="alert"></p>`;
  $('#linkBecause').value = LK.because;
  renderThat();
}
function renderThat() {
  const el = $('#linkThat');
  if (LK.to) {
    el.innerHTML = pairHtml('That', findMark(LK.to)) + `<button type="button" class="link" data-act="link-change">Choose a different mark</button>`;
  } else {
    el.innerHTML = `<div class="field"><label class="lbl" for="linkQ">Find the other mark</label><input id="linkQ" class="input" type="search" placeholder="Search your marks" autocomplete="off" value="${esc(LK.q)}"></div>
      ${aiOn() ? `<div class="row" style="margin-top:10px"><button type="button" class="btn tinted" data-act="link-ai"${LK.ai === 'loading' ? ' disabled' : ''}>${I.spark}${LK.ai === 'loading' ? 'Looking…' : 'Suggest matches'}</button><span class="help">Claude points. You explain.</span></div>` : ''}
      ${LK.ai && LK.ai.err ? `<p class="help" style="margin-top:6px">${esc(LK.ai.err)}</p>` : ''}
      <ul class="picker" id="linkList" style="margin-top:10px">${pickerItems()}</ul>`;
  }
  updateLinkSave();
}
function pickerItems() {
  const from = findMark(LK.from);
  const aiIds = Array.isArray(LK.ai) ? LK.ai : [];
  let cands = allMarks().filter(({ m }) => m.id !== LK.from && !isLinked(LK.from, m.id));
  if (LK.q.trim()) {
    const ql = LK.q.trim().toLowerCase(), qt = toks(LK.q);
    cands = cands.map((c) => ({ c, s: score(qt, toks(c.m.text + ' ' + c.b.title + ' ' + (c.b.author || ''))) + (c.m.text.toLowerCase().includes(ql) ? 2 : 0) + (String(c.m.page) === ql || String(c.m.loc) === ql ? 5 : 0) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
  } else {
    cands.sort((x, y) => (x.b.id === from.b.id) - (y.b.id === from.b.id) || (y.b.touched || 0) - (x.b.touched || 0) || pos(x.b, x.m) - pos(y.b, y.m));
  }
  const ai = aiIds.map(findMark).filter((x) => x && cands.some((c) => c.m.id === x.m.id));
  const list = [...ai.map((x) => ({ ...x, ai: true })), ...cands.filter((c) => !aiIds.includes(c.m.id))].slice(0, 40);
  if (!list.length) return `<li class="help" style="padding:14px">${LK.q.trim() ? 'No marks match that search.' : 'No other marks yet. Mark a page in another book first.'}</li>`;
  return list.map(({ m, b, ai: isAi }) => `<li><button type="button" data-act="link-pick" data-id="${esc(m.id)}"><span class="ref" data-acc style="${accStyle(b.color)}">${esc(shortRef(b))} ${refNum(m)}</span><span class="pt">${esc(m.text)}</span>${isAi ? '<span class="tag">AI pick</span>' : ''}</button></li>`).join('');
}
function updateLinkSave() {
  const btn = $('#linkSave'); if (!btn) return;
  btn.disabled = !(LK.to && (LK.because.trim().match(/\S+/g) || []).length >= 2);
}
function saveLink() {
  const because = LK.because.trim().replace(/\s+/g, ' ');
  if (!LK.to) { $('#linkErr').textContent = 'Choose the other mark first.'; return; }
  if ((because.match(/\S+/g) || []).length < 2) { $('#linkErr').textContent = 'Write a few words on why they’re alike.'; return; }
  const a = findMark(LK.from), b = findMark(LK.to);
  if (!a || !b) return;
  addLink(LK.from, LK.to, because);
  changed(); closeSheets(); render();
  toast(`Linked to ${shortRef(b.b)} ${refNum(b.m)}`);
}
async function suggestLinks() {
  if (!aiOn() || !LK) return;
  const from = findMark(LK.from);
  const others = allMarks().filter(({ m }) => m.id !== LK.from && !isLinked(LK.from, m.id)).slice(0, 800);
  if (!others.length) return;
  const keep = LK;
  LK.ai = 'loading'; renderThat();
  try {
    const r = await api('/api/suggest', { from: noteForLink(from), others: others.map(noteForLink) });
    if (LK !== keep) return;
    const ids = (r.ids || []).filter((id) => findMark(id) && id !== LK.from);
    LK.ai = ids.length ? ids : { err: 'Claude didn’t find a close match. Search your marks instead.' };
  } catch (e) { if (LK !== keep) return; LK.ai = { err: e.message }; }
  if (findMark(LK.from) && $('#sheetLink').open) renderThat();
}

/* look deeper */
async function askAi() {
  const q = V.ask.q.trim();
  if (!q || !aiOn()) return;
  const ctl = new AbortController();
  V.ask.ctl = ctl; V.ask.ai = { status: 'loading' }; if (V.name === 'ask') render();
  try {
    const r = await api('/api/ask', { question: q, notes: allMarks().slice(0, 2000).map(noteFor), links: S.links.map((l) => ({ a: l.a, b: l.b, because: l.because })) }, ctl.signal);
    V.ask.ai = { status: 'done', ids: (r.ids || []).filter((id) => findMark(id)), answer: r.answer || '', gap: r.gap || '' };
  } catch (e) {
    V.ask.ai = e && e.name === 'AbortError' ? null : { status: 'error', msg: e.message };
  }
  V.ask.ctl = null;
  if (V.name === 'ask') render();
}

/* revisit: pass → 3 days → 7 → growing; miss → tomorrow (recall's steps) */
function grade(ok) {
  // ok: true = got it, false = missed it, 'part' = partly (stays on the same step, back in 3 days)
  const rec = store.marks[V.rv.id]; if (!rec) return;
  const n = ok === true ? (rec.rev_n || 0) + 1 : ok === 'part' ? (rec.rev_n || 0) : 0;
  const days = ok === true ? STEPS[Math.min(n, STEPS.length - 1)] : ok === 'part' ? 3 : 1;
  Object.assign(rec, { rev_n: n, rev_due: isoAt(Date.now() + days * DAY), rev_last: nowISO() }); touch(rec);
  changed();
  V.rv.id = null; V.rv.shown = false; V.rv.draft = ''; V.rv.done += 1;
  render(); window.scrollTo(0, 0);
  toast(ok === false ? 'You’ll see it again tomorrow' : `Next look in ${plural(days, 'day')}`);
}

/* ───────────── import: EPUB files and Kindle highlights ───────────── */
// An EPUB opens in Cairn's reader. Kindle highlights come two ways: photos of the e-reader screen
// (Claude reads them) or the clippings file (parsed here, no AI).
let IM = null;
function openImport(bookId, mode) {
  const kindleBooks = S.books.filter((b) => b.kind === 'kindle');
  const forKindle = bookId && (S.books.find((b) => b.id === bookId) || {}).kind === 'kindle';
  IM = { mode: mode || (forKindle ? 'photos' : 'epub'), bookId: bookId || (kindleBooks[0] && kindleBooks[0].id) || 'new', title: '', author: '', files: [], busy: false, done: 0, total: 0, err: '', parsed: null, pick: new Set() };
  renderImport(); openSheet('sheetImport');
}
function renderImport() {
  const body = $('#importBody');
  setAcc(body, 'moss');
  const modes = [['epub', 'EPUB book'], ['photos', 'Kindle photos'], ['file', 'Clippings']], mi = modes.findIndex(([k]) => k === IM.mode);
  let h = `<div class="sheet-head"><button type="button" class="link" data-act="close">Cancel</button><h2>Import</h2><span></span></div>
    <div class="seg" role="group" aria-label="What to import" style="--n:3"><span class="thumb" aria-hidden="true" style="transform:translateX(${mi * 100}%)"></span>${modes.map(([k, l]) => `<button type="button" aria-pressed="${IM.mode === k}" data-act="im-mode" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (IM.mode === 'epub') {
    h += `<label class="drop" for="epubInput"><span class="ic">${I.book}</span><span><b>${IM.busy ? 'Opening…' : 'Choose an EPUB'}</b><small>A .epub file from this device</small></span></label>
      <p class="help">Cairn opens it in its reader. Select a line to mark it: Cairn keeps the quote and its location, and you write your line now or later. ${sb && user ? 'The file is saved privately to your account, so it opens on your other devices too.' : sb ? 'Sign in and the file is saved privately to your account, so it opens on your other devices too.' : 'The file stays on this device.'}</p>
      <p class="help"><b>DRM-free books only.</b> Books bought in the Kindle, Apple Books or Google Play stores are usually locked. Standard Ebooks, Project Gutenberg, Humble Bundle and many indie publishers sell or give away DRM-free EPUBs.</p>`;
    if (IM.err) h += `<p class="err-msg">${esc(IM.err)}</p>`;
  } else if (IM.mode === 'photos') {
    const order = [...S.books].sort((a, b) => (b.kind === 'kindle') - (a.kind === 'kindle') || b.touched - a.touched);
    h += `<fieldset class="field"><legend>Which book?</legend><div class="chips">${order.map((b) => `<label class="bk"><input type="radio" name="imBook" value="${esc(b.id)}"${IM.bookId === b.id ? ' checked' : ''}><span class="d" style="${dotStyle(b.color)}" aria-hidden="true"></span><span>${esc(b.title)}</span></label>`).join('')}<label class="bk"><input type="radio" name="imBook" value="new"${IM.bookId === 'new' ? ' checked' : ''}><span>${I.plus}</span><span>New book</span></label></div></fieldset>`;
    if (IM.bookId === 'new') h += `<div class="two"><div class="field"><label class="lbl" for="imTitle">Title</label><input id="imTitle" class="input" autocomplete="off" value="${esc(IM.title)}"></div><div class="field"><label class="lbl" for="imAuthor">Author</label><input id="imAuthor" class="input" autocomplete="off" value="${esc(IM.author)}"></div></div>`;
    h += `<label class="drop" for="photoInput"><span class="ic">${I.camera}</span><span><b>${IM.files.length ? plural(IM.files.length, 'photo') + ' chosen' : 'Choose photos'}</b><small>${IM.files.length ? 'Tap to choose different ones' : 'Photos of your Kindle screen, up to 20 at a time'}</small></span></label>
      <p class="help">Shoot the screen straight on, with the whole page and the footer (location or page) in the picture. Claude reads your own highlights and ignores Popular Highlights. Each photo costs about a cent of Claude usage.</p>`;
    if (IM.busy) h += `<div class="field"><span class="lbl">Reading ${IM.done} of ${IM.total} photos…</span><div class="progress"><i style="width:${IM.total ? Math.round(IM.done / IM.total * 100) : 0}%"></i></div></div>`;
    if (IM.err) h += `<p class="err-msg">${esc(IM.err)}</p>`;
    if (!aiOn()) h += sb ? `<div class="think"><span>Reading photos needs Claude. Sign in with your margin account first.</span><button type="button" class="btn tinted" data-act="signin">Sign in</button></div>` : `<p class="help">Reading photos needs Claude, which isn’t set up on this server. The clippings file works without it.</p>`;
    h += `<button type="button" class="btn primary lg block" data-act="im-read"${!IM.files.length || IM.busy || !aiOn() ? ' disabled' : ''}>${I.spark}${IM.busy ? 'Reading…' : 'Read highlights'}</button>`;
  } else {
    h += `<label class="drop" for="clipInput"><span class="ic">${I.file}</span><span><b>${IM.parsed ? esc(IM.parsed.name) : 'Choose My Clippings.txt'}</b><small>${IM.parsed ? 'Tap to choose a different file' : 'Or the notebook export (.html), or KOReader’s highlight files (.json)'}</small></span></label>
      <p class="help">Connect your Kindle to your computer with its USB cable. It shows up as a drive named Kindle: open <b>documents</b> and choose <b>My Clippings.txt</b>. This is read on your device with no AI, so it’s free and exact. Your own Kindle notes become your lines. Using KOReader? Choose its highlight files (one .json per book, in the folder HighlightSync saves to); you can choose several at once. KOReader’s page numbers change with your font size.</p>`;
    if (IM.err) h += `<p class="err-msg">${esc(IM.err)}</p>`;
    if (IM.parsed) {
      const books = IM.parsed.books;
      if (!books.length) h += `<p class="help">No highlights or notes found in that file.</p>`;
      else {
        const total = books.filter((b) => IM.pick.has(b.key)).reduce((n, b) => n + b.fresh.length, 0);
        h += `<fieldset class="field"><legend>Books in this file</legend><ul class="picklist">${books.map((b) => `<li><label><input type="checkbox" data-pick="${esc(b.key)}"${IM.pick.has(b.key) ? ' checked' : ''}${b.fresh.length ? '' : ' disabled'}><span class="t"><b>${esc(b.title)}</b><span>${b.author ? esc(b.author) + ' · ' : ''}${b.fresh.length ? plural(b.fresh.length, 'new highlight') : 'nothing new'}${b.items.length > b.fresh.length ? ` · ${b.items.length - b.fresh.length} already in Cairn` : ''}${b.existing ? '' : ' · new book'}</span></span></label></li>`).join('')}</ul></fieldset>
          <button type="button" class="btn primary lg block" data-act="im-add"${total ? '' : ' disabled'}>Add ${plural(total, 'highlight')} to inbox</button>`;
      }
    }
  }
  body.innerHTML = h;
}

// Shrink a photo before upload: long edge 1568px (enough for e-ink text), JPEG.
async function shrink(file) {
  let src;
  try { src = await createImageBitmap(file); }
  catch {
    src = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const w = src.width, h = src.height, k = Math.min(1, 1568 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  return { type: 'image/jpeg', data };
}
function existingKeys(bookId) {
  const keys = new Set();
  for (const r of Object.values(store.marks)) if (!r.deleted && r.book_id === bookId) { if (r.quote) keys.add(quoteKey(r.quote)); else keys.add('n:' + quoteKey(r.text)); }
  return keys;
}
async function readPhotos() {
  if (!aiOn() || !IM.files.length || IM.busy) return;
  let book;
  if (IM.bookId === 'new') {
    IM.title = ($('#imTitle') || {}).value?.trim() || ''; IM.author = ($('#imAuthor') || {}).value?.trim() || '';
    if (!IM.title) { IM.err = 'Give the book a title first.'; renderImport(); return; }
  } else book = S.books.find((b) => b.id === IM.bookId);
  IM.busy = true; IM.err = ''; IM.done = 0; IM.total = IM.files.length; renderImport();
  const found = [], failed = [];
  const meta = book ? { title: book.title, author: book.author } : { title: IM.title, author: IM.author };
  for (const part of chunks(IM.files, 4)) {
    const images = [];
    for (const f of part) { try { images.push(await shrink(f)); } catch { failed.push(f.name); } }
    if (images.length) {
      try { const r = await api('/api/kindle', { book: meta, images }); found.push(...(r.items || [])); }
      catch (e) { IM.err = e.message; IM.busy = false; renderImport(); if (!found.length) return; break; }
    }
    IM.done = Math.min(IM.total, IM.done + part.length); renderImport();
  }
  IM.busy = false;
  if (!book) { const rec = addBook({ title: IM.title, author: IM.author, kind: 'kindle' }); book = S.books.find((b) => b.id === rec.id); }
  const seen = existingKeys(book.id);
  let added = 0;
  for (const it of found) {
    const key = quoteKey(it.quote); if (!key || seen.has(key)) continue; seen.add(key);
    const m = addMark(book.id, { page: it.page, loc: it.loc, quote: it.partial ? it.quote + ' …' : it.quote, text: it.draft || '', status: 'inbox', source: 'kindle-photo' });
    if (it.draft) store.drafted[m.id] = true;
    added++;
  }
  bump(book.id); changed();
  const note = failed.length ? ` ${plural(failed.length, 'photo')} couldn’t be opened; use JPG or PNG.` : '';
  if (!added) { IM.err = (found.length ? 'Those highlights are already in Cairn.' : 'No highlights found. Make sure the shaded text and the footer are in the photo.') + note; renderImport(); return; }
  closeSheets(); go('inbox');
  toast(`${plural(added, 'highlight')} in your inbox.${note}`, 6000);
}

// "Title (Author)" → { title, author }, turning "Sowell, Thomas" into "Thomas Sowell".
function splitTitle(head) {
  const m = head.match(/^(.*)\(([^()]*)\)\s*$/);
  let title = head.trim(), author = '';
  if (m) { title = m[1].trim(); author = m[2].trim(); }
  if (/^[^,;]+,\s*[^,;]+$/.test(author)) { const [last, first] = author.split(/,\s*/); author = `${first} ${last}`; }
  author = author.replace(/\s*;\s*/g, ', ');
  return { title: title.replace(/^﻿/, ''), author };
}
// Kindle e-reader: My Clippings.txt. Entries end with "==========".
function parseClippings(text) {
  const books = new Map();
  const get = (title, author) => { const k = titleKey(title); if (!books.has(k)) books.set(k, { key: k, title, author, hl: [], notes: [] }); return books.get(k); };
  for (const chunk of text.replace(/^﻿/, '').replace(/\r/g, '').split(/\n?==========\s*\n?/)) {
    const lines = chunk.split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    if (lines.length < 3) continue;
    const meta = lines[1].trim(), body = lines.slice(2).join('\n').trim();
    const kind = /bookmark/i.test(meta) ? 'bookmark' : /\bnote\b/i.test(meta) ? 'note' : /highlight/i.test(meta) ? 'highlight' : null;
    if (!kind || kind === 'bookmark' || !body) continue;
    const { title, author } = splitTitle(lines[0].trim());
    const pm = meta.match(/page\s+(\d+)/i), lm = meta.match(/location\s+(\d+)(?:\s*-\s*(\d+))?/i);
    const added = (meta.match(/Added on\s+(.+)$/i) || [])[1];
    const at = added ? Date.parse(added.replace(/^[A-Za-z]+,\s*/, '')) : NaN;
    const e = { page: pm ? +pm[1] : null, loc: lm ? +lm[1] : null, locEnd: lm ? +(lm[2] || lm[1]) : null, text: body.replace(/\s+/g, ' '), at: Number.isFinite(at) ? at : null };
    const b = get(title, author);
    (kind === 'note' ? b.notes : b.hl).push(e);
  }
  return finishParsed([...books.values()], 'kindle-clippings');
}
// Kindle app: the notebook export (Notebook → Export → HTML), sent by email.
function parseNotebookHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('.bookTitle')?.textContent || '').trim();
  if (!title) return finishParsed([], 'kindle-export');
  const author = (doc.querySelector('.authors')?.textContent || '').trim();
  const b = { key: titleKey(title), title, author: splitTitle(`x (${author})`).author, hl: [], notes: [] };
  for (const head of doc.querySelectorAll('.noteHeading')) {
    let next = head.nextElementSibling; while (next && !next.classList.contains('noteText')) next = next.nextElementSibling;
    const body = (next?.textContent || '').replace(/\s+/g, ' ').trim(); if (!body) continue;
    const t = head.textContent || '';
    const pm = t.match(/page\s+(\d+)/i), lm = t.match(/location\s+(\d+)/i);
    const e = { page: pm ? +pm[1] : null, loc: lm ? +lm[1] : null, locEnd: lm ? +lm[1] : null, text: body, at: null };
    (/^\s*note/i.test(t) ? b.notes : b.hl).push(e);
  }
  return finishParsed([b], 'kindle-export');
}
// KOReader (on a Kindle or other e-reader) with the HighlightSync plugin: one JSON file per book,
// "Title - Author.sdr-….json", holding a list of highlights. The book isn't named inside the file, so it comes from the file name.
function koBookFromName(name) {
  let n = String(name || '').replace(/\.json$/i, '').replace(/\.sdr[-_\d]*$/i, '').replace(/_/g, ' ').trim();
  let title = n, author = '';
  const cut = n.lastIndexOf(' - ');
  if (cut > 0) { title = n.slice(0, cut).trim(); author = n.slice(cut + 3).trim(); }
  const art = title.match(/^(.*?),?\s{2,}(The|A|An)$/i);           // "River of Doubt  The" was "River of Doubt, The"
  title = (art ? `${art[2]} ${art[1]}` : title).replace(/\s+/g, ' ').trim();
  return { title: title || 'Untitled', author: author.replace(/\s+/g, ' ') };
}
function koRaw(text, name) {
  let j; try { j = JSON.parse(text.replace(/^﻿/, '')); } catch { return null; }
  const list = Array.isArray(j) ? j : Array.isArray(j?.highlights) ? j.highlights : null;
  if (!list || !list.some((h) => h && typeof h.text === 'string' && (h.pos0 || h.pageno || h.datetime))) return null;
  const { title, author } = koBookFromName(name);
  // While a highlight is being dragged the plugin can save the shorter versions first. Keep the longest one per start point.
  const byStart = new Map();
  for (const h of list) {
    const t = String(h?.text || '').replace(/\s+/g, ' ').trim(); if (!t) continue;
    const k = String(h.pos0 || t.slice(0, 40));
    const prev = byStart.get(k);
    if (!prev || t.length > prev.text.length) byStart.set(k, { text: t, page: Number.isFinite(+h.pageno) && +h.pageno > 0 ? Math.round(+h.pageno) : null,
      at: Date.parse(String(h.datetime || '').replace(' ', 'T')) || null, note: String(h.note || '').replace(/\s+/g, ' ').trim(), chapter: String(h.chapter || '') });
  }
  const hl = [...byStart.values()].map((x) => ({ page: x.page, loc: null, locEnd: null, text: x.text, at: Number.isFinite(x.at) ? x.at : null, note: x.note }));
  return { key: titleKey(title), title, author, kind: 'paper', hl, notes: [] };
}
// Highlights you extended appear twice; keep the later one. Notes attach to the highlight they sit on.
function finishParsed(raw, source) {
  const books = raw.map((b) => {
    const hl = [];
    for (const h of b.hl) {
      const i = hl.findIndex((x) => x.loc != null && h.loc != null && x.loc <= h.locEnd && h.loc <= x.locEnd &&
        (x.text.includes(h.text.slice(0, 30)) || h.text.includes(x.text.slice(0, 30))));
      if (i >= 0) hl[i] = h; else hl.push(h);
    }
    const items = hl.map((h) => ({ page: h.page, loc: h.loc, quote: h.text, note: h.note || '', at: h.at }));
    for (const n of b.notes) {
      const host = items.find((it, i) => i < hl.length && !it.note && hl[i].loc != null && n.loc != null && hl[i].loc <= n.loc && n.loc <= hl[i].locEnd);
      if (host) host.note = n.text; else items.push({ page: n.page, loc: n.loc, quote: null, note: n.text, at: n.at });
    }
    const existing = S.books.find((x) => titleKey(x.title) === b.key) || null;
    const seen = existing ? existingKeys(existing.id) : new Set();
    const fresh = items.filter((it) => { const k = it.quote ? quoteKey(it.quote) : 'n:' + quoteKey(it.note); if (seen.has(k)) return false; seen.add(k); return true; });
    return { key: b.key, title: b.title, author: b.author, kind: b.kind || 'kindle', items, fresh, existing };
  }).filter((b) => b.items.length).sort((a, b) => b.fresh.length - a.fresh.length);
  return { source, books };
}
async function readClipFile(files) {
  files = [].concat(files); IM.err = ''; IM.parsed = null;
  try {
    const raws = []; let source = 'kindle-clippings', other = null;
    for (const file of files) {
      const text = await file.text();
      const ko = koRaw(text, file.name);
      if (ko) { raws.push(ko); source = 'koreader'; continue; }
      if (files.length === 1) other = /<html|class=["']?noteText/i.test(text) ? parseNotebookHtml(text) : parseClippings(text);
    }
    let parsed;
    if (other) parsed = other;
    else if (raws.length) {
      const byKey = new Map();
      for (const r of raws) { const e = byKey.get(r.key); if (e) e.hl.push(...r.hl); else byKey.set(r.key, r); }
      parsed = finishParsed([...byKey.values()], 'koreader');
    } else throw new Error('unreadable');
    IM.parsed = { name: files.length > 1 ? `${files.length} files` : files[0].name, ...parsed };
    IM.pick = new Set(parsed.books.filter((b) => b.fresh.length).map((b) => b.key));
  } catch (e) { IM.err = 'That file couldn’t be read. Choose My Clippings.txt from the Kindle’s documents folder, or the highlights files KOReader saves.'; }
  renderImport();
}
function addParsed() {
  const P = IM.parsed; if (!P) return;
  let added = 0, booksMade = 0;
  for (const b of P.books) {
    if (!IM.pick.has(b.key) || !b.fresh.length) continue;
    let bookId = b.existing && b.existing.id;
    if (!bookId) { bookId = addBook({ title: b.title, author: b.author, kind: b.kind || 'kindle' }).id; booksMade++; }
    for (const it of b.fresh) {
      addMark(bookId, { page: it.page, loc: it.loc, quote: it.quote, text: it.note || '', status: 'inbox', source: P.source, created: it.at || undefined });
      added++;
    }
    bump(bookId);
  }
  changed(); closeSheets(); go('inbox');
  toast(`${plural(added, 'highlight')} in your inbox${booksMade ? `, ${plural(booksMade, 'new book')} on your shelf` : ''}.`, 6000);
}

/* inbox actions */
function keepInbox(id) {
  const rec = store.marks[id]; if (!rec) return;
  const text = (rec.text || '').trim().replace(/\s+/g, ' ');
  if (!text) { toast('Write a line first.'); return; }
  Object.assign(rec, { text, status: 'kept', rev_n: 0, rev_due: isoAt(Date.now() + DAY) }); touch(rec); bump(rec.book_id);
  delete store.drafted[id];
  changed(); render();
  toast('Kept in your index', allMarks().length > 1 ? { label: 'Link it', act: () => openLink(id) } : null);
}
function skipInbox(id) {
  const rec = store.marks[id]; if (!rec) return;
  rec.deleted = true; touch(rec); delete store.drafted[id];
  changed(); render();
  toast('Skipped', { label: 'Undo', act: () => { rec.deleted = false; touch(rec); changed(); render(); } });
}
async function draftInbox() {
  if (!aiOn() || V.drafting) return;
  const todo = S.inbox.filter((x) => !x.text.trim() && x.quote).slice(0, 25);
  if (!todo.length) return;
  V.drafting = true; render();
  try {
    const r = await api('/api/draft', { items: todo.map((x) => ({ id: x.id, book: x.b.title, author: x.b.author, quote: x.quote.slice(0, 1500) })) });
    let n = 0;
    for (const d of r.drafts || []) {
      const rec = store.marks[d.id];
      if (rec && !rec.deleted && rec.status === 'inbox' && !(rec.text || '').trim() && d.line) { rec.text = d.line; touch(rec); store.drafted[d.id] = true; n++; }
    }
    changed();
    toast(n ? `${plural(n, 'line')} drafted. Edit each before you keep it.` : 'Claude couldn’t draft lines for these. Write them yourself.');
  } catch (e) { toast(e.message, 6000); }
  V.drafting = false; render();
}

/* example shelf */
function loadExamples() {
  const now = Date.now();
  const shelf = [
    { title: 'Basic Economics', author: 'Thomas Sowell', pages: 700, color: 'ember', kind: 'paper', t: 3, marks: [
      [12, 'Scarcity: any use of a thing is a use denied elsewhere', 40, 6], [27, 'Prices are signals, not just costs', 38, -0.1],
      [48, 'Rent control shrinks the housing it means to protect', 36, 9], [83, 'Opportunity cost: the real price is the next-best option', 33, 12],
      [112, 'Every policy has a second act nobody votes on', 30, -0.05], [140, 'Incentives beat intentions', 27, 4]] },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', pages: 500, color: 'indigo', kind: 'paper', t: 1, marks: [
      [20, 'Two systems: fast intuition and slow effort', 25, 8], [119, 'Anchoring: the first number drags the estimate', 22, 2],
      [283, 'Losses feel about twice as strong as gains', 19, -0.2], [344, 'Sunk cost: we keep paying because we already paid', 16, 5],
      [410, 'We judge an experience by its peak and its end', 12, 10]] },
    { title: 'The Psychology of Money', author: 'Morgan Housel', pages: 3400, color: 'lagoon', kind: 'kindle', t: 0, marks: [
      [212, 'Your own experience sets your view of risk', 9, 3], [498, 'Knowing when you have enough', 7, 6],
      [1045, 'Compounding rewards time more than brilliance', 5, 1], [2190, 'Room for error keeps you in the game', 2, 1]] }
  ];
  const ids = {};
  shelf.forEach((s, i) => {
    const b = addBook({ title: s.title, author: s.author, pages: s.pages, color: s.color, kind: s.kind, example: true, created: isoAt(now - (50 - i) * DAY), touched: isoAt(now - s.t * DAY) });
    for (const [n, text, ago, dueIn] of s.marks) ids[i + ':' + n] = addMark(b.id, { ...(s.kind === 'kindle' ? { loc: n } : { page: n }), text, created: now - ago * DAY, due: now + dueIn * DAY, n: 1 }).id;
  });
  addLink(ids['0:83'], ids['1:344'], 'Both say the past is spent. Only the next choice counts.', true);
  addLink(ids['1:283'], ids['2:212'], 'Fear of loss is learned from what you lived through.', true);
  addLink(ids['0:112'], ids['2:2190'], 'You have to plan for consequences you can’t see yet.', true);
  changed(); V.name = 'shelf'; render();
  toast('Example shelf loaded');
}
function clearExamples() {
  const books = Object.values(store.books).filter((b) => b.example && !b.deleted);
  const bookIds = new Set(books.map((b) => b.id));
  books.forEach((b) => { b.deleted = true; touch(b); });
  const markIds = new Set();
  Object.values(store.marks).forEach((m) => { if (!m.deleted && bookIds.has(m.book_id)) { m.deleted = true; touch(m); markIds.add(m.id); } });
  Object.values(store.links).forEach((l) => { if (!l.deleted && (l.example || markIds.has(l.a) || markIds.has(l.b))) { l.deleted = true; touch(l); } });
  if (V.bookId && bookIds.has(V.bookId)) V.name = 'shelf';
  V.ask = { q: '', res: null, ai: null, ctl: null };
  changed(); closeSheets(); render(); toast('Examples removed');
}

/* more: account, export, appearance */
function openMenu() { renderMenu(); openSheet('sheetMenu'); }
function renderMenu() {
  const account = !sb
    ? `<li class="g-stack"><span>Sync isn’t set up</span><span class="help">This server has no SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY, so your shelf stays on this device and Claude is off.</span></li>`
    : user
      ? `<li class="g-stack"><span>Signed in as</span><span class="help">${esc(user.email || '')}</span></li>
         <li><button type="button" class="g-row acc" data-act="sync">Sync now</button></li>
         <li><button type="button" class="g-row danger" data-act="signout">Sign out</button></li>`
      : `<li><button type="button" class="g-row acc" data-act="signin">Sign in<span class="val">Same account as margin</span></button></li>`;
  const t = config.theme || 'system', ti = ['system', 'light', 'dark'].indexOf(t);
  $('#menuBody').innerHTML = `
    <div class="sheet-head"><span></span><h2>Cairn</h2><button type="button" class="link strong" data-act="close">Done</button></div>
    <p class="sync" id="syncStatus" data-state="${syncState.state}"><i aria-hidden="true"></i><span>${esc(syncState.text)}</span></p>
    <ul class="group" style="box-shadow:none;background:var(--fill)">${account}</ul>
    <ul class="group" style="box-shadow:none;background:var(--fill)">
      <li><button type="button" class="g-row acc" data-act="book-new">Add a book</button></li>
      <li><button type="button" class="g-row acc" data-act="import" data-mode="epub">Open an EPUB</button></li>
      <li><button type="button" class="g-row acc" data-act="import" data-mode="file">Import Kindle highlights</button></li>
      ${S.inbox.length ? `<li><button type="button" class="g-row acc" data-act="go" data-to="inbox">Inbox<span class="val">${S.inbox.length}</span></button></li>` : ''}
      ${allMarks().length ? `<li><button type="button" class="g-row acc" data-act="export-md">Export index as Markdown</button></li>` : ''}
      <li><button type="button" class="g-row acc" data-act="export-json">Export backup</button></li>
      ${deferredInstall ? `<li><button type="button" class="g-row acc" data-act="install">Install Cairn</button></li>` : ''}
      ${S.examples ? `<li><button type="button" class="g-row danger" data-act="clear-examples">Remove example shelf</button></li>` : ''}
    </ul>
    <div class="field"><div class="unit-row"><span class="lbl">Open Cairn on</span>${miniSeg('start-on', config.startOn === 'mark' ? 'mark' : 'shelf', [['shelf', 'Shelf'], ['mark', 'Mark a page']])}</div>
      <p class="help">Choose Mark a page to read with your phone beside you: opening the app goes straight to the mark sheet, with your book picked and your last spot filled in.</p></div>
    <div class="field"><span class="lbl">Appearance</span>
      <div class="seg theme-seg" role="group" aria-label="Appearance"><span class="thumb" aria-hidden="true" style="transform:translateX(${ti * 100}%)"></span>
        <button type="button" aria-pressed="${t === 'system'}" data-act="theme" data-v="system">Automatic</button><button type="button" aria-pressed="${t === 'light'}" data-act="theme" data-v="light">Light</button><button type="button" aria-pressed="${t === 'dark'}" data-act="theme" data-v="dark">Dark</button></div></div>
    <p class="help">Ideas for using Cairn over the long run are in the Discover tab.</p>`;
}
function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportMd() {
  let md = `# My Cairn index\n\nExported ${new Date().toLocaleDateString()}\n`;
  for (const b of shelfOrder()) {
    md += `\n## ${b.title}${b.author ? ' — ' + b.author : ''}${b.kind === 'kindle' ? ' (Kindle)' : b.kind === 'epub' ? ' (EPUB)' : ''}\n\n`;
    for (const m of [...b.marks].sort((x, y) => pos(b, x) - pos(b, y))) {
      md += `- ${[m.chapter, whereBoth(m)].filter(Boolean).join(' · ')} · ${m.text}\n`;
      if (m.quote) md += `  > ${m.quote}\n`;
      for (const { l, other } of linksOf(m.id)) { const o = findMark(other); if (o) md += `  - see also: ${o.b.title}, ${whereShort(o.m)} (because: ${l.because})\n`; }
    }
  }
  download(`cairn-index-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown');
}
function exportJson() {
  const live = (map) => Object.values(map).filter((r) => !r.deleted).map(({ _dirty, ...r }) => r);
  download(`cairn-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ books: live(store.books), marks: live(store.marks), links: live(store.links) }, null, 2), 'application/json');
}

/* sign in (same flow as recall; accounts are margin's) */
function openAuth() {
  $('#auEmail').value = ''; $('#auPass').value = '';
  const msg = $('#auMsg'); msg.textContent = 'Same email and password as margin and recall.'; msg.classList.remove('err');
  openSheet('sheetAuth');
  setTimeout(() => $('#auEmail').focus(), 60);
}
async function submitAuth(e) {
  e.preventDefault();
  if (!sb) return;
  const msg = $('#auMsg');
  msg.textContent = 'Signing in…'; msg.classList.remove('err');
  const { error } = await sb.auth.signInWithPassword({ email: $('#auEmail').value.trim(), password: $('#auPass').value });
  if (error) { msg.textContent = error.message; msg.classList.add('err'); }
  else { closeSheets(); toast('Signed in. Syncing your shelf.'); }
}

/* ───────────── EPUB files: this device (IndexedDB) and your account (Supabase Storage) ───────────── */
// Each book's file is kept on the device that opened it, and uploaded once to a private bucket
// (<user id>/<book id>.epub) so any signed-in device can download it the first time it opens the book.
const BUCKET = 'cairn-books';
const MAX_FILE = 50 * 1024 * 1024;   // the largest single file Supabase's free plan accepts
const IDB = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('cairn-files', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('locs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = async (name, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(name, mode); const req = fn(tx.objectStore(name));
      tx.oncomplete = () => res(req ? req.result : undefined); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  };
  return {
    get: (name, key) => run(name, 'readonly', (s) => s.get(key)).catch(() => undefined),
    put: (name, key, val) => run(name, 'readwrite', (s) => s.put(val, key)),
    del: (name, key) => run(name, 'readwrite', (s) => s.delete(key)).catch(() => {}),
    keys: (name) => run(name, 'readonly', (s) => s.getAllKeys()).catch(() => [])
  };
})();
const fmtMB = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
let uploading = false;
async function uploadPending() {
  if (!sb || !user || uploading || !schemaOk) return;
  const ids = Object.keys(store.pendingFiles).filter((id) => store.books[id] && !store.books[id].deleted);
  if (!ids.length) return;
  uploading = true;
  try {
    for (const id of ids) {
      const blob = await IDB.get('files', id);
      if (!blob) { delete store.pendingFiles[id]; continue; }
      const path = `${user.id}/${id}.epub`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'application/epub+zip' });
      if (error) {
        const msg = String(error.message || error);
        toast(/bucket/i.test(msg) ? 'Book storage isn’t set up in Supabase yet. Run supabase/schema.sql again; the book stays on this device until then.' : `Couldn’t upload ${store.books[id].title}: ${msg}`, 8000);
        break;
      }
      const rec = store.books[id];
      Object.assign(rec, { file_path: path, file_size: blob.size }); touch(rec);
      delete store.pendingFiles[id];
      changed();
      toast(`${rec.title} is saved to your account, so it opens on your other devices too.`);
    }
  } finally { uploading = false; persist(); }
}
async function getBookFile(b, say) {
  const local = await IDB.get('files', b.id);
  if (local) return local;
  if (!b.filePath) throw new Error('This book’s file hasn’t reached your account yet. Open Cairn on the device you added it from while signed in, then try again.');
  if (!sb || !user) throw new Error('Sign in to download this book to this device.');
  say(`Downloading ${b.fileSize ? fmtMB(b.fileSize) : 'the book'}…`);
  const { data, error } = await sb.storage.from(BUCKET).download(b.filePath);
  if (error || !data) throw new Error('Couldn’t download the book. Check your connection and try again.');
  await IDB.put('files', b.id, data).catch(() => {});
  return data;
}
function forgetFile(rec) {
  IDB.del('files', rec.id); IDB.del('locs', rec.id);
  delete store.pendingFiles[rec.id];
  if (rec.file_path && sb && user) sb.storage.from(BUCKET).remove([rec.file_path]).catch(() => {});
}
// DRM-locked EPUBs encrypt their text. Font obfuscation (also listed in encryption.xml) is fine.
async function isLocked(buf) {
  try {
    const zip = await window.JSZip.loadAsync(buf);
    if (zip.file('META-INF/rights.xml')) return true;
    const enc = zip.file('META-INF/encryption.xml'); if (!enc) return false;
    const xml = await enc.async('string');
    return [...xml.matchAll(/Algorithm="([^"]+)"/g)].map((m) => m[1]).some((a) => !/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/.test(a));
  } catch { return false; }
}
async function importEpub(file) {
  if (!window.ePub || !window.JSZip) { IM.err = 'The reader didn’t load. Check your connection and reload Cairn.'; renderImport(); return; }
  if (!/\.epub$/i.test(file.name) && file.type !== 'application/epub+zip') { IM.err = 'That isn’t an EPUB. Choose a file whose name ends in .epub.'; renderImport(); return; }
  IM.busy = true; IM.err = ''; renderImport();
  const fail = (msg) => { IM.busy = false; IM.err = msg; renderImport(); };
  let buf, meta;
  try {
    buf = await file.arrayBuffer();
    if (await isLocked(buf)) return fail('This book is locked (DRM), so only the store’s own app can open it. Cairn opens DRM-free EPUBs, such as those from Standard Ebooks, Project Gutenberg or Humble Bundle.');
    const bk = window.ePub(buf);
    meta = await bk.loaded.metadata;   // left for the garbage collector: destroying it mid-load throws inside epub.js
  } catch (e) { console.error(e); return fail('This file couldn’t be opened as an EPUB. It may be damaged.'); }
  const title = String(meta.title || file.name.replace(/\.epub$/i, '')).replace(/\s+/g, ' ').trim().slice(0, 140) || 'Untitled';
  const author = String(meta.creator || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const same = S.books.find((b) => b.kind === 'epub' && titleKey(b.title) === titleKey(title));
  const rec = same ? store.books[same.id] : addBook({ title, author, kind: 'epub' });
  if (same) { rec.file_size = file.size; touch(rec); IDB.del('locs', rec.id); }
  try { await IDB.put('files', rec.id, new Blob([buf], { type: 'application/epub+zip' })); }
  catch { if (!same) { rec.deleted = true; touch(rec); changed(); } return fail('This device is out of storage space for books. Free some space and try again.'); }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* best effort */ }
  if (file.size > MAX_FILE) toast(`This book is ${fmtMB(file.size)}, over the 50 MB the free Supabase plan accepts, so it stays on this device only.`, 8000);
  else store.pendingFiles[rec.id] = true;
  bump(rec.id); config.lastBookId = rec.id; saveConfig();
  changed();
  IM.busy = false; closeSheets();
  V.name = 'book'; V.bookId = rec.id; render();
  if (same) toast(`Replaced the file for ${title}. Your marks are kept.`);
  if (sb && user) uploadPending(); else if (sb && file.size <= MAX_FILE) toast('Sign in to keep this book in your account and read it on your other devices.', 7000);
  openReader(rec.id);
}

// Copies text to the clipboard. Falls back to a hidden textarea where the clipboard API isn't allowed.
async function copyText(text) {
  text = String(text || '').trim(); if (!text) return;
  try { await navigator.clipboard.writeText(text); toast('Copied'); return; } catch { /* try the older way */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove();
    toast(ok ? 'Copied' : 'Couldn’t copy. Press and hold the text to copy it.');
  } catch { toast('Couldn’t copy. Press and hold the text to copy it.'); }
}
/* ───────────── reader ───────────── */
// epub.js renders the book in a sandboxed iframe (no scripts). Positions are EPUB CFIs; "loc" numbers are
// epub.js locations of about 1,000 characters, counted once per book and kept on this device.
const RD_THEMES = {
  light: { body: { color: '#1C1C1E', background: '#FFFFFF' }, '::selection': { background: 'rgba(43, 117, 86, .28)' } },
  sepia: { body: { color: '#3B2F23', background: '#F6EFE2' }, '::selection': { background: 'rgba(184, 80, 26, .22)' } },
  dark: { body: { color: '#FFFFFF', background: '#000000' }, '::selection': { background: 'rgba(110, 208, 164, .38)' } }
};
const RD_PAGE = { light: ['#FFFFFF', '#1C1C1E'], sepia: ['#F6EFE2', '#3B2F23'], dark: ['#000000', '#FFFFFF'] };
// A book's own stylesheet can colour its text (links, paragraphs). The reader's ink wins, so text is always readable on the page.
function forceInk(contents, t) {
  try {
    const doc = contents.document; let st = doc.getElementById('cairn-ink');
    if (!st) { st = doc.createElement('style'); st.id = 'cairn-ink'; doc.head.appendChild(st); }
    const ink = (RD_PAGE[t] || RD_PAGE.light)[1];
    st.textContent = `html, body, body * { color: ${ink} !important; -webkit-text-fill-color: ${ink} !important; } body a, body a * { text-decoration: none !important; border-bottom: 0 !important; }`;
  } catch { /* frame gone */ }
}
// The page behind the reader (and the browser's bar) takes the reader's colour, so no light strip shows under the controls.
function rdChrome(on, t) {
  const root = document.documentElement;
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  if (!on) {
    root.style.removeProperty('background-color'); document.body.style.removeProperty('background-color');
    metas.forEach((m) => { if (m.dataset.orig != null) { m.content = m.dataset.orig; delete m.dataset.orig; } });
    return;
  }
  const bg = (RD_PAGE[t] || RD_PAGE.light)[0];
  root.style.backgroundColor = bg; document.body.style.backgroundColor = bg;
  // Change the page's own theme-color tags (Chrome uses the first one that matches), keeping their originals to put back.
  metas.forEach((m) => { if (m.dataset.orig == null) m.dataset.orig = m.content; m.content = bg; });
}
const RD_FONTS = { serif: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif', sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' };
const R = { open: false, gen: 0, bookId: null, book: null, rend: null, sel: null, pos: null, toc: [], chapters: [], hl: new Map(), locReady: false, saveT: null };
const rdCfg = () => (config.reader = Object.assign({ size: 100, theme: 'auto', font: 'serif' }, config.reader || {}));
function rdTheme() {
  const t = rdCfg().theme;
  if (t !== 'auto') return t;
  const forced = document.documentElement.dataset.theme;
  return forced ? forced : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function rdMsg(text, err) { const el = $('#rdMsg'); el.textContent = text || ''; el.hidden = !text; el.classList.toggle('err', !!err); }

async function openReader(bookId, target) {
  const b = S.books.find((x) => x.id === bookId); if (!b) return;
  if (!window.ePub) { toast('The reader didn’t load. Check your connection and reload Cairn.'); return; }
  if (R.open) closeReader(true);
  closeSheets();
  const gen = ++R.gen;
  Object.assign(R, { open: true, bookId, sel: null, ext: null, pageLeft: null, turnAt: 0, pos: null, toc: [], chapters: [], hl: new Map(), locReady: false });
  const el = $('#reader'); setAcc(el, b.color); el.dataset.rt = rdTheme(); el.hidden = false;
  document.body.classList.add('in-reader');
  $('#rdBook').textContent = b.title; $('#rdChap').textContent = b.author || '';
  rdBot(); rdMsg('Opening…');
  let file;
  try { file = await getBookFile(b, rdMsg); } catch (e) { if (gen === R.gen) rdMsg(e.message, true); return; }
  if (gen !== R.gen) return;
  try {
    const book = window.ePub(await file.arrayBuffer());
    const viewer = $('#viewer'); viewer.innerHTML = '';
    const rend = book.renderTo(viewer, { width: '100%', height: '100%', flow: 'paginated', spread: 'auto', minSpreadWidth: 900, allowScriptedContent: false });
    R.book = book; R.rend = rend;
    Object.entries(RD_THEMES).forEach(([k, v]) => rend.themes.register(k, v));
    applyReaderPrefs();
    rend.on('relocated', onRelocated);
    rend.on('selected', onSelected);
    rend.on('click', onReaderClick);
    rend.on('keyup', rdKey);
    rend.hooks.content.register(onContent);
    const start = target || b.lastCfi || undefined;
    try { await rend.display(start); } catch { await rend.display(); }
    if (gen !== R.gen) return;
    rdMsg('');
    book.loaded.navigation.then((nav) => { if (gen === R.gen) buildToc(nav.toc || []); }).catch(() => {});
    paintHighlights();
    loadLocations(b, gen);
  } catch (e) {
    console.error(e);
    if (gen === R.gen) rdMsg('This book couldn’t be opened. The file may be damaged.', true);
  }
}
function closeReader(stay) {
  if (!R.open) return;
  clearTimeout(R.saveT); savePosition();
  // Only the rendition is torn down: destroying the book mid-load (contents, locations) throws inside epub.js.
  try { R.rend && R.rend.destroy(); } catch { /* already gone */ }
  Object.assign(R, { open: false, book: null, rend: null, sel: null, ext: null, hl: new Map() });
  R.gen++;
  $('#viewer').innerHTML = ''; rdMsg('');
  $('#reader').hidden = true; document.body.classList.remove('in-reader');
  if (!stay) rdChrome(false);
  if (!stay) { render(); }
}
async function loadLocations(b, gen) {
  const book = R.book;
  try {
    const saved = await IDB.get('locs', b.id);
    if (saved) book.locations.load(saved);
    else { await book.locations.generate(1024); IDB.put('locs', b.id, book.locations.save()).catch(() => {}); }
  } catch (e) { console.warn('locations', e); return; }
  if (gen !== R.gen) return;
  R.locReady = true;
  const total = book.locations.length();
  const rec = store.books[b.id];
  let dirty = false;
  if (rec && total && rec.pages !== total) { rec.pages = total; touch(rec); dirty = true; }
  for (const r of Object.values(store.marks)) {
    if (r.deleted || r.book_id !== b.id || !r.cfi || r.loc != null) continue;
    const n = book.locations.locationFromCfi(r.cfi);
    if (n >= 0) { r.loc = n + 1; touch(r); dirty = true; }
  }
  if (dirty) { persist(); scheduleSync(); derive(); }
  const cur = R.rend && R.rend.currentLocation();
  if (cur && cur.start) onRelocated(cur);
}
function spineIndexOf(href) {
  const clean = String(href || '').split('#')[0];
  let s = null;
  try { s = R.book.spine.get(clean) || R.book.spine.get(decodeURI(clean)); } catch { s = null; }
  if (s) return { index: s.index, href: s.href };
  const base = decodeURI(clean).split('/').pop();
  const it = R.book.spine.spineItems.find((x) => decodeURI(x.href).split('/').pop() === base);
  return it ? { index: it.index, href: it.href } : { index: -1, href: clean };
}
function buildToc(items) {
  const flat = [];
  const walk = (list, lv) => list.forEach((it) => {
    const hash = String(it.href || '').split('#')[1];
    const sp = spineIndexOf(it.href);
    flat.push({ label: String(it.label || '').replace(/\s+/g, ' ').trim() || 'Untitled', lv: Math.min(lv, 3), idx: sp.index, target: sp.index >= 0 ? sp.href + (hash ? '#' + hash : '') : it.href });
    if (it.subitems && it.subitems.length) walk(it.subitems, lv + 1);
  });
  walk(items, 0);
  R.toc = flat;
  R.chapters = flat.filter((x) => x.idx >= 0);
  if (R.pos) { R.pos.chapter = chapterOf(R.pos.index); $('#rdChap').textContent = R.pos.chapter || ''; }
}
function chapterOf(index) {
  let best = null;
  for (const c of R.chapters) if (c.idx <= index && (!best || c.idx >= best.idx)) best = c;
  return best ? best.label : '';
}
// A page is exactly one column step wide. If anything leaves the book sitting between two pages (a viewport change,
// a swipe that landed oddly, a chapter that ends short), nudge it onto the nearest page so no half-page shows.
// Turn the page. The time is kept so the scroll guard below knows this move was meant.
function rdTurn(dir) { if (!R.rend) return; R.turnAt = Date.now(); R.rend[dir](); }
// Dragging a selection handle toward the edge of the screen makes the browser scroll the book underneath it, which
// slides the page half off. The book only ever moves by whole pages (rdTurn), so any other movement while text is
// selected, or any up-and-down movement at all, is put back.
function guardScroll(contents) {
  const doc = contents.document, win = contents.window, c = R.rend && R.rend.manager && R.rend.manager.container;
  const turning = () => Date.now() - (R.turnAt || 0) < 900;
  const hasSel = () => { try { const s = doc.getSelection(); return !!s && !s.isCollapsed; } catch { return false; } };
  const fixY = () => { const se = doc.scrollingElement; if (se && se.scrollTop !== 0) se.scrollTop = 0; if (win.scrollY) win.scrollTo(0, 0); };
  win.addEventListener('scroll', fixY, { passive: true });
  if (c && !c.dataset.guarded) {
    c.dataset.guarded = '1';
    c.addEventListener('scroll', () => {
      if (c.scrollTop) c.scrollTop = 0;
      if (R.pageLeft != null && !turning() && hasSelAny() && Math.abs(c.scrollLeft - R.pageLeft) > 1) c.scrollLeft = R.pageLeft;
    }, { passive: true });
  }
}
function hasSelAny() {
  try { return R.rend.getContents().some((ct) => { const s = ct.document.getSelection(); return s && !s.isCollapsed; }); } catch { return false; }
}
function snapPage() {
  const m = R.open && R.rend && R.rend.manager;
  if (!m || !m.container || !m.layout || !(m.layout.delta > 0)) return;
  const c = m.container, d = m.layout.delta, sl = c.scrollLeft, off = Math.round(sl / d) * d;
  if (Math.abs(sl - off) > 1.5 && off <= c.scrollWidth - c.clientWidth + 1) c.scrollLeft = off;
  R.pageLeft = c.scrollLeft;
}
function onRelocated(loc) {
  if (!R.open || !loc || !loc.start) return;
  clearTimeout(R.snapT); R.snapT = setTimeout(snapPage, 160);
  const cfi = loc.start.cfi;
  let pct = null, n = null;
  if (R.locReady) { pct = R.book.locations.percentageFromCfi(cfi); n = R.book.locations.locationFromCfi(cfi) + 1; }
  R.pos = { cfi, pct, n, index: loc.start.index, chapter: chapterOf(loc.start.index), atEnd: !!loc.atEnd, atStart: !!loc.atStart };
  const b = S.books.find((x) => x.id === R.bookId);
  $('#rdChap').textContent = R.pos.chapter || (b && b.author) || '';
  if (!R.sel) rdBot();
  clearTimeout(R.saveT); R.saveT = setTimeout(savePosition, 1200);
}
function savePosition() {
  const rec = store.books[R.bookId]; if (!rec || !R.pos || rec.last_cfi === R.pos.cfi) return;
  rec.last_cfi = R.pos.cfi;
  if (R.pos.pct != null) rec.last_pct = Math.round(R.pos.pct * 1000) / 1000;
  rec.touched_at = nowISO(); touch(rec);
  persist(); scheduleSync(); derive();
}
function rdBot() {
  const el = $('#rdBot'); if (!el) return;
  if (R.ext && !R.sel) {
    el.innerHTML = `<p class="rd-sel">Turn the page, then touch and hold the last word to include.</p><button type="button" class="btn" data-act="rd-sel-clear">Cancel</button>`;
    return;
  }
  if (R.sel) {
    const t = R.sel.text, long = t.length > 110 ? '…' + t.slice(-100) : t;
    el.innerHTML = `<p class="rd-sel">“${esc(long)}”</p><button type="button" class="btn" data-act="rd-sel-clear">Cancel</button><button type="button" class="btn" data-act="rd-extend" aria-label="Extend the selection onto the next page">Extend</button><button type="button" class="btn primary" data-act="rd-mark">Mark</button>`;
    return;
  }
  const p = R.pos, b = S.books.find((x) => x.id === R.bookId);
  const pctTxt = p && p.pct != null ? Math.round(p.pct * 100) + '%' : '';
  const locTxt = !p ? '' : p.n ? `loc ${fmtN(p.n)}${b && b.pages ? ' of ' + fmtN(b.pages) : ''}` : (R.open && R.book ? 'Counting locations…' : '');
  el.innerHTML = `<button type="button" class="rd-btn" data-act="rd-prev" aria-label="Previous page"${p && p.atStart ? ' disabled' : ''}>${I.back}</button>
    <div class="rd-pos"><b>${pctTxt || '&nbsp;'}</b><span>${locTxt || 'Select text to mark it'}</span><span class="rd-bar" aria-hidden="true"><i style="width:${p && p.pct != null ? Math.round(p.pct * 100) : 0}%"></i></span></div>
    <button type="button" class="rd-btn" data-act="rd-mark-spot" aria-label="Mark this page without selecting">${I.pen}</button>
    <button type="button" class="rd-btn" data-act="rd-next" aria-label="Next page"${p && p.atEnd ? ' disabled' : ''}>${I.fwd}</button>`;
}
function onSelected(cfi, contents) {
  const text = String(contents.window.getSelection() || '').replace(/\s+/g, ' ').trim();
  if (!text) return;
  if (R.ext) {
    const ext = R.ext; R.ext = null;
    const win = contents.window, sel = win.getSelection();
    if (ext.contents.document === contents.document && sel.rangeCount) {
      // Same chapter: one range from where the first selection began to where this one ends.
      try {
        const end = sel.getRangeAt(0), r = contents.document.createRange();
        r.setStart(ext.range.startContainer, ext.range.startOffset); r.setEnd(end.endContainer, end.endOffset);
        const joined = r.toString().replace(/\s+/g, ' ').trim();
        if (!r.collapsed && joined.length > ext.text.length) {
          R.sel = { cfi: contents.cfiFromRange(r), text: joined, contents };
          sel.removeAllRanges(); sel.addRange(r);
          rdBot(); return;
        }
      } catch { /* fall through to the plain selection */ }
    } else if (ext.contents.document !== contents.document) {
      // The next chapter is a different document, so keep both parts of the text and the first spot.
      R.sel = { cfi: ext.cfi, text: (ext.text + ' ' + text).slice(0, 1500), contents };
      rdBot(); return;
    }
  }
  R.sel = { cfi, text, contents };
  rdBot();
}
function clearSelection() {
  try { R.sel && R.sel.contents.window.getSelection().removeAllRanges(); } catch { /* frame gone */ }
  R.sel = null; R.ext = null; rdBot();
}
function onContent(contents) {
  const doc = contents.document;
  forceInk(contents, rdTheme());
  guardScroll(contents);
  doc.addEventListener('selectionchange', () => {
    const s = doc.getSelection();
    if ((!s || s.isCollapsed) && R.sel && R.sel.contents === contents) { R.sel = null; rdBot(); }
  });
  // Swipe left or right to turn the page (not while selecting).
  let sx = 0, sy = 0, st = 0;
  doc.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sx = t.screenX; sy = t.screenY; st = Date.now(); }, { passive: true });
  doc.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0], dx = t.screenX - sx, dy = t.screenY - sy;
    if (Date.now() - st > 700 || Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const s = doc.getSelection(); if (s && !s.isCollapsed) return;
    R.swiped = Date.now();
    if (dx < 0) rdTurn('next'); else rdTurn('prev');
  }, { passive: true });
}
// Tap the left or right edge of the page to turn it.
function onReaderClick(e) {
  if (!R.rend || (R.swiped && Date.now() - R.swiped < 500)) return;
  if (e.target && e.target.closest && e.target.closest('a')) return;
  const sel = e.view && e.view.getSelection && e.view.getSelection(); if (sel && !sel.isCollapsed) return;
  const frame = e.view && e.view.frameElement; const box = $('#viewer').getBoundingClientRect();
  if (!frame) return;
  const x = e.clientX + frame.getBoundingClientRect().left - box.left;
  if (x < box.width * 0.2) rdTurn('prev'); else if (x > box.width * 0.8) rdTurn('next');
}
function rdKey(e) {
  if (!R.open || $$('dialog[open]').length) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') rdTurn('next');
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') rdTurn('prev');
  else if (e.key === 'Escape' && e.type === 'keydown') closeReader();
}
function applyReaderPrefs() {
  const c = rdCfg(), t = rdTheme();
  $('#reader').dataset.rt = t;
  rdChrome(R.open, t);
  if (!R.rend) return;
  R.rend.themes.select(t);
  try { R.rend.getContents().forEach((c) => forceInk(c, t)); } catch { /* not rendered yet */ }
  R.rend.themes.fontSize(c.size + '%');
  R.rend.themes.font(RD_FONTS[c.font] || RD_FONTS.serif);
  R.hl.clear(); setTimeout(paintHighlights, 60);   // re-layout drops the drawn highlights
}

/* highlights drawn in the text: your kept marks in the book's colour, Inbox ones in orange */
let hlTapAt = 0;
function paintHighlights() {
  if (!R.open || !R.rend) return;
  const want = new Map();
  for (const r of Object.values(store.marks)) {
    if (r.deleted || r.book_id !== R.bookId || !r.cfi || !r.quote) continue;
    want.set(r.id, { cfi: r.cfi, kind: r.status === 'inbox' ? 'inbox' : 'kept' });
  }
  for (const [id, h] of R.hl) {
    const w = want.get(id);
    if (!w || w.cfi !== h.cfi || w.kind !== h.kind) { try { R.rend.annotations.remove(h.cfi, 'highlight'); } catch { /* not drawn */ } R.hl.delete(id); }
  }
  const b = S.books.find((x) => x.id === R.bookId), fill = pal(b ? b.color : 'moss').a;
  for (const [id, w] of want) {
    if (R.hl.has(id)) continue;
    try {
      try { R.rend.annotations.remove(w.cfi, 'highlight'); } catch { /* first time */ }
      R.rend.annotations.highlight(w.cfi, { id }, (e) => onHighlightTap(id, e), 'cairn-hl', { fill: w.kind === 'inbox' ? '#FF9500' : fill, 'fill-opacity': '0.32', 'mix-blend-mode': 'normal' });
      R.hl.set(id, w);
    } catch (e) { console.warn('highlight', e); }
  }
}
function onHighlightTap(id, e) {
  if (e && e.type === 'touchstart') return;   // wait for the click, so a swipe that starts on a highlight still turns the page
  if (Date.now() - hlTapAt < 600) return; hlTapAt = Date.now();
  const rec = store.marks[id]; if (!rec || rec.deleted) return;
  if (rec.status === 'inbox') openReaderMark(id); else openDetail(id);
}

/* contents and text settings */
function openToc() {
  const cur = R.pos ? chapterOf(R.pos.index) : '';
  $('#tocBody').innerHTML = `<div class="sheet-head"><span></span><h2>Contents</h2><button type="button" class="link strong" data-act="close">Done</button></div>
    ${R.toc.length ? `<ul class="toc">${R.toc.map((c, i) => `<li><button type="button" style="--lv:${c.lv}" data-act="rd-toc-go" data-i="${i}" aria-current="${c.label === cur && c.idx === (R.chapters.find((x) => x.label === cur) || {}).idx}">${esc(c.label)}</button></li>`).join('')}</ul>` : '<p class="help">This book has no table of contents.</p>'}`;
  openSheet('sheetToc');
  const on = $('#tocBody [aria-current="true"]'); if (on) on.scrollIntoView({ block: 'center' });
}
function openReaderSettings() { renderReaderSettings(); openSheet('sheetRset'); }
function renderReaderSettings() {
  const c = rdCfg();
  const themes = [['auto', 'Auto'], ['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']], ti = themes.findIndex(([k]) => k === c.theme);
  const fonts = [['serif', 'Serif'], ['sans', 'Sans']], fi = fonts.findIndex(([k]) => k === c.font);
  $('#rsBody').innerHTML = `<div class="sheet-head"><span></span><h2>Text</h2><button type="button" class="link strong" data-act="close">Done</button></div>
    <div class="field"><span class="lbl">Size</span><div class="stepper-row"><button type="button" class="btn" data-act="rd-size" data-v="-1" aria-label="Smaller text"${c.size <= 70 ? ' disabled' : ''}>A−</button><b>${c.size}%</b><button type="button" class="btn" data-act="rd-size" data-v="1" aria-label="Larger text"${c.size >= 200 ? ' disabled' : ''}>A+</button></div></div>
    <div class="field"><span class="lbl">Theme</span><div class="seg" role="group" aria-label="Theme" style="--n:4"><span class="thumb" aria-hidden="true" style="transform:translateX(${Math.max(0, ti) * 100}%)"></span>${themes.map(([k, l]) => `<button type="button" aria-pressed="${c.theme === k}" data-act="rd-theme" data-v="${k}">${l}</button>`).join('')}</div><p class="help">Auto follows Cairn’s light or dark appearance.</p></div>
    <div class="field"><span class="lbl">Font</span><div class="seg" role="group" aria-label="Font" style="--n:2"><span class="thumb" aria-hidden="true" style="transform:translateX(${Math.max(0, fi) * 100}%)"></span>${fonts.map(([k, l]) => `<button type="button" aria-pressed="${c.font === k}" data-act="rd-font" data-v="${k}">${l}</button>`).join('')}</div></div>`;
}

/* mark from the reader: the selected line, or the spot you're on */
let RM = null;
function openReaderMark(existingId) {
  const b = S.books.find((x) => x.id === R.bookId); if (!b) return;
  if (existingId) {
    const r = store.marks[existingId]; if (!r) return;
    RM = { id: r.id, quote: r.quote, text: r.text || '', cfi: r.cfi, chapter: r.chapter, loc: r.loc, inbox: r.status === 'inbox' };
  } else if (R.sel) {
    const cfi = R.sel.cfi; let idx = -1;
    try { const s = R.book.spine.get(cfi); idx = s ? s.index : -1; } catch { idx = -1; }
    RM = { id: null, quote: R.sel.text.slice(0, 2000), text: '', cfi, chapter: chapterOf(idx), loc: R.locReady ? R.book.locations.locationFromCfi(cfi) + 1 : null };
  } else if (R.pos) {
    RM = { id: null, quote: null, text: '', cfi: R.pos.cfi, chapter: R.pos.chapter, loc: R.pos.n };
  } else return;
  const where = [RM.chapter, RM.loc ? `loc ${fmtN(RM.loc)}` : ''].filter(Boolean).join(' · ');
  const body = $('#rmBody'); setAcc(body, b.color);
  body.innerHTML = `<form id="rmForm" class="sheet-in" style="padding:0" novalidate>
      <div class="sheet-head"><button type="button" class="link" data-act="close">Cancel</button><h2>${RM.id ? 'Your highlight' : RM.quote ? 'Mark this line' : 'Mark this page'}</h2><button type="submit" class="link strong">Keep</button></div>
      ${where ? `<p class="eyebrow" style="color:var(--acc)">${esc(where)}</p>` : ''}
      ${RM.quote ? `<div class="field"><div class="lbl-row"><span class="lbl">Highlighted</span><button type="button" class="link copy-btn" data-act="copy-quote">${I.copy}Copy</button></div><p class="quote clamp">${esc(RM.quote)}</p></div>` : ''}
      <div class="field"><label class="lbl" for="rmText">Your line</label><textarea id="rmText" class="tx" rows="2" maxlength="280" placeholder="What this says, in your own words">${esc(RM.text)}</textarea>
        <p class="help">${RM.quote ? 'Write it now, or tap Later and write it in your Inbox.' : 'One line about this page in your own words.'}</p></div>
      <p class="err-msg" id="rmErr" role="alert"></p>
      <div class="row end">${RM.quote && !(RM.id && RM.inbox) ? `<button type="button" class="btn" data-act="rm-later">Later</button>` : ''}<button type="submit" class="btn primary">Keep</button></div>
      ${RM.id ? `<button type="button" class="link danger" style="align-self:center" data-act="rm-remove">Remove highlight</button>` : ''}
    </form>`;
  openSheet('sheetRmark');
  setTimeout(() => { const t = $('#rmText'); if (t) t.focus(); }, 60);
}
function saveReaderMark(later) {
  if (!RM) return;
  const text = ($('#rmText').value || '').trim().replace(/\s+/g, ' ');
  if (!later && !text) { $('#rmErr').textContent = RM.quote ? 'Write one line in your own words, or tap Later.' : 'Write one line about this page.'; $('#rmText').focus(); return; }
  let id = RM.id;
  if (id) {
    const r = store.marks[id];
    Object.assign(r, { text, status: 'kept', rev_n: 0, rev_due: isoAt(Date.now() + DAY) }); touch(r);
  } else {
    id = addMark(R.bookId, { loc: RM.loc, cfi: RM.cfi, chapter: RM.chapter || null, quote: RM.quote, text, status: later ? 'inbox' : 'kept', source: 'epub' }).id;
  }
  bump(R.bookId); config.lastBookId = R.bookId; saveConfig();
  changed();
  if (R.sel) clearSelection();
  closeSheets(); paintHighlights(); render();
  if (later) toast('In your Inbox. Write the line when you’re done reading.');
  else toast('Marked', allMarks().length > 1 ? { label: 'Link it', act: () => openLink(id) } : null);
}
function removeReaderMark() {
  const r = RM && RM.id && store.marks[RM.id]; if (!r) return;
  r.deleted = true; touch(r);
  Object.values(store.links).forEach((l) => { if (!l.deleted && (l.a === r.id || l.b === r.id)) { l.deleted = true; touch(l); } });
  changed(); closeSheets(); paintHighlights(); render(); toast('Highlight removed');
}

/* toast */
let toastTimer = null;
function toast(msg, action) {
  const el = $('#toast');
  let ms = 3200;
  if (typeof action === 'number') { ms = action; action = null; }
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) { el.querySelector('button').addEventListener('click', () => { el.hidden = true; action.act(); }); ms = 6500; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ───────────── events ───────────── */
const ACT = {
  go: (t) => go(t.dataset.to),
  'open-book': (t) => { V.bookId = t.dataset.id; go('book'); },
  'book-new': () => openBook(null),
  'book-edit': (t) => openBook(t.dataset.id),
  'book-kind': (t) => { BK.kind = t.dataset.v; renderBookKind(); },
  'book-del': (t) => armed('book-' + BK.id, t, 'Tap again to delete the book and its marks', deleteBook),
  'mark-new': (t) => openMark(t.dataset.book),
  'mark-unit': (t) => { MK.unit = t.dataset.v; renderMarkUnit(); focusSpot(); },
  'start-on': (t) => { config.startOn = t.dataset.v; saveConfig(); renderMenu(); },
  'open-mark': (t) => openDetail(t.dataset.id),
  'goto-mark': (t) => { const f = findMark(t.dataset.id); if (!f) return; if (R.open) closeReader(true); closeSheets(); V.bookId = f.b.id; V.flash = f.m.id; V.name = 'book'; render(); },
  sort: (t) => { config.sort = t.dataset.sort; saveConfig(); render(); },
  close: () => closeSheets(),
  'del-mark': (t) => armed('mark-' + DT.id, t, 'Tap again to delete', deleteMark),
  unlink: (t) => armed('link-' + t.dataset.id, t, 'Tap again to remove', () => { const l = store.links[t.dataset.id]; if (l) { l.deleted = true; touch(l); changed(); } renderDetail(); render(); toast('Link removed'); }),
  'link-from': (t) => openLink(t.dataset.id),
  'link-pick': (t) => { LK.to = t.dataset.id; renderThat(); setTimeout(() => $('#linkBecause').focus(), 30); },
  'link-change': () => { LK.to = null; renderThat(); },
  'link-ai': () => suggestLinks(),
  'link-save': () => saveLink(),
  'ask-try': (t) => { V.ask.q = t.textContent; const i = $('#askQ'); if (i) i.value = V.ask.q; V.ask.res = search(V.ask.q); V.ask.ai = null; render(); },
  'ask-ai': () => askAi(),
  'ask-stop': () => { if (V.ask.ctl) V.ask.ctl.abort(); },
  'rv-start': () => { V.rv.started = true; render(); },
  'rv-show': () => { V.rv.shown = true; render(); },
  'rv-got': () => grade(true),
  'rv-forgot': () => grade(false),
  'rv-fuzzy': () => grade('part'),
  'rv-practice': () => { const all = allMarks(); const p = all[Math.floor(Math.random() * all.length)]; V.rv = { ...V.rv, id: p.m.id, shown: false, draft: '', started: true }; render(); },
  import: (t) => openImport(t.dataset.book, t.dataset.mode),
  read: (t) => { const id = t.dataset.book; V.name = 'book'; V.bookId = id; render(); openReader(id); },
  'read-mark': (t) => { const r = store.marks[t.dataset.id]; if (r && r.cfi) openReader(r.book_id, r.cfi); },
  'rd-close': () => closeReader(),
  'rd-prev': () => rdTurn('prev'),
  'rd-next': () => rdTurn('next'),
  'rd-toc': () => openToc(),
  'rd-toc-go': (t) => { const c = R.toc[+t.dataset.i]; closeSheets(); if (c && R.rend) { R.turnAt = Date.now(); R.rend.display(c.target).catch(() => toast('That chapter couldn’t be opened.')); } },
  'rd-set': () => openReaderSettings(),
  'rd-size': (t) => { const c = rdCfg(); c.size = Math.max(70, Math.min(200, c.size + 10 * +t.dataset.v)); saveConfig(); applyReaderPrefs(); renderReaderSettings(); },
  'rd-theme': (t) => { rdCfg().theme = t.dataset.v; saveConfig(); applyReaderPrefs(); renderReaderSettings(); },
  'rd-font': (t) => { rdCfg().font = t.dataset.v; saveConfig(); applyReaderPrefs(); renderReaderSettings(); },
  'rd-mark': () => openReaderMark(),
  'rd-mark-spot': () => openReaderMark(),
  'rd-sel-clear': () => clearSelection(),
  'copy-quote': (t) => copyText(((t.closest('.field') || document).querySelector('.quote') || {}).textContent || ''),
  'rd-extend': () => {
    if (!R.sel || !R.rend) return;
    let range; try { range = R.sel.contents.range(R.sel.cfi); } catch { range = null; }
    if (!range) { toast('That selection can’t be extended. Select it again.'); return; }
    R.ext = { range, cfi: R.sel.cfi, text: R.sel.text, contents: R.sel.contents };
    R.sel = null; rdBot(); rdTurn('next');
  },
  'rm-later': () => saveReaderMark(true),
  'rm-remove': (t) => armed('rm-' + (RM && RM.id), t, 'Tap again to remove', removeReaderMark),
  'im-mode': (t) => { IM.mode = t.dataset.v; IM.err = ''; renderImport(); },
  'im-read': () => readPhotos(),
  'im-add': () => addParsed(),
  'ib-keep': (t) => keepInbox(t.dataset.id),
  'ib-skip': (t) => skipInbox(t.dataset.id),
  'ib-more': () => { V.inboxShow += 30; render(); },
  draft: () => draftInbox(),
  'load-examples': () => loadExamples(),
  'clear-examples': () => clearExamples(),
  menu: () => openMenu(),
  signin: () => openAuth(),
  signout: async () => { if (sb) await sb.auth.signOut(); closeSheets(); toast('Signed out. Your shelf stays on this device.'); },
  sync: () => syncNow(),
  theme: (t) => { config.theme = t.dataset.v; saveConfig(); applyTheme(); renderMenu(); if (R.open) applyReaderPrefs(); },
  'export-md': () => exportMd(),
  'export-json': () => exportJson(),
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderMenu(); }
};

function wire() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const fn = ACT[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  $$('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  document.addEventListener('submit', (e) => {
    const id = e.target.id;
    if (id === 'markForm') submitMark(e);
    else if (id === 'bookForm') submitBook(e);
    else if (id === 'detailForm') submitDetail(e);
    else if (id === 'authForm') submitAuth(e);
    else if (id === 'rmForm') { e.preventDefault(); saveReaderMark(false); }
    else if (id === 'askForm') {
      e.preventDefault();
      V.ask.q = $('#askQ').value.trim();
      if (V.ask.ctl) V.ask.ctl.abort();
      V.ask.ai = null; V.ask.res = V.ask.q ? search(V.ask.q) : null;
      $('#askQ').blur(); render();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'markBook') renderMarkUnit();
    else if (t.name === 'imBook') { IM.title = ($('#imTitle') || {}).value || IM.title; IM.author = ($('#imAuthor') || {}).value || IM.author; IM.bookId = t.value; renderImport(); }
    else if (t.id === 'photoInput') { IM.files = [...t.files].slice(0, 20); IM.err = t.files.length > 20 ? 'Only the first 20 photos are used. Import the rest next.' : ''; t.value = ''; renderImport(); }
    else if (t.id === 'clipInput') { const fs = [...t.files]; t.value = ''; if (fs.length) readClipFile(fs); }
    else if (t.id === 'epubInput') { const f = t.files[0]; t.value = ''; if (f) importEpub(f); }
    else if (t.dataset && t.dataset.pick) { if (t.checked) IM.pick.add(t.dataset.pick); else IM.pick.delete(t.dataset.pick); renderImport(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'linkQ') { LK.q = t.value; $('#linkList').innerHTML = pickerItems(); }
    else if (t.id === 'linkBecause') { LK.because = t.value; $('#linkErr').textContent = ''; updateLinkSave(); }
    else if (t.id === 'askQ') V.ask.q = t.value;
    else if (t.id === 'rvDraft') V.rv.draft = t.value;
    else if (t.dataset && t.dataset.ib) {
      const rec = store.marks[t.dataset.ib];
      if (rec) {
        rec.text = t.value; touch(rec); persist(); scheduleSync();
        if (store.drafted[rec.id]) { delete store.drafted[rec.id]; const tag = document.getElementById('ibd-' + rec.id); if (tag) tag.remove(); }
        const keep = t.closest('.ib').querySelector('[data-act="ib-keep"]'); if (keep) keep.disabled = !t.value.trim();
      }
    }
    else if (t.id === 'imTitle') IM.title = t.value;
    else if (t.id === 'imAuthor') IM.author = t.value;
    else if (t.id === 'markText') {
      const n = (t.value.trim().match(/\S+/g) || []).length;
      $('#markHint').textContent = n > 20 ? `${n} words. Can you say it in fewer? Short lines are easier to scan later.` : 'Short beats complete. Six to twelve words is plenty.';
    } else if (t.id === 'markPage' || t.id === 'bPages' || t.id === 'dPage' || t.id === 'dLoc') {
      const clean = t.value.replace(/\D/g, '').slice(0, 6); if (clean !== t.value) t.value = clean;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'markPage') { e.preventDefault(); $('#markText').focus(); }
    else if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'markText') { e.preventDefault(); $('#markForm').requestSubmit(); }
    else if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'rmText') { e.preventDefault(); $('#rmForm').requestSubmit(); }
    else if (R.open && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) rdKey(e);
  });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    syncNow(); if (V.name !== 'inbox') queueRender();
    // Coming back to the app after a while counts as opening it.
    if (config.startOn === 'mark' && !R.open && hiddenAt && Date.now() - hiddenAt > 5 * 60000 && !$$('dialog[open]').length && S.books.length) openMark();
  });
  window.addEventListener('online', syncNow);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('beforeunload', () => { if (R.open) savePosition(); persistNow(); });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (R.open) applyReaderPrefs(); }); } catch { /* old browsers */ }
  setInterval(() => { syncNow(); if (V.name !== 'ask' && V.name !== 'inbox') queueRender(); }, 60000);
}

/* ───────────── init ───────────── */
async function init() {
  applyTheme();
  derive();
  wire();
  render();
  const wantMark = new URLSearchParams(location.search).has('mark') || config.startOn === 'mark';
  if (location.search) history.replaceState(null, '', location.pathname);
  if (wantMark && S.books.length) openMark();
  IDB.keys('files').then((keys) => keys.forEach((k) => { const b = store.books[k]; if (b && b.deleted) { IDB.del('files', k); IDB.del('locs', k); } }));
  await initSupabase();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.Cairn = { openDetail, derive, render, get store() { return store; }, get S() { return S; }, get R() { return R; }, syncNow, search, parseClippings, parseNotebookHtml };
init();
})();
