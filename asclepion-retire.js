// =============================================================
// asclepion-retire.js — the one-shot deletion of the collections
// The Asclepion stopped having on 2026-09-01.
//
//   window.AscRetire
//
// Journals, affirmations, routines and the Kept view were removed
// when the studio became one page. Damian asked for the records
// deleted, not archived. This is that deletion.
//
// =============================================================
// A DELETE HERE IS NOT LOCAL
//
// sync.js's pushNow() sends collect() as the row's ENTIRE data
// column, and applyRemote() then removes, on every other device,
// any key absent from that blob but present in §SEEN. So this
// file does not tidy a device. It reaches every device Damian
// owns, and it is not undoable from the cloud.
//
// That is the intent — but it is also why the four properties
// below are not optional. They are promptarium-backup.js's, which
// did the same job for the old prompt library, and they are
// copied deliberately rather than reinvented.
//
//   1. THE UNDO SHIPS IN THE SAME CHANGE. A pinned snapshot is
//      taken immediately before the delete, and wipe() REFUSES TO
//      RUN if it could not take one. The snapshot lives under
//      `bak:asc:`, which contains no `asc:` at offset 0, so
//      sync.js cannot see it: never pushed, never deleted by
//      applyRemote, never counted against the row's size.
//
//   2. EXPLICIT KEYS. No prefix sweep, no localStorage.clear().
//      A sweep over `asc:` is correct today and wrong the first
//      time someone adds a key; clear() takes everything.
//
//   3. IT RUNS FROM onPulled, NEVER FROM A TIMER ALONE. There is
//      a grace fallback for a pull that never answers, and with
//      it a FRESH-INSTALL BRANCH: if none of these keys is
//      present, this device never held the old studio, so the
//      schema is stamped and nothing is deleted. Without that
//      branch, a page left open for four seconds on a bad
//      connection would delete whatever arrived in those four
//      seconds.
//
//   4. A RECALL WINDOW. For thirty days the page offers to put
//      the records back from the snapshot. It restores the KEYS,
//      not the pages — the journals have no screen any more. It
//      is there so the writing can be got at and exported, not so
//      the feature can be resurrected.
//
// THE PREFIXES ARE NOT TOUCHED. `asc:` and `asclog:` stay in
// asclepion-sync.js and in data-registry.js forever. Retiring a
// collection means deleting its keys. Retiring a prefix means
// deleting everything under it — including the five collections
// that are still here.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // THE LIST. Every key named here, and nothing else, is deleted.
  // ------------------------------------------------------------
  var KEYS = [
    'asc:journals',       // the five journal definitions
    'asclog:entries',     // everything written in them
    'asc:decks',          // the thirteen affirmation decks
    'asc:affirmations',   // their lines
    'asc:today',          // the day's affirmation pick
    'asc:routines',       // the four routines
    'asclog:live'         // the in-flight routine, if one was running
  ];

  var STAMP = 'asc:retiredAt';
  var DISMISS = 'asc:retiredSeen';
  var RECALL_DAYS = 30;
  var GRACE_MS = 4000;      // under the seeder's 8s backstop, so order holds

  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function set(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function has(key) {
    try { return localStorage.getItem(key) != null; } catch (e) { return false; }
  }

  function stamp() {
    var s = get(STAMP);
    return (s && typeof s === 'object') ? s : null;
  }
  function done() { return !!stamp(); }

  /** Which of the retired keys this device still holds. */
  function present() {
    return KEYS.filter(has);
  }

  // ------------------------------------------------------------
  // THE WIPE
  //
  // Returns what it did, as a word, so a test can assert on it:
  //   'already' | 'fresh' | 'refused' | 'wiped'
  // ------------------------------------------------------------
  function wipe(store) {
    if (done()) return 'already';

    var found = present();

    // FRESH INSTALL. This device never held the old studio. Stamp
    // it so nothing runs on a later boot, and delete nothing.
    if (!found.length) {
      set(STAMP, { at: Date.now(), snapId: null, keys: [], fresh: true });
      return 'fresh';
    }

    // THE UNDO, OR NOTHING. force, because the fingerprint may be
    // identical to the boot snapshot taken a moment ago and an
    // unforced call would return null; pinned, so pruning cannot
    // reach it while the recall window is open.
    var entry = null;
    if (store && typeof store.snapshot === 'function') {
      try {
        entry = store.snapshot('before-retire', {
          force: true, pinned: true, label: 'before the 2026-09-01 retirement'
        });
      } catch (e) { entry = null; }
    }
    if (!entry || !entry.id) {
      // No snapshot means no way back. Leave the records alone and
      // leave the schema unstamped, so the next boot tries again.
      try { console.warn('[asclepion-retire] no snapshot could be taken; nothing was deleted'); } catch (e) {}
      return 'refused';
    }

    found.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    set(STAMP, { at: Date.now(), snapId: entry.id, keys: found, fresh: false });
    return 'wiped';
  }

  // ------------------------------------------------------------
  // ARM — hang the wipe off the cloud's answer.
  //
  //   AscRetire.arm({ ref, store, then })
  //
  // `ref` is AscSync.mountAndSeed()'s ref: it has `.pulled` and a
  // settable `.onPulled` that fires once BOTH rows have spoken.
  // `then` runs after the wipe, whatever the wipe decided — it is
  // where the seeder goes, so that seeding can never happen before
  // a deletion it would have to reason about.
  // ------------------------------------------------------------
  function arm(cfg) {
    cfg = cfg || {};
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      var what = 'already';
      try { what = wipe(cfg.store); } catch (e) {
        try { console.error('[asclepion-retire]', e); } catch (e2) {}
      }
      if (typeof cfg.then === 'function') cfg.then(what);
    }
    var ref = cfg.ref;
    if (ref && ref.pulled) { go(); return; }
    if (ref) ref.onPulled = go;
    setTimeout(go, GRACE_MS);
  }

  // ------------------------------------------------------------
  // THE RECALL WINDOW
  // ------------------------------------------------------------
  function daysSince() {
    var s = stamp();
    if (!s || !s.at) return Infinity;
    return (Date.now() - s.at) / 86400000;
  }

  /** Is there anything to offer, and has it not been waved away? */
  function recallable() {
    var s = stamp();
    if (!s || s.fresh || !s.snapId) return false;
    if (get(DISMISS) === s.snapId) return false;
    return daysSince() <= RECALL_DAYS;
  }

  function what(store) {
    var s = stamp();
    if (!s || !store) return null;
    var snap = null;
    try { snap = store.get(s.snapId); } catch (e) { snap = null; }
    return snap ? { stamp: s, snap: snap } : null;
  }

  /**
   * Put the retired records back into storage.
   *
   * SCOPED, not a full restore: only the keys this file deleted,
   * so a restore cannot roll back a breathing technique edited
   * since. It does not bring the journals' pages back — there are
   * none. It is here so the writing can be reached and exported.
   */
  function restore(store) {
    var s = stamp();
    if (!s || !s.snapId || !store) return false;
    var ok = false;
    try { ok = !!store.restore(s.snapId, s.keys && s.keys.length ? s.keys : KEYS); } catch (e) { ok = false; }
    if (ok) set(DISMISS, s.snapId);
    return ok;
  }

  function dismiss() {
    var s = stamp();
    if (s && s.snapId) set(DISMISS, s.snapId);
  }

  global.AscRetire = {
    KEYS: KEYS,
    STAMP: STAMP,
    RECALL_DAYS: RECALL_DAYS,
    present: present,
    done: done,
    stamp: stamp,
    wipe: wipe,
    arm: arm,
    recallable: recallable,
    what: what,
    restore: restore,
    dismiss: dismiss
  };
})(window);
