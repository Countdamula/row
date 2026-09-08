// =============================================================
// resource-item.js — the item page. One template, three heads.
//
// THE ANATOMY IS THE CREATICA REFERENCE, MINUS ITS LEFT SIDEBAR:
//
//   breadcrumb
//   the media block          the cover / the player / the picture
//   the title row            with the actions at its right
//   the meta row             two cards: who made it, and the facts
//   THE TAB STRIP            with a count on every tab that has one
//   the panel
//
// AN ARTICLE PUTS THAT ORDER SLIGHTLY DIFFERENTLY, on purpose and
// on Damian's instruction: eyebrow, headline, deck, the author
// line, THEN the cover photograph, and the tab strip directly
// underneath it. That is the Ink & Ideas reference's own order
// with this studio's bar added where he asked for it.
//
// THE TAB IS IN THE HASH — #/book/<id>/notes. Three things follow
// and all three are the point: the back button walks the tabs, a
// tab can be linked to, and a cloud repaint cannot move you off
// the panel you are typing in. res:uiState remembers the last tab
// per item, so returning to a book you were annotating opens on
// the notes rather than on the overview.
//
// NOTHING HERE WRITES TO STORAGE. This file builds strings;
// resource-app.js owns every listener, every write and the one
// place an <iframe> is ever created.
// =============================================================

