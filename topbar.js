// =============================================================
// Persistent dashboard navigation.
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

  // -------- Nav data --------
  // Every page in the dashboard, grouped the way a real sidebar app groups
  // its sections (see the reference screenshot this redesign was built to
  // match) instead of one long flat row. Every one of the 17 real .html
  // pages in this repo is listed here — including example.html, which
  // never had a nav entry before this redesign — so every page is reachable
  // in at most two clicks from anywhere: open the nav (1) + click a page
  // (2), or, since a page's own group auto-expands on load and every other
  // group starts expanded too, usually just one click.
  const NAV_GROUPS = [
    {
      key: 'command',
      label: 'Command Center',
      items: [
        { href: 'index.html', icon: '🎯', label: 'Main', id: 'topbarGoals', withCount: true },
        { href: 'system.html', icon: '⚙️', label: 'Build Your System', id: 'topbarSystem' },
        { href: 'mainpillar.html', icon: '🎮', label: 'Main Pillar', id: 'topbarMainPillar' },
        { href: 'tasks.html', icon: '🗂️', label: 'Tasks', id: 'topbarTasksDb' },
        { href: 'tasksnotes.html', icon: '✅', label: 'Tasks & Notes', id: 'topbarTasksNotes' },
      ],
    },
    {
      key: 'life',
      label: 'Life & Wellness',
      items: [
        { href: 'gym.html', icon: '🏋️', label: 'Fitness Studio', id: 'topbarGym' },
        { href: 'nutrition.html', icon: '🍽️', label: 'Nutrition', id: 'topbarNutrition' },
        { href: 'selfcare.html', icon: '🌙', label: 'Self-Care', id: 'topbarSelfCare' },
        { href: 'household.html', icon: '🧺', label: 'Household', id: 'topbarHousehold' },
        { href: 'finance.html', icon: '💰', label: 'Finance', id: 'topbarFinance' },
        { href: 'braindump.html', icon: '🧠', label: 'Brain Dump', id: 'topbarBrainDump' },
      ],
    },
    {
      key: 'create',
      label: 'Create & Grow',
      items: [
        { href: 'business.html', icon: '💼', label: 'Business Hub', id: 'topbarBusiness' },
        { href: 'dreamboard.html', icon: '✨', label: 'Dream Board', id: 'topbarDreamBoard' },
        { href: 'aitech.html', icon: '🤖', label: 'AI & Tech', id: 'topbarAiTech' },
        { href: 'learning.html', icon: '📚', label: 'Learning Hub', id: 'topbarLearning' },
        { href: 'entertainment.html', icon: '🎬', label: 'Media', id: 'topbarEntertainment' },
      ],
    },
    {
      key: 'more',
      label: 'More',
      items: [
        { href: 'example.html', icon: '🧪', label: 'Example', id: 'topbarExample' },
      ],
    },
  ];

  // -------- CSS --------
  // Redesigned as a collapsible sidebar nav (matching the look of a
  // reference "sidebar app" screenshot the user supplied: a brand mark, a
  // search box, and grouped/collapsible sections with a tree-line
  // indentation for nested items) rather than the previous horizontal pill
  // row. Built as an overlay drawer — fixed position, opened by a small
  // always-visible launcher pill — rather than a permanently-docked sidebar
  // that would shift every page's own content over. This app has 17
  // independent, hand-built pages with their own bespoke layouts, hero
  // banners, and full-viewport background layers (see CLAUDE.md §1/§3);
  // permanently reserving body space for a docked sidebar can't be safely
  // verified not to clip/overlap something on every one of them without
  // live visual testing, which isn't available in this environment. An
  // overlay drawer gets the exact same look and grouped/searchable
  // structure with zero risk to any existing page's layout, since nothing
  // about the page underneath ever moves. Palette reuses this app's own
  // already-established near-black/gold accent (the same tokens the prior
  // pill-row design already used) rather than the reference photo's own
  // blue/white palette — per CLAUDE.md DO NOT MODIFY rule 2 (reuse existing
  // design tokens, no new hard-coded colors) and §6 (this app's real common
  // accent is gold, not blue).
  const css = `
.tb-launcher {
  position: fixed; top: max(14px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left));
  z-index: 2600;
  display: inline-flex; align-items: center; gap: 9px;
  padding: 9px 14px 9px 10px;
  background: rgba(10, 10, 11, 0.72);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: #FAFAFA;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.tb-launcher:hover { border-color: rgba(217, 184, 120, 0.55); transform: translateY(-1px); }
.tb-launcher-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(155deg, #d9b878 0%, #f0dcae 100%);
  color: #23180a; font-size: 13px; font-weight: 700;
  position: relative;
}
.tb-launcher-dot {
  position: absolute; top: -3px; right: -3px;
  width: 9px; height: 9px; border-radius: 50%;
  background: transparent; border: 2px solid rgba(10,10,11,0.9);
  transition: background 0.2s ease;
}
.tb-launcher-dot.warn { background: #fbbf24; }
.tb-launcher-dot.miss { background: #ff8a8a; animation: tb-miss-pulse 1.6s ease-in-out infinite; }
@keyframes tb-miss-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
  50%      { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}
.tb-launcher-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
.tb-launcher-eyebrow {
  font-size: 8.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
}
.tb-launcher-page {
  font-size: 11.5px; font-weight: 700; color: #f0dcae; letter-spacing: 0.01em;
  max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tb-launcher-chevron { font-size: 10px; color: rgba(255,255,255,0.4); margin-left: 2px; }

.tb-scrim {
  position: fixed; inset: 0; z-index: 2500;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0; pointer-events: none;
  transition: opacity 0.22s ease;
}
.tb-scrim.show { opacity: 1; pointer-events: auto; }

.tb-sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 2700;
  width: min(300px, 86vw);
  display: flex; flex-direction: column;
  background: #0a0a0b;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 20px 0 50px rgba(0, 0, 0, 0.5);
  transform: translateX(-100%);
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.tb-sidebar.open { transform: translateX(0); }

.tb-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.tb-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  background: linear-gradient(155deg, #d9b878 0%, #f0dcae 100%);
  color: #23180a; font-size: 15px; font-weight: 700;
  box-shadow: 0 4px 14px rgba(217, 184, 120, 0.28);
}
.tb-brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.tb-brand-title { font-size: 14.5px; font-weight: 700; color: #FAFAFA; letter-spacing: 0.01em; }
.tb-brand-subtitle { font-size: 10px; color: rgba(255,255,255,0.4); letter-spacing: 0.03em; }
.tb-close-btn {
  margin-left: auto; width: 28px; height: 28px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.65); font-size: 13px; cursor: pointer; flex-shrink: 0;
}
.tb-close-btn:hover { background: rgba(255,255,255,0.09); color: #fff; }

.tb-search-wrap { padding: 14px 16px 8px; }
.tb-search {
  width: 100%; box-sizing: border-box;
  padding: 9px 12px; font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px; color: #FAFAFA;
  font-family: inherit;
}
.tb-search::placeholder { color: rgba(255,255,255,0.35); }
.tb-search:focus { outline: none; border-color: rgba(217, 184, 120, 0.5); background: rgba(255,255,255,0.07); }

.tb-groups { flex: 1 1 auto; overflow-y: auto; padding: 6px 10px 18px; }
.tb-group { margin-top: 10px; }
.tb-group-head {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; background: none; border: none; cursor: pointer;
  color: rgba(255, 255, 255, 0.42);
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase;
  font-family: inherit;
}
.tb-group-head:hover { color: rgba(255, 255, 255, 0.65); }
.tb-group-head-count {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.06); border-radius: 999px;
  padding: 1px 6px;
}
.tb-group-chevron { margin-left: auto; font-size: 10px; transition: transform 0.18s ease; color: rgba(255,255,255,0.35); }
.tb-group.collapsed .tb-group-chevron { transform: rotate(-90deg); }
.tb-group-items {
  display: flex; flex-direction: column; gap: 2px;
  margin-left: 15px; padding-left: 11px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}
.tb-group.collapsed .tb-group-items { display: none; }

.tb-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 9px;
  text-decoration: none; color: rgba(255, 255, 255, 0.78);
  font-size: 12.5px; font-weight: 600;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.14s ease, color 0.14s ease;
}
.tb-item:hover { background: rgba(255, 255, 255, 0.055); color: #fff; }
.tb-item-icon { font-size: 13px; line-height: 1; flex-shrink: 0; opacity: 0.9; }
.tb-item-label { flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tb-item-count {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 10px; font-weight: 700; color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0; white-space: nowrap;
}
.tb-item.active {
  background: linear-gradient(180deg, rgba(217, 184, 120, 0.2) 0%, rgba(217, 184, 120, 0.08) 100%);
  color: #f0dcae;
}
.tb-item.active::before {
  content: ''; position: absolute; left: -12px; top: 3px; bottom: 3px; width: 2px;
  background: #d9b878; border-radius: 2px;
}
.tb-item.warn .tb-item-count { color: #fbbf24; }
.tb-item.miss .tb-item-count { color: #ff8a8a; }
.tb-item.tb-hide { display: none; }
.tb-group.tb-hide { display: none; }
.tb-empty-state {
  padding: 16px 10px; text-align: center; font-size: 12px;
  color: rgba(255,255,255,0.35); display: none;
}
.tb-empty-state.show { display: block; }

body.tb-drawer-open { overflow: hidden; }

@media (max-width: 480px) {
  .tb-launcher-page { max-width: 32vw; }
  .tb-sidebar { width: 88vw; }
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
  function buildGroupHtml(group) {
    const items = group.items.map((item) => {
      const countHtml = item.withCount
        ? `<span class="tb-item-count" id="${item.id}Count">—/—</span>`
        : '';
      return `<a href="${item.href}" class="tb-item" id="${item.id}" data-label="${item.label.toLowerCase()}">
        <span class="tb-item-icon">${item.icon}</span>
        <span class="tb-item-label">${item.label}</span>
        ${countHtml}
      </a>`;
    }).join('');
    return `
    <div class="tb-group" data-group="${group.key}">
      <button type="button" class="tb-group-head" data-group-toggle="${group.key}">
        <span>${group.label}</span>
        <span class="tb-group-head-count">${group.items.length}</span>
        <span class="tb-group-chevron">⌄</span>
      </button>
      <div class="tb-group-items">${items}</div>
    </div>`;
  }

  const html = `
