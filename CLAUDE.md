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
| `projects.html` | Projects — project list + per-project tasks (CRUD, contribution grid, velocity, burndown) (rebuilt — see changelog) |
| `braindump.html` | Brain Dump — freeform daily Thoughts/Emotions journal (new — see changelog) |

Stack (`health.html`) and Water (`po-water.html`) were removed — see the
changelog note at the bottom of this file.

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
  `entertainment.html`, `projects.html`, `braindump.html`.
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
values in each stylesheet. `entertainment.html`/`projects.html` (the two
newest, most consistent pages) do define `--radius-sm: 8px`, `--radius-md: 12px`,
`--radius-lg: 16px`.

**Shared UI components** (by convention/copy-paste, not by import — every
page's CSS is self-contained in its own `<style>` block):
- **Top nav bar** — the only *actually* shared component (via `topbar.js`
  injecting real markup at runtime): `.topbar`, `.topbar-pill`.
- **Buttons** — `.btn-primary` / `.btn-secondary` (white-gradient primary,
  subtle-bordered secondary) in `entertainment.html` and `projects.html`;
  `gym.html` uses `.po-btn-primary` / `.po-btn-secondary` (same look,
  different class names); `finance.html` uses page-specific names
  (`.quick-add-btn`, `.wish-add-btn`, `.ord-add-btn`) with the same visual
  recipe. **Not unified — copy the closest existing pattern, don't invent a
  fourth naming scheme.**
- **Modals** — `.modal-bg` / `.modal` (entertainment.html, projects.html) vs
  `.po-modal-bg` / `.po-modal` (gym.html). `topbar.js` injects shared CSS
  that treats **both** naming conventions as "a modal" for mobile
  full-screen behavior and body-scroll locking (see the `MODAL_SELECTORS`
  array in `topbar.js`, `startModalLock()`). If you add a new modal, add its
  class to that array too, or scroll-lock won't apply. `projects.html` also
  has a full-screen, non-floating "page" overlay, `.project-page-bg`,
  already added to `MODAL_SELECTORS`.
- **Cards / gallery grid** — `.ent-card`, `.ent-cover`, `.ent-grid`, `.tag`,
  `.chip` are *literally identical* class names/CSS copied between
  `entertainment.html` and `projects.html` (the two Notion-gallery-style
  pages). `finance.html` has its own separate `.card` / `.card-grid`.

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
   | `projects` | `projects.html` | `proj:cards` (each card now also carries `startDate`, `deadline`, and a `tasks[]` array — no new top-level key needed), `proj:statuses`, `proj:groups` |
   | `po-coach` | `gym.html` (own sync, not `sync.js`) | `po_coach_v1`, `po_coach_workout_done` |
   | `braindump` | `braindump.html` (new) | `braindump:entries` |

   `health` (previously owned by `health.html`/`po-water.html`, syncing
   `stack:*` and `po_water_v1`) is now an **orphaned row** — no page reads or
   writes it anymore since those pages were deleted (see changelog). It was
   left alone in Supabase itself; this doc only tracks code, not database
   cleanup.

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
| Projects | `PROJECTS` → `projects.html` | `projects.html` (gained per-project tasks + charts — see changelog) |
| Brain Dump | `BRAIN DUMP` → `braindump.html` | `braindump.html` (new — see changelog) |

Stack and Water were removed — see changelog at the bottom of this file.

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
  hover; (2) `braindump.html` (Brain Dump) has its own self-contained
  dark forest-green/black + gold/copper theme (deep green radial-gradient
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
     `finance.html`, `entertainment.html`, `projects.html`).
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
