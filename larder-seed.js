// =============================================================
// larder-seed.js — window.LarSeed
//
// What The Larder ships with. Content only: no ids, no logic.
// larder-data.js's seedNow() mints the ids and stamps
// lar:seededAt, so this file stays a content file and can be
// edited without reading any code.
//
// WHAT IS SEEDED AND WHAT IS NOT
//
// Seeded: the food table, the supplement slots, the targets.
// Those are the three things that make the page usable in its
// first minute — Quick Add with an empty food table is a screen
// that says "add a food first", which is exactly the friction
// this page exists to remove.
//
// NOT seeded: saved meals, recipes, the grocery list, the plan,
// notes. Recipes and grocery arrive from the migration carrying
// the real ones; putting three sample recipes on top of a
// library that already holds your own is how a seed becomes
// clutter. Saved meals are personal by definition — the page
// offers to save one the first time you log the same thing
// twice, which is a better prompt than five strangers' meals.
//
// THE NUMBERS
//
// Macros are per 100 g for anything weighed, and per piece for
// anything counted, which is how these foods are actually
// handled in a kitchen: nobody weighs a banana. `per` says which,
// so the stepper is always a multiplication. Values are USDA
// round numbers for raw/as-sold weights — close enough to be
// useful, and every one of them is editable.
// =============================================================

