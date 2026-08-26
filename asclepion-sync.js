// =============================================================
// asclepion-sync.js — the single source of truth for which
// storage prefixes belong to which Supabase row, for every
// document of The Asclepion.
//
//   window.AscSync
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
// Two documents on one row with two different prefix lists is the
// same bug wearing a disguise: whichever one pushes last erases
// what the other one's list did not happen to mention. The
// Asclepion is three documents across two rows, so the table
// below is held in ONE place and every document mounts through
// it. That removes the whole class of bug structurally, instead
// of by remembering to keep six literals in three files
// identical.
//
// This file is main-sync.js's structure applied to a second app,
// deliberately and almost line for line. Where the two differ,
// the difference is commented.
// =============================================================
// TWO ROWS, SPLIT BY WEIGHT
//
// `asc:` is the LIBRARY — five breathing techniques, twelve
// tapping scripts, thirteen affirmation decks, the yoga and
// energy practices. It is read constantly and written rarely, and
// seeded it is around 200KB.
//
// `asclog:` is WHAT YOU WRITE — journal entries, tapping sessions
// with their before/after readings, the in-flight routine. Small
// records, written constantly.
//
// On one row, every keystroke batch in the journal would
// re-upload the entire seeded library, and every edit to a
// tapping script would re-upload every journal entry you have
// ever written. This is the same split, for the same reason, as
// kdpms: out of kdp:.
// =============================================================
// HANDOFF IS UNCONDITIONAL HERE, ON PURPOSE
//
// sync.js's dirty set is per-document and dies with the page, so
// a write followed quickly by a navigation is lost: the next
// document boots with an empty dirty set and its opening pull
// treats the cloud as authoritative. Measured on the Palaestra at
// 6 losses out of 6 with a fast cloud read.
//
// The Asclepion is full of exactly that pattern — finish a
// tapping session, tap through to the journal; start a routine on
// the hub, get handed to the runner. And `handoff` only works if
// EVERY document on a row sets it, so this file sets it for all
// of them rather than leaving a future fourth document free to
// reopen the hole by omission.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // THE TABLE
  // ------------------------------------------------------------
  var ROWS = {
    // The library. Big, seeded, edited occasionally.
    asclepion: ['asc:'],
    // The log. Small, written constantly.
    asclepionlog: ['asclog:']
  };

  // Prefixes that must never be swallowed by a synced prefix,
  // checked at mount rather than trusted. `syncdirty:` and
  // `syncseen:` are sync.js's own bookkeeping; either one riding
  // inside a synced prefix would be destroyed by precisely the
  // event it exists to survive, and sync.js would then silently
  // refuse to do handoff at all.
  var MUST_STAY_LOCAL = ['syncdirty:', 'syncseen:', 'ascbak:'];

  function rowPrefixes(name) {
    var list = ROWS[name];
    return list ? list.slice() : null;
  }

  // ------------------------------------------------------------
  // SAFETY CHECKS — run once per mount, cheap.
  //
  // `asc:` and `asclog:` are three characters apart, which is
  // exactly the near-miss shape this repo has been bitten by
  // before (`pal:` vs `palbak:`, `fitness:` vs `fs:`). It reads as
  // fine and is not. So it is checked character by character at
  // every mount rather than eyeballed once at review.
  // ------------------------------------------------------------
  function assertSafe(name, prefixes) {
    var i, j, p;
    for (i = 0; i < prefixes.length; i++) {
      p = prefixes[i];
      for (j = 0; j < MUST_STAY_LOCAL.length; j++) {
        if (MUST_STAY_LOCAL[j].indexOf(p) === 0) {
          throw new Error('asclepion-sync: row "' + name + '" prefix "' + p +
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
  function assertDisjoint(names) {
    var all = [], i, j, a, b;
    for (i = 0; i < names.length; i++) {
      var list = rowPrefixes(names[i]);
      if (!list) throw new Error('asclepion-sync: unknown row "' + names[i] + '"');
      for (j = 0; j < list.length; j++) all.push({ row: names[i], p: list[j] });
    }
    for (i = 0; i < all.length; i++) {
      for (j = i + 1; j < all.length; j++) {
        a = all[i]; b = all[j];
        if (a.row === b.row) continue;
        if (a.p.indexOf(b.p) === 0 || b.p.indexOf(a.p) === 0) {
          throw new Error('asclepion-sync: prefixes overlap across rows — "' +
            a.p + '" (' + a.row + ') and "' + b.p + '" (' + b.row + ')');
        }
      }
    }
  }

  // ------------------------------------------------------------
  // MOUNT
  //
  //   AscSync.mount({
  //     onApplied: function (row) { ... },  // the row CHANGED something
  //     onPulled:  function (row, all) {}   // the cloud has had its say
  //   });
  //
  // Both rows, always, on every document. Mounting only the row a
  // document happens to write is the mistake this file exists to
  // prevent: the journal document also READS the library (it needs
  // the journal definitions), and a document that reads a row it
  // has not mounted is reading whatever this device last happened
  // to have.
  //
  // onApplied fires only when applyRemote actually changed
  // something. onPulled fires when the opening read resolves
  // whether or not it differed — which is the question a seeder
  // has to ask, because a byte-identical row looks exactly like no
  // row at all.
  //
  // NEVER seed before onPulled. A seeder that runs against a
  // not-yet-hydrated store concludes the device is empty and
  // writes over real data that is still on its way in.
  // ------------------------------------------------------------
  function mount(opts) {
    opts = opts || {};
    var names = Object.keys(ROWS);
    assertDisjoint(names);

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

  // Asc.seedAfterSyncAttempt() wants one object with `.pulled` and
  // a settable `.onPulled`, not two rows to reason about. This
  // adapts the mount state into that shape and fires only once
  // BOTH rows have spoken — seeding while the library row is still
  // in flight is the exact race the gate exists to close.
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
   * Everything this device holds for The Asclepion, as one plain
   * object. The backup escape hatch: paste
   *   copy(JSON.stringify(AscSync.dump(), null, 2))
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
    a.download = 'asclepion-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Object.keys(data).length;
  }

  global.AscSync = {
    ROWS: ROWS,
    prefixes: rowPrefixes,
    mount: mount,
    mountAndSeed: mountAndSeed,
    dump: dump,
    download: download
  };
})(window);
