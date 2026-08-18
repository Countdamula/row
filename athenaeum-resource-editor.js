/* =====================================================================
   athenaeum-resource-editor.js — the one editor for a resource.

   WHY THIS IS SHARED AND NOT PASTED TWICE. A resource is created and
   edited from two places (the Library and a resource's own page), and
   `resourceModel` is a field WHITELIST — a field the form forgets is
   silently dropped from the record the next time it is saved. Two copies
   of this form means every new field has to be added in three places and
   the one that gets missed loses data quietly. So: one form, one save.

   It brings its own dialog and its own stylesheet rather than borrowing
   the host page's modal, so a page can adopt the editor without also
   adopting a modal kit. It uses only --ath-* tokens, which every
   Athenaeum page defines, so it inherits whatever ground it is opened on.

     AthResourceEditor.open(resourceOrNull, {
       toast:   fn(message, isBad),      // optional
       onSaved: fn(record, isNew),       // optional
       preset:  { subjectIds: ['psych'] } // optional, NEW resources only —
     })                                  // e.g. a field hub filing into itself
   ===================================================================== */
(function () {
  'use strict';

  function D() { return window.Athenaeum; }
  function esc(s) { return D().esc(s); }
  function $(id) { return document.getElementById(id); }

  var CSS = [
    '.are-bg{position:fixed; inset:0; z-index:140; background:rgba(12,14,18,.62);',
    '  backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; padding:var(--sp-5,26px)}',
    '.are-bg.show{display:flex; animation:are-fade .24s var(--ath-ease, ease)}',
    '@keyframes are-fade{from{opacity:0; transform:translateY(9px)} to{opacity:1; transform:none}}',
    /* A dialog is the one thing on these pages that SHOULD have an edge:
       at the ground's own value it dissolves into its own backdrop. */
    '.are-dlg{background:var(--ath-panel,#171C24); width:min(940px,100%); max-height:88vh; overflow:auto;',
    '  border:1px solid var(--ath-rule,rgba(242,239,232,.13)); border-radius:var(--ath-r,3px);',
    '  box-shadow:0 40px 90px -40px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.4)}',
    '.are-head{display:flex; align-items:center; justify-content:space-between; gap:18px;',
    '  padding:26px 26px 18px; border-bottom:1px solid var(--ath-rule-soft,rgba(242,239,232,.065));',
    '  position:sticky; top:0; background:var(--ath-panel,#171C24); z-index:2}',
    '.are-head h3{margin:0; font-family:var(--ath-display,Georgia,serif); font-weight:400; font-size:24px;',
    '  letter-spacing:.05em; text-transform:uppercase; color:var(--ath-ink,#F2EFE8)}',
    '.are-body{padding:26px; display:grid; gap:18px}',
    '.are-foot{display:flex; justify-content:flex-end; gap:12px; padding:18px 26px 26px;',
    '  border-top:1px solid var(--ath-rule-soft,rgba(242,239,232,.065))}',
    '.are-f{display:grid; gap:7px}',
    '.are-lab{font-size:10.5px; font-weight:600; letter-spacing:.14em; text-transform:uppercase;',
    '  color:var(--ath-ink-3,rgba(242,239,232,.52)); font-family:var(--ath-ui,sans-serif)}',
    '.are-hint{margin:0; font-size:12.5px; color:var(--ath-ink-3,rgba(242,239,232,.52)); font-family:var(--ath-prose,Georgia,serif)}',
    '.are-row{display:grid; grid-template-columns:1fr 1fr; gap:18px}',
    '@media (max-width:620px){ .are-row{grid-template-columns:1fr} }',
    '.are-in,.are-sel,.are-ta{width:100%; padding:10px 12px; background:var(--ath-paper-2,#12161C);',
    '  color:var(--ath-ink,#F2EFE8); border:1px solid var(--ath-rule,rgba(242,239,232,.13));',
    '  border-radius:var(--ath-r-sm,2px); font:inherit; font-size:14px;',
    '  transition:border-color .2s var(--ath-ease,ease), background-color .2s var(--ath-ease,ease)}',
    '.are-ta{font-family:var(--ath-prose,Georgia,serif); font-size:15px; line-height:1.6; resize:vertical}',
    '.are-in:focus,.are-sel:focus,.are-ta:focus{outline:none; border-color:var(--ath-verd-hi,#5A9E8C); background:var(--ath-panel,#171C24)}',
    // Phone: under 16px iOS Safari zooms the page in on focus and never
    // zooms back out, so adding one resource leaves the library magnified.
    '@media (max-width:768px){',
    '  .are-in,.are-sel,.are-ta{font-size:16px; padding:12px}',
    '  .are-chip{padding:9px 14px; font-size:12.5px}',
    '}',
    '.are-chips{display:flex; gap:6px; flex-wrap:wrap}',
    '.are-chip{padding:6px 12px; border:1px solid var(--ath-rule,rgba(242,239,232,.13)); border-radius:999px;',
    '  font-size:11.5px; color:var(--ath-ink-3,rgba(242,239,232,.52)); background:transparent; cursor:pointer;',
    '  transition:border-color .2s var(--ath-ease,ease), color .2s var(--ath-ease,ease), background-color .2s var(--ath-ease,ease)}',
    '.are-chip:hover{border-color:var(--ath-ink-3,rgba(242,239,232,.52)); color:var(--ath-ink-2,rgba(242,239,232,.72))}',
    '.are-chip.is-on{border-color:var(--ath-verd,#3D7668); background:var(--ath-verd,#3D7668); color:#fff}',
    '.are-inline{display:flex; gap:8px; align-items:stretch}',
    '.are-inline .are-in{flex:1}',
    '.are-cover{display:grid; grid-template-columns:96px minmax(0,1fr); gap:18px; align-items:start}',
    '.are-prev{position:relative; width:96px; aspect-ratio:3/4; overflow:hidden; border-radius:var(--ath-r-sm,2px);',
    '  background:var(--ath-paper-2,#12161C); border:1px solid var(--ath-rule,rgba(242,239,232,.13))}',
    '.are-prev img{width:100%; height:100%; object-fit:cover; display:block}',
    '.are-prev i{position:absolute; inset:0; background:',
    '  repeating-radial-gradient(circle at 62% 34%, rgba(242,239,232,.10) 0 1px, transparent 1px 13px),',
    '  linear-gradient(148deg, hsl(var(--h,210) 22% 26%), hsl(calc(var(--h,210) + 22) 24% 12%))}',
    '.are-file{display:inline-flex; align-items:center; gap:8px; padding:8px 14px;',
    '  border:1px solid var(--ath-rule,rgba(242,239,232,.13)); border-radius:var(--ath-r-sm,2px);',
    '  font-size:11.5px; color:var(--ath-ink-2,rgba(242,239,232,.72)); cursor:pointer;',
    '  transition:border-color .2s var(--ath-ease,ease), color .2s var(--ath-ease,ease)}',
    '.are-file:hover{border-color:var(--ath-ink,#F2EFE8); color:var(--ath-ink,#F2EFE8)}',
    '.are-file input{display:none}',
    '.are-btn{display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:8px 14px;',
    '  border:1px solid var(--ath-ink,#F2EFE8); background:transparent; color:var(--ath-ink,#F2EFE8);',
    '  font-size:11.5px; font-weight:500; letter-spacing:.06em; border-radius:var(--ath-r-sm,2px); cursor:pointer;',
    '  transition:background-color .22s var(--ath-ease,ease), color .22s var(--ath-ease,ease), transform .22s var(--ath-spring,ease), border-color .22s var(--ath-ease,ease)}',
    '.are-btn:hover{background:var(--ath-ink,#F2EFE8); color:var(--ath-paper,#0A0C0F); transform:translateY(-1px)}',
    '.are-btn:disabled{opacity:.5; cursor:default; transform:none}',
    '.are-btn-solid{background:var(--ath-ink,#F2EFE8); color:var(--ath-paper,#0A0C0F)}',
    '.are-btn-solid:hover{background:var(--ath-verd,#3D7668); border-color:var(--ath-verd,#3D7668); color:#fff}',
    '.are-btn-ghost{border-color:var(--ath-rule,rgba(242,239,232,.13)); color:var(--ath-ink-2,rgba(242,239,232,.72))}',
    '.are-btn-ghost:hover{background:var(--ath-ink,#F2EFE8); border-color:var(--ath-ink,#F2EFE8); color:var(--ath-paper,#0A0C0F)}',
    '.are-x{width:34px; height:34px; padding:0; border:1px solid var(--ath-rule,rgba(242,239,232,.13));',
    '  border-radius:var(--ath-r-sm,2px); color:var(--ath-ink-2,rgba(242,239,232,.72)); font-size:14px; cursor:pointer;',
    '  display:inline-flex; align-items:center; justify-content:center; background:none}',
    '.are-x:hover{background:var(--ath-ink,#F2EFE8); color:var(--ath-paper,#0A0C0F)}',
    /* The restored-draft notice. Verdigris rather than a warning colour:
       putting your work back is good news, not an error. */
    '.are-restored{display:flex; align-items:center; justify-content:space-between; gap:12px;',
    '  padding:11px 26px; background:rgba(var(--ath-verd-rgb,61,118,104),.16);',
    '  border-bottom:1px solid rgba(var(--ath-verd-rgb,61,118,104),.4);',
    '  font-family:var(--ath-ui,sans-serif); font-size:12.5px; color:var(--ath-verd-hi,#5A9E8C)}',
    '.are-restored[hidden]{display:none}',
    '.are-restored button{background:none; border:0; cursor:pointer; padding:0;',
    '  color:inherit; font:inherit; text-decoration:underline; text-underline-offset:3px; white-space:nowrap}',
    '.are-restored button:hover{color:var(--ath-ink,#F2EFE8)}'
  ].join('\n');

  var ctx = null;          // { res, opts }
  var draftCover = null;   // held outside the form: it arrives asynchronously
  var mounted = false;
  var draft = null;        // the autosave handle for the open form
  var draftScope = '';

  function hueOf(seed) {
    var s = String(seed || ''), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 360;
    return n;
  }
  function say(msg, bad) {
    if (ctx && ctx.opts && typeof ctx.opts.toast === 'function') ctx.opts.toast(msg, bad);
  }

  // ---------- field builders -----------------------------------------
  function fText(label, key, val, ph) {
    return '<div class="are-f"><label class="are-lab" for="ar_' + key + '">' + esc(label) + '</label>' +
      '<input class="are-in" id="ar_' + key + '" data-f="' + key + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"></div>';
  }
  function fArea(label, key, val, ph, rows) {
    return '<div class="are-f"><label class="are-lab" for="ar_' + key + '">' + esc(label) + '</label>' +
      '<textarea class="are-ta" id="ar_' + key + '" data-f="' + key + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>';
  }
  function fSelect(label, key, val, opts) {
    return '<div class="are-f"><label class="are-lab" for="ar_' + key + '">' + esc(label) + '</label>' +
      '<select class="are-sel" id="ar_' + key + '" data-f="' + key + '">' + opts.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (String(o.id) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select></div>';
  }
  function fHint(t) { return '<p class="are-hint">' + esc(t) + '</p>'; }
  function fRow(a, b) { return '<div class="are-row">' + a + b + '</div>'; }
  /* Visible toggles writing a comma-joined hidden input, which values()
     then reads like any other field. */
  function fChips(label, key, selected, opts, hint) {
    var sel = (selected || []).slice();
    return '<div class="are-f"><span class="are-lab">' + esc(label) + '</span>' +
      (hint ? '<p class="are-hint">' + esc(hint) + '</p>' : '') +
      '<div class="are-chips" data-chips="' + key + '">' + opts.map(function (o) {
        var on = sel.indexOf(o.id) >= 0;
        return '<button class="are-chip' + (on ? ' is-on' : '') + '" type="button" data-chip="' + esc(o.id) + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(o.label) + '</button>';
      }).join('') + '</div>' +
      '<input type="hidden" data-f="' + key + '" id="ar_' + key + '" value="' + esc(sel.join(',')) + '"></div>';
  }

  function paintPrev() {
    var el = $('arePrev');
    if (!el) return;
    var url = draftCover && draftCover.url;
    el.innerHTML = url ? '<img src="' + esc(url) + '" alt="">'
      : '<i style="--h:' + hueOf((ctx && ctx.res && ctx.res.id) || 'new') + '"></i>';
  }

  function values() {
    var out = {};
    $('areDlg').querySelectorAll('[data-f]').forEach(function (n) { out[n.getAttribute('data-f')] = n.value; });
    return out;
  }

  /* `discard` distinguishes the two ways a dialog goes away. Cancel, Escape
     and a click on the backdrop are a DECISION to throw the form away, so
     the draft goes with it. Anything else — a refresh, a crash, closing the
     tab — is not a decision, and the draft has to survive it. */
  function close(discard) {
    var bg = $('areBg');
    if (bg) bg.classList.remove('show');
    if (draft) { if (discard) draft.clear(); else draft.save(); }
    draft = null; draftScope = '';
    ctx = null; draftCover = null;
  }

  function save() {
    if (!ctx) { close(); return; }
    var d = D(), v = values(), res = ctx.res, opts = ctx.opts || {};
    if (!String(v.title || '').trim()) { say('A resource needs a title', true); return; }
    var patch = {
      url: v.url, title: v.title, type: v.type, summary: v.summary, author: v.author,
      bucket: v.bucket, source: v.source, year: v.year, lengthText: v.lengthText,
      rating: v.rating, retention: v.retention, curriculumId: v.curriculumId || '',
      tags: String(v.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      personIds: String(v.personIds || '').split(',').filter(Boolean),
      subjectIds: String(v.subjectIds || '').split(',').filter(Boolean),
      cover: (draftCover && draftCover.url) || ''
    };
    var rec, isNew = !res;
    if (res) {
      rec = d.Resources.update(res.id, patch);
    } else {
      patch.order = d.nextOrder(d.Resources.list());
      patch.hue = hueOf(patch.title);
      rec = d.Resources.add(patch);
    }
    // The record is written, so the safety net is no longer needed.
    close(true);
    say(isNew ? 'Added to the library' : 'Resource updated');
    if (typeof opts.onSaved === 'function') opts.onSaved(rec, isNew);
  }

  // ---------- one-time DOM + wiring ------------------------------------
  function mount() {
    if (mounted) return;
    mounted = true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bg = document.createElement('div');
    bg.className = 'are-bg';
    bg.id = 'areBg';
    bg.innerHTML = '<div class="are-dlg" id="areDlg" role="dialog" aria-modal="true" aria-label="Edit resource"></div>';
    document.body.appendChild(bg);

    bg.addEventListener('click', function (e) {
      if (e.target === bg) { close(true); return; }
      var t = e.target.closest ? e.target.closest('[data-close],[data-save],[data-chip],#areDiscard,#areFetch') : null;
      if (!t) return;
      if (t.id === 'areDiscard') {
        clearDraftAndReset();
        return;
      }
      if (t.hasAttribute('data-close')) return close(true);
      if (t.hasAttribute('data-save')) return save();
      if (t.id === 'areFetch') return fetchMeta(t);
      if (t.hasAttribute('data-chip')) {
        var row = t.closest('[data-chips]');
        var hidden = $('ar_' + row.getAttribute('data-chips'));
        var id = t.getAttribute('data-chip');
        var vals = hidden.value ? hidden.value.split(',') : [];
        var i = vals.indexOf(id);
        if (i >= 0) vals.splice(i, 1); else vals.push(id);
        hidden.value = vals.join(',');
        t.classList.toggle('is-on', i < 0);
        t.setAttribute('aria-pressed', i < 0 ? 'true' : 'false');
      }
    });
    bg.addEventListener('change', function (e) {
      if (e.target.id === 'areFile') pickCover(e.target);
    });
    bg.addEventListener('input', function (e) {
      if (e.target.id === 'areCoverUrl' && draftCover) {
        draftCover.url = e.target.value.trim();
        paintPrev();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('areBg').classList.contains('show')) close(true);
    });
  }

  /* "Discard" on the restored-draft notice: throw the draft away and show
     the form as it would have been without one. */
  function clearDraftAndReset() {
    if (draftScope) AthDraft.clear(draftScope);
    var res = ctx && ctx.res, opts = (ctx && ctx.opts) || {};
    open(res, opts, true);
  }

  function pickCover(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      D().compressImageDataUrl(String(reader.result), 640, 0.82).then(function (small) {
        if (!draftCover) return;
        // Saved as a data: URL FIRST. If PhotoStore succeeds the ~100-byte
        // hosted URL replaces it; if it never calls back, the page simply
        // keeps the value it already has.
        draftCover.url = small;
        if ($('areCoverUrl')) $('areCoverUrl').value = '';
        paintPrev();
        if (window.PhotoStore && window.PhotoStore.upload) {
          window.PhotoStore.upload(small, function (url) {
            if (draftCover && url) { draftCover.url = url; paintPrev(); }
          });
        }
      }).catch(function () {});
    };
    reader.readAsDataURL(file);
  }

  function fetchMeta(btn) {
    var url = $('ar_url').value;
    if (!url.trim()) { say('Paste a link first', true); return; }
    btn.textContent = 'Fetching…'; btn.disabled = true;
    D().fetchResourcePreview(url).then(function (p) {
      btn.textContent = 'Fetch'; btn.disabled = false;
      var n = 0;
      function put(id, val) {
        var el = $(id);
        // Only ever FILLS BLANKS. A lookup must not overwrite something
        // that was typed by hand.
        if (el && val && !el.value.trim()) { el.value = val; n++; }
      }
      put('ar_title', p.title); put('ar_author', p.author);
      put('ar_source', p.source); put('ar_year', p.year); put('ar_lengthText', p.lengthText);
      if (p.cover && !(draftCover && draftCover.url)) {
        draftCover = { url: p.cover };
        if ($('areCoverUrl')) $('areCoverUrl').value = p.cover;
        paintPrev(); n++;
      }
      say(n ? ('Filled in ' + n + (n === 1 ? ' field' : ' fields')) : 'Nothing came back for that link', !n);
    });
  }

  // ---------- the form --------------------------------------------------
  function open(resource, opts, skipRestore) {
    mount();
    var d = D();
    if (!d) return;
    opts = opts || {};
    // A preset only ever seeds a NEW resource. Applying it to an existing
    // one would silently re-file something the moment it was edited from
    // somewhere it does not belong.
    var r = resource || (opts.preset || {});
    ctx = { res: resource || null, opts: opts };
    draftCover = { url: r.cover || '' };

    var typeOpts = d.RESOURCE_TYPES.map(function (t) { return { id: t, label: t }; });
    var bucketOpts = d.RESOURCE_BUCKETS.map(function (b) { return { id: b.id, label: b.label }; });
    var fieldOpts = d.subjectList().map(function (s) { return { id: s.id, label: s.name }; });
    var peopleOpts = d.peopleResources()
      .filter(function (p) { return p.id !== r.id; })
      .map(function (p) { return { id: p.id, label: p.title || 'Untitled' }; });
    var curricula = d.Curricula.list();
    var curOpts = [{ id: '', label: '— not built into a curriculum —' }].concat(
      curricula.map(function (c) { return { id: c.id, label: c.title || 'Untitled' }; }));

    $('areDlg').innerHTML =
      '<div class="are-head">' +
        '<h3>' + (resource ? 'Edit resource' : 'Add resource') + '</h3>' +
        '<button class="are-x" type="button" data-close aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="are-restored" id="areRestored" hidden>' +
        '<span></span><button type="button" id="areDiscard">Discard them</button>' +
      '</div>' +
      '<div class="are-body">' +
        '<div class="are-f"><label class="are-lab" for="ar_url">Link</label>' +
          '<div class="are-inline">' +
            '<input class="are-in" id="ar_url" data-f="url" value="' + esc(r.url || '') + '" placeholder="https://…">' +
            '<button class="are-btn are-btn-ghost" type="button" id="areFetch">Fetch</button>' +
          '</div>' +
          '<p class="are-hint">Paste a YouTube, Vimeo, Spotify or Open Library link and press Fetch to fill in the title, the person and the cover. It only ever fills blanks — nothing you have typed gets overwritten.</p>' +
        '</div>' +
        fRow(fText('Title', 'title', r.title, 'Meditations'),
             fSelect('Medium', 'type', r.type || 'Book', typeOpts)) +
        fArea('Summary', 'summary', r.summary, 'One or two lines. What this is, and why it is on the shelf.', 2) +
        fRow(fText('Person (free text)', 'author', r.author, 'Marcus Aurelius'),
             fSelect('Shelf', 'bucket', r.bucket || 'suggested', bucketOpts)) +
        (peopleOpts.length ? fChips('Credited people', 'personIds', r.personIds, peopleOpts,
          'Links this to a Person page, which then lists every work of theirs on the shelf.') : '') +
        (fieldOpts.length ? fChips('Fields', 'subjectIds', d.resFields(r), fieldOpts,
          'A resource can serve several fields, or none at all.') : '') +
        fText('Tags', 'tags', (r.tags || []).join(', '), 'stoicism, ethics, antiquity') +
        fHint('Comma separated. Tags are what the Library filters and counts by.') +
        fRow(fText('Source', 'source', r.source, 'Publisher, journal, channel'),
             fText('Year', 'year', r.year, '180')) +
        fRow(fText('Length', 'lengthText', r.lengthText, '384 pp · 1h 12m'),
             fSelect('Rating', 'rating', String(r.rating || 0),
               [0, 1, 2, 3, 4, 5].map(function (n) { return { id: String(n), label: n ? '★'.repeat(n) : 'Unrated' }; }))) +
        (curricula.length ? fSelect('Studied as', 'curriculumId', r.curriculumId || '', curOpts) +
          fHint('For a course you have turned into a curriculum. The curriculum keeps owning its own modules and lessons — this is only the way back to it.') : '') +
        '<div class="are-f"><span class="are-lab">Cover</span>' +
          '<div class="are-cover">' +
            '<div class="are-prev" id="arePrev"></div>' +
            '<div style="display:grid; gap:9px">' +
              '<label class="are-file">Choose an image<input type="file" accept="image/*" id="areFile"></label>' +
              '<input class="are-in" id="areCoverUrl" placeholder="…or paste an image URL" value="' + esc(r.cover || '') + '">' +
              '<p class="are-hint">Uploads are shrunk to 640px, saved with the resource straight away, then quietly swapped for a hosted link. Leave it empty for the drawn plate.</p>' +
            '</div>' +
          '</div></div>' +
        fArea('How this gets studied', 'retention', r.retention,
          'The retention strategy — not a summary of the thing itself.', 2) +
      '</div>' +
      '<div class="are-foot">' +
        '<button class="are-btn are-btn-ghost" type="button" data-close>Cancel</button>' +
        '<button class="are-btn are-btn-solid" type="button" data-save>' +
          (resource ? 'Save' : 'Add to the library') + '</button>' +
      '</div>';

    $('areBg').classList.add('show');
    paintPrev();

    // Autosave, and put back anything a refresh interrupted. The scope is
    // per-record, so editing two resources never crosses their drafts, and
    // a half-filled "new resource" survives independently of them.
    draftScope = 'resource-editor:' + (resource ? resource.id : 'new');
    draft = window.AthDraft ? AthDraft.bind(draftScope, $('areDlg'), {
      skipRestore: !!skipRestore,
      onRestore: function (when) {
        var box = $('areRestored');
        if (!box) return;
        box.hidden = false;
        box.querySelector('span').textContent = 'Unsaved changes from ' + when + ' were put back.';
      }
    }) : null;
    // A cover picked but never saved is part of the form too.
    if (draft && draft.restored && $('areCoverUrl') && $('areCoverUrl').value) {
      draftCover = { url: $('areCoverUrl').value };
      paintPrev();
    }

    var first = $('areDlg').querySelector('[data-f]:not([type=hidden])');
    if (first) setTimeout(function () { first.focus(); }, 40);
  }

  window.AthResourceEditor = { open: open, close: close, isOpen: function () {
    var bg = $('areBg');
    return !!(bg && bg.classList.contains('show'));
  } };
})();
