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
| `index.html` | Goals command center (home page) — today summary, recurring habits + streaks, freeform daily checklist, monthly/yearly goals with an allocation engine, and a daily journal note |
| `gym.html` | Fitness Studio — manual routines/schedule, progressive-overload tracker |
| `finance.html` | Finance — personal finance dashboard: accounts/net worth, transactions, budgets, trends, recurring bills, notes (rebuilt — see changelog) |
| `entertainment.html` | Media — unified tracker: Podcasts / Stories / Entertainment / Playlists galleries (rebuilt — see changelog) |
| `braindump.html` | Brain Dump — freeform daily Thoughts/Emotions journal (new — see changelog) |
| `household.html` | Household — Energy Beings roster (legions/sigils/activation phrases/charging log), Inventory (restock thresholds), Wishlist (priority/price), Chores (recurring, due dates), Overview (new — see changelog) |
| `selfcare.html` | Self-Care — Journals (topic-filtered), Meditations (linkable library), Water (personalized daily hydration tracker), Bucket List (groupable, with a "surprise me"), and Overview (a 4-tile daily snapshot of the other four) are all built — every tab on this page is now real (new — see changelog) |
| `example.html` | Example — a standalone "System HUD" visual style demo tab, built to match a reference photo; explicitly not wired to real data or cloud sync (new — see changelog) |
| `dreamboard.html` | Dream Board — a drag-and-drop vision-board page: editable tabs (Vision Board / Reflections / Quarterly Goals / Monthly Breakdown), each with its own full-bleed cinematic "hero" cover section, and a 3-column board of reorderable, numbered widgets (checklists, lists, notes, quotes, affirmations, a steps tracker, a photo/video grid, a calendar, feature cards, info cards), an Add Widget menu, and a reset-to-default action (new — see changelog) |
| `business.html` | Business Hub — a content-planning workspace, visually identical to Dream Board (dark cinematic near-black/gold, frosted-glass cards, a per-tab hero, horizontal pill tabs). Content/Ideas/Platforms/Resources/Analytics/Audit are all board-mode — Dream Board's exact 3-column drag-and-drop widget board (Add Widget/Reset, per-widget color-grading tint, sixteen widget types including a Link card); Strategy alone is tasks-mode, a per-tab Tasks list mirroring index.html's Main-dashboard Tasks tab. Resources additionally has a Templates section below its board — a Workflow system (Weeks → Days → Checklist) mirroring index.html's Business Workflow/Amazon-KDP feature (new — see changelog) |

