// =============================================================
// today-ui.js — Main's Today page.
//
// Renders the four bands:
//   A  the effort card         (writes pal:levels, shared with the Fitness Studio)
//   B  the morning routine     (clock times from wake + today's level)
//   C  the evening routine     (clock times from the wind-down time)
//   D  the record              (beliefs database, 30 days, the frog)
//
// Data is today-data.js. Styling is main-theme.css. The hero and the
// medallion are main-hero.js.
//
// TWO RULES THIS FILE IS BUILT AROUND
//
// 1. A RE-RENDER MUST NOT SCROLL. Every repaint here can be triggered
//    by a cloud pull at a moment nobody chose — another device saving
//    something. Nothing below calls scrollTo, and every renderer
//    writes into a fixed host so the page keeps its position.
//
// 2. A WRITE FOLLOWED BY A NAVIGATION LOSES THE WRITE. localStorage is
//    IndexedDB underneath now and its writes commit asynchronously, so
//    leaving the document in the same tick drops them. Every link out
//    of this page goes through go(), which uses
//    LocalStoreIDB.navigate().
// =============================================================

(function (global) {
  'use strict';

  var T = null;                 // window.TodayData, resolved at boot
  var activeTab = 'today';
  var openStep = {};            // stepId -> bool, which steps are expanded
  var editingStepId = null;
  var beliefFilter = 'All';
  var saveTimers = {};

  function d() { return T.todayISO(); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function byId(id) { return document.getElementById(id); }

  /** Debounced write. 400ms — long enough not to thrash IndexedDB on
      every keystroke, short enough that a quick tab-away still lands. */
  function debounce(key, fn, ms) {
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(fn, ms == null ? 400 : ms);
  }
  function flushSaves() {
    Object.keys(saveTimers).forEach(function (k) {
      clearTimeout(saveTimers[k]);
    });
    saveTimers = {};
  }

  /** Leave the page without losing a write that has not committed. */
  function go(href) {
    flushSaves();
    if (global.LocalStoreIDB && global.LocalStoreIDB.navigate) global.LocalStoreIDB.navigate(href);
    else global.location.href = href;
  }

  function toast(msg, bad) {
    var t = byId('mnToast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'mn-toast is-on' + (bad ? ' mn-toast--bad' : '');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = 'mn-toast' + (bad ? ' mn-toast--bad' : ''); }, bad ? 5000 : 2400);
  }

  function prettyDate(iso) {
    var p = String(iso).split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ============================================================
  // BAND A — THE EFFORT CARD
  // ============================================================
  function renderEffort() {
    var host = byId('mnEffort');
    if (!host) return;
    var date = d();
    var level = T.getLevel(date);
    var chosen = T.hasLevel(date);

    host.innerHTML = T.LEVEL_KEYS.map(function (k) {
      var c = T.LEVEL_COPY[k];
      var on = k === level;
      return '<button type="button" class="mn-level" data-act="set-level" data-level="' + k + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' data-chosen="' + (on && chosen ? 'true' : 'false') + '">' +
        '<span class="mn-level__name">' + esc(c.name) + '</span>' +
        '<span class="mn-level__title">' + esc(c.title) + '</span>' +
        '<span class="mn-level__mins">' + esc(c.mins) + '</span>' +
        '<span class="mn-level__blurb">' + esc(c.blurb) + '</span>' +
        '<span class="mn-level__when">' + esc(c.when) + '</span>' +
        '</button>';
    }).join('');

    var hint = byId('mnEffortHint');
    if (hint) {
      hint.textContent = chosen
        ? 'This sets today’s workout in the Fitness Studio and today’s meditations in Self-Care.'
        : 'Not answered yet — everything below is showing the High version until you pick one.';
      hint.className = 'mn-small' + (chosen ? '' : ' mn-label--cool');
    }
    renderMedal();
  }

  function renderMedal() {
    if (!global.MainHero || !global.MainHero.setMedal) return;
    var date = d();
    var level = T.getLevel(date);
    var chosen = T.hasLevel(date);
    var c = T.LEVEL_COPY[level];
    global.MainHero.setMedal({
      lead: chosen ? 'Today' : 'Pick one',
      main: c.name,
      level: level,
      chosen: chosen,
      rim: prettyDate(date),
      label: chosen
        ? 'Today’s effort level is ' + c.name + '. Change it.'
        : 'Choose today’s effort level. Currently showing ' + c.name + '.',
      onClick: function () {
        var el = byId('mnEffortSection');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ============================================================
  // BANDS B AND C — THE ROUTINES
  // ============================================================
  function stepHtml(row, n, level, log) {
    var s = row.step;
    var done = !!log.steps[s.id];
    var expanded = !!openStep[s.id];
    var hasBody = s.substeps.length || s.prompts.length || s.videos.length || s.linkHref || s.slot;

    var meta = [];
    // An optional step keeps its place and its number. It is not
    // greyed into oblivion and not hidden — at LOW the routine is
    // shorter, not lesser.
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
        : '<p class="mn-small">No beliefs are marked Working On. Add one in The record below.</p>') +
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

  function renderPhase(phase) {
    var host = byId(phase === 'morning' ? 'mnMorning' : 'mnEvening');
    if (!host) return;
    var level = T.getLevel();
    var log = T.dayLog();
    var rows = T.scheduleFor(phase, level);

    host.innerHTML = rows.length
      ? '<div class="mn-steps">' + rows.map(function (r, i) { return stepHtml(r, i + 1, level, log); }).join('') + '</div>' +
        '<div class="mn-row" style="margin-top:22px">' +
          '<button type="button" class="mn-btn" data-act="add-step" data-phase="' + phase + '">Add a step</button>' +
        '</div>'
      : '<div class="mn-empty"><p>No steps yet.</p>' +
        '<button type="button" class="mn-btn" data-act="add-step" data-phase="' + phase + '" style="margin-top:14px">Add the first one</button></div>';

    var head = byId(phase === 'morning' ? 'mnMorningMeta' : 'mnEveningMeta');
    if (head) {
      var p = T.phaseProgress(d(), phase, level);
      var total = T.phaseTotal(phase, level);
      var sch = T.getSchedule();
      var startLabel = phase === 'morning' ? 'Wake' : 'Wind down';
      var startVal = phase === 'morning' ? sch.wake : sch.windDown;
      var endsAt = rows.length ? T.fmtTime(rows[rows.length - 1].startMins + rows[rows.length - 1].mins) : startVal;
      head.innerHTML =
        '<label class="mn-label" for="mn_' + phase + '_start">' + startLabel + '</label>' +
        '<input type="time" class="mn-input" id="mn_' + phase + '_start" data-act="set-start" data-phase="' + phase + '"' +
          ' value="' + esc(startVal) + '" style="width:auto;min-width:8.5em">' +
        '<span class="mn-label">Ends ' + esc(endsAt) + ' · ' + total + ' min</span>' +
        '<span class="mn-label mn-label--gold">' + p.done + ' / ' + p.total + '</span>';
    }
  }

  // ============================================================
  // BAND D — THE RECORD
  // ============================================================
  function renderRecord() {
    var host = byId('mnRecord');
    if (!host) return;
    var c = T.counts30();
    var lock = T.lockState();
    var rows = T.last30();

    host.innerHTML =
      '<div class="mn-grid3">' +
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
  // SHEETS
  // ============================================================
  function openSheet(html, onMount) {
    var bg = byId('mnSheetBg');
    var sheet = byId('mnSheet');
    if (!bg || !sheet) return;
    sheet.innerHTML = html;
    bg.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var first = sheet.querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 60);
    if (onMount) onMount(sheet);
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
      '<input type="hidden" id="stPhase" value="' + esc(s ? s.phase : (phase || 'morning')) + '">' +
      '<div class="mn-field"><label class="mn-label" for="stTitle">Title</label>' +
        '<input class="mn-input" id="stTitle" value="' + esc(s ? s.title : '') + '"></div>' +
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
    if (!fields.title) { toast('A step needs a title.', true); return; }
    if (editingStepId) T.Routines.update(editingStepId, fields);
    else T.Routines.add(fields);
    closeSheet();
    renderPhase(fields.phase);
    toast('Saved');
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
    if (!text) { toast('A belief needs some words.', true); return; }
    var fields = { text: text, category: byId('blCat').value.trim(), status: byId('blStatus').value, notes: byId('blNotes').value.trim() };
    if (id) {
      var cur = T.beliefs().find(function (x) { return x.id === id; });
      T.updateBelief(id, fields, !cur || cur.text !== text);
    } else {
      T.addBelief(fields);
    }
    closeSheet();
    renderRecord();
    renderPhase('morning');
    toast('Saved — the thirty days start again today');
  }

  // ============================================================
  // TABS + HERO SCENES
  //
  // One hero, mounted once, whose copy changes per tab. The video is
  // never re-created — see main-hero.js's invariant.
  // ============================================================
  var SCENES = {
    today: {
      key: 'today', index: 0, label: 'Today',
      eyebrow: 'The morning call sheet',
      lines: ['Decide what', 'you are capable', 'of today'],
      note: 'One answer, before anything else. It sets the workout, the meditation, and how much of yourself the day is allowed to ask for.'
    },
    selfcare: {
      key: 'selfcare', index: 1, label: 'Self-Care',
      eyebrow: 'Self-Care',
      lines: ['Put yourself', 'back together', 'on purpose'],
      note: 'The checklist, the journal, the meditations and the breathwork. Rest is not something you have to earn.'
    }
  };

  function applyScene(tab) {
    if (!global.MainHero) return;
    // Guarded by key inside setScene: a cloud pull must not replay a
    // full-screen entrance because another device saved something.
    global.MainHero.setScene(SCENES[tab] || SCENES.today);
    global.MainHero.measure();
  }

  function switchTab(tab, opts) {
    opts = opts || {};
    activeTab = (tab === 'selfcare') ? 'selfcare' : 'today';

    document.querySelectorAll('#mnTabs .mn-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === activeTab);
      b.setAttribute('aria-selected', b.dataset.tab === activeTab ? 'true' : 'false');
    });
    document.querySelectorAll('.mn-tabpanel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.mainpanel === activeTab);
    });

    try { T.saveSettings({ activeTab: activeTab }); } catch (e) {}
    if (!opts.silentHash) { try { history.replaceState(null, '', '#' + activeTab); } catch (e) {} }

    applyScene(activeTab);

    // Land on the top of the new CONTENT, not the top of the document.
    // Scrolling to 0 would put a full-screen hero back on the screen
    // and replay it on every tab change.
    if (!opts.noScroll) {
      var anchor = byId('mnTabsAnchor');
      if (anchor) {
        var top = anchor.getBoundingClientRect().top + window.scrollY;
        if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
      }
    }

    if (activeTab === 'selfcare' && typeof global.renderSciTabContent === 'function') {
      global.renderSciTabContent();
    }
  }

  // Old bookmarks and any stale nav link land somewhere rather than
  // nowhere. Four tabs were removed on 2026-08-22; all of them now
  // resolve to Today.
  var LEGACY_TAB = { ritual: 'today', system: 'today', subconscious: 'today', fitness: 'today' };
  function resolveTab(raw) {
    var v = String(raw || '').replace(/^#/, '');
    if (LEGACY_TAB[v]) return LEGACY_TAB[v];
    return (v === 'selfcare' || v === 'today') ? v : null;
  }

  // ============================================================
  // RENDER + WIRE
  // ============================================================
  function renderAll() {
    renderEffort();
    renderPhase('morning');
    renderPhase('evening');
    renderRecord();
    if (global.MainHero) global.MainHero.measure();
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    switch (act) {
      case 'set-level': {
        var lvl = el.getAttribute('data-level');
        T.setLevel(d(), lvl);
        renderEffort();
        renderPhase('morning');
        renderPhase('evening');
        toast(T.LEVEL_COPY[lvl].name + ' · ' + T.LEVEL_COPY[lvl].title);
        break;
      }
      case 'toggle-body': {
        openStep[id] = !openStep[id];
        renderPhase(stepPhase(id));
        break;
      }
      case 'toggle-step': {
        T.toggleStep(d(), id, el.checked);
        renderPhase(stepPhase(id));
        break;
      }
      case 'toggle-sub': {
        T.toggleSub(d(), id, el.checked);
        break;
      }
      case 'frog': {
        T.setFrog(d(), el.checked);
        renderRecord();
        break;
      }
      case 'caught': {
        T.setCaught(d(), id);
        renderPhase('morning');
        break;
      }
      case 'go': { e.preventDefault(); go(el.getAttribute('data-href')); break; }
      case 'edit-step': { openStepEditor(id); break; }
      case 'add-step': { openStepEditor(null, el.getAttribute('data-phase')); break; }
      case 'save-step': { saveStepEditor(); break; }
      case 'del-step': {
        if (!confirm('Delete this step? Its history stays in the log.')) break;
        var ph = stepPhase(editingStepId);
        T.Routines.remove(editingStepId);
        closeSheet();
        renderPhase(ph);
        toast('Step deleted');
        break;
      }
      case 'add-row': {
        var kind = el.getAttribute('data-kind');
        var host = byId('rows_' + kind);
        if (host) host.insertAdjacentHTML('beforeend', kind === 'video' ? videoRow('', '', '') : subRow(kind, '', ''));
        break;
      }
      case 'rm-row': { var row = el.closest('[data-row]'); if (row) row.remove(); break; }
      case 'close-sheet': { closeSheet(); break; }
      case 'belief-filter': { beliefFilter = el.getAttribute('data-v'); renderRecord(); break; }
      case 'add-belief': { openBeliefEditor(null); break; }
      case 'edit-belief': { openBeliefEditor(id); break; }
      case 'save-belief': { saveBeliefEditor(); break; }
      case 'del-belief': {
        if (!confirm('Delete this belief entirely? This removes it from the database, not just today’s recitation, and restarts the thirty days.')) break;
        T.removeBelief(id);
        renderRecord();
        renderPhase('morning');
        break;
      }
    }
  }

  function stepPhase(id) {
    var s = id && T.Routines.get(id);
    if (s) return s.phase;
    // A sub-step or prompt id: find its owner.
    var owner = T.Routines.list().find(function (x) {
      return x.substeps.some(function (y) { return y.id === id; }) ||
             x.prompts.some(function (y) { return y.id === id; });
    });
    return owner ? owner.phase : 'morning';
  }

  function onInput(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    if (act === 'prompt') { debounce('p' + id, function () { T.setPrompt(d(), id, el.value); }); }
    else if (act === 'intention') {
      debounce('int', function () {
        var lines = (T.intentions().intentions || ['', '', '']).slice();
        var inputs = document.querySelectorAll('[data-act="intention"]');
        Array.prototype.forEach.call(inputs, function (n) { lines[+n.getAttribute('data-i')] = n.value; });
        T.saveIntentions(d(), { intentions: lines });
      });
    }
    else if (act === 'ifthen') { debounce('ift', function () { T.saveIntentions(d(), { ifthen: el.value }); }); }
    else if (act === 'why') { debounce('why', function () { T.saveIntentions(d(), { whyItMatters: el.value }); }); }
    else if (act === 'tonight') {
      var f = el.getAttribute('data-field');
      debounce('tn' + f, function () { var p = {}; p[f] = el.value; T.saveTonight(d(), p); });
    }
  }

  function onChange(e) {
    var el = e.target.closest('[data-act="set-start"]');
    if (!el) return;
    var phase = el.getAttribute('data-phase');
    T.saveSchedule(phase === 'morning' ? { wake: el.value } : { windDown: el.value });
    renderPhase(phase);
  }

  function boot() {
    T = global.TodayData;
    if (!T) return;

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
    var bg = byId('mnSheetBg');
    if (bg) bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeSheet(); });

    document.querySelectorAll('#mnTabs .mn-tab').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    global.addEventListener('hashchange', function () {
      var t = resolveTab(location.hash);
      if (t) switchTab(t, { silentHash: true });
    });

    // A write that has not committed must not be lost to a navigation.
    global.addEventListener('pagehide', flushSaves);

    var start = resolveTab(location.hash) || T.getSettings().activeTab || 'today';
    switchTab(start, { silentHash: true, noScroll: true });
    renderAll();
  }

  global.TodayUI = {
    boot: boot,
    renderAll: renderAll,
    switchTab: switchTab,
    resolveTab: resolveTab,
    applyScene: applyScene,
    go: go,
    toast: toast
  };
})(window);
