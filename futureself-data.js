// =============================================================
// futureself-data.js — the data layer for the Future Self Profile.
//
// Prefix `fs:`, on its OWN Supabase row (appKey 'futureself').
//
// WHY ITS OWN ROW. sync.js re-serialises and uploads a row's entire
// `data` column on every debounced save. The Visual Identity Board is
// the one collection here that grows without bound, so riding on the
// `goals` row would make every keystroke anywhere in Main a
// multi-megabyte upload. Same reasoning that split `kdpms` out of
// `kdp`. Every image still goes through PhotoStore.upload() so what
// is stored is a ~100-byte URL rather than a base64 blob.
//
// THE TWO-LAYER RULE IS IN THE MODELS, NOT JUST THE PAGE.
// Layer 1 is what you see when you open the page: a headline, a chip,
// a photo, one line. Layer 2 is what opens when you click it. So
// almost every record here carries a short field AND a long one, and
// the renderer is free to show only the short one. A model with just
// one long text field would force the page to choose between being
// beautiful and being useful.
//
// IDENTITY STATEMENTS, NOT GOALS. Nothing in this file stores "I want
// to become…". The models are all present tense on purpose — that is
// the entire point of the page, and a `target`/`progress` field would
// quietly turn it back into a task list.
// =============================================================

