// =============================================================
// save-state.js — the answer to "did that actually save?"
//
// WHY THIS EXISTS
// The dashboard autosaves nearly everywhere and said so almost
// nowhere: one page out of twenty-four had a live indicator
// (asclepion-journal.html), and everything else either flashed a
// transient toast or stayed silent. Silence is fine right up until
// the moment the answer is no — an offline phone, a failed push, a
// full storage quota — and then silence is the worst possible
// answer, because you carry on typing into something that is not
// keeping it.
//
// WHAT IT READS
// Nothing new. sync.js §ANNOUNCE already reports dirty / saving /
// saved / offline / error per row, local-store-idb.js already counts
// pending IndexedDB writes and fires localstore:writefailed, and the
// snapshot and trash stores already know their own totals. This just
// puts them in one place and draws them.
//
// WHY IT DRAWS ITS OWN CHIP
// main-theme.css carries a ready-made .bs-sync-status component,
// orphaned when Self-Care was removed. It is built on Main's --mn-*
// tokens, which only exist on Main's four pages — so on the other
// twenty it would render as unstyled text. Self-contained instead,
// like the trash toast, for the same reason.
//
// THE RAIL. This module owns the bottom-left container that trash.js
// also draws into, so the two can never overlap each other. The
// bottom-RIGHT corner is not available: palaestra, index and vault
// all park a floating action button there.
// =============================================================

