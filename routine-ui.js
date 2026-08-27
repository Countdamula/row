// =============================================================
// routine-ui.js — everything that draws a routine step.
//
// Split out of today-ui.js on 2026-08-26, when Main became a hub and
// the routine got a page of its own. Both documents load this file and
// both get the identical step: index.html renders it COMPACT (a ruled
// line you can tick and open), routine.html renders it FULL (numbered,
// timed, editable). One renderer, two densities — the alternative was
// two implementations of a checkbox that drift apart in a fortnight.
//
// It also owns the things that live INSIDE a step:
//
//   the five beliefs + the 30-day lock   (Mirror sub-step 3)
//   the three present-tense lines        (Mirror sub-step 4)
//   tonight's evidence / reflection      (the Script tonight step)
//   the frog                             (Work on the business)
//
// which is why they are reachable from Main at all. The routine got
// smaller on the hub; it did not become undoable there.
//
// ─────────────────────────────────────────────────────────────
// THIS FILE ATTACHES NO LISTENERS.
//
// Two documents, one delegated click handler each. If this file also
// bound to `document`, every action on routine.html would run twice —
// once here and once in the page's own handler — and a checkbox that
// toggles twice is a checkbox that does nothing. The host calls
// RoutineUI.onClick(e) first and returns early when it reports the
// event handled.
// ─────────────────────────────────────────────────────────────
// =============================================================

