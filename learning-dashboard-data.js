// learning-dashboard-data.js
//
// Data layer for learning-dashboard.html ("Learning Dashboard"). Same
// conventions as aitech-data.js/business-data.js (see CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB. All
// keys live under an `lhub:` prefix (deliberately distinct from the
// pre-existing `learning:` prefix used by learning.html/learning-topic.html
// — a genuinely separate page/system, not a rebuild of that one) so
// learning-dashboard.html's initCloudSync({ syncedPrefixes: ['lhub:'] })
// call covers every collection with no per-key list.
//
// Nine genuinely separate collections, never merged:
//   Topics, DailyLogs (one per topic+date), Research, Maps, Frameworks,
//   MasterNotes, Notes (atomic), Projects, Questions, Sessions (study
//   timer log), plus a single Settings record.
//
// A Topic's "Sources" tab and the global Research Library are the SAME
// data (Research items filtered by topicId) — not a duplicate collection,
// since a research source and a topic's sources are the same thing viewed
// two ways. Deleting a Topic nulls out `topicId` on every record that
// referenced it (Research/Maps/Frameworks/MasterNotes/Notes/Projects/
// Questions/Sessions) rather than cascading a delete — same
// null-out-the-reference precedent aitech-data.js's model deletion,
// household-data.js's legion deletion, and business-data.js's week/day
// deletion already established — so nothing is silently lost just because
// its parent topic was archived or removed.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js's
  // storeSet(): dispatches 'lhub:save' either way so the page can show a
  // real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('lhub:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('lhub:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    topics: 'lhub:topics',
    dailyLogs: 'lhub:dailyLogs',
    research: 'lhub:research',
    maps: 'lhub:maps',
    frameworks: 'lhub:frameworks',
    masterNotes: 'lhub:masterNotes',
    notes: 'lhub:notes',
    projects: 'lhub:projects',
    questions: 'lhub:questions',
    sessions: 'lhub:sessions',
    settings: 'lhub:settings',
    seeded: 'lhub:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // IMAGE / URL HELPERS — same canvas-downscale recipe + http(s)-only
  // guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 480;
    quality = quality == null ? 0.82 : quality;
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
  // FIXED REFERENCE DATA — the Monthly Workflow's four weeks. Not stored;
  // every Topic just carries a `currentWeek` (1-4) pointer into this.
  // ============================================================
  const WEEKS = [
    {
      week: 1, stage: 'Gather & Explore',
      tasks: ['Collect books', 'Research papers', 'Articles', 'Videos', 'Podcasts', 'AI chats'],
      outputs: ['Raw Notes', 'Quotes', 'Vocabulary', 'Questions', 'Sources']
    },
    {
      week: 2, stage: 'Organize & Connect',
      tasks: ['Group raw material by theme', 'Cross-reference sources', 'Spot contradictions'],
      outputs: ['Atomic Notes', 'Definitions', 'Mind Maps', 'Linked Notes', 'Framework Drafts']
    },
    {
      week: 3, stage: 'Integrate & Apply',
      tasks: ['Draft frameworks', 'Start a project', 'Practice out loud'],
      outputs: ['Personal Frameworks', 'Projects', 'Voice Notes', 'Practice', 'Journal']
    },
    {
      week: 4, stage: 'Teach, Reflect & Expand',
      tasks: ['Explain it to someone else', 'Build a cheat sheet', 'Synthesize the Master Note'],
      outputs: ['Teaching Notes', 'Cheat Sheets', 'Master Note', 'Reflection', 'Flashcards']
    }
  ];
  function weekInfo(weekNum) { return WEEKS[Math.min(Math.max((weekNum || 1) - 1, 0), 3)]; }

  const CRITICAL_QUESTIONS = [
    { key: 'missing', label: 'What is missing?' },
    { key: 'beneath', label: "What's beneath this?" },
    { key: 'flaws', label: 'What are the flaws?' },
    { key: 'implications', label: 'What are the implications?' },
    { key: 'origin', label: "What's the origin?" }
  ];
  const MEDIA_CHECKLIST = [
    { key: 'books', label: 'Books', icon: '📕' },
    { key: 'articles', label: 'Articles', icon: '📰' },
    { key: 'papers', label: 'Research Papers', icon: '📄' },
    { key: 'videos', label: 'Videos', icon: '🎬' },
    { key: 'podcasts', label: 'Podcasts', icon: '🎙️' },
    { key: 'ai', label: 'AI', icon: '🤖' }
  ];
  const OUTPUT_FIELDS = [
    { key: 'rawNotes', label: 'Raw Notes' },
    { key: 'mainIdea', label: 'Main Idea' },
    { key: 'patterns', label: 'Patterns' },
    { key: 'contradictions', label: 'Contradictions' },
    { key: 'connections', label: 'Connections' },
    { key: 'questions', label: 'Questions' },
    { key: 'examples', label: 'Examples' }
  ];

  const TOPIC_COLORS = ['#E11D48', '#F472B6', '#F59E0B', '#34D399', '#60A5FA', '#A78BFA', '#FB7185'];
  const TOPIC_STATUSES = ['active', 'paused', 'completed', 'archived'];
  const RESEARCH_CATEGORIES = ['Books', 'Research Papers', 'Articles', 'Videos', 'Podcasts', 'AI Conversations', 'Courses', 'PDFs', 'Bookmarks'];
  const RESEARCH_STATUSES = ['to-review', 'in-progress', 'done'];
  const NOTE_TYPES = ['atomic', 'quote', 'vocabulary', 'definition', 'raw'];
  const PROJECT_STATUSES = ['idea', 'in-progress', 'done'];
  const QUESTION_STATUSES = ['open', 'answered'];

  // ============================================================
  // MODELS
  // ============================================================
  /** @typedef {{id:string, title:string, description:string, icon:string, color:string, status:string, currentWeek:number, completionPct:number, estimatedHours:number, currentQuestion:string, lastStudiedAt:?number, order:number, createdAt:number}} Topic */
  function topicModel(data) {
    data = data || {};
    return {
      id: data.id || uid('top'),
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '🧠',
      color: TOPIC_COLORS.indexOf(data.color) !== -1 ? data.color : TOPIC_COLORS[0],
      status: TOPIC_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      currentWeek: (typeof data.currentWeek === 'number' && data.currentWeek >= 1 && data.currentWeek <= 4) ? data.currentWeek : 1,
      completionPct: (typeof data.completionPct === 'number' && data.completionPct >= 0 && data.completionPct <= 100) ? data.completionPct : 0,
      estimatedHours: typeof data.estimatedHours === 'number' ? data.estimatedHours : 20,
      currentQuestion: typeof data.currentQuestion === 'string' ? data.currentQuestion : '',
      lastStudiedAt: typeof data.lastStudiedAt === 'number' ? data.lastStudiedAt : null,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function dailyLogModel(data) {
    data = data || {};
    const media = data.media || {};
    const cq = data.criticalQuestions || {};
    const out = data.outputs || {};
    return {
      id: data.id || uid('log'),
      topicId: data.topicId || null,
      date: typeof data.date === 'string' ? data.date : todayISO(),
      media: {
        books: !!media.books, articles: !!media.articles, papers: !!media.papers,
        videos: !!media.videos, podcasts: !!media.podcasts, ai: !!media.ai
      },
      criticalQuestions: {
        missing: typeof cq.missing === 'string' ? cq.missing : '',
        beneath: typeof cq.beneath === 'string' ? cq.beneath : '',
        flaws: typeof cq.flaws === 'string' ? cq.flaws : '',
        implications: typeof cq.implications === 'string' ? cq.implications : '',
        origin: typeof cq.origin === 'string' ? cq.origin : ''
      },
      outputs: {
        rawNotes: typeof out.rawNotes === 'string' ? out.rawNotes : '',
        mainIdea: typeof out.mainIdea === 'string' ? out.mainIdea : '',
        patterns: typeof out.patterns === 'string' ? out.patterns : '',
        contradictions: typeof out.contradictions === 'string' ? out.contradictions : '',
        connections: typeof out.connections === 'string' ? out.connections : '',
        questions: typeof out.questions === 'string' ? out.questions : '',
        examples: typeof out.examples === 'string' ? out.examples : ''
      },
      minutes: typeof data.minutes === 'number' ? data.minutes : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: Date.now()
    };
  }

  function researchModel(data) {
    data = data || {};
    return {
      id: data.id || uid('res'),
      topicId: data.topicId || null,
      category: RESEARCH_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'Bookmarks',
      title: typeof data.title === 'string' ? data.title : '',
      author: typeof data.author === 'string' ? data.author : '',
      url: typeof data.url === 'string' ? data.url : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      status: RESEARCH_STATUSES.indexOf(data.status) !== -1 ? data.status : 'to-review',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function mapModel(data) {
    data = data || {};
    return {
      id: data.id || uid('map'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : 'Untitled Map',
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function frameworkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fwk'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '💡',
      color: TOPIC_COLORS.indexOf(data.color) !== -1 ? data.color : TOPIC_COLORS[1],
      sections: Array.isArray(data.sections) ? data.sections : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function masterNoteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mn'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : 'Untitled Master Note',
      body: typeof data.body === 'string' ? data.body : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      type: NOTE_TYPES.indexOf(data.type) !== -1 ? data.type : 'atomic',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function projectModel(data) {
    data = data || {};
    return {
      id: data.id || uid('proj'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      status: PROJECT_STATUSES.indexOf(data.status) !== -1 ? data.status : 'idea',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function questionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('q'),
      topicId: data.topicId || null,
      text: typeof data.text === 'string' ? data.text : '',
      status: QUESTION_STATUSES.indexOf(data.status) !== -1 ? data.status : 'open',
      answer: typeof data.answer === 'string' ? data.answer : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function sessionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('sess'),
      topicId: data.topicId || null,
      date: typeof data.date === 'string' ? data.date : todayISO(),
      minutes: typeof data.minutes === 'number' ? data.minutes : 0,
      mode: data.mode === 'pomodoro' ? 'pomodoro' : 'timer',
      completedAt: typeof data.completedAt === 'number' ? data.completedAt : Date.now()
    };
  }

  function settingsModel(data) {
    data = data || {};
    return {
      accentColor: typeof data.accentColor === 'string' && data.accentColor ? data.accentColor : '#E11D48',
      obsidianVaultPath: typeof data.obsidianVaultPath === 'string' ? data.obsidianVaultPath : '',
      defaultSessionMinutes: typeof data.defaultSessionMinutes === 'number' ? data.defaultSessionMinutes : 25,
      pomodoroWork: typeof data.pomodoroWork === 'number' ? data.pomodoroWork : 25,
      pomodoroBreak: typeof data.pomodoroBreak === 'number' ? data.pomodoroBreak : 5,
      notificationsEnabled: !!data.notificationsEnabled,
      theme: data.theme === 'light' ? 'light' : 'dark'
    };
  }
  function getSettings() { return settingsModel(storeGet(KEYS.settings)); }
  function saveSettings(patch) { const next = settingsModel(Object.assign({}, getSettings(), patch)); storeSet(KEYS.settings, next); return next; }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // aitech-data.js/business-data.js/household-data.js.
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

  const Topics = makeCollection(KEYS.topics, topicModel);
  const DailyLogs = makeCollection(KEYS.dailyLogs, dailyLogModel);
  const Research = makeCollection(KEYS.research, researchModel);
  const Maps = makeCollection(KEYS.maps, mapModel);
  const Frameworks = makeCollection(KEYS.frameworks, frameworkModel);
  const MasterNotes = makeCollection(KEYS.masterNotes, masterNoteModel);
  const Notes = makeCollection(KEYS.notes, noteModel);
  const Projects = makeCollection(KEYS.projects, projectModel);
  const Questions = makeCollection(KEYS.questions, questionModel);
  const Sessions = makeCollection(KEYS.sessions, sessionModel);

  /** Deleting a topic nulls out topicId on every dependent record instead
   * of cascading a delete — same null-out-the-reference precedent as
   * aitech-data.js's removeModel(). */
  function removeTopic(id) {
    Topics.remove(id);
    [Research, Maps, Frameworks, MasterNotes, Notes, Projects, Questions, Sessions].forEach(function (col) {
      col.replaceAll(col.list().map(function (r) { return r.topicId === id ? Object.assign({}, r, { topicId: null }) : r; }));
    });
    DailyLogs.replaceAll(DailyLogs.list().filter(function (l) { return l.topicId !== id; }));
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function byOrder(a, b) { return a.order - b.order; }
  function topicsSorted() { return Topics.list().slice().sort(byOrder); }
  function activeTopics() { return topicsSorted().filter(function (t) { return t.status === 'active'; }); }
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function reorderCollection(col, orderedIds) {
    const all = col.list();
    const byId = {}; all.forEach(function (x) { byId[x.id] = x; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    col.replaceAll(all);
  }

  function sessionsForTopic(topicId) { return Sessions.list().filter(function (s) { return s.topicId === topicId; }); }
  function dailyLogsForTopic(topicId) { return DailyLogs.list().filter(function (l) { return l.topicId === topicId; }).sort(function (a, b) { return b.date < a.date ? -1 : 1; }); }
  function dailyLogFor(topicId, date) { return DailyLogs.list().find(function (l) { return l.topicId === topicId && l.date === date; }) || null; }
  function upsertDailyLog(topicId, date, patch) {
    const existing = dailyLogFor(topicId, date);
    if (existing) return DailyLogs.update(existing.id, patch);
    return DailyLogs.add(Object.assign({ topicId: topicId, date: date }, patch));
  }
  function researchForTopic(topicId) { return Research.list().filter(function (r) { return r.topicId === topicId; }).sort(byOrder); }
  function mapsForTopic(topicId) { return Maps.list().filter(function (m) { return m.topicId === topicId; }).sort(byOrder); }
  function frameworksForTopic(topicId) { return Frameworks.list().filter(function (f) { return f.topicId === topicId; }).sort(byOrder); }
  function masterNotesForTopic(topicId) { return MasterNotes.list().filter(function (m) { return m.topicId === topicId; }).sort(byOrder); }
  function notesForTopic(topicId) { return Notes.list().filter(function (n) { return n.topicId === topicId; }).sort(byOrder); }
  function projectsForTopic(topicId) { return Projects.list().filter(function (p) { return p.topicId === topicId; }).sort(byOrder); }
  function questionsForTopic(topicId) { return Questions.list().filter(function (q) { return q.topicId === topicId; }).sort(byOrder); }

  /** Hours logged for a topic = timer Sessions + any minutes logged
   * directly on a DailyLog, summed and converted to hours. Computed live,
   * never stored, so it can never drift from the records it's derived
   * from — same "derived, not stored" precedent as this app's other
   * roll-up numbers (e.g. household-data.js's selectors). */
  function hoursLoggedForTopic(topicId) {
    const sessMin = sessionsForTopic(topicId).reduce(function (s, x) { return s + (x.minutes || 0); }, 0);
    const logMin = dailyLogsForTopic(topicId).reduce(function (s, x) { return s + (x.minutes || 0); }, 0);
    return Math.round(((sessMin + logMin) / 60) * 10) / 10;
  }
  function totalHoursLogged() {
    return topicsSorted().reduce(function (s, t) { return s + hoursLoggedForTopic(t.id); }, 0);
  }

  /** "Current topic" = whichever active topic was most recently studied
   * (by lastStudiedAt), falling back to the first active topic by order,
   * falling back to the first topic of any status. */
  function currentTopic() {
    const active = activeTopics();
    if (!active.length) return topicsSorted()[0] || null;
    const withDate = active.filter(function (t) { return t.lastStudiedAt; });
    if (withDate.length) {
      return withDate.slice().sort(function (a, b) { return b.lastStudiedAt - a.lastStudiedAt; })[0];
    }
    return active[0];
  }
  function markStudied(topicId) {
    Topics.update(topicId, { lastStudiedAt: Date.now() });
  }

  function recentlyStudiedTopics(limit) {
    return topicsSorted()
      .filter(function (t) { return t.lastStudiedAt; })
      .sort(function (a, b) { return b.lastStudiedAt - a.lastStudiedAt; })
      .slice(0, limit || 5);
  }

  /** Learning streak: count consecutive days (walking backward from today)
   * that have at least one Session OR DailyLog with real content, the same
   * day-by-day-walk shape index.html's/mainpillar.html's own habit-streak
   * computations already use elsewhere in this app. */
  function studyDates() {
    const set = {};
    Sessions.list().forEach(function (s) { if (s.date) set[s.date] = true; });
    DailyLogs.list().forEach(function (l) {
      if (!l.date) return;
      const hasContent = l.minutes > 0 || Object.keys(l.media || {}).some(function (k) { return l.media[k]; }) ||
        Object.keys(l.outputs || {}).some(function (k) { return (l.outputs[k] || '').trim(); });
      if (hasContent) set[l.date] = true;
    });
    return set;
  }
  function currentStreak() {
    const dates = studyDates();
    let streak = 0;
    let cursor = new Date();
    // Allow "today" to be not-yet-studied without breaking the streak —
    // start counting from yesterday if today has nothing logged yet.
    if (!dates[todayISO()]) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 3650; i++) {
      const key = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
      if (dates[key]) { streak++; cursor.setDate(cursor.getDate() - 1); } else break;
    }
    return streak;
  }
  function weeklyActivityMinutes() {
    // Last 7 days (oldest first), total minutes per day across Sessions + DailyLogs.
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const date = isoDaysAgo(i);
      const sess = Sessions.list().filter(function (s) { return s.date === date; }).reduce(function (s, x) { return s + x.minutes; }, 0);
      const log = DailyLogs.list().filter(function (l) { return l.date === date; }).reduce(function (s, x) { return s + x.minutes; }, 0);
      out.push({ date: date, minutes: sess + log });
    }
    return out;
  }
  function monthlyCompletionTrend() {
    // Average completion % across all non-archived topics, sampled once
    // "now" — a real historical trend line would need a snapshot log this
    // app doesn't keep (same documented simplification precedent as
    // projects.html's own burndown-chart fixed-scope assumption). Shown
    // as a single current bar per status bucket instead of a time series.
    const topics = topicsSorted().filter(function (t) { return t.status !== 'archived'; });
    if (!topics.length) return 0;
    return Math.round(topics.reduce(function (s, t) { return s + t.completionPct; }, 0) / topics.length);
  }

  // ============================================================
  // MARKDOWN-LITE — same lightweight renderer convention this app's other
  // note-reading surfaces already use (e.g. selfcare.html's journal
  // render), extended with a [[Backlink]] token for Master Notes.
  // ============================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  }
  function extractHeadings(body) {
    const lines = String(body || '').split('\n');
    const out = [];
    lines.forEach(function (line) {
      const m = line.match(/^(#{1,3})\s+(.*)$/);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), slug: slugify(m[2].trim()) });
    });
    return out;
  }
  function extractBacklinkTitles(body) {
    const out = [];
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(String(body || '')))) out.push(m[1].trim());
    return out;
  }
  function backlinksTo(noteId) {
    const target = MasterNotes.get(noteId);
    if (!target) return [];
    const titleLower = target.title.toLowerCase();
    return MasterNotes.list().filter(function (n) {
      if (n.id === noteId) return false;
      return extractBacklinkTitles(n.body).some(function (t) { return t.toLowerCase() === titleLower; });
    });
  }
  function renderMarkdownLite(body) {
    const lines = String(body || '').split('\n');
    let html = '';
    let inList = false, inOl = false, inQuote = false;
    function closeLists() {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      if (inQuote) { html += '</blockquote>'; inQuote = false; }
    }
    function inline(text) {
      let t = escapeHtml(text);
      t = t.replace(/\[\[([^\]]+)\]\]/g, function (m, title) {
        return '<span class="lhd-backlink" data-backlink-title="' + escapeHtml(title.trim()).replace(/"/g, '&quot;') + '">' + escapeHtml(title.trim()) + '</span>';
      });
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
      return t;
    }
    lines.forEach(function (raw) {
      const line = raw;
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        closeLists();
        const level = h[1].length;
        const slug = slugify(h[2].trim());
        html += '<h' + (level + 2) + ' id="lhd-h-' + slug + '">' + inline(h[2].trim()) + '</h' + (level + 2) + '>';
        return;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!inList) { closeLists(); html += '<ul>'; inList = true; }
        html += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>';
        return;
      }
      if (/^\d+\.\s+/.test(line)) {
        if (!inOl) { closeLists(); html += '<ol>'; inOl = true; }
        html += '<li>' + inline(line.replace(/^\d+\.\s+/, '')) + '</li>';
        return;
      }
      if (/^>\s?/.test(line)) {
        if (!inQuote) { closeLists(); html += '<blockquote>'; inQuote = true; }
        html += '<p>' + inline(line.replace(/^>\s?/, '')) + '</p>';
        return;
      }
      closeLists();
      if (line.trim() === '') { html += ''; return; }
      html += '<p>' + inline(line) + '</p>';
    });
    closeLists();
    return html;
  }

  // ============================================================
  // SEED — a small, realistic starting board so every section demonstrates
  // real data on first load rather than an empty state. Guarded by
  // KEYS.seeded; NOT called automatically at script-load time (see the
  // page's own maybeSeedAfterSyncAttempt() for why — same empty-storage
  // seed-race reasoning as aitech-data.js/dreamboard-data.js: seeding
  // before the cloud pull gets a real chance to answer could push a
  // freshly-seeded board to Supabase and clobber another device's real
  // data).
  // ============================================================
  function seedDefaultData() {
    Topics.replaceAll([]); DailyLogs.replaceAll([]); Research.replaceAll([]); Maps.replaceAll([]);
    Frameworks.replaceAll([]); MasterNotes.replaceAll([]); Notes.replaceAll([]); Projects.replaceAll([]);
    Questions.replaceAll([]); Sessions.replaceAll([]);

    const ai = Topics.add({
      title: 'Artificial Intelligence', icon: '🤖', color: '#E11D48', status: 'active',
      currentWeek: 2, completionPct: 63, estimatedHours: 40,
      currentQuestion: 'How does attention actually let a transformer "focus" on relevant tokens?',
      description: 'Foundations of ML, neural nets, and how modern LLMs are actually built and trained.',
      order: 0, lastStudiedAt: Date.now() - 1000 * 60 * 60 * 5
    });
    const phil = Topics.add({
      title: 'Stoic Philosophy', icon: '🏛️', color: '#F472B6', status: 'active',
      currentWeek: 4, completionPct: 88, estimatedHours: 18,
      currentQuestion: 'Where is the real line between acceptance and passivity?',
      description: 'Reading the core texts (Meditations, Enchiridion, Letters from a Stoic) and building a practice around them.',
      order: 1, lastStudiedAt: Date.now() - 1000 * 60 * 60 * 30
    });
    const design = Topics.add({
      title: 'Visual Design Systems', icon: '🎨', color: '#60A5FA', status: 'paused',
      currentWeek: 1, completionPct: 12, estimatedHours: 25,
      currentQuestion: 'What actually makes a type scale feel "premium" vs. just bigger?',
      description: 'Typography, color systems, spacing scales — the underlying rules behind interfaces that feel expensive.',
      order: 2, lastStudiedAt: null
    });

    // Research
    [
      { topicId: ai.id, category: 'Research Papers', title: 'Attention Is All You Need', author: 'Vaswani et al.', status: 'done', notes: 'The original Transformer paper. Re-read the multi-head attention section twice.' },
      { topicId: ai.id, category: 'Books', title: 'Deep Learning', author: 'Goodfellow, Bengio, Courville', status: 'in-progress', notes: 'Chapters 6-8 on optimization.' },
      { topicId: ai.id, category: 'Videos', title: '3Blue1Brown — Neural Networks series', author: '3Blue1Brown', status: 'done', notes: 'Best visual intuition for backprop I have found.' },
      { topicId: ai.id, category: 'AI Conversations', title: 'Explaining KV-cache like I\'m tired', author: '', status: 'done', notes: 'Finally clicked after asking for a bad-day-friendly explanation.' },
      { topicId: phil.id, category: 'Books', title: 'Meditations', author: 'Marcus Aurelius', status: 'done', notes: 'Book 2 is the one I keep coming back to.' },
      { topicId: phil.id, category: 'Podcasts', title: 'Practical Stoicism, ep. 12', author: '', status: 'to-review', notes: '' },
      { topicId: design.id, category: 'Bookmarks', title: 'Refactoring UI notes', author: '', status: 'to-review', notes: '' }
    ].forEach(function (r, i) { Research.add(Object.assign({ order: i }, r)); });

    // Notes (atomic)
    [
      { topicId: ai.id, title: 'Attention = weighted lookup', body: 'Query/Key/Value is just a differentiable, soft dictionary lookup — the softmax over Q·K is how "soft" it is.', type: 'atomic' },
      { topicId: ai.id, title: 'Overfitting', body: 'A model that has memorized the training set\'s noise, not just its signal.', type: 'definition' },
      { topicId: phil.id, title: '"You have power over your mind — not outside events."', body: '— Marcus Aurelius, Meditations, Book 2', type: 'quote' }
    ].forEach(function (n, i) { Notes.add(Object.assign({ order: i }, n)); });

    // Frameworks
    const fw1 = Frameworks.add({
      topicId: ai.id, title: 'How I Evaluate a New Model', icon: '🧪', color: '#E11D48', order: 0,
      description: 'A quick checklist before trusting a new model\'s output on anything that matters.',
      sections: [
        { id: uid('sec'), title: 'Sanity checks', body: '- Ask it something you already know the answer to.\n- Ask it to explain its own reasoning, not just the answer.', order: 0 },
        { id: uid('sec'), title: 'Failure modes to watch for', body: 'Confident wrongness on anything numeric or date-based.', order: 1 }
      ]
    });
    Frameworks.add({
      topicId: phil.id, title: 'The Dichotomy of Control', icon: '⚖️', color: '#F472B6', order: 1,
      description: 'Before reacting: is this actually in my control?',
      sections: [
        { id: uid('sec'), title: 'In my control', body: 'My judgments, my effort, my response.', order: 0 },
        { id: uid('sec'), title: 'Not in my control', body: 'Outcomes, other people\'s opinions, the past.', order: 1 }
      ]
    });

    // Master notes (with a backlink between them, to demonstrate the feature)
    MasterNotes.add({
      topicId: ai.id, title: 'Transformers, End to End', order: 0,
      tags: ['ai', 'deep-learning'],
      body: '# Transformers, End to End\n\nA synthesis of everything gathered on how a transformer actually works, start to finish.\n\n## Attention\n\nSee [[How I Evaluate a New Model]] for how I sanity-check outputs once a model is trained — this section is about *how* it gets there.\n\nQuery/Key/Value attention is a soft, differentiable lookup. Multi-head just runs several of these lookups in parallel at different representation subspaces.\n\n## Training\n\n> The hard part was never the architecture, it was the data pipeline.\n\n- Pretraining: next-token prediction at massive scale\n- Fine-tuning: much smaller, much more curated\n- RLHF: shaping *how* it answers, not just *whether* it can\n\n## Open questions\n\n1. How much of "reasoning" is real search vs. memorized pattern completion?\n2. Where does the next real capability jump actually come from?'
    });
    MasterNotes.add({
      topicId: ai.id, title: 'How I Evaluate a New Model', order: 1,
      tags: ['ai', 'practice'],
      body: '# How I Evaluate a New Model\n\nThe write-up version of the [[Transformers, End to End]] framework card.\n\n## Checklist\n\n- Ask it something you already know the answer to.\n- Ask it to show its reasoning.\n- Push on a follow-up that contradicts its first answer — does it notice?'
    });
    MasterNotes.add({
      topicId: phil.id, title: 'A Practice, Not a Theory', order: 0,
      tags: ['stoicism'],
      body: '# A Practice, Not a Theory\n\nStoicism only ever mattered to me once I stopped reading it as philosophy and started using it as a daily practice.\n\n## The one habit that stuck\n\nEvery morning: what is actually in my control today?'
    });

    // Projects
    Projects.add({ topicId: ai.id, title: 'Build a tiny transformer from scratch', description: 'No frameworks — just numpy, to actually feel every matrix multiply.', status: 'in-progress', order: 0 });
    Projects.add({ topicId: phil.id, title: 'Write a Stoic morning-page template', description: 'A repeatable 5-minute journal prompt based on the dichotomy of control.', status: 'done', order: 0 });

    // Questions (running question bank)
    Questions.add({ topicId: ai.id, text: 'Why does layer norm placement (pre vs post) matter so much for training stability?', status: 'open', order: 0 });
    Questions.add({ topicId: ai.id, text: 'What actually is a "KV cache" doing during inference?', status: 'answered', answer: 'Caching the Key/Value projections for every already-generated token so they are not recomputed on every new token.', order: 1 });
    Questions.add({ topicId: phil.id, text: 'Is Stoic acceptance different from learned helplessness?', status: 'open', order: 0 });

    // Knowledge map (a small starter graph for AI)
    Maps.add({
      topicId: ai.id, title: 'Transformer Concept Map', order: 0,
      nodes: [
        { id: uid('n'), x: 90, y: 90, label: 'Attention', color: '#E11D48' },
        { id: uid('n'), x: 340, y: 60, label: 'Query / Key / Value', color: '#F472B6' },
        { id: uid('n'), x: 340, y: 220, label: 'Multi-Head', color: '#F472B6' },
        { id: uid('n'), x: 600, y: 90, label: 'Transformer Block', color: '#60A5FA' },
        { id: uid('n'), x: 600, y: 260, label: 'Pretraining', color: '#34D399' },
        { id: uid('n'), x: 850, y: 170, label: 'RLHF', color: '#A78BFA' }
      ]
    });
    // Wire edges referencing the just-created node ids.
    (function () {
      const m = Maps.list()[0];
      const n = m.nodes;
      const edges = [
        { from: n[0].id, to: n[1].id, label: 'is computed via' },
        { from: n[0].id, to: n[2].id, label: 'runs in parallel as' },
        { from: n[1].id, to: n[3].id, label: 'feeds into' },
        { from: n[2].id, to: n[3].id, label: 'feeds into' },
        { from: n[3].id, to: n[4].id, label: 'trained via' },
        { from: n[4].id, to: n[5].id, label: 'then shaped by' }
      ].map(function (e) { return Object.assign({ id: uid('e') }, e); });
      Maps.update(m.id, { edges: edges });
    })();

    // Daily logs — a few days of real-looking history for AI, for streak/analytics.
    [0, 1, 2, 4].forEach(function (daysAgo, i) {
      DailyLogs.add({
        topicId: ai.id, date: isoDaysAgo(daysAgo), minutes: 35 + i * 10,
        media: { books: i % 2 === 0, articles: true, papers: i === 0, videos: i === 1, podcasts: false, ai: true },
        criticalQuestions: { missing: i === 0 ? 'A real intuition for *why* softmax specifically, not just that it works.' : '', beneath: '', flaws: '', implications: '', origin: '' },
        outputs: { rawNotes: 'Session ' + (i + 1) + ' notes on attention mechanics.', mainIdea: '', patterns: '', contradictions: '', connections: '', questions: '', examples: '' }
      });
    });
    [0, 3].forEach(function (daysAgo, i) {
      DailyLogs.add({
        topicId: phil.id, date: isoDaysAgo(daysAgo), minutes: 20,
        media: { books: true, articles: false, papers: false, videos: false, podcasts: i === 1, ai: false },
        criticalQuestions: {}, outputs: { rawNotes: 'Reread Book 2 of Meditations.' }
      });
    });
    Sessions.add({ topicId: ai.id, date: isoDaysAgo(0), minutes: 25, mode: 'pomodoro' });
    Sessions.add({ topicId: ai.id, date: isoDaysAgo(1), minutes: 50, mode: 'timer' });
    Sessions.add({ topicId: phil.id, date: isoDaysAgo(0), minutes: 15, mode: 'timer' });

    saveSettings({});
    storeSet(KEYS.seeded, true);
  }

  function isEmptyEverywhere() {
    return !Topics.list().length && !DailyLogs.list().length && !Research.list().length &&
      !Maps.list().length && !Frameworks.list().length && !MasterNotes.list().length &&
      !Notes.list().length && !Projects.list().length && !Questions.list().length && !Sessions.list().length;
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (!isEmptyEverywhere()) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.LearningHubData = {
    KEYS: KEYS,
    WEEKS: WEEKS,
    CRITICAL_QUESTIONS: CRITICAL_QUESTIONS,
    MEDIA_CHECKLIST: MEDIA_CHECKLIST,
    OUTPUT_FIELDS: OUTPUT_FIELDS,
    TOPIC_COLORS: TOPIC_COLORS,
    TOPIC_STATUSES: TOPIC_STATUSES,
    RESEARCH_CATEGORIES: RESEARCH_CATEGORIES,
    RESEARCH_STATUSES: RESEARCH_STATUSES,
    NOTE_TYPES: NOTE_TYPES,
    PROJECT_STATUSES: PROJECT_STATUSES,
    QUESTION_STATUSES: QUESTION_STATUSES,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl,
    escapeHtml: escapeHtml, slugify: slugify, extractHeadings: extractHeadings,
    extractBacklinkTitles: extractBacklinkTitles, backlinksTo: backlinksTo, renderMarkdownLite: renderMarkdownLite,
    weekInfo: weekInfo,
    Topics: Object.assign({}, Topics, { remove: removeTopic }),
    DailyLogs: DailyLogs, Research: Research, Maps: Maps, Frameworks: Frameworks,
    MasterNotes: MasterNotes, Notes: Notes, Projects: Projects, Questions: Questions, Sessions: Sessions,
    getSettings: getSettings, saveSettings: saveSettings,
    topicsSorted: topicsSorted, activeTopics: activeTopics, nextOrder: nextOrder, reorderCollection: reorderCollection,
    sessionsForTopic: sessionsForTopic, dailyLogsForTopic: dailyLogsForTopic, dailyLogFor: dailyLogFor, upsertDailyLog: upsertDailyLog,
    researchForTopic: researchForTopic, mapsForTopic: mapsForTopic, frameworksForTopic: frameworksForTopic,
    masterNotesForTopic: masterNotesForTopic, notesForTopic: notesForTopic, projectsForTopic: projectsForTopic, questionsForTopic: questionsForTopic,
    hoursLoggedForTopic: hoursLoggedForTopic, totalHoursLogged: totalHoursLogged,
    currentTopic: currentTopic, markStudied: markStudied, recentlyStudiedTopics: recentlyStudiedTopics,
    currentStreak: currentStreak, weeklyActivityMinutes: weeklyActivityMinutes, monthlyCompletionTrend: monthlyCompletionTrend,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, isEmptyEverywhere: isEmptyEverywhere
  };
})(window);
