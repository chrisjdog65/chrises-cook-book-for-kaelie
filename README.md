# Kaelie's Recipe Book

A single self-contained HTML file — **`Kaelies-Recipe-Book.html`** — holding 200+ detailed
recipes. Open it on a phone, no internet needed, no app to install. Send the file to
someone and they just open it.

## Getting the book to her

Download `Kaelies-Recipe-Book.html` and send it however you like — text it, email it as an
attachment, drop it in a shared folder. She taps it and it opens. Scroll past the cover,
tap a chapter, tap a recipe.

Everything works offline. The only things that need a connection are the two link-out
buttons on each recipe ("Watch it made" and "See real photos"), which open YouTube and an
image search for that specific dish.

### Why it is built the way it is

iOS does not open `.html` attachments in Safari. It previews them in a reader that

* **does not run JavaScript**, and
* **does not follow in-page `#links`** — it hands them to a search engine instead.

So the book depends on neither. Every recipe is real HTML in the file, and chapters and
recipes open using native `<details>`/`<summary>` elements, which the browser toggles by
itself — no script, and no URL change for anything to intercept. There is not a single
internal link in the built file; the only links are the outbound YouTube and image-search
buttons.

That constraint is easy to break by accident, so if you change the renderer, keep these
true (they are all covered by the checks below):

* no `<a href="#...">` anywhere in the output
* nothing needed to read a recipe may live behind a script
* anything script-only is marked `.jsonly` so it hides instead of sitting there dead

## What's in it

Every recipe carries:

- An illustrated dish card, drawn as inline SVG so nothing can ever 404
- A full ingredient list with US **and** metric measurements
- Prep / cook / total time and servings
- 8–14 instruction steps written to explain the *why*, not just the *what*
- Chef tips, doneness temperatures in °F and °C, and a serving suggestion
- A **Watch it made** button (YouTube search for that exact dish) and a
  **See real photos** button (image search for the finished plate)

And the book itself does:

- Search across titles, ingredients and tags, with filters for quick, easy,
  impressive, and favorites
- Favorites, a shopping list, and tap-to-check ingredients and steps
- Batch scaling (½× / 1× / 2× / 3×) that refuses to scale per-item and
  dimension amounts, so it never prints two amounts that contradict each other
- Tap-to-start countdown timers pulled out of the step text, anchored to
  wall-clock time so they survive the phone backgrounding the tab
- Cook mode that keeps the screen awake
- Light and dark themes

## Rebuilding

Recipes live as JSON, one file per chapter, in `data/`. The book is assembled from them:

```bash
node build/build.js                  # writes Kaelies-Recipe-Book.html
node build/validate.js data/*.json   # check every chapter against the spec
node build/scale.test.js             # unit tests for ingredient scaling
node build/audit.js                  # cross-chapter duplicates, spread, art coverage

# the one that matters most — proves the book still works with scripts off
grep -c '<a [^>]*href="#' Kaelies-Recipe-Book.html   # must print 0
```

| path | what it is |
|---|---|
| `data/*.json` | the recipes, one file per chapter |
| `build/RECIPE_SPEC.md` | the shape and quality bar every recipe must meet |
| `build/validate.js` | structural + completeness checks on chapter files |
| `build/art.js` | the hand-drawn SVG dish illustrations |
| `build/scale.js` | ingredient quantity scaling (unit-tested) |
| `build/app.css`, `build/app.js` | the reader UI |
| `build/build.js` | inlines all of the above into the single HTML file |

To add a recipe, edit the relevant `data/*.json`, run `validate.js` until it passes, then
run `build.js`.

## A note on the photos

Each recipe carries a drawn illustration rather than a photograph, and a **See real
photos** button that opens an image search for that exact dish. That was a deliberate
call: embedding photographs would have meant either hotlinking image URLs that can rot and
leave broken pictures on her phone, or bloating the file far past what is comfortable to
send. The illustrations always render, the file stays sendable, and the button gets her
real photos of the finished plate whenever she wants them.
