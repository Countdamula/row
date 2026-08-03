# Businesses tab — complete inventory

Read directly from `index.html` (the Main/Goals page): the static HTML shell
(`#atPanelBusinesses`, `#bizModalBg`, `#kpiModalBg`, `#workflowDayPageBg`)
plus every JS function that builds or mutates this tab. Order below matches
DOM/render order, not file order. Use this as a checklist against the
redesign — every bullet is something that must still exist (in some form)
afterward, or be a deliberate, called-out removal.

Scope note: two things render *inside* this tab but are **shared
components owned by other tabs** (Goal cards → the Goals tab's full-page
Goal Detail overlay; Task rows → the shared Task modal / Task Detail
overlay). Their fields are listed in full where they appear *on this tab*
(the card/row itself), but their destination screens are only summarized
with a pointer — a Business-tab redesign isn't expected to touch those,
and if it does, that's a different inventory.

---

## 1. Entry point

- Reached via the Main page's sub-nav: `.at-tabs` → `<button class="at-tab" data-tab="businesses">Businesses</button>`.
- Panel: `<div class="at-tabpanel" id="atPanelBusinesses" hidden>` (`index.html:1322`).
- Rendered by `renderBusinessesSection()` (`index.html:6465`), called from `renderSection('businesses')` on every tab switch, on the `storage` event (incoming cloud sync), and on the `goals-changed` event.
- URL-shareable via hash: `index.html#businesses`.

## 2. Static shell (`#atPanelBusinesses`)

In DOM order:
1. `.at-col-head`
   - `<h2>Businesses</h2>`
   - `.at-col-actions` → button `#atAddBizBtn` — **"+ Add Business"** → `openBizModal(null)`
2. `.chip-row#bizSubTabs` — empty in markup, populated by `renderBizSubTabs()` (§3)
3. `<div id="bizPanelBody">` — empty in markup, populated by `renderBizPanelBody()` (§4)

## 3. Business sub-tabs (`#bizSubTabs`, via `renderBizSubTabs(list)`, `index.html:5548`)

- One `.chip` button per record in `main:businesses`, in stored array order (no sort).
- Chip label: `(biz.icon || '💼') + ' ' + biz.name`.
- `.active` class on whichever business's id matches the module-scoped `activeBizId` variable.
- Click → sets `activeBizId = b.id`, calls `renderBusinessesSection()` (re-renders both the chip row and the body).
- `renderBusinessesSection()` (`index.html:6465`) auto-selects a business if none is active: if `activeBizId` is null or points at a deleted business, it defaults to `list[0].id` (or `null` if there are zero businesses).

## 4. Per-business panel body (`#bizPanelBody`, via `renderBizPanelBody()`, `index.html:6386`)

### 4.0 Empty state (no businesses exist, or none selected)
- `.placeholder-panel` with:
  - Icon: 💼
  - Title: **"No businesses yet"**
  - Text: **`Tap "+ Add Business" to create your first one — each becomes its own tab here.`**
- Nothing else renders below this.

### 4.1 Header (`.biz-header`)
- `.biz-header-icon` — `biz.icon || '💼'`
- `.biz-header-name` — `biz.name`
- `.biz-header-actions`:
  - `.at-mini-btn` **"✎ Edit"** → `openBizModal(biz)` (§9.1)
  - `.at-mini-btn` **"✕ Delete"** → `deleteBusinessWithConfirm(biz.id)` (§8)

### 4.2 Description (`.biz-desc`)
- Rendered **only if** `biz.description` is truthy.
- Plain text node, `biz.description` verbatim (no label/heading).

### 4.3 Notes (via `buildBizNotesSection(biz)`, `index.html:5625`)
- `.section-title` — **"Notes"** (no add/action button on this heading)
- `<textarea class="at-textarea">` — placeholder **"Notes for this business…"**, value = `biz.notes || ''`
- Behavior: autosizes on `input` (via shared `autosize()`); saves on `blur` only if the value actually changed — `biz.notes = value; saveBusinesses(list)`.
- Data binding: `main:businesses[].notes` (string, default `''`).

