// entertainment-hub-ui.js
//
// Shared rendering/interaction engine for the "Entertainment" nav
// folder's five pages (see entertainment-hub-data.js's own header
// comment for the full data-layer picture). Injects its own <style> and
// body markup at runtime — the same self-contained "build it and append
// it" pattern topbar.js already uses for the shared nav — so all four
// content pages (Podcasts/Stories/Entertainment/Playlists) can be a
// single shared engine instead of four divergent copies of nearly
// identical gallery code, and the fifth (Favorites) reuses the same
// card/rating/modal components rather than a second implementation.
//
// Palette: this file's own private --eh-* token copy of this app's
// common near-black/gold, frosted-glass-card aesthetic (Dream Board/
// Business Hub/AI & Tech/Learning Hub/Tasks & Notes/Fitness Studio all
// already use it) — DO NOT MODIFY rule 2, reuse existing tokens, no new
// palette. Card titles use the same large italic serif ("article-like")
// treatment those same galleries already use for their own cards.
//
// Two entry points, called from each page's own tiny boot script:
//   EntHubUI.initGalleryPage(pageKey)   — Podcasts/Stories/Entertainment/Playlists
//   EntHubUI.initFavoritesPage()        — Favorites

(function (global) {
  'use strict';

  const EH = global.EntHub;

  function $(id) { return document.getElementById(id); }

  // ============================================================
  // BOOT-ERROR SAFETY NET — a visible banner with the real error instead
  // of a silently blank page, same precedent this app's own boot-heavy
  // pages already established (gym.html/business.html/tasks.html/
  // mainpillar.html/home.html). Each HTML shell's own tiny boot script
  // wraps its init*() call in this.
  // ============================================================
  function showBootErrorBanner(err, context) {
    try {
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#3a0d0d;color:#ffd1d1;padding:14px 18px;font:13px/1.5 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;border-bottom:2px solid #ff6b6b;';
      const msg = (err && err.stack) ? err.stack : String(err);
      const label = document.createElement('div');
      label.textContent = 'Entertainment failed to load' + (context ? (' (' + context + ')') : '') + ':';
      label.style.fontWeight = 'bold';
      const pre = document.createElement('div');
      pre.textContent = msg;
      const btn = document.createElement('button');
      btn.textContent = 'Copy error details';
      btn.style.cssText = 'margin-top:8px;padding:6px 12px;cursor:pointer;';
      btn.addEventListener('click', function () {
        try { navigator.clipboard.writeText(label.textContent + '\n' + msg); btn.textContent = 'Copied!'; } catch (e) {}
      });
      bar.appendChild(label); bar.appendChild(pre); bar.appendChild(btn);
      document.body.appendChild(bar);
    } catch (e2) { /* if even the banner fails, there's nothing more to do */ }
  }
  function runSafely(fn, context) {
    try { fn(); } catch (err) { showBootErrorBanner(err, context); }
  }

  // ============================================================
  // STYLES — injected once, shared by every page that calls into this
  // engine.
  // ============================================================
  function injectStyles() {
    if ($('eh-injected-styles')) return;
    const style = document.createElement('style');
    style.id = 'eh-injected-styles';
    style.textContent = `
      :root {
        --eh-bg: #0b0a08; --eh-bg-deep: #050403;
        --eh-paper: rgba(255,255,255,0.045);
        --eh-gold: #c9a876; --eh-gold-bright: #e8cf9f;
        --eh-text: #f5f1e9; --eh-text-dim: rgba(245,241,233,0.68); --eh-text-mute: rgba(245,241,233,0.44);
        --eh-hairline: rgba(201,168,118,0.22); --eh-accent-tint: rgba(201,168,118,0.14);
        --eh-danger: #FF6B6B; --eh-success: #6BE3A4;
        --font-serif: "Cormorant Garamond", Georgia, "Iowan Old Style", serif;
      }
      html, body { background: var(--eh-bg-deep); color: var(--eh-text); font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
      body::before {
        content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(ellipse 900px 560px at 12% -6%, rgba(201,168,118,0.10), transparent 60%),
          radial-gradient(ellipse 900px 560px at 100% 0%, rgba(201,168,118,0.06), transparent 55%),
          var(--eh-bg-deep);
      }
      .eh-back-btn {
        position: fixed; top: max(14px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left)); z-index: 20;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 14px 8px 10px;
        background: rgba(11,10,8,0.55); backdrop-filter: blur(10px);
        border: 1px solid var(--eh-hairline); border-radius: 999px; color: var(--eh-text-dim);
        font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-decoration: none;
      }
      .eh-back-btn:hover { background: rgba(11,10,8,0.8); color: var(--eh-text); }
      .eh-shell { position: relative; z-index: 1; }
      .eh-content { max-width: 1220px; margin: 0 auto; padding: 30px 20px 70px; }

      /* ===== Hero — one large, editable cover-photo banner per page ===== */
      #ehPageBg {
        /* z-index: 0 (not negative) — this exact environment has a
           documented bug where a fixed element with a negative z-index
           silently fails to paint once html/body declare an explicit
           background color, which they do above (see example.html's own
           changelog entry on this). Stacking below .eh-shell (z-index 1)
           is guaranteed by the lower z-index value alone, no DOM-order
           trick needed since the two never share a z-index. */
        position: fixed; inset: 0; z-index: 0; background-size: cover; background-position: center;
        filter: blur(60px) saturate(1.35) brightness(0.5); transform: scale(1.15);
        transition: background-image 0.3s ease; pointer-events: none;
      }
      .eh-hero {
        position: relative; z-index: 1; overflow: hidden;
        min-height: clamp(300px, 48vh, 480px);
        display: flex; flex-direction: column; justify-content: flex-end;
        padding: 92px 20px 40px;
      }
      @media (max-width: 620px) { .eh-hero { padding-top: 78px; min-height: clamp(260px, 52vh, 420px); } }
      .eh-hero-media { position: absolute; inset: 0; z-index: 0; background: linear-gradient(150deg, #201a12, #0d0a06); }
      .eh-hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .eh-hero-overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(5,4,3,0.1) 0%, rgba(5,4,3,0.55) 58%, rgba(5,4,3,0.94) 100%); pointer-events: none; }
      .eh-hero-content { position: relative; z-index: 2; max-width: 1220px; margin: 0 auto; width: 100%; }
      .eh-hero-eyebrow {
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; letter-spacing: 0.16em;
        text-transform: uppercase; color: var(--eh-gold); display: inline-block; margin-bottom: 8px; outline: none;
        text-shadow: 0 1px 8px rgba(5,4,3,0.8);
      }
      .eh-hero-title {
        display: block; width: 100%; background: transparent; border: none; color: var(--eh-text);
        font-family: var(--font-serif); font-style: italic; font-weight: 600; font-size: clamp(30px, 5.2vw, 48px);
        line-height: 1.06; padding: 0; resize: none; overflow: hidden; outline: none;
        text-shadow: 0 2px 14px rgba(5,4,3,0.85);
      }
      .eh-hero-subtext {
        font-size: 13.5px; color: var(--eh-text-dim); max-width: 62ch; margin-top: 10px; line-height: 1.55; outline: none;
        text-shadow: 0 1px 8px rgba(5,4,3,0.8);
      }
      .eh-hero-photo-tools { position: absolute; top: max(14px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right)); z-index: 5; display: flex; gap: 8px; }
      .eh-hero-photo-tools .eh-btn-secondary { background: rgba(11,10,8,0.55); backdrop-filter: blur(8px); }
      .eh-hero-photo-choice {
        position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center;
      }
      .eh-hero-add-photo-btn {
        display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px;
        border: 1px dashed var(--eh-hairline); border-radius: 999px; cursor: pointer;
        background: rgba(11,10,8,0.4); backdrop-filter: blur(6px); color: var(--eh-text-dim);
        font-size: 13px; font-weight: 600;
      }
      .eh-hero-add-photo-btn:hover { border-color: var(--eh-gold); color: var(--eh-gold-bright); }

      .eh-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
      .eh-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .eh-search {
        background: rgba(255,255,255,0.04); border: 1px solid var(--eh-hairline); border-radius: 999px;
        padding: 9px 15px; color: var(--eh-text); font-size: 13px; min-width: 190px;
      }
      .eh-search::placeholder { color: var(--eh-text-mute); }
      .eh-btn-primary {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 10px 18px; border: none; border-radius: 999px; cursor: pointer;
        background: linear-gradient(180deg, var(--eh-gold-bright) 0%, var(--eh-gold) 100%);
        color: #24190c; font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
      }
      .eh-btn-primary:hover { filter: brightness(1.06); }
      .eh-btn-secondary {
        padding: 9px 16px; border-radius: 999px; cursor: pointer;
        background: rgba(255,255,255,0.04); border: 1px solid var(--eh-hairline); color: var(--eh-text-dim);
        font-size: 12.5px; font-weight: 600;
      }
      .eh-btn-secondary:hover { background: rgba(201,168,118,0.12); color: var(--eh-gold-bright); border-color: var(--eh-gold); }

      .eh-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
      .eh-chip {
        padding: 8px 15px; border-radius: 999px; border: 1px solid var(--eh-hairline);
        background: rgba(255,255,255,0.03); color: var(--eh-text-dim); font-size: 12.5px; font-weight: 600;
        cursor: pointer; -webkit-tap-highlight-color: transparent; white-space: nowrap;
      }
      .eh-chip:hover { border-color: var(--eh-gold); }
      .eh-chip.active { background: var(--eh-accent-tint); color: var(--eh-gold-bright); border-color: var(--eh-gold); }
      .eh-chip.eh-chip-fav.active { background: rgba(255,209,102,0.14); color: #ffd166; border-color: #ffd166; }

      .eh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 18px; }
      .eh-empty { padding: 40px 16px; text-align: center; color: var(--eh-text-mute); font-size: 13.5px; border: 1px dashed var(--eh-hairline); border-radius: 16px; }

      .eh-card {
        position: relative; display: flex; flex-direction: column;
        background: rgba(255,255,255,0.055); border: 1px solid var(--eh-hairline); border-radius: 16px;
        overflow: hidden; cursor: pointer; text-decoration: none; color: inherit;
        box-shadow: 0 10px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05);
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .eh-card:hover { transform: translateY(-3px); border-color: var(--eh-gold); }
      .eh-card-cover-wrap { position: relative; width: 100%; aspect-ratio: 4 / 3; background: linear-gradient(150deg, #201a12, #0d0a06); overflow: hidden; }
      .eh-card-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
      .eh-card-cover-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 44px; opacity: 0.5; }
      .eh-card-cover-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(5,4,3,0.85) 100%); pointer-events: none; }

      .eh-card-fav-btn {
        position: absolute; top: 10px; right: 10px; z-index: 2;
        width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
        background: rgba(11,10,8,0.55); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center; font-size: 17px; color: rgba(255,255,255,0.55);
      }
      .eh-card-fav-btn.on { color: #ffd166; filter: drop-shadow(0 0 6px rgba(255,209,102,0.85)); }

      .eh-card-actions { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s ease; }
      .eh-card:hover .eh-card-actions, .eh-card:focus-within .eh-card-actions { opacity: 1; }
      .eh-card-icon-btn {
        width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
        background: rgba(11,10,8,0.6); backdrop-filter: blur(6px); color: var(--eh-text-dim);
        display: flex; align-items: center; justify-content: center; font-size: 13px;
      }
      .eh-card-icon-btn:hover { color: var(--eh-gold-bright); }
      .eh-card-drag { cursor: grab; }

      .eh-card-source-tag {
        position: absolute; bottom: 8px; left: 10px; z-index: 2;
        font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em;
        padding: 4px 9px; border-radius: 999px; background: rgba(11,10,8,0.65); backdrop-filter: blur(6px);
        color: var(--eh-gold-bright); border: 1px solid var(--eh-hairline);
      }

      .eh-card-body { padding: 13px 14px 15px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
      .eh-card-title { font-family: var(--font-serif); font-style: italic; font-weight: 600; font-size: 18px; line-height: 1.2; }
      .eh-card-creator { font-size: 11.5px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--eh-text-mute); }
      .eh-card-subtopic { font-size: 11px; color: var(--eh-gold); font-weight: 600; }
      .eh-card-desc { font-size: 12px; color: var(--eh-text-dim); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .eh-card-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 6px; }
      .eh-card-length { font-size: 11px; color: var(--eh-text-mute); }

      .eh-stars { display: inline-flex; gap: 2px; }
      .eh-star {
        background: transparent; border: none; cursor: pointer; padding: 1px;
        font-size: 15px; line-height: 1; color: rgba(255,255,255,0.2);
      }
      .eh-star.on { color: var(--eh-gold-bright); filter: drop-shadow(0 0 5px rgba(232,207,159,0.85)); }
      .eh-stars.eh-stars-lg .eh-star { font-size: 22px; }

      .modal-bg { position: fixed; inset: 0; z-index: 3000; background: rgba(5,4,3,0.72); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 20px; }
      .modal-bg.show { display: flex; }
      .modal {
        width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto;
        background: rgba(20,17,13,0.92); border: 1px solid var(--eh-hairline); border-radius: 18px;
        padding: 22px; display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      }
      .modal h3 { font-family: var(--font-serif); font-style: italic; font-size: 21px; font-weight: 600; }
      .eh-field { display: flex; flex-direction: column; gap: 5px; }
      .eh-field label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--eh-text-mute); }
      .eh-field input, .eh-field select, .eh-field textarea {
        background: rgba(255,255,255,0.05); border: 1px solid var(--eh-hairline); border-radius: 10px;
        padding: 9px 11px; color: var(--eh-text); font-size: 13.5px; font-family: inherit;
      }
      .eh-field textarea { resize: vertical; min-height: 60px; }
      .eh-field-row { display: flex; gap: 10px; }
      .eh-field-row .eh-field { flex: 1; min-width: 0; }
      .eh-url-row { display: flex; gap: 8px; }
      .eh-url-row input { flex: 1; min-width: 0; }
      .eh-url-hint { font-size: 11px; color: var(--eh-text-mute); min-height: 14px; }
      .eh-cover-preview-wrap { display: flex; align-items: center; gap: 12px; }
      .eh-cover-preview { width: 96px; height: 72px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.05); border: 1px solid var(--eh-hairline); flex-shrink: 0; }
      .eh-cover-controls { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
      .eh-fav-toggle-row { display: flex; align-items: center; gap: 10px; }
      .eh-modal-actions { display: flex; gap: 10px; margin-top: 4px; }
      .eh-modal-actions .eh-btn-primary, .eh-modal-actions .eh-btn-secondary { flex: 1; justify-content: center; }
      .eh-delete-link { text-align: center; font-size: 12px; color: var(--eh-danger); cursor: pointer; text-decoration: underline; }
      .eh-hint-note { font-size: 10.5px; color: var(--eh-text-mute); line-height: 1.4; }

      @media (max-width: 480px) { .eh-header-actions { width: 100%; } .eh-search { flex: 1; } }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // SHARED WIDGETS
  // ============================================================
  function buildStars(rating, size, onSet) {
    const wrap = document.createElement('div');
    wrap.className = 'eh-stars' + (size === 'lg' ? ' eh-stars-lg' : '');
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eh-star' + (i <= rating ? ' on' : '');
      btn.textContent = '★';
      btn.setAttribute('aria-label', 'Rate ' + i + ' star' + (i === 1 ? '' : 's'));
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        onSet(i === rating ? 0 : i); // click the same star again to clear
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  function openLink(url) {
    if (!EH.isValidMediaUrl(url)) return false;
    window.open(url, '_blank', 'noopener');
    return true;
  }

  // ============================================================
  // HERO — one large, editable cover-photo banner per page (all five),
  // same upload-or-paste-a-photo / Change / Remove mechanism and
  // page-wide blurred backdrop every other hero-bearing page in this app
  // already uses (business.html's per-tab hero, dreamboard.html,
  // aitech.html, tasks.html, etc.) — built once here and reused by every
  // one of the five Entertainment pages rather than five separate copies.
  // ============================================================
  function ensurePageBg() {
    let bg = $('ehPageBg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'ehPageBg';
      document.body.appendChild(bg);
    }
    return bg;
  }
  function renderPageBg(photo) {
    const bg = ensurePageBg();
    bg.style.backgroundImage = photo ? ('url("' + photo + '")') : 'none';
  }

  function buildHero(container, pageKey, defaults) {
    ensurePageBg();
    const hero = document.createElement('div');
    hero.className = 'eh-hero';
    hero.id = 'ehHero';
    hero.innerHTML = `
      <div class="eh-hero-media" id="ehHeroMedia"></div>
      <div class="eh-hero-overlay"></div>
      <div class="eh-hero-photo-tools" id="ehHeroPhotoTools" style="display:none;">
        <button type="button" class="eh-btn-secondary" id="ehHeroChangeBtn">Change</button>
        <button type="button" class="eh-btn-secondary" id="ehHeroRemoveBtn">Remove</button>
      </div>
      <div class="eh-hero-photo-choice" id="ehHeroPhotoChoice">
        <button type="button" class="eh-hero-add-photo-btn" id="ehHeroAddBtn">+ Add a cover photo</button>
      </div>
      <input type="file" id="ehHeroFile" accept="image/*" style="display:none;">
      <div class="eh-hero-content">
        <span class="eh-hero-eyebrow" id="ehHeroEyebrow" contenteditable="true" spellcheck="false"></span>
        <textarea class="eh-hero-title" id="ehHeroTitle" rows="1" spellcheck="false"></textarea>
        <p class="eh-hero-subtext" id="ehHeroSubtext" contenteditable="true" spellcheck="false"></p>
      </div>
    `;
    container.appendChild(hero);

    let hero_ = EH.getHero(pageKey, defaults);

    function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

    function renderMedia() {
      const media = $('ehHeroMedia');
      media.innerHTML = '';
      if (hero_.photo) {
        const img = document.createElement('img');
        img.src = hero_.photo; img.alt = '';
        media.appendChild(img);
        $('ehHeroPhotoTools').style.display = 'flex';
        $('ehHeroPhotoChoice').style.display = 'none';
      } else {
        $('ehHeroPhotoTools').style.display = 'none';
        $('ehHeroPhotoChoice').style.display = 'flex';
      }
      renderPageBg(hero_.photo);
    }

    function populate() {
      $('ehHeroEyebrow').textContent = hero_.eyebrow;
      $('ehHeroTitle').value = hero_.title;
      $('ehHeroSubtext').textContent = hero_.subtext;
      renderMedia();
      setTimeout(function () { autosize($('ehHeroTitle')); }, 0);
    }
    populate();

    // Merge against the currently-displayed hero_ (which may still be
    // showing unsaved defaults, not yet persisted anywhere) rather than
    // whatever's already in storage — otherwise the very first edit to
    // just one field (e.g. the eyebrow) would wipe every other
    // still-default field back to empty the moment it's persisted.
    function save(patch) { hero_ = EH.saveHero(pageKey, Object.assign({}, hero_, patch)); }

    $('ehHeroEyebrow').addEventListener('blur', function () { save({ eyebrow: $('ehHeroEyebrow').textContent.trim() }); });
    $('ehHeroSubtext').addEventListener('blur', function () { save({ subtext: $('ehHeroSubtext').textContent.trim() }); });
    $('ehHeroTitle').addEventListener('input', function () { autosize($('ehHeroTitle')); });
    $('ehHeroTitle').addEventListener('blur', function () { save({ title: $('ehHeroTitle').value.trim() }); });

    function openPicker() { $('ehHeroFile').click(); }
    $('ehHeroAddBtn').addEventListener('click', openPicker);
    $('ehHeroChangeBtn').addEventListener('click', openPicker);
    $('ehHeroRemoveBtn').addEventListener('click', function () { save({ photo: '' }); renderMedia(); });
    $('ehHeroFile').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function () {
        const compressed = await EH.compressImageDataUrl(String(reader.result), 1400, 0.82);
        save({ photo: compressed });
        renderMedia();
        if (window.PhotoStore) {
          window.PhotoStore.upload(compressed, function (url) {
            if (hero_.photo === compressed) { save({ photo: url }); renderMedia(); }
          });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  }

  // ============================================================
  // MODAL — one shared Add/Edit modal, reused by both a content page
  // (editing/adding within its own collection) and the Favorites page
  // (editing an item that may belong to any of the four collections —
  // pageKey is always explicit, never assumed from "the current page").
  // ============================================================
  let modalState = { pageKey: null, id: null, cover: '', fetchToken: 0, titleTouched: false };
  let onModalSaved = null; // callback(pageKey) — lets each caller re-render its own view

  function buildModal() {
    if ($('ehModalBg')) return;
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.id = 'ehModalBg';
    bg.innerHTML = `
      <div class="modal">
        <h3 id="ehModalTitle">Add item</h3>
        <div class="eh-field">
          <label>Link (YouTube or Spotify auto-fills the rest)</label>
          <div class="eh-url-row">
            <input type="url" id="ehUrl" placeholder="https://…">
            <button type="button" class="eh-btn-secondary" id="ehFetchBtn">Fetch</button>
          </div>
          <div class="eh-url-hint" id="ehUrlHint"></div>
        </div>
        <div class="eh-field">
          <label>Title</label>
          <input type="text" id="ehTitleInput" placeholder="Title">
        </div>
        <div class="eh-field-row">
          <div class="eh-field">
            <label>Author / Creator</label>
            <input type="text" id="ehCreatorInput" placeholder="Who made it">
          </div>
          <div class="eh-field">
            <label>Page it belongs to</label>
            <select id="ehSubtopicInput"></select>
          </div>
        </div>
        <div class="eh-field">
          <label>Cover</label>
          <div class="eh-cover-preview-wrap">
            <img class="eh-cover-preview" id="ehCoverPreview" alt="">
            <div class="eh-cover-controls">
              <input type="text" id="ehCoverUrlInput" placeholder="Paste a cover image URL…">
              <input type="file" id="ehCoverFile" accept="image/*" style="display:none;">
              <button type="button" class="eh-btn-secondary" id="ehCoverUploadBtn">Upload a photo</button>
            </div>
          </div>
        </div>
        <div class="eh-field">
          <label>Description <span class="eh-hint-note">(not auto-filled — YouTube/Spotify don't provide one)</span></label>
          <textarea id="ehDescInput" placeholder="What is this?"></textarea>
        </div>
        <div class="eh-field-row">
          <div class="eh-field">
            <label>Length <span class="eh-hint-note">(not auto-filled)</span></label>
            <input type="text" id="ehLengthInput" placeholder="e.g. 42 min">
          </div>
          <div class="eh-field">
            <label>Rating</label>
            <div id="ehModalStars"></div>
          </div>
        </div>
        <div class="eh-fav-toggle-row">
          <input type="checkbox" id="ehFavInput">
          <label for="ehFavInput" style="font-size:12.5px;color:var(--eh-text-dim);">☆ Favorite this — syncs to the Favorites page</label>
        </div>
        <div class="eh-modal-actions">
          <button type="button" class="eh-btn-secondary" id="ehModalCancel">Cancel</button>
          <button type="button" class="eh-btn-primary" id="ehModalSave">Save</button>
        </div>
        <span class="eh-delete-link" id="ehDeleteLink" style="display:none;">Delete this item</span>
      </div>
    `;
    document.body.appendChild(bg);

    $('ehModalCancel').addEventListener('click', closeModal);
    bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(); });
    $('ehTitleInput').addEventListener('input', function () { modalState.titleTouched = true; });
    $('ehFetchBtn').addEventListener('click', runFetch);
    $('ehUrl').addEventListener('change', runFetch);
    $('ehCoverUrlInput').addEventListener('change', function () {
      const v = $('ehCoverUrlInput').value.trim();
      if (v) { modalState.cover = v; updateCoverPreview(); }
    });
    $('ehCoverUploadBtn').addEventListener('click', function () { $('ehCoverFile').click(); });
    $('ehCoverFile').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function () {
        const compressed = await EH.compressImageDataUrl(String(reader.result), 900, 0.82);
        modalState.cover = compressed;
        updateCoverPreview();
        if (window.PhotoStore) {
          window.PhotoStore.upload(compressed, function (url) {
            if (modalState.cover === compressed) { modalState.cover = url; updateCoverPreview(); }
          });
        }
      };
      reader.readAsDataURL(file);
    });
    $('ehModalSave').addEventListener('click', saveModal);
    $('ehDeleteLink').addEventListener('click', deleteFromModal);
  }

  function updateCoverPreview() {
    const img = $('ehCoverPreview');
    img.src = modalState.cover || '';
    img.style.visibility = modalState.cover ? 'visible' : 'hidden';
  }

  async function runFetch() {
    const url = $('ehUrl').value.trim();
    if (!url) return;
    const hint = $('ehUrlHint');
    hint.textContent = 'Fetching…';
    const token = ++modalState.fetchToken;
    const preview = await EH.fetchPreview(url);
    if (token !== modalState.fetchToken) return; // a newer fetch superseded this one
    if (!modalState.titleTouched && preview.title) $('ehTitleInput').value = preview.title;
    if (preview.creator && !$('ehCreatorInput').value.trim()) $('ehCreatorInput').value = preview.creator;
    if (preview.cover) { modalState.cover = preview.cover; updateCoverPreview(); }
    hint.textContent = (preview.title || preview.cover)
      ? 'Auto-filled from the link. Description and length aren’t provided by YouTube/Spotify previews — add them by hand below.'
      : "Couldn't auto-fetch a preview for this link — paste a cover URL or upload one, and fill in the rest by hand.";
  }

  function populateSubtopicSelect(pageKey, selected) {
    const sel = $('ehSubtopicInput');
    sel.innerHTML = '';
    EH.PAGES[pageKey].subtopics.forEach(function (s) {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      if (s === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function openModal(pageKey, id, defaultSubtopic) {
    buildModal();
    const item = id ? EH.collectionFor(pageKey).get(id) : null;
    modalState = { pageKey: pageKey, id: id || null, cover: item ? item.cover : '', fetchToken: 0, titleTouched: !!item };
    $('ehModalTitle').textContent = item ? 'Edit item' : 'Add item';
    $('ehUrl').value = item ? item.url : '';
    $('ehTitleInput').value = item ? item.title : '';
    $('ehCreatorInput').value = item ? item.creator : '';
    $('ehDescInput').value = item ? item.description : '';
    $('ehLengthInput').value = item ? item.lengthText : '';
    $('ehCoverUrlInput').value = '';
    $('ehUrlHint').textContent = '';
    $('ehFavInput').checked = item ? !!item.favorite : false;
    populateSubtopicSelect(pageKey, item ? item.subtopic : (defaultSubtopic || EH.PAGES[pageKey].subtopics[0]));
    updateCoverPreview();
    wireModalStars(item ? item.rating : 0);
    $('ehDeleteLink').style.display = item ? 'inline' : 'none';
    document.getElementById('ehModalBg').classList.add('show');
  }
  function wireModalStars(initialRating) {
    modalState.rating = initialRating;
    const starsHost = $('ehModalStars');
    function render() {
      starsHost.innerHTML = '';
      starsHost.appendChild(buildStars(modalState.rating, 'md', function (r) {
        modalState.rating = r;
        render();
      }));
    }
    render();
  }
  function closeModal() {
    const bg = $('ehModalBg');
    if (bg) bg.classList.remove('show');
  }
  function saveModal() {
    const pageKey = modalState.pageKey;
    const url = $('ehUrl').value.trim();
    const title = $('ehTitleInput').value.trim();
    if (!title) { alert('Give it a title first.'); return; }
    const patch = {
      url: url,
      title: title,
      creator: $('ehCreatorInput').value.trim(),
      subtopic: $('ehSubtopicInput').value,
      cover: modalState.cover,
      description: $('ehDescInput').value.trim(),
      lengthText: $('ehLengthInput').value.trim(),
      rating: modalState.rating || 0,
      favorite: $('ehFavInput').checked
    };
    if (modalState.id) {
      EH.collectionFor(pageKey).update(modalState.id, patch);
    } else {
      patch.order = EH.nextOrder(pageKey);
      EH.collectionFor(pageKey).add(patch);
    }
    closeModal();
    if (onModalSaved) onModalSaved(pageKey);
  }
  function deleteFromModal() {
    if (!modalState.id) return;
    if (!confirm('Delete this item? This can’t be undone.')) return;
    EH.collectionFor(modalState.pageKey).remove(modalState.id);
    closeModal();
    if (onModalSaved) onModalSaved(modalState.pageKey);
  }

  // ============================================================
  // CARD
  // ============================================================
  function buildCard(item, pageKey, opts) {
    opts = opts || {};
    const card = document.createElement('div');
    card.className = 'eh-card';
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'link');

    const coverWrap = document.createElement('div');
    coverWrap.className = 'eh-card-cover-wrap';
    if (item.cover) {
      const img = document.createElement('img');
      img.className = 'eh-card-cover';
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.cover;
      img.addEventListener('error', function () { img.style.display = 'none'; fallback.style.display = 'flex'; });
      coverWrap.appendChild(img);
    }
    const fallback = document.createElement('div');
    fallback.className = 'eh-card-cover-fallback';
    fallback.textContent = EH.PAGES[pageKey].icon;
    fallback.style.display = item.cover ? 'none' : 'flex';
    coverWrap.appendChild(fallback);
    const scrim = document.createElement('div');
    scrim.className = 'eh-card-cover-scrim';
    coverWrap.appendChild(scrim);

    // Drag handle + edit/delete, hover-revealed, top-left
    const actions = document.createElement('div');
    actions.className = 'eh-card-actions';
    if (opts.draggable) {
      const handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'eh-card-icon-btn eh-card-drag'; handle.textContent = '⋮⋮';
      handle.setAttribute('aria-label', 'Drag to reorder');
      // A tap that doesn't turn into a real drag still fires a click —
      // stop it from bubbling up to the card's own "open the link"
      // handler, same guard the favorite/edit buttons already have.
      handle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      actions.appendChild(handle);
    }
    const editBtn = document.createElement('button');
    editBtn.type = 'button'; editBtn.className = 'eh-card-icon-btn'; editBtn.textContent = '✎';
    editBtn.setAttribute('aria-label', 'Edit');
    editBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openModal(pageKey, item.id);
    });
    actions.appendChild(editBtn);
    coverWrap.appendChild(actions);

    // Favorite star toggle, top-right
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'eh-card-fav-btn' + (item.favorite ? ' on' : '');
    favBtn.textContent = item.favorite ? '★' : '☆';
    favBtn.setAttribute('aria-label', item.favorite ? 'Remove from Favorites' : 'Add to Favorites');
    favBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      EH.toggleFavorite(pageKey, item.id);
      if (opts.onFavoriteToggled) opts.onFavoriteToggled();
    });
    coverWrap.appendChild(favBtn);

    if (opts.showSourceTag) {
      const tag = document.createElement('div');
      tag.className = 'eh-card-source-tag';
      tag.textContent = EH.PAGES[pageKey].icon + ' ' + EH.PAGES[pageKey].label;
      coverWrap.appendChild(tag);
    }

    card.appendChild(coverWrap);

    const body = document.createElement('div');
    body.className = 'eh-card-body';
    const title = document.createElement('div'); title.className = 'eh-card-title'; title.textContent = item.title || 'Untitled';
    body.appendChild(title);
    if (item.creator) {
      const creator = document.createElement('div'); creator.className = 'eh-card-creator'; creator.textContent = item.creator;
      body.appendChild(creator);
    }
    const subtopic = document.createElement('div'); subtopic.className = 'eh-card-subtopic'; subtopic.textContent = item.subtopic;
    body.appendChild(subtopic);
    if (item.description) {
      const desc = document.createElement('div'); desc.className = 'eh-card-desc'; desc.textContent = item.description;
      body.appendChild(desc);
    }
    const metaRow = document.createElement('div'); metaRow.className = 'eh-card-meta-row';
    const stars = buildStars(item.rating, 'sm', function (r) {
      EH.setRating(pageKey, item.id, r);
      if (opts.onRatingChanged) opts.onRatingChanged();
    });
    metaRow.appendChild(stars);
    if (item.lengthText) {
      const len = document.createElement('span'); len.className = 'eh-card-length'; len.textContent = item.lengthText;
      metaRow.appendChild(len);
    }
    body.appendChild(metaRow);
    card.appendChild(body);

    function activate() {
      if (!openLink(item.url)) openModal(pageKey, item.id);
    }
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });

    return card;
  }

  // ============================================================
  // GALLERY PAGE (Podcasts / Stories / Entertainment / Playlists)
  // ============================================================
  let sortableInstance = null;
  function initGalleryPage(pageKey) {
    injectStyles();
    buildModal();
    const cfg = EH.PAGES[pageKey];
    document.title = cfg.label;

    const shell = document.createElement('div');
    shell.className = 'eh-shell';
    shell.innerHTML = `
      <a href="index.html" class="eh-back-btn" aria-label="Back to dashboard"><span>←</span><span>Back</span></a>
      <div id="ehHeroSlot"></div>
      <div class="eh-content">
        <div class="eh-toolbar">
          <input type="search" class="eh-search" id="ehSearchInput" placeholder="Search ${cfg.label.toLowerCase()}…">
          <button type="button" class="eh-btn-primary" id="ehAddBtn">+ Add</button>
        </div>
        <div class="eh-subtabs" id="ehSubtabs"></div>
        <div class="eh-grid" id="ehGrid"></div>
        <div class="eh-empty" id="ehEmpty" style="display:none;"></div>
      </div>
    `;
    document.body.appendChild(shell);

    buildHero($('ehHeroSlot'), pageKey, {
      eyebrow: 'Entertainment · ' + cfg.label,
      title: cfg.icon + '  ' + cfg.label,
      subtext: 'Paste a link and everything fetchable fills itself in. Drag to reorder, click a card to open it, star to rate, and tap the ☆ to send it straight to Favorites.'
    });

    // Sub-topic (or Favorites) is read with the same priority order this
    // app's other nested nav entries already use: a real URL hash first
    // (topbar.js's own child links deep-link straight to one), else the
    // last one used on this device (localStorage), else the page's first
    // sub-topic.
    const activeKey = 'enthub:' + pageKey + ':activeSubtopic';
    function subtopicFromHash() {
      const slug = (location.hash || '').replace(/^#/, '');
      return slug ? EH.subtopicForSlug(pageKey, slug) : null;
    }
    let activeSubtopic = subtopicFromHash() || localStorage.getItem(activeKey) || cfg.subtopics[0];
    if (activeSubtopic !== '__favorites__' && cfg.subtopics.indexOf(activeSubtopic) === -1) activeSubtopic = cfg.subtopics[0];
    function setActiveSubtopic(s) {
      activeSubtopic = s;
      localStorage.setItem(activeKey, s);
      try { history.replaceState(null, '', '#' + (s === '__favorites__' ? 'favorites' : EH.slugForSubtopic(s))); } catch (e) {}
      renderSubtabs(); renderGrid();
    }
    let searchQuery = '';

    function renderSubtabs() {
      const row = $('ehSubtabs');
      row.innerHTML = '';
      cfg.subtopics.forEach(function (s) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'eh-chip' + (s === activeSubtopic ? ' active' : '');
        chip.textContent = s;
        chip.addEventListener('click', function () { setActiveSubtopic(s); });
        row.appendChild(chip);
      });
      const favChip = document.createElement('button');
      favChip.type = 'button';
      favChip.className = 'eh-chip eh-chip-fav' + (activeSubtopic === '__favorites__' ? ' active' : '');
      favChip.textContent = '★ Favorites';
      favChip.addEventListener('click', function () { setActiveSubtopic('__favorites__'); });
      row.appendChild(favChip);
    }

    function currentItems() {
      let items = activeSubtopic === '__favorites__' ? EH.favoritesForPage(pageKey) : EH.itemsForSubtopic(pageKey, activeSubtopic);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(function (x) { return (x.title || '').toLowerCase().indexOf(q) !== -1 || (x.creator || '').toLowerCase().indexOf(q) !== -1; });
      }
      return items;
    }

    function renderGrid() {
      const grid = $('ehGrid');
      const empty = $('ehEmpty');
      grid.innerHTML = '';
      const items = currentItems();
      if (!items.length) {
        empty.style.display = 'block';
        empty.textContent = activeSubtopic === '__favorites__'
          ? 'No favorites here yet — tap the ☆ on any card to add one.'
          : ('Nothing in ' + activeSubtopic + ' yet — add your first one.');
        if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
        return;
      }
      empty.style.display = 'none';
      items.forEach(function (item) {
        grid.appendChild(buildCard(item, pageKey, {
          draggable: activeSubtopic !== '__favorites__' && !searchQuery,
          onFavoriteToggled: renderGrid,
          onRatingChanged: renderGrid
        }));
      });
      if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
      if (activeSubtopic !== '__favorites__' && !searchQuery && window.Sortable) {
        sortableInstance = window.Sortable.create(grid, {
          handle: '.eh-card-drag',
          animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
          delay: 150, delayOnTouchOnly: true, touchStartThreshold: 6,
          onEnd: function () {
            const ids = Array.prototype.map.call(grid.children, function (el) { return el.dataset.id; });
            EH.reorderVisible(pageKey, ids);
          }
        });
      }
    }

    onModalSaved = function () { renderSubtabs(); renderGrid(); };

    $('ehAddBtn').addEventListener('click', function () {
      const defaultSub = activeSubtopic === '__favorites__' ? cfg.subtopics[0] : activeSubtopic;
      openModal(pageKey, null, defaultSub);
    });
    $('ehSearchInput').addEventListener('input', function () { searchQuery = $('ehSearchInput').value.trim(); renderGrid(); });

    renderSubtabs();
    renderGrid();
    window.addEventListener('storage', function () { renderSubtabs(); renderGrid(); });
    window.addEventListener('hashchange', function () {
      const fromHash = subtopicFromHash();
      if (fromHash && fromHash !== activeSubtopic) { activeSubtopic = fromHash; localStorage.setItem(activeKey, activeSubtopic); renderSubtabs(); renderGrid(); }
    });
    EH.bootSync(function () { renderSubtabs(); renderGrid(); });
  }

  // ============================================================
  // FAVORITES PAGE — aggregates every favorited item across all four
  // collections, filterable by source page. Fully editable/removable
  // in place (writes straight back to the item's real, owning
  // collection — there is no separate Favorites collection to drift).
  // ============================================================
  function initFavoritesPage() {
    injectStyles();
    buildModal();
    document.title = 'Favorites';

    const shell = document.createElement('div');
    shell.className = 'eh-shell';
    shell.innerHTML = `
      <a href="index.html" class="eh-back-btn" aria-label="Back to dashboard"><span>←</span><span>Back</span></a>
      <div id="ehHeroSlot"></div>
      <div class="eh-content">
        <div class="eh-toolbar">
          <input type="search" class="eh-search" id="ehSearchInput" placeholder="Search favorites…">
        </div>
        <div class="eh-subtabs" id="ehSubtabs"></div>
        <div class="eh-grid" id="ehGrid"></div>
        <div class="eh-empty" id="ehEmpty" style="display:none;"></div>
      </div>
    `;
    document.body.appendChild(shell);

    buildHero($('ehHeroSlot'), 'favorites', {
      eyebrow: 'Entertainment · Favorites',
      title: '★  Favorites',
      subtext: 'Every item you’ve starred, from Podcasts, Stories, Entertainment, and Playlists — filter by page, edit or unfavorite in place.'
    });

    // Same hash-first, localStorage-fallback priority as the gallery
    // pages' own sub-topic tabs — topbar.js's children links deep-link
    // straight to one page's filtered view (e.g. ent-favorites.html#podcasts).
    function pageFromHash() {
      const slug = (location.hash || '').replace(/^#/, '');
      return (slug && (slug === 'all' || EH.PAGES[slug])) ? (slug === 'all' ? '__all__' : slug) : null;
    }
    let activePage = pageFromHash() || localStorage.getItem('enthub:favorites:activePage') || '__all__';
    let searchQuery = '';

    function setActivePage(pk) {
      activePage = pk;
      localStorage.setItem('enthub:favorites:activePage', activePage);
      try { history.replaceState(null, '', '#' + (activePage === '__all__' ? 'all' : activePage)); } catch (e) {}
      renderSubtabs(); renderGrid();
    }

    function renderSubtabs() {
      const row = $('ehSubtabs');
      row.innerHTML = '';
      const allChip = document.createElement('button');
      allChip.type = 'button';
      allChip.className = 'eh-chip' + (activePage === '__all__' ? ' active' : '');
      allChip.textContent = 'All pages';
      allChip.addEventListener('click', function () { setActivePage('__all__'); });
      row.appendChild(allChip);
      EH.PAGE_ORDER.forEach(function (pk) {
        const cfg = EH.PAGES[pk];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'eh-chip' + (activePage === pk ? ' active' : '');
        chip.textContent = cfg.icon + ' ' + cfg.label;
        chip.addEventListener('click', function () { setActivePage(pk); });
        row.appendChild(chip);
      });
    }

    function currentItems() {
      let items = EH.allFavorites();
      if (activePage !== '__all__') items = items.filter(function (x) { return x._pageKey === activePage; });
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(function (x) { return (x.title || '').toLowerCase().indexOf(q) !== -1 || (x.creator || '').toLowerCase().indexOf(q) !== -1; });
      }
      return items;
    }

    function renderGrid() {
      const grid = $('ehGrid');
      const empty = $('ehEmpty');
      grid.innerHTML = '';
      const items = currentItems();
      if (!items.length) {
        empty.style.display = 'block';
        empty.textContent = 'No favorites here yet — open Podcasts, Stories, Entertainment, or Playlists and tap ☆ on anything you love.';
        return;
      }
      empty.style.display = 'none';
      items.forEach(function (item) {
        grid.appendChild(buildCard(item, item._pageKey, {
          draggable: false,
          showSourceTag: activePage === '__all__',
          onFavoriteToggled: renderGrid,
          onRatingChanged: renderGrid
        }));
      });
    }

    onModalSaved = function () { renderSubtabs(); renderGrid(); };

    $('ehSearchInput').addEventListener('input', function () { searchQuery = $('ehSearchInput').value.trim(); renderGrid(); });

    renderSubtabs();
    renderGrid();
    window.addEventListener('storage', function () { renderSubtabs(); renderGrid(); });
    window.addEventListener('hashchange', function () {
      const fromHash = pageFromHash();
      if (fromHash && fromHash !== activePage) { activePage = fromHash; localStorage.setItem('enthub:favorites:activePage', activePage); renderSubtabs(); renderGrid(); }
    });
    EH.bootSync(function () { renderSubtabs(); renderGrid(); });
  }

  global.EntHubUI = {
    initGalleryPage: function (pageKey) { runSafely(function () { initGalleryPage(pageKey); }, 'initGalleryPage:' + pageKey); },
    initFavoritesPage: function () { runSafely(initFavoritesPage, 'initFavoritesPage'); },
    showBootErrorBanner: showBootErrorBanner
  };
})(window);
