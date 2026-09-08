// =============================================================
// resource-retire.js — The Athenaeum's retirement, once per device.
//
// Damian asked for the old learning dashboard's data deleted
// rather than migrated. It is deleted here, and the undo ships in
// the same change — the destructive step REFUSES TO RUN without
// it. That shape is not caution for its own sake; it is what
// promptarium-backup.js and the Prompt Studio wipe established
// the last time this was done, and the reason that wipe was
// survivable.
//
// FOUR PROPERTIES, NONE OPTIONAL
// ─────────────────────────────────────────────────────────────
// 1. A SNAPSHOT FIRST, and the delete does not happen if the
//    snapshot did not write. `bak:ath:*` is local-only BY
//    CONSTRUCTION: no synced prefix in this repo begins with
//    "bak:", so sync.js can neither push it nor delete it, and
//    data-registry.js asserts that for us and throws if it ever
//    stops being true.
//
// 2. AN EXPLICIT KEY LIST. No prefix sweep, no localStorage
//    .clear(). A sweep over "ath:" is correct today and wrong the
//    first time something else claims a key that starts that way;
//    clear() takes the whole dashboard.
//
// 3. A FRESH-INSTALL BRANCH. A device that never held The
//    Athenaeum has nothing to retire, so it stamps the flag and
//    deletes nothing. Without this, a phone opening the studio
//    for the first time would run a delete path for no reason.
//
// 4. THE FLAG IS LOCAL, NOT SYNCED. `bak:ath:retired` rather than
//    a `res:` key — this has to happen once on EVERY device that
//    holds the old keys. A synced flag would mean the first
//    device to run it told all the others they were already done,
//    and their copies would sit on disk for ever.
//
// THE SUPABASE ROW IS NOT TOUCHED FROM HERE. Page code that can
// empty a row is a permanent hazard sitting in the deploy: it
// only ever has to fire once, wrongly, and there is no undo on a
// device that is offline at the time. The `athenaeum` row is
// emptied once, by hand, from a script — after
// data/retired/athenaeum-2026-09-08.json is committed.
//
// THIS FILE IS TEMPORARY. Once it has run everywhere it comes out
// of resource.html and out of the repo.
// =============================================================

(function (global) {
  'use strict';

  // `bak:athretire:` and NOT `bak:ath:` — that one is The Athenaeum's
  // own snapshot store (AthBackup), whose index lives at
  // `bak:ath:index` and whose payloads sit beside it. Writing this
  // retirement into the same namespace would put two writers in one
  // store, and the copy that has to survive would be sharing a bucket
  // with a rolling one that prunes itself.
  var FLAG = 'bak:athretire:done';
  var SNAP = 'bak:athretire:snapshot';
  var GRACE_MS = 3000;

  // Every key athenaeum-data.js ever wrote, listed out. Read off
  // its own KEYS map on 2026-09-08; `ath:resmarks` and
  // `ath:resMigratedV2` are the two whose names do not match their
  // field names, which is exactly why this is a list and not a
  // pattern.
  var LEGACY_KEYS = [
    'ath:subjects', 'ath:topics', 'ath:concepts', 'ath:connections',
    'ath:contradictions', 'ath:resources', 'ath:chapters', 'ath:resmarks',
    'ath:curricula', 'ath:modules', 'ath:lessons', 'ath:assignments',
    'ath:inbox', 'ath:lenses', 'ath:reviews', 'ath:sessions',
    'ath:experiments', 'ath:box', 'ath:focus', 'ath:hero', 'ath:today',
    'ath:uiState', 'ath:settings', 'ath:seededAt', 'ath:resMigratedV2'
  ];

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function present() {
    return LEGACY_KEYS.filter(function (k) { return get(k) != null; });
  }

  function run(ref) {
    if (get(FLAG)) return;

    var go = function () {
      if (get(FLAG)) return;

      // Prove the store cannot be swallowed before writing into
      // it. assertLocalOnly throws rather than returning false, so
      // a future prefix that broke this would fail loudly here and
      // not quietly six months later.
      if (global.DataRegistry && global.DataRegistry.assertLocalOnly) {
        try { global.DataRegistry.assertLocalOnly('bak:', 'resource-retire.js'); }
        catch (e) {
          try { console.error('[retire] refusing: bak: is not local-only', e); } catch (e2) {}
          return;
        }
      }

      var held = present();

      // §FRESH INSTALL. Nothing here to retire.
      if (!held.length) {
        set(FLAG, JSON.stringify({ at: new Date().toISOString(), held: 0, deleted: 0 }));
        return;
      }

      // §THE UNDO, WRITTEN FIRST.
      var payload = {};
      held.forEach(function (k) { payload[k] = get(k); });
      var wrote = set(SNAP, JSON.stringify({
        at: new Date().toISOString(),
        note: 'The Athenaeum, as this device held it when Resource Studio replaced it. ' +
              'Restore with RetireAthenaeum.restore().',
        keys: held,
        data: payload
      }));

      // §THE REFUSAL. No snapshot, no delete — and it will simply
      // try again next visit, which is the correct outcome.
      if (!wrote || !get(SNAP)) {
        try { console.warn('[retire] snapshot did not write; nothing deleted'); } catch (e) {}
        return;
      }

      var deleted = 0;
      held.forEach(function (k) {
        try { localStorage.removeItem(k); deleted++; } catch (e) {}
      });

      set(FLAG, JSON.stringify({
        at: new Date().toISOString(), held: held.length, deleted: deleted
      }));

      try {
        console.info('[retire] The Athenaeum retired: ' + deleted + ' keys removed, ' +
          'copy kept at ' + SNAP);
      } catch (e) {}
    };

    // After the cloud has had its say, or after a grace period if
    // it never answers. Neither matters much here — nothing mounts
    // `ath:` any more, so there is no pull that could bring the
    // keys back — but running during boot competes with the first
    // paint for no reason.
    if (ref && ref.applied) { setTimeout(go, 400); return; }
    setTimeout(go, GRACE_MS);
  }

  // The way back, from the console, on the device that holds it.
  function restore() {
    var raw = get(SNAP);
    if (!raw) { try { console.warn('[retire] no snapshot on this device'); } catch (e) {} return 0; }
    var snap;
    try { snap = JSON.parse(raw); } catch (e) { return 0; }
    var n = 0;
    Object.keys(snap.data || {}).forEach(function (k) {
      if (set(k, snap.data[k])) n++;
    });
    try { localStorage.removeItem(FLAG); } catch (e) {}
    try { console.info('[retire] restored ' + n + ' keys from ' + snap.at); } catch (e) {}
    return n;
  }

  function status() {
    var flag = get(FLAG), snap = get(SNAP);
    return {
      retired: !!flag,
      flag: flag ? JSON.parse(flag) : null,
      hasSnapshot: !!snap,
      snapshotBytes: snap ? snap.length : 0,
      stillPresent: present()
    };
  }

  global.RetireAthenaeum = {
    run: run, restore: restore, status: status,
    LEGACY_KEYS: LEGACY_KEYS, FLAG: FLAG, SNAP: SNAP
  };
})(window);
