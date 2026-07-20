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
    anxietyBreathwork: 'selfcare:anxietyBreathwork',
    anxietyTips: 'selfcare:anxietyTips',
    seeded: 'selfcare:seeded',
    anxietySeeded: 'selfcare:anxiety_seeded',
    anxietyMigrated: 'selfcare:anxiety_migrated'
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
  // ANXIETY — Breathwork (paced-breathing techniques, played through the
  // pacer in selfcare.html) and Tips & Techniques. Moved here verbatim
  // from the now-deleted standalone anxiety.html/anxiety-data.js, per an
  // explicit ask to fold the Anxiety page into its own tab inside
  // Self-Care instead of being a top-level nav pill. Field shapes/model
  // factories are unchanged from that page's own data layer — only the
  // storage keys moved, from a top-level `anxiety:` prefix to
  // `selfcare:anxietyBreathwork`/`selfcare:anxietyTips`, so both are
  // covered by selfcare.html's existing `syncedPrefixes: ['selfcare:']`
  // with no new sync wiring. The old `anxiety:*` keys are left alone in
  // localStorage/Supabase, orphaned but untouched — same treatment as
  // every other removed-page key elsewhere in this app — except that
  // migrateLegacyAnxietyPage() (below) copies any real content out of
  // them once, so a device that already used the standalone page doesn't
  // lose it.
  // ============================================================
  const BREATHWORK_GOALS = ['calm', 'focus', 'sleep', 'panic', 'other'];
  const BREATHWORK_GOAL_LABELS = { calm: 'Calm', focus: 'Focus', sleep: 'Sleep', panic: 'In the moment', other: 'Other' };

  function breathworkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('breath'),
      name: data.name || '',
      description: data.description || '',
      inhaleSec: Math.max(1, Math.round(Number(data.inhaleSec)) || 4),
      holdInSec: Math.max(0, Math.round(Number(data.holdInSec)) || 0),
      exhaleSec: Math.max(1, Math.round(Number(data.exhaleSec)) || 4),
      holdOutSec: Math.max(0, Math.round(Number(data.holdOutSec)) || 0),
      cycles: Math.max(1, Math.round(Number(data.cycles)) || 6),
      goal: BREATHWORK_GOALS.indexOf(data.goal) !== -1 ? data.goal : 'calm',
      isFavorite: !!data.isFavorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: data.createdAt || todayISO()
    };
  }

  const ANXIETY_TIP_CATEGORIES = ['grounding', 'cognitive', 'physical', 'social', 'other'];
  const ANXIETY_TIP_CATEGORY_LABELS = { grounding: 'Grounding', cognitive: 'Cognitive', physical: 'Physical', social: 'Social', other: 'Other' };

  function anxietyTipModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tip'),
      title: data.title || '',
      body: data.body || '',
      category: ANXIETY_TIP_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'other',
      isFavorite: !!data.isFavorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: data.createdAt || todayISO()
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
      panel: (data.panel === 'journals' || data.panel === 'meditations' || data.panel === 'anxiety') ? data.panel : '',
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
  const AnxietyBreathwork = makeCollection(KEYS.anxietyBreathwork, breathworkModel);
  const AnxietyTips = makeCollection(KEYS.anxietyTips, anxietyTipModel);
  const Tabs = makeCollection(KEYS.tabs, tabModel);
  const Widgets = makeCollection(KEYS.widgets, widgetModel);

  /** Backfills any tab missing `hero`/`panel` (e.g. a legacy record) so
   * every hero-reading function can assume `tab.hero` is always an object —
   * same precedent/rationale as dreamboard-data.js's normalizeTabs(), which
   * documents the exact crash this guards against. Runs once per load,
   * automatically, at the bottom of this file; a no-op on an already-
   * correct or empty board, so it can never clobber real data. */
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
  function anxietyBreathworkSorted() {
    return AnxietyBreathwork.list().slice().sort(function (a, b) { return a.order - b.order || (a.createdAt || '').localeCompare(b.createdAt || ''); });
  }
  function anxietyTipsSorted() {
    return AnxietyTips.list().slice().sort(function (a, b) { return a.order - b.order || (a.createdAt || '').localeCompare(b.createdAt || ''); });
  }

  // ============================================================
  // SEED — a modest default board for the main Self-Care tab (mirroring
  // the reference "Fall Self Care Bucket List" Notion template's
  // structure: an instructions note, a bonus callout, a checklist
  // database, and a photo gallery — deliberately not a pixel copy, same
  // "loosely mirror, don't copy verbatim" precedent as dreamboard-data.js's
  // own seedDefaultBoard()), plus a Journals tab and a Meditations tab
  // (both `panel`-mode, no widgets of their own) with their own hero.
  //
  // Split into two independent pieces on purpose, after a real bug: the
  // first version of this rebuild bundled "create the Tabs/Widgets board"
  // and "add sample journal/meditation content" into one seedIfEmpty()
  // check that bailed out entirely the moment ANY collection (including
  // JournalEntries/Meditations) already had data. For anyone who'd used
  // this page before this rebuild — real journal entries or meditations
  // already on their device/in Supabase, but no Tabs/Widgets at all,
  // since those never existed until now — that meant Tabs were never
  // created, ever: the tab bar rendered with zero buttons and nothing
  // else could show, which read as "nothing shows up when I click the
  // tab" (there was nothing to click). buildDefaultTabsAndWidgets()/
  // ensureTabsExist() below fix the structural piece (create the Tabs a
  // pre-existing user is missing) completely independently of whether
  // real journal/meditation content already exists — the same "backfill
  // a newly-required field/structure that older records never had"
  // precedent this app's other pages have hit before (Dream Board's
  // missing-hero crash, Business Hub's missing-layout/hasTemplates bug).
  // ============================================================
  function buildDefaultTabsAndWidgets() {
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

    ensureAnxietyTabExists();

    return { mainTab: mainTab, journalsTab: journalsTab, meditationsTab: meditationsTab };
  }

  function buildAnxietyTabHero() {
    return {
      eyebrow: 'IN THE MOMENT',
      title: 'Breathe.\nGround. Return.',
      subtext: 'A breathing pacer and a library of grounding techniques for when anxiety spikes.',
      ctaLabel: 'START BREATHING', photo: '', photoColor: '', mediaType: 'image'
    };
  }

  /** Structural repair for the Anxiety tab specifically, independent of
   * ensureTabsExist() below: creates the tab (`panel: 'anxiety'`) if and
   * only if no tab with that panel exists yet, appended after whatever
   * tabs already exist. Written as its own function (not just inlined
   * into buildDefaultTabsAndWidgets()) so it also repairs anyone who
   * already has the Self-Care/Journals/Meditations tabs from before
   * Anxiety moved into this page — otherwise ensureTabsExist()'s own
   * "only act if Tabs.list().length === 0" guard would skip them forever,
   * the exact bug the Tabs board itself hit once already (see the
   * changelog entry above this one). Never reads or writes
   * AnxietyBreathwork/AnxietyTips. Returns true if it created the tab. */
  function ensureAnxietyTabExists() {
    const tabs = Tabs.list();
    if (tabs.some(function (t) { return t.panel === 'anxiety'; })) return false;
    const maxOrder = tabs.reduce(function (m, t) { return Math.max(m, typeof t.order === 'number' ? t.order : 0); }, -1);
    Tabs.add({ title: 'Anxiety', order: maxOrder + 1, panel: 'anxiety', hero: buildAnxietyTabHero() });
    return true;
  }

  /** Structural repair only: creates the Tabs (+ default Widgets on the
   * main tab, + the Anxiety tab) if — and only if — none exist yet, and
   * separately repairs a missing Anxiety tab even when the others already
   * exist. Never reads or writes JournalEntries/Meditations/
   * AnxietyBreathwork/AnxietyTips, so it's always safe to call, on every
   * load, for both a genuinely fresh install and an existing user who
   * simply never had Tabs (or the Anxiety tab specifically) before.
   * Returns true if it created anything. */
  function ensureTabsExist() {
    let created = false;
    if (Tabs.list().length === 0) { buildDefaultTabsAndWidgets(); created = true; }
    if (ensureAnxietyTabExists()) created = true;
    return created;
  }

  /** Adds a small starter set of journal entries/meditations — but only
   * for a genuinely fresh install (nothing in EITHER collection yet).
   * Guarded by KEYS.seeded so it only ever runs once; deliberately does
   * NOT check Tabs/Widgets (those are handled separately by
   * ensureTabsExist() and would otherwise make this permanently skip an
   * existing user who has real content but is only missing Tabs — the
   * exact bug this split fixes). Returns true if it added sample content. */
  function seedSampleContentIfFresh() {
    if (storeGet(KEYS.seeded)) return false;
    if (JournalEntries.list().length || Meditations.list().length) {
      storeSet(KEYS.seeded, true);
      return false;
    }

    JournalEntries.add({ topic: 'gratitude', title: 'Small things', body: 'Grateful for a slow morning coffee and no meetings before 10am.', date: todayISO(), tags: ['morning'] });
    JournalEntries.add({ topic: 'daily_reflection', title: 'Reset day', body: 'Felt scattered most of the day — noticing I skipped lunch again.', date: addDaysISO(todayISO(), -1), tags: ['work'] });
    JournalEntries.add({ topic: 'emotional_processing', title: 'Naming it', body: 'The knot in my chest before the call was anticipatory anxiety, not dread — helped to name it.', date: addDaysISO(todayISO(), -3), mood: 'anxious', tags: [] });

    Meditations.add({ title: '10-Minute Body Scan', description: 'A gentle full-body scan for releasing tension.', url: 'https://example.com/meditations/body-scan-10', type: 'body_scan', durationMin: 10, tags: ['relaxation'], isFavorite: true, notes: '' });
    Meditations.add({ title: 'Box Breathing for Focus', description: '4-4-4-4 breathing to reset before deep work.', url: 'https://example.com/meditations/box-breathing', type: 'breathing', durationMin: 5, tags: ['work', 'quick'], isFavorite: false, notes: '' });
    Meditations.add({ title: 'Wind Down for Sleep', description: 'A slow, guided descent into sleep.', url: 'https://example.com/meditations/sleep-wind-down', type: 'sleep', durationMin: 20, tags: ['night'], isFavorite: false, notes: '' });

    storeSet(KEYS.seeded, true);
    return true;
  }

  const ANXIETY_SEED_BREATHWORK = [
    { name: 'Box Breathing', description: 'Four equal phases — inhale, hold, exhale, hold — used by everyone from athletes to Navy SEALs to steady focus under pressure.', inhaleSec: 4, holdInSec: 4, exhaleSec: 4, holdOutSec: 4, cycles: 6, goal: 'focus', order: 0 },
    { name: '4-7-8 Breathing', description: "Dr. Andrew Weil's technique — a longer exhale than inhale shifts the body toward rest. Good before sleep or when winding down from a spike.", inhaleSec: 4, holdInSec: 7, exhaleSec: 8, holdOutSec: 0, cycles: 4, goal: 'sleep', order: 1 },
    { name: 'Coherent Breathing', description: 'A gentle, even 5-second in / 5-second out rhythm (about 6 breaths a minute) — a steady baseline for everyday calm, no holds to track.', inhaleSec: 5, holdInSec: 0, exhaleSec: 5, holdOutSec: 0, cycles: 8, goal: 'calm', order: 2 },
    { name: 'Extended Exhale', description: 'A short inhale and a long, slow exhale — the fastest way to nudge the nervous system down when anxiety spikes in the moment.', inhaleSec: 4, holdInSec: 0, exhaleSec: 8, holdOutSec: 2, cycles: 6, goal: 'panic', order: 3 }
  ];
  const ANXIETY_SEED_TIPS = [
    { title: '5-4-3-2-1 Grounding', body: 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. Pulls attention out of a spiraling thought and back into the room.', category: 'grounding', order: 0 },
    { title: 'Cold water on your wrists or face', body: 'A quick burst of cold (splash your face, hold an ice cube, run cold water over your wrists) triggers the dive reflex and can blunt a panic spike within seconds.', category: 'physical', order: 1 },
    { title: 'Name the thought, don’t argue with it', body: 'Instead of "this is stupid, stop thinking it," try "I’m noticing an anxious thought about X." Labeling creates a little distance without fighting it.', category: 'cognitive', order: 2 },
    { title: 'Text one person', body: "You don't need a whole conversation. A single low-stakes message to someone you trust breaks the isolation a spiral thrives on.", category: 'social', order: 3 },
    { title: 'Progressive muscle relaxation', body: 'Tense each muscle group for 5 seconds, then release, working head to toe. The contrast makes it easier to actually feel your body relax.', category: 'physical', order: 4 },
    { title: 'Ask "what would I tell a friend?"', body: 'Anxious thoughts are often harsher than anything you’d say to someone else in the same spot. Borrowing that kinder voice is a real reframing tool, not just a platitude.', category: 'cognitive', order: 5 },
    { title: 'Put both feet flat on the floor', body: 'A small, physical anchor. Notice the actual pressure of the floor under your feet for a few breaths — it’s hard to fully spiral while paying attention to something this concrete.', category: 'grounding', order: 6 }
  ];

  /** Same "only for a genuinely fresh Anxiety section" caution as
   * seedSampleContentIfFresh(), but with its own independent flag/
   * emptiness check (KEYS.anxietySeeded, AnxietyBreathwork/AnxietyTips
   * only) — reusing KEYS.seeded here would repeat the exact bug fixed
   * above, since an existing user's `selfcare:seeded` flag was very
   * likely already set to true long before the Anxiety tab existed,
   * which would make this silently never run for them. Returns true if
   * it added sample content. */
  function seedAnxietyContentIfFresh() {
    if (storeGet(KEYS.anxietySeeded)) return false;
    if (AnxietyBreathwork.list().length || AnxietyTips.list().length) {
      storeSet(KEYS.anxietySeeded, true);
      return false;
    }
    ANXIETY_SEED_BREATHWORK.forEach(function (t) { AnxietyBreathwork.add(t); });
    ANXIETY_SEED_TIPS.forEach(function (t) { AnxietyTips.add(t); });
    storeSet(KEYS.anxietySeeded, true);
    return true;
  }

  /** One-time migration: a device that already used the standalone
   * anxiety.html page (before it moved into this Self-Care tab) has real
   * content sitting under the old top-level `anxiety:breathwork`/
   * `anxiety:tips` keys — copies it into the new
   * `selfcare:anxietyBreathwork`/`selfcare:anxietyTips` collections once,
   * so it isn't silently lost. Only copies in if the new collections are
   * still empty (never overwrites anything already here), and marks
   * KEYS.anxietySeeded true when it does, so seedAnxietyContentIfFresh()
   * doesn't also layer demo content on top of real migrated content. The
   * old `anxiety:*` keys are left in place afterward, orphaned but
   * untouched — same treatment as every other removed-page key elsewhere
   * in this app. Guarded by its own flag so it only ever runs once. */
  function migrateLegacyAnxietyPage() {
    if (storeGet(KEYS.anxietyMigrated)) return;
    storeSet(KEYS.anxietyMigrated, true);
    if (AnxietyBreathwork.list().length || AnxietyTips.list().length) return;
    let legacyBreathwork = null, legacyTips = null;
    try { legacyBreathwork = JSON.parse(localStorage.getItem('anxiety:breathwork') || 'null'); } catch (e) {}
    try { legacyTips = JSON.parse(localStorage.getItem('anxiety:tips') || 'null'); } catch (e) {}
    if (Array.isArray(legacyBreathwork) && legacyBreathwork.length) {
      AnxietyBreathwork.replaceAll(legacyBreathwork.map(breathworkModel));
      storeSet(KEYS.anxietySeeded, true);
    }
    if (Array.isArray(legacyTips) && legacyTips.length) {
      AnxietyTips.replaceAll(legacyTips.map(anxietyTipModel));
      storeSet(KEYS.anxietySeeded, true);
    }
  }

  /** Full reset (the "Reset to Default" button): wipes Tabs/Widgets and
   * rebuilds them, and always (re-)adds the sample journal/meditation/
   * breathwork/tips content regardless of the `seeded`/`anxietySeeded`
   * flags — a reset is an explicit, user-initiated "restore everything to
   * default," not a first-load heuristic, so it doesn't need
   * seedSampleContentIfFresh()'s/seedAnxietyContentIfFresh()'s
   * don't-clobber-real-content caution (selfcare.html's resetBoard()
   * already clears JournalEntries/Meditations/AnxietyBreathwork/
   * AnxietyTips itself right before calling this). */
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);
    buildDefaultTabsAndWidgets();

    JournalEntries.add({ topic: 'gratitude', title: 'Small things', body: 'Grateful for a slow morning coffee and no meetings before 10am.', date: todayISO(), tags: ['morning'] });
    JournalEntries.add({ topic: 'daily_reflection', title: 'Reset day', body: 'Felt scattered most of the day — noticing I skipped lunch again.', date: addDaysISO(todayISO(), -1), tags: ['work'] });
    JournalEntries.add({ topic: 'emotional_processing', title: 'Naming it', body: 'The knot in my chest before the call was anticipatory anxiety, not dread — helped to name it.', date: addDaysISO(todayISO(), -3), mood: 'anxious', tags: [] });

    Meditations.add({ title: '10-Minute Body Scan', description: 'A gentle full-body scan for releasing tension.', url: 'https://example.com/meditations/body-scan-10', type: 'body_scan', durationMin: 10, tags: ['relaxation'], isFavorite: true, notes: '' });
    Meditations.add({ title: 'Box Breathing for Focus', description: '4-4-4-4 breathing to reset before deep work.', url: 'https://example.com/meditations/box-breathing', type: 'breathing', durationMin: 5, tags: ['work', 'quick'], isFavorite: false, notes: '' });
    Meditations.add({ title: 'Wind Down for Sleep', description: 'A slow, guided descent into sleep.', url: 'https://example.com/meditations/sleep-wind-down', type: 'sleep', durationMin: 20, tags: ['night'], isFavorite: false, notes: '' });

    ANXIETY_SEED_BREATHWORK.forEach(function (t) { AnxietyBreathwork.add(t); });
    ANXIETY_SEED_TIPS.forEach(function (t) { AnxietyTips.add(t); });

    storeSet(KEYS.seeded, true);
    storeSet(KEYS.anxietySeeded, true);
  }

  // ensureTabsExist()/seedSampleContentIfFresh()/seedAnxietyContentIfFresh()
  // are deliberately NOT called automatically here — same seed-race
  // hazard dreamboard-data.js/business-data.js's own changelog entries
  // document: acting before initCloudSync()'s cloud pull has a real
  // chance to land can push freshly-created "default" data to Supabase
  // and clobber another device's real data. selfcare.html calls all
  // three itself — eagerly from initCloudSync's onApplied callback (the
  // moment we actually know what's real), and again from a timed fallback
  // in case sync is unavailable or never fires. normalizeTabs() and
  // migrateLegacyAnxietyPage() stay automatic — normalizeTabs() only
  // backfills fields on records that already exist, and
  // migrateLegacyAnxietyPage() only ever relocates a value that's already
  // sitting in this device's own local storage (never fabricates
  // anything), so neither is subject to the same cross-device race and
  // both are no-ops when there's nothing to do.
  normalizeTabs();
  migrateLegacyAnxietyPage();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.SelfCareData = {
    KEYS: KEYS,
    JOURNAL_TOPICS: JOURNAL_TOPICS,
    MEDITATION_TYPES: MEDITATION_TYPES,
    WIDGET_TYPES: WIDGET_TYPES,
    BREATHWORK_GOALS: BREATHWORK_GOALS,
    BREATHWORK_GOAL_LABELS: BREATHWORK_GOAL_LABELS,
    ANXIETY_TIP_CATEGORIES: ANXIETY_TIP_CATEGORIES,
    ANXIETY_TIP_CATEGORY_LABELS: ANXIETY_TIP_CATEGORY_LABELS,
    uid: uid,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: {
      journalEntry: journalEntryModel,
      meditation: meditationModel,
      breathwork: breathworkModel,
      anxietyTip: anxietyTipModel,
      tab: tabModel,
      widget: widgetModel
    },
    defaultWidgetData: defaultWidgetData,
    JournalEntries: JournalEntries,
    Meditations: Meditations,
    AnxietyBreathwork: AnxietyBreathwork,
    AnxietyTips: AnxietyTips,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    tabsSorted: tabsSorted,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    entriesByTopic: entriesByTopic,
    anxietyBreathworkSorted: anxietyBreathworkSorted,
    anxietyTipsSorted: anxietyTipsSorted,
    seedDefaultBoard: seedDefaultBoard,
    ensureTabsExist: ensureTabsExist,
    ensureAnxietyTabExists: ensureAnxietyTabExists,
    seedSampleContentIfFresh: seedSampleContentIfFresh,
    seedAnxietyContentIfFresh: seedAnxietyContentIfFresh,
    normalizeTabs: normalizeTabs
  };
})(window);
