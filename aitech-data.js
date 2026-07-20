// aitech-data.js
//
// Shared data foundation for aitech.html ("AI & Tech"). Same conventions as
// business-data.js/dreamboard-data.js/household-data.js (see CLAUDE.md §4):
// plain localStorage, JSON-serialized, one key per collection, no server/DB.
// All keys live under an `aitech:` prefix so aitech.html's
// initCloudSync({ syncedPrefixes: ['aitech:'] }) call covers every
// collection with no per-key list.
//
// Two independent, genuinely separate "databases" (same precedent as
// business-data.js's Platform/Content Plan/Useful Resources split — never
// merged into one mixed list):
//   - Models  — a Notion-like gallery of every AI model/tool in use
//     (cover, category, status, rating, description, url, tags).
//   - Prompts — prompts tied to an individual model via `modelId` (nullable
//     — deleting a model nulls out the reference on its prompts rather than
//     deleting them, same precedent as household-data.js's legion→being
//     deletion and business-data.js's day/week deletion).

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as business-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches an 'aitech:save' event either way so
  // aitech.html can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('aitech:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('aitech:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    models: 'aitech:models',
    prompts: 'aitech:prompts',
    hero: 'aitech:hero',
    seeded: 'aitech:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 480;
    quality = quality == null ? 0.82 : quality;
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
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  // ============================================================
  // MODELS
  // ============================================================
  const MODEL_CATEGORIES = ['Chatbot', 'Coding', 'Image', 'Video', 'Voice / Audio', 'Agent', 'Search', 'Productivity', 'Other'];
  const MODEL_STATUSES = ['Active', 'Trial', 'Deprecated'];

  /** @typedef {{id:string, name:string, icon:string, cover:string, category:string, status:string, rating:number, description:string, url:string, tags:string[], order:number, createdAt:number}} AiModel */
  function modelModel(data) {
    data = data || {};
    return {
      id: data.id || uid('mdl'),
      name: typeof data.name === 'string' ? data.name : '',
      icon: typeof data.icon === 'string' ? data.icon : '🤖',
      cover: typeof data.cover === 'string' ? data.cover : '',
      category: MODEL_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'Other',
      status: MODEL_STATUSES.indexOf(data.status) !== -1 ? data.status : 'Active',
      rating: (typeof data.rating === 'number' && data.rating >= 0 && data.rating <= 5) ? data.rating : 0,
      description: typeof data.description === 'string' ? data.description : '',
      url: typeof data.url === 'string' ? data.url : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // ============================================================
  // PROMPTS — tailored to an individual model via `modelId` (nullable).
  // ============================================================
  /** @typedef {{id:string, modelId:?string, title:string, body:string, tags:string[], favorite:boolean, order:number, createdAt:number}} AiPrompt */
  function promptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('prm'),
      modelId: data.modelId || null,
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // Single editable hero record — same shape as business-data.js's
  // per-tab heroModel, just one instance since this page has no tabs.
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero)); }
  function saveHero(patch) { const next = heroModel(Object.assign({}, getHero(), patch)); storeSet(KEYS.hero, next); return next; }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // business-data.js/dreamboard-data.js/household-data.js.
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

  const Models = makeCollection(KEYS.models, modelModel);
  const Prompts = makeCollection(KEYS.prompts, promptModel);

  /** Deleting a model does NOT cascade-delete its prompts — it nulls out
   * their `modelId` back to "Unlinked", the same null-out-the-reference
   * precedent household-data.js's legion deletion and business-data.js's
   * week/day deletion already established. */
  function removeModel(id) {
    Models.remove(id);
    Prompts.replaceAll(Prompts.list().map(function (p) { return p.modelId === id ? Object.assign({}, p, { modelId: null }) : p; }));
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function modelsSorted() { return Models.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function promptsSorted() { return Prompts.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function promptsForModel(modelId) { return promptsSorted().filter(function (p) { return p.modelId === modelId; }); }
  function promptCountForModel(modelId) { return Prompts.list().filter(function (p) { return p.modelId === modelId; }).length; }
  function modelName(modelId) {
    const m = Models.get(modelId);
    return m ? m.name : null;
  }
  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  /** Applies a new order to whichever of these ids are actually passed in
   * (e.g. the currently-visible/filtered subset) — items left out keep
   * their existing order, same accepted approximation
   * business-data.js's reorderWidgetsOfType() already uses when dragging
   * under an active filter. */
  function reorderModels(orderedIds) {
    const all = Models.list();
    const byId = {}; all.forEach(function (m) { byId[m.id] = m; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Models.replaceAll(all);
  }
  function reorderPrompts(orderedIds) {
    const all = Prompts.list();
    const byId = {}; all.forEach(function (p) { byId[p.id] = p; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Prompts.replaceAll(all);
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Models.replaceAll([]);
    Prompts.replaceAll([]);

    const defs = [
      { name: 'Claude', icon: '✦', category: 'Chatbot', status: 'Active', rating: 5, url: 'https://claude.ai', tags: ['Anthropic', 'Daily driver'], description: 'Primary assistant for writing, coding, and reasoning through anything long-form or nuanced.' },
      { name: 'ChatGPT', icon: '◐', category: 'Chatbot', status: 'Active', rating: 4, url: 'https://chat.openai.com', tags: ['OpenAI'], description: 'Second opinion / brainstorm partner, and the plugin ecosystem for quick lookups.' },
      { name: 'Gemini', icon: '◇', category: 'Chatbot', status: 'Trial', rating: 3, url: 'https://gemini.google.com', tags: ['Google'], description: 'Trying it out for anything that benefits from tight Google Workspace integration.' },
      { name: 'Perplexity', icon: '◎', category: 'Search', status: 'Active', rating: 4, url: 'https://www.perplexity.ai', tags: ['Research'], description: 'Go-to for cited, up-to-date research questions instead of a plain search engine.' },
      { name: 'GitHub Copilot', icon: '◈', category: 'Coding', status: 'Active', rating: 5, url: 'https://github.com/features/copilot', tags: ['IDE', 'Autocomplete'], description: 'In-editor autocomplete and inline suggestions for everyday coding.' },
      { name: 'Midjourney', icon: '◆', category: 'Image', status: 'Active', rating: 4, url: 'https://www.midjourney.com', tags: ['Discord'], description: 'Concept art and moodboard imagery — the sharpest stylistic control of the image models tried so far.' },
      { name: 'Runway', icon: '▶', category: 'Video', status: 'Trial', rating: 3, url: 'https://runwayml.com', tags: ['Gen-video'], description: 'Experimenting with short generated video clips and quick edits.' },
      { name: 'ElevenLabs', icon: '◉', category: 'Voice / Audio', status: 'Active', rating: 4, url: 'https://elevenlabs.io', tags: ['TTS'], description: 'Text-to-speech for narration drafts and voiceover placeholders.' },
      { name: 'Notion AI', icon: '◻', category: 'Productivity', status: 'Deprecated', rating: 2, url: 'https://www.notion.so/product/ai', tags: [], description: "Used it briefly inside Notion docs — not renewed; Claude covers the same ground better." }
    ];
    const byName = {};
    defs.forEach(function (d, i) { byName[d.name] = Models.add(Object.assign({}, d, { order: i })); });

    const promptDefs = [
      { model: 'Claude', title: 'Code Review Pass', tags: ['Coding', 'Review'], body: "Review the following code for correctness, readability, and any edge cases I might have missed. Call out anything risky before suggesting style nits.\n\n[paste code here]" },
      { model: 'Claude', title: 'Blog Post Outline', tags: ['Writing'], body: "Draft a clear, skimmable outline for a blog post on the topic below. Include a proposed title, 4-6 section headers, and one sentence of what each section should cover.\n\nTopic: [topic]\nAudience: [audience]" },
      { model: 'Claude', title: 'Explain Like I\'m Debugging at 2am', tags: ['Coding', 'Debugging'], body: "Explain the following error/behavior as if I'm tired and need the shortest path to a fix, not a lecture. State the likely root cause first, then the fix.\n\n[paste error/behavior here]" },
      { model: 'ChatGPT', title: 'Brainstorm Angles', tags: ['Brainstorm'], body: "Give me 10 distinct angles/approaches to the problem below, ranked roughly from safest to most unconventional. One line each.\n\nProblem: [problem]" },
      { model: 'ChatGPT', title: 'Rewrite for Clarity', tags: ['Editing'], body: "Rewrite the following for maximum clarity and brevity without losing any meaning. Keep my voice, just cut the fat.\n\n[paste text here]" },
      { model: 'Midjourney', title: 'Cinematic Portrait Style', tags: ['Style'], body: "[subject], cinematic lighting, shallow depth of field, 35mm film grain, moody color grade, shot on anamorphic lens --ar 3:2 --v 6" },
      { model: 'Midjourney', title: 'Isometric Product Shot', tags: ['Style', 'Product'], body: "isometric illustration of [product/object], soft studio lighting, clean gradient background, subtle shadow, high detail --ar 1:1 --v 6" },
      { model: 'GitHub Copilot', title: 'Refactor Explainer Comment', tags: ['Coding'], body: "// TODO: refactor this function to [goal]. Keep the existing signature and add tests for the edge cases below before changing behavior." },
      { model: 'ElevenLabs', title: 'Narration Warm-Up Line', tags: ['Voice'], body: "Read in a calm, warm, unhurried narrator tone — like the opening of a documentary. Pause briefly after each sentence." },
      { model: 'Perplexity', title: 'Fact-Check With Sources', tags: ['Research'], body: "Fact-check the following claim and cite your sources. If sources disagree, say so explicitly rather than picking one.\n\nClaim: [claim]" }
    ];
    promptDefs.forEach(function (p, i) {
      const m = byName[p.model];
      Prompts.add({ modelId: m ? m.id : null, title: p.title, body: p.body, tags: p.tags, order: i });
    });

    saveHero({
      eyebrow: 'THE STACK',
      title: 'Every Model.\nOne Toolkit.',
      subtext: 'The AI tools in rotation, and the prompts worth keeping for each.',
      ctaLabel: 'VIEW MODELS'
    });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Models.list().length || Prompts.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as dreamboard-data.js/
  // business-data.js: seeding synchronously at script-load time, before
  // initCloudSync() gets a chance to pull real cloud data, can push a
  // freshly-seeded "default" board to Supabase and clobber another
  // device's real data. aitech.html's init() calls seedIfEmpty() itself,
  // only as a fallback after giving the cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.AiTechData = {
    KEYS: KEYS,
    MODEL_CATEGORIES: MODEL_CATEGORIES,
    MODEL_STATUSES: MODEL_STATUSES,
    uid: uid,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: Object.assign({}, Models, { remove: removeModel }),
    Prompts: Prompts,
    getHero: getHero,
    saveHero: saveHero,
    modelsSorted: modelsSorted,
    promptsSorted: promptsSorted,
    promptsForModel: promptsForModel,
    promptCountForModel: promptCountForModel,
    modelName: modelName,
    nextOrder: nextOrder,
    reorderModels: reorderModels,
    reorderPrompts: reorderPrompts,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
