# Kaelie's Recipe Book

A single self-contained HTML file — **`Kaelies-Recipe-Book.html`** — holding 200+ detailed
recipes. Open it on a phone, no internet needed, no app to install. Send the file to
someone and they just open it.

## Getting the book to her

Download `Kaelies-Recipe-Book.html` and send it however you like — text it, email it as an
attachment, drop it in a shared folder. On her phone she taps it and it opens in the
browser. On iPhone she can then hit **Share → Add to Home Screen** and it behaves like an
app, with its own icon.

Everything works offline. The only things that need a connection are the two link-out
buttons on each recipe ("Watch it made" and "See real photos"), which open YouTube and an
image search for that specific dish.

## What's in it

- Illustrated card for every recipe, drawn as inline SVG so nothing can 404
- Full ingredient lists with US and metric measurements
- Prep / cook / total times and servings
- 8–14 detailed instruction steps per recipe, written to explain the *why*
- Chef tips, doneness temperatures (°F and °C), and serving suggestions
- Search across titles, ingredients and tags
- Favorites, a shopping list, and tap-to-check ingredients and steps
- Batch scaling (½× / 1× / 2× / 3×)
- Tap-to-start countdown timers pulled out of the step text
- Cook mode that keeps the screen awake
- Light and dark themes

## Rebuilding

Recipes live as JSON, one file per chapter, in `data/`. The book is assembled from them:

```bash
node build/build.js            # writes Kaelies-Recipe-Book.html
node build/validate.js data/*.json   # check every chapter against the spec
node build/scale.test.js       # unit tests for ingredient scaling
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
