// =============================================================
// larder-hero.js — window.LarHero
//
// THE ONE INVARIANT
//
// Mounted ONCE, at boot, OUTSIDE the render host, and never
// written into #larRoot. Everything inside that host is destroyed
// and rebuilt on every render, and The Larder repaints more than
// any other page in the dashboard — every water tap, every logged
// food, every phone in another room saving something. A hero
// written into the host would replay its entrance on all of them.
//
// render(route) therefore PATCHES IN PLACE. The entrance is
// re-armed on a ROUTE CHANGE ONLY, gated on `shownRoute` — a
// repaint carries the same route and must not re-arm, or a cloud
// pull restarts the animation at random. That is the trap this
// repo has already been bitten by twice.
// =============================================================
// THE PICTURE
//
// A dark woodland path with light at the end of it, supplied as
// the background. It is portrait (1152x2048) and the hero is
// landscape, so `object-fit: cover` shows the middle band — which
// is the tunnel mouth and its glow, the strongest part of the
// frame. `object-position` is nudged per variant so the short
// band keeps the glow rather than a strip of black canopy.
//
// Two variants, and the difference is not decoration:
//   full  100vh, on Today only — the one screen you open to look
//         at rather than to do one thing.
//   band  ~44vh everywhere else. A full screen in front of the
//         grocery list, in a shop, is a tax.
// =============================================================

