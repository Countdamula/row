// =============================================================
// snapshots.js — one rolling-snapshot engine, configured per app.
//
// WHY THIS EXISTS
// On 2026-08-20 a night's worth of workout routines disappeared.
// The mechanism was not a bug in the app's own writes: sync.js
// deleted every local key the cloud row did not happen to carry,
// could not tell "the cloud deleted this" from "the cloud has never
// heard of this", and pushed the deletion back as truth. That hole
// is closed (sync.js §SEEN), but a cloud row is still a single
// last-writer-wins document shared by every page and every device,
// and one bad push from any of them replaces the lot.
//
// So this is the floor under it: a plain, boring, local copy that
// nothing in the sync path can reach, kept so that "it was there
// yesterday" is an answerable statement rather than a lost argument.
//
// It replaces four near-identical hand-copies — palaestra-backup.js,
// main-backup.js, larder-backup.js and promptarium-backup.js — which
// had already drifted apart in ways that mattered: two of them had
// shrink detection and two did not, one stored its index oldest-first
// and three newest-first, and one wrote a different body format.
// Those four files remain as thin adapters so their existing public
// names and their existing on-disk snapshots keep working.
//
// THE PREFIX IS THE WHOLE DESIGN. A snapshot store must live under a
// prefix that no synced prefix can match, because sync.js matches
// with k.indexOf(prefix) === 0 and applyRemote() deletes local keys
// the incoming row does not carry. `palbak:` does not begin with
// `pal:` — one character away from being the mistake. That is no
// longer checked by eye: create() asserts it against
// DataRegistry.allSyncedPrefixes() and THROWS on a collision, because
// a silently unprotected store is worse than a page that will not boot.
//
// WHAT IT DOES NOT DO. It does not version media (those are hosted
// URLs and outlive the record), it does not merge two divergent
// histories, and it never restores anything on its own. Restoring is
// always the reader's decision.
// =============================================================

