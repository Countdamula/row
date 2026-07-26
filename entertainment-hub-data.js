// entertainment-hub-data.js
//
// Shared data foundation for the "Entertainment" nav folder — five
// genuinely new, standalone pages (ent-podcasts.html, ent-stories.html,
// ent-entertainment.html, ent-playlists.html, ent-favorites.html), all
// loading this one file plus entertainment-hub-ui.js. This is a brand
// new feature area, completely separate from the existing standalone
// `entertainment.html` ("Media") page and its own `media:*` keys/`key:
// 'entertainment'` Supabase row — nothing here reads, writes, or
// repurposes anything belonging to that page (DO NOT MODIFY §1: never
// repurpose an existing key's sync scheme).
//
// Four flat collections, one per content page, each a plain array of
// EntItem records under its own `enthub:*` key:
//   - enthub:podcasts
//   - enthub:stories
//   - enthub:entertainment
//   - enthub:playlists
// The fifth page, Favorites, owns no collection of its own — it's a
// live, read/write aggregation across all four (any item with
// `favorite: true`), the same "virtual gallery, no separate storage"
// precedent entertainment.html's own Favorites tab already established
// — favoriting/editing/rating from the Favorites page writes straight
// back into the item's real, owning collection, so there's exactly one
// copy of each item's data, never a second synced copy.
//
// All five pages share one Supabase row (`appKey: 'enthub'`,
// `syncedPrefixes: ['enthub:']`) — same "one row covers several
// logically separate pages" precedent index.html's own `goals` row
// already uses for routine:/system:/fitness:/mainselfcare:.

(function (global) {
  'use strict';

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
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('enthub:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // PAGE CONFIG — the four content pages, each with its own fixed
  // sub-topic list (the request's own "additional sub-pages"). A
  // sub-topic is just a string tag on an item, not its own storage —
  // same "category is a field, not a collection" precedent every other
  // gallery/database in this app already uses (e.g. business.html's
  // Content Plan `platform` field).
  // ============================================================
  const PAGES = {
    podcasts: {
      key: 'podcasts', storageKey: 'enthub:podcasts', label: 'Podcasts', icon: '🎙️',
      subtopics: ['Learning', 'Photography / Videography', 'True Crime', 'Business']
    },
    stories: {
      key: 'stories', storageKey: 'enthub:stories', label: 'Stories', icon: '📖',
      subtopics: ['Horror Stories', 'Spicy Stories', 'Immersive Experience']
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
  const PAGE_ORDER = ['podcasts', 'stories', 'entertainment', 'playlists'];

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
   * favorite:boolean, order:number, createdAt:number}} EntItem */
  function itemModel(pageKey, data) {
    data = data || {};
    const cfg = PAGES[pageKey];
    const subtopics = cfg ? cfg.subtopics : [];
    const rating = Math.max(0, Math.min(5, Math.round(Number(data.rating) || 0)));
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
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
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
      storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = itemModel(pageKey, Object.assign({}, all[idx], patch, { id: id }));
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

    seedItem('stories', 'Horror Stories', 'NoSleep Podcast', '');
    seedItem('stories', 'Spicy Stories', 'Dirty Diana', '');
    seedItem('stories', 'Immersive Experience', 'The Magnus Archives', '');

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
  /** @typedef {{eyebrow:string, title:string, subtext:string, photo:string}} EntHero */
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      photo: typeof data.photo === 'string' ? data.photo : ''
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
    const next = heroModel(Object.assign({}, heroModel(all[pageKey]), patch));
    all[pageKey] = next;
    storeSet('enthub:heroes', all);
    return next;
  }

  // ============================================================
  // SYNC BOOTSTRAP — one shared helper so all five pages wire up the
  // exact same appKey/prefix and the exact same seed-race-safety window
  // (deferred until either real cloud data arrives via onApplied or a
  // 5-second window elapses, or immediately if the Supabase SDK never
  // loaded) instead of each page hand-rolling its own copy — same
  // reasoning as every other page in this app that already does this
  // (dreamboard.html/business.html/aitech.html/tasks.html/etc.).
  // `onReady` is called once, either when a real remote pull applies or
  // when the seed-race window elapses with nothing having arrived —
  // either way, it's the caller's cue to (re-)render.
  // ============================================================
  function bootSync(onReady) {
    let remoteAppliedOnce = false;
    const startedEmpty = PAGE_ORDER.every(function (pk) { return collectionFor(pk).list().length === 0; });
    function maybeSeed() {
      if (remoteAppliedOnce) return;
      // A device that's offline hasn't actually had a real chance to pull
      // remote data yet — seeding here would just fabricate demo content
      // that later gets pushed over (and clobbers) whatever's real once
      // connectivity returns. Wait for a real online signal instead.
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
      // Widened from an earlier, tighter window — a slow/flaky mobile
      // connection can genuinely take longer than a couple of seconds to
      // resolve the initial cloud pull, and seeding before it lands risks
      // pushing fabricated demo content over real cross-device data (the
      // same race this app's other pages have hit before).
      if (startedEmpty) setTimeout(maybeSeed, 9000);
    } else if (startedEmpty) {
      maybeSeed();
    }
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
