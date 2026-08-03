// mediaverse-data.js
//
// Data layer for mediaverse.html ("Media") — a single hub connecting
// everything read/watched/listened-to/played: Reading, Anime, Games,
// Videos, Horror Stories (a separate Reading and YouTube database each,
// since those are two different things you consume), Spicy Stories (same
// Reading/YouTube split), Podcasts, Music & Playlists, and Immersive/ASMR
// experiences, plus Franchise Collections, an Inspiration Vault, live
// Favorites/Discovery/Statistics, and a curated Upcoming Releases / New &
// Trending board. Movies & TV was removed per an explicit request — there
// is no `screen` category anymore.
//
// Same conventions as every other page's own -data.js in this app: plain
// localStorage, JSON-serialized, one key per collection, model-factory +
// makeCollection() CRUD (the exact recipe businessdash-data.js/
// aitech-data.js/businessos-data.js already use). Every key lives under a
// `mediaverse:` prefix so mediaverse.html's initCloudSync({ syncedPrefixes:
// ['mediaverse:'] }) call covers every collection with no per-key list.
//
// Genuinely separate from the pre-existing Entertainment folder (five
// ent-*.html pages sharing entertainment-hub-data.js/entertainment-hub-ui
// .js, own `enthub:` prefix) and from entertainment.html ("Media", own
// `media:` prefix) — nothing here reads or writes either. This page reuses
// two of this app's shared UI *kits* instead (glass-theme.css/js,
// gallery-card.css/js — see mediaverse.html's own header comment), but
// owns 100% of its own data.
//
// "New & Trending" and "Discovery Engine"'s mood/time-available filters
// are confirmed adaptations, disclosed rather than silently narrowed: this
// app has no backend and no external trend/recommendation API (§2/§4 of
// CLAUDE.md), so "trending" is a manual per-item flag you curate yourself
// (sorted newest-first when browsing), not a live feed, and Discovery only
// filters on data this page actually stores (category, completion status,
// rating) rather than fabricating mood/platform signals it has no way to
// know.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('mediaverse:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('mediaverse:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    items: 'mediaverse:items',
    releases: 'mediaverse:releases',
    collections: 'mediaverse:collections',
    notes: 'mediaverse:notes',
    hero: 'mediaverse:hero',
    homeLayout: 'mediaverse:homeLayout',
    seeded: 'mediaverse:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function currentYear() { return String(new Date().getFullYear()); }

  // ============================================================
  // CATEGORY TAXONOMY — the one table every generic renderer in
  // mediaverse.html reads to know a category's label/icon/creator-field
  // wording/status wording/suggested genre & tag chips, instead of ten
  // bespoke section implementations.
  // ============================================================
  const CATEGORY_KEYS = ['reading', 'anime', 'game', 'video', 'horror', 'horrorwatch', 'spicy', 'spicywatch', 'podcast', 'music', 'immersive'];

  const STATUS_KEYS = ['want', 'active', 'completed', 'dropped'];
  const DEFAULT_STATUS_LABELS = { want: 'Backlog', active: 'In Progress', completed: 'Completed', dropped: 'Dropped' };

  const CATEGORY_META = {
    reading: {
      icon: '📚', fallbackIcon: '📖', label: 'Reading', creatorLabel: 'Author',
      hasFormat: true, formats: ['Book', 'Novel', 'Manga', 'Light Novel', 'Comic', 'Audiobook'],
      subcats: ['Fantasy', 'Dark Fantasy', 'Horror', 'Romance', 'Dark Romance', 'Thriller', 'Mystery', 'Sci-Fi', 'Psychology', 'Business', 'AI', 'History', 'Philosophy', 'Science', 'Nonfiction'],
      statusLabels: { want: 'Want To Read', active: 'Currently Reading', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Books read'
    },
    anime: {
      icon: '🌸', fallbackIcon: '🌸', label: 'Anime', creatorLabel: 'Studio',
      hasFormat: false, formats: [],
      subcats: ['Shonen', 'Shojo', 'Seinen', 'Isekai', 'Slice of Life', 'Horror', 'Romance', 'Fantasy', 'Sci-Fi'],
      statusLabels: { want: 'Plan To Watch', active: 'Currently Watching', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Anime completed'
    },
    game: {
      icon: '🎮', fallbackIcon: '🎮', label: 'Games', creatorLabel: 'Developer / Platform',
      hasFormat: true, formats: ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'VR'],
      subcats: ['RPG', 'Horror', 'Fantasy', 'Strategy', 'Survival', 'Simulation', 'Indie', 'Multiplayer'],
      statusLabels: { want: 'Backlog', active: 'Currently Playing', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Games completed'
    },
    video: {
      icon: '📺', fallbackIcon: '📺', label: 'Videos', creatorLabel: 'Channel / Creator',
      hasFormat: false, formats: [],
      subcats: ['Gaming', 'Scary Videos', 'Vlog-Like', 'Documentaries', "Let's Plays", 'Reviews', 'Lore', 'Other'],
      statusLabels: { want: 'Want To Watch', active: 'Watching', completed: 'Watched', dropped: 'Dropped' },
      statCountLabel: 'Videos watched'
    },
    horror: {
      icon: '👻', fallbackIcon: '👻', label: 'Horror Stories · Reading', creatorLabel: 'Author / Narrator',
      hasFormat: false, formats: [],
      subcats: ['True Stories', 'Creepypastas'],
      statusLabels: { want: 'Want To Read', active: 'Reading', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Horror stories devoured'
    },
    // Separate from `horror` above per an explicit request — horror
    // stories watched/listened to on YouTube (narrated readings, analog
    // horror, found-footage channels) are their own database, not mixed
    // into the reading one. Same field shape as `video`/`podcast` — a
    // creator/channel, no format list, "Watching"-verb status wording —
    // since this is video/audio content, not a book.
    horrorwatch: {
      icon: '👻🎥', fallbackIcon: '👻', label: 'Horror Stories · YouTube', creatorLabel: 'Channel / Creator',
      hasFormat: false, formats: [],
      subcats: ['True Stories', 'Creepypastas', 'Analog Horror', 'Found Footage'],
      statusLabels: { want: 'Want To Watch', active: 'Watching', completed: 'Watched', dropped: 'Dropped' },
      statCountLabel: 'Horror videos watched'
    },
    spicy: {
      icon: '🌶', fallbackIcon: '🌶', label: 'Spicy Stories · Reading', creatorLabel: 'Author',
      hasFormat: false, formats: [],
      subcats: ['Romance', 'Dark Romance', 'Fantasy Romance', 'Paranormal Romance', 'Historical Romance'],
      tagSuggestions: ['Enemies to Lovers', 'Slow Burn', 'Forbidden Love', 'Fake Dating', 'Royal Romance', 'Monster Romance', 'Villain Romance', 'Soulmates'],
      tagFieldLabel: 'Tropes',
      statusLabels: { want: 'Want To Read', active: 'Reading', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Spicy stories read'
    },
    // Same split as horror/horrorwatch above, for the same stated reason —
    // spicy stories narrated/read on YouTube, separate from the reading
    // database. Same trope vocabulary as `spicy` since it's the same
    // genre, just a different medium.
    spicywatch: {
      icon: '🌶🎥', fallbackIcon: '🌶', label: 'Spicy Stories · YouTube', creatorLabel: 'Channel / Creator',
      hasFormat: false, formats: [],
      subcats: ['Romance', 'Dark Romance', 'Fantasy Romance', 'Paranormal Romance'],
      tagSuggestions: ['Enemies to Lovers', 'Slow Burn', 'Forbidden Love', 'Fake Dating', 'Royal Romance', 'Monster Romance', 'Villain Romance', 'Soulmates'],
      tagFieldLabel: 'Tropes',
      statusLabels: { want: 'Want To Watch', active: 'Watching', completed: 'Watched', dropped: 'Dropped' },
      statCountLabel: 'Spicy stories watched'
    },
    podcast: {
      icon: '🎧', fallbackIcon: '🎧', label: 'Podcasts', creatorLabel: 'Host / Network',
      hasFormat: false, formats: [],
      subcats: ['Learning', 'Creative', 'Entertainment', 'Dark'],
      tagSuggestions: ['Business', 'AI', 'Psychology', 'Science', 'Health', 'History', 'Writing', 'Photography', 'Videography', 'Filmmaking', 'Design', 'Comedy', 'Pop Culture', 'Gaming', 'Anime', 'True Crime', 'Mystery'],
      tagFieldLabel: 'Topics',
      statusLabels: { want: 'Want To Listen', active: 'Listening', completed: 'Caught Up', dropped: 'Dropped' },
      statCountLabel: 'Podcasts caught up on'
    },
    music: {
      icon: '🎵', fallbackIcon: '🎵', label: 'Music & Playlists', creatorLabel: 'Artist / Curator',
      hasFormat: false, formats: [],
      subcats: ['Fantasy', 'Rock', 'Metal', 'Classical', 'Lo-fi', 'Ambient', 'Electronic', 'Jazz', 'Hip-Hop', 'Pop', 'Soundtracks'],
      tagSuggestions: ['Writing', 'Reading', 'Workout', 'Studying', 'Relaxing', 'Sleep', 'Gaming', 'Dark Fantasy', 'Horror', 'Cozy', 'Romantic', 'Epic', 'Cinematic', 'Cyberpunk', 'Medieval'],
      tagFieldLabel: 'Purpose / Atmosphere',
      statusLabels: { want: 'Saved', active: 'On Rotation', completed: 'Retired', dropped: 'Dropped' },
      statCountLabel: 'Playlists in rotation'
    },
    immersive: {
      icon: '🌌', fallbackIcon: '🌌', label: 'Immersive / ASMR', creatorLabel: 'Creator / Source',
      hasFormat: false, formats: [],
      subcats: ['ASMR', 'Ambience', 'Soundscape', 'Virtual World', 'Guided Experience'],
      statusLabels: { want: 'Want To Try', active: 'In Rotation', completed: 'Completed', dropped: 'Dropped' },
      statCountLabel: 'Immersive sessions'
    }
  };

  function categoryMeta(cat) { return CATEGORY_META[cat] || CATEGORY_META.reading; }
  function statusLabel(cat, status) {
    const meta = categoryMeta(cat);
    return (meta.statusLabels && meta.statusLabels[status]) || DEFAULT_STATUS_LABELS[status] || status;
  }

  // "Continue" groupings — which categories feed which Home row.
  const CONTINUE_GROUPS = {
    reading: { icon: '📚', label: 'Reading', categories: ['reading', 'horror', 'spicy'] },
    watching: { icon: '🎬', label: 'Watching', categories: ['anime', 'video', 'horrorwatch', 'spicywatch'] },
    listening: { icon: '🎧', label: 'Listening', categories: ['podcast', 'music'] },
    playing: { icon: '🎮', label: 'Playing', categories: ['game'] }
  };

  // ============================================================
  // MODELS
  // ============================================================
  function itemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mi'),
      category: CATEGORY_KEYS.indexOf(data.category) !== -1 ? data.category : 'reading',
      title: typeof data.title === 'string' ? data.title : '',
      creator: typeof data.creator === 'string' ? data.creator : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      url: typeof data.url === 'string' ? data.url : '',
      subcategory: typeof data.subcategory === 'string' ? data.subcategory : '',
      format: typeof data.format === 'string' ? data.format : '',
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      status: STATUS_KEYS.indexOf(data.status) !== -1 ? data.status : 'want',
      rating: (typeof data.rating === 'number' && data.rating >= 0 && data.rating <= 5) ? data.rating : 0,
      favorite: !!data.favorite,
      trending: !!data.trending,
      progressText: typeof data.progressText === 'string' ? data.progressText : '',
      description: typeof data.description === 'string' ? data.description : '',
      notesText: typeof data.notesText === 'string' ? data.notesText : '',
      lengthText: typeof data.lengthText === 'string' ? data.lengthText : '',
      completedAt: typeof data.completedAt === 'string' ? data.completedAt : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function releaseModel(data) {
    data = data || {};
    return {
      id: data.id || uid('rel'),
      category: CATEGORY_KEYS.indexOf(data.category) !== -1 ? data.category : 'reading',
      title: typeof data.title === 'string' ? data.title : '',
      dateText: typeof data.dateText === 'string' ? data.dateText : '',
      meta: typeof data.meta === 'string' ? data.meta : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function franchiseModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fr'),
      name: typeof data.name === 'string' ? data.name : '',
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '🏰',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      itemIds: Array.isArray(data.itemIds) ? data.itemIds.filter(function (x) { return typeof x === 'string'; }) : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** Generic "editable, reorderable, generated-on-demand" note section —
   * same precedent as system.html's Page Notes / businessdash.html's
   * Sections. `scope`+`scopeId` say what it's attached to; only
   * 'inspiration' is used today (scopeId 'global'), but the shape is
   * generic in case a future section on this page wants the same
   * mechanism (matching this app's own established reuse-before-inventing
   * discipline). `image` is a plain paste-a-URL field (no upload
   * pipeline) — a deliberate simplification for a vision-board-style
   * note, same "keep a minor field simple" precedent mainpillar.html's
   * own Favorites gallery cover field already established. */
  function noteSectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('nsec'),
      scope: typeof data.scope === 'string' ? data.scope : 'inspiration',
      scopeId: typeof data.scopeId === 'string' ? data.scopeId : 'global',
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      image: typeof data.image === 'string' ? data.image : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : 'YOUR MEDIA, CONNECTED',
      title: typeof data.title === 'string' ? data.title : 'Your entire entertainment ecosystem in one place.',
      subtext: typeof data.subtext === 'string' ? data.subtext : 'Everything you read, watch, listen to, and play — connected, tracked, and one click away.',
      ctaLabel: typeof data.ctaLabel === 'string' && data.ctaLabel ? data.ctaLabel : '⚡ Continue Where You Left Off',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD (same recipe as businessdash-data.js)
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list(); all.push(record); storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
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

  const Items = makeCollection(KEYS.items, itemModel);
  const Releases = makeCollection(KEYS.releases, releaseModel);
  const Franchises = makeCollection(KEYS.collections, franchiseModel);
  const Notes = makeCollection(KEYS.notes, noteSectionModel);

  // removeItem also strips the id out of any franchise that referenced it
  // — null-out-the-reference, not a cascade, the same precedent
  // aitech-data.js's model deletion / household-data.js's legion deletion
  // already established.
  function removeItem(id) {
    const ok = Items.remove(id);
    if (ok) {
      Franchises.list().forEach(function (fr) {
        if (fr.itemIds.indexOf(id) !== -1) {
          Franchises.update(fr.id, { itemIds: fr.itemIds.filter(function (x) { return x !== id; }) });
        }
      });
    }
    return ok;
  }

  // ============================================================
  // SORT / ORDER HELPERS
  // ============================================================
  function byOrder(a, b) { return (a.order - b.order) || (a.createdAt - b.createdAt); }
  function nextOrder(list) {
    let m = -1;
    list.forEach(function (x) { if (x.order > m) m = x.order; });
    return m + 1;
  }

  function itemsByCategory(category) {
    return Items.list().filter(function (x) { return x.category === category; }).sort(byOrder);
  }

  /** filters = { subcategory, tag, status, favoritesOnly, search, minRating } —
   * every filter composes, same "every filter composes" precedent this
   * app's own galleries already follow. */
  function filterItems(list, filters) {
    filters = filters || {};
    return list.filter(function (it) {
      if (filters.subcategory && filters.subcategory !== 'All' && it.subcategory !== filters.subcategory) return false;
      if (filters.tag && filters.tag !== 'All' && it.tags.indexOf(filters.tag) === -1) return false;
      if (filters.status && filters.status !== 'All' && it.status !== filters.status) return false;
      if (filters.favoritesOnly && !it.favorite) return false;
      if (filters.minRating && it.rating < filters.minRating) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = (it.title + ' ' + it.creator + ' ' + it.description).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function distinctValues(list, field) {
    const seen = {}; const out = [];
    list.forEach(function (it) {
      const v = it[field];
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    out.sort();
    return out;
  }
  function distinctTags(list) {
    const seen = {}; const out = [];
    list.forEach(function (it) {
      it.tags.forEach(function (t) { if (!seen[t]) { seen[t] = true; out.push(t); } });
    });
    out.sort();
    return out;
  }

  // Reorder a category's items using only the currently-*visible*
  // (filtered) drag result, remapped back into the real underlying order —
  // the same technique entertainment.html's own Manual sort mode,
  // business.html's Content-section drag, and tasks.html's reorder-under-
  // filter fix already established, so dragging within a filtered view can
  // never scramble items sitting outside that filter.
  function reorderCategoryVisible(category, visibleIds) {
    const catItems = itemsByCategory(category);
    const visibleSet = {};
    visibleIds.forEach(function (id) { visibleSet[id] = true; });
    let vi = 0;
    catItems.forEach(function (it, idx) {
      const newId = visibleSet[it.id] ? visibleIds[vi++] : it.id;
      Items.update(newId, { order: idx });
    });
  }

  function setItemStatus(id, status) {
    const it = Items.get(id);
    if (!it) return null;
    const patch = { status: status };
    if (status === 'completed') { if (!it.completedAt) patch.completedAt = todayISO(); }
    else { patch.completedAt = ''; }
    return Items.update(id, patch);
  }
  function toggleItemFavorite(id) {
    const it = Items.get(id);
    if (!it) return null;
    return Items.update(id, { favorite: !it.favorite });
  }
  function setItemRating(id, rating) {
    return Items.update(id, { rating: rating });
  }

  // ============================================================
  // HOME / CONTINUE / TRENDING / FAVORITES / DISCOVERY / STATS
  // ============================================================
  function continueGroups() {
    const out = {};
    Object.keys(CONTINUE_GROUPS).forEach(function (gk) {
      const cats = CONTINUE_GROUPS[gk].categories;
      out[gk] = Items.list()
        .filter(function (it) { return it.status === 'active' && cats.indexOf(it.category) !== -1; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
    });
    return out;
  }

  function trendingItems() {
    return Items.list().filter(function (it) { return it.trending; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function allFavorites() {
    return Items.list().filter(function (it) { return it.favorite; }).sort(byOrder);
  }

  /** opts = { category ('any' or a real key), minRating, unseenOnly }.
   * Confirmed adaptation: filters only on data this page genuinely has
   * (category / rating / completion status) — no mood/time-available/
   * platform signal exists to filter on, so those spec filters aren't
   * faked here (see this file's own header comment). */
  function randomItem(opts) {
    opts = opts || {};
    let pool = Items.list();
    if (opts.category && opts.category !== 'any') pool = pool.filter(function (x) { return x.category === opts.category; });
    if (opts.minRating) pool = pool.filter(function (x) { return x.rating >= opts.minRating; });
    if (opts.unseenOnly) pool = pool.filter(function (x) { return x.status !== 'completed'; });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Computed live from Items with status==='completed' and a completedAt
   * falling in the current calendar year — never stored, so it can never
   * drift from the real data. "Music hours"/"podcast hours" from the
   * original spec are replaced with plain item counts — this app tracks
   * no real listening-duration telemetry, a documented simplification
   * consistent with this app's other single-number roll-ups. */
  function statsThisYear() {
    const yr = currentYear();
    const all = Items.list();
    const perCategory = {};
    let totalCompleted = 0;
    CATEGORY_KEYS.forEach(function (cat) {
      const n = all.filter(function (it) {
        return it.category === cat && it.status === 'completed' && it.completedAt && it.completedAt.slice(0, 4) === yr;
      }).length;
      perCategory[cat] = n;
      totalCompleted += n;
    });
    return {
      year: yr,
      perCategory: perCategory,
      totalCompleted: totalCompleted,
      totalFavorites: all.filter(function (it) { return it.favorite; }).length,
      totalItems: all.length
    };
  }

  // ============================================================
  // RELEASES / FRANCHISES / NOTES selectors
  // ============================================================
  function releasesByCategory() {
    const out = {};
    CATEGORY_KEYS.forEach(function (c) { out[c] = []; });
    Releases.list().sort(byOrder).forEach(function (r) { (out[r.category] || (out[r.category] = [])).push(r); });
    return out;
  }
  function moveRelease(id, dir) {
    const r = Releases.get(id); if (!r) return;
    const siblings = Releases.list().filter(function (x) { return x.category === r.category; }).sort(byOrder);
    const idx = siblings.findIndex(function (x) { return x.id === id; });
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    Releases.update(a.id, { order: b.order });
    Releases.update(b.id, { order: a.order });
  }

  function franchisesSorted() { return Franchises.list().sort(byOrder); }
  function itemsForFranchise(fr) {
    const byId = {};
    Items.list().forEach(function (it) { byId[it.id] = it; });
    return fr.itemIds.map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function moveFranchise(id, dir) {
    const all = franchisesSorted();
    const idx = all.findIndex(function (x) { return x.id === id; });
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= all.length) return;
    const a = all[idx], b = all[swapIdx];
    Franchises.update(a.id, { order: b.order });
    Franchises.update(b.id, { order: a.order });
  }

  function notesFor(scope, scopeId) {
    return Notes.list().filter(function (n) { return n.scope === scope && n.scopeId === scopeId; }).sort(byOrder);
  }
  function addNoteSection(scope, scopeId, title) {
    const all = notesFor(scope, scopeId);
    return Notes.add({ scope: scope, scopeId: scopeId, title: title || 'New Section', order: nextOrder(all) });
  }
  function moveNoteSection(id, dir) {
    const n = Notes.get(id); if (!n) return;
    const siblings = notesFor(n.scope, n.scopeId);
    const idx = siblings.findIndex(function (x) { return x.id === id; });
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    Notes.update(a.id, { order: b.order });
    Notes.update(b.id, { order: a.order });
  }

  function getHero() { return heroModel(storeGet(KEYS.hero) || {}); }
  function saveHero(patch) {
    const next = heroModel(Object.assign({}, getHero(), patch));
    storeSet(KEYS.hero, next);
    return next;
  }

  function getHomeLayout() { const v = storeGet(KEYS.homeLayout); return Array.isArray(v) ? v : []; }
  function saveHomeLayout(order) { storeSet(KEYS.homeLayout, order); }

  // ============================================================
  // SEED DATA — a small starting set across every category so Home /
  // Stats / Favorites / Discovery all have something real to show,
  // guarded the same empty-storage seed-race-safety way as every other
  // synced page in this app (dreamboard.html/business.html/aitech.html/
  // businessdash.html's own maybeSeedAfterSyncAttempt()) — seeding before
  // the cloud pull has a real chance to answer could push a freshly-
  // seeded "default" set to Supabase and clobber another device's real
  // data.
  // ============================================================
  function isEmptyEverywhere() {
    return !Items.list().length && !Releases.list().length && !Franchises.list().length && !Notes.list().length;
  }

  function seedDefaultData() {
    const items = [];
    let ord = {};
    function push(category, title, patch) {
      ord[category] = (ord[category] || 0);
      const rec = itemModel(Object.assign({ category: category, title: title, order: ord[category]++, createdAt: Date.now() - Math.floor(Math.random() * 9e9) }, patch));
      items.push(rec);
      return rec;
    }

    var acotar = push('reading', 'A Court of Thorns and Roses', { creator: 'Sarah J. Maas', subcategory: 'Fantasy Romance', format: 'Novel', status: 'want', description: 'A huntress dragged into a faerie court she never asked for.' });
    push('reading', 'The Bone Season', { creator: 'Samantha Shannon', subcategory: 'Fantasy', format: 'Novel', status: 'active', rating: 4, progressText: 'Ch. 12 of 30', description: 'A clairvoyant in a dystopian London ruled by a secret voyant syndicate.', favorite: true });
    push('reading', 'Atomic Habits', { creator: 'James Clear', subcategory: 'Psychology', format: 'Audiobook', status: 'completed', rating: 5, completedAt: todayISO() });

    push('anime', 'Frieren: Beyond Journey\'s End', { creator: 'Madhouse', subcategory: 'Fantasy', status: 'active', rating: 5, progressText: 'Ep. 18', favorite: true, trending: true });
    push('anime', 'Mushishi', { creator: 'Artland', subcategory: 'Slice of Life', status: 'want' });

    push('game', 'Elden Ring', { creator: 'FromSoftware · PC', subcategory: 'RPG', format: 'PC', status: 'active', rating: 5, progressText: '62 hrs · Mountaintops of the Giants', favorite: true });
    push('game', 'Hades', { creator: 'Supergiant Games', subcategory: 'Indie', format: 'Switch', status: 'completed', rating: 5, completedAt: todayISO() });

    push('video', 'Lore of Elden Ring, Explained', { creator: 'VaatiVidya', subcategory: 'Lore', status: 'want', trending: true });
    push('video', 'Abandoned Places at 3AM', { creator: 'Exploring With Josh', subcategory: 'Scary Videos', status: 'active', progressText: '14:22 / 41:10' });

    push('horror', 'The Bone Season — audiobook edition', { creator: 'Samantha Shannon', subcategory: 'True Stories', status: 'want' });
    push('horror', 'My Neighbor Isn\'t Human', { creator: 'True Horror Archive', subcategory: 'True Stories', status: 'completed', rating: 4, completedAt: todayISO() });

    push('horrorwatch', 'The Backrooms — Level 0', { creator: 'r/nosleep Narrations', subcategory: 'Creepypastas', status: 'completed', rating: 4, completedAt: todayISO() });
    push('horrorwatch', 'Analog Horror Marathon', { creator: 'Local58', subcategory: 'Analog Horror', status: 'active', progressText: '3 of 7 videos', trending: true });

    var acomf = push('spicy', 'A Court of Mist and Fury', { creator: 'Sarah J. Maas', subcategory: 'Fantasy Romance', tags: ['Enemies to Lovers', 'Slow Burn'], status: 'completed', rating: 5, favorite: true, completedAt: todayISO() });
    push('spicy', 'Fourth Wing', { creator: 'Rebecca Yarros', subcategory: 'Fantasy Romance', tags: ['Forbidden Love'], status: 'active', progressText: 'p. 210 / 512' });

    push('spicywatch', 'ACOTAR — Full Audio Reading, Ch. 1-10', { creator: 'Fae Realm Audio', subcategory: 'Fantasy Romance', tags: ['Slow Burn'], status: 'active', progressText: 'Ch. 6 / 10' });
    push('spicywatch', 'Dark Romance Recommendations', { creator: 'Bookish Bree', subcategory: 'Dark Romance', tags: ['Villain Romance'], status: 'want' });

    push('podcast', 'Huberman Lab', { creator: 'Andrew Huberman', subcategory: 'Learning', tags: ['Science', 'Health'], status: 'active', progressText: 'Ep. "Sleep Toolkit"', favorite: true });
    push('podcast', 'Crime Junkie', { creator: 'audiochuck', subcategory: 'Dark', tags: ['True Crime'], status: 'active' });

    push('music', 'Deep Focus — Dark Fantasy', { creator: 'self-curated', subcategory: 'Ambient', tags: ['Writing', 'Dark Fantasy', 'Cinematic'], status: 'active', favorite: true });
    push('music', 'Boss Fight Energy', { creator: 'self-curated', subcategory: 'Electronic', tags: ['Gaming', 'Epic'], status: 'active' });

    push('immersive', 'Rainstorm on a Tin Roof — 8hr', { creator: 'ASMR Glow', subcategory: 'Ambience', status: 'active', favorite: true });
    push('immersive', 'Guided: Sleep in a Cabin', { creator: 'Latenight Tales', subcategory: 'Guided Experience', status: 'want' });

    Items.replaceAll(items);

    const releases = [
      { category: 'anime', title: 'Chainsaw Man — Reze Arc', dateText: 'Fall 2026', meta: 'MAPPA' },
      { category: 'reading', title: 'A Fire in the Flesh', dateText: 'Book 3', meta: 'Rebecca Yarros — sequel' },
      { category: 'game', title: 'Silksong', dateText: 'TBA', meta: 'Team Cherry' },
      { category: 'music', title: 'New score', dateText: 'This month', meta: 'Ludwig Göransson' }
    ];
    Releases.replaceAll(releases.map(function (r, i) { return releaseModel(Object.assign({ order: i }, r)); }));

    const franchises = [{ name: 'A Court of Thorns and Roses', icon: '🌹', description: 'The full series — books, playlists, and inspiration in one place.', itemIds: [acotar.id, acomf.id] }];
    Franchises.replaceAll(franchises.map(function (f, i) { return franchiseModel(Object.assign({ order: i }, f)); }));

    const notes = [
      { title: 'Worldbuilding — a dark academia campus', body: 'Gothic dorm towers, a library that eats first-years, professors who used to be gods.' },
      { title: 'Character voice reference', body: 'Frieren\'s deadpan patience + Feyre\'s stubbornness = the protagonist I keep wanting to write.' }
    ];
    Notes.replaceAll(notes.map(function (n, i) { return noteSectionModel(Object.assign({ scope: 'inspiration', scopeId: 'global', order: i }, n)); }));
  }

  function seedIfEmpty() {
    if (!isEmptyEverywhere()) return;
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.MediaverseData = {
    KEYS: KEYS,
    CATEGORY_KEYS: CATEGORY_KEYS, CATEGORY_META: CATEGORY_META, categoryMeta: categoryMeta,
    STATUS_KEYS: STATUS_KEYS, statusLabel: statusLabel,
    CONTINUE_GROUPS: CONTINUE_GROUPS,
    uid: uid, todayISO: todayISO, currentYear: currentYear,
    byOrder: byOrder, nextOrder: nextOrder,
    Items: Object.assign({}, Items, { remove: removeItem }),
    Releases: Releases, Franchises: Franchises, Notes: Notes,
    itemsByCategory: itemsByCategory, filterItems: filterItems,
    distinctValues: distinctValues, distinctTags: distinctTags,
    reorderCategoryVisible: reorderCategoryVisible,
    setItemStatus: setItemStatus, toggleItemFavorite: toggleItemFavorite, setItemRating: setItemRating,
    continueGroups: continueGroups, trendingItems: trendingItems, allFavorites: allFavorites,
    randomItem: randomItem, statsThisYear: statsThisYear,
    releasesByCategory: releasesByCategory, moveRelease: moveRelease,
    franchisesSorted: franchisesSorted, itemsForFranchise: itemsForFranchise, moveFranchise: moveFranchise,
    notesFor: notesFor, addNoteSection: addNoteSection, moveNoteSection: moveNoteSection,
    getHero: getHero, saveHero: saveHero,
    getHomeLayout: getHomeLayout, saveHomeLayout: saveHomeLayout,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, isEmptyEverywhere: isEmptyEverywhere
  };
})(window);
