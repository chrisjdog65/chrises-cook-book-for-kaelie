'use strict';
/* Hand-drawn dish illustrations, rendered as inline SVG.
   No network, no external files - these work on a plane, in a basement, forever.
   art(key, seed) -> SVG string sized to a 400x260 viewBox. */

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const R = (n, d = 1) => Number(n.toFixed(d));

/* ---------- shared primitives ---------- */

const shadow = (cx = 200, cy = 205, rx = 132, ry = 18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sh)"/>`;

const plate = (cx = 200, cy = 168, rx = 132, ry = 50, c = '#ffffff', inner = '#f2ede4') =>
  `${shadow(cx, cy + 34, R(rx * 0.94), 16)}
   <ellipse cx="${cx}" cy="${cy + 12}" rx="${rx}" ry="${ry}" fill="#d9d2c6"/>
   <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/>
   <ellipse cx="${cx}" cy="${cy + 2}" rx="${R(rx * 0.79)}" ry="${R(ry * 0.76)}" fill="${inner}"/>`;

/* bowl: returns {back, front} so food can be sandwiched between */
function bowl(cx = 200, top = 128, rx = 122, depth = 92, outer = '#ffffff', inner = '#ece5d9') {
  const back = `${shadow(cx, top + depth + 4, R(rx * 0.8), 15)}
    <path d="M${cx - rx},${top} Q${cx},${R(top + depth * 1.9)} ${cx + rx},${top} Z" fill="${outer}"/>
    <path d="M${cx - rx},${top} Q${cx},${R(top + depth * 1.9)} ${cx + rx},${top} Z" fill="url(#bowlSh)"/>
    <ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${R(rx * 0.29)}" fill="${inner}"/>`;
  const front = `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${R(rx * 0.29)}" fill="none" stroke="#ffffff" stroke-width="7" opacity=".95"/>
    <path d="M${cx - rx + 8},${top + 14} Q${cx},${R(top + depth * 1.55)} ${cx + rx - 8},${top + 14}" fill="none" stroke="#00000010" stroke-width="6"/>`;
  return { back, front };
}

const skillet = () => `${shadow(196, 208, 128, 17)}
  <rect x="300" y="128" width="96" height="17" rx="8" fill="#3b3b40"/>
  <rect x="300" y="128" width="96" height="7" rx="3.5" fill="#55555c"/>
  <ellipse cx="196" cy="150" rx="136" ry="54" fill="#33333a"/>
  <ellipse cx="196" cy="143" rx="136" ry="54" fill="#4a4a52"/>
  <ellipse cx="196" cy="145" rx="120" ry="45" fill="#2c2c33"/>
  <ellipse cx="196" cy="143" rx="120" ry="45" fill="#3a3a42"/>`;

const board = () => `${shadow(200, 206, 140, 16)}
  <path d="M60,112 h280 a14,14 0 0 1 14,14 v52 a14,14 0 0 1 -14,14 h-280 a14,14 0 0 1 -14,-14 v-52 a14,14 0 0 1 14,-14 z" fill="#b98551"/>
  <path d="M60,112 h280 a14,14 0 0 1 14,14 v10 h-308 v-10 a14,14 0 0 1 14,-14 z" fill="#c9975f"/>
  <g stroke="#a8763f" stroke-width="2" opacity=".55">
    <path d="M62,132 h276"/><path d="M62,152 h276"/><path d="M62,172 h276"/></g>`;

const steam = (x, y, r) => {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const dx = x + (i - 1) * 34, o = R(0.5 - i * 0.08, 2), w = R(16 + r() * 8);
    s += `<path d="M${dx},${y} c-${w},-16 ${w},-28 0,-46 c-${R(w * 0.7)},-14 ${R(w * 0.7)},-22 0,-34"
            fill="none" stroke="#ffffff" stroke-opacity="${o}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return s;
};

const herb = (x, y, s = 1, c = '#3f8b4a') =>
  `<g transform="translate(${x},${y}) scale(${s})" fill="${c}">
     <path d="M0,0 C-2,-16 -2,-30 0,-40 C2,-30 2,-16 0,0 z"/>
     <ellipse cx="-8" cy="-12" rx="8" ry="4.5" transform="rotate(-28 -8 -12)"/>
     <ellipse cx="8" cy="-19" rx="8" ry="4.5" transform="rotate(28 8 -19)"/>
     <ellipse cx="-8" cy="-26" rx="7" ry="4" transform="rotate(-28 -8 -26)"/>
     <ellipse cx="7" cy="-33" rx="6.5" ry="3.8" transform="rotate(28 7 -33)"/>
   </g>`;

const lemon = (x, y, s = 1) =>
  `<g transform="translate(${x},${y}) scale(${s})">
     <circle r="19" fill="#f7d13a"/><circle r="15" fill="#fdf0a8"/>
     <g stroke="#f2c02a" stroke-width="2">
       <path d="M0,0 L0,-14"/><path d="M0,0 L13,-6"/><path d="M0,0 L9,11"/>
       <path d="M0,0 L-9,11"/><path d="M0,0 L-13,-6"/></g>
   </g>`;

const scatter = (r, n, x0, y0, w, h, colors, rad = 3) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${R(x0 + r() * w)}" cy="${R(y0 + r() * h)}" r="${R(rad * (0.6 + r() * 0.8))}"
           fill="${colors[Math.floor(r() * colors.length)]}" opacity="${R(0.65 + r() * 0.35, 2)}"/>`;
  }
  return s;
};

const grillMarks = (x, y, w, h, angle = -14, n = 4, c = '#2a1408') => {
  let s = `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})" opacity=".55">`;
  for (let i = 0; i < n; i++) {
    s += `<rect x="${R(x + 6 + i * (w - 12) / n)}" y="${y}" width="7" height="${h}" rx="3.5" fill="${c}"/>`;
  }
  return s + '</g>';
};

/* ---------- the dishes ---------- */

const D = {};

/* Steak is by far the most repeated drawing in the book (a whole chapter of it),
   so it gets three genuinely different plates rather than one image ten times. */
D.steak = (r, v) => {
  if (v === 1) {                                  // sliced and fanned on a board
    let slices = '';
    for (let i = 0; i < 6; i++) {
      const x = 128 + i * 28, a = -14 + i * 5;
      slices += `<g transform="translate(${x},150) rotate(${a})">
        <rect x="-16" y="-38" width="32" height="76" rx="12" fill="#4f2610"/>
        <rect x="-13" y="-35" width="26" height="70" rx="10" fill="#8f4420"/>
        <ellipse cx="0" cy="0" rx="9" ry="26" fill="#c4506a"/>
        <ellipse cx="0" cy="-1" rx="5.5" ry="20" fill="#dd8390"/>
        <rect x="-13" y="-35" width="26" height="8" rx="4" fill="#6b3417"/>
      </g>`;
    }
    return `${board()}${slices}
      ${herb(316, 128, 0.7)}
      ${scatter(r, 12, 100, 186, 200, 12, ['#f0e3c0', '#3f8b4a'], 2.2)}`;
  }
  if (v === 2) {                                  // plated with a sauce swoosh
    return `${plate(200, 172, 134, 48)}
      <path d="M92,168 C120,140 180,132 232,142 C268,149 292,164 300,176 C262,186 120,186 92,168 z" fill="#5c2412" opacity=".55"/>
      <g transform="translate(0,-10)">
        <path d="M112,152 C112,122 150,108 198,108 C250,108 288,122 288,152 C288,178 250,190 198,190 C150,190 112,178 112,152 z" fill="#5a2c13"/>
        <path d="M118,148 C118,120 154,108 198,108 C246,108 282,120 282,148 C282,172 246,182 198,182 C154,182 118,172 118,148 z" fill="#8a441c"/>
        ${grillMarks(132, 116, 132, 58, -10, 3)}
        <path d="M156,144 C164,130 180,126 198,126 C220,126 238,132 244,146 C236,158 220,162 198,162 C176,162 162,156 156,144 z" fill="#c4506a" opacity=".85"/>
        <rect x="184" y="94" width="34" height="15" rx="6" fill="#fbe9a8"/>
        <rect x="184" y="94" width="34" height="6" rx="3" fill="#fdf4cf"/>
      </g>
      ${herb(300, 150, 0.75)}
      ${scatter(r, 10, 130, 176, 150, 14, ['#f0e3c0', '#2f1b0c'], 2.4)}`;
  }
  return `${skillet()}                             <!-- whole steak in the pan -->
  <g transform="translate(0,-4)">
    <path d="M96,150 C96,116 140,100 196,100 C258,100 300,116 300,150 C300,180 256,194 196,194 C140,194 96,180 96,150 z" fill="#5a2c13"/>
    <path d="M100,146 C100,114 142,98 196,98 C256,98 296,114 296,146 C296,174 254,188 196,188 C142,188 100,174 100,146 z" fill="#7d3d18"/>
    <path d="M112,140 C112,116 148,104 196,104 C246,104 284,116 284,140 C284,162 246,174 196,174 C148,174 112,162 112,140 z" fill="#94491d"/>
    ${grillMarks(120, 108, 156, 62)}
    <path d="M150,138 C158,124 176,120 196,120 C220,120 240,126 246,140 C238,152 220,156 196,156 C172,156 156,150 150,138 z" fill="#c4506a" opacity=".85"/>
    <path d="M160,136 C168,126 180,124 196,124 C214,124 230,128 236,138 C228,146 214,150 196,150 C176,150 164,144 160,136 z" fill="#d96f80" opacity=".8"/>
    <path d="M170,96 C186,90 214,90 232,96 C224,102 186,102 170,96 z" fill="#efe6cf"/>
    <rect x="182" y="86" width="34" height="14" rx="6" fill="#fbe9a8"/>
    <rect x="182" y="86" width="34" height="6" rx="3" fill="#fdf4cf"/>
  </g>
  ${herb(268, 120, 0.85)}
  ${scatter(r, 9, 120, 168, 160, 18, ['#f0e3c0', '#e3d3a8'], 2)}`;
};

