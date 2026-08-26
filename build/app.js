/* ===== Kaelie's Recipe Book — progressive enhancement =====
   The book itself is static HTML navigated with :target CSS, so it works with no
   JavaScript at all (iOS Quick Look renders .html attachments without scripts).
   Nothing in here is required to read a recipe. It adds: search, favourites, a
   shopping list, batch scaling, step timers, progress and cook mode. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var html = document.documentElement;

  /* ---------- storage (must survive private mode / blocked storage) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('krb:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('krb:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  var favSet = {};
  (store.get('favs', []) || []).forEach(function (id) { favSet[id] = 1; });
  var checks = store.get('checks', {});
  var stepsDone = store.get('steps', {});
  var listItems = store.get('list', []);
  var scale = 1;

  var scaleText = (window.SCALE && window.SCALE.scaleText) || function (t) { return esc(t); };

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2100);
  }

  /* ---------- favourites ---------- */
  function isFav(id) { return !!favSet[id]; }
  function toggleFav(id) {
    if (favSet[id]) delete favSet[id]; else favSet[id] = 1;
    store.set('favs', Object.keys(favSet));
    syncFavs(); updateBadges();
    return isFav(id);
  }
  function syncFavs(root) {
    $$('[data-fav]', root).forEach(function (b) {
      var on = isFav(b.getAttribute('data-fav'));
      b.textContent = on ? '❤️' : '🤍';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('[data-favbtn]', root).forEach(function (b) {
      var on = isFav(b.getAttribute('data-favbtn'));
      b.innerHTML = '<span class="i">' + (on ? '❤️' : '🤍') + '</span> ' + (on ? 'Saved' : 'Save');
    });
  }
  function updateBadges() {
    var fb = $('[data-tab="fav"] .badge'), n = Object.keys(favSet).length;
    if (fb) { fb.textContent = n; fb.classList.toggle('hidden', !n); }
    var lb = $('[data-tab="list"] .badge');
    if (lb) { lb.textContent = listItems.length; lb.classList.toggle('hidden', !listItems.length); }
  }

  /* ---------- search index, read straight out of the rendered book ---------- */
  var INDEX = null;
  function buildIndex() {
    if (INDEX) return INDEX;
    INDEX = $$('.view.recipe').map(function (s) {
      var pick = function (sel) { var e = $(sel, s); return e ? e.textContent : ''; };
      var ing = $$('.ilist span[data-raw]', s).map(function (x) { return x.getAttribute('data-raw'); }).join(' ');
      var title = pick('.rtitle');
      return {
        id: s.id.slice(2), title: title,
        hay: (title + ' ' + pick('.rtags') + ' ' + pick('.rblurb') + ' ' + ing).toLowerCase()
      };
    });
    return INDEX;
  }
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    return buildIndex().map(function (r) {
      var sc = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (r.title.toLowerCase().indexOf(w) >= 0) sc += 10;
        else if (r.hay.indexOf(w) >= 0) sc += 2;
        else return null;
      }
      return { r: r, sc: sc };
    }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).map(function (x) { return x.r; });
  }

  /* ---------- build a results grid by cloning the real cards ---------- */
  var CARDS = null;
  function cardFor(id) {
    if (!CARDS) {
      CARDS = {};
      $$('.rcard[data-id]').forEach(function (c) {
        var k = c.getAttribute('data-id');
        if (!CARDS[k]) CARDS[k] = c;
      });
    }
    return CARDS[id] ? CARDS[id].cloneNode(true) : null;
  }
  var PAGE = 40;
  function fillGrid(host, ids, shown) {
    host.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'rgrid';
    ids.slice(0, shown).forEach(function (id) {
      var c = cardFor(id);
      if (c) grid.appendChild(c);
    });
    host.appendChild(grid);
    if (ids.length > shown) {
      var wrap = document.createElement('div');
      wrap.className = 'actions';
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.marginTop = '16px';
      wrap.innerHTML = '<button class="act" data-more>Show ' +
        Math.min(PAGE, ids.length - shown) + ' more (' + (ids.length - shown) + ' left)</button>';
      host.appendChild(wrap);
    }
    syncFavs(host);
  }

  /* ---------- the three script-only views ---------- */
  var FILTERS = [
    { k: 'all', label: 'Everything', fn: function () { return true; } },
    { k: 'quick', label: '⏱ 30 min or less', fn: function (id) { return mins(id) > 0 && mins(id) <= 30; } },
    { k: 'easy', label: '👌 Easy', fn: function (id) { return diff(id) === 'Easy'; } },
    { k: 'fancy', label: '✨ Impressive', fn: function (id) { return diff(id) === 'Advanced'; } },
    { k: 'fav', label: '❤️ Favorites', fn: function (id) { return isFav(id); } }
  ];
  var filter = 'all', shownSearch = PAGE, shownFav = PAGE;

  var META = null;
  function meta(id) {
    if (!META) {
      META = {};
      $$('.view.recipe').forEach(function (s) {
        var v = $$('.metagrid .v', s);
        var d = $('.rtags .diff', s);
        META[s.id.slice(2)] = {
          total: v[2] ? v[2].textContent : '',
          diff: d ? d.textContent.trim() : ''
        };
      });
    }
    return META[id] || {};
  }
  function mins(id) {
    var t = String(meta(id).total || '').toLowerCase(), m = 0;
    var h = t.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/); if (h) m += parseFloat(h[1]) * 60;
    var mm = t.match(/(\d+)\s*min/); if (mm) m += parseInt(mm[1], 10);
    return m;
  }
  function diff(id) { return meta(id).diff || ''; }

  function renderSearch() {
    var host = $('#search'); if (!host) return;
    var q = ($('#q') || {}).value || '';
    var base = q.trim() ? search(q).map(function (r) { return r.id; })
      : buildIndex().map(function (r) { return r.id; });
    var f = FILTERS.filter(function (x) { return x.k === filter; })[0] || FILTERS[0];
    var ids = base.filter(f.fn);

    host.innerHTML = '<h2 class="h first">Search</h2><p class="sub">' +
      (q.trim() ? ids.length + ' result' + (ids.length === 1 ? '' : 's') + ' for “' + esc(q.trim()) + '”'
        : 'Type above — dish names, ingredients, anything. Or just browse:') + '</p>' +
      '<div class="chips">' + FILTERS.map(function (x) {
        return '<button class="chip' + (x.k === filter ? ' on' : '') + '" data-filter="' + x.k + '">' + x.label + '</button>';
      }).join('') + '</div><div data-results></div>';

    if (!ids.length) {
      $('[data-results]', host).innerHTML =
        '<div class="empty"><span class="big">🔍</span>' +
        (q.trim() ? 'Nothing matched that.<br>Try “garlic”, “shrimp”, or “chicken”.' : 'Nothing here yet.') + '</div>';
    } else {
      fillGrid($('[data-results]', host), ids, shownSearch);
    }
  }

  function renderFav() {
    var host = $('#fav'); if (!host) return;
    var ids = buildIndex().map(function (r) { return r.id; }).filter(isFav);
    host.innerHTML = '<h2 class="h first">❤️ Favorites</h2>' +
      (ids.length ? '<p class="sub">' + ids.length + ' saved.</p><div data-results></div>'
        : '<div class="empty"><span class="big">🤍</span>No favorites yet.<br>Tap the heart on any recipe to save it here.</div>');
    if (ids.length) fillGrid($('[data-results]', host), ids, shownFav);
  }

  function renderList() {
    var host = $('#list'); if (!host) return;
    var groups = {};
    listItems.forEach(function (it) { (groups[it.rid] = groups[it.rid] || []).push(it); });
    var keys = Object.keys(groups);
    if (!keys.length) {
      host.innerHTML = '<h2 class="h first">🧺 Shopping list</h2>' +
        '<div class="empty"><span class="big">🧺</span>Your list is empty.<br>Open a recipe and tap <b>Add to shopping list</b>.</div>';
      return;
    }
    host.innerHTML = '<h2 class="h first">🧺 Shopping list</h2>' +
      '<p class="sub">' + listItems.length + ' items. Tap an item to cross it off.</p>' +
      keys.map(function (rid) {
        var t = $('#r-' + rid + ' .rtitle');
        return '<div class="slgroup"><header><div class="t">' + esc(t ? t.textContent : 'Recipe') + '</div>' +
          '<button data-rmgroup="' + esc(rid) + '" aria-label="Remove these items">✕</button></header>' +
          '<ul class="ilist">' + groups[rid].map(function (it) {
            return '<li><label><input type="checkbox" data-slcheck="' + esc(it.rid) + '|' + esc(it.text) + '"' +
              (it.done ? ' checked' : '') + '><span>' + esc(it.text) + '</span></label></li>';
          }).join('') + '</ul></div>';
      }).join('') +
      '<div class="actions" style="grid-template-columns:1fr"><button class="act" data-clearlist>Clear the whole list</button></div>';
  }

  /* ---------- per-recipe enhancement, applied the first time it is opened ---------- */
  function enhanceRecipe(sec) {
    if (!sec || sec.getAttribute('data-enh')) return;
    sec.setAttribute('data-enh', '1');
    var id = sec.id.slice(2);

    // restore ticked ingredients
    var ck = checks[id] || [];
    $$('.ilist input[type=checkbox]', sec).forEach(function (input, i) {
      input.setAttribute('data-ing', i);
      if (ck.indexOf(String(i)) >= 0) input.checked = true;
    });

    // timers pulled out of the step text
    var done = stepsDone[id] || [];
    $$('.steps li', sec).forEach(function (li, i) {
      if (done.indexOf(i) >= 0) li.classList.add('done');
      var tx = $('.sx', li);
      var secs = tx ? timerFor(tx.textContent) : 0;
      if (secs) {
        var b = document.createElement('button');
        b.className = 'timerbtn';
        b.setAttribute('data-timer', secs);
        b.textContent = '⏱ Start ' + fmtClock(secs) + ' timer';
        li.appendChild(b);
      }
    });
    syncFavs(sec);
    updateProgress(sec);
  }

  function updateProgress(sec) {
    var bar = $('[data-prog]', sec), txt = $('[data-progtxt]', sec);
    if (!bar) return;
    var all = $$('.steps li', sec), d = $$('.steps li.done', sec).length;
    bar.style.width = (all.length ? Math.round(d / all.length * 100) : 0) + '%';
    if (txt) txt.textContent = d + ' of ' + all.length + ' steps done';
  }

  /* ---------- timers (wall-clock, so a backgrounded tab cannot stall them) ---------- */
  function timerFor(text) {
    var m = String(text).match(/(\d+)(?:\s*(?:–|—|-|to)\s*\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return 0;
    var n = parseInt(m[1], 10), u = m[2].toLowerCase();
    if (!n) return 0;
    var s = /^h/.test(u) ? n * 3600 : /^m/.test(u) ? n * 60 : n;
    return (s < 20 || s > 4 * 3600) ? 0 : s;
  }
  function fmtClock(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return h ? h + ':' + p(m) + ':' + p(sec) : m + ':' + p(sec);
  }
  var activeTimer = null;
  function resetBtn(btn, secs) { btn.classList.remove('running'); btn.textContent = '⏱ Start ' + fmtClock(secs) + ' timer'; }
  function stopTimer() {
    if (!activeTimer) return;
    clearInterval(activeTimer.iv); resetBtn(activeTimer.btn, activeTimer.secs); activeTimer = null;
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
    var same = activeTimer && activeTimer.btn === btn;
    var replacing = activeTimer && !same;
    stopTimer();
    if (same) return;
    btn.classList.add('running');
    activeTimer = { btn: btn, secs: secs, endsAt: Date.now() + secs * 1000, iv: 0 };
    activeTimer.iv = setInterval(paintTimer, 500);
    paintTimer();
    if (replacing) toast('Timer replaced — one at a time');
  }
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
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .3);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) { } }, 1600);
    } catch (e) { }
  }

  /* ---------- cook mode ---------- */
  var wakeLock = null;
  function requestWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }, function () { });
      }
    } catch (e) { }
  }
  function cookOn() {
    html.classList.add('cook');
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
    html.classList.remove('cook');
    var b = $('.cookexit'); if (b) b.remove();
    if (wakeLock) { try { wakeLock.release(); } catch (e) { } wakeLock = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (html.classList.contains('cook')) requestWake();
    paintTimer();
  });

  /* ---------- routing is CSS; this only keeps the chrome in step ---------- */
  function currentView() {
    var h = location.hash;
    if (!h || h.length < 2) return null;
    var el;
    try { el = document.getElementById(h.slice(1)); } catch (e) { return null; }
    return el && el.classList.contains('view') ? el : null;
  }
  function onRoute() {
    var v = currentView();
    html.classList.toggle('nohash', !v);
    if (location.hash) { var c = $('#cover'); if (c) c.classList.add('gone'); }
    cookOff();
    stopTimer();

    var name = null;
    if (v) {
      if (v.id === 'search') { name = 'search'; renderSearch(); }
      else if (v.id === 'fav') { name = 'fav'; renderFav(); }
      else if (v.id === 'list') { name = 'list'; renderList(); }
      else if (v.classList.contains('recipe')) { enhanceRecipe(v); }
      else { name = 'home'; }
    } else { name = 'home'; }

    $$('.tabbar a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-tab') === name);
    });
    var sb = $('.search');
    if (sb) sb.classList.toggle('hidden', name !== 'search');
    if (name === 'search') setTimeout(function () { var i = $('#q'); if (i) i.focus(); }, 60);
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var fav = t.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      var on = toggleFav(fav.getAttribute('data-fav'));
      toast(on ? 'Saved to favorites ❤️' : 'Removed from favorites');
      return;
    }
    var fb = t.closest('[data-favbtn]');
    if (fb) {
      var on2 = toggleFav(fb.getAttribute('data-favbtn'));
      toast(on2 ? 'Saved to favorites ❤️' : 'Removed from favorites');
      return;
    }
    if (t.closest('#openBtn')) { var c = $('#cover'); if (c) c.classList.add('gone'); return; }
    if (t.closest('[data-cook]')) { cookOn(); return; }

    if (t.closest('[data-random]')) {
      var all = buildIndex();
      if (all.length) location.hash = '#r-' + all[Math.floor(Math.random() * all.length)].id;
      return;
    }

    var fl = t.closest('[data-filter]');
    if (fl) { filter = fl.getAttribute('data-filter'); shownSearch = PAGE; renderSearch(); return; }

    if (t.closest('[data-more]')) {
      var y = window.pageYOffset;
      if (location.hash === '#fav') { shownFav += PAGE; renderFav(); }
      else { shownSearch += PAGE; renderSearch(); }
      window.scrollTo(0, y);
      return;
    }

    var sc = t.closest('[data-scale]');
    if (sc) {
      var sec = sc.closest('.view.recipe');
      scale = parseFloat(sc.getAttribute('data-scale'));
      $$('[data-scale]', sec).forEach(function (b) {
        b.classList.toggle('on', parseFloat(b.getAttribute('data-scale')) === scale);
      });
      $$('.ilist span[data-raw]', sec).forEach(function (s) {
        s.innerHTML = scaleText(s.getAttribute('data-raw'), scale);
      });
      return;
    }

    var tm = t.closest('[data-timer]');
    if (tm) { e.preventDefault(); startTimer(tm, parseInt(tm.getAttribute('data-timer'), 10)); return; }

    var step = t.closest('.steps li');
    if (step && !t.closest('[data-timer]')) {
      var sect = step.closest('.view.recipe');
      var rid = sect.id.slice(2), idx = parseInt(step.getAttribute('data-step'), 10);
      var arr = stepsDone[rid] || [], at = arr.indexOf(idx);
      if (at >= 0) { arr.splice(at, 1); step.classList.remove('done'); }
      else { arr.push(idx); step.classList.add('done'); }
      stepsDone[rid] = arr; store.set('steps', stepsDone);
      updateProgress(sect);
      return;
    }
    if (t.closest('[data-resetsteps]')) {
      var s2 = t.closest('.view.recipe');
      stepsDone[s2.id.slice(2)] = []; store.set('steps', stepsDone);
      $$('.steps li', s2).forEach(function (li) { li.classList.remove('done'); });
      updateProgress(s2);
      return;
    }

    var al = t.closest('[data-addlist]');
    if (al) {
      var rid2 = al.getAttribute('data-addlist');
      var sec2 = $('#r-' + rid2);
      var added = 0;
      $$('.ilist span[data-raw]', sec2).forEach(function (sp) {
        var txt = scale === 1 ? sp.getAttribute('data-raw') : sp.textContent.trim();
        var dup = listItems.some(function (x) { return x.rid === rid2 && x.text === txt; });
        if (!dup) { listItems.push({ rid: rid2, text: txt }); added++; }
      });
      store.set('list', listItems); updateBadges();
      toast(added ? added + ' items added to your list 🧺' : 'Already on your list');
      return;
    }
    var rg = t.closest('[data-rmgroup]');
    if (rg) {
      var g = rg.getAttribute('data-rmgroup');
      listItems = listItems.filter(function (x) { return x.rid !== g; });
      store.set('list', listItems); updateBadges(); renderList();
      return;
    }
    if (t.closest('[data-clearlist]')) {
      listItems = []; store.set('list', listItems); updateBadges(); renderList(); toast('List cleared');
      return;
    }
    if (t.closest('#themeBtn')) {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      return;
    }
  }

  function onChange(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var sl = t.closest('[data-slcheck]');
    if (sl) {
      var parts = sl.getAttribute('data-slcheck').split('|');
      var rid = parts[0], text = parts.slice(1).join('|');
      listItems.forEach(function (x) { if (x.rid === rid && x.text === text) x.done = sl.checked; });
      store.set('list', listItems);
      return;
    }
    var ing = t.closest('[data-ing]');
    if (ing) {
      var sec = ing.closest('.view.recipe');
      if (!sec) return;
      var id = sec.id.slice(2), key = ing.getAttribute('data-ing');
      var arr = checks[id] || [], at = arr.indexOf(key);
      if (ing.checked && at < 0) arr.push(key);
      if (!ing.checked && at >= 0) arr.splice(at, 1);
      checks[id] = arr; store.set('checks', checks);
    }
  }

  function applyTheme(t) {
    html.setAttribute('data-theme', t);
    var b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
    store.set('theme', t);
  }

  /* ---------- boot ---------- */
  function boot() {
    applyTheme(html.getAttribute('data-theme') || 'light');
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    window.addEventListener('hashchange', onRoute);

    var q = $('#q'), qt;
    if (q) {
      q.addEventListener('input', function () {
        clearTimeout(qt);
        qt = setTimeout(function () { shownSearch = PAGE; renderSearch(); }, 130);
      });
    }
    var clr = $('.search .clr');
    if (clr) clr.addEventListener('click', function () {
      if (q) { q.value = ''; q.focus(); }
      shownSearch = PAGE; renderSearch();
    });

    syncFavs(); updateBadges(); onRoute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
