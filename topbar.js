// =============================================================
// Persistent dashboard top bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS and reads progress from the same
// localStorage keys the dashboard's tabs already use.
// =============================================================
(function () {
  'use strict';

  // -------- Supabase config (same project as the rest of the dashboard) --------
  // For your audience's standalone, replace these with placeholders
  // and have them paste their own values, just like the other pages.
  const TOPBAR_SUPABASE_URL = 'https://jomlmvslzsmmzgjnqvbm.supabase.co';
  const TOPBAR_SUPABASE_KEY = 'sb_publishable_BrZrVgVxLA_idNX19sGhwg_mo7Ta41N';

  // -------- CSS --------
  // Redesigned nav: a centered, wrapping "chip cloud" of naturally-sized
  // pills on desktop/tablet (instead of stretching every pill to fill an
  // equal-width slot, which squeezed labels as more pages were added)
  // plus a leading icon per pill for faster visual scanning, a warmer
  // gold active-state (this app's own common accent across most pages —
  // see CLAUDE.md §6), and a soft elevation shadow. Phones keep the
  // established horizontally-scrolling strip (a wrapping multi-row nav
  // eats too much vertical space on a narrow screen), just with roomier
  // touch targets.
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: center; align-items: center;
  padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
  /* Fully opaque so each page's body background can't bleed through
     and tint the bar a different color. Matches the dashboard's base
     dark background so the bar feels continuous with the page chrome. */
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --tb-accent: #d9b878;
  --tb-accent-bright: #f0dcae;
}
.topbar-pill {
  flex: 0 0 auto;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 15px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 999px;
  text-decoration: none;
  color: #FAFAFA;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.topbar-pill:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.16); transform: translateY(-1px); }
.topbar-pill-icon { font-size: 13px; line-height: 1; flex-shrink: 0; opacity: 0.9; }
.topbar-pill-label {
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.13em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
  flex-shrink: 0; white-space: nowrap;
  transition: color 0.15s ease;
}
.topbar-pill.active {
  background: linear-gradient(180deg, rgba(217, 184, 120, 0.22) 0%, rgba(217, 184, 120, 0.09) 100%);
  border-color: var(--tb-accent);
  box-shadow: 0 0 0 1px rgba(217, 184, 120, 0.22), 0 6px 16px rgba(217, 184, 120, 0.14);
}
.topbar-pill.active .topbar-pill-label { color: var(--tb-accent-bright); }
/* Below 700px, an 11-pill wrapping cloud starts eating too many rows of
   vertical space for a phone-sized viewport — switch to a horizontally
   scrollable single-row strip instead: every pill keeps its natural
   content width so its label always stays fully legible, and the row
   scrolls rather than wraps. Desktop/tablet are untouched. */
@media (max-width: 700px) {
  .topbar {
    justify-content: flex-start;
    padding-left: max(10px, env(safe-area-inset-left)); padding-right: max(10px, env(safe-area-inset-right));
    flex-wrap: nowrap; gap: 8px;
    overflow-x: auto; overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    scrollbar-width: none; -ms-overflow-style: none;
    /* Fade at both edges hints there's more to scroll, same affordance
       most mobile tab-strip UIs use. */
    mask-image: linear-gradient(90deg, transparent 0, black 14px, black calc(100% - 14px), transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, black 14px, black calc(100% - 14px), transparent 100%);
  }
  .topbar::-webkit-scrollbar { display: none; height: 0; }
  .topbar-pill {
    padding: 11px 15px; gap: 7px;
    scroll-snap-align: start;
  }
  .topbar-pill-label { font-size: 10.5px; letter-spacing: 0.10em; }
}

/* === Global mobile lockdown ===
   1) Hide the right-side scrollbar on phones (iOS uses overlay scrollbars anyway).
   2) Stop iOS auto-text-size-adjust.
   3) touch-action: pan-y prevents pinch-zoom while still allowing vertical scroll.
   4) overscroll-behavior on every common modal class stops scroll chaining —
      scrolling inside a settings popup won't drag the page behind it.
   5) When body has .topbar-modal-open, the page can't scroll at all (locked).
*/
html, body {
  -webkit-text-size-adjust: 100%;
}
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .wt-overlay, .wt-viewer {
  overscroll-behavior: contain;
}
body.topbar-modal-open {
  overflow: hidden;
  touch-action: none;
}
/* On phones, blow the modals up to full screen and let them be the only
   scrolling element. Way less "is this scrolling the page or the modal?"
   confusion. */
@media (max-width: 480px) {
  .modal-bg, .po-modal-bg {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 100vh !important;
    height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
  }
}
`;

  // -------- HTML --------
  // Home leads the row (this is now the dashboard's hub — see
  // CLAUDE.md's Home tab changelog entries). Main/Main Pillar/
  // Household/Brain Dump were removed per an explicit request — their
  // pages, data files, and pills are gone; each one's Supabase row
  // (`goals`/`mainpillar`/`household`/`braindump`) was left orphaned in
  // place, not cleaned up, same treatment as every other removed-page
  // key elsewhere in this app.
  const html = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick navigation">
  <a href="home.html" class="topbar-pill" id="topbarHome">
    <span class="topbar-pill-icon">🏠</span>
    <span class="topbar-pill-label">HOME</span>
  </a>
  <a href="gym.html" class="topbar-pill" id="topbarGym">
    <span class="topbar-pill-icon">🏋️</span>
    <span class="topbar-pill-label">STUDIO</span>
  </a>
  <a href="finance.html" class="topbar-pill" id="topbarFinance">
    <span class="topbar-pill-icon">💰</span>
    <span class="topbar-pill-label">FINANCE</span>
  </a>
  <a href="entertainment.html" class="topbar-pill" id="topbarEntertainment">
    <span class="topbar-pill-icon">🎬</span>
    <span class="topbar-pill-label">MEDIA</span>
  </a>
  <a href="nutrition.html" class="topbar-pill" id="topbarNutrition">
    <span class="topbar-pill-icon">🍽️</span>
    <span class="topbar-pill-label">NUTRITION</span>
  </a>
  <a href="selfcare.html" class="topbar-pill" id="topbarSelfCare">
    <span class="topbar-pill-icon">🌙</span>
    <span class="topbar-pill-label">SELF-CARE</span>
  </a>
  <a href="dreamboard.html" class="topbar-pill" id="topbarDreamBoard">
    <span class="topbar-pill-icon">✨</span>
    <span class="topbar-pill-label">DREAM BOARD</span>
  </a>
  <a href="business.html" class="topbar-pill" id="topbarBusiness">
    <span class="topbar-pill-icon">💼</span>
    <span class="topbar-pill-label">BUSINESS</span>
  </a>
  <a href="aitech.html" class="topbar-pill" id="topbarAiTech">
    <span class="topbar-pill-icon">🤖</span>
    <span class="topbar-pill-label">AI &amp; TECH</span>
  </a>
  <a href="learning.html" class="topbar-pill" id="topbarLearning">
    <span class="topbar-pill-icon">📚</span>
    <span class="topbar-pill-label">LEARNING</span>
  </a>
  <a href="tasksnotes.html" class="topbar-pill" id="topbarTasksNotes">
    <span class="topbar-pill-icon">✅</span>
    <span class="topbar-pill-label">TASKS &amp; NOTES</span>
  </a>
</header>
`;

  function injectStyleAndHTML() {
    if (document.getElementById('topbar')) return; // already injected
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  // Marks the current page's pill so it's visually distinct from the rest,
  // and — since the mobile layout scrolls horizontally instead of
  // squeezing everything onto one screen — scrolls it into view so
  // landing on e.g. Self-Care doesn't leave you wondering which of the
  // off-screen pills you're actually on.
  function highlightActivePill() {
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'home.html';
    const pills = document.querySelectorAll('.topbar-pill');
    pills.forEach((p) => {
      if (p.getAttribute('href') === path) {
        p.classList.add('active');
        if (typeof p.scrollIntoView === 'function') {
          p.scrollIntoView({ inline: 'center', block: 'nearest' });
        }
      }
    });
  }

  // pushWaterMergedToSupabase / TOPBAR_SUPABASE_URL / TOPBAR_SUPABASE_KEY
  // are protected — see CLAUDE.md's DO NOT MODIFY section. The Water page
  // and its topbar quick-add button were removed in an earlier pass; this
  // function has been unreachable dead code since then and is left exactly
  // as it was, not touched by this pass either.
  async function pushWaterMergedToSupabase(localWater) {
    // Only do this when we're NOT on the health page — health page
    // has its own sync that already detects the localStorage change.
    if (window.location.pathname.endsWith('/health.html') ||
        window.location.pathname.endsWith('health.html')) return;

    if (!window.supabase || !TOPBAR_SUPABASE_URL || !TOPBAR_SUPABASE_KEY) return;
    if (TOPBAR_SUPABASE_URL.indexOf('PASTE-') === 0) return;

    try {
      const supa = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      const { data } = await supa
        .from('app_state').select('data').eq('key', 'health').maybeSingle();
      const current = (data && data.data) || {};
      const merged = Object.assign({}, current, { po_water_v1: localWater });
      await supa.from('app_state').upsert(
        { key: 'health', data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) { /* offline — local change will sync next time user visits health */ }
  }

  // -------- Mobile lockdown helpers --------
  // Belt-and-suspenders zoom prevention — iOS Safari sometimes ignores
  // user-scalable=no, so we also kill the gesture events directly.
  function blockGesture(e) { e.preventDefault(); }
  function lockGestures() {
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });
    // Also kill the iOS double-tap-to-zoom on any tap.
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  // Watch every known modal-bg / overlay class — when any one of them
  // gets `.show` or `.is-open`, lock the body scroll. When the last
  // one closes, unlock.
  function startModalLock() {
    const MODAL_SELECTORS = [
      '.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam', '.project-page-bg', '.goal-page-bg', '.wfd-page-bg', '.lh-article-page-bg'
    ];
    function anyOpen() {
      for (const sel of MODAL_SELECTORS) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.classList.contains('show') || el.classList.contains('is-open')) {
            return true;
          }
        }
      }
      return false;
    }
    function sync() {
      document.body.classList.toggle('topbar-modal-open', anyOpen());
    }
    const observer = new MutationObserver(sync);
    // Observe class changes anywhere in body — modal toggles are rare so
    // a global subtree observer is cheap.
    observer.observe(document.body, {
      attributes: true, attributeFilter: ['class'], subtree: true
    });
    sync();
  }

  // -------- Boot --------
  function boot() {
    injectStyleAndHTML();
    highlightActivePill();
    lockGestures();
    startModalLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
