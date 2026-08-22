/* =====================================================================
   promptarium-data.js — the data layer for Promptarium (promptarium.html),
   a prompt operating system: organize, reuse, improve and store prompts
   across every AI model.

   aitech.html was a PARALLEL build; it was deleted in the 2026-08-21
   tidy-up, so this is now the only prompt library in the app. It never
   read or wrote an 'aitech:' key, so nothing it holds was affected.

   RELATIONSHIP TO THE 'cdx:' ROW (codex-data.js): SHARED, on purpose.
   Promptarium's "Fiction" collection is not a copy — it IS the fiction
   prompt database. promptarium.html mounts a SECOND initCloudSync for
   appKey 'codex' / prefix 'cdx:'. codex.html was deleted on 2026-08-21;
   codex-data.js and that second mount MUST STAY, because the same row
   also holds cdx:trilogies/chapters/scenes — the manuscripts.

   Two hard rules follow from that, and both are enforced here:

     1. THIS FILE NEVER WRITES A 'cdx:' KEY ITSELF. Every fiction write
        goes through window.CodexData's own collections, so the Codex's
        own promptModel() is the only thing that ever shapes a cdx:
        record. Field drift is impossible by construction.

     2. codex-data.js's promptModel() is a WHITELIST of sixteen fields and
        makeCollection.update() re-runs it on every edit, so any field
        Promptarium adds to a cdx: record would be silently dropped the
        next time the Codex edited that prompt. Promptarium's extras
        (rating, purpose tags, creator, source, status) therefore live in
        a SIDECAR — prm:fictionMeta, keyed by prompt id.

   The write GATE that protects the Codex's row from a premature push
   lives in promptarium.html, not here, because it depends on sync state.
   See §CODEX GATE there. Nothing in this file may call CodexData at load
   time.

   Storage follows this app's established contract exactly:
     local-store-idb.js  → localStorage is an IndexedDB-backed shim
     sync.js             → initCloudSync({appKey:'promptarium', syncedPrefixes:['prm:']})
   Every key below is 'prm:'-prefixed. That prefix and 'cdx:' must stay
   DISJOINT — an overlap would make the two sync mounts push each other
   in a loop.
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
    prompts: 'prm:prompts',
    promptNotes: 'prm:promptNotes',
    fictionMeta: 'prm:fictionMeta',
    purposeTags: 'prm:purposeTags',
    collections: 'prm:collections',
    workflows: 'prm:workflows',
    workflowSteps: 'prm:workflowSteps',
    stepNotes: 'prm:stepNotes',
    collectionArticles: 'prm:collectionArticles',
    collectionNotes: 'prm:collectionNotes',
    uiState: 'prm:uiState',
    settings: 'prm:settings',
    seededAt: 'prm:seededAt'
  };

  // ============================================================
  // ID / DATE / TEXT HELPERS — same shapes as codex-data.js
  // ============================================================
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function nowISO() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  // "3 days ago" style, for the card metadata line.
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

  // ============================================================
  // §SANITISE
  //
  // The article and the collection notes accept PASTED HTML, so everything
  // that lands in them goes through here first. Two properties matter:
  //
  //   1. It parses with DOMParser, never `div.innerHTML`. A DOMParser
  //      document has no browsing context, so an `<img onerror=…>` in the
  //      pasted markup cannot fire while it is being parsed. Using a live
  //      element to "clean" hostile HTML executes it on the way in.
  //   2. It runs inside the data models below, so makeCollection.update()
  //      re-applies it on EVERY write. No code path — paste, toolbar,
  //      drag-drop, IME, a future feature — can get a dirty value into
  //      storage.
  //
  // `style` and `class` are stripped deliberately, not incidentally: it is
  // what keeps a guide pasted out of ChatGPT or a web page on Promptarium's
  // own palette instead of dragging in white backgrounds and Arial.
  // ============================================================
  var SAN_KEEP = {
    P:1, BR:1, H2:1, H3:1, H4:1, STRONG:1, EM:1, U:1, S:1,
    UL:1, OL:1, LI:1, BLOCKQUOTE:1, CODE:1, PRE:1, A:1, IMG:1, HR:1,
    FIGURE:1, FIGCAPTION:1
  };
  // Removed together with their subtree — their content is not worth
  // rescuing and is usually the payload.
  var SAN_DROP = {
    SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, LINK:1, META:1, BASE:1,
    NOSCRIPT:1, TEMPLATE:1, SVG:1, MATH:1, FORM:1, INPUT:1, BUTTON:1,
    SELECT:1, TEXTAREA:1, OPTION:1, AUDIO:1, VIDEO:1, SOURCE:1, TRACK:1,
    CANVAS:1, FRAME:1, FRAMESET:1, APPLET:1
  };
  var SAN_RENAME = { B:'STRONG', I:'EM', H1:'H2', H5:'H4', H6:'H4', STRIKE:'S', DEL:'S', MARK:'STRONG' };
  var SAN_ATTR = { A: ['href', 'title'], IMG: ['src', 'alt'] };
  var SAN_MAX_NODES = 4000, SAN_MAX_DEPTH = 12;

  function safeUrl(u, allowDataImage) {
    // Control characters are stripped first: "java\nscript:" and
    // "&#106;avascript:" both normalise to javascript: once the browser has
    // decoded the entity, so testing the raw string is not enough.
    var s = String(u == null ? '' : u).replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, '').trim();
    var low = s.toLowerCase();
    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 || low.indexOf('mailto:') === 0) return s;
    if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
    return '';
  }

  function sanitizeHtml(html) {
    var raw = String(html == null ? '' : html);
    if (!raw) return '';
    var doc;
    try {
      doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html');
    } catch (e) {
      return '<p>' + esc(raw) + '</p>';
    }
    var body = doc.body;
    if (!body) return '';

    // A paste bomb is a denial-of-service on the renderer and on the sync
    // payload alike. Past either cap, keep the words and throw away the
    // structure.
    if (body.getElementsByTagName('*').length > SAN_MAX_NODES) {
      return '<p>' + esc(body.textContent || '').slice(0, 20000) + '</p>';
    }

    function walk(node, depth) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 8) {                       // comment
          child.parentNode.removeChild(child);
        } else if (child.nodeType === 1) {
          var tag = child.tagName.toUpperCase();
          if (SAN_DROP[tag]) {
            child.parentNode.removeChild(child);
          } else if (depth > SAN_MAX_DEPTH) {
            unwrap(child);
          } else {
            if (SAN_RENAME[tag]) { child = rename(child, SAN_RENAME[tag]); tag = SAN_RENAME[tag]; }
            if (!SAN_KEEP[tag]) {
              walk(child, depth + 1);
              unwrap(child);
            } else {
              scrubAttrs(child, tag);
              if (tag === 'A' && !child.getAttribute('href')) { walk(child, depth + 1); unwrap(child); }
              else if (tag === 'IMG' && !child.getAttribute('src')) { child.parentNode.removeChild(child); }
              else walk(child, depth + 1);
            }
          }
        }
        child = next;
      }
    }
    function rename(el, tag) {
      var n = doc.createElement(tag);
      while (el.firstChild) n.appendChild(el.firstChild);
      el.parentNode.replaceChild(n, el);
      return n;
    }
    function unwrap(el) {
      var p = el.parentNode;
      if (!p) return;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
    }
    function scrubAttrs(el, tag) {
      var allow = SAN_ATTR[tag] || [];
      // Backwards: removeAttribute mutates the live NamedNodeMap. This one
      // pass is what kills every on*, style, class, srcset and formaction.
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var name = el.attributes[i].name;
        if (allow.indexOf(name.toLowerCase()) < 0) el.removeAttribute(name);
      }
      if (tag === 'A') {
        var href = safeUrl(el.getAttribute('href'), false);
        if (href) el.setAttribute('href', href); else el.removeAttribute('href');
      }
      if (tag === 'IMG') {
        var src = safeUrl(el.getAttribute('src'), true);
        if (src) el.setAttribute('src', src); else el.removeAttribute('src');
      }
    }

    walk(body, 0);
    return body.innerHTML.replace(/(<p>\s*<\/p>|<li>\s*<\/li>)/gi, '').trim();
  }

  /* Plain text out of rich HTML — used to make notes searchable and to
     decide whether an editor is visually empty. */
  function htmlToText(html) {
    try {
      // textContent runs block elements together — "<p>a</p><p>b</p>" reads
      // as "ab", which would merge words across paragraphs in search and in
      // previews. Give the block boundaries a space before parsing.
      var spaced = String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|figcaption|tr|td)>/gi, ' ');
      var d = new DOMParser().parseFromString('<!doctype html><body>' + spaced, 'text/html');
      return (d.body && d.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

  /* Canvas downscale, ported from the same helper every other data file in
     this app carries (aitech-data.js / codex-data.js). Per-file duplication
     is the house pattern here, not a shared module. Tuned larger than the
     thumbnail default because these are article-width reference images. */
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1400; quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(dataUrl); return; }
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(c.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  /* {{VARIABLE}} is the one thing worth picking out of a prompt at a
     glance — it is what you have to replace before pasting. Returned in
     first-appearance order, de-duplicated, so the variable console under
     the code block reads in the order you meet them. */
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
  // ============================================================

  /* Collections are the first tag axis — one page per AI model. 'fiction'
     is in this same array on purpose: it is what makes the rail, the
     library, the filters and the collection pages one code path instead
     of two. Its source is 'codex', which is the only thing that routes it
     to the shared cdx: store. */
  var SEED_COLLECTIONS = [
    { id: 'chatgpt',    label: 'ChatGPT',           icon: '💬', accent: '#6FE3B8', blurb: 'Fast reasoning, tables, rewrites and structured brainstorms.', source: 'prm', builtin: true, order: 0 },
    { id: 'claude',     label: 'Claude',            icon: '🪶', accent: '#F2A65A', blurb: 'Long documents, code review, careful prose and tone work.',    source: 'prm', builtin: true, order: 1 },
    { id: 'gemini',     label: 'Gemini',            icon: '✧', accent: '#7FB3FF', blurb: 'Grounded research, comparison grids, image prompt building.',   source: 'prm', builtin: true, order: 2 },
    { id: 'notebooklm', label: 'Gemini NotebookLM', icon: '📓', accent: '#C79BFF', blurb: 'Source-grounded answers over documents you actually uploaded.', source: 'prm', builtin: true, order: 3 },
    { id: 'suno',       label: 'Suno AI',           icon: '🎵', accent: '#FF8FB1', blurb: 'Style formulas, lyric skeletons, mood-to-genre translation.',   source: 'prm', builtin: true, order: 4 },
    { id: 'n8n',        label: 'n8n',               icon: '🔗', accent: '#8FE0E8', blurb: 'Workflow blueprints, node chains, error-handling branches.',    source: 'prm', builtin: true, order: 5 },
    /* order 5.5 slots Perplexity between n8n and Fiction WITHOUT rewriting
       Fiction's stored record — the collection order may already have been
       changed on a device, and byOrder is a numeric subtract, so a fraction
       sorts perfectly well. A sane default position, not a fixed one. */
    { id: 'perplexity', label: 'Perplexity',        icon: '🌐', accent: '#B6E06A', blurb: 'Cited answers, live-web research and follow-up chains you can check.', source: 'prm', builtin: true, order: 5.5 },
    /* The one collection that is a KIND OF WORK rather than a tool: the same
       build prompt gets run against Claude, ChatGPT or Gemini depending on the
       day, and filing it under whichever model happened to answer loses it.
       Slotted at 5.6 for exactly the reason Perplexity is at 5.5 — see above. */
    { id: 'aicoding',   label: 'AI Coding & Website Design', icon: '🖥️', accent: '#E79FE8', blurb: 'Scaffolds, components, refactors, and the design pass that follows.', source: 'prm', builtin: true, order: 5.6 },
    { id: 'fiction',    label: 'Fiction',           icon: '❦', accent: '#E6C77D', blurb: 'Held in its own shared database, alongside the manuscripts.', source: 'codex', builtin: true, order: 6 }
  ];

  /* Category is the broad TYPE of a prompt — what shape it is, not what
     it is for. Purpose tags (below) carry what it is for. */
  var PRM_CATEGORIES = [
    { id: 'task',      label: 'Task',           icon: '▶' },
    { id: 'system',    label: 'System Prompt',  icon: '⚙' },
    { id: 'template',  label: 'Template',       icon: '❏' },
    { id: 'persona',   label: 'Persona',        icon: '🎭' },
    { id: 'agent',     label: 'Agent / Chain',  icon: '⛓' },
    { id: 'research',  label: 'Research',       icon: '🔍' },
    { id: 'creative',  label: 'Creative',       icon: '✦' },
    { id: 'analysis',  label: 'Analysis',       icon: '📊' },
    { id: 'other',     label: 'Other',          icon: '·' }
  ];

  var PRM_STATUSES = [
    { id: 'draft',   label: 'Draft',   tone: 'mute' },
    { id: 'testing', label: 'Testing', tone: 'warn' },
    { id: 'working', label: 'Working', tone: 'good' },
    { id: 'retired', label: 'Retired', tone: 'bad'  }
  ];

  var PRM_CREATORS = [
    { id: 'me',        label: 'Me' },
    { id: 'ai',        label: 'AI-generated' },
    { id: 'community', label: 'Found / community' },
    { id: 'seed',      label: 'Shipped with the page' }
  ];

  var PRM_SORTS = [
    { id: 'newest',    label: 'Newest' },
    { id: 'mostUsed',  label: 'Most used' },
    { id: 'topRated',  label: 'Highest rated' },
    { id: 'edited',    label: 'Recently edited' },
    { id: 'alpha',     label: 'A–Z' }
  ];

  var TAG_COLORS = ['cyan', 'amber', 'mint', 'rose', 'violet', 'sky', 'lime', 'slate'];

  var ICON_SET = ['✦','✧','⚗️','🪶','💬','📓','🎵','🔗','▶','⚙','❏','🎭','⛓','🔍','📊','🧪','🧭','🗝️','📌','⭐','🌱','🔮','🧩','📐','🎯','🪄','📎','🫧'];

  /* Purpose tags are the SECOND axis, and unlike categories they are
     fully user-owned: add, rename, recolour, delete. Prompts reference
     tag IDs, never labels, so a rename propagates everywhere at once. */
  var SEED_PURPOSES = [
    { id: 'pt_ideation',   label: 'Ideation',    color: 'cyan',   order: 0 },
    { id: 'pt_drafting',   label: 'Drafting',    color: 'amber',  order: 1 },
    { id: 'pt_editing',    label: 'Editing',     color: 'mint',   order: 2 },
    { id: 'pt_research',   label: 'Research',    color: 'sky',    order: 3 },
    { id: 'pt_summarize',  label: 'Summarizing', color: 'violet', order: 4 },
    { id: 'pt_extract',    label: 'Extraction',  color: 'lime',   order: 5 },
    { id: 'pt_code',       label: 'Code',        color: 'rose',   order: 6 },
    { id: 'pt_automation', label: 'Automation',  color: 'slate',  order: 7 },
    { id: 'pt_music',      label: 'Music',       color: 'rose',   order: 8 },
    { id: 'pt_marketing',  label: 'Marketing',   color: 'amber',  order: 9 },
    { id: 'pt_analysis',   label: 'Analysis',    color: 'sky',    order: 10 },
    { id: 'pt_persona',    label: 'Persona',     color: 'violet', order: 11 }
  ];

  // ============================================================
  // MODELS
  // ============================================================
  function promptModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pp'),
      collection: d.collection || 'inbox',
      title: d.title || 'Untitled Prompt',
      icon: d.icon || '✦',
      text: d.text == null ? '' : String(d.text),
      category: d.category || 'task',
      tags: Array.isArray(d.tags) ? d.tags : [],
      purposeTags: Array.isArray(d.purposeTags) ? d.purposeTags : [],
      variables: Array.isArray(d.variables) ? d.variables : [],
      modelHint: d.modelHint || '',
      creator: d.creator || 'me',
      sourceUrl: d.sourceUrl || '',
      status: d.status || 'draft',
      rating: clamp(Number(d.rating) || 0, 0, 5),
      pinned: !!d.pinned,
      useCount: Number(d.useCount) || 0,
      lastUsedAt: d.lastUsedAt || '',
      capturedAt: d.capturedAt || '',
      order: d.order == null ? 0 : d.order,
      seedId: d.seedId || '',
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  /* One note model serves prompt notes and workflow-step notes alike —
     the parent ref is just a different field. That is what lets a single
     wirePromptNotes() in the page drive both. */
  function noteModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pn'),
      promptId: d.promptId || '',
      stepId: d.stepId || '',
      title: d.title || 'Note',
      body: d.body || '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }

  /* The collection notes DB and the article carry RICH bodies. The field is
     called bodyHtml, not body, and lives in its own store rather than being
     folded into noteModel above — deliberately. noteModel backs prm:promptNotes
     and prm:stepNotes, both of which are rendered through esc(); putting an
     HTML body into those arrays is an escaping bug one refactor away, and one
     of those arrays is shared live with The Codex. Separate store, separate
     field name, no overlap.

     sanitizeHtml runs HERE, so makeCollection.update() re-applies it on every
     write and nothing can get a dirty value into storage from any path. */
  function collectionNoteModel(d) {
    d = d || {};
    return {
      id: d.id || uid('cn'),
      collectionId: d.collectionId || '',
      title: d.title || 'Note',
      bodyHtml: typeof d.bodyHtml === 'string' ? sanitizeHtml(d.bodyHtml) : '',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  /* Title and subtitle are plain text on purpose: the Substack shape's
     ornamental divider is CSS, not content, and a plain title keeps the
     heading predictable. Only the body is rich. */
  function articleModel(d) {
    d = d || {};
    return {
      title: typeof d.title === 'string' ? d.title : '',
      subtitle: typeof d.subtitle === 'string' ? d.subtitle : '',
      bodyHtml: typeof d.bodyHtml === 'string' ? sanitizeHtml(d.bodyHtml) : '',
      updatedAt: d.updatedAt || ''
    };
  }

  function purposeTagModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pt'),
      label: d.label || 'Untitled',
      color: TAG_COLORS.indexOf(d.color) >= 0 ? d.color : 'cyan',
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }

  function collectionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('col'),
      label: d.label || 'Untitled',
      icon: d.icon || '✦',
      accent: d.accent || '#4FD6E8',
      blurb: d.blurb || '',
      source: d.source === 'codex' ? 'codex' : 'prm',
      builtin: !!d.builtin,
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }

  function workflowModel(d) {
    d = d || {};
    return {
      id: d.id || uid('wf'),
      title: d.title || 'Untitled Workflow',
      icon: d.icon || '⛓',
      summary: d.summary || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      purposeTags: Array.isArray(d.purposeTags) ? d.purposeTags : [],
      status: d.status || 'draft',
      rating: clamp(Number(d.rating) || 0, 0, 5),
      pinned: !!d.pinned,
      order: d.order == null ? 0 : d.order,
      seedId: d.seedId || '',
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  /* A step either LINKS a library prompt by promptRef ('prm:<id>' or
     'cdx:<id>'), in which case the code block renders that prompt's live
     text — improve the prompt, improve the chain — or it holds its own
     inline text. Both are kept: if a ref stops resolving (prompt deleted,
     or the Codex not hydrated yet) the inline text is the fallback, so a
     step is NEVER blank and the ref is NEVER auto-cleared. */
  function stepModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ws'),
      workflowId: d.workflowId || '',
      title: d.title || 'Untitled Step',
      model: d.model || '',
      promptRef: d.promptRef || '',
      text: d.text == null ? '' : String(d.text),
      expectedOutput: d.expectedOutput || '',
      done: !!d.done,
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || nowISO()
    };
  }

  // ============================================================
  // COLLECTIONS — makeCollection copied verbatim from codex-data.js:599
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

  var Prompts       = makeCollection(KEYS.prompts, promptModel);
  var PromptNotes   = makeCollection(KEYS.promptNotes, noteModel);
  var PurposeTags   = makeCollection(KEYS.purposeTags, purposeTagModel);
  var CollectionNotes = makeCollection(KEYS.collectionNotes, collectionNoteModel);
  var Collections   = makeCollection(KEYS.collections, collectionModel);
  var Workflows     = makeCollection(KEYS.workflows, workflowModel);
  var WorkflowSteps = makeCollection(KEYS.workflowSteps, stepModel);
  var StepNotes     = makeCollection(KEYS.stepNotes, noteModel);

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
  function collectionList() {
    var all = Collections.list();
    return (all.length ? all : SEED_COLLECTIONS.map(collectionModel)).slice().sort(byOrder);
  }
  function collectionById(id) {
    var all = collectionList();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function notesForPrompt(promptId) {
    return PromptNotes.list().filter(function (n) { return n.promptId === promptId; }).sort(byOrder);
  }
  function notesForStep(stepId) {
    return StepNotes.list().filter(function (n) { return n.stepId === stepId; }).sort(byOrder);
  }
  function stepsForWorkflow(workflowId) {
    return WorkflowSteps.list().filter(function (s) { return s.workflowId === workflowId; }).sort(byOrder);
  }
  function inboxCount() {
    return Prompts.list().filter(function (p) { return p.collection === 'inbox'; }).length;
  }
  function purposeTagById(id) {
    var all = PurposeTags.list();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* Deleting a purpose tag must not leave dangling ids anywhere it could
     have been used — native prompts, the fiction sidecar, and workflows. */
  function removePurposeTag(id) {
    var strip = function (arr) { return (arr || []).filter(function (t) { return t !== id; }); };
    var ps = Prompts.list(), pChanged = false;
    for (var i = 0; i < ps.length; i++) {
      if ((ps[i].purposeTags || []).indexOf(id) >= 0) { ps[i].purposeTags = strip(ps[i].purposeTags); pChanged = true; }
    }
    if (pChanged) Prompts.replaceAll(ps);

    var meta = fictionMetaAll(), mChanged = false;
    for (var k in meta) {
      if (meta[k] && (meta[k].purposeTags || []).indexOf(id) >= 0) { meta[k].purposeTags = strip(meta[k].purposeTags); mChanged = true; }
    }
    if (mChanged) storeSet(KEYS.fictionMeta, meta);

    var ws = Workflows.list(), wChanged = false;
    for (var j = 0; j < ws.length; j++) {
      if ((ws[j].purposeTags || []).indexOf(id) >= 0) { ws[j].purposeTags = strip(ws[j].purposeTags); wChanged = true; }
    }
    if (wChanged) Workflows.replaceAll(ws);

    return PurposeTags.remove(id);
  }

  function purposeTagUsage(id) {
    var n = 0;
    Prompts.list().forEach(function (p) { if ((p.purposeTags || []).indexOf(id) >= 0) n++; });
    var meta = fictionMetaAll();
    for (var k in meta) if (meta[k] && (meta[k].purposeTags || []).indexOf(id) >= 0) n++;
    Workflows.list().forEach(function (w) { if ((w.purposeTags || []).indexOf(id) >= 0) n++; });
    return n;
  }

  function removePrompt(id) {
    PromptNotes.removeWhere(function (n) { return n.promptId === id; });
    return Prompts.remove(id);
  }
  function removeWorkflow(id) {
    var steps = stepsForWorkflow(id);
    steps.forEach(function (s) { StepNotes.removeWhere(function (n) { return n.stepId === s.id; }); });
    WorkflowSteps.removeWhere(function (s) { return s.workflowId === id; });
    return Workflows.remove(id);
  }
  function removeStep(id) {
    StepNotes.removeWhere(function (n) { return n.stepId === id; });
    return WorkflowSteps.remove(id);
  }

  // ============================================================
  // §FICTION SIDECAR
  //
  // Promptarium-only metadata for prompts that live in the Codex's store.
  // An object map rather than a collection: access is always meta[id], and
  // whole-map last-write-wins is the same concurrency contract every other
  // key here already has.
  //
  // NOTE the deliberate absence of an auto-prune. A cdx: prompt missing
  // from the store may simply mean the Codex has not hydrated on this
  // device yet — deleting its metadata on that basis would throw away
  // ratings for no reason. Orphan cleanup is a manual action in Settings,
  // available only once the write gate is open.
  // ============================================================
  function fictionMetaAll() {
    var v = storeGet(KEYS.fictionMeta);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }

  // ============================================================
  // §COLLECTION CONTENT — the per-model guide and its notes DB.
  //
  // The article is an object map keyed by collection id, following the
  // fictionMeta precedent above: access is always articles[collectionId],
  // and whole-map last-write-wins is the same concurrency contract every
  // other key here already has.
  // ============================================================
  function articlesAll() {
    var v = storeGet(KEYS.collectionArticles);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }
  function articleFor(collectionId) {
    return articleModel(articlesAll()[collectionId]);
  }
  function setArticle(collectionId, patch) {
    if (!collectionId) return null;
    var all = articlesAll();
    var merged = articleModel(all[collectionId]);
    for (var k in patch) merged[k] = patch[k];
    merged.updatedAt = nowISO();
    all[collectionId] = articleModel(merged);
    storeSet(KEYS.collectionArticles, all);
    return all[collectionId];
  }
  function articleIsEmpty(a) {
    return !String(a.title || '').trim() && !String(a.subtitle || '').trim() && !htmlToText(a.bodyHtml);
  }
  function notesForCollection(collectionId) {
    return CollectionNotes.list()
      .filter(function (n) { return n.collectionId === collectionId; })
      .sort(byOrder);
  }
  function fictionMetaModel(d) {
    d = d || {};
    return {
      rating: clamp(Number(d.rating) || 0, 0, 5),
      purposeTags: Array.isArray(d.purposeTags) ? d.purposeTags : [],
      creator: d.creator || 'me',
      sourceUrl: d.sourceUrl || '',
      status: d.status || 'working',
      updatedAt: d.updatedAt || ''
    };
  }
  function fictionMetaFor(promptId) {
    return fictionMetaModel(fictionMetaAll()[promptId]);
  }
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
  function orphanFictionMetaIds(liveIds) {
    var live = {}; (liveIds || []).forEach(function (id) { live[id] = 1; });
    return Object.keys(fictionMetaAll()).filter(function (id) { return !live[id]; });
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
        console.error('[Promptarium] ' + (where || 'codex write') + ': these keys are not in the Codex prompt model ' +
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
      captureCollection: v.captureCollection || 'inbox',
      defaultSort: v.defaultSort || 'newest',
      showFictionInLibrary: v.showFictionInLibrary !== false
    };
  }
  function setSettings(patch) {
    var s = getSettings();
    for (var k in patch) s[k] = patch[k];
    storeSet(KEYS.settings, s);
    return s;
  }

  // ============================================================
  // §SEED
  //
  // Everything below is REAL, EDITABLE CONTENT, not a demo skin. Each
  // record carries a seedId, which is the only thing seedNow() matches
  // on — never a title, because retitling a seeded prompt is the first
  // thing you would do to make it yours, and matching on title would then
  // silently re-add it.
  //
  // Nothing is seeded into the 'fiction' collection: that collection is
  // the Codex's own store, and writing into it from here would be both a
  // gate violation and an uninvited edit to the user's manuscript row.
  // ============================================================

  var SEED_PROMPTS = [
    // ---- ChatGPT ----
    { seedId: 'sp_gpt_clarity', collection: 'chatgpt', title: 'Rewrite for Clarity', icon: '❏', category: 'template',
      purposeTags: ['pt_editing'], status: 'working',
      text: 'Rewrite the text below so a smart reader gets it on the first pass.\n\nRules:\n- Keep every fact and every number exactly as written.\n- Cut hedging, throat-clearing and filler.\n- Prefer concrete nouns and active verbs.\n- Keep the original register: {{REGISTER}}.\n- Target length: {{LENGTH}}.\n\nReturn only the rewrite, then a short bullet list of what you changed and why.\n\nTEXT:\n{{TEXT}}' },
    { seedId: 'sp_gpt_brainstorm', collection: 'chatgpt', title: 'Structured Brainstorm (10×)', icon: '✦', category: 'task',
      purposeTags: ['pt_ideation'], status: 'working',
      text: 'Give me 10 genuinely different approaches to: {{PROBLEM}}\n\nFor each one:\n1. A one-line name\n2. The core idea in two sentences\n3. Who it is best for\n4. The single biggest reason it would fail\n\nSpread them across the range — include at least two that are cheap and boring, and at least two that are uncomfortable. Do not rank them yet.' },
    { seedId: 'sp_gpt_table', collection: 'chatgpt', title: 'Table-ify This', icon: '📊', category: 'task',
      purposeTags: ['pt_extract', 'pt_analysis'], status: 'working',
      text: 'Turn the following into a markdown table.\n\nColumns: {{COLUMNS}}\n\nRules:\n- One row per distinct item.\n- If a cell is unknown, write "—" rather than guessing.\n- Do not add items that are not in the source.\n- After the table, list anything you could not fit into it.\n\nSOURCE:\n{{SOURCE}}' },
    { seedId: 'sp_gpt_devil', collection: 'chatgpt', title: "Devil's Advocate", icon: '🎭', category: 'persona',
      purposeTags: ['pt_analysis'], status: 'working',
      text: 'You are a sharp, fair-minded critic who wants this to succeed but refuses to flatter it.\n\nHere is my plan:\n{{PLAN}}\n\nGive me:\n1. The three strongest objections, strongest first\n2. For each, what evidence would settle it\n3. The one assumption that, if wrong, breaks everything\n4. What you would do instead, in two sentences\n\nNo praise. No summary of what I said back to me.' },

    // ---- Claude ----
    { seedId: 'sp_cl_synth', collection: 'claude', title: 'Long-Doc Synthesis', icon: '🪶', category: 'research',
      purposeTags: ['pt_summarize', 'pt_research'], status: 'working',
      text: 'Read the whole document before answering.\n\nProduce:\n1. The argument in five sentences\n2. The three claims doing the most work\n3. Anything asserted without support\n4. What a careful reader would still want to know\n5. Five quotes worth keeping, with their location\n\nDo not summarise section by section — synthesise across the whole thing.\n\nFocus: {{FOCUS}}\n\nDOCUMENT:\n{{DOCUMENT}}' },
    { seedId: 'sp_cl_review', collection: 'claude', title: 'Code Review Pass', icon: '⚙', category: 'task',
      purposeTags: ['pt_code'], status: 'working',
      text: 'Review this change like a senior engineer who has to maintain it.\n\nPriorities, in order:\n1. Correctness bugs — give a concrete failing input for each\n2. Cases the tests do not cover\n3. Simplifications that remove code\n4. Naming and readability\n\nSkip style nits the formatter would catch. If you are unsure whether something is a bug, say so explicitly rather than hedging into vagueness.\n\nLANGUAGE: {{LANGUAGE}}\n\nDIFF:\n{{DIFF}}' },
    { seedId: 'sp_cl_socratic', collection: 'claude', title: 'Socratic Explainer', icon: '🧭', category: 'persona',
      purposeTags: ['pt_research'], status: 'working',
      text: 'Teach me {{TOPIC}}, assuming I know {{BACKGROUND}} and nothing beyond it.\n\nMethod:\n- Start from something I already understand and build one step at a time.\n- After each step, ask me one question that would reveal whether I actually followed.\n- Wait for my answer before continuing.\n- When I get something wrong, do not just correct it — show me the reasoning that would have caught it.' },
    { seedId: 'sp_cl_tone', collection: 'claude', title: 'Tone Match', icon: '✦', category: 'template',
      purposeTags: ['pt_drafting', 'pt_editing'], status: 'working',
      text: 'Here is a sample of the voice I want:\n\n---\n{{VOICE_SAMPLE}}\n---\n\nFirst, describe that voice in six specific, checkable observations — sentence length, rhythm, diction, what it avoids, how it opens, how it closes. Do not use words like "engaging" or "conversational".\n\nThen write the following in that voice: {{BRIEF}}\n\nThen mark any line you are least confident matches, and say why.' },

    // ---- Gemini ----
    { seedId: 'sp_gm_research', collection: 'gemini', title: 'Grounded Research Brief', icon: '🔍', category: 'research',
      purposeTags: ['pt_research'], status: 'working',
      text: 'Research {{TOPIC}} and give me a brief I could act on.\n\nRequirements:\n- Cite a source for every factual claim, with a link.\n- Separate what is well established from what is contested from what is speculation.\n- Flag anything where sources disagree, and say who says what.\n- If the evidence is thin, say the evidence is thin — do not pad.\n\nEnd with the three questions I should answer next.' },
    { seedId: 'sp_gm_compare', collection: 'gemini', title: 'Compare & Contrast Grid', icon: '📊', category: 'analysis',
      purposeTags: ['pt_analysis'], status: 'working',
      text: 'Compare these options against each other: {{OPTIONS}}\n\nCriteria: {{CRITERIA}}\n\nGive me a markdown grid, then below it:\n- Which one wins on each individual criterion\n- Which one I should pick if my priority is {{PRIORITY}}\n- What would have to change for a different one to win' },
    { seedId: 'sp_gm_image', collection: 'gemini', title: 'Image Prompt Builder', icon: '🪄', category: 'template',
      purposeTags: ['pt_ideation'], status: 'working',
      text: 'Build me an image generation prompt for: {{SUBJECT}}\n\nCompose it in this order, as one flowing paragraph: subject and action, then setting, then lighting, then lens and framing, then colour palette, then medium and finish, then mood.\n\nThen give me three variants that change exactly one dimension each, and say which dimension each one moved.\n\nAvoid: {{AVOID}}' },

    // ---- NotebookLM ----
    { seedId: 'sp_nb_qa', collection: 'notebooklm', title: 'Source-Grounded Q&A', icon: '📓', category: 'research',
      purposeTags: ['pt_research'], status: 'working',
      text: 'Answer only from the sources in this notebook. If the answer is not in them, say "not in the sources" — do not fill the gap from general knowledge.\n\nQuestion: {{QUESTION}}\n\nFor each part of your answer, name the source it came from. Where two sources conflict, show both and say which is more recent.' },
    { seedId: 'sp_nb_study', collection: 'notebooklm', title: 'Study Guide From Sources', icon: '❏', category: 'template',
      purposeTags: ['pt_summarize'], status: 'working',
      text: 'Build a study guide from these sources covering {{SCOPE}}.\n\nInclude:\n1. The 10 concepts I must understand, each in one sentence\n2. The relationships between them, as a short outline\n3. 15 self-test questions, ordered easy to hard, with answers separated at the bottom\n4. The three things most likely to be misunderstood, and why\n\nEverything must trace to a source.' },
    { seedId: 'sp_nb_timeline', collection: 'notebooklm', title: 'Timeline Extraction', icon: '⛓', category: 'task',
      purposeTags: ['pt_extract'], status: 'working',
      text: 'Extract every dated event from the sources into a single chronological timeline.\n\nColumns: date, event, who was involved, source.\n\nRules:\n- Use the most precise date each source gives; if only a year is given, use the year.\n- Where sources disagree on a date, list both rows and mark them.\n- Do not infer dates that are not stated.\n\nThen note the largest gap in the timeline.' },

    // ---- Suno ----
    { seedId: 'sp_su_style', collection: 'suno', title: 'Style Prompt Formula', icon: '🎵', category: 'template',
      purposeTags: ['pt_music'], status: 'working',
      text: 'Write me a Suno style prompt for: {{VIBE}}\n\nCompose it as a comma-separated tag string in this order: genre, sub-genre, tempo/feel, lead instrumentation, rhythm section character, vocal type and delivery, production era and texture, mix character.\n\nKeep it under 200 characters. Then give me two alternates — one warmer, one colder — and say what each swap changes.' },
    { seedId: 'sp_su_lyric', collection: 'suno', title: 'Lyric Structure Skeleton', icon: '❏', category: 'template',
      purposeTags: ['pt_music', 'pt_drafting'], status: 'working',
      text: 'Draft a lyric skeleton about {{SUBJECT}} in a {{GENRE}} register.\n\nStructure it with explicit [Verse] / [Pre-Chorus] / [Chorus] / [Bridge] tags.\n\nRules:\n- The chorus must land the central image, not restate the title.\n- Each verse advances a situation; do not repeat the same idea twice.\n- Keep syllable counts consistent within each repeated section.\n- Give me two chorus options with different emotional temperatures.' },
    { seedId: 'sp_su_mood', collection: 'suno', title: 'Mood-Board to Genre Tags', icon: '✧', category: 'task',
      purposeTags: ['pt_music', 'pt_ideation'], status: 'working',
      text: 'I will describe a feeling in plain language. Translate it into music terms I can actually use as tags.\n\nFeeling: {{FEELING}}\nReference touchstones: {{TOUCHSTONES}}\n\nGive me:\n1. Three genre/sub-genre candidates, closest first\n2. The tempo range and time feel for each\n3. The instrument that carries the emotion in each\n4. One tag string per candidate, ready to paste' },

    // ---- n8n ----
    { seedId: 'sp_n8_explain', collection: 'n8n', title: 'Node Chain Explainer', icon: '🔗', category: 'task',
      purposeTags: ['pt_automation'], status: 'working',
      text: 'Explain what this n8n workflow actually does, step by step, to someone who has to debug it at 2am.\n\nFor each node: what comes in, what goes out, and what would make it fail.\n\nThen tell me:\n- Where the workflow silently drops data\n- Which nodes run more often than they need to\n- What is missing that a production workflow should have\n\nWORKFLOW JSON:\n{{WORKFLOW_JSON}}' },
    { seedId: 'sp_n8_blueprint', collection: 'n8n', title: 'Webhook → Enrich → Store Blueprint', icon: '⛓', category: 'agent',
      purposeTags: ['pt_automation'], status: 'working',
      text: 'Design an n8n workflow that takes {{TRIGGER}}, enriches it with {{ENRICHMENT}}, and stores the result in {{DESTINATION}}.\n\nGive me:\n1. The node list in order, with the node type for each\n2. The exact field mapping between each step\n3. Where to put the rate limit and why\n4. What to do with a record that fails enrichment — do not just drop it\n5. The test payload I should fire at it first' },
    { seedId: 'sp_n8_errors', collection: 'n8n', title: 'Error-Handling Branch', icon: '⚙', category: 'template',
      purposeTags: ['pt_automation'], status: 'working',
      text: 'Add proper error handling to this workflow: {{WORKFLOW_SUMMARY}}\n\nCover:\n- Which failures should retry, how many times, with what backoff\n- Which failures should stop the run immediately\n- Which should be logged and skipped so one bad record cannot halt a batch\n- Where the alert goes, and what it needs to say to be actionable\n\nGive me the branch structure, not prose.' }
  ];

  /* The seeded chain. It deliberately touches all six model collections,
     because the point of a chain page is that a real workflow crosses
     tools. Every step ships with promptRef:'' and inline text — never a
     seeded 'cdx:' ref, which would dangle on a device where the Codex
     has not loaded. */
  var SEED_WORKFLOW = {
    seedId: 'wf_idea_to_manuscript',
    title: 'Idea → Finished Fiction Manuscript',
    icon: '❦',
    summary: 'The whole road from a spark to a queryable manuscript. Fourteen steps across six tools — each one takes the previous step\'s output as its input, so the handoffs are the workflow. Edit every prompt here; it is yours.',
    purposeTags: ['pt_drafting', 'pt_ideation'],
    status: 'working',
    steps: [
      { title: 'Spark & Premise Test', model: 'claude',
        text: 'Here is a story idea: {{IDEA}}\n\nBefore I invest a year in it, stress-test it.\n\n1. State the premise back to me in one sentence, as a promise to the reader.\n2. What is the engine — the thing that keeps generating scenes rather than running out?\n3. Name three stories that already do this well, and what mine would have to do differently.\n4. What is the version of this idea that is 30% stranger and still works?\n5. The honest verdict: is there a book here, or a short story wearing a book\'s coat?',
        expectedOutput: 'A sharpened one-sentence premise, plus a go / reshape / drop call.' },
      { title: 'Market & Trope Scan', model: 'gemini',
        text: 'Research the current shelf for: {{PREMISE}}\n\nGrounded, with sources:\n- What is selling in this space right now, and who publishes it\n- The tropes readers of this category expect, and which are currently exhausted\n- Three comparable titles from the last four years, with why each compares\n- The cover and title conventions of the category\n\nEnd with: what my premise offers that the shelf does not already have.',
        expectedOutput: 'A comp list and a positioning gap to aim at.' },
      { title: 'Logline & Pitch Ladder', model: 'chatgpt',
        text: 'Build a pitch ladder for this book.\n\nPremise: {{PREMISE}}\nPositioning: {{POSITIONING}}\n\nGive me the same story at five lengths:\n1. Seven words\n2. One sentence (the logline — protagonist, want, obstacle, stakes)\n3. Three sentences (the back cover)\n4. One paragraph (the query hook)\n5. One page (the synopsis spine)\n\nEach must survive on its own. Do not simply pad the shorter one into the longer one.',
        expectedOutput: 'Five nested pitches, reusable for the query later.' },
      { title: 'World Bible Skeleton', model: 'claude',
        text: 'Build the world bible skeleton for: {{PREMISE}}\n\nCover only what the story will actually touch:\n- The rules — what is possible, what it costs, and what it cannot do\n- The three places scenes will happen, and what each one feels like\n- Who has power, who wants it, and how that shows up day to day\n- The history that is still causing problems in the present\n\nFor each rule, give me the scene it makes possible AND the scene it forbids. A rule with no consequence is decoration — cut it.',
        expectedOutput: 'A rules-with-consequences document, not an encyclopedia.' },
      { title: 'Character Dossiers & Wounds', model: 'claude',
        text: 'Build dossiers for the main cast of: {{PREMISE}}\n\nCast: {{CAST}}\n\nFor each character:\n- What they want, out loud\n- What they actually need, which they would deny\n- The wound that made those two different\n- What they are willing to do that a decent person would not\n- Their voice: one line of dialogue only they could say\n\nThen: for each pair, the argument they would have and who would win.',
        expectedOutput: 'Dossiers where want and need pull in different directions.' },
      { title: 'Beat Sheet / Structure Pass', model: 'chatgpt',
        text: 'Lay out the structure for this book.\n\nPremise: {{PREMISE}}\nCast: {{CAST}}\nWorld rules: {{RULES}}\n\nUse a {{STRUCTURE}} framework. For every beat give me:\n- What happens\n- What changes because of it — if nothing changes, flag the beat as dead\n- Which character drives it\n\nThen mark the two beats that are load-bearing, and tell me what breaks if either fails.',
        expectedOutput: 'A beat sheet where every beat changes something.' },
      { title: 'Chapter-by-Chapter Outline', model: 'claude',
        text: 'Expand this beat sheet into a chapter outline.\n\nBeat sheet: {{BEAT_SHEET}}\nTarget length: {{WORD_COUNT}} words across roughly {{CHAPTER_COUNT}} chapters.\n\nPer chapter: number, POV, where and when, what the reader learns, what changes, and the last line\'s job — the reason they turn the page.\n\nKeep chapter lengths uneven on purpose. Flag any run of three chapters where the tension does not move.',
        expectedOutput: 'A numbered outline with a page-turn reason per chapter.' },
      { title: 'Scene Card Expansion', model: 'chatgpt',
        text: 'Turn chapter {{CHAPTER}} of this outline into scene cards.\n\nOutline entry: {{CHAPTER_ENTRY}}\n\nPer scene: goal, conflict, outcome (yes-but / no-and), whose POV, what the reader knows that the POV does not, and the emotional temperature at open and at close.\n\nIf a scene\'s outcome is a flat yes, say so — that scene is not yet doing work.',
        expectedOutput: 'Scene cards ready to draft from without further thinking.' },
      { title: 'Draft-Zero Scene Engine', model: 'claude',
        text: 'Draft this scene at full length. Draft zero — I want it complete, not good.\n\nScene card: {{SCENE_CARD}}\nPOV and voice: {{VOICE}}\nWorld rules in play: {{RULES}}\n\nRules for you:\n- Stay in the POV\'s head; no camera cuts\n- Dialogue does at least two jobs at once\n- Do not summarise what should be dramatised\n- End on the beat the card specifies, not a tidy resolution\n\nAfter the draft, list what you invented that is not in the card, so I can approve or cut it.',
        expectedOutput: 'A full scene plus a list of invented details to ratify.' },
      { title: 'Continuity Audit', model: 'notebooklm',
        text: 'Using only the manuscript and the world bible in this notebook, audit continuity.\n\nFind:\n- Facts stated two different ways, with the location of each\n- Timeline impossibilities\n- Characters who know something before they were told\n- World rules used inconsistently\n- Names, titles and spellings that drift\n\nCite chapter and location for everything. Do not fix anything — just find it.',
        expectedOutput: 'A located, citable defect list.' },
      { title: 'Line & Prose Pass', model: 'claude',
        text: 'Line-edit this chapter. Preserve the voice — this is not a rewrite.\n\nVoice sample to preserve: {{VOICE_SAMPLE}}\n\nWork on:\n- Sentences that could lose a third of their words\n- Repeated constructions and tics\n- Filter words that hold the reader at arm\'s length\n- Rhythm: three same-length sentences in a row\n- Dialogue tags doing work the dialogue should do\n\nShow edits inline, and leave anything you are unsure about alone with a margin note instead.\n\nCHAPTER:\n{{CHAPTER_TEXT}}' ,
        expectedOutput: 'An edited chapter with uncertain calls flagged, not silently changed.' },
      { title: 'Blurb, Query & Synopsis', model: 'chatgpt',
        text: 'Write the submission package.\n\nPitch ladder: {{PITCH_LADDER}}\nFinished manuscript summary: {{SUMMARY}}\nComps: {{COMPS}}\n\nProduce:\n1. Back-cover blurb, ~150 words, ending on the hook not the resolution\n2. Query letter: hook paragraph, book paragraph, bio paragraph, housekeeping line\n3. Two-page synopsis that gives away the ending, in present tense\n\nNo rhetorical questions in the blurb. No "in a world where".',
        expectedOutput: 'A blurb, a query and a synopsis ready to send.' },
      { title: 'Soundtrack & Vibe Reel', model: 'suno',
        text: 'Write the theme for this book so I can hear the thing while I revise it.\n\nBook: {{PREMISE}}\nEmotional core: {{EMOTIONAL_CORE}}\nSetting texture: {{SETTING}}\n\nGive me a style tag string under 200 characters, plus a short lyric with [Verse]/[Chorus] tags drawn from the book\'s central image — not its plot.\n\nThen one alternate for the darkest act.',
        expectedOutput: 'A style string and lyric to generate a working theme.' },
      { title: 'Publishing Ops Automation', model: 'n8n',
        text: 'Design the workflow that runs my submission tracking so I stop doing it in a spreadsheet.\n\nNeeds:\n- Log each submission: agent, date, materials sent, response deadline\n- Nudge me when a deadline passes with no reply\n- Record responses and roll up a monthly stat line\n- Never send anything outward automatically\n\nGive me the node chain, the data shape, and where the manual approval gate goes.',
        expectedOutput: 'A node-by-node blueprint with a human gate before anything leaves.' }
    ]
  };

  /* Additive and one-shot. It matches on seedId only, so a seeded prompt
     you retitle stays yours; and because it runs only while prm:seededAt
     is unset, a seeded prompt you DELETE stays deleted. A partial seed
     (interrupted mid-write) is repaired on the next load, since seededAt
     would not have been written. */
  function seedNow() {
    if (storeGet(KEYS.seededAt)) return 0;
    var added = 0;

    if (Collections.list().length === 0) {
      Collections.replaceAll(SEED_COLLECTIONS.map(collectionModel));
      added += SEED_COLLECTIONS.length;
    }
    if (PurposeTags.list().length === 0) {
      PurposeTags.replaceAll(SEED_PURPOSES.map(purposeTagModel));
      added += SEED_PURPOSES.length;
    }

    var haveP = {};
    Prompts.list().forEach(function (p) { if (p.seedId) haveP[p.seedId] = 1; });
    var order = nextOrder(Prompts.list());
    SEED_PROMPTS.forEach(function (s) {
      if (haveP[s.seedId]) return;
      var rec = {};
      for (var k in s) rec[k] = s[k];
      rec.creator = 'seed';
      rec.variables = detectVariables(s.text);
      rec.order = order++;
      Prompts.add(rec);
      added++;
    });

    var haveW = {};
    Workflows.list().forEach(function (w) { if (w.seedId) haveW[w.seedId] = 1; });
    if (!haveW[SEED_WORKFLOW.seedId]) {
      var wf = Workflows.add({
        seedId: SEED_WORKFLOW.seedId,
        title: SEED_WORKFLOW.title,
        icon: SEED_WORKFLOW.icon,
        summary: SEED_WORKFLOW.summary,
        purposeTags: SEED_WORKFLOW.purposeTags,
        status: SEED_WORKFLOW.status,
        order: nextOrder(Workflows.list())
      });
      SEED_WORKFLOW.steps.forEach(function (s, i) {
        var step = WorkflowSteps.add({
          workflowId: wf.id, title: s.title, model: s.model,
          promptRef: '', text: s.text, expectedOutput: s.expectedOutput, order: i
        });
        StepNotes.add({
          stepId: step.id, order: 0, title: 'Handoff',
          body: 'Feeds step ' + (i + 2 <= SEED_WORKFLOW.steps.length ? (i + 2) : '—') +
                '. ' + s.expectedOutput + '\n\nWhat went wrong last time: '
        });
      });
      added += 1 + SEED_WORKFLOW.steps.length;
    }

    if (added) storeSet(KEYS.seededAt, Date.now());
    return added;
  }

  /* Race safety, the same shape every other page here uses (see
     vault-data.js:9137). On a fresh device the initial Supabase pull is
     still in flight at load; seeding straight away would write the seed
     locally and push it, duplicating whatever the remote row already
     held. So seed immediately only if a remote apply already happened,
     otherwise wait one beat for the pull, then seed only what is missing. */
  /* Additive, matched on id, and NEVER a replaceAll.
     seedNow() cannot do this job: on any already-seeded install it returns 0
     at its first line because prm:seededAt is set, and its collections branch
     additionally requires an empty store. So a collection added to
     SEED_COLLECTIONS after the first run would be invisible forever without
     this. Runs OUTSIDE the seededAt guard, and is idempotent by id. */
  function migrateCollections() {
    var stored = Collections.list();
    // Fresh device: seedNow() lays down the whole array, including anything
    // new. Adding here as well would duplicate it.
    if (!stored.length) return 0;
    var have = {};
    stored.forEach(function (c) { have[c.id] = 1; });
    var added = 0;
    SEED_COLLECTIONS.forEach(function (c) {
      if (have[c.id]) return;
      Collections.add(c);
      added++;
    });
    return added;
  }

  function maybeSeedAfterSyncAttempt(ref, onDone) {
    var run = function () {
      // migrateCollections runs even when seedNow short-circuits. Both are
      // inside the same deferral, so both inherit the pull-race guard: if the
      // remote lands after this, prm:collections is already in sync.js's
      // localDirtyKeys and applyRemote will skip it rather than clobber.
      var n = seedNow() + migrateCollections();
      if (n && typeof onDone === 'function') onDone(n);
    };
    if (ref && ref.applied) { run(); return; }
    setTimeout(run, 1200);
  }

  global.Promptarium = {
    KEYS: KEYS,
    storeGet: storeGet, storeSet: storeSet,
    uid: uid, nowISO: nowISO, todayISO: todayISO, fmtDate: fmtDate, fmtAgo: fmtAgo,
    esc: esc, clamp: clamp,
    detectVariables: detectVariables, fillVariables: fillVariables,
    sanitizeHtml: sanitizeHtml, htmlToText: htmlToText, safeUrl: safeUrl,
    compressImageDataUrl: compressImageDataUrl,

    PRM_CATEGORIES: PRM_CATEGORIES,
    PRM_STATUSES: PRM_STATUSES,
    PRM_CREATORS: PRM_CREATORS,
    PRM_SORTS: PRM_SORTS,
    TAG_COLORS: TAG_COLORS,
    ICON_SET: ICON_SET,
    SEED_COLLECTIONS: SEED_COLLECTIONS,

    promptModel: promptModel,
    noteModel: noteModel,
    workflowModel: workflowModel,
    stepModel: stepModel,

    Prompts: Prompts,
    PromptNotes: PromptNotes,
    PurposeTags: PurposeTags,
    Collections: Collections,
    Workflows: Workflows,
    WorkflowSteps: WorkflowSteps,
    StepNotes: StepNotes,

    byOrder: byOrder, nextOrder: nextOrder, reorderCollection: reorderCollection,
    collectionList: collectionList, collectionById: collectionById,
    notesForPrompt: notesForPrompt, notesForStep: notesForStep,
    stepsForWorkflow: stepsForWorkflow, inboxCount: inboxCount,
    purposeTagById: purposeTagById, removePurposeTag: removePurposeTag, purposeTagUsage: purposeTagUsage,
    removePrompt: removePrompt, removeWorkflow: removeWorkflow, removeStep: removeStep,

    CollectionNotes: CollectionNotes,
    notesForCollection: notesForCollection,
    articlesAll: articlesAll, articleFor: articleFor, setArticle: setArticle,
    articleIsEmpty: articleIsEmpty, articleModel: articleModel,
    migrateCollections: migrateCollections,

    fictionMetaAll: fictionMetaAll, fictionMetaFor: fictionMetaFor,
    setFictionMeta: setFictionMeta, dropFictionMeta: dropFictionMeta,
    orphanFictionMetaIds: orphanFictionMetaIds,
    CDX_PROMPT_FIELDS: CDX_PROMPT_FIELDS, assertCodexFields: assertCodexFields,

    getUiState: getUiState, setUiState: setUiState,
    getSettings: getSettings, setSettings: setSettings,

    SEED_PROMPTS: SEED_PROMPTS,
    SEED_WORKFLOW: SEED_WORKFLOW,
    seedNow: seedNow,
    maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt
  };

})(window);
