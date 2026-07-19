// business-data.js
//
// Shared data foundation for business.html ("Business Hub"). Same
// conventions as dreamboard-data.js/household-data.js/finance-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under a `business:` prefix so
// business.html's initCloudSync({ syncedPrefixes: ['business:'] }) call
// covers every collection with no per-key list.
//
// This page reuses Dream Board's exact board engine (Tabs + Widgets, a
// per-tab hero, a 3-column drag-and-drop layout, per-widget color-grading
// tint) verbatim for its two "board-mode" tabs (Analytics/Audit), per an
// explicit request that the whole page's aesthetic match Dream Board
// exactly. Five tabs (Content/Ideas/Platforms/Strategy/Resources) are
// "tasks-mode" instead — a per-tab Tasks list mirroring index.html's Main
// dashboard Tasks tab (view chips, filter/group/sort, quick-add, a
// checklist-style row, an Add/Edit modal, and a simple detail view with
// one freeform autosaving note) — plus, for the Platforms tab specifically,
// a roster of individual platforms, each with its own freeform autosaving
// notes field, opened by clicking into that platform.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as dreamboard-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'business:save' event either way
  // so business.html can show a real status instead of guessing.
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
    tasks: 'business:tasks',
    platforms: 'business:platforms',
    seeded: 'business:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** ISO date `offsetDays` from today — seed-data-only, so the default
   * board's due dates always read sensibly relative to whenever the page
   * is actually first opened, instead of drifting into "900+ days ago"
   * once a fixed calendar date is far enough in the past (a real bug
   * this page shipped with once already — see the changelog). */
  function shiftedISO(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app.
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

  // Dream Board's original ten widget types, reused verbatim (same field
  // shapes, same defaults) for this page's two board-mode tabs
  // (Analytics/Audit). The five content-planning types from this page's
  // first pass (platform/contentcard/resource/summary/schedule) are kept
  // too — still valid, still in the Add Widget menu for board-mode tabs —
  // even though the tabs they were originally seeded onto are now
  // tasks-mode instead (see the Tasks/Platforms systems below, which
  // supersede them for Content/Ideas/Platforms/Strategy/Resources).
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

  const TASK_STATUSES = [
    { key: 'todo', label: 'To do' },
    { key: 'in-progress', label: 'In progress' },
    { key: 'done', label: 'Done' }
  ];
  const TASK_PRIORITIES = [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' }
  ];
  const TASK_RECURRENCES = [
    { key: 'none', label: 'None' },
    { key: 'daily', label: 'Daily — regenerates the next day when completed' },
    { key: 'weekly', label: 'Weekly — regenerates 7 days later when completed' }
  ];

  // Per-tab "hero" — a full-bleed cover section, same shape/behavior as
  // dreamboard-data.js's heroModel (image cover only here — this page
  // doesn't port Dream Board's session-only video-hero feature, since
  // that's a secondary capability, not part of the core look).
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

  /** @typedef {{id:string, title:string, order:number, mode:'tasks'|'board', roster:?string, hero:Object}} BizTab */
  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      order: typeof data.order === 'number' ? data.order : 0,
      mode: data.mode === 'board' ? 'board' : 'tasks',
      // 'platforms' shows the Platforms roster above this tab's task list.
      // A dedicated field rather than matching on `title` so renaming the
      // tab (rename-in-place is fully supported, same as Dream Board's
      // tabs) can never silently drop the roster section.
      roster: data.roster === 'platforms' ? 'platforms' : null,
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
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  /** @typedef {{id:string, tabId:string, title:string, note:string, status:string, priority:string, dueDate:string, estimateMinutes:?number, isDailyAction:boolean, recurrence:string, done:boolean, doneAt:?number, createdAt:number}} BizTask */
  function taskModel(data) {
    data = data || {};
    const status = TASK_STATUSES.some(function (s) { return s.key === data.status; }) ? data.status : (data.done ? 'done' : 'todo');
    return {
      id: data.id || uid('task'),
      tabId: data.tabId || null,
      title: typeof data.title === 'string' ? data.title : '',
      note: typeof data.note === 'string' ? data.note : '',
      status: status,
      priority: TASK_PRIORITIES.some(function (p) { return p.key === data.priority; }) ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      estimateMinutes: (typeof data.estimateMinutes === 'number') ? data.estimateMinutes : null,
      isDailyAction: !!data.isDailyAction,
      recurrence: TASK_RECURRENCES.some(function (r) { return r.key === data.recurrence; }) ? data.recurrence : 'none',
      done: status === 'done',
      doneAt: (typeof data.doneAt === 'number') ? data.doneAt : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id:string, name:string, active:boolean, cover:string, notes:string, createdAt:number}} BizPlatform */
  function platformModel(data) {
    data = data || {};
    return {
      id: data.id || uid('plat'),
      name: typeof data.name === 'string' ? data.name : '',
      active: data.active !== false,
      cover: typeof data.cover === 'string' ? data.cover : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
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
  const Tasks = makeCollection(KEYS.tasks, taskModel);
  const Platforms = makeCollection(KEYS.platforms, platformModel);

  function removeTab(id) {
    Tabs.remove(id);
    Widgets.replaceAll(Widgets.list().filter(function (w) { return w.tabId !== id; }));
    Tasks.replaceAll(Tasks.list().filter(function (t) { return t.tabId !== id; }));
  }

  // ============================================================
  // SELECTORS — board (Dream Board engine, unchanged)
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
  // SELECTORS — Tasks (mirrors index.html Main dashboard's Tasks tab:
  // sortTasks()/groupBuckets() there, adapted to this page's simpler
  // dimension set — no Life Area/Goal/Business/Habit FKs exist here, so
  // grouping/filtering is just priority/status, same semantics otherwise)
  // ============================================================
  function tasksForTab(tabId) {
    return Tasks.list().filter(function (t) { return t.tabId === tabId; });
  }
  function sortTasks(list, mode) {
    const priRank = { high: 3, medium: 2, low: 1 };
    const copy = list.slice();
    copy.sort(function (a, b) {
      const ap = priRank[a.priority] || 2, bp = priRank[b.priority] || 2;
      const ad = a.dueDate || '9999-99-99', bd = b.dueDate || '9999-99-99';
      if (mode === 'priority') {
        if (bp !== ap) return bp - ap;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      }
      if (ad !== bd) return ad < bd ? -1 : 1;
      return bp - ap;
    });
    return copy;
  }
  const TASK_GROUP_DIMS = {
    priority: [{ key: 'high', label: 'High priority' }, { key: 'medium', label: 'Medium priority' }, { key: 'low', label: 'Low priority' }],
    status: [{ key: 'todo', label: 'To do' }, { key: 'in-progress', label: 'In progress' }, { key: 'done', label: 'Done' }]
  };
  function groupTasksBuckets(dim, tasks) {
    if (dim === 'none' || !TASK_GROUP_DIMS[dim]) return [{ key: null, label: null, tasks: tasks }];
    return TASK_GROUP_DIMS[dim]
      .map(function (b) { return { key: b.key, label: b.label, tasks: tasks.filter(function (t) { return t[dim] === b.key; }) }; })
      .filter(function (b) { return b.tasks.length; });
  }
  /** A follow-up task for a recurring task that was just marked done —
   * same +1 day (daily) / +7 days (weekly) precedent as index.html's
   * spawnNextRecurrence(), copying the fields that make sense to repeat
   * and resetting to a fresh todo/not-done state. */
  function spawnNextRecurrence(task) {
    if (!task.recurrence || task.recurrence === 'none') return null;
    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (task.recurrence === 'weekly' ? 7 : 1));
    const nextDue = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
    return Tasks.add({
      tabId: task.tabId, title: task.title, note: task.note, priority: task.priority,
      dueDate: nextDue, estimateMinutes: task.estimateMinutes, isDailyAction: task.isDailyAction,
      recurrence: task.recurrence, status: 'todo'
    });
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);
    Tasks.replaceAll([]);
    Platforms.replaceAll([]);

    const contentTab = Tabs.add({
      title: 'Content', order: 0, mode: 'tasks',
      hero: heroModel({ eyebrow: 'CONTENT PLANNING', title: 'Say It.\nShip It.', subtext: 'Every post starts here — plan it, track it, ship it.', ctaLabel: 'VIEW TASKS' })
    });
    const ideasTab = Tabs.add({
      title: 'Ideas', order: 1, mode: 'tasks',
      hero: heroModel({ eyebrow: 'THE IDEA BANK', title: 'Capture It Now.\nRefine It Later.', subtext: 'Loose ideas, hooks, and things worth revisiting.', ctaLabel: 'VIEW IDEAS' })
    });
    const platformsTab = Tabs.add({
      title: 'Platforms', order: 2, mode: 'tasks', roster: 'platforms',
      hero: heroModel({ eyebrow: 'WHERE WE SHOW UP', title: 'Every Platform.\nOne Home.', subtext: 'Track platform-specific work, and keep notes on each one.', ctaLabel: 'VIEW PLATFORMS' })
    });
    const strategyTab = Tabs.add({
      title: 'Strategy', order: 3, mode: 'tasks',
      hero: heroModel({ eyebrow: 'THE BIG PICTURE', title: 'Plan Deliberately.\nGrow on Purpose.', subtext: 'The direction behind the day-to-day.', ctaLabel: 'VIEW STRATEGY' })
    });
    const resourcesTab = Tabs.add({
      title: 'Resources', order: 4, mode: 'tasks',
      hero: heroModel({ eyebrow: 'THE TOOLKIT', title: 'Everything.\nIn One Place.', subtext: 'Brand assets, templates, and reference material.', ctaLabel: 'VIEW RESOURCES' })
    });
    const analyticsTab = Tabs.add({
      title: 'Analytics', order: 5, mode: 'board',
      hero: heroModel({ eyebrow: 'STAY DATA-DRIVEN', title: 'Decide With\nNumbers.', subtext: 'Keep a pulse on what is actually working.', ctaLabel: 'VIEW BOARD' })
    });
    const auditTab = Tabs.add({
      title: 'Audit', order: 6, mode: 'board',
      hero: heroModel({ eyebrow: 'HOUSEKEEPING', title: 'Clean Profile.\nMore Trust.', subtext: 'The quarterly checkup that keeps everything tidy.', ctaLabel: 'VIEW BOARD' })
    });

    // ---------- Content tasks ----------
    Tasks.add({ tabId: contentTab.id, title: 'Share Relatable Business Stories', status: 'done', priority: 'medium', dueDate: shiftedISO(-6) });
    Tasks.add({ tabId: contentTab.id, title: '3 Time-Saving Marketing Tips for Small Business', status: 'done', priority: 'medium', dueDate: shiftedISO(-5) });
    Tasks.add({ tabId: contentTab.id, title: 'How to Increase Website Traffic', status: 'in-progress', priority: 'high', dueDate: todayISO() });
    Tasks.add({ tabId: contentTab.id, title: 'A Better Way to Advertise on Instagram', status: 'in-progress', priority: 'high', dueDate: shiftedISO(-1) });
    Tasks.add({ tabId: contentTab.id, title: 'Celebrating 30K Followers', status: 'todo', priority: 'medium', dueDate: shiftedISO(2) });
    Tasks.add({ tabId: contentTab.id, title: 'Plan Your Content in 30 Minutes', status: 'todo', priority: 'low', dueDate: shiftedISO(7) });

    // ---------- Ideas tasks ----------
    Tasks.add({ tabId: ideasTab.id, title: 'Behind-the-scenes of a typical workday', status: 'todo', priority: 'low' });
    Tasks.add({ tabId: ideasTab.id, title: 'Customer testimonial round-up', status: 'todo', priority: 'medium' });
    Tasks.add({ tabId: ideasTab.id, title: 'Myth vs. fact post for our industry', status: 'todo', priority: 'low' });

    // ---------- Platforms tasks + roster ----------
    Tasks.add({ tabId: platformsTab.id, title: 'Audit Instagram bio link', status: 'todo', priority: 'medium', dueDate: shiftedISO(3) });
    Tasks.add({ tabId: platformsTab.id, title: 'Repurpose top TikTok into a Reel', status: 'todo', priority: 'low' });
    Platforms.add({ name: 'Instagram', active: true, notes: 'Posting Mon/Wed/Fri mornings — engagement is highest 8–10am.' });
    Platforms.add({ name: 'Tiktok', active: true, notes: '' });
    Platforms.add({ name: 'Youtube', active: true, notes: '' });
    Platforms.add({ name: 'Pinterest', active: false, notes: '' });
    Platforms.add({ name: 'Facebook', active: false, notes: '' });
    Platforms.add({ name: 'Twitter', active: false, notes: '' });

    // ---------- Strategy tasks ----------
    Tasks.add({ tabId: strategyTab.id, title: 'Define target audience personas', status: 'todo', priority: 'high' });
    Tasks.add({ tabId: strategyTab.id, title: 'Audit competitor content', status: 'todo', priority: 'medium' });

    // ---------- Resources tasks ----------
    Tasks.add({ tabId: resourcesTab.id, title: 'Refresh brand kit colors', status: 'todo', priority: 'medium' });
    Tasks.add({ tabId: resourcesTab.id, title: 'Build a reusable story template', status: 'todo', priority: 'low' });

    // ---------- Analytics (board-mode) ----------
    Widgets.add({ tabId: analyticsTab.id, column: 0, order: 0, type: 'summary', title: 'Content Overview', data: {} });
    Widgets.add({ tabId: analyticsTab.id, column: 1, order: 0, type: 'checklist', title: 'Monthly Review', data: { items: [{ id: uid('it'), text: "Export last month's top posts", done: false }] } });
    Widgets.add({ tabId: analyticsTab.id, column: 2, order: 0, type: 'infocard', title: 'Stay Data-Driven', data: { icon: '📊', title: 'STAY DATA-DRIVEN', subtitle: 'Decide with numbers, not vibes.' } });

    // ---------- Audit (board-mode) ----------
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
    if (Tabs.list().length || Widgets.list().length || Tasks.list().length || Platforms.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultBoard();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as dreamboard-data.js: seeding
  // synchronously at script-load time, before initCloudSync() gets a
  // chance to pull real cloud data, can push a freshly-seeded "default"
  // board to Supabase and clobber another device's real data.
  // business.html's init() calls seedIfEmpty() itself, only as a fallback
  // after giving the cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.BusinessData = {
    KEYS: KEYS,
    WIDGET_TYPES: WIDGET_TYPES,
    CONTENT_STATUSES: CONTENT_STATUSES,
    RESOURCE_STATUSES: RESOURCE_STATUSES,
    SCHEDULE_DAYS: SCHEDULE_DAYS,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    TASK_RECURRENCES: TASK_RECURRENCES,
    uid: uid,
    todayISO: todayISO,
    formatDateShort: formatDateShort,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: { tab: tabModel, widget: widgetModel, task: taskModel, platform: platformModel },
    defaultWidgetData: defaultWidgetData,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    Tasks: Tasks,
    Platforms: Platforms,
    tabsSorted: tabsSorted,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    contentCardsForTab: contentCardsForTab,
    platformsForTab: platformsForTab,
    statusLabel: statusLabel,
    computeDueLabel: computeDueLabel,
    tasksForTab: tasksForTab,
    sortTasks: sortTasks,
    groupTasksBuckets: groupTasksBuckets,
    spawnNextRecurrence: spawnNextRecurrence,
    seedDefaultBoard: seedDefaultBoard,
    seedIfEmpty: seedIfEmpty
  };
})(window);
