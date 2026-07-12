// household-data.js
//
// Shared data foundation for household.html: typed-by-JSDoc models, a
// localStorage-backed data-access layer, and pure derived selectors — same
// shape/conventions as finance-data.js (see CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB.
// All keys live under a `household:` prefix so household.html's
// initCloudSync({ syncedPrefixes: ['household:'] }) call covers every
// collection with no per-key list.
//
// Images (Energy Being sigils, Inventory/Wishlist item photos) are stored
// the same way every other page in this app stores images: downscaled
// client-side via `compressImageDataUrl()` (canvas resize + JPEG re-encode)
// into a base64 `data:` URL, then held directly on the record — no
// Supabase Storage bucket, no IndexedDB, no filesystem. That base64 string
// rides along through `collect()`/`pushNow()` in sync.js into the
// Supabase `app_state.data` JSONB blob exactly like every other image in
// this codebase (equipment/banner photos in gym.html, cover art in
// entertainment.html/nutrition.html). `compressImageDataUrl` is exported
// here so a future UI layer doesn't need its own copy of the canvas logic
// — it only needs to wire up a `<input type="file">` + FileReader.
//
// This step is data-layer only — no UI reads this yet.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same storeGet/storeSet shim used by every other page
  // in this app (finance.html, index.html, etc.).
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const KEYS = {
    legions: 'household:legions',
    beings: 'household:beings',
    chargeLog: 'household:chargeLog',
    inventory: 'household:inventory',
    wishlist: 'household:wishlist',
    chores: 'household:chores',
    seeded: 'household:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // DATE HELPERS — local-date-safe "YYYY-MM-DD" strings. Never
  // round-trip a bare date through `new Date(isoString)`, which parses
  // as UTC midnight and can land on the wrong day depending on the
  // browser's timezone — same convention as finance-data.js.
  // ============================================================
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function localDateFromISO(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function addDaysISO(iso, days) {
    const d = localDateFromISO(iso) || new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /** Whole days from today to iso; negative = overdue/in the past. Null if iso is unparseable. */
  function daysUntil(iso) {
    const d = localDateFromISO(iso);
    if (!d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  // ============================================================
  // CURRENCY — the one shared helper for parsing user input into
  // integer cents and formatting cents back for display, mirroring
  // finance-data.js's FinanceCurrency (no multi-currency need here,
  // so this is the same recipe kept intentionally small).
  // ============================================================
  const CurrencyConfig = { currency: 'USD', locale: 'en-US' };
  const HouseholdCurrency = {
    configure(opts) {
      if (opts && opts.currency) CurrencyConfig.currency = opts.currency;
      if (opts && opts.locale) CurrencyConfig.locale = opts.locale;
    },
    /** "12.50", "1,234.56", 12.5, "-4.20" -> integer cents. Never a float. */
    parseToCents(input) {
      if (input == null || input === '') return 0;
      if (typeof input === 'number') return Math.round(input * 100);
      let s = String(input).trim();
      const negative = s.indexOf('-') !== -1;
      s = s.replace(/[^0-9.,]/g, '');
      if (!s) return 0;
      const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
      let intPart, fracPart;
      if (lastSep === -1) { intPart = s; fracPart = ''; }
      else {
        intPart = s.slice(0, lastSep).replace(/[.,]/g, '');
        fracPart = s.slice(lastSep + 1).replace(/[^0-9]/g, '');
      }
      const n = parseFloat((intPart || '0') + '.' + (fracPart || '0'));
      if (isNaN(n)) return 0;
      return Math.round((negative ? -1 : 1) * n * 100);
    },
    /** integer cents (or null) -> "$12.50" / "—". */
    format(cents, opts) {
      if (cents == null) return '—';
      const currency = (opts && opts.currency) || CurrencyConfig.currency;
      const locale = (opts && opts.locale) || CurrencyConfig.locale;
      const amount = (Number(cents) || 0) / 100;
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount); }
      catch (e) { return currency + ' ' + amount.toFixed(2); }
    }
  };

  // ============================================================
  // IMAGES — downscale + re-encode on upload, same recipe as
  // gym.html/entertainment.html/nutrition.html's compressImageDataUrl.
  // Callers pass the raw FileReader dataURL; this returns a Promise of
  // the compressed dataURL (falls back to the original on any error).
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 640;
    quality = quality == null ? 0.75 : quality;
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  // ============================================================
  // MODELS — no build step / no TypeScript in this repo, so "typed"
  // means a JSDoc @typedef (for editor hints) plus a factory that
  // fills every field with a sane default, matching finance-data.js's
  // convention. Fields explicitly called out as nullable default to
  // `null` (meaning "not set"); other optional text fields default to
  // `''`.
  // ============================================================

  const LEGION_COLORS = ['gold', 'purple', 'indigo', 'orange', 'teal', 'rose', 'cyan'];

  /**
   * @typedef {Object} Legion
   * @property {string} id
   * @property {string} name
   * @property {string} purpose
   * @property {string} color - one of LEGION_COLORS
   * @property {number} order - manual sort key (up/down reorder)
   * @property {string} createdAt - ISO date
   */
  function legionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('legion'),
      name: data.name || '',
      purpose: data.purpose || '',
      color: LEGION_COLORS.indexOf(data.color) !== -1 ? data.color : LEGION_COLORS[0],
      order: data.order != null ? data.order : Date.now(),
      createdAt: data.createdAt || todayISO()
    };
  }

  const BEING_TYPES = ['servitor', 'egregore', 'familiar', 'guardian', 'elemental', 'other'];
  const BEING_STATUSES = ['active', 'dormant', 'retired'];

  /**
   * @typedef {Object} EnergyBeing
   * @property {string} id
   * @property {string} name
   * @property {'servitor'|'egregore'|'familiar'|'guardian'|'elemental'|'other'} type
   * @property {string} purpose - intent/task
   * @property {?string} legionId - null = unassigned
   * @property {?string} sigilImageUrl - compressed data: URL, or null
   * @property {string} appearance
   * @property {string} activationPhrase
   * @property {string} energySource
   * @property {?number} chargeFrequencyDays - null = no recurring charge schedule
   * @property {?string} lastChargedDate - ISO date, or null if never charged
   * @property {number} strength - 1-10
   * @property {'active'|'dormant'|'retired'} status
   * @property {string[]} tags - domain/tag labels
   * @property {string} dissolutionMethod
   * @property {string} notes
   * @property {string} createdAt - ISO date
   */
  function beingModel(data) {
    data = data || {};
    return {
      id: data.id || uid('being'),
      name: data.name || '',
      type: BEING_TYPES.indexOf(data.type) !== -1 ? data.type : 'servitor',
      purpose: data.purpose || '',
      legionId: data.legionId || null,
      sigilImageUrl: data.sigilImageUrl || null,
      appearance: data.appearance || '',
      activationPhrase: data.activationPhrase || '',
      energySource: data.energySource || '',
      chargeFrequencyDays: data.chargeFrequencyDays != null ? Math.max(1, Math.round(Number(data.chargeFrequencyDays)) || 1) : null,
      lastChargedDate: data.lastChargedDate || null,
      strength: Math.min(10, Math.max(1, Math.round(Number(data.strength)) || 5)),
      status: BEING_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      dissolutionMethod: data.dissolutionMethod || '',
      notes: data.notes || '',
      createdAt: data.createdAt || todayISO()
    };
  }

  /**
   * @typedef {Object} ChargeLog
   * @property {string} id
   * @property {string} beingId
   * @property {string} date - ISO date
   * @property {string} note
   * @property {string} createdAt - ISO date
   */
  function chargeLogModel(data) {
    data = data || {};
    return {
      id: data.id || uid('charge'),
      beingId: data.beingId || null,
      date: data.date || todayISO(),
      note: data.note || '',
      createdAt: data.createdAt || todayISO()
    };
  }

  /**
   * @typedef {Object} InventoryItem
   * @property {string} id
   * @property {string} name
   * @property {string} category
   * @property {string} location - room/storage
   * @property {number} quantity
   * @property {string} unit
   * @property {number} minQuantity - restock threshold
   * @property {?string} expiryDate - ISO date, or null
   * @property {?string} imageUrl - compressed data: URL, or null
   * @property {string} notes
   * @property {string} createdAt - ISO date
   */
  function inventoryItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('inv'),
      name: data.name || '',
      category: data.category || '',
      location: data.location || '',
      quantity: Number(data.quantity) || 0,
      unit: data.unit || '',
      minQuantity: Number(data.minQuantity) || 0,
      expiryDate: data.expiryDate || null,
      imageUrl: data.imageUrl || null,
      notes: data.notes || '',
      createdAt: data.createdAt || todayISO()
    };
  }

  const WISHLIST_PRIORITIES = ['low', 'med', 'high'];

  /**
   * @typedef {Object} WishlistItem
   * @property {string} id
   * @property {string} name
   * @property {string} category
   * @property {'low'|'med'|'high'} priority
   * @property {?number} priceCents - integer minor units, or null if unknown
   * @property {?string} url
   * @property {string} store
   * @property {?string} imageUrl - compressed data: URL, or null
   * @property {boolean} purchased
   * @property {string} notes
   * @property {string} createdAt - ISO date
   */
  function wishlistItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('wish'),
      name: data.name || '',
      category: data.category || '',
      priority: WISHLIST_PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'med',
      priceCents: data.priceCents == null ? null : Math.abs(Math.round(Number(data.priceCents)) || 0),
      url: data.url || null,
      store: data.store || '',
      imageUrl: data.imageUrl || null,
      purchased: !!data.purchased,
      notes: data.notes || '',
      createdAt: data.createdAt || todayISO()
    };
  }

  const CHORE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'];
  const CHORE_STATUSES = ['active', 'paused'];
  const FREQUENCY_DAYS = { daily: 1, weekly: 7, monthly: 30 };

  /**
   * @typedef {Object} Chore
   * @property {string} id
   * @property {string} name
   * @property {string} area - room/area
   * @property {?string} assignee - null = unassigned
   * @property {'daily'|'weekly'|'monthly'|'custom'} frequency
   * @property {number} intervalDays - only meaningful when frequency === 'custom'
   * @property {?string} lastDone - ISO date, or null if never done
   * @property {'active'|'paused'} status
   * @property {string} notes
   * @property {string} createdAt - ISO date, used as the due-date anchor before lastDone is ever set
   */
  function choreModel(data) {
    data = data || {};
    return {
      id: data.id || uid('chore'),
      name: data.name || '',
      area: data.area || '',
      assignee: data.assignee || null,
      frequency: CHORE_FREQUENCIES.indexOf(data.frequency) !== -1 ? data.frequency : 'weekly',
      intervalDays: Math.max(1, Number(data.intervalDays) || 7),
      lastDone: data.lastDone || null,
      status: CHORE_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      notes: data.notes || '',
      createdAt: data.createdAt || todayISO()
    };
  }

  // ============================================================
  // DATA ACCESS — list / get / add / update / remove per collection.
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list();
      all.push(record);
      storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      // Re-run through the model factory so patched fields stay coerced
      // (numbers, enums, cents) and unknown/missing fields keep their
      // defaults — same precedent as finance-data.js's makeCollection.
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      const all = list();
      const next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    return { list: list, get: get, add: add, update: update, remove: remove };
  }

  const Legions = makeCollection(KEYS.legions, legionModel);
  const Beings = makeCollection(KEYS.beings, beingModel);
  const ChargeLogs = makeCollection(KEYS.chargeLog, chargeLogModel);
  const Inventory = makeCollection(KEYS.inventory, inventoryItemModel);
  const Wishlist = makeCollection(KEYS.wishlist, wishlistItemModel);
  const Chores = makeCollection(KEYS.chores, choreModel);

  // Deleting a legion shouldn't cascade-delete its beings — the same
  // "null out the reference, don't cascade-delete" precedent as
  // gym.html's equipment deletion. Beings whose legionId pointed at the
  // deleted legion just fall back to "unassigned".
  function removeLegion(id) {
    const removed = Legions.remove(id);
    if (removed) {
      const beings = Beings.list();
      let changed = false;
      beings.forEach(function (b) { if (b.legionId === id) { b.legionId = null; changed = true; } });
      if (changed) storeSet(KEYS.beings, beings);
    }
    return removed;
  }

  // Deleting a being shouldn't leave orphaned charge-log rows behind.
  function removeBeing(id) {
    const removed = Beings.remove(id);
    if (removed) {
      const logs = ChargeLogs.list();
      const next = logs.filter(function (l) { return l.beingId !== id; });
      if (next.length !== logs.length) storeSet(KEYS.chargeLog, next);
    }
    return removed;
  }

  /**
   * Log a charging/feeding session for a being AND stamp its
   * lastChargedDate — the one write path that keeps ChargeLog and
   * EnergyBeing.lastChargedDate in sync, since beingsNeedingCharge()
   * below depends on lastChargedDate staying accurate.
   */
  function logCharge(beingId, note, date) {
    if (!Beings.get(beingId)) return null;
    const entryDate = date || todayISO();
    const entry = ChargeLogs.add({ beingId: beingId, date: entryDate, note: note || '' });
    Beings.update(beingId, { lastChargedDate: entryDate });
    return entry;
  }

  function chargeLogForBeing(beingId) {
    return ChargeLogs.list()
      .filter(function (l) { return l.beingId === beingId; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
  }

  /**
   * Delete a charge-log entry and recompute its being's lastChargedDate
   * from whatever entries remain (the latest by date, or null if none
   * are left) — keeps the two in sync the same way logCharge() does on
   * the write side, so beingsNeedingCharge() stays accurate after a
   * correction/deletion instead of trusting a now-stale stamp.
   */
  function removeChargeLog(id) {
    const entry = ChargeLogs.get(id);
    if (!entry) return false;
    const removed = ChargeLogs.remove(id);
    if (removed && entry.beingId && Beings.get(entry.beingId)) {
      const remaining = chargeLogForBeing(entry.beingId);
      Beings.update(entry.beingId, { lastChargedDate: remaining.length ? remaining[0].date : null });
    }
    return removed;
  }

  /** Compute a chore's next-due ISO date from lastDone (or createdAt if never done) + frequency/intervalDays. */
  function nextDue(chore) {
    const anchor = chore.lastDone || chore.createdAt;
    const interval = chore.frequency === 'custom' ? Math.max(1, Number(chore.intervalDays) || 1) : (FREQUENCY_DAYS[chore.frequency] || 7);
    return addDaysISO(anchor, interval);
  }

  /** Mark a chore done (defaults to today) — the write path nextDue()/choresDue() read back from. */
  function markChoreDone(id, date) {
    return Chores.update(id, { lastDone: date || todayISO() });
  }

  function normalizedName(name) { return String(name || '').trim().toLowerCase(); }

  /**
   * Bridge: a low-stock Inventory item -> Wishlist. Merges by name
   * (case-insensitive) instead of creating a duplicate: if a matching
   * wishlist entry already exists and is marked purchased, it's
   * reactivated (you're out again, so it belongs back on the list)
   * rather than left sitting there stale; if it's already unpurchased,
   * nothing changes. Returns { item, created, reactivated }, or null if
   * the inventory item doesn't exist.
   */
  function addInventoryItemToWishlist(inventoryItemId) {
    const inv = Inventory.get(inventoryItemId);
    if (!inv) return null;
    const norm = normalizedName(inv.name);
    const existing = norm ? Wishlist.list().find(function (w) { return normalizedName(w.name) === norm; }) : null;
    if (existing) {
      if (existing.purchased) return { item: Wishlist.update(existing.id, { purchased: false }), created: false, reactivated: true };
      return { item: existing, created: false, reactivated: false };
    }
    const created = Wishlist.add({
      name: inv.name,
      category: inv.category,
      priority: 'med',
      priceCents: null,
      url: null,
      store: '',
      imageUrl: inv.imageUrl,
      purchased: false,
      notes: 'Added from a low-stock Inventory item.'
    });
    return { item: created, created: true, reactivated: false };
  }

  /**
   * Bridge: a purchased Wishlist item -> Inventory. Merges by name
   * (case-insensitive): bumps quantity on an existing match rather
   * than creating a duplicate line, otherwise creates a new item with
   * quantity 1. Returns { item, created }, or null if the wishlist
   * item doesn't exist.
   */
  function addWishlistItemToInventory(wishlistItemId) {
    const wish = Wishlist.get(wishlistItemId);
    if (!wish) return null;
    const norm = normalizedName(wish.name);
    const existing = norm ? Inventory.list().find(function (i) { return normalizedName(i.name) === norm; }) : null;
    if (existing) return { item: Inventory.update(existing.id, { quantity: existing.quantity + 1 }), created: false };
    const created = Inventory.add({
      name: wish.name,
      category: wish.category,
      location: '',
      quantity: 1,
      unit: '',
      minQuantity: 0,
      imageUrl: wish.imageUrl,
      notes: 'Added from a purchased Wishlist item.'
    });
    return { item: created, created: true };
  }

  // ============================================================
  // DERIVED SELECTORS — pure functions over the collections above,
  // re-derived on every call, not cached.
  // ============================================================

  /** Beings grouped by legion (sorted by legion.order), with an "Unassigned" group last. */
  function energyBeingsByLegion() {
    const beings = Beings.list();
    const legions = Legions.list().slice().sort(function (a, b) { return a.order - b.order; });
    const legionIds = legions.map(function (l) { return l.id; });
    const groups = legions.map(function (legion) {
      return { legion: legion, beings: beings.filter(function (b) { return b.legionId === legion.id; }) };
    });
    // Anything whose legionId is null OR points at a legion that no
    // longer exists (defensive — shouldn't happen given removeLegion()
    // nulls references, but keeps this selector correct even if a
    // record was edited/imported out-of-band) counts as unassigned.
    const unassigned = beings.filter(function (b) { return !b.legionId || legionIds.indexOf(b.legionId) === -1; });
    groups.push({ legion: null, beings: unassigned });
    return groups;
  }

  /** Active beings whose charge schedule has lapsed (or that have never been charged). */
  function beingsNeedingCharge() {
    return Beings.list().filter(function (b) {
      if (b.status !== 'active' || b.chargeFrequencyDays == null) return false;
      if (!b.lastChargedDate) return true;
      return daysUntil(addDaysISO(b.lastChargedDate, b.chargeFrequencyDays)) <= 0;
    });
  }

  /** Items at or below their restock threshold, lowest-relative-stock first. */
  function lowStockItems() {
    return Inventory.list()
      .filter(function (i) { return i.quantity <= i.minQuantity; })
      .sort(function (a, b) { return (a.quantity - a.minQuantity) - (b.quantity - b.minQuantity); });
  }

  /** Active chores whose next-due date is today or in the past, most-overdue first. */
  function choresDue() {
    return Chores.list()
      .filter(function (c) { return c.status === 'active'; })
      .map(function (c) { return Object.assign({}, c, { _nextDue: nextDue(c) }); })
      .map(function (c) { return Object.assign({}, c, { _daysUntil: daysUntil(c._nextDue) }); })
      .filter(function (c) { return c._daysUntil != null && c._daysUntil <= 0; })
      .sort(function (a, b) { return a._daysUntil - b._daysUntil; });
  }

  /** Sum of priceCents (nulls treated as 0) across unpurchased wishlist items. */
  function wishlistTotalCents() {
    return Wishlist.list()
      .filter(function (w) { return !w.purchased; })
      .reduce(function (sum, w) { return sum + (w.priceCents || 0); }, 0);
  }

  /** Unpurchased items, highest priority first (ties broken by price desc) — feeds the Overview highlights panel. */
  function topWishlistItems(limit) {
    const rank = { high: 0, med: 1, low: 2 };
    return Wishlist.list()
      .filter(function (w) { return !w.purchased; })
      .slice()
      .sort(function (a, b) {
        const r = rank[a.priority] - rank[b.priority];
        return r !== 0 ? r : (b.priceCents || 0) - (a.priceCents || 0);
      })
      .slice(0, limit == null ? 5 : limit);
  }

  // ============================================================
  // SEED DATA — a small, realistic starter set so a future UI has
  // something to render. Runs once, guarded by household:seeded, and
  // only if every collection is already empty (so it can never clobber
  // real data added later) — same precedent as finance-data.js's
  // seedIfEmpty(). Dates are computed relative to today (not hardcoded)
  // so the "needs attention" selectors above always have something
  // meaningful to show regardless of when this runs.
  // ============================================================
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Legions.list().length || Beings.list().length || ChargeLogs.list().length
      || Inventory.list().length || Wishlist.list().length || Chores.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }

    const dawn = Legions.add({ name: 'Dawn Ward', purpose: 'Morning clarity and momentum', color: 'gold', order: 1 });
    const threshold = Legions.add({ name: 'Threshold Guard', purpose: 'Protection of the home boundary', color: 'indigo', order: 2 });

    const today = todayISO();
    const sentinel = Beings.add({
      name: 'Sentinel of the Threshold', type: 'guardian', purpose: 'Watches the front door and turns away discord',
      legionId: threshold.id, appearance: 'A tall, faceless figure of woven grey smoke', activationPhrase: 'Stand and ward',
      energySource: 'Candle flame + spoken intent', chargeFrequencyDays: 14, lastChargedDate: addDaysISO(today, -20),
      strength: 7, status: 'active', tags: ['protection', 'home'], dissolutionMethod: 'Thank it, then let the candle burn out fully',
      notes: 'Recharge at the front door itself, not indoors.'
    });
    const emberkin = Beings.add({
      name: 'Emberkin', type: 'servitor', purpose: 'Guards the morning routine and keeps procrastination at bay',
      legionId: dawn.id, appearance: 'A small ember-orange fox shape', activationPhrase: 'Rise and burn',
      energySource: 'Sunlight + morning coffee ritual', chargeFrequencyDays: 7, lastChargedDate: addDaysISO(today, -2),
      strength: 5, status: 'active', tags: ['motivation', 'routine'], dissolutionMethod: 'Release into a sunrise',
      notes: ''
    });
    Beings.add({
      name: 'Old Egregore of the Study', type: 'egregore', purpose: 'Retired — used to hold focus during exam season',
      legionId: null, appearance: 'A dim, book-shaped haze', activationPhrase: '', energySource: '',
      chargeFrequencyDays: null, lastChargedDate: null, strength: 3, status: 'retired',
      tags: ['study', 'archived'], dissolutionMethod: 'Already dissolved, kept for the log', notes: 'No longer active.'
    });

    logCharge(sentinel.id, 'Fresh candle, clear intent restated', addDaysISO(today, -20));
    logCharge(emberkin.id, 'Quick charge with morning coffee', addDaysISO(today, -9));
    logCharge(emberkin.id, 'Recharged after a slow week', addDaysISO(today, -2));

    Inventory.add({ name: 'Paper towels', category: 'Kitchen', location: 'Under the sink', quantity: 2, unit: 'rolls', minQuantity: 5, notes: '' });
    Inventory.add({ name: 'White sage bundles', category: 'Ritual supplies', location: 'Altar drawer', quantity: 1, unit: 'bundles', minQuantity: 2, notes: 'For clearing the threshold sentinel’s space' });
    Inventory.add({ name: 'Dish soap', category: 'Kitchen', location: 'Under the sink', quantity: 3, unit: 'bottles', minQuantity: 1, notes: '' });

    Wishlist.add({ name: 'Cast iron skillet', category: 'Kitchen', priority: 'high', priceCents: 4599, url: 'https://example.com/skillet', store: 'Home goods store', purchased: false, notes: '' });
    Wishlist.add({ name: 'Beeswax candles (set of 12)', category: 'Ritual supplies', priority: 'med', priceCents: 2400, url: null, store: 'Local market', purchased: false, notes: 'For charging sessions' });
    Wishlist.add({ name: 'Air purifier', category: 'Bedroom', priority: 'low', priceCents: 8900, url: null, store: '', purchased: true, notes: 'Already bought, keeping for the record' });

    const plants = Chores.add({ name: 'Water the plants', area: 'Living room', assignee: null, frequency: 'weekly', intervalDays: 7, status: 'active', notes: '' });
    markChoreDone(plants.id, addDaysISO(today, -9));
    Chores.add({ name: 'Deep clean the altar', area: 'Study', assignee: null, frequency: 'monthly', intervalDays: 30, lastDone: null, status: 'active', notes: 'Also a good time to recharge the study egregore if it’s reactivated' });
    Chores.add({ name: 'Take out recycling', area: 'Kitchen', assignee: 'Housemate', frequency: 'custom', intervalDays: 3, lastDone: addDaysISO(today, -1), status: 'active', notes: '' });

    storeSet(KEYS.seeded, true);
  }
  seedIfEmpty();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.HouseholdData = {
    KEYS: KEYS,
    LEGION_COLORS: LEGION_COLORS,
    BEING_TYPES: BEING_TYPES,
    BEING_STATUSES: BEING_STATUSES,
    WISHLIST_PRIORITIES: WISHLIST_PRIORITIES,
    CHORE_FREQUENCIES: CHORE_FREQUENCIES,
    CHORE_STATUSES: CHORE_STATUSES,
    Currency: HouseholdCurrency,
    Models: {
      legion: legionModel,
      being: beingModel,
      chargeLog: chargeLogModel,
      inventoryItem: inventoryItemModel,
      wishlistItem: wishlistItemModel,
      chore: choreModel
    },
    Legions: Object.assign({}, Legions, { remove: removeLegion }),
    Beings: Object.assign({}, Beings, { remove: removeBeing }),
    ChargeLogs: ChargeLogs,
    Inventory: Inventory,
    Wishlist: Wishlist,
    Chores: Chores,
    logCharge: logCharge,
    removeChargeLog: removeChargeLog,
    chargeLogForBeing: chargeLogForBeing,
    markChoreDone: markChoreDone,
    nextDue: nextDue,
    compressImageDataUrl: compressImageDataUrl,
    daysUntil: daysUntil,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    energyBeingsByLegion: energyBeingsByLegion,
    beingsNeedingCharge: beingsNeedingCharge,
    lowStockItems: lowStockItems,
    choresDue: choresDue,
    wishlistTotalCents: wishlistTotalCents,
    topWishlistItems: topWishlistItems,
    addInventoryItemToWishlist: addInventoryItemToWishlist,
    addWishlistItemToInventory: addWishlistItemToInventory,
    seedIfEmpty: seedIfEmpty
  };
})(window);
