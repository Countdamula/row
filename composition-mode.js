// =============================================================
// composition-mode.js — a fullscreen, cinematic distraction-free writing
// environment for the Writing Dashboard, in the spirit of Scrivener
// Composition Mode / iA Writer Focus Mode / Ulysses / Wallpaper Engine.
//
// Self-contained kit (own IIFE, own DOM, own <style> consumed from
// composition-mode.css) exposing exactly one thing to the host page:
//   window.CompositionMode.open(chapterId, bookId)
//   window.CompositionMode.close()
//
// It reads/writes through window.WritingDashboardData (loaded earlier in
// <head> — see writing-dashboard-data.js) exactly the way every tab of
// writing-dashboard.html already does, so a chapter edited here and a
// chapter edited in the plain Editor tab are always the same underlying
// record — there is no separate "Composition Mode document."
//
// The two bridge hooks this relies on from writing-dashboard.html itself
// (a separate closure — see its own "Composition Mode bridge" comment):
//   window.WD_activeChapterContext() -> {chapterId, bookId} | null
//   window.WD_refreshEditorTab()     -> re-renders the Editor tab so it
//                                        reflects whatever was just typed
// =============================================================
(function () {
  'use strict';
  if (window.CompositionMode) return;

  function WD() { return window.WritingDashboardData; }
  function gid(id) { return document.getElementById(id); }
  function esc(s) { return WD().escapeHtml(s); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  function fmtTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = totalSeconds % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  // ============================================================
  // FONT STACKS — Google Fonts loaded in writing-dashboard.html's <head>
  // (see the Composition Mode typography <link> next to the page's own
  // Playfair/Poppins import). Bookerly is a proprietary Kindle font with
  // no free web-embeddable source, so it degrades to a close Georgia-led
  // serif stack rather than silently pretending to load it.
  // ============================================================
  var FONT_STACKS = {
    'Cormorant Garamond': '"Cormorant Garamond", Georgia, serif',
    'EB Garamond': '"EB Garamond", Garamond, Georgia, serif',
    'Literata': '"Literata", Georgia, serif',
    'Merriweather': '"Merriweather", Georgia, serif',
    'Lora': '"Lora", Georgia, serif',
    'Inter': '"Inter", -apple-system, sans-serif',
    'IBM Plex Serif': '"IBM Plex Serif", Georgia, serif',
    'JetBrains Mono': '"JetBrains Mono", ui-monospace, monospace',
    'Bookerly': 'Bookerly, Georgia, "Times New Roman", serif',
    'Georgia': 'Georgia, serif',
    'Times New Roman': '"Times New Roman", Times, serif'
  };

  var THEME_PRESETS = {
    manuscript: { font: 'Literata', fontSize: 19, lineHeight: 1.7, letterSpacing: 0, justification: 'left', textWidth: 680 },
    typewriter: { font: 'JetBrains Mono', fontSize: 16, lineHeight: 1.8, letterSpacing: 0, justification: 'left', textWidth: 620 },
    classic: { font: 'Georgia', fontSize: 18, lineHeight: 1.65, letterSpacing: 0, justification: 'justify', textWidth: 640 },
    editorial: { font: 'EB Garamond', fontSize: 20, lineHeight: 1.75, letterSpacing: 0.01, justification: 'left', textWidth: 700 },
    dense: { font: 'IBM Plex Serif', fontSize: 16, lineHeight: 1.55, letterSpacing: 0, justification: 'left', textWidth: 760 }
  };

  var TOOLBAR_ITEMS = [
    { key: 'bg', icon: '🖼️', title: 'Background' },
    { key: 'video', icon: '🎬', title: 'Video Background' },
    { key: 'music', icon: '🎵', title: 'Ambient Audio' },
    { key: 'font', icon: '🔤', title: 'Typography' },
    { key: 'glass', icon: '🧊', title: 'Glass Panel & Overlay' },
    { key: 'focus', icon: '🎯', title: 'Focus Mode' },
    { key: 'timer', icon: '⏱️', title: 'Session Timer' },
    { key: 'wordgoal', icon: '🏁', title: 'Word Goal HUD' },
    { key: 'presets', icon: '💾', title: 'Scene Presets' },
    { key: 'ai', icon: '✨', title: 'AI Scene Generator' },
    { key: 'sep1', sep: true },
    { key: 'zen', icon: '🧘', title: 'Zen Mode', toggle: true },
    { key: 'reading', icon: '👁️', title: 'Reading Mode', toggle: true },
    { key: 'help', icon: '❔', title: 'Shortcuts (Ctrl + /)' },
    { key: 'sep2', sep: true },
    { key: 'exit', icon: '✕', title: 'Exit (Esc)' }
  ];

  var SCENE_BREAK_RE = /^\s*(\*\s*\*\s*\*|#\s*#\s*#|—{3,}|\*{3,})\s*$/;

  // ============================================================
  // STATE
  // ============================================================
  var CM = {
    built: false,
    open: false,
    chapterId: null, bookId: null,
    chapter: null, book: null,
    draft: null,
    activeBg: 0, // which of the two crossfade layers is on top
    activePanel: null,
    zenOn: false, readingOn: false, highContrast: false,
    reducedMotion: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    els: {},
    session: { startTime: 0, startWords: 0, samples: [] },
    saveTimer: null,
    lastSavedContent: '',
    toolbarIdleTimer: null,
    hudTypingTimer: null,
    zenRevealTimer: null,
    audioFadeTimer: null,
    particles: { canvas: null, ctx: null, raf: null, list: [], lastLightning: 0, nextLightningAt: 0 },
    typewriterRaf: null,
    find: { query: '', matches: [], idx: -1 },
    hudInterval: null,
    fsSyncing: false
  };

  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { CM.reducedMotion = e.matches; });

  // ============================================================
  // DOM SHELL — built once, then shown/hidden
  // ============================================================
  function build() {
    if (CM.built) return;
    var root = document.createElement('div');
    root.id = 'cmRoot';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Composition Mode');
    root.innerHTML =
      '<div class="cm-mode-badge" id="cmModeBadge"></div>' +
      '<div class="cm-bg-layer cm-bg-active" data-slot="0"><img id="cmBgImg0" alt="" style="display:none;"><video id="cmBgVid0" style="display:none;" muted loop playsinline></video></div>' +
      '<div class="cm-bg-layer" data-slot="1"><img id="cmBgImg1" alt="" style="display:none;"><video id="cmBgVid1" style="display:none;" muted loop playsinline></video></div>' +
      '<div class="cm-gradient-overlay" id="cmGradient" data-gradient="bottom"></div>' +
      '<div class="cm-dark-overlay" id="cmDarkOverlay"></div>' +
      '<div class="cm-tint-overlay" id="cmTintOverlay"></div>' +
      '<canvas class="cm-particle-canvas" id="cmParticleCanvas"></canvas>' +
      '<div class="cm-panel-wrap" id="cmPanelWrap" data-align="center">' +
        '<div class="cm-glass-panel" id="cmGlassPanel" data-width="book">' +
          '<div class="cm-editor-surface" id="cmEditorSurface" contenteditable="true" spellcheck="true" data-placeholder="Begin writing…"></div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="cm-exit-btn" id="cmExitBtn" aria-label="Exit Composition Mode"><span>✕ Exit</span></button>' +
      '<div class="cm-hud" id="cmHud"></div>' +
      '<div class="cm-toolbar" id="cmToolbar"></div>' +
      '<div class="cm-panel" id="cmPanel"></div>' +
      '<audio id="cmAudio" loop preload="none"></audio>' +
      '<input type="file" id="cmBgImageInput" accept="image/*" style="display:none;">' +
      '<input type="file" id="cmBgVideoInput" accept="video/*" style="display:none;">' +
      '<input type="file" id="cmAudioFileInput" accept="audio/*" style="display:none;">' +
      '<input type="file" id="cmPresetImportInput" accept="application/json" style="display:none;">';
    document.body.appendChild(root);

    CM.els.root = root;
    CM.els.badge = gid('cmModeBadge');
    CM.els.bgLayers = [root.querySelector('[data-slot="0"]'), root.querySelector('[data-slot="1"]')];
    CM.els.bgImgs = [gid('cmBgImg0'), gid('cmBgImg1')];
    CM.els.bgVids = [gid('cmBgVid0'), gid('cmBgVid1')];
    CM.els.gradient = gid('cmGradient');
    CM.els.darkOverlay = gid('cmDarkOverlay');
    CM.els.tintOverlay = gid('cmTintOverlay');
    CM.els.panelWrap = gid('cmPanelWrap');
    CM.els.glass = gid('cmGlassPanel');
    CM.els.surface = gid('cmEditorSurface');
    CM.els.exitBtn = gid('cmExitBtn');
    CM.els.hud = gid('cmHud');
    CM.els.toolbar = gid('cmToolbar');
    CM.els.panel = gid('cmPanel');
    CM.els.audio = gid('cmAudio');
    CM.els.canvas = gid('cmParticleCanvas');
    CM.particles.canvas = CM.els.canvas;
    CM.particles.ctx = CM.els.canvas.getContext('2d');

    buildToolbar();
    wireGlobalInteractions();
    wireEditorSurface();
    wireUploadInputs();
    window.addEventListener('resize', sizeCanvas);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    CM.built = true;
  }

  function sizeCanvas() {
    if (!CM.els.canvas) return;
    var dpr = window.devicePixelRatio || 1;
    CM.els.canvas.width = window.innerWidth * dpr;
    CM.els.canvas.height = window.innerHeight * dpr;
    CM.els.canvas.style.width = window.innerWidth + 'px';
    CM.els.canvas.style.height = window.innerHeight + 'px';
    CM.particles.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ============================================================
  // OPEN / CLOSE
  // ============================================================
  function open(chapterId, bookId) {
    build();
    var chapter = WD().Chapters.get(chapterId);
    var book = WD().Books.get(bookId);
    if (!chapter || !book) return;
    CM.chapterId = chapterId; CM.bookId = bookId;
    CM.chapter = chapter; CM.book = book;
    CM.draft = loadDraftForChapter(chapter);
    CM.session.startTime = Date.now();
    CM.session.startWords = WD().wordCount(chapter.content);
    CM.session.samples = [{ t: CM.session.startTime, w: CM.session.startWords }];
    CM.lastSavedContent = chapter.content || '';

    buildEditorSurfaceFromText(chapter.content || '');
    applyDraft(true);
    renderHud();
    CM.hudInterval = setInterval(renderHud, 1000);

    CM.els.root.classList.add('cm-open');
    document.body.style.overflow = 'hidden';
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } catch (e) {}
    CM.open = true;
    resetIdleTimers();
    setTimeout(function () { CM.els.surface.focus(); placeCaretAtEnd(CM.els.surface); }, 350);
  }

  function close() {
    if (!CM.open) return;
    flushSave(true);
    stopParticles();
    stopAudio(true);
    CM.els.bgVids.forEach(function (v) { try { v.pause(); } catch (e) {} });
    if (CM.typewriterRaf) cancelAnimationFrame(CM.typewriterRaf);
    if (CM.hudInterval) clearInterval(CM.hudInterval);
    closePanel();
    CM.els.root.classList.remove('cm-open', 'cm-zen', 'cm-reveal');
    document.body.style.overflow = '';
    CM.open = false;
    try {
      if (document.fullscreenElement) { CM.fsSyncing = true; document.exitFullscreen().catch(function () {}).then(function () { CM.fsSyncing = false; }); }
    } catch (e) {}
    if (window.WD_refreshEditorTab) window.WD_refreshEditorTab();
  }

  function onFullscreenChange() {
    if (CM.fsSyncing) return;
    if (!document.fullscreenElement && CM.open) close();
  }

  // ============================================================
  // DRAFT (live settings) — loads a chapter's assigned named preset if
  // set, else its own last-used ad-hoc draft (localStorage, per chapter,
  // never a named preset until explicitly saved as one), else defaults.
  // ============================================================
  function draftStorageKey(chapterId) { return 'wds:compDraft:' + chapterId; }
  function loadDraftForChapter(chapter) {
    // Most specific wins: this chapter's own explicit assignment, then
    // this chapter's own prior ad-hoc tweaks, then the global "template
    // for all chapters" (only reaches untouched chapters — see
    // settingsModel's defaultCompositionPresetId comment), then factory
    // defaults.
    if (chapter.compositionPresetId) {
      var preset = WD().CompositionPresets.get(chapter.compositionPresetId);
      if (preset) return WD().compositionPresetModel(preset);
    }
    try {
      var raw = localStorage.getItem(draftStorageKey(chapter.id));
      if (raw) return WD().compositionPresetModel(JSON.parse(raw));
    } catch (e) {}
    var defaultId = WD().getSettings().defaultCompositionPresetId;
    if (defaultId) {
      var globalPreset = WD().CompositionPresets.get(defaultId);
      if (globalPreset) return WD().compositionPresetModel(globalPreset);
    }
    return WD().compositionPresetModel({});
  }
  var persistDraft = debounce(function () {
    if (!CM.chapterId) return;
    try { localStorage.setItem(draftStorageKey(CM.chapterId), JSON.stringify(CM.draft)); } catch (e) {}
  }, 400);

  function applyDraft(isInitial) {
    applyBackground(isInitial);
    applyOverlay();
    applyGlass();
    applyTypography();
    applyFocusMode();
    applyTypewriter();
    applyParticles();
    applyAudio(isInitial);
    applyToolbarVisibility();
    if (isInitial && CM.draft.zenDefault) setZen(true, true);
  }

  // ============================================================
  // BACKGROUND / OVERLAY ENGINE
  // ============================================================
  function applyBackground(instant) {
    var bg = CM.draft.background;
    var nextSlot = instant ? CM.activeBg : (1 - CM.activeBg);
    var img = CM.els.bgImgs[nextSlot], vid = CM.els.bgVids[nextSlot], layer = CM.els.bgLayers[nextSlot];
    img.style.display = 'none'; vid.style.display = 'none';
    try { vid.pause(); } catch (e) {}
    if (!bg.url) {
      layer.style.background = 'radial-gradient(ellipse at 50% 30%, #1c1626 0%, #050506 70%)';
    } else if (bg.type === 'video') {
      layer.style.background = 'none';
      if (vid.getAttribute('src') !== bg.url) vid.src = bg.url;
      vid.style.display = 'block'; vid.play().catch(function () {});
    } else {
      layer.style.background = 'none';
      img.src = bg.url; img.style.display = 'block';
    }
    if (!instant) {
      CM.els.bgLayers[CM.activeBg].classList.remove('cm-bg-active');
      layer.classList.add('cm-bg-active');
      var oldSlot = CM.activeBg;
      CM.activeBg = nextSlot;
      setTimeout(function () {
        var oldVid = CM.els.bgVids[oldSlot];
        if (oldVid.style.display !== 'none') { try { oldVid.pause(); oldVid.removeAttribute('src'); oldVid.load(); } catch (e) {} oldVid.style.display = 'none'; }
      }, 950);
    } else {
      layer.classList.add('cm-bg-active');
    }
  }
  function setBackground(url, type, category) {
    CM.draft.background = { type: type || 'image', url: url || '', category: category || '' };
    applyBackground(false);
    persistDraft();
  }
  function applyOverlay() {
    var ov = CM.draft.overlay;
    CM.els.root.style.setProperty('--cm-blur', ov.blur + 'px');
    CM.els.root.style.setProperty('--cm-dark', (ov.darkOverlay / 100).toFixed(2));
    CM.els.gradient.setAttribute('data-gradient', ov.gradientType);
    CM.els.root.style.setProperty('--cm-tint-color', ov.tint.color);
    CM.els.root.style.setProperty('--cm-tint-opacity', (ov.tint.opacity / 100).toFixed(2));
  }
  function applyGlass() {
    var g = CM.draft.glass;
    var opacityFrac = g.opacity / 100;
    CM.els.root.style.setProperty('--cm-glass-opacity', opacityFrac.toFixed(2));
    CM.els.root.style.setProperty('--cm-glass-blur', g.blurIntensity + 'px');
    CM.els.root.style.setProperty('--cm-glass-radius', g.radius + 'px');
    CM.els.root.style.setProperty('--cm-glass-padding', g.padding + 'px');
    CM.els.root.style.setProperty('--cm-shadow-op', (g.shadowStrength / 100 * 0.6).toFixed(2));
    CM.els.root.style.setProperty('--cm-shadow-blur', (40 + g.shadowStrength * 0.6) + 'px');
    CM.els.root.style.setProperty('--cm-shadow-y', (10 + g.shadowStrength * 0.25) + 'px');
    // Border/inset-highlight ride along with Opacity so dragging it to 0
    // (together with Glass Blur + Shadow at 0) leaves no visible panel
    // chrome at all — just the text over the live background. At the
    // default ~55% opacity this lands right back on the original fixed
    // 0.14 look, so nothing changes for anyone who never touches the slider.
    CM.els.root.style.setProperty('--cm-glass-border', 'rgba(255,255,255,' + (opacityFrac * 0.26).toFixed(3) + ')');
    CM.els.glass.setAttribute('data-width', g.width);
    CM.els.panelWrap.setAttribute('data-align', g.alignment);
  }
  // One-click "just the text over the background" — stashes the current
  // Opacity/Glass Blur/Shadow so the second click restores exactly what
  // you had, rather than snapping back to generic defaults.
  function toggleImmersive() {
    var g = CM.draft.glass;
    if (!CM._immersiveOn) {
      CM._immersivePrev = { opacity: g.opacity, blurIntensity: g.blurIntensity, shadowStrength: g.shadowStrength };
      g.opacity = 0; g.blurIntensity = 0; g.shadowStrength = 0;
      CM._immersiveOn = true;
    } else {
      Object.assign(g, CM._immersivePrev || { opacity: 55, blurIntensity: 22, shadowStrength: 50 });
      CM._immersiveOn = false;
    }
    applyGlass(); persistDraft(); renderGlassPanel();
  }
  function applyTypography() {
    var ty = CM.draft.typography;
    CM.els.root.style.setProperty('--cm-font', FONT_STACKS[ty.font] || FONT_STACKS['Literata']);
    CM.els.root.style.setProperty('--cm-font-size', ty.fontSize + 'px');
    CM.els.root.style.setProperty('--cm-letter-spacing', ty.letterSpacing + 'em');
    CM.els.root.style.setProperty('--cm-line-height', ty.lineHeight);
    CM.els.root.style.setProperty('--cm-para-spacing', ty.paragraphSpacing + 'px');
    CM.els.root.style.setProperty('--cm-text-width', ty.textWidth + 'px');
    CM.els.root.style.setProperty('--cm-justify', ty.justification);
  }

  // ============================================================
  // EDITOR SURFACE — a contenteditable div, one <p class="cm-para"> per
  // plain-text line (matching exactly how <textarea id="wdChapterContent">
  // already stores chapter.content — one literal \n per Enter press), so
  // there is one source of truth and zero drift with the plain Editor tab.
  // ============================================================
  function buildEditorSurfaceFromText(text) {
    var lines = String(text || '').split('\n');
    if (lines.length === 0) lines = [''];
    CM.els.surface.innerHTML = lines.map(function (line, i) {
      return '<p class="cm-para" data-i="' + i + '">' + (line ? esc(line) : '<br>') + '</p>';
    }).join('');
    if (!CM.els.surface.firstChild) CM.els.surface.innerHTML = '<p class="cm-para" data-i="0"><br></p>';
  }
  function textFromSurface() {
    var paras = CM.els.surface.querySelectorAll('.cm-para');
    var lines = [];
    paras.forEach(function (p) { lines.push(p.innerText.replace(/\n/g, '')); });
    return lines.join('\n');
  }
  function placeCaretAtEnd(el) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    } catch (e) {}
  }

  function wireEditorSurface() {
    var surface = CM.els.surface;
    surface.addEventListener('input', function () {
      onEditorInput();
    });
    surface.addEventListener('keydown', function (e) {
      // Enter always creates a new plain line/paragraph — never a nested
      // <div>/<br> soup — so the line-per-paragraph model above stays
      // intact no matter what the browser's default contenteditable
      // Enter behavior would otherwise produce.
      if (e.key === 'Enter') {
        e.preventDefault();
        insertLineBreakAtCaret();
        onEditorInput();
      }
    });
    surface.addEventListener('selectionchange_unused', function () {});
    document.addEventListener('selectionchange', function () {
      if (!CM.open || document.activeElement !== surface) return;
      onSelectionChange();
    });
    surface.addEventListener('click', onSelectionChange);
    surface.addEventListener('blur', function () { flushSave(true); });
  }
  function insertLineBreakAtCaret() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var container = range.startContainer;
    var para = container.nodeType === 3 ? container.parentElement : container;
    while (para && !para.classList.contains('cm-para')) para = para.parentElement;
    if (!para) { document.execCommand && document.execCommand('insertLineBreak'); return; }
    // Split para's text at caret offset into two paragraphs.
    var full = para.innerText;
    var pre = range.startContainer.nodeType === 3
      ? (function () { var r = range.cloneRange(); r.selectNodeContents(para); r.setEnd(range.startContainer, range.startOffset); return r.toString(); })()
      : full;
    var post = full.slice(pre.length);
    var newPara = document.createElement('p');
    newPara.className = 'cm-para';
    newPara.innerHTML = post ? esc(post) : '<br>';
    para.innerHTML = pre ? esc(pre) : '<br>';
    para.parentNode.insertBefore(newPara, para.nextSibling);
    var r2 = document.createRange();
    r2.setStart(newPara.firstChild || newPara, 0);
    r2.collapse(true);
    var sel2 = window.getSelection();
    sel2.removeAllRanges(); sel2.addRange(r2);
    reindexParas();
  }
  function reindexParas() {
    CM.els.surface.querySelectorAll('.cm-para').forEach(function (p, i) { p.setAttribute('data-i', i); });
  }

  function onEditorInput() {
    reindexParas();
    var text = textFromSurface();
    var words = WD().wordCount(text);
    updateHudLive(words);
    hudTypingHide();
    if (CM.saveTimer) clearTimeout(CM.saveTimer);
    CM.saveTimer = setTimeout(function () { commitSave(text); }, 800);
    if (CM.draft.focusMode !== 'none') scheduleFocusUpdate();
    if (CM.draft.typewriterMode) scheduleTypewriterCenter();
    if (CM.readingOn) { /* no-op: editing disabled in reading mode */ }
  }
  function commitSave(text) {
    if (text === CM.lastSavedContent) return;
    var newWords = WD().wordCount(text);
    var delta = newWords - CM.session.startWords;
    WD().Chapters.update(CM.chapterId, { content: text });
    WD().Books.update(CM.bookId, { currentChapterId: CM.chapterId, lastEditedAt: new Date().toISOString() });
    if (delta > 0) {
      var minutes = Math.max(1, Math.round((Date.now() - CM.session.startTime) / 60000));
      WD().logWritingProgress(CM.bookId, CM.book.seriesId, delta, minutes);
      CM.session.startWords = newWords; CM.session.startTime = Date.now();
    }
    CM.lastSavedContent = text;
  }
  function flushSave(force) {
    if (!CM.els.surface) return;
    if (CM.saveTimer) { clearTimeout(CM.saveTimer); CM.saveTimer = null; }
    var text = textFromSurface();
    if (force || text !== CM.lastSavedContent) commitSave(text);
  }

  // ============================================================
  // FOCUS MODES — line/paragraph collapse to the same "active <p> only"
  // granularity (the underlying document is one plain-text line per <p>,
  // exactly like the textarea it mirrors, so there's no structural
  // distinction between the two beyond the label — flagged here rather
  // than faked). Sentence splits the active paragraph only. Block widens
  // to the surrounding non-blank run. Scene widens to the nearest
  // ***-style scene-break markers.
  // ============================================================
  function scheduleFocusUpdate() {
    if (CM._focusRaf) cancelAnimationFrame(CM._focusRaf);
    CM._focusRaf = requestAnimationFrame(applyFocusDim);
  }
  function onSelectionChange() {
    if (CM.draft.focusMode !== 'none') scheduleFocusUpdate();
    if (CM.draft.typewriterMode) scheduleTypewriterCenter();
  }
  function activeParaIndex() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return -1;
    var node = sel.getRangeAt(0).startContainer;
    var el = node.nodeType === 3 ? node.parentElement : node;
    while (el && !el.classList.contains('cm-para')) el = el.parentElement;
    if (!el) return -1;
    return Number(el.getAttribute('data-i'));
  }
  function applyFocusMode() {
    var mode = CM.draft.focusMode;
    CM.els.surface.querySelectorAll('.cm-sentence').forEach(unwrapSentenceSpan);
    if (mode === 'none') {
      CM.els.surface.querySelectorAll('.cm-para.cm-dim').forEach(function (p) { p.classList.remove('cm-dim'); });
      return;
    }
    applyFocusDim();
  }
  function unwrapSentenceSpan(span) {
    var parent = span.parentNode; if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }
  function applyFocusDim() {
    var mode = CM.draft.focusMode;
    var paras = Array.prototype.slice.call(CM.els.surface.querySelectorAll('.cm-para'));
    var activeIdx = activeParaIndex();
    if (activeIdx === -1) return;
    var keepRange = [activeIdx, activeIdx];
    if (mode === 'block') {
      var start = activeIdx, end = activeIdx;
      while (start > 0 && paras[start - 1].innerText.trim() !== '' && start - 1 >= activeIdx - 3) start--;
      while (end < paras.length - 1 && paras[end + 1].innerText.trim() !== '' && end + 1 <= activeIdx + 3) end++;
      keepRange = [start, end];
    } else if (mode === 'scene') {
      var s = activeIdx, e = activeIdx;
      while (s > 0 && !SCENE_BREAK_RE.test(paras[s - 1].innerText)) s--;
      while (e < paras.length - 1 && !SCENE_BREAK_RE.test(paras[e + 1].innerText)) e++;
      keepRange = [s, e];
    }
    paras.forEach(function (p, i) {
      var keep = i >= keepRange[0] && i <= keepRange[1];
      p.classList.toggle('cm-dim', !keep);
    });
    if (mode === 'sentence') applySentenceFocus(paras[activeIdx]);
  }
  function applySentenceFocus(para) {
    if (!para) return;
    var text = para.innerText;
    var caretOffset = getCaretCharOffset(para);
    var sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
    var html = ''; var pos = 0;
    var activeSi = 0, running = 0;
    sentences.forEach(function (sent, i) { if (caretOffset >= running) activeSi = i; running += sent.length; });
    sentences.forEach(function (sent, i) {
      html += '<span class="cm-sentence' + (i === activeSi ? '' : ' cm-dim') + '" data-si="' + i + '">' + esc(sent) + '</span>';
    });
    para.innerHTML = html || '<br>';
    setCaretCharOffset(para, caretOffset);
  }
  function getCaretCharOffset(element) {
    var sel = window.getSelection(); if (!sel.rangeCount) return 0;
    var range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(element); range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return range.toString().length;
  }
  function setCaretCharOffset(element, offset) {
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    var node, remaining = offset;
    while ((node = walker.nextNode())) {
      if (remaining <= node.length) {
        var range = document.createRange();
        range.setStart(node, Math.max(0, remaining)); range.collapse(true);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        return;
      }
      remaining -= node.length;
    }
  }

  // ============================================================
  // TYPEWRITER MODE — keeps the caret's line vertically centered in the
  // glass panel's own scroll container via a smooth rAF-driven lerp.
  // ============================================================
  function applyTypewriter() {
    CM.els.root.classList.toggle('cm-typewriter', !!CM.draft.typewriterMode);
    if (CM.draft.typewriterMode) scheduleTypewriterCenter();
  }
  function scheduleTypewriterCenter() {
    if (CM._twRaf) cancelAnimationFrame(CM._twRaf);
    CM._twRaf = requestAnimationFrame(centerCaretLine);
  }
  function centerCaretLine() {
    if (!CM.draft.typewriterMode) return;
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0).cloneRange();
    var rect;
    try { rect = range.getClientRects()[0] || range.getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.top && !rect.bottom)) return;
    var panel = CM.els.glass;
    var panelRect = panel.getBoundingClientRect();
    var targetCenter = panelRect.top + panelRect.height / 2;
    var delta = rect.top - targetCenter;
    if (Math.abs(delta) < 2) return;
    lerpScroll(panel, panel.scrollTop + delta);
  }
  function lerpScroll(el, target) {
    if (CM.typewriterRaf) cancelAnimationFrame(CM.typewriterRaf);
    function step() {
      var current = el.scrollTop;
      var next = current + (target - current) * (CM.reducedMotion ? 1 : 0.22);
      el.scrollTop = next;
      if (Math.abs(target - next) > 0.5) CM.typewriterRaf = requestAnimationFrame(step);
    }
    step();
  }

  // ============================================================
  // READING MODE
  // ============================================================
  function setReadingMode(on) {
    CM.readingOn = on;
    CM.els.surface.setAttribute('contenteditable', on ? 'false' : 'true');
    CM.els.surface.setAttribute('data-reading', on ? '1' : '0');
    showModeBadge(on ? 'Reading Mode' : '');
    if (!on) closePanel();
  }
  function openFindPanel() {
    renderPanel('find', panelHtmlFind());
    wireFindPanel();
  }
  function panelHtmlFind() {
    return panelShell('🔎 Find', 'find',
      '<div class="cm-findbar">' +
        '<input type="text" id="cmFindInput" placeholder="Search this chapter…" value="' + esc(CM.find.query) + '">' +
        '<button type="button" class="cm-btn" id="cmFindPrev">‹</button>' +
        '<button type="button" class="cm-btn" id="cmFindNext">›</button>' +
      '</div>' +
      '<div class="cm-find-count" id="cmFindCount" style="margin-top:8px;"></div>');
  }
  function wireFindPanel() {
    var input = gid('cmFindInput');
    input.addEventListener('input', function () { runFind(input.value); });
    input.focus();
    gid('cmFindNext').addEventListener('click', function () { stepFind(1); });
    gid('cmFindPrev').addEventListener('click', function () { stepFind(-1); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') stepFind(e.shiftKey ? -1 : 1); });
    if (CM.find.query) runFind(CM.find.query);
  }
  function clearFindHighlights() {
    CM.els.surface.querySelectorAll('mark.cm-hit').forEach(unwrapSentenceSpan);
  }
  function runFind(query) {
    clearFindHighlights();
    CM.find.query = query; CM.find.matches = []; CM.find.idx = -1;
    if (!query) { gid('cmFindCount') && (gid('cmFindCount').textContent = ''); return; }
    var re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    CM.els.surface.querySelectorAll('.cm-para').forEach(function (p) {
      var text = p.innerText;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      var html = '', last = 0, m;
      while ((m = re.exec(text))) {
        html += esc(text.slice(last, m.index)) + '<mark class="cm-hit">' + esc(m[0]) + '</mark>';
        last = m.index + m[0].length;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      html += esc(text.slice(last));
      p.innerHTML = html || '<br>';
    });
    CM.find.matches = Array.prototype.slice.call(CM.els.surface.querySelectorAll('mark.cm-hit'));
    if (gid('cmFindCount')) gid('cmFindCount').textContent = CM.find.matches.length ? ('1 / ' + CM.find.matches.length) : 'No matches';
    if (CM.find.matches.length) { CM.find.idx = 0; highlightActiveMatch(); }
  }
  function stepFind(dir) {
    if (!CM.find.matches.length) return;
    CM.find.idx = (CM.find.idx + dir + CM.find.matches.length) % CM.find.matches.length;
    highlightActiveMatch();
  }
  function highlightActiveMatch() {
    CM.find.matches.forEach(function (m) { m.classList.remove('cm-hit-active'); });
    var m = CM.find.matches[CM.find.idx];
    if (!m) return;
    m.classList.add('cm-hit-active');
    m.scrollIntoView({ block: 'center', behavior: CM.reducedMotion ? 'auto' : 'smooth' });
    if (gid('cmFindCount')) gid('cmFindCount').textContent = (CM.find.idx + 1) + ' / ' + CM.find.matches.length;
  }

  // ============================================================
  // ZEN MODE
  // ============================================================
  function setZen(on, silent) {
    CM.zenOn = on;
    CM.els.root.classList.toggle('cm-zen', on);
    if (!silent) showModeBadge(on ? 'Zen Mode' : '');
    if (on) { CM.els.root.classList.remove('cm-reveal'); closePanel(); }
  }
  function wireGlobalInteractions() {
    CM.els.root.addEventListener('mousemove', function () {
      if (CM.zenOn) {
        CM.els.root.classList.add('cm-reveal');
        clearTimeout(CM.zenRevealTimer);
        CM.zenRevealTimer = setTimeout(function () { CM.els.root.classList.remove('cm-reveal'); }, 2600);
      }
      resetIdleTimers();
    });
    CM.els.exitBtn.addEventListener('click', close);
    document.addEventListener('keydown', onGlobalKeydown);
  }
  function resetIdleTimers() {
    CM.els.toolbar.classList.remove('cm-hidden');
    CM.els.exitBtn.classList.remove('cm-hidden');
    clearTimeout(CM.toolbarIdleTimer);
    if (!CM.activePanel) {
      CM.toolbarIdleTimer = setTimeout(function () {
        if (!CM.activePanel) { CM.els.toolbar.classList.add('cm-hidden'); CM.els.exitBtn.classList.add('cm-hidden'); }
      }, 3200);
    }
  }
  function hudTypingHide() {
    CM.els.hud.classList.add('cm-hidden');
    clearTimeout(CM.hudTypingTimer);
    CM.hudTypingTimer = setTimeout(function () { CM.els.hud.classList.remove('cm-hidden'); }, 2200);
  }
  function showModeBadge(text) {
    CM.els.badge.textContent = text;
    CM.els.badge.classList.toggle('cm-show', !!text);
    if (text) setTimeout(function () { CM.els.badge.classList.remove('cm-show'); }, 1800);
  }

  // ============================================================
  // AMBIENT AUDIO ENGINE
  // ============================================================
  function applyAudio(isInitial) {
    var aa = CM.draft.ambientAudio;
    var audio = CM.els.audio;
    var lastVol = readLastVolume();
    var vol = lastVol != null ? lastVol : aa.volume;
    audio.loop = aa.loop !== false;
    if (!aa.url) { stopAudio(true); return; }
    if (audio.src !== aa.url) audio.src = aa.url;
    audio.volume = 0;
    // On initial open, only start audio if the preset asked for autoplay.
    // On a live preset switch (isInitial === false) the user just chose
    // this scene deliberately, so play it regardless of its own
    // autoplay flag — that flag only governs "when a chapter first opens."
    if (aa.autoplay || isInitial === false) {
      audio.play().then(function () { fadeAudioTo(vol / 100, aa.fadeIn); }).catch(function () {});
    }
  }
  function setAmbient(url, category) {
    CM.draft.ambientAudio.url = url || ''; CM.draft.ambientAudio.category = category || '';
    persistDraft();
    if (!url) { stopAudio(true); return; }
    CM.els.audio.src = url; CM.els.audio.volume = 0;
    CM.els.audio.play().then(function () { fadeAudioTo((readLastVolume() || CM.draft.ambientAudio.volume) / 100, CM.draft.ambientAudio.fadeIn); }).catch(function () {});
  }
  function fadeAudioTo(targetVol, ms) {
    clearInterval(CM.audioFadeTimer);
    var audio = CM.els.audio, start = audio.volume, steps = Math.max(4, Math.round((ms || 800) / 60)), i = 0;
    CM.audioFadeTimer = setInterval(function () {
      i++;
      audio.volume = clamp(start + (targetVol - start) * (i / steps), 0, 1);
      if (i >= steps) clearInterval(CM.audioFadeTimer);
    }, 60);
  }
  function stopAudio(instant) {
    var audio = CM.els.audio;
    if (!audio) return;
    if (instant) { clearInterval(CM.audioFadeTimer); audio.pause(); audio.volume = 0; return; }
    fadeAudioTo(0, CM.draft.ambientAudio.fadeOut);
    setTimeout(function () { audio.pause(); }, (CM.draft.ambientAudio.fadeOut || 800) + 100);
  }
  function setVolume(pct) {
    CM.draft.ambientAudio.volume = pct;
    CM.els.audio.volume = pct / 100;
    persistLastVolume(pct);
    persistDraft();
  }
  function persistLastVolume(pct) { try { localStorage.setItem('wd:compAudioVolume', String(pct)); } catch (e) {} }
  function readLastVolume() { try { var v = localStorage.getItem('wd:compAudioVolume'); return v == null ? null : Number(v); } catch (e) { return null; } }

  // ============================================================
  // PARTICLE ENGINE — one canvas, a small pooled system. Capped counts,
  // opacity/transform-only motion, fully skipped under reduced-motion.
  // ============================================================
  var PARTICLE_CAPS = { snow: 70, rain: 90, embers: 40, dust: 50, leaves: 30, sparks: 35, fireflies: 25, stars: 80 };
  function spawnParticle(type) {
    var w = window.innerWidth, h = window.innerHeight;
    var base = { type: type, x: Math.random() * w, y: Math.random() * h, phase: Math.random() * Math.PI * 2 };
    switch (type) {
      case 'snow': return Object.assign(base, { vx: (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random() * 0.6, size: 1.5 + Math.random() * 2.5, alpha: 0.4 + Math.random() * 0.5 });
      case 'rain': return Object.assign(base, { vx: -0.3, vy: 8 + Math.random() * 6, size: 1, len: 14 + Math.random() * 10, alpha: 0.25 + Math.random() * 0.25 });
      case 'embers': return Object.assign(base, { y: h + Math.random() * 40, vx: (Math.random() - 0.5) * 0.5, vy: -(0.5 + Math.random() * 0.8), size: 1 + Math.random() * 2, alpha: 0.6 + Math.random() * 0.4, hue: 20 + Math.random() * 20 });
      case 'dust': return Object.assign(base, { vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, size: 0.6 + Math.random() * 1.2, alpha: 0.15 + Math.random() * 0.2 });
      case 'leaves': return Object.assign(base, { vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 0.5, size: 3 + Math.random() * 3, alpha: 0.5 + Math.random() * 0.3, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.03 });
      case 'sparks': return Object.assign(base, { y: h * 0.5 + Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 0.6, vy: -(0.8 + Math.random() * 1.4), size: 1 + Math.random() * 1.5, alpha: 1, life: 0, maxLife: 60 + Math.random() * 60, hue: 260 + Math.random() * 60 });
      case 'fireflies': return Object.assign(base, { vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, size: 1.5 + Math.random() * 1.5, alpha: 0.5 });
      case 'stars': return Object.assign(base, { vx: 0, vy: 0, size: 0.8 + Math.random() * 1.4, alpha: 0.3 + Math.random() * 0.5, speed: 0.02 + Math.random() * 0.03 });
      default: return base;
    }
  }
  function updateParticle(p, w, h) {
    switch (p.type) {
      case 'snow': p.x += p.vx + Math.sin(p.phase + Date.now() / 1200) * 0.3; p.y += p.vy; if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; } break;
      case 'rain': p.x += p.vx; p.y += p.vy; if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; } break;
      case 'embers': p.x += p.vx + Math.sin(p.phase + Date.now() / 800) * 0.3; p.y += p.vy; p.alpha -= 0.003; if (p.alpha <= 0 || p.y < -10) Object.assign(p, spawnParticle('embers')); break;
      case 'dust': p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; break;
      case 'leaves': p.x += p.vx + Math.sin(p.phase + Date.now() / 1000) * 0.5; p.y += p.vy; p.rot += p.vr; if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; } break;
      case 'sparks': p.x += p.vx; p.y += p.vy; p.life++; p.alpha = clamp(1 - p.life / p.maxLife, 0, 1); if (p.life >= p.maxLife) Object.assign(p, spawnParticle('sparks')); break;
      case 'fireflies': p.x += p.vx; p.y += p.vy; p.alpha = 0.25 + Math.abs(Math.sin(p.phase + Date.now() / 900)) * 0.5; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; break;
      case 'stars': p.alpha = 0.25 + Math.abs(Math.sin(p.phase + Date.now() * p.speed / 100)) * 0.6; break;
    }
  }
  function drawParticle(ctx, p) {
    ctx.save(); ctx.globalAlpha = clamp(p.alpha, 0, 1);
    switch (p.type) {
      case 'snow': case 'dust': case 'stars':
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break;
      case 'rain':
        ctx.strokeStyle = 'rgba(200,220,255,0.9)'; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 2, p.y - p.len); ctx.stroke(); break;
      case 'embers':
        ctx.fillStyle = 'hsl(' + p.hue + ', 90%, 60%)'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break;
      case 'leaves':
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = 'rgba(200,120,50,0.8)';
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'sparks':
        ctx.fillStyle = 'hsl(' + p.hue + ', 90%, 75%)'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break;
      case 'fireflies':
        ctx.fillStyle = 'rgba(220,255,140,0.9)'; ctx.shadowColor = 'rgba(220,255,140,0.9)'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break;
    }
    ctx.restore();
  }
  function applyParticles() {
    stopParticles();
    if (CM.reducedMotion) return;
    var types = (CM.draft.particles || []).filter(function (t) { return t !== 'fog' && t !== 'lightning'; });
    var list = [];
    types.forEach(function (t) {
      var n = PARTICLE_CAPS[t] || 30;
      for (var i = 0; i < n; i++) list.push(spawnParticle(t));
    });
    CM.particles.list = list;
    CM.particles.fog = (CM.draft.particles || []).indexOf('fog') !== -1;
    CM.particles.lightning = (CM.draft.particles || []).indexOf('lightning') !== -1;
    if (CM.particles.lightning) CM.particles.nextLightningAt = Date.now() + 6000 + Math.random() * 10000;
    if (!list.length && !CM.particles.fog && !CM.particles.lightning) return;
    sizeCanvas();
    runParticleLoop();
  }
  function runParticleLoop() {
    var ctx = CM.particles.ctx, w = window.innerWidth, h = window.innerHeight;
    function frame() {
      ctx.clearRect(0, 0, w, h);
      if (CM.particles.fog) drawFog(ctx, w, h);
      CM.particles.list.forEach(function (p) { updateParticle(p, w, h); drawParticle(ctx, p); });
      if (CM.particles.lightning) maybeLightning(ctx, w, h);
      CM.particles.raf = requestAnimationFrame(frame);
    }
    frame();
  }
  function drawFog(ctx, w, h) {
    var t = Date.now() / 6000;
    for (var i = 0; i < 3; i++) {
      var x = w * (0.2 + 0.3 * i) + Math.sin(t + i) * 80;
      var y = h * (0.3 + 0.2 * i);
      var grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.35);
      grad.addColorStop(0, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    }
  }
  function maybeLightning(ctx, w, h) {
    var now = Date.now();
    if (now < CM.particles.nextLightningAt) return;
    CM.particles.lastLightning = now;
    CM.particles.nextLightningAt = now + 8000 + Math.random() * 14000;
    CM._lightningStart = now;
  }
  function stopParticles() {
    if (CM.particles.raf) cancelAnimationFrame(CM.particles.raf);
    CM.particles.raf = null; CM.particles.list = [];
    var ctx = CM.particles.ctx;
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  // ============================================================
  // WORD GOAL HUD
  // ============================================================
  function updateHudLive(words) {
    CM.session.samples.push({ t: Date.now(), w: words });
    var cutoff = Date.now() - 20000;
    CM.session.samples = CM.session.samples.filter(function (s) { return s.t >= cutoff; });
    renderHud(words);
  }
  function renderHud(liveWords) {
    if (!CM.chapter) return;
    var text = liveWords == null ? textFromSurface() : null;
    var words = liveWords != null ? liveWords : WD().wordCount(text);
    var goal = CM.chapter.wordGoal || CM.book.dailyGoal || 1000;
    var pct = Math.min(100, Math.round((words / goal) * 100));
    var elapsedMin = (Date.now() - CM.session.startTime) / 60000;
    var sessionDelta = Math.max(0, words - CM.session.startWords);
    var avgWpm = elapsedMin > 0.05 ? Math.round(sessionDelta / elapsedMin) : 0;
    var samples = CM.session.samples;
    var curWpm = 0;
    if (samples.length >= 2) {
      var span = (samples[samples.length - 1].t - samples[0].t) / 60000;
      var wDelta = samples[samples.length - 1].w - samples[0].w;
      curWpm = span > 0.01 ? Math.max(0, Math.round(wDelta / span)) : 0;
    }
    var remaining = Math.max(0, goal - words);
    var etaMin = avgWpm > 0 ? Math.round(remaining / avgWpm) : null;
    var streak = WD().currentWritingStreak();
    CM.els.hud.innerHTML =
      '<div class="cm-hud-row"><span>Words</span><span class="cm-hud-num">' + words.toLocaleString() + ' / ' + goal.toLocaleString() + '</span></div>' +
      '<div class="cm-hud-bar"><div class="cm-hud-bar-fill" style="width:' + pct + '%;"></div></div>' +
      '<div class="cm-hud-row"><span>Streak</span><span class="cm-hud-num">' + streak + 'd</span></div>' +
      '<div class="cm-hud-row"><span>Session</span><span class="cm-hud-num">' + fmtTime(elapsedMin * 60) + '</span></div>' +
      '<div class="cm-hud-row"><span>WPM (now / avg)</span><span class="cm-hud-num">' + curWpm + ' / ' + avgWpm + '</span></div>' +
      (etaMin != null ? '<div class="cm-hud-row"><span>Est. to goal</span><span class="cm-hud-num">' + fmtTime(etaMin * 60) + '</span></div>' : '');
  }
  function applyToolbarVisibility() {
    CM.els.toolbar.style.display = CM.draft.toolbarVisible === false ? 'none' : '';
    CM.els.hud.style.display = CM.draft.hudVisible === false ? 'none' : '';
  }

  // ============================================================
  // FLOATING TOOLBAR + POPOVER PANELS
  // ============================================================
  function buildToolbar() {
    CM.els.toolbar.innerHTML = TOOLBAR_ITEMS.map(function (item) {
      if (item.sep) return '<div class="cm-toolbar-sep"></div>';
      return '<button type="button" class="cm-toolbar-btn" data-cm-key="' + item.key + '" title="' + esc(item.title) + '" aria-label="' + esc(item.title) + '">' + item.icon + '</button>';
    }).join('');
    Array.prototype.forEach.call(CM.els.toolbar.querySelectorAll('[data-cm-key]'), function (btn) {
      btn.addEventListener('click', function () { onToolbarClick(btn.dataset.cmKey, btn); });
    });
  }
  function onToolbarClick(key) {
    if (key === 'exit') { close(); return; }
    if (key === 'zen') { setZen(!CM.zenOn); syncToolbarActive(); return; }
    if (key === 'reading') { setReadingMode(!CM.readingOn); if (CM.readingOn) openFindPanel(); else closePanel(); syncToolbarActive(); return; }
    openPanel(key);
  }
  function syncToolbarActive() {
    Array.prototype.forEach.call(CM.els.toolbar.querySelectorAll('[data-cm-key]'), function (btn) {
      var k = btn.dataset.cmKey;
      btn.classList.toggle('cm-active', (k === 'zen' && CM.zenOn) || (k === 'reading' && CM.readingOn) || k === CM.activePanel);
    });
  }
  function panelShell(title, key, bodyHtml) {
    return '<div class="cm-panel-title">' + esc(title) + '<button type="button" class="cm-panel-close" data-cm-panel-close="1">✕</button></div>' + bodyHtml;
  }
  function renderPanel(key, html) {
    CM.activePanel = key;
    CM.els.panel.innerHTML = html;
    CM.els.panel.classList.add('cm-panel-open');
    var closeBtn = CM.els.panel.querySelector('[data-cm-panel-close]');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    syncToolbarActive();
    resetIdleTimers();
  }
  function closePanel() {
    CM.activePanel = null;
    CM.els.panel.classList.remove('cm-panel-open');
    syncToolbarActive();
    resetIdleTimers();
  }
  function openPanel(key) {
    if (CM.activePanel === key) { closePanel(); return; }
    var renderers = {
      bg: renderBgPanel, video: renderVideoPanel, music: renderMusicPanel, font: renderFontPanel,
      glass: renderGlassPanel, focus: renderFocusPanel, timer: renderTimerPanel, wordgoal: renderWordGoalPanel,
      presets: renderPresetsPanel, ai: renderAiPanel, help: renderShortcutsPanel, find: openFindPanel
    };
    var fn = renderers[key];
    if (fn) fn();
  }

  // ---- Background panel ----
  function renderBgPanel() {
    var cats = WD().COMPOSITION_BACKGROUND_LIBRARY;
    var activeCat = CM._bgCat || CM.draft.background.category || cats[0].id;
    var cat = cats.filter(function (c) { return c.id === activeCat; })[0] || cats[0];
    renderPanel('bg', panelShell('🖼️ Background', 'bg',
      '<div class="cm-gallery-cats">' + cats.map(function (c) {
        return '<button type="button" class="cm-chip' + (c.id === cat.id ? ' cm-active' : '') + '" data-cm-cat="' + c.id + '">' + c.icon + ' ' + esc(c.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="cm-gallery-grid">' + cat.images.map(function (img) {
        var active = CM.draft.background.type === 'image' && CM.draft.background.url === img.url;
        return '<div class="cm-gallery-thumb' + (active ? ' cm-active' : '') + '" data-cm-bg-url="' + img.url + '" data-cm-bg-cat="' + cat.id + '"><img src="' + img.thumb + '" alt="" loading="lazy"></div>';
      }).join('') + '</div>' +
      '<div class="cm-btn-row" style="margin-top:14px;">' +
        '<button type="button" class="cm-btn" id="cmBgUploadBtn">⬆ Upload Image</button>' +
        '<button type="button" class="cm-btn" id="cmBgClearBtn">Clear</button>' +
      '</div>' +
      '<div class="cm-field" style="margin-top:12px;"><div class="cm-field-label">Or paste an image URL</div>' +
        '<input type="url" id="cmBgUrlInput" placeholder="https://…" value="' + (CM.draft.background.type === 'image' ? esc(CM.draft.background.url) : '') + '"></div>' +
      '<div class="cm-hint">Built-in gallery uses placeholder photography (Lorem Picsum) — swap in your own art via upload or URL any time.</div>'
    ));
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-cat]'), function (b) { b.addEventListener('click', function () { CM._bgCat = b.dataset.cmCat; renderBgPanel(); }); });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-bg-url]'), function (t) {
      t.addEventListener('click', function () { setBackground(t.dataset.cmBgUrl, 'image', t.dataset.cmBgCat); renderBgPanel(); });
    });
    gid('cmBgUploadBtn').addEventListener('click', function () { gid('cmBgImageInput').click(); });
    gid('cmBgClearBtn').addEventListener('click', function () { setBackground('', 'image', ''); renderBgPanel(); });
    gid('cmBgUrlInput').addEventListener('change', function (e) { if (WD().isValidMediaUrl(e.target.value)) setBackground(e.target.value.trim(), 'image', 'custom'); });
  }
  function renderVideoPanel() {
    renderPanel('video', panelShell('🎬 Video Background', 'video',
      '<div class="cm-hint" style="margin-bottom:10px;">No built-in stock video library ships with this app — upload your own looping clip or paste a hosted URL. Autoplays muted, loops, pauses automatically when you exit.</div>' +
      '<div class="cm-btn-row">' +
        '<button type="button" class="cm-btn" id="cmVideoUploadBtn">⬆ Upload Video</button>' +
        '<button type="button" class="cm-btn" id="cmVideoClearBtn">Clear</button>' +
      '</div>' +
      '<div class="cm-field" style="margin-top:12px;"><div class="cm-field-label">Or paste a video URL (.mp4/.webm)</div>' +
        '<input type="url" id="cmVideoUrlInput" placeholder="https://…" value="' + (CM.draft.background.type === 'video' ? esc(CM.draft.background.url) : '') + '"></div>' +
      (CM.draft.background.type === 'video' && CM.draft.background.url && CM.draft.background.url.indexOf('blob:') === 0
        ? '<div class="cm-hint">This clip is a local, session-only preview until it finishes uploading — it won\'t survive a reload if you\'re offline.</div>' : '')
    ));
    gid('cmVideoUploadBtn').addEventListener('click', function () { gid('cmBgVideoInput').click(); });
    gid('cmVideoClearBtn').addEventListener('click', function () { setBackground('', 'video', ''); renderVideoPanel(); });
    gid('cmVideoUrlInput').addEventListener('change', function (e) { if (WD().isValidMediaUrl(e.target.value)) setBackground(e.target.value.trim(), 'video', 'custom'); });
  }

  // ---- Music panel ----
  function renderMusicPanel() {
    var aa = CM.draft.ambientAudio;
    var lib = WD().COMPOSITION_AMBIENT_LIBRARY;
    renderPanel('music', panelShell('🎵 Ambient Audio', 'music',
      '<div class="cm-chip-row">' + lib.map(function (a) {
        return '<button type="button" class="cm-chip' + (aa.category === a.id ? ' cm-active' : '') + '" data-cm-audio-cat="' + a.id + '">' + a.icon + ' ' + esc(a.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="cm-field" style="margin-top:12px;"><div class="cm-field-label">Upload or paste a URL</div>' +
        '<div class="cm-btn-row"><button type="button" class="cm-btn" id="cmAudioUploadBtn">⬆ Upload Audio</button><button type="button" class="cm-btn" id="cmAudioClearBtn">Stop &amp; Clear</button></div>' +
        '<input type="url" id="cmAudioUrlInput" style="margin-top:8px;" placeholder="https://…audio.mp3" value="' + esc(aa.url && aa.url.indexOf('blob:') !== 0 ? aa.url : '') + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label"><span>Volume</span><span>' + (readLastVolume() != null ? readLastVolume() : aa.volume) + '%</span></div>' +
        '<input type="range" id="cmVolumeRange" min="0" max="100" value="' + (readLastVolume() != null ? readLastVolume() : aa.volume) + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label"><span>Fade In (ms)</span><span id="cmFadeInVal">' + aa.fadeIn + '</span></div><input type="range" id="cmFadeInRange" min="0" max="6000" step="100" value="' + aa.fadeIn + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label"><span>Fade Out (ms)</span><span id="cmFadeOutVal">' + aa.fadeOut + '</span></div><input type="range" id="cmFadeOutRange" min="0" max="6000" step="100" value="' + aa.fadeOut + '"></div>' +
      '<div class="cm-chip-row">' +
        '<button type="button" class="cm-chip' + (aa.loop ? ' cm-active' : '') + '" id="cmLoopToggle">🔁 Loop</button>' +
        '<button type="button" class="cm-chip' + (aa.autoplay ? ' cm-active' : '') + '" id="cmAutoplayToggle">▶ Autoplay</button>' +
        '<button type="button" class="cm-chip" id="cmMuteToggle">🔇 Mute</button>' +
      '</div>' +
      '<div class="cm-hint">No built-in ambient library ships with this app — pick a category label to tag your own upload/URL, or just paste a link.</div>'
    ));
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-audio-cat]'), function (b) {
      b.addEventListener('click', function () { CM.draft.ambientAudio.category = b.dataset.cmAudioCat; persistDraft(); renderMusicPanel(); });
    });
    gid('cmAudioUploadBtn').addEventListener('click', function () { gid('cmAudioFileInput').click(); });
    gid('cmAudioClearBtn').addEventListener('click', function () { setAmbient('', ''); renderMusicPanel(); });
    gid('cmAudioUrlInput').addEventListener('change', function (e) { if (WD().isValidMediaUrl(e.target.value)) setAmbient(e.target.value.trim(), CM.draft.ambientAudio.category || 'custom'); });
    gid('cmVolumeRange').addEventListener('input', function (e) { setVolume(Number(e.target.value)); gid('cmVolumeRange').previousElementSibling.querySelector('span:last-child').textContent = e.target.value + '%'; });
    gid('cmFadeInRange').addEventListener('input', function (e) { CM.draft.ambientAudio.fadeIn = Number(e.target.value); gid('cmFadeInVal').textContent = e.target.value; persistDraft(); });
    gid('cmFadeOutRange').addEventListener('input', function (e) { CM.draft.ambientAudio.fadeOut = Number(e.target.value); gid('cmFadeOutVal').textContent = e.target.value; persistDraft(); });
    gid('cmLoopToggle').addEventListener('click', function () { CM.draft.ambientAudio.loop = !CM.draft.ambientAudio.loop; CM.els.audio.loop = CM.draft.ambientAudio.loop; persistDraft(); renderMusicPanel(); });
    gid('cmAutoplayToggle').addEventListener('click', function () { CM.draft.ambientAudio.autoplay = !CM.draft.ambientAudio.autoplay; persistDraft(); renderMusicPanel(); });
    gid('cmMuteToggle').addEventListener('click', function () { CM.els.audio.muted = !CM.els.audio.muted; gid('cmMuteToggle').classList.toggle('cm-active', CM.els.audio.muted); });
  }

  // ---- Typography panel ----
  function renderFontPanel() {
    var ty = CM.draft.typography;
    renderPanel('font', panelShell('🔤 Typography', 'font',
      '<div class="cm-field"><div class="cm-field-label">Theme Preset</div><div class="cm-chip-row">' +
        Object.keys(THEME_PRESETS).map(function (k) { return '<button type="button" class="cm-chip' + (ty.themePreset === k ? ' cm-active' : '') + '" data-cm-theme="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="cm-field"><div class="cm-field-label">Font</div><select id="cmFontSelect">' +
        WD().COMPOSITION_FONTS.map(function (f) { return '<option value="' + esc(f) + '"' + (ty.font === f ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') +
      '</select></div>' +
      typoRange('cmFontSize', 'Font Size', ty.fontSize, 14, 32, 1, 'px') +
      typoRange('cmLetterSpacing', 'Letter Spacing', ty.letterSpacing, -0.05, 0.15, 0.005, 'em') +
      typoRange('cmLineHeight', 'Line Height', ty.lineHeight, 1.2, 2.4, 0.05, '') +
      typoRange('cmParaSpacing', 'Paragraph Spacing', ty.paragraphSpacing, 0, 48, 2, 'px') +
      typoRange('cmTextWidth', 'Text Width', ty.textWidth, 400, 1000, 10, 'px') +
      '<div class="cm-field"><div class="cm-field-label">Justification</div><div class="cm-chip-row">' +
        '<button type="button" class="cm-chip' + (ty.justification === 'left' ? ' cm-active' : '') + '" data-cm-justify="left">Left</button>' +
        '<button type="button" class="cm-chip' + (ty.justification === 'justify' ? ' cm-active' : '') + '" data-cm-justify="justify">Justify</button>' +
      '</div></div>'
    ));
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-theme]'), function (b) {
      b.addEventListener('click', function () {
        var preset = THEME_PRESETS[b.dataset.cmTheme];
        Object.assign(CM.draft.typography, preset, { themePreset: b.dataset.cmTheme });
        applyTypography(); persistDraft(); renderFontPanel();
      });
    });
    gid('cmFontSelect').addEventListener('change', function (e) { ty.font = e.target.value; ty.themePreset = 'custom'; applyTypography(); persistDraft(); });
    wireTypoRange('cmFontSize', function (v) { ty.fontSize = v; ty.themePreset = 'custom'; });
    wireTypoRange('cmLetterSpacing', function (v) { ty.letterSpacing = v; ty.themePreset = 'custom'; });
    wireTypoRange('cmLineHeight', function (v) { ty.lineHeight = v; ty.themePreset = 'custom'; });
    wireTypoRange('cmParaSpacing', function (v) { ty.paragraphSpacing = v; });
    wireTypoRange('cmTextWidth', function (v) { ty.textWidth = v; });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-justify]'), function (b) {
      b.addEventListener('click', function () { ty.justification = b.dataset.cmJustify; applyTypography(); persistDraft(); renderFontPanel(); });
    });
  }
  function typoRange(id, label, value, min, max, step, unit) {
    return '<div class="cm-field"><div class="cm-field-label"><span>' + label + '</span><span id="' + id + 'Val">' + value + unit + '</span></div>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></div>';
  }
  function wireTypoRange(id, setter, applyFn) {
    var el = gid(id); if (!el) return;
    applyFn = applyFn || applyTypography;
    var unit = gid(id + 'Val').textContent.replace(/[-\d.]/g, '');
    el.addEventListener('input', function (e) {
      var v = Number(e.target.value);
      setter(v);
      gid(id + 'Val').textContent = v + unit;
      applyFn(); persistDraft();
    });
  }

  // ---- Glass / Overlay panel ----
  function renderGlassPanel() {
    var g = CM.draft.glass, ov = CM.draft.overlay;
    renderPanel('glass', panelShell('🧊 Glass Panel & Overlay', 'glass',
      '<div class="cm-field-label" style="margin-top:2px;">Overlay</div>' +
      typoRange('cmBlur', 'Background Blur', ov.blur, 0, 20, 1, 'px') +
      typoRange('cmDarkOverlay', 'Dark Overlay', ov.darkOverlay, 0, 90, 1, '%') +
      '<div class="cm-field"><div class="cm-field-label">Gradient</div><div class="cm-chip-row">' +
        ['top', 'bottom', 'center', 'radial', 'none'].map(function (gr) { return '<button type="button" class="cm-chip' + (ov.gradientType === gr ? ' cm-active' : '') + '" data-cm-gradient="' + gr + '">' + gr + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="cm-field"><div class="cm-field-label">Tint Color</div><div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="color" id="cmTintColor" value="' + ov.tint.color + '">' +
        '<div class="cm-chip-row">' + ['#3b82f6', '#a855f7', '#ef4444', '#f59e0b', '#22c55e', '#6b7280'].map(function (c) { return '<button type="button" class="cm-chip" data-cm-tint-preset="' + c + '" style="background:' + c + '33;border-color:' + c + '88;">' + c + '</button>'; }).join('') + '</div>' +
      '</div></div>' +
      typoRange('cmTintOpacity', 'Tint Opacity', ov.tint.opacity, 0, 100, 1, '%') +
      '<div class="cm-field-label" style="margin-top:14px;">Glass Panel</div>' +
      typoRange('cmGlassOpacity', 'Opacity', g.opacity, 0, 100, 1, '%') +
      typoRange('cmGlassBlur', 'Glass Blur', g.blurIntensity, 0, 40, 1, 'px') +
      typoRange('cmGlassRadius', 'Corner Radius', g.radius, 0, 40, 1, 'px') +
      typoRange('cmGlassShadow', 'Shadow Strength', g.shadowStrength, 0, 100, 1, '%') +
      typoRange('cmGlassPadding', 'Padding', g.padding, 12, 96, 2, 'px') +
      '<div class="cm-field"><div class="cm-field-label">Width</div><div class="cm-chip-row">' +
        ['narrow', 'book', 'centered', 'left', 'full'].map(function (w) { return '<button type="button" class="cm-chip' + (g.width === w ? ' cm-active' : '') + '" data-cm-width="' + w + '">' + w + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="cm-field"><div class="cm-field-label">Alignment</div><div class="cm-chip-row">' +
        '<button type="button" class="cm-chip' + (g.alignment === 'center' ? ' cm-active' : '') + '" data-cm-align="center">Centered</button>' +
        '<button type="button" class="cm-chip' + (g.alignment === 'left' ? ' cm-active' : '') + '" data-cm-align="left">Left</button>' +
      '</div></div>' +
      '<div class="cm-chip-row" style="margin-top:8px;">' +
        '<button type="button" class="cm-chip' + (CM._immersiveOn ? ' cm-active' : '') + '" id="cmImmersiveToggle">🎬 Immersive (Text Only)</button>' +
        '<button type="button" class="cm-chip' + (CM.highContrast ? ' cm-active' : '') + '" id="cmHighContrastToggle">◐ High Contrast</button>' +
      '</div>' +
      '<div class="cm-hint">Immersive zeroes Opacity, Glass Blur, and Shadow together — the panel disappears entirely and your text sits directly on the sharp background/video. Toggle again to restore your previous glass settings.</div>'
    ));
    wireTypoRange('cmBlur', function (v) { ov.blur = v; }, applyOverlay);
    wireTypoRange('cmDarkOverlay', function (v) { ov.darkOverlay = v; }, applyOverlay);
    wireTypoRange('cmTintOpacity', function (v) { ov.tint.opacity = v; }, applyOverlay);
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-gradient]'), function (b) { b.addEventListener('click', function () { ov.gradientType = b.dataset.cmGradient; applyOverlay(); persistDraft(); renderGlassPanel(); }); });
    gid('cmTintColor').addEventListener('input', function (e) { ov.tint.color = e.target.value; applyOverlay(); persistDraft(); });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-tint-preset]'), function (b) { b.addEventListener('click', function () { ov.tint.color = b.dataset.cmTintPreset; applyOverlay(); persistDraft(); renderGlassPanel(); }); });
    wireTypoRange('cmGlassOpacity', function (v) { g.opacity = v; }, applyGlass);
    wireTypoRange('cmGlassBlur', function (v) { g.blurIntensity = v; }, applyGlass);
    wireTypoRange('cmGlassRadius', function (v) { g.radius = v; }, applyGlass);
    wireTypoRange('cmGlassShadow', function (v) { g.shadowStrength = v; }, applyGlass);
    wireTypoRange('cmGlassPadding', function (v) { g.padding = v; }, applyGlass);
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-width]'), function (b) { b.addEventListener('click', function () { g.width = b.dataset.cmWidth; applyGlass(); persistDraft(); renderGlassPanel(); }); });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-align]'), function (b) { b.addEventListener('click', function () { g.alignment = b.dataset.cmAlign; applyGlass(); persistDraft(); renderGlassPanel(); }); });
    gid('cmHighContrastToggle').addEventListener('click', function () { CM.highContrast = !CM.highContrast; CM.els.root.classList.toggle('cm-high-contrast', CM.highContrast); gid('cmHighContrastToggle').classList.toggle('cm-active', CM.highContrast); });
    gid('cmImmersiveToggle').addEventListener('click', toggleImmersive);
  }

  // ---- Focus panel ----
  function renderFocusPanel() {
    renderPanel('focus', panelShell('🎯 Focus Mode', 'focus',
      '<div class="cm-chip-row">' + ['none', 'line', 'sentence', 'paragraph', 'block', 'scene'].map(function (m) {
        return '<button type="button" class="cm-chip' + (CM.draft.focusMode === m ? ' cm-active' : '') + '" data-cm-focus="' + m + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</button>';
      }).join('') + '</div>' +
      '<div class="cm-hint">Line and Paragraph dim everything outside the current line. Sentence narrows further, inside that line. Block widens to the surrounding run of text. Scene widens to your nearest <code>***</code>-style scene-break markers.</div>' +
      '<div class="cm-field-label" style="margin-top:14px;">Typewriter Mode</div>' +
      '<div class="cm-chip-row"><button type="button" class="cm-chip' + (CM.draft.typewriterMode ? ' cm-active' : '') + '" id="cmTypewriterToggle">⌨ Keep current line centered</button></div>'
    ));
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-focus]'), function (b) {
      b.addEventListener('click', function () { CM.draft.focusMode = b.dataset.cmFocus; applyFocusMode(); persistDraft(); renderFocusPanel(); });
    });
    gid('cmTypewriterToggle').addEventListener('click', function () { CM.draft.typewriterMode = !CM.draft.typewriterMode; applyTypewriter(); persistDraft(); renderFocusPanel(); });
  }

  // ---- Timer panel (session sprint) ----
  function renderTimerPanel() {
    var sprint = CM._sprint || null;
    renderPanel('timer', panelShell('⏱️ Session Timer', 'timer',
      '<div class="cm-field-label">Session Duration</div><div style="font-size:22px;font-weight:800;margin-bottom:12px;" id="cmSessionClock">' + fmtTime((Date.now() - CM.session.startTime) / 1000) + '</div>' +
      '<div class="cm-field-label">Writing Sprint</div>' +
      (sprint
        ? '<div style="font-size:20px;font-weight:800;margin-bottom:8px;" id="cmSprintClock">' + fmtTime(sprint.remaining) + '</div><div class="cm-btn-row"><button type="button" class="cm-btn" id="cmSprintStop">Stop Sprint</button></div>'
        : '<div class="cm-chip-row">' + [10, 15, 25, 45].map(function (m) { return '<button type="button" class="cm-chip" data-cm-sprint="' + m + '">' + m + ' min</button>'; }).join('') + '</div>')
    ));
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-sprint]'), function (b) { b.addEventListener('click', function () { startSprint(Number(b.dataset.cmSprint) * 60); renderTimerPanel(); }); });
    var stopBtn = gid('cmSprintStop'); if (stopBtn) stopBtn.addEventListener('click', function () { stopSprint(); renderTimerPanel(); });
    if (CM._timerPanelInterval) clearInterval(CM._timerPanelInterval);
    CM._timerPanelInterval = setInterval(function () {
      if (CM.activePanel !== 'timer') { clearInterval(CM._timerPanelInterval); return; }
      var clock = gid('cmSessionClock'); if (clock) clock.textContent = fmtTime((Date.now() - CM.session.startTime) / 1000);
      var sc = gid('cmSprintClock'); if (sc && CM._sprint) sc.textContent = fmtTime(CM._sprint.remaining);
    }, 1000);
  }
  function startSprint(seconds) {
    stopSprint();
    CM._sprint = { remaining: seconds, total: seconds };
    CM._sprintInterval = setInterval(function () {
      CM._sprint.remaining--;
      if (CM._sprint.remaining <= 0) { playChime(); stopSprint(); if (CM.activePanel === 'timer') renderTimerPanel(); }
    }, 1000);
  }
  function stopSprint() { clearInterval(CM._sprintInterval); CM._sprint = null; }
  function playChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      o.start(); o.stop(ctx.currentTime + 0.9);
    } catch (e) {}
  }

  // ---- Word Goal panel ----
  function renderWordGoalPanel() {
    renderPanel('wordgoal', panelShell('🏁 Word Goal HUD', 'wordgoal',
      '<div class="cm-chip-row"><button type="button" class="cm-chip' + (CM.draft.hudVisible !== false ? ' cm-active' : '') + '" id="cmHudToggle">👁 Show HUD</button></div>' +
      '<div class="cm-field" style="margin-top:12px;"><div class="cm-field-label">This Chapter\'s Word Goal</div><input type="number" id="cmChapterGoalInput" min="0" value="' + (CM.chapter.wordGoal || '') + '" placeholder="e.g. 2500"></div>' +
      '<div class="cm-hint">Auto-hides while you type; reappears after a short pause.</div>'
    ));
    gid('cmHudToggle').addEventListener('click', function () { CM.draft.hudVisible = CM.draft.hudVisible === false ? true : false; applyToolbarVisibility(); persistDraft(); renderWordGoalPanel(); });
    gid('cmChapterGoalInput').addEventListener('change', function (e) {
      var v = Number(e.target.value) || 0;
      CM.chapter = WD().Chapters.update(CM.chapterId, { wordGoal: v });
      renderHud();
    });
  }

  // ---- Scene Presets panel ----
  function renderPresetsPanel() {
    var list = WD().CompositionPresets.list().slice().sort(function (a, b) { return (b.favorite - a.favorite) || (a.name || '').localeCompare(b.name || ''); });
    var globalDefaultId = WD().getSettings().defaultCompositionPresetId;
    var globalDefaultPreset = globalDefaultId ? WD().CompositionPresets.get(globalDefaultId) : null;
    renderPanel('presets', panelShell('💾 Scene Presets', 'presets',
      '<div class="cm-field"><input type="text" id="cmPresetNameInput" placeholder="Name this scene…"></div>' +
      '<div class="cm-btn-row">' +
        '<button type="button" class="cm-btn cm-btn-primary" id="cmPresetSaveBtn">💾 Save Current as New</button>' +
        '<button type="button" class="cm-btn" id="cmPresetImportBtn">⬆ Import</button>' +
      '</div>' +
      '<label style="display:flex;gap:6px;align-items:center;font-size:11.5px;color:rgba(255,255,255,0.6);margin:10px 0;"><input type="checkbox" id="cmPresetDefaultCheck"' + (CM.chapter.compositionPresetId ? ' checked' : '') + '> Auto-load for this chapter only</label>' +
      '<label style="display:flex;gap:6px;align-items:center;font-size:11.5px;color:rgba(255,255,255,0.6);margin:0 0 10px;"><input type="checkbox" id="cmPresetGlobalDefaultCheck"' + (globalDefaultId ? ' checked' : '') + '> Save as the template for <b>all future chapters</b></label>' +
      (globalDefaultPreset ? '<div class="cm-hint" style="margin-bottom:10px;">🌐 <b style="color:#fff;">' + esc(globalDefaultPreset.name) + '</b> is the current template for every chapter that hasn\'t been customized on its own.</div>' : '') +
      (list.length ? list.map(function (p) {
        var isChapterDefault = CM.chapter.compositionPresetId === p.id;
        var isGlobalDefault = globalDefaultId === p.id;
        return '<div class="cm-preset-row" data-cm-preset-id="' + p.id + '">' +
          '<b>' + (p.favorite ? '⭐ ' : '') + esc(p.name) +
            (isChapterDefault ? ' <span style="opacity:.6;font-weight:400;">(this chapter)</span>' : '') +
            (isGlobalDefault ? ' <span style="opacity:.6;font-weight:400;">(all chapters)</span>' : '') +
          '</b>' +
          '<button type="button" class="cm-btn" data-cm-preset-apply="' + p.id + '">Apply</button>' +
          '<button type="button" class="cm-btn' + (isChapterDefault ? ' cm-active' : '') + '" data-cm-preset-default="' + p.id + '" title="Auto-load for this chapter only">This Chapter</button>' +
          '<button type="button" class="cm-btn' + (isGlobalDefault ? ' cm-active' : '') + '" data-cm-preset-global="' + p.id + '" title="Template for every future chapter">🌐 All Chapters</button>' +
          '<button type="button" class="cm-btn" data-cm-preset-fav="' + p.id + '">' + (p.favorite ? '★' : '☆') + '</button>' +
          '<button type="button" class="cm-btn" data-cm-preset-dup="' + p.id + '">⧉</button>' +
          '<button type="button" class="cm-btn" data-cm-preset-export="' + p.id + '">⬇</button>' +
          '<button type="button" class="cm-btn" data-cm-preset-rename="' + p.id + '">✎</button>' +
          '<button type="button" class="cm-btn" data-cm-preset-del="' + p.id + '">✕</button>' +
        '</div>';
      }).join('') : '<div class="cm-hint">No saved scenes yet — dial in a look, then Save Current as New.</div>')
    ));
    gid('cmPresetSaveBtn').addEventListener('click', function () {
      var name = gid('cmPresetNameInput').value.trim() || 'Untitled Scene';
      var record = WD().CompositionPresets.add(Object.assign({}, CM.draft, { id: undefined, name: name, createdAt: undefined }));
      if (gid('cmPresetDefaultCheck').checked) { CM.chapter = WD().Chapters.update(CM.chapterId, { compositionPresetId: record.id }); }
      if (gid('cmPresetGlobalDefaultCheck').checked) { WD().saveSettings({ defaultCompositionPresetId: record.id }); }
      renderPresetsPanel();
    });
    gid('cmPresetImportBtn').addEventListener('click', function () { gid('cmPresetImportInput').click(); });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-apply]'), function (b) {
      b.addEventListener('click', function () { applyPreset(b.dataset.cmPresetApply); renderPresetsPanel(); });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-default]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.cmPresetDefault;
        var next = CM.chapter.compositionPresetId === id ? null : id; // click again to unassign
        CM.chapter = WD().Chapters.update(CM.chapterId, { compositionPresetId: next });
        renderPresetsPanel();
      });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-global]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.cmPresetGlobal;
        var current = WD().getSettings().defaultCompositionPresetId;
        WD().saveSettings({ defaultCompositionPresetId: current === id ? null : id }); // click again to clear
        renderPresetsPanel();
      });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-fav]'), function (b) {
      b.addEventListener('click', function () { var p = WD().CompositionPresets.get(b.dataset.cmPresetFav); WD().CompositionPresets.update(p.id, { favorite: !p.favorite }); renderPresetsPanel(); });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-dup]'), function (b) {
      b.addEventListener('click', function () { var p = WD().CompositionPresets.get(b.dataset.cmPresetDup); WD().CompositionPresets.add(Object.assign({}, p, { id: undefined, createdAt: undefined, name: p.name + ' Copy' })); renderPresetsPanel(); });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-export]'), function (b) {
      b.addEventListener('click', function () { exportPreset(b.dataset.cmPresetExport); });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-rename]'), function (b) {
      b.addEventListener('click', function () { var p = WD().CompositionPresets.get(b.dataset.cmPresetRename); var name = prompt('Rename scene', p.name); if (name) { WD().CompositionPresets.update(p.id, { name: name.trim() }); renderPresetsPanel(); } });
    });
    Array.prototype.forEach.call(gid('cmPanel').querySelectorAll('[data-cm-preset-del]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Delete this scene preset?')) return;
        WD().CompositionPresets.remove(b.dataset.cmPresetDel);
        if (CM.chapter.compositionPresetId === b.dataset.cmPresetDel) CM.chapter = WD().Chapters.update(CM.chapterId, { compositionPresetId: null });
        if (WD().getSettings().defaultCompositionPresetId === b.dataset.cmPresetDel) WD().saveSettings({ defaultCompositionPresetId: null });
        renderPresetsPanel();
      });
    });
  }
  function applyPreset(presetId) {
    var preset = WD().CompositionPresets.get(presetId); if (!preset) return;
    CM.draft = WD().compositionPresetModel(preset);
    applyDraft(false);
    persistDraft();
  }
  function exportPreset(presetId) {
    var preset = WD().CompositionPresets.get(presetId); if (!preset) return;
    var blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = (preset.name || 'scene-preset').replace(/[^a-z0-9-_]+/gi, '-') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // ---- AI Scene Generator panel ----
  var AI_HEURISTICS = {
    fantasy: { category: 'fantasy', tint: '#6b5bd6', font: 'Cormorant Garamond', particles: ['dust'], ambient: 'forest' },
    horror: { category: 'horror', tint: '#7a1f1f', font: 'IBM Plex Serif', particles: ['fog'], ambient: 'dungeon' },
    'dark fantasy': { category: 'dark-fantasy', tint: '#4b1d5e', font: 'Cormorant Garamond', particles: ['embers', 'fog'], ambient: 'dungeon' },
    romance: { category: 'romance', tint: '#c2447a', font: 'EB Garamond', particles: ['dust'], ambient: 'coffee-shop' },
    thriller: { category: 'cities', tint: '#1d4ed8', font: 'IBM Plex Serif', particles: [], ambient: 'white-noise' },
    'science fiction': { category: 'space', tint: '#0891b2', font: 'Inter', particles: ['stars'], ambient: 'space' },
    mystery: { category: 'libraries', tint: '#374151', font: 'Lora', particles: ['dust'], ambient: 'fireplace' },
    literary: { category: 'cozy-rooms', tint: '#92722a', font: 'Literata', particles: [], ambient: 'lofi' },
    ya: { category: 'forests', tint: '#16a34a', font: 'Lora', particles: ['leaves'], ambient: 'forest' },
    historical: { category: 'ancient-kingdoms', tint: '#a16207', font: 'EB Garamond', particles: ['dust'], ambient: 'castle' }
  };
  var WEATHER_PARTICLES = { rain: ['rain'], snow: ['snow'], storm: ['rain', 'lightning'], clear: [], fog: ['fog'], windy: ['leaves'] };
  function heuristicSuggest(input) {
    var genreKey = (input.genre || '').toLowerCase();
    var base = AI_HEURISTICS[genreKey] || AI_HEURISTICS.fantasy;
    var particles = base.particles.slice();
    var weatherKey = (input.weather || '').toLowerCase();
    Object.keys(WEATHER_PARTICLES).forEach(function (w) { if (weatherKey.indexOf(w) !== -1) particles = particles.concat(WEATHER_PARTICLES[w]); });
    var isNight = /night|dusk|midnight|evening/i.test(input.timeOfDay || '');
    var moodKey = (input.mood || '').toLowerCase();
    var focusMode = /tense|action|fast/.test(moodKey) ? 'sentence' : /calm|reflective|quiet/.test(moodKey) ? 'paragraph' : 'none';
    return {
      background: { type: 'image', category: base.category },
      overlay: { blur: isNight ? 8 : 6, darkOverlay: isNight ? 60 : 42, gradientType: 'bottom', tint: { color: base.tint, opacity: isNight ? 22 : 12 } },
      typography: { font: base.font, themePreset: 'custom' },
      focusMode: focusMode,
      ambientAudio: { category: base.ambient },
      particles: Array.from(new Set(particles)).slice(0, 3),
      presetName: (input.title || 'Untitled Scene') + ' — ' + (base.category || 'scene')
    };
  }
  function renderAiPanel() {
    var chapter = CM.chapter, book = CM.book;
    var hasKey = !!(WD().getSettings().anthropicKey);
    renderPanel('ai', panelShell('✨ AI Scene Generator', 'ai',
      '<div class="cm-ai-tag ' + (hasKey ? 'cm-ai-real' : 'cm-ai-auto') + '">' + (hasKey ? 'AI-GENERATED (Anthropic key configured)' : 'AUTO (local — add a key in this book\'s Settings tab for real AI suggestions)') + '</div>' +
      '<div class="cm-field"><div class="cm-field-label">Title</div><input type="text" id="cmAiTitle" value="' + esc(chapter.title || '') + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Synopsis</div><input type="text" id="cmAiSynopsis" value="' + esc(chapter.summary || '') + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Setting</div><input type="text" id="cmAiSetting" placeholder="e.g. a candlelit library"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Mood</div><input type="text" id="cmAiMood" value="' + esc(book.mood || '') + '"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Time of Day</div><input type="text" id="cmAiTime" placeholder="e.g. night"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Weather</div><input type="text" id="cmAiWeather" placeholder="e.g. storm"></div>' +
      '<div class="cm-field"><div class="cm-field-label">Genre</div><input type="text" id="cmAiGenre" value="' + esc(book.genre || '') + '"></div>' +
      '<div class="cm-btn-row"><button type="button" class="cm-btn cm-btn-primary" id="cmAiGenerateBtn">✨ Generate</button></div>' +
      '<div id="cmAiResult"></div>'
    ));
    gid('cmAiGenerateBtn').addEventListener('click', runAiGenerate);
  }
  function runAiGenerate() {
    var btn = gid('cmAiGenerateBtn'); btn.textContent = '…thinking'; btn.disabled = true;
    var input = {
      title: gid('cmAiTitle').value, synopsis: gid('cmAiSynopsis').value, setting: gid('cmAiSetting').value,
      mood: gid('cmAiMood').value, timeOfDay: gid('cmAiTime').value, weather: gid('cmAiWeather').value, genre: gid('cmAiGenre').value
    };
    var local = heuristicSuggest(input);
    var hasKey = !!(WD().getSettings().anthropicKey);
    if (!hasKey) { showAiResult(local, false); btn.textContent = '✨ Generate'; btn.disabled = false; return; }
    var prompt = 'You are a creative-writing scene-atmosphere designer. Given this chapter context — title: "' + input.title + '", synopsis: "' + input.synopsis + '", setting: "' + input.setting + '", mood: "' + input.mood + '", time of day: "' + input.timeOfDay + '", weather: "' + input.weather + '", genre: "' + input.genre + '" — reply with ONLY a compact JSON object (no prose, no markdown fences) with this exact shape: {"backgroundCategory": one of [' +
      WD().COMPOSITION_BG_CATEGORIES.map(function (c) { return '"' + c.id + '"'; }).join(',') + '], "tintColor": "#hex", "tintOpacity": 0-100, "blur": 0-20, "darkOverlay": 0-90, "gradientType": one of ["top","bottom","center","radial","none"], "font": one of [' +
      WD().COMPOSITION_FONTS.map(function (f) { return '"' + f + '"'; }).join(',') + '], "focusMode": one of ["none","line","sentence","paragraph","block","scene"], "ambientCategory": one of [' +
      WD().COMPOSITION_AMBIENT_LIBRARY.map(function (a) { return '"' + a.id + '"'; }).join(',') + '], "particles": array (0-3) from [' + WD().COMPOSITION_PARTICLE_TYPES.map(function (p) { return '"' + p + '"'; }).join(',') + '], "presetName": "short evocative name"}';
    WD().callAnthropic(prompt).then(function (text) {
      var parsed = null;
      if (text) { try { parsed = JSON.parse(text.trim().replace(/^```json\s*|```$/g, '')); } catch (e) { parsed = null; } }
      if (parsed) {
        showAiResult({
          background: { type: 'image', category: parsed.backgroundCategory },
          overlay: { blur: parsed.blur, darkOverlay: parsed.darkOverlay, gradientType: parsed.gradientType, tint: { color: parsed.tintColor, opacity: parsed.tintOpacity } },
          typography: { font: parsed.font, themePreset: 'custom' },
          focusMode: parsed.focusMode, ambientAudio: { category: parsed.ambientCategory },
          particles: Array.isArray(parsed.particles) ? parsed.particles : [], presetName: parsed.presetName || local.presetName
        }, true);
      } else {
        showAiResult(local, false);
      }
      btn.textContent = '✨ Generate'; btn.disabled = false;
    });
  }
  function showAiResult(suggestion, isAI) {
    CM._aiSuggestion = suggestion;
    var cat = WD().COMPOSITION_BG_CATEGORIES.filter(function (c) { return c.id === suggestion.background.category; })[0];
    gid('cmAiResult').innerHTML =
      '<div class="cm-ai-tag ' + (isAI ? 'cm-ai-real' : 'cm-ai-auto') + '" style="margin-top:12px;">' + (isAI ? 'AI-GENERATED' : 'AUTO') + '</div>' +
      '<div class="cm-hint">' +
        'Scene: <b style="color:#fff;">' + esc(suggestion.presetName) + '</b><br>' +
        'Background: ' + (cat ? cat.icon + ' ' + esc(cat.label) : esc(suggestion.background.category)) + '<br>' +
        'Tint: <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + esc(suggestion.overlay.tint.color) + ';vertical-align:middle;"></span> ' + esc(suggestion.overlay.tint.color) + '<br>' +
        'Font: ' + esc(suggestion.typography.font) + ' · Focus: ' + esc(suggestion.focusMode) + '<br>' +
        'Ambient: ' + esc(suggestion.ambientAudio.category) + ' · Particles: ' + (suggestion.particles.join(', ') || 'none') +
      '</div>' +
      '<div class="cm-btn-row"><button type="button" class="cm-btn cm-btn-primary" id="cmAiApplyBtn">Apply</button></div>';
    gid('cmAiApplyBtn').addEventListener('click', applyAiSuggestion);
  }
  function applyAiSuggestion() {
    var s = CM._aiSuggestion; if (!s) return;
    var cat = WD().COMPOSITION_BACKGROUND_LIBRARY.filter(function (c) { return c.id === s.background.category; })[0];
    var bgUrl = cat ? cat.images[0].url : '';
    var ambient = WD().COMPOSITION_AMBIENT_LIBRARY.filter(function (a) { return a.id === s.ambientAudio.category; })[0];
    CM.draft = WD().compositionPresetModel(Object.assign({}, CM.draft, {
      background: { type: 'image', url: bgUrl, category: s.background.category },
      overlay: s.overlay, typography: Object.assign({}, CM.draft.typography, s.typography),
      focusMode: s.focusMode, ambientAudio: Object.assign({}, CM.draft.ambientAudio, { category: s.ambientAudio.category }),
      particles: s.particles, name: s.presetName
    }));
    applyDraft(false); persistDraft();
    closePanel();
  }

  // ---- Shortcuts reference panel ----
  function renderShortcutsPanel() {
    var rows = [
      ['F11', 'Toggle Composition Mode'], ['Esc', 'Close panel, or exit'],
      ['Ctrl+Shift+B', 'Background'], ['Ctrl+Shift+M', 'Music'], ['Ctrl+Shift+F', 'Focus Mode'],
      ['Ctrl+Shift+Z', 'Zen Mode'], ['Ctrl+Shift+T', 'Transparency (Glass)'], ['Ctrl+Shift+P', 'Scene Presets'],
      ['Ctrl+/', 'This shortcut reference']
    ];
    renderPanel('help', panelShell('⌨ Shortcuts', 'help',
      rows.map(function (r) { return '<div class="cm-hud-row" style="margin-bottom:8px;"><span style="font-family:monospace;background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:6px;">' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('')
    ));
  }

  // ============================================================
  // UPLOAD WIRING — mirrors this app's own openImageUpload()/PhotoStore
  // instant-save-then-background-upload pattern (see renderEditorBg's
  // file-input handler in writing-dashboard.html) rather than forking it.
  // ============================================================
  function wireUploadInputs() {
    gid('cmBgImageInput').addEventListener('change', function () {
      var file = gid('cmBgImageInput').files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        WD().compressImageDataUrl(String(reader.result), 1600, 0.82).then(function (compressed) {
          setBackground(compressed, 'image', 'custom');
          if (window.PhotoStore) PhotoStore.upload(compressed, function (url) { CM.draft.background.url = url; persistDraft(); });
        });
      };
      reader.readAsDataURL(file);
    });
    gid('cmBgVideoInput').addEventListener('change', function () {
      var file = gid('cmBgVideoInput').files[0]; if (!file) return;
      var localUrl = URL.createObjectURL(file);
      setBackground(localUrl, 'video', 'custom');
      if (window.PhotoStore) PhotoStore.upload(file, function (url) { setBackground(url, 'video', 'custom'); });
    });
    gid('cmAudioFileInput').addEventListener('change', function () {
      var file = gid('cmAudioFileInput').files[0]; if (!file) return;
      var localUrl = URL.createObjectURL(file);
      setAmbient(localUrl, CM.draft.ambientAudio.category || 'custom');
      if (window.PhotoStore) PhotoStore.upload(file, function (url) { CM.draft.ambientAudio.url = url; persistDraft(); });
    });
    gid('cmPresetImportInput').addEventListener('change', function () {
      var file = gid('cmPresetImportInput').files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          delete parsed.id; delete parsed.createdAt;
          WD().CompositionPresets.add(parsed);
          renderPresetsPanel();
        } catch (e) { alert('That file isn\'t a valid Scene Preset export.'); }
      };
      reader.readAsText(file);
      gid('cmPresetImportInput').value = '';
    });
  }

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  function onGlobalKeydown(e) {
    if (e.key === 'F11') {
      var ctx = window.WD_activeChapterContext && window.WD_activeChapterContext();
      if (CM.open) { e.preventDefault(); close(); return; }
      if (ctx) { e.preventDefault(); open(ctx.chapterId, ctx.bookId); }
      return;
    }
    if (!CM.open) return;
    if (e.key === 'Escape') {
      if (CM.activePanel) { e.preventDefault(); closePanel(); }
      else { e.preventDefault(); close(); }
      return;
    }
    if (e.ctrlKey && e.shiftKey) {
      var map = { B: 'bg', M: 'music', F: 'focus', P: 'presets' };
      var k = e.key.toUpperCase();
      if (map[k]) { e.preventDefault(); openPanel(map[k]); return; }
      if (k === 'Z') { e.preventDefault(); setZen(!CM.zenOn); syncToolbarActive(); return; }
      if (k === 'T') { e.preventDefault(); openPanel('glass'); return; }
    }
    if (e.ctrlKey && e.key === '/') { e.preventDefault(); openPanel('help'); return; }
  }

  window.CompositionMode = {
    open: open,
    close: close,
    toggle: function (chapterId, bookId) { if (CM.open) close(); else open(chapterId, bookId); },
    isOpen: function () { return CM.open; }
  };
})();
