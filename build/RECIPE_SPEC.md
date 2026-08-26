# Recipe JSON Spec — Kaelie's Recipe Book

Every writer agent produces ONE file: `data/<slug>.json`.
It must be valid JSON, UTF-8, and match this shape EXACTLY.

```json
{
  "category": "Steaks & Beef",
  "categoryEmoji": "🥩",
  "categoryBlurb": "One warm sentence about this section.",
  "recipes": [ { ...recipe object... } ]
}
```

## Recipe object — every field is REQUIRED

| field | type | rules |
|---|---|---|
| `id` | string | kebab-case, unique, ascii only, e.g. `reverse-seared-ribeye` |
| `title` | string | Real dish name, 3–8 words. No "Recipe" in the title. |
| `emoji` | string | ONE food emoji |
| `art` | string | MUST be one of the art keys listed below |
| `blurb` | string | 1–2 sentences. Why this dish is worth making. Warm, not salesy. |
| `difficulty` | string | exactly `Easy`, `Medium`, or `Advanced` |
| `servings` | string | e.g. `4 servings`, `2 servings`, `Makes 12` |
| `prepTime` | string | e.g. `20 min` |
| `cookTime` | string | e.g. `1 hr 10 min` |
| `totalTime` | string | must equal prep + cook (+ rest/chill if any) |
| `ingredients` | array | 1–4 groups. See below. |
| `instructions` | array | **8–14 steps.** See below. |
| `tips` | array | 3–5 strings. Real chef tips, technique or make-ahead. |
| `keyTemp` | string | Doneness/food-safety line. Give °F **and** °C. If no temp applies, describe the visual/texture cue instead. |
| `pairing` | string | What to serve/drink with it. One sentence. |
| `videoQuery` | string | 4–8 plain words a person would type into YouTube to watch this dish being made. No punctuation. |
| `photoQuery` | string | 3–6 plain words for an image search of the finished dish. No punctuation. |
| `tags` | array | 2–4 short strings, e.g. `["Date Night","Cast Iron","30 Minutes"]` |

### `ingredients` format
```json
[
  { "group": "For the steak",
    "items": ["2 bone-in ribeye steaks (about 16 oz / 450 g each, 1½ in thick)",
              "1 tbsp kosher salt", "2 tsp coarsely ground black pepper"] },
  { "group": "Garlic herb butter",
    "items": ["4 tbsp (55 g) unsalted butter, softened", "3 garlic cloves, minced"] }
]
```
- If the recipe needs no grouping, use one group with `"group": "Ingredients"`.
- **EVERY item must carry a real measurement.** Never write "salt to taste" alone —
  write "1 tsp kosher salt, plus more to taste".
- Give US volume/weight first, metric in parentheses, e.g. `1 cup (240 ml) heavy cream`,
  `1 lb (450 g) ground beef`.

### `instructions` format
```json
[
  { "title": "Dry brine the steaks",
    "text": "Pat the steaks bone dry with paper towels — moisture is the enemy of a good crust. Season all over with the kosher salt, set on a rack over a sheet pan, and refrigerate uncovered for at least 45 minutes or up to 24 hours. The salt pulls moisture out, then the meat reabsorbs it seasoned." }
]
```
- `title`: 2–5 words, imperative.
- `text`: **2–5 full sentences.** Explain the *how* AND the *why* — pan temperature,
  what it should look/sound/smell like, common mistakes. Written for someone who is
  not a confident cook yet. This is the heart of the book — be genuinely detailed.
- Include real numbers everywhere: heat level, minutes per side, pan size, oven temp
  in °F and °C, internal temps in °F and °C.

## Allowed `art` keys — pick the closest match
```
steak roast burger sandwich wrap taco burrito nachos pizza pasta lasagna risotto
noodles stirfry dumpling rice curry soup stew chili salad veggie potato bread egg
pancake chicken wings pork ribs lamb fish salmon shrimp lobster crab scallop sauce
cake cookie pie icecream chocolate drink cheese
```
Use `stirfry` for anything cooked in a wok and served loose (beef and broccoli,
kung pao, mongolian beef); `noodles` when noodles are the point; `rice` for a
rice bowl.

## Quality bar — read this twice
- These are **real, tested, classic recipes** a person can actually cook tonight.
  Correct ratios, correct times, correct temperatures. No invented fusion nonsense.
- **Food safety is non-negotiable**: chicken 165°F/74°C, ground beef 160°F/71°C,
  pork 145°F/63°C + 3 min rest, fish 145°F/63°C, steak pull-temps stated as pull-temps.
- No two recipes in your file may share a title or an `id`.
- Vary difficulty across the file: roughly 5 Easy, 8 Medium, 3 Advanced.
- Vary total time: include several 30-minutes-or-under and a couple of weekend projects.
- Write warmly and clearly. The reader is a real person cooking in a home kitchen.

## Before you finish — you MUST validate
Run this and make sure it prints OK, then fix anything it reports:
```bash
node /home/user/chrises-cook-book-for-kaelie/build/validate.js data/<yourfile>.json
```

Then return ONLY this one line as your final message:
`WROTE <path> <recipeCount>`
