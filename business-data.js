// business-data.js
//
// Shared data foundation for business.html ("Business Hub" — a content-
// planning workspace styled after a Notion "Content Hub" template). Same
// conventions as dreamboard-data.js/household-data.js/finance-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under a `business:` prefix so
// business.html's initCloudSync({ syncedPrefixes: ['business:'] }) call
// covers every collection with no per-key list.
//
// The board engine (Tabs + Widgets, 3-column drag-and-drop layout, per-
// widget color-grading tint) is deliberately the same shape as
// dreamboard-data.js's — same flat-array-with-foreign-key convention,
// same makeCollection CRUD, same reorderTab bulk-write-on-drag pattern —
// per an explicit request to reuse Dream Board's design/features. On top
// of Dream Board's original widget types, this file adds five tailored to
// a content-planning workspace: platform, contentcard, resource, summary,
// schedule (see WIDGET_TYPES below).

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as dreamboard-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded from a
  // few full-size cover photos) used to vanish silently; this dispatches
  // a 'business:save' event either way so business.html can show a real
  // status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('business:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('business:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    tabs: 'business:tabs',
    widgets: 'business:widgets',
    profile: 'business:profile',
    seeded: 'business:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** ISO date `offsetDays` from today — used only by seed data, so the
   * default board's "Due yesterday" / "2 Days Remaining" style due-labels
   * (computed live by computeDueLabel()) always read correctly relative to
   * whenever the page is actually first opened, instead of drifting into
   * absurd "900+ days ago" once a fixed calendar date is far enough in
   * the past. */
  function shiftedISO(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app (see
  // dreamboard-data.js's copy of the same two functions).
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
  // MODELS
  // ============================================================

  // Existing Dream Board widget types, reused verbatim (same field shapes,
  // same defaults) per the explicit request to keep them available here
  // too, plus five new ones tailored to a content-planning workspace.
  const WIDGET_TYPES = [
    'checklist', 'list', 'note', 'quote', 'affirmation', 'steps', 'photos', 'calendar', 'feature', 'infocard',
    'platform', 'contentcard', 'resource', 'summary', 'schedule'
  ];

  const CONTENT_STATUSES = [
    { key: 'not-started', label: 'Not started' },
    { key: 'ready', label: 'Ready to post' },
    { key: 'writing-caption', label: 'Writing Caption' },
    { key: 'published', label: 'Published!' }
  ];
  const RESOURCE_STATUSES = ['Active', 'Idle', 'Archived'];
  const SCHEDULE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '📄',
      order: typeof data.order === 'number' ? data.order : 0
    };
  }

  function profileModel(data) {
    data = data || {};
    return {
      name: typeof data.name === 'string' ? data.name : 'Business Hub',
      tagline: typeof data.tagline === 'string' ? data.tagline : 'Plan strategy, manage content, and grow your business — all in one place.',
      bannerPhoto: typeof data.bannerPhoto === 'string' ? data.bannerPhoto : '',
      avatarPhoto: typeof data.avatarPhoto === 'string' ? data.avatarPhoto : ''
    };
  }
  function getProfile() { return profileModel(storeGet(KEYS.profile)); }
  function saveProfile(patch) {
    const next = profileModel(Object.assign({}, getProfile(), patch));
    storeSet(KEYS.profile, next);
    return next;
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
      // ---- tailored, new to this page ----
      // Platform name is the widget's own title (edited via the card's
      // shared title-row control, same as every other widget type) —
      // deliberately no separate `name` field here, so there's only ever
      // one source of truth for "which platform is this."
      case 'platform': return { active: true, cover: '' };
      case 'contentcard': return { title: '', cover: '', platform: '', status: 'not-started', tags: [], scheduledDate: '', scheduledTime: '', checklist: [] };
      case 'resource': return { icon: '📁', title: '', description: '', status: 'Active' };
      case 'summary': return {};
      case 'schedule': return { rows: [] };
      default: return {};
    }
  }

  /** @typedef {{id:string, tabId:string, column:number, order:number, type:string, title:string, accent:string, tint:?string, data:Object}} BizWidget */
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
      // Per-widget glass color grading — same '#rrggbb' | null shape as
      // dreamboard-data.js's widgetModel (no 'photo' resolver here, since
      // this page has no per-tab hero photo to match against; a plain
      // hex or null is all this page ever writes/reads).
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // dreamboard-data.js/household-data.js/finance-data.js.
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
  /** Bulk-persist a tab's full column layout after a drag-reorder — one
   * write, not one per widget, same as dreamboard-data.js's reorderTab. */
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

  function contentCardsForTab(tabId) {
    return Widgets.list().filter(function (w) { return w.tabId === tabId && w.type === 'contentcard'; });
  }
  function platformsForTab(tabId) {
    return Widgets.list().filter(function (w) { return w.tabId === tabId && w.type === 'platform'; });
  }

  function statusLabel(key) {
    const s = CONTENT_STATUSES.find(function (x) { return x.key === key; });
    return s ? s.label : 'Not started';
  }

  /** "Published!" once posted, else a relative-to-today due phrase computed
   * from the scheduled date — a real derived field, not stored text, so it
   * never goes stale relative to `scheduledDate`. */
  function computeDueLabel(status, scheduledDate) {
    if (status === 'published') return 'Published!';
    if (!scheduledDate) return 'No date set';
    const today = new Date(todayISO() + 'T00:00:00');
    const target = new Date(scheduledDate + 'T00:00:00');
    const diffDays = Math.round((target - today) / 86400000);
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    if (diffDays > 1) return diffDays + ' Days Remaining';
    if (diffDays === -1) return 'Due yesterday';
    return 'Due ' + Math.abs(diffDays) + ' days ago';
  }

  // ============================================================
  // SEED — a modest, self-consistent default board so the page never opens
  // empty. The "Content" tab loosely mirrors the reference Content Hub
  // screenshot (platform toggle cards, a content-plan grid, a resources
  // grid, plus a content summary / posting schedule / gallery grouped into
  // the third column to stand in for the reference's right-hand sidebar);
  // the other six tabs get a modest thematic starter board each, same
  // "not copied verbatim from any one reference" precedent as
  // dreamboard-data.js's seedDefaultBoard().
  // ============================================================
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);

    const contentTab = Tabs.add({ title: 'Content', icon: '📋', order: 0 });
    const ideasTab = Tabs.add({ title: 'Ideas', icon: '💡', order: 1 });
    const platformTab = Tabs.add({ title: 'Platform', icon: '⚙️', order: 2 });
    const strategyTab = Tabs.add({ title: 'Strategy', icon: '🎯', order: 3 });
    const resourcesTab = Tabs.add({ title: 'Resources', icon: '📚', order: 4 });
    const analyticsTab = Tabs.add({ title: 'Analytics', icon: '📊', order: 5 });
    const auditTab = Tabs.add({ title: 'Audit', icon: '🔍', order: 6 });

    // ---------- Content ----------
    let o0 = 0, o1 = 0, o2 = 0;
    Widgets.add({ tabId: contentTab.id, column: 0, order: o0++, type: 'platform', title: 'Instagram', data: { active: true, cover: '' } });
    Widgets.add({ tabId: contentTab.id, column: 1, order: o1++, type: 'platform', title: 'Tiktok', data: { active: true, cover: '' } });
    Widgets.add({ tabId: contentTab.id, column: 2, order: o2++, type: 'platform', title: 'Youtube', data: { active: true, cover: '' } });

    Widgets.add({
      tabId: contentTab.id, column: 0, order: o0++, type: 'contentcard', title: 'Share Relatable Business Stories',
      data: { title: 'Share Relatable Business Stories', cover: '', platform: 'Tiktok', status: 'published', tags: ['Self Growth', 'Video'], scheduledDate: shiftedISO(-6), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: true }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: o0++, type: 'contentcard', title: 'How to Increase Website Traffic',
      data: { title: 'How to Increase Website Traffic', cover: '', platform: 'Pinterest', status: 'ready', tags: ['Digital Marketing', 'Pin'], scheduledDate: todayISO(), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 1, order: o1++, type: 'contentcard', title: '3 Time-Saving Marketing Tips for Small Business',
      data: { title: '3 Time-Saving Marketing Tips for Small Business', cover: '', platform: 'Pinterest', status: 'published', tags: ['Digital Marketing', 'Pin'], scheduledDate: shiftedISO(-5), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: true }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 1, order: o1++, type: 'contentcard', title: 'Celebrating 30K Followers',
      data: { title: 'Celebrating 30K Followers', cover: '', platform: 'Facebook', status: 'ready', tags: ['Others', 'Post'], scheduledDate: shiftedISO(2), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 2, order: o2++, type: 'contentcard', title: 'A Better Way to Advertise on Instagram',
      data: { title: 'A Better Way to Advertise on Instagram', cover: '', platform: 'Youtube', status: 'writing-caption', tags: ['Digital Marketing', 'Shorts'], scheduledDate: shiftedISO(-1), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 2, order: o2++, type: 'contentcard', title: 'Plan Your Content in 30 Minutes',
      data: { title: 'Plan Your Content in 30 Minutes', cover: '', platform: 'Twitter', status: 'not-started', tags: ['Productivity', 'Tweet'], scheduledDate: shiftedISO(7), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: false }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });

    const resourceDefs = [
      { icon: '🎨', title: 'Design resources', description: 'Design templates, icons, fonts, filters, etc. for the visuals of your content', col: 0 },
      { icon: '🪝', title: 'Hook', description: 'Create a collection for your inspiration and for future reference', col: 0 },
      { icon: '🎬', title: 'Video footage', description: 'Prepare the video footage for your social media posts', col: 0 },
      { icon: '🛠', title: 'Tools', description: 'Add your favorite social media tools and subscription', col: 0 },
      { icon: '#️⃣', title: 'Hashtag', description: 'Create a list of your most used hashtags that you can copy and paste', col: 1 },
      { icon: '💡', title: 'Inspiration', description: 'Create a collection for your inspiration and for future reference', col: 1 },
      { icon: '📝', title: 'Notes', description: 'Save any notes or article you find interesting and important', col: 1 },
      { icon: '🔗', title: 'Important link', description: 'Save bookmarks that are relevant to your social media accounts', col: 2 },
      { icon: '🎧', title: 'Audio', description: 'Keep up with the trends and save trending audio', col: 2 },
      { icon: '📐', title: 'Size Guide', description: 'The optimal image sizes for various platforms', col: 2 }
    ];
    const colOrder = [o0, o1, o2];
    resourceDefs.forEach(function (r) {
      Widgets.add({ tabId: contentTab.id, column: r.col, order: colOrder[r.col]++, type: 'resource', title: r.title, data: { icon: r.icon, title: r.title, description: r.description, status: 'Active' } });
    });
    o0 = colOrder[0]; o1 = colOrder[1]; o2 = colOrder[2];

    Widgets.add({ tabId: contentTab.id, column: 2, order: o2++, type: 'summary', title: 'Content Overview', data: {} });
    Widgets.add({
      tabId: contentTab.id, column: 2, order: o2++, type: 'schedule', title: 'Posting Schedule',
      data: {
        rows: [
          { id: uid('sr'), platform: 'Instagram', day: 'Monday', time: '15:00' },
          { id: uid('sr'), platform: 'Instagram', day: 'Tuesday', time: '09:00' },
          { id: uid('sr'), platform: 'Instagram', day: 'Saturday', time: '20:00' },
          { id: uid('sr'), platform: 'Instagram', day: 'Sunday', time: '10:00' },
          { id: uid('sr'), platform: 'Tiktok', day: 'Wednesday', time: '17:00' },
          { id: uid('sr'), platform: 'Tiktok', day: 'Thursday', time: '19:00' },
          { id: uid('sr'), platform: 'Youtube', day: 'Monday', time: '14:00' }
        ]
      }
    });
    Widgets.add({ tabId: contentTab.id, column: 2, order: o2++, type: 'photos', title: 'Gallery', data: { wide: false, slots: [] } });

    // ---------- Ideas ----------
    Widgets.add({
      tabId: ideasTab.id, column: 0, order: 0, type: 'list', title: 'Content Ideas',
      data: { items: [{ id: uid('it'), text: 'Behind-the-scenes of a typical workday' }, { id: uid('it'), text: 'Customer testimonial round-up' }, { id: uid('it'), text: 'Myth vs. fact post for our industry' }] }
    });
    Widgets.add({
      tabId: ideasTab.id, column: 1, order: 0, type: 'note', title: 'Brain Dump',
      data: { body: 'Loose ideas that don\'t have a home yet — revisit during the next content planning session.' }
    });
    Widgets.add({
      tabId: ideasTab.id, column: 2, order: 0, type: 'infocard', title: 'Idea Bank', data: { icon: '💡', title: 'IDEA BANK', subtitle: 'Capture it now, refine it later.' }
    });

    // ---------- Platform ----------
    Widgets.add({ tabId: platformTab.id, column: 0, order: 0, type: 'platform', title: 'Instagram', data: { active: true, cover: '' } });
    Widgets.add({ tabId: platformTab.id, column: 1, order: 0, type: 'platform', title: 'Tiktok', data: { active: true, cover: '' } });
    Widgets.add({ tabId: platformTab.id, column: 2, order: 0, type: 'platform', title: 'Youtube', data: { active: true, cover: '' } });
    Widgets.add({ tabId: platformTab.id, column: 0, order: 1, type: 'platform', title: 'Pinterest', data: { active: false, cover: '' } });
    Widgets.add({ tabId: platformTab.id, column: 1, order: 1, type: 'platform', title: 'Facebook', data: { active: false, cover: '' } });
    Widgets.add({ tabId: platformTab.id, column: 2, order: 1, type: 'platform', title: 'Twitter', data: { active: false, cover: '' } });

    // ---------- Strategy ----------
    Widgets.add({
      tabId: strategyTab.id, column: 0, order: 0, type: 'checklist', title: 'This Quarter', accent: 'blush',
      data: { items: [{ id: uid('it'), text: 'Define target audience personas', done: false }, { id: uid('it'), text: 'Audit competitor content', done: false }] }
    });
    Widgets.add({
      tabId: strategyTab.id, column: 1, order: 0, type: 'quote', title: 'North Star',
      data: { text: 'Content is fire, social media is gasoline.', author: 'Jay Baer' }
    });
    Widgets.add({
      tabId: strategyTab.id, column: 2, order: 0, type: 'note', title: 'Brand Voice',
      data: { body: 'Warm, direct, a little playful. Speak like a knowledgeable friend, never a corporate press release.' }
    });

    // ---------- Resources ----------
    Widgets.add({ tabId: resourcesTab.id, column: 0, order: 0, type: 'resource', title: 'Brand Kit', data: { icon: '🎨', title: 'Brand Kit', description: 'Logos, colors, and fonts for every platform', status: 'Active' } });
    Widgets.add({ tabId: resourcesTab.id, column: 1, order: 0, type: 'resource', title: 'Templates', data: { icon: '🧩', title: 'Templates', description: 'Reusable post and story templates', status: 'Active' } });
    Widgets.add({ tabId: resourcesTab.id, column: 2, order: 0, type: 'resource', title: 'Contracts', data: { icon: '📄', title: 'Contracts', description: 'Vendor and collaborator agreements', status: 'Idle' } });

    // ---------- Analytics ----------
    Widgets.add({ tabId: analyticsTab.id, column: 0, order: 0, type: 'summary', title: 'Content Overview', data: {} });
    Widgets.add({ tabId: analyticsTab.id, column: 1, order: 0, type: 'checklist', title: 'Monthly Review', data: { items: [{ id: uid('it'), text: 'Export last month\'s top posts', done: false }] } });
    Widgets.add({ tabId: analyticsTab.id, column: 2, order: 0, type: 'infocard', title: 'Stay Data-Driven', data: { icon: '📊', title: 'STAY DATA-DRIVEN', subtitle: 'Decide with numbers, not vibes.' } });

    // ---------- Audit ----------
    Widgets.add({
      tabId: auditTab.id, column: 0, order: 0, type: 'checklist', title: 'Quarterly Audit',
      data: { items: [{ id: uid('it'), text: 'Review bio links on every platform', done: false }, { id: uid('it'), text: 'Check for broken links in old posts', done: false }] }
    });
    Widgets.add({ tabId: auditTab.id, column: 1, order: 0, type: 'note', title: 'Findings', data: { body: '' } });
    Widgets.add({ tabId: auditTab.id, column: 2, order: 0, type: 'infocard', title: 'Housekeeping', data: { icon: '🔍', title: 'HOUSEKEEPING', subtitle: 'A clean profile builds trust.' } });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Tabs.list().length || Widgets.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultBoard();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as dreamboard-data.js (see that
  // file's own comment and dreamboard.html's changelog entries on the
  // subject): seeding synchronously at script-load time, before
  // initCloudSync() gets a chance to pull real cloud data, can push a
  // freshly-seeded "default" board to Supabase and clobber another
  // device's real data. business.html's init() calls seedIfEmpty() itself,
  // only as a fallback after giving the cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.BusinessData = {
    KEYS: KEYS,
    WIDGET_TYPES: WIDGET_TYPES,
    CONTENT_STATUSES: CONTENT_STATUSES,
    RESOURCE_STATUSES: RESOURCE_STATUSES,
    SCHEDULE_DAYS: SCHEDULE_DAYS,
    uid: uid,
    todayISO: todayISO,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: { tab: tabModel, widget: widgetModel, profile: profileModel },
    defaultWidgetData: defaultWidgetData,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    getProfile: getProfile,
    saveProfile: saveProfile,
    tabsSorted: tabsSorted,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    contentCardsForTab: contentCardsForTab,
    platformsForTab: platformsForTab,
    statusLabel: statusLabel,
    computeDueLabel: computeDueLabel,
    seedDefaultBoard: seedDefaultBoard,
    seedIfEmpty: seedIfEmpty
  };
})(window);
