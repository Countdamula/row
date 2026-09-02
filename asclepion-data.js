// =============================================================
// asclepion-data.js — the data layer for The Asclepion.
//
//   window.Asc
//
// Loaded by asclepion.html, which since 2026-09-01 is the whole
// studio: one document, one table, no routes. Machinery only —
// every word of actual content lives in asclepion-seed.js
// (window.AscSeed), which must be loaded BEFORE this file.
//
// =============================================================
// TWO ROWS, SPLIT BY WEIGHT
//
//   asc:     the library     — read-mostly, large, seeded
//   asclog:  what you write  — small records, written constantly
//
// sync.js's pushNow() uploads a row's ENTIRE data column on every
// debounced save. The seeded library is ~200KB; on one row, every
// session logged would re-upload all of it. Same split, same
// reason, as kdpms: out of kdp:.
//
// Both rows survived the collapse to one page even though there
// is only one document now. The split is about WRITE FREQUENCY,
// not about how many documents there are, and the log is still
// written every time a practice ends.
//
// The prefix table itself is asclepion-sync.js, not this file.
// =============================================================
// WHAT WAS RETIRED, AND WHAT THAT DID NOT MEAN
//
// Journals, affirmations, routines and the Kept view were removed
// on 2026-09-01, records and all. Their KEYS are deleted, once,
// by asclepion-retire.js. Their PREFIXES stay: `asc:` and
// `asclog:` are still both listed in asclepion-sync.js, because
// removing a prefix deletes everything under it on every device
// at the next push.
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
    yoga:         'asc:yoga',
    energy:       'asc:energy',
    // Activities written by hand. The "Mine" group.
    custom:       'asc:custom',
    uiState:      'asc:uiState',
    settings:     'asc:settings',
    seededAt:     'asc:seededAt',
    // The goal and the three actions: set once, changed rarely.
    hia:          'asc:hia',
    // --- asclog: what you write --------------------------------
    sessions:     'asclog:sessions',
    // One mark per day. On the LOG row, not the library row,
    // because it is written every single day and the library is
    // 100KB that would be re-uploaded with it.
    hiaMarks:     'asclog:hiamarks'
  };

  // RETIRED 2026-09-01, when the Asclepion became one page. These
  // keys are deleted once, by asclepion-retire.js, and are read by
  // nothing here.
  //
  // THE PREFIXES `asc:` AND `asclog:` STAY. Retiring a collection
  // means deleting its keys; retiring a PREFIX from
  // asclepion-sync.js would delete everything under it, on every
  // device, at the next push. The list of keys is held in
  // asclepion-retire.js and nowhere else, so there is exactly one
  // place that can name something for deletion.
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

  // --- MINE ---------------------------------------------------
  // An activity written by hand, in the same shape the table
  // reads every other kind in: a name, what it is for, how long it
  // takes, and optionally what to actually do. `steps` is the same
  // field energyModel uses, so one renderer covers both.
  function customModel(c) {
    c = c || {};
    return {
      id:       str(c.id, 60) || uid('own'),
      title:    str(c.title, 160),
      summary:  str(c.summary, 600),
      steps:    strList(c.steps, 700, 16),
      forWhen:  str(c.forWhen, 60),
      minutes:  clamp(Math.round(num(c.minutes, 0)), 0, 240),
      url:      str(c.url, 900),
      favorite: c.favorite === true,
      order:    Math.round(num(c.order, 0)),
      createdAt: Math.round(num(c.createdAt, Date.now()))
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

  // --- SESSIONS (the log) -------------------------------------
  // One shape for every kind of practice, because the only
  // questions ever asked of it are "what did I do" and "did it
  // help". before/after are the 0-10 intensity readings; they stay
  // null for practices that do not ask.
  //
  // 'routine' stays in the list although routines are gone: it is
  // what the sessions already logged against them say they are,
  // and dropping it would make oneOf() rewrite every one of those
  // records as a breathing session the next time it was touched.
  var SESSION_KINDS = ['breath', 'eft', 'meditation', 'yoga', 'energy', 'custom', 'routine'];
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
  var Yoga         = makeCollection(KEYS.yoga, yogaModel, 'yog');
  var Energy       = makeCollection(KEYS.energy, energyModel, 'eng');
  var Custom       = makeCollection(KEYS.custom, customModel, 'own');
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
    { kind: 'breath', tint: 'breath', label: 'Breath',    coll: function () { return Breath.list(); }, title: function (r) { return r.name; } },
    { kind: 'eft',    tint: 'eft',    label: 'Tapping',   coll: function () { return Eft.list(); },    title: function (r) { return r.name; } },
    { kind: 'yoga',   tint: 'yoga',   label: 'Movement',  coll: function () { return Yoga.list(); },   title: function (r) { return r.title; } },
    { kind: 'energy', tint: 'energy', label: 'Energy',    coll: function () { return Energy.list(); }, title: function (r) { return r.title; } },
    { kind: 'custom', tint: 'mine',   label: 'Mine',      coll: function () { return Custom.list(); }, title: function (r) { return r.title; } }
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
      case 'breath':     return Breath.toggleFav(id);
      case 'eft':        return Eft.toggleFav(id);
      case 'yoga':       return Yoga.toggleFav(id);
      case 'energy':     return Energy.toggleFav(id);
      case 'custom':     return Custom.toggleFav(id);
      case 'meditation': return Media[shelf] ? Media[shelf].toggleFav(id) : null;
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
  // ACTIVITIES — the one read the page makes.
  //
  // Six collections with six different shapes, flattened into one
  // row shape so the table has a single thing to render, sort and
  // group. The mapping is here rather than in the view because a
  // "for when" that means `goal` on a breathing technique and
  // `feelings[0]` on a yoga video is a data question, not a
  // markup one.
  //
  // THE SESSION LOG IS READ ONCE, INTO A MAP. Asking
  // lastSessionFor() per row would be O(rows x sessions) — around
  // sixty rows against a log capped at 1200 — on every keystroke
  // in the search box. One pass, then a lookup.
  // ============================================================
  var GROUPS = [
    { key: 'breath', label: 'Breath',     tint: 'breath' },
    { key: 'eft',    label: 'Tapping',    tint: 'eft' },
    { key: 'medit',  label: 'Meditation', tint: 'medit' },
    { key: 'yoga',   label: 'Movement',   tint: 'yoga' },
    { key: 'energy', label: 'Energy',     tint: 'energy' },
    { key: 'mine',   label: 'Mine',       tint: 'mine' }
  ];

  var ENERGY_LABELS = {
    grounding: 'Grounding', cleansing: 'Cleansing', protection: 'Protection',
    energywork: 'Energy work', stateshift: 'Shifting state'
  };
  var YOGA_LABELS = {
    morning: 'Morning', evening: 'Evening', mobility: 'Mobility',
    stretching: 'Stretching', yin: 'Yin', restorative: 'Restorative', somatic: 'Somatic'
  };

  function sessionIndex() {
    var by = {};
    Sessions.list().forEach(function (s) {
      if (!s.refId) return;
      var k = s.kind + ':' + s.refId;
      var e = by[k] || (by[k] = { last: null, count: 0 });
      e.count++;
      if (!e.last || (s.startedAt || 0) > (e.last.startedAt || 0)) e.last = s;
    });
    return by;
  }

  /**
   * Every practice in the studio, as one uniform list.
   * @returns {Array<{id,kind,group,shelf,title,forWhen,minutes,url,
   *                  favorite,lastDoneISO,timesDone,rec}>}
   */
  function activities() {
    var idx = sessionIndex(), out = [];
    function push(kind, group, rec, title, forWhen, minutes, extra) {
      var e = idx[kind + ':' + rec.id];
      out.push(Object.assign({
        id: rec.id, kind: kind, group: group, shelf: '',
        title: title, forWhen: forWhen || '',
        minutes: Math.round(minutes || 0),
        // Seconds, where a practice is genuinely that short. Every
        // breathing technique here runs 33 to 76 seconds, so
        // rounding them all to minutes printed "1 min" five times
        // and told you nothing. 0 means "minutes are the unit".
        seconds: 0,
        // THE DESCRIPTION, under whichever name its own collection
        // gave it. Six collections spell this field four different
        // ways — summary, blurb, description — and the table needs
        // one name for it, so the mapping happens here, once,
        // rather than at every call site that wants to show it.
        summary: '',
        url: rec.url || '',
        favorite: rec.favorite === true,
        lastDoneISO: e && e.last ? e.last.date : '',
        timesDone: e ? e.count : 0,
        rec: rec
      }, extra || {}));
    }

    Breath.list().forEach(function (b) {
      var s = breathSeconds(b);
      push('breath', 'breath', b, b.name, b.goal, Math.round(s / 60),
        { seconds: s, summary: b.summary });
    });
    Eft.list().forEach(function (t) {
      // DERIVED, and deliberately rough. A tapping script has no
      // stored duration because it is self-paced, but a whole
      // column of blanks reads as missing data rather than as
      // "it takes as long as it takes". Roughly twenty seconds a
      // line, floored at five minutes.
      //
      // `forWhen` is left EMPTY on purpose. Every one of these is
      // for relief, so filling the column with twelve identical
      // words would be noise — and the name of the script already
      // says which feeling it is for.
      var lines = t.setup.length + t.round1.length + t.round2.length + t.reframe.length;
      push('eft', 'eft', t, t.name, '', Math.max(5, Math.round(lines / 3)),
        { summary: t.blurb });
    });
    mediaAll().forEach(function (m) {
      push('meditation', 'medit', m, m.title,
        m.forWhen || SHELF_LABELS[m._shelf] || '', m.minutes,
        { shelf: m._shelf, summary: m.description });
    });
    Yoga.list().forEach(function (y) {
      push('yoga', 'yoga', y, y.title,
        y.feelings[0] || YOGA_LABELS[y.category] || '', y.minutes,
        { summary: y.description });
    });
    Energy.list().forEach(function (e) {
      push('energy', 'energy', e, e.title, ENERGY_LABELS[e.group] || '', e.minutes,
        { summary: e.summary });
    });
    Custom.list().forEach(function (c) {
      push('custom', 'mine', c, c.title, c.forWhen, c.minutes,
        { summary: c.summary });
    });
    return out;
  }

  // ============================================================
  // THE MENU
  //
  // A few things you could do right now, rather than a library to
  // browse. Stable through the day for the same reason the old
  // daily affirmation was: a suggestion that changes every time
  // you glance at it is a suggestion you never take. "Something
  // else" re-rolls deliberately.
  //
  // Short things first, and never something already done today —
  // the whole point is the first tap, and a twenty-minute video
  // is not the first tap.
  // ============================================================
  function menu(n, force) {
    n = clamp(Math.round(num(n, 3)), 1, 6);
    var held = uiState('menu');
    var all = activities();
    if (!all.length) return [];

    if (!force && held && held.date === today() && arr(held.ids).length) {
      var byId = {};
      all.forEach(function (a) { byId[a.kind + ':' + a.id] = a; });
      var kept = held.ids.map(function (k) { return byId[k]; }).filter(Boolean);
      if (kept.length === held.ids.length) return kept;
      // something in the held pick was deleted: fall through and re-roll
    }

    var todayISO = today();
    var pool = all.filter(function (a) { return a.lastDoneISO !== todayISO; });
    if (pool.length < n) pool = all.slice();
    // Short first, then unfamiliar, then anything. Shuffled inside
    // each band so the same three do not come up every morning.
    var bands = [[], [], []];
    pool.forEach(function (a) {
      bands[a.minutes && a.minutes <= 6 ? 0 : (a.minutes && a.minutes <= 15 ? 1 : 2)].push(a);
    });
    bands.forEach(function (b) {
      for (var i = b.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t;
      }
    });
    var picked = bands[0].concat(bands[1], bands[2]).slice(0, n);
    uiState('menu', { date: todayISO, ids: picked.map(function (a) { return a.kind + ':' + a.id; }) });
    return picked;
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
  // COUNTS — what each group heading shows.
  // Derived on every read. A stored count is a count that is
  // wrong the first time you delete something.
  // ============================================================
  function counts() {
    return {
      breath: Breath.list().length,
      eft:    Eft.list().length,
      medit:  mediaAll().length,
      yoga:   Yoga.list().length,
      energy: Energy.list().length,
      mine:   Custom.list().length,
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

  // Nothing in asclepion-seed.js carries an id: the models mint
  // them here. That is what lets the content file stay a content
  // file — no id has to be invented by hand while writing prose,
  // and seeding a fresh device cannot collide with anything.
  //
  // The `seedRef` resolver that used to run after this went with
  // the routines: it existed to turn names written in prose into
  // real ids for routine steps, and nothing else ever used it.
  function seedNow() {
    var S = global.AscSeed;
    if (!S) return false;
    if (isSeeded()) return false;

    if (!Breath.list().length)    Breath.replaceAll(stamp(S.breath));
    if (!EftPoints.list().length) EftPoints.replaceAll(stamp(S.eftPoints));
    if (!Eft.list().length)       Eft.replaceAll(stamp(S.eft));
    if (!Yoga.list().length)      Yoga.replaceAll(stamp(S.yoga));
    if (!Energy.list().length)    Energy.replaceAll(stamp(S.energy));
    MEDIA_SHELVES.forEach(function (shelf) {
      var rows = (S.media && S.media[shelf]) || [];
      if (!Media[shelf].list().length && rows.length) Media[shelf].replaceAll(stamp(rows));
    });

    // `asc:custom` is deliberately NOT seeded. The Mine group is
    // yours; shipping it with examples would mean deleting three
    // things before writing one.

    storeSet(KEYS.seededAt, Date.now());
    return true;
  }

  function stamp(rows) {
    return arr(rows).map(function (r, i) {
      return Object.assign({ order: i, builtin: true }, r);
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
    GROUPS: GROUPS,
    MEDIA_SHELVES: MEDIA_SHELVES,
    SHELF_LABELS: SHELF_LABELS,
    PHASE_KINDS: PHASE_KINDS,
    BREATH_GOALS: BREATH_GOALS,
    YOGA_CATEGORIES: YOGA_CATEGORIES,
    YOGA_LABELS: YOGA_LABELS,
    ENERGY_GROUPS: ENERGY_GROUPS,
    ENERGY_LABELS: ENERGY_LABELS,
    SESSION_KINDS: SESSION_KINDS,

    Breath: Breath,
    Eft: Eft,
    EftPoints: EftPoints,
    Yoga: Yoga,
    Energy: Energy,
    Custom: Custom,
    Sessions: Sessions,
    Media: Media,
    mediaShelf: mediaShelf,
    mediaAll: mediaAll,
    mediaKey: mediaKey,

    breathSeconds: breathSeconds,
    favourites: favourites,
    favouriteCount: favouriteCount,
    toggleFavourite: toggleFavourite,

    activities: activities,
    menu: menu,

    logSession: logSession,
    sessionsOn: sessionsOn,
    recentSessions: recentSessions,
    lastSessionFor: lastSessionFor,

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
