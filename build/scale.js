/* Ingredient quantity scaling — kept separate so it can be unit-tested. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SCALE = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var UNI = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875, '⅙': 1 / 6, '⅚': 5 / 6 };
  // sorted by value; sixths matter because ½ × ⅓ cup is ⅙ cup, not ⅛
  var FRACS = [[0, ''], [.125, '⅛'], [1 / 6, '⅙'], [.25, '¼'], [1 / 3, '⅓'], [.375, '⅜'], [.5, '½'], [.625, '⅝'], [2 / 3, '⅔'], [.75, '¾'], [5 / 6, '⅚'], [.875, '⅞']];
  var FR = '½¼¾⅓⅔⅛⅜⅝⅞⅙⅚';

  function toNum(tok) {
    tok = String(tok).trim();
    if (UNI[tok] != null) return UNI[tok];
    var m = tok.match(new RegExp('^(\\d+)\\s*([' + FR + '])$'));
    if (m) return parseInt(m[1], 10) + UNI[m[2]];
    m = tok.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
    m = tok.match(/^(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    var n = parseFloat(tok);
    return isNaN(n) ? null : n;
  }

  function fmtNum(n) {
    if (n == null || !isFinite(n)) return '';
    if (n === 0) return '0';
    if (n >= 10) return String(Math.round(n * 10) / 10);
    var whole = Math.floor(n + 1e-9), frac = n - whole, best = FRACS[0], bd = Infinity;
    for (var i = 0; i < FRACS.length; i++) {
      var d = Math.abs(frac - FRACS[i][0]);
      if (d < bd) { bd = d; best = FRACS[i]; }
    }
    if (Math.abs(frac - 1) < bd) return String(whole + 1);
    if (bd > 0.03) return String(Math.round(n * 100) / 100);
    if (!best[1]) return String(whole);
    return (whole ? whole + ' ' : '') + best[1];
  }

  // one amount token: mixed number, unicode-fraction (optionally after an int),
  // plain fraction, or decimal — matched WHOLE so "1 2/3" never scales digit-by-digit
  var NUMTOK = '\\d+\\s+\\d+\\/\\d+|\\d+\\s*[' + FR + ']|\\d+\\/\\d+|[' + FR + ']|\\d+(?:\\.\\d+)?';
  var QTY = new RegExp('^(\\s*)(' + NUMTOK + ')(\\s*(?:–|—|-|to)\\s*(' + NUMTOK + '))?');
  var NUMG = new RegExp(NUMTOK, 'g');

  // units that mark a parenthetical as a genuine restatement of the amount
  var MEASURE = /\b(g|kg|ml|l|oz|lb|lbs|grams?|kilograms?|milliliters?|li[tv]ers?|ounces?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|qt|qts|quarts?|pints?|gallons?)\b|fl\.?\s*oz/i;
  var DIMEN = /\b(in|inch|inches|cm|mm|degrees?)\b|°/i;
  var PERITEM = /\b(each|per|apiece)\b/i;
  // words that mean the count is counting CONTAINERS
  var CONTAINER = /^(cans?|jars?|packages?|pkgs?|packets?|bottles?|bags?|boxe?s?|blocks?|sticks?|bunche?s?|heads?|ears?|links?|sheets?|tubes?|tubs?|cartons?|loa(?:f|ves))\.?$/i;

  function highlight(escaped) {
    return escaped.replace(new RegExp('^(\\s*)([\\d' + FR + '][\\d' + FR + '.\\/\\s–-]*)'), function (a, sp, q) {
      return sp + '<b class="amt">' + q.replace(/\s+$/, '') + '</b> ';
    });
  }

  // scale every amount inside a restatement, token-wise: "1 1/3 cups plus 1 tbsp / 325 ml"
  // halves to "⅔ cup-ish numbers", never digit-by-digit garbage
  function scaleInner(inner, m) {
    return inner.replace(NUMG, function (tok) {
      var n = toNum(tok);
      if (n == null) return tok;
      var v = n * m;
      if (/^\d+(\.\d+)?$/.test(tok.trim())) {           // plain number stays numeric
        return String(v >= 100 ? Math.round(v / 5) * 5 : Math.round(v * 10) / 10);
      }
      return fmtNum(v);                                  // fraction-styled stays fractional
    });
  }

  /* Scaling free text is only safe under narrow rules:
     - the leading quantity always scales;
     - a parenthetical scales when it restates the amount ("1 lb (450 g) beef",
       "15 g (2½ tsp) salt") — including for MULTIPLE containers, where recipes
       state the total ("2 sticks (8 oz / 225 g) butter");
     - it must NOT scale when it is the size of ONE container ("1 can (28 oz)",
       "1 (14.5 oz) can"), per-item ("2 steaks (14 oz each)"), or a dimension
       ("1½-inch thick"). Getting this wrong prints amounts that contradict each
       other, which is worse than not scaling at all. */
  function scaleText(text, m) {
    var s = String(text);
    if (m === 1) return highlight(esc(s));

    var mm = s.match(QTY);
    if (!mm) return highlight(esc(s));
    var na = toNum(mm[2]);
    if (na == null) return highlight(esc(s));

    var lead = (mm[1] || '') + fmtNum(na * m);
    if (mm[3] && mm[4] != null) {
      var nb = toNum(mm[4]);
      if (nb != null) lead += '–' + fmtNum(nb * m);
    }
    var rest = s.slice(mm[0].length);

    var pm = rest.match(/^(\s*[a-zA-Z]+\.?)?(\s*)\(([^)]*)\)/);
    if (pm) {
      var unitWord = (pm[1] || '').trim();
      var inner = pm[3];
      var afterStr = rest.slice(pm[0].length);
      var afterWord = (afterStr.match(/^\s*([a-zA-Z]+)/) || [])[1] || '';
      var isContainer = CONTAINER.test(unitWord) || CONTAINER.test(afterWord);

      var doScale;
      if (PERITEM.test(inner) || DIMEN.test(inner)) doScale = false;
      else if (isContainer) doScale = na > 1;   // "2 sticks (8 oz)" is a total; "1 can (28 oz)" is the can's size
      else doScale = MEASURE.test(inner);

      if (doScale) {
        rest = (pm[1] || '') + pm[2] + '(' + scaleInner(inner, m) + ')' + afterStr;
      }
    }

    return highlight(esc(lead + rest));
  }

  return { scaleText: scaleText, fmtNum: fmtNum, toNum: toNum, esc: esc };
});