(function (global) {
  'use strict';

  var RAIL_ID = 'dataRail';

  // -----------------------------------------------------------------
  // STATE
  //
  // One row per mounted appKey, because a page can mount several and they
  // fail independently — larder.html carries three. The chip shows the
  // worst of them, since "two of your three rows are saved" is not the
  // thing you need to know.
  // -----------------------------------------------------------------
  var rows = {};                 // appKey -> { state, at, retryIn }
  var lastLocalWrite = 0;
  var storageError = null;

  var RANK = { error: 5, offline: 4, saving: 3, dirty: 2, saved: 1, idle: 0 };

  function worst() {
    var best = 'idle', at = 0;
    Object.keys(rows).forEach(function (k) {
      var r = rows[k];
      if ((RANK[r.state] || 0) > (RANK[best] || 0)) best = r.state;
      if (r.state === 'saved' && r.at > at) at = r.at;
    });
    if (storageError) return { state: 'error', at: at, storage: true };
    return { state: best, at: at, storage: false };
  }

  function unsyncedCount() {
    var n = 0;
    Object.keys(rows).forEach(function (k) {
      if (rows[k].state === 'dirty' || rows[k].state === 'saving' ||
          rows[k].state === 'offline' || rows[k].state === 'error') n++;
    });
    return n;
  }

  // -----------------------------------------------------------------
  // WORDS
  //
  // Each state says what is true and, where it is not good news, what is
  // being done about it. "Offline — saved on this device" is the whole
  // point: the work is not at risk, only the copy of it elsewhere is.
  // -----------------------------------------------------------------
  function label(s) {
    if (s.storage) return 'Storage problem';
    switch (s.state) {
      case 'error':   return 'Sync failed';
      case 'offline': return 'Offline';
      case 'saving':  return 'Saving';
      case 'dirty':   return 'Saving';
      case 'saved':   return 'Saved';
      default:        return 'Saved';
    }
  }

  function ago(t) {
    if (!t) return 'never';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  // -----------------------------------------------------------------
  // THE CHIP
  //
  // Hue is spent only where it carries meaning. Good states are white at
  // low opacity, so the chip disappears into nine different page designs
  // rather than picking a side among them. Trouble states get a colour,
  // because there the colour IS the message — and they are the states you
  // are meant to notice from across the room.
  // -----------------------------------------------------------------
  var CSS = [
    '#' + RAIL_ID + '{position:fixed;z-index:99998;left:16px;bottom:16px;display:flex;',
      'flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none;',
      'max-width:min(360px,calc(100vw - 32px))}',
    '@media (max-width:719px){#' + RAIL_ID + '{left:12px;right:12px;',
      'bottom:calc(88px + env(safe-area-inset-bottom,0px));max-width:none}}',

    '.ss-chip{pointer-events:auto;order:99;display:inline-flex;align-items:center;gap:7px;',
      'border:0;border-radius:999px;cursor:pointer;padding:6px 11px 6px 9px;',
      'background:rgba(18,17,16,.72);border:1px solid rgba(255,255,255,.10);',
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
      'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
      'font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;',
      'color:rgba(242,239,234,.5);transition:color .2s ease,border-color .2s ease,background-color .2s ease}',
    '.ss-chip:hover{color:rgba(242,239,234,.9);border-color:rgba(255,255,255,.22);',
      'background:rgba(18,17,16,.88)}',
    '.ss-chip:focus-visible{outline:2px solid rgba(242,239,234,.8);outline-offset:2px}',
    '.ss-dot{width:5px;height:5px;border-radius:50%;background:rgba(242,239,234,.45);flex:none}',
    '.ss-chip.is-saving .ss-dot{animation:ss-pulse 1.3s ease-in-out infinite}',
    '.ss-chip.is-offline{color:#E3B25F;border-color:rgba(227,178,95,.3)}',
    '.ss-chip.is-offline .ss-dot{background:#E3B25F}',
    '.ss-chip.is-error{color:#E58177;border-color:rgba(229,129,119,.35)}',
    '.ss-chip.is-error .ss-dot{background:#E58177;animation:ss-pulse 1.3s ease-in-out infinite}',
    '@keyframes ss-pulse{0%,100%{opacity:1}50%{opacity:.25}}',

    '.ss-panel{pointer-events:auto;order:98;width:min(320px,100%);border-radius:12px;',
      'background:rgba(18,17,16,.95);border:1px solid rgba(255,255,255,.14);',
      'box-shadow:0 12px 32px -10px rgba(0,0,0,.7);',
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);padding:13px 14px;',
      'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
      'color:#F2EFEA;font-size:12.5px;line-height:1.5}',
    '.ss-panel h4{margin:0 0 9px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;',
      'color:rgba(242,239,234,.5);font-weight:600}',
    '.ss-row{display:flex;justify-content:space-between;gap:14px;padding:3px 0}',
    '.ss-row dt{color:rgba(242,239,234,.55);margin:0}',
    '.ss-row dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}',
    '.ss-note{margin:9px 0 0;padding-top:9px;border-top:1px solid rgba(255,255,255,.1);',
      'color:rgba(242,239,234,.6);font-size:12px}',
    '.ss-out{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}',
    '.ss-out-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}',
    '.ss-out-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;',
      'color:rgba(242,239,234,.45);font-weight:600;flex:1 0 100%}',
    '.ss-out button{min-height:30px;padding:0 11px;border-radius:7px;cursor:pointer;',
      'background:transparent;color:#F2EFEA;border:1px solid rgba(255,255,255,.26);',
      'font:inherit;font-size:12px;font-weight:600;',
      'transition:background-color .18s ease,color .18s ease,border-color .18s ease}',
    '.ss-out button:hover{background:#F2EFEA;color:#121110;border-color:#F2EFEA}',
    '.ss-out button:focus-visible{outline:2px solid #F2EFEA;outline-offset:2px}',
    '@media (pointer:coarse){.ss-out button{min-height:44px;padding:0 14px}}',
    '@media (prefers-reduced-motion:reduce){.ss-dot{animation:none!important}',
      '.ss-chip{transition:none}}',
    '@media (pointer:coarse){.ss-chip{padding:10px 14px 10px 12px}}'
  ].join('');

  var railEl = null, chipEl = null, panelEl = null, styled = false;

  /** The shared bottom-left rail. trash.js draws into this too. */
  function rail() {
    if (!styled) {
      try {
        var s = document.createElement('style');
        s.setAttribute('data-ss', '');
        s.textContent = CSS;
        document.head.appendChild(s);
        styled = true;
      } catch (e) { return null; }
    }
    if (!railEl || !railEl.isConnected) {
      railEl = document.getElementById(RAIL_ID);
      if (!railEl) {
        railEl = document.createElement('div');
        railEl.id = RAIL_ID;
        document.body.appendChild(railEl);
      }
    }
    return railEl;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function paint() {
    var host = rail();
    if (!host) return;
    if (!chipEl || !chipEl.isConnected) {
      chipEl = document.createElement('button');
      chipEl.type = 'button';
      chipEl.className = 'ss-chip';
      chipEl.setAttribute('aria-live', 'polite');
      chipEl.addEventListener('click', togglePanel);
      host.appendChild(chipEl);
    }
    var s = worst();
    var text = label(s);
    chipEl.className = 'ss-chip' +
      (s.state === 'saving' || s.state === 'dirty' ? ' is-saving' : '') +
      (s.state === 'offline' ? ' is-offline' : '') +
      (s.state === 'error' ? ' is-error' : '');
    chipEl.innerHTML = '<span class="ss-dot"></span><span>' + esc(text) + '</span>';
    chipEl.setAttribute('aria-label', text + '. Open data status.');
    chipEl.setAttribute('aria-expanded', panelEl ? 'true' : 'false');
    if (panelEl) renderPanel();
  }

  function facts() {
    var snapCount = 0, snapNewest = 0;
    try {
      if (global.Snapshots) {
        global.Snapshots.stores().forEach(function (st) {
          var t = st.stats();
          snapCount += t.count;
          if (t.newest > snapNewest) snapNewest = t.newest;
        });
      }
    } catch (e) {}
    var trashCount = 0;
    try { if (global.Trash) trashCount = global.Trash.stats().count; } catch (e) {}
    var drafts = 0;
    try { if (global.AthDraft) drafts = (global.AthDraft.keys() || []).length; } catch (e) {}
    var pending = 0, failures = 0, backend = 'unknown';
    try {
      if (global.LocalStoreIDB) {
        pending = global.LocalStoreIDB.pendingWrites ? global.LocalStoreIDB.pendingWrites() : 0;
        failures = global.LocalStoreIDB.writeFailures ? global.LocalStoreIDB.writeFailures() : 0;
        backend = global.LocalStoreIDB.backend ? global.LocalStoreIDB.backend() : 'unknown';
      }
    } catch (e) {}
    return {
      snapCount: snapCount, snapNewest: snapNewest, trashCount: trashCount,
      drafts: drafts, pending: pending, failures: failures, backend: backend
    };
  }

  function renderPanel() {
    if (!panelEl) return;
    var s = worst(), f = facts(), un = unsyncedCount();
    var note = '';
    if (s.storage) {
      note = 'This device could not finish writing to its own storage. ' +
             'Space may be full — export a copy before making more changes.';
    } else if (s.state === 'offline') {
      note = 'Your work is saved on this device. It will sync on its own when the connection is back.';
    } else if (s.state === 'error') {
      note = 'Saved on this device, but the cloud copy is behind. Retrying automatically.';
    }
    panelEl.innerHTML =
      '<h4>Data status</h4>' +
      '<dl style="margin:0">' +
        row('Saved on this device', lastLocalWrite ? ago(lastLocalWrite) : 'no edits yet') +
        row('Synced to the cloud', s.at ? ago(s.at) : 'not yet') +
        row('Waiting to sync', un ? un + (un === 1 ? ' row' : ' rows') : 'nothing') +
        row('Local storage', f.backend === 'indexeddb' ? 'IndexedDB'
             : f.backend === 'native' ? 'browser storage' : f.backend) +
        (f.pending ? row('Writes in flight', String(f.pending)) : '') +
        (f.failures ? row('Failed writes', String(f.failures)) : '') +
        row('Snapshots', f.snapCount ? f.snapCount + ' · newest ' + ago(f.snapNewest) : 'none yet') +
        row('In Trash', f.trashCount ? String(f.trashCount) : 'empty') +
        (f.drafts ? row('Unsaved drafts', String(f.drafts)) : '') +
      '</dl>' +
      (note ? '<p class="ss-note">' + esc(note) + '</p>' : '') +
      exportHtml();
    wireExport();
  }

  // -----------------------------------------------------------------
  // EXPORT
  //
  // Lives here because this panel is the one piece of UI on all 24 pages.
  // Six apps had no way out at all and a seventh (AscSync.download) had a
  // function reachable only from a console — building a ⋯ menu into each
  // of two dozen documents is how it stayed that way.
  //
  // JSON is the restore format; Markdown is the one that still opens in
  // ten years with no dashboard at all.
  // -----------------------------------------------------------------
  function pageApp() {
    try {
      var R = global.DataRegistry;
      return R && R.appForPage ? R.appForPage() : null;
    } catch (e) { return null; }
  }

  function exportHtml() {
    if (!global.DataExport || !global.DataRegistry) return '';
    var app = pageApp();
    var h = '<div class="ss-out">';
    if (app) {
      h += '<div class="ss-out-row"><span class="ss-out-label">Export ' + esc(app.label) + '</span>' +
           '<button type="button" data-x="json">JSON</button>' +
           '<button type="button" data-x="md">Markdown</button></div>';
    }
    h += '<div class="ss-out-row"><span class="ss-out-label">Export everything</span>' +
         '<button type="button" data-x="alljson">JSON</button>' +
         '<button type="button" data-x="allmd">Markdown</button></div></div>';
    return h;
  }

  function wireExport() {
    if (!panelEl) return;
    var app = pageApp();
    panelEl.querySelectorAll('.ss-out button').forEach(function (b) {
      b.addEventListener('click', function () {
        var what = b.getAttribute('data-x'), res = null;
        try {
          if (what === 'json' && app) res = global.DataExport.json([app.id]);
          else if (what === 'md' && app) res = global.DataExport.markdown(app.id);
          else if (what === 'alljson') res = global.DataExport.json();
          else if (what === 'allmd') res = global.DataExport.markdownAll();
        } catch (e) { res = { ok: false }; }
        // Say what happened. A download that silently did not start is the
        // one outcome an export must never have.
        var was = b.textContent;
        b.textContent = res && res.ok ? 'Saved' : (res && res.empty ? 'Nothing yet' : 'Blocked');
        setTimeout(function () { b.textContent = was; }, 1800);
      });
    });
  }

  function row(k, v) {
    return '<div class="ss-row"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
  }

  function togglePanel() {
    if (panelEl) { closePanel(); return; }
    var host = rail();
    if (!host) return;
    panelEl = document.createElement('div');
    panelEl.className = 'ss-panel';
    host.appendChild(panelEl);
    renderPanel();
    chipEl.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onKey);
    }, 0);
  }
  function closePanel() {
    if (!panelEl) return;
    try { panelEl.remove(); } catch (e) {}
    panelEl = null;
    if (chipEl) chipEl.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  }
  function onDocClick(e) {
    if (panelEl && !panelEl.contains(e.target) && e.target !== chipEl && !chipEl.contains(e.target)) closePanel();
  }
  function onKey(e) { if (e.key === 'Escape') closePanel(); }

  // -----------------------------------------------------------------
  // WIRING
  // -----------------------------------------------------------------
  var repaint = null;
  function schedulePaint() {
    clearTimeout(repaint);
    repaint = setTimeout(paint, 60);
  }

  function boot() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    paint();

    global.addEventListener('sync:state', function (e) {
      var d = e && e.detail;
      if (!d || !d.appKey) return;
      rows[d.appKey] = { state: d.state, at: d.at || 0, retryIn: d.retryIn || 0 };
      if (d.state === 'dirty') lastLocalWrite = Date.now();
      schedulePaint();
    });

    // A failed IndexedDB write is more serious than a failed push: the cloud
    // copy being behind is recoverable, this device not keeping the work at
    // all is not.
    global.addEventListener('localstore:writefailed', function (e) {
      storageError = (e && e.detail) || true;
      schedulePaint();
    });

    global.addEventListener('online', schedulePaint);
    global.addEventListener('offline', schedulePaint);
    global.addEventListener('snapshots:store', schedulePaint);
    global.addEventListener('trash:restored', schedulePaint);
  }

  global.SaveState = {
    RAIL_ID: RAIL_ID,
    boot: boot,
    rail: rail,
    paint: paint,
    rows: function () { return JSON.parse(JSON.stringify(rows)); },
    facts: facts,
    worst: worst,
    /** For a page that wants to say "saved" next to its own editor. */
    label: function () { return label(worst()); }
  };

  boot();
})(window);
