// writing-data.js
//
// Data layer for the "Writing Dashboard" tab inside business.html (Business
// Hub) — see docs/WRITING_DASHBOARD_SPEC.md for the full plan. Same
// conventions as business-data.js/household-data.js/finance-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB.
//
// Every key here is prefixed `business:` (NOT a new `writing:` prefix) so
// business.html's existing initCloudSync({ appKey: 'business',
// syncedPrefixes: ['business:'] }) call covers this file's data
// automatically — no new sync mechanism, no sync.js/topbar.js change, per
// CLAUDE.md's DO NOT MODIFY rule 1. This file is a separate companion
// (mirroring household.html+household-data.js, dreamboard.html+
// dreamboard-data.js, etc.) purely for code organization — business-data.js
// itself only gained the one-line 'writing' layout addition.
//
// Ordering convention, deliberately split (see the plan's own note):
// every flat list here (Series, Manuscript, WritingTask, note sections,
// article blocks, tracker entries) uses this app's existing numeric
// `order` + swap-adjacent-values convention, same as every sibling list in
// business-data.js. BinderNode is the one exception — a real nested tree
// that can be dragged anywhere, so it uses fractional-indexing string keys
// (`orderKey`) instead, scoped to this feature only per CLAUDE.md's own
// note in the Writing Dashboard spec section.
(function (global) {
  'use strict';

  const BD = global.BusinessData; // reuse uid/date helpers/compression — loaded first

  // ============================================================
  // STORAGE — same honest-save-signal pattern as business-data.js's
  // storeSet(): dispatches the same 'business:save' event so business.html's
  // existing sync-status indicator covers this file's writes too, without
  // needing a second indicator.
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
    series: 'business:writingSeries',
    manuscripts: 'business:writingManuscripts',
    tasks: 'business:writingTasks',
    binderNodes: 'business:writingBinderNodes',
    plotThreads: 'business:writingPlotThreads',
    continuityItems: 'business:writingContinuityItems',
    characters: 'business:writingCharacters',
    ideas: 'business:writingIdeas',
    article: 'business:writingArticle',
    theme: 'business:writingTheme',
    dailySnapshot: 'business:writingDailySnapshot',
    activeView: 'business:writingActiveView',
    activeManuscriptId: 'business:writingActiveManuscriptId',
    activeBinderNodeId: 'business:writingActiveBinderNodeId',
    seeded: 'business:writingSeeded'
  };

  function uid(prefix) { return BD.uid(prefix); }
  function todayISO() { return BD.todayISO(); }

  // ============================================================
  // MODELS
  // ============================================================
  const MANUSCRIPT_STATUSES = ['active', 'inactive', 'idea'];
  const BINDER_NODE_TYPES = ['part', 'chapter', 'scene'];
  const TASK_STATUSES = ['todo', 'in-progress', 'done'];
  const TASK_PRIORITIES = ['low', 'medium', 'high'];
  const IDEA_STATUSES = ['spark', 'developing', 'shelved'];
  const CONTINUITY_CATEGORIES = ['place', 'object', 'timeline', 'rule', 'other'];
  const ARTICLE_BLOCK_TYPES = ['heading', 'paragraph', 'callout'];
  const CALLOUT_STYLES = ['info', 'tip', 'warning', 'gold'];

  function seriesModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ser'),
      title: typeof data.title === 'string' ? data.title : 'Untitled Series',
      order: typeof data.order === 'number' ? data.order : 0,
      description: typeof data.description === 'string' ? data.description : '',
      tint: typeof data.tint === 'string' ? data.tint : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function noteSectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      title: typeof data.title === 'string' ? data.title : 'New Section',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id, seriesId, title, kind, status, order, platform, niche,
   * estimatedGrowthDuration, goalRevenueCents, goalProfitCents,
   * todaysGoalCurrent, todaysGoalTarget, todaysGoalUnit, progressBarColor,
   * currentBinderNodeId, notes, createdAt}} Manuscript */
  function manuscriptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ms'),
      seriesId: data.seriesId || null,
      title: typeof data.title === 'string' ? data.title : 'Untitled Manuscript',
      kind: (data.kind === 'idea') ? 'idea' : 'manuscript',
      status: MANUSCRIPT_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      order: typeof data.order === 'number' ? data.order : 0,
      platform: typeof data.platform === 'string' ? data.platform : '',
      niche: typeof data.niche === 'string' ? data.niche : '',
      estimatedGrowthDuration: typeof data.estimatedGrowthDuration === 'string' ? data.estimatedGrowthDuration : '',
      goalRevenueCents: typeof data.goalRevenueCents === 'number' ? data.goalRevenueCents : 0,
      goalProfitCents: typeof data.goalProfitCents === 'number' ? data.goalProfitCents : 0,
      todaysGoalCurrent: typeof data.todaysGoalCurrent === 'number' ? data.todaysGoalCurrent : 0,
      todaysGoalTarget: typeof data.todaysGoalTarget === 'number' ? data.todaysGoalTarget : 1000,
      todaysGoalUnit: typeof data.todaysGoalUnit === 'string' ? data.todaysGoalUnit : 'words',
      progressBarColor: typeof data.progressBarColor === 'string' ? data.progressBarColor : '',
      // A cover photo for this manuscript's own detail page and its
      // board card — same upload-or-paste-flow shape as every other
      // cover-photo field in this app (a data: URL locally, swapped for
      // a tiny hosted URL once PhotoStore's upload resolves).
      coverPhoto: typeof data.coverPhoto === 'string' ? data.coverPhoto : '',
      currentBinderNodeId: data.currentBinderNodeId || null,
      // Entire-manuscript word-count goal, shown in the Binder's Project
      // Targets tracker (Phase 3) — distinct from todaysGoalTarget (the
      // daily writing goal).
      manuscriptWordGoal: typeof data.manuscriptWordGoal === 'number' ? data.manuscriptWordGoal : 100000,
      notes: Array.isArray(data.notes) ? data.notes.map(noteSectionModel) : [],
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function taskBlockModel(data) {
    data = data || {};
    return {
      id: data.id || uid('blk'),
      type: data.type === 'code' ? 'code' : 'note',
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      language: typeof data.language === 'string' ? data.language : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id, manuscriptId, parentTaskId, title, summary, status,
   * priority, dueDate, blocks, collapsed, order, createdAt}} WritingTask */
  function writingTaskModel(data) {
    data = data || {};
    return {
      id: data.id || uid('wtk'),
      manuscriptId: data.manuscriptId || null,
      parentTaskId: data.parentTaskId || null,
      title: typeof data.title === 'string' ? data.title : '',
      summary: typeof data.summary === 'string' ? data.summary : '',
      status: TASK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: TASK_PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      blocks: Array.isArray(data.blocks) ? data.blocks.map(taskBlockModel) : [],
      // Only meaningful on a template (a root task, parentTaskId: null)
      // that actually has sub-pages — toggles whether its children render
      // in the Tasks Database table below it. Harmless/unused on a
      // sub-page itself, same "field exists on the model, only read in
      // the one place it applies" precedent as WorkflowWeek.collapsed.
      collapsed: typeof data.collapsed === 'boolean' ? data.collapsed : false,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id, manuscriptId, parentId, type, title, orderKey, content,
   * chapterNotes, wordGoal, createdAt}} BinderNode */
  function binderNodeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('bn'),
      manuscriptId: data.manuscriptId || null,
      parentId: data.parentId || null,
      type: BINDER_NODE_TYPES.indexOf(data.type) !== -1 ? data.type : 'chapter',
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      orderKey: typeof data.orderKey === 'string' ? data.orderKey : 'm',
      content: typeof data.content === 'string' ? data.content : '',
      chapterNotes: typeof data.chapterNotes === 'string' ? data.chapterNotes : '',
      wordGoal: typeof data.wordGoal === 'number' ? data.wordGoal : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function mentionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mnt'),
      nodeId: data.nodeId || null,
      snippet: typeof data.snippet === 'string' ? data.snippet : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function trackerModelBase(data, extra) {
    data = data || {};
    return Object.assign({
      id: data.id || uid('trk'),
      manuscriptId: data.manuscriptId || null,
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      mentions: Array.isArray(data.mentions) ? data.mentions.map(mentionModel) : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    }, extra || {});
  }
  function plotThreadModel(data) { return trackerModelBase(data, { colorTag: typeof (data || {}).colorTag === 'string' ? data.colorTag : '' }); }
  function continuityItemModel(data) {
    data = data || {};
    return trackerModelBase(data, { category: CONTINUITY_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'other' });
  }
  function characterModel(data) {
    data = data || {};
    const base = trackerModelBase(data, { bio: typeof data.bio === 'string' ? data.bio : '', traits: typeof data.traits === 'string' ? data.traits : '' });
    delete base.description; // characters use bio/traits instead of a generic description
    return base;
  }

  /** @typedef {{id, title, pitch, tags, status, notes, order, createdAt}} WritingIdea */
  function writingIdeaModel(data) {
    data = data || {};
    return {
      id: data.id || uid('idea'),
      title: typeof data.title === 'string' ? data.title : 'Untitled Idea',
      pitch: typeof data.pitch === 'string' ? data.pitch : '',
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      status: IDEA_STATUSES.indexOf(data.status) !== -1 ? data.status : 'spark',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function articleBlockModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ab'),
      type: ARTICLE_BLOCK_TYPES.indexOf(data.type) !== -1 ? data.type : 'paragraph',
      calloutStyle: CALLOUT_STYLES.indexOf(data.calloutStyle) !== -1 ? data.calloutStyle : 'gold',
      text: typeof data.text === 'string' ? data.text : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as business-data.js
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) { const record = model(data); const all = list(); all.push(record); storeSet(key, all); return record; }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) { const all = list(); const next = all.filter(function (x) { return x.id !== id; }); storeSet(key, next); return next.length !== all.length; }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const Series = makeCollection(KEYS.series, seriesModel);
  const Manuscripts = makeCollection(KEYS.manuscripts, manuscriptModel);
  const Tasks = makeCollection(KEYS.tasks, writingTaskModel);
  const BinderNodes = makeCollection(KEYS.binderNodes, binderNodeModel);
  const PlotThreads = makeCollection(KEYS.plotThreads, plotThreadModel);
  const ContinuityItems = makeCollection(KEYS.continuityItems, continuityItemModel);
  const Characters = makeCollection(KEYS.characters, characterModel);
  const Ideas = makeCollection(KEYS.ideas, writingIdeaModel);

  // ============================================================
  // Numeric order + swap-adjacent-values — same convention/helpers as
  // business-data.js, copied here so this file has no hard dependency on
  // BusinessData internals beyond the small shared utility functions.
  // ============================================================
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function swapOrder(list, id, dir) {
    const idx = list.findIndex(function (x) { return x.id === id; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= list.length) return null;
    const a = list[idx], b = list[otherIdx];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    return [a, b];
  }

  // ============================================================
  // SELECTORS — Series / Manuscripts
  // ============================================================
  function seriesSorted() { return Series.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function manuscriptsForSeries(seriesId) {
    return Manuscripts.list().filter(function (m) { return (m.seriesId || null) === (seriesId || null); }).sort(function (a, b) { return a.order - b.order; });
  }
  function allManuscriptsSorted() { return Manuscripts.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function moveSeries(id, dir) {
    const changed = swapOrder(seriesSorted(), id, dir);
    if (changed) Series.replaceAll(Series.list().map(function (s) { const hit = changed.find(function (c) { return c.id === s.id; }); return hit || s; }));
  }
  function moveManuscript(id, dir) {
    const m = Manuscripts.get(id); if (!m) return;
    const changed = swapOrder(manuscriptsForSeries(m.seriesId), id, dir);
    if (changed) Manuscripts.replaceAll(Manuscripts.list().map(function (x) { const hit = changed.find(function (c) { return c.id === x.id; }); return hit || x; }));
  }
  /** Reassigns a manuscript to a (possibly different) series, appended at
   * the end of that series' list — the cross-group-drop counterpart to
   * moveManuscript's within-group swap. */
  function reassignManuscriptSeries(manuscriptId, seriesId) {
    const target = manuscriptsForSeries(seriesId || null);
    Manuscripts.update(manuscriptId, { seriesId: seriesId || null, order: nextOrder(target) });
  }
  /** Deleting a Series does not delete its manuscripts — they become
   * Standalone (seriesId: null), same null-out-the-reference precedent as
   * household-data.js's legion deletion / business-data.js's week/day
   * Task-link cleanup, since a manuscript shouldn't vanish just because
   * its series grouping was reorganized. */
  function removeSeries(id) {
    Series.remove(id);
    const orphaned = Manuscripts.list().filter(function (m) { return m.seriesId === id; });
    if (orphaned.length) {
      const standalone = manuscriptsForSeries(null);
      let nextOrd = nextOrder(standalone);
      Manuscripts.replaceAll(Manuscripts.list().map(function (m) {
        if (m.seriesId !== id) return m;
        return Object.assign({}, m, { seriesId: null, order: nextOrd++ });
      }));
    }
  }
  /** Deleting a manuscript cascades to everything that only ever exists
   * because that manuscript does (its tasks, binder tree, trackers) — this
   * is different from the Series/manuscript relationship above, since a
   * WritingTask/BinderNode/tracker entry has no meaning without its
   * manuscript. */
  function removeManuscript(id) {
    Manuscripts.remove(id);
    Tasks.replaceAll(Tasks.list().filter(function (t) { return t.manuscriptId !== id; }));
    BinderNodes.replaceAll(BinderNodes.list().filter(function (n) { return n.manuscriptId !== id; }));
    PlotThreads.replaceAll(PlotThreads.list().filter(function (t) { return t.manuscriptId !== id; }));
    ContinuityItems.replaceAll(ContinuityItems.list().filter(function (t) { return t.manuscriptId !== id; }));
    Characters.replaceAll(Characters.list().filter(function (t) { return t.manuscriptId !== id; }));
  }

  // ============================================================
  // Manuscript note sections — same "generated on demand, editable,
  // reorderable, lives inline on the record" convention as
  // business-data.js's Platform sections / WorkflowDay blocks.
  // ============================================================
  function notesForManuscript(id) {
    const m = Manuscripts.get(id); if (!m) return [];
    return (m.notes || []).slice().sort(function (a, b) { return a.order - b.order; });
  }
  function addManuscriptNote(manuscriptId) {
    const m = Manuscripts.get(manuscriptId); if (!m) return null;
    const notes = (m.notes || []).slice();
    const note = noteSectionModel({ order: nextOrder(notes) });
    notes.push(note);
    Manuscripts.update(manuscriptId, { notes: notes });
    return note;
  }
  function updateManuscriptNote(manuscriptId, noteId, patch) {
    const m = Manuscripts.get(manuscriptId); if (!m) return;
    const notes = (m.notes || []).map(function (n) { return n.id === noteId ? Object.assign({}, n, patch) : n; });
    Manuscripts.update(manuscriptId, { notes: notes });
  }
  function removeManuscriptNote(manuscriptId, noteId) {
    const m = Manuscripts.get(manuscriptId); if (!m) return;
    Manuscripts.update(manuscriptId, { notes: (m.notes || []).filter(function (n) { return n.id !== noteId; }) });
  }
  function moveManuscriptNote(manuscriptId, noteId, dir) {
    const m = Manuscripts.get(manuscriptId); if (!m) return;
    const notes = (m.notes || []).slice().sort(function (a, b) { return a.order - b.order; });
    const changed = swapOrder(notes, noteId, dir);
    if (changed) Manuscripts.update(manuscriptId, { notes: notes });
  }

  // ============================================================
  // SELECTORS — Writing Tasks (Tasks Inline Database — Phase 2). A
  // "template" is just a top-level WritingTask (parentTaskId: null) whose
  // children (parentTaskId: its id) are the sub-pages.
  // ============================================================
  function tasksForManuscript(manuscriptId) { return Tasks.list().filter(function (t) { return t.manuscriptId === manuscriptId; }); }
  function rootTasks(manuscriptId) {
    return Tasks.list()
      .filter(function (t) { return !t.parentTaskId && (manuscriptId === undefined || t.manuscriptId === manuscriptId); })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function childTasks(parentTaskId) {
    return Tasks.list().filter(function (t) { return t.parentTaskId === parentTaskId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function taskCountsForManuscript(manuscriptId) {
    const all = tasksForManuscript(manuscriptId);
    return { total: all.length, completed: all.filter(function (t) { return t.status === 'done'; }).length };
  }
  function moveTask(id, dir) {
    const t = Tasks.get(id); if (!t) return;
    const siblings = t.parentTaskId ? childTasks(t.parentTaskId) : rootTasks(t.manuscriptId || undefined).filter(function (x) { return x.manuscriptId === t.manuscriptId; });
    const changed = swapOrder(siblings, id, dir);
    if (changed) Tasks.replaceAll(Tasks.list().map(function (x) { const hit = changed.find(function (c) { return c.id === x.id; }); return hit || x; }));
  }
  /** Duplicates any page in the Tasks Database — a template (root task)
   * or a single sub-page — with every field (status/priority/dueDate/
   * summary/blocks) carried over exactly as-is, not reset. Deliberately
   * different from duplicateWorkflowWeek()/duplicateWorkflowDay()'s own
   * "reset to Not started/unchecked" precedent (business-data.js) — this
   * one was explicitly asked to keep "all of its content intact", so
   * nothing about the copy's progress is cleared. Duplicating a template
   * also duplicates its sub-pages (same "duplicating a parent brings its
   * children along" precedent as duplicateWorkflowWeek), each one
   * appended under the new template with its title unchanged, matching
   * how a duplicated week's real days keep their own titles too — only
   * the directly-duplicated page itself (the template, or a standalone
   * sub-page duplicated on its own) gets a " (Copy)" suffix. */
  function duplicateWritingTask(taskId) {
    const task = Tasks.get(taskId); if (!task) return null;
    const isTemplate = !task.parentTaskId;
    const siblings = isTemplate ? rootTasks(task.manuscriptId) : childTasks(task.parentTaskId);
    const newTask = Tasks.add({
      manuscriptId: task.manuscriptId, parentTaskId: task.parentTaskId,
      title: task.title + ' (Copy)', summary: task.summary, status: task.status,
      priority: task.priority, dueDate: task.dueDate,
      blocks: (task.blocks || []).map(function (b) { return Object.assign({}, b, { id: uid('blk') }); }),
      order: nextOrder(siblings)
    });
    if (isTemplate) {
      childTasks(task.id).forEach(function (c) {
        Tasks.add({
          manuscriptId: c.manuscriptId, parentTaskId: newTask.id,
          title: c.title, summary: c.summary, status: c.status,
          priority: c.priority, dueDate: c.dueDate,
          blocks: (c.blocks || []).map(function (b) { return Object.assign({}, b, { id: uid('blk') }); }),
          order: c.order
        });
      });
    }
    return newTask;
  }
  function addWritingTaskBlock(taskId, type) {
    const task = Tasks.get(taskId); if (!task) return null;
    const blocks = (task.blocks || []).slice();
    const order = blocks.length ? Math.max.apply(null, blocks.map(function (b) { return b.order; })) + 1 : 0;
    const block = taskBlockModel({ type: type, order: order });
    blocks.push(block);
    Tasks.update(taskId, { blocks: blocks });
    return block;
  }
  function updateWritingTaskBlock(taskId, blockId, patch) {
    const task = Tasks.get(taskId); if (!task) return;
    const blocks = (task.blocks || []).map(function (b) { return b.id === blockId ? Object.assign({}, b, patch) : b; });
    Tasks.update(taskId, { blocks: blocks });
  }
  function removeWritingTaskBlock(taskId, blockId) {
    const task = Tasks.get(taskId); if (!task) return;
    Tasks.update(taskId, { blocks: (task.blocks || []).filter(function (b) { return b.id !== blockId; }) });
  }
  function moveWritingTaskBlock(taskId, blockId, dir) {
    const task = Tasks.get(taskId); if (!task) return;
    const blocks = (task.blocks || []).slice().sort(function (a, b) { return a.order - b.order; });
    const changed = swapOrder(blocks, blockId, dir);
    if (changed) Tasks.update(taskId, { blocks: blocks });
  }

  // ============================================================
  // FRACTIONAL INDEXING — BinderNode.orderKey only (see this file's own
  // top-of-file note on why this list alone departs from the numeric-order
  // convention). Self-contained base-36 midpoint generator, no external
  // dependency. Keys sort correctly as plain strings.
  // ============================================================
  const KEY_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  function midKey(a, b) {
    a = a || ''; b = b || '';
    let result = '';
    let i = 0;
    while (true) {
      const ca = i < a.length ? KEY_ALPHABET.indexOf(a[i]) : 0;
      const cb = (b && i < b.length) ? KEY_ALPHABET.indexOf(b[i]) : (b ? -1 : KEY_ALPHABET.length);
      if (cb === -1) { // a's char at this position, b has run out — descend using a's remainder
        result += a[i]; i++; continue;
      }
      if (cb - ca > 1) {
        const mid = Math.floor((ca + cb) / 2);
        result += KEY_ALPHABET[mid];
        return result;
      }
      if (cb - ca === 1) { result += a[i] || '0'; i++; continue; }
      // ca === cb — same char, carry to next position
      result += KEY_ALPHABET[ca]; i++;
    }
  }
  function generateKeyAfter(existingKeysSorted) {
    if (!existingKeysSorted.length) return 'm';
    const last = existingKeysSorted[existingKeysSorted.length - 1];
    return midKey(last, '');
  }

  function binderChildren(manuscriptId, parentId) {
    return BinderNodes.list()
      .filter(function (n) { return n.manuscriptId === manuscriptId && (n.parentId || null) === (parentId || null); })
      .sort(function (a, b) { return a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0; });
  }
  function binderNodesForManuscript(manuscriptId) {
    return BinderNodes.list().filter(function (n) { return n.manuscriptId === manuscriptId; });
  }
  /** Flattens the binder tree into document order (depth-first, respecting
   * orderKey at each level) — used by word-count totals and Compile. */
  function flattenBinderTree(manuscriptId) {
    const out = [];
    function walk(parentId, depth) {
      binderChildren(manuscriptId, parentId).forEach(function (node) {
        out.push({ node: node, depth: depth });
        walk(node.id, depth + 1);
      });
    }
    walk(null, 0);
    return out;
  }
  function addBinderNode(manuscriptId, parentId, type, title) {
    const siblingKeys = binderChildren(manuscriptId, parentId).map(function (n) { return n.orderKey; });
    const orderKey = generateKeyAfter(siblingKeys);
    return BinderNodes.add({ manuscriptId: manuscriptId, parentId: parentId || null, type: type, title: title || 'Untitled', orderKey: orderKey });
  }
  /** Moves a node to a new parent/position — dropping "onto" a node passes
   * that node's id as newParentId (nest as child, appended last); dropping
   * "between" two siblings passes their shared parentId plus the
   * beforeNodeId to insert ahead of (null = append at the end). */
  function moveBinderNode(nodeId, newParentId, beforeNodeId) {
    const node = BinderNodes.get(nodeId); if (!node) return;
    if (newParentId === nodeId) return; // can't nest a node inside itself
    const siblings = binderChildren(node.manuscriptId, newParentId).filter(function (n) { return n.id !== nodeId; });
    let orderKey;
    if (!siblings.length) orderKey = 'm';
    else if (beforeNodeId == null) orderKey = midKey(siblings[siblings.length - 1].orderKey, '');
    else {
      const idx = siblings.findIndex(function (n) { return n.id === beforeNodeId; });
      if (idx === -1) orderKey = midKey(siblings[siblings.length - 1].orderKey, '');
      else orderKey = midKey(idx > 0 ? siblings[idx - 1].orderKey : '', siblings[idx].orderKey);
    }
    BinderNodes.update(nodeId, { parentId: newParentId || null, orderKey: orderKey });
  }
  function removeBinderNode(id) {
    const toDelete = [id];
    let frontier = [id];
    while (frontier.length) {
      const next = BinderNodes.list().filter(function (n) { return frontier.indexOf(n.parentId) !== -1; }).map(function (n) { return n.id; });
      toDelete.push.apply(toDelete, next);
      frontier = next;
    }
    BinderNodes.replaceAll(BinderNodes.list().filter(function (n) { return toDelete.indexOf(n.id) === -1; }));
    // A manuscript's currentBinderNodeId pointer shouldn't outlive the node
    // it points at — null it out, same null-out-the-reference precedent
    // used everywhere else in this app.
    Manuscripts.list().forEach(function (m) {
      if (toDelete.indexOf(m.currentBinderNodeId) !== -1) Manuscripts.update(m.id, { currentBinderNodeId: null });
    });
  }

  // ============================================================
  // Word counts — plain whitespace-split, no library, consistent with this
  // app's other hand-rolled counters (e.g. gym.html's set/volume math).
  // ============================================================
  function wordCount(text) {
    if (!text) return 0;
    const trimmed = String(text).trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }
  function manuscriptTotalWordCount(manuscriptId) {
    return binderNodesForManuscript(manuscriptId).reduce(function (sum, n) { return sum + wordCount(n.content); }, 0);
  }
  /** "Words written today," derived from a once-per-day snapshot rather
   * than a full revision history — a documented simplification (this app
   * has no per-keystroke change log anywhere), same spirit as the
   * burndown chart's fixed-scope assumption elsewhere in this codebase. */
  function wordsWrittenToday(manuscriptId) {
    const all = storeGet(KEYS.dailySnapshot) || {};
    const today = todayISO();
    const currentTotal = manuscriptTotalWordCount(manuscriptId);
    const snap = all[manuscriptId];
    if (!snap || snap.date !== today) {
      all[manuscriptId] = { date: today, wordCount: currentTotal };
      storeSet(KEYS.dailySnapshot, all);
      return 0;
    }
    return Math.max(0, currentTotal - snap.wordCount);
  }

  // ============================================================
  // Trackers (Plot Threads / Continuity / Characters) — the confirmed
  // "auto-fill" mechanism: tag a selection while writing (addMention,
  // called directly from the Index Card's selection-tag button), or scan
  // a chapter's full text for any tracker name already on record
  // (scanChapterForMentions) and log a mention for each hit not already
  // present for that node — both without any LLM/NLP dependency.
  // ============================================================
  function trackersOfKind(kind) { return kind === 'plot' ? PlotThreads : kind === 'continuity' ? ContinuityItems : Characters; }
  function trackersForManuscript(kind, manuscriptId) {
    return trackersOfKind(kind).list().filter(function (t) { return t.manuscriptId === manuscriptId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function addMention(kind, trackerId, nodeId, snippet) {
    const coll = trackersOfKind(kind);
    const t = coll.get(trackerId); if (!t) return null;
    const already = (t.mentions || []).some(function (m) { return m.nodeId === nodeId && m.snippet === snippet; });
    if (already) return null;
    const mention = mentionModel({ nodeId: nodeId, snippet: snippet });
    coll.update(trackerId, { mentions: (t.mentions || []).concat([mention]) });
    return mention;
  }
  function removeMention(kind, trackerId, mentionId) {
    const coll = trackersOfKind(kind);
    const t = coll.get(trackerId); if (!t) return;
    coll.update(trackerId, { mentions: (t.mentions || []).filter(function (m) { return m.id !== mentionId; }) });
  }
  /** Scans `content` for every existing tracker name (case-insensitive
   * substring match) across all three kinds, for this manuscript, and logs
   * one mention per hit not already recorded against this node. Returns
   * the number of new mentions added. */
  function scanChapterForMentions(manuscriptId, nodeId, content) {
    if (!content) return 0;
    const lower = content.toLowerCase();
    let added = 0;
    ['plot', 'continuity', 'character'].forEach(function (kind) {
      trackersForManuscript(kind, manuscriptId).forEach(function (t) {
        if (!t.name) return;
        const needle = t.name.toLowerCase();
        if (lower.indexOf(needle) === -1) return;
        const alreadyForNode = (t.mentions || []).some(function (m) { return m.nodeId === nodeId; });
        if (alreadyForNode) return;
        const idx = lower.indexOf(needle);
        const snippetStart = Math.max(0, idx - 30);
        const snippet = content.slice(snippetStart, idx + needle.length + 30).trim();
        addMention(kind, t.id, nodeId, snippet);
        added++;
      });
    });
    return added;
  }

  // ============================================================
  // Article (singleton) — the editable "Your Novel in 30 Days" section
  // above the board.
  // ============================================================
  function getArticle() {
    const raw = storeGet(KEYS.article);
    if (raw && typeof raw === 'object') {
      return { title: typeof raw.title === 'string' ? raw.title : 'Your Novel in 30 Days', blocks: Array.isArray(raw.blocks) ? raw.blocks.map(articleBlockModel) : [] };
    }
    return { title: 'Your Novel in 30 Days', blocks: [] };
  }
  function saveArticleTitle(title) { const a = getArticle(); a.title = title; storeSet(KEYS.article, a); }
  function addArticleBlock(type) {
    const a = getArticle();
    const order = a.blocks.length ? Math.max.apply(null, a.blocks.map(function (b) { return b.order; })) + 1 : 0;
    const block = articleBlockModel({ type: type, order: order });
    a.blocks.push(block);
    storeSet(KEYS.article, a);
    return block;
  }
  function updateArticleBlock(blockId, patch) {
    const a = getArticle();
    a.blocks = a.blocks.map(function (b) { return b.id === blockId ? Object.assign({}, b, patch) : b; });
    storeSet(KEYS.article, a);
  }
  function removeArticleBlock(blockId) {
    const a = getArticle();
    a.blocks = a.blocks.filter(function (b) { return b.id !== blockId; });
    storeSet(KEYS.article, a);
  }
  function moveArticleBlock(blockId, dir) {
    const a = getArticle();
    a.blocks.sort(function (x, y) { return x.order - y.order; });
    const changed = swapOrder(a.blocks, blockId, dir);
    if (changed) storeSet(KEYS.article, a);
  }

  // ============================================================
  // Theme Marketplace — built-in presets are plain data (not hardcoded
  // CSS in business.html); applying one sets a small `--wr-*` token set
  // inline on #bhWritingDashboard only, so it can never affect the other
  // four Business Hub tabs or any other page.
  // ============================================================
  const BUILTIN_THEMES = [
    { id: 'midnight-gold', name: 'Midnight Gold', tokens: { bg: '#0d0b08', card: 'rgba(255,255,255,0.08)', accent: '#c9a876', text: '#f1ece2', font: "'Cormorant Garamond', serif", radius: '14px', bgPhoto: '' } },
    { id: 'parchment-ink', name: 'Parchment & Ink', tokens: { bg: '#2a2118', card: 'rgba(255,246,224,0.07)', accent: '#d8b878', text: '#f3e9d6', font: "Georgia, serif", radius: '10px', bgPhoto: '' } },
    { id: 'moonlit-lavender', name: 'Moonlit Lavender', tokens: { bg: '#12101c', card: 'rgba(216,196,255,0.08)', accent: '#b9a6ec', text: '#ece8fb', font: "'Cormorant Garamond', serif", radius: '16px', bgPhoto: '' } },
    { id: 'forest-study', name: 'Forest Study', tokens: { bg: '#0c1712', card: 'rgba(200,255,220,0.06)', accent: '#8fcf9f', text: '#e6f2e8', font: "Georgia, serif", radius: '12px', bgPhoto: '' } },
    { id: 'neon-draft', name: 'Neon Draft', tokens: { bg: '#0a0a12', card: 'rgba(120,220,255,0.08)', accent: '#5fd0ff', text: '#eaf7ff', font: "Inter, sans-serif", radius: '8px', bgPhoto: '' } }
  ];
  function getTheme() {
    const raw = storeGet(KEYS.theme);
    if (raw && typeof raw === 'object') {
      return { activeThemeId: typeof raw.activeThemeId === 'string' ? raw.activeThemeId : 'midnight-gold', customThemes: Array.isArray(raw.customThemes) ? raw.customThemes : [] };
    }
    return { activeThemeId: 'midnight-gold', customThemes: [] };
  }
  function saveTheme(theme) { storeSet(KEYS.theme, theme); }
  function allThemes() { return BUILTIN_THEMES.concat(getTheme().customThemes); }
  function activeThemeTokens() {
    const t = getTheme();
    const found = allThemes().find(function (x) { return x.id === t.activeThemeId; });
    return (found || BUILTIN_THEMES[0]).tokens;
  }
  function saveCustomTheme(theme) {
    const t = getTheme();
    const idx = t.customThemes.findIndex(function (x) { return x.id === theme.id; });
    if (idx === -1) t.customThemes.push(theme); else t.customThemes[idx] = theme;
    saveTheme(t);
  }
  function removeCustomTheme(id) {
    const t = getTheme();
    t.customThemes = t.customThemes.filter(function (x) { return x.id !== id; });
    if (t.activeThemeId === id) t.activeThemeId = 'midnight-gold';
    saveTheme(t);
  }
  function setActiveTheme(id) { const t = getTheme(); t.activeThemeId = id; saveTheme(t); }

  // ============================================================
  // SEED — mirrors business-data.js's own empty-storage seed-race
  // reasoning: NOT called automatically at script-load time. business.html
  // calls seedIfEmpty() itself, only as a fallback after giving the cloud
  // pull a real chance to land (same maybeSeedAfterSyncAttempt() pattern
  // already wired there for the rest of Business Hub).
  // ============================================================
  function seedDefault() {
    Series.replaceAll([]); Manuscripts.replaceAll([]); Tasks.replaceAll([]);
    BinderNodes.replaceAll([]); PlotThreads.replaceAll([]); ContinuityItems.replaceAll([]);
    Characters.replaceAll([]); Ideas.replaceAll([]);
    storeSet(KEYS.article, { title: 'Your Novel in 30 Days', blocks: [
      articleBlockModel({ type: 'heading', text: 'Your Novel in 30 Days', order: 0 }),
      articleBlockModel({ type: 'paragraph', text: 'A day-by-day approach to drafting a full manuscript in a month: outline the shape first, then write forward without editing, and let revision wait until the draft is done.', order: 1 }),
      articleBlockModel({ type: 'callout', calloutStyle: 'tip', text: "Tip: set a small, sustainable daily word goal on each manuscript's card below — consistency beats big single-day pushes.", order: 2 })
    ] });

    const series1 = Series.add({ title: 'The Ashfall Trilogy', order: 0, description: 'A three-book fantasy series.' });
    const ms1 = Manuscripts.add({ seriesId: series1.id, title: 'Book One: Ember', order: 0, status: 'active', platform: 'Amazon KDP', niche: 'Epic Fantasy', estimatedGrowthDuration: '6-12 months', goalRevenueCents: 500000, goalProfitCents: 350000, todaysGoalCurrent: 0, todaysGoalTarget: 1000 });
    Manuscripts.add({ seriesId: series1.id, title: 'Book Two: Cinder', order: 1, status: 'idea', platform: 'Amazon KDP', niche: 'Epic Fantasy', todaysGoalTarget: 1000 });
    Manuscripts.add({ seriesId: series1.id, title: 'Book Three: Ash', order: 2, status: 'idea', platform: 'Amazon KDP', niche: 'Epic Fantasy', todaysGoalTarget: 1000 });
    Manuscripts.add({ seriesId: null, title: 'Standalone: The Last Signal', order: 0, status: 'inactive', platform: 'Wattpad', niche: 'Sci-Fi', todaysGoalTarget: 750 });

    const part1 = addBinderNode(ms1.id, null, 'part', 'Part I');
    const ch1 = addBinderNode(ms1.id, part1.id, 'chapter', 'Chapter 1');
    addBinderNode(ms1.id, part1.id, 'chapter', 'Chapter 2');
    Manuscripts.update(ms1.id, { currentBinderNodeId: ch1.id });

    PlotThreads.add({ manuscriptId: ms1.id, name: 'The Missing Signet', description: 'Who took the family signet ring, and why?', order: 0 });
    Characters.add({ manuscriptId: ms1.id, name: 'Kira Ashvane', bio: 'Our protagonist — exiled heir to the Ashvane line.', order: 0 });
    ContinuityItems.add({ manuscriptId: ms1.id, name: 'The Grey Keep', category: 'place', description: 'The ancestral fortress, currently under siege.', order: 0 });

    Tasks.add({ manuscriptId: ms1.id, title: 'Outline Template', summary: 'Reusable chapter-outline template for this series.', order: 0 });
    const draftDay = Tasks.add({ manuscriptId: ms1.id, parentTaskId: null, title: 'Draft Chapter 1', summary: 'First pass, no editing.', status: 'in-progress', order: 1 });
    addWritingTaskBlock(draftDay.id, 'note');

    Ideas.add({ title: 'A locked-room mystery set on a generation ship', pitch: 'Everyone is a suspect; no one can leave.', tags: ['Sci-Fi', 'Mystery'], status: 'spark', order: 0 });

    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Series.list().length || Manuscripts.list().length || Ideas.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefault();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.WritingData = {
    KEYS: KEYS,
    MANUSCRIPT_STATUSES: MANUSCRIPT_STATUSES,
    BINDER_NODE_TYPES: BINDER_NODE_TYPES,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    IDEA_STATUSES: IDEA_STATUSES,
    CONTINUITY_CATEGORIES: CONTINUITY_CATEGORIES,
    ARTICLE_BLOCK_TYPES: ARTICLE_BLOCK_TYPES,
    CALLOUT_STYLES: CALLOUT_STYLES,
    BUILTIN_THEMES: BUILTIN_THEMES,
    uid: uid, todayISO: todayISO, wordCount: wordCount,
    Series: Object.assign({}, Series, { remove: removeSeries }),
    Manuscripts: Object.assign({}, Manuscripts, { remove: removeManuscript }),
    Tasks: Tasks,
    BinderNodes: Object.assign({}, BinderNodes, { remove: removeBinderNode }),
    PlotThreads: PlotThreads, ContinuityItems: ContinuityItems, Characters: Characters,
    Ideas: Ideas,
    seriesSorted: seriesSorted,
    manuscriptsForSeries: manuscriptsForSeries,
    allManuscriptsSorted: allManuscriptsSorted,
    moveSeries: moveSeries,
    moveManuscript: moveManuscript,
    reassignManuscriptSeries: reassignManuscriptSeries,
    notesForManuscript: notesForManuscript,
    addManuscriptNote: addManuscriptNote,
    updateManuscriptNote: updateManuscriptNote,
    removeManuscriptNote: removeManuscriptNote,
    moveManuscriptNote: moveManuscriptNote,
    tasksForManuscript: tasksForManuscript,
    rootTasks: rootTasks,
    childTasks: childTasks,
    taskCountsForManuscript: taskCountsForManuscript,
    moveTask: moveTask,
    duplicateWritingTask: duplicateWritingTask,
    addWritingTaskBlock: addWritingTaskBlock,
    updateWritingTaskBlock: updateWritingTaskBlock,
    removeWritingTaskBlock: removeWritingTaskBlock,
    moveWritingTaskBlock: moveWritingTaskBlock,
    midKey: midKey,
    binderChildren: binderChildren,
    binderNodesForManuscript: binderNodesForManuscript,
    flattenBinderTree: flattenBinderTree,
    addBinderNode: addBinderNode,
    moveBinderNode: moveBinderNode,
    manuscriptTotalWordCount: manuscriptTotalWordCount,
    wordsWrittenToday: wordsWrittenToday,
    trackersForManuscript: trackersForManuscript,
    addMention: addMention,
    removeMention: removeMention,
    scanChapterForMentions: scanChapterForMentions,
    getArticle: getArticle,
    saveArticleTitle: saveArticleTitle,
    addArticleBlock: addArticleBlock,
    updateArticleBlock: updateArticleBlock,
    removeArticleBlock: removeArticleBlock,
    moveArticleBlock: moveArticleBlock,
    getTheme: getTheme,
    allThemes: allThemes,
    activeThemeTokens: activeThemeTokens,
    saveCustomTheme: saveCustomTheme,
    removeCustomTheme: removeCustomTheme,
    setActiveTheme: setActiveTheme,
    seedDefault: seedDefault,
    seedIfEmpty: seedIfEmpty
  };
})(window);
