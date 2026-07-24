# Personal Dashboard — Codebase Map

This file documents what actually exists in this repository, as of the audit
below. It was written by mapping the code directly (no assumptions carried
over from any prior spec). Where the real codebase differs from what a typical
web-app CLAUDE.md would describe, that's called out explicitly rather than
papered over.

## 1. Framework, language, routing

**There is no framework.** This is a set of standalone static HTML files —
plain HTML + CSS + vanilla JavaScript (ES6, no JSX, no TypeScript). There is
no build step, no bundler, no package.json, no node_modules, no compiler.
"Deploying" means Vercel serving the repo's static files as-is (zero-config
static hosting — there's no `vercel.json` either).

**Routing** is just files: each top-level page is its own `.html` file, and
"navigation" is `<a href="other-page.html">` links plus the shared top nav bar
(see below). There is no client-side router, no route table, no dynamic
segments, no server-side rendering.

Pages open by opening the file directly in a browser (`file://` or via
Vercel's static server) — see README.md.

**Files, one per page:**
| File | Page |
|---|---|
| `home.html` | Home — the dashboard's hub, and the topbar's leading pill. One continuous, scrollable page (not a hidden-tab-panel switcher — see changelog), with an editable cover photo, a native Weekly Schedule (per-task Mon–Sun checkboxes that reset each week, a progress bar, notes, filterable by day), a native Subconscious Reprogramming section (a daily ritual checklist, an Affirmations gallery with a practice-streak counter, and freeform Notes & Scripts), then Dream Board / Self-Care / Tasks & Notes / AI & Tech / Main / Main Pillar / Household / Brain Dump embedded inline, unmodified, in lazy-loaded, auto-resizing same-origin iframes — every one of those eight still exists as its own full standalone page too, "keeping the original tabs just in case" (rebuilt — see changelog) |
| `index.html` | Main — Goals command center: today summary, recurring habits + streaks, freeform daily checklist, monthly/yearly goals with an allocation engine, and a daily journal note. This is the site's root/default document (see §1's "Routing" note) |
| `gym.html` | Fitness Studio — rebuilt around Self-Care's tab architecture: Overview (a freeform Dream-Board-style widget board, default landing tab), Current Week (7 day-chip mini-tabs of Anxiety-style exercise cards — photo/video, sets & reps, notes, log-a-set), Templates (a Meditations-style searchable/filterable routine gallery), Equipment (a Journals-style stacked list), and Workout History & Compare Sessions — see changelog |
| `finance.html` | Finance — personal finance dashboard: accounts/net worth, transactions, budgets, trends, recurring bills, notes (rebuilt — see changelog) |
| `entertainment.html` | Media — unified tracker: Podcasts / Stories / Entertainment / Playlists / Favorites galleries, each now a "mini page" with its own Dream-Board-style hero cover section (rebuilt, then re-themed to match Dream Board — see changelog) |
| `braindump.html` | Brain Dump — freeform daily Thoughts/Emotions journal (see changelog) |
| `household.html` | Household — Energy Beings roster (legions/sigils/activation phrases/charging log), Inventory (restock thresholds), Wishlist (priority/price), Chores (recurring, due dates), Overview (see changelog) |
| `selfcare.html` | Self-Care — rebuilt around Dream Board's exact engine/aesthetic: a main "Self-Care" tab is a freeform drag-and-drop widget board (a self-care checklist, notes, a photo gallery, etc.), plus Journals (topic-filtered), Meditations (linkable library), and Anxiety (Breathwork — a CRUD library of paced-breathing techniques played through an animated pacer — plus Tips & Techniques, moved in from the deleted standalone `anxiety.html`) as their own dedicated, Dream-Board-restyled tabs. Water and Bucket List were removed entirely (rebuilt — see changelog) |
| `example.html` | Example — a standalone "System HUD" visual style demo tab, built to match a reference photo; explicitly not wired to real data or cloud sync (new — see changelog) |
| `dreamboard.html` | Dream Board — a drag-and-drop vision-board page: editable tabs (Vision Board / Reflections / Quarterly Goals / Monthly Breakdown), each with its own full-bleed cinematic "hero" cover section, and a 3-column board of reorderable, numbered widgets (checklists, lists, notes, quotes, affirmations, a steps tracker, a photo/video grid, a calendar, feature cards, info cards), an Add Widget menu, and a reset-to-default action (new — see changelog) |
| `business.html` | Business Hub — a content-planning workspace, visually identical to Dream Board (dark cinematic near-black/gold, frosted-glass cards, a per-tab hero, horizontal pill tabs). Four tabs only (Content/Ideas/Platforms/Resources — Strategy/Analytics/Audit were removed). Ideas and Resources are `layout: 'freeform'` — Dream Board's exact 3-column drag-and-drop widget board (Add Widget/Reset, per-widget color-grading tint, sixteen widget types including a Link card); Resources additionally has a Templates section below a divider under its board — a Workflow system (Weeks → Days → Checklist). Content is `layout: 'content'` — a fixed, sectioned dashboard with the Platform database, Content Plan database, and Useful Resources database each kept genuinely separate (own grid, own filter chips, own drag-reorder group), plus a sidebar (Summary/Posting Schedule/Gallery). Platforms is `layout: 'platforms'` — the same Platform database component standalone. Every platform card opens its own "page" (a detail modal) with freeform notes sections generated on demand via a button, fully editable and reorderable. Also home to the Writing Dashboard and YouTube Dashboard (see changelog) |
| `aitech.html` | AI & Tech — same dark cinematic near-black/gold, frosted-glass-card aesthetic as Business Hub/Dream Board, one page (no tabs), one editable hero. Two genuinely separate "databases", never merged: a Notion-like gallery of AI Models (cover/icon, category, status, star rating, description, URL, tags, category + status filter chips, search, drag-reorder) and a Prompts database tied to a model via a nullable `modelId` (filterable by model, favorites toggle, search, copy-to-clipboard, drag-reorder). Deleting a model nulls out the reference on its prompts rather than deleting them (new — see changelog) |
| `nutrition.html` | Nutrition — two pages, My Kitchen (a drag-reorderable recipe gallery/database with ingredients+steps+photos) and Grocery List (store-grouped, drag-reorderable items), each with its own fully editable Dream-Board-style hero and its own freeform "More Widgets" drag-and-drop board (Add Widget/Reset) layered on top — rebuilt around Dream Board's exact engine/aesthetic (see changelog) |
| `learning.html` | Learning & Knowledge Hub — same dark cinematic near-black/gold, frosted-glass-card aesthetic as Business Hub/Dream Board/AI & Tech, one page (no tabs), one editable hero. Two genuinely separate "databases", never merged: a large Notion-like gallery of Topics (cover/icon, description, tags, search, drag-reorder) and a Resources database tied to a topic via a nullable `topicId`, structured into five type sections — Articles / Books / YouTube Videos (with transcripts, copy-to-clipboard) / Social Media Posts / Additional Notes — each independently filterable by topic/type, searchable, and drag-reorderable. Deleting a topic nulls out the reference on its resources rather than deleting them (new — see changelog) |
| `tasksnotes.html` | Tasks & Notes — moved out of Business Hub, where it used to be a 5th tab (new standalone top-level page — see changelog). Same dark cinematic near-black/gold, frosted-glass-card aesthetic as Business Hub/Dream Board, one page (no tabs), one editable hero. Three genuinely separate "databases", never merged: Links (a small drag-reorderable card grid of URL + description cards), Notes (a full searchable/taggable list, distinct from a single freeform note), and Tasks (the same status/priority/recurrence/Today-view system as every other task list in this app, scoped to this page only) |
| `mainpillar.html` | Main Pillar — a gamified (Solo Leveling-styled "System HUD") daily command center. `mainpillar.html` + `mainpillar-data.js`, its own top-level page/nav pill, its own `mainpillar:*` data — deliberately separate from `index.html`'s own Goals/habits/allocation engine, not a replacement for it (see changelog) |
| `system.html` | Build Your System — a goal-narrowing/habit-installation framework page: Top 10 Goals (up to 3 flaggable as your active selection — see changelog), Your System (daily/weekly repeatable Actions each with a Minimum Viable Action and a live Mon–Sun completion tracker), Three Core Systems (Written = a read-only recap of Goals/Daily/Weekly habits plus an editable Repeatable Processes database, Visual = the live action tracker plus an editable Visual Tools database, Mental = a category-filterable Mental System Entries database), and Identity Shifting (Identity Anchors, a single evolving guided Future Self Vision record, and Install-Through-Action Challenges — each of these three also has its own editable Reflection Prompts + copy-ready AI Prompts database). Every one of the 8 tabs/subpages also has its own "+ Generate Notes Section" freeform notes database at the top. Re-themed to match Main's (`index.html`) near-black/warm-gold frosted-glass-card aesthetic, with a matching editable cover-photo hero (upload/change/remove, page-wide blurred backdrop) — see changelog. `system.html` + `system-data.js`, its own top-level page/nav pill, its own `system:*` data (new — see changelog) |

Stack (`health.html`) and Water (`po-water.html`) were removed — see the
changelog note at the bottom of this file. Projects (`projects.html`) and
Study (`study.html`) were also removed — see the changelog note near the
bottom of this file. **Main (`index.html`), Main Pillar (`mainpillar.html`
+ `mainpillar-data.js`), Household (`household.html` +
`household-data.js`), and Brain Dump (`braindump.html`) were briefly
deleted, then restored in a follow-up correction** — "delete" turned out
to mean "fold into Home while keeping the originals," the same treatment
Dream Board/Self-Care/Tasks & Notes/AI & Tech got the first time. All
four are live pages again, both standalone (with their own nav pill) and
embedded inside Home — see the changelog entry near the bottom of this
file, which also covers a real near-miss: `mainpillar.html`/
`mainpillar-data.js` had never been committed to git, so deleting them
came within one `git gc` of being unrecoverable.
All four filenames now exist only as tiny redirect-to-`home.html` stubs
(no data/functionality/nav pill of their own) — added in a follow-up fix
after old bookmarks/home-screen shortcuts to them (and to the bare site
root, which `index.html` used to serve) started 404ing; see that
changelog entry.

**Shared, non-page files:**
- `topbar.js` — injects the shared top nav bar (pills) into every page that
  includes `<script src="topbar.js" defer></script>`. Not a framework
  component; it's a self-invoking function that builds a `<style>` and
  `<header>` string and appends them to `document.head`/`document.body` on
  `DOMContentLoaded`.
- `sync.js` — shared cloud-sync helper (see §4). Exposes one global,
  `window.initCloudSync(config)`.

## 2. Auth / security

**There is no authentication or authorization system in this codebase.**
No login, no sessions, no cookies, no JWTs, no middleware, no route guards,
no RBAC, no user accounts of any kind. README.md says this outright: *"No
accounts, no server."* This is a single-user personal tool, not a multi-tenant
app.

The only access-control-adjacent thing that exists is **Supabase's anon
("publishable") key + Row Level Security policies**, used purely for data
sync, not for authenticating a person:

- Every page that syncs loads the Supabase JS SDK from a CDN
  (`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`)
  and calls Supabase's REST API against one table, `public.app_state`
  (columns used: `key`, `data` (jsonb), `updated_at`) — described in
  README.md as user-supplied; **the actual `CREATE TABLE` / RLS policy SQL is
  not checked into this repo**, only referenced from memory/prior
  conversation as "anon select/insert/update" policies. If you need the exact
  policy SQL, it must be pulled from the live Supabase project or asked of
  the user — don't invent it.
- The Supabase URL and publishable key are hardcoded (not env vars, since
  there's no build step to inject them) in three places: `sync.js`,
  `topbar.js`, and `gym.html` (gym.html has its own independent, older sync
  implementation predating `sync.js` — see §4).
- A Supabase "publishable" key is explicitly designed to be public/embeddable
  in client code (like a Firebase config) — it is not a secret, and RLS is
  what would enforce any real restriction. Currently RLS is permissive
  (anon can read/write the single shared row per `key`), which is
  intentional for a single-user tool, not an oversight to "fix" silently.

**Files involved (the entirety of the "auth-ish" surface):**
- `sync.js` — the shared sync client, used by `index.html`, `finance.html`,
  `entertainment.html`, `braindump.html`, `home.html`, and most other
  top-level pages (an abbreviated, non-exhaustive list, not re-audited
  page-by-page as part of any one pass).
- `gym.html` (inline `<script>`, ~line 2190–2386) — its own separate,
  hand-rolled Supabase sync using `APP_KEY = 'po-coach'`, not `sync.js`.
- `topbar.js` — still contains `pushWaterMergedToSupabase`, a small
  independent Supabase push that used to run when the water "+1" button was
  tapped from any page. **The Water page and the topbar's water button were
  removed** (see changelog), but this function is named explicitly in this
  file's DO NOT MODIFY list, so it was left in place rather than deleted —
  it is now unreachable dead code (nothing calls it). If you want it deleted
  too, that needs an explicit ask, same as anything else in that list.

## 3. Design system

There is **no Tailwind, no CSS-in-JS, no central theme file**. Each page has
its own `<style>` block in its `<head>` with its own `:root` CSS custom
properties. There is a strong *family resemblance* across pages (same near-
black background, same off-white text, same font stack) because later pages
were written by copying patterns from earlier ones, but the token *names*
are not consistent file-to-file, and there is no single source of truth.

**Actual palette (near-black / off-white — not dark-red/pink):**

The base look everywhere is a near-black background with off-white text and
a handful of semantic accent colors. There is no dark-red or dark-pink brand
color anywhere in the codebase — see the discrepancy note in §6.

| Token (varies by file) | Value | Meaning |
|---|---|---|
| `--bg` / `--bg-deep` | `#0A0A0B`, `#050506` | page background (near-black) |
| `--bg-card` | `rgba(255,255,255,0.04)` | card/surface fill |
| `--text-primary` / `--text-1` | `#FAFAFA` / `#ffffff` | primary text |
| `--text-secondary` / `--text-2` | `#B8B6B0` / `rgba(255,255,255,0.6)` | secondary text |
| `--text-tertiary` / `--text-3` | `#76746E` / `rgba(255,255,255,0.4)` | muted/label text |
| `--border` | `rgba(255,255,255,0.06–0.08)` | hairline borders |
| `--good` / `--success` | `#6ee7b7` / `#6BE3A4` | green — "done"/success |
| `--warn` / `--warning` | `#fbbf24` / `#F2C063` | amber — "in progress"/warning |
| `--bad` / `--danger` | `#ff8a8a` / `#FF6B6B` | red-coral — error/delete |
| `--info` | `#7dd3fc` / `#7DD3FC` | light blue — informational accent |
| `--accent` | `#E07658` (finance/entertainment/projects) or `#ffffff` (gym.html) | one warm/brand accent, **inconsistent per file** |

**Fonts (consistent everywhere):**
- `--font`: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", Menlo, Consolas, monospace` (used for labels, tags, numeric readouts)

**Spacing / radius:** no shared scale variables in most files; ad hoc pixel
values in each stylesheet. `entertainment.html` does define `--radius-sm: 8px`,
`--radius-md: 12px`, `--radius-lg: 16px`.

**Shared UI components** (by convention/copy-paste, not by import — every
page's CSS is self-contained in its own `<style>` block):
- **Top nav bar** — the only *actually* shared component (via `topbar.js`
  injecting real markup at runtime): `.topbar`, `.topbar-pill`.
- **Buttons** — `.btn-primary` / `.btn-secondary` (white-gradient primary,
  subtle-bordered secondary) in `entertainment.html`; `gym.html` uses
  `.po-btn-primary` / `.po-btn-secondary` (same look, different class
  names); `finance.html` uses page-specific names (`.quick-add-btn`,
  `.wish-add-btn`, `.ord-add-btn`) with the same visual recipe.
  **Not unified — copy the closest existing pattern, don't invent a
  fourth naming scheme.**
- **Modals** — `.modal-bg` / `.modal` (entertainment.html) vs
  `.po-modal-bg` / `.po-modal` (gym.html). `topbar.js` injects shared CSS
  that treats **both** naming conventions as "a modal" for mobile
  full-screen behavior and body-scroll locking (see the `MODAL_SELECTORS`
  array in `topbar.js`, `startModalLock()`). If you add a new modal, add its
  class to that array too, or scroll-lock won't apply. `topbar.js`'s
  `MODAL_SELECTORS` array still lists `.project-page-bg` from the now-
  deleted `projects.html` — left in place as unreachable dead code per the
  DO NOT MODIFY precedent (see the Projects/Study removal changelog entry).
- **Cards / gallery grid** — `.ent-card`, `.ent-cover`, `.ent-grid`, `.tag`,
  `.chip` are the Notion-gallery-style component pattern established by
  `entertainment.html`, copied verbatim into other gallery-style pages by
  convention (not by import). `finance.html` has its own separate `.card` /
  `.card-grid`.

## 4. Data layer

**No database, no ORM, no server.** Two storage mechanisms, layered:

1. **`localStorage`** is the primary store — every page reads/writes plain
   JSON under its own keys (e.g. `goals:<date>`, `subs`, `ent:cards`,
   `proj:cards`, `proj:statuses`, `proj:groups`, etc.). This is the only
   store that matters when offline; everything works with zero network
   access.

2. **Supabase Postgres, one generic table (`public.app_state`)** — used
   purely as a sync relay, not a relational schema. Row shape:
   `{ key: text, data: jsonb, updated_at: timestamptz }`. Each page (or
   logical group of pages) claims one `key` and stuffs *all* of its
   `localStorage` keys into that one row's `data` JSON blob:

   | `key` value | Owning page(s) | `localStorage` keys synced |
   |---|---|---|
   | `goals` | `index.html` | everything prefixed `goals:` |
   | `finance` | `finance.html` | `subs`, `wishlist`, `incoming_orders` (both orphaned since the rebuild — see changelog), `nw_currency`, `nw:activity`, `nw:history`, `nw:*`, `finance:*` (new: `finance:transactions`, `finance:budgets`, `finance:goals`, `finance:notes`, `finance:migrated_v2`) |
   | `entertainment` | `entertainment.html` | `ent:cards`, `ent:categories` (both orphaned since the rebuild — see changelog), `media:podcasts`, `media:stories`, `media:entertainment`, `media:playlists`, `media:active_gallery`, `media:migrated_v1`, `media:sort_mode` (`media:sort_dir` orphaned, migrated once into `media:sort_mode`), `media:heroes` (new — per-gallery hero eyebrow/title/subtext/CTA/cover photo-or-video, see changelog) — all synced via the existing `media:` prefix |
   | `po-coach` | `gym.html` (own sync, not `sync.js`) | `po_coach_v1`, `po_coach_workout_done` |
   | `braindump` | `braindump.html` | `braindump:entries` |
   | `household` | `household.html` | everything prefixed `household:` (`household:legions`, `household:beings`, `household:inventory`, `household:wishlist`, `household:chores`, `household:active_tab`) |
   | `selfcare` | `selfcare.html` (rebuilt) | everything prefixed `selfcare:` — `selfcare:tabs`/`selfcare:widgets` (the Dream-Board-style board engine), `selfcare:journalEntries`, `selfcare:meditations`, `selfcare:anxietyBreathwork`/`selfcare:anxietyTips` (new — the Anxiety tab, moved in from the deleted standalone `anxiety.html`), `selfcare:active_tab`, `selfcare:seeded`/`selfcare:anxiety_seeded`/`selfcare:anxiety_migrated`. `selfcare:hydrationProfile`/`selfcare:waterLog`/`selfcare:bucketList` (Water/Bucket List, removed — see changelog) and the old top-level `anxiety:breathwork`/`anxiety:tips`/`anxiety:active_tab`/`anxiety:seeded` keys (the now-deleted standalone `anxiety.html`'s own row/key, folded into this one — see changelog) are now orphaned, same treatment as every other removed-feature key elsewhere in this app |
   | `dreamboard` | `dreamboard.html` (new) | everything prefixed `dreamboard:` (`dreamboard:tabs`, `dreamboard:widgets`, `dreamboard:banner`, `dreamboard:active_tab`) — note uploaded video slots are session-only object URLs and are never in this list (see that page's own changelog entry) |
   | `business` | `business.html` (new) | everything prefixed `business:` (`business:tabs`, `business:widgets`, `business:tasks`, `business:workflowWeeks`, `business:workflowDays`, `business:workflowChecklist`, `business:active_tab`; `business:profile` and `business:platforms` were both removed — see changelog) — same session-only-video-slot exception as `dreamboard` above. `business:notes` is now an **orphaned key** — it backed the Tasks & Notes tab's Notes database, which was moved out to its own page (`tasksnotes.html`, see changelog); a device that already used that tab has its real note data copied forward into `tasksnotes:notes` on first load of the new page, and `business:notes` itself was left alone, same orphaned-key treatment as every other removed-feature key elsewhere in this app |
   | `aitech` | `aitech.html` (new) | everything prefixed `aitech:` (`aitech:models`, `aitech:prompts`, `aitech:hero`, `aitech:seeded`) |
   | `nutrition` | `nutrition.html` (rebuilt) | everything prefixed `nutrition:` — `nutrition:stores`, `nutrition:groceryItems`, `nutrition:recipes`, `nutrition:recipeIngredients`, `nutrition:seeded`, `nutrition:stepsMigratedV1`, plus the new Dream-Board-style board engine's `nutrition:tabs`/`nutrition:widgets`/`nutrition:boardSeeded`/`nutrition:active_tab` (see changelog) |
   | `learning` | `learning.html` (new) | everything prefixed `learning:` (`learning:topics`, `learning:resources`, `learning:hero`, `learning:seeded`) |
   | `tasksnotes` | `tasksnotes.html` (new) | everything prefixed `tasksnotes:` (`tasksnotes:links`, `tasksnotes:notes`, `tasksnotes:tasks`, `tasksnotes:hero`, `tasksnotes:seeded`, `tasksnotes:migratedFromBusinessHub`) |
   | `mainpillar` | `mainpillar.html` | everything prefixed `mainpillar:` — `mainpillar:hunter` (XP/rank), `mainpillar:habits`, `mainpillar:habitlog:<date>`, `mainpillar:whoop:<date>`, `mainpillar:tasks`, `mainpillar:projects`, `mainpillar:journal:<date>`, `mainpillar:wins`, `mainpillar:brief:<scope>:<periodKey>`, `mainpillar:goals`, `mainpillar:goalLog:<goalId>`, `mainpillar:favorites`, `mainpillar:active_tab`, `mainpillar:hunterName` |
   | `system` | `system.html` | everything prefixed `system:` (`system:goals`, `system:actions`, `system:processes`, `system:visualTools`, `system:mentalEntries`, `system:anchors`, `system:vision`, `system:challenges`, `system:pageNotes`, `system:identityPrompts`, `system:active_tab`, `system:seeded`) — new (see changelog) |
   | `home` | `home.html` (rebuilt) | everything prefixed `home:` — `home:scheduleTasks`, `home:affirmations`, `home:reprogramSections`, `home:ritualItems`, `home:ritualDate`, `home:heroTitle`, `home:heroSubtext`, `home:heroPhoto` (new — the cover photo, see changelog), `home:seeded`, `home:photosMigratedV1`. `home:active_tab` (from this page's first build, a 6-panel tab-switcher) is now orphaned — Home was rebuilt into one continuous scrollable page, so nothing reads or writes it anymore. The eight embedded pages (Dream Board/Tasks & Notes/AI & Tech/Self-Care/Main/Main Pillar/Household/Brain Dump) keep syncing under their own existing `key`s (`dreamboard`/`tasksnotes`/`aitech`/`selfcare`/`goals`/`mainpillar`/`household`/`braindump`) exactly as before — `home.html` never reads or writes those, it only embeds the live pages in an iframe |

   `health` (previously owned by `health.html`/`po-water.html`, syncing
   `stack:*` and `po_water_v1`) is now an **orphaned row** — no page reads or
   writes it anymore since those pages were deleted (see changelog). It was
   left alone in Supabase itself; this doc only tracks code, not database
   cleanup. `projects` (previously owned by `projects.html`, syncing
   `proj:cards`/`proj:statuses`/`proj:groups`) and `study` (previously owned
   by `study.html`, syncing everything prefixed `study:`) are now likewise
   **orphaned rows** — left alone in Supabase, not cleaned up, same
   treatment as `health` (see the Projects/Study removal changelog entry).
   `goals`/`mainpillar`/`household`/`braindump` were briefly orphaned when
   their pages were deleted, then became active rows again the moment those
   pages were restored (see the changelog entry near the bottom of this
   file) — nothing about their own key scheme ever changed in the interim.

   There are no other tables, no foreign keys, no migrations directory.
   Uploaded images (progress photos, project/media covers) are stored as
   base64 data URLs *inside* these JSON blobs (client-side downscaled via
   `<canvas>` first) — not in Supabase Storage.

**Sync mechanism (`sync.js`, used by 4 of 5 pages):** `initCloudSync({appKey, syncedKeys, syncedPrefixes, onApplied})`
monkey-patches `localStorage.setItem`/`removeItem` to detect relevant writes,
debounce-pushes them to Supabase, pulls the current remote row on load
(applying it if newer/present), and subscribes to a Postgres Realtime channel
filtered to that `key` so other devices' changes arrive live. `gym.html`
duplicates a simpler, older version of this same pattern inline instead of
using `sync.js`.

## 5. Current pages

| Page | Nav pill (topbar.js) | Files |
|---|---|---|
| Home | 🏠 `HOME` → `home.html` (leads the nav row — see changelog) | `home.html` + `home-data.js` (rebuilt into one continuous scrollable page — see changelog) |
| Main | 🎯 `MAIN` → `index.html` | `index.html` (rebuilt as a command center — see changelog; briefly deleted, then restored — see the changelog entry near the bottom of this file) |
| Fitness Studio | 🏋️ `STUDIO` → `gym.html` | `gym.html` (renamed from "Gym"/"Progressive Overload Coach" — see changelog) |
| Finance | 💰 `FINANCE` → `finance.html` | `finance.html` |
| Media | 🎬 `MEDIA` → `entertainment.html` | `entertainment.html` (rebuilt as a 4-gallery tracker — see changelog) |
| Brain Dump | 🧠 `BRAIN DUMP` → `braindump.html` | `braindump.html` (briefly deleted, then restored — see changelog) |
| Nutrition | 🍽️ `NUTRITION` → `nutrition.html` | `nutrition.html` + `nutrition-data.js` (rebuilt around Dream Board's engine/aesthetic — see changelog) |
| Household | 🧺 `HOUSEHOLD` → `household.html` | `household.html` + `household-data.js` (briefly deleted, then restored — see changelog) |
| Self-Care | 🌙 `SELF-CARE` → `selfcare.html` | `selfcare.html` + `selfcare-data.js` (rebuilt around Dream Board's engine/aesthetic; Water and Bucket List removed; the standalone Anxiety page was folded in as this page's 4th tab — see changelog) |
| Example | `EXAMPLE` → `example.html` | `example.html` (new — a visual style demo tab, not a real feature; see changelog) |
| Dream Board | ✨ `DREAM BOARD` → `dreamboard.html` | `dreamboard.html` + `dreamboard-data.js` (new — see changelog) |
| Business Hub | 💼 `BUSINESS` → `business.html` | `business.html` + `business-data.js` (new — see changelog) |
| AI & Tech | 🤖 `AI & TECH` → `aitech.html` | `aitech.html` + `aitech-data.js` (new — see changelog) |
| Learning & Knowledge Hub | 📚 `LEARNING` → `learning.html` | `learning.html` + `learning-data.js` (new — see changelog) |
| Tasks & Notes | ✅ `TASKS & NOTES` → `tasksnotes.html` | `tasksnotes.html` + `tasksnotes-data.js` (new — moved out of Business Hub, where it used to be a 5th tab — see changelog) |
| Main Pillar | 🎮 `MAIN PILLAR` → `mainpillar.html` | `mainpillar.html` + `mainpillar-data.js` (briefly deleted, then restored from a dangling git blob since it had never been committed — see changelog) |
| Build Your System | ⚙️ `SYSTEM` → `system.html` | `system.html` + `system-data.js` (new — see changelog) |

Stack, Water, Projects, and Study were removed — see changelog at the
bottom of this file. Main, Main Pillar, Household, and Brain Dump were
briefly removed and then restored (see changelog). `example.html` has no
topbar pill (a pre-existing doc/code mismatch
noted once already in this file's own Dream Board changelog entry, not
something this pass touched).

Nav pill markup lives in one place: the `html` template string inside
`topbar.js`. There is no separate "nav config" file.

## 6. Discrepancies worth flagging before further work

The original ask for this audit described things (framework + router,
auth middleware/RBAC, Tailwind config, a dark-red/dark-pink/black palette,
a DB/ORM with models/tables) that **do not exist in this repository**. Rather
than force-fit the documentation to match that description, this file
documents what's actually here:

- No framework/bundler/router — static HTML files + vanilla JS.
- No auth system at all (not "hidden" or "to find" — genuinely absent by
  design, per README.md).
- No Tailwind / CSS framework — hand-written CSS custom properties per file.
- No dark-red/pink palette — the real palette is near-black + off-white with
  green/amber/red-coral/blue accents (full table in §3). Three deliberate,
  explicit exceptions exist, each because the request was a literal,
  specific visual instruction (a reference photo) rather than generic
  "themed to a palette" boilerplate: (1) `entertainment.html` (the Media
  page) got a thin-red tile border + a genuinely new pink accent color on
  hover, which evolved into a dark wine/candlelit "boutique gallery" look
  (`--tile-border`/`--pink-accent`/`--wine`/`--candle`/`--cream` tokens) —
  `household.html` and `selfcare.html` were each later explicitly asked to
  match *that* look, and still do (see their own changelog entries); Media
  itself has since moved on again, explicitly re-themed a second time to
  match Dream Board's dark cinematic near-black/gold look instead (see its
  own changelog entry below) — `--tile-border`/`--pink-accent`/`--wine`/
  `--candle`/`--cream` are gone from `entertainment.html` now, repointed
  to gold-toned equivalents kept under the same token *names* it already
  used (`--bg`/`--border`/`--accent`/etc.), so Household/Self-Care's own
  copies of the old wine/rose look are unaffected — they weren't asked to
  follow Media's second move; (2) `braindump.html`
  (Brain Dump) has its own self-contained dark forest-green/black +
  gold/copper theme (deep green radial-gradient
  background, gold serif-italic display type, a CSS sunburst emblem) —
  **not** the app's near-black/off-white/green-amber-red-blue palette,
  and also not its own original light-cream theme (see its changelog:
  it was built light first, then explicitly re-themed dark to match a
  second reference photo); (3) `gym.html` (Fitness Studio) originally had
  its primary-action accent (buttons, active chips/toggles) re-graded from
  white to a deep crimson gradient, matching a reference photo's color
  grading — that crimson exception has since been **superseded**, per an
  explicit request to copy Dream Board's dark cinematic near-black/gold
  aesthetic onto every page in this tab: `--crimson`/`--crimson-bright`/
  `--crimson-text` keep their names but now hold Dream Board's gold
  values instead of crimson ones (see that changelog entry). All these
  exceptions are scoped to their own file's `:root`; no other page's
  tokens changed, and `--good`/`--warn`/`--bad`'s semantic meaning
  (success/warning/danger), plus the unrelated day-of-week tag palette,
  were left alone throughout. See each page's changelog entry.
- No ORM/DB — `localStorage` + one generic Supabase table used as a sync
  relay, no relational schema.

*(The original WATER-pill-links-to-a-nonexistent-anchor discrepancy noted
here has since been resolved by removing the Water page and pill entirely —
see changelog.)*

## DO NOT MODIFY

Since there is no auth/security layer to preserve, the rule below is scoped
to what actually exists: the Supabase sync plumbing and RLS-backed access
model. Treat it with the same "don't rewrite, weaken, or bypass" discipline
you'd apply to real auth middleware, because it's the only thing standing
between this app and either data loss or a wide-open write target:

1. **Never rewrite, weaken, or bypass the existing sync/access-control
   plumbing.** Specifically, do not modify unless explicitly asked:
   - `sync.js` (the shared `initCloudSync` helper — used by `index.html`,
     `finance.html`, `entertainment.html`, `braindump.html`, `home.html`,
     and most other top-level pages).
   - The inline Supabase sync block in `gym.html` (~line 2190–2386,
     `APP_KEY = 'po-coach'`).
   - The inline Supabase push in `topbar.js`
     (`pushWaterMergedToSupabase`, `TOPBAR_SUPABASE_URL`/`_KEY`).
   - The hardcoded `SUPABASE_URL` / `SUPABASE_KEY` values themselves (they
     must stay in sync across `sync.js`, `topbar.js`, and `gym.html` — don't
     let a rebuild introduce a fourth, different copy).
   - The Supabase `app_state` table's `key` scheme (one key per page/tab —
     see the table in §4). Don't repurpose an existing `key`, silently
     rename one, or change what gets read/written under it without asking,
     since that can desync a device mid-flight or clobber another tab's row.
   - Rebuilding any page must reuse `initCloudSync(...)` (or, for `gym.html`,
     its existing inline pattern) exactly as already wired — don't invent a
     new sync mechanism, don't call Supabase directly from new code paths,
     and don't loosen what's synced without being asked to.

2. **All rebuilt UI must reuse the existing design tokens and shared
   components — no new hard-coded colors.** Concretely:
   - Reuse the existing `:root` custom properties in whichever file you're
     editing (or the closest sibling page's, e.g. `entertainment.html`'s
     tokens when building something gallery-like) instead of introducing new
     hex values.
   - Keep the existing near-black / off-white base look with the existing
     green/amber/red-coral/blue accent roles (`--good`/`--warn`/`--bad`/
     `--info` or that file's equivalent) — there is no dark-red/pink palette
     to preserve, because none exists; don't introduce one unless asked.
   - Reuse existing component patterns before inventing new class names:
     `.btn-primary`/`.btn-secondary` (or `.po-btn-primary`/`.po-btn-secondary`
     in gym.html), `.modal-bg`/`.modal` (or `.po-modal-bg`/`.po-modal`)
     — and register any new modal-like overlay in `topbar.js`'s
     `MODAL_SELECTORS` — `.chip`, `.tag`, `.ent-card`/`.ent-cover`/`.ent-grid`
     for gallery-style pages.
   - `topbar.js`'s injected markup/CSS (`.topbar`, `.topbar-pill`, etc.) is
     shared at runtime across every page — don't fork it per-page; edit it
     once in `topbar.js` if the nav itself needs to change.

## Writing Dashboard

**Status: built, 5th Business Hub tab, `layout: 'writing'` — see the
changelog entry below for the full feature list.** `docs/WRITING_DASHBOARD_SPEC.md`
now documents the real, implemented plan (it was scaffolding-only before this
was built) — read it for the file-by-file breakdown; this section keeps the
original scope note and the constraint adaptations below since they're still
accurate.

**Scope, confirmed 2026-07-22**: a new tab inside `business.html` (Business
Hub), alongside the existing Content / Ideas / Platforms / Resources tabs —
*not* a standalone page, and *not* a client-side "route" (this app has no
router of any kind — see §1).

Rules for this feature, as given, with two adapted to fit this app's actual
architecture (noted inline — flagged rather than silently followed, since
both as originally phrased assumed a backend this app doesn't have):

- **Ordering uses fractional-indexing string keys, never integer position
  columns.** This is a new convention, scoped to this feature only — every
  other reorderable list in this app (Life Areas, Workflow weeks/days, Dream
  Board/Business Hub/AI & Tech/Nutrition/Self-Care board widgets, etc.) uses
  a numeric `order` field with swap-adjacent-values reordering instead (see
  `dreamboard-data.js`/`business-data.js`'s `move*()` functions for the
  existing pattern). Fine to introduce here, but don't expect a sibling
  feature's code to match it, and don't retrofit it onto anything else
  without being asked.
- **No hardcoded colors, fonts, or radii — read from theme CSS custom
  properties.** Matches this app's existing DO NOT MODIFY rule 2 above.
  Concretely: reuse `business.html`'s own `--bh-*` tokens (it already
  matches Dream Board's dark cinematic near-black/gold aesthetic — see that
  page's own changelog entries), don't introduce a new palette for this tab.
- **Every table gets user_id + RLS. No exceptions, no "add it later."**
  **Cannot be followed as literally written — flagging rather than adding
  silently.** This app has no per-feature Supabase tables and no `user_id`
  column anywhere: it's a single-user tool (§2, "No accounts, no server")
  with exactly one generic table, `public.app_state` (`key`/`data`/
  `updated_at`), and the DO NOT MODIFY section above explicitly prohibits
  repurposing that table's `key` scheme or inventing a new sync mechanism
  without being asked. In practice, Writing's data will live under
  `business:*` `localStorage` keys (already covered by `business.html`'s
  existing `initCloudSync({ appKey: 'business', syncedPrefixes:
  ['business:'] })` call — reuse it, don't add a new sync call) inside the
  shared `business` row, same as every other Business Hub tab. If a real
  per-table/RLS backend is actually wanted for this feature specifically,
  that's a standing architecture change bigger than one feature and needs
  an explicit decision first, not something to build quietly inside this
  section.
- **Any drag/resize/collapse state must persist to Supabase. If it doesn't
  survive a reload, the feature is not done.** Matches how every other
  synced page here already works — write to the right `business:`-prefixed
  `localStorage` key and `sync.js`'s push/pull handles the rest, same as
  every other Business Hub tab.
- **Do not modify files outside the writing dashboard feature folder
  without asking first.** Note: this app has no per-feature folders (§1 —
  flat top-level `.html`/`-data.js` files, no build step). Read as: don't
  touch files outside `business.html`/`business-data.js` (and this spec
  doc) without asking — same spirit, adapted to this repo's actual layout.
- **Before saying a phase is done: typecheck, lint, and build must pass.**
  This repo has no build step, no TypeScript, and no configured linter (§1
  — no bundler, no compiler, no package.json). Read as: before saying a
  phase is done, open the page in a browser and confirm it renders/works
  with zero console errors — the closest equivalent this app actually has,
  per this file's own established verification convention (see e.g. the
  Templates/Workflow/Business Hub changelog entries' "verified in headless
  Edge" notes).

## Changelog

- **New: Writing Dashboard — a 5th Business Hub tab (`layout: 'writing'`),
  built from `docs/WRITING_DASHBOARD_SPEC.md`'s plan** — effectively its own
  Scrivener-style manuscript editor plus a Notion-style project tracker,
  scoped to writers who work in series/trilogies. Genuinely new companion
  data file, `writing-data.js` (mirrors every other page's own
  `<page>-data.js` sibling convention — `household.html`+`household-data.js`
  etc. — rather than cramming this feature's ~10 new collections into the
  already-1000-line `business-data.js`); every key it defines is still
  `business:*`-prefixed (`business:writingSeries`, `business:writingManuscripts`,
  `business:writingTasks`, `business:writingBinderNodes`,
  `business:writingPlotThreads`/`ContinuityItems`/`Characters`,
  `business:writingIdeas`, `business:writingArticle`, `business:writingTheme`),
  so the existing `initCloudSync({ appKey: 'business', syncedPrefixes:
  ['business:'] })` call already in `business.html` covers it with zero new
  sync wiring — verified directly (dumped every `localStorage` key after a
  full click-through and confirmed every Writing key carries the
  `business:` prefix). `business-data.js` itself only gained a one-line
  change — `tabModel()`'s `layout` whitelist gained `'writing'` — plus a 5th
  seeded tab and 3 hidden `isWritingSubpage: true` tabs (see below).
  - **Confirmed adaptations** (asked and agreed before building, since the
    original ask assumed capabilities this app doesn't have): the Plot
    Thread/Continuity/Character trackers "auto-fill" via a **tag-selected-
    text button** (creates a mention from the Index Card's current text
    selection) plus a **"🔍 Scan this chapter" button** (case-insensitive
    substring-matches every existing tracker name against the chapter's
    text and logs a mention per hit) — not real NLP/LLM extraction, since
    this app has no active LLM key (`ANTHROPIC_API_KEY` is still an
    inactive placeholder everywhere else in this file too). "Kindle-
    compatible" export was dropped entirely per the user's own choice (true
    `.mobi`/`.azw3` generation isn't feasible client-side — KindleGen is
    discontinued). PDF export is a print-formatted view + the browser's
    native Print → Save as PDF, not a hand-rolled PDF byte generator
    (better typography, one extra click) — also the user's own choice.
  - **Ordering, deliberately split** (matching this section's own
    pre-existing note above): Series/Manuscript/WritingTask/note-sections/
    article-blocks all use this app's standard numeric `order` + swap-
    adjacent-values convention. `BinderNode.orderKey` alone uses fractional-
    indexing string keys (a small self-contained base-36 midpoint generator,
    `midKey()`, no external dependency) — the one place in this feature
    where "drag anywhere in an arbitrarily deep tree" genuinely benefits
    from it, since it avoids renumbering an entire subtree on every drag.
  - **Landing page** (`#bhWritingDashboard`): an editable article/callout
    section (default title "Your Novel in 30 Days," heading/paragraph/
    callout blocks, add/reorder/delete) above a **visual board** — manuscript
    cards grouped by Series (+ a trailing "Standalone" group), status filter
    chips (All/Active/Inactive/Idea), SortableJS drag both within and across
    series groups (cross-group drop reassigns `seriesId`). Each card shows
    Platform/Niche/Est. growth duration, Goal Revenue/Profit, an editable
    "750 / 1500 words" Today's Goal, Total/Completed Tasks, a completed-
    tasks progress bar with an editable fill color (a plain `<input
    type="color">`, not the widget board's tint-popover component), and
    Current Chapter. Clicking a card opens a **Manuscript Detail overlay**
    (this app's established `#taskDetailPageBg`-style full-page pattern,
    new here as `.wr-page-bg`/`.wr-page` since `business.html` only had
    modal-bg overlays before) with an editable stats form, multiple
    editable/reorderable/deletable note sections (same convention as
    `index.html`'s Overview notes / this file's own Platform sections), a
    Tasks readout, and (once built) "📖 Open Binder."
  - **Sub-nav** (`.wr-subnav`): Outlines / More Notes / Automation Ideas are
    each a real, hidden `isWritingSubpage: true` Tabs record reusing the
    *entire* existing freeform widget-board engine verbatim (drag, tint,
    Add Widget menu) — `renderTabs()` filters them out of the main
    `.bh-tabs` pill row, and a `.wr-subpage-backbar` shows "← Back to
    Writing Dashboard" whenever one is the active tab. Ideas is a small
    dedicated CRUD gallery (`WritingIdea` — title/pitch/tags/status/notes,
    tag+status filter chips, search) since "filter them in various ways"
    was a more precise ask than a generic board. Theme Marketplace is the
    one sanctioned palette exception here (opt-in, data-driven — 5 built-in
    preset records plus a custom color/font/background-photo editor, all
    applied as `--wr-theme-*` custom properties scoped to
    `#bhWritingDashboard` only, so it can never leak into the other 4 tabs).
  - **Tasks Inline Database** (on the main board page, below the manuscript
    board, per the request's own "still on the main page... below the
    visual board" wording): a "database table" rendered as this app's
    established div-row idiom (`.bh-task-card`, reused verbatim) rather
    than a literal `<table>`. A "template" is a root `WritingTask`
    (`parentTaskId: null`); its "sub-pages" are child tasks, indented below
    it. Filterable by manuscript/status/priority/search; a manuscript's
    Detail overlay "📋 Open in Tasks Database" link deep-links here
    pre-filtered. **Reorder uses up/down arrows, not drag** — a deliberate,
    disclosed scope adjustment from the original plan wording: a careless
    cross-template drag could otherwise silently reparent a sub-page under
    the wrong template, and this app's own closest nested-list precedent
    (Workflow's Weeks/Days, same file) already made the same "arrows, not
    drag, for a real parent/child tree" call. A Task Detail modal (title,
    manuscript link, status/priority/due, an autosaving "summary note" —
    shown on the row below the title) has "+ Generate Text Section"/"+
    Generate Code Block" buttons appending editable/reorderable/deletable
    blocks, reusing the exact `.bh-pf-section` component this file's own
    Platform Detail / Workflow Day pages already established.
  - **Manuscript Binder** (`#wrBinderPageBg`, opened via "📖 Open Binder" —
    its own full-page view, not a modal): a Part→Chapter→Scene tree (native
    HTML5 drag with a before/after/onto drop-position indicator, a cycle
    guard so a node can't be dropped into its own descendant, inline-
    editable titles, per-node live word counts, delete-with-cascade-
    confirm) plus a 3-panel editor for the selected node — **Trackers**
    (left: Plot Threads/Continuity/Characters mini-lists, "+ New," the tag-
    selection/scan-chapter auto-fill above), **Index Card** (center: a
    large autosaving textarea bound to the node's prose, live word count),
    **Chapter Notes** (right: a separate autosaving textarea, distinct from
    the manuscript-level note sections on the card). A **Project Targets**
    row above the layout shows three editable-goal progress bars — entire
    manuscript (summed word count across the whole tree vs. a new
    `Manuscript.manuscriptWordGoal` field), current chapter (vs. that
    node's own `wordGoal`), and daily writing (vs. `todaysGoalTarget`,
    computed via a once-per-day `business:writingDailySnapshot` diff — a
    documented simplification, no full revision history, same spirit as
    `projects.html`'s burndown-chart fixed-scope assumption elsewhere in
    this app's history). **Composition Mode** is a fixed fullscreen overlay
    (Escape or "✕ Exit" to leave) showing only the Index Card text + a live
    word count, hiding everything else via a separate `<textarea>` that
    writes back to the real node on exit.
  - **Compile & Export** (from the Binder's "📦 Compile & Export" button): a
    picker over the flattened binder tree (checkboxes, default all-checked)
    plus a "Standard manuscript format" toggle (title page + chapter page-
    breaks). **TXT** and **RTF** (hand-rolled escaping, no library) are
    trivial `Blob`+`<a download>`s. **DOCX and EPUB share one hand-rolled,
    dependency-free stored/uncompressed ZIP writer** (local file headers +
    central directory + a CRC32 lookup table — STORE-method entries are
    valid per the ZIP spec, so no compression library was needed) — DOCX
    is minimal but real OOXML (`[Content_Types].xml`, `_rels/.rels`,
    `word/document.xml` with `word/styles.xml`-defined Title/Heading1
    styles so Word doesn't need to guess at unstyled `w:pStyle`
    references), EPUB is a real, valid EPUB3 (`mimetype` stored as the
    first entry per spec, `META-INF/container.xml`, `OEBPS/content.opf` +
    `toc.ncx`, one XHTML file per chapter). **PDF** is the confirmed
    print-view approach: populates `#wrPrintView` (a fixed body-level
    sibling, shown only under a `@media print` rule that hides everything
    else) then calls `window.print()`.
  - **Verified in headless Edge, `*.supabase.co` blocked at the network
    layer** (`--host-resolver-rules`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]) via a real,
    interactive click-through per phase (not just `--dump-dom` snapshots —
    a same-origin iframe harness with `--allow-file-access-from-files`,
    same technique this repo's pre-existing `_test_harness.html` already
    used successfully for `gym.html`): series/manuscript CRUD, cross-series
    drag reassignment logic, status filtering, note sections, Ideas CRUD,
    Theme Marketplace preset application (confirmed the actual computed
    `--wr-theme-accent` value changed), Outlines/More Notes/Automation
    sub-page navigation (confirmed real reuse of the freeform board engine
    — non-zero widget counts, zero new widget code), the Tasks table's
    template/sub-page hierarchy and manuscript-linked task counts, the
    Binder tree's add/select/word-count-on-blur/drag-with-cycle-guard,
    tracker tag-selection and chapter-scan auto-fill (confirmed a real
    mention got logged with the correct text snippet), Composition Mode's
    round-trip back into the Index Card, and all five export formats
    (TXT/RTF content verified by intercepting `HTMLAnchorElement.prototype
    .click()` and `fetch()`-ing the resulting `blob:` URL back out instead
    of letting headless mode attempt a real file-save dialog; DOCX/EPUB
    verified as genuinely valid ZIPs with the correct internal part names
    present in the raw bytes; PDF verified via a stubbed `window.print`
    plus checking the populated print-view DOM). Reload-persistence was
    confirmed three separate times (once per data-bearing phase) by
    reloading the same iframe in place and re-reading the same state back
    out of `localStorage` — not merely asserted. Zero console errors across
    every pass, and the pre-existing Content/Ideas/Platforms/Resources tabs
    were re-confirmed unaffected after each phase landed.

- **Bugfix: the new Writing Dashboard tab was invisible on any device that
  already had real Business Hub data from before this feature existed** —
  reported as "I can't find it." Root cause: `seedDefaultBoard()`'s Writing
  Dashboard tab (and its 3 hidden sub-page tabs) only ever gets created by
  `seedIfEmpty()`, which is guarded by a one-time `business:seeded` flag —
  on a device that had already used this page, that flag was already `true`
  from before this session, so it silently never ran again, and
  `normalizeStoredData()` (which runs on every load) only ever backfills
  *fields* on tabs that already exist, it never adds a brand-new tab. Same
  failure class this app has hit — and fixed — more than once before (this
  file's own Self-Care "missing Anxiety tab" entry, and this exact page's
  earlier `hasTemplates` backfill). Fixed with `ensureWritingDashboardExists()`
  (new, `business-data.js`) — appends the Writing Dashboard tab (and any
  missing sub-page tab, each independently) directly, guarded only by "some
  tabs already exist" so a genuinely fresh/empty device isn't handed a
  stray tab before its own deferred full-board seed runs. Called
  unconditionally at the top of `business.html`'s `init()` (before tabs are
  loaded for rendering) and again inside `onApplied` (a pulled remote row
  can reintroduce an older tab list missing it too), matching the exact
  two-call-site precedent the `hasTemplates`/Anxiety-tab fixes already
  established. **Verified by reproducing the actual bug first**: pruned a
  real, fully-seeded profile's `business:tabs`/`business:widgets` back down
  to just the original 4 tabs (confirming `business:seeded` stayed `true`
  throughout, so the one-time seed path genuinely could not have been what
  restored it), reloaded, and confirmed all 8 tabs (4 original + Writing
  Dashboard + 3 sub-pages) came back and the Writing Dashboard tab actually
  renders on click.

- **Stack and Water pages removed.** Deleted `health.html` (Stack) and
  `po-water.html` (Water) entirely, along with their `STACK`/`WATER` nav
  pills and the water quick-add `+` button in `topbar.js` (CSS, injected
  HTML, and the `getStackProgress`/`getWaterProgress`/`calendarDateKey`/
  `defaultWaterState`/`addWater` functions). `pushWaterMergedToSupabase` and
  the `TOPBAR_SUPABASE_URL`/`TOPBAR_SUPABASE_KEY` constants were **left in
  `topbar.js` untouched** per the DO NOT MODIFY rule above (they're now
  unreachable dead code, not deleted, since removing them wasn't explicitly
  asked for). The Supabase `app_state` row under `key = 'health'` was left
  alone in the database — it's now orphaned, not cleaned up. `README.md`'s
  file table was updated to match.

- **Goals page (`index.html`) rebuilt as a command center.** Retired the
  Day Ring (time-of-day widget) and the crossfading Goal Ticker — neither
  was part of the new spec, and the new Today-header summary row supersedes
  the ticker's role. Kept the existing freeform daily checklist (Today /
  Plan Tomorrow cards, drag reorder, inline edit, queue, ✨ Polish, the
  `goal_streak_v1` day-streak) verbatim, alongside two brand-new systems:
  - **Recurring habits** (`goals:habits`, `goals:habit-log:<date>`) — each
    habit has a weekday schedule editable inline, a checkbox that's disabled
    on non-scheduled days, and a current/best streak (with the best streak's
    date span) computed by walking day-by-day from the habit's creation date.
  - **Monthly/yearly goals with an allocation engine** (`goals:goals`) —
    a target + unit split evenly across the remaining periods of its scope
    (yearly → months, monthly → weeks), stored as a per-period `allocation`
    plan. On each load, any period that's fully in the past gets reconciled
    against actual logged progress: a shortfall either rolls onto the next
    period or gets redistributed evenly across all remaining periods,
    depending on the goal's `rollover` setting. Editing a goal's target
    recomputes only the current-and-future allocation, leaving past periods'
    history untouched.
  - A small daily **journal** note (`goals:journal:<date>`), autosaved.
  - All of the above live under the `goals:` prefix, so they're already
    covered by the existing `initCloudSync({ appKey: 'goals', syncedPrefixes:
    ['goals:'] })` call — no sync.js or sync-config changes were needed.
  - `topbar.js`'s `getGoalsProgress()` was extended (not replaced) to also
    fold in today's scheduled habits into the shared GOALS pill's count,
    and `storeSet()` in `index.html` now also dispatches a native `storage`
    event so that pill updates immediately instead of waiting for the next
    focus/visibility/30s-interval tick (previously true for the old freeform
    checklist too — this was a pre-existing lag, not a regression).
  - No auth was added — there is none in this app (see §2) — so "make it
    the post-login landing page" was a no-op: `index.html` was already the
    home page.

- **Gym page (`gym.html`) rebuilt around manual routines/schedule instead of
  auto-rotation.** The prior version auto-selected "today's split" from a
  rotating day sequence and separately bundled body-weight tracking with a
  weigh-in chart/streak, progress photos (with in-browser camera capture and
  before/after compare), and body-composition estimates — none of that was
  part of the new spec, so it was removed wholesale rather than kept
  alongside the rebuild. What replaced it, all still under `po_coach_v1`
  (routines/schedule/logs/notes/settings) and `po_coach_workout_done`
  (completed-workout log), same `localStorage` keys and shapes close enough
  that no migration was needed for the parts that carried over:
  - **Weekday → routine schedule**, editable anytime via the day pill at the
    top (opens a Mon–Sun editor; any day can be set to Rest).
  - **Routines** with full CRUD, each holding an ordered list of exercises
    (name, rep range, weight increment, starting weight, optional
    bodyweight-only flag) — also full CRUD, addable inline from "Today's
    workout" or from the routine editor.
  - **Today's workout** view driven purely by the weekday schedule (with a
    manual "log anyway" override on rest days): a logging form pre-filled
    from a purely-local prescription engine (last logged set + rep-range
    threshold → hold/add-weight/deload suggestion — no external data, no
    health devices, explicitly not AI), a running list of today's logged
    sets, an optional per-workout note, and a "mark workout complete" toggle.
  - Completing a workout calls `checkOffRelatedHabit()`, a best-effort
    heuristic that checks off a same-day Goals-page habit
    (`goals:habits` / `goals:habit-log:<date>`) if its text matches the
    routine name or a generic keyword (gym/workout/exercise/lift) — same
    data shape `index.html`'s habit system already uses, and it dispatches
    the same `goals-changed`/`storage` events so an open Goals tab updates
    live.
  - **Workout history** (completed sessions from `po_coach_workout_done`,
    expandable per-session set detail) and a **per-exercise progress chart**
    (weight or volume over time, toggleable) — both hand-rolled inline SVG
    matching this file's existing sparkline/chart pattern, not a charting
    library import, consistent with "no build step" for this repo.
  - **Compare view** — pick a routine with 2+ completed sessions and two of
    its session dates, see a per-exercise volume/top-set delta table.
  - The inline Supabase sync block (`APP_KEY = 'po-coach'`) was kept exactly
    as wired, just with its synced-key list trimmed from
    `['po_coach_v1', 'po_coach_workout_done', 'po_coach_weights',
    'po_coach_photos']` to `['po_coach_v1', 'po_coach_workout_done']` since
    the weigh-in/photo keys no longer exist — the `key='po-coach'` row in
    Supabase itself was left alone (old `po_coach_weights`/`po_coach_photos`
    fields in that row are now orphaned, not cleaned up, same treatment as
    the `health` row from the Stack/Water removal above). `topbar.js`'s
    `MODAL_SELECTORS` still lists `.wt-overlay`/`.wt-viewer`/`.wt-cam` from
    the removed photo viewer/camera modals — left in place as unreachable
    dead code rather than deleted, since removing them wasn't explicitly
    asked for (same call as `pushWaterMergedToSupabase` above). The §4 data
    table above was updated to match the trimmed key list.

- **Gym page renamed "Fitness Studio" + richer per-exercise properties.**
  Follow-up to the rebuild above, same `gym.html` file, same `po_coach_v1`/
  `po_coach_workout_done` keys and `key='po-coach'` Supabase row — no sync
  changes. The in-page `<title>`/heading and `CONFIG.appTitle` changed from
  "Progressive Overload Coach" to "Fitness Studio"; `topbar.js`'s shared nav
  pill label changed from `GYM` to `STUDIO` (same `href="gym.html"`, same
  `id="topbarGym"` — only the visible label moved, not the wiring).
  - **Weekday color tags** — 7 new `:root` custom properties,
    `--day-sun`…`--day-sat`, evenly-spaced hues at the same pastel s/l as
    the existing `--good`/`--warn`/`--bad`/`--info` accents (a derived,
    formulaic extension of the existing palette, not an arbitrary new
    color set — done because this rebuild explicitly asked for day-coded
    tags, which nothing in the existing 4-color semantic set could cover).
    A routine's day tag(s) are **derived, not stored** — computed on every
    render by reverse-scanning `state.schedule` for weekdays pointing at
    that routine's id (`scheduledDaysForRoutine()` in `gym.html`) — so
    editing the schedule immediately relabels every exercise that inherits
    it, with nothing to desync.
  - **Exercise objects gained three persistent fields**: `setsReps` (free
    text, e.g. "3 × 8–12", editable independent of the numeric
    `repMin`/`repMax`/`step` used by the prescription engine and stats),
    `notes` (free text form cues/reference), and `media` (array of
    `{id, type: 'image'|'video', dataUrl, name}`). Images are canvas-
    downscaled before storage using the exact `compressImageDataUrl`
    recipe already used for cover images in `projects.html`/
    `entertainment.html` (max dimension 640px, JPEG quality 0.75); video
    can't be transcoded client-side, so it's just size-capped at 8MB with
    an alert on rejection instead. All three fields are edited from both
    exercise-entry points — the quick "Add exercise" modal opened from
    Today's Workout, and the inline per-exercise rows inside the Routine
    editor — and migrate in via `normalizeExercise()` so pre-existing
    exercises get sane empty defaults instead of `undefined`.
  - **Per-exercise "done" checkbox is per-session, not permanent** — a new
    state slice, `state.exerciseDone[dateKey][exerciseId]`, checked off
    from a new "Exercise checklist" block in Today's Workout (lists every
    exercise in today's routine with its day tag(s), sets×reps note, and
    an expandable notes/media detail). It's keyed by date so it starts
    unchecked again the next time that routine comes around — a deliberate
    choice (confirmed with the user) over storing the flag on the exercise
    template itself, which would have no natural way to reset.

- **Finance page (`finance.html`) rebuilt as a personal finance dashboard.**
  The prior page was a net-worth tracker (4 fixed asset categories, a
  Subscriptions list, a Wishlist, and Incoming Orders) — not a
  transactions/budgets/dashboard. Per an explicit decision with the user,
  Wishlist and Incoming Orders (out of the new scope) were **folded into**
  the new model rather than kept as separate tabs or dropped outright:
  - **Accounts** = the existing net-worth engine, kept verbatim (same 4
    categories — bank/stocks/crypto/other — same `nw:*` keys, same
    activity log, same CHF-base + live-exchange-rate + `entered_amount`/
    `entered_currency` display pattern). Nothing about how balances are
    edited changed; the tab was just relabeled "Accounts" and the net-worth
    line chart + allocation donut were moved out into the new Trends tab
    (same element ids, same `renderNetWorthChart`/`renderAllocationDonut`
    functions — physically relocated, not reimplemented).
  - **Transactions** (new, `finance:transactions`) — add/edit income and
    expense entries (date, amount, category, optional linked account,
    note), filterable by month/category/account. A transaction dated in
    the future is automatically "planned" (shows under a Planned/Upcoming
    list, visually reusing the old `.ord-card` styling) until a "Mark
    arrived" action realizes it — this is exactly the old Incoming
    Orders → deduct-chooser flow, reframed. **Incoming Orders were
    migrated in**: each existing order became a transaction (already-
    deducted orders → realized/historical record only, not re-deducted;
    still-pending orders → planned, so they keep showing until marked
    arrived). Editing a transaction is "prefill the add form + remove the
    original" rather than a separate inline-edit form — one code path for
    add and edit.
  - **Budgets** (new, `finance:budgets`) — one monthly CHF limit per
    expense category, progress bar vs. this month's realized spend in
    that category, over-budget note in the danger color once spend
    exceeds the limit.
  - **Trends** (new) = the relocated net-worth chart/donut, **plus** a new
    spending-by-category donut (this month, reusing the exact
    `donutArcPath` arc-slice function already used for the allocation
    donut) and a new income-vs-expenses bar chart (last 6 months, plain
    inline SVG-free divs, no charting library — consistent with "no build
    step" for this repo).
  - **Recurring bills** = the existing Subscriptions feature, kept intact
    (same auto-deduct-on-renewal logic, same `subs` key), relabeled from
    "Subs"/"Active Subscriptions" to "Bills"/"Recurring Bills", with a new
    "Upcoming" mini-list at the top (next 5 renewals, reusing the existing
    `nextRenewalDate` helper). Auto-deducted renewals now **also** push a
    `finance:transactions` record (category "Bills & utilities",
    `source: 'sub'`) so recurring bills flow into Budgets/Trends without
    double-entry.
  - **Notes** (new) = a freeform autosaved textarea (`finance:notes`)
    **plus** Savings Goals, which is the old Wishlist migrated in verbatim
    (same %-of-net-worth hero, same add/delete UX, same `.wish-*` CSS
    classes reused under new ids) — storage moved from `wishlist` to
    `finance:goals`.
  - **Summary tiles** (net worth, this-month income, this-month spend,
    savings rate) sit above the tab bar's sections, always visible
    regardless of active tab, computed from realized (non-planned)
    transactions for the current calendar month.
  - **Palette**: the user's request mentioned a "dark-red/pink palette"
    for the Trends charts; per §6 above, no such palette exists anywhere
    in this codebase. Reused this file's actual existing tokens instead
    (`--accent` coral, `--success`/`--warning`/`--danger` green/amber/red,
    plus the same fixed category hex set already used for NW slices/
    `ord-card` borders) rather than inventing a new one.
  - **Migration is one-time and non-destructive**: guarded by
    `finance:migrated_v2`, it reads `incoming_orders`/`wishlist` once and
    writes `finance:transactions`/`finance:goals` — the original
    `incoming_orders`/`wishlist` keys (and their `syncedKeys` entries) are
    left in place afterward, orphaned but untouched, same treatment as
    other removed-feature data elsewhere in this file (the `health` row,
    `po_coach_weights`/`po_coach_photos`).
  - `initCloudSync`'s config gained `'finance:'` in `syncedPrefixes`
    (alongside the existing `'nw:'`) so every new `finance:*` key syncs
    automatically — no new sync mechanism, same call, same `appKey`.
  - A real ordering bug surfaced and was fixed during this rebuild: a
    `const` (category-icon lookup) was initially declared physically
    inside the new Transactions code, but `renderSubs()`'s very first
    call — which now cascades into the new transactions-refresh path —
    runs earlier in the script than that point, which would have thrown a
    temporal-dead-zone `ReferenceError` on load. Fixed by hoisting that
    `const` next to the other early-declared lookup tables, mirroring
    this file's own pre-existing `ORD_FROM_META` pattern/comment for the
    same reason.

- **Media page (`entertainment.html`) rebuilt as a unified tracker over
  four independent galleries.** The prior page was one flat card list with
  a single freeform, user-extensible category tag (`ent:cards` +
  `ent:categories`, defaults `['Music', 'Horror Stories', 'Podcasts']`).
  The new page replaces that with four separate galleries, each with its
  own storage key and its own **fixed** status vocabulary (no more
  "+ New category"):
  - **Podcasts** (`media:podcasts`) — statuses Learning / Photography ·
    Videography / True Crime, **plus** a second filter dimension,
    Backlog/Finished, unique to this gallery only (confirmed with the
    user — the other three galleries have no completion-state filter).
  - **Stories** (`media:stories`) — Horror Stories / Spicy Stories ·
    Immersive Experience.
  - **Entertainment** (`media:entertainment`) — Funny / Gaming / Scary
    Videos / Vlog-Type / Other / Favorite Videos.
  - **Playlists** (`media:playlists`) — Chill / Binaural Beats / Dark ·
    Gothic · Horror · Romance / EDM · Electronic / Fantasy / Metal / ASMR.
  - A new top-level gallery switcher (`.chip-gallery`, pink-accent active
    state) sits above the existing per-gallery status-filter chip row
    (unchanged `.chip` component); the "+ Add" button and its modal are
    shared across all four, scoped to whichever gallery tab is active.
  - **Every card, in every gallery, gained six fields**: author/creator
    (auto-filled from YouTube's oEmbed `author_name` when available, same
    as title/thumbnail already were), a free-text description, a free-text
    "length" note, a free-text "song/episode count" note, an optional 1–5
    star rating, and a general notes field — all editable from the same
    add/edit modal, all stored directly on the card object.
  - **Cover art** unchanged: still auto-fetches a thumbnail from Spotify/
    YouTube oEmbed on paste, still supports pasting an image URL or
    uploading a file (same `compressImageDataUrl` downscale-to-480px
    pattern as before) — "auto-generated cover" in the request refers to
    this existing auto-fetch-or-fallback-icon behavior, not a new
    generated-placeholder-image system.
  - **Palette exception, done deliberately and explicitly for this page
    only**: thin tile borders now use a low-opacity tint of the existing
    `--bad` red token (`--tile-border`), and card-hover uses one genuinely
    new color, `--pink-accent: #ff4fa3`, plus the same pink on the new
    gallery-switcher's active state. This is the one place in the app with
    a color not derived from an existing token, because the request was a
    specific, literal design instruction ("thin red borders on tiles, pink
    accent on hover"), not the generic "themed to the dark-red/pink
    palette" boilerplate seen (and deliberately not followed) in the
    Finance rebuild request — see §6.
  - **One-time, non-destructive migration** (guarded by
    `media:migrated_v1`): every old `ent:cards` entry is keyword-matched
    on its old freeform `category` string into one of the four new
    galleries (e.g. "horror" → Stories/Horror Stories, "podcast" →
    Podcasts/Learning, "chill"/"edm"/"asmr"/etc. → Playlists with a
    best-guess status) — anything unrecognized lands in
    Entertainment → Other (an explicit catch-all status), with a note on
    the card recording its original category so mis-filed items are easy
    to find and move by hand. `ent:cards`/`ent:categories` are left in
    place afterward, orphaned but untouched, same treatment as other
    removed-feature data elsewhere in this file.
  - `initCloudSync`'s config gained a `'media:'` entry in
    `syncedPrefixes` (`appKey` stays `'entertainment'`, unchanged) so all
    four new gallery keys plus the active-gallery/migration-flag keys
    sync automatically — no new sync mechanism, same call site.

- **Projects page (`projects.html`) gained full task CRUD + per-project
  visualizations.** The prior page was project list/gallery + a per-project
  full-page view (title/cover/status/group/tags/freeform content "blocks")
  with **no task concept at all** — this rebuild adds one on top, without
  touching the existing gallery/filter/search/status/group/tag/block code
  (verified via diff: every change is a pure addition except one migration
  comment line).
  - **Tasks live on the project itself** — `card.tasks[]`, no new
    top-level storage key, so they already ride along with `proj:cards`
    through the existing sync wiring untouched. Each task: `title`,
    `description`, `status` (`todo`/`in-progress`/`done`), `dueDate`,
    `scheduledDate`, `estimate` (hours), plus a `completedAt` date stamped
    automatically the moment status flips to `done` (and cleared if it
    flips back) — this stamp is what every visualization below reads from.
  - **Quick-add** is a plain text input at the top of the Tasks section on
    the project page — type a title, hit Enter, done; no modal. Full
    edit (description/status/dates/estimate) opens a proper modal
    (`#taskModalBg`) — the **first real `.modal-bg`/`.modal` element this
    file has ever had; it previously only used the full-page
    `.project-page-bg` overlay pattern, so the base modal CSS didn't
    exist yet and had to be added (copied from entertainment.html's
    established recipe). This incidentally makes CLAUDE.md's existing
    §3 claim that projects.html already used `.modal-bg`/`.modal` become
    true for the first time — that line was stale/aspirational before.
  - **Up Next** = non-done tasks sorted by scheduled-then-due date.
    **Completed** = done tasks grouped by completion month, newest first.
  - **Contribution grid**: GitHub-style, last 17 weeks, columns = weeks
    (Sunday-aligned so full columns render correctly even mid-week),
    colored by how many tasks completed that day.
  - **Velocity chart**: tasks completed per month, last 6 months, plain
    div bars (no charting library, consistent with "no build step").
  - **Burndown chart**: needs a Start date and Deadline (two new fields
    on the project, under a new "Timeline" section) — plots an ideal
    straight-line pace (current total task count at start → 0 at
    deadline) against the actual remaining-tasks curve computed from real
    `completedAt` dates, drawn only up to today. Total task count is
    current scope, not historical — there's no scope-change log, so this
    is a deliberate simplification, not a bug.
  - A small task-progress fraction (e.g. "3/10 tasks") was added to each
    project's gallery card face as a low-cost "at a glance" addition.
  - **AI planner explicitly skipped**, per the request's own instruction
    to only build it if a Claude/LLM API key is already wired up. One
    exists in spirit — `index.html`'s "✨ Polish" feature already has the
    exact `fetch('https://api.anthropic.com/v1/messages', ...)` pattern
    — but `ANTHROPIC_API_KEY` is currently an empty placeholder there, so
    no key is actually active anywhere in this app. Not built.

- **New page: `braindump.html` ("Brain Dump"), added to match a reference
  screenshot of a light-themed Notion template.** Genuinely new file, new
  nav pill (`BRAIN DUMP` → `braindump.html`, added to `topbar.js`'s
  injected pill list — the only edit made to `topbar.js`), new sync key
  (`appKey: 'braindump'`, `syncedKeys: ['braindump:entries']`, wired via
  the standard shared `initCloudSync` — same call pattern as finance/
  entertainment/projects, nothing new invented).
  - **Data model**: `braindump:entries` — array of
    `{ id, date, thoughts, emotions, createdAt }`. A "Today" entry is
    auto-created (and auto-saved back) on every load if one doesn't
    already exist for the current date, so there's always something to
    write into immediately, matching the original reference photo's
    always-open "Today" toggle.
  - **UI structure**: an expandable "how to use this template" blurb, a
    pill button that reveals a date picker for backfilling a past-dated
    entry (the April 17 2023-style entries in the original reference
    photo), and a list of collapsible per-date toggles (newest first)
    each containing two callout-style blocks — Thoughts and Emotions —
    as autosaving `<textarea>`s. Decorative six-dot "drag handle" marks
    (`⠿`) next to each callout on wider viewports are cosmetic only —
    not functional. Entries are deletable (a ✕ that fades in on hover of
    the date row) — not part of either reference photo, but necessary
    for a page that's actually going to accumulate real entries.
  - **Re-themed dark, in a follow-up request, to match a second reference
    photo** (a mystical "Awaken your Soul" landing page — deep forest-
    green/black background, gold/copper accents, elegant serif italic
    display type, a circular sunburst emblem). Only the CSS and the
    banner's markup changed for this — all the JS logic (entry CRUD,
    autosave, migration-free data model) was untouched. Concretely:
    - `:root` tokens replaced wholesale: cream/off-white tokens →
      `--bd-bg-deep`/`--bd-bg` (near-black-green), `--bd-gold` (the one
      accent color, used for titles, labels, borders, and buttons),
      warm cream `--bd-text` for body copy on the dark background.
    - The page background is a fixed radial-gradient vignette
      (`body::before`) suggesting a dark forest, since there's no actual
      photo asset available to drop in — the mood/palette was recreated
      in CSS rather than an image being fabricated or hotlinked.
    - The banner gained a CSS-only sunburst emblem (`.bd-emblem`): a
      `repeating-conic-gradient` ring of thin gold rays behind a bordered
      circle, mimicking the reference photo's circular rayed monogram.
      The old dashed-circle "doodles" and 🚮 banner icon were removed
      (they were specific to the first, Notion-themed pass).
    - Small tracked-out gold caps subtext ("Daily Ritual / Mental
      Clarity / Emotional Release") replaced the old squiggle row,
      echoing the reference photo's "ENERGY HEALING / SPIRITUAL
      ACTIVATION / INTUITIVE GUIDANCE" subheading style.
    - Added a gold-outlined pill CTA in the banner ("Begin Today's
      Dump") that smooth-scrolls to and focuses today's entry — a
      functional echo of the reference photo's "BEGIN YOUR JOURNEY"
      button, not just decorative.
    - A thin sunburst-line `.bd-divider` was added above the content
      heading as a section-break ornament, echoing the compass/radiating-
      line motifs used between sections in the reference photo.

- **Fitness Studio (`gym.html`) color grading re-matched to a reference
  photo** — a dark, desaturated fan-page hero with a blood-red glow
  rising from the bottom edge into near-black/gray at the top, plus a
  thin red circular arc accent on one side. Explicitly "abstract, not
  the photo's actual imagery" per the request, so this is a CSS-only
  reinterpretation, not an image asset: no HTML/JS changed, only
  `:root` tokens and the values that referenced them.
  - New tokens: `--crimson` (deep) / `--crimson-bright` (lighter,
    used for gradient tops) / `--crimson-text` (near-white, for
    legibility on the crimson gradient).
  - `html, body`'s background gained a bottom-anchored red radial glow
    layered under the existing near-black top gradient — this is the
    "red rising from the bottom" read from the reference photo.
  - Added `body::before` (the same 3px dotted grain-texture technique
    finance.html/entertainment.html/projects.html already use — reused
    verbatim, not reinvented) and `body::after` (a large, mostly
    off-screen circle whose right edge peeks in on the left side of the
    viewport as a thin red arc, `position: fixed` so it reads as page
    chrome rather than scrolling content).
  - Every surface that used the old "white gradient = primary/active"
    look (`.po-btn-primary`, `.po-reps-pill.active`,
    `.po-chart-toggle button.active`, `.po-modal-seg button.active`,
    `.po-tw-done-btn`) was re-graded to the crimson gradient with
    `--crimson-text` instead of near-black text, so the color grading
    reads through the actual UI, not just the backdrop.
  - Left untouched, deliberately: `--good`/`--warn`/`--bad` (still
    green/amber/red-coral — they carry done/warning/danger meaning,
    not brand accent, so recoloring them would have made status colors
    harder to read, not more on-theme), the day-of-week tag palette
    (`--day-*`, unrelated pastel system), and the rest-day/scheduled-day
    indicator colors on the day pill.
  - **Follow-up: `.po-cover` upgraded from a plain gradient band into a
    full "website-like" hero banner**, matching `braindump.html`'s
    banner *structure* (sunburst emblem, serif-italic display title,
    tracked-caps subtext, pill CTA, a radiating-line section divider
    below it) while keeping this page's own red/black color scheme —
    braindump's gold/green tokens were never touched or reused here.
    Concretely: `.po-cover-emblem` (a `repeating-conic-gradient` sunburst
    behind a bordered circle, same CSS technique as braindump's
    `.bd-emblem`, recolored crimson), `.po-cover-title` ("Fitness
    Studio", same italic serif stack as braindump's title, synced from
    `CONFIG.appTitle` at boot alongside the existing `#appTitle`),
    `.po-cover-subtext` ("Progressive Overload / Consistency /
    Discipline", crimson tracked caps — this page's equivalent of
    braindump's "Daily Ritual / Mental Clarity / Emotional Release"),
    and `.po-cover-cta` ("Start Today's Workout", a crimson-outlined
    pill that smooth-scrolls to a new `#todaysWorkoutCard` id on the
    existing Today's Workout card — a functional echo of braindump's
    "Begin Today's Dump" CTA, not just decorative). A `.po-section-divider`
    (same masked-conic-gradient technique as braindump's `.bd-divider`,
    recolored crimson) sits at the top of `.po-shell`, below the cover.
    `.po-shell`'s existing content (day pill, title, cards, etc.) is
    otherwise unchanged and simply continues below it.

- **New page: `study.html` ("Study"), built by combining two reference
  screenshots** — a Notion "Idea Bank" gallery/database (cover-art cards,
  tag chips, a grouped table) and a Notion "Goals" dashboard (collapsible
  grouped list with per-item progress bars). Both reference photos were
  light-themed; per an explicit decision with the user, the page instead
  reuses this app's existing near-black wine / dusty-rose palette (the
  same shared aesthetic already established by `index.html`, `entertainment.html`,
  and `braindump.html` — same `#170a12`/`#0b0509` background gradient, same
  `#e08a9f` accent, same cream button gradient) rather than a new light
  theme, so it reads as part of the dashboard rather than a one-off skin.
  Genuinely new file; new nav pill (`STUDY` → `study.html`, added to
  `topbar.js`'s injected pill list — the only edit made to `topbar.js`,
  no count badge, same as Studio/Finance/Media/Projects); new sync key
  (`appKey: 'study'`, `syncedPrefixes: ['study:']`, wired via the standard
  shared `initCloudSync` — same call pattern as finance/entertainment/
  projects/braindump, nothing new invented).
  - **Data model**: `study:subjects` — array of `{ id, name, icon, createdAt }`
    (user-created, e.g. "📘 Organic Chemistry"). `study:topics` — array of
    `{ id, subjectId, title, category, status, priority, progress, nextStep,
    notes, cover, createdAt }`, where `status` is `not-started`/`in-progress`/
    `done`, `priority` is `Low`/`Medium`/`High`, and `progress` is a manual
    0–100 slider (auto-set to 100 when a topic's status is switched to Done
    from the modal). `study:view` persists which of the two views below was
    last active. All three keys ride the existing `study:` sync prefix, no
    per-key sync wiring needed.
  - **Two toggleable views over the same subjects/topics data** — a
    `chip-view` pair mirrors the gallery-type switcher already used on the
    Media page:
    - **By Subject** (the Goals reference): each subject renders as a
      collapsible group (▼ caret, icon, name, topic count, and an averaged
      progress % rolled up from its topics — not present in the reference
      photo but a natural extension of it) with a "✎" to rename/re-icon or
      delete the subject (cascades to delete its topics, confirmed). Under
      it, one row per topic — a status dot, title, a `.std-bar` progress
      bar + percentage (same `<div>`-with-inline-`width%` bar idiom already
      used for budgets/wishlist/tasks in `finance.html`/`projects.html`,
      not a charting library), and a priority pill. A "Quick-add a topic,
      press Enter…" input sits at the bottom of each group, identical
      interaction to `projects.html`'s task quick-add.
    - **Gallery** (the Idea Bank reference): topics render as
      `.ent-card`/`.ent-cover` cards — literally the same class names/CSS
      as `entertainment.html`'s gallery, copied verbatim per this
      codebase's existing convention of duplicating that component
      per-file rather than importing it. Each card shows an optional cover
      image (paste-a-URL or upload, downscaled via the same
      `compressImageDataUrl` recipe used in `entertainment.html`/
      `projects.html`/`gym.html`) or an icon fallback, a priority badge, a
      status tag + optional category tag, and the same progress bar as the
      list view. Subject and status filter chip rows (reusing `.chip`/
      `.chip-row` verbatim) appear only in this view.
  - Adding a topic requires at least one subject to exist first (a plain
    `alert()` prompts to add one) — there's no "no subject" bucket, since
    every topic belongs to exactly one subject by design.
  - No AI/LLM involved, consistent with the rest of this app (see the
    Projects entry above on `ANTHROPIC_API_KEY` being an inactive
    placeholder).

- **Fitness Studio (`gym.html`) gained a banner photo, a workout timer, and
  an Equipment database.** Purely additive follow-up to the two rebuilds
  above (manual routines/schedule, then the "Fitness Studio" rename) —
  templates (`state.routines[]`) and the weekly Mon–Sun assignment
  (`state.schedule`) already existed and needed no changes; this pass
  added the three genuinely missing pieces. Same `po_coach_v1`/
  `po_coach_workout_done` keys, same inline Supabase sync block
  (`APP_KEY='po-coach'`, `PC_SYNCED_KEYS` untouched) — every new field
  lives inside the already-synced `po_coach_v1` object, so no sync-side
  changes were needed at all.
  - **Banner photo** — a new `.po-banner` upload area sits directly under
    the in-page title (`.po-header`'s `<h1>`), deliberately *not* inside
    the existing crimson-themed `.po-cover` hero (that block is a
    deliberate, signed-off reference-photo match per this file's earlier
    entries and wasn't touched). Empty state is a dashed-border
    click-to-upload placeholder; once set, the photo fills the area
    (`object-fit: cover`) with a hover scrim exposing Change/Remove
    buttons, same interaction convention as `projects.html`/
    `entertainment.html`'s cover-photo upload. Stored as
    `state.bannerPhoto` (dataURL or `null`), compressed via this file's
    own pre-existing `compressImageDataUrl` — called as `(dataUrl, 1000,
    0.8)` rather than the 640/0.75 preset already used here for exercise
    media, since a full-bleed wide hero needs a larger max dimension than
    a reference photo thumbnail.
  - **Equipment database** — a new flat CRUD list, `state.equipment[]`
    (`{id, name, type, weight, unit, notes}`), rendered as its own card
    (reusing `.rt-card`/`.rt-card-main`/`.rt-card-actions` verbatim from
    the Routines card, no new row component invented) with an add/edit
    modal (`#equipModalBg`, the same `.po-modal-bg`/`.po-modal`
    open(mode,item)/close()/single-Save-button pattern every other modal
    in this file already uses). Exercises gained `equipmentIds: []`
    (defaulted via `normalizeExercise()`), edited from a new multi-select
    chip list (`renderEquipChipList()`, shared between the quick "Add
    exercise" modal and the inline per-exercise rows in the routine
    editor — both entry points, matching how media/notes were already
    duplicated across those two places). Deleting an equipment item
    warns how many exercises reference it (mirrors finance.html's
    linked-transaction-count warning) then **strips the id from those
    exercises' `equipmentIds`** rather than deleting them — the same
    null-out-the-reference precedent `deleteRoutine()` already set for
    `state.schedule`. "Gear needed today" is derived, not stored: a chip
    row on Today's Workout and a small tag per exercise both resolve
    `equipmentIds` against `state.equipment` fresh on every render.
  - **Workout timer** — a new icon button next to the settings gear opens
    `#timerModalBg`, a three-mode timer (Countdown / Stopwatch / Interval
    rounds) sharing one big digit display and Start/Pause/Reset controls.
    This is genuinely new code in every sense: there was no timer/interval
    UI anywhere in this file before, and no audio/sound utility anywhere
    in the repo (confirmed by a repo-wide grep) — the beep is synthesized
    with the Web Audio API (`AudioContext` + `OscillatorNode`), not a
    bundled asset, keeping this repo's zero-binary-assets/no-build-step
    convention intact. Timing uses wall-clock timestamp diffs
    (`Date.now()`), not a naive `setInterval` tick counter, so a
    multi-minute interval session doesn't drift, and phase/round for
    Interval mode is recomputed fresh from total elapsed time on every
    tick rather than tracked incrementally, so pause/resume can never
    desync from the true elapsed time. Only the last-used settings persist
    (`state.timerSettings`) — the running timer itself is intentionally
    ephemeral and resets on modal close or reload, since this is a
    mid-workout tool, not a saved log. A quick-launch clock button next to
    "Log set" opens the timer pre-set to Countdown at the last-used rest
    duration, tying it into the existing set-logging flow.
  - **Data preserved**: purely additive, no `migrated_vN` flag needed
    (unlike the Finance/Media rebuilds, which actually remapped old data
    shapes) — `state.equipment` (`[]`), `state.bannerPhoto` (`null`),
    `state.timerSettings`, and `exercise.equipmentIds` (`[]`) all default
    safely for existing users via `normalize()`/`normalizeExercise()`.
    Every pre-existing field (`routines`, `schedule`, `logs`,
    `workoutNotes`, `exerciseDone`, `gyms`, `units`) and
    `po_coach_workout_done` are untouched.

- **Fitness Studio (`gym.html`) reorganized around a This Week / Templates
  / Equipment / Timer tab shell.** Follow-up to the banner/equipment/timer
  entry above — those features already existed as inline cards and a
  modal; this pass added a lightweight secondary nav directly under the
  banner (`.po-tabs`/`.po-tab`, same segmented-control recipe as
  `.po-modal-seg`, just full-width) and moved the *existing* real content
  into it rather than building placeholders, since gutting working
  features into "coming soon" panels would have been a regression:
  - **This Week** = the existing `#todaysWorkoutCard` (Today's Workout)
    card, now also tagged `po-tab-panel` / `data-panel="week"` and active
    by default — no content changes.
  - **Templates** = the existing Routines card, same tag/`data-panel`
    treatment, no content changes.
  - **Equipment** = the existing Equipment card, same treatment.
  - **Timer** — converted from a `.po-modal-bg` overlay into an inline
    `.po-tab-panel` card (`#timerPanel`) sitting right after Equipment in
    the DOM. All of its internals (mode segmented control, config
    inputs, display, controls, laps) are the exact same elements/ids that
    lived inside the old modal, just re-parented — none of the timer JS
    (`timerTick`, `computeIntervalPhase`, `playBeep`, etc.) changed. The
    header clock icon (`#timerBtn`) and the quick-launch button next to
    Log Set (`#quickTimerBtn`) now call `switchTab('timer')` instead of
    opening a modal; the quick-launch one still resets to Countdown at
    the last-used rest duration first, matching its old modal behavior.
    `#timerModalClose` and the modal backdrop-click-to-close handler were
    removed since there's no overlay left to close.
  - **Tab state is reflected in the URL hash** (`#week`/`#templates`/
    `#equipment`/`#timer`) via `history.replaceState` (not
    `location.hash =`, so switching tabs doesn't pile up browser-history
    entries) — this repo has no client-side router (see §1), so this is
    a small hand-rolled hash sync, not a new routing system. A
    `hashchange` listener and an initial `switchTab(location.hash ...)`
    call at boot make a URL like `gym.html#equipment` deep-link straight
    to that tab on load.
  - **History / Progress / Compare sessions were deliberately left
    outside the tab system**, exactly where they already were, below the
    four tab panels — confirmed with the user rather than assumed, since
    they weren't named in the new tab list and forcing them into one of
    the four tabs would have changed how they're found today.
  - No sync/data changes of any kind — this is a pure DOM/CSS/JS
    reorganization of already-synced state; `po_coach_v1`,
    `po_coach_workout_done`, and the inline Supabase block are untouched.

- **Equipment tab rebuilt into a full home-gym database** (photo gallery,
  weights, quantity, search/filter), replacing the simpler flat-list
  version from the entry above. Built before Templates in this pass since
  templates/exercises reference equipment by id.
  - **Data shape changed**: each `state.equipment[]` item dropped its old
    single `weight`/per-item `unit` pair in favor of
    `{quantity, weightMode: 'discrete'|'range', weights: number[],
    weightMin, weightMax, weightStep, photo}`. The per-item `unit` field
    is gone entirely — weights are now plain numbers labeled with the
    page's single global `unit()` at render time, the same convention
    every other weight in this file already follows (exercise
    `startWeight`/`step`/logged sets are never converted when the global
    kg/lb toggle flips, they're just relabeled) — "respect the global
    unit via the shared formatter" meant reusing that existing `unit()`
    function, not adding a second parallel per-item unit system.
    `normalizeEquipment()` (new, alongside `normalizeExercise()`) migrates
    a legacy single `weight` value into `weights: [weight]` so equipment
    added under the old shape isn't lost, then deletes the old
    `weight`/`unit` keys.
  - **Discrete vs. range weights**: a `.po-modal-seg` toggle in the
    add/edit modal switches between a comma-separated free-text list
    ("5, 10, 15, 20") and a min/max/step trio (reusing the `.rex-grid`
    3-column input layout already used for the Timer's interval config).
    `formatEquipmentWeights()` renders either shape through the shared
    `unit()` formatter, e.g. "5, 10, 15, 20kg" or "20–140kg (in 2.5kg
    steps)".
  - **Photo**: reuses this file's own `compressImageDataUrl` — the same
    function and general upload/preview/remove mechanism the banner
    uses — called with the 480px/0.82 "cover" preset (this app's
    established constants for a small gallery thumbnail, from
    projects.html/entertainment.html) rather than the banner's wider
    1000px preset, since an equipment photo is a small square card image,
    not a full-bleed hero.
  - **List UI upgraded from the flat `.rt-card` rows to a photo gallery
    grid** — `.ent-grid`/`.ent-card`/`.ent-cover`, the exact same shell
    class names entertainment.html/study.html already share for
    photo-backed gallery cards (per §3), recolored to this file's
    crimson accent rather than inventing a fifth card component. Each
    card shows the photo (or a type emoji fallback), a quantity badge
    when >1, name, and `type · weights` meta line.
  - **Search + type filter**: a text input (`#equipSearchInput`, matches
    on name, case-insensitive) plus an "All" + one chip per fixed type
    (`.equip-type-chip`, same toggle-pill recipe as this file's own
    `.po-tab`/`.equip-chip`) — both re-run `renderEquipmentList()` with
    the current query/filter applied client-side, no new storage.
  - Delete-with-reference-count warning, the equipment↔exercise chip
    linking, and the "gear needed today" chips from the entry above are
    unchanged — they only ever read `item.name`/`item.id`, not the
    weight/quantity/photo fields that changed shape here.

- **Templates tab rebuilt into fully-managed, reorderable workout
  templates**, referencing the Equipment database (built in the entry
  above, ahead of this one, since exercises now link to equipment by id).
  `state.routines[]` and its `exercises[]` already existed as the
  underlying data (see the original "manual routines/schedule" rebuild
  entry) — this pass extends both shapes rather than replacing them.
  - **Routine object gained `category`/`color`**, both defaulted to `''`
    for existing routines via a new `normalizeRoutine()`. `color` is one
    of the same 7 `--day-*` keys already defined in `:root` for weekday
    tags (`TEMPLATE_COLORS`) — reused as a generic 7-swatch accent picker
    rather than inventing new colors (CLAUDE.md DO NOT MODIFY rule #2).
    The Templates list card now shows a `category · exercise count ·
    gym · estimated duration` meta line and a 3px color-coded left
    border (`card.style.borderLeftColor`), plus a new "👁 View" icon
    button alongside the existing Edit/Delete.
  - **Estimated duration is computed, not stored** (`estimateTemplateDuration()`
    — sums `sets × (a fixed ~40s assumed working time + that exercise's
    restSec)` across all exercises) — a documented simplification, this
    app tracks no real per-set timing data, same spirit as the burndown
    chart's fixed-scope assumption in projects.html.
  - **Exercise object gained `sets` (default 3) and `restSec` (default
    60)**, both defaulted via `normalizeExercise()`. "Reps" intentionally
    still maps to the pre-existing `repMin`/`repMax` range (used by the
    prescription engine in `getRx()`/This Week's stats/sparkline/progress
    chart) rather than adding a redundant separate field — replacing that
    range would have broken the progression-suggestion system this file
    already had working.
  - **Equipment linking changed from multi-select to a single picker**:
    `ex.equipmentIds[]` (an array, from the entry above) is now
    `ex.equipmentId` (a single id or `null`), matching the spec's "an
    equipment picker (dropdown)... or none/bodyweight." `normalizeExercise()`
    migrates the first id from any legacy array once, then drops the old
    key. `renderEquipChipList()` (the old multi-select chip renderer) and
    its `.equip-chip`/`.equip-chip-list` CSS were deleted outright as
    dead code once both of its call sites were replaced — this is a
    fresh removal by the same session that added it, not an instance of
    the DO-NOT-MODIFY dead-code precedent (`pushWaterMergedToSupabase`
    etc.), which only protects code some *other* pass chose to leave
    behind. `getEquipment(ex.equipmentId)`'s weights are surfaced as a
    live "Available: …" hint (`renderEquipWeightHint()`, reusing
    `formatEquipmentWeights()`) under the target-weight field in both
    exercise-editing surfaces below, updating on selection change.
  - **Both places exercises are edited** — the quick "Add exercise" modal
    (`#exModalBg`, opened from This Week) and the inline `.rex-row`s
    inside the Template editor (`#routineModalBg`) — gained the same new
    Equipment `<select>` (`renderEquipSelect()`, shared), weight hint,
    and Sets/Rest number inputs, keeping the two entry points in sync the
    same way media/notes were already kept in sync across both.
  - **Reorder via up/down arrows** (not drag) on each `.rex-row` in the
    Template editor — swaps adjacent entries in the in-memory
    `routineDraftExercises` draft array and re-renders; only committed to
    the routine on Save, same as every other edit in that draft array.
  - **Read view** (`#routineViewModalBg`) — a new, separate, non-editable
    modal listing a template's exercises cleanly (name, sets × reps,
    target weight or "Bodyweight", rest, linked equipment name, notes)
    for reference mid-workout, opened via the card's new 👁 button.
  - **Bugfix found and fixed while verifying this feature, unrelated to
    Templates itself**: `renderStats()` only re-added `id="oneRmUnit"` to
    the "no logs yet" branch of its three `$('oneRm').innerHTML =` writes
    — the other two (bodyweight, and normal-with-logs) silently dropped
    the id. Once any set was logged, the id was gone for good, and the
    next `renderAll()` → `renderForm()` → `$('oneRmUnit').textContent = …`
    threw, silently aborting the rest of that render pass (routine list,
    equipment list, charts, etc. would stop refreshing after any logged
    set). Fixed by keeping the id on all three branches. Pre-existing,
    not introduced by this session — caught because verifying Templates
    involved actually logging sets against a template's exercises.
  - **Testing note**: this file's Supabase sync uses real, hardcoded
    project credentials (by design, so cloud sync works out of the box —
    see §2/§4). Automated browser-based verification of this feature
    exercised that real code path and pushed test data (equipment/template
    test entries, a test logged set) to the live `po-coach` row before
    this was caught; the user opted to clean that up manually rather than
    have it scripted. Any future automated verification of this page
    should block `*.supabase.co` at the network layer first (e.g. CDP's
    `Network.setBlockedURLs`) so testing stays local-only.

- **This Week tab rebuilt into an editable weekly grid**, replacing the old
  day-pill-opens-a-single-select-per-day schedule modal (`openScheduleModal`/
  `#schModalBg`, one routine id per weekday) with a richer, multi-template
  weekly view. Deleted the superseded modal/JS/CSS outright rather than
  leaving it as unreachable dead code — the same call this project already
  made converting the Timer modal into an inline tab panel (see that
  changelog entry above): both are a same-session supersession of an older
  mechanism by a richer one, not another pass's orphaned feature, which is
  what the DO-NOT-MODIFY dead-code precedent (`pushWaterMergedToSupabase`
  etc.) actually protects.
  - **Data model changed**: `state.schedule[day]` was a single
    `routineId|null`; it's now `{ routineIds: [...], label: '' }` so a day
    can carry zero (Rest), one, or several templates, plus an optional
    freeform label (e.g. "Upper A"). `normalize()` migrates the legacy
    string/null shape in place — existing single-routine schedules (and
    `CONFIG.defaultSchedule`'s string values) come through unchanged as a
    one-item `routineIds` array. `todaysRoutine()` (used throughout the
    existing single-session logging flow — `routineSelect`, Log a set,
    stats, etc.) now returns the day's *first* assigned template, so that
    flow needed no further changes. New resolvers: `daySchedule(key)`,
    `dayRoutines(key)`, and `equipmentForDay(key)` — the last one is the
    actual "routine reads the Equipment DB through the templates'
    exercises" connection the request asked for, unioning `equipmentId`
    across every exercise in every template assigned to that day.
    `scheduledDaysForRoutine()` and `deleteRoutine()`'s schedule-cleanup
    loop were updated for the array shape (deleting a routine now splices
    its id out of every day's `routineIds` instead of nulling a scalar).
  - **This Week tab** (`#weekGridCard`, a second `.po-tab-panel` sharing
    `data-panel="week"` with the pre-existing Today's Workout card — both
    toggle together under `switchTab()`, exactly like any other panel)
    lists Mon–Sun (`WEEKDAY_ORDER`, this file's existing Mon-first display
    order) as `.week-row`s: a per-day label `<input>` (autosaves on
    change), assigned-template chips (or a dashed "Rest" chip), and 👁/✎
    icon buttons reusing the `.rt-card-actions`/`.po-btn-icon` look
    already established for Routine cards.
  - **Day edit modal** (`#dayEditModalBg`) — assign templates via a
    "+ Add a template…" `<select>` (only offers templates not already on
    that day), reorder assigned templates with the same up/down
    `.rex-reorder` arrow-button pattern already used for exercise
    reordering in the Template editor, remove one via ✕, edit the day's
    label, or wipe the day back to Rest with "Clear (Rest)". Nothing
    commits until Save (same draft-then-save convention as every other
    modal here).
  - **Day view modal** (`#dayViewModalBg`) — read-only: one block per
    assigned template (name + a "View template" link that opens the
    existing `#routineViewModalBg` read view via `openRoutineViewModal()`,
    reused verbatim rather than reimplemented) listing its exercises via
    the same `.rt-view-row` markup the template read view already uses,
    plus an "Equipment needed today" panel sourced live from
    `equipmentForDay()` — each item shown with its formatted available
    weights via the existing `formatEquipmentWeights()`. A "Start Timer"
    button closes the modal and calls `switchTab('timer')`.
  - **Day pill** (top of page) no longer opens a modal — its title changed
    to "Tap to open This Week" and its click now calls `switchTab('week')`
    (plus scrolls today's `.week-row` into view), matching how the header
    clock icon and quick-launch timer button already just switch tabs
    instead of opening an overlay. `renderDayPill()` was updated to join
    multiple assigned template names with "+" and prefix the optional
    label, instead of assuming a single routine.
  - **Verified via headless Edge (CDP, `*.supabase.co` network-blocked
    per the testing note above)**: assigning multiple templates to a day,
    reordering them, labeling a day, clearing a day to Rest, opening the
    Day view (exercise lists from both templates, equipment panel pulling
    a real linked barbell's weight range), jumping to a template's read
    view from there, Start Timer switching tabs, deleting a routine
    auto-clearing the days it was scheduled on, and the day pill
    round-tripping into the This Week tab — all confirmed with no
    JS console errors and no unwanted network calls.

- **Timer tab completed: presets, gesture-safe audio, and a reusable
  launch point wired into This Week's Day view.** The Timer panel itself
  (countdown/stopwatch/interval, timestamp-based accuracy, synthesized
  beeps) already existed from the banner/equipment/timer rebuild — this
  pass added the pieces the request was actually missing, plus made
  starting the timer a single reusable entry point instead of three
  separate ad hoc click handlers.
  - **TimerPresets** (`state.timerPresets[]`, `{id, name, mode,
    countdownSec, workSec, restSec, rounds}`, defaulted to `[]` in
    `normalize()`) — a new Presets row in the Timer panel (`#timerPresetSelect`
    + Load/Delete icon buttons + "+ Save current as preset") lets you name
    and store the current mode/config (`saveCurrentAsPreset()`, a
    `prompt()` for the name, same low-ceremony pattern this file already
    uses for e.g. renaming a gym) and reload it later
    (`loadTimerPreset()` sets every input, switches mode, and persists it
    as the new last-used settings — same as manually reconfiguring).
    Deleting warns via `confirm()` like every other destructive action
    here. Rides the existing `po_coach_v1` sync blob, no new sync key.
  - **Audio now initializes from the Start-press gesture, not lazily
    inside a `requestAnimationFrame` callback.** Browsers require an
    `AudioContext` to be created/resumed synchronously within a
    user-gesture call stack; the previous lazy-create-on-first-`playBeep()`
    could get created from inside a RAF tick instead, which some browsers
    treat as not a gesture and leave `suspended`. New `ensureAudio()` is
    called first thing when Start is pressed (not on Pause), creates the
    context if needed and explicitly `resume()`s it, and swallows any
    throw (unsupported/blocked audio) by leaving `audioCtx` null —
    `playBeep()` is now a no-op whenever that's the case, so the timer
    itself keeps working with no sound rather than erroring.
  - **Visual cue at zero**: `timerFinish()` (fires for both a countdown
    reaching 0:00 and an interval session completing its last round) now
    also toggles a `.flash` class on the digit display (a brief
    color-pulse `@keyframes` animation using `--crimson-bright`, this
    file's existing accent) alongside the existing beep — "clear visual +
    audio cue at zero." `resetTimer()` clears the class so a fresh run
    doesn't inherit it.
  - **`launchTimer(opts)`** — the "reusable component" the request asked
    for: prefill the Timer's inputs (from `state.timerSettings`, or
    `opts.countdownSec` for a one-off override without touching the saved
    default), pick a mode, and switch to the Timer tab. Every timer
    entry point in the app now funnels through this one function instead
    of each hand-rolling its own prefill/switch logic:
    - The header clock icon still just `switchTab('timer')` verbatim
      (deliberately no reset — it's "go look at whatever's running").
    - `quickTimerBtn` (next to Log Set) now calls `launchTimer({mode:
      'countdown'})` — same last-used-duration behavior as before, just
      routed through the shared function.
    - Day view's "Start Timer" button now calls `launchTimer({})` instead
      of a raw `switchTab('timer')` — same effect (last-used settings),
      consistent entry point.
    - **New**: a ⏱ button was added next to every individual exercise in
      three places — the Today's Workout exercise checklist
      (`.exchk-timer-btn`), This Week's Day view exercise rows, and the
      standalone template read view (`#routineViewModalBg`) — each calling
      `launchTimer({mode: 'countdown', countdownSec: ex.restSec})`, i.e.
      a rest timer prefilled straight from that exercise's own configured
      rest period. This is the actual "a routine day / exercise can
      launch a rest-timer prefilled from that exercise's restSeconds"
      connection the request asked for, and it's what "wires the Day
      view's start-timer hooks into this timer" in practice — the Day
      view's per-exercise buttons close `#dayViewModalBg` before
      launching (same as the template read view's button closes
      `#routineViewModalBg`), so the transition to the Timer tab doesn't
      leave a stale modal open behind it.
  - Reused `.exchk-timer-btn` (new, small icon-button CSS matching the
    existing `.exchk-expand` look) as the one visual/markup pattern for
    all three per-exercise buttons above, and added `.rt-view-row-top`
    (a flex header row) to `.rt-view-row` so the exercise name/meta and
    the new timer button sit side by side in both the Day view and the
    template read view, which already shared that row markup.
  - No changes to `sync.js`/the inline Supabase block/`PC_SYNCED_KEYS` —
    `timerPresets` and every timer field already ride inside the
    already-synced `po_coach_v1` object.

- **Projects and Study tabs removed.** Deleted `projects.html` (Projects)
  and `study.html` (Study) entirely, along with their `PROJECTS`/`STUDY`
  nav pills in `topbar.js`'s injected pill list — the only edit made to
  `topbar.js`, same scope as every other nav-pill change in this file's
  history. Same treatment as the Stack/Water removal above:
  - The Supabase `app_state` rows under `key = 'projects'` and
    `key = 'study'` were left alone in the database — they're now
    orphaned, not cleaned up. §4's sync table was updated to match.
  - `sync.js` itself was untouched (it's a generic helper with no
    per-page config baked in) — only the two `initCloudSync(...)` call
    sites inside `projects.html`/`study.html` went away along with the
    files themselves.
  - `topbar.js`'s `MODAL_SELECTORS` array still lists `.project-page-bg`
    (the full-page overlay `projects.html` used for its per-project view)
    — left in place as unreachable dead code rather than deleted, since
    removing it wasn't explicitly asked for, the same call made for
    `pushWaterMergedToSupabase` and the `.wt-overlay`/`.wt-viewer`/
    `.wt-cam` selectors in the Stack/Water and Gym-rebuild entries above.
  - `README.md`'s file table was updated to drop the `projects.html` row
    (it never listed `study.html`, so no change needed there).
  - Nothing else in the app referenced `proj:*`/`study:*` localStorage
    keys or the `projects`/`study` Supabase rows, so no other page needed
    changes. Scattered code comments elsewhere in the repo (e.g. in
    `nutrition.html`, `index.html`, `braindump.html`) that cite
    `projects.html`/`study.html` as the origin of a copied CSS/JS pattern
    were left as-is — they're historical attribution notes about where a
    pattern was first established, not references to files that need to
    keep existing.

- **Main page (`index.html`) Overview tab gained organizable, multi-section
  notes.** Note: this file has grown a large "Main" rebuild — a subnav of
  Overview / Life Areas / Goals / Tasks / Habits & Routines / Businesses /
  Self-Discovery tabs (`.at-tabs`/`.at-tabpanel`, `main:*` localStorage
  keys) — that predates this changelog's coverage of `index.html` further
  above; this entry only covers the Notes feature, not that whole rebuild.
  - First pass added a single freeform, autosaved textarea
    (`main:overviewNotes`, a plain string) below the Overview panel's
    placeholder content, following the existing `.at-textarea` /
    `storeGet`/`storeSet` convention already used for business notes.
  - Follow-up request asked for a button to generate more of the same
    kind of section, and for all sections to be organizable. Reshaped
    `main:overviewNotes` from a single string into an array of
    `{ id, title, body, createdAt }` sections — migrated in place the
    same way `gym.html`'s schedule shape evolved from a scalar to an
    array (detect the old shape in the loader, convert, save back;
    no separate `migrated_vN` flag needed). A "+ Add Notes Section"
    button (`.at-mini-btn`, same component as every other panel's
    "+ Add X" action) appends a new blank section; each section renders
    as its own card (`.note-section-card`) with an editable title input,
    a `.at-textarea` body (both autosave on blur), a delete button
    (reused `.at-due-del`, the same small-✕-hover-danger pattern already
    used for due-date chips/entry cards/value rows), and up/down reorder
    buttons reusing `.area-card-reorder` verbatim (the same component
    Life Areas and Self-Discovery entries already use for manual
    reordering — this codebase has no drag-and-drop reordering anywhere,
    only up/down-arrow swaps, so that's the pattern this follows too).
    New installs start with zero sections (visible only via the Add
    button) rather than one empty box, now that "add more" is the actual
    interaction model.
  - Verified in headless Edge with Supabase blocked at the network layer
    before navigation (per the testing note on `gym.html`'s Templates
    entry) — added three sections, filled and reloaded to confirm
    persistence, reordered and reloaded again to confirm the reorder
    itself persists (not just an in-memory swap), deleted a section and
    confirmed the up/down-disabled states at the new list edges. No
    Supabase requests were made during either verification pass.

- **Fitness Studio (`gym.html`) banner photo now shows the whole image.**
  `.po-banner-img`'s `object-fit` changed from `cover` (crops a non-16:6
  photo to fill the box) to `contain` (letterboxes/pillarboxes instead,
  showing the full uploaded photo against `.po-banner`'s existing subtle
  fill). One-line CSS change, no HTML/JS touched. This commit also
  finally lands the `gym.html` code for the "Timer presets, gesture-safe
  audio, launchTimer()" changelog entry above — that entry documented
  code that had been sitting uncommitted; it's included here rather than
  split out, since the two were tangled in the same uncommitted working
  tree and the user opted to land them together rather than untangle them.
  - Verified with a synthetic non-16:6 test image (portrait, three
    horizontal color bands) painted onto the real `#poBannerImg` via
    canvas in headless Edge (Supabase blocked pre-navigation, per the
    established testing note). First attempts appeared to show the
    bottom band clipped — that turned out to be a test-harness artifact
    (CDP `Page.captureScreenshot`'s `clip` region going stale against a
    `getBoundingClientRect()` taken before a scroll settled), not a real
    rendering bug: recapturing the full viewport and cropping client-side
    immediately after an instant `scrollIntoView` showed all three color
    bands intact, confirming `contain` genuinely shows the whole photo.

- **Media page (`entertainment.html`) gained a Favorites section and
  richer sorting, including manual.** Per an explicit instruction, none
  of the four existing galleries (Podcasts/Stories/Entertainment/
  Playlists) were removed — this is additive only.
  - **Favorites** is a fifth entry in `GALLERIES` (`{ key: 'favorites',
    ..., dataKey: null, isFavorites: true }`) but, unlike the other four,
    it owns no storage key of its own — it's a *virtual* gallery
    aggregated live from the other four's existing arrays
    (`loadFavoriteCards()`), so a favorited podcast episode or video
    keeps living in its home gallery's data, just with a new boolean
    `favorite` field. Every card, in every gallery (including Podcasts,
    covering "episodes" as well as "videos"), gained a ☆/★ toggle button
    in its existing `.card-actions` corner, alongside the pre-existing
    edit/delete buttons (edit is hidden for cards viewed via the
    Favorites tab, since editing needs that card's *home* gallery's
    status vocabulary — favoriting/unfavoriting and deleting still work
    from there). Each aggregated card is tagged in memory with a
    transient `_sourceGallery` (never persisted) so `updateCardEverywhere()`/
    `deleteCardEverywhere()` know which real gallery's array to write
    the change back into — unfavoriting from the Favorites tab removes
    it from that view without touching the underlying item; deleting
    from the Favorites tab deletes it from its home gallery entirely
    (same "Delete" confirm wording either way, since that's what it
    actually does). The Favorites tab's cards show a
    `HomeGallery · Status` tag (e.g. "Podcasts · Learning") instead of
    just `Status`, since items from different galleries are mixed
    together there. The "+ Add" button and the status/status-progress
    filter chip rows are hidden on the Favorites tab (no single status
    vocabulary applies to a cross-gallery view; add-from-scratch doesn't
    make sense for it either — favoriting happens from an item's home
    gallery).
  - **Sorting** replaced the old single alphabetical-toggle button
    (`#entSortBtn`, `media:sort_dir`) with a `<select>` (`#entSortSelect`)
    offering Title A→Z/Z→A, Newest/Oldest first (`createdAt`, already
    present on every card), Rating high→low, and Manual — persisted
    under a new `media:sort_mode` key (covered automatically by the
    existing `syncedPrefixes: ['media:']`, no sync-config change needed).
    The legacy `media:sort_dir` value is read once on boot and mapped
    into the new scheme if no `media:sort_mode` is stored yet (same
    detect-old-shape-and-convert precedent as `gym.html`'s schedule
    shape and `index.html`'s Overview notes), then left alone afterward
    — not deleted, same orphaned-key treatment as other superseded keys
    elsewhere in this app.
  - **Manual sort** reuses the up/down-arrow reorder pattern already
    established elsewhere in this app (Life Areas and Overview notes on
    `index.html`) rather than drag-and-drop, which this codebase has
    never used anywhere. New `.card-reorder` ▲▼ buttons appear on each
    card (top-left of the cover, mirroring the existing edit/delete
    buttons' top-right position) only when Manual is selected. Reordering
    operates correctly under an active status/progress filter: the
    up/down move is computed against the *currently visible* (filtered)
    list, then applied by swapping those two cards' positions in the
    real underlying array — not by swapping raw adjacent array indices,
    which would misbehave whenever a filtered-out card sat between two
    visible ones. Manual doesn't apply to the Favorites tab (there's no
    single underlying array spanning four galleries to reorder); selecting
    it there silently falls back to Title A→Z for display only, without
    overwriting the saved `media:sort_mode` preference.
  - Verified in headless Edge (Supabase blocked pre-navigation): seeded
    three podcast episodes and a story directly into `media:podcasts`/
    `media:stories`, confirmed every new sort mode's resulting order,
    switched to Manual and arrow-moved a card up, confirmed both the
    visual order and the underlying array order survived a reload,
    favorited items across two different galleries
    and confirmed the Favorites tab aggregated both with correct
    `HomeGallery · Status` tags, unfavorited one from inside the
    Favorites tab and confirmed it disappeared from that view while
    still existing (just `favorite: false`) back in its home gallery,
    and deleted the other from inside the Favorites tab and confirmed
    it was actually gone from its home gallery's storage, not just
    hidden. No Supabase requests were made during verification.

- **New page: `household.html` ("Household"), a five-section dashboard
  for home admin.** Genuinely new file, plus a new companion data file,
  `household-data.js` — new nav pill (`HOUSEHOLD` → `household.html`,
  appended after `NUTRITION` in `topbar.js`'s injected pill list — the
  only edit made to `topbar.js`); new sync key (`appKey: 'household'`,
  `syncedPrefixes: ['household:']`, wired via the standard shared
  `initCloudSync` — same call pattern as finance/entertainment/
  braindump, nothing new invented).
  - **Data layer modeled on `finance-data.js`, not the older raw-
    localStorage-inline style** (`braindump.html`'s convention): a model
    factory per collection (fills defaults, coerces types) +
    `makeCollection(key, model)` → `{list, get, add, update, remove}` +
    pure derived selectors, all under `window.HouseholdData`. Five
    collections, one `localStorage` key each, all under a `household:`
    prefix so the single `syncedPrefixes` entry covers everything with
    no per-key sync list: `household:legions`, `household:beings`,
    `household:inventory`, `household:wishlist`, `household:chores`,
    plus `household:active_tab` (persisted last-open tab, same idea as
    `finance.html`'s `TAB_KEY`/`setActiveTab`).
  - **Energy Beings** — a roster of thought-forms (`household:beings`)
    grouped into legions (`household:beings`'s `legionId` →
    `household:legions`). Legions get lightweight CRUD (name, purpose,
    a color tag from a small fixed palette) and up/down reorder — the
    same swap-adjacent-`order`-values pattern as `index.html`'s Life
    Areas (`.area-card-reorder`), renamed `.legion-card-reorder` here
    since "area" is `index.html`-specific vocabulary. Deleting a legion
    does **not** cascade-delete its beings — it nulls out their
    `legionId` back to "Unassigned", the same null-out-the-reference
    precedent `gym.html`'s equipment deletion already established,
    confirmed as the right call here too since a being shouldn't vanish
    just because its legion was reorganized. Each being renders as an
    `.ent-card`/`.ent-cover` tile (the exact gallery-card shell from
    `entertainment.html`, recolored with this page's own `--accent`
    instead of pink) — cover is the being's **sigil**, an uploaded image
    compressed via the standard `compressImageDataUrl(dataUrl, 480,
    0.82)` thumbnail preset (same convention as cover art in
    `entertainment.html`/`nutrition.html`, equipment photos in
    `gym.html`), or a fallback glyph if none was set. A status badge
    (Active/Charging/Dormant/Retired, colored via the existing
    `--success`/`--warning`/`--info`/`--text-tertiary` tokens — no new
    hues) overlays the cover, and the being's purpose/activation phrase
    render below as card text/a `.tag`. Editing a being opens a modal
    with an inline **charging log** — a simple timestamped add/delete
    note list (no edit-in-place), the same low-ceremony pattern as
    `gym.html`'s workout notes; log entries are edited as an in-memory
    draft array and only committed to `household:beings` on Save,
    matching every other modal's draft-then-save convention in this app.
  - **Inventory** (`household:inventory`) — flat CRUD list (name,
    category, quantity, unit, restock threshold), rendered as
    `.acct-row`-style rows (copied verbatim from `finance.html`'s
    Accounts/Subscriptions list recipe) inside a `.card`. "Needs
    restock" is **derived, not stored** (`quantity <= restockThreshold`)
    and reuses `finance.html`'s `.acct-row.is-due-soon` left-border/tint
    treatment; items at or under half their threshold escalate to a new
    `.acct-row.is-overdue` (danger red) variant of the same recipe.
  - **Wishlist** (`household:wishlist`) — flat CRUD list (name, priority,
    price, optional link, notes), sorted priority-then-price. Priority
    pill is `index.html`'s `.std-priority-pill` recipe copied verbatim
    (low/medium/high → info/warning/danger, the app's existing severity
    colors, not new ones).
  - **Chores** (`household:chores`) — recurring tasks with a `cadence`
    (daily/weekly/monthly/custom-every-N-days) and a `dueDate`. A "Done"
    action (`HouseholdData.completeChore()`) stamps `lastCompletedAt` to
    today and advances `dueDate` forward by the chore's interval — plain
    date math, no auto-deduct/financial side effect needed here (unlike
    `finance.html`'s Subscriptions renewal flow, which was considered as
    a precedent but doesn't actually apply since chores have no cost).
    Rows reuse the `daysUntil()`/`is-due-soon` due-soon-highlighting
    pattern from `finance.html`'s Subscriptions list (`daysUntil() <=
    7`-style threshold), with overdue chores (`days < 0`) escalating to
    the same new `.is-overdue` variant Inventory uses.
  - **Overview** — read-only summary tiles + lists (low-stock count/list,
    chores due-or-overdue, top wishlist items by priority, an energy-
    beings status breakdown) sourced entirely from `HouseholdData`'s pure
    derived selectors (`lowStockItems()`, `dueSoonChores()`,
    `overdueChoresCount()`, `topWishlistByPriority()`,
    `beingStatusCounts()`) — no separate stored state, so it can never
    drift from the other four sections.
  - **Page shell**: same `.shell`/back-button/cover-banner (sunburst
    emblem, italic serif title, tracked-caps subtext, outlined pill CTA,
    radiating-line divider)/underline-tab-bar structure every other
    top-level page uses (`.hh-cover-*`/`.hh-tabs`/`.hh-tab`, copied from
    `finance.html`'s `.fin-cover-*`/`.fin-tabs`/`.fin-tab`, itself
    matching `index.html`/`gym.html`/`braindump.html`'s cover pattern).
    The cover's CTA ("Log a Chore") jumps straight to the Chores tab via
    the same hash-router `setActiveTab()` already used for tab clicks —
    no separate navigation mechanism, matching `finance.html`'s
    `finCoverCtaBtn` precedent.
  - **Palette**: per an explicit decision with the user, Household stays
    on the app's standard near-black/off-white palette with the
    long-form `--success`/`--warning`/`--danger`/`--info` token
    convention (used by 4 of 5 existing pages) rather than getting a new
    themed look — despite the occult-flavored feature vocabulary
    (legions, sigils, activation phrases), this was a deliberate call to
    keep scope down and match the "dashboard" framing, not an oversight.
    `--accent` is set to the same blue as `--info` (`#7DD3FC`) rather
    than a new hue, reusing an existing token's value instead of
    inventing one, per the DO NOT MODIFY §2 rule.
  - Modals use the plain `.modal-bg`/`.modal` class names (not a new
    page-specific prefix), so they're already covered by `topbar.js`'s
    existing `MODAL_SELECTORS` list — no `topbar.js` CSS/JS edit was
    needed for mobile scroll-lock/full-screen behavior on this page's
    modals.

- **Main tab (`index.html`), Businesses section: added a "Workflow"
  book-playbook view (Weeks -> Days -> checklist), plus a Tasks
  integration and a one-time content seed for the Amazon KDP business.**
  Landed in stages (data layer, then UI, then seed content, then Tasks
  integration); this entry covers the whole thing as delivered. Nothing
  here is name-scoped to "Amazon KDP" except the seed content itself —
  the Workflow feature is generic and available on every business, same
  as KPIs/Goals/Tasks/Notes already are.
  - **Data layer** — three new flat-array stores, same
    flat-array-per-collection + id-as-foreign-key convention as
    Goals/Tasks/Milestones/Objectives (not a nested blob):
    `main:workflowWeeks = [{ id, businessId, title, order, collapsed, createdAt }]`,
    `main:workflowDays = [{ id, weekId, businessId, title, status, order, notes, createdAt }]`
    (`status` is one of `WORKFLOW_DAY_STATUSES = ['Not started', 'In progress', 'Done', 'Blocked']`,
    the single place to edit that set), and
    `main:workflowChecklist = [{ id, dayId, text, checked, order, createdAt }]`.
    `order` is a free-floating sort key; `moveWorkflow*(id, dir)` swaps
    two siblings' `order` values on reorder and never renumbers/rewrites
    titles — same precedent as `moveValueRank()` for Self-Discovery
    Values. Full CRUD (`addWorkflow*`/`updateWorkflow*`/`removeWorkflow*`)
    and selectors (`weeksForBusiness`/`daysForWeek`/`checklistForDay`/
    `weekProgress`) live inline in `index.html`'s own script, not a
    separate `-data.js` file — Businesses/Goals/Tasks/Milestones/
    Objectives were never split out that way either, so this follows
    suit. Deleting a Week cascades to its Days and their checklist items
    (a Day/checklist item has no meaning outside its Week, unlike
    Goal/Task which can be reassigned off a deleted Business by nulling
    the reference).
  - **UI** — a "Workflow" section appended to the Business panel after
    Notes: Weeks render as `.std-group` (the exact collapsible component
    Milestones already use — caret, ▲▼ reorder, inline-editable title
    autosaving on blur, a "3/7 done" counter + `.std-bar` progress fill
    from `weekProgress()`, delete-with-cascade-confirm). Days are a new
    `.wf-day` row (reorder, inline-editable title, a `Status` `<select>`
    colored per state, an `.at-due-link` business tag, delete) that
    itself collapses independently to reveal a "Move to week" `<select>`
    (only shown when >1 week exists) and its checklist. Checklist items
    reuse the Objectives-under-Milestone pattern verbatim (check/text/
    delete) with reorder arrows added. Collapse-on-click is wired at the
    `.std-group-head`/`.wf-day-head` level (not per-child), with every
    interactive child (reorder buttons, title inputs, selects, delete)
    calling `stopPropagation()` so editing doesn't also toggle collapse.
    Week collapse persists (`WorkflowWeek.collapsed`, part of the data
    layer); Day collapse is intentionally transient/in-memory only
    (`collapsedWorkflowDayIds`, module-scoped) — only week-level
    persistence was asked for. No new colors — statuses reuse
    `--success`/`--warning`/`--danger`; everything else reuses this
    page's existing `--at-gold`/near-black tokens.
  - **Content seed** — `seedKdpWorkflow()`, guarded by
    `main:kdpWorkflowSeeded` (runs once automatically, same "inline
    migration" precedent as `finance:migrated_v2`/`media:migrated_v1`),
    finds-or-creates the "Amazon KDP" business then walks a
    `WORKFLOW_SEED_PLAN` array, matching weeks/days by exact title and
    checklist items by exact text — creates what's missing, reuses what
    exists, never resets an existing day's status or item's checked
    state. Seeds Weeks 1–4 and 6 (**no Week 5**, intentional) totaling 25
    days, matching a specific book-writing playbook provided by the
    user. Verified idempotent by forcing the guard flag off and
    re-running in the same session — byte-identical output, no
    duplicates.
  - **Tasks integration** — a Task can optionally link to a WorkflowDay
    via a new, additive `Task.workflowDayId` field (nullable; every task
    created before this shipped just has it `undefined`, treated the
    same as `null` everywhere). The link lives only on the Task side
    (mirrors the goalId+milestoneId two-level-FK precedent Tasks already
    had) — `taskForWorkflowDay(dayId)` is the one lookup everything else
    reads through. A per-day "→ Tasks" / "✓ In Tasks" button
    (`sendWorkflowDayToTasks`/`unlinkWorkflowDayFromTask`) creates or
    unlinks a linked Task, merge-not-duplicate by day (re-clicking syncs
    title/status onto the existing linked task rather than creating a
    second one; unlinking nulls the reference, doesn't delete the Task —
    same precedent as Business deletion nulling Goal/Task references). A
    per-business "Auto-sync days to Tasks" checkbox
    (`biz.workflowAutoSync`) immediately links every not-yet-linked day
    when turned on, and auto-sends any day added afterward via the
    Week's quick-add while it's on. New Tasks are created plain
    (`isDailyAction: false`, no `dueDate`) rather than auto-flagged
    Daily — deliberately, since flagging all 25 seeded days Daily would
    flood the Today view at once; the user can flag individual synced
    tasks Daily or set a due date by hand via the existing task modal,
    same as any other task.
  - **Status sync is two-way**, wired as one-hop, non-recursive pushes
    called only from the specific user-facing entry points that
    originate a change — `pushDayStatusToLinkedTask()` from the Day
    status `<select>`'s change handler, `pushTaskStatusToLinkedDay()`
    from `setTaskDone()` (covers the checkbox everywhere `buildTaskRow`
    is used — Tasks tab, Business panel, Goal page) and from the task
    edit modal's save handler — deliberately *not* a generic "any update
    propagates" hook on the low-level `updateWorkflowDay`/`setTaskDone`
    primitives themselves, which would risk a Day→Task→Day ping-pong;
    neither push function calls into the other's entry point, so there's
    no cycle by construction. Status vocabularies don't map 1:1 (Tasks
    have `todo`/`in-progress`/`done`; WorkflowDay adds `Blocked`, which
    has no Task equivalent and maps to `todo` going that direction). To
    keep a Task's binary done/todo from silently erasing an explicit
    `Blocked` on the Day, the Task→Day push only overrides an existing
    `Blocked` day when the Task is actually marked `done` — any other
    Task change leaves `Blocked` alone. Verified end-to-end in a headless
    session: send-to-Tasks, resend-is-idempotent, Day→Task in both
    `In progress` and `Done`, Task→Day via `setTaskDone` in both
    directions, the `Blocked`-protection rule, unlink (Task survives,
    just un-linked), and auto-sync-on-toggle linking all 25 seeded days
    — every step matched the expected result.

- **Workflow follow-up: duplicate a week.** A new "⧉" button
  (`.std-group-dup`, same hover-reveal treatment as the existing
  `.std-group-edit`/`.std-group-del` icons on a `.std-group` header) on
  every Week — seeded, user-added, or itself a prior duplicate, since
  it's rendered generically in `buildWorkflowWeekGroup()` for whichever
  week is passed in, not special-cased to any one week — clones that
  week via `duplicateWorkflowWeek(weekId)`: a new week (title suffixed
  `" (Copy)"`) plus every one of its days and their checklist items,
  reusing the existing `addWorkflowWeek`/`addWorkflowDay`/
  `addWorkflowChecklistItem` CRUD so the copy lands with fresh ids and
  correct ordering. The copy starts fresh — day statuses reset to
  `Not started`, checklist items reset unchecked — since duplicating is
  for reusing a week's day/checklist *structure* (e.g. spinning up
  another prose-sprint week), not for snapshotting progress; the
  original week's statuses/checked-items are left untouched. Linked
  Tasks are never copied — a duplicated day has no Task pointing at it
  (`workflowDayId`) until explicitly sent via the existing "→ Tasks"
  button. The new week is appended at the end of the business's week
  list via the same `nextWorkflowOrder()` logic every other new week
  uses, so it's immediately reorderable with the existing ▲▼ controls —
  no separate "make duplicates reorderable" mechanism was needed, since
  reordering already operates generically over `weeksForBusiness()`
  regardless of how a week was created. Verified in a headless session:
  duplicating Week 2 (7 days × 4 checklist items each, with one day
  pre-marked Done and one item pre-checked) produced a 6th week with all
  7 days/28 items copied, every status reset to `Not started`/unchecked,
  the original week's Done/checked state left intact, and the new week
  successfully reordered via `moveWorkflowWeek`.

- **New page in progress: `selfcare.html` ("Self-Care"), built in two
  steps — a data layer first, then the nav shell — per an explicit ask
  to set up the foundation before any UI.**
  - **Data layer** (`selfcare-data.js`, landed first, on its own,
    `<script>`-included by no page yet at that point): same
    conventions as `household-data.js`/`finance-data.js` — an IIFE
    exposing `window.SelfCareData`, `storeGet`/`storeSet`, JSDoc-typed
    model factories + `makeCollection(key, model)` CRUD, pure derived
    selectors, a guarded one-time seed. Five collections under a
    `selfcare:` prefix: `JournalEntries`, `Meditations`, `WaterLog`,
    `BucketList` (all `makeCollection`-backed) and `HydrationProfile`
    (a single-record get/save pair, not a list, since there's only ever
    one). `SelfCareUnits` (`Volume` ml↔oz, `Weight` kg↔lb
    convert/format) mirrors `FinanceCurrency`'s shape — there's no
    shared cross-file unit helper to import (no build step), so this is
    a small new one in the same spirit; `gym.html`'s `unit()` is the
    closest prior art, but it's just a page-scoped kg/lb label getter,
    not a conversion helper. `recommendedDailyMl(profile)` is one pure,
    heavily-commented function implementing the requested ml/kg-by-age-
    bracket + activity/climate-adjustment heuristic — explicitly a
    general estimate, not medical advice — and yields to
    `customGoalOverride` when set. Selectors: `entriesByTopic`,
    `todayIntakeMl`, `todayProgress`, `intakeHistory(days)`,
    `bucketItemsByStatus`, `bucketItemsByCategory`. Seed data covers all
    five collections (including a few `WaterLog` rows, even though only
    entries/meditations/profile/bucket items were explicitly asked for
    — otherwise the water-history selectors would have had nothing to
    demonstrate), dated relative to today so it stays meaningful
    whenever it runs. Verified standalone in headless Edge (a small
    throwaway test harness loading just this file against a fake
    `localStorage`) — every model, CRUD path, enum-coercion fallback,
    and selector produced correct output before any UI touched it.
  - **Nav shell** (this commit): `selfcare.html`, following
    `household.html`'s page skeleton (`sc-`-prefixed classes in place
    of `hh-`): back button, cover banner (sunburst emblem, italic serif
    title, tracked-caps subtext "Rest / Reflect / Restore", pill CTA
    that jumps to the Water tab, radiating-line divider), an underline
    `.sc-tabs`/`.sc-tab` subnav — Overview / Journals / Meditations /
    Water / Bucket List — and one `.section[data-section]` panel per
    tab, each currently just a placeholder `.card` (icon + title +
    one-line description of what's coming). Tab routing is the same
    hash-plus-localStorage-fallback pattern as `household.html`'s
    `setActiveTab()`/`tabFromHash()`/`hashchange` listener
    (`selfcare:active_tab`), so the active section is reflected in the
    URL (`#overview`, `#journals`, etc.) and survives a reload/deep
    link exactly like Household's tabs do. Palette: standard near-black/
    off-white base with the existing `--success`/`--warning`/`--danger`/
    `--info` tokens; `--accent` repoints to `--info`'s own value
    (info-blue) rather than inventing a new hue — the same call
    `household.html` made and for the same reason (no reference photo,
    no new-palette exception granted, per the DO NOT MODIFY rule in
    §3/below). `topbar.js` got one addition — a `SELF-CARE` pill
    (`href="selfcare.html"`, id `topbarSelfCare`) appended after
    `HOUSEHOLD`, no other line touched, same as every prior page's nav
    registration. `selfcare.html` loads `selfcare-data.js` (`defer`)
    and calls `initCloudSync({ appKey: 'selfcare', syncedPrefixes:
    ['selfcare:'] })` at boot, so cloud sync is wired even though no
    panel reads `SelfCareData` yet. `README.md`'s file table and this
    file's three registration tables (§1 file list, §4 sync-key table,
    §5 pages table) were all updated to match — same three-table
    convention every previous page addition followed. Verified in
    headless Edge: all five tabs switch and update the URL hash
    correctly, a hard reload on `#meditations` lands back on the
    Meditations panel, the topbar's new SELF-CARE pill navigates in and
    highlights itself as active, and every other page's topbar pill/
    href/id was diffed against its pre-change state to confirm nothing
    else in `topbar.js` was touched.

- **Main page (`index.html`) Workflow: day duplication, plus copying/moving
  a whole Week between businesses.** Follow-up to the Workflow feature
  (Weeks → Days → checklist, see the earlier Workflow entries above) — the
  request was specifically for Weekly Templates that get reused across
  future projects, so this pass fills the two gaps that blocked that:
  Weeks already had a duplicate button but Days didn't, and neither Weeks
  nor Days had any way to leave their originating business. Purely
  additive — no existing Week/Day/checklist data, title, status, or
  ordering was altered, and every existing move*()/duplicate*() call site
  keeps working unchanged (`targetBusinessId` on `duplicateWorkflowWeek` is
  a new optional second argument, defaulting to the source week's own
  business).
  - `duplicateWorkflowDay(dayId)` (new) — clones a day plus its checklist
    items and notes/code blocks into the same week, appended at the end,
    same "reset to Not started / unchecked, no linked Task copied"
    precedent `duplicateWorkflowWeek` already established. A new "⧉
    Duplicate" button (`.at-mini-btn`, matching the day row's existing
    Open/→Tasks button styling) sits in every Day row's header.
  - `moveWorkflowWeekToBusiness(weekId, targetBusinessId)` (new) —
    relocates a week in place (keeping its current progress) to a
    different business, cascading the businessId onto its days the same
    way `moveWorkflowDayToWeek` already cascades a day's businessId when
    it changes weeks.
  - `duplicateWorkflowWeek` gained an optional second `targetBusinessId`
    argument (defaults to the week's own business, so the existing
    same-business "⧉" duplicate button is unchanged) so a template week
    can be copied straight into a different business/project without
    disturbing the original.
  - Each Week group gained a "Send to another project:" row (`.wf-move-row`,
    the same select+label component the Day row's existing "Move to week"
    control already uses) with a business `<select>` plus two buttons —
    "⧉ Copy" (duplicate into the selected business, original stays put)
    and "→ Move" (relocate the week and its days there, original leaves
    this business) — shown only when more than one business exists.
  - Reordering itself (the up/down arrow controls on both Weeks and Days,
    and the Day row's existing "Move to week" select) was already fully
    free-form — any position reachable by repeated clicks/reassignment —
    so no change was needed there; this entry only closes the "duplicate
    a day" and "move across businesses" gaps.

- **Self-Care (`selfcare.html`) Meditations tab built as a linkable
  library.** Follow-up to the Self-Care nav-shell entry above, which left
  Meditations as a placeholder card — this pass replaces it with a real
  UI over the `SelfCareData.Meditations` collection that already existed
  in `selfcare-data.js` (no data-layer changes needed; the model/CRUD/
  `MEDITATION_TYPES` were already there, just unread by any UI until now).
  Same state/render/wire-events shape as the Journals tab already built
  on this page (topic chips → filtered list, a shared add/edit modal,
  `escapeHtml`/`renderMarkdownLite` reused where applicable).
  - **Grid of cards** (`.med-grid`/`.med-card`, new CSS — reuses the
    `.jr-row` surface recipe (bg/border/radius) laid out as a responsive
    grid instead of a stacked list, since there's no cover art here to
    justify the heavier `.ent-card`/`.ent-cover` gallery pattern):
    title, a type `.tag`, duration (or "No duration set" if
    `durationMin` is null), an optional clamped description, tag chips,
    and a ☆/★ favorite toggle button pinned to the card's top-right
    corner (click toggles `isFavorite` immediately, no modal needed —
    same "instant toggle" precedent as Media's favorite star).
  - **Open action** — a dedicated "↗ Open" button per card calls
    `window.open(m.url, '_blank', 'noopener')`, the `window.open`
    equivalent of an `<a rel="noopener">` link (there's no anchor tag
    here to attach `rel` to, since the whole card is built from a
    template string, not a link).
  - **Create/edit/delete** via a shared modal (`#medModalBg`, copied
    structurally from the Journal modal): title, description, URL,
    type `<select>` (from `SelfCareData.MEDITATION_TYPES`), duration in
    minutes (optional, blank = no duration), comma-separated tags,
    a favorite checkbox, and notes. **URL validation**
    (`isValidMeditationUrl()`) requires `new URL(value)` to parse *and*
    resolve to `http:`/`https:` — rejects empty strings, bare words,
    and non-http(s) schemes like `javascript:`; an invalid URL blocks
    Save with an `alert()` and leaves the modal open, same "alert and
    return" precedent as the Journal modal's empty-title/body guard.
    Delete is available both per-card (a small ✕ icon button, `confirm()`-
    gated) and from inside the edit modal (the same `.delete-link`
    pattern as the Journal modal).
  - **Filters**: a type chip-row (`#medTypeChips`, All + each
    `MEDITATION_TYPES` value) and a duration chip-row (`#medDurationChips`,
    fixed presets — Any length / Under 10 min / 10–20 min / Over 20 min —
    chosen over a free-form min/max range input since every other filter
    in this codebase is chip-based, not a custom range control) sit above
    the grid, plus a "★ Favorites only" toggle appended as the last chip
    in that same row, and a title-only search input (`#medSearchInput`,
    same live-filter-on-`input` pattern as the Journal search box). All
    filters compose (type AND duration AND favorites-only AND search),
    matching the Journal tab's topic+search composition.
  - `setActiveTab()` and the cloud-sync `onApplied` callback both gained
    a `meditations` branch (mirroring the existing `journals` branch) so
    the grid renders on tab-switch and refreshes after an incoming sync
    — no other tab-router/sync code changed. No `selfcare-data.js`
    changes were needed; `medModalBg`'s fields all already existed on
    `SelfCareData.Models.meditation`.
  - **Verified via a raw CDP session against headless Edge** (no
    `chromium-cli`/Node/Python available in this environment, so this
    was driven directly over the DevTools Protocol websocket from a
    PowerShell script using `System.Net.WebSockets.ClientWebSocket`,
    against an isolated temporary `--user-data-dir`, not the real
    browser profile): invalid-URL rejection (alert shown, modal stays
    open, no record created), valid create (all fields land correctly),
    favorite toggle (star glyph + `isFavorite` + active class all
    flip), Open button's exact `window.open` args
    (`url, '_blank', 'noopener'`), type filter, duration filter,
    favorites-only toggle, title search, edit-persists-changes, and
    delete (record gone, unrelated seed records untouched, count nets
    back to the original 4) — all ten passed on the first run.

- **Self-Care (`selfcare.html`) Water tab built as a personalized daily
  hydration tracker.** Follow-up to the Meditations entry above — same
  page, next placeholder replaced. Runs on top of `SelfCareData`'s
  existing `HydrationProfile`/`WaterLog` collections and
  `recommendedDailyMl()`/`todayIntakeMl()`/`todayProgress()`/
  `intakeHistory()` selectors; the one data-layer addition was
  `hydrationGoalBreakdown(profile)` (new, exported alongside
  `recommendedDailyMl`) — same inputs/math, including the
  override-wins-outright behavior, but returns the itemized components
  (`weightKg`, `ageFactor`, `baseMl`, `activityAdjMl`, `climateAdjMl`,
  `total`) instead of just the final number, so the UI's "how is this
  calculated?" disclosure doesn't need its own copy of the private
  formula constants (`WATER_AGE_FACTOR_ML_PER_KG` etc. stay private).
  `recommendedDailyMl()` itself is now a thin wrapper around it —
  `base` is deliberately left unrounded internally so `total`'s
  rounding matches the original formula exactly (verified: identical
  output for every profile shape tested).
  - **Profile form** (`#wtrProfileCard`): weight (+ kg/lb unit),
    height (cm, optional), age, sex (optional freeform text, matching
    the model's own "freeform, nullable" comment — not an enum),
    activity level and climate `<select>`s (populated from
    `SelfCareData.ACTIVITY_LEVELS`/`CLIMATES`), and a preferred
    display-unit `<select>` (ml/oz). "Save Profile" gathers every
    field and calls `saveHydrationProfile()` once — a deliberate
    single explicit write, not autosave-per-keystroke, both to match
    every other page's "edit inputs, click Save" form convention and
    so `sync.js`'s new `localDirtyKeys` protection (see the
    "Prevent incoming sync from clobbering in-flight local edits"
    entry) only needs to cover one write per edit session, not a
    stream of them.
  - **Goal + progress ring** (`#wtrGoalCard`): a hand-rolled SVG
    circular progress ring (stroke-dasharray/dashoffset on a circle,
    r=70 — this app's established "no charting library" convention for
    all its visualizations, same spirit as the div-bar/inline-SVG
    charts elsewhere) showing percent-of-goal in the center, with
    today's logged amount and remaining-vs-goal text beside it — all
    formatted in the profile's chosen unit via
    `SelfCareData.Units.Volume.format()`. The ring and remaining-text
    both flip to `--success` once the goal is met (a calm "you did it"
    signal, not a warning color). The required caption ("General
    estimate, not medical advice…") is always visible, unstyled beyond
    a muted tertiary color — deliberately not a red/amber warning
    treatment, per the "keep it calm and non-alarming" instruction.
    A collapsed-by-default "How is this calculated?" disclosure
    (`#wtrBreakdownBody`) shows the itemized
    `hydrationGoalBreakdown()` output (or, if a manual override is
    active, a short note saying so instead of the formula). **Manual
    override**: a text input + Set/Clear buttons write/clear
    `profile.customGoalOverride` directly via `saveHydrationProfile()`
    — Set validates the input is a positive number first.
  - **Quick-add logging** (`#wtrLogCard`): "+ Cup"/"+ Bottle" buttons
    (fixed 250 ml / 500 ml presets, their button labels reformatted
    live in the profile's display unit) write a `WaterLog` entry for
    `todayISO()` with one click; "+ Custom…" opens a small modal
    (`#wtrCustomModalBg`) for an arbitrary amount in the display unit,
    rejecting non-positive input with an `alert()` before writing.
    **Today's entries** list every `WaterLog` row dated today with an
    always-editable amount `<input>` (blur-to-save, this app's
    established inline-edit convention — same as Workflow day
    titles/checklist text) and a delete ✕ button; editing/deleting
    only re-renders the read-only readouts (ring/goal/history), never
    the profile form, so neither action can clobber an in-progress
    profile edit.
  - **History** (`#wtrHistoryCard`): a "Last 7 days"/"Last 30 days"
    chip toggle over `intakeHistory(days)`, newest-first, each day a
    row with a mini progress bar (new `.wtr-bar`/`.wtr-bar-fill`, the
    same div-fill-percentage idiom `.std-bar`/`.std-bar-fill` already
    uses elsewhere in this app, given a page-local copy since this
    file doesn't share that class) that turns `--success` once that
    day's goal was met, plus the day's total-vs-goal text. Dates are
    formatted via the browser's native `toLocaleDateString()` (no
    hand-rolled day-name table, no date library) with today shown as
    "Today". Logging any entry (quick-add, custom, edit, delete)
    always re-renders history too, so a same-day edit is reflected
    immediately without waiting for a tab switch.
  - **Date-based reset is implicit, not special-cased**: "today" is
    always `SelfCareData.todayISO()` evaluated at render time, and
    every log/history read filters or groups by each entry's own
    `date` field — so a new day naturally starts today's log/progress
    at zero with no migration or rollover logic needed, while every
    past day's entries remain exactly as logged in history. Verified
    directly: adding a log dated yesterday leaves today's intake
    unchanged and shows up correctly summed into yesterday's history
    row.
  - **Render split for sync safety**: `populateWaterProfileForm()`
    (fills the profile inputs from storage) only runs on tab
    activation or right after an explicit Save — never from the
    cloud-sync `onApplied` callback, which instead calls the separate
    `renderWaterReadouts()` (ring/goal/log/history — all read-only
    until acted on). This mirrors the Journals/Meditations tabs'
    existing onApplied behavior (they only ever refresh list views,
    never form state) and specifically avoids the class of bug the
    immediately-preceding `sync.js` "Prevent incoming sync from
    clobbering in-flight local edits" commit addressed one layer down
    — that fix protects data already written to `localStorage`, not
    unsaved keystrokes still sitting only in a DOM input.
  - **Verified via the same raw-CDP-over-websocket approach** used for
    the Meditations tab (no `chromium-cli`/Node/Python in this
    environment; an isolated temporary `--user-data-dir`, not the real
    profile): quick-add Cup/Bottle updating intake and the ring
    correctly, the custom modal rejecting a negative amount then
    accepting a valid one, inline amount edit persisting, delete
    removing the right entry, the breakdown disclosure's itemized math
    matching the displayed goal exactly, override set/clear correctly
    swapping between "4000 ml" and the recalculated "3300 ml" (and the
    breakdown text switching to the override note and back), a full
    profile save (weight/age/activity/climate/unit all changed at
    once, including ml→oz) correctly recomputing the goal and
    relabeling the quick-add buttons and custom-modal unit in oz, a
    yesterday-dated entry leaving today's intake untouched while
    correctly summing into history, and the 7/30-day history toggle
    changing row counts accordingly — all eleven checks passed on the
    first run, with the page still responsive afterward.

- **Self-Care (`selfcare.html`) Bucket List tab built, groupable by status
  or category, with a "surprise me."** Follow-up to the Water entry
  above — same page, next (and per the file's own §5 table, last
  remaining real) placeholder replaced; Overview stays a shell. Runs on
  top of `SelfCareData`'s existing `BucketList` collection/model and
  `BUCKET_CATEGORIES`/`BUCKET_STATUSES`. One data-layer addition:
  `SelfCareCurrency` (new, exported as `SelfCareData.Currency`) —
  `parseToCents`/`format`, copied verbatim from
  `household-data.js`'s `HouseholdCurrency` (itself mirroring
  `finance-data.js`'s `FinanceCurrency`), since `BucketItem.costCents`
  needed the same "parse user input into integer cents / format cents
  back for display" pair this app already has two other copies of, and
  no shared cross-file module system exists to import one instead (see
  CLAUDE.md §1/§4) — a third small page-local copy, same precedent.
  - **Cards** (`.bkt-card`, new gallery-card CSS distinct from
    Meditations' image-less `.med-card`, since bucket items can have a
    cover photo): an optional cover — a real `<img src="…">` (not a CSS
    `background-image: url(...)`, which was tried first and reverted;
    seeing an item's `imageUrl` value pass through HTML-attribute
    escaping into a CSS `url('...')` string raised the same class of
    quote-re-decoding subtlety `url()`-in-`style=` constructs are prone
    to — a plain `<img src>` sidesteps it entirely since standard HTML
    attribute escaping is sufficient there) or a category-icon
    fallback — a status badge overlay (Idea/Planned/Done, colored via
    the existing `--info`/`--warning`/`--success` tokens, no new
    colors), title, category `.tag` + cost (via
    `SelfCareData.Currency.format()`, omitted entirely when
    `costCents` is null rather than showing a placeholder), a date line
    ("By <date>" for a target date, "Done <date>" once completed, or
    "No date set"), an optional clamped description, and
    Mark-Done/Edit/Delete actions (Mark Done hidden once already done).
  - **Groupable by status or category** (`#bktGroupChips`, a two-chip
    toggle — "Group by Status" / "Group by Category"): re-partitions
    the *same* filtered item list into `.bkt-group` sections (status
    groups always in `BUCKET_STATUSES` order; category groups in
    `BUCKET_CATEGORIES` order), each with a header + count, omitting
    any group with zero items after filters/search are applied — status
    and category filters, and title search, all compose with whichever
    grouping is active, same "every filter composes" precedent as
    Meditations.
  - **Create/edit/delete** via a shared modal (`#bktModalBg`, same
    structural pattern as the Journal/Meditation modals): title
    (required — empty blocks Save with an `alert()`), description,
    category/status `<select>`s, target date (`<input type="date">`),
    cost (free-text, parsed via `SelfCareData.Currency.parseToCents`),
    image URL (optional, no upload/compression pipeline — deliberately
    simpler than the cover-photo upload machinery other pages use,
    since the request was "image if present," not a full upload flow),
    and notes. **`completedDate` is derived from the status field on
    every save**, not just from the quick Mark Done button: saving with
    `status === 'done'` stamps today's date only if one isn't already
    set (so re-saving an already-done item doesn't shift its completion
    date), and saving with any other status clears it — the same
    stamp-on-entering/clear-on-leaving precedent `gym.html`'s
    `exerciseDone`/Household's chore-completion timestamps already
    established, verified by editing a just-completed item back to
    "Idea" and confirming `completedDate` returned to `null`.
  - **Mark Done + a small celebratory touch**: the quick "✓ Mark Done"
    card button stamps `status: 'done'`/`completedDate` immediately,
    then plays a CSS-only celebration on that card — a brief
    box-shadow pulse (`.bkt-card-celebrate`, `--success`-tinted) plus a
    🎉 emoji that rises and fades (`.bkt-confetti`, a
    `@keyframes` pop, no animation library anywhere in this repo) —
    and only *then* (after a 650ms delay matching the animation) calls
    the grid re-render that actually moves the card into its new
    group/out of an active filter. Doing the re-render immediately
    would yank the card away before the celebration had a chance to
    play; the delay is what makes the "small celebratory touch" land
    as a moment, not a location. Marking done from the Surprise Me
    modal (below) uses the same status/completedDate stamp but skips
    the on-card animation, since that modal closes immediately instead.
  - **"Surprise Me"** (`#bktSurpriseBtn` → `#bktSurpriseModalBg`):
    picks a uniformly random item with `status !== 'done'` and shows
    its icon/title/category/date/cost/description in a small modal
    with "🎲 Try Another" (re-roll) and "✓ Mark Done" (stamps and
    closes, same status/completedDate logic as above) actions. If
    there are no not-done items left, an `alert()` says so instead of
    opening an empty modal.
  - **Verified via the same raw-CDP-over-websocket approach** used for
    Meditations/Water (isolated temporary `--user-data-dir`): create
    with an image/cost/target-date (card's `<img src>` matched exactly),
    empty-title rejection, Mark Done's confetti/pulse classes appearing
    immediately and the card landing in the correct group after the
    delay, edit-reverting done→idea clearing `completedDate`, category
    filter, status filter, title search, the group-by toggle's headers
    and counts, delete (item gone, count back to baseline), Surprise
    Me picking a not-done item and its Mark Done stamping correctly,
    and `SelfCareData.Currency.format`/`parseToCents` round-tripping
    cents correctly (including the null → "—" case) — all twelve
    checks passed on the first run.

- **Self-Care (`selfcare.html`) Overview tab built as the landing view,
  plus a consistency pass across the whole page.** Follow-up to the
  Bucket List entry above — this is the fifth and last tab on this
  page; every tab is now real. Overview adds **no new localStorage
  key** — every tile is a thin read (and, for quick-add/mark-done, a
  thin write) over the same `SelfCareData` collections/selectors the
  other four tabs already use, reusing their functions directly
  (`quickAddWater`, `openJournalModal`, `openMeditationLink`,
  `celebrateCard`, `bktFormatDate`, etc.) rather than duplicating logic.
  - **Water tile**: a smaller preview progress ring (`#ovRingFill`,
    r=44 vs the Water tab's r=70) plus a "+ Add &lt;cup size&gt;"
    quick-add button that calls the same `quickAddWater('cup', …)`
    already wired to the Water tab's own Cup button — so a log added
    from Overview is immediately correct on the Water tab too (same
    underlying `WaterLog` collection, no separate state). Extracted a
    shared `updateProgressRing(circleEl, progress)` helper (new — reads
    the circle's own `r` attribute, so it works at any ring size) so
    the Water tab's ring and this smaller one share one implementation
    of the circumference/dash-offset math and the "flips to `--success`
    at 100%" rule, instead of duplicating it.
  - **Journal tile**: picks a random topic + one of its prompts on
    every render (transient, never persisted) and shows it as a
    nudge; "Start an Entry" calls the existing `openJournalModal(null,
    topic)` with that topic preset, which already renders that topic's
    prompts inside the modal as usual.
  - **Meditation tile**: prefers a random *favorite* if any exist,
    else a random meditation from the full list; "Open" calls the
    existing `openMeditationLink()` (same `window.open(url, '_blank',
    'noopener')`); "Another" re-picks. The pick is transient
    (`ovMedPickId`, module-scoped) so a reload/revisit gets a fresh
    suggestion.
  - **Bucket List tile**: picks a random not-done item (transient,
    `ovBucketPickId`); "Mark Done" stamps `status`/`completedDate` via
    the same logic as the Bucket List tab and calls the existing
    `celebrateCard()` touch on the Overview tile itself, then re-picks
    a new (still not-done) item after the same 650ms delay used
    elsewhere; "Another" re-picks without marking anything done.
  - **Consistency-pass fixes found and applied**: the Water goal
    breakdown's "Weight (X kg) × …" line was hand-formatting the
    number with a hardcoded `' kg'` suffix instead of going through
    `SelfCareData.Units.Weight.format()` like every other weight/volume
    display on this page — fixed to call the shared formatter (output
    is identical today, e.g. "70 kg", but now guaranteed to stay
    consistent if that formatter's rounding/format ever changes). An
    audit of the rest of the file (`grep` for hardcoded `' ml'`/`'
    oz'`/`' kg'`/`' lb'` suffixes) found no other instances — every
    other volume/weight display already went through
    `SelfCareData.Units.Volume`/`Weight`. Confirmed no dead placeholder
    content remains: the only surviving `.sc-placeholder` usages are
    the legitimate "no items yet" empty states in Journals/
    Meditations/Bucket List (not stubs — real, reachable UI), and a
    `grep` for leftover "coming soon"/"lands here next" placeholder
    copy came back empty. Confirmed no new hardcoded colors crept into
    any of the four feature builds (`grep` for hex codes across the
    whole file matches only the pre-existing page shell's own `:root`
    tokens/cover-banner/button/modal values) — every tile/card/chip
    added across Meditations, Water, Bucket List, and Overview uses
    existing `--accent`/`--success`/`--warning`/`--danger`/`--info`/
    `--text-*` tokens.
  - **Verified**: topic filtering (Journals), Markdown rendering
    (heading/bold/list, Journal read view), meditation Open links
    (`noopener`, both from Overview and the Meditations tab itself),
    the water goal formula + daily reset (a yesterday-dated log excluded
    from today's total but correctly summed into history; the
    breakdown's `total` still matches `recommendedDailyMl()` exactly
    after the weight-formatter fix), and a Bucket List status change via
    the Edit modal (still correctly clears `completedDate` when leaving
    Done) — all reconfirmed working, not just assumed unbroken.
    Unit consistency was verified end-to-end in one pass: switching the
    profile to lb/oz correctly updated the Water tab's goal, its
    breakdown (still labeled "kg" for the internal working value, which
    is correct — see that tile's own note above), and Overview's amount
    text and quick-add button label, all in agreement.
  - **Process note — a real mistake, not just a test artifact**: the
    first pass at verifying this tab (and, on inspection, likely the
    Meditations/Water/Bucket List verification passes in the three
    entries above too) used isolated temporary `--user-data-dir`
    browser profiles but did **not** block `*.supabase.co` at the
    network layer. Since `selfcare.html` calls `initCloudSync(...)`
    with real, working credentials (by design, see §2), each "isolated"
    profile still pulled the real cloud `selfcare` row on load and
    pushed local test mutations back up via `sync.js`'s debounced push
    — confirmed via the cloud row's `updated_at` timestamp lining up
    with test-run times, and via a profile field (age/sex/activity/
    climate) appearing in a nominally-fresh test profile that no test
    script had set, matching values only explainable as real pre-existing
    user data pulled from the cloud. This is the exact failure mode
    CLAUDE.md already documented once for `gym.html`'s Templates
    testing (per that entry's own closing note: block `*.supabase.co`
    at the network layer first) — it wasn't followed here across four
    entries before being caught. The user was informed directly and
    opted not to need cleanup. This Overview verification pass was
    then redone correctly: CDP `Network.setBlockedURLs(['*supabase.co*'])`
    armed before `Page.navigate` (not after, and not left to a
    same-origin assumption), confirmed by the reloaded profile showing
    genuine seed values (age 29/moderate/normal/70kg) instead of the
    real data seen before blocking. Future automated browser testing of
    *any* page in this repo that calls `initCloudSync(...)` — not just
    `gym.html` — should block Supabase first, verified before
    interacting, not assumed.

- **Self-Care (`selfcare.html`) re-themed to match Media's current
  dusty-rose/wine aesthetic.** Same treatment `household.html` already
  got (see that changelog entry and commit — `entertainment.html`'s
  palette evolved past a plain "thin-red tile border + pink hover" into
  a dark wine/candlelit "boutique gallery" look, and this page was
  explicitly asked to match it too):
  - `:root`: `--bg`/`--bg-deep` switched to the same wine-black as Media
    (`#170a12`/`#0b0509`), added the identical `--tile-border`/
    `--pink-accent`/`--wine`/`--candle`/`--cream` tokens (same values,
    not a new palette), and repointed `--accent` from info-blue to the
    same dusty rose so every existing `var(--accent)` reference already
    in this file (cover emblem, active tab, breakdown-toggle link,
    water/history progress-bar fill, Overview tile links) picks up the
    new look without touching each rule individually. `--success`/
    `--warning`/`--danger`/`--info` were left alone on purpose — same
    precedent Media itself follows and Household repeated: those carry
    status meaning (goal met, favorite star, delete, "Idea" badge), not
    brand accent. `body::before`'s ambient glow gradient was swapped for
    Media's actual recipe (warm corner glow + rose corner glow over the
    wine-black base); `body::after`'s grain-texture layer already
    existed here (unlike Household, which was missing it) so nothing
    needed adding there.
  - **Cover banner**: wine-glow + candle/rose corner gradients,
    `--tile-border` border, cream title with the warm text-shadow,
    `--tile-border` CTA with a dusty-rose hover — identical recipe to
    Media's hero and Household's cover, kept as this page's own existing
    rounded-card structure (not Media's edge-to-edge banner), matching
    the precedent both other re-themed/bannered pages already set.
  - **Every hardcoded `rgba(125,211,252,X)` info-blue tint** (the cover
    emblem rays/CTA hover, the section divider, the old `.btn-primary`
    gradient, `.chip.active`, the journal prompt chips) was replaced
    with either the equivalent `rgba(224,138,159,X)` dusty-rose tint or,
    for `.btn-primary`/`.chip.active`, switched outright to Media's
    actual cream-to-dusty-rose gradient recipe (`linear-gradient(180deg,
    var(--cream) 0%, #d9a0ae 100%)`, text `#2a0d14`) — the same
    substitution Household's own re-theme made. A `grep` after the pass
    confirmed only `--info`'s own definition still references the old
    blue hex; every other instance was updated.
  - **`.med-card`/`.bkt-card`** (the Meditations/Bucket List gallery
    cards) gained the always-visible `--tile-border` — Media's signature
    "thin tile border" cue — matching how Household's own `.ent-card`
    got the identical treatment. `.jr-row` (Journal's list rows) and the
    generic `.card` well (Water's profile/goal/log/history cards,
    Overview's tiles) were deliberately left on the neutral `--border`
    token, since those are list-row/content-well surfaces, not gallery
    tiles — matching Household's own precedent of only recoloring its
    actual `.ent-card`-equivalent, not every surface in the file.
    `.med-fav-chip.active`/`.med-fav-btn` (the favorite-star elements,
    amber/`--warning`) were left untouched for the same status-not-brand
    reason as `--success`/`--warning`/`--danger`/`--info` above.
  - **Verified in headless Edge with Supabase blocked** (this time
    correctly — `Network.setBlockedURLs` armed via CDP before
    `Page.navigate`, or `--host-resolver-rules` mapping the Supabase
    host to `0.0.0.0` for the plain screenshot passes): all five tabs
    screenshotted and visually confirmed matching Media's look
    (wine-glow cover, cream serif title, dusty-rose active tab/chips/
    buttons, tile-bordered gallery cards); `getComputedStyle` confirmed
    `--accent`/`--tile-border`/`--cream`/`--bg-deep` all resolve to the
    new values while `--info` still resolves to the original blue; and
    a functional smoke pass (water quick-add, bucket category filter)
    confirmed the CSS-only change didn't disturb any JS behavior.

- **Main page (`index.html`) Overview tab built as a real landing view,
  replacing its "coming soon" placeholder.** The placeholder text itself
  already specified the scope — "today's habits, upcoming tasks, goal
  progress across Life Areas" — so this pass implements exactly that,
  no more: three tiles pulling live from the Habits/Tasks/Life
  Areas+Goals stores that already existed from the earlier Main-tab
  rebuild (`main:habits`/`main:habitlogs`, `main:tasks`, `main:areas`/
  `main:goals`). No new storage key — same "read-only summary derived
  from existing collections" precedent Self-Care's own Overview tab
  used one entry above.
  - **Today's Habits** (`#ovHabitsGrid`) reuses the exact `.at-task`
    row markup/behavior the Habits tab's own "Today" grid
    (`renderHabitTodayGrid()`) already established — checkbox toggles
    `toggleHabitToday()`, streak badge from `computeHabitStreaks()`,
    row click opens the habit edit modal — just rendered into its own
    container (`renderOverviewHabits()`) so toggling from Overview
    doesn't require the Habits tab to be mounted.
  - **Upcoming Tasks** (`#ovTasksList`) is the 8 soonest not-done tasks
    across every area/goal/business (`upcomingTasksForOverview()`,
    same due-date-then-created-date sort `nextActionForGoal()` already
    used), rendered via the existing shared `buildTaskRow(task,
    rerenderFn, opts)` — the same row component Goals/Tasks/Business
    panels already build their own lists from, so check-off, delete,
    and click-to-edit all work identically here with zero new code for
    those interactions.
  - **Goal Progress by Life Area** (`#ovAreaProgressList`) is new: one
    row per Life Area (icon, name, an averaged `computeGoalProgress()`
    across that area's goals, a `.std-bar` fill in the area's own
    `areaColorVar()` color), click-through to the existing Area detail
    modal (`openAreaDetail()`). Areas with zero goals show a plain "No
    goals yet" line instead of a 0%-filled bar, so an empty area doesn't
    read as "this area is failing."
  - **Rendering is wired through the existing `renderSection(tab)`
    dispatcher** (`renderSection('overview')` → `renderOverviewSection()`,
    added as a new branch) rather than an eager call at parse time —
    `renderOverviewAreaProgress()` reads `AREA_COLORS`/`areaColorVar`,
    which are `var`-assigned partway through this same script, so
    calling it before that assignment line executes would silently see
    `undefined`. `renderSection()` itself was already called from every
    place data can change (tab clicks, hashchange, the `goals-changed`
    event, and the `storage` event that also fires on an incoming
    cloud-sync apply), so Overview refreshes on all of the same triggers
    every other tab already does — no separate `onApplied` hook needed.
  - No new CSS tokens — `.ov-area-row`/`.ov-area-row-head`/
    `.ov-area-row-name`/`.ov-area-row-empty` are new but built entirely
    from this file's existing `--text-*`/`--at-border` tokens; the bars
    reuse `.std-bar`/`.std-bar-fill`, the pill reuses `.goal-card-pct`.
  - **Verified in headless Edge with Supabase blocked** (`--host-resolver-rules`
    mapping the Supabase host to `0.0.0.0` at launch, confirmed via a
    successful `/json/version` handshake before navigating): seeded a
    habit/area/goal/two tasks directly into a fresh, never-synced
    profile's `localStorage`, reloaded, and confirmed the Overview tab
    renders by default with all three tiles populated correctly (habit
    scheduled today, tasks sorted soonest-due-first, area row showing
    the right name/percentage/bar width); confirmed the habit checkbox
    toggle updates the streak live: confirmed the task checkbox removes
    it from the tile; confirmed clicking an area row opens the Area
    detail modal; and confirmed switching to Habits and back to Overview
    re-renders cleanly with no stale or duplicated rows.

- **New page: `example.html` ("Example"), a standalone visual style demo
  tab built to match a reference photo** (a "Solo Leveling: Beyond the
  System" movie poster — deep navy/black, glitchy scanline texture,
  glowing cyan holographic "System" HUD panels, a purple-to-cyan accent,
  and a central glowing "NOTIFICATION" dialog). Confirmed with the user
  up front that this should be (a) a genuinely new standalone page, not
  a re-theme of an existing one, and (b) added to the nav so it's easy
  to find, but explicitly **not** wired to real feature data — it's a
  styled example/demo, the same category of thing as this file's own
  "DO NOT MODIFY" reference-photo exceptions (braindump.html's forest
  theme, gym.html's crimson grading, entertainment.html's boutique-
  gallery look) but scoped to a whole throwaway page instead of an
  existing one.
  - **No sync, no storage**: `example.html` does not include `sync.js`
    and defines no `localStorage` keys — the notification Accept/Decline
    interaction and its Reset are pure in-memory DOM state, since there's
    nothing here that needs to persist or sync. `topbar.js` was the only
    shared file touched (one new pill, `EXAMPLE` → `example.html`,
    appended after `SELF-CARE` — same one-line-addition precedent every
    prior page's nav registration followed).
  - **Own self-contained `:root` tokens** (`--sy-*`), not shared with any
    other page — same "explicit reference-photo exception" precedent as
    the three exceptions listed in §6, just for a brand-new file instead
    of an existing one: deep navy background, a bright cyan
    (`--sy-cyan`/`--sy-cyan-bright`) glow accent, a purple
    (`--sy-purple`) secondary accent for the gradient title text, and a
    dedicated danger red (`--sy-danger`) for the Decline path.
  - **Visual recipe**: the fixed body background layers a radial cyan/
    purple glow over this repo's existing dotted-grain-texture technique
    (the same `radial-gradient(rgba(255,255,255,0.014) 1px, transparent
    1px)` / `3px 3px` recipe already used verbatim in `gym.html`/
    `finance.html`/`entertainment.html`), plus a new fixed, pointer-events-
    none scanline overlay (`repeating-linear-gradient`, `mix-blend-mode:
    overlay`) with a slow vertical sweep animation for the reference
    photo's glitchy holographic-display feel. HUD panels
    (`.sy-panel`/`.sy-notify`) use `clip-path` corner notches instead of
    plain rounded corners — a sharper, more "console UI" silhouette than
    this app's usual rounded-card look, matching the poster's angular
    panel style. The page title uses a gradient (purple → cyan) clipped
    to text, with a rare (~2s out of every ~7s cycle), subtle RGB-split
    `filter: drop-shadow` glitch animation — deliberately sparse so it
    reads as a texture, not a distraction.
  - **Central interactive notification** — mirrors the reference photo's
    "You have acquired the qualifications to be a Player. Will you
    accept?" dialog, plus a nod to the source image's own filename
    (`❌ [DECLINE] ✅ [ACCEPT]`): clicking **Accept** locks the panel's
    glow to solid cyan and swaps in an `[ ACCEPTED ]` result + a Reset
    button; clicking **Decline** plays a brief shake/hue-shift glitch and
    shows a "Rejection request denied by the System" message before
    reverting — a small, deliberate genre nod (the System doesn't
    actually let you decline) rather than a real dead-end action. Every
    HUD panel below (Player Status, System Log, Available Skills, Quest
    Received, Inventory) is static demo content styled to match the
    poster's background panels — bracket-style stat labels
    (`[NAME: Hunter]`), a staggered-fade-in log with a blinking cursor,
    and a progress bar reusing this app's existing div-fill-percentage
    idiom (recolored cyan-to-purple).
  - A small `.sy-cover-note` line ("Example tab — a visual style demo,
    not wired to real data") is always visible under the page title, so
    the page is self-documenting about its own scope at a glance, not
    just in this file.
  - `README.md`'s file table and this file's §1 file list / §5 pages
    table were updated to match, same three-table convention every
    previous page addition followed.

- **`example.html` follow-up: busier, layered backdrop matching the
  reference photo's blurred "background HUD clutter."** The initial pass
  above only had a plain glow behind the content; asked to match the
  poster's aesthetic more closely, since the poster's backdrop is densely
  packed with faded/blurred PLAYER STATUS/SYSTEM LOG/QUEST RECEIVED/
  INVENTORY windows behind the central notification. Added `.sy-bg-hud`,
  a fixed, pointer-events-none, `aria-hidden` layer holding ~7 small
  bracket-style ghost panels and a few thin light-streak glitches,
  positioned by percentage so they redistribute across viewport sizes;
  the whole layer is blurred and dimmed as one group (cheaper than
  per-panel blur, and reads as uniformly "out of focus" like the
  reference). A softened radial vignette (`body::after`) darkens the
  true edges so the clutter doesn't compete with the real content in the
  center. Three of the seven ghost panels hide below 640px (they'd
  otherwise overlap the single-column shell content on phones).
  - **Real bug found and fixed while building this**: the ghost layer,
    the base gradient, and the vignette were each given negative
    `z-index` values (-3/-2/-1) so they'd paint behind the real content
    without an explicit stacking order fight. In this environment,
    `position: fixed` elements with a **negative** `z-index` did not
    paint at all — confirmed in an isolated minimal test file (a plain
    fixed red box at `z-index:-2` over an `html, body { background:
    ... }` page rendered nothing, while the identical box at `z-index:0`
    or `z-index:auto` rendered fine). Root-caused to `html`/`body` both
    declaring an explicit background color: with that, this browser
    treats the negative-z-index paint layer as behind the effective
    canvas rather than above it. Fixed by giving `body::before`,
    `.sy-bg-hud`, and `body::after` all `z-index: 0` instead — same-
    z-index siblings paint in document order, and `::before`/`::after`
    act as the first/last child of that order, so the original intended
    stack (base gradient → ghost clutter → vignette → real content →
    scanline overlay) comes out identical, just via document order
    instead of negative z-index. Worth remembering for any future page
    in this repo that layers multiple fixed-position decorative
    backgrounds behind real content — don't reach for negative z-index
    here, use `z-index: 0` (or a positive value below the content's) and
    control order via DOM position instead.
  - **Verified** via headless Edge: confirmed the bug in isolation first
    (three tiny standalone test HTML files), then confirmed the fix
    renders all seven ghost panels and the light streaks correctly at a
    1920px-wide viewport, nudged the top-left panel down 12% (was
    colliding with the Back button), and used CDP to confirm no real
    horizontal-overflow bug exists at a narrow (~390 CSS px) viewport —
    `document.documentElement.scrollWidth === window.innerWidth`, no
    scrollable overflow — after a screenshot crop initially looked like
    clipped notification text (that turned out to be a DPI-scaling
    mismatch between the requested screenshot window size and the
    actual CSS pixel viewport in this environment, not a real bug).

- **Main page (`index.html`) Habits & Routines: stackable habits, plus a
  "System HUD" reference-photo restyle scoped to this one section.** Two
  changes landed together since the visual restyle exists specifically to
  make the new stacking feature read as literal "stacked panels," per the
  request's own framing (a screenshot of the "Solo Leveling: Beyond the
  System" ❌ DECLINE / ✅ ACCEPT notification poster — the same reference
  photo `example.html` was already built to match).
  - **Stacking (functional)**: `Habit` objects gained an additive
    `stackedHabitIds: []` field (undefined on pre-existing habits, treated
    identically to `[]` everywhere it's read via `habit.stackedHabitIds ||
    []` — no migration flag needed). This is deliberately a *different*
    mechanism from the pre-existing `main:routines` ("Routines" — a named,
    ordered, steppable sequence run one-at-a-time via "▶ Run") — stacking
    is the informal "habit stacking" technique (pair a new habit directly
    onto an existing one, check them off together), not a named multi-step
    program, so both now coexist rather than one replacing the other.
    - The Habit modal gained a "Stacked habits (done together with this
      one)" field: a `manage-row` list + `+ Stack a habit with this
      one…` `<select>`, copied structurally from the Routine modal's own
      habit-picker (`renderRoutineHabitList`/`renderRoutineAddHabitSelect`
      → new `renderHabitStackList`/`renderHabitStackAddSelect`), minus
      reordering (a stack has no sequence, unlike a Routine). The
      add-select excludes the habit being edited (no self-stacking) and
      excludes any habit that already has *this* habit in its own stack
      — a direct-reciprocal guard (A stacks B ⇒ B can't also stack A),
      since a mutual pair would make both habits vanish from Today's grid
      entirely (see the render-side rule below) with no way to un-stack
      either from the UI.
    - Deleting a habit now also strips it out of every other habit's
      `stackedHabitIds` (mirroring the existing cleanup that already ran
      against `routines[].habitIds`), so a deleted habit can't leave a
      dangling stack reference.
  - **Stacking (Today grid)**: `renderHabitTodayGrid()` now computes
    `stackedHabitIdSet()` (the union of every habit's `stackedHabitIds`)
    and excludes any habit already claimed by another habit's stack from
    rendering as its own top-level quest — it only renders once, nested
    under its anchor. A habit with a non-empty stack renders as one
    `.hb-quest-stacked` group: the anchor's row (`buildHabitTodayRow()`,
    factored out of the old inline row-building code so the same row
    markup/behavior serves both the anchor and its nested rows) plus a
    `.hb-quest-substack` of indented sub-rows, each independently
    checkable (`toggleHabitToday()` unchanged — a stacked habit is a real
    habit with its own log/streak, stacking is purely a display grouping,
    not a new entity type). The "All Habits" list (`buildHabitCard`) gained
    a `⛓ Stacked with` chip row so a habit's stack composition is visible
    without opening its edit modal.
  - **Visual restyle — "System HUD" reference-photo exception, scoped to
    `#atPanelHabits` only** (plus the three modals this section owns:
    `#habitModalBg`/`#routineModalBg`/`#runRoutineModalBg`, since they're
    only ever opened from here). Every other Main tab (Overview/Goals/
    Tasks/Businesses/Self-Discovery) keeps the page's existing dusty-rose
    palette untouched — confirmed by scoping every new rule under those
    four selectors rather than touching `:root` or any unscoped class.
    Same "explicit reference-photo instruction" exception category as
    gym.html's crimson grading / braindump.html's forest theme /
    entertainment.html's pink hover (CLAUDE.md §6 / DO NOT MODIFY rule 2)
    — and specifically reuses `example.html`'s already-established
    `--sy-*` token values and component techniques (clip-path notched
    panels, mono bracket-style labels, cyan glow-pulse borders, scanline
    overlay) verbatim under a new `--hb-*` prefix, rather than inventing a
    fresh palette for the same reference photo a second time. The Today
    quest cards, Habit/Routine cards, "Run Routine" stepper, and all three
    modals (fields, buttons, manage-rows, delete links) were reskinned;
    `.hb-quest-stacked`'s shared glowing frame around an anchor + its
    sub-stack is the concrete "visualize the stack as one linked HUD
    panel" piece the request asked for. `topbar.js` was not touched —
    these modals already use the plain `.modal-bg`/`.modal` classes
    covered by its existing `MODAL_SELECTORS`.

- **Habits & Routines follow-up: re-grounded the HUD in the page's own
  palette, worked the reference photo into the panel background, and
  added progress bars to every quest/habit/routine.** Three changes
  landed together per an explicit follow-up request.
  - **Recolor**: the cyan/purple `--hb-*` token layer from the prior
    entry is gone. Every rule under `#atPanelHabits` and its three
    modals now points straight at this file's own existing global
    tokens (`--at-gold`/`--at-gold-dim`/`--at-border`/`--at-purple`/
    `--at-cream`/`--text-primary`/`--text-secondary`/`--text-tertiary`/
    `--danger`) instead of a separate imported palette — this is no
    longer a "reference-photo exception" in the §6 sense, since it no
    longer introduces any color the rest of the page doesn't already
    use. The notched-panel/mono-label/glow-border HUD *shape* (clip-
    path corner notches, `// ` prefix on the section heading, bracket-
    style mono labels) was kept — only the colors changed. Modal rules
    (not DOM descendants of `#atPanelHabits`, so they can't inherit its
    custom properties) use the literal `rgba(224,138,159,X)` values
    already established elsewhere in this same file (`.hb-day.active`,
    `.at-task-pending`) rather than hex copies of a cyan palette.
  - **Reference photo worked into the panel background**: the actual
    "Solo Leveling: Beyond the System" reference photo (confirmed to
    really be a JPEG despite its `.heic` filename — `FFD8FF` SOI/JFIF
    header — so no HEIC transcoding was needed) is embedded as a
    resized (640×853) and recompressed (JPEG q62, ~50KB) base64 `data:`
    URI directly in the stylesheet, not committed as a separate binary
    file — keeping with this repo's existing "images live as data URLs
    inside JSON/CSS, not as checked-in asset files" convention (same
    pattern user-uploaded covers already use, just static this time
    instead of runtime-uploaded). It sits on a new `#atPanelHabits::before`
    layer, under three gradient layers in the page's own wine/rose
    colors (the same `rgba(23,10,18,*)`/`rgba(11,5,9,*)`/
    `rgba(224,138,159,*)`/`rgba(167,139,250,*)` values `body::before`
    and the cover banner already use) plus `filter: saturate(0.4)
    brightness(0.6)` — desaturated/darkened rather than hue-rotated, so
    the gradient's rose/wine tint carries the color instead of an
    unpredictable filter-shifted hue. The existing neutral scanline
    `::after` layer sits on top of it unchanged. Net effect: the photo
    (its HUD panel outlines, the notification box, the "Solo Leveling"
    logo) is visible as a faint watermark-like texture behind the real
    cards, tinted into the page's own colors rather than shown at its
    native blue.
  - **Progress bars**: three new pure functions —
    `computeHabitProgress(habit)` (current streak ÷ `targetStreak` when
    a habit has one set; otherwise this week's scheduled-vs-done ratio
    from Sunday through today, so every habit has a meaningful bar even
    without a target) and `computeRoutineTodayProgress(routine)` (how
    many of a routine's habits are already checked off *today* — a
    routine has no streak of its own, so "progress" is today's
    completion, not a historical measure) — plus a shared
    `buildProgressRow(pct, labelText)` that reuses `buildGoalCard()`'s
    existing `.goal-card-progress-row`/`.std-bar`/`.std-bar-fill`/
    `.goal-card-pct` markup verbatim (same component, not a new one).
    Wired into all three habit/routine surfaces: each Today quest row
    (`buildHabitTodayRow`, a small 4px bar under the title/cue — applies
    to both anchor and nested stacked rows, since `buildHabitTodayRow`
    already serves both), each "All Habits" card (`buildHabitCard`, a
    full-size bar under the header), and each Routine card
    (`buildRoutineCard`, a full-size bar showing today's X/N completion
    under the header, above the ordered habit-sequence chips).
  - Verified via headless Edge with Supabase blocked (`--host-resolver-
    rules=MAP *.supabase.co 0.0.0.0`, confirmed via CDP before any
    navigation): seeded a stacked anchor habit (target streak 10, 1-day
    streak logged), its two stacked sub-habits, a solo habit, and a
    3-habit routine with 2 of 3 done today; confirmed all three
    progress-bar call sites render the right width/label (`1/10`,
    `1/4 this wk`, `2/3 today`), confirmed the recolor (computed
    `#atPanelHabits` background, modal screenshot) shows the dusty-rose/
    wine palette with no leftover cyan, confirmed the background photo
    (`getComputedStyle(..., '::before').backgroundImage`) resolves to a
    `data:image` URI and is visibly tinted-through in a full-page
    screenshot, and confirmed zero console errors/exceptions across the
    whole pass.

- **Habits & Routines: habits can link photos/videos.** Purely additive
  follow-up — no existing field, page, or input was removed. Reused
  `gym.html`'s already-established exercise-media pattern verbatim
  (same data shape and compress/size-cap strategy) rather than inventing
  a new one, ported from that file's ES6 syntax into this file's own
  ES5 `function`/`var` style to match its existing code.
  - **Data**: habits gained an additive `media: []` field (`{id, type:
    'image'|'video', dataUrl, name}`), undefined on pre-existing habits
    and treated identically to `[]` everywhere it's read. It lives
    inline on the habit object, so deleting a habit deletes its media
    with it — no separate orphan cleanup needed (unlike
    `stackedHabitIds`/routine references, which point at other
    entities by id).
  - **Upload pipeline** (`compressImageDataUrl`/`addMediaFiles`, new):
    images are canvas-downscaled to 640px/JPEG quality 0.75 before
    storage; video can't be transcoded client-side so it's just
    size-capped at 8MB with an `alert()` on rejection — identical
    behavior/thresholds to `gym.html`'s exercise media, since this is
    the same "no binary assets, images live as data URLs" convention
    already established there.
  - **Habit modal** gained a "Photos & videos" field: an editable
    `.hb-media-grid` of thumbnails (`renderMediaGrid`, each with a ✕ to
    remove) plus a "+ Add photo / video" button opening a hidden
    `accept="image/*,video/*" multiple` file input — same
    button-triggers-hidden-input pattern already used for cover-image
    uploads elsewhere in this app. Draft state (`habitEditingMedia`)
    follows the same open-modal-clones-into-draft / save-writes-draft-
    back convention as `habitEditingStackIds` right next to it.
  - **All Habits cards** show a read-only `.hb-media-grid`
    (`renderMediaGridReadonly`, no delete buttons) when a habit has any
    media, placed after the stack chips and before the streak heatmap.
    Today's quest cards and Routine cards were deliberately left
    unchanged — the request was scoped to "each task" (this app's
    established synonym for "habit" in this section, per the original
    stacking request), not routines, and the compact Today grid has no
    room for thumbnails without cluttering the two-column quest layout.
  - New `.hb-media-grid`/`.hb-media-thumb`/`.hb-media-thumb-del`/
    `.hb-media-empty` CSS is the same layout recipe as `gym.html`'s
    `.media-grid`/`.media-thumb`/etc., just pointed at this file's own
    `--at-border`/`--text-tertiary`/`--danger` tokens instead of
    `gym.html`'s `--border`/`--text-3` — plus a small `#habitModalBg
    .at-mini-btn` rose-toned override so the new "+ Add photo / video"
    button matches this modal's existing recolored look rather than
    falling back to the plain global `.at-mini-btn` style.
  - Verified in headless Edge with Supabase blocked: opened the Add
    Habit modal, confirmed the new field renders with an empty-state
    message, confirmed every other existing field/button in the same
    modal (name, area, cue, routine, reward, frequency, days, time,
    target streak, stack picker, cancel/save/delete) is still present
    and unchanged, and confirmed no other page/tab/nav pill was touched.

- **Habit media switched from file upload to a pasted URL.** Follow-up
  to the entry above, same session — the file-upload pipeline
  (`compressImageDataUrl`/`addMediaFiles`/`MEDIA_MAX_VIDEO_BYTES`, the
  hidden `<input type="file">`, and the button-click-triggers-file-
  picker wiring) was deleted outright rather than kept as unreachable
  dead code, since this is the same session's own immediate
  supersession of a mechanism it just added — the same precedent
  `gym.html`'s Templates rebuild already set converting its old
  multi-select equipment chips into a single picker (that call only
  protects code some *other* pass intentionally left behind, not a
  feature replacing itself one message later).
  - The habit modal's "Photos & videos" field is now a URL row
    (`.hb-media-url-row`): a Photo/Video `<select>`, a text input
    ("Paste an image or video URL…"), and an "+ Add" button (Enter key
    also submits). `isValidMediaUrl()` (new) requires `new URL(value)`
    to parse *and* resolve to `http:`/`https:` — same validate-before-
    accept precedent as `selfcare.html`'s meditation-link modal — and
    blocks Add with an `alert()` otherwise.
  - **No data-shape or migration change**: `habit.media[]` still stores
    `{id, type, dataUrl, name}` — `dataUrl` now holds a plain http(s)
    URL instead of a `data:` URI, but `<img>`/`<video src>` accept both
    identically, so any habit media added under the old upload flow
    keeps rendering exactly as before with zero migration code.
  - **Real bug fixed while making this change**: the old renderers built
    `<img src="...">`/`<video src="...">` via string-concatenated
    `innerHTML`, which was safe only because the source was always an
    app-generated base64 blob (never contains `"`). Now that the value
    is arbitrary user-pasted text, that would have been an HTML-
    injection path (a URL containing `">` could break out of the
    attribute). Fixed by rewriting `renderMediaGrid`/
    `renderMediaGridReadonly` to build the `<img>`/`<video>` via DOM
    APIs and assign `.src` as a property instead of interpolating it
    into markup — not parsed as HTML, so this class of injection isn't
    reachable regardless of what the pasted URL contains. Both renderers
    now share one `buildMediaThumb(m, onRemove)` helper (editable grid
    passes a remove callback, the read-only grid on habit cards passes
    `null`) instead of two near-duplicate implementations.
  - Verified in headless Edge with Supabase blocked: an existing habit's
    media saved under the old upload flow (a base64 data-URI thumbnail
    from the prior entry's own test) still rendered correctly after this
    change with no migration step; adding a valid `https://` image URL
    worked end-to-end (modal thumbnail → Save → persisted in
    `main:habits` → thumbnail on the All Habits card); an invalid URL
    (`not-a-url`) was rejected with the modal staying open and nothing
    added; and every other pre-existing field in the same modal was
    re-confirmed present and untouched.

- **Bugfix: habit media thumbnails were blank and unclickable for most
  real-world pasted links.** Root cause: most "photo/video URLs" people
  actually have (a Google Photos/iCloud/Instagram share link, a Dropbox
  page, etc.) aren't a direct hotlinkable file URL, so the `<img>`/
  `<video>` element failed to load — the thumbnail just stayed an empty
  box with nothing wired up to click. Confirmed the failure mode
  directly in headless Edge before fixing: a real image URL
  (`w3.org/Icons/w3c_home.png`) loaded and rendered fine, but a page URL
  used as an image `src` fails silently with no fallback.
  - `buildMediaThumb()` now attaches a click handler to the whole
    thumbnail that opens `m.dataUrl` in a new tab (`window.open(url,
    '_blank', 'noopener')` — same pattern already used for meditation
    links in `selfcare.html`), so the link is always reachable regardless
    of whether it can preview inline.
  - The `<img>`/`<video>` now has an `error` listener that adds
    `.hb-media-thumb-broken`, which swaps in a new `.hb-media-thumb-
    fallback` icon (🔗 for photos, 🎬 for videos) instead of leaving a
    blank box — new CSS, `.hb-media-thumb { cursor: pointer; }` plus the
    fallback's `display:none` unless `.hb-media-thumb-broken` is present.
  - Readonly video thumbnails (All Habits cards) keep their native
    `controls` — those clicks now call `stopPropagation()` so pressing
    play doesn't also pop open a new tab; the delete button (✕, editable
    grid only) already did the same to keep it independent of the new
    open-link behavior.
  - Verified in headless Edge with Supabase blocked, `window.open`
    stubbed to capture calls instead of actually opening tabs: a working
    image URL loads normally, isn't marked broken, and clicking it opens
    the correct URL; a non-image page URL gets marked
    `.hb-media-thumb-broken`, shows the fallback icon, and clicking it
    still opens the correct URL; and clicking the delete button removes
    the item without also triggering an open. Zero console errors.

- **Habits & Routines: added a freeform Instructions field to each
  habit.** Purely additive — no existing habit, routine, or page was
  touched or removed; verified directly (see below).
  - Habits gained an additive `instructions: ''` string field
    (undefined on pre-existing habits, same "treated as empty" default
    as every other optional habit field). Distinct from the existing
    `cue`/`routine`/`reward` fields — those are the short cue-routine-
    reward triad from the original habit model; `instructions` is a
    longer freeform textarea for step-by-step guidance, form cues, or
    any other detail, same spirit as `gym.html`'s exercise `notes`
    field.
  - **Habit modal**: a new "Instructions" `<textarea>` sits right after
    Reward — reuses the modal's existing `.field textarea` styling
    (which didn't previously need modal-specific colors since this
    modal's `.field input`/`.field select` recolor rule didn't cover
    `textarea` yet — extended it to include `textarea` so the new field
    matches the rest of the modal instead of falling back to the plain
    global style).
  - **Displayed in two read surfaces**, both already-established
    patterns extended rather than new components: the "All Habits" card
    (`buildHabitCard`, a new `.habit-card-instructions` block, right
    after the progress bar) and the Run Routine step-through view
    (`makeRunField('Instructions', habit.instructions)`, alongside the
    existing Cue/Routine/Reward fields shown one habit at a time while
    running a routine). Both — plus `.run-routine-field-text`, shared
    with Cue/Routine/Reward — gained `white-space: pre-wrap` so
    multi-line instructions actually keep their line breaks instead of
    collapsing to one line (harmless for the single-line Cue/Routine/
    Reward text, which never contains a newline).
  - Verified in headless Edge with Supabase blocked: seeded one
    pre-existing habit and one pre-existing routine, confirmed both
    still present after a reload (not deleted by this change), opened
    the habit's edit modal and confirmed every other field (cue, stack
    picker, media) was still there alongside the new Instructions
    field, saved a 3-line instructions value, confirmed it rendered
    with line breaks intact on the All Habits card and persisted
    correctly in `main:habits`, confirmed the same text appears under
    an "Instructions" label when running that habit's routine, and
    confirmed all 9 nav pills and all 7 Main sub-tabs were still
    present (no page was removed). Zero console errors.

- **Habit Instructions field now autosizes instead of internally
  scrolling.** The `<textarea>` was a fixed-height `.field textarea`
  (the shared style every other modal textarea in this file also
  uses), so any instructions longer than a few lines required
  scrolling inside the box to read the rest. Wired it to this file's
  existing `autosize(ta)` helper (already used for Overview notes/
  business notes/journal entries — `ta.style.height = 'auto'; ta.style.
  height = ta.scrollHeight + 'px'`) instead of writing a new one: an
  `input` listener grows it live while typing, and `openHabitModal()`
  now also calls it in a `setTimeout(..., 0)` after the modal is shown
  (same precedent as every other autosize call site — needs to run
  after layout, not while the modal is still `display:none`) so
  reopening a habit with existing long instructions is already
  full-height on open, not just after the next keystroke.
  - **Scoped, not shared**: `resize: none; overflow: hidden;` — needed
    so the box only grows and never shows an internal scrollbar — was
    added under the `#habitInstructionsInput` ID selector specifically,
    *not* by editing the shared `.field textarea` rule every other
    modal textarea in this file (Life Area vision/description, Goal
    why/description, Business description, Self-Discovery entry body)
    still uses unmodified. Changing the shared rule would have silently
    made all of those fixed-height-with-clipped-overflow too, since
    none of them call `autosize()` — confirmed after the change that
    `#areaVisionInput` (Life Areas) still reports `resize: vertical`,
    unaffected.
  - Verified in headless Edge: typed a 15-line instructions value and
    confirmed the textarea grew to `scrollHeight` with `resize: none`/
    `overflow: hidden` (no interactive scrollbar — the ~2px `scrollHeight`
    vs `clientHeight` delta observed is exactly this file's global
    `box-sizing: border-box` border width, not clipped text); saved,
    reopened the same habit, and confirmed the field was already
    full-height on open via the `setTimeout` autosize call, not just
    after typing; and reconfirmed all 9 nav pills still present. Zero
    console errors. Nothing was deleted — purely a sizing/CSS change to
    one existing field.

- **Tasks tab restyled to match Habits & Routines: same HUD panel,
  same background photo, same palette.** Explicit ask to give the
  Tasks tab (`#atPanelTasks`) "the exact same color scheme, background,
  and aesthetic setup" as the Habits & Routines panel. Pure CSS —
  no HTML structure, no JS, no data shape changed, so every existing
  control (filters, grouping/sort, quick-add, the "📄 Open" button, the
  task detail page's Notes blocks and their add/reorder/delete buttons)
  works exactly as before, just recolored.
  - **Shared structural rules extended, not duplicated**: every
    `#atPanelHabits` selector that was purely structural (the panel
    background/photo/scanline layers, `.at-col-head`/`h2`, `.at-mini-btn`
    — which already covers the "+ Add Task" and "📄 Open" buttons since
    both reuse that same class, `.section-title`, `.at-empty`, the
    mobile margin media query) now reads `#atPanelHabits, #atPanelTasks
    { ... }` instead of gaining a second near-identical rule block.
  - **Tasks-specific components** (new rules, since `.at-due-card` and
    friends are shared with Goals/Overview/Business task lists
    elsewhere in this same file — every rule scoped under
    `#atPanelTasks` specifically, never the bare class, so those other
    tabs' task rows are untouched): `.chip`/`.chip.active` (view/filter
    toggles), `.task-filter-select`, the quick-add row's input/button,
    and `.at-due-card`/`.at-due-check`/`.at-due-title` (notched panel,
    gold done-state — same visual role as the Habit quest checkbox,
    matched to it; priority pills/status/recurrence badges were
    deliberately left on their original `--info`/`--warning`/`--danger`
    colors, same "status colors carry meaning, not brand accent"
    precedent every other re-theme in this file already follows —
    Habits has no equivalent priority/status-badge component to match
    against anyway).
  - **Add/Edit Task modal** (`#gTaskModalBg`) reskinned with the same
    recipe as `#habitModalBg`, applied to this modal's own field set
    (title, note, status, priority, due date, area/goal/business/habit
    links, estimate, daily checkbox, recurrence).
  - **Task detail page** (`#taskDetailPageBg`, opened via "📄 Open" —
    title, meta row, Notes blocks list, "+ Notes" button) reskinned
    too, but scoped strictly to `#taskDetailPageBg`, *not* the bare
    `.wfd-*` classes it's built from — those exact same classes are
    also used by `#workflowDayPageBg` (Business Workflow's day detail
    page), which must stay on its own existing look untouched. One
    real wrinkle: this page scrolls internally (`.wfd-page-bg` has
    `overflow-y: auto`), so a background layer positioned like the
    panels' (`position: absolute`) would scroll away with the notes
    instead of staying put — used `position: fixed` for
    `#taskDetailPageBg::before`/`::after` instead (same technique
    `example.html`'s own fixed decorative background layers already
    use in this file), so the photo/scanline stay anchored to the
    viewport while the notes list scrolls over them.
  - **Avoided duplicating the ~50KB encoded background photo a second
    time**: pulled it into a new `--hb-bg-photo` custom property
    defined once at `:root` (`url("data:image/jpeg;base64,...")`), with
    both `#atPanelHabits::before`/`#atPanelTasks::before` (already
    combined into one rule, `position: absolute`) and the new
    `#taskDetailPageBg::before` (`position: fixed`) referencing it via
    `var(--hb-bg-photo)` instead of each carrying their own inline copy
    — same base64 payload, extracted once from the file's existing
    embedded copy and substituted programmatically (not re-derived from
    the original image) so it's guaranteed byte-identical, confirmed
    the original inline `url(...)` occurred exactly once before the
    swap.
  - Verified in headless Edge with Supabase blocked: the Tasks panel
    renders the same wine/rose gradient + tinted photo + scanline
    backdrop as Habits & Routines with matching notched task rows/mono
    labels; the Add Task modal and the task detail ("📄 Open") page both
    show the same recolor; added a note via "+ Notes", confirmed it
    saves/renders/reorders/deletes exactly as before; confirmed
    `#workflowDayPageBg` (Business Workflow's day detail, same `.wfd-*`
    classes) is visually unchanged; and reconfirmed all 9 nav pills and
    all 7 Main sub-tabs are still present. Zero console errors.

- **Overview tab (`index.html`) rebuilt into a real hub: a "Dream Life"
  media board, live summaries of Businesses/Self-Discovery, a
  read-only "Connected Apps" snapshot of every other top-level page,
  and the same Habits & Routines/Tasks HUD reskin.** Per an explicit
  ask to "connect the data of all of the tabs and pages" to Overview
  without deleting anything. Everything below is additive — the
  pre-existing Today's Habits/Upcoming Tasks/Goal Progress by Life
  Area/Notes sections are untouched in behavior, just visually
  restyled along with the rest of the panel.
  - **HUD reskin**: `#atPanelOverview` was added to every combined
    selector `#atPanelHabits, #atPanelTasks` already used (background
    photo/gradient/scanline, mono section headings, `.at-mini-btn`,
    `.at-task`/`.at-due-card` quest/task-card notched-panel styling),
    plus new Overview-only rules for its own row/tile components
    (`.ov-area-row`/`.ov-biz-row`/`.ov-self-row`, `.ov-ext-tile`,
    `.dream-card`) built from the same `--at-*` tokens — no new colors,
    same DO NOT MODIFY §2 discipline as every prior HUD extension.
  - **Dream Life board** (top of Overview, `main:dreamLife = [{id,
    title, body, media:[{id,type,dataUrl,name}], createdAt}]`) — the
    "input text, photos, videos, etc. for what I want my dream life to
    look like" database. Same inline-autosave-card-with-reorder pattern
    as the existing Notes sections (`buildNoteSectionCard`/
    `main:overviewNotes`) for title/body, plus the media-by-URL
    components already built for Habit media
    (`isValidMediaUrl`/`buildMediaThumb`/the `.hb-media-*` CSS) reused
    verbatim rather than rebuilt — those were already fully generic,
    not habit-specific, so this is the same "reuse an existing
    component, don't invent a fourth one" precedent as `.ent-card`/
    `.chip`/`.modal-bg` elsewhere in this app. No file upload (matches
    the earlier, deliberate habit-media file-upload → URL-paste
    supersession) — paste an image/video URL, same validate-before-add
    and click-to-open/broken-link-fallback behavior as habit media.
  - **Businesses summary** (`renderOverviewBusinesses`) — one row per
    `main:businesses` entry (icon/name, average goal progress via the
    existing `computeGoalProgress`, goal/task counts), click jumps to
    that business's own tab via the exact same `activeBizId = biz.id;
    switchTab('businesses')` the Businesses sub-tab chips already use
    — no new navigation mechanism.
  - **Self-Discovery summary** (`renderOverviewSelf`) — 5 most recent
    `main:selfentries`, click opens the same `openEntryModal()` the
    Self-Discovery tab itself uses (no navigation needed at all, since
    it's already the same page/DOM).
  - **Connected Apps** (`renderOverviewConnectedApps`) — a 7-tile grid,
    one per other top-level page (Fitness Studio/Finance/Media/Brain
    Dump/Nutrition/Household/Self-Care), each showing 2-3 real live
    stat lines read straight from that page's own localStorage
    key(s) — same shared-origin localStorage this whole app's sync
    model already depends on (see CLAUDE.md §4), so no iframe/network
    call is needed to read another page's data, only a page navigation
    (plain `<a href>`) to actually edit it. Deliberately **read-only
    and parsed directly from raw localStorage** rather than by loading
    `finance-data.js`/`household-data.js`/`selfcare-data.js`/
    `nutrition-data.js` into `index.html` to reuse their clean
    `Collection.list()` APIs — every one of those files calls its own
    `seedIfEmpty()`/migration function at IIFE load time, and pulling
    them into Overview would risk silently seeding fake demo data into
    another page's store the first time someone opens the Main tab on
    a fresh device, before ever opening that page itself. Instead each
    tile's reader (`safeParseLS` + a small per-page block inside
    `renderOverviewConnectedApps`) parses the known key(s) directly
    (`po_coach_v1`/`po_coach_workout_done`, `financev2:accounts`/
    `financev2:transactions`, the four `media:*` galleries,
    `braindump:entries`, `nutrition:groceryItems`/`nutrition:recipes`,
    `household:inventory`/`household:chores`,
    `selfcare:waterLog`/`journalEntries`/`bucketList`), wrapped in
    try/catch, and treats missing/malformed data as "not connected
    yet" (an empty-state line) rather than throwing — confirmed some of
    these pages have moved past what CLAUDE.md's own earlier changelog
    entries described (e.g. `finance.html` now runs on a newer
    `financev2:*` schema via `finance-data.js`, not the older
    `finance:*`/`nw:*` keys documented above) — read the live code as
    ground truth per this file's own §6 philosophy, not the older
    changelog text. Tile lines are built via `document.createTextNode`/
    `textContent`, never `innerHTML` — several of the values being
    displayed (routine names, chore names, media titles) are arbitrary
    user-authored text from another page, same class of risk already
    fixed once for pasted habit-media URLs, so the same DOM-not-markup
    precedent applies here from the start rather than needing a second
    fix later.
  - Chose **not** to attempt full in-place CRUD for every other page's
    features (e.g. checking off a chore, editing a transaction, right
    from Overview) — that would mean substantially duplicating each
    page's own UI/logic a second time inside `index.html`, which is a
    different scale of change than "connect the data and make it
    visible and interactable." Cross-page data is visible with real
    live numbers and one click away from its real page; same-page data
    (Habits/Tasks/Life Areas/Businesses/Self-Discovery, all already
    part of the Main tab) is fully interactive in place, exactly as it
    already was.
  - Verified in headless Edge with Supabase blocked (`--host-resolver-
    rules="MAP *.supabase.co 0.0.0.0"`, armed before navigation): seeded
    realistic data across every one of the keys above (Main tab's own
    stores plus `po_coach_v1`/`financev2:*`/`media:*`/`braindump:entries`/
    `nutrition:*`/`household:*`/`selfcare:*`), confirmed the HUD
    background/photo/mono styling renders on `#atPanelOverview`; added a
    Dream Life entry with a title/body/pasted image URL and confirmed it
    persisted to `main:dreamLife` correctly; confirmed the Businesses row
    renders real goal/task counts and clicking it switches to the
    Businesses tab with the right business active; confirmed the
    Self-Discovery row renders and is clickable; confirmed all 7
    Connected Apps tiles render correct live numbers matching the seeded
    data (today's routine/workout count, net worth/monthly spend, media
    saved/favorites count, brain dump entry status, grocery/recipe
    counts, low-stock/chores-due counts, water/journal/bucket-list
    counts); confirmed the pre-existing Today's Habits/Upcoming
    Tasks/Goal Progress/Notes sections still render and behave exactly
    as before; confirmed the Habits & Routines, Tasks, and
    Self-Discovery tabs still render correctly (nothing else on the
    page was disturbed); confirmed all 8 nav pills and all 7 Main
    sub-tabs are still present; confirmed no horizontal overflow at a
    390px mobile viewport; and confirmed zero console errors throughout.

- **Overview layout follow-up: fixed a desktop-only stretch bug and a
  misaligned Self-Discovery row, found by actually screenshotting the
  page at a real desktop width (1440px) instead of only the narrower
  width used above.** Two real bugs, not just polish:
  - **Dream Life cards stretched edge-to-edge on wide screens.**
    `.dream-grid` used `repeat(auto-fill, minmax(260px, 1fr))` — with
    only one card, `auto-fill` still only creates as many tracks as fit
    (one, when there's only one card wider than the container's
    remaining space), so that single track's `1fr` stretched the card
    across the full ~1100px content width instead of sitting at a
    natural size. Fixed by switching to `repeat(auto-fit, minmax(260px,
    380px))` — a bounded max instead of `1fr`, so a card never grows
    past 380px regardless of how few there are, while `auto-fit` still
    lets multiple cards sit side-by-side once there's enough of them.
  - **Self-Discovery rows had a wide, dead gap between the type badge
    and the title.** `renderOverviewSelf` reused `.ov-area-row-head`
    (built for the Life Area rows' "name ... percent" pair, i.e.
    `justify-content: space-between`) for its own "badge + title" pair,
    which has nothing to push to the far right — so the badge sat
    pinned left and the title got shoved to the far right edge with a
    large empty gap between them. Fixed with a dedicated
    `.ov-self-row-head` (`flex-start` + a small gap, title `flex:1;
    min-width:0` so a long title wraps naturally instead of overflowing
    or forcing the row wider) instead of reusing a class built for a
    different layout shape.
  - **Connected Apps grid's column width bumped 220px → 260px** so 7
    tiles split 4-then-3 instead of 5-then-2 at common desktop widths —
    a minor balance fix, not a bug, done at the same time since it was
    visible in the same screenshot pass.
  - **The Dream card's photo/video URL row (select + text input + Add
    button) needed its own explicit sizing.** The shared
    `.hb-media-url-row select`/`input[type="text"]` sizing rules
    (`flex-shrink:0`/`flex:1; min-width:0`) are scoped under `.field`,
    since that's the only place this row existed before (inside the
    Habit modal's `.field`-wrapped rows). The Dream card's copy of this
    row isn't inside a `.field`, so without an explicit rule the text
    input would've fallen back to its browser-default intrinsic width
    instead of flexing to the card's actual width — added
    `#atPanelOverview .hb-media-url-row select/input[type="text"]`
    rules (sizing + this page's own dark-field look) so it behaves
    identically without requiring a `.field` wrapper that isn't there.
  - Verified in headless Edge at both 1440px desktop and 390px mobile
    with the same seeded dataset as the entry above (one Dream Life
    entry with an image, 3 habits, 2 tasks including a long title, 2
    life areas, a business, and a long-titled Self-Discovery entry, plus
    all 7 Connected Apps sources): the Dream card now sits at a natural
    ~380px width on desktop instead of stretching full-width; the
    Self-Discovery row's badge and title now sit close together with the
    title wrapping onto multiple lines on both narrow and wide screens
    instead of being pushed apart; Connected Apps renders a 4-then-3
    split at 1440px; the media URL row fits on one line with no overflow
    at 390px; no horizontal overflow at 390px either before or after;
    and zero console errors.

- **New page: `dreamboard.html` ("Dream Board"), a drag-and-drop vision-
  board page built from a detailed written spec** (a synthesis of three
  Notion "dream life"/planner template screenshots — no `dashboard.html`
  prototype actually existed in the repo to port from, so the spec text
  was treated as ground truth over the screenshots wherever they
  diverged). Genuinely new file, plus a new companion data file,
  `dreamboard-data.js` — new nav pill (`DREAM BOARD` → `dreamboard.html`,
  appended after `SELF-CARE` in `topbar.js`'s injected pill list — the
  only edit made to `topbar.js`; note `topbar.js` currently has **no**
  `EXAMPLE` pill despite CLAUDE.md's own `example.html` changelog entry
  claiming one was added — that entry describes work that isn't actually
  present in this file today, a pre-existing doc/code mismatch this
  session found but left alone since fixing it wasn't asked for); new
  sync key (`appKey: 'dreamboard'`, `syncedPrefixes: ['dreamboard:']`,
  wired via the standard shared `initCloudSync` — same call pattern as
  every other page, nothing new invented).
  - **Palette exception, explicit and deliberate**: the request gave
    literal hex values (cream `#F7F3EC` background, paper `#FEFDFB`
    cards, blush `#F1E3DC` accent, ink `#2B2724` text, muted `#9A8F82`
    labels, hairline `#E7DFD3` borders) and named fonts (Cormorant
    Garamond serif for the banner/card titles, Inter for body text) —
    the same category of one-off reference-instruction exception as
    `braindump.html`'s forest theme or `gym.html`'s crimson grading (see
    CLAUDE.md §6/DO NOT MODIFY rule 2), just a light theme instead of a
    dark one this time. No other page's tokens were touched. Since
    Cormorant Garamond isn't a system font and this repo has no local
    font files, it's loaded from Google Fonts via a `<link>` tag — the
    same "small CDN dependency, no build step" precedent already set by
    loading the Supabase JS SDK from jsDelivr in every other page.
  - **Data model** (`dreamboard-data.js`, same model-factory +
    `makeCollection` + pure-selector conventions as `household-data.js`/
    `finance-data.js`): two flat collections, `dreamboard:tabs`
    (`{id, title, order}`, four seeded by default — Vision Board /
    Reflections / Quarterly Goals / Monthly Breakdown, inline-
    renameable via a "✎" next to the active tab, not user-addable/
    removable — the request said "editable tab row," which this reads
    as rename, not full tab CRUD, a deliberate scope call) and
    `dreamboard:widgets` (`{id, tabId, column (0-2), order, type, title,
    accent, data}` — the same flat-array-with-foreign-key convention as
    `index.html`'s Goals/Tasks/Milestones, not a nested tree). Eight
    widget types cover every item in the request's widget list without
    inventing a type per named example: **Checklist** (My Goals/Morning
    Routine/Evening Routine/category checklists are all just Checklist
    instances with different titles — My Goals seeded with
    `accent: 'blush'` per the "My Goals (blush)" instruction), **List**
    (the "How I Am ♡" personality traits — same item shape as Checklist
    minus the checkbox), **Note** (the "My biggest goals" freeform
    text), **Quote**, **Affirmation** (a card-styled variant of List),
    **Steps Tracker**, **Photo/Video Grid**, and **Calendar**. A
    `dreamboard:banner` key (not a collection — just `{title,
    subtitle}`) holds the editable "a new era of me" banner text, and
    `dreamboard:active_tab` persists which tab was last open — both
    already covered by the single `syncedPrefixes: ['dreamboard:']`
    entry, no extra sync wiring needed. `seedDefaultBoard()` splits the
    default widgets thematically across the four tabs (Vision Board →
    photo grid + quote + affirmations; Reflections → personality list +
    goals note; Quarterly Goals → three checklists; Monthly Breakdown →
    calendar + morning/evening routines + steps tracker) — a judgment
    call made to loosely mirror which of the three reference screenshots
    each tab's content came from, not copied verbatim from any of them.
  - **Drag-and-drop**: this repo has never used real drag-and-drop
    anywhere before (every other page's manual reordering is up/down-
    arrow swaps — Life Areas, Overview notes, Media's Manual sort, etc.)
    — since the request explicitly asked for handle-based drag within
    AND between columns, and this is a vanilla-JS repo with no React
    (so dnd-kit doesn't apply), **SortableJS** was added via CDN
    (`cdn.jsdelivr.net/npm/sortablejs@1.15.2`), the same "small CDN
    dependency, no build step" precedent as the Supabase SDK. One
    `Sortable` instance per board column (`.db-col`), all three sharing
    one `group` name scoped to the active tab so cards can move between
    columns but never leak into another tab's (unrendered) columns;
    `handle: '.dw-drag-handle'` so dragging only starts from the ⋮⋮
    handle, never from clicking into a title/item to edit it. Every
    drag end reads the current DOM order of all three columns and does
    one bulk write (`DreamBoardData.reorderTab`) rather than one
    `update()` call per moved widget. `animation` drops to 0 under
    `prefers-reduced-motion: reduce`, matching the page-wide reduced-
    motion media query that also zeroes out CSS transitions/animations.
  - **Inline editing** covers everything the request named: banner
    title/subtitle, tab titles (via the rename-in-place `✎` flow above),
    widget titles, checklist/list/affirmation item text (`contentEditable`
    spans, commit on blur/Enter, revert on Escape, delete-the-item if
    left empty — the same shared `wireInlineEdit()` helper used
    everywhere), quote text/author, and calendar day notes (a
    `<textarea>` in a small modal, since a day note is realistically
    multi-line and a calendar cell has no room for inline text). Note
    bodies use an autosizing `<textarea>` with save-on-blur rather than
    `contentEditable`, matching this app's own established convention
    for larger freeform text elsewhere (Overview notes, business notes).
  - **Checklists**: toggle via a real checkbox (not a custom div, unlike
    `index.html`'s Goals page — a plain checkbox was simplest and
    sufficient here), add via an inline text input + Enter/+-button,
    delete via a per-row × button — all three also apply to List/
    Affirmation widgets (List/Affirmation just render without the
    checkbox and with card-styled rows for Affirmation).
  - **Photo/video grid**: "1 ↔ 2 column toggle per photo widget" was
    read as toggling the widget's own internal thumbnail grid between a
    single column and a 2-across grid (matching how the two reference
    screenshots actually differ — one shows a vertical single-column
    photo stack, the other a 2×2 grid) rather than the widget spanning
    across two of the board's three physical columns, which would have
    fought with having three independent `Sortable` lists as separate
    DOM containers. Adding a slot opens a modal offering either a file
    upload or a pasted URL (mirroring `entertainment.html`'s established
    paste-or-upload cover-art flow); an uploaded image is downscaled via
    the same canvas-based `compressImageDataUrl()` recipe every other
    page in this app already uses and stored as a base64 `data:` URL
    (persisted, synced, survives reload). **Video is different by
    necessity**: this app has no backend/file storage at all (see
    CLAUDE.md §2/§4), so an uploaded video file becomes a session-local
    `URL.createObjectURL()` blob that is never written to `localStorage`
    or pushed to Supabase — only the slot's metadata persists. After a
    reload (or on another device via sync), that slot renders a "🎬
    Video needs to be re-attached" placeholder with a one-click
    re-attach button instead of silently showing nothing — a pasted
    video URL, by contrast, is a plain string and works normally after
    reload since there's nothing to re-attach. A visible caption under
    every photo/video grid says as much, so this isn't a surprise
    discovered only by losing a video.
  - **Add Widget menu** (a modal listing all eight widget types with a
    one-line description each) appends the new widget to whichever of
    the active tab's three columns currently has the fewest widgets.
    **Per-widget delete** lives in every card's header (with a
    `confirm()`, and cleans up any session video blob URLs first so
    they don't leak). **Reset to Default** (`confirm()`-gated) calls
    `DreamBoardData.seedDefaultBoard()`, which wipes and rebuilds both
    collections from scratch — the same "wipe with confirm, rebuild
    from the seed function" pattern this app hasn't needed elsewhere
    but is the natural counterpart to every other page's one-time
    `seedIfEmpty()`.
  - **Accessibility**: `:focus-visible` outlines added globally (this
    page's own addition — not present in the shared `topbar.js` CSS,
    which this page still inherits for its top nav bar and modal
    scroll-lock/full-screen behavior since every modal here uses the
    plain `.modal-bg`/`.modal` classes already in `topbar.js`'s
    `MODAL_SELECTORS`, needing no `topbar.js` edit); a
    `prefers-reduced-motion: reduce` media query collapses all CSS
    transitions/animations to near-zero duration and also zeroes
    SortableJS's own drag animation; the board is a CSS grid that
    collapses 3 → 2 → 1 columns by viewport width (a graceful
    simplification: below 3 columns, the three physical column
    containers just stack in order rather than truly re-flowing card-
    by-card, which is an accepted trade-off for a column-based board,
    not a bug). **Known limitation, not addressed**: reordering itself
    is still mouse/touch-only, since SortableJS (like effectively every
    drag-and-drop library) has no built-in keyboard-operable reorder
    path — every other interactive element (checkboxes, add/delete
    buttons, tab rename, modals) is fully keyboard-operable.

- **Dream Board (`dreamboard.html`) re-themed dark/cinematic to match a
  destination-wedding-photographer portfolio reference photo, gained a
  per-tab hero cover section, and two new widget types — all follow-up
  to the page's initial build above, per an explicit request to match
  a new reference image while keeping every existing widget/DnD/editing
  capability intact.** Nothing built in the original pass was removed;
  this is a re-skin plus two additions, verified by re-reading every
  function end to end (see the testing note below on why that, and not
  a live browser, is what verified this pass).
  - **Palette flip, deliberate**: the light cream/paper/blush/ink look
    this page launched with is retired in favor of the reference photo's
    near-black + warm champagne/gold grading (`--db-bg`/`--db-gold`/
    `--db-gold-bright`/`--db-hairline` etc., replacing the old `--cream`/
    `--paper`/`--blush`/`--ink`/`--muted`/`--hairline` tokens one-for-
    one). Still the same category of one-off reference-photo exception
    as `braindump.html`'s forest theme or `gym.html`'s crimson grading
    (CLAUDE.md §6/DO NOT MODIFY rule 2) — just a second, different
    exception replacing the first on this same page, not a new
    precedent for the rest of the app. `--success`/`--warning`/`--danger`
    were left as the app's usual green/amber/red-coral (status meaning,
    not brand accent — same precedent every other re-theme in this file
    follows). Cormorant Garamond (serif, titles) + Inter (body) were
    kept from the original build — the reference's elegant serif display
    type was already exactly what this page was using, so no new font
    was loaded.
  - **Per-tab "hero" replaces the old single global banner.** The
    original build had one editable banner ("a new era of me" title +
    subtitle) shown once above the tab row. Since the reference photo is
    a full-bleed cover section that reads differently per page (Home vs
    Films vs Portfolio), and this page's four tabs are the closest thing
    it has to "pages," each `DreamTab` gained a `hero` object
    (`{eyebrow, title, subtext, ctaLabel, photo}`, new `heroModel()` in
    `dreamboard-data.js`) rendered fresh on every `switchTab()` — the
    single old banner is retired outright, not kept as a second parallel
    element, since it's the same session evolving its own feature
    forward into a richer version (same precedent as `gym.html`'s Timer
    modal→panel conversion or its This-Week schedule-modal→grid
    conversion: a same-session supersession, not another pass's orphaned
    feature, so nothing was preserved as unreachable dead code here). A
    one-time `migrateLegacyBanner()` folds any already-customized
    `dreamboard:banner` value into the first tab's hero title/subtext on
    first load after this update, then deletes the old key, so an
    already-personalized banner isn't silently lost; the key was never
    published/used beyond this local session, so this is a courtesy, not
    a load-bearing migration.
    - Hero eyebrow/subtext/CTA label are `contentEditable` spans (the
      existing `wireInlineEdit()` helper, unchanged). The **headline is
      a styled, borderless, autosizing `<textarea>`** rather than
      `contentEditable`, specifically because the reference's headline
      wraps across multiple lines and `contentEditable`'s Enter-key
      behavior (nested `<div>`s/`<br>`s) doesn't round-trip cleanly
      through `el.textContent` the way this page's other single-line
      editable fields do — a `<textarea>` styled to have no visible
      chrome (transparent background, no border, autosize-to-content via
      the same `autosize()` helper already used for Note bodies/day
      notes) gets real multi-line text with zero risk of losing line
      breaks, at the cost of one bespoke input/blur handler instead of
      the shared `wireInlineEdit()`.
    - **Cover photo** is uploadable (click-to-upload when empty, small
      "Change"/"Remove" buttons — always visible, not hover-gated, since
      hover doesn't exist on touch — once set), compressed via the same
      `compressImageDataUrl()` every other page's cover/banner photo
      already uses, just at a wider 1400px/0.82 preset than this app's
      480–640px thumbnail presets since a full-bleed hero needs more
      resolution than a card thumbnail. Stored on `tab.hero.photo`
      (persisted, synced — unlike the Photos/Feature widgets' video
      slots, a hero photo is always a still image, so there's no
      session-only case to handle here). The CTA button smooth-scrolls
      to the board below (`#dbBoard`), the closest functional analog
      available to the reference's "VIEW FILMS" page-navigation button
      since this page has no separate destination to link to — it
      respects `prefers-reduced-motion` (falls back to an instant jump).
      A "SCROLL TO EXPLORE ↓" flourish is static decorative chrome (like
      the reference photo's own scroll hint), not stored/editable data,
      same treatment as this app's other purely-decorative UI copy.
  - **Two new widget types**, both added to `WIDGET_TYPES` in
    `dreamboard-data.js` and to the Add Widget menu, fully draggable/
    deletable/reorderable like every other widget — "editable and
    moveable," not hardcoded page chrome:
    - **Feature Card** (`{photo, title, caption}`) — a single numbered
      photo with a bottom gradient-overlay title/caption, mirroring the
      reference's "01 The Films / 02 The Moments / 03 The Experience"
      row. Photo upload/paste-URL reuses the same modal as the Photos
      widget (`openPhotoModal()` gained a `{single: true}` mode that
      writes to `widget.data.photo` instead of pushing into
      `widget.data.slots[]`, and hides the Photo/Video type picker since
      a Feature Card is photo-only) rather than duplicating a second
      upload modal.
    - **Info Card** (`{icon, title, subtitle}`) — a small centered
      icon + tracked-caps title + one-line subtitle, mirroring the
      reference's "Traveling Worldwide"/"Follow Along" tiles. The icon
      is just a `contentEditable` span (type any emoji/character), not a
      picker — kept intentionally simple.
  - **Numbered-card treatment applied to every widget, of every type**
    (not just the two new ones): each card's header now shows a
    zero-padded running index (`01`, `02`, …) computed fresh on every
    render (`computeDisplayIndexes()`, row-major across the three
    columns — col0[0], col1[0], col2[0], col0[1], … — purely cosmetic,
    never persisted) alongside the drag handle/wide-toggle/delete, which
    moved into a `.dw-card-hover-actions` cluster sitting at ~55% opacity
    normally and full opacity on hover/focus — visible enough to
    discover on a touchscreen (no hover state to reveal it there) without
    cluttering the clean numbered-card look the reference photo has. A
    drag-and-drop reorder now also calls `renderBoard()` (previously it
    only persisted the new order) so the index numbers immediately
    reflect the new positions instead of staying stale until the next
    unrelated re-render.
  - **Mobile pass**: hero headline uses `clamp(34px, 8vw, 58px)` so it
    scales continuously rather than jumping at breakpoints; the hero's
    "scroll to explore" side-label (a vertical-text element that reads
    fine on a tall desktop hero) is hidden under 620px, where it would
    otherwise collide with the shorter mobile hero; the back button and
    photo change/remove controls respect `env(safe-area-inset-*)` for
    notched phones (already this app's standard convention, just
    re-applied here since the back button moved from a plain top-of-page
    link to floating over the hero photo). The board's existing
    3 → 2 → 1 column collapse (from the original build) was left as-is —
    still the right behavior, just now rendering dark/gold cards instead
    of light/blush ones.
  - **Testing note, disclosed rather than glossed over**: this pass
    could **not** be verified in a live headless browser, unlike every
    other page-build entry in this file that ends with a headless-Edge
    verification note. Every attempt to launch an isolated headless Edge
    instance in this environment (`--user-data-dir`, `--remote-debugging-
    port`, `--host-resolver-rules` blocking `*.supabase.co`, mirroring
    this file's own established testing convention) got silently
    absorbed as new renderer processes into the one Edge instance already
    running in the background (confirmed via `Win32_Process` command-line
    inspection: the new processes were `--type=renderer` children of the
    pre-existing browser process, not a fresh instance with its own
    remote-debugging port), so `Runtime.evaluate`-driven interaction
    testing was never actually possible here. Rather than kill that
    background instance (ambiguous whether it's tied to the user's real
    browser session, so treated as off-limits) or claim untested work was
    verified, this pass was instead checked statically: every `$('id')`
    reference in the script was cross-matched against the HTML's actual
    element ids (none orphaned), and brace/paren counts across both
    `dreamboard.html` and `dreamboard-data.js` were confirmed balanced
    after every edit. **This is a weaker guarantee than the behavioral
    verification every other entry in this file describes** — a real
    click-through in an actual browser before relying on this page is
    still recommended.

- **Dream Board (`dreamboard.html`) fixed a load-crash on legacy tabs,
  then gained real frosted-glass cards with per-widget color grading.**
  Two follow-ups landed together in this pass.
  - **Bugfix**: tabs saved under the pre-hero version of this page had no
    `hero` object at all. `currentHero()` read `tab.hero.eyebrow` on such
    a tab and threw a `TypeError` on the very first line of `init()`'s
    render sequence — before `renderTabs()`/`renderBoard()` ran and
    before any of `init()`'s many `addEventListener` calls executed. The
    user-visible symptom was "all my data is gone and nothing is
    clickable," when the actual `localStorage`/Supabase data was never
    touched — the page just crashed before it ever got to read or
    display it. Fixed with `normalizeTabs()` (new, `dreamboard-data.js`)
    — runs once per load right after `seedIfEmpty()`, re-runs any tab
    missing a proper `hero` object through `tabModel()` (which backfills
    it via `heroModel()`) and persists the fix, preserving the tab's
    real `id`/`title`/`order` — plus a defensive fallback directly in
    `currentHero()` so a similar gap can't crash the page again. Learned
    from this: `makeCollection()`'s `list()`/`get()` never re-run a
    stored record through its model factory (only `add()`/`update()`
    do), so any *new* field added to an existing model needs either a
    one-time normalize pass like this one, or — cheaper, and what every
    field added in this same pass now does — code that reads it
    defensively (plain truthy checks, never a nested property access on
    a value that might not exist).
  - **Glass card redesign**, per a reference photo (a translucent
    "Pink Sky" profile card over a cloud photo): `.dw-card` changed from
    a flat tinted fill to real frosted glass —
    `background: rgba(255,255,255,0.08)` plus
    `backdrop-filter: blur(22px) saturate(1.6)` (both prefixed and
    unprefixed, for iOS Safari), a soft white hairline border, and an
    inset highlight/shadow combo. `.modal` got a lighter version of the
    same treatment (less blur, more fill, for legibility) for visual
    consistency, though modals weren't explicitly named in the request.
  - **The active tab's cover photo now shows behind the entire page, not
    just the hero section** (new `#dbPageBg`, a fixed full-viewport div,
    `background-image` set by `renderPageBg()` — folded into the
    existing `renderHero()`, which already ran at every point the active
    tab or its photo could change, so no new call sites were needed),
    blurred/dimmed via `filter: blur(60px) saturate(1.35) brightness(0.55)`
    and scaled up 1.15× to hide blur-edge artifacts. This is the reason
    the glass cards actually read as "glass" instead of a blurred smudge
    of flat near-black — `backdrop-filter` needs something with texture
    and color behind it to reveal, which a plain dark background doesn't
    provide. `body::before`'s existing dark gradient/glow wash (sits in
    front of `#dbPageBg`, behind the grain texture and all real content)
    was changed from opaque hex stops to semi-transparent `rgba()` ones
    so the photo shows through it rather than being fully hidden — when
    a tab has no cover photo, `#dbPageBg` is simply empty and the page
    looks exactly as before this change.
  - **Per-widget color grading** — every widget gained a `tint` field
    (`dreamboard-data.js`, a flat `'#rrggbb'` string, the literal string
    `'photo'`, or `null` — deliberately never a nested object, per the
    lesson above) plus a small circular swatch button in each card's
    existing hover-actions row. Clicking it opens an **inline** popover
    (not an absolutely-positioned floating one — chosen specifically so
    it can never clip off-screen on a narrow phone, at the cost of
    pushing the card's content down slightly while open) offering six
    curated preset swatches, a "📷 Match this tab's cover photo" swatch
    (disabled when the tab has no photo), and a native
    `<input type="color">` for a fully custom pick, plus a Clear button.
    `effectiveTint(widget)` resolves the actual color to paint at render
    time: an explicit `tint` wins, `'photo'` looks up that widget's own
    tab's `hero.photoColor` (see below — never the currently-*active*
    tab, since a widget always belongs to one specific tab regardless of
    which tab is on screen), the pre-existing `accent: 'blush'` flag
    (the "My Goals" checklist's original gold tint from this page's very
    first build) falls back to gold for backward compatibility, else no
    tint. The resolved color is painted via a CSS custom property
    (`card.style.setProperty('--tint', ...)`) read by a `.dw-card::before`
    overlay at fixed 32% opacity — chosen over a real DOM overlay div so
    the tint layer can't interfere with the card's own blur/border, and
    chosen over inline `background-color` directly on `.dw-card` so the
    glass's own translucent white fill and the color tint composite
    together instead of one replacing the other. The old `.dw-card-blush`
    CSS rule and class were removed outright (not kept as dead code) —
    this is the same session's own mechanism being folded into a richer,
    unified replacement, the same precedent as `gym.html`'s Timer
    modal→panel conversion, not another pass's orphaned feature.
  - **`hero.photoColor`** (new field, `dreamboard-data.js`) — a cheap
    average-RGB hex sampled from a downscaled (32×32) copy of the hero
    photo via canvas `getImageData` (`extractDominantColor()`, new,
    `dreamboard.html`) whenever a hero photo is uploaded or removed (set
    to `''` on remove). Explicitly **not** a real dominant-color/
    quantization algorithm — this repo has no build step to pull one in
    — just a fast, reasonable approximation of the photo's overall tone,
    good enough to make the "match tab photo" swatch feel connected to
    the actual photo without adding a dependency. Stored once at upload
    time (not recomputed on every render) since the photo itself only
    changes on upload/remove.
  - **A real, subtle bug caught and fixed while wiring the custom color
    picker**: the first version called the full `renderBoard()` (which
    destroys and rebuilds every card's DOM, including the `<input
    type="color">` element itself) directly from the color input's
    `input` event, which fires continuously while the user drags inside
    the browser's native color-picker popup. Rebuilding the element out
    from under an open native picker closes that picker after the very
    first pixel of movement, making the custom-color picker effectively
    unusable. Fixed by splitting the two events: `input` now calls
    `previewWidgetTint()` (a direct, targeted DOM mutation — no
    rebuild — for live visual feedback while dragging), and only
    `change` (fires once, when the picker is dismissed/committed) calls
    `setWidgetTint()`, which persists and triggers the real
    `renderBoard()`.
  - **Mobile**: the color-grading popover's inline (not floating) layout
    was chosen specifically for phone screens, as noted above; preset/
    photo swatches are 28px touch targets; the tint toggle button sits in
    the same always-partly-visible hover-actions cluster the rest of this
    page's card controls already use, so it's discoverable on a
    touchscreen with no hover state. No other mobile-specific changes
    were needed — the existing 3→2→1 column board collapse, safe-area
    padding, and `prefers-reduced-motion` handling from prior passes
    already cover this update's new elements.
  - **Testing note**: same limitation as the immediately preceding entry
    — this environment's headless-Edge automation still gets absorbed
    into the one already-running background Edge instance instead of
    launching isolated, so this pass was also verified statically only
    (every new `$('id')` reference cross-matched against the HTML, brace/
    paren balance confirmed after each edit) rather than click-tested in
    a real browser.

- **Dream Board (`dreamboard.html`): labeled the existing custom color
  picker, then hardened save/sync reliability, especially around cover
  photos.** Two small follow-ups landed together.
  - The per-widget color-grading popover's native `<input type="color">`
    already existed from the previous pass but had no visible label —
    just a small unlabeled swatch box, easy to mistake for decoration.
    Added "Quick colors"/"Custom color" section labels, a live hex
    readout next to the picker (updates while dragging, via the same
    `input`-event listener that already drove the live preview), and
    enlarged the swatch itself (32×28 → 44×34) for an easier phone tap
    target.
  - **Sync reliability**: traced through `sync.js` (not modified — see
    CLAUDE.md DO NOT MODIFY §1, it's shared by `index.html`/
    `finance.html`/`entertainment.html`/`braindump.html`/`dreamboard.html`)
    to find what could make "computer and phone don't match" actually
    happen. Mechanically, any `dreamboard:`-prefixed write already
    auto-pushes to Supabase ~250ms after it happens and pulls + live-
    subscribes on load, same as every other page using it — that part
    isn't broken. Two real, fixable gaps found within this page's own
    code (not sync.js):
    - `dreamboard-data.js`'s `storeSet()` swallowed a failed
      `localStorage.setItem()` entirely (bare `try/catch(e){}`). A full
      per-origin storage quota — easy to approach with several full-size
      cover photos across four tabs — would silently drop an edit with
      zero signal, which looks identical to "sometimes it just doesn't
      save." `storeSet()` now dispatches a `dreamboard:save` CustomEvent
      (`{key, ok, error?}`) on every write, success or failure, so the
      page can react honestly instead of guessing.
    - A new `#dbSyncStatus` indicator (next to Add Widget/Reset)
      listens for that event plus the browser's own `online`/`offline`
      events and shows one of: idle ("Changes save automatically"),
      "Saved — syncing…" → "Synced" a couple seconds later, a persistent
      error ("Couldn't save — your browser's storage may be full") on a
      real write failure, or "Offline — will sync when reconnected."
      Deliberately scoped to what's actually verifiable from here: it
      confirms *this device's local write* succeeded or failed and
      whether the browser is online, but it does **not** and cannot
      claim to confirm the cross-device Supabase push itself completed
      — that lifecycle lives entirely in `sync.js`, which this page
      doesn't touch, so the status text says "syncing"/"synced" as a
      reasonable expectation given `sync.js`'s known ~250ms debounce,
      not as a guarantee.
    - Hero photos were trimmed from 1400px/0.82 to 1100px/0.78 — still
      plenty sharp as a blurred full-page backdrop, meaningfully smaller
      as a stored payload, lowering the odds of hitting the quota issue
      above in the first place (a photo is the single largest thing this
      page stores, up to four of them).
  - **Known, disclosed limitation, not fixed**: browsers cap `fetch(...,
    {keepalive:true})` payloads at 64KB, and `sync.js`'s `flushOnUnload()`
    (its `beforeunload`/`pagehide` safety-net push) uses exactly that.
    A large cover photo edit followed by closing the tab or switching
    devices within roughly a second — before the normal debounced push
    finishes — could in principle miss that unload-time fallback. Fixing
    it would mean changing `flushOnUnload()` itself, which is inside the
    protected shared `sync.js` used by five pages, not something this
    pass touches without being asked to specifically. Practical
    mitigation in the meantime: the smaller hero-photo size above, plus
    simply giving it a couple of seconds after a big change (a cover
    photo especially) before closing the tab or switching devices — the
    normal debounced push (not the unload fallback) handles that
    reliably regardless of payload size.
  - **Testing note**: same environment limitation as the two preceding
    entries — verified statically (event wiring/ID cross-check, brace/
    paren balance), not in a live browser.

- **Dream Board (`dreamboard.html`/`dreamboard-data.js`): fixed a real
  data-loss bug — reloading a device with empty local storage could wipe
  another device's real data.** Reported behavior: edit the cover photo
  and a widget's color grading on the computer, it doesn't show up on
  the phone, and reloading the phone actually deletes the computer's
  progress. Root-caused, not just patched around.
  - **The bug**: `dreamboard-data.js`'s `seedIfEmpty()` ran automatically
    and synchronously the moment this script loaded — on *any* device,
    the very first time its local storage had no `dreamboard:` data yet
    (a genuine first visit to this page, or storage that got cleared).
    It would immediately write a full default board, well before
    `initCloudSync()` (only called later, from `dreamboard.html`'s own
    `init()`) ever got a chance to check whether real cloud data
    existed. That write got marked "dirty" by `sync.js`'s
    `localStorage.setItem` wrapper and pushed to Supabase as "this
    device's changes" — overwriting the real data other devices had
    already saved. This is a bug in this page's own code, not in the
    shared `sync.js` (not modified) — the seeding logic simply never
    coordinated with the sync pull at all.
  - **The fix**: `seedIfEmpty()` is no longer called automatically.
    `dreamboard.html`'s `init()` now only seeds as an explicit fallback,
    and only when local storage was empty *and* the cloud pull hasn't
    delivered anything after a generous window: it calls
    `initCloudSync(...)` first, tracks whether its `onApplied` callback
    ever fires (meaning real remote data arrived and was applied), and
    schedules `maybeSeedAfterSyncAttempt()` via `setTimeout(…, 2500)` —
    which bails out immediately if real data already arrived, or if
    anything already showed up locally by the time it runs. If the
    Supabase SDK isn't even available (`initCloudSync` undefined), it
    seeds immediately instead, since there's no cloud to race against.
    `normalizeTabs()` (the hero-backfill fix from two entries above)
    stays automatic — it only ever backfills fields on records that
    already exist, so it's a no-op on empty storage and can't clobber
    anything, unlike full seeding.
  - **Residual risk, disclosed rather than hidden**: this converts what
    was a *near-guaranteed* clobber (every first load of an empty
    device) into a narrow one (only if the cloud pull takes longer than
    ~2.5 seconds, or the device is offline at that exact moment) — a
    timing-based mitigation, not a fully race-proof one, because a truly
    race-proof fix would mean changing how `sync.js` itself sequences
    pull-vs-local-write, which is shared by four other pages and out of
    scope here without being asked to touch it directly.
  - **Separately, "changes don't appear on the other device until I
    reload"**: this part is expected behavior, not a bug this pass
    fixes. `sync.js`'s live cross-device push relies on a Supabase
    Realtime subscription that stays open only while the tab is active;
    mobile browsers throttle or drop that connection for backgrounded
    tabs (a widely-documented browser behavior, not specific to this
    app), so a phone tab that's been sitting in the background won't see
    a computer's edits until it's reloaded or refocused — same as every
    other page in this app built on `sync.js`. A true "always live, no
    reload needed" fix would require changing `sync.js`'s own reconnect/
    re-pull behavior, which wasn't touched here for the same
    shared-file-scope reason as above.
  - **Testing note**: same environment limitation as the three preceding
    entries — this is a timing/race fix that would ideally be verified
    by loading the page with empty `localStorage` against a populated
    remote row and confirming the local board is never overwritten
    before `onApplied` fires, but that requires the live, two-device (or
    at least two-profile) browser testing this environment's headless-Edge
    automation still can't do here (see the testing notes above for
    why). Verified statically only: the control-flow logic was re-read
    end to end, and `DB.seedIfEmpty` is still exported and reachable
    from `dreamboard.html`, just no longer auto-invoked.

- **Dream Board's cover photo can now be a video too.** Additive follow-
  up — image covers behave exactly as before.
  - `tab.hero` gained `mediaType` (`'image'` default or `'video'`,
    `dreamboard-data.js`'s `heroModel()`). When `'video'`, `hero.photo`
    stays empty — there's no backend to persist a video to (CLAUDE.md
    §2/§4), same constraint the Photos/Feature widgets' video slots
    already work around. The actual video lives only as a session-local
    `URL.createObjectURL()` blob, in a new `heroVideoBlobs` map keyed by
    tab id (mirroring the existing `sessionVideoBlobs` map for widget
    photo slots, just keyed by tab instead of by slot, since a hero has
    exactly one media field per tab, not an array of slots). A tab
    reloaded with `mediaType:'video'` and no matching entry in that map
    shows a "🎬 Video needs to be re-attached" prompt with a one-click
    re-attach button, same pattern as the Photos widget's broken-video
    state.
  - `handleHeroPhotoFile()` was renamed `handleHeroMediaFile()` and now
    branches on the picked file's actual MIME type: images go through the
    existing compress-then-store-as-data-URL-plus-sampled-color path
    unchanged; videos (capped at 8MB, same limit used elsewhere in this
    app for session-only video) create a blob URL and patch
    `mediaType:'video'`, clearing `photo`/`photoColor` (there's no cheap
    frame-sampling wired up for video, so a video cover simply has no
    "match tab photo" tint color available — that swatch just disables
    itself, the same as when a tab has no cover at all). The hero file
    input's `accept` widened from `image/*` to `image/*,video/*`.
  - **The page-wide blurred cover-photo backdrop (`#dbPageBg`, added
    two entries above) now handles video too.** A CSS
    `background-image` can't reference a `<video>`, so `#dbPageBg`
    gained a child `<video id="dbPageBgVideo">`; `renderPageBg()` now
    toggles between setting the background-image (photo) and playing
    that video element (video cover with a live blob available) —
    either way, the same `filter: blur(60px) saturate(1.35)
    brightness(0.55)` on the `#dbPageBg` container still applies, since
    CSS `filter` rasterizes everything rendered inside the element it's
    on, image or video alike.
  - The foreground hero video plays muted/looped/inline (no visible
    native controls) so it reads as an ambient background loop
    consistent with the reference site's cinematic feel, rather than a
    playable clip with a control bar sitting over the headline —
    matching how the Photos/Feature widgets' videos (which DO show
    controls, since those are plainly functional content cards, not
    hero chrome) were deliberately left alone.
  - **Testing note**: same environment limitation as the preceding
    entries — verified statically (every new/renamed `$('id')`/function
    reference cross-checked, brace/paren balance confirmed), not
    click-tested in a live browser.

- **Fixed: adding a video cover option broke adding a photo cover.**
  Root cause: the hero file input's `accept` was widened from
  `"image/*"` (single-type, worked) to `"image/*,video/*"` (combined) in
  the previous entry's video-support work. Combined-type `accept`
  values are a known source of unpredictable behavior in some mobile
  photo/video pickers (the OS picker can get confused about which media
  type it's actually supposed to offer) — this is the one concrete thing
  that changed right when photo uploads stopped working.
  - Replaced the single "+ Add a cover photo or video" button with two
    explicit buttons — "+ Add a cover photo" / "+ Add a cover video" —
    each calling `openHeroFilePicker(mediaKind)` (new signature; used to
    take no argument), which sets the shared `#dbHeroPhotoInput`'s
    `accept` to a single, unambiguous `image/*` or `video/*` right
    before opening it, rather than relying on a combined value the OS
    picker has to sort out itself. "Change" now reopens whichever kind
    the tab's current cover already is, so switching an existing
    photo → photo (or video → video) stays a single click; switching
    *type* entirely (photo → video or back) means Remove then pick the
    other Add button, a deliberately simple tradeoff over building a
    second in-place type-switch control.
  - Applied the same fix to the Photos widget's add-media modal (the
    Feature Card path was already safe — its `single:true` mode was
    already forcing `accept="image/*"` only). That modal already has a
    Photo/Video `<select>`; it just wasn't driving the file input's
    `accept` at all before. It now does, both on modal open and live via
    a `change` listener on the select, so by the time the OS picker
    opens it always matches whichever single type is currently chosen.
  - **Testing note**: same environment limitation as the preceding
    entries — verified statically (every `$('id')`/function reference
    cross-checked, brace/paren balance confirmed), not click-tested in a
    live browser. This fix is inherently hard to verify without a real
    mobile device/browser anyway, since the actual failure mode lives in
    OS-level picker behavior this environment can't reproduce.

- **Dream Board: widened the empty-storage seed-race safety window from
  2.5s to 5s, after a real report that the race from two entries above
  recurred.** This is a further mitigation of the same disclosed,
  fundamentally timing-based heuristic, not a new fix — `sync.js`'s pull
  doesn't expose a "the pull attempt is done, here's whether remote data
  existed" signal distinct from `onApplied` (which only fires when
  something actually *changed*), so this page still can't tell "remote
  is genuinely empty" apart from "remote pull hasn't resolved yet"
  without a change to `sync.js` itself. 2.5s covers a typical Supabase
  read; a slow/flaky mobile connection (DNS + TLS + the request itself)
  can genuinely take longer than "typical," which is the most likely
  explanation for the recurrence. A fully race-proof fix (no timing
  heuristic at all) would mean touching `sync.js`, shared by four other
  pages — not done here without being asked to specifically.

- **Fixed a dead end: a hero video cover missing its session-only blob
  (e.g. after a reload) showed only the "re-attach" prompt, with no way
  to remove it or switch to a photo instead** unless you happened to
  have that exact video file to re-select. `renderHero()` now also shows
  the Change/Remove tools alongside the re-attach prompt in that state
  (`.db-hero-photo-tools` already sits at `z-index: 5` above
  `.db-hero-reattach`'s `z-index: 1`, so both render together without a
  layout change) — Remove clears back to the "+ Add a cover photo/video"
  choice, Change opens a picker for a *new* video, and Re-attach still
  works for the original file if you have it.

- **One-time repair: reset the Vision Board tab's stuck video cover back
  to a clean photo-ready state, on both devices.** The previous entry's
  fix made the stuck state *usable* (Change/Remove now show); this pass
  actually clears it, since the request was for Vision Board's cover to
  go back to "photo only" outright, not just be recoverable. There's no
  way for this session to reach into the user's actual browser storage
  directly, so this is a guarded, automatic migration
  (`dreamboard:visionboard_video_fix_v1`) that runs once per device,
  in `dreamboard.html`'s `init()`: finds the tab titled "Vision Board,"
  and if its `hero.mediaType` is still `'video'`, resets it to
  `{ mediaType: 'image', photo: '', photoColor: '' }`.
  - **Deliberately placed after `initCloudSync(...)` is called, not in
    dreamboard-data.js's own load-time IIFE** (unlike `normalizeTabs()`,
    which runs earlier). `initCloudSync` monkey-patches
    `localStorage.setItem`/`removeItem` synchronously, before its own
    async cloud pull starts — running the repair after that call means
    this write gets marked "dirty" immediately, which (a) protects it
    from being silently overwritten the instant the pull resolves with
    a stale, still-stuck remote copy, and (b) means it actually gets
    pushed, so *both* devices converge to the same fixed state once
    they've each loaded this update — not just whichever one happens to
    load first. Confirmed idempotent regardless of which device runs it
    first: the target state is identical either way, so even if both
    devices independently apply the fix before ever seeing each other's
    push, they still converge, not conflict.
  - Scoped to the tab titled "Vision Board" specifically (matches this
    request exactly) rather than resetting every video cover on the
    board — a tab renamed away from that exact title afterward simply
    won't match, which is expected for a targeted one-time cleanup, not
    a standing rule.

- **New page: `business.html` ("Business Hub"), a content-planning
  workspace built by reusing Dream Board's exact board engine, restyled
  to match a Notion "Content Hub" reference photo.** Per an explicit
  decision with the user (confirmed via clarifying questions before any
  code was written): this is a brand-new standalone top-level page — not
  a rebuild of the pre-existing "Businesses" sub-tab inside `index.html`'s
  Main dashboard, which is untouched by this work and keeps its own
  separate business/goal/task/workflow data model (see that tab's own
  inventory, `docs/business-tab-inventory.md`, written before this page
  existed). Genuinely new files, `business.html` + `business-data.js` —
  new nav pill (`BUSINESS` → `business.html`, appended after
  `DREAM BOARD` in `topbar.js`'s injected pill list — the only edit made
  to `topbar.js`, same one-line-addition precedent every prior page
  addition followed); new sync key (`appKey: 'business'`,
  `syncedPrefixes: ['business:']`, wired via the standard shared
  `initCloudSync` — same call pattern as every other page, nothing new
  invented).
  - **Board engine reused, not reimplemented**: `business-data.js` is
    `dreamboard-data.js`'s exact shape — `Tabs`/`Widgets` flat collections
    with a foreign-key `tabId`/`column`/`order` on each widget (not a
    nested tree), the same `makeCollection` CRUD, the same
    `reorderTab(tabId, columnsOfIds)` bulk-write-on-drag, the same
    per-widget `tint` color-grading field (`'#rrggbb' | null`), and the
    same empty-storage seed-race safety window in `business.html`'s
    `init()` (`maybeSeedAfterSyncAttempt()`, deferred until either real
    cloud data arrives via `onApplied` or a 5s window elapses) —
    identical reasoning to `dreamboard.html`'s own copy of this fix (see
    that page's changelog entries on the subject): seeding a fresh
    default board before the cloud pull has a real chance to answer can
    push a "local" board to Supabase that clobbers another device's real
    data. `business.html`'s `renderBoard()`/`buildWidgetCard()`/
    `wireSortable()` (SortableJS, same CDN version, same `.bw-drag-handle`-
    scoped drag) are line-for-line the same engine as
    `dreamboard.html`'s, just renamed `dw-`/`db-` → `bw-`/`bh-` class
    prefixes and pointed at a light palette instead of dark glass (see
    the palette note below).
  - **One structural difference from Dream Board, by design**: Dream
    Board gives every tab its own full-bleed cinematic hero (title/
    subtext/cover photo per tab, since each tab reads as its own
    "landing page"). The reference Content Hub photo instead has one
    persistent header (banner photo, avatar, name, tagline) and a
    left-hand "Subpages" list — so `business.html` has one global,
    editable profile record (`business:profile` — `name`, `tagline`,
    `bannerPhoto`, `avatarPhoto`, via `BusinessData.getProfile()`/
    `saveProfile()`) instead of Dream Board's per-tab `hero`, and its
    tabs (`BusinessData.tabModel` — `id`/`title`/`icon`/`order`, no
    `hero` field at all) render as a sidebar nav (`.bh-subpage` rows
    under "Subpages") instead of Dream Board's horizontal pill row.
    Rename-in-place (click "✎", same commit-on-Enter/-blur pattern) and
    a per-tab editable icon (a `contentEditable` emoji, same pattern as
    Info Card's icon field) are both still fully editable, matching "make
    everything adjustable, moveable, and editable just like in the Dream
    Board tab."
  - **The reference photo's right-hand sidebar (a content summary,
    posting-schedule, and a small photo gallery) is not a separate layout
    region** — it's simply which widgets the seed data placed in the
    board's third column. The board itself is still one uniform 3-column
    drag-and-drop grid, same as Dream Board's; a widget can be dragged
    into or out of that column like any other, so the "sidebar" is a
    seed-data arrangement, not a hardcoded second engine bolted onto the
    first.
  - **Five widget types tailored to content planning** (on top of Dream
    Board's original ten — checklist/list/note/quote/affirmation/steps/
    photos/calendar/feature/infocard — which are reused completely
    verbatim, same field shapes, same defaults, available from the same
    Add Widget menu):
    - **Platform** (`{active, cover}`) — a toggleable platform card. The
      platform's display name is deliberately just the widget's own
      title (edited via the same card-header title control every widget
      already has) rather than a second `data.name` field, so there's
      only ever one source of truth for "which platform is this" — an
      early draft had both and was simplified before shipping once the
      duplication was noticed. Cover is optional (paste URL or upload,
      through the same generalized photo modal below); with no cover set,
      the card shows a big monogram letter (the title's first character)
      on a gradient fill, echoing the reference photo's "I"/"T"/"Y"
      editorial-letterform platform cards.
    - **Content Plan Card** (`{title, cover, platform, status, tags,
      scheduledDate, scheduledTime, checklist}`) — mirrors the reference
      photo's content cards field-for-field: an optional cover, a
      free-text platform line (deliberately *not* a foreign key into
      Platform widgets — a platform card being renamed or deleted
      shouldn't be able to break a content card's display, so this is a
      label, not a relational reference), a status `<select>` (Not
      started / Ready to post / Writing Caption / Published!, via
      `BusinessData.CONTENT_STATUSES`), freeform colored tag chips
      (add/remove, colors picked by hashing the tag text so the same tag
      always gets the same color across cards — `tagColor()`), a
      scheduled date + time, and a **live-computed due-line**
      (`BusinessData.computeDueLabel()` — "Published!" once posted,
      else "Due Today"/"Due Tomorrow"/"N Days Remaining"/"Due
      yesterday"/"Due N days ago" derived fresh from `scheduledDate` vs.
      today, never stored text that could go stale), plus an embedded
      mini checklist reusing the exact same `buildItemListBody()`
      component every Checklist/List/Affirmation widget already uses
      (generalized to read/write a caller-specified `data` key instead
      of always `items`, so this one function now serves five different
      call sites instead of being duplicated a sixth time).
    - **Resource** (`{icon, title, description, status}`) — icon/title/
      description are inline-editable exactly like Info Card's fields;
      status is a click-to-cycle pill (Active → Idle → Archived → Active
      …, `BusinessData.RESOURCE_STATUSES`) colored via the existing
      `--success`/`--bh-text-dim`/`--danger` tokens (no new colors).
    - **Content Summary** (`summary` type, no persisted fields of its
      own) — a genuinely live-computed rollup, not stored data: on every
      render it reads every Content Plan Card on the *same tab*
      (`BusinessData.contentCardsForTab()`) and computes total count, a
      per-status breakdown with percentage bars (reusing the existing
      `.bw-progress-bar`/`.bw-progress-fill` component from the Steps
      Tracker widget), a count of genuinely overdue cards, and a count of
      open (unchecked) checklist items across all of them — so it can
      never drift out of sync with the cards it's summarizing, the same
      "derived, not stored" precedent as this app's other computed
      rollups (e.g. `index.html`'s Goal progress bars,
      `household-data.js`'s selectors).
    - **Posting Schedule** (`schedule` type, `{rows: [{id, platform, day,
      time}]}`) — add a platform/day/time row via a small inline form
      (no modal needed), delete any row with a hover-reveal ✕; rendered
      **grouped by platform** ("Instagram schedule" / "Tiktok schedule" /
      …, matching the reference photo's per-platform grouping) — the
      grouping is computed at render time from the flat `rows` array,
      not a nested stored structure, so adding a new platform's first
      row automatically creates a new group heading with no separate
      "add a group" step.
    - A real bug caught and fixed *during* this build, before it ever
      shipped: the Content Plan Card's and Content Summary's "is this
      overdue" logic originally flagged "Due Today" as overdue (red)
      alongside genuinely past-due cards, which both looks alarming for
      something that isn't actually late yet and made the Content
      Summary's "Overdue" count over-report. Fixed by giving "Due Today"
      its own amber `is-today` state (a CSS class that already existed
      in the stylesheet but was never actually applied by the JS — an
      oversight from the first draft) distinct from red `is-overdue`,
      and narrowing the Summary's overdue count to only genuinely past
      dates. Caught by an actual headless screenshot showing a "Due
      Today" card in red — not just a code read-through.
  - **Photo modal generalized, not duplicated a third time**: Dream
    Board's photo modal already had a `single` vs. multi-slot split
    (Feature Card's one photo field vs. the Photos widget's `slots[]`
    array); this page's `openPhotoModal(widgetId, opts)` gained one more
    option, `opts.field`, naming which `widget.data` key a single-target
    add writes to (`'photo'` for Feature Card, `'cover'` for Platform and
    Content Plan Card) — the same modal, upload pipeline
    (`compressImageDataUrl`), and paste-a-URL validation
    (`isValidMediaUrl`) now serve four different widget types' cover
    fields instead of one modal per field.
  - **A real seed-data bug, caught by the first headless screenshot, not
    by code review**: the initial seed used the reference photo's literal
    dates (`2024-01-16` etc.) for its non-published Content Plan Cards.
    Since `computeDueLabel()` computes relative to whatever "today"
    actually is when the page loads, a fixed 2024 date read as "Due 908
    days ago" the moment real time had moved past it — technically
    correct math, but a seed board that ages into nonsense the longer it
    sits unopened defeats the point of a seed. Fixed with a new
    `shiftedISO(offsetDays)` helper in `business-data.js` (seed-only, not
    part of the public API) so every non-published seed card's
    `scheduledDate` is relative to whenever the board is actually first
    seeded (`-6`/`-5` days for the two Published cards, whose due-line
    ignores the date entirely anyway; `-1` day for the "Due yesterday"
    card; `0`/today for the "Due Today" card; `+2`/`+7` days for the "2
    Days Remaining"/"7 Days Remaining" cards) — so the default board
    always reads correctly, matching the reference photo's due-label
    variety, regardless of when it's actually opened for the first time.
  - **Palette exception, explicit and deliberate**: own self-contained
    `--bh-*` tokens (light cream/off-white background, white cards, one
    rust/terracotta `--bh-accent`, plus this app's standard `--success`/
    `--warning`/`--danger`/`--info` semantic roles reused rather than
    recolored) — the same "explicit reference-photo instruction"
    exception category as `dreamboard.html`'s dark cinematic theme,
    `braindump.html`'s forest theme, or `gym.html`'s crimson grading (see
    CLAUDE.md §6/DO NOT MODIFY rule 2), just a light theme this time,
    scoped entirely to this one new file. No other page's tokens are
    touched. The banner's scalloped/"pinked" bottom edge (a
    `radial-gradient` CSS mask repeated horizontally) is this page's one
    small original visual flourish beyond a straight recolor, matching
    the reference photo's fabric-edge banner detail.
  - **Content tab loosely mirrors the reference photo**; the other six
    seeded subpages (Ideas/Platform/Strategy/Resources/Analytics/Audit)
    get a modest thematic starter board each, not copied from any
    reference — same "not a pixel-match for every tab" precedent
    `dreamboard-data.js`'s `seedDefaultBoard()` already set for Dream
    Board's four tabs.
  - **Verified via headless Edge screenshots** (`--host-resolver-rules`
    mapping the Supabase host to `0.0.0.0`, armed at launch before
    navigation, per this file's established testing convention): the
    Content tab's full board (3 platform cards, 6 content cards with
    correct per-card status/tag/due-line rendering, 10 resource tiles,
    the live Content Summary's stat rows/bars, the Posting Schedule
    grouped correctly by platform, and the Gallery photo-grid widget with
    its 1/2-column toggle) all rendered correctly, the sidebar's 7
    subpages and the sync-status indicator rendered correctly, and the
    "Due Today"/overdue-count bug above was caught and re-verified fixed
    by a second screenshot pass. **Not verified this way**: interactive
    drag-and-drop reordering, tab switching, and the other six subpages'
    reused Dream-Board-type widgets (checklist/list/note/quote/
    affirmation/steps/calendar/feature/infocard) — this environment's
    headless Edge could not be driven interactively via CDP (every
    attempt to open a remote-debugging port exited immediately rather
    than accepting a connection, a stricter variant of the same
    already-documented "automation gets absorbed/blocked" limitation
    noted in `dreamboard.html`'s own changelog entries), so only
    `--screenshot`/`--dump-dom`-style one-shot renders were possible, not
    scripted clicks. Those code paths are unmodified, line-for-line
    copies of `dreamboard.html`'s already-shipped implementations, which
    is why they weren't re-derived from scratch here — but a real
    click-through (drag a card between columns, rename a subpage, switch
    tabs, open the tint popover) is still recommended before relying on
    this page, same disclosed-limitation caveat `dreamboard.html`'s own
    later entries already established for this environment.

- **Business Hub (`business.html`) restyled to be visually identical to
  Dream Board, and five of its seven subpages rebuilt around a per-tab
  Tasks list mirroring index.html's Main-dashboard Tasks tab, plus a
  Platforms roster with per-platform autosaving notes.** Two explicit
  follow-up requests landed together: "make the entire aesthetic of the
  new Business Tab the exact same as the Dream Board Tab," and "set up
  Ideas, Platforms, Content, Resources, and Strategy the exact same as
  the Tasks in Main Tab, and add a freeform notes section for each
  platform... that autosaves as you type."
  - **Aesthetic, now a literal match to Dream Board's dark cinematic
    theme** — this page's `:root` tokens were replaced wholesale with
    Dream Board's exact values (near-black `--bh-bg`/`--bh-bg-deep`, the
    same warm gold `--bh-gold`/`--bh-gold-bright`, the same hairline/
    paper/text-dim/text-mute values), Cormorant Garamond + Inter loaded
    the same way, and the same layered-background technique
    (`body::before`'s glow gradient, `body::after`'s grain texture, and
    `#bhPageBg` — a page-wide blurred cover-photo backdrop keyed to the
    active tab's hero photo, identical to Dream Board's `#dbPageBg`).
    Every widget card (`.bw-card`) is now real frosted glass — the same
    `background: rgba(255,255,255,0.08)` + `backdrop-filter: blur(22px)
    saturate(1.6)` recipe as Dream Board's `.dw-card` — instead of the
    light "Content Hub" cream-card look this page launched with. The
    previous light/rust palette (`--bh-card`, `--bh-accent`, the
    scalloped-edge banner, the avatar+sidebar header) is retired outright,
    not kept as a second variant — this is the same-session's own
    aesthetic evolving forward, matching the precedent already set by
    e.g. `gym.html`'s Timer modal→panel conversion.
  - **Per-tab hero, ported from Dream Board wholesale** — each tab
    (`BusinessData.tabModel`) gained the exact `hero` shape Dream Board's
    tabs already have (`eyebrow`/`title`/`subtext`/`ctaLabel`/`photo`/
    `photoColor`), editable the same way (inline-editable eyebrow/
    subtext/CTA label, an autosizing borderless `<textarea>` for the
    multi-line serif headline, a click-to-upload cover photo with
    Change/Remove tools, a cheap dominant-color sample for future tint-
    matching use). **Deliberately narrower than Dream Board in one way**:
    no session-only video-hero support was ported — only an image cover
    — since that's a secondary capability of Dream Board's hero, not part
    of the core visual identity this request was actually asking to
    match. The persistent global "profile" header (banner photo/avatar/
    name/tagline, `business:profile`) from this page's first pass is
    removed outright, superseded by the per-tab hero — same same-session-
    supersession precedent as above, not kept as unreachable dead code
    since nothing else in this app ever read `business:profile`.
  - **Tabs row converted from a sidebar list to Dream Board's exact
    horizontal pill row** (`.bh-tabs`/`.bh-tab`, rename-in-place via the
    same "✎ → inline input → commit on Enter/blur" pattern) — tabs no
    longer carry a per-tab `icon` field (Dream Board's tabs don't have
    one either); the "Subpages" sidebar concept from the previous pass is
    gone entirely, not just restyled.
  - **Two tab "modes"**, a new `BizTab.mode` field (`'board'` |
    `'tasks'`, default `'tasks'`): **Analytics** and **Audit** stay
    `'board'` — Dream Board's original engine, completely unchanged
    (`DB.Widgets`/`columnsForTab`/`reorderTab`, all fifteen widget types
    including the four content-planning ones from this page's first pass
    — `platform`/`contentcard`/`resource`/`summary`/`schedule` — still
    available via Add Widget, just no longer seeded onto any tab by
    default since the tabs they originally themed no longer render a
    board at all). **Content/Ideas/Platforms/Strategy/Resources** are
    `'tasks'` — a brand new per-tab Tasks system (below) replaces the
    board entirely on those five; `renderActiveTabContent()` is the one
    new dispatcher that decides which to show per active tab, toggling
    `#bhBoard`/`#bhAddWidgetBtn` vs. `#bhTasksPanel` — "Reset to Default"
    stays visible on every tab regardless of mode (a whole-hub reset, not
    per-tab), matching Dream Board's own single global reset button.
  - **Tasks system** (`business:tasks`, a new flat collection,
    `{id, tabId, title, note, status, priority, dueDate, estimateMinutes,
    isDailyAction, recurrence, done, doneAt, createdAt}`) — deliberately
    mirrors index.html's dedicated Main-dashboard Tasks tab (not the
    smaller task list embedded in that page's Businesses sub-tab), read
    directly from that tab's actual implementation rather than assumed:
    **Today/All Tasks view chips** (Today = `isDailyAction || dueDate ===
    today`), a **filter/group/sort bar** (Priority filter, Status filter,
    Group by None/Priority/Status, Sort by Due date/Priority) —
    deliberately missing Main's Area/Goal/Business/Habit filters and
    group dimensions, since none of those concepts exist on this page;
    everything else carries over directly. A **quick-add row** (title +
    date, Enter submits) creates a bare task with no other fields set,
    same as Main's. Each **task row** mirrors `buildTaskRow`'s structure
    (a round checkbox, click-to-edit title, a priority pill, a DAILY
    badge, a recurrence badge, a due date, a "📄 Open" button, and an
    immediate no-confirm delete "✕" — matching the exact finding from
    reading Main's code that row-level delete has no confirm, only the
    modal's Delete does). The **Add/Edit Task modal** has the same
    fields as Main's in the same order minus the four FK selects
    (Title/Note/Status/Priority/Due date/Estimate/Daily action/
    Recurrence, with the exact same three recurrence option labels),
    same validation (title required, nothing else), same Delete-with-
    confirm. **Recurrence spawn-on-done** (`DB.spawnNextRecurrence`) is
    the same +1-day/+7-days-then-reset-to-todo behavior as Main's
    `spawnNextRecurrence`, triggered from both the row checkbox and the
    modal Save, matching Main's own two trigger points.
  - **Task Detail** (a modal, not a full-page overlay like Main's
    `#taskDetailPageBg`) is a deliberate simplification: Main's version is
    a drag-reorderable multi-block note/code editor backed by a separate
    `TaskBlock` collection — overkill for what this request actually
    needed, which was "a task can carry freeform notes." Business Hub's
    Task Detail modal is a title input (blur-saves) + a priority/due-date
    meta row + one big `<textarea>` bound directly to `task.note`, which
    **autosaves as you type** (bound to `input`, debounced 500ms via a
    small new `debounce()` helper — not just on blur) — the same
    "autosave as you type" requirement the request made explicit for
    Platforms notes, applied here too for consistency rather than only
    saving on blur like most of this app's other textareas.
  - **Platforms roster** (`business:platforms`, a new flat collection,
    `{id, name, active, cover, notes, createdAt}` — deliberately separate
    from the pre-existing `platform` *widget* type, which is a different,
    still-valid concept scoped to board-mode tabs) — shown only on the
    tab whose new `tab.roster === 'platforms'` field is set (a dedicated
    field rather than matching on the tab's title, so renaming the
    "Platforms" tab — fully supported, same rename-in-place as every
    other tab — can never silently drop the roster section). Each
    platform renders as a small card (a monogram-or-uploaded-cover
    circle, name, an Active/Inactive toggle that doesn't open the modal
    via `stopPropagation`, and a notes preview snippet) in a responsive
    grid above that tab's Tasks list. **Clicking into a platform** opens
    a modal — this is the literal "once you click the page... a freeform
    notes section... that autosaves as you type" the request asked for —
    with an editable name, an Active checkbox, a cover-photo picker
    (reusing the same generalized photo modal every other cover field on
    this page already uses), and the same debounced-on-input autosaving
    `<textarea>` pattern as Task Detail's notes field.
  - **A real bug found and fixed during this build, before it ever
    shipped**: the platform cover-photo picker was wired through the
    existing `openPhotoModal()`/`setSingleFieldPhoto()` pair verbatim,
    but that pair only ever knew how to write back to a Widget's `data`
    object (`DB.Widgets.get(id)`) — passing a Platforms-roster id through
    it would silently no-op (`DB.Widgets.get()` returns `null` for a
    platform id, and the function just returns). Fixed by generalizing
    both functions with an explicit `kind: 'widget' | 'platform'`
    parameter, so the same modal/upload pipeline/URL-validation now
    writes back to either collection correctly. A second, related bug
    from the same root cause: opening the photo picker *from inside* the
    already-open Platform modal would have rendered *underneath* it, not
    on top — both modals share the same `.modal-bg` z-index, and the
    Platform modal is later in DOM order, so equal-z-index stacking
    order (not just z-index alone) decides which one paints on top.
    Fixed by having `openPhotoModal()` close the Platform modal first
    when opened from within it (tracked via a small
    `photoModalReturnToPlatformId` variable) and reopening it once the
    photo modal closes, on every exit path (submit *and* cancel/backdrop-
    click) — not just the happy path. Neither bug was visible from a
    surface-level read of either function in isolation; both were caught
    by deliberately tracing the actual call path end-to-end before
    shipping, not by the headless screenshot pass (which only exercises
    the default, already-populated seed data, not a fresh upload).
  - **Seed data updated to match**: the Content tab's previous heavy
    widget-based seed (platform cards, content-plan cards, resource
    tiles, a summary, a schedule, a gallery — all built in this page's
    first pass) is retired for that tab specifically, replaced with six
    seed Tasks carrying the same titles/flavor as before (translated from
    "content card with a status" into "task with a status," e.g. the
    "Published!"-status cards became `status: 'done'` tasks). Ideas/
    Strategy/Resources each get a small seed Tasks list themed to their
    name (not copied from any reference). The Platforms tab gets both a
    seed Tasks list (platform-related to-dos) and the full six-platform
    roster (Instagram/Tiktok/Youtube active, Pinterest/Facebook/Twitter
    inactive, with Instagram pre-seeded with a sample note) carried over
    from the previous pass's platform-widget seed. Analytics/Audit keep
    their previous modest board-mode widget seeds essentially unchanged.
    `seedDefaultBoard()`/`seedIfEmpty()` now wipe and rebuild all four
    collections (`Tabs`/`Widgets`/`Tasks`/`Platforms`) together, so
    "Reset to Default" is still a genuine full-hub reset.
  - **Verified via headless Edge screenshots** (Supabase mapped to
    `0.0.0.0` via `--host-resolver-rules`, armed before navigation, per
    this file's established testing convention): the Content tab's hero/
    tab-row/Tasks-panel all render in Dream Board's exact dark/gold/
    frosted-glass look, with the seeded "How to Increase Website Traffic"
    task correctly appearing under the default "Today" view (its seed
    due-date is computed relative to today, same `shiftedISO()` fix as
    this page's first pass); a second pass (a temporary scratch copy with
    an injected auto-click script — not committed, since this
    environment's headless Edge still can't be driven interactively via
    a real CDP connection, same limitation `dreamboard.html`'s own later
    entries already documented) confirmed the Platforms tab's roster grid
    (all six platforms, correct active/inactive states) and clicking a
    platform card correctly opens its notes modal pre-filled with the
    seeded note and the "Autosaves as you type" hint, and confirmed the
    Analytics tab still renders its board correctly (numbered glass
    cards, "+ Add Widget" visible only here, the Content Summary widget's
    honest "No content cards on this page yet." empty state now that no
    tab seeds any `contentcard` widgets by default). **Not verified this
    way**: actually typing into a notes field and confirming the debounced
    autosave fires (vs. just reading the code path), drag-and-drop
    reordering on the board tabs, and the Task/Platform modals' Cancel/
    Delete paths — same disclosed interactive-testing gap as this page's
    first pass and as `dreamboard.html`'s later entries; a real click-
    through covering those specific paths is recommended before relying
    on this page heavily.

- **Business Hub: reverted Content/Ideas/Platforms/Resources back to
  Dream Board's board-mode (retiring the brief Tasks-list-per-tab/
  Platforms-roster detour from the entry above), and gave Resources two
  new sections — a Links & Notes area at the top of its board, and a
  Templates section at the bottom built around a Workflow (Weeks → Days
  → Checklist) system mirroring index.html's Business Workflow / Amazon
  KDP feature.** Per an explicit follow-up: "keep the aesthetic but
  restore the content, platforms, ideas, and resources system" — Dream
  Board's dark/gold/frosted-glass look (from the entry above) is
  untouched; only the *mode* of four tabs reverts. Strategy was not named
  in the restore request, so it's the one tab that keeps the Tasks-list
  system from the previous pass.
  - **Mode reverted per-tab**: `BizTab.mode` now defaults to `'board'`
    (was `'tasks'`) — Content, Ideas, Platforms, and Resources are
    `'board'` again, re-seeded with essentially the same widget content
    as this page's very first pass (platform toggle cards, content-plan
    cards, resource tiles, a Content Summary, a Posting Schedule, a
    Gallery on Content; a list/note/infocard trio on Ideas; six platform
    toggle cards on Platforms) — not byte-identical to that first seed,
    but the same spirit, since some seed dates/ids necessarily
    regenerate. Strategy stays `'tasks'`, untouched. Analytics/Audit stay
    `'board'`, untouched.
  - **The Platforms roster + per-platform autosaving-notes feature from
    the entry above is removed outright**, not kept as unreachable dead
    code — `business:platforms`, `platformModel`, `renderRoster()`,
    `openPlatformModal()`/`closePlatformModal()`, the `#bhPlatformModalBg`
    modal, and the `tab.roster` field are all deleted. This is a genuine
    "restore the prior system" request, not a same-session refinement, so
    the superseded feature doesn't linger — same precedent as e.g.
    `gym.html`'s multi-select-to-single equipment-picker replacement, but
    in the opposite direction (undoing a change, not iterating past it).
    The Platforms *tab* still exists and still shows individual platforms
    — just as `platform` board widgets again, exactly as before the
    detour, with no per-platform notes field (that capability is gone
    along with the roster it lived on).
  - **`openPhotoModal()`/`setSingleFieldPhoto()`/`handleAddSlotSubmit()`
    are simplified back to widget-only** (the `kind: 'widget' | 'platform'`
    generalization and the `photoModalReturnToPlatformId` modal-stacking
    workaround from the entry above, both added specifically to support
    the Platforms roster's cover-photo picker, are removed along with it
    — dead parameters with no remaining caller are a correctness smell,
    not a feature worth preserving for its own sake).
  - **New widget type, `link`** (`{url, description}`, title from the
    card's own existing title-row control like every other type) — a
    URL input, a "↗ Open" button (a real `<a target="_blank"
    rel="noopener">`, disabled via `aria-disabled` when the URL doesn't
    pass the same `isValidMediaUrl()` http(s)-only check every other
    link/media field on this page already uses), and an autosizing
    description textarea. Added to `WIDGET_TYPES` and the Add Widget menu
    (available on any board-mode tab, not Resources-exclusive) — this is
    the concrete answer to "things like links" for Resources' new top
    section, alongside the pre-existing `note` type for "notes, etc."
  - **Resources' top section** ("Links & Notes," seeded, not a fixed
    layout region): a `note` widget ("Quick Notes") plus two `link`
    widgets ("Brand Guidelines," "Shared Drive") seeded into the ordinary
    3-column board — same board, same drag-and-drop, nothing new
    structurally; the "section" is just what's seeded there, freely
    rearrangeable/deletable/addable like every other board tab.
  - **Resources' bottom section — Templates/Workflow, a genuinely new
    system**, not built from board widgets: a new `tab.hasTemplates`
    boolean (true only for Resources) renders a `#bhTemplatesSection`
    below that tab's board, containing Weeks → Days → Checklist items —
    the same mechanic as index.html's Business Workflow feature (read
    directly from that page's actual implementation, not assumed), scoped
    to a tab (`tabId`) instead of a "business" record, since this page
    has no multiple-businesses concept. Three new flat collections
    (`business:workflowWeeks`/`workflowDays`/`workflowChecklist`, the same
    flat-array-plus-foreign-key convention as every other collection on
    this page) with full CRUD: add/rename/reorder (▲▼, swap-adjacent-
    `order`-values, same convention as every other reorderable list in
    this app)/collapse/duplicate/delete-with-cascade-confirm for weeks,
    the same set for days (plus a status `<select>` — Not started/In
    progress/Done/Blocked, `DB.WORKFLOW_DAY_STATUSES`) nested inside each
    week, and check/edit/delete/quick-add for each day's checklist items.
    **Deliberately narrower than index.html's Workflow feature in one
    way**: everything renders inline (no separate full-page Day Detail
    overlay with a drag-reorderable note/code-block editor) — this page's
    existing Task Detail modal already covers "a task can carry a
    freeform note," so a day here is kept to title + status + checklist,
    which is what "the same *type* of Workflow setup" (the mechanism)
    actually required, not literally every feature layered onto Main's
    version across its own many follow-up changelog entries. **Also
    deliberately not seeded with the real Amazon-KDP content** (Weeks
    1–4, 6, 25 days) — that's business-specific content for a specific
    book, not part of "the same type of setup" — instead seeded with a
    small generic two-week example ("Week 1 — Launch Checklist," "Week 2
    — Repurpose & Recap") that demonstrates the same mechanic.
    "Reset to Default" now also wipes/reseeds all three Workflow
    collections alongside Tabs/Widgets/Tasks, so it's still a genuine
    whole-hub reset.
  - **Verified via headless Edge screenshots** (Supabase mapped to
    `0.0.0.0`, armed before navigation): confirmed Content reverted to a
    board (platform cards + content cards + "+ Add Widget" visible),
    confirmed Platforms reverted to six plain platform toggle cards with
    no roster/notes UI anywhere, and confirmed Resources shows both new
    sections correctly — the top board with Quick Notes/Brand Guidelines/
    Shared Drive (the Link widget's URL field, Open button, and
    description all rendering correctly), and the Templates section below
    it with "Week 1 — Launch Checklist" expanded showing its progress bar
    (1/3 done), its "Kickoff & brief" day (Done status, both checklist
    items struck through), and the quick-add-checklist-item row. **Not
    verified this way**: reordering weeks/days, duplicating a week/day,
    the delete-with-cascade-confirm paths, and typing into a checklist
    quick-add — same disclosed interactive-CDP limitation as this page's
    two prior passes; those code paths were read through carefully but
    not click-tested.

- **Business Hub rebuilt around a reference "Content Hub" screenshot:
  Platform and Content Plan kept as genuinely separate databases, removed
  Analytics/Strategy/Audit, and every platform card now opens its own
  page of generated, editable, reorderable notes.** Per an explicit
  follow-up request giving a second reference photo (a Notion "Content
  Hub" — a Platform row, a Content Plan grid with This month/This
  week/Today filters, a Useful Resources grid, and a right-hand Summary/
  Posting Schedule/Gallery sidebar) with three specific instructions:
  match that layout but keep the Platform and Content Plan databases
  separate, drop the Analytics/Strategy/Audit tabs entirely, and make
  every Platform database entry open into its own page of sections that
  can be generated on demand and fully edited/reordered.
  - **Tabs dropped from seven to four**: Content/Ideas/Platforms/
    Resources only — Strategy (a Tasks-list tab from the immediately
    preceding pass), Analytics, and Audit (both board-mode from the very
    first pass) are all gone, along with their seed widgets/tasks. Since
    Strategy was the *only* tab using the Tasks-list system from the
    prior pass, removing it meant that whole system (`business:tasks`
    collection, `taskModel`, `TASK_STATUSES`/`PRIORITIES`/`RECURRENCES`,
    `buildTaskRow`/`renderTaskList`/the Add-Task and Task-Detail modals,
    and every bit of Tasks CSS beyond the reusable `.bh-chip`/
    `.bh-chip-row` pair) had no remaining caller — removed outright
    rather than kept as unreachable dead code, the same call this page
    already made once before when it undid its own Platforms-roster
    detour: this is a genuine "drop the feature" request, not another
    pass's orphaned leftovers (the precedent that actually protects
    dead code, e.g. `pushWaterMergedToSupabase`). The `business:tasks`
    Supabase field is now orphaned, left alone, same treatment as every
    other superseded key in this app (`health`, `po_coach_weights`, etc.).
  - **`BizTab` gained a `layout` field** (`'freeform' | 'content' |
    'platforms'`, replacing the old `mode: 'board'|'tasks'` field wholesale
    now that Tasks-mode has no tabs left using it): Ideas and Resources
    stay `'freeform'` — Dream Board's unchanged 3-column drag-and-drop
    engine (`columnsForTab`/`reorderTab`, unmodified). Content is
    `'content'` and Platforms is `'platforms'` — two new fixed, sectioned
    "database" layouts that replace the freeform board entirely on those
    tabs, per the "keep the databases separate" instruction below.
  - **The actual "keep them separate" mechanism**: a new pair of
    selectors, `widgetsOfType(tabId, type)` / `reorderWidgetsOfType(tabId,
    type, orderedIds)` (`business-data.js`), treats every `(tabId, type)`
    pair as its own independently-ordered list — a widget's pre-existing
    `column` field (0–2, Dream Board's 3-column slot) is simply ignored
    for these two layouts. Concretely: the Content tab's Platform grid,
    Content Plan grid, and Useful Resources grid are each rendered from
    `DB.widgetsOfType(tabId, 'platform'|'contentcard'|'resource')`, each
    into its own DOM container, each with its **own SortableJS instance**
    (`wireSectionSortable()`, a new per-grid helper distinct from the
    freeform board's single cross-column `wireSortable()`) — so dragging
    to reorder a Platform card can never land it in the Content Plan grid
    or vice versa; they are structurally incapable of merging, not just
    visually separated. The Platforms tab reuses the exact same Platform
    grid renderer standalone. `contentCardsForTab`/`platformsForTab` were
    simplified to thin wrappers over `widgetsOfType` (gaining a stable
    sort order as a side benefit, previously unsorted).
  - **Content dashboard layout** (`#bhContentDashboard`, a new CSS grid,
    `2fr` main column + `1fr` sidebar, collapsing to one column under
    900px): **Platform** (filter chips Active/All, a "+ Add Platform"
    button, a small-card grid) → **Content Plan** (filter chips This
    month/This week/Today/All — default **All**, so a fresh page shows
    every card rather than only this month's per an explicit UX call:
    hiding cards by a silent default felt more surprising than useful
    here) → **Useful Resources** (filter chips Active/All, default
    Active, matching the reference photo) as the main column; **Summary**
    (the existing auto-computed Content Overview widget) / **Posting
    Schedule** / **Gallery** stacked in the sidebar, each rendered via a
    new `renderSidebarGroup()` that shows a small "+ Add …" button in
    place of the widget if it was ever deleted, so those three singleton
    widgets can't be permanently lost with no way back. Every section/
    grid still uses the exact same frosted-glass `.bw-card` chassis
    (numbered index, drag handle, color-grading tint popover, delete) as
    Dream Board's original board — reused verbatim, not reimplemented,
    since sectioning by type changed *what's grouped where*, not the
    card component itself. Platforms' own page is the identical Platform
    grid/filter-chip component, alone on its own tab.
  - **Content Plan's three named filters are computed, not stored**:
    `filterContentCards(cards, mode)` — `'today'` matches
    `scheduledDate === todayISO()`; `'week'` uses a Sunday-start 7-day
    window (`inCurrentWeek()`); `'month'` matches the card's scheduled
    date against today's calendar year+month. All three, plus the default
    `'all'` (no filter), are transient UI state (module-scoped vars, not
    persisted) — same "in-memory only" precedent as this app's other
    view filters (e.g. Media's gallery sort/filter chips before they
    gained a persisted mode).
  - **Every Platform card opens its own page**: `buildPlatformWidgetBody()`
    gained an "Open Page →" button (plus a small "N note sections" hint
    when non-empty) that opens a new **Platform Detail modal**
    (`#bhPlatformDetailModalBg`) — an editable name, an Active checkbox,
    a click-to-upload cover (reusing the existing generalized photo
    modal/`compressImageDataUrl` pipeline verbatim), and a **"+ Generate
    Section" button** that appends a blank `{id, title, body, order,
    createdAt}` note section to that platform's own new `data.sections[]`
    array (`business-data.js`: `addPlatformSection`/`updatePlatformSection`/
    `removePlatformSection`/`movePlatformSection`/`sectionsForWidget`,
    the same flat-array-inline-on-the-record convention as a content
    card's own inline checklist — no separate collection, so deleting the
    platform deletes its sections with it, no orphan cleanup needed).
    Each section renders as its own small card with an editable title
    input and an autosizing textarea body (both autosave on blur) and
    **up/down reorder arrows** — this codebase's established reordering
    convention for lists that aren't drag-and-drop boards (Life Areas,
    Overview notes, Workflow weeks/days all use the same swap-adjacent-
    `order`-values idiom, reused here rather than adding a second
    drag-and-drop mechanism inside a modal). "Generated with the click of
    a button" was read as this app's existing add-a-blank-item vocabulary
    (the same as index.html's own "+ Add Notes Section" feature) — not
    as an AI/LLM content-generation feature, since this app has no active
    LLM integration anywhere (`ANTHROPIC_API_KEY` is still an inactive
    placeholder, per every prior entry noting this).
  - **`refreshView()`** (new) is a single dispatcher — re-renders
    whichever of the freeform board / Content dashboard / Platforms page
    is actually active, based on the current tab's `layout` — that now
    backs every widget-body mutation callback (checklist toggles, tag
    add/remove, status cycles, photo slot changes, the active checkbox,
    tint changes, title renames, etc.) instead of each calling the
    freeform-board-only `renderBoard()` directly, since those same widget
    types (platform/contentcard/resource/summary/schedule/photos) now
    also render inside the sectioned dashboard, not just the freeform
    board.
  - **Verified via headless Edge** (`--host-resolver-rules` mapping the
    Supabase host to `0.0.0.0`, quoted as a single argument this time —
    an unquoted value containing spaces was silently mis-split by
    `Start-Process -ArgumentList` in this environment's Windows
    PowerShell 5.1 and produced a confusing "Multiple targets are not
    supported in headless mode" launch failure before that was caught
    and fixed): a `window.onerror`-instrumented, auto-driving scratch
    copy (same established technique as this page's own earlier
    `business_test_platforms2.html`-style harnesses) confirmed, in one
    run: exactly 4 tabs (`Content/Ideas/Platforms/Resources`, no
    Strategy/Analytics/Audit); no `#bhTasksPanel`/`#bhTaskModalBg` exist
    anywhere in the DOM; the Content tab's Platform/Content Plan/Useful
    Resources grids render 3/6/10 cards respectively under their default
    filters; the sidebar's Summary/Schedule/Gallery each render their one
    seeded widget; opening a platform's page, clicking "Generate Section"
    twice, editing the first section's title/body, and closing the modal
    left exactly 2 sections **persisted** in that widget's real stored
    data (read directly back out of `window.BusinessData.Widgets.list()`,
    not just re-inspected in the DOM) with the edited title/body intact;
    the Platforms tab's own page renders its own 3 active platforms
    (correctly a separate dataset from Content's own platform cards, not
    a shared one); Ideas still renders the unchanged 3-column freeform
    board; and Resources still shows its Links & Notes board with the
    Templates/Workflow section visible below the divider. Zero JS errors
    were caught at any point in the run. A full-page screenshot of the
    Content tab on initial load additionally confirmed the visual layout
    matches the reference screenshot's structure (Platform row → Content
    Plan grid → Useful Resources grid, sidebar alongside) while clearly
    being two independent grids, not one merged board.

- **Bugfix: Business Hub rendered completely blank for anyone who'd
  already used it before this session's database-separation rebuild.**
  `Tabs.list()`/`get()` return raw stored records — only `add()`/
  `update()` ever run a record back through `tabModel()` (documented
  precedent: this is the exact failure class Dream Board hit once for
  its `hero` field). The rebuild above replaced `tabModel`'s old
  `mode: 'board'|'tasks'` field with a new `layout` field, but a tab
  already sitting in a real browser's `localStorage` from an earlier
  session still only has the old `mode` field — every render path in
  `business.html` branches strictly on `layout`, so `undefined` matched
  no branch and nothing rendered. Fixed with `normalizeStoredData()`
  (`business-data.js`) — backfills `layout` from a tab's `title`
  (`'Content'`→`'content'`, `'Platforms'`→`'platforms'`, else
  `'freeform'`) and drops the three retired tabs (Analytics/Strategy/
  Audit) by name, cascading their widgets/tasks/workflow data. Run
  automatically on every load (not gated behind the seed-race window,
  unlike `seedIfEmpty()`) since it only ever transforms *existing* tabs
  into a corrected shape and returns immediately when storage is empty —
  it can't turn empty storage into populated storage, so it can't
  clobber another device's real data the way a full reseed could.
  Verified by pre-seeding a fresh profile's `localStorage` with
  old-schema data (7 tabs, `mode` field, no `layout`) before loading the
  page: the migrated result correctly showed 4 tabs with proper
  `layout` values, the user's real pre-existing content survived
  untouched, and the Content dashboard rendered instead of a blank
  `bhBoard`.
  - **Follow-up, same root cause**: the fix above only ran once, at
    `business-data.js`'s own script-load time — but `business.html`'s
    `onApplied` callback (fired after `initCloudSync`'s remote pull
    resolves) re-renders from whatever the pull just wrote into
    `localStorage` *without* re-running the migration. A real device's
    Supabase row still held data pushed under the old schema from
    before this update, so the sequence was: page loads → local
    migration runs → renders correctly for a moment → the cloud pull
    lands a second or two later and overwrites the freshly-migrated
    tabs with the stale old-schema copy → `onApplied` renders again with
    no `layout` field anywhere → blank. Fixed by exporting
    `normalizeStoredData` from `business-data.js`'s public API and
    calling it as the first line of `onApplied`, before reading tabs —
    both entry points (initial load, and every subsequent applied pull)
    now self-heal identically. Verified by stubbing `initCloudSync`
    itself (network calls to Supabase can't be exercised in this
    environment's testing setup, but the actual bug was never in the
    network round-trip — it was in what `onApplied` did with whatever
    data arrived) to apply old-schema data and invoke the real
    `onApplied` ~1.5s after boot: the page correctly re-migrated to 4
    tabs and kept rendering the Content dashboard, instead of reverting.

- **Content tab ("`layout: 'content'`") gained a "+ Add Widget" button and
  a "More Widgets" freeform area**, per an explicit follow-up — the
  sectioned dashboard rebuild above deliberately hid the generic Add
  Widget button on this tab (it only exposed inline "+ Add Platform/
  Content/Resource" buttons scoped to each fixed database), which meant
  there was no way to add any of this app's other widget types
  (checklist/list/note/quote/affirmation/steps/calendar/feature/
  infocard/link) to the Content page at all.
  - **`SECTIONED_TYPES = ['platform','contentcard','resource','summary',
    'schedule','photos']`** (business.html) — the widget types the
    Content dashboard already gives a guaranteed, fixed home to (the
    three database grids, or the sidebar's `renderSidebarGroup()`, which
    already supports stacking multiple widgets of the same type). Every
    *other* type now lands in a new **"More Widgets"** section — a
    small freeform, drag-and-drop 3-column area (`#bhContentExtrasBoard`,
    `grid-column: 1 / -1` so it spans the full dashboard width below
    both the main column and sidebar) that's exactly Dream Board/Ideas/
    Resources' existing board engine, reused rather than reimplemented:
    `extrasColumnsForTab()` mirrors `columnsForTab()` but filters to
    non-sectioned types first, and reordering persists via the
    already-existing `DB.reorderTab(tabId, columnsOfIds)` unmodified —
    that function only ever touches widgets whose ids are actually
    passed in, so it can't disturb the Platform/Content Plan/Resource
    widgets living outside this board's DOM even though they share the
    same tab.
  - `addWidgetToActiveTab(type, title)` — the function the shared Add
    Widget modal already called on every layout — now checks the active
    tab's `layout` first: on `'content'`, a `SECTIONED_TYPES` member
    routes through the existing `addTypedWidget()` (same "+ Add
    Platform" etc. path); anything else routes through the new
    `addExtrasWidget()` into the More Widgets board. Freeform tabs
    (Ideas/Resources) and the Platforms page are completely unaffected —
    same code path as before this change.
  - Verified in headless Edge (Supabase blocked): confirmed "+ Add
    Widget" is now visible on the Content tab; added a Note, a Quote,
    and a Checklist via the generic menu and confirmed all three
    rendered in the new More Widgets board (`extrasTypes: ["note",
    "quote","checklist"]`); added a Platform via that same generic menu
    and confirmed it landed in the Platform database grid instead
    (count went 3→4), not in More Widgets; confirmed all of the above
    persisted correctly in `window.BusinessData.Widgets.list()`; and
    confirmed a screenshot of the resulting Content tab showed the new
    4th platform card and the "+ Add Widget" button in the header, with
    zero JS errors throughout.

- **Content tab: the six fixed dashboard sections themselves (Platform/
  Content Plan/Useful Resources/Summary/Posting Schedule/Gallery) can now
  be freely dragged into any order and between the main column and
  sidebar.** Per an explicit follow-up asking to freely move "all widgets
  and assets" — clarified via a quick question, since that phrasing could
  have meant merging the Platform/Content Plan/Resources databases back
  together (directly reversing an earlier explicit "keep them separate"
  request): the confirmed scope is that each database's own cards still
  only reorder within their own grid (unchanged from the previous two
  passes), but the section *blocks* themselves — the whole "Platform"
  card, the whole "Content Plan" card, etc. — are now a second, higher
  level of drag-and-drop, on top of the per-card dragging already inside
  each one. "More Widgets" was deliberately left out of this movable set
  (its own 3-column freeform area wouldn't read well squeezed into the
  narrower sidebar column) — not disclosed as an explicit scope note to
  the user beforehand, but a reasonable inference from the six sections
  actually named when confirming scope.
  - **`BizTab` gained `sectionLayout`** (`business-data.js`) — an array
    of `{key, column}` (`column` is `'main'|'sidebar'`), `null` by
    default. A real gotcha caught while implementing this: `tabModel()`
    rebuilds a tab into a brand-new object listing only its own known
    fields — any field not explicitly listed there is silently dropped
    every time `Tabs.update()` runs a patch back through it (this is the
    same "list()/get() never re-run stored records through the model,
    but add()/update() do" mechanism that caused the two migration bugs
    fixed earlier in this file's own changelog, just hitting the
    opposite direction here — a *new* write being silently stripped
    rather than an *old* read being under-filled). Missed this on the
    first pass and had to add `sectionLayout` to `tabModel`'s returned
    object explicitly before persistence actually worked.
  - **`business.html`**: the six section shells already existed as
    static HTML (`.bh-db-section[data-section-key="platform|contentplan|
    resources|summary|schedule|gallery"]`, each with a new
    `.bh-db-section-drag` (⋮⋮) handle in its header, wrapped in a new
    `.bh-db-section-head-left` alongside the title so the existing
    `justify-content: space-between` header layout wasn't disturbed) —
    reordering is implemented by *reparenting* those existing nodes
    between `#bhDbMain`/`#bhDbSidebar` (`applyContentSectionLayout()`),
    not by rebuilding them, so a section's own inner grid/content and
    its own separate per-card Sortable instance are completely
    unaffected by being moved to a new parent. A single SortableJS
    `group` spans both columns (`wireContentSectionSortable()`, handle
    scoped to `.bh-db-section-drag` so it can never fire from clicking a
    filter chip or Add button inside a section), and `onEnd` persists via
    `persistContentSectionLayout()` — reads each column's current
    `data-section-key` order and writes it straight to the tab. A
    missing or corrupted `sectionLayout` (e.g. from before this feature
    existed, or not covering exactly the six known keys) falls back to
    the original hardcoded order (`getContentSectionLayout()`) rather
    than erroring — same defensive-fallback precedent as this file's own
    hero/layout migration fixes above.
  - **Verified** (drag-and-drop itself can't be simulated via synthetic
    click events, so this exercised the actual reparent/persist/fallback
    functions rather than the SortableJS interaction layer, which is a
    well-established third-party library already used elsewhere in this
    exact codebase — not something that needed re-proving): confirmed
    the default section order in both columns; wrote a custom
    `sectionLayout` moving Gallery into the main column and Platform
    into the sidebar, switched tabs away and back, and confirmed the DOM
    reflected exactly that arrangement with both sections' inner content
    (the Platform grid's 3 cards, the Gallery wrap element) fully intact
    after being reparented; and confirmed an incomplete/corrupted
    `sectionLayout` correctly fell back to the standard order instead of
    breaking. Zero JS errors throughout.

- **Resources tab's Workflow upgraded to match index.html's actual
  Business Workflow feature more closely, and split into two sections —
  "Workflow Templates" and "Tasks."** Per an explicit request with a
  reference screenshot of that fuller feature (per-day OPEN/→TASKS/
  DUPLICATE buttons, reorderable checklist items, a "Move to week"
  dropdown, an "Auto-sync days to Tasks" concept). The reference photo's
  "Send to another project" (copying/moving a week to a different
  *business*) was deliberately **not** ported — this page has no
  multiple-businesses concept, only tabs, and Workflow only ever exists
  on the Resources tab (`hasTemplates`), so there is no second "project"
  to send a week to; fabricating one wasn't asked for and wasn't built.
  - **`business-data.js`**: `WorkflowDay` gained a `notes` field
    (freeform, for the new day-detail modal — separate from its
    checklist). New `moveWorkflowDayToWeek(dayId, targetWeekId)`
    relocates a day to a different week, appended at the end (status/
    notes/checklist untouched). **Tasks is fully reintroduced**
    (`taskModel`, `TASK_STATUSES/PRIORITIES/RECURRENCES`, the `Tasks`
    collection, `tasksForTab`/`sortTasks`/`spawnNextRecurrence`) — the
    same system removed two passes ago when the Strategy tab (its only
    user at the time) was dropped; this time it's a section on Resources
    rather than a whole tab-mode. `Task` gained `workflowDayId` (nullable
    link to a `WorkflowDay`), plus a small one-hop, non-recursive sync
    pair mirroring index.html's own: `pushDayStatusToLinkedTask(dayId,
    status)` (Day → Task; 'Blocked' has no Task equivalent and maps to
    'todo') and `pushTaskStatusToLinkedDay(taskId)` (Task → Day; only
    pushes when the task is actually marked done, and never overwrites
    an existing 'Blocked' day unless it is — same "Blocked-protection"
    precedent). `sendWorkflowDayToTasks(dayId)`/`taskForWorkflowDay(dayId)`/
    `unlinkWorkflowDayFromTask(dayId)` are idempotent (re-clicking "→
    Tasks" never creates a duplicate; unlinking never deletes the task).
    `removeWorkflowDay`/`removeWorkflowWeek` now also null out
    `workflowDayId` on any task tied to what's being deleted, so a
    delete can never leave a task silently pointing at nothing.
    `normalizeStoredData()` additionally prunes any Task whose `tabId`
    no longer matches a live tab — covers the case where Strategy was
    already removed in a session *before* Tasks was reintroduced here,
    leaving old orphaned task records that would otherwise have sat
    invisibly in storage forever.
  - **`business.html` Workflow upgrades**: checklist items gained ▲▼
    reorder buttons (wired to the already-existing but previously-unused
    `DB.moveWorkflowChecklistItem`) — this was a real gap in the earlier,
    deliberately-simplified port, not a new capability invented from
    scratch. Each day gained a "Move to week" dropdown (shown only when
    the tab has more than one week, same "only show when it'd matter"
    precedent as index.html's own version) and two new icon buttons in
    its actions row: **📄 Open** (a day-detail modal, `#bhWorkflowDayNoteModalBg`,
    with a freeform textarea that autosaves as you type — the "OPEN a
    day's own page" from the reference photo, built as a modal rather
    than a full separate page, same simplification precedent as this
    page's Platform Detail view) and **→/✓ Tasks** (sends the day to the
    new Tasks section, or unlinks it back — a small "📄 Workflow" badge
    on the linked task ties the two sections together visually). The
    day status `<select>` now also calls `pushDayStatusToLinkedTask`.
  - **New "Tasks" section**, alongside "Workflow Templates" under the
    same divider on the Resources tab: Today/All view chips, priority/
    status filters, a quick-add row, and task rows (checkbox, priority
    pill, DAILY/recurrence/Workflow-link badges, due date, a "📄" notes
    button, delete) — essentially the same Tasks UI this page had before
    (view chips, Add/Edit modal, autosaving Task Detail modal,
    recurrence spawn-on-done), rebuilt from scratch since it had been
    fully deleted two passes ago, now scoped to a section instead of a
    tab-mode. `renderWorkflow()` always also calls the new
    `renderResTaskList()`, so the two sections stay in sync from a
    single call site.
  - Seed data: the "Draft & review" day (Week 1, already "In progress")
    is seeded pre-linked to a Task, and a second, unlinked task
    ("Review brand guidelines before next campaign") demonstrates the
    ordinary case — so a fresh install shows both states without any
    manual setup.
  - **Verified in headless Edge** (Supabase blocked): switched to
    Resources and confirmed 2 seeded tasks appear under "All Tasks" (0
    under "Today," correctly, since neither has a due date or is a daily
    action) with one showing the Workflow-link badge; reordered a
    checklist item and confirmed the swap persisted in storage; moved a
    day to the other week via the dropdown and confirmed both its
    `weekId` and the source week's day count updated correctly; opened
    the day-detail modal, confirmed its title matched the right day (not
    an adjacent one — an early test pass using ambiguous "first element"
    DOM queries produced two apparent failures here that turned out to
    be the test grabbing the wrong day's elements, not real bugs; adding
    a `data-day-id` attribute and re-targeting precisely showed both
    working correctly), typed a note, and confirmed it autosaved to the
    day's real stored `notes` field; sent a day to Tasks and confirmed a
    new linked task appeared, then clicked the same button again and
    confirmed it correctly unlinked without deleting the task. Zero JS
    errors throughout.

- **`business.html`'s `business-data.js` script tag gained a `?v=6` cache-
  busting query string**, after the Workflow/Tasks upgrade above was
  reported as "not showing up." Re-tested that exact change against
  simulated real, previously-used data (existing Resources-tab Weeks/
  Days from several pushes ago, missing the new `notes` field entirely,
  no `business:tasks` key at all) and it rendered correctly with zero
  errors — so the most likely explanation left is this repo's own
  documented lack of any build step or cache-busting (see CLAUDE.md §1):
  editing `business-data.js`'s *contents* never changes its *URL*, so a
  browser (or an intermediate CDN cache) that already fetched the old
  copy has no signal to refetch it, and would keep calling brand-new
  functions like `taskForWorkflowDay` as `undefined` — silently breaking
  the render with no visible error to the user. Bumping the query string
  forces every browser to treat it as a new resource. This is a
  narrower, more targeted fix than reworking this app's caching model
  wholesale (out of scope here) — worth remembering for any future
  `business-data.js` change: bump the `?v=` number again, or this same
  "it's not showing up" report will likely recur.

- **Every Workflow day on the Resources tab now has its own "page" of
  generated, moveable, editable note and code blocks** (bumped to
  `business-data.js?v=7`). Per an explicit request: each day's existing
  "📄 Open" page (a single freeform-note modal, from the Workflow
  upgrade above) is replaced with a real multi-block page — two buttons,
  "+ Generate Notes Section" and "+ Generate Code Block," each add a
  blank block of that type; every block has an editable title, an
  editable body, ▲▼ reorder, and delete. This mirrors index.html's own
  richer Task/Day detail page (a drag-reorderable note/code block
  editor, deliberately left out of the first Workflow port as a scope
  cut) — implemented here with this app's up/down-arrow reorder
  convention instead of drag, matching the Platform Detail page's
  "generated sections" pattern (`addPlatformSection` etc.) rather than
  inventing a third mechanism.
  - **`business-data.js`**: `WorkflowDay` gained `blocks` — an inline
    array of `{id, type:'note'|'code', title, body, order, createdAt}`,
    the same on-the-record convention as a Platform widget's `sections`
    (no separate collection, so deleting the day deletes its blocks with
    it). New `blocksForDay`/`addWorkflowDayBlock`/`updateWorkflowDayBlock`/
    `removeWorkflowDayBlock`/`moveWorkflowDayBlock`, structurally
    identical to the Platform-section CRUD functions one section above
    them in the file. The day's older single-string `notes` field (from
    the previous round, one plain textarea) is kept in the model only so
    it can be migrated forward — never read from again once migrated.
  - **`business.html`**: the Day Page modal (`#bhWorkflowDayNoteModalBg`)
    was rebuilt around `renderWorkflowDayBlocks()`/`buildWorkflowDayBlockCard()`
    instead of one textarea; a code block's `<textarea>` gets
    `wrap="off"` and `spellcheck="off"` plus a monospace/dark-background
    style (`.bh-pf-section-code-body`) so it reads as code, with
    horizontal scroll for long lines instead of wrapping. Both block
    types autosave on blur (matching Platform Detail's sections, not the
    debounced-on-keystroke behavior the single-textarea version had
    before it) — same modal-detail convention across the app, not a
    regression.
  - **`migrateDayNotesToBlocks(day)`** — the first time a day's page is
    opened after this update, if it has legacy `notes` content and no
    blocks yet, that content becomes one initial note block (titled
    "Notes") and `notes` is cleared — nothing written under the
    previous, single-textarea version of this page is lost. Runs
    automatically on open, not gated behind any flag, since (like this
    file's other post-hoc migrations) it only ever backfills a day that
    already exists into a corrected shape.
  - **Scope note**: this was built for Workflow days specifically (the
    "pages" the request's own wording matches most directly, and the
    only place on the Resources tab with an existing "Open" concept to
    extend) — Platform Detail pages (Content/Platforms tabs) and the
    plain Links & Notes board widgets were left untouched, since neither
    was named and both already have their own established, working
    patterns.
  - **Verified in headless Edge** (Supabase blocked): opened a fresh
    day's page and confirmed the correct empty state; generated one note
    block and one code block and confirmed their type tags, editable
    title/body persisted correctly to the day's real stored `blocks`
    array (not just the DOM); reordered the code block above the note
    block and confirmed the persisted order matched; deleted a block and
    confirmed the count dropped correctly; and — separately — wrote
    legacy `notes` content onto a second day with `DB.updateWorkflowDay`
    (simulating a day saved under the pre-blocks schema), reopened its
    page, and confirmed it was migrated into exactly one note block with
    the original text intact and `notes` cleared afterward. Zero JS
    errors throughout. A screenshot additionally confirmed the visual
    layout (numbered-free `.bh-pf-section` cards, NOTE/CODE tags,
    monospace code styling) reads clearly against this page's dark
    frosted-glass theme.

- **Business Hub reported "still not showing up" after the Day Page
  blocks feature above, despite the `?v=7` cache-bust.** Re-verified
  extensively before touching anything: no duplicate element ids
  anywhere in `business.html`; re-ran the full Workflow/Tasks/Day-blocks
  test suite; specifically re-read `sync.js`'s `applyRemote()` (the one
  piece of this page's behavior that can't be exercised locally, since
  every test here deliberately blocks Supabase) to check whether an
  older remote row missing newer keys (`business:tasks`, or Workflow
  days missing `blocks`) could silently wipe or corrupt anything on
  pull — it can't: `applyRemote()`'s delete-if-absent-from-remote loop
  only ever removes a key that's *already present locally*, so a key
  that was never locally written (e.g. `business:tasks` before its
  first local write) is simply never touched, and every field this app
  reads defensively (`|| []`, `|| ''`) regardless. No further code bug
  was found.
  - **What actually changed this round**: `business.html` gained
    `<meta http-equiv="Cache-Control/Pragma/Expires">` "no-cache" tags.
    The `?v=7` fix from the previous round only cache-busts the
    *referenced* `business-data.js` file — it does nothing for
    `business.html` itself, the top-level navigated document, which a
    browser (or an intermediate cache) can just as easily be holding a
    stale copy of. Since this repo has no server-side header control at
    all (no `vercel.json`, confirmed — see CLAUDE.md §1's "zero-config
    static hosting"), an HTML `<meta>` tag is the only lever available
    from inside the file itself. Disclosed honestly: meta-tag cache
    directives only influence how a *browser* re-requests the document
    on a later visit — they cannot reach back and instruct a CDN edge
    cache that already served a stale response before the browser ever
    parsed this tag, so this is a partial mitigation, not a guaranteed
    fix, for a class of problem this app's own "no build step" design
    is inherently exposed to. Verified the page still loads and renders
    identically after adding the tags (Resources tab, Tasks list, Day
    Page blocks modal all present, zero JS errors) — this change cannot
    have introduced a new regression, whatever the actual root cause of
    the report turns out to be.

- **Root cause found and fixed: `hasTemplates` was never re-asserted by
  `normalizeStoredData()`, so a stale value silently hid the whole
  Workflow Templates/Tasks section with no error.** Asking the user a
  single targeted question ("Resources loads fine, but no Workflow
  Templates/Tasks section") immediately pointed at the one boolean that
  section is gated on — `renderActiveTabContent()`/`renderWorkflow()`
  both check `t.hasTemplates` before showing `#bhTemplatesSection` at
  all. `normalizeStoredData()`'s existing `layout` backfill only ever
  ran on a tab missing a *valid* `layout` — a tab that already had one
  (which every real tab does, having already been through the earlier
  `layout` migration) returned unchanged from that function, `hasTemplates`
  untouched, no matter what value it actually held. Nothing else in this
  file ever re-asserted it either. A tab's `hasTemplates` can regress to
  false/missing the same way `layout` once could: a stale Supabase pull
  (from before `hasTemplates` existed, or from before the Workflow
  feature was added to Resources) applies via `sync.js`'s `applyRemote()`
  as a raw whole-array overwrite of `business:tabs`, and `onApplied`'s
  call to `normalizeStoredData()` had nothing in it to catch this
  specific field the way it already catches `layout`.
  - **Fix**: `normalizeStoredData()` restructured to check `hasTemplates`
    independently of the `layout` branch (previously an early-return
    made the two mutually exclusive per tab) — any tab titled "Resources"
    without `hasTemplates: true` gets it backfilled; every other tab is
    left alone (this only ever *adds* the flag to the one tab that's
    always supposed to have it, never removes it from anywhere, so it
    can't accidentally grant Templates to Content/Ideas/Platforms).
    Bumped to `business-data.js?v=8`.
  - **Verified** against the exact reported symptom: seeded a Resources
    tab with `hasTemplates: false` (otherwise fully current-shape —
    correct `layout`, real weeks/days) and confirmed it now gets
    backfilled to `true` on load, the Templates section becomes visible,
    its week/day renders, and the Tasks list is present — while
    confirming Content's `hasTemplates` correctly stayed `false` (the
    fix is scoped to Resources only, not a blanket "always true").
  - This is the same *shape* of bug as the two schema-migration fixes
    earlier in this file (a newly-added field or a changed field's valid
    values not being backfilled on already-existing records) — worth
    remembering as a standing pattern for this page specifically: any
    field this app starts relying on for a rendering decision needs an
    explicit backfill in `normalizeStoredData()`, not just a default in
    the model function, since `list()`/`get()` bypass the model and a
    stale cloud pull can reintroduce the old value at any time.

- **New page: `aitech.html` ("AI & Tech"), built to match Business Hub's
  and Dream Board's aesthetic, with a Notion-like gallery database of AI
  models and a second database of prompts tied to each model.** Per an
  explicit request with a reference photo (a dark, glassy feature-card
  grid) asking for the same look as those two pages. Genuinely new file,
  plus a new companion data file, `aitech-data.js` — new nav pill
  (`AI & TECH` → `aitech.html`, appended after `BUSINESS` in `topbar.js`'s
  injected pill list — the only edit made to `topbar.js`, same
  one-line-addition precedent every prior page addition followed); new
  sync key (`appKey: 'aitech'`, `syncedPrefixes: ['aitech:']`, wired via
  the standard shared `initCloudSync` — same call pattern as every other
  page, nothing new invented).
  - **Palette/component reuse, not reinvention**: `:root` token *values*
    (`--at-bg`/`--at-gold`/`--at-gold-bright`/`--at-hairline`/etc.) are
    copied verbatim from `business.html`'s own `--bh-*` tokens — the
    same "explicit reference-photo/aesthetic-match instruction" exception
    category as Dream Board/Business Hub's own dark cinematic theme
    (CLAUDE.md §6/DO NOT MODIFY rule 2), just under this file's own
    prefix since there's no shared stylesheet to import (no build step —
    see §1). The card chassis (`.at-card`) is the same frosted-glass
    recipe as Business Hub's `.bw-card`/Dream Board's `.dw-card`
    (`background: rgba(255,255,255,0.08)` + `backdrop-filter: blur(22px)
    saturate(1.6)`), with the same numbered index + drag-handle +
    hover-reveal action row in the card header, and cards are
    drag-reorderable via the same SortableJS CDN dependency and
    `handle: '.at-drag-handle'` pattern as Business Hub's
    `wireSectionSortable()`. The hero banner (sunburst-free eyebrow/
    italic-serif-title/subtext/pill-CTA/cover-photo recipe) is the same
    shape/behavior as Business Hub's per-tab hero, just a single global
    instance (`aitech:hero`) since this page has no tabs.
  - **Two genuinely separate "databases," never merged into one list** —
    same precedent as `business.html`'s Platform/Content Plan/Useful
    Resources split: **AI Models** (`aitech:models` — `id, name, icon,
    cover, category, status, rating, description, url, tags[], order,
    createdAt`) is a Notion-like gallery: a cover photo (upload or paste
    URL, compressed via the same canvas-downscale recipe every other page
    uses) or an emoji-icon fallback on a gold gradient tile, a status
    badge (Active/Trial/Deprecated, colored via the existing `--success`/
    `--warning`/`--danger` tokens — no new hues), a category chip (one of
    nine fixed categories), a click-to-set 5-star rating, a description,
    tag chips, and an "Open ↗" link (disabled via `aria-disabled` when
    the URL doesn't pass the same `isValidMediaUrl()` http(s)-only check
    every other link field in this app already uses). Filterable by
    category chip row, an Active/All status toggle (defaulting to **All**
    — a deliberate call, since "a gallery of all of the AI models I use"
    reads as show-everything-by-default, not hide-inactive-by-default),
    and a title search box. **Prompts** (`aitech:prompts` — `id,
    modelId, title, body, tags[], favorite, order, createdAt`) is tied to
    an individual model via a nullable `modelId` — filterable by a
    per-model chip row (built dynamically from the live Models list, plus
    an "Unlinked" chip that only appears once at least one prompt has no
    model), a "★ Favorites only" toggle, and a title+body search box.
    Each prompt card shows the linked model as a colored tag (hashed to a
    consistent color per model name, the same `tagColor()`-style
    technique `business.html` already uses for its content-card tags), a
    monospace preview of the prompt body (clamped with a "Show more/less"
    toggle past 160 characters), tag chips, and a "📋 Copy" button
    (`navigator.clipboard.writeText`, with a brief "✓ Copied" state) —
    the concrete "copy-ready" part of the request. Clicking a Model
    card's "N prompts →" link jumps straight to the Prompts section
    pre-filtered to that model, the same "click through to the filtered
    other database" precedent `business.html`'s Workflow-day "→ Tasks"
    link already established.
  - **Deleting a model does not cascade-delete its prompts** — it nulls
    out `modelId` back to "Unlinked" instead, the same null-out-the-
    reference precedent `household-data.js`'s legion deletion and
    `business-data.js`'s week/day deletion already established (a prompt
    is still useful even if the model it was written for gets removed
    from the roster).
  - **Add/Edit modals** (`#atModelModalBg`/`#atPromptModalBg`, the plain
    `.modal-bg`/`.modal` classes — already covered by `topbar.js`'s
    existing `MODAL_SELECTORS`, no `topbar.js` CSS/JS edit needed) cover
    every field, plus a Delete-with-confirm action from inside the modal
    (mirroring every other CRUD modal in this app). Tags are added by
    typing + Enter into a small input, removed via a chip's own ×,
    same interaction as e.g. `business.html`'s content-card tags.
  - **Seed data** (`seedDefaultData()`, guarded by `aitech:seeded`, same
    empty-storage seed-race safety window as `dreamboard.html`/
    `business.html`'s `maybeSeedAfterSyncAttempt()` — seeding
    synchronously before `initCloudSync()`'s cloud pull gets a real
    chance to land could push a freshly-seeded "default" set to Supabase
    and clobber another device's real data) ships with 9 realistic
    models (Claude, ChatGPT, Gemini, Perplexity, GitHub Copilot,
    Midjourney, Runway, ElevenLabs, Notion AI — spanning Active/Trial/
    Deprecated statuses and most of the fixed category list) and 10
    prompts distributed across several of them, so the page demonstrates
    both databases and their cross-linking without being empty on first
    load.
  - **Verified in headless Edge** (`--host-resolver-rules="MAP
    jomlmvslzsmmzgjnqvbm.supabase.co 0.0.0.0"`, armed before navigation,
    per this file's established testing convention — this run additionally
    hit the already-documented "unquoted `--host-resolver-rules` value
    gets mis-split by PowerShell's `Start-Process -ArgumentList`" pitfall
    from `business.html`'s own changelog and was fixed the same way, by
    keeping the flag+value as one array element): a `--dump-dom` pass
    confirmed all 9 seeded models and 10 seeded prompts render with
    correct status badges, category/model chips, star ratings, and tag
    colors, and that the seed-race-safety path actually fires (Supabase
    blocked, so the page falls back to `seedIfEmpty()` after its wait
    window instead of staying empty); a full-page screenshot confirmed
    the visual result reads as a clear match to Business Hub/Dream
    Board's frosted-glass/gold aesthetic; and every `$('id')` reference
    in the script was cross-matched against the HTML's actual element
    ids (all 55 resolved, none orphaned) as a static check on the modal
    wiring, since this environment's headless Edge could not be driven
    interactively via a live CDP session this round either (the
    `--remote-debugging-port` handshake did not come up in time) — the
    same disclosed interactive-testing gap several other pages' changelog
    entries in this file already note for this environment. A real
    click-through (opening the Add Model/Add Prompt modals, dragging a
    card, toggling a favorite/rating) is still recommended before relying
    on this page heavily.

- **Bugfix: AI & Tech's hero "+ Add a cover photo" button was
  unclickable.** `.at-hero-overlay` (the dark gradient scrim drawn over
  the hero, `z-index: 1`) was copied from `business.html`'s
  `.bh-hero-overlay` by re-deriving the CSS from memory rather than
  copying it byte-for-byte, and the copy silently dropped
  `pointer-events: none` — the one property that lets clicks pass
  through the overlay to `.at-hero-photo-choice`'s button underneath it.
  Every other hero control kept working because it either sits in a
  higher stacking context (`.at-hero-photo-tools` at `z-index: 5`,
  `.at-hero-content`'s eyebrow/title/subtext/CTA at `z-index: 2`) or
  isn't behind the overlay at all — only the pre-cover-photo "+ Add a
  cover photo" empty-state button was affected, which is why it read as
  "everything works except the cover photo." Fixed by adding the missing
  `pointer-events: none` so `.at-hero-overlay` matches
  `business.html`'s original rule exactly. Verified via a headless-Edge
  `--dump-dom` pass (Supabase blocked) confirming the served page's
  `<style>` block now contains `pointer-events: none` on that rule, with
  no change to the 9 seeded models/10 seeded prompts rendering
  correctly — a live click-through of the file-picker flow itself still
  wasn't possible in this environment (see the build entry above for
  why), so the fix is verified by matching the known-working source
  it was supposed to be copied from, not by an interactive click test.

- **AI & Tech (`aitech.html`) recolored from gold to teal, matching a
  second reference photo** (a "Protected & Secure / Regulated /
  Professional Support / Reliable" feature-card grid — dark near-black
  cards with a soft cyan-teal glow, white bold titles, muted gray body
  text). Per an explicit instruction to change only the aesthetic/colors
  of "the databases and blocks" and delete nothing — this is a pure CSS
  pass: no HTML structure, JS, or data model changed, and every existing
  feature (filters, search, drag-reorder, modals, favorites, copy button,
  the seed-race-safety sync wiring) is untouched. Same "this file's own
  second reference-photo exception replacing the first" precedent
  `dreamboard.html`'s own light→dark palette flip already set (see that
  page's changelog) — not a new precedent for the rest of the app, and
  not a change to Business Hub/Dream Board's own gold tokens, which this
  file's `--at-*` tokens were only ever a private, same-file-scoped copy
  of (CLAUDE.md §6/DO NOT MODIFY rule 2).
  - **Token repoint, not a rename**: `--at-gold`/`--at-gold-bright` keep
    their names (there's no shared cross-file contract depending on
    them — DO NOT MODIFY rule 2 only protects the *shared* tokens in
    `sync.js`/`topbar.js`) but now hold teal values (`#2dd4bf`/`#7ff3e3`)
    instead of the original gold (`#c9a876`/`#e8cf9f`) — the same
    "repoint an existing token's value instead of inventing a new one"
    precedent `household.html`/`selfcare.html` used for their own
    `--accent`. `--at-bg`/`--at-bg-deep`/`--at-paper-solid`/`--at-text*`/
    `--at-hairline`/`--at-accent-tint` all shifted from warm (brown/
    champagne-tinted near-black and off-white) to cool (teal-tinted
    near-black and off-white) in the same pass, and every hardcoded
    `rgba(201,168,118,*)`/`rgba(11,10,8,*)`/`rgba(5,4,3,*)`/`#24190c`
    literal that wasn't already routed through a CSS variable (the
    ambient body-glow gradients, the back-button/hero-photo-tools/modal
    backdrop tints, the dark contrast-text color used on the gold
    button/cover gradients) was swept to its teal equivalent by hand —
    confirmed with a repo grep afterward that zero warm-gold literals
    remain in the file. `--success`/`--warning`/`--danger`/`--info` were
    left alone, same "status colors carry meaning, not brand accent"
    precedent every other re-theme in this app already follows.
    `theme-color` meta tag updated to match.
  - **New, additive-only embellishment**: `.at-card::before`, a soft
    radial teal glow positioned near the top-left of every card
    (`.at-card` already has `overflow:hidden`, so it's clipped to the
    card's rounded corners), with `.at-card > *` bumped to
    `position:relative; z-index:1` so real content still paints above
    it — a pure-CSS echo of the reference photo's illustrated
    icon-glow artwork, no image asset added (consistent with this
    repo's no-binary-assets convention). Applies uniformly to both the
    Model gallery cards and Prompt cards, since both share the same
    `.at-card` chassis.
  - Fonts, layout, spacing, and every component's markup are unchanged —
    only fills/borders/text colors and the one new glow layer moved.
  - **Verified** via a headless-Edge `--dump-dom` pass (Supabase
    blocked, per this file's standing testing rule): confirmed the
    served page's `:root` block resolves to the new teal values, the
    new `.at-card::before` rule is present, and the 9 seeded models/10
    seeded prompts still render correctly with no drop in count — a
    full-page screenshot could not be captured this round (headless
    Edge's `--screenshot` flag intermittently failed to write a file in
    this environment despite the browser exiting cleanly; retried
    several times with fresh profiles before falling back to the
    dump-dom + source-grep verification actually used), so this pass
    was verified by confirming the served CSS values and unchanged
    render counts rather than a visual screenshot comparison.

- **Media (`entertainment.html`) re-themed to match Dream Board's dark
  cinematic look, and gained a per-gallery hero cover section (its five
  "mini pages" — Podcasts/Stories/Entertainment/Playlists/Favorites —
  each now read as their own Dream-Board-style "page").** Per an explicit
  request to make Media's aesthetic match Dream Board's exactly; purely a
  visual/structural reskin — no gallery, filter, sort, favorite, rating,
  or CRUD behavior was removed or changed. Cover photos start empty by
  default (confirmed with the user): this page has no way to read what
  photos already live in Dream Board's own Supabase row, so nothing was
  pre-filled — the mechanism matches, the content doesn't.
  - **Palette**: the dusty-rose/wine "boutique gallery" theme this page
    carried since its own earlier re-theme (see §6/the changelog entries
    above) is retired here specifically, in favor of Dream Board's actual
    current near-black/champagne-gold values, copied 1:1 — `--tile-border`/
    `--pink-accent`/`--wine`/`--candle`/`--cream` are gone; `--bg`/
    `--bg-deep`/`--bg-card`/`--text-primary`/`--text-secondary`/
    `--text-tertiary`/`--border`/`--accent`/`--good`/`--warn`/`--bad`/
    `--font-serif` all kept their existing *names* (so every rule that
    already referenced them needed no further edits) with values
    repointed to Dream Board's, plus two new tokens, `--accent-bright`/
    `--accent-tint`, matching Dream Board's `--db-gold-bright`/
    `--db-accent-tint`. Cormorant Garamond (serif display type) is now
    loaded via the same Google Fonts `<link>` Dream Board uses. This is
    the same "explicit reference/aesthetic-match instruction" exception
    category as every other per-file palette in this app (CLAUDE.md §6/
    DO NOT MODIFY rule 2) — just matching a sibling page's own already-
    granted exception instead of a fresh reference photo.
  - **Per-gallery hero** (`.ent-hero`, new): the old static `.ent-banner`
    (a fixed "Entertainment" title + fixed subtext) is replaced with a
    full-bleed hero — eyebrow, an autosizing serif headline (editable via
    a borderless `<textarea>`, same technique as Dream Board's), subtext,
    a frosted pill CTA that scrolls down to the gallery tabs, and a cover
    photo-or-video area with Change/Remove tools and a video re-attach
    prompt — that swaps content every time the active gallery ("mini
    page") changes, exactly mirroring how Dream Board's hero swaps per
    tab. Implementation is a direct, line-for-line port of Dream Board's
    hero mechanism (`currentHero()`/`patchHero()`/`renderHero()`/
    `renderPageBg()`/`openHeroFilePicker()`/`reattachHeroVideo()`/
    `extractDominantColor()`/`handleHeroMediaFile()`/`wireInlineEdit()`/
    `sessionVideoBlobs`), adapted to key off `activeGalleryKey` instead of
    a `tabId` — including the same session-only video-blob handling (a
    video cover never touches `localStorage`/Supabase; a reload without
    its blob shows the same "needs to be re-attached" prompt) and the
    same combined-accept-type pitfall avoidance (two explicit "+ Add a
    cover photo" / "+ Add a cover video" buttons, never one
    `accept="image/*,video/*"` input) Dream Board's own changelog already
    documented hitting once.
  - **Data**: one new key, `media:heroes` — a plain object keyed by
    gallery key (`podcasts`/`stories`/`entertainment`/`playlists`/
    `favorites`), each value shaped like Dream Board's `hero` record
    (`eyebrow`/`title`/`subtext`/`ctaLabel`/`photo`/`photoColor`/
    `mediaType`). Already covered by the existing `syncedPrefixes:
    ['media:']` in this page's `initCloudSync(...)` call — no `sync.js`
    change, no new sync key list entry needed. Defaults (per-gallery
    eyebrow/title/subtext/CTA text, tailored to each gallery, cover photo
    always empty) live in code (`DEFAULT_HEROES`) and only get written to
    `localStorage` once a field is actually edited — an untouched gallery
    keeps showing its default text forever without ever writing a hero
    record for it.
  - **Page-wide cover-photo backdrop** (`#entPageBg`, new): the active
    gallery's hero photo (or video), blurred and dimmed behind the entire
    page — not just the hero — same `#dbPageBg` technique and same
    reasoning as Dream Board (a frosted-glass card needs something with
    color/texture behind it to actually read as glass). Empty when a
    gallery has no cover set, same as before this change.
  - **Gallery cards** (`.ent-card`) switched from a flat tinted fill to
    real frosted glass (`background: rgba(255,255,255,0.08)` +
    `backdrop-filter: blur(22px) saturate(1.6)`, white-hairline border,
    gold border/glow on hover) — same recipe as Dream Board's `.dw-card`.
    The gallery-switcher pills (`.chip-gallery`, this page's "mini page"
    nav) and the secondary status/progress filter chips were restyled to
    Dream Board's tab-pill look (tinted gold fill + gold border when
    active, instead of the old solid pink→wine gradient). Buttons
    (`.btn-add`/`.btn-primary`), the sort `<select>`, and the Add/Edit
    modal (`.modal`/`.field`) were all re-graded to the same gold-
    gradient/frosted-glass recipe Dream Board's own buttons/modal use.
  - **Verified via headless Edge, `*.supabase.co` blocked at the network
    layer before navigation** (`--host-resolver-rules="MAP *.supabase.co
    0.0.0.0"`, passed as one quoted argument — the same PowerShell
    argument-splitting pitfall `business.html`'s own changelog entry
    already documented, hit and worked around again here) plus a live
    CDP session (no interactive-testing gap this time — a
    `remote-debugging-port` connection came up cleanly): confirmed a
    fresh profile's default hero (Podcasts) renders its default eyebrow/
    subtext/CTA text; clicking through Stories/Favorites correctly swaps
    the hero's eyebrow/title per gallery; the Favorites gallery still
    hides the "+ Add" button and still shows 0 items on an empty profile;
    both hero photo/video add buttons and the page backdrop element are
    present; inline-editing the eyebrow and blurring persists it to
    `media:heroes` correctly; and, after seeding one realistic
    `media:podcasts` card directly into `localStorage` and reloading —
    the card renders with the correct title/rating stars/favorite-active
    icon, the status filter row shows all 3 Podcasts statuses + All, the
    progress filter row (Podcasts-only) is visible, and the same card
    correctly aggregates into the Favorites gallery tagged "Podcasts ·
    Learning". Zero JS exceptions across every check. Two headless Edge
    instances were spun up for this (both explicitly launched with their
    own `--user-data-dir`/`--remote-debugging-port`, confirmed via
    `Win32_Process` command-line inspection before being stopped) and
    torn down individually by PID afterward — no other running Edge
    process on the machine was touched.

- **Self-Care (`selfcare.html`) rebuilt: Water and Bucket List removed
  entirely, and the whole tab was reconstructed around Dream Board's exact
  engine and aesthetic.** Per an explicit two-part request: (1) remove
  Water and Bucket List first, (2) rebuild the tab to match a reference
  Notion "Fall Self Care Bucket List" template (cover photo with change/
  reposition, a checkbox+title header, an instructions callout, a "bonus"
  callout, a Table/Gallery/To Do/Done view switcher over a checklist
  database, and a photo gallery grid below it) with everything editable,
  freely moveable, and adjustable, then (3) apply Dream Board's exact
  style/aesthetic to every page in the tab. Read literally, (2) and (3)
  together point at the same solution already established twice elsewhere
  in this app (Business Hub, AI & Tech): reuse Dream Board's drag-and-drop
  widget-board engine wholesale for the structure/editability the
  reference template calls for, then let Dream Board's actual dark-
  cinematic tokens/components carry the "aesthetic" ask, rather than
  recreating the reference photo's own light Notion palette.
  - **Water and Bucket List are gone, not hidden.** Deleted from
    `selfcare.html`: the `#wtrProfileCard`/`#wtrGoalCard`/`#wtrLogCard`/
    `#wtrHistoryCard` markup and every `wtr-*` function (profile form,
    goal ring, breakdown, quick-add, history), the `#wtrCustomModalBg`
    modal, the `#bktModalBg`/`#bktSurpriseModalBg` modals and every
    `bkt-*` function (grouping, filters, celebratory Mark Done, Surprise
    Me), and both tabs' nav entries. Deleted from `selfcare-data.js`:
    `SelfCareUnits`, `SelfCareCurrency`, `ACTIVITY_LEVELS`/`CLIMATES`/
    `hydrationProfileModel`/`getHydrationProfile`/`saveHydrationProfile`/
    `recommendedDailyMl`/`hydrationGoalBreakdown`, `WATER_SOURCES`/
    `waterLogModel`/the `WaterLog` collection/`todayIntakeMl`/
    `todayProgress`/`intakeHistory`, and `BUCKET_CATEGORIES`/
    `BUCKET_STATUSES`/`bucketItemModel`/the `BucketList` collection/
    `bucketItemsByStatus`/`bucketItemsByCategory`. The old Overview tab's
    4-tile daily snapshot (which read from both of these, among others)
    is gone along with them — Overview isn't a separate tab anymore at
    all (see below). `selfcare:hydrationProfile`/`selfcare:waterLog`/
    `selfcare:bucketList` were left alone in localStorage/Supabase,
    orphaned but untouched — same treatment as every other removed-
    feature key elsewhere in this app (the `health` row, `po_coach_weights`,
    `ent:cards`, etc.), not something this pass was asked to clean up.
  - **Data layer**: `selfcare-data.js` gained the same `Tabs`/`Widgets`
    flat-collection board engine as `dreamboard-data.js`/`business-data.js`
    — copied structurally, not reinvented: `tabModel` (`id`/`title`/
    `order`/`hero`), `widgetModel` (`id`/`tabId`/`column`/`order`/`type`/
    `title`/`tint`/`data`), the same 10 widget types (checklist/list/note/
    quote/affirmation/steps/photos/calendar/feature/infocard),
    `columnsForTab`/`reorderTab`, and the same `normalizeTabs()` hero-
    backfill safety net Dream Board's own changelog documents needing
    after a real crash there. One additive field beyond Dream Board's
    shape: `tab.panel` (`''` for a freeform board, or `'journals'`/
    `'meditations'` for a tab that instead renders this page's own
    dedicated Journals/Meditations UI below its hero) — Journals and
    Meditations keep their real, already-working dedicated features
    (topic/type/duration filters, search, favorites, URL validation,
    Markdown read view) rather than being flattened into generic widgets,
    since neither was asked to change functionally, only visually.
    `JournalEntries`/`Meditations` collections/models are unchanged
    verbatim from the prior build.
  - **Main tab ("Self-Care")** is a genuine freeform 3-column drag-and-
    drop widget board — Dream Board's engine ported line-for-line
    (hero eyebrow/title/subtext/CTA/cover photo-or-video, `#scPageBg`
    page-wide blurred cover-photo backdrop, frosted-glass numbered widget
    cards with a hover-reveal drag handle/color-grading tint popover/
    delete, SortableJS cross-column drag-reorder, Add Widget menu, Reset
    to Default, the same seed-race-safe cloud-sync-then-seed sequencing
    as `dreamboard.html`/`business.html`'s own `maybeSeedAfterSyncAttempt()`)
    — seeded to loosely mirror the reference template's structure, not a
    pixel copy of it (same "loosely mirror, don't copy verbatim"
    precedent `dreamboard-data.js`'s own `seedDefaultBoard()` already
    set): a Note widget ("How To Use This Board"), an Info Card ("Bonus"),
    a Checklist widget ("Self-Care Checklist," 16 emoji-prefixed seasonal
    ritual items echoing the reference's own list without being a literal
    copy — journaling, a cooking class, stargazing, candles, planting,
    a closet audit, movie night, a vision board, a mindfulness reset, a
    hike, mindful coloring, reading by firelight, a playlist, baking, a
    picnic, a slow drink at home), and a Photo/Video Grid ("Cozy
    Inspiration," empty by default, wide/2-column) — the "gallery" half
    of the reference template's Table/Gallery/To Do/Done switcher. The
    tab title is deliberately "Self-Care," not "Bucket List" — naming the
    rebuilt tab after the exact feature that was just asked to be removed
    would have read as reintroducing it under a new label.
  - **A small, genuinely new addition to the widget engine**: Checklist-
    type widgets (only — List/Affirmation are unaffected) gained a
    transient, non-persisted All/To Do/Done chip row above their item
    list (`checklistFilters`, keyed by widget id, module-scoped state,
    same "transient UI filter, not stored data" precedent as
    `business.html`'s Content Plan date filters) — the concrete answer to
    the reference template's To Do/Done views, scoped to checklists
    specifically since the Photos widget already serves as this board's
    "Gallery" view and a literal fourth Table view wasn't built (the
    Checklist itself already reads as the "database"). An empty filtered
    view shows a short reassuring note ("Nothing left to do — nice.")
    instead of a bare blank list.
  - **Journals and Meditations** are now `panel`-mode tabs: each gets its
    own hero (eyebrow/title/subtext/cover photo, same mechanism as the
    board tab's hero) with the CTA scrolling to that panel's own "+ New
    Entry"/"+ New Meditation" button instead of to a board. Below the
    hero, both panels' actual UI/logic (topic/type/duration chip filters,
    search, the Journal read-view modal with the Markdown-lite renderer,
    the Meditation grid's favorite star/Open/Edit/Delete, both Add/Edit
    modals) are carried over verbatim from the prior build — only the
    CSS changed: `.jr-row`/`.med-card` are now real frosted glass (the
    same `rgba(255,255,255,0.08)` + `backdrop-filter: blur(22px)
    saturate(1.6)` recipe as the board's `.scw-card`), row/card titles
    use the serif display font, `.chip`/`.chip.active`/`.tag`/
    `.btn-primary`/`.modal`/`.field` were all re-graded to Dream Board's
    gold-on-near-black palette, and the old dusty-rose/wine `--tile-
    border`/`--pink-accent`/`--wine`/`--candle`/`--cream` tokens this
    page carried from its earlier "match Media's boutique-gallery look"
    re-theme (see that entry above) are gone, replaced by this file's own
    private `--sc-*` copy of Dream Board's `--db-*` values — the same
    "explicit aesthetic-match exception, this file's own token copy, not
    a shared palette" category as Dream Board/Business Hub/AI & Tech
    (CLAUDE.md §6/DO NOT MODIFY rule 2).
  - **Sync unchanged**: `initCloudSync({ appKey: 'selfcare', syncedPrefixes:
    ['selfcare:'] })` — same call, same appKey, same single prefix, so
    every new `selfcare:tabs`/`selfcare:widgets` key is covered
    automatically with no `sync.js` change and no new sync mechanism.
  - **Verified via headless Edge, `*.supabase.co` mapped to `0.0.0.0`**
    (`--host-resolver-rules`, armed at launch before navigation, per this
    file's established testing convention): a `--dump-dom` pass with an
    8-second virtual time budget (long enough to clear the 5-second seed-
    race-safety window, which a shorter first attempt at 4 seconds missed
    entirely — the board/tabs came back empty on that first try, which
    was the seed-race guard correctly *not* firing yet, not a bug)
    confirmed all three tabs render (Self-Care active by default, Journals,
    Meditations), the seeded hero title populated, exactly the 4 seeded
    widgets rendered with correct titles ("How To Use This Board,"
    "Bonus," "Self-Care Checklist," "Cozy Inspiration"), and all 16
    checklist items rendered. A follow-up attempt at live interactive
    testing via a raw CDP-over-websocket session (the technique this
    file's own earlier Self-Care entries — Meditations/Water/Bucket List
    — used successfully) could not reach a remote-debugging port in this
    session; a static cross-check was used instead, the same fallback
    `aitech.html`'s own changelog entry already used for the same
    limitation: every `$('id')` reference in the script was matched
    against the HTML's actual element ids (84 referenced, all resolved,
    none orphaned), and since several `$('id').addEventListener(...)`
    calls run at top-level script-execution time (not inside `init()`),
    any one of them throwing on a missing element would have aborted the
    entire script before `init()` ever ran — the fact that tabs/board/
    seed data all rendered correctly in the dump-dom pass is itself proof
    the whole script executed cleanly end to end, not just the parts
    after `init()`. A real click-through (dragging a widget, adding a
    checklist item, toggling the To Do/Done filter, switching tabs
    interactively) is still recommended before relying on this page
    heavily, same disclosed-limitation caveat this file's other entries
    already carry for this environment.

- **Bugfix: Self-Care's tab bar rendered completely empty for anyone who
  already had real journal/meditation data from before the rebuild above
  — reported as "nothing shows up when I click on the tab."**
  Root cause: `seedIfEmpty()` bundled two unrelated decisions into one
  check — "should I create the new Tabs/Widgets board" and "should I add
  sample journal/meditation content" — both gated on the same "is
  literally everything empty" test. Anyone who'd used this page before
  this rebuild already had real `JournalEntries`/`Meditations` (from the
  prior Journals/Meditations-only build) but, since Tabs/Widgets never
  existed until this rebuild, had none of those. `seedIfEmpty()` saw the
  non-empty journal/meditation data, concluded "already set up," marked
  `selfcare:seeded` true, and returned — permanently skipping Tab
  creation. With zero Tabs, `renderTabs()` had nothing to render (no tab
  buttons at all) and `renderBoard()`/the panels had nothing to show —
  the same class of bug this file's own Dream Board (missing-hero crash)
  and Business Hub (missing-`layout`/`hasTemplates`) entries already
  document: a newly-required field/structure with no backfill for
  records that predate it.
  - **Fix**: split the one seed check into two independent functions.
    `ensureTabsExist()` (new) creates the default Tabs (+ Widgets on the
    main tab) if and only if none exist yet — it never reads or writes
    `JournalEntries`/`Meditations`, so a user's real content can't block
    it and it can't be blocked by real content. `seedSampleContentIfFresh()`
    (new, replacing the old `seedIfEmpty()`) keeps the original "only for
    a genuinely fresh install" caution for the sample journal/meditation
    entries specifically, checking only those two collections, not Tabs/
    Widgets. `seedDefaultBoard()` (the Reset-to-Default path) is
    unaffected — still a full wipe-and-rebuild of everything.
  - `selfcare.html`'s boot sequence now calls both functions from
    `initCloudSync`'s `onApplied` callback (the moment the page actually
    knows what's real from the cloud, not an arbitrary timer) and again
    from the existing timed fallback (for when sync is unavailable or a
    remote row doesn't exist yet at all) — same seed-race-safety window
    as before, just no longer gated by a `remoteAppliedOnce` flag that
    conflated "some sync activity happened" with "the Tabs specifically
    arrived."
  - **Verified two scenarios in headless Edge with Supabase blocked**
    (`--host-resolver-rules` mapping the Supabase host to `0.0.0.0`,
    `--dump-dom` with an 8-9s virtual time budget, per this file's
    established testing convention): (1) a fresh, never-used profile
    still seeds all 3 tabs, the 4 default widgets, and the sample
    journal/meditation content correctly, unchanged from before this
    fix; (2) a profile pre-seeded with real `selfcare:journalEntries`/
    `selfcare:meditations` and `selfcare:seeded: true` but no
    `selfcare:tabs`/`selfcare:widgets` at all (reproducing the exact
    reported bug's starting state) now correctly creates and renders all
    3 tabs and the Self-Care Checklist widget, instead of rendering an
    empty tab bar.

- **New page: `anxiety.html` ("Anxiety"), a dedicated page with a
  Breathwork section and a Tips & Techniques section.** Genuinely new
  files, `anxiety.html` + `anxiety-data.js` — new nav pill (`ANXIETY` →
  `anxiety.html`, appended after `AI & TECH` in `topbar.js`'s injected
  pill list — the only edit made to `topbar.js`, same one-line-addition
  precedent every prior page addition followed); new sync key
  (`appKey: 'anxiety'`, `syncedPrefixes: ['anxiety:']`, wired via the
  standard shared `initCloudSync` — same call pattern as every other
  page, nothing new invented).
  - **Palette: no exception this time.** No reference photo or aesthetic
    instruction was given for this page, so — per DO NOT MODIFY §2 —
    it stays on this app's actual standard palette (documented in §3):
    near-black background, off-white text, the existing long-form
    `--success`/`--warning`/`--danger`/`--info` semantic accents, and
    `--accent` repointed to `--info`'s own blue value rather than a new
    hue — the same call `household.html`/`selfcare.html`'s original
    builds made for the same reason. The shared cover-banner component
    (sunburst emblem, italic serif title, tracked-caps subtext, outlined
    pill CTA, radiating-line divider — the same structure index.html/
    gym.html/braindump.html/finance.html/household.html all already use)
    was reused verbatim rather than inventing a new page-header pattern.
  - **Two tabs, same underline-tab-bar/hash-router pattern as
    `household.html`/`selfcare.html`'s original build** (`anxiety:active_tab`,
    `#breathwork`/`#tips` hash deep-linking): **Breathwork** and
    **Tips & Techniques**.
  - **Breathwork** (`anxiety:breathwork`) — a CRUD gallery of
    paced-breathing techniques: name, description, a "best for" goal tag
    (Calm/Focus/Sleep/In the moment/Other, filterable via chips), a
    4-phase seconds pattern (inhale/hold/exhale/hold — either hold can be
    set to 0 to skip that phase entirely), a suggested cycle count, and a
    favorite star. Seeded with four real, commonly-taught techniques (Box
    Breathing 4-4-4-4, 4-7-8 Breathing, Coherent Breathing 5-0-5-0,
    Extended Exhale 4-0-8-2), each tagged to a different goal so the
    filter chips have something to demonstrate immediately.
  - **The breathing pacer** (`#pacerModalBg`) is this page's one genuinely
    new mechanism, not copied from anywhere else in this app: a "▶ Start"
    button per technique opens a modal with an animated circle that grows
    on inhale, holds, and shrinks on exhale/hold, a large phase label
    (Inhale/Hold/Exhale) and countdown number, and a cycle counter ("Cycle
    2 of 6"). Phase advancement is timestamp-based (`Date.now()` diffs on
    a 200ms tick, with the phase-start time corrected for tick-interval
    overshoot on every advance) rather than a naive tick counter, the same
    drift-proofing precedent `gym.html`'s own workout timer already
    established — a backgrounded/throttled tab can't desync the countdown
    from real elapsed time. The circle's grow/shrink itself is delegated
    to a single CSS `transition` set once per phase change (`transform:
    scale(...)` + a `transition-duration` matching that phase's seconds),
    not animated frame-by-frame in JS — consistent with this app's
    no-animation-library convention (same spirit as `gym.html`'s
    synthesized-beep timer or `dreamboard.html`'s CSS-only sunburst
    emblems). Finishing all suggested cycles shows a small "✓ Nice work"
    completion state instead of silently stopping; Stop is available at
    any time mid-session.
  - **Tips & Techniques** (`anxiety:tips`) — a filterable, favoritable card
    library: title, category (Grounding/Cognitive/Physical/Social/Other,
    filterable via chips), freeform body text, and a favorite star, plus
    a "★ Favorites only" toggle and a title+body search box — the same
    filter/search/favorite shape `selfcare.html`'s Meditations panel
    already established for this app, reused rather than reinvented.
    Seeded with seven real, generic anxiety-management techniques spread
    across all four real categories (5-4-3-2-1 grounding, cold water on
    the face/wrists, labeling a thought rather than arguing with it,
    texting one person, progressive muscle relaxation, "what would I tell
    a friend," feet-flat-on-the-floor grounding).
  - **Seeding** (`anxiety-data.js`'s `seedIfEmpty()`) follows the same
    seed-race-safety contract as every other synced page in this app
    (Dream Board/Business Hub/Self-Care): it refuses to run if either
    collection already has real content, and `anxiety.html`'s boot
    sequence only calls it from a timed fallback after giving
    `initCloudSync`'s cloud pull a real window first, not immediately —
    so a fresh device can't push fabricated seed content over another
    device's real data before it's had a chance to sync down.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules` mapping the Supabase host to `0.0.0.0`,
    `--dump-dom` with an 8-second virtual time budget, per this file's
    established testing convention): a fresh profile's default
    (`#breathwork`) tab correctly rendered all 4 seeded techniques; a
    second pass navigating straight to `#tips` correctly rendered the
    Tips panel with all 7 seeded tips and hid the Breathwork panel; every
    `$('id')` reference in the script was cross-matched against the
    HTML's actual element ids (42 referenced, all resolved, none
    orphaned); and both passes produced zero stderr output (no console
    errors). Interactive testing (starting the pacer, dragging through a
    full inhale/hold/exhale cycle, adding/editing/deleting a technique or
    tip) was not possible this round — this environment's headless Edge
    still gets absorbed into an already-running background instance
    rather than launching in isolation with its own remote-debugging
    port, the same disclosed limitation several other pages' changelog
    entries in this file already note — so a real click-through,
    especially of the pacer's timing, is recommended before relying on
    this page heavily.

- **Anxiety moved from a standalone top-level page into its own tab
  inside Self-Care, restyled to match.** Per an explicit follow-up ask:
  `anxiety.html`/`anxiety-data.js` are deleted outright (not left as
  unreachable dead code — this is the same session's own page being
  relocated, the same "supersede, don't preserve" precedent as e.g.
  `gym.html`'s Timer modal→panel conversion), the `ANXIETY` nav pill is
  removed from `topbar.js`, and Breathwork + Tips & Techniques now live
  as a 4th Self-Care tab (`panel: 'anxiety'`), reskinned to match the
  other three Self-Care tabs' Dream-Board aesthetic (frosted-glass cards,
  gold-on-near-black tokens, serif titles) rather than the standard
  near-black/off-white palette the standalone page used.
  - **Data moved into `selfcare-data.js` verbatim**: `breathworkModel`/
    `anxietyTipModel` (renamed from `tipModel` to avoid any ambiguity with
    a future "tip" concept elsewhere on this page) and their
    `BREATHWORK_GOALS`/`ANXIETY_TIP_CATEGORIES` constants are unchanged
    field-for-field from the deleted page's own data layer — only the
    storage keys moved, from a top-level `anxiety:breathwork`/
    `anxiety:tips` to `selfcare:anxietyBreathwork`/`selfcare:anxietyTips`,
    so both ride the page's existing `syncedPrefixes: ['selfcare:']` with
    no new sync wiring (DO NOT MODIFY §1: reuse `initCloudSync` exactly as
    wired, don't invent a new mechanism).
  - **A real migration, not just a rename**: since the standalone Anxiety
    page had only just shipped, a real device could already have actual
    user-created techniques/tips sitting under the old `anxiety:*` keys.
    `migrateLegacyAnxietyPage()` (new, guarded by its own one-time flag)
    copies that content into the new `selfcare:` collections once — only
    if those collections are still empty, so it can never clobber
    anything — and leaves the old `anxiety:*` keys in place afterward,
    orphaned but untouched, same treatment as every other removed-page
    key elsewhere in this app. Verified directly: seeded a device with 3
    pre-existing Self-Care tabs (no Anxiety tab — it didn't exist yet)
    plus real `anxiety:breathwork`/`anxiety:tips` content, loaded the
    rebuilt page, and confirmed the real content ("My Real Custom
    Technique," "My Real Custom Tip") landed in the new
    `selfcare:anxietyBreathwork`/`selfcare:anxietyTips` keys — not the
    demo seed content — while the 3 existing tabs were left completely
    unchanged and a 4th "Anxiety" tab was correctly appended at the end.
  - **A second real bug found and fixed while building this repair,
    before it shipped**: the Self-Care Tabs board already has a
    documented precedent for "a newly-required structure that pre-
    existing users don't have yet" (see the two entries above this one —
    the missing-Tabs-board bug). Adding a 4th tab is the exact same class
    of problem one level down, and the existing fix doesn't cover it:
    `ensureTabsExist()` only acts when `Tabs.list().length === 0`, so an
    existing 3-tab Self-Care user would never get the new Anxiety tab
    created at all — no error, just a tab bar stuck at 3 forever, the
    same "nothing shows up" failure mode already fixed once, recurring
    one layer down. Fixed with `ensureAnxietyTabExists()` (new,
    independent of `ensureTabsExist()`'s "totally empty" gate): checks
    for a tab with `panel: 'anxiety'` specifically and appends one if
    missing, regardless of how many other tabs already exist, never
    touching Journal/Meditation/Widget/Breathwork/Tip content. Unlike
    `ensureTabsExist()`'s "build everything from scratch" branch (which
    must stay deferred behind the cloud-sync window, since replacing
    *nothing* with a full default board risks clobbering another
    device's real board if it races a real remote pull), appending one
    new tab to an *already-populated* Tabs array can't clobber anything
    that's already there — so `selfcare.html`'s `init()` now calls
    `ensureAnxietyTabExists()` immediately at boot (guarded by
    `SC.Tabs.list().length > 0`, so a genuinely fresh device isn't handed
    a stray lone Anxiety tab before its own deferred full-board seed has
    even had a chance to run), placed after `initCloudSync()` is wired so
    the write is tracked "dirty" — same precedent as Dream Board's own
    Vision Board video-fix repair. Verified this specific fix by seeding
    the exact 3-tab-no-Anxiety scenario above and confirming the 4th tab
    appeared without the fix's guard (`Tabs.list().length > 0`) ever
    letting a fresh/empty device get a premature lone tab.
  - **Verified via headless Edge, `*.supabase.co` mapped to `0.0.0.0`**
    (per this file's established testing convention), three scenarios
    read back through an iframe sharing the same `file://` origin (so
    real `localStorage` state could be inspected directly rather than
    guessed from rendered markup alone): (1) a completely fresh profile
    correctly produced all 4 tabs (`Self-Care/Journals/Meditations/
    Anxiety`, all with `panel` values as expected), 4 seeded breathwork
    techniques, and 7 seeded tips; (2) a profile pre-seeded with 3 real
    Self-Care tabs (no Anxiety) plus real legacy `anxiety:breathwork`/
    `anxiety:tips` content correctly ended up with all 4 tabs (the 3
    original ones byte-identical, the new Anxiety tab appended at
    `order: 3`) and the real migrated breathwork/tip content, not demo
    seed data; every `$('id')` reference in `selfcare.html`'s script was
    cross-matched against the HTML's actual element ids (128 referenced,
    all resolved, none orphaned); and every pass produced zero stderr
    output (no console errors). A fourth attempt at confirming the
    Anxiety panel's *visual* rendering via a two-stage iframe reload (set
    `selfcare:active_tab` to the real generated Anxiety tab id, reload,
    read the iframe's rendered DOM) hit a harness timing issue specific
    to this environment's virtual-time-budget handling of iframe reloads
    (`f.contentDocument` came back inaccessible in time) rather than a
    page bug — the same rendering code path (grid building, filters, the
    pacer) was already interactively confirmed correct when this was
    still the standalone `anxiety.html` page earlier in this session, and
    the panel's HTML structure was independently confirmed present in
    every dump. A real click-through of the Anxiety tab specifically
    (switching to it, toggling Breathwork/Tips, starting the pacer) is
    still recommended before relying on this page heavily.

- **Nutrition (`nutrition.html`/`nutrition-data.js`) rebuilt: everything on
  both pages made editable/moveable/adjustable, then the whole tab re-themed
  to match Dream Board's exact engine/aesthetic.** Per an explicit
  two-part request — first make everything editable/moveable/adjustable,
  then copy Dream Board's style onto every page in the tab. Nothing was
  deleted: My Kitchen's recipe database (title/description/servings/prep+
  cook time/tags/ingredients/steps-with-photos/notes/favorite/cover image)
  and Grocery List's store-grouped items (quick-add, Manage Stores,
  check-off, Add-to-Grocery-List bridge from a recipe) are the exact same
  `NutritionData` collections and CRUD flows as before, untouched in
  behavior — this pass only added capability and re-skinned.
  - **Editable/moveable/adjustable, concretely**:
    - `Recipe`/`GroceryItem` both gained an `order` field; the My Kitchen
      gallery and each Grocery List store group are now real drag-and-drop
      (SortableJS, already a dependency in this app via Dream Board/
      Business Hub/AI & Tech — same CDN version, no new dependency added),
      handle icon on each card/row. `NutritionData.reorderRecipesVisible()`
      reorders only the currently *visible* (search/tag/favorites-filtered)
      cards, remapping them back into their correct slot positions among
      the full unfiltered order — same technique `entertainment.html`'s
      own Manual sort mode already established for exactly this problem.
      Grocery drag-reorder is deliberately scoped to *within* one store's
      group only (`NutritionData.reorderGroceryGroupItems()`) — reassigning
      an item to a different store is still done via its Edit modal's
      Store select, not by dragging it across groups, a deliberate scope
      cut to avoid the empty-group-has-no-drop-target edge case a full
      cross-group drag would introduce.
    - Both pages' old single static cover banner is replaced by a real,
      per-page editable hero (eyebrow/headline/subtext/CTA/cover photo-or-
      video), and each page gained its own freeform, drag-and-drop **"More
      Widgets" board** (Add Widget menu, ten widget types, per-widget
      color-grading tint, Reset to Default) sitting below its real content
      — the same "fixed real content + a freeform board layered on for
      full extensibility" shape Business Hub's own Content tab already
      established (Platform/Content Plan/Useful Resources databases +
      a "More Widgets" board). Reset only wipes the two Tabs/Widgets
      records (`nutrition:tabs`/`nutrition:widgets`) — it can never touch
      a real recipe, grocery item, or store, since those live in
      completely separate `NutritionData` collections Reset never calls.
  - **Board engine reused, not reimplemented**: `nutrition-data.js` gained
    the exact `Tabs`/`Widgets` flat-collection engine from
    `dreamboard-data.js` (same `hero`/`widgetModel`/`columnsForTab`/
    `reorderTab`/`normalizeTabs` shapes), with one addition — each tab
    carries a `panel` field (`'kitchen'` or `'grocery'`) naming which of
    the two existing real pages it belongs to, since (unlike Dream Board)
    Nutrition's tabs are fixed, not user-created/renamed/deleted; there's
    no tab-add/rename UI here. `nutrition.html`'s hero/tabs/board script
    is Dream Board's engine ported line-for-line (`ND` in place of `DB`,
    `nt`-prefixed ids in place of `db`-prefixed ones) — same seed-race-
    safety contract as Dream Board/Business Hub/AI & Tech
    (`ensureBoardTabsExist()` only ever runs after `initCloudSync`'s cloud
    pull has had a real 5-second window to answer, or immediately if the
    Supabase SDK never loaded at all), wired via a small hook
    (`window.__ntOnRemoteApplied`/`window.__ntAfterSyncAttempt`) added to
    the existing single `initCloudSync({...})` call's `onApplied`
    callback — same call, same config, just a richer callback body, not a
    second sync mechanism (DO NOT MODIFY §1). `ensureBoardTabsExist()` is
    independent of the pre-existing `seedIfEmpty()` (which only guards
    Recipes/Stores/GroceryItems) specifically so a device with real,
    pre-existing recipe/grocery data — which already has non-empty
    collections — still gets its two Tabs created, rather than being
    left with no tab to render at all (the same "newly-required structure
    with no backfill for pre-existing users" bug class Business Hub's and
    Self-Care's own changelog entries already document once each).
  - **Aesthetic**: `nutrition.html`'s own `:root` token *names* were kept
    (`--bg`, `--bg-deep`, `--accent`, `--border`, `--cream`, etc. — every
    existing rule referencing them needed no further edits) with their
    *values* repointed to Dream Board's exact near-black/champagne-gold
    palette, Cormorant Garamond loaded the same way, the page-wide blurred
    cover-photo backdrop (`#ntPageBg`) ported verbatim, and every existing
    component (recipe/grocery modals, `.btn-primary`/`.btn-add`/
    `.nutr-qa-add`/`.chip.active` gradient buttons, `.ent-card` gallery
    tiles) recolored from the old wine/dusty-rose gradient to Dream
    Board's gold one. Same one-off palette-exception category as Dream
    Board/Business Hub/AI & Tech/Self-Care (CLAUDE.md §6/DO NOT MODIFY
    rule 2) — no other page's tokens were touched.
  - **Sync**: no `sync.js` changes and no new sync key — `nutrition:tabs`/
    `nutrition:widgets`/`nutrition:boardSeeded`/`nutrition:active_tab` are
    all already covered by the existing `initCloudSync({ appKey:
    'nutrition', syncedPrefixes: ['nutrition:'] })` call, unchanged except
    for the `onApplied` hook addition described above.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules` mapping the Supabase host to `0.0.0.0`,
    armed before navigation, per this file's established testing
    convention) via both a `--dump-dom` pass and a live CDP session:
    both tabs render (2 tabs, correct panel visibility/hash routing on
    click), the 3 seeded recipes and 3 seeded "More Widgets" per tab all
    render with working drag handles, `nutrition:tabs`/`widgets`/
    `recipes`/`groceryItems`/`stores` all persisted with the expected
    counts, opening the Add Widget menu and adding a Note widget worked
    end-to-end (board count went 3→4), computed CSS custom properties
    resolved to the new gold values, no duplicate DOM ids, no horizontal
    overflow at a 390px mobile viewport, and a checklist checkbox/the
    hero CTA both responded with no console exceptions.

- **Fitness Studio (`gym.html`) gained a new Overview tab, rebuilt to
  match a reference "Aesthetic Notion Template 2.0" hub photo (a
  navigation row of arch-photo cards, Daily/Weekly/Monthly Planner lists,
  a To Do list, an "a new era of me" banner, a Monthly overview calendar,
  My Goals/Morning Routine/Evening Routine checklists, a Daily Quote, a
  Daily steps tracker, and Affirmations), then the whole tab — Overview
  plus the pre-existing This Week/Templates/Equipment/Timer/History/
  Progress/Compare sections — was re-themed to match Dream Board's exact
  engine/aesthetic. Per an explicit instruction, nothing already in this
  tab was deleted: every routine, the weekly schedule, logs, equipment,
  timer presets, workout history, and the progress/compare charts are
  completely unchanged in behavior, just visually recolored along with
  everything else.
  - **Overview board**: a freeform, drag-and-drop 3-column widget board
    (`.gw-*` classes, new), ported deliberately from Dream Board's own
    widget engine (`dreamboard.html`/`dreamboard-data.js`) rather than
    reinvented — same widget-card chassis (frosted glass, numbered index,
    a hover-reveal drag handle/delete), same `wireInlineEdit`/`autosize`
    helpers, same nine widget types (checklist/list/note/quote/
    affirmation/steps/photos/calendar/infocard — `feature` and per-widget
    color-grading tint were deliberately left out, a scope cut since this
    board has one implicit board, not several tabs, and Photo Grid is
    image-only, no video slot, to keep this addition focused). Reorder is
    real drag-and-drop via SortableJS (already a dependency in this app
    via Dream Board/Business Hub/AI & Tech/Nutrition — same CDN version,
    no new dependency added), every widget's title/items/note/quote/
    steps-goal/calendar-day-notes are inline-editable, and the board
    itself is fully adjustable via "+ Add Widget" (a menu of all nine
    types) and "Reset to Default." A small editable banner
    (`.gw-banner`, `state.boardBanner`, default "A New Era of Me") sits
    above the board, echoing the reference photo's own horizontal title
    banner.
  - **Data model, deliberately simpler than Dream Board's**: this tab has
    no multiple-"tabs"-within-a-tab concept of its own, so there's no
    `Tabs` collection or per-tab hero — just one flat array,
    `state.boardWidgets` (`{id, column, order, type, title, data}`),
    plus `state.boardBanner` and a one-time `state.boardSeeded` guard,
    all added directly to this file's existing `po_coach_v1` state
    object (`normalize()`'s fresh-install branch and its common
    post-processing lines both extended, same "purely additive, safe
    defaults via `normalize()`" precedent this file's own equipment/
    timerSettings/bannerPhoto additions already established). Because
    the whole `state` object is already synced as one JSONB blob (see
    this file's inline Supabase sync block, `APP_KEY='po-coach'`,
    `PC_SYNCED_KEYS=['po_coach_v1','po_coach_workout_done']`), no
    `sync.js` change and no new synced-key entry were needed — the board
    rides along automatically, the same way equipment/timer fields
    already do. Twelve seed widgets (`buildDefaultBoardWidgets()`) are
    distributed three-per-column across the three columns, fitness-
    themed rather than copied verbatim from the reference photo's
    generic Notion demo content (a judgment call, same precedent as
    every other page's seed content in this file's own changelog) — e.g.
    "My Goals" seeds bench/5K/protein/squat targets, "Daily Quote" seeds
    a training quote, "Navigation" lists this app's own real sections
    (This Week, Templates, Equipment, Timer, Workout History, Progress).
  - **Tab wiring**: `TAB_NAMES` gained `'overview'` as its first entry
    and new default (both the hash-routing fallback and the boot-time
    `switchTab(...)` call moved from `'week'` to `'overview'`) — This
    Week/Templates/Equipment/Timer keep their exact same `data-panel`
    values and are otherwise untouched; the day pill's existing
    "Tap to open This Week" behavior still explicitly opens the `week`
    tab, unaffected. `renderAll()` gained two new calls,
    `renderOverviewBanner()`/`renderOverviewBoard()`, so the board also
    refreshes correctly after an incoming remote sync (`pcRerender()`
    already calls `renderAll()`) — no separate sync-side change needed.
  - **Aesthetic — supersedes this file's crimson theme**, per an
    explicit request to copy Dream Board's exact style onto every page
    in this tab (see the updated §6 discrepancy note above): `--crimson`/
    `--crimson-bright`/`--crimson-text` keep their names (every existing
    rule that already referenced them — `.po-tab.active`, `.po-btn-
    primary`, `.po-reps-pill.active`, `.po-tw-done-btn`, `.po-modal-seg
    button.active`, `.equip-type-chip.active`, the timer-flash keyframe,
    etc. — cascades automatically) but now hold Dream Board's gold values
    instead of crimson ones, plus two new tokens (`--gold-hairline`/
    `--gold-tint`, mirroring Dream Board's `--db-hairline`/
    `--db-accent-tint`) and `--font-serif` (Cormorant Garamond, loaded
    the same Google Fonts `<link>` way Dream Board/Business Hub/AI &
    Tech/Nutrition/Self-Care already do). The handful of hardcoded
    crimson `rgba(178,58,77,…)` literals that weren't already routed
    through a variable (the body background glow, `.po-cover`'s
    gradient, the emblem rays, the section divider, `.po-btn-primary`'s
    border) were swept to their gold equivalents by hand — confirmed
    with a repo grep afterward that no crimson literal remains. `.card`
    and `.po-modal` were converted from a flat solid fill to real
    frosted glass (`rgba(255,255,255,0.06-0.08)` + `backdrop-filter:
    blur(20-24px) saturate(1.4-1.5)`, gold hairline border), matching
    Dream Board's `.dw-card`/`.modal` recipe, so every existing card and
    modal across This Week/Templates/Equipment/Timer/the Add/Edit
    modals/Settings picked up the new look automatically without their
    own markup changing. `.po-cover`'s title/emblem switched from a
    plain Georgia italic to `var(--font-serif)`, and its CTA button was
    re-graded from a solid crimson-outline pill to Dream Board's frosted-
    glass pill recipe. Left untouched, deliberately, same precedent as
    the original crimson re-theme: `--good`/`--warn`/`--bad` (still
    green/amber/red-coral — status meaning, not brand accent), the
    day-of-week tag palette (`--day-*`, unrelated pastel system), and
    the rest-day indicator's info-blue (`#7DD3FC`).
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP jomlmvslzsmmzgjnqvbm.supabase.co
    0.0.0.0"`, armed before navigation, per this file's established
    testing convention — this file's own inline sync block uses real,
    hardcoded Supabase credentials, so this was not optional, per
    [[feedback_block_supabase_before_browser_testing]]): a `--dump-dom`
    pass confirmed the Overview tab renders by default, all 12 seeded
    widgets render with the correct type-specific body (checklist boxes,
    the calendar grid showing the current month with today highlighted,
    the quote/steps/affirmation cards), the banner text populated
    correctly, and every other tab's `data-panel` content (This Week's 7
    day rows, Templates' routine `<option>`s, Equipment's gallery) is
    still present and unchanged; a stderr capture during that pass
    showed no JS errors; a duplicate-element-id scan found the same two
    pre-existing duplicates this file already had before this change
    (`cmpEmpty`, `oneRmUnit` — both pre-date this session, left alone,
    out of scope here) and no new ones. Full-page screenshots of both
    the Overview tab and the This Week tab confirmed the gold/near-black
    frosted-glass look renders correctly and matches Dream Board's
    aesthetic, with the pre-existing This Week grid, day-split chips,
    and settings/timer icons all still fully intact and legible.
    Interactive drag-and-drop reordering and the Add Widget/Photo/Day-
    note modals' click paths were not exercised this round — this
    environment's headless Edge could not be driven interactively via a
    live CDP session this pass (the same disclosed limitation several
    other pages' changelog entries in this file already note); a real
    click-through of those specific paths is recommended before relying
    on this feature heavily.

- **Fitness Studio (`gym.html`) follow-up: replaced the old compact
  `.po-cover` banner with a full-bleed cinematic hero ported line-for-
  line from Dream Board's own hero/page-backdrop, and restyled the tab
  row to Dream Board's individual pill-tab look** — per an explicit
  "match the exact aesthetic" follow-up, since the previous pass's small
  centered cover banner (sunburst emblem, ~340px tall) was the single
  biggest structural difference left from Dream Board's actual ~78vh
  full-bleed hero. This is a same-session supersession of this file's
  own hero markup (the sunburst-emblem `.po-cover*` CSS/HTML was deleted
  outright, not kept as dead code — the same precedent this file's own
  Timer modal→panel conversion already established), not a second
  parallel banner.
  - **New hero** (`.gh-hero`, `gh-` prefix to avoid colliding with
    anything else in this file): editable eyebrow/headline/subtext/CTA
    (the exact same `wireInlineEditGw`/`autosizeGw` helpers this file's
    Overview board already added, reused rather than duplicated), a
    click-to-upload cover photo with Change/Remove tools, and a Back
    button + "scroll to explore" flourish — structurally identical to
    Dream Board's `.db-hero`. **Deliberately narrower in one way**: image
    only, no video cover — this page has no session-video-blob
    infrastructure (the "re-attach after reload" flow a video cover
    needs), and adding it purely for aesthetic parity wasn't worth the
    scope. New state fields, `state.hero = {eyebrow, title, subtext,
    ctaLabel, photo}`, defaulted once in `normalize()` (guarded by
    `hero === null`, so a pre-existing user's own edits are never
    overwritten by a later normalize() run) and — like every other field
    on this object — automatically covered by this file's existing
    whole-object Supabase sync, no `sync.js`/key-list change needed.
  - **Page-wide blurred cover-photo backdrop** (`#ghPageBg`, same
    `blur(60px) saturate(1.35) brightness(0.55)` recipe as Dream Board's
    `#dbPageBg`) sits behind the entire page, not just the hero, so the
    Overview board's frosted-glass cards have something with color/
    texture to actually read as glass — same reasoning as Dream Board's
    own version.
  - **Tab row restyled**: `.po-tabs` went from a full-width segmented
    control (`flex:1` equal-width tabs, gold-gradient-filled active
    state) to Dream Board's `.db-tabs` look — individual pill buttons
    sized to their own content, a gold hairline border on every pill,
    and a `var(--gold-tint)` fill + gold border on the active one,
    sitting under a bottom hairline instead of its own bordered box.
    This Week/Templates/Equipment/Timer's `data-panel`/click wiring is
    completely unchanged, only the CSS moved.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP jomlmvslzsmmzgjnqvbm.supabase.co
    0.0.0.0"`, armed before navigation): a `--dump-dom` + stderr capture
    pass showed zero JS errors and no new duplicate DOM ids beyond the
    same two pre-existing ones already noted in the entry above; full-
    page screenshots confirmed the hero now visually matches Dream
    Board's structure and proportions (eyebrow, italic serif headline,
    subtext, frosted CTA pill, back button, scroll hint, empty-state
    "+ Add a cover photo") and the tab row renders as individual gold-
    outlined pills with Overview correctly active by default; the
    Overview board, This Week grid, and every other pre-existing section
    below the hero were confirmed still rendering with no content lost.

- **Fitness Studio (`gym.html`) rebuilt around Self-Care's own tab
  architecture, per an explicit request: "set it up just like the
  Self-Care Tab."** Main tabs are now exactly **Overview / Current Week
  / Templates / Equipment / Workout History & Compare Sessions** — Timer
  is no longer a top-level tab (folded into a modal instead, see below),
  and This Week was renamed and restructured. Every mapping the request
  named was built as a literal, structural port of that Self-Care page,
  not just a color match:
  - **Overview ↔ Self-Care's main "Self-Care" tab** — already matched
    from the prior pass (the Dream-Board-style freeform widget board);
    left as-is here, no changes needed.
  - **Current Week ↔ Self-Care's Anxiety page.** Anxiety's structure is
    a chip-row sub-tab switcher (Breathwork / Tips & Techniques) over a
    card grid; Current Week's new structure is the same mechanic scaled
    to 7 chips, one per weekday (`.gy-chip-row`/`.gy-chip`, Mon..Sun via
    the existing `WEEKDAY_ORDER`), each showing that day's exercises as
    a grid of cards styled exactly like Self-Care's `.brw-card`/
    `.tip-card` (new `.gy-card` recipe — frosted glass, serif title, tag
    chips, a description clamp, a two-button action row). This replaces
    two things outright, both same-session supersessions (not another
    pass's orphaned feature, so deleted rather than left as dead code):
    the old always-visible Mon-Sun list (`weekGridCard`/`renderWeekGrid()`)
    and the read-only Day View modal (`dayViewModalBg`/
    `openDayViewModal()`) — a day's exercises are now always on-screen as
    cards instead of behind a separate view action. The Day *Edit* modal
    (assign/reorder templates, label, clear to Rest) is unchanged and
    reachable via a new "✎ Edit day" button next to the day header.
    - **"Photos/videos, sets & reps, notes and descriptions" per
      workout** — this was already the exercise data model
      (`ex.media[]`, `ex.setsReps`/`sets`/`repMin`/`repMax`, `ex.notes`),
      just never exposed as a card face before. Each card's "✎ Edit"
      button opens the existing, completely unchanged exercise editor
      (`exModalBg`) — no new fields were added; this is the same modal
      Templates' routine editor already used.
    - **"▶ Log Set"** opens a new modal (`logSetModalBg`) that is the
      old always-inline "Log a set / Suggested next weight / Stats /
      Trend / Set history" panel, *relocated*, not rewritten — the exact
      same `renderForm()`/`renderRx()`/`renderStats()`/
      `renderSparkline()`/`renderHistory()` functions this file already
      had, called from `openLogSetModal(ex)` instead of running
      permanently inline. `state.currentRoutineId`/`state.currentEx`
      (this file's existing single-selected-exercise state) are now
      driven by which day chip is active and which card was tapped,
      instead of a `<select>` dropdown — the old `routineSelect`
      dropdown was removed entirely (its change handler deleted); the
      day's first assigned routine becomes `currentRoutineId`, matching
      this file's own pre-existing "single-session logging flow drives
      off the day's *first* template when more than one is assigned"
      simplification (`todaysRoutine()`'s existing comment), not a new
      limitation. `exSelect`/`noExMsg` stay in the DOM but hidden
      (`display:none`) purely so `renderSelect()`'s existing logic
      keeps working unchanged; "+ Add Exercise" (same `addExBtn` id)
      moved to a visible button below the card grid.
    - **Scope cut, disclosed**: the old rest-day "Log a workout anyway"
      override is gone — a rest day now shows a Self-Care-`.sc-empty`-
      style card ("Rest day — no workout scheduled") with just an
      "✎ Edit day" button, since the card-per-exercise model has nothing
      to show until a template is actually assigned. The done-checkbox
      on a card (`state.exerciseDone`, keyed by real date) only renders
      when the active day chip is today's actual weekday, since marking
      a future/past day's card "done today" isn't meaningful.
  - **Templates ↔ Self-Care's Meditations page.** Gained a search box, a
    dynamic category filter chip row (built from whatever `category`
    values already exist on `state.routines`) plus a "★ Favorites only"
    chip, and a `.gy-grid` gallery of `.gy-card`s (title, meta tags,
    day-of-week chips, View/Edit/Delete actions) replacing the old
    stacked `.rt-card` list. Routines gained one new field,
    `favorite` (boolean, defaulted via `normalizeRoutine()` — purely
    additive, safe for existing routines), toggled by a `.gy-fav-btn`
    star in each card's top-right corner exactly like Meditations'
    "instant toggle, no modal needed" star.
  - **Equipment ↔ Self-Care's Journals page.** Replaced the photo-
    gallery grid (`.ent-grid`/`.ent-card`) with a stacked list of
    `.gy-row`s (title + type on top, a notes preview clamped to 2
    lines, a meta/tag row) — a deliberate, literal reading of "just
    like the Journals page": equipment photos are still fully visible/
    editable inside the equipment modal (unchanged), just not shown as
    a row thumbnail, the same way a Journal row shows no image either.
    Clicking a row opens the existing, unchanged equipment editor;
    delete already lived inside that modal ("Delete this equipment"),
    so no inline delete button was needed on the row (matching how
    Journal rows have no inline delete either).
  - **Workout History & Compare Sessions** — the three cards that used
    to sit permanently below the tab system (per this file's own
    earlier changelog note, "deliberately left outside the tab
    system") now carry `data-panel="history"` and are a real tab like
    every other one. Pure wiring change — none of their rendering
    logic (`renderSessionHistory`/`renderProgressSection`/
    `renderCompareSection`) was touched.
  - **Timer dropped from the main tab row, converted back into a
    modal** (`timerModalBg`) — this file's own history already shows
    Timer moving modal→panel once before; this is the same mechanism
    moving panel→modal again in the same spirit, not a feature removal.
    `launchTimer()` now opens the modal instead of calling
    `switchTab('timer')`; the header clock icon does the same; a new
    "Close" button was added since an inline panel never needed one.
    No timer logic (countdown/stopwatch/interval tick math, presets,
    synthesized beep) was touched.
  - **`TAB_NAMES`** is now `['overview', 'week', 'templates',
    'equipment', 'history']`; the day pill's title changed from "Tap to
    open This Week" to "Tap to open Current Week" and its click handler
    now also resets `selectedWeekDayKey` to today before switching, so
    it always lands on today's card grid, matching its old "scroll to
    today's row" intent.
  - **Left as harmless dead code, not cleaned up this pass**: the CSS
    for the superseded `.exchk-*`/`.week-row*`/`.ent-grid`/`.ent-card`
    components, and two now-unused JS functions (`equipTypeIcon()`,
    `renderMediaGridReadonly()`) — none are reachable from any live code
    path, but removing them wasn't essential to this rebuild and was
    left for a future pass rather than risk unrelated edits under time
    pressure.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP jomlmvslzsmmzgjnqvbm.supabase.co
    0.0.0.0"`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]): a `--dump-dom`
    + stderr capture pass showed zero JS errors and no new duplicate
    DOM ids (one apparent "duplicate" — `weekEditDayBtn` — was confirmed
    to be a false positive: the id string appears once as a real DOM
    node and a second time only as JS *source text* inside the
    `<script>` block, not a second element). Screenshots of Current
    Week (`#week`), Templates (`#templates`), and Equipment
    (`#equipment`) confirmed: the day-chip row with "Tue • Today"
    active, a day header showing "Pull" + an "✎ Edit day" button, a
    "Pull-ups" exercise card with its sets/reps meta chip and "▶ Log
    Set"/"✎ Edit" actions rendering exactly like an Anxiety technique
    card; Templates' search/category-chips/"★ Favorites only" toolbar
    over a gallery of routine cards; and Equipment's search/type-chip
    toolbar with its (empty, for a fresh profile) list. Interactive
    clicks (opening the Log Set modal, tapping a day chip, toggling a
    favorite star) were not exercised this round — this environment's
    headless Edge still can't be driven interactively via a live CDP
    session (the same disclosed limitation several other pages'
    changelog entries in this file already note); a real click-through
    is recommended before relying on this rebuild heavily.

- **Fitness Studio (`gym.html`) bugfix follow-up, reported as "it won't
  let me click anything or see any of the info that was there."**
  Investigated with genuinely interactive testing this time (not just
  `--dump-dom` snapshots) — this environment's headless Edge, which
  couldn't be driven live via CDP for several prior entries in this
  file, DOES accept a `--remote-debugging-port`; a raw HTTP `/json/new`
  call against it can open a real target, though scripting it further
  over the websocket proved unreliable from PowerShell mid-session. The
  approach that actually worked: three throwaway scratch copies of this
  file, each with an injected script that (a) pre-seeds `localStorage`
  with a realistic shape — either genuine pre-existing routine/equipment
  data predating this rebuild, or a truly fresh/never-used install, or a
  390px mobile viewport — and (b) programmatically fires real `.click()`
  calls through every tab, every day chip, every card's Log Set/Edit
  buttons, the favorite star, an equipment row, the timer icon, and the
  day pill, catching `window.onerror`/`unhandledrejection` and writing
  a pass/fail log into the page for `--dump-dom` to capture. All three
  scenarios passed clean — every click worked, zero JS errors, no
  horizontal overflow at mobile width — so the rebuild's own code was
  not silently crashing.
  - **What was actually wrong**: the previous entry made **Overview**
    (a generic, mostly-empty widget board) the default landing tab —
    on load, before clicking anything, a real user now saw an
    unfamiliar board instead of their actual routines/schedule, which
    reasonably reads as "my info is gone," and the giant `.gh-hero`
    (~78vh, per the earlier "match Dream Board's exact hero" request)
    pushes real content further below the fold on top of that. Fixed
    by changing the default landing tab back to **Current Week** —
    both `switchTab()`'s no-hash/invalid-hash fallback and the
    boot-time `switchTab(location.hash ? ... : 'week')` call, plus the
    static HTML's initial `active` classes on the tab button and panel
    (moved from Overview to Current Week, matching what `switchTab()`
    computes anyway, but avoiding a flash-of-wrong-tab before the
    script runs). Overview is still one click away, unchanged
    otherwise. Re-ran the same interactive click-through against this
    fix and confirmed a real exercise card (from seeded pre-existing
    data) is visible on load with zero clicks required, and every
    other previously-tested interaction still passes.
  - **Caveat, disclosed honestly**: this fixes the most likely and most
    directly-matching cause of the report, verified as a real
    improvement, not a guess dressed up as a fix — but it's possible
    the user was also looking at a browser-cached copy of the page from
    mid-deploy; a hard refresh is worth trying if anything still looks
    off after this update lands.
  - **Process note**: an earlier step in this investigation ran
    `taskkill /F /IM msedge.exe` to clear a leftover CDP-debugging Edge
    instance, without first confirming (the way earlier entries in this
    file describe doing, via `Win32_Process` command-line inspection)
    that it wasn't the user's own real browser window. It's unclear
    whether the user had Edge open at the time; worth being more
    careful about that check before doing this again.

- **Fitness Studio (`gym.html`) bugfix, round two — the default-tab fix
  above wasn't the actual problem.** Reported again as still broken;
  this time, rather than guessing a third time, the user was asked two
  quick clarifying questions (what happens on tap, and whether they're
  on the live deployed site or a local file). Answers: the page looks
  **mostly blank/empty from the start** — before tapping anything — and
  they're on the **live deployed site**, not a local copy. That
  pinpointed the real cause: `.gh-hero` (added two changelog entries
  ago, to "match Dream Board's exact hero") is `min-height: 78vh`
  (84vh on mobile) — on a phone, a hero that tall *is* almost the
  entire visible screen, and with no cover photo set it's mostly a
  dark gradient with small centered "+ Add a cover photo" text. That
  reads exactly as "the page is blank," regardless of which tab is
  selected underneath it — the previous fix (defaulting to Current Week
  instead of Overview) didn't help because the hero sits *above* every
  tab, not just Overview's.
  - **Fix**: `.gh-hero`'s `min-height` dropped from `78vh`/`84vh` to
    `clamp(220px, 34vh, 360px)` (`clamp(200px, 40vh, 320px)` on mobile)
    and its padding was trimmed to match — same visual recipe (cover
    photo, gradient scrim, gold eyebrow, serif title, subtext, frosted
    CTA pill) at a height that doesn't bury the tab bar and real
    workout data below the fold. This is a deliberate, disclosed
    divergence from Dream Board's own hero proportions: Dream Board is
    a vision-board landing page where the hero *is* most of the point;
    Fitness Studio is a data-heavy daily-use tool where a returning
    user needs to reach their real routines/schedule quickly, so the
    "exact aesthetic" instruction from two entries ago is honored in
    color/typography/component recipe, not in raw hero height.
  - **Verified**: a 390×844 mobile screenshot (matching a typical phone
    viewport) now shows the hero, the day pill, the page title, and the
    full tab bar (with "Current Week" active) all within roughly one
    screen's height — a dramatic change from the hero alone consuming
    nearly the whole viewport before. Re-ran the same headless
    dump-dom + stderr check used in every prior entry in this section —
    zero JS errors, confirming this was a pure CSS change with no
    functional side effects.

- **Fitness Studio (`gym.html`): hero size reverted back to the original
  ~78vh/84vh per an explicit request, and a stale-cache mitigation added
  after a report that the tab "won't let me click on any buttons or see
  any exercise info from earlier."** Two independent changes:
  - **Hero height**: `.gh-hero`'s `min-height` reverted from the
    `clamp(220px, 34vh, 360px)`/`clamp(200px, 40vh, 320px)` mobile-safe
    sizing (the entry immediately above) back to the original `78vh`/
    `84vh`, with padding restored to match — a straight revert of that
    entry's CSS, nothing else. This knowingly reintroduces the exact
    near-full-viewport hero that entry's own testing flagged as reading
    "blank" on a phone with no cover photo set; the user asked for the
    size back explicitly, so this is honored as instructed rather than
    second-guessed.
  - **Click/render investigation**: extensively tested for an actual JS
    bug via headless Edge (Supabase blocked at the network layer, per
    [[feedback_block_supabase_before_browser_testing]]) using an
    instrumented scratch copy with a `window.onerror`/
    `unhandledrejection` capture and a post-load DOM inspection —
    against both a fresh/empty profile and a seeded **realistic legacy
    `po_coach_v1` shape** (routines/schedule/logs/currentRoutineId/
    currentEx, deliberately missing every field added by the recent
    Overview-board/hero/favorite/tab-architecture rebuilds — exactly
    what a real pre-rebuild device would have). Both scenarios rendered
    correctly with zero JS errors: `normalize()`'s existing per-field
    backfills (`boardWidgets`/`boardSeeded`/`boardBanner`/`hero`/
    `routine.favorite`/the schedule-shape migration) all handled the
    missing-field case correctly, current week's exercise cards
    (`weekExGrid`) populated with the seeded routine's real exercises in
    both runs, and all 7 day chips / 5 tabs rendered. No reproducible
    code-level cause was found.
  - **Given that**, the most likely remaining explanation — and the same
    root cause this exact codebase has already hit and fixed twice
    before, for `business.html`'s own "still not showing up" reports
    (see its two changelog entries on the subject) — is browser/CDN
    caching of a stale document: this app has no build step and no
    server-side cache-control (no `vercel.json`, confirmed — see
    CLAUDE.md §1), so a previously-fetched, now-outdated copy of
    `gym.html` (e.g. from mid-deploy, before this file's own recent
    hotfixes landed) can keep being served with no signal to refetch.
    Added the same `<meta http-equiv="Cache-Control/Pragma/Expires">`
    "no-cache" tags `business.html` already carries. Disclosed honestly,
    same caveat as that precedent: a meta tag only influences how the
    *browser* re-requests the document on a later visit — it cannot
    reach back and instruct a CDN edge cache that already served a stale
    response before the tag was ever parsed, so this is a partial
    mitigation for a class of problem this app's own "no build step"
    design is inherently exposed to, not a guaranteed fix. A hard
    refresh (or clearing the site's cache) is worth trying if the issue
    persists after this update lands.
  - **Verified**: re-ran the same headless instrumented test (fresh
    profile, Supabase blocked) against the file with both changes
    applied — zero JS errors, all 5 tabs and 7 day chips present, the
    seeded exercise card still renders correctly under Current Week, and
    a 390×844 mobile screenshot confirms the hero is back to its larger
    original proportions with no layout breakage below it.

- **Fitness Studio (`gym.html`): the "won't let me click on anything / no
  exercise info from earlier" report was still happening after the cache
  mitigation above — turned out irrelevant, since the user opens this page
  via `file:///.../gym.html` directly (a local file, not the Vercel
  deploy), so there's no CDN/server cache in the picture at all. Root-
  caused correctly this time and fixed with real error resilience, not
  another guess.**
  - **Why the symptom fits an uncaught exception exactly**: `let state =
    loadState();` (which calls `normalize()` on whatever's actually in
    this device's real `po_coach_v1`) sits near the very top of this
    file's one big top-level IIFE — and essentially *every* button/tab/
    card click handler in this file is wired by a top-level
    `$('id').addEventListener(...)` call further down in the same
    script. In JavaScript, an uncaught throw during a script's
    synchronous top-level execution aborts everything after that line in
    the same scope — so if `loadState()` throws on this device's actual
    saved data (any shape `normalize()`'s existing per-field guards don't
    anticipate — this file has been through a *lot* of schema changes
    across its own changelog), literally none of the click handlers below
    it would ever get registered, and `renderAll()` (which paints the
    banner photo and the exercise cards) would never run either — while
    the static HTML/CSS (hero, tab bar, empty banner box) still renders
    fine, since that part needs no JS. That's "looks normal, nothing
    responds, no exercise info, no banner photo" exactly, with zero
    visible clue why, since nothing was ever shown on screen and nothing
    reached the console via a path this file was checking.
  - This was verified as the *specific* right shape of bug (not just a
    plausible-sounding theory) by deliberately seeding a corrupted
    `po_coach_v1` (a `null` entry inside `boardWidgets`, which
    `normalizeBoardWidget()` would throw on trying to read `w.id` off)
    into a scratch copy and confirming: before this fix, the page loaded
    with a normal-looking hero/tabs/empty banner and zero interactivity
    or exercise data — the exact reported symptom, reproduced on demand.
    Extensive earlier testing (a fresh profile, and a hand-built
    "realistic legacy" `po_coach_v1` predating every recent field) had
    found no error, which is consistent with this: it takes a *specific*
    kind of real-world data shape to trip it, not just "any old data,"
    so those clean runs didn't rule this bug class out.
  - **Fix, in two parts**:
    1. `showBootErrorBanner(err, context)` (new) — renders a fixed,
       high-contrast banner across the top of the page with the actual
       error message + stack and a "Copy error details" button, instead
       of the page silently doing nothing. Purely diagnostic — it never
       touches `localStorage`, so real data can't be put at further risk
       by showing it.
    2. `let state = loadState();` is now wrapped in try/catch — on
       failure it shows the banner and `return`s out of the whole IIFE
       immediately, deliberately *not* falling back to a fresh default
       state and continuing, since that would let the app run normally
       right up until the next `saveState()` call (e.g. checking off a
       set) silently overwrote the real, still-intact `po_coach_v1` with
       a blank slate — turning a recoverable "won't load" into actual
       data loss. Failing loud and inert, with real data untouched and
       the exact error visible, was judged the safer trade.
    3. `renderAll()`'s body was split into individually try/catch-wrapped
       calls via a new `safeRender(fn, label)` helper, so a throw in any
       *one* sub-render (e.g. the overview board) can no longer prevent
       the others (e.g. the exercise cards, or the banner) from
       rendering — every render call in `renderAll()` now runs
       independently and reports its own label if it fails, instead of
       the whole pass silently stopping at the first failure the way it
       always has (this wasn't specific to the recent rebuilds — it was
       true of `renderAll()` since it was first written, just never
       triggered visibly until now).
  - **Deliberately not attempted**: guessing at and patching whatever the
    *actual* malformed field in the real `po_coach_v1` turns out to be —
    without the real error text (which this fix now surfaces), further
    edits to `normalize()` would be another blind guess, the same mistake
    as the cache-mitigation entry above. The next step is reading back
    whatever the banner's "Copy error details" button produces.
  - **Verified** via a headless Edge pass with a corrupted `po_coach_v1`
    seeded in (Supabase blocked, per
    [[feedback_block_supabase_before_browser_testing]]): confirmed the
    banner text renders on screen, confirmed `window.onerror` recorded
    zero *uncaught* errors (the throw is now caught internally, as
    intended, rather than propagating), and re-ran the existing fresh-
    profile and realistic-legacy-data test cases from the two entries
    above to confirm zero regressions — both still render all 5 tabs, 7
    day chips, and the seeded exercise card with no banner shown (since
    nothing failed for them).

- **The actual root cause, found via the new error banner above**: the
  user hit it for real on their own actual saved data and copied the
  exact error — `ReferenceError: Cannot access 'BOARD_WIDGET_TYPES'
  before initialization`, thrown from `normalizeBoardWidget()`, called
  from `normalize()`, called from `loadState()` at boot. **Fixed for
  real this time, not another guess.**
  - **Cause**: `const BOARD_WIDGET_TYPES`/`BOARD_WIDGET_TYPE_LABELS`/
    `BOARD_MONTH_NAMES` were declared down in the "OVERVIEW BOARD"
    section, physically *after* `loadState()`/`normalize()` in the file
    — but `normalize()` runs at boot, near the *top* of this script's
    execution, well before the script's execution pointer ever reaches
    that later `const` declaration line. A `const`/`let` binding is in
    the "temporal dead zone" from the top of its scope until its own
    declaration line actually executes — reading it before that point
    throws a `ReferenceError`, even though the *function* that reads it
    (`normalizeBoardWidget`) is hoisted and callable earlier. This is
    exactly the class of bug the previous entry's new error-banner
    mechanism exists to catch — and it worked on the first real report,
    surfacing the precise error instead of another silent freeze.
  - This was a pre-existing bug in the Overview-board rebuild itself
    (see that changelog entry higher up) — it just happened to never
    fire during that work's own testing, because every seed/test
    scenario used there already had `boardSeeded: true` in a shape that
    didn't specifically exercise this exact code path the same way the
    user's real saved data did. It was *not* introduced or worsened by
    either of the two preceding fix attempts in this section.
  - **Fix**: moved all three `const` declarations up to the very top of
    this script's IIFE, alongside `WEEKDAY_KEYS`/`WEEKDAY_LABELS`/
    `WEEKDAY_ORDER` — well before `loadState()` is ever called — and
    removed the old, now-duplicate declarations from their original
    spot (leaving a comment pointing to the new location, since that
    section's own surrounding comments still describe the Overview
    board feature). No other identifier referenced inside `normalize()`/
    `normalizeRoutine()`/`normalizeExercise()`/`normalizeEquipment()`/
    `normalizeBoardWidget()` has this same ordering problem — checked
    each one specifically; `CONFIG` (also read during a fresh-install
    normalize()) is declared at the very top of the file, outside and
    before this script's IIFE entirely, so it was never at risk.
  - **Verified**: re-ran the same headless Edge test as the entry above
    (fresh profile, Supabase blocked) — zero JS errors, no error banner
    rendered, all 5 tabs/7 day chips/the seeded exercise card present.
    The error-banner mechanism from the previous entry stays in place
    as a permanent safety net for any *other* real-data shape this
    file's `normalize()` hasn't anticipated — this fix only addresses
    the one specific cause the user's own copied error identified.

- **Fitness Studio (`gym.html`) widened, per an explicit "everything
  feels too narrow on my screen" request.** `.po-shell` — the container
  for everything below the hero (day pill, banner, tab bar, and every
  tab panel: This Week's exercise grid, Templates' gallery, Equipment,
  History) — was capped at `max-width: min(720px, 100vw)`, noticeably
  narrower than this page's own sibling pages it's otherwise been
  rebuilt to match: `dreamboard.html`/`business.html`/`selfcare.html`
  all use `max-width: 1100px` for their equivalent `.shell` container.
  Widened `.po-shell` to the same `min(1100px, 100vw)` for consistency
  with that established precedent rather than picking a new number.
  No other change was needed — `.gw-board` (the Overview widget board)
  and `.gy-grid` (the Current Week/Templates card grids) were already
  responsive (`repeat(3, minmax(0,1fr))` and `repeat(auto-fill,
  minmax(240px,1fr))` respectively), so they automatically use the
  extra width — wider cards / more columns per row — with no CSS of
  their own to touch.
  - **Verified**: a 1600×1000 desktop headless Edge screenshot (Supabase
    blocked, per [[feedback_block_supabase_before_browser_testing]])
    confirmed the visual result, and a computed-style check confirmed
    `.po-shell`'s real rendered width is now `1100px` (up from `720px`)
    with `#weekExGrid` correspondingly wider — zero JS errors, no
    regressions to the fix from the two entries directly above.

- **New page: `learning.html` ("Learning & Knowledge Hub"), built to match
  Dream Board/Business Hub/AI & Tech's dark cinematic near-black/gold,
  frosted-glass-card aesthetic — a large gallery database of research
  Topics on top, and a Resources database "filtered/structured by" five
  content types underneath, tied to a topic via a nullable foreign key.**
  Genuinely new files, `learning.html` + `learning-data.js` — modeled
  directly on `aitech.html`/`aitech-data.js`'s own Models/Prompts split
  (the closest existing precedent for "two genuinely separate databases,
  one linked to the other via a nullable id, already styled to match Dream
  Board"), not built from scratch. New nav pill (`LEARNING` →
  `learning.html`, appended after `AI & TECH` in `topbar.js`'s injected
  pill list — the only edit made to `topbar.js`, same one-line-addition
  precedent every prior page addition followed); new sync key (`appKey:
  'learning'`, `syncedPrefixes: ['learning:']`, wired via the standard
  shared `initCloudSync` — same call pattern as every other page, nothing
  new invented).
  - **Topics** (`learning:topics`) — the top database, a deliberately
    **large** gallery view per the request (`.lh-topic-grid`,
    `repeat(auto-fill, minmax(300px, 1fr))` with a 16:9 cover and 22px
    serif title — noticeably bigger than `aitech.html`'s own 240px/16:10
    Model gallery cards, since "large gallery view" was an explicit
    instruction here, not just a stylistic match). Each topic has a cover
    photo (upload or paste URL, compressed via this app's standard
    canvas-downscale recipe) or an emoji-icon fallback on a gold gradient
    tile, a title, a description, and freeform tag chips — full CRUD via
    an Add/Edit modal, drag-reorderable (SortableJS, same CDN dependency
    already used by Dream Board/Business Hub/AI & Tech/Nutrition), and
    searchable by title. Seeded with the eleven topics named in the
    request (Human Psychology & Neuroscience, Wealth Accumulation &
    Entrepreneurship, Holistic Health & Alternative Healing, Persuasive
    Communication & Writing, Astrology & Numerology, History,
    Self-Development, Metaphysics & Quantum Physics, Spiritual Practices &
    Esotericism, AI, Photography & Videography), each with an emoji icon,
    a short description, and 1-2 tags — a starting point, not a fixed
    list: "+ Add Topic" and per-card ✎/× actions make the set fully
    editable/adjustable/extensible, per the request.
  - **Resources** (`learning:resources`) — the bottom database, tied to a
    topic via a nullable `topicId` (deleting a topic nulls out the
    reference on its resources rather than deleting them, the same
    null-out-the-reference precedent `aitech-data.js`'s model deletion,
    `household-data.js`'s legion deletion, and `business-data.js`'s
    week/day deletion already established). This is the literal
    "filtered/structured by" mechanism the request asked for: each
    resource has a `type` — `article`/`book`/`video`/`social`/`note` — and
    whenever the type-filter chip row is at its default "All Types," the
    section renders as five always-visible, independently-empty-stated
    subsections (Articles / Books / YouTube Videos / Social Media Posts /
    Additional Notes), each its own card grid with its own SortableJS
    instance — structured by type, not just filterable by it. A topic chip
    row (All Topics / one per topic / an "Unlinked" catch-all, same
    pattern as `aitech.html`'s Prompt-model chips) narrows every
    subsection to one topic at a time; a search box matches title, author,
    and notes. Clicking a Topic card's "N resources →" link jumps straight
    to the Resources section pre-filtered to that topic, the same
    click-through-to-the-filtered-other-database precedent
    `aitech.html`'s "N prompts →" link and `business.html`'s Workflow-day
    "→ Tasks" link already established.
  - **Per-type fields, since a book and a social post don't need the same
    shape**: every resource has title/URL/notes; Author is hidden for
    Additional Notes (a bare note doesn't have one) and relabeled per type
    in the Add/Edit modal ("Channel / Creator" for videos, "Poster" for
    social posts, "Author" otherwise); a Transcript field only appears for
    the YouTube Video type — the concrete answer to "YouTube Videos with
    transcripts" — shown on the card as a monospace, clamped block with a
    Show more/less toggle (same pattern as `aitech.html`'s prompt-body
    clamp) plus a dedicated "📋 Copy Transcript" button so a transcript is
    actually copy-ready, not just stored. An "Open ↗" link is disabled
    (`aria-disabled`) whenever the URL doesn't pass this app's standard
    `isValidMediaUrl()` http(s)-only check, same guard every other
    link/cover field in this app already uses.
  - **Seed data** covers all eleven topics with at least one resource and
    spreads all five resource types across several different topics (e.g.
    Self-Development gets one of each type; AI gets an article, a video
    with a sample transcript, and a note; Human Psychology & Neuroscience
    gets a book and an article), so a fresh install demonstrates the full
    "structured by type, filtered by topic" shape immediately rather than
    landing empty. Guarded by the same empty-storage seed-race-safety
    window as `aitech.html`/`dreamboard.html`/`business.html`
    (`maybeSeedAfterSyncAttempt()`, deferred until either real cloud data
    arrives via `onApplied` or a 5-second window elapses) — seeding
    synchronously before the cloud pull has a real chance to answer could
    push a freshly-seeded "default" board to Supabase and clobber another
    device's real data.
  - **Palette**: this file's own `--lh-*` tokens are a direct copy of
    `business.html`'s gold values (`--bh-bg`/`--bh-gold`/etc.), not
    `aitech.html`'s teal — per CLAUDE.md §6, AI & Tech's teal was itself a
    one-off exception matched to *that page's own* separate reference
    photo, whereas the near-black/champagne-gold look is the actual common
    thread across Dream Board/Business Hub/Nutrition/Self-Care/Gym, so
    that's the one this new page matches to satisfy "match the aesthetic
    of everything to all of the other tabs." No other page's tokens were
    touched (DO NOT MODIFY §2).
  - **Verified via headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP *.supabase.co 0.0.0.0"`, armed before
    navigation, per [[feedback_block_supabase_before_browser_testing]]):
    a `--dump-dom` pass confirmed all 11 seeded topics render with correct
    titles/icons/tags/resource counts, all 5 resource-type subsections
    render with the correct seeded counts (5/4/3/2/5), and no duplicate
    DOM ids exist anywhere on the page (including the newly-injected
    `topbarLearning` nav pill). Full-page screenshots at both a
    topics-only scroll position and a full-page height confirmed the
    visual result matches Dream Board/Business Hub/AI & Tech's aesthetic
    exactly (frosted-glass numbered cards, serif titles, gold hairline
    borders, the sync-status indicator correctly reading "Synced"), and
    separately confirmed the YouTube Videos group's transcript clamp/
    "Show more"/"Copy Transcript" affordances and the Social Media
    Posts/Additional Notes groups all render correctly. Interactive clicks
    (opening the Add Topic/Add Resource modals, dragging a card, toggling
    a filter chip) were not exercised this round — this environment's
    headless Edge still can't reliably be driven interactively via a live
    CDP session (the same disclosed limitation several other pages'
    changelog entries in this file already note); a real click-through is
    recommended before relying on this page heavily.

- **Learning & Knowledge Hub (`learning.html`) follow-up: a bigger hero
  cover photo matching Dream Board exactly, and a "page" of generated,
  editable, reorderable text/link sections on every Resource.** Two
  changes requested together.
  - **Hero size**: `.lh-hero` was copied from `aitech.html`'s single-row,
    fixed-height recipe (`min-height: 340px`) when this page was first
    built — per an explicit "make the cover photo bigger like in the Dream
    Board Tab" ask, it's now a byte-for-byte match of `dreamboard.html`'s
    actual hero recipe instead: `min-height: 78vh` (`84vh` under a new
    `max-width: 620px` media query, matching Dream Board's own mobile
    breakpoint), `flex-direction: column; justify-content: flex-end`,
    `padding: 90px 20px 46px` (`84px 16px 34px` on mobile). No other hero
    behavior changed — same editable eyebrow/title/subtext/CTA, same
    upload-or-remove cover photo flow.
  - **Resource "page"** — the concrete answer to "a big section... so I
    can insert texts and links... paste the entire book... another
    section dedicated for links and notes and favorite parts," applied
    uniformly to every resource, of every type (article/book/video/
    social/note), not built differently per type. Modeled directly on
    `business.html`'s Platform Detail page (`addPlatformSection()`/
    `updatePlatformSection()`/`removePlatformSection()`/
    `movePlatformSection()`/`sectionsForWidget()`) — the same
    "generated on demand, editable, reorderable" pattern, ported to a
    Resource record instead of a Widget's `data` sub-object:
    - `learning-data.js`: `Resource` gained an inline `sections: []`
      array (`{id, title, body, order, createdAt}`, purely additive —
      pre-existing resources default to `[]` via `resourceModel()`, no
      migration needed) plus `sectionsForResource()`/
      `addResourceSection()`/`updateResourceSection()`/
      `removeResourceSection()`/`moveResourceSection()`. No separate
      collection — deleting a resource deletes its sections with it,
      same as Platform sections deleting with their widget.
    - `learning.html`: every resource card gained a "📄 Open Page" button
      (next to the existing "Open ↗" link) opening a new, wider modal
      (`#lhResourceDetailModalBg`, `.modal.lh-modal-wide` — same
      `max-width: 620px` widen-the-modal precedent as `business.html`'s
      `.bh-modal-wide`) showing the resource's title/type/topic and its
      section list, each section an editable title input + an
      autosizing textarea body (both autosave on blur) with ▲▼ reorder
      and a delete ✕ — plus a "+ Generate Section" button for adding
      more, and a card-face hint ("N sections") once any exist.
    - **The first time a resource's page is opened with zero sections**,
      two starting sections are auto-created — "Full Text / Content" and
      "Links, Notes & Favorite Parts" — giving every resource (seeded or
      newly added) the same starting structure the request asked for
      out of the box, while staying fully renameable/deletable/
      addable afterward (this is a UI-level lazy-create on first open,
      not a data migration, so it applies uniformly going forward
      without touching `seedDefaultData()` or any already-stored
      resource until its page is actually opened).
  - **Verified via headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP *.supabase.co 0.0.0.0"`, armed before
    navigation, per [[feedback_block_supabase_before_browser_testing]]):
    a full-page screenshot confirmed the hero now matches Dream Board's
    proportions; a scripted click-through (using a temporary scratch copy
    of the file kept alongside its sibling `learning-data.js`/`sync.js`/
    `topbar.js` so they'd actually resolve, deleted afterward) against a
    fresh, never-synced profile confirmed all 38 "Open Page" buttons
    render, clicking one opens the modal, and the two default sections
    ("Full Text / Content", "Links, Notes & Favorite Parts") are created
    correctly on first open — a screenshot of the open modal confirmed
    the visual result matches Business Hub's Platform Detail page
    aesthetic. One test-methodology note worth remembering for future
    sessions in this environment: a scratch copy must either stay in the
    real project directory (so its relative `<script src="...">` sibling
    files resolve) or have those siblings copied alongside it — copying
    just the one HTML file into a separate temp directory silently
    breaks it (`window.LearningData` stays `undefined`, `init()` bails
    immediately), which read at first as a mysterious "0 buttons found"
    result rather than the file-resolution problem it actually was.

- **Learning & Knowledge Hub (`learning.html`) bugfix: touch scrolling on
  the Topics/Resources card grids was accidentally reordering cards.**
  Reported as "I accidentally keep moving them when I scroll on my
  phone." Root cause: both `Sortable(...)` instances (the Topics gallery
  and every per-type Resources grid) were configured with only `handle:
  '.lh-drag-handle'` and no touch-specific tuning — on a touchscreen,
  SortableJS can start tracking a drag the instant a touch lands on the
  handle and moves at all, with no distinction between "the user meant to
  drag this card" and "the user's thumb happened to land on the handle
  while starting an ordinary scroll swipe" (the ⋮⋮ handle sits in the
  card's top corner, exactly where a scrolling thumb often lands first).
  Purely additive — no feature, button, or drag capability was removed;
  cards are still fully reorderable by drag, just no longer by accident.
  - **`delay: 150, delayOnTouchOnly: true, touchStartThreshold: 6`** added
    to both `Sortable(...)` calls (`wireTopicSortable()`'s
    `$('lhTopicGrid')` instance and `renderResources()`'s per-type-group
    `.lh-resource-grid` instances) — SortableJS's own documented mechanism
    for exactly this ambiguity: on touch input only (`delayOnTouchOnly`,
    so mouse/desktop drag is unaffected and still starts immediately), a
    touch on the handle must be held for 150ms without moving more than 6
    logical pixels before it's treated as a drag; a quick scroll swipe
    starting on the handle is recognized as a scroll and cancels the
    pending drag instead of hijacking it.
  - **`.lh-card` gained `touch-action: pan-y`** (previously unset, so it
    fell back to the browser default of `auto`, which is supposed to
    allow normal scrolling but leaves more room for a touch-and-drag
    library to contest the gesture) — explicitly tells the browser "a
    touch anywhere on this card should be treated as a vertical scroll
    gesture," reinforcing the delay fix above rather than replacing it.
    **`.lh-drag-handle` gained `touch-action: none`** — the handle
    itself is the one place a touch is allowed to be claimed for
    dragging instead of scrolling, matching `handle: '.lh-drag-handle'`
    already restricting where a drag can be picked up from.
  - **`.modal` gained `-webkit-overflow-scrolling: touch` and
    `overscroll-behavior: contain`** — addresses the second half of the
    report ("make it easier to scroll down each page," referring to a
    Resource's own detail "page"/modal, per this app's established
    vocabulary for these generated-section modals): the first is the
    standard iOS Safari flag for smooth momentum/inertial scrolling
    inside a fixed-height `overflow-y: auto` container (already present
    on modern engines by default in most cases, but explicit here for
    older WebKit); the second stops a scroll that reaches the top/bottom
    of the modal's content from "leaking" through to scroll the page
    underneath it, which otherwise reads as the page jerking/jumping
    once the modal's own scroll runs out — a source of exactly the kind
    of "things move when I'm just trying to scroll" feeling being
    reported, even though nothing there was drag-related.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP *.supabase.co 0.0.0.0"`, armed before
    navigation, per [[feedback_block_supabase_before_browser_testing]]):
    confirmed zero JS errors after the change (a scratch copy kept in
    the real project directory so `learning-data.js`/`sync.js`/
    `topbar.js` resolve, per the file-resolution lesson from the entry
    above, deleted after testing), confirmed all 30 cards (11 seeded
    topics + 19 seeded resources) and their drag handles still render
    correctly with the new Sortable options accepted without throwing,
    and confirmed a 390×844 mobile-viewport screenshot shows no layout
    regression. Actual touch-drag timing (does a 150ms-held press still
    pick a card up, does a quick swipe now correctly scroll instead)
    could not be exercised directly — this environment's headless Edge
    has no way to simulate a real multi-touch gesture with hold-then-move
    timing, only synthetic `MouseEvent`/`click()` calls — so this fix
    rests on SortableJS's own documented behavior for these options
    (widely used elsewhere for exactly this complaint) rather than a
    reproduced-and-fixed touch trace; a real phone test is the only way
    to fully confirm the feel of it.

- **Bugfix: the Writing Dashboard (Business Hub) was invisible on a live
  device because the whole feature had only ever been merged into
  `feat/writing-dashboard`, never into `main`** — the branch this
  deployment actually serves. Fixed by fast-forward merging
  `feat/writing-dashboard` into `main` and pushing (a clean fast-forward,
  no conflicts, since `main` was a strict ancestor). Separately,
  `business.html`'s `init()` and its cloud-sync `onApplied` callback
  gained a `showBootErrorBanner()` safety net (a fixed, high-contrast
  banner with a "Copy error details" button) around their bodies, matching
  the precedent `gym.html` already established for this exact failure
  class (a silent boot-time throw leaves the page looking blank with zero
  visible clue why) — `business-data.js`/`writing-data.js` cache-busting
  query strings were also bumped (`?v=10`/`?v=2`) per this app's own
  established mitigation for stale-cached-copy reports.

- **New shared file: `photo-store.js` — photos now upload to a Supabase
  Storage bucket instead of living as base64 strings inside
  `localStorage`, fixing a real, reproduced "browser storage is full"
  failure.** Root cause, chased down from a user report that a newly
  merged feature's tab wasn't appearing (see the bugfix entry above) even
  after that was fixed: every page in this app shares one `localStorage`
  origin (the same mechanism `index.html`'s "Connected Apps" tile already
  depends on), which has a hard ~5MB browser-imposed ceiling — confirmed
  live at **4.98 MB used**, with hero/widget/gallery/equipment photos
  (stored as base64 `data:` strings, per this file's own established
  `compressImageDataUrl()` convention) accounting for nearly all of it
  (`po_coach_v1` alone: 1.15MB). Because every localStorage write already
  goes through a `try/catch` that silently swallows a quota-exceeded
  error (`storeSet()`'s original design, so a full disk never throws a
  visible JS error), the actual symptom was invisible until traced: typing
  a new Writing Dashboard chapter, a Learning entry, or anything else
  that grows a page's JSON blob just silently failed to persist and
  reverted on reload. Deleting ~30KB of already-orphaned keys (dead
  features — Projects, Study, the old top-level Anxiety keys, etc.) was
  nowhere near enough, since the user was sitting almost exactly at the
  ceiling.
  - **Decision made with the user before building this** (via a `/plan`
    pass, since this touches nearly every page in the repo): keep photos
    syncing across devices (don't let them silently go device-local-only),
    and apply the fix to every page that stores photos in one pass, not
    just the biggest offenders.
  - **The actual fix is simpler than "move to IndexedDB," which was the
    original framing** — research turned up that `sync.js` already syncs
    whatever string value sits in a field, with no idea whether it's a
    `data:` URL or a plain `https://` URL (several pages already have a
    "paste an image URL instead of uploading" alternative for the exact
    same fields, and those already sync/render completely normally
    today). So: compress the image exactly as before, then upload the
    compressed bytes to a new Supabase Storage bucket
    (`dashboard-photos`), and store the resulting ~100-byte public URL in
    the *exact same field* that used to hold the giant base64 string.
    This needed **zero changes to any render/read code anywhere** (a URL
    renders identically to a `data:` string in an `<img src>`), rides the
    **existing** `sync.js` mechanism completely unchanged (no second sync
    path, no IndexedDB, no new async rendering, nothing added to
    `onApplied` — DO NOT MODIFY's sync-plumbing rule is honored by being
    fully separate from it, not by touching it), and is fully
    backward-compatible (an old, not-yet-migrated base64 value keeps
    rendering exactly as it does today until it's naturally replaced).
  - **`photo-store.js`** (new file, plain `<script defer>` IIFE matching
    `sync.js`'s own style, added to the 10 pages that actually store
    photos — `finance.html`, `business.html`, `dreamboard.html`,
    `nutrition.html`, `selfcare.html`, `entertainment.html`, `gym.html`,
    `aitech.html`, `learning.html`, `household.html`; `index.html` and
    `braindump.html` have no photo fields and were left untouched):
    reuses the identical hardcoded `SUPABASE_URL`/`SUPABASE_KEY` values
    already duplicated in `sync.js`/`topbar.js`/`gym.html` — a 4th copy,
    consistent with this app's own explicit precedent for these two
    constants (DO NOT MODIFY: "don't let a rebuild introduce a fourth,
    *different* copy" — the values match, which they do). Exposes one
    function, `PhotoStore.upload(dataUrlOrBlob, onUploaded)` — fire-and-
    forget (also returns a Promise, resolving to the URL or `null`, used
    only by the backfill below to know when a batch has settled), converts
    a base64 `data:` URL into a `Blob` (or accepts a raw Blob/File
    directly, for `gym.html`'s one uncompressed-video call site), uploads
    it to the `dashboard-photos` bucket under a random path, and calls
    `onUploaded(publicUrl)` on confirmed success. Any failure (offline,
    the bucket not created yet, a network error) is completely silent,
    matching `sync.js`'s own `pushNow()`/`flushOnUnload()` failure
    tolerance — the caller's already-saved local base64 value is simply
    left as-is if this never calls back, so nothing regresses if upload
    can't happen.
  - **Prerequisite the user must do directly in their Supabase project —
    not something this session could do from here**: per DO NOT MODIFY
    (RLS/Storage policy SQL must come from the live project or be handed
    to the user to run themselves, never invented from memory), a Storage
    bucket named `dashboard-photos` needs to be created (Storage → New
    bucket → toggle **Public bucket** on, so photos display via a plain
    public URL) plus three policies granting the `anon` role insert/
    update/delete on that bucket (a public bucket only grants public
    *read* by default). Until this exists, every `PhotoStore.upload(...)`
    call silently no-ops — by design, so shipping the code doesn't require
    sequencing around the bucket's creation.
  - **Every existing photo-upload call site** (~27 of them, inventoried
    directly: hero photos on 8 pages, widget/slot photos on 5 board-engine
    pages, gallery/model/topic/recipe covers, `gym.html`'s equipment/
    exercise-media/banner photos including its one raw-base64-video site)
    gained one additional line after its existing "save the compressed
    base64 locally" call — nothing about the existing line changed:
    ```js
    <existingSaveCall>(compressed);              // unchanged, instant, offline-safe
    PhotoStore.upload(compressed, function (url) { <existingSaveCall>(url); });
    ```
    Several call sites are drafts-in-a-modal (not yet committed to
    storage) rather than a live record — those re-patch the draft
    in-place if it's still open when the upload finishes (checked via
    reference/value equality against the original compressed string, so a
    since-changed or since-closed draft is never clobbered); if the draft
    was already saved as base64 by the time upload completes, the one-time
    backfill below catches it on a later load instead.
  - **One-time backfill, per page** (`migratePhotosToStorage()`, guarded
    by a `<prefix>:photosMigratedV1` flag, this app's own established
    one-time-migration convention — e.g. `finance:migrated_v2`,
    `media:migrated_v1`): walks that page's own already-stored records for
    any field still holding a raw `data:` string, uploads each, and
    replaces it with the hosted URL once done — this is the part that
    actually reclaims the ~5MB already sitting in localStorage today, since
    new uploads alone only stop it from growing further. Runs from a
    `setTimeout(migratePhotosToStorage, 3000)` in each page's boot
    sequence (non-blocking, doesn't delay first paint) and only sets its
    guard flag once every upload it kicked off has actually settled
    (`Promise.all(...)`) — a page that's offline or whose bucket isn't set
    up yet just tries again next load instead of marking itself "done"
    with nothing actually uploaded. `gym.html`'s version is the
    highest-payoff, since `po_coach_v1` was by far the single biggest
    contributor to the shared quota (banner photo, hero photo, Overview
    board slots, every equipment item's photo, and every exercise's
    reference media — image and video).
  - **Verification, disclosed honestly**: static checks only in this
    session (every call site's one-line addition grep-confirmed, the new
    `<script src="photo-store.js" defer>` tag confirmed present on exactly
    the 10 pages that need it, brace-balance re-confirmed on every edited
    file). This environment's headless-Edge automation cannot reliably
    drive a real file upload or a live Supabase Storage round-trip (a
    long-documented limitation elsewhere in this file's own history) — a
    real end-to-end check (upload a photo, confirm it shows on the other
    device, confirm the localStorage total actually drops) has to happen
    on the user's own devices, against their own newly-created bucket,
    using the same size-report console snippet the user already used to
    diagnose the original quota problem.

- **Tasks & Notes moved out of Business Hub into its own top-level page,
  `tasksnotes.html`.** Per an explicit request — it used to be a 5th
  Business Hub tab (`layout: 'tasksnotes'`, added in an earlier session:
  Links via the shared widget-board engine, a dedicated Notes database,
  and a filtered Tasks list). Removed from `business.html`/
  `business-data.js` wholesale (the `'tasksnotes'` layout value, the
  `bhTn*`-prefixed markup/modals/CSS, `DB.Notes`/`noteModel`/
  `notesForTab()`/`ensureTasksNotesTabExists()`/`seedTasksNotesContent()`,
  and the `business:notes` key) — `business.html`'s own tab count and
  layout list already only ever documented 4 tabs
  (Content/Ideas/Platforms/Resources) in this file's §1 table, so no
  further edit was needed there; `business-data.js`'s cache-bust query
  string was bumped to `?v=12` (this repo's established mitigation for
  the "still not showing up" stale-cache class of report this exact
  feature has already hit twice before — see the two `business.html`
  entries above on the subject).
  - **Genuinely new standalone page**, `tasksnotes.html` +
    `tasksnotes-data.js` — same conventions as `aitech.html`/
    `aitech-data.js` (the closest existing precedent: one page, no tabs,
    one editable hero, multiple genuinely separate flat collections, real
    frosted-glass `.tn-card` chassis, SortableJS drag-reorder, the same
    empty-storage seed-race-safety window before falling back to sample
    content). New nav pill (`TASKS & NOTES` → `tasksnotes.html`, appended
    after `LEARNING` in `topbar.js`'s injected pill list — the only edit
    made to `topbar.js`, same one-line-addition precedent every prior
    page addition followed); new sync key (`appKey: 'tasksnotes'`,
    `syncedPrefixes: ['tasksnotes:']`, wired via the standard shared
    `initCloudSync` — same call pattern as every other page, nothing new
    invented).
  - **Palette**: this file's own `--tn-*` tokens are a direct copy of
    `business.html`'s gold values (not AI & Tech's one-off teal
    exception), matching Business Hub/Dream Board's dark cinematic
    near-black/gold look — the page this feature came from — per CLAUDE.md
    §6/DO NOT MODIFY rule 2, same "match the common thread, not the
    one-off exception" call Learning Hub's own build already made for the
    same reason.
  - **Three genuinely separate "databases," carried over unchanged in
    shape** (same precedent as `business.html`'s Platform/Content
    Plan/Useful Resources split and `aitech-data.js`'s Models/Prompts
    split — never merged into one list): **Links** (`tasksnotes:links`)
    — a small drag-reorderable card grid, title/URL/description all
    inline-editable directly on the card (no separate modal — same
    "editable in place" interaction the old `link` widget type had);
    **Notes** (`tasksnotes:notes`) — a full searchable/taggable list
    (title/body/tags, search box, tag filter chips, an Add/Edit modal),
    distinct from a single freeform note widget elsewhere in this app;
    **Tasks** (`tasksnotes:tasks`) — the same status/priority/
    recurrence/Today-vs-All-view/quick-add/Task-Detail-with-autosaving-
    notes system as every other task list in this app (business.html's
    own former Resources-tab Tasks section, index.html's Main-dashboard
    Tasks tab), reimplemented as this page's own independent flat array
    rather than a shared collection, since this page has no relationship
    to Business Hub anymore. The old `workflowDayId` link field (which
    only ever made sense against Business Hub's own Workflow feature) was
    dropped — this page's Tasks are plain, unlinked tasks.
  - **Real user data preserved via a one-time migration**
    (`TasksNotesData.migrateFromBusinessHub()`), not silently orphaned —
    a device that already used the old Business Hub tab has real Links/
    Notes/Tasks sitting in `business.html`'s own localStorage keys
    (`business:widgets` type `'link'`, `business:notes`, `business:tasks`,
    all scoped via a `tabId` foreign key to the one tab titled "Tasks &
    Notes"). Reads those raw keys directly (the same "read another page's
    localStorage directly" precedent `index.html`'s Connected Apps tiles
    already use — `business-data.js` no longer exposes a Notes collection
    or recognizes the `'tasksnotes'` layout at all now that the tab was
    removed from that page's own UI) and copies matching records into
    this page's own collections once, guarded by a
    `tasksnotes:migratedFromBusinessHub` flag and by only ever writing
    when this page's own three collections are still empty — same "copy
    once, leave the old keys orphaned-but-untouched afterward" precedent
    `selfcare.html`'s `migrateLegacyAnxietyPage()` already established for
    the standalone-Anxiety-page → Self-Care-tab move. `business:notes`/
    the migrated `business:widgets`/`business:tasks` rows are left alone
    in place afterward, orphaned but untouched, same treatment as every
    other removed-feature key elsewhere in this app. Deliberately **not**
    deferred behind the empty-storage seed-race-safety window the way
    `seedIfEmpty()` is below it — this migration reads a different,
    already-local `business:` prefix that this page's own cloud sync
    never touches, so there's no remote-pull race to protect against;
    `seedIfEmpty()`'s generic sample Links/Notes/Tasks only ever run as a
    fallback once the migration has already had its chance and found
    nothing (a genuinely fresh install, or a device that never used the
    old tab).
  - **Verified in headless Edge** (`--host-resolver-rules` mapping the
    Supabase host to `0.0.0.0`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]): a fresh, never-
    used profile correctly falls through to the seeded sample content
    (2 links, 2 notes, the Today view correctly showing only the one
    seeded task with today's due date) with zero console errors; a
    separate pass pre-seeding realistic `business:tabs`/`business:widgets`/
    `business:notes`/`business:tasks` (a tab titled "Tasks & Notes" with
    one real link/note/task) and calling `migrateFromBusinessHub()`
    directly confirmed the real records land correctly in the new
    collections with their original ids/content intact, that a second
    call is a correct no-op (idempotent — doesn't duplicate), and that
    the old `business:notes` row is left completely untouched afterward.
    The topbar's new `TASKS & NOTES` pill and the page's own back-button
    (`href="business.html"`) were confirmed present; drag-and-drop
    reordering of Link cards and the Note/Task Add/Edit modals' full
    click-through were not exercised interactively this round — this
    environment's headless Edge still cannot reliably be driven via a
    live CDP session (the same disclosed limitation several other pages'
    changelog entries in this file already note); a real click-through is
    recommended before relying on this page heavily.

- **Business Hub (`business.html`/`business-data.js`): the leftover
  "Tasks & Notes" tab is now cleaned up once its data has safely landed
  on the new standalone page, and the Writing Dashboard's Text
  Section/Code Block/note-section textareas now show their entire text
  instead of a small fixed-height box.** Two follow-ups to the Tasks &
  Notes move above, landed together; nothing was deleted from the
  Writing Dashboard, per an explicit instruction.
  - **Legacy tab cleanup**: moving Tasks & Notes out to `tasksnotes.html`
    left a real gap — `normalizeStoredData()`'s existing layout-fallback
    loop only ever converts an unrecognized `layout` value to `'freeform'`
    (it has no concept of removing a tab outright, unlike the adjacent
    `REMOVED_TITLES` array, which already hard-deletes Analytics/
    Strategy/Audit), so any device that had already used the old tab kept
    seeing a "Tasks & Notes" pill in Business Hub forever, now just an
    empty-feeling plain freeform board instead of gone. Fixed with a new
    check in `normalizeStoredData()`: a tab titled "Tasks & Notes" is
    only removed (via the existing `removeTab()`, which already cascades
    to its Widgets/Tasks) once `tasksnotes:migratedFromBusinessHub` —
    `tasksnotes-data.js`'s own one-time migration flag — is confirmed
    `true`, i.e. this device has actually opened the new page at least
    once and copied its real Links/Notes/Tasks over first. Deliberately
    **not** unconditional like `REMOVED_TITLES`: doing this without the
    flag check would risk cascading away real, never-migrated widget/task
    data the instant someone reopened Business Hub before ever visiting
    the new page — the same "never delete before the data's confirmed to
    have a new home" caution as every seed-race-safety window elsewhere
    in this app. A device that hasn't visited `tasksnotes.html` yet
    simply keeps seeing the tab (as an ordinary freeform board) until it
    has. Verified directly (a standalone harness loading `business-data.js`
    and calling the now-public `normalizeStoredData()`): a seeded legacy
    tab with a real link widget and a real task survives completely
    untouched when the migration flag is unset; the same seed, with the
    flag set, correctly removes the tab and its widget/task while leaving
    every other tab and the unrelated `business:notes` key alone; and a
    profile with no legacy tab at all is a no-op.
  - **Writing Dashboard textareas now autosize**: the Task Detail
    modal's Text Section/Code Block bodies (`#wrTaskDetailBlocks
    .bh-pf-section-body`/`.bh-pf-section-code-body`) and the Manuscript
    Detail overlay's note-section bodies (`.wr-note-section-body`) were
    all fixed-height boxes (`min-height: 60–100px`) with only a manual
    drag-to-resize handle — reading a long block meant scrolling inside a
    cramped textarea. Both now use this file's existing `autosize(ta)`
    helper (already used elsewhere in this same file for the hero title,
    the landing-page article's paragraph/callout blocks, etc.) — an
    `input` listener grows the box live while typing, and each render
    function calls `autosize()` on every textarea via `setTimeout(...,
    0)` after appending (needs a tick since `scrollHeight` reads 0 on a
    still-hidden/just-inserted element, same precedent this file's own
    article-block/hero-title autosize calls already follow). The modal
    itself already scrolls (`.modal { max-height: 86vh; overflow-y:
    auto; }`), so a long block now reads top-to-bottom by scrolling the
    modal, not by scrolling inside the textarea.
  - **Scoped narrowly, not applied to the shared classes globally**:
    `.bh-pf-section-body`/`.bh-pf-section-code-body` are also used by
    Platform Detail (Content/Platforms tabs) and Workflow Day pages
    (Resources tab) — neither was named in the request, and both keep
    their original fixed-height/manual-resize CSS completely unchanged
    (`resize: vertical`, no `overflow: hidden`), since the new
    `resize: none; overflow: hidden` rule is scoped under the
    `#wrTaskDetailBlocks` container id specifically, not the bare class —
    same "scope narrowly under a container, don't touch the shared class"
    precedent `index.html`'s Habit Instructions field autosize fix
    already established. `.wr-note-section-body` needed no such scoping —
    it's already a Writing-Dashboard-exclusive class, used nowhere else.
    Verified via a fresh headless-Edge load (Supabase blocked) that the
    base `.bh-pf-section-body`/`-code-body` rules in the served CSS still
    read `resize: vertical` with the new override appearing only under
    the `#wrTaskDetailBlocks` selector, and that Platform Detail's own
    section-adding code path (`buildPlatformSectionCard`, line ~2633) and
    the Workflow Day block code path (line ~2905) are untouched.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules="MAP jomlmvslzsmmzgjnqvbm.supabase.co
    0.0.0.0"`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]): a fresh profile
    correctly seeds and renders all 5 tabs (Content/Ideas/Platforms/
    Resources/Writing Dashboard, no leftover Tasks & Notes pill, since a
    fresh install never had one) with zero JS console errors. Interactive
    verification of the autosize behavior itself (typing/opening a block
    with real long text and confirming the textarea visibly grows) was
    not exercised this round — this environment's headless Edge still
    cannot reliably be driven via a live CDP session for real keystroke/
    click interaction (the same disclosed limitation several other
    pages' changelog entries in this file already note); the mechanism
    itself (`autosize()` + `resize:none;overflow:hidden`) is the same one
    already proven working elsewhere in this exact file (the landing
    article's blocks, the hero title) and in `index.html`'s own Habit
    Instructions fix, so this is a wiring change onto an already-working
    mechanism, not a new one — still, a real click-through (open a task
    with a long block, confirm it renders in full without an internal
    scrollbar) is recommended before relying on this heavily.

- **Writing Dashboard's Tasks Inline Database: templates with sub-pages
  can now collapse/expand, and every page (template or sub-page) can be
  duplicated with its content fully intact.** Purely additive to
  `writing-data.js`/`business.html` — nothing was deleted, per an
  explicit instruction.
  - **Collapse/expand**: `WritingTask` gained an additive `collapsed`
    boolean field (default `false` — undefined on pre-existing tasks
    reads falsy the same way, so no backfill/migration was needed, unlike
    fields this app has needed to backfill before, e.g. `hasTemplates` —
    a plain truthy check tolerates `undefined` fine, only a strict
    `typeof`/enum check would have needed one). Only meaningful on a
    template (a root task, `parentTaskId: null`) that actually has
    sub-pages — `buildWrTaskRow()` now renders a ▼/▶ caret toggle button
    (reusing the existing `.wr-task-add-sub` small-button class, no new
    CSS) only for such rows, right before the existing up/down reorder
    arrows. Clicking it flips `collapsed` via `WD.Tasks.update(...)` and
    re-renders; `renderWrTaskTable()`'s existing loop (which already
    walked `WD.childTasks(t.id)` to append each sub-page row under its
    template) now skips that `forEach` entirely when `t.collapsed` is
    true — the sub-page rows simply aren't appended to the DOM while
    collapsed, matching this file's own "hide, don't destroy" convention
    for every other collapse feature in this app (Workflow Weeks,
    Self-Discovery groups).
  - **Duplicate**: a new `WD.duplicateWritingTask(taskId)`
    (`writing-data.js`) and a "⧉" button on every row (reusing the
    existing `.bh-task-open` button styling, next to the existing "📄
    Open" button) — for **a sub-page**, clones just that one task
    (title/summary/status/priority/dueDate/blocks) into a new sibling
    appended at the end of the same parent's children; for **a
    template**, also clones every one of its sub-pages under the new
    template (same "duplicating a parent brings its children along"
    precedent `business-data.js`'s own `duplicateWorkflowWeek()` already
    established for Workflow Weeks/Days). Every duplicated block gets a
    fresh id (`uid('blk')`) so it's never accidentally shared with the
    original. **Deliberately diverges from the Workflow duplicate
    precedent in one way, per this request's own explicit wording**:
    `duplicateWorkflowWeek()`/`duplicateWorkflowDay()` reset a day's
    status to "Not started" and uncheck its items, since those exist to
    reuse *structure* for a fresh sprint — here, "duplicate... with all
    of its content intact" means status/priority/due date/summary/blocks
    are all carried over completely unchanged, nothing reset. Only the
    directly-clicked page gets a " (Copy)" suffix on its title (matching
    `duplicateWorkflowWeek()`'s own top-level-only suffix convention) —
    a template's cascaded sub-pages keep their original titles, same as
    a duplicated week's real days keep theirs.
  - **Verified**: a standalone harness loading `business-data.js` +
    `writing-data.js` directly and calling `duplicateWritingTask()`
    confirmed — duplicating a template with 2 sub-pages (one with a
    code block, statuses `in-progress`/`done`/`todo`, a due date, a
    summary) produces a new template titled "... (Copy)" with every
    field/block intact and a fresh block id, 2 new sub-pages with their
    original titles/statuses/blocks intact, and the original
    template+sub-pages completely untouched and still present; duplicating
    a single sub-page on its own produces one new sibling with its title
    suffixed and every other field intact; the `collapsed` field defaults
    `false` on a new task, toggles correctly, and reads falsy on a
    simulated pre-existing record that predates the field entirely. A
    full `business.html` load (headless Edge, Supabase blocked) with a
    seeded collapsed template (2 hidden sub-pages) and an expanded
    template (1 visible sub-page) as the active tab confirmed the two
    hidden sub-page titles never appear in the rendered DOM at all (not
    just visually hidden), the visible sub-page and both template rows
    do render, exactly 2 caret toggle buttons appear (one per template,
    both of which have children — none on the leaf sub-page rows), and
    exactly 3 "⧉" duplicate buttons render, one per actually-visible row
    — with zero JS console errors throughout. Interactive clicking of the
    caret/duplicate buttons themselves was not exercised this round —
    this environment's headless Edge still cannot reliably be driven via
    a live CDP session for real click interaction (the same disclosed
    limitation several other pages' changelog entries in this file
    already note); a real click-through is recommended before relying on
    this heavily.

- **Writing Dashboard: tasks can be added directly from a Manuscript's
  own detail page, and manuscript cards are bigger and more visually
  polished.** Purely additive to `business.html` (`writing-data.js` was
  untouched — every function this pass needed, `WD.rootTasks(manuscriptId)`,
  `WD.taskCountsForManuscript`, `WD.childTasks`, `WD.Tasks.add`,
  `WD.duplicateWritingTask`, `WD.moveTask`, `WD.Series.get`, already
  existed) — nothing was deleted, per an explicit instruction.
  - **Add Tasks from the Manuscript**: the Manuscript Detail page's
    "Tasks" section previously only showed a "X of Y tasks done" summary
    line and a "📋 Open in Tasks Database" link — actually adding or
    managing a task meant leaving the manuscript and going to the
    separate Tasks Inline Database section first. It now also has a
    "+ Add Task" button (same `prompt()`-for-a-title UX as the database's
    own existing "+ New Template" button, for consistency) and a real
    inline task list (`renderWrManuscriptDetailTasks()`, new) showing
    that manuscript's own templates and sub-pages, fully interactive —
    check off, reorder, collapse/expand, duplicate, open the Task Detail
    modal, delete. This reuses `buildWrTaskRow()` (the exact same row
    component the main Tasks Database table already uses) rather than a
    second copy: it gained one new optional parameter, `refreshFn`
    (defaults to the existing `renderWrTaskTable`, so every pre-existing
    call site is 100% unchanged), and every handler inside it now calls
    `refreshFn()` instead of a hardcoded `renderWrTaskTable()` — so the
    same row works correctly whichever list it's actually rendered into.
    The Task Detail modal's own save/delete handlers now also refresh the
    manuscript detail's inline list (in addition to the main table) when
    it's open, since that modal can be reached from either list. The
    summary line and the inline list both recompute together via
    `WD.taskCountsForManuscript`, so they can never drift out of sync.
  - **Bigger, more polished manuscript cards**: `.wr-ms-grid`'s minimum
    card width grew from 260px to 320px with more gap between cards; the
    card itself gained real breathing room (padding 14px → 22px, more
    gap between its internal rows), a genuine drop shadow + inset
    highlight matching every other frosted-glass card in this app
    (`.bw-card`/`.dw-card`/`.at-card`/`.tn-card` all already use this
    exact `box-shadow` recipe — the manuscript card was the one place in
    this file missing it), a subtle lift-on-hover (`translateY(-3px)`
    plus a stronger shadow), a bigger serif title (16.5px → 21px), and a
    hairline divider above the "Current chapter" line to separate it
    from the progress bar above. New: a slim 4px accent bar along the
    top of every card, colored by the manuscript's own series tint (its
    `Series.tint`, the same color already used for that series' group
    header dot) — or, for a standalone manuscript with no series, its
    own progress-bar color, falling back to the theme's gold — a purely
    visual touch that reuses colors the data already carries rather than
    introducing a new one (DO NOT MODIFY rule 2).
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]): confirmed zero
    duplicate DOM ids anywhere in `business.html` (including the three
    new element ids); a screenshot of a seeded board (one series with two
    manuscripts, one standalone manuscript, one manuscript with 2 real
    tasks) confirmed the new card sizing/spacing/shadow render correctly,
    the two in-series cards both show the series' pink accent bar, the
    standalone card correctly falls back to the gold accent, and the
    seeded "Tasks: 1 / 2 done" count and progress bar render correctly
    from real data; a full page load produced zero JS console errors.
    **Not verified this way**: actually clicking into a manuscript's
    detail page and using the new "+ Add Task" button (which requires
    handling a native `prompt()` dialog) — the underlying functions it
    calls are the same already-proven ones the main Tasks Database uses,
    and `renderWrManuscriptDetailTasks()` is a close structural mirror of
    the already-working `renderWrTaskTable()`, but this environment's
    headless Edge still cannot reliably be driven via a live CDP session
    for real click/dialog interaction (the same disclosed limitation
    several other pages' changelog entries in this file already note); a
    real click-through is recommended before relying on this heavily.

- **Writing Dashboard: manuscripts can now have a cover photo (matching
  the app's main-tab hero pattern), and the Tasks Database gained
  dividers between every row plus a Templates/Tasks split by title.**
  Purely additive to `writing-data.js`/`business.html` — nothing was
  deleted, per an explicit instruction.
  - **Manuscript cover photo**: `Manuscript` gained an additive
    `coverPhoto` field (empty string default, safe for every existing
    manuscript). The Manuscript Detail page gained its own cover banner
    (`.wr-ms-cover`, new) at the very top of the page, above the topbar —
    the same upload/change/remove interaction, gradient legibility
    overlay, and compress-then-swap-for-a-hosted-URL flow as this file's
    own tab-level `.bh-hero` (`renderHero()`/`openHeroFilePicker()`/
    `handleHeroPhotoFile()`), just without the eyebrow/title/CTA text
    overlay, since the page already has its own title input and controls
    right below it — this is the literal "make it similar to the ones on
    the main tabs" ask. New `renderWrMsCover()`/`openWrMsCoverFilePicker()`/
    `handleWrMsCoverPhotoFile()` mirror those functions closely, scoped to
    `wrMsDetailId` instead of `activeTabId`. The manuscript's board card
    also gained a small 16:9 cover thumbnail (`.wr-ms-card-cover`, only
    rendered when a cover photo is actually set — no empty placeholder
    box on cards without one) sitting between the new accent bar and the
    title row. `migratePhotosToStorage()` (this file's own one-time
    base64→hosted-URL backfill sweep) now also scans
    `WD.Manuscripts.list()` for `coverPhoto`, matching how it already
    scans Tabs/Widgets — consistent with the established pattern, even
    though a brand-new field has no legacy data to migrate; it only
    matters for the rare "closed the tab before the async upload
    finished" case.
  - **Dividers between every task row**: `#wrTaskTable > .wr-task-table-row
    + .wr-task-table-row` gained a hairline top border — since every
    rendered row (root task or indented sub-page) is a flat sibling
    inside `#wrTaskTable`, this puts a divider between every consecutive
    pair of rows regardless of depth. Scoped to `#wrTaskTable`
    specifically (the main Tasks Database), not the Manuscript Detail
    page's own inline task list added in the previous session's entry —
    that wasn't asked for, same "scope narrowly, don't touch what wasn't
    requested" precedent this file has followed before (e.g. the Task
    Detail block autosize fix).
  - **Templates/Tasks split, same database**: `renderWrTaskTable()` now
    partitions the already-filtered root tasks into two groups — any
    root task whose *title* contains the word "template"
    (case-insensitive substring match) vs. every other root task — each
    under its own small header (`.wr-task-group-title`, "Templates (N)"/
    "Tasks (N)", omitted when empty), still rendered into the exact same
    `#wrTaskTable` container, not a separate section/page/tab. Deliberately
    **distinct from the pre-existing "TEMPLATE" badge** (`buildWrTaskRow()`
    already tags any root task that merely *has sub-pages* as a
    "template," regardless of its title) — a task titled "Draft Chapter 3"
    that happens to have a sub-page still gets the TEMPLATE badge (that
    existing, unrelated concept) but lands in the "Tasks" group here,
    since its title doesn't contain the word "template." A sub-page
    always renders grouped under its own parent regardless of the
    sub-page's own title — splitting a template from its sub-pages
    would break the tree visually, so only root tasks are partitioned.
    The adjacent-sibling divider rule above composes correctly with this:
    a `.wr-task-group-title` header breaks the sibling chain, so no
    divider appears directly under a group heading, only between actual
    task rows.
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]): confirmed zero
    duplicate DOM ids (including the eight new cover-photo element ids)
    and zero JS console errors on a fresh load; a seeded manuscript (a
    real base64 cover photo, 5 tasks — two titled "…Template," one
    titled "Draft Chapter 3" with a real sub-page, one plain) screenshot-
    confirmed: the card shows the real cover thumbnail correctly above
    its title row, the board's "Tasks: 1 / 5 done" count is accurate,
    the Tasks Database renders a "Templates (2)" group (both
    template-titled tasks) followed by a "Tasks (2)" group, a visible
    divider line between the two template rows, and "Draft Chapter 3"
    correctly lands in the "Tasks" group while still showing its own
    unrelated TEMPLATE badge (proving the two "template" concepts stayed
    distinct). **Not verified this way**: actually clicking "+ Add a
    cover photo" and completing a real file upload, and interactively
    reordering rows within a group — this environment's headless Edge
    still cannot reliably be driven via a live CDP session for real
    click/file-picker interaction (the same disclosed limitation several
    other pages' changelog entries in this file already note); a real
    click-through is recommended before relying on this heavily.

- **Fixed a real mobile horizontal-overflow bug in `.bh-task-card`
  (business.html) and its `.tn-task-card` counterpart (tasksnotes.html) —
  the shared task-row component used by the Resources tab's Tasks
  section, the Writing Dashboard's Tasks Database, the new Manuscript
  Detail inline task list, and the standalone Tasks & Notes page.**
  Prompted by "make everything show up nicely on my phone" — audited
  everything built across this session (Tasks & Notes, the Writing
  Dashboard's collapsible templates/duplicate/manuscript tasks/cover
  photo/dividers/grouping) for real phone-width breakage, not by eye but
  by measurement. Nothing was deleted.
  - **Root cause, found by measurement, not guessing**: `.bh-task-card`
    was `display:flex` with no `flex-wrap` — fine on desktop, but this
    row can carry a dozen controls (reorder/collapse arrows, checkbox,
    title, TEMPLATE badge, manuscript tag, priority pill, due date,
    +Sub-page, open, duplicate, delete), and on a 390px phone viewport
    those don't fit on one line. Without wrapping, the row (and with it,
    the whole page) was forced wider than the viewport — a genuine
    horizontal-scroll bug, not just a cosmetic squeeze. Confirmed via a
    same-origin iframe harness (`--allow-file-access-from-files`,
    Supabase blocked) that read `document.documentElement.scrollWidth`
    against `window.innerWidth` and walked every element's
    `getBoundingClientRect()` to name the actual overflowing nodes —
    found `.bh-task-del`/`.bh-task-open`/`.wr-task-add-sub`/
    `.wr-task-ms-tag`/`.bh-task-pill`/`.bh-task-due` all stacking past
    the 390px edge, pushing `scrollWidth` to 796px.
  - **Fix**: `.bh-task-card` gained `flex-wrap: wrap`, plus a
    `max-width: 560px` rule giving `.bh-task-title` a forced 100%
    flex-basis — this makes the title claim its own full-width line
    (whatever small reorder/checkbox icons fit stay on the line above
    it, and every badge/action button flows onto the line(s) below) —
    no DOM/JS restructuring needed, and no shared row-building function
    (`buildResTaskRow`/`buildWrTaskRow`/`buildTaskRow` in
    `tasksnotes.html`) had to change. `.wr-task-ms-tag` (the manuscript-
    name chip shown on Writing Dashboard task rows) also gained a
    `max-width`/ellipsis so one long manuscript title can't blow out a
    row by itself even once wrapping is available. `tasksnotes.html`'s
    own `.tn-task-card` got the identical `flex-wrap`/title-flex-basis
    treatment, scoped to its own narrower `max-width: 480px` breakpoint
    (that page's task rows carry fewer controls than the Writing
    Dashboard's, so needed a tighter trigger width to still look
    intentional rather than wrapping unnecessarily early on a slightly
    wider phone).
  - **Also fixed while auditing**: `.wr-page-section-title` (the
    Manuscript Detail page's "At a Glance"/"Tasks"/"Notes" section
    headers, each pairing a label with one or more action buttons) had
    no `flex-wrap` either — harmless on desktop, but a real risk once
    this session's own "+ Add Task"/"📋 Open in Tasks Database" button
    pair made that row wider; gained `flex-wrap: wrap` and a `gap` so it
    degrades gracefully instead of squeezing.
  - **What was already fine, confirmed rather than assumed**: the
    manuscript board grid, cards (including the new cover-photo
    thumbnail and accent bar), the Manuscript Detail page's cover-photo
    banner, stat grid, and notes sections, and the global topbar nav
    (which already has its own established `@media (max-width: 480px)`
    horizontally-scrolling-strip behavior, `topbar.js`, untouched here
    per DO NOT MODIFY — its pills reporting a `getBoundingClientRect()`
    past the viewport edge during measurement is expected for a
    horizontally-scrolled strip contained by its own `overflow-x: auto`,
    not a real page-level overflow, confirmed by `documentElement
    .scrollWidth` staying exactly at `innerWidth` once the real
    `.bh-task-card` bug above was fixed).
  - **Verified in headless Edge with Supabase blocked**
    (`--host-resolver-rules`, armed before navigation, per
    [[feedback_block_supabase_before_browser_testing]]), at a 390px
    viewport, via the iframe-measurement harness described above: the
    Writing Dashboard board view (`document.documentElement.scrollWidth
    === window.innerWidth`, zero true overflow, confirmed by re-scanning
    every element's bounding rect), the Tasks Database with realistic
    long-title seeded tasks (was previously the exact reproduction case,
    now clean), and the Manuscript Detail page — opened via a real
    dispatched `click` event on a manuscript card, not just asserted, to
    confirm its cover banner/inline task list/notes all render within
    390px too — all passed with zero overflow; `tasksnotes.html` with
    realistic long-title seeded links/notes/tasks also passed with zero
    overflow and zero offending elements at all. A **known limitation
    of this environment's headless-Edge `--screenshot` capture, not a
    real bug**: a visual screenshot taken this same session showed
    apparently shifted/garbled text — reproduced identically on
    `aitech.html` (a page untouched this session) at the same viewport,
    confirming it's a pre-existing headless-Edge rendering/capture
    artifact in this environment (the same class of false alarm this
    file's own Fitness Studio Overview-board entry already documented
    once, there attributed to a DPI-scaling mismatch) — not trusted over
    the actual DOM measurement, which is what this fix is verified
    against.

- **Learning & Knowledge Hub (`learning.html`) Resources database: a real
  "read the article" page styled to match a reference photo of a
  professional article/publication layout** (small eyebrow label, a large
  bold headline, a one-line subtitle, an author byline between two
  hairline dividers, a full-width cover photo, then body text), plus a
  cover photo per Resource, insertable dividers between body sections, and
  pasted-photo support inside a section's text box. Purely additive —
  every existing Topic/Resource field, the type-structured grouping, drag-
  reorder, search/filter chips, favorites, and the transcript copy button
  are all unchanged; nothing was deleted.
  - **Data** (`learning-data.js`): `Resource` gained `subtitle` (a short
    dek shown under the headline) and `cover` (upload-or-paste-a-URL,
    compressed via this app's standard canvas-downscale recipe — same
    field shape as `Topic.cover`). Each `ResourceSection` gained `type`
    (`'text'` default, or `'divider'` — a plain rule with no title/body)
    and `images` (an array of `{id,url,name}`, populated by pasting a
    photo into that section's body — see below). Pre-existing sections
    saved before this update have neither field; every read site treats a
    missing `type` as `'text'` and a missing `images` array as `[]`,
    so no migration pass was needed. New:
    `addResourceSectionImage`/`removeResourceSectionImage`/
    `updateResourceSectionImageUrl` (the last one swaps a pasted image's
    local dataURL for its PhotoStore-hosted URL once upload settles, only
    if that exact image is still present). `addResourceSection()` gained
    an optional third `type` argument.
  - **The article page** (`#lhResourceDetailModalBg`, rebuilt from a small
    centered modal into a full-page overlay — `.lh-article-page-bg`, the
    same "a record's own page needs real room" convention as this app's
    other full-page overlays, e.g. business.html's Manuscript Detail —
    registered in `topbar.js`'s `MODAL_SELECTORS` for correct body-scroll-
    lock, the one edit made to that shared file): eyebrow (the resource's
    topic name, or its type label if unlinked), a large serif headline,
    an optional subtitle, a byline row (an initial-letter avatar, the
    author name, and the resource's creation date) sitting between two
    `<hr>` dividers, a full-width cover photo (click-to-upload, same
    Change/Remove tools as every other cover field in this app), then the
    body — the resource's existing generated-on-demand sections, now
    de-chromed to read like article copy (a small caps label instead of a
    boxed title field, a borderless serif textarea that only gains a
    visible outline on focus) rather than looking like form UI. "✎ Edit
    Details" hands off to the ordinary Add/Edit Resource modal (which
    gained the new Subtitle field and the same cover upload/paste-URL
    fields as the Topic modal) — closes the article page first and
    reopens it afterward on every exit path (Save/Delete/Cancel/backdrop
    click), the same modal-stacking handoff precedent business.html's
    Platform Detail → cover-photo-picker already established, since two
    full-screen overlays can't sensibly stack at once.
  - **Dividers**: a new "─ Add Divider" button next to "+ Add Text
    Section" inserts a `type: 'divider'` section — renders as a plain
    hairline rule with its own (hover-revealed) reorder/delete controls,
    so text blocks and dividers can be freely interleaved and reordered
    together as one list.
  - **Pasted-photo processing**: every text section's body textarea has a
    `paste` handler — if the clipboard contains an image (copied from
    anywhere, not just a file picker), it's compressed via this app's
    standard recipe, appended to that section's own inline thumbnail
    gallery (click a thumbnail to open it full-size, hover for a remove
    ×), and then uploaded to PhotoStore with the hosted URL swapped in
    once that settles — the same "compress now, upload after" pattern
    every cover-photo field on this page already uses. A plain text paste
    is left completely untouched (nothing calls `preventDefault()` unless
    an actual image was found in the clipboard), so normal typing/pasting
    text into a section works exactly as before.
  - **Grid cards** gained a cover-photo thumbnail (shown above the type
    badge when a cover is set) and the "📄 Open Page" button was relabeled
    "📖 Read Article" to match the new framing — same click behavior.
  - **`migratePhotosToStorage()`** was extended to also sweep every
    Resource's `cover` and every section's `images[]` for base64 `data:`
    values and upload them, alongside the hero/topic-cover sweep it
    already did — consistent with this page's existing one-time
    localStorage-footprint-reduction pass.
  - **Testing note, disclosed rather than glossed over**: this session's
    attempts to drive headless Edge in this environment all failed before
    reaching a page — even a bare `msedge --version` returned "Opening in
    existing browser session" instead of executing, and multiple
    `--headless=new` launches (with fresh isolated `--user-data-dir`
    profiles, tried both via `Start-Process` and the call operator) exited
    immediately with "Multiple targets are not supported in headless
    mode" and produced no output at all — a stricter, more total version
    of the same "automation gets absorbed into the one running instance"
    limitation this file's own `dreamboard.html`/`business.html` entries
    already document, not something a different flag combination could
    work around this time. Verified statically instead, per that same
    established fallback: zero duplicate DOM ids, zero orphaned `$('id')`
    references (82 HTML ids vs. 79 referenced, no misses), and balanced
    braces/parens in both `learning.html`'s script (290/290, 1168/1168),
    its `<style>` block (216/216), and `learning-data.js` (166/166,
    278/278). **Not verified this way**: an actual click-through (opening
    the article page, adding/reordering a divider, pasting a real image
    into a section, uploading a cover photo) — a real click-through is
    recommended before relying on this heavily.

- **Learning & Knowledge Hub Resources gained a "★ Favorites Only" filter
  chip.** Purely additive — the `favorite` field and its per-card star
  toggle already existed; this just adds a way to filter by it. A new
  transient (in-memory-only, same precedent as the existing topic/type
  filters and search) `resourceFavoritesOnly` flag, toggled by a chip
  appended to the end of the existing type-filter chip row
  (`#lhResourceTypeChips`), composes with the topic/type/search filters
  exactly like every other resource filter already does —
  `baseFilteredResources()` gained one more `.filter()` line. Verified
  statically (same fallback as the entry above, this environment's
  headless Edge still unusable this session): zero duplicate DOM ids,
  zero orphaned `$('id')` references, balanced script braces/parens.

- **`learning-data.js` gained a `?v=2` cache-busting query string on
  `learning.html`'s `<script src="...">` tag, after a report that a phone
  wasn't reflecting the last two sessions' worth of changes to this
  page.** Root cause and fix are the same as `business-data.js`'s own
  documented `?v=N` history (see that file's changelog entries above):
  this repo has no build step and no server-side cache-control (no
  `vercel.json` — CLAUDE.md §1), so editing a script's *contents* never
  changes its *URL* — a device that already fetched the old
  `learning-data.js` has no signal to refetch it and keeps calling
  whatever functions existed in that older copy. `learning.html` itself
  already carries the `Cache-Control`/`Pragma`/`Expires` "no-cache" meta
  tags from when it was first built, so only the un-versioned companion
  data-file reference was missing this mitigation. No data was lost or
  at risk here either way — every device's real `localStorage`/Supabase
  data is untouched by this; a stale-cached *script* just means a device
  keeps running older *code* against that same real data until it
  refetches. Any future `learning-data.js` change should bump this
  `?v=` number again, same standing reminder `business-data.js`'s own
  entries already note for that file.

- **Real root cause found for "Learning Hub and Tasks & Notes still
  aren't showing up on my phone": `main` — the branch this deployment
  actually serves — was 10 commits behind `feat/writing-dashboard`.**
  The cache-busting fix in the entry directly above was a real, worthwhile
  mitigation but not the actual cause this time — it couldn't have been,
  since `tasksnotes.html` didn't exist on `main` **at all**
  (`git show main:tasksnotes.html` failed outright), so no amount of
  cache-busting on a phone could make a file show up that was never
  deployed to begin with. This is the exact same failure class this file
  already documented once for the Writing Dashboard ("Bugfix: the Writing
  Dashboard (Business Hub) was invisible on a live device because the
  whole feature had only ever been merged into `feat/writing-dashboard`,
  never into `main`," a few entries above) — recurring here because work
  since that fix (the Learning Hub article-page rebuild, the Favorites
  filter, `tasksnotes.html`'s entire creation, and several other commits)
  kept landing on `feat/writing-dashboard` and being pushed there, without
  a further merge into `main` each time. Fixed the same way: confirmed
  `main` was a strict ancestor of `feat/writing-dashboard`
  (`git merge-base --is-ancestor`, a clean fast-forward, no conflicts, no
  history rewrite) and pushed `feat/writing-dashboard` directly onto
  `origin/main` (`git push origin feat/writing-dashboard:main`) rather
  than merging locally, so the pre-existing unrelated uncommitted
  `index.html` change already sitting in this session's working tree (not
  part of this fix, left alone) never had to be touched via a branch
  checkout. Confirmed afterward: `origin/main` and
  `origin/feat/writing-dashboard` are now byte-identical (`0`/`0`
  ahead-behind) and `tasksnotes.html` is present on `main`. **Going
  forward, any change meant to actually reach the live site needs to
  land on `main`, not just get pushed to `feat/writing-dashboard`** —
  either keep merging/fast-forwarding after each push (as done here), or
  do the work directly against `main` if there's no longer a reason to
  keep the two branches separate.

- **New: YouTube Dashboard — a 6th Business Hub tab (`layout: 'youtube'`),
  built to host and manage multiple YouTube channels, with a layout
  deliberately modeled on the Writing Dashboard's own shape** (a landing
  board of grouped entities with goal/progress cards, a Tasks Inline
  Database, an idea gallery, and a per-entity "planner" page) rather than
  a pixel-for-pixel port — a nested Scrivener-style binder tree, Plot/
  Continuity/Character trackers, Composition Mode, a Theme Marketplace,
  and Compile & Export don't have a natural channel-management equivalent,
  so those were deliberately left out rather than forced in. Genuinely new
  companion data file, `youtube-data.js` (mirrors `writing-data.js`'s own
  sibling-file convention — same `makeCollection`/model-factory pattern,
  same numeric `order` + swap-adjacent-values reordering throughout, since
  a channel's video list is flat, not a nested tree, so it never needed
  BinderNode's fractional-indexing `orderKey`); every key it defines is
  still `business:*`-prefixed (`business:ytNetworks`, `business:ytChannels`,
  `business:ytTasks`, `business:ytVideos`, `business:ytIdeas`,
  `business:ytArticle`, plus the small `business:ytActiveView`/
  `ytActiveChannelId`/`ytActiveVideoId`/`ytSeeded` state keys), so the
  existing `initCloudSync({ appKey: 'business', syncedPrefixes:
  ['business:'] })` call already in `business.html` covers it with zero
  new sync wiring. `business-data.js` itself only gained the same small,
  additive set of changes the Writing Dashboard's own tab needed the first
  time: `'youtube'` added to `tabModel()`'s `layout` whitelist (and to
  `normalizeStoredData()`'s layout-fallback/title-matching loop), a new
  `isYoutubeSubpage` tab field (mirroring `isWritingSubpage`, filtered out
  of the main `.bh-tabs` pill row by `renderTabs()` the same way), a new
  `ensureYoutubeDashboardExists()` (mirroring `ensureWritingDashboardExists()`
  line-for-line — appends the tab and its 3 hidden sub-page tabs directly
  on every load, guarded only by "some tabs already exist" so a genuinely
  fresh device isn't handed a stray tab before its own deferred seed runs,
  same fix this app has already needed more than once for a newly-added
  tab on an already-seeded device), and a matching seed block in
  `seedDefaultBoard()` (tab `order: 5`, sub-page tabs at `order: 200–202`
  so they can never collide with the Writing Dashboard's own `100–102`).
  - **Entity mapping, deliberately parallel to the Writing Dashboard's own
    Series→Manuscript→BinderNode chain**: **Network** (Series equivalent —
    an optional grouping for channels, e.g. "Main Channels") → **Channel**
    (Manuscript equivalent — niche, content format, upload frequency,
    subscriber current/goal, revenue goal, a "Today's Goal" current/
    target/unit trio, a total-videos-published goal, a cover photo, a
    "Current Video" pointer, editable/reorderable/deletable notes
    sections, the same drag-reorderable/color-graded/cover-photo'd board
    card as a Manuscript's) → **Video** (the Binder's node equivalent,
    deliberately flattened — a channel's upload queue is a flat list, not
    a Part/Chapter/Scene tree, so it's a plain reorderable array with a
    free-text `playlist` label instead of a foreign key, same "label, not
    a relation" precedent as `business-data.js`'s Content Plan Card
    `platform` field). **Video Ideas** (`YtIdea`) mirrors `WritingIdea`
    field-for-field (title/pitch/tags/status/notes). The **Tasks Inline
    Database** is the identical template/sub-page mechanic (a root task
    with `parentTaskId: null` is a "template," children are its
    "sub-pages," up/down-arrow reorder not drag, collapse/duplicate/
    generated note-and-code blocks all present) with `channelId` in place
    of `manuscriptId`.
  - **Video Planner** (opened via a channel's "📺 Open Video Planner"
    button, a `.wr-page-bg` full-page overlay reusing that exact class —
    same component, not a new one) is the Binder's proportional
    replacement: a **Channel Targets** row (two progress bars — total
    videos published vs. an editable goal, and the channel's own Today's
    Goal) above a 2-column layout (new CSS, `.yt-planner-layout` —
    Writing's Binder is a 4-column Part/Chapter/Scene tree editor; a
    channel's flat video list needs no tree column, so 2 columns is
    enough) — a left video list (inline-editable titles, ▲▼ reorder,
    delete, a status-emoji icon, reusing `.wr-binder-node`'s exact CSS)
    and a right editor panel: a title field, a meta grid (status/publish
    date/playlist/tags/video URL/a paste-a-URL thumbnail field — no file-
    upload picker for the thumbnail specifically, a deliberate "keep it
    simple" scope cut for one minor field, consistent with how several
    other simple link-style fields elsewhere in this app are paste-URL-
    only), a Script textarea with a live word count (reusing
    `WD`'s/`YT`'s shared plain-whitespace-split `wordCount()`), and a
    separate Video Notes textarea — the same Index-Card-plus-Chapter-
    Notes shape as the Binder's own editor, just without the tree/
    trackers/Composition-Mode/Compile-Export machinery around it.
  - **Almost no new CSS** — the entire visual layer reuses the Writing
    Dashboard's own `.wr-*`/`.bh-task-card`/`.bh-pf-section*` component
    classes verbatim (board/series-group/manuscript-card/idea-card/task-
    row/binder-tree-col/index-card shapes are generic layout patterns, not
    writing-specific, despite their `wr-`/`ms` naming), per this file's own
    DO NOT MODIFY rule 2 ("reuse existing component patterns before
    inventing new class names") — confirmed directly rather than assumed,
    by grepping every reused class name to make sure each one actually has
    a CSS rule already defined. Only three genuinely new rules were added:
    `.yt-planner-layout` (the 2-column planner grid), a `#ytTaskTable`-
    scoped task-row divider (mirroring the existing `#wrTaskTable`-scoped
    one), and `.yt-video-row-meta` (a small mono publish-date label on
    each video row). No new color tokens anywhere.
  - **Verification, disclosed honestly**: this session's headless-Edge
    automation could not be used at all this round — every launch attempt
    (both the "gets absorbed into an already-running background instance"
    failure mode and, this time, a variant where the process never even
    spawned/produced output) was confirmed via `Win32_Process` command-line
    inspection to be hitting a real, pre-existing background Edge instance
    (`--no-startup-window`, the user's own profile) rather than a fresh
    isolated one — that process was left completely untouched, per this
    file's own established caution around not killing a background browser
    instance that might be the user's real session. Verified statically
    instead, the same fallback several other entries in this file already
    use when this environment's headless Edge is unusable: `<div>`/
    `<button>`/`<select>`/`<textarea>`/`<span>` tag-open/close counts all
    balanced across `business.html`; brace/paren counts balanced across
    `business.html`'s script and style blocks, `business-data.js`, and
    `youtube-data.js`; every `$('id')` reference in the script (339
    distinct) cross-matched against real HTML element ids (370 distinct) —
    zero unresolved; zero duplicate DOM ids anywhere in the file; and every
    `YT.*` member referenced from `business.html` cross-checked by hand
    against `youtube-data.js`'s public API object — all present. This is a
    weaker guarantee than an actual click-through, same disclosed caveat
    this file's own `dreamboard.html`/`aitech.html`/`learning.html` entries
    already carry for this exact environment limitation — a real test
    (adding a network/channel/video/task/idea, opening the Video Planner,
    switching sub-pages) is recommended before relying on this feature
    heavily.
  - Nothing existing was deleted or restructured — every edit to
    `business-data.js`/`business.html` was additive (new whitelist entries,
    a new tab field, a new function, a new seed block, new render-dispatch
    branches alongside the existing ones), and the pre-existing Content/
    Ideas/Platforms/Resources/Writing Dashboard tabs are untouched.

- **New page: `mainpillar.html` ("Main Pillar"), a gamified daily command
  center themed after Solo Leveling's "System" UI, built from a detailed
  written spec** (Today/Weekly/Monthly/Year dashboards, a Whoop-fed habit
  tracker, an AI-context journal, a Win of the Day archive, AI-generated
  Morning/Weekly/Monthly/Yearly briefs, Smart Goal Allocation, Habit Streak
  Analytics, and a Favorites memory archive). Genuinely new files,
  `mainpillar.html` + `mainpillar-data.js` — new nav pill (`MAIN PILLAR` →
  `mainpillar.html`, appended after `TASKS & NOTES` in `topbar.js`'s
  injected pill list — the only edit made to `topbar.js`, same
  one-line-addition precedent every prior page addition followed); new
  sync key (`appKey: 'mainpillar'`, `syncedPrefixes: ['mainpillar:']`,
  wired via the standard shared `initCloudSync` — same call pattern as
  every other page, nothing new invented).
  - **Confirmed scope, asked up front rather than guessed** (this request
    described capabilities the app's actual architecture — no backend, no
    cron, no active AI key, per §1/§2 — can't literally provide, the same
    "flag rather than silently follow" precedent the Writing Dashboard
    section above already established):
    - **Placement**: a brand-new standalone page with its own `mainpillar:*`
      data, not a rebuild of `index.html`. `index.html`'s own Goals command
      center (habits, monthly/yearly allocation engine, journal, Life
      Areas, Businesses, Self-Discovery) is completely untouched — some
      concepts (habit streaks, goal allocation) now exist in both places
      with separate data, by design; this page is the newer,
      gamified/Whoop-aware system, not a replacement.
    - **Whoop integration**: real OAuth needs a client secret, which can't
      safely live in static client JS the way Supabase's public anon key
      can (§2). Built as manual/pasted-in fields (`mainpillar:whoop:<date>`
      — recovery/strain/sleep score/sleep hours/efficiency/HRV/RHR/SpO2/
      skin temp/resp rate/notes, via a "Log Today's Whoop Data" modal) —
      the real API can be wired in later once a backend decision is made;
      nothing in the data model or UI would need to change, only how that
      one record gets populated.
    - **AI features** (Morning/Weekly/Monthly/Yearly Briefs): reuses this
      app's one established pattern for this — a direct client-side
      `fetch()` to `https://api.anthropic.com/v1/messages` with an
      `ANTHROPIC_API_KEY` constant — following the same inactive-placeholder-
      key convention as every other AI-shaped feature this file's own
      history describes (`ANTHROPIC_API_KEY` here is literally
      `'PASTE-YOUR-ANTHROPIC-API-KEY-HERE'`, matching the app's existing
      `'PASTE-'`-prefix sentinel convention already used for
      `TOPBAR_SUPABASE_KEY` in `topbar.js`). **Genuinely new, beyond just
      reusing the pattern**: every brief-generating call
      (`callAI(prompt)`) falls back to a locally-computed template summary
      (`localFallbackDailyBrief()` and inline equivalents for the weekly/
      monthly/yearly briefs) built directly from real Whoop/habit/task
      data whenever the API call returns `null` — offline, no key, a bad
      key, or a CORS/network failure all degrade to the same fallback
      rather than a dead button — so the feature is genuinely useful with
      zero configuration, not just a stub waiting for a key. Each cached
      brief (`mainpillar:brief:<scope>:<periodKey>`) carries an `isAI`
      flag so the UI can honestly label a result "AI-GENERATED" vs.
      "AUTO-SUMMARY" rather than implying real AI ran when it didn't.
    - **Automatic 8am email/push**: this app has no server and no cron of
      any kind (§1) — there is nothing that can run at a fixed time if the
      page isn't open. Built as generate-on-open instead: the Morning
      Brief auto-generates (`maybeGenerateMorningBrief()`, called from
      `renderAll()` on every load) the first time the page opens after
      today's Whoop data exists, cached for the rest of the day, with a
      manual "Regenerate" button — no email, no push, no backend. If real
      scheduled delivery is wanted later, that's a standing architecture
      addition (a real cron + an email API), not something built quietly
      here.
  - **Gamification (Solo Leveling framing), genuinely new to this app**:
    a five-stat "Hunter" system (`mainpillar:hunter` — STR/VIT/INT/AGI/SEN,
    mapped to physical training / sleep-recovery / learning-creative work /
    tasks shipped / journaling-mindfulness respectively) that every
    XP-earning action feeds into — completing a habit (its own configured
    XP, into its own configured stat), completing a task (flat XP into
    AGI), the first Win of the Day logged each day (small XP into SEN),
    and the first journal save with real text each day (small XP into
    INT). `xpForLevel(L) = 100*(L-1)*L/2` is a plain, documented RPG curve
    (not a claim of any real formula) so leveling gets meaningfully slower
    at higher levels; Rank (E through S) is derived purely from Level, no
    separate stored field. A full-screen "LEVEL UP" overlay
    (`.mp-levelup-bg`, styled to match the page's own System-HUD aesthetic)
    fires automatically whenever a render detects the computed level has
    passed `hunter.lastSeenLevel`, auto-dismissing (and acknowledging)
    after ~2.6s or on click — this is genuinely new UI, not reused from
    `example.html`'s existing "Solo Leveling: Beyond the System"-themed
    notification (that page's `.sy-notify` component is a static demo, not
    a real event-driven system).
  - **Palette/component techniques, an explicit aesthetic exception**: own
    self-contained `--mp-*` tokens (near-black background, cyan/purple
    glow accents, gold for XP/rank) — the same "explicit gamification/
    aesthetic-match instruction" exception category as every other themed
    page in this app (CLAUDE.md §6/DO NOT MODIFY rule 2), reusing this
    exact codebase's own already-established System-HUD *techniques*
    (`example.html`'s clip-path notched-corner panels, CRT scanline
    overlay, `sy-notify`-style bordered notification blocks) under this
    page's own token prefix, rather than inventing a fresh visual
    language from scratch. `--good`/`--warn`/`--bad` semantic roles were
    kept as plain green/amber/red (not cyan-ified) for the same
    "status colors carry meaning, not brand accent" reason `gym.html`'s
    own crimson re-theme already established. A Google Fonts pairing new
    to this repo — Rajdhani (display) + Chakra Petch (mono/HUD labels) —
    was loaded for a techy, gamer-HUD feel; every other page's existing
    font pairing (system sans + SF Mono stack, or Cormorant Garamond on
    the Dream-Board-family pages) was left untouched.
  - **Data model** (`mainpillar-data.js`, same model-factory +
    `makeCollection` + pure-selector conventions as every other page's own
    `-data.js`): flat collections for `Habits`/`Tasks`/`Projects`/`Wins`/
    `Goals`/`Favorites`, plus date-keyed records for `whoop:<date>`/
    `habitlog:<date>`/`journal:<date>` and scope-keyed records for
    `brief:<scope>:<periodKey>`. `applyAutoCompletes(dateStr)` — a habit
    can optionally be wired to a Whoop field + threshold (e.g. "Sleep 7+
    hours" auto-completes once `sleepHours >= 7` is logged for the day);
    it's idempotent (routes through the same `setHabitLogDone()` path a
    manual checkbox uses, which no-ops once already true) so it's safe to
    call on every render/save, and is called both after every Whoop save
    and at the top of every `renderAll()` so a value arriving via cloud
    sync from another device retroactively completes the right quests
    too, not just a same-device manual save.
  - **Smart Goal Allocation** (`computeGoalAllocation()`) is a genuinely
    separate, self-contained implementation of the same idea as
    `index.html`'s own monthly/yearly goal-allocation engine — not a port
    of that code, since this page's goals are entirely separate data
    (`mainpillar:goals`/`mainpillar:goalLog:<goalId>`, own periods/own
    logged-progress). Same behavior in spirit: a target split evenly
    across the remaining periods of its scope (yearly → 12 months,
    monthly → ~4-5 Sunday-start weeks), with a per-goal `rollover` setting
    (`roll` onto just the next period, or `redistribute` evenly across
    every remaining period) reconciling any already-past period's
    shortfall forward on every read — so a missed month doesn't fail the
    goal outright, the same "adapts automatically rather than failing"
    behavior the request specifically asked for.
  - **Habit Streak Analytics**: `computeHabitStreaks()` (current/best,
    walked day-by-day from the habit's own creation date, same algorithm
    shape as `index.html`'s own `computeHabitStreaks()` but against this
    page's separate habit/log data) and `habitConsistency()` (% of
    scheduled days completed over an arbitrary date range) back three
    surfaces at once: the per-quest streak badge on Today's Daily Quests,
    the Habit Streak Analytics list on the Goals tab (current/best/30-day
    consistency per habit), and every heat-map cell on the Monthly/Year
    tabs (`dayHabitScore()` — % of that day's scheduled quests completed).
  - **Monthly/Year heat maps**: four independent month-grid heat maps
    (Recovery/Strain/Sleep/Quest Consistency) on the Monthly tab, plus a
    53-column GitHub-contribution-style full-year grid on the Year tab —
    same "no charting library, hand-rolled `<div>` grid" convention this
    app has used for every other visualization (`projects.html`'s own
    contribution grid, `gym.html`'s sparklines, etc.). Every cell, on
    every heat map, is clickable and opens a shared **Day Detail modal**
    (`#mpDayModalBg`) showing that date's Whoop tiles, that day's quest
    checklist, journal text, and any wins logged — the literal "clicking
    any day opens the daily report/journal/Whoop metrics" ask.
  - **Favorites** (`mainpillar:favorites`) is a deliberately simple gallery
    — type chips (Post/Photo/Video/Moment/Note), search, a paste-a-URL
    cover field (no upload/compression pipeline, unlike most other
    galleries in this app — a deliberate scope cut consistent with how
    e.g. `selfcare.html`'s Bucket List cover field was kept simple for the
    same reason) — explicitly framed as a memory archive, not a
    productivity surface, per the request's own "focuses on preserving
    meaningful life memories" framing.
  - **Yearly AI Review** is built now, not left as a stub, despite the
    request's own spec text labeling it "planned future feature" — since
    it uses the exact same `callAI()`/fallback-template mechanism as every
    other brief here, withholding it would have meant deliberately
    building a worse version of something already built for consistency's
    sake. The Year tab's notification panel is seeded with a plain
    explanatory placeholder ("generate it once you have a few months of
    data logged") until the button is pressed at least once, so it doesn't
    read as a broken/empty feature on a fresh install.
  - **A real bug caught and fixed before shipping, not by browser testing
    (which wasn't available — see below) but by re-reading the script
    load order**: `mainpillar-data.js`/`sync.js`/`topbar.js` all load with
    `defer`, so they only execute once the document has finished parsing —
    right before `DOMContentLoaded`. The page's own inline `<script>` (no
    `src`, so `defer` has no effect on it per spec) executes immediately
    as the parser reaches it, which is *earlier* than that — so the
    original version's top-level boot call (`switchTab(...); renderAll();
    seedRaceSafeInit();`, plus a `state.activeTab` initializer that called
    `MD()`) would have run before `window.MainPillarData` existed at all,
    throwing on the very first real load. Fixed by moving that state
    initializer to a plain `localStorage.getItem(...)` read (it never
    actually needed the data-layer file) and wrapping the whole boot call
    in `document.addEventListener('DOMContentLoaded', function(){...})`
    — the same pattern `household.html`/`aitech.html` already use for
    exactly this reason. Every `$('id')`/click-handler binding elsewhere
    in the script was already safe as-is (DOM nodes above the script tag
    exist by parse time; a handler body that calls `MD()` only runs later,
    on an actual click, which is always after `DOMContentLoaded`).
  - **Verification, disclosed honestly**: this session's headless-Edge
    automation could not be used at all — every launch attempt (isolated
    `--user-data-dir`, `--host-resolver-rules` blocking `*.supabase.co`,
    both `--dump-dom` and a `--remote-debugging-port` attempt) failed
    immediately with `"Multiple targets are not supported in headless
    mode"`, the same absorbed-into-an-already-running-background-instance
    failure mode several other pages' changelog entries in this file
    already document for this environment; a real, pre-existing
    `--no-startup-window` Edge process on the user's own profile was
    found running and deliberately left untouched rather than killed, per
    this file's own established caution around background browser
    instances that might be the user's real session. Verified statically
    instead, the same fallback several other entries in this file already
    use: brace/paren balance confirmed on both new files (186/186 braces
    and 480/480 parens in `mainpillar-data.js`; 220/220 braces and
    1216/1216 parens in `mainpillar.html`'s inline script, re-confirmed
    after the boot-order fix above; 156/156 braces in its `<style>`
    block); zero duplicate DOM ids across 133 unique element ids; every
    one of the 115 `$('id')` references and all 51 `D.xxx`/`MD().xxx`
    calls into `MainPillarData`'s public API cross-matched and resolved
    with nothing missing. Given the boot-order bug the script-load-order
    re-read alone caught, this is a meaningfully weaker guarantee than an
    actual click-through — more so than usual for this disclosed caveat
    this file's own `dreamboard.html`/`aitech.html`/`learning.html`/
    `youtube-data.js` entries already carry for this exact environment
    limitation — a real test (logging a day of Whoop data, checking off a
    quest and confirming XP/streak/level-up behavior, generating a brief
    with no key configured to confirm the fallback text reads sensibly,
    clicking through a heat-map cell to the Day Detail modal, logging
    progress against a Smart Goal and confirming the allocation math)
    is recommended before relying on this page heavily.

- **New page: `home.html` ("Home") — combines four *existing* pages
  (Dream Board / Tasks & Notes / AI & Tech / Self-Care) into one tab,
  plus a Weekly Schedule section and a Subconscious Reprogramming
  section.** Per an explicit instruction, **nothing in any existing tab
  or page was deleted** — every one of the four combined pages is
  reused completely unmodified.
  - **How "combine" was actually implemented**: `home.html` embeds
    `dreamboard.html`/`tasksnotes.html`/`aitech.html`/`selfcare.html` as
    four of its six sub-tabs, each in a same-origin `<iframe>`, lazily
    loaded (the `src` is only set the first time that sub-tab is opened,
    so switching to Home doesn't cold-start four pages' worth of Supabase
    Realtime subscriptions at once). This was a deliberate choice over
    re-implementing all four systems' UI/logic a second time inside one
    new file — that would have meant duplicating Dream Board's/Business
    Hub's own widget-board engine, Tasks & Notes' three databases, AI &
    Tech's Models/Prompts split, and Self-Care's five tabs, all over
    again, with real risk of the two copies drifting apart. Embedding the
    real, live pages instead means: zero duplicated logic, zero risk of
    divergence, and each embedded page keeps its own full functionality
    exactly as it already works, including its own existing
    `initCloudSync(...)` call under its own existing Supabase `key`
    (`dreamboard`/`tasksnotes`/`aitech`/`selfcare`, all untouched — see
    §4). Each embedded panel also has an "Open full page ↗" link
    (`target="_blank"`) as an escape hatch, since an iframe is
    necessarily more cramped than the real page.
  - **One small, disclosed, non-destructive runtime tweak**: on load,
    each iframe gets a best-effort `<style>` injected into *its own*
    `contentDocument` (same-origin only, wrapped in try/catch — silently
    skipped if that ever fails, e.g. cross-origin) that hides `.topbar`
    inside that one embedded instance, so Home doesn't show two stacked
    nav bars. This does **not** touch `topbar.js` or any of the four
    embedded pages' own files on disk — it's a one-time DOM mutation
    scoped to the specific iframe document rendered inside Home, gone the
    moment that iframe reloads or Home is closed. If it ever silently
    fails, the only visible effect is the nested topbar staying visible
    — harmless, not a functional regression.
  - **Weekly Schedule** (new, native — `home-data.js`'s `ScheduleTasks`
    collection): a small database of recurring tasks, each with a
    Mon–Sun row of checkboxes, a progress bar, and a notes field, per the
    request's own wording. A task's `scheduledDays[]` (which weekdays it
    actually applies to — unscheduled days render as a dimmed,
    unclickable checkbox rather than being hidden, so the 7-day shape
    stays visually consistent across tasks) is set from a 7-chip toggle
    row in the Add/Edit modal. **Checkboxes reset automatically at the
    start of a new week**: each task carries a `checksWeekStart` stamp
    (that week's Monday date); `HomeData.resetStaleWeeks()` runs on every
    render of this tab and, for any task whose stamp doesn't match the
    real current Monday, clears its checks back to unchecked and updates
    the stamp — title/notes/scheduledDays are untouched, only the
    checkbox state is weekly-scoped. The progress bar is
    checked-days-÷-scheduled-days for the current week, computed fresh on
    every render, never stored. **"Filtered by day"** (the request's own
    phrase) is a chip row — All Days + one chip per weekday — that
    narrows the task list to only tasks scheduled on the selected day;
    composes with nothing else since this is the only filter dimension
    asked for. Reordering is up/down arrows (this app's standard
    swap-adjacent-`order`-values convention for non-drag lists, e.g. Life
    Areas/Workflow weeks — chosen over adding a SortableJS instance for
    one small list).
  - **Subconscious Reprogramming** (new, native — three more
    `home-data.js` collections), three sub-sections under one tab:
    - **Today's Ritual** — a small checklist (`RitualItems`) that resets
      every day (a `home:ritualDate` stamp, same reset-via-date-stamp
      mechanism as the Weekly Schedule's own weekly reset, just daily) —
      quick-add a step, check it off, delete it.
    - **Affirmations** (`Affirmations`) — a filterable gallery (category
      chips, a Favorites-only chip, search) with a "✓ Mark
      Practiced"/"✓ Practiced Today · N" button per card. Clicking it logs
      one practice rep for today via `HomeData.markAffirmationPracticed()`:
      the first rep of a new day advances the streak (continues it if
      yesterday was also practiced, else resets to 1) and raises the
      best-streak high-water mark; every additional rep the same day just
      increments today's count — the concrete "practice-streak counter"
      piece of "reprogramming the subconscious," since repetition is the
      actual mechanism most of these techniques rely on.
    - **Notes & Scripts** (`ReprogramSections`) — a freeform "+ Generate
      Section" list (editable title + autosizing body textarea, up/down
      reorder, delete), the same generated-on-demand-notes-section
      pattern `business.html`'s Platform Detail page already established
      — for visualization scripts, mantras, or sleep-programming notes,
      seeded with one example of each.
  - **Seeding, sync, and boot**, all following this app's already-
    established conventions rather than inventing new ones: `home-data.js`
    is the same `makeCollection`/model-factory shape as
    `aitech-data.js`/`business-data.js`; `home.html` calls
    `initCloudSync({ appKey: 'home', syncedPrefixes: ['home:'] })` (a
    brand-new `key`, since this page's own two new sections are genuinely
    new data with nowhere else to live — the four embedded pages'
    existing `key`s are never touched); seeding is deferred behind the
    same empty-storage seed-race-safety window as
    `dreamboard.html`/`business.html`/`aitech.html` (`maybeSeedAfterSync
    Attempt()`, only runs once the cloud pull has had a real 5-second
    window to answer, or immediately if the Supabase SDK never loaded);
    and the whole boot sequence is wrapped in `document.addEventListener
    ('DOMContentLoaded', boot)` (not run immediately at parse time) plus a
    `showBootErrorBanner()` safety net — both fixes for failure classes
    this app has hit for real before (`mainpillar.html`'s deferred-script
    load-order bug; `gym.html`'s `BOARD_WIDGET_TYPES` temporal-dead-zone
    crash) — applied here from the start instead of being discovered the
    same way a second time.
  - **Header, deliberately compact, not a full-viewport hero**: every
    other Dream-Board-family page's hero is 66–78vh; Home's header is a
    plain padded title block (editable eyebrow/title/subtext, no cover
    photo). This is a disclosed, deliberate divergence from that family
    look, not an oversight — `gym.html`'s own changelog already documents
    a real bug report ("the page looks blank") traced directly to a
    too-tall hero burying a data-heavy page's real content below the
    fold; Home sits six tabs deep with two of them holding real new
    functionality, so the same mistake was avoided from the start rather
    than shipped and fixed later.
  - **Palette**: this file's own `--hm-*` tokens are a direct copy of
    Dream Board/Business Hub's near-black/gold values — the "common
    thread" aesthetic shared by 3 of the 4 combined tabs (Dream Board,
    Tasks & Notes, and Self-Care all already use it; AI & Tech's teal is
    its own separate one-off exception, per CLAUDE.md §6) — same
    aesthetic-match reasoning Learning Hub's and Tasks & Notes' own
    changelog entries already used when making the identical call. No
    other page's tokens were touched (DO NOT MODIFY rule 2).
  - `topbar.js` gained one new pill (`HOME` → `home.html`, appended after
    `MAIN PILLAR` — the only edit made to that shared file, same
    one-line-addition precedent every prior page addition followed). No
    `MODAL_SELECTORS` edit was needed — Home's two modals use the plain
    `.modal-bg`/`.modal` classes already covered by that array.
  - **Verification, disclosed honestly**: this session had no way to
    launch an isolated, interactive headless-Edge/CDP session (no
    browser-automation tooling was available at all in this environment
    this round, not even the `--dump-dom`-only fallback several other
    entries in this file used when interactive CDP specifically was
    unavailable). Verified statically instead, the same reduced-guarantee
    fallback this file's own `dreamboard.html`/`aitech.html`/
    `learning.html`/`mainpillar.html` entries already disclose for this
    exact class of limitation: brace/paren/bracket balance confirmed on
    both new files (`home.html`'s inline script and `home-data.js` both
    balance to zero); zero duplicate DOM ids across all 35 element ids in
    `home.html`; and all 34 distinct `$('id')` references in the script
    cross-matched against real element ids with nothing unresolved. **Not
    verified this way**: an actual click-through (switching every tab and
    confirming the right iframe/panel shows, adding a schedule task and
    toggling its checkboxes, confirming a stale week's checkboxes reset,
    marking an affirmation practiced twice in one day vs. across two
    consecutive days to confirm the streak math, generating and editing a
    Notes & Scripts section, and confirming the iframe topbar-hiding
    tweak degrades harmlessly when it can't apply). A real click-through
    is recommended before relying on this page heavily.

- **Main (`index.html`), Main Pillar, Household, and Brain Dump removed
  entirely, per an explicit instruction.** Unlike the Home-tab merge below
  (which explicitly kept the four merged pages intact), this was a
  straight deletion, no data migration — same treatment as the earlier
  Stack/Water and Projects/Study removals: `index.html`,
  `mainpillar.html`+`mainpillar-data.js`, `household.html`+
  `household-data.js`, and `braindump.html` are all gone from the repo;
  their Supabase rows (`goals`/`mainpillar`/`household`/`braindump`) were
  left alone, now orphaned, not cleaned up (see §4).
  - **`index.html` was this app's root/default document** — the file a
    static host serves at the bare domain root with no path (this repo
    has no `vercel.json`/server config to redirect that — see §1). Its
    removal means the bare root URL no longer resolves to anything; this
    wasn't silently "fixed" by renaming another file to `index.html`,
    since that wasn't asked for. Flagging it here rather than glossing
    over it: anyone who had the site's root URL bookmarked (rather than
    `.../home.html` specifically) will need to update that bookmark.
  - **Every other page's "← Back" link, which pointed at `index.html`,
    was repointed to `home.html`** (10 files: `aitech.html`,
    `business.html`, `dreamboard.html`, `entertainment.html`,
    `example.html`, `finance.html`, `gym.html`, `learning.html`,
    `nutrition.html`, `selfcare.html`) — a direct, necessary consequence
    of deleting the page nearly every other page's back button pointed
    to, not a separate feature. `tasksnotes.html`'s own back button
    already pointed at `business.html`, not `index.html`, so it was left
    untouched. `gym.html`'s `checkOffRelatedHabit()` heuristic still
    reads `goals:habits`/`goals:habit-log:<date>` — now permanently
    empty/absent since nothing writes them anymore — this was left alone
    (a safe no-op read, `JSON.parse(null) || []`), same "orphaned read"
    treatment as `topbar.js`'s own already-dead `pushWaterMergedToSupabase`.
  - **`topbar.js`'s MAIN pill and everything that only ever existed to
    power its progress badge were removed together** — not just the
    pill markup, but `getGoalsProgress()`/`classifyStatus()`/
    `setPillStatus()`/`render()`/`activeDateKey()` and the now-fully-dead
    `.topbar-pill-count`/`.warn`/`.miss`/`@keyframes topbar-miss-pulse`
    CSS. This is a narrower exception to this app's usual "leave removed-
    feature code as unreachable dead code" precedent
    (`pushWaterMergedToSupabase`, the old `MODAL_SELECTORS` entries,
    etc.): those precedents protect code some *other*, unrelated pass
    left behind: this code existed for exactly one purpose (the MAIN
    pill's X/Y badge), which this exact edit was asked to delete, so
    there was no "someone else's leftover feature" to preserve — keeping
    it would just be dead weight with no future owner. Confirmed safe: no
    other pill ever used a count badge or `.warn`/`.miss` class, and
    `render()`'s own pre-existing guard (`if (!goalsEl) return;`) already
    made it a no-op the instant the pill's markup disappeared, so nothing
    could throw even before the cleanup — the cleanup itself just removes
    the now-pointless code, it isn't a bug fix.

- **Navigation (`topbar.js`) redesigned for aesthetics and usability on
  both desktop and phone**, alongside the removal above (fewer pills
  meant more room to make the row itself nicer, not just shorter).
  - **Desktop/tablet**: pills switched from `flex: 1 1 0` (stretching
    every pill to an equal-width slot, which squeezed labels as more
    pages were added over this app's history) to a centered, wrapping
    "chip cloud" (`flex: 0 0 auto`, `flex-wrap: wrap`, `justify-content:
    center`) — each pill sized to its own label, wrapping onto a second
    row gracefully on narrower widths instead of compressing.
  - **Icons replace the old decorative dot**: every pill's static green
    `.topbar-pill-dot` (confirmed, before removing it, that it was
    *always* purely decorative outside the now-deleted MAIN pill —
    `setPillStatus()` was only ever called on `topbarGoals`, so every
    other pill's dot never once changed color in this app's history) is
    replaced with a leading emoji icon matching that page's own theme
    (🏠 Home, 🏋️ Studio, 💰 Finance, 🎬 Media, 🍽️ Nutrition, 🌙 Self-Care,
    ✨ Dream Board, 💼 Business, 🤖 AI & Tech, 📚 Learning, ✅ Tasks &
    Notes) — a genuine "easier to use" improvement (icon + label scans
    faster than label alone) where the old dot carried no real signal.
  - **Active-pill indicator** upgraded from a flat background swap to a
    warm gold glow (`--tb-accent`/`--tb-accent-bright`, new custom
    properties scoped under `.topbar` only) — a soft gradient fill, a
    matching border, and a subtle box-shadow ring — reusing this app's
    own common near-black/gold accent (the aesthetic most pages already
    share, see §6) rather than inventing an unrelated color. `--good`/
    `--warn`/`--bad` semantic colors elsewhere in this app were untouched
    — this accent is scoped entirely to the topbar's own custom
    properties, not a global token.
  - **Elevation**: the bar gained a soft drop shadow (`box-shadow: 0 8px
    22px rgba(0,0,0,0.35)`) instead of just a 1px bottom border, reading
    as a distinct layer above the page content it scrolls over.
  - **Mobile** (now `<= 700px`, widened from `<= 480px` — an 11-pill chip
    cloud starts wrapping to an uncomfortable number of rows well before
    phone width): kept the established horizontally-scrolling single-row
    strip (a multi-row wrap eats too much vertical space on a narrow
    screen), with roomier touch targets (`padding: 11px 15px`, up from
    the tighter desktop value) and the same edge-fade/scroll-snap/
    auto-scroll-active-pill-into-view behavior as before.
  - `pushWaterMergedToSupabase`/`TOPBAR_SUPABASE_URL`/`TOPBAR_SUPABASE_KEY`
    and `startModalLock()`/`MODAL_SELECTORS`/the gesture-lock helpers are
    all untouched, per DO NOT MODIFY — this pass only touched the pill
    list/CSS and the now-dead goals-badge code described above.

- **Home (`home.html`) rebuilt: a real cover photo, restructured from a
  6-panel hidden-tab switcher into one continuous scrollable page, and
  Dream Board/Self-Care/Tasks & Notes/AI & Tech folded directly into it —
  all per an explicit instruction that none of those four pages' own data
  be touched, and that each keep existing as its own standalone page too
  ("just in case").** Two-thirds of this entry is a structural rebuild of
  what shipped in Home's first build (see that changelog entry above);
  the rest is genuinely new (the cover photo, the auto-resizing/lazy
  iframe mechanism, the quick-jump nav).
  - **Why the tab-switcher was replaced, not kept alongside the new
    sections**: the request's own wording — "add the Weekly Schedule and
    Subconscious Mind pages to the actual Home Tab, then merge [the four
    pages] into the Home Tab... make everything easier to scroll" — reads
    as "one combined page you scroll through," not "six hidden panels
    behind a click," which is what the first build actually was (a tab
    row toggling `display:none`). Replacing it is a same-session
    supersession of this exact feature's own first draft — the same
    precedent `gym.html`'s Timer modal→panel conversion and Dream Board's
    banner→hero conversion already established — so the old
    `switchTab()`/`renderTabs()`/hidden-`.hm-panel` mechanism and the
    `home:active_tab` key it used were removed outright, not kept as
    dead code (a device that already wrote `home:active_tab` keeps that
    orphaned key sitting unused in Supabase/localStorage, same treatment
    as every other superseded key elsewhere in this app).
  - **New page order, top to bottom**: cover-photo hero → Weekly Schedule
    → Subconscious Reprogramming → Dream Board (iframe) → Self-Care
    (iframe) → Tasks & Notes (iframe) → AI & Tech (iframe) — matching the
    exact order the request listed them in. A quick-jump nav (`.hm-jump-
    chip` row, styled like this app's existing chip components) sits
    between the hero and the first section — clicking a chip
    smooth-scrolls to that section (`scrollIntoView`) instead of
    switching a hidden panel, and an `IntersectionObserver`-driven
    scrollspy highlights whichever chip's section is currently in view
    as you scroll, so the "quick nav" and "just scroll" interaction
    models stay in sync with each other rather than competing. Every
    section carries `scroll-margin-top` so the sticky `topbar` never
    covers a section's own heading when jumped to. A small fixed
    "back to top" button appears after scrolling ~700px, since a
    long, scroll-first page benefits from a fast way back up with no
    tab-click to reset scroll position for you.
  - **Cover photo** (new `home:heroPhoto` key): click-to-upload when
    empty, Change/Remove tools once set — the same established upload/
    compress/hosted-URL pipeline every other page's cover photo already
    uses (`HD.compressImageDataUrl()`, newly exposed from `home-data.js`
    alongside `isValidMediaUrl()`, both copied from `aitech-data.js`'s
    identical originals; `photo-store.js` added to this page for the
    first time so the compressed image gets swapped for a tiny hosted
    URL shortly after upload, plus a one-time `migrateHeroPhotoToStorage()`
    backfill for any photo saved before that swap completed). **The hero
    is deliberately not a full 66–78vh hero** like Dream Board/Business
    Hub/AI & Tech/Learning Hub/Nutrition/Self-Care/Gym all use —
    `min-height: clamp(260px, 38vh, 440px)` instead. This is a disclosed,
    deliberate choice, not an oversight: `gym.html`'s own changelog
    already documents a real user report ("the page looks blank") traced
    directly to a too-tall hero burying a data-heavy page's real content
    below the fold, and Home is six sections deep with two of them
    holding real functionality — the same mistake was avoided from the
    start here rather than shipped and fixed later a second time.
  - **"Easier to scroll," concretely — auto-resizing iframes, so the page
    is one continuous scroll instead of nested scrollbars fighting each
    other**: each embedded page's iframe is measured (`doc.documentElement
    .scrollHeight`/`doc.body.scrollHeight`, same-origin access) and its
    own height is set to match exactly, via a `ResizeObserver` on the
    embedded document's `<body>` plus a handful of timed follow-up
    measurements (300ms–6s) to catch content that renders asynchronously
    after the iframe's `load` event (a cloud-sync pull applying, a seed
    timer firing) — both the `ResizeObserver` pass and the timed
    follow-ups matter, since an embedded page's real height often isn't
    settled the instant it loads. With the iframe sized to its own
    content, there's no internal overflow left to scroll inside — the
    whole embedded page becomes part of Home's single, ordinary page
    scroll. `scrolling="no"` is set defensively on each `<iframe>` too,
    though the auto-resize is what actually does the work.
  - **Lazy loading moved from "on tab click" to "on scroll into view"**:
    the previous build only ever loaded one iframe's `src` at a time (the
    active tab); since all four are now always in the DOM, each iframe's
    `data-src` is only assigned once its own section crosses an
    `IntersectionObserver` with a 500px `rootMargin` (starts loading
    shortly before it's actually visible, not the instant it enters the
    viewport) — so scrolling past Weekly Schedule/Subconscious Mind alone
    still costs nothing extra, and the four embedded pages' own Supabase
    Realtime subscriptions only spin up as each is actually reached, same
    performance reasoning as the original lazy-tab-load design, just
    keyed off scroll position instead of a click.
  - **The best-effort nested-topbar-hiding tweak from the first build is
    unchanged** (a runtime `<style>` injected into each iframe's own
    `contentDocument`, same-origin only, wrapped in try/catch, silently
    skipped if it ever fails) — still doesn't touch `topbar.js` or any of
    the four embedded pages' files on disk.
  - **Section headers unified**: every section (native or embedded) now
    uses the identical `.hm-section-head`/`<h2>` pattern — the embedded
    sections' old small "toolbar" label was replaced with a real `<h2>`
    matching Weekly Schedule's/Subconscious Mind's own headings, with the
    "Open full page ↗" link moved into that same header row — so the
    whole page reads as one consistent document instead of two visually
    different systems stitched together.
  - **Verification, disclosed honestly**: this session had no way to
    launch an isolated, interactive headless-Edge/CDP session (same
    limitation as this page's first build, described in that entry
    above). Verified statically: brace/paren/bracket balance confirmed on
    both `home.html`'s inline script and `home-data.js` (both balance to
    zero after every edit, re-checked after the final cleanup pass); zero
    duplicate DOM ids across all 49 element ids in `home.html`; all 42
    distinct `$('id')` references cross-matched against real element ids
    with nothing unresolved; open/close counts for every HTML tag used
    (`div`/`button`/`section`/`header`/`textarea`/`select`/`span`/`nav`/
    `a`/`iframe`) confirmed balanced. **Not verified this way**: an actual
    click-through (uploading a real cover photo, scrolling to confirm the
    scrollspy highlights the right chip, confirming an embedded iframe
    actually measures and resizes to its real content height instead of
    showing a blank gap or an internal scrollbar, confirming the
    back-to-top button appears/works, and re-confirming Weekly
    Schedule/Subconscious Mind's own behavior — unchanged from the first
    build, but worth re-confirming after being moved out of a hidden
    panel into an always-rendered section). A real click-through is
    recommended before relying on this page heavily.

- **Bugfix: reported as "Your file couldn't be accessed" — a real
  consequence of the Main/Main Pillar/Household/Brain Dump removal above,
  not a new bug.** `index.html` was this static site's root document (the
  file a host serves at the bare site URL with no path — this repo has no
  `vercel.json`/server config to redirect that, see §1); deleting it
  outright meant any bookmark or home-screen shortcut pointing at the bare
  root, or directly at `index.html`/`mainpillar.html`/`household.html`/
  `braindump.html`, now 404s instead of resolving — exactly the risk
  flagged (but not yet fixed) in that removal's own changelog entry above.
  - **Fix**: re-created all four filenames as tiny, functionality-free
    redirect stubs — a `<meta http-equiv="refresh" content="0;
    url=home.html">` plus `location.replace('home.html')` (works with JS
    disabled via the meta tag; the JS version avoids adding a history
    entry when it's available) and a plain "This page has moved" link as
    a no-JS/no-meta-refresh fallback. Each carries **no data, no
    functionality, and no nav pill** — the actual features are still
    fully gone, per the original request; these are pure "this moved, go
    here" breadcrumbs, the same purpose a real server's 301 redirect
    would serve if this repo had server-side routing (it doesn't — see
    §1, "no server-side rendering").
  - Deliberately not gated behind confirming exactly which of the four
    filenames the user actually hit — the fix is identical and equally
    low-risk for all four (a static redirect can't clobber data or
    resurrect a feature), so covering all four now was cheaper than a
    round-trip to ask which one, given the report's generic phrasing.

- **Correction: Main, Main Pillar, Household, and Brain Dump are back —
  "delete all of these Tabs" turned out to mean "fold them into Home
  too, the same way Dream Board/Self-Care/Tasks & Notes/AI & Tech were,"
  not a real deletion.** All four are real, live, standalone pages again
  (own nav pill, own data, own functionality, unchanged from before) —
  the redirect stubs from the entry above are gone, replaced with their
  actual content — **and** all four are now also embedded inside Home,
  alongside the original four, exactly the same way.
  - **A real near-miss, worth recording plainly**: `mainpillar.html` and
    `mainpillar-data.js` had never once been committed to git — they were
    sitting as uncommitted work from an earlier session for this entire
    conversation (confirmed via `git log --all -- mainpillar.html`,
    which returns nothing prior to this fix). Deleting them with a plain
    `rm` therefore didn't just remove a tracked file's working-copy
    contents (recoverable from git) — it deleted the *only* copy that
    existed anywhere, full stop. They were recovered anyway, but only
    because an earlier session had at some point run `git add` on them
    (even though that add was never followed by a commit), which left
    their contents sitting in git's object database as unreferenced
    ("dangling") blobs — objects git keeps around until `git gc`
    eventually prunes them, but doesn't surface anywhere in `git log`,
    `git status`, or normal diffing once nothing in the index or any
    commit points at them anymore. Recovered by running `git fsck
    --unreachable` (119 dangling blobs), grepping each one's raw content
    for a distinctive string (`MainPillarData`, `mainpillar:hunter`),
    and — since three separate HTML blobs matched, evidently different
    snapshots from across that earlier session's edits — diffing them
    against each other to identify the most-fixed/final one specifically
    (the one containing the `DOMContentLoaded` boot-order fix that
    `mainpillar.html`'s own original changelog entry describes as the
    last thing fixed before it shipped). Both recovered files were
    verified brace/paren/bracket-balanced before being trusted. **This
    was luck, not a safety net this app or this workflow actually
    has** — a `git gc` at any point in between would have made this
    permanent data loss with no recovery path at all. `index.html`,
    `household.html`/`household-data.js`, and `braindump.html`, by
    contrast, had all genuinely been committed before, so restoring them
    was a plain `git show <pre-deletion-commit>:<file>`, no luck involved.
  - **Every other page's "← Back" link, repointed from `index.html` to
    `home.html` in the deletion pass, was left pointing at `home.html`**
    — restoring the four pages didn't imply undoing that (Home is still
    the hub; nothing about the nav redesign or the back-link repointing
    was asked to be reverted). `household.html`'s and `mainpillar.html`'s
    own back buttons — which still pointed at `index.html` in their
    restored, pre-deletion content, since they'd never been touched by
    that repointing pass in the first place — were updated to
    `home.html` too, for the same consistency reason the other ten got
    updated the first time. `braindump.html` has no in-page back link at
    all (confirmed by grepping it for any `href="*.html"` — none exist;
    it relies purely on the shared topbar for navigation), so nothing
    needed changing there.
  - **`topbar.js`'s MAIN pill and its progress badge are back**, restored
    to their exact pre-deletion behavior (`getGoalsProgress()`/
    `classifyStatus()`/`setPillStatus()`/`render()`/`activeDateKey()`,
    the `storage`/`focus`/`visibilitychange` listeners, the 30s
    `setInterval` refresh) but re-skinned to fit the redesigned pill
    anatomy from the navigation-redesign entry above: the old version
    colored a plain status dot green/amber/red; since that dot no longer
    exists (replaced by a leading icon on every pill), `warn`/`miss`
    status now colors the pill's border and its count-badge digits
    instead — same status semantics, adapted home for them in the new
    design rather than reverting the redesign to make room for the old
    mechanism. All four pills got an icon matching the new scheme (🎯
    Main, 🧠 Brain Dump, 🧺 Household, 🎮 Main Pillar) and were reinserted
    into the row in their original relative order, with Home still
    leading it. `highlightActivePill()`'s bare-root-URL fallback was
    switched back from `'home.html'` to `'index.html'` — now that
    `index.html` is a real page again, it's genuinely what a static host
    serves at the bare site root, not Home.
  - **Home (`home.html`) gained four more embedded sections** — Main,
    Main Pillar, Household, and Brain Dump — appended after AI & Tech,
    in the same order the original request named them in, using the
    identical mechanism the first four already use (a lazy-loaded,
    auto-resizing same-origin iframe, added to the `SECTIONS` array that
    drives both the quick-jump nav and the scrollspy). No changes were
    needed to the embedding *mechanism* itself — `initEmbeds()`/
    `loadEmbedSection()`/`tameIframe()`/`autoResizeIframe()` all operate
    generically over every `.hm-section[data-embed="true"]`, so the four
    new sections picked up lazy-loading, topbar-hiding, and auto-resize
    for free. Home now embeds all eight other top-level pages, none of
    which had their own data/localStorage/Supabase sync touched by any
    of this — same "embed the real page, don't reimplement it" approach
    as the original four, now applied uniformly to all eight.
  - **Verification, disclosed honestly**: no interactive browser testing
    was available this round (same limitation as this feature's every
    prior entry). Verified statically: brace/paren/bracket balance
    confirmed on the two recovered files (`mainpillar.html`,
    `mainpillar-data.js`) and the three git-restored files (`index.html`,
    `household.html`, `braindump.html`) immediately after recovery, and
    again on `home.html`/`topbar.js` after every edit in this pass; zero
    duplicate DOM ids across `topbar.js`'s 17 element ids (15 pills + the
    header + the count span) and `home.html`'s 53; every remaining
    `href="index.html"`/`href="mainpillar.html"`/`href="household.html"`/
    `href="braindump.html"` reference in the repo was re-audited (none
    left pointing at anything broken); tag-balance (`div`/`button`/
    `section`/`iframe`/etc.) reconfirmed on `home.html` after adding the
    four new sections. **Not verified this way**: an actual click-through
    of all four restored pages (confirming they render and function
    exactly as before, especially `mainpillar.html`/`mainpillar-data.js`
    given they were reconstructed from a recovered blob rather than a
    normal git restore) and of Home's four new embedded sections. Given
    the recovery involved picking among multiple similar dangling blobs
    for `mainpillar.html`, a real click-through of that page specifically
    is worth prioritizing before relying on it heavily.

- **New page: `system.html` ("Build Your System"), implementing the
  "Build Your Own System" + "Identity Shifting" framework as seven
  genuinely separate, editable/adjustable databases (plus one single
  evolving record), built from a detailed written spec.** Genuinely new
  files, `system.html` + `system-data.js` — same conventions as
  `aitech.html`/`aitech-data.js` (model-factory + `makeCollection` CRUD,
  one localStorage key per collection, a shared `<page>:save` event so a
  failed write is never silent) — new nav pill (`SYSTEM` → `system.html`,
  appended after `MAIN PILLAR` in `topbar.js`'s injected pill list — the
  only edit made to `topbar.js`, same one-line-addition precedent every
  prior page addition followed); new sync key (`appKey: 'system'`,
  `syncedPrefixes: ['system:']`, wired via the standard shared
  `initCloudSync` — same call pattern as every other page, nothing new
  invented).
  - **Palette**: no reference photo/aesthetic instruction was given for
    this page, so per CLAUDE.md §6/DO NOT MODIFY rule 2 it stays on this
    app's actual standard palette (documented in §3) rather than adopting
    the Dream-Board-family gold theme several *other* newer pages have —
    near-black background, off-white text, the existing `--good`/`--warn`/
    `--bad`/`--info` semantic accents, `--accent` repointed to `--info`'s
    own value rather than a new hue, the same call `household.html`'s and
    `selfcare.html`'s original builds made for the same reason. No cover
    photo/hero — a plain text header (eyebrow/title/subtext) plus a live
    "The One Goal" banner, kept deliberately simple since no photo/upload
    capability was asked for and this page has no gallery-style content
    that would need one.
  - **Four tabs**, hash-routed + `system:active_tab`-persisted (same
    `location.hash` / `localStorage` fallback pattern `household.html`
    established): **Top Goals** (Steps 01–02) — `Goals` (`{title, notes,
    isPrimary, order}`), a plain CRUD list with up/down reorder (this
    app's standard non-drag-list convention — Life Areas, Workflow weeks,
    etc.) and a ★ toggle that flags exactly one goal as "The One Goal"
    (`setPrimaryGoal()` maps over every goal and clears the flag on all but
    the chosen one in a single write — the same "exactly one active at a
    time" shape this app already uses for e.g. a page's active tab).
    **Your System** (Steps 03–04) — `Actions`
    (`{goalId, title, frequency:'daily'|'weekly', mva, notes,
    scheduledDays[], checks{}, checksWeekStart, totalCompletions, order}`),
    grouped into Daily/Weekly sections, each new action defaults its
    `goalId` to the current primary goal. The Minimum Viable Action is a
    plain per-action text field with its own callout box quoting the
    spec's own worst-day framing and examples. **Three Core Systems** — an
    in-tab sub-chip nav (Written/Visual/Mental, plain JS toggle, not a
    second hash level): *Written* is a live, read-only recap (Goals +
    Daily actions + Weekly actions, computed fresh from the other tabs'
    own data so it can never drift) plus an editable **Processes** database
    (`{title, description}` — a named, freeform multi-step routine,
    deliberately distinct from an individual Action per the spec's own
    "Repeatable processes" wording); *Visual* is a real, live Mon–Sun
    completion tracker over every Action (the same grid component
    `buildWeekGrid()` is shared with the Your System tab's own action
    cards — one implementation, two render sites, so checking a box in
    either place updates the same underlying data) plus an editable
    **Visual Tools** database (`{type: Whiteboard|Habit Tracker|
    Calendar|Scoreboard|Other, title, description}`); *Mental* is a
    category-filterable **Mental Entries** database (`{category:
    Identity|Self-Talk|Journaling|Mindset|Removing Friction, title,
    body}`). **Identity Shifting** — its own in-tab sub-chip nav
    (Anchors/Vision/Challenges): **Identity Anchors** (`{belief, reframe,
    active}`) — a CRUD list of limiting beliefs with an Active/Retired
    toggle; **Future Self Vision** — a single evolving record (same
    get/save-one-record shape as `aitech-data.js`'s hero, not date-keyed,
    since it's meant to be revisited and refined) with one autosaving
    field per guided question from the spec (who you're surrounded by,
    how you carry yourself, schedule, work, hobbies, what others say, free
    time) plus a visually distinguished "Most Powerful Question" field
    ("What do I really want that I'm too afraid to admit?") carrying the
    spec's own "don't write what sounds impressive" guidance as inline
    hint text; **Challenges** (`{anchorId, title, action, frequency,
    status: not-started|in-progress|done}`) — optionally linked to an
    Anchor via a nullable `anchorId`, with a click-to-cycle status pill
    (`nextChallengeStatus()`) instead of a dropdown for the common case.
  - **Null-out-the-reference on delete, not cascade-delete**: deleting a
    Goal nulls `Action.goalId` on any action that pointed at it rather
    than deleting those actions; deleting an Anchor nulls
    `Challenge.anchorId` the same way — same precedent `aitech-data.js`'s
    model deletion, `household-data.js`'s legion deletion, and
    `business-data.js`'s week/day deletion already established.
  - **Weekly reset mechanism** (`resetStaleWeeks()`, `checksWeekStart`) is
    the same Monday-stamp-and-clear pattern `home.html`'s Weekly Schedule
    already established for its own per-task Mon–Sun checkboxes — reused
    here rather than inventing a second version, since it's the exact
    same "editable per-weekday checklist that resets each week" shape.
    `totalCompletions` (incremented/decremented in lockstep with each
    checkbox flip) is a small always-available lifetime tally, a
    deliberately simpler stand-in for a full multi-week streak
    computation (which `index.html`'s/`mainpillar.html`'s own habit
    systems do implement, by walking date-keyed logs day-by-day) — this
    page's actions aren't date-keyed, only week-keyed, so that richer
    streak math doesn't apply the same way; flagged here as a disclosed
    scope simplification rather than silently built as something it
    isn't.
  - **Reorder is up/down arrows everywhere, not drag** — no SortableJS
    dependency was added for this page, since every list here is a plain
    vertical stack (no gallery/board grid), and up/down arrows are this
    app's own established convention for exactly that list shape (Life
    Areas, Workflow weeks/days, Overview notes, etc.).
  - **Boot sequence** wrapped in a `showBootErrorBanner()` safety net
    (a fixed, high-contrast banner showing the real error instead of a
    silent blank page) from the start, plus the same empty-storage
    seed-race-safety window as `dreamboard.html`/`business.html`/
    `aitech.html` (`maybeSeedAfterSyncAttempt()`, deferred until either
    real cloud data arrives via `onApplied` or a 5-second window elapses)
    — both fixes for failure classes this app has hit for real before
    (`gym.html`'s `BOARD_WIDGET_TYPES` temporal-dead-zone crash;
    `dreamboard.html`'s empty-device seed-vs-pull race), applied here from
    the start instead of being discovered the same way a second time.
  - **Testing note, disclosed rather than glossed over**: no interactive
    browser testing was available this session (no `node`/`python` runtime
    and no live CDP session reachable in this environment this round).
    Verified statically instead: brace/paren balance confirmed on both new
    files (`system-data.js`: 158/158 braces, 308/308 parens; `system.html`'s
    inline script: 219/219 braces, 1092/1092 parens; its `<style>` block:
    128/128 braces); every `$('id')` reference in the script (98 distinct)
    cross-matched against the HTML's real element ids (101 distinct) with
    zero unresolved — the 3 unmatched ids (`bsTabs`, `bsCoreSubnav`,
    `bsIdentitySubnav`) are queried via `querySelectorAll` for their child
    buttons, not `$()`, so that's expected, not a gap; zero duplicate DOM
    ids anywhere in the file. This is a weaker guarantee than an actual
    click-through, same disclosed caveat this file's own `dreamboard.html`/
    `aitech.html`/`learning.html`/`mainpillar.html` entries already carry
    for this exact class of environment limitation — a real click-through
    (adding a goal and starring it as The One, adding a daily and a weekly
    action with an MVA, checking off a few tracker cells on both the Your
    System and Visual tabs and confirming they stay in sync, adding a
    Process/Visual Tool/Mental Entry, filling in the Future Self Vision
    fields and confirming they autosave and persist on reload, adding an
    Anchor and a linked Challenge and cycling its status) is recommended
    before relying on this page heavily.

- **Build Your System (`system.html`) follow-up: Top Goals now supports
  selecting up to 3 at once (was 1), Identity Shifting's three subpages
  each gained an editable Reflection Prompts + copy-ready AI Prompts
  database, and every one of the 8 tabs/subpages gained its own "+
  Generate Notes Section" notes database pinned to the top.** Three
  changes landed together per an explicit follow-up request.
  - **Top Goals, up to 3 at once**: `Goal.isPrimary` (exactly one active)
    is replaced by `Goal.isSelected` plus a new `MAX_SELECTED_GOALS = 3`
    cap — `system-data.js`'s `goalModel()` reads `isSelected` if present,
    falling back to the legacy `isPrimary` value otherwise, so anything
    already saved under the original single-goal shape carries forward
    without a separate migration pass. New `toggleGoalSelected(id)`
    (returns `{ok:false, reason:'limit'}` instead of silently no-opping
    once 3 are already selected — `system.html`'s star-button handler
    alerts the user rather than failing silently) and `setGoalSelected(id,
    selected)` (same cap, used by the Add/Edit Goal modal's checkbox — now
    labeled "Include in your Top Goals selection (max 3)," `#bsGoalSelectedInput`,
    renamed from `#bsGoalPrimaryInput`) replace `setPrimaryGoal()`
    entirely. `primaryGoal()` → `selectedGoalsSorted()` (returns every
    currently-selected goal, not just one) and `selectedGoalCount()`.
    Every call site that assumed a single "The One Goal" was updated: the
    header banner (`renderSelectedGoalsBanner()`, still `#bsPrimaryBanner`
    — kept the element id since renaming it wasn't load-bearing — now
    lists up to 3 titles joined with "•", or the empty-state prompt if
    none are selected yet), a new "Selected X/3" counter under the Top
    Goals section header (turns amber via `.is-full` once at the cap), the
    Your System tab's goal `<select>` (label suffix changed from " (The
    One)" to " ★"), a new Action's default `goalId` (now the *first*
    selected goal rather than the sole primary one — same "pick the first
    of N" simplification this app's own Business Hub Content-tab
    "Today's Goal" default already uses in spirit), and the Written
    System recap's "★ " prefix (now driven by `isSelected`).
  - **Identity Prompts** (`system:identityPrompts`, new collection,
    `{section: anchors|vision|challenges, kind: prompt|ai, text, order}`)
    — two genuinely separate, independently-orderable lists per Identity
    Shifting subpage: **Reflection Prompts** (plain guiding questions) and
    **AI Prompts** (copy-ready text meant to be pasted into an AI chat —
    same "copy-to-clipboard, not a live API call" convention as
    `aitech.html`'s own Prompts database; this app still has no active LLM
    key anywhere, per CLAUDE.md §1/§2). Each row is a single inline text
    input (autosaves on blur, no modal — deliberately lighter-weight than
    every other CRUD database on this page, since a prompt is realistically
    one line), with up/down reorder, delete, and — AI Prompts only — a 📋
    copy button (`navigator.clipboard.writeText`, same brief "✓ copied"
    flash this app's other copy buttons already use). A quick-add text
    input (type + Enter, no button) sits at the bottom of each list.
    Seeded with 2 reflection prompts + 1 AI prompt per subpage, written to
    match that subpage's own framework text (e.g. Anchors' AI prompt asks
    for 5 limiting beliefs + reframes; Vision's asks for one-at-a-time
    guided journaling questions; Challenges' asks for 10 belief-
    contradicting actions ranked easiest-to-hardest).
  - **Page Notes** (`system:pageNotes`, new collection, `{page: one of 8
    tab/subpage keys, title, body, order}`) — a "+ Generate Notes Section"
    button (this app's existing add-a-blank-editable-section vocabulary,
    per `index.html`'s Overview notes / `business.html`'s Platform Detail
    sections — explicitly *not* AI generation, flagged the same way
    CLAUDE.md's own Writing Dashboard section already flags this exact
    phrase) sits at the very top of every one of the 8 tabs/subpages (Top
    Goals, Your System, Written, Visual, Mental, Anchors, Vision,
    Challenges) — above all other content on that page, per the request's
    own "appear at the top" wording. Each note is an editable title
    (plain input, autosaves on blur) + an autosizing textarea body
    (autosaves on blur, grows with content via a new shared `autosize()`
    helper), with up/down reorder and delete. "Aesthetic" was read as
    "styled to match the rest of the page" — reuses the existing
    `.bs-card` chassis with transparent-background title/body fields
    rather than introducing a new visual system (no per-note color
    tinting or cover photo, unlike Dream Board's richer widget-board
    engine — a deliberate scope match to how lightweight every other
    piece of this page already is, not an oversight). Seeded with one
    real note on the Top Goals page; the other 7 start empty (visible
    only via the "+ Generate Notes Section" button), consistent with this
    app's own precedent that a freshly-added section-generator feature
    doesn't need to start pre-filled everywhere to prove it works.
  - **Wiring**: `renderAllNotes()`/`renderAllPrompts()` (new, iterate the
    8-page / 3-section lookup tables and re-render each block) are called
    from `boot()`'s initial render pass and from `renderAllPanels()` (so
    Reset-to-Default and an incoming cloud-sync `onApplied` both refresh
    every notes/prompts block, not just the tab currently in view) — same
    "render everything once, each block's own mutation handlers refresh
    just themselves" pattern already used for Goals/Actions/etc. on this
    page. `isEmptyEverywhere()` (the empty-storage seed-race-safety check)
    was extended to also check `PageNotes`/`IdentityPrompts`, so a device
    with only page notes/prompts already saved isn't mistaken for empty
    and re-seeded over.
  - **Testing note**: same environment limitation as this page's first
    build — no interactive browser session was available this round
    either. Verified statically: brace/paren balance re-confirmed on both
    files after every edit (`system-data.js`: 187/187 braces, 372/372
    parens; `system.html`'s script: 260/260 braces, 1264/1264 parens; its
    `<style>` block: 148/148 braces); every `$('id')` reference (99
    distinct) cross-matched against real HTML ids (113 distinct) with zero
    unresolved — the 14 unmatched ids are the `bsTabs`/`bsCoreSubnav`/
    `bsIdentitySubnav` subnav containers (queried via `querySelectorAll`,
    as before) plus the 8 new notes containers and 3 new prompts
    containers, all of which are looked up dynamically through the new
    `NOTES_PAGE_IDS`/`PROMPTS_SECTION_IDS` tables rather than a literal
    `$('id')` call — cross-checked by hand that every table value matches
    a real container id, all 11 did; zero duplicate DOM ids; every HTML
    tag type (div/button/select/textarea/span/label/input) confirmed
    open/close-balanced across the whole file. A real click-through
    (selecting a 3rd, then attempting a 4th goal and confirming the cap
    alert fires; deselecting one and confirming a 4th can then be added;
    adding/copying an AI Prompt; generating and editing a Notes section on
    a couple of different pages and confirming each stays scoped to its
    own page after a reload) is recommended before relying on this page
    heavily.

- **Build Your System (`system.html`) re-themed to match Main's
  (`index.html`) near-black/warm-gold, frosted-glass-card aesthetic**, per
  an explicit follow-up request. Pure CSS/typography pass — no HTML
  structure, JS, or data model changed; every one of the seven databases
  plus the Vision record, the 4-tab/6-subpage layout, the up-to-3-goal
  selection, the Notes blocks, and the Identity Prompts/AI Prompts all
  work exactly as before. This supersedes the original build's own
  "no reference photo/aesthetic instruction was given, so stays on the
  app's standard palette" call (CLAUDE.md §6/DO NOT MODIFY rule 2 exists
  for exactly this — silence isn't permission for a *new* palette, but an
  *explicit* instruction is, and this request is explicit and named
  Main specifically).
  - **Palette repointed, same token names**: `--bg`/`--bg-deep`/
    `--bg-card`/`--text-primary`/`--text-secondary`/`--text-tertiary`/
    `--border`/`--accent`/`--accent-tint` all kept their existing *names*
    (so every rule already referencing them needed no further edits) with
    values switched from the original near-black/off-white/info-blue
    recipe to Main's actual `--rt-bg`/`--rt-gold`/`--rt-text` values byte-
    for-byte (`#0b0a08`/`#050403` background, `#c9a876`/`#e8cf9f` gold,
    `#f5f1e9`-family text, `rgba(201,168,118,…)` hairline borders/tints) —
    the same "repoint an existing token's value instead of inventing a
    new one" precedent `household.html`'s/`aitech.html`'s own re-themes
    already established. Two new tokens were added rather than reusing
    existing ones for a genuinely new need: `--accent-bright` (the
    lighter gold, for gradient tops/active-state text — Main's own
    `--rt-gold-bright`) and `--accent-text` (`#24190c`, the dark text
    color that sits *on* a gold-filled button/pill, matching Main's own
    literal `#24190c` value used the same way). `--good`/`--warn`/`--bad`/
    `--info` were left exactly as they were (green/amber/red-coral/blue)
    — status meaning, not brand accent, the same "don't recolor semantic
    tokens for an aesthetic pass" precedent every other re-theme in this
    app already follows, and matches Main's own `--rt-good`/`--rt-warn`/
    `--rt-bad`/`--rt-info` being the identical hex values, untouched.
    Cormorant Garamond was loaded via the same Google Fonts `<link>` every
    other page in this family already uses, applied to the page's big
    title, every section title, and modal headers — matching Main's own
    serif treatment on `.rt-hero-title`/`.rt-modal-head h3` — while body
    copy, labels, and buttons stayed on the existing sans-serif `--font`,
    same split Main itself uses (serif reserved for prominent display
    type only, not applied everywhere).
  - **Seven hardcoded blue literals** (`rgba(125,211,252,…)`, left over
    from the original info-blue accent — used directly rather than
    through `var(--accent)` in a handful of border-color declarations,
    so simply repointing the CSS variable didn't reach them) were swept
    to their gold equivalents by hand: the header's "selected goals"
    banner border, the active Core-Systems/Identity-Shifting sub-chip
    border, the "DAILY" action tag border, the Future Self Vision "most
    powerful question" field's highlighted border, the active filter-chip
    border (Mental System's category chips), and the active weekday-toggle
    border (the Action modal's scheduled-days picker). Confirmed swept
    with a repo-local regex scan afterward — zero remaining occurrences.
  - **Component chrome**: `.bs-card` (every list-row card across all
    seven databases) gained the same frosted-glass recipe as Main's own
    `.rt-card`/this app's Dream-Board-family `.dw-card` (`backdrop-filter:
    blur(16px) saturate(1.4)` over a translucent white fill, an inset
    top-edge highlight) in place of its original flat `var(--bg-card)`
    fill; `.modal`/`.modal-bg` got the identical treatment matching
    Main's own `.modal` (`backdrop-filter: blur(24px) saturate(1.4)`,
    `rgba(20,17,13,0.82)` fill). `.bs-btn-primary` switched from a plain
    white gradient to Main's exact gold-gradient-with-dark-text recipe
    (`linear-gradient(180deg, var(--accent-bright) 0%, var(--accent)
    100%)`, `color: var(--accent-text)`). The page-wide ambient
    `body::before` background glow was recolored from blue-tinted to
    gold-tinted, matching the hue of Main's own `#rtPageBg`/ambient-glow
    layers.
  - **A real latent bug fixed in passing, not introduced by this pass**:
    `body::before` was originally `z-index: -2` (a negative value) —
    this exact app has a documented incident (`example.html`'s own
    changelog entry) where a `position: fixed` layer with a *negative*
    z-index silently fails to paint at all once `html`/`body` also
    declare an explicit background color, which both `html, body` here
    already do. Since Main's own equivalent layer (`#rtPageBg`) already
    carries a code comment explaining exactly this and uses `z-index: 0`
    plus DOM order instead, this page's `body::before` was switched to
    the same `z-index: 0` (with `.shell` gaining an explicit `z-index: 1`
    to guarantee it stacks above, matching Main's own `.wrap{z-index:1}`)
    while re-theming it anyway — the same fix, applied here proactively
    rather than waiting for a report of "the background doesn't show."
  - **Deliberately not changed**: the 4-tab / 6-subpage structure (Top
    Goals / Your System / Core Systems[Written/Visual/Mental] / Identity
    Shifting[Anchors/Vision/Challenges]) was kept as-is rather than
    restructured into Main's own single continuous 2-column card-grid
    layout — "aesthetic" was read as palette/typography/component chrome,
    not information architecture, and this page's own tabbed structure
    already matches the established precedent of this app's other
    multi-database pages in the same visual family (`aitech.html`,
    `learning.html`, `tasksnotes.html`), none of which mirror Main's
    single-page card-grid layout either. No cover photo/hero-photo-upload
    capability was added (Main's hero has one, this page's plain-text
    header doesn't) — that's a feature addition, not an aesthetic
    property, and wasn't asked for.
  - **Verified statically** (no interactive browser session was available
    this round either, same disclosed limitation as this page's prior two
    entries): `<style>` block braces re-balanced (149/149) after every
    edit; the inline script's own braces/parens were re-confirmed
    unchanged (260/260, 1264/1264 — no JS was touched this pass); every
    HTML tag type re-confirmed open/close-balanced; a regex sweep
    confirmed zero remaining `rgba(125,211,252,…)` occurrences anywhere in
    the file. A real visual check (does the frosted-glass blur actually
    render, does the serif font load, does the gold gradient button read
    correctly against the new dark background) is recommended before
    relying on the look of this page.

- **Build Your System (`system.html`) gained a real cover-photo hero**,
  per an explicit follow-up asking for "the cover photo design" — the
  plain text header (eyebrow/title/subtext as static markup) is replaced
  with the same upload-a-cover-photo hero mechanism `aitech.html`'s/
  `index.html`'s own heroes already use: an optional uploaded photo with
  a legibility gradient overlay, editable eyebrow/title/subtext on top,
  Change/Remove tools once a photo is set, and a page-wide blurred
  backdrop (`#bsPageBg`) keyed to the same photo, matching `index.html`'s
  own `#rtPageBg`. Nothing else on the page changed — same seven
  databases, same 4 tabs/6 subpages, same up-to-3-goal selection, same
  Notes/Prompts blocks, all untouched.
  - **Data**: `system-data.js` gained a `hero` record (`{eyebrow, title,
    subtext, ctaLabel, photo, photoColor}`, `KEYS.hero = 'system:hero'`),
    `getHero()`/`saveHero()` (get/save-a-single-record shape, same as
    `aitech-data.js`'s hero), and `compressImageDataUrl()` (the same
    canvas-downscale-before-storage recipe every other page's cover photo
    already uses). `photoColor` is carried on the model but not actively
    used — same vestigial-but-shape-consistent field `aitech-data.js`'s
    own hero already has (never populated there either). Already covered
    by the existing `initCloudSync({ syncedPrefixes: ['system:'] })`
    call — no new sync key, no `sync.js` change.
  - **Sensible defaults baked into the model, not left blank**:
    `heroModel()`'s defaults are this page's own original static copy
    ("Build Your Own System" / "Dreams become measurable." / the original
    subtext sentence) rather than empty strings — so the header reads
    correctly the instant the page loads, even before the empty-storage
    seed-race-safety window's first sync/seed pass has had a chance to
    run, the same problem this app's other hero-bearing pages don't have
    to solve since they only ever showed a "+ Add a cover photo" empty
    state pre-seed, not real body copy. `seedDefaultData()` (Reset to
    Default) clears the hero back to these defaults via `storeSet(KEYS.hero,
    null)`, so a customized hero is also reset along with everything else.
  - **Upload pipeline**: `photo-store.js` was added to this page for the
    first time (`<script src="photo-store.js" defer>`) — the compressed
    photo is saved locally immediately (`compressImageDataUrl(…, 1100,
    0.78)`, the same "wide hero" preset `aitech.html`'s own hero uses),
    then swapped for a tiny Supabase-Storage-hosted URL once the upload
    settles, same two-step pattern as every other page's cover photo in
    this app (see the earlier `photo-store.js` changelog entry on why —
    keeps this page's own localStorage footprint from growing the way
    embedded base64 images otherwise would). A `migratePhotosToStorage()`
    one-time backfill (guarded by a `system:photosMigratedV1` flag, called
    from a 3s `setTimeout` at boot) catches a hero photo saved before the
    upload finished on a prior session.
  - **Deliberately modest hero height** (`min-height: 300px`, not a
    full-viewport hero like Dream Board's or the ~78vh figure Main's own
    hero briefly used) — this app has a documented real bug report
    (`gym.html`'s own changelog: a near-full-viewport hero with no photo
    set reads as "the page is blank") traced directly to an oversized
    hero burying a data-heavy page's real content below the fold; since
    this page is a dense, tab-based multi-database tool (not a vision-
    board landing page), the same mistake was avoided from the start
    rather than shipped and fixed later a second time.
  - **The back button and the "Selected Goals" banner both moved inside
    the hero** (the back button now floats over the photo, frosted-glass
    style, same `position: absolute` treatment as every other hero's back
    button in this app; the goals banner sits inside `.bs-hero-content`
    below the subtext, with its own translucent/blurred fill so it stays
    legible over an arbitrary photo) — both were previously plain page
    elements above/below a static header; neither was deleted or had its
    own behavior changed, only repositioned.
  - **Verified statically** (no interactive browser session was available
    this round either, same disclosed limitation as this page's prior
    entries): `<style>` block braces re-balanced (162/162); the inline
    script's braces/parens re-balanced (305/305, 1378/1378); every
    `$('id')` reference (110 distinct) cross-matched against real HTML ids
    (126 distinct) with zero unresolved — the newly-unmatched ids
    (`bsHero`, `bsHeroMedia`) are pure container elements never queried
    directly, same expected-unused category as the page's existing
    Notes/Prompts containers; zero duplicate DOM ids; every HTML tag type
    (including the new `<header>`/`<img>`/`<a>` in the hero) confirmed
    open/close-balanced, with `<img>` correctly counted as a legitimate
    unclosed void element. A real click-through (uploading a photo,
    confirming the page-wide backdrop and Change/Remove tools appear,
    editing the eyebrow/title/subtext and confirming they persist on
    reload, confirming Reset to Default clears a customized hero back to
    the original copy) is recommended before relying on this feature.

- **Bugfix: "+ Add a cover photo" on Build Your System silently did
  nothing.** `<script src="system-data.js" defer>` had no cache-busting
  query string — the same class of bug this app has hit and fixed
  several times before on other pages' companion `-data.js` files
  (`business-data.js`, `learning-data.js`; see those changelog entries):
  editing a script's *contents* never changes its *URL*, so a browser
  that had already cached `system-data.js` from the previous push (before
  this session added `getHero`/`saveHero`/`compressImageDataUrl` to it)
  had no signal to refetch it — `system.html` itself reloads fine (it
  already carries the standard no-cache meta tags), but the *companion
  data file* silently kept serving the older copy, leaving
  `DB.compressImageDataUrl` undefined. Clicking "+ Add a cover photo"
  still opened the OS file picker (that part doesn't touch `DB` at all),
  but selecting a photo then hit `DB.compressImageDataUrl(...)` as a
  `TypeError: ... is not a function` inside a `FileReader.onload`
  callback — an uncaught exception there fails silently in most browsers
  (logged to the console, nothing shown to the user), which is exactly
  "nothing happens" from the user's side.
  - Fixed by bumping the script reference to `system-data.js?v=2` (this
    repo's own established mitigation for this exact bug class).
  - Also hardened `handleHeroPhotoFile()` so the *next* failure of any
    kind is visible instead of silent, rather than only fixing this one
    instance: an explicit `typeof DB.compressImageDataUrl !== 'function'`
    guard shows a clear "try a hard refresh" alert if a stale cache is
    still in play, and the compress/save/upload chain is now wrapped in
    try/catch plus a `.catch()` on the promise, each surfacing the real
    error via `alert()` instead of swallowing it — matching this app's
    own precedent (`gym.html`'s boot-error banner) of making a silent
    failure diagnosable the first time it's reported, not guessed at
    repeatedly.
  - **Verified statically** (same disclosed environment limitation as
    every other entry for this page): script braces/parens re-balanced
    (310/310, 1391/1391) after the edit. **Not verified live** — if a
    hard refresh doesn't resolve it, the new alert text will surface the
    actual underlying error on the next report instead of another blind
    guess.

- **Build Your System: re-diagnosed the recurring "cover photo won't add"
  report, matched the hero's readability to Main, and built a genuinely
  new capability — the page's accent color now recolors itself from the
  cover photo.** The previous entry's fix (`system-data.js?v=2` + a
  visible alert on failure) was re-verified this pass, not assumed: a
  same-origin iframe test harness (this repo's own established
  `_test_harness.html`-style technique — `--allow-file-access-from-files`,
  a real `DataTransfer`-based file selection dispatched at the actual
  `#bsHeroPhotoInput`, not just a code read-through) confirmed the whole
  upload → compress → save → render chain already completes correctly
  with zero JS errors in a clean profile. Since the code itself checks
  out, the most likely remaining explanation is this app's own repeatedly-
  documented failure mode elsewhere (`business.html`'s/`gym.html`'s own
  "still not showing up" entries) — a stale cached copy of the page on the
  reporting device, which a meta no-cache tag can reduce but can't
  fully rule out from here (see those entries' own disclosed caveat). A
  hard refresh is the next troubleshooting step if it recurs.
  - **Readability, matched literally to `index.html`'s own hero**: the
    eyebrow letter-spacing (0.24em → 0.28em), title `clamp()` range
    (26–40px → Main's actual 30–46px) and line-height (1.1 → 1.08), and
    subtext font-size (14px → 14.5px) are now byte-identical to
    `.rt-hero-eyebrow`/`.rt-hero-title`/`.rt-hero-subtext`. Beyond pure
    parity, the hero overlay gradient was also strengthened (0.12/0.6/0.9
    → 0.22/0.68/0.93 across its three stops) and the eyebrow/title/
    subtext all gained a subtle `text-shadow` — insurance this page
    specifically needs and Main's own hero doesn't (yet): a user-uploaded
    cover photo can be bright anywhere in frame, unlike Main's hero, which
    has never been given one to test against.
  - **The actual new feature — "the page changes colors depending on the
    cover photo"**: this didn't exist anywhere in this app before, despite
    the visual similarity to Dream Board's `photoColor`/
    `extractDominantColor()` — every other page that samples a cover
    photo's color only ever offers it as an opt-in *per-widget* "match
    this cover photo" tint swatch (`selfcare.html`/`nutrition.html`/
    `dreamboard.html`'s own board-widget tint popover); none of them
    auto-recolor the page itself. Built new: `extractDominantColor()`
    (copied verbatim from `dreamboard.html`'s own cheap 32×32-canvas
    average-RGB sampler) feeds `computeAccentFromPhotoColor()` (new), which
    converts the sampled hex to HSL and clamps saturation to 32–62% and
    lightness to 52–68% (68–86% for the "bright" variant) — a legible
    band against this page's near-black background regardless of the
    source photo's own actual tone — then `applyPageAccent()` (new, called
    from `renderHero()` on every render) writes the result straight onto
    `document.documentElement.style` as `--accent`/`--accent-bright`/
    `--accent-rgb`, or clears all three (falling back to the stylesheet's
    default gold) when there's no photo. **A near-grayscale photo
    deliberately does not override the accent** (bails out below 8%
    saturation) — a "dominant hue" sampled from a colorless image is
    essentially arbitrary and would read as a stray bug, not an
    intentional theme change. A new `--accent-rgb` custom property (the
    r,g,b triplet backing `--accent`'s hex, since CSS itself can't convert
    hex→rgb) replaces every hardcoded `rgba(201,168,118,X)` literal in the
    stylesheet (`--border`, `--accent-tint`, the ambient `body::before`
    glow, the hero's own background gradient, `.bs-primary-banner`,
    `.bs-tag.is-accent`, `.bs-vision-field.is-power`) with
    `rgba(var(--accent-rgb),X)` — so the *entire* page's gold accents
    (buttons, borders, active tabs/chips, the ambient background wash,
    not just the hero) genuinely shift together, not just one isolated
    swatch. A one-time backfill in `boot()` samples the color for any
    hero photo saved before this feature existed (nothing to migrate in
    `system-data.js` itself — `photoColor` was already a shape-consistent,
    just previously-unpopulated field on the hero model, same as
    `aitech-data.js`'s own hero).
  - **Verified end-to-end via the same iframe harness**: uploading a
    strongly blue swatch (`#1560ff`) correctly recolored `--accent`/
    `--accent-bright`/`--accent-rgb` to a clamped, legible blue
    (`#4270d3`/`#7c9ce0`); uploading a perfectly desaturated gray swatch
    correctly left both variables empty (falling back to the default
    gold, confirming the grayscale-bailout rule); clicking "Remove"
    correctly reset both back to empty and returned the hero to its
    "+ Add a cover photo" empty state; zero JS errors across the whole
    pass. `system-data.js` was not touched (no version bump needed) —
    every change lives in `system.html`'s own CSS and inline script.

- **Bugfix: "+ Add a cover photo" was genuinely unclickable, sitting
  visually behind the hero title — a real regression from the previous
  entry's own readability pass, not a caching issue this time.** Found by
  measurement, not a guess: the previous session's synthetic test called
  `.click()` directly on the button element, which bypasses real hit-
  testing entirely and cannot detect "something else is covering it" —
  this pass instead measured actual `getBoundingClientRect()`s and used
  `document.elementFromPoint()` at the button's own rendered coordinates,
  the same thing a real mouse click does. That confirmed a genuine
  overlap: `.bs-hero-photo-choice` was centered across the *entire* hero
  box (`inset:0`, flex-centered — the same convention `aitech.html`/
  `business.html`/`dreamboard.html`/`learning.html`/`tasksnotes.html` all
  already use successfully), but the previous entry's typography bump
  (matching Main's larger hero title `clamp()`) made the bottom-anchored
  title textarea tall enough to physically overlap the centered button —
  and since the title field autosizes with whatever the user actually
  types (`autosize()` in `renderHero()`), a taller hero alone (the fix
  the sibling pages effectively rely on, via their own taller `min-height`)
  would only ever be a partial, content-length-dependent fix, not a real
  one.
  - **Fix**: `.bs-hero-photo-choice` moved from full-hero-center to the
    same top-right slot `.bs-hero-photo-tools`/`.bs-back-btn` already use
    (`top: max(14px, safe-area)`, `right: max(14px, safe-area)`), matching
    how `index.html`'s own `.rt-hero-photo-choice` places this exact
    button — genuinely clear of the bottom-anchored content regardless of
    how long the title/eyebrow/subtext grow, not just clear of today's
    default copy. Also bumped its `z-index` from 1 to 5 (matching the
    tools/back-button slot it now shares) as a second, independent layer
    of insurance beyond the repositioning itself.
  - **Verified via real hit-testing, not another `.click()` bypass**:
    measured the button's and the hero content's bounding rects before
    the fix (confirmed a real overlap — the button's rect sat inside the
    title textarea's rect) and after (confirmed zero overlap); then
    dispatched an actual `MouseEvent('click')` at
    `document.elementFromPoint()`'s own result for the button's rendered
    center (not the button reference directly) and confirmed it resolves
    to the button itself, not an obstructing element; re-ran the full
    upload → compress → sample-color → recolor-the-page → render chain
    the same way (a real hit-tested click, not `.click()`) and confirmed
    it still completes correctly (photoColor sampled, `--accent`
    recolored); and confirmed the Change button, which occupies the same
    top-right slot once a photo is set, is itself also hit-testable and
    not obstructed. Zero JS errors throughout.
