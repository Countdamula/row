// nutrition-data.js
//
// Shared data foundation for the Nutrition tab: typed-by-JSDoc models, a
// localStorage-backed data-access layer, and pure derived selectors/actions.
// Included by nutrition.html (`<script src="nutrition-data.js" defer>`), but
// no UI reads from `window.NutritionData` yet — nutrition.html is currently
// a shell (My Kitchen / Grocery List placeholder panels); real features land
// next.
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
    seeded: 'nutrition:seeded'
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
      addedAt: data.addedAt || todayISO()
    };
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
   * @property {string[]} steps - ordered strings
   * @property {string} notes
   * @property {boolean} isFavorite
   * @property {?string} imageUrl
   * @property {string} createdAt - ISO date (YYYY-MM-DD)
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
      steps: Array.isArray(data.steps) ? data.steps.slice() : [],
      notes: data.notes || '',
      isFavorite: data.isFavorite != null ? !!data.isFavorite : false,
      imageUrl: data.imageUrl || null,
      createdAt: data.createdAt || todayISO()
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
    return { list: list, get: get, add: add, update: update, remove: remove };
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

    const groups = [];
    stores.forEach(function (s) {
      const items = unchecked.filter(function (i) { return i.storeId === s.id; });
      if (items.length) groups.push({ storeId: s.id, storeName: s.name, color: s.color, items: items });
    });
    const unassigned = unchecked.filter(function (i) { return !i.storeId || storeIds.indexOf(i.storeId) === -1; });
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

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.NutritionData = {
    KEYS: KEYS,
    Models: {
      store: storeModel,
      groceryItem: groceryItemModel,
      recipe: recipeModel,
      recipeIngredient: recipeIngredientModel
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
    seedIfEmpty: seedIfEmpty
  };
})(window);
