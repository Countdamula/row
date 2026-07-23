// tasksnotes-data.js
//
// Shared data foundation for tasksnotes.html ("Tasks & Notes"). Same
// conventions as aitech-data.js/business-data.js (see CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB. All
// keys live under a `tasksnotes:` prefix so tasksnotes.html's
// initCloudSync({ syncedPrefixes: ['tasksnotes:'] }) call covers every
// collection with no per-key list.
//
// This page used to be a 5th tab inside business.html (layout:
// 'tasksnotes') — moved out to its own top-level page per an explicit
// request. Three genuinely separate collections, same "never merged into
// one list" precedent as business.html's Platform/Content Plan/Useful
// Resources split and aitech-data.js's Models/Prompts split:
//   - Links — a small drag-reorderable list of URL + description cards.
//   - Notes — a full searchable/taggable database (distinct from a single
//     freeform note widget elsewhere in this app).
//   - Tasks — the same status/priority/recurrence shape as every other
//     task list in this app (business-data.js's own Tasks collection,
//     index.html's Main-dashboard Tasks tab), just scoped to this page.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'tasksnotes:save' event either way
  // so tasksnotes.html can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('tasksnotes:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('tasksnotes:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    links: 'tasksnotes:links',
    notes: 'tasksnotes:notes',
    tasks: 'tasksnotes:tasks',
    hero: 'tasksnotes:hero',
    seeded: 'tasksnotes:seeded',
    migratedFromBusinessHub: 'tasksnotes:migratedFromBusinessHub'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1100;
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

  /** @typedef {{id:string, title:string, url:string, description:string, order:number, createdAt:number}} TnLink */
  function linkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('link'),
      title: typeof data.title === 'string' ? data.title : '',
      url: typeof data.url === 'string' ? data.url : '',
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id:string, title:string, body:string, tags:string[], createdAt:number, updatedAt:number}} TnNote */
  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  // Same status/priority/recurrence vocabulary as business-data.js's own
  // Tasks collection (business.html's Resources tab) and index.html's
  // Main-dashboard Tasks tab — kept independent (this page's own flat
  // array, not a shared collection) since this page has no relationship
  // to Business Hub anymore.
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

  /** @typedef {{id:string, title:string, note:string, status:string, priority:string, dueDate:string, estimateMinutes:?number, isDailyAction:boolean, recurrence:string, doneAt:?number, createdAt:number}} TnTask */
  function taskModel(data) {
    data = data || {};
    const status = TASK_STATUSES.some(function (s) { return s.key === data.status; }) ? data.status : (data.done ? 'done' : 'todo');
    return {
      id: data.id || uid('task'),
      title: typeof data.title === 'string' ? data.title : '',
      note: typeof data.note === 'string' ? data.note : '',
      status: status,
      priority: TASK_PRIORITIES.some(function (p) { return p.key === data.priority; }) ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      estimateMinutes: (typeof data.estimateMinutes === 'number') ? data.estimateMinutes : null,
      isDailyAction: !!data.isDailyAction,
      recurrence: TASK_RECURRENCES.some(function (r) { return r.key === data.recurrence; }) ? data.recurrence : 'none',
      doneAt: (typeof data.doneAt === 'number') ? data.doneAt : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // Single editable hero record — same shape as aitech-data.js's
  // heroModel, one instance since this page has no tabs.
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
  function getHero() { return heroModel(storeGet(KEYS.hero)); }
  function saveHero(patch) { const next = heroModel(Object.assign({}, getHero(), patch)); storeSet(KEYS.hero, next); return next; }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // aitech-data.js/business-data.js/dreamboard-data.js.
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

  const Links = makeCollection(KEYS.links, linkModel);
  // Notes.update() gets one small addition beyond the generic
  // makeCollection recipe — every update stamps `updatedAt`, so the notes
  // list's "newest touched first" ordering actually reflects when a note
  // was last edited, not just when it was created (same precedent
  // business-data.js's own now-removed Notes.update() used).
  const NotesBase = makeCollection(KEYS.notes, noteModel);
  function updateNoteTouched(id, patch) { return NotesBase.update(id, Object.assign({}, patch, { updatedAt: Date.now() })); }
  const Notes = Object.assign({}, NotesBase, { update: updateNoteTouched });
  const Tasks = makeCollection(KEYS.tasks, taskModel);

  // ============================================================
  // SELECTORS
  // ============================================================
  function linksSorted() { return Links.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function notesSorted() { return Notes.list().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }); }
  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  /** Applies a new order to whichever of these ids are actually passed in
   * — same accepted approximation aitech-data.js's reorderModels()/
   * business-data.js's reorderWidgetsOfType() already use. */
  function reorderLinks(orderedIds) {
    const all = Links.list();
    const byId = {}; all.forEach(function (l) { byId[l.id] = l; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Links.replaceAll(all);
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
   * same +1 day (daily) / +7 days (weekly) precedent as business-data.js's
   * own spawnNextRecurrence()/index.html's spawnNextRecurrence(). */
  function spawnNextRecurrence(task) {
    if (!task.recurrence || task.recurrence === 'none') return null;
    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (task.recurrence === 'weekly' ? 7 : 1));
    const nextDue = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
    return Tasks.add({
      title: task.title, note: task.note, priority: task.priority,
      dueDate: nextDue, estimateMinutes: task.estimateMinutes, isDailyAction: task.isDailyAction,
      recurrence: task.recurrence, status: 'todo'
    });
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Links.replaceAll([]);
    Notes.replaceAll([]);
    Tasks.replaceAll([]);

    Links.add({ title: 'Shared Drive', url: '', description: 'Working files, exports, and source assets.', order: 0 });
    Links.add({ title: 'Team Calendar', url: '', description: 'Deadlines, launches, and meetings at a glance.', order: 1 });
    Notes.add({ title: 'Meeting Recap Template', body: 'Attendees:\nDecisions:\nAction items:', tags: ['template'] });
    Notes.add({ title: 'Random Idea', body: "Something worth remembering that doesn't have a home yet — jot it here and sort it out later.", tags: ['misc'] });
    Tasks.add({ title: "Review this week's priorities", status: 'todo', priority: 'medium', dueDate: todayISO() });
    Tasks.add({ title: 'Clear out old notes and links', status: 'todo', priority: 'low' });

    saveHero({
      eyebrow: 'STAY ON TOP OF IT',
      title: 'Every Task.\nEvery Note.',
      subtext: 'Links, notes, and a filtered task list — all in one place.',
      ctaLabel: 'VIEW TASKS'
    });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Links.list().length || Notes.list().length || Tasks.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as aitech-data.js/dreamboard-data.js/
  // business-data.js: seeding synchronously at script-load time, before
  // initCloudSync() gets a chance to pull real cloud data, can push a
  // freshly-seeded "default" set to Supabase and clobber another device's
  // real data. tasksnotes.html's init() calls seedIfEmpty() itself, only
  // as a fallback after giving the cloud pull (and the migration below) a
  // real chance to land.

  // ============================================================
  // ONE-TIME MIGRATION — this page used to be a 5th tab inside
  // business.html (layout: 'tasksnotes', title "Tasks & Notes"), added in
  // an earlier session and then moved out to its own top-level page here.
  // A device that already used that tab has real data sitting in
  // business.html's own localStorage keys (business:widgets — type
  // 'link', business:notes, business:tasks — all scoped via a `tabId`
  // foreign key to that one tab). This copies it once into this page's
  // own collections, the same "copy once when the target is still empty,
  // leave the old keys orphaned-but-untouched afterward" precedent
  // selfcare.html's migrateLegacyAnxietyPage() already established for
  // the standalone-Anxiety-page → Self-Care-tab move.
  //
  // Reads business.html's raw localStorage keys directly rather than
  // going through business-data.js's own API (business-data.js no longer
  // recognizes the 'tasksnotes' layout or exposes a Notes collection at
  // all, now that the tab itself was removed from that page — the data is
  // still sitting in localStorage under the old keys, just unreachable
  // from business.html's own UI going forward). Same "read another page's
  // localStorage directly" precedent index.html's Connected Apps tiles
  // already use.
  //
  // Deliberately NOT deferred behind a cloud-sync-race window like
  // seedIfEmpty() above — this reads a *different* localStorage prefix
  // (business:) that's already fully local and un-raced (this page's own
  // initCloudSync only pulls the tasksnotes: prefix), and only ever
  // writes when this page's own three collections are still empty, so it
  // can't clobber anything either way.
  // ============================================================
  function migrateFromBusinessHub() {
    if (storeGet(KEYS.migratedFromBusinessHub)) return false;
    storeSet(KEYS.migratedFromBusinessHub, true);
    if (Links.list().length || Notes.list().length || Tasks.list().length) return false;

    const businessTabs = storeGet('business:tabs');
    if (!Array.isArray(businessTabs)) return false;
    const oldTab = businessTabs.find(function (t) { return t && t.title === 'Tasks & Notes'; });
    if (!oldTab || !oldTab.id) return false;
    const tabId = oldTab.id;

    let migrated = false;

    const businessWidgets = storeGet('business:widgets');
    if (Array.isArray(businessWidgets)) {
      businessWidgets
        .filter(function (w) { return w && w.tabId === tabId && w.type === 'link'; })
        .forEach(function (w) {
          const d = w.data || {};
          Links.add({
            id: w.id, title: w.title || '', url: d.url || '', description: d.description || '',
            order: typeof w.order === 'number' ? w.order : 0, createdAt: w.createdAt
          });
          migrated = true;
        });
    }

    const businessNotes = storeGet('business:notes');
    if (Array.isArray(businessNotes)) {
      businessNotes
        .filter(function (n) { return n && n.tabId === tabId; })
        .forEach(function (n) {
          Notes.replaceAll(Notes.list().concat([noteModel({
            id: n.id, title: n.title, body: n.body, tags: n.tags,
            createdAt: n.createdAt, updatedAt: n.updatedAt
          })]));
          migrated = true;
        });
    }

    const businessTasks = storeGet('business:tasks');
    if (Array.isArray(businessTasks)) {
      businessTasks
        .filter(function (t) { return t && t.tabId === tabId; })
        .forEach(function (t) {
          Tasks.replaceAll(Tasks.list().concat([taskModel({
            id: t.id, title: t.title, note: t.note, status: t.status, priority: t.priority,
            dueDate: t.dueDate, estimateMinutes: t.estimateMinutes, isDailyAction: t.isDailyAction,
            recurrence: t.recurrence, doneAt: t.doneAt, createdAt: t.createdAt
          })]));
          migrated = true;
        });
    }

    if (migrated) {
      saveHero({
        eyebrow: 'STAY ON TOP OF IT',
        title: 'Every Task.\nEvery Note.',
        subtext: 'Links, notes, and a filtered task list — all in one place.',
        ctaLabel: 'VIEW TASKS'
      });
      storeSet(KEYS.seeded, true);
    }
    return migrated;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.TasksNotesData = {
    KEYS: KEYS,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    TASK_RECURRENCES: TASK_RECURRENCES,
    uid: uid,
    todayISO: todayISO,
    formatDateShort: formatDateShort,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Links: Links,
    Notes: Notes,
    Tasks: Tasks,
    getHero: getHero,
    saveHero: saveHero,
    linksSorted: linksSorted,
    notesSorted: notesSorted,
    nextOrder: nextOrder,
    reorderLinks: reorderLinks,
    sortTasks: sortTasks,
    spawnNextRecurrence: spawnNextRecurrence,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty,
    migrateFromBusinessHub: migrateFromBusinessHub
  };
})(window);
