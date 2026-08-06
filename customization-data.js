// customization-data.js
//
// Shared data foundation for customization.html ("Customization Studio")
// — the control center for this dashboard's own appearance/behavior
// preferences. Same conventions as every other -data.js in this app: one
// `customization:` prefix, one localStorage key per collection, no
// server/DB, covered by customization.html's own
// initCloudSync({ syncedPrefixes: ['customization:'] }).
//
// SCOPE, disclosed rather than silently narrowed: this app is ~30
// independent, hand-built static HTML files (CLAUDE.md §1) — none share a
// router, and most carry their own PRIVATE color-token names (--bh-gold,
// --rt-gold, --at-gold, --gt-accent, …), not one shared theme contract
// (CLAUDE.md §3/§6). So "control every visual aspect of my Personal
// Dashboard" is honored two ways, both real:
//   1. This Studio, and design-library.html (built alongside it, on the
//      same glass-theme.css/.js foundation), genuinely live-apply every
//      appearance setting on themselves — accent color, typography, card
//      radius, spacing, wallpaper — via applyThemeToDocument() below,
//      which repaints glass-theme.css's own --gt-* custom properties on
//      <html>. That's a real, working "theme my dashboard" loop for the
//      two pages built to read it.
//   2. Retroactively repainting all ~30 OTHER existing pages (each with
//      its own private token set, several already carrying an explicit,
//      deliberate one-off palette exception per CLAUDE.md §6/DO NOT
//      MODIFY rule 2) is a standing architecture change bigger than one
//      session, not something to force through quietly. What IS wired
//      into the one truly shared file, topbar.js, and is therefore real
//      dashboard-wide: nav group ORDER (Navigation Manager → a saved
//      `topbar:navGroupOrder`) and PINNED pages (→ `topbar:pinnedHrefs`,
//      rendered as a synthetic Favorites group) — see topbar.js's own
//      header comment on both.
//
// BACKUP & RESTORE, genuinely real: local-store-idb.js (see its own
// header) moved this app's storage engine from browser localStorage (a
// hard ~5-10MB per-origin cap that this app hit and fixed once already)
// to IndexedDB — so a real, in-app Snapshot can safely hold a full
// serialized copy of every localStorage key without reintroducing that
// quota problem. Manual/scheduled export-to-file is offered too, as the
// portable, off-device copy a pure in-app snapshot can never be.