(function (global) {
  'use strict';

  var T = null;

  // Shared view state. It is not persisted: which steps you had open
  // is a property of this visit, and writing it would sync one
  // device's scroll position to another's.
  var openStep = {};
  var beliefFilter = 'All';
  var editingStepId = null;

  // Hooks the host installs. Defaults keep this file usable — and
  // debuggable — if a page forgets to configure it.
  var hooks = {
    toast: function () {},
    go: function (href) { global.location.href = href; },
    debounce: function (k, fn) { fn(); },
    rerender: function () {}
  };

  function configure(h) {
    T = global.TodayData;
    Object.keys(h || {}).forEach(function (k) { if (h[k]) hooks[k] = h[k]; });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function byId(id) { return document.getElementById(id); }
  function d() { return T.todayISO(); }

  // ============================================================
  // A STEP
  // ============================================================

  /**
   * One step. `opts.compact` is the hub's density: no number, no edit
   * pencil, no note until you open it, and the time and duration
   * demoted to a right-hand rail.
   *
   * An optional step (0 minutes at this level) keeps its place and
   * stays tickable in BOTH densities. At Low the routine is shorter,
   * not lesser, and a step greyed into oblivion is a step being
   * marked as a failure.
   */
  function stepHtml(row, n, level, log, opts) {
    opts = opts || {};
    var s = row.step;
    var done = !!log.steps[s.id];
    var expanded = !!openStep[s.id];
    var hasBody = s.substeps.length || s.prompts.length || s.videos.length || s.slot;

    if (opts.compact) return compactStepHtml(row, s, done, expanded, hasBody, level, log);

    var meta = [];
    if (row.optional) meta.push('<span class="mn-step__dur">Optional today</span>');
    else {
      meta.push('<span class="mn-step__time">' + esc(row.start) + '</span>');
      meta.push('<span class="mn-step__dur">' + row.mins + ' min</span>');
    }
    if (s.linkHref) {
      meta.push('<button type="button" class="mn-btn mn-btn--sm" data-act="go" data-href="' +
        esc(s.linkHref) + '">' + esc(s.linkLabel || 'Open') + '</button>');
    }
    if (hasBody) {
      meta.push('<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" data-act="toggle-body" data-id="' + s.id + '"' +
        ' aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        (expanded ? 'Less' : 'More') + '</button>');
    }
    meta.push('<button type="button" class="bs-icon-btn" data-act="edit-step" data-id="' + s.id + '" title="Edit this step" aria-label="Edit ' + esc(s.title) + '">&#9998;</button>');

    return '<div class="mn-step' + (done ? ' is-done' : '') + '">' +
      '<div class="mn-step__top">' +
        '<input type="checkbox" class="mn-check" data-act="toggle-step" data-id="' + s.id + '"' +
          (done ? ' checked' : '') + ' aria-label="' + esc(s.title) + '">' +
        '<span class="mn-step__n">' + n + '</span>' +
        '<div class="mn-step__main">' +
          '<div class="mn-step__title">' + esc(s.title) + '</div>' +
          (s.note ? '<div class="mn-step__note">' + esc(s.note) + '</div>' : '') +
          '<div class="mn-step__meta">' + meta.join('') + '</div>' +
          (hasBody ? '<div class="mn-step__body"' + (expanded ? '' : ' hidden') + '>' + stepBodyHtml(s, log, level) + '</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * The hub density. A ruled line: tick, title, destination, time.
   *
   * The title is the disclosure control rather than a separate "More"
   * button — on a line this short a second button next to the first
   * one is just noise, and the whole row is already a target.
   */
  function compactStepHtml(row, s, done, expanded, hasBody, level, log) {
    var rail = row.optional
      ? '<span class="mn-line__opt">Optional</span>'
      : '<span class="mn-line__time">' + esc(row.start) + '</span>';

    return '<div class="mn-line' + (done ? ' is-done' : '') + (expanded ? ' is-open' : '') + '">' +
      '<div class="mn-line__top">' +
        '<input type="checkbox" class="mn-check" data-act="toggle-step" data-id="' + s.id + '"' +
          (done ? ' checked' : '') + ' aria-label="' + esc(s.title) + '">' +
        (hasBody
          ? '<button type="button" class="mn-line__title" data-act="toggle-body" data-id="' + s.id + '"' +
            ' aria-expanded="' + (expanded ? 'true' : 'false') + '">' + esc(s.title) + '</button>'
          : '<span class="mn-line__title mn-line__title--plain">' + esc(s.title) + '</span>') +
        '<span class="mn-line__leader" aria-hidden="true"></span>' +
        (s.linkHref
          ? '<button type="button" class="mn-line__go" data-act="go" data-href="' + esc(s.linkHref) + '">' +
            esc(s.linkLabel || 'Open') + ' <span aria-hidden="true">&rarr;</span></button>'
          : '') +
        rail +
      '</div>' +
      (hasBody
        ? '<div class="mn-line__body"' + (expanded ? '' : ' hidden') + '>' +
          (s.note ? '<p class="mn-step__note">' + esc(s.note) + '</p>' : '') +
          stepBodyHtml(s, log, level) + '</div>'
        : '');
  }

  function stepBodyHtml(s, log, level) {
    var out = '';

    if (s.substeps.length) {
      out += '<div class="mn-stack--tight" style="display:flex;flex-direction:column">' +
        s.substeps.map(function (sub) {
          var on = !!log.substeps[sub.id];
          return '<label class="mn-check-row' + (on ? ' is-done' : '') + '">' +
            '<input type="checkbox" class="mn-check" data-act="toggle-sub" data-id="' + sub.id + '"' + (on ? ' checked' : '') + '>' +
            '<span class="mn-check-row__text">' + esc(sub.text) + '</span>' +
            '</label>';
        }).join('') + '</div>';
    }

    // The carried-forward artefacts open INSIDE the step that uses
    // them. The five and the three lines are Mirror sub-steps 3 and 4;
    // putting them in a section of their own further down the page
    // would be the same content twice.
    if (s.slot === 'beliefs') out += recitationHtml();
    if (s.slot === 'beliefs') out += intentionsHtml();
    if (s.slot === 'tonight') out += tonightHtml();
    if (s.slot === 'frog') out += frogHtml();

    if (s.prompts.length) {
      out += '<div class="mn-stack" style="margin-top:18px">' + s.prompts.map(function (p) {
        return '<div class="mn-field">' +
          '<label class="mn-label" for="pr_' + p.id + '">' + esc(p.text) + '</label>' +
          '<textarea class="mn-textarea" id="pr_' + p.id + '" data-act="prompt" data-id="' + p.id + '"' +
          ' rows="2" placeholder="…">' + esc(log.prompts[p.id] || '') + '</textarea>' +
          '</div>';
      }).join('') + '</div>';
    }

    if (s.videos.length) {
      out += '<div class="mn-stack--tight" style="margin-top:18px;display:flex;flex-direction:column">' +
        s.videos.map(function (v) {
          return '<a class="mn-row" href="' + esc(v.url) + '" target="_blank" rel="noopener">' +
            '<span class="mn-label mn-label--gold">Watch</span>' +
            '<span>' + esc(v.title || v.url) + '</span></a>';
        }).join('') + '</div>';
    }

    return out;
  }

  /** The five, and the 30-day lock. This IS Mirror sub-step 3. */
  function recitationHtml() {
    var five = T.working();
    var lock = T.lockState();
    var caught = T.ritualDay().caught;

    var boxes = '';
    for (var i = 0; i < 30; i++) {
      var state = i < lock.done ? 'done' : (i === lock.done ? 'today' : '');
      boxes += '<button type="button" class="mn-lockbox"' + (state ? ' data-state="' + state + '"' : '') +
        ' disabled aria-label="Day ' + (i + 1) + '"></button>';
    }

    return '<div class="mn-card mn-card--quiet" style="margin-top:18px">' +
      '<div class="mn-card__head">' +
        '<h4 class="mn-plate mn-plate--sm">The five</h4>' +
        '<span class="mn-label">Day ' + lock.day + ' of 30</span>' +
      '</div>' +
      (five.length
        ? '<div class="mn-stack--tight" style="display:flex;flex-direction:column">' + five.map(function (b, i) {
            return '<div class="mn-row mn-row--between" style="align-items:flex-start;gap:12px">' +
              '<span class="mn-fig" style="font-size:15px;color:var(--mn-text-3);min-width:1.6em">' + roman(i + 1) + '</span>' +
              '<span style="flex:1;min-width:0;font-family:var(--mn-display);font-size:18px;line-height:1.4">' + esc(b.text) + '</span>' +
              '<button type="button" class="mn-chip" data-act="caught" data-id="' + b.id + '"' +
                ' aria-pressed="' + (caught === b.id ? 'true' : 'false') + '">Caught</button>' +
              '</div>';
          }).join('') + '</div>'
        : '<p class="mn-small">No beliefs are marked Working On. Add one on the Daily Routine page.</p>') +
      '<div class="mn-lock" style="margin-top:18px">' + boxes + '</div>' +
      '<p class="mn-small" style="margin-top:10px">Editing, adding or removing a belief restarts the thirty days. ' +
        (lock.complete ? '<strong style="color:var(--mn-gold)">Thirty days are up — time to look at these again.</strong>' : '') +
      '</p>' +
    '</div>';
  }

  function roman(n) {
    var vals = [10, 9, 5, 4, 1], syms = ['X', 'IX', 'V', 'IV', 'I'], out = '', i = 0;
    while (n > 0) { if (n >= vals[i]) { out += syms[i]; n -= vals[i]; } else i++; }
    return out;
  }

  /** The three present-tense lines. This IS Mirror sub-step 4. */
  function intentionsHtml() {
    var e = T.intentions();
    var lines = e.intentions || ['', '', ''];
    return '<div class="mn-card mn-card--quiet" style="margin-top:14px">' +
      '<div class="mn-card__head"><h4 class="mn-plate mn-plate--sm">Today, present tense</h4></div>' +
      '<div class="mn-stack--tight" style="display:flex;flex-direction:column">' +
        [0, 1, 2].map(function (i) {
          return '<input class="mn-input" data-act="intention" data-i="' + i + '"' +
            ' value="' + esc(lines[i] || '') + '" placeholder="' + esc(['I …', 'I …', 'I …'][i]) + '"' +
            ' aria-label="Present-tense line ' + (i + 1) + '">';
        }).join('') +
      '</div>' +
      '<div class="mn-field" style="margin-top:14px">' +
        '<label class="mn-label" for="mnIfThen">If, then</label>' +
        '<textarea class="mn-textarea" id="mnIfThen" data-act="ifthen" rows="2" placeholder="If I …, then I …">' + esc(e.ifthen || '') + '</textarea>' +
      '</div>' +
      '<div class="mn-field" style="margin-top:12px">' +
        '<label class="mn-label" for="mnWhy">Why it matters</label>' +
        '<textarea class="mn-textarea" id="mnWhy" data-act="why" rows="2" placeholder="Because …">' + esc(e.whyItMatters || '') + '</textarea>' +
      '</div>' +
    '</div>';
  }

  /** Tonight's evidence, reflection and gratitude. */
  function tonightHtml() {
    var e = T.tonight();
    var f = [
      ['evidence', 'Evidence', 'What today proved about who you are becoming.'],
      ['reflection', 'Reflection', 'What actually happened.'],
      ['gratitude', 'Gratitude', 'One thing worth having.']
    ];
    return '<div class="mn-card mn-card--quiet" style="margin-top:18px">' +
      f.map(function (row, i) {
        return '<div class="mn-field"' + (i ? ' style="margin-top:14px"' : '') + '>' +
          '<label class="mn-label" for="mnTn_' + row[0] + '">' + row[1] + '</label>' +
          '<textarea class="mn-textarea" id="mnTn_' + row[0] + '" data-act="tonight" data-field="' + row[0] + '"' +
          ' rows="2" placeholder="' + esc(row[2]) + '">' + esc(e[row[0]] || '') + '</textarea>' +
          '</div>';
      }).join('') +
    '</div>';
  }

  /** The one metric: did the frog get started. */
  function frogHtml() {
    var on = T.getFrog();
    return '<div class="mn-card mn-card--quiet" style="margin-top:18px">' +
      '<label class="mn-check-row" style="min-height:0">' +
        '<input type="checkbox" class="mn-check" data-act="frog"' + (on ? ' checked' : '') + '>' +
        '<span class="mn-check-row__text">' +
          '<span style="font-family:var(--mn-display);font-size:19px">I started the frog</span>' +
          '<span class="mn-small" style="display:block">Started, not finished. Finishing is not the thing being measured.</span>' +
        '</span>' +
      '</label>' +
    '</div>';
  }

  // ============================================================
  // A PHASE
  // ============================================================

  /**
   * Every step of one phase. `opts.compact` picks the density;
   * `opts.editable` decides whether an "Add a step" control appears,
   * which is what keeps the editor on routine.html.
   */
  function phaseHtml(phase, opts) {
    opts = opts || {};
    var level = T.getLevel();
    var log = T.dayLog();
    var rows = T.scheduleFor(phase, level);

    if (!rows.length) return emptyPhaseHtml(phase, opts);

    var steps = (opts.compact ? '<div class="mn-lines">' : '<div class="mn-steps">') +
      rows.map(function (r, i) { return stepHtml(r, i + 1, level, log, opts); }).join('') +
      '</div>';

    if (!opts.editable) return steps;
    return steps + '<div class="mn-row" style="margin-top:22px">' +
      '<button type="button" class="mn-btn" data-act="add-step" data-phase="' + phase + '">Add a step</button>' +
      '</div>';
  }

  /**
   * An empty phase.
   *
   * For `day` this is the normal state on an already-seeded device —
   * the phase arrived after the seed ran and seedIfEmpty() will never
   * fire again. So it offers the suggestions as ghosts. NOTHING here
   * is written until one is tapped: a phase that silently populated
   * itself would be indistinguishable from data arriving from the
   * cloud, and you would never know which steps you had chosen.
   */
  function emptyPhaseHtml(phase, opts) {
    if (phase !== 'day') {
      return '<div class="mn-empty"><p>No steps yet.</p>' +
        (opts.editable
          ? '<button type="button" class="mn-btn" data-act="add-step" data-phase="' + phase + '" style="margin-top:14px">Add the first one</button>'
          : '<p class="mn-small" style="margin-top:10px">Add them on the Daily Routine page.</p>') +
        '</div>';
    }

    return '<div class="mn-ghosts">' +
      '<p class="mn-small mn-ghosts__lede">Nothing is written here yet. These are suggestions, not steps — ' +
        'each one is added only when you add it, and every one of them is editable afterwards.</p>' +
      T.DAY_SUGGESTIONS.map(function (g, i) {
        return '<div class="mn-ghost">' +
          '<span class="mn-ghost__mark" aria-hidden="true"></span>' +
          '<div class="mn-ghost__main">' +
            '<div class="mn-ghost__title">' + esc(g.title) + '</div>' +
            '<div class="mn-ghost__note">' + esc(g.note) + '</div>' +
          '</div>' +
          '<button type="button" class="mn-btn mn-btn--sm" data-act="add-suggested" data-i="' + i + '">Add</button>' +
        '</div>';
      }).join('') +
      '<div class="mn-row" style="margin-top:18px">' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="add-suggested" data-i="all">Add all five</button>' +
        '<button type="button" class="mn-btn" data-act="add-step" data-phase="day">Write your own</button>' +
      '</div>' +
    '</div>';
  }

  /** The head of a phase on routine.html: anchor time, ends, done/total. */
  function phaseMetaHtml(phase) {
    var level = T.getLevel();
    var rows = T.scheduleFor(phase, level);
    var p = T.phaseProgress(d(), phase, level);
    var total = T.phaseTotal(phase, level);
    var startVal = T.phaseStart(phase);
    var endsAt = rows.length ? T.fmtTime(rows[rows.length - 1].startMins + rows[rows.length - 1].mins) : startVal;

    return '<label class="mn-label" for="mn_' + phase + '_start">' + esc(T.PHASE_START_LABEL[phase]) + '</label>' +
      '<input type="time" class="mn-input" id="mn_' + phase + '_start" data-act="set-start" data-phase="' + phase + '"' +
        ' value="' + esc(startVal) + '" style="width:auto;min-width:8.5em">' +
      '<span class="mn-label">Ends ' + esc(endsAt) + ' · ' + total + ' min</span>' +
      '<span class="mn-label mn-label--gold">' + p.done + ' / ' + p.total + '</span>';
  }

  // ============================================================
  // THE RECORD + THE BELIEFS DATABASE
  // ============================================================
  function recordHtml() {
    var c = T.counts30();
    var lock = T.lockState();
    var rows = T.last30();

    return '<div class="mn-grid3">' +
        tile(lock.day, 'Day of 30') +
        tile(c.ran, 'Run, last 30') +
        tile(c.frog, 'Frog started') +
      '</div>' +
      '<div class="mn-card" style="margin-top:18px">' +
        '<div class="mn-card__head"><h4 class="mn-plate mn-plate--sm">The last thirty days</h4></div>' +
        '<div class="mn-row" style="gap:4px">' + rows.map(function (r) {
          var col = r.frog ? 'var(--mn-amber)' : (r.ran ? 'var(--mn-copper)' : 'transparent');
          var bd = r.ran ? 'transparent' : 'var(--mn-hair-soft)';
          return '<span title="' + esc(r.date) + (r.frog ? ' — frog started' : (r.ran ? ' — ran' : '')) + '"' +
            ' style="width:16px;height:22px;border-radius:3px;background:' + col + ';border:1px solid ' + bd + '"></span>';
        }).join('') + '</div>' +
      '</div>' +
      beliefDbHtml();
  }

  function tile(v, label) {
    return '<div class="mn-card"><div class="mn-fig mn-fig--lg">' + v + '</div>' +
      '<p class="mn-label" style="margin-top:10px">' + esc(label) + '</p></div>';
  }

  function beliefDbHtml() {
    var all = T.beliefs();
    var shown = beliefFilter === 'All' ? all : all.filter(function (b) { return b.status === beliefFilter; });
    var chips = ['All'].concat(T.BELIEF_STATUSES).map(function (s) {
      return '<button type="button" class="mn-chip" data-act="belief-filter" data-v="' + esc(s) + '"' +
        ' aria-pressed="' + (beliefFilter === s ? 'true' : 'false') + '">' + esc(s) + '</button>';
    }).join('');

    return '<div class="mn-card" style="margin-top:18px">' +
      '<div class="mn-card__head">' +
        '<h4 class="mn-plate mn-plate--sm">Beliefs</h4>' +
        '<button type="button" class="mn-btn mn-btn--sm" data-act="add-belief">Add a belief</button>' +
      '</div>' +
      '<div class="mn-row" style="margin-bottom:16px">' + chips + '</div>' +
      (shown.length
        ? '<div class="bs-list">' + shown.map(function (b) {
            return '<div class="bs-card">' +
              '<div class="bs-card-top">' +
                '<div class="bs-card-title-wrap">' +
                  '<span class="bs-card-title">' + esc(b.text) + '</span>' +
                  (b.category ? '<span class="bs-tag">' + esc(b.category) + '</span>' : '') +
                  '<span class="bs-tag' + (b.status === 'Working On' ? ' is-accent' : '') + '">' + esc(b.status) + '</span>' +
                '</div>' +
                '<div class="bs-card-actions">' +
                  '<button type="button" class="bs-icon-btn" data-act="edit-belief" data-id="' + b.id + '" aria-label="Edit belief">&#9998;</button>' +
                  '<button type="button" class="bs-icon-btn is-del" data-act="del-belief" data-id="' + b.id + '" aria-label="Delete belief">&#10005;</button>' +
                '</div>' +
              '</div>' +
              (b.notes ? '<div class="bs-card-body">' + esc(b.notes) + '</div>' : '') +
            '</div>';
          }).join('') + '</div>'
        : '<p class="bs-empty">Nothing here at this filter.</p>') +
    '</div>';
  }

  // ============================================================
  // SHEETS — the layer-2 editors. Both documents carry #mnSheetBg.
  // ============================================================
  function openSheet(html) {
    var bg = byId('mnSheetBg');
    var sheet = byId('mnSheet');
    if (!bg || !sheet) return;
    sheet.innerHTML = html;
    bg.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var first = sheet.querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeSheet() {
    var bg = byId('mnSheetBg');
    if (!bg) return;
    bg.classList.remove('is-open');
    document.body.style.overflow = '';
    editingStepId = null;
  }

  function openStepEditor(id, phase) {
    var s = id ? T.Routines.get(id) : null;
    editingStepId = id;
    var m = s ? s.mins : { high: 15, mid: 10, low: 5 };

    openSheet(
      '<div class="mn-sheet__head">' +
        '<h3 class="mn-plate mn-plate--md">' + (s ? 'Edit step' : 'New step') + '</h3>' +
        '<button type="button" class="bs-modal-close" data-act="close-sheet" aria-label="Close">&#10005;</button>' +
      '</div>' +
      '<div class="mn-grid2">' +
        '<div class="mn-field"><label class="mn-label" for="stTitle">Title</label>' +
          '<input class="mn-input" id="stTitle" value="' + esc(s ? s.title : '') + '"></div>' +
        '<div class="mn-field"><label class="mn-label" for="stPhase">Part of the day</label>' +
          '<select class="mn-select" id="stPhase">' + T.PHASES.map(function (p) {
            var on = (s ? s.phase : (phase || 'morning')) === p;
            return '<option value="' + p + '"' + (on ? ' selected' : '') + '>' + esc(T.PHASE_LABEL[p]) + '</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="stNote">Note</label>' +
        '<textarea class="mn-textarea" id="stNote" rows="2">' + esc(s ? s.note : '') + '</textarea></div>' +
      '<p class="mn-label" style="margin-top:20px">Minutes at each effort level</p>' +
      '<p class="mn-small" style="margin-bottom:10px">Zero means the step is optional at that level — it keeps its place in the list and takes no time from the schedule.</p>' +
      '<div class="mn-grid3">' +
        ['high', 'mid', 'low'].map(function (k) {
          return '<div class="mn-field"><label class="mn-label" for="stM_' + k + '">' + T.LEVEL_COPY[k].name + '</label>' +
            '<input class="mn-input" type="number" min="0" max="600" id="stM_' + k + '" value="' + (m[k] || 0) + '"></div>';
        }).join('') +
      '</div>' +
      '<div class="mn-grid2" style="margin-top:14px">' +
        '<div class="mn-field"><label class="mn-label" for="stHref">Link (optional)</label>' +
          '<input class="mn-input" id="stHref" value="' + esc(s ? s.linkHref : '') + '" placeholder="palaestra.html"></div>' +
        '<div class="mn-field"><label class="mn-label" for="stLabel">Link label</label>' +
          '<input class="mn-input" id="stLabel" value="' + esc(s ? s.linkLabel : '') + '" placeholder="Open the Fitness Studio"></div>' +
      '</div>' +
      subEditor('Sub-steps', 'sub', s ? s.substeps : []) +
      subEditor('Reflection prompts', 'prompt', s ? s.prompts : []) +
      videoEditor(s ? s.videos : []) +
      '<div class="mn-sheet__actions">' +
        (s ? '<button type="button" class="mn-btn mn-btn--ghost" data-act="del-step" style="margin-right:auto;color:var(--mn-bad)">Delete this step</button>' : '') +
        '<button type="button" class="mn-btn" data-act="close-sheet">Cancel</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="save-step">Save</button>' +
      '</div>'
    );
  }

  function subEditor(label, kind, list) {
    return '<div style="margin-top:20px">' +
      '<div class="mn-row mn-row--between"><p class="mn-label">' + label + '</p>' +
        '<button type="button" class="mn-btn mn-btn--sm" data-act="add-row" data-kind="' + kind + '">Add</button></div>' +
      '<div class="mn-stack--tight" id="rows_' + kind + '" style="display:flex;flex-direction:column;margin-top:10px">' +
        list.map(function (x) { return subRow(kind, x.id, x.text); }).join('') +
      '</div></div>';
  }
  function subRow(kind, id, text) {
    return '<div class="mn-row" data-row="' + kind + '" data-id="' + esc(id || '') + '">' +
      '<textarea class="mn-textarea" rows="2" style="min-height:56px">' + esc(text || '') + '</textarea>' +
      '<button type="button" class="bs-icon-btn is-del" data-act="rm-row" aria-label="Remove">&#10005;</button>' +
      '</div>';
  }
  function videoEditor(list) {
    return '<div style="margin-top:20px">' +
      '<div class="mn-row mn-row--between"><p class="mn-label">Videos</p>' +
        '<button type="button" class="mn-btn mn-btn--sm" data-act="add-row" data-kind="video">Add</button></div>' +
      '<div class="mn-stack--tight" id="rows_video" style="display:flex;flex-direction:column;margin-top:10px">' +
        list.map(function (v) { return videoRow(v.id, v.title, v.url); }).join('') +
      '</div></div>';
  }
  function videoRow(id, title, url) {
    return '<div class="mn-row" data-row="video" data-id="' + esc(id || '') + '">' +
      '<input class="mn-input" data-f="title" value="' + esc(title || '') + '" placeholder="Title" style="flex:1">' +
      '<input class="mn-input" data-f="url" value="' + esc(url || '') + '" placeholder="https://…" style="flex:2">' +
      '<button type="button" class="bs-icon-btn is-del" data-act="rm-row" aria-label="Remove">&#10005;</button>' +
      '</div>';
  }

  function readRows(kind) {
    var host = byId('rows_' + kind);
    if (!host) return [];
    return Array.prototype.map.call(host.querySelectorAll('[data-row]'), function (row, i) {
      if (kind === 'video') {
        return {
          id: row.getAttribute('data-id') || undefined,
          title: row.querySelector('[data-f="title"]').value.trim(),
          url: row.querySelector('[data-f="url"]').value.trim(),
          order: i
        };
      }
      return { id: row.getAttribute('data-id') || undefined, text: row.querySelector('textarea').value.trim(), order: i };
    }).filter(function (x) { return kind === 'video' ? x.url : x.text; });
  }

  function saveStepEditor() {
    var before = editingStepId ? (T.Routines.get(editingStepId) || {}).phase : null;
    var fields = {
      phase: byId('stPhase').value,
      title: byId('stTitle').value.trim(),
      note: byId('stNote').value.trim(),
      mins: { high: byId('stM_high').value, mid: byId('stM_mid').value, low: byId('stM_low').value },
      linkHref: byId('stHref').value.trim(),
      linkLabel: byId('stLabel').value.trim(),
      substeps: readRows('sub'),
      prompts: readRows('prompt'),
      videos: readRows('video')
    };
    if (!fields.title) { hooks.toast('A step needs a title.', true); return; }
    if (editingStepId) T.Routines.update(editingStepId, fields);
    else T.Routines.add(fields);
    closeSheet();
    // A step can be MOVED between phases, so the phase it left has to
    // redraw too or it keeps showing a step that is no longer in it.
    if (before && before !== fields.phase) hooks.rerender('phase:' + before);
    hooks.rerender('phase:' + fields.phase);
    hooks.toast('Saved');
  }

  function openBeliefEditor(id) {
    var b = id ? T.beliefs().find(function (x) { return x.id === id; }) : null;
    openSheet(
      '<div class="mn-sheet__head">' +
        '<h3 class="mn-plate mn-plate--md">' + (b ? 'Edit belief' : 'New belief') + '</h3>' +
        '<button type="button" class="bs-modal-close" data-act="close-sheet" aria-label="Close">&#10005;</button>' +
      '</div>' +
      '<p class="mn-small" style="margin-bottom:16px">Changing the text of a belief, or adding or removing one, restarts the thirty-day lock. That is the point of it.</p>' +
      '<input type="hidden" id="blId" value="' + esc(id || '') + '">' +
      '<div class="mn-field"><label class="mn-label" for="blText">Belief</label>' +
        '<textarea class="mn-textarea" id="blText" rows="2">' + esc(b ? b.text : '') + '</textarea></div>' +
      '<div class="mn-grid2" style="margin-top:14px">' +
        '<div class="mn-field"><label class="mn-label" for="blCat">Category</label>' +
          '<input class="mn-input" id="blCat" value="' + esc(b ? b.category : '') + '"></div>' +
        '<div class="mn-field"><label class="mn-label" for="blStatus">Status</label>' +
          '<select class="mn-select" id="blStatus">' + T.BELIEF_STATUSES.map(function (s) {
            return '<option' + (b && b.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="blNotes">Notes</label>' +
        '<textarea class="mn-textarea" id="blNotes" rows="3">' + esc(b ? b.notes : '') + '</textarea></div>' +
      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="close-sheet">Cancel</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="save-belief">Save</button>' +
      '</div>'
    );
  }

  function saveBeliefEditor() {
    var id = byId('blId').value;
    var text = byId('blText').value.trim();
    if (!text) { hooks.toast('A belief needs some words.', true); return; }
    var fields = { text: text, category: byId('blCat').value.trim(), status: byId('blStatus').value, notes: byId('blNotes').value.trim() };
    if (id) {
      var cur = T.beliefs().find(function (x) { return x.id === id; });
      T.updateBelief(id, fields, !cur || cur.text !== text);
    } else {
      T.addBelief(fields);
    }
    closeSheet();
    hooks.rerender('record');
    hooks.rerender('phase:morning');
    hooks.toast('Saved — the thirty days start again today');
  }

  // ============================================================
  // EVENTS — offered to the host, never bound here.
  // ============================================================

  /** The phase a step, sub-step or prompt id belongs to. */
  function stepPhase(id) {
    var s = id && T.Routines.get(id);
    if (s) return s.phase;
    var owner = T.Routines.list().find(function (x) {
      return x.substeps.some(function (y) { return y.id === id; }) ||
             x.prompts.some(function (y) { return y.id === id; });
    });
    return owner ? owner.phase : 'morning';
  }

  /** @return true when the event belonged to the routine. */
  function onClick(e) {
    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return false;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    switch (act) {
      case 'toggle-body':
        openStep[id] = !openStep[id];
        hooks.rerender('phase:' + stepPhase(id));
        return true;

      case 'toggle-step':
        T.toggleStep(d(), id, el.checked);
        hooks.rerender('phase:' + stepPhase(id));
        hooks.rerender('progress');
        return true;

      case 'toggle-sub':
        T.toggleSub(d(), id, el.checked);
        return true;

      case 'frog':
        T.setFrog(d(), el.checked);
        hooks.rerender('record');
        return true;

      case 'caught':
        T.setCaught(d(), id);
        hooks.rerender('phase:morning');
        return true;

      case 'edit-step': openStepEditor(id); return true;
      case 'add-step': openStepEditor(null, el.getAttribute('data-phase')); return true;
      case 'save-step': saveStepEditor(); return true;

      case 'add-suggested': {
        var which = el.getAttribute('data-i');
        var list = which === 'all'
          ? T.DAY_SUGGESTIONS
          : [T.DAY_SUGGESTIONS[parseInt(which, 10)]].filter(Boolean);
        list.forEach(function (g, i) { T.Routines.add(Object.assign({ order: i }, g)); });
        hooks.rerender('phase:day');
        hooks.rerender('progress');
        hooks.toast(list.length === 1 ? 'Added — edit it any time' : 'Five steps added to the day');
        return true;
      }

      case 'del-step': {
        if (!confirm('Delete this step? Its history stays in the log.')) return true;
        var ph = stepPhase(editingStepId);
        T.Routines.remove(editingStepId);
        closeSheet();
        hooks.rerender('phase:' + ph);
        hooks.rerender('progress');
        hooks.toast('Step deleted');
        return true;
      }

      case 'add-row': {
        var kind = el.getAttribute('data-kind');
        var host = byId('rows_' + kind);
        if (host) host.insertAdjacentHTML('beforeend', kind === 'video' ? videoRow('', '', '') : subRow(kind, '', ''));
        return true;
      }
      case 'rm-row': { var row = el.closest('[data-row]'); if (row) row.remove(); return true; }
      case 'close-sheet': closeSheet(); return true;

      case 'belief-filter': beliefFilter = el.getAttribute('data-v'); hooks.rerender('record'); return true;
      case 'add-belief': openBeliefEditor(null); return true;
      case 'edit-belief': openBeliefEditor(id); return true;
      case 'save-belief': saveBeliefEditor(); return true;
      case 'del-belief':
        if (!confirm('Delete this belief entirely? This removes it from the database, not just today’s recitation, and restarts the thirty days.')) return true;
        T.removeBelief(id);
        hooks.rerender('record');
        hooks.rerender('phase:morning');
        return true;
    }
    return false;
  }

  function onInput(e) {
    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return false;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    if (act === 'prompt') {
      hooks.debounce('p' + id, function () { T.setPrompt(d(), id, el.value); });
      return true;
    }
    if (act === 'intention') {
      hooks.debounce('int', function () {
        var lines = (T.intentions().intentions || ['', '', '']).slice();
        var inputs = document.querySelectorAll('[data-act="intention"]');
        Array.prototype.forEach.call(inputs, function (n) { lines[+n.getAttribute('data-i')] = n.value; });
        T.saveIntentions(d(), { intentions: lines });
      });
      return true;
    }
    if (act === 'ifthen') { hooks.debounce('ift', function () { T.saveIntentions(d(), { ifthen: el.value }); }); return true; }
    if (act === 'why') { hooks.debounce('why', function () { T.saveIntentions(d(), { whyItMatters: el.value }); }); return true; }
    if (act === 'tonight') {
      var f = el.getAttribute('data-field');
      hooks.debounce('tn' + f, function () { var p = {}; p[f] = el.value; T.saveTonight(d(), p); });
      return true;
    }
    return false;
  }

  function onChange(e) {
    var el = e.target.closest && e.target.closest('[data-act="set-start"]');
    if (!el) return false;
    var phase = el.getAttribute('data-phase');
    T.savePhaseStart(phase, el.value);
    hooks.rerender('phase:' + phase);
    return true;
  }

  global.RoutineUI = {
    configure: configure,
    phaseHtml: phaseHtml,
    phaseMetaHtml: phaseMetaHtml,
    stepHtml: stepHtml,
    recordHtml: recordHtml,
    beliefDbHtml: beliefDbHtml,
    openStepEditor: openStepEditor,
    closeSheet: closeSheet,
    stepPhase: stepPhase,
    onClick: onClick,
    onInput: onInput,
    onChange: onChange
  };
})(window);
