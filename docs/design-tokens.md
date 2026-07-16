# Design tokens — Tasks & Habits & Routines ("System HUD" style)

Extracted directly from `index.html` (the Main/Goals page) by reading the
actual CSS for `#atPanelTasks` and `#atPanelHabits`, not from memory or any
prior spec. All values below are copy-pasted from the source, with the
line-anchored rule they came from noted where useful.

## 0. Where this lives, and whether it's already tokenized

**There is no tokens/theme file anywhere in this repo.** Confirmed: no
`docs/`, no `tokens.css`, no `theme.js` existed before this file. Per
`CLAUDE.md` §3, this is a deliberate, pre-existing characteristic of the
whole codebase — every page is a standalone HTML file with its own
`<style>` block and its own `:root`, and there is no shared CSS file across
pages (`topbar.js` is the one exception, and it only carries nav-bar CSS).

Within `index.html` specifically, **partial tokenization already exists**:
a `:root` block (`index.html:12`) defines named CSS custom properties, and
the Tasks/Habits HUD styling is built almost entirely from those variables
rather than fresh hex codes. But two categories of value are **not**
tokenized and are hardcoded at every call site:

- **The glow/tint color itself.** Every rgba glow, tint, and translucent
  fill in the HUD (`rgba(224,138,159, <alpha>)`) is the decimal RGB of
  `--at-gold` (`#e08a9f`) retyped by hand at each alpha value, not derived
  from the variable (CSS has no native way to do `rgba(var(--at-gold), 0.1)`
  without also defining an separate `--at-gold-rgb: 224,138,159` triplet,
  which this file doesn't have). ~30 call sites across the two panels use
  this literal.
- **Spacing, radii, and clip-path notch sizes** are plain pixel numbers
  with no scale variables (`--space-2`, `--radius-sm`, etc. don't exist
  here) — see §4/§5 below. This matches `CLAUDE.md`'s own §3 admission:
  *"no shared scale variables in most files; ad hoc pixel values."*

So: **treat `:root`'s custom properties (§2) as the real, load-bearing
tokens — reuse them, don't reintroduce hex.** Treat the rgba-glow values
and the spacing/radius numbers in §4–§6 as *documented conventions*, not
enforced tokens; a future pass could promote them into real custom
properties (`--at-gold-rgb`, a spacing scale, a notch-size scale) without
changing how anything currently looks.

## 1. Background

Both panels share **one background recipe**, written as a single set of
combined CSS selectors (`#atPanelHabits, #atPanelTasks { ... }` and its
`::before`/`::after` pseudo-elements) — not independently duplicated per
page. Three stacked layers, in paint order:

1. **Panel base fill** — flat `#0b0509` (`index.html:574`).
2. **`::before` — tinted background photo**, four layers composited
   together (`index.html:583-592`):
   ```css
   background:
     linear-gradient(180deg, rgba(23,10,18,0.45) 0%, rgba(11,5,9,0.72) 55%, rgba(11,5,9,0.93) 100%),
     radial-gradient(70% 55% at 50% 0%, rgba(224,138,159,0.22) 0%, transparent 65%),
     radial-gradient(55% 45% at 90% 100%, rgba(167,139,250,0.16) 0%, transparent 60%),
     var(--hb-bg-photo) center 12% / cover no-repeat;
   filter: saturate(0.4) brightness(0.6);
   ```
   `--hb-bg-photo` (`index.html:12` block, defined once) is a `url("data:image/jpeg;base64,...")` —
   a single ~50KB embedded JPEG (the "Solo Leveling: Beyond the System"
   reference photo), reused via `var()` here and by `#taskDetailPageBg`
   so the payload isn't duplicated a second time in the file.
3. **`::after` — scanline texture**, a repeating horizontal line pattern
   blended over everything (`index.html:593-598`):
   ```css
   background: repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, transparent 1px, transparent 3px);
   mix-blend-mode: overlay;
   ```

Page-level (behind the panel, not part of it — for contrast, `body`'s own
background, `index.html:56-90`): flat `#0b0509`, plus a fixed radial-gradient
vignette (`rgba(232,164,99,0.10)` warm corner + `rgba(224,138,159,0.08)`
rose corner over a `linear-gradient(180deg, #170a12, #0b0509)`, blurred
40px) and a fixed 3px dotted grain texture at 0.7 opacity. **Identical on
both pages** — it's `body::before`/`body::after`, not panel-specific.

## 2. Color palette

All from `index.html`'s single `:root` block (`index.html:12-46`), shared
by literally every section of the page, not just Tasks/Habits.

| Token | Value | Used for |
|---|---|---|
| `--text-primary` | `#FAFAFA` | Primary text (titles, active values) |
| `--text-secondary` | `#B8B6B0` | Secondary/body text (base, mostly superseded by cream inside the HUD) |
| `--text-tertiary` | `#76746E` | Muted/meta text, disabled state, empty-state copy |
| `--success` | `#6BE3A4` | Status green (not used inside the HUD panels themselves — Goals status dots elsewhere) |
| `--warning` | `#F2C063` | Status amber (task priority "medium", elsewhere) |
| `--danger` | `#FF6B6B` | Delete/destructive text, priority "high" |
| `--info` | `#7DD3FC` | Priority "low" pill (elsewhere; not used in the HUD itself) |
| `--at-gold` | `#e08a9f` | **The HUD's one accent color** — active tab underline, section-title text, streak numbers, done-state borders/fills, quick-add button fill |
| `--at-gold-dim` | `rgba(224, 138, 159, 0.35)` | Dimmed accent — pending-state borders, mini-button borders, focus rings |
| `--at-border` | `rgba(224, 138, 159, 0.18)` | **The** hairline border color for every HUD card/panel/row |
| `--at-cream` | `#f3e8da` | Heading text inside the HUD (`h2`, card names, mini-button text), and the light end of the primary-button gradient |
| `--at-purple` | `#a78bfa` | Habit streak number color (`.habit-card-streak`); its RGB is also retyped as `rgba(167,139,250,0.16)` in the shared background-photo tint gradient (§1) — not derived from the variable, same gap noted in the hardcoded-colors table below |
| `--at-indigo` | `#93a4f4` | Not used in Tasks/Habits (Life Areas color option only) |
| `--at-orange` | `#fb923c` | Not used in Tasks/Habits (Life Areas color option only) |
| `--at-teal` | `#2dd4bf` | Not used in Tasks/Habits (Life Areas color option only) |
| `--hb-bg-photo` | `url("data:image/jpeg;base64,...")` | The panel background photo (§1) |

**Hardcoded (non-tokenized) colors actually used inside the two panels:**

| Value | Used for |
|---|---|
| `#0b0509` | Panel fill, modal-body dark background in a couple of spots |
| `#170a12` | Modal background (`#habitModalBg .modal`, `#gTaskModalBg .modal`) |
| `#2a0d14` | Text color *on top of* the cream gradient (primary buttons, active chips, done-checkbox glyph) — the dark "ink" color for light-on-dark-accent text |
| `#d9a0ae` | The gradient's dark stop — `linear-gradient(180deg, var(--at-cream) 0%, #d9a0ae 100%)`, used for `.btn-primary`, `.chip.active`, the Tasks quick-add button |
| `rgba(224,138,159, X)` at alpha `0.045`–`0.6` | The one glow/tint family used throughout both panels for card fills, box-shadows, and text-shadows — see §6 |
| `rgba(167,139,250,0.16)` | One corner of the background-photo tint gradient (a purple echo of `--at-purple`, hardcoded rather than derived from the variable) |
| `rgba(243,232,218, X)` | `--at-cream`'s RGB retyped for translucent uses (modal field labels, dimmed HUD text) — same "no `--x-rgb` triplet exists" gap as `--at-gold` |

## 3. Typography

Three font families, all declared once in `:root`:

- `--font`: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif` — body text, buttons, inputs.
- `--font-mono`: `ui-monospace, "SF Mono", Menlo, Consolas, monospace` — **the HUD's signature voice**: every label, heading, and readout inside `#atPanelHabits`/`#atPanelTasks` is switched to mono, even where the base (non-HUD) component used serif.
- `--font-serif`: `Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif` — used by the base (non-HUD) components these panels' cards were built from (`.habit-card-name`, `.routine-card-name`, `.run-routine-name` are all `--font-serif` at the base-class level) — **and then overridden back to mono inside the HUD scope**. This serif→mono swap is the single most consistent typographic move the HUD styling makes.

| Element | Family | Size | Weight | Letter-spacing | Transform | Color |
|---|---|---|---|---|---|---|
| Panel heading (`.at-col-head h2`, both panels) | mono | 15px | 800 | 0.14em | uppercase | `--at-cream`, `text-shadow: 0 0 18px rgba(224,138,159,0.35)`; prefixed with a `// ` in `--at-gold-dim` via `::before` |
| Section title (`.section-title`, both panels) | mono | 10.5px | 800 | 0.22em | uppercase | `--at-gold` |
| Mini button (`.at-mini-btn`, both panels) | mono | 10.5px | 700 | 0.05em | uppercase | `--at-cream` |
| Empty state (`.at-empty`, both panels) | mono | 11.5px | normal (italic via base class) | normal | none | `--text-tertiary` |
| Quest/task row title (`.at-task-title` / `.at-due-title`, both panels) | mono | 12.5px | normal | normal | none | `--text-primary` (→ `--text-tertiary` when done) |
| Habit/Routine card name (`.habit-card-name`/`.routine-card-name`) | mono (overridden from serif) | 15px *(inherited from base, not reset)* | 700 *(inherited)* | 0.02em | none | `--at-cream` |
| Habit streak (`.habit-card-streak`) | mono *(base)* | 12px | 700 | normal | none | `--at-purple` |
| Run Routine name (`.run-routine-name`, modal) | mono (overridden from serif) | 19px *(inherited)* | 700 *(inherited)* | normal | none | `--at-cream` |
| Run Routine field label | mono | 9.5px | 800 | 0.12em | uppercase | `--at-gold` |
| Run Routine field text | — *(inherits `--font` body)* | 13px | normal | normal | none | `rgba(243,232,218,0.8)` |
| Modal `h3` (Habit/Routine/Run Routine/Task modals) | mono | 15px | 700 *(inherited from base `.modal h3`)* | 0.08em | uppercase | `--at-cream`, `text-shadow: 0 0 14px rgba(224,138,159,0.3)` |
| Modal field label (`.field > label`) | mono | 10.5px *(inherited)* | 700 *(inherited)* | 0.14em *(inherited)* | uppercase *(inherited)* | `rgba(243,232,218,0.55)` |
| Modal field input/select/textarea | mono | 14px *(inherited, unchanged)* | normal | normal | none | `--at-cream` |
| Primary button (`.btn-primary`, both panels' modals) | mono | 14px *(inherited)* | 700 | 0.05em | uppercase | `#2a0d14` on cream gradient |
| Tasks chip (`.chip`, Tasks only) | mono | 10.5px *(overridden, base is 12.5px)* | 600 *(inherited)*/800 active | 0.04em | uppercase | `--text-secondary` → `#2a0d14` when active |
| Tasks filter select (`.task-filter-select`) | mono | 12px *(inherited)* | normal | normal | none | `--text-secondary` |
| Cover title (`.at-cover-title`, page-level, shared) | `--font-serif`, italic | `clamp(30px, 7vw, 46px)` | 400 | -0.01em | none | `--text-primary` |
| Cover subtext | — | 10.5px | 700 | 0.3em | uppercase | `--at-gold` |

**Line-heights**: mostly left at browser default except where explicitly
set — `.at-task-title` (base) `1.3`, `.run-routine-field-text` `1.5`,
`.at-cover-title`'s implicit block line-height. No line-height scale exists;
each component sets its own value ad hoc, same "no shared scale" pattern
as spacing.

## 4. Spacing scale

**No spacing variables exist.** Both panels use plain pixel values,
consistently but not tokenized:

- **Panel padding**: `20px 16px 4px` desktop → `16px 10px 4px` at ≤640px (`index.html:568-576`, `:791`)
- **Panel outer margin**: `0 -16px` desktop → `0 -12px` at ≤640px (full-bleed against the page's own padding)
- **Card padding**: row-scale cards (`.at-task`, `.at-due-card`) `8-9px 9-11px`; block-scale cards (`.habit-card`, `.routine-card`) `14px 16px`; modal `22px`
- **Gaps**: `.at-task`/quest row internal gap `9px`; `.at-task-grid` column gap `6px`; `.hb-days`/weekday picker gap `3px`; `.chip-row`/`.task-filter-bar` gap `8px`; `.hb-media-grid` gap `8px`
- **Section spacing**: `.section-title` margin `22px 0 12px` (`4px` extra top-padding added inside the HUD via `.at-col-head`'s own `16px 4px 0`)
- **Common increments actually observed**: `2, 3, 4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22px` — i.e. everything is hand-picked per component, not drawn from a 4px/8px scale, though most values happen to be multiples of 2.

## 5. Border radius, border width, clip-path notches

- **Border width**: `1px` everywhere for card/panel/button borders (the
  one exception: `.at-task-check`/`.at-due-check` circles, `1.5px`,
  inherited from the base class and *not* overridden inside the HUD).
- **Border radius**: the HUD deliberately **replaces rounded corners with
  clip-path notches** on every card it owns — `border-radius: 0` (or left
  unset, since clip-path overrides the visible corner regardless) plus a
  `clip-path: polygon(...)` cut. Two notch sizes are in use:
  - **10px notch** — row-scale cards: `.at-task` (Habits' Today grid,
    shared with Overview), `.at-due-card` (Tasks' task rows, shared with
    Overview/Goals/Business lists). *Identical value on both panels.*
    ```css
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    ```
  - **12px notch** — in-page block-scale cards: `.habit-card`,
    `.routine-card` (Habits' only block-scale card), and
    `#taskDetailPageBg .wfd-block` (Tasks' note blocks on the task detail
    page). *Consistent across both pages' in-page block cards.*
    ```css
    clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
    ```
  - **14px notch** — modal containers specifically: the Add/Edit
    Habit/Routine/Run Routine modals, the Add/Edit Task modal
    (`#gTaskModalBg`), and `#runRoutineModalBg .run-routine-card`.
    *Consistent across every modal either page opens.* Reads as an
    intentional two-tier system by container type (in-page card = 12px,
    modal = 14px) rather than an inconsistency — see §8.
  - Small elements keep radii instead of notches: `--at-mini-btn` (HUD)
    `border-radius: 2px`; `.goal-card-tag`/`.chip` pills stay `999px`
    (fully round, unchanged from the base non-HUD component); media
    thumbnails (`.hb-media-thumb`) `8px`; media delete button `50%`.
- **Panel container itself**: `border-radius: 4px` (`index.html:572`) — a
  small, barely-rounded corner, distinct from both the 0px notched cards
  inside it and the fully-rounded page cover above it (`20px`).

## 6. Shadows — the glow system

Every shadow in both panels is a soft, colored glow built from the same
`rgba(224,138,159, X)` family (i.e. `--at-gold` at low alpha), never a
neutral black drop-shadow. This is the HUD's most distinctive shared
visual signature:

| Element | Shadow |
|---|---|
| Panel `h2` | `text-shadow: 0 0 18px rgba(224,138,159,0.35)` |
| Modal `h3` | `text-shadow: 0 0 14px rgba(224,138,159,0.3)` |
| Quest/task card, pending state | `box-shadow: 0 0 16px rgba(224,138,159,0.10)` |
| Quest/task card, done state | `box-shadow: 0 0 20px rgba(224,138,159,0.20)` |
| Stacked-habit glow frame (`.hb-quest-stacked`, Habits only) | `box-shadow: 0 0 24px rgba(224,138,159,0.10) inset` |
| Contribution-heatmap "done" cell (Habits only) | `box-shadow: 0 0 6px rgba(224,138,159,0.6)` |
| Modal container | `box-shadow: 0 0 0 1px rgba(224,138,159,0.06) inset, 0 0 40px rgba(224,138,159,0.14)` |
| Run Routine card (modal) | `box-shadow: 0 0 30px rgba(224,138,159,0.12)` |
| Primary button (`.btn-primary`, base, unthemed) | `inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 14px rgba(61,15,26,0.45)` — the one *non*-gold shadow, a plain elevation shadow the HUD doesn't override |

Both panels use exactly this same vocabulary with no divergence — same
color family, same style (glow, not drop-shadow), scaled by blur radius
and alpha to signal emphasis (pending → done → stacked-group → modal, in
increasing glow strength).

## 7. Card / container patterns

**The shared "quest/task row"** (`.at-task` on Habits, `.at-due-card` on
Tasks) is the atomic unit both panels are built from:
- 10px clip-path notch, `1px solid var(--at-border)`, `rgba(224,138,159,0.05)` fill
- A circular check control (19px/17px diameter, 1.5px border, fills solid `--at-gold` when done)
- A title in mono 12.5px
- Optional meta (streak badge on Habits' side; date/priority/status pills on Tasks' side, unthemed — see below)

**The shared "block card"** (`.habit-card`/`.routine-card` — Tasks has no
equivalent; its content is entirely row-scale):
- 12px clip-path notch, `1px solid var(--at-border)`, `rgba(224,138,159,0.045)` fill
- `border-radius: 0` explicit
- Header row: name (mono, cream) + spacer + streak/count (right-aligned) + icon-only action buttons (tertiary → cream on hover)

**The shared modal** (Habit/Routine/Run Routine modals, and the separately
-declared but value-identical Task modal):
- 14px clip-path notch, `#170a12` fill, `1px solid rgba(224,138,159,0.35)` border, the two-layer inset+glow shadow from §6
- Fields keep the base `.field` layout (label above input, `8px` gap) but every input/select/textarea gets `rgba(224,138,159,0.06)` fill + `rgba(224,138,159,0.25)` border + mono font + cream text
- Primary button: cream→`#d9a0ae` gradient fill, `#2a0d14` text, mono uppercase
- Secondary button: `rgba(224,138,159,0.08)` fill, same dim border, cream text

**One notable Tasks-only pattern with no Habits equivalent**: the
cream-gradient "high emphasis" treatment. Tasks applies the *exact same*
`linear-gradient(180deg, var(--at-cream) 0%, #d9a0ae 100%)` fill used by
modal primary buttons to two *in-panel, non-modal* elements — the active
filter chip (`.chip.active`) and the inline quick-add button
(`.at-due-add-row button`). Habits has no in-panel element styled this
way; its equivalent actions (+ Add Habit, + Add Routine) are header-level
`.at-mini-btn`s, which use the much dimmer `rgba(224,138,159,0.08)` fill
— see §8 for why this is flagged, not just noted.

## 8. Where Tasks and Habits disagree

Because nearly all of the shared HUD chrome is written as **one set of
combined CSS selectors** targeting `#atPanelHabits` and `#atPanelTasks`
together (e.g. `index.html:568`, `:583`, `:600-621`), most of what the two
panels have in common is not just *similar* — it's the *same rule*,
so by construction it cannot drift. Genuine disagreements are narrow:

1. **Not actually a disagreement, but worth naming as a rule:
   12px-vs-14px notch size splits cleanly by container type, not by
   page.** `.habit-card`/`.routine-card` (Habits) and
   `#taskDetailPageBg .wfd-block` (Tasks' note blocks) all use a **12px**
   clip-path notch; every modal either page opens (Habit, Routine, Run
   Routine, Task) plus `.run-routine-card` uses **14px**. Checked both
   panels' full rule sets to confirm this holds across the whole feature,
   not just within one page — it does. **Recommendation: keep as-is, and
   write the rule down explicitly** (in-page block card = 12px notch,
   modal container = 14px notch) so a future page/component picks the
   right one on purpose instead of by accident.

2. **High-emphasis "cream gradient" affordance exists on Tasks, not on
   Habits.** Tasks' active chip and inline quick-add button get the same
   bright cream→pink gradient as a modal's primary button; Habits' header
   "+ Add" actions stay on the dim `.at-mini-btn` treatment with no
   in-panel element ever reaching for the brighter gradient.
   **Recommendation: this is a legitimate emphasis-tier distinction, not
   a bug — keep it, but name it.** Adopt the convention explicitly: the
   cream gradient = "commits/creates a new record right now, inline"
   (quick-add buttons, active toggle state); `.at-mini-btn`'s dim
   treatment = "opens a modal / secondary panel action" (header + Add
   buttons, icon actions). Under that rule, Habits *should* stay as-is
   (its + Add Habit/+ Add Routine buttons open modals, they don't commit
   inline) — so no code change is actually needed here, just documenting
   the rule so a future page doesn't reach for the wrong tier by accident.

3. **Modal CSS is duplicated, not shared, and only coincidentally
   identical today.** `#habitModalBg`/`#routineModalBg`/`#runRoutineModalBg`
   share one combined selector block; `#gTaskModalBg` (Tasks' Add/Edit
   Task modal) is a **separate, independently-written block** with the
   same values retyped (`index.html:799-849` vs. `:852-880`). Nothing
   currently differs, but nothing enforces that they *can't* drift — a
   future edit to one is not guaranteed to touch the other.
   **Recommendation: not worth merging retroactively** (the DO-NOT-MODIFY
   discipline in `CLAUDE.md` favors leaving working, unrelated-looking
   code alone), but any *future* HUD modal should extend the existing
   `#habitModalBg, #routineModalBg, #runRoutineModalBg` selector list
   (as `#gTaskModalBg` arguably should have) rather than starting a
   fourth copy.

4. **Card-background alpha: 0.045 vs 0.05, by card tier, not by page.**
   Row-scale cards (`.at-task`, `.at-due-card` — one on each page) both
   use `rgba(224,138,159,0.05)`. Block-scale cards (`.habit-card`,
   `.routine-card` — Habits only) use `0.045`. Since Tasks has no
   block-scale card, this tiny (barely perceptible) gap isn't a Tasks-vs-
   Habits disagreement so much as an unexplained tier split within
   Habits itself. **Recommendation: treat `0.05` as canonical** (it's
   the value used by both panels' row cards, and the gap to `0.045` is
   small enough that unifying it would cause zero visible regression) —
   low priority, cosmetic-only.

**Everything else — background photo/gradient/scanline treatment, panel
padding/margin/border-radius, section-title and heading typography,
mini-button styling, the glow-shadow system (§6), the row-card notch size
and border/fill — is identical between the two pages, because it's
implemented as identical shared CSS, not just visually matched.**
