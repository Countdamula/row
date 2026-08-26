/* =====================================================================
   promptarium-data.js — the data layer for Prompt Studio
   (promptarium.html).

   REBUILT 2026-08-25. The previous version filed prompts by AI MODEL
   (ChatGPT / Claude / Gemini / NotebookLM / Suno / n8n / Perplexity /
   AI Coding) and carried ratings, statuses, creators, sources, a second
   user-owned tag axis, per-collection rich articles and a notes DB.
   All of that is gone. Prompts are now filed by PURPOSE — what you are
   trying to accomplish — because that is what you are actually looking
   for. Which model you are about to open is a one-word compatibility
   note, not a filing system.

   This file backs TWO libraries on one page:
     prm:prompts  — the prompt library
     prm:tools    — the tools & websites library
   and one shared workflow model (prm:collections) whose `kind` field
   makes it either a prompt chain or a tool stack.

   RELATIONSHIP TO THE 'cdx:' ROW (codex-data.js): SHARED, on purpose,
   and UNCHANGED by the rebuild.

   The "Fiction" prompts are not a copy — they ARE the fiction prompt
   database. promptarium.html mounts a SECOND initCloudSync for appKey
   'codex' / prefix 'cdx:'. codex.html was deleted on 2026-08-21;
   codex-data.js and that second mount MUST STAY, because the same row
   also holds cdx:trilogies/chapters/scenes — the manuscripts.

   Two hard rules follow, and both are still enforced here:

     1. THIS FILE NEVER WRITES A 'cdx:' KEY ITSELF. Every fiction write
        goes through window.CodexData's own collections, so the Codex's
        own promptModel() is the only thing that ever shapes a cdx:
        record. Field drift is impossible by construction.

     2. codex-data.js's promptModel() is a WHITELIST of sixteen fields
        and makeCollection.update() re-runs it on every edit, so any
        field this page added to a cdx: record would be silently dropped
        the next time the Codex edited that prompt. Prompt Studio's one
        extra (the purpose category) lives in a SIDECAR —
        prm:fictionMeta, keyed by prompt id.

   The write GATE that protects the Codex's row from a premature push
   lives in promptarium.html, not here, because it depends on sync
   state. See §CODEX GATE there. Nothing in this file may call CodexData
   at load time.

   Storage follows this app's established contract exactly:
     local-store-idb.js  → localStorage is an IndexedDB-backed shim
     sync.js             → initCloudSync({appKey:'promptarium', syncedPrefixes:['prm:']})
   Every key below is 'prm:'-prefixed. That prefix and 'cdx:' must stay
   DISJOINT — an overlap would make the two sync mounts push each other
   in a loop.

   Snapshots live under 'prmbak:' and are handled by
   promptarium-backup.js. Check that string character by character
   before changing either: sync.js matches k.indexOf('prm:') === 0, and
   'prmbak:' fails that at index 3, which is the only reason a snapshot
   survives the event it exists to survive.
   ===================================================================== */

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('prm:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('prm:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  var KEYS = {
    prompts:     'prm:prompts',
    tools:       'prm:tools',
    collections: 'prm:collections',
    fictionMeta: 'prm:fictionMeta',
    uiState:     'prm:uiState',
    settings:    'prm:settings',
    schema:      'prm:schema'
  };

  /* Every key the OLD Promptarium owned. Listed explicitly — the wipe
     below enumerates this array and nothing else. No prefix sweep, no
     localStorage.clear(): a sweep over 'prm:' would be correct today and
     wrong the first time someone adds a key, and clear() would take the
     manuscripts with it. */
  var LEGACY_KEYS = [
    'prm:promptNotes', 'prm:purposeTags', 'prm:workflows', 'prm:workflowSteps',
    'prm:stepNotes', 'prm:collectionArticles', 'prm:collectionNotes', 'prm:seededAt'
  ];
  /* Keys the rebuild REUSES by name but not by shape. Wiped alongside the
     legacy ones, then written fresh. */
  var REUSED_KEYS = [
    'prm:prompts', 'prm:collections', 'prm:fictionMeta', 'prm:uiState', 'prm:settings'
  ];

  var SCHEMA = 2;

  // ============================================================
  // ID / DATE / TEXT HELPERS — same shapes as codex-data.js
  // ============================================================
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtAgo(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
    var w = Math.floor(d / 7); if (w < 5) return w + 'w ago';
    var mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* A tool's URL is the one field on this page that becomes an href, so
     it is the one field that can carry a javascript: payload.

     Control characters come off FIRST, by code point rather than by a
     regex class, because "java<newline>script:" and "&#106;avascript:"
     both normalise to javascript: once the browser has decoded them —
     testing the raw string is not enough. */
  function stripControl(s) {
    var out = '', str = String(s == null ? '' : s);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c > 31 && c !== 127 && c !== 8232 && c !== 8233) out += str.charAt(i);
    }
    return out;
  }
  function safeUrl(u) {
    var s = stripControl(u).trim();
    var low = s.toLowerCase();
    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0) return s;
    // A bare domain is what you actually type. Anything else is refused.
    if (s && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return 'https://' + s;
    return '';
  }
  /* "claude.ai" out of "https://claude.ai/new?x=1" — the only thing worth
     showing next to a tool's name. */
  function hostOf(url) {
    var s = safeUrl(url);
    if (!s) return '';
    try { return new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* {{VARIABLE}} is the one thing worth picking out of a prompt at a
     glance — it is what you have to replace before pasting. Returned in
     first-appearance order, de-duplicated, so the variable console under
     the prompt reads in the order you meet them. */
  function detectVariables(text) {
    var out = [], seen = {}, re = /\{\{\s*([A-Z0-9_ -]+?)\s*\}\}/g, m;
    while ((m = re.exec(String(text || '')))) {
      var name = m[1].trim();
      if (name && !seen[name]) { seen[name] = 1; out.push(name); }
    }
    return out;
  }
  function fillVariables(text, values) {
    return String(text || '').replace(/\{\{\s*([A-Z0-9_ -]+?)\s*\}\}/g, function (whole, name) {
      var v = values ? values[name.trim()] : '';
      return (v == null || v === '') ? whole : v;
    });
  }

  // ============================================================
  // VOCABULARIES
  //
  // Flat, fixed and short. The old page let you invent a second tag axis
  // and then made you maintain it; these are eight words covering what a
  // prompt is FOR, and the list is deliberately not user-editable — an
  // eight-item row you never have to think about is the point.
  //
  // Each carries a hue, which is this page's one structural device: a
  // category reads as a coloured hairline and dot on every card, row and
  // chip. Amber is deliberately absent from both lists — it is reserved
  // STRICTLY for the favourite star, so "I use this one constantly" reads
  // instantly against otherwise cool chrome.
  // ============================================================
  var PROMPT_CATEGORIES = [
    { id: 'writing',   label: 'Writing',   hue: '#7FB3FF' },
    { id: 'thinking',  label: 'Thinking',  hue: '#C79BFF' },
    { id: 'research',  label: 'Research',  hue: '#6FE3B8' },
    { id: 'selfcare',  label: 'Self-Care', hue: '#FF9EC4' },
    { id: 'planning',  label: 'Planning',  hue: '#8FE0E8' },
    { id: 'editing',   label: 'Editing',   hue: '#E79FE8' },
    { id: 'learning',  label: 'Learning',  hue: '#B6E06A' },
    { id: 'other',     label: 'Other',     hue: '#8A94A6' }
  ];

  var TOOL_CATEGORIES = [
    { id: 'ai',           label: 'AI',           hue: '#4FD6E8' },
    { id: 'writing',      label: 'Writing',      hue: '#7FB3FF' },
    { id: 'research',     label: 'Research',     hue: '#6FE3B8' },
    { id: 'productivity', label: 'Productivity', hue: '#8FE0E8' },
    { id: 'media',        label: 'Media',        hue: '#FF9EC4' },
    { id: 'design',       label: 'Design',       hue: '#E79FE8' },
    { id: 'audio',        label: 'Audio',        hue: '#C79BFF' },
    { id: 'video',        label: 'Video',        hue: '#FFA9A0' },
    { id: 'utilities',    label: 'Utilities',    hue: '#B6E06A' },
    { id: 'other',        label: 'Other',        hue: '#8A94A6' }
  ];

  /* The tiny compatibility field. Not a filing system — a note on the
     card, so you know which tab to open once you have already found the
     prompt you wanted. */
  var COMPAT = [
    { id: '',        label: 'Any model' },
    { id: 'claude',  label: 'Claude' },
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'either',  label: 'Either' }
  ];

  function catList(kind) { return kind === 'tool' ? TOOL_CATEGORIES : PROMPT_CATEGORIES; }
  function catById(kind, id) {
    var all = catList(kind);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return all[all.length - 1];   // 'other'
  }
  function compatLabel(id) {
    if (!id) return '';
    for (var i = 0; i < COMPAT.length; i++) if (COMPAT[i].id === id) return COMPAT[i].label;
    return '';
  }

  // ============================================================
  // MODELS
  // ============================================================
  function promptModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pp'),
      title: d.title || 'Untitled prompt',
      text: d.text == null ? '' : String(d.text),
      category: catById('prompt', d.category).id,
      tags: Array.isArray(d.tags) ? d.tags : [],
      compat: ['claude', 'chatgpt', 'either'].indexOf(d.compat) >= 0 ? d.compat : '',
      favorite: !!d.favorite,
      notes: d.notes == null ? '' : String(d.notes),
      variables: Array.isArray(d.variables) ? d.variables : detectVariables(d.text),
      useCount: Number(d.useCount) || 0,
      lastUsedAt: d.lastUsedAt || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  function toolModel(d) {
    d = d || {};
    return {
      id: d.id || uid('tl'),
      name: d.name || 'Untitled tool',
      url: safeUrl(d.url),
      icon: d.icon || '',
      category: catById('tool', d.category).id,
      favorite: !!d.favorite,
      quick: !!d.quick,
      tags: Array.isArray(d.tags) ? d.tags : [],
      useFor: d.useFor == null ? '' : String(d.useFor),
      /* A reminder of WHICH account, never a credential. The field label
         and its placeholder both say so. This row syncs to Supabase and
         is readable by anything holding the anon key — it is the wrong
         place for a password, and treating it as one would be worse than
         not offering the field at all. */
      accountNote: d.accountNote == null ? '' : String(d.accountNote),
      relatedPrompts: Array.isArray(d.relatedPrompts) ? d.relatedPrompts : [],
      useCount: Number(d.useCount) || 0,
      lastOpenedAt: d.lastOpenedAt || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  /* One model, two kinds. A prompt chain (Draft → Critique → Rewrite)
     and a tool stack (Obsidian → Claude → Google Docs) are the same
     object — an ordered list of ids — and making them one model is what
     lets a single renderer, editor and reorder path serve both. `kind`
     decides which library itemIds point into. */
  function collectionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('col'),
      kind: d.kind === 'tool' ? 'tool' : 'prompt',
      title: d.title || 'Untitled collection',
      icon: d.icon || '',
      summary: d.summary == null ? '' : String(d.summary),
      itemIds: Array.isArray(d.itemIds) ? d.itemIds.slice() : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  // ============================================================
  // COLLECTIONS — makeCollection copied verbatim from codex-data.js:599,
  // as the previous version of this file did. It works; it is the house
  // pattern; per-file duplication is deliberate here (there is no module
  // system in this app).
  // ============================================================
  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function get(id) { var all = list(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
    function add(data) { var r = model(data); var all = list(); all.push(r); storeSet(key, all); return r; }
    function update(id, patch) {
      var all = list();
      var idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      var merged = {};
      for (var k in all[idx]) merged[k] = all[idx][k];
      for (var k2 in patch) merged[k2] = patch[k2];
      merged.id = id;
      merged.updatedAt = nowISO();
      all[idx] = model(merged);
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      var all = list();
      var next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function removeWhere(fn) {
      var all = list();
      var next = all.filter(function (x) { return !fn(x); });
      storeSet(key, next);
      return all.length - next.length;
    }
    function replaceAll(records) { storeSet(key, Array.isArray(records) ? records : []); }
    return { key: key, list: list, get: get, add: add, update: update, remove: remove, removeWhere: removeWhere, replaceAll: replaceAll };
  }

  var Prompts     = makeCollection(KEYS.prompts, promptModel);
  var Tools       = makeCollection(KEYS.tools, toolModel);
  var Collections = makeCollection(KEYS.collections, collectionModel);

  function byOrder(a, b) {
    var d = (a.order || 0) - (b.order || 0);
    return d !== 0 ? d : String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }
  function nextOrder(records) {
    var max = -1;
    for (var i = 0; i < records.length; i++) if ((records[i].order || 0) > max) max = records[i].order || 0;
    return max + 1;
  }
  function reorderCollection(col, orderedIds) {
    var all = col.list();
    var pos = {};
    for (var i = 0; i < orderedIds.length; i++) pos[orderedIds[i]] = i;
    for (var j = 0; j < all.length; j++) {
      if (Object.prototype.hasOwnProperty.call(pos, all[j].id)) all[j].order = pos[all[j].id];
    }
    col.replaceAll(all);
  }

  // ============================================================
  // QUERIES
  // ============================================================
  function collectionsOfKind(kind) {
    return Collections.list().filter(function (c) { return c.kind === kind; }).sort(byOrder);
  }
  /* Every collection a given item belongs to — shown on the item's own
     page so a prompt tells you which workflows expect it. */
  function collectionsHolding(kind, itemId) {
    return collectionsOfKind(kind).filter(function (c) { return c.itemIds.indexOf(itemId) >= 0; });
  }
  /* Removing an item from the libraries must not leave a dangling id in
     any collection — a chain with a hole in it renders a blank step. */
  function dropFromCollections(kind, itemId) {
    var all = Collections.list(), changed = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].kind !== kind) continue;
      var idx = all[i].itemIds.indexOf(itemId);
      if (idx >= 0) { all[i].itemIds.splice(idx, 1); changed = true; }
    }
    if (changed) Collections.replaceAll(all);
    return changed;
  }
  function removePrompt(id) {
    dropFromCollections('prompt', 'prm:' + id);
    // Also unlink it from any tool's Related Prompts.
    var tools = Tools.list(), changed = false;
    for (var i = 0; i < tools.length; i++) {
      var idx = tools[i].relatedPrompts.indexOf('prm:' + id);
      if (idx >= 0) { tools[i].relatedPrompts.splice(idx, 1); changed = true; }
    }
    if (changed) Tools.replaceAll(tools);
    return Prompts.remove(id);
  }
  function removeTool(id) {
    dropFromCollections('tool', id);
    return Tools.remove(id);
  }

  // ============================================================
  // §FICTION SIDECAR
  //
  // Prompt Studio's own metadata for prompts that live in the Codex's
  // store. An object map rather than a collection: access is always
  // meta[id], and whole-map last-write-wins is the same concurrency
  // contract every other key here has.
  //
  // It is now ONE field. Everything else the old sidecar carried
  // (rating, purpose tags, creator, source, status) is gone with the
  // features that used it. A fiction prompt's star is NOT here — it maps
  // onto the Codex's own `favorite` field, shared both ways, which is
  // why fiction favourites survived the 2026-08-25 wipe.
  //
  // NOTE the deliberate absence of an auto-prune. A cdx: prompt missing
  // from the store may simply mean the Codex has not hydrated on this
  // device yet; deleting its metadata on that basis would throw work
  // away for no reason.
  // ============================================================
  function fictionMetaAll() {
    var v = storeGet(KEYS.fictionMeta);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }
  function fictionMetaModel(d) {
    d = d || {};
    return {
      category: catById('prompt', d.category || 'writing').id,
      updatedAt: d.updatedAt || ''
    };
  }
  function fictionMetaFor(promptId) { return fictionMetaModel(fictionMetaAll()[promptId]); }
  function setFictionMeta(promptId, patch) {
    if (!promptId) return null;
    var all = fictionMetaAll();
    var merged = fictionMetaModel(all[promptId]);
    for (var k in patch) merged[k] = patch[k];
    merged.updatedAt = nowISO();
    all[promptId] = fictionMetaModel(merged);
    storeSet(KEYS.fictionMeta, all);
    return all[promptId];
  }
  function dropFictionMeta(promptId) {
    var all = fictionMetaAll();
    if (!(promptId in all)) return false;
    delete all[promptId];
    storeSet(KEYS.fictionMeta, all);
    return true;
  }

  /* The exact field list codex-data.js's promptModel() emits. Any patch
     key outside this set would be silently dropped the next time the
     Codex touched the record, so the adapter in promptarium.html asserts
     against it before every fiction write. */
  var CDX_PROMPT_FIELDS = [
    'id', 'scope', 'scopeId', 'title', 'icon', 'category', 'tags', 'text',
    'variables', 'modelHint', 'favorite', 'useCount', 'lastUsedAt', 'order',
    'createdAt', 'updatedAt'
  ];
  function assertCodexFields(patch, where) {
    var bad = Object.keys(patch || {}).filter(function (k) { return CDX_PROMPT_FIELDS.indexOf(k) < 0; });
    if (bad.length) {
      try {
        console.error('[Prompt Studio] ' + (where || 'codex write') + ': these keys are not in the Codex prompt model ' +
          'and would be silently stripped — they belong in prm:fictionMeta instead: ' + bad.join(', '));
      } catch (e) {}
      return false;
    }
    return true;
  }

  // ============================================================
  // UI STATE / SETTINGS
  // ============================================================
  function getUiState() { var v = storeGet(KEYS.uiState); return (v && typeof v === 'object') ? v : {}; }
  function setUiState(patch) {
    var s = getUiState();
    for (var k in patch) s[k] = patch[k];
    storeSet(KEYS.uiState, s);
    return s;
  }
  function getSettings() {
    var v = storeGet(KEYS.settings) || {};
    return {
      showFiction: v.showFiction !== false,
      motion: v.motion !== false
    };
  }
  function setSettings(patch) {
    var s = getSettings();
    for (var k in patch) s[k] = patch[k];
    storeSet(KEYS.settings, s);
    return s;
  }

  // ============================================================
  // §WIPE — the 2026-08-25 rebuild's one destructive act.
  //
  // Damian asked for the old prompt library to be DELETED rather than
  // migrated: filing by model was the thing being thrown out, and
  // carrying twenty prompts across into a shape that no longer fits
  // would have meant living with the old taxonomy anyway.
  //
  // Three properties make that recoverable rather than a cliff, and none
  // of them is optional:
  //
  //   1. It enumerates EXPLICIT KEYS. Not a prefix sweep, not clear().
  //      Read the two arrays at the top of this file: every string starts
  //      'prm:'. No 'cdx:' key appears, and none may ever be added — the
  //      same row holds the manuscripts.
  //   2. The CALLER must not run it before the first cloud pull resolves.
  //      pushNow() sends collect() as the row's ENTIRE data column, so
  //      any write that beats the opening select erases every key this
  //      device happens to lack, and then pushes the erasure as truth.
  //      That is the mechanism that ate a night of workout routines on
  //      2026-08-20. promptarium.html calls this from onPulled, never
  //      from a timer.
  //   3. promptarium-backup.js must already have snapshotted. The wipe
  //      refuses to run if it cannot see the backup module, because an
  //      un-undoable version of this function is not a feature.
  // ============================================================
  function wipeLegacy(opts) {
    opts = opts || {};
    if (Number(storeGet(KEYS.schema)) >= SCHEMA) return { ran: false, reason: 'already' };

    /* NO OLD LIBRARY HERE. Every one of LEGACY_KEYS belonged to a feature
       the rebuild removed, and the old page wrote prm:seededAt on its very
       first run — so their total absence means this device never held the
       model-based library, and there is nothing to convert.

       Deleting REUSED_KEYS on such a device would be pure loss. It matters
       because the caller has a timeout fallback for a cloud pull that never
       answers: without this branch, a page left open for three seconds on a
       bad connection would delete prompts written in those three seconds.
       Stamp the schema, delete nothing. */
    var hasLegacy = false;
    for (var i = 0; i < LEGACY_KEYS.length; i++) {
      try { if (localStorage.getItem(LEGACY_KEYS[i]) != null) { hasLegacy = true; break; } } catch (e) {}
    }
    if (!hasLegacy) { storeSet(KEYS.schema, SCHEMA); return { ran: false, reason: 'fresh' }; }

    if (!opts.force && !(global.PromptariumBackup && global.PromptariumBackup.hasSnapshot())) {
      return { ran: false, reason: 'no-snapshot' };
    }
    var removed = [];
    LEGACY_KEYS.concat(REUSED_KEYS).forEach(function (k) {
      if (k.indexOf('prm:') !== 0) return;             // belt and braces
      try {
        if (localStorage.getItem(k) != null) { localStorage.removeItem(k); removed.push(k); }
      } catch (e) {}
    });
    storeSet(KEYS.schema, SCHEMA);
    return { ran: true, removed: removed };
  }

  // ============================================================
  // §STARTER TOOLS — offered behind a button in the empty state, never
  // seeded. Seeding writes to a synced row on every fresh device; a
  // button writes only when asked. Every record is an ordinary editable
  // tool the moment it lands.
  // ============================================================
  var STARTER_TOOLS = [
    { name: 'Claude',           url: 'https://claude.ai',                 icon: '◈', category: 'ai',           quick: true,  favorite: true,  useFor: 'Long documents, careful prose, code review.' },
    { name: 'ChatGPT',          url: 'https://chatgpt.com',               icon: '◉', category: 'ai',           quick: true,  favorite: true,  useFor: 'Fast reasoning, tables, structured brainstorms.' },
    { name: 'Obsidian',         url: 'https://obsidian.md',               icon: '◆', category: 'writing',      quick: true,  favorite: true,  useFor: 'The notes everything else feeds into.' },
    { name: 'Perplexity',       url: 'https://perplexity.ai',             icon: '◐', category: 'research',     quick: true,  favorite: true,  useFor: 'Cited answers you can actually check.' },
    { name: 'NotebookLM',       url: 'https://notebooklm.google.com',     icon: '▤', category: 'research',     quick: true,  favorite: true,  useFor: 'Answers grounded in sources you uploaded.' },
    { name: 'Google AI Studio', url: 'https://aistudio.google.com',       icon: '◇', category: 'ai',           quick: false, favorite: false, useFor: 'Long-context runs and image prompting.' },
    { name: 'ElevenLabs',       url: 'https://elevenlabs.io',             icon: '◍', category: 'audio',        quick: true,  favorite: false, useFor: 'Narration and voice.' },
    { name: 'Canva',            url: 'https://canva.com',                 icon: '▣', category: 'design',       quick: true,  favorite: false, useFor: 'Covers, banners, anything that needs to look finished today.' },
    { name: 'Google Drive',     url: 'https://drive.google.com',          icon: '▲', category: 'productivity', quick: true,  favorite: false, useFor: 'Where the finished files live.' }
  ];
  function addStarterTools() {
    var have = {};
    Tools.list().forEach(function (t) { have[String(t.name).toLowerCase()] = 1; });
    var order = nextOrder(Tools.list()), added = 0;
    STARTER_TOOLS.forEach(function (t) {
      if (have[t.name.toLowerCase()]) return;
      var rec = {};
      for (var k in t) rec[k] = t[k];
      rec.order = order++;
      Tools.add(rec);
      added++;
    });
    return added;
  }

  global.Promptarium = {
    KEYS: KEYS, SCHEMA: SCHEMA, LEGACY_KEYS: LEGACY_KEYS, REUSED_KEYS: REUSED_KEYS,
    storeGet: storeGet, storeSet: storeSet,
    uid: uid, nowISO: nowISO, fmtDate: fmtDate, fmtAgo: fmtAgo,
    esc: esc, clamp: clamp, safeUrl: safeUrl, hostOf: hostOf, stripControl: stripControl,
    detectVariables: detectVariables, fillVariables: fillVariables,

    PROMPT_CATEGORIES: PROMPT_CATEGORIES,
    TOOL_CATEGORIES: TOOL_CATEGORIES,
    COMPAT: COMPAT,
    catList: catList, catById: catById, compatLabel: compatLabel,

    promptModel: promptModel, toolModel: toolModel, collectionModel: collectionModel,
    Prompts: Prompts, Tools: Tools, Collections: Collections,

    byOrder: byOrder, nextOrder: nextOrder, reorderCollection: reorderCollection,
    collectionsOfKind: collectionsOfKind, collectionsHolding: collectionsHolding,
    dropFromCollections: dropFromCollections,
    removePrompt: removePrompt, removeTool: removeTool,

    fictionMetaAll: fictionMetaAll, fictionMetaFor: fictionMetaFor,
    setFictionMeta: setFictionMeta, dropFictionMeta: dropFictionMeta,
    CDX_PROMPT_FIELDS: CDX_PROMPT_FIELDS, assertCodexFields: assertCodexFields,

    getUiState: getUiState, setUiState: setUiState,
    getSettings: getSettings, setSettings: setSettings,

    wipeLegacy: wipeLegacy,
    STARTER_TOOLS: STARTER_TOOLS, addStarterTools: addStarterTools
  };

})(window);
