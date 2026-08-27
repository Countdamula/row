/* =============================================================================
   THE KDP DASHBOARD — SHARED CHROME & COMPONENT KIT
   -----------------------------------------------------------------------------
   Exposes window.Kdp. Loaded by every kdp-*.html page after kdp-data.js and
   before the page's own inline script.

   Everything in here exists because it would otherwise be written five times:
   the rail, the router, the modal, the toast, the reveal choreography, and the
   three primitives that carry most of the app —

     pasteBlock   a paste-in field with copy, word count, status and autosave
     noteRack     "+ Note"   → marginalia that saves as you type
     promptRack   "+ Prompt" → a mono block with {{PLACEHOLDER}} and a copy button
     blankRack    blank sheets of one Template kind, with create/edit/delete

   Rendering is innerHTML string concatenation with delegated events wired
   afterwards, matching every other page in this folder. No framework.
   ========================================================================== */
(function () {
  'use strict';

  var D = function () { return window.KdpData; };

  // ---------------------------------------------------------------------------
  // DOM HELPERS
  // ---------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function on(root, sel, evt, fn) {
    if (!root) return;
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, e);
    });
  }
  function esc(s) { return D().escapeHtml(s); }
  function autosize(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
  }

  // ---------------------------------------------------------------------------
  // SAFETY NET
  // A render that throws must show a stack trace, not a blank page over live
  // data. A blank page looks exactly like data loss.
  // ---------------------------------------------------------------------------
  function showBootError(err, where) {
    var box = $('kdpBootError');
    if (!box) { console.error(where, err); return; }
    box.style.display = 'block';
    box.textContent = 'Render failed in ' + where + '\n\n' +
      (err && err.stack ? err.stack : String(err)) +
      '\n\nYour data is untouched. Reload, and if this repeats, export a backup from Settings.';
  }
  function runSafely(fn, where) {
    try { return fn(); }
    catch (e) { showBootError(e, where || 'unknown'); return null; }
  }

  // ---------------------------------------------------------------------------
  // TOAST
  // ---------------------------------------------------------------------------
  var toastTimer = null;
  function toast(msg) {
    var t = $('kdpToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2100);
  }

  // ---------------------------------------------------------------------------
  // CLIPBOARD
  // ---------------------------------------------------------------------------
  function copyText(text, btn) {
    function done() {
      if (btn) {
        var was = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = was; }, 1400);
      } else { toast('Copied'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        toast('Clipboard blocked by the browser');
      });
    } else {
      // Older Safari and any non-secure context.
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { toast('Clipboard blocked by the browser'); }
    }
  }

  // ---------------------------------------------------------------------------
  // SMALL RENDERERS
  // ---------------------------------------------------------------------------
  function statusPill(statuses, id) {
    var m = D().statusMeta(statuses, id);
    return '<span class="kd-pill kd-tone-' + m.tone + '">' +
      '<i class="kd-dot"></i>' + esc(m.label) + '</span>';
  }
  function meter(pct, seal) {
    pct = D().clamp(Number(pct || 0), 0, 100);
    return '<div class="kd-bar"><div class="kd-bar-fill' + (seal ? ' is-seal' : '') +
      '" style="width:' + pct + '%"></div></div>';
  }
  function statBlock(label, value) {
    return '<div><p class="kd-label">' + esc(label) + '</p>' +
      '<p class="kd-h3" style="font-family:var(--kd-body);font-size:17px;font-weight:400;margin-top:6px">' +
      value + '</p></div>';
  }

  // ---------------------------------------------------------------------------
  // MOTION
  // Reveals are armed on NAVIGATION only. A background cloud pull rebuilds the
  // DOM; without this guard every entrance animation replays under the reader's
  // hands mid-sentence.
  // ---------------------------------------------------------------------------
  var revealObserver = null;
  function armReveals(root, navigated) {
    var nodes = (root || document).querySelectorAll('.kd-rise,.kd-draw');
    if (!navigated) {
      // Repaint, not navigation: show everything immediately, no animation.
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('is-in');
      return;
    }
    if (!revealObserver && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) {
          if (entries[j].isIntersecting) {
            entries[j].target.classList.add('is-in');
            revealObserver.unobserve(entries[j].target);
          }
        }
      }, { rootMargin: '0px 0px -8% 0px', threshold: .04 });
    }
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].style.setProperty('--kd-rise-i', (k % 8));
      if (revealObserver) revealObserver.observe(nodes[k]);
      else nodes[k].classList.add('is-in');
    }

    // SAFETY NET. A reveal animation starts at opacity 0, which means a
    // failure to fire it does not degrade the page — it hides the page.
    // Anything still hidden shortly after paint is shown unconditionally,
    // so no observer quirk, print job, or headless render can ever leave
    // real work invisible.
    clearTimeout(revealFailsafe);
    revealFailsafe = setTimeout(function () {
      var still = (root || document).querySelectorAll('.kd-rise:not(.is-in),.kd-draw:not(.is-in)');
      for (var i = 0; i < still.length; i++) {
        var r = still[i].getBoundingClientRect();
        // only force what the reader could plausibly have reached
        if (r.top < window.innerHeight * 3) still[i].classList.add('is-in');
      }
    }, 1400);
  }
  var revealFailsafe = null;

  function initScroll() {
    var ticking = false;
    // Measured on resize, never per frame. Reading offsetHeight inside a
    // scroll handler forces a synchronous layout on every single frame, which
    // is exactly what a pinned scroll sequence cannot afford.
    var heroH = 1, docMax = 1;
    function measure() {
      var hero = document.querySelector('.kd-hero');
      heroH = hero ? Math.max(1, hero.offsetHeight) : 1;
      docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function paint() {
      var doc = document.documentElement, y = window.scrollY || 0;
      doc.style.setProperty('--kd-pg', D().clamp(y / docMax, 0, 1).toFixed(4));
      doc.style.setProperty('--kd-p', D().clamp(y / heroH, 0, 1).toFixed(4));
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    window.addEventListener('resize', function () { measure(); paint(); }, { passive: true });
    // the document grows as views render, so re-measure after a repaint too
    window.addEventListener('kdp:painted', function () { measure(); paint(); });
    measure(); paint();
  }

  // ---------------------------------------------------------------------------
  // MODAL — one element, reused by every dialog on every page
  // ---------------------------------------------------------------------------
  var modalState = null;
  var modalDraft = null;
  var modalWired = false;
  function modalOpen() { return !!modalState; }

  function openModal(opts) {
    var bg = $('kdpModalBg');
    if (!bg) return;
    modalState = opts;
    bg.innerHTML =
      '<div class="kd-modal' + (opts.wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="kd-modal-head">' +
          '<h3 class="kd-h2">' + esc(opts.title || '') + '</h3>' +
          '<button type="button" class="kd-btn kd-btn-icon" data-modal-x aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="kd-modal-body" id="kdpModalBody">' + (opts.body || '') + '</div>' +
        '<div class="kd-modal-foot">' +
          (opts.onDelete ? '<button type="button" class="kd-btn kd-btn-danger" data-modal-del>Delete</button><span style="flex:1"></span>' : '') +
          '<button type="button" class="kd-btn" data-modal-x>Cancel</button>' +
          (opts.onSave ? '<button type="button" class="kd-btn kd-btn-primary" data-modal-save>' +
            esc(opts.saveLabel || 'Save') + '</button>' : '') +
        '</div>' +
      '</div>';
    bg.classList.add('is-open');

    var body = $('kdpModalBody');
    if (opts.onMount) runSafely(function () { opts.onMount(body); }, 'modal mount');

    // Everything in this dialog lives only in the DOM until Save is pressed, so
    // a refresh here used to take the whole form with it — including a chapter
    // of prose. The fields have carried data-f for exactly this since they were
    // written; the binding was simply never made. Bound AFTER onMount, because
    // the fingerprint has to be taken of the form's OPENING values: "Edit
    // chapter" is the same title for every chapter, and without the hash they
    // would all share one draft.
    modalDraft = window.AthDraft ? AthDraft.bind(
      'modal:kdp:' + (opts.title || '') + ':' + AthDraft.fingerprint(body), body,
      { onRestore: function (when) { toast('Put back what you had typed ' + when); } }
    ) : null;

    var first = body.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 40);

    wireModal(bg);
  }

  /**
   * #kdpModalBg outlives every dialog — only its innerHTML is replaced — so a
   * listener attached per open STACKS. The oldest one then runs first and it
   * holds a detached body, which meant the second dialog you opened silently
   * saved the FIRST one's values. Attach once, and read the live dialog off
   * modalState instead of a closure.
   */
  function wireModal(bg) {
    if (modalWired) return;
    modalWired = true;
    on(bg, '[data-modal-x]', 'click', function () { closeModal(true); });
    on(bg, '[data-modal-save]', 'click', function () {
      var st = modalState;
      if (!st) return;
      var ok = true;
      if (st.onSave) ok = runSafely(function () { return st.onSave($('kdpModalBody')); }, 'modal save');
      // closeModal() clears modalState, so the callback is taken first
      var after = st.after;
      if (ok !== false) { closeModal(true); if (after) after(); }
    });
    on(bg, '[data-modal-del]', 'click', function () {
      var st = modalState;
      if (!st || !st.onDelete) return;
      if (st.deleteConfirm && !window.confirm(st.deleteConfirm)) return;
      runSafely(function () { st.onDelete($('kdpModalBody')); }, 'modal delete');
      var after = st.after;
      closeModal(true);
      if (after) after();
    });
    bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(true); });
  }
  /* Cancel, Escape, the ✕ and the backdrop are a DECISION to throw the form
     away, so the draft goes with it — and so is a successful save, where the
     work is now a real record. A refresh is not a decision, and its draft has
     to survive, which is why only the explicit paths pass true.

     The draft is settled BEFORE the innerHTML is cleared: .save() reads the
     field values back out of the live DOM, and a wiped dialog reads as an
     empty form. (The Athenaeum's copy of this only toggles a class, so the
     ordering is invisible there and is not invisible here.) */
  function closeModal(discard) {
    if (modalDraft) { if (discard) modalDraft.clear(); else modalDraft.save(); }
    modalDraft = null;
    var bg = $('kdpModalBg');
    if (!bg) return;
    bg.classList.remove('is-open');
    bg.innerHTML = '';
    modalState = null;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalState) closeModal(true);
  });

  // --- form fields, marked with data-f so AthDraft can protect them ---------
  function fieldText(label, name, value, placeholder) {
    return '<label class="kd-field"><span class="kd-label">' + esc(label) + '</span>' +
      '<input class="kd-input" data-f="' + esc(name) + '" value="' + esc(value || '') +
      '" placeholder="' + esc(placeholder || '') + '"></label>';
  }
  function fieldArea(label, name, value, rows, placeholder) {
    return '<label class="kd-field"><span class="kd-label">' + esc(label) + '</span>' +
      '<textarea class="kd-textarea" rows="' + (rows || 5) + '" data-f="' + esc(name) +
      '" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea></label>';
  }
  function fieldNum(label, name, value) {
    return '<label class="kd-field"><span class="kd-label">' + esc(label) + '</span>' +
      '<input class="kd-input" type="number" data-f="' + esc(name) + '" value="' + esc(value == null ? '' : value) + '"></label>';
  }
  function fieldDate(label, name, value) {
    return '<label class="kd-field"><span class="kd-label">' + esc(label) + '</span>' +
      '<input class="kd-input" type="date" data-f="' + esc(name) + '" value="' + esc(value || '') + '"></label>';
  }
  function fieldSelect(label, name, value, options) {
    var opts = options.map(function (o) {
      var id = typeof o === 'string' ? o : o.id;
      var lb = typeof o === 'string' ? o : o.label;
      return '<option value="' + esc(id) + '"' + (id === value ? ' selected' : '') + '>' + esc(lb) + '</option>';
    }).join('');
    return '<label class="kd-field"><span class="kd-label">' + esc(label) + '</span>' +
      '<select class="kd-select" data-f="' + esc(name) + '">' + opts + '</select></label>';
  }
  function readFields(root) {
    var out = {};
    var nodes = root.querySelectorAll('[data-f]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      out[n.dataset.f] = n.type === 'checkbox' ? n.checked : n.value;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // AUTOSAVE ENGINE
  // Commits on an 800 ms debounce, on blur, and on the page going away. The
  // IndexedDB shim only QUEUES a write; a document torn down in the same tick
  // loses it. So the real protection is committing while you type, not at exit.
  // ---------------------------------------------------------------------------
  function createSaver(commit, delay) {
    var timer = null, pending = null, dead = false;
    function flush() {
      clearTimeout(timer); timer = null;
      if (pending == null || dead) return;
      var v = pending; pending = null;
      runSafely(function () { commit(v); }, 'autosave');
    }
    function queue(value) {
      if (dead) return;
      pending = value;
      clearTimeout(timer);
      timer = setTimeout(flush, delay == null ? 800 : delay);
    }
    function detach() { flush(); dead = true; }
    savers.push({ flush: flush });
    return { queue: queue, flush: flush, detach: detach };
  }
  var savers = [];
  function flushAll() {
    for (var i = 0; i < savers.length; i++) {
      try { savers[i].flush(); } catch (e) {}
    }
  }
  /**
   * Leaving the page. Flush every pending edit, then push IndexedDB to disk.
   * Navigating in the same tick as a write silently loses it.
   */
  function flushAndGo(href) {
    flushAll();
    function go() { window.location.href = href; }
    if (window.LocalStoreIDB && LocalStoreIDB.flush) {
      var done = false;
      var fin = function () { if (!done) { done = true; go(); } };
      try {
        var p = LocalStoreIDB.flush();
        if (p && p.then) { p.then(fin, fin); setTimeout(fin, 600); }
        else fin();
      } catch (e) { fin(); }
    } else { go(); }
  }

  // ---------------------------------------------------------------------------
  // PRIMITIVE 1 — PASTE BLOCK
  // The workhorse: dossier, character sheets, world sections, chapter outlines,
  // style documents, and all four chapter indexes are this component.
  // ---------------------------------------------------------------------------
  /**
   * @param o.id        unique dom id fragment
   * @param o.title     heading
   * @param o.value     current text
   * @param o.placeholder
   * @param o.statuses  optional status list (renders a <select>)
   * @param o.status    current status id
   * @param o.minHeight px
   * @param o.readOnly  render as text, no editing
   * @param o.words     show a word count
   */
  function pasteBlock(o) {
    var sid = 'pb_' + o.id;
    var statusSel = '';
    if (o.statuses) {
      statusSel = '<select class="kd-select" style="width:auto" data-pb-status="' + esc(o.id) + '">' +
        o.statuses.map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (s.id === o.status ? ' selected' : '') +
                 '>' + esc(s.label) + '</option>';
        }).join('') + '</select>';
    }
    var wc = D().wordCount(o.value);
    return '<div class="kd-paste" id="' + sid + '">' +
      '<div class="kd-paste-head">' +
        '<p class="kd-paste-t">' + esc(o.title || '') + '</p>' +
        '<div class="kd-paste-acts">' + statusSel +
          '<button type="button" class="kd-btn kd-btn-sm" data-pb-copy="' + esc(o.id) + '">Copy</button>' +
        '</div>' +
      '</div>' +
      (o.readOnly
        ? '<div class="kd-prose" style="padding:var(--kd-4);background:var(--kd-recto)">' +
            (o.value ? D().mdToHtml(o.value) : '<em style="color:var(--kd-tx-faint)">Nothing here yet.</em>') + '</div>'
        : '<textarea data-pb="' + esc(o.id) + '" placeholder="' + esc(o.placeholder || 'Paste here…') +
          '" style="min-height:' + (o.minHeight || 180) + 'px">' + esc(o.value || '') + '</textarea>') +
      '<div class="kd-paste-foot">' +
        '<span class="kd-meta" data-pb-count="' + esc(o.id) + '">' + D().fmtWords(wc) + ' words</span>' +
        '<span class="kd-meta" data-pb-saved="' + esc(o.id) + '"></span>' +
      '</div>' +
    '</div>';
  }

  /**
   * Wire a paste block.
   * @param onText   (text) => void         called on the debounce
   * @param onStatus (statusId) => void
   */
  function wirePasteBlock(root, id, onText, onStatus) {
    var ta = root.querySelector('[data-pb="' + id + '"]');
    var count = root.querySelector('[data-pb-count="' + id + '"]');
    var saved = root.querySelector('[data-pb-saved="' + id + '"]');
    var copy = root.querySelector('[data-pb-copy="' + id + '"]');
    var sel = root.querySelector('[data-pb-status="' + id + '"]');

    var saver = null;
    if (ta && onText) {
      saver = createSaver(function (v) {
        onText(v);
        if (saved) {
          saved.textContent = 'Saved';
          setTimeout(function () { if (saved) saved.textContent = ''; }, 1400);
        }
      });
      ta.addEventListener('input', function () {
        if (count) count.textContent = D().fmtWords(D().wordCount(ta.value)) + ' words';
        saver.queue(ta.value);
      });
      ta.addEventListener('blur', function () { saver.flush(); });
    }
    if (copy) {
      copy.addEventListener('click', function () {
        copyText(ta ? ta.value : (root.querySelector('[data-pb-ro="' + id + '"]') || {}).textContent || '', copy);
      });
    }
    if (sel && onStatus) {
      sel.addEventListener('change', function () { onStatus(sel.value); });
    }
    return saver;
  }

  // ---------------------------------------------------------------------------
  // PRIMITIVE 2 — NOTE RACK
  // Generatable notes. They render as marginalia because that is where a note
  // about a page belongs.
  // ---------------------------------------------------------------------------
  function noteRack(scope, opts) {
    opts = opts || {};
    var notes = D().notesFor(scope);
    return '<div class="kd-noterack" data-noterack="' + esc(scope) + '">' +
      '<div class="kd-panel-head">' +
        '<p class="kd-label">' + esc(opts.title || 'Notes') + '</p>' +
        '<button type="button" class="kd-btn kd-btn-sm" data-note-add="' + esc(scope) + '">+ Note</button>' +
      '</div>' +
      (notes.length ? notes.map(function (n) {
        return '<div class="kd-mnote" data-note="' + esc(n.id) + '">' +
          '<span class="kd-mnote-l">' +
            '<input class="kd-note-title" data-note-title="' + esc(n.id) + '" value="' + esc(n.title || 'Note') + '">' +
            '<button type="button" class="kd-note-x" data-note-del="' + esc(n.id) + '" aria-label="Delete note">✕</button>' +
          '</span>' +
          '<textarea class="kd-note-body" data-note-body="' + esc(n.id) + '" rows="2" placeholder="Write it down…">' +
            esc(n.body || '') + '</textarea>' +
        '</div>';
      }).join('') : '<p class="kd-meta" style="margin:0">No notes yet. Add one and it saves as you type.</p>') +
    '</div>';
  }

  function wireNoteRack(root, scope, rerender) {
    on(root, '[data-note-add="' + scope + '"]', 'click', function () {
      D().Notes.add({ scope: scope, title: 'Note', order: D().nextOrder(D().Notes) });
      rerender();
    });
    on(root, '[data-note-del]', 'click', function () {
      D().Notes.remove(this.dataset.noteDel);
      rerender();
    });
    var titles = root.querySelectorAll('[data-note-title]');
    for (var i = 0; i < titles.length; i++) {
      (function (input) {
        var s = createSaver(function (v) { D().Notes.update(input.dataset.noteTitle, { title: v }); });
        input.addEventListener('input', function () { s.queue(input.value); });
        input.addEventListener('blur', function () { s.flush(); });
      })(titles[i]);
    }
    var bodies = root.querySelectorAll('[data-note-body]');
    for (var j = 0; j < bodies.length; j++) {
      (function (ta) {
        autosize(ta);
        var s = createSaver(function (v) { D().Notes.update(ta.dataset.noteBody, { body: v }); });
        ta.addEventListener('input', function () { autosize(ta); s.queue(ta.value); });
        ta.addEventListener('blur', function () { s.flush(); });
      })(bodies[j]);
    }
  }

  // ---------------------------------------------------------------------------
  // PRIMITIVE 3 — PROMPT RACK
  // Generatable AI prompt blocks, scoped to a page.
  // ---------------------------------------------------------------------------
  function promptRack(scope, opts) {
    opts = opts || {};
    var blocks = D().promptBlocksFor(scope);
    return '<div class="kd-promptrack" data-promptrack="' + esc(scope) + '">' +
      '<div class="kd-panel-head">' +
        '<p class="kd-label">' + esc(opts.title || 'AI prompts') + '</p>' +
        '<button type="button" class="kd-btn kd-btn-sm" data-pblock-add="' + esc(scope) + '">+ Prompt</button>' +
      '</div>' +
      (blocks.length ? '<div class="kd-grid">' + blocks.map(function (p) {
        return '<div class="kd-pr" data-pblock="' + esc(p.id) + '">' +
          '<div class="kd-pr-head">' +
            '<input class="kd-pr-title" data-pblock-title="' + esc(p.id) + '" value="' + esc(p.title) + '">' +
            '<div class="kd-paste-acts">' +
              '<button type="button" class="kd-btn kd-btn-sm" data-pblock-copy="' + esc(p.id) + '">Copy</button>' +
              '<button type="button" class="kd-btn kd-btn-sm kd-btn-danger" data-pblock-del="' + esc(p.id) + '">✕</button>' +
            '</div>' +
          '</div>' +
          '<textarea data-pblock-body="' + esc(p.id) + '" rows="6" placeholder="Paste the prompt. Use {{PLACEHOLDERS}} for the parts that change.">' +
            esc(p.body || '') + '</textarea>' +
        '</div>';
      }).join('') + '</div>'
      : '<p class="kd-meta" style="margin:0">No prompts on this page yet. Add one to keep it beside the work it belongs to.</p>') +
    '</div>';
  }

  function wirePromptRack(root, scope, rerender) {
    on(root, '[data-pblock-add="' + scope + '"]', 'click', function () {
      D().PromptBlocks.add({ scope: scope, title: 'Prompt', order: D().nextOrder(D().PromptBlocks) });
      rerender();
    });
    on(root, '[data-pblock-del]', 'click', function () {
      D().PromptBlocks.remove(this.dataset.pblockDel);
      rerender();
    });
    on(root, '[data-pblock-copy]', 'click', function () {
      var id = this.dataset.pblockCopy;
      var ta = root.querySelector('[data-pblock-body="' + id + '"]');
      copyText(ta ? ta.value : '', this);
      var p = D().PromptBlocks.get(id);
      if (p) D().PromptBlocks.update(id, {});
    });
    var titles = root.querySelectorAll('[data-pblock-title]');
    for (var i = 0; i < titles.length; i++) {
      (function (input) {
        var s = createSaver(function (v) { D().PromptBlocks.update(input.dataset.pblockTitle, { title: v }); });
        input.addEventListener('input', function () { s.queue(input.value); });
        input.addEventListener('blur', function () { s.flush(); });
      })(titles[i]);
    }
    var bodies = root.querySelectorAll('[data-pblock-body]');
    for (var j = 0; j < bodies.length; j++) {
      (function (ta) {
        autosize(ta);
        var s = createSaver(function (v) { D().PromptBlocks.update(ta.dataset.pblockBody, { body: v }); });
        ta.addEventListener('input', function () { autosize(ta); s.queue(ta.value); });
        ta.addEventListener('blur', function () { s.flush(); });
      })(bodies[j]);
    }
  }

  // ---------------------------------------------------------------------------
  // PRIMITIVE 4 — THE BLANK SHEET RACK
  // Templates records filtered by kind, with create, edit and delete.
  //
  // Foundations used to render these as a read-only <pre> on --kd-void with no
  // way to change them, which had two consequences: a sheet could only be
  // edited by finding the Library on another page, and an EMPTY sheet was a
  // black rectangle with no explanation and nothing to click. Pasting into it
  // did nothing, because a <pre> is not an input.
  //
  // The modal here is the same one kdp.html's Library uses. Both call
  // openBlankSheet(); the Library passes `kinds` and gets a Kind select, a step
  // page passes `kind` and gets that kind fixed. One implementation, so the two
  // surfaces cannot drift apart.
  // ---------------------------------------------------------------------------

  /**
   * @param kind          one of D.TEMPLATE_KINDS — the filter, and the kind a
   *                      new sheet is created with
   * @param opts.title    panel heading. Default: 'Blank <kind> sheets'
   * @param opts.addLabel default '+ Blank sheet'
   * @param opts.empty    the line shown when this kind has no sheets at all
   * @returns html
   */
  function blankRack(kind, opts) {
    opts = opts || {};
    var rows = D().Templates.list()
      .filter(function (t) { return t.kind === kind; })
      .sort(D().byOrder);

    return '<div class="kd-blank" data-blankrack="' + esc(kind) + '">' +
      '<div class="kd-panel-head">' +
        '<p class="kd-label">' + esc(opts.title || 'Blank ' + kind.toLowerCase() + 's') + '</p>' +
        '<button type="button" class="kd-btn kd-btn-sm" data-blank-new="' + esc(kind) + '">' +
          esc(opts.addLabel || '+ Blank sheet') + '</button>' +
      '</div>' +
      (rows.length ? '<div class="kd-grid kd-grid-2">' + rows.map(function (t) {
        return '<div class="kd-blank-c">' +
          '<div class="kd-panel-head" style="margin-bottom:var(--kd-3)">' +
            '<p class="kd-h3">' + esc(t.title || 'Untitled sheet') + '</p>' +
            '<div class="kd-paste-acts">' +
              '<button type="button" class="kd-btn kd-btn-sm" data-blank-copy="' + esc(t.id) + '">Copy</button>' +
              '<button type="button" class="kd-btn kd-btn-sm" data-blank-edit="' + esc(t.id) + '">Edit</button>' +
              '<button type="button" class="kd-btn kd-btn-sm kd-btn-icon kd-btn-danger" data-blank-del="' + esc(t.id) +
                '" aria-label="Delete this sheet">✕</button>' +
            '</div>' +
          '</div>' +
          // An empty sheet is a sentence and the action that resolves it, never
          // a surface with nothing in it. That black box was the whole bug.
          (String(t.body || '').trim()
            ? '<pre class="kd-mono kd-blank-b">' + esc(t.body) + '</pre>'
            : '<p class="kd-blank-x">This sheet is empty — nothing has been pasted into it yet. ' +
              '<button type="button" class="kd-btn kd-btn-sm" data-blank-edit="' + esc(t.id) +
              '">Add the body</button></p>') +
        '</div>';
      }).join('') + '</div>'
      : '<p class="kd-meta" style="margin:0">' +
        esc(opts.empty || 'No blank sheets stored yet. Add one and it is available on every page that uses this kind.') +
        '</p>') +
    '</div>';
  }

  /**
   * @param root      the container the rack was rendered into
   * @param kind      the same kind passed to blankRack
   * @param rerender  called after every create, edit or delete
   */
  function wireBlankRack(root, kind, rerender) {
    if (!root) return;
    // #kdpBody outlives every render too, so this attaches ONCE and keeps the
    // current rerender on the node. The kind comes off the clicked button, so
    // one listener serves however many racks a page shows.
    root._blankRerender = rerender;
    if (root._blankWired) return;
    root._blankWired = true;
    on(root, '[data-blank-new]', 'click', function () {
      openBlankSheet(null, { kind: this.dataset.blankNew, after: root._blankRerender });
    });
    on(root, '[data-blank-edit]', 'click', function () {
      openBlankSheet(this.dataset.blankEdit, { after: root._blankRerender });
    });
    on(root, '[data-blank-copy]', 'click', function () {
      var t = D().Templates.get(this.dataset.blankCopy);
      if (t) copyText(t.body, this);
    });
    on(root, '[data-blank-del]', 'click', function () {
      var t = D().Templates.get(this.dataset.blankDel);
      if (!t) return;
      if (!window.confirm('Delete “' + (t.title || 'this sheet') + '”? This cannot be undone.')) return;
      D().Templates.remove(t.id);
      toast('Sheet deleted');
      if (root._blankRerender) root._blankRerender();
    });
  }

  /**
   * The one blank-sheet editor.
   * @param id          template id, or null to create
   * @param opts.kind   fixed kind — used when creating, and when no select
   * @param opts.kinds  array of kinds; renders a Kind select instead (Library)
   * @param opts.after  () => void, after save or delete
   */
  function openBlankSheet(id, opts) {
    opts = opts || {};
    var d = D();
    var t = id ? d.Templates.get(id) : null;
    var kind = t ? t.kind : (opts.kind || (opts.kinds && opts.kinds[0]) || 'Story Dossier');

    openModal({
      title: t ? 'Edit sheet' : 'New blank sheet', wide: true,
      body: fieldText('Title', 'title', t ? t.title : kind,
                      'What this sheet is for') +
        (opts.kinds ? fieldSelect('Kind', 'kind', kind, opts.kinds) : '') +
        fieldArea('Body', 'body', t ? t.body : '', 14,
                  'Paste the sheet. Blank field labels ending in a colon — NAME:, ROLE: — ' +
                  'are what the character page reads back.'),
      onSave: function (root) {
        var f = readFields(root);
        if (!opts.kinds) f.kind = kind;
        if (t) d.Templates.update(t.id, f);
        else d.Templates.add(Object.assign(f, { order: d.nextOrder(d.Templates) }));
        toast('Saved');
      },
      onDelete: t ? function () { d.Templates.remove(t.id); toast('Sheet deleted'); } : null,
      deleteConfirm: 'Delete this sheet? This cannot be undone.',
      after: opts.after
    });
  }

  // ---------------------------------------------------------------------------
  // THE TOP BAR
  // Replaces the old floating icon rail. One horizontal bar, on every page,
  // reaching every route of every page.
  //
  // Built ONCE and then synced, which is the opposite of what the old rail did.
  // The rail rewrote its own innerHTML and re-attached its listeners on every
  // single render; the bar is injected once as the first child of <body> —
  // outside #kdpHeroIn and #kdpBody, so no renderer can destroy it — carries
  // exactly two delegated listeners, and thereafter only has attributes
  // rewritten. Nothing inside it may ever carry .kd-rise: armReveals() walks
  // the whole document and would leave a fixed element stuck at opacity 0.
  // ---------------------------------------------------------------------------

  /**
   * Every page, every route, and what each route's logical parent is. The
   * single source of truth for both the bar's links and the Back crumb.
   *
   *   hash    string, or fn(ctx) when the href needs the current trilogy/book.
   *           null means a parameterised leaf (#/characters/:id, #/w/:id) that
   *           CANNOT be linked to from a bar — it is reached only from its
   *           parent, shows its parent's is-on state, and supplies a crumb.
   *           That is deliberate; it is not an oversight to be "fixed".
   *   parent  another key on the SAME page, or '^' meaning "the page that owns
   *           this one" — resolved through the week order by barParent().
   */
  var ROUTES = {
    'kdp.html': {
      week: 0, label: 'The Velvet Grimoire', scope: 'none',
      routes: [
        { key: 'command',   label: 'Command',   hash: '#/',                  parent: null },
        { key: 'shelf',     label: 'Trilogies', hash: '#/shelf',             parent: 'command' },
        { key: 'trilogy',   label: '',          hash: null,                  parent: 'shelf' },
        { key: 'prompts',   label: 'Prompts',   hash: '#/library/prompts',   parent: 'command' },
        { key: 'templates', label: 'Templates', hash: '#/library/templates', parent: 'command' },
        { key: 'settings',  label: 'Settings',  hash: '#/settings',          parent: 'command' }
      ]
    },
    'kdp-foundations.html': {
      week: 1, label: 'Foundations', scope: 'trilogy',
      routes: [
        { key: 'overview',   label: 'Overview',   hash: '#/',                 parent: '^' },
        { key: 'dossier',    label: 'Dossier',    hash: '#/dossier',          parent: 'overview' },
        { key: 'critique',   label: 'Critique',   hash: '#/dossier/critique', parent: 'dossier' },
        { key: 'characters', label: 'Characters', hash: '#/characters',       parent: 'overview' },
        { key: 'character',  label: '',           hash: null,                 parent: 'characters' },
        { key: 'world',      label: 'World',      hash: '#/world',            parent: 'overview' },
        { key: 'plan',       label: 'Plan',       hash: '#/plan',             parent: 'overview' },
        { key: 'outline',    label: 'Outlines',   parent: 'plan', hash: function (c) {
            var bs = c.tri ? D().booksForTrilogy(c.tri.id) : [];
            return bs.length ? '#/outline/' + bs[0].id : '';
          } },
        { key: 'style',      label: 'Style',      hash: '#/style',            parent: 'overview' }
      ]
    },
    'kdp-draft.html': {
      week: 2, label: 'Drafting', scope: 'book',
      routes: [
        { key: 'book',    label: 'The book', parent: '^', hash: function (c) {
            return c.book ? '#/b/' + c.book.id : '';
          } },
        { key: 'chapter', label: '',         hash: null, parent: 'book' }
      ]
    },
    'kdp-continuity.html': {
      week: 4, label: 'Continuity', scope: 'book',
      routes: [
        { key: 'overview',  label: 'Overview',     hash: '#/',          parent: '^' },
        { key: 'plot',      label: 'Plot',         hash: '#/plot',      parent: 'overview' },
        { key: 'character', label: 'Character',    hash: '#/character', parent: 'overview' },
        { key: 'world',     label: 'World',        hash: '#/world',     parent: 'overview' },
        { key: 'timeline',  label: 'Timeline',     hash: '#/timeline',  parent: 'overview' },
        { key: 'romance',   label: 'Romance',      hash: '#/romance',   parent: 'overview' },
        { key: 'read',      label: 'Read-through', hash: '#/read',      parent: 'overview' }
      ]
    },
    'kdp-publish.html': {
      week: 5, label: 'Publish', scope: 'book',
      routes: [
        { key: 'overview',   label: 'Overview',   hash: '#/',           parent: '^' },
        { key: 'manuscript', label: 'Manuscript', hash: '#/manuscript', parent: 'overview' },
        { key: 'listing',    label: 'Listing',    hash: '#/listing',    parent: 'overview' },
        { key: 'cover',      label: 'Cover',      hash: '#/cover',      parent: 'overview' },
        { key: 'pricing',    label: 'Pricing',    hash: '#/pricing',    parent: 'overview' },
        { key: 'launch',     label: 'Launch',     hash: '#/launch',     parent: 'overview' }
      ]
    }
  };

  /* The five week pips, in order. Weeks 2 and 3 are ONE page behind TWO
     entries, which is why this is not simply a filter over ROUTES. */
  var WEEK_PIPS = [
    { n: 1, page: 'kdp-foundations.html', label: 'Week 1 · Foundations',  short: 'Foundations', scope: 'trilogy' },
    { n: 2, page: 'kdp-draft.html',       label: 'Week 2 · Draft 1–28',   short: 'Draft 1–28',  scope: 'book' },
    { n: 3, page: 'kdp-draft.html',       label: 'Week 3 · Draft 29–40',  short: 'Draft 29–40', scope: 'book' },
    { n: 4, page: 'kdp-continuity.html',  label: 'Week 4 · Continuity',   short: 'Continuity',  scope: 'book' },
    { n: 5, page: 'kdp-publish.html',     label: 'Week 5 · Publish',      short: 'Publish',     scope: 'book' }
  ];

  var bar = null;      // the mounted element, or null on a page that never mounted
  var barCfg = null;

  /** The live selection every href is built from. */
  function barContext() {
    var d = D(), ui = d.getUiState();
    return {
      tri: d.Trilogies.get(ui.lastTrilogyId) || null,
      book: d.Books.get(ui.lastBookId) || null,
      week: Number(param('week')) === 3 ? 3 : 2
    };
  }

  /** Resolve a route's hash, which may be a string, a function, or null. */
  function hashOf(r, ctx) {
    if (!r || r.hash == null) return '';
    return typeof r.hash === 'function' ? (r.hash(ctx) || '') : r.hash;
  }
  function routeByKey(page, key) {
    for (var i = 0; i < page.routes.length; i++) {
      if (page.routes[i].key === key) return page.routes[i];
    }
    return null;
  }

  /** A full cross-page href for one week pip, or '' when it has no context. */
  function weekHref(pip, ctx) {
    if (pip.scope === 'trilogy') {
      return ctx.tri ? pip.page + '?tri=' + ctx.tri.id + '#/' : '';
    }
    if (!ctx.book) return '';
    if (pip.page === 'kdp-draft.html') {
      return pip.page + '?book=' + ctx.book.id + '&week=' + pip.n + '#/b/' + ctx.book.id;
    }
    return pip.page + '?book=' + ctx.book.id + '#/';
  }

  /**
   * One level UP the real hierarchy — never the browser's history. This is
   * predictable from a cold deep link, which history.back() is not; the bar
   * carries both controls so either is available.
   * @returns {{label:string, href:string}|null}  null only at the true root.
   */
  function barParent(pageKey, routeKey, ctx) {
    var page = ROUTES[pageKey];
    if (!page) return null;
    var r = routeByKey(page, routeKey);
    if (!r || r.parent == null) return null;

    if (r.parent !== '^') {
      var p = routeByKey(page, r.parent);
      var h = hashOf(p, ctx);
      if (!h) return null;
      return { label: p.label || page.label, href: h };
    }

    // '^' — the page that owns this one. Week 1 belongs to its trilogy; every
    // later week belongs to the week before it.
    if (page.week <= 1) {
      return ctx.tri
        ? { label: ctx.tri.title || 'The trilogy', href: 'kdp.html#/t/' + ctx.tri.id }
        : { label: 'Trilogies', href: 'kdp.html#/shelf' };
    }
    var prevN = page.week === 5 ? 4 : (page.week === 4 ? 3 : page.week - 1);
    for (var i = 0; i < WEEK_PIPS.length; i++) {
      if (WEEK_PIPS[i].n === prevN) {
        var href = weekHref(WEEK_PIPS[i], ctx);
        if (href) return { label: WEEK_PIPS[i].label, href: href };
      }
    }
    return { label: 'The Velvet Grimoire', href: 'kdp.html#/' };
  }

  /**
   * Build the bar. Call ONCE, from the page's boot, before the first render.
   * @param cfg.page      filename — a key into ROUTES
   * @param cfg.routeKey  fn(route) -> a key in that page's routes list
   */
  function mountBar(cfg) {
    if (bar || !ROUTES[cfg.page]) return;
    barCfg = cfg;
    var page = ROUTES[cfg.page];

    var pips = WEEK_PIPS.map(function (p) {
      return '<button type="button" class="kd-nav-pip" data-pip="' + p.n + '" ' +
        'aria-label="' + esc(p.label) + '"><i>' + p.n + '</i>' +
        '<span class="kd-nav-lbl">' + esc(p.short) + '</span>' +
        '<span class="kd-nav-tip">' + esc(p.label) + '</span></button>';
    }).join('');

    // Only routes with a linkable hash get a chip. Leaves are represented by
    // their parent's is-on state plus the crumb — see the ROUTES comment.
    var local = page.routes.filter(function (r) { return r.hash != null; })
      .map(function (r) {
        return '<button type="button" class="kd-nav-chip" data-rk="' + esc(r.key) + '">' +
          esc(r.label) + '</button>';
      }).join('');

    bar = el('nav', 'kd-nav');
    bar.id = 'kdpBar';
    bar.setAttribute('aria-label', 'The Velvet Grimoire');
    bar.innerHTML =
      '<div class="kd-nav-in">' +
        '<button type="button" class="kd-nav-icon kd-nav-hist" data-bar-hist ' +
          'aria-label="Back">‹<span class="kd-nav-tip">Back</span></button>' +
        '<button type="button" class="kd-nav-up" data-bar-up>' +
          '<span aria-hidden="true">‹</span> <span class="kd-nav-up-t"></span></button>' +
        '<span class="kd-nav-sep"></span>' +
        '<button type="button" class="kd-nav-icon kd-nav-home" data-go="kdp.html#/" ' +
          'aria-label="The Velvet Grimoire">❖<span class="kd-nav-tip">The Velvet Grimoire</span></button>' +
        '<div class="kd-nav-weeks">' + pips + '</div>' +
        '<span class="kd-nav-sep"></span>' +
        '<div class="kd-nav-local">' + local + '</div>' +
        '<span class="kd-nav-ctx" id="kdpBarCtx"></span>' +
        '<span class="kd-nav-sep"></span>' +
        '<button type="button" class="kd-nav-icon" data-go="kdp.html#/shelf" ' +
          'aria-label="Trilogies">▤<span class="kd-nav-tip">Trilogies</span></button>' +
        '<button type="button" class="kd-nav-icon" data-go="kdp.html#/library/prompts" ' +
          'aria-label="Prompt library">⌘<span class="kd-nav-tip">Prompt library</span></button>' +
        '<button type="button" class="kd-nav-icon" data-go="kdp.html#/settings" ' +
          'aria-label="Settings and backup">⚙<span class="kd-nav-tip">Settings &amp; backup</span></button>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);

    // Two listeners, attached once and never again.
    on(bar, '[data-go]', 'click', function () { navigate(this.dataset.go); });
    bar.querySelector('[data-bar-hist]').addEventListener('click', function () {
      window.history.back();
    });

    // A page that dead-ends before it builds a router never reaches a render,
    // so give the bar its one sync here.
    syncBar(null);
  }

  /**
   * Repaint only what changes: is-on, disabled, the pips' hrefs (lastBookId can
   * move mid-session), the crumb, and the context caption. Never innerHTML, and
   * never a new listener.
   */
  function syncBar(route) {
    if (!bar || !barCfg) return;
    var page = ROUTES[barCfg.page];
    var ctx = barContext();
    var rk = (barCfg.routeKey && route) ? barCfg.routeKey(route) : '';
    var i;

    // --- week pips. Weeks 2 and 3 share a page, so which one is lit comes
    //     from the query string, not from the ROUTES entry.
    var thisWeek = barCfg.page === 'kdp-draft.html' ? ctx.week : page.week;
    var pipEls = bar.querySelectorAll('[data-pip]');
    for (i = 0; i < pipEls.length; i++) {
      var pn = Number(pipEls[i].dataset.pip);
      var href = weekHref(WEEK_PIPS[pn - 1], ctx);
      pipEls[i].classList.toggle('is-on', pn === thisWeek);
      if (href) { pipEls[i].dataset.go = href; pipEls[i].disabled = false; }
      else { delete pipEls[i].dataset.go; pipEls[i].disabled = true; }
    }
    bar.querySelector('.kd-nav-home').classList.toggle('is-on', page.week === 0);

    // --- local chips. A leaf route lights its parent's chip.
    var lit = rk;
    var cur = routeByKey(page, rk);
    if (cur && cur.hash == null) lit = cur.parent === '^' ? '' : cur.parent;

    var chips = bar.querySelectorAll('[data-rk]');
    for (i = 0; i < chips.length; i++) {
      var r = routeByKey(page, chips[i].dataset.rk);
      var h = hashOf(r, ctx);
      chips[i].classList.toggle('is-on', chips[i].dataset.rk === lit);
      if (h) { chips[i].dataset.go = h; chips[i].disabled = false; }
      else { delete chips[i].dataset.go; chips[i].disabled = true; }
    }

    // --- the crumb
    var up = barParent(barCfg.page, rk, ctx);
    var upEl = bar.querySelector('[data-bar-up]');
    if (up) {
      upEl.hidden = false;
      upEl.dataset.go = up.href;
      upEl.querySelector('.kd-nav-up-t').textContent = up.label;
      upEl.setAttribute('aria-label', 'Up to ' + up.label);
    } else {
      upEl.hidden = true;
      delete upEl.dataset.go;
    }

    // --- history arrow. Nothing to go back to on a cold deep link.
    bar.querySelector('[data-bar-hist]').disabled = window.history.length <= 1;

    // --- the caption: what this page is currently working on
    var caption = '';
    if (page.scope === 'trilogy' && ctx.tri) caption = ctx.tri.title || '';
    else if (page.scope === 'book' && ctx.book) {
      caption = ((ctx.tri && ctx.tri.title) ? ctx.tri.title + ' · ' : '') + (ctx.book.title || '');
    }
    $('kdpBarCtx').textContent = caption;
  }

  /**
   * Go somewhere. Same-page hash routes render in place; anything that leaves
   * the document flushes pending writes to disk first.
   */
  function navigate(href) {
    if (!href) return;
    var here = window.location.pathname.split('/').pop();
    var isSamePage = href.indexOf('#') === 0 ||
      (href.split('#')[0].split('?')[0] === here);
    if (isSamePage) {
      var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '#/';
      if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else window.location.hash = hash;
      return;
    }
    flushAndGo(href);
  }

  // ---------------------------------------------------------------------------
  // ROUTER
  // Routes are hash-based so the browser Back button works. The route KEY is
  // what distinguishes navigation from a repaint: a repaint must never scroll
  // the reader to the top, and must never replay entrance animations.
  // ---------------------------------------------------------------------------
  function makeRouter(cfg) {
    var painted = null;
    var state = { route: null, navigated: false };

    function parse() {
      var raw = String(window.location.hash || '').replace(/^#/, '').replace(/^\//, '');
      var parts = raw ? raw.split('/') : [];
      return cfg.parse(parts, raw);
    }
    function key(r) { return cfg.key ? cfg.key(r) : JSON.stringify(r); }

    function render(opts) {
      opts = opts || {};
      state.route = parse();
      var k = key(state.route);
      var navigated = k !== painted;
      state.navigated = navigated && !opts.keepScroll;
      var y = window.scrollY;

      runSafely(function () { cfg.render(state.route, state); }, 'render ' + k);
      painted = k;

      runSafely(function () { syncBar(state.route); }, 'bar');
      armReveals(document.body, state.navigated);
      // the document just changed height; anything scroll-linked must re-measure
      try { window.dispatchEvent(new CustomEvent('kdp:painted')); } catch (e) {}

      if (state.navigated) { window.scrollTo(0, 0); }
      else { requestAnimationFrame(function () { window.scrollTo(0, y); }); }
    }

    /** A data change repainted the current view. It must not move the page. */
    function refresh() {
      if (modalOpen()) return;
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
      render({ keepScroll: true });
    }

    window.addEventListener('hashchange', function () { render(); });
    return { render: render, refresh: refresh, state: state, parse: parse };
  }

  // ---------------------------------------------------------------------------
  // PAGE BOOT
  // ---------------------------------------------------------------------------
  function initPage(cfg) {
    D().seedLibraryIfNeeded();

    // Two mounts, split by weight — the metadata row stays instant while the
    // manuscript row is only pushed when prose actually changes.
    if (window.initCloudSync) {
      // handoff: five documents (kdp, foundations, draft, continuity, publish)
      // share these two rows, so a write made on one and navigated away from
      // before its 250ms push confirmed would otherwise be deleted by the next
      // document's opening pull — and the deletion pushed back as truth. The
      // manuscript row is the one that would hurt. See sync.js §HANDOFF.
      window.initCloudSync({
        appKey: 'kdp', syncedPrefixes: ['kdp:'], handoff: true,
        onApplied: function () { if (cfg.onSync) cfg.onSync(); }
      });
      window.initCloudSync({
        appKey: 'kdpms', syncedPrefixes: ['kdpms:'], handoff: true,
        onApplied: function () { if (cfg.onSyncManuscript) cfg.onSyncManuscript(); }
      });
    }

    window.addEventListener('kdp:save', function (e) {
      if (e.detail && e.detail.ok === false) {
        toast('Save failed — storage may be full. Export a backup from Settings.');
      }
    });

    initScroll();

    // The last reliable moment to get an edit off the device. On iOS,
    // beforeunload never fires and pagehide only fires on real navigation.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushAll();
    });
    window.addEventListener('pagehide', flushAll);
    window.addEventListener('beforeunload', flushAll);

    // Any link out of the page flushes first.
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.indexOf('#') === 0 || /^(https?:|mailto:)/.test(href)) return;
      e.preventDefault();
      navigate(href);
    });
  }

  function boot(fn) {
    document.addEventListener('DOMContentLoaded', function () {
      // IndexedDB has no synchronous read. Nothing may render before the shim
      // has hydrated, or the page paints an empty dashboard over real data.
      if (window.LocalStoreIDB && LocalStoreIDB.ready) {
        LocalStoreIDB.ready().then(function () { runSafely(fn, 'boot'); },
                                   function () { runSafely(fn, 'boot'); });
      } else {
        runSafely(fn, 'boot');
      }
    });
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  // ---------------------------------------------------------------------------
  window.Kdp = {
    $: $, el: el, on: on, esc: esc, autosize: autosize,
    toast: toast, copyText: copyText, runSafely: runSafely, showBootError: showBootError,
    statusPill: statusPill, meter: meter, statBlock: statBlock,
    armReveals: armReveals, initScroll: initScroll,
    openModal: openModal, closeModal: closeModal, modalOpen: modalOpen,
    fieldText: fieldText, fieldArea: fieldArea, fieldNum: fieldNum,
    fieldDate: fieldDate, fieldSelect: fieldSelect, readFields: readFields,
    createSaver: createSaver, flushAll: flushAll, flushAndGo: flushAndGo,
    pasteBlock: pasteBlock, wirePasteBlock: wirePasteBlock,
    noteRack: noteRack, wireNoteRack: wireNoteRack,
    promptRack: promptRack, wirePromptRack: wirePromptRack,
    blankRack: blankRack, wireBlankRack: wireBlankRack,
    openBlankSheet: openBlankSheet,
    mountBar: mountBar, syncBar: syncBar, barParent: barParent, navigate: navigate, makeRouter: makeRouter,
    initPage: initPage, boot: boot, param: param
  };
})();