(function (global) {
  'use strict';

  // g  = per 100 g            piece = per 1 item
  // ml = per 100 ml           tbsp  = per 1 tablespoon
  var FOODS = [
    // --- the eight from the brief, marked isQuick so they fill
    //     the Quick Add strip on Today from the first boot ---
    { name: 'Eggs', unit: 'piece', per: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fibre: 0,
      defaultAmount: 3, step: 1, group: 'protein', isQuick: true,
      tags: ['high-protein', 'quick', 'cheap', 'savory'] },
    { name: 'Chicken breast', unit: 'g', per: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0,
      defaultAmount: 170, step: 10, group: 'protein', isQuick: true,
      tags: ['high-protein', 'post-workout', 'savory'] },
    { name: 'Rice, cooked', unit: 'g', per: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fibre: 0.4,
      defaultAmount: 180, step: 20, group: 'carb', isQuick: true,
      tags: ['cheap', 'make-ahead', 'savory'] },
    { name: 'Greek yoghurt', unit: 'g', per: 100, kcal: 73, protein: 10, carbs: 3.9, fat: 1.9, fibre: 0,
      defaultAmount: 170, step: 10, group: 'dairy', isQuick: true,
      tags: ['high-protein', 'quick', 'no-cook', 'sweet'] },
    { name: 'Protein shake', unit: 'serving', per: 1, kcal: 120, protein: 24, carbs: 3, fat: 1.5, fibre: 0,
      defaultAmount: 1, step: 1, group: 'protein', isQuick: true,
      tags: ['high-protein', 'quick', 'no-cook', 'post-workout'] },
    { name: 'Banana', unit: 'piece', per: 1, kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, fibre: 3.1,
      defaultAmount: 1, step: 1, group: 'fruit', isQuick: true,
      tags: ['quick', 'cheap', 'no-cook', 'sweet', 'post-workout'] },
    { name: 'Oat milk', unit: 'ml', per: 100, kcal: 45, protein: 1, carbs: 6.7, fat: 1.5, fibre: 0.8,
      defaultAmount: 250, step: 50, group: 'drink', isQuick: true,
      tags: ['quick', 'no-cook'] },
    { name: 'Bread, wholemeal', unit: 'piece', per: 1, kcal: 92, protein: 4, carbs: 15.5, fat: 1.2, fibre: 2.2,
      defaultAmount: 2, step: 1, group: 'carb', isQuick: true,
      tags: ['quick', 'cheap', 'no-cook'] },

    // --- protein ---
    { name: 'Salmon fillet', unit: 'g', per: 100, kcal: 208, protein: 20, carbs: 0, fat: 13, fibre: 0,
      defaultAmount: 150, step: 10, group: 'protein', tags: ['high-protein', 'savory'] },
    { name: 'Tuna, tinned in water', unit: 'g', per: 100, kcal: 116, protein: 26, carbs: 0, fat: 0.8, fibre: 0,
      defaultAmount: 145, step: 5, group: 'protein',
      tags: ['high-protein', 'quick', 'cheap', 'no-cook', 'savory'] },
    { name: 'Beef mince, 5% fat', unit: 'g', per: 100, kcal: 137, protein: 21, carbs: 0, fat: 5, fibre: 0,
      defaultAmount: 150, step: 10, group: 'protein', tags: ['high-protein', 'savory'] },
    { name: 'Cottage cheese', unit: 'g', per: 100, kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, fibre: 0,
      defaultAmount: 150, step: 10, group: 'dairy',
      tags: ['high-protein', 'quick', 'no-cook'] },
    { name: 'Tofu, firm', unit: 'g', per: 100, kcal: 144, protein: 17, carbs: 2.8, fat: 9, fibre: 2.3,
      defaultAmount: 150, step: 10, group: 'protein', tags: ['high-protein', 'vegetarian', 'savory'] },
    { name: 'Prawns, cooked', unit: 'g', per: 100, kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fibre: 0,
      defaultAmount: 120, step: 10, group: 'protein',
      tags: ['high-protein', 'low-calorie', 'quick', 'savory'] },

    // --- carbohydrate ---
    { name: 'Oats, rolled', unit: 'g', per: 100, kcal: 379, protein: 13, carbs: 67, fat: 6.5, fibre: 10,
      defaultAmount: 60, step: 10, group: 'carb',
      tags: ['cheap', 'make-ahead', 'sweet'] },
    { name: 'Pasta, cooked', unit: 'g', per: 100, kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, fibre: 1.8,
      defaultAmount: 200, step: 20, group: 'carb', tags: ['cheap', 'savory'] },
    { name: 'Potato', unit: 'g', per: 100, kcal: 77, protein: 2, carbs: 17, fat: 0.1, fibre: 2.2,
      defaultAmount: 250, step: 25, group: 'carb', tags: ['cheap', 'savory'] },
    { name: 'Sweet potato', unit: 'g', per: 100, kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fibre: 3,
      defaultAmount: 250, step: 25, group: 'carb', tags: ['cheap', 'savory'] },
    { name: 'Tortilla wrap', unit: 'piece', per: 1, kcal: 145, protein: 4, carbs: 24, fat: 3.5, fibre: 1.5,
      defaultAmount: 1, step: 1, group: 'carb', tags: ['quick', 'no-cook'] },

    // --- vegetables and fruit ---
    { name: 'Broccoli', unit: 'g', per: 100, kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fibre: 2.6,
      defaultAmount: 200, step: 25, group: 'veg',
      tags: ['low-calorie', 'vegetarian', 'savory'] },
    { name: 'Spinach', unit: 'g', per: 100, kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fibre: 2.2,
      defaultAmount: 100, step: 25, group: 'veg',
      tags: ['low-calorie', 'quick', 'vegetarian'] },
    { name: 'Mixed salad', unit: 'g', per: 100, kcal: 20, protein: 1.5, carbs: 3, fat: 0.2, fibre: 1.8,
      defaultAmount: 100, step: 25, group: 'veg',
      tags: ['low-calorie', 'quick', 'no-cook', 'vegetarian'] },
    { name: 'Tomato', unit: 'g', per: 100, kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fibre: 1.2,
      defaultAmount: 100, step: 25, group: 'veg',
      tags: ['low-calorie', 'no-cook', 'vegetarian'] },
    { name: 'Apple', unit: 'piece', per: 1, kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, fibre: 4.4,
      defaultAmount: 1, step: 1, group: 'fruit',
      tags: ['quick', 'cheap', 'no-cook', 'sweet'] },
    { name: 'Berries, mixed', unit: 'g', per: 100, kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, fibre: 2.4,
      defaultAmount: 100, step: 25, group: 'fruit',
      tags: ['low-calorie', 'no-cook', 'sweet'] },
    { name: 'Avocado', unit: 'piece', per: 1, kcal: 240, protein: 3, carbs: 12, fat: 22, fibre: 10,
      defaultAmount: 0.5, step: 0.5, group: 'fat',
      tags: ['no-cook', 'vegetarian', 'savory'] },

    // --- fats and extras ---
    { name: 'Olive oil', unit: 'tbsp', per: 1, kcal: 119, protein: 0, carbs: 0, fat: 13.5, fibre: 0,
      defaultAmount: 1, step: 1, group: 'fat', tags: ['savory'] },
    { name: 'Peanut butter', unit: 'tbsp', per: 1, kcal: 94, protein: 3.5, carbs: 3.2, fat: 8, fibre: 0.9,
      defaultAmount: 2, step: 1, group: 'fat', tags: ['quick', 'no-cook', 'sweet'] },
    { name: 'Almonds', unit: 'g', per: 100, kcal: 579, protein: 21, carbs: 22, fat: 50, fibre: 12.5,
      defaultAmount: 30, step: 10, group: 'fat',
      tags: ['quick', 'no-cook', 'savory'] },
    { name: 'Cheddar', unit: 'g', per: 100, kcal: 403, protein: 25, carbs: 1.3, fat: 33, fibre: 0,
      defaultAmount: 30, step: 10, group: 'dairy', tags: ['no-cook', 'savory'] },
    { name: 'Milk, semi-skimmed', unit: 'ml', per: 100, kcal: 50, protein: 3.6, carbs: 4.8, fat: 1.8, fibre: 0,
      defaultAmount: 250, step: 50, group: 'dairy', tags: ['quick', 'cheap', 'no-cook'] },
    { name: 'Honey', unit: 'tbsp', per: 1, kcal: 64, protein: 0.1, carbs: 17, fat: 0, fibre: 0,
      defaultAmount: 1, step: 1, group: 'other', tags: ['sweet', 'no-cook'] },
    { name: 'Dark chocolate', unit: 'g', per: 100, kcal: 546, protein: 4.9, carbs: 61, fat: 31, fibre: 7,
      defaultAmount: 25, step: 5, group: 'other', tags: ['sweet', 'no-cook'] },
    { name: 'Coffee, black', unit: 'ml', per: 100, kcal: 1, protein: 0.1, carbs: 0, fat: 0, fibre: 0,
      defaultAmount: 250, step: 50, group: 'drink', tags: ['low-calorie', 'quick', 'no-cook'] }
  ];

  // The three slots from the brief. Deliberately empty of actual
  // supplements: what you take is yours to say, and a seeded list
  // of vitamins nobody takes is a checklist you learn to ignore.
  // The slots exist so the Today card has somewhere to put them.
  var SUPPLEMENTS = [];

  var TARGETS = {
    kcal: 2300, protein: 180, carbs: 220, fat: 75, fibre: 30,
    waterMl: 2957,            // 100 US fl oz
    waterUnit: 'oz',
    waterSteps: [8, 16, 24],
    vegTarget: 3, fruitTarget: 2
  };

  global.LarSeed = {
    foods: FOODS,
    supplements: SUPPLEMENTS,
    targets: TARGETS
  };
})(window);