(function (global) {
  'use strict';

  function U() { return global.AscUI; }
  function D() { return global.Resource; }
  function R() { return global.ResRich; }
  function V() { return global.ResViews; }
  function esc(s) { return U().esc(s); }
  function attr(s) { return U().attr(s); }
  function sig(id, n) { return V().sig(id, n); }

  // ═══ §THE TABS ═════════════════════════════════════════════
  // Exactly what Damian asked for, per kind. A video gets two
  // transcripts because a spoken transcript is useful twice: once
  // whole, to search and to copy, and once organized, to navigate.

  var TABS = {
    book: [
      { key: 'overview',   label: 'Overview' },
      { key: 'notes',      label: 'Notes' },
      { key: 'description', label: 'Description' },
      { key: 'transcript', label: 'Transcript' },
      { key: 'qa',         label: 'Q&A' },
      { key: 'topics',     label: 'Topics' }
    ],
    video: [
      { key: 'overview',   label: 'Overview' },
      { key: 'notes',      label: 'Notes' },
      { key: 'description', label: 'Description' },
      { key: 'transcript', label: 'Transcript' },
      { key: 'organized',  label: 'Organized' },
      { key: 'qa',         label: 'Q&A' },
      { key: 'topics',     label: 'Topics' }
    ],
    article: [
      { key: 'overview',   label: 'Overview' },
      { key: 'notes',      label: 'Notes' },
      { key: 'description', label: 'Description' },
      { key: 'article',    label: 'Article' },
      { key: 'qa',         label: 'Q&A' },
      { key: 'topics',     label: 'Topics' }
    ]
  };

  function tabKeys(type) {
    return TABS[type].map(function (t) { return t.key; });
  }
  // Which tab a route resolves to: the hash first, then what this
  // item was last left on, then the one the kind opens best on —
  // an article opens on the article.
  function defaultTab(type) { return type === 'article' ? 'article' : 'overview'; }
  function resolveTab(type, wanted, id) {
    if (wanted && tabKeys(type).indexOf(wanted) >= 0) return wanted;
    var last = D().lastTab(type, id);
    if (last && tabKeys(type).indexOf(last) >= 0) return last;
    return defaultTab(type);
  }

  // 1240 reads as 1.2K on a tab and as noise at full length.
  function shortN(n) {
    if (!n) return '';
    if (n < 1000) return String(n);
    if (n < 10000) return (Math.round(n / 100) / 10) + 'K';
    return Math.round(n / 1000) + 'K';
  }

  function tabCount(type, id, key) {
    var words = function (slot) { return R().wordCount(D().getText(slot, type, id)); };
    switch (key) {
      case 'notes': return shortN(words('notes'));
      case 'description': return shortN(words('desc'));
      case 'qa': return String(D().qaFor(type, id).length || '');
      case 'topics': return String(D().topicsFor(type, id).length || '');
      case 'article': return shortN(R().wordCount(D().getText('body', 'article', id)));
      case 'organized': return String(D().getRows('tro', 'video', id).length || '');
      case 'transcript':
        if (type === 'book') return String(D().chaptersFor(id).length || '');
        return shortN(String(D().getText('tr', 'video', id) || '').split(/\s+/).filter(Boolean).length);
      default: return '';
    }
  }

  function tabStrip(type, id, current) {
    return '<nav class="rs-tabs2" aria-label="This ' + esc(type)  + '">' +
      TABS[type].map(function (t) {
        var n = tabCount(type, id, t.key);
        return '<a class="rs-tab2' + (t.key === current ? ' is-on' : '') + '" href="' +
          attr(itemHref(type, id, t.key)) + '"' +
          (t.key === current ? ' aria-current="page"' : '') + '>' +
          esc(t.label) + (n ? '<i>' + esc(n) + '</i>' : '') + '</a>';
      }).join('') +
    '</nav>';
  }

  function itemHref(type, id, tab) {
    return '#/' + type + '/' + encodeURIComponent(id) + (tab ? '/' + tab : '');
  }

  // ═══ §THE CHROME AROUND THE PANEL ══════════════════════════

  var CRUMB = {
    book: { href: '#/books', label: 'Books' },
    video: { href: '#/videos', label: 'YouTube Videos' },
    article: { href: '#/articles', label: 'Articles' }
  };

  function crumb(type, title) {
    var c = CRUMB[type];
    return '<nav class="rs-crumb" aria-label="Breadcrumb">' +
      '<a href="#/">Home</a><span aria-hidden="true">/</span>' +
      '<a href="' + attr(c.href) + '">' + esc(c.label) + '</a><span aria-hidden="true">/</span>' +
      '<b>' + esc(title || 'Untitled') + '</b>' +
    '</nav>';
  }

  function iconBtn(act, id, label, glyph, on) {
    return '<button type="button" class="rs-act' + (on ? ' is-on' : '') + '" data-act="' + attr(act) +
      '" data-id="' + attr(id) + '" title="' + attr(label) + '" aria-label="' + attr(label) +
      '" aria-pressed="' + (on ? 'true' : 'false') + '">' + glyph + '</button>';
  }

  var GLYPH = {
    star: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M8 1.9 10 6l4.5.65-3.25 3.2.77 4.5L8 12.2 3.98 14.35l.77-4.5L1.5 6.65 6 6Z"/></svg>',
    edit: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.1 2.4 13.6 4.9 5.6 12.9 2.4 13.6 3.1 10.4Z"/></svg>',
    share: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12.2" cy="3.6" r="1.9"/><circle cx="3.8" cy="8" r="1.9"/><circle cx="12.2" cy="12.4" r="1.9"/><path d="M5.5 7.1 10.5 4.5M5.5 8.9l5 2.6"/></svg>',
    trash: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.2h10.4M6.4 4.2V2.6h3.2v1.6M4.2 4.2l.6 9h6.4l.6-9M6.6 6.6v4.2M9.4 6.6v4.2"/></svg>'
  };

  function actions(type, rec) {
    return '<div class="rs-acts">' +
      iconBtn('star', rec.id, rec.featured ? 'Remove from favourites' : 'Add to favourites', GLYPH.star, rec.featured) +
      iconBtn('edit', rec.id, 'Edit the details', GLYPH.edit, false) +
      iconBtn('share', rec.id, 'Copy a link to this page', GLYPH.share, false) +
      iconBtn('delete', rec.id, 'Delete', GLYPH.trash, false) +
    '</div>';
  }

  // ── the status control ─────────────────────────────────────
  // Three or four states, drawn as a segmented control rather than
  // a dropdown: it is the one field on this page that gets changed
  // often, and a select hides its own options.
  var STATES = {
    book: [
      { v: 'want', label: 'To read' },
      { v: 'reading', label: 'Reading' },
      { v: 'read', label: 'Read' },
      { v: 'shelved', label: 'Set aside' }
    ],
    video: [
      { v: 'queued', label: 'Queued' },
      { v: 'watching', label: 'Watching' },
      { v: 'watched', label: 'Watched' }
    ],
    article: [
      { v: 'unread', label: 'Unread' },
      { v: 'reading', label: 'Reading' },
      { v: 'read', label: 'Read' }
    ]
  };

  function statusControl(type, rec) {
    return '<div class="rs-seg" role="group" aria-label="Status">' +
      STATES[type].map(function (s) {
        return '<button type="button" class="rs-seg__b' + (rec.status === s.v ? ' is-on' : '') +
          '" data-act="status" data-id="' + attr(rec.id) + '" data-v="' + attr(s.v) + '"' +
          (rec.status === s.v ? ' aria-current="true"' : '') + '>' + esc(s.label) + '</button>';
      }).join('') +
    '</div>';
  }

  // ── the two meta cards ─────────────────────────────────────
  function whoCard(type, rec) {
    var name = D().subtitleOf(type, rec);
    var role = type === 'video' ? 'Channel' : type === 'book' ? 'Author' : (rec.source ? 'Writing in ' + rec.source : 'Author');
    var initial = (name || rec.title || '?').trim().charAt(0).toUpperCase();
    return '<div class="rs-who">' +
      '<span class="rs-who__av" aria-hidden="true">' + esc(initial) + '</span>' +
      '<span class="rs-who__in">' +
        '<b>' + esc(name || 'Unknown') + '</b>' +
        '<i>' + esc(role) + '</i>' +
      '</span>' +
      '<span class="rs-who__acts">' +
        (rec.url
          ? '<a class="asc-btn asc-btn--primary asc-btn--sm" href="' + attr(rec.url) +
            '" target="_blank" rel="noopener noreferrer">Open on ' +
            esc(D().siteName(rec.url) || 'the web') + V().extGlyph() + '</a>'
          : '<button type="button" class="asc-btn asc-btn--sm" data-act="edit" data-id="' +
            attr(rec.id) + '">Add a link</button>') +
      '</span>' +
    '</div>';
  }

  function factsCard(type, rec) {
    var bits = [];
    if (type === 'book') {
      if (rec.pages) bits.push(rec.pages + ' pages');
      if (rec.year) bits.push(rec.year);
      if (rec.publisher) bits.push(rec.publisher);
      if (rec.readAt) bits.push('Read ' + D().shortDate(rec.readAt));
    } else if (type === 'video') {
      if (rec.duration) bits.push(rec.duration);
      if (rec.views) bits.push(rec.views + ' views');
      if (rec.publishedAt) bits.push(rec.publishedAt);
    } else {
      if (rec.minutes) bits.push(rec.minutes + ' min read');
      if (rec.publishedAt) bits.push(D().shortDate(rec.publishedAt) || rec.publishedAt);
      if (rec.source) bits.push(rec.source);
    }
    bits.push('Saved ' + D().ago(rec.createdAt));

    var desc = R().htmlToText(D().getText('desc', type, rec.id)) || rec.note || rec.deck || '';
    return '<div class="rs-facts">' +
      '<p class="rs-facts__line">' + bits.map(function (b) {
        return '<span>' + esc(b) + '</span>';
      }).join('<span class="rs-facts__dot" aria-hidden="true"></span>') + '</p>' +
      (desc
        ? '<p class="rs-facts__d" data-act="more" tabindex="0" role="button">' + esc(desc) +
          '<span class="rs-facts__more">More</span></p>'
        : '<p class="rs-facts__d is-none">No description yet. ' +
          '<button type="button" class="rs-inline" data-act="go-tab" data-tab="description">Write one</button></p>') +
      statusControl(type, rec) +
    '</div>';
  }

  // ═══ §THE MEDIA BLOCK ══════════════════════════════════════

  // A portrait cover in a landscape frame, on a wash made from
  // the cover itself — the same trick a music player uses, and
  // the honest answer to "what fills the other two thirds". No
  // cover at all falls back to the drawn mark rather than to a
  // grey rectangle.
  function bookMedia(b) {
    var src = D().bookCover(b);
    return '<div class="rs-media rs-media--book' + (src ? '' : ' is-bare') + '">' +
      // The mark is always drawn, underneath. A cover that 404s
      // reveals it rather than leaving an empty plate; the wash goes
      // with it, because a wash made from an image that did not load
      // is a black rectangle.
      '<span class="rs-media__none">' + sig('sg-book', 46) + '</span>' +
      (src
        ? '<span class="rs-media__wash" style="background-image:url(' + attr(src) + ')" aria-hidden="true"></span>' +
          '<img class="rs-media__cover" src="' + attr(src) + '" alt="' + attr(b.title) +
          '" decoding="async" onerror="this.closest(\'.rs-media\').classList.add(\'is-bare\');this.remove()">'
        : '') +
      (src ? '<span class="rs-media__veil" aria-hidden="true"></span>' : '') +
      '<button type="button" class="rs-media__set" data-act="cover" data-id="' + attr(b.id) +
        '" data-type="book">' + (src ? 'Change the cover' : 'Add a cover') + '</button>' +
    '</div>';
  }

  // NOTHING IS REQUESTED FROM YOUTUBE UNTIL THIS IS CLICKED. The
  // still is served from i.ytimg.com, which is one image; the
  // player is a whole third-party document and it loads when it
  // is asked for. resource-app.js is the only place that ever
  // creates the iframe.
  function videoMedia(v) {
    var thumb = D().videoCover(v, true);
    if (!v.videoId && !thumb) {
      return '<div class="rs-media rs-media--video is-bare">' +
        '<span class="rs-media__none">' + sig('sg-play', 46) + '</span>' +
        '<button type="button" class="rs-media__set" data-act="edit" data-id="' + attr(v.id) +
          '">Add a YouTube link</button>' +
      '</div>';
    }
    return '<div class="rs-media rs-media--video" id="rsPlayer" data-yt="' + attr(v.videoId) + '">' +
      '<button type="button" class="rs-media__play" data-act="play" data-id="' + attr(v.id) + '">' +
        (thumb
          ? '<img class="rs-media__still" src="' + attr(thumb) + '" alt="" decoding="async" ' +
            'onerror="this.src=\'' + attr(D().youtubeThumb(v.videoId)) + '\'">'
          : '<span class="rs-media__none">' + sig('sg-play', 46) + '</span>') +
        '<span class="rs-media__scrim" aria-hidden="true"></span>' +
        '<span class="rs-media__glyph" aria-hidden="true">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">' +
          '<path d="M8.5 5.6 18 12l-9.5 6.4z"/></svg></span>' +
        '<span class="rs-media__cta">Play' + (v.duration ? ' · ' + esc(v.duration) : '') + '</span>' +
      '</button>' +
    '</div>';
  }

  function articleCover(a) {
    if (!a.cover) {
      return '<button type="button" class="rs-cover rs-cover--none" data-act="cover" ' +
        'data-id="' + attr(a.id) + '" data-type="article">' +
        sig('sg-doc', 30) + '<span>Add a cover photo</span></button>';
    }
    return '<figure class="rs-cover">' +
      '<img src="' + attr(a.cover) + '" alt="" decoding="async">' +
      '<span class="rs-cover__tint" aria-hidden="true"></span>' +
      '<button type="button" class="rs-media__set" data-act="cover" data-id="' + attr(a.id) +
        '" data-type="article">Change the cover</button>' +
    '</figure>';
  }

  // ═══ §THE PANELS ═══════════════════════════════════════════

  function panelHead(title, sub, acts) {
    return '<div class="rs-ph">' +
      '<div><h2 class="rs-ph__t">' + esc(title) + '</h2>' +
      (sub ? '<p class="rs-ph__s">' + esc(sub) + '</p>' : '') + '</div>' +
      (acts ? '<div class="rs-ph__acts">' + acts + '</div>' : '') +
    '</div>';
  }

  function btn(act, label, cls, data) {
    var d = '';
    Object.keys(data || {}).forEach(function (k) { d += ' data-' + k + '="' + attr(data[k]) + '"'; });
    return '<button type="button" class="asc-btn asc-btn--sm' + (cls ? ' ' + cls : '') +
      '" data-act="' + attr(act) + '"' + d + '>' + label + '</button>';
  }

  // ── overview ───────────────────────────────────────────────
  function panelOverview(type, rec) {
    var topics = D().topicsFor(type, rec.id);
    return '<div class="rs-panelbody">' +
      panelHead('Overview', 'The short version — what this is, and why it is here.') +
      V().editor('over', type, rec.id, D().getText('over', type, rec.id),
        'What is worth remembering about this?') +
      '<div class="rs-two">' +
        '<div class="rs-panel">' +
          '<h3 class="rs-panel__t">' + sig('sg-orn', 13) + 'The facts</h3>' +
          '<div class="asc-lines">' + factLines(type, rec) + '</div>' +
        '</div>' +
        '<div class="rs-panel">' +
          '<h3 class="rs-panel__t">' + sig('sg-tag', 13) + 'Topics</h3>' +
          (topics.length
            ? '<div class="rs-chips rs-chips--tight">' + topics.map(function (t) {
                return '<a class="rs-chip" href="#/collection/' + encodeURIComponent(t.id) + '">' +
                  esc(t.name) + '</a>';
              }).join('') + '</div>'
            : '<p class="hd-note">Not filed under anything yet.</p>') +
          // Not .rs-inline: that draws a border-bottom under whatever
          // it wraps, and here it would underline the arrow too.
          '<button type="button" class="hd-link hd-link--quiet" data-act="go-tab" ' +
            'data-tab="topics">' + V().arrow('File it') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function line(label, value) {
    if (!value) return '';
    return '<div class="asc-line"><span class="asc-label">' + esc(label) + '</span>' +
      '<p>' + value + '</p></div>';
  }

  function factLines(type, rec) {
    var out = '';
    out += line('Status', esc(labelFor(type, rec.status)));
    if (type === 'book') {
      out += line('Author', esc(rec.author));
      out += line('Formats', rec.formats.length ? esc(rec.formats.join(', ')) : '');
      out += line('Pages', rec.pages ? esc(String(rec.pages)) : '');
      out += line('Published', esc([rec.publisher, rec.year].filter(Boolean).join(', ')));
      out += line('ISBN', esc(rec.isbn));
      out += line('Started', esc(D().longDate(rec.startedAt)));
      out += line('Finished', esc(D().longDate(rec.readAt)));
    } else if (type === 'video') {
      out += line('Channel', esc(rec.channel));
      out += line('Length', esc(rec.duration));
      out += line('Views', esc(rec.views));
      out += line('Published', esc(rec.publishedAt));
    } else {
      out += line('Author', esc(rec.author));
      out += line('Published in', esc(rec.source));
      out += line('Published', esc(D().longDate(rec.publishedAt) || rec.publishedAt));
      out += line('Length', rec.minutes ? esc(rec.minutes + ' min read') : '');
    }
    if (rec.rating) out += line('Rating', esc(rec.rating + ' of 5'));
    out += line('Link', rec.url
      ? '<a class="asc-linkout" href="' + attr(rec.url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(D().domainOf(rec.url)) + '</a>' : '');
    out += line('Saved', esc(D().longDate(rec.createdAt) || D().ago(rec.createdAt)));
    return out || '<p class="hd-note">Nothing filled in yet. Use Edit above.</p>';
  }

  function labelFor(type, v) {
    var found = STATES[type].filter(function (s) { return s.v === v; })[0];
    return found ? found.label : v;
  }

  // ── notes and description ──────────────────────────────────
  function panelNotes(type, rec) {
    return '<div class="rs-panelbody">' +
      panelHead('Notes', 'Yours. What you thought while you were in it.') +
      V().editor('notes', type, rec.id, D().getText('notes', type, rec.id),
        'Paste, type, drop in a screenshot. Everything is kept.') +
    '</div>';
  }

  var DESC_HELP = {
    book: 'The blurb — what the book says it is about.',
    video: 'The video description, as it was published.',
    article: 'The standfirst, or your own one-line summary.'
  };

  function panelDescription(type, rec) {
    return '<div class="rs-panelbody">' +
      panelHead(type === 'book' ? 'Book description' : type === 'video' ? 'Video description' : 'Article description',
        DESC_HELP[type]) +
      V().editor('desc', type, rec.id, D().getText('desc', type, rec.id), DESC_HELP[type]) +
    '</div>';
  }

  // ── a book's transcript, in chapters ───────────────────────
  function panelChapters(b) {
    var chapters = D().chaptersFor(b.id);
    var openId = (D().getUiState().openChapter || {})[b.id] || (chapters[0] && chapters[0].id) || '';

    var acts =
      btn('chap-add', '＋ Add a chapter', '', { id: b.id }) +
      btn('chap-paste', 'Paste a whole transcript', '', { id: b.id }) +
      (chapters.length ? btn('chap-copyall', 'Copy all', '', { id: b.id }) : '');

    if (!chapters.length) {
      return '<div class="rs-panelbody">' +
        panelHead('Transcript', 'Kept as chapters, so a passage can be found again.', acts) +
        '<div class="hd-empty"><strong>No chapters yet.</strong>' +
        'Add them one at a time, or paste the whole transcript and let it split itself ' +
        'on the headings.</div>' +
      '</div>';
    }

    return '<div class="rs-panelbody">' +
      panelHead('Transcript', chapters.length + (chapters.length === 1 ? ' chapter' : ' chapters'), acts) +
      '<ol class="rs-chaps">' + chapters.map(function (ch, i) {
        var on = ch.id === openId;
        return '<li class="rs-chap' + (on ? ' is-open' : '') + '">' +
          '<div class="rs-chap__bar">' +
            '<button type="button" class="rs-chap__hit" data-act="chap-open" data-id="' + attr(ch.id) +
              '" data-book="' + attr(b.id) + '" aria-expanded="' + (on ? 'true' : 'false') + '">' +
              '<span class="rs-chap__n">' + (i + 1) + '</span>' +
              '<span class="rs-chap__t">' + esc(ch.title || 'Untitled chapter') + '</span>' +
              '<span class="rs-chap__w">' + shortN(R().wordCount(D().getText('body', 'chapter', ch.id))) + '</span>' +
              '<span class="rs-chap__caret" aria-hidden="true">▾</span>' +
            '</button>' +
            '<span class="rs-chap__acts">' +
              btn('chap-up', '↑', 'asc-btn--quiet', { id: ch.id, book: b.id }) +
              btn('chap-down', '↓', 'asc-btn--quiet', { id: ch.id, book: b.id }) +
              btn('chap-copy', 'Copy', 'asc-btn--quiet', { id: ch.id }) +
              btn('chap-del', 'Delete', 'asc-btn--quiet', { id: ch.id, book: b.id }) +
            '</span>' +
          '</div>' +
          (on
            ? '<div class="rs-chap__body">' +
                '<label class="asc-label" for="chT-' + attr(ch.id) + '">Chapter title</label>' +
                '<input class="asc-input" id="chT-' + attr(ch.id) + '" type="text" value="' +
                  attr(ch.title) + '" data-act="chap-title" data-id="' + attr(ch.id) + '">' +
                V().editor('body', 'chapter', ch.id, D().getText('body', 'chapter', ch.id),
                  'The chapter, as it was said or written.') +
              '</div>'
            : '') +
        '</li>';
      }).join('') + '</ol>' +
    '</div>';
  }

  // ── a video's transcript, whole ────────────────────────────
  function panelTranscript(v) {
    var text = D().getText('tr', 'video', v.id);
    var words = String(text || '').split(/\s+/).filter(Boolean).length;
    var acts =
      (text ? btn('tr-copy', 'Copy', '', { id: v.id }) : '') +
      (text ? btn('tr-organize', 'Build the organized version', '', { id: v.id }) : '');
    return '<div class="rs-panelbody">' +
      panelHead('Transcript', words ? words.toLocaleString() + ' words, as one block' :
        'Paste the whole thing. It stays exactly as pasted.', acts) +
      '<textarea class="asc-textarea rs-tr" data-act="tr-save" data-id="' + attr(v.id) + '" ' +
        'spellcheck="false" placeholder="Paste the transcript here.">' + esc(text) + '</textarea>' +
      '<p class="hd-note">Kept as plain text on purpose — a transcript is words in order, ' +
      'and formatting it would only make it harder to search and to copy.</p>' +
    '</div>';
  }

  // ── a video's transcript, organized ────────────────────────
  function panelOrganized(v) {
    var rows = D().getRows('tro', 'video', v.id);
    var acts =
      btn('org-add', '＋ Add a section', '', { id: v.id }) +
      btn('tr-organize', 'Rebuild from the whole transcript', '', { id: v.id }) +
      (rows.length ? btn('org-copy', 'Copy', '', { id: v.id }) : '');

    if (!rows.length) {
      return '<div class="rs-panelbody">' +
        panelHead('Organized transcript', 'The same words, in sections you can jump to.', acts) +
        '<div class="hd-empty"><strong>Not organized yet.</strong>' +
        'Paste the whole transcript on the Transcript tab and build this from it — any line ' +
        'that starts with a timestamp becomes a section. Or add the sections by hand.</div>' +
      '</div>';
    }

    return '<div class="rs-panelbody">' +
      panelHead('Organized transcript', rows.length + (rows.length === 1 ? ' section' : ' sections'), acts) +
      '<ol class="rs-org">' + rows.map(function (r, i) {
        return '<li class="rs-org__row">' +
          '<div class="rs-org__bar">' +
            '<button type="button" class="rs-stamp" data-act="seek" data-t="' + attr(r.t || '') +
              '" title="Jump the player here">' + esc(r.t || '—') + '</button>' +
            '<input class="rs-org__t" type="text" value="' + attr(r.title || '') +
              '" data-act="org-title" data-i="' + i + '" data-id="' + attr(v.id) +
              '" placeholder="What is said here">' +
            btn('org-del', '✕', 'asc-btn--quiet', { i: i, id: v.id }) +
          '</div>' +
          '<textarea class="asc-textarea rs-org__x" data-act="org-text" data-i="' + i +
            '" data-id="' + attr(v.id) + '" placeholder="The words">' + esc(r.text || '') + '</textarea>' +
        '</li>';
      }).join('') + '</ol>' +
    '</div>';
  }

  // ── the article itself ─────────────────────────────────────
  function panelArticle(a) {
    var body = D().getText('body', 'article', a.id);
    var assets = D().assetsFor('article', a.id);
    return '<div class="rs-panelbody rs-panelbody--prose">' +
      panelHead('The article', a.minutes ? a.minutes + ' min read' :
        'Paste it whole — pictures, links and video included.') +
      V().editor('body', 'article', a.id, body,
        'Paste the article here. Everything that came with it is kept.') +
      attachments(assets) +
    '</div>';
  }

  var ASSET_SIGIL = { image: 'sg-frame', video: 'sg-play', link: 'sg-link', file: 'sg-doc' };

  function attachments(assets) {
    if (!assets.length) return '';
    var order = { video: 0, image: 1, link: 2, file: 3 };
    var rows = assets.slice().sort(function (x, y) {
      return (order[x.kind] || 9) - (order[y.kind] || 9);
    });
    return '<section class="rs-attach">' +
      '<h3 class="hd-eyebrow hd-eyebrow--rule">Everything that came with it</h3>' +
      '<ul class="rs-attach__list">' + rows.map(function (as) {
        var name = as.title || as.caption || D().domainOf(as.url) || as.url;
        return '<li class="rs-attach__row rs-attach__row--' + attr(as.kind) + '">' +
          '<span class="rs-attach__mark" aria-hidden="true">' +
            sig(ASSET_SIGIL[as.kind] || 'sg-link', 14) + '</span>' +
          (as.kind === 'image'
            ? '<img class="rs-attach__thumb" src="' + attr(as.url) + '" alt="" loading="lazy" onerror="this.remove()">'
            : '') +
          '<span class="rs-attach__in">' +
            '<b>' + esc(name) + '</b>' +
            '<i>' + esc(as.kind) + ' · ' + esc(D().domainOf(as.url) || 'stored') + '</i>' +
          '</span>' +
          '<a class="rs-attach__go" href="' + attr(as.url) + '" target="_blank" rel="noopener noreferrer">' +
            'Open' + V().extGlyph() + '</a>' +
        '</li>';
      }).join('') + '</ul>' +
      '<p class="hd-note">Images are stored in your own bucket, so they survive the page ' +
      'they came from. Videos are kept as cards and load only when you play them.</p>' +
    '</section>';
  }

  // ── questions ──────────────────────────────────────────────
  function panelQA(type, rec) {
    var rows = D().qaFor(type, rec.id);
    var acts = btn('qa-add', '＋ Add a question', '', { type: type, id: rec.id });

    if (!rows.length) {
      return '<div class="rs-panelbody">' +
        panelHead('Q&A', 'The questions this raised, and what you worked out.', acts) +
        '<div class="hd-empty"><strong>No questions yet.</strong>' +
        'The useful ones are the ones you could not answer at the time. Write them down ' +
        'here and come back.</div>' +
      '</div>';
    }

    var open = rows.filter(function (r) { return !r.a.trim(); }).length;
    return '<div class="rs-panelbody">' +
      panelHead('Q&A', rows.length + (rows.length === 1 ? ' question' : ' questions') +
        (open ? ' · ' + open + ' still open' : ''), acts) +
      '<ol class="rs-qa">' + rows.map(function (r, i) {
        var unanswered = !r.a.trim();
        return '<li class="rs-qa__row' + (unanswered ? ' is-open' : '') + '">' +
          '<div class="rs-qa__bar">' +
            '<span class="rs-qa__n">' + (i + 1) + '</span>' +
            (unanswered ? '<span class="rs-qa__flag">Unanswered</span>' : '') +
            '<span class="rs-qa__acts">' +
              btn('qa-up', '↑', 'asc-btn--quiet', { id: r.id, type: type, item: rec.id }) +
              btn('qa-down', '↓', 'asc-btn--quiet', { id: r.id, type: type, item: rec.id }) +
              btn('qa-del', 'Delete', 'asc-btn--quiet', { id: r.id }) +
            '</span>' +
          '</div>' +
          '<label class="hd-sr" for="q-' + attr(r.id) + '">Question</label>' +
          '<textarea class="rs-qa__q" id="q-' + attr(r.id) + '" data-act="qa-q" data-id="' + attr(r.id) +
            '" rows="1" placeholder="What did this leave you wondering?">' + esc(r.q) + '</textarea>' +
          '<label class="hd-sr" for="a-' + attr(r.id) + '">Answer</label>' +
          '<textarea class="rs-qa__a" id="a-' + attr(r.id) + '" data-act="qa-a" data-id="' + attr(r.id) +
            '" rows="1" placeholder="Answer it when you can.">' + esc(r.a) + '</textarea>' +
        '</li>';
      }).join('') + '</ol>' +
    '</div>';
  }

  // ── topics ─────────────────────────────────────────────────
  function panelTopics(type, rec) {
    var mine = D().topicsFor(type, rec.id);
    var all = D().Topics.list().sort(function (a, b) { return a.name.localeCompare(b.name); });

    return '<div class="rs-panelbody">' +
      panelHead('Topics', 'The threads this belongs to. Every one of them is a page in Collections.') +
      '<div class="rs-topicbox">' +
        (mine.length
          ? '<div class="rs-chips">' + mine.map(function (t) {
              return '<span class="rs-chip is-on">' +
                '<a href="#/collection/' + encodeURIComponent(t.id) + '">' + esc(t.name) + '</a>' +
                '<button type="button" class="rs-chip__x" data-act="untopic" data-topic="' + attr(t.id) +
                  '" data-type="' + attr(type) + '" data-id="' + attr(rec.id) +
                  '" aria-label="Remove ' + attr(t.name) + '">✕</button>' +
              '</span>';
            }).join('') + '</div>'
          : '<p class="hd-note">Not filed under anything yet.</p>') +
        '<form class="rs-topicadd" data-act="topic-add-form" data-type="' + attr(type) +
          '" data-id="' + attr(rec.id) + '">' +
          '<label class="hd-sr" for="rsTopicIn">Add a topic</label>' +
          '<input class="asc-input" id="rsTopicIn" list="rsTopicList" autocomplete="off" ' +
            'placeholder="Type a topic, or pick one">' +
          '<datalist id="rsTopicList">' + all.map(function (t) {
            return '<option value="' + attr(t.name) + '"></option>';
          }).join('') + '</datalist>' +
          '<button type="submit" class="asc-btn asc-btn--primary asc-btn--sm">Add</button>' +
        '</form>' +
        (all.length
          ? '<div class="rs-suggest">' +
              '<span class="hd-eyebrow">Or one of these</span>' +
              '<div class="rs-chips rs-chips--tight">' + all.filter(function (t) {
                return mine.every(function (m) { return m.id !== t.id; });
              }).slice(0, 14).map(function (t) {
                return '<button type="button" class="rs-chip" data-act="topic" data-topic="' + attr(t.id) +
                  '" data-type="' + attr(type) + '" data-id="' + attr(rec.id) + '">＋ ' +
                  esc(t.name) + '</button>';
              }).join('') + '</div>' +
            '</div>'
          : '') +
      '</div>' +
      '<div class="rs-panel rs-panel--wide">' +
        '<h3 class="rs-panel__t">' + sig('sg-spark', 13) + 'Related ideas</h3>' +
        '<p class="hd-note">Anything this connects to that is not a topic yet — a half-thought, ' +
        'a contradiction, something to look up.</p>' +
        V().editor('rel', type, rec.id, D().getText('rel', type, rec.id),
          'What does this rhyme with?') +
      '</div>' +
    '</div>';
  }

  // ═══ §THE PAGE ═════════════════════════════════════════════

  function panelFor(type, rec, tab) {
    switch (tab) {
      case 'notes': return panelNotes(type, rec);
      case 'description': return panelDescription(type, rec);
      case 'transcript': return type === 'book' ? panelChapters(rec) : panelTranscript(rec);
      case 'organized': return panelOrganized(rec);
      case 'article': return panelArticle(rec);
      case 'qa': return panelQA(type, rec);
      case 'topics': return panelTopics(type, rec);
      default: return panelOverview(type, rec);
    }
  }

  // ── a book or a video ──────────────────────────────────────
  function viewStandard(type, rec, tab) {
    return '<article class="rs-item hd-night">' +
      crumb(type, rec.title) +
      (type === 'book' ? bookMedia(rec) : videoMedia(rec)) +
      '<div class="rs-itemhead">' +
        '<h1 class="rs-item__t">' + esc(rec.title || 'Untitled') + '</h1>' +
        actions(type, rec) +
      '</div>' +
      '<div class="rs-meta">' + whoCard(type, rec) + factsCard(type, rec) + '</div>' +
      tabStrip(type, rec.id, tab) +
      panelFor(type, rec, tab) +
    '</article>';
  }

  // ── an article ─────────────────────────────────────────────
  // The Ink & Ideas order, with the tab bar where Damian asked
  // for it: directly underneath the cover photograph.
  function viewArticle(a, tab) {
    var who = a.author || a.source || '';
    var initial = (who || a.title || '?').trim().charAt(0).toUpperCase();
    var meta = [D().longDate(a.publishedAt) || a.publishedAt,
                a.minutes ? a.minutes + ' min read' : ''].filter(Boolean).join('  ·  ');

    return '<article class="rs-item rs-item--article hd-night">' +
      crumb('article', a.title) +
      '<header class="rs-artHead">' +
        (a.label ? '<p class="hd-eyebrow">' + esc(a.label) + '</p>' : '') +
        '<h1 class="rs-artHead__t">' + esc(a.title || 'Untitled') + '</h1>' +
        (a.deck ? '<p class="rs-artHead__d">' + esc(a.deck) + '</p>' : '') +
        '<div class="rs-artHead__by">' +
          '<span class="rs-who__av" aria-hidden="true">' + esc(initial) + '</span>' +
          '<span class="rs-artHead__who">' +
            '<b>' + esc(who || 'Unknown') + '</b>' +
            (meta ? '<i>' + esc(meta) + '</i>' : '') +
          '</span>' +
          actions('article', a) +
        '</div>' +
      '</header>' +
      // The meta row goes ABOVE the picture here, and only here. On a
      // book or a video it sits between the media and the tabs; on an
      // article the bar has to be immediately under the cover, so
      // anything else has to be somewhere else.
      '<div class="rs-meta rs-meta--article">' + whoCard('article', a) + factsCard('article', a) + '</div>' +
      articleCover(a) +
      tabStrip('article', a.id, tab) +
      panelFor('article', a, tab) +
    '</article>';
  }

  // THE FOUR ROUTES WITH NO HERO, and the same reasoning the vault
  // gives for its article page: every other view opens on a full
  // screen of the house photograph because every other view is a room
  // you are browsing. An item page is a page you WRITE IN — seven
  // panels of editing — and a screen of atmosphere before the first
  // field is the wrong thing on one.
  //
  // It also removes a real redundancy. With a hero, the title
  // appeared three times before the first control: once in the hero,
  // once in the breadcrumb and once as the heading. The Creatica
  // reference opens on the breadcrumb, and it is right.
  //
  // Two consequences follow, both handled in resource-app.js and
  // resource-theme.css, and both look like bugs if they are not:
  //   · .hd-main carries margin-top: calc(var(--hd-top) * -1) so a
  //     hero can start at y=0 under the sticky bar. With no hero the
  //     breadcrumb would begin UNDERNEATH it, so .rs-itemband puts
  //     the 90px back.
  //   · the pill bar is transparent until you scroll, because
  //     elsewhere it floats on a picture. body.hd-heroless makes it
  //     frosted at rest.
  function view(type, id, wantedTab) {
    var rec = D().itemOf(type, id);
    if (!rec) {
      return V().notFound('That ' + type + ' is not here', CRUMB[type].href, 'All ' + CRUMB[type].label.toLowerCase());
    }
    var tab = resolveTab(type, wantedTab, id);
    return '<section class="hd-band hd-night rs-itemband">' +
      (type === 'article' ? viewArticle(rec, tab) : viewStandard(type, rec, tab)) +
    '</section>';
  }

  global.ResItem = {
    view: view, TABS: TABS, tabKeys: tabKeys, resolveTab: resolveTab,
    itemHref: itemHref, shortN: shortN, attachments: attachments
  };
})(window);
