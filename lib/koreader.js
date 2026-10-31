// Reads KOReader HighlightSync files from the reader's cloud folder, for /api/koreader.
// KOReader (installed on the Kindle) saves one JSON file per book: "Title - Author.sdr-….json", a list of highlights.
// Two ways to read the folder, whichever is set up:
//   pCloud API   PCLOUD_AUTH (a token you make yourself, not your password), PCLOUD_FOLDER, optional PCLOUD_HOST
//   WebDAV       KOREADER_WEBDAV_URL (the folder), KOREADER_WEBDAV_USER, KOREADER_WEBDAV_PASS

const MAX_FILES = 200;
const MAX_BYTES = 2_000_000;

/* ---------- reading the files ---------- */

// The book isn't named inside the file, so title and author come from the file name.
export function koBookFromName(name) {
  const n = String(name || "").replace(/\.json$/i, "").replace(/\.sdr[-_\d]*$/i, "").replace(/_/g, " ").trim();
  let title = n, author = "";
  const cut = n.lastIndexOf(" - ");
  if (cut > 0) { title = n.slice(0, cut).trim(); author = n.slice(cut + 3).trim(); }
  const art = title.match(/^(.*?),?\s{2,}(The|A|An)$/i); // "River of Doubt  The" was "River of Doubt, The"
  title = (art ? `${art[2]} ${art[1]}` : title).replace(/\s+/g, " ").trim();
  return { title: title || "Untitled", author: author.replace(/\s+/g, " ") };
}

