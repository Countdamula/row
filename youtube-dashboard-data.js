// youtube-dashboard-data.js
//
// Data layer for youtube-dashboard.html — a YouTube Business Operating
// System living in the existing "Business" nav folder, alongside Writing
// Dashboard (writing-dashboard.html). Same conventions as every other
// page's own -data.js in this app: plain localStorage (routed through
// local-store-idb.js's IndexedDB-backed shim, transparently, same as
// every other page), JSON-serialized, one key per collection, model-
// factory + makeCollection() CRUD — the exact recipe knowledge-hub-data.js
// / writing-dashboard-data.js / businessdash-data.js already use. Every
// key lives under a `ytd:` prefix so youtube-dashboard.html's own
// initCloudSync({ appKey: 'youtubedash', syncedPrefixes: ['ytd:'] }) call
// covers every collection with no per-key list. Genuinely separate from
// businessdash.html's own `kind:'youtube'` Business record (`bizdash:
// ytVideos`, an inline section on one business's page) and from
// businessos.html's generic `platform:'youtube'` calendar tag — this file
// touches neither of those files nor either prefix.
//
// ARCHITECTURE — one generic engine reused across scales, the same
// "generic model + fixed vocabulary table, not N bespoke databases"
// precedent knowledge-hub-data.js's departments and writing-dashboard-
// data.js's WikiPages/Sections already established:
//   Channels -> Videos (the central Video Project database) -> Scripts
//   VideoTemplates (13 real starter blueprints), ChecklistTemplates ->
//     ChecklistInstances (one-click, clone-and-strip-id duplication into
//     a fresh per-video instance, original left untouched — same recipe
//     businessdash-data.js's duplicateTask() already established)
//   Notes — the ONE universal notes collection, scoped by `scope`/
//     `scopeId` (channel/video/script/template/checklist/asset/global),
//     queried with notesFor(scope, scopeId) — same idiom as knowledge-
//     hub-data.js's/writing-dashboard-data.js's own Sections collection
//   Sections — the same generic, reorderable, "generated on demand"
//     note-block collection writing-dashboard-data.js's WikiPages already
//     use, reused here for a Video's Research/Production sub-panels
//   Assets, CalendarEvents, AnalyticsSnapshots, Tags, GlobalTemplates
//     (Thumbnail/Description/SEO/Title/Branding — one collection with a
//     `kind` field, not five), Favorites, RecentlyViewed
//
// CONFIRMED ADAPTATIONS (flagged, not silently narrowed — same discipline
// every other AI/analytics-shaped feature in this app already follows):
//   - No live YouTube Data API sync. The spec's own "Future-Proof
//     Architecture" section lists this as a later module — Analytics
//     here is honest manual/periodic snapshot entry (AnalyticsSnapshots),
//     with Top/Worst Videos, growth trends, and streaks all genuinely
//     computed from real stored data, not simulated.
//   - Notes body is plain text with lightweight inline markdown
//     (**bold**, *italic*, [text](url) links) rendered on display, not a
//     full contentEditable WYSIWYG engine. Voice Notes/Drawings are
//     uploaded audio/image attachments (base64 data URLs, same pattern
//     every other page's photo fields already use), not an in-app
//     recorder or drawing canvas.
//   - Thumbnail PSDs/LUTs/Color Presets in the Asset Library are tagged
//     metadata + an uploaded file or external link, not PSD parsing or a
//     LUT preview renderer.
//   - "Timeline" view (Video Projects) is a date-sorted horizontal
//     variant of the Calendar view, not a full Gantt/dependency engine.
//   - Revenue/Budget/Sponsor are plain manual fields — no invoicing or
//     payment engine (also an explicit future module in the spec).

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE PRIMITIVES (same shape as every other -data.js)
  // ============================================================
  function storeGet(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('ytd:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('ytd:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function nowIso() { return new Date().toISOString(); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function str(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
  function num(v, fallback) { return typeof v === 'number' && !isNaN(v) ? v : (fallback == null ? 0 : fallback); }
  function bool(v) { return !!v; }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }
  function idArr(v) { return arr(v).filter(function (x) { return typeof x === 'string' && x; }); }
  function pick(v, allowed, fallback) { return allowed.indexOf(v) !== -1 ? v : fallback; }
  function clampPct(v) { return Math.max(0, Math.min(100, Math.round(num(v, 0)))); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function makeCollection(key, model) {
    function list() { return storeGet(key, []); }
    function save(l) { return storeSet(key, l); }
    return {
      list: list,
      get: function (id) {
        var l = list();
        for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === id) return l[i];
        return null;
      },
      add: function (data) {
        var rec = model(data || {});
        var l = list(); l.push(rec);
        return save(l) ? rec : null;
      },
      update: function (id, patch) {
        var l = list();
        for (var i = 0; i < l.length; i++) {
          if (l[i] && l[i].id === id) {
            var rec = model(Object.assign({}, l[i], patch, { id: id, createdAt: l[i].createdAt }));
            l[i] = rec;
            return save(l) ? rec : null;
          }
        }
        return null;
      },
      remove: function (id) { save(list().filter(function (x) { return x && x.id !== id; })); },
      replaceAll: function (records) { save(records); }
    };
  }

  var KEYS = {
    channels: 'ytd:channels', videos: 'ytd:videos', scripts: 'ytd:scripts',
    videoTemplates: 'ytd:videoTemplates', checklistTemplates: 'ytd:checklistTemplates',
    checklistInstances: 'ytd:checklistInstances', notes: 'ytd:notes', sections: 'ytd:sections',
    assets: 'ytd:assets', calendarEvents: 'ytd:calendarEvents', analyticsSnapshots: 'ytd:analyticsSnapshots',
    tags: 'ytd:tags', globalTemplates: 'ytd:globalTemplates', favorites: 'ytd:favorites',
    recentlyViewed: 'ytd:recentlyViewed', settings: 'ytd:settings', hero: 'ytd:hero',
    seededVideoTemplates: 'ytd:seededVideoTemplates', seededChecklist: 'ytd:seededChecklist',
    seededGlobalTemplates: 'ytd:seededGlobalTemplates', seededTags: 'ytd:seededTags'
  };

  // ============================================================
  // FIXED VOCABULARIES
  // ============================================================
  var CHANNEL_STATUSES = [
    { key: 'active', label: 'Active', color: '#6ee7b7' },
    { key: 'planning', label: 'Planning', color: '#7dd3fc' },
    { key: 'paused', label: 'Paused', color: '#fbbf24' },
    { key: 'archived', label: 'Archived', color: '#8a8577' }
  ];
  var VIDEO_STATUSES = [
    { key: 'idea', label: 'Idea', color: '#8a8577' },
    { key: 'planning', label: 'Planning', color: '#7dd3fc' },
    { key: 'scripting', label: 'Scripting', color: '#c9a876' },
    { key: 'filming', label: 'Filming', color: '#e8cf9f' },
    { key: 'editing', label: 'Editing', color: '#fbbf24' },
    { key: 'review', label: 'Awaiting Review', color: '#f0a868' },
    { key: 'scheduled', label: 'Scheduled', color: '#a78bfa' },
    { key: 'published', label: 'Published', color: '#6ee7b7' },
    { key: 'archived', label: 'Archived', color: '#5c584e' }
  ];
  var VIDEO_STATUS_KEYS = VIDEO_STATUSES.map(function (s) { return s.key; });
  var VIDEO_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  var VIDEO_DIFFICULTIES = ['easy', 'medium', 'hard'];
  var SCRIPT_STATUSES = ['draft', 'in-review', 'final'];
  var VIDEO_TEMPLATE_TYPES = [
    { key: 'talking-head', label: 'Talking Head', icon: '🎙️' },
    { key: 'essay', label: 'Essay', icon: '📝' },
    { key: 'documentary', label: 'Documentary', icon: '🎞️' },
    { key: 'storytelling', label: 'Storytelling', icon: '📖' },
    { key: 'review', label: 'Review', icon: '⭐' },
    { key: 'tutorial', label: 'Tutorial', icon: '🛠️' },
    { key: 'top10', label: 'Top 10 / Listicle', icon: '🔟' },
    { key: 'explainer', label: 'Explainer', icon: '💡' },
    { key: 'podcast', label: 'Podcast', icon: '🎧' },
    { key: 'interview', label: 'Interview', icon: '🎤' },
    { key: 'reaction', label: 'Reaction', icon: '😲' },
    { key: 'shorts', label: 'YouTube Shorts', icon: '📱' },
    { key: 'longform-doc', label: 'Longform Documentary', icon: '🎬' }
  ];
  var VIDEO_TEMPLATE_TYPE_KEYS = VIDEO_TEMPLATE_TYPES.map(function (t) { return t.key; });
  var ASSET_TYPES = [
    { key: 'logo', label: 'Logo', icon: '🔷' }, { key: 'broll', label: 'B-Roll', icon: '🎥' },
    { key: 'stock', label: 'Stock Footage', icon: '🎞️' }, { key: 'music', label: 'Music', icon: '🎵' },
    { key: 'sfx', label: 'SFX', icon: '🔊' }, { key: 'font', label: 'Font', icon: '🔤' },
    { key: 'icon', label: 'Icon', icon: '🔺' }, { key: 'animation', label: 'Animation', icon: '✨' },
    { key: 'transition', label: 'Transition', icon: '🔀' }, { key: 'lut', label: 'LUT', icon: '🎨' },
    { key: 'colorpreset', label: 'Color Preset', icon: '🌈' }, { key: 'thumbnailpsd', label: 'Thumbnail PSD', icon: '🖼️' },
    { key: 'graphic', label: 'Graphic', icon: '🧩' }, { key: 'brandasset', label: 'Brand Asset', icon: '🏷️' },
    { key: 'document', label: 'Document', icon: '📄' }
  ];
  var ASSET_TYPE_KEYS = ASSET_TYPES.map(function (t) { return t.key; });
  var CALENDAR_EVENT_TYPES = ['planning', 'writing', 'filming', 'editing', 'review', 'publishing', 'promotion', 'deadline', 'sponsor'];
  var NOTE_SCOPES = ['channel', 'video', 'script', 'template', 'checklist', 'asset', 'global'];
  var NOTE_PRIORITIES = ['low', 'medium', 'high'];
  var NOTE_STATUSES = ['none', 'todo', 'in-progress', 'done'];
  var NOTE_COLOR_LABELS = ['none', 'red', 'orange', 'gold', 'green', 'blue', 'purple'];
  var GLOBAL_TEMPLATE_KINDS = [
    { key: 'thumbnail', label: 'Thumbnail Templates', icon: '🖼️' },
    { key: 'description', label: 'Description Templates', icon: '📄' },
    { key: 'seo', label: 'SEO Templates', icon: '🔍' },
    { key: 'title', label: 'Title Templates', icon: '🔤' },
    { key: 'branding', label: 'Channel Branding Templates', icon: '🎨' }
  ];
  var GLOBAL_TEMPLATE_KIND_KEYS = GLOBAL_TEMPLATE_KINDS.map(function (k) { return k.key; });
  var FAVORITE_TYPES = ['channel', 'video', 'script', 'videoTemplate', 'checklistTemplate', 'asset', 'note'];

  // ============================================================
  // MODEL FACTORIES
  // ============================================================
  function channelModel(d) {
    return {
      id: d.id || uid('ch'),
      name: str(d.name, 'Untitled Channel'),
      banner: str(d.banner, ''), logo: str(d.logo, ''),
      description: str(d.description, ''), niche: str(d.niche, ''),
      subscribers: num(d.subscribers, 0), uploadSchedule: str(d.uploadSchedule, ''),
      brandColors: (d.brandColors && typeof d.brandColors === 'object') ? {
        primary: str(d.brandColors.primary, '#c9a876'), secondary: str(d.brandColors.secondary, '#1a1712'), accent: str(d.brandColors.accent, '#e8cf9f')
      } : { primary: '#c9a876', secondary: '#1a1712', accent: '#e8cf9f' },
      typography: (d.typography && typeof d.typography === 'object') ? {
        heading: str(d.typography.heading, ''), body: str(d.typography.body, '')
      } : { heading: '', body: '' },
      missionStatement: str(d.missionStatement, ''), brandVoice: str(d.brandVoice, ''),
      targetAudience: str(d.targetAudience, ''), contentPillars: idArr(d.contentPillars),
      goals: arr(d.goals), kpis: arr(d.kpis),
      status: pick(d.status, CHANNEL_STATUSES.map(function (s) { return s.key; }), 'active'),
      favorite: bool(d.favorite), order: num(d.order, 0),
      createdAt: d.createdAt || nowIso(), updatedAt: nowIso()
    };
  }
  function videoModel(d) {
    return {
      id: d.id || uid('vid'), channelId: str(d.channelId, ''),
      title: str(d.title, 'Untitled Video'), workingTitle: str(d.workingTitle, ''), thumbnail: str(d.thumbnail, ''),
      videoFileName: str(d.videoFileName, ''), videoFileSize: num(d.videoFileSize, 0), videoFileType: str(d.videoFileType, ''), videoFileAttachedAt: str(d.videoFileAttachedAt, ''),
      status: pick(d.status, VIDEO_STATUS_KEYS, 'idea'), priority: pick(d.priority, VIDEO_PRIORITIES, 'medium'),
      difficulty: pick(d.difficulty, VIDEO_DIFFICULTIES, 'medium'),
      series: str(d.series, ''), episodeNumber: d.episodeNumber == null ? null : num(d.episodeNumber, null),
      category: str(d.category, ''), videoType: pick(d.videoType, VIDEO_TEMPLATE_TYPE_KEYS, ''),
      length: str(d.length, ''), estimatedRuntime: str(d.estimatedRuntime, ''),
      targetPublishDate: str(d.targetPublishDate, ''), actualPublishDate: str(d.actualPublishDate, ''),
      sponsor: str(d.sponsor, ''), budget: num(d.budget, 0), revenue: num(d.revenue, 0),
      seoScore: clampPct(d.seoScore), keywordDifficulty: clampPct(d.keywordDifficulty),
      primaryKeyword: str(d.primaryKeyword, ''), secondaryKeywords: idArr(d.secondaryKeywords),
      scriptId: str(d.scriptId, ''), templateId: str(d.templateId, ''), checklistInstanceId: str(d.checklistInstanceId, ''),
      editor: str(d.editor, ''), version: num(d.version, 1), completionPct: clampPct(d.completionPct),
      views: num(d.views, 0), ctr: num(d.ctr, 0), avgViewDuration: str(d.avgViewDuration, ''), comments: num(d.comments, 0),
      tags: idArr(d.tags), order: num(d.order, 0),
      createdAt: d.createdAt || nowIso(), updatedAt: nowIso()
    };
  }
  function scriptModel(d) {
    return {
      id: d.id || uid('scr'), videoId: str(d.videoId, ''), channelId: str(d.channelId, ''), templateId: str(d.templateId, ''),
      title: str(d.title, 'Untitled Script'), status: pick(d.status, SCRIPT_STATUSES, 'draft'),
      hook: str(d.hook, ''), opening: str(d.opening, ''), mainBody: str(d.mainBody, ''), ending: str(d.ending, ''), cta: str(d.cta, ''),
      narrationNotes: str(d.narrationNotes, ''), editingNotes: str(d.editingNotes, ''), musicNotes: str(d.musicNotes, ''),
      sfxNotes: str(d.sfxNotes, ''), graphicsNotes: str(d.graphicsNotes, ''), animationNotes: str(d.animationNotes, ''),
      estimatedRuntime: str(d.estimatedRuntime, ''), versionHistory: arr(d.versionHistory),
      createdAt: d.createdAt || nowIso(), updatedAt: nowIso()
    };
  }
  function videoTemplateModel(d) {
    return {
      id: d.id || uid('vt'), name: str(d.name, 'Untitled Template'), type: pick(d.type, VIDEO_TEMPLATE_TYPE_KEYS, 'talking-head'),
      structure: str(d.structure, ''), narrativeFlow: str(d.narrativeFlow, ''), editingStyle: str(d.editingStyle, ''),
      hookFormula: str(d.hookFormula, ''), retentionStrategy: str(d.retentionStrategy, ''),
      cameraAngles: str(d.cameraAngles, ''), shotSuggestions: str(d.shotSuggestions, ''),
      graphicsStyle: str(d.graphicsStyle, ''), motionGraphics: str(d.motionGraphics, ''),
      musicStyle: str(d.musicStyle, ''), soundDesign: str(d.soundDesign, ''),
      thumbnailStyle: str(d.thumbnailStyle, ''), cta: str(d.cta, ''), publishingStrategy: str(d.publishingStrategy, ''),
      seoChecklist: idArr(d.seoChecklist), targetAudience: str(d.targetAudience, ''),
      avgRuntime: str(d.avgRuntime, ''), equipment: str(d.equipment, ''), exampleVideos: idArr(d.exampleVideos),
      isBuiltIn: bool(d.isBuiltIn), order: num(d.order, 0), createdAt: d.createdAt || nowIso()
    };
  }
  function checklistItemShape(it) {
    return { id: it.id || uid('cki'), text: str(it.text, ''), order: num(it.order, 0), parentId: str(it.parentId, ''), done: bool(it.done), dueDate: str(it.dueDate, '') };
  }
  function checklistSectionsShape(sections) {
    return arr(sections).map(function (sec) {
      return { id: sec.id || uid('cks'), title: str(sec.title, 'Section'), order: num(sec.order, 0), items: arr(sec.items).map(checklistItemShape) };
    });
  }
  function checklistTemplateModel(d) {
    return {
      id: d.id || uid('ckt'), name: str(d.name, 'Untitled Checklist'), description: str(d.description, ''),
      sections: checklistSectionsShape(d.sections), isBuiltIn: bool(d.isBuiltIn), order: num(d.order, 0),
      createdAt: d.createdAt || nowIso()
    };
  }
  function checklistInstanceModel(d) {
    return {
      id: d.id || uid('cki'), templateId: str(d.templateId, ''), videoId: str(d.videoId, ''),
      name: str(d.name, 'Production Checklist'), sections: checklistSectionsShape(d.sections),
      createdAt: d.createdAt || nowIso()
    };
  }
  function noteAttachmentShape(a) {
    return { id: a.id || uid('att'), name: str(a.name, 'Attachment'), url: str(a.url, ''), kind: pick(a.kind, ['image', 'video', 'audio', 'file', 'drawing', 'link'], 'file') };
  }
  function noteModel(d) {
    return {
      id: d.id || uid('note'), title: str(d.title, 'Untitled Note'), body: str(d.body, ''),
      tags: idArr(d.tags), collections: idArr(d.collections),
      priority: pick(d.priority, NOTE_PRIORITIES, 'medium'), status: pick(d.status, NOTE_STATUSES, 'none'),
      colorLabel: pick(d.colorLabel, NOTE_COLOR_LABELS, 'none'), favorite: bool(d.favorite),
      scope: pick(d.scope, NOTE_SCOPES, 'global'), scopeId: str(d.scopeId, ''),
      attachments: arr(d.attachments).map(noteAttachmentShape),
      createdAt: d.createdAt || nowIso(), updatedAt: nowIso()
    };
  }
  function sectionModel(d) {
    return {
      id: d.id || uid('sec'), scope: str(d.scope, 'video-research'), scopeId: str(d.scopeId, ''),
      title: str(d.title, 'Section'), body: str(d.body, ''), order: num(d.order, 0),
      createdAt: d.createdAt || nowIso()
    };
  }
  function assetModel(d) {
    return {
      id: d.id || uid('asset'), name: str(d.name, 'Untitled Asset'), type: pick(d.type, ASSET_TYPE_KEYS, 'document'),
      fileUrl: str(d.fileUrl, ''), tags: idArr(d.tags), channelId: str(d.channelId, ''), description: str(d.description, ''),
      favorite: bool(d.favorite), order: num(d.order, 0), createdAt: d.createdAt || nowIso()
    };
  }
  function calendarEventModel(d) {
    return {
      id: d.id || uid('cal'), title: str(d.title, 'Untitled Event'), type: pick(d.type, CALENDAR_EVENT_TYPES, 'planning'),
      date: str(d.date, todayStr()), videoId: str(d.videoId, ''), channelId: str(d.channelId, ''), notes: str(d.notes, ''),
      createdAt: d.createdAt || nowIso()
    };
  }
  function analyticsSnapshotModel(d) {
    return {
      id: d.id || uid('snap'), channelId: str(d.channelId, ''), date: str(d.date, todayStr()),
      views: num(d.views, 0), subscribers: num(d.subscribers, 0), watchTime: num(d.watchTime, 0),
      ctr: num(d.ctr, 0), retention: num(d.retention, 0), revenue: num(d.revenue, 0),
      rpm: num(d.rpm, 0), impressions: num(d.impressions, 0), createdAt: d.createdAt || nowIso()
    };
  }
  function tagModel(d) { return { id: d.id || uid('tag'), name: str(d.name, 'tag'), color: str(d.color, '#c9a876') }; }
  function globalTemplateModel(d) {
    return {
      id: d.id || uid('gt'), kind: pick(d.kind, GLOBAL_TEMPLATE_KIND_KEYS, 'title'), name: str(d.name, 'Untitled'),
      content: str(d.content, ''), tags: idArr(d.tags), isBuiltIn: bool(d.isBuiltIn), order: num(d.order, 0), createdAt: d.createdAt || nowIso()
    };
  }
  function favoriteModel(d) { return { id: d.id || uid('fav'), itemType: pick(d.itemType, FAVORITE_TYPES, 'video'), itemId: str(d.itemId, ''), createdAt: d.createdAt || nowIso() }; }
  // Singleton Dashboard Home hero record — same shape/recipe as writing-
  // dashboard-data.js's own heroModel/getHero/saveHero (KEYS.hero, a
  // lone JSON object rather than a collection). Bound to GlassTheme.
  // wireHero() exactly like that page's own Home hero.
  function heroModel(d) {
    d = d || {};
    return {
      eyebrow: d.eyebrow || 'YOUTUBE BUSINESS OS', title: d.title || 'Every Channel, One Operating System.',
      subtext: d.subtext || 'From the first spark of an idea to the analytics report — plan, script, produce, and publish every channel from one place.',
      ctaLabel: d.ctaLabel || 'Open Channels', photo: d.photo || ''
    };
  }

  // ============================================================
  // VIDEO FILE BLOB STORE — raw IndexedDB, deliberately separate from
  // the shared personal-dashboard-kv localStorage shim (local-store-idb
  // .js, untouched by this file). Actual video binaries don't belong in
  // a JSON-serialized KV blob: the whole `ytd:videos` collection is one
  // JSON array under one localStorage key, and sync.js pushes that
  // entire blob to a single Postgres jsonb row on every change — a
  // multi-hundred-MB video inlined as base64 inside it would make every
  // read/write/sync of EVERY video in the app slow, and would blow well
  // past Supabase's own request-size limits. So the attached video file
  // itself lives here, keyed by videoId, device-local only (same honest
  // "uploaded video slots are session-only" precedent dreamboard.html
  // already established for its own photo/video grid — upgraded here to
  // survive a reload on the SAME device via real IndexedDB persistence,
  // not just a page-lifetime object URL). Only small metadata
  // (videoFileName/Size/Type/AttachedAt on the Video record itself)
  // syncs across devices; the file needs re-attaching per device.
  var VideoFiles = (function () {
    var DB_NAME = 'ytd-video-files', STORE = 'files', dbPromise = null;
    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) { e.target.result.createObjectStore(STORE); };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function () { reject(req.error); };
      });
      return dbPromise;
    }
    function put(videoId, file) {
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(file, videoId);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    }
    function get(videoId) {
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readonly');
          var req = tx.objectStore(STORE).get(videoId);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { reject(req.error); };
        });
      });
    }
    function remove(videoId) {
      return openDb().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(videoId);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        });
      }).catch(function () {});
    }
    return { put: put, get: get, remove: remove };
  })();

  var Channels = makeCollection(KEYS.channels, channelModel);
  var Videos = makeCollection(KEYS.videos, videoModel);
  var Scripts = makeCollection(KEYS.scripts, scriptModel);
  var VideoTemplates = makeCollection(KEYS.videoTemplates, videoTemplateModel);
  var ChecklistTemplates = makeCollection(KEYS.checklistTemplates, checklistTemplateModel);
  var ChecklistInstances = makeCollection(KEYS.checklistInstances, checklistInstanceModel);
  var Notes = makeCollection(KEYS.notes, noteModel);
  var Sections = makeCollection(KEYS.sections, sectionModel);
  var Assets = makeCollection(KEYS.assets, assetModel);
  var CalendarEvents = makeCollection(KEYS.calendarEvents, calendarEventModel);
  var AnalyticsSnapshots = makeCollection(KEYS.analyticsSnapshots, analyticsSnapshotModel);
  var Tags = makeCollection(KEYS.tags, tagModel);
  var GlobalTemplates = makeCollection(KEYS.globalTemplates, globalTemplateModel);
  var Favorites = makeCollection(KEYS.favorites, favoriteModel);

  // ============================================================
  // SELECTORS
  // ============================================================
  function channelsSorted() { return Channels.list().sort(function (a, b) { return a.order - b.order || a.name.localeCompare(b.name); }); }
  function videosFor(channelId) { return Videos.list().filter(function (v) { return v.channelId === channelId; }).sort(function (a, b) { return a.order - b.order; }); }
  function videosAll() { return Videos.list().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); }); }
  function scriptForVideo(videoId) { return Scripts.list().find(function (s) { return s.videoId === videoId; }) || null; }
  function ensureScriptForVideo(video) {
    var existing = scriptForVideo(video.id);
    if (existing) return existing;
    var rec = Scripts.add({ videoId: video.id, channelId: video.channelId, templateId: video.templateId, title: video.title });
    Videos.update(video.id, { scriptId: rec.id });
    return rec;
  }
  function scriptWordCount(script) {
    if (!script) return 0;
    var text = [script.hook, script.opening, script.mainBody, script.ending, script.cta].join(' ');
    var m = text.trim().match(/\S+/g);
    return m ? m.length : 0;
  }
  function scriptReadingMinutes(script) { return Math.max(0, Math.round(scriptWordCount(script) / 140 * 10) / 10); }

  function sectionsFor(scope, scopeId) {
    return Sections.list().filter(function (s) { return s.scope === scope && s.scopeId === scopeId; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function addSection(scope, scopeId, title, body) {
    var existing = sectionsFor(scope, scopeId);
    var order = existing.length ? existing[existing.length - 1].order + 1 : 0;
    return Sections.add({ scope: scope, scopeId: scopeId, title: title || 'Section', body: body || '', order: order });
  }
  function moveSection(id, dir) {
    var sec = Sections.get(id); if (!sec) return;
    var list = sectionsFor(sec.scope, sec.scopeId);
    var idx = list.findIndex(function (s) { return s.id === id; });
    var swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    var a = list[idx], b = list[swapIdx];
    Sections.update(a.id, { order: b.order }); Sections.update(b.id, { order: a.order });
  }
  function ensureDefaultSections(scope, scopeId, titles) {
    if (sectionsFor(scope, scopeId).length) return;
    titles.forEach(function (t) { addSection(scope, scopeId, t, ''); });
  }

  function notesFor(scope, scopeId) {
    return Notes.list().filter(function (n) { return n.scope === scope && n.scopeId === scopeId; })
      .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
  }
  function notesCountFor(scope, scopeId) { return notesFor(scope, scopeId).length; }

  function instantiateChecklist(templateId, videoId, name) {
    var tmpl = ChecklistTemplates.get(templateId);
    if (!tmpl) return null;
    var clonedSections = tmpl.sections.map(function (sec) {
      return { id: uid('cks'), title: sec.title, order: sec.order, items: sec.items.map(function (it) {
        return { id: uid('cki'), text: it.text, order: it.order, parentId: it.parentId, done: false, dueDate: '' };
      }) };
    });
    var inst = ChecklistInstances.add({ templateId: templateId, videoId: videoId, name: name || (tmpl.name), sections: clonedSections });
    if (videoId) Videos.update(videoId, { checklistInstanceId: inst.id });
    return inst;
  }
  function checklistProgress(instance) {
    if (!instance) return 0;
    var total = 0, done = 0;
    instance.sections.forEach(function (sec) { sec.items.forEach(function (it) { total++; if (it.done) done++; }); });
    return total ? Math.round(done / total * 100) : 0;
  }
  function toggleChecklistItem(instanceId, itemId) {
    var inst = ChecklistInstances.get(instanceId); if (!inst) return null;
    var sections = inst.sections.map(function (sec) {
      return Object.assign({}, sec, { items: sec.items.map(function (it) { return it.id === itemId ? Object.assign({}, it, { done: !it.done }) : it; }) });
    });
    return ChecklistInstances.update(instanceId, { sections: sections });
  }
  function duplicateVideoTemplate(id) {
    var orig = VideoTemplates.get(id); if (!orig) return null;
    return VideoTemplates.add(Object.assign({}, orig, { id: undefined, name: orig.name + ' (Copy)', isBuiltIn: false, order: VideoTemplates.list().length }));
  }
  function duplicateChecklistTemplate(id) {
    var orig = ChecklistTemplates.get(id); if (!orig) return null;
    var sections = orig.sections.map(function (sec) {
      return { id: uid('cks'), title: sec.title, order: sec.order, items: sec.items.map(function (it) { return { id: uid('cki'), text: it.text, order: it.order, parentId: it.parentId, done: false, dueDate: '' }; }) };
    });
    return ChecklistTemplates.add({ name: orig.name + ' (Copy)', description: orig.description, sections: sections, isBuiltIn: false, order: ChecklistTemplates.list().length });
  }

  function assetsFor(channelId, includeGlobal) {
    return Assets.list().filter(function (a) {
      if (!channelId) return true;
      return a.channelId === channelId || (includeGlobal !== false && !a.channelId);
    }).sort(function (a, b) { return a.order - b.order; });
  }

  function calendarEntriesFor(channelId) {
    var entries = [];
    Videos.list().forEach(function (v) {
      if (channelId && v.channelId !== channelId) return;
      if (v.targetPublishDate) entries.push({ id: 'vid-target-' + v.id, date: v.targetPublishDate, title: v.title, type: 'publishing', videoId: v.id, channelId: v.channelId, isTarget: true, status: v.status });
      if (v.actualPublishDate) entries.push({ id: 'vid-actual-' + v.id, date: v.actualPublishDate, title: v.title + ' — Published', type: 'publishing', videoId: v.id, channelId: v.channelId, isActual: true, status: v.status });
    });
    CalendarEvents.list().forEach(function (e) {
      if (channelId && e.channelId !== channelId) return;
      entries.push({ id: e.id, date: e.date, title: e.title, type: e.type, videoId: e.videoId, channelId: e.channelId, notes: e.notes });
    });
    return entries.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function analyticsFor(channelId) { return AnalyticsSnapshots.list().filter(function (s) { return s.channelId === channelId; }).sort(function (a, b) { return a.date.localeCompare(b.date); }); }
  function latestSnapshot(channelId) { var l = analyticsFor(channelId); return l.length ? l[l.length - 1] : null; }
  function channelRollup(channelId) {
    var snap = latestSnapshot(channelId);
    var vids = videosFor(channelId);
    var published = vids.filter(function (v) { return v.status === 'published'; });
    var totalRevenue = vids.reduce(function (s, v) { return s + num(v.revenue, 0); }, 0);
    return {
      views: snap ? snap.views : 0, subscribers: snap ? snap.subscribers : num((Channels.get(channelId) || {}).subscribers, 0),
      watchTime: snap ? snap.watchTime : 0, revenue: totalRevenue,
      publishedCount: published.length, totalVideos: vids.length
    };
  }
  function topVideos(channelId, n) {
    var vids = channelId ? videosFor(channelId) : Videos.list();
    return vids.filter(function (v) { return v.status === 'published'; }).sort(function (a, b) { return num(b.revenue, 0) - num(a.revenue, 0); }).slice(0, n || 5);
  }

  function globalStats() {
    var channels = Channels.list(), videos = Videos.list();
    var active = channels.filter(function (c) { return c.status === 'active'; });
    var planned = videos.filter(function (v) { return ['idea', 'planning'].indexOf(v.status) !== -1; });
    var inProgress = videos.filter(function (v) { return ['scripting', 'filming', 'editing'].indexOf(v.status) !== -1; });
    var review = videos.filter(function (v) { return v.status === 'review'; });
    var scheduled = videos.filter(function (v) { return v.status === 'scheduled'; });
    var published = videos.filter(function (v) { return v.status === 'published'; });
    var totalViews = 0, totalWatchTime = 0, totalRevenue = 0, totalSubs = 0;
    channels.forEach(function (c) {
      var r = channelRollup(c.id);
      totalViews += r.views; totalWatchTime += r.watchTime; totalRevenue += r.revenue; totalSubs += r.subscribers;
    });
    var thisMonth = todayStr().slice(0, 7);
    var monthlyUploads = published.filter(function (v) { return (v.actualPublishDate || '').slice(0, 7) === thisMonth; }).length;
    return {
      totalChannels: channels.length, activeChannels: active.length,
      totalPlannedVideos: planned.length, videosInProgress: inProgress.length,
      videosAwaitingReview: review.length, scheduledVideos: scheduled.length, publishedVideos: published.length,
      totalViews: totalViews, subscribers: totalSubs, watchTime: totalWatchTime, revenue: totalRevenue,
      monthlyUploads: monthlyUploads, uploadStreak: uploadStreak()
    };
  }
  function uploadStreak() {
    var dates = {};
    Videos.list().forEach(function (v) { if (v.actualPublishDate) dates[v.actualPublishDate] = true; });
    var streak = 0, cursor = new Date();
    if (!dates[todayStr()]) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      var ds = cursor.toISOString().slice(0, 10);
      if (!dates[ds]) break;
      streak++; cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function toggleFavorite(itemType, itemId) {
    var existing = Favorites.list().find(function (f) { return f.itemType === itemType && f.itemId === itemId; });
    if (existing) { Favorites.remove(existing.id); return false; }
    Favorites.add({ itemType: itemType, itemId: itemId }); return true;
  }
  function isFavorite(itemType, itemId) { return !!Favorites.list().find(function (f) { return f.itemType === itemType && f.itemId === itemId; }); }
  function favoritesList() { return Favorites.list().slice().reverse(); }

  function pushRecentlyViewed(itemType, itemId, label, icon) {
    var list = storeGet(KEYS.recentlyViewed, []);
    list = list.filter(function (x) { return !(x.itemType === itemType && x.itemId === itemId); });
    list.unshift({ itemType: itemType, itemId: itemId, label: label, icon: icon || '', viewedAt: nowIso() });
    if (list.length > 24) list = list.slice(0, 24);
    storeSet(KEYS.recentlyViewed, list);
  }
  function recentlyViewedList() { return storeGet(KEYS.recentlyViewed, []); }

  function searchAll(query) {
    var q = String(query || '').toLowerCase().trim();
    if (!q) return [];
    var out = [];
    function match(text) { return String(text || '').toLowerCase().indexOf(q) !== -1; }
    Channels.list().forEach(function (c) { if (match(c.name) || match(c.niche)) out.push({ type: 'channel', id: c.id, label: c.name, sub: c.niche, icon: '📺' }); });
    Videos.list().forEach(function (v) { if (match(v.title) || match(v.primaryKeyword)) out.push({ type: 'video', id: v.id, label: v.title, sub: (Channels.get(v.channelId) || {}).name || '', icon: '🎬' }); });
    Scripts.list().forEach(function (s) { if (match(s.title) || match(s.hook)) out.push({ type: 'script', id: s.id, label: s.title, sub: 'Script', icon: '📜' }); });
    VideoTemplates.list().forEach(function (t) { if (match(t.name)) out.push({ type: 'videoTemplate', id: t.id, label: t.name, sub: 'Video Template', icon: '🧩' }); });
    ChecklistTemplates.list().forEach(function (t) { if (match(t.name)) out.push({ type: 'checklistTemplate', id: t.id, label: t.name, sub: 'Checklist Template', icon: '✅' }); });
    Assets.list().forEach(function (a) { if (match(a.name)) out.push({ type: 'asset', id: a.id, label: a.name, sub: a.type, icon: '🗂️' }); });
    Notes.list().forEach(function (n) { if (match(n.title) || match(n.body)) out.push({ type: 'note', id: n.id, label: n.title, sub: 'Note', icon: '🗒️' }); });
    return out.slice(0, 40);
  }

  // ============================================================
  // SEEDING — lazy, one-time, real/useful content (not filler)
  // ============================================================
  function ensureDefaultVideoTemplatesOnce() {
    if (storeGet(KEYS.seededVideoTemplates, false)) return;
    if (VideoTemplates.list().length) { storeSet(KEYS.seededVideoTemplates, true); return; }
    var T = [
      { type: 'talking-head', name: 'Talking Head', structure: 'Cold open hook (0-15s) → Intro/context → 3-5 main points to camera → Recap → CTA/outro.', narrativeFlow: 'Direct-to-camera monologue, conversational pacing, one idea per beat.', editingStyle: 'Jump cuts to remove pauses/filler words, subtle zoom punches on key lines.', hookFormula: 'State the surprising claim or promise in the first sentence, before any branding.', retentionStrategy: 'Pattern-interrupt every 30-45s (b-roll, graphic, or reframe) to reset attention.', cameraAngles: 'Single static medium shot, eye-level, optional second angle for cutaways.', shotSuggestions: 'Medium shot primary; tight close-up cutaways on emphasis lines.', graphicsStyle: 'Lower-third name/title, keyword callouts as on-screen text.', motionGraphics: 'Simple animated text pop-ins, no heavy VFX.', musicStyle: 'Low, unobtrusive bed under talking, swell only at transitions.', soundDesign: 'Whoosh on cuts, soft click on text pop-ins.', thumbnailStyle: 'Face + 3-5 word bold text + high-contrast background.', cta: 'Ask a direct question tied to the topic, point to comments.', publishingStrategy: 'Publish consistently on a fixed weekly slot to train audience habit.', seoChecklist: ['Primary keyword in first 8 words of title', 'Keyword in first line of description', 'End screen linking to related video', 'Pinned comment with timestamped chapters'], targetAudience: 'Viewers who want a direct opinion or explanation fast.', avgRuntime: '8-12 min', equipment: 'One camera, lav or shotgun mic, 2-point lighting.' },
      { type: 'essay', name: 'Video Essay', structure: 'Thesis stated up front → 3-4 sections building the argument → synthesis → closing thought.', narrativeFlow: 'Argumentative arc: claim, evidence, counterpoint, resolution.', editingStyle: 'Match cuts between narration and visual evidence, minimal jump cuts.', hookFormula: 'Open on the central tension or question the essay resolves.', retentionStrategy: 'Escalating stakes per section — each section should raise the question further before answering it.', cameraAngles: 'Mostly voiceover-over-footage; on-camera only for framing/closing.', shotSuggestions: 'Archival/stock footage, screen recordings, and diagrams cut to narration beats.', graphicsStyle: 'Minimal, editorial — pull quotes, source citations on screen.', motionGraphics: 'Slow Ken Burns pans on stills, understated transitions.', musicStyle: 'Cinematic/ambient, shifts mood per section.', soundDesign: 'Subtle risers into section transitions.', thumbnailStyle: 'Evocative single image + short provocative phrase.', cta: 'Invite discussion/disagreement in comments rather than a hard ask.', publishingStrategy: 'Lower frequency, higher production value — evergreen SEO title.', seoChecklist: ['Descriptive, searchable title (not clickbait)', 'Timestamped chapters for each section', 'Sources listed in description'], targetAudience: 'Viewers seeking in-depth analysis or perspective.', avgRuntime: '15-25 min', equipment: 'Editing-heavy; camera only for bookend shots.' },
      { type: 'documentary', name: 'Documentary', structure: 'Cold open scene → title card → context/backstory → chronological or thematic acts → resolution/epilogue.', narrativeFlow: 'Observational or investigative arc following a real subject or event.', editingStyle: 'Interview intercut with b-roll/archival, longer takes than talking-head.', hookFormula: 'Open mid-scene on the most dramatic beat, then rewind to context.', retentionStrategy: 'Withhold a key reveal until a later act to sustain the through-line.', cameraAngles: 'Multi-angle interviews, wide establishing shots, handheld verite b-roll.', shotSuggestions: 'Establishing wides, interview mediums, detail inserts.', graphicsStyle: 'Lower-thirds for interviewees, location/date title cards.', motionGraphics: 'Map/timeline animations for context.', musicStyle: 'Score that tracks emotional beats of each act.', soundDesign: 'Natural ambient sound preserved, not overwhelmed by score.', thumbnailStyle: 'Striking real moment, minimal text.', cta: 'Point to a follow-up video or full playlist.', publishingStrategy: 'Tent-pole release, promoted across other videos/channels.', seoChecklist: ['Chapters for each act', 'Full transcript in description for long-tail search'], targetAudience: 'Viewers wanting deep, story-driven nonfiction.', avgRuntime: '20-40 min', equipment: 'Multi-cam, external audio, tripod + gimbal.' },
      { type: 'storytelling', name: 'Storytelling', structure: 'Hook with the stakes → setup → rising action → climax → resolution/lesson.', narrativeFlow: 'Classic narrative arc, first- or third-person.', editingStyle: 'Paced like fiction — hold on reactions, cut fast through exposition.', hookFormula: 'Open at the most tense moment, then say "but let me back up."', retentionStrategy: 'Cliffhang into every ad-break-equivalent point.', cameraAngles: 'Talking head plus dramatized/illustrated cutaways.', shotSuggestions: 'Reenactment b-roll, stock footage, or animated illustration matched to narration.', graphicsStyle: 'Minimal captions, occasional emphasis text on key lines.', motionGraphics: 'Simple animated transitions between scenes.', musicStyle: 'Emotionally reactive score, shifts with the story beats.', soundDesign: 'Foley/ambience to sell dramatized moments.', thumbnailStyle: 'A single striking "moment" image with an intriguing phrase.', cta: 'Ask viewers if something similar happened to them.', publishingStrategy: 'Series-friendly — good for a recurring story-time format.', seoChecklist: ['Title promises the stakes without spoiling the ending', 'Keyword-rich description summary'], targetAudience: 'Viewers who want narrative/entertainment over information.', avgRuntime: '10-18 min', equipment: 'One camera + optional b-roll kit.' },
      { type: 'review', name: 'Review', structure: 'First impression hook → unboxing/overview → criteria-by-criteria breakdown → verdict/score.', narrativeFlow: 'Evaluative — build toward a clear final verdict.', editingStyle: 'Close-up product inserts intercut with talking head.', hookFormula: 'Lead with the single most surprising pro or con.', retentionStrategy: 'Tease the final verdict early, deliver full reasoning before confirming it.', cameraAngles: 'Overhead/macro for product detail, medium for talking head.', shotSuggestions: 'Macro detail shots, side-by-side comparisons.', graphicsStyle: 'On-screen spec sheets, score overlays.', motionGraphics: 'Animated comparison tables/bar charts.', musicStyle: 'Upbeat, neutral bed.', soundDesign: 'Clean product-handling foley.', thumbnailStyle: 'Product hero shot + score or verdict word.', cta: 'Link affiliate/purchase info, ask viewers what to review next.', publishingStrategy: 'Publish close to product launch/news cycle for search traffic.', seoChecklist: ['Product name exact-match in title', '"Review" keyword variant covered in description', 'Pros/cons list in description'], targetAudience: 'Pre-purchase researchers.', avgRuntime: '8-15 min', equipment: 'Macro lens or close-focus camera, product turntable.' },
      { type: 'tutorial', name: 'Tutorial', structure: 'Outcome preview hook → prerequisites → numbered steps → final result recap.', narrativeFlow: 'Procedural — one clear step at a time, no tangents.', editingStyle: 'Screen recording or overhead cut tightly to each step, dead air removed.', hookFormula: 'Show the finished result first: "here\'s what you\'ll be able to do."', retentionStrategy: 'Number the steps on screen so viewers can track progress.', cameraAngles: 'Screen capture or overhead hands shot.', shotSuggestions: 'Step-by-step screen/hands inserts, occasional talking head for context.', graphicsStyle: 'Step counters, keyboard/click callouts, code/text overlays.', motionGraphics: 'Cursor highlight animations, arrow callouts.', musicStyle: 'Light, low-key bed, mutes during key instructions.', soundDesign: 'Click/keystroke SFX for emphasis.', thumbnailStyle: 'Before/after split or big step-count number.', cta: 'Link to source files/resources, ask what to tutorial next.', publishingStrategy: 'Strong evergreen search candidate — title exactly how people would search.', seoChecklist: ['"How to" phrasing matched to real search queries', 'Chapters per step', 'Resource links pinned in description'], targetAudience: 'Viewers trying to accomplish a specific task.', avgRuntime: '6-15 min', equipment: 'Screen recorder or overhead rig, clean audio.' },
      { type: 'top10', name: 'Top 10 / Listicle', structure: 'Hook with the list\'s promise → items ranked ascending → recap of #1.', narrativeFlow: 'Countdown structure, each item self-contained.', editingStyle: 'Fast-paced, consistent per-item template (title card → footage → verdict).', hookFormula: 'Tease #1 or the most surprising entry without naming it.', retentionStrategy: 'Consistent item numbering on screen keeps viewers counting toward the end.', cameraAngles: 'Talking head intros/outros, b-roll per item.', shotSuggestions: 'Quick-cut footage per item matched to its specific claim.', graphicsStyle: 'Big number badge per item, consistent lower-third template.', motionGraphics: 'Number counter animation, item-card wipe transitions.', musicStyle: 'Upbeat, consistent energy throughout.', soundDesign: 'Whoosh/stinger on each number reveal.', thumbnailStyle: 'Bold number + collage of top items.', cta: 'Ask viewers to comment their own #1.', publishingStrategy: 'Highly clip/short-friendly — cut individual items into Shorts.', seoChecklist: ['Number in the title ("Top 10...")', 'Each item timestamped as its own chapter'], targetAudience: 'Viewers wanting quick, scannable comparisons.', avgRuntime: '10-16 min', equipment: 'One camera + b-roll library.' },
      { type: 'explainer', name: 'Explainer', structure: 'Hook the confusion/question → simplify the core concept → build up complexity → summary.', narrativeFlow: 'Concept-first: define, illustrate, apply.', editingStyle: 'Diagram/animation-forward, narration-led.', hookFormula: 'Ask the question the whole internet is confused about.', retentionStrategy: 'Layer complexity gradually — never introduce two new ideas at once.', cameraAngles: 'Mostly voiceover-over-graphics; talking head bookends.', shotSuggestions: 'Animated diagrams, whiteboard-style graphics, relevant stock footage.', graphicsStyle: 'Clean infographic style, consistent color-coding per concept.', motionGraphics: 'Animated diagrams that build piece by piece.', musicStyle: 'Curious, light instrumental bed.', soundDesign: 'Soft UI-style blips for diagram reveals.', thumbnailStyle: 'Simple diagram or "?"-driven visual + short question text.', cta: 'Link a deeper-dive video for viewers who want more.', publishingStrategy: 'Strong search/evergreen candidate for "what is X" queries.', seoChecklist: ['"What is" / "How does X work" phrasing in title', 'Definition stated clearly in first 15s and in description'], targetAudience: 'Curious viewers wanting a concept demystified.', avgRuntime: '6-12 min', equipment: 'Screen/animation software, voiceover mic.' },
      { type: 'podcast', name: 'Podcast (Video)', structure: 'Cold open clip → intro → segments/topics → guest close-out (if any) → outro.', narrativeFlow: 'Conversational, loosely structured around a topic list.', editingStyle: 'Multi-cam switching on speaker, minimal cuts within a thought.', hookFormula: 'Open on the single best soundbite from the episode.', retentionStrategy: 'Segment markers/topic changes signaled visually to reset attention.', cameraAngles: 'Two-to-four camera setup, wide + individual speaker shots.', shotSuggestions: 'Cutaways to reactions, wide shot for context.', graphicsStyle: 'Lower-thirds for speakers, topic title cards per segment.', motionGraphics: 'Minimal — waveform or subtle ambient background motion.', musicStyle: 'Intro/outro stings only, silent during conversation.', soundDesign: 'Clean multi-mic mix is the priority over SFX.', thumbnailStyle: 'Host + guest faces, topic in bold text.', cta: 'Push the audio-only version and timestamps.', publishingStrategy: 'Long-form full episode + clipped short highlights across the week.', seoChecklist: ['Guest name in title if applicable', 'Full timestamped topic list in description'], targetAudience: 'Viewers who want long-form conversation/background listening.', avgRuntime: '30-90 min', equipment: 'Multi-cam, multi-mic audio interface.' },
      { type: 'interview', name: 'Interview', structure: 'Guest intro hook → rapport-building questions → core topic questions → closing/plug.', narrativeFlow: 'Question-led, guest-centered.', editingStyle: 'Two-shot with cutaway singles, trims dead air between Q&A.', hookFormula: 'Open on the guest\'s most compelling answer.', retentionStrategy: 'Vary question topics/energy to avoid a flat single-tone conversation.', cameraAngles: 'Two-shot plus individual coverage of host and guest.', shotSuggestions: 'Reaction cutaways, occasional b-roll relevant to the topic discussed.', graphicsStyle: 'Guest name/title lower-third, key quote callouts.', motionGraphics: 'Minimal, quote-card overlays for standout lines.', musicStyle: 'Light bed at open/close only.', soundDesign: 'Clean dual-mic audio is the priority.', thumbnailStyle: 'Guest photo + provocative quote or question.', cta: 'Point to the guest\'s own channel/links.', publishingStrategy: 'Cross-promote with the guest\'s own audience.', seoChecklist: ['Guest\'s name/title in title', 'Key topics timestamped'], targetAudience: 'Fans of the guest or the topic discussed.', avgRuntime: '20-45 min', equipment: 'Two-camera, lav mics for both speakers.' },
      { type: 'reaction', name: 'Reaction', structure: 'Setup what\'s about to be watched → play source with picture-in-picture reactions → wrap-up take.', narrativeFlow: 'Real-time commentary layered over source content.', editingStyle: 'Picture-in-picture, pause-and-comment cuts on key moments.', hookFormula: 'Tease the specific moment that\'s about to shock/impress.', retentionStrategy: 'Pause right before big moments to build anticipation before reacting.', cameraAngles: 'Single reaction cam, picture-in-picture over source clip.', shotSuggestions: 'Reaction cam close-up, source content framed clearly.', graphicsStyle: 'Timestamp/source credit on screen throughout.', motionGraphics: 'Minimal — PiP frame styling only.', musicStyle: 'None during playback; light bed on intro/outro only.', soundDesign: 'Balance source audio against reaction commentary carefully.', thumbnailStyle: 'Exaggerated reaction face + source thumbnail inset.', cta: 'Link the original source, credit the creator.', publishingStrategy: 'Fast turnaround on trending content maximizes reach.', seoChecklist: ['Source creator/title credited in title and description', 'Fair-use commentary is substantive, not just replay'], targetAudience: 'Fans of the reactor and/or the source content.', avgRuntime: '10-20 min', equipment: 'One camera, screen capture/playback source.' },
      { type: 'shorts', name: 'YouTube Shorts', structure: 'Hook in first 1s → single idea payoff → loop-friendly ending.', narrativeFlow: 'One idea, no filler, vertical framing.', editingStyle: 'Ultra-fast cuts, text-on-screen for sound-off viewing.', hookFormula: 'First frame must show the payoff or the stakes — no slow build.', retentionStrategy: 'End on a beat that loops naturally back into the hook.', cameraAngles: 'Vertical 9:16, tight framing.', shotSuggestions: 'Single continuous shot or 2-3 quick cuts max.', graphicsStyle: 'Bold captions, large legible text for muted viewing.', motionGraphics: 'Snappy text pop-ins synced to speech.', musicStyle: 'Trending/high-energy audio where relevant.', soundDesign: 'Punchy, minimal — one or two well-placed hits.', thumbnailStyle: 'First frame doubles as the thumbnail — design accordingly.', cta: 'Quick verbal or on-screen nudge to follow/watch the long-form version.', publishingStrategy: 'High frequency, repurposed from longform highlights where possible.', seoChecklist: ['Keyword-relevant on-screen text', 'Link to related longform video in description'], targetAudience: 'Scroll/discovery-feed viewers.', avgRuntime: '15-60 sec', equipment: 'Phone or vertical-crop camera setup.' },
      { type: 'longform-doc', name: 'Longform Documentary', structure: 'Cold open → multi-act investigation (3-6 acts) → climax revelation → epilogue/reflection.', narrativeFlow: 'Deep investigative arc across many sources and interviews.', editingStyle: 'Slow-build, archival-heavy, extensive interview intercutting.', hookFormula: 'Open on the unresolved mystery/question that drives the whole piece.', retentionStrategy: 'Each act ends on a new question that reframes what came before.', cameraAngles: 'Multi-location, multi-interview, extensive archival sourcing.', shotSuggestions: 'Archival footage, location b-roll, multiple interview setups.', graphicsStyle: 'Editorial title cards, source citations, timeline graphics.', motionGraphics: 'Animated maps/timelines for complex context.', musicStyle: 'Full original or licensed score tracking each act\'s tone.', soundDesign: 'Layered ambience + score, cinema-grade mix.', thumbnailStyle: 'Iconic single image, restrained text.', cta: 'Point to a companion series or source list.', publishingStrategy: 'Rare tent-pole release, heavily promoted across the channel.', seoChecklist: ['Full chaptered timestamps', 'Detailed sourced description for credibility and search'], targetAudience: 'Viewers seeking a deep, single-sitting investigative watch.', avgRuntime: '40-90+ min', equipment: 'Full production kit — multi-cam, external audio, archival licensing.' }
    ];
    T.forEach(function (t, i) { VideoTemplates.add(Object.assign({}, t, { isBuiltIn: true, order: i })); });
    storeSet(KEYS.seededVideoTemplates, true);
  }

  function ensureDefaultChecklistTemplateOnce() {
    if (storeGet(KEYS.seededChecklist, false)) return;
    if (ChecklistTemplates.list().length) { storeSet(KEYS.seededChecklist, true); return; }
    var SECTION_ITEMS = {
      'Concept': ['Define the core idea in one sentence', 'Confirm it fits a content pillar', 'Check it hasn\'t been done recently on this channel'],
      'Research': ['Gather source material/references', 'Note key facts to verify', 'Save reference links to Notes'],
      'Competitor Analysis': ['Find 3 similar videos on other channels', 'Note what they did well', 'Note the gap/angle this video will fill'],
      'Keyword Research': ['Identify primary keyword', 'List 3-5 secondary keywords', 'Check search volume/difficulty'],
      'Idea Validation': ['Sanity-check against past video performance', 'Confirm audience demand (comments/community tab)'],
      'Outline': ['Draft beat-by-beat outline', 'Confirm hook, body, and CTA are each planned'],
      'Script': ['Write full script draft', 'Read aloud for pacing', 'Mark narration/editing/music notes'],
      'Review': ['Self-review script/outline', 'Get a second pass if needed'],
      'Voiceover': ['Record voiceover/narration', 'Check audio levels are clean'],
      'Filming': ['Confirm shot list is ready', 'Film all planned shots', 'Capture extra b-roll/safety takes'],
      'Lighting': ['Set key/fill/back lights', 'Check for flicker/color temp mismatch'],
      'Camera Setup': ['Set resolution/frame rate', 'Check focus and framing', 'Check storage/battery'],
      'Audio': ['Mic levels checked', 'Room tone recorded', 'Background noise minimized'],
      'B-Roll': ['Capture/gather supporting footage', 'Log b-roll to the Asset Library'],
      'Editing': ['Rough cut assembled', 'Trim pacing/dead air', 'Color pass'],
      'Graphics': ['Add lower-thirds/callouts', 'Add captions/subtitles'],
      'Motion Graphics': ['Add animated transitions', 'Add any diagram/chart animations'],
      'Sound Design': ['Add SFX per script notes', 'Final audio mix/levels pass'],
      'Music': ['Select licensed/library track', 'Balance music under narration'],
      'Thumbnail': ['Design 2-3 thumbnail options', 'A/B test or pick final'],
      'Title': ['Draft 3-5 title options', 'Pick final title with keyword placement'],
      'SEO': ['Write keyword-optimized description', 'Add relevant tags'],
      'Description': ['Write full description with links/timestamps', 'Add chapters'],
      'Tags': ['Add primary + secondary keyword tags'],
      'End Screens': ['Add end screen linking related video/subscribe'],
      'Cards': ['Add cards linking relevant videos/playlists'],
      'Scheduling': ['Set target publish date/time', 'Add to Content Calendar'],
      'Publishing': ['Upload final render', 'Set thumbnail, title, description, tags', 'Publish or schedule'],
      'Promotion': ['Share to community tab/socials', 'Pin a comment'],
      'Repurposing': ['Cut Shorts/clips from the video', 'Repost highlights to other platforms'],
      'Analytics Review': ['Check CTR/retention after 48h', 'Check CTR/retention after 7 days'],
      'Lessons Learned': ['Note what worked', 'Note what to change next time'],
      'Archive': ['Archive project files', 'Mark video project as archived']
    };
    var order = 0;
    var sections = Object.keys(SECTION_ITEMS).map(function (title, si) {
      return { id: uid('cks'), title: title, order: si, items: SECTION_ITEMS[title].map(function (text, ii) { return { id: uid('cki'), text: text, order: ii, parentId: '', done: false, dueDate: '' }; }) };
    });
    ChecklistTemplates.add({ name: 'Standard Video Production Checklist', description: 'Full concept-to-archive production checklist covering every stage of making a video.', sections: sections, isBuiltIn: true, order: 0 });
    storeSet(KEYS.seededChecklist, true);
  }

  function ensureDefaultGlobalTemplatesOnce() {
    if (storeGet(KEYS.seededGlobalTemplates, false)) return;
    if (GlobalTemplates.list().length) { storeSet(KEYS.seededGlobalTemplates, true); return; }
    var G = [
      { kind: 'title', name: 'Curiosity Gap', content: 'I Tried [X] For [Timeframe] — Here\'s What Happened' },
      { kind: 'title', name: 'How-To (SEO)', content: 'How to [Achieve Outcome] (Step by Step)' },
      { kind: 'title', name: 'Listicle', content: '[Number] [Category] That [Benefit/Claim]' },
      { kind: 'title', name: 'Versus', content: '[Option A] vs [Option B]: Which Is Actually Better?' },
      { kind: 'description', name: 'Standard Description', content: 'One-sentence hook summarizing the video.\n\nIn this video: [1-2 sentence expansion].\n\n⏱️ Timestamps:\n0:00 Intro\n\n🔗 Links mentioned:\n\n📌 Subscribe for more [niche] content: [channel link]\n\n#tag1 #tag2 #tag3' },
      { kind: 'seo', name: 'Keyword Placement Checklist', content: 'Primary keyword: in title (first 8 words), first line of description, one of the first tags, spoken aloud in the video (for auto-captions).\nSecondary keywords: sprinkled naturally through the rest of the description, additional tags.' },
      { kind: 'thumbnail', name: 'Face + Bold Text', content: 'Layout: subject face (left or right third) + 3-5 word high-contrast bold text + saturated background. Avoid more than one focal point.' },
      { kind: 'thumbnail', name: 'Before/After Split', content: 'Layout: vertical split, "before" state left, "after" state right, small arrow or VS mark in the center.' },
      { kind: 'branding', name: 'Channel Identity One-Pager', content: 'Mission statement:\nTarget audience:\nContent pillars (3-5):\nBrand voice (3 adjectives):\nColor palette:\nTypography (heading/body):\nUpload schedule:' }
    ];
    G.forEach(function (g, i) { GlobalTemplates.add(Object.assign({}, g, { isBuiltIn: true, order: i })); });
    storeSet(KEYS.seededGlobalTemplates, true);
  }

  function ensureDefaultTagsOnce() {
    if (storeGet(KEYS.seededTags, false)) return;
    if (Tags.list().length) { storeSet(KEYS.seededTags, true); return; }
    var names = ['Educational', 'History', 'Gaming', 'Finance', 'Productivity', 'Essay', 'Documentary', 'Horror', 'AI', 'Evergreen', 'Trending', 'Urgent', 'Sponsored', 'Series', 'Shorts', 'Longform'];
    var colors = ['#7dd3fc', '#c9a876', '#a78bfa', '#6ee7b7', '#fbbf24', '#e8cf9f', '#8a8577', '#ff8a8a', '#7dd3fc', '#6ee7b7', '#fbbf24', '#ff8a8a', '#a78bfa', '#c9a876', '#e8cf9f', '#8a8577'];
    names.forEach(function (n, i) { Tags.add({ name: n, color: colors[i % colors.length] }); });
    storeSet(KEYS.seededTags, true);
  }
  function ensureAllDefaultsOnce() {
    ensureDefaultVideoTemplatesOnce(); ensureDefaultChecklistTemplateOnce(); ensureDefaultGlobalTemplatesOnce(); ensureDefaultTagsOnce();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.YouTubeDashboardData = {
    KEYS: KEYS, uid: uid, escapeHtml: escapeHtml, todayStr: todayStr,
    CHANNEL_STATUSES: CHANNEL_STATUSES, VIDEO_STATUSES: VIDEO_STATUSES, VIDEO_PRIORITIES: VIDEO_PRIORITIES,
    VIDEO_DIFFICULTIES: VIDEO_DIFFICULTIES, SCRIPT_STATUSES: SCRIPT_STATUSES, VIDEO_TEMPLATE_TYPES: VIDEO_TEMPLATE_TYPES,
    ASSET_TYPES: ASSET_TYPES, CALENDAR_EVENT_TYPES: CALENDAR_EVENT_TYPES, NOTE_SCOPES: NOTE_SCOPES,
    NOTE_PRIORITIES: NOTE_PRIORITIES, NOTE_STATUSES: NOTE_STATUSES, NOTE_COLOR_LABELS: NOTE_COLOR_LABELS,
    GLOBAL_TEMPLATE_KINDS: GLOBAL_TEMPLATE_KINDS, FAVORITE_TYPES: FAVORITE_TYPES,
    Channels: Channels, Videos: Videos, Scripts: Scripts, VideoTemplates: VideoTemplates,
    ChecklistTemplates: ChecklistTemplates, ChecklistInstances: ChecklistInstances, Notes: Notes, Sections: Sections,
    Assets: Assets, CalendarEvents: CalendarEvents, AnalyticsSnapshots: AnalyticsSnapshots, Tags: Tags,
    GlobalTemplates: GlobalTemplates, Favorites: Favorites,
    channelsSorted: channelsSorted, videosFor: videosFor, videosAll: videosAll,
    scriptForVideo: scriptForVideo, ensureScriptForVideo: ensureScriptForVideo,
    scriptWordCount: scriptWordCount, scriptReadingMinutes: scriptReadingMinutes,
    sectionsFor: sectionsFor, addSection: addSection, moveSection: moveSection, ensureDefaultSections: ensureDefaultSections,
    notesFor: notesFor, notesCountFor: notesCountFor,
    instantiateChecklist: instantiateChecklist, checklistProgress: checklistProgress, toggleChecklistItem: toggleChecklistItem,
    duplicateVideoTemplate: duplicateVideoTemplate, duplicateChecklistTemplate: duplicateChecklistTemplate,
    assetsFor: assetsFor, calendarEntriesFor: calendarEntriesFor,
    analyticsFor: analyticsFor, latestSnapshot: latestSnapshot, channelRollup: channelRollup, topVideos: topVideos,
    globalStats: globalStats, uploadStreak: uploadStreak,
    toggleFavorite: toggleFavorite, isFavorite: isFavorite, favoritesList: favoritesList,
    pushRecentlyViewed: pushRecentlyViewed, recentlyViewedList: recentlyViewedList,
    searchAll: searchAll, ensureAllDefaultsOnce: ensureAllDefaultsOnce,
    getHero: function () { return heroModel(storeGet(KEYS.hero)); },
    saveHero: function (patch) { var next = heroModel(Object.assign({}, heroModel(storeGet(KEYS.hero)), patch)); storeSet(KEYS.hero, next); return next; },
    VideoFiles: VideoFiles,
    fmtFileSize: function (bytes) {
      bytes = Number(bytes) || 0;
      if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
      if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
      if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
      return bytes + ' B';
    }
  };
})(window);
