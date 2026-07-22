// finance-data.js
//
// Shared data foundation for the in-progress Finance rebuild: typed-by-JSDoc
// models, a localStorage-backed data-access layer, and pure derived selectors.
// No UI reads this yet — it is not <script>-included by finance.html or any
// other page. A future Finance UI will add `<script src="finance-data.js">`
// and start calling into `window.FinanceData`.
//
// Persistence matches this codebase's existing pattern (see CLAUDE.md §4):
// plain localStorage, JSON-serialized, one key per collection, no server/DB.
// New keys live under a `financev2:` prefix so they can't collide with
// finance.html's current `finance:*` / `nw:*` / `subs` keys, which use a
// different (float CHF) shape — those stay untouched until a future cutover
// migrates them into this schema.
//
// Money rule: every amount is an integer number of minor units (cents) —
// never a float. FinanceCurrency is the one shared helper for turning user
// input into cents and cents back into a display string.

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
    accounts: 'financev2:accounts',
    transactions: 'financev2:transactions',
    subscriptions: 'financev2:subscriptions',
    incomeSources: 'financev2:incomeSources',
    notes: 'financev2:notes',
    seeded: 'financev2:seeded',
    migratedCurrencyUsd: 'financev2:migratedCurrencyUsd',
    // Deliberately under the already-synced `finance:` prefix (see
    // finance.html's initCloudSync syncedPrefixes), NOT `financev2:` —
    // the hero banner is cosmetic page chrome, not test-sensitive
    // Accounts/Transactions/etc. data, so there's no reason to hold it
    // back from sync the way financev2:* currently is.
    hero: 'finance:hero'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // HERO — single editable cover-banner record, same shape/behavior as
  // aitech-data.js's/business-data.js's own hero record: this page has
  // no tabs, so there's just one instance.
  // ============================================================
  function heroModel(data) {
    data = data || {};
    return {
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : '',
      title: typeof data.title === 'string' ? data.title : '',
      subtext: typeof data.subtext === 'string' ? data.subtext : '',
      ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : ''
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero)); }
  function saveHero(patch) { const next = heroModel(Object.assign({}, getHero(), patch)); storeSet(KEYS.hero, next); return next; }

  // Same canvas-downscale recipe used for cover/hero photos throughout
  // this app (entertainment.html/business.html/aitech.html/etc.).
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 480;
    quality = quality == null ? 0.82 : quality;
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
  // DATE HELPERS — local-date-safe. Every date in this module is a
  // plain "YYYY-MM-DD" string, compared as a string (lexicographic
  // order == chronological order for ISO dates). We deliberately never
  // round-trip a bare date through `new Date(isoString)`, since that
  // parses as UTC midnight and can land on the wrong day depending on
  // the browser's timezone — the classic off-by-one-day bug.
  // ============================================================
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function monthPrefix(year, month) { return year + '-' + pad2(month) + '-'; }
  function endOfMonthISO(year, month) { return year + '-' + pad2(month) + '-31'; }

  // ============================================================
  // CURRENCY — the one shared helper for parsing user input into
  // integer cents and formatting cents back for display. Configurable
  // currency/locale (defaults match the rest of the app: USD/en-US);
  // individual calls can override the currency (e.g. to format using
  // a specific account's own currency).
  // ============================================================
  const CurrencyConfig = {
    currency: 'USD',
    locale: 'en-US'
  };

  const FinanceCurrency = {
    configure(opts) {
      if (opts && opts.currency) CurrencyConfig.currency = opts.currency;
      if (opts && opts.locale) CurrencyConfig.locale = opts.locale;
    },
    /**
     * "12.50", "12,50", "1,234.56", "1.234,56", 12.5, "USD 12.50", "-4.20"
     * -> integer cents. Never a float. The LAST comma-or-period in the
     * string is treated as the decimal separator; any earlier ones are
     * assumed to be thousands grouping and stripped.
     */
    parseToCents(input) {
      if (input == null || input === '') return 0;
      if (typeof input === 'number') return Math.round(input * 100);
      let s = String(input).trim();
      const negative = s.indexOf('-') !== -1;
      s = s.replace(/[^0-9.,]/g, '');
      if (!s) return 0;
      const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
      let intPart, fracPart;
      if (lastSep === -1) {
        intPart = s; fracPart = '';
      } else {
        intPart = s.slice(0, lastSep).replace(/[.,]/g, '');
        fracPart = s.slice(lastSep + 1).replace(/[^0-9]/g, '');
      }
      const n = parseFloat((intPart || '0') + '.' + (fracPart || '0'));
      if (isNaN(n)) return 0;
      return Math.round((negative ? -1 : 1) * n * 100);
    },
    /** integer cents -> "$12.50" (or whatever currency/locale is configured/passed). */
    format(cents, opts) {
      const currency = (opts && opts.currency) || CurrencyConfig.currency;
      const locale = (opts && opts.locale) || CurrencyConfig.locale;
      const amount = (Number(cents) || 0) / 100;
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
      } catch (e) {
        return currency + ' ' + amount.toFixed(2);
      }
    }
  };

  // ============================================================
  // MODELS — no build step / no TypeScript in this repo, so "typed"
  // means a JSDoc @typedef (for editor hints) plus a factory that
  // fills every field with a sane default and coerces amounts to
  // integer cents, rather than compile-time types.
  // ============================================================

  /**
   * @typedef {Object} Account
   * @property {string} id
   * @property {string} name
   * @property {'checking'|'savings'|'credit'|'cash'|'investment'|'loan'} type
   * @property {string} institution
   * @property {number} balanceCents - integer minor units, always >= 0. For
   *   'credit'/'loan' accounts this is the amount OWED (a positive number) —
   *   netWorthCents() is the one place that subtracts it.
   * @property {string} currency
   * @property {string} color
   * @property {string} icon
   * @property {boolean} isActive
   * @property {string} createdAt - ISO date (YYYY-MM-DD)
   */
  function accountModel(data) {
    data = data || {};
    return {
      id: data.id || uid('acct'),
      name: data.name || '',
      type: data.type || 'checking',
      institution: data.institution || '',
      balanceCents: Math.abs(Math.round(Number(data.balanceCents) || 0)),
      currency: data.currency || CurrencyConfig.currency,
      color: data.color || '#7DD3FC',
      icon: data.icon || '🏦',
      isActive: data.isActive != null ? !!data.isActive : true,
      createdAt: data.createdAt || todayISO()
    };
  }

  /**
   * @typedef {Object} Transaction
   * @property {string} id
   * @property {string} accountId
   * @property {string} date - ISO date (YYYY-MM-DD), a LOCAL calendar date
   * @property {number} amountCents - positive magnitude, integer minor units
   * @property {'income'|'expense'|'transfer'} type
   * @property {string} category
   * @property {string} merchant
   * @property {string} description
   * @property {string} notes
   * @property {?string} transferToAccountId - set only when type === 'transfer'
   */
  function transactionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('txn'),
      accountId: data.accountId || null,
      date: data.date || todayISO(),
      amountCents: Math.abs(Math.round(Number(data.amountCents) || 0)),
      type: data.type || 'expense',
      category: data.category || 'other',
      merchant: data.merchant || '',
      description: data.description || '',
      notes: data.notes || '',
      transferToAccountId: data.type === 'transfer' ? (data.transferToAccountId || null) : null
    };
  }

  /**
   * @typedef {Object} Subscription
   * @property {string} id
   * @property {string} name
   * @property {number} amountCents - integer minor units, charged once per billingCycle
   * @property {'weekly'|'monthly'|'quarterly'|'yearly'} billingCycle
   * @property {string} nextBillingDate - ISO date
   * @property {string} category
   * @property {?string} accountId
   * @property {string} startDate - ISO date
   * @property {boolean} isActive
   */
  function subscriptionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('sub'),
      name: data.name || '',
      amountCents: Math.abs(Math.round(Number(data.amountCents) || 0)),
      billingCycle: data.billingCycle || 'monthly',
      nextBillingDate: data.nextBillingDate || todayISO(),
      category: data.category || 'other',
      accountId: data.accountId || null,
      startDate: data.startDate || todayISO(),
      isActive: data.isActive != null ? !!data.isActive : true
    };
  }

  /**
   * @typedef {Object} IncomeSource
   * @property {string} id
   * @property {string} name
   * @property {number} expectedAmountCents - integer minor units, once per cadence
   * @property {'weekly'|'biweekly'|'monthly'|'yearly'} cadence
   * @property {?string} accountId
   * @property {boolean} isActive
   */
  function incomeSourceModel(data) {
    data = data || {};
    return {
      id: data.id || uid('inc'),
      name: data.name || '',
      expectedAmountCents: Math.abs(Math.round(Number(data.expectedAmountCents) || 0)),
      cadence: data.cadence || 'monthly',
      accountId: data.accountId || null,
      isActive: data.isActive != null ? !!data.isActive : true
    };
  }

  /**
   * @typedef {Object} Note
   * @property {string} id
   * @property {string} content - freeform text
   * @property {number} order - sort key for manual reordering; new notes
   *   default to Date.now() so they append at the end
   * @property {string} createdAt - ISO date
   * @property {string} updatedAt - ISO date, bumped on every edit
   */
  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      content: data.content || '',
      order: data.order != null ? data.order : Date.now(),
      createdAt: data.createdAt || todayISO(),
      updatedAt: data.updatedAt || todayISO()
    };
  }

  // ============================================================
  // DATA ACCESS — list / get / add / update / remove per collection.
  // Every collection is one JSON array under one localStorage key,
  // same shape as `subs`/`finance:transactions` etc. elsewhere in
  // this app.
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
      // Re-run through the model factory so patched amount fields stay
      // integer cents and unknown/missing fields keep their defaults.
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

  const Accounts = makeCollection(KEYS.accounts, accountModel);
  const Transactions = makeCollection(KEYS.transactions, transactionModel);
  const Subscriptions = makeCollection(KEYS.subscriptions, subscriptionModel);
  const IncomeSources = makeCollection(KEYS.incomeSources, incomeSourceModel);
  const Notes = makeCollection(KEYS.notes, noteModel);

  // ============================================================
  // DERIVED SELECTORS — pure functions over the collections above.
  // None of these mutate storage; all are safe to call as often as a
  // future UI likes (re-derive on every render, don't cache).
  // ============================================================

  /** Sum of active account balances; credit/loan balances (amount owed) are subtracted. */
  function netWorthCents() {
    return Accounts.list().filter(function (a) { return a.isActive; }).reduce(function (sum, a) {
      const isDebt = a.type === 'credit' || a.type === 'loan';
      return sum + (isDebt ? -a.balanceCents : a.balanceCents);
    }, 0);
  }

  /** Transactions whose (local) date falls in the given calendar month. month is 1-12. */
  function transactionsForMonth(year, month) {
    const prefix = monthPrefix(year, month);
    return Transactions.list().filter(function (t) { return String(t.date || '').indexOf(prefix) === 0; });
  }

  function monthlyIncomeTotalCents(year, month) {
    return transactionsForMonth(year, month)
      .filter(function (t) { return t.type === 'income'; })
      .reduce(function (sum, t) { return sum + t.amountCents; }, 0);
  }

  function monthlyExpenseTotalCents(year, month) {
    return transactionsForMonth(year, month)
      .filter(function (t) { return t.type === 'expense'; })
      .reduce(function (sum, t) { return sum + t.amountCents; }, 0);
  }

  /** Expense-only category totals for a month, largest first. Transfers/income excluded. */
  function categoryBreakdownForMonth(year, month) {
    const byCat = {};
    transactionsForMonth(year, month)
      .filter(function (t) { return t.type === 'expense'; })
      .forEach(function (t) {
        const cat = t.category || 'other';
        byCat[cat] = (byCat[cat] || 0) + t.amountCents;
      });
    return Object.keys(byCat)
      .map(function (category) { return { category: category, totalCents: byCat[category] }; })
      .sort(function (a, b) { return b.totalCents - a.totalCents; });
  }

  /** Normalize any billingCycle to a per-month integer-cent amount. */
  function subscriptionMonthlyEquivalentCents(sub) {
    const amt = Number(sub && sub.amountCents) || 0;
    switch (sub && sub.billingCycle) {
      case 'weekly': return Math.round(amt * 52 / 12);
      case 'quarterly': return Math.round(amt / 3);
      case 'yearly': return Math.round(amt / 12);
      case 'monthly':
      default: return Math.round(amt);
    }
  }

  // Both period selectors below only count a subscription once its startDate
  // has arrived (so a subscription starting in September doesn't retroactively
  // inflate June's total) — the one piece of date filtering the "sum of active
  // subs" description needs to make the (year, month)/(year) arguments do
  // anything at all, since isActive alone is not date-scoped.
  function subscriptionsSumForMonthCents(year, month) {
    const cutoff = endOfMonthISO(year, month);
    return Subscriptions.list()
      .filter(function (s) { return s.isActive && (!s.startDate || s.startDate <= cutoff); })
      .reduce(function (sum, s) { return sum + subscriptionMonthlyEquivalentCents(s); }, 0);
  }

  /** Annualized sum (monthly-equivalent × 12) of active subs already started by that year's end. */
  function subscriptionsSumForYearCents(year) {
    const cutoff = year + '-12-31';
    return Subscriptions.list()
      .filter(function (s) { return s.isActive && (!s.startDate || s.startDate <= cutoff); })
      .reduce(function (sum, s) { return sum + subscriptionMonthlyEquivalentCents(s) * 12; }, 0);
  }

  // ============================================================
  // SEED DATA — a small, realistic starter set so a future UI has
  // something to render. Runs once, guarded by financev2:seeded, and
  // only if all four collections are already empty (so it can never
  // clobber real data added later).
  // ============================================================
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Accounts.list().length || Transactions.list().length || Subscriptions.list().length || IncomeSources.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }

    const checking = Accounts.add({ name: 'Checking', type: 'checking', institution: 'UBS', balanceCents: 345000, color: '#7DD3FC', icon: '🏦' });
    const savings = Accounts.add({ name: 'Savings', type: 'savings', institution: 'UBS', balanceCents: 1250000, color: '#6EE7B7', icon: '💰' });
    Accounts.add({ name: 'Credit Card', type: 'credit', institution: 'Cembra', balanceCents: 62450, color: '#FF8A8A', icon: '💳' });
    Accounts.add({ name: 'Investment Portfolio', type: 'investment', institution: 'Interactive Brokers', balanceCents: 890000, color: '#B794F4', icon: '📈' });

    const today = todayISO();
    const dateParts = today.split('-').map(Number);
    const thisMonth = dateParts[0] + '-' + pad2(dateParts[1]);
    const prevMonthDate = new Date(dateParts[0], dateParts[1] - 2, 1);
    const prevMonth = prevMonthDate.getFullYear() + '-' + pad2(prevMonthDate.getMonth() + 1);

    Transactions.add({ accountId: checking.id, date: thisMonth + '-01', amountCents: 520000, type: 'income', category: 'Salary', merchant: 'Acme Corp', description: 'Monthly salary' });
    Transactions.add({ accountId: checking.id, date: prevMonth + '-15', amountCents: 45000, type: 'income', category: 'Freelance', merchant: 'Side client', description: 'Freelance invoice' });
    Transactions.add({ accountId: checking.id, date: thisMonth + '-02', amountCents: 180000, type: 'expense', category: 'Housing', merchant: 'Landlord', description: 'Rent' });
    Transactions.add({ accountId: checking.id, date: thisMonth + '-05', amountCents: 12480, type: 'expense', category: 'Groceries', merchant: 'Migros', description: 'Weekly shop' });
    Transactions.add({ accountId: checking.id, date: thisMonth + '-08', amountCents: 3450, type: 'expense', category: 'Dining out', merchant: 'Café Local', description: 'Lunch' });
    Transactions.add({ accountId: checking.id, date: thisMonth + '-10', amountCents: 6800, type: 'expense', category: 'Transport', merchant: 'SBB', description: 'Train pass top-up' });
    Transactions.add({ accountId: checking.id, date: prevMonth + '-20', amountCents: 9900, type: 'expense', category: 'Entertainment', merchant: 'Cinema', description: 'Movie night' });
    Transactions.add({ accountId: checking.id, date: thisMonth + '-03', amountCents: 50000, type: 'transfer', category: 'Transfer', merchant: '', description: 'Move to savings', transferToAccountId: savings.id });

    Subscriptions.add({ name: 'Netflix', amountCents: 1790, billingCycle: 'monthly', category: 'Entertainment', accountId: checking.id, startDate: prevMonth + '-01', nextBillingDate: thisMonth + '-14' });
    Subscriptions.add({ name: 'Spotify', amountCents: 1200, billingCycle: 'monthly', category: 'Entertainment', accountId: checking.id, startDate: prevMonth + '-01', nextBillingDate: thisMonth + '-09' });
    Subscriptions.add({ name: 'Adobe Creative Cloud', amountCents: 59900, billingCycle: 'yearly', category: 'Software', accountId: checking.id, startDate: prevMonth + '-01', nextBillingDate: (dateParts[0] + 1) + '-' + pad2(dateParts[1]) + '-01' });
    Subscriptions.add({ name: 'Gym Membership', amountCents: 8900, billingCycle: 'monthly', category: 'Health', accountId: checking.id, startDate: prevMonth + '-01', nextBillingDate: thisMonth + '-25' });

    IncomeSources.add({ name: 'Salary', expectedAmountCents: 520000, cadence: 'monthly', accountId: checking.id });
    IncomeSources.add({ name: 'Freelance retainer', expectedAmountCents: 45000, cadence: 'monthly', accountId: checking.id });

    storeSet(KEYS.seeded, true);
  }
  seedIfEmpty();

  // One-time migration: the default display currency changed from CHF to
  // USD. Transactions/Subscriptions/IncomeSources have no currency field of
  // their own (they always render through the global default, so they're
  // already covered), but each Account stores its own `currency` — flip
  // any that were created under the old CHF default.
  function migrateChfAccountsToUsd() {
    if (storeGet(KEYS.migratedCurrencyUsd)) return;
    const accounts = Accounts.list();
    let changed = false;
    accounts.forEach(function (a) {
      if (a.currency === 'CHF') { a.currency = 'USD'; changed = true; }
    });
    if (changed) storeSet(KEYS.accounts, accounts);
    storeSet(KEYS.migratedCurrencyUsd, true);
  }
  migrateChfAccountsToUsd();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.FinanceData = {
    KEYS: KEYS,
    Currency: FinanceCurrency,
    getHero: getHero,
    saveHero: saveHero,
    compressImageDataUrl: compressImageDataUrl,
    Models: {
      account: accountModel,
      transaction: transactionModel,
      subscription: subscriptionModel,
      incomeSource: incomeSourceModel,
      note: noteModel
    },
    Accounts: Accounts,
    Transactions: Transactions,
    Subscriptions: Subscriptions,
    IncomeSources: IncomeSources,
    Notes: Notes,
    netWorthCents: netWorthCents,
    transactionsForMonth: transactionsForMonth,
    monthlyIncomeTotalCents: monthlyIncomeTotalCents,
    monthlyExpenseTotalCents: monthlyExpenseTotalCents,
    categoryBreakdownForMonth: categoryBreakdownForMonth,
    subscriptionMonthlyEquivalentCents: subscriptionMonthlyEquivalentCents,
    subscriptionsSumForMonthCents: subscriptionsSumForMonthCents,
    subscriptionsSumForYearCents: subscriptionsSumForYearCents,
    seedIfEmpty: seedIfEmpty
  };
})(window);
