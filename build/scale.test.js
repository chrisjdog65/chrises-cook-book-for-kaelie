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
