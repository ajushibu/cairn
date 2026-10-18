# Cairn

A personal index for the paper books you read. When a page matters, write its number and one line in your own words. Link ideas across books and say why they're alike. Later, ask a question and Cairn walks your shelf and points to the book and the page.

Same family as margin and recall.

![Cairn in light mode: shelf, a book's index, Ask, Revisit](docs/screens/light.png)

## The idea
Reading with no notes leaves very little behind. Cairn turns each book into your own table of contents with page numbers, so a question later becomes a short walk: not that book, not that book, that book, that page.

The effort is the point, so the app never does the remembering for you:
- You write every line yourself.
- A link between two marks needs a *because* sentence you write. Claude can point at likely matches, but it never writes the reason.

## What it does
- **Mark**: page number plus one line in your own words. Enter moves from the page to the line; Enter again saves.
- **Index**: each book reads like a back-of-book index, with dot leaders and page numbers, sorted by page or A–Z. It also shows the part of the book you haven't indexed yet.
- **Link** ("this is like that"): connect two marks, usually across books, and write why. Links show up as *see also* lines.
- **Ask**: word search across your marks and your *because* lines. It walks the shelf book by book, then shows the page in large type and the see-also trail from there.
- **Look deeper** (Claude): matches ideas instead of words, using only your notes, and says what your notes don't cover.
- **Revisit**: shows a book and a page number; you recall what you marked there before you look. Pass → 3 days → 7 → growing; miss → tomorrow, the same steps as recall.
- **Export**: your whole index as Markdown.

## Where your shelf is saved
| Opened as | Saving | Claude features |
|---|---|---|
| A Claude artifact on claude.ai | Your Claude account, private to you, synced across devices | Suggest matches and Look deeper work, on your Claude usage |
| Anything else (GitHub Pages, Vercel, the file on your laptop) | That browser only. Clearing site data erases it | Off. Ask uses word search only |

## Project layout
```
index.html             the whole app: markup, styles (tokens at the top; dark mode redefines them) and logic
design/directions.png  the four directions explored first
design/canvas/         source files for those directions
docs/screens/          screenshots, light and dark
```

## Run it
- Open `index.html` in a browser, or run `npx serve .` and open http://localhost:3000.
- **GitHub Pages**: Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
- **Vercel**: Add New → Project → import this repo, framework *Other*, nothing to build.

## Design
- Follows margin and recall: grouped background, white cards, rounded heavy titles (SF Pro Rounded, falling back to Nunito), serif for your own words (New York, falling back to Newsreader), pill buttons, glass bars, a phone tab bar, colour tiles. Book colours reuse margin's palette (indigo, ocean, lagoon, grape, dusk) plus three of Cairn's own: moss, ember and stone. Moss is Cairn's accent.
- Cairn's own parts: dot leaders and page numbers like a printed index, *see also* links, and the shelf walk in Ask.
- The four directions in `design/` were drawn before the margin and recall look was applied. They used MarginNote and Recall AI as references by mistake. Direction A, the index, was picked; the app keeps its structure and now wears the margin and recall look.

![The four directions: index, trail, atlas and stack](design/directions.png)

## Limits
- Outside Claude there's no sync and no Claude. Moving it to margin and recall's stack (Supabase plus Next.js API routes on Vercel) would add sync, your margin login and Claude through your own API key.
- Ask is a word search unless you use Look deeper.
- Not installable yet: no manifest or service worker.
- The example shelf's page numbers are made up.
