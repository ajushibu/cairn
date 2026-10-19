// POST /api/suggest — points at marks that might be "like" a new one.
// Body: { from: {id, book, page, loc, text}, others: [{id, book, page, loc, text}] }  →  { ids: [...] }
// Claude only points. It never writes the reason; the reader does that in the app.

import { askClaude, guard, json, parseObject, QUICK_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `A reader keeps an index of the books they read, on paper, Kindle and in an app. For each place that mattered they keep a page number or location, one line in their own words, and often the passage they highlighted and its chapter. They link two notes when one idea is like another ("this is like that"), and they always write the reason themselves.

Given one new note and the reader's other notes, pick up to 3 other notes whose idea is genuinely alike or analogous to the new note. Judge by the idea in the reader's line AND in the highlighted passage: a shared claim, mechanism, example, number or evidence counts, even when the wording differs. Notes may also list "see also" reasons the reader already wrote; use them to understand how the reader thinks, not as a reason to repeat a link. Prefer notes from other books. Never invent ids. Do not explain your picks.

Respond with ONLY a JSON object: {"ids":["...","..."]} with the best match first. Use {"ids":[]} if nothing truly fits.`;

const clean = (n, quoteMax) => ({
  id: String(n?.id ?? "").slice(0, 64),
  book: String(n?.book ?? "").slice(0, 160),
  page: Number.isFinite(+n?.page) && +n.page > 0 ? Math.round(+n.page) : null,
  loc: Number.isFinite(+n?.loc) && +n.loc > 0 ? Math.round(+n.loc) : null,
  chapter: String(n?.chapter ?? "").replace(/\s+/g, " ").slice(0, 80),
  text: String(n?.text ?? "").slice(0, 300),
  quote: String(n?.quote ?? "").replace(/\s+/g, " ").slice(0, quoteMax),
  see: (Array.isArray(n?.see) ? n.see : []).slice(0, 3).map((x) => String(x ?? "").slice(0, 120)).filter(Boolean),
});

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const from = clean(b?.from, 600);
  const others = (Array.isArray(b?.others) ? b.others : []).map((n) => clean(n, 200)).filter((n) => n.id && (n.text || n.quote) && n.id !== from.id).slice(0, 800);
  if (!(from.text || from.quote) || !others.length) return json({ error: "bad_request" }, 400);

  const line = (n) => [n.id, n.book, n.page ? `p.${n.page}` : n.loc ? `loc ${n.loc}` : "?", n.chapter ? `ch. ${n.chapter}` : "", n.text || "(no line yet)",
    n.quote ? `passage: "${n.quote}"` : "", n.see.length ? `see also: ${n.see.join("; ")}` : ""].filter((x, i) => i < 3 || x).join(" | ");
  const prompt = `NEW NOTE\n${line(from)}\n\nOTHER NOTES (id | book | page or location | chapter | the reader's line | highlighted passage | see-also reasons)\n${others.map(line).join("\n")}`;

  const r = await askClaude({ model: QUICK_MODEL(), system: SYSTEM, prompt, maxTokens: 600 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  const known = new Set(others.map((n) => n.id));
  const ids = (Array.isArray(parsed.ids) ? parsed.ids : []).map(String).filter((id) => known.has(id)).slice(0, 3);
  return json({ ids });
}
