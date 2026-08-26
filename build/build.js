#!/usr/bin/env node
'use strict';
/* Assembles every data/*.json chapter + the art library + app shell into ONE
   self-contained HTML file.

   IMPORTANT: the whole book is rendered as real HTML at build time and navigated
   with :target CSS. iOS opens .html attachments in Quick Look, which renders HTML
   and CSS but does NOT run JavaScript — a JS-rendered book is a dead cover page on
   an iPhone. JavaScript here is strictly an enhancement (search, favourites,
   shopping list, scaling, timers, cook mode). */

const fs = require('fs');
const path = require('path');
const { sharedDefs, dishBody, styleFor } = require('./art.js');

const ROOT = path.resolve(__dirname, '..');

// node build/build.js [--data <dir>] [--out <file>]
function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : dflt;
}
const DATA = arg('data', path.join(ROOT, 'data'));
const OUT = arg('out', path.join(ROOT, 'Kaelies-Recipe-Book.html'));

const ORDER = [
  'steaks-and-beef', 'seafood', 'mexican', 'italian', 'pasta',
  'sandwiches-and-burgers', 'chicken-and-poultry', 'pork-lamb-and-bbq',
  'chef-signature', 'asian-favorites', 'soups-stews-and-chili',
  'sides-and-salads', 'breakfast-and-brunch', 'sauces-and-basics', 'desserts',
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = s => String(s).toLowerCase().replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

/* ---------- art sprite ---------- */
const symbolsNeeded = new Map();          // symbolId -> {key, variant}
for (const r of recipes) {
  const st = styleFor(r.art, r.id);
  r._st = st;
  if (!symbolsNeeded.has(st.symbol)) symbolsNeeded.set(st.symbol, st);
}
const sprite =
  `<svg class="sprite" aria-hidden="true" focusable="false"><defs>${sharedDefs()}</defs>` +
  [...symbolsNeeded.entries()].map(([id, st]) =>
    `<symbol id="${id}" viewBox="0 0 400 260">${dishBody(st.key, st.variant)}</symbol>`).join('') +
  `</svg>`;

/* the per-recipe picture: shared drawing + its own palette and tilt */
function artSvg(r) {
  const st = r._st;
  // both href and xlink:href: older WebKit only understands the xlink form, and a
  // <use> that fails to resolve means the picture silently disappears.
  return `<svg class="dishArt" viewBox="0 0 400 260" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" xmlns:xlink="http://www.w3.org/1999/xlink">` +
    `<rect width="400" height="260" fill="url(#${st.bg})"/>` +
    `<circle cx="${40 + st.tilt * 46}" cy="${34 + st.tilt * 14}" r="86" fill="#fff" opacity=".22"/>` +
    `<circle cx="${368 - st.tilt * 26}" cy="${24 + st.tilt * 20}" r="52" fill="#fff" opacity=".16"/>` +
    `<g transform="translate(${st.nudge},0) rotate(${st.spin} 200 150)">` +
    `<use href="#${st.symbol}" xlink:href="#${st.symbol}"/></g>` +
    `</svg>`;
}

/* ---------- link-outs ---------- */
const videoUrl = r => 'https://www.youtube.com/results?search_query=' +
  encodeURIComponent(String(r.videoQuery).replace(/\s+recipe\s*$/i, '') + ' recipe');
const photoUrl = r => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(r.photoQuery);

/* ---------- pieces ----------
   Everything below is built from <details>/<summary>. Those are native HTML
   widgets the rendering engine toggles itself: no script, and crucially no URL
   change. iOS previews .html attachments in a reader that neither runs scripts
   NOR follows in-page #links (it hands them to a search engine instead), so the
   book must not depend on either to be readable. */

function ingHTML(r) {
  return r.ingredients.map(g => {
    const head = (r.ingredients.length > 1 || String(g.group).toLowerCase() !== 'ingredients')
      ? `<h4>${esc(g.group)}</h4>` : '';
    const items = g.items.map(it => {
      const m = String(it).match(/^(\s*)([\d¼½¾⅓⅔⅛⅜⅝⅞][\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s–-]*)/);
      const shown = m
        ? `<b class="amt">${esc(m[2].replace(/\s+$/, ''))}</b> ${esc(String(it).slice(m[0].length))}`
        : esc(it);
      return `<li><label><input type="checkbox"><span data-raw="${esc(it)}">${shown}</span></label></li>`;
    }).join('');
    return `<div class="igroup">${head}<ul class="ilist">${items}</ul></div>`;
  }).join('');
}

/* the compact row you scan, and tap to open */
function recipeSummary(r) {
  return `<summary class="recsum"><span class="row">` +
    `<span class="thumb">${artSvg(r)}</span>` +
    `<span class="rowtext">` +
    `<span class="t">${esc(r.title)}</span>` +
    `<span class="m"><span>⏱ ${esc(r.totalTime)}</span><span class="dot"></span>` +
    `<span>🍽 ${esc(r.servings)}</span></span>` +
    `<span class="diff ${esc(r.difficulty)}">${esc(r.difficulty)}</span>` +
    `</span><span class="chev" aria-hidden="true">▾</span></span></summary>`;
}

function recipeHTML(r) {
  const steps = r.instructions.map((s, i) =>
    `<li data-step="${i}"><div class="st">${esc(s.title)}</div><div class="sx">${esc(s.text)}</div></li>`
  ).join('');

  return `<details class="rec" data-id="${esc(r.id)}" data-cat="${esc(r.catSlug)}">` +
    recipeSummary(r) +
    `<div class="recbody">` +
    `<div class="hero">${artSvg(r)}</div>` +
    `<p class="rblurb">${esc(r.blurb)}</p>` +
    `<div class="rtags">${r.tags.map(t => `<span class="rtag">${esc(t)}</span>`).join('')}</div>` +

    `<div class="metagrid">` +
    `<div><div class="k">Prep</div><div class="v">${esc(r.prepTime)}</div></div>` +
    `<div><div class="k">Cook</div><div class="v">${esc(r.cookTime)}</div></div>` +
    `<div><div class="k">Total</div><div class="v">${esc(r.totalTime)}</div></div>` +
    `<div><div class="k">Serves</div><div class="v">${esc(r.servings)}</div></div>` +
    `</div>` +

    `<div class="actions">` +
    `<a class="act primary" href="${videoUrl(r)}" target="_blank" rel="noopener"><span class="i">▶️</span> Watch it made</a>` +
    `<a class="act" href="${photoUrl(r)}" target="_blank" rel="noopener"><span class="i">📷</span> See real photos</a>` +
    `<button class="act jsonly" data-favbtn="${esc(r.id)}"><span class="i">🤍</span> Save</button>` +
    `<button class="act jsonly" data-cook><span class="i">👩‍🍳</span> Cook mode</button>` +
    `</div>` +

    `<div class="section"><h3><span class="n">1</span> Ingredients</h3>` +
    `<p class="hint">Tap each one as you gather it.</p>` +
    `<div class="scaler jsonly"><span class="lab">Batch</span><div class="grp">` +
    [[0.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×']].map(s =>
      `<button data-scale="${s[0]}"${s[0] === 1 ? ' class="on"' : ''}>${s[1]}</button>`).join('') +
    `</div></div>` + ingHTML(r) +
    `<div class="actions jsonly" style="grid-template-columns:1fr;margin-top:14px">` +
    `<button class="act" data-addlist="${esc(r.id)}"><span class="i">🧺</span> Add to shopping list</button></div>` +
    `</div>` +

    `<div class="section"><h3><span class="n">2</span> How to make it</h3>` +
    `<p class="hint">Tap a step when it is done.</p>` +
    `<div class="progwrap jsonly"><div class="progbar"><i data-prog></i></div>` +
    `<div class="progtxt"><span data-progtxt></span>` +
    `<button data-resetsteps style="border:0;background:none;color:var(--accent);font-weight:700;font-size:12px;padding:0">Reset</button></div></div>` +
    `<ol class="steps">${steps}</ol></div>` +

    (r.keyTemp ? `<div class="callout temp"><div class="ct">Know when it is done</div><div class="cb">${esc(r.keyTemp)}</div></div>` : '') +
    (r.pairing ? `<div class="callout pair"><div class="ct">Serve it with</div><div class="cb">${esc(r.pairing)}</div></div>` : '') +

    (r.tips.length ? `<div class="section"><h3><span class="n">3</span> Chef tips</h3><ul class="tips">` +
      r.tips.map(t => `<li><span class="tb">◆</span><span>${esc(t)}</span></li>`).join('') + `</ul></div>` : '') +

    `<div class="actions" style="margin-top:24px">` +
    `<a class="act primary" href="${videoUrl(r)}" target="_blank" rel="noopener"><span class="i">▶️</span> Watch a video</a>` +
    `<a class="act" href="${photoUrl(r)}" target="_blank" rel="noopener"><span class="i">📷</span> Photos</a></div>` +
    `</div></details>`;
}

function chapterHTML(c) {
  const list = recipes.filter(r => r.catSlug === c.slug);
  return `<details class="chap" data-cat="${esc(c.slug)}">` +
    `<summary class="chapsum"><span class="row"><span class="ce">${c.emoji}</span>` +
    `<span class="cx"><span class="cn">${esc(c.name)}</span>` +
    `<span class="cc">${list.length} recipes</span></span>` +
    `<span class="chev" aria-hidden="true">▾</span></span></summary>` +
    `<div class="chapbody"><p class="sub">${esc(c.blurb)}</p>` +
    list.map(recipeHTML).join('') + `</div></details>`;
}

function foot() {
  return `<div class="foot"><div class="hr"></div>Made for Kaelie, by Chris. 🤍</div>`;
}

/* ---------- assemble ---------- */
const appCss = fs.readFileSync(path.join(__dirname, 'app.css'), 'utf8');
const scaleJs = fs.readFileSync(path.join(__dirname, 'scale.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const COUNT = recipes.length;

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#b8452f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kaelies recipe book">
<meta name="description" content="Kaelies recipe book sent from your amazing boyfriend Chris Jensen — ${COUNT} recipes with ingredients, cook times, step-by-step instructions and video links.">
<title>Kaelies recipe book</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8D%B3%3C/text%3E%3C/svg%3E">
<script>
/* Marks the document as scripted before first paint, so the JS-only controls and
   the overlay cover never flash for a reader whose browser runs no JavaScript
   (iOS Quick Look). Everything below degrades to plain HTML + CSS without it. */
(function(){var d=document.documentElement;d.className+=' js';
try{var t=localStorage.getItem('krb:theme');if(t)d.setAttribute('data-theme',JSON.parse(t));
else if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)d.setAttribute('data-theme','dark');}catch(e){}
if(!location.hash)d.className+=' nohash';})();
</script>
<style>
${appCss}
</style>
</head>
<body>
${sprite}

<main id="app">

<div class="topbar jsonly">
  <div class="topbar-row">
    <span class="brand">Kaelies <b>recipe book</b></span>
    <button class="iconbtn" id="themeBtn" aria-label="Switch between light and dark">🌙</button>
  </div>
  <div class="search">
    <span class="mag">🔍</span>
    <input id="q" type="search" placeholder="Search ${COUNT} recipes…" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search recipes">
    <button class="clr" aria-label="Clear search">✕</button>
  </div>
</div>

<section id="cover">
  <span class="cover-deco" style="left:9%;top:15%">🍅</span>
  <span class="cover-deco" style="right:11%;top:11%;animation-delay:-2s">🧄</span>
  <span class="cover-deco" style="left:15%;bottom:16%;animation-delay:-3.5s">🌿</span>
  <span class="cover-deco" style="right:13%;bottom:19%;animation-delay:-1.2s">🍋</span>
  <div class="cover-inner">
    <div class="cover-orn">Recipe Book</div>
    <h1 id="coverTitle">Kaelies recipe book</h1>
    <div class="cover-rule"><span>🤍</span></div>
    <p id="coverFrom">sent from your amazing boyfriend <b>Chris Jensen</b></p>
    <div class="cover-count">${COUNT} recipes &nbsp;·&nbsp; ${categories.length} chapters &nbsp;·&nbsp; every one worth making</div>
    <button id="openBtn" class="jsonly" type="button">Open the book</button>
    <div class="scrollhint nojsonly">Scroll down to start<br><span class="arrow">↓</span></div>
  </div>
</section>

<div id="book">
  <p class="booklead">Tap a chapter, then tap a recipe to open it.</p>
${categories.map(chapterHTML).join('\n')}
  ${foot()}
</div>

</main>

<div id="panel" class="jsonly" hidden>
  <div class="panelhead">
    <span class="panelttl"></span>
    <button class="iconbtn" data-closepanel aria-label="Close">✕</button>
  </div>
  <div class="panelbody"></div>
</div>

<nav class="tabbar jsonly">
  <button type="button" data-tab="book"><span class="ti">📖</span>Book</button>
  <button type="button" data-tab="search"><span class="ti">🔍</span>Search</button>
  <button type="button" data-tab="fav"><span class="ti">❤️</span>Favorites<span class="badge hidden">0</span></button>
  <button type="button" data-tab="list"><span class="ti">🧺</span>List<span class="badge hidden">0</span></button>
</nav>

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
console.log(`  ${symbolsNeeded.size} art symbols (shared by ${COUNT} pictures x2 placements)`);
console.log(`  ${kb} KB single file`);
categories.forEach(c => console.log(`   ${String(c.count).padStart(3)}  ${c.name}`));
