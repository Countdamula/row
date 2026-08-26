// =============================================================
// promptarium-backup.js — rolling local snapshots for Prompt Studio.
//
// WHY THIS EXISTS
// Two reasons, and the second is the urgent one.
//
// 1. On 2026-08-20 a night's worth of workout routines disappeared from
//    another page in this app. The mechanism was not that page's own
//    writes: sync.js deleted every local key the cloud row did not
//    happen to carry, could not tell "the cloud deleted this" from "the
//    cloud has never heard of this", and pushed the deletion back as
//    truth. That specific hole is closed in sync.js (§SEEN), but a cloud
//    row is still a single last-writer-wins document shared by every
//    device, and one bad push from any of them replaces the lot.
//
// 2. The 2026-08-25 rebuild DELETES the old prompt library on purpose —
//    see §WIPE in promptarium-data.js. A deliberate deletion still
//    deserves an undo, and the wipe refuses to run unless this module
//    has already taken a snapshot.
//
// It is NOT a second sync and NOT a merge: it is a plain, boring, local
// copy that nothing in the sync path can reach, kept so that "it was
// there yesterday" is an answerable statement rather than a lost
// argument.
//
// THE PREFIX IS THE WHOLE DESIGN. Snapshots live under `prmbak:`, which
// does NOT begin with `prm:` — check it character by character before
// changing either string. sync.js matches k.indexOf('prm:') === 0, and
// 'prmbak:index' contains no 'prm:' substring at all, so it is invisible
// to sync: never collected, never pushed, never deleted by applyRemote,
// never counted against the Supabase row's size. A snapshot store that
// rode along inside the synced prefix would be destroyed by exactly the
// event it exists to survive.
//
// WHAT IT DOES NOT DO. It does not merge two divergent histories, and it
// never restores anything on its own. Restoring is always the reader's
// decision, made from Settings or from the undo banner.
// =============================================================

