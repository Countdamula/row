// system-data.js
//
// Shared data foundation for system.html ("Build Your System"). Same
// conventions as aitech-data.js/business-data.js (see CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB. All
// keys live under a `system:` prefix so system.html's
// initCloudSync({ syncedPrefixes: ['system:'] }) call covers every
// collection with no per-key list.
//
// Implements the "Build Your Own System" + "Identity Shifting" framework as
// genuinely separate, editable/adjustable databases (never merged into one
// mixed list, same precedent as business-data.js's Platform/Content
// Plan/Useful Resources split):
//   - Goals        — the Top 10 Goals list; up to MAX_SELECTED_GOALS (3) can
//                     be flagged isSelected at a time.
//   - Actions      — the repeatable daily/weekly actions that make up "the
//                     system" for a goal, each with its own Minimum Viable
//                     Action text and a Mon–Sun completion tracker.
//   - Processes    — the "Repeatable processes" bucket of the Written
//                     System (distinct from individual habits — a named,
//                     multi-step routine).
//   - VisualTools  — the tracking methods themselves (whiteboard, habit
//                     tracker, calendar, scoreboard, etc.) that make up the
//                     Visual System.
//   - MentalEntries— Identity / Self-Talk / Journaling / Mindset / Removing
//                     Friction notes that make up the Mental System.
//   - Anchors      — Identity Shifting Step 01: limiting-belief "identity
//                     anchors."
//   - Vision       — Identity Shifting Step 02: a single, evolving guided
//                     Future Self Vision record (not date-keyed — meant to
//                     be revisited/refined, same shape as a hero record).
//   - Challenges   — Identity Shifting Step 03: install-through-action
//                     challenges, optionally linked to an Anchor.
//   - PageNotes    — a freeform, "+ Generate Notes Section"-style database
//                     of editable notes, scoped by `page` (one of the 8
//                     tabs/subpages) and rendered at the top of each.
//   - IdentityPrompts — editable Reflection Prompts and copy-ready AI
//                     Prompts, scoped by `section` (anchors/vision/
//                     challenges) and `kind` ('prompt'|'ai').

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'system:save' event either way so
  // system.html can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('system:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('system:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    goals: 'system:goals',
    actions: 'system:actions',
    processes: 'system:processes',
    visualTools: 'system:visualTools',
    mentalEntries: 'system:mentalEntries',
    anchors: 'system:anchors',
    vision: 'system:vision',
    challenges: 'system:challenges',
    pageNotes: 'system:pageNotes',
    identityPrompts: 'system:identityPrompts',
    hero: 'system:hero',
    activeTab: 'system:active_tab',
    seeded: 'system:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // IMAGE COMPRESSION — same canvas-downscale recipe every other page in
  // this app already uses (aitech-data.js, etc.).
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

  // ============================================================
  // HERO — a single, editable cover-photo record, same get/save-one-record
  // shape as aitech-data.js's hero. Defaults bake in this page's original
  // static header copy, so the header reads correctly even before the
  // seed-race-safety window's first sync/seed pass has run.
  // ============================================================
  /** @typedef {{eyebrow:string, title:string, subtext:string, ctaLabel:string, photo:string, photoColor:string}} SysHero */
  function heroModel(data) {
    data = data || {};
    function s(v, fallback) { return typeof v === 'string' && v !== '' ? v : fallback; }
    return {
      eyebrow: s(data.eyebrow, 'Build Your Own System'),
      title: s(data.title, 'Dreams become measurable.'),
      subtext: s(data.subtext, 'Ten goals, narrowed to three. Repeatable daily and weekly actions. Three systems — written, visual, mental — that keep you showing up.'),
      ctaLabel: s(data.ctaLabel, 'START BUILDING'),
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero)); }
  function saveHero(patch) {
    const next = heroModel(Object.assign({}, getHero(), patch));
    storeSet(KEYS.hero, next);
    return next;
  }

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

  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }

  /** Swap-adjacent-order-values reorder — this app's standard convention
   * for non-drag lists (Life Areas, Workflow weeks/days, etc.). Operates
   * over the collection's full order-sorted list, not a filtered subset. */
  function moveInCollection(coll, id, dir) {
    const all = coll.list();
    const sorted = all.slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sorted.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const idA = sorted[idx].id, idB = sorted[swapIdx].id;
    const orderA = sorted[idx].order, orderB = sorted[swapIdx].order;
    const next = all.map(function (x) {
      if (x.id === idA) return Object.assign({}, x, { order: orderB });
      if (x.id === idB) return Object.assign({}, x, { order: orderA });
      return x;
    });
    coll.replaceAll(next);
  }

  // ============================================================
  // DATE HELPERS — same Monday-stamp weekly-reset mechanism home.html's
  // Weekly Schedule already established (checksWeekStart, resetStaleWeeks).
  // ============================================================
  function isoDate(d) {
    const dt = new Date(d);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function mondayOf(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
  function currentMondayISO() { return isoDate(mondayOf(new Date())); }
  function todayISO() { return isoDate(new Date()); }

  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ============================================================
  // GOALS — Top 10 Goals. Up to MAX_SELECTED_GOALS (3) can be isSelected at
  // once. `isSelected` supersedes the original single-`isPrimary` "The One
  // Goal" flag — goalModel() falls back to reading legacy `isPrimary` data
  // so anything already saved under the old shape carries forward intact.
  // ============================================================
  const MAX_SELECTED_GOALS = 3;
  /** @typedef {{id:string, title:string, notes:string, isSelected:boolean, order:number, createdAt:number}} SysGoal */
  function goalModel(data) {
    data = data || {};
    return {
      id: data.id || uid('goal'),
      title: typeof data.title === 'string' ? data.title : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      isSelected: typeof data.isSelected === 'boolean' ? data.isSelected : !!data.isPrimary,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Goals = makeCollection(KEYS.goals, goalModel);

  function goalsSorted() { return Goals.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function selectedGoalsSorted() { return goalsSorted().filter(function (g) { return g.isSelected; }); }
  function selectedGoalCount() { return Goals.list().filter(function (g) { return g.isSelected; }).length; }
  /** Toggles a goal's selection on/off, capped at MAX_SELECTED_GOALS active
   * at once. Returns { ok:true } on success, or { ok:false, reason:'limit' }
   * if selecting this one would exceed the cap (deselecting is never
   * blocked). */
  function toggleGoalSelected(id) {
    const g = Goals.get(id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (!g.isSelected && selectedGoalCount() >= MAX_SELECTED_GOALS) return { ok: false, reason: 'limit' };
    Goals.update(id, { isSelected: !g.isSelected });
    return { ok: true };
  }
  /** Same cap enforcement as toggleGoalSelected(), for the Add/Edit Goal
   * modal's checkbox — lets a brand-new goal be selected on creation too.
   * Returns false (and leaves the goal unselected) if the cap is already
   * hit, so the caller can tell the user their edit still saved. */
  function setGoalSelected(id, selected) {
    if (selected) {
      const g = Goals.get(id);
      if (g && !g.isSelected && selectedGoalCount() >= MAX_SELECTED_GOALS) return false;
    }
    Goals.update(id, { isSelected: !!selected });
    return true;
  }
  /** Deleting a goal nulls out the reference on any Action that pointed at
   * it, rather than deleting those actions — same null-out-the-reference
   * precedent aitech-data.js's model deletion and household-data.js's
   * legion deletion already established. */
  function removeGoal(id) {
    Goals.remove(id);
    Actions.replaceAll(Actions.list().map(function (a) { return a.goalId === id ? Object.assign({}, a, { goalId: null }) : a; }));
  }
  function goalName(goalId) {
    const g = Goals.get(goalId);
    return g ? g.title : null;
  }

  // ============================================================
  // ACTIONS — the repeated daily/weekly actions that form "the system" for
  // a goal. Each carries its own Minimum Viable Action text and a Mon–Sun
  // completion tracker (the Visual System's actual live tracker).
  // ============================================================
  const ACTION_FREQUENCIES = ['daily', 'weekly'];
  /** @typedef {{id:string, goalId:?string, title:string, frequency:string, mva:string, notes:string, scheduledDays:number[], checks:Object, checksWeekStart:string, totalCompletions:number, order:number, createdAt:number}} SysAction */
  function actionModel(data) {
    data = data || {};
    const freq = ACTION_FREQUENCIES.indexOf(data.frequency) !== -1 ? data.frequency : 'daily';
    let scheduledDays = Array.isArray(data.scheduledDays) ? data.scheduledDays.filter(function (d) { return typeof d === 'number' && d >= 0 && d <= 6; }) : null;
    if (!scheduledDays) scheduledDays = freq === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [1];
    return {
      id: data.id || uid('act'),
      goalId: data.goalId || null,
      title: typeof data.title === 'string' ? data.title : '',
      frequency: freq,
      mva: typeof data.mva === 'string' ? data.mva : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      scheduledDays: scheduledDays,
      checks: (data.checks && typeof data.checks === 'object') ? data.checks : {},
      checksWeekStart: typeof data.checksWeekStart === 'string' ? data.checksWeekStart : currentMondayISO(),
      totalCompletions: typeof data.totalCompletions === 'number' ? data.totalCompletions : 0,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Actions = makeCollection(KEYS.actions, actionModel);

  function actionsSorted() { return Actions.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function actionsForGoal(goalId) { return actionsSorted().filter(function (a) { return a.goalId === goalId; }); }
  function actionsByFrequency(freq) { return actionsSorted().filter(function (a) { return a.frequency === freq; }); }

  /** If an action's week-start stamp has gone stale, clears its checks back
   * to unchecked and re-stamps it — same weekly-reset mechanism as
   * home.html's Weekly Schedule. Safe to call on every render. */
  function resetStaleWeeks() {
    const monday = currentMondayISO();
    const all = Actions.list();
    let changed = false;
    const next = all.map(function (a) {
      if (a.checksWeekStart !== monday) { changed = true; return Object.assign({}, a, { checks: {}, checksWeekStart: monday }); }
      return a;
    });
    if (changed) Actions.replaceAll(next);
  }
  function toggleActionCheck(actionId, dayIdx) {
    const a = Actions.get(actionId);
    if (!a) return;
    const checks = Object.assign({}, a.checks);
    const wasChecked = !!checks[dayIdx];
    if (wasChecked) delete checks[dayIdx]; else checks[dayIdx] = true;
    const totalCompletions = Math.max(0, (a.totalCompletions || 0) + (wasChecked ? -1 : 1));
    Actions.update(actionId, { checks: checks, totalCompletions: totalCompletions });
  }
  function actionWeekProgress(action) {
    const scheduled = action.scheduledDays || [];
    if (!scheduled.length) return 0;
    const done = scheduled.filter(function (d) { return !!action.checks[d]; }).length;
    return done / scheduled.length;
  }

  // ============================================================
  // PROCESSES — the "Repeatable processes" bucket of the Written System
  // (a named, freeform multi-step routine — distinct from an individual
  // Action/habit).
  // ============================================================
  /** @typedef {{id:string, title:string, description:string, order:number, createdAt:number}} SysProcess */
  function processModel(data) {
    data = data || {};
    return {
      id: data.id || uid('proc'),
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Processes = makeCollection(KEYS.processes, processModel);
  function processesSorted() { return Processes.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // VISUAL TOOLS — the tracking methods themselves (whiteboard, habit
  // tracker, calendar, scoreboard, etc.).
  // ============================================================
  const VISUAL_TOOL_TYPES = ['Whiteboard', 'Habit Tracker', 'Calendar', 'Scoreboard', 'Other'];
  /** @typedef {{id:string, type:string, title:string, description:string, order:number, createdAt:number}} SysVisualTool */
  function visualToolModel(data) {
    data = data || {};
    return {
      id: data.id || uid('vt'),
      type: VISUAL_TOOL_TYPES.indexOf(data.type) !== -1 ? data.type : 'Other',
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const VisualTools = makeCollection(KEYS.visualTools, visualToolModel);
  function visualToolsSorted() { return VisualTools.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // MENTAL ENTRIES — Identity / Self-Talk / Journaling / Mindset /
  // Removing Friction notes that make up the Mental System.
  // ============================================================
  const MENTAL_CATEGORIES = ['Identity', 'Self-Talk', 'Journaling', 'Mindset', 'Removing Friction'];
  /** @typedef {{id:string, category:string, title:string, body:string, order:number, createdAt:number}} SysMentalEntry */
  function mentalEntryModel(data) {
    data = data || {};
    return {
      id: data.id || uid('me'),
      category: MENTAL_CATEGORIES.indexOf(data.category) !== -1 ? data.category : MENTAL_CATEGORIES[0],
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const MentalEntries = makeCollection(KEYS.mentalEntries, mentalEntryModel);
  function mentalEntriesSorted() { return MentalEntries.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // IDENTITY ANCHORS — Step 01: limiting-belief "identity anchors."
  // ============================================================
  /** @typedef {{id:string, belief:string, reframe:string, active:boolean, order:number, createdAt:number}} SysAnchor */
  function anchorModel(data) {
    data = data || {};
    return {
      id: data.id || uid('anc'),
      belief: typeof data.belief === 'string' ? data.belief : '',
      reframe: typeof data.reframe === 'string' ? data.reframe : '',
      active: data.active === false ? false : true,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Anchors = makeCollection(KEYS.anchors, anchorModel);
  function anchorsSorted() { return Anchors.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  /** Deleting an anchor nulls out the reference on any Challenge that
   * pointed at it, same null-out-the-reference precedent as removeGoal(). */
  function removeAnchor(id) {
    Anchors.remove(id);
    Challenges.replaceAll(Challenges.list().map(function (c) { return c.anchorId === id ? Object.assign({}, c, { anchorId: null }) : c; }));
  }

  // ============================================================
  // VISION — Step 02: a single, evolving Future Self Vision record. Same
  // get/save-a-single-record shape as aitech-data.js's hero.
  // ============================================================
  /** @typedef {{surroundedBy:string, howYouCarryYourself:string, schedule:string, work:string, hobbies:string, othersSay:string, freeTime:string, afraidToAdmit:string, updatedAt:number}} SysVision */
  function visionModel(data) {
    data = data || {};
    function s(v) { return typeof v === 'string' ? v : ''; }
    return {
      surroundedBy: s(data.surroundedBy),
      howYouCarryYourself: s(data.howYouCarryYourself),
      schedule: s(data.schedule),
      work: s(data.work),
      hobbies: s(data.hobbies),
      othersSay: s(data.othersSay),
      freeTime: s(data.freeTime),
      afraidToAdmit: s(data.afraidToAdmit),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0
    };
  }
  function getVision() { return visionModel(storeGet(KEYS.vision)); }
  function saveVision(patch) {
    const next = visionModel(Object.assign({}, getVision(), patch, { updatedAt: Date.now() }));
    storeSet(KEYS.vision, next);
    return next;
  }

  // ============================================================
  // CHALLENGES — Step 03: install-through-action challenges, optionally
  // linked to an Anchor via a nullable anchorId.
  // ============================================================
  const CHALLENGE_FREQUENCIES = ['daily', 'weekly', 'once'];
  const CHALLENGE_STATUSES = ['not-started', 'in-progress', 'done'];
  /** @typedef {{id:string, anchorId:?string, title:string, action:string, frequency:string, status:string, notes:string, order:number, createdAt:number}} SysChallenge */
  function challengeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('chal'),
      anchorId: data.anchorId || null,
      title: typeof data.title === 'string' ? data.title : '',
      action: typeof data.action === 'string' ? data.action : '',
      frequency: CHALLENGE_FREQUENCIES.indexOf(data.frequency) !== -1 ? data.frequency : 'daily',
      status: CHALLENGE_STATUSES.indexOf(data.status) !== -1 ? data.status : 'not-started',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Challenges = makeCollection(KEYS.challenges, challengeModel);
  function challengesSorted() { return Challenges.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function nextChallengeStatus(status) {
    const idx = CHALLENGE_STATUSES.indexOf(status);
    return CHALLENGE_STATUSES[(idx + 1) % CHALLENGE_STATUSES.length];
  }

  // ============================================================
  // PAGE NOTES — a freeform, "+ Generate Notes Section"-style database
  // (same add-a-blank-editable-section vocabulary as index.html's Overview
  // notes / business.html's Platform Detail sections — not AI generation,
  // this app has no active LLM key anywhere, see CLAUDE.md's own Writing
  // Dashboard section on this exact point). Scoped by `page` so every
  // tab/subpage gets its own independent list, rendered at its top.
  // ============================================================
  const NOTE_PAGES = ['goals', 'build', 'written', 'visual', 'mental', 'anchors', 'vision', 'challenges'];
  /** @typedef {{id:string, page:string, title:string, body:string, order:number, createdAt:number}} SysPageNote */
  function pageNoteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      page: NOTE_PAGES.indexOf(data.page) !== -1 ? data.page : NOTE_PAGES[0],
      title: typeof data.title === 'string' ? data.title : 'Notes',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const PageNotes = makeCollection(KEYS.pageNotes, pageNoteModel);
  function notesForPage(page) { return PageNotes.list().filter(function (n) { return n.page === page; }).sort(function (a, b) { return a.order - b.order; }); }
  function addPageNote(page) { return PageNotes.add({ page: page, title: 'Notes', body: '', order: nextOrder(notesForPage(page)) }); }

  // ============================================================
  // IDENTITY PROMPTS — editable Reflection Prompts and copy-ready AI
  // Prompts for each Identity Shifting subpage (Anchors/Vision/
  // Challenges). "AI Prompts" here means copy-to-clipboard prompt text
  // meant to be pasted into an AI chat — same convention as
  // aitech-data.js's Prompts database — not a live API call, this app has
  // no active LLM key anywhere (see CLAUDE.md §1/§2).
  // ============================================================
  const PROMPT_SECTIONS = ['anchors', 'vision', 'challenges'];
  const PROMPT_KINDS = ['prompt', 'ai'];
  /** @typedef {{id:string, section:string, kind:string, text:string, order:number, createdAt:number}} SysIdentityPrompt */
  function identityPromptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('iprm'),
      section: PROMPT_SECTIONS.indexOf(data.section) !== -1 ? data.section : PROMPT_SECTIONS[0],
      kind: PROMPT_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'prompt',
      text: typeof data.text === 'string' ? data.text : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const IdentityPrompts = makeCollection(KEYS.identityPrompts, identityPromptModel);
  function promptsFor(section, kind) { return IdentityPrompts.list().filter(function (p) { return p.section === section && p.kind === kind; }).sort(function (a, b) { return a.order - b.order; }); }
  function addIdentityPrompt(section, kind, text) { return IdentityPrompts.add({ section: section, kind: kind, text: text, order: nextOrder(promptsFor(section, kind)) }); }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Goals.replaceAll([]);
    Actions.replaceAll([]);
    Processes.replaceAll([]);
    VisualTools.replaceAll([]);
    MentalEntries.replaceAll([]);
    Anchors.replaceAll([]);
    Challenges.replaceAll([]);
    PageNotes.replaceAll([]);
    IdentityPrompts.replaceAll([]);
    storeSet(KEYS.vision, null);
    storeSet(KEYS.hero, null);

    const goalDefs = [
      'Build a business that replaces my income',
      'Get into the best shape of my life',
      'Read 24 books this year',
      'Save a 6-month emergency fund',
      'Deepen my closest relationships'
    ];
    let primary = null;
    goalDefs.forEach(function (title, i) {
      // First 2 goals start selected (of the up-to-3 allowed) — demonstrates
      // the multi-select without assuming the user wants all 3 used at once.
      const g = Goals.add({ title: title, order: i, isSelected: i < 2 });
      if (i === 0) primary = g;
    });

    Actions.add({ goalId: primary.id, title: 'Write 300 words on the business', frequency: 'daily', mva: 'Write one sentence.', notes: 'First thing in the morning, before email.', order: 0 });
    Actions.add({ goalId: primary.id, title: 'Review the week\'s numbers', frequency: 'weekly', mva: 'Open the spreadsheet and look at it for one minute.', notes: '', scheduledDays: [0], order: 1 });

    Processes.add({ title: 'Weekly Reset', description: 'Sunday evening, 30 minutes:\n1. Clear the inbox to zero.\n2. Review last week\'s system-action checks.\n3. Pick this week\'s one priority.\n4. Plan tomorrow\'s first hour.', order: 0 });

    VisualTools.add({ type: 'Habit Tracker', title: 'This page\'s weekly action tracker', description: 'The built-in Mon–Sun checkbox grid on the Visual tab — used daily.', order: 0 });
    VisualTools.add({ type: 'Whiteboard', title: 'Kitchen whiteboard', description: 'The One Goal + this week\'s priority, written up where I see it every morning.', order: 1 });

    MentalEntries.add({ category: 'Identity', title: 'Who I\'m becoming', body: 'Someone who shows up on the boring days, not just the motivated ones.', order: 0 });
    MentalEntries.add({ category: 'Self-Talk', title: 'When I miss a day', body: 'One missed day is an accident. Two in a row is the start of a new habit — don\'t let it become that.', order: 0 });
    MentalEntries.add({ category: 'Removing Friction', title: 'Make the MVA impossible to skip', body: 'If the smallest version of the habit still feels like too much, it\'s not small enough yet — shrink it further.', order: 0 });

    const anc1 = Anchors.add({ belief: 'I\'m bad with money', reframe: 'I\'m someone who is learning to manage money well — every week I track it, I get better at it.', order: 0 });
    Anchors.add({ belief: 'I don\'t have the discipline for this', reframe: 'Discipline is a skill I\'m building through the Minimum Viable Action, not a trait I either have or don\'t.', order: 1 });

    Challenges.add({ anchorId: anc1.id, title: 'Track every expense for 7 days', action: 'Log every purchase, no matter how small, in the tracker the same day it happens.', frequency: 'daily', status: 'not-started', order: 0 });

    addIdentityPrompt('anchors', 'prompt', 'What limiting belief have you carried the longest, and where did it actually come from?');
    addIdentityPrompt('anchors', 'prompt', 'If a close friend said this belief about themselves, what would you tell them?');
    addIdentityPrompt('anchors', 'ai', 'Help me identify 5 limiting beliefs that might be holding me back from [your goal]. For each one, ask me a question that would help me see where it came from, then suggest a more accurate reframe.');
    addIdentityPrompt('vision', 'prompt', 'Describe your ideal week as if it were happening right now, not five years from now.');
    addIdentityPrompt('vision', 'prompt', 'What would someone who already has this life do differently today?');
    addIdentityPrompt('vision', 'ai', "Ask me guided journaling questions, one at a time, to help me build a vivid, specific picture of my ideal week — who I'm with, what my days look like, what work I'm doing, and how I feel. Don't let me answer vaguely — push me for specifics.");
    addIdentityPrompt('challenges', 'prompt', "What's the smallest action you could take today that would directly contradict the limiting belief?");
    addIdentityPrompt('challenges', 'ai', 'Given this limiting belief: [paste belief]. Give me 10 small, concrete challenges I could do this week that would give me direct evidence against it. Order them from easiest to most uncomfortable.');

    PageNotes.add({ page: 'goals', title: 'Notes', body: 'Reminders on why these goals matter, deadlines, or anything else worth keeping in view.', order: 0 });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Goals.list().length || Actions.list().length || Processes.list().length || VisualTools.list().length ||
        MentalEntries.list().length || Anchors.list().length || Challenges.list().length || storeGet(KEYS.vision) ||
        PageNotes.list().length || IdentityPrompts.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }
    seedDefaultData();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as aitech-data.js/dreamboard-data.js:
  // seeding synchronously at script-load time, before initCloudSync() gets
  // a chance to pull real cloud data, can push a freshly-seeded "default"
  // set to Supabase and clobber another device's real data. system.html's
  // init() calls seedIfEmpty() itself, only as a fallback after giving the
  // cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.SystemData = {
    KEYS: KEYS,
    ACTION_FREQUENCIES: ACTION_FREQUENCIES,
    VISUAL_TOOL_TYPES: VISUAL_TOOL_TYPES,
    MENTAL_CATEGORIES: MENTAL_CATEGORIES,
    CHALLENGE_FREQUENCIES: CHALLENGE_FREQUENCIES,
    CHALLENGE_STATUSES: CHALLENGE_STATUSES,
    WEEKDAY_LABELS: WEEKDAY_LABELS,
    NOTE_PAGES: NOTE_PAGES,
    PROMPT_SECTIONS: PROMPT_SECTIONS,
    PROMPT_KINDS: PROMPT_KINDS,
    MAX_SELECTED_GOALS: MAX_SELECTED_GOALS,
    uid: uid,
    nextOrder: nextOrder,
    moveInCollection: moveInCollection,
    compressImageDataUrl: compressImageDataUrl,
    getHero: getHero,
    saveHero: saveHero,
    todayISO: todayISO,
    currentMondayISO: currentMondayISO,

    Goals: Object.assign({}, Goals, { remove: removeGoal }),
    goalsSorted: goalsSorted,
    selectedGoalsSorted: selectedGoalsSorted,
    selectedGoalCount: selectedGoalCount,
    toggleGoalSelected: toggleGoalSelected,
    setGoalSelected: setGoalSelected,
    goalName: goalName,

    Actions: Actions,
    actionsSorted: actionsSorted,
    actionsForGoal: actionsForGoal,
    actionsByFrequency: actionsByFrequency,
    resetStaleWeeks: resetStaleWeeks,
    toggleActionCheck: toggleActionCheck,
    actionWeekProgress: actionWeekProgress,

    Processes: Processes,
    processesSorted: processesSorted,

    VisualTools: VisualTools,
    visualToolsSorted: visualToolsSorted,

    MentalEntries: MentalEntries,
    mentalEntriesSorted: mentalEntriesSorted,

    Anchors: Object.assign({}, Anchors, { remove: removeAnchor }),
    anchorsSorted: anchorsSorted,

    getVision: getVision,
    saveVision: saveVision,

    Challenges: Challenges,
    challengesSorted: challengesSorted,
    nextChallengeStatus: nextChallengeStatus,

    PageNotes: PageNotes,
    notesForPage: notesForPage,
    addPageNote: addPageNote,

    IdentityPrompts: IdentityPrompts,
    promptsFor: promptsFor,
    addIdentityPrompt: addIdentityPrompt,

    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