(function (global) {
  'use strict';

  var STORES = [];

  // ------------------------------------------------------------
  // RAW STORE
  //
  // Reads and writes go through localStorage like everything else — the
  // IndexedDB shim is what makes them durable — but never through an app's
  // own storeSet(), because that fires the save event this module listens to.
  // ------------------------------------------------------------
  function rawGet(k) {
    try { var v = localStorage.getItem(k); return v == null ? null : v; }
    catch (e) { return null; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jsonGet(k) {
    var raw = rawGet(k);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function jsonSet(k, v) { return rawSet(k, JSON.stringify(v)); }

  /**
   * @param {object} cfg
   * @param {string}   cfg.prefix     e.g. 'palbak:' or 'bak:ath:' — MUST be local-only
   * @param {string[]} cfg.watch      the storage prefixes this store copies
   * @param {string[]} [cfg.events]   CustomEvent names the app fires on save
   * @param {object[]} [cfg.counted]  [{key,label}] shown on a restore card
   * @param {number}   [cfg.maxSnaps=20]
   * @param {number}   [cfg.maxBytes=4MB]
   * @param {number}   [cfg.debounceMs=5000]
   * @param {string}   [cfg.name]     for error messages
   */
  function create(cfg) {
    cfg = cfg || {};
    var NAME       = cfg.name || cfg.prefix || 'snapshots';
    var PREFIX     = cfg.prefix;
    var APP_ID     = cfg.appId || null;
    // NAME is the legacy global ('PalBackup'); LABEL is what a person
    // calls the app ('The Palaestra'). Everything shown to a reader uses
    // LABEL. See the shrink event below.
    var LABEL      = cfg.label || cfg.name || cfg.prefix;
    var WATCHED    = (cfg.watch || []).slice();
    var EVENTS     = (cfg.events || []).slice();
    var COUNTED    = (cfg.counted || []).slice();
    var MAX_SNAPS  = cfg.maxSnaps == null ? 20 : cfg.maxSnaps;
    var MAX_BYTES  = cfg.maxBytes == null ? 4 * 1024 * 1024 : cfg.maxBytes;
    var DEBOUNCE_MS = cfg.debounceMs == null ? 5000 : cfg.debounceMs;

    if (!PREFIX || !WATCHED.length) {
      throw new Error(NAME + ': snapshots.create needs a prefix and at least one watched prefix');
    }
    // The one rule this whole module rests on. Throws on a collision.
    if (global.DataRegistry && global.DataRegistry.assertLocalOnly) {
      global.DataRegistry.assertLocalOnly(PREFIX, NAME);
    }
    // A store must also not copy ITSELF: watching a prefix that contains the
    // snapshot prefix would fold every snapshot into the next snapshot and
    // the store would square in size on each write.
    WATCHED.forEach(function (w) {
      if (PREFIX.indexOf(w) === 0) {
        throw new Error(NAME + ': watched prefix "' + w + '" contains the snapshot store "' + PREFIX + '"');
      }
    });

    var INDEX_KEY = PREFIX + 'index';
    var SNAP_KEY  = PREFIX + 'snap:';

    function watched(k) {
      if (!k) return false;
      for (var i = 0; i < WATCHED.length; i++) if (k.indexOf(WATCHED[i]) === 0) return true;
      return false;
    }

    function liveKeys() {
      var out = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (watched(k)) out.push(k);
        }
      } catch (e) {}
      return out.sort();
    }

    // The state as a plain map of key -> raw JSON STRING. Strings, not parsed
    // objects: comparing two snapshots then costs one === rather than a deep
    // walk, and re-serialising a parsed value can reorder keys and invent a
    // difference that is not there.
    function readState() {
      var out = {};
      liveKeys().forEach(function (k) {
        var raw = rawGet(k);
        if (raw != null) out[k] = raw;
      });
      return out;
    }

    // U+0000 and U+0001 as separators: neither can appear in a JSON string,
    // so no combination of key and value can forge a boundary.
    function stateFingerprint(state) {
      var keys = Object.keys(state).sort();
      var s = '';
      for (var i = 0; i < keys.length; i++) s += keys[i] + '\u0000' + state[keys[i]] + '\u0001';
      return s;
    }

    function countsOf(state) {
      var out = {};
      COUNTED.forEach(function (c) {
        var raw = state[c.key];
        if (raw == null) { out[c.key] = 0; return; }
        try {
          var v = JSON.parse(raw);
          out[c.key] = Array.isArray(v) ? v.length
            : (v && typeof v === 'object' ? Object.keys(v).length : 0);
        } catch (e) { out[c.key] = 0; }
      });
      return out;
    }

    // --------------------------------------------------------
    // INDEX
    //
    // Always sorted newest-first on READ rather than trusted to be stored
    // that way. promptarium-backup.js appended (oldest-first) while the
    // other three unshifted (newest-first), and both formats are sitting on
    // the device right now.
    // --------------------------------------------------------
    // `at` is a number on everything written from here on, but
    // promptarium-backup.js wrote an ISO STRING, and subtracting two of
    // those gives NaN — which would leave the index in whatever order it
    // happened to be in and quietly break "newest first".
    function atOf(e) {
      if (!e) return 0;
      if (typeof e.at === 'number') return e.at;
      var t = Date.parse(e.at);
      return isNaN(t) ? 0 : t;
    }

    function readIndex() {
      var a = jsonGet(INDEX_KEY);
      if (!Array.isArray(a)) return [];
      return a.slice().sort(function (x, y) { return atOf(y) - atOf(x); });
    }
    function writeIndex(a) { jsonSet(INDEX_KEY, a); }

    function prune() {
      var idx = readIndex();
      var kept = [], bytes = 0, dropped = false;
      for (var i = 0; i < idx.length; i++) {
        var e = idx[i];
        // A pinned entry — the boot snapshot of the day, a before-drop, a
        // pre-restore, one the reader named — is worth more than the
        // fifteenth keystroke-triggered one, and is never pruned by age.
        var overCount = kept.length >= MAX_SNAPS && !e.pinned;
        var overBytes = bytes + (e.bytes || 0) > MAX_BYTES && kept.length > 0 && !e.pinned;
        if (overCount || overBytes) { drop(SNAP_KEY + e.id); dropped = true; continue; }
        bytes += e.bytes || 0;
        kept.push(e);
      }
      writeIndex(kept);
      return kept;
    }

    // --------------------------------------------------------
    // SNAPSHOT
    // --------------------------------------------------------
    var lastFingerprint = null;

    /**
     * @param {string} reason 'boot'|'change'|'before-drop'|'manual'|'pre-restore'|…
     * @param {object} [opts] { force } snapshot even when nothing changed
     *                        { state } snapshot a state captured earlier
     *                        { pinned } exempt it from age pruning
     *                        { label }  a name the reader gave it
     * @returns {object|null} the index entry, or null if nothing was written.
     */
    function snapshot(reason, opts) {
      opts = opts || {};
      var state = opts.state || readState();
      if (!Object.keys(state).length) {
        // Never snapshot nothing over something. An empty state at boot is
        // either a genuinely new install or a store that has not hydrated
        // yet, and the second would spend the whole ring buffer on twenty
        // copies of nothing — throwing away the only record of what was there.
        return null;
      }
      var fp = stateFingerprint(state);
      if (!opts.force && fp === lastFingerprint) return null;

      var at = Date.now();
      var body = JSON.stringify({ v: 1, at: at, reason: String(reason || 'change'), keys: state });
      var id = at.toString(36) + Math.random().toString(36).slice(2, 6);
      if (!rawSet(SNAP_KEY + id, body)) return null;

      var entry = {
        id: id, at: at, reason: String(reason || 'change'),
        counts: countsOf(state), bytes: body.length, pinned: !!opts.pinned
      };
      if (opts.label) entry.label = String(opts.label);
      var idx = readIndex();
      idx.unshift(entry);
      writeIndex(idx);
      prune();
      lastFingerprint = fp;
      return entry;
    }

    /**
     * Read one snapshot back, normalised.
     *
     * Two body formats exist on devices right now: the {v,at,reason,keys}
     * envelope written by three of the four old modules, and a BARE state map
     * written by main-backup.js. Both must keep restoring, so the shape is
     * decided here rather than at every call site.
     */
    function get(id) {
      var o = jsonGet(SNAP_KEY + id);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      // THREE body formats exist on devices right now, and all three must
      // keep restoring:
      //   {v,at,reason,keys}  — palaestra-backup.js, larder-backup.js
      //   {at,reason,state}   — promptarium-backup.js
      //   a BARE state map    — main-backup.js
      // The shape is decided here rather than at every call site.
      if (o.keys && typeof o.keys === 'object') return o;
      if (o.state && typeof o.state === 'object') {
        return { v: 0, at: atOf(o), reason: o.reason || 'legacy', keys: o.state };
      }
      return { v: 0, at: 0, reason: 'legacy', keys: o };
    }

    function list() { return prune(); }

    function remove(id) {
      drop(SNAP_KEY + id);
      writeIndex(readIndex().filter(function (e) { return e.id !== id; }));
    }

    // --------------------------------------------------------
    // RESTORE
    //
    // Writes go through the PATCHED localStorage.setItem on purpose, so
    // sync.js marks each key dirty and pushes it. A restore that only
    // repaired this device would be undone by the next pull.
    // --------------------------------------------------------
    /**
     * @param {string} id
     * @param {string[]} [only] restore just these keys; omit for all.
     * @returns {{ok:boolean, written:number, removed:number, keys:string[]}}
     */
    function restore(id, only) {
      var snap = get(id);
      if (!snap) return { ok: false, written: 0, removed: 0, keys: [] };
      // The state being replaced is itself worth keeping — picking the wrong
      // snapshot should not be the irreversible step. An undo needs its own undo.
      snapshot('pre-restore', { force: true, pinned: true });

      var scoped = Array.isArray(only) && only.length;
      var want = scoped ? only : Object.keys(snap.keys);
      var written = [], removed = 0;
      want.forEach(function (k) {
        if (!watched(k)) return;
        var raw = snap.keys[k];
        if (typeof raw !== 'string') return;
        try { localStorage.setItem(k, raw); written.push(k); } catch (e) {}
      });
      // A FULL restore also removes keys the snapshot did not have, or a
      // record created after it survives the rollback and the two disagree.
      // A SCOPED restore must not: it is repairing one collection, not
      // rolling the app back.
      if (!scoped) {
        liveKeys().forEach(function (k) {
          if (!(k in snap.keys)) { try { localStorage.removeItem(k); removed++; } catch (e) {} }
        });
      }
      lastFingerprint = null;
      return { ok: true, written: written.length, removed: removed, keys: written };
    }

    // --------------------------------------------------------
    // WATCH
    //
    // Two triggers, and the second is the one that matters:
    //
    //   1. A debounced snapshot after any change, so ordinary editing leaves
    //      a trail without writing a copy per keystroke.
    //   2. An IMMEDIATE snapshot of the state as it was a moment ago whenever
    //      a counted collection SHRINKS. A cloud pull that deletes six
    //      routines is not a slow drift the debounce will catch up with — it
    //      happens in one tick, and by the time a 5s timer fires the thing
    //      worth keeping is gone.
    // --------------------------------------------------------
    var timer = null, watching = false;
    var lastState = null, lastCounts = null;
    var lastDrop = null;

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(function () { timer = null; snapshot('change'); }, DEBOUNCE_MS);
    }

    /**
     * @param {string} source 'local' (this reader, this tab), 'remote' (a cloud
     *        pull) or 'tab' (another tab on this device). It changes nothing
     *        about what is SNAPSHOTTED — a shrink is worth keeping whoever
     *        caused it — but it decides who is told. Your own delete gets
     *        trash.js's Undo toast; a shrink you did not perform gets the
     *        banner, because nothing else on the page would ever mention it.
     */
    function onAnyChange(source) {
      var state = readState();
      var counts = countsOf(state);
      if (lastCounts && lastState) {
        var shrank = [];
        COUNTED.forEach(function (c) {
          var before = lastCounts[c.key] || 0, after = counts[c.key] || 0;
          if (after < before) shrank.push({ key: c.key, label: c.label, before: before, after: after });
        });
        if (shrank.length) {
          // The PREVIOUS state, not the current one. The current one is the damage.
          var entry = snapshot('before-drop', { state: lastState, force: true, pinned: true });
          lastDrop = {
            at: Date.now(), snapshotId: entry ? entry.id : null,
            shrank: shrank, source: source || 'local', appId: APP_ID
          };
          try {
            global.dispatchEvent(new CustomEvent('snapshots:shrank', {
              detail: {
                store: PREFIX, name: LABEL, appId: APP_ID,
                snapshotId: lastDrop.snapshotId, shrank: shrank,
                source: lastDrop.source, at: lastDrop.at
              }
            }));
          } catch (e) {}
        }
      }
      lastState = state;
      lastCounts = counts;
      schedule();
    }

    /** Start watching. Safe to call more than once. */
    function watch() {
      if (watching) return;
      watching = true;
      lastState = readState();
      lastCounts = countsOf(lastState);
      // The app's own save events. Whatever they report, this reader did it.
      EVENTS.forEach(function (ev) {
        global.addEventListener(ev, function () { onAnyChange('local'); });
      });

      // ANOTHER TAB. The shim re-broadcasts writes over a BroadcastChannel
      // and synthesises a storage event from them — but only in the OTHER
      // documents, never the one that posted.
      global.addEventListener('storage', function (e) {
        if (!e.key || watched(e.key)) onAnyChange('tab');
      });

      // THIS TAB'S CLOUD PULL. The four modules this engine replaces all
      // claimed the storage listener above covered applyRemote. It does not:
      // applyRemote writes with the shim's setItem, and a BroadcastChannel
      // is never delivered to the posting context, so a same-tab pull fired
      // nothing at all here. Measured before the fix — a pull deleting five
      // of six routines left NO before-drop snapshot, which is the exact
      // event this store exists to survive. sync.js §ANNOUNCE now says so
      // out loud.
      global.addEventListener('sync:applied', function (e) {
        var d = e && e.detail;
        if (!d) { onAnyChange('remote'); return; }
        var keys = (d.written || []).concat(d.removed || []);
        if (!keys.length || keys.some(watched)) onAnyChange('remote');
      });
    }

    /**
     * The first snapshot of the session, taken BEFORE the opening cloud pull
     * and pinned. This is the one that answers "what did this device hold
     * when I opened it" — the only question worth asking after a bad sync.
     */
    function boot() {
      var e = snapshot('boot', { pinned: true, force: true });
      watch();
      return e;
    }

    function stats() {
      var idx = readIndex(), bytes = 0;
      idx.forEach(function (e) { bytes += e.bytes || 0; });
      return {
        name: NAME, prefix: PREFIX,
        count: idx.length, bytes: bytes,
        newest: idx.length ? atOf(idx[0]) : 0,
        oldest: idx.length ? atOf(idx[idx.length - 1]) : 0
      };
    }

    var store = {
      PREFIX: PREFIX, WATCHED: WATCHED, COUNTED: COUNTED, NAME: NAME,
      boot: boot, watch: watch, snapshot: snapshot,
      list: list, get: get, remove: remove, restore: restore,
      stats: stats, countsOf: countsOf, readState: readState,
      /** The most recent shrink this store saw, for the recovery banner. */
      lastShrink: function () { return lastDrop; },
      clearShrink: function () { lastDrop = null; }
    };
    STORES.push(store);
    // Announce it so trash.js can attach to the same prefixes without every
    // page having to wire the two together in the right order.
    try {
      global.dispatchEvent(new CustomEvent('snapshots:store', {
        detail: { prefix: PREFIX, watch: WATCHED.slice(), appId: cfg.appId || null }
      }));
    } catch (e) {}
    return store;
  }

  // ------------------------------------------------------------
  // forApp — the normal way to get a store.
  //
  // Reads the app's row from data-registry.js, so a page never repeats a
  // prefix list and a new app is one table entry rather than a new file.
  // Idempotent: two callers on one page share one store, because two stores
  // over the same prefix would each snapshot the other's writes.
  // ------------------------------------------------------------
  var byApp = {};
  function forApp(id, overrides) {
    if (byApp[id]) return byApp[id];
    var R = global.DataRegistry;
    var a = R && R.app(id);
    if (!a) throw new Error('snapshots.forApp: no app "' + id + '" in DataRegistry');
    if (!a.snapshots) throw new Error('snapshots.forApp: app "' + id + '" declares no snapshot store');
    var s = a.snapshots;
    var cfg = {
      name: s.global || a.label || id,
      prefix: s.prefix, watch: s.watch, events: s.events, counted: a.counted,
      appId: id, label: a.label || id
    };
    if (overrides) Object.keys(overrides).forEach(function (k) { cfg[k] = overrides[k]; });
    var store = create(cfg);
    store.appId = id;
    store.label = a.label || id;
    byApp[id] = store;
    // The legacy global names (PalBackup, MainBackup, LarBackup,
    // PromptariumBackup) are still what the pages call, so they keep working.
    if (s.global) global[s.global] = store;
    return store;
  }

  global.Snapshots = {
    create: create,
    forApp: forApp,
    /** Every store created in this document. recovery.html reads this. */
    stores: function () { return STORES.slice(); },
    /** Total bytes across every store, so nine stores cannot quietly fill
        the origin between them and start getting evicted. */
    totalBytes: function () {
      var n = 0;
      STORES.forEach(function (s) { n += s.stats().bytes; });
      return n;
    }
  };
})(window);
