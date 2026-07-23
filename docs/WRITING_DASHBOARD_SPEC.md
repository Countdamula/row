# Writing Dashboard — spec (implemented)

**Status: built.** This is no longer a placeholder — the Writing Dashboard
is a 5th tab inside `business.html` (Business Hub), `layout: 'writing'`. The
full narrative writeup (what was built, in what order, and every disclosed
scope adaptation) lives in `CLAUDE.md`'s own Changelog, under "New: Writing
Dashboard — a 5th Business Hub tab." Read that entry first; this file is the
quick-reference version.

## Files

- `writing-data.js` — data layer for every Writing Dashboard collection
  (companion file to `business.html`, same convention as
  `household.html`+`household-data.js`). Every key is `business:*`-prefixed
  so it rides `business.html`'s existing `initCloudSync({ appKey:
  'business', syncedPrefixes: ['business:'] })` call — no new sync
  mechanism.
- `business-data.js` — one-line change: `tabModel()`'s `layout` whitelist
  gained `'writing'`. `seedDefaultBoard()` seeds the 5th tab plus 3 hidden
  `isWritingSubpage: true` tabs (Outlines / More Notes / Automation Ideas,
  each a real freeform board reusing the existing widget engine).
- `business.html` — the entire UI: landing page (article + visual board +
  sub-nav), Manuscript Detail overlay, Tasks Inline Database, Manuscript
  Binder (full-page), Compile & Export.

## Data model (`writing-data.js`, `WritingData` global)

| Collection | Shape | Notes |
|---|---|---|
| `Series` | `{id, title, order, description, tint}` | numeric `order` |
| `Manuscripts` | `{id, seriesId, title, kind, status, order, platform, niche, estimatedGrowthDuration, goalRevenueCents, goalProfitCents, todaysGoalCurrent/Target/Unit, progressBarColor, currentBinderNodeId, manuscriptWordGoal, notes:[]}` | deleting a Series nulls `seriesId` on its manuscripts (doesn't delete them); deleting a Manuscript cascades its Tasks/BinderNodes/trackers |
| `Tasks` (`WritingTask`) | `{id, manuscriptId, parentTaskId, title, summary, status, priority, dueDate, blocks:[], order}` | a root task (`parentTaskId: null`) is a "template," its children are "sub-pages"; `blocks` are note/code sections, same shape as `business-data.js`'s WorkflowDay blocks |
| `BinderNodes` | `{id, manuscriptId, parentId, type: 'part'\|'chapter'\|'scene', title, orderKey, content, chapterNotes, wordGoal}` | **`orderKey` is a fractional-indexing string** (`WritingData.midKey()`) — the one list in this app that isn't numeric `order` + swap, since it's a real drag-anywhere tree |
| `PlotThreads` / `ContinuityItems` / `Characters` | `{id, manuscriptId, name, description/bio+traits, mentions:[{id,nodeId,snippet}], order}` | mentions are added via a "tag selected text" action or the "scan this chapter" substring-match auto-fill — no LLM involved |
| `Ideas` (`WritingIdea`) | `{id, title, pitch, tags:[], status, notes, order}` | its own small CRUD gallery, not a freeform board |
| `Article` (singleton) | `{title, blocks:[{id, type: 'heading'\|'paragraph'\|'callout', calloutStyle, text, order}]}` | the "Your Novel in 30 Days" section above the board |
| `Theme` (singleton) | `{activeThemeId, customThemes:[{id,name,tokens}]}` | 5 built-in presets + custom; applied as `--wr-theme-*` custom properties scoped to `#bhWritingDashboard` only |

## Confirmed scope decisions (asked, not assumed)

- Tracker "auto-fill" = tag-selected-text + a chapter-scan button, not NLP
  (no active LLM key anywhere in this app).
- No "Kindle-compatible" export — skipped per the user's own choice.
- PDF = a print-formatted view + native browser Print → Save as PDF, not a
  hand-rolled PDF byte generator.
- Tasks Inline Database reorders via up/down arrows, not drag (same call
  this app's own Workflow Weeks/Days already made for a real parent/child
  list).

See `CLAUDE.md`'s changelog entry for the full build narrative, every
component reused from elsewhere in this app, and the headless-Edge
verification notes for each phase.
