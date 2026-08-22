// =============================================================
// main-backup.js — rolling local snapshots for Main.
//
// The same floor palaestra-backup.js puts under the Fitness Studio,
// put under Main for the same reason: a Supabase row is one
// last-writer-wins document shared by three documents and every
// device, and one bad push from any of them replaces the lot.
//
// This is NOT a second sync and NOT a merge. It is a plain, boring,
// local copy that nothing in the sync path can reach, kept so that
// "it was there yesterday" is an answerable statement.
//
// THE PREFIX IS THE WHOLE DESIGN. Snapshots live under `mainbak:`,
// which begins with none of `routine:` / `system:` / `fitness:` /
// `mainselfcare:` / `today:` / `wr:` / `pal:` / `fs:`. Check that
// character by character before changing either string. sync.js
// matches with k.indexOf(prefix) === 0, so `mainbak:index` is
// invisible to it: never collected, never pushed, never deleted by
// applyRemote, never counted against a row's size. A snapshot store
// riding inside a synced prefix would be destroyed by exactly the
// event it exists to survive. main-sync.js asserts this at mount.
//
// It never restores anything on its own. Restoring is always the
// reader's decision.
// =============================================================

(function (global) {
  'use strict';

  var PREFIX      = 'mainbak:';
  var INDEX_KEY   = PREFIX + 'index';
  var SNAP_KEY    = PREFIX + 'snap:';
  var MAX_SNAPS   = 20;
  var MAX_BYTES   = 4 * 1024 * 1024;
  var DEBOUNCE_MS = 5000;

  // Everything Main owns or carries. `pal:` is deliberately absent —
  // the Fitness Studio keeps its own snapshots under `palbak:` and two
  // stores copying the same data is how they drift.
  var WATCHED = ['routine:', 'system:', 'fitness:', 'mainselfcare:', 'today:', 'wr:', 'fs:'];

  // The collections worth counting on a restore card, so a snapshot can be
  // identified by what it holds rather than only by when it was taken.
  var COUNTED = [
    { key: 'routine:beliefs',        label: 'beliefs' },
    { key: 'routine:todayEntries',   label: 'today entries' },
    { key: 'routine:tonightEntries', label: 'tonight entries' },
    { key: 'today:routines',         label: 'routine steps' },
    { key: 'mainselfcare:journalEntries', label: 'journal entries' },
    { key: 'mainselfcare:meditations',    label: 'meditations' },
    { key: 'fs:memories',            label: 'future memories' },
    { key: 'fs:evidence',            label: 'evidence' },
    { key: 'wr:reviews',             label: 'reviews' }
  ];

  var timer = null;
  var lastJson = null;

  function safeGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function safeRemove(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  function parse(raw, fallback) {
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function watched(k) {
    if (!k) return false;
    for (var i = 0; i < WATCHED.length; i++) {
      if (k.indexOf(WATCHED[i]) === 0) return true;
    }
    return false;
  }

  /** Everything Main holds right now, as one plain object. */
  function readState() {
    var out = {}, i, k;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!watched(k)) continue;
      out[k] = safeGet(k);
    }
    return out;
  }

  function countsOf(state) {
    var out = {};
    COUNTED.forEach(function (c) {
      var v = parse(state[c.key], null);
      if (Array.isArray(v)) out[c.label] = v.length;
    });
    return out;
  }

  function readIndex() {
    var v = parse(safeGet(INDEX_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function writeIndex(idx) { safeSet(INDEX_KEY, JSON.stringify(idx)); }

  /**
   * Trim to MAX_SNAPS and MAX_BYTES, newest first, never dropping a
   * pinned entry. Bytes as well as count, so a pathological state cannot
   * quietly fill the origin and start getting evicted by the browser.
   */
  function trim(idx) {
    var kept = [], bytes = 0;
    for (var i = 0; i < idx.length; i++) {
      var e = idx[i];
      var over = kept.length >= MAX_SNAPS || (bytes + (e.bytes || 0)) > MAX_BYTES;
      if (over && !e.pinned) { safeRemove(SNAP_KEY + e.id); continue; }
      bytes += e.bytes || 0;
      kept.push(e);
    }
    return kept;
  }

  function snapshot(reason, opts) {
    opts = opts || {};
    var state = readState();
    var json = JSON.stringify(state);
    // Nothing changed since the last one. A snapshot per keystroke is not a
    // history, it is a leak.
    if (!opts.force && json === lastJson) return null;
    lastJson = json;

    var entry = {
      id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8),
      at: Date.now(),
      reason: reason || 'auto',
      bytes: json.length,
      pinned: !!opts.pinned,
      counts: countsOf(state)
    };
    if (!safeSet(SNAP_KEY + entry.id, json)) return null;

    var idx = readIndex();
    idx.unshift(entry);
    writeIndex(trim(idx));
    return entry;
  }

  function list() { return readIndex(); }

  function get(id) {
    return parse(safeGet(SNAP_KEY + id), null);
  }

  function remove(id) {
    safeRemove(SNAP_KEY + id);
    writeIndex(readIndex().filter(function (e) { return e.id !== id; }));
  }

  /**
   * Write a snapshot back over live storage. Takes a pinned snapshot of the
   * CURRENT state first — restoring is itself a destructive act, and the
   * thing you were about to overwrite is the thing you will want back if
   * you picked the wrong entry.
   *
   * Keys present now but absent from the snapshot are removed, so a restore
   * genuinely returns the earlier state rather than merging into it.
   */
  function restore(id) {
    var snap = get(id);
    if (!snap) return false;
    snapshot('pre-restore', { pinned: true, force: true });

    var now = readState(), k;
    for (k in now) {
      if (Object.prototype.hasOwnProperty.call(now, k) && !(k in snap)) safeRemove(k);
    }
    for (k in snap) {
      if (Object.prototype.hasOwnProperty.call(snap, k)) safeSet(k, snap[k]);
    }
    lastJson = null;
    return true;
  }

  function stats() {
    var idx = readIndex(), bytes = 0;
    idx.forEach(function (e) { bytes += e.bytes || 0; });
    return { count: idx.length, bytes: bytes, newest: idx.length ? idx[0].at : 0 };
  }

  function onAnyChange() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; snapshot('auto'); }, DEBOUNCE_MS);
  }

  function watch() {
    // Main's own data files each dispatch their own save event.
    ['routine:save', 'today:save', 'mainselfcare:save', 'fs:save', 'wr:save']
      .forEach(function (ev) { global.addEventListener(ev, onAnyChange); });
    // Another tab — and, because the IndexedDB shim re-fires it, sync.js's
    // applyRemote, which writes with the unpatched setter and would
    // otherwise be completely silent here.
    global.addEventListener('storage', function (e) {
      if (!e.key || watched(e.key)) onAnyChange();
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

  global.MainBackup = {
    PREFIX: PREFIX,
    COUNTED: COUNTED,
    boot: boot,
    watch: watch,
    snapshot: snapshot,
    list: list,
    get: get,
    remove: remove,
    restore: restore,
    stats: stats,
    countsOf: countsOf,
    readState: readState
  };
})(window);
