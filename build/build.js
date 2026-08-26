#!/usr/bin/env node
'use strict';
/* Assembles every data/*.json chapter + the art library + app shell
   into ONE self-contained HTML file that works offline on a phone. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'Kaelies-Recipe-Book.html');

/* chapter order in the finished book */
const ORDER = [
  'steaks-and-beef', 'seafood', 'mexican', 'italian', 'pasta',
  'sandwiches-and-burgers', 'chicken-and-poultry', 'pork-lamb-and-bbq',
  'chef-signature', 'asian-favorites', 'soups-stews-and-chili',
  'sides-and-salads', 'breakfast-and-brunch', 'sauces-and-basics', 'desserts',
];

function slugify(s) {
  return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- load chapters ---------- */
const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json'));
if (!files.length) { console.error('No chapter files in data/ — nothing to build.'); process.exit(1); }

const bySlug = {};
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); }
  catch (e) { console.error(`SKIPPING ${f}: invalid JSON — ${e.message}`); continue; }
  if (!doc || !Array.isArray(doc.recipes) || !doc.recipes.length) { console.error(`SKIPPING ${f}: no recipes`); continue; }
  bySlug[slug] = doc;
}

const slugs = ORDER.filter(s => bySlug[s]).concat(Object.keys(bySlug).filter(s => !ORDER.includes(s)).sort());

const categories = [];
const recipes = [];
const seenId = new Set();
let dropped = 0;

for (const slug of slugs) {
  const doc = bySlug[slug];
  const catSlug = slugify(doc.category || slug);
  let n = 0;
  for (const r of doc.recipes) {
    if (!r || !r.id || !r.title || !Array.isArray(r.instructions) || !Array.isArray(r.ingredients)) { dropped++; continue; }
    let id = slugify(r.id);
    if (seenId.has(id)) { let i = 2; while (seenId.has(id + '-' + i)) i++; id = id + '-' + i; }
    seenId.add(id);
    recipes.push({
      id,
      title: r.title, emoji: r.emoji || doc.categoryEmoji || '🍽', art: r.art || 'default',
      blurb: r.blurb || '', difficulty: r.difficulty || 'Medium', servings: r.servings || '4 servings',
      prepTime: r.prepTime || '—', cookTime: r.cookTime || '—', totalTime: r.totalTime || '—',
      ingredients: r.ingredients, instructions: r.instructions,
      tips: Array.isArray(r.tips) ? r.tips : [],
      keyTemp: r.keyTemp || '', pairing: r.pairing || '',
      videoQuery: r.videoQuery || r.title, photoQuery: r.photoQuery || r.title,
      tags: Array.isArray(r.tags) ? r.tags : [],
      cat: doc.category, catSlug, catEmoji: doc.categoryEmoji || '🍽',
    });
    n++;
  }
  categories.push({
    slug: catSlug, name: doc.category, emoji: doc.categoryEmoji || '🍽',
    blurb: doc.categoryBlurb || '', count: n,
  });
}

if (dropped) console.log(`(dropped ${dropped} malformed recipe entries)`);

/* ---------- inline the art library ---------- */
let artSrc = fs.readFileSync(path.join(__dirname, 'art.js'), 'utf8');
artSrc = artSrc.replace(/^\s*module\.exports\s*=.*$/m, '');
artSrc = `(function(){\n${artSrc}\nwindow.ART = { art: art, ART_KEYS: Object.keys(D) };\n})();`;

const appCss = fs.readFileSync(path.join(__dirname, 'app.css'), 'utf8');
const scaleJs = fs.readFileSync(path.join(__dirname, 'scale.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

/* JSON inside <script> must never be able to close the tag early */
const dataJson = JSON.stringify({ recipes, categories })
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const COUNT = recipes.length;

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#b8452f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Kaelies recipe book">
<meta name="description" content="Kaelies recipe book sent from your amazing boyfriend Chris Jensen — ${COUNT} recipes with ingredients, cook times, step-by-step instructions and video links.">
<title>Kaelies recipe book</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8D%B3%3C/text%3E%3C/svg%3E">
<style>
${appCss}
</style>
</head>
<body>

<!-- ============ COVER ============ -->
<div id="cover">
  <span class="cover-deco" style="left:9%;top:15%">🍅</span>
  <span class="cover-deco" style="right:11%;top:11%;animation-delay:-2s">🧄</span>
  <span class="cover-deco" style="left:15%;bottom:16%;animation-delay:-3.5s">🌿</span>
  <span class="cover-deco" style="right:13%;bottom:19%;animation-delay:-1.2s">🍋</span>
  <span class="cover-deco" style="left:47%;bottom:8%;animation-delay:-4.6s">🥄</span>
  <div class="cover-inner">
    <div class="cover-orn">Recipe Book</div>
    <h1 id="coverTitle">Kaelies recipe book</h1>
    <div class="cover-rule"><span>🤍</span></div>
    <p id="coverFrom">sent from your amazing boyfriend <b>Chris Jensen</b></p>
    <div class="cover-count">${COUNT} recipes &nbsp;·&nbsp; ${categories.length} chapters &nbsp;·&nbsp; every one worth making</div>
    <button id="openBtn">Open the book</button>
  </div>
</div>

<!-- ============ APP ============ -->
<div id="app">
  <div class="topbar">
    <div class="topbar-row">
      <div class="brand">Kaelies <b>recipe book</b></div>
      <button class="iconbtn" id="themeBtn" aria-label="Switch between light and dark">🌙</button>
    </div>
    <div class="search hidden">
      <span class="mag">🔍</span>
      <input id="q" type="search" placeholder="Search 200+ recipes…" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search recipes">
      <button class="clr" aria-label="Clear search">✕</button>
    </div>
  </div>
  <main id="main"></main>
</div>

<nav class="tabbar">
  <button data-tab="home"><span class="ti">📖</span>Book</button>
  <button data-tab="search"><span class="ti">🔍</span>Search</button>
  <button data-tab="fav"><span class="ti">❤️</span>Favorites<span class="badge hidden">0</span></button>
  <button data-tab="list"><span class="ti">🧺</span>List<span class="badge hidden">0</span></button>
</nav>

<script id="bookdata" type="application/json">${dataJson}</script>
<script>window.BOOK = JSON.parse(document.getElementById('bookdata').textContent);</script>
<script>
${artSrc}
</script>
<script>
${scaleJs}
</script>
<script>
${appJs}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`\nBuilt ${path.relative(ROOT, OUT)}`);
console.log(`  ${COUNT} recipes across ${categories.length} chapters`);
console.log(`  ${kb} KB single file`);
categories.forEach(c => console.log(`   ${String(c.count).padStart(3)}  ${c.name}`));
