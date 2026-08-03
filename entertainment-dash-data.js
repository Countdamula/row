// entertainment-dash-data.js
//
// Data layer for entertainment-dash.html — the single merged
// Entertainment dashboard that replaced the old five-page Entertainment
// folder (ent-podcasts.html/ent-stories.html/ent-entertainment.html/
// ent-playlists.html/ent-favorites.html, all deleted). This file has
// two jobs:
//
//   1. Three genuinely new databases the old folder never had — Reading
//      Corner, Anime, Games — each its own flat collection under its
//      own `entdash:*` key (entdash:reading / entdash:anime /
//      entdash:games), same model-factory + makeCollection conventions
//      as every other -data.js in this app.
//   2. A unified REGISTRY + dispatch layer sitting on top of BOTH this
//      file's own three collections AND entertainment-hub-data.js's
//      eight (podcasts/horrorReading/horrorWatch/spicyReading/
//      spicyWatch/storiesImmersive/entertainment/playlists) — the
//      thing that makes Home/Discovery Engine/Favorites/Statistics
//      genuinely cross-category instead of each needing its own
//      bespoke aggregation. entertainment-hub-data.js's own EntItem
//      shape has no `status` field (it was only ever favorite+rating);
//      Reading/Anime/Games DO track a want/in-progress/done status —
//      REGISTRY.hasStatus flags which categories support status
//      filtering/editing so the UI can show or hide those controls
//      correctly per category, rather than faking a status field on
//      data that was never designed to carry one.
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
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('entdash:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // PAGE CONFIG — Reading Corner / Anime / Games. Each has its own
  // creator-field label, genre list (reused as the subtopic filter
  // chips), a length-field label, and status wording — all three share
  // the same underlying status enum ('want'|'progress'|'done') so one
  // generic status control works everywhere, just relabeled per
  // category ("Want To Read" vs. "Plan To Watch" vs. "Backlog", etc.).
  // ============================================================
  const STATUS_KEYS = ['want', 'progress', 'done'];
  const PAGES = {
    reading: {
      key: 'reading', storageKey: 'entdash:reading', label: 'Reading Corner', icon: '📚',
      creatorLabel: 'Author', lengthLabel: 'Pages',
      genres: ['Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Self-Help', 'Business', 'Biography', 'Mystery / Thriller', 'Other'],
      statusLabels: { want: 'Want To Read', progress: 'Reading', done: 'Read' }
    },
    anime: {
      key: 'anime', storageKey: 'entdash:anime', label: 'Anime', icon: '🎴',
      creatorLabel: 'Studio', lengthLabel: 'Episodes',
      genres: ['Action', 'Romance', 'Slice of Life', 'Isekai', 'Shonen', 'Fantasy', 'Horror', 'Comedy', 'Other'],
      statusLabels: { want: 'Plan To Watch', progress: 'Watching', done: 'Watched' }
    },
    games: {
      key: 'games', storageKey: 'entdash:games', label: 'Games', icon: '🎮',
      creatorLabel: 'Developer / Platform', lengthLabel: 'Hours Played',
      genres: ['RPG', 'Action', 'Strategy', 'Puzzle', 'Indie', 'Open World', 'Horror', 'Simulation', 'Other'],
      statusLabels: { want: 'Backlog', progress: 'Playing', done: 'Completed' }
    }
  };
  const PAGE_ORDER = ['reading', 'anime', 'games'];

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
      storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = itemModel(pageKey, Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
      storeSet(key, all);
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

  const COLLECTIONS = {};
  PAGE_ORDER.forEach(function (k) { COLLECTIONS[k] = makeCollection(k); });
  function collectionFor(pageKey) { return COLLECTIONS[pageKey]; }

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
  function seedDefaultData() {
    PAGE_ORDER.forEach(function (pk) { collectionFor(pk).replaceAll([]); });

    seedItem('reading', 'Fantasy', 'The Name of the Wind', 'Patrick Rothfuss', 'reading');
    seedItem('reading', 'Non-Fiction', 'Atomic Habits', 'James Clear', 'done');
    seedItem('reading', 'Sci-Fi', 'Project Hail Mary', 'Andy Weir', 'want');

    seedItem('anime', 'Shonen', 'Fullmetal Alchemist: Brotherhood', 'Bones', 'done');
    seedItem('anime', 'Slice of Life', 'Mushishi', 'Artland', 'want');
    seedItem('anime', 'Isekai', 'Re:Zero', 'White Fox', 'progress');

    seedItem('games', 'RPG', 'Baldur\'s Gate 3', 'Larian Studios', 'progress');
    seedItem('games', 'Open World', 'The Legend of Zelda: Breath of the Wild', 'Nintendo', 'done');
    seedItem('games', 'Indie', 'Hollow Knight', 'Team Cherry', 'want');

    storeSet('entdash:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('entdash:seeded')) return;
    const anyData = PAGE_ORDER.some(function (pk) { return collectionFor(pk).list().length > 0; });
    if (anyData) { storeSet('entdash:seeded', true); return; }
    seedDefaultData();
  }

  // ============================================================
  // REGISTRY — unifies entertainment-hub-data.js's 8 pages with this
  // file's own 3 into one 11-entry lookup, in the order the dashboard's
  // tabs render. Built once, at load time — EntHub must already be
  // loaded (see this file's own header comment on script order).
  // ============================================================
  const ENTHUB_KEYS = ['podcasts', 'horrorReading', 'horrorWatch', 'spicyReading', 'spicyWatch', 'storiesImmersive', 'entertainment', 'playlists'];
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
