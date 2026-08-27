// =============================================================
// trash.js — nothing is deleted, it is put down somewhere.
//
// WHY THIS EXISTS
// Every delete in this dashboard is a hard delete: the record is
// filtered out of its array and the array is written back. Sixty-six
// call sites do this behind a native confirm(), and confirm() is not
// a safety net — it is a speed bump you learn to click through.
//
// HOW IT WORKS — BY DIFFING, NOT BY BEING CALLED
// Rewriting sixty-six call sites across nine data layers would mean
// nine chances to miss one, and a missed one is invisible until the
// day it matters. So this module does not need to be called at all.
// It watches the collections named in data-registry.js, and when a
// record that was in one a moment ago is no longer there, it keeps a
// copy:
//
//     pal:templates  [A, B, C]  ->  [A, C]
//                       |
//              B has gone missing
//                       v
//     trash:item:k3f9  { key:'pal:templates', value:{...B}, at:… }
//
// Nothing in any data layer changes, no record model gains a field,
// and the Supabase row does not grow by a single byte.
//
// THE PREFIX IS THE WHOLE DESIGN, as with snapshots.js. `trash:` is
// asserted against every synced prefix at boot and THROWS on a
// collision, because a trash can that syncs is a trash can that
// applyRemote can empty.
//
// WHAT IT DELIBERATELY DOES NOT DO
// It does not offer Undo for a deletion that arrived from the cloud.
// That is not your mistake to undo — it already happened on another
// device, and undoing it here would push it back and start a fight
// between two devices. Those are recorded silently and belong to the
// recovery banner instead.
// =============================================================

