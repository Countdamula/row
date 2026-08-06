// learning-dashboard-data.js
//
// Data layer for learning-dashboard.html ("Learning Dashboard" — a personal
// university: Zettelkasten + Cornell Notes + Progressive Summarization +
// Mind Mapping + Project-Based Learning + Active Recall + Teaching-Based
// Learning + AI Tutoring). Same conventions as aitech-data.js/business-data.js
// (see CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under an `lhub:` prefix so
// learning-dashboard.html's initCloudSync({ syncedPrefixes: ['lhub:'] })
// call covers every collection with no per-key list.
//
// THE SEVEN CORE DATABASES (the point of this system — knowledge
// transformation, not information storage):
//   SourceNotes      — one book/article/video/paper/lecture, captured raw.
//   EvergreenNotes    — many Source Notes compiled into one owned concept.
//   Questions         — the running Question Bank (questions drive learning,
//                        not the reverse).
//   ConnectionNotes   — Zettelkasten-style "how are these two ideas related".
//   MOCs              — Map of Content: a template aggregator note for a
//                        big field, genuinely separate from the Maps
//                        node-link canvas below (two different tools for
//                        two different methods — Map of Content vs. Mind
//                        Mapping — kept deliberately distinct).
//   Projects          — project-based learning: learn → build → hit a
//                        problem → learn the missing piece → apply → repeat.
//   TutorSessions     — AI Tutor mode selection, generated prompt, quiz
//                        results, and a Mastery Score.
//
// Plus the pre-existing Topics (the umbrella every database hangs off of),
// DailyLogs/Sessions (time & media tracking — narrower role now: new rich
// capture goes into SourceNotes, not DailyLogs), Maps (node-link canvas),
// Frameworks, Notes (atomic), and a single Settings record.
//
// SUPERSEDED COLLECTIONS: Research → SourceNotes, MasterNotes → EvergreenNotes.
// The old `lhub:research`/`lhub:masterNotes` keys and collection objects are
// kept instantiated (never deleted) and migrated ONCE into the new shape by
// migrateLegacyLhubCollections() — orphaned-key precedent, not a rebuild.
//
// Deleting a Topic nulls out `topicId` on every dependent "shared library"
// record (SourceNotes/EvergreenNotes/ConnectionNotes(via relatedTopicIds)/
// MOCs/Research/Maps/Frameworks/MasterNotes/Notes/Projects/Questions/
// TutorSessions/Sessions) rather than cascading a delete — same
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
    seeded: 'lhub:seeded',
    // New databases (see header comment)
    sourceNotes: 'lhub:sourceNotes',
    evergreenNotes: 'lhub:evergreenNotes',
    connectionNotes: 'lhub:connectionNotes',
    mocs: 'lhub:mocs',
    tutorSessions: 'lhub:tutorSessions',
    // One-time migration flags — see the MIGRATIONS section.
    migratedLegacyLhub: 'lhub:migratedLegacyLhub',
    migratedFromLearningFolder: 'lhub:migratedFromLearningFolder',
    normalizedQuestionsProjects: 'lhub:normalizedQuestionsProjects'
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
  function isoFromMs(ms) {
    const d = new Date(typeof ms === 'number' ? ms : Date.now());
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
  // CORE LEARNING LOOP — the homepage's visual workflow. Not stored; a
  // fixed reference sequence, each stage citing which section(s) it
  // hands off to so the homepage can link straight through.
  // ============================================================
  const LEARNING_LOOP = [
    { key: 'research', label: 'Research', icon: '🔍', section: 'sourcenotes', desc: 'Gather books, articles, videos, papers, lectures.' },
    { key: 'question', label: 'Question Everything', icon: '❓', section: 'questions', desc: 'What is missing, beneath, assumed, contradicted?' },
    { key: 'capture', label: 'Capture Insights', icon: '✍️', section: 'sourcenotes', desc: 'One Source Note per source — raw, not yet understood.' },
    { key: 'organize', label: 'Organize Notes', icon: '🗂️', section: 'sourcenotes', desc: 'Group by theme, cross-reference, spot patterns.' },
    { key: 'incubate', label: 'Incubate / Reflect', icon: '🌙', section: 'home', desc: 'Let it sit. Understanding needs idle time.' },
    { key: 'express', label: 'Express & Teach', icon: '🎓', section: 'tutor', desc: 'Explain it to the Tutor, or to someone else.' },
    { key: 'rewrite', label: 'Rewrite in Your Own Words', icon: '📝', section: 'evergreennotes', desc: 'Compile Source Notes into one Evergreen Note.' },
    { key: 'apply', label: 'Apply Immediately', icon: '🛠️', section: 'projects', desc: 'Use it in a real Learning Project.' },
    { key: 'reflect', label: 'Reflect', icon: '🔎', section: 'evergreennotes', desc: 'Where does this idea fail? What are the limits?' },
    { key: 'connect', label: 'Connect Across Disciplines', icon: '🕸️', section: 'connections', desc: 'How does this relate to something unrelated?' },
    { key: 'repeat', label: 'Repeat at a Deeper Level', icon: '🔁', section: 'sourcenotes', desc: 'Back to Research — one level deeper this time.' }
  ];

  // ============================================================
  // FIXED REFERENCE DATA — the Monthly Workflow's four weeks. Vestigial:
  // kept for existing Topics/data that still reference it, but no longer
  // the primary organizing paradigm of this rebuild (superseded
  // conceptually by the Core Learning Loop + the seven databases above).
  // Not stored; every Topic just carries a `currentWeek` (1-4) pointer.
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
      tasks: ['Explain it to someone else', 'Build a cheat sheet', 'Synthesize the Evergreen Note'],
      outputs: ['Teaching Notes', 'Cheat Sheets', 'Evergreen Note', 'Reflection', 'Flashcards']
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
  const PROJECT_WORKFLOW_STAGES = ['Learn Basics', 'Start Building', 'Encounter Problem', 'Learn Missing Skill', 'Apply Immediately', 'Continue Building'];

  // Question Bank — spec's four-value status (legacy 'open'/'answered'
  // records are remapped by normalizeExistingRecords(), see MIGRATIONS).
  const QUESTION_STATUSES = ['Unanswered', 'Exploring', 'Answered', 'Integrated'];
  const LEGACY_QUESTION_STATUS_MAP = { open: 'Unanswered', answered: 'Answered' };

  // Source Notes
  const SOURCE_TYPES = ['Book', 'Article', 'Video', 'Podcast', 'Research Paper', 'Course', 'Conversation', 'Other'];
  const SOURCE_STATUSES = ['Capturing', 'Processing', 'Completed'];
  const LEGACY_RESEARCH_CATEGORY_TO_SOURCE_TYPE = {
    'Books': 'Book', 'Research Papers': 'Research Paper', 'Articles': 'Article',
    'Videos': 'Video', 'Podcasts': 'Podcast', 'AI Conversations': 'Conversation',
    'Courses': 'Course', 'PDFs': 'Other', 'Bookmarks': 'Other'
  };
  const LEGACY_RESEARCH_STATUS_TO_SOURCE_STATUS = { 'to-review': 'Capturing', 'in-progress': 'Processing', 'done': 'Completed' };

  // Evergreen Knowledge Notes
  const MASTERY_LEVELS = ['Beginner', 'Developing', 'Intermediate', 'Advanced', 'Expert'];

  // AI Tutor System — fixed reference data, not stored. Each mode's
  // buildPrompt(ctx) generates the exact prompt text shown (and made
  // editable) in the Tutor Dashboard's prompt generator, ctx = {topic,
  // currentLevel, goal}. Same "fixed reference array, not persisted"
  // pattern as WEEKS above.
  function fmtCtxLine(label, value) { return value ? ('\n\nMy ' + label + ': ' + value) : ''; }
  const TUTOR_MODES = [
    {
      key: 'beginner', label: 'Beginner Teacher', icon: '🌱',
      purpose: 'Explain concepts simply.',
      buildPrompt: function (ctx) {
        return 'You are my beginner-level tutor.\n\nTeach me:\n\n' + (ctx.topic || '[TOPIC]') +
          '\n\nAssume I know nothing.\n\nExplain using:\n\n- Simple language\n- Analogies\n- Examples\n- Questions' +
          '\n\nAfter explaining, test my understanding.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'intermediate', label: 'Intermediate Teacher', icon: '📘',
      purpose: 'Challenge understanding and expand knowledge.',
      buildPrompt: function (ctx) {
        return 'You are my intermediate-level tutor for ' + (ctx.topic || '[TOPIC]') +
          '.\n\nI already understand the basics. Challenge my understanding and expand my knowledge by:\n\n' +
          '- Introducing nuance and edge cases\n- Connecting this to related concepts\n- Pointing out common misconceptions at this level\n- Asking me to apply the idea to a new scenario' +
          '\n\nAfter explaining, quiz me on the deeper points.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'expert', label: 'Expert Teacher', icon: '🎓',
      purpose: 'Deep analysis, limitations, advanced connections.',
      buildPrompt: function (ctx) {
        return 'You are my expert-level tutor for ' + (ctx.topic || '[TOPIC]') +
          '.\n\nGive me a deep analysis: limitations of the mainstream view, edge cases, advanced connections to other fields, and where current understanding is still contested.' +
          '\n\nDon\'t simplify. Assume graduate-level fluency.\n\nAfter explaining, challenge me with a hard, open-ended question.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'socratic', label: 'Socratic Tutor', icon: '🏛️',
      purpose: 'Only ask questions that force deeper thinking.',
      buildPrompt: function (ctx) {
        return 'You are my Socratic tutor for ' + (ctx.topic || '[TOPIC]') +
          '.\n\nDo not explain anything directly. Only ask me questions that force me to think more deeply and arrive at the understanding myself.' +
          '\n\nStart with a simple question and build from my answers.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'debate', label: 'Debate Partner', icon: '⚔️',
      purpose: 'Challenge beliefs and assumptions.',
      buildPrompt: function (ctx) {
        return 'You are my debate partner on ' + (ctx.topic || '[TOPIC]') +
          '.\n\nTake the opposing position to whatever I currently believe and argue it seriously and rigorously. Challenge my assumptions, poke holes in my reasoning, and don\'t concede easily.' +
          '\n\nAfter the debate, tell me honestly which points I handled well and which I didn\'t.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'examiner', label: 'Examiner', icon: '📋',
      purpose: 'Test knowledge through quizzes.',
      buildPrompt: function (ctx) {
        return 'You are my examiner for ' + (ctx.topic || '[TOPIC]') +
          '.\n\nTest my knowledge with a mix of question types (recall, application, analysis). Ask one question at a time, evaluate my answer honestly, then move to the next.' +
          '\n\nAt the end, give me a Mastery Score across Understanding, Explanation Ability, Application Ability, and Confidence, plus my Knowledge Gaps and Next Learning Steps.' + fmtCtxLine('current level of understanding', ctx.currentLevel) + fmtCtxLine('goal', ctx.goal);
      }
    },
    {
      key: 'coach', label: 'Project Coach', icon: '🧭',
      purpose: 'Help apply knowledge.',
      buildPrompt: function (ctx) {
        return 'You are my project coach helping me apply ' + (ctx.topic || '[TOPIC]') + ' to a real project' + (ctx.goal ? (': ' + ctx.goal) : '.') +
          '\n\nHelp me:\n\n- Break the goal into concrete next steps\n- Identify the specific skill or knowledge gap blocking me right now\n- Suggest the smallest possible action to unblock it' +
          '\n\nAsk me clarifying questions if you need more context about the project.' + fmtCtxLine('current level of understanding', ctx.currentLevel);
      }
    }
  ];
  function tutorMode(key) { return TUTOR_MODES.find(function (m) { return m.key === key; }) || TUTOR_MODES[0]; }
  function buildTutorPrompt(modeKey, ctx) { return tutorMode(modeKey).buildPrompt(ctx || {}); }
  /** A genuinely useful non-AI fallback when no Anthropic key is set —
   * same "honest local computation, not a stub" precedent as
   * knowledge-hub-data.js's aiLocalFallback(). */
  function tutorLocalFallback(modeKey) {
    const mode = tutorMode(modeKey);
    return '📐 No AI key set (add one in Customization → AI Settings) — paste the prompt above into Claude/ChatGPT yourself, or self-run this ' + mode.label.toLowerCase() + ' session:\n\n' +
      '1. Write your answer before checking any source.\n2. Compare against your Source/Evergreen Notes — what did you get wrong?\n3. Rate yourself honestly on Understanding, Explanation Ability, Application Ability, Confidence (0-100 each).\n4. Write down the one biggest Knowledge Gap this session revealed.';
  }

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
      // — Project-based learning fields —
      goal: typeof data.goal === 'string' ? data.goal : '',
      currentSkillLevel: typeof data.currentSkillLevel === 'string' ? data.currentSkillLevel : '',
      skillsNeeded: Array.isArray(data.skillsNeeded) ? data.skillsNeeded : [],
      relatedKnowledgeIds: Array.isArray(data.relatedKnowledgeIds) ? data.relatedKnowledgeIds : [],
      problemsEncountered: Array.isArray(data.problemsEncountered) ? data.problemsEncountered : [],
      lessonsLearned: Array.isArray(data.lessonsLearned) ? data.lessonsLearned : [],
      workflowStage: PROJECT_WORKFLOW_STAGES.indexOf(data.workflowStage) !== -1 ? data.workflowStage : 'Learn Basics',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  function questionModel(data) {
    data = data || {};
    let status = data.status;
    if (LEGACY_QUESTION_STATUS_MAP[status]) status = LEGACY_QUESTION_STATUS_MAP[status];
    return {
      id: data.id || uid('q'),
      topicId: data.topicId || null,
      text: typeof data.text === 'string' ? data.text : '',
      category: typeof data.category === 'string' ? data.category : '',
      subTopic: typeof data.subTopic === 'string' ? data.subTopic : '',
      status: QUESTION_STATUSES.indexOf(status) !== -1 ? status : 'Unanswered',
      answer: typeof data.answer === 'string' ? data.answer : '',
      relatedSourceNoteIds: Array.isArray(data.relatedSourceNoteIds) ? data.relatedSourceNoteIds : [],
      relatedEvergreenIds: Array.isArray(data.relatedEvergreenIds) ? data.relatedEvergreenIds : [],
      relatedConnectionIds: Array.isArray(data.relatedConnectionIds) ? data.relatedConnectionIds : [],
      relatedProjectIds: Array.isArray(data.relatedProjectIds) ? data.relatedProjectIds : [],
      relatedTutorSessionIds: Array.isArray(data.relatedTutorSessionIds) ? data.relatedTutorSessionIds : [],
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

  /** One book chapter / article / video / podcast episode / paper / lecture
   * — captured while researching, before trying to fully understand it. */
  function sourceNoteModel(data) {
    data = data || {};
    const qr = data.questionsRaised || {};
    const pn = data.patternsNoticed || {};
    const ct = data.connectionsText || {};
    const cur = data.curiosityThreads || {};
    return {
      id: data.id || uid('src'),
      topicId: data.topicId || null,
      title: typeof data.title === 'string' ? data.title : '',
      sourceType: SOURCE_TYPES.indexOf(data.sourceType) !== -1 ? data.sourceType : 'Other',
      author: typeof data.author === 'string' ? data.author : '',
      dateAdded: typeof data.dateAdded === 'string' ? data.dateAdded : todayISO(),
      subTopic: typeof data.subTopic === 'string' ? data.subTopic : '',
      url: typeof data.url === 'string' ? data.url : '',
      status: SOURCE_STATUSES.indexOf(data.status) !== -1 ? data.status : 'Capturing',
      relatedEvergreenIds: Array.isArray(data.relatedEvergreenIds) ? data.relatedEvergreenIds : [],
      relatedQuestionIds: Array.isArray(data.relatedQuestionIds) ? data.relatedQuestionIds : [],
      relatedConnectionIds: Array.isArray(data.relatedConnectionIds) ? data.relatedConnectionIds : [],
      // Why I'm Exploring This
      whyExploring: typeof data.whyExploring === 'string' ? data.whyExploring : '',
      // Main Ideas — dynamically generated sections, one per idea.
      mainIdeas: Array.isArray(data.mainIdeas) ? data.mainIdeas : [],
      // Questions Raised, Asked & Answered
      questionsRaised: {
        missing: typeof qr.missing === 'string' ? qr.missing : '',
        beneath: typeof qr.beneath === 'string' ? qr.beneath : '',
        assumptions: typeof qr.assumptions === 'string' ? qr.assumptions : '',
        contradicts: typeof qr.contradicts === 'string' ? qr.contradicts : '',
        implications: typeof qr.implications === 'string' ? qr.implications : ''
      },
      // Patterns Noticed
      patternsNoticed: {
        repeated: typeof pn.repeated === 'string' ? pn.repeated : '',
        similar: typeof pn.similar === 'string' ? pn.similar : '',
        unexpected: typeof pn.unexpected === 'string' ? pn.unexpected : '',
        contradictions: typeof pn.contradictions === 'string' ? pn.contradictions : ''
      },
      // Connections
      connectionsText: {
        remindsMeOf: typeof ct.remindsMeOf === 'string' ? ct.remindsMeOf : '',
        linkedConcepts: typeof ct.linkedConcepts === 'string' ? ct.linkedConcepts : ''
      },
      // Curiosity Threads
      curiosityThreads: {
        investigate: typeof cur.investigate === 'string' ? cur.investigate : '',
        branching: typeof cur.branching === 'string' ? cur.branching : ''
      },
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }
  function sourceNoteMainIdeaModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mi'),
      title: typeof data.title === 'string' ? data.title : 'Main Idea',
      summary: typeof data.summary === 'string' ? data.summary : '',
      quotes: typeof data.quotes === 'string' ? data.quotes : '',
      info: typeof data.info === 'string' ? data.info : '',
      reaction: typeof data.reaction === 'string' ? data.reaction : '',
      order: typeof data.order === 'number' ? data.order : 0
    };
  }

  /** Where raw information becomes personal understanding — many Source
   * Notes compiled into one owned concept. The most important layer. */
  function evergreenNoteModel(data) {
    data = data || {};
    const ctr = data.contradictions || {};
    return {
      id: data.id || uid('ev'),
      title: typeof data.title === 'string' ? data.title : '',
      conceptName: typeof data.conceptName === 'string' ? data.conceptName : (typeof data.title === 'string' ? data.title : ''),
      topicId: data.topicId || null,
      subTopic: typeof data.subTopic === 'string' ? data.subTopic : '',
      relatedSourceNoteIds: Array.isArray(data.relatedSourceNoteIds) ? data.relatedSourceNoteIds : [],
      relatedQuestionIds: Array.isArray(data.relatedQuestionIds) ? data.relatedQuestionIds : [],
      relatedConnectionIds: Array.isArray(data.relatedConnectionIds) ? data.relatedConnectionIds : [],
      relatedProjectIds: Array.isArray(data.relatedProjectIds) ? data.relatedProjectIds : [],
      masteryLevel: MASTERY_LEVELS.indexOf(data.masteryLevel) !== -1 ? data.masteryLevel : 'Beginner',
      coreIdea: typeof data.coreIdea === 'string' ? data.coreIdea : '',
      myUnderstanding: typeof data.myUnderstanding === 'string' ? data.myUnderstanding : '',
      mentalModel: typeof data.mentalModel === 'string' ? data.mentalModel : '',
      principles: Array.isArray(data.principles) ? data.principles : [],
      examples: typeof data.examples === 'string' ? data.examples : '',
      contradictions: {
        whereFails: typeof ctr.whereFails === 'string' ? ctr.whereFails : '',
        limitations: typeof ctr.limitations === 'string' ? ctr.limitations : '',
        opposingViewpoints: typeof ctr.opposingViewpoints === 'string' ? ctr.opposingViewpoints : ''
      },
      questionsUnresolved: typeof data.questionsUnresolved === 'string' ? data.questionsUnresolved : '',
      applications: typeof data.applications === 'string' ? data.applications : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  /** Zettelkasten-style connection between two (or more) ideas — the
   * relationship itself is the note. */
  function connectionNoteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('conn'),
      title: typeof data.title === 'string' ? data.title : '',
      relatedEvergreenIds: Array.isArray(data.relatedEvergreenIds) ? data.relatedEvergreenIds : [],
      relatedSourceNoteIds: Array.isArray(data.relatedSourceNoteIds) ? data.relatedSourceNoteIds : [],
      relatedQuestionIds: Array.isArray(data.relatedQuestionIds) ? data.relatedQuestionIds : [],
      relatedProjectIds: Array.isArray(data.relatedProjectIds) ? data.relatedProjectIds : [],
      relatedTopicIds: Array.isArray(data.relatedTopicIds) ? data.relatedTopicIds : [],
      theRelationship: typeof data.theRelationship === 'string' ? data.theRelationship : '',
      similarPattern: typeof data.similarPattern === 'string' ? data.similarPattern : '',
      newInsight: typeof data.newInsight === 'string' ? data.newInsight : '',
      applications: typeof data.applications === 'string' ? data.applications : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  /** Map of Content — a template aggregator note for a big field.
   * Genuinely separate from the Maps node-link canvas (Mind Mapping vs.
   * Map of Content — two different methods, kept as two different tools). */
  function mocModel(data) {
    data = data || {};
    const f = data.foundations || {};
    return {
      id: data.id || uid('moc'),
      title: typeof data.title === 'string' ? data.title : '',
      topicId: data.topicId || null,
      foundations: {
        relatedFields: typeof f.relatedFields === 'string' ? f.relatedFields : '',
        relatedSubtopics: typeof f.relatedSubtopics === 'string' ? f.relatedSubtopics : '',
        linkedKnowledgeNoteIds: Array.isArray(f.linkedKnowledgeNoteIds) ? f.linkedKnowledgeNoteIds : []
      },
      coreConceptIds: Array.isArray(data.coreConceptIds) ? data.coreConceptIds : [],
      questionIds: Array.isArray(data.questionIds) ? data.questionIds : [],
      connectionIds: Array.isArray(data.connectionIds) ? data.connectionIds : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  /** One AI Tutor session: a mode, a generated prompt, an optional quiz
   * transcript, and a Mastery Score. */
  function tutorSessionModel(data) {
    data = data || {};
    const ms = data.masteryScore || {};
    return {
      id: data.id || uid('tut'),
      topicId: data.topicId || null,
      topic: typeof data.topic === 'string' ? data.topic : '',
      currentLevelOfUnderstanding: typeof data.currentLevelOfUnderstanding === 'string' ? data.currentLevelOfUnderstanding : '',
      goal: typeof data.goal === 'string' ? data.goal : '',
      tutorMode: TUTOR_MODES.some(function (m) { return m.key === data.tutorMode; }) ? data.tutorMode : 'beginner',
      generatedPrompt: typeof data.generatedPrompt === 'string' ? data.generatedPrompt : '',
      quiz: { questions: Array.isArray(data.quiz && data.quiz.questions) ? data.quiz.questions : [] },
      masteryScore: {
        understanding: typeof ms.understanding === 'number' ? ms.understanding : null,
        explanationAbility: typeof ms.explanationAbility === 'number' ? ms.explanationAbility : null,
        applicationAbility: typeof ms.applicationAbility === 'number' ? ms.applicationAbility : null,
        confidence: typeof ms.confidence === 'number' ? ms.confidence : null
      },
      knowledgeGaps: Array.isArray(data.knowledgeGaps) ? data.knowledgeGaps : [],
      nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
      relatedQuestionIds: Array.isArray(data.relatedQuestionIds) ? data.relatedQuestionIds : [],
      relatedSourceNoteIds: Array.isArray(data.relatedSourceNoteIds) ? data.relatedSourceNoteIds : [],
      relatedEvergreenIds: Array.isArray(data.relatedEvergreenIds) ? data.relatedEvergreenIds : [],
      relatedConnectionIds: Array.isArray(data.relatedConnectionIds) ? data.relatedConnectionIds : [],
      relatedProjectIds: Array.isArray(data.relatedProjectIds) ? data.relatedProjectIds : [],
      status: data.status === 'completed' ? 'completed' : 'active',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
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

  /** Shared Anthropic key/persona — reads `customization:settings`
   * directly (raw localStorage key owned by customization.html/
   * customization-data.js), the same shared-key pattern
   * design-library-data.js's getAiPrefs() already established, rather
   * than storing a third duplicate API key on this page (a deliberate
   * choice against knowledge-hub-data.js's own-key counter-precedent —
   * asking Damian to paste the same key into a third page is worse UX). */
  function getAiPrefs() {
    const raw = storeGet('customization:settings') || {};
    return {
      apiKey: typeof raw.aiKey === 'string' ? raw.aiKey : '',
      persona: typeof raw.aiPersona === 'string' ? raw.aiPersona : ''
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // aitech-data.js/business-data.js/household-data.js.
  //
  // NOTE: list()/get() do NOT run stored records through model() (only
  // add()/update() do) — an older stored record missing a newer field
  // will not have it until it's next saved. Every UI read site for a
  // field added after a record's creation must default defensively
  // (`x.newField || []`), same as this file already had to for e.g.
  // Question.category. normalizeExistingRecords() (see MIGRATIONS) forces
  // every Question/Project through model() once to backfill this.
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
  const Research = makeCollection(KEYS.research, researchModel); // superseded by SourceNotes — kept for orphaned legacy data only
  const Maps = makeCollection(KEYS.maps, mapModel);
  const Frameworks = makeCollection(KEYS.frameworks, frameworkModel);
  const MasterNotes = makeCollection(KEYS.masterNotes, masterNoteModel); // superseded by EvergreenNotes — kept for orphaned legacy data only
  const Notes = makeCollection(KEYS.notes, noteModel);
  const Projects = makeCollection(KEYS.projects, projectModel);
  const Questions = makeCollection(KEYS.questions, questionModel);
  const Sessions = makeCollection(KEYS.sessions, sessionModel);
  const SourceNotes = makeCollection(KEYS.sourceNotes, sourceNoteModel);
  const EvergreenNotes = makeCollection(KEYS.evergreenNotes, evergreenNoteModel);
  const ConnectionNotes = makeCollection(KEYS.connectionNotes, connectionNoteModel);
  const MOCs = makeCollection(KEYS.mocs, mocModel);
  const TutorSessions = makeCollection(KEYS.tutorSessions, tutorSessionModel);

  /** Deleting a topic nulls out topicId on every dependent record instead
   * of cascading a delete — same null-out-the-reference precedent as
   * aitech-data.js's removeModel(). ConnectionNotes has no single topicId
   * (it references relatedTopicIds[], since a connection can span
   * topics) — pull this topic's id out of that array instead of nulling
   * a field, same "strip the deleted id" treatment learning-data.js's
   * removeTopic() already gives Resource.subjectIds. */
  function removeTopic(id) {
    Topics.remove(id);
    [Research, Maps, Frameworks, MasterNotes, Notes, Projects, Questions, Sessions,
      SourceNotes, EvergreenNotes, MOCs, TutorSessions].forEach(function (col) {
      col.replaceAll(col.list().map(function (r) { return r.topicId === id ? Object.assign({}, r, { topicId: null }) : r; }));
    });
    ConnectionNotes.replaceAll(ConnectionNotes.list().map(function (c) {
      if (!Array.isArray(c.relatedTopicIds) || c.relatedTopicIds.indexOf(id) === -1) return c;
      return Object.assign({}, c, { relatedTopicIds: c.relatedTopicIds.filter(function (t) { return t !== id; }) });
    }));
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
  function sourceNotesForTopic(topicId) { return SourceNotes.list().filter(function (s) { return s.topicId === topicId; }).sort(byOrder); }
  function evergreenNotesForTopic(topicId) { return EvergreenNotes.list().filter(function (e) { return e.topicId === topicId; }).sort(byOrder); }
  function connectionNotesForTopic(topicId) { return ConnectionNotes.list().filter(function (c) { return Array.isArray(c.relatedTopicIds) && c.relatedTopicIds.indexOf(topicId) !== -1; }).sort(byOrder); }
  function mocsForTopic(topicId) { return MOCs.list().filter(function (m) { return m.topicId === topicId; }).sort(byOrder); }
  function tutorSessionsForTopic(topicId) { return TutorSessions.list().filter(function (t) { return t.topicId === topicId; }); }

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
  // LEARNING PROGRESS — homepage stat selectors, all derived-not-stored
  // (same convention as hoursLoggedForTopic/currentStreak above).
  // ============================================================
  function topicsStudiedCount() {
    return topicsSorted().filter(function (t) {
      return sourceNotesForTopic(t.id).length > 0 || evergreenNotesForTopic(t.id).length > 0 || hoursLoggedForTopic(t.id) > 0;
    }).length;
  }
  function conceptsMasteredCount() {
    return EvergreenNotes.list().filter(function (e) { return e.masteryLevel === 'Advanced' || e.masteryLevel === 'Expert'; }).length;
  }
  function questionsAnsweredCount() {
    return Questions.list().filter(function (q) { return q.status === 'Answered' || q.status === 'Integrated'; }).length;
  }
  function connectionsCreatedCount() { return ConnectionNotes.list().length; }
  function tutorSessionsCompletedCount() { return TutorSessions.list().filter(function (t) { return t.status === 'completed'; }).length; }
  function projectsAppliedCount() { return Projects.list().filter(function (p) { return p.status === 'done'; }).length; }
  function evergreenMasteryDistribution() {
    const dist = {}; MASTERY_LEVELS.forEach(function (m) { dist[m] = 0; });
    EvergreenNotes.list().forEach(function (e) { dist[e.masteryLevel] = (dist[e.masteryLevel] || 0) + 1; });
    return dist;
  }
  function sourceNotesByStatus() {
    const dist = {}; SOURCE_STATUSES.forEach(function (s) { dist[s] = 0; });
    SourceNotes.list().forEach(function (s) { dist[s.status] = (dist[s.status] || 0) + 1; });
    return dist;
  }

  // ============================================================
  // GLOBAL SEARCH — spans every collection, old and new. Returns
  // {collection, id, title, snippet, topicId}[], newest-relevance-agnostic
  // (plain substring match — same "keyword substring, not a real search
  // index" simplification precedent as this page's existing Ctrl+K
  // command palette already used pre-rebuild).
  // ============================================================
  function snippet(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > (max || 140) ? s.slice(0, max || 140) + '…' : s;
  }
  function globalSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    function scan(collectionName, items, getTitle, getSnippet, getTopicId) {
      items.forEach(function (item) {
        const title = getTitle(item) || '';
        const body = getSnippet(item) || '';
        if (title.toLowerCase().indexOf(q) !== -1 || body.toLowerCase().indexOf(q) !== -1) {
          out.push({ collection: collectionName, id: item.id, title: title || '(untitled)', snippet: snippet(body || title), topicId: getTopicId(item) });
        }
      });
    }
    scan('sourceNotes', SourceNotes.list(), function (i) { return i.title; }, function (i) { return i.whyExploring + ' ' + (i.mainIdeas || []).map(function (m) { return m.summary; }).join(' '); }, function (i) { return i.topicId; });
    scan('evergreenNotes', EvergreenNotes.list(), function (i) { return i.title; }, function (i) { return i.coreIdea + ' ' + i.myUnderstanding + ' ' + i.mentalModel + ' ' + i.applications; }, function (i) { return i.topicId; });
    scan('questions', Questions.list(), function (i) { return i.text; }, function (i) { return i.answer; }, function (i) { return i.topicId; });
    scan('connectionNotes', ConnectionNotes.list(), function (i) { return i.title; }, function (i) { return i.theRelationship + ' ' + i.newInsight; }, function (i) { return (i.relatedTopicIds || [])[0] || null; });
    scan('mocs', MOCs.list(), function (i) { return i.title; }, function (i) { return i.foundations.relatedFields + ' ' + i.foundations.relatedSubtopics; }, function (i) { return i.topicId; });
    scan('projects', Projects.list(), function (i) { return i.title; }, function (i) { return i.description + ' ' + i.goal; }, function (i) { return i.topicId; });
    scan('tutorSessions', TutorSessions.list(), function (i) { return i.topic || tutorMode(i.tutorMode).label; }, function (i) { return i.goal; }, function (i) { return i.topicId; });
    scan('topics', Topics.list(), function (i) { return i.title; }, function (i) { return i.description + ' ' + i.currentQuestion; }, function (i) { return i.id; });
    return out.slice(0, 60);
  }

  // ============================================================
  // MARKDOWN-LITE — same lightweight renderer convention this app's other
  // note-reading surfaces already use (e.g. selfcare.html's journal
  // render), extended with a [[Backlink]] token, now scanned across an
  // Evergreen Note's structured fields rather than one flat `body`.
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
  /** The four free-text fields on an Evergreen Note that can carry
   * [[Title]] backlink tokens — Core Idea / My Understanding / Mental
   * Model / Applications. Concatenated so backlinksTo() and the
   * Connections mini-gallery scan the whole note, not just one field. */
  function evergreenScanText(note) {
    return [note.coreIdea, note.myUnderstanding, note.mentalModel, note.applications].join('\n');
  }
  function backlinksTo(noteId) {
    const target = EvergreenNotes.get(noteId);
    if (!target) return [];
    const titleLower = target.title.toLowerCase();
    return EvergreenNotes.list().filter(function (n) {
      if (n.id === noteId) return false;
      return extractBacklinkTitles(evergreenScanText(n)).some(function (t) { return t.toLowerCase() === titleLower; });
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
  // MIGRATIONS — one-time, idempotent-by-id, flag-gated. Deliberately NOT
  // gated on target-collection emptiness (deviates from the
  // tasksnotes-data.js migrateFromBusinessHub() reference precedent,
  // which could rely on emptiness because its target was fresh) — this
  // page already holds substantial real Research/MasterNotes/Topic data,
  // so emptiness would never be true. Instead: preserve each old record's
  // own id on the new record, so a retry after a partial failure can skip
  // any id already present in the target collection, and only set the
  // completion flag after a full successful pass.
  // ============================================================

  /** Research → SourceNotes, MasterNotes → EvergreenNotes. Both were
   * superseded by this rebuild's richer templates; the old collections/
   * keys are left instantiated and orphaned, never deleted. */
  function migrateLegacyLhubCollections() {
    if (storeGet(KEYS.migratedLegacyLhub)) return;
    try {
      const existingSourceIds = {}; SourceNotes.list().forEach(function (s) { existingSourceIds[s.id] = true; });
      Research.list().forEach(function (r) {
        if (existingSourceIds[r.id]) return;
        SourceNotes.add({
          id: r.id, topicId: r.topicId, title: r.title,
          sourceType: LEGACY_RESEARCH_CATEGORY_TO_SOURCE_TYPE[r.category] || 'Other',
          author: r.author, dateAdded: isoFromMs(r.createdAt), url: r.url,
          status: LEGACY_RESEARCH_STATUS_TO_SOURCE_STATUS[r.status] || 'Capturing',
          whyExploring: '',
          mainIdeas: r.notes ? [sourceNoteMainIdeaModel({ title: 'Notes (migrated)', summary: r.notes, order: 0 })] : [],
          order: r.order, createdAt: r.createdAt
        });
      });

      const existingEvergreenIds = {}; EvergreenNotes.list().forEach(function (e) { existingEvergreenIds[e.id] = true; });
      MasterNotes.list().forEach(function (m) {
        if (existingEvergreenIds[m.id]) return;
        EvergreenNotes.add({
          id: m.id, title: m.title, conceptName: m.title, topicId: m.topicId,
          myUnderstanding: m.body, tags: m.tags, masteryLevel: 'Intermediate',
          order: m.order, createdAt: m.createdAt, updatedAt: m.updatedAt
        });
      });

      storeSet(KEYS.migratedLegacyLhub, true);
    } catch (e) { /* leave the flag unset — safe to retry, ids prevent duplicates */ }
  }

  /** learning:topics/resources/topicQuestions/topicNotes/topicSubjects
   * (learning.html/learning-topic.html's own storage, read raw — that
   * page's -data.js needs no changes) → this page's Topics/SourceNotes/
   * Questions/EvergreenNotes. learning.html/learning-topic.html and their
   * `learning:` keys are left on disk, untouched, forever (orphaned-key
   * precedent). The Topic merge-by-title step is inherently
   * non-idempotent if a title changes between runs — fine, since this
   * runs once. */
  function migrateFromLearningFolder() {
    if (storeGet(KEYS.migratedFromLearningFolder)) return;
    try {
      const oldTopics = storeGet('learning:topics') || [];
      const oldResources = storeGet('learning:resources') || [];
      const oldTopicQuestions = storeGet('learning:topicQuestions') || [];
      const oldTopicNotes = storeGet('learning:topicNotes') || [];
      const oldTopicSubjects = storeGet('learning:topicSubjects') || [];
      if (!oldTopics.length && !oldResources.length && !oldTopicQuestions.length && !oldTopicNotes.length) {
        storeSet(KEYS.migratedFromLearningFolder, true);
        return;
      }

      const currentTopics = Topics.list();
      const topicIdMap = {}; // old learning:topics id -> lhub Topics id
      oldTopics.forEach(function (t) {
        const match = currentTopics.find(function (x) { return x.title.trim().toLowerCase() === (t.title || '').trim().toLowerCase(); });
        if (match) { topicIdMap[t.id] = match.id; return; }
        const created = Topics.add({ title: t.title, description: t.description || '', icon: t.icon || '📚', order: nextOrder(Topics.list()) });
        topicIdMap[t.id] = created.id;
        currentTopics.push(created);
      });

      const subjectNameById = {}; oldTopicSubjects.forEach(function (s) { subjectNameById[s.id] = s.name; });
      const subTopicForOldTopic = {}; // old topicId -> first subject name, used as a subTopic tag
      oldTopicSubjects.forEach(function (s) { if (!subTopicForOldTopic[s.topicId]) subTopicForOldTopic[s.topicId] = s.name; });

      const RESOURCE_TYPE_TO_SOURCE_TYPE = { article: 'Article', book: 'Book', video: 'Video', social: 'Other', note: 'Other' };
      const existingSourceIds = {}; SourceNotes.list().forEach(function (s) { existingSourceIds[s.id] = true; });
      oldResources.forEach(function (r) {
        if (existingSourceIds[r.id]) return;
        const mainIdeas = (Array.isArray(r.sections) ? r.sections : []).map(function (sec, i) {
          return sourceNoteMainIdeaModel({ title: sec.title || ('Section ' + (i + 1)), summary: sec.body || sec.bodyLeft || '', order: i });
        });
        SourceNotes.add({
          id: r.id, topicId: topicIdMap[r.topicId] || null, title: r.title || r.subtitle || 'Untitled',
          sourceType: RESOURCE_TYPE_TO_SOURCE_TYPE[r.type] || 'Other', author: r.author || '',
          dateAdded: isoFromMs(r.createdAt), subTopic: subTopicForOldTopic[r.topicId] || '', url: r.url || '',
          status: 'Completed', whyExploring: r.notes || '', mainIdeas: mainIdeas,
          order: r.order, createdAt: r.createdAt
        });
      });

      const existingQuestionIds = {}; Questions.list().forEach(function (q) { existingQuestionIds[q.id] = true; });
      oldTopicQuestions.forEach(function (q) {
        if (existingQuestionIds[q.id]) return;
        Questions.add({
          id: q.id, topicId: topicIdMap[q.topicId] || null, text: q.question || '',
          answer: q.answer || '', status: q.answer ? 'Answered' : 'Unanswered',
          subTopic: subTopicForOldTopic[q.topicId] || '', order: q.order, createdAt: q.createdAt
        });
      });

      const existingEvergreenIds = {}; EvergreenNotes.list().forEach(function (e) { existingEvergreenIds[e.id] = true; });
      oldTopicNotes.forEach(function (n) {
        if (existingEvergreenIds[n.id]) return;
        EvergreenNotes.add({
          id: n.id, title: n.title || 'Untitled', conceptName: n.title || 'Untitled',
          topicId: topicIdMap[n.topicId] || null, subTopic: subTopicForOldTopic[n.topicId] || '',
          myUnderstanding: n.body || '', masteryLevel: 'Beginner',
          order: n.order, createdAt: n.createdAt
        });
      });

      storeSet(KEYS.migratedFromLearningFolder, true);
    } catch (e) { /* leave the flag unset — safe to retry, ids prevent duplicates */ }
  }

  /** Forces every existing Question/Project through model() once so
   * older stored records (from before this rebuild) get every new field
   * backfilled and written to storage — closes the list()/get()-bypasses-
   * model() gap for these two collections specifically. */
  function normalizeExistingRecords() {
    if (storeGet(KEYS.normalizedQuestionsProjects)) return;
    Questions.list().forEach(function (q) { Questions.update(q.id, {}); });
    Projects.list().forEach(function (p) { Projects.update(p.id, {}); });
    storeSet(KEYS.normalizedQuestionsProjects, true);
  }

  /** Runs all three migrations in a safe order. The calling page should
   * invoke this on the same delayed timer it already uses for
   * seedIfEmpty() (i.e. after the initial cloud-sync pull has had a real
   * chance to answer) — not at script-load time — same seed-race
   * reasoning as this file's original seedIfEmpty() comment. */
  function runOneTimeMigrations() {
    migrateLegacyLhubCollections();
    migrateFromLearningFolder();
    normalizeExistingRecords();
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
    SourceNotes.replaceAll([]); EvergreenNotes.replaceAll([]); ConnectionNotes.replaceAll([]);
    MOCs.replaceAll([]); TutorSessions.replaceAll([]);

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

    // Source Notes — one per real source, captured raw.
    const srcAttention = SourceNotes.add({
      topicId: ai.id, order: 0, sourceType: 'Research Paper', title: 'Attention Is All You Need',
      author: 'Vaswani et al.', status: 'Completed', subTopic: 'Transformers',
      whyExploring: 'Wanted the primary source instead of secondhand explanations of attention.',
      mainIdeas: [
        sourceNoteMainIdeaModel({ order: 0, title: 'Scaled dot-product attention', summary: 'Attention is a soft, differentiable lookup: softmax(QK^T/√d)V.', quotes: '"An attention function can be described as mapping a query and a set of key-value pairs to an output."', info: 'Multi-head just runs several of these lookups in parallel at different representation subspaces.', reaction: 'Clicked once I stopped thinking of it as "magic" and started thinking of it as a weighted dictionary lookup.' })
      ],
      questionsRaised: { missing: 'A real intuition for why softmax specifically, not just that it works.', implications: 'If attention is just weighted lookup, how much of "reasoning" is really search over memorized patterns?' },
      patternsNoticed: { repeated: 'Every explanation eventually reduces to Query/Key/Value.' },
      connectionsText: { remindsMeOf: 'Hash maps — a soft, differentiable version of key lookup.' },
      curiosityThreads: { investigate: 'KV-caching during inference — how does storing K/V per token actually speed generation up?' }
    });
    const srcDl = SourceNotes.add({
      topicId: ai.id, order: 1, sourceType: 'Book', title: 'Deep Learning', author: 'Goodfellow, Bengio, Courville',
      status: 'Processing', subTopic: 'Optimization',
      mainIdeas: [sourceNoteMainIdeaModel({ order: 0, title: 'Optimization landscape', summary: 'Chapters 6-8 on why SGD with momentum works better than plain gradient descent in practice.' })]
    });
    SourceNotes.add({ topicId: phil.id, order: 0, sourceType: 'Book', title: 'Meditations', author: 'Marcus Aurelius', status: 'Completed', subTopic: 'Practice', whyExploring: 'Wanted the primary text, not a summary of Stoicism.', mainIdeas: [sourceNoteMainIdeaModel({ order: 0, title: 'Book 2', summary: 'The one I keep coming back to — control only what is yours to control.', quotes: '"You have power over your mind — not outside events."' })] });
    SourceNotes.add({ topicId: phil.id, order: 1, sourceType: 'Podcast', title: 'Practical Stoicism, ep. 12', status: 'Capturing' });
    SourceNotes.add({ topicId: design.id, order: 0, sourceType: 'Other', title: 'Refactoring UI notes', status: 'Capturing' });

    // Notes (atomic)
    [
      { topicId: ai.id, title: 'Attention = weighted lookup', body: 'Query/Key/Value is just a differentiable, soft dictionary lookup — the softmax over Q·K is how "soft" it is.', type: 'atomic' },
      { topicId: ai.id, title: 'Overfitting', body: 'A model that has memorized the training set\'s noise, not just its signal.', type: 'definition' },
      { topicId: phil.id, title: '"You have power over your mind — not outside events."', body: '— Marcus Aurelius, Meditations, Book 2', type: 'quote' }
    ].forEach(function (n, i) { Notes.add(Object.assign({ order: i }, n)); });

    // Frameworks
    Frameworks.add({
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

    // Evergreen Knowledge Notes — many Source Notes compiled into one
    // owned concept (with a [[Backlink]] between two, to demonstrate it).
    const evTransformers = EvergreenNotes.add({
      topicId: ai.id, order: 0, title: 'Transformers, End to End', conceptName: 'Transformers', masteryLevel: 'Advanced',
      tags: ['ai', 'deep-learning'], relatedSourceNoteIds: [srcAttention.id, srcDl.id],
      coreIdea: 'A transformer builds a representation of a sequence entirely out of attention — a soft, differentiable lookup — instead of recurrence.',
      myUnderstanding: 'Query/Key/Value attention is a soft, differentiable lookup. Multi-head just runs several of these lookups in parallel at different representation subspaces. See [[How I Evaluate a New Model]] for how I sanity-check outputs once a model trained this way is actually deployed — that note is about *using* the result, this one is about how it gets there.',
      mentalModel: 'Pretraining teaches next-token prediction at massive scale. Fine-tuning is much smaller and more curated. RLHF shapes *how* it answers, not just *whether* it can.',
      principles: ['Attention is a weighted lookup, not "focus" in any literal sense.', 'Scale (data + compute) has so far mattered more than architecture novelty.', 'Alignment (RLHF) is a separate axis from raw capability.'],
      examples: 'GPT-family, Claude, and most modern LLMs are all decoder-only transformer stacks trained this way.',
      contradictions: { whereFails: 'Struggles with tasks needing true multi-step symbolic search rather than pattern completion.', opposingViewpoints: 'Some argue in-context "reasoning" is closer to real search than pure memorization — genuinely contested.' },
      questionsUnresolved: 'How much of "reasoning" is real search vs. memorized pattern completion? Where does the next real capability jump come from?',
      applications: 'Use this mental model whenever evaluating a new model release — ask "what pattern is it completing here?" before trusting an answer.'
    });
    EvergreenNotes.add({
      topicId: ai.id, order: 1, title: 'How I Evaluate a New Model', conceptName: 'Model evaluation practice', masteryLevel: 'Intermediate',
      tags: ['ai', 'practice'], relatedEvergreenIds: [evTransformers.id],
      coreIdea: 'Never trust a new model\'s output on anything that matters without a quick sanity pass first.',
      myUnderstanding: 'The write-up version of the [[Transformers, End to End]] framework card — ask it something you already know, ask it to show its reasoning, then push a follow-up that contradicts its first answer and see if it notices.',
      applications: 'Run this checklist before shipping any AI-generated content or code.'
    });
    EvergreenNotes.add({
      topicId: phil.id, order: 0, title: 'A Practice, Not a Theory', conceptName: 'Stoicism as daily practice', masteryLevel: 'Advanced',
      tags: ['stoicism'],
      coreIdea: 'Stoicism only ever mattered once I stopped reading it as philosophy and started using it as a daily practice.',
      myUnderstanding: 'Every morning: what is actually in my control today? That single question is the whole practice — everything else in the texts is commentary on it.',
      contradictions: { whereFails: 'Can tip into passivity if "acceptance" is used to avoid action that was actually within my control.' },
      questionsUnresolved: 'Where is the real line between acceptance and passivity?'
    });

    // Connection Notes
    ConnectionNotes.add({
      title: 'Attention as a soft key-value lookup', order: 0,
      relatedEvergreenIds: [evTransformers.id], relatedTopicIds: [ai.id],
      theRelationship: 'Transformer attention and a plain hash map both resolve a query to a value via a key — attention just makes the match "soft" (a weighted blend) instead of exact.',
      similarPattern: 'Any time a system needs to retrieve "the most relevant thing" from many candidates without hard-coding which one, a soft/weighted lookup shows up — search ranking, recommendation systems, and attention are all the same underlying move.',
      newInsight: 'This reframes "attention" from a mysterious cognitive metaphor into an ordinary data-structure operation, which made it much easier to actually reason about.',
      applications: 'Use the "soft lookup" framing when explaining attention to someone who already understands hash maps.'
    });

    // MOC — a Map of Content aggregating the AI topic's knowledge.
    MOCs.add({
      title: 'Artificial Intelligence', topicId: ai.id, order: 0,
      foundations: { relatedFields: 'Linear algebra, probability, optimization', relatedSubtopics: 'Transformers, training/RLHF, evaluation practice', linkedKnowledgeNoteIds: [evTransformers.id] },
      coreConceptIds: [evTransformers.id]
    });

    // Projects
    Projects.add({
      topicId: ai.id, title: 'Build a tiny transformer from scratch', description: 'No frameworks — just numpy, to actually feel every matrix multiply.',
      status: 'in-progress', order: 0, goal: 'Understand attention well enough to explain it without notes.',
      currentSkillLevel: 'Comfortable with numpy, shaky on backprop internals.',
      skillsNeeded: ['Manual backpropagation', 'Softmax gradient derivation'],
      relatedKnowledgeIds: [evTransformers.id], workflowStage: 'Encounter Problem',
      problemsEncountered: [{ id: uid('prob'), problem: 'Gradient of softmax kept coming out wrong.', dateEncountered: isoDaysAgo(2), resolved: false }],
      lessonsLearned: ['Writing the forward pass first, then deriving gradients by hand, sticks far better than reading a derivation.']
    });
    Projects.add({ topicId: phil.id, title: 'Write a Stoic morning-page template', description: 'A repeatable 5-minute journal prompt based on the dichotomy of control.', status: 'done', order: 0, workflowStage: 'Continue Building', lessonsLearned: ['The prompt only stuck once it was one single question, not five.'] });

    // Questions (running Question Bank)
    Questions.add({ topicId: ai.id, text: 'Why does layer norm placement (pre vs post) matter so much for training stability?', status: 'Unanswered', order: 0, relatedEvergreenIds: [evTransformers.id] });
    Questions.add({ topicId: ai.id, text: 'What actually is a "KV cache" doing during inference?', status: 'Answered', answer: 'Caching the Key/Value projections for every already-generated token so they are not recomputed on every new token.', order: 1, relatedSourceNoteIds: [srcAttention.id] });
    Questions.add({ topicId: phil.id, text: 'Is Stoic acceptance different from learned helplessness?', status: 'Exploring', order: 0 });

    // Tutor session — a completed example demonstrating the Mastery Score.
    TutorSessions.add({
      topicId: ai.id, topic: 'Transformer attention', tutorMode: 'examiner', status: 'completed',
      currentLevelOfUnderstanding: 'Intermediate — read the paper, built intuition, not yet fluent explaining it cold.',
      goal: 'Be able to explain attention to a non-technical friend without notes.',
      generatedPrompt: buildTutorPrompt('examiner', { topic: 'Transformer attention', currentLevel: 'Intermediate', goal: 'Explain it without notes' }),
      masteryScore: { understanding: 78, explanationAbility: 62, applicationAbility: 70, confidence: 65 },
      knowledgeGaps: ['Struggled to explain multi-head attention without falling back to the matrix formula.'],
      nextSteps: ['Practice a plain-language explanation out loud, no notes, timed to 60 seconds.'],
      relatedEvergreenIds: [evTransformers.id], relatedSourceNoteIds: [srcAttention.id]
    });

    // Knowledge map (a small starter graph for AI) — the Mind Mapping
    // canvas, genuinely separate from the MOC above.
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
    // A freshly-seeded board has nothing to migrate from and is already
    // in the new shape — mark every migration done so it's never retried
    // against (and possibly duplicated onto) demo data.
    storeSet(KEYS.migratedLegacyLhub, true);
    storeSet(KEYS.migratedFromLearningFolder, true);
    storeSet(KEYS.normalizedQuestionsProjects, true);
  }

  function isEmptyEverywhere() {
    return !Topics.list().length && !DailyLogs.list().length && !Research.list().length &&
      !Maps.list().length && !Frameworks.list().length && !MasterNotes.list().length &&
      !Notes.list().length && !Projects.list().length && !Questions.list().length && !Sessions.list().length &&
      !SourceNotes.list().length && !EvergreenNotes.list().length && !ConnectionNotes.list().length &&
      !MOCs.list().length && !TutorSessions.list().length;
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
    LEARNING_LOOP: LEARNING_LOOP,
    CRITICAL_QUESTIONS: CRITICAL_QUESTIONS,
    MEDIA_CHECKLIST: MEDIA_CHECKLIST,
    OUTPUT_FIELDS: OUTPUT_FIELDS,
    TOPIC_COLORS: TOPIC_COLORS,
    TOPIC_STATUSES: TOPIC_STATUSES,
    RESEARCH_CATEGORIES: RESEARCH_CATEGORIES,
    RESEARCH_STATUSES: RESEARCH_STATUSES,
    NOTE_TYPES: NOTE_TYPES,
    PROJECT_STATUSES: PROJECT_STATUSES,
    PROJECT_WORKFLOW_STAGES: PROJECT_WORKFLOW_STAGES,
    QUESTION_STATUSES: QUESTION_STATUSES,
    SOURCE_TYPES: SOURCE_TYPES,
    SOURCE_STATUSES: SOURCE_STATUSES,
    MASTERY_LEVELS: MASTERY_LEVELS,
    TUTOR_MODES: TUTOR_MODES,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo, isoFromMs: isoFromMs,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl,
    escapeHtml: escapeHtml, slugify: slugify, extractHeadings: extractHeadings,
    extractBacklinkTitles: extractBacklinkTitles, backlinksTo: backlinksTo, renderMarkdownLite: renderMarkdownLite,
    evergreenScanText: evergreenScanText,
    weekInfo: weekInfo,
    tutorMode: tutorMode, buildTutorPrompt: buildTutorPrompt, tutorLocalFallback: tutorLocalFallback,
    getAiPrefs: getAiPrefs,
    Topics: Object.assign({}, Topics, { remove: removeTopic }),
    DailyLogs: DailyLogs, Research: Research, Maps: Maps, Frameworks: Frameworks,
    MasterNotes: MasterNotes, Notes: Notes, Projects: Projects, Questions: Questions, Sessions: Sessions,
    SourceNotes: SourceNotes, EvergreenNotes: EvergreenNotes, ConnectionNotes: ConnectionNotes,
    MOCs: MOCs, TutorSessions: TutorSessions,
    sourceNoteMainIdeaModel: sourceNoteMainIdeaModel,
    getSettings: getSettings, saveSettings: saveSettings,
    topicsSorted: topicsSorted, activeTopics: activeTopics, nextOrder: nextOrder, reorderCollection: reorderCollection,
    sessionsForTopic: sessionsForTopic, dailyLogsForTopic: dailyLogsForTopic, dailyLogFor: dailyLogFor, upsertDailyLog: upsertDailyLog,
    researchForTopic: researchForTopic, mapsForTopic: mapsForTopic, frameworksForTopic: frameworksForTopic,
    masterNotesForTopic: masterNotesForTopic, notesForTopic: notesForTopic, projectsForTopic: projectsForTopic, questionsForTopic: questionsForTopic,
    sourceNotesForTopic: sourceNotesForTopic, evergreenNotesForTopic: evergreenNotesForTopic,
    connectionNotesForTopic: connectionNotesForTopic, mocsForTopic: mocsForTopic, tutorSessionsForTopic: tutorSessionsForTopic,
    hoursLoggedForTopic: hoursLoggedForTopic, totalHoursLogged: totalHoursLogged,
    currentTopic: currentTopic, markStudied: markStudied, recentlyStudiedTopics: recentlyStudiedTopics,
    currentStreak: currentStreak, weeklyActivityMinutes: weeklyActivityMinutes, monthlyCompletionTrend: monthlyCompletionTrend,
    topicsStudiedCount: topicsStudiedCount, conceptsMasteredCount: conceptsMasteredCount, questionsAnsweredCount: questionsAnsweredCount,
    connectionsCreatedCount: connectionsCreatedCount, tutorSessionsCompletedCount: tutorSessionsCompletedCount, projectsAppliedCount: projectsAppliedCount,
    evergreenMasteryDistribution: evergreenMasteryDistribution, sourceNotesByStatus: sourceNotesByStatus,
    globalSearch: globalSearch,
    runOneTimeMigrations: runOneTimeMigrations,
    migrateLegacyLhubCollections: migrateLegacyLhubCollections, migrateFromLearningFolder: migrateFromLearningFolder, normalizeExistingRecords: normalizeExistingRecords,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, isEmptyEverywhere: isEmptyEverywhere
  };
})(window);