### 4.4 KPIs
- `.section-title` — **"KPIs"** + `.at-mini-btn` **"+ Add KPI"** → `openKpiModal(biz, null)` (§9.2)
- If `biz.kpis` (array) has entries: `.kpi-grid` containing one `.kpi-tile` per KPI (via `buildKpiTile(biz, kpi)`, `index.html:5561`), in stored array order (no sort/reorder controls).
- Else: `.at-empty` — **"No KPIs yet."**

**Each `.kpi-tile`** (in order):
- `.kpi-tile-label` — `kpi.label`
- `.std-bar` progress bar — fill width = `Math.round(current/target*100)` clamped 0–100%, fill color: `--success` if pct ≥ 100, `--warning` if pct ≥ 50, else `--at-gold` (`current`/`target` coerced via `Number(...) || 0`; `target === 0` ⇒ pct forced to 0 rather than `Infinity`/`NaN`)
- `.kpi-tile-values` — `current` (colored to match the bar) + literal `" / "` + `target`
- `.kpi-tile-actions`:
  - icon-only button **"✎"** (aria-label "Edit KPI") → `openKpiModal(biz, kpi)`
  - icon-only button **"✕"** (aria-label "Delete KPI") → `confirm("Delete this KPI?")` → removes it from `biz.kpis`, saves, re-renders

Data binding: `main:businesses[].kpis[]` = `{ id, label, current, target }`.

### 4.5 Goals
- `.section-title` — **"Goals"** + `.at-mini-btn` **"+ Add Goal"** → `openGoalModal(null, biz.id)` (opens the **shared** Add/Edit Goal modal, `#goalModalBg`, pre-filled with this business — see §9.1)
- Source: `loadGoals().filter(g => g.businessId === biz.id)` — **no sort applied** (renders in `main:goals` array order).
- If any: one `.goal-card` per goal (via the shared `buildGoalCard(goal)`, `index.html:3823`) — see §9.2 for its fields.
- Else: `.at-empty` — **"No goals linked to this business yet."**

### 4.6 Tasks
- `.section-title` — **"Tasks"** (no add-button on the heading itself — the add row is below the list, §4.6.2)
- Source: `loadTasks().filter(t => t.businessId === biz.id)`, **sorted by `dueDate` ascending** (tasks with no due date sort last, via `'9999'` fallback).
- If any: one row per task via the shared `buildTaskRow(task, renderBusinessesSection, { showTags: true, rich: true, showBlocksBtn: true })` — see §9.3 for its fields (this is the richest task-row configuration used anywhere in the app: priority pill, in-progress badge, recurrence badge, due date, tags row, and the "📄 Open" notes button are all shown).
- Else: `.at-empty` — **"No tasks linked to this business yet."**

#### 4.6.2 Inline quick-add row (via `buildBizTaskQuickAdd(biz)`, `index.html:5600`)
- `.at-due-add-row` containing, in order:
  - text input, placeholder **"Add a task…"**
  - `<input type="date">` (no placeholder)
  - button **"+ Add"**
- Enter key in the title field also submits.
- On submit: pushes a new record straight onto `main:tasks` (bypassing the shared Task modal) with `status:'todo', priority:'medium', businessId: biz.id`, everything else defaulted/empty; re-renders the whole Businesses section.

### 4.7 Workflow (via `buildBizWorkflowSection(biz)`, `index.html:6244`)
- `.section-title` — **"Workflow"** containing, in order:
  - text node **"Workflow"**
  - `.at-mini-btn` **"+ Add Week"** → `addWorkflowWeek(biz.id, {title:''})`, re-renders
  - `label.wf-autosync-label`: a checkbox + text **"Auto-sync days to Tasks"** — bound to `biz.workflowAutoSync` (boolean, default falsy). Toggling calls `setWorkflowAutoSync(bizId, checked)`; turning it **on** immediately sends every not-yet-linked day in every week of this business to Tasks (§6 for what "send" does).
