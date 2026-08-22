// =============================================================
// main-sync.js — the single source of truth for which storage
// prefixes belong to which Supabase row, for every page of Main.
//
// WHY THIS FILE EXISTS AT ALL
//
// sync.js is prefix-driven and last-writer-wins over a WHOLE row:
// collect() (sync.js:53-61) sweeps localStorage for every key its
// own prefix list matches, and pushNow() (sync.js:263-266) upserts
// that sweep as the row's ENTIRE `data` column. applyRemote()
// (sync.js:228-233) then deletes, on every other device, any local
// key that is absent from the pushed blob but present in §SEEN.
//
// Put those three facts together and a page's prefix list is not a
// configuration detail. It is a delete list for the whole account.
//
//   A PREFIX MAY BE ADDED TO A ROW. IT MAY NEVER BE REMOVED.
//
// Two documents on one row with two different prefix lists is the
// same bug wearing a disguise: whichever one pushes last erases
// what the other one's list didn't happen to mention. Main now has
// three documents (index.html, futureself.html, weeklyreview.html)
// across three rows, so the table below is held in ONE place and
// every page mounts through it. That removes the whole class of bug
// structurally instead of by remembering to keep four literals in
// four files identical.
//
// =============================================================
// THE PREFIXES THAT LOOK DEAD AND ARE NOT
//
// `system:` and `fitness:` no longer have any screen. Your System,
// Subconscious Reprogramming and Main's own embedded Fitness Studio
// were removed on 2026-08-22; system-data.js and fitness-data.js
// are no longer even loaded. It is therefore extremely tempting to
// delete those two strings from the goals row below.
//
// Doing that would delete the data, on every device you own, the
// first time this page pushed. The keys still exist in storage.
// Dropping the prefix means collect() stops seeing them, the next
// push uploads a `data` column without them, and applyRemote() on
// your phone reads that as "the cloud deleted these" and calls
// origRemove() on each one.
//
// Orphaned-but-intact is this repo's house rule (CLAUDE.md §4).
// A prefix costs a few bytes per push. Leave them.
// =============================================================
// HANDOFF IS UNCONDITIONAL HERE, ON PURPOSE
//
// sync.js's dirty set is per-document and dies with the page, so a
// write followed quickly by a navigation is lost: the next document
// boots with an empty dirty set and its opening pull treats the
// cloud as authoritative. Measured at 6 losses out of 6 with a fast
// cloud read (sync.js:65-83).
//
// Main is full of exactly that pattern — set today's effort level,
// tap through to the Fitness Studio. And `handoff` only works if
// EVERY document on a row sets it, so this file sets it for all of
// them rather than leaving a future fourth page free to reopen the
// hole by omission. `syncdirty:<appKey>` sits outside every prefix
// listed below, which is what sync.js:102 requires.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // THE TABLE
  // ------------------------------------------------------------
  var ROWS = {
    // The historical Main row. Named 'goals' for legacy reasons only —
    // nothing has been written under a `goals:` prefix for a long time
    // (topbar.js:1469-1493 still reads three dead `goals:` keys for a
    // badge that consequently always shows 0/0).
    goals: [
      'routine:',      // Beliefs, the 30-day lock, Today/Tonight, the Frog log
      'system:',       // RETIRED UI, LIVE DATA — read the header before touching
      'fitness:',      // RETIRED UI, LIVE DATA — read the header before touching
      'mainselfcare:', // Self-Care: checklist, tips, journal, meditations, breathwork
      'today:',        // Today: routines, per-day log, the timing engine
      'wr:'            // Weekly Review
    ],
    // Owned by the Fitness Studio. Main mounts it READ-WRITE but only ever
    // touches `pal:levels` and `pal:musicstate`. It must be mounted by
    // prefix, never as syncedKeys:['pal:levels'] — see the guard below.
    palaestra: ['pal:'],
    // Future Self is its own row because its Visual Identity Board is the
    // one collection here that can grow without bound, and sync.js
    // re-serialises and uploads a row's whole `data` on every debounced
    // save. Same reasoning that split `kdpms` out of `kdp`.
    futureself: ['fs:']
  };

  // Prefixes that must never be swallowed by a synced prefix, checked at
  // mount rather than trusted. `mainbak:` is Main's local snapshot store
  // and `syncdirty:` is sync.js's own handoff bookkeeping; either one
  // riding inside a synced prefix would be destroyed by precisely the
  // event it exists to survive.
  var MUST_STAY_LOCAL = ['mainbak:', 'syncdirty:', 'palbak:'];

  function rowPrefixes(name) {
    var list = ROWS[name];
    return list ? list.slice() : null;
  }

  // ------------------------------------------------------------
  // SAFETY CHECKS — run once per mount, cheap, and they have already
  // caught real mistakes in this file's own history.
  // ------------------------------------------------------------
  function assertSafe(name, prefixes) {
    var i, j, p;

    // 1. A local-only store must not begin with any synced prefix. This is
    //    a character-by-character check because `pal:` vs `palbak:` and
    //    `fitness:` vs `fs:` are exactly the kind of near-miss that reads
    //    as fine and is not.
    for (i = 0; i < prefixes.length; i++) {
      p = prefixes[i];
      for (j = 0; j < MUST_STAY_LOCAL.length; j++) {
        if (MUST_STAY_LOCAL[j].indexOf(p) === 0) {
          throw new Error('main-sync: row "' + name + '" prefix "' + p +
            '" would swallow the local-only store "' + MUST_STAY_LOCAL[j] + '"');
        }
      }
    }
    return prefixes;
  }

  // Two mounts in one document whose prefixes overlap make the two rows
  // push each other in a loop: sync.js:203-210 installs one setItem patch
  // per mount and they chain, so a key matching both is written twice and
  // each write marks the other row dirty.
  function assertDisjoint(names) {
    var all = [], i, j, a, b;
    for (i = 0; i < names.length; i++) {
      var list = rowPrefixes(names[i]);
      for (j = 0; j < list.length; j++) all.push({ row: names[i], p: list[j] });
    }
    for (i = 0; i < all.length; i++) {
      for (j = i + 1; j < all.length; j++) {
        a = all[i]; b = all[j];
        if (a.row === b.row) continue;
        if (a.p.indexOf(b.p) === 0 || b.p.indexOf(a.p) === 0) {
          throw new Error('main-sync: prefixes overlap across rows — "' +
            a.p + '" (' + a.row + ') and "' + b.p + '" (' + b.row + ')');
        }
      }
    }
  }

  // ------------------------------------------------------------
  // MOUNT
  //
  //   MainSync.mount(['goals', 'palaestra'], {
  //     onApplied: function (row) { ... },   // the row CHANGED something
  //     onPulled:  function (row) { ... }    // the cloud has had its say
  //   });
  //
  // onApplied fires only when applyRemote actually changed something.
  // onPulled fires when the opening read resolves whether or not it
  // differed — which is the question a seeder has to ask, because a
  // byte-identical row looks exactly like no row at all (sync.js:16-21).
  //
  // NEVER seed before onPulled. A seeder that runs against a not-yet-
  // hydrated store concludes the device is empty and writes over real
  // data that is still on its way in.
  // ------------------------------------------------------------
  function mount(names, opts) {
    names = Array.isArray(names) ? names : [names];
    opts = opts || {};
    assertDisjoint(names);

    if (!global.initCloudSync) return { rows: [], pulled: false };

    var state = { rows: names.slice(), pulled: false, pulledRows: {} };

    names.forEach(function (name) {
      var prefixes = rowPrefixes(name);
      if (!prefixes) throw new Error('main-sync: unknown row "' + name + '"');
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

  /**
   * Everything this device holds for the given rows, as one plain object.
   * The backup escape hatch: paste
   *   copy(JSON.stringify(MainSync.dump(['goals','palaestra']), null, 2))
   * into the console and you have the file. Reads storage directly rather
   * than going through sync.js, so it works whether or not sync mounted.
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
    a.download = 'main-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Object.keys(data).length;
  }

  global.MainSync = {
    ROWS: ROWS,
    prefixes: rowPrefixes,
    mount: mount,
    dump: dump,
    download: download
  };
})(window);
