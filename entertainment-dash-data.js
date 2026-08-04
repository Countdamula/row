// entertainment-dash-data.js
//
// Data layer for entertainment-dash.html — the single merged
// Entertainment dashboard that replaced the old five-page Entertainment
// folder (ent-podcasts.html/ent-stories.html/ent-entertainment.html/
// ent-playlists.html/ent-favorites.html, all deleted). This file has two
// jobs:
//
//   1. A dwindling migration-source shape for Reading Corner only. Anime
//      and Games used to be two genuinely new databases native to this
//      file (entdash:anime / entdash:games) — per an explicit later
//      request ("completely separate the Reading Corner, Anime, and
//      Games into its own database"), BOTH have now been pulled out into
//      their own standalone files too, the same treatment Reading Corner
//      already got in an earlier session — see entertainment-anime-
//      data.js / entertainment-games-data.js / entertainment-reading-
//      data.js, all loaded right after this file. This file no longer
//      owns any collection for any of the three. PAGES.reading/
//      itemModel('reading') stay defined below only because
//      migrateHorrorSpicyReadingIntoReadingCorner() (below) still needs
//      somewhere to land Horror/Spicy Stories · Reading items, which
//      entertainment-reading-data.js's own one-time migration then folds
//      into entread:books. Anime/Games needed no equivalent shape kept
//      here — their own new files read the raw old entdash:anime/
//      entdash:games keys directly (the same "read a dead key raw"
//      precedent already used for Reading), so this file's own PAGES/
//      PAGE_ORDER no longer mention either at all.
//   2. A unified REGISTRY + dispatch layer sitting on top of
//      entertainment-hub-data.js's own live pages (podcasts/
//      horrorWatchCreepypasta/horrorWatchTrue/spicyWatch/
//      storiesImmersive/entertainment/playlists — see that file's own
//      header for why horrorReading/spicyReading/horrorWatch themselves
//      are gone) — the thing that makes Home/Discovery Engine/
//      Favorites/Statistics genuinely cross-category instead of each
//      needing its own bespoke aggregation. Reading Corner, Anime, and
//      Games are all deliberately NOT part of this cross-category system
//      anymore (see point 1 above) — each has its own dedicated
//      Favorites-equivalent/stats inside its own standalone file
//      instead. `PAGE_ORDER` is now permanently `[]` (this file owns no
//      native collections at all going forward), so REGISTRY/
//      GALLERY_KEYS only ever contain the 7 enthub-sourced galleries.
//      Horror Stories/Spicy Stories · Reading moved INTO Reading
//      Corner's own collection per an explicit request — see
//      migrateHorrorSpicyReadingIntoReadingCorner() below.
//
// Loaded AFTER entertainment-hub-data.js on entertainment-dash.html (a
// deferred <script> tag ordering guarantee) — this file's own top-level
// buildRegistry() call reads window.EntHub.PAGES directly, the same
// "read another already-loaded page's own public API" precedent this
// app's other cross-file dependencies already use.
//
// Sync: a second, independent initCloudSync({appKey:'entdash',
// syncedPrefixes:['entdash:']}) call — sync.js supports more than one
// call per page (each closure tracks its own dirty keys against its own
// prefix list; a second call's captured localStorage.setItem is already
// the first call's wrapper, so writes chain through both correctly) —
// wired directly from entertainment-dash.html, not from this file,
// matching how entertainment-hub-data.js's own bootSync() is also
// called from its own pages rather than auto-running on load.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('entdash:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('entdash:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // PAGE CONFIG — Reading Corner only, now. Anime and Games used to have
  // entries here too (same shape) but both have been pulled out into
  // their own standalone files — see this file's own header comment.
  // ============================================================
  const STATUS_KEYS = ['want', 'progress', 'done'];
  const PAGES = {
    reading: {
      key: 'reading', storageKey: 'entdash:reading', label: 'Reading Corner', icon: '📚',
      creatorLabel: 'Author', lengthLabel: 'Pages',
      // 'Horror'/'Spicy' added per an explicit request to move Horror
      // Stories · Reading and Spicy Stories · Reading (formerly their
      // own pages in entertainment-hub-data.js) in here — see
      // migrateHorrorSpicyReadingIntoReadingCorner() below, which lands
      // migrated items in one of these two genres.
      genres: ['Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Self-Help', 'Business', 'Biography', 'Mystery / Thriller', 'Horror', 'Spicy', 'Other'],
      statusLabels: { want: 'Want To Read', progress: 'Reading', done: 'Read' }
    }
  };
  // Deliberately empty, permanently — Reading Corner, Anime, and Games
  // have ALL been pulled out of this generic REGISTRY/dispatch system
  // into their own standalone database files (Reading: Library/TBR/
  // Series/Authors/Quotes/Reading Goals/Stats, see entertainment-reading-
  // data.js; Anime/Games: their own simpler single-page databases, see
  // entertainment-anime-data.js/entertainment-games-data.js). Nothing
  // native to this file remains, so REGISTRY/GALLERY_KEYS (built from
  // this array, below) only ever contain the 7 enthub-sourced galleries
  // going forward.
  const PAGE_ORDER = [];

  // ============================================================
  // MODEL — same field shape as entertainment-hub-data.js's EntItem,
  // plus a `status` field (own-native categories only).
  // ============================================================
  function itemModel(pageKey, data) {
    data = data || {};
    const cfg = PAGES[pageKey];
    const genres = cfg ? cfg.genres : [];
    const rating = Math.max(0, Math.min(5, Math.round(Number(data.rating) || 0)));
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('di'),
      title: typeof data.title === 'string' ? data.title : '',
      creator: typeof data.creator === 'string' ? data.creator : '',
      url: typeof data.url === 'string' ? data.url : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      lengthText: typeof data.lengthText === 'string' ? data.lengthText : '',
      notesText: typeof data.notesText === 'string' ? data.notesText : '',
      subtopic: (genres.indexOf(data.subtopic) !== -1) ? data.subtopic : (genres[0] || ''),
      status: (STATUS_KEYS.indexOf(data.status) !== -1) ? data.status : 'want',
      rating: rating,
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt
    };
  }

  function makeCollection(pageKey) {
    const cfg = PAGES[pageKey];
    const key = cfg.storageKey;
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = itemModel(pageKey, data);
      const all = list();
      all.push(record);
      // A caller (entertainment-dash.html's saveItemModal()) needs to be
      // able to tell "this genuinely saved" from "this looked like it
      // worked but never actually persisted" — the latter is exactly
      // what a silent storeSet() failure (most likely a full localStorage
      // quota — see photo-store.js's own header) used to look like: the
      // modal closed, the item just never showed up, no error anywhere.
      if (!storeSet(key, all)) return null;
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = itemModel(pageKey, Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
      if (!storeSet(key, all)) return null;
      return all[idx];
    }
    function remove(id) {
      const all = list();
      const next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  // 'reading' is built here too, alongside PAGE_ORDER's own two keys,
  // 'reading' is the only key built here now — it's not a tab anymore
  // (PAGE_ORDER is permanently empty, see this file's own header
  // comment), but migrateHorrorSpicyReadingIntoReadingCorner() below
  // still needs a real collectionFor('reading') to write into. Anime/
  // Games needed no equivalent entry — their own new files read the raw
  // old entdash:anime/entdash:games keys directly instead (see
  // entertainment-anime-data.js/entertainment-games-data.js).
  const COLLECTIONS = {};
  ['reading'].forEach(function (k) { COLLECTIONS[k] = makeCollection(k); });
  function collectionFor(pageKey) { return COLLECTIONS[pageKey]; }

  // One-time backfill for this file's own remaining native collection
  // (Reading Corner's legacy entdash:reading key only, now — Anime/Games
  // each have their own copy of this same function in their own file) —
  // same shape as EntHub's own migratePhotosToStorage()
  // (entertainment-hub-data.js). Iterates PAGE_ORDER, which is
  // permanently empty (see this file's own header comment), so in
  // practice this is now a harmless permanent no-op — left in place
  // (and still exported/called from entertainment-dash.html's boot())
  // rather than removed, since deleting it isn't necessary to fix
  // anything and would just be unrelated churn.
  function migratePhotosToStorage() {
    if (!global.PhotoStore) return;
    var already = false;
    try { already = localStorage.getItem('entdash:photosMigratedV1') === 'true'; } catch (e) {}
    if (already) return;
    var jobs = [];
    PAGE_ORDER.forEach(function (pageKey) {
      const coll = collectionFor(pageKey);
      coll.list().forEach(function (item) {
        if (typeof item.cover === 'string' && item.cover.indexOf('data:') === 0) {
          const orig = item.cover, id = item.id;
          jobs.push(global.PhotoStore.upload(orig).then(function (url) {
            if (!url) return false;
            const fresh = coll.get(id);
            if (fresh && fresh.cover === orig) coll.update(id, { cover: url });
            return true;
          }));
        }
      });
    });
    if (!jobs.length) { try { localStorage.setItem('entdash:photosMigratedV1', 'true'); } catch (e) {} return; }
    Promise.all(jobs).then(function (results) {
      if (results.every(function (ok) { return ok; })) {
        try { localStorage.setItem('entdash:photosMigratedV1', 'true'); } catch (e) {}
      }
    });
  }

  function itemsForPage(pageKey) {
    return collectionFor(pageKey).list().slice().sort(function (a, b) { return a.order - b.order; });
  }
  function favoritesForPage(pageKey) {
    return itemsForPage(pageKey).filter(function (x) { return x.favorite; });
  }
  function nextOrder(pageKey) {
    const list = collectionFor(pageKey).list();
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  // Same "reorder against the visible/filtered list, remap into the real
  // underlying order" technique entertainment-hub-data.js's own
  // reorderVisible() already uses — see that file's own comment.
  function reorderVisible(pageKey, visibleOrderedIds) {
    const all = collectionFor(pageKey).list();
    const visibleSet = {};
    visibleOrderedIds.forEach(function (id, i) { visibleSet[id] = i; });
    const visibleItems = all.filter(function (x) { return visibleSet.hasOwnProperty(x.id); })
      .sort(function (a, b) { return visibleSet[a.id] - visibleSet[b.id]; });
    const merged = all.slice().sort(function (a, b) { return a.order - b.order; });
    let vi = 0;
    const finalOrder = merged.map(function (x) {
      return visibleSet.hasOwnProperty(x.id) ? visibleItems[vi++] : x;
    });
    finalOrder.forEach(function (x, i) { x.order = i; });
    collectionFor(pageKey).replaceAll(finalOrder);
  }
  function toggleFavorite(pageKey, id) {
    const item = collectionFor(pageKey).get(id);
    if (!item) return null;
    return collectionFor(pageKey).update(id, { favorite: !item.favorite });
  }
  function setRating(pageKey, id, rating) {
    return collectionFor(pageKey).update(id, { rating: rating });
  }
  function setStatus(pageKey, id, status) {
    return collectionFor(pageKey).update(id, { status: status });
  }

  // ============================================================
  // SEED — a light starter set (real, recognizable titles as
  // placeholders), same "no fabricated URL/cover" precedent
  // entertainment-hub-data.js's own seed already follows.
  // ============================================================
  function seedItem(pageKey, subtopic, title, creator, status) {
    collectionFor(pageKey).add({
      title: title, creator: creator || '', subtopic: subtopic,
      status: status || 'want', order: nextOrder(pageKey)
    });
  }
  // Anime/Games no longer get seeded from here at all — collectionFor
  // ('anime')/collectionFor('games') don't exist anymore (removing them
  // from COLLECTIONS above would make those calls throw), and each now
  // has its own real seedDefaultData() in its own file
  // (entertainment-anime-data.js/entertainment-games-data.js), guarded
  // by its own empty-storage seed-race-safety window. The Reading Corner
  // seed below is legacy behavior, unchanged from before this session —
  // it writes into the now-dead entdash:reading key, which
  // entertainment-reading-data.js's own migration reads once; left as-is
  // rather than touched, since it isn't part of what this session's
  // request (separating Anime/Games) actually needed to change.
  function seedDefaultData() {
    PAGE_ORDER.forEach(function (pk) { collectionFor(pk).replaceAll([]); });

    seedItem('reading', 'Fantasy', 'The Name of the Wind', 'Patrick Rothfuss', 'reading');
    seedItem('reading', 'Non-Fiction', 'Atomic Habits', 'James Clear', 'done');
    seedItem('reading', 'Sci-Fi', 'Project Hail Mary', 'Andy Weir', 'want');
    // Horror/Spicy Reading example seeds, standing in for the old
    // horrorReading/spicyReading pages' own seed data — see PAGES.reading
    // .genres' own comment on the move.
    seedItem('reading', 'Horror', 'The Haunting of Hill House', 'Shirley Jackson', 'want');
    seedItem('reading', 'Spicy', 'A Court of Thorns and Roses', 'Sarah J. Maas', 'want');

    storeSet('entdash:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('entdash:seeded')) return;
    // PAGE_ORDER is permanently empty now, so this always evaluates
    // false — harmless: this whole function's real remaining purpose is
    // the one-time legacy Reading Corner seed above, which is gated by
    // the entdash:seeded flag itself, not by this check.
    const anyData = PAGE_ORDER.some(function (pk) { return collectionFor(pk).list().length > 0; });
    if (anyData) { storeSet('entdash:seeded', true); return; }
    seedDefaultData();
  }

  // ============================================================
  // MIGRATION — moves any real pre-existing Horror Stories · Reading /
  // Spicy Stories · Reading items into Reading Corner, per an explicit
  // request. Reads the RAW old 'enthub:horrorReading'/'enthub:
  // spicyReading' keys directly (entertainment-hub-data.js no longer has
  // live PAGES entries for either — see that file's own header comment)
  // rather than through EntHub's own collection API — the same "read a
  // dead key raw, migrate into a live one" precedent that file's own
  // migrateStoriesSplitIfNeeded() already established for 'enthub:
  // stories'. Guarded so it only ever runs once per device; both old
  // keys are left in place afterward, orphaned but untouched, same
  // treatment as every other superseded key elsewhere in this app. Runs
  // synchronously at load time (safe to run before this page's own cloud
  // pull, for the same reason entertainment-hub-data.js's own migrations
  // already document — a freshly-migrated item's id is brand-new and
  // just gets unioned in like any other local add). A real, disclosed
  // limitation shared with every other one-time migration in this app:
  // if this runs independently on two different devices before either
  // has synced, duplicates can result — an accepted tradeoff, not
  // something unique to this migration.
  //
  // Bugfix: on a device whose shared localStorage quota is already full
  // (a real, reported failure — see storage-cleanup.js's own header),
  // collectionFor('reading').add(...) fails silently (storeSet() catches
  // the QuotaExceededError and returns null — see makeCollection() above)
  // but this function used to ignore that and unconditionally mark
  // itself done anyway, permanently abandoning the migration with
  // nothing actually saved. The flag below is now per-half
  // ({horror,spicy}, not a bare boolean) and only ever marks a half done
  // once every item in it was confirmed to actually persist — a half
  // that fails this load simply retries next load, once space is freed.
  // A device that already has the old bare `true` from before this fix
  // is treated as "both halves already claimed done" (its most likely
  // real state — the tiny few-byte flag write itself would usually still
  // fit even when the much larger `entdash:reading` array write just
  // failed) rather than silently re-migrating and risking duplicates for
  // the — hopefully rare — device where that guess is wrong.
  // ============================================================
  function migrateHorrorSpicyReadingIntoReadingCorner() {
    let done = storeGet('entdash:horrorSpicyReadingMigratedV1');
    if (done === true) done = { horror: true, spicy: true };
    if (!done || typeof done !== 'object') done = {};
    const genres = PAGES.reading.genres;
    let changed = false;
    [['enthub:horrorReading', 'Horror', 'horror'], ['enthub:spicyReading', 'Spicy', 'spicy']].forEach(function (pair) {
      const oldKey = pair[0], genre = pair[1], doneKey = pair[2];
      if (done[doneKey]) return;
      const old = storeGet(oldKey);
      if (!Array.isArray(old) || !old.length) { done[doneKey] = true; changed = true; return; }
      const already = collectionFor('reading').list();
      let allOk = true;
      old.forEach(function (item) {
        if (!item) return;
        // Cheap content-based dedupe (title+creator+subtopic), so a
        // retry after a partial failure can't re-add items that already
        // made it in during a previous, only-partly-successful attempt.
        const subtopic = genres.indexOf(genre) !== -1 ? genre : genres[0];
        const dup = already.some(function (r) {
          return r.title === (item.title || '') && r.creator === (item.creator || '') && r.subtopic === subtopic;
        });
        if (dup) return;
        const added = collectionFor('reading').add({
          title: item.title, creator: item.creator, url: item.url, cover: item.cover,
          description: item.description, lengthText: item.lengthText, notesText: item.notesText,
          rating: item.rating, favorite: item.favorite, order: nextOrder('reading'),
          subtopic: subtopic,
          status: 'want'
        });
        if (added) { already.push(added); } else { allOk = false; }
      });
      if (allOk) { done[doneKey] = true; changed = true; }
    });
    if (changed) storeSet('entdash:horrorSpicyReadingMigratedV1', done);
  }
  migrateHorrorSpicyReadingIntoReadingCorner();

  // ============================================================
  // REGISTRY — unifies entertainment-hub-data.js's live pages with this
  // file's own 3 into one lookup, in the order the dashboard's tabs
  // render. Built once, at load time — EntHub must already be loaded
  // (see this file's own header comment on script order). Horror
  // Stories/Spicy Stories · Reading were removed from here per an
  // explicit request — see migrateHorrorSpicyReadingIntoReadingCorner()
  // below — and Horror Stories · YouTube is now the two pages that
  // replaced it, horrorWatchCreepypasta/horrorWatchTrue (see
  // entertainment-hub-data.js's own header comment on that split).
  // ============================================================
  const ENTHUB_KEYS = ['podcasts', 'horrorWatchCreepypasta', 'horrorWatchTrue', 'spicyWatch', 'storiesImmersive', 'entertainment', 'playlists'];
  let REGISTRY = {};
  let GALLERY_KEYS = [];
  function buildRegistry() {
    const reg = {};
    const order = [];
    const EH = global.EntHub;
    ENTHUB_KEYS.forEach(function (k) {
      const p = EH && EH.PAGES && EH.PAGES[k];
      if (!p) return;
      reg[k] = { source: 'enthub', key: k, label: p.label, icon: p.icon, subtopics: p.subtopics, hasStatus: false };
      order.push(k);
    });
    PAGE_ORDER.forEach(function (k) {
      const p = PAGES[k];
      reg[k] = {
        source: 'entdash', key: k, label: p.label, icon: p.icon, subtopics: p.genres, hasStatus: true,
        statusLabels: p.statusLabels, creatorLabel: p.creatorLabel, lengthLabel: p.lengthLabel
      };
      order.push(k);
    });
    return { reg: reg, order: order };
  }

  // ============================================================
  // DISPATCH — the one thing the HTML page actually calls for anything
  // cross-cutting (Home/Discovery/Favorites/Statistics, and every
  // gallery tab's shared render function). Routes to EntHub or this
  // file's own collections based on REGISTRY[key].source.
  // ============================================================
  function listItems(key) {
    const r = REGISTRY[key];
    if (!r) return [];
    return r.source === 'enthub' ? global.EntHub.itemsForPage(key) : itemsForPage(key);
  }
  function addItemAny(key, data) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.collectionFor(key).add(data) : collectionFor(key).add(data);
  }
  function updateItemAny(key, id, patch) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.collectionFor(key).update(id, patch) : collectionFor(key).update(id, patch);
  }
  function removeItemAny(key, id) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.collectionFor(key).remove(id) : collectionFor(key).remove(id);
  }
  function reorderVisibleAny(key, ids) {
    const r = REGISTRY[key];
    if (r.source === 'enthub') global.EntHub.reorderVisible(key, ids); else reorderVisible(key, ids);
  }
  function toggleFavoriteAny(key, id) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.toggleFavorite(key, id) : toggleFavorite(key, id);
  }
  function setRatingAny(key, id, rating) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.setRating(key, id, rating) : setRating(key, id, rating);
  }
  function setStatusAny(key, id, status) {
    const r = REGISTRY[key];
    if (!r || !r.hasStatus) return null;
    return setStatus(key, id, status);
  }
  function nextOrderAny(key) {
    const r = REGISTRY[key];
    return r.source === 'enthub' ? global.EntHub.nextOrder(key) : nextOrder(key);
  }

  function allFavoritesAcross() {
    const out = [];
    GALLERY_KEYS.forEach(function (key) {
      listItems(key).filter(function (x) { return x.favorite; }).forEach(function (item) {
        out.push(Object.assign({}, item, { _categoryKey: key }));
      });
    });
    return out.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }
  function allItemsAcross(filterKey) {
    const keys = (filterKey && filterKey !== 'all') ? [filterKey] : GALLERY_KEYS;
    const out = [];
    keys.forEach(function (key) {
      listItems(key).forEach(function (item) { out.push(Object.assign({}, item, { _categoryKey: key })); });
    });
    return out;
  }
  function recentlyAdded(limit) {
    return allItemsAcross(null).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, limit || 8);
  }
  function randomItem(opts) {
    opts = opts || {};
    let pool = allItemsAcross(opts.categoryKey);
    if (opts.minRating) pool = pool.filter(function (x) { return (x.rating || 0) >= opts.minRating; });
    if (opts.notCompletedOnly) {
      pool = pool.filter(function (x) {
        const r = REGISTRY[x._categoryKey];
        return !(r.hasStatus && x.status === 'done');
      });
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function computeStats() {
    let totalItems = 0, totalFavorites = 0, ratedCount = 0, ratingSum = 0;
    const perCategory = {};
    GALLERY_KEYS.forEach(function (key) {
      const items = listItems(key);
      totalItems += items.length;
      const favs = items.filter(function (x) { return x.favorite; }).length;
      totalFavorites += favs;
      items.forEach(function (x) { if (x.rating) { ratedCount++; ratingSum += x.rating; } });
      perCategory[key] = { count: items.length, favorites: favs };
    });
    const statusBreakdown = {};
    PAGE_ORDER.forEach(function (key) {
      const items = listItems(key);
      statusBreakdown[key] = {
        want: items.filter(function (x) { return x.status === 'want'; }).length,
        progress: items.filter(function (x) { return x.status === 'progress'; }).length,
        done: items.filter(function (x) { return x.status === 'done'; }).length
      };
    });
    return {
      totalItems: totalItems,
      totalFavorites: totalFavorites,
      avgRating: ratedCount ? (ratingSum / ratedCount) : 0,
      categoryCount: GALLERY_KEYS.length,
      perCategory: perCategory,
      statusBreakdown: statusBreakdown
    };
  }

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ============================================================
  // HERO — one editable cover-photo hero for the whole dashboard (not
  // per-category — there are 11 galleries plus Home/Discovery/
  // Favorites/Statistics, too many for a per-tab hero to make sense).
  // Same shape/precedent as every other page's own hero in this app.
  // ============================================================
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }
  function getHero() {
    const stored = storeGet('entdash:hero');
    return heroModel(Object.assign({
      eyebrow: 'Entertainment', title: 'Everything you read, watch, and play.',
      subtext: 'One dashboard for podcasts, stories, playlists, reading, anime, and games.',
      ctaLabel: 'Browse the Dashboard'
    }, stored || {}));
  }
  function saveHero(patch) {
    const next = heroModel(Object.assign({}, getHero(), patch));
    storeSet('entdash:hero', next);
    return next;
  }

  // ============================================================
  // BOOT — same empty-storage seed-race-safety window every other page
  // in this app already uses: don't seed (this file's own 3 categories)
  // until either real cloud data has actually arrived, or a generous
  // window has elapsed with nothing arriving.
  // ============================================================
  function maybeSeedAfterSyncAttempt(remoteAppliedRef) {
    setTimeout(function () {
      if (remoteAppliedRef.applied) return;
      const anyData = PAGE_ORDER.some(function (pk) { return collectionFor(pk).list().length > 0; });
      if (anyData) return;
      seedIfEmpty();
    }, 5000);
  }

  global.EntDash = {
    PAGES: PAGES,
    PAGE_ORDER: PAGE_ORDER,
    STATUS_KEYS: STATUS_KEYS,
    uid: uid,
    collectionFor: collectionFor,
    migratePhotosToStorage: migratePhotosToStorage,
    itemsForPage: itemsForPage,
    favoritesForPage: favoritesForPage,
    nextOrder: nextOrder,
    reorderVisible: reorderVisible,
    toggleFavorite: toggleFavorite,
    setRating: setRating,
    setStatus: setStatus,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty,
    maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt,
    slugify: slugify,
    getHero: getHero,
    saveHero: saveHero,
    // Cross-cutting unified API — built once EntHub is confirmed loaded,
    // via init() below.
    REGISTRY: null,
    GALLERY_KEYS: null,
    listItems: listItems,
    addItem: addItemAny,
    updateItem: updateItemAny,
    removeItem: removeItemAny,
    reorderVisibleAny: reorderVisibleAny,
    toggleFavoriteAny: toggleFavoriteAny,
    setRatingAny: setRatingAny,
    setStatusAny: setStatusAny,
    nextOrderAny: nextOrderAny,
    allFavoritesAcross: allFavoritesAcross,
    allItemsAcross: allItemsAcross,
    recentlyAdded: recentlyAdded,
    randomItem: randomItem,
    computeStats: computeStats
  };

  function init() {
    const built = buildRegistry();
    REGISTRY = built.reg;
    GALLERY_KEYS = built.order;
    global.EntDash.REGISTRY = REGISTRY;
    global.EntDash.GALLERY_KEYS = GALLERY_KEYS;
  }
  init();
})(window);