(function (global) {
  'use strict';

  var PREFIX    = 'prmbak:';
  var INDEX_KEY = PREFIX + 'index';
  var SNAP_KEY  = PREFIX + 'snap:';
  var WIPE_KEY  = PREFIX + 'wipe';
  var MAX_SNAPS = 12;
  // A whole Prompt Studio state is prose — prompt bodies — so it is
  // bigger per record than a fitness log but bounded by how much anyone
  // writes by hand. The cap is enforced by bytes as well as by count so a
  // pathological state cannot quietly fill the origin and start getting
  // evicted.
  var MAX_BYTES = 4 * 1024 * 1024;
  var DEBOUNCE_MS = 5000;
  // How long the undo banner stays on offer after the rebuild's wipe.
  var UNDO_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  // ------------------------------------------------------------
  // RAW STORE
  //
  // Reads and writes go through localStorage like everything else — the
  // IndexedDB shim is what makes them durable — but nothing here is ever
  // routed through Promptarium.storeSet(), because that fires `prm:save`
  // and this module listens to `prm:save`.
  // ------------------------------------------------------------
  function rawGet(k) {
    try { var v = localStorage.getItem(k); return v == null ? null : v; }
    catch (e) { return null; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jsonGet(k) {
    var raw = rawGet(k);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function jsonSet(k, v) { return rawSet(k, JSON.stringify(v)); }

  /* Every live 'prm:' key, as raw strings. Enumerated rather than listed:
     a snapshot that only knew today's key names would silently stop
     covering a key added tomorrow, and this module's whole job is to be
     comprehensive on the day something goes wrong. */
  function collectState() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('prm:') === 0) {
          var v = localStorage.getItem(k);
          if (v != null) out[k] = v;
        }
      }
    } catch (e) {}
    return out;
  }

  function stateIsEmpty(state) {
    for (var k in state) {
      if (k === 'prm:schema') continue;              // a version marker is not content
      var v = state[k];
      if (v && v !== '[]' && v !== '{}' && v !== 'null') return false;
    }
    return true;
  }

  /* What a restore card shows. Counts, not bytes — "14 prompts, 9 tools"
     is the only thing that makes one snapshot distinguishable from
     another at a glance. Legacy key names are included so a pre-rebuild
     snapshot still describes itself. */
  var COUNTED = [
    { key: 'prm:prompts',     label: 'prompts' },
    { key: 'prm:tools',       label: 'tools' },
    { key: 'prm:collections', label: 'collections' },
    { key: 'prm:workflows',   label: 'workflows' },
    { key: 'prm:purposeTags', label: 'tags' }
  ];
  function countsFor(state) {
    var out = [];
    COUNTED.forEach(function (c) {
      var raw = state[c.key];
      if (raw == null) return;
      var v; try { v = JSON.parse(raw); } catch (e) { return; }
      if (Array.isArray(v) && v.length) out.push(v.length + ' ' + c.label);
    });
    return out;
  }

  // ------------------------------------------------------------
  // INDEX
  // ------------------------------------------------------------
  function index() { var v = jsonGet(INDEX_KEY); return Array.isArray(v) ? v : []; }
  function setIndex(list) { jsonSet(INDEX_KEY, list); }

  function prune() {
    var list = index();
    var bytes = 0, keep = [];
    // Newest first, so the cap always sheds the oldest.
    for (var i = list.length - 1; i >= 0; i--) {
      var raw = rawGet(SNAP_KEY + list[i].id);
      if (raw == null) continue;                     // evicted underneath us
      bytes += raw.length;
      if (keep.length >= MAX_SNAPS || bytes > MAX_BYTES) { rawDel(SNAP_KEY + list[i].id); continue; }
      keep.unshift(list[i]);
    }
    if (keep.length !== list.length) setIndex(keep);
  }

  // ------------------------------------------------------------
  // SNAPSHOT
  // ------------------------------------------------------------
  var lastState = null;      // in-memory copy of the last state we saw

  function snapshot(reason, stateOverride) {
    var state = stateOverride || collectState();
    // Never store an empty snapshot AT ALL. The earlier version allowed one
    // when the index was empty, on the reasoning that a first snapshot has
    // nothing to overwrite — but an empty snapshot is not a backup, it just
    // occupies the slot the restore panel offers you. There is nothing to
    // restore from an empty store, so there is nothing to record.
    if (stateIsEmpty(state)) return null;

    var id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6);
    var payload = JSON.stringify({ at: new Date().toISOString(), reason: reason || 'auto', state: state });
    if (!rawSet(SNAP_KEY + id, payload)) return null;

    var list = index();
    list.push({ id: id, at: new Date().toISOString(), reason: reason || 'auto', counts: countsFor(state) });
    setIndex(list);
    prune();
    lastState = state;
    return id;
  }

  function hasSnapshot() { return index().length > 0; }
  function list() { return index().slice().reverse(); }          // newest first
  function read(id) { return jsonGet(SNAP_KEY + id); }
  function latest() { var l = index(); return l.length ? l[l.length - 1] : null; }

  /* Restores go through the PATCHED setItem — not rawSet — so sync.js
     marks each key dirty and pushes it. A restore that stayed local would
     be undone by the next pull from another device. */
  function restore(id) {
    var snap = read(id);
    if (!snap || !snap.state) return 0;
    // Snapshot the current state first: an undo needs its own undo.
    snapshot('before-restore');
    var n = 0;
    for (var k in snap.state) {
      if (k.indexOf('prm:') !== 0) continue;         // belt and braces
      try { localStorage.setItem(k, snap.state[k]); n++; } catch (e) {}
    }
    lastState = collectState();
    return n;
  }

  // ------------------------------------------------------------
  // SHRINK DETECTION
  //
  // A pull that deletes six records happens in one tick. A five-second
  // debounce would snapshot the damage, not the state before it — so
  // whenever a counted collection gets SMALLER, the previous state (held
  // in memory since the last snapshot) is written immediately.
  // ------------------------------------------------------------
  function lengthsOf(state) {
    var out = {};
    COUNTED.forEach(function (c) {
      var raw = state[c.key];
      if (raw == null) return;
      var v; try { v = JSON.parse(raw); } catch (e) { return; }
      if (Array.isArray(v)) out[c.key] = v.length;
    });
    return out;
  }
  function shrank(before, after) {
    var a = lengthsOf(before), b = lengthsOf(after);
    for (var k in a) if (b[k] != null && b[k] < a[k]) return true;
    return false;
  }

  var timer = null;
  function scheduleSnapshot() {
    var now = collectState();
    if (lastState && shrank(lastState, now)) {
      clearTimeout(timer); timer = null;
      snapshot('shrink', lastState);                 // the state BEFORE the loss
      lastState = now;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; snapshot('edit'); }, DEBOUNCE_MS);
  }

  // ------------------------------------------------------------
  // WIPE BOOKKEEPING — which snapshot the rebuild's undo restores.
  // ------------------------------------------------------------
  function markWipe(snapId) { jsonSet(WIPE_KEY, { at: Date.now(), snapId: snapId }); }
  function pendingUndo() {
    var w = jsonGet(WIPE_KEY);
    if (!w || !w.snapId) return null;
    if (Date.now() - Number(w.at || 0) > UNDO_WINDOW_MS) return null;
    if (!read(w.snapId)) return null;
    return w;
  }
  function clearUndo() { rawDel(WIPE_KEY); }

  // ------------------------------------------------------------
  // INIT — call BEFORE initCloudSync. The opening pull can change or
  // delete local keys, and the whole point of the boot snapshot is that
  // it records what was here before the cloud got a vote.
  // ------------------------------------------------------------
  function init() {
    lastState = collectState();
    if (!stateIsEmpty(lastState)) snapshot('boot', lastState);
    window.addEventListener('prm:save', function (e) {
      if (e && e.detail && e.detail.ok === false) return;   // a failed write is not new state
      scheduleSnapshot();
    });
    return lastState;
  }

  global.PromptariumBackup = {
    PREFIX: PREFIX,
    init: init,
    snapshot: snapshot,
    hasSnapshot: hasSnapshot,
    list: list,
    read: read,
    latest: latest,
    restore: restore,
    countsFor: countsFor,
    collectState: collectState,
    markWipe: markWipe,
    pendingUndo: pendingUndo,
    clearUndo: clearUndo
  };

})(window);
