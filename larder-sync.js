// =============================================================
// larder-sync.js — the single source of truth for which storage
// prefixes belong to which Supabase row, for every document of
// The Larder.
//
//   window.LarSync
//
// WHY THIS FILE EXISTS AT ALL
//
// sync.js is prefix-driven and last-writer-wins over a WHOLE row.
// collect() sweeps localStorage for every key its own prefix list
// matches, and pushNow() upserts that sweep as the row's ENTIRE
// `data` column. applyRemote() then deletes, on every other
// device, any local key that is absent from the pushed blob but
// present in §SEEN.
//
// Put those three facts together and a page's prefix list is not
// a configuration detail. It is a delete list for the whole
// account.
//
//   A PREFIX MAY BE ADDED TO A ROW. IT MAY NEVER BE REMOVED.
//
// This file is asclepion-sync.js's structure applied to a third
// app, deliberately and almost line for line. Where the two
// differ, the difference is commented.
// =============================================================
// THE ROW KEY IS 'nutrition', AND THAT IS NOT A MISTAKE.
//
// The app was renamed from Nutrition to The Larder. The Supabase
// row was NOT renamed with it, because renaming a row key is
// repurposing it: the old `nutrition` row would be left orphaned
// in the table with the real recipes and grocery list still
// inside it, and a device that had never opened the old page
// would hold no local copy to re-push into the new one. The name
// is a label. The row key is an address. Only the label changed.
//
// CLAUDE.md's DO NOT MODIFY rule 1 says exactly this: don't
// repurpose an existing key, or silently rename one.
// =============================================================
// TWO ROWS, SPLIT BY WEIGHT
//
// `lar:` is the LIBRARY — the food table, saved meals, recipes,
// the grocery list, the meal plan, targets. Read constantly,
// written rarely, seeded.
//
// `larlog:` is WHAT YOU ATE — meal log entries, water, the day
// records. Small records, written many times a day, standing in
// a kitchen.
//
// On one row every tap of "+8 oz" would re-upload the entire
// recipe library, and every edit to a recipe would re-upload
// every meal ever logged. This is the same split, for the same
// reason, as asclog: out of asc: and kdpms: out of kdp:.
// =============================================================
// `nutrition:` IS RETIRED BUT STILL MOUNTED.
//
// The old page's collections have been migrated to `lar:` keys
// (see larder-data.js §MIGRATIONS), and the Dream-Board widget
// board it also carried — nutrition:tabs, nutrition:widgets,
// nutrition:boardSeeded — is orphaned but intact, exactly as
// mainselfcare: was left when The Asclepion replaced Main's
// Self-Care tab.
//
// The prefix therefore stays in the list FOREVER. Dropping it
// would not "clean up" those keys, it would DELETE them on every
// device at the next push. Leaving it costs nothing: the keys are
// small, nothing reads them, and the migration's own deletions
// need the prefix mounted in order to travel correctly.
// =============================================================
// HANDOFF IS UNCONDITIONAL HERE, ON PURPOSE
//
// sync.js's dirty set is per-document and dies with the page, so
// a write followed quickly by a navigation is lost: the next
// document boots with an empty dirty set and its opening pull
// treats the cloud as authoritative. Measured on the Palaestra at
// 6 losses out of 6 with a fast cloud read.
//
// Logging food is exactly that pattern — tap "Log Food", tap the
// meal, put the phone in your pocket, open something else. And
// handoff only works if EVERY document on a row sets it, so this
// file sets it for all of them rather than leaving a future
// second document free to reopen the hole by omission.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // THE TABLE
  // ------------------------------------------------------------
  var ROWS = {
    // The library. Big, seeded, edited occasionally.
    // Keeps the historical row key — see the header.
    nutrition: ['lar:', 'nutrition:'],
    // The log. Small, written constantly.
    larderlog: ['larlog:']
  };

  // Prefixes that must never be swallowed by a synced prefix,
  // checked at mount rather than trusted. `syncdirty:` and
  // `syncseen:` are sync.js's own bookkeeping; either one riding
  // inside a synced prefix would be destroyed by precisely the
  // event it exists to survive, and sync.js would then silently
  // refuse to do handoff at all.
  var MUST_STAY_LOCAL = ['syncdirty:', 'syncseen:', 'larbak:'];

  function rowPrefixes(name) {
    var list = ROWS[name];
    return list ? list.slice() : null;
  }

  // ------------------------------------------------------------
  // SAFETY CHECKS — run once per mount, cheap.
  //
  // `lar:` and `larlog:` are three characters apart, and
  // `larbak:` is the same near-miss again. That is exactly the
  // shape this repo has been bitten by before (`pal:` vs
  // `palbak:`, `asc:` vs `asclog:`). It reads as fine and is not:
  // 'larlog:' survives only because its index 3 is 'l' and not
  // ':'. So it is checked character by character at every mount
  // rather than eyeballed once at review.
  // ------------------------------------------------------------
  function assertSafe(name, prefixes) {
    var i, j, p;
    for (i = 0; i < prefixes.length; i++) {
      p = prefixes[i];
      for (j = 0; j < MUST_STAY_LOCAL.length; j++) {
        if (MUST_STAY_LOCAL[j].indexOf(p) === 0) {
          throw new Error('larder-sync: row "' + name + '" prefix "' + p +
            '" would swallow the local-only store "' + MUST_STAY_LOCAL[j] + '"');
        }
      }
    }
    return prefixes;
  }

  // Two mounts in one document whose prefixes overlap make the two
  // rows push each other in a loop: sync.js installs one setItem
  // patch per mount and they chain, so a key matching both is
  // written twice and each write marks the other row dirty.
  //
  // This also covers the `palaestra` row, which The Larder mounts
  // through palaestra-data.js for pal:levels — `pal:` must not
  // collide with anything here either. It is passed in by the
  // caller rather than listed above, because this file does not
  // own that row and must not imply that it does.
  function assertDisjoint(names, extraPrefixes) {
    var all = [], i, j, a, b;
    for (i = 0; i < names.length; i++) {
      var list = rowPrefixes(names[i]);
      if (!list) throw new Error('larder-sync: unknown row "' + names[i] + '"');
      for (j = 0; j < list.length; j++) all.push({ row: names[i], p: list[j] });
    }
    (extraPrefixes || []).forEach(function (p) {
      all.push({ row: '(external)', p: p });
    });
    for (i = 0; i < all.length; i++) {
      for (j = i + 1; j < all.length; j++) {
        a = all[i]; b = all[j];
        if (a.row === b.row) continue;
        if (a.p.indexOf(b.p) === 0 || b.p.indexOf(a.p) === 0) {
          throw new Error('larder-sync: prefixes overlap across rows — "' +
            a.p + '" (' + a.row + ') and "' + b.p + '" (' + b.row + ')');
        }
      }
    }
  }

  // ------------------------------------------------------------
  // MOUNT
  //
  //   LarSync.mount({
  //     onApplied: function (row) { ... },  // the row CHANGED something
  //     onPulled:  function (row, all) {}   // the cloud has had its say
  //   });
  //
  // Both rows, always, on every document. Mounting only the row a
  // document happens to write is the mistake this file exists to
  // prevent: Today READS the library (it needs the food table to
  // render a logged entry) and WRITES the log, and a document that
  // reads a row it has not mounted is reading whatever this device
  // last happened to have.
  //
  // onApplied fires only when applyRemote actually changed
  // something. onPulled fires when the opening read resolves
  // whether or not it differed — which is the question a seeder
  // has to ask, because a byte-identical row looks exactly like no
  // row at all.
  //
  // NEVER seed or migrate before onPulled. A seeder that runs
  // against a not-yet-hydrated store concludes the device is empty
  // and writes over real data that is still on its way in.
  // ------------------------------------------------------------
  function mount(opts) {
    opts = opts || {};
    var names = Object.keys(ROWS);
    // `pal:` is mounted separately by the page, for pal:levels.
    assertDisjoint(names, ['pal:']);

    var state = { rows: names.slice(), pulled: false, pulledRows: {} };

    if (!global.initCloudSync) return state;

    names.forEach(function (name) {
      var prefixes = rowPrefixes(name);
      assertSafe(name, prefixes);

      global.initCloudSync({
        appKey: name,
        syncedPrefixes: prefixes,
        // Unconditional. See the header.
        handoff: true,
        onApplied: function () {
          if (opts.onApplied) opts.onApplied(name);
        },
        onPulled: function () {
          state.pulledRows[name] = true;
          state.pulled = names.every(function (n) { return state.pulledRows[n]; });
          if (opts.onPulled) opts.onPulled(name, state.pulled);
        }
      });
    });

    return state;
  }

  // Lar.seedAfterSyncAttempt() wants one object with `.pulled` and
  // a settable `.onPulled`, not two rows to reason about. This
  // adapts the mount state into that shape and fires only once
  // BOTH rows have spoken — seeding or migrating while the library
  // row is still in flight is the exact race the gate exists to
  // close.
  function mountAndSeed(opts) {
    opts = opts || {};
    var ref = { pulled: false, onPulled: null };
    var state = mount({
      onApplied: opts.onApplied,
      onPulled: function (row, allPulled) {
        if (opts.onPulled) opts.onPulled(row, allPulled);
        if (!allPulled || ref.pulled) return;
        ref.pulled = true;
        if (typeof ref.onPulled === 'function') {
          var f = ref.onPulled; ref.onPulled = null; f();
        }
      }
    });
    state.ref = ref;
    return state;
  }

  /**
   * Everything this device holds for The Larder, as one plain
   * object. The backup escape hatch: paste
   *   copy(JSON.stringify(LarSync.dump(), null, 2))
   * into the console and you have the file. Reads storage
   * directly rather than going through sync.js, so it works
   * whether or not sync ever mounted.
   */
  function dump(names) {
    names = Array.isArray(names) ? names : Object.keys(ROWS);
    var out = {}, i, k, v;
    names.forEach(function (name) {
      var prefixes = rowPrefixes(name) || [];
      var row = {};
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (!k) continue;
        var hit = prefixes.some(function (p) { return k.indexOf(p) === 0; });
        if (!hit) continue;
        v = localStorage.getItem(k);
        try { row[k] = JSON.parse(v); } catch (e) { row[k] = v; }
      }
      out[name] = row;
    });
    return out;
  }

  /** Download that dump as a timestamped JSON file. */
  function download(names) {
    var data = dump(names);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'larder-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Object.keys(data).length;
  }

  global.LarSync = {
    ROWS: ROWS,
    prefixes: rowPrefixes,
    mount: mount,
    mountAndSeed: mountAndSeed,
    dump: dump,
    download: download
  };
})(window);
