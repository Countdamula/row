// nutrition-data.js
//
// Shared data foundation for the Nutrition tab: typed-by-JSDoc models, a
// localStorage-backed data-access layer, and pure derived selectors/actions.
// Included by nutrition.html (`<script src="nutrition-data.js" defer>`) and
// read/written by both of its sections — My Kitchen (Recipes/
// RecipeIngredients) and Grocery List (Stores/GroceryItems), bridged by
// addRecipeIngredientsToGroceryList().
//
// Persistence matches this codebase's existing pattern (see CLAUDE.md §4):
// plain localStorage, JSON-serialized, one key per collection, no server/DB.
// Keys live under a `nutrition:` prefix (same convention as `study:`,
// `media:`, `braindump:`) so a future sync.js wiring can sync all of them
// via a single `syncedPrefixes: ['nutrition:']` entry, same call pattern as
// every other page — nothing new to invent there.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same storeGet/storeSet shim used by every other page
  // in this app (finance.html, index.html, finance-data.js, etc.).
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const KEYS = {
    stores: 'nutrition:stores',
    groceryItems: 'nutrition:groceryItems',
    recipes: 'nutrition:recipes',
    recipeIngredients: 'nutrition:recipeIngredients',
    seeded: 'nutrition:seeded',
    stepsMigratedV1: 'nutrition:stepsMigratedV1',
    tabs: 'nutrition:tabs',
    widgets: 'nutrition:widgets',
    boardSeeded: 'nutrition:boardSeeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // DATE HELPERS — local-date-safe, same convention as finance-data.js:
  // plain "YYYY-MM-DD" strings, never round-tripped through `new
  // Date(isoString)` (which parses as UTC and can land on the wrong day).
  // ============================================================
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale-then-JPEG
  // recipe and http(s)-only URL check as dreamboard-data.js/
  // household-data.js/etc. Used by the board engine below (hero cover
  // photos, Photo/Video Grid + Feature Card widgets); the My Kitchen
  // recipe/step image upload flow already has its own copy of this same
  // recipe inline in nutrition.html and is left untouched.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 640;
    quality = quality == null ? 0.78 : quality;
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
  function isValidMediaUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  // ============================================================
  // MODELS — no build step / no TypeScript in this repo, so "typed"
  // means a JSDoc @typedef (for editor hints) plus a factory that fills
  // every field with a sane default, same convention as finance-data.js.
  // ============================================================

  /**
   * @typedef {Object} Store
   * @property {string} id
   * @property {string} name
   * @property {string} color
   * @property {number} order - sort key for manual reordering
   */
  function storeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('store'),
      name: data.name || '',
      color: data.color || '#7DD3FC',
      order: data.order != null ? data.order : Date.now()
    };
  }

  /**
   * @typedef {Object} GroceryItem
   * @property {string} id
   * @property {string} name
   * @property {number|string} quantity
   * @property {string} unit
   * @property {?string} storeId - null means "Unassigned"
   * @property {boolean} checked
   * @property {string} notes
   * @property {string} addedAt - ISO date (YYYY-MM-DD)
   * @property {number} order - sort key for manual drag-reorder within a store group
   */
  function groceryItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('gi'),
      name: data.name || '',
      quantity: data.quantity != null ? data.quantity : 1,
      unit: data.unit || '',
      storeId: data.storeId || null,
      checked: data.checked != null ? !!data.checked : false,
      notes: data.notes || '',
      addedAt: data.addedAt || todayISO(),
      order: data.order != null ? data.order : Date.now()
    };
  }

  /**
   * @typedef {Object} RecipeStep
   * @property {string} text
   * @property {?string} imageUrl - optional photo attached to this step
   */
  function normalizeStep(s) {
    if (s && typeof s === 'object') return { text: s.text || '', imageUrl: s.imageUrl || null };
    return { text: s == null ? '' : String(s), imageUrl: null };
  }

  /**
   * @typedef {Object} Recipe
   * @property {string} id
   * @property {string} title
   * @property {string} description
   * @property {number} servings
   * @property {number} prepTimeMin
   * @property {number} cookTimeMin
   * @property {string[]} tags
   * @property {RecipeStep[]} steps - ordered, each with an optional image
   * @property {string} notes
   * @property {boolean} isFavorite
   * @property {?string} imageUrl
   * @property {string} createdAt - ISO date (YYYY-MM-DD)
   * @property {number} order - sort key for manual drag-reorder in the gallery
   */
  function recipeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('recipe'),
      title: data.title || '',
      description: data.description || '',
      servings: Math.max(1, Math.round(Number(data.servings) || 1)),
      prepTimeMin: Math.max(0, Math.round(Number(data.prepTimeMin) || 0)),
      cookTimeMin: Math.max(0, Math.round(Number(data.cookTimeMin) || 0)),
      tags: Array.isArray(data.tags) ? data.tags.slice() : [],
      steps: Array.isArray(data.steps) ? data.steps.map(normalizeStep) : [],
      notes: data.notes || '',
      isFavorite: data.isFavorite != null ? !!data.isFavorite : false,
      imageUrl: data.imageUrl || null,
      createdAt: data.createdAt || todayISO(),
      order: data.order != null ? data.order : Date.now()
    };
  }

  /**
   * @typedef {Object} RecipeIngredient
   * @property {string} id
   * @property {string} recipeId
   * @property {string} name
   * @property {number|string} amount - free-form (e.g. "1/2", "to taste")
   * @property {string} unit
   * @property {number} order - sort key for ingredient list order
   */
  function recipeIngredientModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ing'),
      recipeId: data.recipeId || null,
      name: data.name || '',
      amount: data.amount != null ? data.amount : '',
      unit: data.unit || '',
      order: data.order != null ? data.order : Date.now()
    };
  }

  // ============================================================
  // DATA ACCESS — list / get / add / update / remove per collection.
  // Every collection is one JSON array under one localStorage key, same
  // shape/helper as finance-data.js's makeCollection.
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
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const GroceryItems = makeCollection(KEYS.groceryItems, groceryItemModel);
  const RecipeIngredients = makeCollection(KEYS.recipeIngredients, recipeIngredientModel);

  // Stores.remove is wrapped to reassign that store's grocery items to
  // "Unassigned" (storeId: null) rather than leaving them pointing at a
  // dead store id — same cascade-on-delete convention as Recipes.remove
  // below. (groceryItemsByStore() already falls back to Unassigned for an
  // orphaned storeId defensively, but the persisted record should reflect
  // reality rather than relying on that fallback forever.)
  const StoresBase = makeCollection(KEYS.stores, storeModel);
  const Stores = Object.assign({}, StoresBase, {
    remove: function (id) {
      const removed = StoresBase.remove(id);
      if (removed) {
        const items = GroceryItems.list();
        let changed = false;
        items.forEach(function (i) { if (i.storeId === id) { i.storeId = null; changed = true; } });
        if (changed) storeSet(KEYS.groceryItems, items);
      }
      return removed;
    }
  });

  // Recipes.remove is wrapped to cascade-delete the recipe's own
  // ingredients, same "delete the parent, cascade to its children"
  // convention already used elsewhere in this app (study.html deleting a
  // subject cascades to its topics) — otherwise every future call site
  // would have to remember to clean up orphaned RecipeIngredient rows.
  const RecipesBase = makeCollection(KEYS.recipes, recipeModel);
  const Recipes = Object.assign({}, RecipesBase, {
    remove: function (id) {
      const removed = RecipesBase.remove(id);
      if (removed) {
        const remaining = RecipeIngredients.list().filter(function (i) { return i.recipeId !== id; });
        storeSet(KEYS.recipeIngredients, remaining);
      }
      return removed;
    }
  });

  /** A recipe's ingredients, in their stored order. */
  function ingredientsForRecipe(recipeId) {
    return RecipeIngredients.list()
      .filter(function (i) { return i.recipeId === recipeId; })
      .sort(function (a, b) { return a.order - b.order; });
  }

  /**
   * Bulk drag-reorder for the My Kitchen gallery. `idsInOrder` is the new
   * order of whichever recipes are currently *visible* (search/tag/
   * favorites filters may hide others) — same technique already
   * established by entertainment.html's Manual sort mode: recompute each
   * visible recipe's slot position among the full order-sorted list, then
   * drop the new visible order back into exactly those slots, so a
   * filtered-out recipe sitting between two visible ones never gets its
   * relative position disturbed by a drag it wasn't part of.
   */
  function reorderRecipesVisible(idsInOrder) {
    const all = Recipes.list();
    const sorted = all.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    const visibleSet = {};
    idsInOrder.forEach(function (id) { visibleSet[id] = true; });
    let ptr = 0;
    const result = sorted.map(function (r) {
      if (visibleSet[r.id]) {
        const id = idsInOrder[ptr++];
        return all.find(function (x) { return x.id === id; });
      }
      return r;
    });
    result.forEach(function (r, idx) { r.order = idx; });
    storeSet(KEYS.recipes, result);
  }

  /**
   * Bulk drag-reorder for grocery items within a single store group (drag
   * is scoped to one group at a time — reassigning an item's store is
   * still done via its Edit modal's Store select, not by dragging it into
   * a different store's group). `idsInOrder` is that group's new order;
   * only those items' `order` fields are touched.
   */
  function reorderGroceryGroupItems(idsInOrder) {
    const all = GroceryItems.list();
    const byId = {};
    all.forEach(function (i) { byId[i.id] = i; });
    idsInOrder.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    storeSet(KEYS.groceryItems, all);
  }

  // ============================================================
  // SELECTORS / ACTIONS — pure where possible; the few that mutate
  // storage are called out below.
  // ============================================================

  /**
   * Unchecked grocery items only, grouped by store and ordered by store
   * order, with an "Unassigned" group (storeId: null) last. Items whose
   * storeId points at a since-deleted store also fall into Unassigned.
   * Groups with zero items are omitted.
   */
  function groceryItemsByStore() {
    const stores = Stores.list().slice().sort(function (a, b) { return a.order - b.order; });
    const unchecked = GroceryItems.list().filter(function (i) { return !i.checked; });
    const storeIds = stores.map(function (s) { return s.id; });

    function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

    const groups = [];
    stores.forEach(function (s) {
      const items = unchecked.filter(function (i) { return i.storeId === s.id; }).sort(byOrder);
      if (items.length) groups.push({ storeId: s.id, storeName: s.name, color: s.color, items: items });
    });
    const unassigned = unchecked.filter(function (i) { return !i.storeId || storeIds.indexOf(i.storeId) === -1; }).sort(byOrder);
    if (unassigned.length) groups.push({ storeId: null, storeName: 'Unassigned', color: null, items: unassigned });
    return groups;
  }

  /** Number of currently-checked (hidden from groceryItemsByStore) items. */
  function checkedCount() {
    return GroceryItems.list().filter(function (i) { return i.checked; }).length;
  }

  /** Flips one item's checked state. Returns the updated item, or null if not found. */
  function toggleItemChecked(id) {
    const item = GroceryItems.get(id);
    if (!item) return null;
    return GroceryItems.update(id, { checked: !item.checked });
  }

  /** Sets checked = false on every item, so they all reappear in groceryItemsByStore(). */
  function resetGroceryList() {
    const all = GroceryItems.list();
    let changed = false;
    all.forEach(function (i) { if (i.checked) { i.checked = false; changed = true; } });
    if (changed) storeSet(KEYS.groceryItems, all);
    return all;
  }

  // ALT behavior: to make Reset DELETE checked items instead of just
  // unchecking them, have the Reset button call this instead of
  // resetGroceryList().
  /** Permanently deletes every checked item. Returns the number deleted. */
  function deleteCheckedGroceryItems() {
    const all = GroceryItems.list();
    const next = all.filter(function (i) { return !i.checked; });
    storeSet(KEYS.groceryItems, next);
    return all.length - next.length;
  }

  /**
   * Creates GroceryItems from a recipe's ingredients, assigned to
   * storeId, checked = false. If an unchecked item with the same name
   * (trimmed, case-insensitive) already exists, that ingredient is
   * skipped rather than duplicated. Returns the list of newly-created
   * items (skipped/duplicate ingredients are not included).
   */
  function addRecipeIngredientsToGroceryList(recipeId, storeId) {
    const ingredients = ingredientsForRecipe(recipeId);
    const existingUnchecked = GroceryItems.list().filter(function (i) { return !i.checked; });
    const added = [];
    ingredients.forEach(function (ing) {
      const name = (ing.name || '').trim();
      if (!name) return;
      const isDup = existingUnchecked.some(function (i) { return i.name.trim().toLowerCase() === name.toLowerCase(); });
      if (isDup) return;
      const created = GroceryItems.add({
        name: name,
        quantity: ing.amount,
        unit: ing.unit,
        storeId: storeId || null,
        checked: false
      });
      existingUnchecked.push(created); // avoid duplicates within this same call too
      added.push(created);
    });
    return added;
  }

  // ============================================================
  // BOARD ENGINE — Tabs + Widgets, reused wholesale from dreamboard-data.js
  // (same flat-array-with-foreign-key convention, same widget types, same
  // per-tab "hero" cover, same reorderTab bulk-write) so the two Nutrition
  // pages (My Kitchen / Grocery List) get a real "More Widgets" freeform
  // drag-and-drop board of their own, on top of their existing
  // recipe/grocery databases, plus a fully editable hero replacing the old
  // static cover banner. See CLAUDE.md's Dream Board changelog entries for
  // the full history/reasoning behind this exact shape.
  //
  // Nutrition's tabs are fixed (My Kitchen / Grocery List always exist,
  // one per real page — there's no "add a tab" here, unlike Dream Board),
  // so each DreamTab-equivalent also carries a `panel` field naming which
  // dedicated page it belongs to ('kitchen' | 'grocery'), read by
  // nutrition.html to know which section to show alongside that tab's
  // hero + widget board.
  // ============================================================
  const WIDGET_TYPES = ['checklist', 'list', 'note', 'quote', 'affirmation', 'steps', 'photos', 'calendar', 'feature', 'infocard'];

  const HERO_PRESETS = {
    kitchen: { eyebrow: 'MY KITCHEN', title: 'Recipes,\nReady When You Are.', subtext: 'Every dish worth repeating — ingredients, steps, and the little notes that make it yours.', ctaLabel: 'BROWSE RECIPES', photo: '' },
    grocery: { eyebrow: 'GROCERY LIST', title: 'Shop Once.\nForget Nothing.', subtext: "Organized by store, checked off as you go — everything you need, nothing you don't.", ctaLabel: 'VIEW LIST', photo: '' }
  };
  function defaultHero(panel) { return Object.assign({}, HERO_PRESETS[panel] || HERO_PRESETS.kitchen); }

  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : '',
      mediaType: data.mediaType === 'video' ? 'video' : 'image'
    };
  }

  /** @typedef {{id:string, title:string, order:number, panel:string, hero:Object}} NutritionTab */
  function tabModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tab'),
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      order: typeof data.order === 'number' ? data.order : 0,
      panel: (data.panel === 'kitchen' || data.panel === 'grocery') ? data.panel : '',
      hero: heroModel(data.hero)
    };
  }

  function defaultWidgetData(type) {
    switch (type) {
      case 'checklist': return { items: [] };
      case 'list': return { items: [] };
      case 'note': return { body: '' };
      case 'quote': return { text: '', author: '' };
      case 'affirmation': return { items: [] };
      case 'steps': return { goal: 10000, log: {} };
      case 'photos': return { wide: false, slots: [] };
      case 'calendar': return { notes: {}, viewYear: null, viewMonth: null };
      case 'feature': return { photo: '', title: '', caption: '' };
      case 'infocard': return { icon: '🍽', title: '', subtitle: '' };
      default: return {};
    }
  }

  /** @typedef {{id:string, tabId:string, column:number, order:number, type:string, title:string, tint:?string, data:Object}} NutritionWidget */
  function widgetModel(data) {
    data = data || {};
    const type = WIDGET_TYPES.indexOf(data.type) !== -1 ? data.type : 'note';
    const defaults = defaultWidgetData(type);
    const incoming = (data.data && typeof data.data === 'object') ? data.data : {};
    return {
      id: data.id || uid('wdg'),
      tabId: data.tabId || null,
      column: typeof data.column === 'number' ? data.column : 0,
      order: typeof data.order === 'number' ? data.order : 0,
      type: type,
      title: typeof data.title === 'string' ? data.title : '',
      tint: typeof data.tint === 'string' ? data.tint : null,
      data: Object.assign({}, defaults, incoming)
    };
  }

  const Tabs = makeCollection(KEYS.tabs, tabModel);
  const Widgets = makeCollection(KEYS.widgets, widgetModel);

  // Same defensive backfill precedent as dreamboard-data.js's own
  // normalizeTabs() (see that file's changelog note on the hero-missing
  // crash it fixed once) — list()/get() never re-run a stored record
  // through its model factory, only add()/update() do, so a tab written
  // before some future field existed could otherwise read back with that
  // field silently missing. Runs once per load; a no-op once every tab is
  // already in the current shape.
  function normalizeTabs() {
    const tabs = Tabs.list();
    let changed = false;
    const fixed = tabs.map(function (t) {
      if (t && t.hero && typeof t.hero === 'object' && (t.panel === 'kitchen' || t.panel === 'grocery')) return t;
      changed = true;
      return tabModel(t);
    });
    if (changed) Tabs.replaceAll(fixed);
  }

  function tabsSorted() {
    return Tabs.list().slice().sort(function (a, b) { return a.order - b.order; });
  }
  function tabForPanel(panel) {
    return Tabs.list().find(function (t) { return t.panel === panel; }) || null;
  }
  /** Widgets for one tab, grouped into 3 column arrays, each sorted by order. */
  function columnsForTab(tabId) {
    const cols = [[], [], []];
    Widgets.list()
      .filter(function (w) { return w.tabId === tabId; })
      .forEach(function (w) {
        const c = (w.column >= 0 && w.column <= 2) ? w.column : 0;
        cols[c].push(w);
      });
    cols.forEach(function (col) { col.sort(function (a, b) { return a.order - b.order; }); });
    return cols;
  }
  /** Bulk-persist a tab's full column layout after a drag-reorder — one
   * write, not one per widget. Same shape as dreamboard-data.js's. */
  function reorderTab(tabId, columnsOfIds) {
    const all = Widgets.list();
    const byId = {};
    all.forEach(function (w) { byId[w.id] = w; });
    columnsOfIds.forEach(function (ids, colIdx) {
      ids.forEach(function (id, orderIdx) {
        const w = byId[id];
        if (w && w.tabId === tabId) { w.column = colIdx; w.order = orderIdx; }
      });
    });
    Widgets.replaceAll(all);
  }

  function todayStepsCount(widget) {
    if (!widget || widget.type !== 'steps') return 0;
    return Number((widget.data.log || {})[todayISO()]) || 0;
  }

  /** A small, non-empty starter board per tab, so "More Widgets" never
   * opens blank — same spirit as dreamboard-data.js's seedDefaultBoard(),
   * loosely themed rather than load-bearing. Wipes/rebuilds ONLY the
   * Tabs/Widgets collections — Recipes/RecipeIngredients/Stores/
   * GroceryItems are completely separate collections and are never
   * touched by this, so "Reset to Default" on the widget board can never
   * delete a real recipe or grocery item. */
  function seedDefaultBoard() {
    Tabs.replaceAll([]);
    Widgets.replaceAll([]);

    const kitchenTab = Tabs.add({ title: 'My Kitchen', order: 0, panel: 'kitchen', hero: defaultHero('kitchen') });
    const groceryTab = Tabs.add({ title: 'Grocery List', order: 1, panel: 'grocery', hero: defaultHero('grocery') });

    Widgets.add({
      tabId: kitchenTab.id, column: 0, order: 0, type: 'note', title: 'Meal Prep Ideas',
      data: { body: 'Batch-cook grains and proteins on Sunday, keep a rotating list of go-to sauces, and freeze portions of anything that reheats well.' }
    });
    Widgets.add({
      tabId: kitchenTab.id, column: 1, order: 0, type: 'checklist', title: 'Kitchen To-Dos',
      data: { items: [{ id: uid('it'), text: 'Sharpen the knives', done: false }, { id: uid('it'), text: 'Clean out the spice rack', done: false }] }
    });
    Widgets.add({
      tabId: kitchenTab.id, column: 2, order: 0, type: 'infocard', title: 'Cook Once, Eat Twice',
      data: { icon: '🍲', title: 'COOK ONCE, EAT TWICE', subtitle: 'Double a recipe and freeze half.' }
    });

    Widgets.add({
      tabId: groceryTab.id, column: 0, order: 0, type: 'checklist', title: 'Pantry Staples to Restock',
      data: { items: [{ id: uid('it'), text: 'Olive oil', done: false }, { id: uid('it'), text: 'Rice', done: false }] }
    });
    Widgets.add({
      tabId: groceryTab.id, column: 1, order: 0, type: 'note', title: 'Store Notes',
      data: { body: 'Coop closes early on Sundays. Migros has better produce on weekday mornings.' }
    });
    Widgets.add({
      tabId: groceryTab.id, column: 2, order: 0, type: 'infocard', title: 'Shop the Edges',
      data: { icon: '🧺', title: 'SHOP THE EDGES', subtitle: 'Fresh food lives on the perimeter.' }
    });

    storeSet(KEYS.boardSeeded, true);
  }

  /** Creates the two fixed tabs (+ starter widgets) if neither exists yet —
   * independent of seedIfEmpty() above, which only guards the Recipes/
   * Stores/GroceryItems collections. A device that already has real
   * recipes/grocery data from before this board engine existed would
   * otherwise never get a Tabs row at all (seedIfEmpty() would see
   * non-empty collections and skip), which would leave the page with no
   * tab to render — same "newly-required structure with no backfill for
   * pre-existing users" bug class documented in Business Hub's/
   * Self-Care's own changelog entries, avoided here by keeping this check
   * independent of every other collection's emptiness. */
  function ensureBoardTabsExist() {
    if (Tabs.list().length > 0) return false;
    seedDefaultBoard();
    return true;
  }

  normalizeTabs();

  // ============================================================
  // SEED DATA — a small, realistic starter set so a future UI has
  // something to render. Runs once, guarded by nutrition:seeded, and
  // only if all four collections are already empty (so it can never
  // clobber real data added later).
  // ============================================================
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Stores.list().length || GroceryItems.list().length || Recipes.list().length || RecipeIngredients.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }

    const coop = Stores.add({ name: 'Coop', color: '#7DD3FC', order: 0 });
    const migros = Stores.add({ name: 'Migros', color: '#6EE7B7', order: 1 });

    GroceryItems.add({ name: 'Milk', quantity: 2, unit: 'L', storeId: coop.id, checked: false });
    GroceryItems.add({ name: 'Eggs', quantity: 12, unit: 'pcs', storeId: coop.id, checked: false });
    GroceryItems.add({ name: 'Bananas', quantity: 6, unit: 'pcs', storeId: coop.id, checked: true });
    GroceryItems.add({ name: 'Olive Oil', quantity: 1, unit: 'bottle', storeId: migros.id, checked: true });
    GroceryItems.add({ name: 'Chicken Breast', quantity: 1, unit: 'kg', storeId: migros.id, checked: false });
    GroceryItems.add({ name: 'Paper Towels', quantity: 1, unit: 'pack', storeId: null, checked: false });

    const chickenBowl = Recipes.add({
      title: 'Grilled Chicken & Rice Bowl',
      description: 'A quick high-protein dinner with rice, broccoli, and a soy-garlic glaze.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 25,
      tags: ['dinner', 'high-protein'],
      steps: [
        'Cook the rice according to package instructions.',
        'Season the chicken breast and grill 6-7 minutes per side.',
        'Steam the broccoli until just tender.',
        'Whisk soy sauce and minced garlic into a quick glaze.',
        'Slice the chicken, assemble the bowl, and drizzle with glaze.'
      ],
      notes: '',
      isFavorite: true,
      imageUrl: null
    });
    RecipeIngredients.add({ recipeId: chickenBowl.id, name: 'Chicken Breast', amount: 500, unit: 'g', order: 0 });
    RecipeIngredients.add({ recipeId: chickenBowl.id, name: 'Rice', amount: 1, unit: 'cup', order: 1 });
    RecipeIngredients.add({ recipeId: chickenBowl.id, name: 'Broccoli', amount: 200, unit: 'g', order: 2 });
    RecipeIngredients.add({ recipeId: chickenBowl.id, name: 'Soy Sauce', amount: 2, unit: 'tbsp', order: 3 });
    RecipeIngredients.add({ recipeId: chickenBowl.id, name: 'Garlic', amount: 2, unit: 'cloves', order: 4 });

    const oats = Recipes.add({
      title: 'Overnight Oats',
      description: 'Make-ahead breakfast, ready when you wake up.',
      servings: 1,
      prepTimeMin: 5,
      cookTimeMin: 0,
      tags: ['breakfast', 'make-ahead'],
      steps: [
        'Combine oats, milk, and chia seeds in a jar.',
        'Stir in honey.',
        'Cover and refrigerate overnight.',
        'Top with sliced banana before eating.'
      ],
      notes: '',
      isFavorite: false,
      imageUrl: null
    });
    RecipeIngredients.add({ recipeId: oats.id, name: 'Rolled Oats', amount: '1/2', unit: 'cup', order: 0 });
    RecipeIngredients.add({ recipeId: oats.id, name: 'Milk', amount: 1, unit: 'cup', order: 1 });
    RecipeIngredients.add({ recipeId: oats.id, name: 'Chia Seeds', amount: 1, unit: 'tbsp', order: 2 });
    RecipeIngredients.add({ recipeId: oats.id, name: 'Honey', amount: 1, unit: 'tsp', order: 3 });
    RecipeIngredients.add({ recipeId: oats.id, name: 'Banana', amount: 1, unit: '', order: 4 });

    const stirFry = Recipes.add({
      title: 'Veggie Stir Fry',
      description: 'Fast weeknight stir fry, easy to swap in whatever vegetables are on hand.',
      servings: 3,
      prepTimeMin: 10,
      cookTimeMin: 15,
      tags: ['dinner', 'vegetarian'],
      steps: [
        'Chop all vegetables into bite-sized pieces.',
        'Heat oil in a wok or large pan over high heat.',
        'Stir fry vegetables 5-6 minutes until crisp-tender.',
        'Add soy sauce and ginger, toss to coat, and serve.'
      ],
      notes: '',
      isFavorite: false,
      imageUrl: null
    });
    RecipeIngredients.add({ recipeId: stirFry.id, name: 'Bell Pepper', amount: 2, unit: '', order: 0 });
    RecipeIngredients.add({ recipeId: stirFry.id, name: 'Broccoli', amount: 200, unit: 'g', order: 1 });
    RecipeIngredients.add({ recipeId: stirFry.id, name: 'Carrot', amount: 2, unit: '', order: 2 });
    RecipeIngredients.add({ recipeId: stirFry.id, name: 'Soy Sauce', amount: 3, unit: 'tbsp', order: 3 });
    RecipeIngredients.add({ recipeId: stirFry.id, name: 'Ginger', amount: 1, unit: 'tbsp', order: 4 });

    storeSet(KEYS.seeded, true);
  }
  seedIfEmpty();

  // One-time migration: Recipe.steps changed shape from plain strings to
  // { text, imageUrl } objects (to support attaching a photo per step).
  // Recipes created before this change still have string steps sitting in
  // storage — list()/get() read raw records and don't run them through
  // recipeModel(), so without this pass they'd stay strings until their
  // recipe happened to be re-saved. Same guarded-one-time-pass idiom as
  // finance-data.js's migrateChfAccountsToUsd().
  function migrateStepsToObjects() {
    if (storeGet(KEYS.stepsMigratedV1)) return;
    const recipes = Recipes.list();
    let changed = false;
    recipes.forEach(function (r) {
      if (Array.isArray(r.steps) && r.steps.some(function (s) { return typeof s === 'string'; })) {
        r.steps = r.steps.map(normalizeStep);
        changed = true;
      }
    });
    if (changed) storeSet(KEYS.recipes, recipes);
    storeSet(KEYS.stepsMigratedV1, true);
  }
  migrateStepsToObjects();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.NutritionData = {
    KEYS: KEYS,
    uid: uid,
    todayISO: todayISO,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    Models: {
      store: storeModel,
      groceryItem: groceryItemModel,
      recipe: recipeModel,
      recipeIngredient: recipeIngredientModel,
      tab: tabModel,
      widget: widgetModel
    },
    Stores: Stores,
    GroceryItems: GroceryItems,
    Recipes: Recipes,
    RecipeIngredients: RecipeIngredients,
    ingredientsForRecipe: ingredientsForRecipe,
    groceryItemsByStore: groceryItemsByStore,
    checkedCount: checkedCount,
    toggleItemChecked: toggleItemChecked,
    resetGroceryList: resetGroceryList,
    deleteCheckedGroceryItems: deleteCheckedGroceryItems,
    addRecipeIngredientsToGroceryList: addRecipeIngredientsToGroceryList,
    reorderRecipesVisible: reorderRecipesVisible,
    reorderGroceryGroupItems: reorderGroceryGroupItems,
    seedIfEmpty: seedIfEmpty,
    // ---- board engine (My Kitchen / Grocery List hero + widget board) ----
    WIDGET_TYPES: WIDGET_TYPES,
    defaultWidgetData: defaultWidgetData,
    Tabs: Tabs,
    Widgets: Widgets,
    tabsSorted: tabsSorted,
    tabForPanel: tabForPanel,
    columnsForTab: columnsForTab,
    reorderTab: reorderTab,
    todayStepsCount: todayStepsCount,
    seedDefaultBoard: seedDefaultBoard,
    ensureBoardTabsExist: ensureBoardTabsExist,
    normalizeTabs: normalizeTabs
  };
})(window);
