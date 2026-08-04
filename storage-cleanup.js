// storage-cleanup.js
//
// A small, deliberately conservative "free up space" utility for the
// "this site's local storage is full" failure entertainment-dash.html
// and knowledge-hub.html can now hit (see their own save-error banners).
// This app has no server-side storage — every page shares ONE ~5MB
// browser-imposed localStorage budget for this origin (see CLAUDE.md
// §4) — so a page that's never touched a single byte of image data can
// still be the one that tips a shared quota over, once enough other
// pages' data has accumulated.
//
// Same "shared UI utility, owns no data of its own" precedent as this
// app's topbar.js/sync.js/photo-store.js/glass-theme.js/gallery-card.js.
//
// DEAD_PREFIXES/DEAD_EXACT_KEYS below were built by grepping this app's
// ENTIRE current repository, not by trusting CLAUDE.md's own prose (it
// documents a long history of pages being added/removed/merged, and
// explicitly warns its own text can go stale — see its §6 philosophy).
// Each entry here was individually confirmed to have ZERO remaining
// references anywhere in any currently-existing .html/.js file — no
// syncedPrefixes/syncedKeys entry, no storeGet/storeSet/localStorage
// call, not even inside a one-time migration function — before being
// added. Several other CLAUDE.md-documented "orphaned" keys were
// checked and deliberately EXCLUDED because they're still referenced by
// a live one-time migration that may not have run on every device yet
// (enthub:stories, anxiety:* — selfcare.html's own
// migrateLegacyAnxietyPage() still reads it) or are still explicitly
// synced by a live page (ent:cards/ent:categories/media:active_gallery/
// media:migrated_v1, still in entertainment.html's own syncedKeys) —
// deleting either class of key could silently push a real deletion to
// that page's shared Supabase row, or destroy data a migration hasn't
// had a chance to copy forward yet on this specific device. Nothing
// here is ever deleted automatically — openPanel() always requires an
// explicit click before anything is removed.
(function (global) {
  'use strict';

  var DEAD_PREFIXES = ['stack:', 'proj:', 'study:', 'mediaverse:', 'home:'];
  var DEAD_EXACT_KEYS = ['po_water_v1'];

  function isDead(key) {
    if (DEAD_EXACT_KEYS.indexOf(key) !== -1) return true;
    for (var i = 0; i < DEAD_PREFIXES.length; i++) {
      if (key.indexOf(DEAD_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  // UTF-16 code units * 2 bytes — the realistic approximation of what
  // actually counts against a browser's storage quota; good enough for
  // a "how much would this free" estimate, not a byte-exact audit.
  function byteSize(str) { return (str || '').length * 2; }

  function usageReport() {
    var total = 0, deadTotal = 0, deadKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      var v = localStorage.getItem(k) || '';
      var size = byteSize(k) + byteSize(v);
      total += size;
      if (isDead(k)) { deadTotal += size; deadKeys.push(k); }
    }
    return { total: total, deadTotal: deadTotal, deadKeys: deadKeys };
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // Deletes only the keys usageReport() already identified as dead —
  // never anything a currently-live page's own syncedPrefixes/
  // syncedKeys could be watching, so this can never get pushed as a
  // "deletion" to any Supabase row; nothing is watching these keys
  // anymore, on any page, for any reason.
  function freeDeadSpace() {
    var report = usageReport();
    report.deadKeys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    return report;
  }

  // Reuses .gt-modal-bg/.gt-modal/.gt-modal-actions/.gt-btn (glass-theme
  // .css, already loaded by every page that would call this) rather than
  // a bespoke modal — .gt-modal-bg is already registered in topbar.js's
  // MODAL_SELECTORS, so this gets the shared mobile scroll-lock for free.
  function openPanel() {
    var existing = document.getElementById('scPanelBg');
    if (existing) existing.remove();
    var report = usageReport();
    var bg = document.createElement('div');
    bg.id = 'scPanelBg';
    bg.className = 'gt-modal-bg show';
    var modal = document.createElement('div');
    modal.className = 'gt-modal';
    modal.style.maxWidth = '440px';
    var h3 = document.createElement('h3');
    h3.textContent = '🧹 Free up storage space';
    modal.appendChild(h3);
    var p1 = document.createElement('p');
    p1.style.cssText = 'font-size:13px;color:var(--gt-text-dim,#a09a8c);line-height:1.5;margin:0 0 10px;';
    p1.textContent = 'This site is using about ' + formatBytes(report.total) + ' of your browser’s ~5 MB storage budget for this origin — shared across every page in this app, not just this one.';
    modal.appendChild(p1);
    var p2 = document.createElement('p');
    p2.style.cssText = 'font-size:13px;color:var(--gt-text-dim,#a09a8c);line-height:1.5;margin:0 0 14px;';
    if (report.deadKeys.length) {
      p2.textContent = 'Found ' + report.deadKeys.length + ' leftover key' + (report.deadKeys.length === 1 ? '' : 's') + ' from pages that no longer exist in this app (' + formatBytes(report.deadTotal) + ') — safe to remove, nothing reads or writes them anymore.';
    } else {
      p2.textContent = 'No leftover data from deleted pages was found here — whatever’s filling storage is data a page you actually still use needs (photos, cards, etc.), so removing it has to be a choice you make on that page, not something this can safely do for you.';
    }
    modal.appendChild(p2);
    var actions = document.createElement('div');
    actions.className = 'gt-modal-actions';
    if (report.deadKeys.length) {
      var freeBtn = document.createElement('button');
      freeBtn.type = 'button';
      freeBtn.className = 'gt-btn gt-btn-primary';
      freeBtn.textContent = 'Delete ' + formatBytes(report.deadTotal) + ' of leftover data';
      freeBtn.addEventListener('click', function () {
        var freed = freeDeadSpace();
        p2.textContent = 'Freed ' + formatBytes(freed.deadTotal) + '. Try adding your item again.';
        freeBtn.remove();
      });
      actions.appendChild(freeBtn);
    }
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'gt-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () { bg.remove(); });
    actions.appendChild(closeBtn);
    modal.appendChild(actions);
    bg.appendChild(modal);
    bg.addEventListener('click', function (e) { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
  }

  global.StorageCleanup = {
    usageReport: usageReport,
    freeDeadSpace: freeDeadSpace,
    formatBytes: formatBytes,
    openPanel: openPanel
  };
})(window);
