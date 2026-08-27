// =============================================================
// promptarium-backup.js — Prompt Studio's snapshot store, plus the
// rebuild-wipe undo bookkeeping that is specific to this page.
//
// The engine lives in snapshots.js; this file keeps the name
// `PromptariumBackup` and the `prmbak:` prefix, which is where
// every snapshot already on this device is sitting.
//
// TWO THINGS CHANGE HERE, BOTH DELIBERATE.
//
// 1. The store now watches `cdx:` as well as `prm:`. This page
//    mounts The Codex's row READ-WRITE (see §CODEX GATE in
//    promptarium.html), so a bad push from this document can take
//    the fiction manuscript with it — and prmbak: was only ever
//    copying prm:, which meant the one collection this page could
//    destroy and not own was the one it had no copy of.
//
// 2. The index was stored oldest-first here and newest-first in the
//    other three. snapshots.js sorts by `at` on read, so both
//    layouts already on the device are read correctly, and list()
//    is newest-first for everyone. `latest()` is therefore
//    list()[0], not the last element.
//
// LOAD ORDER: data-registry.js, then snapshots.js, then this.
// =============================================================

(function (global) {
  'use strict';
  if (!global.Snapshots || !global.Snapshots.forApp) return;

  // 12, not the default 20: prompt bodies are prose and this store now
  // carries the manuscript prefix too.
  var store = global.Snapshots.forApp('promptarium', { maxSnaps: 12 });

  // ------------------------------------------------------------
  // WIPE BOOKKEEPING — which snapshot the 2026-08-25 rebuild's undo
  // restores. Page-specific, so it stays here rather than moving into
  // the shared engine.
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
    if (!store.get(w.snapId)) return null;          // the snapshot was pruned
    return w;
  };
  store.clearUndo = function () { try { localStorage.removeItem(WIPE_KEY); } catch (e) {} };

  // ------------------------------------------------------------
  // RETURN-VALUE CONTRACTS
  //
  // This page's two call sites read the old module's return values, which
  // differed from every other copy's. Wrapping them here keeps the page
  // untouched; changing the page instead would mean the shared engine has
  // one caller with a private contract.
  //
  //   snapshot() returned an ID STRING (or null). promptarium.html:2735
  //   feeds it straight to markWipe, and treats null as "there was nothing
  //   worth snapshotting, so the wipe may proceed without one".
  //
  //   restore() returned a COUNT. promptarium.html:2545 does
  //   `plural(n, 'record')` with it, which on an object prints
  //   "[object Object] records".
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

  // Names the old module exposed that the page still calls.
  store.read = store.get;
  store.hasSnapshot = function () { return store.list().length > 0; };
  store.latest = function () { var l = store.list(); return l.length ? l[0] : null; };
  store.init = store.boot;
})(window);
