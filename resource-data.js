// =============================================================
// resource-data.js — Resource Studio's data layer.
//
// WHAT THIS IS
// The bookmarking hub that replaced The Athenaeum on 2026-09-08.
// Four things are kept here — books, videos, articles and the
// topics that connect them — and each one opens as a full page
// with an overview, notes, a description, a transcript, a Q&A and
// its topics.
//
// TWO ROWS, AND THAT IS THE ONE STRUCTURAL DECISION
// ─────────────────────────────────────────────────────────────
//   resource      -> res:    every record and index. Small.
//   resourcetext  -> rtx:    the bodies. Article HTML, transcripts,
//                            chapter text, notes. Heavy.
//
// sync.js uploads a row's ENTIRE data column on every push, so a
// library and the megabytes of prose inside it do not belong on
// one row: typing a sentence would re-push the whole shelf.
// Precedent: kdp:/kdpms:, lar:/larlog:, asc:/asclog:.
//
// THE PREFIX CHECK, CHARACTER BY CHARACTER
// sync.js matches k.indexOf(prefix) === 0. 'rtx:…' does not begin
// with 'res:' and 'res:…' does not begin with 'rtx:'. `rtx:` was
// chosen over a `restxt:` sibling for exactly this reason — a
// prefix you have to squint at is a prefix that will one day be
// wrong. See promptarium-backup.js's `prmbak:` for the same check.
//
//     A PREFIX MAY BE ADDED TO A ROW. IT MAY NEVER BE REMOVED.
//
// THE MODEL IS A WHITELIST
// makeCollection.update() re-runs a record's model on every edit,
// so a field that is not named in the model is silently dropped
// the next time the record is touched. Add new fields to the
// model, never only to a caller. This has bitten athenaeum-data.js
// and promptarium-data.js both.
//
// A HEAVY SUB-RECORD GETS ITS OWN KEY
// A parent array is re-serialised in full on every edit, so
// chapters carry an INDEX in res:chapters and their prose in
// rtx:body:chapter:<id>. Same reason ath:chapters was split out
// of ath:resources.
//
// NOTHING IS SEEDED BUT THE SCAFFOLDING
// Twelve starter topics, the landing copy and the page intros.
// The library itself is Damian's to fill — a shelf of someone
// else's book picks is a shelf you have to empty first. A starter
// library is available on demand from Settings instead.
// =============================================================

