// =============================================================
// knowledge-hub-data.js — data layer for Knowledge Hub, a digital
// note-taking / PKM (personal knowledge management) system built around
// Tiago-Forte-style Progressive Summarization and a five-stage capture
// funnel: Inbox -> To Review -> Highlighting -> Summarizing -> Synthesis.
//
// Same makeCollection()/model-factory conventions as every other page's
// own -data.js in this app (aitech-data.js, businessdash-data.js, etc.).
// Every key here is `kh:`-prefixed (kh:notebooks, kh:notes, kh:templates,
// kh:seeded, kh:active_tab), covered by knowledge-hub.html's own
// initCloudSync({ appKey: 'knowledgehub', syncedPrefixes: ['kh:'] }) call —
// nothing new invented, same pattern every other page uses.
//
// One flat `Notes` collection covers every capture type (Jot/Note/
// Highlight/Article/Video/Quote/Book) and every funnel stage — "the Quote
// Library" is simply notes with type:'quote', filtered, not a second
// duplicated database (same "one generic model, filtered many ways"
// precedent this app's other multi-view pages already use, e.g.
// mediaverse-data.js's single MediaItem collection covering ten
// categories, or aitech-data.js's Prompts tied to a Model).
//
// "Automatic organization" is two layers: (1) TYPE_NOTEBOOK_MAP — every
// quick/media capture auto-files into a notebook keyed off its type via
// findOrCreateNotebook(), created on first use, and (2) the Templates
// collection — richer one-click starting points (Book Note, Essay,
// Research Project, etc.) that also set a default stage and a set of
// Progressive-Summarization prompts, per the request's own "automatic
// templates for books, notes, essays" ask.
//
// Progressive Summarization is modeled as four real layers on a Note:
//   Layer 1 (raw capture)      -> note.rawContent
//   Layer 2 (bold key passages) -> note.excerpts[] with layer:1
//   Layer 3 (highlight the bold) -> the same excerpts, promoted to layer:2
//   Layer 4 (mini-summary, own words) -> note.summary
//   Layer 5 (synthesis / essay) -> note.synthesis
// matching the funnel's own Highlighting/Summarizing/Synthesis stages.
//
// Linking notes ("a dynamic web of ideas"): a note can carry an explicit
// links[] array (other note ids) AND/OR [[Wiki Title]] mentions inside its
// own text fields, resolved case-insensitively against every other note's
// title — same [[...]] mention + backlinks mechanism
// learning-dashboard.html's own Master Notes already established in this
// app, reimplemented here (no cross-file import mechanism exists — see
// CLAUDE.md §1) rather than shared.
// =============================================================
(function () {
  'use strict';

  function storeGet(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  // Same honest-save-signal storeSet() as every other page's own
  // -data.js (entertainment-dash-data.js, entertainment-hub-data.js,
  // etc.) — a failed write (most likely: this origin's shared
  // localStorage quota is full, a documented recurring issue in this
  // app — see photo-store.js's own header) now dispatches a 'kh:save'
  // event either way, instead of vanishing silently with nothing for
  // the page (or the user) to react to.
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('kh:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('kh:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function nowIso() { return new Date().toISOString(); }
  function str(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
  function num(v, fallback) { return typeof v === 'number' && !isNaN(v) ? v : fallback; }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }

  function makeCollection(key, model) {
    function list() { return storeGet(key, []); }
    function save(list_) { return storeSet(key, list_); }
    return {
      list: list,
      get: function (id) {
        var l = list();
        for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === id) return l[i];
        return null;
      },
      add: function (data) {
        var rec = model(data || {});
        var l = list(); l.push(rec);
        // save()/storeSet() return true/false now — a caller that ignores
        // this still behaves exactly as before on success; on a genuine
        // write failure (most likely a full localStorage quota) it now
        // gets null back instead of a record that looks saved but isn't,
        // and the page-wide 'kh:save' listener has already shown a
        // banner by the time this returns.
        return save(l) ? rec : null;
      },
      update: function (id, patch) {
        var l = list();
        for (var i = 0; i < l.length; i++) {
          if (l[i] && l[i].id === id) {
            var rec = model(Object.assign({}, l[i], patch, { id: id, createdAt: l[i].createdAt }));
            l[i] = rec;
            return save(l) ? rec : null;
          }
        }
        return null;
      },
      remove: function (id) { save(list().filter(function (x) { return x && x.id !== id; })); }
    };
  }

  // ---------- Fixed vocabularies ----------
  var STAGES = [
    { key: 'inbox', label: 'Inbox', icon: '📥', hint: 'Capture media like articles, YouTube videos, etc.' },
    { key: 'toreview', label: 'To Review', icon: '🔖', hint: 'Tag notes ready for reading, watching, or reviewing.' },
    { key: 'highlighting', label: 'Highlighting', icon: '🖍️', hint: "Notes you've started highlighting and surfacing valuable information." },
    { key: 'summarizing', label: 'Summarizing', icon: '✏️', hint: "Notes you've started annotating with your own ideas & opinions." },
    { key: 'synthesis', label: 'Synthesis', icon: '💡', hint: "Notes you've created original ideas & essays from." }
  ];
  var STAGE_KEYS = STAGES.map(function (s) { return s.key; });

  var TYPES = [
    { key: 'jot', label: 'Jot', icon: '⚡' },
    { key: 'note', label: 'Note', icon: '📝' },
    { key: 'highlight', label: 'Highlight', icon: '🖍️' },
    { key: 'article', label: 'Article', icon: '📄' },
    { key: 'video', label: 'Video', icon: '🎬' },
    { key: 'quote', label: 'Quote', icon: '💬' },
    { key: 'book', label: 'Book', icon: '📚' }
  ];
  var TYPE_KEYS = TYPES.map(function (t) { return t.key; });

  // Every capture type routes automatically into its own notebook the
  // first time that type is ever captured — findOrCreateNotebook() below
  // creates it on demand, so a fresh install starts with zero notebooks
  // rather than a pile of empty ones.
  var TYPE_NOTEBOOK_MAP = {
    jot: { name: 'Quick Jots', icon: '⚡' },
    note: { name: 'General Notes', icon: '🗒️' },
    highlight: { name: 'Highlights', icon: '🖍️' },
    article: { name: 'Articles', icon: '📄' },
    video: { name: 'Videos', icon: '🎬' },
    quote: { name: 'Quotes', icon: '💬' },
    book: { name: 'Books', icon: '📚' }
  };

  // Today's Focus phase vocabulary — deliberately its own fixed set, not
  // the funnel STAGES above: this names where you are in a single study
  // session (Discover a topic -> Understand it -> Connect it to what you
  // already know -> Create something from it), not which stage a capture
  // has reached in the longer-lived funnel.
  var FOCUS_PHASES = [
    { key: 'discover', label: 'Discover', icon: '🔍' },
    { key: 'understand', label: 'Understand', icon: '💡' },
    { key: 'connect', label: 'Connect', icon: '🕸️' },
    { key: 'create', label: 'Create', icon: '✨' }
  ];

  // Creation Lab — "use the knowledge you've gathered and create Articles,
  // Essays, Mind Maps, etc." A Creation is deliberately lightweight (a
  // title/type/body/linked-notes record, same shape as everything else in
  // this file) rather than a second full editor per type — a disclosed
  // simplification, same spirit as this page's own Connections graph
  // already being a lighter version of learning-dashboard.html's fuller
  // canvas. A "Mind Map" Creation is a free-text idea capture, not the
  // real node-graph engine below — that engine is scoped to each
  // notebook's own Active Research Hub, per the request's own framing.
  var CREATION_TYPES = [
    { key: 'article', label: 'Article', icon: '📄' },
    { key: 'essay', label: 'Essay', icon: '✍️' },
    { key: 'mindmap', label: 'Mind Map', icon: '🧠' },
    { key: 'other', label: 'Other', icon: '✨' }
  ];
  var CREATION_TYPE_KEYS = CREATION_TYPES.map(function (t) { return t.key; });

  // ---------- Models ----------
  function notebookModel(data) {
    data = data || {};
    var pct = num(data.progressPct, 0);
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return {
      id: data.id || uid('nb'),
      name: str(data.name, 'Untitled Notebook'),
      icon: str(data.icon, '📓'),
      color: str(data.color, '#c9a876'),
      description: str(data.description, ''),
      // Learning Progress — a manual 0-100% tracker, same "manual slider,
      // not target/current math" precedent this app's other mastery-style
      // bars already use (e.g. Business OS's Goal Center) — a topic
      // doesn't have a single measurable "current" value to derive this
      // from, so it's set directly.
      progressPct: pct,
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      title: str(data.title, 'Untitled'),
      type: TYPE_KEYS.indexOf(data.type) !== -1 ? data.type : 'note',
      stage: STAGE_KEYS.indexOf(data.stage) !== -1 ? data.stage : 'inbox',
      notebookId: str(data.notebookId, ''),
      sourceUrl: str(data.sourceUrl, ''),
      author: str(data.author, ''),
      cover: str(data.cover, ''),
      rawContent: str(data.rawContent, ''),
      // excerpts[]: {id, text, layer: 1 (bold) | 2 (highlighted/promoted), createdAt}
      excerpts: arr(data.excerpts).filter(function (e) { return e && typeof e.text === 'string'; }),
      summary: str(data.summary, ''),
      synthesis: str(data.synthesis, ''),
      tags: arr(data.tags).filter(function (t) { return typeof t === 'string' && t; }),
      links: arr(data.links).filter(function (l) { return typeof l === 'string' && l; }),
      favorite: !!data.favorite,
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  function templateModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tpl'),
      name: str(data.name, 'Untitled Template'),
      icon: str(data.icon, '📄'),
      type: TYPE_KEYS.indexOf(data.type) !== -1 ? data.type : 'note',
      stage: STAGE_KEYS.indexOf(data.stage) !== -1 ? data.stage : 'inbox',
      notebookName: str(data.notebookName, 'General Notes'),
      notebookIcon: str(data.notebookIcon, '🗒️'),
      prompts: arr(data.prompts).filter(function (p) { return typeof p === 'string' && p; }),
      description: str(data.description, ''),
      order: num(data.order, Date.now()),
      builtin: !!data.builtin,
      createdAt: data.createdAt || nowIso()
    };
  }

  // Active Research Hub — two mind maps per notebook (mapType 'topic' /
  // 'questions'), both a flat parentId-linked tree in ONE collection
  // (same flat-array-plus-foreign-key convention as everything else in
  // this app, e.g. business-data.js's BinderNode) rather than a nested
  // structure — a node's own children are just "every other node whose
  // parentId === this node's id", computed on read (mindMapChildren()
  // below), never stored as a nested list.
  //
  // Map 1 ("topic"): the general topic + branching sub-topics — plain
  // title/notes per branch.
  // Map 2 ("questions"): "linked with the first one and with the actual
  // notebook" — the notebook link is implicit (notebookId, same as map
  // 1); the map-1 link is explicit (linkedTopicNodeId, optional, a cross-
  // reference to one node in that same notebook's topic map). Every real
  // (non-root) node in this map carries the auto-generated "article"
  // template the request specified verbatim: a Main Question plus six
  // fixed follow-up prompts (Why?/How?/Evidence?/Opposing Views?/Missing
  // Information?/Other questions) — see addMindMapBranch() below, which
  // is what actually makes this "automatic": a brand new branch already
  // has that shape the instant it's created, nothing extra to set up.
  function mindMapNodeModel(data) {
    data = data || {};
    var a = data.article || {};
    return {
      id: data.id || uid('mm'),
      notebookId: str(data.notebookId, ''),
      mapType: data.mapType === 'questions' ? 'questions' : 'topic',
      parentId: data.parentId || null,
      title: str(data.title, 'Untitled Branch'),
      notes: str(data.notes, ''),
      linkedTopicNodeId: str(data.linkedTopicNodeId, ''),
      article: {
        mainQuestion: str(a.mainQuestion, ''),
        why: str(a.why, ''),
        how: str(a.how, ''),
        evidence: str(a.evidence, ''),
        opposingViews: str(a.opposingViews, ''),
        missingInfo: str(a.missingInfo, ''),
        other: str(a.other, '')
      },
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // Permanent Knowledge Database — one record per notebook (a notebook
  // *is* "a topic" in this app's own vocabulary — see Notebooks above),
  // holding the nine sections the request named. Most sections are small
  // item lists rather than one field each, since "Key Concepts"/
  // "Definitions"/"Examples"/etc. are naturally many small entries, not
  // one block of text — Summary is the one genuinely single-value field.
  function permanentKnowledgeModel(data) {
    data = data || {};
    function items(list) { return arr(list).filter(function (x) { return x && typeof x === 'object'; }); }
    return {
      id: data.id || uid('pk'),
      notebookId: str(data.notebookId, ''),
      summary: str(data.summary, ''),
      keyConcepts: items(data.keyConcepts),       // {id, text}
      mentalModels: items(data.mentalModels),     // {id, text}
      definitions: items(data.definitions),       // {id, term, definition}
      examples: items(data.examples),             // {id, text}
      analogies: items(data.analogies),           // {id, text}
      quotes: items(data.quotes),                 // {id, text, source}
      diagrams: items(data.diagrams),              // {id, url, caption}
      linkedNoteIds: arr(data.linkedNoteIds).filter(function (id) { return typeof id === 'string' && id; }),
      createdAt: data.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  function creationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('cr'),
      title: str(data.title, 'Untitled Creation'),
      type: CREATION_TYPE_KEYS.indexOf(data.type) !== -1 ? data.type : 'article',
      body: str(data.body, ''),
      notebookId: str(data.notebookId, ''),
      linkedNoteIds: arr(data.linkedNoteIds).filter(function (id) { return typeof id === 'string' && id; }),
      status: ['draft', 'in-progress', 'done'].indexOf(data.status) !== -1 ? data.status : 'draft',
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  var Notebooks = makeCollection('kh:notebooks', notebookModel);
  var Notes = makeCollection('kh:notes', noteModel);
  var Templates = makeCollection('kh:templates', templateModel);
  var MindMapNodes = makeCollection('kh:mindmapnodes', mindMapNodeModel);
  var PermanentKnowledge = makeCollection('kh:permanentknowledge', permanentKnowledgeModel);
  var Creations = makeCollection('kh:creations', creationModel);

  // ---------- Selectors ----------
  function notebooksSorted() { return Notebooks.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function templatesSorted() { return Templates.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function notesSorted() { return Notes.list().slice().sort(function (a, b) { return b.order - a.order; }); }
  function notesForStage(stage) { return Notes.list().filter(function (n) { return n.stage === stage; }); }
  function notesForNotebook(id) { return Notes.list().filter(function (n) { return n.notebookId === id; }); }
  function notesForType(type) { return Notes.list().filter(function (n) { return n.type === type; }); }
  function notebookName(id) { var nb = Notebooks.get(id); return nb ? nb.name : ''; }
  function notebookIcon(id) { var nb = Notebooks.get(id); return nb ? nb.icon : '📓'; }
  function stageMeta(key) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i]; return STAGES[0]; }
  function typeMeta(key) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === key) return TYPES[i]; return TYPES[1]; }

  function findOrCreateNotebook(name, icon) {
    var nbs = Notebooks.list();
    for (var i = 0; i < nbs.length; i++) {
      if (nbs[i].name.toLowerCase() === String(name).toLowerCase()) return nbs[i];
    }
    return Notebooks.add({ name: name, icon: icon || '📓', order: nbs.length ? Math.max.apply(null, nbs.map(function (n) { return n.order; })) + 1 : 0 });
  }

  function autoNotebookForType(type) {
    var meta = TYPE_NOTEBOOK_MAP[type] || TYPE_NOTEBOOK_MAP.note;
    return findOrCreateNotebook(meta.name, meta.icon);
  }

  // Quick Capture — the instant, mobile-friendly widget. Minimal fields,
  // auto-files by type via autoNotebookForType(), always lands in Inbox
  // (per the funnel's own definition — a fresh capture is unreviewed by
  // definition, regardless of its type).
  function quickCapture(opts) {
    opts = opts || {};
    var nb = autoNotebookForType(opts.type);
    return Notes.add({
      title: str(opts.title, '') || (str(opts.rawContent, '').slice(0, 60) || (typeMeta(opts.type).label + ' — ' + new Date().toLocaleDateString())),
      type: opts.type || 'jot',
      stage: 'inbox',
      notebookId: nb.id,
      sourceUrl: str(opts.sourceUrl, ''),
      rawContent: str(opts.rawContent, '')
    });
  }

  // Media Capture — URL-first flow. The actual oEmbed fetch is driven from
  // knowledge-hub.html (same detectSource/getYouTubeId/oEmbed-fetch
  // technique already ported into this app twice before —
  // entertainment-hub-data.js originally, then fitnessstudio.html/
  // gallery-card's own copies) since it's a network call, not a pure data
  // function; this just files the resulting note once the caller has the
  // fetched fields in hand.
  function mediaCapture(opts) {
    opts = opts || {};
    var type = opts.type === 'video' ? 'video' : 'article';
    var nb = autoNotebookForType(type);
    return Notes.add({
      title: str(opts.title, '') || 'Untitled ' + typeMeta(type).label,
      type: type,
      stage: 'inbox',
      notebookId: nb.id,
      sourceUrl: str(opts.url, ''),
      author: str(opts.author, ''),
      cover: str(opts.cover, ''),
      rawContent: str(opts.description, '')
    });
  }

  function createNoteFromTemplate(templateId, overrides) {
    var tpl = Templates.get(templateId);
    if (!tpl) return null;
    var nb = findOrCreateNotebook(tpl.notebookName, tpl.notebookIcon);
    overrides = overrides || {};
    return Notes.add(Object.assign({
      type: tpl.type,
      stage: tpl.stage,
      notebookId: nb.id,
      title: tpl.name + ' — ' + new Date().toLocaleDateString()
    }, overrides));
  }

  // ---------- Linking / "web of ideas" ----------
  var WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
  function extractWikiTitles(text) {
    var out = [], m;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(String(text || '')))) out.push(m[1].trim());
    return out;
  }
  function noteTextFields(note) {
    return [note.rawContent, note.summary, note.synthesis]
      .concat((note.excerpts || []).map(function (e) { return e.text; }))
      .join('\n');
  }
  function resolveNoteByTitle(title) {
    var t = String(title || '').trim().toLowerCase();
    var l = Notes.list();
    for (var i = 0; i < l.length; i++) if (l[i].title.trim().toLowerCase() === t) return l[i];
    return null;
  }
  // Outgoing = explicit links[] plus every [[Title]] mention across the
  // note's own text fields that resolves to a real note. Backlinks = every
  // OTHER note that links to (or wiki-mentions) this one. Both dedup'd by id.
  function connectionsFor(noteId) {
    var note = Notes.get(noteId);
    if (!note) return { outgoing: [], backlinks: [] };
    var outIds = {};
    (note.links || []).forEach(function (id) { if (Notes.get(id)) outIds[id] = true; });
    extractWikiTitles(noteTextFields(note)).forEach(function (title) {
      var t = resolveNoteByTitle(title);
      if (t && t.id !== noteId) outIds[t.id] = true;
    });
    var backIds = {};
    Notes.list().forEach(function (n) {
      if (n.id === noteId) return;
      if ((n.links || []).indexOf(noteId) !== -1) { backIds[n.id] = true; return; }
      var titles = extractWikiTitles(noteTextFields(n));
      for (var i = 0; i < titles.length; i++) {
        if (titles[i].trim().toLowerCase() === note.title.trim().toLowerCase()) { backIds[n.id] = true; break; }
      }
    });
    return {
      outgoing: Object.keys(outIds).map(function (id) { return Notes.get(id); }).filter(Boolean),
      backlinks: Object.keys(backIds).map(function (id) { return Notes.get(id); }).filter(Boolean)
    };
  }
  // Every note that has at least one connection either direction — powers
  // the Connections graph's default "only connected" view.
  function allConnectedNoteIds() {
    var ids = {};
    Notes.list().forEach(function (n) {
      var c = connectionsFor(n.id);
      if (c.outgoing.length || c.backlinks.length) ids[n.id] = true;
    });
    return Object.keys(ids);
  }

  // ---------- Active Research Hub (Mind Maps) ----------
  function mindMapNodesForNotebook(notebookId, mapType) {
    return MindMapNodes.list().filter(function (n) { return n.notebookId === notebookId && n.mapType === mapType; });
  }
  function mindMapChildren(notebookId, mapType, parentId) {
    return mindMapNodesForNotebook(notebookId, mapType)
      .filter(function (n) { return n.parentId === parentId; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  // Every notebook gets its root branch created lazily, on first visit —
  // same "created on demand, not pre-populated on every notebook" spirit
  // as findOrCreateNotebook() itself.
  function ensureMindMapRoot(notebookId, mapType) {
    var existing = mindMapNodesForNotebook(notebookId, mapType).filter(function (n) { return !n.parentId; });
    if (existing.length) return existing[0];
    var nb = Notebooks.get(notebookId);
    var title = mapType === 'questions' ? 'Questions & Connections' : (nb ? nb.name : 'Topic');
    return MindMapNodes.add({ notebookId: notebookId, mapType: mapType, parentId: null, title: title, order: 0 });
  }
  // The literal "automatic template page" the request asked for: a brand
  // new branch in the questions map is born already shaped like the
  // article (an empty Main Question + the six fixed prompts) — there's no
  // separate "generate the template" step, it's inherent to creating the
  // branch at all.
  function addMindMapBranch(notebookId, mapType, parentId) {
    var siblings = mindMapChildren(notebookId, mapType, parentId);
    return MindMapNodes.add({
      notebookId: notebookId, mapType: mapType, parentId: parentId,
      title: mapType === 'questions' ? 'New Question' : 'New Branch',
      order: siblings.length
    });
  }
  // Deleting a branch takes its whole subtree with it (a dangling branch
  // whose parent no longer exists would just orphan the tree) — never
  // touches the map's own root.
  function removeMindMapNodeCascade(id) {
    var toDelete = {}; toDelete[id] = true;
    var changed = true;
    while (changed) {
      changed = false;
      MindMapNodes.list().forEach(function (n) {
        if (n.parentId && toDelete[n.parentId] && !toDelete[n.id]) { toDelete[n.id] = true; changed = true; }
      });
    }
    Object.keys(toDelete).forEach(function (did) { MindMapNodes.remove(did); });
  }
  // A pure layout function (no DOM/pixels) — assigns every node a
  // {depth, slot} pair via the standard "a parent's slot is the average
  // of its children's" tidy-tree technique, so a page rendering this can
  // turn depth/slot into real x/y pixels however it likes. Kept in the
  // data layer since it only depends on parentId/order, not rendering.
  function computeMindMapLayout(nodes, rootId) {
    var byParent = {};
    nodes.forEach(function (n) {
      var key = n.parentId || '__root__';
      (byParent[key] = byParent[key] || []).push(n);
    });
    Object.keys(byParent).forEach(function (k) { byParent[k].sort(function (a, b) { return a.order - b.order; }); });
    var positions = {};
    var leafCounter = 0;
    function layout(nodeId, depth) {
      var children = byParent[nodeId] || [];
      if (!children.length) {
        positions[nodeId] = { depth: depth, slot: leafCounter };
        leafCounter++;
        return positions[nodeId].slot;
      }
      var slots = children.map(function (c) { return layout(c.id, depth + 1); });
      var slot = slots.reduce(function (a, b) { return a + b; }, 0) / slots.length;
      positions[nodeId] = { depth: depth, slot: slot };
      return slot;
    }
    if (rootId) layout(rootId, 0);
    return positions;
  }

  // ---------- Permanent Knowledge Database ----------
  function permanentKnowledgeForNotebook(notebookId) {
    var l = PermanentKnowledge.list();
    for (var i = 0; i < l.length; i++) if (l[i].notebookId === notebookId) return l[i];
    return PermanentKnowledge.add({ notebookId: notebookId });
  }
  function pkAddItem(notebookId, field, item) {
    var pk = permanentKnowledgeForNotebook(notebookId);
    var list = (pk[field] || []).concat([Object.assign({ id: uid('pki') }, item)]);
    var patch = {}; patch[field] = list;
    return PermanentKnowledge.update(pk.id, patch);
  }
  function pkRemoveItem(notebookId, field, itemId) {
    var pk = permanentKnowledgeForNotebook(notebookId);
    var list = (pk[field] || []).filter(function (x) { return x.id !== itemId; });
    var patch = {}; patch[field] = list;
    return PermanentKnowledge.update(pk.id, patch);
  }
  function pkUpdateSummary(notebookId, text) {
    var pk = permanentKnowledgeForNotebook(notebookId);
    return PermanentKnowledge.update(pk.id, { summary: text });
  }
  function pkToggleLinkedNote(notebookId, noteId) {
    var pk = permanentKnowledgeForNotebook(notebookId);
    var has = pk.linkedNoteIds.indexOf(noteId) !== -1;
    var list = has ? pk.linkedNoteIds.filter(function (x) { return x !== noteId; }) : pk.linkedNoteIds.concat([noteId]);
    return PermanentKnowledge.update(pk.id, { linkedNoteIds: list });
  }
  function permanentKnowledgeItemCount(notebookId) {
    var pk = permanentKnowledgeForNotebook(notebookId);
    return pk.keyConcepts.length + pk.mentalModels.length + pk.definitions.length + pk.examples.length +
      pk.analogies.length + pk.quotes.length + pk.diagrams.length + pk.linkedNoteIds.length + (pk.summary ? 1 : 0);
  }

  // ---------- Creation Lab ----------
  function creationsSorted() { return Creations.list().slice().sort(function (a, b) { return b.order - a.order; }); }
  function creationsForNotebook(notebookId) { return Creations.list().filter(function (c) { return c.notebookId === notebookId; }); }

  // ---------- Today's Focus ----------
  function todaysFocus() {
    return Object.assign(
      { topic: '', chapter: '', studyTime: '', phase: 'discover', nextAction: '' },
      storeGet('kh:todaysfocus', {})
    );
  }
  function saveTodaysFocus(patch) {
    var rec = Object.assign(todaysFocus(), patch);
    storeSet('kh:todaysfocus', rec);
    return rec;
  }

  // Deleting a notebook cascades everything that only ever made sense
  // scoped to it (its two mind maps, its Permanent Knowledge record) —
  // Notes are "unfiled" instead of deleted (same precedent this file
  // already used before this section existed), and Creations just lose
  // their notebook reference rather than being deleted, same null-out-
  // the-reference precedent this app's other pages already established
  // for less-tightly-scoped relationships.
  function removeNotebookCascade(notebookId) {
    Notes.list().filter(function (n) { return n.notebookId === notebookId; }).forEach(function (n) { Notes.update(n.id, { notebookId: '' }); });
    MindMapNodes.list().filter(function (n) { return n.notebookId === notebookId; }).forEach(function (n) { MindMapNodes.remove(n.id); });
    PermanentKnowledge.list().filter(function (p) { return p.notebookId === notebookId; }).forEach(function (p) { PermanentKnowledge.remove(p.id); });
    Creations.list().filter(function (c) { return c.notebookId === notebookId; }).forEach(function (c) { Creations.update(c.id, { notebookId: '' }); });
    Notebooks.remove(notebookId);
  }

  // ---------- Notebook health / clutter ----------
  var STALE_DAYS = 7;
  function notebookHealth() {
    var nbs = notebooksSorted();
    var now = Date.now();
    return nbs.map(function (nb) {
      var notes = notesForNotebook(nb.id);
      var total = notes.length;
      var inboxCount = notes.filter(function (n) { return n.stage === 'inbox' || n.stage === 'toreview'; }).length;
      var synthesisCount = notes.filter(function (n) { return n.stage === 'synthesis'; }).length;
      var staleCount = notes.filter(function (n) {
        return (n.stage === 'inbox' || n.stage === 'toreview') && (now - new Date(n.createdAt).getTime()) / 86400000 > STALE_DAYS;
      }).length;
      return {
        notebook: nb,
        total: total,
        inboxCount: inboxCount,
        synthesisCount: synthesisCount,
        staleCount: staleCount,
        clutterPct: total ? Math.round((inboxCount / total) * 100) : 0,
        synthesisPct: total ? Math.round((synthesisCount / total) * 100) : 0
      };
    });
  }
  function funnelCounts() {
    var counts = {};
    STAGES.forEach(function (s) { counts[s.key] = 0; });
    Notes.list().forEach(function (n) { counts[n.stage] = (counts[n.stage] || 0) + 1; });
    return counts;
  }

  // ---------- Sorting (Home's "Sort your notes by Date / Status / Notebooks / Last Edited") ----------
  function sortNotes(list, mode) {
    var l = list.slice();
    if (mode === 'status') {
      l.sort(function (a, b) { return STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage) || b.order - a.order; });
    } else if (mode === 'notebook') {
      l.sort(function (a, b) { return notebookName(a.notebookId).localeCompare(notebookName(b.notebookId)) || b.order - a.order; });
    } else if (mode === 'lastEdited') {
      l.sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
    } else { // 'date' (created), default
      l.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }
    return l;
  }

  // ---------- Seed data ----------
  var BUILTIN_TEMPLATES = [
    { name: 'Book Note', icon: '📚', type: 'book', stage: 'inbox', notebookName: 'Books', notebookIcon: '📚',
      prompts: ['Key thesis / what is this book actually arguing?', 'Chapter-by-chapter breakdown', 'Quotes worth keeping', 'My own take / where I disagree'], builtin: true, description: 'A full book-note scaffold, ready to move through the funnel.' },
    { name: 'Article Note', icon: '📄', type: 'article', stage: 'inbox', notebookName: 'Articles', notebookIcon: '📄',
      prompts: ['Main claim', 'Supporting evidence', 'What this connects to'], builtin: true, description: 'A quick scaffold for a saved article or blog post.' },
    { name: 'Video Note', icon: '🎬', type: 'video', stage: 'inbox', notebookName: 'Videos', notebookIcon: '🎬',
      prompts: ['Key timestamps', 'Main takeaway', 'Follow-up to watch/read'], builtin: true, description: 'For a YouTube video or lecture you want to actually process.' },
    { name: 'Research Project', icon: '🔬', type: 'note', stage: 'inbox', notebookName: 'Research Projects', notebookIcon: '🔬',
      prompts: ['Research question', 'Sources gathered', 'Open threads', 'Working conclusion'], builtin: true, description: 'A running research thread you\'ll pull many sources into.' },
    { name: 'Essay Draft', icon: '✍️', type: 'note', stage: 'synthesis', notebookName: 'Essays', notebookIcon: '✍️',
      prompts: ['Thesis', 'Supporting notes to pull from ([[link them]])', 'Draft'], builtin: true, description: 'Skips straight to Synthesis — for when you already know you\'re writing.' },
    { name: 'Quick Jot', icon: '⚡', type: 'jot', stage: 'inbox', notebookName: 'Quick Jots', notebookIcon: '⚡',
      prompts: [], builtin: true, description: 'The fastest possible capture — a single loose thought.' },
    { name: 'Quote Capture', icon: '💬', type: 'quote', stage: 'inbox', notebookName: 'Quotes', notebookIcon: '💬',
      prompts: ['Full quote text', 'Source / author', 'Why it stuck with you'], builtin: true, description: 'Feeds the Quote Library.' }
  ];

  function seedIfEmpty() {
    if (Notebooks.list().length || Notes.list().length || Templates.list().length) return;
    BUILTIN_TEMPLATES.forEach(function (t, i) { Templates.add(Object.assign({}, t, { order: i })); });

    var books = findOrCreateNotebook('Books', '📚');
    var articles = findOrCreateNotebook('Articles', '📄');
    var research = findOrCreateNotebook('Research Projects', '🔬');
    var quotes = findOrCreateNotebook('Quotes', '💬');

    var n1 = Notes.add({
      title: 'Atomic Habits — James Clear', type: 'book', stage: 'summarizing', notebookId: books.id,
      author: 'James Clear', rawContent: 'Small, 1% changes compound over time. Identity-based habits stick better than outcome-based ones.',
      excerpts: [
        { id: uid('ex'), text: 'You do not rise to the level of your goals. You fall to the level of your systems.', layer: 2, createdAt: nowIso() },
        { id: uid('ex'), text: 'Every action you take is a vote for the type of person you wish to become.', layer: 1, createdAt: nowIso() }
      ],
      summary: 'Habits are identity votes, not one-off wins — build systems, not goals.',
      tags: ['habits', 'systems']
    });
    var n2 = Notes.add({
      title: 'Why Progressive Summarization Works', type: 'article', stage: 'highlighting', notebookId: articles.id,
      sourceUrl: 'https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/',
      rawContent: 'Progressive Summarization is a layered approach to condensing notes over multiple passes, so future-you only has to read the distilled version.',
      excerpts: [{ id: uid('ex'), text: 'The goal isn\'t to remember everything — it\'s to make your best ideas easy to find later.', layer: 1, createdAt: nowIso() }],
      tags: ['pkm', 'note-taking'], links: []
    });
    Notes.update(n2.id, { links: [n1.id] });
    Notes.add({
      title: 'Second Brain research thread', type: 'note', stage: 'inbox', notebookId: research.id,
      rawContent: 'Collecting sources on building a personal knowledge system. See [[Why Progressive Summarization Works]] and [[Atomic Habits — James Clear]] for related notes.',
      tags: ['research']
    });
    Notes.add({
      title: '"The unexamined life is not worth living."', type: 'quote', stage: 'synthesis', notebookId: quotes.id,
      author: 'Socrates', rawContent: 'A reminder to keep interrogating my own assumptions, not just accumulating notes.',
      synthesis: 'Capturing without reflecting is just hoarding — this is the whole argument for the funnel existing at all.',
      favorite: true, tags: ['philosophy']
    });
    Notes.add({
      title: 'Interesting talk on spaced repetition', type: 'video', stage: 'toreview', notebookId: findOrCreateNotebook('Videos', '🎬').id,
      sourceUrl: '', rawContent: ''
    });

    // Learning Progress, seeded on a couple of notebooks so the bar/
    // grids aren't all zero on first load.
    Notebooks.update(books.id, { progressPct: 42 });
    Notebooks.update(research.id, { progressPct: 18 });

    // Active Research Hub — a small real topic map + a small real
    // questions map on the Books notebook, one cross-linked to the
    // other, so the feature demonstrates its own shape immediately.
    var topicRoot = ensureMindMapRoot(books.id, 'topic');
    var habitsBranch = MindMapNodes.add({ notebookId: books.id, mapType: 'topic', parentId: topicRoot.id, title: 'Habit Formation', notes: 'The cue-routine-reward loop, and how identity change makes it stick.', order: 0 });
    MindMapNodes.add({ notebookId: books.id, mapType: 'topic', parentId: habitsBranch.id, title: 'The Habit Loop', notes: 'Cue -> Craving -> Response -> Reward.', order: 0 });
    MindMapNodes.add({ notebookId: books.id, mapType: 'topic', parentId: habitsBranch.id, title: 'Identity-Based Habits', notes: 'Vote for the person you want to become, one action at a time.', order: 1 });
    MindMapNodes.add({ notebookId: books.id, mapType: 'topic', parentId: topicRoot.id, title: 'Systems vs. Goals', notes: 'You fall to the level of your systems, not your goals.', order: 1 });

    var qRoot = ensureMindMapRoot(books.id, 'questions');
    MindMapNodes.add({
      notebookId: books.id, mapType: 'questions', parentId: qRoot.id, title: 'Do 1% gains really compound?',
      linkedTopicNodeId: habitsBranch.id,
      article: {
        mainQuestion: 'Does a 1% daily improvement genuinely compound the way the book claims, or is that just a tidy story?',
        why: 'It\'s the book\'s central hook — if it doesn\'t hold up, a lot of the argument softens.',
        how: 'Compare the math (1.01^365) against how real skill acquisition actually plateaus.',
        evidence: 'Compound-interest-style growth curves; also plenty of real "diminishing returns" counter-cases.',
        opposingViews: 'Skill growth is usually S-curved, not exponential — early gains come fast, then flatten.',
        missingInfo: 'No real longitudinal study is cited for the 1%-a-day claim specifically.',
        other: 'Does this change if the "system" itself is what compounds, not the individual actions?'
      }
    });

    // Permanent Knowledge Database — a few seeded items on the Books
    // notebook across several of the nine sections.
    var pk = permanentKnowledgeForNotebook(books.id);
    PermanentKnowledge.update(pk.id, {
      summary: 'Behavior change is best driven by small, identity-aligned systems rather than big one-off goals — the habit loop (cue/craving/response/reward) is the underlying mechanism.',
      keyConcepts: [{ id: uid('pki'), text: 'The Habit Loop (cue, craving, response, reward)' }, { id: uid('pki'), text: 'Identity-based habits' }],
      mentalModels: [{ id: uid('pki'), text: 'You do not rise to the level of your goals, you fall to the level of your systems.' }],
      definitions: [{ id: uid('pki'), term: 'Habit stacking', definition: 'Anchoring a new habit to an already-automatic one.' }],
      examples: [{ id: uid('pki'), text: 'Laying out running shoes the night before to lower the friction of a morning run.' }],
      analogies: [{ id: uid('pki'), text: 'Habits are like a river carving a canyon — each pass makes the next one easier.' }],
      quotes: [{ id: uid('pki'), text: 'Every action you take is a vote for the type of person you wish to become.', source: 'James Clear' }],
      linkedNoteIds: [n1.id]
    });

    // Creation Lab — one starter creation, referencing the seeded book note.
    Creations.add({
      title: 'Why small systems beat big goals', type: 'essay', notebookId: books.id,
      body: 'Draft thesis: ambition concentrated into a single big goal is fragile; ambition distributed across small daily systems compounds. Pull from [[Atomic Habits — James Clear]] for the identity-vote framing.',
      linkedNoteIds: [n1.id], status: 'draft'
    });

    // Today's Focus — a sensible default reflecting the seeded data above.
    saveTodaysFocus({
      topic: 'Atomic Habits — James Clear', chapter: 'Ch. 3 — How to Build a New Habit',
      studyTime: '30 min', phase: 'understand', nextAction: 'Fill in the "Evidence?" prompt on the 1%-gains question branch.'
    });
  }

  window.KnowledgeHubData = {
    STAGES: STAGES, STAGE_KEYS: STAGE_KEYS, TYPES: TYPES, TYPE_KEYS: TYPE_KEYS,
    FOCUS_PHASES: FOCUS_PHASES, CREATION_TYPES: CREATION_TYPES, CREATION_TYPE_KEYS: CREATION_TYPE_KEYS,
    Notebooks: Notebooks, Notes: Notes, Templates: Templates,
    MindMapNodes: MindMapNodes, PermanentKnowledge: PermanentKnowledge, Creations: Creations,
    notebooksSorted: notebooksSorted, templatesSorted: templatesSorted, notesSorted: notesSorted,
    notesForStage: notesForStage, notesForNotebook: notesForNotebook, notesForType: notesForType,
    notebookName: notebookName, notebookIcon: notebookIcon, stageMeta: stageMeta, typeMeta: typeMeta,
    findOrCreateNotebook: findOrCreateNotebook, autoNotebookForType: autoNotebookForType,
    quickCapture: quickCapture, mediaCapture: mediaCapture, createNoteFromTemplate: createNoteFromTemplate,
    extractWikiTitles: extractWikiTitles, noteTextFields: noteTextFields, resolveNoteByTitle: resolveNoteByTitle,
    connectionsFor: connectionsFor, allConnectedNoteIds: allConnectedNoteIds,
    notebookHealth: notebookHealth, funnelCounts: funnelCounts, sortNotes: sortNotes,
    mindMapNodesForNotebook: mindMapNodesForNotebook, mindMapChildren: mindMapChildren,
    ensureMindMapRoot: ensureMindMapRoot, addMindMapBranch: addMindMapBranch,
    removeMindMapNodeCascade: removeMindMapNodeCascade, computeMindMapLayout: computeMindMapLayout,
    permanentKnowledgeForNotebook: permanentKnowledgeForNotebook, pkAddItem: pkAddItem, pkRemoveItem: pkRemoveItem,
    pkUpdateSummary: pkUpdateSummary, pkToggleLinkedNote: pkToggleLinkedNote, permanentKnowledgeItemCount: permanentKnowledgeItemCount,
    creationsSorted: creationsSorted, creationsForNotebook: creationsForNotebook,
    todaysFocus: todaysFocus, saveTodaysFocus: saveTodaysFocus,
    removeNotebookCascade: removeNotebookCascade,
    isEmptyEverywhere: function () { return !Notebooks.list().length && !Notes.list().length && !Templates.list().length; },
    seedIfEmpty: seedIfEmpty
  };
})();
