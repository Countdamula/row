// =============================================================
// data-registry.js — the one table naming every app's storage.
//
// WHY THIS EXISTS
// "Which prefixes belong to which app" was spread across
// main-sync.js, asclepion-sync.js, larder-sync.js and five
// duplicated ['ath:'] literals in five Athenaeum documents. Every
// protection layer needs that answer — snapshots.js needs to know
// what to copy, trash.js needs to know which app a vanished record
// belonged to, data-export.js needs to know what to write out, and
// recovery.html needs to show all of it at once. Five copies of a
// list is how one of them quietly goes stale.
//
// THIS FILE IS DESCRIPTIVE, NOT AUTHORITATIVE.
// It does NOT mount anything and it must never become the thing
// pages mount from. The mount tables in main-sync.js /
// asclepion-sync.js / larder-sync.js stay exactly where they are,
// because they carry a rule this file cannot enforce:
//
//     A PREFIX MAY BE ADDED TO A ROW. IT MAY NEVER BE REMOVED.
//
// sync.js uploads collect() as a row's ENTIRE data column, so
// dropping a prefix from a mount deletes those keys on every device
// at the next push. Consolidating the mounts is a separate and much
// riskier job. If this table and a mount table ever disagree, the
// mount table is right and this one is the bug.
//
// WHAT IT IS FOR
//   - listing every app, its rows, and its prefixes, in one place
//   - proving a local-only prefix cannot be swallowed by a synced
//     one (assertLocalOnly), which is the single rule every
//     protection store in this repo depends on
// =============================================================

