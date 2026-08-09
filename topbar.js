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
  // Every real page in the dashboard, grouped the way a real sidebar app
  // groups its sections (see the reference screenshot this redesign was
  // built to match) instead of one long flat row, so every page is
  // reachable in at most two clicks from anywhere: open the nav (1) +
  // click a page (2), or, since a page's own group auto-expands on load
  // and every other group starts expanded too, usually just one click.
  // (Old Fitness Studio/gym.html, Self-Care/selfcare.html, Finance/
  // finance.html, Brain Dump/braindump.html, Household/household.html,
  // the old "Business" nav folder — business.html/business-writing.html/
  // business-youtube.html/business-overview.html — and the Example/
  // example.html folder were all deleted; see CLAUDE.md's changelog.)
  //
  // Notion-style nesting: any item may carry a `children` array — each
  // child is one of that page's own internal tabs/sections, rendered as an
  // indented, independently-collapsible sub-list under its parent, exactly
  // like a Notion sidebar shows a page's sub-pages. A child's `hash` is the
  // literal URL fragment that page reads on load to land on that tab
  // (`<href>#<hash>`), e.g. `nutrition.html#grocery`. Leaf pages with no
  // internal tabs at all simply have no `children` and render as a plain,
  // non-expandable row.
  //
  // Learning is the one nav group whose items are DATA-DRIVEN rather than
  // a fixed list: unlike Entertainment's four content pages (a fixed set
  // of types), a Topic is a dynamic, user-created record — there's no way
  // to know how many there are or what they're called ahead of time.
  // buildLearningTopicItems() reads `learning:topics` straight out of
  // localStorage (the same "read another page's own storage key
  // directly" precedent index.html's former Connected Apps tiles and
  // tasks-data.js's own importers already used) and turns each one into
  // its own nav item — `learning-topic.html?id=<topicId>`, matching that
  // page's own query-param addressing (see its header comment: the hash
  // is reserved for this item's own Questions/Resources deep-links, so
  // the topic id itself couldn't live there once a topic also needed two
  // sub-page anchors). This runs once, when this script itself first
  // executes — same as every other page's nav content, which is also
  // built once at load — not live-updated if a topic is added/renamed/
  // deleted in another open tab; reopening the drawer after a reload
  // picks up the change.
  function buildLearningTopicItems() {
    const items = [
      { href: 'learning.html', icon: '📚', label: 'Learning Hub', id: 'topbarLearning', children: [
        { hash: 'topics', label: 'Topics' },
        { hash: 'resources', label: 'Resources' },
      ] },
    ];
    let topics = [];
    try {
      const raw = JSON.parse(localStorage.getItem('learning:topics'));
      if (Array.isArray(raw)) topics = raw;
    } catch (e) {}
    topics
      .filter((t) => t && t.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((t, i) => {
        items.push({
          href: 'learning-topic.html?id=' + encodeURIComponent(t.id),
          icon: (typeof t.icon === 'string' && t.icon) || '📚',
          label: (typeof t.title === 'string' && t.title) || 'Untitled Topic',
          id: 'topbarLearningTopic' + i,
          children: [
            { hash: 'questions', label: 'Questions Database' },
            { hash: 'notes', label: 'Notes Database' },
            { hash: 'subjects', label: 'Subjects Database' },
            { hash: 'resources', label: 'Resources Database' },
          ],
        });
      });
    return items;
  }

  const NAV_GROUPS = [
    {
      // The Vault — vault.html + vault-data.js. Pinned to the top of this
      // sidebar per an explicit request.
      //
      // A PARALLEL build, not a replacement. entertainment-dash.html and the
      // whole Entertainment folder below are untouched and still listed;
      // nothing was removed from either. The Vault owns its own namespace
      // ('vault:*') and its own Supabase row (appKey 'vault'), so it never
      // reads or writes 'enthub:'/'entdash:'/'entread:'/'media:' keys — the
      // two dashboards cannot affect each other's data.
      //
      // Its Podcasts shelf was populated by copying (not moving) the podcast
      // library out of entertainment-dash.html#podcasts.
      key: 'vault',
      label: 'The Vault',
      items: [
        { href: 'vault.html', icon: '✦', label: 'The Vault', id: 'topbarVault', children: [
          { hash: 'home', label: 'Home' },
          { hash: 'discover', label: 'Discovery Engine' },
          { hash: 'favorites', label: 'Favorites' },
          { hash: 'podcasts', label: 'Podcasts' },
          { hash: 'creepypasta', label: 'Horror Stories · Creepypastas' },
          { hash: 'trueHorror', label: 'Horror Stories · True Stories' },
          { hash: 'spicy', label: 'Spicy Stories' },
          { hash: 'immersive', label: 'Immersive Experience' },
          { hash: 'watch', label: 'Entertainment' },
          { hash: 'playlists', label: 'Music & Playlists' },
          { hash: 'reading', label: 'Reading Corner' },
          { hash: 'anime', label: 'Anime' },
          { hash: 'games', label: 'Games' },
          { hash: 'stats', label: 'Statistics' },
        ] },
      ],
    },
    {
      key: 'command',
      label: 'Command Center',
      items: [
        { href: 'index.html', icon: '🎯', label: 'Main', id: 'topbarGoals', withCount: true, children: [
          { hash: 'ritual', label: 'Morning Ritual' },
          { hash: 'system', label: 'Your System' },
          { hash: 'subconscious', label: 'Subconscious Reprogramming' },
          { hash: 'fitness', label: 'Fitness Studio' },
          { hash: 'selfcare', label: 'Self-Care' },
        ] },
        { href: 'mainpillar.html', icon: '🎮', label: 'Main Pillar', id: 'topbarMainPillar', children: [
          { hash: 'today', label: 'Today' },
          { hash: 'weekly', label: 'Weekly' },
          { hash: 'monthly', label: 'Monthly' },
          { hash: 'year', label: 'Year' },
          { hash: 'goals', label: 'Goals' },
          { hash: 'favorites', label: 'Favorites' },
        ] },
        { href: 'tasks.html', icon: '🗂️', label: 'Tasks', id: 'topbarTasksDb', children: [
          { hash: 'today', label: 'Today' },
          { hash: 'all', label: 'All Tasks' },
        ] },
        { href: 'tasksnotes.html', icon: '✅', label: 'Tasks & Notes', id: 'topbarTasksNotes', children: [
          { hash: 'links', label: 'Links' },
          { hash: 'notes', label: 'Notes' },
          { hash: 'tasks', label: 'Tasks' },
        ] },
      ],
    },
    {
      // New nav folder, right above Entertainment: a Business Dashboard —
      // a gallery of businesses, each opening into its own front page
      // hosting a Writing Dashboard (series/manuscripts/a Scrivener-style
      // Binder), a generatable YouTube Dashboard, and a generatable
      // Blogging Dashboard. Genuinely new files, businessdash.html +
      // businessdash-data.js — separate from every other "business" page
      // in this app (business.html's Content Hub + Writing/YouTube
      // Dashboard tabs, and businessos.html's own multi-business CEO
      // command center); nothing there is read or written by this page.
      key: 'businessdash',
      label: 'Business Dashboard',
      items: [
        { href: 'businessdash.html', icon: '🏢', label: 'Business Dashboard', id: 'topbarBusinessDash' },
      ],
    },
    {
      // New nav folder, right between Business Dashboard and
      // Entertainment: Fitness Studio — a genuinely new, standalone
      // top-level page (fitnessstudio.html + fitnessstudio-data.js),
      // separate from every other fitness surface already in this app
      // (gym.html's own "Fitness Studio" / STUDIO pill down in "Life &
      // Wellness", and index.html's own embedded Fitness Studio tab).
      // Its music slide-out panel reads enthub:playlists directly — see
      // that page's own header comment — so it's genuinely connected to
      // the Playlists page below, without opening a second sync
      // subscription for a collection it never writes to.
      key: 'fitnessstudiotab',
      label: 'Fitness Studio',
      items: [
        { href: 'fitnessstudio.html', icon: '💪', label: 'Fitness Studio', id: 'topbarFitnessStudioTab' },
      ],
    },
    {
      // New nav folder, right below Fitness Studio and above Entertainment
      // (per an explicit placement request): a Business folder hosting the
      // Ultimate Writing Dashboard — a full Writing Operating System
      // (writing-dashboard.html + writing-dashboard-data.js). Its own
      // `wds:` prefix, own `key: 'writingdash'` Supabase row — genuinely
      // separate from every other "business"/"writing" surface already in
      // this app (business.html's old Writing Dashboard tab, businessdash
      // .html's own Series & Manuscripts Binder) — nothing here reads or
      // writes their data. This page has no hash-routable tabs (its own
      // Series Library / Series Dashboard / Writing Workspace navigation
      // is a JS page-stack, not URL hashes), so it has no `children` here
      // — same as the equally tab-heavy 'fitnessstudiotab'/'businessdash'
      // single-item groups above, for the same reason.
      key: 'business',
      label: 'Business',
      items: [
        { href: 'writing-dashboard.html', icon: '🖋️', label: 'Writing Dashboard', id: 'topbarWritingDash' },
      ],
    },
    {
      // New nav folder, right below Command Center: entertainment-dash
      // .html — one merged dashboard replacing what used to be five
      // separate standalone pages (ent-podcasts.html/ent-stories.html/
      // ent-entertainment.html/ent-playlists.html/ent-favorites.html,
      // all deleted) plus the short-lived Media/mediaverse.html hub
      // (deleted outright). Still genuinely separate from
      // entertainment.html/"Media" down in "Create & Grow" below —
      // nothing here reads or writes that page's own `media:*` data.
      // Data layer is still entertainment-hub-data.js for the 8
      // pre-existing categories (Podcasts/Stories-now-split/
      // Entertainment/Playlists — kept, not deleted, since
      // fitnessstudio.html's own music panel still reads
      // `enthub:playlists` from it) plus a new entertainment-dash-data
      // .js for the 3 brand-new categories (Reading Corner/Anime/Games)
      // and the cross-category Discovery Engine/Favorites/Statistics
      // logic — see both files' own header comments.
      key: 'entertainment',
      label: 'Entertainment',
      items: [
        { href: 'entertainment-dash.html', icon: '🎬', label: 'Entertainment', id: 'topbarEntDash', children: [
          { hash: 'home', label: 'Home' },
          { hash: 'discovery', label: 'Discovery Engine' },
          { hash: 'favorites', label: 'Favorites' },
          { hash: 'podcasts', label: 'Podcasts' },
          { hash: 'horror-creepypasta', label: 'Horror Stories · Creepypastas' },
          { hash: 'horror-true-stories', label: 'Horror Stories · True Stories' },
          { hash: 'spicy-watch', label: 'Spicy Stories · YouTube' },
          { hash: 'stories-immersive', label: 'Immersive Experience' },
          { hash: 'entertainment', label: 'Entertainment' },
          { hash: 'playlists', label: 'Playlists' },
          { hash: 'reading-corner', label: 'Reading Corner' },
          { hash: 'anime', label: 'Anime' },
          { hash: 'games', label: 'Games' },
          { hash: 'statistics', label: 'Statistics' },
        ] },
      ],
    },
    {
      // New nav folder, right below Entertainment (per an explicit
      // placement request): Knowledge Hub v2 — a full replace of the
      // prior five-stage-funnel/Progressive-Summarization page. It's now
      // a Learning & Knowledge Operating System: 11 fixed department
      // workspaces (Psychology/Wealth/AI/Metaphysics/Spiritual/Self-Dev/
      // Photography/History/Astrology/Writing/Health), each with a
      // Resource Library, an 8-stage Reading Pipeline, three layered
      // levels of mind maps, a computed Knowledge Graph, a Permanent
      // Notes (concept) library, Open Questions, Research, Projects,
      // cross-department Connections, a Progress dashboard, and a
      // 17-action AI Assistant — plus one Global Knowledge Graph across
      // every department. See knowledge-hub-data.js's own header comment
      // for the full architecture rundown. Every child link below is a
      // real knowledge-hub.html#<id> deep link, read once on load by
      // that page's own boot() to open straight to that department (or
      // the Global Graph) — same one-way deep-link convention this app's
      // other nested nav children already use.
      key: 'knowledgehub',
      label: 'Knowledge Hub',
      items: [
        { href: 'knowledge-hub.html', icon: '🧠', label: 'Knowledge Hub', id: 'topbarKnowledgeHub', children: [
          { hash: 'psychology', label: '🧠 Human Psychology & Neuroscience' },
          { hash: 'wealth', label: '💰 Wealth & Entrepreneurship' },
          { hash: 'ai', label: '🤖 Artificial Intelligence' },
          { hash: 'metaphysics', label: '⚛️ Metaphysics & Quantum Physics' },
          { hash: 'spiritual', label: '🔮 Spiritual Practices & Esotericism' },
          { hash: 'selfdev', label: '🌱 Self-Development' },
          { hash: 'photography', label: '📸 Photography & Videography' },
          { hash: 'history', label: '🏛 History' },
          { hash: 'astrology', label: '✨ Astrology & Numerology' },
          { hash: 'writing', label: '✍️ Persuasive Communication & Writing' },
          { hash: 'health', label: '🌿 Holistic Health & Alternative Healing' },
          { hash: 'global', label: '🌐 Global Knowledge Graph' },
        ] },
      ],
    },
    {
      // New nav folder, right below Entertainment: Learning Hub's own
      // topics/resources/questions system. learning.html (the Topics +
      // Resources gallery) is the entry point; every real Topic gets its
      // own nav entry right below it too, each expandable into its own
      // Questions Database / Resources Database — see
      // buildLearningTopicItems() above for how these are generated.
      key: 'learningfolder',
      label: 'Learning',
      items: buildLearningTopicItems(),
    },
    {
      key: 'life',
      label: 'Life & Wellness',
      items: [
        { href: 'nutrition.html', icon: '🍽️', label: 'Nutrition', id: 'topbarNutrition', children: [
          { hash: 'kitchen', label: 'My Kitchen' },
          { hash: 'grocery', label: 'Grocery List' },
        ] },
      ],
    },
    {
      key: 'create',
      label: 'Create & Grow',
      items: [
        { href: 'dreamboard.html', icon: '✨', label: 'Dream Board', id: 'topbarDreamBoard', children: [
          { hash: 'vision-board', label: 'Vision Board' },
          { hash: 'reflections', label: 'Reflections' },
          { hash: 'quarterly-goals', label: 'Quarterly Goals' },
          { hash: 'monthly-breakdown', label: 'Monthly Breakdown' },
        ] },
        { href: 'aitech.html', icon: '🤖', label: 'AI & Tech', id: 'topbarAiTech', children: [
          { hash: 'models', label: 'AI Models' },
          { hash: 'prompts', label: 'Prompts' },
        ] },
        { href: 'entertainment.html', icon: '🎬', label: 'Media', id: 'topbarEntertainment', children: [
          { hash: 'podcasts', label: 'Podcasts' },
          { hash: 'stories', label: 'Stories' },
          { hash: 'entertainment', label: 'Entertainment' },
          { hash: 'playlists', label: 'Playlists' },
          { hash: 'favorites', label: 'Favorites' },
        ] },
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
.tb-group.tb-hide { display: none; }

/* Notion-style nested sub-pages: a .tb-node wraps every top-level page's
   row plus (when it has any) an expand toggle and an indented sub-list of
   that page's own internal tabs/sections. */
.tb-node { display: flex; flex-direction: column; }
.tb-item-row { display: flex; align-items: center; }
.tb-item-row .tb-item { flex: 1 1 auto; }
.tb-node-toggle {
  width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0; margin-right: 2px;
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: rgba(255, 255, 255, 0.35);
  -webkit-tap-highlight-color: transparent;
}
.tb-node-toggle:hover { background: rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.75); }
.tb-node-chevron { font-size: 11px; display: inline-block; transition: transform 0.16s ease; }
.tb-node.tb-expanded .tb-node-chevron { transform: rotate(90deg); }
.tb-subitems {
  display: none; flex-direction: column; gap: 1px;
  margin: 1px 0 4px 27px; padding-left: 11px;
  border-left: 1px solid rgba(255, 255, 255, 0.07);
}
.tb-node.tb-expanded .tb-subitems { display: flex; }
.tb-subitem {
  display: block; padding: 6px 9px; border-radius: 7px;
  text-decoration: none; color: rgba(255, 255, 255, 0.55);
  font-size: 11.5px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.14s ease, color 0.14s ease;
}
.tb-subitem:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
.tb-subitem.active { background: rgba(217, 184, 120, 0.16); color: #f0dcae; }
.tb-subitem.tb-hide { display: none; }
.tb-node.tb-hide { display: none; }
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
  function buildItemHtml(item) {
    const countHtml = item.withCount
      ? `<span class="tb-item-count" id="${item.id}Count">—/—</span>`
      : '';
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const toggleHtml = hasChildren
      ? `<button type="button" class="tb-node-toggle" data-node-toggle="${item.href}" aria-label="Expand ${item.label} sub-pages"><span class="tb-node-chevron">›</span></button>`
      : '';
    const childrenHtml = hasChildren
      ? `<div class="tb-subitems">` + item.children.map((c) =>
          `<a href="${item.href}#${c.hash}" class="tb-subitem" data-label="${c.label.toLowerCase()}">${c.label}</a>`
        ).join('') + `</div>`
      : '';
    return `
    <div class="tb-node${hasChildren ? ' tb-has-children' : ''}" data-node="${item.href}">
      <div class="tb-item-row">
        <a href="${item.href}" class="tb-item" id="${item.id}" data-label="${item.label.toLowerCase()}">
          <span class="tb-item-icon">${item.icon}</span>
          <span class="tb-item-label">${item.label}</span>
          ${countHtml}
        </a>
        ${toggleHtml}
      </div>
      ${childrenHtml}
    </div>`;
  }

  function buildGroupHtml(group) {
    const items = group.items.map(buildItemHtml).join('');
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

  // Sub-page nodes are the opposite default of groups: a node's children
  // start COLLAPSED (an href, not a key, identifies it) — same as a fresh
  // Notion sidebar, where you only see the sub-pages of whatever you've
  // actually opened before. `highlightActivePill()` force-expands whichever
  // node contains the current page (and, if a hash is present, whichever
  // one contains the current hash) so the active context is never hidden.
  let tbExpandedNodes = [];
  function loadExpandedNodes() {
    try {
      const raw = JSON.parse(localStorage.getItem('topbar:navExpanded'));
      tbExpandedNodes = Array.isArray(raw) ? raw : [];
    } catch (e) { tbExpandedNodes = []; }
  }
  function saveExpandedNodes() {
    try { localStorage.setItem('topbar:navExpanded', JSON.stringify(tbExpandedNodes)); } catch (e) {}
  }
  function applyExpandedState() {
    document.querySelectorAll('.tb-node.tb-has-children').forEach((nodeEl) => {
      const key = nodeEl.getAttribute('data-node');
      nodeEl.classList.toggle('tb-expanded', tbExpandedNodes.indexOf(key) !== -1);
    });
  }
  function toggleNode(key) {
    const idx = tbExpandedNodes.indexOf(key);
    if (idx === -1) tbExpandedNodes.push(key); else tbExpandedNodes.splice(idx, 1);
    saveExpandedNodes();
    applyExpandedState();
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
    loadExpandedNodes();
    applyCollapsedState();
    applyExpandedState();
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

  // Marks the current page's pill (and, if a hash matches one of its
  // sub-pages, that sub-item too) so both are visually distinct from the
  // rest, sets the launcher's "current page" label, and makes sure the
  // current page's own group AND its own sub-page node are never left
  // collapsed on load — so getting back to whatever else is in that same
  // group/node never costs more than one click. Also re-run on every
  // in-page hashchange (a page switching its own internal tab without a
  // full reload) so the drawer's active sub-item stays in sync live.
  function highlightActivePill() {
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'index.html'; // bare root URL resolves to index.html on a static host
    const search = window.location.search || '';
    // Most pages are identified by filename alone; the Learning folder's
    // per-topic items are the one case with more than one nav entry
    // pointing at the same file (learning-topic.html?id=<topicId>), so
    // an item/node whose own href carries a query string is matched
    // against filename+query instead of the filename alone — everything
    // else keeps matching exactly as before.
    const pathWithQuery = path + search;
    const hash = (window.location.hash || '').replace(/^#/, '');

    document.querySelectorAll('.tb-item.active').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.tb-subitem.active').forEach((el) => el.classList.remove('active'));

    const items = document.querySelectorAll('.tb-item');
    const launcherPage = document.getElementById('tbLauncherPage');
    items.forEach((p) => {
      const href = p.getAttribute('href') || '';
      const isMatch = href.indexOf('?') !== -1 ? href === pathWithQuery : href === path;
      if (isMatch) {
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

    let currentNode = document.querySelector('.tb-node[data-node="' + pathWithQuery.replace(/"/g, '') + '"]');
    if (!currentNode) currentNode = document.querySelector('.tb-node[data-node="' + path.replace(/"/g, '') + '"]');
    if (currentNode && currentNode.classList.contains('tb-has-children')) {
      const key = currentNode.getAttribute('data-node');
      if (tbExpandedNodes.indexOf(key) === -1) { tbExpandedNodes.push(key); saveExpandedNodes(); }
      if (hash) {
        const targetHref = key + '#' + hash;
        currentNode.querySelectorAll('.tb-subitem').forEach((sub) => {
          if (sub.getAttribute('href') === targetHref) sub.classList.add('active');
        });
      }
    }

    applyCollapsedState();
    applyExpandedState();
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

    document.querySelectorAll('.tb-node-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleNode(btn.getAttribute('data-node-toggle'));
      });
    });

    const searchInput = document.getElementById('tbSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => applySearchFilter(searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const query = (searchInput.value || '').trim().toLowerCase();
        const firstNode = document.querySelector('.tb-node:not(.tb-hide)');
        if (!firstNode) return;
        const itemLink = firstNode.querySelector('.tb-item-row .tb-item');
        const parentMatches = itemLink && (itemLink.getAttribute('data-label') || '').indexOf(query) !== -1;
        if (parentMatches) { window.location.href = itemLink.getAttribute('href'); return; }
        const firstSub = firstNode.querySelector('.tb-subitem:not(.tb-hide)');
        if (firstSub) { window.location.href = firstSub.getAttribute('href'); return; }
        if (itemLink) window.location.href = itemLink.getAttribute('href');
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
      document.querySelectorAll('.tb-node').forEach((n) => n.classList.remove('tb-hide'));
      document.querySelectorAll('.tb-subitem').forEach((s) => s.classList.remove('tb-hide'));
      applyCollapsedState();
      applyExpandedState();
      if (empty) empty.classList.remove('show');
      return;
    }

    groups.forEach((groupEl) => {
      let groupHasMatch = false;
      groupEl.querySelectorAll('.tb-node').forEach((nodeEl) => {
        const itemLink = nodeEl.querySelector('.tb-item-row .tb-item');
        const parentMatches = !!(itemLink && (itemLink.getAttribute('data-label') || '').indexOf(query) !== -1);
        let anyChildMatches = false;
        nodeEl.querySelectorAll('.tb-subitems .tb-subitem').forEach((sub) => {
          const subMatches = (sub.getAttribute('data-label') || '').indexOf(query) !== -1;
          sub.classList.toggle('tb-hide', !subMatches);
          if (subMatches) anyChildMatches = true;
        });
        const nodeMatches = parentMatches || anyChildMatches;
        nodeEl.classList.toggle('tb-hide', !nodeMatches);
        if (nodeMatches) { groupHasMatch = true; anyVisible = true; }
        // Only auto-expand on a *child* match — a parent-only match keeps
        // the node exactly as collapsed/expanded as the user left it.
        if (anyChildMatches) nodeEl.classList.add('tb-expanded');
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
      '.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam', '.project-page-bg', '.goal-page-bg', '.wfd-page-bg', '.lh-article-page-bg', '.bd-page-bg', '.bd-modal-bg', '.bd-comp-bg', '.fs-focus-bg', '.gt-modal-bg', '.kh-page-bg', '.wd-page-bg'
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

    // Keep the drawer's active sub-item in sync as the current page
    // switches its own internal tab (which changes location.hash without
    // a full reload).
    window.addEventListener('hashchange', highlightActivePill);

    // Periodic refresh so the count stays current after midnight rollover etc.
    setInterval(render, 30 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
