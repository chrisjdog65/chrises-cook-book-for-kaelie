#!/usr/bin/env node
'use strict';
/* Cross-chapter audit: things a single-chapter validator cannot see.
   Usage: node build/audit.js */
const fs = require('fs');
const path = require('path');
const DATA = path.resolve(__dirname, '..', 'data');

const chapters = fs.readdirSync(DATA).filter(f => f.endsWith('.json')).map(f => {
  try { return { file: f, doc: JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) }; }
  catch (e) { console.log(`!! ${f}: invalid JSON — ${e.message}`); return null; }
}).filter(Boolean);

const all = [];
chapters.forEach(c => (c.doc.recipes || []).forEach(r => all.push({ ...r, _file: c.file, _cat: c.doc.category })));

console.log(`\n=== ${all.length} recipes across ${chapters.length} chapters ===\n`);

/* --- duplicate / near-duplicate titles across chapters --- */
const norm = s => String(s).toLowerCase()
  .replace(/\b(with|and|the|a|an|in|on|of|classic|easy|perfect|best|homemade|style)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).sort().join(' ');

const byNorm = new Map();
all.forEach(r => {
  const k = norm(r.title);
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(r);
});
const dupes = [...byNorm.values()].filter(g => g.length > 1);
if (dupes.length) {
  console.log(`DUPLICATE TITLES (${dupes.length} group(s)):`);
  dupes.forEach(g => g.forEach(r => console.log(`   [${r._file}] ${r.title}`)) || console.log(''));
  console.log('');
} else console.log('No duplicate titles across chapters.\n');

/* --- duplicate ids across chapters (build renames these, but flag them) --- */
const idSeen = new Map();
all.forEach(r => { if (!idSeen.has(r.id)) idSeen.set(r.id, []); idSeen.get(r.id).push(r._file); });
const idDupes = [...idSeen.entries()].filter(([, f]) => f.length > 1);
if (idDupes.length) {
  console.log(`DUPLICATE IDS (build will suffix these): ${idDupes.map(([id]) => id).join(', ')}\n`);
}

/* --- difficulty spread --- */
const diff = {};
all.forEach(r => { diff[r.difficulty] = (diff[r.difficulty] || 0) + 1; });
console.log('Difficulty:', Object.entries(diff).map(([k, v]) =>
  `${k} ${v} (${Math.round(v / all.length * 100)}%)`).join('  ·  '));

/* --- time spread --- */
function mins(t) {
  const s = String(t).toLowerCase();
  let m = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/); if (h) m += parseFloat(h[1]) * 60;
  const mm = s.match(/(\d+)\s*min/); if (mm) m += parseInt(mm[1], 10);
  if (!m) { const d = s.match(/(\d+)/); if (d) m = parseInt(d[1], 10); }
  return m;
}
const quick = all.filter(r => { const m = mins(r.totalTime); return m > 0 && m <= 30; }).length;
const long = all.filter(r => mins(r.totalTime) >= 180).length;
console.log(`Time: ${quick} at 30 min or less  ·  ${long} at 3 hr or more`);

/* --- art coverage --- */
const artUse = {};
all.forEach(r => { artUse[r.art] = (artUse[r.art] || 0) + 1; });
const artKeys = Object.keys(artUse).sort((a, b) => artUse[b] - artUse[a]);
console.log(`Art keys used: ${artKeys.length}  (most common: ${artKeys.slice(0, 5).map(k => k + '×' + artUse[k]).join(', ')})`);

let unknownArt = [];
try {
  const { ART_KEYS } = require('./art.js');
  const ok = new Set(ART_KEYS);
  unknownArt = artKeys.filter(k => !ok.has(k));
} catch (e) { }
if (unknownArt.length) console.log(`!! art keys with no drawing (will fall back): ${unknownArt.join(', ')}`);

/* --- ingredients mentioned but never used in steps (spot check) --- */
let unusedTotal = 0, worst = [];
all.forEach(r => {
  const steps = (r.instructions || []).map(s => s.text).join(' ').toLowerCase();
  const unused = [];
  (r.ingredients || []).forEach(g => (g.items || []).forEach(it => {
    // take the most distinctive noun-ish word of the ingredient line
    const words = String(it).toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !/^(about|plus|more|taste|large|small|medium|fresh|freshly|finely|coarsely|chopped|minced|sliced|diced|grated|ground|divided|softened|melted|room|temperature|optional|inch|thick|pieces|halved|quartered|trimmed|peeled|drained|rinsed|packed|heaping|level|extra|virgin|kosher|table|whole|boneless|skinless)$/.test(w));
    if (words.length && !words.some(w => steps.includes(w.replace(/e?s$/, '')))) unused.push(it);
  }));
  if (unused.length) { unusedTotal += unused.length; worst.push({ t: r.title, f: r._file, n: unused.length, e: unused[0] }); }
});
worst.sort((a, b) => b.n - a.n);
console.log(`\nPossible unused ingredients: ${unusedTotal} across ${worst.length} recipes (heuristic, expect false positives)`);
worst.slice(0, 12).forEach(w => console.log(`   ${w.n}×  [${w.f}] ${w.t}  — e.g. "${w.e}"`));

console.log('');