(function (global) {
  'use strict';

  // Snapshot stores added from here on use the `bak:<app>:` form rather
  // than `<app>bak:`. Both are safe, but only one is safe BY CONSTRUCTION:
  // no synced prefix begins with "bak:", so a new store can never be
  // swallowed no matter what prefix an app adds later. The four stores that
  // predate this keep their existing names, because renaming them would
  // orphan every snapshot already sitting on the device.
  var LOCAL_ONLY = [
    'bak:',        // every snapshot store created from now on
    'trash:',      // trash.js — the deleted-record journal
    'mainbak:',    // main-backup.js        (predates the bak: convention)
    'palbak:',     // palaestra-backup.js   (predates)
    'larbak:',     // larder-backup.js      (predates)
    'prmbak:',     // promptarium-backup.js (predates)
    'ascbak:',     // reserved by asclepion-sync.js's MUST_STAY_LOCAL
    'athdraft:',   // athenaeum-drafts.js — per-keystroke form drafts
    'shrink:',     // shrink-banner.js — the unanswered "something vanished" notice
    'syncdirty:',  // sync.js §HANDOFF
    'syncseen:',   // sync.js §SEEN
    'recent:'      // topbar.js's CONTINUE recorder
  ];

  // -----------------------------------------------------------------
  // THE APPS
  //
  // `rows`      — Supabase app_state row key -> the prefixes it carries.
  //               Mirrors the mount tables; see the warning above.
  // `snapshots` — the local snapshot store. `watch` may be wider than one
  //               row: a half snapshot is worse than none, because it
  //               looks like a restore point and is not.
  // `counted`   — the collections worth showing on a restore card, so
  //               "restore this one" is a decision made on evidence
  //               rather than on a timestamp. Not every key: the ones a
  //               reader would recognise as their own work.
  // -----------------------------------------------------------------
  var APPS = [
    {
      id: 'main',
      label: 'Main',
      pages: ['index.html', 'routine.html', 'futureself.html', 'weeklyreview.html'],
      rows: {
        // Named 'goals' for legacy reasons only — nothing has been written
        // under a `goals:` prefix for a long time.
        goals: ['routine:', 'system:', 'fitness:', 'mainselfcare:', 'today:', 'wr:'],
        palaestra: ['pal:'],   // owned by The Palaestra; Main mounts it read-write
        futureself: ['fs:']
      },
      // Mounted, but not this app's to own. appForKey() must answer "The
      // Palaestra" for a `pal:` key even though Main carries the row too,
      // or a deleted workout would be filed under Main in the trash and
      // exported into Main's file.
      borrows: ['pal:'],
      snapshots: {
        prefix: 'mainbak:', global: 'MainBackup',
        watch: ['routine:', 'system:', 'fitness:', 'mainselfcare:', 'today:', 'wr:', 'fs:'],
        events: ['routine:save', 'today:save', 'mainselfcare:save', 'fs:save', 'wr:save']
      },
      // Verified against the real key names in today-data.js /
      // futureself-data.js / weeklyreview-data.js. A `counted` key that does
      // not exist reads as a permanent 0, which silently disables shrink
      // detection for that collection — the protection would look present
      // and do nothing. `routine:steps` was exactly that mistake.
      counted: [
        { key: 'routine:beliefs',             label: 'beliefs' },
        { key: 'routine:todayEntries',        label: 'today entries' },
        { key: 'routine:tonightEntries',      label: 'tonight entries' },
        { key: 'today:routines',              label: 'routine steps' },
        { key: 'today:log',                   label: 'logged days' },
        { key: 'mainselfcare:journalEntries', label: 'journal entries' },
        { key: 'mainselfcare:meditations',    label: 'meditations' },
        { key: 'fs:letters',                  label: 'letters' },
        { key: 'fs:memories',                 label: 'future memories' },
        { key: 'fs:evidence',                 label: 'evidence' },
        { key: 'wr:reviews',                  label: 'weekly reviews' }
      ]
    },
    {
      id: 'palaestra',
      label: 'The Palaestra',
      pages: ['palaestra.html', 'palaestra-workout.html'],
      rows: { palaestra: ['pal:'] },
      snapshots: {
        prefix: 'palbak:', global: 'PalBackup',
        watch: ['pal:'], events: ['pal:save']
      },
      counted: [
        { key: 'pal:templates', label: 'routines' },
        { key: 'pal:exercises', label: 'exercises' },
        { key: 'pal:sessions',  label: 'workouts' },
        { key: 'pal:body',      label: 'measurements' },
        { key: 'pal:notes',     label: 'notes' },
        { key: 'pal:goals',     label: 'goals' }
      ]
    },
    {
      id: 'asclepion',
      label: 'The Asclepion',
      // One document since 2026-09-01. asclepion-session.html and
      // asclepion-journal.html were deleted when the studio became one
      // table; the pacer and the tapping session are overlays now.
      pages: ['asclepion.html'],
      // BOTH PREFIXES STAY, and always will. Journals, affirmations and
      // routines were retired with their records (asclepion-retire.js),
      // but a prefix is a delete list for a whole row: dropping one here
      // would take the five collections that are still live with it.
      rows: { asclepion: ['asc:'], asclepionlog: ['asclog:'] },
      snapshots: {
        prefix: 'bak:asc:', global: 'AscBackup',
        watch: ['asc:', 'asclog:'], events: ['asc:save', 'asclog:save']
      },
      // The retired keys are NOT counted. recovery.html reports a missing
      // counted key as a fault, and a key that was deliberately deleted
      // would report one forever.
      counted: [
        { key: 'asc:breath',      label: 'breathing techniques' },
        { key: 'asc:eft',         label: 'tapping scripts' },
        { key: 'asc:yoga',        label: 'movement' },
        { key: 'asc:energy',      label: 'energy practices' },
        { key: 'asc:custom',      label: 'your own activities' },
        { key: 'asclog:sessions', label: 'sessions' }
      ]
    },
    {
      id: 'larder',
      label: 'The Larder',
      pages: ['larder.html'],
      // The row key is still 'nutrition' on purpose — see larder-sync.js.
      rows: { nutrition: ['lar:', 'nutrition:'], larderlog: ['larlog:'] },
      snapshots: {
        prefix: 'larbak:', global: 'LarBackup',
        // `nutrition:` is the retired prefix that still holds real records.
        watch: ['lar:', 'larlog:', 'nutrition:'], events: ['lar:save', 'larlog:save']
      },
      counted: [
        { key: 'lar:foods',   label: 'foods' },
        { key: 'lar:meals',   label: 'saved meals' },
        { key: 'lar:recipes', label: 'recipes' },
        { key: 'lar:groceryItems', label: 'grocery items' },
        { key: 'larlog:log',       label: 'logged days' },
        { key: 'larlog:days',      label: 'day records' }
      ]
    },
    {
      id: 'athenaeum',
      label: 'The Athenaeum',
      pages: ['athenaeum.html', 'athenaeum-subject.html', 'athenaeum-curriculum.html',
              'athenaeum-resources.html', 'athenaeum-resource.html'],
      rows: { athenaeum: ['ath:'] },
      snapshots: {
        prefix: 'bak:ath:', global: 'AthBackup',
        watch: ['ath:'], events: ['ath:save']
      },
      counted: [
        { key: 'ath:subjects',  label: 'fields' },
        { key: 'ath:curricula', label: 'curricula' },
        { key: 'ath:modules',   label: 'modules' },
        { key: 'ath:lessons',   label: 'lessons' },
        { key: 'ath:resources', label: 'resources' },
        { key: 'ath:concepts',  label: 'concepts' }
      ]
    },
    {
      id: 'kdp',
      label: 'The Velvet Grimoire',
      pages: ['kdp.html', 'kdp-foundations.html', 'kdp-draft.html',
              'kdp-continuity.html', 'kdp-publish.html'],
      // Two rows: the manuscript is split out so prose does not re-upload
      // the metadata on every keystroke. Same reasoning as futureself.
      rows: { kdp: ['kdp:'], kdpms: ['kdpms:'] },
      snapshots: {
        prefix: 'bak:kdp:', global: 'KdpBackup',
        watch: ['kdp:', 'kdpms:'], events: ['kdp:save']
      },
      counted: [
        { key: 'kdp:trilogies',  label: 'trilogies' },
        { key: 'kdp:books',      label: 'books' },
        { key: 'kdp:chapters',   label: 'chapters' },
        { key: 'kdp:characters', label: 'characters' },
        { key: 'kdp:notes',      label: 'notes' }
      ]
    },
    {
      id: 'promptarium',
      label: 'Prompt Studio',
      pages: ['promptarium.html'],
      rows: { promptarium: ['prm:'], codex: ['cdx:'] },
      snapshots: {
        prefix: 'prmbak:', global: 'PromptariumBackup',
        // cdx: is watched here too. Prompt Studio mounts The Codex's row
        // read-write, so a bad push on this page can take the fiction
        // manuscript with it, and prmbak: was only ever copying prm:.
        watch: ['prm:', 'cdx:'], events: ['prm:save', 'cdx:save']
      },
      counted: [
        { key: 'prm:prompts',     label: 'prompts' },
        { key: 'prm:collections', label: 'collections' },
        { key: 'prm:workflows',   label: 'workflows' },
        { key: 'prm:tools',       label: 'tools' },
        { key: 'cdx:prompts',     label: 'fiction prompts' }
      ]
    },
    {
      id: 'vault',
      label: 'The Vault',
      pages: ['vault.html'],
      rows: { vault: ['vault:'] },
      snapshots: {
        prefix: 'bak:vault:', global: 'VaultBackup',
        watch: ['vault:'], events: ['vault:save']
      },
      // One key per shelf: vault-data.js builds them as 'vault:media:' + shelf.
      counted: ['podcasts', 'creepypasta', 'trueHorror', 'spicy', 'immersive',
                'watch', 'playlists', 'reading', 'anime', 'games'].map(function (s) {
        return { key: 'vault:media:' + s, label: s };
      })
    },
    {
      id: 'businessos',
      label: 'Business OS',
      pages: ['businessos.html'],
      rows: { businessos: ['bos:'] },
      snapshots: {
        prefix: 'bak:bos:', global: 'BosBackup',
        watch: ['bos:'], events: ['bos:save']
      },
      counted: [
        { key: 'bos:businesses', label: 'businesses' },
        { key: 'bos:projects',   label: 'projects' },
        { key: 'bos:tasks',      label: 'tasks' },
        { key: 'bos:notes',      label: 'notes' },
        { key: 'bos:content',    label: 'content' },
        { key: 'bos:knowledge',  label: 'knowledge' }
      ]
    },
    {
      id: 'learninghub',
      label: 'Learning Dashboard',
      pages: ['learning-dashboard.html'],
      rows: { learninghub: ['lhub:'] },
      snapshots: {
        prefix: 'bak:lhub:', global: 'LhubBackup',
        watch: ['lhub:'], events: ['lhub:save']
      },
      counted: [
        { key: 'lhub:topics',      label: 'topics' },
        { key: 'lhub:masterNotes', label: 'master notes' },
        { key: 'lhub:notes',       label: 'notes' },
        { key: 'lhub:research',    label: 'research' },
        { key: 'lhub:frameworks',  label: 'frameworks' },
        { key: 'lhub:dailyLogs',   label: 'daily logs' }
      ]
    }
  ];

  // -----------------------------------------------------------------
  // LOOKUPS
  // -----------------------------------------------------------------
  function app(id) {
    for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i];
    return null;
  }

  function prefixesOf(a) {
    var out = [];
    if (!a || !a.rows) return out;
    Object.keys(a.rows).forEach(function (row) {
      a.rows[row].forEach(function (p) { if (out.indexOf(p) === -1) out.push(p); });
    });
    return out;
  }

  /** Every synced prefix in the whole dashboard, deduped. */
  function allSyncedPrefixes() {
    var out = [];
    APPS.forEach(function (a) {
      prefixesOf(a).forEach(function (p) { if (out.indexOf(p) === -1) out.push(p); });
    });
    return out.sort();
  }

  /** The prefixes an app mounts but does not own — see Main's `borrows`. */
  function borrowsPrefix(a, p) {
    return !!(a.borrows && a.borrows.indexOf(p) !== -1);
  }

  /** Which app OWNS a storage key, or null. Longest prefix wins, so
      'nutrition:' resolves to The Larder rather than to nothing; a
      borrowed prefix loses to the app that owns it. */
  function appForKey(k) {
    if (!k) return null;
    var best = null, bestLen = -1, bestBorrowed = true;
    APPS.forEach(function (a) {
      prefixesOf(a).forEach(function (p) {
        if (k.indexOf(p) !== 0) return;
        var borrowed = borrowsPrefix(a, p);
        // A longer prefix always wins; at equal length, ownership beats
        // borrowing, so `pal:` resolves to The Palaestra and not to Main.
        if (p.length > bestLen || (p.length === bestLen && bestBorrowed && !borrowed)) {
          best = a; bestLen = p.length; bestBorrowed = borrowed;
        }
      });
    });
    return best;
  }

  /**
   * THE RULE EVERY PROTECTION STORE DEPENDS ON.
   *
   * sync.js matches with k.indexOf(prefix) === 0 and applyRemote() deletes
   * every local key the incoming row does not carry. A snapshot or trash
   * store living under a prefix that some synced prefix matches would be
   * destroyed by the exact event it exists to survive — and `pal:` vs
   * `palbak:` is one character away from being that mistake.
   *
   * Checking this by eye is how it eventually goes wrong, so it is checked
   * at runtime instead, and a failure THROWS rather than degrading: a
   * silently unprotected store is worse than a page that refuses to boot.
   *
   * @param {string} prefix the local-only prefix to prove safe
   * @param {string} who    caller name, for the error message
   */
  function assertLocalOnly(prefix, who) {
    if (!prefix || prefix.charAt(prefix.length - 1) !== ':') {
      throw new Error((who || 'data-registry') + ': local-only prefix "' +
        prefix + '" must end in ":"');
    }
    var synced = allSyncedPrefixes();
    for (var i = 0; i < synced.length; i++) {
      // Would a key under `prefix` be collected by `synced[i]`?
      if (prefix.indexOf(synced[i]) === 0) {
        throw new Error((who || 'data-registry') + ': "' + prefix +
          '" would be swallowed by the synced prefix "' + synced[i] +
          '" — sync.js would push it to the cloud and applyRemote would delete it');
      }
    }
    return true;
  }

  /** The app this document belongs to, from the `pages` lists above. */
  function appForPage(file) {
    var f = file;
    if (!f) {
      try { f = location.pathname.split('/').pop() || 'index.html'; } catch (e) { return null; }
    }
    if (!f) f = 'index.html';
    for (var i = 0; i < APPS.length; i++) {
      if ((APPS[i].pages || []).indexOf(f) !== -1) return APPS[i];
    }
    return null;
  }

  global.DataRegistry = {
    APPS: APPS,
    appForPage: appForPage,
    LOCAL_ONLY: LOCAL_ONLY,
    app: app,
    prefixesOf: prefixesOf,
    borrowsPrefix: borrowsPrefix,
    allSyncedPrefixes: allSyncedPrefixes,
    appForKey: appForKey,
    assertLocalOnly: assertLocalOnly
  };
})(window);