- Source: `weeksForBusiness(biz.id)` — `main:workflowWeeks` filtered by `businessId`, **sorted by `order` ascending**.
- If any weeks: one `.std-group` per week, in order, via `buildWorkflowWeekGroup(week, biz, renderBusinessesSection)` (§5).
- Else: `.at-empty` — **"No workflow weeks yet."**

---

## 5. Workflow Week group (`buildWorkflowWeekGroup`, `index.html:6112`) — one per week

### 5.1 Header (`.std-group-head`, click anywhere on it toggles collapse)
In order:
- `.area-card-reorder`: **▲** (aria-label "Move up", disabled if first) / **▼** (aria-label "Move down", disabled if last) — swap this week's `order` with the adjacent sibling **within this business only**
- `.std-caret` — ▼, rotates when collapsed (collapse state **is persisted**: `week.collapsed`, toggled by clicking the header)
- text input `.wf-week-title`, value = `week.title`, placeholder **"Week title…"** — saves on blur (only if changed) and on Enter
- `.std-group-count` — `"<done>/<total> done"` if the week has ≥1 day, else **"No days yet"**
- `.std-group-spacer` (flex spacer, pushes the following two buttons right)
- `.std-group-dup` icon button **"⧉"** (aria-label "Duplicate week"; title: *"Duplicate this week (days + checklist items, reset to Not started)"*) → `duplicateWorkflowWeek(week.id)` (same business)
- `.std-group-del` icon button **"✕"** (aria-label "Delete week") → `confirm('Delete "<title or "this week">"? Its days and their checklist items will be deleted too.')` → `removeWorkflowWeek(week.id)` (cascades to its days and their checklist items **and blocks** — the confirm copy does not mention blocks, see §10 "copy inconsistencies")