<button type="button" class="tb-launcher" id="tbLauncher" aria-label="Open navigation" aria-expanded="false">
  <span class="tb-launcher-mark">✦<span class="tb-launcher-dot" id="tbLauncherDot"></span></span>
  <span class="tb-launcher-text">
    <span class="tb-launcher-eyebrow">Dashboard</span>
    <span class="tb-launcher-page" id="tbLauncherPage">Menu</span>
  </span>
  <span class="tb-launcher-chevron">▾</span>
</button>
<div class="tb-scrim" id="tbScrim"></div>
<aside class="tb-sidebar" id="tbSidebar" role="navigation" aria-label="Quick navigation">
  <div class="tb-brand">
    <span class="tb-brand-mark">✦</span>
    <span class="tb-brand-text">
      <span class="tb-brand-title">Personal Dashboard</span>
      <span class="tb-brand-subtitle">Quick navigation</span>
    </span>
    <button type="button" class="tb-close-btn" id="tbCloseBtn" aria-label="Close navigation">✕</button>
  </div>
  <div class="tb-search-wrap">
    <input type="text" class="tb-search" id="tbSearchInput" placeholder="Search pages…" autocomplete="off" spellcheck="false">
  </div>
  <nav class="tb-groups" id="tbGroups">
    ${NAV_GROUPS.map(buildGroupHtml).join('')}
    <div class="tb-empty-state" id="tbEmptyState">No pages match “<span id="tbEmptyQuery"></span>”</div>
  </nav>