(function (global) {
  'use strict';

  var IMG = 'images_by_admin/larder/hero.jpg';

  var el = null;
  var eyebrowEl = null;
  var linesEl = null;
  var cardEl = null;
  var shownRoute = null;

  // Per route: the eyebrow, and the headline as LINES. Lines,
  // not a string, because the reference staggers them — each one
  // arrives on its own beat and the second is indented, so the
  // block reads as a stanza rather than a wrapped paragraph.
  //
  // The copy names the room you are standing in, in this page's
  // own voice. It never sells the feature.
  var COPY = {
    '/':            { eyebrow: 'The Larder',  lines: ['What you', 'ate', 'today'] },
    '/meals':       { eyebrow: 'Saved meals', lines: ['The things', 'you eat', 'often'] },
    '/foods':       { eyebrow: 'Foods',       lines: ['Everything', 'on the shelf'] },
    '/recipes':     { eyebrow: 'Recipes',     lines: ['Things', 'you make'] },
    '/plan':        { eyebrow: 'Meal plan',   lines: ['The week', 'ahead'] },
    '/grocery':     { eyebrow: 'Grocery',     lines: ['What to', 'buy'] },
    '/progress':    { eyebrow: 'Progress',    lines: ['Over', 'time'] },
    '/kept':        { eyebrow: 'Kept',        lines: ['The ones', 'you keep'] },
    '/targets':     { eyebrow: 'Goals',       lines: ['What you are', 'aiming at'] },
    '/supplements': { eyebrow: 'Supplements', lines: ['What you', 'take'] },
    '/notes':       { eyebrow: 'Notes',       lines: ['Worth', 'remembering'] },
    '/data':        { eyebrow: 'Data',        lines: ['Backup', 'and restore'] }
  };

  function copyFor(hash) { return COPY[hash] || COPY['/']; }

  function mount(opts) {
    opts = opts || {};
    if (el) return el;

    el = document.createElement('header');
    el.className = 'lar-hero lar-hero--band';
    el.setAttribute('data-tint', 'honey');

    // The <img> is written once, here, and never by a renderer.
    // Decoding is async and low priority: the page is usable
    // before the photograph arrives, and the scrim underneath
    // means nothing flashes unstyled while it does.
    el.innerHTML =
      '<img class="lar-hero__img" id="larHeroImg" src="' + IMG + '" alt="" ' +
        'decoding="async" fetchpriority="low" aria-hidden="true">' +
      '<div class="lar-hero__scrim" aria-hidden="true"></div>' +
      '<div class="lar-hero__in">' +
        '<p class="lar-eyebrow lar-hero__eyebrow" id="larHeroEyebrow">The Larder</p>' +
        '<h1 class="lar-hero__title" id="larHeroLines"></h1>' +
      '</div>' +
      '<div class="lar-hero__card" id="larHeroCard" hidden></div>';

    var before = opts.before || document.getElementById('larRoot');
    if (before && before.parentNode) before.parentNode.insertBefore(el, before);
    else document.body.appendChild(el);

    eyebrowEl = document.getElementById('larHeroEyebrow');
    linesEl = document.getElementById('larHeroLines');
    cardEl = document.getElementById('larHeroCard');
    return el;
  }

  /**
   * Patch the hero to a route.
   *
   * Rebuilds NOTHING unless the route actually changed. On a
   * repaint this is a handful of string compares and no DOM work
   * at all, which is what keeps a cloud pull from restarting the
   * entrance under someone's hands.
   */
  function render(route) {
    if (!el || !route) return;
    var changed = route.hash !== shownRoute;
    if (!changed) { patchCard(route); return; }
    shownRoute = route.hash;

    var c = copyFor(route.hash);
    var full = route.hash === '/';

    el.setAttribute('data-tint', route.tint || 'honey');
    el.classList.toggle('lar-hero--full', full);
    el.classList.toggle('lar-hero--band', !full);

    if (eyebrowEl) eyebrowEl.textContent = c.eyebrow;

    // Each line is its own element carrying its index in --l, so
    // one keyframe and one custom property produce the whole
    // staggered arrival. Line 2 is indented, as the reference has
    // it — the indent is what stops three left-aligned lines
    // reading as a paragraph that happened to break.
    if (linesEl) {
      linesEl.innerHTML = c.lines.map(function (line, i) {
        return '<span class="lar-hero__line" style="--l:' + i + '">' +
          String(line).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      }).join('');
    }

    // Re-arm the entrance. Removing the class, forcing a reflow
    // and putting it back is the only reliable way to restart a
    // CSS animation; without the reflow the browser coalesces the
    // two class changes and nothing happens.
    el.classList.remove('is-arriving');
    void el.offsetWidth;
    el.classList.add('is-arriving');

    patchCard(route);
  }

  /**
   * The card the reference puts on the right. Here it is live:
   * today's three numbers and the way to add to them. It is the
   * page's primary action wearing the reference's clothes, rather
   * than a decorative panel that happens to sit there.
   *
   * Today only — on a 44vh band there is no room for it, and on
   * the grocery screen today's calories are not what you came for.
   */
  function patchCard(route) {
    if (!cardEl) return;
    var L = global.Lar, U = global.LarUI;
    if (!L || !U || route.hash !== '/') { cardEl.hidden = true; cardEl.innerHTML = ''; return; }

    var date = L.today();
    var t = L.totalsFor(date);
    var g = L.getTargets();
    var day = L.getDay(date);
    var filled = L.slotsFilled(date);

    var html =
      '<div class="lar-hero__plate">' +
        '<span class="lar-hero__plate-n lar-num">' + filled + '</span>' +
        '<span class="lar-hero__plate-d lar-num">of 4</span>' +
        '<span class="lar-hero__plate-l">meals</span>' +
      '</div>' +
      '<div class="lar-hero__facts">' +
        '<p class="lar-hero__fact lar-num">' + U.num(t.kcal) +
          ' <span>of ' + U.num(g.kcal) + ' calories</span></p>' +
        '<p class="lar-hero__fact lar-num">' + U.num(t.protein) +
          'g <span>of ' + U.num(g.protein) + 'g protein</span></p>' +
        '<p class="lar-hero__fact lar-num">' + U.water(day.water, g.waterUnit) +
          ' <span>of ' + U.water(g.waterMl, g.waterUnit) + ' water</span></p>' +
        '<button class="lar-hero__go" data-act="log-open">Log food &rarr;</button>' +
      '</div>';

    // Only touch the DOM when the text actually differs, so a
    // repaint mid-animation does not interrupt the card's fade.
    if (cardEl.innerHTML !== html) cardEl.innerHTML = html;
    cardEl.hidden = false;
  }

  /** Height, for navigate()'s scroll decision. No layout work of its own. */
  function measure() { return el ? el.offsetHeight : 0; }

  global.LarHero = {
    mount: mount,
    render: render,
    measure: measure,
    el: function () { return el; }
  };
})(window);
