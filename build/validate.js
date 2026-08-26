#!/usr/bin/env node
// Validates one category JSON file against the recipe spec.
// Usage: node build/validate.js data/steaks-and-beef.json
const fs = require('fs');
const path = require('path');

const ART = new Set(('steak roast burger sandwich wrap taco burrito nachos pizza pasta lasagna risotto ' +
  'noodles stirfry dumpling rice curry soup stew chili salad veggie potato bread egg pancake ' +
  'chicken wings pork ribs lamb fish salmon shrimp lobster crab scallop sauce cake ' +
  'cookie pie icecream chocolate drink cheese').split(/\s+/));

const DIFF = new Set(['Easy', 'Medium', 'Advanced']);
const REQ = ['id', 'title', 'emoji', 'art', 'blurb', 'difficulty', 'servings', 'prepTime',
  'cookTime', 'totalTime', 'ingredients', 'instructions', 'tips', 'keyTemp',
  'pairing', 'videoQuery', 'photoQuery', 'tags'];

function validateFile(file) {
  const errs = [];
  const warns = [];
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { errs: ['cannot read file: ' + e.message], warns, count: 0 }; }

  let doc;
  try { doc = JSON.parse(raw); }
  catch (e) { return { errs: ['INVALID JSON: ' + e.message], warns, count: 0 }; }

  for (const k of ['category', 'categoryEmoji', 'categoryBlurb', 'recipes']) {
    if (!doc[k]) errs.push(`top-level "${k}" missing`);
  }
  if (!Array.isArray(doc.recipes)) return { errs: errs.concat('"recipes" must be an array'), warns, count: 0 };

  const ids = new Set(), titles = new Set();

  doc.recipes.forEach((r, i) => {
    const at = `recipes[${i}] (${r && r.title ? r.title : 'untitled'})`;
    if (!r || typeof r !== 'object') { errs.push(`${at}: not an object`); return; }

    for (const k of REQ) {
      const v = r[k];
      const empty = v === undefined || v === null || v === '' ||
        (Array.isArray(v) && v.length === 0);
      if (empty) errs.push(`${at}: missing/empty "${k}"`);
    }
    if (r.id) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) errs.push(`${at}: id "${r.id}" is not kebab-case ascii`);
      if (ids.has(r.id)) errs.push(`${at}: duplicate id "${r.id}"`);
      ids.add(r.id);
    }
    if (r.title) {
      const t = r.title.toLowerCase().trim();
      if (titles.has(t)) errs.push(`${at}: duplicate title`);
      titles.add(t);
    }
    if (r.art && !ART.has(r.art)) errs.push(`${at}: art "${r.art}" not in allowed keys`);
    if (r.difficulty && !DIFF.has(r.difficulty)) errs.push(`${at}: difficulty must be Easy|Medium|Advanced`);

    // ingredients
    if (Array.isArray(r.ingredients)) {
      if (r.ingredients.length < 1 || r.ingredients.length > 4) errs.push(`${at}: needs 1-4 ingredient groups`);
      let total = 0;
      r.ingredients.forEach((g, gi) => {
        if (!g || typeof g.group !== 'string' || !g.group.trim()) errs.push(`${at}: ingredients[${gi}].group missing`);
        if (!Array.isArray(g.items) || g.items.length === 0) { errs.push(`${at}: ingredients[${gi}].items empty`); return; }
        total += g.items.length;
        g.items.forEach((it, ii) => {
          if (typeof it !== 'string' || !it.trim()) errs.push(`${at}: ingredients[${gi}].items[${ii}] not a string`);
          else if (!/\d|pinch|handful|to taste|as needed/i.test(it)) warns.push(`${at}: ingredient has no measurement -> "${it}"`);
        });
      });
      if (total < 4) errs.push(`${at}: only ${total} ingredients total, need at least 4`);
    } else if (r.ingredients !== undefined) errs.push(`${at}: ingredients must be an array`);

    // instructions
    if (Array.isArray(r.instructions)) {
      if (r.instructions.length < 8 || r.instructions.length > 14) {
        errs.push(`${at}: has ${r.instructions.length} steps, spec requires 8-14`);
      }
      r.instructions.forEach((s, si) => {
        if (!s || typeof s.title !== 'string' || !s.title.trim()) errs.push(`${at}: instructions[${si}].title missing`);
        if (!s || typeof s.text !== 'string' || !s.text.trim()) { errs.push(`${at}: instructions[${si}].text missing`); return; }
        const sentences = s.text.split(/[.!?]+\s/).filter(x => x.trim().length > 3).length;
        if (s.text.length < 110) errs.push(`${at}: instructions[${si}] too short (${s.text.length} chars, need 2-5 real sentences)`);
        else if (sentences < 2) warns.push(`${at}: instructions[${si}] looks like one sentence`);
      });
    } else if (r.instructions !== undefined) errs.push(`${at}: instructions must be an array`);

    if (Array.isArray(r.tips) && (r.tips.length < 3 || r.tips.length > 5)) errs.push(`${at}: needs 3-5 tips, has ${r.tips.length}`);
    if (Array.isArray(r.tags) && (r.tags.length < 2 || r.tags.length > 4)) errs.push(`${at}: needs 2-4 tags, has ${r.tags.length}`);

    for (const q of ['videoQuery', 'photoQuery']) {
      if (typeof r[q] === 'string' && /[^\w\s'-]/.test(r[q])) warns.push(`${at}: ${q} has punctuation -> "${r[q]}"`);
    }
    if (typeof r.keyTemp === 'string' && /\d\s*°?\s*F/i.test(r.keyTemp) && !/°?\s*C\b/i.test(r.keyTemp)) {
      warns.push(`${at}: keyTemp gives F but not C`);
    }
  });

  return { errs, warns, count: doc.recipes.length, category: doc.category };
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: validate.js <file.json> [...]'); process.exit(2); }

let bad = 0, grand = 0;
for (const f of files) {
  const full = path.resolve(f);
  const { errs, warns, count, category } = validateFile(full);
  grand += count;
  if (errs.length) {
    bad++;
    console.log(`\n✗ ${path.basename(f)} — ${errs.length} ERROR(S), ${count} recipes`);
    errs.slice(0, 60).forEach(e => console.log('   ERROR ' + e));
    if (errs.length > 60) console.log(`   ...and ${errs.length - 60} more`);
  } else {
    console.log(`OK ${path.basename(f)} — ${count} recipes${category ? ' [' + category + ']' : ''}`);
  }
  if (warns.length) {
    console.log(`   (${warns.length} warning(s))`);
    warns.slice(0, 15).forEach(w => console.log('   warn  ' + w));
    if (warns.length > 15) console.log(`   ...and ${warns.length - 15} more warnings`);
  }
}
if (files.length > 1) console.log(`\nTOTAL: ${grand} recipes across ${files.length} files, ${bad} file(s) with errors`);
process.exit(bad ? 1 : 0);
