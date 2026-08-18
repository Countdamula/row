/* =====================================================================
   athenaeum-nav.js — the one strip that appears at the top of every
   Athenaeum page.

   WHY THIS FILE EXISTS. topbar.js is a single IIFE that exports no
   globals and has no secondary-nav API, and the Athenaeum's pages each
   grew their own top-of-page idiom: an in-hero `.ath-topnav`
   (athenaeum.html), a `.ath-backbar` (its global routes), a
   `.ath-rail-head` (athenaeum-subject.html) and a `.ath-crumb`
   (athenaeum-curriculum.html). Pasting the same link into four different
   idioms means the fifth page silently misses it. This is one element,
   defined once, that every Athenaeum page gets by loading a script.

   WHY IT IS FIXED AND RIGHT-ALIGNED. topbar.js's launcher pill is fixed
   over the top-LEFT of every page at z-index 2600. Putting a strip in
   normal flow would either collide with it or push a full-bleed hero
   down off the top of the viewport, and a full-bleed plate that does not
   touch the top edge is no longer a hero. Sitting fixed at the top right
   costs the pages underneath nothing at all: the pill is the app
   switcher, this is the Athenaeum's own table of contents, and the two
   read as one system because they share the idiom.

   It carries no wordmark on purpose. Each page already says its own name
   somewhere better — in the hero, in the rail head, in the breadcrumb —
   and a second one up here would be the accessory to take off before
   leaving the house.
   ===================================================================== */
(function () {
  'use strict';

  // rank 1 survives every width down to the mobile cutoff; rank 2 drops
  // first. The Library is rank 1 because it is the page most often wanted
  // from somewhere else.
  var ITEMS = [
    { href: 'athenaeum.html#/',           label: 'Reading Room', rank: 1, match: /^athenaeum\.html$/, hash: '#/' },
    { href: 'athenaeum.html#/fields',     label: 'Fields',       rank: 1, match: /^athenaeum\.html$/, hash: '#/fields' },
    { href: 'athenaeum-resources.html',   label: 'Library',      rank: 1, match: /^athenaeum-resources?\.html$/ },
    { href: 'athenaeum.html#/retention',  label: 'Retention',    rank: 2, match: /^athenaeum\.html$/, hash: '#/retention' },
    { href: 'athenaeum.html#/calendar',   label: 'Calendar',     rank: 2, match: /^athenaeum\.html$/, hash: '#/calendar' },
    { href: 'athenaeum.html#/experiments',label: 'Lab',          rank: 2, match: /^athenaeum\.html$/, hash: '#/experiments' },
    { href: 'athenaeum.html#/box',        label: 'The Box',      rank: 2, match: /^athenaeum\.html$/, hash: '#/box' }
  ];

  var CSS = [
    '.ath-strip{',
    '  position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(16px, env(safe-area-inset-right));',
    '  z-index:2400; display:flex; align-items:center; gap:26px;',
    '  padding:11px 20px; border-radius:999px;',
    /* Its own glass, not the page's tokens: this element floats over four
       different grounds (a point cloud, a photograph, a plate, bare
       paper) and has to stay legible on all of them. */
    '  background:rgba(10,12,15,.62); backdrop-filter:blur(14px) saturate(1.3);',
    '  -webkit-backdrop-filter:blur(14px) saturate(1.3);',
    '  border:1px solid rgba(242,239,232,.10);',
    '  box-shadow:0 10px 30px -18px rgba(0,0,0,.9);',
    '  font-family:"Bodoni Moda", Didot, "Bodoni MT", Georgia, serif; font-optical-sizing:auto;',
    '}',
    '.ath-strip a{',
    '  position:relative; padding:3px 0; text-decoration:none;',
    '  font-size:12.5px; letter-spacing:.2em; text-transform:uppercase;',
    '  color:rgba(242,239,232,.68); white-space:nowrap;',
    '  transition:color .2s cubic-bezier(.32,.72,0,1);',
    '}',
    '.ath-strip a::after{',
    '  content:""; position:absolute; left:0; right:0; bottom:0; height:1px;',
    '  background:#C9A458; transform:scaleX(0); transform-origin:left;',
    '  transition:transform .3s cubic-bezier(.32,.72,0,1);',
    '}',
    '.ath-strip a:hover{color:#F2EFE8}',
    '.ath-strip a:hover::after{transform:scaleX(1)}',
    '.ath-strip a:focus-visible{outline:1px solid #C9A458; outline-offset:5px; border-radius:1px}',
    '.ath-strip a[aria-current="page"]{color:#F2EFE8}',
    '.ath-strip a[aria-current="page"]::after{transform:scaleX(1); background:rgba(242,239,232,.34)}',
    '@media (max-width:1180px){ .ath-strip [data-rank="2"]{display:none} }',
    /* Below 900 the launcher drawer is the navigation; a second row up
       here would just crowd a phone's status bar. */
    '@media (max-width:900px){ .ath-strip{display:none} }',
    '@media (prefers-reduced-motion:reduce){ .ath-strip a::after{transition:none} }'
  ].join('\n');

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pageFile() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p;
  }

  function markActive(nav) {
    var file = pageFile(), hash = location.hash || '#/';
    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var it = ITEMS[i];
      var on = it.match.test(file) && (!it.hash || it.hash === hash);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function mount() {
    if (document.querySelector('.ath-strip')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'ath-strip';
    nav.setAttribute('aria-label', 'The Athenaeum');
    nav.innerHTML = ITEMS.map(function (it) {
      return '<a href="' + esc(it.href) + '" data-rank="' + it.rank + '">' + esc(it.label) + '</a>';
    }).join('');
    document.body.appendChild(nav);

    markActive(nav);
    // Appended to <body>, outside every page's view host, so a cloud-sync
    // repaint cannot destroy it — the same reason the section pill on the
    // home page lives out here.
    window.addEventListener('hashchange', function () { markActive(nav); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
