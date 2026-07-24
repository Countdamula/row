// tasks-data.js
//
// Shared data foundation for tasks.html ("Tasks"). Same conventions as
// tasksnotes-data.js/aitech-data.js/business-data.js (see CLAUDE.md §4):
// plain localStorage, JSON-serialized, one key per collection, no
// server/DB. All keys live under a `tasksdb:` prefix so tasks.html's
// initCloudSync({ appKey: 'tasksdb', syncedPrefixes: ['tasksdb:'] }) call
// covers every collection with no per-key list.
//
// This is a genuinely new, standalone Tasks database — one unified
// TaskItem collection, native tasks side by side with items *imported*
// (one-way, read-only pull) from two other pages:
//   - Main (index.html) — a "Morning Call Sheet" (routine:*). It has no
//     task collection of its own; the closest things to "routine data"
//     and "any tasks data" are its Steps (routine:steps — the routine's
//     own ordered "Running order") and its Beliefs (routine:beliefs — a
//     database of belief statements, each carrying its own working
//     status). Both are pulled in.
//   - System (system.html) — Actions (system:actions, the page's own
//     daily/weekly repeatable "routine" items) and Challenges
//     (system:challenges, install-through-action items with a real
//     todo-shaped status). Both are pulled in.
//
// Import is strictly read-only against those two pages' localStorage —
// this file never writes to a `routine:` or `system:` key, so nothing
// from Main or System can ever be lost, altered, or deleted by this
// feature. Re-running the import (Sync from Main & System) updates the
// mutable display fields (title/status/schedule/etc.) on an
// already-imported TaskItem in place, keyed by (sourceType, sourceId),
// and adds anything new — it never removes a TaskItem just because its
// source item vanished, since that copy is this database's own data now.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as every other page's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'tasksdb:save' event either way so
  // tasks.html can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('tasksdb:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('tasksdb:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    items: 'tasksdb:items',
    hero: 'tasksdb:hero',
    seeded: 'tasksdb:seeded',
    lastSyncedAt: 'tasksdb:lastSyncedAt'
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
  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only guard as every other page in this app.
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

  // ============================================================
  // MODEL — one unified TaskItem shape for native tasks and every
  // imported source alike, so they can live in one database and one
  // render path.
  // ============================================================
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
  const SOURCE_LABELS = {
    'native': 'Native',
    'main-step': 'Main · Routine',
    'main-belief': 'Main · Beliefs',
    'system-action': 'System · Actions',
    'system-challenge': 'System · Challenges'
  };

  /** @typedef {{id:string, title:string, note:string, status:string, priority:string, dueDate:string, isDailyAction:boolean, recurrence:string, scheduledDays:?number[], doneAt:?number, order:number, sourceType:string, sourceId:?string, sourceMeta:string, createdAt:number, updatedAt:number}} TaskItem */
  function taskModel(data) {
    data = data || {};
    const status = TASK_STATUSES.some(function (s) { return s.key === data.status; }) ? data.status : (data.done ? 'done' : 'todo');
    const scheduledDays = Array.isArray(data.scheduledDays)
      ? data.scheduledDays.filter(function (d) { return typeof d === 'number' && d >= 0 && d <= 6; })
      : null;
    return {
      id: data.id || uid('task'),
      title: typeof data.title === 'string' ? data.title : '',
      note: typeof data.note === 'string' ? data.note : '',
      status: status,
      priority: TASK_PRIORITIES.some(function (p) { return p.key === data.priority; }) ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      isDailyAction: !!data.isDailyAction,
      recurrence: TASK_RECURRENCES.some(function (r) { return r.key === data.recurrence; }) ? data.recurrence : 'none',
      scheduledDays: scheduledDays,
      doneAt: (typeof data.doneAt === 'number') ? data.doneAt : null,
      order: typeof data.order === 'number' ? data.order : 0,
      sourceType: typeof data.sourceType === 'string' ? data.sourceType : 'native',
      sourceId: data.sourceId || null,
      sourceMeta: typeof data.sourceMeta === 'string' ? data.sourceMeta : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

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
  // GENERIC COLLECTION CRUD — same makeCollection recipe as every other
  // page's own -data.js.
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
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
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

  const Items = makeCollection(KEYS.items, taskModel);

  // ============================================================
  // SELECTORS
  // ============================================================
  function itemsSorted() { return Items.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  function reorderItems(orderedIds) {
    const all = Items.list();
    const byId = {}; all.forEach(function (t) { byId[t.id] = t; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Items.replaceAll(all);
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
      return a.order - b.order;
    });
    return copy;
  }
  function findBySource(sourceType, sourceId) {
    return Items.list().find(function (x) { return x.sourceType === sourceType && x.sourceId === sourceId; }) || null;
  }
  /** Same +1 day (daily) / +7 days (weekly) precedent as every other
   * page's spawnNextRecurrence() — only ever applies to native tasks
   * (an imported item's recurrence is source-driven, re-synced instead). */
  function spawnNextRecurrence(task) {
    if (!task.recurrence || task.recurrence === 'none') return null;
    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (task.recurrence === 'weekly' ? 7 : 1));
    const nextDue = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
    return Items.add({
      title: task.title, note: task.note, priority: task.priority,
      dueDate: nextDue, isDailyAction: task.isDailyAction, recurrence: task.recurrence,
      status: 'todo', sourceType: 'native', order: nextOrder(Items.list())
    });
  }

  // ============================================================
  // IMPORT FROM MAIN & SYSTEM — one-way, read-only. Reads the other
  // pages' own raw localStorage keys directly (same "read another page's
  // localStorage directly" precedent index.html's own former Connected
  // Apps tiles and tasksnotes-data.js's migrateFromBusinessHub() already
  // established) and never writes back to a `routine:` or `system:` key.
  // ============================================================
  function upsertImported(sourceType, sourceId, fields) {
    const existing = findBySource(sourceType, sourceId);
    if (existing) {
      // Preserve the user's own local status/order/note edits — only
      // refresh the fields that genuinely come from upstream.
      const patch = Object.assign({}, fields);
      delete patch.status; delete patch.order; delete patch.note;
      Items.update(existing.id, patch);
      return false; // updated, not new
    }
    Items.add(Object.assign({ sourceType: sourceType, sourceId: sourceId, order: nextOrder(Items.list()) }, fields));
    return true; // newly created
  }

  function importFromMain() {
    let added = 0, updated = 0;

    const steps = storeGet('routine:steps');
    if (Array.isArray(steps)) {
      steps.forEach(function (s) {
        if (!s || !s.id) return;
        const isNew = upsertImported('main-step', s.id, {
          title: s.name || 'Untitled step',
          isDailyAction: true,
          scheduledDays: [0, 1, 2, 3, 4, 5, 6],
          recurrence: 'none',
          sourceMeta: 'Step in the Morning Call Sheet running order'
        });
        isNew ? added++ : updated++;
      });
    }

    const beliefs = storeGet('routine:beliefs');
    if (Array.isArray(beliefs)) {
      const statusMap = { 'Working On': 'in-progress', 'Integrated': 'done', 'Parked': 'todo' };
      beliefs.forEach(function (b) {
        if (!b || !b.id) return;
        const existing = findBySource('main-belief', b.id);
        const isNew = !existing;
        upsertImported('main-belief', b.id, {
          title: b.text || 'Untitled belief',
          sourceMeta: 'Belief' + (b.category ? ' · ' + b.category : '') + (b.status ? ' · ' + b.status : '')
        });
        // Only seed the initial status from the source on first import —
        // afterward this database's own status (todo/in-progress/done) is
        // this page's to manage, same "preserve local edits" rule as
        // every other field.
        if (isNew) {
          const rec = findBySource('main-belief', b.id);
          if (rec) Items.update(rec.id, { status: statusMap[b.status] || 'todo' });
        }
        isNew ? added++ : updated++;
      });
    }

    return { added: added, updated: updated };
  }

  function importFromSystem() {
    let added = 0, updated = 0;

    const actions = storeGet('system:actions');
    if (Array.isArray(actions)) {
      actions.forEach(function (a) {
        if (!a || !a.id) return;
        const isNew = upsertImported('system-action', a.id, {
          title: a.title || 'Untitled action',
          isDailyAction: a.frequency === 'daily',
          recurrence: a.frequency === 'weekly' ? 'weekly' : 'none',
          scheduledDays: Array.isArray(a.scheduledDays) ? a.scheduledDays : null,
          sourceMeta: 'Action · ' + (a.frequency === 'weekly' ? 'Weekly' : 'Daily') + (a.mva ? ' · MVA: ' + a.mva : '')
        });
        isNew ? added++ : updated++;
      });
    }

    const challenges = storeGet('system:challenges');
    if (Array.isArray(challenges)) {
      const statusMap = { 'not-started': 'todo', 'in-progress': 'in-progress', 'done': 'done' };
      challenges.forEach(function (c) {
        if (!c || !c.id) return;
        const existing = findBySource('system-challenge', c.id);
        const isNew = !existing;
        upsertImported('system-challenge', c.id, {
          title: c.title || 'Untitled challenge',
          sourceMeta: 'Challenge' + (c.frequency ? ' · ' + c.frequency : '') + (c.action ? ' · ' + c.action : '')
        });
        if (isNew) {
          const rec = findBySource('system-challenge', c.id);
          if (rec) Items.update(rec.id, { status: statusMap[c.status] || 'todo' });
        } else {
          // Keep status roughly in sync going forward too, since a
          // Challenge's status is the one field here that genuinely
          // represents "where this stands," same spirit as the
          // status-preserving rule above but for this one source type
          // where upstream status is the primary signal, not a
          // one-time seed.
          const rec2 = findBySource('system-challenge', c.id);
          if (rec2 && rec2.status !== (statusMap[c.status] || 'todo')) {
            Items.update(rec2.id, { status: statusMap[c.status] || 'todo' });
          }
        }
        isNew ? added++ : updated++;
      });
    }

    return { added: added, updated: updated };
  }

  function importFromSources() {
    const main = importFromMain();
    const system = importFromSystem();
    storeSet(KEYS.lastSyncedAt, Date.now());
    return {
      added: main.added + system.added,
      updated: main.updated + system.updated
    };
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Items.replaceAll([]);
    Items.add({ title: 'Review today\'s priorities', status: 'todo', priority: 'medium', dueDate: todayISO(), isDailyAction: true, order: 0 });
    Items.add({ title: 'Clear out anything stale', status: 'todo', priority: 'low', order: 1 });
    saveHero({
      eyebrow: 'ONE LIST, EVERY DAY',
      title: 'All Your Tasks.\nOne Place.',
      subtext: 'Native tasks plus everything routine or task-shaped from Main and System, merged into one board you can actually work from each day.',
      ctaLabel: 'VIEW TASKS'
    });
    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Items.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }
  // seedIfEmpty() is deliberately NOT called automatically — same
  // empty-storage seed-race reasoning as every other page in this app:
  // seeding synchronously at script-load time, before initCloudSync()
  // gets a chance to pull real cloud data, can push a freshly-seeded
  // "default" set to Supabase and clobber another device's real data.
  // tasks.html's init() calls it itself, only as a fallback after giving
  // the cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.TasksDbData = {
    KEYS: KEYS,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    TASK_RECURRENCES: TASK_RECURRENCES,
    SOURCE_LABELS: SOURCE_LABELS,
    DAY_LABELS: DAY_LABELS,
    uid: uid,
    todayISO: todayISO,
    formatDateShort: formatDateShort,
    compressImageDataUrl: compressImageDataUrl,
    Items: Items,
    getHero: getHero,
    saveHero: saveHero,
    itemsSorted: itemsSorted,
    nextOrder: nextOrder,
    reorderItems: reorderItems,
    sortTasks: sortTasks,
    spawnNextRecurrence: spawnNextRecurrence,
    importFromSources: importFromSources,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
