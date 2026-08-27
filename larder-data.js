// =============================================================
// larder-data.js — window.Lar
//
// The Larder's models, collections, selectors and migrations.
// The prefix table is larder-sync.js and nowhere else; read its
// header before changing anything about which key lives where.
//
// TWO ROWS (see larder-sync.js):
//   lar:     the library — foods, meals, recipes, grocery, plan,
//            targets. Read constantly, written rarely.
//   larlog:  what you ate — log entries and day records. Small,
//            written many times a day.
// =============================================================
// THE ONE RULE THIS FILE IS BUILT AROUND
//
// Totals are DERIVED, never stored. A day's calories are the sum
// of that day's log entries plus its legacy block; a saved meal's
// calories are the sum of its components. Nothing writes a total
// to storage, so no total can ever disagree with the things it is
// a total of. This is the same discipline as the Palaestra's
// week bar and it is why that bar can be trusted.
//
// There is exactly ONE deliberate exception, and it is at the
// bottom of §LOG: a log entry stores the macros it was worth at
// the moment it was logged. Correcting a food's calories in
// March must not silently rewrite what you ate in January.
// History is a record, not a view of the current library.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // STORAGE
  // ------------------------------------------------------------
  function storeGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      global.dispatchEvent(new CustomEvent('lar:save', { detail: { key: key, ok: true } }));
      return true;
    } catch (e) {
      global.dispatchEvent(new CustomEvent('lar:save', { detail: { key: key, ok: false, error: e } }));
      return false;
    }
  }
  function storeRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  // ------------------------------------------------------------
  // KEYS
  //
  // Every key this app owns, in one place. `lar:` is the library
  // row, `larlog:` is the log row. A key added here without a
  // thought about which side of that line it falls on is a key
  // that will be re-uploaded on every tap of "+8 oz".
  // ------------------------------------------------------------
  var KEYS = {
    // --- library (lar:) ---
    foods:             'lar:foods',
    meals:             'lar:meals',
    recipes:           'lar:recipes',
    recipeIngredients: 'lar:recipeIngredients',
    stores:            'lar:stores',
    groceryItems:      'lar:groceryItems',
    supplements:       'lar:supplements',
    notes:             'lar:notes',
    plan:              'lar:plan',
    targets:           'lar:targets',
    seededAt:          'lar:seededAt',
    migratedNutrition: 'lar:migratedNutrition',
    migratedPalDays:   'lar:migratedPalDays',

    // --- log (larlog:) ---
    log:               'larlog:log',
    days:              'larlog:days'
  };

  // The old page's keys. Read once by the migration, then removed.
  // nutrition:tabs / widgets / boardSeeded / seeded are the
  // retired Dream-Board widget clone and are deliberately NOT
  // listed: they are left orphaned but intact, and the prefix
  // stays mounted so nothing deletes them. See larder-sync.js.
  var OLD_KEYS = {
    stores:            'nutrition:stores',
    groceryItems:      'nutrition:groceryItems',
    recipes:           'nutrition:recipes',
    recipeIngredients: 'nutrition:recipeIngredients'
  };

  // ------------------------------------------------------------
  // PRIMITIVES
  // ------------------------------------------------------------
  function uid(p) {
    return (p || 'l') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function str(v, max) {
    var s = v == null ? '' : String(v);
    return max ? s.slice(0, max) : s;
  }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function oneOf(v, list, d) { return list.indexOf(v) !== -1 ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function strList(v, max, cap) {
    return arr(v).slice(0, cap || 40).map(function (s) { return str(s, max || 80); })
      .filter(function (s) { return !!s; });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

  // ------------------------------------------------------------
  // VOCABULARY
  //
  // The four slots are fixed. "Snacks" is plural because it holds
  // several and the other three usually hold one — the label is
  // telling the truth about the shape of the data.
  // ------------------------------------------------------------
  var SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  var SLOT_LABELS = {
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks'
  };

  var MEAL_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'];

  // Food groups, used by the adherence score to answer "did you
  // eat a vegetable today" without asking you to tick a box.
  var FOOD_GROUPS = ['protein', 'carb', 'fat', 'veg', 'fruit', 'dairy', 'drink', 'other'];

  // The tags that drive "What should I eat?". A closed list, so a
  // typo cannot quietly create a filter that matches one food.
  var TAGS = ['high-protein', 'low-calorie', 'quick', 'cheap', 'no-cook',
              'post-workout', 'sweet', 'savory', 'make-ahead', 'vegetarian'];

  var UNITS = ['g', 'oz', 'ml', 'piece', 'cup', 'tbsp', 'serving'];

  var MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];

  var SUPPLEMENT_SLOTS = ['morning', 'with-food', 'evening'];

  // ------------------------------------------------------------
  // MODELS
  //
  // Every model is a WHITELIST re-run by makeCollection.update()
  // on every write, so a field that is not named here cannot
  // survive in storage. That is what stops one screen quietly
  // inventing a field another screen never learns to read.
  // ------------------------------------------------------------

  /**
   * A food is a thing with macros stated PER SOME AMOUNT.
   *
   * `per` is what makes the amount stepper a multiplication
   * rather than a lookup table: chicken breast is 165 kcal per
   * 100 g, so 6 oz is (170.1/100) x 165. Storing "one serving"
   * and hoping the reader remembers how big a serving was is how
   * a food table becomes useless within a month.
   */
  function foodModel(d) {
    d = d || {};
    return {
      id: d.id || uid('food'),
      name: str(d.name, 80),
      brand: str(d.brand, 60),
      unit: oneOf(d.unit, UNITS, 'g'),
      per: clamp(num(d.per, 100), 0.01, 100000),
      kcal: clamp(num(d.kcal, 0), 0, 100000),
      protein: clamp(num(d.protein, 0), 0, 10000),
      carbs: clamp(num(d.carbs, 0), 0, 10000),
      fat: clamp(num(d.fat, 0), 0, 10000),
      fibre: clamp(num(d.fibre, 0), 0, 10000),
      defaultAmount: clamp(num(d.defaultAmount, 100), 0.01, 100000),
      step: clamp(num(d.step, 10), 0.01, 10000),
      group: oneOf(d.group, FOOD_GROUPS, 'other'),
      tags: strList(d.tags, 24, 12),
      isFavorite: d.isFavorite === true,
      isQuick: d.isQuick === true,
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }

  /**
   * A component of a saved meal.
   *
   * name and the macros are DENORMALISED onto the component on
   * purpose. A meal that only held foodIds would be gutted the
   * day you deleted a food, and "Chicken Rice Bowl" would render
   * as three blanks and a total of zero. foodId is kept so the
   * amount can still be re-derived while the food exists; the
   * copy is what survives it.
   *
   * A component with foodId null is a freehand line, which is how
   * "Chicken rice bowl, 610 cal, 52g protein" gets saved without
   * inventing four ingredients that were never weighed.
   */
  function componentModel(d) {
    d = d || {};
    return {
      foodId: d.foodId || null,
      name: str(d.name, 80),
      amount: clamp(num(d.amount, 0), 0, 100000),
      unit: oneOf(d.unit, UNITS, 'g'),
      kcal: clamp(num(d.kcal, 0), 0, 100000),
      protein: clamp(num(d.protein, 0), 0, 10000),
      carbs: clamp(num(d.carbs, 0), 0, 10000),
      fat: clamp(num(d.fat, 0), 0, 10000),
      fibre: clamp(num(d.fibre, 0), 0, 10000)
    };
  }

  /** A saved meal: a named composite you log in one tap. Totals are derived. */
  function mealModel(d) {
    d = d || {};
    return {
      id: d.id || uid('meal'),
      name: str(d.name, 80),
      note: str(d.note, 400),
      category: oneOf(d.category, MEAL_CATEGORIES, 'lunch'),
      components: arr(d.components).slice(0, 40).map(componentModel),
      tags: strList(d.tags, 24, 12),
      imageUrl: d.imageUrl || null,
      isFavorite: d.isFavorite === true,
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }

  /**
   * A recipe has INSTRUCTIONS. That is the whole distinction from
   * a meal, and it is worth keeping: a meal is something you log,
   * a recipe is something you cook. Collapsing the two gives you
   * a list where half the entries want a "Log" button and half
   * want a "Cook" button.
   *
   * Macros here are PER SERVING, which is what makes Log Serving
   * a single tap.
   */
  function recipeStepModel(s) {
    if (typeof s === 'string') return { text: str(s, 2000), imageUrl: null };
    s = s || {};
    return { text: str(s.text, 2000), imageUrl: s.imageUrl || null };
  }
  function recipeModel(d) {
    d = d || {};
    return {
      id: d.id || uid('recipe'),
      title: str(d.title, 120),
      description: str(d.description, 600),
      servings: clamp(Math.round(num(d.servings, 1)), 1, 100),
      prepTimeMin: clamp(Math.round(num(d.prepTimeMin, 0)), 0, 6000),
      cookTimeMin: clamp(Math.round(num(d.cookTimeMin, 0)), 0, 6000),
      tags: strList(d.tags, 24, 12),
      steps: arr(d.steps).slice(0, 60).map(recipeStepModel),
      notes: str(d.notes, 4000),
      // Per serving. Zero means "not stated", which the UI shows
      // as a dash rather than as zero calories.
      kcal: clamp(num(d.kcal, 0), 0, 100000),
      protein: clamp(num(d.protein, 0), 0, 10000),
      carbs: clamp(num(d.carbs, 0), 0, 10000),
      fat: clamp(num(d.fat, 0), 0, 10000),
      fibre: clamp(num(d.fibre, 0), 0, 10000),
      mealId: d.mealId || null,
      isFavorite: d.isFavorite === true,
      imageUrl: d.imageUrl || null,
      createdAt: isISO(d.createdAt) ? d.createdAt : today(),
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }
  function recipeIngredientModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ing'),
      recipeId: d.recipeId || null,
      // Optional link to the food table, so Add Ingredients To
      // Grocery List can carry a store through instead of
      // dropping every item into "no store".
      foodId: d.foodId || null,
      name: str(d.name, 80),
      // Free-form on purpose: "1/2", "a handful", "to taste".
      amount: d.amount != null ? str(d.amount, 40) : '',
      unit: str(d.unit, 20),
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }

  function storeModel(d) {
    d = d || {};
    return {
      id: d.id || uid('store'),
      name: str(d.name, 60),
      color: str(d.color, 24) || '#c9a876',
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }
  function groceryItemModel(d) {
    d = d || {};
    return {
      id: d.id || uid('gro'),
      name: str(d.name, 80),
      quantity: clamp(num(d.quantity, 1), 0, 100000),
      unit: str(d.unit, 20),
      storeId: d.storeId || null,
      checked: d.checked === true,
      notes: str(d.notes, 400),
      // Where it came from, so "added from Chicken Rice Bowl"
      // stays answerable a week later.
      fromMealId: d.fromMealId || null,
      fromRecipeId: d.fromRecipeId || null,
      addedAt: isISO(d.addedAt) ? d.addedAt : today(),
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }

  function supplementModel(d) {
    d = d || {};
    return {
      id: d.id || uid('supp'),
      name: str(d.name, 60),
      dose: str(d.dose, 40),
      slot: oneOf(d.slot, SUPPLEMENT_SLOTS, 'morning'),
      note: str(d.note, 200),
      order: d.order != null ? num(d.order, 0) : Date.now()
    };
  }

  function noteModel(d) {
    d = d || {};
    return {
      id: d.id || uid('note'),
      text: str(d.text, 2000),
      kind: oneOf(d.kind, ['idea', 'try', 'observation'], 'idea'),
      createdAt: isISO(d.createdAt) ? d.createdAt : today()
    };
  }

  // ------------------------------------------------------------
  // COLLECTIONS
  //
  // One JSON array under one key. Lifted from nutrition-data.js,
  // which already had this right — update() re-runs the model as
  // a whitelist, and remove() nulls references rather than
  // cascade-deleting, because deleting a store should not delete
  // your shopping list.
  // ------------------------------------------------------------
  function makeCollection(key, model) {
    function list() { return arr(storeGet(key)); }
    function get(id) {
      return list().filter(function (x) { return x.id === id; })[0] || null;
    }
    function add(data) {
      var record = model(data);
      var all = list();
      all.push(record);
      storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      var all = list();
      var idx = -1, i;
      for (i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      var all = list().filter(function (x) { return x.id !== id; });
      storeSet(key, all);
      return true;
    }
    function replaceAll(records) {
      storeSet(key, arr(records).map(model));
      return list();
    }
    return { key: key, list: list, get: get, add: add, update: update,
             remove: remove, replaceAll: replaceAll };
  }

  var Foods             = makeCollection(KEYS.foods, foodModel);
  var Meals             = makeCollection(KEYS.meals, mealModel);
  var Recipes           = makeCollection(KEYS.recipes, recipeModel);
  var RecipeIngredients = makeCollection(KEYS.recipeIngredients, recipeIngredientModel);
  var Stores            = makeCollection(KEYS.stores, storeModel);
  var GroceryItems      = makeCollection(KEYS.groceryItems, groceryItemModel);
  var Supplements       = makeCollection(KEYS.supplements, supplementModel);
  var Notes             = makeCollection(KEYS.notes, noteModel);

  // Deleting a store empties its shelf, it does not throw the
  // shopping away. Deleting a recipe takes its ingredients,
  // because an ingredient with no recipe is not a thing.
  var storesRemove = Stores.remove;
  Stores.remove = function (id) {
    GroceryItems.list().forEach(function (it) {
      if (it.storeId === id) GroceryItems.update(it.id, { storeId: null });
    });
    return storesRemove(id);
  };
  var recipesRemove = Recipes.remove;
  Recipes.remove = function (id) {
    RecipeIngredients.list().forEach(function (ing) {
      if (ing.recipeId === id) RecipeIngredients.remove(ing.id);
    });
    return recipesRemove(id);
  };
  // ============================================================
  // §GROCERY
  //
  // THE MODEL, AND WHY IT IS THIS ONE.
  //
  // The grocery list is a PERMANENT STAPLE LIST with a per-trip
  // tick state. Ticking an item does not delete it — it hides it
  // from the list and leaves it in storage. "Reset" un-ticks
  // everything and the whole list comes back for the next shop.
  //
  // This is the original Nutrition page's behaviour, restored.
  // The rebuild on 2026-08-26 replaced it with a "Clear ticked"
  // button that PERMANENTLY DELETED every ticked item, with no
  // confirm — which is the opt-in alternative nutrition-data.js
  // deliberately declined to wire up, promoted to the default. A
  // shop, a tick per item, one press of the only button in that
  // toolbar, and the list was gone. It should never have been the
  // easy path, and it is not one any more: nothing in this file
  // removes a grocery item except an explicit per-item delete.
  //
  // The whole trick is one filter, in ONE place, used by both the
  // view and the count — two copies of it is how they come to
  // disagree about what "left" means.
  // ============================================================

  /** Items still to buy. The tick is a filter, not a deletion. */
  function groceryRemaining() {
    return GroceryItems.list().filter(function (i) { return !i.checked; });
  }

  /** How many are ticked, i.e. hidden from the list until a reset. */
  function groceryCheckedCount() {
    return GroceryItems.list().filter(function (i) { return i.checked; }).length;
  }

  /**
   * Unchecked items grouped by store, in store order, with a
   * trailing catch-all for anything unassigned or pointing at a
   * store that has since been deleted. Empty groups are dropped —
   * a shop you have nothing to buy at is not a heading.
   */
  function groceryByStore() {
    var stores = Stores.list().slice().sort(function (a, b) { return a.order - b.order; });
    var remaining = groceryRemaining();
    var out = [];
    stores.forEach(function (s) {
      var rows = remaining.filter(function (i) { return i.storeId === s.id; })
        .sort(function (a, b) { return a.order - b.order; });
      if (rows.length) out.push({ id: s.id, name: s.name, color: s.color, rows: rows });
    });
    var loose = remaining.filter(function (i) {
      return !i.storeId || !Stores.get(i.storeId);
    }).sort(function (a, b) { return a.order - b.order; });
    if (loose.length) out.push({ id: null, name: 'Anywhere', color: '', rows: loose });
    return out;
  }

  /** Un-tick everything. Returns how many came back. */
  function resetGroceryList() {
    var all = GroceryItems.list();
    var n = 0;
    all.forEach(function (i) { if (i.checked) { i.checked = false; n++; } });
    if (n) storeSet(KEYS.groceryItems, all);
    return n;
  }

  /**
   * Permanently delete every ticked item.
   *
   * Kept because "I bought these and they are not staples" is a
   * real thing to want — but it lives on the Data screen behind a
   * confirm, not next to the button you press every week. Its
   * name says exactly what it does.
   */
  function deleteCheckedGrocery() {
    var all = GroceryItems.list();
    var next = all.filter(function (i) { return !i.checked; });
    if (next.length !== all.length) storeSet(KEYS.groceryItems, next);
    return all.length - next.length;
  }

  /**
   * Pull the grocery list out of a LarBackup snapshot.
   *
   * Two things make this more than a plain restore:
   *
   * 1. It reads BOTH `lar:groceryItems` and the retired
   *    `nutrition:groceryItems`. A snapshot taken before the
   *    2026-08-26 migration holds the items under the old key,
   *    and `lar:migratedNutrition` is already stamped so
   *    migrateNutritionKeys() will never run again — restoring
   *    that key on its own would put the data somewhere nothing
   *    reads. Old-key rows are converted through groceryItemModel.
   *
   * 2. It MERGES by name rather than replacing. Running it twice
   *    is not a duplicate, and a restore does not throw away
   *    whatever you have added since.
   *
   * @param {object} snap  a LarBackup.get(id) result
   * @returns {{items:number, stores:number}} how many were added
   */
  function restoreGroceryFrom(snap) {
    if (!snap || !snap.keys) return { items: 0, stores: 0 };

    function parse(key) {
      var raw = snap.keys[key];
      if (typeof raw !== 'string') return [];
      try { var v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
      catch (e) { return []; }
    }

    // Stores first — an item restored before its store would land
    // in "Anywhere" and lose the aisle it belonged to.
    var haveStores = {};
    Stores.list().forEach(function (s) { haveStores[s.name.trim().toLowerCase()] = s.id; });
    var storesAdded = 0;
    parse(OLD_KEYS.stores).concat(parse(KEYS.stores)).forEach(function (s) {
      if (!s || !s.name) return;
      var key = String(s.name).trim().toLowerCase();
      if (haveStores[key]) return;
      var made = Stores.add(s);
      haveStores[key] = made.id;
      // Remember the old id too, so items pointing at it still resolve.
      if (s.id) haveStores['#' + s.id] = made.id;
      storesAdded++;
    });
    // Map every id present in the snapshot onto whatever this
    // device calls that store now.
    parse(OLD_KEYS.stores).concat(parse(KEYS.stores)).forEach(function (s) {
      if (!s || !s.id || !s.name) return;
      haveStores['#' + s.id] = haveStores[String(s.name).trim().toLowerCase()] || null;
    });

    var haveItems = {};
    GroceryItems.list().forEach(function (i) { haveItems[i.name.trim().toLowerCase()] = true; });
    var itemsAdded = 0;
    parse(OLD_KEYS.groceryItems).concat(parse(KEYS.groceryItems)).forEach(function (i) {
      if (!i || !i.name) return;
      var key = String(i.name).trim().toLowerCase();
      if (haveItems[key]) return;
      haveItems[key] = true;
      var mapped = Object.assign({}, i);
      delete mapped.id;                       // a fresh id, so nothing collides
      if (mapped.storeId) mapped.storeId = haveStores['#' + mapped.storeId] || null;
      GroceryItems.add(mapped);
      itemsAdded++;
    });
    return { items: itemsAdded, stores: storesAdded };
  }

  /** Every snapshot that holds any grocery data, newest first. */
  function groceryInSnapshots() {
    if (!global.LarBackup) return [];
    return global.LarBackup.list().map(function (entry) {
      var snap = global.LarBackup.get(entry.id);
      var n = 0, old = 0;
      if (snap && snap.keys) {
        [KEYS.groceryItems, OLD_KEYS.groceryItems].forEach(function (k, idx) {
          var raw = snap.keys[k];
          if (typeof raw !== 'string') return;
          try {
            var v = JSON.parse(raw);
            if (Array.isArray(v)) { n += v.length; if (idx === 1) old += v.length; }
          } catch (e) {}
        });
      }
      return { id: entry.id, at: entry.at, reason: entry.reason,
               pinned: entry.pinned, items: n, fromOldKey: old };
    }).filter(function (r) { return r.items > 0; });
  }

  // Deleting a food does NOT touch the meals that used it or the
  // entries that recorded it — both carry their own copy of the
  // name and the macros for exactly this moment.

  // ------------------------------------------------------------
  // TARGETS — one object, not a collection. There is one answer
  // to "what am I aiming at", and a collection would imply
  // otherwise.
  // ------------------------------------------------------------
  var TARGET_DEFAULTS = {
    kcal: 2300, protein: 180, carbs: 220, fat: 75, fibre: 30,
    waterMl: 2957,              // 100 US fl oz, the number actually asked for
    waterUnit: 'oz',
    waterSteps: [8, 16, 24],    // in the display unit
    vegTarget: 3, fruitTarget: 2
  };
  function targetsModel(d) {
    d = d || {};
    var unit = oneOf(d.waterUnit, ['oz', 'ml'], 'oz');
    var steps = arr(d.waterSteps).slice(0, 4)
      .map(function (n) { return clamp(Math.round(num(n, 0)), 1, 5000); })
      .filter(function (n) { return n > 0; });
    return {
      kcal:    clamp(Math.round(num(d.kcal, TARGET_DEFAULTS.kcal)), 0, 20000),
      protein: clamp(Math.round(num(d.protein, TARGET_DEFAULTS.protein)), 0, 2000),
      carbs:   clamp(Math.round(num(d.carbs, TARGET_DEFAULTS.carbs)), 0, 2000),
      fat:     clamp(Math.round(num(d.fat, TARGET_DEFAULTS.fat)), 0, 2000),
      fibre:   clamp(Math.round(num(d.fibre, TARGET_DEFAULTS.fibre)), 0, 500),
      waterMl: clamp(Math.round(num(d.waterMl, TARGET_DEFAULTS.waterMl)), 0, 20000),
      waterUnit: unit,
      waterSteps: steps.length ? steps : TARGET_DEFAULTS.waterSteps.slice(),
      vegTarget: clamp(Math.round(num(d.vegTarget, TARGET_DEFAULTS.vegTarget)), 0, 20),
      fruitTarget: clamp(Math.round(num(d.fruitTarget, TARGET_DEFAULTS.fruitTarget)), 0, 20)
    };
  }
  function getTargets() { return targetsModel(storeGet(KEYS.targets)); }
  function setTargets(patch) {
    var next = targetsModel(Object.assign({}, getTargets(), patch || {}));
    storeSet(KEYS.targets, next);
    return next;
  }

  // ------------------------------------------------------------
  // §LOG — what you ate.
  //
  // Shaped { 'YYYY-MM-DD': [entry] } rather than one key per
  // date, for the reason palaestra-data.js gives about pal:days:
  // the week strip, the averages and every chart need a whole
  // span in one read, and per-date keys would make each of them a
  // full scan of localStorage.
  //
  // Trimmed to LOG_CAP days on write. This row is re-uploaded on
  // every tap of "+8 oz", so its size is a design parameter and
  // not an afterthought.
  // ------------------------------------------------------------
  var LOG_CAP = 370;
  var DAY_CAP = 730;

  /**
   * THE ONE DELIBERATE EXCEPTION TO DERIVED-NOT-STORED.
   *
   * The macros are computed when the entry is logged and stored
   * on the entry. Correcting a food's calories must not rewrite
   * what you ate last month. `label` is copied for the same
   * reason: the entry has to still read correctly after the food
   * it came from is gone.
   *
   * refId is kept, and is allowed to dangle. It is a convenience
   * for "log this again", not a dependency.
   */
  function entryModel(d) {
    d = d || {};
    return {
      id: d.id || uid('e'),
      slot: oneOf(d.slot, SLOTS, 'snacks'),
      kind: oneOf(d.kind, ['food', 'meal', 'recipe', 'free'], 'free'),
      refId: d.refId || null,
      label: str(d.label, 80),
      amount: clamp(num(d.amount, 0), 0, 100000),
      unit: oneOf(d.unit, UNITS, 'serving'),
      servings: clamp(num(d.servings, 1), 0, 1000),
      kcal: clamp(num(d.kcal, 0), 0, 100000),
      protein: clamp(num(d.protein, 0), 0, 10000),
      carbs: clamp(num(d.carbs, 0), 0, 10000),
      fat: clamp(num(d.fat, 0), 0, 10000),
      fibre: clamp(num(d.fibre, 0), 0, 10000),
      group: oneOf(d.group, FOOD_GROUPS, 'other'),
      at: num(d.at, Date.now())
    };
  }

  function allLog() {
    var raw = storeGet(KEYS.log);
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }
  function logFor(dateStr) {
    return arr(allLog()[dateStr || today()]).map(entryModel);
  }
  function writeLog(log) {
    var keys = Object.keys(log).sort();
    if (keys.length > LOG_CAP) {
      keys.slice(0, keys.length - LOG_CAP).forEach(function (k) { delete log[k]; });
    }
    storeSet(KEYS.log, log);
  }
  function addEntry(dateStr, data) {
    var date = isISO(dateStr) ? dateStr : today();
    var log = allLog();
    var entry = entryModel(data);
    log[date] = arr(log[date]).concat([entry]);
    writeLog(log);
    return entry;
  }
  function removeEntry(dateStr, id) {
    var date = isISO(dateStr) ? dateStr : today();
    var log = allLog();
    if (!log[date]) return false;
    log[date] = arr(log[date]).filter(function (e) { return e.id !== id; });
    if (!log[date].length) delete log[date];
    writeLog(log);
    return true;
  }
  function updateEntry(dateStr, id, patch) {
    var date = isISO(dateStr) ? dateStr : today();
    var log = allLog();
    var rows = arr(log[date]), i, found = null;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].id === id) {
        rows[i] = entryModel(Object.assign({}, rows[i], patch, { id: id }));
        found = rows[i];
        break;
      }
    }
    if (!found) return null;
    log[date] = rows;
    writeLog(log);
    return found;
  }

  // ------------------------------------------------------------
  // DAY RECORDS — water, supplements, a note, and `legacy`.
  //
  // `legacy` is the macro history migrated out of pal:days. It is
  // a flat { kcal, protein, carbs, fat } with no entries behind
  // it, because the Palaestra recorded totals and never recorded
  // what was eaten. totalsFor() adds it on top of the derived
  // sum. See §MIGRATIONS for why this is not fake breakfasts.
  // ------------------------------------------------------------
  function legacyModel(d) {
    if (!d) return null;
    var out = {
      kcal: clamp(num(d.kcal, 0), 0, 100000),
      protein: clamp(num(d.protein, 0), 0, 10000),
      carbs: clamp(num(d.carbs, 0), 0, 10000),
      fat: clamp(num(d.fat, 0), 0, 10000)
    };
    // An all-zero legacy block is not history, it is noise.
    if (!out.kcal && !out.protein && !out.carbs && !out.fat) return null;
    return out;
  }
  function dayModel(d) {
    d = d || {};
    var supps = {};
    if (d.supps && typeof d.supps === 'object') {
      Object.keys(d.supps).slice(0, 100).forEach(function (k) {
        if (d.supps[k]) supps[str(k, 60)] = true;
      });
    }
    return {
      water: clamp(num(d.water, 0), 0, 100000),   // millilitres, always
      supps: supps,
      note: str(d.note, 1000),
      legacy: legacyModel(d.legacy)
    };
  }
  function allDays() {
    var raw = storeGet(KEYS.days);
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }
  function getDay(dateStr) { return dayModel(allDays()[dateStr || today()]); }
  function patchDay(dateStr, patch) {
    var date = isISO(dateStr) ? dateStr : today();
    var days = allDays();
    days[date] = dayModel(Object.assign({}, days[date] || {}, patch || {}));
    var keys = Object.keys(days).sort();
    if (keys.length > DAY_CAP) {
      keys.slice(0, keys.length - DAY_CAP).forEach(function (k) { delete days[k]; });
    }
    storeSet(KEYS.days, days);
    return days[date];
  }
  /** Water is added, never set — you drink another glass, you do not restate the total. */
  function addWaterMl(dateStr, ml) {
    var date = isISO(dateStr) ? dateStr : today();
    var cur = getDay(date);
    return patchDay(date, { water: Math.max(0, cur.water + num(ml, 0)) });
  }
  function toggleSupplement(dateStr, id) {
    var date = isISO(dateStr) ? dateStr : today();
    var day = getDay(date);
    var supps = Object.assign({}, day.supps);
    if (supps[id]) delete supps[id]; else supps[id] = true;
    return patchDay(date, { supps: supps });
  }

  // ------------------------------------------------------------
  // DERIVED TOTALS
  // ------------------------------------------------------------
  function emptyTotals() {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  }
  function addMacros(into, from, times) {
    var k = times == null ? 1 : times;
    MACROS.forEach(function (m) { into[m] += (num(from[m], 0) * k); });
    return into;
  }

  /** A saved meal's totals: the sum of its components, every time it is asked. */
  function mealTotals(meal) {
    var t = emptyTotals();
    if (!meal) return t;
    arr(meal.components).forEach(function (c) { addMacros(t, c); });
    return t;
  }

  /** What `amount` units of a food is worth. The stepper's arithmetic, in one place. */
  function foodAt(food, amount) {
    var t = emptyTotals();
    if (!food) return t;
    var per = num(food.per, 100) || 100;
    return addMacros(t, food, num(amount, 0) / per);
  }

  /**
   * A day's totals: the sum of its entries, plus its legacy block.
   *
   * Nothing stores this. It is recomputed on every render, which
   * is cheap — a day is a handful of entries — and which means it
   * cannot drift from the entries it describes.
   */
  function totalsFor(dateStr) {
    var date = isISO(dateStr) ? dateStr : today();
    var t = emptyTotals();
    logFor(date).forEach(function (e) { addMacros(t, e); });
    var legacy = getDay(date).legacy;
    if (legacy) addMacros(t, legacy);
    MACROS.forEach(function (m) { t[m] = Math.round(t[m]); });
    return t;
  }

  /** Totals for one slot, for the collapsed meal rows on Today. */
  function slotTotals(dateStr, slot) {
    var t = emptyTotals();
    logFor(dateStr).forEach(function (e) { if (e.slot === slot) addMacros(t, e); });
    MACROS.forEach(function (m) { t[m] = Math.round(t[m]); });
    return t;
  }
  function slotEntries(dateStr, slot) {
    return logFor(dateStr).filter(function (e) { return e.slot === slot; });
  }
  /** How many of the four slots have anything in them. The "Meals 3 / 4" line. */
  function slotsFilled(dateStr) {
    var rows = logFor(dateStr), n = 0;
    SLOTS.forEach(function (s) {
      if (rows.some(function (e) { return e.slot === s; })) n++;
    });
    return n;
  }
  function groupCount(dateStr, group) {
    return logFor(dateStr).filter(function (e) { return e.group === group; }).length;
  }

  // ============================================================
  // §MIGRATIONS
  //
  // Two of them, both idempotent, both flag-guarded, and NEITHER
  // may run before every mounted row has pulled. A migration that
  // runs against a not-yet-hydrated store concludes the device is
  // empty and writes over real data that is still on its way in —
  // which is the same failure as an early seed, with worse
  // consequences, because a migration also DELETES.
  //
  // runMigrations() is the only entry point, and the boot block
  // calls it from the same gate as the seeder.
  // ============================================================

  function backup(reason) {
    if (global.LarBackup && global.LarBackup.snapshot) {
      try { global.LarBackup.snapshot(reason, { force: true, pinned: true }); }
      catch (e) {}
    }
  }

  // ------------------------------------------------------------
  // M2 — the old Nutrition page's collections, `nutrition:*` to
  // `lar:*`.
  //
  // Safe because BOTH prefixes are on the same Supabase row: the
  // copy and the delete travel in one blob, so no device ever
  // sees one without the other, and §SEEN treats the removal as
  // a real deletion rather than resurrecting it on the next pull.
  // Split across two rows this would be a data-loss bug.
  //
  // The Dream-Board keys — nutrition:tabs, nutrition:widgets,
  // nutrition:boardSeeded, nutrition:seeded — are deliberately
  // untouched. They are orphaned but intact, exactly as
  // mainselfcare: was left when The Asclepion replaced Main's
  // Self-Care tab, and the prefix stays mounted so nothing
  // deletes them.
  // ------------------------------------------------------------
  function migrateNutritionKeys() {
    if (storeGet(KEYS.migratedNutrition)) return false;

    var pairs = [
      [OLD_KEYS.stores,            KEYS.stores,            storeModel],
      [OLD_KEYS.groceryItems,      KEYS.groceryItems,      groceryItemModel],
      [OLD_KEYS.recipes,           KEYS.recipes,           recipeModel],
      [OLD_KEYS.recipeIngredients, KEYS.recipeIngredients, recipeIngredientModel]
    ];

    var anything = pairs.some(function (p) { return arr(storeGet(p[0])).length; });
    if (!anything) {
      // Nothing to move. Still stamp it, so a device that joins
      // later does not re-check four keys on every boot forever.
      storeSet(KEYS.migratedNutrition, today());
      return false;
    }

    backup('pre-migration-nutrition');

    var moved = 0;
    pairs.forEach(function (p) {
      var oldKey = p[0], newKey = p[1], model = p[2];
      var src = arr(storeGet(oldKey));
      if (!src.length) { storeRemove(oldKey); return; }
      // MERGE, never clobber. If the new key already holds
      // records — a second device that migrated first, then
      // pushed — the ids decide, and the existing record wins.
      var dest = arr(storeGet(newKey));
      var seen = {};
      dest.forEach(function (r) { if (r && r.id) seen[r.id] = true; });
      src.forEach(function (r) {
        if (!r || (r.id && seen[r.id])) return;
        dest.push(model(r));
        moved++;
      });
      storeSet(newKey, dest);
      storeRemove(oldKey);
    });

    storeSet(KEYS.migratedNutrition, today());
    return moved > 0;
  }

  // ------------------------------------------------------------
  // M1 — the macro fields out of pal:days.
  //
  // The Palaestra carried kcal/protein/carbs/fat/water per date
  // for 730 days and lost its UI for them on 2026-08-25. The
  // Larder is now the sole owner of those five, so the history
  // comes with the ownership; steps, weight and cardioMin stay
  // where they are.
  //
  // WHY `legacy` AND NOT SYNTHETIC MEALS. The Larder derives a
  // day's totals from its log, and this history has no log — the
  // Palaestra recorded totals and never recorded what was eaten.
  // Writing fake breakfast entries to carry those numbers would
  // invent meals that were never eaten, and they would then be
  // editable, deletable and indistinguishable from real ones. A
  // flat legacy block is the honest shape: totalsFor() adds it on
  // top, and Progress can draw those days differently because it
  // can still tell them apart.
  //
  // MERGE, NEVER OVERWRITE. A date The Larder already owns keeps
  // what it has. That is what makes this safe to run on a second
  // device, and safe to run twice.
  // ------------------------------------------------------------
  function migratePalDays() {
    if (storeGet(KEYS.migratedPalDays)) return false;

    var P = global.Pal;
    // palaestra-data.js is loaded for pal:levels anyway. If it is
    // genuinely absent, do NOT stamp the flag — this device has
    // not migrated, and the next boot with the script present
    // should still try.
    if (!P || typeof P.allDays !== 'function') return false;

    var src = P.allDays() || {};
    var dates = Object.keys(src);
    if (!dates.length) {
      storeSet(KEYS.migratedPalDays, today());
      return false;
    }

    backup('pre-migration-pal-days');

    var days = allDays();
    var touched = 0;
    dates.forEach(function (date) {
      if (!isISO(date)) return;
      var from = src[date] || {};
      var cur = Object.assign({}, days[date] || {});

      // Water: only if The Larder has none for that date. A day
      // already logged here is the better record.
      if (!num(cur.water, 0) && num(from.water, 0) > 0) {
        cur.water = num(from.water, 0);
      }
      // Macros: only where there is no legacy block yet.
      if (!cur.legacy) {
        var legacy = legacyModel({
          kcal: from.kcal, protein: from.protein, carbs: from.carbs, fat: from.fat
        });
        if (legacy) cur.legacy = legacy;
      }

      var next = dayModel(cur);
      // Do not write an empty day record for every one of 730
      // dates the Palaestra happened to touch for a step count.
      if (!next.water && !next.legacy && !next.note &&
          !Object.keys(next.supps).length) return;
      days[date] = next;
      touched++;
    });

    var keys = Object.keys(days).sort();
    if (keys.length > DAY_CAP) {
      keys.slice(0, keys.length - DAY_CAP).forEach(function (k) { delete days[k]; });
    }
    storeSet(KEYS.days, days);
    storeSet(KEYS.migratedPalDays, today());
    return touched > 0;
  }

  /**
   * Both migrations, in the order they must run.
   *
   * M2 first: it is self-contained and touches only this app's
   * own rows. M1 second, because it reads a row this app does not
   * own and is the one that can be blocked by palaestra-data.js
   * being absent.
   *
   * @returns {{nutrition:boolean, palDays:boolean, changed:boolean}}
   */
  function runMigrations() {
    var a = false, b = false;
    try { a = migrateNutritionKeys(); } catch (e) { a = false; }
    try { b = migratePalDays(); } catch (e) { b = false; }
    return { nutrition: a, palDays: b, changed: !!(a || b) };
  }

  // ============================================================
  // §SEED
  //
  // Seeding is ADDITIVE AND ONCE, stamped by lar:seededAt rather
  // than by "does the library look empty". An emptied food table
  // is a decision, and re-seeding over it would make deletion
  // impossible.
  //
  // Recipes and the grocery list are NOT seeded — they arrive
  // from M2, which carries the real ones. Seeding them would put
  // three sample recipes on top of a library that already has
  // the reader's own.
  // ============================================================
  function isSeeded() { return !!storeGet(KEYS.seededAt); }

  function seedNow() {
    var S = global.LarSeed;
    if (!S) return false;
    if (isSeeded()) return false;

    if (!Foods.list().length && arr(S.foods).length) Foods.replaceAll(S.foods);
    if (!Supplements.list().length && arr(S.supplements).length) {
      Supplements.replaceAll(S.supplements);
    }
    if (!storeGet(KEYS.targets)) setTargets(S.targets || {});

    storeSet(KEYS.seededAt, today());
    return true;
  }

  /**
   * The gate. Runs the migrations and then the seed, but only
   * once the cloud has had its say.
   *
   * The 8-second backstop is not optional: a device with no
   * Supabase, no signal, or a hung pull would otherwise sit on a
   * blank page forever, and a blank page is worse than a seeded
   * one.
   *
   * @param {{pulled:boolean,onPulled:?function}} remoteRef from LarSync.mountAndSeed()
   * @param {function(boolean)} cb  true if anything changed
   */
  function seedAfterSyncAttempt(remoteRef, cb) {
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      var changed = false;
      try { changed = runMigrations().changed; } catch (e) {}
      try { changed = seedNow() || changed; } catch (e) {}
      if (typeof cb === 'function') cb(changed);
    }
    if (remoteRef && remoteRef.pulled) { go(); return; }
    if (remoteRef) remoteRef.onPulled = go;
    setTimeout(go, 8000);
  }

  // ============================================================
  // CHANGE NOTIFICATION
  //
  // Another tab, or sync.js's applyRemote — which writes with the
  // unpatched setter, so `storage` is the only way to hear it.
  // ============================================================
  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    function onStorage(e) {
      if (!e || !e.key) return;
      if (e.key.indexOf('lar:') !== 0 && e.key.indexOf('larlog:') !== 0) return;
      fn(e.key);
    }
    function onVis() { if (document.visibilityState === 'visible') fn(null); }
    global.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    return function () {
      global.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }

  global.Lar = {
    KEYS: KEYS, OLD_KEYS: OLD_KEYS,
    uid: uid, today: today, isISO: isISO,
    SLOTS: SLOTS, SLOT_LABELS: SLOT_LABELS, MEAL_CATEGORIES: MEAL_CATEGORIES,
    FOOD_GROUPS: FOOD_GROUPS, TAGS: TAGS, UNITS: UNITS, MACROS: MACROS,
    SUPPLEMENT_SLOTS: SUPPLEMENT_SLOTS,
    LOG_CAP: LOG_CAP, DAY_CAP: DAY_CAP,

    Models: {
      food: foodModel, meal: mealModel, component: componentModel,
      recipe: recipeModel, recipeIngredient: recipeIngredientModel,
      store: storeModel, groceryItem: groceryItemModel,
      supplement: supplementModel, note: noteModel, entry: entryModel, day: dayModel
    },

    Foods: Foods, Meals: Meals, Recipes: Recipes,
    RecipeIngredients: RecipeIngredients, Stores: Stores,
    GroceryItems: GroceryItems, Supplements: Supplements, Notes: Notes,

    groceryRemaining: groceryRemaining, groceryCheckedCount: groceryCheckedCount,
    groceryByStore: groceryByStore, resetGroceryList: resetGroceryList,
    deleteCheckedGrocery: deleteCheckedGrocery,
    restoreGroceryFrom: restoreGroceryFrom, groceryInSnapshots: groceryInSnapshots,

    TARGET_DEFAULTS: TARGET_DEFAULTS, getTargets: getTargets, setTargets: setTargets,

    logFor: logFor, allLog: allLog, addEntry: addEntry,
    removeEntry: removeEntry, updateEntry: updateEntry,
    allDays: allDays, getDay: getDay, patchDay: patchDay,
    addWaterMl: addWaterMl, toggleSupplement: toggleSupplement,

    emptyTotals: emptyTotals, mealTotals: mealTotals, foodAt: foodAt,
    totalsFor: totalsFor, slotTotals: slotTotals, slotEntries: slotEntries,
    slotsFilled: slotsFilled, groupCount: groupCount,

    migrateNutritionKeys: migrateNutritionKeys,
    migratePalDays: migratePalDays,
    runMigrations: runMigrations,
    isSeeded: isSeeded, seedNow: seedNow,
    seedAfterSyncAttempt: seedAfterSyncAttempt,
    onChange: onChange,

    // Internals the migration and seed modules need. Not for views.
    _store: { get: storeGet, set: storeSet, remove: storeRemove }
  };
})(window);
