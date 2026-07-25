// mainselfcare-data.js
//
// Data foundation for the "Self-Care" tab merged into index.html (Main) —
// a dedicated 5th main tab, deliberately separate from the standalone
// selfcare.html page of the same name (which already owns the `selfcare:`
// localStorage/Supabase prefix — see CLAUDE.md §4). Everything here lives
// under its own `mainselfcare:` prefix instead, so nothing in this file
// can ever collide with or clobber selfcare.html's real data, and
// index.html's existing initCloudSync({ appKey: 'goals', syncedPrefixes:
// [...] }) call covers it once `'mainselfcare:'` is added to that list —
// no new sync mechanism, same "flat prefix, no per-key list" convention
// as every other page in this app.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('mainselfcare:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('mainselfcare:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    checklist: 'mainselfcare:checklist',
    journalEntries: 'mainselfcare:journalEntries',
    meditations: 'mainselfcare:meditations',
    breathwork: 'mainselfcare:breathwork',
    activeTab: 'mainselfcare:active_tab',
    seeded: 'mainselfcare:seeded'
  };

  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isValidMediaUrl(v) {
    if (!v) return false;
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as every other
  // page's own -data.js.
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
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
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
  // SELF-CARE CHECKLIST
  // ============================================================
  function checklistItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('chk'),
      text: typeof data.text === 'string' ? data.text : '',
      done: !!data.done,
      order: typeof data.order === 'number' ? data.order : 0
    };
  }
  const ChecklistItems = makeCollection(KEYS.checklist, checklistItemModel);
  function toggleChecklistItem(id) {
    const item = ChecklistItems.get(id);
    if (item) ChecklistItems.update(id, { done: !item.done });
  }
  function checklistSorted() { return ChecklistItems.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // JOURNAL — three templates (Brain Dump / Gratitude / Day Planner),
  // each just a different default set of labeled, freeform sections —
  // the same "generated, editable, reorderable notes sections" pattern
  // already established elsewhere in this app (business.html's Platform
  // Detail pages, system.html's Page Notes).
  // ============================================================
  const JOURNAL_TEMPLATES = [
    { key: 'braindump', label: 'Brain Dump' },
    { key: 'gratitude', label: 'Gratitude' },
    { key: 'dayplanner', label: 'Day Planner' }
  ];
  function defaultSectionsForTemplate(template) {
    if (template === 'braindump') {
      return [
        { label: 'Emotional Processing — what am I feeling, and why?', body: '' },
        { label: 'Daily Reflection — what happened today, what went well, what didn’t, what did I learn?', body: '' }
      ];
    }
    if (template === 'gratitude') {
      return [
        { label: 'What am I grateful for today?', body: '' },
        { label: 'Why does it matter?', body: '' }
      ];
    }
    if (template === 'dayplanner') {
      return [
        { label: 'Top priorities for today', body: '' },
        { label: 'Schedule / time blocks', body: '' },
        { label: 'Notes', body: '' }
      ];
    }
    return [{ label: 'Notes', body: '' }];
  }
  function journalSectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('jsec'),
      label: typeof data.label === 'string' ? data.label : '',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0
    };
  }
  function journalEntryModel(data) {
    data = data || {};
    const template = JOURNAL_TEMPLATES.some(function (t) { return t.key === data.template; }) ? data.template : 'braindump';
    const sections = Array.isArray(data.sections) && data.sections.length
      ? data.sections.map(journalSectionModel)
      : defaultSectionsForTemplate(template).map(function (s, i) { return journalSectionModel(Object.assign({}, s, { order: i })); });
    return {
      id: data.id || uid('jrn'),
      date: typeof data.date === 'string' ? data.date : todayISO(),
      template: template,
      title: typeof data.title === 'string' ? data.title : '',
      sections: sections,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: Date.now()
    };
  }
  const JournalEntries = makeCollection(KEYS.journalEntries, journalEntryModel);
  function journalEntriesSorted() { return JournalEntries.list().slice().sort(function (a, b) { return b.createdAt - a.createdAt; }); }
  function addJournalEntry(template) {
    return JournalEntries.add({ template: template, date: todayISO() });
  }
  function addJournalSection(entryId) {
    const e = JournalEntries.get(entryId);
    if (!e) return null;
    const sec = journalSectionModel({ label: 'New Section', order: nextOrder(e.sections) });
    JournalEntries.update(entryId, { sections: e.sections.concat([sec]) });
    return sec;
  }
  function updateJournalSection(entryId, sectionId, patch) {
    const e = JournalEntries.get(entryId);
    if (!e) return;
    const next = e.sections.map(function (s) { return s.id === sectionId ? journalSectionModel(Object.assign({}, s, patch, { id: sectionId })) : s; });
    JournalEntries.update(entryId, { sections: next });
  }
  function removeJournalSection(entryId, sectionId) {
    const e = JournalEntries.get(entryId);
    if (!e) return;
    JournalEntries.update(entryId, { sections: e.sections.filter(function (s) { return s.id !== sectionId; }) });
  }
  function moveJournalSection(entryId, sectionId, dir) {
    const e = JournalEntries.get(entryId);
    if (!e) return;
    const sorted = e.sections.slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sorted.findIndex(function (s) { return s.id === sectionId; });
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const orderA = a.order, orderB = b.order;
    const next = e.sections.map(function (s) {
      if (s.id === a.id) return Object.assign({}, s, { order: orderB });
      if (s.id === b.id) return Object.assign({}, s, { order: orderA });
      return s;
    });
    JournalEntries.update(entryId, { sections: next });
  }

  // ============================================================
  // MEDITATIONS — linked from the Morning Ritual tab's "Sit" step.
  // ============================================================
  const MEDITATION_TYPES = ['Guided', 'Unguided / Silent', 'Body Scan', 'Breath-Focused', 'Sleep', 'Other'];
  function meditationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('med'),
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      url: typeof data.url === 'string' ? data.url : '',
      type: MEDITATION_TYPES.indexOf(data.type) !== -1 ? data.type : MEDITATION_TYPES[0],
      durationMin: typeof data.durationMin === 'number' ? data.durationMin : null,
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Meditations = makeCollection(KEYS.meditations, meditationModel);
  function meditationsSorted() { return Meditations.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // BREATHWORK — linked from the Morning Ritual tab's "Breath" step.
  // Same 4-phase (inhale/hold/exhale/hold) shape as selfcare.html's own
  // Anxiety > Breathwork database, a small independent copy since this
  // is genuinely separate data, not shared with that page.
  // ============================================================
  const BREATHWORK_GOALS = ['Calm', 'Focus', 'Sleep', 'In the moment', 'Other'];
  function breathworkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('brw'),
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      goal: BREATHWORK_GOALS.indexOf(data.goal) !== -1 ? data.goal : BREATHWORK_GOALS[0],
      inhaleSec: typeof data.inhaleSec === 'number' ? data.inhaleSec : 4,
      holdSec: typeof data.holdSec === 'number' ? data.holdSec : 4,
      exhaleSec: typeof data.exhaleSec === 'number' ? data.exhaleSec : 4,
      hold2Sec: typeof data.hold2Sec === 'number' ? data.hold2Sec : 4,
      cycles: typeof data.cycles === 'number' ? data.cycles : 6,
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Breathwork = makeCollection(KEYS.breathwork, breathworkModel);
  function breathworkSorted() { return Breathwork.list().slice().sort(function (a, b) { return a.order - b.order; }); }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    ChecklistItems.replaceAll([]);
    JournalEntries.replaceAll([]);
    Meditations.replaceAll([]);
    Breathwork.replaceAll([]);
    ['Drink a full glass of water', 'Step outside for 5 minutes', 'Stretch for 5 minutes', 'Text one person you care about', 'Put the phone away 30 minutes before bed']
      .forEach(function (text, i) { ChecklistItems.add({ text: text, order: i }); });
    Meditations.add({ title: 'Body Scan — 10 min', description: 'A slow scan from feet to head, releasing tension as you go.', type: 'Body Scan', durationMin: 10, order: 0 });
    Meditations.add({ title: 'Breath Awareness — 5 min', description: 'Just noticing the breath, no changing it.', type: 'Breath-Focused', durationMin: 5, order: 1 });
    Breathwork.add({ name: 'Box Breathing', description: 'Equal-count inhale/hold/exhale/hold — a steady reset.', goal: 'Calm', inhaleSec: 4, holdSec: 4, exhaleSec: 4, hold2Sec: 4, cycles: 6, order: 0 });
    Breathwork.add({ name: '4-7-8 Breathing', description: 'A longer exhale to settle the nervous system before sleep.', goal: 'Sleep', inhaleSec: 4, holdSec: 7, exhaleSec: 8, hold2Sec: 0, cycles: 4, order: 1 });
    storeSet(KEYS.seeded, true);
  }
  function isEmpty() {
    return ChecklistItems.list().length === 0 && JournalEntries.list().length === 0 && Meditations.list().length === 0 && Breathwork.list().length === 0;
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (!isEmpty()) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }
  // seedIfEmpty() is deliberately NOT called automatically — same
  // empty-storage seed-race reasoning as every other page in this app.

  global.MainSelfCareData = {
    KEYS: KEYS,
    JOURNAL_TEMPLATES: JOURNAL_TEMPLATES, MEDITATION_TYPES: MEDITATION_TYPES, BREATHWORK_GOALS: BREATHWORK_GOALS,
    uid: uid, todayISO: todayISO, isValidMediaUrl: isValidMediaUrl,
    ChecklistItems: ChecklistItems, toggleChecklistItem: toggleChecklistItem, checklistSorted: checklistSorted,
    JournalEntries: JournalEntries, journalEntriesSorted: journalEntriesSorted, addJournalEntry: addJournalEntry,
    defaultSectionsForTemplate: defaultSectionsForTemplate,
    addJournalSection: addJournalSection, updateJournalSection: updateJournalSection,
    removeJournalSection: removeJournalSection, moveJournalSection: moveJournalSection,
    Meditations: Meditations, meditationsSorted: meditationsSorted,
    Breathwork: Breathwork, breathworkSorted: breathworkSorted,
    nextOrder: nextOrder, moveInCollection: moveInCollection,
    isEmpty: isEmpty, seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty
  };
})(window);
