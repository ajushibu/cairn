// POST /api/ask — "Look deeper": answers a question from the reader's own marks only.
// Body: { question, notes: [{id, book, author, page, text}], links: [{a, b, because}] }
//   →  { ids: [...], answer, gap }

import { askClaude, guard, json, parseObject, ASK_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You help a reader search their own index of the paper books they read. Each note is a page number and one line the reader wrote in their own words. Links join two notes the reader thinks are alike, with the reason they wrote.

Use ONLY the notes and links given. Never add outside knowledge, even when you know the book.

Respond with ONLY a JSON object:
{"ids":["..."],"answer":"...","gap":"..."}
- ids: up to 4 note ids that best answer the question, best first. [] if none fit.
- answer: one or two plain sentences that answer from those notes only, citing like (Kahneman p.344). "" if none fit.
- gap: one short sentence naming what the reader's notes don't cover about this question, or "" if nothing important is missing.`;

const str = (v, n) => String(v ?? "").slice(0, n);

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = str(b?.question, 500).trim();
  const notes = (Array.isArray(b?.notes) ? b.notes : []).slice(0, 2000).map((n) => ({
    id: str(n?.id, 64), book: str(n?.book, 160), author: str(n?.author, 100),
    page: Number.isFinite(+n?.page) ? Math.round(+n.page) : 0, text: str(n?.text, 300),
  })).filter((n) => n.id && n.text);
  const links = (Array.isArray(b?.links) ? b.links : []).slice(0, 1000).map((l) => ({ a: str(l?.a, 64), b: str(l?.b, 64), because: str(l?.because, 240) }));
  if (!question || !notes.length) return json({ error: "bad_request" }, 400);

  let prompt = `QUESTION\n${question}\n\nNOTES (id | book (author) | page | note)\n`;
  prompt += notes.map((n) => `${n.id} | ${n.book}${n.author ? ` (${n.author})` : ""} | p.${n.page} | ${n.text}`).join("\n");
  prompt += `\n\nLINKS (note ~ note | because)\n${links.length ? links.map((l) => `${l.a} ~ ${l.b} | ${l.because}`).join("\n") : "(none)"}`;

  const r = await askClaude({ model: ASK_MODEL(), system: SYSTEM, prompt, maxTokens: 1500 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  const known = new Set(notes.map((n) => n.id));
  return json({
    ids: (Array.isArray(parsed.ids) ? parsed.ids : []).map(String).filter((id) => known.has(id)).slice(0, 4),
    answer: str(parsed.answer, 800),
    gap: str(parsed.gap, 300),
  });
}
