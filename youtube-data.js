// youtube-data.js
//
// Data layer for the "YouTube Dashboard" tab inside business.html (Business
// Hub) — mirrors writing-data.js's own structure/conventions one-for-one
// (see that file's own top-of-file note and CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB.
//
// Every key here is prefixed `business:` (NOT a new `youtube:` prefix) so
// business.html's existing initCloudSync({ appKey: 'business',
// syncedPrefixes: ['business:'] }) call covers this file's data
// automatically — no new sync mechanism, no sync.js/topbar.js change, per
// CLAUDE.md's DO NOT MODIFY rule 1. This file is a separate companion
// (mirroring writing-data.js+business.html, household-data.js+
// household.html, etc.) purely for code organization — business-data.js
// itself only gained the one-line 'youtube' layout addition (plus an
// isYoutubeSubpage tab field and an ensureYoutubeDashboardExists(), the same
// two additions the Writing Dashboard's own tab needed).
//
// Deliberately narrower than writing-data.js in a few ways, since a
// Scrivener-style nested Part→Chapter→Scene binder tree (with fractional-
// indexing orderKeys), Plot/Continuity/Character trackers, Composition
// Mode, a Theme Marketplace, and Compile & Export don't have a natural
// YouTube-channel-management equivalent — this was a deliberate scope call,
// not an oversight. What's kept, proportionally: a Network→Channel board
// (mirroring Series→Manuscript) with the same goal/progress-bar/cover-photo
// card, a Tasks Inline Database (template/sub-page tree, identical
// mechanic), a Video Ideas gallery (mirroring WritingIdea), an editable
// landing article, and a "Video Planner" per channel — a flat, reorderable
// (numeric order + swap-adjacent-values, this app's standard non-tree
// convention — no fractional indexing needed since there's no nested tree)
// video list with a 2-panel editor (Script + Video Notes, mirroring the
// Binder's Index Card + Chapter Notes) and a small Channel Targets row.
(function (global) {
  'use strict';

  const BD = global.BusinessData; // reuse uid/date helpers/compression — loaded first

  // ============================================================
  // STORAGE — same honest-save-signal pattern as business-data.js's/
  // writing-data.js's storeSet().
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
    networks: 'business:ytNetworks',
    channels: 'business:ytChannels',
    tasks: 'business:ytTasks',
    videos: 'business:ytVideos',
    ideas: 'business:ytIdeas',
    article: 'business:ytArticle',
    activeView: 'business:ytActiveView',
    activeChannelId: 'business:ytActiveChannelId',
    activeVideoId: 'business:ytActiveVideoId',
    seeded: 'business:ytSeeded'
  };

  function uid(prefix) { return BD.uid(prefix); }
  function todayISO() { return BD.todayISO(); }

  // ============================================================
  // MODELS
  // ============================================================
  const CHANNEL_STATUSES = ['active', 'inactive', 'idea'];
  const VIDEO_STATUSES = ['idea', 'scripting', 'filming', 'editing', 'scheduled', 'published'];
  const TASK_STATUSES = ['todo', 'in-progress', 'done'];
  const TASK_PRIORITIES = ['low', 'medium', 'high'];
  const IDEA_STATUSES = ['spark', 'developing', 'shelved'];
  const ARTICLE_BLOCK_TYPES = ['heading', 'paragraph', 'callout'];
  const CALLOUT_STYLES = ['info', 'tip', 'warning', 'gold'];

  function networkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytn'),
      title: typeof data.title === 'string' ? data.title : 'Untitled Network',
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

  /** @typedef {{id, networkId, title, status, order, niche, contentFormat,
   * uploadFrequency, goalRevenueCents, goalSubscribers, subscriberCurrent,
   * todaysGoalCurrent, todaysGoalTarget, todaysGoalUnit, progressBarColor,
   * coverPhoto, currentVideoId, totalVideosGoal, notes, createdAt}} Channel */
  function channelModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytc'),
      networkId: data.networkId || null,
      title: typeof data.title === 'string' ? data.title : 'Untitled Channel',
      status: CHANNEL_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      order: typeof data.order === 'number' ? data.order : 0,
      niche: typeof data.niche === 'string' ? data.niche : '',
      contentFormat: typeof data.contentFormat === 'string' ? data.contentFormat : '',
      uploadFrequency: typeof data.uploadFrequency === 'string' ? data.uploadFrequency : '',
      goalRevenueCents: typeof data.goalRevenueCents === 'number' ? data.goalRevenueCents : 0,
      goalSubscribers: typeof data.goalSubscribers === 'number' ? data.goalSubscribers : 10000,
      subscriberCurrent: typeof data.subscriberCurrent === 'number' ? data.subscriberCurrent : 0,
      todaysGoalCurrent: typeof data.todaysGoalCurrent === 'number' ? data.todaysGoalCurrent : 0,
      todaysGoalTarget: typeof data.todaysGoalTarget === 'number' ? data.todaysGoalTarget : 3,
      todaysGoalUnit: typeof data.todaysGoalUnit === 'string' ? data.todaysGoalUnit : 'videos scripted',
      progressBarColor: typeof data.progressBarColor === 'string' ? data.progressBarColor : '',
      // Cover/banner photo for this channel's own detail page and its
      // board card — same upload-or-paste-flow shape as every other
      // cover-photo field in this app (a data: URL locally, swapped for a
      // tiny hosted URL once PhotoStore's upload resolves).
      coverPhoto: typeof data.coverPhoto === 'string' ? data.coverPhoto : '',
      currentVideoId: data.currentVideoId || null,
      // Total-published-videos goal, shown in the Video Planner's Channel
      // Targets row — distinct from todaysGoalTarget (a short-term goal).
      totalVideosGoal: typeof data.totalVideosGoal === 'number' ? data.totalVideosGoal : 100,
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

  /** @typedef {{id, channelId, parentTaskId, title, summary, status,
   * priority, dueDate, blocks, collapsed, order, createdAt}} YtTask */
  function ytTaskModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytk'),
      channelId: data.channelId || null,
      parentTaskId: data.parentTaskId || null,
      title: typeof data.title === 'string' ? data.title : '',
      summary: typeof data.summary === 'string' ? data.summary : '',
      status: TASK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: TASK_PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      blocks: Array.isArray(data.blocks) ? data.blocks.map(taskBlockModel) : [],
      // Only meaningful on a template (a root task, parentTaskId: null)
      // that actually has sub-pages — same precedent as WritingTask's own
      // `collapsed` field.
      collapsed: typeof data.collapsed === 'boolean' ? data.collapsed : false,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id, channelId, title, status, order, playlist, publishDate,
   * thumbnail, script, notes, tags, videoUrl, createdAt}} Video
   * A flat, per-channel, reorderable video — deliberately NOT a nested tree
   * like WritingTask's BinderNode (a channel's video list doesn't need
   * Part/Chapter/Scene nesting), so plain numeric `order` +
   * swap-adjacent-values is enough, same convention as every other
   * non-tree reorderable list in this app. `playlist` is a free-text label
   * (not a foreign key), same "label, not a relation" precedent as
   * business-data.js's Content Plan Card `platform` field — a renamed/
   * deleted playlist can never break a video's display. */
  function videoModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytv'),
      channelId: data.channelId || null,
      title: typeof data.title === 'string' ? data.title : 'Untitled Video',
      status: VIDEO_STATUSES.indexOf(data.status) !== -1 ? data.status : 'idea',
      order: typeof data.order === 'number' ? data.order : 0,
      playlist: typeof data.playlist === 'string' ? data.playlist : '',
      publishDate: typeof data.publishDate === 'string' ? data.publishDate : '',
      thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : '',
      // Index-Card equivalent — the video's own script draft.
      script: typeof data.script === 'string' ? data.script : '',
      // Chapter-Notes equivalent — a separate freeform notes field.
      notes: typeof data.notes === 'string' ? data.notes : '',
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** @typedef {{id, title, pitch, tags, status, notes, order, createdAt}} YtIdea */
  function ytIdeaModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytidea'),
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
  // GENERIC COLLECTION CRUD — same makeCollection recipe as business-data.js/
  // writing-data.js.
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

  const Networks = makeCollection(KEYS.networks, networkModel);
  const Channels = makeCollection(KEYS.channels, channelModel);
  const Tasks = makeCollection(KEYS.tasks, ytTaskModel);
  const Videos = makeCollection(KEYS.videos, videoModel);
  const Ideas = makeCollection(KEYS.ideas, ytIdeaModel);

  // ============================================================
  // Numeric order + swap-adjacent-values — same convention/helpers as
  // business-data.js/writing-data.js.
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
  // SELECTORS — Networks / Channels
  // ============================================================
  function networksSorted() { return Networks.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function channelsForNetwork(networkId) {
    return Channels.list().filter(function (c) { return (c.networkId || null) === (networkId || null); }).sort(function (a, b) { return a.order - b.order; });
  }
  function allChannelsSorted() { return Channels.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function moveNetwork(id, dir) {
    const changed = swapOrder(networksSorted(), id, dir);
    if (changed) Networks.replaceAll(Networks.list().map(function (s) { const hit = changed.find(function (c) { return c.id === s.id; }); return hit || s; }));
  }
  function moveChannel(id, dir) {
    const c = Channels.get(id); if (!c) return;
    const changed = swapOrder(channelsForNetwork(c.networkId), id, dir);
    if (changed) Channels.replaceAll(Channels.list().map(function (x) { const hit = changed.find(function (h) { return h.id === x.id; }); return hit || x; }));
  }
  /** Reassigns a channel to a (possibly different) network, appended at the
   * end of that network's list — the cross-group-drop counterpart to
   * moveChannel's within-group swap. */
  function reassignChannelNetwork(channelId, networkId) {
    const target = channelsForNetwork(networkId || null);
    Channels.update(channelId, { networkId: networkId || null, order: nextOrder(target) });
  }
  /** Deleting a Network does not delete its channels — they become
   * Standalone (networkId: null), same null-out-the-reference precedent as
   * writing-data.js's removeSeries()/household-data.js's legion deletion. */
  function removeNetwork(id) {
    Networks.remove(id);
    const orphaned = Channels.list().filter(function (c) { return c.networkId === id; });
    if (orphaned.length) {
      const standalone = channelsForNetwork(null);
      let nextOrd = nextOrder(standalone);
      Channels.replaceAll(Channels.list().map(function (c) {
        if (c.networkId !== id) return c;
        return Object.assign({}, c, { networkId: null, order: nextOrd++ });
      }));
    }
  }
  /** Deleting a channel cascades to everything that only ever exists
   * because that channel does (its tasks and videos) — a YtTask/Video has
   * no meaning without its channel, same precedent as
   * writing-data.js's removeManuscript(). */
  function removeChannel(id) {
    Channels.remove(id);
    Tasks.replaceAll(Tasks.list().filter(function (t) { return t.channelId !== id; }));
    Videos.replaceAll(Videos.list().filter(function (v) { return v.channelId !== id; }));
  }

  // ============================================================
  // Channel note sections — same "generated on demand, editable,
  // reorderable, lives inline on the record" convention as
  // writing-data.js's manuscript notes / business-data.js's Platform
  // sections.
  // ============================================================
  function notesForChannel(id) {
    const c = Channels.get(id); if (!c) return [];
    return (c.notes || []).slice().sort(function (a, b) { return a.order - b.order; });
  }
  function addChannelNote(channelId) {
    const c = Channels.get(channelId); if (!c) return null;
    const notes = (c.notes || []).slice();
    const note = noteSectionModel({ order: nextOrder(notes) });
    notes.push(note);
    Channels.update(channelId, { notes: notes });
    return note;
  }
  function updateChannelNote(channelId, noteId, patch) {
    const c = Channels.get(channelId); if (!c) return;
    const notes = (c.notes || []).map(function (n) { return n.id === noteId ? Object.assign({}, n, patch) : n; });
    Channels.update(channelId, { notes: notes });
  }
  function removeChannelNote(channelId, noteId) {
    const c = Channels.get(channelId); if (!c) return;
    Channels.update(channelId, { notes: (c.notes || []).filter(function (n) { return n.id !== noteId; }) });
  }
  function moveChannelNote(channelId, noteId, dir) {
    const c = Channels.get(channelId); if (!c) return;
    const notes = (c.notes || []).slice().sort(function (a, b) { return a.order - b.order; });
    const changed = swapOrder(notes, noteId, dir);
    if (changed) Channels.update(channelId, { notes: notes });
  }

  // ============================================================
  // SELECTORS — Tasks Inline Database. A "template" is a top-level YtTask
  // (parentTaskId: null) whose children (parentTaskId: its id) are the
  // sub-pages — identical mechanic to writing-data.js's own Tasks Database.
  // ============================================================
  function tasksForChannel(channelId) { return Tasks.list().filter(function (t) { return t.channelId === channelId; }); }
  function rootTasks(channelId) {
    return Tasks.list()
      .filter(function (t) { return !t.parentTaskId && (channelId === undefined || t.channelId === channelId); })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function childTasks(parentTaskId) {
    return Tasks.list().filter(function (t) { return t.parentTaskId === parentTaskId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function taskCountsForChannel(channelId) {
    const all = tasksForChannel(channelId);
    return { total: all.length, completed: all.filter(function (t) { return t.status === 'done'; }).length };
  }
  function moveTask(id, dir) {
    const t = Tasks.get(id); if (!t) return;
    const siblings = t.parentTaskId ? childTasks(t.parentTaskId) : rootTasks(t.channelId || undefined).filter(function (x) { return x.channelId === t.channelId; });
    const changed = swapOrder(siblings, id, dir);
    if (changed) Tasks.replaceAll(Tasks.list().map(function (x) { const hit = changed.find(function (c) { return c.id === x.id; }); return hit || x; }));
  }
  /** Duplicates any page in the Tasks Database — a template (root task) or
   * a single sub-page — with every field carried over exactly as-is, not
   * reset (same precedent/reasoning as writing-data.js's own
   * duplicateWritingTask()). Duplicating a template also duplicates its
   * sub-pages. */
  function duplicateYtTask(taskId) {
    const task = Tasks.get(taskId); if (!task) return null;
    const isTemplate = !task.parentTaskId;
    const siblings = isTemplate ? rootTasks(task.channelId) : childTasks(task.parentTaskId);
    const newTask = Tasks.add({
      channelId: task.channelId, parentTaskId: task.parentTaskId,
      title: task.title + ' (Copy)', summary: task.summary, status: task.status,
      priority: task.priority, dueDate: task.dueDate,
      blocks: (task.blocks || []).map(function (b) { return Object.assign({}, b, { id: uid('blk') }); }),
      order: nextOrder(siblings)
    });
    if (isTemplate) {
      childTasks(task.id).forEach(function (c) {
        Tasks.add({
          channelId: c.channelId, parentTaskId: newTask.id,
          title: c.title, summary: c.summary, status: c.status,
          priority: c.priority, dueDate: c.dueDate,
          blocks: (c.blocks || []).map(function (b) { return Object.assign({}, b, { id: uid('blk') }); }),
          order: c.order
        });
      });
    }
    return newTask;
  }
  function addYtTaskBlock(taskId, type) {
    const task = Tasks.get(taskId); if (!task) return null;
    const blocks = (task.blocks || []).slice();
    const order = blocks.length ? Math.max.apply(null, blocks.map(function (b) { return b.order; })) + 1 : 0;
    const block = taskBlockModel({ type: type, order: order });
    blocks.push(block);
    Tasks.update(taskId, { blocks: blocks });
    return block;
  }
  function updateYtTaskBlock(taskId, blockId, patch) {
    const task = Tasks.get(taskId); if (!task) return;
    const blocks = (task.blocks || []).map(function (b) { return b.id === blockId ? Object.assign({}, b, patch) : b; });
    Tasks.update(taskId, { blocks: blocks });
  }
  function removeYtTaskBlock(taskId, blockId) {
    const task = Tasks.get(taskId); if (!task) return;
    Tasks.update(taskId, { blocks: (task.blocks || []).filter(function (b) { return b.id !== blockId; }) });
  }
  function moveYtTaskBlock(taskId, blockId, dir) {
    const task = Tasks.get(taskId); if (!task) return;
    const blocks = (task.blocks || []).slice().sort(function (a, b) { return a.order - b.order; });
    const changed = swapOrder(blocks, blockId, dir);
    if (changed) Tasks.update(taskId, { blocks: blocks });
  }

  // ============================================================
  // SELECTORS — Videos (Video Planner) — flat, per-channel, numeric order.
  // ============================================================
  function videosForChannel(channelId) {
    return Videos.list().filter(function (v) { return v.channelId === channelId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function addVideo(channelId, title) {
    return Videos.add({ channelId: channelId, title: title || 'New Video', order: nextOrder(videosForChannel(channelId)) });
  }
  function moveVideo(id, dir) {
    const v = Videos.get(id); if (!v) return;
    const changed = swapOrder(videosForChannel(v.channelId), id, dir);
    if (changed) Videos.replaceAll(Videos.list().map(function (x) { const hit = changed.find(function (c) { return c.id === x.id; }); return hit || x; }));
  }
  function removeVideo(id) {
    Videos.remove(id);
    // A channel's currentVideoId pointer shouldn't outlive the video it
    // points at — null it out, same null-out-the-reference precedent used
    // everywhere else in this app (e.g. writing-data.js's removeBinderNode()).
    Channels.list().forEach(function (c) {
      if (c.currentVideoId === id) Channels.update(c.id, { currentVideoId: null });
    });
  }
  /** {total, published} for a channel's Video Planner "Channel Targets"
   * progress bar — deliberately a live count, not a stored number, so it
   * can never drift out of sync with the video list it's summarizing. */
  function channelVideoStats(channelId) {
    const all = videosForChannel(channelId);
    return { total: all.length, published: all.filter(function (v) { return v.status === 'published'; }).length };
  }

  // ============================================================
  // Word count — same plain whitespace-split as writing-data.js's own
  // wordCount(), used for the Video Planner script's live word count.
  // ============================================================
  function wordCount(text) {
    if (!text) return 0;
    const trimmed = String(text).trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  // ============================================================
  // Article (singleton) — the editable intro section above the board,
  // same shape/behavior as writing-data.js's own getArticle()/etc.
  // ============================================================
  function getArticle() {
    const raw = storeGet(KEYS.article);
    if (raw && typeof raw === 'object') {
      return { title: typeof raw.title === 'string' ? raw.title : 'Grow Your Channel in 30 Days', blocks: Array.isArray(raw.blocks) ? raw.blocks.map(articleBlockModel) : [] };
    }
    return { title: 'Grow Your Channel in 30 Days', blocks: [] };
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
  // SEED — mirrors business-data.js's/writing-data.js's own empty-storage
  // seed-race reasoning: NOT called automatically at script-load time.
  // business.html calls seedIfEmpty() itself, only as a fallback after
  // giving the cloud pull a real chance to land (same
  // maybeSeedAfterSyncAttempt() pattern already wired there).
  // ============================================================
  function seedDefault() {
    Networks.replaceAll([]); Channels.replaceAll([]); Tasks.replaceAll([]);
    Videos.replaceAll([]); Ideas.replaceAll([]);
    storeSet(KEYS.article, { title: 'Grow Your Channel in 30 Days', blocks: [
      articleBlockModel({ type: 'heading', text: 'Grow Your Channel in 30 Days', order: 0 }),
      articleBlockModel({ type: 'paragraph', text: 'A day-by-day approach to building real upload momentum: script a small batch of videos up front, film and edit on a fixed cadence, then let the numbers guide what you make next.', order: 1 }),
      articleBlockModel({ type: 'callout', calloutStyle: 'tip', text: "Tip: set a small, sustainable weekly goal on each channel's card below — a consistent upload schedule beats an occasional big push.", order: 2 })
    ] });

    const network1 = Networks.add({ title: 'Main Channels', order: 0, description: 'The channels I actively upload to.' });
    const ch1 = Channels.add({ networkId: network1.id, title: 'The Weekly Breakdown', order: 0, status: 'active', niche: 'Tech Reviews', contentFormat: 'Long-form', uploadFrequency: '2x per week', goalSubscribers: 50000, subscriberCurrent: 12400, todaysGoalCurrent: 1, todaysGoalTarget: 3, todaysGoalUnit: 'videos scripted' });
    Channels.add({ networkId: network1.id, title: 'Weekly Breakdown Shorts', order: 1, status: 'active', contentFormat: 'Shorts', niche: 'Tech Reviews', uploadFrequency: 'Daily', goalSubscribers: 20000, subscriberCurrent: 3100, todaysGoalTarget: 1, todaysGoalUnit: 'shorts edited' });
    Channels.add({ networkId: null, title: 'Standalone: Late Night Builds', order: 0, status: 'idea', niche: 'DIY / Maker', contentFormat: 'Livestreams', uploadFrequency: 'Weekly', todaysGoalTarget: 1, todaysGoalUnit: 'streams planned' });

    const v1 = addVideo(ch1.id, 'Is This the Best Budget Laptop of the Year?');
    Videos.update(v1.id, { status: 'editing', playlist: 'Budget Tech', publishDate: todayISO(), script: 'Cold open — show the laptop, tease the price.\n\nSection 1 — unboxing and first impressions...' });
    Channels.update(ch1.id, { currentVideoId: v1.id });
    const v2 = addVideo(ch1.id, 'I Tried Every Cheap Mechanical Keyboard');
    Videos.update(v2.id, { status: 'scripting' });
    const v3 = addVideo(ch1.id, 'Why Your Wifi Is Actually Slow');
    Videos.update(v3.id, { status: 'published', publishDate: todayISO() });

    Tasks.add({ channelId: ch1.id, title: 'Upload Checklist Template', summary: 'Reusable per-video checklist for this channel.', order: 0 });
    const scriptTask = Tasks.add({ channelId: ch1.id, parentTaskId: null, title: 'Script this week’s video', summary: 'First pass, no editing yet.', status: 'in-progress', order: 1 });
    addYtTaskBlock(scriptTask.id, 'note');

    Ideas.add({ title: 'React to viewers’ desk setups', pitch: 'Submitted photos, ranked and roasted.', tags: ['Series', 'Community'], status: 'spark', order: 0 });

    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Networks.list().length || Channels.list().length || Ideas.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefault();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.YoutubeData = {
    KEYS: KEYS,
    CHANNEL_STATUSES: CHANNEL_STATUSES,
    VIDEO_STATUSES: VIDEO_STATUSES,
    TASK_STATUSES: TASK_STATUSES,
    TASK_PRIORITIES: TASK_PRIORITIES,
    IDEA_STATUSES: IDEA_STATUSES,
    ARTICLE_BLOCK_TYPES: ARTICLE_BLOCK_TYPES,
    CALLOUT_STYLES: CALLOUT_STYLES,
    uid: uid, todayISO: todayISO, wordCount: wordCount,
    Networks: Object.assign({}, Networks, { remove: removeNetwork }),
    Channels: Object.assign({}, Channels, { remove: removeChannel }),
    Tasks: Tasks,
    Videos: Object.assign({}, Videos, { remove: removeVideo }),
    Ideas: Ideas,
    networksSorted: networksSorted,
    channelsForNetwork: channelsForNetwork,
    allChannelsSorted: allChannelsSorted,
    moveNetwork: moveNetwork,
    moveChannel: moveChannel,
    reassignChannelNetwork: reassignChannelNetwork,
    notesForChannel: notesForChannel,
    addChannelNote: addChannelNote,
    updateChannelNote: updateChannelNote,
    removeChannelNote: removeChannelNote,
    moveChannelNote: moveChannelNote,
    tasksForChannel: tasksForChannel,
    rootTasks: rootTasks,
    childTasks: childTasks,
    taskCountsForChannel: taskCountsForChannel,
    moveTask: moveTask,
    duplicateYtTask: duplicateYtTask,
    addYtTaskBlock: addYtTaskBlock,
    updateYtTaskBlock: updateYtTaskBlock,
    removeYtTaskBlock: removeYtTaskBlock,
    moveYtTaskBlock: moveYtTaskBlock,
    videosForChannel: videosForChannel,
    addVideo: addVideo,
    moveVideo: moveVideo,
    channelVideoStats: channelVideoStats,
    getArticle: getArticle,
    saveArticleTitle: saveArticleTitle,
    addArticleBlock: addArticleBlock,
    updateArticleBlock: updateArticleBlock,
    removeArticleBlock: removeArticleBlock,
    moveArticleBlock: moveArticleBlock,
    seedDefault: seedDefault,
    seedIfEmpty: seedIfEmpty
  };
})(window);
