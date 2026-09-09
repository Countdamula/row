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
    // Recipe categories are USER DATA, not a constant — added
    // 2026-09-08 with the Recipe Book, on the same model as Prompt
    // Studio's prm:groups. A record only ever stores a group id, so
    // renaming or recolouring one costs no migration.
    groups:            'lar:groups',
    uiState:           'lar:uiState',
    seededAt:          'lar:seededAt',
    migratedNutrition: 'lar:migratedNutrition',
    migratedPalDays:   'lar:migratedPalDays',
    migratedGroups:    'lar:groupsMigratedV1',
    schema:            'lar:schema',

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
  function nowISO() { return new Date().toISOString(); }
  // A label typed into a field can carry a newline or a control
  // character pasted out of somewhere else. Both survive JSON and
  // neither renders, so a group could end up looking blank.
  // A charCode loop, NOT a regex, and the same shape as Prompt
  // Studio's, and for the same reason: written as a character
  // class this needs literal control characters in the source,
  // where any tool that touches the file can silently eat them
  // (or turn the file binary, which is how this one was found).
  function stripControl(s) {
    var out = '', st = String(s == null ? '' : s), i, c;
    for (i = 0; i < st.length; i++) {
      c = st.charCodeAt(i);
      if (c > 31 && c !== 127 && c !== 8232 && c !== 8233) out += st.charAt(i);
    }
    return out;
  }
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

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

  // ============================================================
  // §GROUPS — recipe categories, as DATA
  //
  // Ported from Prompt Studio's prm:groups (promptarium-data.js
  // §GROUPS) rather than re-invented, because the hard parts here
  // are not the CRUD: they are the raw-string cache, the explicit
  // fallback chain, and the rule that a reorder can never drop a
  // group. All three are copied deliberately.
  //
  // A recipe stores a group ID and nothing else, which is what
  // makes renaming, recolouring and reordering cost no migration.
  // ============================================================

  /* The seed. Eight, because a personal recipe book that opens with
     twenty empty categories is a filing system you have to serve
     rather than one that serves you. They are ordinary kitchen
     words: this list is a shelf, not a taxonomy. */
  var RECIPE_CATEGORIES = [
    { id: 'breakfast', label: 'Breakfast', hue: '#e0a765' },
    { id: 'lunch',     label: 'Lunch',     hue: '#8fa39b' },
    { id: 'dinner',    label: 'Dinner',    hue: '#a9764c' },
    { id: 'sides',     label: 'Sides',     hue: '#b0a48c' },
    { id: 'baking',    label: 'Baking',    hue: '#c7b4a0' },
    { id: 'drinks',    label: 'Drinks',    hue: '#9aa3b0' },
    { id: 'sauces',    label: 'Sauces',    hue: '#b8796a' },
    { id: 'other',     label: 'Other',     hue: '#938b7c' }
  ];

  /* THE PALETTE A NEW GROUP CAN BE GIVEN — the same eighteen the
     other two studios use. Not a colour wheel: every one was
     sampled out of the hero photograph the house shares, and every
     one clears 3:1 on the ground. A free picker is how a group ends
     up invisible.

     The eight defaults above are spread ACROSS this list for
     separation rather than chosen for a pleasing run. Prompt Studio
     learned that the expensive way: four near-identical greys are
     fine as a hairline and read as one colour the moment the same
     token becomes a filled capsule. */
  var GROUP_HUES = [
    { hue: '#d6d2cb', name: 'Marble' },       { hue: '#bbc4bf', name: 'Window' },
    { hue: '#a8b0ad', name: 'Window stone' }, { hue: '#c3c6c6', name: 'Daylight' },
    { hue: '#e0a765', name: 'Sconce' },       { hue: '#c99a63', name: 'Gilding' },
    { hue: '#c08a55', name: 'Candle' },       { hue: '#a9764c', name: 'Old copper' },
    { hue: '#8f6a48', name: 'Deep bronze' },  { hue: '#938b7c', name: 'Cool stone' },
    { hue: '#6b6259', name: 'Ground' },       { hue: '#b8796a', name: 'Ember' },
    { hue: '#a98b9a', name: 'Dusk' },         { hue: '#8fa39b', name: 'Verdigris' },
    { hue: '#c7b4a0', name: 'Parchment' },    { hue: '#9aa3b0', name: 'Slate' },
    { hue: '#b0a48c', name: 'Linen' },        { hue: '#7f8a86', name: 'Shadow stone' }
  ];

  /* Protected: it cannot be deleted, and it is re-seeded if it goes
     missing. Something has to catch a recipe whose group was
     deleted on a device this one has not heard from yet. */
  var FALLBACK_GROUP = 'other';

  function slugId(label, taken) {
    var base = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '').replace(/-+$/, '').slice(0, 32) || 'group';
    var id = base, n = 2;
    while (taken && taken.indexOf(id) !== -1) id = base + '-' + (n++);
    return id;
  }

  function groupModel(d) {
    d = d || {};
    return {
      id: d.id || slugId(d.label),
      label: stripControl(d.label == null ? 'Untitled group' : String(d.label)).slice(0, 40) || 'Untitled group',
      hue: /^#[0-9a-fA-F]{6}$/.test(d.hue) ? d.hue : GROUP_HUES[0].hue,
      order: d.order == null ? 0 : (Number(d.order) || 0),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || ''
    };
  }

  /* CACHED ON THE RAW STRING, and that is load-bearing rather than a
     micro-optimisation: catById() runs once per card per paint.
     Keying the cache on the raw localStorage string rather than on a
     dirty flag is what makes it correct under EVERY writer — this
     file, a cloud pull applying straight through sync.js's
     localStorage patch, or another tab. The string IS the source of
     truth; a dirty flag set in here would never hear about the
     other two. */
  var gRaw = null, gVal = null;

  function seedGroupList(parsed) {
    var out = Array.isArray(parsed) ? parsed.map(groupModel) : [];
    if (!out.length) {
      out = RECIPE_CATEGORIES.map(function (c, i) {
        return groupModel({ id: c.id, label: c.label, hue: c.hue, order: i });
      });
    }
    var hasFallback = false;
    for (var i = 0; i < out.length; i++) if (out[i].id === FALLBACK_GROUP) hasFallback = true;
    if (!hasFallback) {
      out.push(groupModel({ id: FALLBACK_GROUP, label: 'Other', hue: '#938b7c', order: 9999 }));
    }
    return out.sort(byOrder);
  }

  function recipeGroups() {
    var raw = null;
    try { raw = localStorage.getItem(KEYS.groups); } catch (e) {}
    if (raw !== null && raw === gRaw && gVal) return gVal;
    var parsed = null;
    try { parsed = raw == null ? null : JSON.parse(raw); } catch (e) {}
    gVal = seedGroupList(parsed);
    gRaw = raw;
    return gVal;
  }

  /* Writes the seed out the first time anything asks, so Settings and
     the editor's select are editing something real rather than a list
     that exists only in memory. Runs after LocalStoreIDB.ready() and
     BEFORE cloud sync mounts — a seed pushed on top of a row that
     already has groups would be the wrong way round. */
  function ensureGroups() {
    var raw = null;
    try { raw = localStorage.getItem(KEYS.groups); } catch (e) {}
    var parsed = null;
    try { parsed = raw == null ? null : JSON.parse(raw); } catch (e) {}
    var seeded = seedGroupList(parsed);
    if (!Array.isArray(parsed) || parsed.length !== seeded.length) {
      storeSet(KEYS.groups, seeded);
      gRaw = null;
    }
    return recipeGroups();
  }

  function addGroup(label, hue) {
    var all = recipeGroups();
    var taken = all.map(function (g) { return g.id; });
    var max = 0;
    all.forEach(function (g) { if ((g.order || 0) > max) max = g.order || 0; });
    var rec = groupModel({ id: slugId(label, taken), label: label, hue: hue, order: max + 1 });
    storeSet(KEYS.groups, all.concat([rec]));
    gRaw = null;
    return rec;
  }

  function updateGroup(id, patch) {
    var all = recipeGroups().slice(), idx = -1, i, k, k2;
    for (i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
    if (idx < 0) return null;
    var merged = {};
    for (k in all[idx]) merged[k] = all[idx][k];
    for (k2 in patch) merged[k2] = patch[k2];
    merged.id = id;                 // an id is never edited: recipes point at it
    merged.updatedAt = nowISO();
    all[idx] = groupModel(merged);
    storeSet(KEYS.groups, all);
    gRaw = null;
    return all[idx];
  }

  function reorderGroups(ids) {
    var all = recipeGroups(), by = {}, out = [];
    all.forEach(function (g) { by[g.id] = g; });
    function push(g) {
      out.push(groupModel({ id: g.id, label: g.label, hue: g.hue, order: out.length,
                            createdAt: g.createdAt, updatedAt: g.updatedAt }));
    }
    (ids || []).forEach(function (id) {
      if (!by[id]) return;
      push(by[id]);
      delete by[id];
    });
    /* Anything the caller did not name keeps its place at the end
       rather than being dropped. A reorder is not a delete, and a drag
       handler that misses a row must not be able to destroy one. */
    Object.keys(by).forEach(function (id) { push(by[id]); });
    storeSet(KEYS.groups, out);
    gRaw = null;
    return out;
  }

  /* DELETING A GROUP RE-FILES ITS RECIPES FIRST. A recipe left
     pointing at a group that no longer exists renders as Other by
     luck rather than by decision, and on the next device it might
     not. There is only one library here, so unlike Prompt Studio
     there is no sidecar to sweep as well. */
  function removeGroup(id, moveTo) {
    if (id === FALLBACK_GROUP) return { ok: false, reason: 'protected' };
    var all = recipeGroups(), found = false, destOk = false, i;
    for (i = 0; i < all.length; i++) {
      if (all[i].id === id) found = true;
      if (all[i].id === moveTo) destOk = true;
    }
    if (!found) return { ok: false, reason: 'missing' };
    var dest = (destOk && moveTo !== id) ? moveTo : FALLBACK_GROUP;

    var moved = 0;
    Recipes.list().forEach(function (r) {
      if (r.groupId === id) { Recipes.update(r.id, { groupId: dest }); moved++; }
    });
    storeSet(KEYS.groups, all.filter(function (g) { return g.id !== id; }));
    gRaw = null;
    return { ok: true, moved: moved, dest: dest };
  }

  /* How many recipes each group holds. Settings and the rail both
     ask, and a delete confirmation that under-reports is worse than
     no confirmation at all. */
  function groupCounts() {
    var counts = {};
    Recipes.list().forEach(function (r) {
      counts[r.groupId] = (counts[r.groupId] || 0) + 1;
    });
    return counts;
  }

  function catList() { return recipeGroups(); }
  /* THE FALLBACK IS EXPLICIT. Returning all[all.length - 1] and
     relying on Other being last is true of a frozen constant and
     false the moment a group can be reordered or added after it.
     Look up the id, then the fallback BY NAME, then whatever is
     last — so a recipe pointing at a group deleted on another device
     renders as Other rather than as a blank pill. */
  function catById(id) {
    var all = catList(), i;
    for (i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    for (i = 0; i < all.length; i++) if (all[i].id === FALLBACK_GROUP) return all[i];
    return all[all.length - 1] || { id: FALLBACK_GROUP, label: 'Other', hue: '#938b7c' };
  }

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
  /**
   * A STEP IS A BLOCK, not a line.
   *
   * It carries an `id` because everything the method editor does —
   * reorder, add a photo, delete — addresses one step, and an index
   * is wrong the moment a drag lands. Bare strings are still
   * accepted and upgraded, because that is what the old textarea
   * editor wrote.
   *
   * `images` replaced the single `imageUrl` on 2026-09-08. The old
   * field is still READ so nothing written before then is lost; it
   * is simply never written again.
   *
   * FOUR IMAGES, AND THEY ARE URLS. A base64 data URL would survive
   * this model, and that is precisely the danger: lar:recipes sits
   * on a synced row, and pushNow() re-uploads the row's ENTIRE data
   * column on every debounced save. Photos go through
   * PhotoStore.upload() and what lands here is a ~100-byte link.
   * See §PHOTOS in larder.html.
   */
  function recipeStepModel(s) {
    if (typeof s === 'string') return { id: uid('step'), text: str(s, 2000), images: [] };
    s = s || {};
    var imgs = arr(s.images).map(function (u) { return str(u, 2000); })
      .filter(function (u) { return !!u; });
    if (!imgs.length && s.imageUrl) imgs = [str(s.imageUrl, 2000)];
    return {
      id: s.id || uid('step'),
      text: str(s.text, 2000),
      images: imgs.slice(0, 4)
    };
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
      // The category. A group ID and nothing else — see §GROUPS.
      // catById() resolves an unknown or deleted one to Other rather
      // than letting a recipe fall out of every filter.
      groupId: catById(d.groupId).id,
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
      // The cover. Declared since the 2026-08-26 rebuild and never
      // written until the Recipe Book; it is the card's photograph
      // and the facing page of the recipe. Capped, and a URL for the
      // same reason a step's images are — see recipeStepModel.
      imageUrl: str(d.imageUrl, 2000) || null,
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
  // The category list. Declared here with the others so there is one
  // place that says what a collection in this app is; §GROUPS above
  // reads it through recipeGroups(), never directly, because the
  // cache is what makes catById() affordable per card per paint.
  var Groups            = makeCollection(KEYS.groups, groupModel);
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
  /**
   * §MIGRATION — a recipe's tags become its group.
   *
   * Before the Recipe Book a recipe was filed by a free `tags`
   * array and the Recipes screen filtered on a hard-coded list of
   * seven. Four of those seven are now real groups, so the filing
   * that already existed is carried over instead of dropping every
   * recipe into Other and asking Damian to re-file by hand.
   *
   * The tag is KEPT as well as read. Tags did not stop being useful
   * when categories arrived — "quick" and "high-protein" are still
   * tags, and they are still how the rail's tag filter works. This
   * migration only decides a starting group.
   *
   * Stamped, and idempotent: it only ever touches a recipe that is
   * still sitting on the fallback group.
   */
  var TAG_TO_GROUP = {
    breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner',
    snack: 'sides', dessert: 'baking', drink: 'drinks', sauce: 'sauces'
  };
  function migrateRecipeGroups() {
    if (storeGet(KEYS.migratedGroups)) return false;
    var known = {}, moved = 0;
    recipeGroups().forEach(function (g) { known[g.id] = true; });
    Recipes.list().forEach(function (r) {
      if (r.groupId && r.groupId !== FALLBACK_GROUP) return;
      var hit = '';
      arr(r.tags).forEach(function (t) {
        if (hit) return;
        var want = TAG_TO_GROUP[String(t).toLowerCase()];
        if (want && known[want]) hit = want;
      });
      if (hit) { Recipes.update(r.id, { groupId: hit }); moved++; }
    });
    storeSet(KEYS.migratedGroups, { at: nowISO(), moved: moved });
    return moved > 0;
  }

  /**
   * §THE WIPE — the Nutrition Studio becomes a Recipe Book and a
   * Grocery List, and the rest goes.
   *
   * Damian asked for these removed rather than hidden, on
   * 2026-09-08. What goes is everything the page no longer has a
   * screen for: the food table, saved meals, the meal plan, the
   * targets, the supplements, the notes, and the whole eating log.
   *
   * WHAT IS NOT TOUCHED, and why:
   *   lar:recipes / lar:recipeIngredients   the Recipe Book
   *   lar:groceryItems / lar:stores         the Grocery List
   *   lar:groups                            the new categories
   *   nutrition:*                           orphaned but intact,
   *                                         and not ours to delete
   *
   * THIS DELETES KEYS, NEVER A PREFIX. `larlog:` stays in
   * larder-sync.js's ROWS table forever — read that file's header.
   * A prefix list is a delete list for the whole account, and
   * removing one is a far bigger instruction than removing a key.
   *
   * It is called ONCE, from onPulled, and never at boot: pushNow()
   * sends collect() as the row's entire data column, so a wipe that
   * beat the opening select would erase whatever else lives in the
   * row and then push the erasure as truth.
   *
   * `force` exists for the one honest case — nothing worth
   * snapshotting, therefore nothing to lose. See runWipeOnce() in
   * larder.html, which refuses to proceed on any other footing.
   */
  var WIPE_KEYS = [
    KEYS.foods, KEYS.meals, KEYS.plan, KEYS.targets,
    KEYS.supplements, KEYS.notes,
    KEYS.log, KEYS.days
  ];
  var SCHEMA_NOW = 'recipebook-1';

  function wipeLegacy(opts) {
    opts = opts || {};
    if (storeGet(KEYS.schema) === SCHEMA_NOW) return { ran: false, removed: [] };
    if (!opts.force && !opts.snapshotted) return { ran: false, removed: [], reason: 'no-snapshot' };
    var removed = [];
    WIPE_KEYS.forEach(function (k) {
      if (localStorage.getItem(k) == null) return;
      storeRemove(k);
      removed.push(k);
    });
    storeSet(KEYS.schema, SCHEMA_NOW);
    return { ran: true, removed: removed };
  }
  /* What the wipe WOULD take, for the confirmation to name. A count
     of records, not of keys: "removes 730 day records" is a sentence
     someone can make a decision about; "removes 8 keys" is not. */
  function legacyCounts() {
    var out = [], n;
    function count(key, label) {
      var v = storeGet(key);
      if (v == null) return;
      n = Array.isArray(v) ? v.length : (typeof v === 'object' ? Object.keys(v).length : 1);
      if (n) out.push({ key: key, label: label, n: n });
    }
    count(KEYS.foods, 'foods');
    count(KEYS.meals, 'saved meals');
    count(KEYS.plan, 'planned days');
    count(KEYS.supplements, 'supplements');
    count(KEYS.notes, 'notes');
    count(KEYS.log, 'logged entries');
    count(KEYS.days, 'day records');
    count(KEYS.targets, 'nutrition goals');
    return out;
  }
  function wipeDone() { return storeGet(KEYS.schema) === SCHEMA_NOW; }

  function runMigrations() {
    var a = false, b = false, c = false;
    // Still first, and still unconditional: a device that has not
    // opened this page since 2026-08-26 holds its recipes and its
    // grocery list under nutrition:* and nothing else will move them.
    try { a = migrateNutritionKeys(); } catch (e) { a = false; }
    // SKIPPED once the wipe has run. This one copies pal:days macro
    // history INTO larlog:days, which §THE WIPE deletes — so after
    // the rebuild it is a migration whose only effect would be to
    // re-create the key that was just removed.
    if (!wipeDone()) { try { b = migratePalDays(); } catch (e) { b = false; } }
    try { c = migrateRecipeGroups(); } catch (e) { c = false; }
    return { nutrition: a, palDays: b, groups: c, changed: !!(a || b || c) };
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
  // ============================================================
  // §PHOTOS — the read-and-shrink half of the pipeline.
  //
  // Its other half is photo-store.js, which uploads and hands back
  // a URL. These two are the repo's established pair; this is the
  // seventh copy of them and that duplication is the convention
  // here, not an oversight (palaestra-data.js:2223, codex-data.js:99,
  // finance-data.js:76, businessos-data.js:121, and so on).
  //
  // The Larder used to borrow them off window.Pal, because
  // palaestra-data.js was loaded for pal:levels. The effort level
  // belonged to the Today screen, Today is gone, and loading a whole
  // other studio's data layer to reach two canvas helpers is not a
  // dependency worth keeping.
  //
  // NEITHER OF THESE EVER REJECTS. A photo that will not decode
  // resolves as the original string, and a file that will not read
  // resolves as ''. A dropped image must not be able to take a save
  // down with it.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1200; quality = quality || 0.82;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(c.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }
  function readFileAsDataUrl(file) {
    return new Promise(function (resolve) {
      try {
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result)); };
        r.onerror = function () { resolve(''); };
        r.readAsDataURL(file);
      } catch (e) { resolve(''); }
    });
  }

  function isSeeded() { return !!storeGet(KEYS.seededAt); }

  /**
   * THERE IS NOTHING LEFT TO SEED, and this function survives
   * saying so rather than being deleted.
   *
   * It used to write a food table, a supplement list and a set of
   * nutrition targets on a device's first run. All three are gone
   * (see §THE WIPE), and a seeder that re-creates the very keys the
   * wipe removes is not a leftover — it is a loop: seed, wipe, and
   * on a fresh device seed again.
   *
   * The categories ARE seeded, but by ensureGroups(), which runs
   * before cloud sync mounts rather than after the pull. A category
   * list has to exist before the first render; a food table did not.
   *
   * The stamp is still written so isSeeded() keeps meaning "this
   * device has been through first-run", which the empty states read.
   */
  function seedNow() {
    if (isSeeded()) return false;
    storeSet(KEYS.seededAt, today());
    return false;
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

    // --- §GROUPS: recipe categories, as data ---
    RECIPE_CATEGORIES: RECIPE_CATEGORIES, GROUP_HUES: GROUP_HUES,
    FALLBACK_GROUP: FALLBACK_GROUP,
    Groups: Groups, recipeGroups: recipeGroups, ensureGroups: ensureGroups,
    addGroup: addGroup, updateGroup: updateGroup, reorderGroups: reorderGroups,
    removeGroup: removeGroup, groupCounts: groupCounts,
    catList: catList, catById: catById, slugId: slugId,

    // --- §THE WIPE ---
    wipeLegacy: wipeLegacy, legacyCounts: legacyCounts, wipeDone: wipeDone,

    // --- photos: the house pipeline, so views do not each grow one ---
    compressImageDataUrl: compressImageDataUrl, readFileAsDataUrl: readFileAsDataUrl,

    migrateNutritionKeys: migrateNutritionKeys,
    migratePalDays: migratePalDays,
    migrateRecipeGroups: migrateRecipeGroups,
    runMigrations: runMigrations,
    isSeeded: isSeeded, seedNow: seedNow,
    seedAfterSyncAttempt: seedAfterSyncAttempt,
    onChange: onChange,

    // Internals the migration and seed modules need. Not for views.
    _store: { get: storeGet, set: storeSet, remove: storeRemove }
  };
})(window);
