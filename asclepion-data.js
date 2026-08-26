// =============================================================
// asclepion-data.js — the data layer for The Asclepion.
//
//   window.Asc
//
// Loaded by asclepion.html, asclepion-session.html and
// asclepion-journal.html. Machinery only: every word of actual
// content lives in asclepion-seed.js (window.AscSeed), which must
// be loaded BEFORE this file.
//
// =============================================================
// TWO ROWS, SPLIT BY WEIGHT
//
//   asc:     the library     — read-mostly, large, seeded
//   asclog:  what you write  — small records, written constantly
//
// sync.js's pushNow() uploads a row's ENTIRE data column on every
// debounced save. The seeded library is ~200KB; on one row, every
// journal keystroke batch would re-upload all of it. Same split,
// same reason, as kdpms: out of kdp:.
//
// The prefix table itself is asclepion-sync.js, not this file —
// three documents must never be able to drift into three
// different prefix lists.
// =============================================================
// THE MODEL IS A WHITELIST
//
// Every model() below is re-run by update() on every edit, and it
// returns a fixed set of fields. A field written by a caller but
// absent from the model is silently dropped the next time that
// record is touched. Add fields to the MODEL, never only at a
// call site. This is the house convention (palaestra-data.js,
// athenaeum-data.js) and it is what keeps records from rotting.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // Store
  // ------------------------------------------------------------
  function storeGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      global.dispatchEvent(new CustomEvent('asc:save', { detail: { key: key, ok: true } }));
      return true;
    } catch (e) {
      global.dispatchEvent(new CustomEvent('asc:save', { detail: { key: key, ok: false, error: e } }));
      return false;
    }
  }

  // ------------------------------------------------------------
  // Primitives
  // ------------------------------------------------------------
  function uid(p) {
    return (p || 'a') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function str(v, max) {
    var s = v == null ? '' : String(v);
    return max ? s.slice(0, max) : s;
  }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function oneOf(v, list, d) { return list.indexOf(v) !== -1 ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function strList(v, max, cap) {
    return arr(v).slice(0, cap || 40).map(function (s) { return str(s, max || 400); })
      .filter(function (s) { return s !== ''; });
  }

  // DATES ARE LOCAL, NEVER UTC. toISOString() is banned in this
  // repo for exactly one reason: at 21:00 in Berlin it already
  // reads tomorrow, so an entry written on Tuesday evening files
  // itself under Wednesday.
  function localISO(d) {
    var t = d instanceof Date ? d : new Date();
    var m = String(t.getMonth() + 1), day = String(t.getDate());
    return t.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
  function today() { return localISO(); }
  function isISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

  // ------------------------------------------------------------
  // Keys
  // ------------------------------------------------------------
  var MEDIA_SHELVES = ['meditation', 'visualization', 'hypnosis', 'breathmed', 'walking'];

  var KEYS = {
    // --- asc: the library --------------------------------------
    breath:       'asc:breath',
    eft:          'asc:eft',
    eftPoints:    'asc:eftpoints',
    journals:     'asc:journals',
    yoga:         'asc:yoga',
    energy:       'asc:energy',
    decks:        'asc:decks',
    affirmations: 'asc:affirmations',
    routines:     'asc:routines',
    todayPick:    'asc:today',
    uiState:      'asc:uiState',
    settings:     'asc:settings',
    seededAt:     'asc:seededAt',
    // The goal and the three actions: set once, changed rarely.
    hia:          'asc:hia',
    // --- asclog: what you write --------------------------------
    entries:      'asclog:entries',
    sessions:     'asclog:sessions',
    live:         'asclog:live',
    // One mark per day. On the LOG row, not the library row,
    // because it is written every single day and the library is
    // 100KB that would be re-uploaded with it.
    hiaMarks:     'asclog:hiamarks'
  };
  function mediaKey(shelf) { return 'asc:media:' + shelf; }

  // ------------------------------------------------------------
  // makeCollection — one array per key, the house recipe.
  // ------------------------------------------------------------
  function makeCollection(key, model, idPrefix) {
    function list() { return arr(storeGet(key)).map(model); }
    function replaceAll(next) { storeSet(key, arr(next).map(model)); return list(); }
    function get(id) {
      var all = list();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    }
    function add(fields) {
      var all = list();
      var rec = model(Object.assign({ id: uid(idPrefix || 'a'), order: all.length }, fields || {}));
      all.push(rec);
      storeSet(key, all);
      return rec;
    }
    function update(id, patch) {
      var all = list(), hit = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].id !== id) continue;
        // The whitelist re-runs here. See the header.
        all[i] = model(Object.assign({}, all[i], patch || {}, { id: id }));
        hit = all[i];
      }
      if (hit) storeSet(key, all);
      return hit;
    }
    function remove(id) {
      var all = list(), next = all.filter(function (r) { return r.id !== id; });
      if (next.length === all.length) return false;
      storeSet(key, next);
      return true;
    }
    // Order is array position, not a sort field — the same choice
    // palaestra-data.js makes, so a reorder is a splice and can
    // never leave two records claiming the same slot.
    function move(id, dir) {
      var all = list();
      var i = all.findIndex(function (r) { return r.id === id; });
      if (i < 0) return false;
      var j = i + (dir < 0 ? -1 : 1);
      if (j < 0 || j >= all.length) return false;
      var tmp = all[i]; all[i] = all[j]; all[j] = tmp;
      all.forEach(function (r, n) { r.order = n; });
      storeSet(key, all);
      return true;
    }
    function toggleFav(id) {
      var r = get(id);
      if (!r) return null;
      return update(id, { favorite: !r.favorite });
    }
    return {
      key: key, list: list, get: get, add: add, update: update,
      remove: remove, move: move, replaceAll: replaceAll, toggleFav: toggleFav,
      nextOrder: function () { return list().length; }
    };
  }

  // ============================================================
  // MODELS
  // ============================================================

  // --- BREATH -------------------------------------------------
  // ROUNDS OF PHASES, not four fixed fields.
  //
  // The old model (mainselfcare-data.js) was
  // {inhaleSec, holdSec, exhaleSec, hold2Sec, cycles}. It cannot
  // express three of the five techniques this page has to carry:
  // the physiological sigh needs TWO CONSECUTIVE INHALES, and
  // Vortex Breath is five descending rounds with different
  // timings in each. A fixed four-slot record has nowhere to put
  // either, so the shape had to change before anything else could
  // be built on it.
  //
  // seconds: 0 means SELF-PACED — the pacer holds that phase until
  // you tap. That is how "inhale as much as you can" is stored
  // without lying about a duration.
  var PHASE_KINDS = ['inhale', 'hold', 'exhale', 'holdOut'];
  var BREATH_GOALS = ['Calm', 'Sleep', 'Focus', 'In the moment', 'Energy'];

  function phaseModel(p) {
    p = p || {};
    return {
      kind:    oneOf(p.kind, PHASE_KINDS, 'inhale'),
      seconds: clamp(Math.round(num(p.seconds, 4)), 0, 90),
      route:   oneOf(p.route, ['nose', 'mouth', ''], ''),
      force:   p.force === true,
      note:    str(p.note, 140)
    };
  }
  function roundModel(r) {
    r = r || {};
    return {
      id:     str(r.id, 60) || uid('rnd'),
      label:  str(r.label, 60),
      cycles: clamp(Math.round(num(r.cycles, 1)), 1, 60),
      phases: arr(r.phases).slice(0, 10).map(phaseModel)
    };
  }
  function breathModel(b) {
    b = b || {};
    return {
      id:       str(b.id, 60) || uid('brt'),
      name:     str(b.name, 90),
      summary:  str(b.summary, 400),
      why:      str(b.why, 1200),
      cues:     strList(b.cues, 240, 12),
      goal:     oneOf(b.goal, BREATH_GOALS, 'Calm'),
      rounds:   arr(b.rounds).slice(0, 12).map(roundModel),
      favorite: b.favorite === true,
      order:    Math.round(num(b.order, 0)),
      builtin:  b.builtin === true,
      createdAt: Math.round(num(b.createdAt, Date.now()))
    };
  }

  // How long one run of a technique takes, in seconds. Derived,
  // never stored — a stored duration goes stale the moment a
  // phase is edited. A self-paced phase (0s) is counted as 4s so
  // the estimate stays honest rather than reading as instant.
  function breathSeconds(b) {
    return arr(b && b.rounds).reduce(function (total, r) {
      var per = arr(r.phases).reduce(function (s, p) { return s + (p.seconds || 4); }, 0);
      return total + per * (r.cycles || 1);
    }, 0);
  }

  // --- EFT ----------------------------------------------------
  function eftPointModel(p) {
    p = p || {};
    return {
      id:    str(p.id, 60) || uid('pt'),
      key:   str(p.key, 12),
      n:     Math.round(num(p.n, 0)),
      name:  str(p.name, 60),
      where: str(p.where, 300),
      cue:   str(p.cue, 300),
      photo: str(p.photo, 900),   // optional, via PhotoStore
      order: Math.round(num(p.order, 0))
    };
  }
  function tapLineModel(l) {
    l = l || {};
    return { point: str(l.point, 12), phrase: str(l.phrase, 400) };
  }
  function eftTopicModel(t) {
    t = t || {};
    return {
      id:       str(t.id, 60) || uid('eft'),
      name:     str(t.name, 80),
      blurb:    str(t.blurb, 400),
      setup:    strList(t.setup, 400, 5),
      round1:   arr(t.round1).slice(0, 12).map(tapLineModel),
      round2:   arr(t.round2).slice(0, 12).map(tapLineModel),
      reframe:  arr(t.reframe).slice(0, 12).map(tapLineModel),
      closing:  str(t.closing, 600),
      favorite: t.favorite === true,
      order:    Math.round(num(t.order, 0)),
      builtin:  t.builtin === true
    };
  }

  // --- JOURNALS -----------------------------------------------
  // A journal is a DEFINITION (its purpose and its sections); an
  // entry is one filling-in of one definition. Keeping them apart
  // is what lets the 3/3/3 journal have three fixed triples and
  // the Muse have none, without either one being a special case.
  function journalSectionModel(s) {
    s = s || {};
    return {
      id:     str(s.id, 60) || uid('jsec'),
      label:  str(s.label, 160),
      prompt: str(s.prompt, 600),
      lines:  clamp(Math.round(num(s.lines, 0)), 0, 12),  // 0 = one open field; n = n numbered lines
      order:  Math.round(num(s.order, 0))
    };
  }
  function journalModel(j) {
    j = j || {};
    return {
      id:       str(j.id, 60) || uid('jnl'),
      key:      str(j.key, 40),
      name:     str(j.name, 80),
      glyph:    str(j.glyph, 8),
      purpose:  str(j.purpose, 600),
      // A journal may carry a WORKING SYSTEM above its entries.
      // Only 'hia' exists so far — the High Impact Action method,
      // which is a goal, three actions and a tracker rather than
      // just a set of prompts. Anything unrecognised renders as an
      // ordinary journal, so a future value can never blank a page.
      system:   oneOf(j.system, ['', 'hia'], ''),
      about:    str(j.about, 9000),
      // Diagrams belonging to `about`, each anchored to a § marker
      // inside it. Optional, and empty for every ordinary journal.
      figures:  arr(j.figures).slice(0, 8).map(function (f) {
        f = f || {};
        return { after: str(f.after, 8), src: str(f.src, 300), caption: str(f.caption, 400) };
      }),
      sections: arr(j.sections).slice(0, 20).map(journalSectionModel),
      favorite: j.favorite === true,
      order:    Math.round(num(j.order, 0)),
      builtin:  j.builtin === true
    };
  }
  function entrySectionModel(s) {
    s = s || {};
    return {
      id:    str(s.id, 60) || uid('esec'),
      label: str(s.label, 160),
      body:  str(s.body, 20000),
      lines: arr(s.lines).slice(0, 12).map(function (l) { return str(l, 600); }),
      order: Math.round(num(s.order, 0))
    };
  }
  function entryModel(e) {
    e = e || {};
    return {
      id:        str(e.id, 60) || uid('ent'),
      journalId: str(e.journalId, 60),
      date:      isISO(str(e.date)) ? str(e.date) : today(),
      title:     str(e.title, 200),
      sections:  arr(e.sections).slice(0, 24).map(entrySectionModel),
      favorite:  e.favorite === true,
      createdAt: Math.round(num(e.createdAt, Date.now())),
      updatedAt: Math.round(num(e.updatedAt, Date.now()))
    };
  }

  // --- MEDIA (meditation & hypnosis) --------------------------
  // Linked, never stored. url is canonical, cover is a thumbnail
  // URL. No blobs — the Vault's rule, and the reason its 330KB of
  // records is 330KB and not 3GB.
  function mediaModel(m) {
    m = m || {};
    return {
      id:          str(m.id, 60) || uid('med'),
      title:       str(m.title, 200),
      teacher:     str(m.teacher, 120),
      url:         str(m.url, 900),
      cover:       str(m.cover, 900),
      description: str(m.description, 1200),
      minutes:     clamp(Math.round(num(m.minutes, 0)), 0, 600),
      forWhen:     str(m.forWhen, 200),
      favorite:    m.favorite === true,
      openCount:   Math.round(num(m.openCount, 0)),
      lastOpenedAt: m.lastOpenedAt == null ? null : Math.round(num(m.lastOpenedAt, 0)),
      order:       Math.round(num(m.order, 0)),
      builtin:     m.builtin === true,
      createdAt:   Math.round(num(m.createdAt, Date.now()))
    };
  }

  // --- YOGA ---------------------------------------------------
  var YOGA_CATEGORIES = ['morning', 'evening', 'mobility', 'stretching', 'yin', 'restorative', 'somatic'];
  function yogaModel(y) {
    y = y || {};
    return {
      id:          str(y.id, 60) || uid('yog'),
      title:       str(y.title, 200),
      category:    oneOf(y.category, YOGA_CATEGORIES, 'mobility'),
      feelings:    strList(y.feelings, 30, 8),
      minutes:     clamp(Math.round(num(y.minutes, 0)), 0, 300),
      url:         str(y.url, 900),
      cover:       str(y.cover, 900),
      description: str(y.description, 1200),
      favorite:    y.favorite === true,
      openCount:   Math.round(num(y.openCount, 0)),
      lastOpenedAt: y.lastOpenedAt == null ? null : Math.round(num(y.lastOpenedAt, 0)),
      order:       Math.round(num(y.order, 0)),
      builtin:     y.builtin === true
    };
  }

  // --- ENERGY -------------------------------------------------
  var ENERGY_GROUPS = ['grounding', 'cleansing', 'protection', 'energywork', 'stateshift'];
  function energyModel(e) {
    e = e || {};
    return {
      id:       str(e.id, 60) || uid('eng'),
      group:    oneOf(e.group, ENERGY_GROUPS, 'grounding'),
      title:    str(e.title, 160),
      summary:  str(e.summary, 600),
      steps:    strList(e.steps, 700, 16),
      minutes:  clamp(Math.round(num(e.minutes, 0)), 0, 120),
      favorite: e.favorite === true,
      order:    Math.round(num(e.order, 0)),
      builtin:  e.builtin === true
    };
  }

  // --- AFFIRMATIONS -------------------------------------------
  // Decks and lines are separate collections joined by deckId, so
  // "My Deck" is just a deck with isPersonal:true rather than a
  // second mechanism bolted on beside the built-in ones.
  function deckModel(d) {
    d = d || {};
    return {
      id:         str(d.id, 60) || uid('dck'),
      key:        str(d.key, 40),
      name:       str(d.name, 80),
      blurb:      str(d.blurb, 400),
      isPersonal: d.isPersonal === true,
      favorite:   d.favorite === true,
      order:      Math.round(num(d.order, 0)),
      builtin:    d.builtin === true
    };
  }
  function affirmationModel(a) {
    a = a || {};
    return {
      id:        str(a.id, 60) || uid('aff'),
      deckId:    str(a.deckId, 60),
      text:      str(a.text, 400),
      favorite:  a.favorite === true,
      order:     Math.round(num(a.order, 0)),
      builtin:   a.builtin === true,
      createdAt: Math.round(num(a.createdAt, Date.now()))
    };
  }

  // --- ROUTINES -----------------------------------------------
  // A step's `kind` names which collection `refId` points into.
  // 'free' is a step with no reference at all — "drink water",
  // "go for a five minute walk" — which is why the Bad Day
  // Protocol can be a real routine rather than a note.
  var STEP_KINDS = ['breath', 'eft', 'meditation', 'yoga', 'energy', 'journal', 'affirmation', 'free'];
  function routineStepModel(s) {
    s = s || {};
    return {
      id:      str(s.id, 60) || uid('stp'),
      kind:    oneOf(s.kind, STEP_KINDS, 'free'),
      refId:   str(s.refId, 60),
      shelf:   str(s.shelf, 30),      // meditation steps only
      label:   str(s.label, 200),
      minutes: clamp(Math.round(num(s.minutes, 0)), 0, 180),
      note:    str(s.note, 600)
    };
  }
  function routineModel(r) {
    r = r || {};
    return {
      id:       str(r.id, 60) || uid('rtn'),
      name:     str(r.name, 100),
      forWhen:  str(r.forWhen, 400),
      tint:     oneOf(r.tint, ['breath', 'journal', 'eft', 'medit', 'yoga', 'energy', 'affirm'], 'breath'),
      steps:    arr(r.steps).slice(0, 24).map(routineStepModel),
      favorite: r.favorite === true,
      order:    Math.round(num(r.order, 0)),
      builtin:  r.builtin === true
    };
  }

  // --- SESSIONS (the log) -------------------------------------
  // One shape for every kind of practice, because the only
  // questions ever asked of it are "what did I do" and "did it
  // help". before/after are the 0-10 intensity readings; they stay
  // null for practices that do not ask.
  var SESSION_KINDS = ['breath', 'eft', 'meditation', 'yoga', 'energy', 'routine'];
  function sessionModel(s) {
    s = s || {};
    return {
      id:      str(s.id, 60) || uid('ses'),
      kind:    oneOf(s.kind, SESSION_KINDS, 'breath'),
      refId:   str(s.refId, 60),
      title:   str(s.title, 200),
      date:    isISO(str(s.date)) ? str(s.date) : today(),
      before:  s.before == null ? null : clamp(Math.round(num(s.before, 0)), 0, 10),
      after:   s.after == null ? null : clamp(Math.round(num(s.after, 0)), 0, 10),
      note:    str(s.note, 2000),
      startedAt: Math.round(num(s.startedAt, Date.now())),
      endedAt:   s.endedAt == null ? null : Math.round(num(s.endedAt, 0))
    };
  }

  // ============================================================
  // COLLECTIONS
  // ============================================================
  var Breath       = makeCollection(KEYS.breath, breathModel, 'brt');
  var Eft          = makeCollection(KEYS.eft, eftTopicModel, 'eft');
  var EftPoints    = makeCollection(KEYS.eftPoints, eftPointModel, 'pt');
  var Journals     = makeCollection(KEYS.journals, journalModel, 'jnl');
  var Yoga         = makeCollection(KEYS.yoga, yogaModel, 'yog');
  var Energy       = makeCollection(KEYS.energy, energyModel, 'eng');
  var Decks        = makeCollection(KEYS.decks, deckModel, 'dck');
  var Affirmations = makeCollection(KEYS.affirmations, affirmationModel, 'aff');
  var Routines     = makeCollection(KEYS.routines, routineModel, 'rtn');
  var Entries      = makeCollection(KEYS.entries, entryModel, 'ent');
  var Sessions     = makeCollection(KEYS.sessions, sessionModel, 'ses');

  // One collection per media shelf, so a shelf is part of the KEY
  // rather than a field on the record — the Vault's arrangement.
  // It makes "everything on this shelf" a single read instead of
  // a filter over the whole library.
  var Media = {};
  MEDIA_SHELVES.forEach(function (shelf) {
    Media[shelf] = makeCollection(mediaKey(shelf), mediaModel, 'med');
  });
  function mediaShelf(shelf) { return Media[shelf] || null; }
  function mediaAll() {
    var out = [];
    MEDIA_SHELVES.forEach(function (shelf) {
      Media[shelf].list().forEach(function (r) { r._shelf = shelf; out.push(r); });
    });
    return out;
  }

  // ============================================================
  // FAVOURITES — a boolean on the record, swept across
  // collections. There is no favourites index, on purpose: a
  // second list of ids is a second source of truth that has to be
  // kept in step with every deletion, and it never is.
  // ============================================================
  var FAV_SOURCES = [
    { kind: 'breath',     tint: 'breath', label: 'Breath',        coll: function () { return Breath.list(); },  title: function (r) { return r.name; } },
    { kind: 'eft',        tint: 'eft',    label: 'Tapping',       coll: function () { return Eft.list(); },     title: function (r) { return r.name; } },
    { kind: 'journal',    tint: 'journal', label: 'Journal',      coll: function () { return Journals.list(); }, title: function (r) { return r.name; } },
    { kind: 'yoga',       tint: 'yoga',   label: 'Movement',      coll: function () { return Yoga.list(); },    title: function (r) { return r.title; } },
    { kind: 'energy',     tint: 'energy', label: 'Energy',        coll: function () { return Energy.list(); },  title: function (r) { return r.title; } },
    { kind: 'affirmation', tint: 'affirm', label: 'Affirmation',  coll: function () { return Affirmations.list(); }, title: function (r) { return r.text; } },
    { kind: 'routine',    tint: 'breath', label: 'Routine',       coll: function () { return Routines.list(); }, title: function (r) { return r.name; } }
  ];

  function favourites() {
    var out = [];
    FAV_SOURCES.forEach(function (src) {
      src.coll().forEach(function (r) {
        if (!r.favorite) return;
        out.push({ kind: src.kind, tint: src.tint, label: src.label, id: r.id, title: src.title(r), rec: r });
      });
    });
    mediaAll().forEach(function (r) {
      if (!r.favorite) return;
      out.push({ kind: 'meditation', tint: 'medit', label: SHELF_LABELS[r._shelf] || 'Meditation',
                 id: r.id, shelf: r._shelf, title: r.title, rec: r });
    });
    return out;
  }
  function favouriteCount() { return favourites().length; }

  // A single toggle every renderer can call without knowing which
  // collection a thing lives in. The alternative is seven
  // near-identical click handlers, and the seventh is always the
  // one that forgets to repaint.
  function toggleFavourite(kind, id, shelf) {
    switch (kind) {
      case 'breath':      return Breath.toggleFav(id);
      case 'eft':         return Eft.toggleFav(id);
      case 'journal':     return Journals.toggleFav(id);
      case 'yoga':        return Yoga.toggleFav(id);
      case 'energy':      return Energy.toggleFav(id);
      case 'affirmation': return Affirmations.toggleFav(id);
      case 'routine':     return Routines.toggleFav(id);
      case 'meditation':  return Media[shelf] ? Media[shelf].toggleFav(id) : null;
      case 'entry':       return Entries.toggleFav(id);
      default: return null;
    }
  }

  var SHELF_LABELS = {
    meditation:    'Meditation',
    visualization: 'Guided visualization',
    hypnosis:      'Hypnosis',
    breathmed:     'Breath meditation',
    walking:       'Walking meditation'
  };

  // ============================================================
  // TODAY'S AFFIRMATION
  //
  // The pick is STABLE THROUGH THE DAY — it is stored against a
  // date, not re-rolled on every render, because a line that
  // changes each time you glance at the page is a line you never
  // actually read. "New affirmation" re-rolls it deliberately,
  // and `seen` keeps the next few draws from repeating.
  // ============================================================
  function readTodayPick() {
    var o = storeGet(KEYS.todayPick);
    if (!o || typeof o !== 'object') return { date: '', affirmationId: '', seen: [] };
    return {
      date: isISO(str(o.date)) ? str(o.date) : '',
      affirmationId: str(o.affirmationId, 60),
      seen: arr(o.seen).slice(-40).map(function (s) { return str(s, 60); })
    };
  }
  function pool() {
    var all = Affirmations.list();
    // A personal deck, once it has anything in it, is what you
    // actually want to hear — but not to the exclusion of
    // everything else, so it is weighted, not exclusive.
    return all.length ? all : [];
  }
  function rollAffirmation(force) {
    var pick = readTodayPick();
    var all = pool();
    if (!all.length) return null;
    if (!force && pick.date === today() && pick.affirmationId) {
      var held = Affirmations.get(pick.affirmationId);
      if (held) return held;
    }
    var seen = pick.seen || [];
    var fresh = all.filter(function (a) { return seen.indexOf(a.id) === -1; });
    var from = fresh.length ? fresh : all;
    var chosen = from[Math.floor(Math.random() * from.length)];
    storeSet(KEYS.todayPick, {
      date: today(),
      affirmationId: chosen.id,
      seen: seen.concat([chosen.id]).slice(-40)
    });
    return chosen;
  }
  function todaysAffirmation() { return rollAffirmation(false); }
  function newAffirmation() { return rollAffirmation(true); }

  // ============================================================
  // THE LIVE ROUTINE
  //
  // Same shape and the same reason as pal:live: a routine can send
  // you to another document (a journal step opens
  // asclepion-journal.html) and it has to still be running when
  // you come back. It lives on the LOG row, not the library row —
  // it is written constantly and it is not part of the library.
  // ============================================================
  function getLive() {
    var o = storeGet(KEYS.live);
    if (!o || typeof o !== 'object' || !o.routineId) return null;
    var r = Routines.get(str(o.routineId, 60));
    if (!r) { clearLive(); return null; }   // the routine was deleted under it
    return {
      routineId: r.id,
      stepIndex: clamp(Math.round(num(o.stepIndex, 0)), 0, Math.max(0, r.steps.length - 1)),
      done: arr(o.done).map(function (s) { return str(s, 60); }),
      startedAt: Math.round(num(o.startedAt, Date.now()))
    };
  }
  function setLive(patch) {
    var cur = getLive() || { routineId: '', stepIndex: 0, done: [], startedAt: Date.now() };
    storeSet(KEYS.live, Object.assign(cur, patch || {}));
    return getLive();
  }
  function startRoutine(routineId) {
    var r = Routines.get(routineId);
    if (!r) return null;
    storeSet(KEYS.live, { routineId: r.id, stepIndex: 0, done: [], startedAt: Date.now() });
    return getLive();
  }
  function clearLive() { try { localStorage.removeItem(KEYS.live); } catch (e) {} }

  // ============================================================
  // SESSIONS — the log, kept to a horizon.
  //
  // 730 days, the same horizon palaestra-data.js keeps for its own
  // per-date log. The row is re-uploaded whole on every write, so
  // an unbounded log is an unbounded upload.
  // ============================================================
  function logSession(fields) {
    var rec = Sessions.add(Object.assign({ startedAt: Date.now(), endedAt: Date.now() }, fields || {}));
    trimSessions();
    return rec;
  }
  function trimSessions() {
    var all = Sessions.list();
    if (all.length <= 1200) return;
    all.sort(function (a, b) { return (a.startedAt || 0) - (b.startedAt || 0); });
    Sessions.replaceAll(all.slice(all.length - 1200));
  }
  function sessionsOn(dateISO) {
    var d = isISO(dateISO) ? dateISO : today();
    return Sessions.list().filter(function (s) { return s.date === d; });
  }
  function recentSessions(limit) {
    return Sessions.list()
      .sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); })
      .slice(0, limit || 12);
  }
  /** The most recent session against one practice, or null. */
  function lastSessionFor(kind, refId) {
    var best = null;
    Sessions.list().forEach(function (s) {
      if (s.kind !== kind || s.refId !== refId) return;
      if (!best || (s.startedAt || 0) > (best.startedAt || 0)) best = s;
    });
    return best;
  }

  // ============================================================
  // UI STATE
  //
  // Small, remembered preferences that are not data — which panel
  // you left open, which filter you were on. One key rather than
  // one per preference, because these are worth remembering and
  // not worth a collection each.
  //
  // Read with uiState(k), write with uiState(k, v).
  // ============================================================
  function uiState(key, value) {
    var o = storeGet(KEYS.uiState);
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    if (arguments.length < 2) return o[key];
    o[key] = value;
    storeSet(KEYS.uiState, o);
    return value;
  }

  // ============================================================
  // THE HIGH IMPACT ACTION SYSTEM
  //
  // A goal, at most three actions, and thirty squares.
  //
  // The cap of three is the method, not a UI limit: "aim for no
  // more than 3", because the whole point is to convert a goal
  // that feels hard into a handful of habits that feel easy. Four
  // actions is a to-do list again. It is enforced here rather
  // than only in the view, so no caller can route around it.
  //
  // NEVER SKIP TWICE is derived, never stored — see
  // neverSkipTwice(). A stored flag would go stale at midnight.
  // ============================================================
  var HIA_SYMBOLS = ['✓', '✕', '●', '◆', '★', '✻'];

  function hiaActionModel(a) {
    a = a || {};
    return { id: str(a.id, 60) || uid('hia'), text: str(a.text, 200) };
  }
  function getHia() {
    var o = storeGet(KEYS.hia) || {};
    return {
      goal:      str(o.goal, 300),
      actions:   arr(o.actions).slice(0, 3).map(hiaActionModel),
      symbol:    str(o.symbol, 4) || '✓',
      startedAt: isISO(str(o.startedAt)) ? str(o.startedAt) : today()
    };
  }
  function setHia(patch) {
    var cur = getHia();
    var next = Object.assign(cur, patch || {});
    // The cap again, at the write. A patch is just as capable of
    // carrying four actions as a caller is.
    next.actions = arr(next.actions).slice(0, 3).map(hiaActionModel);
    storeSet(KEYS.hia, next);
    return getHia();
  }
  function addHiaAction(text) {
    var h = getHia();
    if (h.actions.length >= 3) return null;
    h.actions.push(hiaActionModel({ text: text || '' }));
    setHia({ actions: h.actions });
    return h.actions[h.actions.length - 1];
  }
  function removeHiaAction(id) {
    var h = getHia();
    setHia({ actions: h.actions.filter(function (a) { return a.id !== id; }) });
  }

  function getMarks() {
    var o = storeGet(KEYS.hiaMarks);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    var out = {};
    Object.keys(o).forEach(function (k) {
      if (!isISO(k)) return;
      var v = oneOf(o[k], ['done', 'missed'], '');
      if (v) out[k] = v;
    });
    return out;
  }
  function markDay(dateISO, state) {
    var d = isISO(dateISO) ? dateISO : today();
    var marks = getMarks();
    if (!state) delete marks[d];
    else marks[d] = oneOf(state, ['done', 'missed'], 'done');
    storeSet(KEYS.hiaMarks, marks);
    return marks;
  }
  /** done -> missed -> clear -> done. One control, three states. */
  function cycleDay(dateISO) {
    var marks = getMarks();
    var cur = marks[dateISO] || '';
    return markDay(dateISO, cur === '' ? 'done' : cur === 'done' ? 'missed' : '');
  }

  function addDays(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return localISO(d);
  }

  /**
   * The thirty squares, oldest first, each carrying everything the
   * view needs. Derived on every read: a stored grid would be one
   * day stale from the first midnight onward.
   *
   * `twice` marks the SECOND of two consecutive misses — the exact
   * thing the method says never to do, so it is the thing the grid
   * draws differently.
   */
  function hiaGrid(days) {
    var n = days || 30;
    var marks = getMarks();
    var t = today();
    var start = addDays(t, -(n - 1));
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = addDays(start, i);
      var prev = addDays(d, -1);
      out.push({
        date: d,
        state: marks[d] || '',
        isToday: d === t,
        isFuture: d > t,
        twice: marks[d] === 'missed' && marks[prev] === 'missed'
      });
    }
    return out;
  }

  /**
   * "You are one miss from breaking it." True when yesterday was
   * missed and today has not been marked yet — the one moment the
   * warning is actionable, which is why it is not simply "you
   * missed yesterday".
   */
  function neverSkipTwice() {
    var marks = getMarks();
    var t = today();
    if (marks[t]) return false;
    return marks[addDays(t, -1)] === 'missed';
  }

  /** How many days in a row, ending today or yesterday, are done. */
  function hiaStreak() {
    var marks = getMarks();
    var d = today();
    if (!marks[d]) d = addDays(d, -1);
    var n = 0;
    while (marks[d] === 'done') { n++; d = addDays(d, -1); }
    return n;
  }

  // ============================================================
  // ENTRIES
  // ============================================================
  function entriesFor(journalId) {
    return Entries.list()
      .filter(function (e) { return !journalId || e.journalId === journalId; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }
  // A blank entry built from its journal's own section definitions,
  // so the template is the journal rather than a second copy of it
  // living in the entry code.
  function blankEntry(journalId) {
    var j = Journals.get(journalId);
    if (!j) return null;
    return {
      journalId: j.id,
      date: today(),
      title: '',
      sections: j.sections.map(function (s, i) {
        return {
          id: uid('esec'),
          label: s.label,
          body: '',
          lines: s.lines ? new Array(s.lines).fill('') : [],
          order: i
        };
      })
    };
  }
  function saveEntry(entry) {
    if (entry && entry.id && Entries.get(entry.id)) {
      return Entries.update(entry.id, Object.assign({}, entry, { updatedAt: Date.now() }));
    }
    return Entries.add(Object.assign({}, entry, { createdAt: Date.now(), updatedAt: Date.now() }));
  }

  // ============================================================
  // COUNTS — what the seven cards actually show.
  // Derived on every read. A stored count is a count that is
  // wrong the first time you delete something.
  // ============================================================
  function counts() {
    return {
      breath:  Breath.list().length,
      journal: Journals.list().length,
      entries: Entries.list().length,
      eft:     Eft.list().length,
      medit:   mediaAll().length,
      yoga:    Yoga.list().length,
      energy:  Energy.list().length,
      affirm:  Affirmations.list().length,
      decks:   Decks.list().length,
      routines: Routines.list().length,
      favourites: favouriteCount()
    };
  }

  // ============================================================
  // SEEDING
  //
  // NEVER seed before the cloud has spoken. A seeder that runs
  // against a not-yet-hydrated store concludes the device is
  // empty and writes the defaults over real data that is still on
  // its way in. seedAfterSyncAttempt() is the gate; it also has an
  // 8s backstop so a device with no Supabase at all still ends up
  // with a usable page.
  //
  // Seeding is ADDITIVE AND ONCE. isSeeded() is a stored stamp,
  // not "does the library look empty" — an emptied library is a
  // decision, and re-seeding over it would make deletion
  // impossible.
  // ============================================================
  function isSeeded() { return !!storeGet(KEYS.seededAt); }

  // Order matters below, and it is not alphabetical. Decks are
  // seeded before affirmations because an affirmation needs a
  // deckId, and every other collection is seeded before routines
  // because a routine step needs something to point at.
  //
  // NOTHING IN asclepion-seed.js CARRIES AN ID. It refers to
  // records by name, in a `seedRef` field, and the two resolvers
  // below turn those into real ids once the models have minted
  // them. That is what lets the content file stay a content file
  // — no id has to be invented by hand or kept unique while
  // writing prose, and re-seeding a fresh device cannot collide
  // with anything.
  function seedNow() {
    var S = global.AscSeed;
    if (!S) return false;
    if (isSeeded()) return false;

    if (!Breath.list().length)    Breath.replaceAll(stamp(S.breath));
    if (!EftPoints.list().length) EftPoints.replaceAll(stamp(S.eftPoints));
    if (!Eft.list().length)       Eft.replaceAll(stamp(S.eft));
    if (!Journals.list().length)  Journals.replaceAll(stamp(S.journals));
    if (!Yoga.list().length)      Yoga.replaceAll(stamp(S.yoga));
    if (!Energy.list().length)    Energy.replaceAll(stamp(S.energy));
    MEDIA_SHELVES.forEach(function (shelf) {
      var rows = (S.media && S.media[shelf]) || [];
      if (!Media[shelf].list().length && rows.length) Media[shelf].replaceAll(stamp(rows));
    });

    // Decks, then the lines that belong to them.
    if (!Decks.list().length) Decks.replaceAll(stamp(S.decks));
    if (!Affirmations.list().length) {
      var byKey = {};
      Decks.list().forEach(function (d) { if (d.key) byKey[d.key] = d.id; });
      var lines = [], n = 0;
      Object.keys(S.affirmations || {}).forEach(function (deckKey) {
        var deckId = byKey[deckKey];
        if (!deckId) return;   // a deck key with no deck is a typo, not a record
        arr(S.affirmations[deckKey]).forEach(function (text) {
          lines.push({ deckId: deckId, text: text, order: n++, builtin: true });
        });
      });
      if (lines.length) Affirmations.replaceAll(lines);
    }

    // Routines last — every kind of step they can point at now exists.
    if (!Routines.list().length) Routines.replaceAll(resolveRoutines(S.routines));

    storeSet(KEYS.seededAt, Date.now());
    return true;
  }

  function stamp(rows) {
    return arr(rows).map(function (r, i) {
      return Object.assign({ order: i, builtin: true }, r);
    });
  }

  // Look a seeded record up by the name it was written under.
  // Case-insensitive and trimmed, because these are matched
  // against prose typed in another file.
  function findByName(rows, name, field) {
    var want = String(name || '').trim().toLowerCase();
    if (!want) return '';
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][field] || '').trim().toLowerCase() === want) return rows[i].id;
    }
    return '';
  }

  function resolveRoutines(rows) {
    var breath = Breath.list(), eft = Eft.list(), journals = Journals.list(),
        yoga = Yoga.list(), energy = Energy.list();
    return arr(rows).map(function (r, i) {
      return Object.assign({}, r, {
        order: i,
        builtin: true,
        steps: arr(r.steps).map(function (s) {
          var refId = str(s.refId, 60);
          if (!refId && s.seedRef) {
            switch (s.kind) {
              case 'breath':     refId = findByName(breath, s.seedRef, 'name'); break;
              case 'eft':        refId = findByName(eft, s.seedRef, 'name'); break;
              case 'journal':    refId = findByName(journals, s.seedRef, 'name'); break;
              case 'yoga':       refId = findByName(yoga, s.seedRef, 'title'); break;
              case 'energy':     refId = findByName(energy, s.seedRef, 'title'); break;
              case 'meditation':
                var shelf = Media[s.shelf];
                refId = shelf ? findByName(shelf.list(), s.seedRef, 'title') : '';
                break;
            }
          }
          // A step that resolves to nothing is not dropped — it
          // becomes a step that opens its category and lets you
          // choose. That is correct for "tap on whatever is
          // loudest", and it is also the right failure mode for a
          // seedRef that no longer matches anything.
          return Object.assign({}, s, { refId: refId });
        })
      });
    });
  }

  function seedAfterSyncAttempt(remoteRef, cb) {
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      var did = false;
      try { did = seedNow(); } catch (e) { did = false; }
      if (typeof cb === 'function') cb(did);
    }
    if (remoteRef && remoteRef.pulled) { go(); return; }
    if (remoteRef) remoteRef.onPulled = go;
    // The device may have no Supabase, no signal, or a hung pull.
    // A page that never seeds because the cloud never answered is
    // a blank page, which is worse than a seeded one.
    setTimeout(go, 8000);
  }

  // ============================================================
  // CHANGE NOTIFICATION
  // Cross-tab and cross-document, via the storage event the IDB
  // shim re-fires, plus a visibility check for the phone path.
  // ============================================================
  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    function onStorage(e) {
      if (!e || !e.key) return;
      if (e.key.indexOf('asc:') !== 0 && e.key.indexOf('asclog:') !== 0) return;
      fn(e.key);
    }
    function onVis() { if (document.visibilityState === 'visible') fn(null); }
    global.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    return function () {
      global.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================
  global.Asc = {
    KEYS: KEYS,
    MEDIA_SHELVES: MEDIA_SHELVES,
    SHELF_LABELS: SHELF_LABELS,
    PHASE_KINDS: PHASE_KINDS,
    BREATH_GOALS: BREATH_GOALS,
    YOGA_CATEGORIES: YOGA_CATEGORIES,
    ENERGY_GROUPS: ENERGY_GROUPS,
    STEP_KINDS: STEP_KINDS,
    SESSION_KINDS: SESSION_KINDS,

    Breath: Breath,
    Eft: Eft,
    EftPoints: EftPoints,
    Journals: Journals,
    Yoga: Yoga,
    Energy: Energy,
    Decks: Decks,
    Affirmations: Affirmations,
    Routines: Routines,
    Entries: Entries,
    Sessions: Sessions,
    Media: Media,
    mediaShelf: mediaShelf,
    mediaAll: mediaAll,
    mediaKey: mediaKey,

    breathSeconds: breathSeconds,
    favourites: favourites,
    favouriteCount: favouriteCount,
    toggleFavourite: toggleFavourite,

    todaysAffirmation: todaysAffirmation,
    newAffirmation: newAffirmation,

    getLive: getLive,
    setLive: setLive,
    startRoutine: startRoutine,
    clearLive: clearLive,

    logSession: logSession,
    sessionsOn: sessionsOn,
    recentSessions: recentSessions,
    lastSessionFor: lastSessionFor,

    entriesFor: entriesFor,
    blankEntry: blankEntry,
    saveEntry: saveEntry,

    uiState: uiState,
    HIA_SYMBOLS: HIA_SYMBOLS,
    getHia: getHia,
    setHia: setHia,
    addHiaAction: addHiaAction,
    removeHiaAction: removeHiaAction,
    getMarks: getMarks,
    markDay: markDay,
    cycleDay: cycleDay,
    hiaGrid: hiaGrid,
    neverSkipTwice: neverSkipTwice,
    hiaStreak: hiaStreak,
    addDays: addDays,

    counts: counts,
    isSeeded: isSeeded,
    seedNow: seedNow,
    seedAfterSyncAttempt: seedAfterSyncAttempt,
    onChange: onChange,

    // primitives other Asclepion files reuse rather than re-declare
    uid: uid,
    today: today,
    localISO: localISO,
    clamp: clamp
  };
})(window);