D.roast = (r, v) => {
  if (v === 1) {                                   // in the roasting pan with vegetables
    let veg = '';
    const cols = ['#e0682c', '#4f9c43', '#e8b73f', '#b8412f'];
    for (let i = 0; i < 14; i++) {
      const x = 78 + r() * 244, y = 158 + r() * 30, s = 0.6 + r() * 0.5, a = r() * 360;
      veg += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)}) scale(${R(s, 2)})">
        <rect x="-15" y="-9" width="30" height="18" rx="8" fill="${cols[Math.floor(r() * cols.length)]}"/></g>`;
    }
    return `${shadow(200, 206, 142, 15)}
      <rect x="40" y="112" width="26" height="16" rx="7" fill="#7d8087"/>
      <rect x="334" y="112" width="26" height="16" rx="7" fill="#7d8087"/>
      <rect x="56" y="106" width="288" height="94" rx="14" fill="#8d9098"/>
      <rect x="62" y="112" width="276" height="82" rx="10" fill="#63666e"/>
      <rect x="62" y="112" width="276" height="82" rx="10" fill="url(#panSh)"/>
      <path d="M108,158 C108,124 144,108 196,108 C250,108 288,124 288,156 C288,178 250,188 196,188 C144,188 108,180 108,158 z" fill="#6b3417"/>
      <path d="M114,153 C114,122 148,108 196,108 C246,108 282,122 282,152 C282,172 246,181 196,181 C148,181 114,173 114,153 z" fill="#8c4620"/>
      ${grillMarks(126, 116, 140, 58, -8, 3, '#4a2210')}
      ${veg}
      ${herb(300, 130, 0.6)}`;
  }
  if (v === 2) {                                   // carved and fanned on a platter
    let sl = '';
    for (let i = 0; i < 7; i++) {
      const x = 118 + i * 27, a = -12 + i * 4;
      sl += `<g transform="translate(${x},148) rotate(${a})">
        <ellipse cx="0" cy="0" rx="20" ry="38" fill="#5c2c12"/>
        <ellipse cx="0" cy="0" rx="17" ry="34" fill="#9c5028"/>
        <ellipse cx="0" cy="0" rx="10" ry="24" fill="#c4707a"/>
      </g>`;
    }
    return `${plate(200, 172, 136, 48)}
      <path d="M96,166 C126,142 180,136 236,146 C272,152 296,164 302,174 C264,184 122,184 96,166 z" fill="#5c3418" opacity=".5"/>
      ${sl}
      ${herb(316, 140, 0.62)}
      ${scatter(r, 10, 120, 182, 160, 12, ['#f0e3c0'], 2.2)}`;
  }
  return `${board()}
  <path d="M92,158 C92,120 132,100 190,100 C250,100 296,118 296,156 C296,180 250,192 190,192 C132,192 92,182 92,158 z" fill="#6b3417"/>
  <path d="M98,152 C98,118 136,100 190,100 C246,100 290,116 290,150 C290,172 246,184 190,184 C136,184 98,174 98,152 z" fill="#8c4620"/>
  ${grillMarks(112, 108, 150, 66, -8, 3, '#4a2210')}
  <g>
    <path d="M232,104 C258,104 276,116 276,138 C276,158 258,168 232,168 C242,150 242,122 232,104 z" fill="#c96f78"/>
    <path d="M252,110 C272,112 286,122 286,140 C286,156 272,166 252,168 C260,152 260,126 252,110 z" fill="#d98a90"/>
    <path d="M270,116 C288,120 298,128 298,142 C298,154 288,162 270,166 C277,152 277,130 270,116 z" fill="#e6a3a6"/>
  </g>
  ${herb(120, 116, 0.8)}
  ${scatter(r, 14, 100, 100, 190, 80, ['#2f1b0c', '#efe3c4'], 2)}`;
};

D.burger = r => `${board()}
  <g transform="translate(0,-6)">
    <path d="M108,116 C108,72 292,72 292,116 C292,124 108,124 108,116 z" fill="#d9973f"/>
    <path d="M112,112 C112,76 288,76 288,112 z" fill="#e8ad55"/>
    ${scatter(r, 16, 130, 82, 140, 24, ['#fdf3d6'], 2.2)}
    <path d="M104,120 h192 a8,8 0 0 1 0,16 h-192 a8,8 0 0 1 0,-16 z" fill="#f3e2a8"/>
    <path d="M100,134 C118,128 130,142 152,134 C176,126 190,144 214,136 C238,128 254,142 300,134 L300,146 C254,156 236,146 214,152 C190,158 176,144 152,150 C130,156 116,146 100,148 z" fill="#f2b53c"/>
    <path d="M102,150 h196 a10,10 0 0 1 0,20 h-196 a10,10 0 0 1 0,-20 z" fill="#5c3018"/>
    <path d="M106,152 h188 a8,8 0 0 1 0,14 h-188 a8,8 0 0 1 0,-14 z" fill="#77401f"/>
    <path d="M106,170 C126,166 138,176 162,172 C186,168 200,178 224,174 C248,170 268,178 296,172 L296,180 C268,186 248,178 224,182 C200,186 186,176 162,180 C138,184 126,174 106,178 z" fill="#57a04a"/>
    <ellipse cx="150" cy="184" rx="24" ry="8" fill="#d8463b"/><ellipse cx="248" cy="184" rx="24" ry="8" fill="#d8463b"/>
    <path d="M104,182 C104,204 296,204 296,182 C296,178 104,178 104,182 z" fill="#d9973f"/>
    <path d="M108,184 C112,198 288,198 292,184 z" fill="#e8ad55"/>
  </g>`;

D.sandwich = (r, v) => {
  if (v === 1) {                                   // a sub roll, split and loaded
    return `${board()}
      <g transform="translate(0,-2) rotate(-3 200 150)">
        <path d="M60,152 h280 a25,25 0 0 1 0,42 h-280 a25,25 0 0 1 0,-42 z" fill="#c9903f"/>
        <path d="M64,154 h272 a19,19 0 0 1 0,32 h-272 a19,19 0 0 1 0,-32 z" fill="#f0d5a0"/>
        <path d="M64,154 q34,-16 68,0 q34,-16 68,0 q34,-16 68,0 q30,-14 68,2 v10 h-272 z" fill="#5fa84c"/>
        <path d="M76,146 q28,-12 54,2 q28,-12 54,2 q28,-12 54,2 q26,-10 52,2 l-4,10 q-26,-10 -52,-2 q-26,8 -54,-2 q-28,-10 -54,-2 q-26,8 -54,-2 z" fill="#c8574c"/>
        <path d="M84,140 q30,-10 58,2 q30,-10 58,2 q30,-10 58,2 l-2,9 q-28,-9 -56,1 q-28,10 -58,-2 q-30,-10 -58,-1 z" fill="#f2c84c"/>
        <path d="M60,128 a140,32 0 0 1 280,0 z" fill="#d9a05a"/>
        <path d="M66,130 a134,26 0 0 1 268,0 z" fill="#eec27a"/>
        ${scatter(r, 16, 92, 112, 216, 16, ['#fdf3d6'], 2.2)}
      </g>`;
  }
  if (v === 2) {                                   // a tall deli stack, held with a pick
    var y = 176, L = '';
    var layers = [
      ['#e6b96e', 16], ['#c8574c', 11], ['#f2c84c', 9], ['#fbf0d2', 13],
      ['#a8442f', 11], ['#5fa84c', 9], ['#f2c84c', 9], ['#e6b96e', 18],
    ];
    for (var i = 0; i < layers.length; i++) {
      var w = 178 - Math.abs(i - 3.5) * 5;
      L += `<rect x="${200 - w / 2}" y="${y - layers[i][1]}" width="${w}" height="${layers[i][1]}" rx="5" fill="${layers[i][0]}"/>`;
      y -= layers[i][1] + 1;
    }
    return `${plate(200, 186, 128, 38)}
      <g transform="rotate(-2 200 140)">${L}</g>
      <g transform="rotate(6 208 96)">
        <rect x="204" y="34" width="7" height="120" rx="3.5" fill="#c9975f"/>
        <circle cx="207" cy="32" r="10" fill="#4f9c43"/>
      </g>
      ${scatter(r, 10, 130, 190, 140, 10, ['#f0e3c0'], 2.2)}`;
  }
  return `${board()}
  <g transform="translate(-6,4)">
    <g transform="rotate(-8 170 150)">
      <path d="M96,178 L170,88 L244,178 z" fill="#e6b96e"/>
      <path d="M104,172 L170,96 L236,172 z" fill="#f6dfae"/>
      <path d="M112,164 L170,104 L228,164 z" fill="#fbf0d2"/>
      <path d="M118,158 C140,150 200,150 222,158 L216,166 C196,158 144,158 124,166 z" fill="#5fa84c"/>
      <path d="M124,148 C146,140 194,140 216,148 L210,156 C190,148 150,148 130,156 z" fill="#f2c84c"/>
      <path d="M130,138 C150,132 190,132 210,138 L204,146 C186,140 154,140 136,146 z" fill="#c8574c"/>
      <path d="M136,128 C154,124 186,124 204,128 L198,136 C182,130 158,130 142,136 z" fill="#e08f6a"/>
    </g>
    <g transform="rotate(6 268 158)">
      <path d="M212,192 L268,116 L324,192 z" fill="#e6b96e"/>
      <path d="M218,186 L268,122 L318,186 z" fill="#f6dfae"/>
      <path d="M226,176 C244,168 292,168 310,176 L304,184 C288,176 248,176 232,184 z" fill="#5fa84c"/>
      <path d="M232,164 C250,158 286,158 304,164 L298,172 C282,166 254,166 238,172 z" fill="#c8574c"/>
    </g>
  </g>`;
};

D.wrap = r => `${board()}
  <g transform="translate(0,-2)">
    <g transform="rotate(-16 150 150)">
      <path d="M110,102 h80 a22,22 0 0 1 0,96 h-80 z" fill="#efd9a8"/>
      <path d="M110,102 h80 a22,22 0 0 1 0,96 h-80 z" fill="url(#wrapSh)"/>
      <ellipse cx="110" cy="150" rx="16" ry="48" fill="#f8ecc9"/>
      <ellipse cx="110" cy="150" rx="11" ry="40" fill="#e4b04f"/>
      <path d="M100,132 q12,6 20,0" stroke="#57a04a" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M100,158 q12,-6 20,0" stroke="#c8574c" stroke-width="7" fill="none" stroke-linecap="round"/>
      ${scatter(r, 10, 100, 126, 20, 50, ['#f0f0e0', '#8ab86f'], 2.4)}
    </g>
    <g transform="rotate(12 272 158)">
      <path d="M232,112 h70 a20,20 0 0 1 0,86 h-70 z" fill="#e9cf99"/>
      <ellipse cx="232" cy="155" rx="14" ry="43" fill="#f8ecc9"/>
      <ellipse cx="232" cy="155" rx="9" ry="35" fill="#d99a45"/>
    </g>
  </g>`;

D.taco = r => `${plate()}
  <g transform="translate(0,-8)">
    ${[[126, 8], [200, 0], [274, 8]].map(([x, dy], i) => `
      <g transform="translate(${x},${100 + dy})">
        <path d="M-52,44 A52,52 0 0 1 52,44 L44,52 A44,44 0 0 0 -44,52 z" fill="#e0a63c"/>
        <path d="M-46,46 A46,46 0 0 1 46,46 L42,50 A42,42 0 0 0 -42,50 z" fill="#f0be55"/>
        <path d="M-44,50 A44,44 0 0 1 44,50 L44,64 A44,20 0 0 1 -44,64 z" fill="#f4cd72"/>
        <ellipse cx="0" cy="50" rx="42" ry="12" fill="#7b3f1c"/>
        ${scatter(r, 12, -38, 40, 76, 16, ['#8b4a22', '#5f2f14', '#a35a29'], 4)}
        <path d="M-40,44 q20,-8 40,0 q20,8 38,-2" stroke="#5fa84c" stroke-width="8" fill="none" stroke-linecap="round"/>
        ${scatter(r, 8, -34, 34, 70, 10, ['#f6f2df', '#e8e3c8'], 3)}
        ${scatter(r, 6, -30, 36, 62, 10, ['#d8463b'], 2.6)}
      </g>`).join('')}
  </g>
  ${lemon(322, 176, 0.7)}`;

D.burrito = r => `${plate()}
  <g transform="rotate(-24 200 150)">
    <path d="M108,124 h184 a30,30 0 0 1 0,58 h-184 a30,30 0 0 1 0,-58 z" fill="#eddaad"/>
    <path d="M108,124 h184 a30,30 0 0 1 0,58 h-184 a30,30 0 0 1 0,-58 z" fill="url(#wrapSh)"/>
    <path d="M120,124 q10,29 0,58" stroke="#d9c295" stroke-width="4" fill="none"/>
    <path d="M158,124 q-8,29 0,58" stroke="#d9c295" stroke-width="4" fill="none"/>
    <ellipse cx="292" cy="153" rx="18" ry="29" fill="#f7ead0"/>
    <ellipse cx="292" cy="153" rx="12" ry="22" fill="#8d4a22"/>
    ${scatter(r, 9, 282, 136, 20, 34, ['#5fa84c', '#f2c84c', '#f6f2df'], 3)}
    <path d="M108,124 l-14,10 l0,38 l14,10 z" fill="#e3cd9f"/>
  </g>
  ${scatter(r, 12, 120, 190, 170, 14, ['#5fa84c', '#d8463b'], 2.6)}`;

D.nachos = r => {
  let chips = '';
  for (let i = 0; i < 16; i++) {
    const x = 100 + r() * 200, y = 108 + r() * 62, s = 0.75 + r() * 0.45, a = -50 + r() * 100;
    chips += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)}) scale(${R(s, 2)})">
      <path d="M-26,16 L0,-22 L26,16 z" fill="#e9b64b"/><path d="M-20,12 L0,-14 L20,12 z" fill="#f5cd6c"/></g>`;
  }
  return `${plate()}
  ${chips}
  <path d="M112,116 C150,104 178,132 210,118 C244,104 268,134 300,120 C312,146 286,168 250,172 C210,178 150,172 122,156 C106,146 104,128 112,116 z" fill="#f0a92e" opacity=".92"/>
  <path d="M126,124 C158,116 180,138 210,126 C240,114 262,138 288,128 C296,146 272,158 244,162 C208,166 154,160 132,148 z" fill="#f8c455" opacity=".95"/>
  ${scatter(r, 22, 116, 116, 176, 56, ['#d8463b', '#5fa84c', '#3a3a3a', '#f6f2df'], 4)}
  <ellipse cx="200" cy="146" rx="26" ry="13" fill="#f7f5ee"/>
  <ellipse cx="200" cy="143" rx="22" ry="10" fill="#ffffff"/>`;
};

