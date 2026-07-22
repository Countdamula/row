// learning-data.js
//
// Shared data foundation for learning.html ("Learning & Knowledge Hub"). Same
// conventions as aitech-data.js/business-data.js/dreamboard-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per collection,
// no server/DB. All keys live under a `learning:` prefix so learning.html's
// initCloudSync({ syncedPrefixes: ['learning:'] }) call covers every
// collection with no per-key list.
//
// Two independent, genuinely separate "databases" (same precedent as
// aitech-data.js's Models/Prompts split, business-data.js's Platform/Content
// Plan/Useful Resources split — never merged into one mixed list):
//   - Topics    — a large gallery of the subjects being researched (cover,
//     description, tags).
//   - Resources — research material tied to an individual topic via
//     `topicId` (nullable — deleting a topic nulls out the reference on its
//     resources rather than deleting them, same precedent as aitech-data.js's
//     model deletion). Each resource has a `type` — Article / Book /
//     YouTube Video (with transcript) / Social Media Post / Additional Note —
//     which is how the Resources database is "structured by" per the request.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'learning:save' event either way so
  // learning.html can show a real status instead of guessing.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('learning:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('learning:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    topics: 'learning:topics',
    resources: 'learning:resources',
    hero: 'learning:hero',
    seeded: 'learning:seeded'
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
  // TOPICS — the top database, a large gallery of research subjects.
  // ============================================================
  /** @typedef {{id:string, title:string, icon:string, cover:string, description:string, tags:string[], order:number, createdAt:number}} Topic */
  function topicModel(data) {
    data = data || {};
    return {
      id: data.id || uid('top'),
      title: typeof data.title === 'string' ? data.title : '',
      icon: typeof data.icon === 'string' ? data.icon : '📚',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // ============================================================
  // RESOURCES — the bottom database, tied to a topic via `topicId`
  // (nullable), structured by `type`.
  // ============================================================
  const RESOURCE_TYPES = ['article', 'book', 'video', 'social', 'note'];
  const RESOURCE_TYPE_LABELS = {
    article: 'Articles',
    book: 'Books',
    video: 'YouTube Videos',
    social: 'Social Media Posts',
    note: 'Additional Notes'
  };
  const RESOURCE_TYPE_SINGULAR = {
    article: 'Article',
    book: 'Book',
    video: 'YouTube Video',
    social: 'Social Media Post',
    note: 'Note'
  };

  /** @typedef {{id:string, topicId:?string, type:string, title:string, url:string, author:string, transcript:string, notes:string, favorite:boolean, sections:{id:string,title:string,body:string,order:number,createdAt:number}[], order:number, createdAt:number}} Resource */
  function resourceModel(data) {
    data = data || {};
    return {
      id: data.id || uid('res'),
      topicId: data.topicId || null,
      type: RESOURCE_TYPES.indexOf(data.type) !== -1 ? data.type : 'article',
      title: typeof data.title === 'string' ? data.title : '',
      url: typeof data.url === 'string' ? data.url : '',
      author: typeof data.author === 'string' ? data.author : '',
      transcript: typeof data.transcript === 'string' ? data.transcript : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      favorite: !!data.favorite,
      // A resource's own "page" — freeform, generated-on-demand text/link
      // sections (e.g. "Full Text", "Links, Notes & Favorite Parts"), same
      // inline-on-the-record convention as business-data.js's Platform
      // widget `sections` (addPlatformSection() etc.) — no separate
      // collection, so deleting the resource deletes its sections with it.
      sections: Array.isArray(data.sections) ? data.sections : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // Single editable hero record — same shape as aitech-data.js's heroModel,
  // just one instance since this page has no tabs.
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
  // aitech-data.js/business-data.js/dreamboard-data.js/household-data.js.
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

  const Topics = makeCollection(KEYS.topics, topicModel);
  const Resources = makeCollection(KEYS.resources, resourceModel);

  /** Deleting a topic does NOT cascade-delete its resources — it nulls out
   * their `topicId` back to "Unlinked", the same null-out-the-reference
   * precedent aitech-data.js's model deletion, household-data.js's legion
   * deletion, and business-data.js's week/day deletion already established. */
  function removeTopic(id) {
    Topics.remove(id);
    Resources.replaceAll(Resources.list().map(function (r) { return r.topicId === id ? Object.assign({}, r, { topicId: null }) : r; }));
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function topicsSorted() { return Topics.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function resourcesSorted() { return Resources.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function resourcesForTopic(topicId) { return resourcesSorted().filter(function (r) { return r.topicId === topicId; }); }
  function resourceCountForTopic(topicId) { return Resources.list().filter(function (r) { return r.topicId === topicId; }).length; }
  function topicName(topicId) {
    const t = Topics.get(topicId);
    return t ? t.title : null;
  }
  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  /** Applies a new order to whichever of these ids are actually passed in
   * (e.g. the currently-visible/filtered subset) — items left out keep
   * their existing order, same accepted approximation aitech-data.js's
   * reorderModels()/reorderPrompts() already use when dragging under an
   * active filter. */
  function reorderTopics(orderedIds) {
    const all = Topics.list();
    const byId = {}; all.forEach(function (t) { byId[t.id] = t; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Topics.replaceAll(all);
  }
  function reorderResources(orderedIds) {
    const all = Resources.list();
    const byId = {}; all.forEach(function (r) { byId[r.id] = r; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    Resources.replaceAll(all);
  }

  // ============================================================
  // RESOURCE SECTIONS — a resource's own "page": freeform, generated-on-
  // demand text/link sections. Same CRUD shape as business-data.js's
  // addPlatformSection()/updatePlatformSection()/removePlatformSection()/
  // movePlatformSection()/sectionsForWidget(), just inline on a Resource
  // record instead of a Widget's `data` sub-object.
  // ============================================================
  function sectionsForResource(resourceId) {
    const r = Resources.get(resourceId);
    if (!r) return [];
    return (r.sections || []).slice().sort(function (a, b) { return a.order - b.order; });
  }
  function addResourceSection(resourceId, title) {
    const r = Resources.get(resourceId);
    if (!r) return null;
    const sections = (r.sections || []).slice();
    const order = sections.length ? Math.max.apply(null, sections.map(function (s) { return s.order; })) + 1 : 0;
    const section = { id: uid('sec'), title: title || 'New Section', body: '', order: order, createdAt: Date.now() };
    sections.push(section);
    Resources.update(resourceId, { sections: sections });
    return section;
  }
  function updateResourceSection(resourceId, sectionId, patch) {
    const r = Resources.get(resourceId);
    if (!r) return;
    const sections = (r.sections || []).map(function (s) { return s.id === sectionId ? Object.assign({}, s, patch) : s; });
    Resources.update(resourceId, { sections: sections });
  }
  function removeResourceSection(resourceId, sectionId) {
    const r = Resources.get(resourceId);
    if (!r) return;
    const sections = (r.sections || []).filter(function (s) { return s.id !== sectionId; });
    Resources.update(resourceId, { sections: sections });
  }
  function moveResourceSection(resourceId, sectionId, dir) {
    const r = Resources.get(resourceId);
    if (!r) return;
    const sections = (r.sections || []).slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sections.findIndex(function (s) { return s.id === sectionId; });
    const otherIdx = idx + dir;
    if (idx < 0 || otherIdx < 0 || otherIdx >= sections.length) return;
    const tmp = sections[idx].order;
    sections[idx].order = sections[otherIdx].order;
    sections[otherIdx].order = tmp;
    Resources.update(resourceId, { sections: sections });
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Topics.replaceAll([]);
    Resources.replaceAll([]);

    const defs = [
      { title: 'Human Psychology & Neuroscience', icon: '🧠', tags: ['Mind', 'Behavior'], description: 'How the brain actually works — cognition, bias, memory, and why people do what they do.' },
      { title: 'Wealth Accumulation & Entrepreneurship', icon: '💰', tags: ['Business', 'Money'], description: 'Building income, businesses, and long-term wealth — strategy over hustle.' },
      { title: 'Holistic Health & Alternative Healing', icon: '🌿', tags: ['Wellness'], description: 'Whole-body health practices outside conventional medicine — nutrition, herbalism, energy work.' },
      { title: 'Persuasive Communication & Writing', icon: '✍️', tags: ['Writing', 'Influence'], description: 'The craft of writing and speaking in ways that actually move people.' },
      { title: 'Astrology & Numerology', icon: '✨', tags: ['Symbolic Systems'], description: 'Charts, cycles, and numbers as a lens for understanding timing and personality.' },
      { title: 'History', icon: '🏛️', tags: ['Civilizations'], description: 'How we got here — the events, empires, and turning points worth actually understanding.' },
      { title: 'Self-Development', icon: '🌱', tags: ['Growth', 'Habits'], description: 'Habits, mindset, and practical frameworks for becoming a better version of myself.' },
      { title: 'Metaphysics & Quantum Physics', icon: '⚛️', tags: ['Consciousness'], description: 'Where physics gets strange enough to bump into philosophy — reality, observation, consciousness.' },
      { title: 'Spiritual Practices & Esotericism', icon: '🕉️', tags: ['Practice'], description: 'Meditation, ritual, and hidden/traditional teachings across spiritual lineages.' },
      { title: 'AI', icon: '🤖', tags: ['Tech', 'Future'], description: 'Where artificial intelligence actually is, where it’s going, and how to use it well.' },
      { title: 'Photography & Videography', icon: '📷', tags: ['Craft', 'Visual'], description: 'Composition, light, gear, and editing — the visual storytelling toolkit.' }
    ];
    const byTitle = {};
    defs.forEach(function (d, i) { byTitle[d.title] = Topics.add(Object.assign({}, d, { order: i })); });

    const resourceDefs = [
      // Self-Development — one of each type, demonstrating the full structure.
      { topic: 'Self-Development', type: 'article', title: 'Atomic Habits: The Compound Effect of 1% Better', url: 'https://jamesclear.com/atomic-habits-summary', author: 'James Clear', notes: 'The identity-based habits framing is the part worth re-reading.' },
      { topic: 'Self-Development', type: 'book', title: 'Atomic Habits', author: 'James Clear', notes: 'Cue → craving → response → reward. Reread the habit-stacking chapter.' },
      { topic: 'Self-Development', type: 'video', title: 'The Skill of Self Confidence', url: 'https://www.youtube.com/watch?v=w-HYZv6HzAs', author: 'Dr. Ivan Joseph', transcript: "Confidence is a skill. Skills are developed through repetition. If you want to be a good shooter in basketball, you shoot 500 shots a day...\n\nSelf-confidence is a skill, it's a skill that's developed... [full transcript]", notes: 'Confidence as a trainable skill, not a fixed trait.' },
      { topic: 'Self-Development', type: 'social', title: 'Thread: the 2-minute rule for starting habits', url: 'https://twitter.com', author: '@jamesclear', notes: 'Shrink the habit until it’s stupidly easy to start.' },
      { topic: 'Self-Development', type: 'note', title: 'Weekly reflection prompts', notes: 'What worked this week? What drained me? What’s one thing to drop next week?' },

      // AI
      { topic: 'AI', type: 'article', title: 'The State of AI, 2026', url: 'https://www.anthropic.com', author: 'Anthropic', notes: 'Good overview of where model capability actually stands vs. hype.' },
      { topic: 'AI', type: 'video', title: 'Prompt Engineering Fundamentals', url: 'https://www.youtube.com/watch?v=dOxUroR57xs', author: 'Anthropic', transcript: 'Be clear and direct. Give the model context on why the instructions matter. Use examples to show, not just tell...\n\n[full transcript]', notes: 'Revisit the "give it a role" and "chain of thought" sections.' },
      { topic: 'AI', type: 'note', title: 'Ideas to try', notes: 'Use Claude to draft a first pass, then edit myself instead of writing from a blank page.' },

      // Human Psychology & Neuroscience
      { topic: 'Human Psychology & Neuroscience', type: 'book', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', notes: 'System 1 vs. System 2 — the anchoring and availability heuristic chapters especially.' },
      { topic: 'Human Psychology & Neuroscience', type: 'article', title: 'A Field Guide to Cognitive Biases', url: 'https://en.wikipedia.org/wiki/List_of_cognitive_biases', notes: 'Good as a reference list to skim periodically.' },

      // Wealth Accumulation & Entrepreneurship
      { topic: 'Wealth Accumulation & Entrepreneurship', type: 'book', title: 'The Almanack of Naval Ravikant', author: 'Eric Jorgenson', notes: 'Specific knowledge + leverage + accountability = wealth.' },
      { topic: 'Wealth Accumulation & Entrepreneurship', type: 'social', title: 'Thread on building in public', url: 'https://twitter.com', author: '@naval', notes: 'Play long-term games with long-term people.' },

      // Holistic Health & Alternative Healing
      { topic: 'Holistic Health & Alternative Healing', type: 'article', title: 'An Introduction to Adaptogens', url: 'https://www.healthline.com/nutrition/adaptogens', notes: 'Worth cross-referencing against an actual practitioner before trying anything.' },

      // Persuasive Communication & Writing
      { topic: 'Persuasive Communication & Writing', type: 'video', title: 'The Only Writing Advice You Need', url: 'https://www.youtube.com/watch?v=vNM7-XpZ2Ho', transcript: 'Write like you talk. Cut every sentence in half, then cut it in half again...\n\n[full transcript]', notes: 'Cut ruthlessly. Read it out loud before calling it done.' },

      // Astrology & Numerology
      { topic: 'Astrology & Numerology', type: 'note', title: 'Personal chart notes', notes: 'Keep a running log of transits that actually seemed to line up with real events.' },

      // History
      { topic: 'History', type: 'book', title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', notes: 'The shared-myths-as-the-basis-for-cooperation argument is the core idea to hold onto.' },

      // Metaphysics & Quantum Physics
      { topic: 'Metaphysics & Quantum Physics', type: 'note', title: 'Questions worth sitting with', notes: 'What does "observation" actually mean in the double-slit experiment? Keep a list of good explainers to compare.' },

      // Spiritual Practices & Esotericism
      { topic: 'Spiritual Practices & Esotericism', type: 'article', title: 'A Beginner’s Guide to Meditation Traditions', url: 'https://en.wikipedia.org/wiki/Meditation', notes: 'Useful as a map before picking one tradition to actually practice.' },

      // Photography & Videography
      { topic: 'Photography & Videography', type: 'note', title: 'Gear + settings cheat sheet', notes: 'Golden hour, 35mm for environmental portraits, expose for the highlights.' }
    ];
    resourceDefs.forEach(function (r, i) {
      const t = byTitle[r.topic];
      Resources.add({
        topicId: t ? t.id : null,
        type: r.type,
        title: r.title,
        url: r.url || '',
        author: r.author || '',
        transcript: r.transcript || '',
        notes: r.notes || '',
        order: i
      });
    });

    saveHero({
      eyebrow: 'THE ARCHIVE',
      title: 'Everything I’m\nLearning, in One Place.',
      subtext: 'Every topic I’m researching, and the articles, books, videos, posts, and notes that go with it.',
      ctaLabel: 'VIEW TOPICS'
    });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Topics.list().length || Resources.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // seedIfEmpty() is deliberately NOT called automatically here — same
  // empty-storage seed-race reasoning as aitech-data.js/dreamboard-data.js/
  // business-data.js: seeding synchronously at script-load time, before
  // initCloudSync() gets a chance to pull real cloud data, can push a
  // freshly-seeded "default" board to Supabase and clobber another device's
  // real data. learning.html's init() calls seedIfEmpty() itself, only as a
  // fallback after giving the cloud pull a real chance to land.

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.LearningData = {
    KEYS: KEYS,
    RESOURCE_TYPES: RESOURCE_TYPES,
    RESOURCE_TYPE_LABELS: RESOURCE_TYPE_LABELS,
    RESOURCE_TYPE_SINGULAR: RESOURCE_TYPE_SINGULAR,
    uid: uid,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Topics: Object.assign({}, Topics, { remove: removeTopic }),
    Resources: Resources,
    getHero: getHero,
    saveHero: saveHero,
    topicsSorted: topicsSorted,
    resourcesSorted: resourcesSorted,
    resourcesForTopic: resourcesForTopic,
    resourceCountForTopic: resourceCountForTopic,
    topicName: topicName,
    nextOrder: nextOrder,
    reorderTopics: reorderTopics,
    reorderResources: reorderResources,
    sectionsForResource: sectionsForResource,
    addResourceSection: addResourceSection,
    updateResourceSection: updateResourceSection,
    removeResourceSection: removeResourceSection,
    moveResourceSection: moveResourceSection,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
