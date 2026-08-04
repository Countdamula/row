// entertainment-reading-data.js
//
// Data layer for entertainment-dash.html's Reading Corner — pulled out
// of the generic REGISTRY/dispatch system in entertainment-dash-data.js
// (see that file's own PAGE_ORDER, which no longer lists 'reading') into
// its own genuinely separate, richer set of databases, built to match
// the shape of a typical "Ultimate Reading Tracker" Notion template
// (library + TBR + series + authors + quotes + reading goals + a habit/
// streak log), per an explicit request. Games stays exactly where it was
// for now — this file only covers Reading; a future session will give
// Games the same treatment.
//
// Seven genuinely separate flat collections, all under one new
// `entread:` prefix (added to entertainment-dash.html's own
// initCloudSync syncedPrefixes list — no new sync call, same appKey
// 'entdash', same precedent index.html's own 'goals' row already uses
// for stacking multiple prefixes under one call):
//   entread:books    — the Library (every book, every status)
//   entread:authors  — a small Authors database, linked via Book.authorId
//   entread:series   — a small Series database, linked via Book.seriesId
//   entread:quotes   — a Quote Library, linked via Quote.bookId
//   entread:log      — a daily reading-habit log (pages/minutes per day),
//                       powers the streak + heatmap on the Overview page
//   entread:goals    — one record per year (target books/pages)
//   entread:journal  — generated-on-demand note sections per book, the
//                       same "+ Generate Section" pattern this app's own
//                       business.html Platform Detail pages / system.html
//                       Page Notes already established
//
// Deleting an Author/Series nulls the reference on any Book that pointed
// at it rather than deleting the book — same null-out-the-reference
// precedent aitech-data.js's model deletion / household-data.js's legion
// deletion already established. Deleting a Book cascades a real delete on
// its own Quotes and Journal sections (meaningless without their book)
// and nulls the reference on any log entry that pointed at it.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('entread:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('entread:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function clampInt(v, min, max) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  // ============================================================
  // LINK PREVIEW — real book metadata from a pasted Goodreads/Amazon/
  // Audible link, via Open Library's public, keyless JSON API
  // (openlibrary.org/dev/docs/api/books) — the same "real public
  // endpoint, no backend/API key" precedent entertainment-hub-data.js's
  // own fetchPreview() already established for YouTube/Spotify, just a
  // genuinely different lookup shape since none of Goodreads/Amazon/
  // Audible expose oEmbed. Two strategies, tried in order:
  //  1. Look for an ISBN sitting directly in the URL (very common —
  //     Amazon's own ASIN for a print book is usually its ISBN-10) and
  //     do a precise ISBN lookup.
  //  2. Otherwise guess a search title from the URL's own slug
  //     (Goodreads' "/book/show/<id>.<Title_With_Underscores>", Amazon's
  //     "/<Title-With-Dashes>/dp/<asin>", Audible's "/pd/<slug>/<asin>")
  //     and search Open Library's title index for the closest match.
  // Both are best-effort, not guaranteed accurate — the caller shows a
  // small status line either way (found vs. not), since a URL-slug
  // guess is inherently fuzzier than YouTube/Spotify's own oEmbed
  // lookup and staying silent on a miss is what made the first version
  // of this feature look "broken" instead of "found nothing here."
  // Falls back to the existing YouTube/Spotify oEmbed helper last (an
  // audiobook sample or author interview pasted as the Link field).
  // ============================================================
  function extractIsbnFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').concat([u.search || '']);
      for (let i = 0; i < parts.length; i++) {
        const m = /(?:^|[^0-9A-Za-z])(97[89]\d{10}|\d{9}[\dXx])(?:[^0-9A-Za-z]|$)/.exec(parts[i]);
        if (m) return m[1].toUpperCase();
      }
    } catch (e) {}
    return null;
  }
  function guessBookQueryFromUrl(url) {
    function humanize(slug) {
      return (slug || '').replace(/\.(html?|php)$/i, '').replace(/[_\-]+/g, ' ').trim();
    }
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const segs = u.pathname.split('/').filter(Boolean);
      if (host.indexOf('goodreads.com') !== -1) {
        const showIdx = segs.indexOf('show');
        let raw = (showIdx !== -1 && segs[showIdx + 1]) ? segs[showIdx + 1] : segs[segs.length - 1];
        raw = (raw || '').replace(/^\d+[.\-]?/, '');
        return humanize(raw);
      }
      if (host.indexOf('amazon.') !== -1) {
        const dpIdx = segs.indexOf('dp');
        if (dpIdx > 0) return humanize(segs[dpIdx - 1]);
        const prodIdx = segs.indexOf('product');
        if (prodIdx > 0) return humanize(segs[prodIdx - 1]);
      }
      if (host.indexOf('audible.com') !== -1) {
        const pdIdx = segs.indexOf('pd');
        if (pdIdx !== -1 && segs[pdIdx + 1]) return humanize(segs[pdIdx + 1]);
      }
    } catch (e) {}
    return '';
  }
  async function fetchBookPreview(url) {
    const result = { title: '', creator: '', cover: '', found: false };
    if (!url) return result;
    const isbn = extractIsbnFromUrl(url);
    if (isbn) {
      try {
        const res = await fetch('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data');
        if (res.ok) {
          const data = await res.json();
          const rec = data['ISBN:' + isbn];
          if (rec) {
            result.found = true;
            if (rec.title) result.title = rec.title;
            if (rec.authors && rec.authors[0] && rec.authors[0].name) result.creator = rec.authors[0].name;
            if (rec.cover) result.cover = rec.cover.large || rec.cover.medium || rec.cover.small || '';
            return result;
          }
        }
      } catch (e) {}
    }
    const guess = guessBookQueryFromUrl(url);
    if (guess) {
      try {
        const res2 = await fetch('https://openlibrary.org/search.json?title=' + encodeURIComponent(guess) + '&limit=1&fields=title,author_name,cover_i');
        if (res2.ok) {
          const data2 = await res2.json();
          const doc = data2.docs && data2.docs[0];
          if (doc) {
            result.found = true;
            if (doc.title) result.title = doc.title;
            if (doc.author_name && doc.author_name[0]) result.creator = doc.author_name[0];
            if (doc.cover_i) result.cover = 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg';
            return result;
          }
        }
      } catch (e) {}
    }
    if (global.EntHub && typeof global.EntHub.fetchPreview === 'function') {
      try {
        const eh = await global.EntHub.fetchPreview(url);
        if (eh && (eh.title || eh.cover || eh.creator)) {
          result.found = true;
          result.title = eh.title || '';
          result.creator = eh.creator || '';
          result.cover = eh.cover || '';
        }
      } catch (e) {}
    }
    return result;
  }

  // ============================================================
  // CONFIG
  // ============================================================
  const FORMATS = ['Physical', 'E-Book', 'Audiobook'];
  const STATUS_KEYS = ['tbr', 'reading', 'read', 'dnf'];
  const STATUS_LABELS = { tbr: 'To Be Read', reading: 'Currently Reading', read: 'Read', dnf: 'Did Not Finish' };
  const SOURCES = ['Owned', 'Library', 'Borrowed', 'Kindle Unlimited', 'Audible', 'Gifted', 'Other'];
  const SUGGESTED_GENRES = ['Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Romance', 'Mystery / Thriller', 'Horror', 'Spicy', 'Historical Fiction', 'Biography', 'Self-Help', 'Business', 'Young Adult', 'Classics', 'Poetry', 'Other'];

  // ============================================================
  // MODELS
  // ============================================================
  function bookModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    const genres = Array.isArray(data.genres) ? data.genres.filter(function (g) { return typeof g === 'string' && g; }) : [];
    return {
      id: data.id || uid('bk'),
      title: typeof data.title === 'string' ? data.title : '',
      authorId: typeof data.authorId === 'string' ? data.authorId : null,
      seriesId: typeof data.seriesId === 'string' ? data.seriesId : null,
      seriesIndex: (typeof data.seriesIndex === 'number' && data.seriesIndex > 0) ? data.seriesIndex : null,
      genres: genres,
      format: FORMATS.indexOf(data.format) !== -1 ? data.format : 'Physical',
      status: STATUS_KEYS.indexOf(data.status) !== -1 ? data.status : 'tbr',
      rating: clampInt(data.rating || 0, 0, 5),
      pageCount: (typeof data.pageCount === 'number' && data.pageCount > 0) ? data.pageCount : null,
      currentPage: (typeof data.currentPage === 'number' && data.currentPage >= 0) ? data.currentPage : null,
      dateStarted: typeof data.dateStarted === 'string' ? data.dateStarted : '',
      dateFinished: typeof data.dateFinished === 'string' ? data.dateFinished : '',
      source: typeof data.source === 'string' ? data.source : '',
      isReread: !!data.isReread,
      favorite: !!data.favorite,
      cover: typeof data.cover === 'string' ? data.cover : '',
      url: typeof data.url === 'string' ? data.url : '',
      review: typeof data.review === 'string' ? data.review : '',
      order: typeof data.order === 'number' ? data.order : 0,
      tbrPriority: typeof data.tbrPriority === 'number' ? data.tbrPriority : 0,
      legacyId: typeof data.legacyId === 'string' ? data.legacyId : '',
      createdAt: createdAt,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt
    };
  }
  function authorModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('au'),
      name: typeof data.name === 'string' ? data.name : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt
    };
  }
  function seriesModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('sr'),
      name: typeof data.name === 'string' ? data.name : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      cover: typeof data.cover === 'string' ? data.cover : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt
    };
  }
  function quoteModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('qt'),
      bookId: typeof data.bookId === 'string' ? data.bookId : null,
      text: typeof data.text === 'string' ? data.text : '',
      pageNumber: (typeof data.pageNumber === 'number' && data.pageNumber > 0) ? data.pageNumber : null,
      tag: typeof data.tag === 'string' ? data.tag : '',
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt
    };
  }
  function logModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('lg'),
      date: typeof data.date === 'string' && data.date ? data.date : todayISO(),
      bookId: typeof data.bookId === 'string' ? data.bookId : null,
      pagesRead: (typeof data.pagesRead === 'number' && data.pagesRead > 0) ? data.pagesRead : 0,
      minutesRead: (typeof data.minutesRead === 'number' && data.minutesRead > 0) ? data.minutesRead : 0,
      note: typeof data.note === 'string' ? data.note : '',
      createdAt: createdAt
    };
  }
  function goalModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('gl'),
      year: (typeof data.year === 'number' && data.year > 1900) ? data.year : new Date().getFullYear(),
      targetBooks: (typeof data.targetBooks === 'number' && data.targetBooks >= 0) ? data.targetBooks : 0,
      targetPages: (typeof data.targetPages === 'number' && data.targetPages >= 0) ? data.targetPages : 0,
      createdAt: createdAt
    };
  }
  function journalModel(data) {
    data = data || {};
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id: data.id || uid('jr'),
      bookId: typeof data.bookId === 'string' ? data.bookId : '',
      title: typeof data.title === 'string' ? data.title : 'Notes',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: createdAt
    };
  }

  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list();
      all.push(record);
      if (!storeSet(key, all)) return null;
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      if (all[idx].updatedAt !== undefined) all[idx].updatedAt = Date.now();
      if (!storeSet(key, all)) return null;
      return all[idx];
    }
    function remove(id) {
      const all = list();
      const next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const Books = makeCollection('entread:books', bookModel);
  const Authors = makeCollection('entread:authors', authorModel);
  const Series = makeCollection('entread:series', seriesModel);
  const Quotes = makeCollection('entread:quotes', quoteModel);
  const LogEntries = makeCollection('entread:log', logModel);
  const Goals = makeCollection('entread:goals', goalModel);
  const Journal = makeCollection('entread:journal', journalModel);

  // ============================================================
  // SELECTORS
  // ============================================================
  function booksSorted() { return Books.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function booksByStatus(status) { return booksSorted().filter(function (b) { return b.status === status; }); }
  function tbrSorted() { return Books.list().filter(function (b) { return b.status === 'tbr'; }).sort(function (a, b) { return a.tbrPriority - b.tbrPriority; }); }
  function currentlyReadingSorted() {
    return Books.list().filter(function (b) { return b.status === 'reading'; })
      .sort(function (a, b) { return (b.dateStarted || '').localeCompare(a.dateStarted || '') || b.updatedAt - a.updatedAt; });
  }
  function readSorted() {
    return Books.list().filter(function (b) { return b.status === 'read'; })
      .sort(function (a, b) { return (b.dateFinished || '').localeCompare(a.dateFinished || ''); });
  }
  function progressPct(book) {
    if (!book.pageCount || book.currentPage == null) return null;
    return Math.max(0, Math.min(100, Math.round((book.currentPage / book.pageCount) * 100)));
  }
  function nextOrder() {
    const all = Books.list();
    return all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
  }
  function nextTbrPriority() {
    const tbr = tbrSorted();
    return tbr.length ? Math.max.apply(null, tbr.map(function (x) { return x.tbrPriority; })) + 1 : 0;
  }
  function reorderLibraryVisible(visibleOrderedIds) {
    const all = Books.list();
    const visibleSet = {};
    visibleOrderedIds.forEach(function (id, i) { visibleSet[id] = i; });
    const visibleItems = all.filter(function (x) { return visibleSet.hasOwnProperty(x.id); })
      .sort(function (a, b) { return visibleSet[a.id] - visibleSet[b.id]; });
    const merged = all.slice().sort(function (a, b) { return a.order - b.order; });
    let vi = 0;
    const finalOrder = merged.map(function (x) { return visibleSet.hasOwnProperty(x.id) ? visibleItems[vi++] : x; });
    finalOrder.forEach(function (x, i) { x.order = i; });
    Books.replaceAll(finalOrder);
  }
  function reorderTbr(orderedIds) {
    const all = Books.list();
    const byId = {};
    all.forEach(function (b) { byId[b.id] = b; });
    orderedIds.forEach(function (id, i) { if (byId[id]) byId[id].tbrPriority = i; });
    Books.replaceAll(all);
  }
  function setStatus(bookId, status) {
    const b = Books.get(bookId);
    if (!b) return null;
    const patch = { status: status };
    if (status === 'reading' && !b.dateStarted) patch.dateStarted = todayISO();
    if (status === 'read' && !b.dateFinished) patch.dateFinished = todayISO();
    // A book newly entering 'tbr' (from any other status) gets a fresh
    // priority appended to the end of the queue. Deliberately checked
    // against b.status, not b.tbrPriority — the very first book in a
    // queue legitimately has tbrPriority === 0, which a falsy check
    // would have mistaken for "never set" and kept reassigning.
    if (status === 'tbr' && b.status !== 'tbr') patch.tbrPriority = nextTbrPriority();
    return Books.update(bookId, patch);
  }
  function toggleFavorite(bookId) {
    const b = Books.get(bookId);
    if (!b) return null;
    return Books.update(bookId, { favorite: !b.favorite });
  }
  function removeBookCascade(bookId) {
    Quotes.replaceAll(Quotes.list().filter(function (q) { return q.bookId !== bookId; }));
    Journal.replaceAll(Journal.list().filter(function (j) { return j.bookId !== bookId; }));
    const stale = LogEntries.list().filter(function (l) { return l.bookId === bookId; });
    stale.forEach(function (l) { LogEntries.update(l.id, { bookId: null }); });
    return Books.remove(bookId);
  }

  function authorsSorted() { return Authors.list().slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }); }
  function authorName(book) {
    if (!book || !book.authorId) return '';
    const a = Authors.get(book.authorId);
    return a ? a.name : '';
  }
  function booksForAuthor(authorId) { return booksSorted().filter(function (b) { return b.authorId === authorId; }); }
  function nextAuthorOrder() {
    const all = Authors.list();
    return all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
  }
  function findOrCreateAuthorByName(name) {
    name = (name || '').trim();
    if (!name) return null;
    const existing = Authors.list().find(function (a) { return a.name.toLowerCase() === name.toLowerCase(); });
    if (existing) return existing;
    return Authors.add({ name: name, order: nextAuthorOrder() });
  }
  function removeAuthorCascade(authorId) {
    const affected = Books.list().filter(function (b) { return b.authorId === authorId; });
    affected.forEach(function (b) { Books.update(b.id, { authorId: null }); });
    return Authors.remove(authorId);
  }

  function seriesSorted() { return Series.list().slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }); }
  function seriesName(book) {
    if (!book || !book.seriesId) return '';
    const s = Series.get(book.seriesId);
    return s ? s.name : '';
  }
  function booksForSeries(seriesId) {
    return booksSorted().filter(function (b) { return b.seriesId === seriesId; })
      .sort(function (a, b) { return (a.seriesIndex || 999) - (b.seriesIndex || 999) || (a.title || '').localeCompare(b.title || ''); });
  }
  function nextSeriesOrder() {
    const all = Series.list();
    return all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
  }
  function removeSeriesCascade(seriesId) {
    const affected = Books.list().filter(function (b) { return b.seriesId === seriesId; });
    affected.forEach(function (b) { Books.update(b.id, { seriesId: null, seriesIndex: null }); });
    return Series.remove(seriesId);
  }

  function quotesForBook(bookId) { return Quotes.list().filter(function (q) { return q.bookId === bookId; }).sort(function (a, b) { return a.order - b.order; }); }
  function quotesSorted() { return Quotes.list().slice().sort(function (a, b) { return b.createdAt - a.createdAt; }); }
  function favoriteQuotes() { return quotesSorted().filter(function (q) { return q.favorite; }); }
  function nextQuoteOrder(bookId) {
    const all = quotesForBook(bookId);
    return all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
  }

  function journalForBook(bookId) { return Journal.list().filter(function (j) { return j.bookId === bookId; }).sort(function (a, b) { return a.order - b.order; }); }
  function addJournalSection(bookId, title) {
    const all = journalForBook(bookId);
    const order = all.length ? Math.max.apply(null, all.map(function (x) { return x.order; })) + 1 : 0;
    return Journal.add({ bookId: bookId, title: title || 'Notes', body: '', order: order });
  }
  function moveJournalSection(id, dir) {
    const j = Journal.get(id);
    if (!j) return;
    const siblings = journalForBook(j.bookId);
    const idx = siblings.findIndex(function (x) { return x.id === id; });
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    const aOrder = a.order, bOrder = b.order;
    Journal.update(a.id, { order: bOrder });
    Journal.update(b.id, { order: aOrder });
  }

  function currentYear() { return new Date().getFullYear(); }
  function goalForYear(year) {
    const g = Goals.list().find(function (x) { return x.year === year; });
    return g || goalModel({ year: year });
  }
  function setGoalForYear(year, patch) {
    const existing = Goals.list().find(function (x) { return x.year === year; });
    if (existing) return Goals.update(existing.id, patch);
    return Goals.add(Object.assign({ year: year }, patch));
  }
  function yearStats(year) {
    const finished = Books.list().filter(function (b) { return b.status === 'read' && (b.dateFinished || '').slice(0, 4) === String(year); });
    const goal = goalForYear(year);
    const pagesRead = finished.reduce(function (sum, b) { return sum + (b.pageCount || 0); }, 0);
    return {
      finishedCount: finished.length,
      targetBooks: goal.targetBooks,
      pctBooks: goal.targetBooks ? Math.min(100, Math.round((finished.length / goal.targetBooks) * 100)) : 0,
      pagesRead: pagesRead,
      targetPages: goal.targetPages,
      pctPages: goal.targetPages ? Math.min(100, Math.round((pagesRead / goal.targetPages) * 100)) : 0
    };
  }
  function monthlyFinishedCounts(year) {
    const counts = new Array(12).fill(0);
    Books.list().forEach(function (b) {
      if (b.status !== 'read' || !b.dateFinished) return;
      const parts = b.dateFinished.split('-');
      if (parts[0] !== String(year)) return;
      const m = parseInt(parts[1], 10) - 1;
      if (m >= 0 && m < 12) counts[m]++;
    });
    return counts;
  }
  function genreBreakdown() {
    const map = {};
    Books.list().forEach(function (b) {
      (b.genres || []).forEach(function (g) { map[g] = (map[g] || 0) + 1; });
    });
    return map;
  }
  function formatBreakdown() {
    const map = {};
    FORMATS.forEach(function (f) { map[f] = 0; });
    Books.list().forEach(function (b) { map[b.format] = (map[b.format] || 0) + 1; });
    return map;
  }
  function statusBreakdown() {
    const map = {};
    STATUS_KEYS.forEach(function (s) { map[s] = 0; });
    Books.list().forEach(function (b) { map[b.status] = (map[b.status] || 0) + 1; });
    return map;
  }
  function overallStats() {
    const all = Books.list();
    const read = all.filter(function (b) { return b.status === 'read'; });
    const rated = read.filter(function (b) { return b.rating > 0; });
    const ratingSum = rated.reduce(function (s, b) { return s + b.rating; }, 0);
    const totalPages = read.reduce(function (s, b) { return s + (b.pageCount || 0); }, 0);
    let longest = null;
    read.forEach(function (b) { if (b.pageCount && (!longest || b.pageCount > longest.pageCount)) longest = b; });
    const authorCounts = {};
    read.forEach(function (b) { if (b.authorId) authorCounts[b.authorId] = (authorCounts[b.authorId] || 0) + 1; });
    let topAuthorId = null, topAuthorCount = 0;
    Object.keys(authorCounts).forEach(function (id) { if (authorCounts[id] > topAuthorCount) { topAuthorId = id; topAuthorCount = authorCounts[id]; } });
    const topAuthor = topAuthorId ? Authors.get(topAuthorId) : null;
    return {
      totalBooks: all.length,
      totalRead: read.length,
      totalPagesRead: totalPages,
      avgRating: rated.length ? (ratingSum / rated.length) : 0,
      favoriteCount: all.filter(function (b) { return b.favorite; }).length,
      longestBook: longest,
      topAuthor: topAuthor,
      topAuthorCount: topAuthorCount
    };
  }

  function logForYear(year) { return LogEntries.list().filter(function (l) { return (l.date || '').slice(0, 4) === String(year); }); }
  function logByDate() {
    const map = {};
    LogEntries.list().forEach(function (l) {
      if (!map[l.date]) map[l.date] = { pagesRead: 0, minutesRead: 0, count: 0 };
      map[l.date].pagesRead += l.pagesRead || 0;
      map[l.date].minutesRead += l.minutesRead || 0;
      map[l.date].count++;
    });
    return map;
  }
  function readingStreak() {
    const byDate = logByDate();
    const dates = Object.keys(byDate);
    if (!dates.length) return { current: 0, best: 0 };
    dates.sort();
    // Best streak: walk the sorted unique dates once, counting consecutive days.
    let best = 1, run = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const cur = new Date(dates[i] + 'T00:00:00');
      const diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) { run++; } else { run = 1; }
      if (run > best) best = run;
    }
    // Current streak: walk backward from today (or yesterday, if today has no
    // entry yet) while consecutive days have a log entry.
    let current = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    if (!byDate[iso(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (byDate[iso(cursor)]) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { current: current, best: best };
  }

  // ============================================================
  // SEED — a light starter set, real recognizable titles as placeholders
  // (no fabricated cover/URL), same precedent every other seed in this
  // app already follows.
  // ============================================================
  function seedDefaultData() {
    [Books, Authors, Series, Quotes, LogEntries, Goals, Journal].forEach(function (c) { c.replaceAll([]); });

    const rothfuss = Authors.add({ name: 'Patrick Rothfuss', order: 0 });
    const clear = Authors.add({ name: 'James Clear', order: 1 });
    const weir = Authors.add({ name: 'Andy Weir', order: 2 });
    const maas = Authors.add({ name: 'Sarah J. Maas', order: 3 });
    const jackson = Authors.add({ name: 'Shirley Jackson', order: 4 });
    const sanderson = Authors.add({ name: 'Brandon Sanderson', order: 5 });

    const mistborn = Series.add({ name: 'Mistborn', notes: 'Original trilogy, by Brandon Sanderson.', order: 0 });

    const nameOfWind = Books.add({
      title: 'The Name of the Wind', authorId: rothfuss.id, genres: ['Fantasy'], format: 'Physical',
      status: 'reading', pageCount: 662, currentPage: 310, dateStarted: todayISO(),
      order: nextOrder()
    });
    const atomicHabits = Books.add({
      title: 'Atomic Habits', authorId: clear.id, genres: ['Non-Fiction', 'Self-Help'], format: 'E-Book',
      status: 'read', rating: 5, pageCount: 320,
      dateFinished: (function () { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); })(),
      favorite: true, order: nextOrder()
    });
    Books.add({
      title: 'Project Hail Mary', authorId: weir.id, genres: ['Sci-Fi'], format: 'Physical',
      status: 'tbr', tbrPriority: 0, order: nextOrder()
    });
    Books.add({
      title: 'The Haunting of Hill House', authorId: jackson.id, genres: ['Horror'], format: 'Physical',
      status: 'tbr', tbrPriority: 1, order: nextOrder()
    });
    Books.add({
      title: 'A Court of Thorns and Roses', authorId: maas.id, genres: ['Fantasy', 'Romance'], format: 'Physical',
      status: 'read', rating: 4,
      dateFinished: (function () { const d = new Date(); d.setMonth(d.getMonth() - 4); return d.toISOString().slice(0, 10); })(),
      order: nextOrder()
    });
    Books.add({
      title: 'Mistborn: The Final Empire', authorId: sanderson.id, seriesId: mistborn.id, seriesIndex: 1,
      genres: ['Fantasy'], format: 'Audiobook', status: 'read', rating: 5, pageCount: 541,
      dateFinished: (function () { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); })(),
      order: nextOrder()
    });
    Books.add({
      title: 'The Well of Ascension', authorId: sanderson.id, seriesId: mistborn.id, seriesIndex: 2,
      genres: ['Fantasy'], format: 'Audiobook', status: 'tbr', tbrPriority: 2, order: nextOrder()
    });

    Goals.add({ year: currentYear(), targetBooks: 24, targetPages: 0 });

    Quotes.add({
      bookId: atomicHabits.id, text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
      pageNumber: 27, tag: 'systems', favorite: true, order: 0
    });
    Quotes.add({
      bookId: nameOfWind.id, text: 'It\'s the questions we can\'t answer that teach us the most.', pageNumber: 145, order: 0
    });

    Journal.add({ bookId: atomicHabits.id, title: 'Key Takeaways', body: 'Focus on identity-based habits, not outcome-based ones. Small 1% improvements compound.', order: 0 });

    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (i === 3) continue; // a small gap, so the seeded streak isn't a suspiciously perfect 7
      LogEntries.add({ date: iso, bookId: nameOfWind.id, pagesRead: 20 + (i * 3), createdAt: Date.now() - i * 86400000 });
    }

    storeSet('entread:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('entread:seeded')) return;
    if (Books.list().length > 0) { storeSet('entread:seeded', true); return; }
    seedDefaultData();
  }
  function maybeSeedAfterSyncAttempt(remoteAppliedRef) {
    setTimeout(function () {
      if (remoteAppliedRef.applied) return;
      if (Books.list().length > 0) return;
      seedIfEmpty();
    }, 5000);
  }

  // ============================================================
  // MIGRATION — folds any real pre-existing Reading Corner items (the old
  // generic entdash:reading collection, entertainment-dash-data.js's own
  // PAGES.reading — still the migration TARGET of that file's own
  // migrateHorrorSpicyReadingIntoReadingCorner(), which still runs and
  // still writes there) into this file's own richer Books database.
  // Guarded so it only ever runs once per device; entdash:reading itself
  // is left in place afterward, orphaned but untouched, same treatment as
  // every other superseded key elsewhere in this app. Per-item dedupe via
  // a `legacyId` stamp on the new Book record, so a retry (e.g. after a
  // storage-quota failure mid-run) can't create duplicates.
  //
  // Script order matters here: entertainment-dash-data.js (which still
  // owns entdash:reading and its own horror/spicy migration) must load
  // BEFORE this file, so entdash:reading is already fully populated by
  // the time this runs — see entertainment-dash.html's own script tags.
  // ============================================================
  function migrateOldReadingItemsIntoBooks() {
    let done = false;
    try { done = localStorage.getItem('entread:booksMigratedV1') === 'true'; } catch (e) {}
    if (done) return;
    const old = storeGet('entdash:reading');
    if (!Array.isArray(old) || !old.length) { try { localStorage.setItem('entread:booksMigratedV1', 'true'); } catch (e) {} return; }

    const alreadyMigratedIds = {};
    Books.list().forEach(function (b) { if (b.legacyId) alreadyMigratedIds[b.legacyId] = true; });

    const STATUS_MAP = { want: 'tbr', progress: 'reading', done: 'read' };
    let allOk = true;
    old.forEach(function (item) {
      if (!item || alreadyMigratedIds[item.id]) return;
      const authorRec = item.creator ? findOrCreateAuthorByName(item.creator) : null;
      let pageCount = null;
      if (item.lengthText) {
        const m = /\d+/.exec(item.lengthText);
        if (m) pageCount = parseInt(m[0], 10) || null;
      }
      const status = STATUS_MAP[item.status] || 'tbr';
      const added = Books.add({
        title: item.title || '', authorId: authorRec ? authorRec.id : null,
        genres: item.subtopic ? [item.subtopic] : [], cover: item.cover || '', url: item.url || '',
        status: status, tbrPriority: status === 'tbr' ? nextTbrPriority() : 0,
        rating: item.rating || 0, favorite: !!item.favorite, pageCount: pageCount,
        review: item.description || '', order: (typeof item.order === 'number') ? item.order : nextOrder(),
        legacyId: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt
      });
      if (!added) { allOk = false; return; }
      if (item.notesText) {
        Journal.add({ bookId: added.id, title: 'Notes (imported)', body: item.notesText, order: 0 });
      }
    });
    if (allOk) { try { localStorage.setItem('entread:booksMigratedV1', 'true'); } catch (e) {} }
  }
  migrateOldReadingItemsIntoBooks();

  // ============================================================
  // Cover-photo backfill — same shape as entertainment-dash-data.js's own
  // migratePhotosToStorage() and entertainment-hub-data.js's sibling.
  // ============================================================
  function migratePhotosToStorage() {
    if (!global.PhotoStore) return;
    let already = false;
    try { already = localStorage.getItem('entread:photosMigratedV1') === 'true'; } catch (e) {}
    if (already) return;
    const jobs = [];
    [{ coll: Books, field: 'cover' }, { coll: Authors, field: 'photo' }, { coll: Series, field: 'cover' }].forEach(function (spec) {
      spec.coll.list().forEach(function (item) {
        const val = item[spec.field];
        if (typeof val === 'string' && val.indexOf('data:') === 0) {
          const orig = val, id = item.id, field = spec.field, coll = spec.coll;
          jobs.push(global.PhotoStore.upload(orig).then(function (url) {
            if (!url) return false;
            const fresh = coll.get(id);
            if (fresh && fresh[field] === orig) coll.update(id, (function () { const p = {}; p[field] = url; return p; })());
            return true;
          }));
        }
      });
    });
    if (!jobs.length) { try { localStorage.setItem('entread:photosMigratedV1', 'true'); } catch (e) {} return; }
    Promise.all(jobs).then(function (results) {
      if (results.every(function (ok) { return ok; })) {
        try { localStorage.setItem('entread:photosMigratedV1', 'true'); } catch (e) {}
      }
    });
  }

  global.EntReading = {
    FORMATS: FORMATS, STATUS_KEYS: STATUS_KEYS, STATUS_LABELS: STATUS_LABELS, SOURCES: SOURCES, SUGGESTED_GENRES: SUGGESTED_GENRES,
    uid: uid, todayISO: todayISO, fetchBookPreview: fetchBookPreview,
    Books: Books, Authors: Authors, Series: Series, Quotes: Quotes, LogEntries: LogEntries, Goals: Goals, Journal: Journal,
    booksSorted: booksSorted, booksByStatus: booksByStatus, tbrSorted: tbrSorted,
    currentlyReadingSorted: currentlyReadingSorted, readSorted: readSorted, progressPct: progressPct,
    nextOrder: nextOrder, nextTbrPriority: nextTbrPriority,
    reorderLibraryVisible: reorderLibraryVisible, reorderTbr: reorderTbr,
    setStatus: setStatus, toggleFavorite: toggleFavorite, removeBookCascade: removeBookCascade,
    authorsSorted: authorsSorted, authorName: authorName, booksForAuthor: booksForAuthor,
    findOrCreateAuthorByName: findOrCreateAuthorByName, removeAuthorCascade: removeAuthorCascade, nextAuthorOrder: nextAuthorOrder,
    seriesSorted: seriesSorted, seriesName: seriesName, booksForSeries: booksForSeries,
    removeSeriesCascade: removeSeriesCascade, nextSeriesOrder: nextSeriesOrder,
    quotesForBook: quotesForBook, quotesSorted: quotesSorted, favoriteQuotes: favoriteQuotes, nextQuoteOrder: nextQuoteOrder,
    journalForBook: journalForBook, addJournalSection: addJournalSection, moveJournalSection: moveJournalSection,
    currentYear: currentYear, goalForYear: goalForYear, setGoalForYear: setGoalForYear, yearStats: yearStats,
    monthlyFinishedCounts: monthlyFinishedCounts,
    genreBreakdown: genreBreakdown, formatBreakdown: formatBreakdown, statusBreakdown: statusBreakdown, overallStats: overallStats,
    logForYear: logForYear, logByDate: logByDate, readingStreak: readingStreak,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt,
    migratePhotosToStorage: migratePhotosToStorage
  };
})(window);
