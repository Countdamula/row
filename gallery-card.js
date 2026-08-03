// gallery-card.js
//
// The JS half of gallery-card.css — a reusable gallery card builder,
// extracted from ent-stories.html's card (really entertainment-hub-ui
// .js's buildCard(), shared by all five Entertainment-folder pages).
// That file is untouched and does not use this one — see gallery-card
// .css's own header comment for why this is a clean parallel extract,
// not a retrofit of already-shipped, already-verified code.
//
// Same "shared UI utility, owns no data of its own" precedent as this
// app's topbar.js/sync.js/photo-store.js/glass-theme.js — GalleryCard
// .build() takes a plain item object and plain callbacks; it never reads
// or writes localStorage/Supabase itself. Persisting a favorite toggle,
// a star rating, or a drag-reorder is entirely the calling page's own
// job (via whatever -data.js that page has) — same division of labor
// entertainment-hub-ui.js's buildCard()/initGalleryPage() already use
// (the card reports the interaction, the page decides whether/how to
// re-render).
//
// REQUIRES: SortableJS (https://cdn.jsdelivr.net/npm/sortablejs@1.15.2)
// already loaded on the page if you use wireSortableGrid() below. build()
// itself has zero dependencies beyond the DOM.

(function (global) {
  'use strict';

  function isValidMediaUrl(value) {
    if (!value) return false;
    try { var u = new URL(String(value)); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }

  function openLink(url) {
    if (!isValidMediaUrl(url)) return false;
    window.open(url, '_blank', 'noopener');
    return true;
  }

  // A 5-star rating row. size: 'sm' (default) or 'lg'. Clicking the
  // currently-set star clears the rating back to 0 (the same "click the
  // same star again to clear" precedent every rating control in this
  // app already uses).
  function buildStars(rating, size, onSet) {
    var wrap = document.createElement('div');
    wrap.className = 'gc-stars' + (size === 'lg' ? ' gc-stars-lg' : '');
    for (var i = 1; i <= 5; i++) {
      (function (i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gc-star' + (i <= rating ? ' on' : '');
        btn.textContent = '★';
        btn.setAttribute('aria-label', 'Rate ' + i + ' star' + (i === 1 ? '' : 's'));
        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          onSet(i === rating ? 0 : i);
        });
        wrap.appendChild(btn);
      })(i);
    }
    return wrap;
  }

  // Builds one gallery card — the exact same DOM shape/behavior as
  // ent-stories.html's own card: a cover (or a fallback icon), a hover-
  // revealed drag handle + edit button, a favorite star toggle, an
  // optional source tag (for an aggregated/cross-page view, like the
  // Entertainment folder's own Favorites page), a serif title/creator/
  // subtopic, a clamped description, a star-rating row, and a length
  // readout. Clicking the card opens item.url in a new tab; if that URL
  // isn't valid/present, it calls opts.onEdit instead (so a card with no
  // link yet still does something useful on click).
  //
  // item = {id, title, creator, subtopic, cover, description,
  //         lengthText, rating, favorite, url} — extra fields ignored.
  // opts = {
  //   fallbackIcon (shown when item.cover is empty or fails to load),
  //   draggable (adds the ⋮⋮ handle — you still wire the actual drag
  //     yourself, e.g. via wireSortableGrid() below),
  //   showSourceTag + sourceIcon + sourceLabel (an aggregated-view tag,
  //     e.g. "📖 Stories", bottom-left of the cover),
  //   onEdit: function(item) {},
  //   onOpenFallback: function(item) {} (alias for onEdit — called when
  //     item.url isn't openable; either name works, onEdit wins if both
  //     are given),
  //   onFavoriteToggle: function(item) {} — called after the star is
  //     clicked; toggle+persist+re-render is entirely up to you,
  //   onRatingChange: function(item, newRating) {} — same idea
  // }
  function build(item, opts) {
    opts = opts || {};
    var card = document.createElement('div');
    card.className = 'gc-card';
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'link');

    var coverWrap = document.createElement('div');
    coverWrap.className = 'gc-card-cover-wrap';
    var fallback = document.createElement('div');
    fallback.className = 'gc-card-cover-fallback';
    fallback.textContent = opts.fallbackIcon || '🖼';
    if (item.cover) {
      var img = document.createElement('img');
      img.className = 'gc-card-cover';
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.cover;
      img.addEventListener('error', function () { img.style.display = 'none'; fallback.style.display = 'flex'; });
      coverWrap.appendChild(img);
      fallback.style.display = 'none';
    } else {
      fallback.style.display = 'flex';
    }
    coverWrap.appendChild(fallback);
    var scrim = document.createElement('div');
    scrim.className = 'gc-card-cover-scrim';
    coverWrap.appendChild(scrim);

    // Drag handle + edit, hover-revealed, top-left.
    var actions = document.createElement('div');
    actions.className = 'gc-card-actions';
    if (opts.draggable) {
      var handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'gc-card-icon-btn gc-card-drag'; handle.textContent = '⋮⋮';
      handle.setAttribute('aria-label', 'Drag to reorder');
      // A tap that doesn't turn into a real drag still fires a click —
      // stop it from bubbling up to the card's own "open" handler, same
      // guard the favorite/edit buttons already have.
      handle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      actions.appendChild(handle);
    }
    if (opts.onEdit || opts.onOpenFallback) {
      var editBtn = document.createElement('button');
      editBtn.type = 'button'; editBtn.className = 'gc-card-icon-btn'; editBtn.textContent = '✎';
      editBtn.setAttribute('aria-label', 'Edit');
      editBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        (opts.onEdit || opts.onOpenFallback)(item);
      });
      actions.appendChild(editBtn);
    }
    coverWrap.appendChild(actions);

    // Favorite star toggle, top-right.
    if (opts.onFavoriteToggle) {
      var favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'gc-card-fav-btn' + (item.favorite ? ' on' : '');
      favBtn.textContent = item.favorite ? '★' : '☆';
      favBtn.setAttribute('aria-label', item.favorite ? 'Remove from Favorites' : 'Add to Favorites');
      favBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        opts.onFavoriteToggle(item);
      });
      coverWrap.appendChild(favBtn);
    }

    if (opts.showSourceTag) {
      var tag = document.createElement('div');
      tag.className = 'gc-card-source-tag';
      tag.textContent = (opts.sourceIcon ? opts.sourceIcon + ' ' : '') + (opts.sourceLabel || '');
      coverWrap.appendChild(tag);
    }

    card.appendChild(coverWrap);

    var body = document.createElement('div');
    body.className = 'gc-card-body';
    var title = document.createElement('div'); title.className = 'gc-card-title'; title.textContent = item.title || 'Untitled';
    body.appendChild(title);
    if (item.creator) {
      var creator = document.createElement('div'); creator.className = 'gc-card-creator'; creator.textContent = item.creator;
      body.appendChild(creator);
    }
    if (item.subtopic) {
      var subtopic = document.createElement('div'); subtopic.className = 'gc-card-subtopic'; subtopic.textContent = item.subtopic;
      body.appendChild(subtopic);
    }
    if (item.description) {
      var desc = document.createElement('div'); desc.className = 'gc-card-desc'; desc.textContent = item.description;
      body.appendChild(desc);
    }
    var metaRow = document.createElement('div'); metaRow.className = 'gc-card-meta-row';
    if (opts.onRatingChange) {
      var stars = buildStars(item.rating || 0, 'sm', function (r) { opts.onRatingChange(item, r); });
      metaRow.appendChild(stars);
    }
    if (item.lengthText) {
      var len = document.createElement('span'); len.className = 'gc-card-length'; len.textContent = item.lengthText;
      metaRow.appendChild(len);
    }
    if (metaRow.children.length) body.appendChild(metaRow);
    card.appendChild(body);

    function activate() {
      if (!openLink(item.url)) { if (opts.onEdit || opts.onOpenFallback) (opts.onEdit || opts.onOpenFallback)(item); }
    }
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });

    return card;
  }

  // Wires SortableJS onto a .gc-grid (or any grid of cards built via
  // build({draggable:true}, ...)) with the exact same touch-scroll-safety
  // tuning entertainment-hub-ui.js's own grid already uses — a card drag
  // only starts after a brief hold on the ⋮⋮ handle, so scrolling past a
  // card on a phone can't accidentally reorder it. Returns the Sortable
  // instance, or null if SortableJS isn't loaded.
  function wireSortableGrid(grid, onReorder) {
    if (!grid || !global.Sortable) return null;
    return global.Sortable.create(grid, {
      handle: '.gc-card-drag',
      animation: global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
      delay: 150, delayOnTouchOnly: true, touchStartThreshold: 6,
      onEnd: function () {
        var ids = Array.prototype.map.call(grid.children, function (el) { return el.dataset.id; });
        if (typeof onReorder === 'function') onReorder(ids);
      }
    });
  }

  global.GalleryCard = {
    build: build,
    buildStars: buildStars,
    openLink: openLink,
    isValidMediaUrl: isValidMediaUrl,
    wireSortableGrid: wireSortableGrid
  };
})(window);
