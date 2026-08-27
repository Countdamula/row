/* =====================================================================
   athenaeum-drafts.js — nothing you have typed is lost to a refresh.

   THE PROBLEM, IN THREE PARTS.

   1. Every form in the Athenaeum lives in the DOM until Save is pressed.
      Close the tab, hit Ctrl+R, or let the browser reload after an update,
      and the whole thing is gone — a long Add-resource form, a chapter
      title, a note you had half written.
   2. The rich editors on a resource page commit on a 700ms debounce, so a
      refresh can take the last three quarters of a second of typing.
   3. localStorage here is local-store-idb.js's shim: setItem updates an
      in-memory Map synchronously but only *queues* an IndexedDB write, and
      that transaction commits after control returns to the event loop. A
      document torn down in between loses it. This is documented, and the
      documented conclusion is the one this file is built on:

          a flush on beforeunload often never commits.
          autosave WHILE TYPING is the real fix.

   SO: drafts are written on every keystroke, and they are written to the
   REAL localStorage rather than the shim.

   Why the real one. The shim is asynchronous by construction — that is the
   whole point of it. Native localStorage is synchronous: the value is
   committed before setItem() returns, which is exactly the guarantee a
   hard refresh needs. It is reached through a hidden same-origin iframe,
   whose window was never patched, so this file borrows durability without
   touching the shared shim or the data layer at all.

   Drafts are deliberately prefixed 'athdraft:', NOT 'ath:'. sync.js
   matches on `k.indexOf(prefix) === 0`, so this prefix never matches
   syncedPrefixes:['ath:'] and scratch never reaches Supabase or another
   device. Unsynced scratch belongs outside syncedPrefixes.

   A draft is a safety net, never a source of truth: it is cleared the
   moment the real record is written, and restoring one always tells the
   reader it happened and offers to discard it.

     AthDraft.bind(scope, rootEl, {onRestore})  watch a form, restore a draft
     AthDraft.put(scope, fields)                write one by hand
     AthDraft.get(scope)                        {fields, at} | null
     AthDraft.clear(scope)                      done — throw the net away
     AthDraft.age(scope)                        "4m ago"
   ===================================================================== */
