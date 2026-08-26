/* ===== Kaelie's Recipe Book — progressive enhancement =====
   The book is static HTML built from <details>/<summary>, so every recipe opens
   and reads with no JavaScript and no navigation of any kind. Nothing in this
   file is needed to cook from it. It adds: search, favourites, a shopping list,
   batch scaling, step timers, progress and cook mode. */
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

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('krb:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('krb:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* Stored values can be corrupt or from an older schema; a wrong shape here would
     throw at the top of the script and kill every enhancement while the .js class
     keeps the no-script fallbacks hidden. Coerce, never trust. */
  function asArray(v) { return Array.isArray(v) ? v : []; }
  function asObject(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  var favSet = {};
  asArray(store.get('favs', [])).forEach(function (id) { if (typeof id === 'string') favSet[id] = 1; });
  var checks = asObject(store.get('checks', {}));
  var stepsDone = asObject(store.get('steps', {}));
  var listItems = asArray(store.get('list', [])).filter(function (x) {
    return x && typeof x.rid === 'string' && typeof x.text === 'string';
  });
  var scaleText = (window.SCALE && window.SCALE.scaleText) || function (t) { return esc(t); };

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2100);
  }

  /* ---------- the book, read straight out of the DOM ---------- */
  var RECS = null;
  function recs() {
    if (RECS) return RECS;
    RECS = $$('.rec').map(function (d) {
      var t = $('.recsum .t', d), m = $('.recsum .m', d), df = $('.recsum .diff', d);
      var ing = $$('.ilist span[data-raw]', d).map(function (x) { return x.getAttribute('data-raw'); }).join(' ');
      var tags = $('.rtags', d), blurb = $('.rblurb', d);
      var total = m ? m.textContent : '';
      var mins = 0;
      var h = total.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/); if (h) mins += parseFloat(h[1]) * 60;
      var mm = total.match(/(\d+)\s*min/); if (mm) mins += parseInt(mm[1], 10);
      return {
        el: d, id: d.getAttribute('data-id'),
        title: t ? t.textContent.trim() : '',
        mins: mins, diff: df ? df.textContent.trim() : '',
        hay: ((t ? t.textContent : '') + ' ' + (tags ? tags.textContent : '') + ' ' +
          (blurb ? blurb.textContent : '') + ' ' +
          (d.getAttribute('data-cat') || '').replace(/-/g, ' ') + ' ' + ing).toLowerCase()
      };
    });
    return RECS;
  }
  function byId(id) {
    var all = recs();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
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
    $$('[data-favbtn]', root).forEach(function (b) {
      var on = isFav(b.getAttribute('data-favbtn'));
      b.innerHTML = '<span class="i">' + (on ? '❤️' : '🤍') + '</span> ' + (on ? 'Saved' : 'Save');
    });
    $$('.rec').forEach(function (d) {
      d.classList.toggle('isfav', isFav(d.getAttribute('data-id')));
    });
  }
  function updateBadges() {
    var fb = $('[data-tab="fav"] .badge'), n = Object.keys(favSet).length;
    if (fb) { fb.textContent = n; fb.classList.toggle('hidden', !n); }
    var lb = $('[data-tab="list"] .badge');
    if (lb) { lb.textContent = listItems.length; lb.classList.toggle('hidden', !listItems.length); }
  }

  /* ---------- open a recipe without navigating anywhere ---------- */
  function openRecipe(id) {
    var r = byId(id); if (!r) return;
    closePanel();
    var chap = r.el.closest('.chap');
    if (chap && !chap.open) chap.open = true;
    r.el.open = true;
    setTimeout(function () {
      r.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 60);
  }

  /* ---------- overlay panel ---------- */
  var panel, panelBody, panelTtl;
  var filter = 'all', shown = 40, mode = null;
  var FILTERS = [
    { k: 'all', label: 'Everything', fn: function () { return true; } },
    { k: 'quick', label: '⏱ 30 min or less', fn: function (r) { return r.mins > 0 && r.mins <= 30; } },
    { k: 'easy', label: '👌 Easy', fn: function (r) { return r.diff === 'Easy'; } },
    { k: 'fancy', label: '✨ Impressive', fn: function (r) { return r.diff === 'Advanced'; } },
    { k: 'fav', label: '❤️ Favorites', fn: function (r) { return isFav(r.id); } }
  ];

  /* iOS has historically ignored overflow:hidden on body for touch scrolling, so
     the lock pins the body with position:fixed and restores the scroll position
     on release — the one technique that holds everywhere. */
  var lockedY = -1;
  function lockBody() {
    if (lockedY >= 0) return;
    lockedY = window.pageYOffset || 0;
    var b = document.body;
    b.style.position = 'fixed'; b.style.top = (-lockedY) + 'px';
    b.style.left = '0'; b.style.right = '0'; b.style.width = '100%';
  }
  function unlockBody() {
    if (lockedY < 0) return;
    var b = document.body;
    b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; b.style.width = '';
    window.scrollTo(0, lockedY);
    lockedY = -1;
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true; mode = null;
    unlockBody();
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === 'book'); });
  }
  function openPanel(kind) {
    if (!panel) return;
    mode = kind; shown = 40;
    panel.hidden = false;
    panel.classList.toggle('issearch', kind === 'search');
    lockBody();
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === kind); });
    renderPanel();
    panelBody.scrollTop = 0;
  }

  function resultRow(r) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'resrow';
    row.setAttribute('data-open', r.id);
    var thumb = $('.recsum .thumb svg', r.el);
    var m = $('.recsum .m', r.el);
    row.innerHTML =
      '<span class="thumb">' + (thumb ? thumb.outerHTML : '') + '</span>' +
      '<span class="rowtext"><span class="t">' + esc(r.title) + '</span>' +
      '<span class="m">' + (m ? m.innerHTML : '') + '</span>' +
      '<span class="diff ' + esc(r.diff) + '">' + esc(r.diff) + '</span></span>' +
      (isFav(r.id) ? '<span class="favmark">❤️</span>' : '');
    return row;
  }

  function renderPanel() {
    if (!mode) return;
    var q = (($('#q') || {}).value || '').trim().toLowerCase();
    var list = recs();

    if (mode === 'list') {
      panelTtl.textContent = '🧺 Shopping list';
      renderList();
      return;
    }
    if (mode === 'fav') {
      panelTtl.textContent = '❤️ Favorites';
      var favs = list.filter(function (r) { return isFav(r.id); });
      panelBody.innerHTML = favs.length
        ? '<p class="sub">' + favs.length + ' saved.</p><div data-results></div>'
        : '<div class="empty"><span class="big">🤍</span>No favorites yet.<br>Open a recipe and tap <b>Save</b>.</div>';
      if (favs.length) fillResults($('[data-results]', panelBody), favs);
      return;
    }

    // search
    panelTtl.textContent = '🔍 Search';
    var res = list;
    if (q) {
      var words = q.split(/\s+/);
      res = list.map(function (r) {
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
    var f = FILTERS.filter(function (x) { return x.k === filter; })[0] || FILTERS[0];
    res = res.filter(f.fn);

    panelBody.innerHTML =
      '<p class="sub">' + (q
        ? res.length + ' result' + (res.length === 1 ? '' : 's') + ' for “' + esc(q) + '”'
        : 'Type in the box above — dish names, ingredients, anything.') + '</p>' +
      '<div class="chips">' + FILTERS.map(function (x) {
        return '<button type="button" class="chip' + (x.k === filter ? ' on' : '') + '" data-filter="' + x.k + '">' + x.label + '</button>';
      }).join('') + '</div><div data-results></div>';

    if (!res.length) {
      $('[data-results]', panelBody).innerHTML =
        '<div class="empty"><span class="big">🔍</span>Nothing matched that.<br>Try “garlic”, “shrimp”, or “chicken”.</div>';
    } else {
      fillResults($('[data-results]', panelBody), res);
    }
  }

  function fillResults(host, arr) {
    host.innerHTML = '';
    arr.slice(0, shown).forEach(function (r) { host.appendChild(resultRow(r)); });
    if (arr.length > shown) {
      var w = document.createElement('div');
      w.className = 'actions'; w.style.gridTemplateColumns = '1fr'; w.style.marginTop = '14px';
      w.innerHTML = '<button type="button" class="act" data-more>Show ' +
        Math.min(40, arr.length - shown) + ' more (' + (arr.length - shown) + ' left)</button>';
      host.appendChild(w);
    }
  }

  function renderList() {
    var groups = {};
    listItems.forEach(function (it) { (groups[it.rid] = groups[it.rid] || []).push(it); });
    var keys = Object.keys(groups);
    if (!keys.length) {
      panelBody.innerHTML = '<div class="empty"><span class="big">🧺</span>Your list is empty.<br>Open a recipe and tap <b>Add to shopping list</b>.</div>';
      return;
    }
    panelBody.innerHTML = '<p class="sub">' + listItems.length + ' items. Tap an item to cross it off.</p>' +
      keys.map(function (rid) {
        var r = byId(rid);
        return '<div class="slgroup"><header><div class="t">' + esc(r ? r.title : 'Recipe') + '</div>' +
          '<button type="button" data-rmgroup="' + esc(rid) + '" aria-label="Remove these items">✕</button></header>' +
          '<ul class="ilist">' + groups[rid].map(function (it) {
            return '<li><label><input type="checkbox" data-slcheck="' + esc(it.rid) + '|' + esc(it.text) + '"' +
              (it.done ? ' checked' : '') + '><span>' + esc(it.text) + '</span></label></li>';
          }).join('') + '</ul></div>';
      }).join('') +
      '<div class="actions" style="grid-template-columns:1fr"><button type="button" class="act" data-clearlist>Clear the whole list</button></div>';
  }

  /* ---------- per-recipe enhancement, the first time it is opened ---------- */
  function enhanceRecipe(d) {
    if (!d || d.getAttribute('data-enh')) return;
    d.setAttribute('data-enh', '1');
    var id = d.getAttribute('data-id');

    var ck = checks[id] || [];
    $$('.ilist input[type=checkbox]', d).forEach(function (input, i) {
      input.setAttribute('data-ing', i);
      if (ck.indexOf(String(i)) >= 0) input.checked = true;
    });

    var done = stepsDone[id] || [];
    $$('.steps li', d).forEach(function (li, i) {
      if (done.indexOf(i) >= 0) li.classList.add('done');
      var tx = $('.sx', li);
      var secs = tx ? timerFor(tx.textContent) : 0;
      if (secs) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'timerbtn';
        b.setAttribute('data-timer', secs);
        b.textContent = '⏱ Start ' + fmtClock(secs) + ' timer';
        li.appendChild(b);
      }
    });
    syncFavs(d);
    updateProgress(d);
  }

  function updateProgress(d) {
    var bar = $('[data-prog]', d), txt = $('[data-progtxt]', d);
    if (!bar) return;
    var all = $$('.steps li', d), n = $$('.steps li.done', d).length;
    bar.style.width = (all.length ? Math.round(n / all.length * 100) : 0) + '%';
    if (txt) txt.textContent = n + ' of ' + all.length + ' steps done';
  }

  /* ---------- timers ---------- */
  // The timer follows the FIRST duration in the step. "1 hour and 15 minutes" is
  // one 75-minute duration, not a 60-minute one — but only when the compound is
  // the first thing mentioned; "simmer 20 minutes, then 1 hour and 15" stays 20.
  function timerFor(text) {
    var s = String(text);
    var c = s.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?)\b/i);
    var m = s.match(/(\d+)(?:\s*(?:–|—|-|to)\s*\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
    var secs = 0;
    if (c && (!m || c.index <= m.index)) {
      secs = parseInt(c[1], 10) * 3600 + parseInt(c[2], 10) * 60;
    } else if (m) {
      var n = parseInt(m[1], 10), u = m[2].toLowerCase();
      if (!n) return 0;
      secs = /^h/.test(u) ? n * 3600 : /^m/.test(u) ? n * 60 : n;
    }
    return (secs < 20 || secs > 4 * 3600) ? 0 : secs;
  }
  function fmtClock(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return h ? h + ':' + p(m) + ':' + p(sec) : m + ':' + p(sec);
  }
  var activeTimer = null;
  function resetBtn(b, s) { b.classList.remove('running'); b.textContent = '⏱ Start ' + fmtClock(s) + ' timer'; }
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
  /* iOS only lets audio play from a context that was created or resumed during a
     user tap. Starting a timer IS a tap, so the shared context gets unlocked there —
     otherwise the done-chime minutes later would be silently blocked. */
  var audioCtx = null;
  function unlockAudio() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      if (!audioCtx) audioCtx = new C();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { }
  }
  function startTimer(btn, secs) {
    var same = activeTimer && activeTimer.btn === btn;
    var replacing = activeTimer && !same;
    stopTimer();
    if (same) return;
    unlockAudio();
    btn.classList.add('running');
    activeTimer = { btn: btn, secs: secs, endsAt: Date.now() + secs * 1000, iv: 0 };
    activeTimer.iv = setInterval(paintTimer, 500);
    paintTimer();
    if (replacing) toast('Timer replaced — one at a time');
  }
  function alarm() {
    try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]); } catch (e) { }
    try {
      var ctx = audioCtx;
      if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; ctx = new C(); }
      // iOS suspends the context while the page is hidden; the timer most often
      // expires exactly then, so try to wake it before ringing (vibration is the fallback)
      if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { } }
      [0, .35, .7].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.5, ctx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + t + .28);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .3);
      });
      // never close the shared, gesture-unlocked context — the NEXT timer needs it
      if (ctx !== audioCtx) setTimeout(function () { try { ctx.close(); } catch (e) { } }, 1600);
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
      b.type = 'button'; b.className = 'cookexit'; b.textContent = '✓ Done cooking';
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

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('#openBtn')) {
      var bk = $('#book');
      if (bk) bk.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (t.closest('.brand')) {
      closePanel();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var open = t.closest('[data-open]');
    if (open) { openRecipe(open.getAttribute('data-open')); return; }
    if (t.closest('[data-closepanel]')) { closePanel(); return; }

    var tab = t.closest('[data-tab]');
    if (tab) {
      var k = tab.getAttribute('data-tab');
      if (k === 'book') {
        closePanel();
        var bk = $('#book');
        if (bk) bk.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else {
        openPanel(k);
        if (k === 'search') { var i = $('#q'); if (i) i.focus(); }
      }
      return;
    }

    var fb = t.closest('[data-favbtn]');
    if (fb) {
      var on = toggleFav(fb.getAttribute('data-favbtn'));
      toast(on ? 'Saved to favorites ❤️' : 'Removed from favorites');
      return;
    }
    if (t.closest('[data-cook]')) { cookOn(); return; }

    var fl = t.closest('[data-filter]');
    if (fl) { filter = fl.getAttribute('data-filter'); shown = 40; renderPanel(); return; }
    if (t.closest('[data-more]')) {
      var y = panelBody ? panelBody.scrollTop : 0;
      shown += 40; renderPanel();
      if (panelBody) panelBody.scrollTop = y;
      return;
    }

    var sc = t.closest('[data-scale]');
    if (sc) {
      var d = sc.closest('.rec');
      var s = parseFloat(sc.getAttribute('data-scale'));
      d.setAttribute('data-scalenow', s);
      $$('[data-scale]', d).forEach(function (b) {
        b.classList.toggle('on', parseFloat(b.getAttribute('data-scale')) === s);
      });
      $$('.ilist span[data-raw]', d).forEach(function (sp) {
        sp.innerHTML = scaleText(sp.getAttribute('data-raw'), s);
      });
      return;
    }

    var tm = t.closest('[data-timer]');
    if (tm) { e.preventDefault(); startTimer(tm, parseInt(tm.getAttribute('data-timer'), 10)); return; }

    var step = t.closest('.steps li');
    if (step && !t.closest('[data-timer]')) {
      var dd = step.closest('.rec');
      var rid = dd.getAttribute('data-id'), idx = parseInt(step.getAttribute('data-step'), 10);
      var arr = stepsDone[rid] || [], at = arr.indexOf(idx);
      if (at >= 0) { arr.splice(at, 1); step.classList.remove('done'); }
      else { arr.push(idx); step.classList.add('done'); }
      stepsDone[rid] = arr; store.set('steps', stepsDone);
      updateProgress(dd);
      return;
    }
    if (t.closest('[data-resetsteps]')) {
      var d2 = t.closest('.rec');
      stepsDone[d2.getAttribute('data-id')] = []; store.set('steps', stepsDone);
      $$('.steps li', d2).forEach(function (li) { li.classList.remove('done'); });
      updateProgress(d2);
      return;
    }

    var al = t.closest('[data-addlist]');
    if (al) {
      var rid2 = al.getAttribute('data-addlist');
      var d3 = al.closest('.rec');
      var added = 0, cur = parseFloat(d3.getAttribute('data-scalenow') || '1');
      $$('.ilist span[data-raw]', d3).forEach(function (sp) {
        var txt = cur === 1 ? sp.getAttribute('data-raw') : sp.textContent.trim();
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
      store.set('list', listItems); updateBadges(); renderPanel();
      return;
    }
    if (t.closest('[data-clearlist]')) {
      listItems = []; store.set('list', listItems); updateBadges(); renderPanel(); toast('List cleared');
      return;
    }
    if (t.closest('#themeBtn')) {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
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
      var d = ing.closest('.rec'); if (!d) return;
      var id = d.getAttribute('data-id'), key = ing.getAttribute('data-ing');
      var arr = checks[id] || [], at = arr.indexOf(key);
      if (ing.checked && at < 0) arr.push(key);
      if (!ing.checked && at >= 0) arr.splice(at, 1);
      checks[id] = arr; store.set('checks', checks);
    }
  }

  function applyTheme(t, save) {
    html.setAttribute('data-theme', t);
    var b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
    if (save) store.set('theme', t);   // the auto-sniffed default is not a choice
  }

  /* ---------- boot ---------- */
  function boot() {
    panel = $('#panel');
    panelBody = $('.panelbody', panel);
    panelTtl = $('.panelttl', panel);

    applyTheme(html.getAttribute('data-theme') || 'light');
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);

    // enhance a recipe the moment it is opened, not all 240 up front
    $$('.rec').forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) enhanceRecipe(d); });
    });

    var q = $('#q'), qt;
    if (q) {
      q.addEventListener('input', function () {
        clearTimeout(qt);
        qt = setTimeout(function () { shown = 40; renderPanel(); }, 130);
      });
    }
    var clr = $('.panelsearch .clr');
    if (clr) clr.addEventListener('click', function () {
      if (q) { q.value = ''; q.focus(); }
      shown = 40; renderPanel();
    });

    // recipes can be renamed between builds; drop stored ids that no longer exist
    var known = {};
    $$('.rec').forEach(function (d) { known[d.getAttribute('data-id')] = 1; });
    var pruned = false;
    Object.keys(favSet).forEach(function (id) { if (!known[id]) { delete favSet[id]; pruned = true; } });
    var kept = listItems.filter(function (x) { return known[x.rid]; });
    if (kept.length !== listItems.length) { listItems = kept; pruned = true; }
    if (pruned) { store.set('favs', Object.keys(favSet)); store.set('list', listItems); }

    syncFavs(); updateBadges();
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === 'book'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
