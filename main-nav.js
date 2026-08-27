// =============================================================
// main-nav.js — the destination table.
//
// ONE list of every place in the dashboard you can go, and it is the
// source for four different things on Main:
//
//   Quick Launch   the eight plates
//   Explore        the four index columns
//   Search         what the header field filters
//   Continue       how a recorded href turns back into a readable name
//
// Those four used to be four hand-kept lists in four places, which is
// how a page ends up offering a link to something that was renamed a
// month ago. Rename a destination here and every one of them follows.
//
// WHAT THIS FILE IS NOT
//
// It is not the site's navigation. topbar.js still owns the circle
// menu and the drawer, on all 23 pages, and it exports no globals —
// there is no API to read its lists from, so this is a deliberate
// second copy rather than an accidental one. When a page is added or
// renamed, both files need the edit. topbar.js:55 (RING_ITEMS) and
// topbar.js:89 (NAV_GROUPS) are the other two.
//
// ICONS are line-engraved: stroked lucide-style paths on a 24-box, no
// fills, drawn in currentColor so a card can ink them in on hover.
// Filled glyphs would fight every other ornament on this page.
// =============================================================

(function (global) {
  'use strict';

  var ICONS = {
    feather:  '<path d="M12.7 19a2 2 0 0 0 1.4-.6l6.2-6.2a6 6 0 0 0-8.5-8.5L5.6 9.9a2 2 0 0 0-.6 1.4V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
    basin:    '<ellipse cx="12" cy="14.5" rx="9" ry="4.5"/><path d="M8.4 10.4a4.6 4.6 0 0 1 7.2 0"/><path d="M10.4 6.8a2.6 2.6 0 0 1 3.2 0"/>',
    dumbbell: '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9.5v5"/><path d="M21 9.5v5"/><path d="M6.5 12h11"/>',
    utensils: '<path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2"/><path d="M5.5 2v20"/><path d="M18 2a4 4 0 0 0-3 3.9V13a1 1 0 0 0 1 1h3"/><path d="M19 2v20"/>',
    flask:    '<path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7.2 16h9.6"/>',
    book:     '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    horizon:  '<circle cx="12" cy="12" r="9"/><path d="M3 14h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
    film:     '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/><path d="M3 7.5h4"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
    shelf:    '<path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h18"/><path d="M7 7v10"/><path d="M14 12v5"/>',
    scales:   '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M5 7h14"/><path d="M5 7 2 14h6z"/><path d="M19 7l-3 7h6z"/>',
    compass:  '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/>',
    ledger:   '<rect width="16" height="18" x="4" y="3" rx="2"/><path d="M8 3v18"/><path d="M12 8h5"/><path d="M12 12h5"/><path d="M12 16h3"/>'
  };

  function svg(name) {
    var p = ICONS[name] || ICONS.compass;
    return '<svg class="mn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  // ------------------------------------------------------------
  // THE DESTINATIONS
  //
  //   id        stable — Quick Launch stores these, so never reuse one
  //   name      what the plate and the index call it
  //   sub       one line. It says what the page is for, not what it is.
  //   href      the document
  //   icon      an ICONS key
  //   group     which Explore column it belongs to
  //   routes    [{hash, label}] — the page's own sections, for Search
  //             and for turning a recorded #hash back into a name
  // ------------------------------------------------------------
  var PAGES = [
    {
      id: 'writing', name: 'Writing', sub: 'The Velvet Grimoire — trilogies, drafts, continuity',
      href: 'kdp.html', icon: 'feather', group: 'create',
      routes: [
        { hash: '/', label: 'The Velvet Grimoire' },
        { hash: '/shelf', label: 'Trilogies' },
        { hash: '/library/prompts', label: 'Prompt Library' },
        { hash: '/library/templates', label: 'Templates' },
        { hash: '/settings', label: 'Settings & backup' }
      ]
    },
    {
      id: 'daily', name: 'Daily', sub: 'The routine itself — steps, beliefs, the record',
      href: 'routine.html', icon: 'sun', group: 'systems', routes: []
    },
    {
      id: 'selfcare', name: 'Self-Care', sub: 'The Asclepion — breath, journals, meditation',
      href: 'asclepion.html', icon: 'basin', group: 'life',
      routes: [
        { hash: '/', label: 'Home' },
        { hash: '/breath', label: 'Breath & Regulation' },
        { hash: '/journal', label: 'Journals' },
        { hash: '/eft', label: 'EFT Tapping' },
        { hash: '/meditation', label: 'Meditation & Hypnosis' },
        { hash: '/yoga', label: 'Yoga & Movement' },
        { hash: '/energy', label: 'Energy Practices' },
        { hash: '/affirmations', label: 'Affirmations' },
        { hash: '/routines', label: 'Routines' },
        { hash: '/kept', label: 'Kept — favourites' }
      ]
    },
    {
      id: 'fitness', name: 'Fitness', sub: 'The Palaestra — the week, the workout, the logger',
      href: 'palaestra.html', icon: 'dumbbell', group: 'life',
      routes: [
        { hash: '/', label: 'Today' },
        { hash: '/steps', label: 'Steps' },
        { hash: '/body', label: 'Body Progress' },
        { hash: '/calendar', label: 'Weekly Schedule' },
        { hash: '/volume', label: 'Training Volume' },
        { hash: '/templates', label: 'Workouts' },
        { hash: '/exercises', label: 'Exercise Library' },
        { hash: '/history', label: 'History' },
        { hash: '/settings', label: 'Settings & safety net' }
      ]
    },
    {
      id: 'nutrition', name: 'Nutrition', sub: 'The Larder — meals, macros, recipes, the grocery list',
      href: 'larder.html', icon: 'utensils', group: 'life',
      routes: [
        { hash: '/', label: 'Today' },
        { hash: '/meals', label: 'Meals' },
        { hash: '/foods', label: 'Foods' },
        { hash: '/recipes', label: 'Recipes' },
        { hash: '/plan', label: 'Meal Plan' },
        { hash: '/grocery', label: 'Grocery List' },
        { hash: '/progress', label: 'Progress' },
        { hash: '/kept', label: 'Kept' },
        { hash: '/targets', label: 'Nutrition goals' },
        { hash: '/supplements', label: 'Supplements' }
      ]
    },
    {
      id: 'prompts', name: 'Prompts', sub: 'Prompt Studio — filed by what you need, not by model',
      href: 'promptarium.html', icon: 'flask', group: 'create',
      routes: [
        { hash: '/', label: 'Prompts' },
        { hash: '/tools', label: 'Tools & Websites' },
        { hash: '/settings', label: 'Settings & snapshots' }
      ]
    },
    {
      id: 'learning', name: 'Learning', sub: 'The Athenaeum — fields, curricula, retention',
      href: 'athenaeum.html', icon: 'book', group: 'knowledge',
      routes: [
        { hash: '/', label: 'The Reading Room' },
        { hash: '/fields', label: 'All Fields' },
        { hash: '/retention', label: 'Retention Center' },
        { hash: '/calendar', label: 'Learning Calendar' },
        { hash: '/experiments', label: 'Experiment Lab' },
        { hash: '/box', label: 'The Box' },
        { hash: '/inbox', label: 'Learning Inbox' },
        { hash: '/knowledge', label: 'Knowledge Base' },
        { hash: '/connections', label: 'Cross-Field Connections' }
      ]
    },
    {
      id: 'planning', name: 'Planning', sub: 'Future Self — the identity you are aiming at',
      href: 'futureself.html', icon: 'horizon', group: 'systems', routes: []
    },
    {
      id: 'entertainment', name: 'Entertainment', sub: 'The Vault — music, watching, reading, games',
      href: 'vault.html', icon: 'film', group: 'life',
      routes: [
        { hash: 'home', label: 'Home' },
        { hash: 'discover', label: 'Discovery Engine' },
        { hash: 'favorites', label: 'Favorites' },
        { hash: 'playlists', label: 'Music & Playlists' },
        { hash: 'podcasts', label: 'Podcasts' },
        { hash: 'watch', label: 'Watching' },
        { hash: 'reading', label: 'Reading Corner' },
        { hash: 'anime', label: 'Anime' },
        { hash: 'games', label: 'Games' },
        { hash: 'stats', label: 'Statistics' }
      ]
    },
    {
      id: 'library', name: 'Resource Library', sub: 'Everything worth reading again, by medium',
      href: 'athenaeum-resources.html', icon: 'shelf', group: 'knowledge', routes: []
    },
    {
      id: 'review', name: 'Weekly Review', sub: 'What the week actually came to',
      href: 'weeklyreview.html', icon: 'scales', group: 'systems', routes: []
    },
    {
      id: 'business', name: 'Business OS', sub: 'The side of the frog that has a spreadsheet',
      href: 'businessos.html', icon: 'ledger', group: 'create', routes: []
    }
  ];

  var GROUPS = [
    { key: 'create',    label: 'Create' },
    { key: 'life',      label: 'Life' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'systems',   label: 'Systems' }
  ];

  // The eight plates, in reading order across two rows. Stored choices
  // in today:settings override this; an id here that no longer exists
  // is dropped rather than rendered as a dead card.
  var QUICK_DEFAULT = ['writing', 'daily', 'selfcare', 'fitness', 'nutrition', 'prompts', 'learning', 'planning'];

  function byId(id) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return PAGES[i];
    return null;
  }
  function byHref(href) {
    var file = String(href || '').split('#')[0].split('/').pop().toLowerCase();
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i].href.toLowerCase() === file) return PAGES[i];
    }
    return null;
  }
  /** The readable name of one section of one page, or ''. */
  function routeLabel(href, hash) {
    var p = byHref(href);
    if (!p) return '';
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return '';
    for (var i = 0; i < p.routes.length; i++) {
      if (p.routes[i].hash.replace(/^#/, '') === h) return p.routes[i].label;
    }
    return '';
  }
  function group(key) {
    return PAGES.filter(function (p) { return p.group === key; });
  }
  function quickLaunch(ids) {
    var want = (ids && ids.length) ? ids : QUICK_DEFAULT;
    return want.map(byId).filter(Boolean).slice(0, 8);
  }

  /**
   * Search over destinations only — pages and their own sections.
   *
   * It deliberately does not reach into any app's data. Main mounts
   * two Supabase rows; a search that read the other nine would mean
   * either mounting them (and being in a position to overwrite rows it
   * had not pulled) or reporting stale results as if they were live.
   * Finding the page is the job here; the page can find the record.
   */
  function groupLabel(key) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].key === key) return GROUPS[i].label;
    return '';
  }

  function search(q, limit) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    PAGES.forEach(function (p) {
      var name = p.name.toLowerCase();
      var sub = p.sub.toLowerCase();
      // A result's right-hand hint is WHERE the thing is, not what it
      // is for. A page's full subtitle is a sentence and, set against
      // a two-word title, it swamped the result it was describing.
      var where = groupLabel(p.group);
      var hit = name.indexOf(q);
      if (hit === 0) out.push({ score: 0, page: p, href: p.href, title: p.name, sub: where, icon: p.icon });
      else if (hit > 0) out.push({ score: 2, page: p, href: p.href, title: p.name, sub: where, icon: p.icon });
      else if (sub.indexOf(q) !== -1) out.push({ score: 4, page: p, href: p.href, title: p.name, sub: where, icon: p.icon });

      p.routes.forEach(function (r) {
        var pos = r.label.toLowerCase().indexOf(q);
        if (pos === -1) return;
        out.push({
          score: (pos === 0 ? 1 : 3), page: p, icon: p.icon,
          href: p.href + '#' + r.hash, title: r.label, sub: p.name
        });
      });
    });
    out.sort(function (a, b) { return a.score - b.score || a.title.localeCompare(b.title); });
    return out.slice(0, limit || 8);
  }

  global.MainNav = {
    PAGES: PAGES, GROUPS: GROUPS, QUICK_DEFAULT: QUICK_DEFAULT,
    icon: svg, byId: byId, byHref: byHref, routeLabel: routeLabel,
    group: group, quickLaunch: quickLaunch, search: search
  };
})(window);
