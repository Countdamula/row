// =============================================================
// knowledge-hub-data.js — data layer for Knowledge Hub v2: a Learning &
// Knowledge Operating System, not a note-taking app. Full replace of the
// prior funnel/notebook/Progressive-Summarization model (see
// knowledge-hub.html's own header comment for why this is a clean
// replace, not a migration) — every kh:notebooks/kh:notes/kh:templates/
// kh:mindmapnodes/kh:permanentknowledge/kh:creations key from that model
// is left orphaned, untouched, same treatment as every other superseded
// feature in this app (CLAUDE.md §4's own orphaned-row table).
//
// Same makeCollection()/model-factory conventions as every other page's
// own -data.js (aitech-data.js, businessdash-data.js, mainpillar-data.js,
// etc.). Every key here is `kh:`-prefixed, covered by knowledge-hub.html's
// own initCloudSync({ appKey: 'knowledgehub', syncedPrefixes: ['kh:'] })
// call — nothing new invented.
//
// ---------------------------------------------------------------------
// Architecture: 11 fixed department "workspaces" (DEPARTMENT_DEFS below —
// not user-addable/removable, matching the spec's own named list), each a
// row in the Departments collection so its editable fields (quote,
// mission, currentFocus, masteryPct, etc.) persist. Every other
// collection here (Resources, PermanentNotes, Questions, ResearchItems,
// Projects, Objectives, MindMapNodes, StudySessions) is scoped to a
// department via a plain `departmentId` foreign key — one generic set of
// collections/selectors serves all 11 departments, rather than 11
// hand-written data models (the same "one generic model, filtered many
// ways" precedent this app's other multi-view pages already use, e.g.
// mediaverse-data.js's single MediaItem collection covering ten
// categories, aitech-data.js's Model/Prompt split).
//
// Three levels of mind maps share ONE flat MindMapNodes collection (a
// parentId-linked tree, same convention as business-data.js's BinderNode
// or the prior knowledge-hub model), distinguished by `mapLevel` +
// `scopeId`:
//   mapLevel:'master'   scopeId = departmentId        (one per department)
//   mapLevel:'resource' scopeId = a Resource's id      (one per resource)
//   mapLevel:'concept'  scopeId = a PermanentNote's id  (one per concept —
//     "every important concept eventually gets its own evolving map";
//     PermanentNotes ARE this app's "concepts," since a concept map
//     "combines ideas from multiple books instead of belonging to one
//     source," which is exactly what a PermanentNote's own
//     booksReferenced/articlesReferenced/relatedConceptIds already do)
// computeMindMapLayout() (a pure tidy-tree layout function, unchanged
// from the prior model) works identically across all three levels since
// it only ever depends on parentId/order, never on mapLevel/scopeId.
//
// The Knowledge Graph (per-department AND global) is computed, never
// stored — buildDepartmentGraph()/buildGlobalGraph() below walk every
// collection's own cross-references (PermanentNote.booksReferenced/
// articlesReferenced/relatedConceptIds/questionIds/projectIds) into a
// {nodes, edges} pair on every call. This is what "automatically
// connect" means in practice — there is no second, separately-maintained
// graph data structure that could drift from the real records. The one
// thing that ISN'T automatically derivable is a cross-department link
// (Psychology -> Neuroscience -> AI) since nothing in one department's
// own data structurally points at another department — that's the small
// CrossLinks collection, which powers both a department's own
// "Connections" section and the Global graph's cross-department edges.
//
// AI Integration follows this app's own established "real fetch() if a
// key is configured, always a genuinely useful local fallback otherwise"
// pattern (Main Pillar's Briefs, Fitness Studio's AI Coach). The actual
// network call lives in knowledge-hub.html (a page-level fetch, matching
// every other AI feature in this app); this file only builds the prompt
// text and computes the local fallback, both pure functions of real
// stored data — see buildAiPrompt()/aiLocalFallback() near the bottom.
// =============================================================
(function () {
  'use strict';

  // ---------- Storage primitives (same shape as every other -data.js) ----------
  function storeGet(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  // Same honest-save-signal storeSet() as every other page's own -data.js
  // (a failed write — most likely this origin's shared localStorage quota
  // — dispatches a 'kh:save' event either way instead of vanishing
  // silently, so knowledge-hub.html can show a dismissible banner).
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
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function str(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
  function num(v, fallback) { return typeof v === 'number' && !isNaN(v) ? v : fallback; }
  function bool(v) { return !!v; }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }
  function idArr(v) { return arr(v).filter(function (x) { return typeof x === 'string' && x; }); }
  function pick(v, allowed, fallback) { return allowed.indexOf(v) !== -1 ? v : fallback; }
  function clampPct(v) { return Math.max(0, Math.min(100, Math.round(num(v, 0)))); }

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
  var RESOURCE_TYPES = [
    { key: 'book', label: 'Books', icon: '📚' },
    { key: 'article', label: 'Articles', icon: '📄' },
    { key: 'paper', label: 'Research Papers', icon: '🔬' },
    { key: 'video', label: 'Videos', icon: '🎬' },
    { key: 'podcast', label: 'Podcasts', icon: '🎙️' },
    { key: 'course', label: 'Courses', icon: '🎓' },
    { key: 'website', label: 'Websites', icon: '🌐' },
    { key: 'pdf', label: 'PDFs', icon: '📑' },
    { key: 'bookmark', label: 'Bookmarks', icon: '🔖' },
    { key: 'ai-conversation', label: 'AI Conversations', icon: '🤖' },
    { key: 'expert', label: 'Experts', icon: '🧑‍🏫' },
    { key: 'interview', label: 'Interviews', icon: '🎤' },
    { key: 'dataset', label: 'Datasets', icon: '📊' }
  ];
  var RESOURCE_TYPE_KEYS = RESOURCE_TYPES.map(function (t) { return t.key; });

  // The Reading Pipeline Kanban — "completed resources should never
  // disappear," so `mastered` is a real, permanently-visible column, not
  // an archive. `completedAt` is stamped the moment a resource first
  // enters `mastered` (see Resources.update's onSave hook below) and is
  // what every "completed" Milestone/Progress stat actually counts.
  var PIPELINE_STAGES = [
    { key: 'inbox', label: 'Inbox', icon: '📥' },
    { key: 'want', label: 'Want to Read', icon: '🗂️' },
    { key: 'reading', label: 'Reading', icon: '📖' },
    { key: 'highlighting', label: 'Highlighting', icon: '🖍️' },
    { key: 'summarizing', label: 'Summarizing', icon: '✏️' },
    { key: 'permanentnotes', label: 'Creating Permanent Notes', icon: '🗒️' },
    { key: 'connecting', label: 'Connecting', icon: '🕸️' },
    { key: 'mastered', label: 'Mastered', icon: '🏆' }
  ];
  var PIPELINE_STAGE_KEYS = PIPELINE_STAGES.map(function (s) { return s.key; });

  var QUESTION_TYPES = [
    { key: 'dont-understand', label: "Don't Understand", icon: '❓' },
    { key: 'contradiction', label: 'Contradiction', icon: '⚡' },
    { key: 'research-idea', label: 'Research Idea', icon: '💡' },
    { key: 'hypothesis', label: 'Hypothesis', icon: '🧪' },
    { key: 'experiment', label: 'Experiment', icon: '🔭' },
    { key: 'verify', label: 'To Verify', icon: '✔️' }
  ];
  var QUESTION_TYPE_KEYS = QUESTION_TYPES.map(function (t) { return t.key; });

  var RESEARCH_TYPES = [
    { key: 'investigation', label: 'Current Investigation' },
    { key: 'paper', label: 'Research Paper' },
    { key: 'idea', label: 'Idea' },
    { key: 'hypothesis', label: 'Hypothesis' },
    { key: 'experiment', label: 'Experiment' },
    { key: 'reading', label: 'Future Reading' },
    { key: 'reference', label: 'Academic Reference' },
    { key: 'bibliography', label: 'Bibliography Entry' }
  ];
  var RESEARCH_TYPE_KEYS = RESEARCH_TYPES.map(function (t) { return t.key; });

  var OBJECTIVE_KINDS = [
    { key: 'learning-goal', label: 'Learning Goal' },
    { key: 'current-objective', label: 'Current Objective' },
    { key: 'long-term-goal', label: 'Long-Term Goal' },
    { key: 'skill-milestone', label: 'Skill Milestone' },
    { key: 'competency', label: 'Competency' }
  ];
  var OBJECTIVE_KIND_KEYS = OBJECTIVE_KINDS.map(function (o) { return o.key; });

  // The generatable/reorderable content blocks that make up a Resource or
  // Permanent Note page (see Sections below) — a Notion-style page-body
  // block set: a plain text block, a pull-quote, a collapsible toggle
  // (a heading you can expand/collapse, e.g. "Highlights"), and a
  // video/article reference card.
  var SECTION_KINDS = [
    { key: 'text', label: 'Text', icon: '📝' },
    { key: 'quote', label: 'Quote', icon: '💬' },
    { key: 'toggle', label: 'Toggle (Collapsible)', icon: '▸' },
    { key: 'media', label: 'Video / Article', icon: '🎬' }
  ];
  var SECTION_KIND_KEYS = SECTION_KINDS.map(function (s) { return s.key; });

  var MAP_LEVELS = ['master', 'resource', 'concept'];

  // The 11 fixed department "university departments." Not user-addable/
  // removable (a real DEPARTMENT_DEFS-backfill runs on every boot via
  // ensureDepartmentsExist() below, the same idempotent "ensure X exists"
  // precedent this app has used before — ensureWritingDashboardExists(),
  // ensureAnxietyTabExists(), ensureDashboardBusinessesExist()) — but
  // every field below is still just a starting DEFAULT, fully editable
  // per-department afterward via Departments.update().
  //
  // `subfields` seeds that department's Master Subject Map (Level 1) —
  // "the table of contents for the entire field," per the spec's own
  // Psychology example — as a real, disclosed starting point, not a
  // fixed taxonomy the user is stuck with; every branch is freely
  // editable/addable/removable once seeded, same as any other mind map.
  var DEPARTMENT_DEFS = [
    { id: 'psychology', icon: '🧠', name: 'Human Psychology & Neuroscience',
      quote: 'The mind is not a vessel to be filled, but a fire to be kindled.',
      mission: 'Understand how the human mind works — cognition, emotion, behavior, and the brain that produces them — well enough to explain it simply and use it wisely.',
      subfields: ['Cognitive Psychology', 'Developmental Psychology', 'Clinical Psychology', 'Social Psychology', 'Behavioral Psychology', 'Neuroscience', 'Personality Theory'] },
    { id: 'wealth', icon: '💰', name: 'Wealth Accumulation & Entrepreneurship',
      quote: 'Wealth is the transfer of value, multiplied by trust, over time.',
      mission: 'Build a durable, first-principles understanding of how value is created, captured, and compounded — in markets, in businesses, and across a career.',
      subfields: ['Investing & Markets', 'Business Strategy', 'Sales & Negotiation', 'Startups & Venture', 'Personal Finance', 'Economics', 'Leadership'] },
    { id: 'ai', icon: '🤖', name: 'Artificial Intelligence',
      quote: 'The question of whether a computer can think is no more interesting than whether a submarine can swim.',
      mission: 'Track AI from first principles to the frontier — models, tooling, and the judgment to know where it genuinely helps.',
      subfields: ['Machine Learning Foundations', 'Large Language Models', 'Prompt Engineering', 'AI Agents & Tools', 'AI Ethics & Alignment', 'Applied AI Products'] },
    { id: 'metaphysics', icon: '⚛️', name: 'Metaphysics & Quantum Physics',
      quote: 'Reality is not what it seems.',
      mission: 'Explore the nature of reality — from the philosophy of being to the strange, well-tested mechanics of the quantum world.',
      subfields: ['Ontology & Being', 'Quantum Mechanics', 'Consciousness Studies', 'Philosophy of Time', 'Cosmology', 'Determinism & Free Will'] },
    { id: 'spiritual', icon: '🔮', name: 'Spiritual Practices & Esotericism',
      quote: 'As above, so below.',
      mission: "Study the world's contemplative and esoteric traditions with an open, critical mind — practice over dogma, direct experience over hearsay.",
      subfields: ['Meditation & Contemplation', 'Hermeticism', 'Eastern Philosophy', 'Western Esotericism', 'Ritual & Symbolism', 'Energy Practices'] },
    { id: 'selfdev', icon: '🌱', name: 'Self-Development',
      quote: 'You do not rise to the level of your goals — you fall to the level of your systems.',
      mission: 'Build the internal operating system — habits, identity, discipline, and self-knowledge — that everything else in life runs on top of.',
      subfields: ['Habit Formation', 'Identity & Values', 'Discipline & Willpower', 'Emotional Intelligence', 'Goal Systems', 'Productivity'] },
    { id: 'photography', icon: '📸', name: 'Photography & Videography',
      quote: 'A photograph is a secret about a secret.',
      mission: 'Develop a real, practiced eye and technical fluency across still and motion image-making.',
      subfields: ['Composition & Light', 'Camera & Lens Technique', 'Color Grading & Editing', 'Cinematography', 'Portrait & Street', 'Gear & Workflow'] },
    { id: 'history', icon: '🏛', name: 'History',
      quote: 'Those who cannot remember the past are condemned to repeat it.',
      mission: 'Build a working map of how civilizations rose, decided, and fell — and which patterns actually repeat.',
      subfields: ['Ancient Civilizations', 'Empires & Geopolitics', 'Wars & Revolutions', 'Economic History', 'History of Ideas', 'Modern History'] },
    { id: 'astrology', icon: '✨', name: 'Astrology & Numerology',
      quote: 'The stars incline, they do not compel.',
      mission: 'Learn the symbolic systems of astrology and numerology deeply enough to read charts and numbers with real fluency, not surface-level cookbook interpretation.',
      subfields: ['Natal Chart Reading', 'Planetary Transits', 'Houses & Aspects', 'Numerology Systems', 'Synastry & Compatibility', 'Predictive Techniques'] },
    { id: 'writing', icon: '✍️', name: 'Persuasive Communication & Writing',
      quote: 'The pen is mightier than the sword, but the tongue is mightier than both.',
      mission: 'Master the craft of moving people with words — spoken and written — through structure, rhetoric, and honest persuasion.',
      subfields: ['Copywriting', 'Rhetoric & Argument', 'Storytelling Structure', 'Public Speaking', 'Editing & Style', 'Negotiation Language'] },
    { id: 'health', icon: '🌿', name: 'Holistic Health & Alternative Healing',
      quote: 'The natural healing force within each of us is the greatest force in getting well.',
      mission: 'Understand the body as one connected system — nutrition, movement, sleep, and the alternative modalities worth taking seriously.',
      subfields: ['Nutrition & Metabolism', 'Sleep Science', 'Functional Movement', 'Traditional Medicine Systems', 'Herbalism', 'Mind-Body Practices'] }
  ];
  var DEPARTMENT_IDS = DEPARTMENT_DEFS.map(function (d) { return d.id; });
  function departmentDef(id) {
    for (var i = 0; i < DEPARTMENT_DEFS.length; i++) if (DEPARTMENT_DEFS[i].id === id) return DEPARTMENT_DEFS[i];
    return null;
  }

  // ---------- Models ----------
  function departmentModel(data) {
    data = data || {};
    var def = departmentDef(data.id) || {};
    return {
      id: data.id || uid('dept'),
      icon: str(data.icon, def.icon || '🏛'),
      name: str(data.name, def.name || 'Untitled Department'),
      quote: str(data.quote, def.quote || ''),
      mission: str(data.mission, def.mission || ''),
      currentFocus: str(data.currentFocus, ''),
      // Overall Progress + Estimated Mastery share one manual slider —
      // same "manual slider, not target/current math" precedent this
      // app's other mastery-style bars already use (e.g. the prior
      // Notebook.progressPct, Business OS's Goal Center): a discipline
      // has no single measurable "current" value to derive this from.
      masteryPct: clampPct(data.masteryPct),
      order: num(data.order, DEPARTMENT_IDS.indexOf(data.id)),
      createdAt: data.createdAt || nowIso()
    };
  }

  // Every resource/note "page" is a Notion-style document — an icon,
  // an optional cover photo, a title, a handful of structured properties,
  // and then a generatable/reorderable list of content blocks (Sections,
  // below). `summary`/`review` (Resource) and `definition`/`explanation`/
  // `examples`/`applications`/`connections`/`aiDiscussion` (PermanentNote)
  // used to be fixed textarea fields on these models — per an explicit
  // follow-up request ("make sure everything in the notes and permanent
  // notes can be generated and moved"), all of that prose content is now
  // just ordinary `text`-kind Sections instead, so it's addable/
  // reorderable/deletable exactly like everything else on the page. Only
  // genuinely structured/relational data (type, stage, dates, rating,
  // tags, and the cross-reference id arrays) stays a real model field.
  function resourceModel(data) {
    data = data || {};
    return {
      id: data.id || uid('res'),
      departmentId: str(data.departmentId, ''),
      type: pick(data.type, RESOURCE_TYPE_KEYS, 'book'),
      title: str(data.title, 'Untitled Resource'),
      creator: str(data.creator, ''),
      url: str(data.url, ''),
      cover: str(data.cover, ''),
      stage: pick(data.stage, PIPELINE_STAGE_KEYS, 'inbox'),
      progressPct: clampPct(data.progressPct),
      currentChapter: str(data.currentChapter, ''),
      nextChapter: str(data.nextChapter, ''),
      estCompletion: str(data.estCompletion, ''),
      lastStudied: str(data.lastStudied, ''),
      dateStarted: str(data.dateStarted, ''),
      dateFinished: str(data.dateFinished, ''),
      rating: Math.max(0, Math.min(5, num(data.rating, 0))),
      tags: idArr(data.tags),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso(),
      completedAt: str(data.completedAt, '')
    };
  }

  // A Resource or Permanent Note page's own generatable, reorderable body
  // content — one generic item collection filtered by `scope`+`scopeId`
  // (`resource`|`note`) and `kind` (text/quote/toggle/media), the same
  // "one generic model, filtered many ways" precedent this file's own
  // header comment already cites, rather than a separate collection per
  // entity type or block kind. `collapsed` only matters for `toggle`
  // blocks (a real Notion-style disclosure triangle).
  function sectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('sec'),
      scope: pick(data.scope, ['resource', 'note'], 'resource'),
      scopeId: str(data.scopeId, ''),
      kind: pick(data.kind, SECTION_KIND_KEYS, 'text'),
      title: str(data.title, ''),
      text: str(data.text, ''),
      url: str(data.url, ''),
      collapsed: !!data.collapsed,
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // PermanentNotes ARE this system's "concepts" — a Permanent Note about
  // "Memory" builds its own definition/explanation/examples/applications
  // out of ordinary Sections (see above), which is exactly what the
  // spec's own Concept Map example describes ("combine ideas from
  // multiple books instead of belonging to one source"). Everything left
  // as a real field here is structured/relational, not prose:
  // `relatedConceptIds` is what actually drives note<->note edges in the
  // Knowledge Graph.
  function permanentNoteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      departmentId: str(data.departmentId, ''),
      title: str(data.title, 'Untitled Concept'),
      cover: str(data.cover, ''),
      relatedConceptIds: idArr(data.relatedConceptIds),
      booksReferenced: idArr(data.booksReferenced),
      articlesReferenced: idArr(data.articlesReferenced),
      questionIds: idArr(data.questionIds),
      projectIds: idArr(data.projectIds),
      sourceResourceId: str(data.sourceResourceId, ''),
      tags: idArr(data.tags),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  function questionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('q'),
      departmentId: str(data.departmentId, ''),
      type: pick(data.type, QUESTION_TYPE_KEYS, 'dont-understand'),
      text: str(data.text, ''),
      status: pick(data.status, ['open', 'answered'], 'open'),
      resourceId: str(data.resourceId, ''),
      notes: str(data.notes, ''),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  function researchItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ri'),
      departmentId: str(data.departmentId, ''),
      type: pick(data.type, RESEARCH_TYPE_KEYS, 'investigation'),
      title: str(data.title, 'Untitled'),
      notes: str(data.notes, ''),
      url: str(data.url, ''),
      status: pick(data.status, ['active', 'done'], 'active'),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // Project `type` is deliberately freeform text, not a fixed enum — the
  // spec gives a genuinely different suggested project vocabulary per
  // department (Psychology: Essay/Presentation/Teaching; AI: Prompt
  // Engineering/Coding/Model Comparisons; Photography: Portfolio/Lighting
  // Studies) — see PROJECT_TYPE_SUGGESTIONS below for a per-department
  // quick-pick list that still leaves the field fully free.
  function projectModel(data) {
    data = data || {};
    return {
      id: data.id || uid('proj'),
      departmentId: str(data.departmentId, ''),
      title: str(data.title, 'Untitled Project'),
      type: str(data.type, ''),
      status: pick(data.status, ['idea', 'in-progress', 'done'], 'idea'),
      notes: str(data.notes, ''),
      url: str(data.url, ''),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso(),
      completedAt: str(data.completedAt, '')
    };
  }

  function objectiveModel(data) {
    data = data || {};
    return {
      id: data.id || uid('obj'),
      departmentId: str(data.departmentId, ''),
      kind: pick(data.kind, OBJECTIVE_KIND_KEYS, 'learning-goal'),
      title: str(data.title, ''),
      notes: str(data.notes, ''),
      status: pick(data.status, ['active', 'done'], 'active'),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // One flat tree collection backs all THREE mind-map levels — see this
  // file's own header comment for the mapLevel/scopeId scheme.
  function mindMapNodeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mm'),
      departmentId: str(data.departmentId, ''),
      mapLevel: pick(data.mapLevel, MAP_LEVELS, 'master'),
      scopeId: str(data.scopeId, ''),
      parentId: data.parentId || null,
      title: str(data.title, 'Untitled Branch'),
      notes: str(data.notes, ''),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // The Connections Section's cross-department links — "Psychology ->
  // Neuroscience -> AI -> Entrepreneurship" — the one relationship
  // nothing else in this file can derive automatically, since one
  // department's records never structurally reference another's.
  function crossLinkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('cl'),
      fromDepartmentId: str(data.fromDepartmentId, ''),
      toDepartmentId: str(data.toDepartmentId, ''),
      label: str(data.label, ''),
      order: num(data.order, Date.now()),
      createdAt: data.createdAt || nowIso()
    };
  }

  // A single logged study session — the concrete, honest source for
  // "Learning Streak," "Hours Studied," and "Recently Studied," rather
  // than fabricating those from nothing. A quick "+ Log Study Session"
  // action on a department's Overview adds one for today.
  function studySessionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ss'),
      departmentId: str(data.departmentId, ''),
      minutes: Math.max(1, num(data.minutes, 25)),
      note: str(data.note, ''),
      dateStr: str(data.dateStr, todayStr()),
      createdAt: data.createdAt || nowIso()
    };
  }

  var Departments = makeCollection('kh:departments', departmentModel);
  var Resources = makeCollection('kh:resources', resourceModel);
  var Sections = makeCollection('kh:sections', sectionModel);
  var PermanentNotes = makeCollection('kh:permanentnotes', permanentNoteModel);
  var Questions = makeCollection('kh:questions', questionModel);
  var ResearchItems = makeCollection('kh:research', researchItemModel);
  var Projects = makeCollection('kh:projects', projectModel);
  var Objectives = makeCollection('kh:objectives', objectiveModel);
  var MindMapNodes = makeCollection('kh:mindmapnodes', mindMapNodeModel);
  var CrossLinks = makeCollection('kh:crosslinks', crossLinkModel);
  var StudySessions = makeCollection('kh:studysessions', studySessionModel);

  // Resource type -> a resource being "mastered" also counts toward this
  // milestone bucket — used by milestonesFor() below.
  var MILESTONE_TYPE_MAP = { book: 'booksCompleted', article: 'articlesStudied', paper: 'researchPapers', course: 'coursesCompleted' };

  // A resource entering `mastered` for the first time stamps completedAt
  // — same "stamp on entering, don't touch again" precedent this app's
  // own chore-completion/bucket-list-completion timestamps already use.
  function setResourceStage(id, stage) {
    var r = Resources.get(id);
    if (!r) return null;
    var patch = { stage: stage };
    if (stage === 'mastered' && !r.completedAt) patch.completedAt = nowIso();
    if (stage !== 'mastered') patch.completedAt = r.completedAt; // untouched otherwise
    return Resources.update(id, patch);
  }

  // ---------- Selectors: departments ----------
  function departmentsSorted() { return Departments.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function departmentName(id) { var d = Departments.get(id); return d ? d.name : ''; }
  function departmentIcon(id) { var d = Departments.get(id); return d ? d.icon : '🏛'; }
  // Idempotent backfill — same "ensure X exists" precedent as
  // ensureWritingDashboardExists()/ensureAnxietyTabExists() elsewhere in
  // this app: adds any of the 11 fixed departments missing from storage
  // (e.g. a device that pulled an older remote row) without ever
  // touching one that already exists, so a customized quote/mission is
  // never overwritten.
  function ensureDepartmentsExist() {
    var existingIds = {};
    Departments.list().forEach(function (d) { existingIds[d.id] = true; });
    DEPARTMENT_DEFS.forEach(function (def, i) {
      if (!existingIds[def.id]) Departments.add({ id: def.id, order: i });
    });
  }

  // ---------- Selectors: resources / pipeline ----------
  function resourcesFor(departmentId) { return Resources.list().filter(function (r) { return r.departmentId === departmentId; }); }
  function resourcesSorted(departmentId) { return resourcesFor(departmentId).sort(function (a, b) { return b.order - a.order; }); }
  function resourcesByStage(departmentId, stage) { return resourcesFor(departmentId).filter(function (r) { return r.stage === stage; }); }
  function currentLearningFor(departmentId) { return resourcesFor(departmentId).filter(function (r) { return r.stage === 'reading'; }); }
  function resourceTypeMeta(key) { for (var i = 0; i < RESOURCE_TYPES.length; i++) if (RESOURCE_TYPES[i].key === key) return RESOURCE_TYPES[i]; return RESOURCE_TYPES[0]; }
  function pipelineStageMeta(key) { for (var i = 0; i < PIPELINE_STAGES.length; i++) if (PIPELINE_STAGES[i].key === key) return PIPELINE_STAGES[i]; return PIPELINE_STAGES[0]; }

  // scope = 'resource'|'note', scopeId = that record's own id. Every
  // Resource/Note page's whole body is `sectionsFor(scope, scopeId)`, in
  // one shared order across every kind — so drag-reordering can freely
  // interleave a Text block, a Quote, a Toggle, and a Media card, exactly
  // like a real Notion page.
  function sectionsFor(scope, scopeId) {
    return Sections.list().filter(function (s) { return s.scope === scope && s.scopeId === scopeId; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function addSection(scope, scopeId, kind, patch) {
    var siblings = sectionsFor(scope, scopeId);
    return Sections.add(Object.assign({ scope: scope, scopeId: scopeId, kind: kind, order: siblings.length ? siblings[siblings.length - 1].order + 1 : 0 }, patch || {}));
  }
  // Up/down arrows (an accessible alternative to the page's own drag
  // reorder — see GlassTheme.wireMovableSections() in knowledge-hub.html).
  function moveSection(id, dir) {
    var s = Sections.get(id); if (!s) return;
    var sib = sectionsFor(s.scope, s.scopeId);
    var idx = sib.findIndex(function (x) { return x.id === id; });
    var swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sib.length) return;
    var a = sib[idx], b = sib[swapIdx];
    Sections.update(a.id, { order: b.order });
    Sections.update(b.id, { order: a.order });
  }
  // The drag-reorder persistence callback — reassigns sequential order
  // values to match the new DOM order exactly.
  function reorderSections(scope, scopeId, orderedIds) {
    orderedIds.forEach(function (id, i) {
      var s = Sections.get(id);
      if (s && s.scope === scope && s.scopeId === scopeId) Sections.update(id, { order: i });
    });
  }
  function toggleSectionCollapsed(id) { var s = Sections.get(id); if (s) Sections.update(id, { collapsed: !s.collapsed }); }

  // Seeds a couple of starting blocks the first time a Resource/Note page
  // is opened with zero sections — the same "generated on first visit,
  // fully editable afterward" precedent business.html's own Platform
  // Detail pages already established, so a brand-new page never opens
  // completely blank.
  var RESOURCE_DEFAULT_SECTIONS = [{ kind: 'text', title: 'Summary' }];
  var NOTE_DEFAULT_SECTIONS = [{ kind: 'text', title: 'Definition' }, { kind: 'text', title: 'Explanation' }];
  function ensureDefaultSections(scope, scopeId) {
    if (sectionsFor(scope, scopeId).length) return;
    (scope === 'note' ? NOTE_DEFAULT_SECTIONS : RESOURCE_DEFAULT_SECTIONS).forEach(function (d) { addSection(scope, scopeId, d.kind, { title: d.title }); });
  }
  // A cheap "what is this thing actually about" text snippet — used by
  // the AI Assistant's local fallbacks and anywhere else that used to
  // read a note's own removed `definition`/`explanation` field directly.
  function primaryTextFor(scope, scopeId) {
    var secs = sectionsFor(scope, scopeId).filter(function (s) { return s.kind === 'text' || s.kind === 'toggle'; });
    return secs.length ? secs[0].text : '';
  }

  // Resource-level Mind Map, Connections, and Permanent Notes Created —
  // computed, never stored twice.
  function mindMapNodeCountForScope(mapLevel, scopeId) { return MindMapNodes.list().filter(function (n) { return n.mapLevel === mapLevel && n.scopeId === scopeId; }).length; }
  function permanentNotesFromResource(resourceId) {
    return PermanentNotes.list().filter(function (n) {
      return n.sourceResourceId === resourceId || n.booksReferenced.indexOf(resourceId) !== -1 || n.articlesReferenced.indexOf(resourceId) !== -1;
    });
  }
  function questionsForResource(resourceId) { return Questions.list().filter(function (q) { return q.resourceId === resourceId; }); }
  function relatedResourcesByTag(resourceId) {
    var r = Resources.get(resourceId); if (!r || !r.tags.length) return [];
    return Resources.list().filter(function (x) {
      return x.id !== resourceId && x.departmentId === r.departmentId && x.tags.some(function (t) { return r.tags.indexOf(t) !== -1; });
    });
  }

  function removeResourceCascade(id) {
    sectionsFor('resource', id).forEach(function (s) { Sections.remove(s.id); });
    MindMapNodes.list().filter(function (n) { return n.mapLevel === 'resource' && n.scopeId === id; }).forEach(function (n) { MindMapNodes.remove(n.id); });
    Questions.list().filter(function (q) { return q.resourceId === id; }).forEach(function (q) { Questions.update(q.id, { resourceId: '' }); });
    PermanentNotes.list().forEach(function (n) {
      if (n.sourceResourceId === id || n.booksReferenced.indexOf(id) !== -1 || n.articlesReferenced.indexOf(id) !== -1) {
        PermanentNotes.update(n.id, {
          sourceResourceId: n.sourceResourceId === id ? '' : n.sourceResourceId,
          booksReferenced: n.booksReferenced.filter(function (x) { return x !== id; }),
          articlesReferenced: n.articlesReferenced.filter(function (x) { return x !== id; })
        });
      }
    });
    Resources.remove(id);
  }

  // ---------- Selectors: permanent notes (concepts) ----------
  function permanentNotesFor(departmentId) { return PermanentNotes.list().filter(function (n) { return n.departmentId === departmentId; }); }
  function permanentNotesSorted(departmentId) { return permanentNotesFor(departmentId).sort(function (a, b) { return b.order - a.order; }); }
  function permanentNoteTitle(id) { var n = PermanentNotes.get(id); return n ? n.title : ''; }
  function removePermanentNoteCascade(id) {
    sectionsFor('note', id).forEach(function (s) { Sections.remove(s.id); });
    MindMapNodes.list().filter(function (n) { return n.mapLevel === 'concept' && n.scopeId === id; }).forEach(function (n) { MindMapNodes.remove(n.id); });
    PermanentNotes.list().forEach(function (n) {
      if (n.relatedConceptIds.indexOf(id) !== -1) PermanentNotes.update(n.id, { relatedConceptIds: n.relatedConceptIds.filter(function (x) { return x !== id; }) });
    });
    PermanentNotes.remove(id);
  }

  // ---------- Selectors: questions / research / projects / objectives ----------
  function questionsFor(departmentId) { return Questions.list().filter(function (q) { return q.departmentId === departmentId; }); }
  function openQuestionsFor(departmentId) { return questionsFor(departmentId).filter(function (q) { return q.status === 'open'; }); }
  function questionTypeMeta(key) { for (var i = 0; i < QUESTION_TYPES.length; i++) if (QUESTION_TYPES[i].key === key) return QUESTION_TYPES[i]; return QUESTION_TYPES[0]; }
  // Reverse relation, computed: which permanent notes cite this question.
  function permanentNotesCitingQuestion(qid) { return PermanentNotes.list().filter(function (n) { return n.questionIds.indexOf(qid) !== -1; }); }

  function researchFor(departmentId) { return ResearchItems.list().filter(function (r) { return r.departmentId === departmentId; }); }
  function researchTypeMeta(key) { for (var i = 0; i < RESEARCH_TYPES.length; i++) if (RESEARCH_TYPES[i].key === key) return RESEARCH_TYPES[i]; return RESEARCH_TYPES[0]; }

  function projectsFor(departmentId) { return Projects.list().filter(function (p) { return p.departmentId === departmentId; }); }
  function permanentNotesCitingProject(pid) { return PermanentNotes.list().filter(function (n) { return n.projectIds.indexOf(pid) !== -1; }); }
  function setProjectStatus(id, status) {
    var p = Projects.get(id); if (!p) return null;
    var patch = { status: status };
    if (status === 'done' && !p.completedAt) patch.completedAt = nowIso();
    return Projects.update(id, patch);
  }
  // A per-department starting vocabulary for the Project "type" field's
  // datalist — freely typed over, never enforced (see projectModel()'s
  // own comment on why `type` stays freeform).
  var PROJECT_TYPE_SUGGESTIONS = {
    psychology: ['Essay', 'Presentation', 'Article', 'Teaching Session', 'Video', 'Course Outline'],
    wealth: ['Business Plan', 'Investment Thesis', 'Pitch Deck', 'Case Study'],
    ai: ['Prompt Engineering', 'Coding Project', 'Model Comparison', 'Experiment'],
    metaphysics: ['Essay', 'Thought Experiment', 'Debate Outline'],
    spiritual: ['Practice Log', 'Ritual Design', 'Retreat Notes'],
    selfdev: ['Habit Experiment', 'Identity Statement', 'Accountability System'],
    photography: ['Photo Project', 'Editing Practice', 'Portfolio Piece', 'Lighting Study'],
    history: ['Timeline', 'Historical Comparison', 'Research Essay'],
    astrology: ['Chart Reading Practice', 'Case Study', 'Prediction Log'],
    writing: ['Novel Research', 'Persuasive Essay', 'Copywriting Piece', 'Script'],
    health: ['Protocol Experiment', 'Meal Plan', 'Recovery Log']
  };
  function projectTypeSuggestions(departmentId) { return PROJECT_TYPE_SUGGESTIONS[departmentId] || ['Essay', 'Project', 'Experiment']; }

  function objectivesFor(departmentId) { return Objectives.list().filter(function (o) { return o.departmentId === departmentId; }); }
  function objectiveKindMeta(key) { for (var i = 0; i < OBJECTIVE_KINDS.length; i++) if (OBJECTIVE_KINDS[i].key === key) return OBJECTIVE_KINDS[i]; return OBJECTIVE_KINDS[0]; }

  // ---------- Mind maps (3 levels, 1 flat tree) ----------
  function mindMapNodesForScope(mapLevel, scopeId) { return MindMapNodes.list().filter(function (n) { return n.mapLevel === mapLevel && n.scopeId === scopeId; }); }
  function mindMapChildren(mapLevel, scopeId, parentId) {
    return mindMapNodesForScope(mapLevel, scopeId).filter(function (n) { return n.parentId === parentId; }).sort(function (a, b) { return a.order - b.order; });
  }
  function ensureMindMapRoot(mapLevel, scopeId, departmentId, defaultTitle) {
    var existing = mindMapNodesForScope(mapLevel, scopeId).filter(function (n) { return !n.parentId; });
    if (existing.length) return existing[0];
    return MindMapNodes.add({ mapLevel: mapLevel, scopeId: scopeId, departmentId: departmentId, parentId: null, title: defaultTitle, order: 0 });
  }
  function addMindMapBranch(mapLevel, scopeId, departmentId, parentId, title) {
    var siblings = mindMapChildren(mapLevel, scopeId, parentId);
    return MindMapNodes.add({ mapLevel: mapLevel, scopeId: scopeId, departmentId: departmentId, parentId: parentId, title: title || 'New Branch', order: siblings.length });
  }
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
  function moveMindMapNode(id, dir) {
    var n = MindMapNodes.get(id); if (!n) return;
    var sib = mindMapChildren(n.mapLevel, n.scopeId, n.parentId);
    var idx = sib.findIndex(function (x) { return x.id === id; });
    var swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sib.length) return;
    var a = sib[idx], b = sib[swapIdx];
    MindMapNodes.update(a.id, { order: b.order });
    MindMapNodes.update(b.id, { order: a.order });
  }
  // A pure layout function (no DOM/pixels) — the standard "a parent's
  // slot is the average of its children's" tidy-tree technique, unchanged
  // from the prior model since it only ever depends on parentId/order.
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
  // Milestones: "Concept maps created" / a resource's own "Mind map
  // status" both mean "has real content beyond just its auto-created
  // root" — i.e. more than 1 node in that scope.
  function conceptMapsCreatedCount(departmentId) {
    return permanentNotesFor(departmentId).filter(function (n) { return mindMapNodeCountForScope('concept', n.id) > 1; }).length;
  }
  function resourceMapsCreatedCount(departmentId) {
    return resourcesFor(departmentId).filter(function (r) { return mindMapNodeCountForScope('resource', r.id) > 1; }).length;
  }

  // ---------- Knowledge Graph (computed, per-department + global) ----------
  // Every cross-reference a PermanentNote already carries becomes an edge
  // — this is the entirety of "automatic connection." Node kinds:
  // resource / note (permanent note = concept) / question / project.
  function buildDepartmentGraph(departmentId) {
    var nodes = [], edges = [], seenEdge = {};
    function addNode(id, kind, label, sub) { nodes.push({ id: id, kind: kind, label: label, sub: sub || '' }); }
    function addEdge(a, b, kind) {
      var key = [a, b].sort().join('|') + '|' + kind;
      if (seenEdge[key]) return;
      seenEdge[key] = true;
      edges.push({ a: a, b: b, kind: kind });
    }
    resourcesFor(departmentId).forEach(function (r) { addNode('res:' + r.id, 'resource', r.title, resourceTypeMeta(r.type).label); });
    projectsFor(departmentId).forEach(function (p) { addNode('proj:' + p.id, 'project', p.title, p.type); });
    questionsFor(departmentId).forEach(function (q) { addNode('q:' + q.id, 'question', q.text.slice(0, 44) || 'Untitled question', questionTypeMeta(q.type).label); });
    permanentNotesFor(departmentId).forEach(function (n) {
      addNode('note:' + n.id, 'note', n.title, 'Concept');
      n.booksReferenced.concat(n.articlesReferenced).forEach(function (rid) { if (Resources.get(rid)) addEdge('note:' + n.id, 'res:' + rid, 'reference'); });
      n.relatedConceptIds.forEach(function (nid) { if (PermanentNotes.get(nid)) addEdge('note:' + n.id, 'note:' + nid, 'concept'); });
      n.questionIds.forEach(function (qid) { if (Questions.get(qid)) addEdge('note:' + n.id, 'q:' + qid, 'question'); });
      n.projectIds.forEach(function (pid) { if (Projects.get(pid)) addEdge('note:' + n.id, 'proj:' + pid, 'project'); });
      if (n.sourceResourceId && Resources.get(n.sourceResourceId)) addEdge('note:' + n.id, 'res:' + n.sourceResourceId, 'reference');
    });
    return { nodes: nodes, edges: edges };
  }
  function knowledgeGraphSize(departmentId) { return buildDepartmentGraph(departmentId).nodes.length; }

  // The Global graph unions every department's own graph (each node
  // prefixed with its department so ids can never collide) plus the
  // explicit CrossLinks as inter-department edges — the one relationship
  // no per-department graph could ever derive on its own.
  function buildGlobalGraph(filterDepartmentIds) {
    var nodes = [], edges = [];
    var depts = departmentsSorted().filter(function (d) { return !filterDepartmentIds || filterDepartmentIds.indexOf(d.id) !== -1; });
    depts.forEach(function (d) {
      var g = buildDepartmentGraph(d.id);
      g.nodes.forEach(function (n) { nodes.push({ id: d.id + '::' + n.id, kind: n.kind, label: n.label, sub: n.sub, departmentId: d.id }); });
      g.edges.forEach(function (e) { edges.push({ a: d.id + '::' + e.a, b: d.id + '::' + e.b, kind: e.kind, cross: false }); });
    });
    CrossLinks.list().forEach(function (cl) {
      if (filterDepartmentIds && (filterDepartmentIds.indexOf(cl.fromDepartmentId) === -1 || filterDepartmentIds.indexOf(cl.toDepartmentId) === -1)) return;
      var fromDept = Departments.get(cl.fromDepartmentId), toDept = Departments.get(cl.toDepartmentId);
      if (!fromDept || !toDept) return;
      nodes.push({ id: 'dept::' + cl.fromDepartmentId, kind: 'department', label: fromDept.name, sub: '', departmentId: cl.fromDepartmentId, isDeptNode: true });
      nodes.push({ id: 'dept::' + cl.toDepartmentId, kind: 'department', label: toDept.name, sub: '', departmentId: cl.toDepartmentId, isDeptNode: true });
      edges.push({ a: 'dept::' + cl.fromDepartmentId, b: 'dept::' + cl.toDepartmentId, kind: 'crosslink', cross: true, label: cl.label });
    });
    // De-dupe department nodes (a department can appear once per
    // CrossLink it participates in above).
    var seen = {};
    nodes = nodes.filter(function (n) { if (seen[n.id]) return false; seen[n.id] = true; return true; });
    return { nodes: nodes, edges: edges };
  }

  function crossLinksFor(departmentId) { return CrossLinks.list().filter(function (cl) { return cl.fromDepartmentId === departmentId || cl.toDepartmentId === departmentId; }); }
  function otherDeptIn(crossLink, departmentId) { return crossLink.fromDepartmentId === departmentId ? crossLink.toDepartmentId : crossLink.fromDepartmentId; }
  function removeCrossLinksFor(departmentId) { crossLinksFor(departmentId).forEach(function (cl) { CrossLinks.remove(cl.id); }); }

  // Suggested Next Learning / most-connected concepts — real, computed
  // "Connections Section" content: a department's own most-referenced
  // permanent note (highest relatedConceptIds+booksReferenced+
  // articlesReferenced+questionIds+projectIds count) plus any
  // cross-department tag overlap with other departments' resources.
  function mostConnectedConcepts(departmentId, limit) {
    return permanentNotesFor(departmentId).map(function (n) {
      var score = n.relatedConceptIds.length + n.booksReferenced.length + n.articlesReferenced.length + n.questionIds.length + n.projectIds.length;
      return { note: n, score: score };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, limit || 5);
  }
  function crossDepartmentTagOverlap(departmentId) {
    var myTags = {};
    resourcesFor(departmentId).concat(permanentNotesFor(departmentId)).forEach(function (x) { (x.tags || []).forEach(function (t) { myTags[t.toLowerCase()] = true; }); });
    var out = {};
    Departments.list().forEach(function (d) {
      if (d.id === departmentId) return;
      var count = 0;
      resourcesFor(d.id).concat(permanentNotesFor(d.id)).forEach(function (x) { (x.tags || []).forEach(function (t) { if (myTags[t.toLowerCase()]) count++; }); });
      if (count > 0) out[d.id] = count;
    });
    return out;
  }

  // ---------- Milestones / Progress (derived, never stored) ----------
  function milestonesFor(departmentId) {
    var res = resourcesFor(departmentId);
    var completed = res.filter(function (r) { return !!r.completedAt; });
    function completedByType(t) { return completed.filter(function (r) { return r.type === t; }).length; }
    var projects = projectsFor(departmentId);
    var doneProjects = projects.filter(function (p) { return p.status === 'done'; });
    function doneProjectsMatching(substr) { return doneProjects.filter(function (p) { return (p.type || '').toLowerCase().indexOf(substr) !== -1; }).length; }
    return {
      booksCompleted: completedByType('book'),
      articlesStudied: completedByType('article'),
      coursesCompleted: completedByType('course'),
      researchPapers: completedByType('paper'),
      projectsCompleted: doneProjects.length,
      conceptMapsCreated: conceptMapsCreatedCount(departmentId),
      permanentNotes: permanentNotesFor(departmentId).length,
      essaysWritten: doneProjectsMatching('essay'),
      presentations: doneProjectsMatching('presentation'),
      teachingCompleted: doneProjectsMatching('teach')
    };
  }
  function studySessionsFor(departmentId) { return StudySessions.list().filter(function (s) { return s.departmentId === departmentId; }); }
  function hoursStudied(departmentId) {
    var mins = studySessionsFor(departmentId).reduce(function (a, s) { return a + s.minutes; }, 0);
    return Math.round((mins / 60) * 10) / 10;
  }
  function logStudySession(departmentId, minutes, note) {
    return StudySessions.add({ departmentId: departmentId, minutes: minutes || 25, note: note || '', dateStr: todayStr() });
  }
  // Streak: walk backward day-by-day from today counting consecutive
  // days with at least one logged study session — same "walk dates
  // backward from today" streak algorithm this app's own habit systems
  // (index.html, mainpillar.html) already use.
  function learningStreak(departmentId) {
    var dates = {};
    studySessionsFor(departmentId).forEach(function (s) { dates[s.dateStr] = true; });
    resourcesFor(departmentId).forEach(function (r) { if (r.lastStudied) dates[r.lastStudied] = true; });
    var streak = 0;
    var d = new Date();
    // Allow "today not logged yet" to not break yesterday's streak — but
    // require yesterday to be logged if today isn't, else it's 0.
    if (!dates[todayStr()]) d.setDate(d.getDate() - 1);
    while (true) {
      var key = d.toISOString().slice(0, 10);
      if (!dates[key]) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function recentlyStudiedDate(departmentId) {
    var dates = studySessionsFor(departmentId).map(function (s) { return s.dateStr; })
      .concat(resourcesFor(departmentId).map(function (r) { return r.lastStudied; }).filter(Boolean));
    if (!dates.length) return '';
    return dates.sort().slice(-1)[0];
  }
  function recentlyStudiedResources(departmentId, limit) {
    return resourcesFor(departmentId).filter(function (r) { return r.lastStudied; })
      .sort(function (a, b) { return b.lastStudied.localeCompare(a.lastStudied); }).slice(0, limit || 5);
  }
  function currentResourceFor(departmentId) {
    var reading = currentLearningFor(departmentId);
    if (!reading.length) return null;
    return reading.sort(function (a, b) { return (b.lastStudied || '').localeCompare(a.lastStudied || ''); })[0];
  }

  // Home card summary — every field the spec's own card list names.
  function departmentSummary(departmentId) {
    var d = Departments.get(departmentId);
    var res = resourcesFor(departmentId);
    var current = currentResourceFor(departmentId);
    var byType = {};
    res.forEach(function (r) { if (r.stage === 'reading' && !byType[r.type]) byType[r.type] = r; });
    var openQ = openQuestionsFor(departmentId);
    var activeProjects = projectsFor(departmentId).filter(function (p) { return p.status !== 'done' && p.title.toLowerCase().indexOf('research') !== -1 || p.status === 'in-progress'; });
    return {
      dept: d,
      progressPct: d ? d.masteryPct : 0,
      currentBook: byType.book ? byType.book.title : '',
      currentArticle: byType.article ? byType.article.title : '',
      currentCourse: byType.course ? byType.course.title : '',
      activeResearchProject: projectsFor(departmentId).filter(function (p) { return p.status === 'in-progress'; })[0] || null,
      recentlyStudied: recentlyStudiedDate(departmentId),
      openQuestionsCount: openQ.length,
      permanentNotesCount: permanentNotesFor(departmentId).length,
      conceptMapsCount: conceptMapsCreatedCount(departmentId),
      completedResourcesCount: res.filter(function (r) { return r.completedAt; }).length,
      knowledgeGraphSize: knowledgeGraphSize(departmentId)
    };
  }

  // ---------- Global search ----------
  function searchAll(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    Resources.list().forEach(function (r) { if (r.title.toLowerCase().indexOf(q) !== -1) out.push({ kind: 'resource', id: r.id, departmentId: r.departmentId, title: r.title, sub: resourceTypeMeta(r.type).label }); });
    PermanentNotes.list().forEach(function (n) { if (n.title.toLowerCase().indexOf(q) !== -1) out.push({ kind: 'note', id: n.id, departmentId: n.departmentId, title: n.title, sub: 'Permanent Note' }); });
    Questions.list().forEach(function (x) { if (x.text.toLowerCase().indexOf(q) !== -1) out.push({ kind: 'question', id: x.id, departmentId: x.departmentId, title: x.text, sub: 'Open Question' }); });
    Projects.list().forEach(function (p) { if (p.title.toLowerCase().indexOf(q) !== -1) out.push({ kind: 'project', id: p.id, departmentId: p.departmentId, title: p.title, sub: 'Project' }); });
    return out.slice(0, 40);
  }

  // ---------- Settings (single record) ----------
  function getSettings() { return Object.assign({ anthropicApiKey: '' }, storeGet('kh:settings', {})); }
  function saveSettings(patch) { var rec = Object.assign(getSettings(), patch); storeSet('kh:settings', rec); return rec; }

  // ---------- AI Integration ----------
  // 17 named actions from the spec, grouped for the AI Assistant panel's
  // UI. Each has a prompt-builder (used for the real API call, when a key
  // is configured) and a local fallback that's a genuinely useful,
  // honestly-computed function of real stored data — never a fabricated
  // answer dressed up as real (e.g. "Suggest Books" never invents book
  // titles locally; it instead surfaces real gaps in the current
  // library, and only asks the real model for actual title suggestions).
  var AI_ACTIONS = [
    { key: 'summary', label: 'Generate Summary', icon: '📝', group: 'Understand' },
    { key: 'eli5', label: "Explain Like I'm Five", icon: '🧒', group: 'Understand' },
    { key: 'comparesources', label: 'Compare Sources', icon: '⚖️', group: 'Understand' },
    { key: 'contradictions', label: 'Find Contradictions', icon: '⚡', group: 'Understand' },
    { key: 'quiz', label: 'Generate Quiz', icon: '❓', group: 'Create' },
    { key: 'flashcards', label: 'Generate Flashcards', icon: '🗂️', group: 'Create' },
    { key: 'essay', label: 'Generate Essay Outline', icon: '✍️', group: 'Create' },
    { key: 'teachingoutline', label: 'Generate Teaching Outline', icon: '🎓', group: 'Create' },
    { key: 'visualdiagram', label: 'Generate Visual Diagram', icon: '🗺️', group: 'Create' },
    { key: 'mindmap', label: 'Generate Mind Map Branches', icon: '🧠', group: 'Expand' },
    { key: 'conceptmap', label: 'Generate Concept Map Links', icon: '🕸️', group: 'Expand' },
    { key: 'researchquestions', label: 'Generate Research Questions', icon: '🔬', group: 'Expand' },
    { key: 'relatedtopics', label: 'Suggest Related Topics', icon: '🔗', group: 'Expand' },
    { key: 'missingconcepts', label: 'Suggest Missing Concepts', icon: '🧩', group: 'Expand' },
    { key: 'suggestbooks', label: 'Suggest Books', icon: '📚', group: 'Expand' },
    { key: 'suggestpapers', label: 'Suggest Papers', icon: '📄', group: 'Expand' },
    { key: 'knowledgegap', label: 'Knowledge Gap Analysis', icon: '🕳️', group: 'Analyze' }
  ];

  function buildAiContext(departmentId) {
    var d = Departments.get(departmentId);
    return {
      dept: d,
      resources: resourcesFor(departmentId),
      notes: permanentNotesFor(departmentId),
      questions: openQuestionsFor(departmentId),
      projects: projectsFor(departmentId),
      objectives: objectivesFor(departmentId),
      masterBranches: mindMapNodesForScope('master', departmentId)
    };
  }

  function buildAiPrompt(actionKey, ctx) {
    var d = ctx.dept || {};
    var head = 'You are an expert research assistant helping build a lifelong Knowledge Operating System for the discipline "' + (d.name || '') + '" (mission: ' + (d.mission || '') + ').\n\n' +
      'Current resources: ' + ctx.resources.map(function (r) { return r.title + ' (' + r.type + ', ' + r.stage + ')'; }).join('; ') + '\n' +
      'Permanent notes / concepts: ' + ctx.notes.map(function (n) { return n.title; }).join('; ') + '\n' +
      'Open questions: ' + ctx.questions.map(function (q) { return q.text; }).join('; ') + '\n' +
      'Master map branches: ' + ctx.masterBranches.map(function (b) { return b.title; }).join('; ') + '\n\n';
    var asks = {
      summary: 'Write a concise, well-organized summary of everything captured so far in this discipline.',
      eli5: 'Explain the single most important idea in this discipline as if to a five-year-old.',
      comparesources: 'Compare and contrast the resources above — where do they agree, where do they diverge?',
      contradictions: 'Identify any contradictions or tensions between the notes/resources above.',
      quiz: 'Write a 6-question quiz (with answers) testing understanding of the concepts above.',
      flashcards: 'Generate 8 flashcards (front/back pairs) from the concepts and resources above.',
      essay: 'Draft a short essay outline (thesis + 3 body points + conclusion) synthesizing the notes above.',
      teachingoutline: 'Write a teaching outline for explaining this discipline to a beginner, using the master map branches as sections.',
      visualdiagram: 'Describe, in words, an ideal visual diagram for the relationships between the concepts above.',
      mindmap: 'Suggest 5 additional sub-topic branches for the Master Subject Map of this discipline, beyond what is listed.',
      conceptmap: 'Suggest which of the permanent notes/concepts above should be linked together, and why.',
      researchquestions: 'Generate 5 sharp, non-obvious research questions this discipline\'s current notes have not yet answered.',
      relatedtopics: 'Suggest 3 other fields of knowledge most worth connecting to this discipline, and why.',
      missingconcepts: 'Given the master map branches above, what important concepts within this discipline are conspicuously missing?',
      suggestbooks: 'Suggest 5 real, well-regarded books to deepen this discipline, given what is already in the library.',
      suggestpapers: 'Suggest 5 real research papers or academic sources worth reading next in this discipline.',
      knowledgegap: 'Analyze the notes/resources/questions above and identify the biggest gaps in current understanding.'
    };
    return head + (asks[actionKey] || 'Help with this discipline.');
  }

  function aiLocalFallback(actionKey, ctx) {
    // Definition/explanation/etc. are no longer fixed fields on a note —
    // they're ordinary text Sections now (see this file's own header
    // comment on that redesign) — primaryTextFor() reads the first one.
    var noteText = function (n) { return primaryTextFor('note', n.id); };
    var notePreview = function (n) { var t = noteText(n); return '• ' + n.title + (t ? ' — ' + t : ''); };
    switch (actionKey) {
      case 'summary':
        if (!ctx.notes.length) return 'No permanent notes yet in ' + ctx.dept.name + ' — capture a few concepts first, then Generate Summary again.';
        return 'Summary of ' + ctx.dept.name + ':\n' + ctx.notes.slice(0, 8).map(notePreview).join('\n');
      case 'eli5':
        if (!ctx.notes.length) return 'Add a permanent note first — ELI5 explains your own captured concepts, it does not invent new ones locally.';
        var n0 = ctx.notes[0];
        return 'In simple terms: ' + n0.title + ' is ' + (noteText(n0) || 'something you have not written up yet — add a Text block to its page.');
      case 'comparesources':
        var same = {};
        ctx.resources.forEach(function (r) { (same[r.type] = same[r.type] || []).push(r); });
        var pair = Object.keys(same).map(function (k) { return same[k]; }).filter(function (l) { return l.length >= 2; })[0];
        if (!pair) return 'Add at least two resources of the same type to compare them.';
        return 'Comparing: "' + pair[0].title + '" (rating ' + pair[0].rating + '/5) vs. "' + pair[1].title + '" (rating ' + pair[1].rating + '/5). Open each resource\'s own page to compare their Summary blocks directly.';
      case 'contradictions':
        var withConn = ctx.notes.filter(function (n) { return n.relatedConceptIds.length > 0; });
        if (!withConn.length) return 'No notes have Related Concepts linked yet — nothing to cross-check locally.';
        return 'Notes with recorded connections worth checking for contradictions:\n' + withConn.map(function (n) { return '• ' + n.title + ' ↔ ' + n.relatedConceptIds.map(permanentNoteTitle).filter(Boolean).join(', '); }).join('\n');
      case 'quiz':
        if (!ctx.notes.length) return 'Add permanent notes first — a local quiz is generated from their first Text block.';
        return ctx.notes.slice(0, 6).map(function (n, i) { return (i + 1) + '. What is "' + n.title + '"?\n   A: ' + (noteText(n) || '(add a Text block to answer this)'); }).join('\n');
      case 'flashcards':
        if (!ctx.notes.length) return 'Add permanent notes first — flashcards are generated from their first Text block.';
        return ctx.notes.slice(0, 8).map(function (n) { return 'FRONT: ' + n.title + '\nBACK: ' + (noteText(n) || '(no text yet)'); }).join('\n\n');
      case 'essay':
        return 'Working thesis: ' + (ctx.dept.mission || 'define your mission for this discipline first.') + '\n\nBody points:\n' + ctx.notes.slice(0, 3).map(notePreview).join('\n') + '\n\nConclusion: (draft this once the body points feel solid)';
      case 'teachingoutline':
        if (!ctx.masterBranches.length) return 'Your Master Subject Map has no branches yet — a teaching outline is built from its sections.';
        return ctx.masterBranches.map(function (b) { return '§ ' + b.title; }).join('\n');
      case 'visualdiagram':
        return 'This is already visualized in the Mind Maps tab. Text outline of the Master Map:\n' + ctx.masterBranches.map(function (b) { return '- ' + b.title; }).join('\n');
      case 'mindmap':
        var def = departmentDef((ctx.dept || {}).id) || { subfields: [] };
        var existing = ctx.masterBranches.map(function (b) { return b.title.toLowerCase(); });
        var missing = def.subfields.filter(function (s) { return existing.indexOf(s.toLowerCase()) === -1; });
        return missing.length ? 'Suggested branches not yet on your Master Map:\n' + missing.map(function (s) { return '- ' + s; }).join('\n') : 'Every suggested starting branch is already on your Master Map — add your own from here.';
      case 'conceptmap':
        var byTag = {};
        ctx.notes.forEach(function (n) { (n.tags || []).forEach(function (t) { (byTag[t] = byTag[t] || []).push(n.title); }); });
        var lines = Object.keys(byTag).filter(function (t) { return byTag[t].length > 1; }).map(function (t) { return '"' + t + '": ' + byTag[t].join(' ↔ '); });
        return lines.length ? lines.join('\n') : 'Tag your permanent notes to surface which concepts share a theme and could be linked.';
      case 'researchquestions':
        return ctx.questions.length ? 'Your own open questions:\n' + ctx.questions.map(function (q) { return '• ' + q.text; }).join('\n') : 'No open questions logged yet — add some in Open Questions.';
      case 'relatedtopics':
        return 'Configure an Anthropic key in Settings for real cross-discipline suggestions. Locally: check the Connections tab, which computes real tag overlap with your other departments.';
      case 'missingconcepts':
        var withZero = ctx.masterBranches.filter(function (b) {
          return !ctx.notes.some(function (n) { return n.title.toLowerCase().indexOf(b.title.toLowerCase()) !== -1 || (n.tags || []).some(function (t) { return t.toLowerCase() === b.title.toLowerCase(); }); });
        });
        return withZero.length ? 'Master Map branches with no matching permanent note yet:\n' + withZero.map(function (b) { return '- ' + b.title; }).join('\n') : 'Every Master Map branch has at least one related note — nice coverage.';
      case 'suggestbooks':
        return 'No external catalog access locally — configure an Anthropic key in Settings for real title suggestions. In the meantime, your library currently has ' + ctx.resources.filter(function (r) { return r.type === 'book'; }).length + ' book(s) — consider adding more.';
      case 'suggestpapers':
        return 'No external catalog access locally — configure an Anthropic key in Settings for real paper suggestions. Your library currently has ' + ctx.resources.filter(function (r) { return r.type === 'paper'; }).length + ' research paper(s).';
      case 'knowledgegap':
        var stale = ctx.resources.filter(function (r) { return r.stage === 'reading'; });
        var gaps = [];
        if (ctx.questions.length) gaps.push(ctx.questions.length + ' open question(s) still unanswered.');
        if (stale.length) gaps.push(stale.length + ' resource(s) currently "Reading" — worth checking they are still moving.');
        var zeroBranches = ctx.masterBranches.filter(function (b) { return !ctx.notes.some(function (n) { return (n.tags || []).some(function (t) { return t.toLowerCase() === b.title.toLowerCase(); }); }); });
        if (zeroBranches.length) gaps.push(zeroBranches.length + ' Master Map branch(es) with no linked permanent note.');
        return gaps.length ? gaps.join('\n') : 'No obvious local gaps found — nice standing. Configure an Anthropic key in Settings for a deeper analysis.';
      default:
        return 'Configure an Anthropic API key in Settings for a real AI response.';
    }
  }

  // ---------- Seed data ----------
  // Every one of the 11 departments gets a real Master Subject Map (its
  // subfields, seeded above) so Home never shows 11 completely-empty
  // cards. Two flagship departments (Psychology, Self-Development) get a
  // fuller worked example — a resource, a permanent note with a real
  // concept map, a question, a project, a study session — demonstrating
  // every mechanism without fabricating deep content across all 11
  // (the same "not every tab pixel-matched, a couple flagships get the
  // full treatment" precedent this app's other multi-entity seed data
  // already uses, e.g. dreamboard-data.js's seedDefaultBoard()).
  function seedIfEmpty() {
    ensureDepartmentsExist();
    if (Resources.list().length || PermanentNotes.list().length || MindMapNodes.list().length) return;

    DEPARTMENT_DEFS.forEach(function (def) {
      var root = ensureMindMapRoot('master', def.id, def.id, def.name);
      def.subfields.forEach(function (s, i) { addMindMapBranch('master', def.id, def.id, root.id, s); });
    });

    // ---- Psychology (flagship #1) ----
    var psy = 'psychology';
    var atomicHabits = Resources.add({
      departmentId: psy, type: 'book', title: 'Atomic Habits', creator: 'James Clear', stage: 'reading',
      progressPct: 62, currentChapter: 'Ch. 8 — How to Make a Habit Irresistible', nextChapter: 'Ch. 9 — The Role of Family and Friends',
      lastStudied: todayStr(), dateStarted: todayStr(), rating: 5, tags: ['habits', 'behavior-change']
    });
    addSection('resource', atomicHabits.id, 'text', { title: 'Summary', text: 'Small, identity-aligned systems compound into large behavior change.' });
    addSection('resource', atomicHabits.id, 'toggle', { title: 'Highlights — Goals vs. Systems', text: 'Problem #1: Winners and losers have the same goals.\nGoal setting suffers from survivorship bias — every Olympian wants gold, but the goal alone never explains who wins.\n\nProblem #2: Achieving a goal is only a momentary change.\nA goal is a direction, not a destination — the systems you build are what actually change your trajectory.' });
    addSection('resource', atomicHabits.id, 'quote', { text: 'You do not rise to the level of your goals. You fall to the level of your systems.' });
    addSection('resource', atomicHabits.id, 'media', { title: 'Ultimate Guide to Building New Habits', url: 'https://www.youtube.com/results?search_query=atomic+habits+james+clear' });
    var memoryNote = PermanentNotes.add({ departmentId: psy, title: 'Memory', booksReferenced: [atomicHabits.id], sourceResourceId: atomicHabits.id, tags: ['memory', 'cognition'] });
    addSection('note', memoryNote.id, 'text', { title: 'Definition', text: 'The faculty by which the brain encodes, stores, and retrieves information.' });
    addSection('note', memoryNote.id, 'text', { title: 'Explanation', text: 'Memory is not one system — working memory holds a few items briefly; long-term memory stores encoded material for later retrieval.' });
    addSection('note', memoryNote.id, 'text', { title: 'Examples', text: 'Recalling a phone number just long enough to dial it (working memory) vs. remembering your childhood home (long-term memory).' });
    addSection('note', memoryNote.id, 'text', { title: 'Applications', text: 'Spaced repetition exploits how retrieval strengthens long-term storage.' });
    var mmRoot = ensureMindMapRoot('concept', memoryNote.id, psy, 'Memory');
    var wm = addMindMapBranch('concept', memoryNote.id, psy, mmRoot.id, 'Working Memory');
    addMindMapBranch('concept', memoryNote.id, psy, mmRoot.id, 'Long-Term Memory');
    addMindMapBranch('concept', memoryNote.id, psy, wm.id, 'Encoding');
    addMindMapBranch('concept', memoryNote.id, psy, wm.id, 'Retrieval');
    addMindMapBranch('concept', memoryNote.id, psy, mmRoot.id, 'Forgetting');
    var habitNote = PermanentNotes.add({ departmentId: psy, title: 'Habit Formation', relatedConceptIds: [memoryNote.id], booksReferenced: [atomicHabits.id], tags: ['habits', 'behavior-change'] });
    addSection('note', habitNote.id, 'text', { title: 'Definition', text: 'The process by which a behavior becomes automatic through repeated cue-response-reward loops.' });
    addSection('note', habitNote.id, 'text', { title: 'Explanation', text: 'Every action taken is, in a real sense, a vote for the type of person you are becoming — identity-based habits stick better than outcome-based ones.' });
    PermanentNotes.update(memoryNote.id, { relatedConceptIds: [habitNote.id] });
    var q1 = Questions.add({ departmentId: psy, type: 'research-idea', text: 'Do 1% daily gains really compound the way the book claims, or is that a tidy story?', resourceId: atomicHabits.id });
    PermanentNotes.update(habitNote.id, { questionIds: [q1.id] });
    var proj1 = Projects.add({ departmentId: psy, title: 'Essay: Why Small Systems Beat Big Goals', type: 'Essay', status: 'in-progress', notes: 'Draft thesis pulling from the Habit Formation note.' });
    PermanentNotes.update(habitNote.id, { projectIds: [proj1.id] });
    Objectives.add({ departmentId: psy, kind: 'current-objective', title: 'Finish Atomic Habits and write 3 permanent notes from it' });
    Objectives.add({ departmentId: psy, kind: 'long-term-goal', title: 'Be able to explain the cognitive-behavioral model of habit change from memory' });
    logStudySession(psy, 45, 'Read chapters 6-8, wrote the Memory permanent note.');
    Departments.update(psy, { masteryPct: 28, currentFocus: 'Finishing Atomic Habits, then moving into cognitive psychology fundamentals.' });

    // ---- Self-Development (flagship #2) ----
    var sd = 'selfdev';
    var deepWork = Resources.add({ departmentId: sd, type: 'book', title: 'Deep Work', creator: 'Cal Newport', stage: 'permanentnotes', progressPct: 100, rating: 4, tags: ['focus', 'productivity'], completedAt: nowIso(), lastStudied: todayStr(), dateStarted: todayStr(), dateFinished: todayStr() });
    var identityNote = PermanentNotes.add({ departmentId: sd, title: 'Identity-Based Change', booksReferenced: [deepWork.id], sourceResourceId: deepWork.id, tags: ['identity', 'habits'] });
    addSection('note', identityNote.id, 'text', { title: 'Definition', text: 'Changing behavior by first changing the self-image behind it, rather than chasing an outcome directly.' });
    addSection('note', identityNote.id, 'text', { title: 'Explanation', text: 'Ask "who is the type of person who would do this?" rather than "what result do I want?" — the identity shift makes the behavior self-sustaining.' });
    var sdRoot = ensureMindMapRoot('concept', identityNote.id, sd, 'Identity-Based Change');
    addMindMapBranch('concept', identityNote.id, sd, sdRoot.id, 'Self-Image');
    addMindMapBranch('concept', identityNote.id, sd, sdRoot.id, 'Evidence & Proof');
    Objectives.add({ departmentId: sd, kind: 'skill-milestone', title: 'Run a 30-day identity-based habit experiment' });
    Departments.update(sd, { masteryPct: 22, currentFocus: 'Applying identity-based change to a real 30-day experiment.' });

    // ---- A cross-department connection, demonstrated ----
    CrossLinks.add({ fromDepartmentId: psy, toDepartmentId: sd, label: 'Habit formation research underlies most self-development practice.' });
    CrossLinks.add({ fromDepartmentId: psy, toDepartmentId: 'ai', label: 'Cognitive biases inform how AI systems are designed to be persuasive/usable.' });

    // Give every remaining department a plausible currentFocus so Home
    // never reads as totally inert.
    Departments.update('wealth', { currentFocus: 'Building a first-principles model of how value compounds.' });
    Departments.update('ai', { currentFocus: 'Tracking large language model fundamentals.' });
    Departments.update('metaphysics', { currentFocus: 'Reading into the philosophy of consciousness.' });
    Departments.update('spiritual', { currentFocus: 'Establishing a daily meditation practice.' });
    Departments.update('photography', { currentFocus: 'Practicing composition and available light.' });
    Departments.update('history', { currentFocus: 'Mapping the rise and fall of ancient empires.' });
    Departments.update('astrology', { currentFocus: 'Learning to read a natal chart from scratch.' });
    Departments.update('writing', { currentFocus: 'Studying classical rhetoric and argument structure.' });
    Departments.update('health', { currentFocus: 'Understanding the fundamentals of metabolic health.' });
  }

  window.KnowledgeHubData = {
    RESOURCE_TYPES: RESOURCE_TYPES, RESOURCE_TYPE_KEYS: RESOURCE_TYPE_KEYS,
    PIPELINE_STAGES: PIPELINE_STAGES, PIPELINE_STAGE_KEYS: PIPELINE_STAGE_KEYS,
    QUESTION_TYPES: QUESTION_TYPES, QUESTION_TYPE_KEYS: QUESTION_TYPE_KEYS,
    RESEARCH_TYPES: RESEARCH_TYPES, RESEARCH_TYPE_KEYS: RESEARCH_TYPE_KEYS,
    OBJECTIVE_KINDS: OBJECTIVE_KINDS, OBJECTIVE_KIND_KEYS: OBJECTIVE_KIND_KEYS,
    SECTION_KINDS: SECTION_KINDS, SECTION_KIND_KEYS: SECTION_KIND_KEYS,
    MAP_LEVELS: MAP_LEVELS, DEPARTMENT_DEFS: DEPARTMENT_DEFS, DEPARTMENT_IDS: DEPARTMENT_IDS,
    AI_ACTIONS: AI_ACTIONS,

    Departments: Departments, Resources: Resources, Sections: Sections,
    PermanentNotes: PermanentNotes, Questions: Questions, ResearchItems: ResearchItems,
    Projects: Projects, Objectives: Objectives, MindMapNodes: MindMapNodes,
    CrossLinks: CrossLinks, StudySessions: StudySessions,

    departmentDef: departmentDef, departmentsSorted: departmentsSorted, departmentName: departmentName, departmentIcon: departmentIcon,
    ensureDepartmentsExist: ensureDepartmentsExist, departmentSummary: departmentSummary,

    resourcesFor: resourcesFor, resourcesSorted: resourcesSorted, resourcesByStage: resourcesByStage,
    currentLearningFor: currentLearningFor, resourceTypeMeta: resourceTypeMeta, pipelineStageMeta: pipelineStageMeta,
    setResourceStage: setResourceStage, removeResourceCascade: removeResourceCascade,
    sectionsFor: sectionsFor, addSection: addSection, moveSection: moveSection, reorderSections: reorderSections,
    toggleSectionCollapsed: toggleSectionCollapsed, ensureDefaultSections: ensureDefaultSections, primaryTextFor: primaryTextFor,
    mindMapNodeCountForScope: mindMapNodeCountForScope, permanentNotesFromResource: permanentNotesFromResource,
    questionsForResource: questionsForResource, relatedResourcesByTag: relatedResourcesByTag,

    permanentNotesFor: permanentNotesFor, permanentNotesSorted: permanentNotesSorted, permanentNoteTitle: permanentNoteTitle,
    removePermanentNoteCascade: removePermanentNoteCascade,

    questionsFor: questionsFor, openQuestionsFor: openQuestionsFor, questionTypeMeta: questionTypeMeta,
    permanentNotesCitingQuestion: permanentNotesCitingQuestion,

    researchFor: researchFor, researchTypeMeta: researchTypeMeta,

    projectsFor: projectsFor, permanentNotesCitingProject: permanentNotesCitingProject, setProjectStatus: setProjectStatus,
    projectTypeSuggestions: projectTypeSuggestions,

    objectivesFor: objectivesFor, objectiveKindMeta: objectiveKindMeta,

    mindMapNodesForScope: mindMapNodesForScope, mindMapChildren: mindMapChildren, ensureMindMapRoot: ensureMindMapRoot,
    addMindMapBranch: addMindMapBranch, removeMindMapNodeCascade: removeMindMapNodeCascade, moveMindMapNode: moveMindMapNode,
    computeMindMapLayout: computeMindMapLayout, conceptMapsCreatedCount: conceptMapsCreatedCount, resourceMapsCreatedCount: resourceMapsCreatedCount,

    buildDepartmentGraph: buildDepartmentGraph, buildGlobalGraph: buildGlobalGraph, knowledgeGraphSize: knowledgeGraphSize,
    crossLinksFor: crossLinksFor, otherDeptIn: otherDeptIn, removeCrossLinksFor: removeCrossLinksFor,
    mostConnectedConcepts: mostConnectedConcepts, crossDepartmentTagOverlap: crossDepartmentTagOverlap,

    milestonesFor: milestonesFor, studySessionsFor: studySessionsFor, hoursStudied: hoursStudied,
    logStudySession: logStudySession, learningStreak: learningStreak, recentlyStudiedDate: recentlyStudiedDate,
    recentlyStudiedResources: recentlyStudiedResources, currentResourceFor: currentResourceFor,

    searchAll: searchAll,
    getSettings: getSettings, saveSettings: saveSettings,
    buildAiContext: buildAiContext, buildAiPrompt: buildAiPrompt, aiLocalFallback: aiLocalFallback,

    isEmptyEverywhere: function () { return !Resources.list().length && !PermanentNotes.list().length && !MindMapNodes.list().length; },
    seedIfEmpty: seedIfEmpty
  };
})();
