// =============================================================
// chrysalis-data.js — The Chrysalis data layer.
//
// Follows the same shape as the dashboard's other *-data.js files:
// a whitelist model() per record type re-run on every write, plus
// list/add/update/remove. Owns the 'chr:' namespace and nothing else.
//
// PORTING NOTE: this file is written to drop into row/ unchanged.
// There it will be paired with ONE initCloudSync({ appKey:'chrysalis',
// syncedPrefixes:['chr:'] }) mount and must be loaded AFTER
// local-store-idb.js. It never reads or writes another page's prefix.
// =============================================================
(function () {
  'use strict';

  var KEYS = {
    stages:     'chr:stages',
    versions:   'chr:versions',
    images:     'chr:images',
    portraits:  'chr:portraits',
    milestones: 'chr:milestones',
    traits:     'chr:traits',
    evidence:   'chr:evidence',
    practices:  'chr:practices',
    reviews:    'chr:reviews',
    notes:      'chr:notes',
    example:    'chr:example'
  };

  var STATUS = ['current', 'next', 'archived'];

  // A practice repeats daily or weekly. Nothing else: the cadence
  // exists to answer "is this one of today's?", not to build a schedule.
  var CADENCES = ['daily', 'weekly'];

  // The embodiment ladder. Named rungs, never a number and never a
  // chart: Damian explicitly did not want the distance drawn as a gap.
  var RUNGS = ['Aspiring', 'Deliberate', 'Frequent', 'Default', 'Identity'];

  // Evidence is additive only. A fall-back is recorded as information,
  // never as failure — see the standing constraint that this page must
  // not become an accusation on a bad week.
  var EVIDENCE_KINDS = ['acted', 'fellback'];

  // The written portrait asks about CHARACTER, deliberately not the
  // circumstance questions index.html#subconscious already asks (who you
  // are surrounded by, your schedule, your work). Two pages asking the
  // same six questions would make one of them pointless.
  var PORTRAIT_FIELDS = [
    { key: 'unobserved', label: 'What you do when nobody is watching',
      hint: 'The private standard. It decides all the others.' },
    { key: 'wrong', label: 'How you handle being wrong',
      hint: 'Not whether you admit it — how long it takes, and what it costs you.' },
    { key: 'stopped', label: 'What you no longer do',
      hint: 'Something the old self did that this one simply does not.' },
    { key: 'refuse', label: 'What you say no to',
      hint: 'A person is described better by refusals than by intentions.' },
    { key: 'standard', label: 'The standard you hold',
      hint: 'What "good enough" means to this version, in plain words.' },
    { key: 'afraid', label: "What you're afraid to admit you want",
      hint: 'Not what sounds impressive, and not what is expected of you.' }
  ];

  // The seed. Placeholder copy in Damian's stead — the shape is the
  // point, the sentences are not. Only ever written when the key has
  // never existed; deleting every stage leaves it deleted.
  var SEED = [
    { label: 'I am someone who', lines: [
        'finishes what he starts, long after the excitement has gone.',
        'is honest a beat before it becomes comfortable.',
        'keeps the promises nobody witnessed him make.',
        'does the difficult thing early, not eventually.'
    ] },
    { label: 'When nobody is watching', lines: [
        'I hold the same standard I hold in company.',
        'I work without an audience to perform it for.',
        'I choose the slower, truer version of the thing.',
        'I am not a different man than the one I describe.'
    ] },
    { label: 'What I no longer do', lines: [
        'I no longer wait to feel ready before I begin.',
        'I no longer rehearse a life instead of living it.',
        'I no longer treat my own word as negotiable.',
        'I no longer mistake planning for movement.'
    ] }
  ];

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function str(v, max) {
    return String(v == null ? '' : v).slice(0, max);
  }

  // ============================================================
  // DATES — all local, never UTC.
  //
  // toISOString() converts to UTC first, so at 21:00 in Berlin it
  // already reads tomorrow, and at 21:00 in New York it still reads
  // today at 02:00 the next morning. A page whose whole job is "what is
  // today" cannot use it. Every date string in 'chr:' is local.
  // ============================================================
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function localISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function today() { return localISO(new Date()); }

  // The Monday that starts the week a YYYY-MM-DD falls in.
  function mondayOf(dateStr) {
    var d = new Date(String(dateStr) + 'T00:00:00');
    if (isNaN(d)) return '';
    var day = (d.getDay() + 6) % 7;               // Monday = 0
    return localISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
  }

  // A stable integer per calendar day. Built from the date parts through
  // Date.UTC so a daylight-saving shift can never make two days share a
  // number, or skip one.
  function dayNumber(dateStr) {
    var p = String(dateStr || today()).split('-');
    var n = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(n) ? 0 : Math.floor(n / 86400000);
  }

  // Whitelist. Anything not named here is dropped on every write, so a
  // stray field can never quietly become part of the record.
  function stageModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      label: str(d.label, 120),
      lines: (Array.isArray(d.lines) ? d.lines : [])
        .map(function (l) { return str(l, 400); })
        .filter(function (l) { return l.trim() !== ''; }),
      order: Number(d.order) || 0
    };
  }

  // Reading and writing normalise differently, and conflating them is a
  // real bug: sorting on write by the stored `order` undoes any reorder
  // that was expressed by moving records within the array.
  //
  //   READ  — storage may hold records in any array order, so `order`
  //           decides the sequence.
  //   WRITE — the caller has just arranged the array deliberately, so
  //           array position decides, and `order` is rewritten from it.
  function normaliseForRead(list) {
    return list
      .map(stageModel)
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (s, i) { s.order = i; return s; });
  }

  function normaliseForWrite(list) {
    return list
      .map(stageModel)
      .map(function (s, i) { s.order = i; return s; });
  }

  var Stages = {
    // A key that has never existed gets the seed. A key holding an empty
    // array stays empty — deleting everything is a real, kept decision.
    ensureSeeded: function () {
      if (readJSON(KEYS.stages) !== null) return false;
      writeJSON(KEYS.stages, normaliseForWrite(SEED.map(function (s, i) {
        return stageModel({ label: s.label, lines: s.lines, order: i });
      })));
      return true;
    },

    list: function () {
      var raw = readJSON(KEYS.stages);
      if (!Array.isArray(raw)) return [];
      return normaliseForRead(raw);
    },

    save: function (list) {
      return writeJSON(KEYS.stages, normaliseForWrite(list || []));
    },

    add: function (data) {
      var all = Stages.list();
      var rec = stageModel(data || {});
      rec.order = all.length;
      all.push(rec);
      Stages.save(all);
      return rec;
    },

    update: function (id, patch) {
      var all = Stages.list();
      var i = all.findIndex(function (s) { return s.id === id; });
      if (i === -1) return null;
      all[i] = stageModel(Object.assign({}, all[i], patch, { id: id }));
      Stages.save(all);
      return all[i];
    },

    remove: function (id) {
      var all = Stages.list().filter(function (s) { return s.id !== id; });
      Stages.save(all);
    },

    // dir is -1 (earlier) or +1 (later). Out-of-range moves are no-ops.
    move: function (id, dir) {
      var all = Stages.list();
      var i = all.findIndex(function (s) { return s.id === id; });
      var j = i + dir;
      if (i === -1 || j < 0 || j >= all.length) return false;
      var tmp = all[i]; all[i] = all[j]; all[j] = tmp;
      Stages.save(all);
      return true;
    },

    resetToSeed: function () {
      writeJSON(KEYS.stages, normaliseForWrite(SEED.map(function (s, i) {
        return stageModel({ label: s.label, lines: s.lines, order: i });
      })));
    }
  };

  // ============================================================
  // VERSIONS — a named, dated whole-person target. Temporary by
  // design: you work inside one, then graduate from it and it freezes
  // into a readable historical portrait. Traits are permanent and are
  // only *selected* by a version, never owned by it.
  // ============================================================
  function versionModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      name: str(d.name, 120),
      intent: str(d.intent, 600),        // one line: what this version is for
      startDate: str(d.startDate, 10),   // YYYY-MM-DD
      targetDate: str(d.targetDate, 10),
      status: STATUS.indexOf(d.status) !== -1 ? d.status : 'next',
      traitIds: (Array.isArray(d.traitIds) ? d.traitIds : []).map(function (t) { return str(t, 64); }),
      graduatedAt: str(d.graduatedAt, 32),
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }

  function versionsForRead(list) {
    return list.map(versionModel)
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (v, i) { v.order = i; return v; });
  }
  function versionsForWrite(list) {
    return list.map(versionModel).map(function (v, i) { v.order = i; return v; });
  }

  var Versions = {
    list: function () {
      var raw = readJSON(KEYS.versions);
      if (!Array.isArray(raw)) return [];
      return versionsForRead(raw);
    },

    save: function (list) {
      return writeJSON(KEYS.versions, versionsForWrite(list || []));
    },

    get: function (id) {
      return Versions.list().filter(function (v) { return v.id === id; })[0] || null;
    },

    // Exactly one version may be current. Promoting one demotes the
    // incumbent to 'next' rather than silently leaving two.
    current: function () {
      return Versions.list().filter(function (v) { return v.status === 'current'; })[0] || null;
    },

    add: function (data) {
      var all = Versions.list();
      var rec = versionModel(data || {});
      rec.order = all.length;
      if (rec.status === 'current') {
        all = all.map(function (v) {
          return v.status === 'current' ? Object.assign({}, v, { status: 'next' }) : v;
        });
      }
      all.push(rec);
      Versions.save(all);
      return rec;
    },

    update: function (id, patch) {
      var all = Versions.list();
      var i = all.findIndex(function (v) { return v.id === id; });
      if (i === -1) return null;
      var next = versionModel(Object.assign({}, all[i], patch, { id: id }));
      if (next.status === 'current') {
        all = all.map(function (v) {
          return (v.id !== id && v.status === 'current')
            ? Object.assign({}, v, { status: 'next' }) : v;
        });
      }
      all[i] = next;
      Versions.save(all);
      return next;
    },

    remove: function (id) {
      Versions.save(Versions.list().filter(function (v) { return v.id !== id; }));
    },

    // Graduating stamps the version and archives it. It is never
    // deleted: the point of the system is that the past self stays
    // readable, so archives are kept and (in the UI) read-only.
    graduate: function (id) {
      return Versions.update(id, {
        status: 'archived',
        graduatedAt: new Date().toISOString()
      });
    },

    // Closing one version and opening the next is ONE decision, so it
    // is one call: graduating without saying what comes next leaves
    // the whole page with nothing current and no route forward, which
    // is where a system like this quietly dies.
    //
    // Traits are carried by SELECTION, never by copying: `next.traitIds`
    // points at the same permanent records, so every rung and every
    // piece of evidence comes with them untouched. Dropping a trait
    // here does not delete it — it simply stops being what the next
    // stretch is about.
    graduateInto: function (id, next) {
      var closed = Versions.graduate(id);
      if (!closed) return null;
      var name = next && String(next.name == null ? '' : next.name).trim();
      if (!name) return { closed: closed, opened: null };
      return {
        closed: closed,
        opened: Versions.add({
          name: name,
          intent: next.intent,
          startDate: next.startDate || today(),
          targetDate: next.targetDate,
          traitIds: next.traitIds,
          status: 'current'
        })
      };
    }
  };

  // ============================================================
  // A small generic collection, so images / portraits / milestones do
  // not each restate the same list-add-update-remove code.
  // ============================================================
  function makeCollection(key, model) {
    var api = {
      list: function () {
        var raw = readJSON(key);
        if (!Array.isArray(raw)) return [];
        return raw.map(model)
          .sort(function (a, b) { return a.order - b.order; })
          .map(function (r, i) { r.order = i; return r; });
      },
      save: function (list) {
        return writeJSON(key, (list || []).map(model)
          .map(function (r, i) { r.order = i; return r; }));
      },
      forVersion: function (versionId) {
        return api.list().filter(function (r) { return r.versionId === versionId; });
      },
      get: function (id) {
        return api.list().filter(function (r) { return r.id === id; })[0] || null;
      },
      add: function (data) {
        var all = api.list();
        var rec = model(data || {});
        rec.order = all.length;
        all.push(rec);
        api.save(all);
        return rec;
      },
      update: function (id, patch) {
        var all = api.list();
        var i = all.findIndex(function (r) { return r.id === id; });
        if (i === -1) return null;
        all[i] = model(Object.assign({}, all[i], patch, { id: id }));
        api.save(all);
        return all[i];
      },
      remove: function (id) {
        api.save(api.list().filter(function (r) { return r.id !== id; }));
      },
      removeWhere: function (fn) {
        api.save(api.list().filter(function (r) { return !fn(r); }));
      },
      move: function (id, dir) {
        var all = api.list();
        var i = all.findIndex(function (r) { return r.id === id; });
        var j = i + dir;
        if (i === -1 || j < 0 || j >= all.length) return false;
        var t = all[i]; all[i] = all[j]; all[j] = t;
        api.save(all);
        return true;
      }
    };
    return api;
  }

  // ============================================================
  // IMAGES — the board at the top of The Becoming.
  //
  // `url` is either a hosted https URL (the normal case, once
  // PhotoStore has uploaded it) or a compressed data: URL that has not
  // been uploaded yet. The distinction matters: every synced key is
  // pushed to Supabase as ONE JSON blob, so base64 sitting here bloats
  // every future sync. isLocal() is what the page uses to say so.
  // ============================================================
  function imageModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      versionId: str(d.versionId, 64),
      url: str(d.url, 3000000),
      caption: str(d.caption, 240),
      isAnchor: !!d.isAnchor,
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }
  var Images = makeCollection(KEYS.images, imageModel);

  Images.isLocal = function (img) {
    return !!img && String(img.url).indexOf('data:') === 0;
  };
  // Exactly one anchor per version — it is the image that represents
  // the version everywhere else.
  Images.setAnchor = function (versionId, id) {
    var all = Images.list().map(function (r) {
      if (r.versionId !== versionId) return r;
      return Object.assign({}, r, { isAnchor: r.id === id });
    });
    Images.save(all);
  };
  Images.anchorFor = function (versionId) {
    var forV = Images.forVersion(versionId);
    return forV.filter(function (r) { return r.isAnchor; })[0] || forV[0] || null;
  };

  // ============================================================
  // MILESTONES — the dated marks on the Timeline of Becoming.
  // ============================================================
  function milestoneModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      versionId: str(d.versionId, 64),
      date: str(d.date, 10),
      title: str(d.title, 160),
      note: str(d.note, 1200),
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }
  var Milestones = makeCollection(KEYS.milestones, milestoneModel);
  Milestones.forVersionByDate = function (versionId) {
    return Milestones.forVersion(versionId).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
  };

  // ============================================================
  // PORTRAITS — one per version, keyed by versionId. Stored as a
  // record rather than loose keys so a version's whole portrait moves,
  // archives and deletes as one thing.
  // ============================================================
  function portraitModel(d) {
    d = d || {};
    var fields = {};
    PORTRAIT_FIELDS.forEach(function (f) {
      fields[f.key] = str((d.fields || {})[f.key], 8000);
    });
    return {
      id: d.id || uid(),
      versionId: str(d.versionId, 64),
      fields: fields,
      updatedAt: str(d.updatedAt, 32),
      order: Number(d.order) || 0
    };
  }
  var Portraits = makeCollection(KEYS.portraits, portraitModel);

  Portraits.forVersionOrNew = function (versionId) {
    return Portraits.forVersion(versionId)[0] ||
           portraitModel({ versionId: versionId });
  };
  Portraits.write = function (versionId, key, value) {
    var existing = Portraits.forVersion(versionId)[0];
    var fields = Object.assign({}, existing ? existing.fields : {});
    fields[key] = value;
    if (existing) {
      return Portraits.update(existing.id, {
        fields: fields, updatedAt: new Date().toISOString()
      });
    }
    return Portraits.add({
      versionId: versionId, fields: fields, updatedAt: new Date().toISOString()
    });
  };

  // ============================================================
  // TRAITS — permanent. "I am someone who…"
  //
  // A version SELECTS traits (version.traitIds); it never owns them.
  // This is the structural rule the whole page rests on: traits and
  // their evidence outlive the version that chased them, which is why
  // deleting a version below does not touch either.
  // ============================================================
  function traitModel(d) {
    d = d || {};
    var rung = RUNGS.indexOf(d.rung) !== -1 ? d.rung : RUNGS[0];
    return {
      id: d.id || uid(),
      statement: str(d.statement, 200),   // completes "I am someone who…"
      oldSelf: str(d.oldSelf, 1200),
      newSelf: str(d.newSelf, 1200),
      why: str(d.why, 1200),
      rung: rung,
      rungLog: (Array.isArray(d.rungLog) ? d.rungLog : [])
        .filter(function (r) { return r && RUNGS.indexOf(r.rung) !== -1; })
        .map(function (r) { return { rung: r.rung, at: str(r.at, 32) }; }),
      notes: str(d.notes, 4000),
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }
  var Traits = makeCollection(KEYS.traits, traitModel);

  Traits.setRung = function (id, rung) {
    if (RUNGS.indexOf(rung) === -1) return null;
    var t = Traits.get(id);
    if (!t || t.rung === rung) return t;
    var log = t.rungLog.concat([{ rung: rung, at: new Date().toISOString() }]);
    return Traits.update(id, { rung: rung, rungLog: log });
  };

  // Deleting a trait takes its evidence: evidence with no trait to
  // belong to is not history, it is litter.
  //
  // Practices and versions are NOT deleted — a practice can install
  // several traits, and a version is far more than the traits it
  // selected — but both must stop pointing at a trait that no longer
  // exists. A dangling id is not merely untidy: a version chasing three
  // traits, one of them a ghost, silently becomes a version chasing two
  // while still claiming three.
  Traits.removeCascade = function (id) {
    Evidence.removeWhere(function (e) { return e.traitId === id; });

    Practices.list().forEach(function (p) {
      if (p.traitIds.indexOf(id) === -1) return;
      Practices.update(p.id, {
        traitIds: p.traitIds.filter(function (t) { return t !== id; })
      });
    });

    Versions.list().forEach(function (v) {
      if (v.traitIds.indexOf(id) === -1) return;
      Versions.update(v.id, {
        traitIds: v.traitIds.filter(function (t) { return t !== id; })
      });
    });

    Traits.remove(id);
  };

  // ============================================================
  // EVIDENCE — the atom. One timestamped moment where you acted as the
  // new self, or didn't. Belongs to a TRAIT; `versionId` only records
  // which version was current when it happened.
  // ============================================================
  function evidenceModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      traitId: str(d.traitId, 64),
      versionId: str(d.versionId, 64),
      at: str(d.at, 32) || new Date().toISOString(),
      text: str(d.text, 2000),
      kind: EVIDENCE_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'acted',
      order: Number(d.order) || 0
    };
  }
  var Evidence = makeCollection(KEYS.evidence, evidenceModel);

  function byAtDesc(a, b) { return String(b.at).localeCompare(String(a.at)); }

  Evidence.forTrait = function (traitId) {
    return Evidence.list().filter(function (e) { return e.traitId === traitId; }).sort(byAtDesc);
  };
  Evidence.forVersionId = function (versionId) {
    return Evidence.list().filter(function (e) { return e.versionId === versionId; }).sort(byAtDesc);
  };
  Evidence.recent = function (n) {
    return Evidence.list().sort(byAtDesc).slice(0, n || 5);
  };
  Evidence.forWeek = function (monday) {
    return Evidence.list().filter(function (e) {
      var d = new Date(e.at);
      return !isNaN(d) && mondayOf(localISO(d)) === monday;
    }).sort(byAtDesc);
  };
  Evidence.countFor = function (traitId) {
    return Evidence.list().filter(function (e) { return e.traitId === traitId; }).length;
  };
  Evidence.lastFor = function (traitId) {
    return Evidence.forTrait(traitId)[0] || null;
  };

  /* Weeks, for the Timeline of Becoming. Keyed by the Monday that starts
     the week so the buckets are stable regardless of when they're read.
     That key is also DISPLAYED as the week's date on the timeline, which
     is why it goes through localISO: stamping a local midnight with
     toISOString() lands on the previous day everywhere east of Greenwich,
     and labelled the week as starting on a Sunday. */
  Evidence.byWeek = function (list) {
    var out = {};
    (list || []).forEach(function (e) {
      var d = new Date(e.at);
      if (isNaN(d)) return;
      var key = mondayOf(localISO(d));
      (out[key] = out[key] || []).push(e);
    });
    return out;
  };

  // ============================================================
  // PRACTICES — a repeatable behaviour that INSTALLS a trait.
  //
  // The boundary that decides this whole record's shape: Main Pillar
  // owns gamified daily doing — quests, streaks, points. A practice here
  // carries none of that. Marks exist so that "done today" survives a
  // reload and reaches your other devices, and for no other purpose.
  // Nothing reads further back than the current day or week, which is
  // why the tail is trimmed rather than kept forever: an unbounded array
  // of dates would grow the synced blob to buy a history no surface is
  // allowed to draw.
  // ============================================================
  var DONE_KEEP = 120;

  function practiceModel(d) {
    d = d || {};
    var seen = {};
    var done = (Array.isArray(d.done) ? d.done : [])
      .map(function (x) { return str(x, 10); })
      .filter(function (x) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || seen[x]) return false;
        seen[x] = 1; return true;
      })
      .sort()
      .slice(-DONE_KEEP);

    return {
      id: d.id || uid(),
      name: str(d.name, 160),
      cadence: CADENCES.indexOf(d.cadence) !== -1 ? d.cadence : 'daily',
      traitIds: (Array.isArray(d.traitIds) ? d.traitIds : []).map(function (t) { return str(t, 64); }),
      note: str(d.note, 600),
      active: d.active === false ? false : true,
      done: done,
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }
  var Practices = makeCollection(KEYS.practices, practiceModel);

  // Retired practices stay on the record — the fact that you once did
  // this is part of how a trait got installed — but leave the day.
  Practices.due = function () {
    return Practices.list().filter(function (p) { return p.active; });
  };

  Practices.isDone = function (p, dateStr) {
    if (!p) return false;
    var day = dateStr || today();
    if (p.cadence === 'weekly') {
      var week = mondayOf(day);
      return p.done.some(function (x) { return mondayOf(x) === week; });
    }
    return p.done.indexOf(day) !== -1;
  };

  /* Marking is a toggle, and unmarking a weekly practice clears the
     whole week rather than one date — otherwise un-ticking it would
     leave an earlier mark behind and it would silently re-tick. */
  Practices.mark = function (id, on, dateStr) {
    var p = Practices.get(id);
    if (!p) return null;
    var day = dateStr || today();
    var done;
    if (on) {
      done = p.done.indexOf(day) === -1 ? p.done.concat([day]) : p.done;
    } else if (p.cadence === 'weekly') {
      var week = mondayOf(day);
      done = p.done.filter(function (x) { return mondayOf(x) !== week; });
    } else {
      done = p.done.filter(function (x) { return x !== day; });
    }
    return Practices.update(id, { done: done });
  };

  Practices.toggle = function (id, dateStr) {
    var p = Practices.get(id);
    if (!p) return null;
    return Practices.mark(id, !Practices.isDone(p, dateStr), dateStr);
  };

  Practices.forTrait = function (traitId) {
    return Practices.list().filter(function (p) { return p.traitIds.indexOf(traitId) !== -1; });
  };

  Practices.toggleTrait = function (id, traitId) {
    var p = Practices.get(id);
    if (!p) return null;
    var ids = p.traitIds.slice();
    var i = ids.indexOf(traitId);
    if (i === -1) ids.push(traitId); else ids.splice(i, 1);
    return Practices.update(id, { traitIds: ids });
  };

  // ============================================================
  // REVIEWS — one per week, keyed by the Monday that starts it.
  //
  // The paragraph written here becomes a permanent entry on the
  // version's Timeline of Becoming, which is the whole reason the
  // review is worth sitting down to: it is the only place in the
  // system that produces prose about a stretch of time rather than a
  // moment. The rungs a review sets are NOT stored here — a trait's
  // own rungLog already records every movement with its date, and
  // keeping a second copy would let the two disagree.
  // ============================================================
  function reviewModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      weekOf: str(d.weekOf, 10),           // the Monday, YYYY-MM-DD
      versionId: str(d.versionId, 64),     // whichever was current when written
      paragraph: str(d.paragraph, 8000),
      updatedAt: str(d.updatedAt, 32),
      createdAt: str(d.createdAt, 32) || new Date().toISOString(),
      order: Number(d.order) || 0
    };
  }
  var Reviews = makeCollection(KEYS.reviews, reviewModel);

  Reviews.forWeek = function (monday) {
    return Reviews.list().filter(function (r) { return r.weekOf === monday; })[0] || null;
  };

  // One review per week: writing again edits that week's, never adds a
  // second. A week with two conflicting accounts of it is not a record.
  //
  // A WEEK WITH NO WORDS HAS NO RECORD. The review page autosaves and
  // commits before it re-renders, so without this an empty paragraph
  // would be written every time the reader stepped past a week —
  // paging back through a year would silently store a year of blanks.
  Reviews.write = function (monday, versionId, paragraph) {
    var existing = Reviews.forWeek(monday);
    var text = String(paragraph == null ? '' : paragraph);
    if (text.trim() === '') {
      if (existing) Reviews.remove(existing.id);
      return null;
    }
    var now = new Date().toISOString();
    if (existing) return Reviews.update(existing.id, { paragraph: text, updatedAt: now });
    return Reviews.add({
      weekOf: monday, versionId: versionId, paragraph: text, updatedAt: now
    });
  };

  Reviews.written = function () {
    return Reviews.list()
      .filter(function (r) { return r.paragraph.trim() !== ''; })
      .sort(function (a, b) { return String(b.weekOf).localeCompare(String(a.weekOf)); });
  };

  /* Named apart from makeCollection's generic forVersion rather than
     shadowing it: this one also drops the empty drafts and sorts, and a
     method that quietly means something stricter than its namesake on
     every other collection is a trap. */
  Reviews.writtenForVersion = function (versionId) {
    return Reviews.written().filter(function (r) { return r.versionId === versionId; });
  };

  // ============================================================
  // NOTES — scratch, per page.
  //
  // Deliberately NOT evidence and deliberately not a trait: this is
  // the margin of the book, for the thought that arrives while you are
  // looking at a page and has nowhere else to go. Evidence belongs to a
  // trait and is read back weekly; a note belongs to a page and is read
  // back when you happen to be there.
  // ============================================================
  function noteModel(d) {
    d = d || {};
    return {
      id: d.id || uid(),
      page: str(d.page, 40),          // the route or page key it was written on
      text: str(d.text, 4000),
      at: str(d.at, 32) || new Date().toISOString(),
      pinned: !!d.pinned,
      order: Number(d.order) || 0
    };
  }
  var Notes = makeCollection(KEYS.notes, noteModel);

  Notes.forPage = function (page) {
    return Notes.list()
      .filter(function (n) { return n.page === page; })
      .sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return String(b.at).localeCompare(String(a.at));
      });
  };

  Notes.togglePin = function (id) {
    var n = Notes.get(id);
    if (!n) return null;
    return Notes.update(id, { pinned: !n.pinned });
  };

  /* Today's one identity action.
     Deterministic per calendar day, so it is the same on every reload
     and on every device, and different tomorrow. Deliberately NOT "the
     trait you have neglected longest": surfacing what you have been
     ignoring is an accusation, and this page is not allowed to be one. */
  function traitOfTheDay(traits, dateStr) {
    if (!traits || !traits.length) return null;
    var n = dayNumber(dateStr) % traits.length;
    return traits[(n + traits.length) % traits.length];
  }

  // Deleting a version takes its portrait, images and milestones with
  // it. It does NOT touch traits or evidence: those are permanent and
  // outlive the version by design. Graduating takes nothing at all —
  // that is the whole difference between the two, and why the UI warns.
  //
  // Reviews are not taken either, and the distinction is deliberate: a
  // portrait is prose about the VERSION, so it goes with it, while a
  // review is prose about a WEEK OF YOUR LIFE that merely happened to
  // fall inside one. It stays readable at that week for good.
  Versions.removeCascade = function (id) {
    Images.removeWhere(function (r) { return r.versionId === id; });
    Milestones.removeWhere(function (r) { return r.versionId === id; });
    Portraits.removeWhere(function (r) { return r.versionId === id; });
    Versions.remove(id);
  };

  // Attach / detach a trait to the version chasing it.
  Versions.toggleTrait = function (versionId, traitId) {
    var v = Versions.get(versionId);
    if (!v) return null;
    var ids = v.traitIds.slice();
    var i = ids.indexOf(traitId);
    if (i === -1) ids.push(traitId); else ids.splice(i, 1);
    return Versions.update(versionId, { traitIds: ids });
  };
  Versions.chasing = function (traitId) {
    return Versions.list().filter(function (v) { return v.traitIds.indexOf(traitId) !== -1; });
  };

  // ============================================================
  // Shared image compression, same shape as athenaeum-data.js's.
  // Runs BEFORE PhotoStore.upload so a huge original never becomes a
  // huge base64 string in a synced key, even if the upload fails.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1280; quality = quality == null ? 0.74 : quality;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(dataUrl); return; }
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(c.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  // ============================================================
  // SEEDING — must never run before the cloud has had its chance.
  //
  // On a fresh device the local store is empty until the first pull
  // lands. Seeding immediately would write placeholder rows locally,
  // sync would push them, and the push would overwrite the real
  // 'chrysalis' row. Same guard, same reason, as athenaeum-data.js's
  // maybeSeedAfterSyncAttempt.
  // ============================================================
  function seedAfterSyncAttempt(remoteRef, onDone) {
    var run = function () {
      var seeded = Stages.ensureSeeded();
      if (seeded && typeof onDone === 'function') onDone();
    };
    if (remoteRef && remoteRef.applied) { run(); return; }
    setTimeout(run, 1200);
  }

  // ============================================================
  // THE WORKED EXAMPLE
  //
  // An empty Chrysalis is meaningless: the structural rule only makes
  // sense once you can see a trait with evidence under it and a week
  // written about both. So one small, real example can be loaded — and
  // it is NEVER loaded automatically. Auto-seeding a page that syncs
  // would push placeholders over a real Supabase row on a fresh device,
  // and it would also decide, on the reader's behalf, that they wanted
  // someone else's sentences in their own record.
  //
  // Removal takes exactly what installation added, by id, so anything
  // written alongside it survives. Ids that are already gone are
  // skipped rather than treated as an error.
  // ============================================================
  var EXAMPLE = {
    version: {
      name: 'The one who finishes',
      intent: 'Ship three things end to end, without a new idea rescuing me from the last one.',
      months: 6
    },
    traits: [
      { statement: 'finishes what he starts',
        oldSelf: 'Started things to feel the start, and left them the moment they stopped being interesting.',
        newSelf: 'Stays past the point it stops being interesting, because that is where the work actually is.',
        why: 'Nothing compounds if nothing finishes. Ten unfinished things are worth less than one finished one.',
        rung: 'Deliberate' },
      { statement: 'is honest a beat before it is comfortable',
        oldSelf: 'Waited until the honest thing was safe to say, which was usually too late to matter.',
        newSelf: 'Says it while it still costs something, and finds it costs less than the waiting did.',
        why: 'Every relationship I have runs at the speed of how quickly I will say the awkward thing.',
        rung: 'Frequent' },
      { statement: 'keeps the promises nobody witnessed',
        oldSelf: 'Kept the public ones and quietly renegotiated the private ones.',
        newSelf: 'Treats a promise made to himself as exactly as binding as one made out loud.',
        why: 'This is the one that decides all the others. A private standard is the only real one.',
        rung: 'Aspiring' }
    ],
    practices: [
      { name: 'One hour on the open thing before anything new', cadence: 'daily', traits: [0] },
      { name: 'Say the awkward sentence within a minute of thinking it', cadence: 'daily', traits: [1] },
      { name: 'Read the week back and write one paragraph', cadence: 'weekly', traits: [0, 2] }
    ],
    portrait: {
      unobserved: 'Works at the same standard with nobody watching. It is slower and it is not close.',
      wrong: 'Says "you are right" inside a minute, then changes what he is doing rather than what he is saying.',
      stopped: 'No longer opens a new document when the current one gets boring.',
      refuse: 'Says no to anything that would be a fourth open thing.',
      standard: 'Finished and slightly worse beats unfinished and theoretically better.',
      afraid: 'Wants to be the person other people rely on to actually land things — and is afraid that sounds small.'
    },
    // days back from today, so the example always reads as recent
    evidence: [
      { trait: 0, kind: 'acted',    day: 1,  text: 'Finished the chapter after the interest had gone. It was worse and then it was fine.' },
      { trait: 1, kind: 'acted',    day: 2,  text: 'Said the thing at the start of the call rather than at the end.' },
      { trait: 0, kind: 'fellback', day: 3,  text: 'Opened a new document instead of finishing the open one.' },
      { trait: 2, kind: 'acted',    day: 4,  text: 'Nobody would have known either way. Did it anyway.' },
      { trait: 1, kind: 'fellback', day: 6,  text: 'Softened it into a question instead of saying it.' },
      { trait: 0, kind: 'acted',    day: 9,  text: 'Stayed with the boring middle of it for a whole morning.' },
      { trait: 2, kind: 'fellback', day: 11, text: 'Moved my own deadline because only I knew about it.' },
      { trait: 0, kind: 'acted',    day: 13, text: 'Shipped the thing I had been circling for a fortnight.' }
    ],
    milestones: [
      { day: 12, title: 'Named the pattern', note: 'It is the boring part I quit at, not the hard part.' }
    ],
    review: {
      weeksBack: 1,
      paragraph: 'The pattern is that I quit at the boring part, not the hard part. Twice this week ' +
        'I opened something new the moment the current thing stopped being interesting; the hard ' +
        'parts I stayed for. So the practice is wrong, not the trait. An hour first is fine, but it ' +
        'has to be an hour on the thing already open, not an hour on whatever is most alive that morning.'
    }
  };

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  var Example = {
    state: function () {
      var s = readJSON(KEYS.example);
      return (s && typeof s === 'object') ? s : null;
    },

    installed: function () { return Example.state() !== null; },

    install: function () {
      if (Example.installed()) return null;

      var start = daysAgo(45);
      var target = new Date(start.getTime());
      target.setMonth(target.getMonth() + EXAMPLE.version.months);

      var traits = EXAMPLE.traits.map(function (t) {
        var rec = Traits.add({
          statement: t.statement, oldSelf: t.oldSelf, newSelf: t.newSelf, why: t.why
        });
        /* setRung rather than passing rung to add(), so the ladder has
           a history to show — a trait that arrived at Frequent without
           ever moving there reads as fiction. */
        if (t.rung !== RUNGS[0]) Traits.setRung(rec.id, t.rung);
        return rec;
      });

      var version = Versions.add({
        name: EXAMPLE.version.name,
        intent: EXAMPLE.version.intent,
        startDate: localISO(start),
        targetDate: localISO(target),
        traitIds: traits.map(function (t) { return t.id; }),
        status: Versions.current() ? 'next' : 'current'
      });

      var practices = EXAMPLE.practices.map(function (p) {
        return Practices.add({
          name: p.name, cadence: p.cadence,
          traitIds: p.traits.map(function (i) { return traits[i].id; })
        });
      });

      var evidence = EXAMPLE.evidence.map(function (e) {
        var d = daysAgo(e.day);
        d.setHours(9 + (e.day % 8), 0, 0, 0);
        return Evidence.add({
          traitId: traits[e.trait].id, versionId: version.id,
          kind: e.kind, text: e.text, at: d.toISOString()
        });
      });

      var milestones = EXAMPLE.milestones.map(function (m) {
        return Milestones.add({
          versionId: version.id, date: localISO(daysAgo(m.day)),
          title: m.title, note: m.note
        });
      });

      Object.keys(EXAMPLE.portrait).forEach(function (k) {
        Portraits.write(version.id, k, EXAMPLE.portrait[k]);
      });

      var reviewWeek = mondayOf(localISO(daysAgo(EXAMPLE.review.weeksBack * 7)));
      Reviews.write(reviewWeek, version.id, EXAMPLE.review.paragraph);

      var state = {
        at: new Date().toISOString(),
        versionId: version.id,
        traitIds: traits.map(function (t) { return t.id; }),
        practiceIds: practices.map(function (p) { return p.id; }),
        evidenceIds: evidence.map(function (e) { return e.id; }),
        milestoneIds: milestones.map(function (m) { return m.id; }),
        reviewWeeks: [reviewWeek]
      };
      writeJSON(KEYS.example, state);
      return state;
    },

    remove: function () {
      var s = Example.state();
      if (!s) return false;

      /* Order matters. The version cascade takes the portrait, images
         and milestones; the trait cascade takes evidence. Anything the
         reader added to the example themselves goes with it, which is
         the honest reading of "remove the example". */
      (s.practiceIds || []).forEach(function (id) { Practices.remove(id); });
      (s.evidenceIds || []).forEach(function (id) { Evidence.remove(id); });
      (s.traitIds || []).forEach(function (id) { Traits.removeCascade(id); });
      if (s.versionId) Versions.removeCascade(s.versionId);
      (s.reviewWeeks || []).forEach(function (w) {
        var r = Reviews.forWeek(w);
        if (r) Reviews.remove(r.id);
      });

      try { localStorage.removeItem(KEYS.example); } catch (e) {}
      return true;
    }
  };

  // ============================================================
  // AUTOSAVE — the single way every long field on this page is saved.
  //
  // A debounce on its own loses whatever was typed in the last few
  // hundred milliseconds before you click a link, and flushing at
  // unload is NOT the fix: under the IndexedDB shim a write queued as
  // the document goes away often never commits. So a field is written
  // on three signals instead:
  //
  //   input   debounced, so a long paragraph is durable WHILE typing
  //   blur    fires before the navigation a link click starts, which
  //           is what actually saves the last sentence
  //   change  the browser's own "this value is final" signal
  //
  // plus a best-effort sweep when the tab is hidden or unloaded, which
  // is a backstop and never the only chance.
  // ============================================================
  var autosaves = [];

  function autosave(el, commit, ms) {
    if (!el || typeof commit !== 'function') return null;
    var timer = null, dirty = false, last = el.value;

    function fire() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!dirty) return;
      dirty = false;
      last = el.value;
      commit(last);
    }

    el.addEventListener('input', function () {
      if (el.value === last) return;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, ms == null ? 260 : ms);
    });
    el.addEventListener('blur', fire);
    el.addEventListener('change', fire);

    // Detached handles belong to a render that is gone; drop them
    // rather than letting the list grow for the life of the tab.
    if (autosaves.length > 64) {
      autosaves = autosaves.filter(function (h) { return h.el.isConnected; });
    }
    var handle = { el: el, flush: fire };
    autosaves.push(handle);
    return handle;
  }

  autosave.flushAll = function () {
    autosaves = autosaves.filter(function (h) { return h.el.isConnected; });
    autosaves.forEach(function (h) { h.flush(); });
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) autosave.flushAll();
  });
  window.addEventListener('pagehide', function () { autosave.flushAll(); });

  // Cross-tab live updates. Editing in one tab updates the reel in
  // another without a reload. In row/ the IndexedDB shim re-fires this
  // same event, so this keeps working there unchanged.
  function onChange(fn) {
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('chr:') === 0) fn();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) fn();
    });
  }

  window.ChrysalisDB = {
    KEYS: KEYS,
    STATUS: STATUS,
    RUNGS: RUNGS,
    CADENCES: CADENCES,
    EVIDENCE_KINDS: EVIDENCE_KINDS,
    PORTRAIT_FIELDS: PORTRAIT_FIELDS,
    Stages: Stages,
    Versions: Versions,
    Images: Images,
    Milestones: Milestones,
    Portraits: Portraits,
    Traits: Traits,
    Evidence: Evidence,
    Practices: Practices,
    Reviews: Reviews,
    Notes: Notes,
    Example: Example,
    today: today,
    localISO: localISO,
    mondayOf: mondayOf,
    dayNumber: dayNumber,
    traitOfTheDay: traitOfTheDay,
    autosave: autosave,
    compressImageDataUrl: compressImageDataUrl,
    seedAfterSyncAttempt: seedAfterSyncAttempt,
    onChange: onChange,
    SEED: SEED
  };
})();
