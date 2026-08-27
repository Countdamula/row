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

  // -------- Ring data --------
  // The PRIMARY navigation: eight nodes on a circle, opened by the
  // launcher pill. Seven of them are the hub pages that survive the
  // 2026-08-21 tidy-up; the eighth, ALL PAGES, reopens the full sidebar
  // drawer built from NAV_GROUPS below rather than navigating anywhere.
  //
  // WHY THE DRAWER STAYED. NAV_GROUPS carries every page's internal tabs
  // — around forty hash routes — plus the search box. Deleting it to make
  // the nav minimal would have made those routes unreachable from the nav
  // entirely. Demoting it one click keeps the common case (get me to a
  // hub) down to two clicks and the rare case (get me to one specific tab
  // of one page) down to three.
  //
  // Ordered clockwise from twelve so the work pages run down the right,
  // ALL PAGES anchors six o'clock, and the life pages run back up the
  // left. Changing the order changes the geometry for free — positions
  // are computed from the index, never hard-coded.
  const RING_R     = 176;   // node centre distance, px
  const CLOSE_STAG = 70;    // ms per index when closing (opening is 20ms, in CSS)

  // lucide geometry, inlined as path data. This file self-injects into
  // eighteen pages and can add no <link> or <script>, so an icon set has
  // to be literal path strings or it cannot exist at all.
  const RING_ICONS = {
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    flask: '<path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7.2 16h9.6"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    feather: '<path d="M12.7 19a2 2 0 0 0 1.4-.6l6.2-6.2a6 6 0 0 0-8.5-8.5L5.6 9.9a2 2 0 0 0-.6 1.4V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/><path d="M3 7.5h4"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
    dumbbell: '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9.5v5"/><path d="M21 9.5v5"/><path d="M6.5 12h11"/>',
    utensils: '<path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2"/><path d="M5.5 2v20"/><path d="M18 2a4 4 0 0 0-3 3.9V13a1 1 0 0 0 1 1h3"/><path d="M19 2v20"/>',
    // The Asclepion's own device: the basin, with the breath
    // rising off it. Deliberately its signature rather than a
    // generic heart or leaf.
    basin: '<ellipse cx="12" cy="14.5" rx="9" ry="4.5"/><path d="M8.4 10.4a4.6 4.6 0 0 1 7.2 0"/><path d="M10.4 6.8a2.6 2.6 0 0 1 3.2 0"/>'
  };

  const RING_ITEMS = [
    { href: 'index.html',        label: 'Main',                 icon: 'target' },
    { href: 'promptarium.html',  label: 'Prompt Studio',        icon: 'flask' },
    { href: 'athenaeum.html',    label: 'The Athenaeum',        icon: 'book' },
    { href: 'kdp.html',          label: 'The Velvet Grimoire',  icon: 'feather' },
    { href: '',                  label: 'All Pages',            icon: 'grid', drawer: true },
    { href: 'vault.html',        label: 'Entertainment Studio', icon: 'film' },
    { href: 'palaestra.html',    label: 'Fitness Studio',       icon: 'dumbbell' },
    { href: 'asclepion.html',    label: 'Self-Care Studio',     icon: 'basin' },
    { href: 'larder.html',       label: 'Nutrition Studio',     icon: 'utensils' }
  ];

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
  // (`<href>#<hash>`), e.g. `larder.html#/grocery`. Leaf pages with no
  // internal tabs at all simply have no `children` and render as a plain,
  // non-expandable row.

  const NAV_GROUPS = [
    {
      // Prompt Studio — promptarium.html + promptarium-data.js +
      // promptarium-backup.js. Pinned to the very top of this sidebar per
      // an explicit request. The FILE is still promptarium.html (bookmarks,
      // phone shortcuts, every href here); only the name shown changed.
      //
      // REBUILT 2026-08-25. It used to file prompts by AI model, with one
      // hash route per model. It now files them by PURPOSE and carries two
      // libraries on one page — Prompts and Tools & Websites — so the whole
      // page is three routes rather than thirteen. The old model-based
      // library was deleted rather than migrated, at Damian's request;
      // promptarium-backup.js snapshotted it first, under the 'prmbak:'
      // prefix, and Settings can put it back.
      //
      // Owns 'prm:*' and its own Supabase row (appKey 'promptarium'). It
      // ALSO mounts a SECOND initCloudSync for appKey 'codex' / prefix
      // 'cdx:', so its fiction prompts read and write the shared fiction
      // database (cdx:prompts + cdx:promptNotes). codex.html was deleted on
      // 2026-08-21 but codex-data.js and this second mount MUST STAY: the
      // same 'cdx:' row also holds cdx:trilogies/chapters/scenes — the
      // manuscripts — and sync.js replaces a row's whole data column, so an
      // unmounted row plus one local write would push a partial set over
      // them. The two prefixes must stay disjoint or the two sync mounts
      // would push each other in a loop.
      //
      // Prompt Studio's own extra field on a fiction prompt (its purpose
      // category) is NOT written into the cdx: record: codex-data.js's
      // promptModel() is a whitelist re-run on every edit and would strip
      // it. It lives in a sidecar, prm:fictionMeta, keyed by prompt id.
      key: 'promptarium',
      label: 'Prompt Studio',
      items: [
        { href: 'promptarium.html', icon: '⚗️', label: 'Prompt Studio', id: 'topbarPromptarium', children: [
          { hash: '/', label: 'Prompts' },
          { hash: '/tools', label: 'Tools & Websites' },
          { hash: '/settings', label: 'Settings & snapshots' },
        ] },
      ],
    },
    {
      // The Athenaeum — athenaeum.html + athenaeum-subject.html +
      // athenaeum-curriculum.html + athenaeum-data.js. Placed directly
      // beneath Promptarium per an explicit request.
      //
      // A learning dashboard built on one structural rule:
      //   FIELD → CURRICULA → MODULES → LESSONS
      // A field is permanent, a curriculum is temporary, and everything
      // worth keeping (concepts, connections, contradictions, research)
      // belongs to the FIELD so it survives the curriculum that taught it.
      //
      // Built as a PARALLEL build alongside learning.html ('learning:'),
      // learning-dashboard.html ('lhub:') and knowledge-hub.html ('kh:').
      // learning.html and knowledge-hub.html were deleted in the 2026-08-21
      // tidy-up; learning-dashboard.html survives on disk but has no nav
      // entry. The Athenaeum shares no data and no code with any of them, so
      // nothing here changed when they went.
      //
      // Owns 'ath:*' and its own Supabase row (appKey 'athenaeum'). Both
      // were unused before this build. It mounts exactly ONE initCloudSync
      // and never reads or writes another page's prefix.
      //
      // Three pages, one namespace: the hub and curriculum pages take a
      // ?id= query param so their hash stays free for in-page tabs. Sub-pages listed here are the main page's
      // own hash routes.
      key: 'athenaeum',
      label: 'The Athenaeum',
      items: [
        { href: 'athenaeum.html', icon: '⌘', label: 'The Athenaeum', id: 'topbarAthenaeum', children: [
          { hash: '/', label: 'The Reading Room' },
          { hash: '/fields', label: 'All Fields' },
          { hash: '/retention', label: 'Retention Center' },
          { hash: '/calendar', label: 'Learning Calendar' },
          { hash: '/experiments', label: 'Experiment Lab' },
          { hash: '/box', label: 'The Box' },
          { hash: '/inbox', label: 'Learning Inbox — every field' },
          { hash: '/knowledge', label: 'Knowledge Base — every field' },
          { hash: '/connections', label: 'Cross-Field Connections' },
        ] },
        // The Resource Library moved out of athenaeum.html's #/resources
        // route onto its own page when it gained editing, filtering and
        // per-resource detail pages. The old hash still works — it
        // redirects here — but the nav points at the real page.
        { href: 'athenaeum-resources.html', icon: '▤', label: 'Resource Library', id: 'topbarAthenaeumLibrary' },
      ],
    },
    {
      // The KDP Dashboard — kdp.html + kdp-foundations.html + kdp-draft.html
      // + kdp-continuity.html + kdp-publish.html, over kdp-data.js /
      // kdp-nav.js / kdp-theme.css. Placed beneath The Athenaeum.
      //
      // A production system for romantasy trilogies on one rule:
      //   WEEK 1 runs ONCE PER TRILOGY. WEEKS 2–5 repeat PER BOOK.
      // Foundations → Draft 1–28 → Draft 29–40 → Continuity → Publish.
      // The Command Center's Continue button resolves to the exact next
      // page through KdpData.nextAction(), so the bar and the button can
      // never disagree about what comes next.
      //
      // A book is always 40 chapters in three acts (10 / 20 / 10), all
      // seeded the moment a trilogy is created. Each chapter carries FOUR
      // indexes — Original, Improvement plan, Rewritten, Final — and only
      // Index IV counts toward the word total.
      //
      // TWO Supabase rows, split by weight, which is the whole reason this
      // is not one prefix: 'kdp:' (appKey 'kdp') holds structure and
      // statuses and stays small; 'kdpms:' (appKey 'kdpms') holds the
      // manuscript, one key per chapter, and is only pushed when prose
      // changes. sync.js uploads an app's ENTIRE prefix on every save, and
      // four drafts across three books is 7–10 MB. 'kdparc:' holds archived
      // trilogies and is deliberately outside BOTH synced prefixes.
      //
      // Genuinely separate from The Codex ('cdx:'), confirmed with the user
      // before any code was written: it never reads or writes that prefix.
      key: 'kdp',
      label: 'KDP Dashboard',
      items: [
        { href: 'kdp.html', icon: '❖', label: 'The Velvet Grimoire', id: 'topbarKdp', children: [
          { hash: '/', label: 'The Velvet Grimoire' },
          { hash: '/shelf', label: 'Trilogies' },
          { hash: '/library/prompts', label: 'Prompt Library' },
          { hash: '/library/templates', label: 'Templates' },
          { hash: '/settings', label: 'Settings & backup' },
        ] },
        { href: 'kdp-foundations.html', icon: '❶', label: 'Week 1 · Foundations', id: 'topbarKdpW1', children: [
          { hash: '/dossier', label: 'Story Dossier' },
          { hash: '/characters', label: 'Characters' },
          { hash: '/world', label: 'Worldbuilding' },
          { hash: '/plan', label: 'Trilogy Planning' },
          { hash: '/style', label: 'Style & Prose Prep' },
        ] },
        { href: 'kdp-draft.html', icon: '❷', label: 'Weeks 2–3 · Drafting', id: 'topbarKdpDraft' },
        { href: 'kdp-continuity.html', icon: '❹', label: 'Week 4 · Continuity', id: 'topbarKdpW4', children: [
          { hash: '/plot', label: 'Plot' },
          { hash: '/character', label: 'Character' },
          { hash: '/world', label: 'World' },
          { hash: '/timeline', label: 'Timeline' },
          { hash: '/romance', label: 'Romance' },
          { hash: '/read', label: 'Full read-through' },
        ] },
        { href: 'kdp-publish.html', icon: '❺', label: 'Week 5 · Publish', id: 'topbarKdpW5' },
      ],
    },
    {
      // Entertainment Studio — vault.html + vault-data.js. Pinned to the
      // top of this sidebar per an explicit request. Renamed from 'The
      // Vault' on 2026-08-21: DISPLAY LABEL ONLY. The filename, the
      // 'vault:*' prefix, the appKey 'vault' and every vt- CSS class are
      // unchanged, so no stored record and no bookmark moved.
      //
      // Built as a PARALLEL build alongside entertainment.html and
      // entertainment-dash.html, copying (not moving) their libraries in.
      // Both of those pages were deleted in the 2026-08-21 tidy-up, so this
      // IS NOW THE ONLY MEDIA LIBRARY IN THE APP. It never read or wrote
      // 'enthub:'/'entdash:'/'entread:'/'media:', so nothing it holds was
      // affected by their deletion.
      //
      // The 'watch' tab reads 'Watching', not 'Entertainment' — inside a
      // folder now called Entertainment Studio that label said nothing.
      // The hash is still 'watch'; only the label changed.
      key: 'vault',
      label: 'Entertainment Studio',
      items: [
        { href: 'vault.html', icon: '✦', label: 'Entertainment Studio', id: 'topbarVault', children: [
          { hash: 'home', label: 'Home' },
          { hash: 'discover', label: 'Discovery Engine' },
          { hash: 'favorites', label: 'Favorites' },
          { hash: 'podcasts', label: 'Podcasts' },
          // Two tabs, not four: Creepypasta + True Stories became one
          // Horror page, and Spicy + Immersive became one. NOTHING MERGED
          // IN STORAGE — all four vault:media:* keys still exist and still
          // hold what they held; only the tab strip changed. The retired
          // hashes still resolve, via vault.html's own TAB_ALIAS.
          { hash: 'horror', label: 'Horror Stories' },
          { hash: 'spicy', label: 'Spicy · Immersive' },
          { hash: 'watch', label: 'Watching' },
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
        // Main was rebuilt on 2026-08-22. The Morning Ritual, Your
        // System, Subconscious Reprogramming and embedded Fitness
        // Studio tabs were removed; Today is the landing page, and
        // Future Self and Weekly Review became their own documents.
        // index.html maps every retired hash to #today, so an old
        // bookmark still lands somewhere.
        //
        // REBUILT AGAIN ON 2026-08-26. Main is a hub now — Quick
        // Launch, Today, Daily Routine, Continue, Explore — and it no
        // longer has internal tabs, so it has no children here. The
        // routine's own editor, the Beliefs database and the record
        // moved to routine.html, which shares its data and its
        // renderers with Main rather than copying them.
        { href: 'index.html', icon: '🎯', label: 'Main', id: 'topbarGoals', withCount: true },
        { href: 'routine.html', icon: '◔', label: 'Daily Routine', id: 'topbarRoutine' },
        { href: 'futureself.html', icon: '🜂', label: 'Future Self' },
        { href: 'weeklyreview.html', icon: '🝮', label: 'Weekly Review' },
      ],
    },
    {
      // Fitness Studio — palaestra.html (hub) + palaestra-workout.html
      // (the live logger) + palaestra-data.js / palaestra-theme.css /
      // palaestra-ui.js / palaestra-hero.js / palaestra-music.js /
      // palaestra-backup.js.
      //
      // Renamed from 'The Palaestra' on 2026-08-21: DISPLAY LABEL ONLY.
      // Every filename, the 'pal:*' prefix, the appKey 'palaestra',
      // window.Pal/PalHero and all 900-odd --pal-*/.pal-* CSS names are
      // unchanged. index.html's OWN embedded fitness tab was dropped from
      // this nav in the same pass so the sidebar has one Fitness Studio
      // and not two — index.html and its 'fitness:' keys are untouched,
      // the tab simply has no link here any more.
      //
      // It owns its own namespace ('pal:*') and its own Supabase row
      // (appKey 'palaestra'), so it never reads or writes a 'fitstudio:'
      // or 'fitness:' key — the one exception is its explicit,
      // button-triggered "Import my programs", which READS those two
      // retired pages' template keys and never writes back.
      //
      // Body measurements, a steps tracker with a year heatmap,
      // training-volume analytics, a weekly scorecard, per-exercise photos
      // and videos, a floating Quick Add, a HIGH/MID/LOW weekly schedule,
      // and a music dock that reads Entertainment Studio's
      // 'vault:media:playlists' — read-only, no second sync subscription.
      key: 'palaestra',
      label: 'Fitness Studio',
      items: [
        { href: 'palaestra.html', icon: '⟠', label: 'Fitness Studio', id: 'topbarPalaestra', children: [
          { hash: '/', label: 'Today' },
          { hash: '/steps', label: 'Steps' },
          { hash: '/body', label: 'Body Progress' },
          { hash: '/calendar', label: 'Weekly Schedule' },
          { hash: '/volume', label: 'Training Volume' },
          { hash: '/templates', label: 'Workouts' },
          { hash: '/exercises', label: 'Exercise Library' },
          { hash: '/settings', label: 'Settings & safety net' },
          { hash: '/history', label: 'History' },
        ] },
        { href: 'palaestra-workout.html', icon: '⏱', label: 'Workout Logger', id: 'topbarPalaestraWorkout' },
      ],
    },
    {
      // The Asclepion — asclepion.html (the hub) + asclepion-session.html
      // (the practice runner) + asclepion-journal.html (the journals),
      // over asclepion-data.js / asclepion-seed.js / asclepion-sync.js /
      // asclepion-ui.js / asclepion-theme.css.
      //
      // Built 2026-08-25 and it REPLACED Main's Self-Care tab. That tab's
      // data was NOT migrated: 'mainselfcare:' is orphaned but intact,
      // still listed in main-sync.js's goals row, and must stay there
      // forever — dropping a prefix deletes its keys on every device at
      // the next push.
      //
      // TWO Supabase rows, split by weight, which is why there are two
      // appKeys here and not one:
      //   asclepion    -> 'asc:'     the library. ~100KB, read-mostly.
      //   asclepionlog -> 'asclog:'  entries, tapping sessions, the live
      //                              routine. Small, written constantly.
      // On one row every journal keystroke batch would re-upload the whole
      // seeded library. Same reasoning as kdpms: out of kdp:.
      //
      // Seven categories — breath, journals, tapping, meditation,
      // movement, energy, affirmations — plus favourites swept across all
      // of them, four routines, and a daily affirmation. The appKey
      // 'selfcare' is deliberately NOT reused: it is the orphaned row from
      // the long-deleted selfcare.html, and a first push would overwrite
      // it.
      key: 'asclepion',
      label: 'Self-Care Studio',
      items: [
        { href: 'asclepion.html', icon: '◡', label: 'Self-Care Studio', id: 'topbarAsclepion', children: [
          { hash: '/', label: 'Home' },
          { hash: '/breath', label: 'Breath & Regulation' },
          { hash: '/journal', label: 'Journals' },
          { hash: '/eft', label: 'EFT Tapping' },
          { hash: '/meditation', label: 'Meditation & Hypnosis' },
          { hash: '/yoga', label: 'Yoga & Movement' },
          { hash: '/energy', label: 'Energy Practices' },
          { hash: '/affirmations', label: 'Affirmations' },
          { hash: '/routines', label: 'Routines' },
          { hash: '/kept', label: 'Kept — favourites' },
        ] },
        { href: 'asclepion-journal.html', icon: '☾', label: 'Journals', id: 'topbarAsclepionJournal' },
        { href: 'asclepion-session.html', icon: '◦', label: 'Practice', id: 'topbarAsclepionSession' },
      ],
    },
    {
      key: 'life',
      label: 'Life & Wellness',
      items: [
        { href: 'larder.html', icon: '🍽️', label: 'Nutrition Studio', id: 'topbarLarder', children: [
          { hash: '/', label: 'Today' },
          { hash: '/meals', label: 'Meals' },
          { hash: '/foods', label: 'Foods' },
          { hash: '/recipes', label: 'Recipes' },
          { hash: '/plan', label: 'Meal Plan' },
          { hash: '/grocery', label: 'Grocery List' },
          { hash: '/progress', label: 'Progress' },
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

/* === Phone: the drawer has to be usable with a thumb ===
   This nav is on all twenty pages, so everything below is fixed once here
   rather than twenty times.

   Two measured problems, both of which made every page in the dashboard
   report the same failures:

   1) .tb-search was 13px. Anything under 16px makes iOS Safari zoom the
      whole page in the moment the field is focused — and it does not zoom
      back out afterwards, so one tap on Search leaves every page in the
      dashboard oversized until you pinch it back by hand.

   2) The chevron that opens a page's sub-pages was 24x24, its close button
      28x28, and each sub-page link 26px tall. Apple's own floor is 44pt and
      the usual practical floor is around 40px; a 24px target sitting next to
      other 24px targets is the specific arrangement that produces a
      mis-tap. Heights are raised rather than font sizes, so nothing about
      the drawer's typography or density on a desktop changes. */
@media (max-width: 768px) {
  .tb-search { font-size: 16px; padding-top: 11px; padding-bottom: 11px; }
  .tb-node-toggle { width: 34px; height: 34px; flex: 0 0 34px; }
  .tb-close-btn { width: 38px; height: 38px; font-size: 15px; }
  .tb-group-head { min-height: 40px; }
  .tb-item { min-height: 40px; }
  /* Padding rather than flex + min-height: .tb-subitem relies on
     display:block for its text-overflow ellipsis, and flex would drop it. */
  .tb-subitem { padding-top: 11px; padding-bottom: 11px; }
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


/* =============================================================
   THE CIRCLE MENU
   -------------------------------------------------------------
   The primary navigation. The launcher pill opens this instead of
   the sidebar drawer; the drawer is still here, one click deeper,
   behind the ring's ALL PAGES node.

   Built to a reference photo of a black sci-fi console bar: a
   chamfered near-black shell, a hot rim-light on its top and bottom
   edges that is brightest mid-span and gone by the ends, hairline
   outline icons, and uppercase letter-spaced monospace micro-labels.

   The photo's accent is ember orange. This uses THIS APP'S OWN GOLD
   instead (#d9b878 / #f0dcae — already the launcher's and the
   sidebar's accent), so the DO NOT MODIFY rule 2 "no new hard-coded
   colors" constraint needs no exception: only the rim-light
   TREATMENT is new, and it is built out of tokens this file already
   used. Every accent value reads --nav-accent*, so a page can retint
   the whole ring in one declaration — kdp-velvet.css already does
   exactly that to .tb-launcher-mark under html.vg-on.
   ============================================================= */
:root {
  --nav-accent: #d9b878;
  --nav-accent-hi: #f0dcae;
  --nav-accent-rgb: 217, 184, 120;
  --nav-ink: #FAFAFA;
  --nav-dim: rgba(255, 255, 255, 0.6);
  --nav-faint: rgba(255, 255, 255, 0.3);
  --nav-hair: rgba(255, 255, 255, 0.09);
  --nav-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* The stage is nested INSIDE #tbScrim on purpose: kdp-velvet.css
   already hides .tb-scrim in distraction-free compose mode, so the
   ring inherits that with no edit to that file. */
.tb-scrim.tb-ring-on {
  z-index: 2650; background: rgba(0, 0, 0, 0.84);
  backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
}
.tb-ring-stage {
  position: absolute; inset: 0;
  display: none; place-items: center;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.tb-scrim.tb-ring-on .tb-ring-stage { display: grid; }

/* ---- console frame ---- */
/* The reference photo is a chamfered black console whose TOP AND
   BOTTOM EDGES carry the hot rim-light, hottest at the centre of the
   span and gone by the ends. That glow belongs to the frame, not to
   the ring: giving it to both made two lights compete and neither
   read. So the frame glows and the circle inside it stays quiet. */
.tb-ring-frame { position: relative; width: 680px; height: 545px; display: grid; place-items: center; }
.tb-ring-shell {
  position: absolute; inset: 0; width: 100%; height: 100%;
  overflow: visible; pointer-events: none;
}
.tb-ring-shell polygon {
  fill: rgba(5, 5, 6, 0.95);
  stroke: rgba(255, 255, 255, 0.08); stroke-width: 1;
}
/* the bright chamfer cuts, drawn on the polygon's own corner
   coordinates so they lie exactly along the bevel instead of being
   four CSS bars rotated into roughly the right place */
.tb-ring-shell line { stroke: var(--nav-accent-hi); stroke-width: 1.5; opacity: 0.9; }

/* The photo's rim-light: a tight hot hairline on the top and bottom
   edges, brightest at the centre of the span, with a shallow bloom.
   Kept narrow on purpose — a wide soft smear reads as haze, not as a
   lit edge. */
.tb-ring-edge {
  position: absolute; left: 15%; right: 15%; height: 1px; pointer-events: none;
  background: linear-gradient(90deg,
    rgba(var(--nav-accent-rgb), 0) 0%,
    rgba(var(--nav-accent-rgb), 0.85) 22%,
    var(--nav-accent-hi) 50%,
    rgba(var(--nav-accent-rgb), 0.85) 78%,
    rgba(var(--nav-accent-rgb), 0) 100%);
  box-shadow: 0 0 8px rgba(var(--nav-accent-rgb), 0.85), 0 0 20px rgba(var(--nav-accent-rgb), 0.4);
}
.tb-ring-edge.top { top: 0; }
.tb-ring-edge.bottom { bottom: 0; }
.tb-ring-edge::after {
  content: ""; position: absolute; left: 5%; right: 5%; top: -3px; height: 7px;
  background: inherit; filter: blur(5px); opacity: 0.95;
}

/* ---- brand block, the photo's left-hand name plate ---- */
.tb-ring-plate { position: absolute; top: 4px; left: 46px; pointer-events: none; }
.tb-ring-plate-name {
  font-family: var(--nav-mono); font-size: 11px; font-weight: 600;
  letter-spacing: 0.28em; text-transform: uppercase; color: var(--nav-ink);
}
.tb-ring-plate-role {
  margin-top: 5px; font-family: var(--nav-mono); font-size: 9px; line-height: 1.6;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--nav-faint);
}
.tb-ring-plate-rule { margin-top: 9px; width: 26px; height: 1px; background: rgba(var(--nav-accent-rgb), 0.5); }

/* ---- the ring ---- */
.tb-ring { position: relative; width: 0; height: 0; }

/* The guide circle is deliberately quiet — a hairline that tells the
   eye the eight nodes belong to one orbit, and nothing more. The
   light in this design lives on the frame's edges. */
.tb-ring-hair {
  position: absolute; left: 50%; top: 50%;
  width: 352px; height: 352px; margin: -176px 0 0 -176px;
  border-radius: 50%; border: 1px dashed rgba(255, 255, 255, 0.05);
  pointer-events: none;
}
/* the photo's tick dots between nav cells, here between nodes */
.tb-ring-tick {
  position: absolute; left: 50%; top: 50%;
  width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%;
  background: rgba(var(--nav-accent-rgb), 0.75);
  transform: translate(var(--tx), var(--ty));
  opacity: 0; transition: opacity 0.3s linear 0.25s; pointer-events: none;
}
.tb-ring-stage.open .tb-ring-tick { opacity: 1; }

/* ---- nodes ---- */
/* A node is a zero-size anchor point; the disc and the label hang off
   it, so a label can sit outside the ring without changing what gets
   translated. */
/* The node is a REAL 52px box centred on its orbit point, not a zero-size
   anchor with the disc hanging off it. A 0x0 link still receives mouse
   clicks through its absolutely-positioned children, which is why the
   first build looked fine — but it has no clickable point of its own, so
   assistive tech and any automation that targets the element rather than
   a pixel cannot reach it. The label is the only thing that hangs off
   the box now, and it is not the hit target. */
.tb-ring-node {
  position: absolute; left: 50%; top: 50%;
  width: 52px; height: 52px; margin: -26px 0 0 -26px;
  text-decoration: none; opacity: 0; transform: translate(0, 0);
  transition: transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s linear;
  transition-delay: calc(var(--i) * 20ms);
  -webkit-tap-highlight-color: transparent;
}
.tb-ring-stage.open .tb-ring-node { transform: translate(var(--tx), var(--ty)); opacity: 1; }
.tb-ring-stage.closing .tb-ring-node { transition-delay: calc(var(--i) * 70ms); }
/* screenshot / deep-link path: land already open, with no entrance */
.tb-ring-stage.instant .tb-ring-node,
.tb-ring-stage.instant .tb-ring-tick { transition: none !important; }

.tb-ring-disc {
  position: absolute; inset: 0; border-radius: 50%;
  display: grid; place-items: center;
  background: linear-gradient(160deg, #1b1b1f 0%, #0d0d10 100%);
  border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 10px 24px rgba(0, 0, 0, 0.55);
  transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1),
              border-color 0.14s ease, color 0.14s ease, box-shadow 0.2s ease;
}
.tb-ring-disc svg { width: 21px; height: 21px; display: block; }

.tb-ring-label {
  position: absolute;
  font-family: var(--nav-mono); font-size: 10px; font-weight: 500;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.68); line-height: 1.5;
  transition: color 0.14s ease, text-shadow 0.2s ease;
}
/* offsets are from the 52px node box: 16px clear above/below, 8px clear
   to either side */
.tb-ring-node[data-side="top"]    .tb-ring-label { left: 50%; margin-left: -80px; width: 160px; text-align: center; bottom: calc(100% + 16px); }
.tb-ring-node[data-side="bottom"] .tb-ring-label { left: 50%; margin-left: -80px; width: 160px; text-align: center; top: calc(100% + 16px); }
.tb-ring-node[data-side="right"]  .tb-ring-label { left: calc(100% + 8px);  width: 96px; text-align: left;  top: 50%; transform: translateY(-50%); }
.tb-ring-node[data-side="left"]   .tb-ring-label { right: calc(100% + 8px); width: 96px; text-align: right; top: 50%; transform: translateY(-50%); }

/* hover / focus — grey to gold, the photo's active-cell treatment */
.tb-ring-node:hover .tb-ring-disc,
.tb-ring-node:focus-visible .tb-ring-disc {
  transform: scale(1.1);
  border-color: rgba(var(--nav-accent-rgb), 0.6);
  color: var(--nav-accent-hi);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07),
              0 0 22px rgba(var(--nav-accent-rgb), 0.28),
              0 10px 24px rgba(0, 0, 0, 0.55);
}
.tb-ring-node:hover .tb-ring-label,
.tb-ring-node:focus-visible .tb-ring-label { color: var(--nav-accent-hi); }
.tb-ring-node:focus { outline: none; }
.tb-ring-node:focus-visible .tb-ring-disc { outline: 2px solid var(--nav-accent-hi); outline-offset: 3px; }
.tb-ring-node:active .tb-ring-disc { transform: scale(0.95); }

/* current page */
.tb-ring-node.active .tb-ring-disc {
  border-color: rgba(var(--nav-accent-rgb), 0.85);
  color: var(--nav-accent-hi);
  background: linear-gradient(160deg, rgba(var(--nav-accent-rgb), 0.16) 0%, #0a0a0b 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07),
              0 0 26px rgba(var(--nav-accent-rgb), 0.34),
              0 10px 24px rgba(0, 0, 0, 0.55);
}
.tb-ring-node.active .tb-ring-label {
  color: var(--nav-accent-hi); text-shadow: 0 0 14px rgba(var(--nav-accent-rgb), 0.45);
}

/* ALL PAGES is a door, not a destination — it stays quieter */
.tb-ring-node.drawer .tb-ring-disc { border-style: dashed; border-color: rgba(255, 255, 255, 0.14); }
.tb-ring-node.drawer .tb-ring-label { color: var(--nav-faint); }
.tb-ring-node.drawer:hover .tb-ring-disc { border-style: solid; }

/* ---- centre trigger ---- */
.tb-ring-trigger {
  position: absolute; left: 50%; top: 50%;
  width: 52px; height: 52px; margin: -26px 0 0 -26px;
  border-radius: 50%; border: none; cursor: pointer; padding: 0;
  display: grid; place-items: center;
  background: linear-gradient(155deg, var(--nav-accent) 0%, var(--nav-accent-hi) 100%);
  color: #23180a;
  box-shadow: 0 0 0 5px rgba(10, 10, 11, 0.9), 0 0 14px rgba(var(--nav-accent-rgb), 0.22), 0 12px 30px rgba(0, 0, 0, 0.6);
  transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.14s ease;
  -webkit-tap-highlight-color: transparent;
}
.tb-ring-trigger:hover { filter: brightness(1.12); transform: scale(1.06); }
.tb-ring-trigger:focus-visible { outline: 2px solid var(--nav-accent-hi); outline-offset: 4px; }
.tb-ring-trigger:active { transform: scale(0.94); }
.tb-ring-trigger svg { width: 19px; height: 19px; display: block; }

/* ---- phone: the ring becomes the console bar it came from ---- */
@media (max-width: 780px), (max-height: 620px) {
  .tb-ring-frame { width: min(340px, 92vw); height: auto; padding: 66px 0 22px; }
  .tb-ring-plate { left: 2px; top: 10px; }
  .tb-ring-shell, .tb-ring-edge, .tb-ring-hair, .tb-ring-tick { display: none; }
  .tb-scrim.tb-ring-on { background: rgba(0, 0, 0, 0.93); }
  .tb-ring-node.drawer .tb-ring-disc { border-width: 0; }
  .tb-ring { width: 100%; height: auto; display: flex; flex-direction: column; gap: 6px; }
  .tb-ring-node {
    position: relative; left: auto; top: auto; margin: 0; width: 100%; height: 56px;
    display: flex; align-items: center; gap: 14px; padding: 0 14px;
    border-radius: 12px;
    background: linear-gradient(160deg, #131315 0%, #0a0a0b 100%);
    border: 1px solid var(--nav-hair);
    transform: none !important; opacity: 1;
    transition: border-color 0.14s ease;
  }
  .tb-ring-disc {
    position: relative; inset: auto; width: 34px; height: 34px;
    flex: 0 0 34px; background: none; border: 0 none; box-shadow: none;
  }
  .tb-ring-node[data-side] .tb-ring-label {
    position: relative; left: auto; right: auto; top: auto; bottom: auto;
    width: auto; margin-left: 0; text-align: left; transform: none;
  }
  .tb-ring-node:hover .tb-ring-disc, .tb-ring-node:focus-visible .tb-ring-disc { transform: none; }
  .tb-ring-node.active { border-color: rgba(var(--nav-accent-rgb), 0.7); }
  .tb-ring-node.active .tb-ring-disc { background: none; box-shadow: none; }
  .tb-ring-trigger { position: relative; left: auto; top: auto; margin: 18px auto 0; }
}

/* ---- reduced motion: it arrives, it does not perform ---- */
@media (prefers-reduced-motion: reduce) {
  .tb-ring-node {
    transition: opacity 0.14s linear; transition-delay: 0ms !important;
    transform: translate(var(--tx), var(--ty));
  }
  .tb-ring-stage.open .tb-ring-node { transform: translate(var(--tx), var(--ty)); }
  .tb-ring-tick { transition-delay: 0ms; }
  .tb-ring-disc, .tb-ring-trigger { transition: border-color 0.14s ease, color 0.14s ease; }
  .tb-ring-node:hover .tb-ring-disc, .tb-ring-trigger:hover { transform: none; }
}
`;

  // -------- HTML: the ring --------
  //
  // ALL PAGES ANCHORS SIX O'CLOCK. That only happens on its own
  // when some index lands exactly at n/2, which needs an EVEN n —
  // and the ring went to nine when the Self-Care Studio was added.
  //
  // The fix is half a step of phase. With an odd n, rotating the
  // whole ring by 0.5/n puts index (n-1)/2 exactly at the bottom
  // and leaves four nodes down each side, still symmetric about
  // the vertical axis. Nothing sits at twelve any more, which is
  // the trade: a node at the bottom is load-bearing (it is the
  // drawer, and it is where the thumb is), a node at the top is
  // not.
  function ringPhase(n) { return n % 2 ? 0.5 : 0; }

  function pointOnCircle(i, n, r) {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      x: Math.round(r * Math.cos(theta) * 10) / 10,
      y: Math.round(r * Math.sin(theta) * 10) / 10
    };
  }

  // Which way a label hangs off its node. Twelve and six get a centred
  // label above/below; everything else gets one on the outward side, so
  // no two labels can ever occupy the same horizontal band. This is the
  // whole reason all the labels can stay visible at once — the source
  // component only ever showed one, on hover.
  //
  // Computed from the node's real angular position (index plus phase)
  // rather than from the index, or an odd-n ring would put the bottom
  // node's label out to one side while the node itself sat at six.
  function ringSideFor(i, n) {
    const f = ((i + ringPhase(n)) / n) % 1;   // 0 = twelve, .5 = six
    if (Math.abs(f) < 1e-6) return 'top';
    if (Math.abs(f - 0.5) < 1e-6) return 'bottom';
    return f < 0.5 ? 'right' : 'left';
  }

  function ringIconSvg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + RING_ICONS[name] + '</svg>';
  }

  function buildRingHtml() {
    const n = RING_ITEMS.length;
    const ph = ringPhase(n);
    const nodes = RING_ITEMS.map((item, i) => {
      const p = pointOnCircle(i + ph, n, RING_R);
      return '<a class="tb-ring-node' + (item.drawer ? ' drawer' : '') + '"' +
             ' href="' + (item.href || '#') + '"' +
             (item.drawer ? ' data-ring-drawer="1"' : '') +
             ' data-side="' + ringSideFor(i, n) + '"' +
             ' style="--tx:' + p.x + 'px; --ty:' + p.y + 'px; --i:' + i + ';">' +
               '<span class="tb-ring-disc">' + ringIconSvg(item.icon) + '</span>' +
               '<span class="tb-ring-label">' + item.label + '</span>' +
             '</a>';
    }).join('');

    // Tick dots sit halfway between each pair of nodes, on the orbit —
    // the reference photo's separators between nav cells.
    let ticks = '';
    for (let t = 0; t < n; t++) {
      // Halfway between node t and node t+1, so the phase applies
      // here too or the separators drift off the gaps.
      const tp = pointOnCircle(t + 0.5 + ph, n, RING_R);
      ticks += '<i class="tb-ring-tick" style="--tx:' + tp.x + 'px; --ty:' + tp.y + 'px;"></i>';
    }

    return '' +
    '<div class="tb-ring-stage" id="tbRingStage" role="dialog" aria-modal="true" aria-label="Main navigation">' +
      '<div class="tb-ring-frame">' +
        // The console shell: one chamfered octagon, 18px cut at each
        // corner, drawn as a polygon so the bevel is a real edge rather
        // than four brackets floating near the corners.
        '<svg class="tb-ring-shell" viewBox="0 0 680 545" preserveAspectRatio="none" aria-hidden="true">' +
          '<polygon vector-effect="non-scaling-stroke" points="18,0 662,0 680,18 680,527 662,545 18,545 0,527 0,18"/>' +
          '<line vector-effect="non-scaling-stroke" x1="18" y1="0" x2="0" y2="18"/>' +
          '<line vector-effect="non-scaling-stroke" x1="662" y1="0" x2="680" y2="18"/>' +
          '<line vector-effect="non-scaling-stroke" x1="680" y1="527" x2="662" y2="545"/>' +
          '<line vector-effect="non-scaling-stroke" x1="18" y1="545" x2="0" y2="527"/>' +
        '</svg>' +
        '<i class="tb-ring-edge top"></i><i class="tb-ring-edge bottom"></i>' +
        '<div class="tb-ring-plate">' +
          '<div class="tb-ring-plate-name">Damian</div>' +
          '<div class="tb-ring-plate-role">Personal dashboard</div>' +
          '<div class="tb-ring-plate-rule"></div>' +
        '</div>' +
        '<div class="tb-ring" id="tbRing">' +
          '<i class="tb-ring-hair"></i>' +
          ticks + nodes +
        '</div>' +
        '<button type="button" class="tb-ring-trigger" id="tbRingTrigger" aria-label="Close navigation">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

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
<div class="tb-scrim" id="tbScrim">${buildRingHtml()}</div>
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
  // A DETAIL page has no nav entry of its own — it is only ever reached
  // from its parent page, so it highlights the parent's entry instead of
  // leaving the whole sidebar looking inactive.

  const NAV_DETAIL_PARENTS = {
    'athenaeum-subject.html': 'athenaeum.html',
    'athenaeum-curriculum.html': 'athenaeum.html',
    // Singular: one resource. The plural athenaeum-resources.html is a real
    // nav item of its own and must NOT be aliased here, or it would
    // highlight The Athenaeum instead of itself.
    'athenaeum-resource.html': 'athenaeum-resources.html'
    // The Asclepion's two sub-documents are NOT aliased here: both are
    // real nav items of their own, so aliasing them would highlight the
    // hub while you were standing in the journal.
  };

  function highlightActivePill() {
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'index.html'; // bare root URL resolves to index.html on a static host
    if (NAV_DETAIL_PARENTS[path]) path = NAV_DETAIL_PARENTS[path];
    const search = window.location.search || '';
    // Pages are identified by filename alone. The filename+query branch
    // below is kept for the case of two nav entries pointing at one file
    // with different query strings — the Learning folder's per-topic items
    // were that case until they were deleted. No current href carries a
    // query, so every match today is on the filename.
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

    // The ring reuses the SAME resolved `path` — including the detail-page
    // aliasing above — rather than repeating that logic, so a detail page
    // lights its parent hub on the ring exactly as it does in the drawer.
    // ALL PAGES has no href and can never match.
    document.querySelectorAll('.tb-ring-node').forEach((node) => {
      const href = node.getAttribute('href') || '';
      node.classList.toggle('active', href !== '#' && href === path);
    });

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

  // -------- Ring open/close --------
  // The ring shares the drawer's scrim (it is nested inside it), so the
  // two can never both be showing and the scrim only has to be managed
  // in one place.
  let ringBusy = false;

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function isRingOpen() {
    const scrim = document.getElementById('tbScrim');
    return !!(scrim && scrim.classList.contains('tb-ring-on'));
  }

  function openRing(instant) {
    const scrim = document.getElementById('tbScrim');
    const stage = document.getElementById('tbRingStage');
    if (!scrim || !stage || ringBusy) return;
    scrim.classList.add('show', 'tb-ring-on');
    document.body.classList.add('tb-drawer-open');
    stage.classList.remove('closing');
    if (instant) { stage.classList.add('instant', 'open'); return; }
    stage.classList.remove('instant');
    // Two frames: the browser needs to have laid the nodes out at the
    // centre before the .open transform lands, or there is no start value
    // to animate from and they simply appear in place.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { stage.classList.add('open'); });
    });
    const trigger = document.getElementById('tbRingTrigger');
    if (trigger) trigger.focus();
  }

  // Ports the supplied React component's close sequence without React:
  // the nodes retract on a slower stagger (CSS, via .closing) while the
  // trigger shakes and pulses out through a scale ladder and the whole
  // ring counter-rotates behind a 1px blur (Web Animations API, so the
  // timing stays exact). Under reduced motion none of it runs.
  function closeRing() {
    const scrim = document.getElementById('tbScrim');
    const stage = document.getElementById('tbRingStage');
    const ring = document.getElementById('tbRing');
    const trigger = document.getElementById('tbRingTrigger');
    if (!scrim || !stage || ringBusy) return;

    function finish() {
      ringBusy = false;
      scrim.classList.remove('show', 'tb-ring-on');
      stage.classList.remove('closing', 'open', 'instant');
      document.body.classList.remove('tb-drawer-open');
      const launcher = document.getElementById('tbLauncher');
      if (launcher) launcher.focus();
    }

    ringBusy = true;
    stage.classList.add('closing');
    stage.classList.remove('open');

    if (reduceMotion() || !stage.animate) { setTimeout(finish, 160); return; }

    const n = RING_ITEMS.length;
    const total = CLOSE_STAG * (n + 2);

    if (trigger) {
      trigger.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(2px)' },
         { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
        { duration: CLOSE_STAG, iterations: Math.round(total / CLOSE_STAG), easing: 'linear' }
      );
      const frames = [];
      for (let s = 0; s < n; s++) {
        frames.push({
          scale: String(Math.min(1 + s * 0.15, 1.5)),
          opacity: String(Math.max(1 - s * 0.11, 0.42))
        });
      }
      frames.push({ scale: '1', opacity: '1' });
      trigger.animate(frames, { duration: total, easing: 'linear' }).onfinish = finish;
    }

    if (ring) {
      ring.animate(
        [{ transform: 'rotate(0deg)', filter: 'blur(0px)' },
         { transform: 'rotate(-360deg)', filter: 'blur(1px)' }],
        { duration: total, easing: 'linear' }
      );
    }

    if (!trigger) setTimeout(finish, total);
  }

  // ALL PAGES hands off to the drawer. The scrim stays up through the
  // swap so the page underneath never flashes back into view.
  function ringToDrawer() {
    const stage = document.getElementById('tbRingStage');
    const scrim = document.getElementById('tbScrim');
    if (stage) stage.classList.remove('open', 'instant');
    if (scrim) scrim.classList.remove('tb-ring-on');
    openDrawer();
  }

  function wireRing() {
    const trigger = document.getElementById('tbRingTrigger');
    if (trigger) trigger.addEventListener('click', closeRing);

    const drawerNode = document.querySelector('[data-ring-drawer]');
    if (drawerNode) drawerNode.addEventListener('click', (e) => {
      e.preventDefault();
      // MUST stop here. This click bubbles to the scrim, and by the time
      // the scrim's handler runs, ringToDrawer() has already cleared
      // tb-ring-on — so that handler would read "ring not open" and take
      // its closeDrawer() branch, shutting the drawer in the same tick it
      // was opened. Letting it bubble left the page with no menu at all.
      e.stopPropagation();
      ringToDrawer();
    });

    // The ring claims aria-modal, so it has to actually hold focus.
    const stage = document.getElementById('tbRingStage');
    if (stage) stage.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = stage.querySelectorAll('a[href], button');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function wireDrawer() {
    const launcher = document.getElementById('tbLauncher');
    const closeBtn = document.getElementById('tbCloseBtn');
    const scrim = document.getElementById('tbScrim');
    // The launcher is the ring's trigger now. The drawer is reached from
    // the ring's ALL PAGES node, never from here.
    if (launcher) launcher.addEventListener('click', () => { isRingOpen() ? closeRing() : openRing(false); });
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    // One scrim, two layers on it: whichever is showing is what a click
    // on the bare scrim dismisses. The ring's own nodes sit above it, so
    // the target check keeps a click on a node from closing the menu.
    if (scrim) scrim.addEventListener('click', (e) => {
      if (isRingOpen()) { if (e.target === scrim) closeRing(); return; }
      closeDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (isRingOpen()) { closeRing(); return; }
      if (isDrawerOpen()) closeDrawer();
    });

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
      '.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam', '.project-page-bg', '.goal-page-bg', '.wfd-page-bg', '.lh-article-page-bg', '.bd-page-bg', '.bd-modal-bg', '.bd-comp-bg', '.fs-focus-bg', '.gt-modal-bg', '.kh-page-bg', '.wd-page-bg', '.cx-modal-bg', '.cx-comp-bg', '.pm-modal-bg', '.pm-capture-bg', '.ath-modal-bg', '.ath-capture-bg',
      // Main's own layer-2 surface (index.html / futureself.html /
      // weeklyreview.html). Note '.fs-focus-bg' above is an older,
      // unrelated page's class and does not cover it.
      '.mn-sheetbg',
      // The Asclepion's sheet, on all three of its documents.
      '.asc-sheetbg',
      // The Larder's sheet.
      '.lar-sheetbg'
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

  // ============================================================
  // THE CONTINUE RECORDER
  //
  // Main's CONTINUE section answers "what was I actually working on".
  // The recorder lives HERE because topbar.js is already loaded by
  // every page in the dashboard, so one file covers all of them; it
  // exports nothing, like the rest of this file.
  //
  // WHAT COUNTS AS WORK. Opening a page and leaving again is not a
  // session. A visit is recorded only once something under that app's
  // OWN storage prefix has changed while the page was open, measured
  // by a cheap fingerprint — the number of matching keys plus the
  // summed length of their names and values. That is not a hash and
  // does not pretend to be: it catches the edits that matter (a set
  // added, a meal logged, a chapter typed into) and it costs one pass
  // over the key list, twice.
  //
  // WHY A TIMER AND NOT pagehide. Writes issued at unload are not
  // durable here. localStorage is IndexedDB underneath and commits
  // asynchronously, so a write started as the document goes away is
  // routinely lost — the same trap local-store-idb.js exists to
  // manage. Promoting on a 20-second visible-only tick means the
  // entry is committed long before you leave. The pagehide check is a
  // bonus, not the mechanism.
  //
  // `recent:log` IS LOCAL-ONLY. It matches no synced prefix and
  // main-sync.js's MUST_STAY_LOCAL asserts that at every mount. It has
  // to be: this file writes it on twenty pages that never mount the
  // goals row, and a page writing a key that belongs to a row it has
  // not pulled is exactly how a sync reconciliation eats data.
  // ============================================================
  const RECENT_KEY = 'recent:log';
  const RECENT_MAX = 12;
  const RECENT_TICK = 20 * 1000;

  // Each page and the prefix that means "something happened here".
  // A page missing from this table is simply never recorded, which is
  // the right default for a stub or a redirect.
  const TRACK_PREFIX = {
    'routine.html': 'today:',
    'futureself.html': 'fs:',
    'weeklyreview.html': 'wr:',
    'palaestra.html': 'pal:',
    'palaestra-workout.html': 'pal:',
    'asclepion.html': 'asc',            // asc: and asclog: both
    'asclepion-session.html': 'asc',
    'asclepion-journal.html': 'asc',
    'larder.html': 'lar',               // lar: and larlog: both
    'vault.html': 'vault:',
    'promptarium.html': 'prm:',
    'athenaeum.html': 'ath:',
    'athenaeum-subject.html': 'ath:',
    'athenaeum-curriculum.html': 'ath:',
    'athenaeum-resources.html': 'ath:',
    'athenaeum-resource.html': 'ath:',
    'kdp.html': 'kdp',
    'kdp-foundations.html': 'kdp',
    'kdp-draft.html': 'kdp',
    'kdp-continuity.html': 'kdp',
    'kdp-publish.html': 'kdp',
    'businessos.html': 'bos:',
  };

  let recentVisit = null;
  let recentBaseline = 0;
  let recentTimer = 0;
  let recentDone = false;

  function currentFile() {
    const p = location.pathname.split('/').pop();
    return (p || 'index.html').toLowerCase();
  }

  /** Count + summed key and value lengths for one prefix. */
  function fingerprint(prefix) {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf(prefix) !== 0) continue;
        const v = localStorage.getItem(k);
        n += k.length + (v ? v.length : 0) + 1;
      }
    } catch (e) { return -1; }
    return n;
  }

  function readRecent() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  /** Promote this visit. Idempotent — it runs at most once per page. */
  function promoteRecent() {
    if (recentDone || !recentVisit) return;
    recentDone = true;
    stopRecentTimer();

    const entry = {
      href: recentVisit.href,
      hash: String(location.hash || '').replace(/^#/, ''),
      title: recentVisit.title,
      at: Date.now(),
    };
    // One row per page. A newer visit replaces the older one rather
    // than filling the list with the same page five times.
    const list = readRecent().filter((r) => r && r.href !== entry.href);
    list.unshift(entry);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (e) { /* quota or a private window — the list is a nicety */ }
  }

  function checkRecent() {
    if (recentDone || !recentVisit) return;
    const now = fingerprint(recentVisit.prefix);
    if (now < 0 || now === recentBaseline) return;
    promoteRecent();
  }

  function stopRecentTimer() {
    if (recentTimer) { clearInterval(recentTimer); recentTimer = 0; }
  }

  function startRecorder() {
    const file = currentFile();
    const prefix = TRACK_PREFIX[file];
    if (!prefix) return;                       // Main itself, and every stub

    // The page's own name, from the drawer, so CONTINUE reads the way
    // the rest of the dashboard does rather than showing a filename.
    let title = file;
    NAV_GROUPS.forEach((g) => g.items.forEach((it) => {
      if (it.href && it.href.toLowerCase() === file) title = it.label;
    }));

    recentVisit = { href: file, prefix, title };
    recentBaseline = fingerprint(prefix);
    if (recentBaseline < 0) return;            // no readable store; nothing to compare

    recentTimer = setInterval(() => {
      if (!document.hidden) checkRecent();
    }, RECENT_TICK);

    // Best effort on the way out, and a real one on the way to the
    // background — a phone backgrounding a tab is the common case, and
    // that one still has time to commit.
    document.addEventListener('visibilitychange', () => { if (document.hidden) checkRecent(); });
    window.addEventListener('pagehide', checkRecent);
  }

  // -------- Boot --------
  function boot() {
    injectStyleAndHTML();
    wireDrawer();
    wireRing();
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

    // Main's CONTINUE list. Reads this page's own prefix and writes at
    // most one row, and only if something changed. See its header.
    try { startRecorder(); } catch (e) { /* never break the nav over a nicety */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
