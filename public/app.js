/* Cairn — a personal index for the paper books you read.
 * Local-first: everything lives in localStorage and syncs to Supabase when you're signed in
 * (the same account as margin and recall). Claude runs on the server (/api/suggest, /api/ask);
 * the key never reaches the browser.
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
const loadJSON = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

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

const I = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  link: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  spark: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  check: '<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cairn: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="19.6" rx="9" ry="3.2"/><ellipse cx="11.4" cy="13.8" rx="6.2" ry="2.8"/><ellipse cx="12.5" cy="8.6" rx="4.2" ry="2.4"/><ellipse cx="11.8" cy="4.2" rx="2.5" ry="1.8"/></svg>',
  cairnLg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="19.6" rx="9" ry="3.2"/><ellipse cx="11.4" cy="13.8" rx="6.2" ry="2.8"/><ellipse cx="12.5" cy="8.6" rx="4.2" ry="2.4"/><ellipse cx="11.8" cy="4.2" rx="2.5" ry="1.8"/></svg>'
};

/* ───────────── store + config ───────────── */
// Records are flat rows, the same shape as the Supabase tables. `_dirty` marks rows still to be pushed.
const STORE_KEY = 'cairn.store.v1', CONFIG_KEY = 'cairn.config.v1';
const EPOCH = '1970-01-01T00:00:00.000Z';
const emptyStore = () => ({ books: {}, marks: {}, links: {}, lastSync: {}, owner: null });
let store = Object.assign(emptyStore(), loadJSON(STORE_KEY, {}));
const CFG = window.CAIRN_CONFIG || {};
let config = Object.assign({ theme: 'system', sort: 'page' }, loadJSON(CONFIG_KEY, {}));

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

function addBook({ title, author = '', pages = null, color = 'moss', example = false, created, touched }) {
  const t = nowISO();
  const b = { id: uid(), title, author, pages, color, example, created_at: created || t, updated_at: t, touched_at: touched || t, deleted: false, _dirty: true };
  store.books[b.id] = b; return b;
}
function addMark(bookId, page, text, { created, due, n = 0 } = {}) {
  const t = Date.now();
  const m = { id: uid(), book_id: bookId, page, text, rev_n: n, rev_due: isoAt(due || t + DAY), rev_last: null,
    created_at: created ? isoAt(created) : isoAt(t), updated_at: nowISO(), deleted: false, _dirty: true };
  store.marks[m.id] = m; return m;
}
function addLink(a, b, because, example = false) {
  const t = nowISO();
  const l = { id: uid(), a, b, because, example, created_at: t, updated_at: t, deleted: false, _dirty: true };
  store.links[l.id] = l; return l;
}
function bump(bookId) { const b = store.books[bookId]; if (b) { b.touched_at = nowISO(); touch(b); } }

/* ───────────── view model ───────────── */
// S is rebuilt from the store after every change: live books with their marks nested, and live links.
let S = { books: [], links: [], examples: false };
function derive() {
  const books = Object.values(store.books).filter((b) => !b.deleted).map((b) => ({
    id: b.id, title: b.title, author: b.author || '', pages: b.pages || null, color: b.color, example: !!b.example,
    created: ms(b.created_at), touched: ms(b.touched_at || b.updated_at), marks: []
  }));
  const byId = new Map(books.map((b) => [b.id, b]));
  const live = new Set();
  for (const m of Object.values(store.marks)) {
    if (m.deleted) continue;
    const b = byId.get(m.book_id); if (!b) continue;
    live.add(m.id);
    b.marks.push({ id: m.id, page: m.page, text: m.text, at: ms(m.created_at), rev: { n: m.rev_n || 0, due: m.rev_due ? ms(m.rev_due) : ms(m.created_at) + DAY } });
  }
  const links = Object.values(store.links).filter((l) => !l.deleted && live.has(l.a) && live.has(l.b))
    .map((l) => ({ id: l.id, a: l.a, b: l.b, because: l.because, at: ms(l.created_at), example: !!l.example }));
  S = { books, links, examples: books.some((b) => b.example) };
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
const maxPage = (b) => b.marks.reduce((n, m) => Math.max(n, m.page), 0);
function relDays(t) { const d = Math.round((t - Date.now()) / DAY); if (d <= 0) return 'today'; if (d === 1) return 'tomorrow'; return 'in ' + d + ' days'; }
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
  bad_reply: 'Claude’s answer couldn’t be read. Try again.'
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
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(API_ERRORS[j.error] || `Claude couldn’t answer (${j.error || res.status}). Try again.`);
  return j;
}
const noteFor = ({ m, b }) => ({ id: m.id, book: b.title, author: b.author, page: m.page, text: m.text });

