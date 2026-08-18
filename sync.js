// =============================================================
// Shared cloud-sync helper. Each page calls initCloudSync({...}).
// Replace the two placeholders with your Supabase project URL +
// publishable key (same ones you used in topbar.js/gym.html).
// =============================================================
(function () {
  'use strict';
  const SUPABASE_URL = 'https://jomlmvslzsmmzgjnqvbm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BrZrVgVxLA_idNX19sGhwg_mo7Ta41N';

  window.initCloudSync = function (config) {
    const appKey = config && config.appKey;
    const syncedKeys = (config && config.syncedKeys) || [];
    const syncedPrefixes = (config && config.syncedPrefixes) || [];
    const onApplied = config && config.onApplied;
    if (!appKey || !window.supabase) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    if (SUPABASE_URL.indexOf('PASTE-') === 0 || SUPABASE_KEY.indexOf('PASTE-') === 0) return;

    let supa = null, pushTimer = null, suppressSync = false, lastSyncedJson = null;
    // Keys written locally since their last confirmed push. While a key is
    // dirty, incoming remote data must not overwrite or delete it — doing so
    // would silently revert an edit made while a fetch/realtime message was
    // already in flight (e.g. adding a card right after page load, before
    // the initial pull resolves). The pending push reconciles it shortly after.
    let localDirtyKeys = new Set();

    function matches(k) {
      if (!k) return false;
      if (syncedKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < syncedPrefixes.length; i++) {
        if (k.indexOf(syncedPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function listAllKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (matches(k)) out.push(k);
      }
      return out;
    }
    function collect() {
      const out = {};
      for (const k of listAllKeys()) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
      }
      return out;
    }
    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try { if (!suppressSync && matches(k)) { localDirtyKeys.add(k); schedulePush(); } } catch (e) {}
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try { if (!suppressSync && matches(k)) { localDirtyKeys.add(k); schedulePush(); } } catch (e) {}
    };
    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          if (localDirtyKeys.has(k)) continue;
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) { try { origSet(k, incoming); changed = true; } catch (e) {} }
        }
        for (const k of listAllKeys()) {
          if (localDirtyKeys.has(k)) continue;
          if (!(k in remote)) { try { origRemove(k); changed = true; } catch (e) {} }
        }
      } finally { suppressSync = false; }
      if (changed && typeof onApplied === 'function') { try { onApplied(); } catch (e) {} }
      return changed;
    }
    // A push that FAILED must not be forgotten. Without a retry the only
    // thing that ever pushes again is the next local edit — so an edit made
    // while the phone was on a dead bar of signal sat unsynced until the
    // next time that page was touched, which on a page you write in once a
    // week means never.
    let pushing = false, retryTimer = null, retryStep = 0;
    const RETRY_MS = [2000, 6000, 15000, 45000];

    async function pushNow() {
      if (!supa || pushing) return;
      const state = collect();
      const pushedKeys = Object.keys(state);
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) { pushedKeys.forEach((k) => localDirtyKeys.delete(k)); return; }
      pushing = true;
      let ok = false;
      try {
        const { error } = await supa.from('app_state').upsert(
          { key: appKey, data: state, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
        if (!error) {
          ok = true;
          lastSyncedJson = json;
          pushedKeys.forEach((k) => localDirtyKeys.delete(k));
        }
      } catch (e) {} finally { pushing = false; }
      if (ok) { retryStep = 0; clearTimeout(retryTimer); retryTimer = null; return; }
      // Offline, rate-limited, or a transient 5xx. Keep the keys dirty (so an
      // incoming remote can't overwrite them) and come back for them.
      clearTimeout(retryTimer);
      retryTimer = setTimeout(pushNow, RETRY_MS[Math.min(retryStep++, RETRY_MS.length - 1)]);
    }
    function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 250); }

    // Dedupe for the flush path only. flushOnUnload deliberately does NOT set
    // lastSyncedJson: a keepalive request's outcome is unobservable, so
    // marking the state synced on the strength of having *started* one would
    // permanently retire an edit that never landed. Instead the same payload
    // is skipped for a few seconds — enough to stop pagehide and
    // visibilitychange double-firing on the same navigation — and after that
    // it is fair game to send again, which costs one idempotent upsert.
    let lastFlushJson = null, lastFlushAt = 0;
    const FLUSH_DEDUPE_MS = 4000;

    function flushOnUnload() {
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      const now = Date.now();
      if (json === lastFlushJson && now - lastFlushAt < FLUSH_DEDUPE_MS) return;
      lastFlushJson = json; lastFlushAt = now;
      try {
        fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {}
    }

    async function pullNow() {
      if (!supa) return;
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (error || !data || !data.data) return;
        const incoming = JSON.stringify(data.data);
        if (incoming === lastSyncedJson) return;
        lastSyncedJson = incoming;
        applyRemote(data.data);
      } catch (e) {}
    }

    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (!error && data && data.data && Object.keys(data.data).length > 0) {
          lastSyncedJson = JSON.stringify(data.data);
          applyRemote(data.data);
        } else if (Object.keys(collect()).length > 0) {
          schedulePush();
        }
      } catch (e) {}
      supa.channel('app_state_' + appKey)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + appKey,
        }, (payload) => {
          if (!payload.new || !payload.new.data) return;
          const incoming = JSON.stringify(payload.new.data);
          if (incoming === lastSyncedJson) return;
          lastSyncedJson = incoming;
          applyRemote(payload.new.data);
        })
        .subscribe();
    })();

    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);

    // ---------------------------------------------------------------
    // THE PHONE PATH. beforeunload does not fire on iOS at all, and
    // pagehide only fires when the page is actually being navigated away
    // from. Switching apps, locking the screen, or swiping to another tab
    // fires *visibilitychange* and nothing else — and the OS is then free to
    // discard the page without another event. So hidden is the last reliable
    // moment to get an edit off the device, and it has to be treated as if
    // it were the final one.
    //
    // Coming back matters just as much: a frozen page's realtime websocket
    // is dead, so anything changed on another device while this one was in
    // the background never arrived. Re-pull on the way back in, before the
    // stale copy in front of you has a chance to be edited and pushed over
    // the newer one.
    // ---------------------------------------------------------------
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { clearTimeout(pushTimer); flushOnUnload(); }
      else { retryStep = 0; pullNow(); }
    });
    // bfcache restore: the page comes back with no visibilitychange at all.
    window.addEventListener('pageshow', (e) => { if (e.persisted) { retryStep = 0; pullNow(); } });
    // Signal returned — send whatever the retry ladder is still holding.
    window.addEventListener('online', () => { retryStep = 0; clearTimeout(retryTimer); pushNow(); pullNow(); });

    window.addEventListener('storage', (e) => { if (e.key && matches(e.key)) schedulePush(); });
  };
})();
