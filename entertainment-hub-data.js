// entertainment-hub-data.js
//
// Shared data layer originally built for the standalone "Entertainment"
// nav folder (five pages — ent-podcasts.html/ent-stories.html/
// ent-entertainment.html/ent-playlists.html/ent-favorites.html). Those
// five pages, and their shared entertainment-hub-ui.js renderer, were
// deleted when the folder was merged into one page, `entertainment-dash
// .html` — but THIS file is kept and still actively used: it's the
// data layer that page's Podcasts/Stories(split)/Entertainment/
// Playlists sections read and write directly (via the same `EntHub.*`
// API below), AND `fitnessstudio.html`'s own music slide-out panel
// still reads `EntHub.itemsForPage('playlists')` — deleting this file
// would have broken that page too, so it stays, unmodified in shape,
// just with its PAGES config restructured (see below) and a new
// separate `entertainment-dash-data.js` sitting alongside it for the
// dashboard's own new categories (Reading Corner/Anime/Games) that have
// no natural home here.
//
// Real data change, first pass: Stories used to be one page/collection
// (`enthub:stories`, subtopics Horror Stories / Spicy Stories /
// Immersive Experience) — per an explicit request to "separate the
// reading and YouTube versions of Horror Stories and Spicy Stories,"
// it became FIVE real pages/collections: horrorReading, horrorWatch,
// spicyReading, spicyWatch, and storiesImmersive (kept as its own
// unsplit page — it wasn't asked to split, and "immersive experience"
// content is already inherently audio/video, not a reading-vs-watching
// distinction). `migrateStoriesSplitIfNeeded()` (below) is a one-time,
// guarded migration that distributed any real pre-existing
// `enthub:stories` items into those five by their old subtopic name.
//
// Real data change, second pass (this one): per an explicit follow-up,
// horrorReading and spicyReading are GONE as their own pages — moved
// into entertainment-dash-data.js's own Reading Corner (`entdash:
// reading`) instead, with 'Horror'/'Spicy' added to that collection's
// genre list so migrated items land in a real, dedicated genre rather
// than a generic catch-all. That migration lives in
// entertainment-dash-data.js, not here, since it needs `entdash:
// reading`'s own collection API, which doesn't exist while this file is
// still executing (script load order — see that file's own header). And
// horrorWatch is GONE too, split into two real pages —
// horrorWatchCreepypasta and horrorWatchTrue — via
// `migrateHorrorWatchSplitIfNeeded()` (below), a disclosed heuristic on
// subtopic (only 'Found Footage' — content explicitly styled/marketed as
// real — maps to horrorWatchTrue; everything else defaults to
// horrorWatchCreepypasta) since the old data never recorded a real/
// fictional distinction. `spicyWatch` was NOT asked to split and is
// unchanged. Every superseded key (`enthub:horrorReading`/
// `enthub:spicyReading`/`enthub:horrorWatch`) is left in place
// afterward, orphaned but untouched, same treatment as `enthub:stories`
// above and every other superseded key elsewhere in this app.
//
// Every collection here is still a flat array of EntItem records under
// its own `enthub:*` key:
//   - enthub:podcasts
//   - enthub:horrorWatchCreepypasta / enthub:horrorWatchTrue
//   - enthub:spicyWatch
//   - enthub:storiesImmersive
//   - enthub:entertainment
//   - enthub:playlists
// Favorites (now `entertainment-dash.html`'s own Favorites tab) owns no
// collection of its own — it's a live, read/write aggregation across
// every page here plus entertainment-dash-data.js's own Reading/Anime/
// Games collections (any item with `favorite: true`) — favoriting/
// editing/rating from Favorites writes straight back into the item's
// real, owning collection, so there's exactly one copy of each item's
// data, never a second synced copy.
//
// Every page here still shares one Supabase row (`appKey: 'enthub'`,
// `syncedPrefixes: ['enthub:']`) — same "one row covers several
// logically separate pages" precedent index.html's own `goals` row
// already uses for routine:/system:/fitness:/mainselfcare:.

