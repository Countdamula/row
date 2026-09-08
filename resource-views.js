// =============================================================
// resource-views.js — the six index views, as strings.
//
// A VIEW IS A STRING BUILDER AND NOTHING ELSE. It never writes to
// storage, never touches the DOM and never binds a listener —
// resource-app.js owns all three. That separation is what lets a
// cloud pull re-run every view on a whim.
//
// WHERE EACH LAYOUT COMES FROM
// ─────────────────────────────────────────────────────────────
//   Home        01_knowledge_vault.png — a full-viewport hero, a
//               two-line display headline on an ornament rule,
//               and three bordered doors below the fold.
//   Books       the reference recording — a centred head and
//               intro, then a four-column grid of covers, each
//               with format pills, a note, a reading state and
//               one link out.
//   Videos      the YouTube reference — a dense 16:9 grid with a
//               duration badge, a two-line title and a channel.
//   Articles    the Wacanan reference — a banner, a topic chip
//               row, hairline-separated feed rows, and a right
//               sidebar of sources, topics and a reading list.
//
// EVERY VIEW BUT HOME OPENS ON THE SHORT HERO, for the same
// reason the Prompt Studio's detail routes do: the house
// photograph is the studio's signature and every page should
// carry it, but a shelf you are scanning should not sit under a
// full screen of atmosphere.
//
// THE SHELF EDGE is this studio's one added flourish: a gold
// hairline that runs under every page head, under the row of
// covers, and under the active tab. A library is a room full of
// shelf edges; nothing else in the house draws one.
// =============================================================

