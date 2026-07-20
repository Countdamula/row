// selfcare-data.js
//
// Data foundation for selfcare.html ("Self-Care"). Rebuilt: the Water and
// Bucket List features (and their storage — selfcare:hydrationProfile,
// selfcare:waterLog, selfcare:bucketList) are removed outright per an
// explicit ask — those keys are simply never read/written by this file
// anymore and are left orphaned in localStorage/Supabase untouched, same
// treatment as every other removed-feature key elsewhere in this app (see
// CLAUDE.md's Stack/Water and Projects/Study removal entries).
//
// The main Self-Care tab is now a Dream-Board-style drag-and-drop widget
// board (Tabs + Widgets, each widget carrying its own tabId/column/order —
// same flat-array-with-foreign-key convention as dreamboard-data.js/
// business-data.js, copied verbatim: same model shapes, same
// makeCollection CRUD, same columnsForTab/reorderTab, same seed-race-safe
// seeding contract). Journals and Meditations keep their own dedicated
// collections/models (unchanged) — those two tabs stay dedicated panels,
// not freeform boards, restyled to match rather than rebuilt.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — dispatches a `selfcare:save` event on every write (same
  // honest local-write-status precedent as dreamboard-data.js's
  // storeSet(), so selfcare.html can show a real save/offline/error
  // status instead of guessing).
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('selfcare:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('selfcare:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    tabs: 'selfcare:tabs',
    widgets: 'selfcare:widgets',
    journalEntries: 'selfcare:journalEntries',
    meditations: 'selfcare:meditations',
    seeded: 'selfcare:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function localDateFromISO(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function addDaysISO(iso, days) {
    const d = localDateFromISO(iso) || new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL check every other page in this app already uses
  // (household-data.js, dreamboard-data.js, gym.html, etc.).
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
  function isValidMediaUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  // ============================================================
  // JOURNALS — unchanged from the prior build.
  // ============================================================
  const JOURNAL_TOPICS = ['daily_reflection', 'self_discovery', 'emotional_processing', 'gratitude'];

  function journalEntryModel(data) {
    data = data || {};
    return {
      id: data.id || uid('journal'),
      topic: JOURNAL_TOPICS.indexOf(data.topic) !== -1 ? data.topic : JOURNAL_TOPICS[0],
      title: data.title || '',
      body: data.body || '',
      mood: data.mood == null || data.mood === '' ? null : data.mood,
      date: data.date || todayISO(),
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      createdAt: data.createdAt || todayISO()
    };
  }

  const MEDITATION_TYPES = ['breathing', 'sleep', 'anxiety', 'focus', 'body_scan', 'other'];

  function meditationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('med'),
      title: data.title || '',
      description: data.description || '',
      url: data.url || '',
      type: MEDITATION_TYPES.indexOf(data.type) !== -1 ? data.type : 'other',
      durationMin: data.durationMin == null || data.durationMin === '' ? null : Math.max(0, Math.round(Number(data.durationMin)) || 0),
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      isFavorite: !!data.isFavorite,
      notes: data.notes || ''
    };
  }

  // ============================================================
  // BOARD MODELS — Tabs + Widgets, copied structurally from
  // dreamboard-data.js (same field shapes, same defaults-per-type). Tabs
  // gained one additive field beyond Dream Board's: `panel`, `''` for a
  // freeform widget board (Dream Board's only mode) or `'journals'` /
  // `'meditations'` for a tab that instead renders this page's own
  // dedicated Journals/Meditations UI below its hero — those two tabs
  // never carry widgets of their own.
  // ============================================================
  const WIDGET_TYPES = ['checklist', 'list', 'note', 'quote', 'affirmation', 'steps', 'photos', 'calendar', 'feature', 'infocard'];

  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : '',
      mediaType: data.mediaType === 'video' ? 'video' : 'image'
    };
  }

  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      order: typeof data.order === 'number' ? data.order : 0,
      panel: (data.panel === 'journals' || data.panel === 'meditations') ? data.panel : '',
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
      case 'infocard': return { icon: '🌿', title: '', subtitle: '' };
      default: return {};
    }
  }

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
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD
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

  const JournalEntries = makeCollection(KEYS.journalEntries, journalEntryModel);
  const Meditations = makeCollection(KEYS.meditations, meditationModel);
  const Tabs = makeCollection(KEYS.tabs, tabModel);
  const Widgets = makeCollection(KEYS.widgets, widgetModel);

  /** Backfills any tab missing `hero`/`panel` (e.g. a legacy record) so
   * every hero-reading function can assume `tab.hero` is always an object —
   * same precedent/rationale as dreamboard-data.js's normalizeTabs(), which
   * documents the exact crash this guards against. Runs once per load,
   * right after seedIfEmpty(); a no-op on an already-correct or empty
   * board, so it can never clobber real data. */
  function normalizeTabs() {
    const tabs = Tabs.list();
    let changed = false;
    const fixed = tabs.map(function (t) {
      if (t && t.hero && typeof t.hero === 'object' && typeof t.panel === 'string') return t;
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
  function entriesByTopic(topic) {
    return JournalEntries.list()
      .filter(function (e) { return !topic || e.topic === topic; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)); });
  }

  // ============================================================
  // SEED — a modest default board for the main Self-Care tab (mirroring
  // the reference "Fall Self Care Bucket List" Notion template's
  // structure: an instructions note, a bonus callout, a checklist
  // database, and a photo gallery — deliberately not a pixel copy, same
  // "loosely mirror, don't copy verbatim" precedent as dreamboard-data.js's
  // own seedDefaultBoard()), plus a Journals tab and a Meditations tab
  // (both `panel`-mode, no widgets of their own) with their own hero, plus
  // a small starter set of journal entries/meditations so those two
  // panels aren't empty on first load either.
  // ============================================================
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);

    const mainTab = Tabs.add({
      title: 'Self-Care', order: 0, panel: '',
      hero: {
        eyebrow: 'A SEASONAL RITUAL',
        title: 'Slow Down.\nFill Your Own Cup.',
        subtext: 'Small, restorative things worth making time for — a checklist to dip into whenever you need a nudge toward rest.',
        ctaLabel: 'VIEW CHECKLIST', photo: '', photoColor: '', mediaType: 'image'
      }
    });
    const journalsTab = Tabs.add({
      title: 'Journals', order: 1, panel: 'journals',
      hero: {
        eyebrow: 'DAILY REFLECTION', title: 'Write It\nDown.',
        subtext: 'Gratitude, emotional processing, self-discovery — a private page for whatever today needs.',
        ctaLabel: 'NEW ENTRY', photo: '', photoColor: '', mediaType: 'image'
      }
    });
    const meditationsTab = Tabs.add({
      title: 'Meditations', order: 2, panel: 'meditations',
      hero: {
        eyebrow: 'BREATHE', title: 'A Moment\nof Stillness.',
        subtext: 'A linkable library of guided sessions — breathing, sleep, focus, and grounding, all in one place.',
        ctaLabel: 'BROWSE LIBRARY', photo: '', photoColor: '', mediaType: 'image'
      }
    });

    Widgets.add({
      tabId: mainTab.id, column: 0, order: 0, type: 'note', title: 'How To Use This Board',
      data: { body: 'Check off a ritual whenever you have a spare hour — or drag in something better. Every card here is editable, reorderable, and yours to reshape.' }
    });
    Widgets.add({
      tabId: mainTab.id, column: 0, order: 1, type: 'infocard', title: 'Bonus',
      data: { icon: '🎁', title: 'BONUS', subtitle: 'Pair this with a weekly self-care planner for the ones that need more than a checkbox.' }
    });

    Widgets.add({
      tabId: mainTab.id, column: 1, order: 0, type: 'checklist', title: 'Self-Care Checklist',
      data: {
        items: [
          { id: uid('it'), text: '✏️ Journal about your plans for the season', done: false },
          { id: uid('it'), text: '🍳 Take a cooking class', done: false },
          { id: uid('it'), text: '🌌 Find the constellations out tonight and gaze at them', done: false },
          { id: uid('it'), text: '🕯️ Light a candle that smells like the season', done: false },
          { id: uid('it'), text: '🌷 Plant something', done: false },
          { id: uid('it'), text: '👗 Do a closet audit', done: false },
          { id: uid('it'), text: '🎬 Watch a themed movie night', done: false },
          { id: uid('it'), text: '🖼️ Build a vision board', done: false },
          { id: uid('it'), text: '🖐️ Try a 5-senses mindfulness reset', done: false },
          { id: uid('it'), text: '🚲 Go for a hike or a bike ride', done: false },
          { id: uid('it'), text: '🎨 Try mindful coloring', done: false },
          { id: uid('it'), text: '📚 Read by candlelight or a fire', done: false },
          { id: uid('it'), text: '🎵 Make a playlist for the season', done: false },
          { id: uid('it'), text: '🍪 Bake something', done: false },
          { id: uid('it'), text: '🧺 Have a picnic', done: false },
          { id: uid('it'), text: '☕ Make a slow, good drink at home', done: false }
        ]
      }
    });

    Widgets.add({
      tabId: mainTab.id, column: 2, order: 0, type: 'photos', title: 'Cozy Inspiration',
      data: { wide: true, slots: [] }
    });

    JournalEntries.add({ topic: 'gratitude', title: 'Small things', body: 'Grateful for a slow morning coffee and no meetings before 10am.', date: todayISO(), tags: ['morning'] });
    JournalEntries.add({ topic: 'daily_reflection', title: 'Reset day', body: 'Felt scattered most of the day — noticing I skipped lunch again.', date: addDaysISO(todayISO(), -1), tags: ['work'] });
    JournalEntries.add({ topic: 'emotional_processing', title: 'Naming it', body: 'The knot in my chest before the call was anticipatory anxiety, not dread — helped to name it.', date: addDaysISO(todayISO(), -3), mood: 'anxious', tags: [] });

    Meditations.add({ title: '10-Minute Body Scan', description: 'A gentle full-body scan for releasing tension.', url: 'https://example.com/meditations/body-scan-10', type: 'body_scan', durationMin: 10, tags: ['relaxation'], isFavorite: true, notes: '' });
    Meditations.add({ title: 'Box Breathing for Focus', description: '4-4-4-4 breathing to reset before deep work.', url: 'https://example.com/meditations/box-breathing', type: 'breathing', durationMin: 5, tags: ['work', 'quick'], isFavorite: false, notes: '' });
    Meditations.add({ title: 'Wind Down for Sleep', description: 'A slow, guided descent into sleep.', url: 'https://example.com/meditations/sleep-wind-down', type: 'sleep', durationMin: 20, tags: ['night'], isFavorite: false, notes: '' });

    storeSet(KEYS.seeded, true);
    return { mainTab: mainTab, journalsTab: journalsTab, meditationsTab: meditationsTab };
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Tabs.list().length || Widgets.list().length || JournalEntries.list().length || Meditations.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }
    seedDefaultBoard();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // seed-race hazard dreamboard-data.js/business-data.js's own changelog
  // entries document: seeding synchronously, before initCloudSync()'s
  // cloud pull has a real chance to land, can push a freshly-seeded
  // "default" board to Supabase and clobber another device's real data.
  // selfcare.html calls seedIfEmpty() itself, only as a fallback after
  // giving the cloud pull a real window first. normalizeTabs() stays
  // automatic — it only backfills fields on records that already exist,
  // so it's a no-op on empty storage and can't clobber anything.
  normalizeTabs();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.SelfCareData = {
    KEYS: KEYS,
    JOURNAL_TOPICS: JOURNAL_TOPICS,
    MEDITATION_TYPES: MEDITATION_TYPES,
    WIDGET_TYPES: WIDGET_TYPES,
    uid: uid,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: {
      journalEntry: journalEntryModel,
      meditation: meditationModel,
      tab: tabModel,
      widget: widgetModel
    },
    defaultWidgetData: defaultWidgetData,
    JournalEntries: JournalEntries,
    Meditations: Meditations,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    tabsSorted: tabsSorted,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    entriesByTopic: entriesByTopic,
    seedDefaultBoard: seedDefaultBoard,
    seedIfEmpty: seedIfEmpty,
    normalizeTabs: normalizeTabs
  };
})(window);
