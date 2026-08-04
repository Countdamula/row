// entertainment-games-data.js
//
// Games' own, genuinely standalone database — pulled OUT of
// entertainment-dash-data.js's generic REGISTRY/dispatch system per an
// explicit request ("completely separate the Reading Corner, Anime, and
// Games into its own database"), the same treatment Reading Corner
// already got in an earlier session (see entertainment-reading-data.js's
// own header comment for that precedent) and Anime just got in this same
// session (see entertainment-anime-data.js — this file is its structural
// twin, own storage key and own config only). Same model-factory +
// hand-rolled collection conventions as every other -data.js in this
// app; own storage key (entgames:items), own one-time migration off the
// old entdash:games collection, own seed, own stats.
//
// This is a clean, self-contained parallel file, not a shared module —
// this repo has no cross-file import mechanism (no build step, see
// CLAUDE.md §1), so the same small amount of collection boilerplate this
// app already duplicates across dozens of -data.js files is duplicated
// here and in entertainment-anime-data.js too, rather than inventing a
// new shared library just for these two.
//
// Loaded after entertainment-dash-data.js on entertainment-dash.html —
// that file keeps a bare collectionFor('games')-equivalent alive
// (reading its own old entdash:games key) purely so this file's own
// migration below has a real source to read from; nothing here depends
// on any of entertainment-dash-data.js's dispatch/REGISTRY machinery.
// Sync: covered by entertainment-dash.html's existing initCloudSync call
// gaining 'entgames:' in its syncedPrefixes — no second sync mechanism.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('entgames:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('entgames:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  const KEY = 'entgames:items';
  const STATUS_KEYS = ['want', 'progress', 'done'];
  const CFG = {
    key: 'games', label: 'Games', icon: '🎮',
    creatorLabel: 'Developer / Platform', lengthLabel: 'Hours Played',
    genres: ['RPG', 'Action', 'Strategy', 'Puzzle', 'Indie', 'Open World', 'Horror', 'Simulation', 'Other'],
    statusLabels: { want: 'Backlog', progress: 'Playing', done: 'Completed' }
  };

  function itemModel(data) {
    data = data || {};
    const rating = Math.max(0, Math.min(5, Math.round(Number(data.rating) || 0)));
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('gm'),
      title: typeof data.title === 'string' ? data.title : '',
      creator: typeof data.creator === 'string' ? data.creator : '',
      url: typeof data.url === 'string' ? data.url : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      lengthText: typeof data.lengthText === 'string' ? data.lengthText : '',
      notesText: typeof data.notesText === 'string' ? data.notesText : '',
      subtopic: (CFG.genres.indexOf(data.subtopic) !== -1) ? data.subtopic : CFG.genres[0],
      status: (STATUS_KEYS.indexOf(data.status) !== -1) ? data.status : 'want',
      rating: rating,
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt
    };
  }

  function list() { return storeGet(KEY) || []; }
  function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
  function add(data) {
    const record = itemModel(data);
    const all = list();
    all.push(record);
    if (!storeSet(KEY, all)) return null;
    return record;
  }
  function update(id, patch) {
    const all = list();
    const idx = all.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return null;
    all[idx] = itemModel(Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
    if (!storeSet(KEY, all)) return null;
    return all[idx];
  }
  function remove(id) {
    const all = list();
    const next = all.filter(function (x) { return x.id !== id; });
    storeSet(KEY, next);
    return next.length !== all.length;
  }
  function replaceAll(records) { storeSet(KEY, records); }

  function items() { return list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function favorites() { return items().filter(function (x) { return x.favorite; }); }
  function nextOrder() {
    const all = list();
    return all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
  }
  function reorderVisible(visibleOrderedIds) {
    const all = list();
    const visibleSet = {};
    visibleOrderedIds.forEach(function (id, i) { visibleSet[id] = i; });
    const visibleItems = all.filter(function (x) { return visibleSet.hasOwnProperty(x.id); })
      .sort(function (a, b) { return visibleSet[a.id] - visibleSet[b.id]; });
    const merged = all.slice().sort(function (a, b) { return a.order - b.order; });
    let vi = 0;
    const finalOrder = merged.map(function (x) { return visibleSet.hasOwnProperty(x.id) ? visibleItems[vi++] : x; });
    finalOrder.forEach(function (x, i) { x.order = i; });
    replaceAll(finalOrder);
  }
  function toggleFavorite(id) {
    const it = get(id);
    if (!it) return null;
    return update(id, { favorite: !it.favorite });
  }
  function setRating(id, rating) { return update(id, { rating: rating }); }
  function setStatus(id, status) { return update(id, { status: status }); }

  function computeStats() {
    const all = items();
    const statusBreakdown = { want: 0, progress: 0, done: 0 };
    let favCount = 0, ratedCount = 0, ratingSum = 0;
    all.forEach(function (x) {
      statusBreakdown[x.status] = (statusBreakdown[x.status] || 0) + 1;
      if (x.favorite) favCount++;
      if (x.rating) { ratedCount++; ratingSum += x.rating; }
    });
    return {
      total: all.length, favorites: favCount,
      avgRating: ratedCount ? (ratingSum / ratedCount) : 0,
      statusBreakdown: statusBreakdown
    };
  }

  // ============================================================
  // MIGRATION — folds any real pre-existing items from the old, now-
  // retired entertainment-dash-data.js 'entdash:games' collection into
  // this file's own entgames:items, once. Same "read a dead key raw,
  // migrate into a live one" precedent as entertainment-anime-data.js's
  // own migration. Guarded so it only ever runs once per device; the old
  // key is left in place afterward, orphaned but untouched.
  // ============================================================
  function migrateOldGamesIntoOwnDatabase() {
    let done = false;
    try { done = localStorage.getItem('entgames:migratedV1') === 'true'; } catch (e) {}
    if (done) return;
    const old = storeGet('entdash:games');
    if (!Array.isArray(old) || !old.length) { try { localStorage.setItem('entgames:migratedV1', 'true'); } catch (e) {} return; }
    let allOk = true;
    old.forEach(function (item) {
      if (!item) return;
      const added = add({
        title: item.title, creator: item.creator, url: item.url, cover: item.cover,
        description: item.description, lengthText: item.lengthText, notesText: item.notesText,
        subtopic: item.subtopic, status: item.status, rating: item.rating, favorite: item.favorite,
        order: nextOrder()
      });
      if (!added) allOk = false;
    });
    if (allOk) { try { localStorage.setItem('entgames:migratedV1', 'true'); } catch (e) {} }
  }
  migrateOldGamesIntoOwnDatabase();

  // ============================================================
  // SEED — same "real, recognizable titles as placeholders, no
  // fabricated URL/cover" precedent this app's own galleries already
  // follow.
  // ============================================================
  function seedDefaultData() {
    replaceAll([]);
    add({ title: 'Baldur\'s Gate 3', creator: 'Larian Studios', subtopic: 'RPG', status: 'progress', order: 0 });
    add({ title: 'The Legend of Zelda: Breath of the Wild', creator: 'Nintendo', subtopic: 'Open World', status: 'done', order: 1 });
    add({ title: 'Hollow Knight', creator: 'Team Cherry', subtopic: 'Indie', status: 'want', order: 2 });
    storeSet('entgames:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('entgames:seeded')) return;
    if (list().length) { storeSet('entgames:seeded', true); return; }
    seedDefaultData();
  }

  function migratePhotosToStorage() {
    if (!global.PhotoStore) return;
    let already = false;
    try { already = localStorage.getItem('entgames:photosMigratedV1') === 'true'; } catch (e) {}
    if (already) return;
    const jobs = [];
    list().forEach(function (item) {
      if (typeof item.cover === 'string' && item.cover.indexOf('data:') === 0) {
        const orig = item.cover, id = item.id;
        jobs.push(global.PhotoStore.upload(orig).then(function (url) {
          if (!url) return false;
          const fresh = get(id);
          if (fresh && fresh.cover === orig) update(id, { cover: url });
          return true;
        }));
      }
    });
    if (!jobs.length) { try { localStorage.setItem('entgames:photosMigratedV1', 'true'); } catch (e) {} return; }
    Promise.all(jobs).then(function (results) {
      if (results.every(function (ok) { return ok; })) { try { localStorage.setItem('entgames:photosMigratedV1', 'true'); } catch (e) {} }
    });
  }

  // Same empty-storage seed-race-safety window every other page in this
  // app already uses — don't seed until either real cloud data has
  // actually arrived, or a generous window has elapsed with nothing.
  function maybeSeedAfterSyncAttempt(remoteAppliedRef) {
    setTimeout(function () {
      if (remoteAppliedRef.applied) return;
      if (list().length) return;
      seedIfEmpty();
    }, 5000);
  }

  global.EntGames = {
    KEY: 'games', CFG: CFG, STATUS_KEYS: STATUS_KEYS,
    list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll,
    items: items, favorites: favorites, nextOrder: nextOrder, reorderVisible: reorderVisible,
    toggleFavorite: toggleFavorite, setRating: setRating, setStatus: setStatus,
    computeStats: computeStats,
    migratePhotosToStorage: migratePhotosToStorage,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty,
    maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt
  };
})(window);