D.pizza = r => `${board()}
  <g transform="translate(0,-4)">
    <circle cx="188" cy="146" r="86" fill="#dda548"/>
    <circle cx="188" cy="146" r="76" fill="#eebd63"/>
    <circle cx="188" cy="146" r="68" fill="#cf4b34"/>
    <circle cx="188" cy="146" r="64" fill="#e0573c"/>
    <path d="M188,146 m-64,0 a64,64 0 1 1 128,0 a64,64 0 1 1 -128,0" fill="#f6e2b0" opacity=".55"/>
    ${scatter(r, 13, 132, 92, 112, 108, ['#b83b2c', '#a8332a'], 9)}
    ${scatter(r, 13, 136, 96, 104, 100, ['#c8483a'], 6)}
    ${scatter(r, 10, 136, 98, 104, 96, ['#3f8b4a'], 4)}
    <g transform="rotate(24 300 176)">
      <path d="M300,116 L356,196 L266,204 z" fill="#dda548"/>
      <path d="M300,124 L346,190 L276,196 z" fill="#e0573c"/>
      ${scatter(r, 4, 284, 140, 50, 44, ['#b83b2c'], 7)}
    </g>
  </g>`;

/* A pasta chapter is almost entirely this one key, so it carries three sauces
   and two vessels rather than repeating a single red bowl seven times. */
const SAUCES = [
  { a: '#c33f2c', b: '#d84f36', fl: ['#f7f4e8', '#3f8b4a'] },   // tomato
  { a: '#e0d2ad', b: '#f4ecd8', fl: ['#3a3a3a', '#fffdf4'] },   // cream / carbonara
  { a: '#4a8434', b: '#5fa142', fl: ['#f7f4e8', '#e8d36a'] },   // pesto
];
D.pasta = (r, v) => {
  const s = SAUCES[v % SAUCES.length];
  if (v === 2) {                                   // twirled nest on a shallow plate
    let rings = '';
    for (let i = 0; i < 5; i++) {
      rings += `<ellipse cx="200" cy="${150 - i * 3}" rx="${74 - i * 13}" ry="${40 - i * 7}"
        fill="none" stroke="${i % 2 ? '#f2ce74' : '#e8bd5c'}" stroke-width="9"/>`;
    }
    return `${plate(200, 170, 132, 48)}
      <ellipse cx="200" cy="154" rx="80" ry="44" fill="#d9a94e"/>
      ${rings}
      <ellipse cx="200" cy="140" rx="36" ry="17" fill="${s.a}"/>
      <ellipse cx="200" cy="138" rx="30" ry="13" fill="${s.b}"/>
      ${scatter(r, 9, 168, 128, 66, 22, s.fl, 3)}
      ${herb(200, 128, 0.5)}`;
  }
  const b = bowl(200, 126, 124, 90);
  let strands = '';
  for (let i = 0; i < 16; i++) {
    const cx = 118 + r() * 164, cy = 118 + r() * 24, w = 20 + r() * 40;
    strands += `<path d="M${R(cx - w)},${R(cy)} q${R(w)},${R(-14 - r() * 12)} ${R(w * 2)},0"
      fill="none" stroke="${r() > .5 ? '#f2ce74' : '#e8bd5c'}" stroke-width="7" stroke-linecap="round"/>`;
  }
  return `${b.back}
    <clipPath id="cpP"><ellipse cx="200" cy="126" rx="120" ry="35"/></clipPath>
    <g clip-path="url(#cpP)">
      <ellipse cx="200" cy="134" rx="118" ry="40" fill="#efc86b"/>
      ${strands}
      <ellipse cx="200" cy="122" rx="72" ry="24" fill="${s.a}"/>
      <ellipse cx="200" cy="119" rx="64" ry="20" fill="${s.b}"/>
      ${scatter(r, 10, 148, 108, 104, 24, s.fl, 3.2)}
    </g>
    ${b.front}
    ${herb(200, 112, 0.55)}
    ${scatter(r, 6, 150, 100, 100, 12, ['#f7f4e8'], 2.4)}`;
};

D.lasagna = r => `${plate()}
  <g transform="translate(0,-4)">
    <path d="M110,176 L128,96 L292,96 L274,176 z" fill="#e8a94b"/>
    ${[1, 2].map(i => `
      <path d="M${112 + i * 2},${168 - i * 24} L${130 + i * 2},${88 - i * 24} L${290 - i * 2},${88 - i * 24} L${272 - i * 2},${168 - i * 24} z" fill="${i % 2 ? '#f3d78f' : '#c8442f'}"/>`).join('')}
    <path d="M112,150 L130,70 L290,70 L272,150 z" fill="#c8442f"/>
    <path d="M112,136 L130,56 L290,56 L272,136 z" fill="#f3d78f"/>
    <path d="M112,124 L130,44 L290,44 L272,124 z" fill="#b93b2a"/>
    <path d="M112,112 L130,32 L290,32 L272,112 z" fill="#f6e6ae"/>
    <path d="M112,112 L130,32 L290,32 L272,112 z" fill="url(#cheeseSh)"/>
    <path d="M110,176 L128,96 L136,96 L118,176 z" fill="#00000018"/>
    ${scatter(r, 8, 140, 44, 130, 56, ['#3f8b4a'], 3)}
  </g>
  ${herb(310, 168, 0.7)}`;

D.risotto = r => {
  const b = bowl(200, 130, 132, 66, '#fff', '#efe8da');
  return `${b.back}
  <clipPath id="cpR"><ellipse cx="200" cy="130" rx="128" ry="37"/></clipPath>
  <g clip-path="url(#cpR)">
    <ellipse cx="200" cy="136" rx="112" ry="32" fill="#f0e2b8"/>
    <ellipse cx="200" cy="132" rx="104" ry="28" fill="#f7ecc9"/>
    ${scatter(r, 60, 100, 116, 200, 34, ['#efe0b0', '#fdf6dd', '#e6d49a'], 4)}
    ${scatter(r, 10, 140, 118, 120, 26, ['#8c6b3a'], 5)}
  </g>
  ${b.front}
  ${herb(200, 122, 0.5)}
  ${scatter(r, 8, 150, 112, 100, 16, ['#f7f4e8'], 2.6)}`;
};

D.noodles = r => {
  const b = bowl(196, 124, 126, 94, '#c9433a', '#f3ece0');
  let n = '';
  for (let i = 0; i < 14; i++) {
    const cx = 112 + r() * 168, cy = 116 + r() * 22, w = 22 + r() * 34;
    n += `<path d="M${R(cx - w)},${R(cy)} q${R(w)},${R(-16 - r() * 10)} ${R(w * 2)},0" fill="none" stroke="#eccb78" stroke-width="7" stroke-linecap="round"/>`;
  }
  return `${b.back}
  <clipPath id="cpN"><ellipse cx="196" cy="124" rx="122" ry="35"/></clipPath>
  <g clip-path="url(#cpN)">
    <ellipse cx="196" cy="132" rx="120" ry="38" fill="#8f5a2a"/>
    ${n}
    ${scatter(r, 12, 130, 110, 130, 26, ['#5fa84c', '#d8463b', '#f7f4e8'], 4)}
  </g>
  ${b.front}
  <g transform="rotate(-32 250 90)">
    <rect x="238" y="42" width="7" height="120" rx="3" fill="#7a4a24"/>
    <rect x="254" y="42" width="7" height="120" rx="3" fill="#8d5a2c"/>
  </g>
  ${steam(196, 96, r)}`;
};

/* A whole chapter of wok cooking had nowhere sensible to point — beef and broccoli
   was landing on the steak drawing — so stir-fries get their own wok. */
