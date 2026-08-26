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

  var UNI = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
  var FRACS = [[0, ''], [.125, '⅛'], [.25, '¼'], [1 / 3, '⅓'], [.375, '⅜'], [.5, '½'], [.625, '⅝'], [2 / 3, '⅔'], [.75, '¾'], [.875, '⅞']];

  function toNum(tok) {
    tok = String(tok).trim();
    if (UNI[tok] != null) return UNI[tok];
    var m = tok.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/);
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
    if (bd > 0.045) return String(Math.round(n * 100) / 100);
    if (!best[1]) return String(whole);
    return (whole ? whole + ' ' : '') + best[1];
  }

  var QTY = /^(\s*)(\d+\s+\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)(\s*(?:–|—|-|to)\s*(\d+(?:\.\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞]))?/;
  var MASS = /\b(g|kg|ml|l|oz|lb|lbs|grams?|kilograms?|milliliters?|li[tv]ers?|ounces?|pounds?)\b/i;
  var DIMEN = /\b(in|inch|inches|cm|mm|degrees?)\b|°/i;
  var PERITEM = /\b(each|per|apiece)\b/i;

  function highlight(escaped) {
    return escaped.replace(/^(\s*)([\d¼½¾⅓⅔⅛⅜⅝⅞][\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s–-]*)/, function (a, sp, q) {
      return sp + '<b class="amt">' + q.replace(/\s+$/, '') + '</b> ';
    });
  }

  /* Scaling free text is only safe under narrow rules:
     - the leading quantity always scales;
     - a parenthetical scales ONLY when it directly restates that quantity
       ("1 lb (450 g) beef"), never when it is per-item ("2 steaks (14 oz each)")
       or a dimension ("2 steaks (1½-inch thick)"). Getting this wrong prints two
       amounts that contradict each other, which is worse than not scaling at all. */
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

    rest = rest.replace(/^(\s*[a-zA-Z]+\.?)?(\s*)\(([^)]*)\)/, function (all, unit, sp, inner) {
      if (PERITEM.test(inner) || DIMEN.test(inner) || !MASS.test(inner)) return all;
      var scaled = inner.replace(/(\d+(?:\.\d+)?)/g, function (n) {
        var v = parseFloat(n) * m;
        return String(v >= 100 ? Math.round(v / 5) * 5 : Math.round(v * 10) / 10);
      });
      return (unit || '') + sp + '(' + scaled + ')';
    });

    return highlight(esc(lead + rest));
  }

  return { scaleText: scaleText, fmtNum: fmtNum, toNum: toNum, esc: esc };
});
