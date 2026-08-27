// =============================================================
// shrink-banner.js — "something vanished, and it wasn't you"
//
// WHY THIS EXISTS
// snapshots.js has detected a collection shrinking since the day
// a night of workout routines was destroyed by a bad pull. It
// takes a before-drop snapshot the instant it happens, pins it,
// and then says nothing at all. The rescue has been sitting in
// storage, unmentioned, on every page. This is the sentence that
// finally mentions it.
//
// WHAT IT IS NOT
// It is not conflict resolution. Two devices writing the same row
// is last-writer-wins and this file does not change that. It is a
// receipt: something you did not do removed six routines, here is
// what was there, here is the button that puts it back.
//
// -------------------------------------------------------------
// §WHO — the banner is only for a shrink you did not perform
//
// snapshots.js now attributes every shrink:
//   'local'  your own delete       -> trash.js's Undo toast
//   'tab'    another tab, this device
//   'remote' a cloud pull, another device
// Only the last two get a banner. Showing one for your own delete
// would turn every intentional tidy-up into an alarm, and the
// reader would learn to ignore the thing that matters.
//
// §SURVIVES — a banner you can navigate away from is no banner
//
// The shrink is detected in one tick, in one page, in memory. Click
// a nav link by reflex and the news is gone: the next page boots a
// fresh baseline, sees no shrink, and never mentions it again. So
// the notice is WRITTEN DOWN, under `shrink:`, and re-read on every
// page until it is answered. `shrink:` is asserted local-only for
// the reason every store here is — a record of what the cloud
// deleted cannot live where the cloud can delete it.
//
// §SCOPED — put back the collection, not the app
//
// `Put it back` restores ONLY the keys that shrank, never the whole
// snapshot. One pull can add and remove in the same tick; a full
// rollback to the moment before would silently throw away whatever
// that pull legitimately brought. See snapshots.js's restore(id, only).
//
// §ANSWERED — non-dismissing, but not inescapable
//
// There is no ✕. A notice you can flick away is one you will flick
// away without reading. It clears on a decision instead: restore it,
// or say you meant it. Either way this reader has SEEN it, which is
// the entire point.
// =============================================================

