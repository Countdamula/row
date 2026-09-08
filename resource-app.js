// =============================================================
// resource-app.js — the router, the listeners and the two mounts.
//
// The views build strings. This file is the only one that
// listens, writes, knows what a hash means, or creates an
// <iframe>.
//
// TWO MOUNTS, ONE PAGE. `resource` carries res: — the library —
// and `resourcetext` carries rtx: — the writing. promptarium.html
// proves two initCloudSync calls on one document are safe; what
// makes them safe is that the prefixes cannot match each other,
// which resource-data.js checks character by character.
//
// REPAINT IS NOT NAVIGATION. repaint() does not scroll and does
// not re-arm the entrance; navigate() does both. Conflating them
// is how a phone in another room saving something throws away the
// place you had scrolled to.
//
// AND A TAB CHANGE IS NEITHER. Switching tabs on an item page
// scrolls to the tab strip rather than to the top of the
// document: the strip is where you were looking and the top of
// the page is a screen of photograph away.
// =============================================================

(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function U() { return global.AscUI; }
  function D() { return global.Resource; }
  function R() { return global.ResRich; }
  function V() { return global.ResViews; }
  function I() { return global.ResItem; }
  function esc(s) { return U().esc(s); }
  function attr(s) { return U().attr(s); }

  var state = {
    route: 'home', filter: 'all', sort: 'recent',
    type: '', id: '', tab: '', topicId: '', topic: ''
  };

  var NAV = [
    { href: '#/',            label: 'Home',        match: ['home'] },
    { href: '#/videos',      label: 'YouTube',     match: ['videos', 'video'] },
    { href: '#/books',       label: 'Books',       match: ['books', 'book'] },
    { href: '#/articles',    label: 'Articles',    match: ['articles', 'article'] },
    { href: '#/collections', label: 'Collections', match: ['collections', 'collection'] },
    { href: '#/about',       label: 'About',       match: ['about'] }
  ];

  var BOOK_FILTERS = { all: 1, reading: 1, read: 1, want: 1, shelved: 1 };
  var VIDEO_FILTERS = { all: 1, queued: 1, watching: 1, watched: 1 };

  // ═══ §ROUTING ══════════════════════════════════════════════

  function parseHash() {
    var raw = String(location.hash || '').replace(/^#\/?/, '');
    var p = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (!p.length) return { route: 'home' };

    switch (p[0]) {
      case 'books':
        return { route: 'books', filter: BOOK_FILTERS[p[1]] ? p[1] : 'all' };
      case 'videos':
        return { route: 'videos', filter: VIDEO_FILTERS[p[1]] ? p[1] : 'all' };
      case 'articles':
        return { route: 'articles', topic: p[1] || '' };
      case 'book':
      case 'video':
      case 'article':
        return { route: p[0], type: p[0], id: p[1] || '', tab: p[2] || '' };
      case 'collections':
        return { route: 'collections' };
      case 'collection':
        return { route: 'collection', topicId: p[1] || '' };
      case 'about':
        return { route: 'about' };
      default:
        return { route: 'home' };
    }
  }

  function applyHash() {
    var r = parseHash();
    state.route = r.route;
    state.filter = r.filter || 'all';
    state.topic = r.topic || '';
    state.topicId = r.topicId || '';
    state.type = r.type || '';
    state.id = r.id || '';
    state.tab = r.tab || '';
  }

  function html() {
    switch (state.route) {
      case 'books': return V().viewBooks(state);
      case 'videos': return V().viewVideos(state);
      case 'articles': return V().viewArticles(state);
      case 'collections': return V().viewCollections();
      case 'collection': return V().viewCollection(state);
      case 'about': return V().viewAbout();
      case 'book':
      case 'video':
      case 'article': return I().view(state.type, state.id, state.tab);
      default: return V().viewHome();
    }
  }

  // ═══ §PAINT ════════════════════════════════════════════════

  function repaint() {
    // Anything half-typed is written down BEFORE the DOM it lives
    // in is thrown away. Only a contenteditable can lose work to a
    // repaint, and there are seven of them on an item page.
    R().commitPending();
    $('rsRoot').innerHTML = html();
    paintChrome();
    R().afterPaint();
    growTextareas();
    if (RS.__readScroll) RS.__readScroll();
  }

  function navigate(prevRoute, prevId) {
    var sameItem = prevRoute === state.route && prevId === state.id && state.id;
    U().introArrive();
    repaint();
    if (sameItem) {
      // A tab change. Land on the strip, not on the photograph.
      var strip = $('rsRoot').querySelector('.rs-tabs2');
      if (strip) {
        var y = strip.getBoundingClientRect().top + (global.scrollY || 0) - 96;
        global.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      }
    } else {
      global.scrollTo({ top: 0, behavior: 'auto' });
    }
    if (RS.__readScroll) RS.__readScroll();
    if (document.activeElement && document.activeElement.isContentEditable) return;
    $('rsRoot').focus({ preventScroll: true });
  }

  // The three routes with no hero. See the note above ResItem.view.
  var HEROLESS = { book: 1, video: 1, article: 1 };

  function paintChrome() {
    document.documentElement.setAttribute('data-ground', 'night');

    // On a heroless route the content passes under the bar from the
    // first pixel, so the bar is stuck from the first pixel. The
    // scroll handler owns `is-stuck` everywhere else and will not
    // fight this: it only writes when its own idea of the flag
    // changes, and readScroll() runs after every paint.
    document.body.classList.toggle('hd-heroless', !!HEROLESS[state.route]);
    if (HEROLESS[state.route]) $('hdTop').classList.add('is-stuck');

    var link = function (n) {
      var on = n.match.indexOf(state.route) >= 0;
      return '<a href="' + n.href + '"' + (on ? ' class="is-on" aria-current="page"' : '') + '>' +
        esc(n.label) + '</a>';
    };
    var half = Math.ceil(NAV.length / 2);
    $('hdNavL').innerHTML = NAV.slice(0, half).map(link).join('');
    $('hdNavR').innerHTML = NAV.slice(half).map(link).join('');
  }

  // A textarea that does not grow is a textarea you write three
  // words in. Runs after every paint and on every keystroke in
  // one; cheap, because it only ever touches the one element.
  function grow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(1200, el.scrollHeight + 2) + 'px';
  }
  function growTextareas() {
    [].slice.call($('rsRoot').querySelectorAll('textarea[data-act]')).forEach(grow);
  }

  // ═══ §THE PLAYER ═══════════════════════════════════════════
  // The ONE place an iframe is created, and it is created only
  // when someone asks for it. Nothing is requested from YouTube
  // before that click — the still comes from i.ytimg.com and the
  // player is a whole third-party document.

  var player = { el: null, id: '' };

  function playVideo() {
    var host = $('rsPlayer');
    if (!host) return;
    var yt = host.getAttribute('data-yt');
    if (!yt) return;
    var frame = document.createElement('iframe');
    frame.className = 'rs-media__frame';
    frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) +
      '?autoplay=1&rel=0&modestbranding=1&enablejsapi=1';
    frame.title = 'Video player';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    host.innerHTML = '';
    host.appendChild(frame);
    host.classList.add('is-playing');
    player.el = frame;
    player.id = yt;
  }

  // The organized transcript's timestamps drive the player through
  // the iframe API's postMessage channel. With no player loaded
  // the click loads one first and then seeks, which is what the
  // timestamp means anyway.
  function seekTo(stamp) {
    var secs = R().stampSeconds(stamp);
    if (!player.el) {
      playVideo();
      if (!player.el) return;
      setTimeout(function () { postSeek(secs); }, 1400);
      return;
    }
    postSeek(secs);
  }
  function postSeek(secs) {
    try {
      player.el.contentWindow.postMessage(JSON.stringify({
        event: 'command', func: 'seekTo', args: [secs, true]
      }), 'https://www.youtube-nocookie.com');
    } catch (e) {}
  }

  // ═══ §THE COMPOSER ═════════════════════════════════════════
  // One sheet, four kinds, add and edit. Correcting a record and
  // creating one want the same fields, and two forms would drift.

  var cmp = { open: false, type: 'book', editing: null, lastFocus: null, rating: 0, formats: [] };

  var COMPOSER_TITLE = {
    book: { add: 'Add a book', edit: 'Edit the book' },
    video: { add: 'Add a video', edit: 'Edit the video' },
    article: { add: 'Save an article', edit: 'Edit the article' },
    topic: { add: 'New topic', edit: 'Edit the topic' }
  };

  function field(o) {
    var id = 'f_' + o.k;
    var input;
    if (o.kind === 'textarea') {
      input = '<textarea class="asc-textarea" id="' + id + '" data-f="' + attr(o.k) + '" placeholder="' +
        attr(o.ph || '') + '">' + esc(o.v || '') + '</textarea>';
    } else if (o.kind === 'select') {
      input = '<select class="asc-select" id="' + id + '" data-f="' + attr(o.k) + '">' +
        o.options.map(function (op) {
          return '<option value="' + attr(op.v) + '"' + (op.v === o.v ? ' selected' : '') + '>' +
            esc(op.label) + '</option>';
        }).join('') + '</select>';
    } else {
      input = '<input class="asc-input" id="' + id + '" type="' + (o.type || 'text') + '" ' +
        (o.inputmode ? 'inputmode="' + attr(o.inputmode) + '" ' : '') +
        'autocomplete="off" data-f="' + attr(o.k) + '" value="' + attr(o.v || '') +
        '" placeholder="' + attr(o.ph || '') + '">';
    }
    return '<div class="vt-f' + (o.wide ? ' vt-f--wide' : '') + '">' +
      '<label class="asc-label" for="' + id + '">' + esc(o.label) + '</label>' + input +
      (o.hint ? '<p class="vt-hint">' + esc(o.hint) + '</p>' : '') +
    '</div>';
  }

  function statusOptions(type) {
    var m = {
      book: [['want', 'To read'], ['reading', 'Reading'], ['read', 'Read'], ['shelved', 'Set aside']],
      video: [['queued', 'Queued'], ['watching', 'Watching'], ['watched', 'Watched']],
      article: [['unread', 'Unread'], ['reading', 'Reading'], ['read', 'Read']]
    }[type] || [];
    return m.map(function (x) { return { v: x[0], label: x[1] }; });
  }

  function coverField(rec) {
    return '<div class="vt-f vt-f--wide">' +
      '<label class="asc-label" for="f_cover">Cover image</label>' +
      '<div class="rs-coverrow">' +
        '<input class="asc-input" id="f_cover" type="url" inputmode="url" autocomplete="off" ' +
          'spellcheck="false" data-f="cover" value="' + attr(rec.cover || '') +
          '" placeholder="Paste a URL, or upload one">' +
        '<button type="button" class="asc-btn asc-btn--sm" data-act="cover-pick">Upload</button>' +
      '</div>' +
      '<p class="vt-hint">Any picture you like. It is compressed and stored in your own ' +
      'bucket, so it does not bloat the row.</p>' +
      '<div class="vt-prev" id="cmpPrev"' + (rec.cover ? '' : ' hidden') + '>' +
        '<img id="cmpPrevImg" alt=""' + (rec.cover ? ' src="' + attr(rec.cover) + '"' : '') + '>' +
        '<span class="vt-prev__meta"><b>Cover</b><span>Shown on the card and the page</span></span>' +
      '</div>' +
    '</div>';
  }

  function formatsField(rec) {
    return '<div class="vt-f vt-f--wide">' +
      '<span class="asc-label">Formats</span>' +
      '<div class="vt-togs" id="cmpFormats">' + D().FORMATS.map(function (f) {
        var on = (rec.formats || []).indexOf(f) >= 0;
        return '<button type="button" class="asc-btn asc-btn--sm' + (on ? ' is-on' : '') +
          '" data-act="fmt" data-v="' + attr(f) + '" aria-pressed="' + (on ? 'true' : 'false') +
          '">' + esc(f) + '</button>';
      }).join('') + '</div>' +
    '</div>';
  }

  function starsField(rating) {
    return '<div class="vt-f vt-f--wide">' +
      '<span class="asc-label">Rating</span>' +
      '<div class="vt-stars" id="cmpStars">' +
        [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" class="vt-star' + (n <= rating ? ' is-on' : '') +
            '" data-act="star-set" data-n="' + n + '" aria-label="' + n +
            (n === 1 ? ' star' : ' stars') + '">★</button>';
        }).join('') +
        '<button type="button" class="asc-btn asc-btn--quiet asc-btn--sm" data-act="star-set" ' +
          'data-n="0">Clear</button>' +
      '</div>' +
    '</div>';
  }

  function composerFields(type, rec) {
    var out = '<div class="vt-msg" id="cmpMsg" role="status"></div>';

    if (type === 'topic') {
      return out +
        field({ k: 'name', label: 'Name', v: rec.name, wide: true, ph: 'Attention, Stoicism, Note-taking…' }) +
        field({ k: 'kind', label: 'Kind', kind: 'select', v: rec.kind || 'topic',
          options: D().TOPIC_KINDS.map(function (k) { return { v: k, label: k.charAt(0).toUpperCase() + k.slice(1) }; }) }) +
        field({ k: 'tint', label: 'Tint', type: 'color', v: rec.tint || '#c79a52',
          hint: 'A colour for its card in Collections.' }) +
        field({ k: 'blurb', label: 'In one line', kind: 'textarea', v: rec.blurb, wide: true,
          ph: 'What is the thread here?' });
    }

    out += field({ k: 'url', label: 'Link', type: 'url', inputmode: 'url', v: rec.url, wide: true,
      ph: 'https://…',
      hint: type === 'video'
        ? 'Paste a YouTube link and the title, channel and thumbnail fill themselves in.'
        : 'Where this came from. It becomes the button on the card.' });
    out += field({ k: 'title', label: 'Title', v: rec.title, wide: true, ph: 'What is it called?' });

    if (type === 'book') {
      out += field({ k: 'author', label: 'Author', v: rec.author, ph: 'Who wrote it' });
      out += field({ k: 'status', label: 'Status', kind: 'select', v: rec.status || 'want',
        options: statusOptions('book') });
      out += formatsField(rec);
      out += field({ k: 'pages', label: 'Pages', type: 'number', inputmode: 'numeric',
        v: rec.pages || '' });
      out += field({ k: 'year', label: 'Year', v: rec.year, ph: '2019' });
      out += field({ k: 'publisher', label: 'Publisher', v: rec.publisher });
      out += field({ k: 'isbn', label: 'ISBN', v: rec.isbn,
        hint: 'With no cover of your own, this fetches one from Open Library.' });
      out += field({ k: 'startedAt', label: 'Started', type: 'date', v: rec.startedAt });
      out += field({ k: 'readAt', label: 'Finished', type: 'date', v: rec.readAt });
    } else if (type === 'video') {
      out += field({ k: 'channel', label: 'Channel', v: rec.channel });
      out += field({ k: 'status', label: 'Status', kind: 'select', v: rec.status || 'queued',
        options: statusOptions('video') });
      out += field({ k: 'duration', label: 'Length', v: rec.duration, ph: '24:18' });
      out += field({ k: 'views', label: 'Views', v: rec.views, ph: '1.2M' });
      out += field({ k: 'publishedAt', label: 'Published', v: rec.publishedAt, ph: 'Nov 8, 2025' });
    } else {
      out += field({ k: 'label', label: 'Section', v: rec.label, ph: 'Writing tools, Essays…' });
      out += field({ k: 'status', label: 'Status', kind: 'select', v: rec.status || 'unread',
        options: statusOptions('article') });
      out += field({ k: 'author', label: 'Author', v: rec.author });
      out += field({ k: 'source', label: 'Published in', v: rec.source, ph: 'The publication' });
      out += field({ k: 'publishedAt', label: 'Published', type: 'date', v: rec.publishedAt });
      out += field({ k: 'deck', label: 'Standfirst', kind: 'textarea', v: rec.deck, wide: true,
        ph: 'The line under the headline.' });
    }

    out += coverField(rec);
    out += starsField(rec.rating || 0);
    out += field({ k: 'note', label: 'Note', kind: 'textarea', v: rec.note, wide: true,
      ph: type === 'book' ? 'Why is it on the shelf?' : 'Why did you keep this?' });
    return out;
  }

  function openComposer(type, id) {
    var rec = id ? D().itemOf(type, id) || D().Topics.get(id) : null;
    if (id && !rec) return;
    cmp.type = type;
    cmp.editing = rec ? rec.id : null;
    cmp.rating = rec ? rec.rating || 0 : 0;
    cmp.formats = rec && rec.formats ? rec.formats.slice() : [];
    cmp.lastFocus = document.activeElement;

    $('cmpTitle').textContent = COMPOSER_TITLE[type][rec ? 'edit' : 'add'];
    $('cmpForm').innerHTML = composerFields(type, rec || {});
    $('cmpDel').hidden = !rec;
    $('cmpAgain').hidden = !!rec;

    $('cmpScrim').hidden = false;
    $('cmp').hidden = false;
    requestAnimationFrame(function () {
      $('cmpScrim').classList.add('is-on');
      $('cmp').classList.add('is-on');
    });
    document.body.classList.add('asc-locked');
    cmp.open = true;

    // The draft net. Scoped by kind and record, so a half-typed
    // new book and a half-typed edit of an old one cannot collide.
    if (global.AthDraft) {
      try {
        AthDraft.bind('cmp:' + type + ':' + (rec ? rec.id : 'new'), $('cmpForm'), {
          onRestore: function () { U().toast('Recovered what you were typing'); }
        });
      } catch (e) {}
    }

    var first = $('cmpForm').querySelector('input,select,textarea');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeComposer(discard) {
    if (!cmp.open) return;
    $('cmpScrim').classList.remove('is-on');
    $('cmp').classList.remove('is-on');
    document.body.classList.remove('asc-locked');
    cmp.open = false;
    setTimeout(function () {
      if (cmp.open) return;
      $('cmp').hidden = true;
      $('cmpScrim').hidden = true;
      $('cmpForm').innerHTML = '';
    }, 260);
    if (discard && global.AthDraft) {
      try { AthDraft.clear('cmp:' + cmp.type + ':' + (cmp.editing || 'new')); } catch (e) {}
    }
    if (cmp.lastFocus && document.contains(cmp.lastFocus)) {
      try { cmp.lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function readComposer() {
    var out = {};
    [].slice.call($('cmpForm').querySelectorAll('[data-f]')).forEach(function (el) {
      out[el.getAttribute('data-f')] = el.value;
    });
    out.rating = cmp.rating;
    if (cmp.type === 'book') out.formats = cmp.formats.slice();
    if (out.url) out.url = D().typedUrl(out.url);
    if (out.cover) out.cover = D().typedUrl(out.cover);
    return out;
  }

  function say(msg, bad) {
    var el = $('cmpMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'vt-msg is-on ' + (bad ? 'is-bad' : 'is-warn');
  }

  function saveComposer(again) {
    var f = readComposer();
    if (cmp.type === 'topic') {
      if (!String(f.name || '').trim()) return say('A topic needs a name.', true);
      if (cmp.editing) D().Topics.update(cmp.editing, f);
      else D().Topics.add(f);
    } else {
      if (!String(f.title || '').trim() && !f.url) {
        return say('Give it a title, or a link to take one from.', true);
      }
      if (!String(f.title || '').trim()) f.title = D().domainOf(f.url) || 'Untitled';
      var col = D().collectionFor(cmp.type);
      if (cmp.editing) col.update(cmp.editing, f);
      else {
        var rec = col.add(f);
        cmp.editing = null;
        if (!again) {
          closeComposer(true);
          location.hash = D().hrefOf(cmp.type, rec.id).slice(1);
          return;
        }
      }
    }
    if (global.AthDraft) {
      try { AthDraft.clear('cmp:' + cmp.type + ':' + (cmp.editing || 'new')); } catch (e) {}
    }
    if (again) {
      $('cmpForm').innerHTML = composerFields(cmp.type, {});
      cmp.rating = 0; cmp.formats = [];
      say('Saved. Add another.');
      var first = $('cmpForm').querySelector('input');
      if (first) first.focus();
      repaint();
      return;
    }
    closeComposer(true);
    repaint();
    U().toast('Saved');
  }

  // A YouTube link, read for its title and channel. oEmbed is a
  // public endpoint with CORS; if it is blocked, offline, or the
  // video is private, nothing happens and the fields stay as
  // typed.
  function fillFromYouTube(url) {
    var vid = D().youtubeId(url);
    if (!vid) return;
    var titleEl = $('cmpForm').querySelector('[data-f="title"]');
    var chEl = $('cmpForm').querySelector('[data-f="channel"]');
    if (titleEl && titleEl.value.trim() && chEl && chEl.value.trim()) return;
    fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + vid))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (titleEl && !titleEl.value.trim()) titleEl.value = j.title || '';
        if (chEl && !chEl.value.trim()) chEl.value = j.author_name || '';
      })
      .catch(function () {});
  }

  // ═══ §COVER UPLOADS ════════════════════════════════════════

  function pickImage(onUrl) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      U().toast('Reading the picture');
      R().ingestImageFile(file, function (small) { onUrl(small, false); },
        function (url) { onUrl(url, true); });
    };
    input.click();
  }

  function setCover(type, id) {
    pickImage(function (url, final) {
      var col = D().collectionFor(type);
      if (!col || !col.get(id)) return;
      col.update(id, { cover: url });
      repaint();
      if (final) U().toast('Cover saved');
    });
  }

  // ═══ §THE ACTIONS ══════════════════════════════════════════

  function go(hash) { location.hash = hash; }
  function ask(msg) { return global.confirm(msg); }

  function copyText(text, said) {
    var done = function () { U().toast(said || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-2000px;left:-2000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  var ACTS = {
    add: function (el) { openComposer(normType(el.getAttribute('data-type')), ''); },
    edit: function (el) {
      var id = el.getAttribute('data-id');
      var type = D().Topics.get(id) ? 'topic' : state.type || 'book';
      openComposer(type, id);
    },
    'edit-topic': function (el) { openComposer('topic', el.getAttribute('data-id')); },

    star: function (el) {
      var id = el.getAttribute('data-id');
      var col = D().collectionFor(state.type);
      var rec = col && col.get(id);
      if (!rec) return;
      col.update(id, { featured: !rec.featured });
      repaint();
    },
    status: function (el) {
      var col = D().collectionFor(state.type);
      if (!col) return;
      var patch = { status: el.getAttribute('data-v') };
      // Finishing a book on the page you are reading it on should
      // not also require going into the form to write today's date.
      if (state.type === 'book' && patch.status === 'read') {
        var b = col.get(el.getAttribute('data-id'));
        if (b && !b.readAt) patch.readAt = D().todayISO();
      }
      if (state.type === 'book' && patch.status === 'reading') {
        var b2 = col.get(el.getAttribute('data-id'));
        if (b2 && !b2.startedAt) patch.startedAt = D().todayISO();
      }
      col.update(el.getAttribute('data-id'), patch);
      repaint();
    },
    share: function () {
      copyText(location.href, 'Link copied');
    },
    'delete': function (el) {
      var id = el.getAttribute('data-id');
      var col = D().collectionFor(state.type);
      var rec = col && col.get(id);
      if (!rec) return;
      if (!ask('Delete "' + (rec.title || 'this') + '"?\n\nIts notes, transcript, questions and ' +
        'topic links go with it. This cannot be undone from here — the nightly backup is the ' +
        'only way back.')) return;
      D().removeItem(state.type, id);
      go(CRUMB_HASH[state.type]);
      U().toast('Deleted');
    },
    'delete-topic': function (el) {
      var id = el.getAttribute('data-id');
      var t = D().Topics.get(id);
      if (!t) return;
      if (!ask('Delete the topic "' + t.name + '"?\n\nNothing filed under it is deleted — only ' +
        'the topic and its links.')) return;
      D().removeTopic(id);
      go('#/collections');
      U().toast('Topic deleted');
    },

    play: function () { playVideo(); },
    seek: function (el) { seekTo(el.getAttribute('data-t')); },
    'embed-play': function (el) {
      var yt = el.getAttribute('data-yt');
      var url = el.getAttribute('data-url');
      if (!yt) { global.open(url, '_blank', 'noopener'); return; }
      var host = el.closest('.rs-embed');
      if (!host) return;
      var frame = document.createElement('iframe');
      frame.className = 'rs-embed__frame';
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) +
        '?autoplay=1&rel=0&modestbranding=1';
      frame.title = 'Video';
      frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      host.innerHTML = '';
      host.appendChild(frame);
    },

    cover: function (el) { setCover(el.getAttribute('data-type'), el.getAttribute('data-id')); },
    'cover-pick': function () {
      pickImage(function (url) {
        var f = $('cmpForm').querySelector('[data-f="cover"]');
        if (f) f.value = url;
        var prev = $('cmpPrev'), img = $('cmpPrevImg');
        if (prev && img) { img.src = url; prev.hidden = false; }
      });
    },

    'go-tab': function (el) { go(I().itemHref(state.type, state.id, el.getAttribute('data-tab'))); },
    more: function (el) { el.classList.toggle('is-open'); },

    'edit-intro': function (el) {
      var key = el.getAttribute('data-key');
      var cur = D().getPages()[key] || '';
      var next = global.prompt('The words under this page\'s title', cur);
      if (next == null) return;
      var patch = {};
      patch[key] = next;
      D().setPages(patch);
      repaint();
    },

    // ── topics ───────────────────────────────────────────────
    topic: function (el) {
      D().linkTopic(el.getAttribute('data-topic'), el.getAttribute('data-type'), el.getAttribute('data-id'));
      repaint();
    },
    untopic: function (el) {
      D().unlinkTopic(el.getAttribute('data-topic'), el.getAttribute('data-type'), el.getAttribute('data-id'));
      repaint();
    },

    // ── chapters ─────────────────────────────────────────────
    'chap-add': function (el) {
      var bookId = el.getAttribute('data-id');
      var all = D().chaptersFor(bookId);
      var ch = D().Chapters.add({
        bookId: bookId, title: 'Chapter ' + (all.length + 1), order: D().nextOrder(all)
      });
      openChapter(bookId, ch.id);
      repaint();
    },
    'chap-open': function (el) {
      var bookId = el.getAttribute('data-book'), id = el.getAttribute('data-id');
      var open = (D().getUiState().openChapter || {})[bookId];
      openChapter(bookId, open === id ? '' : id);
      repaint();
    },
    'chap-up': function (el) { moveChapter(el, -1); },
    'chap-down': function (el) { moveChapter(el, 1); },
    'chap-copy': function (el) {
      var ch = D().Chapters.get(el.getAttribute('data-id'));
      if (!ch) return;
      copyText(ch.title + '\n\n' + R().htmlToText(D().getText('body', 'chapter', ch.id)));
    },
    'chap-copyall': function (el) {
      var rows = D().chaptersFor(el.getAttribute('data-id'));
      copyText(rows.map(function (ch) {
        return ch.title + '\n\n' + R().htmlToText(D().getText('body', 'chapter', ch.id));
      }).join('\n\n\n'), rows.length + ' chapters copied');
    },
    'chap-del': function (el) {
      var ch = D().Chapters.get(el.getAttribute('data-id'));
      if (!ch) return;
      if (!ask('Delete "' + (ch.title || 'this chapter') + '" and its text?')) return;
      D().removeChapter(ch.id);
      repaint();
    },
    'chap-paste': function (el) {
      var bookId = el.getAttribute('data-id');
      openPaste(bookId);
    },

    // ── the video transcripts ────────────────────────────────
    'tr-copy': function (el) {
      copyText(D().getText('tr', 'video', el.getAttribute('data-id')), 'Transcript copied');
    },
    'tr-organize': function (el) {
      var id = el.getAttribute('data-id');
      var text = D().getText('tr', 'video', id);
      if (!String(text).trim()) return U().toast('Nothing to organize yet');
      var rows = R().organizeTranscript(text);
      if (!rows.length) return U().toast('No timestamps found');
      var had = D().getRows('tro', 'video', id).length;
      if (had && !ask('Replace the ' + had + ' sections already here with ' + rows.length +
        ' built from the transcript?')) return;
      D().setRows('tro', 'video', id, rows);
      go(I().itemHref('video', id, 'organized'));
      U().toast(rows.length + ' sections built');
    },
    'org-add': function (el) {
      var id = el.getAttribute('data-id');
      var rows = D().getRows('tro', 'video', id).slice();
      rows.push({ t: '', title: '', text: '' });
      D().setRows('tro', 'video', id, rows);
      repaint();
    },
    'org-del': function (el) {
      var id = el.getAttribute('data-id'), i = Number(el.getAttribute('data-i'));
      var rows = D().getRows('tro', 'video', id).slice();
      rows.splice(i, 1);
      D().setRows('tro', 'video', id, rows);
      repaint();
    },
    'org-copy': function (el) {
      var rows = D().getRows('tro', 'video', el.getAttribute('data-id'));
      copyText(rows.map(function (r) {
        return (r.t ? '[' + r.t + '] ' : '') + (r.title || '') + (r.text ? '\n' + r.text : '');
      }).join('\n\n'), 'Copied');
    },

    // ── questions ────────────────────────────────────────────
    'qa-add': function (el) {
      var type = el.getAttribute('data-type'), id = el.getAttribute('data-id');
      D().QA.add({ itemType: type, itemId: id, order: D().nextOrder(D().qaFor(type, id)) });
      repaint();
      var boxes = $('rsRoot').querySelectorAll('.rs-qa__q');
      if (boxes.length) boxes[boxes.length - 1].focus();
    },
    'qa-del': function (el) {
      var r = D().QA.get(el.getAttribute('data-id'));
      if (!r) return;
      if (r.q.trim() && !ask('Delete this question?')) return;
      D().QA.remove(r.id);
      repaint();
    },
    'qa-up': function (el) { moveQA(el, -1); },
    'qa-down': function (el) { moveQA(el, 1); },

    // ── the rich toolbar ─────────────────────────────────────
    'rich-cmd': function (el) {
      R().runCommand(el.getAttribute('data-cmd'), el.getAttribute('data-val'));
    },

    // ── the studio ───────────────────────────────────────────
    starter: function () {
      if (!ask('Add eight books, with notes and topics already attached?\n\n' +
        'They are ordinary records — delete any of them the way you would delete your own.')) return;
      var n = D().loadStarterLibrary();
      repaint();
      U().toast(n ? n + ' books added' : 'They are already here');
    },
    'export': function () {
      if (global.DataExport && global.DataExport.open) { global.DataExport.open('resource'); return; }
      go('#/about');
      U().toast('Use the data rail in the corner');
    },
    find: function () { openFind(); },
    'find-close': function () { closeFind(); },

    // ── the composer's own ───────────────────────────────────
    fmt: function (el) {
      var v = el.getAttribute('data-v');
      var i = cmp.formats.indexOf(v);
      if (i < 0) cmp.formats.push(v); else cmp.formats.splice(i, 1);
      el.classList.toggle('is-on', i < 0);
      el.setAttribute('aria-pressed', String(i < 0));
    },
    'star-set': function (el) {
      cmp.rating = Number(el.getAttribute('data-n')) || 0;
      [].slice.call($('cmpStars').querySelectorAll('.vt-star')).forEach(function (s, i) {
        s.classList.toggle('is-on', i < cmp.rating);
      });
    }
  };

  var CRUMB_HASH = { book: '#/books', video: '#/videos', article: '#/articles' };

  function normType(t) {
    return t === 'books' ? 'book' : t === 'videos' ? 'video' : t === 'articles' ? 'article' : t;
  }

  function openChapter(bookId, chapterId) {
    var m = Object.assign({}, D().getUiState().openChapter || {});
    m[bookId] = chapterId;
    D().setUiState({ openChapter: m });
  }

  function moveChapter(el, dir) {
    var bookId = el.getAttribute('data-book'), id = el.getAttribute('data-id');
    var rows = D().chaptersFor(bookId);
    var i = rows.findIndex(function (c) { return c.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    var ids = rows.map(function (c) { return c.id; });
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    D().reorderChapters(bookId, ids);
    repaint();
  }

  function moveQA(el, dir) {
    var type = el.getAttribute('data-type'), item = el.getAttribute('data-item');
    var rows = D().qaFor(type, item);
    var i = rows.findIndex(function (r) { return r.id === el.getAttribute('data-id'); });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    var ids = rows.map(function (r) { return r.id; });
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    D().reorderQA(type, item, ids);
    repaint();
  }

  // ── paste a whole transcript ───────────────────────────────
  // Its own small dialog rather than a prompt(): a book's
  // transcript is tens of thousands of characters and prompt()
  // gives you one line to put them in.
  function openPaste(bookId) {
    var host = U().sheetEl();
    if (!host) return;
    U().openSheet(
      '<button type="button" class="asc-back" data-act="sheet-close">Close</button>' +
      '<h2 class="hd-plate">Paste a whole transcript</h2>' +
      '<p class="asc-small">It splits on the headings. Anything that looks like ' +
      '“Chapter 4”, “Part Two” or a heading becomes a chapter of its own; if there are ' +
      'none, it all lands in one.</p>' +
      '<div class="hd-form">' +
        '<label class="asc-label" for="pasteBox">The transcript</label>' +
        '<div class="asc-textarea asc-textarea--tall rs-pastebox" id="pasteBox" ' +
          'contenteditable="true" role="textbox" aria-multiline="true"></div>' +
      '</div>' +
      '<div class="asc-sheet__acts">' +
        '<button type="button" class="asc-btn asc-btn--primary" id="pasteGo">Split into chapters</button>' +
        '<button type="button" class="asc-btn asc-btn--quiet" data-act="sheet-close">Cancel</button>' +
      '</div>'
    );
    var go2 = $('pasteGo');
    if (!go2) return;
    go2.onclick = function () {
      var box = $('pasteBox');
      var parts = R().splitIntoChapters(box ? box.innerHTML : '');
      if (!parts.length) { U().toast('Nothing to split'); return; }
      var start = D().nextOrder(D().chaptersFor(bookId));
      parts.forEach(function (p, i) {
        var ch = D().Chapters.add({ bookId: bookId, title: p.title, order: start + i });
        D().setText('body', 'chapter', ch.id, p.html);
      });
      U().closeSheet();
      openChapter(bookId, '');
      repaint();
      U().toast(parts.length + (parts.length === 1 ? ' chapter added' : ' chapters added'));
    };
  }

  // ═══ §SEARCH ═══════════════════════════════════════════════

  function openFind() {
    var box = $('hdFind');
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add('is-on'); });
    $('hdFindIn').value = '';
    $('hdFindOut').innerHTML = '<p class="hd-find__hint">Books, videos, articles and topics.</p>';
    setTimeout(function () { $('hdFindIn').focus(); }, 40);
  }
  function closeFind() {
    var box = $('hdFind');
    box.classList.remove('is-on');
    setTimeout(function () { box.hidden = true; }, 200);
  }
  function paintFind(q) {
    var out = $('hdFindOut');
    var hits = D().search(q);
    if (!String(q).trim()) {
      out.innerHTML = '<p class="hd-find__hint">Books, videos, articles and topics.</p>';
      return;
    }
    if (!hits.length) {
      out.innerHTML = '<p class="hd-find__hint">Nothing matches “' + esc(q) + '”.</p>';
      return;
    }
    out.innerHTML = '<p class="hd-find__n">' + hits.length +
      (hits.length === 1 ? ' result' : ' results') + '</p>' +
      hits.map(function (e) {
        var href = e.type === 'topic'
          ? '#/collection/' + encodeURIComponent(e.rec.id)
          : D().hrefOf(e.type, e.rec.id);
        var cover = e.type === 'topic' ? '' : D().coverOf(e.type, e.rec);
        return '<a class="hd-find__row" href="' + attr(href) + '" data-act="find-go">' +
          (cover ? '<img src="' + attr(cover) + '" alt="" loading="lazy" onerror="this.remove()">'
                 : '<span></span>') +
          '<span><b>' + esc(e.rec.title || e.rec.name) + '</b>' +
          '<i>' + esc(V().typeLabel(e.type)) + (D().subtitleOf(e.type, e.rec)
            ? ' · ' + esc(D().subtitleOf(e.type, e.rec)) : '') + '</i></span>' +
        '</a>';
      }).join('');
  }

  // ═══ §BINDING ══════════════════════════════════════════════

  function bind() {
    U().delegate($('rsRoot'), ACTS);
    U().delegate($('cmp'), ACTS);
    U().delegate($('hdTop'), Object.assign({ menu: toggleMenu }, ACTS));
    U().delegate($('hdFoot'), ACTS);

    // Live edits: the fields that write straight through without a
    // Save button. All debounced, because each one is a row push.
    var timers = {};
    function later(key, fn, ms) {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(fn, ms || 500);
    }

    $('rsRoot').addEventListener('input', function (e) {
      var el = e.target;
      var act = el.getAttribute && el.getAttribute('data-act');
      if (!act) return;
      if (el.tagName === 'TEXTAREA') grow(el);

      if (act === 'chap-title') {
        later('ch' + el.getAttribute('data-id'), function () {
          D().Chapters.update(el.getAttribute('data-id'), { title: el.value });
          var bar = el.closest('.rs-chap');
          var label = bar && bar.querySelector('.rs-chap__t');
          if (label) label.textContent = el.value || 'Untitled chapter';
        });
      } else if (act === 'tr-save') {
        later('tr' + el.getAttribute('data-id'), function () {
          D().setText('tr', 'video', el.getAttribute('data-id'), el.value);
        }, 700);
      } else if (act === 'org-title' || act === 'org-text') {
        var id = el.getAttribute('data-id'), i = Number(el.getAttribute('data-i'));
        later('org' + id + i, function () {
          var rows = D().getRows('tro', 'video', id).slice();
          if (!rows[i]) return;
          rows[i] = Object.assign({}, rows[i], act === 'org-title'
            ? { title: el.value } : { text: el.value });
          D().setRows('tro', 'video', id, rows);
        }, 700);
      } else if (act === 'qa-q' || act === 'qa-a') {
        var qid = el.getAttribute('data-id');
        later('qa' + qid + act, function () {
          var patch = {};
          patch[act === 'qa-q' ? 'q' : 'a'] = el.value;
          D().QA.update(qid, patch);
        }, 700);
      }
    });

    $('rsRoot').addEventListener('change', function (e) {
      var el = e.target;
      if (el.getAttribute && el.getAttribute('data-act') === 'sort') {
        state.sort = el.value;
        repaint();
      }
    });

    // Adding a topic by name. A form so Enter works, which is the
    // only way anyone actually uses a field like this.
    $('rsRoot').addEventListener('submit', function (e) {
      var form = e.target.closest('[data-act="topic-add-form"]');
      if (!form) return;
      e.preventDefault();
      var input = form.querySelector('input');
      var name = input ? input.value : '';
      if (!String(name).trim()) return;
      D().linkTopicNamed(name, form.getAttribute('data-type'), form.getAttribute('data-id'));
      if (input) input.value = '';
      repaint();
    });

    // The composer's own plumbing.
    $('cmpSave').onclick = function () { saveComposer(false); };
    $('cmpAgain').onclick = function () { saveComposer(true); };
    $('cmpX').onclick = function () { closeComposer(false); };
    $('cmpScrim').onclick = function () { closeComposer(false); };
    $('cmpDel').onclick = function () {
      if (!cmp.editing) return;
      var isTopic = cmp.type === 'topic';
      if (!ask(isTopic
        ? 'Delete this topic? Nothing filed under it is deleted.'
        : 'Delete this, with its notes, transcript and questions?')) return;
      if (isTopic) D().removeTopic(cmp.editing);
      else D().removeItem(cmp.type, cmp.editing);
      closeComposer(true);
      go(isTopic ? '#/collections' : CRUMB_HASH[cmp.type]);
      U().toast('Deleted');
    };
    $('cmpForm').addEventListener('input', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-f');
      if (f === 'cover') {
        var prev = $('cmpPrev'), img = $('cmpPrevImg');
        var v = D().typedUrl(e.target.value);
        if (prev && img) { img.src = v; prev.hidden = !v; }
      }
    });
    $('cmpForm').addEventListener('change', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-f');
      if (f === 'url' && cmp.type === 'video') fillFromYouTube(e.target.value);
    });

    $('addFab').onclick = function () {
      var t = state.route === 'videos' || state.route === 'video' ? 'video'
        : state.route === 'articles' || state.route === 'article' ? 'article'
        : state.route === 'collections' || state.route === 'collection' ? 'topic' : 'book';
      openComposer(t, '');
    };

    // Search.
    $('hdFindIn').addEventListener('input', function () { paintFind(this.value); });
    $('hdFind').addEventListener('click', function (e) {
      if (e.target === this) closeFind();
      var row = e.target.closest && e.target.closest('[data-act="find-go"]');
      if (row) closeFind();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('hdFind').hidden) { e.preventDefault(); return closeFind(); }
        if (cmp.open) { e.preventDefault(); return closeComposer(false); }
      }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (cmp.open || U().sheetOpen()) return;
      if (e.key === '/') { e.preventDefault(); return openFind(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); return $('addFab').click(); }
    });

    // Tab-trap the composer: it is a full-height panel over a page
    // full of links.
    $('cmp').addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].slice.call($('cmp').querySelectorAll('input,select,textarea,button'))
        .filter(function (n) { return !n.hidden && !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    bindScroll();
  }

  function toggleMenu() {
    var on = document.body.classList.toggle('hd-menu-on');
    $('hdBurger').setAttribute('aria-expanded', String(on));
  }

  // ── the bar and the parallax, in one rAF ───────────────────
  // Lifted from vault-app.js unchanged in behaviour. Two
  // listeners reading the same scroll position on the same frame
  // is two layout reads where one would do.
  function bindScroll() {
    var stuck = null, ticking = false, heroEl = null, heroH = 0;
    var reduced = function () { return U().reducedMotion(); };

    var measureHero = function () {
      heroEl = $('rsRoot').querySelector('[data-parallax]');
      heroH = heroEl ? heroEl.offsetHeight : 0;
    };

    var readScroll = function () {
      ticking = false;
      var y = global.scrollY || document.documentElement.scrollTop || 0;
      // A heroless route has nothing for the bar to float on, so it is
      // stuck at rest. Without this clause the scroll handler would
      // take back what paintChrome just set the moment anything asked
      // it to read.
      var want = y > 24 || document.body.classList.contains('hd-heroless');
      if (want !== stuck) {
        stuck = want;
        $('hdTop').classList.toggle('is-stuck', want);
      }
      if (!heroEl || !heroH) return;
      if (y > heroH + 40) {
        if (heroEl.dataset.parked !== '1') {
          heroEl.dataset.parked = '1';
          heroEl.style.setProperty('--hd-par', '0px');
          heroEl.style.setProperty('--hd-lift', '0px');
          heroEl.style.setProperty('--hd-fade', '0');
        }
        return;
      }
      heroEl.dataset.parked = '0';
      if (reduced()) return;
      var p = y / heroH;
      heroEl.style.setProperty('--hd-par', (y * 0.34).toFixed(1) + 'px');
      heroEl.style.setProperty('--hd-lift', (y * -0.06).toFixed(1) + 'px');
      heroEl.style.setProperty('--hd-fade', Math.max(0, 1 - p / 0.62).toFixed(3));
    };

    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(readScroll);
    }, { passive: true });
    addEventListener('resize', function () { measureHero(); readScroll(); }, { passive: true });

    measureHero();
    readScroll();
    RS.__readScroll = function () { measureHero(); readScroll(); };
  }

  // ═══ §BOOT ═════════════════════════════════════════════════

  function boot() {
    if (global.Snapshots) {
      try { global.Snapshots.forApp('resource').boot(); }
      catch (e) { try { console.error('[snapshots]', e); } catch (e2) {} }
    }

    U().bindSheet();
    R().bind($('rsRoot'), {
      // A body that changed re-derives the fields the feed shows.
      // They are never typed: a field you have to remember to fill
      // is a field that stays empty.
      onSaved: function (p, clean) {
        if (p.slot !== 'body' || p.type !== 'article') return;
        var text = R().htmlToText(clean);
        D().Articles.update(p.id, {
          excerpt: R().excerptOf(text, 260),
          minutes: R().readingMinutes(clean)
        });
      }
    });
    bind();

    applyHash();
    U().introArrive();
    repaint();

    // TWO ROWS, TWO MOUNTS. Neither reads or writes the other's
    // prefix, and neither touches any other page's.
    var remoteRef = { applied: false };
    var pull = function () {
      if (!U().safeToRepaint()) return;
      if (cmp.open || !$('hdFind').hidden) return;
      // A REPAINT, not a navigation: it does not scroll, and
      // rvlStyle() hands the re-created cards a negative --t so an
      // entrance that was halfway through resumes rather than
      // replaying.
      repaint();
    };
    if (typeof global.initCloudSync === 'function') {
      global.initCloudSync({
        appKey: 'resource',
        syncedPrefixes: ['res:'],
        handoff: true,
        onApplied: function () { remoteRef.applied = true; pull(); }
      });
      global.initCloudSync({
        appKey: 'resourcetext',
        syncedPrefixes: ['rtx:'],
        handoff: true,
        onApplied: pull
      });
    }

    // Nothing seeds before the cloud has had its say.
    D().maybeSeedAfterSyncAttempt(remoteRef, function () { repaint(); });

    // And the Athenaeum's retirement, once per device, after the
    // same wait and behind its own guard. See resource-retire.js.
    if (global.RetireAthenaeum) {
      try { global.RetireAthenaeum.run(remoteRef); }
      catch (e) { try { console.error('[retire]', e); } catch (e2) {} }
    }
  }

  var RS = {
    state: state, repaint: repaint, navigate: navigate,
    openComposer: openComposer, ACTS: ACTS
  };
  global.RS = RS;

  addEventListener('hashchange', function () {
    var prevRoute = state.route, prevId = state.id;
    applyHash();
    // Remember the tab so coming back to this item opens where it
    // was left, but only when the hash actually named one.
    if (state.id && state.tab) D().setLastTab(state.type, state.id, state.tab);
    navigate(prevRoute, prevId);
  });

  document.addEventListener('DOMContentLoaded', function () {
    (global.LocalStoreIDB ? global.LocalStoreIDB.ready() : Promise.resolve()).then(boot);
  });
})(window);