### 5.2 Body (`.std-group-body`, hidden when collapsed)
In order:
1. `.std-bar.std-group-bar` — fill width = `Math.round(weekProgress(week.id).fraction * 100)`%, no numeric label (the number lives in the header's count text instead)
2. **Cross-business move/copy row** (`.wf-move-row`) — rendered **only if ≥1 other business exists**:
   - label **"Send to another project:"**
   - `<select>` (aria-label "Target project/business") — one option per other business, `icon + name`
   - `.at-mini-btn` **"⧉ Copy"** (title: *"Copy this week as a fresh template into the selected project (days + checklist items, reset to Not started) — this week stays here too"*) → `duplicateWorkflowWeek(week.id, selectedBizId)`
   - `.at-mini-btn` **"→ Move"** (title: *"Move this week (with its current progress) to the selected project — it leaves this project"*) → `moveWorkflowWeekToBusiness(week.id, selectedBizId)`
3. Day rows: `daysForWeek(week.id)` (sorted by `order`) → one `buildWorkflowDayRow(day, biz, rerenderFn)` each (§6); or `.at-empty` **"No days yet."** if none
4. Quick-add row (`.std-quick-add`): text input placeholder **"Quick-add a day, press Enter…"** + button **"+ Add"** → `addWorkflowDay(week.id, {title})`; **if this business's auto-sync is on, the new day is immediately sent to Tasks too**

---

## 6. Workflow Day row (`buildWorkflowDayRow`, `index.html:5982`) — one per day, inside a week's body

### 6.1 Header (`.wf-day-head`, click toggles collapse — **not persisted**, resets to expanded on reload)
In order:
- `.area-card-reorder` ▲/▼ — reorders within this week only
- `.wf-day-caret` — ▼ (rotates when collapsed)
- text input `.wf-day-title`, value = `day.title`, placeholder **"Day title…"** — saves on blur/Enter
- Status `<select>` (`buildWorkflowStatusSelect`, §6.3 — shared with the detail page) — options **Not started / In progress / Done / Blocked**
- `.at-due-link` tag — `icon + business name` (always this day's own business, since a day only ever belongs to one)
- `.at-mini-btn` **"📄 Open"** (title: *"Open this day's notes/code blocks"*) → `openWorkflowDayPage(day.id)` (§7 — full-page overlay)
- `.at-mini-btn.wf-day-send-btn` — **"→ Tasks"** normally, **"✓ In Tasks"** (with `.linked` class) if a Task already references this day (title toggles: *"Create a linked Task from this day"* / *"Linked to a Task — click to unlink"*) → `sendWorkflowDayToTasks` / `unlinkWorkflowDayFromTask`
- `.at-mini-btn` **"⧉ Duplicate"** (title: *"Duplicate this day (checklist items + notes/code blocks, reset to Not started)"*) → `duplicateWorkflowDay(day.id)`
- `.wf-day-del` icon button **"✕"** (aria-label "Delete day") → `confirm('Delete "<title or "this day">"? Its checklist items will be deleted too.')` → `removeWorkflowDay(day.id)` (cascades checklist items **and blocks**; confirm copy here also omits "blocks" — same gap as the week-delete confirm)

### 6.2 Body (`.wf-day-body`, hidden when collapsed)
In order:
1. **Move-to-week row** (`.wf-move-row`) — rendered **only if this business has >1 week**: label **"Move to week:"** + `<select>` of every week in this business (aria-label "Move day to week") → `moveWorkflowDayToWeek`
2. Checklist items: `checklistForDay(day.id)` (sorted by `order`) → one row per item via `buildWorkflowChecklistRow` (§6.4); or `.at-empty` **"No checklist items yet."**
3. Quick-add row (`.std-quick-add`): text input placeholder **"Quick-add a note item, press Enter…"** + button **"+ Add"** → `addWorkflowChecklistItem(day.id, {text})` *(note: wording is "note item" here vs. "checklist item" on the detail page's equivalent input — same underlying collection, see §10)*

### 6.3 Status select (`buildWorkflowStatusSelect`, `index.html:5672` — shared between the board row and the detail page)
- `<select class="wf-status-select">`, options = `WORKFLOW_DAY_STATUSES` = **Not started, In progress, Done, Blocked**.
- On change: `updateWorkflowDay(day.id, {status})`, then `pushDayStatusToLinkedTask(day.id, status)` (§11 — one-way sync to any linked Task), then re-render.
- Click is stopped from bubbling (so clicking the select doesn't also toggle the day/week's collapse).

### 6.4 Checklist item row (`buildWorkflowChecklistRow`, `index.html:5691` — shared between the board and the detail page)
Class `.gp-obj-row` (`.is-done` when checked). In order:
- `.area-card-reorder` ▲/▼ — reorders within this day's checklist only
- `.gp-obj-check` (✓, `.done` when checked) — toggles `checked`
- text input `.gp-obj-text`, value = `item.text` — on blur: if emptied, **deletes the item**; if changed, updates it; Enter blurs
- `.gp-obj-del` (✕, aria-label "Delete item") — deletes immediately, no confirm

Data binding: `main:workflowChecklist[]` = `{ id, dayId, text, checked, order, createdAt }`.

---

## 7. Workflow Day detail — full-page overlay (`#workflowDayPageBg`, `index.html:1408`)

Opened by the "📄 Open" button on any day row (`openWorkflowDayPage(dayId)`); closed by "← Back" or after deleting the day (`closeWorkflowDayPage()`, which also re-renders the Businesses section behind it). Reuses the generic `.wfd-page-bg`/`.wfd-page` block-editor shell (also used, separately, by the Task Detail overlay — see `CLAUDE.md`, not the same DOM element).

On open, `seedWorkflowDayLegacyNotes(dayId)` runs first: a one-time, best-effort migration that — **only if this day has zero blocks and a non-empty legacy `day.notes` string** — creates one initial `'note'` block from it. `day.notes` itself is left in place afterward (never read by any other UI).

### 7.1 Topbar (`.wfd-topbar`)
- `#wfdBack` — **"← Back"** → `closeWorkflowDayPage()`
- `#wfdStatusSelectWrap` — the same status `<select>` as §6.3, re-rendered fresh each time the page opens
- `#wfdDeleteBtn` — **"✕ Delete Day"** → `confirm('Delete "<title or "this day">"? Its checklist items and blocks will be deleted too.')` → `removeWorkflowDay` + `closeWorkflowDayPage()`

### 7.2 Primary action
- `#wfdAddNotesCodeBtn` — **"+ Notes + Code"** → `appendNotePlusCode(dayId)`, which creates **one note block then one code block**, in that order, both appended at the end; the new note block opens directly in edit mode (focused)

### 7.3 Title + meta
- `#wfdTitleInput` — text input, placeholder **"Day title…"**, bound to `day.title` (blur/Enter to save)
- `#wfdMetaRow` — one `.at-due-link` tag: `icon + business name` + (if the day's week has a title) `" · " + week title`

### 7.4 Checklist section
- `.section-title` **"Checklist"**
- `#wfdChecklistList` — same `buildWorkflowChecklistRow` component as §6.4 (one underlying store, so edits here and on the board stay in sync automatically); empty state `#wfdChecklistEmpty` — **"No checklist items yet."**
- Quick-add row: `#wfdChecklistInput` placeholder **"Quick-add a checklist item, press Enter…"** + `#wfdChecklistAddBtn` **"+ Add"**

### 7.5 Blocks section
- `.section-title` **"Blocks"**
- `#wfdBlocksList` — one `.wfd-block` card per block (§7.6), in `order`
- Empty state `#wfdBlocksEmpty` (`.placeholder-panel.placeholder-panel-sm`): icon 📝, title **"No blocks yet"**, text **`Tap "+ Notes + Code" above to add your first note and code block.`**

### 7.6 Block card (`buildWorkflowBlockCard`, `index.html:5815`) — one per note/code block
Draggable (native HTML5 DnD via the handle) with ▲/▼ arrow-button fallback; drag state is module-scoped (`wfdDragBlock`), drop target shows a `.drag-over-before`/`.drag-over-after` indicator line.

**Head** (`.wfd-block-head`), in order:
- `.wfd-drag-handle` — "⠿" (title "Drag to reorder", `draggable="true"`, decorative/`aria-hidden`)
- `.area-card-reorder` ▲/▼ — reorders within this day's blocks
- `.wfd-block-type` label — **"📝 Note"** or **"</> Code"**
- `.wfd-block-spacer`
- *(code blocks only, always shown)* `.wfd-lang-input` — text input, placeholder **"language"**, bound to `block.language`
- *(code blocks only, when not currently being edited)* `.wfd-copy-btn` **"⧉ Copy"** → copies `block.content` to the clipboard via `navigator.clipboard.writeText`; label flips to **"Copied!"** for 1.4s on success. If the Clipboard API is unavailable: `alert("Clipboard copy is not supported in this browser.")`; if the write itself fails: `alert("Could not copy — clipboard access was blocked.")`
- `.at-due-del` **"✕"** (aria-label "Delete block") → `confirm("Delete this block?")` → deletes

**Body** (type- and edit-state-dependent):
- **Note, editing**: `<textarea class="wfd-block-textarea">`, placeholder **"Notes… (Markdown: **bold**, # heading, - bullet)"**; autosaves on blur, autosizes on input, autofocuses at end of text when opened
- **Note, viewing**: `.wfd-note-view`, rendered via a small hand-rolled Markdown-lite parser (`renderMarkdownLite` — headings, `**bold**`, `- `/`* ` bullet lists, paragraphs; HTML-escapes input first, so raw tags in a note can't inject markup). If empty: `.wfd-note-placeholder` **"Click to add notes…"**. Clicking the view enters edit mode.
- **Code, editing**: `<textarea class="wfd-code-textarea">`, placeholder **"// code…"**, `spellcheck=false`; same autosave/autosize/autofocus behavior as the note textarea
- **Code, viewing**: `<pre class="wfd-code-view">`, raw text (no syntax highlighting — no highlighting library exists in this repo). If empty: text **"Click to add code…"** with `.wfd-code-empty`. Clicking the view enters edit mode.
- **Code blocks only**: below the content, `.wfd-add-code-below` button **"+ Code block"** → `insertCodeBlockAfter(block.id)` (inserts a new code block immediately after this one, opens it in edit mode)

Data binding: `main:dayBlocks[]` = `{ id, dayId, type: 'note'|'code', content, language, order, createdAt }`.

---

## 8. Delete Business (`deleteBusinessWithConfirm`, `index.html:6474`)

- Confirm copy: if the business has ≥1 linked goal or task —
  `'Delete "<name>"? <N> goal(s) and <N> task(s) will become unassigned, not deleted.'`
  — else just `'Delete "<name>"?'`
- On confirm: removes the record from `main:businesses`; every `main:goals` record with this `businessId` gets it set to `null` (goal itself survives); every `main:tasks` record with this `businessId` gets it set to `null` (task itself survives). **Workflow weeks/days/checklist items/blocks belonging to this business are *not* cleaned up by this path** — they become orphaned (same "leave orphaned data alone" precedent used elsewhere in this app for retired features, per `CLAUDE.md`) rather than cascade-deleted. If the deleted business was the active tab, `activeBizId` is cleared so the next render falls back to the first remaining business.
- Reachable from two places: the "✕ Delete" header button (§4.1) and the Add/Edit Business modal's own delete link (§9.1).

---

## 9. Modals owned by this tab

### 9.1 Add/Edit Business modal (`#bizModalBg`, `index.html:1694`)
- Title: **"Add Business"** / **"Edit Business"**
- Field **Name** — text input `#bizNameInput`, placeholder *"e.g. Consulting LLC"*
- Field **Icon** — text input `#bizIconInput`, placeholder *"💼"*, `maxlength="4"`
- Field **Description (optional)** — textarea `#bizDescInput`, placeholder *"What is this business?"*
- Actions: **Cancel** / **Save**
- **Save** validation: Name is required (silently no-ops if blank — no alert); Icon defaults to 💼 if left blank. New records get `notes: '', kpis: [], createdAt: Date.now()`. On save, `activeBizId` is set to the saved business (so creating a new one switches straight to it).
- Delete link (edit mode only): **"Delete this business"** → closes the modal, then runs the same `deleteBusinessWithConfirm` flow as §8.
- Dismiss: Cancel button or clicking the dark backdrop. (No modal anywhere in this file has an Escape-key handler — confirmed by a file-wide search, not specific to this modal.)

### 9.2 Add/Edit KPI modal (`#kpiModalBg`, `index.html:1709`)
- Title: **"Add KPI"** / **"Edit KPI"**
- Field **Label** — text input `#kpiLabelInput`, placeholder *"e.g. Monthly Revenue"*
- Field **Current value** — number input `#kpiCurrentInput`, placeholder *"0"*
- Field **Target value** — number input `#kpiTargetInput`, placeholder *"0"*
- Actions: **Cancel** / **Save**
- **Save** validation: Label required (no-ops if blank); Current/Target coerced via `Number(...) || 0`.
- Delete link (edit mode only): **"Delete this KPI"** → `confirm("Delete this KPI?")` → removes from `biz.kpis`.
- Module state: `kpiEditingBizId` + `kpiEditingId` (both reset only implicitly by the next `openKpiModal` call, not on close).

---

## 9-shared. Components reused *on* this tab, owned by other tabs

### 9-shared.1 Goal card (`buildGoalCard`, §4.5's list items — full spec belongs to the Goals tab's own inventory)
On-tab fields, top to bottom:
- Status dot (colored: default / `--warning` if in-progress / `--success` if done)
- Title (`goal.title`)
- Target date, right-aligned, if set
- Chip row: Life Area tag (icon+name, if set) and Business tag (icon+name, if set — will always show *this* business here)
- Progress bar + percent label (`computeGoalProgress(goal)`)
- "Next: **<task title>** · <date>" line, or *"No open tasks yet — break this goal down."* if none
- Click anywhere on the card → `openGoalPage(goal.id)`, the full-page Goal Detail overlay (topbar with Edit/Delete, title, meta badges, Why/Success-criteria/Description, progress bar, next-action callout, milestone timeline SVG, Milestones list with quick-add, Unassigned Tasks list with quick-add) — **not reproduced here**, out of scope for this tab's redesign.

### 9-shared.2 Task row (`buildTaskRow(task, renderBusinessesSection, {showTags:true, rich:true, showBlocksBtn:true})`, §4.6 — full spec belongs to the Tasks tab's own inventory)
On-tab fields, in order:
- Circular checkbox (toggles `done` via `setTaskDone`)
- Title (click → opens the shared Add/Edit Task modal, §9-shared.3)
- Priority pill (low/medium/high) — shown because `rich:true`
- "DAILY" badge if `isDailyAction`
- "IN PROGRESS" badge if status is in-progress — shown because `rich:true`
- Recurrence badge ("↻ Weekly"/"↻ Daily") if set — shown because `rich:true`
- Due date, if set
- **"📄 Open"** button — shown because `showBlocksBtn:true` → opens the Task Detail overlay (§9-shared.4)
- **"✕"** delete button (no confirm — deletes immediately, cascading its own note blocks from `main:taskBlocks`)
- Below the row (shown because `showTags:true`): a tags row of Life Area / Goal / Business / Habit / estimate chips — the Business chip will always show *this* business here

### 9-shared.3 Add/Edit Task modal (`#gTaskModalBg`) — fields, for reference since it's reachable from every task row on this tab
Title, Note, Status (To do/In progress/Done), Priority (Low/Medium/High), Due date, Life Area select, Goal select, **Business select** (this is where a task's `businessId` — and thus whether it shows up on this tab at all — is actually set/changed), Habit select, Estimate (minutes), "Daily action" checkbox, Recurrence (None/Daily/Weekly), a read-only "Linked to milestone: …" note when applicable, Cancel/Save, Delete link.

### 9-shared.4 Task Detail overlay (`#taskDetailPageBg`) — reachable via any task row's "📄 Open"
Title input, meta row (priority pill, due date, goal tag, business tag), Notes section with the same note/code-block-style editor as §7.6 (backed by the *separate* `main:taskBlocks` collection, not `main:dayBlocks`) — **not reproduced here**, out of scope for this tab's redesign.

---

## 10. Copy inconsistencies worth flagging (found while transcribing, not fixed)

1. **Checklist quick-add placeholder text differs by entry point** for the *same* `main:workflowChecklist` collection: the board's per-day quick-add says **"Quick-add a note item, press Enter…"**; the detail page's says **"Quick-add a checklist item, press Enter…"**.
2. **Delete-day confirm wording differs by entry point**: the board row's delete confirm says *"Its checklist items will be deleted too"* (no mention of blocks); the detail page's delete confirm says *"Its checklist items and blocks will be deleted too"*. Both actually delete both — the board row's copy just doesn't mention blocks.
3. **Delete-week confirm never mentions blocks at all**, even though deleting a week cascades through its days to their blocks too (via `removeWorkflowDay`).
4. **"Duplicate" is represented three different ways**: icon-only "⧉" (week header), "⧉ Duplicate" (day header), "⧉ Copy" (cross-business move row) — three different labels for a very similar underlying action (clone with reset progress).

## 11. Non-obvious behavior worth preserving (not visible as copy/fields, but load-bearing)

- **Workflow ↔ Tasks status mapping is lossy one direction**: `Blocked` (a WorkflowDay-only status) maps to Task status `todo` when pushed to a linked Task. Pushing the other way, a Task can only clear an existing `Blocked` day-status by actually reaching `done` — any other Task change leaves `Blocked` alone (prevents an unrelated Task edit from silently un-blocking a day).
- **Sync is one-hop, not a generic propagation hook** — `pushDayStatusToLinkedTask`/`pushTaskStatusToLinkedDay` are called only from the specific UI entry points that originate a change (the day status `<select>`, `setTaskDone`, the task edit modal's save), by construction preventing a Day→Task→Day ping-pong.
- **A WorkflowDay ↔ Task link lives only on the Task side** (`task.workflowDayId`), looked up via `taskForWorkflowDay(dayId)` — there is no back-reference stored on the day itself.
- **Duplicating a week/day always resets progress** (status → "Not started", checklist items → unchecked) and **never copies a linked Task** — duplication is for reusing structure, not snapshotting state.
- **Deleting a business does not delete its Workflow data** (weeks/days/checklist/blocks orphan silently) — only Goals/Tasks get their `businessId` nulled.
- **`order` is a free-floating numeric sort key**, not an index — reordering swaps two siblings' `order` values rather than renumbering the whole list; new records get `max(siblings) + 1`.
- **KPI/Goal/Task lists on this tab render in raw storage-array order** (KPIs, Goals) or a single sort key (Tasks, by due date) — none of them have their own filter/sort controls on this tab (Goals/Tasks each have their own filter/sort UI on their *own* tabs, not reproduced here).
- **The Amazon-KDP Workflow seed** (`seedKdpWorkflow()`, guarded by `main:kdpWorkflowSeeded`) runs once automatically on load: find-or-creates a business named exactly `"Amazon KDP"`, then find-or-creates 5 weeks (**Week 1, 2, 3, 4, 6 — deliberately no Week 5**) totaling 25 days, each with its own checklist items, using title-match idempotency so re-running it (if the guard flag is cleared) only fills in what's missing and never duplicates or resets existing progress. Content itself (day titles/checklist text) is data, not UI structure, and isn't transcribed here — see `WORKFLOW_SEED_PLAN` in source if needed.

---

## 12. Full data-layer reference

| Storage key | Shape | Owner |
|---|---|---|
| `main:businesses` | `[{ id, name, icon, description, notes, kpis: [{id,label,current,target}], workflowAutoSync, createdAt }]` | This tab (also read by Goals tab's business filter, Task modal's business select, Overview's Businesses summary) |
| `main:workflowWeeks` | `[{ id, businessId, title, order, collapsed, createdAt }]` | This tab |
| `main:workflowDays` | `[{ id, weekId, businessId, title, status, order, notes, createdAt }]` | This tab (`notes` is a legacy field, superseded by `main:dayBlocks`, kept only for one-time migration) |
| `main:workflowChecklist` | `[{ id, dayId, text, checked, order, createdAt }]` | This tab |
| `main:dayBlocks` | `[{ id, dayId, type: 'note'\|'code', content, language, order, createdAt }]` | This tab (Workflow Day detail page) |
| `main:kdpWorkflowSeeded` | boolean flag | This tab's one-time seed |
| `main:goals` (read+write) | filtered by `businessId` | Owned by Goals tab |
| `main:tasks` (read+write) | filtered by `businessId`; also carries `workflowDayId` (set only by this tab's Workflow↔Tasks integration) | Owned by Tasks tab |

All collections follow this app's flat-array-per-collection + id-as-foreign-key convention (documented in `CLAUDE.md` §4/changelog) — no nested blobs. Every `storeSet()` call (via the shared `storeGet`/`storeSet` helpers) dispatches a `goals-changed` custom event and a `storage` event, which is what drives re-render-on-change across tabs and incoming cloud sync (`initCloudSync({ appKey: 'goals', syncedPrefixes: ['goals:', 'main:'] })`, `index.html:6899` — no Businesses-specific sync wiring beyond the existing `main:` prefix, which every collection in this table already falls under).
