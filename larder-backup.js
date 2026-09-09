// =============================================================
// larder-backup.js — The Larder's snapshot store, plus the
// rebuild-wipe undo bookkeeping that is specific to this page.
//
// The engine lives in snapshots.js; this file keeps the name
// `LarBackup` and the `larbak:` prefix, which is where every
// snapshot already sitting on Damian's devices lives. Renaming the
// prefix would orphan all of them, which is why it keeps the older
// `<app>bak:` shape rather than the newer `bak:<app>:` one.
//
// WHAT CHANGED 2026-09-08, and why this file grew from three lines.
//
// The Nutrition Studio became a Recipe Book and a Grocery List, and
// the eleven other screens' data was DELETED rather than hidden —
// Damian's explicit choice. §THE WIPE in larder-data.js does the
// removing; this file is the half that makes it recoverable:
//
//   · markWipe(id)   records which snapshot the undo restores
//   · pendingUndo()  is there still one, and is it still in date
//   · clearUndo()    the offer has been taken or declined
//
// THE RECOVERY PATH WAS BUILT BEFORE THE DESTRUCTIVE ONE. That is
// not a stylistic preference here: this page already destroyed a
// real grocery list once, on 2026-08-27, with a button that deleted
// where it should have hidden. The lesson recorded then was to build
// the way back first, and this is that lesson applied.
//
// The wipe REFUSES TO RUN without a snapshot — see runWipeOnce() in
// larder.html. The one exception is a device where snapshot()
// returns null, which means there was nothing worth copying, which
// means there is nothing to lose.
//
// LOAD ORDER: data-registry.js, then snapshots.js, then this.
// =============================================================

(function (global) {
  'use strict';
  if (!global.Snapshots || !global.Snapshots.forApp) return;

  // The registry supplies the prefix, what to watch and what to
  // count. It watches lar:, larlog: AND the retired nutrition:,
  // because a pre-migration device still holds real records there.
  var store = global.Snapshots.forApp('larder');

  // ------------------------------------------------------------
  // WIPE BOOKKEEPING — which snapshot the rebuild's undo restores.
  // Page-specific, so it stays here rather than moving into the
  // shared engine. Same shape as promptarium-backup.js, which did
  // this first for the same reason.
  // ------------------------------------------------------------
  var WIPE_KEY = store.PREFIX + 'wipe';
  var UNDO_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days

  function jsonGet(k) {
    try { var v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function jsonSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  store.markWipe = function (snapId) { jsonSet(WIPE_KEY, { at: Date.now(), snapId: snapId }); };
  store.pendingUndo = function () {
    var w = jsonGet(WIPE_KEY);
    if (!w || !w.snapId) return null;
    if (Date.now() - Number(w.at || 0) > UNDO_WINDOW_MS) return null;
    // The snapshot may have been pruned out of the ring since. An
    // undo button that restores nothing is worse than no button.
    if (!store.get(w.snapId)) return null;
    return w;
  };
  store.clearUndo = function () { try { localStorage.removeItem(WIPE_KEY); } catch (e) {} };

  // ------------------------------------------------------------
  // RETURN-VALUE CONTRACTS
  //
  // larder.html reads an ID from snapshot() and a COUNT from
  // restore(), because that is what the page's own code is written
  // against. The shared engine returns objects for both. Wrapping
  // them here keeps one caller from having a private contract with
  // the engine.
  //
  // snapshot() returning null is MEANINGFUL, not a failure: it says
  // there was nothing worth copying, and runWipeOnce() reads it as
  // permission to proceed without one.
  // ------------------------------------------------------------
  var engineSnapshot = store.snapshot;
  var engineRestore  = store.restore;
  store.snapshot = function (reason, opts) {
    var e = engineSnapshot(reason, opts);
    return e ? e.id : null;
  };
  store.restore = function (id, only) {
    var res = engineRestore(id, only);
    return res && res.ok ? res.written : 0;
  };

  store.read = store.get;
  store.hasSnapshot = function () { return store.list().length > 0; };
  store.latest = function () { var l = store.list(); return l.length ? l[0] : null; };
  store.init = store.boot;
})(window);
