// dreamboard-data.js
//
// Shared data foundation for dreamboard.html ("Dream Board" — a vision-board /
// dream-life planning page). Same conventions as household-data.js/
// finance-data.js (see CLAUDE.md §4): plain localStorage, JSON-serialized,
// one key per collection, no server/DB. All keys live under a `dreamboard:`
// prefix so dreamboard.html's initCloudSync({ syncedPrefixes: ['dreamboard:'] })
// call covers every collection with no per-key list.
//
// The board is two flat collections: Tabs (Vision Board / Reflections /
// Quarterly Goals / Monthly Breakdown by default) and Widgets, each widget
// carrying its own tabId + column (0-2) + order, same
// flat-array-with-foreign-key convention as index.html's Goals/Tasks/
// Milestones (not a nested tree) — reordering/moving between columns is
// just rewriting column/order on the affected widgets.
//
// Photo/video slots store images as compressed base64 data: URLs (the same
// canvas-downscale recipe every other page in this app already uses for
// cover art/sigils/equipment photos) or a plain pasted http(s) URL. Video
// has no such option — there's no backend/storage in this app (see
// CLAUDE.md §2/§4) — so a video slot only ever holds a pasted URL or a
// session-local blob: URL created from an uploaded file; the blob URL is
// never persisted (it dies with the tab), which the UI surfaces as a
// "video needs to be re-attached" placeholder after a reload.

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
    // This used to swallow a failed write entirely — if localStorage's
    // quota was full (easy to hit with a few full-size cover photos
    // across four tabs), the edit would just silently vanish with zero
    // signal, which looks exactly like "sometimes it doesn't save/sync."
    // A `dreamboard:save` event now fires either way so dreamboard.html
    // can show a real, honest status (not a guess about whether the
    // *cross-device* push also succeeded — sync.js owns that part and
    // isn't touched here — just whether this device's local write did).
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('dreamboard:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('dreamboard:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    tabs: 'dreamboard:tabs',
    widgets: 'dreamboard:widgets',
    seeded: 'dreamboard:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // IMAGE COMPRESSION — same canvas-downscale-then-JPEG-reencode recipe as
  // household-data.js/gym.html/entertainment.html (no Supabase Storage,
  // no build step to bundle a library — this is the whole app's convention).
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 640;
    quality = quality == null ? 0.78 : quality;
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

  /** Requires the value to parse as a URL AND resolve to http(s) — same
   * validate-before-accept precedent as selfcare.html's meditation links
   * and index.html's habit media links. */
  function isValidMediaUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  // ============================================================
  // MODELS — JSDoc-typed factories, same "fill every field with a sane
  // default" convention as finance-data.js/household-data.js. No build
  // step / no TypeScript in this repo, so this is the closest thing to
  // a schema.
  // ============================================================

  const WIDGET_TYPES = ['checklist', 'list', 'note', 'quote', 'affirmation', 'steps', 'photos', 'calendar', 'feature', 'infocard'];

  // Per-tab "hero" — a full-bleed cover section styled after a reference
  // cinematic-photography landing page (see dreamboard.html's changelog
  // entry): each tab now reads as its own "page" with its own eyebrow/
  // headline/subtext/CTA/cover photo, editable in place, not a separate
  // widget (it isn't reorderable/deletable the way board widgets are —
  // it's page chrome for that tab, one per tab, always present).
  function defaultHero(seedIndex) {
    const presets = [
      { eyebrow: 'YOUR DREAM LIFE', title: 'Timeless Vision.\nInfinite Possibility.', subtext: 'For the dreamers, the believers, the ones still becoming. This is the life I am building — beautifully, honestly, on purpose.', ctaLabel: 'VIEW BOARD', photo: '' },
      { eyebrow: 'WHO I’M BECOMING', title: 'Honest Words.\nQuiet Growth.', subtext: 'The truths I tell myself, the traits I’m growing into, and the reflections worth writing down.', ctaLabel: 'REFLECT', photo: '' },
      { eyebrow: 'THIS QUARTER', title: 'Small Steps.\nBig Momentum.', subtext: 'What I’m working toward these three months, tracked one goal at a time.', ctaLabel: 'SEE GOALS', photo: '' },
      { eyebrow: 'THIS MONTH', title: 'Every Day.\nOn Purpose.', subtext: 'Routines, rhythms, and the small daily choices that add up to a life I love.', ctaLabel: 'VIEW MONTH', photo: '' }
    ];
    return presets[seedIndex] || presets[0];
  }
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      // A cheap average-RGB hex sampled from `photo` once, when it's set
      // (see dreamboard.html's extractDominantColor()) — a flat string,
      // never a nested object, specifically so a legacy record missing it
      // just reads as '' (falsy) everywhere it's used, the same defensive
      // shape every other new field on this page follows after the hero
      // crash this file's changelog already documents.
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }

  /** @typedef {{id:string, title:string, order:number, hero:Object}} DreamTab */
  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      order: typeof data.order === 'number' ? data.order : 0,
      hero: heroModel(data.hero)
    };
  }

  function defaultWidgetData(type) {
    switch (type) {
      case 'checklist': return { items: [] };
      case 'list': return { items: [] };
      case 'note': return { body: '' };
      case 'quote': return { text: '', author: '' };
      case 'affirmation': return { items: [] };
      case 'steps': return { goal: 10000, log: {} };
      case 'photos': return { wide: false, slots: [] };
      case 'calendar': return { notes: {}, viewYear: null, viewMonth: null };
      case 'feature': return { photo: '', title: '', caption: '' };
      case 'infocard': return { icon: '🌍', title: '', subtitle: '' };
      default: return {};
    }
  }

  /** @typedef {{id:string, tabId:string, column:number, order:number, type:string, title:string, accent:string, data:Object}} DreamWidget */
  function widgetModel(data) {
    data = data || {};
    const type = WIDGET_TYPES.indexOf(data.type) !== -1 ? data.type : 'note';
    const defaults = defaultWidgetData(type);
    const incoming = (data.data && typeof data.data === 'object') ? data.data : {};
    return {
      id: data.id || uid('wdg'),
      tabId: data.tabId || null,
      column: typeof data.column === 'number' ? data.column : 0,
      order: typeof data.order === 'number' ? data.order : 0,
      type: type,
      title: typeof data.title === 'string' ? data.title : '',
      accent: data.accent === 'blush' ? 'blush' : 'default',
      // Per-widget glass color grading: null/undefined = neutral glass,
      // a '#rrggbb' string = a manually picked tint, or the literal string
      // 'photo' = "match this widget's tab's cover photo" (resolved live
      // at render time via effectiveTint() in dreamboard.html, never
      // stored as a resolved color, so it stays in sync if the photo
      // changes later). Always a flat string or null — never a nested
      // object — so a legacy record simply missing this field reads as
      // `undefined`, which every read site treats the same as null.
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // household-data.js/finance-data.js.
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list();
      all.push(record);
      storeSet(key, all);
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

  const Tabs = makeCollection(KEYS.tabs, tabModel);
  const Widgets = makeCollection(KEYS.widgets, widgetModel);

  // `list()`/`get()` return raw stored JSON as-is (see makeCollection above) —
  // they never re-run a record through its model factory, only add()/update()
  // do. That's fine for fields that existed when a record was first written,
  // but tabs saved before the per-tab `hero` field existed are missing it
  // entirely, and every hero-reading function in dreamboard.html assumes
  // `tab.hero` is always an object. Left unpatched, the very first read of
  // `tab.hero.eyebrow` on such a tab throws before anything else in the page's
  // boot sequence runs — which looked like "all my data got deleted and
  // nothing is clickable" (nothing rendered AND no event listeners got wired,
  // since both come after that line), when the underlying data was actually
  // untouched. Runs once per load, right after seedIfEmpty(), and persists
  // the backfill so it's a one-time fix per tab, not a per-render patch.
  function normalizeTabs() {
    const tabs = Tabs.list();
    let changed = false;
    const fixed = tabs.map(function (t) {
      if (t && t.hero && typeof t.hero === 'object') return t;
      changed = true;
      return tabModel(t);
    });
    if (changed) Tabs.replaceAll(fixed);
  }

  function removeTab(id) {
    Tabs.remove(id);
    Widgets.replaceAll(Widgets.list().filter(function (w) { return w.tabId !== id; }));
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function tabsSorted() {
    return Tabs.list().slice().sort(function (a, b) { return a.order - b.order; });
  }
  /** Widgets for one tab, grouped into 3 column arrays, each sorted by order. */
  function columnsForTab(tabId) {
    const cols = [[], [], []];
    Widgets.list()
      .filter(function (w) { return w.tabId === tabId; })
      .forEach(function (w) {
        const c = (w.column >= 0 && w.column <= 2) ? w.column : 0;
        cols[c].push(w);
      });
    cols.forEach(function (col) { col.sort(function (a, b) { return a.order - b.order; }); });
    return cols;
  }
  /** Bulk-persist a tab's full column layout after a drag-reorder: columnsOfIds
   * is [[widgetId,...], [widgetId,...], [widgetId,...]]. One write, not one
   * per widget, so a multi-card drag doesn't thrash localStorage/sync. */
  function reorderTab(tabId, columnsOfIds) {
    const all = Widgets.list();
    const byId = {};
    all.forEach(function (w) { byId[w.id] = w; });
    columnsOfIds.forEach(function (ids, colIdx) {
      ids.forEach(function (id, orderIdx) {
        const w = byId[id];
        if (w && w.tabId === tabId) { w.column = colIdx; w.order = orderIdx; }
      });
    });
    Widgets.replaceAll(all);
  }

  function todayStepsCount(widget) {
    if (!widget || widget.type !== 'steps') return 0;
    return Number((widget.data.log || {})[todayISO()]) || 0;
  }

  // ============================================================
  // SEED — a modest, self-consistent default board so the page never opens
  // empty and "reset to default" has something real to restore. Split
  // thematically across the four default tabs to loosely mirror the three
  // reference templates this page was built from (see CLAUDE.md's
  // changelog entry), not copied verbatim from any of them.
  // ============================================================
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);

    const visionTab = Tabs.add({ title: 'Vision Board', order: 0, hero: defaultHero(0) });
    const reflectionsTab = Tabs.add({ title: 'Reflections', order: 1, hero: defaultHero(1) });
    const quarterlyTab = Tabs.add({ title: 'Quarterly Goals', order: 2, hero: defaultHero(2) });
    const monthlyTab = Tabs.add({ title: 'Monthly Breakdown', order: 3, hero: defaultHero(3) });

    // Vision Board — three numbered "feature" cards up front (mirroring the
    // reference site's "01 The Films / 02 The Moments / 03 The Experience"
    // row), then the original photo grid/quote/affirmation widgets kept
    // exactly as before, just one row down.
    Widgets.add({ tabId: visionTab.id, column: 0, order: 0, type: 'feature', title: 'The Vision', data: { photo: '', title: 'The Vision', caption: "What I'm working toward." } });
    Widgets.add({ tabId: visionTab.id, column: 1, order: 0, type: 'feature', title: 'The Feeling', data: { photo: '', title: 'The Feeling', caption: 'How I want to feel.' } });
    Widgets.add({ tabId: visionTab.id, column: 2, order: 0, type: 'feature', title: 'The Journey', data: { photo: '', title: 'The Journey', caption: "Where it's all headed." } });
    Widgets.add({
      tabId: visionTab.id, column: 0, order: 1, type: 'photos', title: 'More Inspiration',
      data: { wide: false, slots: [] }
    });
    Widgets.add({
      tabId: visionTab.id, column: 1, order: 1, type: 'quote', title: 'Daily Quote',
      data: { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston S. Churchill' }
    });
    Widgets.add({
      tabId: visionTab.id, column: 2, order: 1, type: 'affirmation', title: 'Affirmations',
      data: { items: [{ id: uid('aff'), text: 'I am building a life I love, one day at a time.' }, { id: uid('aff'), text: 'I am grateful for another day of life.' }] }
    });

    // Reflections
    Widgets.add({
      tabId: reflectionsTab.id, column: 0, order: 0, type: 'list', title: 'How I Am ♡',
      data: {
        items: [
          { id: uid('tr'), text: 'Confident — I trust my own judgment.' },
          { id: uid('tr'), text: 'Curious — I say yes to new experiences.' },
          { id: uid('tr'), text: 'Kind — I look out for the people around me.' }
        ]
      }
    });
    Widgets.add({
      tabId: reflectionsTab.id, column: 1, order: 0, type: 'note', title: 'My Biggest Goals',
      data: { body: 'Prioritize well-being, learn a new skill, train for a physical challenge, and explore somewhere new this year.' }
    });
    Widgets.add({
      tabId: reflectionsTab.id, column: 2, order: 0, type: 'infocard', title: 'Growing Through It',
      data: { icon: '🌱', title: 'GROWING THROUGH IT', subtitle: 'Progress, not perfection.' }
    });

    // Quarterly Goals
    Widgets.add({
      tabId: quarterlyTab.id, column: 0, order: 0, type: 'checklist', title: 'My Goals', accent: 'blush',
      data: { items: [{ id: uid('it'), text: 'Set clear goals for the year', done: false }, { id: uid('it'), text: 'Read 12 books this year', done: false }] }
    });
    Widgets.add({
      tabId: quarterlyTab.id, column: 1, order: 0, type: 'checklist', title: 'Personal',
      data: { items: [{ id: uid('it'), text: 'Practice mindfulness daily', done: false }] }
    });
    Widgets.add({
      tabId: quarterlyTab.id, column: 1, order: 1, type: 'infocard', title: 'Stay Focused',
      data: { icon: '🎯', title: 'STAY FOCUSED', subtitle: 'One goal at a time.' }
    });
    Widgets.add({
      tabId: quarterlyTab.id, column: 2, order: 0, type: 'checklist', title: 'Health',
      data: { items: [{ id: uid('it'), text: 'Drink at least 2L of water daily', done: false }, { id: uid('it'), text: 'Sleep 7-8 hours each night', done: false }] }
    });

    // Monthly Breakdown
    Widgets.add({
      tabId: monthlyTab.id, column: 0, order: 0, type: 'calendar', title: 'Monthly Overview',
      data: { notes: {}, viewYear: null, viewMonth: null }
    });
    Widgets.add({
      tabId: monthlyTab.id, column: 1, order: 0, type: 'checklist', title: 'Morning Routine',
      data: { items: [{ id: uid('it'), text: 'Drink a glass of water', done: false }, { id: uid('it'), text: 'Plan your day', done: false }] }
    });
    Widgets.add({
      tabId: monthlyTab.id, column: 1, order: 1, type: 'checklist', title: 'Evening Routine',
      data: { items: [{ id: uid('it'), text: 'Unwind with tea', done: false }, { id: uid('it'), text: 'Settle into bed', done: false }] }
    });
    Widgets.add({
      tabId: monthlyTab.id, column: 2, order: 0, type: 'steps', title: 'Daily Steps',
      data: { goal: 10000, log: {} }
    });
    Widgets.add({
      tabId: monthlyTab.id, column: 2, order: 1, type: 'infocard', title: 'Consistency Wins',
      data: { icon: '📅', title: 'CONSISTENCY WINS', subtitle: 'Small habits, big results.' }
    });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Tabs.list().length || Widgets.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultBoard();
  }

  // seedIfEmpty() is deliberately NOT called automatically here anymore —
  // see dreamboard.html's init()/maybeSeedAfterSyncAttempt() for why. In
  // short: this script runs and would seed synchronously, well before
  // initCloudSync() (called later, from dreamboard.html's own init()) has
  // any chance to pull real cloud data. On a device with empty local
  // storage — its first-ever visit to this page, or storage that got
  // cleared — that meant seeding a full default board immediately, which
  // then got pushed to Supabase as this device's "local changes,"
  // overwriting another device's real data before this device ever found
  // out real data existed. dreamboard.html now calls seedIfEmpty() itself,
  // but only as a fallback after giving the cloud pull a real chance to
  // land first. normalizeTabs() stays automatic — it only backfills
  // missing fields on records that already exist, so it's a no-op on an
  // empty board and can't clobber anything.
  normalizeTabs();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.DreamBoardData = {
    KEYS: KEYS,
    WIDGET_TYPES: WIDGET_TYPES,
    uid: uid,
    todayISO: todayISO,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: { tab: tabModel, widget: widgetModel },
    defaultWidgetData: defaultWidgetData,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    tabsSorted: tabsSorted,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    todayStepsCount: todayStepsCount,
    seedDefaultBoard: seedDefaultBoard,
    seedIfEmpty: seedIfEmpty,
    normalizeTabs: normalizeTabs
  };
})(window);