(function (global) {
  'use strict';

  var PREFIX     = 'trash:';
  var INDEX_KEY  = PREFIX + 'index';
  var ITEM_KEY   = PREFIX + 'item:';
  var KEEP_MS    = 30 * 24 * 60 * 60 * 1000;   // 30 days, then purge
  var MAX_ITEMS  = 500;
  var MAX_BYTES  = 2 * 1024 * 1024;
  var UNDO_MS    = 9000;                       // how long Undo stays offered

  // ------------------------------------------------------------
  // RAW STORE — never routed through an app's storeSet(), because that
  // fires the save event this module listens to.
  // ------------------------------------------------------------
  function rawGet(k) {
    try { var v = localStorage.getItem(k); return v == null ? null : v; } catch (e) { return null; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jsonGet(k) {
    var raw = rawGet(k); if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function jsonSet(k, v) { return rawSet(k, JSON.stringify(v)); }

  // ------------------------------------------------------------
  // WHAT COUNTS AS A COLLECTION OF RECORDS
  //
  // Only shapes where "a record went missing" is a meaningful statement:
  //   - an array of objects that each carry an id
  //   - an object map whose values are all objects (today:log by date,
  //     larlog:days by date)
  // A settings object is deliberately excluded: its values are scalars,
  // and dropping a field from one is a preference changing, not a record
  // being deleted. Without that filter, turning a setting off would
  // offer to undo it.
  // ------------------------------------------------------------
  function recordsOf(raw) {
    if (raw == null) return null;
    var v;
    try { v = JSON.parse(raw); } catch (e) { return null; }
    var m, i, r, id;
    if (Array.isArray(v)) {
      if (!v.length) return new Map();
      m = new Map();
      for (i = 0; i < v.length; i++) {
        r = v[i];
        if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
        id = r.id != null ? String(r.id) : null;
        if (id == null) return null;
        m.set(id, { json: JSON.stringify(r), index: i, rec: r });
      }
      return m;
    }
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (!keys.length) return new Map();
      m = new Map();
      for (i = 0; i < keys.length; i++) {
        r = v[keys[i]];
        if (!r || typeof r !== 'object') return null;   // a settings object
        m.set(keys[i], { json: JSON.stringify(r), index: keys[i], rec: r, mapKey: keys[i] });
      }
      return m;
    }
    return null;
  }

  /** A name a person would recognise, or null. */
  function titleOf(rec) {
    if (!rec || typeof rec !== 'object') return null;
    var fields = ['name', 'title', 'label', 'text', 'question', 'heading', 'term', 'word'];
    for (var i = 0; i < fields.length; i++) {
      var v = rec[fields[i]];
      if (typeof v === 'string' && v.trim()) {
        var s = v.trim().replace(/\s+/g, ' ');
        return s.length > 52 ? s.slice(0, 51) + '…' : s;
      }
    }
    return null;
  }

  // ------------------------------------------------------------
  // THE JOURNAL
  // ------------------------------------------------------------
  function readIndex() {
    var a = jsonGet(INDEX_KEY);
    if (!Array.isArray(a)) return [];
    return a.slice().sort(function (x, y) { return (y.at || 0) - (x.at || 0); });
  }
  function writeIndex(a) { jsonSet(INDEX_KEY, a); }

  function prune() {
    var idx = readIndex();
    var cutoff = Date.now() - KEEP_MS;
    var kept = [], bytes = 0;
    for (var i = 0; i < idx.length; i++) {
      var e = idx[i];
      var tooOld  = (e.at || 0) < cutoff;
      var tooMany = kept.length >= MAX_ITEMS;
      var tooBig  = bytes + (e.bytes || 0) > MAX_BYTES && kept.length > 0;
      if (tooOld || tooMany || tooBig) { drop(ITEM_KEY + e.id); continue; }
      bytes += e.bytes || 0;
      kept.push(e);
    }
    if (kept.length !== idx.length) writeIndex(kept);
    return kept;
  }

  /**
   * Put one record in the trash.
   * @param {object} e { key, value, index, appId, label, recordId, title, source }
   * @returns {object|null} the index entry
   */
  function record(e) {
    if (!e || !e.key || e.value == null) return null;
    var at = Date.now();
    var id = at.toString(36) + Math.random().toString(36).slice(2, 6);
    var body = JSON.stringify({
      v: 1, at: at, key: e.key, value: e.value, index: e.index == null ? null : e.index,
      mapKey: e.mapKey == null ? null : e.mapKey
    });
    if (!rawSet(ITEM_KEY + id, body)) return null;
    var entry = {
      id: id, at: at, key: e.key,
      appId: e.appId || null, label: e.label || null,
      recordId: e.recordId == null ? null : String(e.recordId),
      title: e.title || null, source: e.source || 'local',
      // Kept on the entry, not only in the payload, so a bulk undo can put
      // several records back in the right order without reading each one.
      index: e.index == null ? null : e.index,
      bytes: body.length
    };
    var idx = readIndex();
    idx.unshift(entry);
    writeIndex(idx);
    prune();
    return entry;
  }

  function get(id) {
    var o = jsonGet(ITEM_KEY + id);
    return o && o.key ? o : null;
  }

  function list(opts) {
    var idx = prune();
    if (opts && opts.appId) idx = idx.filter(function (e) { return e.appId === opts.appId; });
    return idx;
  }

  function purge(id) {
    drop(ITEM_KEY + id);
    writeIndex(readIndex().filter(function (e) { return e.id !== id; }));
  }

  /**
   * Put a record back where it came from.
   *
   * The write goes through the PATCHED localStorage.setItem on purpose, so
   * sync.js marks the key dirty and pushes it. A restore that only repaired
   * this device would be undone by the next pull.
   */
  function restore(id) {
    var item = get(id);
    if (!item) return { ok: false, reason: 'gone' };
    var raw = rawGet(item.key);
    var current = null;
    if (raw != null) { try { current = JSON.parse(raw); } catch (e) { current = null; } }

    if (item.mapKey != null) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) current = {};
      current[item.mapKey] = item.value;
    } else {
      if (!Array.isArray(current)) current = [];
      var rid = item.value && item.value.id != null ? String(item.value.id) : null;
      // Already back — restoring twice must not duplicate it.
      var here = rid != null && current.some(function (r) {
        return r && r.id != null && String(r.id) === rid;
      });
      if (here) { purge(id); return { ok: true, already: true, key: item.key }; }
      var at = typeof item.index === 'number' ? Math.min(item.index, current.length) : current.length;
      current.splice(at, 0, item.value);
    }
    try { localStorage.setItem(item.key, JSON.stringify(current)); }
    catch (e) { return { ok: false, reason: 'write' }; }
    purge(id);
    // The watcher's picture of this collection is now one record out of date,
    // and nothing else will correct it: this write goes through setItem
    // without firing the app's save event. Left stale, the restored record
    // would be absent from `prev`, and deleting it a SECOND time would not be
    // captured at all — the one record you have already shown you might
    // delete by accident would be the one with no copy.
    refreshKey(item.key);
    return { ok: true, key: item.key };
  }

  function stats() {
    var idx = readIndex(), bytes = 0;
    idx.forEach(function (e) { bytes += e.bytes || 0; });
    return { count: idx.length, bytes: bytes, newest: idx.length ? idx[0].at : 0, keepMs: KEEP_MS };
  }

  // ============================================================
  // THE TOAST
  //
  // Nine apps, nine palettes — gold, pink, crimson, near-black. So this
  // commits to NO hue: a warm near-black surface, white type, a white
  // hairline. A component with an accent colour would clash on eight
  // pages out of nine.
  //
  // It also does not vanish when the undo window closes. It DEMOTES: the
  // button is replaced by where the record actually went. That is the
  // honest end of this interaction — the window closed, the record did
  // not go anywhere — and it is the one thing this toast does that no
  // other toast in the repo does.
  // ============================================================
  var CSS = [
    '.trsh-wrap{position:fixed;z-index:99998;left:16px;bottom:16px;display:flex;',
      'flex-direction:column;gap:8px;pointer-events:none;max-width:min(360px,calc(100vw - 32px))}',
    '@media (max-width:719px){.trsh-wrap{left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom,0px));max-width:none}}',
    '.trsh{pointer-events:auto;position:relative;overflow:hidden;border-radius:12px;',
      'background:rgba(18,17,16,.94);border:1px solid rgba(255,255,255,.14);',
      'box-shadow:0 12px 32px -10px rgba(0,0,0,.7),0 2px 8px -2px rgba(0,0,0,.5);',
      '-webkit-backdrop-filter:blur(14px) saturate(1.1);backdrop-filter:blur(14px) saturate(1.1);',
      'padding:11px 13px 12px;display:flex;align-items:center;gap:12px;',
      'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
      'color:#F2EFEA;opacity:0;transform:translateY(10px) scale(.98);',
      'transition:opacity .32s cubic-bezier(.2,.8,.3,1),transform .32s cubic-bezier(.2,.8,.3,1)}',
    '.trsh.is-in{opacity:1;transform:none}',
    '.trsh.is-out{opacity:0;transform:translateY(6px) scale(.99)}',
    '.trsh-body{min-width:0;flex:1}',
    '.trsh-eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;',
      'color:rgba(242,239,234,.5);margin:0 0 3px;font-weight:600}',
    '.trsh-title{font-size:14.5px;line-height:1.35;margin:0;font-weight:500;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.trsh-act{flex:none;min-height:36px;padding:0 14px;border-radius:8px;cursor:pointer;',
      'background:transparent;color:#F2EFEA;border:1px solid rgba(255,255,255,.3);',
      'font:inherit;font-size:13px;font-weight:600;letter-spacing:.01em;',
      'transition:background-color .18s ease,color .18s ease,border-color .18s ease}',
    '.trsh-act:hover{background:#F2EFEA;color:#121110;border-color:#F2EFEA}',
    '.trsh-act:active{transform:translateY(1px)}',
    '.trsh-act:focus-visible{outline:2px solid #F2EFEA;outline-offset:2px}',
    // The demoted state: no longer an action, just where it went.
    '.trsh-kept{flex:none;font-size:11px;letter-spacing:.06em;text-transform:uppercase;',
      'color:rgba(242,239,234,.45);font-weight:600}',
    // The undo window, running out. White, because a coloured one would
    // pick a side among nine themes.
    '.trsh-bar{position:absolute;left:0;bottom:0;height:1.5px;width:100%;',
      'background:rgba(255,255,255,.22);transform-origin:left center;transform:scaleX(1)}',
    '.trsh-bar.is-running{transition:transform linear;transform:scaleX(0)}',
    '@media (prefers-reduced-motion:reduce){',
      '.trsh{transition:none;opacity:1;transform:none}',
      '.trsh.is-out{opacity:0}',
      '.trsh-bar{display:none}}',
    // Tap targets: a phone needs 44px even though the visual box is 36.
    '@media (pointer:coarse){.trsh-act{min-height:44px;padding:0 16px}}'
  ].join('');

  var wrap = null, styled = false;

  function ensureWrap() {
    if (!styled) {
      try {
        var s = document.createElement('style');
        s.setAttribute('data-trsh', '');
        s.textContent = CSS;
        document.head.appendChild(s);
        styled = true;
      } catch (e) { return null; }
    }
    // save-state.js owns the shared bottom-left rail. Drawing into the same
    // container is what guarantees the status chip and these toasts can never
    // sit on top of each other — the chip takes `order:99` so it stays at the
    // bottom and toasts stack above it. Falls back to its own container so
    // trash.js still works on a page without save-state.js.
    if (global.SaveState && global.SaveState.rail) {
      var shared = global.SaveState.rail();
      if (shared) { wrap = shared; return wrap; }
    }
    if (!wrap || !wrap.isConnected) {
      wrap = document.createElement('div');
      wrap.className = 'trsh-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function reduceMotion() {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  /**
   * @param {object} o { eyebrow, title, onUndo }
   */
  function toast(o) {
    var host = ensureWrap();
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'trsh';
    el.innerHTML =
      '<div class="trsh-body">' +
        (o.eyebrow ? '<p class="trsh-eyebrow">' + esc(o.eyebrow) + '</p>' : '') +
        '<p class="trsh-title">' + esc(o.title) + '</p>' +
      '</div>' +
      '<button type="button" class="trsh-act">Undo</button>' +
      '<span class="trsh-bar"></span>';
    host.appendChild(el);

    var btn = el.querySelector('.trsh-act');
    var bar = el.querySelector('.trsh-bar');
    var done = false;

    function leave() {
      el.classList.add('is-out');
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 340);
    }
    /* The window closed, and the record did not go anywhere. Saying so is
       more use than a toast that simply vanishes and leaves you wondering. */
    function demote() {
      if (done) return;
      done = true;
      var kept = document.createElement('span');
      kept.className = 'trsh-kept';
      kept.textContent = 'In Trash';
      btn.replaceWith(kept);
      setTimeout(leave, 1900);
    }

    btn.addEventListener('click', function () {
      if (done) return;
      done = true;
      try { o.onUndo(); } catch (e) {}
      leave();
    });

    requestAnimationFrame(function () {
      el.classList.add('is-in');
      if (!reduceMotion()) {
        bar.style.transitionDuration = UNDO_MS + 'ms';
        requestAnimationFrame(function () { bar.classList.add('is-running'); });
      }
    });
    setTimeout(demote, UNDO_MS);
  }

  // ============================================================
  // THE WATCHER
  // ============================================================
  var prev = {};          // key -> Map(recordId -> {json,index,rec})
  var WATCH = [];
  var booted = false;

  function watchedKey(k) {
    if (!k) return false;
    for (var i = 0; i < WATCH.length; i++) if (k.indexOf(WATCH[i]) === 0) return true;
    return false;
  }

  function liveKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (watchedKey(k)) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  /** Re-read one collection into the watcher's baseline. */
  function refreshKey(key) {
    if (!watchedKey(key)) return;
    var m = recordsOf(rawGet(key));
    if (m) prev[key] = m; else delete prev[key];
  }

  function snapshotNow() {
    var out = {};
    liveKeys().forEach(function (k) {
      var m = recordsOf(rawGet(k));
      if (m) out[k] = m;
    });
    return out;
  }

  function labelFor(key) {
    var R = global.DataRegistry;
    if (!R) return null;
    var app = R.appForKey(key);
    if (!app) return null;
    var c = (app.counted || []).filter(function (x) { return x.key === key; })[0];
    return { appId: app.id, label: c ? c.label : null, appLabel: app.label };
  }

  /**
   * One diff pass. `source` is 'local' (your edit, offer Undo) or 'remote'
   * (a cloud pull, record it and stay quiet).
   */
  function sweep(source) {
    // §BASELINE. Before hydration there is no picture to diff against, and
    // sweeping anyway would quietly ADOPT the post-delete state as the
    // baseline — after which the delete can never be noticed at all.
    if (!baselined) return;
    var next = snapshotNow();
    var gone = [];

    Object.keys(prev).forEach(function (key) {
      var before = prev[key];
      var after = next[key];
      // The whole key vanished. That is a wipe, not a record delete, and
      // the snapshot layer is the right tool for it — recording every
      // record individually would fill the trash with one event.
      if (!after) return;
      before.forEach(function (v, id) {
        if (after.has(id)) return;
        gone.push({ key: key, id: id, entry: v });
      });
    });

    prev = next;
    if (!gone.length) return;

    var made = [];
    gone.forEach(function (g) {
      var meta = labelFor(g.key) || {};
      var e = record({
        key: g.key, value: g.entry.rec,
        index: typeof g.entry.index === 'number' ? g.entry.index : null,
        mapKey: g.entry.mapKey == null ? null : g.entry.mapKey,
        appId: meta.appId || null, label: meta.label || null,
        recordId: g.id, title: titleOf(g.entry.rec), source: source
      });
      if (e) made.push(e);
    });

    // A deletion that arrived from another device is not yours to undo.
    // Undoing it here would push it straight back and start an argument
    // between two devices; the recovery banner is where those belong.
    if (source !== 'local' || !made.length) return;

    // One pass can remove several records — a bulk action, or a parent
    // taking its children with it. One toast, one Undo, all of them.
    var first = made[0];
    var label = first.label || 'record';
    var eyebrow = label.toUpperCase();
    var title = made.length === 1
      ? (first.title ? 'Deleted “' + first.title + '”' : 'Deleted one ' + label.replace(/s$/, ''))
      : 'Deleted ' + made.length + ' ' + label;

    toast({
      eyebrow: eyebrow,
      title: title,
      onUndo: function () {
        // ASCENDING index, not reverse. Each restore splices into the array
        // as it stands at that moment, and the insert point is clamped to
        // the current length — so putting the LAST record back first lands
        // it near the front of a still-short array and the order comes out
        // scrambled. Measured: restoring b2..b5 newest-first gave
        // b1,b2,b5,b3,b4. Lowest index first, and each insert lands exactly
        // where it was because everything before it is already back.
        made.slice().sort(function (a, b) {
          var x = typeof a.index === 'number' ? a.index : 0;
          var y = typeof b.index === 'number' ? b.index : 0;
          return x - y;
        }).forEach(function (e) { restore(e.id); });
        try {
          global.dispatchEvent(new CustomEvent('trash:restored', {
            detail: { entries: made, keys: made.map(function (e) { return e.key; }) }
          }));
        } catch (e) {}
      }
    });
  }

  /**
   * Start watching, or widen what is already being watched.
   *
   * Re-entrant on purpose. A page creates its snapshot store inside its own
   * ready()-gated boot(), so there is no single moment when "all the stores
   * exist" — this is called again for each one, adds any new prefixes, and
   * re-reads the baseline for them only. Installing the listeners twice
   * would double every toast, so that part happens once.
   *
   * @param {object} [opts] { prefixes:[…] } to override; otherwise every
   *                        prefix the snapshot stores on this page cover.
   */
  /**
   * Capture the starting picture for everything now being watched, once
   * IndexedDB has actually loaded. Re-entrant: each new store calls it, and
   * only keys with no picture yet are filled in, so an existing baseline is
   * never overwritten by a later store's arrival.
   */
  var baselined = false, baselineQueued = false;
  function baseline() {
    var take = function () {
      prune();
      var fresh = snapshotNow();
      Object.keys(fresh).forEach(function (k) { if (!prev[k]) prev[k] = fresh[k]; });
      baselined = true;
    };
    if (baselined) { take(); return; }
    if (baselineQueued) return;
    baselineQueued = true;
    if (global.LocalStoreIDB && global.LocalStoreIDB.ready) {
      global.LocalStoreIDB.ready().then(take, take);
    } else { take(); }
  }

  function boot(opts) {
    if (global.DataRegistry && global.DataRegistry.assertLocalOnly) {
      global.DataRegistry.assertLocalOnly(PREFIX, 'trash.js');
    }

    var want = [];
    if (opts && opts.prefixes) want = opts.prefixes.slice();
    else if (global.Snapshots && global.Snapshots.stores) {
      global.Snapshots.stores().forEach(function (s) {
        s.WATCHED.forEach(function (p) { if (want.indexOf(p) === -1) want.push(p); });
      });
    }
    var added = false;
    want.forEach(function (p) { if (WATCH.indexOf(p) === -1) { WATCH.push(p); added = true; } });
    if (!WATCH.length) return;

    // Baseline for anything newly watched. Without this the first sweep
    // would see every existing record as "missing from prev" — which is
    // harmless (records are only compared when they were there BEFORE),
    // but the trash would start with an empty picture of a full store.
    //
    // AFTER HYDRATION, NOT BEFORE. This runs off `snapshots:store`, fired
    // from a plain top-level script, and local-store-idb.js answers null to
    // every read until ready() resolves. Taking the baseline there recorded
    // an EMPTY store — and an empty baseline means the opening cloud pull
    // deletes records that, as far as the diff can tell, were never there.
    // Measured on a pull that removed five routines: recorded on two runs
    // out of three, silently missed on the third. The snapshot layer still
    // caught it every time, so nothing was ever lost — but the Trash is
    // supposed to be able to answer "what went", and intermittently it
    // could not.
    if (added) baseline();

    if (booted) return;
    booted = true;

    // The apps' own save events: this device, this reader, right now.
    var events = [];
    if (global.DataRegistry) {
      global.DataRegistry.APPS.forEach(function (a) {
        if (!a.snapshots) return;
        var mine = a.snapshots.watch.some(function (p) { return WATCH.indexOf(p) !== -1; });
        if (!mine) return;
        (a.snapshots.events || []).forEach(function (ev) {
          if (events.indexOf(ev) === -1) events.push(ev);
        });
      });
    }
    events.forEach(function (ev) {
      global.addEventListener(ev, function () { sweep('local'); });
    });

    // Another tab, and this tab's cloud pull. Both are someone else's
    // decision as far as this reader is concerned.
    global.addEventListener('storage', function (e) {
      if (!e.key || watchedKey(e.key)) sweep('remote');
    });
    global.addEventListener('sync:applied', function (e) {
      var d = e && e.detail;
      var keys = d ? (d.written || []).concat(d.removed || []) : [];
      if (!keys.length || keys.some(watchedKey)) sweep('remote');
    });
  }

  // Attach to whatever snapshots.js builds, whenever it builds it. Coalesced
  // to the end of the tick so a page creating two stores boots this once.
  var attachTimer = null;
  global.addEventListener('snapshots:store', function () {
    clearTimeout(attachTimer);
    attachTimer = setTimeout(function () {
      try { boot(); } catch (e) { try { console.error('[trash]', e); } catch (e2) {} }
    }, 0);
  });

  global.Trash = {
    PREFIX: PREFIX,
    boot: boot, record: record, list: list, get: get,
    restore: restore, purge: purge, stats: stats,
    toast: toast,
    /** Exposed for tests and for the recovery page. */
    sweep: sweep,
    watched: function () { return WATCH.slice(); }
  };
})(window);
