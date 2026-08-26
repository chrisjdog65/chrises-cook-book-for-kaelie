#!/usr/bin/env node
/* Unit tests for ingredient scaling. Run: node build/scale.test.js */
const { scaleText } = require('./scale.js');
const strip = h => h.replace(/<[^>]+>/g, '');

const cases = [
  // [input, multiplier, expected plain text]
  ['1 lb (450 g) ground beef', 2, '2 lb (900 g) ground beef'],
  ['1 lb (450 g) ground beef', 0.5, '½ lb (225 g) ground beef'],
  ['2 boneless ribeye steaks (14 oz / 400 g each, 1½ in thick)', 2,
   '4 boneless ribeye steaks (14 oz / 400 g each, 1½ in thick)'],
  ['2 (1½-inch thick) bone-in pork chops', 2, '4 (1½-inch thick) bone-in pork chops'],
  ['1½ cups (360 ml) heavy cream', 2, '3 cups (720 ml) heavy cream'],
  ['½ tsp kosher salt', 2, '1 tsp kosher salt'],
  ['¼ cup olive oil', 3, '¾ cup olive oil'],
  ['3 garlic cloves, minced', 2, '6 garlic cloves, minced'],
  ['2 to 3 tbsp unsalted butter', 2, '4–6 tbsp unsalted butter'],
  ['2-3 sprigs fresh thyme', 2, '4–6 sprigs fresh thyme'],
  ['1 1/2 cups all-purpose flour', 2, '3 cups all-purpose flour'],
  ['Kosher salt and freshly ground black pepper, to taste', 2,
   'Kosher salt and freshly ground black pepper, to taste'],
  ['8 oz (225 g) spaghetti', 2, '16 oz (450 g) spaghetti'],
  ['1 cup (240 ml) whole milk', 1, '1 cup (240 ml) whole milk'],
  ['4 large eggs', 0.5, '2 large eggs'],
  ['1 tsp vanilla extract', 0.5, '½ tsp vanilla extract'],
  ['12 oz (340 g) pasta', 3, '36 oz (1020 g) pasta'],
  ['1 whole chicken (3½ to 4 lb / 1.6 to 1.8 kg)', 2,
   '2 whole chicken (3½ to 4 lb / 1.6 to 1.8 kg)'],
  // container sizes are per-item and must never scale — "2 cans (56 oz)" would
  // read as two 56-oz cans and quadruple the ingredient
  ['1 can (28 oz / 800 g) crushed tomatoes', 2, '2 can (28 oz / 800 g) crushed tomatoes'],
  ['1 jar (16 oz / 450 g) marinara', 3, '3 jar (16 oz / 450 g) marinara'],
  ['1 stick (113 g) unsalted butter', 2, '2 stick (113 g) unsalted butter'],
  ['1 package (16 oz / 450 g) spaghetti', 0.5, '½ package (16 oz / 450 g) spaghetti'],
  ['1 bottle (750 ml) dry white wine', 2, '2 bottle (750 ml) dry white wine'],
  // ...but a plain unit restatement still scales
  ['1 cup (240 ml) whole milk', 2, '2 cups (480 ml) whole milk'.replace('cups','cup')],
  // container AFTER the parenthetical — same per-can rule
  ['1 (14.5 oz / 411 g) can diced tomatoes', 2, '2 (14.5 oz / 411 g) can diced tomatoes'],
  ['1 (28 oz / 794 g) can whole peeled tomatoes', 3, '3 (28 oz / 794 g) can whole peeled tomatoes'],
  // MULTIPLE containers restate the TOTAL, which must scale with them
  ['2 sticks (8 oz / 225 g) unsalted butter, softened', 2, '4 sticks (16 oz / 450 g) unsalted butter, softened'],
  ['2 cans (13.5 oz / 400 ml each) coconut milk', 2, '4 cans (13.5 oz / 400 ml each) coconut milk'],
  // fractions inside a restatement scale as whole tokens, never digit-by-digit
  ['400 g (about 3 1/4 cups) bread flour', 0.5, '200 g (about 1 ⅝ cups) bread flour'],
  ['15 g (2 1/2 tsp) fine sea salt', 2, '30 g (5 tsp) fine sea salt'],
  ['325 g (1 1/3 cups plus 1 tbsp / 325 ml) lukewarm water', 2,
   '650 g (2 ⅔ cups plus 2 tbsp / 650 ml) lukewarm water'],
  // volume-only restatements scale too (tsp/tbsp/cups are measures)
  ['9 g (1 1/2 tsp) fine sea salt', 2, '18 g (3 tsp) fine sea salt'],
  // ½ × ⅓ cup is ⅙ cup — not ⅛
  ['1/3 cup (80 ml) fresh lime juice', 0.5, '⅙ cup (40 ml) fresh lime juice'],
  // range upper bound may be a mixed number
  ['1 to 1 1/2 cups chicken stock', 2, '2–3 cups chicken stock'],
  ['1–1½ tsp red pepper flakes', 2, '2–3 tsp red pepper flakes'],
];

let pass = 0, fail = 0;
for (const [input, m, want] of cases) {
  const got = strip(scaleText(input, m));
  if (got === want) { pass++; }
  else {
    fail++;
    console.log(`FAIL  ×${m}\n  in:   ${input}\n  want: ${want}\n  got:  ${got}`);
  }
}

// the highlight wrapper must never break out of its own tag
const h = scaleText('1 lb <script>alert(1)</script> beef', 2);
if (/<script/.test(h)) { fail++; console.log('FAIL  html escaping leaked a <script> tag'); } else pass++;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
