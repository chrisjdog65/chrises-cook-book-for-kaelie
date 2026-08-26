/* ===== Kaelie's Recipe Book — app ===== */
(function () {
  'use strict';

  var BOOK = window.BOOK;
  var RECIPES = BOOK.recipes;
  var CATS = BOOK.categories;
  var BY_ID = {};
  RECIPES.forEach(function (r) { BY_ID[r.id] = r; });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- storage (must survive private mode / blocked storage) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('krb:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('krb:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  var favs = store.get('favs', []);
  var favSet = {}; favs.forEach(function (id) { favSet[id] = 1; });
  var checks = store.get('checks', {});       // recipeId -> [ingredient keys]
  var stepsDone = store.get('steps', {});     // recipeId -> [step indexes]
  var listItems = store.get('list', []);      // {rid, text}
  var scale = 1;

  function saveFavs() { store.set('favs', Object.keys(favSet)); }
  function isFav(id) { return !!favSet[id]; }
  function toggleFav(id) {
    if (favSet[id]) { delete favSet[id]; } else { favSet[id] = 1; }
    saveFavs(); updateBadges();
    return !!favSet[id];
  }

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2100);
  }

  /* ---------- ingredient scaling (see build/scale.js + scale.test.js) ---------- */
  var scaleText = window.SCALE.scaleText;

  /* ---------- search index ---------- */
  RECIPES.forEach(function (r) {
    var ing = [];
    r.ingredients.forEach(function (g) { g.items.forEach(function (i) { ing.push(i); }); });
    r._ix = (r.title + ' ' + r.blurb + ' ' + r.cat + ' ' + r.tags.join(' ') + ' ' +
      r.difficulty + ' ' + ing.join(' ')).toLowerCase();
    r._mins = parseMins(r.totalTime);
  });

  function parseMins(t) {
    var s = String(t).toLowerCase(), m = 0, h = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/);
    if (h) m += parseFloat(h[1]) * 60;
    var mm = s.match(/(\d+)\s*(?:min)/); if (mm) m += parseInt(mm[1], 10);
    if (!m) { var d = s.match(/(\d+)/); if (d) m = parseInt(d[1], 10); }
    return m;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    return RECIPES.map(function (r) {
      var sc = 0, ok = true;
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (r.title.toLowerCase().indexOf(w) >= 0) sc += 10;
        else if (r._ix.indexOf(w) >= 0) sc += 2;
        else { ok = false; break; }
      }
      return ok ? { r: r, sc: sc } : null;
    }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).map(function (x) { return x.r; });
  }

  /* ---------- links out ---------- */
  function videoUrl(r) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(r.videoQuery + ' recipe'); }
  function photoUrl(r) { return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(r.photoQuery); }

  /* ---------- card ---------- */
  // The favourite control is a sibling of the open-recipe button, never nested inside
  // it — a control inside a control confuses assistive tech and taps alike.
  function cardHTML(r) {
    return '<div class="rcard">' +
      '<button class="rcard-open" data-go="#/r/' + r.id + '">' +
      '<div class="art">' + window.ART.art(r.art, r.id) + '</div>' +
      '<div class="body"><div class="t">' + esc(r.title) + '</div>' +
      '<div class="b">' + esc(r.blurb) + '</div>' +
      '<div class="m"><span>⏱ ' + esc(r.totalTime) + '</span><span class="dot"></span>' +
      '<span>🍽 ' + esc(r.servings) + '</span><span class="dot"></span>' +
      '<span class="diff ' + esc(r.difficulty) + '">' + esc(r.difficulty) + '</span></div>' +
      '</div></button>' +
      '<button class="fav" data-fav="' + r.id + '" aria-pressed="' + (isFav(r.id) ? 'true' : 'false') +
      '" aria-label="Save ' + esc(r.title) + ' to favorites">' + (isFav(r.id) ? '❤️' : '🤍') + '</button>' +
      '</div>';
  }
  function grid(list) {
    if (!list.length) return '';
    return '<div class="rgrid">' + list.map(cardHTML).join('') + '</div>';
  }

  /* Each card carries a full inline SVG, so rendering several hundred at once
     makes the phone chug. Page them instead. */
  var PAGE = 40, shown = PAGE;
  function pagedGrid(list) {
    var slice = list.slice(0, shown);
    return grid(slice) + (list.length > slice.length
      ? '<div class="actions" style="grid-template-columns:1fr;margin-top:16px">' +
        '<button class="act" data-more>Show ' + Math.min(PAGE, list.length - slice.length) +
        ' more (' + (list.length - slice.length) + ' left)</button></div>'
      : '');
  }

  /* ---------- views ---------- */
  var main = null;
  function setMain(html) {
    main.innerHTML = html;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function viewHome() {
    var quick = RECIPES.filter(function (r) { return r._mins > 0 && r._mins <= 30; });
    var pick = quick.length ? quick.slice(0, 4) : RECIPES.slice(0, 4);
    setMain(
      '<h2 class="h first">Hi Kaelie 👋</h2>' +
      '<p class="sub">' + RECIPES.length + ' recipes, ' + CATS.length + ' chapters. Tap anything and start cooking.</p>' +
      '<div class="actions"><button class="act primary" data-random><span class="i">🎲</span> Surprise me</button>' +
      '<button class="act" data-go="#/fav"><span class="i">❤️</span> My favorites</button></div>' +
      '<h2 class="h">Chapters</h2>' +
      '<div class="catgrid">' + CATS.map(function (c) {
        return '<button class="catcard" data-go="#/c/' + c.slug + '">' +
          '<div class="ce">' + c.emoji + '</div><div class="cn">' + esc(c.name) + '</div>' +
          '<div class="cc">' + c.count + ' recipes</div></button>';
      }).join('') + '</div>' +
      '<h2 class="h">Ready in 30 minutes</h2><p class="sub">For the nights you are hungry now.</p>' +
      grid(pick) +
      footHTML()
    );
  }

  function viewCat(slug) {
    var c = null;
    for (var i = 0; i < CATS.length; i++) if (CATS[i].slug === slug) c = CATS[i];
    if (!c) return viewHome();
    var list = RECIPES.filter(function (r) { return r.catSlug === slug; });
    setMain(
      '<button class="backbtn" data-go="#/">‹ All chapters</button>' +
      '<h2 class="h">' + c.emoji + ' ' + esc(c.name) + '</h2>' +
      '<p class="sub">' + esc(c.blurb) + '</p>' +
      grid(list) + footHTML()
    );
  }

  function viewFav() {
    var list = RECIPES.filter(function (r) { return isFav(r.id); });
    setMain('<h2 class="h first">❤️ Favorites</h2>' +
      (list.length
        ? '<p class="sub">' + list.length + ' saved.</p>' + pagedGrid(list)
        : '<div class="empty"><span class="big">🤍</span>No favorites yet.<br>Tap the heart on any recipe to save it here.</div>') +
      footHTML());
  }

  function viewList() {
    var groups = {};
    listItems.forEach(function (it) { (groups[it.rid] = groups[it.rid] || []).push(it); });
    var keys = Object.keys(groups);
    setMain('<h2 class="h first">🧺 Shopping list</h2>' +
      (keys.length
        ? '<p class="sub">' + listItems.length + ' items. Tap an item to cross it off.</p>' +
        keys.map(function (rid) {
          var r = BY_ID[rid];
          return '<div class="slgroup"><header><div class="t">' + esc(r ? r.title : 'Recipe') + '</div>' +
            '<button data-rmgroup="' + esc(rid) + '" aria-label="Remove these items">✕</button></header>' +
            '<ul class="ilist">' + groups[rid].map(function (it) {
              return '<li><label><input type="checkbox" data-slcheck="' + esc(it.rid) + '|' + esc(it.text) + '"' +
                (it.done ? ' checked' : '') + '><span>' + esc(it.text) + '</span></label></li>';
            }).join('') + '</ul></div>';
        }).join('') +
        '<div class="actions" style="grid-template-columns:1fr"><button class="act" data-clearlist>Clear the whole list</button></div>'
        : '<div class="empty"><span class="big">🧺</span>Your list is empty.<br>Open a recipe and tap <b>Add to shopping list</b>.</div>') +
      footHTML());
  }

  var FILTERS = [
    { k: 'all', label: 'Everything', fn: function () { return true; } },
    { k: 'quick', label: '⏱ 30 min or less', fn: function (r) { return r._mins > 0 && r._mins <= 30; } },
    { k: 'easy', label: '👌 Easy', fn: function (r) { return r.difficulty === 'Easy'; } },
    { k: 'fancy', label: '✨ Impressive', fn: function (r) { return r.difficulty === 'Advanced'; } },
    { k: 'fav', label: '❤️ Favorites', fn: function (r) { return isFav(r.id); } }
  ];
  var filter = 'all';

  function viewSearch(q) {
    var base = q ? search(q) : RECIPES;
    var f = FILTERS.filter(function (x) { return x.k === filter; })[0] || FILTERS[0];
    var res = base.filter(f.fn);

    var chips = '<div class="chips">' + FILTERS.map(function (x) {
      return '<button class="chip' + (x.k === filter ? ' on' : '') + '" data-filter="' + x.k + '">' + x.label + '</button>';
    }).join('') + '</div>';

    setMain('<h2 class="h first">Search</h2>' +
      '<p class="sub">' +
      (q ? res.length + ' result' + (res.length === 1 ? '' : 's') + ' for “' + esc(q) + '”'
         : 'Type above — dish names, ingredients, anything. Or just browse:') +
      '</p>' + chips +
      (!res.length
        ? '<div class="empty"><span class="big">🔍</span>' +
          (q ? 'Nothing matched that.<br>Try “garlic”, “shrimp”, or “chicken”.'
             : 'Nothing here yet.') + '</div>'
        : pagedGrid(res)) + footHTML());
  }

  function viewRecipe(id) {
    var r = BY_ID[id];
    if (!r) return viewHome();
    scale = 1; // a batch size set on one recipe must not silently carry into the next
    var done = stepsDone[id] || [];
    var ck = checks[id] || [];

    var ingHTML = r.ingredients.map(function (g, gi) {
      return '<div class="igroup">' +
        (r.ingredients.length > 1 || g.group.toLowerCase() !== 'ingredients'
          ? '<h4>' + esc(g.group) + '</h4>' : '') +
        '<ul class="ilist">' + g.items.map(function (it, ii) {
          var key = gi + ':' + ii;
          return '<li><label><input type="checkbox" data-ing="' + key + '"' +
            (ck.indexOf(key) >= 0 ? ' checked' : '') + '><span data-raw="' + esc(it) + '">' +
            scaleText(it, scale) + '</span></label></li>';
        }).join('') + '</ul></div>';
    }).join('');

    var stepHTML = r.instructions.map(function (s, i) {
      var t = timerFor(s.text);
      return '<li' + (done.indexOf(i) >= 0 ? ' class="done"' : '') + ' data-step="' + i + '">' +
        '<button class="tapme" aria-label="Mark step ' + (i + 1) + ' done"></button>' +
        '<div class="st">' + esc(s.title) + '</div>' +
        '<div class="sx">' + esc(s.text) + '</div>' +
        (t ? '<button class="timerbtn" data-timer="' + t + '">⏱ Start ' + fmtClock(t) + ' timer</button>' : '') +
        '</li>';
    }).join('');

    setMain(
      '<button class="backbtn" data-go="#/c/' + r.catSlug + '">‹ ' + esc(r.cat) + '</button>' +
      '<div class="hero">' + window.ART.art(r.art, r.id) + '</div>' +
      '<h1 class="rtitle">' + esc(r.title) + '</h1>' +
      '<p class="rblurb">' + esc(r.blurb) + '</p>' +
      '<div class="rtags">' + r.tags.map(function (t) { return '<span class="rtag">' + esc(t) + '</span>'; }).join('') +
      '<span class="rtag diff ' + esc(r.difficulty) + '">' + esc(r.difficulty) + '</span></div>' +

      '<div class="metagrid">' +
      '<div><div class="k">Prep</div><div class="v">' + esc(r.prepTime) + '</div></div>' +
      '<div><div class="k">Cook</div><div class="v">' + esc(r.cookTime) + '</div></div>' +
      '<div><div class="k">Total</div><div class="v">' + esc(r.totalTime) + '</div></div>' +
      '<div><div class="k">Serves</div><div class="v">' + esc(r.servings) + '</div></div>' +
      '</div>' +

      '<div class="actions">' +
      '<a class="act primary" href="' + videoUrl(r) + '" target="_blank" rel="noopener"><span class="i">▶️</span> Watch it made</a>' +
      '<a class="act" href="' + photoUrl(r) + '" target="_blank" rel="noopener"><span class="i">📷</span> See real photos</a>' +
      '<button class="act" data-favbtn="' + r.id + '"><span class="i">' + (isFav(r.id) ? '❤️' : '🤍') + '</span> ' + (isFav(r.id) ? 'Saved' : 'Save') + '</button>' +
      '<button class="act" data-cook><span class="i">👩‍🍳</span> Cook mode</button>' +
      '</div>' +

      '<div class="section"><h3><span class="n">1</span> Ingredients</h3>' +
      '<p class="hint">Tap each one as you gather it.</p>' +
      '<div class="scaler"><span class="lab">Batch</span><div class="grp">' +
      [[0.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×']].map(function (s) {
        return '<button data-scale="' + s[0] + '"' + (scale === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>';
      }).join('') + '</div></div>' +
      ingHTML +
      '<div class="actions" style="grid-template-columns:1fr;margin-top:14px">' +
      '<button class="act" data-addlist="' + r.id + '"><span class="i">🧺</span> Add to shopping list</button></div>' +
      '</div>' +

      '<div class="section"><h3><span class="n">2</span> How to make it</h3>' +
      '<p class="hint">Tap a step when it is done.</p>' +
      '<div class="progwrap"><div class="progbar"><i data-prog></i></div>' +
      '<div class="progtxt"><span data-progtxt></span><button data-resetsteps style="border:0;background:none;color:var(--accent);font-weight:700;font-size:12px;padding:0">Reset</button></div></div>' +
      '<ol class="steps">' + stepHTML + '</ol></div>' +

      '<div class="callout temp"><div class="ct">Know when it is done</div><div class="cb">' + esc(r.keyTemp) + '</div></div>' +
      '<div class="callout pair"><div class="ct">Serve it with</div><div class="cb">' + esc(r.pairing) + '</div></div>' +

      '<div class="section"><h3><span class="n">3</span> Chef tips</h3>' +
      '<ul class="tips">' + r.tips.map(function (t) { return '<li><span class="tb">◆</span><span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>' +

      '<div class="actions" style="margin-top:26px">' +
      '<a class="act primary" href="' + videoUrl(r) + '" target="_blank" rel="noopener"><span class="i">▶️</span> Watch a video</a>' +
      '<button class="act" data-random><span class="i">🎲</span> Another recipe</button></div>' +
      footHTML()
    );
    updateProgress();
  }

  function footHTML() {
    return '<div class="foot"><div class="hr"></div>Made for Kaelie, by Chris. 🤍</div>';
  }

  /* ---------- timers ---------- */
  function timerFor(text) {
    var m = String(text).match(/(\d+)(?:\s*(?:–|—|-|to)\s*\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return 0;
    var n = parseInt(m[1], 10), u = m[2].toLowerCase();
    if (!n) return 0;
    var secs = /^h/.test(u) ? n * 3600 : /^m/.test(u) ? n * 60 : n;
    if (secs < 20 || secs > 4 * 3600) return 0;
    return secs;
  }
  function fmtClock(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return m + ':' + String(sec).padStart(2, '0');
  }
  /* Phones throttle or freeze setInterval in a backgrounded tab, so counting ticks
     would drift badly on a 45-minute braise. Anchor to a wall-clock deadline and let
     the interval only redraw. */
  var activeTimer = null;
  function stopTimer() {
    if (!activeTimer) return;
    clearInterval(activeTimer.iv);
    resetBtn(activeTimer.btn, activeTimer.secs);
    activeTimer = null;
  }
  function paintTimer() {
    if (!activeTimer) return;
    var left = Math.round((activeTimer.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      var b = activeTimer.btn, s = activeTimer.secs;
      clearInterval(activeTimer.iv); activeTimer = null;
      resetBtn(b, s); alarm(); toast('⏰ Timer done!');
      return;
    }
    activeTimer.btn.textContent = '⏱ ' + fmtClock(left) + ' — tap to stop';
  }
  function startTimer(btn, secs) {
    var wasSame = activeTimer && activeTimer.btn === btn;
    var replacing = activeTimer && !wasSame;
    stopTimer();
    if (wasSame) return;                       // tapping a running timer stops it
    btn.classList.add('running');
    activeTimer = { btn: btn, secs: secs, endsAt: Date.now() + secs * 1000, iv: 0 };
    activeTimer.iv = setInterval(paintTimer, 500);
    paintTimer();
    if (replacing) toast('Timer replaced — one at a time');
  }
  function resetBtn(btn, secs) { btn.classList.remove('running'); btn.textContent = '⏱ Start ' + fmtClock(secs) + ' timer'; }
  function alarm() {
    try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]); } catch (e) { }
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ctx = new C();
      [0, .35, .7].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.5, ctx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + t + .28);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .3);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) { } }, 1600);
    } catch (e) { }
  }

  /* ---------- progress ---------- */
  function updateProgress() {
    var bar = $('[data-prog]'), txt = $('[data-progtxt]');
    if (!bar) return;
    var all = $$('.steps li'), d = $$('.steps li.done').length;
    var pct = all.length ? Math.round(d / all.length * 100) : 0;
    bar.style.width = pct + '%';
    txt.textContent = d + ' of ' + all.length + ' steps done';
  }

  /* ---------- cook mode ---------- */
  var wakeLock = null;
  function cookOn() {
    document.documentElement.classList.add('cook');
    if (!$('.cookexit')) {
      var b = document.createElement('button');
      b.className = 'cookexit'; b.textContent = '✓ Done cooking';
      b.addEventListener('click', cookOff);
      document.body.appendChild(b);
    }
    requestWake();
    toast('Cook mode — your screen will stay awake');
  }
  function cookOff() {
    document.documentElement.classList.remove('cook');
    var b = $('.cookexit'); if (b) b.remove();
    if (wakeLock) { try { wakeLock.release(); } catch (e) { } wakeLock = null; }
  }
  function requestWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }, function () { });
      }
    } catch (e) { }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (document.documentElement.classList.contains('cook')) requestWake();
    paintTimer();   // catch up a timer that expired while the tab was backgrounded
  });

  /* ---------- routing ---------- */
  function currentQuery() { var i = $('#q'); return i ? i.value.trim() : ''; }

  function route() {
    var h = location.hash || '#/';
    cookOff();
    shown = PAGE;
    var m;
    if ((m = h.match(/^#\/r\/(.+)$/))) { setTab(null); viewRecipe(decodeURIComponent(m[1])); }
    else if ((m = h.match(/^#\/c\/(.+)$/))) { setTab('home'); viewCat(decodeURIComponent(m[1])); }
    else if (h === '#/fav') { setTab('fav'); viewFav(); }
    else if (h === '#/list') { setTab('list'); viewList(); }
    else if ((m = h.match(/^#\/search(?:\?q=(.*))?$/))) {
      setTab('search');
      var q = m[1] ? decodeURIComponent(m[1]) : '';
      var inp = $('#q'); if (inp && inp.value !== q) inp.value = q;
      viewSearch(q);
    }
    else { setTab('home'); viewHome(); }
  }
  function setTab(name) {
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    var sb = $('.search');
    if (sb) sb.classList.toggle('hidden', name !== 'search');
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  function updateBadges() {
    var fb = $('[data-tab="fav"] .badge'), n = Object.keys(favSet).length;
    if (fb) { fb.textContent = n; fb.classList.toggle('hidden', !n); }
    var lb = $('[data-tab="list"] .badge');
    if (lb) { lb.textContent = listItems.length; lb.classList.toggle('hidden', !listItems.length); }
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target;

    var fav = t.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      var on = toggleFav(fav.getAttribute('data-fav'));
      fav.textContent = on ? '❤️' : '🤍';
      fav.setAttribute('aria-pressed', on ? 'true' : 'false');
      toast(on ? 'Saved to favorites ❤️' : 'Removed from favorites');
      return;
    }
    var fb = t.closest('[data-favbtn]');
    if (fb) {
      var on2 = toggleFav(fb.getAttribute('data-favbtn'));
      fb.innerHTML = '<span class="i">' + (on2 ? '❤️' : '🤍') + '</span> ' + (on2 ? 'Saved' : 'Save');
      toast(on2 ? 'Saved to favorites ❤️' : 'Removed from favorites');
      return;
    }
    var goEl = t.closest('[data-go]');
    if (goEl) { go(goEl.getAttribute('data-go')); return; }

    if (t.closest('[data-random]')) {
      var r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
      go('#/r/' + r.id); return;
    }
    if (t.closest('[data-cook]')) { cookOn(); return; }

    var fl = t.closest('[data-filter]');
    if (fl) { filter = fl.getAttribute('data-filter'); shown = PAGE; viewSearch(currentQuery()); return; }

    if (t.closest('[data-more]')) {
      shown += PAGE;
      var y = window.pageYOffset;
      if (location.hash === '#/fav') viewFav(); else viewSearch(currentQuery());
      window.scrollTo(0, y);   // "show more" must not throw her back to the top
      return;
    }

    var sc = t.closest('[data-scale]');
    if (sc) {
      scale = parseFloat(sc.getAttribute('data-scale'));
      $$('[data-scale]').forEach(function (b) { b.classList.toggle('on', parseFloat(b.getAttribute('data-scale')) === scale); });
      $$('.ilist span[data-raw]').forEach(function (s) { s.innerHTML = scaleText(s.getAttribute('data-raw'), scale); });
      return;
    }

    var tm = t.closest('[data-timer]');
    if (tm) { e.preventDefault(); startTimer(tm, parseInt(tm.getAttribute('data-timer'), 10)); return; }

    var step = t.closest('.steps li');
    if (step && !t.closest('[data-timer]')) {
      var idx = parseInt(step.getAttribute('data-step'), 10);
      var rid = (location.hash.match(/^#\/r\/(.+)$/) || [])[1];
      if (rid != null) {
        rid = decodeURIComponent(rid);
        var arr = stepsDone[rid] || [];
        var at = arr.indexOf(idx);
        if (at >= 0) { arr.splice(at, 1); step.classList.remove('done'); }
        else { arr.push(idx); step.classList.add('done'); }
        stepsDone[rid] = arr; store.set('steps', stepsDone);
        updateProgress();
      }
      return;
    }
    if (t.closest('[data-resetsteps]')) {
      var rid2 = decodeURIComponent((location.hash.match(/^#\/r\/(.+)$/) || [])[1] || '');
      stepsDone[rid2] = []; store.set('steps', stepsDone);
      $$('.steps li').forEach(function (li) { li.classList.remove('done'); });
      updateProgress(); return;
    }

    var al = t.closest('[data-addlist]');
    if (al) {
      var rec = BY_ID[al.getAttribute('data-addlist')];
      var added = 0;
      rec.ingredients.forEach(function (g, gi) {
        g.items.forEach(function (it, ii) {
          var txt = scale === 1 ? it : stripTags(scaleText(it, scale));
          var dup = listItems.some(function (x) { return x.rid === rec.id && x.text === txt; });
          if (!dup) { listItems.push({ rid: rec.id, text: txt }); added++; }
        });
      });
      store.set('list', listItems); updateBadges();
      toast(added ? added + ' items added to your list 🧺' : 'Already on your list');
      return;
    }
    var rg = t.closest('[data-rmgroup]');
    if (rg) {
      var id = rg.getAttribute('data-rmgroup');
      listItems = listItems.filter(function (x) { return x.rid !== id; });
      store.set('list', listItems); updateBadges(); viewList(); return;
    }
    if (t.closest('[data-clearlist]')) {
      listItems = []; store.set('list', listItems); updateBadges(); viewList(); toast('List cleared'); return;
    }

    var tab = t.closest('[data-tab]');
    if (tab) {
      var n = tab.getAttribute('data-tab');
      go(n === 'home' ? '#/' : n === 'search' ? '#/search' : n === 'fav' ? '#/fav' : '#/list');
      if (n === 'search') setTimeout(function () { var i = $('#q'); if (i) i.focus(); }, 60);
      return;
    }
    if (t.closest('#themeBtn')) { toggleTheme(); return; }
  }

  function stripTags(h) { var d = document.createElement('div'); d.innerHTML = h; return d.textContent; }

  function onChange(e) {
    var sl = e.target.closest('[data-slcheck]');
    if (sl) {
      var parts = sl.getAttribute('data-slcheck').split('|');
      var rid0 = parts[0], text0 = parts.slice(1).join('|');
      listItems.forEach(function (x) { if (x.rid === rid0 && x.text === text0) x.done = sl.checked; });
      store.set('list', listItems);
      return;
    }
    var ing = e.target.closest('[data-ing]');
    if (ing) {
      var rid = decodeURIComponent((location.hash.match(/^#\/r\/(.+)$/) || [])[1] || '');
      var key = ing.getAttribute('data-ing');
      var arr = checks[rid] || [];
      var at = arr.indexOf(key);
      if (ing.checked && at < 0) arr.push(key);
      if (!ing.checked && at >= 0) arr.splice(at, 1);
      checks[rid] = arr; store.set('checks', checks);
    }
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
    store.set('theme', t);
  }
  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  /* ---------- boot ---------- */
  function boot() {
    main = $('#main');
    var saved = store.get('theme', null);
    applyTheme(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    window.addEventListener('hashchange', route);

    var q = $('#q'), qt;
    if (q) {
      q.addEventListener('input', function () {
        clearTimeout(qt);
        qt = setTimeout(function () {
          var v = q.value.trim();
          var h = '#/search' + (v ? '?q=' + encodeURIComponent(v) : '');
          if (location.hash !== h) { history.replaceState(null, '', h); }
          shown = PAGE;
          setTab('search'); viewSearch(v);
        }, 130);
      });
    }
    var clr = $('.search .clr');
    if (clr) clr.addEventListener('click', function () {
      q.value = ''; q.focus(); shown = PAGE; setTab('search'); viewSearch('');
      history.replaceState(null, '', '#/search');
    });

    updateBadges();
    route();

    // The cover carries the whole point of this book, so it greets her on every open
    // rather than only the first time. Tapping the title in the header brings it back.
    var cover = $('#cover'), open = $('#openBtn');
    open.addEventListener('click', function () {
      cover.classList.add('gone');
      try { alarmSilentUnlock(); } catch (e) { }
    });
    var brand = $('.brand');
    if (brand) brand.addEventListener('click', function () { cover.classList.remove('gone'); });
  }
  // Touching AudioContext during the opening tap means the timer alarm is allowed to
  // make noise later on iOS, which blocks audio that no gesture ever unlocked.
  function alarmSilentUnlock() {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    var ctx = new C(); var o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.01);
    setTimeout(function () { try { ctx.close(); } catch (e) { } }, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
