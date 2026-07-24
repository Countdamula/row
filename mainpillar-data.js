// mainpillar-data.js — data layer for mainpillar.html ("Main Pillar")
// Same conventions as household-data.js / aitech-data.js: an IIFE exposing
// window.MainPillarData, storeGet/storeSet over localStorage, model
// factories + makeCollection(key, model) CRUD, pure derived selectors, a
// guarded one-time seed. Every key lives under the `mainpillar:` prefix so
// mainpillar.html's single initCloudSync({ syncedPrefixes: ['mainpillar:'] })
// call covers everything with no per-key sync wiring.
(function () {
  'use strict';

  function storeGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota/offline — silently skip, matching this app's established tolerance */ }
  }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------------
  // Date helpers
  // ---------------------------------------------------------------------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateToKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function keyToDate(k) { var p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function todayISO() { return dateToKey(new Date()); }
  function addDaysToKey(k, n) { var d = keyToDate(k); d.setDate(d.getDate() + n); return dateToKey(d); }
  function weekStartKey(k) { var d = keyToDate(k); var dow = d.getDay(); return addDaysToKey(k, -dow); }
  function monthKeyOf(k) { return k.slice(0, 7); } // 'YYYY-MM'
  function yearKeyOf(k) { return k.slice(0, 4); }  // 'YYYY'
  function daysInMonth(monthKey) {
    var p = monthKey.split('-').map(Number);
    return new Date(p[0], p[1], 0).getDate();
  }
  function monthLabel(monthKey) {
    var p = monthKey.split('-').map(Number);
    return new Date(p[0], p[1] - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  function addMonthsToKey(monthKey, n) {
    var p = monthKey.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  // ---------------------------------------------------------------------
  // Generic flat-collection CRUD, same shape every other page's -data.js uses
  // ---------------------------------------------------------------------
  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function save(items) { storeSet(key, items); }
    return {
      list: list,
      get: function (id) { return list().filter(function (x) { return x.id === id; })[0] || null; },
      add: function (data) { var item = model(data); var items = list(); items.push(item); save(items); return item; },
      update: function (id, patch) {
        var items = list();
        var item = items.filter(function (x) { return x.id === id; })[0];
        if (!item) return null;
        Object.keys(patch).forEach(function (k) { item[k] = patch[k]; });
        save(items);
        return item;
      },
      remove: function (id) { save(list().filter(function (x) { return x.id !== id; })); },
      save: save
    };
  }

  // ---------------------------------------------------------------------
  // Hunter stats (Solo Leveling framing): five stats habits/tasks/journal/
  // wins feed XP into, plus a derived Level/Rank.
  // ---------------------------------------------------------------------
  var STATS = ['STR', 'VIT', 'INT', 'AGI', 'SEN'];
  var STAT_LABELS = { STR: 'Strength', VIT: 'Vitality', INT: 'Intelligence', AGI: 'Agility', SEN: 'Sense' };
  var STAT_HINTS = {
    STR: 'Training, physical effort, workouts',
    VIT: 'Sleep, recovery, health protocols',
    INT: 'Learning, creative & focused work',
    AGI: 'Tasks shipped, productivity',
    SEN: 'Journaling, mindfulness, reflection'
  };
  var RANKS = [
    { rank: 'E', minLevel: 1 }, { rank: 'D', minLevel: 10 }, { rank: 'C', minLevel: 20 },
    { rank: 'B', minLevel: 30 }, { rank: 'A', minLevel: 40 }, { rank: 'S', minLevel: 50 }
  ];

  // Cumulative XP required to REACH level L (L=1 costs 0). Level n costs
  // 100*n XP to clear, so it gets meaningfully slower as you rank up —
  // a plain, documented RPG curve, not a claim of real research.
  function xpForLevel(L) { return 100 * (L - 1) * L / 2; }
  function levelForXP(xp) {
    var L = 1;
    while (L < 200 && xpForLevel(L + 1) <= xp) L++;
    return L;
  }
  function rankForLevel(level) {
    var r = 'E';
    RANKS.forEach(function (x) { if (level >= x.minLevel) r = x.rank; });
    return r;
  }
  function xpProgress(xp) {
    var level = levelForXP(xp);
    var floor = xpForLevel(level);
    var ceil = xpForLevel(level + 1);
    var span = ceil - floor;
    return {
      level: level,
      rank: rankForLevel(level),
      xp: xp,
      into: xp - floor,
      span: span,
      pct: span ? Math.round(((xp - floor) / span) * 100) : 100
    };
  }

  function loadHunter() {
    var h = storeGet('mainpillar:hunter');
    if (!h || typeof h !== 'object') h = {};
    var statXP = h.statXP && typeof h.statXP === 'object' ? h.statXP : {};
    STATS.forEach(function (s) { if (typeof statXP[s] !== 'number') statXP[s] = 0; });
    h.statXP = statXP;
    if (typeof h.lastSeenLevel !== 'number') h.lastSeenLevel = 1;
    if (!h.title) h.title = 'Awakened';
    return h;
  }
  function saveHunter(h) { storeSet('mainpillar:hunter', h); }
  function totalXP(h) { return STATS.reduce(function (s, k) { return s + (h.statXP[k] || 0); }, 0); }

  // Returns { leveledUp: bool, from, to } — call after any XP-earning action.
  function awardXP(stat, amount) {
    var h = loadHunter();
    if (STATS.indexOf(stat) === -1) stat = 'AGI';
    var beforeLevel = levelForXP(totalXP(h));
    h.statXP[stat] = Math.max(0, (h.statXP[stat] || 0) + amount);
    var afterLevel = levelForXP(totalXP(h));
    saveHunter(h);
    return { leveledUp: afterLevel > beforeLevel, from: beforeLevel, to: afterLevel };
  }
  function revokeXP(stat, amount) { return awardXP(stat, -Math.abs(amount)); }
  function ackLevelSeen() {
    var h = loadHunter();
    h.lastSeenLevel = levelForXP(totalXP(h));
    saveHunter(h);
  }

  // ---------------------------------------------------------------------
  // Habits ("Daily Quests") — mainpillar:habits
  // ---------------------------------------------------------------------
  var HABIT_FREQUENCIES = ['daily', 'weekdays', 'everyNDays'];
  var AUTO_SOURCES = [
    { value: '', label: 'Manual only' },
    { value: 'sleepHours', label: 'Whoop: Sleep hours ≥ threshold', op: '>=' },
    { value: 'recovery', label: 'Whoop: Recovery score ≥ threshold', op: '>=' },
    { value: 'strain', label: 'Whoop: Strain ≥ threshold', op: '>=' },
    { value: 'sleepScore', label: 'Whoop: Sleep score ≥ threshold', op: '>=' }
  ];

  function habitModel(data) {
    data = data || {};
    return {
      id: data.id || uid('habit'),
      name: data.name || 'New Habit',
      icon: data.icon || '⚔️',
      category: STATS.indexOf(data.category) !== -1 ? data.category : 'AGI',
      frequency: HABIT_FREQUENCIES.indexOf(data.frequency) !== -1 ? data.frequency : 'daily',
      weekdays: Array.isArray(data.weekdays) ? data.weekdays : [1, 2, 3, 4, 5, 6, 0],
      everyNDays: data.everyNDays || 2,
      targetStreak: data.targetStreak || 0,
      xp: typeof data.xp === 'number' ? data.xp : 10,
      autoSource: data.autoSource || '',
      autoThreshold: typeof data.autoThreshold === 'number' ? data.autoThreshold : 0,
      order: typeof data.order === 'number' ? data.order : Date.now(),
      createdAt: data.createdAt || Date.now()
    };
  }
  var Habits = makeCollection('mainpillar:habits', habitModel);

  function isHabitScheduled(habit, dow, dateKey) {
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return Array.isArray(habit.weekdays) && habit.weekdays.indexOf(dow) !== -1;
    if (habit.frequency === 'everyNDays') {
      var start = habit.createdAt ? dateToKey(new Date(habit.createdAt)) : dateKey;
      var diff = Math.round((keyToDate(dateKey) - keyToDate(start)) / 86400000);
      var n = habit.everyNDays || 2;
      return diff >= 0 && diff % n === 0;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Habit log — mainpillar:habitlog:<date> = { habitId: true }
  // ---------------------------------------------------------------------
  function habitLogFor(dateStr) { var v = storeGet('mainpillar:habitlog:' + dateStr); return v && typeof v === 'object' ? v : {}; }
  function saveHabitLogFor(dateStr, log) { storeSet('mainpillar:habitlog:' + dateStr, log); }
  function isHabitDoneOn(habitId, dateStr) { return !!habitLogFor(dateStr)[habitId]; }

  // Returns { leveledUp, from, to } | null (null when nothing changed, e.g.
  // re-setting to the state it already was).
  function setHabitLogDone(habitId, dateStr, doneBool) {
    var log = habitLogFor(dateStr);
    var was = !!log[habitId];
    if (was === !!doneBool) return null;
    var habit = Habits.get(habitId);
    var xpAmt = habit ? habit.xp : 10;
    var stat = habit ? habit.category : 'AGI';
    if (doneBool) log[habitId] = true; else delete log[habitId];
    saveHabitLogFor(dateStr, log);
    return doneBool ? awardXP(stat, xpAmt) : revokeXP(stat, xpAmt);
  }
  function toggleHabitToday(habitId, dateStr) {
    dateStr = dateStr || todayISO();
    return setHabitLogDone(habitId, dateStr, !isHabitDoneOn(habitId, dateStr));
  }

  function computeHabitStreaks(habit) {
    var today = todayISO();
    var startKey = habit.createdAt ? dateToKey(new Date(habit.createdAt)) : today;
    var cursor = startKey > today ? today : startKey;
    var current = 0, best = 0, guard = 0;
    while (cursor < today && guard < 3660) {
      var dow = keyToDate(cursor).getDay();
      if (isHabitScheduled(habit, dow, cursor)) {
        if (isHabitDoneOn(habit.id, cursor)) { current++; if (current > best) best = current; }
        else current = 0;
      }
      cursor = addDaysToKey(cursor, 1);
      guard++;
    }
    var todayDow = keyToDate(today).getDay();
    if (isHabitScheduled(habit, todayDow, today) && isHabitDoneOn(habit.id, today)) {
      current++; if (current > best) best = current;
    }
    return { current: current, best: best };
  }

  // % of scheduled days completed within [fromKey, toKey] inclusive —
  // the number behind every heat-map cell/consistency stat.
  function habitConsistency(habit, fromKey, toKey) {
    var cursor = fromKey, scheduled = 0, done = 0, guard = 0;
    while (cursor <= toKey && guard < 3660) {
      if (isHabitScheduled(habit, keyToDate(cursor).getDay(), cursor)) {
        scheduled++;
        if (isHabitDoneOn(habit.id, cursor)) done++;
      }
      cursor = addDaysToKey(cursor, 1);
      guard++;
    }
    return scheduled ? Math.round((done / scheduled) * 100) : null;
  }

  // Overall day score (0-100) used by heat maps: % of that day's scheduled
  // habits that were completed.
  function dayHabitScore(dateStr) {
    var dow = keyToDate(dateStr).getDay();
    var scheduled = Habits.list().filter(function (h) { return isHabitScheduled(h, dow, dateStr); });
    if (!scheduled.length) return null;
    var log = habitLogFor(dateStr);
    var done = scheduled.filter(function (h) { return !!log[h.id]; }).length;
    return Math.round((done / scheduled.length) * 100);
  }

  // Auto-complete: for every habit with an autoSource wired, if today's
  // logged Whoop metric already clears the threshold and the habit isn't
  // marked done yet, mark it done (through the normal path, so XP still
  // fires exactly once). Safe to call on every render — idempotent, since
  // setHabitLogDone() is a no-op once already true.
  function applyAutoCompletes(dateStr) {
    dateStr = dateStr || todayISO();
    var whoop = whoopFor(dateStr);
    var leveled = [];
    Habits.list().forEach(function (h) {
      if (!h.autoSource || !whoop) return;
      var v = whoop[h.autoSource];
      if (typeof v !== 'number') return;
      if (v >= h.autoThreshold && !isHabitDoneOn(h.id, dateStr)) {
        var res = setHabitLogDone(h.id, dateStr, true);
        if (res && res.leveledUp) leveled.push(res);
      }
    });
    return leveled;
  }

  // ---------------------------------------------------------------------
  // Whoop — manual/pasted daily biometrics. mainpillar:whoop:<date>
  // ---------------------------------------------------------------------
  function whoopModel(data) {
    data = data || {};
    return {
      recovery: numOrNull(data.recovery),      // 0-100 %
      strain: numOrNull(data.strain),          // 0-21
      sleepScore: numOrNull(data.sleepScore),  // 0-100 %
      sleepHours: numOrNull(data.sleepHours),
      sleepEfficiency: numOrNull(data.sleepEfficiency),
      hrv: numOrNull(data.hrv),                // ms
      rhr: numOrNull(data.rhr),                // bpm
      spo2: numOrNull(data.spo2),              // %
      skinTemp: numOrNull(data.skinTemp),      // °F/°C, whatever the user enters
      respRate: numOrNull(data.respRate),
      notes: data.notes || '',
      updatedAt: Date.now()
    };
  }
  function numOrNull(v) { return (v === '' || v === null || v === undefined || isNaN(v)) ? null : Number(v); }
  function whoopFor(dateStr) { return storeGet('mainpillar:whoop:' + dateStr); }
  function saveWhoopFor(dateStr, data) { storeSet('mainpillar:whoop:' + dateStr, whoopModel(data)); }
  function recoveryZone(recovery) {
    if (recovery === null || recovery === undefined) return 'none';
    if (recovery >= 67) return 'good';
    if (recovery >= 34) return 'warn';
    return 'bad';
  }

  // ---------------------------------------------------------------------
  // Tasks & Projects — mainpillar:tasks / mainpillar:projects
  // ---------------------------------------------------------------------
  var TASK_STATUSES = ['todo', 'in-progress', 'done'];
  var TASK_PRIORITIES = ['Low', 'Medium', 'High'];
  function projectModel(data) {
    data = data || {};
    return {
      id: data.id || uid('proj'),
      name: data.name || 'New Project',
      color: data.color || '#49e0ff',
      icon: data.icon || '📁',
      order: typeof data.order === 'number' ? data.order : Date.now(),
      createdAt: data.createdAt || Date.now()
    };
  }
  var Projects = makeCollection('mainpillar:projects', projectModel);

  function taskModel(data) {
    data = data || {};
    return {
      id: data.id || uid('task'),
      title: data.title || 'New Task',
      note: data.note || '',
      projectId: data.projectId || null,
      status: TASK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: TASK_PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'Medium',
      dueDate: data.dueDate || '',
      xp: typeof data.xp === 'number' ? data.xp : 15,
      done: !!data.done,
      doneAt: data.doneAt || null,
      order: typeof data.order === 'number' ? data.order : Date.now(),
      createdAt: data.createdAt || Date.now()
    };
  }
  var TasksCol = makeCollection('mainpillar:tasks', taskModel);

  function setTaskDone(taskId, doneBool) {
    var t = TasksCol.get(taskId);
    if (!t) return null;
    var was = !!t.done;
    if (was === !!doneBool) return null;
    TasksCol.update(taskId, { done: doneBool, doneAt: doneBool ? Date.now() : null, status: doneBool ? 'done' : 'todo' });
    return doneBool ? awardXP('AGI', t.xp) : revokeXP('AGI', t.xp);
  }
  function tasksDueOn(dateStr) { return TasksCol.list().filter(function (t) { return !t.done && t.dueDate === dateStr; }); }
  function tasksUpcoming(fromDateStr, limit) {
    return TasksCol.list()
      .filter(function (t) { return !t.done && t.dueDate && t.dueDate > fromDateStr; })
      .sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); })
      .slice(0, limit || 8);
  }

  // ---------------------------------------------------------------------
  // Journal (AI context, not personal reflection) — mainpillar:journal:<date>
  // ---------------------------------------------------------------------
  function journalFor(dateStr) {
    var v = storeGet('mainpillar:journal:' + dateStr);
    return (v && typeof v === 'object') ? v : { text: '', xpAwarded: false, updatedAt: null };
  }
  function saveJournalFor(dateStr, text) {
    var existing = journalFor(dateStr);
    var firstTime = !existing.xpAwarded && text.trim().length > 0;
    var next = { text: text, xpAwarded: existing.xpAwarded || firstTime, updatedAt: Date.now() };
    storeSet('mainpillar:journal:' + dateStr, next);
    return firstTime ? awardXP('INT', 8) : null;
  }

  // ---------------------------------------------------------------------
  // Win of the Day — mainpillar:wins (searchable archive)
  // ---------------------------------------------------------------------
  function winModel(data) {
    data = data || {};
    return {
      id: data.id || uid('win'),
      date: data.date || todayISO(),
      text: data.text || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt || Date.now()
    };
  }
  var Wins = makeCollection('mainpillar:wins', winModel);
  function winsForDate(dateStr) { return Wins.list().filter(function (w) { return w.date === dateStr; }); }
  function addWin(dateStr, text, tags) {
    var isFirstToday = winsForDate(dateStr).length === 0;
    var win = Wins.add({ date: dateStr, text: text, tags: tags || [] });
    var xpRes = isFirstToday ? awardXP('SEN', 6) : null;
    return { win: win, xpRes: xpRes };
  }

  // ---------------------------------------------------------------------
  // Briefs (AI-generated, cached per period) — via Anthropic API, reusing
  // this app's established client-side-fetch-with-a-key pattern.
  // ---------------------------------------------------------------------
  function briefKey(scope, periodKey) { return 'mainpillar:brief:' + scope + ':' + periodKey; }
  function getBrief(scope, periodKey) { return storeGet(briefKey(scope, periodKey)); }
  function saveBrief(scope, periodKey, text) {
    storeSet(briefKey(scope, periodKey), { text: text, generatedAt: Date.now() });
  }

  // ---------------------------------------------------------------------
  // Smart Goal Allocation — mainpillar:goals
  // Same spirit as index.html's monthly/yearly allocation engine (own,
  // separate data — this page's own goals, not index.html's): a target +
  // unit split evenly across the remaining periods of its scope, with a
  // rollover setting reconciling any already-past period's shortfall.
  // ---------------------------------------------------------------------
  var GOAL_SCOPES = ['monthly', 'yearly'];
  var GOAL_ROLLOVER = ['roll', 'redistribute'];
  function goalModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mpgoal'),
      title: data.title || 'New Goal',
      unit: data.unit || 'x',
      target: typeof data.target === 'number' ? data.target : 12,
      scope: GOAL_SCOPES.indexOf(data.scope) !== -1 ? data.scope : 'yearly',
      rollover: GOAL_ROLLOVER.indexOf(data.rollover) !== -1 ? data.rollover : 'redistribute',
      startPeriod: data.startPeriod || (data.scope === 'monthly' ? weekStartKey(todayISO()) : yearKeyOf(todayISO())),
      createdAt: data.createdAt || Date.now()
    };
  }
  var Goals = makeCollection('mainpillar:goals', goalModel);

  function goalLogKey(goalId) { return 'mainpillar:goalLog:' + goalId; }
  function goalLog(goalId) { var v = storeGet(goalLogKey(goalId)); return (v && typeof v === 'object') ? v : {}; }
  function logGoalProgress(goalId, periodKey, amount) {
    var log = goalLog(goalId);
    log[periodKey] = (log[periodKey] || 0) + amount;
    storeSet(goalLogKey(goalId), log);
  }
  function goalPeriodKeys(goal) {
    // yearly → 12 month keys of the goal's start year; monthly → ~4-5 week
    // keys (Sunday starts) spanning the goal's start month.
    var keys = [];
    if (goal.scope === 'yearly') {
      var year = goal.startPeriod || yearKeyOf(todayISO());
      for (var m = 1; m <= 12; m++) keys.push(year + '-' + pad2(m));
    } else {
      var monthKey = goal.startPeriod && goal.startPeriod.length === 7 ? goal.startPeriod : monthKeyOf(todayISO());
      var cursor = weekStartKey(monthKey + '-01');
      var guard = 0;
      while (monthKeyOf(cursor) <= monthKey && guard < 8) {
        if (monthKeyOf(addDaysToKey(cursor, 6)) >= monthKey || monthKeyOf(cursor) === monthKey) keys.push(cursor);
        cursor = addDaysToKey(cursor, 7);
        guard++;
      }
    }
    return keys;
  }
  function currentPeriodKeyFor(goal) {
    return goal.scope === 'yearly' ? monthKeyOf(todayISO()) : weekStartKey(todayISO());
  }
  function isPeriodPast(goal, periodKey) {
    return periodKey < currentPeriodKeyFor(goal);
  }
  // Splits `goal.target` across every period, reconciling any already-past
  // period's shortfall forward — either onto the very next period ('roll')
  // or spread evenly across every remaining (not-yet-past) period
  // ('redistribute'). Returns [{ periodKey, allocated, logged, isPast, isCurrent }].
  function computeGoalAllocation(goal) {
    var keys = goalPeriodKeys(goal);
    var log = goalLog(goal.id);
    var n = keys.length || 1;
    var base = goal.target / n;
    var rows = keys.map(function (k) { return { periodKey: k, allocated: base, logged: log[k] || 0 }; });
    var carry = 0;
    rows.forEach(function (row, i) {
      row.allocated += carry;
      row.isPast = isPeriodPast(goal, row.periodKey);
      row.isCurrent = row.periodKey === currentPeriodKeyFor(goal);
      if (row.isPast) {
        var shortfall = Math.max(0, row.allocated - row.logged);
        carry = 0;
        if (shortfall > 0) {
          var remaining = rows.length - i - 1;
          if (goal.rollover === 'roll' || remaining <= 0) {
            carry = shortfall;
          } else {
            var per = shortfall / remaining;
            for (var j = i + 1; j < rows.length; j++) rows[j].allocated += per;
          }
        }
      }
    });
    return rows;
  }
  function goalProgressSummary(goal) {
    var rows = computeGoalAllocation(goal);
    var loggedTotal = rows.reduce(function (s, r) { return s + r.logged; }, 0);
    var pct = goal.target ? Math.min(100, Math.round((loggedTotal / goal.target) * 100)) : 0;
    var current = rows.filter(function (r) { return r.isCurrent; })[0] || rows[rows.length - 1];
    return { loggedTotal: loggedTotal, pct: pct, currentPeriod: current, rows: rows };
  }

  // ---------------------------------------------------------------------
  // Favorites — mainpillar:favorites (life-memory archive, not productivity)
  // ---------------------------------------------------------------------
  var FAVORITE_TYPES = ['post', 'photo', 'video', 'moment', 'note'];
  var FAVORITE_TYPE_LABELS = { post: 'Social Post', photo: 'Photo', video: 'Video', moment: 'Moment', note: 'Note' };
  function favoriteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fav'),
      type: FAVORITE_TYPES.indexOf(data.type) !== -1 ? data.type : 'moment',
      title: data.title || '',
      url: data.url || '',
      cover: data.cover || '',
      note: data.note || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      date: data.date || todayISO(),
      order: typeof data.order === 'number' ? data.order : Date.now(),
      createdAt: data.createdAt || Date.now()
    };
  }
  var Favorites = makeCollection('mainpillar:favorites', favoriteModel);

  // ---------------------------------------------------------------------
  // Weekly / Monthly / Year aggregate stats — pure selectors, nothing stored
  // ---------------------------------------------------------------------
  function statsForRange(fromKey, toKey) {
    var days = [], cursor = fromKey, guard = 0;
    while (cursor <= toKey && guard < 3700) { days.push(cursor); cursor = addDaysToKey(cursor, 1); guard++; }
    var recoverySum = 0, recoveryN = 0, strainSum = 0, strainN = 0, sleepSum = 0, sleepN = 0, sleepHoursSum = 0, sleepHoursN = 0;
    var habitDone = 0, habitScheduled = 0;
    days.forEach(function (d) {
      var w = whoopFor(d);
      if (w) {
        if (typeof w.recovery === 'number') { recoverySum += w.recovery; recoveryN++; }
        if (typeof w.strain === 'number') { strainSum += w.strain; strainN++; }
        if (typeof w.sleepScore === 'number') { sleepSum += w.sleepScore; sleepN++; }
        if (typeof w.sleepHours === 'number') { sleepHoursSum += w.sleepHours; sleepHoursN++; }
      }
      var dow = keyToDate(d).getDay();
      Habits.list().forEach(function (h) {
        if (isHabitScheduled(h, dow, d)) {
          habitScheduled++;
          if (isHabitDoneOn(h.id, d)) habitDone++;
        }
      });
    });
    return {
      days: days,
      avgRecovery: recoveryN ? Math.round(recoverySum / recoveryN) : null,
      avgStrain: strainN ? +(strainSum / strainN).toFixed(1) : null,
      avgSleepScore: sleepN ? Math.round(sleepSum / sleepN) : null,
      avgSleepHours: sleepHoursN ? +(sleepHoursSum / sleepHoursN).toFixed(1) : null,
      habitCompletionPct: habitScheduled ? Math.round((habitDone / habitScheduled) * 100) : null,
      habitDone: habitDone,
      habitScheduled: habitScheduled,
      tasksDone: TasksCol.list().filter(function (t) { return t.done && t.doneAt && dateToKey(new Date(t.doneAt)) >= fromKey && dateToKey(new Date(t.doneAt)) <= toKey; }).length,
      winsCount: Wins.list().filter(function (w) { return w.date >= fromKey && w.date <= toKey; }).length
    };
  }

  // ---------------------------------------------------------------------
  // Seed — realistic starter content so a fresh install isn't empty.
  // Guarded, and left to the page's own boot sequence to defer until
  // after the cloud pull has had a real window (same seed-race-safety
  // precedent as dreamboard.html/business.html/aitech.html).
  // ---------------------------------------------------------------------
  function isEmpty() {
    return !Habits.list().length && !TasksCol.list().length && !Projects.list().length && !Goals.list().length;
  }
  function seedIfEmpty() {
    if (!isEmpty()) return;
    var proj = Projects.add({ name: 'Main Pillar', color: '#49e0ff', icon: '🗡️' });
    [
      { name: 'Sleep 7+ hours', icon: '🌙', category: 'VIT', frequency: 'daily', xp: 12, autoSource: 'sleepHours', autoThreshold: 7 },
      { name: 'Workout completed', icon: '💪', category: 'STR', frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5], xp: 20 },
      { name: 'Recovery protocol', icon: '🧊', category: 'VIT', frequency: 'daily', xp: 10, autoSource: 'recovery', autoThreshold: 67 },
      { name: 'Creative work block', icon: '🎨', category: 'INT', frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5], xp: 15 },
      { name: 'Journal entry', icon: '📓', category: 'SEN', frequency: 'daily', xp: 8 }
    ].forEach(function (h, i) { Habits.add(Object.assign({ order: i }, h)); });
    TasksCol.add({ title: 'Set up this week\'s Whoop numbers', projectId: proj.id, dueDate: todayISO(), priority: 'Medium' });
    TasksCol.add({ title: 'Review Smart Goal Allocation', projectId: proj.id, dueDate: addDaysToKey(todayISO(), 2), priority: 'Low' });
    Goals.add({ title: 'Read 12 books', unit: 'books', target: 12, scope: 'yearly', rollover: 'redistribute' });
    Goals.add({ title: 'Workout sessions', unit: 'sessions', target: 4, scope: 'monthly', rollover: 'roll' });
  }

  window.MainPillarData = {
    storeGet: storeGet, storeSet: storeSet, uid: uid,
    todayISO: todayISO, dateToKey: dateToKey, keyToDate: keyToDate, addDaysToKey: addDaysToKey,
    weekStartKey: weekStartKey, monthKeyOf: monthKeyOf, yearKeyOf: yearKeyOf, daysInMonth: daysInMonth,
    monthLabel: monthLabel, addMonthsToKey: addMonthsToKey,

    STATS: STATS, STAT_LABELS: STAT_LABELS, STAT_HINTS: STAT_HINTS, RANKS: RANKS,
    loadHunter: loadHunter, saveHunter: saveHunter, totalXP: totalXP, xpProgress: xpProgress,
    awardXP: awardXP, revokeXP: revokeXP, ackLevelSeen: ackLevelSeen,

    HABIT_FREQUENCIES: HABIT_FREQUENCIES, AUTO_SOURCES: AUTO_SOURCES,
    Habits: Habits, isHabitScheduled: isHabitScheduled,
    habitLogFor: habitLogFor, isHabitDoneOn: isHabitDoneOn, setHabitLogDone: setHabitLogDone, toggleHabitToday: toggleHabitToday,
    computeHabitStreaks: computeHabitStreaks, habitConsistency: habitConsistency, dayHabitScore: dayHabitScore,
    applyAutoCompletes: applyAutoCompletes,

    whoopFor: whoopFor, saveWhoopFor: saveWhoopFor, recoveryZone: recoveryZone,

    TASK_STATUSES: TASK_STATUSES, TASK_PRIORITIES: TASK_PRIORITIES,
    Projects: Projects, Tasks: TasksCol, setTaskDone: setTaskDone, tasksDueOn: tasksDueOn, tasksUpcoming: tasksUpcoming,

    journalFor: journalFor, saveJournalFor: saveJournalFor,

    Wins: Wins, winsForDate: winsForDate, addWin: addWin,

    getBrief: getBrief, saveBrief: saveBrief,

    GOAL_SCOPES: GOAL_SCOPES, GOAL_ROLLOVER: GOAL_ROLLOVER, Goals: Goals,
    goalPeriodKeys: goalPeriodKeys, currentPeriodKeyFor: currentPeriodKeyFor,
    computeGoalAllocation: computeGoalAllocation, goalProgressSummary: goalProgressSummary, logGoalProgress: logGoalProgress,

    FAVORITE_TYPES: FAVORITE_TYPES, FAVORITE_TYPE_LABELS: FAVORITE_TYPE_LABELS, Favorites: Favorites,

    statsForRange: statsForRange,

    isEmpty: isEmpty, seedIfEmpty: seedIfEmpty
  };
})();