// Returns { title, author, hl: [{page, text, at, note}] } or null when the file isn't a highlight list.
export function koParse(text, name) {
  let j;
  try { j = JSON.parse(String(text).replace(/^﻿/, "")); } catch { return null; }
  const list = Array.isArray(j) ? j : Array.isArray(j?.highlights) ? j.highlights : null;
  if (!list || !list.some((h) => h && typeof h.text === "string" && (h.pos0 || h.pageno || h.datetime))) return null;
  // While a highlight is being dragged the plugin can save the shorter versions first. Keep the longest per start point.
  const byStart = new Map();
  for (const h of list) {
    const t = String(h?.text || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const k = String(h.pos0 || t.slice(0, 40));
    const prev = byStart.get(k);
    if (prev && t.length <= prev.text.length) continue;
    const at = Date.parse(String(h.datetime || "").replace(" ", "T"));
    byStart.set(k, {
      text: t.slice(0, 4000),
      page: Number.isFinite(+h.pageno) && +h.pageno > 0 ? Math.round(+h.pageno) : null,
      at: Number.isFinite(at) ? at : null,
      note: String(h.note || "").replace(/\s+/g, " ").trim().slice(0, 600),
    });
  }
  const { title, author } = koBookFromName(name);
  return { title, author, hl: [...byStart.values()] };
}

/* ---------- the cloud folder ---------- */

export class SourceError extends Error { constructor(code, detail) { super(detail || code); this.code = code; } }

const loopback = (h) => /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(h);
const origin = (host) => (loopback(host) ? "http://" : "https://") + host;

export function source() {
  const auth = (process.env.PCLOUD_AUTH || "").trim(), folder = (process.env.PCLOUD_FOLDER || "").trim();
  if (auth && folder) {
    return {
      kind: "pcloud", auth,
      folder: "/" + folder.replace(/^\/+|\/+$/g, ""),
      host: (process.env.PCLOUD_HOST || "api.pcloud.com").trim().replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    };
  }
  const url = (process.env.KOREADER_WEBDAV_URL || "").trim();
  if (url) {
    let u; try { u = new URL(url); } catch { throw new SourceError("not_set_up", "KOREADER_WEBDAV_URL isn't a web address"); }
    if (u.protocol !== "https:" && !loopback(u.host)) throw new SourceError("not_set_up", "KOREADER_WEBDAV_URL must start with https://");
    return { kind: "webdav", url: u.href.replace(/\/*$/, "/"), user: process.env.KOREADER_WEBDAV_USER || "", pass: process.env.KOREADER_WEBDAV_PASS || "" };
  }
  return null;
}

async function get(url, init) {
  let res;
  try { res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }); }
  catch { throw new SourceError("storage_error", "couldn't reach the cloud folder"); }
  return res;
}

async function pcloud(src, method, params) {
  const q = new URLSearchParams({ ...params, auth: src.auth });
  const res = await get(`${origin(src.host)}/${method}?${q}`);
  const j = await res.json().catch(() => null);
  if (!j) throw new SourceError("storage_error", "pCloud sent something unexpected");
  if (j.result === 0) return j;
  if ([1000, 2000, 2094, 4000].includes(j.result)) throw new SourceError("auth_failed", `pCloud ${j.result}`);
  if (j.result === 2005 || j.result === 2009) throw new SourceError("folder_missing", `pCloud ${j.result}`);
  throw new SourceError("storage_error", `pCloud ${j.result}`);
}

// → [{ name, modified (ms), read: async () => text }]
export async function listJson(src) {
  if (src.kind === "pcloud") {
    const j = await pcloud(src, "listfolder", { path: src.folder, nofiles: "0" });
    return (j.metadata?.contents || []).filter((f) => !f.isfolder && /\.json$/i.test(f.name) && (f.size || 0) <= MAX_BYTES).map((f) => ({
      name: f.name, modified: Date.parse(f.modified) || 0,
      read: async () => {
        const l = await pcloud(src, "getfilelink", { path: `${src.folder}/${f.name}` });
        const host = (l.hosts || [])[0]; if (!host || !l.path) throw new SourceError("storage_error", "no download link");
        const r = await get(`${origin(host)}${l.path}`);
        if (!r.ok) throw new SourceError("storage_error", `download ${r.status}`);
        return r.text();
      },
    }));
  }
  const headers = { authorization: "Basic " + Buffer.from(`${src.user}:${src.pass}`).toString("base64") };
  const res = await get(src.url, {
    method: "PROPFIND", headers: { ...headers, depth: "1", "content-type": "application/xml" },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>`,
  });
  if (res.status === 401 || res.status === 403) throw new SourceError("auth_failed", `WebDAV ${res.status}`);
  if (res.status === 404) throw new SourceError("folder_missing", "WebDAV 404");
  if (res.status !== 207 && !res.ok) throw new SourceError("storage_error", `WebDAV ${res.status}`);
  const xml = await res.text();
  const out = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/gi)) {
    const b = m[1];
    if (/<(?:[\w-]+:)?collection\b/i.test(b)) continue;
    const href = (b.match(/<(?:[\w-]+:)?href[^>]*>([^<]+)</i) || [])[1]; if (!href) continue;
    const name = decodeURIComponent(href.replace(/\/+$/, "").split("/").pop() || "");
    if (!/\.json$/i.test(name)) continue;
    const size = +((b.match(/<(?:[\w-]+:)?getcontentlength[^>]*>(\d+)</i) || [])[1] || 0);
    if (size > MAX_BYTES) continue;
    const modified = Date.parse((b.match(/<(?:[\w-]+:)?getlastmodified[^>]*>([^<]+)</i) || [])[1] || "") || 0;
    const target = new URL(src.url + encodeURIComponent(name));
    out.push({ name, modified, read: async () => { const r = await get(target, { headers }); if (!r.ok) throw new SourceError("storage_error", `download ${r.status}`); return r.text(); } });
  }
  return out;
}

// Reads the folder and returns the books in files changed after `since` (ms). `latest` is the newest change seen.
export async function pullHighlights(src, since) {
  const all = (await listJson(src)).sort((a, b) => b.modified - a.modified).slice(0, MAX_FILES);
  const latest = all.reduce((n, f) => Math.max(n, f.modified), 0);
  const todo = all.filter((f) => !since || !f.modified || f.modified > since);
  const books = [];
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async (f) => {
      const p = koParse(await f.read(), f.name);
      if (p && p.hl.length) books.push(p);
    }));
  }
  return { books, files: todo.length, total: all.length, latest };
}
