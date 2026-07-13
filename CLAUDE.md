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
