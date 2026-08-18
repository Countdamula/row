/* =====================================================================
   codex-data.js — the data layer for The Codex (codex.html), a writing
   dashboard for trilogies.

   RELATIONSHIP TO writing-dashboard.html / writing-dashboard-data.js:
   a PARALLEL build, not a replacement. The Codex owns its own namespace
   ('cdx:*') and its own Supabase row (appKey 'codex'), so it never reads
   or writes a single 'wds:' key. The two dashboards cannot affect each
   other's data, and the older one stays fully listed in the nav.

   It starts EMPTY on purpose — no seed, no demo rows. That is why there
   is no maybeSeedAfterSyncAttempt() race guard in here: nothing can be
   written before the first cloud pull lands, so nothing can lose to it.

   Storage follows this app's established contract exactly:
     local-store-idb.js  → localStorage is an IndexedDB-backed shim
     sync.js             → initCloudSync({appKey:'codex', syncedPrefixes:['cdx:']})
   Every key below is 'cdx:'-prefixed, so the single prefix rule covers
   the whole model with no per-key sync list to keep in step.

   Two deliberate departures from the older writing dashboard:
     - Prompts are a REAL collection (cdx:prompts + cdx:promptNotes), not
       a hardcoded array. They are user-created, editable, reorderable,
       synced, and carry unlimited long-form note blocks.
     - Manuscript text is markdown-lite (*italic*, **bold**, *** scene
       break, > quote). It is stored as plain text, so a chapter written
       before any of this existed is still valid input, and the renderer
       below is only ever applied at read/compile time.

   "Export to PDF" is the same precedent as every other export in this
   app: a print-formatted compiled view + window.print(), not a
   hand-rolled PDF byte generator.
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
      try { window.dispatchEvent(new CustomEvent('cdx:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('cdx:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  var KEYS = {
    trilogies: 'cdx:trilogies',
    books: 'cdx:books',
    acts: 'cdx:acts',
    chapters: 'cdx:chapters',
    scenes: 'cdx:scenes',
    prompts: 'cdx:prompts',
    promptNotes: 'cdx:promptNotes',
    sessions: 'cdx:sessions',
    characters: 'cdx:characters',
    lore: 'cdx:lore',
    sidebarPrefs: 'cdx:sidebarPrefs',
    compositionPrefs: 'cdx:compositionPrefs',
    manuscriptPrefs: 'cdx:manuscriptPrefs',
    uiState: 'cdx:uiState',
    settings: 'cdx:settings'
  };

  // ============================================================
  // ID / DATE HELPERS
  // ============================================================
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function isoDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return toISODate(d); }
  function daysBetween(isoA, isoB) {
    var a = new Date(isoA + 'T00:00:00'), b = new Date(isoB + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function nowISO() { return new Date().toISOString(); }

  // ============================================================
  // IMAGE / URL / TEXT HELPERS — the same canvas-downscale, http(s)-only
  // guard and escaping every other page in this app uses.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1600; quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        var c = document.createElement('canvas');
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
    var s = String(value);
    if (s.indexOf('data:image/') === 0) return true;
    try { var u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function wordCount(text) {
    var t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function charCount(text) { return String(text || '').length; }
  function readingMinutes(text) { return Math.max(1, Math.round(wordCount(text) / 220)); }
  function fmtWords(n) { return Number(n || 0).toLocaleString(); }
  function fmtCompact(n) {
    n = Number(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number(n))); }

  // ============================================================
  // MARKDOWN-LITE
  //
  // A deliberately tiny subset, chosen so a manuscript stays readable as
  // plain text and so nothing a novelist actually types gets mangled:
  //   *italic*   **bold**   ***  (scene break)   > blockquote
  // Escaping happens FIRST, so the input is never trusted as markup; the
  // tags below are the only ones this function can ever emit.
  // ============================================================
  function mdInline(text) {
    var s = escapeHtml(text);
    // Bold before italic — otherwise ** is eaten as two nested italics.
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    return s;
  }
  function mdToHtml(text, opts) {
    opts = opts || {};
    var breakGlyph = opts.sceneBreak || '⁂'; // ⁂ asterism
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], quote = [];
    function flushPara() {
      if (!para.length) return;
      out.push('<p>' + mdInline(para.join(' ')) + '</p>');
      para = [];
    }
    function flushQuote() {
      if (!quote.length) return;
      out.push('<blockquote>' + mdInline(quote.join(' ')) + '</blockquote>');
      quote = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (/^\*{3,}$/.test(trimmed) || /^#{3,}$/.test(trimmed)) {
        flushPara(); flushQuote();
        out.push('<div class="cx-scene-break">' + escapeHtml(breakGlyph) + '</div>');
      } else if (/^>\s?/.test(trimmed)) {
        flushPara();
        quote.push(trimmed.replace(/^>\s?/, ''));
      } else if (trimmed === '') {
        flushPara(); flushQuote();
      } else {
        flushQuote();
        para.push(trimmed);
      }
    }
    flushPara(); flushQuote();
    return out.join('\n');
  }
  // Strips the markers so word counts and .txt exports match what's on the page.
  function mdToPlain(text) {
    return String(text == null ? '' : text)
      .replace(/^\*{3,}$/gm, '⁂')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/^>\s?/gm, '');
  }

  // ============================================================
  // FIXED VOCABULARIES
  // ============================================================
  var GENRES = ['Romantasy', 'High Fantasy', 'Dark Fantasy', 'Fae & Court', 'Paranormal Romance',
    'Historical Romance', 'Gothic', 'Urban Fantasy', 'Science Fantasy', 'Contemporary', 'Other'];

  var TRILOGY_STATUSES = [
    { id: 'dreaming',  label: 'Dreaming',  tone: 'rose' },
    { id: 'outlining', label: 'Outlining', tone: 'gilt' },
    { id: 'drafting',  label: 'Drafting',  tone: 'gilt' },
    { id: 'revising',  label: 'Revising',  tone: 'rose' },
    { id: 'complete',  label: 'Complete',  tone: 'good' },
    { id: 'resting',   label: 'Resting',   tone: 'mute' }
  ];
  var BOOK_STATUSES = [
    { id: 'planned',   label: 'Planned',   tone: 'mute' },
    { id: 'outlining', label: 'Outlining', tone: 'gilt' },
    { id: 'drafting',  label: 'Drafting',  tone: 'gilt' },
    { id: 'revising',  label: 'Revising',  tone: 'rose' },
    { id: 'polishing', label: 'Polishing', tone: 'rose' },
    { id: 'complete',  label: 'Complete',  tone: 'good' }
  ];
  var CHAPTER_STATUSES = [
    { id: 'outline',  label: 'Outline',  tone: 'mute' },
    { id: 'drafting', label: 'Drafting', tone: 'gilt' },
    { id: 'revised',  label: 'Revised',  tone: 'rose' },
    { id: 'polished', label: 'Polished', tone: 'good' },
    { id: 'final',    label: 'Final',    tone: 'good' }
  ];
  var SCENE_STATUSES = [
    { id: 'idea',     label: 'Idea',     tone: 'mute' },
    { id: 'outlined', label: 'Outlined', tone: 'gilt' },
    { id: 'drafted',  label: 'Drafted',  tone: 'gilt' },
    { id: 'revised',  label: 'Revised',  tone: 'rose' },
    { id: 'final',    label: 'Final',    tone: 'good' }
  ];
  var REVISION_STATUSES = ['not started', 'first pass', 'second pass', 'line edit', 'polished', 'locked'];
  var POVS = ['First person', 'Third limited', 'Third omniscient', 'Dual POV', 'Multi POV', 'Second person'];
  var TENSES = ['Past', 'Present'];

  var PROMPT_CATEGORIES = [
    { id: 'drafting',   label: 'Drafting',        icon: '✒️' },
    { id: 'revision',   label: 'Revision',        icon: '✍️' },
    { id: 'line',       label: 'Line & Prose',    icon: '🪶' },
    { id: 'character',  label: 'Character',       icon: '🎭' },
    { id: 'romance',    label: 'Romance & Tension', icon: '🤍' },
    { id: 'worldbuild', label: 'Worldbuilding',   icon: '🗺️' },
    { id: 'plot',       label: 'Plot & Structure', icon: '🧭' },
    { id: 'dialogue',   label: 'Dialogue',        icon: '💬' },
    { id: 'continuity', label: 'Continuity',      icon: '🔗' },
    { id: 'blurb',      label: 'Blurb & Query',   icon: '📯' },
    { id: 'research',   label: 'Research',        icon: '🔮' },
    { id: 'other',      label: 'Other',           icon: '✦' }
  ];

  var LORE_CATEGORIES = [
    { id: 'realm',    label: 'Realms & Places',  icon: '🏰' },
    { id: 'court',    label: 'Courts & Houses',  icon: '⚔️' },
    { id: 'magic',    label: 'Magic & Power',    icon: '✨' },
    { id: 'creature', label: 'Creatures',        icon: '🐉' },
    { id: 'artifact', label: 'Artifacts',        icon: '🗝️' },
    { id: 'history',  label: 'History & Myth',   icon: '📜' },
    { id: 'custom',   label: 'Customs & Rites',  icon: '🕯️' },
    { id: 'other',    label: 'Other',            icon: '✦' }
  ];

  var CHARACTER_ROLES = ['Protagonist', 'Love interest', 'Antagonist', 'Rival', 'Mentor',
    'Ally', 'Family', 'Court', 'Wildcard', 'Minor'];

  // Icon palette for trilogies / books / acts / chapters / scenes. Small and
  // curated on purpose — a full emoji keyboard would make every chapter row
  // look different for no informational gain.
  var ICON_SET = ['📖', '✦', '🌙', '⚔️', '🏰', '🔥',
    '🤍', '🌹', '🗝️', '👑', '🦅', '🐉',
    '🌪️', '❄️', '🌊', '🌲', '🕯️', '🔮',
    '☀️', '⭐', '🪞', '🧵', '🎭', '💋',
    '🩸', '⚡', '🌌', '🕊️', '🏹', '💍'];

  // ------------------------------------------------------------
  // AMBIENT SCENES (Composition Mode)
  //
  // Every scene is drawn locally: `layers` is a stack of animated CSS
  // gradients and `fx` drives a canvas particle field. Nothing here
  // fetches anything, so a scene cannot arrive late, cannot 404, cannot
  // be blocked, and works with no network at all.
  //
  // This is a deliberate departure from stock-video backdrops. A curated
  // set of remote clips was built first and thrown away: the free CDNs
  // that host them either 403 hotlinked requests or silently repoint an
  // id at unrelated footage, which is worse than useless in a mode whose
  // entire job is to disappear. A background that renders in one frame
  // and always looks the same is the better instrument.
  //
  // Your OWN photo or video is the escape hatch — see the `custom` scene
  // below, fed by compositionPrefs.customUrl.
  //
  // `tint` is the mix-blend-multiply colour treatment; `scrim` is the
  // default darkness under the text; `warm` shifts the reading colour.
  // ------------------------------------------------------------
  var AMBIENT_SCENES = [
    {
      id: 'rain', name: 'Rain on Glass', blurb: 'Storm-light, running water',
      tint: '#1B2740', scrim: 0.46, warm: false, fx: 'rain',
      layers: [
        'radial-gradient(58% 44% at 74% 12%, rgba(140,172,220,0.30) 0%, transparent 64%)',
        'radial-gradient(120% 90% at 18% 4%, rgba(84,116,170,0.38) 0%, transparent 62%)',
        'radial-gradient(100% 70% at 60% 100%, rgba(30,44,72,0.66) 0%, transparent 60%)',
        'linear-gradient(178deg, #142033 0%, #0b1322 48%, #060a13 100%)'
      ]
    },
    {
      id: 'hearth', name: 'Hearthfire', blurb: 'Embers, low amber light',
      tint: '#3A1508', scrim: 0.44, warm: true, fx: 'embers',
      layers: [
        'radial-gradient(72% 58% at 50% 112%, rgba(255,158,58,0.60) 0%, transparent 62%)',
        'radial-gradient(52% 44% at 24% 96%, rgba(220,80,26,0.40) 0%, transparent 64%)',
        'radial-gradient(46% 40% at 78% 100%, rgba(198,62,20,0.32) 0%, transparent 62%)',
        'linear-gradient(180deg, #120602 0%, #1d0a03 58%, #3a1707 100%)'
      ]
    },
    {
      id: 'candle', name: 'Candlelit Desk', blurb: 'One flame, deep shadow',
      tint: '#3A2A0C', scrim: 0.40, warm: true, fx: 'flicker',
      layers: [
        'radial-gradient(30% 38% at 76% 30%, rgba(255,206,124,0.52) 0%, transparent 62%)',
        'radial-gradient(70% 74% at 76% 30%, rgba(180,112,36,0.26) 0%, transparent 66%)',
        'radial-gradient(140% 110% at 40% 70%, rgba(52,30,8,0.42) 0%, transparent 72%)',
        'linear-gradient(160deg, #130d05 0%, #0b0703 55%, #050302 100%)'
      ]
    },
    {
      id: 'snow', name: 'Snowfall at Dusk', blurb: 'Blue hour, drifting flakes',
      tint: '#22304A', scrim: 0.46, warm: false, fx: 'snow',
      layers: [
        'radial-gradient(90% 56% at 50% -8%, rgba(176,200,238,0.44) 0%, transparent 66%)',
        'radial-gradient(70% 52% at 10% 92%, rgba(74,102,148,0.34) 0%, transparent 62%)',
        'radial-gradient(60% 46% at 92% 78%, rgba(96,124,172,0.24) 0%, transparent 62%)',
        'linear-gradient(180deg, #1d2740 0%, #101827 55%, #070b12 100%)'
      ]
    },
    {
      id: 'library', name: 'Ancient Library', blurb: 'Dust in a shaft of light',
      tint: '#3A2A16', scrim: 0.42, warm: true, fx: 'motes',
      layers: [
        'linear-gradient(102deg, transparent 28%, rgba(232,196,128,0.30) 42%, rgba(232,196,128,0.10) 50%, transparent 60%)',
        'radial-gradient(70% 56% at 66% 4%, rgba(212,168,92,0.36) 0%, transparent 62%)',
        'radial-gradient(120% 90% at 30% 100%, rgba(26,18,8,0.70) 0%, transparent 64%)',
        'linear-gradient(180deg, #1d1509 0%, #130d06 55%, #090603 100%)'
      ]
    },
    {
      id: 'sea', name: 'Moonlit Sea', blurb: 'Silver water, slow swell',
      tint: '#16283A', scrim: 0.48, warm: false, fx: 'swell',
      layers: [
        'radial-gradient(16% 13% at 50% 15%, rgba(244,248,255,0.72) 0%, transparent 70%)',
        'radial-gradient(44% 34% at 50% 15%, rgba(198,220,246,0.26) 0%, transparent 66%)',
        'radial-gradient(150% 52% at 50% 96%, rgba(58,102,142,0.46) 0%, transparent 64%)',
        'linear-gradient(180deg, #0b1725 0%, #07101b 55%, #040810 100%)'
      ]
    },
    {
      id: 'mistwood', name: 'Mistwood', blurb: 'Fog between old trees',
      tint: '#1C2A22', scrim: 0.46, warm: false, fx: 'mist',
      layers: [
        'radial-gradient(110% 56% at 50% 82%, rgba(158,188,164,0.34) 0%, transparent 64%)',
        'radial-gradient(72% 64% at 20% 6%, rgba(78,112,92,0.38) 0%, transparent 62%)',
        'radial-gradient(60% 50% at 86% 22%, rgba(64,92,80,0.28) 0%, transparent 62%)',
        'linear-gradient(180deg, #101a14 0%, #0a1110 55%, #050908 100%)'
      ]
    },
    {
      id: 'aurora', name: 'Aurora', blurb: 'Night sky, slow ribbons',
      tint: '#1E1638', scrim: 0.44, warm: false, fx: 'aurora',
      layers: [
        'linear-gradient(96deg, transparent 18%, rgba(104,222,182,0.26) 34%, rgba(158,120,228,0.24) 52%, transparent 68%)',
        'radial-gradient(64% 40% at 30% 14%, rgba(102,214,178,0.30) 0%, transparent 62%)',
        'radial-gradient(56% 36% at 76% 26%, rgba(156,118,228,0.28) 0%, transparent 62%)',
        'linear-gradient(180deg, #0e0a1e 0%, #090716 55%, #04030c 100%)'
      ]
    },
    {
      id: 'custom', name: 'Your own', blurb: 'An image or video you choose',
      tint: '#1A1226', scrim: 0.50, warm: false, fx: 'none', custom: true,
      layers: [
        'radial-gradient(100% 80% at 30% 10%, rgba(var(--cx-gilt-rgb),0.14) 0%, transparent 62%)',
        'linear-gradient(180deg, #150E24 0%, #0B0614 100%)'
      ]
    }
  ];
  function ambientScene(id) {
    for (var i = 0; i < AMBIENT_SCENES.length; i++) if (AMBIENT_SCENES[i].id === id) return AMBIENT_SCENES[i];
    return AMBIENT_SCENES[0];
  }

  // Particle field configuration per fx. Consumed by the canvas engine in
  // codex.html; `null` means that scene is pure CSS.
  var FX_CONFIG = {
    rain:   { count: 260, kind: 'streak', color: '224,236,255', minLen: 14, maxLen: 40, speed: 14,  drift: -1.3, size: 1.1, alpha: 0.46 },
    snow:   { count: 130, kind: 'dot',    color: '236,244,255', minLen: 1,  maxLen: 3,  speed: 0.9, drift: 0.5,  sway: 26, size: 2.4, alpha: 0.62 },
    embers: { count: 90,  kind: 'glow',   color: '255,168,72',  minLen: 1,  maxLen: 2,  speed: -1.3, drift: 0.35, sway: 18, size: 2.1, alpha: 0.7 },
    motes:  { count: 110, kind: 'glow',   color: '242,222,178', minLen: 1,  maxLen: 2,  speed: -0.24, drift: 0.5, sway: 34, size: 1.7, alpha: 0.5 },
    mist:   { count: 16,  kind: 'cloud',  color: '176,200,184', minLen: 1,  maxLen: 2,  speed: -0.08, drift: 0.9, sway: 0,  size: 190, alpha: 0.11 },
    swell:  { count: 12,  kind: 'cloud',  color: '176,206,236', minLen: 1,  maxLen: 2,  speed: -0.05, drift: 1.1, sway: 0,  size: 220, alpha: 0.09 },
    flicker: null, aurora: null, none: null
  };

  function statusMeta(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id || '', label: id || '—', tone: 'mute' };
  }

  // ============================================================
  // MODELS
  // ============================================================
  function trilogyModel(d) {
    d = d || {};
    return {
      id: d.id || uid('tri'),
      title: d.title || 'Untitled Trilogy',
      subtitle: d.subtitle || '',
      icon: d.icon || '📖',
      cover: d.cover || '',
      genre: d.genre || 'Romantasy',
      status: d.status || 'dreaming',
      tagline: d.tagline || '',
      description: d.description || '',
      accent: d.accent || '',
      order: d.order == null ? 0 : d.order,
      archived: !!d.archived,
      createdAt: d.createdAt || nowISO()
    };
  }
  function bookModel(d) {
    d = d || {};
    return {
      id: d.id || uid('bk'),
      trilogyId: d.trilogyId || '',
      position: d.position == null ? 1 : clamp(d.position, 1, 9),
      title: d.title || 'Untitled Book',
      subtitle: d.subtitle || '',
      icon: d.icon || '✦',
      cover: d.cover || '',
      headerArt: d.headerArt || '',
      logline: d.logline || '',
      status: d.status || 'planned',
      revisionStatus: d.revisionStatus || 'not started',
      targetWords: d.targetWords == null ? 100000 : Number(d.targetWords) || 0,
      dailyGoal: d.dailyGoal == null ? 1000 : Number(d.dailyGoal) || 0,
      deadline: d.deadline || '',
      pov: d.pov || 'Third limited',
      tense: d.tense || 'Past',
      themes: Array.isArray(d.themes) ? d.themes : [],
      order: d.order == null ? 0 : d.order,
      archived: !!d.archived,
      currentChapterId: d.currentChapterId || '',
      lastEditedAt: d.lastEditedAt || '',
      createdAt: d.createdAt || nowISO()
    };
  }
  function actModel(d) {
    d = d || {};
    return {
      id: d.id || uid('act'),
      bookId: d.bookId || '',
      title: d.title || 'Act I',
      icon: d.icon || '',
      summary: d.summary || '',
      targetWords: Number(d.targetWords) || 0,
      order: d.order == null ? 0 : d.order
    };
  }
  function chapterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ch'),
      bookId: d.bookId || '',
      actId: d.actId || '',
      label: d.label || '',
      title: d.title || 'Untitled Chapter',
      icon: d.icon || '',
      headerArt: d.headerArt || '',
      headerArtPos: d.headerArtPos == null ? 50 : clamp(d.headerArtPos, 0, 100),
      order: d.order == null ? 0 : d.order,
      status: d.status || 'outline',
      pov: d.pov || '',
      location: d.location || '',
      content: d.content == null ? '' : String(d.content),
      summary: d.summary || '',
      notes: d.notes || '',
      wordGoal: Number(d.wordGoal) || 0,
      revisionStatus: d.revisionStatus || 'not started',
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }
  function sceneModel(d) {
    d = d || {};
    return {
      id: d.id || uid('sc'),
      chapterId: d.chapterId || '',
      title: d.title || 'New Scene',
      icon: d.icon || '',
      order: d.order == null ? 0 : d.order,
      status: d.status || 'idea',
      goal: d.goal || '',
      conflict: d.conflict || '',
      outcome: d.outcome || '',
      emotion: d.emotion || '',
      setting: d.setting || '',
      characterIds: Array.isArray(d.characterIds) ? d.characterIds : [],
      summary: d.summary || ''
    };
  }
  function promptModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pr'),
      scope: d.scope || 'book',          // 'global' | 'trilogy' | 'book'
      scopeId: d.scopeId || '',
      title: d.title || 'Untitled Prompt',
      icon: d.icon || '✒️',
      category: d.category || 'drafting',
      tags: Array.isArray(d.tags) ? d.tags : [],
      text: d.text == null ? '' : String(d.text),
      variables: Array.isArray(d.variables) ? d.variables : [],
      modelHint: d.modelHint || '',
      favorite: !!d.favorite,
      useCount: Number(d.useCount) || 0,
      lastUsedAt: d.lastUsedAt || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }
  function promptNoteModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pn'),
      promptId: d.promptId || '',
      title: d.title || 'Note',
      body: d.body || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }
  function sessionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ses'),
      bookId: d.bookId || '',
      trilogyId: d.trilogyId || '',
      date: d.date || todayISO(),
      words: Number(d.words) || 0,
      minutes: Number(d.minutes) || 0,
      mode: d.mode || 'normal'
    };
  }
  function characterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('cha'),
      trilogyId: d.trilogyId || '',
      name: d.name || 'Unnamed',
      icon: d.icon || '🎭',
      portrait: d.portrait || '',
      role: d.role || 'Ally',
      pronouns: d.pronouns || '',
      arc: d.arc || '',
      wants: d.wants || '',
      wound: d.wound || '',
      notes: d.notes || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }
  function loreModel(d) {
    d = d || {};
    return {
      id: d.id || uid('lo'),
      trilogyId: d.trilogyId || '',
      category: d.category || 'realm',
      title: d.title || 'Untitled Entry',
      icon: d.icon || '',
      cover: d.cover || '',
      body: d.body || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }

  // ============================================================
  // COLLECTIONS
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

  var Trilogies  = makeCollection(KEYS.trilogies, trilogyModel);
  var Books      = makeCollection(KEYS.books, bookModel);
  var Acts       = makeCollection(KEYS.acts, actModel);
  var Chapters   = makeCollection(KEYS.chapters, chapterModel);
  var Scenes     = makeCollection(KEYS.scenes, sceneModel);
  var Prompts    = makeCollection(KEYS.prompts, promptModel);
  var PromptNotes= makeCollection(KEYS.promptNotes, promptNoteModel);
  var Sessions   = makeCollection(KEYS.sessions, sessionModel);
  var Characters = makeCollection(KEYS.characters, characterModel);
  var Lore       = makeCollection(KEYS.lore, loreModel);

  function byOrder(a, b) {
    var d = (a.order || 0) - (b.order || 0);
    return d !== 0 ? d : String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }
  function nextOrder(records) {
    var max = -1;
    for (var i = 0; i < records.length; i++) if ((records[i].order || 0) > max) max = records[i].order || 0;
    return max + 1;
  }
  // Reassigns order = index from an ordered id array. This is the single
  // hook every drag-sort in codex.html persists through.
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
  // SELECTORS
  // ============================================================
  function trilogiesSorted() { return Trilogies.list().filter(function (t) { return !t.archived; }).sort(byOrder); }
  function archivedTrilogies() { return Trilogies.list().filter(function (t) { return t.archived; }).sort(byOrder); }
  function booksForTrilogy(trilogyId) {
    return Books.list().filter(function (b) { return b.trilogyId === trilogyId && !b.archived; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0) || byOrder(a, b); });
  }
  function actsForBook(bookId) { return Acts.list().filter(function (a) { return a.bookId === bookId; }).sort(byOrder); }
  function chaptersForBook(bookId) { return Chapters.list().filter(function (c) { return c.bookId === bookId; }).sort(byOrder); }
  function chaptersForAct(actId) { return Chapters.list().filter(function (c) { return c.actId === actId; }).sort(byOrder); }
  function unboundChapters(bookId) {
    var actIds = {};
    actsForBook(bookId).forEach(function (a) { actIds[a.id] = true; });
    return Chapters.list().filter(function (c) {
      return c.bookId === bookId && (!c.actId || !actIds[c.actId]);
    }).sort(byOrder);
  }
  function scenesForChapter(chapterId) { return Scenes.list().filter(function (s) { return s.chapterId === chapterId; }).sort(byOrder); }
  function notesForPrompt(promptId) { return PromptNotes.list().filter(function (n) { return n.promptId === promptId; }).sort(byOrder); }
  function charactersForTrilogy(trilogyId) { return Characters.list().filter(function (c) { return c.trilogyId === trilogyId; }).sort(byOrder); }
  function loreForTrilogy(trilogyId) { return Lore.list().filter(function (l) { return l.trilogyId === trilogyId; }).sort(byOrder); }
  function sessionsForBook(bookId) { return Sessions.list().filter(function (s) { return s.bookId === bookId; }); }

  // Prompts visible from a given book: its own, its trilogy's, and global.
  function promptsVisibleTo(bookId, trilogyId) {
    return Prompts.list().filter(function (p) {
      if (p.scope === 'global') return true;
      if (p.scope === 'trilogy') return !!trilogyId && p.scopeId === trilogyId;
      return !!bookId && p.scopeId === bookId;
    }).sort(byOrder);
  }

  // The manuscript in reading order: acts in order, their chapters in
  // order, then anything not bound to an act.
  function orderedChapters(bookId) {
    var out = [];
    actsForBook(bookId).forEach(function (a) {
      chaptersForAct(a.id).forEach(function (c) { if (c.bookId === bookId) out.push(c); });
    });
    unboundChapters(bookId).forEach(function (c) { out.push(c); });
    return out;
  }
  function adjacentChapter(chapterId, dir) {
    var ch = Chapters.get(chapterId);
    if (!ch) return null;
    var seq = orderedChapters(ch.bookId);
    for (var i = 0; i < seq.length; i++) {
      if (seq[i].id === chapterId) return seq[i + dir] || null;
    }
    return null;
  }
  function bookOfChapter(chapterId) {
    var ch = Chapters.get(chapterId);
    return ch ? Books.get(ch.bookId) : null;
  }

  // ============================================================
  // COMPUTED — words, progress, pace, streaks
  // ============================================================
  function bookWordCount(bookId) {
    return chaptersForBook(bookId).reduce(function (sum, c) { return sum + wordCount(c.content); }, 0);
  }
  function actWordCount(actId) {
    return chaptersForAct(actId).reduce(function (sum, c) { return sum + wordCount(c.content); }, 0);
  }
  function trilogyWordCount(trilogyId) {
    return booksForTrilogy(trilogyId).reduce(function (sum, b) { return sum + bookWordCount(b.id); }, 0);
  }
  function trilogyTargetWords(trilogyId) {
    return booksForTrilogy(trilogyId).reduce(function (sum, b) { return sum + (b.targetWords || 0); }, 0);
  }
  function totalWordCount() {
    return Chapters.list().reduce(function (sum, c) { return sum + wordCount(c.content); }, 0);
  }
  function bookProgress(bookId) {
    var b = Books.get(bookId);
    if (!b || !b.targetWords) return 0;
    return clamp(bookWordCount(bookId) / b.targetWords, 0, 1);
  }

  function wordsOnDate(iso, bookId) {
    return Sessions.list().reduce(function (sum, s) {
      if (s.date !== iso) return sum;
      if (bookId && s.bookId !== bookId) return sum;
      return sum + (s.words || 0);
    }, 0);
  }
  function wordsInLastNDays(n, bookId) {
    var total = 0;
    for (var i = 0; i < n; i++) total += wordsOnDate(isoDaysAgo(i), bookId);
    return total;
  }
  function writingStreak(bookId) {
    var streak = 0;
    for (var i = 0; i < 400; i++) {
      var w = wordsOnDate(isoDaysAgo(i), bookId);
      if (w > 0) { streak++; }
      else if (i > 0) { break; }        // today not written yet doesn't break a live streak
      else { continue; }
    }
    return streak;
  }
  function heatmap(days, bookId) {
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var iso = isoDaysAgo(i);
      out.push({ date: iso, words: wordsOnDate(iso, bookId) });
    }
    return out;
  }
  // Words/day over the days actually written in, not calendar days —
  // a week off shouldn't read as a collapse in pace.
  function averagePace(bookId, windowDays) {
    windowDays = windowDays || 30;
    var written = 0, total = 0;
    for (var i = 0; i < windowDays; i++) {
      var w = wordsOnDate(isoDaysAgo(i), bookId);
      if (w > 0) { written++; total += w; }
    }
    return written ? Math.round(total / written) : 0;
  }
  function projectedFinish(bookId) {
    var b = Books.get(bookId);
    if (!b || !b.targetWords) return null;
    var remaining = b.targetWords - bookWordCount(bookId);
    if (remaining <= 0) return { done: true, days: 0, date: todayISO() };
    var pace = averagePace(bookId, 30) || b.dailyGoal || 0;
    if (!pace) return null;
    var days = Math.ceil(remaining / pace);
    var d = new Date(); d.setDate(d.getDate() + days);
    var res = { done: false, days: days, date: toISODate(d), pace: pace, remaining: remaining };
    if (b.deadline) {
      res.deadlineDelta = daysBetween(res.date, b.deadline); // >0 = ahead of deadline
    }
    return res;
  }
  function chapterLengthStats(bookId) {
    var chs = chaptersForBook(bookId).map(function (c) { return { id: c.id, title: c.title, words: wordCount(c.content) }; });
    var written = chs.filter(function (c) { return c.words > 0; });
    if (!written.length) return { count: chs.length, avg: 0, longest: null, shortest: null, written: 0 };
    var sorted = written.slice().sort(function (a, b) { return a.words - b.words; });
    var total = written.reduce(function (s, c) { return s + c.words; }, 0);
    return {
      count: chs.length,
      written: written.length,
      avg: Math.round(total / written.length),
      shortest: sorted[0],
      longest: sorted[sorted.length - 1]
    };
  }
  function statusBreakdown(bookId) {
    var counts = {};
    CHAPTER_STATUSES.forEach(function (s) { counts[s.id] = 0; });
    chaptersForBook(bookId).forEach(function (c) {
      if (counts[c.status] == null) counts[c.status] = 0;
      counts[c.status]++;
    });
    return counts;
  }
  function sceneBreakdown(bookId) {
    var counts = {}, total = 0;
    SCENE_STATUSES.forEach(function (s) { counts[s.id] = 0; });
    chaptersForBook(bookId).forEach(function (c) {
      scenesForChapter(c.id).forEach(function (s) {
        if (counts[s.status] == null) counts[s.status] = 0;
        counts[s.status]++; total++;
      });
    });
    return { counts: counts, total: total };
  }

  // Upserts one session row per book+date, so a day of writing is a
  // single record no matter how many times autosave fires.
  function logProgress(bookId, trilogyId, deltaWords, minutes, mode) {
    if (!bookId || !deltaWords || deltaWords <= 0) return null;
    var iso = todayISO();
    var all = Sessions.list();
    for (var i = 0; i < all.length; i++) {
      if (all[i].bookId === bookId && all[i].date === iso) {
        return Sessions.update(all[i].id, {
          words: (all[i].words || 0) + deltaWords,
          minutes: (all[i].minutes || 0) + (minutes || 0),
          mode: mode || all[i].mode
        });
      }
    }
    return Sessions.add({ bookId: bookId, trilogyId: trilogyId || '', date: iso, words: deltaWords, minutes: minutes || 0, mode: mode || 'normal' });
  }

  // ============================================================
  // SINGLETONS
  // ============================================================
  var SIDEBAR_DEFAULTS = {
    width: 268, density: 'comfortable', showCounts: true, showStatus: true,
    showIcons: true, showCovers: false, showScenes: true, sortMode: 'manual',
    collapsedActIds: [], collapsed: false,
    // The floating icon rail, folded away to give the page its left
    // margin back. Chrome preference, so it lives here beside the
    // outline sidebar's own settings rather than in uiState.
    railCollapsed: false
  };
  var COMPOSITION_DEFAULTS = {
    sceneId: 'rain', scrim: 0.30, blur: 11, vignette: 0.44, textGlow: 0.5,
    panel: true, measure: 62, fontSize: 21, lineHeight: 1.95, typewriter: false,
    motion: true, timerMinutes: 25, sprintWords: 500, serif: true,
    customUrl: '', customKind: 'image'
  };
  // How the manuscript page itself is set — distinct from COMPOSITION_
  // DEFAULTS above (that is the full-screen writing mode) and from
  // SETTINGS.exportFont below (that is the compiled PDF). Three different
  // surfaces, three different preferences, and conflating any two of them
  // would mean changing how a manuscript prints by changing how it looks.
  //
  //   surface  'page'  a lit sheet on the scene — prose stays dark-on-light
  //            'scene' the whole column dark, pale prose on the photograph
  var MANUSCRIPT_DEFAULTS = {
    surface: 'page', font: 'garamond', fontSize: 20, lineHeight: 1.85, measure: 72
  };
  var SETTINGS_DEFAULTS = { dailyGoal: 1000, exportFont: 'garamond', exportTrim: 'letter', sceneBreak: '⁂' };

  function readSingleton(key, defaults) {
    var v = storeGet(key) || {};
    var out = {};
    for (var k in defaults) out[k] = (v[k] === undefined ? defaults[k] : v[k]);
    return out;
  }
  // Skips the write when nothing actually changed. These singletons are
  // touched on every render (ui state, sidebar prefs), and an
  // unconditional storeSet would schedule a cloud push — and therefore a
  // realtime echo and a re-render — on every navigation.
  function writeSingleton(key, defaults, patch) {
    var cur = readSingleton(key, defaults);
    var before = JSON.stringify(cur);
    for (var k in patch) cur[k] = patch[k];
    if (JSON.stringify(cur) === before) return cur;
    storeSet(key, cur);
    return cur;
  }
  function getSidebarPrefs() { return readSingleton(KEYS.sidebarPrefs, SIDEBAR_DEFAULTS); }
  function saveSidebarPrefs(patch) { return writeSingleton(KEYS.sidebarPrefs, SIDEBAR_DEFAULTS, patch); }
  function getCompositionPrefs() { return readSingleton(KEYS.compositionPrefs, COMPOSITION_DEFAULTS); }
  function saveCompositionPrefs(patch) { return writeSingleton(KEYS.compositionPrefs, COMPOSITION_DEFAULTS, patch); }
  function getManuscriptPrefs() { return readSingleton(KEYS.manuscriptPrefs, MANUSCRIPT_DEFAULTS); }
  function saveManuscriptPrefs(patch) { return writeSingleton(KEYS.manuscriptPrefs, MANUSCRIPT_DEFAULTS, patch); }
  function getSettings() { return readSingleton(KEYS.settings, SETTINGS_DEFAULTS); }
  function saveSettings(patch) { return writeSingleton(KEYS.settings, SETTINGS_DEFAULTS, patch); }
  function getUiState() { return readSingleton(KEYS.uiState, { lastTrilogyId: '', lastBookId: '', lastChapterId: '' }); }
  function saveUiState(patch) { return writeSingleton(KEYS.uiState, { lastTrilogyId: '', lastBookId: '', lastChapterId: '' }, patch); }

  // ============================================================
  // CASCADE DELETES
  // ============================================================
  function removeScene(id) { return Scenes.remove(id); }
  function removeChapter(id) {
    Scenes.removeWhere(function (s) { return s.chapterId === id; });
    Books.list().forEach(function (b) { if (b.currentChapterId === id) Books.update(b.id, { currentChapterId: '' }); });
    return Chapters.remove(id);
  }
  // Deleting an act frees its chapters instead of destroying them — the
  // prose is the valuable thing, the grouping is not.
  function removeAct(id) {
    Chapters.list().forEach(function (c) { if (c.actId === id) Chapters.update(c.id, { actId: '' }); });
    return Acts.remove(id);
  }
  function removeBook(id) {
    chaptersForBook(id).forEach(function (c) { Scenes.removeWhere(function (s) { return s.chapterId === c.id; }); });
    Chapters.removeWhere(function (c) { return c.bookId === id; });
    Acts.removeWhere(function (a) { return a.bookId === id; });
    Sessions.removeWhere(function (s) { return s.bookId === id; });
    Prompts.list().forEach(function (p) {
      if (p.scope === 'book' && p.scopeId === id) {
        PromptNotes.removeWhere(function (n) { return n.promptId === p.id; });
        Prompts.remove(p.id);
      }
    });
    return Books.remove(id);
  }
  function removeTrilogy(id) {
    booksForTrilogy(id).forEach(function (b) { removeBook(b.id); });
    Characters.removeWhere(function (c) { return c.trilogyId === id; });
    Lore.removeWhere(function (l) { return l.trilogyId === id; });
    Prompts.list().forEach(function (p) {
      if (p.scope === 'trilogy' && p.scopeId === id) {
        PromptNotes.removeWhere(function (n) { return n.promptId === p.id; });
        Prompts.remove(p.id);
      }
    });
    return Trilogies.remove(id);
  }
  function removePrompt(id) {
    PromptNotes.removeWhere(function (n) { return n.promptId === id; });
    return Prompts.remove(id);
  }

  // ============================================================
  // STRUCTURE HELPERS
  // ============================================================
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function romanize(n) { return ROMAN[n - 1] || String(n); }

  // Full Roman numeral, for folio marks — romanize() only covers I–XII.
  function toRoman(n) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n) return '—';
    var table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    for (var i = 0; i < table.length; i++) {
      while (n >= table[i][0]) { out += table[i][1]; n -= table[i][0]; }
    }
    return out;
  }

  // The hero's folio mark — this app's answer to a film timecode.
  // "MS. II · FOL. XLVII" reads as manuscript two, leaf forty-seven.
  function folio(bookPosition, leaf) {
    var parts = [];
    if (bookPosition) parts.push('MS. ' + toRoman(bookPosition));
    parts.push('FOL. ' + toRoman(leaf));
    return parts.join(' · ');
  }

  function addAct(bookId, title) {
    var existing = actsForBook(bookId);
    return Acts.add({
      bookId: bookId,
      title: title || ('Act ' + romanize(existing.length + 1)),
      order: nextOrder(existing)
    });
  }
  function addChapter(bookId, actId, title) {
    var siblings = actId ? chaptersForAct(actId) : unboundChapters(bookId);
    var n = chaptersForBook(bookId).length + 1;
    return Chapters.add({
      bookId: bookId, actId: actId || '',
      label: 'Chapter ' + n,
      title: title || ('Chapter ' + n),
      order: nextOrder(siblings)
    });
  }
  function addScene(chapterId, title) {
    var siblings = scenesForChapter(chapterId);
    return Scenes.add({ chapterId: chapterId, title: title || ('Scene ' + (siblings.length + 1)), order: nextOrder(siblings) });
  }
  // ============================================================
  // HOUSE ART — the photographs the heroes are built on.
  //
  // ART.codex, ART.trilogy, ART.book and ART.chapter are fixed: the four
  // banners are house furniture and never change with content. The last two
  // are DEFAULTS rather than the only answer — a book or chapter with its
  // own `headerArt` set by hand still wears it, because that field exists
  // for exactly that. What they replaced was the old fallback chain, which
  // reached for the book's cover and then the trilogy's, so a page with no
  // art of its own opened wearing a picture chosen for something else.
  // ART.covers is a rotation: a series with no cover art of its own gets
  // one by its place in the order the trilogies were created, so two
  // series made back to back never wear the same picture.
  //
  // This resolves at render time and is never written to the record. A
  // stored default would have to be backfilled onto trilogies that
  // already exist — a sync write for something that is only a fallback —
  // and it would then survive as a stale value if the house art changed.
  // Keying on createdAt rather than `order` means dragging the shelf
  // around does not reshuffle everyone's cover.
  // ============================================================
  var ART = {
    codex: 'images_by_admin/codex/codex-hero.jpg',
    trilogy: 'images_by_admin/codex/trilogy-hero.jpg',
    book: 'images_by_admin/codex/book-hero.jpg',
    chapter: 'images_by_admin/codex/chapter-hero.jpg',
    covers: [
      'images_by_admin/codex/cover-moth.jpg',
      'images_by_admin/codex/cover-fae.jpg'
    ]
  };
  function coverArtFor(t) {
    if (!t) return ART.covers[0];
    if (t.cover) return t.cover;
    var seq = Trilogies.list().slice().sort(function (a, b) {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
        String(a.id).localeCompare(String(b.id));
    });
    var i = seq.findIndex(function (x) { return x.id === t.id; });
    return ART.covers[(i < 0 ? 0 : i) % ART.covers.length];
  }

  // Creates a trilogy already shaped like a trilogy: three books, each
  // with three acts. Empty of prose, but never an empty screen.
  function scaffoldTrilogy(data) {
    var t = Trilogies.add(Object.assign({ order: nextOrder(Trilogies.list()) }, data || {}));
    var names = ['Book One', 'Book Two', 'Book Three'];
    for (var i = 0; i < 3; i++) {
      var b = Books.add({
        trilogyId: t.id, position: i + 1, title: names[i],
        order: i, status: i === 0 ? 'outlining' : 'planned'
      });
      for (var a = 1; a <= 3; a++) addAct(b.id, 'Act ' + romanize(a));
    }
    return t;
  }

  // ============================================================
  // COMPILE — plain text / markdown / print HTML
  // ============================================================
  function compileUnits(scope, id) {
    // Returns [{ kind:'book'|'act'|'chapter', ... }] in reading order.
    var units = [];
    if (scope === 'chapter') {
      var ch = Chapters.get(id);
      if (ch) units.push({ kind: 'chapter', chapter: ch });
      return units;
    }
    if (scope === 'act') {
      var act = Acts.get(id);
      if (!act) return units;
      units.push({ kind: 'act', act: act });
      chaptersForAct(act.id).forEach(function (c) { units.push({ kind: 'chapter', chapter: c }); });
      return units;
    }
    if (scope === 'book') {
      var b = Books.get(id);
      if (!b) return units;
      units.push({ kind: 'book', book: b });
      actsForBook(b.id).forEach(function (a) {
        units.push({ kind: 'act', act: a });
        chaptersForAct(a.id).forEach(function (c) { units.push({ kind: 'chapter', chapter: c }); });
      });
      unboundChapters(b.id).forEach(function (c) { units.push({ kind: 'chapter', chapter: c }); });
      return units;
    }
    if (scope === 'trilogy') {
      booksForTrilogy(id).forEach(function (b) {
        compileUnits('book', b.id).forEach(function (u) { units.push(u); });
      });
      return units;
    }
    return units;
  }
  function compileToText(scope, id) {
    var settings = getSettings();
    return compileUnits(scope, id).map(function (u) {
      if (u.kind === 'book') return '\n\n' + (u.book.title || '').toUpperCase() + '\n' + '='.repeat(Math.max(3, (u.book.title || '').length)) + '\n';
      if (u.kind === 'act') return '\n\n' + (u.act.title || '') + '\n';
      var c = u.chapter;
      return '\n\n' + (c.title || '') + '\n\n' + mdToPlain(c.content);
    }).join('').trim() + '\n';
  }
  function compileToMarkdown(scope, id) {
    return compileUnits(scope, id).map(function (u) {
      if (u.kind === 'book') return '\n\n# ' + (u.book.title || '') + '\n';
      if (u.kind === 'act') return '\n\n## ' + (u.act.title || '') + '\n';
      var c = u.chapter;
      return '\n\n### ' + (c.title || '') + '\n\n' + (c.content || '');
    }).join('').trim() + '\n';
  }
  function compileToPrintHtml(scope, id) {
    var settings = getSettings();
    var parts = [];
    compileUnits(scope, id).forEach(function (u) {
      if (u.kind === 'book') {
        parts.push('<section class="cx-pr-title"><h1>' + escapeHtml(u.book.title) + '</h1>' +
          (u.book.subtitle ? '<p class="cx-pr-sub">' + escapeHtml(u.book.subtitle) + '</p>' : '') +
          (u.book.logline ? '<p class="cx-pr-log">' + escapeHtml(u.book.logline) + '</p>' : '') +
          '</section>');
      } else if (u.kind === 'act') {
        parts.push('<section class="cx-pr-act"><h2>' + escapeHtml(u.act.title) + '</h2>' +
          (u.act.summary ? '<p class="cx-pr-sub">' + escapeHtml(u.act.summary) + '</p>' : '') + '</section>');
      } else {
        var c = u.chapter;
        parts.push('<section class="cx-pr-chapter"><h3>' + escapeHtml(c.title) + '</h3>' +
          mdToHtml(c.content, { sceneBreak: settings.sceneBreak }) + '</section>');
      }
    });
    return parts.join('\n');
  }

  // ============================================================
  // EXPORT
  // ============================================================
  var API = {
    KEYS: KEYS,
    storeGet: storeGet, storeSet: storeSet,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo, toISODate: toISODate,
    daysBetween: daysBetween, fmtDate: fmtDate, nowISO: nowISO,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl,
    escapeHtml: escapeHtml, wordCount: wordCount, charCount: charCount,
    readingMinutes: readingMinutes, fmtWords: fmtWords, fmtCompact: fmtCompact, clamp: clamp,

    mdInline: mdInline, mdToHtml: mdToHtml, mdToPlain: mdToPlain,

    GENRES: GENRES, TRILOGY_STATUSES: TRILOGY_STATUSES, BOOK_STATUSES: BOOK_STATUSES,
    CHAPTER_STATUSES: CHAPTER_STATUSES, SCENE_STATUSES: SCENE_STATUSES,
    REVISION_STATUSES: REVISION_STATUSES, POVS: POVS, TENSES: TENSES,
    PROMPT_CATEGORIES: PROMPT_CATEGORIES, LORE_CATEGORIES: LORE_CATEGORIES,
    CHARACTER_ROLES: CHARACTER_ROLES, ICON_SET: ICON_SET,
    AMBIENT_SCENES: AMBIENT_SCENES, ambientScene: ambientScene, FX_CONFIG: FX_CONFIG,
    statusMeta: statusMeta,

    Trilogies: Trilogies, Books: Books, Acts: Acts, Chapters: Chapters, Scenes: Scenes,
    Prompts: Prompts, PromptNotes: PromptNotes, Sessions: Sessions,
    Characters: Characters, Lore: Lore,
    byOrder: byOrder, nextOrder: nextOrder, reorderCollection: reorderCollection,

    trilogiesSorted: trilogiesSorted, archivedTrilogies: archivedTrilogies,
    booksForTrilogy: booksForTrilogy, actsForBook: actsForBook,
    chaptersForBook: chaptersForBook, chaptersForAct: chaptersForAct,
    unboundChapters: unboundChapters, scenesForChapter: scenesForChapter,
    notesForPrompt: notesForPrompt, charactersForTrilogy: charactersForTrilogy,
    loreForTrilogy: loreForTrilogy, sessionsForBook: sessionsForBook,
    promptsVisibleTo: promptsVisibleTo, orderedChapters: orderedChapters,
    adjacentChapter: adjacentChapter, bookOfChapter: bookOfChapter,

    bookWordCount: bookWordCount, actWordCount: actWordCount,
    trilogyWordCount: trilogyWordCount, trilogyTargetWords: trilogyTargetWords,
    totalWordCount: totalWordCount, bookProgress: bookProgress,
    wordsOnDate: wordsOnDate, wordsInLastNDays: wordsInLastNDays,
    writingStreak: writingStreak, heatmap: heatmap, averagePace: averagePace,
    projectedFinish: projectedFinish, chapterLengthStats: chapterLengthStats,
    statusBreakdown: statusBreakdown, sceneBreakdown: sceneBreakdown,
    logProgress: logProgress,

    getSidebarPrefs: getSidebarPrefs, saveSidebarPrefs: saveSidebarPrefs,
    getManuscriptPrefs: getManuscriptPrefs, saveManuscriptPrefs: saveManuscriptPrefs,
    getCompositionPrefs: getCompositionPrefs, saveCompositionPrefs: saveCompositionPrefs,
    getSettings: getSettings, saveSettings: saveSettings,
    getUiState: getUiState, saveUiState: saveUiState,

    removeScene: removeScene, removeChapter: removeChapter, removeAct: removeAct,
    removeBook: removeBook, removeTrilogy: removeTrilogy, removePrompt: removePrompt,

    romanize: romanize, toRoman: toRoman, folio: folio,
    addAct: addAct, addChapter: addChapter, addScene: addScene,
    ART: ART,
    coverArtFor: coverArtFor,
    scaffoldTrilogy: scaffoldTrilogy,

    compileUnits: compileUnits, compileToText: compileToText,
    compileToMarkdown: compileToMarkdown, compileToPrintHtml: compileToPrintHtml
  };

  global.CodexData = API;

})(window);
