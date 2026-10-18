// POST /api/kindle — reads photos of a Kindle e-reader screen and pulls out the reader's own highlights.
// Body: { book: {title, author}, images: [{type: "image/jpeg", data: "<base64>"}] }  (up to 4 photos per call)
//   →  { items: [{photo, quote, page, loc, draft, partial}] }
// The browser shrinks photos before sending and calls again for the next four.

import { askClaude, guard, json, parseObject, ASK_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You read photos of a Kindle e-reader screen and pull out the reader's own highlights.

On a Kindle e-reader the reader's highlights show as shaded (grey) text or a solid underline. "Popular highlights" from other readers show as a dotted underline, sometimes with a count such as "1,234 highlighters": ignore those. The footer usually shows a position such as "Location 1234", "Loc 1234", "Page 45" or "Page 45 of 300", sometimes with a percentage.

For each highlighted passage:
- photo: the number of the photo it is on.
- quote: the exact highlighted text. Copy it, fix only obvious reading errors, never paraphrase. If it runs off the edge of the photo, include what is visible and set partial to true.
- page: the page number shown on that photo, or null.
- loc: the location number shown on that photo, or null. If a range is shown, use the first number.
- draft: the passage's idea in plain, everyday words, at most 12 words. Not a quote and not a summary of the book: what this passage says, the way the reader might jot it in a margin.

A photo with no highlight adds nothing. Never invent text you cannot see.

Respond with ONLY a JSON object:
{"items":[{"photo":1,"quote":"...","page":null,"loc":1234,"draft":"...","partial":false}]}`;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const int = (v) => (Number.isFinite(+v) && +v > 0 ? Math.round(+v) : null);

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const title = String(b?.book?.title ?? "").slice(0, 200);
  const author = String(b?.book?.author ?? "").slice(0, 120);
  const images = (Array.isArray(b?.images) ? b.images : [])
    .filter((im) => TYPES.has(im?.type) && typeof im?.data === "string" && im.data.length < 2_000_000)
    .slice(0, 4);
  if (!images.length) return json({ error: "bad_request" }, 400);

  const content = [];
  images.forEach((im, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } });
  });
  content.push({ type: "text", text: `These are ${images.length} photo(s) from ${title ? `"${title}"${author ? ` by ${author}` : ""}` : "a book"}. Pull out the reader's highlights.` });

  const r = await askClaude({ model: ASK_MODEL(), system: SYSTEM, content, maxTokens: 3000 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  const items = (Array.isArray(parsed.items) ? parsed.items : []).map((it) => ({
    photo: int(it?.photo) || 1,
    quote: String(it?.quote ?? "").replace(/\s+/g, " ").trim().slice(0, 2000),
    page: int(it?.page),
    loc: int(it?.loc),
    draft: String(it?.draft ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    partial: !!it?.partial,
  })).filter((it) => it.quote).slice(0, 40);
  return json({ items });
}
