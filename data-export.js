// =============================================================
// data-export.js — get your work out of here.
//
// WHY THIS EXISTS
// Three apps could export and six could not, by three different
// mechanisms: MainSync.download, LarSync.download and kdp-data.js's
// own collectAll/download pair. The Athenaeum, The Vault, Business
// OS and the Learning Dashboard had no way out at all, and
// AscSync.download existed but was called from no HTML — reachable
// only from a console.
//
// The point of an export is not the backup. Snapshots and the
// nightly job are the backup. The point is that this dashboard must
// not be the only place your writing can exist: a JSON file is a
// restore, and a Markdown file is something you can still read in
// ten years with no dashboard at all.
//
// REGISTRY-DRIVEN. Every app's prefixes come from data-registry.js,
// so adding an app to the export is a table row, not a new
// exporter — which is exactly how six of them came to be missing.
//
// NO PER-APP FIELD MAPS. The Markdown renderer works from the shape
// of a record rather than from a schema: a heading from whatever
// field reads like a name, prose fields as paragraphs, short fields
// as a small label list. That is uglier than a hand-written
// formatter for one app and it is the reason all nine work, and
// keep working when a record gains a field.
// =============================================================

(function (global) {
  'use strict';

  function reg() { return global.DataRegistry; }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function rawGet(k) {
    try { var v = localStorage.getItem(k); return v == null ? null : v; } catch (e) { return null; }
  }

  /** Every live key under an app's prefixes. */
  function keysFor(app) {
    var prefixes = reg().prefixesOf(app);
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && prefixes.some(function (p) { return k.indexOf(p) === 0; })) out.push(k);
      }
    } catch (e) {}
    return out.sort();
  }

  // -----------------------------------------------------------------
  // THE DOWNLOAD
  //
  // Returns false rather than throwing when the browser refuses. Callers
  // that are about to delete something must check it — see kdp-data.js's
  // archiveTrilogy, which forces a backup and aborts the archive if the
  // download did not start. An export that silently failed and a delete
  // that went ahead anyway is the worst pair of outcomes available.
  // -----------------------------------------------------------------
  function download(name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 400);
      return true;
    } catch (e) { return false; }
  }

  // -----------------------------------------------------------------
  // JSON — the restore format
  // -----------------------------------------------------------------
  /**
   * @param {string[]} [appIds] omit for every app
   * @returns {object} { exportedAt, version, apps: { id: { label, keys:{} } } }
   */
  function bundle(appIds) {
    var R = reg();
    var apps = (appIds && appIds.length)
      ? appIds.map(function (id) { return R.app(id); }).filter(Boolean)
      : R.APPS;
    var out = { exportedAt: new Date().toISOString(), version: 1, apps: {} };
    apps.forEach(function (app) {
      var keys = {};
      keysFor(app).forEach(function (k) {
        var raw = rawGet(k);
        if (raw == null) return;
        try { keys[k] = JSON.parse(raw); } catch (e) { keys[k] = raw; }
      });
      out.apps[app.id] = { label: app.label, rows: Object.keys(app.rows), keys: keys };
    });
    return out;
  }

  function json(appIds, filename) {
    var data = bundle(appIds);
    var one = appIds && appIds.length === 1 ? appIds[0] : 'dashboard';
    return {
      ok: download(filename || (one + '-' + stamp() + '.json'),
        JSON.stringify(data, null, 2), 'application/json'),
      apps: Object.keys(data.apps).length,
      keys: Object.keys(data.apps).reduce(function (n, id) {
        return n + Object.keys(data.apps[id].keys).length;
      }, 0)
    };
  }

  // -----------------------------------------------------------------
  // MARKDOWN — the readable format
  // -----------------------------------------------------------------
  var NAME_FIELDS = ['name', 'title', 'label', 'heading', 'term', 'question', 'word'];
  var DATE_FIELDS = ['date', 'createdAt', 'created', 'at', 'when', 'day', 'updatedAt'];
  var SKIP_FIELDS = ['id', 'order', 'uid', 'parentId', 'color', 'colour', 'icon', 'cover', 'image'];

  function isProse(v) {
    return typeof v === 'string' && (v.length > 90 || v.indexOf('\n') !== -1);
  }
  function titleCase(k) {
    return String(k)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function fmtDate(v) {
    if (typeof v === 'number' && v > 1e11) { try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return String(v); } }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return null;
  }

  function recordToMd(rec, depth) {
    var h = new Array(depth + 1).join('#');
    var lines = [], name = null, when = null;
    // Remember WHICH fields became the heading and the date line, so they are
    // not then repeated in the fact list underneath — a record that says
    // "*2026-08-27*" and then "**Created At:** 2026-08-27T03:35:55.102Z" is
    // saying the same thing twice, the second time less legibly.
    var nameField = null, dateField = null;
    var i, f;
    for (i = 0; i < NAME_FIELDS.length && name == null; i++) {
      f = rec[NAME_FIELDS[i]];
      if (typeof f === 'string' && f.trim()) { name = f.trim(); nameField = NAME_FIELDS[i]; }
    }
    for (i = 0; i < DATE_FIELDS.length && when == null; i++) {
      if (rec[DATE_FIELDS[i]] == null) continue;
      when = fmtDate(rec[DATE_FIELDS[i]]);
      if (when) dateField = DATE_FIELDS[i];
    }
    lines.push(h + ' ' + (name || 'Untitled'));
    if (when) lines.push('*' + when + '*');

    var facts = [], prose = [];
    Object.keys(rec).forEach(function (k) {
      if (SKIP_FIELDS.indexOf(k) !== -1) return;
      if (k === nameField || k === dateField) return;
      var v = rec[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      if (isProse(v)) { prose.push({ k: k, v: v }); return; }
      if (typeof v === 'object') {
        // A nested collection: render its records one level down rather than
        // dumping JSON into a document meant to be read.
        if (Array.isArray(v) && v.every(function (x) { return x && typeof x === 'object'; })) {
          prose.push({ k: k, nested: v });
          return;
        }
        facts.push({ k: k, v: JSON.stringify(v) });
        return;
      }
      facts.push({ k: k, v: String(v) });
    });

    if (facts.length) {
      lines.push('');
      facts.forEach(function (x) { lines.push('- **' + titleCase(x.k) + ':** ' + x.v); });
    }
    prose.forEach(function (x) {
      lines.push('');
      lines.push('**' + titleCase(x.k) + '**');
      lines.push('');
      if (x.nested) {
        x.nested.forEach(function (child) { lines.push(recordToMd(child, depth + 1)); });
      } else {
        lines.push(String(x.v).replace(/\r\n/g, '\n'));
      }
    });
    return lines.join('\n') + '\n';
  }

  function collectionToMd(key, raw, depth) {
    var v;
    try { v = JSON.parse(raw); } catch (e) { return null; }
    var short = key.replace(/^[^:]+:/, '');
    var head = new Array(depth + 1).join('#') + ' ' + titleCase(short);
    var body = [];

    if (Array.isArray(v)) {
      if (!v.length) return null;
      if (!v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) {
        body.push(v.map(function (x) { return '- ' + String(x); }).join('\n'));
      } else {
        v.forEach(function (rec) { body.push(recordToMd(rec, depth + 1)); });
      }
    } else if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (!keys.length) return null;
      var allObjects = keys.every(function (k) { return v[k] && typeof v[k] === 'object'; });
      if (!allObjects) return null;      // a settings object: not a document
      keys.sort().forEach(function (k) {
        var rec = v[k];
        if (Array.isArray(rec)) {
          if (!rec.length) return;
          body.push(new Array(depth + 2).join('#') + ' ' + k);
          rec.forEach(function (r) {
            body.push(r && typeof r === 'object' ? recordToMd(r, depth + 2) : '- ' + String(r));
          });
          return;
        }
        if (!rec.date && !rec.createdAt && /^\d{4}-\d{2}-\d{2}/.test(k)) rec = Object.assign({ date: k }, rec);
        body.push(recordToMd(rec, depth + 1));
      });
    } else { return null; }

    if (!body.length) return null;
    return head + '\n\n' + body.join('\n');
  }

  /** One readable document per app. */
  function markdownFor(appId) {
    var app = reg().app(appId);
    if (!app) return null;
    var parts = [
      '# ' + app.label,
      '',
      '*Exported ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '*',
      ''
    ];
    var wrote = 0;
    keysFor(app).forEach(function (k) {
      var raw = rawGet(k);
      if (raw == null) return;
      var md = collectionToMd(k, raw, 2);
      if (!md) return;
      parts.push(md, '');
      wrote++;
    });
    if (!wrote) return null;
    return parts.join('\n');
  }

  function markdown(appId, filename) {
    var md = markdownFor(appId);
    if (!md) return { ok: false, empty: true };
    return { ok: download(filename || (appId + '-' + stamp() + '.md'), md, 'text/markdown;charset=utf-8'), empty: false };
  }

  /**
   * Everything, as one Markdown document. Not a zip — this repo has no
   * build step and no compression library, and a single readable file is
   * more use than an archive you have to unpack to find one journal entry.
   */
  function markdownAll(filename) {
    var parts = ['# Personal dashboard', '',
      '*Exported ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '*', ''];
    var wrote = 0;
    reg().APPS.forEach(function (app) {
      var md = markdownFor(app.id);
      if (!md) return;
      parts.push(md.split('\n').slice(1).join('\n'));   // drop its own H1
      parts.push('');
      wrote++;
    });
    if (!wrote) return { ok: false, empty: true };
    return { ok: download(filename || 'dashboard-' + stamp() + '.md',
      parts.join('\n'), 'text/markdown;charset=utf-8'), empty: false, apps: wrote };
  }

  /** Which apps actually hold anything on this device. */
  function appsWithData() {
    return reg().APPS.filter(function (a) { return keysFor(a).length > 0; })
      .map(function (a) { return { id: a.id, label: a.label, keys: keysFor(a).length }; });
  }

  global.DataExport = {
    bundle: bundle,
    json: json,
    markdown: markdown,
    markdownFor: markdownFor,
    markdownAll: markdownAll,
    appsWithData: appsWithData,
    keysFor: function (appId) { var a = reg().app(appId); return a ? keysFor(a) : []; },
    download: download
  };
})(window);