/* ───────────── Supabase sync (same scheme as recall) ───────────── */
let sb = null, user = null, syncing = false, syncTimer;
let syncState = { state: 'off', text: 'This device only' };
const TABLES = [['cairn_books', 'books'], ['cairn_marks', 'marks'], ['cairn_links', 'links']];
const DATE_FIELDS = ['created_at', 'updated_at', 'touched_at', 'rev_due', 'rev_last'];

function setSync(state, text) {
  syncState = { state, text };
  const el = $('#syncStatus'); if (el) { el.dataset.state = state; el.querySelector('span').textContent = text; }
}
function scheduleSync() { if (!sb || !user) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 2500); }
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const toRow = (r) => { const { _dirty, ...rest } = r; return { ...rest, user_id: user.id }; };

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
    for (const [table, key] of TABLES) await pushTable(table, store[key]);
    for (const [table, key] of TABLES) await pullTable(table, store[key], key);
    persistNow(); derive();
    setSync('ok', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    queueRender();
  } catch (e) {
    console.error(e);
    const missing = /cairn_|relation|does not exist|schema cache/i.test(String(e.message || ''));
    setSync('err', missing ? 'Run supabase/schema.sql' : 'Sync error');
    toast(missing ? 'Cairn’s tables aren’t in Supabase yet. Run supabase/schema.sql, then sync again.' : 'Sync failed: ' + (e.message || e), 6000);
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
const V = { name: 'shelf', bookId: null, lastBookId: null, flash: null,
  ask: { q: '', res: null, ai: null, ctl: null }, rv: { id: null, shown: false, done: 0, started: false } };
let deferredInstall = null;

let renderQueued = false;
function queueRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
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
    const extra = linksOf(m.id).map((x) => x.l.because).join(' ');
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

function viewShelf() {
  const books = shelfOrder();
  const tools = `<button type="button" class="btn primary" data-act="book-new">${I.plus}Book</button><button type="button" class="round-btn" data-act="menu" aria-label="Account, export and settings">${I.more}</button>`;
  let h = headHtml('Shelf', tools);
  if (!books.length) {
    return h + signinHint() + `<section class="empty-card">
      <p class="eyebrow">Your shelf is empty</p>
      <h2>Index the book in your hands</h2>
      <p>Add the paper book you’re reading. When a page matters, write its number and one line in your own words. Later, ask a question and Cairn points you to the book and the page.</p>
      <ol class="steps"><li><span><b>Mark</b> a page: its number and one line.</span></li><li><span><b>Link</b> it when it’s like something in another book, and say why.</span></li><li><span><b>Ask</b> your shelf, and <b>revisit</b> pages before you forget them.</span></li></ol>
      <div class="specimen" aria-label="What an index line looks like">
        <p class="eyebrow" style="margin-bottom:2px">An index line</p>
        <div class="entry" style="cursor:default"><span class="e-text">Opportunity cost: the real price is the next-best option</span><span class="e-lead" aria-hidden="true"></span><span class="e-page">83</span></div>
        <div class="seealso"><span class="sa">see also</span><span class="ref">Kahneman 344</span><span class="gist">Sunk cost</span></div>
      </div>
      <div class="row"><button type="button" class="btn primary" data-act="book-new">${I.plus}Add a book</button><button type="button" class="btn" data-act="load-examples">Try an example shelf</button></div>
    </section>`;
  }
  h += signinHint();
  if (S.examples) h += `<div class="banner"><span>Example shelf. Its page numbers are made up.</span><button type="button" class="link" data-act="clear-examples">Remove</button></div>`;
  const nDue = dueList().length;
  h += `<section class="summary" aria-label="Totals">
    <div class="stat"><p class="k">Marks</p><p class="v">${allMarks().length}</p></div>
    <div class="stat s"><p class="k">See-alsos</p><p class="v">${S.links.length}</p></div>
    <div class="stat${nDue ? ' d' : ''}"><p class="k">To revisit</p><p class="v">${nDue}</p></div></section>`;
  h += `<div class="grid">` + books.map((b) => {
    const n = b.marks.length, mp = maxPage(b);
    return `<button type="button" class="tile" style="${accStyle(b.color)}" data-act="open-book" data-id="${esc(b.id)}">
      <span class="tile-top"><span class="chip">${plural(n, 'mark')}</span></span>
      <span><h3>${esc(b.title)}</h3>${b.author ? `<p class="tm">${esc(b.author)}</p>` : ''}${n ? `<span class="lead"><span>to page</span><i aria-hidden="true"></i><span>${mp}</span></span>` : ''}</span>
    </button>`;
  }).join('') + `</div>`;
  return h;
}

function entryHtml(m) {
  const see = linksOf(m.id).map(({ other }) => findMark(other)).filter(Boolean);
  return `<li id="m-${esc(m.id)}"${V.flash === m.id ? ' class="flash"' : ''}><button type="button" class="entry" data-act="open-mark" data-id="${esc(m.id)}"><span class="e-text">${esc(m.text)}</span><span class="e-lead" aria-hidden="true"></span><span class="e-page"><span class="sr">page </span>${m.page}</span></button>${see.length ? `<div class="seealso"><span class="sa">see also</span>${see.map((o) => `<button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${o.m.page}</button><span class="gist">${esc(gist(o.m.text))}</span>`).join('')}</div>` : ''}</li>`;
}
const sortKey = (t) => String(t).replace(/^(the|a|an)\s+/i, '').toLowerCase();

function viewBook() {
  const b = S.books.find((x) => x.id === V.bookId);
  if (!b) { V.name = 'shelf'; return null; }
  const marks = [...b.marks];
  const nLinks = marks.reduce((n, m) => n + linksOf(m.id).length, 0);
  const az = config.sort === 'az';
  let h = `<div class="topbar"><div class="tb-in">
    <div class="nav"><button type="button" class="link" data-act="go" data-to="shelf">${I.back}Shelf</button><button type="button" class="icon-btn" data-act="book-edit" data-id="${esc(b.id)}" aria-label="Edit book">${I.more}</button></div>
    ${marks.length > 1 ? `<div class="seg" role="group" aria-label="Order of the index" style="--n:2"><span class="thumb" aria-hidden="true" style="transform:translateX(${az ? '100%' : '0'})"></span><button type="button" aria-pressed="${!az}" data-act="sort" data-sort="page">By page</button><button type="button" aria-pressed="${az}" data-act="sort" data-sort="az">A–Z</button></div>` : ''}
  </div></div><div class="doc">
    <div class="s-head"><p class="eyebrow">Your index · ${plural(marks.length, 'mark')}${nLinks ? ' · ' + plural(nLinks, 'see-also') : ''}</p><h1>${esc(b.title)}</h1>${b.author ? `<p class="meta">${esc(b.author)}</p>` : ''}</div>`;
  if (!marks.length) {
    h += `<div class="empty-card"><h2>No marks yet</h2><p>When a page matters, tap Mark page below. Write the page number and one line in your own words.</p></div>`;
  } else {
    h += `<ul class="index">`;
    if (!az) { marks.sort((x, y) => x.page - y.page || x.at - y.at); h += marks.map(entryHtml).join(''); }
    else {
      marks.sort((x, y) => sortKey(x.text).localeCompare(sortKey(y.text)));
      let last = '';
      for (const m of marks) {
        const L = (sortKey(m.text)[0] || '#').toUpperCase(), letter = /[A-Z]/.test(L) ? L : '#';
        if (letter !== last) { h += `<li class="letter" aria-hidden="true">${letter}</li>`; last = letter; }
        h += entryHtml(m);
      }
    }
    h += `</ul>`;
    const mp = maxPage(b);
    if (b.pages && mp < b.pages) h += `<div class="think"><span>Not yet indexed</span><b>p.${mp + 1} – ${b.pages}</b></div>`;
  }
  return h + `</div>`;
}

function bookBarHtml(b) {
  const mp = maxPage(b), n = b.marks.length;
  const lead = b.pages ? ring(44, 5, mp / b.pages) : `<span class="bar-ic tint">${I.cairnLg}</span>`;
  const title = n ? `Indexed to p.${mp}` : 'Start your index';
  const sub = b.pages ? `${Math.round((mp / b.pages) * 100)}% of ${b.pages} pages` : `${plural(n, 'mark')}${n ? '' : ' so far'}`;
  return `<span class="bar-ic">${lead}</span><span class="bar-t"><b>${title}</b><span>${sub}</span></span><button type="button" class="btn primary" data-act="mark-new" data-book="${esc(b.id)}">Mark page</button>`;
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
    h += `<div class="found${anim}" data-acc style="--n:${r.walk.length};${accStyle(b.color)}"><p class="eyebrow">That page · ${esc(b.title)}</p>
      <div class="pgline"><span class="p">p.</span><span class="pg">${m.page}</span></div>
      <p class="found-text">${esc(m.text)}</p>
      <div class="row"><button type="button" class="btn primary" data-act="goto-mark" data-id="${esc(m.id)}">Open in index</button></div></div>`;
    const trail = linksOf(m.id).map(({ l, other }) => ({ l, o: findMark(other) })).filter((x) => x.o);
    if (trail.length) h += `<p class="sec-h">Your see-also trail</p><ul class="group">` + trail.map(({ l, o }) => `<li class="g-stack"><span class="top"><button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${o.m.page}</button><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p></li>`).join('') + `</ul>`;
    const others = r.others.map(findMark).filter(Boolean);
    if (others.length) h += `<p class="sec-h">Also on your shelf</p><ul class="group">` + others.map(({ m: om, b: ob }) => `<li><button type="button" class="g-row" data-act="goto-mark" data-id="${esc(om.id)}"><span class="ref" style="${accStyle(ob.color)}" data-acc>${esc(shortRef(ob))} ${om.page}</span><span class="lt">${esc(om.text)}</span></button></li>`).join('') + `</ul>`;
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
    if (cites.length) h += `<div class="row">${cites.map(({ m, b }) => `<button type="button" class="ref" data-acc style="${accStyle(b.color)}" data-act="goto-mark" data-id="${esc(m.id)}">${esc(shortRef(b))} ${m.page}</button>`).join('')}</div>`;
    if (!a.answer && !cites.length) h += `<p class="help">Nothing on your shelf answers this yet.</p>`;
    h += `</div>`;
    if (a.gap) h += `<p class="notice"><b>Gap</b>${esc(a.gap)}</p>`;
  }
  return h + `</div>`;
}

