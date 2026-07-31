// businessdash-data.js
//
// Data layer for businessdash.html ("Business Dashboard") — a gallery of
// businesses, each opening into its own front page with a Writing
// Dashboard (series/manuscripts/Scrivener-style binder), a generatable
// YouTube Dashboard, and a generatable Blogging Dashboard. Same
// conventions as every other page's own -data.js in this app: plain
// localStorage, JSON-serialized, one key per collection, model-factory +
// makeCollection() CRUD (the exact recipe businessos-data.js/
// aitech-data.js/business-data.js already use). Every key lives under a
// `bizdash:` prefix so businessdash.html's initCloudSync({ syncedPrefixes:
// ['bizdash:'] }) call covers every collection with no per-key list.
//
// Genuinely separate from every other "business" page in this app —
// business.html ("Content Hub" + its Writing/YouTube Dashboard tabs) and
// businessos.html ("Business OS") are both untouched; nothing here reads
// or writes their data. BinderNodes is the one collection that departs
// from this app's usual numeric `order` + swap-adjacent-values convention
// (a Part/Chapter/Scene tree benefits from fractional-indexing string
// keys so a drag never has to renumber a whole subtree) — same
// self-contained base-36 midKey() generator writing-data.js's own
// BinderNode already uses, copied here rather than shared (no
// cross-file import mechanism exists in this no-build-step app).

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
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('bizdash:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('bizdash:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    businesses: 'bizdash:businesses',
    sections: 'bizdash:sections',
    links: 'bizdash:links',
    series: 'bizdash:series',
    manuscripts: 'bizdash:manuscripts',
    binderNodes: 'bizdash:binderNodes',
    trackers: 'bizdash:trackers',
    tasks: 'bizdash:tasks',
    ytVideos: 'bizdash:ytVideos',
    blogPosts: 'bizdash:blogPosts',
    prompts: 'bizdash:prompts',
    tracks: 'bizdash:tracks',
    articles: 'bizdash:articles',
    seeded: 'bizdash:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysFromNow(n) { return isoDaysAgo(-n); }

  // ============================================================
  // IMAGE / URL / TEXT HELPERS — same canvas-downscale + http(s)-only
  // guard + DOM-not-markup escaping every other page in this app uses.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900; quality = quality == null ? 0.8 : quality;
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
    try { const u = new URL(String(value)); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function wordCount(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // ============================================================
  // FIXED VOCABULARIES
  // ============================================================
  const BIZ_STATUSES = ['not-started', 'in-progress', 'done'];
  const BIZ_STATUS_LABELS = { 'not-started': 'Not Started', 'in-progress': 'In Progress', done: 'Done' };
  /** A business's own `kind` decides which content shows on its full
   * page: 'business' (the default — Series & Manuscripts, i.e. a real
   * Writing Dashboard) vs. the two singleton dashboard businesses,
   * 'youtube'/'blog' (Videos/Posts + their Prompt Vault + Track/Article
   * Library instead). Every kind still gets the same Business Card,
   * the same Notes/Links, and the same Tasks & Templates section — the
   * YouTube/Blogging Dashboards are genuinely their own Business Cards,
   * alongside every other business, not a separate component. */
  const BIZ_KINDS = ['business', 'youtube', 'blog'];
  const SWATCHES = ['#d9b878', '#e08a9f', '#7dd3fc', '#6ee7b7', '#fbbf24', '#ff8a8a', '#a78bfa', '#2dd4bf'];
  const MANUSCRIPT_STATUSES = ['outline', 'first-draft', 'revised-draft', 'final-draft', 'done'];
  const MANUSCRIPT_STATUS_LABELS = { outline: 'Outline', 'first-draft': 'First Draft', 'revised-draft': 'Revised Draft', 'final-draft': 'Final Draft', done: 'Done' };
  const BINDER_TYPES = ['act', 'chapter', 'scene'];
  const BINDER_STATUSES = ['not-started', 'drafting', 'revised', 'final'];
  const BINDER_STATUS_LABELS = { 'not-started': 'Not Started', drafting: 'Drafting', revised: 'Revised', final: 'Final' };
  const TRACKER_TYPES = ['continuity', 'plotthread'];
  const TRACKER_TYPE_LABELS = { continuity: 'Continuity Issue', plotthread: 'Plot Thread' };
  const TASK_STATUSES = ['todo', 'in-progress', 'done'];
  const PRIORITIES = ['low', 'medium', 'high'];
  const RESOURCE_TYPES = ['template', 'ai-prompt', 'automation', 'workflow', 'other'];
  const RESOURCE_TYPE_LABELS = { template: 'Template', 'ai-prompt': 'AI Prompt', automation: 'Automation Idea', workflow: 'Workflow Template', other: 'Resource' };
  const PROMPT_KINDS = ['music', 'blog'];
  const PROMPT_RATINGS = ['weak', 'decent', 'strong', 'fire'];
  const PROMPT_RATING_LABELS = { weak: '⭐ Weak', decent: '⭐⭐ Decent', strong: '⭐⭐⭐ Strong', fire: '⭐⭐⭐⭐ Fire' };
  const MOODS = ['Dark', 'Euphoric', 'Melancholic', 'Energetic'];
  const TRACK_STATUSES = ['draft', 'approved', 'released', 'archived'];
  const ARTICLE_STATUSES = ['draft', 'ready', 'published'];
  const YT_WORKFLOW_STEPS = ['Create the Songs', 'Create the Visuals', 'Edit the Final Video', 'Post'];
  const BLOG_WORKFLOW_STEPS = ['Mine Reddit Trends', 'Generate Blog', 'Create & Optimize Images', 'Post'];
  /** Which "bucket" a task belongs to — the mechanism behind isolating
   * writing/YouTube/blog tasks to their own dashboard section instead of
   * bleeding into a business's general Tasks & Templates list, and behind
   * the main-dashboard task database's per-business grouping/filtering.
   * isTemplate wins over everything else (an explicit template stays a
   * template even if it happens to carry a manuscriptId/workflowKind). */
  const TASK_KINDS = ['template', 'writing', 'youtube', 'blog', 'general'];
  const TASK_KIND_LABELS = { template: 'Template', writing: 'Writing', youtube: 'YouTube', blog: 'Blog', general: 'General' };
  function taskKindOf(t) {
    if (t.isTemplate) return 'template';
    if (t.manuscriptId) return 'writing';
    if (t.workflowKind === 'youtube') return 'youtube';
    if (t.workflowKind === 'blog') return 'blog';
    return 'general';
  }

  // ============================================================
  // MODELS
  // ============================================================
  function businessModel(data) {
    data = data || {};
    return {
      id: data.id || uid('biz'),
      name: typeof data.name === 'string' ? data.name : '',
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '🏢',
      cover: typeof data.cover === 'string' ? data.cover : '',
      kind: BIZ_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'business',
      status: BIZ_STATUSES.indexOf(data.status) !== -1 ? data.status : 'not-started',
      startDate: typeof data.startDate === 'string' ? data.startDate : '',
      deadline: typeof data.deadline === 'string' ? data.deadline : '',
      includeTemplatesInRollup: !!data.includeTemplatesInRollup,
      // Full-page hero — the exact cover-photo aesthetic ported from
      // business.html's old Writing Dashboard tab hero (eyebrow/serif
      // title/subtext/CTA/photo). The photo itself reuses the `cover`
      // field above (same value, two renderings — a small 16:9 gallery
      // thumbnail and a big cinematic hero) rather than a second field.
      heroEyebrow: typeof data.heroEyebrow === 'string' ? data.heroEyebrow : '',
      heroSubtext: typeof data.heroSubtext === 'string' ? data.heroSubtext : '',
      heroCtaLabel: typeof data.heroCtaLabel === 'string' ? data.heroCtaLabel : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** Generic "editable, reorderable, toggleable, generated-on-demand notes
   * section" — the one component this whole feature's many "toggleable
   * note sections" asks route through, same generated-sections precedent
   * business.html's Platform Detail pages already established. `scope` +
   * `scopeId` say what it's attached to (business card, a two-column
   * page's left notes, a manuscript's Notes/Outline/Ideas/Resources page,
   * a chapter's Chapter Notes card, or a task's detail-page blocks).
   * `resourceType`/`blockType` are only meaningful for scope==='resources'
   * / scope==='taskblock' respectively — every other scope ignores them. */
  function sectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('sec'),
      scope: typeof data.scope === 'string' ? data.scope : '',
      scopeId: data.scopeId || null,
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      collapsed: !!data.collapsed,
      resourceType: RESOURCE_TYPES.indexOf(data.resourceType) !== -1 ? data.resourceType : 'other',
      blockType: data.blockType === 'code' ? 'code' : 'note',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function linkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('link'),
      scope: typeof data.scope === 'string' ? data.scope : 'business',
      scopeId: data.scopeId || null,
      title: typeof data.title === 'string' ? data.title : '',
      url: typeof data.url === 'string' ? data.url : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function seriesModel(data) {
    data = data || {};
    return {
      id: data.id || uid('series'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      color: SWATCHES.indexOf(data.color) !== -1 ? data.color : SWATCHES[0],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function manuscriptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ms'),
      businessId: data.businessId || null,
      seriesId: data.seriesId || null,
      title: typeof data.title === 'string' ? data.title : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      status: MANUSCRIPT_STATUSES.indexOf(data.status) !== -1 ? data.status : 'outline',
      niche: typeof data.niche === 'string' ? data.niche : '',
      todayGoalCurrent: typeof data.todayGoalCurrent === 'number' ? data.todayGoalCurrent : 0,
      todayGoalTarget: typeof data.todayGoalTarget === 'number' ? data.todayGoalTarget : 1000,
      manuscriptWordGoal: typeof data.manuscriptWordGoal === 'number' ? data.manuscriptWordGoal : 100000,
      chapterWordGoal: typeof data.chapterWordGoal === 'number' ? data.chapterWordGoal : 2000,
      currentBinderNodeId: data.currentBinderNodeId || null,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** @typedef {{id, manuscriptId, parentId, type, title, orderKey, outline,
   * content, label, status, wordCount, createdAt}} BinderNode. `outline` is
   * the Chapter Card's planning text; `content` is the actual prose typed
   * in Composition Mode — wordCount is always derived from `content`
   * (never hand-entered), so it genuinely "affects the general Project
   * Target" as you write, per the request's own wording. */
  function binderNodeModel(data) {
    data = data || {};
    const content = typeof data.content === 'string' ? data.content : '';
    return {
      id: data.id || uid('bn'),
      manuscriptId: data.manuscriptId || null,
      parentId: data.parentId || null,
      type: BINDER_TYPES.indexOf(data.type) !== -1 ? data.type : 'chapter',
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      outline: typeof data.outline === 'string' ? data.outline : '',
      content: content,
      label: typeof data.label === 'string' ? data.label : '',
      status: BINDER_STATUSES.indexOf(data.status) !== -1 ? data.status : 'not-started',
      wordCount: wordCount(content),
      orderKey: typeof data.orderKey === 'string' ? data.orderKey : 'm',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function trackerModel(data) {
    data = data || {};
    return {
      id: data.id || uid('trk'),
      manuscriptId: data.manuscriptId || null,
      type: TRACKER_TYPES.indexOf(data.type) !== -1 ? data.type : 'plotthread',
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      mentions: Array.isArray(data.mentions) ? data.mentions : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  /** A flat Tasks database. isTemplate + parentId together give "Templates,
   * each with sub-pages" (root isTemplate task = a template; its children
   * = its sub-pages, same parent/child-via-parentId shape
   * writing-data.js's own WritingTask already established). workflowKind/
   * workflowItemId tag a task as belonging to a generated YouTube-video or
   * blog-post workflow. manuscriptId links (or not) to a manuscript. */
  function taskModel(data) {
    data = data || {};
    return {
      id: data.id || uid('task'),
      businessId: data.businessId || null,
      manuscriptId: data.manuscriptId || null,
      parentId: data.parentId || null,
      title: typeof data.title === 'string' ? data.title : '',
      note: typeof data.note === 'string' ? data.note : '',
      status: TASK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'medium',
      isTemplate: !!data.isTemplate,
      workflowKind: (data.workflowKind === 'youtube' || data.workflowKind === 'blog') ? data.workflowKind : '',
      workflowItemId: data.workflowItemId || null,
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      collapsed: !!data.collapsed,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function ytVideoModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ytv'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      tag: typeof data.tag === 'string' && data.tag ? data.tag : (typeof data.title === 'string' ? data.title : ''),
      cover: typeof data.cover === 'string' ? data.cover : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function blogPostModel(data) {
    data = data || {};
    return {
      id: data.id || uid('blg'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      tag: typeof data.tag === 'string' && data.tag ? data.tag : (typeof data.title === 'string' ? data.title : ''),
      cover: typeof data.cover === 'string' ? data.cover : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function promptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('prm'),
      businessId: data.businessId || null,
      kind: PROMPT_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'music',
      promptText: typeof data.promptText === 'string' ? data.promptText : '',
      genre: typeof data.genre === 'string' ? data.genre : '',
      bpm: typeof data.bpm === 'number' ? data.bpm : null,
      mood: Array.isArray(data.mood) ? data.mood : [],
      rating: PROMPT_RATINGS.indexOf(data.rating) !== -1 ? data.rating : '',
      trackId: data.trackId || null,
      dateUsed: typeof data.dateUsed === 'string' ? data.dateUsed : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function trackModel(data) {
    data = data || {};
    return {
      id: data.id || uid('trk2'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      audioLink: typeof data.audioLink === 'string' ? data.audioLink : '',
      genre: typeof data.genre === 'string' ? data.genre : '',
      promptId: data.promptId || null,
      status: TRACK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'draft',
      releaseDate: typeof data.releaseDate === 'string' ? data.releaseDate : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function articleModel(data) {
    data = data || {};
    return {
      id: data.id || uid('art'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      link: typeof data.link === 'string' ? data.link : '',
      content: typeof data.content === 'string' ? data.content : '',
      status: ARTICLE_STATUSES.indexOf(data.status) !== -1 ? data.status : 'draft',
      publishDate: typeof data.publishDate === 'string' ? data.publishDate : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
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
      const all = list(); all.push(record); storeSet(key, all);
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

  const Businesses = makeCollection(KEYS.businesses, businessModel);
  const Sections = makeCollection(KEYS.sections, sectionModel);
  const Links = makeCollection(KEYS.links, linkModel);
  const Series = makeCollection(KEYS.series, seriesModel);
  const Manuscripts = makeCollection(KEYS.manuscripts, manuscriptModel);
  const BinderNodes = makeCollection(KEYS.binderNodes, binderNodeModel);
  const Trackers = makeCollection(KEYS.trackers, trackerModel);
  const Tasks = makeCollection(KEYS.tasks, taskModel);
  const YtVideos = makeCollection(KEYS.ytVideos, ytVideoModel);
  const BlogPosts = makeCollection(KEYS.blogPosts, blogPostModel);
  const Prompts = makeCollection(KEYS.prompts, promptModel);
  const Tracks = makeCollection(KEYS.tracks, trackModel);
  const Articles = makeCollection(KEYS.articles, articleModel);

  // ============================================================
  // ORDER HELPERS
  // ============================================================
  function byOrder(a, b) { return a.order - b.order; }
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function reorderCollection(col, orderedIds) {
    const all = col.list();
    const byId = {}; all.forEach(function (x) { byId[x.id] = x; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    col.replaceAll(all);
  }

  // ============================================================
  // CASCADE DELETES — same null-out-the-reference-when-it-can-stand-alone,
  // cascade-when-it-can't precedent every sibling -data.js in this app
  // already follows (aitech-data.js's model deletion, household-data.js's
  // legion deletion, business-data.js's week/day deletion).
  // ============================================================
  function removeBusiness(id) {
    Businesses.remove(id);
    [Series, Manuscripts, BinderNodes, Trackers, Tasks, YtVideos, BlogPosts, Prompts, Tracks, Articles].forEach(function (col) {
      col.replaceAll(col.list().filter(function (r) { return r.businessId !== id; }));
    });
    // Sections/Links are matched by scopeId, not a direct businessId — a
    // business's own Notes/Links (shared by every kind, including the
    // YouTube/Blog dashboard businesses — see BIZ_KINDS above) are
    // scoped under known id / id+':business' keys; every other scope
    // (manuscript/outline/ideas/resources/chapternotes/taskblock) is
    // already cascaded from removeManuscript/removeBinderNode/removeTask.
    const bizScopeIds = [id, id + ':business'];
    Sections.replaceAll(Sections.list().filter(function (s) { return bizScopeIds.indexOf(s.scopeId) === -1; }));
    Links.replaceAll(Links.list().filter(function (l) { return bizScopeIds.indexOf(l.scopeId) === -1; }));
  }
  function removeSeries(id) {
    Series.remove(id);
    Manuscripts.replaceAll(Manuscripts.list().map(function (m) { return m.seriesId === id ? Object.assign({}, m, { seriesId: null }) : m; }));
  }
  function removeManuscript(id) {
    Manuscripts.remove(id);
    BinderNodes.replaceAll(BinderNodes.list().filter(function (n) { return n.manuscriptId !== id; }));
    Trackers.replaceAll(Trackers.list().filter(function (t) { return t.manuscriptId !== id; }));
    Sections.replaceAll(Sections.list().filter(function (s) {
      return !(['manuscript', 'outline', 'ideas', 'resources'].indexOf(s.scope) !== -1 && s.scopeId === id);
    }));
    Tasks.replaceAll(Tasks.list().map(function (t) { return t.manuscriptId === id ? Object.assign({}, t, { manuscriptId: null }) : t; }));
  }
  function removeBinderNode(id) {
    // Cascade: delete this node and every descendant.
    let toDelete = [id];
    let frontier = [id];
    while (frontier.length) {
      const next = BinderNodes.list().filter(function (n) { return frontier.indexOf(n.parentId) !== -1; }).map(function (n) { return n.id; });
      toDelete = toDelete.concat(next);
      frontier = next;
    }
    BinderNodes.replaceAll(BinderNodes.list().filter(function (n) { return toDelete.indexOf(n.id) === -1; }));
    Sections.replaceAll(Sections.list().filter(function (s) { return !(s.scope === 'chapternotes' && toDelete.indexOf(s.scopeId) !== -1); }));
    Manuscripts.list().forEach(function (m) {
      if (toDelete.indexOf(m.currentBinderNodeId) !== -1) Manuscripts.update(m.id, { currentBinderNodeId: null });
    });
  }
  function removeTask(id) {
    let toDelete = [id];
    let frontier = [id];
    while (frontier.length) {
      const next = Tasks.list().filter(function (t) { return frontier.indexOf(t.parentId) !== -1; }).map(function (t) { return t.id; });
      toDelete = toDelete.concat(next);
      frontier = next;
    }
    Tasks.replaceAll(Tasks.list().filter(function (t) { return toDelete.indexOf(t.id) === -1; }));
    Sections.replaceAll(Sections.list().filter(function (s) { return !(s.scope === 'taskblock' && toDelete.indexOf(s.scopeId) !== -1); }));
  }
  function removeYtVideo(id) {
    YtVideos.remove(id);
    Tasks.replaceAll(Tasks.list().filter(function (t) { return !(t.workflowKind === 'youtube' && t.workflowItemId === id); }));
  }
  function removeBlogPost(id) {
    BlogPosts.remove(id);
    Tasks.replaceAll(Tasks.list().filter(function (t) { return !(t.workflowKind === 'blog' && t.workflowItemId === id); }));
  }

  // ============================================================
  // GENERIC SECTIONS / LINKS SELECTORS
  // ============================================================
  function sectionsFor(scope, scopeId) {
    return Sections.list().filter(function (s) { return s.scope === scope && s.scopeId === scopeId; }).sort(byOrder);
  }
  function addSection(scope, scopeId, patch) {
    const list = sectionsFor(scope, scopeId);
    return Sections.add(Object.assign({ scope: scope, scopeId: scopeId, order: nextOrder(list) }, patch || {}));
  }
  function moveSection(scope, scopeId, id, dir) {
    const list = sectionsFor(scope, scopeId);
    const idx = list.findIndex(function (s) { return s.id === id; });
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx].order, b = list[swapIdx].order;
    Sections.update(list[idx].id, { order: b });
    Sections.update(list[swapIdx].id, { order: a });
  }
  function linksFor(scope, scopeId) {
    return Links.list().filter(function (l) { return l.scope === scope && l.scopeId === scopeId; }).sort(byOrder);
  }
  function addLink(scope, scopeId, patch) {
    const list = linksFor(scope, scopeId);
    return Links.add(Object.assign({ scope: scope, scopeId: scopeId, order: nextOrder(list) }, patch || {}));
  }
  function moveLink(scope, scopeId, id, dir) {
    const list = linksFor(scope, scopeId);
    const idx = list.findIndex(function (l) { return l.id === id; });
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx].order, b = list[swapIdx].order;
    Links.update(list[idx].id, { order: b });
    Links.update(list[swapIdx].id, { order: a });
  }

  // ============================================================
  // BUSINESS SELECTORS
  // ============================================================
  function businessesSorted() { return Businesses.list().slice().sort(byOrder); }
  function business(id) { return Businesses.get(id); }
  /** Backfills the two singleton dashboard businesses (kind 'youtube'/
   * 'blog') onto a device that already has real business data but
   * doesn't have them yet — the same "newly-added record, existing
   * device" backfill precedent this app's own business.html
   * (ensureWritingDashboardExists) and selfcare.html
   * (ensureAnxietyTabExists) already established. Deliberately guarded
   * by "some business already exists" so a genuinely fresh/empty device
   * isn't handed these two before its own deferred, seed-race-safe
   * seedDefaultData() has had a real chance to run — creating them here
   * unconditionally could otherwise push a freshly-created pair to
   * Supabase and clobber another device's real data mid-pull. Never
   * touches an already-existing dashboard business (order/name/content
   * left completely alone), only adds whichever one is missing. */
  function ensureDashboardBusinessesExist() {
    if (!Businesses.list().length) return;
    const hasKind = function (k) { return Businesses.list().some(function (b) { return b.kind === k; }); };
    if (!hasKind('youtube')) Businesses.add({ name: 'YouTube Dashboard', icon: '📺', kind: 'youtube', status: 'not-started', order: -2 });
    if (!hasKind('blog')) Businesses.add({ name: 'Blogging Dashboard', icon: '📝', kind: 'blog', status: 'not-started', order: -1 });
  }
  /** Total/completed Task rollups, with an include/exclude-templates
   * toggle (the request's own "give it the option") — a template root
   * task or any of its sub-pages count as "related to Templates". */
  function tasksRelatedToTemplates() {
    const all = Tasks.list();
    const templateRootIds = all.filter(function (t) { return t.isTemplate; }).map(function (t) { return t.id; });
    const related = {};
    templateRootIds.forEach(function (id) { related[id] = true; });
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach(function (t) { if (t.parentId && related[t.parentId] && !related[t.id]) { related[t.id] = true; changed = true; } });
    }
    return related;
  }
  function tasksForBusiness(businessId, opts) {
    opts = opts || {};
    const related = tasksRelatedToTemplates();
    let list = Tasks.list().filter(function (t) { return t.businessId === businessId; });
    if (!opts.includeTemplates) list = list.filter(function (t) { return !related[t.id]; });
    if (opts.manuscriptId !== undefined) list = list.filter(function (t) { return t.manuscriptId === opts.manuscriptId; });
    if (opts.workflowKind) list = list.filter(function (t) { return t.workflowKind === opts.workflowKind; });
    if (opts.workflowItemId) list = list.filter(function (t) { return t.workflowItemId === opts.workflowItemId; });
    return list;
  }
  function taskRollup(businessId, includeTemplates) {
    const list = tasksForBusiness(businessId, { includeTemplates: includeTemplates });
    return { total: list.length, done: list.filter(function (t) { return t.status === 'done'; }).length };
  }
  function deadlineProgress(b) {
    if (!b.startDate || !b.deadline) return null;
    const start = new Date(b.startDate + 'T00:00:00').getTime();
    const end = new Date(b.deadline + 'T00:00:00').getTime();
    const now = Date.now();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
    return { pct: pct, overdue: now > end };
  }

  // ============================================================
  // SERIES / MANUSCRIPTS
  // ============================================================
  function seriesForBusiness(businessId) { return Series.list().filter(function (s) { return s.businessId === businessId; }).sort(byOrder); }
  function manuscriptsFor(businessId) { return Manuscripts.list().filter(function (m) { return m.businessId === businessId; }).sort(byOrder); }
  function manuscriptsInSeries(businessId, seriesId) { return manuscriptsFor(businessId).filter(function (m) { return m.seriesId === seriesId; }); }
  function standaloneManuscripts(businessId) { return manuscriptsFor(businessId).filter(function (m) { return !m.seriesId; }); }
  /** "Generate an entire series with the click of a button" — one Series
   * plus 3 manuscript cards (Book 1/2/3), per the request's own spec. */
  function generateSeries(businessId, name) {
    const series = Series.add({ businessId: businessId, name: name || 'Untitled Series', order: nextOrder(seriesForBusiness(businessId)) });
    const existing = manuscriptsFor(businessId);
    for (let i = 1; i <= 3; i++) {
      Manuscripts.add({ businessId: businessId, seriesId: series.id, title: 'Book ' + i, order: nextOrder(existing) + i });
    }
    return series;
  }

  // ============================================================
  // BINDER TREE — fractional-indexing string keys (BinderNode.orderKey
  // only — every other list in this file uses the numeric-order
  // convention). Self-contained base-36 midpoint generator, copied from
  // writing-data.js's own midKey(); keys sort correctly as plain strings.
  // ============================================================
  const KEY_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  function midKey(a, b) {
    a = a || ''; b = b || '';
    let result = ''; let i = 0;
    while (true) {
      const ca = i < a.length ? KEY_ALPHABET.indexOf(a[i]) : 0;
      const cb = (b && i < b.length) ? KEY_ALPHABET.indexOf(b[i]) : (b ? -1 : KEY_ALPHABET.length);
      if (cb === -1) { result += a[i]; i++; continue; }
      if (cb - ca > 1) { result += KEY_ALPHABET[Math.floor((ca + cb) / 2)]; return result; }
      if (cb - ca === 1) { result += a[i] || '0'; i++; continue; }
      result += KEY_ALPHABET[ca]; i++;
    }
  }
  function generateKeyAfter(existingKeysSorted) {
    if (!existingKeysSorted.length) return 'm';
    return midKey(existingKeysSorted[existingKeysSorted.length - 1], '');
  }
  function binderChildren(manuscriptId, parentId) {
    return BinderNodes.list()
      .filter(function (n) { return n.manuscriptId === manuscriptId && (n.parentId || null) === (parentId || null); })
      .sort(function (a, b) { return a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0; });
  }
  function binderNodesForManuscript(manuscriptId) { return BinderNodes.list().filter(function (n) { return n.manuscriptId === manuscriptId; }); }
  function flattenBinderTree(manuscriptId) {
    const out = [];
    function walk(parentId, depth) {
      binderChildren(manuscriptId, parentId).forEach(function (node) { out.push({ node: node, depth: depth }); walk(node.id, depth + 1); });
    }
    walk(null, 0);
    return out;
  }
  function addBinderNode(manuscriptId, parentId, type, title) {
    const siblingKeys = binderChildren(manuscriptId, parentId).map(function (n) { return n.orderKey; });
    return BinderNodes.add({ manuscriptId: manuscriptId, parentId: parentId || null, type: type, title: title || (type === 'act' ? 'New Act' : type === 'chapter' ? 'New Chapter' : 'New Scene'), orderKey: generateKeyAfter(siblingKeys) });
  }
  function moveBinderNode(nodeId, newParentId, beforeNodeId) {
    const node = BinderNodes.get(nodeId); if (!node) return;
    if (newParentId === nodeId) return;
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
  function manuscriptWordCount(manuscriptId) {
    return binderNodesForManuscript(manuscriptId).reduce(function (s, n) { return s + (n.wordCount || 0); }, 0);
  }
  function wordProgressPct(current, goal) { return goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0; }

  // ============================================================
  // TRACKERS (Continuity + Plot Threads) — "🔍 Scan this chapter" is a
  // case-insensitive substring match, same confirmed-adaptation precedent
  // business.html's Writing Dashboard trackers already established (not
  // real NLP — this app has no active LLM key anywhere).
  // ============================================================
  function trackersFor(manuscriptId, type) {
    return Trackers.list().filter(function (t) { return t.manuscriptId === manuscriptId && (!type || t.type === type); }).sort(byOrder);
  }
  function scanNodeForTrackers(node) {
    const haystack = ((node.title || '') + ' ' + (node.outline || '')).toLowerCase();
    let hits = 0;
    trackersFor(node.manuscriptId).forEach(function (t) {
      const name = (t.name || '').toLowerCase().trim();
      if (name && haystack.indexOf(name) !== -1) {
        const mentions = t.mentions.slice();
        mentions.push({ nodeId: node.id, nodeTitle: node.title, snippet: (node.outline || '').slice(0, 120), ts: Date.now() });
        Trackers.update(t.id, { mentions: mentions });
        hits++;
      }
    });
    return hits;
  }

  // ============================================================
  // TASKS — Templates (Group 1) / General (Group 2), sub-pages,
  // duplicate — same shape as writing-data.js's own WritingTask
  // template/sub-page/duplicate mechanic.
  // ============================================================
  function rootTasksForBusiness(businessId, opts) {
    opts = opts || {};
    let list = tasksForBusiness(businessId, Object.assign({ includeTemplates: true }, opts)).filter(function (t) { return !t.parentId; });
    return list.sort(byOrder);
  }
  /** Isolates a business's root tasks into Templates vs. General — writing
   * tasks (tied to a manuscript) and YouTube/blog workflow tasks are
   * deliberately excluded from both: they live in their own Writing/
   * YouTube/Blogging dashboard sections instead, per the "isolate tasks
   * to their own dashboard" request. */
  function tasksGroupedForBusiness(businessId) {
    const root = rootTasksForBusiness(businessId, { includeTemplates: true });
    return {
      templates: root.filter(function (t) { return taskKindOf(t) === 'template'; }),
      general: root.filter(function (t) { return taskKindOf(t) === 'general'; })
    };
  }
  function childTasks(parentId) { return Tasks.list().filter(function (t) { return t.parentId === parentId; }).sort(byOrder); }
  /** Reorders a task among its real siblings only — a sub-page moves
   * among its own parent's other sub-pages (childTasks(parentId)); a
   * root task moves only among same-kind siblings (a Template never
   * swaps position with a General task, matching how Group 1/Group 2
   * already render as two separate lists) — same swap-adjacent-order-
   * values mechanic as writing-data.js's own moveTask()/swapOrder(). */
  function moveTask(id, dir) {
    const t = Tasks.get(id); if (!t) return;
    const siblings = t.parentId
      ? childTasks(t.parentId)
      : rootTasksForBusiness(t.businessId, { includeTemplates: true }).filter(function (x) { return taskKindOf(x) === taskKindOf(t); });
    const idx = siblings.findIndex(function (x) { return x.id === id; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[otherIdx];
    Tasks.update(a.id, { order: b.order });
    Tasks.update(b.id, { order: a.order });
  }
  function duplicateTask(taskId) {
    const orig = Tasks.get(taskId); if (!orig) return null;
    const copy = Tasks.add(Object.assign({}, orig, { id: undefined, title: orig.title + ' (Copy)', order: nextOrder(rootTasksForBusiness(orig.businessId)) }));
    childTasks(taskId).forEach(function (child) {
      Tasks.add(Object.assign({}, child, { id: undefined, parentId: copy.id, order: child.order }));
    });
    const blocks = sectionsFor('taskblock', taskId);
    blocks.forEach(function (b) { addSection('taskblock', copy.id, { title: b.title, body: b.body, blockType: b.blockType, order: b.order }); });
    return copy;
  }

  /** One-time: finds a business named "Amazon KDP" (a real, ordinary
   * business — not the YouTube/Blog singleton dashboards) and copies
   * every "Template" from the real, live business.html Writing
   * Dashboard's own Tasks Inline Database into this business's own
   * Group 1 — Templates, sub-pages included. "Template" uses the exact
   * same grouping rule that page's own Tasks database already uses (a
   * root task whose title contains the word "template", case-
   * insensitive) — see business.html's renderWrTaskTable(). Reads
   * business:writingTasks directly (same "read another page's real
   * localStorage, never re-run its own seed code" precedent
   * tasks-data.js's own import sources already use), so whatever
   * templates the user actually has — seeded or hand-added — get
   * copied, not just this repo's own static seed content. Guarded so
   * it only ever runs once; if no matching business exists yet on this
   * device, it simply does nothing and tries again next load. */
  function migrateWritingTemplatesToKdp() {
    const FLAG = 'bizdash:kdpTemplatesMigratedV1';
    if (storeGet(FLAG)) return;
    const kdp = Businesses.list().find(function (b) { return b.kind === 'business' && /amazon\s*kdp/i.test(b.name || ''); });
    if (!kdp) return;
    let wrTasks;
    try { wrTasks = JSON.parse(localStorage.getItem('business:writingTasks') || '[]'); } catch (e) { wrTasks = []; }
    if (!Array.isArray(wrTasks) || !wrTasks.length) { storeSet(FLAG, true); return; }
    const roots = wrTasks.filter(function (t) { return t && !t.parentTaskId && /template/i.test(t.title || ''); });
    if (!roots.length) { storeSet(FLAG, true); return; }
    roots.forEach(function (t) {
      const newRoot = Tasks.add({
        businessId: kdp.id, title: t.title, note: t.summary || '', isTemplate: true,
        status: TASK_STATUSES.indexOf(t.status) !== -1 ? t.status : 'todo',
        priority: PRIORITIES.indexOf(t.priority) !== -1 ? t.priority : 'medium',
        order: nextOrder(rootTasksForBusiness(kdp.id, { includeTemplates: true }))
      });
      wrTasks.filter(function (c) { return c && c.parentTaskId === t.id; }).forEach(function (c) {
        Tasks.add({
          businessId: kdp.id, parentId: newRoot.id, title: c.title, note: c.summary || '',
          status: TASK_STATUSES.indexOf(c.status) !== -1 ? c.status : 'todo',
          priority: PRIORITIES.indexOf(c.priority) !== -1 ? c.priority : 'medium',
          order: typeof c.order === 'number' ? c.order : 0
        });
      });
    });
    storeSet(FLAG, true);
  }

  // ============================================================
  // YOUTUBE / BLOG WORKFLOW GENERATORS — scoped to one business again
  // (each business's own YouTube/Blogging Dashboard section), per an
  // explicit follow-up request reversing an earlier "make them global"
  // pass. `businessId` was already a real field on every one of these
  // models even while unused, so restoring the scoping needed no
  // migration — a device with videos/posts/prompts/tracks/articles
  // created during the global phase (businessId: null) simply won't show
  // them under any business's own dashboard anymore; nothing was
  // deleted, they're just not filtered into view (same orphaned-data
  // treatment this app uses elsewhere for a superseded shape).
  // ============================================================
  function generateYoutubeVideo(businessId, title) {
    const video = YtVideos.add({ businessId: businessId, title: title || 'Untitled Video', order: nextOrder(ytVideosFor(businessId)) });
    YT_WORKFLOW_STEPS.forEach(function (step, i) {
      Tasks.add({ businessId: businessId, title: (i + 1 < 10 ? '0' : '') + (i + 1) + ' | ' + step, workflowKind: 'youtube', workflowItemId: video.id, order: i });
    });
    return video;
  }
  function generateBlogPost(businessId, title) {
    const post = BlogPosts.add({ businessId: businessId, title: title || 'Untitled Post', order: nextOrder(blogPostsFor(businessId)) });
    BLOG_WORKFLOW_STEPS.forEach(function (step, i) {
      Tasks.add({ businessId: businessId, title: (i + 1 < 10 ? '0' : '') + (i + 1) + ' | ' + step, workflowKind: 'blog', workflowItemId: post.id, order: i });
    });
    return post;
  }
  function ytVideosFor(businessId) { return YtVideos.list().filter(function (v) { return v.businessId === businessId; }).sort(byOrder); }
  function blogPostsFor(businessId) { return BlogPosts.list().filter(function (p) { return p.businessId === businessId; }).sort(byOrder); }
  /** Groups a tag-bearing list (YtVideos/BlogPosts) into
   * [{tag, items}], tag-order by first appearance, items already sorted. */
  function groupByTag(list) {
    const order = []; const byTag = {};
    list.forEach(function (item) {
      const tag = item.tag || 'Untagged';
      if (!byTag[tag]) { byTag[tag] = []; order.push(tag); }
      byTag[tag].push(item);
    });
    return order.map(function (tag) { return { tag: tag, items: byTag[tag] }; });
  }
  function promptsFor(businessId, kind) { return Prompts.list().filter(function (p) { return p.businessId === businessId && p.kind === kind; }).sort(byOrder); }
  function tracksFor(businessId) { return Tracks.list().filter(function (t) { return t.businessId === businessId; }).sort(byOrder); }
  function articlesFor(businessId) { return Articles.list().filter(function (a) { return a.businessId === businessId; }).sort(byOrder); }

  // ============================================================
  // SEED DATA — guarded by the same empty-storage seed-race-safety
  // contract every synced page in this app uses; businessdash.html only
  // ever calls seedIfEmpty() from its own deferred safety window, never
  // synchronously at boot.
  // ============================================================
  function isEmptyEverywhere() {
    return !Businesses.list().length && !Series.list().length && !Manuscripts.list().length &&
      !Tasks.list().length && !YtVideos.list().length && !BlogPosts.list().length && !Prompts.list().length &&
      !Tracks.list().length && !Articles.list().length && !Sections.list().length && !Links.list().length;
  }
  function seedDefaultData() {
    Businesses.replaceAll([]); Sections.replaceAll([]); Links.replaceAll([]); Series.replaceAll([]);
    Manuscripts.replaceAll([]); BinderNodes.replaceAll([]); Trackers.replaceAll([]); Tasks.replaceAll([]);
    YtVideos.replaceAll([]); BlogPosts.replaceAll([]); Prompts.replaceAll([]); Tracks.replaceAll([]); Articles.replaceAll([]);

    const biz = Businesses.add({ name: 'Midnight Press', icon: '📚', status: 'in-progress', startDate: isoDaysAgo(30), deadline: isoDaysFromNow(150), order: 0 });
    addSection('business', biz.id, { title: 'Why this business exists', body: 'A small fiction imprint — dark fantasy trilogies and a YouTube/blog presence to build an audience while writing them.' });
    addSection('left', biz.id + ':business', { title: 'Focus this month', body: 'Finish Book 1 of The Ember Court, and get the YouTube channel to 10 uploads.' });
    addLink('business', biz.id, { title: 'Style Guide', url: 'https://example.com/style-guide', notes: 'House style for covers/blurbs' });

    const series = generateSeries(biz.id, 'The Ember Court');
    const msList = manuscriptsInSeries(biz.id, series.id);
    Manuscripts.update(msList[0].id, { status: 'first-draft', niche: 'Dark Fantasy', todayGoalCurrent: 450, todayGoalTarget: 1000, manuscriptWordGoal: 95000, chapterWordGoal: 2200 });
    const ms1 = Manuscripts.get(msList[0].id);
    addSection('manuscript', ms1.id, { title: 'Premise', body: 'A disgraced court mage claws her way back into power by binding herself to a dying ember-god.' });
    addSection('outline', ms1.id, { title: 'Act structure', body: 'Act I — the binding. Act II — the court fractures. Act III — the ember god chooses.' });
    addSection('ideas', ms1.id, { title: 'Cold open idea', body: 'Open on the execution that almost was.' });
    addSection('resources', ms1.id, { title: 'Query letter template', resourceType: 'template', body: 'Dear [Agent], ...' });

    const act1 = addBinderNode(ms1.id, null, 'act', 'Act I — The Binding');
    const ch1 = addBinderNode(ms1.id, act1.id, 'chapter', 'Chapter 1 — The Execution');
    BinderNodes.update(ch1.id, {
      outline: 'Kira is dragged to the block; the ember-god intervenes at the last second.',
      status: 'drafting', label: 'Opening',
      content: 'The block was cold, which Kira supposed was the point. '.repeat(48)
    });
    addSection('chapternotes', ch1.id, { title: 'Voice notes', body: 'Keep Kira wry even under threat — dark humor, not despair.' });
    const ch2 = addBinderNode(ms1.id, act1.id, 'chapter', 'Chapter 2 — The Bargain');
    BinderNodes.update(ch2.id, { outline: 'The binding ritual — Kira learns the cost too late.', status: 'not-started' });
    addBinderNode(ms1.id, null, 'act', 'Act II — The Fracture');
    addBinderNode(ms1.id, null, 'act', 'Act III — The Choosing');
    Manuscripts.update(ms1.id, { currentBinderNodeId: ch1.id });
    Trackers.add({ manuscriptId: ms1.id, type: 'plotthread', name: 'The Ember God’s true name', description: 'Revealed in Act III, foreshadow in Act I.', order: 0 });
    Trackers.add({ manuscriptId: ms1.id, type: 'continuity', name: 'Kira’s scar', description: 'Left hand, from the binding — must stay consistent.', order: 0 });
    scanNodeForTrackers(BinderNodes.get(ch1.id));

    const tplRoot = Tasks.add({ businessId: biz.id, title: 'Manuscript Launch Template', isTemplate: true, order: 0 });
    Tasks.add({ businessId: biz.id, parentId: tplRoot.id, title: 'Draft back-cover copy', order: 0 });
    Tasks.add({ businessId: biz.id, parentId: tplRoot.id, title: 'Commission cover art', order: 1 });
    Tasks.add({ businessId: biz.id, title: 'Outline Book 2', manuscriptId: msList[1].id, priority: 'high', order: 1 });

    const biz2 = Businesses.add({ name: 'North & Co.', icon: '🎬', status: 'not-started', order: 1 });
    addSection('business', biz2.id, { title: 'Overview', body: 'A small video-first content studio — not yet started.' });

    // YouTube Dashboard and Blogging Dashboard are each their own real
    // Business Card, alongside Midnight Press/North & Co. — not nested
    // inside any of them — per an explicit request that they sit
    // "alongside" every other business, on the same footing. Pinned to
    // order -2/-1 so they always sort first in the gallery.
    const ytBiz = Businesses.add({ name: 'YouTube Dashboard', icon: '📺', kind: 'youtube', status: 'in-progress', order: -2 });
    addSection('business', ytBiz.id, { title: 'What this is', body: 'Every channel’s video workflows, prompts, and tracks in one place.' });
    addSection('left', ytBiz.id + ':business', { title: 'Channel focus', body: 'Behind-the-scenes worldbuilding shorts + trailer-style teasers.' });
    generateYoutubeVideo(ytBiz.id, 'The Ember Court — Teaser Trailer');
    Prompts.add({ businessId: ytBiz.id, kind: 'music', promptText: 'dark orchestral swell, low strings, distant choir', genre: 'Fantasy', bpm: 68, mood: ['Dark', 'Melancholic'], rating: 'strong', dateUsed: todayISO(), order: 0 });
    const track = Tracks.add({ businessId: ytBiz.id, name: 'Ember Court Theme', genre: 'Fantasy', status: 'approved', order: 0 });
    Prompts.update(Prompts.list()[Prompts.list().length - 1].id, { trackId: track.id });

    const blogBiz = Businesses.add({ name: 'Blogging Dashboard', icon: '📝', kind: 'blog', status: 'in-progress', order: -1 });
    addSection('business', blogBiz.id, { title: 'What this is', body: 'Every blog’s post workflows, prompts, and articles in one place.' });
    addSection('left', blogBiz.id + ':business', { title: 'Content pillars', body: 'Worldbuilding deep-dives, writing process, cover reveals.' });
    generateBlogPost(blogBiz.id, 'Building the Ember Court Magic System');
    Articles.add({ businessId: blogBiz.id, title: 'Building the Ember Court Magic System', status: 'draft', order: 0 });
    Prompts.add({ businessId: blogBiz.id, kind: 'blog', promptText: 'Write a 900-word worldbuilding post about a fire-based magic system with a real cost.', notes: 'Good hook, needs a stronger ending next time.', order: 0 });

    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (!isEmptyEverywhere()) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.BusinessDashData = {
    KEYS: KEYS,
    BIZ_STATUSES: BIZ_STATUSES, BIZ_STATUS_LABELS: BIZ_STATUS_LABELS, BIZ_KINDS: BIZ_KINDS, SWATCHES: SWATCHES,
    MANUSCRIPT_STATUSES: MANUSCRIPT_STATUSES, MANUSCRIPT_STATUS_LABELS: MANUSCRIPT_STATUS_LABELS,
    BINDER_TYPES: BINDER_TYPES, BINDER_STATUSES: BINDER_STATUSES, BINDER_STATUS_LABELS: BINDER_STATUS_LABELS,
    TRACKER_TYPES: TRACKER_TYPES, TRACKER_TYPE_LABELS: TRACKER_TYPE_LABELS,
    TASK_STATUSES: TASK_STATUSES, PRIORITIES: PRIORITIES,
    RESOURCE_TYPES: RESOURCE_TYPES, RESOURCE_TYPE_LABELS: RESOURCE_TYPE_LABELS,
    PROMPT_KINDS: PROMPT_KINDS, PROMPT_RATINGS: PROMPT_RATINGS, PROMPT_RATING_LABELS: PROMPT_RATING_LABELS, MOODS: MOODS,
    TRACK_STATUSES: TRACK_STATUSES, ARTICLE_STATUSES: ARTICLE_STATUSES,
    YT_WORKFLOW_STEPS: YT_WORKFLOW_STEPS, BLOG_WORKFLOW_STEPS: BLOG_WORKFLOW_STEPS,
    TASK_KINDS: TASK_KINDS, TASK_KIND_LABELS: TASK_KIND_LABELS, taskKindOf: taskKindOf,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo, isoDaysFromNow: isoDaysFromNow,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl, escapeHtml: escapeHtml, wordCount: wordCount,
    byOrder: byOrder, nextOrder: nextOrder, reorderCollection: reorderCollection,
    Businesses: Object.assign({}, Businesses, { remove: removeBusiness }),
    Sections: Sections, Links: Links,
    Series: Object.assign({}, Series, { remove: removeSeries }),
    Manuscripts: Object.assign({}, Manuscripts, { remove: removeManuscript }),
    BinderNodes: Object.assign({}, BinderNodes, { remove: removeBinderNode }),
    Trackers: Trackers,
    Tasks: Object.assign({}, Tasks, { remove: removeTask }),
    migrateWritingTemplatesToKdp: migrateWritingTemplatesToKdp,
    YtVideos: Object.assign({}, YtVideos, { remove: removeYtVideo }),
    BlogPosts: Object.assign({}, BlogPosts, { remove: removeBlogPost }),
    Prompts: Prompts, Tracks: Tracks, Articles: Articles,
    sectionsFor: sectionsFor, addSection: addSection, moveSection: moveSection,
    linksFor: linksFor, addLink: addLink, moveLink: moveLink,
    businessesSorted: businessesSorted, business: business, ensureDashboardBusinessesExist: ensureDashboardBusinessesExist,
    tasksForBusiness: tasksForBusiness, taskRollup: taskRollup, deadlineProgress: deadlineProgress,
    seriesForBusiness: seriesForBusiness, manuscriptsFor: manuscriptsFor, manuscriptsInSeries: manuscriptsInSeries,
    standaloneManuscripts: standaloneManuscripts, generateSeries: generateSeries,
    midKey: midKey, generateKeyAfter: generateKeyAfter,
    binderChildren: binderChildren, binderNodesForManuscript: binderNodesForManuscript, flattenBinderTree: flattenBinderTree,
    addBinderNode: addBinderNode, moveBinderNode: moveBinderNode,
    manuscriptWordCount: manuscriptWordCount, wordProgressPct: wordProgressPct,
    trackersFor: trackersFor, scanNodeForTrackers: scanNodeForTrackers,
    rootTasksForBusiness: rootTasksForBusiness, tasksGroupedForBusiness: tasksGroupedForBusiness,
    childTasks: childTasks, moveTask: moveTask, duplicateTask: duplicateTask,
    generateYoutubeVideo: generateYoutubeVideo, generateBlogPost: generateBlogPost,
    ytVideosFor: ytVideosFor, blogPostsFor: blogPostsFor, promptsFor: promptsFor, tracksFor: tracksFor, articlesFor: articlesFor,
    groupByTag: groupByTag,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, isEmptyEverywhere: isEmptyEverywhere
  };
})(window);