(function (global) {
  'use strict';

  // Captured here, at the very top of this module's own top-level
  // execution — before this file or sync.js's initCloudSync() has had
  // any chance to patch localStorage.setItem/removeItem — so there is
  // always one genuinely raw, never-wrapped reference available for
  // applying data that came FROM remote. Using it (instead of whatever
  // localStorage.setItem currently resolves to) is what stops "apply a
  // value we just fetched" from ever being mistaken for "the user just
  // edited this," by this file's own bootstrap or by sync.js's dirty
  // tracking, however many layers of patching end up stacked on top by
  // the time it's actually called.
  const RAW_LS_SET = localStorage.setItem.bind(localStorage);

  // ============================================================
  // STORAGE — same honest-save-signal storeSet() as every other page's
  // own -data.js: a failed localStorage write (e.g. quota exceeded)
  // dispatches an 'enthub:save' event either way, instead of vanishing
  // silently.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('enthub:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('enthub:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // PAGE CONFIG — one entry per content page, each with its own fixed
  // sub-topic list. A sub-topic is just a string tag on an item, not its
  // own storage —
  // same "category is a field, not a collection" precedent every other
  // gallery/database in this app already uses (e.g. business.html's
  // Content Plan `platform` field).
  // ============================================================
  const PAGES = {
    podcasts: {
      key: 'podcasts', storageKey: 'enthub:podcasts', label: 'Podcasts', icon: '🎙️',
      subtopics: ['Learning', 'Photography / Videography', 'True Crime', 'Business', 'Writing']
    },
    // horrorReading/spicyReading no longer live here — moved into
    // entertainment-dash-data.js's own Reading Corner, see this file's
    // own header comment. horrorWatch no longer lives here either —
    // split into horrorWatchCreepypasta/horrorWatchTrue, just below.
    horrorWatchCreepypasta: {
      key: 'horrorWatchCreepypasta', storageKey: 'enthub:horrorWatchCreepypasta', label: 'Horror Stories · Creepypastas', icon: '🕸️',
      subtopics: ['Creepypasta', 'Narrated Videos', 'Analog Horror', 'Compilations']
    },
    horrorWatchTrue: {
      key: 'horrorWatchTrue', storageKey: 'enthub:horrorWatchTrue', label: 'Horror Stories · True Stories', icon: '📼',
      subtopics: ['Found Footage', 'Real Encounters', 'Paranormal', 'Compilations']
    },
    spicyWatch: {
      key: 'spicyWatch', storageKey: 'enthub:spicyWatch', label: 'Spicy Stories · YouTube', icon: '🎧',
      subtopics: ['Narrated Videos', 'Roleplay Audio', 'ASMR Style', 'Compilations']
    },
    storiesImmersive: {
      key: 'storiesImmersive', storageKey: 'enthub:storiesImmersive', label: 'Immersive Experience', icon: '🌀',
      subtopics: ['Immersive Experience', 'ASMR', 'Interactive Audio']
    },
    entertainment: {
      key: 'entertainment', storageKey: 'enthub:entertainment', label: 'Entertainment', icon: '🎬',
      subtopics: ['Gaming', 'Scary Videos', 'Vlog-Like']
    },
    playlists: {
      key: 'playlists', storageKey: 'enthub:playlists', label: 'Playlists', icon: '🎧',
      subtopics: ['Chill', 'Binaural Beats', 'Dark / Gothic / Horror / Romance', 'EDM / Electronic', 'Fantasy']
    }
  };
  const PAGE_ORDER = ['podcasts', 'horrorWatchCreepypasta', 'horrorWatchTrue', 'spicyWatch', 'storiesImmersive', 'entertainment', 'playlists'];

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe
  // and http(s)-only guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900;
    quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }
  function isValidMediaUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  // ============================================================
  // LINK PREVIEW — YouTube/Spotify oEmbed, the exact technique
  // entertainment.html's own fetchPreview() already uses (both are
  // public, keyless endpoints — no backend/API key needed or available
  // in this app, see CLAUDE.md §1/§2). Genuinely fetches title, cover
  // thumbnail, and author/creator — oEmbed itself never returns a
  // description or a duration for either provider, so those two stay
  // manual/editable fields on every item, never silently left blank
  // without an obvious "fill this in" affordance in the UI layer.
  // ============================================================
  function detectSource(url) {
    try {
      const u = new URL(url);
      const h = u.hostname.replace(/^www\./, '');
      if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'youtube';
      if (h.endsWith('spotify.com')) return 'spotify';
    } catch (e) {}
    return null;
  }
  function getYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1).split('/')[0] || null;
      if (u.hostname.indexOf('youtube.com') !== -1) {
        if (u.pathname === '/watch') return u.searchParams.get('v');
        const m = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
        if (m) return m[2];
      }
    } catch (e) {}
    return null;
  }
  async function fetchPreview(url) {
    const source = detectSource(url);
    const result = { title: '', cover: '', creator: '', source: source };
    if (source === 'youtube') {
      const id = getYouTubeId(url);
      if (id) result.cover = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
      try {
        const res = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');
        if (res.ok) {
          const data = await res.json();
          if (data.title) result.title = data.title;
          if (data.thumbnail_url) result.cover = data.thumbnail_url;
          if (data.author_name) result.creator = data.author_name;
        }
      } catch (e) {}
      return result;
    }
    if (source === 'spotify') {
      try {
        const res = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url));
        if (res.ok) {
          const data = await res.json();
          if (data.title) result.title = data.title;
          if (data.thumbnail_url) result.cover = data.thumbnail_url;
        }
      } catch (e) {}
      return result;
    }
    return result;
  }

  // ============================================================
  // MODEL — one shape for every item, on every one of the four pages,
  // so the Favorites page can render/edit any of them identically.
  // ============================================================
  /** @typedef {{id:string, title:string, creator:string, url:string, cover:string,
   * description:string, lengthText:string, subtopic:string, rating:number,
   * favorite:boolean, order:number, createdAt:number, updatedAt:number}} EntItem */
  function itemModel(pageKey, data) {
    data = data || {};
    const cfg = PAGES[pageKey];
    const subtopics = cfg ? cfg.subtopics : [];
    const rating = Math.max(0, Math.min(5, Math.round(Number(data.rating) || 0)));
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('ei'),
      title: typeof data.title === 'string' ? data.title : '',
      creator: typeof data.creator === 'string' ? data.creator : '',
      url: typeof data.url === 'string' ? data.url : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      lengthText: typeof data.lengthText === 'string' ? data.lengthText : '',
      subtopic: (subtopics.indexOf(data.subtopic) !== -1) ? data.subtopic : (subtopics[0] || ''),
      rating: rating,
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt,
      // Real bug fixed by this field's existence: the cross-device merge
      // (mergeRemoteIntoLocal, below) used to resolve a card that exists
      // on both sides by always keeping the LOCAL copy — which meant
      // whichever device happened to sync last with a stale copy would
      // silently revert a favorite/rating/edit made on the other device.
      // updatedAt lets the merge keep whichever side is actually newer
      // instead. Falls back to createdAt for any item stored before this
      // field existed, which is missing it entirely.
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt
    };
  }

  // ============================================================
  // TOMBSTONES — records WHEN an item was deleted, per page, so the
  // cross-device merge (mergeRemoteIntoLocal, below) can tell "this item
  // was deliberately deleted" apart from "this device just hasn't seen
  // it yet" — without this, a delete could be silently undone by the
  // very next merge that happens to fetch a copy of the row from before
  // the deletion had a chance to reach the server (this got noticeably
  // more visible once the periodic 15s poll shipped, since that's a
  // fresh chance to re-fetch a still-stale row every 15 seconds). Stored
  // under its own 'enthub:tombstones:<page>' key per content page — a
  // plain `{id: deletedAtTimestamp}` map — so it rides the same existing
  // `syncedPrefixes: ['enthub:']` sync with no new sync wiring, and
  // merges independently via its own small object-union branch in
  // mergeRemoteIntoLocal (keeping the max timestamp per id from either
  // side). Tombstone entries are never pruned — a handful of small,
  // permanent {id: number} entries is an accepted, deliberately simple
  // tradeoff over building real cleanup for what stays a tiny amount of
  // data for a personal dashboard's worth of deleted cards.
  // ============================================================
  function tombstoneKeyFor(contentKey) { return 'enthub:tombstones:' + contentKey.slice('enthub:'.length); }
  function readTombstones(contentKey) {
    try {
      const raw = localStorage.getItem(tombstoneKeyFor(contentKey));
      const obj = raw ? JSON.parse(raw) : null;
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }
  function recordTombstone(contentKey, id) {
    const obj = readTombstones(contentKey);
    obj[id] = Date.now();
    storeSet(tombstoneKeyFor(contentKey), obj);
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as every other
  // page's own -data.js.
  // ============================================================
  function makeCollection(pageKey) {
    const cfg = PAGES[pageKey];
    const key = cfg.storageKey;
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = itemModel(pageKey, data);
      const all = list();
      all.push(record);
      // A caller (entertainment-dash.html's saveItemModal()) needs to
      // tell "this genuinely saved" from "this looked like it worked but
      // never actually persisted" — the latter is exactly what a silent
      // storeSet() failure (most likely a full localStorage quota — see
      // photo-store.js's own header) used to look like: the modal
      // closed, the item just never showed up, no error anywhere.
      if (!storeSet(key, all)) return null;
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      // updatedAt is forced here, always, regardless of what patch
      // contains — every real edit (favorite/rating/title/etc.) needs to
      // move it forward so the cross-device merge can tell this copy is
      // the newer one.
      all[idx] = itemModel(pageKey, Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
      if (!storeSet(key, all)) return null;
      return all[idx];
    }
    function remove(id) {
      const all = list();
      const next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      recordTombstone(key, id);
      return next.length !== all.length;
    }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const COLLECTIONS = {};
  PAGE_ORDER.forEach(function (k) { COLLECTIONS[k] = makeCollection(k); });
  function collectionFor(pageKey) { return COLLECTIONS[pageKey]; }

  // ============================================================
  // ONE-TIME BACKFILL — unlike almost every other page in this app, this
  // file never had a photo-store.js sweep: covers uploaded through the
  // old, pre-merge standalone Entertainment pages (deleted — see
  // CLAUDE.md) were saved as raw base64 `data:` strings, and
  // entertainment-dash.html's own shared item modal only started
  // routing NEW uploads through PhotoStore going forward (see its own
  // wireModal()) — it never went back and fixed what was already there.
  // That's very likely the actual cause of this shared origin's
  // localStorage quota filling up (reported directly: a QuotaExceededError
  // on `entdash:reading`, thrown from `migrateHorrorSpicyReadingIntoReadingCorner()`
  // in entertainment-dash-data.js — a function that copies `cover`
  // straight from THIS file's own `enthub:horrorReading`/`spicyReading`
  // items, so an un-migrated giant base64 cover there gets duplicated
  // into `entdash:reading` too, making the same problem worse with every
  // retry). Same "compress once already, just swap the value, only mark
  // done once every upload settled" shape as every other page's own
  // migratePhotosToStorage() (e.g. entertainment.html's own — copied
  // structurally from there). Exported so entertainment-dash.html can
  // call it from boot(); PAGE_ORDER covers every collection this file
  // owns, so nothing needs listing item-type-by-item-type.
  // ============================================================
  function migratePhotosToStorage() {
    if (!global.PhotoStore) return;
    var already = false;
    try { already = localStorage.getItem('enthub:photosMigratedV1') === 'true'; } catch (e) {}
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
    if (!jobs.length) { try { localStorage.setItem('enthub:photosMigratedV1', 'true'); } catch (e) {} return; }
    // upload() never rejects (resolves to null on any failure, e.g. the
    // bucket not existing yet) — Promise.all alone would still resolve
    // even on total failure, so only mark this page "done" once every
    // job this pass kicked off genuinely succeeded; anything left over
    // (still base64) simply retries on the next load.
    Promise.all(jobs).then(function (results) {
      if (results.every(function (ok) { return ok; })) {
        try { localStorage.setItem('enthub:photosMigratedV1', 'true'); } catch (e) {}
      }
    });
  }

  // ============================================================
  // ONE-TIME MIGRATION — see this file's own header comment. Distributes
  // any real pre-existing `enthub:stories` items into the five new split
  // pages by their old subtopic name; anything unrecognized falls back
  // to storiesImmersive. Guarded so it only ever runs once per device;
  // the old `enthub:stories` key is left alone afterward (orphaned, not
  // deleted). Runs synchronously at load time — safe to run before
  // bootSync's own remote merge, since a freshly-migrated item just has
  // a brand-new id the merge has never seen yet and gets unioned in like
  // any other local add.
  // ============================================================
  // Small raw-array append, bypassing collectionFor()/nextOrder() (both
  // of which require a live PAGES[pageKey] entry) — used only for the
  // horrorReading/spicyReading targets below, since those two are no
  // longer live pages in THIS file (see this file's own header comment)
  // but migrateStoriesSplitIfNeeded() still needs somewhere real to land
  // old 'enthub:stories' items carrying those two old subtopics, for
  // migrateHorrorSpicyReadingIntoReadingCorner()
  // (entertainment-dash-data.js) to then pick up and finish moving into
  // Reading Corner. itemModel() already degrades gracefully with no
  // PAGES entry (subtopic just comes back empty, harmless — the
  // downstream migration re-sets it into Reading Corner's real
  // Horror/Spicy genre anyway).
  function rawAppendDead(storageKey, pageKeyForModel, data) {
    const all = storeGet(storageKey) || [];
    const order = all.length ? Math.max.apply(null, all.map(function (x) { return x.order || 0; })) + 1 : 0;
    all.push(itemModel(pageKeyForModel, Object.assign({}, data, { order: order })));
    storeSet(storageKey, all);
  }
  function migrateStoriesSplitIfNeeded() {
    if (storeGet('enthub:storiesSplitMigratedV1')) return;
    const old = storeGet('enthub:stories');
    if (Array.isArray(old) && old.length) {
      old.forEach(function (item) {
        if (!item) return;
        const fields = {
          title: item.title, creator: item.creator, url: item.url, cover: item.cover,
          description: item.description, lengthText: item.lengthText,
          rating: item.rating, favorite: item.favorite
        };
        if (item.subtopic === 'Horror Stories') {
          rawAppendDead('enthub:horrorReading', 'horrorReading', fields);
        } else if (item.subtopic === 'Spicy Stories') {
          rawAppendDead('enthub:spicyReading', 'spicyReading', fields);
        } else {
          collectionFor('storiesImmersive').add(Object.assign({}, fields, {
            order: nextOrder('storiesImmersive'), subtopic: PAGES.storiesImmersive.subtopics[0]
          }));
        }
      });
    }
    storeSet('enthub:storiesSplitMigratedV1', true);
  }
  migrateStoriesSplitIfNeeded();

  // Splits any real pre-existing `enthub:horrorWatch` items into the two
  // pages that replaced it — see this file's own header comment on the
  // subtopic heuristic: 'Found Footage' (content explicitly styled as
  // real) -> horrorWatchTrue; everything else -> horrorWatchCreepypasta.
  // An old subtopic is kept as-is when it's still valid in the new
  // page's own subtopic list (preserves fidelity for e.g. 'Analog
  // Horror'), otherwise falls back to that page's first subtopic. The
  // old `enthub:horrorWatch` key is left in place afterward, orphaned
  // but untouched, same treatment as `enthub:stories` above.
  function migrateHorrorWatchSplitIfNeeded() {
    if (storeGet('enthub:horrorWatchSplitMigratedV1')) return;
    const old = storeGet('enthub:horrorWatch');
    if (Array.isArray(old) && old.length) {
      old.forEach(function (item) {
        if (!item) return;
        const targetKey = item.subtopic === 'Found Footage' ? 'horrorWatchTrue' : 'horrorWatchCreepypasta';
        const subtopic = PAGES[targetKey].subtopics.indexOf(item.subtopic) !== -1 ? item.subtopic : PAGES[targetKey].subtopics[0];
        collectionFor(targetKey).add({
          title: item.title, creator: item.creator, url: item.url, cover: item.cover,
          description: item.description, lengthText: item.lengthText,
          rating: item.rating, favorite: item.favorite, order: nextOrder(targetKey),
          subtopic: subtopic
        });
      });
    }
    storeSet('enthub:horrorWatchSplitMigratedV1', true);
  }
  migrateHorrorWatchSplitIfNeeded();

  // ============================================================
  // SELECTORS
  // ============================================================
  function itemsForPage(pageKey) {
    return collectionFor(pageKey).list().slice().sort(function (a, b) { return a.order - b.order; });
  }
  function itemsForSubtopic(pageKey, subtopic) {
    return itemsForPage(pageKey).filter(function (x) { return x.subtopic === subtopic; });
  }
  function favoritesForPage(pageKey) {
    return itemsForPage(pageKey).filter(function (x) { return x.favorite; });
  }
  /** Every favorited item across all four pages, each tagged with a
   * transient (never persisted) `_pageKey` so the Favorites page can
   * filter/badge by source page and write edits back to the right
   * collection. */
  function allFavorites() {
    let out = [];
    PAGE_ORDER.forEach(function (pk) {
      favoritesForPage(pk).forEach(function (item) {
        out.push(Object.assign({}, item, { _pageKey: pk }));
      });
    });
    return out.sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function nextOrder(pageKey) {
    const list = collectionFor(pageKey).list();
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  /** Reorders only the given (already-filtered/visible) id list, then
   * remaps that into the real underlying array order — the same
   * "compute the move against the visible list, apply it to the real
   * array" technique entertainment.html's own Manual sort mode and
   * tasks.html's reorder-under-filter fix already use, so dragging one
   * sub-topic's cards can never scramble another sub-topic's items that
   * happen to sit between them in storage. */
  function reorderVisible(pageKey, visibleOrderedIds) {
    const all = collectionFor(pageKey).list();
    const visibleSet = {};
    visibleOrderedIds.forEach(function (id, i) { visibleSet[id] = i; });
    const visibleItems = all.filter(function (x) { return visibleSet.hasOwnProperty(x.id); })
      .sort(function (a, b) { return visibleSet[a.id] - visibleSet[b.id]; });
    const otherItems = all.filter(function (x) { return !visibleSet.hasOwnProperty(x.id); });
    // Splice the reordered visible items back into their own original
    // order-slots among the full list, preserving where non-visible
    // items sit relative to them.
    const merged = all.slice().sort(function (a, b) { return a.order - b.order; });
    let vi = 0;
    const finalOrder = merged.map(function (x) {
      return visibleSet.hasOwnProperty(x.id) ? visibleItems[vi++] : x;
    });
    finalOrder.forEach(function (x, i) {
      // Bump updatedAt only for items whose position actually changed —
      // same reason update() now always bumps it (see itemModel's own
      // comment): a stale device's cross-device merge must be able to
      // tell a just-dragged card is newer than whatever it fetched.
      if (x.order !== i) x.updatedAt = Date.now();
      x.order = i;
    });
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

  // ============================================================
  // SEED — a light starter set per sub-topic (real, recognizable show
  // names as placeholder titles where that made sense; otherwise a
  // plain generic placeholder) so every page/sub-topic demonstrates the
  // gallery instead of loading empty. No URL/cover is fabricated for
  // any seed item — that would look like a genuinely fetched preview
  // when it isn't; every seed item starts with an empty url/cover
  // (icon fallback) and is meant to be replaced by pasting a real link.
  // ============================================================
  function seedItem(pageKey, subtopic, title, creator) {
    collectionFor(pageKey).add({
      title: title, creator: creator || '', subtopic: subtopic,
      order: nextOrder(pageKey)
    });
  }
  function seedDefaultData() {
    PAGE_ORDER.forEach(function (pk) { collectionFor(pk).replaceAll([]); });

    seedItem('podcasts', 'Learning', 'Huberman Lab', 'Andrew Huberman');
    seedItem('podcasts', 'Learning', 'Lex Fridman Podcast', 'Lex Fridman');
    seedItem('podcasts', 'Photography / Videography', 'The Candid Frame', '');
    seedItem('podcasts', 'Photography / Videography', 'PetaPixel Photography Podcast', '');
    seedItem('podcasts', 'True Crime', 'Crime Junkie', '');
    seedItem('podcasts', 'True Crime', 'Serial', '');
    seedItem('podcasts', 'Business', 'How I Built This', 'NPR');
    seedItem('podcasts', 'Business', 'The Tim Ferriss Show', 'Tim Ferriss');

    // horrorReading/spicyReading example seeds now live in
    // entertainment-dash-data.js's own seedDefaultData() (Reading
    // Corner's Horror/Spicy genres).
    seedItem('horrorWatchCreepypasta', 'Narrated Videos', 'NoSleep Podcast', '');
    seedItem('horrorWatchCreepypasta', 'Analog Horror', 'Local58', '');
    seedItem('horrorWatchTrue', 'Found Footage', 'A favorite found-footage horror channel', '');
    seedItem('spicyWatch', 'Narrated Videos', 'Dirty Diana', '');
    seedItem('storiesImmersive', 'Immersive Experience', 'The Magnus Archives', '');

    seedItem('entertainment', 'Gaming', 'A favorite gaming channel', '');
    seedItem('entertainment', 'Scary Videos', 'A favorite scary-video channel', '');
    seedItem('entertainment', 'Vlog-Like', 'A favorite vlog channel', '');

    seedItem('playlists', 'Chill', 'Lo-fi beats to relax to', '');
    seedItem('playlists', 'Binaural Beats', 'Deep focus binaural beats', '');
    seedItem('playlists', 'Dark / Gothic / Horror / Romance', 'Dark academia mix', '');
    seedItem('playlists', 'EDM / Electronic', 'Electronic favorites', '');
    seedItem('playlists', 'Fantasy', 'Fantasy adventure score mix', '');

    storeSet('enthub:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('enthub:seeded')) return;
    const anyData = PAGE_ORDER.some(function (pk) { return collectionFor(pk).list().length > 0; });
    if (anyData) { storeSet('enthub:seeded', true); return; }
    seedDefaultData();
  }
  // seedIfEmpty() is deliberately NOT called automatically — same
  // empty-storage seed-race reasoning as every other page in this app:
  // seeding synchronously before initCloudSync()'s cloud pull has a real
  // chance to answer could push a freshly-seeded "default" set to
  // Supabase and clobber another device's real data.

  // ============================================================
  // SLUGS — for URL-hash deep-linking into a specific sub-topic (or
  // Favorites), the same "child hash maps to a tab" convention every
  // other nested nav entry in topbar.js already uses. Deterministic and
  // regenerated from PAGES on every call, so a slug never needs to be
  // stored anywhere.
  // ============================================================
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function slugForSubtopic(subtopic) { return slugify(subtopic); }
  function subtopicForSlug(pageKey, slug) {
    const cfg = PAGES[pageKey];
    if (!cfg) return null;
    if (slug === 'favorites') return '__favorites__';
    const found = cfg.subtopics.find(function (s) { return slugify(s) === slug; });
    return found || null;
  }

  // ============================================================
  // HERO — one large, editable cover-photo banner per page (all five:
  // the four content pages plus Favorites), same eyebrow/title/subtext/
  // cover-photo shape and upload-or-remove mechanism as every other
  // page's own hero in this app (business.html's per-tab hero,
  // dreamboard.html, aitech.html, tasks.html, etc.). Stored under one
  // key, `enthub:heroes` — a plain object keyed by page key — already
  // covered by the existing `syncedPrefixes: ['enthub:']`, no new sync
  // key needed. Cover photos start empty by default; nothing is
  // pre-filled.
  // ============================================================
  /** @typedef {{eyebrow:string, title:string, subtext:string, photo:string,
   * updatedAt:number}} EntHero */
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      // Same reason EntItem gained this field — see itemModel's own
      // comment — lets the cross-device merge tell which of two
      // conflicting hero edits is actually newer instead of guessing.
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0
    };
  }
  function getHero(pageKey, defaults) {
    const all = storeGet('enthub:heroes') || {};
    const stored = all[pageKey];
    if (stored) return heroModel(stored);
    return heroModel(defaults);
  }
  function saveHero(pageKey, patch) {
    const all = storeGet('enthub:heroes') || {};
    const next = heroModel(Object.assign({}, heroModel(all[pageKey]), patch, { updatedAt: Date.now() }));
    all[pageKey] = next;
    storeSet('enthub:heroes', all);
    return next;
  }

  // ============================================================
  // READ-BEFORE-WRITE BOOTSTRAP — fixes a real, reported data-loss bug.
  //
  // All five Entertainment pages share ONE Supabase row (appKey
  // 'enthub'), but each is its own independent page load with its own,
  // initially-incomplete view of the shared enthub: namespace — e.g. a
  // device that's only ever opened ent-podcasts.html has no local copy
  // of enthub:stories/entertainment/playlists yet. sync.js's own push
  // (pushNow()) REPLACES the whole row's `data` column with whatever
  // this device currently has locally, via upsert — it does not merge.
  // So if a user added something and that add's debounced push fired
  // before this device's own initial cloud pull had caught up with
  // every OTHER page's collection, the push would silently wipe those
  // other collections out of the shared row — and that wipe then
  // propagates back down to every other device the next time it applies
  // a remote update (applyRemote's own "remove keys not present in
  // remote" step treats an absent key as a real deletion). This is
  // exactly what "none of my input shows up, on any device" looks like:
  // nearly every real add happens within a few seconds of opening a
  // page, which was well within the old race window.
  //
  // Fixed by doing our own direct, one-time REST read of the row BEFORE
  // ever installing sync.js's write-triggering localStorage patch (i.e.
  // before calling initCloudSync at all) and applying whatever it finds
  // straight into localStorage first. By the time any write can
  // possibly happen — a user's Add/Edit/Favorite, or sync.js's own
  // monkey-patched setItem — this device's local view is already caught
  // up with the full shared row, not just whatever this one page
  // happened to already have. Same hardcoded URL/key as sync.js/
  // topbar.js/gym.html (must stay in sync — DO NOT MODIFY §1): a small,
  // independent, read-only duplication, the same accepted precedent
  // gym.html's own separate Supabase sync already established.
  // ============================================================
  const SUPABASE_URL = 'https://jomlmvslzsmmzgjnqvbm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BrZrVgVxLA_idNX19sGhwg_mo7Ta41N';

  // Three separate timing-based attempts at this bootstrap (each fixing
  // a real, reproduced bug, each leaving a further gap — see git history
  // on this file for the blow-by-blow) all shared the same flaw: they
  // tried to GUESS, from write timing, whether local was safe to
  // overwrite with whatever the fetch below found. This version doesn't
  // guess — it MERGES the two, so the answer is correct regardless of
  // exactly when a write happened relative to the fetch.
  //
  // Array collections (the four content pages) are unioned by item id;
  // `enthub:heroes` is a shallow per-page-key merge; anything else
  // scalar just prefers local when present. The one accepted tradeoff:
  // a genuine cross-device DELETE can take one extra round trip to fully
  // take effect (a just-deleted item can briefly reappear via this union
  // before initCloudSync's own subsequent pull/realtime update corrects
  // it, since deletions aren't tracked here) — a far smaller cost than
  // silently losing a real add, which every previous version of this
  // bootstrap could still do under the wrong timing.
  //
  // A real bug fixed here, reported as "Favorites isn't syncing
  // properly": the first version of this merge always kept the LOCAL
  // copy of an item/hero that exists on both sides, on the theory that
  // "local is what's actually on this device right now." That's wrong
  // whenever the CONFLICTING id is an edit, not a fresh add — favoriting
  // a card on one device, then merely loading (or auto-polling) the
  // other device with its own stale, unfavorited copy still locally
  // present, would keep local's stale value and then PUSH it, silently
  // un-favoriting the card everywhere. Conflict resolution now compares
  // each side's updatedAt and keeps whichever is actually newer, falling
  // back to createdAt (items) or 0 (heroes) for anything stored before
  // that field existed.
  function newerWins(remoteSide, localSide) {
    if (!remoteSide) return localSide;
    if (!localSide) return remoteSide;
    const remoteTime = typeof remoteSide.updatedAt === 'number' ? remoteSide.updatedAt : (remoteSide.createdAt || 0);
    const localTime = typeof localSide.updatedAt === 'number' ? localSide.updatedAt : (localSide.createdAt || 0);
    return localTime >= remoteTime ? localSide : remoteSide;
  }
  function mergeRemoteIntoLocal(key, remoteValue) {
    let localValue = null;
    try { const raw = localStorage.getItem(key); localValue = raw == null ? null : JSON.parse(raw); } catch (e) {}
    if (key.indexOf('enthub:tombstones:') === 0) {
      // A plain {id: deletedAtTimestamp} map — union both sides, keeping
      // the later timestamp per id (there's realistically only ever one,
      // but two devices could in principle both delete the same id).
      const remoteObj = (remoteValue && typeof remoteValue === 'object') ? remoteValue : {};
      const localObj = (localValue && typeof localValue === 'object') ? localValue : {};
      const merged = {};
      Object.keys(Object.assign({}, remoteObj, localObj)).forEach(function (id) {
        merged[id] = Math.max(Number(remoteObj[id]) || 0, Number(localObj[id]) || 0);
      });
      return merged;
    }
    if (Array.isArray(remoteValue) || Array.isArray(localValue)) {
      const remoteArr = Array.isArray(remoteValue) ? remoteValue : [];
      const localArr = Array.isArray(localValue) ? localValue : [];
      // Read AFTER any 'enthub:tombstones:*' key has already been merged
      // this same pass (fetchAndApplyRemoteSnapshot() processes tombstone
      // keys first, deterministically, specifically so this read sees the
      // fully-merged picture of what's been deleted, not a half-applied
      // one depending on which key Object.keys() happened to list first).
      const tombstones = readTombstones(key);
      function isTombstoned(item) {
        const deletedAt = tombstones[item.id];
        if (!deletedAt) return false;
        const itemTime = typeof item.updatedAt === 'number' ? item.updatedAt : (item.createdAt || 0);
        // A tombstone at or after this specific version's own last edit
        // means it was deleted after remote last saw it — don't
        // resurrect it just because remote hasn't caught up yet. (If the
        // item's own timestamp is NEWER than the tombstone, someone
        // re-added/re-edited it since the delete, which wins instead.)
        return deletedAt >= itemTime;
      }
      const remoteById = {}, localById = {}, order = [];
      remoteArr.forEach(function (item) {
        if (!item || item.id == null || isTombstoned(item)) return;
        remoteById[item.id] = item; order.push(item.id);
      });
      localArr.forEach(function (item) {
        if (!item || item.id == null || isTombstoned(item)) return;
        if (!(item.id in remoteById)) order.push(item.id);
        localById[item.id] = item;
      });
      return order.map(function (id) { return newerWins(remoteById[id], localById[id]); })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }
    if (key === 'enthub:heroes') {
      const remoteObj = (remoteValue && typeof remoteValue === 'object') ? remoteValue : {};
      const localObj = (localValue && typeof localValue === 'object') ? localValue : {};
      const pageKeys = Object.keys(Object.assign({}, remoteObj, localObj));
      const merged = {};
      pageKeys.forEach(function (pk) { merged[pk] = newerWins(remoteObj[pk], localObj[pk]); });
      return merged;
    }
    return (localValue !== null && localValue !== undefined) ? localValue : remoteValue;
  }
  /** Resolves to `{ foundAny, needsPush }` on success — `foundAny`: the
   * remote row had at least one 'enthub:' key; `needsPush`: merging in
   * whatever's local actually produced something different from what
   * remote had (or local has an 'enthub:' key remote doesn't even know
   * about yet), meaning it still needs pushing or it'll never reach the
   * server — or `null` on a network failure/timeout (genuinely can't
   * tell). Applies merged values via RAW_LS_SET, never the ambient
   * localStorage.setItem — a real bug in an earlier version of this
   * function did exactly the reverse and, since applying remote data
   * happens on almost every load (not just ones with a genuine local
   * edit), it got misclassified as "the user just wrote this." */
  function fetchAndApplyRemoteSnapshot() {
    return fetch(SUPABASE_URL + '/rest/v1/app_state?key=eq.enthub&select=data', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) {
        const remote = rows && rows[0] && rows[0].data;
        const remoteObj = (remote && typeof remote === 'object') ? remote : {};
        let foundAny = false;
        let needsPush = false;
        function processKey(k) {
          foundAny = true;
          const remoteJson = JSON.stringify(remoteObj[k]);
          const merged = mergeRemoteIntoLocal(k, remoteObj[k]);
          const mergedJson = JSON.stringify(merged);
          if (mergedJson !== remoteJson) needsPush = true;
          if (localStorage.getItem(k) !== mergedJson) RAW_LS_SET(k, mergedJson);
        }
        const allKeys = Object.keys(remoteObj).filter(function (k) { return k.indexOf('enthub:') === 0; });
        // Tombstones first, deterministically — see mergeRemoteIntoLocal's
        // own comment on why the array-merge branch needs them already
        // fully applied before it runs.
        allKeys.filter(function (k) { return k.indexOf('enthub:tombstones:') === 0; }).forEach(processKey);
        allKeys.filter(function (k) { return k.indexOf('enthub:tombstones:') !== 0; }).forEach(processKey);
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('enthub:') === 0 && !(k in remoteObj)) needsPush = true;
        }
        return { foundAny: foundAny, needsPush: needsPush };
      })
      .catch(function () { return null; });
  }
  function readBeforeWriteBootstrap() {
    return Promise.race([
      fetchAndApplyRemoteSnapshot(),
      new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 8000); })
    ]).then(function (result) {
      if (!result) return null;
      // A key that's now different from what remote had (or that remote
      // doesn't even know about) is still completely unprotected from
      // initCloudSync()'s own separate initial pull, called right after
      // this resolves — its own dirty-tracking starts empty, has no idea
      // this key was just merged, and would otherwise silently overwrite
      // it with the stale value it fetches. Closing it the same way
      // sync.js's own flushOnUnload() already does — a direct raw upsert
      // of every current 'enthub:' key — so the row already matches
      // before initCloudSync ever gets a chance to re-fetch it.
      const push = result.needsPush ? pushMergedSnapshot() : Promise.resolve();
      return push.then(function () { return result.foundAny; });
    });
  }
  function pushMergedSnapshot() {
    const state = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('enthub:') !== 0) continue;
      try { state[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { state[k] = localStorage.getItem(k); }
    }
    return fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key: 'enthub', data: state, updated_at: new Date().toISOString() })
    }).catch(function () {});
  }

  // ============================================================
  // SYNC BOOTSTRAP — one shared helper so all five pages wire up the
  // exact same appKey/prefix, run the read-before-write bootstrap above
  // first, and share the same seed-race-safety window, instead of each
  // page hand-rolling its own copy — same reasoning as every other page
  // in this app that already does this (dreamboard.html/business.html/
  // aitech.html/tasks.html/etc.). `onReady` is called once as soon as
  // the bootstrap read settles (so the very first real render reflects
  // it), and again any time a later cloud update or a seed actually
  // changes something — the caller's cue to (re-)render each time.
  // ============================================================
  function bootSync(onReady) {
    readBeforeWriteBootstrap().then(function (foundRemoteData) {
      let remoteAppliedOnce = false;
      const startedEmpty = PAGE_ORDER.every(function (pk) { return collectionFor(pk).list().length === 0; });
      function maybeSeed() {
        if (remoteAppliedOnce) return;
        // A device that's offline hasn't actually had a real chance to
        // confirm anything yet — seeding here would just fabricate demo
        // content that later gets pushed over (and clobbers) whatever's
        // real once connectivity returns. Wait for a real online signal.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { setTimeout(maybeSeed, 3000); return; }
        const anyData = PAGE_ORDER.some(function (pk) { return collectionFor(pk).list().length > 0; });
        if (anyData) return;
        seedIfEmpty();
        if (onReady) onReady();
      }
      if (typeof global.initCloudSync === 'function') {
        global.initCloudSync({
          appKey: 'enthub',
          syncedPrefixes: ['enthub:'],
          onApplied: function () {
            remoteAppliedOnce = true;
            if (onReady) onReady();
          }
        });
      }
      if (startedEmpty && foundRemoteData === false) {
        // Only ever seed on a DEFINITIVE "remote genuinely has nothing"
        // signal from our own direct read above — never on a mere
        // timeout/network hiccup (foundRemoteData === null), which a
        // second real bug used to treat as "probably empty" after a
        // 6-second wait. A slower connection (a phone on cellular is the
        // exact case this was reported on) can easily still be mid-fetch
        // at 6 seconds with real remote data on the way — seeding at
        // that point fabricates placeholder content and then PUSHES it
        // (once initCloudSync installs its dirty-tracking), overwriting
        // whatever was actually there. If we can't confirm, we simply
        // don't seed this session — initCloudSync's own pull (or a later
        // reload) still applies the real data once it lands; nothing is
        // lost by waiting instead of guessing.
        maybeSeed();
      }
      if (onReady) onReady();
    });

    // Realtime subscriptions can silently go stale once a tab is
    // backgrounded (a phone locking its screen, switching apps) — a
    // documented limitation elsewhere in this app (see dreamboard.html's
    // own changelog: mobile browsers throttle or drop a backgrounded
    // tab's websocket, with no event telling the page it happened), and
    // the direct cause of "it's slow/inconsistent on the phone." Rather
    // than wait on a connection that may never resume by itself, poll a
    // fresh snapshot directly on a comfortable interval while the tab is
    // actually visible, and immediately the moment it BECOMES visible
    // again. Safe to call this freely now that fetchAndApplyRemoteSnapshot()
    // merges instead of overwriting — it can no longer destroy an
    // unsynced local edit by calling it mid-session, which is what made
    // this too risky to add before.
    let pollTimer = null;
    let lastPoll = 0;
    function pollNow() {
      lastPoll = Date.now();
      fetchAndApplyRemoteSnapshot().then(function (result) {
        if (!result) return;
        const push = result.needsPush ? pushMergedSnapshot() : Promise.resolve();
        push.then(function () { if (onReady) onReady(); });
      });
    }
    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(pollNow, 15000);
    }
    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') { stopPolling(); return; }
      startPolling();
      if (Date.now() - lastPoll > 3000) pollNow();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') startPolling();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.EntHub = {
    PAGES: PAGES,
    PAGE_ORDER: PAGE_ORDER,
    uid: uid,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    detectSource: detectSource,
    fetchPreview: fetchPreview,
    collectionFor: collectionFor,
    migratePhotosToStorage: migratePhotosToStorage,
    itemsForPage: itemsForPage,
    itemsForSubtopic: itemsForSubtopic,
    favoritesForPage: favoritesForPage,
    allFavorites: allFavorites,
    nextOrder: nextOrder,
    reorderVisible: reorderVisible,
    toggleFavorite: toggleFavorite,
    setRating: setRating,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty,
    bootSync: bootSync,
    slugForSubtopic: slugForSubtopic,
    subtopicForSlug: subtopicForSlug,
    getHero: getHero,
    saveHero: saveHero
  };
})(window);
