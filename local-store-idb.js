// =============================================================
// local-store-idb.js — swaps this app's local storage backend from
// browser localStorage (a shared ~5-10MB-per-origin cap, the thing that
// keeps throwing QuotaExceededError as this app has grown) to IndexedDB
// (typically hundreds of MB to several GB, browser-dependent), while
// keeping every existing page's data layer, and sync.js's own Supabase
// cross-device sync, completely unchanged.
//
// The one hard constraint that shapes this whole file: IndexedDB has no
// synchronous read API. So this can't be a purely invisible swap — every
// page's real boot/render call has to wait for one short, one-time async
// hydration step (window.LocalStoreIDB.ready(), a Promise) before it
// runs. Everything else — every page's own storeGet/storeSet, every
// -data.js file, sync.js's own localStorage.setItem monkey-patch,
// topbar.js, photo-store.js, storage-cleanup.js — needs zero changes,
// because they all go through the single global `localStorage` object,
// which is the one thing this file replaces.
//
// MUST be the very first <script> tag loaded on every page, and MUST
// NOT be `defer`red — a plain blocking <script src="local-store-idb.js">,
// placed before every other script tag (including ones some pages put at
// the bottom of <body> instead of <head>, and businessdash.html's own
// non-deferred sync.js/photo-store.js tags) — a blocking script always
// runs before anything that comes after it in the document, deferred or
// not, so "first tag, non-deferred" is the one placement rule that works
// correctly on every page regardless of that page's own script layout.
//
// How it works:
//   1. Synchronously (before <body> even exists — no DOM access needed),
//      seeds an in-memory Map from whatever's already in REAL native
//      localStorage right now. This is what makes every existing read
//      correct immediately, with zero "looks empty" flash, even before
//      any async work below finishes — including pages that read
//      localStorage at bare top-level script scope with no gating at all
//      (e.g. mainpillar.html's `activeTab: localStorage.getItem(...)`)
//      — by the time that line runs, this script (being first, blocking)
//      has already installed and seeded.
//   2. Replaces window.localStorage itself via Object.defineProperty —
//      Window.localStorage is spec'd [Replaceable] specifically so this
//      works; the same standards-based technique test-mocking libraries
//      already rely on. Safety fallback: if IndexedDB isn't available,
//      or this throws for any reason, the shim simply never installs —
//      real native localStorage is left completely untouched and the
//      app behaves exactly as it did before this file existed.
//   3. Opens (or creates) an IndexedDB database and, once that resolves
//      (asynchronously): the first time ever, bulk-copies the
//      just-seeded Map into it so it becomes self-sufficient going
//      forward; every time after that, overlays whatever IndexedDB
//      already holds on top of the Map (IndexedDB wins — native
//      localStorage is only ever a frozen day-zero snapshot from before
//      this file was first installed). Either way, resolves ready().
//   4. Every setItem() updates the Map instantly (synchronous return, so
//      every existing caller — including sync.js's own monkey-patch —
//      keeps working completely unchanged) and separately persists to
//      IndexedDB in the background. It does NOT also write to real
//      native localStorage — new writes can never hit that old quota
//      again, which is the actual point of this file.
//   5. Cross-tab live updates, preserved deliberately, not silently
//      dropped: real native localStorage automatically fires a
//      'storage' event on `window` in OTHER tabs of the same origin —
//      sync.js's own storage listener and topbar.js's badge refresh both
//      depend on that. Once every tab has its own private in-memory Map,
//      that stops happening on its own, so this file uses a
//      BroadcastChannel to notify sibling tabs on every write, and each
//      tab re-dispatches a real, spec-shaped `window` 'storage' event
//      from that broadcast — every existing listener anywhere in this
//      app keeps working unchanged, same-tab behavior included (native
//      'storage' never fires in the tab that made the change either;
//      this mirrors that).
// =============================================================
(function () {
  'use strict';
  if (window.__LocalStoreIDBInstalled) return;

  var DB_NAME = 'personal-dashboard-kv';
  var DB_VERSION = 1;
  var KV_STORE = 'kv';
  var META_STORE = 'meta';
  var BROADCAST_NAME = 'personal-dashboard-kv-sync';

  var readyResolve, readyReject;
  var readyPromise = new Promise(function (resolve, reject) { readyResolve = resolve; readyReject = reject; });

  function resolveReadyNow() { try { readyResolve(); } catch (e) {} }

  // -------- Step 1: synchronous seed from real native localStorage --------
  // At this point nothing has been overridden yet, so the bare
  // `localStorage` identifier still refers to the browser's real Storage
  // object — safe to read directly.
  var map = new Map();
  try {
    var nativeLen = localStorage.length;
    for (var i = 0; i < nativeLen; i++) {
      var k = localStorage.key(i);
      if (k == null) continue;
      map.set(k, localStorage.getItem(k));
    }
  } catch (e) {
    // Real localStorage itself is inaccessible (very old/locked-down
    // browser, some privacy modes) — proceed with an empty Map; the
    // shim still installs and works, just with nothing carried forward.
  }

  // -------- Step 2: build the shim and install it as window.localStorage --------
  var bc = null;
  try { if (typeof BroadcastChannel !== 'undefined') bc = new BroadcastChannel(BROADCAST_NAME); } catch (e) { bc = null; }

  function broadcastChange(key, oldValue, newValue) {
    if (!bc) return;
    try { bc.postMessage({ key: key, oldValue: oldValue, newValue: newValue }); } catch (e) {}
  }
  function dispatchSyntheticStorageEvent(key, oldValue, newValue) {
    try {
      var evt = new StorageEvent('storage', {
        key: key,
        oldValue: oldValue == null ? null : oldValue,
        newValue: newValue == null ? null : newValue,
        url: location.href,
        storageArea: window.localStorage
      });
      window.dispatchEvent(evt);
    } catch (e) {}
  }
  if (bc) {
    bc.onmessage = function (ev) {
      var d = ev && ev.data;
      if (!d || typeof d.key !== 'string') return;
      var oldValue = map.has(d.key) ? map.get(d.key) : null;
      if (d.newValue == null) map.delete(d.key); else map.set(d.key, d.newValue);
      dispatchSyntheticStorageEvent(d.key, oldValue, d.newValue == null ? null : d.newValue);
    };
  }

  var idb = null; // set once IndexedDB is open

  // -------- durability tracking --------
  // setItem() returns synchronously because the Map is updated synchronously,
  // but the IndexedDB transaction behind it only COMMITS once control returns
  // to the event loop. Anything that writes and then tears the document down
  // in the same tick — location.href, a real <a> click, a form submit, or the
  // OS discarding a backgrounded tab — can lose that write, while the page it
  // just left looked like it had saved. So every pending transaction is
  // counted here, and flush() lets a caller wait for the count to reach zero
  // before doing the thing that ends the document.
  var pending = 0;
  var waiters = [];
  // Writes queued before IndexedDB finished opening have no transaction yet.
  // They are replayed on open, and flush() must not report "done" while any
  // are still sitting here.
  var preOpen = [];

  function settleWaiters() {
    if (pending > 0 || preOpen.length) return;
    var list = waiters; waiters = [];
    list.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  // A FAILED transaction is not a completed one. This used to hand
  // tx.onerror and tx.onabort the same handler as tx.oncomplete, which made a
  // write that never committed indistinguishable from one that did: the
  // in-memory Map still held the new value, flush() resolved happily, the UI
  // said "Saved", and the record was simply gone on the next load. Quota
  // pressure and an evicted store both land here. The count still has to drop
  // either way — a stuck counter would hang every flush() after it — so the
  // failure is recorded and announced instead.
  var writeFailures = 0, lastError = null;

  function noteFailure(err) {
    writeFailures++;
    lastError = err || new Error('IndexedDB write failed');
    try {
      window.dispatchEvent(new CustomEvent('localstore:writefailed', {
        detail: { error: String(lastError && lastError.message || lastError), failures: writeFailures }
      }));
    } catch (e) {}
  }
  function trackTx(tx) {
    pending++;
    var done = false;
    var settle = function (failed, err) {
      if (done) return;
      done = true;
      pending--;
      if (failed) noteFailure(err);
      settleWaiters();
    };
    tx.oncomplete = function () { settle(false); };
    tx.onerror = function (e) { settle(true, tx.error || (e && e.target && e.target.error)); };
    tx.onabort = function (e) { settle(true, tx.error || (e && e.target && e.target.error)); };
  }
  function persistPut(key, value) {
    if (!idb) { preOpen.push(['put', key, value]); return; }
    try {
      var tx = idb.transaction([KV_STORE], 'readwrite');
      tx.objectStore(KV_STORE).put(value, key);
      trackTx(tx);
    } catch (e) { noteFailure(e); }
  }
  function persistRemove(key) {
    if (!idb) { preOpen.push(['del', key]); return; }
    try {
      var tx = idb.transaction([KV_STORE], 'readwrite');
      tx.objectStore(KV_STORE).delete(key);
      trackTx(tx);
    } catch (e) { noteFailure(e); }
  }
  function drainPreOpen() {
    if (!idb || !preOpen.length) return;
    var queued = preOpen; preOpen = [];
    try {
      var tx = idb.transaction([KV_STORE], 'readwrite');
      var store = tx.objectStore(KV_STORE);
      queued.forEach(function (op) {
        if (op[0] === 'put') store.put(op[2], op[1]); else store.delete(op[1]);
      });
      trackTx(tx);
    } catch (e) { noteFailure(e); }
    settleWaiters();
  }

  var shim = {
    getItem: function (key) {
      key = String(key);
      return map.has(key) ? map.get(key) : null;
    },
    setItem: function (key, value) {
      key = String(key); value = String(value);
      var oldValue = map.has(key) ? map.get(key) : null;
      map.set(key, value);
      persistPut(key, value);
      broadcastChange(key, oldValue, value);
    },
    removeItem: function (key) {
      key = String(key);
      var oldValue = map.has(key) ? map.get(key) : null;
      map.delete(key);
      persistRemove(key);
      broadcastChange(key, oldValue, null);
    },
    clear: function () {
      var keys = Array.from(map.keys());
      map.clear();
      if (idb) {
        try { idb.transaction([KV_STORE], 'readwrite').objectStore(KV_STORE).clear(); } catch (e) {}
      }
      keys.forEach(function (k) { broadcastChange(k, null, null); });
    },
    key: function (i) {
      var keys = Array.from(map.keys());
      return (i >= 0 && i < keys.length) ? keys[i] : null;
    }
  };
  Object.defineProperty(shim, 'length', { get: function () { return map.size; }, enumerable: true });

  var installed = false;
  try {
    Object.defineProperty(window, 'localStorage', {
      value: shim, configurable: true, writable: true, enumerable: true
    });
    installed = true;
  } catch (e) {
    installed = false;
  }

  window.__LocalStoreIDBInstalled = true;

  if (!installed || typeof indexedDB === 'undefined') {
    // Safety fallback: either the override didn't take, or this browser
    // has no IndexedDB at all. Real native localStorage (if the override
    // failed) or this shim's Map (seeded, just never persisted beyond
    // this tab's lifetime) still works for the current session — either
    // way, resolve ready() immediately so no page hangs waiting on a
    // hydration step that was never going to happen.
    window.LocalStoreIDB = {
      ready: function () { return readyPromise; },
      backend: function () { return installed ? 'memory-only' : 'native'; },
      // No IndexedDB behind this, so there is nothing to wait for and
      // nothing to lose that is not already lost. Resolve immediately so a
      // caller's navigation is never held up.
      flush: function () { return Promise.resolve(); },
      navigate: function (url) { location.href = url; }
    };
    resolveReadyNow();
    return;
  }

  /**
   * Resolves once every write issued so far has actually committed to
   * IndexedDB. Always resolves — never rejects, and never hangs: the timeout
   * backstop means a wedged transaction can at worst delay a navigation by
   * `timeoutMs`, rather than stranding the reader on a page that will not
   * move. Call it before anything that ends the document.
   */
  function flush(timeoutMs) {
    // Resolves true when the queue genuinely drained, false when the timeout
    // backstop fired first. Callers that only want to navigate can keep
    // ignoring it; callers that want to know whether a save is real cannot.
    if (pending === 0 && !preOpen.length) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (drained) { if (done) return; done = true; resolve(drained !== false); };
      waiters.push(function () { finish(true); });
      setTimeout(function () { finish(false); }, typeof timeoutMs === 'number' ? timeoutMs : 1500);
    });
  }

  window.LocalStoreIDB = {
    ready: function () { return readyPromise; },
    backend: function () { return 'indexeddb'; },
    flush: flush,
    /** The safe replacement for `location.href = url` after a write. */
    navigate: function (url, timeoutMs) {
      flush(timeoutMs).then(function () { location.href = url; });
    },
    pendingWrites: function () { return pending + preOpen.length; },
    /**
     * How many IndexedDB transactions have failed in this document, and the
     * last error. A page that reports "Saved" should check this rather than
     * trusting that setItem returned — see the note on trackTx.
     */
    writeFailures: function () { return writeFailures; },
    lastWriteError: function () { return lastError; }
  };

  // -------- Step 3: open IndexedDB, then merge/bulk-copy and resolve ready() --------
  try {
    var openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    openReq.onsuccess = function (e) {
      idb = e.target.result;
      // Anything written between install and open was buffered rather than
      // dropped — a page that writes during boot (a seed, a migration, a
      // route stamp) would otherwise persist nothing at all.
      drainPreOpen();
      var metaTx = idb.transaction([META_STORE], 'readonly');
      var metaReq = metaTx.objectStore(META_STORE).get('migrated');
      metaReq.onsuccess = function () {
        if (!metaReq.result) {
          // First time ever with this database — bulk-copy the
          // synchronously-seeded Map into IndexedDB so it becomes
          // self-sufficient from here on, then mark it done.
          try {
            var writeTx = idb.transaction([KV_STORE, META_STORE], 'readwrite');
            var kvStore = writeTx.objectStore(KV_STORE);
            map.forEach(function (v, k) { kvStore.put(v, k); });
            writeTx.objectStore(META_STORE).put(true, 'migrated');
          } catch (e2) {}
          resolveReadyNow();
        } else {
          // Already established — IndexedDB is the authoritative record
          // of everything written via this shim since it was installed;
          // overlay it on top of the native-seeded Map (IndexedDB wins).
          try {
            var readTx = idb.transaction([KV_STORE], 'readonly');
            var kvStore2 = readTx.objectStore(KV_STORE);
            var keysReq = kvStore2.getAllKeys();
            var valsReq = kvStore2.getAll();
            var done = 0;
            function maybeFinish() {
              done++;
              if (done < 2) return;
              var keys = keysReq.result || [];
              var vals = valsReq.result || [];
              for (var j = 0; j < keys.length; j++) map.set(keys[j], vals[j]);
              resolveReadyNow();
            }
            keysReq.onsuccess = maybeFinish;
            valsReq.onsuccess = maybeFinish;
            keysReq.onerror = maybeFinish;
            valsReq.onerror = maybeFinish;
          } catch (e3) { resolveReadyNow(); }
        }
      };
      metaReq.onerror = function () { resolveReadyNow(); };
    };
    openReq.onerror = function () {
      // Couldn't open IndexedDB at all (private-browsing restrictions on
      // some older browsers, etc.) — the shim still works for this tab's
      // lifetime via the in-memory Map alone, just without durability
      // beyond it. Don't leave any page hanging on ready().
      resolveReadyNow();
    };
  } catch (e) {
    resolveReadyNow();
  }
})();