(function () {
  'use strict';

  var PREFIX = 'athdraft:';
  // A draft is scratch, not an archive. Anything older than this is from a
  // session that is long over and restoring it would be a surprise, not a
  // rescue.
  var MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;
  // Native localStorage is a shared ~5MB origin budget that this app has
  // already outgrown once — that is why the IndexedDB shim exists. A draft
  // over this size goes to the shim instead, which is still far better than
  // holding it only in the DOM.
  var MAX_NATIVE_BYTES = 256 * 1024;

  /* The real, unpatched localStorage. local-store-idb.js redefines
     window.localStorage on the TOP window only, so a same-origin iframe's
     contentWindow still exposes the genuine synchronous one. */
  var nativeLS = (function () {
    try {
      var host = document.body || document.documentElement;
      if (!host) return null;
      var f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('tabindex', '-1');
      f.title = '';
      f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
      host.appendChild(f);
      var ls = f.contentWindow.localStorage;
      // Prove it is writable before trusting it — private modes throw here.
      ls.setItem(PREFIX + '__probe', '1');
      ls.removeItem(PREFIX + '__probe');
      return ls;
    } catch (e) { return null; }
  })();

  /* Falls back to the shim when there is no native store, or when a draft
     is too large for the origin's localStorage budget. */
  function write(key, value) {
    if (nativeLS && value.length <= MAX_NATIVE_BYTES) {
      try { nativeLS.setItem(key, value); removeShim(key); return true; }
      catch (e) { pruneOldest(); try { nativeLS.setItem(key, value); return true; } catch (e2) {} }
    }
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function read(key) {
    var v = null;
    if (nativeLS) { try { v = nativeLS.getItem(key); } catch (e) {} }
    if (v == null) { try { v = window.localStorage.getItem(key); } catch (e) {} }
    return v;
  }
  function removeShim(key) {
    try { window.localStorage.removeItem(key); } catch (e) {}
  }
  /* Cleared from BOTH stores on purpose. The shim hydrates its Map from
     native localStorage at boot, so a draft removed from only one of them
     comes back from the dead on the next load. */
  function wipe(key) {
    if (nativeLS) { try { nativeLS.removeItem(key); } catch (e) {} }
    removeShim(key);
  }

  function allKeys() {
    var out = [];
    if (nativeLS) {
      try {
        for (var i = 0; i < nativeLS.length; i++) {
          var k = nativeLS.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k);
        }
      } catch (e) {}
    }
    try {
      for (var j = 0; j < window.localStorage.length; j++) {
        var k2 = window.localStorage.key(j);
        if (k2 && k2.indexOf(PREFIX) === 0 && out.indexOf(k2) < 0) out.push(k2);
      }
    } catch (e) {}
    return out;
  }
  function pruneOldest() {
    var recs = allKeys().map(function (k) {
      var d = null;
      try { d = JSON.parse(read(k)); } catch (e) {}
      return { key: k, at: (d && d.at) || 0 };
    }).sort(function (a, b) { return a.at - b.at; });
    // Drop the oldest third — enough headroom to be worth the write.
    recs.slice(0, Math.max(1, Math.ceil(recs.length / 3))).forEach(function (r) { wipe(r.key); });
  }
  function sweepExpired() {
    var now = Date.now();
    allKeys().forEach(function (k) {
      var d = null;
      try { d = JSON.parse(read(k)); } catch (e) {}
      if (!d || !d.at || (now - d.at) > MAX_AGE_MS) wipe(k);
    });
  }

  function put(scope, fields) {
    if (!scope) return;
    var body = { at: Date.now(), fields: fields || {} };
    write(PREFIX + scope, JSON.stringify(body));
  }
  function get(scope) {
    if (!scope) return null;
    var raw = read(PREFIX + scope);
    if (!raw) return null;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { return null; }
    if (!d || !d.fields) return null;
    if (d.at && (Date.now() - d.at) > MAX_AGE_MS) { wipe(PREFIX + scope); return null; }
    return d;
  }
  function clear(scope) { if (scope) wipe(PREFIX + scope); }

  function age(scope) {
    var d = get(scope);
    if (!d || !d.at) return '';
    var s = Math.max(0, Math.floor((Date.now() - d.at) / 1000));
    if (s < 60) return 'a moment ago';
    var m = Math.floor(s / 60); if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    return Math.floor(h / 24) + ' days ago';
  }

  // ------------------------------------------------------------------
  // Reading and writing a form.
  //
  // [data-f] covers every input, select, textarea and the hidden inputs the
  // chip pickers write into; [contenteditable] covers the rich surfaces a
  // dialog can carry. Between them that is every field in the Athenaeum.
  // ------------------------------------------------------------------
  function fieldsOf(root) {
    var out = {};
    if (!root) return out;
    root.querySelectorAll('[data-f]').forEach(function (n) {
      out[n.getAttribute('data-f')] = n.value;
    });
    var i = 0;
    root.querySelectorAll('[contenteditable]').forEach(function (n) {
      out['__rich' + (i++)] = n.innerHTML;
    });
    return out;
  }
  function applyFields(root, fields) {
    if (!root || !fields) return 0;
    var n = 0;
    root.querySelectorAll('[data-f]').forEach(function (el) {
      var k = el.getAttribute('data-f');
      if (!(k in fields)) return;
      if (el.value !== fields[k]) n++;
      el.value = fields[k];
      // The chip rows are the visible half of a hidden input — putting the
      // value back is not enough, the chips have to agree with it.
      var row = root.querySelector('[data-chips="' + k + '"]');
      if (row) {
        var on = String(fields[k] || '').split(',').filter(Boolean);
        row.querySelectorAll('[data-chip]').forEach(function (c) {
          var isOn = on.indexOf(c.getAttribute('data-chip')) >= 0;
          c.classList.toggle('is-on', isOn);
          c.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        });
      }
    });
    var i = 0;
    root.querySelectorAll('[contenteditable]').forEach(function (el) {
      var k = '__rich' + (i++);
      if (!(k in fields)) return;
      if (el.innerHTML !== fields[k]) n++;
      el.innerHTML = fields[k];
      el.classList.toggle('is-empty', !String(fields[k] || '').replace(/<[^>]*>/g, '').trim());
    });
    return n;
  }

  /* A short, stable hash of a form's STARTING values.
     Two modals can share a title — "Edit concept" is the same string for
     every concept — so a scope keyed on the title alone would offer
     concept A's draft while concept B is open. Folding the opening state
     into the key means each record gets its own, and a blank "new X" form
     naturally shares one draft across every attempt at it. */
  function fingerprint(root) {
    var s = JSON.stringify(fieldsOf(root));
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /* Watch a form. Restores any draft first, then writes one on every edit.
     Returns a handle whose .clear() is what a successful save calls. */
  function bind(scope, root, opts) {
    opts = opts || {};
    if (!root) return { clear: function () {}, restored: false };

    var restored = false;
    var d = get(scope);
    if (d && !opts.skipRestore) {
      // Only counts as a restore if it actually changed something — a draft
      // identical to the form is not worth announcing.
      restored = applyFields(root, d.fields) > 0;
      if (restored && typeof opts.onRestore === 'function') opts.onRestore(age(scope));
    }

    var timer = null;
    // Once a binding is finished with, every one of its listeners has to
    // stop. A detached binding that kept listening would re-write the draft
    // from the stale form still sitting in the DOM — which is exactly how
    // a CANCELLED form came back from the dead on the next refresh.
    var dead = false;

    function writeNow() { if (!dead) put(scope, fieldsOf(root)); }
    function save() {
      if (dead) return;
      clearTimeout(timer);
      // Coalesced rather than written per keystroke: the value is a whole
      // form, and typing is fast.
      timer = setTimeout(writeNow, 120);
    }
    function onInput() { save(); }
    // Backstops, not the mechanism — the keystroke-level writes above are
    // what actually carry the data, because a flush at unload is documented
    // in this repo as often never committing.
    function onHide() { if (document.visibilityState === 'hidden') writeNow(); }
    function onPageHide() { writeNow(); }

    ['input', 'change'].forEach(function (evt) { root.addEventListener(evt, onInput, true); });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);

    function detach() {
      dead = true;
      clearTimeout(timer);
      ['input', 'change'].forEach(function (evt) { root.removeEventListener(evt, onInput, true); });
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    }

    return {
      restored: restored,
      // Keep the draft, stop watching — the form is going away for a reason
      // that is not the reader's decision.
      save: function () { if (!dead) { clearTimeout(timer); put(scope, fieldsOf(root)); } detach(); },
      // The work is either saved for real or deliberately thrown away.
      clear: function () { detach(); clear(scope); }
    };
  }

  try { sweepExpired(); } catch (e) {}

  /* A visible, dismissible notice that something was put back.
     athenaeum-resource-editor.js has the original of this; it is here so
     the generic form modals on Business OS, the Learning Dashboard and The
     Vault get the same affordance without each inventing one.

     STYLED FROM currentColor ON PURPOSE. It is injected into whatever
     dialog is open, and those run from near-black to — on the Learning
     Dashboard, which has its own light/dark toggle — white. A strip that
     picked its own surface colour would be unreadable on one of them.
     Inheriting the text colour and using a mid-grey hairline is legible on
     both, and needs no per-page CSS. */
  function banner(root, whenText, onDiscard) {
    if (!root) return null;
    var el = document.createElement('div');
    el.setAttribute('data-athdraft-banner', '');
    el.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px', 'margin:0 0 14px',
      'padding:9px 11px', 'border:1px solid rgba(128,128,128,.45)',
      'border-radius:8px', 'background:rgba(128,128,128,.10)',
      'font-size:13px', 'line-height:1.4', 'color:inherit'
    ].join(';');
    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1;min-width:0';
    msg.textContent = 'Unsaved changes from ' + (whenText || 'earlier') + ' were put back.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Discard';
    btn.style.cssText = [
      'flex:none', 'min-height:32px', 'padding:0 12px', 'cursor:pointer',
      'border:1px solid rgba(128,128,128,.5)', 'border-radius:6px',
      'background:transparent', 'color:inherit', 'font:inherit',
      'font-size:12px', 'font-weight:600'
    ].join(';');
    btn.addEventListener('click', function () {
      try { if (onDiscard) onDiscard(); } catch (e) {}
      try { el.remove(); } catch (e) {}
    });
    el.appendChild(msg);
    el.appendChild(btn);
    root.insertBefore(el, root.firstChild);
    return el;
  }

  window.AthDraft = {
    bind: bind, put: put, get: get, clear: clear, age: age, banner: banner,
    fieldsOf: fieldsOf, applyFields: applyFields, fingerprint: fingerprint,
    keys: function () { return allKeys().map(function (k) { return k.slice(PREFIX.length); }); },
    // Exposed so a page can tell the reader whether it has the synchronous
    // guarantee or is leaning on the shim.
    isDurable: function () { return !!nativeLS; }
  };
})();