(function (global) {
  'use strict';

  function U() { return global.AscUI; }
  function D() { return global.Resource; }
  function R() { return global.ResRich; }
  function esc(s) { return U().esc(s); }
  function attr(s) { return U().attr(s); }

  // ═══ §SMALL PIECES ═════════════════════════════════════════

  function sig(id, size) {
    var s = size || 16;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 16 16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.15" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }
  function arrow(label) {
    return '<span class="hd-arrow">' + esc(label || '') +
      '<svg width="22" height="7" viewBox="0 0 24 8" fill="none" stroke="currentColor" ' +
      'stroke-width="1" aria-hidden="true"><path d="M0 4h22M18.4 .8 22.6 4l-4.2 3.2"/></svg></span>';
  }
  function orn() {
    return '<div class="hd-orn" aria-hidden="true"><i></i>' +
      '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
      'stroke-width="1" stroke-linejoin="round"><use href="#sg-orn"></use></svg><i></i></div>';
  }
  function extGlyph() {
    return '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M9.4 2.6H13.4V6.6M13.4 2.6 7.4 8.6"/>' +
      '<path d="M11.2 9.6v3.2a.8.8 0 0 1-.8.8H3.2a.8.8 0 0 1-.8-.8V5.6a.8.8 0 0 1 .8-.8h3.2"/></svg>';
  }
  function checkGlyph() {
    return '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 8.4 6.3 11.6 13 4.8"/></svg>';
  }

  var TYPE_SIGIL = { book: 'sg-book', video: 'sg-play', article: 'sg-doc', topic: 'sg-tag' };

  // THE FALLBACK IS ALWAYS DRAWN, and the picture sits on top of it.
  // A cover URL that 404s is normal here — an ISBN with no scan at
  // Open Library, a channel that changed its art, a link that rotted
  // — and `onerror="this.remove()"` alone leaves an empty box, which
  // reads as a broken page rather than as a book with no jacket.
  // Layered, a failed image simply reveals the drawn mark underneath.
  function coverArt(type, rec, cls) {
    var src = D().coverOf(type, rec);
    return '<span class="' + cls + '__none">' + sig(TYPE_SIGIL[type] || 'sg-doc', 26) + '</span>' +
      (src
        ? '<img class="' + cls + '__img" src="' + attr(src) + '" alt="" loading="lazy" ' +
          'decoding="async" onerror="this.remove()">'
        : '');
  }

  // ═══ §THE HERO ═════════════════════════════════════════════
  // One component, two heights. The plate, the glow, the veil and
  // the parallax hooks are identical to the Entertainment
  // Studio's — this page links the same stylesheet, so the
  // geometry is not re-implemented, only re-cropped.

  function heroArt() {
    return '<div class="hd-phero__art" aria-hidden="true">' +
      '<img class="hd-phero__img" src="images_by_admin/resource/hero-hall.jpg" alt="" ' +
        'width="675" height="1200" fetchpriority="high" decoding="async">' +
      '<span class="hd-phero__glow"></span>' +
      '<span class="hd-phero__veil"></span>' +
    '</div>';
  }

  // The short hero every index and every item page opens on.
  function shortHero(o) {
    o = o || {};
    return '<header class="hd-phero hd-phero--short" data-parallax>' +
      heroArt() +
      '<div class="hd-phero__in">' +
        '<div class="hd-phero__say">' +
          (o.back ? '<a class="hd-phero__back" href="' + attr(o.back.href) + '">' +
            esc(o.back.label) + '</a>' : '') +
          (o.eyebrow ? '<p class="hd-phero__e">' + esc(o.eyebrow) + '</p>' : '') +
          '<h1 class="hd-phero__t">' + esc(o.title) + '</h1>' +
        '</div>' +
        (o.caption ? '<p class="hd-phero__c">' + U().escLines(o.caption) + '</p>' : '') +
      '</div>' +
      '<span class="hd-phero__rule" aria-hidden="true"></span>' +
    '</header>';
  }

  // The centred intro under a page head — the reference recording
  // opens the Books page on exactly this, and it is the one place
  // in the studio where a paragraph is centred.
  function intro(key) {
    var text = D().getPages()[key] || '';
    if (!text) return '';
    return '<div class="rs-intro">' +
      '<p class="rs-intro__p" data-act="edit-intro" data-key="' + attr(key) + '" ' +
        'role="button" tabindex="0" title="Click to rewrite">' + U().escLines(text) + '</p>' +
    '</div>';
  }

  // ═══ §HOME ═════════════════════════════════════════════════

  // The three doors, in the reference's order and with its words.
  var DOORS = [
    { href: '#/videos',   sigil: 'sg-play', name: 'YouTube Videos', say: 'Watch. Learn. Grow.' },
    { href: '#/books',    sigil: 'sg-book', name: 'Books',          say: 'Read. Reflect. Expand.' },
    { href: '#/articles', sigil: 'sg-doc',  name: 'Articles',       say: 'Ideas. Insights. Perspective.' }
  ];

  function doors() {
    return '<div class="rs-doors">' + DOORS.map(function (d, i) {
      return '<a class="rs-door ' + U().rvlClass() + '"' + U().rvlStyle(i) + ' href="' + d.href + '">' +
        '<span class="rs-door__mark" aria-hidden="true">' + sig(d.sigil, 22) + '</span>' +
        '<span class="rs-door__name">' + esc(d.name) + '</span>' +
        '<span class="rs-door__say">' + esc(d.say) + '</span>' +
        '<span class="rs-door__go" aria-hidden="true">' +
          '<svg width="20" height="7" viewBox="0 0 24 8" fill="none" stroke="currentColor" ' +
          'stroke-width="1"><path d="M0 4h22M18.4 .8 22.6 4l-4.2 3.2"/></svg></span>' +
      '</a>';
    }).join('') + '</div>';
  }

  function viewHome() {
    var h = D().getHouse();
    var c = D().counts();
    var recent = D().everything().slice(0, 8);

    // The headline is two lines in the reference and the break is
    // part of the composition, so it is stored with the break in
    // it rather than left to the wrap.
    var lines = String(h.headline || '').split('\n');
    var headline = lines.length > 1
      ? lines.map(esc).join('<br>')
      : esc(h.headline).replace(/\s(\S+)$/, '<br>$1');

    var hero =
      '<header class="hd-phero rs-phero--home" data-parallax>' +
        heroArt() +
        '<div class="hd-phero__in">' +
          '<div class="hd-phero__say">' +
            '<p class="hd-phero__e">The Resource Studio</p>' +
            '<h1 class="hd-phero__t rs-phero__t">' + headline + '</h1>' +
            orn() +
            '<p class="rs-phero__sub">' + U().escLines(h.sub) + '</p>' +
            '<a class="rs-cta" href="#/books">' + esc(h.cta) +
              '<svg width="20" height="7" viewBox="0 0 24 8" fill="none" stroke="currentColor" ' +
              'stroke-width="1" aria-hidden="true"><path d="M0 4h22M18.4 .8 22.6 4l-4.2 3.2"/></svg>' +
            '</a>' +
          '</div>' +
          '<p class="rs-credoq">&ldquo;' + esc(h.credo) + '&rdquo;</p>' +
          '<span class="hd-phero__scroll" aria-hidden="true"><i></i>Scroll</span>' +
        '</div>' +
        '<span class="hd-phero__rule" aria-hidden="true"></span>' +
      '</header>';

    var open = openNow();

    return hero +
      '<section class="hd-band hd-night rs-band--doors">' + doors() + '</section>' +
      (open ? '<section class="hd-band hd-night">' + open + '</section>' : '') +
      (recent.length
        ? '<section class="hd-band hd-night">' +
            sectionHead('Lately', 'What came in last', '#/books', 'The books') +
            '<div class="hd-grid">' +
              recent.map(function (e, i) { return itemCard(e.type, e.rec, i); }).join('') +
            '</div>' +
          '</section>'
        : '<section class="hd-band hd-night">' + emptyHouse() + '</section>') +
      collectionsStrip() +
      '<section class="hd-band hd-night">' + numbers(c) + '</section>' +
      credoBand(c);
  }

  function sectionHead(eyebrow, title, href, linkLabel) {
    return '<div class="rs-head">' +
      '<div class="rs-head__l">' +
        '<p class="hd-eyebrow hd-eyebrow--rule">' + esc(eyebrow) + '</p>' +
        '<h2 class="hd-display--mid rs-head__t">' + esc(title) + '</h2>' +
      '</div>' +
      (href ? '<a class="hd-link hd-link--quiet" href="' + attr(href) + '">' +
        arrow(linkLabel || 'See all') + '</a>' : '') +
    '</div>';
  }

  // "Open now" — the one band on the home page that is about
  // today rather than about the library. It is hidden entirely
  // when nothing is open, because a permanently empty band trains
  // you to stop looking at that part of the page.
  function openNow() {
    var reading = D().Books.list().filter(function (b) { return b.status === 'reading'; });
    var watching = D().Videos.list().filter(function (v) { return v.status === 'watching'; });
    var unread = D().Articles.list().filter(function (a) { return a.status === 'reading'; });
    var rows = []
      .concat(reading.map(function (r) { return { type: 'book', rec: r }; }))
      .concat(watching.map(function (r) { return { type: 'video', rec: r }; }))
      .concat(unread.map(function (r) { return { type: 'article', rec: r }; }));
    if (!rows.length) return '';
    return sectionHead('Open now', rows.length === 1 ? 'One thing on the go' : 'On the go', '', '') +
      '<div class="hd-grid">' +
        rows.slice(0, 4).map(function (e, i) { return itemCard(e.type, e.rec, i); }).join('') +
      '</div>';
  }

  function emptyHouse() {
    return '<div class="hd-empty">' +
      '<strong>Nothing is saved yet.</strong>' +
      'Add the first book, video or article with the button in the corner — or ' +
      '<button type="button" class="hd-link--quiet rs-inline" data-act="starter">' +
      'load a starter library</button> to see how a full shelf reads.' +
    '</div>';
  }

  function collectionsStrip() {
    var topics = D().Topics.list()
      .map(function (t) { return { t: t, n: D().topicCount(t.id) }; })
      .sort(function (a, b) { return b.n - a.n || a.t.name.localeCompare(b.t.name); })
      .slice(0, 6);
    if (!topics.length) return '';
    return '<section class="hd-band hd-night">' +
      sectionHead('Collections', 'What keeps coming up', '#/collections', 'Every topic') +
      '<div class="hd-cols">' +
        topics.map(function (x, i) { return topicCard(x.t, x.n, i); }).join('') +
      '</div>' +
    '</section>';
  }

  function numbers(c) {
    var rows = [
      { n: c.books, label: c.books === 1 ? 'book' : 'books' },
      { n: c.videos, label: c.videos === 1 ? 'video' : 'videos' },
      { n: c.articles, label: c.articles === 1 ? 'article' : 'articles' },
      { n: c.topics, label: c.topics === 1 ? 'topic' : 'topics' },
      { n: c.qa, label: c.qa === 1 ? 'question' : 'questions' }
    ];
    return '<div class="hd-reads">' + rows.map(function (r) {
      return '<div class="hd-read"><b>' + r.n + '</b><span>' + esc(r.label) + '</span></div>';
    }).join('') + '</div>';
  }

  function credoBand(c) {
    var done = c.read + c.watched;
    return '<section class="hd-band hd-night">' +
      '<div class="hd-credo">' +
        '<div class="hd-credo__say">' +
          '<p class="hd-eyebrow hd-eyebrow--rule">Why this exists</p>' +
          '<p class="hd-display--mid">A link is not a memory.</p>' +
          '<p class="hd-prose">A bookmark saves the address of a thing you have not read. ' +
          'This saves the thing — the words, the pictures, the transcript, and what you ' +
          'made of it. Everything here is kept whole, and everything here is yours.</p>' +
          '<a class="hd-link hd-link--quiet" href="#/about">' + arrow('The studio') + '</a>' +
        '</div>' +
        '<div class="hd-credo__seal">' +
          '<span class="hd-credo__bar" aria-hidden="true"></span>' +
          '<div class="hd-credo__words">' +
            '<span><i>◆</i><b>' + esc(D().counts().books + ' on the shelf') + '</b></span>' +
            '<span><i>◆</i><b>' + esc(done + ' finished') + '</b></span>' +
            '<span><i>◆</i><b>' + esc(c.chapters + ' transcript chapters') + '</b></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // ═══ §THE SHARED CARD ══════════════════════════════════════
  // The home page and the search both need one card that can draw
  // any of the three kinds. The type-specific grids below do NOT
  // use it — a book wants a portrait cover and a video wants a
  // 16:9 still, and one card that did both would do neither.

  function itemCard(type, rec, i) {
    var href = D().hrefOf(type, rec.id);
    var sub = D().subtitleOf(type, rec);
    return '<article class="hd-card hd-card--grid ' + U().rvlClass() + '"' + U().rvlStyle(i) + '>' +
      '<a class="hd-card__hit" href="' + attr(href) + '">' +
        '<span class="hd-card__art rs-card__art--' + type + '">' +
          coverArt(type, rec, 'hd-card') +
        '</span>' +
        '<span class="hd-card__body">' +
          '<span class="hd-card__title">' + esc(rec.title || 'Untitled') + '</span>' +
          '<span class="hd-card__meta">' + esc(typeLabel(type)) + '</span>' +
          (sub ? '<span class="hd-card__sub">' + esc(sub) + '</span>' : '') +
        '</span>' +
      '</a>' +
    '</article>';
  }
  function typeLabel(type) {
    return type === 'book' ? 'Book' : type === 'video' ? 'Video' : type === 'topic' ? 'Topic' : 'Article';
  }

  // ═══ §BOOKS ════════════════════════════════════════════════

  var FORMAT_GLYPH = {
    Kindle: 'sg-slab', Paperback: 'sg-book', Hardcover: 'sg-book',
    Audiobook: 'sg-wave', PDF: 'sg-doc', Epub: 'sg-slab'
  };

  function formatPills(formats) {
    if (!formats || !formats.length) return '';
    return '<span class="rs-fmts">' + formats.map(function (f) {
      return '<span class="rs-fmt">' + sig(FORMAT_GLYPH[f] || 'sg-book', 11) +
        esc(f) + '</span>';
    }).join('') + '</span>';
  }

  // The status line the reference draws: a turning glyph and
  // "Currently reading", or a tick and the date it was finished.
  function bookState(b) {
    if (b.status === 'reading') {
      return '<p class="rs-state is-live"><i class="rs-spin" aria-hidden="true"></i>' +
        'Currently reading</p>';
    }
    if (b.status === 'read') {
      var d = D().longDate(b.readAt);
      return '<p class="rs-state">' + checkGlyph() +
        '<span>Read<b>' + (d ? esc(d) : 'at some point') + '</b></span></p>';
    }
    if (b.status === 'shelved') return '<p class="rs-state is-quiet">Set aside</p>';
    return '<p class="rs-state is-quiet">On the list</p>';
  }

  function outLink(url, label) {
    if (!url) return '';
    return '<a class="rs-out" href="' + attr(url) + '" target="_blank" rel="noopener noreferrer">' +
      esc(label || D().siteName(url) || 'Open') + extGlyph() + '</a>';
  }

  function bookCard(b, i) {
    var href = D().hrefOf('book', b.id);
    return '<article class="rs-book ' + U().rvlClass() + '"' + U().rvlStyle(i) + '>' +
      '<a class="rs-book__art" href="' + attr(href) + '" aria-label="' + attr(b.title) + '">' +
        coverArt('book', b, 'rs-book') +
      '</a>' +
      '<h3 class="rs-book__t"><a href="' + attr(href) + '">' + esc(b.title || 'Untitled') + '</a></h3>' +
      (b.author ? '<p class="rs-book__by">' + esc(b.author) + '</p>' : '') +
      formatPills(b.formats) +
      (b.note ? '<p class="rs-book__note">' + esc(b.note) + '</p>' : '') +
      bookState(b) +
      outLink(b.url) +
    '</article>';
  }

  var BOOK_TABS = [
    { key: 'all', label: 'All' },
    { key: 'reading', label: 'Reading' },
    { key: 'read', label: 'Read' },
    { key: 'want', label: 'To read' }
  ];

  function viewBooks(state) {
    var all = D().Books.list();
    var filter = state.filter || 'all';
    var rows = all.filter(function (b) { return filter === 'all' || b.status === filter; });
    rows = sortBooks(rows, state.sort);

    return shortHero({ eyebrow: 'The Resource Studio', title: 'Books' }) +
      '<section class="hd-band hd-night">' +
        intro('books') +
        tabs(BOOK_TABS, filter, '#/books', countBy(all, 'status')) +
        util(rows.length, all.length, 'book', state.sort, [
          { v: 'recent', label: 'Recently added' },
          { v: 'title', label: 'By title' },
          { v: 'author', label: 'By author' },
          { v: 'read', label: 'Recently read' }
        ]) +
        (rows.length
          ? '<div class="rs-shelf">' + rows.map(bookCard).join('') + '</div>'
          : emptyShelf('book', filter)) +
      '</section>';
  }

  function sortBooks(rows, sort) {
    var out = rows.slice();
    if (sort === 'title') out.sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (sort === 'author') out.sort(function (a, b) { return a.author.localeCompare(b.author) || a.title.localeCompare(b.title); });
    else if (sort === 'read') out.sort(function (a, b) { return String(b.readAt).localeCompare(String(a.readAt)); });
    else out.sort(D().byNewest);
    return out;
  }

  // ═══ §VIDEOS ═══════════════════════════════════════════════

  function isNew(rec) {
    var t = Date.parse(String(rec.createdAt || ''));
    return isFinite(t) && (Date.now() - t) < 7 * 24 * 3600 * 1000;
  }

  function videoCard(v, i) {
    var href = D().hrefOf('video', v.id);
    var meta = [v.views ? v.views + ' views' : '', v.publishedAt || D().ago(v.createdAt)]
      .filter(Boolean).join(' · ');
    return '<article class="rs-vid ' + U().rvlClass() + '"' + U().rvlStyle(i) + '>' +
      '<a class="rs-vid__hit" href="' + attr(href) + '">' +
        '<span class="rs-vid__art">' +
          coverArt('video', v, 'rs-vid') +
          (isNew(v) ? '<span class="rs-vid__new">New</span>' : '') +
          (v.duration ? '<span class="rs-vid__dur">' + esc(v.duration) + '</span>' : '') +
          '<span class="rs-vid__play" aria-hidden="true">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M8.5 5.6 18 12l-9.5 6.4z"/></svg></span>' +
          (v.status === 'watched' ? '<span class="rs-vid__done" aria-hidden="true">' + checkGlyph() + '</span>' : '') +
        '</span>' +
        '<span class="rs-vid__say">' +
          '<span class="rs-vid__t">' + esc(v.title || 'Untitled') + '</span>' +
          (v.channel ? '<span class="rs-vid__ch">' + esc(v.channel) + '</span>' : '') +
          (meta ? '<span class="rs-vid__meta">' + esc(meta) + '</span>' : '') +
        '</span>' +
      '</a>' +
    '</article>';
  }

  var VIDEO_TABS = [
    { key: 'all', label: 'All' },
    { key: 'queued', label: 'Queued' },
    { key: 'watching', label: 'Watching' },
    { key: 'watched', label: 'Watched' }
  ];

  function viewVideos(state) {
    var all = D().Videos.list();
    var filter = state.filter || 'all';
    var rows = all.filter(function (v) { return filter === 'all' || v.status === filter; });
    rows = state.sort === 'title'
      ? rows.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
      : state.sort === 'channel'
        ? rows.slice().sort(function (a, b) { return a.channel.localeCompare(b.channel) || a.title.localeCompare(b.title); })
        : rows.slice().sort(D().byNewest);

    return shortHero({ eyebrow: 'The Resource Studio', title: 'YouTube Videos' }) +
      '<section class="hd-band hd-night">' +
        intro('videos') +
        tabs(VIDEO_TABS, filter, '#/videos', countBy(all, 'status')) +
        util(rows.length, all.length, 'video', state.sort, [
          { v: 'recent', label: 'Recently added' },
          { v: 'title', label: 'By title' },
          { v: 'channel', label: 'By channel' }
        ]) +
        (rows.length
          ? '<div class="rs-tube">' + rows.map(videoCard).join('') + '</div>'
          : emptyShelf('video', filter)) +
      '</section>';
  }

  // ═══ §ARTICLES ═════════════════════════════════════════════
  // The one two-column view. The feed rows reuse the vault's
  // .hd-feed vocabulary wholesale — it was built from this same
  // reference's anatomy — and this layer adds only the sidebar.

  function articleRow(a, i) {
    var href = D().hrefOf('article', a.id);
    var who = a.author || a.source || '';
    var initial = (who || a.title || '?').trim().charAt(0).toUpperCase();
    var when = a.publishedAt ? D().shortDate(a.publishedAt) : D().ago(a.createdAt);
    var mins = a.minutes ? a.minutes + ' min read' : '';
    return '<div class="hd-feed__row ' + U().rvlClass() + '"' + U().rvlStyle(i) + '>' +
      '<a class="hd-feed__hit" href="' + attr(href) + '">' +
        '<span class="hd-feed__say">' +
          (a.label ? '<span class="hd-eyebrow">' + esc(a.label) + '</span>' : '') +
          '<span class="hd-feed__t">' + esc(a.title || 'Untitled') + '</span>' +
          (a.excerpt || a.deck
            ? '<span class="hd-feed__x">' + esc(a.excerpt || a.deck) + '</span>' : '') +
          '<span class="hd-feed__by">' +
            '<span class="hd-feed__av" aria-hidden="true">' + esc(initial) + '</span>' +
            (who ? '<span class="hd-feed__who">' + esc(who) + '</span>' : '') +
            (when ? '<i>' + esc(when) + '</i>' : '') +
            (mins ? '<i>' + esc(mins) + '</i>' : '') +
            (a.status === 'unread' ? '<i class="rs-unread">Unread</i>' : '') +
          '</span>' +
        '</span>' +
        '<span class="hd-feed__art' + (a.cover ? '' : ' hd-feed__art--none') + '">' +
          (a.cover
            ? '<img src="' + attr(a.cover) + '" alt="" loading="lazy" decoding="async">' +
              '<span class="hd-feed__tint"></span>'
            : sig('sg-doc', 22)) +
        '</span>' +
      '</a>' +
    '</div>';
  }

  function viewArticles(state) {
    var all = D().Articles.list();
    var topicId = state.topic || '';
    var rows = all;
    if (topicId) {
      var keep = {};
      D().Links.list().forEach(function (l) {
        if (l.topicId === topicId && l.itemType === 'article') keep[l.itemId] = 1;
      });
      rows = rows.filter(function (a) { return keep[a.id]; });
    }
    rows = rows.slice().sort(D().byNewest);

    var topics = D().Topics.list().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var chips = '<div class="rs-chips" role="tablist" aria-label="Topics">' +
      '<a class="rs-chip' + (topicId ? '' : ' is-on') + '" href="#/articles">All</a>' +
      topics.map(function (t) {
        return '<a class="rs-chip' + (t.id === topicId ? ' is-on' : '') +
          '" href="#/articles/' + encodeURIComponent(t.id) + '">' + esc(t.name) + '</a>';
      }).join('') +
    '</div>';

    var banner =
      '<div class="hd-feed__banner">' +
        '<span class="hd-feed__grain" aria-hidden="true"></span>' +
        '<div class="hd-feed__banner-say">' +
          '<p class="hd-feed__hl">Find the writing you kept,<br>and finish what you started.</p>' +
        '</div>' +
        '<button type="button" class="hd-feed__cta" data-act="add" data-type="article">' +
          'Save an article</button>' +
      '</div>';

    return shortHero({ eyebrow: 'The Resource Studio', title: 'Articles' }) +
      '<section class="hd-band hd-night">' +
        intro('articles') +
        '<div class="rs-arts">' +
          '<div class="rs-arts__main">' +
            banner + chips +
            (rows.length
              ? '<div class="hd-feed__list">' + rows.map(articleRow).join('') + '</div>'
              : emptyShelf('article', topicId ? 'topic' : '')) +
          '</div>' +
          '<aside class="rs-side" aria-label="Around the articles">' +
            sourcesPanel() + topicsPanel(topicId) + readingListPanel() +
          '</aside>' +
        '</div>' +
      '</section>';
  }

  function sourcesPanel() {
    var rows = D().sources().slice(0, 6);
    if (!rows.length) return '';
    return '<section class="rs-panel">' +
      '<h2 class="rs-panel__t">' + sig('sg-quill', 14) + 'Sources</h2>' +
      '<ul class="rs-src">' + rows.map(function (s) {
        return '<li class="rs-src__row">' +
          '<span class="hd-feed__av" aria-hidden="true">' + esc(s.name.charAt(0).toUpperCase()) + '</span>' +
          '<span class="rs-src__in"><b>' + esc(s.name) + '</b><i>' + esc(s.kind) + '</i></span>' +
          '<span class="rs-src__n">' + s.n + '</span>' +
        '</li>';
      }).join('') + '</ul>' +
    '</section>';
  }

  function topicsPanel(current) {
    var rows = D().Topics.list()
      .map(function (t) { return { t: t, n: D().topicCount(t.id) }; })
      .sort(function (a, b) { return b.n - a.n || a.t.name.localeCompare(b.t.name); })
      .slice(0, 10);
    if (!rows.length) return '';
    return '<section class="rs-panel">' +
      '<h2 class="rs-panel__t">' + sig('sg-tag', 14) + 'Topics</h2>' +
      '<div class="rs-chips rs-chips--tight">' + rows.map(function (x) {
        return '<a class="rs-chip' + (x.t.id === current ? ' is-on' : '') +
          '" href="#/articles/' + encodeURIComponent(x.t.id) + '">' + esc(x.t.name) +
          '<i>' + x.n + '</i></a>';
      }).join('') + '</div>' +
      '<a class="hd-link hd-link--quiet" href="#/collections">' + arrow('Every topic') + '</a>' +
    '</section>';
  }

  function readingListPanel() {
    var rows = D().Articles.list()
      .filter(function (a) { return a.status !== 'read'; })
      .sort(D().byNewest).slice(0, 4);
    if (!rows.length) return '';
    return '<section class="rs-panel">' +
      '<h2 class="rs-panel__t">' + sig('sg-book', 14) + 'Reading list</h2>' +
      '<ul class="rs-read">' + rows.map(function (a) {
        return '<li><a class="rs-read__row" href="' + attr(D().hrefOf('article', a.id)) + '">' +
          '<span class="rs-read__in">' +
            (a.label ? '<i>' + esc(a.label) + '</i>' : '') +
            '<b>' + esc(a.title || 'Untitled') + '</b>' +
          '</span>' +
          '<span class="rs-read__art">' +
            (a.cover ? '<img src="' + attr(a.cover) + '" alt="" loading="lazy">' : sig('sg-doc', 16)) +
          '</span>' +
        '</a></li>';
      }).join('') + '</ul>' +
    '</section>';
  }

  // ═══ §COLLECTIONS ══════════════════════════════════════════

  function topicCard(t, n, i) {
    var items = D().itemsForTopic(t.id);
    var covers = []
      .concat(items.book.map(function (r) { return D().bookCover(r); }))
      .concat(items.video.map(function (r) { return D().videoCover(r); }))
      .concat(items.article.map(function (r) { return r.cover; }))
      .filter(Boolean).slice(0, 4);
    var art = covers.length
      ? covers.map(function (src) {
          return '<img src="' + attr(src) + '" alt="" loading="lazy" onerror="this.remove()">';
        }).join('')
      : '<span class="hd-col__none"></span>';
    // ONE style attribute. rvlStyle() already emits one, and a tag
    // carrying two silently keeps the first — the exact trap
    // asclepion-ui.js split rvlClass from rvlStyle to avoid. The
    // tint is merged into it rather than added beside it.
    var style = U().rvlStyle(i).replace(/^ style="/, '').replace(/"$/, '');
    if (t.tint) style += ';--rs-tint:' + t.tint;
    return '<a class="hd-col ' + U().rvlClass() + '" style="' + attr(style) + '"' +
      ' href="#/collection/' + encodeURIComponent(t.id) + '">' +
      '<span class="hd-col__art">' + art + '</span>' +
      '<span class="hd-col__in">' +
        '<b>' + esc(t.name) + '</b>' +
        '<i>' + esc(t.kind) + ' · ' + n + (n === 1 ? ' thing' : ' things') + '</i>' +
      '</span>' +
      arrow('') +
    '</a>';
  }

  function viewCollections() {
    var rows = D().Topics.list()
      .map(function (t) { return { t: t, n: D().topicCount(t.id) }; })
      .sort(function (a, b) {
        return (b.t.pinned ? 1 : 0) - (a.t.pinned ? 1 : 0) ||
          b.n - a.n || a.t.name.localeCompare(b.t.name);
      });

    return shortHero({ eyebrow: 'The Resource Studio', title: 'Collections' }) +
      '<section class="hd-band hd-night">' +
        intro('collections') +
        '<div class="hd-util">' +
          '<span class="hd-util__n">' + rows.length + (rows.length === 1 ? ' topic' : ' topics') + '</span>' +
          '<span class="hd-util__sp"></span>' +
          '<button type="button" class="hd-util__b" data-act="add" data-type="topic">＋ New topic</button>' +
        '</div>' +
        (rows.length
          ? '<div class="hd-cols">' + rows.map(function (x, i) { return topicCard(x.t, x.n, i); }).join('') + '</div>'
          : '<div class="hd-empty"><strong>No topics yet.</strong>' +
            'A topic is the thread between things — the idea that turns up in a book, ' +
            'a talk and an essay. Make the first one and start tying them together.</div>') +
      '</section>';
  }

  // ── one topic ──────────────────────────────────────────────
  function viewCollection(state) {
    var t = D().Topics.get(state.topicId);
    if (!t) return notFound('That topic is not here', '#/collections', 'All collections');
    var items = D().itemsForTopic(t.id);
    var notes = D().getText('notes', 'topic', t.id);

    function group(type, rows, title) {
      if (!rows.length) return '';
      return '<div class="rs-group">' +
        '<h2 class="hd-eyebrow hd-eyebrow--rule">' + esc(title) + '</h2>' +
        '<div class="hd-grid">' +
          rows.sort(D().byNewest).map(function (r, i) { return itemCard(type, r, i); }).join('') +
        '</div>' +
      '</div>';
    }

    var total = items.book.length + items.video.length + items.article.length;

    return shortHero({
      back: { href: '#/collections', label: 'Collections' },
      eyebrow: t.kind, title: t.name, caption: t.blurb
    }) +
    '<section class="hd-band hd-night">' +
      '<div class="hd-util">' +
        '<span class="hd-util__n">' + total + (total === 1 ? ' thing' : ' things') + '</span>' +
        '<span class="hd-util__sp"></span>' +
        '<button type="button" class="hd-util__b" data-act="edit-topic" data-id="' + attr(t.id) + '">Edit</button>' +
        '<button type="button" class="hd-util__b" data-act="delete-topic" data-id="' + attr(t.id) + '">Delete</button>' +
      '</div>' +
      '<div class="rs-panel rs-panel--wide">' +
        '<h2 class="rs-panel__t">' + sig('sg-quill', 14) + 'What this is about</h2>' +
        editor('notes', 'topic', t.id, notes, 'What is the thread here? Why does it keep coming up?') +
      '</div>' +
      (total
        ? group('book', items.book, 'Books') + group('video', items.video, 'Videos') +
          group('article', items.article, 'Articles')
        : '<div class="hd-empty"><strong>Nothing is filed here yet.</strong>' +
          'Open a book, a video or an article and add this topic from its Topics tab.</div>') +
    '</section>';
  }

  // ═══ §ABOUT ════════════════════════════════════════════════

  function viewAbout() {
    var c = D().counts();
    var words = 0;
    D().Articles.list().forEach(function (a) { words += R().wordCount(D().getText('body', 'article', a.id)); });
    D().Chapters.list().forEach(function (ch) { words += R().wordCount(D().getText('body', 'chapter', ch.id)); });

    return shortHero({ eyebrow: 'The Resource Studio', title: 'About' }) +
      '<section class="hd-band hd-night">' +
        intro('about') +
        numbers(c) +
        '<div class="hd-about__two">' +
          '<div class="hd-panel">' +
            '<p class="hd-eyebrow">What is kept</p>' +
            '<p class="hd-prose">Every book, video and article here holds its own overview, ' +
            'notes, description, transcript, questions and topics. The writing is stored ' +
            'whole — images, links and embedded video included — so nothing depends on ' +
            'the page it came from still being there.</p>' +
            '<div class="hd-scale">' +
              scaleRow('Books', c.books, Math.max(1, c.books + c.videos + c.articles)) +
              scaleRow('Videos', c.videos, Math.max(1, c.books + c.videos + c.articles)) +
              scaleRow('Articles', c.articles, Math.max(1, c.books + c.videos + c.articles)) +
            '</div>' +
            '<p class="hd-note">' + words.toLocaleString() + ' words of transcript and article ' +
            'text, across ' + c.chapters + ' chapters.</p>' +
          '</div>' +
          '<div class="hd-panel">' +
            '<p class="hd-eyebrow">Your data</p>' +
            '<p class="hd-prose">Two rows on your own database: the library, and the ' +
            'writing inside it. Both are backed up nightly and both can be exported ' +
            'from here at any time.</p>' +
            '<div class="asc-sheet__acts">' +
              '<button type="button" class="asc-btn asc-btn--sm" data-act="export">Export everything</button>' +
              '<button type="button" class="asc-btn asc-btn--sm" data-act="starter">Load a starter library</button>' +
            '</div>' +
            '<p class="hd-note">The starter library adds eight books with notes and topics ' +
            'already attached, so an empty studio has something to read. Delete any of ' +
            'them the way you would delete your own.</p>' +
          '</div>' +
        '</div>' +
      '</section>' +
      credoBand(c);
  }

  function scaleRow(label, n, total) {
    var pct = Math.round((n / total) * 100);
    return '<div class="hd-scale__row">' +
      '<span>' + esc(label) + '</span>' +
      '<span class="hd-scale__t"><i style="--w:' + pct + '%"></i></span>' +
      '<b>' + n + '</b>' +
    '</div>';
  }

  // ═══ §SHARED FURNITURE ═════════════════════════════════════

  function countBy(rows, field) {
    var m = { all: rows.length };
    rows.forEach(function (r) { m[r[field]] = (m[r[field]] || 0) + 1; });
    return m;
  }

  function tabs(defs, current, base, counts) {
    return '<nav class="hd-tabs rs-tabs" aria-label="Filter">' + defs.map(function (t) {
      var href = t.key === 'all' ? base : base + '/' + t.key;
      var n = counts ? counts[t.key] : null;
      return '<a class="hd-tab' + (t.key === current ? ' is-on' : '') + '" href="' + attr(href) + '"' +
        (t.key === current ? ' aria-current="page"' : '') + '>' + esc(t.label) +
        (n ? '<i>' + n + '</i>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  function util(shown, total, noun, sort, options) {
    var label = shown === total
      ? shown + ' ' + (shown === 1 ? noun : noun + 's')
      : shown + ' of ' + total;
    return '<div class="hd-util">' +
      '<span class="hd-util__n">' + esc(label) + '</span>' +
      '<span class="hd-util__sp"></span>' +
      '<span class="hd-util__sel"><label class="hd-sr" for="rsSort">Sort</label>' +
        '<select id="rsSort" data-act="sort">' + options.map(function (o) {
          return '<option value="' + attr(o.v) + '"' +
            ((sort || 'recent') === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select></span>' +
      '<button type="button" class="hd-util__b" data-act="add" data-type="' + attr(noun) + '">＋ Add</button>' +
    '</div>';
  }

  var EMPTY_COPY = {
    book: { t: 'The shelf is empty.', p: 'Add a book and it gets a page of its own — an overview, your notes, the description, the transcript in chapters, questions, and the topics it belongs to.' },
    video: { t: 'No videos yet.', p: 'Paste a YouTube link. The title, channel and thumbnail fill themselves in, and the transcript gets a home — whole, and organized by timestamp.' },
    article: { t: 'Nothing saved yet.', p: 'Paste an article and it is kept whole: the words, the pictures, the links and any video that came with it.' }
  };

  function emptyShelf(type, filter) {
    if (filter && filter !== 'all') {
      return '<div class="hd-empty"><strong>Nothing here under that filter.</strong>' +
        'Everything else is still on the shelf.</div>';
    }
    var c = EMPTY_COPY[type];
    return '<div class="hd-empty"><strong>' + esc(c.t) + '</strong>' + esc(c.p) +
      '<span class="rs-emptyacts">' +
        '<button type="button" class="asc-btn asc-btn--primary asc-btn--sm" data-act="add" ' +
          'data-type="' + attr(type) + '">Add the first one</button>' +
        (type === 'book'
          ? '<button type="button" class="asc-btn asc-btn--sm" data-act="starter">Load a starter library</button>'
          : '') +
      '</span></div>';
  }

  function notFound(msg, href, label) {
    return shortHero({ eyebrow: 'Not here', title: 'Nothing at this address' }) +
      '<section class="hd-band hd-night">' +
        '<div class="hd-empty"><strong>' + esc(msg) + '</strong>' +
        'It may have been deleted, or the link may be older than the record.' +
        '<span class="rs-emptyacts">' +
          '<a class="asc-btn asc-btn--sm" href="' + attr(href) + '">' + esc(label) + '</a>' +
        '</span></div>' +
      '</section>';
  }

  // The one writing surface, used by every panel that holds prose.
  // The toolbar belongs to the editor rather than to the page, so
  // two editors on one screen never fight over which is being
  // formatted.
  function editor(slot, type, id, html, placeholder) {
    var scope = slot + ':' + type + ':' + id;
    return '<div class="rs-ed">' +
      R().toolbarHtml(scope) +
      '<div class="rs-ed__box hd-art__body' + (R().isEmptyHtml(html) ? ' is-empty' : '') + '" ' +
        'contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" ' +
        'data-rich="' + attr(scope) + '" data-ph="' + attr(placeholder || 'Write something') + '">' +
        R().renderBody(html) +
      '</div>' +
    '</div>';
  }

  global.ResViews = {
    viewHome: viewHome, viewBooks: viewBooks, viewVideos: viewVideos,
    viewArticles: viewArticles, viewCollections: viewCollections,
    viewCollection: viewCollection, viewAbout: viewAbout,
    // shared with resource-item.js
    shortHero: shortHero, heroArt: heroArt, itemCard: itemCard, editor: editor,
    sig: sig, arrow: arrow, orn: orn, extGlyph: extGlyph, checkGlyph: checkGlyph,
    coverArt: coverArt, formatPills: formatPills, outLink: outLink,
    notFound: notFound, sectionHead: sectionHead, typeLabel: typeLabel,
    numbers: numbers, tabs: tabs
  };
})(window);
