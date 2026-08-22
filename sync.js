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
    // onApplied fires only when applyRemote actually CHANGED something, which
    // means "the row differed", not "the row arrived". Anything gated on the
    // cloud having had its say — a seeder deciding whether this device is
    // genuinely empty, for instance — needs the second question, not the
    // first, or a byte-identical row looks exactly like no row at all.
    const onPulled = config && config.onPulled;
    // OPT-IN, and off unless a page asks for it — every existing caller keeps
    // exactly the behaviour it has today. See §HANDOFF below.
    const wantHandoff = !!(config && config.handoff);
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
    // ---------------------------------------------------------------
    // §HANDOFF — carrying "this key is newer than the cloud" ACROSS a
    // navigation.
    //
    // localDirtyKeys is per-document, in memory, and dies with the page. On a
    // single-page dashboard that is fine. On an app split across two documents
    // that share one row — palaestra.html handing off to
    // palaestra-workout.html — it is a data-loss bug: the second document
    // boots with an empty dirty set, so its opening pull treats the row as
    // authoritative and applyRemote() below overwrites (and deletes) the keys
    // the first document just wrote and had no time to push. The write is then
    // pushed back as an erasure. Measured: with a fast cloud read the
    // just-started workout was destroyed 6 times out of 6.
    //
    // So the dirty set is mirrored to a small record the next document reads
    // before its first pull. That record is deliberately NOT in any synced
    // prefix — it is local bookkeeping, never cloud state — and every entry
    // expires, because a key held dirty forever would block real updates to it
    // from another device.
    // ---------------------------------------------------------------
    const HANDOFF_KEY = 'syncdirty:' + appKey;
    // 24 hours, not the 90 seconds this shipped with. An entry is deleted the
    // moment a push is CONFIRMED, so in normal use it lives for a few hundred
    // milliseconds and this number is never reached. It is reached only when a
    // push genuinely never succeeded — a dead bar of signal, a 5xx, a tab
    // closed mid-flight — and that is precisely the edit that must not be
    // thrown away. At 90s an overnight-offline edit came back unprotected and
    // was overwritten by the morning's first pull.
    //
    // The cost is the one the original number was buying: while an entry
    // stands, a real update to that key from another device cannot land. That
    // is the right trade — a stale key is visible and fixable, a deleted one
    // is neither — but it is why the expiry exists at all rather than being
    // infinite.
    const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
    // If a page ever synced a prefix that swallowed the bookkeeping key, the
    // record would be pushed to the cloud and deleted by applyRemote. Refuse
    // rather than corrupt: better no handoff than a poisoned one.
    const handoff = wantHandoff && !matches(HANDOFF_KEY);

    function readHandoff() {
      if (!handoff) return null;
      try {
        const raw = localStorage.getItem(HANDOFF_KEY);
        const o = raw ? JSON.parse(raw) : null;
        return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
      } catch (e) { return null; }
    }
    function writeHandoff(o) {
      if (!handoff) return;
      // origSet/origRemove: this key is not synced state and must never mark
      // itself dirty or schedule a push.
      try {
        if (!o || !Object.keys(o).length) origRemove(HANDOFF_KEY);
        else origSet(HANDOFF_KEY, JSON.stringify(o));
      } catch (e) {}
    }
    function markDirty(k) {
      localDirtyKeys.add(k);
      if (!handoff) return;
      const o = readHandoff() || {};
      o[k] = Date.now();
      writeHandoff(o);
    }
    function clearDirty(keys) {
      keys.forEach((k) => localDirtyKeys.delete(k));
      if (!handoff) return;
      const o = readHandoff();
      if (!o) return;
      let changed = false;
      keys.forEach((k) => { if (k in o) { delete o[k]; changed = true; } });
      if (changed) writeHandoff(o);
    }
    // Runs before the first pull, or it is pointless.
    function adoptHandoff() {
      if (!handoff) return 0;
      const o = readHandoff();
      if (!o) return 0;
      const now = Date.now(), keep = {};
      let n = 0;
      for (const k of Object.keys(o)) {
        if (!matches(k)) continue;
        if (now - Number(o[k] || 0) > HANDOFF_TTL_MS) continue;
        localDirtyKeys.add(k); keep[k] = o[k]; n++;
      }
      writeHandoff(keep);
      return n;
    }

    // ---------------------------------------------------------------
    // §SEEN — telling "the cloud deleted this" apart from "the cloud has
    // never heard of this".
    //
    // applyRemote used to remove every local key missing from the incoming
    // row. That rule cannot tell those two cases apart, and they need
    // opposite handling: the first is a deletion to honour, the second is an
    // unpushed local write to PROTECT. Getting it wrong is the exact shape of
    // the bug that lost a night of workout routines — written locally, the
    // 250ms debounce killed by a navigation, deleted by the next pull, and
    // then the deletion pushed back as truth.
    //
    // So: remember which keys a genuinely-pulled row carried. A key in that
    // record that later goes missing was really deleted somewhere. A key that
    // has NEVER appeared in one is local-only — mark it dirty and push it.
    //
    // Confirmed pushes count too. Without that, device A pushes K, device B
    // deletes it, A pulls, and A — never having pulled a row containing K —
    // would call its own key local-only and resurrect it forever.
    //
    // Like HANDOFF_KEY this is local bookkeeping, never cloud state, so it
    // lives outside every synced prefix and is written with origSet.
    // ---------------------------------------------------------------
    const SEEN_KEY = 'syncseen:' + appKey;
    const seenOk = !matches(SEEN_KEY);
    let seen = null;

    function readSeen() {
      if (!seenOk) return new Set();
      if (seen) return seen;
      try {
        const raw = localStorage.getItem(SEEN_KEY);
        const a = raw ? JSON.parse(raw) : null;
        seen = new Set(Array.isArray(a) ? a : []);
      } catch (e) { seen = new Set(); }
      return seen;
    }
    function writeSeen(set) {
      if (!seenOk) return;
      seen = set;
      try { origSet(SEEN_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
    }
    function seenAdd(keys) {
      if (!seenOk || !keys.length) return;
      const set = readSeen();
      let changed = false;
      keys.forEach((k) => { if (!set.has(k)) { set.add(k); changed = true; } });
      if (changed) writeSeen(set);
    }

    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try { if (!suppressSync && matches(k)) { markDirty(k); schedulePush(); } } catch (e) {}
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try { if (!suppressSync && matches(k)) { markDirty(k); schedulePush(); } } catch (e) {}
    };
    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      const localOnly = [];
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          if (localDirtyKeys.has(k)) continue;
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) { try { origSet(k, incoming); changed = true; } catch (e) {} }
        }
        // §SEEN: absence is only evidence of a deletion for a key the cloud
        // is KNOWN to have carried. Everything else is a local write the row
        // has not caught up with yet, and it gets pushed, not destroyed.
        const known = readSeen();
        for (const k of listAllKeys()) {
          if (localDirtyKeys.has(k)) continue;
          if (k in remote) continue;
          if (seenOk && !known.has(k)) { localOnly.push(k); continue; }
          try { origRemove(k); changed = true; } catch (e) {}
        }
      } finally { suppressSync = false; }
      // A pulled row is the authority on what the cloud holds, so it replaces
      // the record wholesale — a key it does not carry is no longer there,
      // whether it was deleted or has never arrived.
      writeSeen(new Set(Object.keys(remote).filter(matches)));
      if (localOnly.length) {
        localOnly.forEach(markDirty);
        schedulePush();
      }
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
      if (json === lastSyncedJson) { clearDirty(pushedKeys); seenAdd(pushedKeys); return; }
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
          clearDirty(pushedKeys);
          // The row demonstrably holds these now, so their later absence is a
          // real deletion rather than a write that never landed. See §SEEN.
          seenAdd(pushedKeys);
        }
      } catch (e) {} finally { pushing = false; }
      if (ok) { retryStep = 0; clearTimeout(retryTimer); retryTimer = null; return; }
      // Offline, rate-limited, or a transient 5xx. Keep the keys dirty (so an
      // incoming remote can't overwrite them) and come back for them.
      clearTimeout(retryTimer);
      retryTimer = setTimeout(pushNow, RETRY_MS[Math.min(retryStep++, RETRY_MS.length - 1)]);
    }
    // No push may replace the row before this document has READ it. pushNow
    // sends collect() as the row's entire data column, so a push that beats
    // the opening select erases every key this device does not happen to hold
    // — which is how a seeder running on a slow connection could wipe a full
    // account down to its starter data. Everything raised before the pull
    // resolves is held here and released the moment it does.
    let initialPullDone = false, pushHeld = false;
    function schedulePush() {
      if (!initialPullDone) { pushHeld = true; return; }
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, 250);
    }
    function releaseInitialPush() {
      if (initialPullDone) return;
      initialPullDone = true;
      if (pushHeld) { pushHeld = false; schedulePush(); }
    }

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
      // Before the opening pull, this device does not yet know what the row
      // holds, and this request REPLACES the row. Staying quiet is safe: the
      // handoff record has already persisted every dirty key, so the next
      // document adopts them, pulls, and pushes a state that includes both.
      if (!initialPullDone) return;
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
        if (incoming === lastSyncedJson) {
          if (typeof onPulled === 'function') { try { onPulled({ ok: true, empty: false }); } catch (e) {} }
          return;
        }
        lastSyncedJson = incoming;
        applyRemote(data.data);
        if (typeof onPulled === 'function') { try { onPulled({ ok: true, empty: false }); } catch (e) {} }
      } catch (e) {}
    }

    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      // Synchronous, and before the select below — the whole point is that the
      // incoming row cannot overwrite a key the previous document wrote and
      // did not get to confirm. The push it earns is DEFERRED until after the
      // select (see schedulePush): the local copy is the newer truth for those
      // keys, but it is not the truth for the whole row.
      if (adoptHandoff() > 0) pushHeld = true;
      // A pull that never resolves must not hold the outbox shut forever. Two
      // network states look identical from here — hung and merely slow — so
      // release on a timer as well, and let §SEEN protect what goes out.
      const backstop = setTimeout(releaseInitialPush, 8000);
      let pulled = { ok: false, empty: true };
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (!error) {
          const row = data && data.data ? data.data : null;
          pulled = { ok: true, empty: !row || Object.keys(row).length === 0 };
          if (!pulled.empty) {
            lastSyncedJson = JSON.stringify(row);
            applyRemote(row);
          } else if (Object.keys(collect()).length > 0) {
            pushHeld = true;
          }
        }
      } catch (e) {}
      clearTimeout(backstop);
      releaseInitialPush();
      // Fires whether the row differed, matched, or was empty — the question
      // this answers is "has the cloud spoken?", not "did anything change?".
      if (typeof onPulled === 'function') { try { onPulled(pulled); } catch (e) {} }
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
