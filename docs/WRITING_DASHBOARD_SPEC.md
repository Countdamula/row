# Writing Dashboard — spec (placeholder)

**Status: not yet written.** This file is scaffolding only — created so
`docs/` has a home for the spec and so CLAUDE.md has something concrete to
point at once the real spec lands. Nothing under Business Hub's Writing tab
should be built from this file yet; there's no content here to build from.

## Confirmed scope so far

- Lives as a new tab inside `business.html` (Business Hub), alongside the
  existing Content / Ideas / Platforms / Resources tabs — not a standalone
  page, and not a client-side "route" (this app has no router at all; see
  `CLAUDE.md` §1).
- Nothing about the tab's actual content, layout, or data model has been
  specified yet.

## TODO before implementation starts

- [ ] Paste/attach the real spec content into this file.
- [ ] Confirm the tab's `layout` mode (`business-data.js`'s `BizTab.layout`
      is currently `'freeform' | 'content' | 'platforms'` — decide whether
      Writing reuses one of these or needs a new mode).
- [ ] Confirm what "ordering uses fractional-indexing string keys" applies
      to specifically — this is a new convention for this app; every
      existing reorderable list (Life Areas, Workflow weeks/days, Dream
      Board/Business Hub board widgets, etc.) uses a numeric `order` field
      with swap-adjacent-values reordering instead. Fractional indexing is
      fine to introduce for this feature alone, but it won't match any
      sibling feature's code if someone goes looking for precedent.
- [ ] Resolve the "every table gets user_id + RLS" rule against this app's
      actual Supabase model — see the CLAUDE.md note added alongside this
      file for why that can't be followed literally as written.