(function (global) {
  'use strict';

  var P = 'fs:';
  var KEYS = {
    hero:       P + 'hero',
    identity:   P + 'identity',
    focus:      P + 'focus',
    settings:   P + 'settings',
    seeded:     P + 'seeded',
    migrated:   P + 'migratedSystemVision',

    boardCategories: P + 'boardCategories',
    boardImages:     P + 'boardImages',
    traits:     P + 'traits',
    areas:      P + 'areas',
    day:        P + 'day',
    standards:  P + 'standards',
    quotes:     P + 'quotes',
    memories:   P + 'memories',
    notes:      P + 'notes',
    moreless:   P + 'moreless',
    dimensions: P + 'dimensions',
    evidence:   P + 'evidence',
    letters:    P + 'letters'
  };

  // ------------------------------------------------------------
  // STORE
  // ------------------------------------------------------------
  function storeGet(k, f) {
    try { var r = localStorage.getItem(k); return r == null ? f : JSON.parse(r); }
    catch (e) { return f; }
  }
  function storeSet(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      try { global.dispatchEvent(new CustomEvent('fs:save', { detail: { key: k, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { global.dispatchEvent(new CustomEvent('fs:save', { detail: { key: k, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function s(v) { return v == null ? '' : String(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function nextOrder(list) { return list.reduce(function (m, x) { return Math.max(m, (x.order || 0) + 1); }, 0); }
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function oneOf(v, allowed, dflt) { return allowed.indexOf(v) !== -1 ? v : dflt; }

  function makeCollection(key, model, prefix) {
    function list() { return arr(storeGet(key, [])).map(model); }
    function sorted() { return list().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
    function replaceAll(a) { return storeSet(key, arr(a).map(model)); }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(f) {
      var all = list();
      var rec = model(Object.assign({}, f, {
        id: (f && f.id) || uid(prefix),
        order: (f && f.order != null) ? f.order : nextOrder(all),
        createdAt: Date.now()
      }));
      all.push(rec); replaceAll(all); return rec;
    }
    function update(id, patch) {
      var all = list(), i = all.findIndex(function (x) { return x.id === id; });
      if (i < 0) return null;
      all[i] = model(Object.assign({}, all[i], patch, { updatedAt: Date.now() }));
      replaceAll(all); return all[i];
    }
    function remove(id) { replaceAll(list().filter(function (x) { return x.id !== id; })); return true; }
    function move(id, dir) {
      var all = sorted(), i = all.findIndex(function (x) { return x.id === id; }), j = i + dir;
      if (i < 0 || j < 0 || j >= all.length) return false;
      var t = all[i]; all[i] = all[j]; all[j] = t;
      all.forEach(function (x, n) { x.order = n; });
      replaceAll(all); return true;
    }
    return { key: key, list: list, sorted: sorted, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll, move: move };
  }

  // ============================================================
  // 1 · HERO
  // ============================================================
  function heroModel(h) {
    h = h || {};
    return {
      eyebrow: h.eyebrow != null ? s(h.eyebrow) : 'The man I am becoming',
      lines: arr(h.lines).length ? arr(h.lines).map(s) : ['Count Damula,', 'fully realised'],
      period: h.period != null ? s(h.period) : 'The next three years',
      statement: h.statement != null ? s(h.statement)
        : 'I create for a living, control my time, take care of my body, live beautifully, and build things that outlast me.',
      image: s(h.image),
      updatedAt: h.updatedAt || 0
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero, null)); }
  function saveHero(patch) {
    var n = heroModel(Object.assign({}, getHero(), patch, { updatedAt: Date.now() }));
    storeSet(KEYS.hero, n); return n;
  }

  // ============================================================
  // 2 · VISUAL IDENTITY BOARD
  //
  // Eight categories. The front of the page shows only the images
  // flagged isMain — six to twelve favourites — and each category
  // opens into its own gallery. That split is what stops this becoming
  // a wall of fifty Pinterest saves.
  // ============================================================
  var BOARD_SEED = [
    { slug: 'me',            name: 'Me',            description: 'Body, appearance, clothing, grooming, presence.' },
    { slug: 'environment',   name: 'Environment',   description: 'Home, office, the writing room, atmosphere.' },
    { slug: 'work',          name: 'Work',          description: 'Author life, books, the creative studio, the business.' },
    { slug: 'wealth',        name: 'Wealth',        description: 'Financial freedom, lifestyle, investments.' },
    { slug: 'lifestyle',     name: 'Lifestyle',     description: 'Travel, nature, hobbies, daily experiences.' },
    { slug: 'relationships', name: 'Relationships', description: 'Connection, family, romance, friendship.' },
    { slug: 'mind',          name: 'Mind',          description: 'Learning, confidence, peace, discipline.' },
    { slug: 'energy',        name: 'Energy',        description: 'The overall aesthetic and vibe of the life.' }
  ];
  function boardCatModel(c) {
    c = c || {};
    return {
      id: c.id || uid('bc'), slug: s(c.slug), name: s(c.name),
      description: s(c.description), cover: s(c.cover),
      order: c.order != null ? c.order : 0, createdAt: c.createdAt || Date.now()
    };
  }
  function boardImgModel(i) {
    i = i || {};
    return {
      id: i.id || uid('bi'), categoryId: s(i.categoryId),
      url: s(i.url), caption: s(i.caption),
      isMain: !!i.isMain,
      order: i.order != null ? i.order : 0, createdAt: i.createdAt || Date.now()
    };
  }
  var BoardCategories = makeCollection(KEYS.boardCategories, boardCatModel, 'bc');
  var BoardImages = makeCollection(KEYS.boardImages, boardImgModel, 'bi');
  function imagesIn(categoryId) {
    return BoardImages.sorted().filter(function (x) { return x.categoryId === categoryId; });
  }
  function mainCollage(limit) {
    var m = BoardImages.sorted().filter(function (x) { return x.isMain; });
    return limit ? m.slice(0, limit) : m;
  }

  // ============================================================
  // 3 · THIS IS ME — identity statements
  // ============================================================
  function identityModel(o) {
    o = o || {};
    return {
      statements: arr(o.statements).map(function (x, i) {
        x = x || {};
        return { id: x.id || uid('idn'), text: s(x.text), order: x.order != null ? x.order : i };
      }),
      updatedAt: o.updatedAt || 0
    };
  }
  function getIdentity() { return identityModel(storeGet(KEYS.identity, null)); }
  function saveIdentity(patch) {
    var n = identityModel(Object.assign({}, getIdentity(), patch, { updatedAt: Date.now() }));
    storeSet(KEYS.identity, n); return n;
  }
  function addStatement(text) {
    var cur = getIdentity();
    cur.statements.push({ id: uid('idn'), text: s(text), order: cur.statements.length });
    return saveIdentity({ statements: cur.statements });
  }
  function removeStatement(id) {
    return saveIdentity({ statements: getIdentity().statements.filter(function (x) { return x.id !== id; }) });
  }

  var IDENTITY_SEED = [
    'I write consistently.',
    'I finish what I start.',
    'I protect my time.',
    'I take care of my body.',
    'I create instead of endlessly consuming.',
    'I make decisions quickly.',
    'I trust myself.',
    'I build systems rather than relying on motivation.',
    'I am disciplined even when I do not feel motivated.',
    'I am a professional novelist who treats writing like his life’s work.'
  ];

  // ============================================================
  // 4 · TRAITS — three bands of the same list
  //
  // strong / developing / standard is visible character development.
  // Moving a trait from developing to strong is the whole reward.
  // ============================================================
  var TRAIT_BANDS = [
    { key: 'strong',     label: 'Already strong',  note: 'Traits you currently identify with.' },
    { key: 'developing', label: 'Developing',      note: 'Traits you are actively strengthening.' },
    { key: 'standard',   label: 'Future standard', note: 'Traits that should eventually feel automatic.' }
  ];
  var TRAIT_BAND_KEYS = TRAIT_BANDS.map(function (b) { return b.key; });
  function traitModel(t) {
    t = t || {};
    return {
      id: t.id || uid('tr'), name: s(t.name),
      band: oneOf(t.band, TRAIT_BAND_KEYS, 'developing'),
      note: s(t.note),
      order: t.order != null ? t.order : 0, createdAt: t.createdAt || Date.now()
    };
  }
  var Traits = makeCollection(KEYS.traits, traitModel, 'tr');
  function traitsIn(band) { return Traits.sorted().filter(function (t) { return t.band === band; }); }

  var TRAIT_SEED = [
    { name: 'Curious',     band: 'strong' },
    { name: 'Creative',    band: 'strong' },
    { name: 'Ambitious',   band: 'strong' },
    { name: 'Independent', band: 'strong' },
    { name: 'Disciplined', band: 'developing' },
    { name: 'Consistent',  band: 'developing' },
    { name: 'Decisive',    band: 'developing' },
    { name: 'Focused',     band: 'developing' },
    { name: 'Calm',        band: 'standard' },
    { name: 'Confident',   band: 'standard' },
    { name: 'Patient',     band: 'standard' }
  ];

  // ============================================================
  // 5 · FUTURE SELF BY LIFE AREA
  // ============================================================
  var AREAS = [
    { key: 'work',          label: 'Work and purpose' },
    { key: 'mind',          label: 'Mind' },
    { key: 'body',          label: 'Body' },
    { key: 'wealth',        label: 'Wealth' },
    { key: 'environment',   label: 'Environment' },
    { key: 'relationships', label: 'Relationships' },
    { key: 'lifestyle',     label: 'Lifestyle' }
  ];
  var AREA_KEYS = AREAS.map(function (a) { return a.key; });
  function areaModel(a) {
    a = a || {};
    return {
      id: a.id || uid('ar'),
      area: oneOf(a.area, AREA_KEYS, 'mind'),
      headline: s(a.headline),          // layer 1
      body: s(a.body),                  // layer 2
      bullets: arr(a.bullets).map(s),
      // A list of things he no longer believes / no longer does. Only
      // Mind really needs it, but every area may carry one.
      shed: arr(a.shed).map(s),
      image: s(a.image),
      order: a.order != null ? a.order : 0, createdAt: a.createdAt || Date.now()
    };
  }
  var Areas = makeCollection(KEYS.areas, areaModel, 'ar');
  function areaFor(key) { return Areas.list().find(function (x) { return x.area === key; }) || null; }

  // Work is deliberately first and richest. This is a creative life
  // being designed, not a generic wheel-of-life with seven equal slices.
  var AREA_SEED = [
    { area: 'work', order: 0,
      headline: 'A professional novelist who treats writing like his life’s work.',
      bullets: ['Writes before consuming anything', 'Ships finished books, not started ones', 'Known for worlds people cannot leave', 'A normal workday is three hours of deep work and no meetings'] },
    { area: 'mind', order: 1,
      headline: 'Quiet, decided, hard to knock off course.',
      bullets: ['Thinks in systems', 'Decides fast and revisits rarely', 'Believes discipline is a form of self-respect'],
      shed: ['That motivation is a prerequisite', 'That being busy is the same as being useful'] },
    { area: 'body', order: 2,
      headline: 'Trained, rested, dressed on purpose.',
      bullets: ['Trains consistently', 'Eats intentionally', 'Sleeps properly', 'Grooms and dresses deliberately'] },
    { area: 'wealth', order: 3,
      headline: 'Enough that money stops being a daily thought.',
      bullets: ['Monthly income:', 'Net worth:', 'Investments:', 'Revenue sources:'] },
    { area: 'environment', order: 4,
      headline: 'Dark, private, intentional. A room that makes work feel inevitable.',
      bullets: ['Home', 'The writing room', 'The desk', 'Light', 'The objects worth keeping'] },
    { area: 'relationships', order: 5,
      headline: 'Few, chosen, and easy.',
      bullets: ['How I show up', 'What I give', 'What I expect', 'What they feel like'] },
    { area: 'lifestyle', order: 6,
      headline: 'An ordinary Tuesday worth having, not a fantasy holiday.',
      bullets: ['Travel', 'Nature', 'Hobbies', 'Freedom over the calendar'] }
  ];

  // ============================================================
  // 6 · A DAY IN MY FUTURE LIFE
  // ============================================================
  function dayModel(d) {
    d = d || {};
    return {
      id: d.id || uid('dy'),
      time: /^\d{1,2}:\d{2}$/.test(s(d.time)) ? s(d.time) : s(d.time),
      title: s(d.title), detail: s(d.detail),
      order: d.order != null ? d.order : 0, createdAt: d.createdAt || Date.now()
    };
  }
  var Day = makeCollection(KEYS.day, dayModel, 'dy');
  var DAY_SEED = [
    { time: '07:00', title: 'Wake naturally', detail: 'Quiet morning. Coffee. Nothing frantic.', order: 0 },
    { time: '08:00', title: 'Train', detail: '', order: 1 },
    { time: '09:00', title: 'Shower, breakfast, reading', detail: '', order: 2 },
    { time: '10:00', title: 'Deep creative work', detail: 'Three hours. The only appointment that cannot move.', order: 3 },
    { time: '13:00', title: 'Lunch and a walk', detail: '', order: 4 },
    { time: '15:00', title: 'Business, learning, errands', detail: '', order: 5 },
    { time: '19:00', title: 'People, entertainment, reading', detail: '', order: 6 },
    { time: '22:00', title: 'Wind down', detail: 'Without worrying about waking up for a job I hate.', order: 7 }
  ];

  // ============================================================
  // 7 · STANDARDS — what I accept, as distinct from who I am
  // ============================================================
  function standardModel(x) {
    x = x || {};
    return {
      id: x.id || uid('st'),
      kind: oneOf(x.kind, ['always', 'never'], 'always'),
      text: s(x.text), why: s(x.why),
      order: x.order != null ? x.order : 0, createdAt: x.createdAt || Date.now()
    };
  }
  var Standards = makeCollection(KEYS.standards, standardModel, 'st');
  function standardsOf(kind) { return Standards.sorted().filter(function (x) { return x.kind === kind; }); }
  var STANDARD_SEED = [
    { kind: 'always', text: 'Keep promises to myself.', order: 0 },
    { kind: 'always', text: 'Protect creative time.', order: 1 },
    { kind: 'always', text: 'Keep my environment clean.', order: 2 },
    { kind: 'always', text: 'Take care of my appearance.', order: 3 },
    { kind: 'always', text: 'Train even when motivation is low.', order: 4 },
    { kind: 'never', text: 'Waste entire days scrolling.', order: 0 },
    { kind: 'never', text: 'Stay around people who constantly drain me.', order: 1 },
    { kind: 'never', text: 'Abandon projects because the excitement disappeared.', order: 2 },
    { kind: 'never', text: 'Let temporary emotions dictate long-term decisions.', order: 3 }
  ];

  // ============================================================
  // 8 · QUOTES — core few, full library behind them
  // ============================================================
  var QUOTE_CATEGORIES = ['Identity', 'Discipline', 'Wealth', 'Creativity', 'Life', 'Courage', 'Relationships', 'Spirituality'];
  function quoteModel(q) {
    q = q || {};
    return {
      id: q.id || uid('qt'), text: s(q.text), author: s(q.author),
      category: s(q.category), isCore: !!q.isCore,
      order: q.order != null ? q.order : 0, createdAt: q.createdAt || Date.now()
    };
  }
  var Quotes = makeCollection(KEYS.quotes, quoteModel, 'qt');
  function coreQuotes() { return Quotes.sorted().filter(function (q) { return q.isCore; }); }

  // Exactly one seeded quote, and it is Damian's own line rather than
  // anybody else's — the section is a library he fills, not a set of
  // borrowed epigraphs. It exists so the top of the page is never a
  // blank rectangle on first open.
  var QUOTE_SEED = [{
    text: 'I create for a living, control my time, take care of my body, live beautifully, and build things that outlast me.',
    author: '', category: 'Identity', isCore: true, order: 0
  }];
  /** The quote of the moment: the pinned one, else the first core one. */
  function quoteOfMoment() {
    var st = getSettings();
    var q = st.quoteOfMomentId ? Quotes.get(st.quoteOfMomentId) : null;
    return q || coreQuotes()[0] || Quotes.sorted()[0] || null;
  }

  // ============================================================
  // 9 · FUTURE MEMORIES — written as though they already happened
  // ============================================================
  function memoryModel(m) {
    m = m || {};
    return {
      id: m.id || uid('mem'), title: s(m.title), body: s(m.body),
      imageUrl: s(m.imageUrl), dateText: s(m.dateText),
      emotion: s(m.emotion), whyItMatters: s(m.whyItMatters),
      order: m.order != null ? m.order : 0, createdAt: m.createdAt || Date.now()
    };
  }
  var Memories = makeCollection(KEYS.memories, memoryModel, 'mem');
  var MEMORY_SEED = [
    { title: 'Published my first major bestseller', dateText: 'Autumn, two years from now',
      emotion: 'Disbelief, then something quieter',
      body: 'I remember sitting at my desk refreshing the dashboard and realising thousands of people were reading something that once existed only inside my head.',
      whyItMatters: 'It is the moment the private thing became a real thing.', order: 0 },
    { title: 'First month completely self-employed', dateText: 'A Monday',
      emotion: 'Weightless',
      body: 'I woke up on Monday morning and realised there was nowhere I had to be.',
      whyItMatters: 'Time was the whole point. This is the day I got it back.', order: 1 }
  ];

  // ============================================================
  // 10 · NOTES — deliberately messy, deliberately uncategorised
  //
  // No required fields and no category. Forcing a taxonomy on a
  // scratch area is how a scratch area stops getting used.
  // ============================================================
  function noteModel(n) {
    n = n || {};
    return {
      id: n.id || uid('nt'), text: s(n.text), pinned: !!n.pinned,
      order: n.order != null ? n.order : 0,
      createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || 0
    };
  }
  var Notes = makeCollection(KEYS.notes, noteModel, 'nt');

  // ============================================================
  // 11 · MORE / LESS
  // ============================================================
  function morelessModel(x) {
    x = x || {};
    return {
      id: x.id || uid('ml'),
      side: oneOf(x.side, ['more', 'less'], 'more'),
      text: s(x.text),
      order: x.order != null ? x.order : 0, createdAt: x.createdAt || Date.now()
    };
  }
  var MoreLess = makeCollection(KEYS.moreless, morelessModel, 'ml');
  function morelessOf(side) { return MoreLess.sorted().filter(function (x) { return x.side === side; }); }
  var MORELESS_SEED = [
    ['Creating', 'Consuming'], ['Nature', 'Screens'], ['Strength', 'Comfort'],
    ['Reading', 'Scrolling'], ['Deep work', 'Busy work'], ['Experiences', 'Possessions'],
    ['Confidence', 'Overthinking'], ['Intentional relationships', 'Obligatory relationships']
  ];

  // ============================================================
  // 12 · BECOMING → BEING
  //
  // NOT a scoreboard. There is no percentage and no gap metric here on
  // purpose: the section exists to show where the distance is, and the
  // moment it starts grading the left-hand column it becomes a way to
  // feel bad on a Tuesday.
  // ============================================================
  function dimensionModel(x) {
    x = x || {};
    return {
      id: x.id || uid('dm'), label: s(x.label),
      current: s(x.current), future: s(x.future),
      order: x.order != null ? x.order : 0, createdAt: x.createdAt || Date.now()
    };
  }
  var Dimensions = makeCollection(KEYS.dimensions, dimensionModel, 'dm');
  var DIMENSION_SEED = ['Thinks', 'Works', 'Spends', 'Eats', 'Trains', 'Communicates', 'Creates', 'Handles stress']
    .map(function (l, i) { return { label: l, current: '', future: '', order: i }; });

  // ============================================================
  // 13 · EVIDENCE — the thing that keeps this from being fantasy
  // ============================================================
  function evidenceModel(e) {
    e = e || {};
    return {
      id: e.id || uid('ev'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s(e.date)) ? s(e.date) : todayISO(),
      text: s(e.text),
      traitId: s(e.traitId), areaId: s(e.areaId),
      source: oneOf(e.source, ['manual', 'weeklyreview'], 'manual'),
      order: e.order != null ? e.order : 0, createdAt: e.createdAt || Date.now()
    };
  }
  var Evidence = makeCollection(KEYS.evidence, evidenceModel, 'ev');
  /** Newest first — an evidence feed is read from the top. */
  function evidenceFeed(limit) {
    var all = Evidence.list().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return limit ? all.slice(0, limit) : all;
  }
  /** Used by the Weekly Review, which is the only other writer. */
  function addEvidence(text, opts) {
    opts = opts || {};
    return Evidence.add({
      text: text, date: opts.date || todayISO(),
      traitId: opts.traitId || '', areaId: opts.areaId || '',
      source: opts.source || 'manual'
    });
  }

  // ============================================================
  // 14 · CURRENT FOCUS — the whole vision reduced to five things
  // ============================================================
  function focusModel(f) {
    f = f || {};
    return {
      season: f.season != null ? s(f.season) : '',
      identity: s(f.identity),
      trait: s(f.trait),
      standard: s(f.standard),
      habit: s(f.habit),
      leavingBehind: s(f.leavingBehind),
      startedAt: f.startedAt || 0,
      updatedAt: f.updatedAt || 0
    };
  }
  function getFocus() { return focusModel(storeGet(KEYS.focus, null)); }
  function saveFocus(patch) {
    var n = focusModel(Object.assign({}, getFocus(), patch, { updatedAt: Date.now() }));
    if (!n.startedAt) n.startedAt = Date.now();
    storeSet(KEYS.focus, n); return n;
  }

  // ============================================================
  // 15 · LETTERS TO FUTURE ME
  // ============================================================
  function letterModel(l) {
    l = l || {};
    return {
      id: l.id || uid('lt'), title: s(l.title), body: s(l.body),
      writtenAt: l.writtenAt || Date.now(),
      openAt: s(l.openAt),          // 'YYYY-MM-DD', optional
      openedAt: l.openedAt || 0,
      order: l.order != null ? l.order : 0, createdAt: l.createdAt || Date.now()
    };
  }
  var Letters = makeCollection(KEYS.letters, letterModel, 'lt');
  function lettersNewestFirst() {
    return Letters.list().sort(function (a, b) { return (b.writtenAt || 0) - (a.writtenAt || 0); });
  }
  function letterIsSealed(l) {
    return !!(l.openAt && l.openAt > todayISO() && !l.openedAt);
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  function getSettings() {
    var v = storeGet(KEYS.settings, {}) || {};
    return {
      quoteOfMomentId: s(v.quoteOfMomentId),
      openSection: s(v.openSection)
    };
  }
  function saveSettings(patch) {
    var n = Object.assign({}, getSettings(), patch);
    storeSet(KEYS.settings, n); return n;
  }

  // ============================================================
  // SEEDING
  //
  // NEVER before the cloud pull has resolved — a seeder that runs
  // against a not-yet-hydrated store concludes the device is empty and
  // writes the defaults over real data still arriving.
  // ============================================================
  function isEmpty() {
    return !Traits.list().length && !Areas.list().length &&
           !getIdentity().statements.length && !Standards.list().length;
  }
  function seeded() { return storeGet(KEYS.seeded, false) === true; }

  function seedIfEmpty() {
    if (seeded() || !isEmpty()) return 0;

    BoardCategories.replaceAll(BOARD_SEED.map(function (c, i) {
      return boardCatModel(Object.assign({}, c, { order: i }));
    }));
    Traits.replaceAll(TRAIT_SEED.map(function (t, i) { return traitModel(Object.assign({}, t, { order: i })); }));
    Areas.replaceAll(AREA_SEED.map(areaModel));
    Day.replaceAll(DAY_SEED.map(dayModel));
    Standards.replaceAll(STANDARD_SEED.map(standardModel));
    Memories.replaceAll(MEMORY_SEED.map(memoryModel));
    Quotes.replaceAll(QUOTE_SEED.map(quoteModel));
    Dimensions.replaceAll(DIMENSION_SEED.map(dimensionModel));
    MoreLess.replaceAll(MORELESS_SEED.reduce(function (acc, pair, i) {
      acc.push(morelessModel({ side: 'more', text: pair[0], order: i }));
      acc.push(morelessModel({ side: 'less', text: pair[1], order: i }));
      return acc;
    }, []));
    saveIdentity({
      statements: IDENTITY_SEED.map(function (t, i) { return { id: uid('idn'), text: t, order: i }; })
    });

    storeSet(KEYS.seeded, true);
    return 1;
  }

  // ============================================================
  // MIGRATION — system:vision, the eight fields from the retired
  // Subconscious Reprogramming tab.
  //
  // Mapped onto the sections that actually own them rather than parked
  // in an `fs:vision` museum piece. Read-only against `system:vision`:
  // it is never written back and never deleted, exactly as
  // palaestra-data.js's own one-time import treats `fitness:`.
  //
  // Idempotent, guarded by fs:migratedSystemVision, and the raw eight
  // are kept verbatim inside that guard so the original survives even
  // if the derived fields are later edited.
  // ============================================================
  function readSystemVision() {
    var v = storeGet('system:vision', null);
    if (!v || typeof v !== 'object') return null;
    var any = ['surroundedBy', 'howYouCarryYourself', 'schedule', 'work', 'hobbies', 'othersSay', 'freeTime', 'afraidToAdmit']
      .some(function (k) { return s(v[k]).trim(); });
    return any ? v : null;
  }
  function visionMigrated() { return !!storeGet(KEYS.migrated, null); }

  function migrateSystemVision(force) {
    if (visionMigrated() && !force) return { ran: false, reason: 'already migrated' };
    var v = readSystemVision();
    if (!v) return { ran: false, reason: 'nothing to import' };

    var moved = [];

    function appendArea(areaKey, text, label) {
      if (!s(text).trim()) return;
      var a = areaFor(areaKey);
      var addition = (label ? label + '\n' : '') + s(text).trim();
      if (a) {
        Areas.update(a.id, { body: a.body ? a.body + '\n\n' + addition : addition });
      } else {
        Areas.add({ area: areaKey, headline: '', body: addition });
      }
      moved.push(areaKey);
    }

    appendArea('environment', v.surroundedBy, 'What I am surrounded by');
    appendArea('work', v.work);
    appendArea('lifestyle', v.hobbies, 'Hobbies');
    appendArea('lifestyle', v.freeTime, 'Free time');

    ['howYouCarryYourself', 'othersSay'].forEach(function (k) {
      if (s(v[k]).trim()) { addStatement(s(v[k]).trim()); moved.push(k); }
    });

    if (s(v.schedule).trim()) {
      Day.add({ time: '', title: 'The shape of the day', detail: s(v.schedule).trim(), order: -1 });
      moved.push('schedule');
    }

    // The one you were too afraid to admit belongs in the messy area,
    // not in a labelled field on a public-facing card.
    if (s(v.afraidToAdmit).trim()) {
      Notes.add({ text: s(v.afraidToAdmit).trim(), pinned: true });
      moved.push('afraidToAdmit');
    }

    storeSet(KEYS.migrated, { at: Date.now(), source: 'system:vision', moved: moved, raw: v });
    return { ran: true, moved: moved };
  }

  global.FutureSelfData = {
    KEYS: KEYS, todayISO: todayISO, uid: uid,

    getHero: getHero, saveHero: saveHero,

    BOARD_SEED: BOARD_SEED,
    BoardCategories: BoardCategories, BoardImages: BoardImages,
    imagesIn: imagesIn, mainCollage: mainCollage,

    getIdentity: getIdentity, saveIdentity: saveIdentity,
    addStatement: addStatement, removeStatement: removeStatement,

    TRAIT_BANDS: TRAIT_BANDS, Traits: Traits, traitsIn: traitsIn,

    AREAS: AREAS, Areas: Areas, areaFor: areaFor,

    Day: Day,
    Standards: Standards, standardsOf: standardsOf,
    QUOTE_CATEGORIES: QUOTE_CATEGORIES, Quotes: Quotes,
    coreQuotes: coreQuotes, quoteOfMoment: quoteOfMoment,
    Memories: Memories,
    Notes: Notes,
    MoreLess: MoreLess, morelessOf: morelessOf,
    Dimensions: Dimensions,
    Evidence: Evidence, evidenceFeed: evidenceFeed, addEvidence: addEvidence,
    getFocus: getFocus, saveFocus: saveFocus,
    Letters: Letters, lettersNewestFirst: lettersNewestFirst, letterIsSealed: letterIsSealed,

    getSettings: getSettings, saveSettings: saveSettings,

    isEmpty: isEmpty, seeded: seeded, seedIfEmpty: seedIfEmpty,
    readSystemVision: readSystemVision, visionMigrated: visionMigrated,
    migrateSystemVision: migrateSystemVision
  };
})(window);