function viewRevisit() {
  let h = headHtml('Revisit');
  if (!allMarks().length) return h + `<section class="empty-card"><h2>Nothing to revisit yet</h2><p>Revisit shows you a page number and asks what you marked there. Add a few marks first.</p></section>`;
  const due = dueList();
  let cur = V.rv.id ? findMark(V.rv.id) : null;
  if (!V.rv.started || (!cur && !due.length)) {
    const n = due.length, done = V.rv.done;
    const frac = n + done ? done / (n + done) : 1;
    const next = !n ? allMarks().sort((x, y) => dueAt(x.m) - dueAt(y.m))[0] : null;
    h += `<section class="rv-home"><div class="ring-wrap">${ring(156, 13, frac)}<div class="ring-center">${n ? `<strong>${n}</strong><span>to recall</span>` : `<span style="color:var(--acc);margin:0">${I.check}</span>`}</div></div>
      <h2 class="rv-headline">${n ? plural(n, 'page') + ' to recall' : 'All caught up'}</h2>
      <p class="rv-sub">${n ? 'You’ll see a book and a page number. Recall what you marked there before you look.' : `Next up: page ${next.m.page} of ${esc(next.b.title)}, ${relDays(dueAt(next.m))}.`}</p>
      <div class="rv-actions">${n ? `<button type="button" class="btn primary lg block" data-act="rv-start">Start</button>` : `<button type="button" class="btn lg block" data-act="rv-practice">Practice a random page</button>`}</div></section>`;
    return h;
  }
  if (!cur) { V.rv.id = due[0].m.id; V.rv.shown = false; cur = due[0]; }
  const { m, b } = cur;
  h += `<section class="rv-card" data-acc style="${accStyle(b.color)}">
    <p class="rv-src">${esc(b.title)}${due.length ? ' · ' + due.length + ' left' : ''}</p>
    <h2 class="rv-q">What did you mark on <em>page ${m.page}</em>?</h2>`;
  if (!V.rv.shown) {
    h += `<button type="button" class="btn tinted lg block" data-act="rv-show">Show my note</button><p class="help">Not sure? Open your copy to page ${m.page} first.</p>`;
  } else {
    const see = linksOf(m.id).map(({ l, other }) => ({ l, o: findMark(other) })).filter((x) => x.o);
    h += `<p class="rv-ans">${esc(m.text)}</p>`;
    if (see.length) h += see.map(({ l, o }) => `<div class="g-stack" style="padding:0"><span class="top"><span class="ref">${esc(shortRef(o.b))} ${o.m.page}</span><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p></div>`).join('');
    h += `<div class="rv-foot"><button type="button" class="btn lg miss" data-act="rv-forgot">Forgot</button><button type="button" class="btn primary lg" data-act="rv-got">Remembered</button></div>`;
  }
  return h + `</section>`;
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
    main.innerHTML = inBook ? html : V.name === 'revisit' ? viewRevisit() : viewShelf();
  }
  const bar = $('#bookBar');
  if (book) { bar.innerHTML = bookBarHtml(book); bar.hidden = false; } else bar.hidden = true;
  const cur = inBook ? 'shelf' : V.name;
  for (const [id, name] of [['tabShelf', 'shelf'], ['tabAsk', 'ask'], ['tabRevisit', 'revisit']]) {
    const t = document.getElementById(id);
    if (name === cur) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  const n = dueList().length, badge = $('#rvBadge');
  badge.textContent = n > 9 ? '9+' : String(n); badge.hidden = !n;
  if (V.flash) {
    const el = document.getElementById('m-' + V.flash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    const f = V.flash; setTimeout(() => { if (V.flash === f) V.flash = null; }, 1600);
  }
}

function go(name) {
  closeSheets();
  V.name = name;
  if (name === 'revisit') V.rv = { id: null, shown: false, done: 0, started: false };
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

/* mark a page */
function openMark(bookId) {
  if (!S.books.length) { openBook(null); toast('Add the book first, then mark its pages.'); return; }
  const order = shelfOrder();
  const bid = bookId || (V.name === 'book' && V.bookId) || V.lastBookId || order[0].id;
  $('#markBooks').innerHTML = order.map((b) => `<label class="bk"><input type="radio" name="markBook" value="${esc(b.id)}"${b.id === bid ? ' checked' : ''}><span class="d" style="${dotStyle(b.color)}" aria-hidden="true"></span><span>${esc(b.title)}</span></label>`).join('');
  $('#markPage').value = ''; $('#markText').value = ''; $('#markErr').textContent = '';
  $('#markHint').textContent = 'Short beats complete. Six to twelve words is plenty.';
  openSheet('sheetMark');
  const chk = $('#markBooks input:checked'); if (chk) chk.parentElement.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  setTimeout(() => $('#markPage').focus(), 60);
}
function submitMark(e) {
  e.preventDefault();
  const err = $('#markErr');
  const sel = $('input[name="markBook"]:checked');
  const b = sel && S.books.find((x) => x.id === sel.value);
  const page = parseInt($('#markPage').value.replace(/\D/g, ''), 10);
  const text = $('#markText').value.trim().replace(/\s+/g, ' ');
  if (!b) { err.textContent = 'Pick the book this page is from.'; return; }
  if (!Number.isFinite(page) || page < 1) { err.textContent = 'Enter the page number, like 83.'; $('#markPage').focus(); return; }
  if (b.pages && page > b.pages) { err.textContent = `This book has ${b.pages} pages. Check the page number.`; $('#markPage').focus(); return; }
  if (!text) { err.textContent = 'Write one line about the page in your own words.'; $('#markText').focus(); return; }
  const m = addMark(b.id, page, text);
  bump(b.id); V.lastBookId = b.id;
  changed(); closeSheets();
  if (V.name === 'book' && V.bookId === b.id) V.flash = m.id;
  render();
  toast(`Marked page ${page}`, allMarks().length > 1 ? { label: 'Link it', act: () => openLink(m.id) } : null);
}

/* add or edit a book */
let BK = null;
function openBook(id) {
  const b = id ? store.books[id] : null;
  BK = { id: b ? b.id : null };
  $('#bookH').textContent = b ? 'Edit book' : 'New book';
  $('#bookSave').textContent = b ? 'Save' : 'Add';
  $('#bTitle').value = b ? b.title : ''; $('#bAuthor').value = b ? (b.author || '') : ''; $('#bPages').value = b && b.pages ? b.pages : '';
  const used = new Set(S.books.map((x) => x.color));
  const cur = b ? (PAL[b.color] ? b.color : 'moss') : (PKEYS.find((k) => !used.has(k)) || PKEYS[S.books.length % PKEYS.length]);
  $('#bColors').innerHTML = PKEYS.map((k) => `<label class="sw"><input type="radio" name="bColor" value="${k}"${k === cur ? ' checked' : ''}><span class="d" style="${dotStyle(k)}" aria-hidden="true"></span><span class="sr">${PAL[k].name}</span></label>`).join('');
  $('#bookErr').textContent = '';
  $('#bookDanger').innerHTML = b ? `<button type="button" class="link danger" data-act="book-del">Delete book</button>` : '';
  openSheet('sheetBook');
  if (!b) setTimeout(() => $('#bTitle').focus(), 60);
}
function submitBook(e) {
  e.preventDefault();
  const title = $('#bTitle').value.trim().replace(/\s+/g, ' ');
  const author = $('#bAuthor').value.trim().replace(/\s+/g, ' ');
  const pr = parseInt($('#bPages').value.replace(/\D/g, ''), 10);
  const pages = Number.isFinite(pr) && pr > 0 ? pr : null;
  const color = ($('input[name="bColor"]:checked') || {}).value || 'moss';
  if (!title) { $('#bookErr').textContent = 'Give the book a title.'; $('#bTitle').focus(); return; }
  if (BK && BK.id) {
    const rec = store.books[BK.id];
    const vb = S.books.find((x) => x.id === BK.id);
    if (pages && vb && vb.marks.some((m) => m.page > pages)) { $('#bookErr').textContent = `You have marks past page ${pages}. Check the total.`; return; }
    Object.assign(rec, { title, author, pages, color }); touch(rec);
    changed(); closeSheets(); render(); toast('Book updated');
  } else {
    const b = addBook({ title, author, pages, color });
    V.lastBookId = b.id;
    changed(); closeSheets();
    V.name = 'book'; V.bookId = b.id; render(); window.scrollTo(0, 0);
    toast(`Added ${title}`, { label: 'Mark a page', act: () => openMark(b.id) });
  }
}
function deleteBook() {
  const rec = store.books[BK.id]; if (!rec) return;
  const ids = new Set(Object.values(store.marks).filter((m) => m.book_id === rec.id && !m.deleted).map((m) => m.id));
  rec.deleted = true; touch(rec);
  ids.forEach((id) => { store.marks[id].deleted = true; touch(store.marks[id]); });
  Object.values(store.links).forEach((l) => { if (!l.deleted && (ids.has(l.a) || ids.has(l.b))) { l.deleted = true; touch(l); } });
  if (V.lastBookId === rec.id) V.lastBookId = null;
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
  body.innerHTML = `
    <div class="sheet-head"><button type="button" class="link" data-act="close">Close</button><h2>Page ${m.page}</h2><button type="submit" form="detailForm" class="link strong">Save</button></div>
    <p class="eyebrow" style="color:var(--acc)">${esc(b.title)} · revisit ${relDays(dueAt(m))}</p>
    <form id="detailForm" class="sheet-in" style="padding:0" novalidate>
      <div class="field"><label class="lbl" for="dPage">Page</label><input id="dPage" class="input page-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${m.page}"></div>
      <div class="field"><label class="lbl" for="dText">Your line</label><textarea id="dText" class="tx" rows="3" maxlength="280">${esc(m.text)}</textarea></div>
      <p class="err-msg" id="dErr" role="alert"></p>
    </form>
    <div class="field"><span class="lbl">See also</span>
    ${ls.length ? `<ul class="group" style="box-shadow:none;background:var(--fill)">${ls.map(({ l, o }) => `<li class="g-stack"><span class="top"><button type="button" class="ref" data-act="goto-mark" data-id="${esc(o.m.id)}">${esc(shortRef(o.b))} ${o.m.page}</button><span class="lt">${esc(o.m.text)}</span></span><p class="because">Because: ${esc(l.because)}</p><span><button type="button" class="link danger" style="font-size:15px" data-act="unlink" data-id="${esc(l.id)}">Remove link</button></span></li>`).join('')}</ul>`
      : `<p class="help" style="padding:0 4px">No links yet. Is this like something you marked in another book?</p>`}</div>
    <button type="button" class="btn primary lg block" data-act="link-from" data-id="${esc(m.id)}"${allMarks().length > 1 ? '' : ' disabled'}>${I.link}This is like…</button>
    <button type="button" class="link danger" style="align-self:center" data-act="del-mark">Delete mark</button>`;
}
function submitDetail(e) {
  e.preventDefault();
  const f = findMark(DT.id); if (!f) return;
  const page = parseInt($('#dPage').value.replace(/\D/g, ''), 10);
  const text = $('#dText').value.trim().replace(/\s+/g, ' ');
  if (!Number.isFinite(page) || page < 1) { $('#dErr').textContent = 'Enter the page number, like 83.'; return; }
  if (f.b.pages && page > f.b.pages) { $('#dErr').textContent = `This book has ${f.b.pages} pages.`; return; }
  if (!text) { $('#dErr').textContent = 'The line can’t be empty.'; return; }
  const rec = store.marks[DT.id];
  Object.assign(rec, { page, text }); touch(rec); bump(rec.book_id);
  changed(); closeSheets(); render(); toast('Mark updated');
}
function deleteMark() {
  const rec = store.marks[DT.id]; if (!rec) return;
  rec.deleted = true; touch(rec);
  Object.values(store.links).forEach((l) => { if (!l.deleted && (l.a === rec.id || l.b === rec.id)) { l.deleted = true; touch(l); } });
  changed(); closeSheets(); render(); toast(`Deleted the mark on page ${rec.page}`);
}

/* link: "this is like that" */
let LK = null;
function openLink(fromId, toId) {
  const f = findMark(fromId); if (!f) return;
  LK = { from: fromId, to: toId || null, q: '', ai: null, because: '' };
  setAcc($('#linkBody'), f.b.color);
  renderLink(); openSheet('sheetLink');
}
const pairHtml = (label, f) => `<div class="pair"><span class="src">${label} · ${esc(f.b.title)} · p.${f.m.page}</span><p>${esc(f.m.text)}</p></div>`;
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
    cands = cands.map((c) => ({ c, s: score(qt, toks(c.m.text + ' ' + c.b.title + ' ' + (c.b.author || ''))) + (c.m.text.toLowerCase().includes(ql) ? 2 : 0) + (String(c.m.page) === ql ? 5 : 0) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
  } else {
    cands.sort((x, y) => (x.b.id === from.b.id) - (y.b.id === from.b.id) || (y.b.touched || 0) - (x.b.touched || 0) || x.m.page - y.m.page);
  }
  const ai = aiIds.map(findMark).filter((x) => x && cands.some((c) => c.m.id === x.m.id));
  const list = [...ai.map((x) => ({ ...x, ai: true })), ...cands.filter((c) => !aiIds.includes(c.m.id))].slice(0, 40);
  if (!list.length) return `<li class="help" style="padding:14px">${LK.q.trim() ? 'No marks match that search.' : 'No other marks yet. Mark a page in another book first.'}</li>`;
  return list.map(({ m, b, ai: isAi }) => `<li><button type="button" data-act="link-pick" data-id="${esc(m.id)}"><span class="ref" data-acc style="${accStyle(b.color)}">${esc(shortRef(b))} ${m.page}</span><span class="pt">${esc(m.text)}</span>${isAi ? '<span class="tag">AI pick</span>' : ''}</button></li>`).join('');
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
  toast(`Linked to ${shortRef(b.b)} ${b.m.page}`);
}
async function suggestLinks() {
  if (!aiOn() || !LK) return;
  const from = findMark(LK.from);
  const others = allMarks().filter(({ m }) => m.id !== LK.from && !isLinked(LK.from, m.id)).slice(0, 1500);
  if (!others.length) return;
  const keep = LK;
  LK.ai = 'loading'; renderThat();
  try {
    const r = await api('/api/suggest', { from: noteFor(from), others: others.map(noteFor) });
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
  const rec = store.marks[V.rv.id]; if (!rec) return;
  const n = ok ? (rec.rev_n || 0) + 1 : 0;
  const days = ok ? STEPS[Math.min(n, STEPS.length - 1)] : 1;
  Object.assign(rec, { rev_n: n, rev_due: isoAt(Date.now() + days * DAY), rev_last: nowISO() }); touch(rec);
  changed();
  V.rv.id = null; V.rv.shown = false; V.rv.done += 1;
  render(); window.scrollTo(0, 0);
  toast(ok ? `Next look in ${plural(days, 'day')}` : 'You’ll see it again tomorrow');
}

/* example shelf */
function loadExamples() {
  const now = Date.now();
  const shelf = [
    { title: 'Basic Economics', author: 'Thomas Sowell', pages: 700, color: 'ember', t: 3, marks: [
      [12, 'Scarcity: any use of a thing is a use denied elsewhere', 40, 6], [27, 'Prices are signals, not just costs', 38, -0.1],
      [48, 'Rent control shrinks the housing it means to protect', 36, 9], [83, 'Opportunity cost: the real price is the next-best option', 33, 12],
      [112, 'Every policy has a second act nobody votes on', 30, -0.05], [140, 'Incentives beat intentions', 27, 4]] },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', pages: 500, color: 'indigo', t: 1, marks: [
      [20, 'Two systems: fast intuition and slow effort', 25, 8], [119, 'Anchoring: the first number drags the estimate', 22, 2],
      [283, 'Losses feel about twice as strong as gains', 19, -0.2], [344, 'Sunk cost: we keep paying because we already paid', 16, 5],
      [410, 'We judge an experience by its peak and its end', 12, 10]] },
    { title: 'The Psychology of Money', author: 'Morgan Housel', pages: 256, color: 'lagoon', t: 0, marks: [
      [19, 'Your own experience sets your view of risk', 9, 3], [39, 'Knowing when you have enough', 7, 6],
      [74, 'Compounding rewards time more than brilliance', 5, 1], [143, 'Room for error keeps you in the game', 2, 1]] }
  ];
  const ids = {};
  shelf.forEach((s, i) => {
    const b = addBook({ title: s.title, author: s.author, pages: s.pages, color: s.color, example: true, created: isoAt(now - (50 - i) * DAY), touched: isoAt(now - s.t * DAY) });
    for (const [page, text, ago, dueIn] of s.marks) ids[i + ':' + page] = addMark(b.id, page, text, { created: now - ago * DAY, due: now + dueIn * DAY, n: 1 }).id;
  });
  addLink(ids['0:83'], ids['1:344'], 'Both say the past is spent. Only the next choice counts.', true);
  addLink(ids['1:283'], ids['2:19'], 'Fear of loss is learned from what you lived through.', true);
  addLink(ids['0:112'], ids['2:143'], 'You have to plan for consequences you can’t see yet.', true);
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
      ${allMarks().length ? `<li><button type="button" class="g-row acc" data-act="export-md">Export index as Markdown</button></li>` : ''}
      <li><button type="button" class="g-row acc" data-act="export-json">Export backup</button></li>
      ${deferredInstall ? `<li><button type="button" class="g-row acc" data-act="install">Install Cairn</button></li>` : ''}
      ${S.examples ? `<li><button type="button" class="g-row danger" data-act="clear-examples">Remove example shelf</button></li>` : ''}
    </ul>
    <div class="field"><span class="lbl">Appearance</span>
      <div class="seg theme-seg" role="group" aria-label="Appearance"><span class="thumb" aria-hidden="true" style="transform:translateX(${ti * 100}%)"></span>
        <button type="button" aria-pressed="${t === 'system'}" data-act="theme" data-v="system">Automatic</button><button type="button" aria-pressed="${t === 'light'}" data-act="theme" data-v="light">Light</button><button type="button" aria-pressed="${t === 'dark'}" data-act="theme" data-v="dark">Dark</button></div></div>
    <p class="sec-h" style="margin:4px 0 0">How it works</p>
    <ol class="steps">
      <li><span><b>Mark.</b> When a page matters, write its number and one line in your own words.</span></li>
      <li><span><b>Link.</b> When one idea is like another, connect them and write why.</span></li>
      <li><span><b>Ask.</b> Cairn walks your shelf and points to the book and the page.</span></li>
      <li><span><b>Revisit.</b> Recall what a page held before you look. The gaps grow as you remember.</span></li>
    </ol>`;
}
function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportMd() {
  let md = `# My Cairn index\n\nExported ${new Date().toLocaleDateString()}\n`;
  for (const b of shelfOrder()) {
    md += `\n## ${b.title}${b.author ? ' — ' + b.author : ''}\n\n`;
    for (const m of [...b.marks].sort((x, y) => x.page - y.page)) {
      md += `- p.${m.page} · ${m.text}\n`;
      for (const { l, other } of linksOf(m.id)) { const o = findMark(other); if (o) md += `  - see also: ${o.b.title}, p.${o.m.page} (because: ${l.because})\n`; }
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

/* toast */
let toastTimer = null;
function toast(msg, action) {
  const el = $('#toast');
  if (typeof action === 'number') action = null;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) el.querySelector('button').addEventListener('click', () => { el.hidden = true; action.act(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6500 : 3200);
}

/* ───────────── events ───────────── */
const ACT = {
  go: (t) => go(t.dataset.to),
  'open-book': (t) => { V.bookId = t.dataset.id; go('book'); },
  'book-new': () => openBook(null),
  'book-edit': (t) => openBook(t.dataset.id),
  'book-del': (t) => armed('book-' + BK.id, t, 'Tap again to delete the book and its marks', deleteBook),
  'mark-new': (t) => openMark(t.dataset.book),
  'open-mark': (t) => openDetail(t.dataset.id),
  'goto-mark': (t) => { const f = findMark(t.dataset.id); if (!f) return; closeSheets(); V.bookId = f.b.id; V.flash = f.m.id; V.name = 'book'; render(); },
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
  'rv-practice': () => { const all = allMarks(); const p = all[Math.floor(Math.random() * all.length)]; V.rv = { ...V.rv, id: p.m.id, shown: false, started: true }; render(); },
  'load-examples': () => loadExamples(),
  'clear-examples': () => clearExamples(),
  menu: () => openMenu(),
  signin: () => openAuth(),
  signout: async () => { if (sb) await sb.auth.signOut(); closeSheets(); toast('Signed out. Your shelf stays on this device.'); },
  sync: () => syncNow(),
  theme: (t) => { config.theme = t.dataset.v; saveConfig(); applyTheme(); renderMenu(); },
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
    else if (id === 'askForm') {
      e.preventDefault();
      V.ask.q = $('#askQ').value.trim();
      if (V.ask.ctl) V.ask.ctl.abort();
      V.ask.ai = null; V.ask.res = V.ask.q ? search(V.ask.q) : null;
      $('#askQ').blur(); render();
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'linkQ') { LK.q = t.value; $('#linkList').innerHTML = pickerItems(); }
    else if (t.id === 'linkBecause') { LK.because = t.value; $('#linkErr').textContent = ''; updateLinkSave(); }
    else if (t.id === 'askQ') V.ask.q = t.value;
    else if (t.id === 'markText') {
      const n = (t.value.trim().match(/\S+/g) || []).length;
      $('#markHint').textContent = n > 20 ? `${n} words. Can you say it in fewer? Short lines are easier to scan later.` : 'Short beats complete. Six to twelve words is plenty.';
    } else if (t.id === 'markPage' || t.id === 'bPages' || t.id === 'dPage') {
      const clean = t.value.replace(/\D/g, '').slice(0, 5); if (clean !== t.value) t.value = clean;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'markPage') { e.preventDefault(); $('#markText').focus(); }
    else if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'markText') { e.preventDefault(); $('#markForm').requestSubmit(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncNow(); queueRender(); } });
  window.addEventListener('online', syncNow);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('beforeunload', persistNow);
  setInterval(() => { syncNow(); if (V.name !== 'ask') queueRender(); }, 60000);
}

/* ───────────── init ───────────── */
async function init() {
  applyTheme();
  derive();
  wire();
  render();
  await initSupabase();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.Cairn = { get store() { return store; }, get S() { return S; }, syncNow, search };
init();
})();