</aside>
`;

  let tbCollapsedGroups = [];
  function loadCollapsedGroups() {
    try {
      const raw = JSON.parse(localStorage.getItem('topbar:navCollapsed'));
      tbCollapsedGroups = Array.isArray(raw) ? raw : [];
    } catch (e) { tbCollapsedGroups = []; }
  }
  function saveCollapsedGroups() {
    try { localStorage.setItem('topbar:navCollapsed', JSON.stringify(tbCollapsedGroups)); } catch (e) {}
  }

  function injectStyleAndHTML() {
    if (document.getElementById('tbSidebar')) return; // already injected
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    // Insert every top-level node (launcher button, scrim, sidebar) at the
    // very start of body, in document order, same "self-injects" contract
    // as before.
    const nodes = Array.prototype.slice.call(wrap.childNodes);
    nodes.reverse().forEach((node) => document.body.insertBefore(node, document.body.firstChild));

    loadCollapsedGroups();
    applyCollapsedState();
  }

  function applyCollapsedState() {
    document.querySelectorAll('.tb-group').forEach((groupEl) => {
      const key = groupEl.getAttribute('data-group');
      groupEl.classList.toggle('collapsed', tbCollapsedGroups.indexOf(key) !== -1);
    });
  }

  function toggleGroup(key) {
    const idx = tbCollapsedGroups.indexOf(key);
    if (idx === -1) tbCollapsedGroups.push(key); else tbCollapsedGroups.splice(idx, 1);
    saveCollapsedGroups();
    applyCollapsedState();
  }

  // Marks the current page's pill so it's visually distinct from the rest,
  // sets the launcher's "current page" label, and makes sure the current
  // page's own group is never left collapsed on load — so getting back to
  // whatever else is in that same group never costs more than one click.
  function highlightActivePill() {
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'index.html'; // bare root URL resolves to index.html on a static host
    const items = document.querySelectorAll('.tb-item');
    const launcherPage = document.getElementById('tbLauncherPage');
    items.forEach((p) => {
      if (p.getAttribute('href') === path) {
        p.classList.add('active');
        if (launcherPage) launcherPage.textContent = p.querySelector('.tb-item-label').textContent;
        const group = p.closest('.tb-group');
        if (group) {
          const key = group.getAttribute('data-group');
          const idx = tbCollapsedGroups.indexOf(key);
          if (idx !== -1) { tbCollapsedGroups.splice(idx, 1); saveCollapsedGroups(); }
        }
      }
    });
    applyCollapsedState();
  }

  // -------- Drawer open/close --------
  function openDrawer() {
    const sidebar = document.getElementById('tbSidebar');
    const scrim = document.getElementById('tbScrim');
    const launcher = document.getElementById('tbLauncher');
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (scrim) scrim.classList.add('show');
    document.body.classList.add('tb-drawer-open');
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    const search = document.getElementById('tbSearchInput');
    if (search) setTimeout(() => search.focus(), 260);
  }
  function closeDrawer() {
    const sidebar = document.getElementById('tbSidebar');
    const scrim = document.getElementById('tbScrim');
    const launcher = document.getElementById('tbLauncher');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (scrim) scrim.classList.remove('show');
    document.body.classList.remove('tb-drawer-open');
    if (launcher) launcher.setAttribute('aria-expanded', 'false');
  }
  function isDrawerOpen() {
    const sidebar = document.getElementById('tbSidebar');
    return !!(sidebar && sidebar.classList.contains('open'));
  }

  function wireDrawer() {
    const launcher = document.getElementById('tbLauncher');
    const closeBtn = document.getElementById('tbCloseBtn');
    const scrim = document.getElementById('tbScrim');
    if (launcher) launcher.addEventListener('click', () => { isDrawerOpen() ? closeDrawer() : openDrawer(); });
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (scrim) scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isDrawerOpen()) closeDrawer(); });

    document.querySelectorAll('.tb-group-head').forEach((headEl) => {
      headEl.addEventListener('click', () => toggleGroup(headEl.getAttribute('data-group-toggle')));
    });

    const searchInput = document.getElementById('tbSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => applySearchFilter(searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const firstMatch = document.querySelector('.tb-item:not(.tb-hide)');
        if (firstMatch) window.location.href = firstMatch.getAttribute('href');
      });
    }
  }

  function applySearchFilter(rawQuery) {
    const query = (rawQuery || '').trim().toLowerCase();
    const groups = document.querySelectorAll('.tb-group');
    const empty = document.getElementById('tbEmptyState');
    const emptyQuery = document.getElementById('tbEmptyQuery');
    let anyVisible = false;

    if (!query) {
      groups.forEach((g) => { g.classList.remove('tb-hide'); });
      document.querySelectorAll('.tb-item').forEach((it) => it.classList.remove('tb-hide'));
      applyCollapsedState();
      if (empty) empty.classList.remove('show');
      return;
    }

    groups.forEach((groupEl) => {
      let groupHasMatch = false;
      groupEl.querySelectorAll('.tb-item').forEach((item) => {
        const matches = (item.getAttribute('data-label') || '').indexOf(query) !== -1;
        item.classList.toggle('tb-hide', !matches);
        if (matches) { groupHasMatch = true; anyVisible = true; }
      });
      groupEl.classList.toggle('tb-hide', !groupHasMatch);
      if (groupHasMatch) groupEl.classList.remove('collapsed');
    });

    if (empty) empty.classList.toggle('show', !anyVisible);
    if (emptyQuery) emptyQuery.textContent = rawQuery;
  }

  // -------- Live progress badge (today's Goals/habits) --------
  function activeDateKey() {
    const now = new Date();
    const d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function getGoalsProgress() {
    const dateStr = activeDateKey();
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem('goals:' + dateStr)) || []; } catch (e) {}
    let total = Array.isArray(goals) ? goals.length : 0;
    let done = total ? goals.filter(g => g && g.done).length : 0;

    // Also fold in today's scheduled recurring habits (goals:habits +
    // goals:habit-log:<date>), so the badge reflects the full day, not just
    // the freeform checklist.
    try {
      const habits = JSON.parse(localStorage.getItem('goals:habits')) || [];
      if (Array.isArray(habits) && habits.length) {
        const dow = new Date(dateStr + 'T00:00:00').getDay();
        const scheduled = habits.filter(h => Array.isArray(h.weekdays) && h.weekdays.indexOf(dow) !== -1);
        if (scheduled.length) {
          const log = JSON.parse(localStorage.getItem('goals:habit-log:' + dateStr)) || {};
          total += scheduled.length;
          done += scheduled.filter(h => log[h.id]).length;
        }
      }
    } catch (e) {}

    return { done, total };
  }
  function classifyStatus(done, total) {
    if (total === 0) return 'idle';
    if (done >= total) return 'good';
    if (done >= total * 0.5) return 'warn';
    // Past 6pm and still under half → flag as missed
    const h = new Date().getHours();
    if (h >= 18 && done < total * 0.5) return 'miss';
    return 'warn';
  }
  function setPillStatus(pillEl, status) {
    pillEl.classList.remove('good', 'warn', 'miss');
    if (status === 'warn' || status === 'miss') pillEl.classList.add(status);
  }
  function render() {
    const goalsEl = document.getElementById('topbarGoals');
    if (!goalsEl) return; // not injected yet

    const g = getGoalsProgress();
    const countEl = document.getElementById('topbarGoalsCount');
    if (countEl) countEl.textContent = g.total ? g.done + '/' + g.total : '0/0';

    const status = classifyStatus(g.done, g.total);
    setPillStatus(goalsEl, status);

    const dot = document.getElementById('tbLauncherDot');
    if (dot) {
      dot.classList.remove('warn', 'miss');
      if (status === 'warn' || status === 'miss') dot.classList.add(status);
    }
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
    wireDrawer();
    highlightActivePill();
    render();
    lockGestures();
    startModalLock();

    // Re-render Main's badge when localStorage changes from another
    // tab/window OR when the page becomes visible (sync may have pulled
    // in the background).
    window.addEventListener('storage', render);
    window.addEventListener('focus', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

    // Periodic refresh so the count stays current after midnight rollover etc.
    setInterval(render, 30 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