D.stirfry = r => {
  const cols = ['#8f4a22', '#a8572a', '#6b3417', '#3f8b4a', '#5aa347', '#d8463b', '#e8873a', '#f2c84c'];
  let bits = '';
  for (let i = 0; i < 28; i++) {
    const x = 104 + r() * 176, y = 122 + r() * 40, s = 0.68 + r() * 0.6, a = r() * 360;
    bits += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)}) scale(${R(s, 2)})">
      <rect x="-15" y="-9" width="30" height="18" rx="8" fill="${cols[Math.floor(r() * cols.length)]}"/>
      <rect x="-11" y="-6" width="22" height="6" rx="3" fill="#ffffff" opacity=".24"/></g>`;
  }
  return `${shadow(190, 208, 128, 16)}
    <g transform="rotate(-22 318 142)">
      <rect x="312" y="134" width="98" height="16" rx="8" fill="#5c4632"/>
      <rect x="312" y="134" width="98" height="6" rx="3" fill="#7d5f44"/>
    </g>
    <ellipse cx="190" cy="158" rx="142" ry="57" fill="#26262c"/>
    <ellipse cx="190" cy="149" rx="142" ry="57" fill="#3d3d46"/>
    <ellipse cx="190" cy="151" rx="124" ry="47" fill="#1e1e25"/>
    <ellipse cx="190" cy="148" rx="124" ry="47" fill="#2f2f38"/>
    ${bits}
    <ellipse cx="146" cy="130" rx="42" ry="12" fill="#ffffff" opacity=".09"/>
    ${steam(190, 102, r)}`;
};

D.dumpling = r => `${plate(200, 168, 132, 50, '#fff', '#efe9dd')}
  ${[[132, 158, 1], [200, 148, 1.12], [268, 158, 1]].map(([x, y, s]) => `
    <g transform="translate(${x},${y}) scale(${s})">
      <path d="M-44,10 C-44,-16 -22,-30 0,-30 C22,-30 44,-16 44,10 C24,20 -24,20 -44,10 z" fill="#f3ead4"/>
      <path d="M-40,8 C-40,-14 -20,-26 0,-26 C20,-26 40,-14 40,8 C22,17 -22,17 -40,8 z" fill="#fbf6e6"/>
      <path d="M-40,-4 q10,-12 13,0 q10,-12 13,0 q10,-12 14,0 q10,-12 13,0" fill="none" stroke="#ddd0ac" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="0" cy="12" rx="42" ry="8" fill="#e0d3ae"/>
      <path d="M-30,14 q30,10 60,0" fill="none" stroke="#c9a86a" stroke-width="5" stroke-linecap="round"/>
    </g>`).join('')}
  <ellipse cx="330" cy="176" rx="26" ry="11" fill="#efe9dd"/>
  <ellipse cx="330" cy="174" rx="21" ry="8" fill="#5c3418"/>
  ${scatter(r, 8, 110, 176, 180, 12, ['#5fa84c'], 2.4)}`;

D.rice = r => {
  const b = bowl(200, 126, 118, 88, '#fff', '#eee7db');
  return `${b.back}
  <clipPath id="cpRi"><ellipse cx="200" cy="126" rx="114" ry="33"/></clipPath>
  <g clip-path="url(#cpRi)">
    <ellipse cx="200" cy="118" rx="106" ry="42" fill="#f6f1e2"/>
    <ellipse cx="200" cy="112" rx="94" ry="34" fill="#fdfaf0"/>
    ${scatter(r, 90, 106, 96, 188, 40, ['#f2ecdb', '#ffffff', '#e8e0cb'], 3.4)}
  </g>
  ${b.front}
  <g transform="translate(240,86) rotate(18)">
    <rect x="0" y="0" width="6" height="86" rx="3" fill="#8d5a2c"/>
    <rect x="14" y="0" width="6" height="86" rx="3" fill="#7a4a24"/>
  </g>
  ${scatter(r, 6, 160, 104, 80, 12, ['#3f8b4a'], 2.6)}`;
};

D.curry = r => {
  const b = bowl(200, 128, 128, 90, '#fff', '#efe8da');
  return `${b.back}
  <clipPath id="cpC"><ellipse cx="200" cy="128" rx="124" ry="36"/></clipPath>
  <g clip-path="url(#cpC)">
    <ellipse cx="200" cy="136" rx="122" ry="40" fill="#c9701c"/>
    <ellipse cx="200" cy="130" rx="112" ry="34" fill="#e08a26"/>
    ${scatter(r, 16, 132, 116, 136, 28, ['#a8541a', '#8c4415', '#e5a94a'], 7)}
    <path d="M96,128 a104,34 0 0 0 78,32 a56,30 0 0 1 -6,-34 a70,26 0 0 1 -72,2 z" fill="#fdfaf0"/>
    ${scatter(r, 26, 100, 122, 74, 30, ['#f7f2e4', '#ffffff'], 3)}
    ${scatter(r, 7, 210, 118, 70, 22, ['#3f8b4a'], 4)}
  </g>
  ${b.front}
  ${steam(200, 104, r)}`;
};

D.soup = (r, v) => {
  if (v === 1) {                                   // a mug of it
    return `${shadow(200, 208, 88, 14)}
      <path d="M268,124 q46,4 46,32 q0,28 -46,30" fill="none" stroke="#e6ded0" stroke-width="15"/>
      <path d="M118,108 h154 v72 a28,28 0 0 1 -28,28 h-98 a28,28 0 0 1 -28,-28 z" fill="#e6ded0"/>
      <path d="M124,108 h142 v70 a24,24 0 0 1 -24,24 h-94 a24,24 0 0 1 -24,-24 z" fill="#fbf6ec"/>
      <ellipse cx="195" cy="108" rx="77" ry="25" fill="#e6ded0"/>
      <ellipse cx="195" cy="108" rx="68" ry="20" fill="#c0431f"/>
      <ellipse cx="195" cy="106" rx="61" ry="16" fill="#d95a30"/>
      ${scatter(r, 8, 158, 98, 74, 16, ['#f6d9a8', '#3f8b4a'], 3)}
      ${steam(195, 82, r)}`;
  }
  if (v === 2) {                                   // crock under a cheese cap
    const b2 = bowl(200, 128, 120, 84, '#c9855a', '#e8dcc8');
    return `${b2.back}
      <clipPath id="cpSo"><ellipse cx="200" cy="128" rx="116" ry="34"/></clipPath>
      <g clip-path="url(#cpSo)"><ellipse cx="200" cy="136" rx="116" ry="38" fill="#7a4418"/></g>
      ${b2.front}
      <ellipse cx="200" cy="120" rx="104" ry="32" fill="#e0a63c"/>
      <ellipse cx="200" cy="115" rx="96" ry="28" fill="#f2c559"/>
      <path d="M112,124 q22,26 44,4 q20,24 44,2 q22,26 44,2 q20,22 44,-4 q-14,30 -88,30 q-74,0 -88,-34 z" fill="#e8b23c"/>
      ${scatter(r, 10, 150, 100, 100, 22, ['#c98a2a', '#fbe6a8'], 4)}
      ${herb(200, 100, 0.5)}`;
  }
  const b = bowl(200, 124, 130, 84, '#fff', '#f0e9dc');
  return `${b.back}
  <clipPath id="cpS"><ellipse cx="200" cy="124" rx="126" ry="37"/></clipPath>
  <g clip-path="url(#cpS)">
    <ellipse cx="200" cy="128" rx="124" ry="38" fill="#d38a2a"/>
    <ellipse cx="200" cy="124" rx="116" ry="33" fill="#e6a63c"/>
    ${scatter(r, 18, 110, 112, 180, 26, ['#f2d089', '#c96d1e', '#5fa84c'], 6)}
    ${scatter(r, 12, 120, 114, 160, 22, ['#fbe6b4'], 4)}
    <ellipse cx="240" cy="120" rx="30" ry="9" fill="#f6c96a" opacity=".7"/>
  </g>
  ${b.front}
  ${steam(200, 100, r)}
  ${herb(200, 116, 0.45)}`;
};

D.stew = r => `${shadow(200, 210, 128, 16)}
  <rect x="46" y="126" width="34" height="16" rx="8" fill="#2f2f36"/>
  <rect x="320" y="126" width="34" height="16" rx="8" fill="#2f2f36"/>
  <path d="M70,118 h260 v40 a52,52 0 0 1 -52,52 h-156 a52,52 0 0 1 -52,-52 z" fill="#b8452f"/>
  <path d="M70,118 h260 v20 h-260 z" fill="#cf5138"/>
  <ellipse cx="200" cy="118" rx="130" ry="26" fill="#e0603f"/>
  <ellipse cx="200" cy="118" rx="118" ry="21" fill="#7a3a1a"/>
  <ellipse cx="200" cy="116" rx="112" ry="18" fill="#8f4720"/>
  ${scatter(r, 20, 104, 106, 192, 20, ['#a8551f', '#5c2f12', '#d99a45', '#3f8b4a'], 6)}
  ${steam(200, 92, r)}`;

D.chili = r => {
  const b = bowl(200, 126, 124, 88, '#fff', '#efe8da');
  return `${b.back}
  <clipPath id="cpCh"><ellipse cx="200" cy="126" rx="120" ry="35"/></clipPath>
  <g clip-path="url(#cpCh)">
    <ellipse cx="200" cy="132" rx="120" ry="38" fill="#8f2f1c"/>
    <ellipse cx="200" cy="126" rx="112" ry="32" fill="#a83a22"/>
    ${scatter(r, 26, 106, 112, 188, 28, ['#6b2412', '#c05a2c', '#7a4a24'], 6)}
    <path d="M150,116 q50,-16 100,0 q-50,18 -100,0 z" fill="#f4c243"/>
    ${scatter(r, 16, 148, 110, 104, 14, ['#f7d15c', '#fbe28a'], 3.4)}
    <ellipse cx="200" cy="122" rx="26" ry="10" fill="#fbfaf5"/>
  </g>
  ${b.front}
  ${scatter(r, 8, 160, 112, 80, 12, ['#3f8b4a'], 2.6)}`;
};

D.salad = r => {
  const b = bowl(200, 122, 132, 82, '#fff', '#eee8dc');
  let leaves = '';
  for (let i = 0; i < 26; i++) {
    const x = 92 + r() * 216, y = 100 + r() * 42, s = 0.6 + r() * 0.7, a = r() * 360;
    const c = ['#4f9c43', '#68b34f', '#3d8339', '#8cc45f'][Math.floor(r() * 4)];
    leaves += `<ellipse cx="${R(x)}" cy="${R(y)}" rx="${R(20 * s)}" ry="${R(11 * s)}" transform="rotate(${R(a)} ${R(x)} ${R(y)})" fill="${c}"/>`;
  }
  return `${b.back}
  <clipPath id="cpSa"><ellipse cx="200" cy="122" rx="128" ry="37"/></clipPath>
  <g clip-path="url(#cpSa)">
    ${leaves}
    ${scatter(r, 9, 120, 104, 160, 30, ['#d8463b'], 8)}
    ${scatter(r, 8, 130, 106, 140, 26, ['#f6f0dc'], 5)}
    ${scatter(r, 10, 126, 104, 150, 28, ['#e8b73f'], 3.4)}
  </g>
  ${b.front}`;
};

D.veggie = (r, variant) => {
  const cols = ['#e0682c', '#4f9c43', '#e8b73f', '#b8412f', '#7a4a9c', '#68b34f'];
  if (variant === 1) {                             // spears tied on a plate
    let spears = '';
    for (let i = 0; i < 9; i++) {
      const x = 128 + i * 18, a = R(-9 + i * 2.2);
      spears += `<g transform="translate(${x},150) rotate(${a})">
        <rect x="-6" y="-52" width="12" height="104" rx="6" fill="#3f7f34"/>
        <rect x="-4" y="-50" width="8" height="100" rx="4" fill="#5aa347"/>
        <path d="M0,-64 C-8,-58 -8,-48 0,-44 C8,-48 8,-58 0,-64 z" fill="#4a8f3a"/>
      </g>`;
    }
    return `${plate(200, 170, 132, 48)}${spears}
      <rect x="146" y="140" width="112" height="16" rx="8" fill="#c14a4a"/>
      <rect x="146" y="140" width="112" height="6" rx="3" fill="#d76a63"/>
      ${lemon(326, 160, 0.6)}
      ${scatter(r, 10, 130, 182, 150, 12, ['#f0e3c0'], 2.4)}`;
  }
  if (variant === 2) {                             // roasted vegetables heaped in a bowl
    const b = bowl(200, 126, 124, 84);
    let chunks = '';
    for (let i = 0; i < 24; i++) {
      const x = 100 + r() * 200, y = 108 + r() * 34, s = 0.7 + r() * 0.6, a = r() * 360;
      chunks += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)}) scale(${R(s, 2)})">
        <rect x="-17" y="-10" width="34" height="20" rx="9" fill="${cols[Math.floor(r() * cols.length)]}"/>
        <rect x="-13" y="-7" width="26" height="7" rx="3.5" fill="#ffffff" opacity=".26"/></g>`;
    }
    return `${b.back}
      <clipPath id="cpV"><ellipse cx="200" cy="126" rx="120" ry="35"/></clipPath>
      <g clip-path="url(#cpV)"><ellipse cx="200" cy="134" rx="118" ry="40" fill="#e3d9c6"/>${chunks}</g>
      ${b.front}${herb(200, 112, 0.5)}`;
  }
  let v = '';
  for (let i = 0; i < 22; i++) {
    const x = 86 + r() * 228, y = 118 + r() * 56, s = 0.7 + r() * 0.6, a = r() * 360;
    v += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)}) scale(${R(s, 2)})">
      <rect x="-16" y="-9" width="32" height="18" rx="8" fill="${cols[Math.floor(r() * cols.length)]}"/>
      <rect x="-12" y="-6" width="24" height="6" rx="3" fill="#ffffff" opacity=".28"/></g>`;
  }
  return `${shadow(200, 204, 140, 15)}
  <rect x="52" y="104" width="296" height="94" rx="14" fill="#8d9098"/>
  <rect x="58" y="110" width="284" height="82" rx="10" fill="#6f727a"/>
  <rect x="58" y="110" width="284" height="82" rx="10" fill="url(#panSh)"/>
  ${v}
  ${herb(322, 122, 0.6)}`;
};

D.potato = r => {
  const b = bowl(200, 128, 122, 78, '#fff', '#efe9dd');
  return `${b.back}
  <clipPath id="cpPo"><ellipse cx="200" cy="128" rx="118" ry="34"/></clipPath>
  <g clip-path="url(#cpPo)">
    <ellipse cx="200" cy="126" rx="112" ry="36" fill="#f1e4c0"/>
    <ellipse cx="200" cy="118" rx="98" ry="30" fill="#faf1d6"/>
    ${scatter(r, 30, 110, 102, 180, 34, ['#f6ecd0', '#fdf8e8'], 8)}
    <ellipse cx="200" cy="112" rx="30" ry="12" fill="#e8b73f"/>
    <rect x="186" y="100" width="28" height="12" rx="5" fill="#fbe9a8"/>
  </g>
  ${b.front}
  ${scatter(r, 8, 160, 106, 80, 12, ['#3f8b4a'], 2.4)}`;
};

D.bread = r => `${board()}
  <g transform="translate(0,-8)">
    <path d="M96,166 C96,116 128,92 186,92 C244,92 282,112 282,160 C282,180 244,190 186,190 C128,190 96,186 96,166 z" fill="#b4762f"/>
    <path d="M100,160 C100,114 130,92 186,92 C240,92 278,110 278,156 C278,174 240,184 186,184 C130,184 100,178 100,160 z" fill="#cf8f42"/>
    <path d="M112,140 C120,120 148,108 186,108 C226,108 258,120 264,140 C240,132 138,132 112,140 z" fill="#e0aa5c" opacity=".7"/>
    <g stroke="#8f5a20" stroke-width="5" stroke-linecap="round" opacity=".7">
      <path d="M132,116 l26,-16"/><path d="M172,110 l26,-16"/><path d="M212,112 l26,-16"/></g>
    <g transform="translate(292,120) rotate(10)">
      <path d="M0,0 C0,-34 14,-46 30,-46 C46,-46 58,-32 58,0 z" fill="#f3e3ba"/>
      <path d="M0,0 C0,-34 14,-46 30,-46 C46,-46 58,-32 58,0 z" fill="none" stroke="#cf8f42" stroke-width="7"/>
      <rect x="0" y="0" width="58" height="10" rx="4" fill="#cf8f42"/>
    </g>
    ${scatter(r, 12, 110, 178, 180, 14, ['#e8d3a0'], 2.4)}
  </g>`;

D.egg = (r, v) => {
  if (v === 1) {                                   // folded omelette on a plate
    return `${plate(200, 170, 132, 50)}
      <g transform="translate(0,-8)">
        <path d="M96,166 C104,124 142,104 200,104 C258,104 300,124 300,162 C300,182 258,192 200,192 C142,192 100,184 96,166 z" fill="#e0a92c"/>
        <path d="M102,162 C110,126 146,110 200,110 C254,110 294,126 294,158 C294,176 254,186 200,186 C146,186 108,178 102,162 z" fill="#f5c744"/>
        <path d="M110,150 C122,124 152,114 200,114 C246,114 278,126 286,148 C250,134 148,134 110,150 z" fill="#fbdc7c" opacity=".85"/>
        <path d="M120,168 q80,20 160,-6" stroke="#d09420" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${scatter(r, 8, 150, 140, 100, 30, ['#5fa84c'], 3)}
      </g>
      ${herb(316, 168, 0.55)}`;
  }
  if (v === 2) {                                   // poached eggs on muffin halves
    return `${plate(200, 172, 132, 48)}
      ${[[144, 150], [256, 150]].map(([x, y]) => `
        <g transform="translate(${x},${y})">
          <ellipse cx="0" cy="34" rx="52" ry="17" fill="#c98a3c"/>
          <rect x="-52" y="12" width="104" height="24" rx="8" fill="#e0a95a"/>
          <ellipse cx="0" cy="12" rx="52" ry="17" fill="#f2cf95"/>
          <ellipse cx="0" cy="6" rx="46" ry="14" fill="#e8896a"/>
          <ellipse cx="0" cy="-6" rx="42" ry="26" fill="#fdfaf1"/>
          <ellipse cx="-4" cy="-10" rx="36" ry="21" fill="#ffffff"/>
          <path d="M-40,-8 q12,16 40,14 q28,-2 40,-16 q2,16 -14,22 q-26,8 -52,0 q-16,-6 -14,-20 z" fill="#f7cf55"/>
          <circle cx="-2" cy="-10" r="14" fill="#f0aa2c"/>
          <circle cx="-7" cy="-15" r="5" fill="#ffd97a" opacity=".8"/>
        </g>`).join('')}
      ${scatter(r, 8, 150, 118, 100, 16, ['#3a3a3a', '#5fa84c'], 2.6)}`;
  }
  return `${skillet()}
  ${[[152, 138], [242, 148]].map(([x, y]) => `
    <g transform="translate(${x},${y})">
      <ellipse cx="0" cy="0" rx="62" ry="42" fill="#fdfaf1"/>
      <ellipse cx="-6" cy="-4" rx="52" ry="34" fill="#ffffff"/>
      <circle cx="2" cy="0" r="21" fill="#e8a127"/>
      <circle cx="2" cy="0" r="17" fill="#f5b93c"/>
      <circle cx="-4" cy="-6" r="6" fill="#ffd97a" opacity=".8"/>
    </g>`).join('')}
  ${scatter(r, 10, 120, 110, 160, 70, ['#3a3a3a', '#5fa84c'], 2.4)}`;
};

D.pancake = r => `${plate(200, 172, 130, 48)}
  <g transform="translate(0,-6)">
    ${[0, 1, 2, 3].map(i => `
      <g transform="translate(0,${-i * 22})">
        <ellipse cx="200" cy="${160}" rx="${86 - i * 2}" ry="${24 - i}" fill="#c98a3c"/>
        <ellipse cx="200" cy="${156}" rx="${86 - i * 2}" ry="${24 - i}" fill="#e5aa58"/>
        <ellipse cx="200" cy="${153}" rx="${72 - i * 2}" ry="${17 - i}" fill="#f0c079"/>
      </g>`).join('')}
    <path d="M128,96 C150,86 176,102 200,94 C226,86 250,102 272,92 C280,110 264,124 236,128 C204,132 156,128 134,116 C124,110 122,102 128,96 z" fill="#a8631f"/>
    <path d="M136,98 C158,90 178,104 200,96 C224,88 246,102 264,94 C270,108 256,118 232,122 C202,126 158,122 140,112 z" fill="#c4792a"/>
    <rect x="182" y="72" width="38" height="18" rx="6" fill="#f7d768"/>
    <rect x="182" y="72" width="38" height="8" rx="4" fill="#fdeeae"/>
    ${scatter(r, 9, 150, 110, 100, 20, ['#c02c3c', '#7a2f8c'], 4)}
  </g>`;

D.chicken = (r, v) => {
  if (v === 1) {                                   // crispy-skin pieces in a skillet
    return `${skillet()}
      ${[[148, 130], [246, 152]].map(([x, y]) => `
        <g transform="translate(${x},${y})">
          <path d="M-54,6 C-54,-20 -30,-36 0,-36 C34,-36 56,-20 56,6 C56,26 32,36 0,36 C-30,36 -54,26 -54,6 z" fill="#8f5a2a"/>
          <path d="M-50,3 C-50,-19 -28,-32 0,-32 C31,-32 52,-18 52,4 C52,22 30,31 0,31 C-28,31 -50,20 -50,3 z" fill="#c98a3c"/>
          <path d="M-38,-9 C-30,-21 -14,-26 2,-26 C22,-26 38,-18 44,-6 C24,-17 -14,-17 -38,-9 z" fill="#e8b264" opacity=".8"/>
          ${scatter(r, 11, -42, -20, 84, 44, ['#a86a24', '#f0cd8a'], 2.6)}
        </g>`).join('')}
      ${herb(318, 118, 0.6)}`;
  }
  if (v === 2) {                                   // fried pieces piled on a plate
    return `${plate(200, 170, 132, 50)}
      ${[[138, 156, -14], [206, 144, 9], [268, 158, 17], [172, 180, 4], [240, 182, -7]].map(([x, y, a]) => `
        <g transform="translate(${x},${y}) rotate(${a})">
          <path d="M-34,10 C-38,-14 -20,-31 4,-31 C28,-31 41,-14 39,8 C37,25 20,33 2,33 C-16,33 -32,25 -34,10 z" fill="#a8672a"/>
          <path d="M-30,8 C-33,-12 -17,-27 4,-27 C26,-27 36,-12 34,7 C32,22 18,29 2,29 C-14,29 -28,20 -30,8 z" fill="#d99a45"/>
          ${scatter(r, 8, -26, -22, 56, 46, ['#f0cd8a', '#b87c30'], 4)}
        </g>`).join('')}
      ${herb(322, 172, 0.55)}`;
  }
  return `${board()}
  <g transform="translate(0,-6)">
    <path d="M118,152 C118,110 152,84 200,84 C250,84 284,110 284,152 C284,180 250,192 200,192 C152,192 118,180 118,152 z" fill="#b4762f"/>
    <path d="M122,146 C122,108 154,84 200,84 C248,84 280,108 280,146 C280,172 248,184 200,184 C154,184 122,172 122,146 z" fill="#d99a45"/>
    <path d="M136,130 C144,106 168,94 200,94 C234,94 258,106 264,130 C238,118 162,118 136,130 z" fill="#e8b264" opacity=".75"/>
    <path d="M132,166 C120,180 108,190 96,192 C102,178 112,168 124,160 z" fill="#c98a3c"/>
    <path d="M268,166 C280,180 292,190 304,192 C298,178 288,168 276,160 z" fill="#c98a3c"/>
    <path d="M186,86 q14,-10 28,0 q-14,8 -28,0 z" fill="#e8b264"/>
    ${scatter(r, 16, 140, 96, 120, 78, ['#a86a24', '#f0cd8a'], 2.6)}
    ${herb(148, 108, 0.55)}${herb(256, 112, 0.5)}
  </g>`;
};

D.wings = r => {
  let w = '';
  for (let i = 0; i < 9; i++) {
    const x = 108 + (i % 3) * 84 + r() * 16, y = 116 + Math.floor(i / 3) * 30 + r() * 10, a = -40 + r() * 80;
    w += `<g transform="translate(${R(x)},${R(y)}) rotate(${R(a)})">
      <path d="M-30,0 C-30,-14 -16,-22 0,-22 C20,-22 32,-12 32,2 C32,14 18,20 0,20 C-16,20 -30,12 -30,0 z" fill="#c2451f"/>
      <path d="M-26,-2 C-26,-14 -14,-20 0,-20 C18,-20 28,-11 28,0 C28,11 16,17 0,17 C-14,17 -26,9 -26,-2 z" fill="#dd5c28"/>
      <ellipse cx="-4" cy="-6" rx="12" ry="5" fill="#f08a44" opacity=".7"/>
      <rect x="26" y="-5" width="14" height="10" rx="5" fill="#f3e6c8"/></g>`;
  }
  return `${plate(200, 170, 132, 50)}${w}
  ${scatter(r, 12, 110, 122, 180, 60, ['#3f8b4a', '#f6f0dc'], 2.6)}`;
};

D.pork = (r, v) => {
  if (v === 1) {                                   // tenderloin medallions, fanned
    let med = '';
    for (let i = 0; i < 6; i++) {
      const x = 124 + i * 28, a = -10 + i * 4;
      med += `<g transform="translate(${x},150) rotate(${a})">
        <ellipse cx="0" cy="0" rx="26" ry="34" fill="#7d4420"/>
        <ellipse cx="0" cy="0" rx="23" ry="31" fill="#c08a54"/>
        <ellipse cx="0" cy="0" rx="15" ry="22" fill="#e0b48a"/>
      </g>`;
    }
    return `${plate(200, 172, 134, 48)}
      <path d="M96,168 C126,144 182,138 238,148 C274,154 298,166 304,176 C266,186 122,186 96,168 z" fill="#6b3a18" opacity=".45"/>
      ${med}${herb(318, 142, 0.6)}
      ${scatter(r, 10, 124, 182, 156, 12, ['#f0e3c0'], 2.2)}`;
  }
  if (v === 2) {                                   // pulled, heaped on the board
    let sh = '';
    for (let i = 0; i < 30; i++) {
      const x = 108 + r() * 184, y = 124 + r() * 46, w = 22 + r() * 26, a = -30 + r() * 60;
      sh += `<rect x="${R(x)}" y="${R(y)}" width="${R(w)}" height="9" rx="4.5"
        transform="rotate(${R(a)} ${R(x + w / 2)} ${R(y + 4)})"
        fill="${['#8f5320', '#a8672c', '#6b3a18', '#c07f3c'][Math.floor(r() * 4)]}"/>`;
    }
    return `${board()}
      <ellipse cx="200" cy="164" rx="106" ry="40" fill="#7d4820"/>
      ${sh}
      <path d="M126,150 q34,-16 74,-4 q40,12 76,-6" fill="none" stroke="#5c2a12" stroke-width="7" opacity=".35" stroke-linecap="round"/>
      ${herb(316, 132, 0.55)}`;
  }
  return `${skillet()}
  <g transform="translate(0,-4)">
    <path d="M106,148 C106,112 146,96 200,96 C256,96 296,114 296,150 C296,178 254,190 200,190 C146,190 106,178 106,148 z" fill="#8f5a2a"/>
    <path d="M110,144 C110,110 148,96 200,96 C252,96 292,112 292,146 C292,172 250,182 200,182 C148,182 110,170 110,144 z" fill="#b47a3c"/>
    <path d="M124,138 C124,112 158,102 200,102 C244,102 278,112 278,138 C278,158 244,168 200,168 C158,168 124,158 124,138 z" fill="#cf9553"/>
    ${grillMarks(132, 108, 136, 56, -10, 3, '#5c3418')}
    <path d="M290,120 C310,116 320,132 314,152 C308,168 292,172 284,164 C296,152 298,132 290,120 z" fill="#f2e6cc"/>
    <path d="M292,126 C306,124 312,136 308,150 C304,160 294,164 288,158 C296,150 298,136 292,126 z" fill="#faf2df"/>
    ${herb(140, 116, 0.6)}
    ${scatter(r, 10, 130, 160, 140, 20, ['#f0e3c0'], 2.2)}
  </g>`;
};

D.ribs = r => `${board()}
  <g transform="translate(0,-4) rotate(-6 200 148)">
    <path d="M74,120 h252 a18,18 0 0 1 0,58 h-252 a18,18 0 0 1 0,-58 z" fill="#5c2412"/>
    <path d="M78,124 h244 a14,14 0 0 1 0,50 h-244 a14,14 0 0 1 0,-50 z" fill="#7d3418"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `
      <rect x="${88 + i * 40}" y="120" width="30" height="58" rx="14" fill="#8f4420"/>
      <rect x="${92 + i * 40}" y="124" width="22" height="50" rx="11" fill="#a8552a"/>
      <rect x="${94 + i * 40}" y="128" width="16" height="18" rx="8" fill="#c06a36" opacity=".8"/>
      <rect x="${84 + i * 40}" y="172" width="12" height="16" rx="6" fill="#f0e6d0"/>`).join('')}
    <path d="M80,132 q60,10 120,0 q60,-10 120,4" fill="none" stroke="#4a1c0c" stroke-width="6" opacity=".45"/>
  </g>
  ${scatter(r, 12, 90, 186, 220, 12, ['#5fa84c', '#f0e3c0'], 2.4)}`;

D.lamb = r => `${plate(200, 176, 130, 46)}
  <g transform="translate(0,-4)">
    ${[[136, 6], [200, 0], [264, 6]].map(([x, dy]) => `
      <g transform="translate(${x},${dy})">
        <rect x="-5" y="26" width="10" height="74" rx="5" fill="#e8dcc0"/>
        <rect x="-5" y="26" width="10" height="20" rx="5" fill="#fbf5e6"/>
        <ellipse cx="0" cy="124" rx="40" ry="32" fill="#6b2f14"/>
        <ellipse cx="0" cy="121" rx="38" ry="30" fill="#8f4420"/>
        <ellipse cx="0" cy="120" rx="26" ry="20" fill="#c4506a"/>
        <ellipse cx="0" cy="119" rx="17" ry="12" fill="#d97d88"/>
        <path d="M-37,106 a38,26 0 0 1 74,0 a38,11 0 0 1 -74,0 z" fill="#4f7a2f"/>
        <path d="M-33,104 a34,22 0 0 1 66,0 a34,9 0 0 1 -66,0 z" fill="#639b3c"/>
      </g>`).join('')}
  </g>
  ${herb(322, 178, 0.65)}
  ${scatter(r, 8, 120, 182, 160, 12, ['#4f7a2f'], 2.4)}`;

D.fish = (r, v) => {
  if (v === 1) {                                   // white fillet, lemon, herbs
    return `${plate(200, 168, 132, 50)}
      <g transform="translate(0,-6)">
        <path d="M94,166 C102,122 142,100 204,100 C260,100 300,122 300,158 C300,178 258,190 200,190 C142,190 98,184 94,166 z" fill="#c9b8a2"/>
        <path d="M100,161 C110,124 146,106 204,106 C256,106 294,124 294,155 C294,173 254,183 200,183 C144,183 106,177 100,161 z" fill="#f4e9d6"/>
        <path d="M104,158 C114,126 148,110 204,110 C252,110 288,126 290,152 C250,142 150,142 104,158 z" fill="#fdf7ec"/>
        <g opacity=".6" stroke="#d8c7ae" stroke-width="6" fill="none" stroke-linecap="round">
          <path d="M126,152 q42,-26 96,-28"/><path d="M136,166 q48,-26 110,-26"/>
          <path d="M120,138 q36,-22 82,-24"/></g>
        ${herb(268, 120, 0.7)}
        <rect x="184" y="92" width="34" height="14" rx="6" fill="#fbe9a8"/>
      </g>
      ${lemon(110, 190, 0.7)}${scatter(r, 9, 140, 186, 130, 12, ['#3f8b4a'], 2.4)}`;
  }
  if (v === 2) {                                   // battered and fried
    return `${board()}
      ${[[142, 142, -9], [244, 156, 11]].map(([x, y, a]) => `
        <g transform="translate(${x},${y}) rotate(${a})">
          <path d="M-62,8 C-64,-14 -40,-30 -2,-30 C40,-30 66,-14 64,8 C62,26 36,34 -2,34 C-40,34 -60,26 -62,8 z" fill="#b4762f"/>
          <path d="M-57,6 C-59,-12 -37,-26 -2,-26 C38,-26 61,-12 59,6 C57,22 34,29 -2,29 C-38,29 -55,22 -57,6 z" fill="#e0a95a"/>
          ${scatter(r, 12, -48, -20, 96, 46, ['#f2cf95', '#c98a3c'], 4)}
        </g>`).join('')}
      ${lemon(324, 132, 0.62)}
      ${scatter(r, 10, 100, 184, 200, 12, ['#f0e3c0'], 2.2)}`;
  }
  return `${plate(200, 166, 134, 52)}
  <g transform="translate(0,-4)">
    <path d="M78,150 C110,104 180,96 244,116 C276,126 296,140 304,150 C296,160 276,174 244,184 C180,204 110,196 78,150 z" fill="#9fb0bd"/>
    <path d="M84,150 C114,110 180,102 240,120 C270,130 288,142 294,150 C288,158 270,170 240,180 C180,198 114,190 84,150 z" fill="#c3d0da"/>
    <path d="M84,150 C114,110 180,102 240,120 C270,130 288,142 294,150 z" fill="#dfe8ee"/>
    <path d="M304,150 l36,-26 v52 z" fill="#9fb0bd"/>
    <circle cx="120" cy="140" r="7" fill="#3a3a42"/><circle cx="118" cy="138" r="2.5" fill="#fff"/>
    ${scatter(r, 22, 150, 122, 130, 56, ['#a9bac6', '#e6eef3'], 5)}
    <path d="M170,110 q30,-12 58,0" stroke="#8fa3b0" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  ${lemon(120, 190, 0.72)}${herb(288, 190, 0.6)}`;
};

D.salmon = r => `${plate(200, 168, 132, 50)}
  <g transform="translate(0,-6)">
    <path d="M96,164 C104,120 140,98 204,98 C262,98 300,120 300,158 C300,178 260,188 200,188 C142,188 100,182 96,164 z" fill="#c95a2a"/>
    <path d="M100,160 C108,120 142,100 204,100 C258,100 294,120 294,154 C294,172 256,182 200,182 C144,182 104,176 100,160 z" fill="#e8794a"/>
    <g opacity=".55" stroke="#f8d3b8" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M124,152 q40,-30 90,-32"/><path d="M132,166 q46,-30 106,-30"/>
      <path d="M150,176 q46,-26 106,-24"/><path d="M118,136 q34,-26 78,-28"/></g>
    <path d="M96,164 C104,150 300,150 300,158 C300,178 260,188 200,188 C142,188 100,182 96,164 z" fill="#4a3428"/>
    <path d="M100,166 C112,156 292,156 296,162 C292,176 256,184 200,184 C144,184 106,178 100,166 z" fill="#6b4a36"/>
    ${herb(268, 118, 0.7)}
    <rect x="182" y="88" width="34" height="14" rx="6" fill="#fbe9a8"/>
  </g>
  ${lemon(112, 190, 0.7)}`;

D.shrimp = r => {
  let sh = '';
  const pos = [[130, 140, -20], [200, 122, 8], [268, 142, 24], [166, 176, -6], [238, 178, 14]];
  for (const [x, y, a] of pos) {
    sh += `<g transform="translate(${x},${y}) rotate(${a})">
      <path d="M-30,6 C-34,-16 -18,-30 4,-30 C26,-30 40,-16 38,4 C36,18 26,26 16,24 C24,14 24,0 14,-8 C2,-18 -14,-12 -18,4 C-20,14 -26,16 -30,6 z" fill="#e2643a"/>
      <path d="M-26,4 C-29,-13 -16,-25 4,-25 C23,-25 35,-14 33,3 C31,14 24,20 18,18 C24,8 22,-4 12,-11 C0,-19 -12,-13 -15,2 z" fill="#f4885a"/>
      <g fill="#fbc0a2" opacity=".85">
        <path d="M-12,-16 q10,-8 20,-4"/><ellipse cx="-2" cy="-19" rx="9" ry="3.6" transform="rotate(-24 -2 -19)"/>
        <ellipse cx="14" cy="-12" rx="8" ry="3.4" transform="rotate(16 14 -12)"/></g>
      <path d="M-30,6 l-12,-8 l4,14 z" fill="#e2643a"/>
      <circle cx="8" cy="-22" r="2.6" fill="#4a2418"/></g>`;
  }
  return `${skillet()}${sh}
  ${scatter(r, 14, 110, 110, 176, 76, ['#f0e3b8', '#5fa84c'], 2.6)}
  ${lemon(322, 122, 0.62)}`;
};

D.lobster = r => {
  const claw = (cx, cy, rot, flip) => `
    <g transform="translate(${cx},${cy}) rotate(${rot}) scale(${flip},1)">
      <path d="M-6,42 C-16,20 -14,-4 0,-17 C15,-31 38,-28 47,-11 C53,1 48,19 35,26 C24,32 9,30 3,21 z" fill="#a82c1b"/>
      <path d="M-3,37 C-12,18 -10,-2 2,-13 C15,-25 34,-23 42,-9 C47,1 43,17 32,23 C22,28 9,26 4,18 z" fill="#d44a2e"/>
      <path d="M4,-14 C17,-26 36,-24 43,-11 C32,-16 17,-16 5,-7 z" fill="#ee6a41"/>
      <path d="M3,15 C14,24 28,24 36,17 C27,28 10,28 3,21 z" fill="#8f2415"/>
    </g>`;
  let tail = '';
  for (let i = 0; i < 4; i++) {
    const w = 64 - i * 9, y = 140 + i * 15;
    tail += `<rect x="${200 - w / 2}" y="${y}" width="${w}" height="19" rx="9" fill="${i % 2 ? '#c43a24' : '#d94f31'}"/>
             <rect x="${200 - w / 2 + 5}" y="${y + 2}" width="${w - 10}" height="7" rx="3.5" fill="#ee6a41" opacity=".55"/>`;
  }
  return `${plate(200, 180, 134, 42)}
  <g transform="translate(0,-16)">
    <path d="M186,84 C160,50 130,36 100,32" stroke="#b8321f" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M214,84 C240,50 270,36 300,32" stroke="#b8321f" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g stroke="#a82c1b" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M178,120 L142,142"/><path d="M178,132 L144,160"/><path d="M178,144 L150,176"/>
      <path d="M222,120 L258,142"/><path d="M222,132 L256,160"/><path d="M222,144 L250,176"/>
    </g>
    ${claw(120, 100, -24, 1)}${claw(280, 100, 24, -1)}
    <ellipse cx="200" cy="112" rx="32" ry="40" fill="#a82c1b"/>
    <ellipse cx="200" cy="109" rx="29" ry="37" fill="#d94f31"/>
    <ellipse cx="200" cy="98" rx="20" ry="21" fill="#ee6a41"/>
    <circle cx="190" cy="84" r="4.5" fill="#2c1008"/><circle cx="210" cy="84" r="4.5" fill="#2c1008"/>
    ${tail}
    <g transform="translate(200,201)">
      <path d="M0,-4 l-46,24 l18,-28 z" fill="#a82c1b"/><path d="M0,-4 l46,24 l-18,-28 z" fill="#a82c1b"/>
      <path d="M0,-6 l-27,30 l11,-32 z" fill="#c43a24"/><path d="M0,-6 l27,30 l-11,-32 z" fill="#c43a24"/>
      <path d="M-12,-6 l12,32 l12,-32 z" fill="#ee6a41"/>
    </g>
  </g>
  ${lemon(94, 196, 0.58)}${herb(312, 198, 0.52)}`;
};

D.crab = r => `${plate(200, 170, 132, 50)}
  ${[[134, 152, 1], [200, 142, 1.14], [266, 152, 1]].map(([x, y, s]) => `
    <g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="6" rx="46" ry="28" fill="#a8601f"/>
      <ellipse cx="0" cy="2" rx="46" ry="28" fill="#c47c31"/>
      <ellipse cx="0" cy="-2" rx="40" ry="23" fill="#dc9b4c"/>
      <ellipse cx="-8" cy="-8" rx="22" ry="10" fill="#f0bd77" opacity=".7"/>
      ${scatter(r, 12, -34, -14, 68, 28, ['#8f4c18', '#f2cf95'], 2.4)}
    </g>`).join('')}
  <ellipse cx="330" cy="176" rx="26" ry="11" fill="#f0e9dd"/>
  <ellipse cx="330" cy="174" rx="21" ry="8" fill="#e8a05a"/>
  ${lemon(76, 178, 0.62)}${herb(200, 118, 0.5)}`;

D.scallop = r => `${plate(200, 164, 134, 52, '#fff', '#efe9dd')}
  <path d="M92,176 C120,150 180,142 200,142 C232,142 288,152 312,176 C280,186 120,186 92,176 z" fill="#e8e2cf" opacity=".55"/>
  ${[[136, 148], [200, 138], [264, 148], [168, 178], [232, 178]].map(([x, y], i) => `
    <g transform="translate(${x},${y}) scale(${i > 2 ? 0.86 : 1})">
      <ellipse cx="0" cy="5" rx="34" ry="22" fill="#a8702f"/>
      <ellipse cx="0" cy="0" rx="34" ry="22" fill="#f6ecd6"/>
      <ellipse cx="0" cy="-4" rx="32" ry="19" fill="#c9873a"/>
      <ellipse cx="0" cy="-5" rx="27" ry="15" fill="#e0a556"/>
      <ellipse cx="-7" cy="-10" rx="12" ry="5" fill="#f5d295" opacity=".85"/>
    </g>`).join('')}
  ${scatter(r, 14, 110, 130, 180, 56, ['#8c5a2a', '#3f8b4a'], 2.6)}
  ${herb(322, 158, 0.6)}`;

/* The sauces chapter leans hard on this one key, so it varies both vessel and colour. */
const SAUCE_COLS = [
  ['#b8412f', '#d15238', ['#e8734f', '#3f8b4a']],   // tomato / red
  ['#4a8434', '#5fa142', ['#8fc47a', '#e8d36a']],   // herb / green
  ['#d9a83c', '#eec25e', ['#f7e6b4', '#3f8b4a']],   // butter / cream
];
D.sauce = (r, v) => {
  const [a, b, fl] = SAUCE_COLS[v % SAUCE_COLS.length];
  if (v === 1) {                                   // shallow bowl with a wooden spoon
    return `${plate(200, 182, 118, 34)}
      <ellipse cx="192" cy="144" rx="98" ry="46" fill="#e0d8c8"/>
      <ellipse cx="192" cy="139" rx="98" ry="46" fill="#fbf6ec"/>
      <ellipse cx="192" cy="139" rx="84" ry="36" fill="${a}"/>
      <ellipse cx="192" cy="136" rx="77" ry="30" fill="${b}"/>
      ${scatter(r, 15, 146, 120, 94, 32, fl, 3.4)}
      <g transform="rotate(24 300 118)">
        <rect x="292" y="52" width="12" height="100" rx="6" fill="#b98551"/>
        <rect x="292" y="52" width="12" height="34" rx="6" fill="#c9975f"/>
        <ellipse cx="298" cy="160" rx="23" ry="16" fill="#c9975f"/>
        <ellipse cx="298" cy="158" rx="17" ry="11" fill="${b}"/>
      </g>`;
  }
  if (v === 2) {                                   // a jar of it, made ahead
    return `${shadow(200, 208, 82, 14)}
      <rect x="138" y="66" width="124" height="28" rx="9" fill="#8d9098"/>
      <rect x="138" y="66" width="124" height="11" rx="5" fill="#a8abb4"/>
      <path d="M142,92 h116 v84 a24,24 0 0 1 -24,24 h-68 a24,24 0 0 1 -24,-24 z" fill="#dfe8ee" opacity=".55"/>
      <path d="M150,102 h100 v72 a18,18 0 0 1 -18,18 h-64 a18,18 0 0 1 -18,-18 z" fill="${a}"/>
      <path d="M150,102 h100 v18 h-100 z" fill="${b}"/>
      ${scatter(r, 13, 158, 110, 84, 70, fl, 3.4)}
      <rect x="164" y="132" width="72" height="36" rx="5" fill="#fdf8ec" opacity=".93"/>
      <rect x="174" y="142" width="52" height="5" rx="2.5" fill="#c9bfa8"/>
      <rect x="180" y="153" width="40" height="5" rx="2.5" fill="#d9d0bc"/>
      <path d="M142,92 h18 v108 a24,24 0 0 1 -18,-24 z" fill="#ffffff" opacity=".35"/>`;
  }
  return `${shadow(200, 202, 120, 15)}
  <path d="M96,120 h188 a10,10 0 0 1 10,10 v18 a56,56 0 0 1 -56,56 h-96 a56,56 0 0 1 -56,-56 v-18 a10,10 0 0 1 10,-10 z" fill="#dcd6ca"/>
  <path d="M96,120 h188 v14 h-188 z" fill="#eee8dc"/>
  <ellipse cx="190" cy="120" rx="94" ry="20" fill="#f5f0e6"/>
  <ellipse cx="190" cy="120" rx="84" ry="16" fill="${a}"/>
  <ellipse cx="190" cy="118" rx="78" ry="13" fill="${b}"/>
  ${scatter(r, 10, 140, 110, 100, 16, fl, 3.4)}
  <path d="M284,130 q34,4 40,26 q4,20 -14,26" fill="none" stroke="#dcd6ca" stroke-width="12" stroke-linecap="round"/>
  <path d="M296,66 q10,20 0,32 q-10,-12 0,-32 z" fill="${b}" opacity=".85"/>
  ${steam(190, 96, r)}`;
};

D.cake = r => `${plate(200, 178, 128, 44)}
  <g transform="translate(0,-8)">
    <path d="M118,178 L146,64 L262,64 L290,178 z" fill="#c9803f"/>
    <path d="M124,172 L150,72 L258,72 L284,172 z" fill="#e0a05c"/>
    <path d="M128,150 L280,150 L276,132 L132,132 z" fill="#fbeedd"/>
    <path d="M136,116 L272,116 L268,98 L140,98 z" fill="#fbeedd"/>
    <path d="M146,64 L262,64 L268,86 L140,86 z" fill="#f4e0c4"/>
    <path d="M140,64 C150,50 176,44 204,44 C236,44 262,52 268,66 C240,74 168,74 140,64 z" fill="#fdf3e4"/>
    <circle cx="204" cy="42" r="12" fill="#c8303c"/><circle cx="200" cy="38" r="4" fill="#e8646c" opacity=".8"/>
    ${scatter(r, 10, 150, 46, 110, 16, ['#f7d15c', '#8c5a2a'], 2.4)}
  </g>`;

D.cookie = r => `${plate(200, 170, 132, 50)}
  ${[[140, 166, 1, -8], [206, 158, 1.05, 12], [268, 168, 0.95, -4], [176, 132, 0.9, 18]].map(([x, y, s, a]) => `
    <g transform="translate(${x},${y}) rotate(${a}) scale(${s})">
      <circle r="46" fill="#b4762f"/><circle r="46" cy="-4" fill="#d99a45"/>
      <circle r="41" cy="-6" fill="#e8b264"/>
      ${scatter(r, 9, -32, -34, 64, 56, ['#3f2314', '#5c3418'], 6)}
      <ellipse cx="-14" cy="-24" rx="14" ry="6" fill="#f2cf95" opacity=".5"/>
    </g>`).join('')}`;

D.pie = r => `${plate(200, 176, 128, 44)}
  <g transform="translate(0,-10)">
    <ellipse cx="200" cy="164" rx="118" ry="36" fill="#b4762f"/>
    <ellipse cx="200" cy="156" rx="118" ry="36" fill="#d99a45"/>
    <ellipse cx="200" cy="150" rx="104" ry="30" fill="#e8b264"/>
    <path d="M96,150 C96,104 140,84 200,84 C260,84 304,104 304,150 C280,162 120,162 96,150 z" fill="#e0a558"/>
    <g stroke="#c9853a" stroke-width="9" stroke-linecap="round" fill="none" opacity=".9">
      <path d="M124,132 q76,-42 152,0"/><path d="M112,146 q88,-46 176,0"/>
      <path d="M148,92 q24,58 24,66"/><path d="M200,86 q0,60 0,68"/><path d="M252,92 q-24,58 -24,66"/></g>
    <ellipse cx="200" cy="150" rx="104" ry="30" fill="none" stroke="#c9853a" stroke-width="6"/>
    ${scatter(r, 10, 140, 96, 120, 46, ['#a8321f'], 3.4)}
    ${scatter(r, 14, 130, 88, 140, 20, ['#f7e6c4'], 2.2)}
  </g>`;

D.icecream = r => {
  const b = bowl(200, 132, 110, 74, '#fff', '#efe9dd');
  return `${b.back}
  <clipPath id="cpI"><ellipse cx="200" cy="132" rx="106" ry="31"/></clipPath>
  <g clip-path="url(#cpI)"><ellipse cx="200" cy="140" rx="106" ry="34" fill="#f3ece0"/></g>
  <g>
    <circle cx="158" cy="118" r="40" fill="#f2d9b8"/><circle cx="152" cy="112" r="34" fill="#fbeedd"/>
    <circle cx="240" cy="120" r="38" fill="#c98a6a"/><circle cx="234" cy="114" r="32" fill="#e0a382"/>
    <circle cx="200" cy="96" r="38" fill="#e0879a"/><circle cx="194" cy="90" r="32" fill="#f2a8b6"/>
    <path d="M200,58 q34,-6 44,-24 q-2,26 -44,24 z" fill="#c8303c"/>
    ${scatter(r, 16, 140, 70, 130, 60, ['#f7d15c', '#7a4a9c', '#5fa84c', '#e8646c'], 3)}
  </g>
  ${b.front}`;
};

/* Set custards in a ramekin — crème brûlée, panna cotta — which otherwise
   ended up on the saucepan drawing. */
D.custard = r => `${plate(200, 182, 112, 32)}
  <path d="M116,126 h168 l-13,54 a17,17 0 0 1 -17,13 h-108 a17,17 0 0 1 -17,-13 z" fill="#efe8da"/>
  <path d="M116,126 h168 l-3,13 h-162 z" fill="#ded5c3"/>
  <g stroke="#e2dacb" stroke-width="3" opacity=".8">
    <path d="M142,140 l-6,50"/><path d="M172,141 l-3,51"/><path d="M200,141 v51"/>
    <path d="M228,141 l3,51"/><path d="M258,140 l6,50"/></g>
  <ellipse cx="200" cy="126" rx="84" ry="25" fill="#fbf6ec"/>
  <ellipse cx="200" cy="125" rx="75" ry="20" fill="#a8631f"/>
  <ellipse cx="200" cy="123" rx="71" ry="17" fill="#d99a45"/>
  <ellipse cx="184" cy="118" rx="28" ry="8" fill="#f2c884" opacity=".65"/>
  ${scatter(r, 9, 166, 114, 68, 18, ['#8f5218', '#f2cf95'], 3)}
  <circle cx="250" cy="114" r="9" fill="#c02c3c"/>
  <circle cx="264" cy="121" r="7" fill="#7a2f8c"/>
  ${herb(236, 106, 0.4)}
  <g transform="rotate(14 316 176)">
    <rect x="312" y="118" width="9" height="62" rx="4.5" fill="#c9cdd4"/>
    <ellipse cx="316" cy="186" rx="16" ry="11" fill="#dfe3e9"/>
  </g>`;

D.chocolate = r => `${plate(200, 174, 128, 46)}
  <g transform="translate(0,-8)">
    <ellipse cx="200" cy="170" rx="86" ry="26" fill="#4a2a18"/>
    <path d="M114,168 C114,124 152,104 200,104 C248,104 286,124 286,168 C260,182 140,182 114,168 z" fill="#5c3420"/>
    <path d="M120,164 C120,126 154,110 200,110 C246,110 280,126 280,164 C256,176 144,176 120,164 z" fill="#7a482c"/>
    <path d="M164,120 C176,108 224,108 236,120 C240,144 232,158 200,158 C168,158 160,144 164,120 z" fill="#3a1e10"/>
    <path d="M170,124 C182,114 218,114 230,124 C234,142 226,152 200,152 C174,152 166,142 170,124 z" fill="#552d18"/>
    <path d="M176,116 q24,-14 48,0 q-6,-18 -24,-18 q-18,0 -24,18 z" fill="#8f5a34"/>
    <ellipse cx="200" cy="132" rx="26" ry="14" fill="#2c1409"/>
    <path d="M182,140 q18,16 36,0 q-6,24 -18,24 q-12,0 -18,-24 z" fill="#3a1e10"/>
    ${scatter(r, 10, 150, 100, 100, 20, ['#f7f2e6'], 2.6)}
    <circle cx="272" cy="150" r="11" fill="#c8303c"/>
  </g>`;

D.drink = r => `${shadow(200, 208, 90, 14)}
  <path d="M148,66 h104 l-12,132 a16,16 0 0 1 -16,14 h-48 a16,16 0 0 1 -16,-14 z" fill="#dfe8ee" opacity=".65"/>
  <path d="M154,80 h92 l-11,116 a10,10 0 0 1 -10,9 h-50 a10,10 0 0 1 -10,-9 z" fill="#e0682c" opacity=".85"/>
  <path d="M154,80 h92 l-3,30 h-86 z" fill="#f2a44a" opacity=".8"/>
  <ellipse cx="200" cy="70" rx="52" ry="12" fill="#f2f7fa" opacity=".9"/>
  ${scatter(r, 8, 166, 100, 68, 80, ['#ffffff'], 4)}
  <rect x="228" y="30" width="8" height="70" rx="4" fill="#c8303c" transform="rotate(12 232 65)"/>
  ${lemon(258, 78, 0.6)}
  ${herb(150, 66, 0.5)}`;

D.cheese = r => `${board()}
  <g transform="translate(0,-6)">
    <path d="M84,180 L84,140 L212,104 L212,148 z" fill="#e0a83c"/>
    <path d="M84,140 L212,104 L188,92 L64,128 z" fill="#f2c85c"/>
    <path d="M84,180 L84,140 L64,128 L64,168 z" fill="#c9942f"/>
    ${scatter(r, 8, 96, 118, 100, 32, ['#c9942f'], 5)}
    <g transform="translate(240,120) rotate(-6)">
      <path d="M0,60 L0,24 L92,0 L92,40 z" fill="#f2e3c0"/>
      <path d="M0,24 L92,0 L74,-10 L-14,14 z" fill="#faf0d6"/>
    </g>
    ${scatter(r, 10, 240, 160, 100, 22, ['#8c1f2c', '#5fa84c'], 5)}
  </g>`;

D.default = r => `${plate()}
  <ellipse cx="200" cy="160" rx="74" ry="30" fill="#d99a45"/>
  <ellipse cx="200" cy="154" rx="66" ry="25" fill="#e8b264"/>
  ${scatter(r, 16, 150, 138, 100, 32, ['#c8442f', '#3f8b4a', '#f7ead0'], 5)}
  ${herb(200, 140, 0.5)}`;

/* ---------- background palettes ----------
   Each family holds several variants. A chapter can easily contain ten recipes that
   share one drawing (ten steaks, ten pasta bowls); picking the variant from the seed
   is what keeps those ten cards from looking like the same card ten times. */
const FAMILIES = {
  warm: [['#fff3e0', '#ffd9a8'], ['#fff6e8', '#f7cf9c'], ['#fdf0dd', '#ffcf9a'], ['#fff4e4', '#f6d2ae']],
  red: [['#fff0ec', '#ffc4b4'], ['#ffeee9', '#f7bda9'], ['#fff2ef', '#ffc9bd'], ['#ffedea', '#f2b8a8']],
  green: [['#eefbe9', '#bfe8b8'], ['#f0fae8', '#c8e6a8'], ['#ebfaee', '#b4e6c4'], ['#f2fbe6', '#cbe9a4']],
  blue: [['#eaf5fb', '#b9dcee'], ['#e9f6fa', '#aed8e8'], ['#eef4fc', '#bcd4f0'], ['#e7f3f8', '#a8d2e4']],
  gold: [['#fff8e2', '#ffe1a0'], ['#fffaea', '#fbdb96'], ['#fef7dd', '#ffe4ac'], ['#fff9e6', '#f6d894']],
  plum: [['#f7eefb', '#dcc2ec'], ['#f5edfa', '#d2b8ea'], ['#faeef8', '#e6c0e2'], ['#f3ecfb', '#cbb6ee']],
  clay: [['#fdf0e6', '#f3c9a8'], ['#fdf1e4', '#eec3a0'], ['#fcefe4', '#f0cbaa'], ['#fdf2e8', '#e8bf9e']],
  mint: [['#eafaf4', '#b6e6d4'], ['#e8faf2', '#aae2cc'], ['#edfaf6', '#bceadb'], ['#e6f9f0', '#a4dfc6']],
};
const P = {
  warm: 'warm', red: 'red', green: 'green', blue: 'blue',
  gold: 'gold', plum: 'plum', clay: 'clay', mint: 'mint',
};
const BG = {
  steak: P.warm, roast: P.warm, burger: P.gold, sandwich: P.gold, wrap: P.gold, taco: P.clay,
  burrito: P.clay, nachos: P.gold, pizza: P.red, pasta: P.red, lasagna: P.red, risotto: P.gold,
  noodles: P.clay, dumpling: P.mint, rice: P.mint, curry: P.gold, soup: P.warm, stew: P.warm,
  stirfry: P.clay,
  chili: P.red, salad: P.green, veggie: P.green, potato: P.gold, bread: P.gold, egg: P.warm,
  pancake: P.gold, chicken: P.warm, wings: P.red, pork: P.clay, ribs: P.clay, lamb: P.plum,
  fish: P.blue, salmon: P.blue, shrimp: P.blue, lobster: P.blue, crab: P.blue, scallop: P.blue,
  sauce: P.red, cake: P.plum, cookie: P.gold, pie: P.gold, icecream: P.plum, chocolate: P.clay,
  drink: P.mint, cheese: P.gold, custard: P.gold, default: P.warm,
};

/* ---------- public API ---------- */

/* Every SVG on the page carries its own <defs>. Duplicate ids across inline SVGs
   are invalid HTML and make every reference resolve to the FIRST definition in the
   document, so gradients and clip-paths bleed between cards. Namespace them all. */
function namespaceIds(svg, uid) {
  const ids = new Set();
  svg.replace(/\bid="([^"]+)"/g, (_, id) => { ids.add(id); return _; });
  let out = svg;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\bid="${esc}"`, 'g'), `id="${id}-${uid}"`)
             .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${uid})`);
  }
  return out;
}

/* ---- sprite API ----
   The book is now static HTML: no JavaScript draws anything at read time. Each
   distinct (dish, variant) is emitted ONCE as an <symbol>, every recipe points a
   <use> at it, and the palette/rotation that make two cards of the same dish look
   different are applied in the per-recipe wrapper instead of baked into the drawing. */

function resolveKey(key) {
  return D[key] ? key : 'default';
}

/* Gradients every drawing shares, plus one per background palette. Defined once
   for the whole document, so nothing needs per-card id namespacing. */
function sharedDefs() {
  let g = '';
  for (const fam of Object.keys(FAMILIES)) {
    FAMILIES[fam].forEach(([c0, c1], i) => {
      g += `<linearGradient id="bg-${fam}-${i}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`;
    });
  }
  g += '<radialGradient id="sh"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="bowlSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>' +
    '<linearGradient id="wrapSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>' +
    '<linearGradient id="cheeseSh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#e8a03c" stop-opacity=".3"/></linearGradient>' +
    '<linearGradient id="panSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity=".06"/></linearGradient>';
  return g;
}

/* One drawing, deterministic for a given (key, variant) so every recipe sharing
   that pair can point at the same symbol. Inline clip-path ids get namespaced;
   the shared gradients above are left alone because they aren't defined here. */
function dishBody(key, variant) {
  const k = resolveKey(key);
  const r = rng(hash(k + '#' + variant));
  return namespaceIds(D[k](r, variant), k + variant);
}

/* Which symbol a recipe uses, and the cheap per-recipe differences. */
function styleFor(key, seed) {
  const k = resolveKey(key);
  const h = hash(String(seed || key));
  const fam = BG[k] || BG.default;
  return {
    key: k,
    variant: (h >>> 11) % 3,
    symbol: 'a-' + k + '-' + ((h >>> 11) % 3),
    bg: 'bg-' + fam + '-' + (h % FAMILIES[fam].length),
    tilt: h % 3,
    spin: ((h >>> 3) % 5) - 2,
    nudge: ((h >>> 6) % 7) - 3,
  };
}

module.exports = {
  // the build pipeline: shared gradient defs, one deterministic drawing per
  // (dish, variant) symbol, and the per-recipe style that references it
  sharedDefs, dishBody, styleFor,
  ART_KEYS: Object.keys(D).filter(k => k !== 'default'),
};