(function (global) {
  'use strict';

  function storeGet(key) { try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); } catch (e) { return null; } }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('customization:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('customization:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }
  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

  const KEYS = {
    settings: 'customization:settings',
    palettes: 'customization:palettes',
    personas: 'customization:personas',
    automations: 'customization:automations',
    snapshots: 'customization:snapshots',
    presets: 'customization:presets',
    changeLog: 'customization:changeLog',
    seeded: 'customization:seeded'
  };

  // ============================================================
  // THEME PRESETS — 16 named presets, each a full color set. "Custom"
  // isn't in this table — it's simply whatever the Color Studio's own
  // fields currently hold.
  // ============================================================
  const THEME_PRESETS = {
    'midnight-aurora': { label: 'Midnight Aurora', bg: '#0a0a0b', bgDeep: '#050506', accent: '#ff3b4a', accentBright: '#ff6f7a', text: '#fafafa' },
    dark: { label: 'Dark', bg: '#111113', bgDeep: '#08080a', accent: '#7dd3fc', accentBright: '#a7e4ff', text: '#f4f4f5' },
    light: { label: 'Light', bg: '#f7f6f3', bgDeep: '#ffffff', accent: '#b45309', accentBright: '#d97706', text: '#1c1917' },
    oled: { label: 'OLED', bg: '#000000', bgDeep: '#000000', accent: '#6ee7b7', accentBright: '#a7f3d0', text: '#ffffff' },
    cyberpunk: { label: 'Cyberpunk', bg: '#0a0014', bgDeep: '#050009', accent: '#ff2fd0', accentBright: '#00f6ff', text: '#f2e8ff' },
    fantasy: { label: 'Fantasy', bg: '#140a1f', bgDeep: '#0a0512', accent: '#c9a876', accentBright: '#e8cf9f', text: '#f3ecff' },
    gothic: { label: 'Gothic', bg: '#0d0709', bgDeep: '#050303', accent: '#b23a4d', accentBright: '#e05a70', text: '#f2e6e6' },
    minimal: { label: 'Minimal', bg: '#141414', bgDeep: '#0a0a0a', accent: '#e5e5e5', accentBright: '#ffffff', text: '#f5f5f5' },
    modern: { label: 'Modern', bg: '#0f1115', bgDeep: '#080a0d', accent: '#818cf8', accentBright: '#a5b4fc', text: '#f1f5f9' },
    forest: { label: 'Forest', bg: '#0c1410', bgDeep: '#060b08', accent: '#4ade80', accentBright: '#86efac', text: '#eef7f0' },
    ocean: { label: 'Ocean', bg: '#08131c', bgDeep: '#040a10', accent: '#22d3ee', accentBright: '#67e8f9', text: '#eaf8fc' },
    sunset: { label: 'Sunset', bg: '#170e0a', bgDeep: '#0c0705', accent: '#fb923c', accentBright: '#fdba74', text: '#fdf3ec' },
    coffee: { label: 'Coffee', bg: '#160f0a', bgDeep: '#0b0705', accent: '#c9a876', accentBright: '#e0c39a', text: '#f2e9dd' },
    academic: { label: 'Academic', bg: '#12100c', bgDeep: '#0a0806', accent: '#b45309', accentBright: '#d97706', text: '#f1ece1' },
    vintage: { label: 'Vintage', bg: '#181410', bgDeep: '#0c0a08', accent: '#c17a4a', accentBright: '#dd9a6c', text: '#f2e8dc' },
    sakura: { label: 'Sakura', bg: '#160f13', bgDeep: '#0b070a', accent: '#f472b6', accentBright: '#f9a8d4', text: '#fdf1f6' },
    winter: { label: 'Winter', bg: '#0a0f14', bgDeep: '#05080b', accent: '#93c5fd', accentBright: '#bfdbfe', text: '#eef4fb' },
    autumn: { label: 'Autumn', bg: '#150e08', bgDeep: '#0a0704', accent: '#d97706', accentBright: '#f59e0b', text: '#f4ece0' },
    space: { label: 'Space', bg: '#07070c', bgDeep: '#030305', accent: '#a78bfa', accentBright: '#c4b5fd', text: '#f2f0fb' },
    glass: { label: 'Glass', bg: '#0d0f14', bgDeep: '#06070a', accent: '#38bdf8', accentBright: '#7dd3fc', text: '#f3f6fa' }
  };
  const FONT_OPTIONS = {
    heading: ['Cormorant Garamond', 'Inter', 'Georgia', 'Playfair Display', 'system-ui'],
    body: ['Inter', 'system-ui', 'Georgia', 'ui-monospace'],
    mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas']
  };
  const AI_USE_CASES = ['Writing', 'Research', 'Learning', 'Coding', 'Business', 'Creative'];
  const AUTOMATION_TRIGGERS = { onLoad: 'Every time this page opens', dateBased: 'On a specific day of the week', visitMilestone: 'Every N visits' };
  const AUTOMATION_ACTIONS = { toast: 'Show a toast reminder', banner: 'Show a banner until dismissed' };

  function hexToRgbTriplet(hex, fallback) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return fallback || '255,59,74';
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }
  function hexToRgb(hex) {
    const t = hexToRgbTriplet(hex).split(',').map(Number);
    return { r: t[0], g: t[1], b: t[2] };
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function hexToHsl(hex) {
    const rgb = hexToRgb(hex), r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // ============================================================
  // SETTINGS — a single evolving record (same get/save-a-record shape as
  // aitech-data.js's hero).
  // ============================================================
  function settingsModel(data) {
    data = data || {};
    const preset = THEME_PRESETS[data.themePreset] ? data.themePreset : 'midnight-aurora';
    const presetDef = THEME_PRESETS[preset];
    return {
      themePreset: preset,
      colors: Object.assign({
        primary: presetDef.accent, secondary: presetDef.accentBright, accent: presetDef.accent,
        background: presetDef.bg, sidebar: presetDef.bgDeep, cards: 'rgba(255,255,255,0.05)',
        buttons: presetDef.accent, borders: 'rgba(255,255,255,0.1)', links: presetDef.accentBright,
        text: presetDef.text, highlight: presetDef.accentBright, warning: '#fbbf24', error: '#ff8a8a', success: '#6ee7b7'
      }, (data.colors && typeof data.colors === 'object') ? data.colors : {}),
      colorFormat: ['hex', 'rgb', 'hsl'].indexOf(data.colorFormat) !== -1 ? data.colorFormat : 'hex',
      gradientAngle: typeof data.gradientAngle === 'number' ? data.gradientAngle : 135,
      wallpaperType: ['gradient', 'solid', 'image', 'none'].indexOf(data.wallpaperType) !== -1 ? data.wallpaperType : 'gradient',
      wallpaperImage: typeof data.wallpaperImage === 'string' ? data.wallpaperImage : '',
      wallpaperBlur: typeof data.wallpaperBlur === 'number' ? data.wallpaperBlur : 0,
      wallpaperBrightness: typeof data.wallpaperBrightness === 'number' ? data.wallpaperBrightness : 1,
      wallpaperOpacity: typeof data.wallpaperOpacity === 'number' ? data.wallpaperOpacity : 1,
      wallpaperMotion: data.wallpaperMotion !== false,
      headingFont: FONT_OPTIONS.heading.indexOf(data.headingFont) !== -1 ? data.headingFont : 'Cormorant Garamond',
      bodyFont: FONT_OPTIONS.body.indexOf(data.bodyFont) !== -1 ? data.bodyFont : 'Inter',
      monoFont: FONT_OPTIONS.mono.indexOf(data.monoFont) !== -1 ? data.monoFont : 'ui-monospace',
      baseFontSize: typeof data.baseFontSize === 'number' ? data.baseFontSize : 14,
      fontWeight: typeof data.fontWeight === 'number' ? data.fontWeight : 500,
      lineHeight: typeof data.lineHeight === 'number' ? data.lineHeight : 1.55,
      letterSpacing: typeof data.letterSpacing === 'number' ? data.letterSpacing : 0,
      cardRadius: typeof data.cardRadius === 'number' ? data.cardRadius : 20,
      spacingScale: typeof data.spacingScale === 'number' ? data.spacingScale : 1,
      sidebarWidth: typeof data.sidebarWidth === 'number' ? data.sidebarWidth : 280,
      contentMaxWidth: typeof data.contentMaxWidth === 'number' ? data.contentMaxWidth : 1180,
      density: ['comfortable', 'compact'].indexOf(data.density) !== -1 ? data.density : 'comfortable',
      iconStyle: ['emoji', 'minimal', 'rounded'].indexOf(data.iconStyle) !== -1 ? data.iconStyle : 'emoji',
      restoreLastPage: !!data.restoreLastPage,
      zenMode: !!data.zenMode,
      reminderFrequency: ['off', 'daily', 'weekly'].indexOf(data.reminderFrequency) !== -1 ? data.reminderFrequency : 'off',
      aiKey: typeof data.aiKey === 'string' ? data.aiKey : '',
      aiPersona: typeof data.aiPersona === 'string' ? data.aiPersona : 'a senior product designer and front-end engineer',
      aiCreativity: typeof data.aiCreativity === 'number' ? data.aiCreativity : 0.6,
      aiResponseLength: ['short', 'medium', 'long'].indexOf(data.aiResponseLength) !== -1 ? data.aiResponseLength : 'medium',
      aiMemoryPreference: typeof data.aiMemoryPreference === 'string' ? data.aiMemoryPreference : 'Remember my stated design preferences within this session.',
      lastBackupAt: typeof data.lastBackupAt === 'number' ? data.lastBackupAt : null,
      backupReminderDays: typeof data.backupReminderDays === 'number' ? data.backupReminderDays : 7,
      flags: Object.assign({ reducedMotionOverride: false, compactDensity: false, betaFuzzySearch: true, liveThemePreview: true }, (data.flags && typeof data.flags === 'object') ? data.flags : {}),
      privacyAcknowledged: !!data.privacyAcknowledged
    };
  }
  function getSettings() { return settingsModel(storeGet(KEYS.settings)); }
  function saveSettings(patch) {
    const merged = Object.assign({}, getSettings(), patch);
    if (patch && patch.colors) merged.colors = Object.assign({}, getSettings().colors, patch.colors);
    if (patch && patch.flags) merged.flags = Object.assign({}, getSettings().flags, patch.flags);
    const next = settingsModel(merged);
    storeSet(KEYS.settings, next);
    logChange('Updated settings');
    return next;
  }
  /** Applies a theme preset wholesale — resets every color field to that
   * preset's own values (a custom tweak made afterward is not preserved,
   * matching how picking a whole new preset is meant to behave). */
  function applyPreset(presetKey) {
    const def = THEME_PRESETS[presetKey];
    if (!def) return getSettings();
    return saveSettings({
      themePreset: presetKey,
      colors: Object.assign({}, getSettings().colors, {
        primary: def.accent, secondary: def.accentBright, accent: def.accent, buttons: def.accent, links: def.accentBright, highlight: def.accentBright,
        background: def.bg, sidebar: def.bgDeep, text: def.text
      })
    });
  }

  // ============================================================
  // LIVE APPLY — repaints glass-theme.css's own --gt-* custom properties
  // (see that file's header: any page overriding them after its own
  // <link> picks up the new values automatically). This is the real,
  // working half of "theme my dashboard" — see this file's own header
  // comment for what it does and doesn't reach.
  // ============================================================
  function applyThemeToDocument(settingsOrNull) {
    const s = settingsOrNull || getSettings();
    const root = document.documentElement.style;
    root.setProperty('--gt-accent', s.colors.accent);
    root.setProperty('--gt-accent-bright', s.colors.secondary);
    root.setProperty('--gt-accent-rgb', hexToRgbTriplet(s.colors.accent));
    root.setProperty('--gt-bgfx-rgb', hexToRgbTriplet(s.colors.accent));
    root.setProperty('--gt-bg', s.colors.background);
    root.setProperty('--gt-bg-deep', s.colors.sidebar);
    root.setProperty('--gt-text', s.colors.text);
    root.setProperty('--gt-warn', s.colors.warning);
    root.setProperty('--gt-bad', s.colors.error);
    root.setProperty('--gt-good', s.colors.success);
    root.setProperty('--gt-info', s.colors.links);
    root.setProperty('--gt-radius', s.cardRadius + 'px');
    root.setProperty('--gt-radius-sm', Math.max(6, s.cardRadius - 4) + 'px');
    root.setProperty('--gt-radius-lg', (s.cardRadius + 4) + 'px');
    root.setProperty('--gt-font', '"' + s.bodyFont + '", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
    document.body && document.body.style.setProperty('font-size', s.baseFontSize + 'px');
    document.body && document.body.classList.toggle('cz-density-compact', s.density === 'compact' || s.flags.compactDensity);
    document.body && document.body.classList.toggle('cz-reduced-motion', !!s.flags.reducedMotionOverride);
    return s;
  }

  // ============================================================
  // SAVED PALETTES
  // ============================================================
  function paletteModel(data) {
    data = data || {};
    return { id: data.id || uid('pal'), title: typeof data.title === 'string' ? data.title : 'Untitled Palette', colors: Array.isArray(data.colors) ? data.colors : [], createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) { const record = model(data); const all = list(); all.push(record); storeSet(key, all); logChange('Added to ' + key.split(':')[1]); return record; }
    function update(id, patch) {
      const all = list(); const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) { const all = list(); const next = all.filter(function (x) { return x.id !== id; }); storeSet(key, next); return next.length !== all.length; }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }
  const Palettes = makeCollection(KEYS.palettes, paletteModel);

  // ============================================================
  // SAVED AI PERSONAS
  // ============================================================
  function personaModel(data) {
    data = data || {};
    return { id: data.id || uid('per'), name: typeof data.name === 'string' ? data.name : '', useCase: AI_USE_CASES.indexOf(data.useCase) !== -1 ? data.useCase : 'Writing', prompt: typeof data.prompt === 'string' ? data.prompt : '', createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }
  const Personas = makeCollection(KEYS.personas, personaModel);

  // ============================================================
  // AUTOMATIONS — client-side triggers evaluated on load, since this app
  // has no backend/cron of any kind (§1). Scoped honestly: these fire
  // when customization.html or design-library.html is actually open, not
  // as OS-level notifications — see header comment.
  // ============================================================
  function automationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('auto'),
      title: typeof data.title === 'string' ? data.title : '',
      trigger: AUTOMATION_TRIGGERS[data.trigger] ? data.trigger : 'onLoad',
      dayOfWeek: typeof data.dayOfWeek === 'number' ? data.dayOfWeek : 1,
      everyNVisits: typeof data.everyNVisits === 'number' ? data.everyNVisits : 7,
      action: AUTOMATION_ACTIONS[data.action] ? data.action : 'toast',
      message: typeof data.message === 'string' ? data.message : '',
      enabled: data.enabled !== false,
      visitCount: typeof data.visitCount === 'number' ? data.visitCount : 0,
      lastFiredAt: typeof data.lastFiredAt === 'number' ? data.lastFiredAt : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const Automations = makeCollection(KEYS.automations, automationModel);
  /** Evaluates every enabled automation against "now" and returns the
   * ones that should fire this load — genuinely computed, not decorative:
   * onLoad always fires (once per page load, debounced by lastFiredAt >
   * 5 min ago so a reload-storm doesn't spam it), dateBased checks the
   * real day of week, visitMilestone checks a real incrementing counter. */
  function dueAutomations() {
    const now = Date.now();
    const today = new Date().getDay();
    const due = [];
    Automations.list().forEach(function (a) {
      if (!a.enabled) return;
      const recentlyFired = a.lastFiredAt && (now - a.lastFiredAt) < 5 * 60 * 1000;
      let visitCount = a.visitCount + 1;
      let shouldFire = false;
      if (a.trigger === 'onLoad') shouldFire = !recentlyFired;
      else if (a.trigger === 'dateBased') shouldFire = today === a.dayOfWeek && (!a.lastFiredAt || (now - a.lastFiredAt) > 20 * 60 * 60 * 1000);
      else if (a.trigger === 'visitMilestone') shouldFire = visitCount % Math.max(1, a.everyNVisits) === 0;
      Automations.update(a.id, { visitCount: visitCount, lastFiredAt: shouldFire ? now : a.lastFiredAt });
      if (shouldFire) due.push(a);
    });
    return due;
  }

  // ============================================================
  // SNAPSHOTS — full-dashboard backups. Real, since local-store-idb.js
  // moved this app's storage off the old ~5-10MB localStorage cap (see
  // header). Capped at the 10 most recent to keep growth bounded.
  // ============================================================
  function snapshotModel(data) {
    data = data || {};
    return { id: data.id || uid('snap'), label: typeof data.label === 'string' ? data.label : '', data: (data.data && typeof data.data === 'object') ? data.data : {}, keyCount: typeof data.keyCount === 'number' ? data.keyCount : 0, sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0, createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }
  function collectAllLocalStorage() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      if (v == null) continue;
      try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
    }
    return out;
  }
  function createSnapshot(label) {
    const data = collectAllLocalStorage();
    const json = JSON.stringify(data);
    const record = snapshotModel({ label: label || ('Snapshot — ' + new Date().toLocaleString()), data: data, keyCount: Object.keys(data).length, sizeBytes: json.length });
    const all = storeGet(KEYS.snapshots) || [];
    all.unshift(record);
    storeSet(KEYS.snapshots, all.slice(0, 10));
    saveSettings({ lastBackupAt: Date.now() });
    logChange('Created snapshot "' + record.label + '"');
    return record;
  }
  function snapshotsSorted() { return (storeGet(KEYS.snapshots) || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; }); }
  function deleteSnapshot(id) { storeSet(KEYS.snapshots, snapshotsSorted().filter(function (s) { return s.id !== id; })); }
  /** Restores every key from a snapshot's own data back into real
   * localStorage — this is a real, direct write (bypassing the generic
   * makeCollection layer, since a snapshot spans every page's own keys,
   * not just this file's own). A confirm() is expected to happen in the
   * calling page before this runs, since it can overwrite real data. */
  function restoreSnapshot(id) {
    const snap = snapshotsSorted().find(function (s) { return s.id === id; });
    if (!snap) return false;
    Object.keys(snap.data).forEach(function (k) {
      const v = snap.data[k];
      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {}
    });
    logChange('Restored snapshot "' + snap.label + '"');
    return true;
  }
  function exportSnapshotToFile(snap) {
    const blob = new Blob([JSON.stringify(snap.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dashboard-backup-' + new Date(snap.createdAt).toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function exportAllNow() {
    const data = collectAllLocalStorage();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dashboard-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    saveSettings({ lastBackupAt: Date.now() });
    logChange('Exported a backup file');
  }
  /** Imports a parsed JSON object (from a previously exported file) back
   * into real localStorage — same direct-write shape as restoreSnapshot,
   * same "caller must confirm first" expectation. Returns the number of
   * keys written. */
  function importFromObject(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    let n = 0;
    Object.keys(obj).forEach(function (k) {
      const v = obj[k];
      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); n++; } catch (e) {}
    });
    logChange('Imported ' + n + ' keys from a backup file');
    return n;
  }
  function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : null; }

  // ============================================================
  // WORKSPACE PRESETS — save/apply just the customization settings (not
  // a full snapshot) as a named, reusable preset.
  // ============================================================
  function presetModel(data) {
    data = data || {};
    return { id: data.id || uid('wp'), title: typeof data.title === 'string' ? data.title : 'Untitled Preset', settings: (data.settings && typeof data.settings === 'object') ? data.settings : {}, createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now() };
  }
  const Presets = makeCollection(KEYS.presets, presetModel);
  function saveCurrentAsPreset(title) {
    const p = Presets.add({ title: title, settings: getSettings() });
    logChange('Saved workspace preset "' + title + '"');
    return p;
  }
  function applyPresetById(id) {
    const p = Presets.get(id);
    if (!p) return null;
    logChange('Applied workspace preset "' + p.title + '"');
    return saveSettings(p.settings);
  }

  // ============================================================
  // CHANGE LOG — a plain, capped list of recent settings changes, shown
  // on the Customization Home command center ("Recent Changes").
  // ============================================================
  function logChange(text) {
    const all = storeGet(KEYS.changeLog) || [];
    all.unshift({ id: uid('log'), text: text, at: Date.now() });
    storeSet(KEYS.changeLog, all.slice(0, 30));
  }
  function recentChanges(n) { return (storeGet(KEYS.changeLog) || []).slice(0, n || 8); }

  // ============================================================
  // NAVIGATION MANAGER — genuinely wired into topbar.js (see that file's
  // own header comment for how it reads these two keys):
  //   topbar:navGroupOrder  — an array of group keys; topbar.js sorts its
  //                           NAV_GROUPS by this order if present.
  //   topbar:pinnedHrefs    — an array of page hrefs; topbar.js renders a
  //                           synthetic "⭐ Favorites" group from these.
  // This file owns simple get/set helpers for both, plus a static mirror
  // of topbar.js's own NAV_GROUPS shape (label + hrefs only) so this page
  // can build a manager UI without needing to load topbar.js as a script
  // dependency (topbar.js self-injects DOM on load, which this settings
  // page doesn't want happening a second time inside its own content
  // area — so the list below is a plain, hand-kept-in-sync data mirror,
  // not a live read of topbar.js's internals).
  // ============================================================
  const NAV_MIRROR = [
    { key: 'command', label: 'Command Center', hrefs: ['index.html', 'mainpillar.html', 'tasks.html', 'tasksnotes.html'] },
    { key: 'businessdash', label: 'Business Dashboard', hrefs: ['businessdash.html'] },
    { key: 'fitnessstudiotab', label: 'Fitness Studio', hrefs: ['fitnessstudio.html'] },
    { key: 'business', label: 'Business', hrefs: ['writing-dashboard.html'] },
    { key: 'entertainment', label: 'Entertainment', hrefs: ['entertainment-dash.html'] },
    { key: 'knowledgehub', label: 'Knowledge Hub', hrefs: ['knowledge-hub.html'] },
    { key: 'learninghub', label: 'Learning', hrefs: ['learning-dashboard.html'] },
    { key: 'life', label: 'Life & Wellness', hrefs: ['nutrition.html'] },
    { key: 'create', label: 'Create & Grow', hrefs: ['dreamboard.html', 'aitech.html', 'entertainment.html'] },
    { key: 'system', label: 'System', hrefs: ['design-library.html', 'customization.html'] }
  ];
  function getNavGroupOrder() { return storeGet('topbar:navGroupOrder') || NAV_MIRROR.map(function (g) { return g.key; }); }
  function saveNavGroupOrder(orderedKeys) { storeSet('topbar:navGroupOrder', orderedKeys); logChange('Reordered navigation'); }
  function getPinnedHrefs() { return storeGet('topbar:pinnedHrefs') || []; }
  function togglePinnedHref(href) {
    const pins = getPinnedHrefs();
    const has = pins.indexOf(href) !== -1;
    storeSet('topbar:pinnedHrefs', has ? pins.filter(function (h) { return h !== href; }) : pins.concat([href]));
    logChange((has ? 'Unpinned ' : 'Pinned ') + href);
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Palettes.replaceAll([]);
    Personas.replaceAll([]);
    Automations.replaceAll([]);
    Presets.replaceAll([]);

    Palettes.add({ title: 'Sunset Ember', colors: ['#2b0f1e', '#7c1d3a', '#e0654b', '#f2a154', '#fff3e2'] });
    Palettes.add({ title: 'Deep Ocean', colors: ['#04101c', '#0c2b3e', '#146c73', '#5fd6c4', '#eafcf9'] });
    Palettes.add({ title: 'Midnight Aurora', colors: ['#050506', '#0a0a0b', '#ff3b4a', '#ff6f7a', '#fafafa'] });

    Personas.add({ name: 'Precise Editor', useCase: 'Writing', prompt: 'You are a precise, no-nonsense editor. Cut filler, keep my voice, never add flowery language.' });
    Personas.add({ name: 'Senior Design Engineer', useCase: 'Coding', prompt: 'You are a senior product designer and front-end engineer. Favor accessible, responsive, dark-mode-first solutions with minimal dependencies.' });
    Personas.add({ name: 'Skeptical Researcher', useCase: 'Research', prompt: 'You are a skeptical researcher who cites sources and flags uncertainty rather than smoothing over it.' });

    Automations.add({ title: 'Weekly backup reminder', trigger: 'dateBased', dayOfWeek: 1, action: 'toast', message: "It's Monday — consider taking a fresh dashboard backup from Backup & Restore." });
    Automations.add({ title: 'Design Library check-in', trigger: 'visitMilestone', everyNVisits: 5, action: 'toast', message: 'You\'ve opened this a few times — anything new worth saving to the Design Library?' });

    storeSet(KEYS.changeLog, []);
    logChange('Set up Customization Studio');
    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Palettes.list().length || Personas.list().length || Automations.list().length) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }
  // Deliberately not auto-called — same empty-storage seed-race reasoning
  // as every other page's own -data.js in this app.

  global.CustomizationData = {
    KEYS: KEYS,
    THEME_PRESETS: THEME_PRESETS,
    FONT_OPTIONS: FONT_OPTIONS,
    AI_USE_CASES: AI_USE_CASES,
    AUTOMATION_TRIGGERS: AUTOMATION_TRIGGERS,
    AUTOMATION_ACTIONS: AUTOMATION_ACTIONS,
    NAV_MIRROR: NAV_MIRROR,
    uid: uid,
    hexToRgbTriplet: hexToRgbTriplet,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    hexToHsl: hexToHsl,
    getSettings: getSettings,
    saveSettings: saveSettings,
    applyPreset: applyPreset,
    applyThemeToDocument: applyThemeToDocument,
    Palettes: Palettes,
    Personas: Personas,
    Automations: Automations,
    dueAutomations: dueAutomations,
    createSnapshot: createSnapshot,
    snapshotsSorted: snapshotsSorted,
    deleteSnapshot: deleteSnapshot,
    restoreSnapshot: restoreSnapshot,
    exportSnapshotToFile: exportSnapshotToFile,
    exportAllNow: exportAllNow,
    importFromObject: importFromObject,
    collectAllLocalStorage: collectAllLocalStorage,
    daysSince: daysSince,
    Presets: Presets,
    saveCurrentAsPreset: saveCurrentAsPreset,
    applyPresetById: applyPresetById,
    logChange: logChange,
    recentChanges: recentChanges,
    getNavGroupOrder: getNavGroupOrder,
    saveNavGroupOrder: saveNavGroupOrder,
    getPinnedHrefs: getPinnedHrefs,
    togglePinnedHref: togglePinnedHref,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
