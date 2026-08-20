/* =============================================================================
   THE KDP DASHBOARD — DATA LAYER
   -----------------------------------------------------------------------------
   Exposes window.KdpData. Loaded by every kdp-*.html page after
   local-store-idb.js, supabase-js and sync.js, and before the page's own
   inline script.

   TWO STORAGE PREFIXES, ON PURPOSE
     kdp:    structure, statuses, notes, prompts, continuity, listings.
             Small. Pushed to Supabase constantly. Realtime.
     kdpms:  manuscript text — one key per chapter, holding four drafts.
             Large. Pushed only when prose actually changes.

   sync.js uploads EVERY key under a prefix as one blob on each save. Four
   full drafts across 40 chapters and 3 books is 7-10 MB. Keeping that out of
   the metadata row is the difference between a dashboard that feels instant
   and one that stalls on every keystroke. Word counts are therefore CACHED
   onto the chapter record so nothing has to open a manuscript to add up a
   book.

     kdparc: archived trilogies. Outside BOTH synced prefixes by design, so a
             finished trilogy stops being re-uploaded forever.
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // STORAGE PRIMITIVES
  // ---------------------------------------------------------------------------
  function storeGet(key) {
    try { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('kdp:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      // Quota, or IndexedDB refused the write. The page must SAY so — a silent
      // failure here is how a chapter disappears.
      try { window.dispatchEvent(new CustomEvent('kdp:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function storeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  var KEYS = {
    trilogies:    'kdp:trilogies',
    books:        'kdp:books',
    acts:         'kdp:acts',
    chapters:     'kdp:chapters',
    characters:   'kdp:characters',
    world:        'kdp:world',
    dossiers:     'kdp:dossiers',
    styleDocs:    'kdp:styleDocs',
    notes:        'kdp:notes',
    promptBlocks: 'kdp:promptBlocks',
    prompts:      'kdp:prompts',
    templates:    'kdp:templates',
    continuity:   'kdp:continuity',
    timeline:     'kdp:timeline',
    romanceBeats: 'kdp:romanceBeats',
    listings:     'kdp:listings',
    sessions:     'kdp:sessions',
    uiState:      'kdp:uiState',
    settings:     'kdp:settings',
    seededAt:     'kdp:seededAt'
  };
  var MS_PREFIX  = 'kdpms:';
  var ARC_PREFIX = 'kdparc:';

  // ---------------------------------------------------------------------------
  // SMALL UTILITIES
  // ---------------------------------------------------------------------------
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
           Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function isoDaysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function wordCount(text) {
    var t = String(text || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }
  function fmtWords(n) { return Number(n || 0).toLocaleString(); }
  function fmtCompact(n) {
    n = Number(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function romanize(n) { return ROMAN[n] || String(n); }

  // Deliberately tiny markdown: escape first, then emit a closed set of tags.
  // Pasted text is displayed, never trusted.
  function mdInline(s) {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function mdToHtml(text) {
    var lines = String(text || '').split(/\r?\n/);
    var out = [], buf = [];
    function flush() {
      if (buf.length) { out.push('<p>' + mdInline(buf.join(' ')) + '</p>'); buf = []; }
    }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) { flush(); continue; }
      if (/^#{1,3}\s+/.test(ln)) { flush(); out.push('<h4>' + mdInline(ln.replace(/^#{1,3}\s+/, '')) + '</h4>'); continue; }
      if (/^>\s?/.test(ln)) { flush(); out.push('<blockquote>' + mdInline(ln.replace(/^>\s?/, '')) + '</blockquote>'); continue; }
      if (/^[-*]\s+/.test(ln)) { flush(); out.push('<li>' + mdInline(ln.replace(/^[-*]\s+/, '')) + '</li>'); continue; }
      buf.push(ln);
    }
    flush();
    return out.join('');
  }
  // {{PLACEHOLDER}} tokens are the whole point of a prompt block — mark them.
  function highlightVars(text) {
    return escapeHtml(text).replace(/\{\{([A-Z0-9_ ]+)\}\}/g,
      '<span class="kd-ph">{{$1}}</span>');
  }

  // ---------------------------------------------------------------------------
  // COLLECTION FACTORY
  // Each collection is ONE localStorage key holding an array. Every write is
  // re-normalised through its model, so a record can never be partial and a
  // new field costs nothing to add later.
  // ---------------------------------------------------------------------------
  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function get(id) {
      var all = list();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    }
    function where(fn) { return list().filter(fn); }
    function add(data) {
      var r = model(data || {});
      var all = list(); all.push(r); storeSet(key, all);
      return r;
    }
    function addMany(records) {
      var all = list(), made = [];
      for (var i = 0; i < records.length; i++) {
        var r = model(records[i]); all.push(r); made.push(r);
      }
      storeSet(key, all);
      return made;
    }
    function update(id, patch) {
      var all = list(), idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      var merged = {};
      for (var k in all[idx]) merged[k] = all[idx][k];
      for (var k2 in patch) merged[k2] = patch[k2];
      merged.id = id;
      merged.updatedAt = nowISO();
      all[idx] = model(merged);
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      storeSet(key, list().filter(function (r) { return r.id !== id; }));
    }
    function removeWhere(fn) {
      storeSet(key, list().filter(function (r) { return !fn(r); }));
    }
    function replaceAll(records) { storeSet(key, Array.isArray(records) ? records : []); }
    return { key: key, list: list, get: get, where: where, add: add, addMany: addMany,
             update: update, remove: remove, removeWhere: removeWhere, replaceAll: replaceAll };
  }

  function byOrder(a, b) {
    var d = (a.order || 0) - (b.order || 0);
    return d !== 0 ? d : String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }
  function nextOrder(col) {
    var all = col.list(), max = 0;
    for (var i = 0; i < all.length; i++) max = Math.max(max, all[i].order || 0);
    return max + 1;
  }
  function reorderCollection(col, orderedIds) {
    var all = col.list(), byId = {};
    for (var i = 0; i < all.length; i++) byId[all[i].id] = all[i];
    for (var j = 0; j < orderedIds.length; j++) {
      if (byId[orderedIds[j]]) byId[orderedIds[j]].order = j + 1;
    }
    col.replaceAll(all);
  }

  function base(d, prefix) {
    return {
      id: d.id || uid(prefix),
      order: d.order == null ? 0 : Number(d.order),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }
  function assign(target, src) {
    for (var k in src) target[k] = src[k];
    return target;
  }

  // ---------------------------------------------------------------------------
  // VOCABULARY — statuses, sections, categories
  // ---------------------------------------------------------------------------
  var DOSSIER_STATUSES = [
    { id: 'not_started', label: 'Not started', tone: 'idle' },
    { id: 'drafted',     label: 'Drafted',     tone: 'live' },
    { id: 'final',       label: 'Final',       tone: 'seal' }
  ];
  var CHAR_STATUSES = [
    { id: 'drafting', label: 'Drafting', tone: 'live' },
    { id: 'complete', label: 'Complete', tone: 'seal' }
  ];
  var WORLD_STATUSES = [
    { id: 'not_started', label: 'Not started', tone: 'idle' },
    { id: 'in_progress', label: 'In progress', tone: 'live' },
    { id: 'final',       label: 'Final',       tone: 'seal' }
  ];
  var CHAPTER_STATUSES = [
    { id: 'not_started', label: 'Not started', tone: 'idle' },
    { id: 'outlined',    label: 'Outlined',    tone: 'done' },
    { id: 'drafting',    label: 'Drafting',    tone: 'live' },
    { id: 'revising',    label: 'Revising',    tone: 'live' },
    { id: 'final',       label: 'Final',       tone: 'seal' }
  ];
  var TASK_STATUSES = [
    { id: 'open',     label: 'Open',     tone: 'idle' },
    { id: 'flagged',  label: 'Flagged',  tone: 'live' },
    { id: 'resolved', label: 'Resolved', tone: 'seal' }
  ];

  function statusMeta(listOfStatuses, id) {
    for (var i = 0; i < listOfStatuses.length; i++) {
      if (listOfStatuses[i].id === id) return listOfStatuses[i];
    }
    return listOfStatuses[0];
  }

  // The twelve worldbuilding elements, in the order they get built.
  var WORLD_SECTIONS = [
    { id: 'high_level',  label: 'High-level worldbuilding' },
    { id: 'settings',    label: 'Settings & locations' },
    { id: 'objects',     label: 'Objects & artifacts' },
    { id: 'magic',       label: 'Magic systems & technology' },
    { id: 'groups',      label: 'Groups & races' },
    { id: 'gods',        label: 'Gods & deities' },
    { id: 'geography',   label: 'Geography & nature' },
    { id: 'politics',    label: 'Population & politics' },
    { id: 'culture',     label: 'Culture' },
    { id: 'history',     label: 'History & lore' },
    { id: 'religion',    label: 'Religion & beliefs' },
    { id: 'languages',   label: 'Languages' }
  ];

  var STYLE_DOCS = [
    { id: 'sample_prose',    label: 'Sample prose' },
    { id: 'style_sheet',     label: 'Style sheet' },
    { id: 'forbidden_words', label: 'Forbidden words' }
  ];

  // The four indexes a chapter passes through. Only `final` is counted.
  var INDEXES = [
    { id: 'original', n: 'I',   label: 'Original',         hint: 'The chapter as first generated.' },
    { id: 'plan',     n: 'II',  label: 'Improvement plan', hint: 'The critique of the original.' },
    { id: 'rewrite',  n: 'III', label: 'Rewritten',        hint: 'The chapter rebuilt from the plan.' },
    { id: 'final',    n: 'IV',  label: 'Final',            hint: 'The counted draft. This one is the novel.', counts: true }
  ];

  var CONTINUITY_CATEGORIES = [
    { id: 'plot',      label: 'Plot continuity',      items: ['Setup / payoff','Plot holes','Contradictions','Missing causes','Missing consequences','Dropped threads','Repeated reveals','Foreshadowing','Climax setup'] },
    { id: 'character', label: 'Character continuity', items: ['Knowledge','Motivations','Injuries','Appearance','Relationships','Emotional progression','Skills','Objects carried','Promises','Character arcs'] },
    { id: 'world',     label: 'World continuity',     items: ['Magic rules','Geography','Distance','Travel','Politics','Religion','Titles','Social systems','History','World terminology'] },
    { id: 'timeline',  label: 'Timeline continuity',  items: [] },
    { id: 'romance',   label: 'Romance continuity',   items: [] },
    { id: 'read',      label: 'Full manuscript read', items: ['Opening','Pacing','Sagging middle','Character arcs','Emotional arc','Romance','Stakes','Climax','Ending','Theme','Repetition','Overall cohesion'] }
  ];

  // The ten dimensions the romance arc is tracked on, chapter by chapter.
  var ROMANCE_DIMENSIONS = [
    { id: 'attraction',   label: 'Attraction' },
    { id: 'distrust',     label: 'Distrust' },
    { id: 'touch',        label: 'Touch' },
    { id: 'vulnerability',label: 'Vulnerability' },
    { id: 'jealousy',     label: 'Jealousy' },
    { id: 'tension',      label: 'Sexual tension' },
    { id: 'emotional',    label: 'Emotional intimacy' },
    { id: 'physical',     label: 'Physical intimacy' },
    { id: 'confession',   label: 'Confessions' },
    { id: 'status',       label: 'Relationship status' }
  ];

  var PROMPT_CATEGORIES = ['Brainstorming','Dossier','Characters','Worldbuilding','Outline',
    'Generate','Critique','Rewrite','Line edit','Continuity','Formatting'];

  var TEMPLATE_KINDS = ['Story Dossier','Character Sheet','Worldbuilding Sheet',
    'Trilogy Outline','Chapter Outline','Style Sheet','Continuity'];

  // The five weeks. Week 1 runs once per trilogy; 2-5 repeat per book.
  var WEEKS = [
    { n: 1, label: 'Foundations',      scope: 'trilogy', page: 'kdp-foundations.html' },
    { n: 2, label: 'Draft 1–28',       scope: 'book',    page: 'kdp-draft.html', from: 1,  to: 28 },
    { n: 3, label: 'Draft 29–40',      scope: 'book',    page: 'kdp-draft.html', from: 29, to: 40 },
    { n: 4, label: 'Continuity',       scope: 'book',    page: 'kdp-continuity.html' },
    { n: 5, label: 'Publish & Launch', scope: 'book',    page: 'kdp-publish.html' }
  ];
  function weekMeta(n) {
    for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].n === Number(n)) return WEEKS[i];
    return WEEKS[0];
  }

  // Structure constants. A book is always 40 chapters in three acts.
  var CHAPTERS_PER_BOOK = 40;
  var ACT_RANGES = [
    { n: 1, label: 'Act I',   from: 1,  to: 10 },
    { n: 2, label: 'Act II',  from: 11, to: 30 },
    { n: 3, label: 'Act III', from: 31, to: 40 }
  ];
  function actForChapter(n) {
    for (var i = 0; i < ACT_RANGES.length; i++) {
      if (n >= ACT_RANGES[i].from && n <= ACT_RANGES[i].to) return ACT_RANGES[i];
    }
    return ACT_RANGES[0];
  }

  // ---------------------------------------------------------------------------
  // IDEA LIBRARY — the Step 1 chip picker. Starting points, not a cage:
  // every axis accepts your own entries alongside these.
  // ---------------------------------------------------------------------------
  var IDEAS = {
    genre: ['Romantasy','High fantasy','Dark fantasy','Fae romance','Court intrigue',
            'Enemies-to-lovers fantasy','Portal fantasy','Gothic fantasy','Elemental fantasy',
            'Pirate fantasy','Academy fantasy','Mythic retelling'],
    trope: ['Enemies to lovers','Forced proximity','Only one bed','Touch her and die',
            'Fated mates','Marriage of convenience','Hidden identity','Secret royalty',
            'Morally grey love interest','Slow burn','Found family','Chosen one subversion',
            'Bargain with a god','Deal with a villain','Rivals to lovers','Second chance',
            'Bodyguard romance','Grumpy / sunshine','Touch starvation','Betrayal at the altar'],
    theme: ['Debt and inheritance','The cost of power','Chosen family','Faith versus proof',
            'Autonomy over destiny','Grief as transformation','Loyalty versus truth',
            'Memory and identity','Sacrifice and worth','Redemption is earned',
            'Freedom and its price','What we owe the dead'],
    romance: ['Slow burn to devotion','Antagonists forced to depend on each other',
              'Attraction against better judgement','Trust built, broken, rebuilt',
              'Political marriage becoming real','Love that costs the crown',
              'One protects, one resents being protected','Rivals who understand each other best',
              'Secret kept until it detonates','Choosing each other over the prophecy'],
    logline: [
      'When {INCITING EVENT}, {PROTAGONIST} must {GOAL} before {DEADLINE}, or {STAKES}.',
      'A {ROLE} who {FLAW} is forced to {ACTION} alongside the one person who {OBSTACLE}.',
      'To save {WHAT THEY LOVE}, {PROTAGONIST} strikes a bargain with {ANTAGONIST} — and the price is {COST}.',
      '{PROTAGONIST} has spent their life {BELIEF}. Then {REVELATION} proves it was a lie.',
      'Two enemies bound by {MAGICAL CONTRACT} must {SHARED GOAL} while {FORCE} hunts them both.'
    ]
  };

  // ---------------------------------------------------------------------------
  // MODELS
  // ---------------------------------------------------------------------------
  function trilogyModel(d) {
    return assign(base(d, 'tri'), {
      title: d.title || 'Untitled trilogy',
      premise: d.premise || '',
      genres: Array.isArray(d.genres) ? d.genres : [],
      tropes: Array.isArray(d.tropes) ? d.tropes : [],
      themes: Array.isArray(d.themes) ? d.themes : [],
      romanceArcs: Array.isArray(d.romanceArcs) ? d.romanceArcs : [],
      loglines: Array.isArray(d.loglines) ? d.loglines : [],
      customTags: Array.isArray(d.customTags) ? d.customTags : [],
      cover: d.cover || '',
      archived: !!d.archived
    });
  }
  function bookModel(d) {
    return assign(base(d, 'bk'), {
      trilogyId: d.trilogyId || '',
      position: Number(d.position || 1),
      title: d.title || ('Book ' + romanize(Number(d.position || 1))),
      subtitle: d.subtitle || '',
      logline: d.logline || '',
      mainPlot: d.mainPlot || '',
      romanceArc: d.romanceArc || '',
      stakes: d.stakes || '',
      targetWords: Number(d.targetWords || 120000),
      week: Number(d.week || 1),
      cover: d.cover || '',
      currentChapterId: d.currentChapterId || '',
      lastEditedAt: d.lastEditedAt || '',
      archived: !!d.archived
    });
  }
  function actModel(d) {
    return assign(base(d, 'act'), {
      bookId: d.bookId || '',
      number: Number(d.number || 1),
      label: d.label || ('Act ' + romanize(Number(d.number || 1))),
      from: Number(d.from || 1),
      to: Number(d.to || 10),
      summary: d.summary || ''
    });
  }
  function chapterModel(d) {
    return assign(base(d, 'ch'), {
      bookId: d.bookId || '',
      actId: d.actId || '',
      number: Number(d.number || 1),
      title: d.title || '',
      outline: d.outline || '',          // your own outline template, pasted verbatim
      pov: d.pov || '',
      status: d.status || 'not_started',
      // cached so a book total never has to open four manuscripts per chapter
      wordsFinal: Number(d.wordsFinal || 0),
      idxState: d.idxState && typeof d.idxState === 'object' ? d.idxState : {}
    });
  }
  function characterModel(d) {
    return assign(base(d, 'cha'), {
      trilogyId: d.trilogyId || '',
      name: d.name || '',
      role: d.role || '',
      status: d.status || 'drafting',
      sheet: d.sheet || '',              // the filled-in sheet, pasted whole
      fields: d.fields && typeof d.fields === 'object' ? d.fields : {},
      portrait: d.portrait || ''
    });
  }
  function worldModel(d) {
    return assign(base(d, 'wld'), {
      trilogyId: d.trilogyId || '',
      section: d.section || 'high_level',
      body: d.body || '',
      status: d.status || 'not_started'
    });
  }
  function dossierModel(d) {
    return assign(base(d, 'dos'), {
      trilogyId: d.trilogyId || '',
      initial: d.initial || '',
      initialStatus: d.initialStatus || 'not_started',
      emotionalCritique: d.emotionalCritique || '',
      nameCritiques: Array.isArray(d.nameCritiques) && d.nameCritiques.length === 4
        ? d.nameCritiques : ['', '', '', ''],
      revised: d.revised || '',
      revisedStatus: d.revisedStatus || 'not_started'
    });
  }
  function styleDocModel(d) {
    return assign(base(d, 'sty'), {
      trilogyId: d.trilogyId || '',
      kind: d.kind || 'sample_prose',
      body: d.body || '',
      status: d.status || 'not_started'
    });
  }
  function noteModel(d) {
    return assign(base(d, 'nt'), {
      scope: d.scope || '',
      title: d.title || '',
      body: d.body || ''
    });
  }
  function promptBlockModel(d) {
    return assign(base(d, 'pb'), {
      scope: d.scope || '',
      title: d.title || 'Prompt',
      body: d.body || ''
    });
  }
  function promptModel(d) {
    return assign(base(d, 'pr'), {
      title: d.title || 'Untitled prompt',
      category: d.category || 'Brainstorming',
      text: d.text || '',
      notes: d.notes || '',
      pinned: !!d.pinned,
      useCount: Number(d.useCount || 0),
      lastUsedAt: d.lastUsedAt || ''
    });
  }
  function templateModel(d) {
    return assign(base(d, 'tpl'), {
      title: d.title || 'Untitled template',
      kind: d.kind || 'Story Dossier',
      body: d.body || ''
    });
  }
  function continuityModel(d) {
    return assign(base(d, 'con'), {
      bookId: d.bookId || '',
      category: d.category || 'plot',
      item: d.item || '',
      body: d.body || '',
      chapterRefs: Array.isArray(d.chapterRefs) ? d.chapterRefs : [],
      status: d.status || 'open'
    });
  }
  function timelineModel(d) {
    return assign(base(d, 'tl'), {
      bookId: d.bookId || '',
      day: Number(d.day || 1),
      chapterFrom: Number(d.chapterFrom || 1),
      chapterTo: Number(d.chapterTo || d.chapterFrom || 1),
      event: d.event || '',
      // what the prose CLAIMS has elapsed, so it can be checked against the day column
      statedElapsed: d.statedElapsed === '' || d.statedElapsed == null ? '' : Number(d.statedElapsed)
    });
  }
  function romanceBeatModel(d) {
    return assign(base(d, 'rb'), {
      bookId: d.bookId || '',
      chapter: Number(d.chapter || 1),
      dimension: d.dimension || 'attraction',
      value: clamp(Number(d.value || 0), 0, 5),
      note: d.note || ''
    });
  }
  function listingModel(d) {
    return assign(base(d, 'lst'), {
      bookId: d.bookId || '',
      title: d.title || '',
      subtitle: d.subtitle || '',
      series: d.series || '',
      front: d.front || '',
      back: d.back || '',
      blurb: d.blurb || '',
      keywords: Array.isArray(d.keywords) && d.keywords.length === 7 ? d.keywords : ['','','','','','',''],
      categories: Array.isArray(d.categories) && d.categories.length === 3 ? d.categories : ['','',''],
      coverBrief: d.coverBrief || '',
      cover: d.cover || '',
      price: d.price || '',
      releaseDate: d.releaseDate || '',
      launchDone: Array.isArray(d.launchDone) ? d.launchDone : []
    });
  }
  function sessionModel(d) {
    return assign(base(d, 'ses'), {
      bookId: d.bookId || '',
      date: d.date || todayISO(),
      words: Number(d.words || 0)
    });
  }

  var Trilogies    = makeCollection(KEYS.trilogies, trilogyModel);
  var Books        = makeCollection(KEYS.books, bookModel);
  var Acts         = makeCollection(KEYS.acts, actModel);
  var Chapters     = makeCollection(KEYS.chapters, chapterModel);
  var Characters   = makeCollection(KEYS.characters, characterModel);
  var World        = makeCollection(KEYS.world, worldModel);
  var Dossiers     = makeCollection(KEYS.dossiers, dossierModel);
  var StyleDocs    = makeCollection(KEYS.styleDocs, styleDocModel);
  var Notes        = makeCollection(KEYS.notes, noteModel);
  var PromptBlocks = makeCollection(KEYS.promptBlocks, promptBlockModel);
  var Prompts      = makeCollection(KEYS.prompts, promptModel);
  var Templates    = makeCollection(KEYS.templates, templateModel);
  var Continuity   = makeCollection(KEYS.continuity, continuityModel);
  var Timeline     = makeCollection(KEYS.timeline, timelineModel);
  var RomanceBeats = makeCollection(KEYS.romanceBeats, romanceBeatModel);
  var Listings     = makeCollection(KEYS.listings, listingModel);
  var Sessions     = makeCollection(KEYS.sessions, sessionModel);

  // ---------------------------------------------------------------------------
  // SINGLETONS
  // A write that changes nothing is skipped, so merely LOOKING at a page never
  // pushes a cloud revision.
  // ---------------------------------------------------------------------------
  function readSingleton(key, defaults) {
    var v = storeGet(key);
    var out = {};
    for (var k in defaults) out[k] = defaults[k];
    if (v && typeof v === 'object') for (var k2 in v) out[k2] = v[k2];
    return out;
  }
  function writeSingleton(key, defaults, patch) {
    var cur = readSingleton(key, defaults);
    var next = {};
    for (var k in cur) next[k] = cur[k];
    for (var k2 in patch) next[k2] = patch[k2];
    if (JSON.stringify(next) === JSON.stringify(cur)) return cur;
    storeSet(key, next);
    return next;
  }
  var UI_DEFAULTS = {
    lastTrilogyId: '', lastBookId: '', lastChapterId: '', lastIndex: 'original',
    railFolded: false, expandedChapters: []
  };
  var SETTINGS_DEFAULTS = { authorName: 'Damian', dailyTarget: 3000 };

  function getUiState() { return readSingleton(KEYS.uiState, UI_DEFAULTS); }
  function setUiState(patch) { return writeSingleton(KEYS.uiState, UI_DEFAULTS, patch); }
  function getSettings() { return readSingleton(KEYS.settings, SETTINGS_DEFAULTS); }
  function setSettings(patch) { return writeSingleton(KEYS.settings, SETTINGS_DEFAULTS, patch); }

  // ---------------------------------------------------------------------------
  // MANUSCRIPT STORE — kdpms:<chapterId>
  // The four drafts of one chapter live in one key, apart from all metadata.
  // ---------------------------------------------------------------------------
  function blankDraft() { return { text: '', updatedAt: '' }; }
  function msKey(chapterId) { return MS_PREFIX + chapterId; }

  function readManuscript(chapterId) {
    var v = storeGet(msKey(chapterId)) || {};
    var out = {};
    for (var i = 0; i < INDEXES.length; i++) {
      var id = INDEXES[i].id;
      out[id] = (v[id] && typeof v[id] === 'object') ? {
        text: String(v[id].text || ''), updatedAt: v[id].updatedAt || ''
      } : blankDraft();
    }
    return out;
  }
  function readDraft(chapterId, indexId) {
    return readManuscript(chapterId)[indexId] || blankDraft();
  }
  /**
   * Write one index of one chapter.
   * Returns { ok, words, delta } — delta is the change in COUNTED words, which
   * is zero for every index except `final`.
   */
  function writeDraft(chapterId, indexId, text) {
    var ms = readManuscript(chapterId);
    var prevFinal = wordCount(ms.final.text);
    if (ms[indexId] && ms[indexId].text === text) {
      return { ok: true, words: wordCount(text), delta: 0, unchanged: true };
    }
    ms[indexId] = { text: String(text || ''), updatedAt: nowISO() };
    var ok = storeSet(msKey(chapterId), ms);

    var words = wordCount(ms[indexId].text);
    var delta = 0;
    if (indexId === 'final') {
      delta = words - prevFinal;
      // The cache is the only number the rest of the app reads. It must be
      // written in the same breath as the prose it summarises.
      Chapters.update(chapterId, { wordsFinal: words });
    }
    var ch = Chapters.get(chapterId);
    if (ch) {
      var idxState = {};
      for (var k in (ch.idxState || {})) idxState[k] = ch.idxState[k];
      idxState[indexId] = text && text.trim() ? 'done' : 'empty';

      // The status follows the indexes, so it can never claim "not started"
      // while there are three thousand words sitting in Index I.
      var patch = { idxState: idxState };
      var anyText = false;
      for (var s = 0; s < INDEXES.length; s++) {
        if (idxState[INDEXES[s].id] === 'done') { anyText = true; break; }
      }
      var finalWords = indexId === 'final' ? words : wordCount(ms.final.text);
      if (finalWords > 0) patch.status = 'final';
      else if (idxState.rewrite === 'done' || idxState.plan === 'done') patch.status = 'revising';
      else if (anyText) patch.status = 'drafting';
      else if (String(ch.outline || '').trim()) patch.status = 'outlined';
      else patch.status = 'not_started';

      Chapters.update(chapterId, patch);
    }
    return { ok: ok, words: words, delta: delta };
  }
  function removeManuscript(chapterId) { storeRemove(msKey(chapterId)); }

  // ---------------------------------------------------------------------------
  // SEEDING — a new trilogy arrives complete
  // 3 books, 9 acts, 120 chapters, 12 world sections, 4 characters, 3 style
  // documents and a dossier. You should never type "Chapter 27" by hand.
  // ---------------------------------------------------------------------------
  var DEFAULT_ROLES = ['Heroine','Love interest','Antagonist','Secondary lead'];

  /* Seed whatever is missing, and touch nothing that is already there.
     Split out of createTrilogy so it can ALSO repair a trilogy that stopped
     partway — see repairTrilogy and the guard at the end of createTrilogy. */
  function seedTrilogy(tri, data) {
    var have = booksForTrilogy(tri.id);
    var byPos = {};
    for (var h = 0; h < have.length; h++) byPos[have[h].position] = have[h];

    for (var p = 1; p <= 3; p++) {
      var book = byPos[p];
      if (!book) {
        book = Books.add({
          trilogyId: tri.id, position: p, order: p,
          title: (data && data.bookTitles && data.bookTitles[p - 1]) || ('Book ' + romanize(p)),
          week: 1
        });
      }
      // acts and chapters are only added where they are actually absent, so
      // repairing a partly-written book cannot duplicate or overwrite prose
      var haveActs = actsForBook(book.id);
      var haveCh = {};
      var existing = chaptersForBook(book.id);
      for (var e = 0; e < existing.length; e++) haveCh[existing[e].number] = true;
      var chapterRecords = [];
      for (var a = 0; a < ACT_RANGES.length; a++) {
        var r = ACT_RANGES[a];
        var act = null;
        for (var k = 0; k < haveActs.length; k++) if (haveActs[k].number === r.n) act = haveActs[k];
        if (!act) {
          act = Acts.add({
            bookId: book.id, number: r.n, label: r.label,
            from: r.from, to: r.to, order: r.n
          });
        }
        for (var n = r.from; n <= r.to; n++) {
          if (haveCh[n]) continue;
          chapterRecords.push({
            bookId: book.id, actId: act.id, number: n, order: n, status: 'not_started'
          });
        }
      }
      // One write for all of them, not one per chapter.
      if (chapterRecords.length) Chapters.addMany(chapterRecords);
    }

    if (!dossierFor(tri.id)) Dossiers.add({ trilogyId: tri.id });

    var haveWorld = {}, wl = worldForTrilogy(tri.id);
    for (var wi = 0; wi < wl.length; wi++) haveWorld[wl[wi].section] = true;
    var worldRecords = [];
    for (var w = 0; w < WORLD_SECTIONS.length; w++) {
      if (!haveWorld[WORLD_SECTIONS[w].id]) {
        worldRecords.push({ trilogyId: tri.id, section: WORLD_SECTIONS[w].id, order: w + 1 });
      }
    }
    if (worldRecords.length) World.addMany(worldRecords);

    var charCount = charactersForTrilogy(tri.id).length;
    var charRecords = [];
    for (var c = charCount; c < DEFAULT_ROLES.length; c++) {
      charRecords.push({ trilogyId: tri.id, role: DEFAULT_ROLES[c], order: c + 1, status: 'drafting' });
    }
    if (charRecords.length) Characters.addMany(charRecords);

    var haveStyle = {}, sl = styleDocsFor(tri.id);
    for (var si = 0; si < sl.length; si++) haveStyle[sl[si].kind] = true;
    var styleRecords = [];
    for (var s = 0; s < STYLE_DOCS.length; s++) {
      if (!haveStyle[STYLE_DOCS[s].id]) {
        styleRecords.push({ trilogyId: tri.id, kind: STYLE_DOCS[s].id, order: s + 1 });
      }
    }
    if (styleRecords.length) StyleDocs.addMany(styleRecords);
  }

  /** What a complete trilogy must have. Used to verify and to report. */
  function trilogyHealth(trilogyId) {
    var books = booksForTrilogy(trilogyId);
    var chapters = 0, acts = 0;
    for (var i = 0; i < books.length; i++) {
      acts += actsForBook(books[i].id).length;
      chapters += chaptersForBook(books[i].id).length;
    }
    var missing = [];
    if (books.length !== 3) missing.push((3 - books.length) + ' of 3 books');
    if (acts !== 9) missing.push((9 - acts) + ' of 9 acts');
    if (chapters !== 3 * CHAPTERS_PER_BOOK) {
      missing.push((3 * CHAPTERS_PER_BOOK - chapters) + ' of ' + (3 * CHAPTERS_PER_BOOK) + ' chapters');
    }
    if (worldForTrilogy(trilogyId).length !== WORLD_SECTIONS.length) {
      missing.push((WORLD_SECTIONS.length - worldForTrilogy(trilogyId).length) + ' worldbuilding sections');
    }
    if (charactersForTrilogy(trilogyId).length !== DEFAULT_ROLES.length) {
      missing.push((DEFAULT_ROLES.length - charactersForTrilogy(trilogyId).length) + ' character sheets');
    }
    if (styleDocsFor(trilogyId).length !== STYLE_DOCS.length) {
      missing.push((STYLE_DOCS.length - styleDocsFor(trilogyId).length) + ' style documents');
    }
    if (!dossierFor(trilogyId)) missing.push('the story dossier');
    return { ok: !missing.length, missing: missing,
             books: books.length, acts: acts, chapters: chapters };
  }

  /** Add back whatever a half-finished trilogy is missing. Never overwrites. */
  function repairTrilogy(trilogyId) {
    var tri = Trilogies.get(trilogyId);
    if (!tri) return { ok: false, reason: 'That trilogy no longer exists.' };
    var before = trilogyHealth(trilogyId);
    seedTrilogy(tri, {});
    var after = trilogyHealth(trilogyId);
    if (!after.ok) return { ok: false, reason: 'Could not finish the repair — still missing ' + after.missing.join(', ') + '.', before: before, after: after };
    return { ok: true, before: before, after: after };
  }

  function createTrilogy(data) {
    var tri = Trilogies.add(assign(data || {}, { order: nextOrder(Trilogies) }));

    // The trilogy record is written FIRST, so anything that fails after it —
    // a quota, a throw inside a bulk write — used to leave a half-built
    // trilogy behind, which every page then tried to render and crashed on.
    // Both failure shapes have to be caught: a THROW, and a write that
    // silently does not stick. So: seed inside a try, then verify, and undo
    // in either case rather than leave the wreck on the shelf.
    var failure = '';
    try {
      seedTrilogy(tri, data);
      var health = trilogyHealth(tri.id);
      if (!health.ok) failure = 'missing ' + health.missing.join(', ');
    } catch (e) {
      failure = (e && e.message) || 'a write failed';
    }
    if (failure) {
      try { removeTrilogy(tri.id); } catch (e2) {}
      throw new Error('Could not create the trilogy — ' + failure +
        '. Nothing was left behind.');
    }

    setUiState({ lastTrilogyId: tri.id, lastBookId: booksForTrilogy(tri.id)[0].id });
    return tri;
  }

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
  function trilogiesSorted() {
    return Trilogies.list().filter(function (t) { return !t.archived; }).sort(byOrder);
  }
  function booksForTrilogy(trilogyId) {
    return Books.where(function (b) { return b.trilogyId === trilogyId && !b.archived; })
      .sort(function (a, b) { return a.position - b.position; });
  }
  function actsForBook(bookId) {
    return Acts.where(function (a) { return a.bookId === bookId; })
      .sort(function (a, b) { return a.number - b.number; });
  }
  function chaptersForBook(bookId) {
    return Chapters.where(function (c) { return c.bookId === bookId; })
      .sort(function (a, b) { return a.number - b.number; });
  }
  function chaptersInRange(bookId, from, to) {
    return chaptersForBook(bookId).filter(function (c) {
      return c.number >= from && c.number <= to;
    });
  }
  function charactersForTrilogy(trilogyId) {
    return Characters.where(function (c) { return c.trilogyId === trilogyId; }).sort(byOrder);
  }
  function worldForTrilogy(trilogyId) {
    return World.where(function (w) { return w.trilogyId === trilogyId; }).sort(byOrder);
  }
  function worldSection(trilogyId, sectionId) {
    var all = worldForTrilogy(trilogyId);
    for (var i = 0; i < all.length; i++) if (all[i].section === sectionId) return all[i];
    return null;
  }
  function dossierFor(trilogyId) {
    var all = Dossiers.where(function (d) { return d.trilogyId === trilogyId; });
    return all[0] || null;
  }
  function styleDocsFor(trilogyId) {
    return StyleDocs.where(function (s) { return s.trilogyId === trilogyId; }).sort(byOrder);
  }
  function styleDoc(trilogyId, kind) {
    var all = styleDocsFor(trilogyId);
    for (var i = 0; i < all.length; i++) if (all[i].kind === kind) return all[i];
    return null;
  }
  function listingFor(bookId) {
    var all = Listings.where(function (l) { return l.bookId === bookId; });
    return all[0] || Listings.add({ bookId: bookId });
  }
  function notesFor(scope) {
    return Notes.where(function (n) { return n.scope === scope; }).sort(byOrder);
  }
  function promptBlocksFor(scope) {
    return PromptBlocks.where(function (p) { return p.scope === scope; }).sort(byOrder);
  }

  // ---------------------------------------------------------------------------
  // COMPUTATIONS
  // ---------------------------------------------------------------------------
  function bookWordCount(bookId) {
    var chs = chaptersForBook(bookId), sum = 0;
    for (var i = 0; i < chs.length; i++) sum += Number(chs[i].wordsFinal || 0);
    return sum;
  }
  function bookProgress(bookId) {
    var b = Books.get(bookId);
    if (!b || !b.targetWords) return 0;
    return clamp(Math.round((bookWordCount(bookId) / b.targetWords) * 100), 0, 100);
  }
  function trilogyWordCount(trilogyId) {
    var bs = booksForTrilogy(trilogyId), sum = 0;
    for (var i = 0; i < bs.length; i++) sum += bookWordCount(bs[i].id);
    return sum;
  }
  function chapterIsFinal(ch) {
    return Number(ch.wordsFinal || 0) > 0;
  }
  function countFinal(bookId, from, to) {
    var chs = (from == null) ? chaptersForBook(bookId) : chaptersInRange(bookId, from, to);
    var n = 0;
    for (var i = 0; i < chs.length; i++) if (chapterIsFinal(chs[i])) n++;
    return { done: n, total: chs.length };
  }

  function dossierComplete(trilogyId) {
    var d = dossierFor(trilogyId);
    return !!(d && d.revisedStatus === 'final');
  }
  function charactersComplete(trilogyId) {
    var cs = charactersForTrilogy(trilogyId);
    if (!cs.length) return false;
    for (var i = 0; i < cs.length; i++) if (cs[i].status !== 'complete') return false;
    return true;
  }
  function worldComplete(trilogyId) {
    var ws = worldForTrilogy(trilogyId);
    if (!ws.length) return false;
    for (var i = 0; i < ws.length; i++) if (ws[i].status !== 'final') return false;
    return true;
  }
  function outlineComplete(bookId) {
    var chs = chaptersForBook(bookId);
    if (!chs.length) return false;
    for (var i = 0; i < chs.length; i++) {
      if (!String(chs[i].outline || '').trim()) return false;
    }
    return true;
  }
  function firstUnoutlined(bookId) {
    var chs = chaptersForBook(bookId);
    for (var i = 0; i < chs.length; i++) {
      if (!String(chs[i].outline || '').trim()) return chs[i];
    }
    return null;
  }
  function planComplete(trilogyId) {
    var bs = booksForTrilogy(trilogyId);
    for (var i = 0; i < bs.length; i++) {
      if (!String(bs[i].mainPlot || '').trim() || !String(bs[i].romanceArc || '').trim()) return false;
    }
    return true;
  }
  function styleComplete(trilogyId) {
    var ss = styleDocsFor(trilogyId);
    if (!ss.length) return false;
    for (var i = 0; i < ss.length; i++) if (ss[i].status !== 'final') return false;
    return true;
  }
  function continuityComplete(bookId) {
    var cats = ['plot', 'character', 'world', 'read'];
    for (var i = 0; i < cats.length; i++) {
      var expected = CONTINUITY_CATEGORIES.filter(function (c) { return c.id === cats[i]; })[0];
      var rows = Continuity.where(function (r) {
        return r.bookId === bookId && r.category === cats[i] && r.status === 'resolved';
      });
      if (rows.length < expected.items.length) return false;
    }
    return true;
  }
  function firstUndone(bookId, from, to) {
    var chs = chaptersInRange(bookId, from, to);
    for (var i = 0; i < chs.length; i++) if (!chapterIsFinal(chs[i])) return chs[i];
    return null;
  }

  function weekProgress(bookId, week) {
    var b = Books.get(bookId);
    if (!b) return { pct: 0, done: 0, total: 1, label: '' };
    var tri = b.trilogyId;
    if (week === 1) {
      var gates = [dossierComplete(tri), charactersComplete(tri), worldComplete(tri),
                   planComplete(tri), outlineComplete(bookId), styleComplete(tri)];
      var done = gates.filter(Boolean).length;
      return { pct: Math.round((done / gates.length) * 100), done: done,
               total: gates.length, label: 'steps' };
    }
    if (week === 2 || week === 3) {
      var w = weekMeta(week);
      var c = countFinal(bookId, w.from, w.to);
      return { pct: c.total ? Math.round((c.done / c.total) * 100) : 0,
               done: c.done, total: c.total, label: 'chapters' };
    }
    if (week === 4) {
      var total = 0, resolved = 0;
      for (var i = 0; i < CONTINUITY_CATEGORIES.length; i++) {
        var cat = CONTINUITY_CATEGORIES[i];
        if (!cat.items.length) continue;
        total += cat.items.length;
        resolved += Continuity.where(function (r) {
          return r.bookId === bookId && r.category === cat.id && r.status === 'resolved';
        }).length;
      }
      return { pct: total ? Math.round((resolved / total) * 100) : 0,
               done: resolved, total: total, label: 'checks' };
    }
    var l = listingFor(bookId);
    var steps = [!!l.title, !!l.blurb, l.keywords.filter(Boolean).length >= 7,
                 l.categories.filter(Boolean).length >= 3, !!l.cover || !!l.coverBrief,
                 !!l.price, !!l.releaseDate];
    var d5 = steps.filter(Boolean).length;
    return { pct: Math.round((d5 / steps.length) * 100), done: d5, total: steps.length, label: 'steps' };
  }

  /**
   * THE CONTINUE WORKFLOW RESOLVER.
   * Walks the workflow gates in order and returns the exact page to open next.
   * Both the Command Center button and the icon rail read this, so they can
   * never disagree about what comes next.
   */
  function nextAction() {
    var ui = getUiState();
    var tris = trilogiesSorted();
    if (!tris.length) {
      return { label: 'Start a trilogy', href: 'kdp.html#/shelf', week: 0, kind: 'new' };
    }
    var tri = Trilogies.get(ui.lastTrilogyId) || tris[0];
    var books = booksForTrilogy(tri.id);
    if (!books.length) {
      return { label: 'Start a trilogy', href: 'kdp.html#/shelf', week: 0, kind: 'new' };
    }
    var book = Books.get(ui.lastBookId);
    if (!book || book.trilogyId !== tri.id) book = books[0];

    var F = 'kdp-foundations.html?tri=' + tri.id;

    if (!dossierComplete(tri.id)) {
      var d = dossierFor(tri.id);
      if (!d || d.initialStatus === 'not_started') {
        return { label: 'Build the story dossier', href: F + '#/dossier', week: 1, book: book, kind: 'dossier' };
      }
      return { label: 'Critique & revise the dossier', href: F + '#/dossier/critique', week: 1, book: book, kind: 'dossier' };
    }
    if (!charactersComplete(tri.id)) {
      var cs = charactersForTrilogy(tri.id);
      for (var i = 0; i < cs.length; i++) {
        if (cs[i].status !== 'complete') {
          return { label: 'Finish ' + (cs[i].name || cs[i].role || 'the next character'),
                   href: F + '#/characters/' + cs[i].id, week: 1, book: book, kind: 'character' };
        }
      }
    }
    if (!worldComplete(tri.id)) {
      return { label: 'Build the world', href: F + '#/world', week: 1, book: book, kind: 'world' };
    }
    if (!planComplete(tri.id)) {
      return { label: 'Plan the trilogy', href: F + '#/plan', week: 1, book: book, kind: 'plan' };
    }
    for (var b = 0; b < books.length; b++) {
      if (!outlineComplete(books[b].id)) {
        var ch = firstUnoutlined(books[b].id);
        return { label: 'Outline ' + books[b].title + ' — ch. ' + (ch ? ch.number : 1),
                 href: F + '#/outline/' + books[b].id, week: 1, book: books[b], kind: 'outline' };
      }
    }
    if (!styleComplete(tri.id)) {
      return { label: 'Prepare style & prose', href: F + '#/style', week: 1, book: book, kind: 'style' };
    }

    // Foundations are done. Find the first book that still needs work.
    for (var k = 0; k < books.length; k++) {
      var bk = books[k];
      var d2 = 'kdp-draft.html?book=' + bk.id;
      var u2 = firstUndone(bk.id, 1, 28);
      if (u2) {
        return { label: 'Draft ch. ' + u2.number + ' — ' + bk.title,
                 href: d2 + '&week=2#/w/' + u2.id, week: 2, book: bk, chapter: u2, kind: 'draft' };
      }
      var u3 = firstUndone(bk.id, 29, 40);
      if (u3) {
        return { label: 'Draft ch. ' + u3.number + ' — ' + bk.title,
                 href: d2 + '&week=3#/w/' + u3.id, week: 3, book: bk, chapter: u3, kind: 'draft' };
      }
      if (!continuityComplete(bk.id)) {
        return { label: 'Continuity pass — ' + bk.title,
                 href: 'kdp-continuity.html?book=' + bk.id + '#/', week: 4, book: bk, kind: 'continuity' };
      }
      var w5 = weekProgress(bk.id, 5);
      if (w5.pct < 100) {
        return { label: 'Publish ' + bk.title,
                 href: 'kdp-publish.html?book=' + bk.id + '#/', week: 5, book: bk, kind: 'publish' };
      }
    }
    return { label: 'Start the next trilogy', href: 'kdp.html#/shelf', week: 0, kind: 'new' };
  }

  /** Today's queue: the next handful of concrete things, not a wish list. */
  function todaysQueue(limit) {
    limit = limit || 5;
    var out = [], seen = {};
    var na = nextAction();
    if (na.href) { out.push({ label: na.label, href: na.href, week: na.week }); seen[na.href] = 1; }

    var ui = getUiState();
    var tri = Trilogies.get(ui.lastTrilogyId) || trilogiesSorted()[0];
    if (!tri) return out;
    var books = booksForTrilogy(tri.id);
    for (var b = 0; b < books.length && out.length < limit; b++) {
      var bk = books[b];
      var chs = chaptersForBook(bk.id);
      for (var i = 0; i < chs.length && out.length < limit; i++) {
        if (chapterIsFinal(chs[i])) continue;
        var wk = chs[i].number <= 28 ? 2 : 3;
        var href = 'kdp-draft.html?book=' + bk.id + '&week=' + wk + '#/w/' + chs[i].id;
        if (seen[href]) continue;
        seen[href] = 1;
        out.push({ label: 'Ch. ' + chs[i].number + (chs[i].title ? ' · ' + chs[i].title : '') +
                          ' — ' + bk.title, href: href, week: wk });
      }
    }
    return out;
  }

  // --- daily word log --------------------------------------------------------
  function logProgress(bookId, delta) {
    if (!delta || delta <= 0) return;
    var date = todayISO();
    var rows = Sessions.where(function (s) { return s.bookId === bookId && s.date === date; });
    if (rows.length) Sessions.update(rows[0].id, { words: Number(rows[0].words || 0) + delta });
    else Sessions.add({ bookId: bookId, date: date, words: delta });
  }
  function wordsOnDate(date) {
    var rows = Sessions.where(function (s) { return s.date === date; }), sum = 0;
    for (var i = 0; i < rows.length; i++) sum += Number(rows[i].words || 0);
    return sum;
  }
  function wordsInLastNDays(n) {
    var cutoff = isoDaysAgo(n - 1), rows = Sessions.list(), sum = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i].date >= cutoff) sum += Number(rows[i].words || 0);
    return sum;
  }
  function weekStrip() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var date = isoDaysAgo(i);
      out.push({ date: date, words: wordsOnDate(date), isToday: i === 0 });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // TIMELINE CONFLICT DETECTION
  // A row can state how much time the prose CLAIMS has passed. Where that
  // disagrees with the day column, say so in plain language.
  // ---------------------------------------------------------------------------
  function timelineForBook(bookId) {
    return Timeline.where(function (t) { return t.bookId === bookId; })
      .sort(function (a, b) { return a.day - b.day || a.chapterFrom - b.chapterFrom; });
  }
  function timelineConflicts(bookId) {
    var rows = timelineForBook(bookId), out = [];
    for (var i = 1; i < rows.length; i++) {
      var prev = rows[i - 1], cur = rows[i];
      if (cur.statedElapsed === '' || cur.statedElapsed == null) continue;
      var actual = cur.day - prev.day;
      if (Number(cur.statedElapsed) !== actual) {
        out.push({
          row: cur,
          message: 'Chapter ' + cur.chapterFrom + ' says ' + cur.statedElapsed +
                   ' day' + (Number(cur.statedElapsed) === 1 ? '' : 's') +
                   ' have passed, but the timeline requires ' + actual + '.'
        });
      }
    }
    // Chapters must not travel backwards in time.
    for (var j = 1; j < rows.length; j++) {
      if (rows[j].chapterFrom < rows[j - 1].chapterTo) {
        out.push({ row: rows[j],
          message: 'Chapter ' + rows[j].chapterFrom + ' is dated after chapter ' +
                   rows[j - 1].chapterTo + ' but appears earlier in the book.' });
      }
    }
    return out;
  }

  function romanceArcSeries(bookId, dimensionId) {
    var out = [];
    for (var n = 1; n <= CHAPTERS_PER_BOOK; n++) {
      var rows = RomanceBeats.where(function (r) {
        return r.bookId === bookId && r.chapter === n && r.dimension === dimensionId;
      });
      out.push(rows.length ? Number(rows[0].value || 0) : null);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // FORBIDDEN WORDS — the Week 1 style document, put to work in Weeks 2-3
  // ---------------------------------------------------------------------------
  function forbiddenList(trilogyId) {
    var doc = styleDoc(trilogyId, 'forbidden_words');
    if (!doc || !doc.body) return [];
    return String(doc.body)
      .split(/[\n,;]+/)
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (s) { return s && s.length > 1; });
  }
  function scanForbidden(text, words) {
    var hay = String(text || '').toLowerCase(), hits = [];
    for (var i = 0; i < words.length; i++) {
      var re = new RegExp('\\b' + words[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      var m = hay.match(re);
      if (m) hits.push({ word: words[i], count: m.length });
    }
    return hits.sort(function (a, b) { return b.count - a.count; });
  }

  // ---------------------------------------------------------------------------
  // COMPILE / EXPORT / BACKUP / ARCHIVE
  // The real answer to "data loss must not be a concern".
  // ---------------------------------------------------------------------------
  function compileBook(bookId) {
    var b = Books.get(bookId);
    if (!b) return '';
    var out = [b.title, ''];
    var acts = actsForBook(bookId);
    for (var a = 0; a < acts.length; a++) {
      out.push('', '## ' + acts[a].label, '');
      var chs = chaptersInRange(bookId, acts[a].from, acts[a].to);
      for (var i = 0; i < chs.length; i++) {
        var text = readDraft(chs[i].id, 'final').text;
        if (!text.trim()) continue;
        out.push('### Chapter ' + chs[i].number + (chs[i].title ? ' — ' + chs[i].title : ''), '', text, '');
      }
    }
    return out.join('\n');
  }

  function collectAll() {
    var dump = { exportedAt: nowISO(), version: 1, meta: {}, manuscript: {} };
    for (var k in KEYS) {
      var v = storeGet(KEYS[k]);
      if (v != null) dump.meta[KEYS[k]] = v;
    }
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(MS_PREFIX) === 0) dump.manuscript[key] = storeGet(key);
    }
    return dump;
  }
  function download(name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
      return true;
    } catch (e) { return false; }
  }
  function exportBackup() {
    var stamp = todayISO();
    return download('kdp-backup-' + stamp + '.json',
      JSON.stringify(collectAll(), null, 2), 'application/json');
  }

  /**
   * Archive a trilogy: force a backup first, then move everything belonging
   * to it under kdparc:, which sits outside BOTH synced prefixes. The cloud
   * rows stop carrying a finished book forever.
   */
  function archiveTrilogy(trilogyId) {
    var tri = Trilogies.get(trilogyId);
    if (!tri) return { ok: false, reason: 'No such trilogy' };

    var books = booksForTrilogy(trilogyId);
    var bookIds = books.map(function (b) { return b.id; });
    function inBook(r) { return bookIds.indexOf(r.bookId) !== -1; }

    var bundle = { trilogy: tri, books: books, acts: [], chapters: [], manuscript: {},
                   characters: charactersForTrilogy(trilogyId),
                   world: worldForTrilogy(trilogyId),
                   dossier: dossierFor(trilogyId),
                   styleDocs: styleDocsFor(trilogyId),
                   continuity: Continuity.where(inBook),
                   timeline: Timeline.where(inBook),
                   romanceBeats: RomanceBeats.where(inBook),
                   listings: Listings.where(inBook),
                   archivedAt: nowISO() };

    for (var i = 0; i < bookIds.length; i++) {
      bundle.acts = bundle.acts.concat(actsForBook(bookIds[i]));
      var chs = chaptersForBook(bookIds[i]);
      bundle.chapters = bundle.chapters.concat(chs);
      for (var c = 0; c < chs.length; c++) {
        bundle.manuscript[chs[c].id] = readManuscript(chs[c].id);
      }
    }

    // The backup leaves the machine before anything is removed from it.
    var saved = download('kdp-archive-' + tri.title.replace(/[^\w-]+/g, '-') + '-' + todayISO() + '.json',
      JSON.stringify(bundle, null, 2), 'application/json');
    if (!saved) return { ok: false, reason: 'Backup download was blocked — nothing was archived.' };

    var ok = storeSet(ARC_PREFIX + trilogyId, bundle);
    if (!ok) return { ok: false, reason: 'Could not write the archive — nothing was removed.' };

    for (var m = 0; m < bundle.chapters.length; m++) removeManuscript(bundle.chapters[m].id);
    Chapters.removeWhere(function (r) { return bookIds.indexOf(r.bookId) !== -1; });
    Acts.removeWhere(function (r) { return bookIds.indexOf(r.bookId) !== -1; });
    Continuity.removeWhere(inBook);
    Timeline.removeWhere(inBook);
    RomanceBeats.removeWhere(inBook);
    Listings.removeWhere(inBook);
    Sessions.removeWhere(inBook);
    Characters.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    World.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Dossiers.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    StyleDocs.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Books.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Trilogies.remove(trilogyId);

    var ui = getUiState();
    if (ui.lastTrilogyId === trilogyId) {
      setUiState({ lastTrilogyId: '', lastBookId: '', lastChapterId: '' });
    }
    return { ok: true };
  }

  function removeTrilogy(trilogyId) {
    var books = booksForTrilogy(trilogyId);
    var bookIds = books.map(function (b) { return b.id; });
    function inBook(r) { return bookIds.indexOf(r.bookId) !== -1; }
    for (var i = 0; i < bookIds.length; i++) {
      var chs = chaptersForBook(bookIds[i]);
      for (var c = 0; c < chs.length; c++) removeManuscript(chs[c].id);
    }
    Chapters.removeWhere(inBook); Acts.removeWhere(inBook);
    Continuity.removeWhere(inBook); Timeline.removeWhere(inBook);
    RomanceBeats.removeWhere(inBook); Listings.removeWhere(inBook);
    Sessions.removeWhere(inBook);
    Characters.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    World.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Dossiers.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    StyleDocs.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Books.removeWhere(function (r) { return r.trilogyId === trilogyId; });
    Trilogies.remove(trilogyId);
  }

  /** What sync is actually carrying, so it can be watched before it hurts. */
  function storageHealth() {
    var meta = 0, ms = 0, arc = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      var size = 0;
      try { size = (localStorage.getItem(k) || '').length; } catch (e) {}
      if (k.indexOf(MS_PREFIX) === 0) ms += size;
      else if (k.indexOf(ARC_PREFIX) === 0) arc += size;
      else if (k.indexOf('kdp:') === 0) meta += size;
    }
    function mb(n) { return Math.round((n / 1048576) * 100) / 100; }
    return {
      metaBytes: meta, manuscriptBytes: ms, archiveBytes: arc,
      metaMB: mb(meta), manuscriptMB: mb(ms), archiveMB: mb(arc),
      // past this the push starts to be felt on a phone
      heavy: ms > 4 * 1048576
    };
  }

  // ---------------------------------------------------------------------------
  // SEED THE LIBRARY ONCE
  // ---------------------------------------------------------------------------
  var STARTER_TEMPLATES = [
    { kind: 'Story Dossier', title: 'Story Dossier — blank',
      body: 'TITLE:\nGENRE:\nLOGLINE:\n\nPREMISE:\n\nMAIN PLOT:\n\nROMANCE ARC:\n\nTHEMES:\n\nSTAKES:\n\nENDING:' },
    { kind: 'Character Sheet', title: 'Character Sheet — blank',
      body: 'NAME:\nROLE:\nAGE:\nAPPEARANCE:\n\nWANT:\nNEED:\nWOUND:\nLIE THEY BELIEVE:\n\nVOICE:\nSKILLS:\nFEARS:\nRELATIONSHIPS:\n\nARC (start → end):' },
    { kind: 'Worldbuilding Sheet', title: 'Worldbuilding Sheet — blank',
      body: 'ELEMENT:\nSUMMARY:\n\nRULES:\n\nLIMITS / COST:\n\nHOW IT SHOWS UP ON THE PAGE:\n\nCONTRADICTIONS TO AVOID:' },
    { kind: 'Chapter Outline', title: 'Chapter Outline — blank',
      body: 'CHAPTER:\nPOV:\nSETTING:\n\nGOAL:\nCONFLICT:\nTURN:\nEXIT ON:\n\nROMANCE BEAT:\nPLOT ADVANCE:\nSETUP PLANTED:\nPAYOFF DELIVERED:' },
    { kind: 'Trilogy Outline', title: 'Trilogy Outline — blank',
      body: 'BOOK I\n  MAIN PLOT:\n  ROMANCE ARC:\n  ENDS ON:\n\nBOOK II\n  MAIN PLOT:\n  ROMANCE ARC:\n  ENDS ON:\n\nBOOK III\n  MAIN PLOT:\n  ROMANCE ARC:\n  ENDS ON:' },
    { kind: 'Style Sheet', title: 'Style Sheet — blank',
      body: 'NARRATIVE DISTANCE:\nTENSE:\nPOV:\n\nSENTENCE RHYTHM:\n\nDICTION - USE:\nDICTION - AVOID:\n\nMETAPHOR SOURCES:\n\nDIALOGUE STYLE:\n\nINTERIORITY:\n\nHEAT LEVEL / FADE POINT:\n\nTICS TO CUT:' },
    { kind: 'Continuity', title: 'Continuity check — blank',
      body: 'ITEM:\nCHAPTERS INVOLVED:\nWHAT IS CLAIMED:\nWHAT CONTRADICTS IT:\nFIX:' }
  ];
  var STARTER_PROMPTS = [
    { category: 'Brainstorming', title: 'Trilogy concept spread',
      text: 'Give me 10 romantasy trilogy concepts using these genres, tropes and themes:\n\nGENRES: {{GENRES}}\nTROPES: {{TROPES}}\nTHEMES: {{THEMES}}\nROMANCE ARC: {{ROMANCE_ARC}}\n\nFor each: a one-line logline, the central bargain, and what makes book II different from book I.' },
    { category: 'Dossier', title: 'Emotional critique of the dossier',
      text: 'Here is my story dossier:\n\n{{DOSSIER}}\n\nCritique it purely on EMOTION. Where will a reader feel nothing? Which turns are intellectually clever but emotionally inert? Name the three moments that must hit hardest and say whether the dossier earns them.' },
    { category: 'Dossier', title: 'Character name critique',
      text: 'Character: {{CHARACTER_NAME}} — {{ROLE}} in a romantasy trilogy.\n\nCritique this name on: pronounceability, genre fit, distinctiveness against the other three leads ({{OTHER_NAMES}}), and unfortunate associations. Offer 8 alternatives that keep the same sound-feel.' },
    { category: 'Dossier', title: 'Revise the dossier from both critiques',
      text: 'Original dossier:\n{{DOSSIER}}\n\nEmotional critique:\n{{EMOTIONAL_CRITIQUE}}\n\nName critiques:\n{{NAME_CRITIQUES}}\n\nRewrite the dossier resolving every critique. Keep the premise. Change nothing that was working.' },
    { category: 'Characters', title: 'Fill a character sheet',
      text: 'Fill this character sheet for {{CHARACTER_NAME}}, the {{ROLE}} of {{TRILOGY}}.\n\nStory dossier for context:\n{{DOSSIER}}\n\nSheet:\n{{CHARACTER_SHEET_TEMPLATE}}\n\nThe wound and the lie must explain the arc. No generic answers.' },
    { category: 'Worldbuilding', title: 'Build a worldbuilding element',
      text: 'Worldbuilding element: {{ELEMENT}}\nTrilogy: {{TRILOGY}}\nDossier: {{DOSSIER}}\n\nBuild it with: summary, hard rules, limits and cost, how it appears on the page, and the three contradictions I must never write.' },
    { category: 'Outline', title: 'Chapter-by-chapter for one book',
      text: 'Outline {{BOOK_TITLE}} chapter by chapter — 40 chapters, Act I ch 1–10, Act II ch 11–30, Act III ch 31–40.\n\nDossier: {{DOSSIER}}\nCharacters: {{CHARACTERS}}\nWorld: {{WORLD}}\n\nUse this template per chapter:\n{{CHAPTER_OUTLINE_TEMPLATE}}' },
    { category: 'Generate', title: 'Generate a chapter',
      text: 'Write Chapter {{CHAPTER_NO}} of {{BOOK_TITLE}}.\n\nOutline:\n{{CHAPTER_OUTLINE}}\n\nPOV: {{POV_CHARACTER}}\nPrior beat: {{PREVIOUS_CHAPTER_END}}\nStyle sheet: {{STYLE_SHEET}}\nSample prose to match: {{SAMPLE_PROSE}}\nNever use: {{FORBIDDEN_WORDS}}\n\nTarget 3,000–3,400 words. End on the turn, not the aftermath.' },
    { category: 'Critique', title: 'Chapter improvement plan',
      text: 'Here is chapter {{CHAPTER_NO}}:\n\n{{CHAPTER_TEXT}}\n\nProduce an improvement plan — not a rewrite. Cover: where tension slackens, dialogue that states the subtext, description that stalls the scene, the romance beat landing or not, and whether the exit line earns the page turn.' },
    { category: 'Rewrite', title: 'Rewrite from the plan',
      text: 'Original chapter:\n{{CHAPTER_TEXT}}\n\nImprovement plan:\n{{IMPROVEMENT_PLAN}}\n\nRewrite the chapter applying every point. Keep what already worked. Match: {{STYLE_SHEET}}. Never use: {{FORBIDDEN_WORDS}}.' },
    { category: 'Line edit', title: 'Line edit pass',
      text: 'Line edit this chapter. Tighten sentences, cut filter words, vary rhythm, strengthen verbs. Do not change events, dialogue meaning, or voice.\n\n{{CHAPTER_TEXT}}\n\nForbidden words: {{FORBIDDEN_WORDS}}' },
    { category: 'Continuity', title: 'Continuity sweep',
      text: 'Check {{BOOK_TITLE}} for {{CATEGORY}} continuity errors.\n\nChapters:\n{{MANUSCRIPT}}\n\nFor each problem give: the chapters involved, what is claimed, what contradicts it, and the smallest fix.' },
    { category: 'Continuity', title: 'Timeline reconstruction',
      text: 'Reconstruct the timeline of {{BOOK_TITLE}} as a Day / Chapter / Event table from the manuscript below. Flag every place the prose states an elapsed time that the table contradicts.\n\n{{MANUSCRIPT}}' },
    { category: 'Formatting', title: 'Amazon KDP blurb',
      text: 'Write an Amazon KDP blurb for {{BOOK_TITLE}}.\n\nLogline: {{LOGLINE}}\nTropes: {{TROPES}}\nComp titles: {{COMPS}}\n\nHook in the first line. Under 200 words. End on the question, not the answer.' },
    { category: 'Formatting', title: 'KDP keywords and categories',
      text: 'Give me 7 Amazon KDP keyword phrases and 3 categories for:\n\n{{BOOK_TITLE}} — {{LOGLINE}}\nTropes: {{TROPES}}\n\nKeywords must be phrases readers actually search, not single words. Explain each in six words.' }
  ];

  function seedLibraryIfNeeded() {
    if (storeGet(KEYS.seededAt)) return;
    if (!Templates.list().length) {
      Templates.addMany(STARTER_TEMPLATES.map(function (t, i) {
        return assign(t, { order: i + 1 });
      }));
    }
    if (!Prompts.list().length) {
      Prompts.addMany(STARTER_PROMPTS.map(function (p, i) {
        return assign(p, { order: i + 1 });
      }));
    }
    storeSet(KEYS.seededAt, nowISO());
  }

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------
  window.KdpData = {
    KEYS: KEYS, MS_PREFIX: MS_PREFIX, ARC_PREFIX: ARC_PREFIX,

    // primitives
    storeGet: storeGet, storeSet: storeSet, uid: uid, nowISO: nowISO, todayISO: todayISO,
    isoDaysAgo: isoDaysAgo, daysBetween: daysBetween, clamp: clamp,
    escapeHtml: escapeHtml, wordCount: wordCount, fmtWords: fmtWords,
    fmtCompact: fmtCompact, fmtDate: fmtDate, romanize: romanize,
    mdToHtml: mdToHtml, highlightVars: highlightVars,
    byOrder: byOrder, nextOrder: nextOrder, reorderCollection: reorderCollection,

    // vocabulary
    DOSSIER_STATUSES: DOSSIER_STATUSES, CHAR_STATUSES: CHAR_STATUSES,
    WORLD_STATUSES: WORLD_STATUSES, CHAPTER_STATUSES: CHAPTER_STATUSES,
    TASK_STATUSES: TASK_STATUSES, statusMeta: statusMeta,
    WORLD_SECTIONS: WORLD_SECTIONS, STYLE_DOCS: STYLE_DOCS, INDEXES: INDEXES,
    CONTINUITY_CATEGORIES: CONTINUITY_CATEGORIES, ROMANCE_DIMENSIONS: ROMANCE_DIMENSIONS,
    PROMPT_CATEGORIES: PROMPT_CATEGORIES, TEMPLATE_KINDS: TEMPLATE_KINDS,
    WEEKS: WEEKS, weekMeta: weekMeta, IDEAS: IDEAS,
    CHAPTERS_PER_BOOK: CHAPTERS_PER_BOOK, ACT_RANGES: ACT_RANGES, actForChapter: actForChapter,

    // collections
    Trilogies: Trilogies, Books: Books, Acts: Acts, Chapters: Chapters,
    Characters: Characters, World: World, Dossiers: Dossiers, StyleDocs: StyleDocs,
    Notes: Notes, PromptBlocks: PromptBlocks, Prompts: Prompts, Templates: Templates,
    Continuity: Continuity, Timeline: Timeline, RomanceBeats: RomanceBeats,
    Listings: Listings, Sessions: Sessions,

    // singletons
    getUiState: getUiState, setUiState: setUiState,
    getSettings: getSettings, setSettings: setSettings,

    // manuscript
    readManuscript: readManuscript, readDraft: readDraft, writeDraft: writeDraft,
    removeManuscript: removeManuscript,

    // structure
    createTrilogy: createTrilogy, removeTrilogy: removeTrilogy, archiveTrilogy: archiveTrilogy,
    repairTrilogy: repairTrilogy, trilogyHealth: trilogyHealth,
    trilogiesSorted: trilogiesSorted, booksForTrilogy: booksForTrilogy,
    actsForBook: actsForBook, chaptersForBook: chaptersForBook, chaptersInRange: chaptersInRange,
    charactersForTrilogy: charactersForTrilogy, worldForTrilogy: worldForTrilogy,
    worldSection: worldSection, dossierFor: dossierFor, styleDocsFor: styleDocsFor,
    styleDoc: styleDoc, listingFor: listingFor, notesFor: notesFor,
    promptBlocksFor: promptBlocksFor,

    // computation
    bookWordCount: bookWordCount, bookProgress: bookProgress,
    trilogyWordCount: trilogyWordCount, chapterIsFinal: chapterIsFinal, countFinal: countFinal,
    dossierComplete: dossierComplete, charactersComplete: charactersComplete,
    worldComplete: worldComplete, outlineComplete: outlineComplete,
    firstUnoutlined: firstUnoutlined, planComplete: planComplete, styleComplete: styleComplete,
    continuityComplete: continuityComplete, firstUndone: firstUndone,
    weekProgress: weekProgress, nextAction: nextAction, todaysQueue: todaysQueue,

    // log
    logProgress: logProgress, wordsOnDate: wordsOnDate,
    wordsInLastNDays: wordsInLastNDays, weekStrip: weekStrip,

    // week 4
    timelineForBook: timelineForBook, timelineConflicts: timelineConflicts,
    romanceArcSeries: romanceArcSeries,
    forbiddenList: forbiddenList, scanForbidden: scanForbidden,

    // export
    compileBook: compileBook, collectAll: collectAll, download: download,
    exportBackup: exportBackup, storageHealth: storageHealth,

    seedLibraryIfNeeded: seedLibraryIfNeeded
  };
})();
