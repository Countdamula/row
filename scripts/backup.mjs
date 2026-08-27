// =============================================================
// scripts/backup.mjs — the nightly off-device copy.
//
// This is the only protection layer that survives losing every
// device you own. Snapshots and the Trash live in the same
// IndexedDB as the data they protect; the cloud row is one
// last-writer-wins blob per app that a bad push can flatten. Both
// protect you from YOU. This protects you from the system.
//
// Run by .github/workflows/backup.yml, and by hand:
//
//   SUPABASE_URL=... SUPABASE_KEY=... OUT_DIR=../store \
//     node scripts/backup.mjs
//
// No dependencies, no build step, node builtins only — the same
// rule the rest of this repo lives by.
//
// -------------------------------------------------------------
// §WHERE — why the payloads are not committed to `main`
//
// This repo is private, but the SITE IS NOT. Vercel serves the
// repo root as static files with no vercel.json and no
// .vercelignore, so a journal committed to `main` under backups/
// would be readable by anyone who guessed
// https://<site>/backups/2026-08-27/asclepion.json.
//
// Checking that the repo is private is not enough; what matters
// is what gets DEPLOYED. So the payloads go to an orphan
// `backups` branch, which Vercel never builds and which shares no
// history with main. That is a structural guarantee rather than a
// configuration one: a .vercelignore protects the manuscript only
// until someone edits it.
//
// Only `backup-status.json` — dates, counts and byte sizes, no
// content — goes anywhere the site can see.
//
// §STABLE — why the JSON is sorted and pretty-printed
//
// Object keys are sorted recursively and the file is indented.
// Compact JSON on one line means a single edited word rewrites the
// entire blob, and 90 nightly copies of a manuscript pack badly.
// One value per line, in a stable order, means git stores the days
// as small deltas and `git diff` between two nights is readable.
// Array order is left alone — in this data, order is meaning.
//
// §LOUD — an empty backup is worse than no backup
//
// A job that quietly commits `{}` every night still turns the
// ledger green. Every failure here is fatal and nothing is
// written: no rows, a bad status, a row whose data is missing.
// A row that merely SHRANK is different — that is real data and it
// gets written — but it is recorded as an anomaly in the manifest
// so the workflow can fail the run after the commit lands.
// =============================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const URL_ = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_KEY || '';
const OUT_DIR = process.env.OUT_DIR || 'store';
const STATUS_PATH = process.env.STATUS_PATH || '';
const TABLE = 'app_state';

// Retention, matching the daily / weekly / monthly tiers asked for.
const KEEP_DAILY_DAYS = 14;
const KEEP_WEEKLY_DAYS = 90;      // Sundays
const KEEP_MONTHLY_DAYS = 1095;   // the 1st, for three years

// A row bigger than this is not necessarily wrong, but it is worth saying.
const BIG_ROW_BYTES = 20 * 1024 * 1024;
// A row that lost more than this much of itself since the last backup.
const SHRINK_RATIO = 0.5;

// Throw rather than process.exit(): calling exit() while a fetch response is
// still being read aborts the event loop mid-handle and Node dies with a
// libuv assertion and exit code 127 instead of a clean 1. A backup job that
// crashes where it meant to fail politely still fails the workflow, but the
// log then says nothing useful about why.
class BackupError extends Error {}
const die = (msg) => { throw new BackupError(msg); };

if (!URL_ || !KEY) die('SUPABASE_URL and SUPABASE_KEY must both be set.');

// -----------------------------------------------------------------
// §STABLE — recursive key sort, arrays untouched.
// -----------------------------------------------------------------
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sorted(v[k]);
    return out;
  }
  return v;
}

const stamp = (d) => d.toISOString().slice(0, 10);
const safe = (k) => String(k).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'row';

/** How many records a row holds, for a manifest line a person can read. */
function countRecords(data) {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (Array.isArray(v)) n += v.length;
    else if (v && typeof v === 'object') n += Object.keys(v).length;
    else n += 1;
  }
  return n;
}

// -----------------------------------------------------------------
// FETCH — every row, not a list this script keeps in step by hand.
//
// Asking for `select=*` rather than naming the apps means a tenth
// dashboard added next year is backed up the night it exists. A
// hardcoded list is the failure mode where the backup looks healthy
// for months and is missing the one thing you needed.
// -----------------------------------------------------------------
async function fetchRows() {
  const url = URL_.replace(/\/+$/, '') +
    '/rest/v1/' + TABLE + '?select=key,data,updated_at&order=key.asc';
  let res;
  try {
    res = await fetch(url, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' },
    });
  } catch (e) {
    die('could not reach Supabase: ' + e.message);
  }
  if (!res.ok) die('Supabase answered ' + res.status + ' ' + res.statusText + ' — ' + (await res.text()).slice(0, 300));
  const rows = await res.json();
  if (!Array.isArray(rows)) die('expected an array of rows, got ' + typeof rows);
  // §LOUD. Zero rows means the key lost its permission, the table was
  // renamed, or something worse. It never means "you have no data".
  if (!rows.length) die('the table returned NO ROWS. Refusing to write an empty backup.');
  return rows;
}

