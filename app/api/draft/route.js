// POST /api/draft — drafts a one-line note for each imported Kindle highlight. You edit it before keeping it.
// Body: { items: [{id, book, author, quote}] }  (up to 30)  →  { drafts: [{id, line}] }

import { askClaude, guard, json, parseObject, QUICK_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `A reader is turning their Kindle highlights into an index of one-line notes. For each highlight, draft the line they might write in the margin: the passage's idea in plain, everyday words, at most 12 words. Not a quote, no quotation marks, no "the author says". If a highlight is too fragmentary to say anything, use "" for it.

Respond with ONLY a JSON object: {"drafts":[{"id":"...","line":"..."}]}`;

const str = (v, n) => String(v ?? "").slice(0, n);

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const items = (Array.isArray(b?.items) ? b.items : []).slice(0, 30)
    .map((it) => ({ id: str(it?.id, 64), book: str(it?.book, 160), author: str(it?.author, 100), quote: str(it?.quote, 1500).replace(/\s+/g, " ") }))
    .filter((it) => it.id && it.quote);
  if (!items.length) return json({ error: "bad_request" }, 400);

  const prompt = "HIGHLIGHTS (id | book (author) | highlighted text)\n" +
    items.map((it) => `${it.id} | ${it.book}${it.author ? ` (${it.author})` : ""} | ${it.quote}`).join("\n");

  const r = await askClaude({ model: QUICK_MODEL(), system: SYSTEM, prompt, maxTokens: 2500 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  const known = new Set(items.map((it) => it.id));
  const drafts = (Array.isArray(parsed.drafts) ? parsed.drafts : [])
    .map((d) => ({ id: str(d?.id, 64), line: str(d?.line, 200).replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim() }))
    .filter((d) => known.has(d.id));
  return json({ drafts });
}
