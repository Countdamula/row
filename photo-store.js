// =============================================================
// Shared photo-upload helper. Compresses are done by each page's own
// existing compressImageDataUrl() exactly as before — this file's only
// job is: take that already-compressed base64 data: URL (or a raw Blob,
// for gym.html's uncompressed video case), upload it to a shared
// Supabase Storage bucket ("dashboard-photos"), and hand back a small
// public URL so a page can replace the giant base64 string sitting in a
// localStorage-synced field with a ~100-byte URL instead.
//
// This is deliberately separate from sync.js's own localStorage<->
// app_state sync (which is left completely untouched) — this module
// never reads or writes localStorage itself. A page calls
// PhotoStore.upload(compressedDataUrl, cb) after it has already saved
// the base64 value locally exactly as it always has; cb(url) fires
// later (once the background upload succeeds) so the page can replace
// the field with the hosted URL. If this never calls back (offline, the
// dashboard-photos bucket doesn't exist yet, a network error), the page
// simply keeps the base64 value it already saved — no behavior change
// from before this file existed.
//
// Uses the same Supabase project/credentials as sync.js/topbar.js/
// gym.html (a 4th copy of the same two constants, consistent with this
// app's existing precedent of duplicating them per-file rather than
// sharing a module — see CLAUDE.md's DO NOT MODIFY notes on sync.js).
//
// Requires a public Storage bucket named "dashboard-photos" with anon
// insert/update/delete policies set up in the Supabase project — see
// CLAUDE.md's Writing Dashboard / photo-store.js section for the exact
// setup steps. Until that bucket exists, upload() just silently no-ops.
// =============================================================
(function () {
  'use strict';
  const SUPABASE_URL = 'https://jomlmvslzsmmzgjnqvbm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BrZrVgVxLA_idNX19sGhwg_mo7Ta41N';
  const BUCKET = 'dashboard-photos';

  let supa = null;
  function client() {
    if (supa) return supa;
    if (!window.supabase) return null;
    if (SUPABASE_URL.indexOf('PASTE-') === 0 || SUPABASE_KEY.indexOf('PASTE-') === 0) return null;
    try { supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { supa = null; }
    return supa;
  }

  // Only real base64 data: URLs get uploaded — a value that's already a
  // plain http(s) URL (a "paste a URL instead" field, or one migrated on
  // a previous pass) is left alone, since there's nothing to upload.
  function dataUrlToBlob(dataUrl) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const meta = dataUrl.slice(0, commaIdx);
    if (meta.indexOf('base64') === -1) return null;
    const mimeMatch = meta.match(/^data:([^;]+)/);
    const mime = (mimeMatch && mimeMatch[1]) || 'application/octet-stream';
    let binary;
    try { binary = atob(dataUrl.slice(commaIdx + 1)); } catch (e) { return null; }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function extFromMime(mime) {
    if (mime.indexOf('video') === 0) return mime.indexOf('quicktime') !== -1 ? 'mov' : 'mp4';
    if (mime.indexOf('png') !== -1) return 'png';
    if (mime.indexOf('webp') !== -1) return 'webp';
    if (mime.indexOf('gif') !== -1) return 'gif';
    return 'jpg';
  }

  function randomPath(mime) {
    const id = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return id + '.' + extFromMime(mime || 'image/jpeg');
  }

  // Fire-and-forget. dataUrlOrBlob is either an already-compressed base64
  // data: URL (the normal case — every page's existing
  // compressImageDataUrl() output) or a raw Blob/File (gym.html's
  // uncompressed-video case). onUploaded(publicUrl) is called only on a
  // confirmed-successful upload; any failure is silent, matching
  // sync.js's own pushNow()/flushOnUnload() failure tolerance — a full
  // disk, an offline browser, or a not-yet-created bucket should never
  // throw or block the caller's own already-completed local save.
  //
  // Also returns a Promise resolving to the public URL on success, or to
  // null on any failure (never rejects) — used by each page's one-time
  // photo backfill to know when a whole batch of uploads has settled,
  // without forcing every ordinary upload call site to deal with promises.
  function upload(dataUrlOrBlob, onUploaded) {
    return new Promise(function (resolve) {
      try {
        const c = client();
        if (!c) { resolve(null); return; }
        let blob = dataUrlOrBlob;
        if (typeof dataUrlOrBlob === 'string') {
          if (dataUrlOrBlob.indexOf('data:') !== 0) { resolve(null); return; }
          blob = dataUrlToBlob(dataUrlOrBlob);
          if (!blob) { resolve(null); return; }
        }
        if (!blob || !blob.size) { resolve(null); return; }
        const path = randomPath(blob.type);
        c.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false })
          .then(function (res) {
            if (res && res.error) { resolve(null); return; }
            const pub = c.storage.from(BUCKET).getPublicUrl(path);
            const url = pub && pub.data && pub.data.publicUrl;
            if (url && typeof onUploaded === 'function') onUploaded(url);
            resolve(url || null);
          })
          .catch(function () { resolve(null); });
      } catch (e) { resolve(null); /* offline, bucket missing, etc. — caller keeps its existing local value */ }
    });
  }

  window.PhotoStore = { upload: upload };
})();
