// business-data.js
//
// Shared data foundation for business.html ("Business Hub"). Same
// conventions as dreamboard-data.js/household-data.js/finance-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under a `business:` prefix so
// business.html's initCloudSync({ syncedPrefixes: ['business:'] }) call
// covers every collection with no per-key list.
//
// Each tab has a `layout`:
//   - 'freeform' (Ideas / Resources) — Dream Board's exact board engine
//     (Tabs + Widgets, a 3-column drag-and-drop layout, per-widget
//     color-grading tint, an Add Widget menu). Resources additionally has
//     `hasTemplates: true`, which renders a Templates/Workflow (Weeks →
//     Days → Checklist) section below its board, the same mechanic as
//     index.html's Business Workflow feature, scoped to this tab.
//   - 'content' (Content) — a fixed, sectioned dashboard: a Platform
//     database, a Content Plan database, and a Useful Resources database
//     (each its own independent grid/filter — the two "databases" the
//     page is built around are never merged into one freeform board),
//     plus a sidebar (Content Summary, Posting Schedule, Gallery).
//   - 'platforms' (Platforms) — the same Platform database component used
//     standalone as its own page.
// Strategy/Analytics/Audit (from an earlier pass) are not part of this
// page anymore — see CLAUDE.md's changelog for that removal.
//
// Every Platform widget can carry its own freeform "notes" sections
// (`data.sections`), opened via a dedicated detail view in business.html —
// generated on demand (a button adds a blank one), fully editable, and
// reorderable (up/down, same convention as every other reorderable list in
// this app).

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
    workflowWeeks: 'business:workflowWeeks',
    workflowDays: 'business:workflowDays',
    workflowChecklist: 'business:workflowChecklist',
    tasks: 'business:tasks',
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
  // shapes, same defaults), plus five tailored to content planning
  // (platform/contentcard/resource/summary/schedule) and `link` (a title +
  // URL + description card, for the Resources tab's "links, notes, etc."
  // top section — usable on any freeform-layout tab like every other type).
  const WIDGET_TYPES = [
    'checklist', 'list', 'note', 'quote', 'affirmation', 'steps', 'photos', 'calendar', 'feature', 'infocard',
    'platform', 'contentcard', 'resource', 'summary', 'schedule', 'link'
  ];

  const CONTENT_STATUSES = [
    { key: 'not-started', label: 'Not started' },
    { key: 'ready', label: 'Ready to post' },
    { key: 'writing-caption', label: 'Writing Caption' },
    { key: 'published', label: 'Published!' }
  ];
  const RESOURCE_STATUSES = ['Active', 'Idle', 'Archived'];
  const SCHEDULE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WORKFLOW_DAY_STATUSES = ['Not started', 'In progress', 'Done', 'Blocked'];

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

  /** @typedef {{id:string, title:string, order:number, layout:'freeform'|'content'|'platforms', hasTemplates:boolean, hero:Object}} BizTab */
  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      order: typeof data.order === 'number' ? data.order : 0,
      layout: (data.layout === 'content' || data.layout === 'platforms') ? data.layout : 'freeform',
      // Renders a Templates/Workflow (Weeks → Days → Checklist) section
      // below this tab's board — a dedicated field rather than matching
      // on `title`, so renaming the tab (rename-in-place is fully
      // supported) can never silently drop the section. Only meaningful
      // for 'freeform' tabs.
      hasTemplates: !!data.hasTemplates,
      hero: heroModel(data.hero),
      // Which order/column (main vs. sidebar) this tab's six fixed
      // dashboard sections render in — array of {key, column}, only
      // meaningful for `layout: 'content'` tabs. `null` (the default)
      // means "use the standard order" — business.html falls back to it
      // whenever this is missing or doesn't cover exactly the known
      // section keys, so it degrades safely rather than crashing.
      sectionLayout: Array.isArray(data.sectionLayout) ? data.sectionLayout : null
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
      // `sections` — this platform's own generated, editable, reorderable
      // notes pages (see addPlatformSection() etc. below).
      case 'platform': return { active: true, cover: '', sections: [] };
      case 'contentcard': return { title: '', cover: '', platform: '', status: 'not-started', tags: [], scheduledDate: '', scheduledTime: '', checklist: [] };
      case 'resource': return { icon: '📁', title: '', description: '', status: 'Active' };
      case 'summary': return {};
      case 'schedule': return { rows: [] };
      case 'link': return { url: '', description: '' };
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
      // `column` is only meaningful for 'freeform' tabs (Dream Board's
      // 3-column board engine). 'content'/'platforms' tabs group widgets
      // by `type` into fixed sections and sort within a (tabId, type)
      // pair by `order` alone — see widgetsOfType()/reorderWidgetsOfType().
      column: typeof data.column === 'number' ? data.column : 0,
      order: typeof data.order === 'number' ? data.order : 0,
      type: type,
      title: typeof data.title === 'string' ? data.title : '',
      accent: data.accent === 'blush' ? 'blush' : 'default',
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  /** @typedef {{id:string, tabId:string, title:string, order:number, collapsed:boolean, createdAt:number}} WorkflowWeek */
  function workflowWeekModel(data) {
    data = data || {};
    return {
      id: data.id || uid('wfw'),
      tabId: data.tabId || null,
      title: typeof data.title === 'string' ? data.title : '',
      order: typeof data.order === 'number' ? data.order : 0,
      collapsed: !!data.collapsed,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** @typedef {{id:string, weekId:string, tabId:string, title:string, status:string, order:number, notes:string, blocks:Array, createdAt:number}} WorkflowDay */
  function workflowDayModel(data) {
    data = data || {};
    return {
      id: data.id || uid('wfd'),
      weekId: data.weekId || null,
      tabId: data.tabId || null,
      title: typeof data.title === 'string' ? data.title : '',
      status: WORKFLOW_DAY_STATUSES.indexOf(data.status) !== -1 ? data.status : 'Not started',
      order: typeof data.order === 'number' ? data.order : 0,
      // `notes` — a single legacy freeform string (the day-detail page's
      // very first version, one textarea). Superseded by `blocks` below;
      // kept only so a day saved under that earlier shape can be
      // migrated forward the first time its page is opened (see
      // business.html's migrateDayNotesToBlocks()) instead of losing
      // whatever was already written there.
      notes: typeof data.notes === 'string' ? data.notes : '',
      // This day's own "page" — generated on demand (a button adds a
      // blank one), fully editable and reorderable, same convention as
      // a Platform widget's `data.sections`. Each block:
      // {id, type:'note'|'code', title, body, order, createdAt}.
      blocks: Array.isArray(data.blocks) ? data.blocks : [],
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** @typedef {{id:string, tabId:string, title:string, note:string, status:string, priority:string, dueDate:string, estimateMinutes:?number, isDailyAction:boolean, recurrence:string, workflowDayId:?string, done:boolean, doneAt:?number, createdAt:number}} BizTask */
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
      // Optional link back to the WorkflowDay this task was generated
      // from (via "→ Tasks") — null for an ordinary, unlinked task.
      workflowDayId: data.workflowDayId || null,
      done: status === 'done',
      doneAt: (typeof data.doneAt === 'number') ? data.doneAt : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** @typedef {{id:string, dayId:string, text:string, checked:boolean, order:number, createdAt:number}} WorkflowChecklistItem */
  function workflowChecklistItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('wfc'),
      dayId: data.dayId || null,
      text: typeof data.text === 'string' ? data.text : '',
      checked: !!data.checked,
      order: typeof data.order === 'number' ? data.order : 0,
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
  const WorkflowWeeks = makeCollection(KEYS.workflowWeeks, workflowWeekModel);
  const WorkflowDays = makeCollection(KEYS.workflowDays, workflowDayModel);
  const WorkflowChecklist = makeCollection(KEYS.workflowChecklist, workflowChecklistItemModel);
  const Tasks = makeCollection(KEYS.tasks, taskModel);

  function removeTab(id) {
    Tabs.remove(id);
    Widgets.replaceAll(Widgets.list().filter(function (w) { return w.tabId !== id; }));
    const removedDayIds = WorkflowDays.list().filter(function (d) { return d.tabId === id; }).map(function (d) { return d.id; });
    WorkflowWeeks.replaceAll(WorkflowWeeks.list().filter(function (w) { return w.tabId !== id; }));
    WorkflowDays.replaceAll(WorkflowDays.list().filter(function (d) { return d.tabId !== id; }));
    WorkflowChecklist.replaceAll(WorkflowChecklist.list().filter(function (c) { return removedDayIds.indexOf(c.dayId) === -1; }));
    Tasks.replaceAll(Tasks.list().filter(function (t) { return t.tabId !== id; }));
  }

  // `Tabs.list()`/`get()` return raw stored records — they never get
  // re-run through tabModel() (only add()/update() do), so a tab saved
  // under the pre-`layout` schema (the old `mode: 'board'|'tasks'` field)
  // still has no `layout` field at all once loaded back. Every render
  // path here branches strictly on `layout`, so a missing one matches no
  // branch and the whole page renders blank — same failure class Dream
  // Board hit once for its `hero` field (see that page's own changelog).
  // This runs automatically on every load (not gated behind the
  // seed-race window) because it only ever transforms *existing* tabs
  // into a corrected shape — it can't turn empty storage into populated
  // storage, so it can't race the cloud pull the way a full reseed
  // could. It also drops the three tabs this app no longer has
  // (Analytics/Strategy/Audit, from an earlier pass) so a device that
  // hasn't loaded this update yet still converges to the same 4-tab,
  // correctly-shaped result once it does — deterministic regardless of
  // which device runs it first, same precedent as the Vision Board
  // stuck-video-cover fix.
  function normalizeStoredData() {
    const tabs = Tabs.list();
    if (!tabs.length) return;

    const REMOVED_TITLES = ['Analytics', 'Strategy', 'Audit'];
    tabs.filter(function (t) { return REMOVED_TITLES.indexOf(t.title) !== -1; })
      .forEach(function (t) { removeTab(t.id); });

    const remaining = Tabs.list();
    let changed = false;
    const patched = remaining.map(function (t) {
      if (t.layout === 'content' || t.layout === 'platforms' || t.layout === 'freeform') return t;
      changed = true;
      let layout = 'freeform';
      if (t.title === 'Content') layout = 'content';
      else if (t.title === 'Platforms') layout = 'platforms';
      return Object.assign({}, t, { layout: layout });
    });
    if (changed) Tabs.replaceAll(patched);

    // Tasks re-linked to a tab that no longer exists (e.g. from Strategy
    // being removed in a session before Tasks was reintroduced) are
    // harmless but permanently invisible — prune them the same way
    // removeTab() already does for a tab removed just now.
    const liveTabIds = Tabs.list().map(function (t) { return t.id; });
    const orphanedTasks = Tasks.list().filter(function (task) { return liveTabIds.indexOf(task.tabId) === -1; });
    if (orphanedTasks.length) Tasks.replaceAll(Tasks.list().filter(function (task) { return liveTabIds.indexOf(task.tabId) !== -1; }));
  }

  // ============================================================
  // SELECTORS — board (Dream Board engine, unchanged — 'freeform' tabs)
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

  // ============================================================
  // SELECTORS — sectioned "databases" ('content'/'platforms' tabs). Each
  // (tabId, type) pair is its own independent, ordered list — this is what
  // keeps the Platform database and the Content Plan database genuinely
  // separate rather than columns of one mixed freeform board.
  // ============================================================
  function widgetsOfType(tabId, type) {
    return Widgets.list()
      .filter(function (w) { return w.tabId === tabId && w.type === type; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function reorderWidgetsOfType(tabId, type, orderedIds) {
    const all = Widgets.list();
    const byId = {};
    all.forEach(function (w) { byId[w.id] = w; });
    orderedIds.forEach(function (id, idx) {
      const w = byId[id];
      if (w && w.tabId === tabId && w.type === type) w.order = idx;
    });
    Widgets.replaceAll(all);
  }
  function contentCardsForTab(tabId) { return widgetsOfType(tabId, 'contentcard'); }
  function platformsForTab(tabId) { return widgetsOfType(tabId, 'platform'); }
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
  // Platform "pages" — every platform widget can carry its own set of
  // freeform notes sections, generated on demand (a button adds a blank
  // one) and fully editable/reorderable. Lives inline on the widget
  // (`data.sections`), so deleting the platform deletes its sections with
  // it — no separate collection or orphan cleanup needed, same precedent
  // as e.g. a content card's inline checklist.
  // ============================================================
  function sectionsForWidget(widgetId) {
    const w = Widgets.get(widgetId);
    if (!w) return [];
    return (w.data.sections || []).slice().sort(function (a, b) { return a.order - b.order; });
  }
  function addPlatformSection(widgetId) {
    const w = Widgets.get(widgetId);
    if (!w) return null;
    const sections = (w.data.sections || []).slice();
    const order = sections.length ? Math.max.apply(null, sections.map(function (s) { return s.order; })) + 1 : 0;
    const section = { id: uid('sec'), title: 'New Section', body: '', order: order, createdAt: Date.now() };
    sections.push(section);
    Widgets.update(widgetId, { data: Object.assign({}, w.data, { sections: sections }) });
    return section;
  }
  function updatePlatformSection(widgetId, sectionId, patch) {
    const w = Widgets.get(widgetId);
    if (!w) return;
    const sections = (w.data.sections || []).map(function (s) { return s.id === sectionId ? Object.assign({}, s, patch) : s; });
    Widgets.update(widgetId, { data: Object.assign({}, w.data, { sections: sections }) });
  }
  function removePlatformSection(widgetId, sectionId) {
    const w = Widgets.get(widgetId);
    if (!w) return;
    const sections = (w.data.sections || []).filter(function (s) { return s.id !== sectionId; });
    Widgets.update(widgetId, { data: Object.assign({}, w.data, { sections: sections }) });
  }
  function movePlatformSection(widgetId, sectionId, dir) {
    const w = Widgets.get(widgetId);
    if (!w) return;
    const sections = (w.data.sections || []).slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sections.findIndex(function (s) { return s.id === sectionId; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= sections.length) return;
    const tmp = sections[idx].order; sections[idx].order = sections[otherIdx].order; sections[otherIdx].order = tmp;
    Widgets.update(widgetId, { data: Object.assign({}, w.data, { sections: sections }) });
  }

  // ============================================================
  // A Workflow day's own "page" — freeform note/code blocks, generated
  // on demand (a button adds a blank one), fully editable and
  // reorderable. Same inline-array-on-the-record convention as a
  // Platform widget's sections above — lives on the WorkflowDay itself,
  // so deleting the day deletes its blocks with it.
  // ============================================================
  function blocksForDay(dayId) {
    const day = WorkflowDays.get(dayId);
    if (!day) return [];
    return (day.blocks || []).slice().sort(function (a, b) { return a.order - b.order; });
  }
  function addWorkflowDayBlock(dayId, type) {
    const day = WorkflowDays.get(dayId);
    if (!day) return null;
    const blocks = (day.blocks || []).slice();
    const order = blocks.length ? Math.max.apply(null, blocks.map(function (b) { return b.order; })) + 1 : 0;
    const block = { id: uid('blk'), type: type === 'code' ? 'code' : 'note', title: '', body: '', order: order, createdAt: Date.now() };
    blocks.push(block);
    WorkflowDays.update(dayId, { blocks: blocks });
    return block;
  }
  function updateWorkflowDayBlock(dayId, blockId, patch) {
    const day = WorkflowDays.get(dayId);
    if (!day) return;
    const blocks = (day.blocks || []).map(function (b) { return b.id === blockId ? Object.assign({}, b, patch) : b; });
    WorkflowDays.update(dayId, { blocks: blocks });
  }
  function removeWorkflowDayBlock(dayId, blockId) {
    const day = WorkflowDays.get(dayId);
    if (!day) return;
    const blocks = (day.blocks || []).filter(function (b) { return b.id !== blockId; });
    WorkflowDays.update(dayId, { blocks: blocks });
  }
  function moveWorkflowDayBlock(dayId, blockId, dir) {
    const day = WorkflowDays.get(dayId);
    if (!day) return;
    const blocks = (day.blocks || []).slice().sort(function (a, b) { return a.order - b.order; });
    const idx = blocks.findIndex(function (b) { return b.id === blockId; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= blocks.length) return;
    const tmp = blocks[idx].order; blocks[idx].order = blocks[otherIdx].order; blocks[otherIdx].order = tmp;
    WorkflowDays.update(dayId, { blocks: blocks });
  }

  // ============================================================
  // SELECTORS — Workflow (Weeks → Days → Checklist), same mechanic as
  // index.html's Business Workflow feature, scoped to a tab instead of a
  // "business" (this page has no multiple-businesses concept). `order` is
  // a free-floating sort key — reordering swaps two siblings' `order`
  // values rather than renumbering the whole list, same convention as
  // every other reorderable list in this app.
  // ============================================================
  function weeksForTab(tabId) {
    return WorkflowWeeks.list().filter(function (w) { return w.tabId === tabId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function daysForWeek(weekId) {
    return WorkflowDays.list().filter(function (d) { return d.weekId === weekId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function checklistForDay(dayId) {
    return WorkflowChecklist.list().filter(function (c) { return c.dayId === dayId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function weekProgress(weekId) {
    const days = daysForWeek(weekId);
    const done = days.filter(function (d) { return d.status === 'Done'; }).length;
    return { done: done, total: days.length, fraction: days.length ? done / days.length : 0 };
  }
  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  function swapOrder(list, id, dir) {
    const idx = list.findIndex(function (x) { return x.id === id; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= list.length) return;
    const a = list[idx], b = list[otherIdx];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    return [a, b];
  }

  function addWorkflowWeek(tabId, data) { return WorkflowWeeks.add(Object.assign({}, data, { tabId: tabId, order: nextOrder(weeksForTab(tabId)) })); }
  function updateWorkflowWeek(id, patch) { return WorkflowWeeks.update(id, patch); }
  function removeWorkflowWeek(id) {
    const dayIds = WorkflowDays.list().filter(function (d) { return d.weekId === id; }).map(function (d) { return d.id; });
    WorkflowWeeks.remove(id);
    WorkflowDays.replaceAll(WorkflowDays.list().filter(function (d) { return d.weekId !== id; }));
    WorkflowChecklist.replaceAll(WorkflowChecklist.list().filter(function (c) { return dayIds.indexOf(c.dayId) === -1; }));
    Tasks.replaceAll(Tasks.list().map(function (t) { return dayIds.indexOf(t.workflowDayId) !== -1 ? Object.assign({}, t, { workflowDayId: null }) : t; }));
  }
  function moveWorkflowWeek(id, dir) {
    const week = WorkflowWeeks.get(id); if (!week) return;
    const changed = swapOrder(weeksForTab(week.tabId), id, dir);
    if (changed) WorkflowWeeks.replaceAll(WorkflowWeeks.list().map(function (w) { const hit = changed.find(function (c) { return c.id === w.id; }); return hit || w; }));
  }
  /** Clones a week plus its days and their checklist items — the copy
   * always resets to Not-started/unchecked, since duplicating is for
   * reusing a week's day/checklist *structure* as a reusable template,
   * not for snapshotting progress (same precedent as index.html's own
   * duplicateWorkflowWeek()). */
  function duplicateWorkflowWeek(weekId) {
    const week = WorkflowWeeks.get(weekId); if (!week) return null;
    const newWeek = addWorkflowWeek(week.tabId, { title: week.title + ' (Copy)', collapsed: false });
    daysForWeek(weekId).forEach(function (day) {
      const newDay = addWorkflowDay(newWeek.id, week.tabId, { title: day.title, status: 'Not started' });
      checklistForDay(day.id).forEach(function (item) { addWorkflowChecklistItem(newDay.id, { text: item.text, checked: false }); });
    });
    return newWeek;
  }

  function addWorkflowDay(weekId, tabId, data) { return WorkflowDays.add(Object.assign({}, data, { weekId: weekId, tabId: tabId, order: nextOrder(daysForWeek(weekId)) })); }
  function updateWorkflowDay(id, patch) { return WorkflowDays.update(id, patch); }
  function removeWorkflowDay(id) {
    WorkflowDays.remove(id);
    WorkflowChecklist.replaceAll(WorkflowChecklist.list().filter(function (c) { return c.dayId !== id; }));
    Tasks.replaceAll(Tasks.list().map(function (t) { return t.workflowDayId === id ? Object.assign({}, t, { workflowDayId: null }) : t; }));
  }
  function moveWorkflowDay(id, dir) {
    const day = WorkflowDays.get(id); if (!day) return;
    const changed = swapOrder(daysForWeek(day.weekId), id, dir);
    if (changed) WorkflowDays.replaceAll(WorkflowDays.list().map(function (d) { const hit = changed.find(function (c) { return c.id === d.id; }); return hit || d; }));
  }
  /** Relocates a day to a different week (keeping its status/notes/
   * checklist untouched), appended at the end of the target week — same
   * "move to a different parent list" idea as index.html's own
   * moveWorkflowDayToWeek(). */
  function moveWorkflowDayToWeek(dayId, targetWeekId) {
    const day = WorkflowDays.get(dayId); if (!day || day.weekId === targetWeekId) return;
    WorkflowDays.update(dayId, { weekId: targetWeekId, order: nextOrder(daysForWeek(targetWeekId)) });
  }
  function duplicateWorkflowDay(dayId) {
    const day = WorkflowDays.get(dayId); if (!day) return null;
    const newDay = addWorkflowDay(day.weekId, day.tabId, { title: day.title, status: 'Not started' });
    checklistForDay(dayId).forEach(function (item) { addWorkflowChecklistItem(newDay.id, { text: item.text, checked: false }); });
    return newDay;
  }

  function addWorkflowChecklistItem(dayId, data) { return WorkflowChecklist.add(Object.assign({}, data, { dayId: dayId, order: nextOrder(checklistForDay(dayId)) })); }
  function updateWorkflowChecklistItem(id, patch) { return WorkflowChecklist.update(id, patch); }
  function removeWorkflowChecklistItem(id) { return WorkflowChecklist.remove(id); }
  function moveWorkflowChecklistItem(id, dir) {
    const item = WorkflowChecklist.get(id); if (!item) return;
    const changed = swapOrder(checklistForDay(item.dayId), id, dir);
    if (changed) WorkflowChecklist.replaceAll(WorkflowChecklist.list().map(function (c) { const hit = changed.find(function (x) { return x.id === c.id; }); return hit || c; }));
  }

  // ============================================================
  // SELECTORS — Tasks (mirrors index.html Main dashboard's Tasks tab,
  // scoped down since this page has no Life Area/Goal/Business/Habit
  // dimensions — just a per-tab list, filterable by priority/status, with
  // a quick-add, recurrence, and a Task Detail modal for freeform notes).
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
  /** A follow-up task for a recurring task that was just marked done —
   * same +1 day (daily) / +7 days (weekly) precedent as index.html's
   * spawnNextRecurrence(). */
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
  // Day ↔ Task linking — "→ Tasks" on a Workflow day creates (or reuses)
  // a linked Task in this tab's Tasks list; status pushes are one-hop and
  // non-recursive (only from the specific entry point that originated the
  // change), same precedent as index.html's own pushDayStatusToLinkedTask/
  // pushTaskStatusToLinkedDay — this prevents a Day→Task→Day ping-pong by
  // construction, since neither push function ever calls the other's
  // entry point.
  // ============================================================
  function taskForWorkflowDay(dayId) {
    return Tasks.list().find(function (t) { return t.workflowDayId === dayId; }) || null;
  }
  /** Creates a linked Task for this day if one doesn't already exist
   * (idempotent — re-clicking "→ Tasks" just returns the existing link,
   * it never creates a duplicate). */
  function sendWorkflowDayToTasks(dayId) {
    const existing = taskForWorkflowDay(dayId);
    if (existing) return existing;
    const day = WorkflowDays.get(dayId); if (!day) return null;
    return Tasks.add({
      tabId: day.tabId, title: day.title || 'Untitled day', workflowDayId: dayId,
      status: day.status === 'Done' ? 'done' : day.status === 'In progress' ? 'in-progress' : 'todo'
    });
  }
  /** Unlinks (does not delete) the Task tied to this day. */
  function unlinkWorkflowDayFromTask(dayId) {
    const task = taskForWorkflowDay(dayId);
    if (task) Tasks.update(task.id, { workflowDayId: null });
  }
  /** Day status → Task status. 'Blocked' has no Task equivalent and maps
   * to 'todo', same as index.html's own mapping. */
  function pushDayStatusToLinkedTask(dayId, dayStatus) {
    const task = taskForWorkflowDay(dayId);
    if (!task) return;
    const mapped = dayStatus === 'Done' ? 'done' : dayStatus === 'In progress' ? 'in-progress' : 'todo';
    Tasks.update(task.id, { status: mapped, doneAt: mapped === 'done' ? Date.now() : null });
  }
  /** Task status → Day status. Only pushes when the task is marked done
   * (or un-done) — any other Task change leaves the Day's status alone,
   * and in particular never overwrites an explicit 'Blocked' unless the
   * task is actually done, same "Blocked-protection" precedent as
   * index.html's own version of this function. */
  function pushTaskStatusToLinkedDay(taskId) {
    const task = Tasks.get(taskId);
    if (!task || !task.workflowDayId) return;
    const day = WorkflowDays.get(task.workflowDayId);
    if (!day) return;
    if (task.status === 'done') { WorkflowDays.update(day.id, { status: 'Done' }); return; }
    if (day.status === 'Blocked') return;
    WorkflowDays.update(day.id, { status: 'Not started' });
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);
    WorkflowWeeks.replaceAll([]);
    WorkflowDays.replaceAll([]);
    WorkflowChecklist.replaceAll([]);
    Tasks.replaceAll([]);

    const contentTab = Tabs.add({
      title: 'Content', order: 0, layout: 'content',
      hero: heroModel({ eyebrow: 'CONTENT PLANNING', title: 'Say It.\nShip It.', subtext: 'Every post starts here — plan it, track it, ship it.', ctaLabel: 'VIEW CONTENT' })
    });
    const ideasTab = Tabs.add({
      title: 'Ideas', order: 1, layout: 'freeform',
      hero: heroModel({ eyebrow: 'THE IDEA BANK', title: 'Capture It Now.\nRefine It Later.', subtext: 'Loose ideas, hooks, and things worth revisiting.', ctaLabel: 'VIEW BOARD' })
    });
    const platformsTab = Tabs.add({
      title: 'Platforms', order: 2, layout: 'platforms',
      hero: heroModel({ eyebrow: 'WHERE WE SHOW UP', title: 'Every Platform.\nOne Home.', subtext: 'Track and toggle every platform we show up on.', ctaLabel: 'VIEW PLATFORMS' })
    });
    const resourcesTab = Tabs.add({
      title: 'Resources', order: 3, layout: 'freeform', hasTemplates: true,
      hero: heroModel({ eyebrow: 'THE TOOLKIT', title: 'Everything.\nIn One Place.', subtext: 'Brand assets, templates, and reference material.', ctaLabel: 'VIEW RESOURCES' })
    });

    // ---------- Content — fixed dashboard: Platform database / Content
    // Plan database / Useful Resources database (each independently
    // ordered by type — see widgetsOfType()) plus a sidebar. ----------
    Widgets.add({ tabId: contentTab.id, column: 0, order: 0, type: 'platform', title: 'Instagram', data: { active: true, cover: '', sections: [] } });
    Widgets.add({ tabId: contentTab.id, column: 0, order: 1, type: 'platform', title: 'Tiktok', data: { active: true, cover: '', sections: [] } });
    Widgets.add({ tabId: contentTab.id, column: 0, order: 2, type: 'platform', title: 'Youtube', data: { active: true, cover: '', sections: [] } });

    Widgets.add({
      tabId: contentTab.id, column: 0, order: 0, type: 'contentcard', title: 'Share Relatable Business Stories',
      data: { title: 'Share Relatable Business Stories', cover: '', platform: 'Tiktok', status: 'published', tags: ['Self Growth', 'Video'], scheduledDate: shiftedISO(-6), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: true }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 1, type: 'contentcard', title: 'How to Increase Website Traffic',
      data: { title: 'How to Increase Website Traffic', cover: '', platform: 'Pinterest', status: 'ready', tags: ['Digital Marketing', 'Pin'], scheduledDate: todayISO(), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 2, type: 'contentcard', title: '3 Time-Saving Marketing Tips for Small Business',
      data: { title: '3 Time-Saving Marketing Tips for Small Business', cover: '', platform: 'Pinterest', status: 'published', tags: ['Digital Marketing', 'Pin'], scheduledDate: shiftedISO(-5), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: true }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 3, type: 'contentcard', title: 'Celebrating 30K Followers',
      data: { title: 'Celebrating 30K Followers', cover: '', platform: 'Facebook', status: 'ready', tags: ['Others', 'Post'], scheduledDate: shiftedISO(2), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 4, type: 'contentcard', title: 'A Better Way to Advertise on Instagram',
      data: { title: 'A Better Way to Advertise on Instagram', cover: '', platform: 'Youtube', status: 'writing-caption', tags: ['Digital Marketing', 'Shorts'], scheduledDate: shiftedISO(-1), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: true }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 5, type: 'contentcard', title: 'Plan Your Content in 30 Minutes',
      data: { title: 'Plan Your Content in 30 Minutes', cover: '', platform: 'Twitter', status: 'not-started', tags: ['Productivity', 'Tweet'], scheduledDate: shiftedISO(7), scheduledTime: '19:00', checklist: [{ id: uid('cl'), text: 'Design needed', done: false }, { id: uid('cl'), text: 'Copy needed', done: false }] }
    });

    const resourceDefs = [
      { icon: '🎨', title: 'Design resources', description: 'Design templates, icons, fonts, filters, etc. for the visuals of your content' },
      { icon: '#️⃣', title: 'Hashtag', description: 'Create a list of your most used hashtags that you can copy and paste' },
      { icon: '🔗', title: 'Important link', description: 'Save bookmarks that are relevant to your social media accounts' },
      { icon: '🪝', title: 'Hook', description: 'Create a collection for your inspiration and for future reference' },
      { icon: '💡', title: 'Inspiration', description: 'Create a collection for your inspiration and for future reference' },
      { icon: '🎧', title: 'Audio', description: 'Keep up with the trends and save trending audio' },
      { icon: '🎬', title: 'Video footage', description: 'Prepare the video footage for your social media posts' },
      { icon: '📝', title: 'Notes', description: 'Save any notes or article you find interesting and important' },
      { icon: '📐', title: 'Size Guide', description: 'The optimal image sizes for various platforms' },
      { icon: '🛠', title: 'Tools', description: 'Add your favorite social media tools and subscription' }
    ];
    resourceDefs.forEach(function (r, i) {
      Widgets.add({ tabId: contentTab.id, column: 0, order: i, type: 'resource', title: r.title, data: { icon: r.icon, title: r.title, description: r.description, status: 'Active' } });
    });

    Widgets.add({ tabId: contentTab.id, column: 0, order: 0, type: 'summary', title: 'Content Overview', data: {} });
    Widgets.add({
      tabId: contentTab.id, column: 0, order: 0, type: 'schedule', title: 'Posting Schedule',
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
    Widgets.add({ tabId: contentTab.id, column: 0, order: 0, type: 'photos', title: 'Gallery', data: { wide: false, slots: [] } });

    // ---------- Ideas (freeform board) ----------
    Widgets.add({
      tabId: ideasTab.id, column: 0, order: 0, type: 'list', title: 'Content Ideas',
      data: { items: [{ id: uid('it'), text: 'Behind-the-scenes of a typical workday' }, { id: uid('it'), text: 'Customer testimonial round-up' }, { id: uid('it'), text: 'Myth vs. fact post for our industry' }] }
    });
    Widgets.add({ tabId: ideasTab.id, column: 1, order: 0, type: 'note', title: 'Brain Dump', data: { body: "Loose ideas that don't have a home yet — revisit during the next content planning session." } });
    Widgets.add({ tabId: ideasTab.id, column: 2, order: 0, type: 'infocard', title: 'Idea Bank', data: { icon: '💡', title: 'IDEA BANK', subtitle: 'Capture it now, refine it later.' } });

    // ---------- Platforms — its own dedicated Platform database page ----------
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 0, type: 'platform', title: 'Instagram', data: { active: true, cover: '', sections: [] } });
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 1, type: 'platform', title: 'Tiktok', data: { active: true, cover: '', sections: [] } });
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 2, type: 'platform', title: 'Youtube', data: { active: true, cover: '', sections: [] } });
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 3, type: 'platform', title: 'Pinterest', data: { active: false, cover: '', sections: [] } });
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 4, type: 'platform', title: 'Facebook', data: { active: false, cover: '', sections: [] } });
    Widgets.add({ tabId: platformsTab.id, column: 0, order: 5, type: 'platform', title: 'Twitter', data: { active: false, cover: '', sections: [] } });

    // ---------- Resources — top: Links & Notes (freeform board) ----------
    Widgets.add({ tabId: resourcesTab.id, column: 0, order: 0, type: 'note', title: 'Quick Notes', data: { body: 'Anything worth remembering that does not have a home yet.' } });
    Widgets.add({ tabId: resourcesTab.id, column: 1, order: 0, type: 'link', title: 'Brand Guidelines', data: { url: '', description: 'Logo usage, color codes, and voice/tone guide.' } });
    Widgets.add({ tabId: resourcesTab.id, column: 2, order: 0, type: 'link', title: 'Shared Drive', data: { url: '', description: 'Raw footage, exports, and source files.' } });

    // ---------- Resources — bottom, below a divider: Templates (Workflow) ----------
    const week1 = addWorkflowWeek(resourcesTab.id, { title: 'Week 1 — Launch Checklist' });
    const w1d1 = addWorkflowDay(week1.id, resourcesTab.id, { title: 'Kickoff & brief', status: 'Done' });
    addWorkflowChecklistItem(w1d1.id, { text: 'Confirm goal and audience', checked: true });
    addWorkflowChecklistItem(w1d1.id, { text: 'Gather reference material', checked: true });
    const w1d2 = addWorkflowDay(week1.id, resourcesTab.id, { title: 'Draft & review', status: 'In progress' });
    addWorkflowChecklistItem(w1d2.id, { text: 'Write first draft', checked: true });
    addWorkflowChecklistItem(w1d2.id, { text: 'Get feedback', checked: false });
    const w1d3 = addWorkflowDay(week1.id, resourcesTab.id, { title: 'Finalize & ship', status: 'Not started' });
    addWorkflowChecklistItem(w1d3.id, { text: 'Incorporate feedback', checked: false });
    addWorkflowChecklistItem(w1d3.id, { text: 'Publish', checked: false });

    const week2 = addWorkflowWeek(resourcesTab.id, { title: 'Week 2 — Repurpose & Recap' });
    const w2d1 = addWorkflowDay(week2.id, resourcesTab.id, { title: 'Repurpose into 3 formats', status: 'Not started' });
    addWorkflowChecklistItem(w2d1.id, { text: 'Cut a short-form clip', checked: false });
    addWorkflowChecklistItem(w2d1.id, { text: 'Write a carousel version', checked: false });
    const w2d2 = addWorkflowDay(week2.id, resourcesTab.id, { title: 'Recap performance', status: 'Not started' });
    addWorkflowChecklistItem(w2d2.id, { text: 'Pull top-line metrics', checked: false });
    addWorkflowChecklistItem(w2d2.id, { text: 'Note what to try next time', checked: false });

    // ---------- Resources — Tasks (a second section alongside Workflow
    // Templates) ----------
    sendWorkflowDayToTasks(w1d2.id); // "Draft & review" is already in progress — demonstrate a linked task
    Tasks.add({ tabId: resourcesTab.id, title: 'Review brand guidelines before next campaign', status: 'todo', priority: 'medium' });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Tabs.list().length || Widgets.list().length || WorkflowWeeks.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultBoard();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as dreamboard-data.js: seeding
  // synchronously at script-load time, before initCloudSync() gets a
  // chance to pull real cloud data, can push a freshly-seeded "default"
  // board to Supabase and clobber another device's real data.
  // business.html's init() calls seedIfEmpty() itself, only as a fallback
  // after giving the cloud pull a real chance to land.

  // normalizeStoredData(), unlike seedIfEmpty(), IS safe to run
  // automatically here — see its own comment above for why.
  normalizeStoredData();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.BusinessData = {
    KEYS: KEYS,
    WIDGET_TYPES: WIDGET_TYPES,
    CONTENT_STATUSES: CONTENT_STATUSES,
    RESOURCE_STATUSES: RESOURCE_STATUSES,
    SCHEDULE_DAYS: SCHEDULE_DAYS,
    WORKFLOW_DAY_STATUSES: WORKFLOW_DAY_STATUSES,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    TASK_RECURRENCES: TASK_RECURRENCES,
    uid: uid,
    todayISO: todayISO,
    formatDateShort: formatDateShort,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: { tab: tabModel, widget: widgetModel, workflowWeek: workflowWeekModel, workflowDay: workflowDayModel, workflowChecklistItem: workflowChecklistItemModel, task: taskModel },
    defaultWidgetData: defaultWidgetData,
    Tabs: Object.assign({}, Tabs, { remove: removeTab }),
    Widgets: Widgets,
    WorkflowWeeks: WorkflowWeeks,
    WorkflowDays: WorkflowDays,
    WorkflowChecklist: WorkflowChecklist,
    Tasks: Tasks,
    tabsSorted: tabsSorted,
    normalizeStoredData: normalizeStoredData,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    widgetsOfType: widgetsOfType,
    reorderWidgetsOfType: reorderWidgetsOfType,
    contentCardsForTab: contentCardsForTab,
    platformsForTab: platformsForTab,
    statusLabel: statusLabel,
    computeDueLabel: computeDueLabel,
    sectionsForWidget: sectionsForWidget,
    addPlatformSection: addPlatformSection,
    updatePlatformSection: updatePlatformSection,
    removePlatformSection: removePlatformSection,
    movePlatformSection: movePlatformSection,
    blocksForDay: blocksForDay,
    addWorkflowDayBlock: addWorkflowDayBlock,
    updateWorkflowDayBlock: updateWorkflowDayBlock,
    removeWorkflowDayBlock: removeWorkflowDayBlock,
    moveWorkflowDayBlock: moveWorkflowDayBlock,
    weeksForTab: weeksForTab,
    daysForWeek: daysForWeek,
    checklistForDay: checklistForDay,
    weekProgress: weekProgress,
    addWorkflowWeek: addWorkflowWeek,
    updateWorkflowWeek: updateWorkflowWeek,
    removeWorkflowWeek: removeWorkflowWeek,
    moveWorkflowWeek: moveWorkflowWeek,
    duplicateWorkflowWeek: duplicateWorkflowWeek,
    addWorkflowDay: addWorkflowDay,
    updateWorkflowDay: updateWorkflowDay,
    removeWorkflowDay: removeWorkflowDay,
    moveWorkflowDay: moveWorkflowDay,
    moveWorkflowDayToWeek: moveWorkflowDayToWeek,
    duplicateWorkflowDay: duplicateWorkflowDay,
    addWorkflowChecklistItem: addWorkflowChecklistItem,
    updateWorkflowChecklistItem: updateWorkflowChecklistItem,
    removeWorkflowChecklistItem: removeWorkflowChecklistItem,
    moveWorkflowChecklistItem: moveWorkflowChecklistItem,
    tasksForTab: tasksForTab,
    sortTasks: sortTasks,
    spawnNextRecurrence: spawnNextRecurrence,
    taskForWorkflowDay: taskForWorkflowDay,
    sendWorkflowDayToTasks: sendWorkflowDayToTasks,
    unlinkWorkflowDayFromTask: unlinkWorkflowDayFromTask,
    pushDayStatusToLinkedTask: pushDayStatusToLinkedTask,
    pushTaskStatusToLinkedDay: pushTaskStatusToLinkedDay,
    seedDefaultBoard: seedDefaultBoard,
    seedIfEmpty: seedIfEmpty
  };
})(window);