(function (global) {
  'use strict';

  var PREFIX = 'shrink:';
  var KEY = PREFIX + 'open';       // the unanswered notices, by store prefix
  var TTL_MS = 3 * 24 * 60 * 60 * 1000;

  // -----------------------------------------------------------------
  // Storage
  // -----------------------------------------------------------------
  function read() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    // Age out. A notice from last week is not news, and the snapshot it
    // points at has very likely been pruned out from under it by now.
    var now = Date.now(), changed = false;
    Object.keys(o).forEach(function (k) {
      var n = o[k];
      if (!n || typeof n !== 'object' || !n.at || (now - n.at) > TTL_MS) { delete o[k]; changed = true; }
    });
    if (changed) write(o);
    return o;
  }

  function write(o) {
    try {
      if (!o || !Object.keys(o).length) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function note(n) {
    var o = read();
    o[n.store] = n;
    write(o);
    // FLUSH. The whole point of writing this down is that it survives the
    // navigation, and the window between a destructive pull and a reflex
    // click on a nav link is about one second. local-store-idb.js commits
    // asynchronously and explicitly does NOT guarantee a write issued at
    // unload — so this one is pushed to IndexedDB immediately rather than
    // left in the queue to be dropped by the very navigation it exists to
    // outlive. Measured: without it the notice vanished on the next page.
    try {
      if (global.LocalStoreIDB && global.LocalStoreIDB.flush) global.LocalStoreIDB.flush(1500);
    } catch (e) {}
  }

  function answer(store) {
    var o = read();
    if (!(store in o)) return;
    delete o[store];
    write(o);
  }

  // -----------------------------------------------------------------
  // Words
  //
  // The count is the whole message. "6 routines" is a fact this reader
  // can check against the page in front of them; "a sync conflict
  // occurred" is a thing that happened to a computer.
  // -----------------------------------------------------------------
  function plural(n, label) {
    var w = String(label || 'item');
    if (n === 1) w = w.replace(/ies$/, 'y').replace(/s$/, '');
    return n + ' ' + w.toLowerCase();
  }

  function lost(shrank) {
    return shrank.map(function (s) {
      return plural((s.before || 0) - (s.after || 0), s.label || s.key.replace(/^[^:]+:/, ''));
    });
  }

  function joinList(parts) {
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] + ' and ' + parts[1];
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  function whenWord(at) {
    var s = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (s < 90) return 'a moment ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' minutes ago';
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? 'an hour ago' : h + ' hours ago';
    var d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : d + ' days ago';
  }

  function sentence(n) {
    var who = n.source === 'tab' ? 'Another tab' : 'A change from another device';
    return who + ' removed ' + joinList(lost(n.shrank || [])) +
           ' from ' + (n.name || 'this app') + ' ' + whenWord(n.at) + '.';
  }

  // -----------------------------------------------------------------
  // THE SURFACE
  //
  // It draws into save-state.js's shared bottom-left rail, at order:-1
  // so it sits above the Undo toasts (0) and the status chip (99).
  // That rail is the one region measured clear on all 24 pages — the
  // top-left is topbar.js's launcher and the bottom-right is three
  // different floating buttons. It is also, by now, simply WHERE this
  // dashboard talks about your data, which is worth more than novelty.
  //
  // It takes the one accent the rest of the rail refuses: amber. The
  // Undo toast is deliberately hueless because it is routine. This is
  // not routine.
  // -----------------------------------------------------------------
  var CSS = [
    '.shrk{pointer-events:auto;order:-1;position:relative;overflow:hidden;',
      'width:min(360px,100%);border-radius:12px;',
      'background:rgba(24,20,14,.96);border:1px solid rgba(227,178,95,.34);',
      'box-shadow:0 14px 36px -10px rgba(0,0,0,.75),0 0 0 1px rgba(227,178,95,.06);',
      '-webkit-backdrop-filter:blur(14px) saturate(1.1);backdrop-filter:blur(14px) saturate(1.1);',
      'padding:12px 14px 13px;',
      'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
      'color:#F2EFEA;opacity:0;transform:translateY(-8px);',
      'transition:opacity .34s cubic-bezier(.2,.8,.3,1),transform .34s cubic-bezier(.2,.8,.3,1)}',
    '.shrk.is-in{opacity:1;transform:none}',
    // A hairline of the accent down the leading edge: enough to read as
    // "attention" at the edge of vision without the whole panel shouting.
    '.shrk::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;',
      'background:linear-gradient(180deg,#E3B25F,rgba(227,178,95,.25))}',
    '.shrk-eyebrow{margin:0 0 4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;',
      'font-weight:600;color:#E3B25F}',
    '.shrk-text{margin:0;font-size:13.5px;line-height:1.45;color:#F2EFEA}',
    '.shrk-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:11px}',
    '.shrk-btn{min-height:34px;padding:0 12px;border-radius:8px;cursor:pointer;',
      'background:transparent;color:#F2EFEA;border:1px solid rgba(255,255,255,.26);',
      'font:inherit;font-size:12.5px;font-weight:600;text-decoration:none;',
      'display:inline-flex;align-items:center;',
      'transition:background-color .18s ease,color .18s ease,border-color .18s ease}',
    '.shrk-btn:hover{background:#F2EFEA;color:#121110;border-color:#F2EFEA}',
    '.shrk-btn:focus-visible{outline:2px solid #F2EFEA;outline-offset:2px}',
    '.shrk-btn.is-go{background:#E3B25F;color:#1A1509;border-color:#E3B25F}',
    '.shrk-btn.is-go:hover{background:#EFC684;border-color:#EFC684;color:#1A1509}',
    '.shrk-keep{margin-left:auto;background:none;border:0;cursor:pointer;font:inherit;',
      'font-size:12px;color:rgba(242,239,234,.5);text-decoration:underline;',
      'text-underline-offset:3px;min-height:34px;padding:0 2px;',
      'transition:color .18s ease}',
    '.shrk-keep:hover{color:rgba(242,239,234,.9)}',
    '.shrk-keep:focus-visible{outline:2px solid #F2EFEA;outline-offset:2px}',
    '.shrk-done{margin:10px 0 0;font-size:12.5px;color:rgba(227,178,95,.9)}',
    // Both queries, not just pointer:coarse. A phone-width viewport is the
    // reliable signal; pointer type is not reported consistently, and a
    // 34px control on a phone is a miss waiting to happen.
    '@media (pointer:coarse),(max-width:719px){.shrk-btn,.shrk-keep{min-height:44px}',
      '.shrk-btn{padding:0 15px}}',
    // On a phone the rail is full-width, so the actions get a row each
    // rather than three cramped boxes fighting over 350px.
    '@media (max-width:719px){.shrk-acts{gap:9px}',
      '.shrk-keep{margin-left:0;flex:1 0 100%}}',
    '@media (prefers-reduced-motion:reduce){.shrk{transition:none;opacity:1;transform:none}}'
  ].join('');

  var styled = false, els = {};

  /**
   * The Recovery Center shows these in a section of its own, with the
   * snapshot they point at listed right underneath. A floating copy of the
   * same notice on top of that would be the page arguing with itself, so
   * that page opts out of the float and keeps the API.
   */
  function inert() {
    try { return document.documentElement.hasAttribute('data-shrink-inline'); }
    catch (e) { return false; }
  }

  function ensureStyle() {
    if (styled) return true;
    try {
      var s = document.createElement('style');
      s.setAttribute('data-shrk', '');
      s.textContent = CSS;
      document.head.appendChild(s);
      styled = true;
    } catch (e) { return false; }
    return true;
  }

  function host() {
    // No <body> yet — see whenReady(). Returning null rather than throwing
    // matters because SaveState.rail() appends to document.body without a
    // guard of its own, so asking it too early takes the whole replay down.
    if (!document.body) return null;
    if (global.SaveState && global.SaveState.rail) {
      var r = global.SaveState.rail();
      if (r) return r;
    }
    // save-state.js is on every page, but a page that somehow lacks it
    // must still be able to deliver this. Losing the notice because the
    // status chip is missing would be the wrong failure by a mile.
    var own = document.getElementById('shrkRail');
    if (!own) {
      own = document.createElement('div');
      own.id = 'shrkRail';
      own.setAttribute('style',
        'position:fixed;z-index:99998;left:16px;bottom:16px;display:flex;' +
        'flex-direction:column;gap:8px;pointer-events:none;max-width:min(360px,calc(100vw - 32px))');
      document.body.appendChild(own);
    }
    return own;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function storeFor(n) {
    var list = (global.Snapshots && global.Snapshots.stores) ? global.Snapshots.stores() : [];
    for (var i = 0; i < list.length; i++) if (list[i].PREFIX === n.store) return list[i];
    return null;
  }

  /**
   * §BELONGS — does this page have any business showing this notice?
   *
   * The news follows the APP it is about, not the page that happened to
   * detect it. A Palaestra shrink is worth saying on every Palaestra page,
   * including the ones that never load a snapshot store; it is noise on
   * The Larder, and a notice that cries wolf on eight unrelated apps is one
   * this reader will stop reading.
   *
   * Note this is deliberately WIDER than storeFor(). A page in the right
   * app but without the store still shows the notice — just without
   * "Put it back", which links to the Recovery Center instead.
   */
  function belongsHere(n) {
    if (storeFor(n)) return true;
    if (!n.appId) return false;
    try {
      var R = global.DataRegistry;
      var here = R && R.appForPage && R.appForPage();
      return !!(here && here.id === n.appId);
    } catch (e) { return false; }
  }

  function render(n) {
    if (inert()) return;
    if (!ensureStyle()) return;
    var h = host();
    if (!h) return;
    if (els[n.store] && els[n.store].isConnected) els[n.store].remove();

    var el = document.createElement('div');
    el.className = 'shrk';
    el.setAttribute('role', 'alert');
    // Deep link so `See what was here` lands on the exact entry rather than
    // on a list of nineteen timestamps with no way to tell them apart.
    var link = 'recovery.html' +
      (n.appId && n.snapshotId ? '#snap=' + encodeURIComponent(n.appId) + ':' + encodeURIComponent(n.snapshotId) : '');
    // Only where the snapshot is actually loaded. On a sibling page that
    // never built the store, "See what was here" is the whole offer — the
    // Recovery Center loads every store and can do the restore properly.
    var canPutBack = !!(n.snapshotId && storeFor(n));

    el.innerHTML =
      '<p class="shrk-eyebrow">Something vanished</p>' +
      '<p class="shrk-text">' + esc(sentence(n)) + '</p>' +
      '<div class="shrk-acts">' +
        (canPutBack ? '<button type="button" class="shrk-btn is-go" data-a="put">Put it back</button>' : '') +
        '<a class="shrk-btn" href="' + esc(link) + '">See what was here</a>' +
        '<button type="button" class="shrk-keep" data-a="keep">Keep the change</button>' +
      '</div>';
    h.appendChild(el);
    els[n.store] = el;
    requestAnimationFrame(function () { el.classList.add('is-in'); });

    el.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-a]') : null;
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'keep') { answer(n.store); dismiss(n.store); return; }
      if (a === 'put') putBack(n, el);
    });
  }

  function dismiss(store) {
    var el = els[store];
    delete els[store];
    if (!el || !el.isConnected) return;
    el.classList.remove('is-in');
    setTimeout(function () { try { el.remove(); } catch (e) {} }, 340);
  }

  /**
   * §SCOPED. Only the collections that shrank, never the whole snapshot.
   * restore() takes its own pre-restore snapshot first, so choosing this
   * by mistake is itself undoable from the Recovery Center.
   */
  function putBack(n, el) {
    var store = storeFor(n);
    if (!store) { say(el, 'That snapshot is not loaded on this page — open the Recovery Center.'); return; }
    var only = (n.shrank || []).map(function (s) { return s.key; });
    var res = store.restore(n.snapshotId, only);
    if (!res || !res.ok) { say(el, 'That snapshot is no longer on this device.'); return; }
    answer(n.store);
    var acts = el.querySelector('.shrk-acts');
    if (acts) acts.remove();
    say(el, 'Put back — ' + joinList(lost(n.shrank || [])) + '. Reload to see it.');
    setTimeout(function () { dismiss(n.store); }, 6000);
    try {
      global.dispatchEvent(new CustomEvent('shrink:restored',
        { detail: { store: n.store, appId: n.appId, keys: res.keys } }));
    } catch (e) {}
  }

  function say(el, text) {
    var p = el.querySelector('.shrk-done');
    if (!p) { p = document.createElement('p'); p.className = 'shrk-done'; el.appendChild(p); }
    p.textContent = text;
  }

  // -----------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------
  var booted = false;

  function boot() {
    if (global.DataRegistry && global.DataRegistry.assertLocalOnly) {
      global.DataRegistry.assertLocalOnly(PREFIX, 'shrink-banner.js');
    }
    if (booted) return;
    booted = true;

    global.addEventListener('snapshots:shrank', function (e) {
      var d = e && e.detail;
      if (!d || !d.shrank || !d.shrank.length) return;
      // §WHO. Your own delete already has an Undo toast; two notices for
      // one action is how a reader learns to read neither.
      if (d.source === 'local') return;
      var n = {
        store: d.store, name: d.name, appId: d.appId || null,
        snapshotId: d.snapshotId, shrank: d.shrank,
        source: d.source || 'remote', at: d.at || Date.now()
      };
      note(n);
      render(n);
    });

    // §SURVIVES. Anything still unanswered from an earlier page, or an
    // earlier session, is shown again — this is the whole reason it is
    // written down rather than held in a variable.
    //
    // AFTER ready(), NOT BEFORE. This runs off `snapshots:store`, which
    // every page fires from a plain top-level script — long before
    // local-store-idb.js has read IndexedDB into its cache. localStorage
    // answers null to everything until then, so replaying here read an
    // empty store and silently concluded there was nothing to say.
    // Measured: the notice vanished the moment you clicked any nav link,
    // which is precisely the failure this store exists to prevent.
    replay();
  }

  /**
   * TWO gates, not one, and the second was easy to miss.
   *
   *  1. IndexedDB hydration. localStorage answers null to everything until
   *     LocalStoreIDB.ready() resolves, so replaying before it read an
   *     empty store and concluded there was nothing to say.
   *
   *  2. A <body> to draw into. These scripts run from <head>, and hydration
   *     is fast enough that ready() regularly resolves while the document
   *     is still parsing — document.body is then null, SaveState.rail()
   *     appends to it without a guard, and the throw took the replay with
   *     it. Measured: the banner appeared on roughly half of page loads,
   *     which is the worst possible failure for a safety net — it looks
   *     like it works.
   */
  function whenReady(fn) {
    var idb = (global.LocalStoreIDB && global.LocalStoreIDB.ready)
      ? global.LocalStoreIDB.ready() : Promise.resolve();
    var dom = new Promise(function (res) {
      if (document.readyState !== 'loading' && document.body) return res();
      document.addEventListener('DOMContentLoaded', function () { res(); }, { once: true });
    });
    Promise.all([idb.catch(function () {}), dom]).then(function () {
      try { fn(); } catch (e) { try { console.error('[shrink]', e); } catch (e2) {} }
    });
  }

  var replayed = false;
  function replay() {
    if (replayed) return;
    replayed = true;
    whenReady(function () {
      var open = read();
      Object.keys(open).forEach(function (k) {
        var n = open[k];
        if (belongsHere(n)) render(n);
      });
    });
  }

  function start() {
    try { boot(); } catch (e) { try { console.error('[shrink]', e); } catch (e2) {} }
  }

  // Snapshot stores are created inside each page's ready()-gated boot, so
  // there is no single moment when "the stores exist". Wait for the first
  // one, coalesced to the end of the tick.
  var t = null;
  global.addEventListener('snapshots:store', function () {
    clearTimeout(t);
    t = setTimeout(start, 0);
  });

  // And a page that builds NO store never fires that event at all — six of
  // the nine apps had no snapshots until this project, and a Palaestra
  // notice still needs replaying if you happen to land on one of their
  // pages. Start on DOM ready regardless; boot() and replay() are both
  // once-only, so whichever path arrives first wins and the other is a
  // no-op.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    setTimeout(start, 0);
  }

  global.ShrinkBanner = {
    PREFIX: PREFIX,
    boot: start,
    /** Every unanswered notice on this device — the Recovery Center reads this. */
    open: function () {
      var o = read();
      return Object.keys(o).map(function (k) { return o[k]; })
        .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    },
    sentence: sentence,
    answer: function (store) { answer(store); dismiss(store); },
    /** Test seam: force a notice without waiting for a pull. */
    _note: note
  };
})(window);
