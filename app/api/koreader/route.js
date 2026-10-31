// POST /api/koreader — reads your KOReader highlight files from your cloud folder and returns the books and highlights in them.
// Body: { since?: ms }  →  { books: [{title, author, hl: [{page, text, at, note}]}], files, total, latest }
// Cairn adds them to the Inbox. Nothing is written to the database here; only the signed-in owner can call this.

import { guard, json } from "../../../lib/server";
import { pullHighlights, source, SourceError } from "../../../lib/koreader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;
  let b = {};
  try { b = await req.json(); } catch { /* an empty body is fine */ }
  const since = Number.isFinite(+b?.since) && +b.since > 0 ? Math.round(+b.since) : 0;
  try {
    const src = source();
    if (!src) return json({ error: "not_set_up" }, 501);
    return json(await pullHighlights(src, since));
  } catch (e) {
    if (e instanceof SourceError) {
      console.error("koreader", e.code, e.message);
      return json({ error: e.code }, e.code === "not_set_up" ? 501 : e.code === "auth_failed" ? 502 : 502);
    }
    console.error("koreader", e);
    return json({ error: "storage_error" }, 502);
  }
}