(function (global) {
  'use strict';

  // ═══ §STORAGE ══════════════════════════════════════════════

  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  // Every write announces itself. snapshots.js and save-state.js
  // listen for these; the event name follows the PREFIX, not the
  // app, because the two rows are protected separately.
  function storeSet(key, value) {
    var evt = key.indexOf('rtx:') === 0 ? 'rtx:save' : 'res:save';
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try {
        global.dispatchEvent(new CustomEvent(evt, { detail: { key: key, ok: true } }));
      } catch (e2) {}
      return true;
    } catch (e) {
      try {
        global.dispatchEvent(new CustomEvent(evt, { detail: { key: key, ok: false, error: e } }));
      } catch (e2) {}
      return false;
    }
  }

  function storeRemove(key) {
    var evt = key.indexOf('rtx:') === 0 ? 'rtx:save' : 'res:save';
    try {
      localStorage.removeItem(key);
      try {
        global.dispatchEvent(new CustomEvent(evt, { detail: { key: key, ok: true, removed: true } }));
      } catch (e2) {}
      return true;
    } catch (e) { return false; }
  }

  var KEYS = {
    // ── res: the library ─────────────────────────────────────
    books:    'res:books',
    videos:   'res:videos',
    articles: 'res:articles',
    topics:   'res:topics',
    links:    'res:links',
    qa:       'res:qa',
    chapters: 'res:chapters',
    assets:   'res:assets',
    pages:    'res:pages',
    house:    'res:house',
    settings: 'res:settings',
    uiState:  'res:uiState',
    seededAt: 'res:seededAt'
  };
  // The Athenaeum's retirement flag is deliberately NOT here. It
  // is local (`bak:ath:retired`), because the retirement has to
  // run once on every device that holds the old keys — a synced
  // flag would let the first device tell all the others they were
  // already done. See resource-retire.js.

  // ── rtx: the bodies ────────────────────────────────────────
  // One shape for all of them: rtx:<slot>:<type>:<id>.
  //   over  notes  desc   rich HTML, on any item
  //   rel                 the Topics tab's "related ideas" note
  //   body                the article, and a book chapter
  //   tr                  a video's whole transcript (plain text)
  //   tro                 the same video, organized (an array)
  var TEXT_SLOTS = { over: 1, notes: 1, desc: 1, rel: 1, body: 1, tr: 1, tro: 1 };
  var TEXT_TYPES = { book: 1, video: 1, article: 1, topic: 1, chapter: 1 };

  function textKey(slot, type, id) {
    if (!TEXT_SLOTS[slot] || !TEXT_TYPES[type] || !id) return '';
    return 'rtx:' + slot + ':' + type + ':' + id;
  }

  // ═══ §PRIMITIVES ═══════════════════════════════════════════

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }
  function str(v) { return v == null ? '' : String(v); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }
  function bool(v) { return !!v; }
  function oneOf(v, allowed, fallback) {
    var s = str(v);
    return allowed.indexOf(s) >= 0 ? s : fallback;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, num(n, lo))); }

  function stripControl(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '');
  }
  // The same three schemes the rich sanitiser allows, plus a data
  // image — a cover pasted before its upload confirms is a data
  // URL for a moment and must survive the model.
  function safeUrl(u) {
    var s = stripControl(u).trim();
    if (!s) return '';
    var low = s.toLowerCase();
    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 ||
      low.indexOf('mailto:') === 0) return s;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
    return '';
  }
  // A URL typed rather than pasted: "example.com" means https.
  function typedUrl(u) {
    var s = stripControl(u).trim();
    if (!s) return '';
    if (/^(https?:|mailto:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(s)) return 'https://' + s;
    return '';
  }

  // ═══ §COLLECTIONS ══════════════════════════════════════════
  // Copied from athenaeum-data.js, which copied it from
  // promptarium-data.js. Per-file duplication is this repo's house
  // pattern: a shared module would be one more file every page has
  // to load in the right order.

  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function get(id) {
      if (!id) return null;
      var all = list();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    }
    function add(data) {
      var r = model(data);
      var all = list();
      all.push(r);
      storeSet(key, all);
      return r;
    }
    function update(id, patch) {
      var all = list();
      var idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      var merged = Object.assign({}, all[idx], patch || {});
      merged.id = id;
      merged.updatedAt = nowISO();
      all[idx] = model(merged);
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      var all = list();
      var next = all.filter(function (r) { return r.id !== id; });
      if (next.length === all.length) return false;
      storeSet(key, next);
      return true;
    }
    function removeWhere(fn) {
      var all = list();
      var next = all.filter(function (r) { return !fn(r); });
      if (next.length === all.length) return 0;
      storeSet(key, next);
      return all.length - next.length;
    }
    function replaceAll(records) {
      storeSet(key, Array.isArray(records) ? records.map(model) : []);
    }
    return {
      key: key, list: list, get: get, add: add, update: update,
      remove: remove, removeWhere: removeWhere, replaceAll: replaceAll
    };
  }

  function readRecord(key, fallback) {
    var v = storeGet(key, null);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : (fallback || {});
  }
  function patchRecord(key, patch) {
    var next = Object.assign({}, readRecord(key), patch || {});
    storeSet(key, next);
    return next;
  }

  // ═══ §MODELS ═══════════════════════════════════════════════

  var BOOK_STATUS = ['reading', 'read', 'want', 'shelved'];
  var FORMATS = ['Kindle', 'Paperback', 'Hardcover', 'Audiobook', 'PDF', 'Epub'];

  // The reference video's card carries exactly these: a cover, a
  // title, format pills, a note, a status line that is either
  // "Currently reading" or "Read: <date>", and one link out.
  function bookModel(d) {
    d = d || {};
    return {
      id: d.id || uid('bk'),
      title: str(d.title),
      author: str(d.author),
      cover: safeUrl(d.cover),
      url: safeUrl(d.url),
      formats: arr(d.formats).filter(function (f) { return FORMATS.indexOf(f) >= 0; }),
      status: oneOf(d.status, BOOK_STATUS, 'want'),
      note: str(d.note),
      rating: clamp(d.rating, 0, 5),
      readAt: str(d.readAt),          // YYYY-MM-DD
      startedAt: str(d.startedAt),
      pages: num(d.pages, 0),
      publisher: str(d.publisher),
      year: str(d.year),
      isbn: str(d.isbn),
      featured: bool(d.featured),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var VIDEO_STATUS = ['queued', 'watching', 'watched'];

  function videoModel(d) {
    d = d || {};
    var url = safeUrl(d.url);
    var vid = str(d.videoId) || youtubeId(url);
    return {
      id: d.id || uid('vd'),
      title: str(d.title),
      channel: str(d.channel),
      url: url,
      videoId: vid,
      cover: safeUrl(d.cover),        // an upload always beats the auto thumbnail
      duration: str(d.duration),      // "12:04" — as written, never parsed
      views: str(d.views),
      publishedAt: str(d.publishedAt),
      status: oneOf(d.status, VIDEO_STATUS, 'queued'),
      note: str(d.note),
      rating: clamp(d.rating, 0, 5),
      featured: bool(d.featured),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var ARTICLE_STATUS = ['unread', 'reading', 'read'];

  function articleModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ar'),
      title: str(d.title),
      deck: str(d.deck),
      author: str(d.author),
      source: str(d.source),          // the publication
      url: safeUrl(d.url),
      cover: safeUrl(d.cover),
      label: str(d.label),            // the small caps line above the headline
      minutes: num(d.minutes, 0),     // derived from the body
      excerpt: str(d.excerpt),        // derived from the body
      status: oneOf(d.status, ARTICLE_STATUS, 'unread'),
      saved: bool(d.saved),
      note: str(d.note),
      rating: clamp(d.rating, 0, 5),
      publishedAt: str(d.publishedAt),
      featured: bool(d.featured),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var TOPIC_KINDS = ['topic', 'idea', 'theme', 'question'];

  function topicModel(d) {
    d = d || {};
    return {
      id: d.id || uid('tp'),
      name: str(d.name),
      kind: oneOf(d.kind, TOPIC_KINDS, 'topic'),
      tint: str(d.tint),              // a hex the collection card washes itself with
      blurb: str(d.blurb),
      pinned: bool(d.pinned),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var ITEM_TYPES = ['book', 'video', 'article'];

  function linkModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ln'),
      topicId: str(d.topicId),
      itemType: oneOf(d.itemType, ITEM_TYPES, 'book'),
      itemId: str(d.itemId),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  function qaModel(d) {
    d = d || {};
    return {
      id: d.id || uid('qa'),
      itemType: oneOf(d.itemType, ITEM_TYPES, 'book'),
      itemId: str(d.itemId),
      q: str(d.q),
      a: str(d.a),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  function chapterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ch'),
      bookId: str(d.bookId),
      title: str(d.title),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var ASSET_KINDS = ['image', 'video', 'link', 'file'];

  // What came WITH a pasted article. The sanitiser drops an
  // <iframe> and a <video> outright — they are the two tags a
  // stored string must never be allowed to reintroduce — so their
  // URLs are lifted out to here and the body keeps a
  // <figure data-rs-embed="<id>"> placeholder where they stood.
  function assetModel(d) {
    d = d || {};
    return {
      id: d.id || uid('as'),
      itemType: oneOf(d.itemType, ITEM_TYPES, 'article'),
      itemId: str(d.itemId),
      kind: oneOf(d.kind, ASSET_KINDS, 'link'),
      url: safeUrl(d.url),
      title: str(d.title),
      caption: str(d.caption),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  var Books    = makeCollection(KEYS.books, bookModel);
  var Videos   = makeCollection(KEYS.videos, videoModel);
  var Articles = makeCollection(KEYS.articles, articleModel);
  var Topics   = makeCollection(KEYS.topics, topicModel);
  var Links    = makeCollection(KEYS.links, linkModel);
  var QA       = makeCollection(KEYS.qa, qaModel);
  var Chapters = makeCollection(KEYS.chapters, chapterModel);
  var Assets   = makeCollection(KEYS.assets, assetModel);

  // ═══ §THE TEXT STORE ═══════════════════════════════════════
  // Rich HTML and transcripts. Read on demand, written on commit,
  // and never carried on a record — the whole point of the second
  // row is that opening a shelf does not parse a book.

  function getText(slot, type, id) {
    var k = textKey(slot, type, id);
    if (!k) return '';
    var v = storeGet(k, null);
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return typeof v.html === 'string' ? v.html : '';
  }
  function setText(slot, type, id, html) {
    var k = textKey(slot, type, id);
    if (!k) return false;
    var s = String(html == null ? '' : html);
    // An empty body is a REMOVED key, not an empty one. A stored
    // '' is indistinguishable from content at a glance, syncs
    // forever and counts against the row.
    if (!s.trim()) return storeRemove(k);
    return storeSet(k, { html: s, at: nowISO() });
  }
  function getRows(slot, type, id) {
    var k = textKey(slot, type, id);
    if (!k) return [];
    var v = storeGet(k, null);
    return Array.isArray(v) ? v : (v && Array.isArray(v.rows) ? v.rows : []);
  }
  function setRows(slot, type, id, rows) {
    var k = textKey(slot, type, id);
    if (!k) return false;
    if (!Array.isArray(rows) || !rows.length) return storeRemove(k);
    return storeSet(k, rows);
  }
  // Every body an item owns, so deleting the item can take them
  // all. A body left behind is invisible, syncs for ever, and is
  // the one leak this shape can produce.
  function clearText(type, id) {
    Object.keys(TEXT_SLOTS).forEach(function (slot) {
      var k = textKey(slot, type, id);
      if (k) storeRemove(k);
    });
  }

  // ═══ §QUERIES ══════════════════════════════════════════════

  function byNewest(a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  }
  function byOrder(a, b) { return num(a.order, 0) - num(b.order, 0); }
  function nextOrder(records) {
    return records.reduce(function (m, r) { return Math.max(m, num(r.order, 0)); }, 0) + 1;
  }

  function collectionFor(type) {
    return type === 'book' ? Books : type === 'video' ? Videos :
      type === 'article' ? Articles : null;
  }
  function itemOf(type, id) {
    var c = collectionFor(type);
    return c ? c.get(id) : null;
  }

  function chaptersFor(bookId) {
    return Chapters.list().filter(function (c) { return c.bookId === bookId; }).sort(byOrder);
  }
  function qaFor(type, id) {
    return QA.list().filter(function (r) {
      return r.itemType === type && r.itemId === id;
    }).sort(byOrder);
  }
  function assetsFor(type, id) {
    return Assets.list().filter(function (r) {
      return r.itemType === type && r.itemId === id;
    });
  }
  function assetById(id) { return Assets.get(id); }

  function topicsFor(type, id) {
    var ids = {};
    Links.list().forEach(function (l) {
      if (l.itemType === type && l.itemId === id) ids[l.topicId] = 1;
    });
    return Topics.list().filter(function (t) { return ids[t.id]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  // The back-link, and the reason a topic is a record rather than
  // a string on each item: this question has one answer and it is
  // cheap.
  function itemsForTopic(topicId) {
    var out = { book: [], video: [], article: [] };
    Links.list().forEach(function (l) {
      if (l.topicId !== topicId) return;
      var it = itemOf(l.itemType, l.itemId);
      if (it && out[l.itemType]) out[l.itemType].push(it);
    });
    return out;
  }
  function topicCount(topicId) {
    var n = 0;
    Links.list().forEach(function (l) {
      if (l.topicId === topicId && itemOf(l.itemType, l.itemId)) n++;
    });
    return n;
  }
  function linkTopic(topicId, type, id) {
    var existing = Links.list().filter(function (l) {
      return l.topicId === topicId && l.itemType === type && l.itemId === id;
    })[0];
    if (existing) return existing;
    return Links.add({ topicId: topicId, itemType: type, itemId: id });
  }
  function unlinkTopic(topicId, type, id) {
    return Links.removeWhere(function (l) {
      return l.topicId === topicId && l.itemType === type && l.itemId === id;
    });
  }
  // Link by NAME, creating the topic if this is the first time it
  // has been used. The picker types a name; the database is the
  // side effect.
  function linkTopicNamed(name, type, id) {
    var clean = str(name).trim();
    if (!clean) return null;
    var found = Topics.list().filter(function (t) {
      return t.name.toLowerCase() === clean.toLowerCase();
    })[0];
    if (!found) found = Topics.add({ name: clean });
    linkTopic(found.id, type, id);
    return found;
  }

  // Sources are DERIVED, never stored. An author is a string on
  // the records that name them, so a stored source list would be a
  // second copy that drifts the first time a typo is corrected.
  function sources() {
    var map = {};
    function push(name, kind) {
      var n = str(name).trim();
      if (!n) return;
      var k = kind + '|' + n.toLowerCase();
      if (!map[k]) map[k] = { name: n, kind: kind, n: 0 };
      map[k].n++;
    }
    Articles.list().forEach(function (a) { push(a.author, 'author'); push(a.source, 'publication'); });
    Books.list().forEach(function (b) { push(b.author, 'author'); });
    Videos.list().forEach(function (v) { push(v.channel, 'channel'); });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
  }

  // ═══ §DELETES, AND WHAT THEY TAKE WITH THEM ════════════════
  // Explicit and cascading. A record whose bodies, links, Q&A and
  // assets outlive it is four kinds of invisible weight on a row
  // that is pushed whole.

  function removeItem(type, id) {
    var c = collectionFor(type);
    if (!c || !c.get(id)) return false;
    if (type === 'book') {
      chaptersFor(id).forEach(function (ch) {
        clearText('chapter', ch.id);
        Chapters.remove(ch.id);
      });
    }
    QA.removeWhere(function (r) { return r.itemType === type && r.itemId === id; });
    Links.removeWhere(function (l) { return l.itemType === type && l.itemId === id; });
    Assets.removeWhere(function (a) { return a.itemType === type && a.itemId === id; });
    clearText(type, id);
    return c.remove(id);
  }

  // A topic is permanent scaffolding, so deleting one drops its
  // LINKS and its notes and nothing else. Nothing knowledge-bearing
  // is ever removed because a label was.
  function removeTopic(topicId) {
    if (!Topics.get(topicId)) return false;
    Links.removeWhere(function (l) { return l.topicId === topicId; });
    clearText('topic', topicId);
    return Topics.remove(topicId);
  }

  function removeChapter(chapterId) {
    if (!Chapters.get(chapterId)) return false;
    clearText('chapter', chapterId);
    return Chapters.remove(chapterId);
  }

  function reorderChapters(bookId, orderedIds) {
    orderedIds.forEach(function (id, i) {
      var ch = Chapters.get(id);
      if (ch && ch.bookId === bookId) Chapters.update(id, { order: i + 1 });
    });
  }
  function reorderQA(type, id, orderedIds) {
    orderedIds.forEach(function (qid, i) {
      var r = QA.get(qid);
      if (r && r.itemType === type && r.itemId === id) QA.update(qid, { order: i + 1 });
    });
  }

  // ═══ §SINGLETONS ═══════════════════════════════════════════

  // The landing page's own words, editable in place. They are data
  // because they are the one piece of copy on the site that is
  // about Damian rather than about a record.
  var HOUSE_DEFAULT = {
    // The break is STORED, not left to the wrap. It is two lines in
    // the reference and where it falls is part of the composition —
    // a headline that re-breaks at every viewport width is a
    // different headline at every viewport width.
    headline: 'Knowledge\nlives here',
    sub: 'Curated resources. Deeper understanding.\nA more intentional you.',
    cta: 'Explore the hub',
    credo: 'A quieter mind builds a richer life.'
  };
  function getHouse() { return Object.assign({}, HOUSE_DEFAULT, readRecord(KEYS.house)); }
  function setHouse(patch) { return patchRecord(KEYS.house, patch); }

  var PAGES_DEFAULT = {
    books: 'Everything worth re-reading, and the reason it was worth it the first time. ' +
      'What is on the shelf, what is open now, and the note that made it stay.',
    videos: 'Talks, lectures and long explanations — kept with their transcripts, ' +
      'so a thing said once at 40 minutes can be found again in ten seconds.',
    articles: 'Essays, papers and posts, saved whole. The writing is here, ' +
      'not a link to where it used to be.',
    collections: 'The ideas that keep turning up. Every topic gathers what taught it.',
    about: 'One place for what you are learning from.'
  };
  function getPages() { return Object.assign({}, PAGES_DEFAULT, readRecord(KEYS.pages)); }
  function setPages(patch) { return patchRecord(KEYS.pages, patch); }

  function getUiState() { return readRecord(KEYS.uiState); }
  function setUiState(patch) { return patchRecord(KEYS.uiState, patch); }
  function getSettings() { return readRecord(KEYS.settings); }
  function setSettings(patch) { return patchRecord(KEYS.settings, patch); }

  // Which tab an item was last left on. Per item, so returning to
  // a book you were taking notes in opens on the notes.
  function lastTab(type, id) {
    var m = getUiState().tabs || {};
    return str(m[type + ':' + id]);
  }
  function setLastTab(type, id, tab) {
    var m = Object.assign({}, getUiState().tabs || {});
    m[type + ':' + id] = tab;
    setUiState({ tabs: m });
  }

  // ═══ §FORMATTERS ═══════════════════════════════════════════

  // Eleven URL shapes reach this: watch, youtu.be, shorts, embed,
  // live, and each of them with or without a playlist hanging off
  // the end.
  function youtubeId(url) {
    var s = str(url);
    if (!s) return '';
    var m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function youtubeThumb(videoId, big) {
    if (!videoId) return '';
    return 'https://i.ytimg.com/vi/' + videoId + '/' + (big ? 'maxresdefault' : 'hqdefault') + '.jpg';
  }
  // The cover a video card actually draws: an upload always wins,
  // and the auto thumbnail is the fallback rather than a stored
  // field — a stored one would go stale the day a channel changes
  // its art.
  function videoCover(v, big) {
    return (v && v.cover) || youtubeThumb(v && v.videoId, big);
  }
  function bookCover(b) {
    if (b && b.cover) return b.cover;
    if (b && b.isbn) {
      var isbn = String(b.isbn).replace(/[^0-9Xx]/g, '');
      if (isbn.length === 10 || isbn.length === 13) {
        return 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg';
      }
    }
    return '';
  }

  function domainOf(url) {
    var s = str(url);
    var m = s.match(/^https?:\/\/([^/?#]+)/i);
    if (!m) return '';
    return m[1].replace(/^www\./i, '');
  }
  // What the outbound button on a book card says. The reference
  // reads "Amazon India"; the honest general answer is the domain,
  // title-cased for the few that everyone knows by name.
  var SITE_NAMES = {
    'amazon.com': 'Amazon', 'amazon.co.uk': 'Amazon', 'amazon.in': 'Amazon',
    'amazon.ca': 'Amazon', 'amazon.de': 'Amazon',
    'goodreads.com': 'Goodreads', 'openlibrary.org': 'Open Library',
    'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
    'arxiv.org': 'arXiv', 'jstor.org': 'JSTOR', 'medium.com': 'Medium',
    'substack.com': 'Substack', 'wikipedia.org': 'Wikipedia'
  };
  function siteName(url) {
    var d = domainOf(url);
    if (!d) return '';
    if (SITE_NAMES[d]) return SITE_NAMES[d];
    var parts = d.split('.');
    if (parts.length > 2) {
      var tail = parts.slice(-2).join('.');
      if (SITE_NAMES[tail]) return SITE_NAMES[tail];
    }
    return d;
  }

  // "March 3, 2020" — the reference's own format, and the one a
  // reading date wants: the month spelled out, because a date on a
  // book is read once and never sorted by eye.
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var s = str(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
  }
  function shortDate(iso) {
    var s = str(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    return MONTHS[Number(p[1]) - 1].slice(0, 3) + ' ' + Number(p[2]) + ', ' + p[0];
  }
  function todayISO() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }
  // "3 days ago" for the feed's by-line. Coarse on purpose: an
  // exact minute on something you saved last spring is noise.
  function ago(iso) {
    var t = Date.parse(str(iso));
    if (!isFinite(t)) return '';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 90) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? 'an hour ago' : h + ' hours ago';
    var d = Math.round(h / 24);
    if (d < 7) return d === 1 ? 'yesterday' : d + ' days ago';
    var w = Math.round(d / 7);
    if (w < 5) return w === 1 ? 'a week ago' : w + ' weeks ago';
    var mo = Math.round(d / 30);
    if (mo < 12) return mo === 1 ? 'a month ago' : mo + ' months ago';
    var y = Math.round(d / 365);
    return y === 1 ? 'a year ago' : y + ' years ago';
  }

  // ═══ §THE NUMBERS ══════════════════════════════════════════

  function counts() {
    var books = Books.list(), videos = Videos.list(), articles = Articles.list();
    return {
      books: books.length,
      videos: videos.length,
      articles: articles.length,
      topics: Topics.list().length,
      qa: QA.list().length,
      chapters: Chapters.list().length,
      reading: books.filter(function (b) { return b.status === 'reading'; }).length,
      read: books.filter(function (b) { return b.status === 'read'; }).length,
      watched: videos.filter(function (v) { return v.status === 'watched'; }).length,
      unread: articles.filter(function (a) { return a.status === 'unread'; }).length,
      minutes: articles.reduce(function (n, a) { return n + num(a.minutes, 0); }, 0)
    };
  }

  // Everything, newest first — the home page's "recently added"
  // band and the search both read this.
  function everything() {
    var out = [];
    Books.list().forEach(function (b) { out.push({ type: 'book', rec: b }); });
    Videos.list().forEach(function (v) { out.push({ type: 'video', rec: v }); });
    Articles.list().forEach(function (a) { out.push({ type: 'article', rec: a }); });
    return out.sort(function (x, y) { return byNewest(x.rec, y.rec); });
  }

  function coverOf(type, rec) {
    if (type === 'video') return videoCover(rec);
    if (type === 'book') return bookCover(rec);
    return rec ? rec.cover : '';
  }
  function subtitleOf(type, rec) {
    if (!rec) return '';
    if (type === 'video') return rec.channel;
    if (type === 'book') return rec.author;
    return rec.author || rec.source;
  }
  function hrefOf(type, id) { return '#/' + type + '/' + encodeURIComponent(id); }

  function search(q) {
    var needle = str(q).trim().toLowerCase();
    if (!needle) return [];
    var hits = everything().filter(function (e) {
      var r = e.rec;
      return (r.title + ' ' + subtitleOf(e.type, r) + ' ' + (r.note || '') + ' ' + (r.excerpt || ''))
        .toLowerCase().indexOf(needle) >= 0;
    });
    Topics.list().forEach(function (t) {
      if ((t.name + ' ' + t.blurb).toLowerCase().indexOf(needle) >= 0) {
        hits.push({ type: 'topic', rec: t });
      }
    });
    return hits.slice(0, 40);
  }

  // ═══ §SEED ═════════════════════════════════════════════════
  // THE SCAFFOLDING ONLY. Twelve topics and the page copy — a
  // taxonomy is something you edit, a reading list is something
  // you would have to empty. The starter library below is opt-in
  // from Settings and is the honest place for someone else's
  // book picks.

  var SEED_TOPICS = [
    { name: 'Attention',     kind: 'theme',    tint: '#c79a52', blurb: 'What it costs to look at something for a long time.' },
    { name: 'Habit',         kind: 'theme',    tint: '#a8834a', blurb: 'The part of a life that runs without being decided.' },
    { name: 'Craft',         kind: 'theme',    tint: '#b98f57', blurb: 'Getting good at a thing slowly and on purpose.' },
    { name: 'Stoicism',      kind: 'topic',    tint: '#8f7a52', blurb: 'What is up to you, and what is not.' },
    { name: 'Learning',      kind: 'topic',    tint: '#c0964f', blurb: 'How understanding is actually built.' },
    { name: 'Note-taking',   kind: 'topic',    tint: '#9c8352', blurb: 'Writing things down so they can be found later.' },
    { name: 'Systems',       kind: 'topic',    tint: '#b08a4e', blurb: 'Structures that make the right thing the easy thing.' },
    { name: 'Health',        kind: 'topic',    tint: '#a3894f', blurb: 'The body as the thing everything else runs on.' },
    { name: 'Money',         kind: 'topic',    tint: '#bb9450', blurb: 'Enough, and what it is for.' },
    { name: 'Creativity',    kind: 'theme',    tint: '#c79a52', blurb: 'Where the new things come from.' },
    { name: 'What is worth wanting?', kind: 'question', tint: '#8a7248', blurb: 'The question under most of the others.' },
    { name: 'Slow is fast',  kind: 'idea',     tint: '#9a7f4c', blurb: 'The pace that finishes things.' }
  ];

  function seedNow() {
    if (storeGet(KEYS.seededAt, null)) return 0;
    var n = 0;
    if (!Topics.list().length) {
      SEED_TOPICS.forEach(function (t) { Topics.add(t); n++; });
    }
    storeSet(KEYS.seededAt, nowISO());
    return n;
  }

  // NOTHING SEEDS BEFORE THE CLOUD HAS HAD ITS SAY. A fresh device
  // that seeded first would push starter topics over a full
  // account. `ref.applied` is set by initCloudSync's onApplied;
  // the 1200ms fallback covers a pull that never answers.
  function maybeSeedAfterSyncAttempt(ref, onDone) {
    var run = function () {
      var n = seedNow();
      if (n && typeof onDone === 'function') onDone(n);
    };
    if (ref && ref.applied) { run(); return; }
    setTimeout(run, 1200);
  }

  // ── the starter library, on request ────────────────────────
  // Real books, real ISBNs. Covers come from Open Library, which
  // is built to be hotlinked; an ISBN that misses simply falls
  // back to the drawn mark, which is a designed state rather than
  // a broken one.
  var STARTER_BOOKS = [
    { title: 'Deep Work', author: 'Cal Newport', isbn: '9781455586691', status: 'read',
      formats: ['Kindle'], readAt: '2024-03-14', topics: ['Attention', 'Craft'],
      note: 'The argument that concentration is a skill you lose by not using it. The rules are less useful than the diagnosis.' },
    { title: 'Atomic Habits', author: 'James Clear', isbn: '9780735211292', status: 'read',
      formats: ['Paperback', 'Audiobook'], readAt: '2023-11-02', topics: ['Habit', 'Systems'],
      note: 'Systems over goals. Worth it for the identity chapter alone — you do not have a habit, you become the person who has it.' },
    { title: 'Meditations', author: 'Marcus Aurelius', isbn: '9780140449334', status: 'reading',
      formats: ['Paperback'], startedAt: '2026-08-01', topics: ['Stoicism', 'What is worth wanting?'],
      note: 'Not a book to finish. A page at a time, in the morning, for the rest of your life.' },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', isbn: '9780374533557', status: 'read',
      formats: ['Kindle'], readAt: '2022-06-19', topics: ['Learning'],
      note: 'Long, and the length is the point — you cannot be talked out of a bias in one chapter.' },
    { title: 'How to Take Smart Notes', author: 'Sonke Ahrens', isbn: '9783982438801', status: 'read',
      formats: ['Paperback'], readAt: '2025-01-27', topics: ['Note-taking', 'Learning'],
      note: 'The reason this hub exists. Notes are not storage; they are the thinking.' },
    { title: 'Four Thousand Weeks', author: 'Oliver Burkeman', isbn: '9780374159122', status: 'reading',
      formats: ['Kindle'], startedAt: '2026-09-01', topics: ['What is worth wanting?', 'Slow is fast'],
      note: 'Time management for mortals. The premise is that you will not get to everything, and that this is a relief.' },
    { title: 'Range', author: 'David Epstein', isbn: '9780735214484', status: 'want',
      formats: ['Paperback'], topics: ['Learning', 'Craft'],
      note: 'The case against early specialisation. On the shelf because two people whose taste I trust said the same thing about it.' },
    { title: 'The Beginning of Infinity', author: 'David Deutsch', isbn: '9780143121350', status: 'want',
      formats: ['Hardcover'], topics: ['Learning', 'Creativity'],
      note: 'Explanations as the thing that actually moves. Slow going, apparently, and worth it.' }
  ];

  function loadStarterLibrary() {
    var added = 0;
    STARTER_BOOKS.forEach(function (s) {
      var dupe = Books.list().filter(function (b) {
        return b.title.toLowerCase() === s.title.toLowerCase();
      })[0];
      if (dupe) return;
      var rec = Books.add({
        title: s.title, author: s.author, isbn: s.isbn, status: s.status,
        formats: s.formats, readAt: s.readAt || '', startedAt: s.startedAt || '',
        note: s.note,
        url: 'https://openlibrary.org/isbn/' + s.isbn
      });
      (s.topics || []).forEach(function (name) { linkTopicNamed(name, 'book', rec.id); });
      added++;
    });
    return added;
  }

  // ═══ §EXPORT ═══════════════════════════════════════════════

  global.Resource = {
    KEYS: KEYS, textKey: textKey,
    uid: uid, nowISO: nowISO, todayISO: todayISO,
    safeUrl: safeUrl, typedUrl: typedUrl,

    Books: Books, Videos: Videos, Articles: Articles, Topics: Topics,
    Links: Links, QA: QA, Chapters: Chapters, Assets: Assets,

    FORMATS: FORMATS, BOOK_STATUS: BOOK_STATUS, VIDEO_STATUS: VIDEO_STATUS,
    ARTICLE_STATUS: ARTICLE_STATUS, TOPIC_KINDS: TOPIC_KINDS, ITEM_TYPES: ITEM_TYPES,

    getText: getText, setText: setText, getRows: getRows, setRows: setRows,
    clearText: clearText,

    collectionFor: collectionFor, itemOf: itemOf,
    chaptersFor: chaptersFor, qaFor: qaFor, assetsFor: assetsFor, assetById: assetById,
    topicsFor: topicsFor, itemsForTopic: itemsForTopic, topicCount: topicCount,
    linkTopic: linkTopic, unlinkTopic: unlinkTopic, linkTopicNamed: linkTopicNamed,
    sources: sources,

    removeItem: removeItem, removeTopic: removeTopic, removeChapter: removeChapter,
    reorderChapters: reorderChapters, reorderQA: reorderQA, nextOrder: nextOrder,

    getHouse: getHouse, setHouse: setHouse,
    getPages: getPages, setPages: setPages,
    getUiState: getUiState, setUiState: setUiState,
    getSettings: getSettings, setSettings: setSettings,
    lastTab: lastTab, setLastTab: setLastTab,

    youtubeId: youtubeId, youtubeThumb: youtubeThumb,
    videoCover: videoCover, bookCover: bookCover, coverOf: coverOf,
    subtitleOf: subtitleOf, hrefOf: hrefOf,
    domainOf: domainOf, siteName: siteName,
    longDate: longDate, shortDate: shortDate, ago: ago,

    counts: counts, everything: everything, search: search,
    byNewest: byNewest, byOrder: byOrder,

    seedNow: seedNow, maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt,
    loadStarterLibrary: loadStarterLibrary
  };
})(window);