// -----------------------------------------------------------------
// The most recent backup already on the branch, to compare against.
// -----------------------------------------------------------------
function datedDirs() {
  if (!existsSync(OUT_DIR)) return [];
  return readdirSync(OUT_DIR)
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && statSync(join(OUT_DIR, n)).isDirectory())
    .sort();
}

function previousManifest(today) {
  const dirs = datedDirs().filter((d) => d < today);
  for (let i = dirs.length - 1; i >= 0; i--) {
    const p = join(OUT_DIR, dirs[i], 'manifest.json');
    if (!existsSync(p)) continue;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { /* keep looking */ }
  }
  return null;
}

// -----------------------------------------------------------------
// PRUNE — daily, then weekly, then monthly.
// -----------------------------------------------------------------
function prune(today) {
  const now = Date.parse(today + 'T00:00:00Z');
  const dropped = [];
  for (const d of datedDirs()) {
    if (d === today) continue;
    const t = Date.parse(d + 'T00:00:00Z');
    if (Number.isNaN(t)) continue;
    const age = Math.round((now - t) / 86400000);
    const dow = new Date(t).getUTCDay();       // 0 = Sunday
    const dom = new Date(t).getUTCDate();
    const keep =
      age <= KEEP_DAILY_DAYS ||
      (dow === 0 && age <= KEEP_WEEKLY_DAYS) ||
      (dom === 1 && age <= KEEP_MONTHLY_DAYS);
    if (keep) continue;
    rmSync(join(OUT_DIR, d), { recursive: true, force: true });
    dropped.push(d);
  }
  return dropped;
}

// -----------------------------------------------------------------
async function main() {
  const today = stamp(new Date());
  const rows = await fetchRows();
  const prev = previousManifest(today);
  const prevByKey = {};
  if (prev && Array.isArray(prev.rows)) for (const r of prev.rows) prevByKey[r.key] = r;

  const dir = join(OUT_DIR, today);
  mkdirSync(dir, { recursive: true });

  const manifest = {
    date: today,
    generatedAt: new Date().toISOString(),
    table: TABLE,
    rows: [],
    totals: { rows: 0, bytes: 0, records: 0 },
    anomalies: [],
  };

  for (const row of rows) {
    const key = row && row.key;
    if (!key) die('a row came back with no key at all.');
    // §LOUD. A present row with absent data is the shape of a wipe.
    if (row.data == null) die('row "' + key + '" has no data. Refusing to write it as empty.');

    const body = JSON.stringify(sorted(row.data), null, 2) + '\n';
    const file = safe(key) + '.json';
    writeFileSync(join(dir, file), body);

    const entry = {
      key,
      file,
      bytes: Buffer.byteLength(body),
      records: countRecords(row.data),
      updatedAt: row.updated_at || null,
    };
    manifest.rows.push(entry);
    manifest.totals.rows++;
    manifest.totals.bytes += entry.bytes;
    manifest.totals.records += entry.records;

    if (entry.bytes > BIG_ROW_BYTES) {
      manifest.anomalies.push({ kind: 'large', key, bytes: entry.bytes });
    }
    // The same question the shrink banner asks, one layer further out:
    // did this get materially SMALLER than the last copy we hold?
    const was = prevByKey[key];
    if (was && was.records > 0 && entry.records < was.records * SHRINK_RATIO) {
      manifest.anomalies.push({
        kind: 'shrank', key, was: was.records, now: entry.records, since: prev.date,
      });
    }
  }

  // A row that existed last time and is simply gone now.
  for (const k of Object.keys(prevByKey)) {
    if (manifest.rows.some((r) => r.key === k)) continue;
    manifest.anomalies.push({ kind: 'missing', key: k, since: prev.date });
  }

  const dropped = prune(today);
  manifest.pruned = dropped;
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // -----------------------------------------------------------------
  // §WHERE. The only thing the deployed site is allowed to see: when
  // the backup last ran and how big it was. No content, ever.
  // -----------------------------------------------------------------
  if (STATUS_PATH) {
    const status = {
      lastBackup: today,
      generatedAt: manifest.generatedAt,
      apps: manifest.totals.rows,
      records: manifest.totals.records,
      bytes: manifest.totals.bytes,
      retained: datedDirs().length,
      healthy: manifest.anomalies.length === 0,
    };
    writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + '\n');
  }

  console.log('✓ ' + today + ' — ' + manifest.totals.rows + ' apps, ' +
    manifest.totals.records + ' records, ' +
    (manifest.totals.bytes / 1024).toFixed(1) + ' KB');
  for (const r of manifest.rows) {
    console.log('   ' + r.key.padEnd(16) + String(r.records).padStart(6) + ' records  ' +
      (r.bytes / 1024).toFixed(1) + ' KB');
  }
  if (dropped.length) console.log('   pruned ' + dropped.length + ' old backup(s): ' + dropped.join(', '));
  if (manifest.anomalies.length) {
    console.log('\n⚠ ' + manifest.anomalies.length + ' anomaly/anomalies — the backup was still written:');
    for (const a of manifest.anomalies) console.log('   ' + JSON.stringify(a));
  }
}

main().catch((e) => {
  console.error('✗ ' + (e instanceof BackupError ? e.message : (e && e.stack) || String(e)));
  console.error('  Nothing was written. Tonight has no backup — fix this before it is two nights.');
  process.exitCode = 1;
});