Stack (`health.html`) and Water (`po-water.html`) were removed — see the
changelog note at the bottom of this file. Projects (`projects.html`) and
Study (`study.html`) were also removed — see the changelog note near the
bottom of this file.

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
- `sync.js` — the shared sync client used by `index.html`, `finance.html`,
  `entertainment.html`, `braindump.html`.
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
   | `entertainment` | `entertainment.html` | `ent:cards`, `ent:categories` (both orphaned since the rebuild — see changelog), `media:podcasts`, `media:stories`, `media:entertainment`, `media:playlists`, `media:active_gallery`, `media:migrated_v1` (new — synced via a `media:` prefix) |
   | `po-coach` | `gym.html` (own sync, not `sync.js`) | `po_coach_v1`, `po_coach_workout_done` |
   | `braindump` | `braindump.html` (new) | `braindump:entries` |
   | `household` | `household.html` (new) | everything prefixed `household:` (`household:legions`, `household:beings`, `household:inventory`, `household:wishlist`, `household:chores`, `household:active_tab`) |
   | `selfcare` | `selfcare.html` (new) | everything prefixed `selfcare:` (`selfcare:journalEntries`, `selfcare:meditations`, `selfcare:hydrationProfile`, `selfcare:waterLog`, `selfcare:bucketList`, `selfcare:active_tab`) |
   | `dreamboard` | `dreamboard.html` (new) | everything prefixed `dreamboard:` (`dreamboard:tabs`, `dreamboard:widgets`, `dreamboard:banner`, `dreamboard:active_tab`) — note uploaded video slots are session-only object URLs and are never in this list (see that page's own changelog entry) |
   | `business` | `business.html` (new) | everything prefixed `business:` (`business:tabs`, `business:widgets`, `business:tasks`, `business:workflowWeeks`, `business:workflowDays`, `business:workflowChecklist`, `business:active_tab`; `business:profile` and `business:platforms` were both removed — see changelog) — same session-only-video-slot exception as `dreamboard` above |

   `health` (previously owned by `health.html`/`po-water.html`, syncing
   `stack:*` and `po_water_v1`) is now an **orphaned row** — no page reads or
   writes it anymore since those pages were deleted (see changelog). It was
   left alone in Supabase itself; this doc only tracks code, not database
   cleanup. `projects` (previously owned by `projects.html`, syncing
   `proj:cards`/`proj:statuses`/`proj:groups`) and `study` (previously owned
   by `study.html`, syncing everything prefixed `study:`) are now likewise
   **orphaned rows** — left alone in Supabase, not cleaned up, same
   treatment as `health` (see the Projects/Study removal changelog entry).

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
| Goals | `GOALS` → `index.html` | `index.html` (rebuilt as a command center — see changelog) |
| Fitness Studio | `STUDIO` → `gym.html` | `gym.html` (renamed from "Gym"/"Progressive Overload Coach" — see changelog) |
| Finance | `FINANCE` → `finance.html` | `finance.html` |
| Media | `MEDIA` → `entertainment.html` | `entertainment.html` (rebuilt as a 4-gallery tracker — see changelog) |
| Brain Dump | `BRAIN DUMP` → `braindump.html` | `braindump.html` (new — see changelog) |
| Household | `HOUSEHOLD` → `household.html` | `household.html` + `household-data.js` (new — see changelog) |
| Self-Care | `SELF-CARE` → `selfcare.html` | `selfcare.html` + `selfcare-data.js` (new; all five tabs built — see changelog) |
| Example | `EXAMPLE` → `example.html` | `example.html` (new — a visual style demo tab, not a real feature; see changelog) |
| Dream Board | `DREAM BOARD` → `dreamboard.html` | `dreamboard.html` + `dreamboard-data.js` (new — see changelog) |
| Business Hub | `BUSINESS` → `business.html` | `business.html` + `business-data.js` (new — see changelog) |

Stack, Water, Projects, and Study were removed — see changelog at the
bottom of this file.

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
  hover — this has since evolved further (see its own changelog) into a
  dark wine/candlelit "boutique gallery" look (`--tile-border`/
  `--pink-accent`/`--wine`/`--candle`/`--cream` tokens), which
  `household.html` and `selfcare.html` were each later explicitly asked
  to match — see their own changelog entries; (2) `braindump.html`
  (Brain Dump) has its own self-contained dark forest-green/black +
  gold/copper theme (deep green radial-gradient
  background, gold serif-italic display type, a CSS sunburst emblem) —
  **not** the app's near-black/off-white/green-amber-red-blue palette,
  and also not its own original light-cream theme (see its changelog:
  it was built light first, then explicitly re-themed dark to match a
  second reference photo); (3) `gym.html` (Fitness Studio) had its
  primary-action accent (buttons, active chips/toggles) re-graded from
  white to a deep crimson gradient (`--crimson`/`--crimson-bright`), and
  gained a fixed abstract background — a red glow rising from the
  bottom edge into near-black at the top, a grain texture, and a thin
  red circular arc — matching a reference photo's color grading. All
  three exceptions are scoped to their own file's `:root`; no other
  page's tokens changed, and `--good`/`--warn`/`--bad`'s semantic
  meaning (success/warning/danger) was left alone in all three. See
  each page's changelog entry.
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
     `finance.html`, `entertainment.html`, `braindump.html`).
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

## Changelog

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
