// POST /api/suggest — points at marks that might be "like" a new one.
// Body: { from: {id, book, page, loc, text}, others: [{id, book, page, loc, text}] }  →  { ids: [...] }
// Claude only points. It never writes the reason; the reader does that in the app.

import { askClaude, guard, json, parseObject, QUICK_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `A reader keeps an index of the paper books they read: for each page that mattered, the page number and one line in their own words. They link two notes when one idea is like another ("this is like that"), and they always write the reason themselves.

Given one new note and the reader's other notes, pick up to 3 other notes whose idea is genuinely alike or analogous to the new note. Prefer notes from other books. Never invent ids. Do not explain your picks.

Respond with ONLY a JSON object: {"ids":["...","..."]} with the best match first. Use {"ids":[]} if nothing truly fits.`;

const clean = (n) => ({
  id: String(n?.id ?? "").slice(0, 64),
  book: String(n?.book ?? "").slice(0, 160),
  page: Number.isFinite(+n?.page) && +n.page > 0 ? Math.round(+n.page) : null,
  loc: Number.isFinite(+n?.loc) && +n.loc > 0 ? Math.round(+n.loc) : null,
  text: String(n?.text ?? "").slice(0, 300),
});

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const from = clean(b?.from);
  const others = (Array.isArray(b?.others) ? b.others : []).map(clean).filter((n) => n.id && n.text && n.id !== from.id).slice(0, 1500);
  if (!from.text || !others.length) return json({ error: "bad_request" }, 400);

  const line = (n) => `${n.id} | ${n.book} | ${n.page ? `p.${n.page}` : n.loc ? `loc ${n.loc}` : "?"} | ${n.text}`;
  const prompt = `NEW NOTE\n${line(from)}\n\nOTHER NOTES (id | book | page or location | note)\n${others.map(line).join("\n")}`;

  const r = await askClaude({ model: QUICK_MODEL(), system: SYSTEM, prompt, maxTokens: 600 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  const known = new Set(others.map((n) => n.id));
  const ids = (Array.isArray(parsed.ids) ? parsed.ids : []).map(String).filter((id) => known.has(id)).slice(0, 3);
  return json({ ids });
}
