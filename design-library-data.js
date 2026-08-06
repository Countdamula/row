// design-library-data.js
//
// Shared data foundation for design-library.html ("Design Library") — a
// personal, searchable design knowledge base: components, themes,
// templates, animations, color palettes, backgrounds, typography, icon
// packs, and layouts, each optionally carrying its own AI prompt, code
// snippets, and a live-preview sandbox — plus Collections that group any
// of the above. Same conventions as every other -data.js in this app
// (aitech-data.js/knowledge-hub-data.js): plain localStorage, JSON-
// serialized, one key per collection, no server/DB. All keys live under a
// `dl:` prefix so design-library.html's initCloudSync({ syncedPrefixes:
// ['dl:'] }) call covers every collection with no per-key list.
//
// ARCHITECTURE NOTE, disclosed rather than silently done: the request
// specified ~20 separate "pages" (Component Marketplace, Theme Gallery,
// Template Marketplace, Animations, Color Palettes, Backgrounds,
// Typography, Icon Packs, Layout Library, Mobile UI, Desktop UI,
// Dashboard Components, AI UI, Collections, Favorites, Recently Added,
// Trending, Prompt Library, Saved Code, Personal Uploads). Building 20
// separate .html files, each re-implementing the same card/filter/detail
// machinery, would mean 20 near-duplicate implementations that could
// drift apart — the same "one generic model, filtered many ways"
// precedent this app's own mediaverse-data.js (a single MediaItem across
// 10 categories), aitech-data.js, and knowledge-hub-data.js (11
// departments off one CATEGORY_META-style table) already established
// repeatedly. So: ONE flat `Resource` collection with a `category` field
// (9 real categories) plus an optional `platformTag` (mobile/desktop/
// dashboard/ai/universal, meaningful on Components) drives every one of
// those 20 nav items as a filtered view over the same data, via
// design-library.html's own dispatcher — nothing is missing, it's just
// not 20 separate files.
//
// AI FEATURES, confirmed adaptation: this app has no backend and no
// active AI key configured anywhere by default (§1/§2 of CLAUDE.md) — the
// established pattern every AI-shaped feature in this app already follows
// (Main Pillar's Briefs, Fitness Studio's Coach, Knowledge Hub's
// Assistant) is: call the real Anthropic API when a key is configured,
// always fall back to an honestly-computed, genuinely useful LOCAL
// transform otherwise — never a fabricated "AI said" claim. The key lives
// in customization.html's own Settings (customization:settings.aiKey) —
// this file reads it directly via the same "read another page's own
// storage key" precedent this app's tasks-data.js importers and
// topbar.js's buildLearningTopicItems() already use, rather than
// duplicating a second key field here.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js/
  // business-data.js's storeSet(): dispatches a 'dl:save' event either
  // way so the page can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('dl:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('dl:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    resources: 'dl:resources',
    collections: 'dl:collections',
    hero: 'dl:hero',
    recentViews: 'dl:recentViews',
    seeded: 'dl:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 640; quality = quality == null ? 0.82 : quality;
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
  function isValidMediaUrl(value) {
    if (!value) return false;
    try { const u = new URL(String(value)); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }

  // ============================================================
  // FIXED VOCABULARIES — the one table that drives every category-scoped
  // nav item, filter chip, icon, and label (the "generic model + fixed
  // vocabulary table" precedent — see header comment).
  // ============================================================
  const CATEGORY_META = {
    component:  { icon: '🧩', label: 'Component',   plural: 'Components',    hint: 'Buttons, cards, forms, nav bars — any reusable UI piece.' },
    theme:      { icon: '🎨', label: 'Theme',        plural: 'Themes',        hint: 'A full color/typography/component treatment.' },
    template:   { icon: '📦', label: 'Template',     plural: 'Templates',     hint: 'A whole page or app layout, ready to adapt.' },
    animation:  { icon: '✨', label: 'Animation',     plural: 'Animations',    hint: 'Micro-interactions, transitions, loaders.' },
    palette:    { icon: '🌈', label: 'Color Palette', plural: 'Color Palettes', hint: 'A curated set of colors that work together.' },
    background: { icon: '🖼', label: 'Background',   plural: 'Backgrounds',   hint: 'Gradients, textures, patterns, hero art.' },
    typography: { icon: '🔤', label: 'Typography',   plural: 'Typography',   hint: 'Font pairings and type scales.' },
    iconpack:   { icon: '🎭', label: 'Icon Pack',    plural: 'Icon Packs',    hint: 'A cohesive set of icons/glyphs.' },
    layout:     { icon: '🧱', label: 'Layout',       plural: 'Layouts',      hint: 'Grid systems, spacing scales, structural patterns.' }
  };
  const CATEGORY_KEYS = Object.keys(CATEGORY_META);

  const PLATFORM_TAGS = { universal: 'Universal', mobile: '📱 Mobile UI', desktop: '💻 Desktop UI', dashboard: '📊 Dashboard', ai: '🤖 AI UI' };
  const FRAMEWORKS = ['React', 'Next.js', 'Tailwind CSS', 'HTML/CSS/JS', 'TypeScript', 'Vue', 'Svelte', 'Solid', 'Astro', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Other'];
  const CODE_LANGUAGES = ['React (JSX)', 'Next.js', 'Tailwind', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vue', 'Svelte', 'Solid', 'Astro', 'Flutter (Dart)', 'SwiftUI', 'Jetpack Compose (Kotlin)', 'Other'];
  const COMPLEXITIES = ['Simple', 'Moderate', 'Complex'];
  const STATUSES = ['Inspiration', 'Saved', 'In Progress', 'Production Ready'];

  // ============================================================
  // RESOURCE — the one generic model behind every catalog page.
  // ============================================================
  function codeSnippetModel(data) {
    data = data || {};
    return {
      id: data.id || uid('code'),
      language: CODE_LANGUAGES.indexOf(data.language) !== -1 ? data.language : CODE_LANGUAGES[0],
      code: typeof data.code === 'string' ? data.code : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function promptVersionModel(data) {
    data = data || {};
    return { id: data.id || uid('pv'), body: typeof data.body === 'string' ? data.body : '', note: typeof data.note === 'string' ? data.note : '', createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }
  function promptModel(data) {
    data = data || {};
    return {
      body: typeof data.body === 'string' ? data.body : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      rating: (typeof data.rating === 'number' && data.rating >= 0 && data.rating <= 5) ? data.rating : 0,
      tags: Array.isArray(data.tags) ? data.tags : [],
      versions: Array.isArray(data.versions) ? data.versions.map(promptVersionModel) : []
    };
  }
  function aiLogEntryModel(data) {
    data = data || {};
    return { id: data.id || uid('ai'), action: typeof data.action === 'string' ? data.action : '', output: typeof data.output === 'string' ? data.output : '', isAI: !!data.isAI, createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }

  /** @typedef {Object} Resource */
  function resourceModel(data) {
    data = data || {};
    return {
      id: data.id || uid('res'),
      title: typeof data.title === 'string' ? data.title : '',
      category: CATEGORY_KEYS.indexOf(data.category) !== -1 ? data.category : 'component',
      creator: typeof data.creator === 'string' ? data.creator : '',
      framework: FRAMEWORKS.indexOf(data.framework) !== -1 ? data.framework : FRAMEWORKS[0],
      platformTag: PLATFORM_TAGS[data.platformTag] ? data.platformTag : 'universal',
      cover: typeof data.cover === 'string' ? data.cover : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      status: STATUSES.indexOf(data.status) !== -1 ? data.status : 'Saved',
      complexity: COMPLEXITIES.indexOf(data.complexity) !== -1 ? data.complexity : 'Moderate',
      darkMode: !!data.darkMode,
      responsive: !!data.responsive,
      accessible: !!data.accessible,
      animated: !!data.animated,
      description: typeof data.description === 'string' ? data.description : '',
      useCases: typeof data.useCases === 'string' ? data.useCases : '',
      accessibilityNotes: typeof data.accessibilityNotes === 'string' ? data.accessibilityNotes : '',
      performanceNotes: typeof data.performanceNotes === 'string' ? data.performanceNotes : '',
      dependencies: typeof data.dependencies === 'string' ? data.dependencies : '',
      installation: typeof data.installation === 'string' ? data.installation : '',
      browserCompat: typeof data.browserCompat === 'string' ? data.browserCompat : 'Modern evergreen browsers',
      rating: (typeof data.rating === 'number' && data.rating >= 0 && data.rating <= 5) ? data.rating : 0,
      favorite: !!data.favorite,
      trending: !!data.trending,
      viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
      personalNotes: typeof data.personalNotes === 'string' ? data.personalNotes : '',
      prompt: promptModel(data.prompt),
      codeSnippets: Array.isArray(data.codeSnippets) ? data.codeSnippets.map(codeSnippetModel) : [],
      previewHtml: typeof data.previewHtml === 'string' ? data.previewHtml : '',
      previewCss: typeof data.previewCss === 'string' ? data.previewCss : '',
      previewJs: typeof data.previewJs === 'string' ? data.previewJs : '',
      relatedIds: Array.isArray(data.relatedIds) ? data.relatedIds : [],
      aiLog: Array.isArray(data.aiLog) ? data.aiLog.map(aiLogEntryModel) : [],
      source: data.source === 'seed' ? 'seed' : 'personal',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
    };
  }

  // ============================================================
  // COLLECTIONS — user-defined groupings over any mix of resources.
  // ============================================================
  function collectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('col'),
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      icon: typeof data.icon === 'string' ? data.icon : '📁',
      color: typeof data.color === 'string' ? data.color : '#ff3b4a',
      itemIds: Array.isArray(data.itemIds) ? data.itemIds : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : ''
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero)); }
  function saveHero(patch) { const next = heroModel(Object.assign({}, getHero(), patch)); storeSet(KEYS.hero, next); return next; }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as every other
  // -data.js file in this app.
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) { const record = model(data); const all = list(); all.push(record); storeSet(key, all); return record; }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id, updatedAt: Date.now() }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) { const all = list(); const next = all.filter(function (x) { return x.id !== id; }); storeSet(key, next); return next.length !== all.length; }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const Resources = makeCollection(KEYS.resources, resourceModel);
  const Collections = makeCollection(KEYS.collections, collectionModel);

  /** Deleting a resource nulls it out of every collection's itemIds and
   * every other resource's relatedIds rather than leaving a dangling id —
   * same null-out-the-reference precedent aitech-data.js's model deletion
   * and household-data.js's legion deletion already established. */
  function removeResource(id) {
    Resources.remove(id);
    Collections.replaceAll(Collections.list().map(function (c) { return Object.assign({}, c, { itemIds: c.itemIds.filter(function (x) { return x !== id; }) }); }));
    Resources.replaceAll(Resources.list().map(function (r) { return (r.relatedIds && r.relatedIds.indexOf(id) !== -1) ? Object.assign({}, r, { relatedIds: r.relatedIds.filter(function (x) { return x !== id; }) }) : r; }));
  }

  // Keeps a resource's Live Preview source (previewHtml/previewCss/
  // previewJs — editable on the Preview tab, otherwise invisible to the
  // Code tab/Saved Code page) mirrored into three reserved-id entries in
  // its own codeSnippets[] — so ANY code written anywhere on a resource,
  // not just via "+ Add Snippet," is guaranteed to actually show up on
  // the Saved Code page (which is just a flat read of every resource's
  // codeSnippets — see allCodeSnippets() below). Idempotent (only writes
  // when something actually changed) and safe to call after every
  // preview-field save, or in bulk over every resource on boot to catch
  // pre-existing preview code that predates this sync existing.
  const PREVIEW_SNIPPET_SPECS = [
    { id: '__previewHtml', language: 'HTML', field: 'previewHtml' },
    { id: '__previewCss', language: 'CSS', field: 'previewCss' },
    { id: '__previewJs', language: 'JavaScript', field: 'previewJs' }
  ];
  function syncPreviewCodeSnippets(resourceId) {
    const r = Resources.get(resourceId);
    if (!r) return false;
    let snippets = r.codeSnippets.slice();
    let changed = false;
    PREVIEW_SNIPPET_SPECS.forEach(function (spec) {
      const idx = snippets.findIndex(function (cs) { return cs.id === spec.id; });
      const content = r[spec.field];
      if (content && content.trim()) {
        if (idx !== -1 && snippets[idx].code === content) return; // already in sync
        const entry = {
          id: spec.id, language: spec.language, code: content,
          notes: 'Auto-synced from this resource\'s Live Preview tab — edit it there, not here.',
          createdAt: idx !== -1 ? snippets[idx].createdAt : Date.now()
        };
        if (idx !== -1) snippets[idx] = entry; else snippets.push(entry);
        changed = true;
      } else if (idx !== -1) {
        snippets.splice(idx, 1);
        changed = true;
      }
    });
    if (changed) Resources.update(resourceId, { codeSnippets: snippets });
    return changed;
  }
  /** Runs syncPreviewCodeSnippets() over every resource — used once at
   * boot so preview code that already existed before this sync was added
   * (e.g. seeded resources) is captured immediately too, not just on the
   * next edit. Idempotent and cheap (a no-op write for anything already
   * in sync), so it's safe to call on every load rather than needing a
   * one-time migration flag. */
  function syncAllPreviewCodeSnippets() {
    Resources.list().forEach(function (r) { syncPreviewCodeSnippets(r.id); });
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function resourcesSorted() { return Resources.list().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt || a.order - b.order; }); }
  function resourcesByCategory(cat) { return resourcesSorted().filter(function (r) { return r.category === cat; }); }
  function resourcesByPlatform(tag) { return resourcesSorted().filter(function (r) { return r.category === 'component' && r.platformTag === tag; }); }
  function favoriteResources() { return resourcesSorted().filter(function (r) { return r.favorite; }); }
  function trendingResources() { return resourcesSorted().filter(function (r) { return r.trending; }).sort(function (a, b) { return b.viewCount - a.viewCount; }); }
  function recentlyAdded(n) { return Resources.list().slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, n || 60); }
  function promptResources() { return resourcesSorted().filter(function (r) { return r.prompt && r.prompt.body; }); }
  function personalUploadResources() { return resourcesSorted().filter(function (r) { return r.source === 'personal'; }); }
  function allCodeSnippets() {
    const out = [];
    resourcesSorted().forEach(function (r) { (r.codeSnippets || []).forEach(function (cs) { out.push(Object.assign({}, cs, { resourceId: r.id, resourceTitle: r.title })); }); });
    return out.sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function collectionsSorted() { return Collections.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function itemsInCollection(collectionId) {
    const c = Collections.get(collectionId);
    if (!c) return [];
    const byId = {}; Resources.list().forEach(function (r) { byId[r.id] = r; });
    return c.itemIds.map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function collectionsForResource(resourceId) { return collectionsSorted().filter(function (c) { return c.itemIds.indexOf(resourceId) !== -1; }); }
  function toggleResourceInCollection(collectionId, resourceId) {
    const c = Collections.get(collectionId);
    if (!c) return;
    const has = c.itemIds.indexOf(resourceId) !== -1;
    Collections.update(collectionId, { itemIds: has ? c.itemIds.filter(function (x) { return x !== resourceId; }) : c.itemIds.concat([resourceId]) });
  }
  function relatedResources(resource) {
    if (!resource) return [];
    const byId = {}; Resources.list().forEach(function (r) { byId[r.id] = r; });
    const explicit = (resource.relatedIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (explicit.length) return explicit;
    // Fall back to same-category resources sharing at least one tag —
    // a cheap, honest "similar items" heuristic, not a fabricated
    // recommendation engine.
    const tagSet = {}; (resource.tags || []).forEach(function (t) { tagSet[t.toLowerCase()] = true; });
    return resourcesByCategory(resource.category).filter(function (r) {
      if (r.id === resource.id) return false;
      return (r.tags || []).some(function (t) { return tagSet[t.toLowerCase()]; });
    }).slice(0, 6);
  }
  function recordView(id) {
    const r = Resources.get(id);
    if (!r) return;
    Resources.update(id, { viewCount: (r.viewCount || 0) + 1 });
    let recent = storeGet(KEYS.recentViews) || [];
    recent = [id].concat(recent.filter(function (x) { return x !== id; })).slice(0, 24);
    storeSet(KEYS.recentViews, recent);
  }
  function recentlyViewed() {
    const ids = storeGet(KEYS.recentViews) || [];
    const byId = {}; Resources.list().forEach(function (r) { byId[r.id] = r; });
    return ids.map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function reorderResourcesVisible(orderedIds) {
    const all = Resources.list();
    const byId = {}; all.forEach(function (r) { byId[r.id] = r; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Resources.replaceAll(all);
  }
  function reorderCollections(orderedIds) {
    const all = Collections.list();
    const byId = {}; all.forEach(function (c) { byId[c.id] = c; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Collections.replaceAll(all);
  }

  // ============================================================
  // GLOBAL SEARCH — resources (title/description/creator/framework/tags)
  // plus collections. Used by the command palette (Ctrl+K) and the Home
  // search box.
  // ============================================================
  function searchAll(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { resources: [], collections: [] };
    const resources = Resources.list().filter(function (r) {
      return (r.title || '').toLowerCase().indexOf(q) !== -1 ||
        (r.description || '').toLowerCase().indexOf(q) !== -1 ||
        (r.creator || '').toLowerCase().indexOf(q) !== -1 ||
        (r.framework || '').toLowerCase().indexOf(q) !== -1 ||
        (r.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
    }).slice(0, 40);
    const collections = Collections.list().filter(function (c) {
      return (c.title || '').toLowerCase().indexOf(q) !== -1 || (c.description || '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 12);
    return { resources: resources, collections: collections };
  }

  function stats() {
    const all = Resources.list();
    const byCategory = {};
    CATEGORY_KEYS.forEach(function (c) { byCategory[c] = 0; });
    all.forEach(function (r) { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });
    return {
      total: all.length,
      favorites: all.filter(function (r) { return r.favorite; }).length,
      withPrompts: all.filter(function (r) { return r.prompt && r.prompt.body; }).length,
      withCode: all.filter(function (r) { return r.codeSnippets && r.codeSnippets.length; }).length,
      collections: Collections.list().length,
      byCategory: byCategory
    };
  }

  // ============================================================
  // AI — real fetch when a key is configured (read from Customization's
  // own settings, see header comment), an honest local fallback otherwise.
  // Every fallback is a genuine, rule-based transform of the real input
  // text — never a fabricated "here's what AI said" claim.
  // ============================================================
  function getAiKey() {
    try {
      const s = JSON.parse(localStorage.getItem('customization:settings'));
      return (s && typeof s.aiKey === 'string') ? s.aiKey.trim() : '';
    } catch (e) { return ''; }
  }
  function getAiPrefs() {
    try {
      const s = JSON.parse(localStorage.getItem('customization:settings')) || {};
      return {
        persona: typeof s.aiPersona === 'string' && s.aiPersona ? s.aiPersona : 'a senior product designer and front-end engineer',
        creativity: typeof s.aiCreativity === 'number' ? s.aiCreativity : 0.6,
        responseLength: typeof s.aiResponseLength === 'string' ? s.aiResponseLength : 'medium'
      };
    } catch (e) { return { persona: 'a senior product designer and front-end engineer', creativity: 0.6, responseLength: 'medium' }; }
  }
  function callAnthropic(systemPrompt, userText) {
    const key = getAiKey();
    if (!key) return Promise.resolve(null);
    const prefs = getAiPrefs();
    const maxTokens = prefs.responseLength === 'short' ? 400 : prefs.responseLength === 'long' ? 1600 : 800;
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature: prefs.creativity,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }]
      })
    }).then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        if (!json || !json.content || !json.content[0] || typeof json.content[0].text !== 'string') return null;
        return json.content[0].text;
      }).catch(function () { return null; });
  }

  function stripFiller(text) {
    return (text || '')
      .replace(/\b(really|very|just|basically|simply|actually|kind of|sort of|in order to)\b/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();
  }
  const AI_ACTIONS = {
    improve: {
      label: 'Improve',
      system: 'You are {persona}. Improve the given AI prompt for generating UI/design work: sharpen the ask, add missing constraints (framework, accessibility, responsiveness), keep it concise. Return only the improved prompt text, no preamble.',
      local: function (text) {
        const p = getAiPrefs();
        return 'You are ' + p.persona + '. ' + stripFiller(text) +
          (/\baccessib/i.test(text) ? '' : ' Follow WCAG-friendly accessibility practices.') +
          (/\bresponsive/i.test(text) ? '' : ' Make it fully responsive.') +
          (/\bdark mode/i.test(text) ? '' : ' Support dark mode.');
      }
    },
    modernize: {
      label: 'Modernize',
      system: 'You are {persona}. Rewrite the given AI prompt for a modern (2025-era) design sensibility — glassmorphism/neumorphism where fitting, fluid micro-interactions, variable fonts, subtle depth. Return only the rewritten prompt.',
      local: function (text) { return stripFiller(text) + ' Use a modern 2025-era aesthetic — soft glassmorphism, fluid micro-interactions, generous spacing, and a restrained color palette.'; }
    },
    simplify: {
      label: 'Simplify',
      system: 'You are {persona}. Simplify the given AI prompt down to its essential ask — remove redundancy and filler, keep only what actually changes the output. Return only the simplified prompt.',
      local: function (text) { return stripFiller(text).split(/(?<=[.!?])\s+/).slice(0, 3).join(' '); }
    },
    expand: {
      label: 'Expand',
      system: 'You are {persona}. Expand the given AI prompt with more specific, useful detail (states, edge cases, spacing, interaction behavior) without changing its core intent. Return only the expanded prompt.',
      local: function (text) { return stripFiller(text) + ' Cover the default, hover, focus, active, disabled, and loading states explicitly, and specify spacing/sizing using a consistent scale.'; }
    },
    rewrite: {
      label: 'Rewrite Variation',
      system: 'You are {persona}. Write a genuinely different phrasing of the same design prompt intent — same outcome, fresh wording and structure. Return only the rewritten prompt.',
      local: function (text) { return 'Design and build: ' + stripFiller(text).replace(/^create\s+/i, '').replace(/^build\s+/i, '').replace(/^design\s+/i, ''); }
    },
    generateSimilar: {
      label: 'Generate Similar Prompt',
      system: 'You are {persona}. Given this design prompt, write ONE new, related prompt for a complementary component/theme that would pair well with it. Return only the new prompt.',
      local: function (text) { return 'Design a companion piece that pairs with: "' + stripFiller(text).slice(0, 140) + '" — matching its color language, radius, and motion style, adapted to a different UI element.'; }
    },
    accessibilityReview: {
      label: 'Accessibility Review',
      system: 'You are {persona} and a WCAG accessibility auditor. Given this component/theme description, list concrete accessibility risks and fixes (contrast, focus order, ARIA, motion, touch targets). Be specific and concise.',
      local: function (text) {
        const notes = [];
        if (!/\bcontrast\b/i.test(text)) notes.push('• Verify text/background contrast meets WCAG AA (4.5:1 for body text).');
        if (!/\bfocus\b/i.test(text)) notes.push('• Add a visible :focus-visible state for every interactive element.');
        if (!/\baria\b/i.test(text)) notes.push('• Add ARIA labels/roles for anything non-semantic (custom buttons, toggles, tabs).');
        if (!/\bmotion\b|\breduced.motion\b/i.test(text)) notes.push('• Respect prefers-reduced-motion for any animation.');
        notes.push('• Confirm touch targets are at least 44×44px on mobile.');
        return 'Local accessibility checklist (no AI key configured):\n' + notes.join('\n');
      }
    },
    performanceReview: {
      label: 'Performance Review',
      system: 'You are {persona} and a front-end performance reviewer. Given this component/theme description, list concrete performance risks and fixes (bundle size, re-renders, image weight, animation cost). Be specific and concise.',
      local: function (text) {
        const notes = ['• Lazy-load any offscreen images/media.', '• Prefer CSS transform/opacity for animation over layout-triggering properties.', '• Avoid re-rendering large lists on every keystroke — debounce filters/search.'];
        if (/\bimage|photo|cover/i.test(text)) notes.unshift('• Compress and size-cap cover/hero images before shipping.');
        return 'Local performance checklist (no AI key configured):\n' + notes.join('\n');
      }
    },
    convertFramework: {
      label: 'Convert Framework',
      system: 'You are {persona}. Rewrite the given prompt/description so it targets a different framework than the one implied, keeping the exact same visual/behavioral intent. Pick whichever conversion is most useful (e.g. React → plain HTML/CSS/JS, or vice versa) and say which conversion you chose in one leading line, then the converted prompt.',
      local: function (text) { return 'Framework conversion (no AI key configured — pick your target manually):\nSame intent, framework-agnostic version:\n' + stripFiller(text).replace(/\b(react|next\.js|vue|svelte|solid|astro)\b/gi, 'a component'); }
    },
    generateVariants: {
      label: 'Generate Variants',
      system: 'You are {persona}. Given this design prompt, propose 3 short variant directions (one line each) that change ONE dimension at a time — color mood, density, or motion level — while keeping the core layout intent.',
      local: function (text) {
        return 'Local variant ideas (no AI key configured):\n' +
          '• Color variant: same layout, swap the accent for a cooler/warmer hue.\n' +
          '• Density variant: same layout, tighten spacing by ~25% for a compact mode.\n' +
          '• Motion variant: same layout, add a subtle entrance animation and hover lift.';
      }
    },
    generateMatchingTheme: {
      label: 'Generate Matching Theme',
      system: 'You are {persona}. Given this component/prompt description, propose a small matching color theme (5 colors: background, surface, accent, text, muted-text) that would suit it, with hex values, in a short labeled list.',
      local: function (text) {
        return 'Local matching-theme suggestion (no AI key configured):\n' +
          '• Background: #0a0a0b\n• Surface: rgba(255,255,255,0.05)\n• Accent: #ff3b4a\n• Text: #fafafa\n• Muted text: rgba(250,250,250,0.44)\n(Reuses this Design Library\'s own default palette — configure an AI key in Customization for a description-specific suggestion.)';
      }
    }
  };
  // Actions that literally rewrite the prompt's own text get auto-saved
  // straight into that resource's `prompt.body` — the version-history
  // mechanism already snapshots whatever was there before, so nothing is
  // lost, and the result is guaranteed to actually show up in the Prompt
  // Library (which is just "every resource with a non-empty prompt.body"
  // — see promptResources() above), not left stranded only in aiLog.
  const PROMPT_REPLACE_ACTIONS = { improve: 1, modernize: 1, simplify: 1, expand: 1, rewrite: 1, convertFramework: 1 };
  // Actions that generate a NEW, related prompt rather than a rewrite of
  // the existing one are auto-saved as their own new resource instead —
  // a real, permanent, separate Prompt Library entry, not an overwrite of
  // something the user may still want to keep.
  const PROMPT_SPAWN_ACTIONS = { generateSimilar: 1, generateVariants: 1 };
  // accessibilityReview / performanceReview / generateMatchingTheme are
  // deliberately excluded from both — their output is a checklist/color
  // suggestion, not reusable prompt text, so it stays exactly where it
  // already was: logged in aiLog (see the AI Assistant tab), not pushed
  // into the Prompt Library under a name that would misdescribe it.
  function runAiAction(actionKey, resource) {
    const action = AI_ACTIONS[actionKey];
    if (!action) return Promise.resolve(null);
    const prefs = getAiPrefs();
    const input = (resource.prompt && resource.prompt.body) || resource.description || resource.title || '';
    const system = action.system.replace('{persona}', prefs.persona);
    return callAnthropic(system, input).then(function (aiText) {
      const isAI = !!aiText;
      const output = aiText || action.local(input);
      const entry = aiLogEntryModel({ action: action.label, output: output, isAI: isAI });
      const fresh = Resources.get(resource.id);
      let promptUpdated = false, newResourceId = null;
      if (fresh) {
        const patch = { aiLog: (fresh.aiLog || []).concat([entry]) };
        if (PROMPT_REPLACE_ACTIONS[actionKey]) {
          const prevBody = fresh.prompt.body;
          const versions = prevBody
            ? fresh.prompt.versions.concat([{ id: uid('pv'), body: prevBody, note: 'auto-saved before "' + action.label + '"', createdAt: Date.now() }])
            : fresh.prompt.versions;
          patch.prompt = Object.assign({}, fresh.prompt, { body: output, versions: versions.slice(-20) });
          promptUpdated = true;
        }
        Resources.update(resource.id, patch);
        if (PROMPT_SPAWN_ACTIONS[actionKey]) {
          const spawned = Resources.add({
            category: resource.category,
            title: (resource.title || 'Untitled') + ' — ' + action.label,
            creator: resource.creator, framework: resource.framework, tags: resource.tags.slice(),
            prompt: { body: output },
            order: nextOrder(resourcesByCategory(resource.category))
          });
          newResourceId = spawned.id;
        }
      }
      return { entry: entry, promptUpdated: promptUpdated, newResourceId: newResourceId };
    });
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Resources.replaceAll([]);
    Collections.replaceAll([]);

    const now = Date.now();
    const defs = [
      { category: 'component', title: 'Glass Dashboard Card', creator: 'You', framework: 'Tailwind CSS', platformTag: 'dashboard', tags: ['glassmorphism', 'card', 'dashboard'], status: 'Production Ready', complexity: 'Simple', darkMode: true, responsive: true, accessible: true, animated: true,
        description: 'A frosted-glass stat card with a hover lift and a subtle top glow — the base card used across most dashboard sections.',
        useCases: 'KPI tiles, stat summaries, section headers.', accessibilityNotes: 'Text contrast checked against the glass fill at 0.08 opacity; focus ring on any interactive child.', performanceNotes: 'backdrop-filter is GPU-composited; avoid stacking more than ~20 on one screen on low-end mobile.',
        dependencies: 'Tailwind CSS 3+', installation: 'Copy the class list — no JS required for the static card; add a hover:scale-[1.01] transition for the lift.',
        prompt: { body: 'Create a modern glassmorphism dashboard card using Tailwind CSS with subtle shadows, rounded corners, smooth hover animations, responsive design, dark mode support, accessibility best practices, and Framer Motion interactions.', notes: 'Works well as the base for every stat tile.', rating: 5, tags: ['glass', 'dashboard'] },
        codeSnippets: [{ language: 'Tailwind', code: '<div class="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl hover:-translate-y-0.5 hover:border-white/20 transition-all">\n  <div class="text-xs uppercase tracking-wider text-white/40">Revenue</div>\n  <div class="text-3xl font-bold mt-1">$12,480</div>\n</div>', notes: 'Base markup, no JS needed.' }],
        previewHtml: '<div class="card"><div class="eyebrow">Revenue</div><div class="value">$12,480</div><div class="sub">+18% this month</div></div>',
        previewCss: 'body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif;background:linear-gradient(160deg,#0f0f12,#1c1c22)}.card{background:rgba(255,255,255,.08);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:22px 26px;box-shadow:0 20px 50px rgba(0,0,0,.4);transition:transform .2s ease,border-color .2s ease;width:220px}.card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.25)}.eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);font-weight:700}.value{font-size:32px;font-weight:800;color:#fff;margin-top:4px}.sub{font-size:12px;color:#6ee7b7;margin-top:6px;font-weight:600}',
        rating: 5, favorite: true, trending: true, source: 'seed' },
      { category: 'component', title: 'AI Chat Bubble', creator: 'You', framework: 'React', platformTag: 'ai', tags: ['chat', 'ai', 'bubble'], status: 'In Progress', complexity: 'Moderate', darkMode: true, responsive: true, accessible: true, animated: true,
        description: 'A streaming-friendly chat bubble with a typing indicator and markdown-lite rendering, for AI assistant surfaces.',
        useCases: 'AI chat panels, assistant sidebars, copilot UIs.', accessibilityNotes: 'aria-live="polite" region for streaming text so screen readers announce updates without interrupting.',
        prompt: { body: 'Build a React chat message bubble component for an AI assistant UI: supports streaming text with a typing-dots indicator, markdown-lite (bold, code, lists), distinct styling for user vs assistant, dark mode, and a copy-to-clipboard button on hover.', rating: 4, tags: ['ai', 'chat'] },
        previewHtml: '<div class="bubble ai"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>',
        previewCss: 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d10;font-family:sans-serif}.bubble{display:inline-flex;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px 18px}.dot{width:7px;height:7px;border-radius:50%;background:#7dd3fc;animation:b 1.2s infinite ease-in-out}.dot:nth-child(2){animation-delay:.15s}.dot:nth-child(3){animation-delay:.3s}@keyframes b{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}',
        source: 'seed' },
      { category: 'component', title: 'Mobile Bottom Sheet', creator: 'You', framework: 'React', platformTag: 'mobile', tags: ['mobile', 'sheet', 'modal'], status: 'Saved', complexity: 'Moderate', responsive: true, accessible: true, animated: true,
        description: 'A drag-to-dismiss bottom sheet with a snap-point system for mobile-first flows.',
        prompt: { body: 'Create a mobile bottom sheet component in React with drag-to-dismiss, a visible grab handle, snap points (peek/half/full), a backdrop that fades with drag progress, and full keyboard/focus-trap accessibility.', rating: 4, tags: ['mobile'] },
        source: 'seed' },
      { category: 'theme', title: 'Midnight Aurora', creator: 'You', tags: ['dark', 'gradient', 'aurora'], status: 'Production Ready', complexity: 'Simple', darkMode: true,
        description: 'A near-black base with shifting teal/violet aurora glows — the theme this Design Library itself borrows its accent palette from.',
        prompt: { body: 'Design a dark UI theme called "Midnight Aurora": near-black background (#0a0a0b), a shifting teal-to-violet gradient glow behind hero sections, off-white text, and one warm coral accent reserved for primary actions only.', rating: 5, tags: ['dark', 'theme'] },
        rating: 5, favorite: true, source: 'seed' },
      { category: 'theme', title: 'Cyberpunk Neon', creator: 'You', tags: ['cyberpunk', 'neon', 'dark'], status: 'Inspiration', complexity: 'Moderate',
        description: 'Hot pink and cyan neon accents on a near-black base, scanline texture, glitch-on-hover micro-interaction.',
        prompt: { body: 'Design a cyberpunk-themed UI: near-black background, hot-pink and cyan neon accent colors, a subtle CRT scanline overlay, glitch/RGB-split micro-interaction on hover for primary buttons, and a monospace display font for headings.', rating: 4, tags: ['cyberpunk'] },
        source: 'seed' },
      { category: 'template', title: 'AI Workspace Dashboard', creator: 'You', framework: 'Next.js', tags: ['dashboard', 'ai', 'workspace'], status: 'Saved', complexity: 'Complex', responsive: true, darkMode: true,
        description: 'A full AI workspace shell: a persistent left sidebar, a command palette, a chat panel, and a resizable canvas area.',
        prompt: { body: 'Design a full-page AI workspace dashboard template in Next.js + Tailwind: a persistent icon+label left sidebar, a global Cmd+K command palette, a main canvas area with resizable panels, a right-hand AI chat drawer, dark mode by default, and empty states for every panel.', rating: 5, tags: ['ai', 'dashboard'] },
        rating: 4, source: 'seed' },
      { category: 'template', title: 'Personal OS Landing', creator: 'You', framework: 'HTML/CSS/JS', tags: ['personal', 'landing', 'os'], status: 'Inspiration', complexity: 'Moderate',
        description: 'A "personal operating system" landing shell — hero, quick-launch tiles, and a live activity feed.',
        prompt: { body: 'Design a "Personal OS" landing page: a full-bleed hero with an editable title, a grid of quick-launch tiles with icons, and a live activity feed panel below — dark, minimal, generous whitespace.', rating: 4, tags: ['landing'] },
        source: 'seed' },
      { category: 'animation', title: 'Staggered Fade-In List', creator: 'You', tags: ['stagger', 'entrance', 'list'], status: 'Production Ready', complexity: 'Simple', animated: true,
        description: 'Each list item fades and slides up 8px, staggered 40ms apart — the entrance animation used across most card grids in this app.',
        prompt: { body: 'Write a CSS-only staggered fade-in-up animation for a list of cards: each item fades from opacity 0 and translateY(8px) to its resting state, staggered ~40ms apart via nth-child animation-delay, respecting prefers-reduced-motion.', rating: 5, tags: ['entrance'] },
        codeSnippets: [{ language: 'CSS', code: '@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}\n.stagger>*{animation:fadeUp .4s ease both}\n.stagger>*:nth-child(n){animation-delay:calc(var(--i,0) * 40ms)}\n@media (prefers-reduced-motion:reduce){.stagger>*{animation:none}}', notes: 'Set --i as an inline custom property per item, or via :nth-child(n+1) chains.' }],
        rating: 5, favorite: true, source: 'seed' },
      { category: 'animation', title: 'Border Beam', creator: 'You', tags: ['beam', 'border', 'glow'], status: 'Production Ready', complexity: 'Simple', animated: true,
        description: 'A rotating conic-gradient light traveling a card\'s border — this app\'s own already-shipped "border beam" card treatment.',
        prompt: { body: 'Write a pure-CSS "border beam" effect: a rotating conic-gradient comet travels around a card\'s 1.5px border, speeding up on hover, using two nested elements (outer glow layer + inner solid-fill layer) — no JS.', rating: 5, tags: ['glow'] },
        source: 'seed' },
      { category: 'palette', title: 'Sunset Ember', creator: 'You', tags: ['warm', 'sunset', 'gradient'], status: 'Saved', complexity: 'Simple',
        description: 'Coral, amber, and deep plum — a warm palette for hero sections and CTAs.',
        prompt: { body: 'Generate a 5-color warm gradient palette named "Sunset Ember" for hero backgrounds: a deep plum base, transitioning through coral and amber, with one near-white text color that passes AA contrast on the darkest stop.', rating: 4, tags: ['warm'] },
        rating: 4, source: 'seed' },
      { category: 'palette', title: 'Deep Ocean', creator: 'You', tags: ['cool', 'blue', 'calm'], status: 'Saved', complexity: 'Simple',
        description: 'Navy, teal, and a single seafoam accent — calm, professional, dark-first.',
        prompt: { body: 'Generate a 5-color cool palette named "Deep Ocean": navy base, teal midtones, one seafoam accent for interactive elements, plus a light and dark text color that both pass AA contrast.', rating: 4, tags: ['cool'] },
        source: 'seed' },
      { category: 'background', title: 'Aurora Mesh Gradient', creator: 'You', tags: ['mesh', 'gradient', 'hero'], status: 'Production Ready', complexity: 'Simple', animated: true,
        description: 'A slow-drifting multi-stop radial mesh gradient — the ambient glow behind most hero sections in this app.',
        prompt: { body: 'Write a CSS-only animated mesh-gradient background: 3 overlapping radial gradients in teal/violet/coral drifting slowly (16s ease-in-out infinite alternate), sitting behind a fixed dot-grain texture overlay, respecting prefers-reduced-motion.', rating: 5, tags: ['hero'] },
        rating: 5, source: 'seed' },
      { category: 'background', title: 'Dot Grain Texture', creator: 'You', tags: ['texture', 'grain', 'subtle'], status: 'Production Ready', complexity: 'Simple',
        description: 'A near-invisible 3px repeating dot pattern that keeps a flat dark background from looking dead.',
        prompt: { body: 'Write a CSS-only subtle grain texture using a repeating radial-gradient of 1px white dots at very low opacity on a 3px tile, layered as a fixed full-viewport overlay above the base background gradient.', rating: 4, tags: ['texture'] },
        source: 'seed' },
      { category: 'typography', title: 'Inter + Cormorant Garamond', creator: 'You', tags: ['pairing', 'serif', 'sans'], status: 'Production Ready', complexity: 'Simple',
        description: 'A workhorse sans (Inter) for UI/body copy, paired with an italic serif display (Cormorant Garamond) for hero titles — this app\'s own most common pairing.',
        prompt: { body: 'Recommend a font pairing for a dark, editorial-feeling dashboard: a clean geometric sans for UI/body text and an elegant italic serif for large display headlines, both loadable from Google Fonts with no build step.', rating: 5, tags: ['pairing'] },
        rating: 5, favorite: true, source: 'seed' },
      { category: 'iconpack', title: 'Emoji-as-Icon System', creator: 'You', tags: ['emoji', 'lightweight', 'zero-dependency'], status: 'Production Ready', complexity: 'Simple',
        description: 'This app\'s own icon strategy: real emoji as icons everywhere — zero icon-font/SVG-sprite dependency, works offline, renders natively per OS.',
        prompt: { body: 'Propose a zero-dependency icon strategy for a dashboard app with no build step: use native emoji as icons throughout nav/buttons/cards instead of an icon font or SVG sprite sheet, and note the one accessibility caveat (add aria-hidden plus a text label alongside every icon-only emoji).', rating: 4, tags: ['icons'] },
        source: 'seed' },
      { category: 'layout', title: 'Persistent Sidebar Shell', creator: 'You', tags: ['sidebar', 'shell', 'app-layout'], status: 'Production Ready', complexity: 'Moderate', responsive: true,
        description: 'A left sidebar (collapsible on mobile into a drawer) + scrollable content column — the shell this very Design Library page uses.',
        prompt: { body: 'Design an app-shell layout: a persistent left sidebar (240-300px, collapsing to an overlay drawer under 900px) listing grouped nav sections, and a single scrollable content column to its right with a max-width of ~1200px, centered.', rating: 5, tags: ['shell'] },
        rating: 5, source: 'seed' },
      { category: 'layout', title: '12-Column Card Grid', creator: 'You', tags: ['grid', 'cards', 'responsive'], status: 'Production Ready', complexity: 'Simple', responsive: true,
        description: 'auto-fill/minmax card grid that reflows from 4 columns down to 1 with zero media queries.',
        prompt: { body: 'Write a CSS grid for a card gallery using grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) with an 18px gap, so it reflows from a 4-column desktop layout down to a single column on mobile with no media queries needed.', rating: 5, tags: ['grid'] },
        source: 'seed' }
    ];
    defs.forEach(function (d, i) { Resources.add(Object.assign({ order: i, createdAt: now - (defs.length - i) * 3600000 }, d)); });

    const all = Resources.list();
    const byTitle = {}; all.forEach(function (r) { byTitle[r.title] = r; });
    const cols = [
      { title: 'Dark UI', icon: '🌑', color: '#7dd3fc', itemIds: ['Midnight Aurora', 'Glass Dashboard Card', 'Dot Grain Texture'] },
      { title: 'AI Workspace', icon: '🤖', color: '#ff3b4a', itemIds: ['AI Chat Bubble', 'AI Workspace Dashboard'] },
      { title: 'Production Ready', icon: '✅', color: '#6ee7b7', itemIds: ['Glass Dashboard Card', 'Staggered Fade-In List', 'Border Beam', 'Aurora Mesh Gradient', 'Persistent Sidebar Shell', '12-Column Card Grid', 'Midnight Aurora'] },
      { title: 'Future Projects', icon: '🔭', color: '#fbbf24', itemIds: ['Cyberpunk Neon', 'Personal OS Landing', 'Mobile Bottom Sheet'] }
    ];
    cols.forEach(function (c, i) {
      const ids = c.itemIds.map(function (t) { return byTitle[t] ? byTitle[t].id : null; }).filter(Boolean);
      Collections.add({ title: c.title, icon: c.icon, color: c.color, itemIds: ids, order: i, description: '' });
    });

    saveHero({
      eyebrow: 'DESIGN OPERATING SYSTEM',
      title: 'Every Idea.\nOne Library.',
      subtext: 'Components, themes, templates, prompts, and code — discovered, saved, and ready to reuse for whatever you build next.',
      ctaLabel: 'BROWSE COMPONENTS'
    });

    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Resources.list().length || Collections.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }
  // seedIfEmpty() is deliberately NOT called automatically — same
  // empty-storage seed-race reasoning as every other page in this app
  // (dreamboard-data.js/business-data.js/aitech-data.js): seeding
  // synchronously before initCloudSync()'s cloud pull gets a real chance
  // to land could push a freshly-seeded "default" library to Supabase and
  // clobber another device's real data. design-library.html's init() only
  // calls this as a fallback after giving the cloud pull a real window.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.DesignLibraryData = {
    KEYS: KEYS,
    CATEGORY_META: CATEGORY_META,
    CATEGORY_KEYS: CATEGORY_KEYS,
    PLATFORM_TAGS: PLATFORM_TAGS,
    FRAMEWORKS: FRAMEWORKS,
    CODE_LANGUAGES: CODE_LANGUAGES,
    COMPLEXITIES: COMPLEXITIES,
    STATUSES: STATUSES,
    AI_ACTIONS: AI_ACTIONS,
    uid: uid,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Resources: Object.assign({}, Resources, { remove: removeResource }),
    syncPreviewCodeSnippets: syncPreviewCodeSnippets,
    syncAllPreviewCodeSnippets: syncAllPreviewCodeSnippets,
    Collections: Collections,
    getHero: getHero,
    saveHero: saveHero,
    resourcesSorted: resourcesSorted,
    resourcesByCategory: resourcesByCategory,
    resourcesByPlatform: resourcesByPlatform,
    favoriteResources: favoriteResources,
    trendingResources: trendingResources,
    recentlyAdded: recentlyAdded,
    promptResources: promptResources,
    personalUploadResources: personalUploadResources,
    allCodeSnippets: allCodeSnippets,
    collectionsSorted: collectionsSorted,
    itemsInCollection: itemsInCollection,
    collectionsForResource: collectionsForResource,
    toggleResourceInCollection: toggleResourceInCollection,
    relatedResources: relatedResources,
    recordView: recordView,
    recentlyViewed: recentlyViewed,
    nextOrder: nextOrder,
    reorderResourcesVisible: reorderResourcesVisible,
    reorderCollections: reorderCollections,
    searchAll: searchAll,
    stats: stats,
    getAiKey: getAiKey,
    getAiPrefs: getAiPrefs,
    runAiAction: runAiAction,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
