# backups

Nightly copies of the dashboard's Supabase `app_state` rows, written by
[`.github/workflows/backup.yml`](https://github.com/Countdamula/row/blob/main/.github/workflows/backup.yml)
on `main`.

**This branch shares no history with `main`, and that is the point.**

The repo is private; the *site is not*. Vercel serves `main`'s root as
static files, so a journal committed there under `backups/` would be
readable by anyone who guessed the URL. Vercel never builds this branch,
so nothing here is ever served. That is a structural guarantee rather
than a configuration one — a `.vercelignore` protects the manuscript
only until someone edits it.

Nothing here is code. Never merge this branch into `main`.

## Layout

```
YYYY-MM-DD/
  manifest.json     what was captured, byte sizes, record counts, anomalies
  <row-key>.json    one file per app row, keys sorted, pretty-printed
```

Keys are sorted and the JSON is indented so git stores each night as a
small delta against the last, and so `git diff` between two nights is
something a person can read.

## Retention

| Kept | For |
|---|---|
| every day | 14 days |
| Sundays | 90 days |
| the 1st of the month | 3 years |

## Restoring

Read the day you want, then in the dashboard open **Data & Recovery →
Restore from a file** and hand it the app's JSON. That path only adds and
overwrites — it never deletes — so a file missing something cannot take
that thing away from you.
