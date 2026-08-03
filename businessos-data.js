// businessos-data.js
//
// Data layer for businessos.html ("Business OS") — a CEO command center
// managing multiple businesses from one dashboard. Same conventions as
// every other page's own -data.js in this app (see CLAUDE.md §4): plain
// localStorage, JSON-serialized, one key per collection, no server/DB,
// model-factory + makeCollection() CRUD (the exact recipe
// learning-dashboard-data.js/aitech-data.js/business-data.js already use).
// Every key lives under a `bos:` prefix so businessos.html's
// initCloudSync({ syncedPrefixes: ['bos:'] }) call covers every collection
// with no per-key list.
//
// This is a genuinely new, standalone system — separate from the
// pre-existing `business.html` ("Content Hub," Content/Ideas/Platforms/
// Resources) and its Writing/YouTube Dashboard tabs. Nothing there is
// touched by this file. Business OS models *unlimited businesses*, each
// with its own full workspace (Overview/Projects/Products/Marketing/
// Operations/Customers/Finance/Content/AI/Analytics/Notes/Files/Settings)
// — a different shape of problem than Content Hub's single content-
// planning workspace.
//
// Cross-business global sections (Analytics/Finance/Marketing/Products/
// Customers/Operations/Projects/Content/AI/Knowledge Base on the sidebar)
// and each business's own workspace tabs of the same name read the exact
// SAME underlying collections — every record carries a `businessId`
// (nullable for a few globally-shared collections: AI Prompts, Knowledge
// Base, Notes, Tasks can each optionally belong to one business or sit
// unscoped/global). A global-nav view just doesn't filter by businessId;
// a business-workspace view does. One renderer, two modes — see
// businessos.html's own section-rendering functions.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as every sibling -data.js
  // (dispatches a 'bos:save' event either way so the page can show a real
  // status instead of guessing whether a write actually landed).
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('bos:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('bos:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    businesses: 'bos:businesses',
    goals: 'bos:goals',
    projects: 'bos:projects',
    series: 'bos:series',
    products: 'bos:products',
    content: 'bos:content',
    customers: 'bos:customers',
    operations: 'bos:operations',
    financeTx: 'bos:financeTx',
    financeInvoices: 'bos:financeInvoices',
    financeBudgets: 'bos:financeBudgets',
    financeSubs: 'bos:financeSubs',
    aiPrompts: 'bos:aiPrompts',
    knowledge: 'bos:knowledge',
    notes: 'bos:notes',
    files: 'bos:files',
    tasks: 'bos:tasks',
    captures: 'bos:captures',
    settings: 'bos:settings',
    seeded: 'bos:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysFromNow(n) { return isoDaysAgo(-n); }
  function monthKey(iso) { return (iso || '').slice(0, 7); }

  // ============================================================
  // MONEY — parse/format cents, same small per-file copy precedent this
  // app already has three times over (finance-data.js's FinanceCurrency,
  // household-data.js's HouseholdCurrency, selfcare-data.js's own copy) —
  // no shared cross-file module system exists to import one instead.
  // ============================================================
  function parseToCents(input) {
    if (typeof input === 'number') return Math.round(input * 100);
    const cleaned = String(input == null ? '' : input).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : Math.round(n * 100);
  }
  function formatCents(cents, opts) {
    opts = opts || {};
    const n = (typeof cents === 'number' ? cents : 0) / 100;
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const str = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (opts.compact ? '' : sign) + '$' + (opts.compact ? formatCompact(abs) : str);
  }
  function formatCompact(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toFixed(0);
  }

  // ============================================================
  // IMAGE / URL HELPERS — same canvas-downscale recipe + http(s)-only
  // guard as every other page in this app.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900;
    quality = quality == null ? 0.8 : quality;
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
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ============================================================
  // FIXED VOCABULARIES
  // ============================================================
  const BIZ_STATUSES = ['active', 'paused', 'archived'];
  const BIZ_COLORS = ['#E11D48', '#F472B6', '#60A5FA', '#34D399', '#F59E0B', '#A78BFA', '#FB7185', '#2DD4BF'];
  const PROJECT_STATUSES = ['backlog', 'todo', 'in-progress', 'review', 'done'];
  const PROJECT_STATUS_LABELS = { backlog: 'Backlog', todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done' };
  const PROJECT_KINDS = ['general', 'manuscript'];
  const MANUSCRIPT_STATUSES = ['outline', 'first-draft', 'revised-draft', 'final-draft', 'done'];
  const MANUSCRIPT_STATUS_LABELS = { outline: 'Outline', 'first-draft': 'First Draft', 'revised-draft': 'Revised Draft', 'final-draft': 'Final Draft', done: 'Done' };
  const MANUSCRIPT_STATUS_COLOR = { outline: 'mute', 'first-draft': 'warn', 'revised-draft': 'info', 'final-draft': 'accent2', done: 'good' };
  const PRIORITIES = ['low', 'medium', 'high'];
  const PRODUCT_STATUSES = ['idea', 'development', 'launched', 'discontinued'];
  const CONTENT_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'pinterest', 'threads', 'medium', 'newsletter', 'blog', 'email', 'seo', 'ads', 'affiliate', 'influencer'];
  const CONTENT_PLATFORM_ICONS = { youtube: '📺', instagram: '📷', tiktok: '🎵', facebook: '📘', pinterest: '📌', threads: '🧵', medium: '✍️', newsletter: '📰', blog: '📝', email: '✉️', seo: '🔍', ads: '📢', affiliate: '🤝', influencer: '🌟' };
  const CONTENT_STAGES = ['idea', 'draft', 'scheduled', 'published'];
  const CONTENT_STAGE_LABELS = { idea: 'Idea', draft: 'Draft', scheduled: 'Scheduled', published: 'Published' };
  const CUSTOMER_TYPES = ['lead', 'customer'];
  const CUSTOMER_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'churned'];
  const OPS_KINDS = ['sop', 'checklist', 'template', 'automation', 'doc'];
  const OPS_KIND_LABELS = { sop: 'SOP', checklist: 'Checklist', template: 'Template', automation: 'Automation', doc: 'Document' };
  const TX_TYPES = ['revenue', 'expense'];
  const TX_CATEGORIES = ['Sales', 'Subscriptions', 'Services', 'Ads', 'Software', 'Contractors', 'Payroll', 'Hosting', 'Other'];
  const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'];
  const SUB_CADENCES = ['monthly', 'yearly'];
  const AI_CATEGORIES = ['prompt-library', 'custom-gpt', 'claude-project', 'automation', 'writing', 'marketing', 'brainstorm', 'research'];
  const AI_CATEGORY_LABELS = { 'prompt-library': 'Prompt Library', 'custom-gpt': 'Custom GPT', 'claude-project': 'Claude Project', automation: 'AI Automation', writing: 'Writing Tool', marketing: 'Marketing Tool', brainstorm: 'Brainstorming', research: 'Research' };
  const KNOWLEDGE_TYPES = ['playbook', 'framework', 'lesson', 'book', 'research', 'market-analysis', 'competitor', 'meeting-note'];
  const KNOWLEDGE_TYPE_LABELS = { playbook: 'Playbook', framework: 'Framework', lesson: 'Lesson Learned', book: 'Book', research: 'Research', 'market-analysis': 'Market Analysis', competitor: 'Competitor Notes', 'meeting-note': 'Meeting Notes' };
  const FILE_TYPES = ['doc', 'sheet', 'image', 'video', 'link', 'other'];
  const TASK_STATUSES = ['todo', 'in-progress', 'done'];
  const CAPTURE_TYPES = ['idea', 'task', 'meeting-note', 'voice-note', 'business-idea', 'ai-prompt'];
  const CAPTURE_TYPE_LABELS = { idea: '💡 Idea', task: '✅ Task', 'meeting-note': '📓 Meeting Note', 'voice-note': '🎙️ Voice Note', 'business-idea': '🚀 Business Idea', 'ai-prompt': '🤖 AI Prompt' };
  const GOAL_SCOPES = ['quarter', 'month', 'week'];
  const GOAL_SCOPE_LABELS = { quarter: 'Quarterly', month: 'Monthly', week: 'Weekly' };

  // ============================================================
  // MODELS
  // ============================================================
  function businessModel(data) {
    data = data || {};
    return {
      id: data.id || uid('biz'),
      name: typeof data.name === 'string' ? data.name : '',
      logo: typeof data.logo === 'string' && data.logo ? data.logo : '🏢',
      cover: typeof data.cover === 'string' ? data.cover : '',
      description: typeof data.description === 'string' ? data.description : '',
      mission: typeof data.mission === 'string' ? data.mission : '',
      vision: typeof data.vision === 'string' ? data.vision : '',
      revenueCents: typeof data.revenueCents === 'number' ? data.revenueCents : 0,
      goalRevenueCents: typeof data.goalRevenueCents === 'number' ? data.goalRevenueCents : 0,
      profitCents: typeof data.profitCents === 'number' ? data.profitCents : 0,
      goalProfitCents: typeof data.goalProfitCents === 'number' ? data.goalProfitCents : 0,
      growthPercent: typeof data.growthPercent === 'number' ? data.growthPercent : 0,
      trafficMonthly: typeof data.trafficMonthly === 'number' ? data.trafficMonthly : 0,
      conversionRate: typeof data.conversionRate === 'number' ? data.conversionRate : 0,
      monthlyGoalText: typeof data.monthlyGoalText === 'string' ? data.monthlyGoalText : '',
      currentFocus: typeof data.currentFocus === 'string' ? data.currentFocus : '',
      status: BIZ_STATUSES.indexOf(data.status) !== -1 ? data.status : 'active',
      color: BIZ_COLORS.indexOf(data.color) !== -1 ? data.color : BIZ_COLORS[0],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function goalModel(data) {
    data = data || {};
    return {
      id: data.id || uid('goal'),
      businessId: data.businessId || null,
      scope: GOAL_SCOPES.indexOf(data.scope) !== -1 ? data.scope : 'month',
      text: typeof data.text === 'string' ? data.text : '',
      done: !!data.done,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function projectModel(data) {
    data = data || {};
    return {
      id: data.id || uid('proj'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      status: PROJECT_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'medium',
      owner: typeof data.owner === 'string' ? data.owner : '',
      deadline: typeof data.deadline === 'string' ? data.deadline : '',
      progress: (typeof data.progress === 'number' && data.progress >= 0 && data.progress <= 100) ? data.progress : 0,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      // Manuscript-only fields — purely additive, ignored by every plain
      // ("general") project. A manuscript is still a real Project (same
      // Kanban status/priority/deadline/progress above), just rendered as
      // a Scrivener-style index card too when kind === 'manuscript'.
      kind: PROJECT_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'general',
      seriesId: data.seriesId || null,
      synopsis: typeof data.synopsis === 'string' ? data.synopsis : '',
      labelColor: BIZ_COLORS.indexOf(data.labelColor) !== -1 ? data.labelColor : BIZ_COLORS[0],
      manuscriptStatus: MANUSCRIPT_STATUSES.indexOf(data.manuscriptStatus) !== -1 ? data.manuscriptStatus : 'outline',
      wordCountCurrent: typeof data.wordCountCurrent === 'number' ? data.wordCountCurrent : 0,
      wordCountGoal: typeof data.wordCountGoal === 'number' ? data.wordCountGoal : 0
    };
  }
  /** @typedef {{id:string, businessId:string, name:string, color:string, description:string, order:number, createdAt:number}} Series */
  function seriesModel(data) {
    data = data || {};
    return {
      id: data.id || uid('series'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      color: BIZ_COLORS.indexOf(data.color) !== -1 ? data.color : BIZ_COLORS[0],
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function productModel(data) {
    data = data || {};
    return {
      id: data.id || uid('prod'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      status: PRODUCT_STATUSES.indexOf(data.status) !== -1 ? data.status : 'idea',
      launchDate: typeof data.launchDate === 'string' ? data.launchDate : '',
      revenueCents: typeof data.revenueCents === 'number' ? data.revenueCents : 0,
      inventory: typeof data.inventory === 'number' ? data.inventory : 0,
      priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function contentModel(data) {
    data = data || {};
    return {
      id: data.id || uid('cnt'),
      businessId: data.businessId || null,
      platform: CONTENT_PLATFORMS.indexOf(data.platform) !== -1 ? data.platform : 'instagram',
      stage: CONTENT_STAGES.indexOf(data.stage) !== -1 ? data.stage : 'idea',
      title: typeof data.title === 'string' ? data.title : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : '',
      publishedDate: typeof data.publishedDate === 'string' ? data.publishedDate : '',
      url: typeof data.url === 'string' ? data.url : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function customerModel(data) {
    data = data || {};
    return {
      id: data.id || uid('cust'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      type: CUSTOMER_TYPES.indexOf(data.type) !== -1 ? data.type : 'lead',
      email: typeof data.email === 'string' ? data.email : '',
      ltvCents: typeof data.ltvCents === 'number' ? data.ltvCents : 0,
      segment: typeof data.segment === 'string' ? data.segment : '',
      status: CUSTOMER_STATUSES.indexOf(data.status) !== -1 ? data.status : 'new',
      orders: typeof data.orders === 'number' ? data.orders : 0,
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function operationsModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ops'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      kind: OPS_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'sop',
      body: typeof data.body === 'string' ? data.body : '',
      checklist: Array.isArray(data.checklist) ? data.checklist : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function financeTxModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tx'),
      businessId: data.businessId || null,
      type: TX_TYPES.indexOf(data.type) !== -1 ? data.type : 'expense',
      amountCents: typeof data.amountCents === 'number' ? data.amountCents : 0,
      category: typeof data.category === 'string' && data.category ? data.category : 'Other',
      date: typeof data.date === 'string' ? data.date : todayISO(),
      note: typeof data.note === 'string' ? data.note : ''
    };
  }
  function invoiceModel(data) {
    data = data || {};
    return {
      id: data.id || uid('inv'),
      businessId: data.businessId || null,
      client: typeof data.client === 'string' ? data.client : '',
      amountCents: typeof data.amountCents === 'number' ? data.amountCents : 0,
      status: INVOICE_STATUSES.indexOf(data.status) !== -1 ? data.status : 'draft',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : ''
    };
  }
  function budgetModel(data) {
    data = data || {};
    return {
      id: data.id || uid('bud'),
      businessId: data.businessId || null,
      category: typeof data.category === 'string' && data.category ? data.category : 'Other',
      limitCents: typeof data.limitCents === 'number' ? data.limitCents : 0
    };
  }
  function subModel(data) {
    data = data || {};
    return {
      id: data.id || uid('sub'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      amountCents: typeof data.amountCents === 'number' ? data.amountCents : 0,
      cadence: SUB_CADENCES.indexOf(data.cadence) !== -1 ? data.cadence : 'monthly',
      nextRenewal: typeof data.nextRenewal === 'string' ? data.nextRenewal : ''
    };
  }
  function aiPromptModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ai'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      category: AI_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'prompt-library',
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function knowledgeModel(data) {
    data = data || {};
    return {
      id: data.id || uid('know'),
      businessId: data.businessId || null,
      type: KNOWLEDGE_TYPES.indexOf(data.type) !== -1 ? data.type : 'lesson',
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('note'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function fileModel(data) {
    data = data || {};
    return {
      id: data.id || uid('file'),
      businessId: data.businessId || null,
      name: typeof data.name === 'string' ? data.name : '',
      url: typeof data.url === 'string' ? data.url : '',
      type: FILE_TYPES.indexOf(data.type) !== -1 ? data.type : 'other',
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function taskModel(data) {
    data = data || {};
    return {
      id: data.id || uid('task'),
      businessId: data.businessId || null,
      title: typeof data.title === 'string' ? data.title : '',
      status: TASK_STATUSES.indexOf(data.status) !== -1 ? data.status : 'todo',
      priority: PRIORITIES.indexOf(data.priority) !== -1 ? data.priority : 'medium',
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function captureModel(data) {
    data = data || {};
    return {
      id: data.id || uid('cap'),
      type: CAPTURE_TYPES.indexOf(data.type) !== -1 ? data.type : 'idea',
      businessId: data.businessId || null,
      text: typeof data.text === 'string' ? data.text : '',
      processed: !!data.processed,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function settingsModel(data) {
    data = data || {};
    return {
      orgName: typeof data.orgName === 'string' && data.orgName ? data.orgName : 'My Companies',
      accentColor: typeof data.accentColor === 'string' && data.accentColor ? data.accentColor : '#E11D48',
      accent2Color: typeof data.accent2Color === 'string' && data.accent2Color ? data.accent2Color : '#F472B6'
    };
  }
  function getSettings() { return settingsModel(storeGet(KEYS.settings)); }
  function saveSettings(patch) { const next = settingsModel(Object.assign({}, getSettings(), patch)); storeSet(KEYS.settings, next); return next; }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as every sibling
  // -data.js in this app.
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

  const Businesses = makeCollection(KEYS.businesses, businessModel);
  const Goals = makeCollection(KEYS.goals, goalModel);
  const Projects = makeCollection(KEYS.projects, projectModel);
  const Series = makeCollection(KEYS.series, seriesModel);
  const Products = makeCollection(KEYS.products, productModel);
  const Content = makeCollection(KEYS.content, contentModel);
  const Customers = makeCollection(KEYS.customers, customerModel);
  const Operations = makeCollection(KEYS.operations, operationsModel);
  const FinanceTx = makeCollection(KEYS.financeTx, financeTxModel);
  const FinanceInvoices = makeCollection(KEYS.financeInvoices, invoiceModel);
  const FinanceBudgets = makeCollection(KEYS.financeBudgets, budgetModel);
  const FinanceSubs = makeCollection(KEYS.financeSubs, subModel);
  const AIPrompts = makeCollection(KEYS.aiPrompts, aiPromptModel);
  const Knowledge = makeCollection(KEYS.knowledge, knowledgeModel);
  const Notes = makeCollection(KEYS.notes, noteModel);
  const Files = makeCollection(KEYS.files, fileModel);
  const Tasks = makeCollection(KEYS.tasks, taskModel);
  const Captures = makeCollection(KEYS.captures, captureModel);

  const BIZ_SCOPED_COLLECTIONS = [Goals, Projects, Series, Products, Content, Customers, Operations, FinanceTx, FinanceInvoices, FinanceBudgets, FinanceSubs, Files];
  const BIZ_NULLABLE_COLLECTIONS = [AIPrompts, Knowledge, Notes, Tasks];

  /** Deleting a business nulls out businessId on the collections that can
   * meaningfully stand alone (AI Prompts/Knowledge/Notes/Tasks — same
   * null-out-the-reference precedent aitech-data.js's model deletion,
   * household-data.js's legion deletion, and business-data.js's week/day
   * deletion already established), and cascades a real delete on the
   * collections that only ever make sense scoped to one business (a
   * Project/Product/Content item/Customer/Finance record/File with no
   * owning business is meaningless, unlike a note or an AI prompt). */
  function removeBusiness(id) {
    Businesses.remove(id);
    BIZ_SCOPED_COLLECTIONS.forEach(function (col) {
      col.replaceAll(col.list().filter(function (r) { return r.businessId !== id; }));
    });
    BIZ_NULLABLE_COLLECTIONS.forEach(function (col) {
      col.replaceAll(col.list().map(function (r) { return r.businessId === id ? Object.assign({}, r, { businessId: null }) : r; }));
    });
    Captures.replaceAll(Captures.list().map(function (r) { return r.businessId === id ? Object.assign({}, r, { businessId: null }) : r; }));
  }
  /** Deleting a Series nulls out seriesId on its manuscripts rather than
   * deleting them — a manuscript is a real Project in its own right (with
   * its own Kanban status/deadline/tasks), so it becomes a standalone
   * manuscript instead of disappearing, same null-out-the-reference
   * precedent as removeBusiness() above. */
  function removeSeries(id) {
    Series.remove(id);
    Projects.replaceAll(Projects.list().map(function (p) { return p.seriesId === id ? Object.assign({}, p, { seriesId: null }) : p; }));
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function byOrder(a, b) { return a.order - b.order; }
  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function reorderCollection(col, orderedIds) {
    const all = col.list();
    const byId = {}; all.forEach(function (x) { byId[x.id] = x; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    col.replaceAll(all);
  }
  /** Generic "records for a business, or every record when businessId is
   * null" filter — the one function every shared section renderer in
   * businessos.html routes through, so a global nav page and a business
   * workspace tab can share one render function. */
  function forBiz(list, businessId) {
    return businessId ? list.filter(function (r) { return r.businessId === businessId; }) : list.slice();
  }

  function businessesSorted() { return Businesses.list().slice().sort(byOrder); }
  function activeBusinesses() { return businessesSorted().filter(function (b) { return b.status === 'active'; }); }
  function business(id) { return Businesses.get(id); }

  function revenueProgress(b) { return b.goalRevenueCents > 0 ? Math.min(100, Math.round((b.revenueCents / b.goalRevenueCents) * 100)) : 0; }
  function profitProgress(b) { return b.goalProfitCents > 0 ? Math.min(100, Math.round((b.profitCents / b.goalProfitCents) * 100)) : 0; }
  function projectCompletionPct(businessId) {
    const projs = forBiz(Projects.list(), businessId);
    if (!projs.length) return null;
    const done = projs.filter(function (p) { return p.status === 'done'; }).length;
    return Math.round((done / projs.length) * 100);
  }
  /** Business Health Score — a weighted blend of revenue-to-goal,
   * profit-to-goal, and project-completion progress, each equally
   * weighted and clamped 0-100. A documented simplification (no real
   * "health" model exists) — same spirit as this app's other single-
   * number roll-up scores. */
  function healthScore(b) {
    const parts = [revenueProgress(b), profitProgress(b)];
    const pc = projectCompletionPct(b.id);
    if (pc !== null) parts.push(pc);
    return Math.round(parts.reduce(function (s, x) { return s + x; }, 0) / parts.length);
  }
  function overallHealthScore() {
    const list = businessesSorted();
    if (!list.length) return 0;
    return Math.round(list.reduce(function (s, b) { return s + healthScore(b); }, 0) / list.length);
  }
  function totalRevenueCents() { return businessesSorted().reduce(function (s, b) { return s + b.revenueCents; }, 0); }
  function totalProfitCents() { return businessesSorted().reduce(function (s, b) { return s + b.profitCents; }, 0); }
  function totalGoalRevenueCents() { return businessesSorted().reduce(function (s, b) { return s + b.goalRevenueCents; }, 0); }
  function totalGoalProfitCents() { return businessesSorted().reduce(function (s, b) { return s + b.goalProfitCents; }, 0); }

  function goalsFor(businessId, scope) {
    return Goals.list().filter(function (g) { return g.businessId === businessId && (!scope || g.scope === scope); }).sort(byOrder);
  }
  function allMonthlyGoals() { return Goals.list().filter(function (g) { return g.scope === 'month'; }).sort(byOrder); }

  function txFor(businessId, opts) {
    opts = opts || {};
    let list = forBiz(FinanceTx.list(), businessId);
    if (opts.month) list = list.filter(function (t) { return monthKey(t.date) === opts.month; });
    if (opts.type) list = list.filter(function (t) { return t.type === opts.type; });
    return list.slice().sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); });
  }
  function sumTx(list) { return list.reduce(function (s, t) { return s + (t.type === 'revenue' ? t.amountCents : -t.amountCents); }, 0); }
  function monthlyTxTotals(businessId, months) {
    const out = [];
    const now = new Date();
    for (let i = (months || 6) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const list = forBiz(FinanceTx.list(), businessId).filter(function (t) { return monthKey(t.date) === key; });
      const rev = list.filter(function (t) { return t.type === 'revenue'; }).reduce(function (s, t) { return s + t.amountCents; }, 0);
      const exp = list.filter(function (t) { return t.type === 'expense'; }).reduce(function (s, t) { return s + t.amountCents; }, 0);
      out.push({ key: key, label: d.toLocaleDateString(undefined, { month: 'short' }), revenueCents: rev, expenseCents: exp });
    }
    return out;
  }
  function spendByCategory(businessId, month) {
    const list = txFor(businessId, { month: month, type: 'expense' });
    const byCat = {};
    list.forEach(function (t) { byCat[t.category] = (byCat[t.category] || 0) + t.amountCents; });
    return Object.keys(byCat).map(function (k) { return { category: k, cents: byCat[k] }; }).sort(function (a, b) { return b.cents - a.cents; });
  }

  function projectsFor(businessId) { return forBiz(Projects.list(), businessId).sort(byOrder); }
  function seriesFor(businessId) { return forBiz(Series.list(), businessId).sort(byOrder); }
  function manuscriptsFor(businessId) { return projectsFor(businessId).filter(function (p) { return p.kind === 'manuscript'; }); }
  function manuscriptsInSeries(businessId, seriesId) { return manuscriptsFor(businessId).filter(function (p) { return p.seriesId === seriesId; }); }
  function standaloneManuscripts(businessId) { return manuscriptsFor(businessId).filter(function (p) { return !p.seriesId; }); }
  function wordProgressPct(m) { return m.wordCountGoal > 0 ? Math.min(100, Math.round((m.wordCountCurrent / m.wordCountGoal) * 100)) : 0; }
  function projectsByStatus(businessId) {
    const out = {}; PROJECT_STATUSES.forEach(function (s) { out[s] = []; });
    projectsFor(businessId).forEach(function (p) { (out[p.status] || out.backlog).push(p); });
    return out;
  }
  function upcomingDeadlines(businessId, days) {
    const cutoff = isoDaysFromNow(days || 14);
    return projectsFor(businessId).filter(function (p) { return p.deadline && p.status !== 'done' && p.deadline <= cutoff; })
      .sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
  }

  function tasksFor(businessId, opts) {
    opts = opts || {};
    let list = businessId === undefined ? Tasks.list().slice() : forBiz(Tasks.list(), businessId);
    if (opts.status) list = list.filter(function (t) { return t.status === opts.status; });
    return list.sort(byOrder);
  }
  function todaysPriorities(limit) {
    return Tasks.list().filter(function (t) { return t.status !== 'done' && (t.dueDate === todayISO() || t.priority === 'high'); })
      .sort(function (a, b) {
        if (a.dueDate !== b.dueDate) return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
        return PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
      }).slice(0, limit || 8);
  }
  function pendingTasksCount() { return Tasks.list().filter(function (t) { return t.status !== 'done'; }).length; }

  function customersFor(businessId) { return forBiz(Customers.list(), businessId).sort(byOrder); }
  function leadsFor(businessId) { return customersFor(businessId).filter(function (c) { return c.type === 'lead'; }); }
  function activeCustomersFor(businessId) { return customersFor(businessId).filter(function (c) { return c.type === 'customer'; }); }
  function totalLtvCents(businessId) { return customersFor(businessId).reduce(function (s, c) { return s + c.ltvCents; }, 0); }

  function contentFor(businessId, opts) {
    opts = opts || {};
    let list = forBiz(Content.list(), businessId);
    if (opts.platform) list = list.filter(function (c) { return c.platform === opts.platform; });
    if (opts.stage) list = list.filter(function (c) { return c.stage === opts.stage; });
    return list.sort(byOrder);
  }
  function upcomingContent(businessId, days) {
    const cutoff = isoDaysFromNow(days || 14);
    return contentFor(businessId).filter(function (c) { return c.scheduledDate && c.stage !== 'published' && c.scheduledDate <= cutoff; })
      .sort(function (a, b) { return a.scheduledDate < b.scheduledDate ? -1 : 1; });
  }

  function operationsFor(businessId) { return forBiz(Operations.list(), businessId).sort(byOrder); }
  function productsFor(businessId) { return forBiz(Products.list(), businessId).sort(byOrder); }
  function filesFor(businessId) { return forBiz(Files.list(), businessId).sort(byOrder); }

  function aiPromptsFor(businessId) {
    // businessId undefined => everything (global nav view); null/'' => only
    // unscoped global prompts; an id => that business's own + global ones,
    // matching "AI Prompts can optionally belong to one business or sit
    // unscoped/global" from this file's own header comment.
    if (businessId === undefined) return AIPrompts.list().slice().sort(byOrder);
    return AIPrompts.list().filter(function (p) { return p.businessId === businessId || !p.businessId; }).sort(byOrder);
  }
  function knowledgeFor(businessId) {
    if (businessId === undefined) return Knowledge.list().slice().sort(byOrder);
    return Knowledge.list().filter(function (k) { return k.businessId === businessId || !k.businessId; }).sort(byOrder);
  }
  function notesFor(businessId) {
    if (businessId === undefined) return Notes.list().slice().sort(byOrder);
    return Notes.list().filter(function (n) { return n.businessId === businessId || !n.businessId; }).sort(byOrder);
  }
  function recentNotes(limit) { return Notes.list().slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, limit || 5); }

  function activityFeed(limit) {
    // A best-effort "recent activity" feed — every collection with a
    // createdAt, merged and sorted, newest first. Derived live, never
    // stored, so it can never drift.
    const items = [];
    function push(list, icon, kind, labelFn) {
      list.forEach(function (r) { items.push({ ts: r.createdAt || 0, icon: icon, kind: kind, label: labelFn(r), businessId: r.businessId }); });
    }
    push(Projects.list(), '📈', 'Project', function (r) { return r.title || 'Untitled project'; });
    push(Products.list(), '🛒', 'Product', function (r) { return r.name || 'Untitled product'; });
    push(Content.list(), '📢', 'Content', function (r) { return r.title || 'Untitled content'; });
    push(Customers.list(), '👥', 'Customer', function (r) { return r.name || 'Untitled contact'; });
    push(Notes.list(), '📝', 'Note', function (r) { return r.title || 'Untitled note'; });
    push(Knowledge.list(), '📚', 'Knowledge', function (r) { return r.title || 'Untitled entry'; });
    push(Captures.list(), '⚡', 'Capture', function (r) { return (r.text || '').slice(0, 60); });
    push(Businesses.list(), '🏢', 'Business', function (r) { return r.name || 'Untitled business'; });
    return items.sort(function (a, b) { return b.ts - a.ts; }).slice(0, limit || 10);
  }

  /** Weekly progress = tasks due this week that are done ÷ total due this
   * week (0 if none are due). Sunday-start window, matching this app's
   * other weekly-window selectors (e.g. selfcare-data.js's
   * inCurrentWeek()). */
  function weekWindow() {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    return { start: iso(start), end: iso(end) };
  }
  function weeklyProgressPct() {
    const w = weekWindow();
    const due = Tasks.list().filter(function (t) { return t.dueDate && t.dueDate >= w.start && t.dueDate <= w.end; });
    if (!due.length) return null;
    const done = due.filter(function (t) { return t.status === 'done'; }).length;
    return Math.round((done / due.length) * 100);
  }

  // ============================================================
  // GLOBAL SEARCH — one flat index across every collection.
  // ============================================================
  function searchAll(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    function add(kind, icon, list, matchFn, labelFn, gotoFn) {
      list.forEach(function (r) {
        if (matchFn(r)) out.push({ kind: kind, icon: icon, label: labelFn(r), id: r.id, businessId: r.businessId, goto: gotoFn(r) });
      });
    }
    add('Business', '🏢', Businesses.list(), function (r) { return (r.name || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.name; }, function (r) { return { section: 'biz-overview', businessId: r.id }; });
    add('Project', '📈', Projects.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'projects', businessId: r.businessId }; });
    add('Product', '🛒', Products.list(), function (r) { return (r.name || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.name; }, function (r) { return { section: 'products', businessId: r.businessId }; });
    add('Content', '📢', Content.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'content', businessId: r.businessId }; });
    add('Customer', '👥', Customers.list(), function (r) { return (r.name || '').toLowerCase().indexOf(q) !== -1 || (r.email || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.name; }, function (r) { return { section: 'customers', businessId: r.businessId }; });
    add('Task', '✅', Tasks.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'projects', businessId: r.businessId }; });
    add('Note', '📝', Notes.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1 || (r.body || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title || '(untitled note)'; }, function (r) { return { section: 'notes', businessId: r.businessId }; });
    add('Knowledge', '📚', Knowledge.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'knowledge', businessId: r.businessId }; });
    add('File', '📁', Files.list(), function (r) { return (r.name || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.name; }, function (r) { return { section: 'files', businessId: r.businessId }; });
    add('Operations', '🛠️', Operations.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'operations', businessId: r.businessId }; });
    add('AI Prompt', '🤖', AIPrompts.list(), function (r) { return (r.title || '').toLowerCase().indexOf(q) !== -1; }, function (r) { return r.title; }, function (r) { return { section: 'ai', businessId: r.businessId }; });
    return out.slice(0, 40);
  }

  // ============================================================
  // SEED — a small, realistic starting board (three businesses spanning
  // different niches) so every section demonstrates real data on first
  // load. Guarded by KEYS.seeded; NOT auto-run at script-load time — see
  // businessos.html's own maybeSeedAfterSyncAttempt() for why (same
  // empty-storage seed-race reasoning as every sibling page: seeding
  // before the cloud pull gets a real chance to answer could push a
  // freshly-seeded board to Supabase and clobber another device's real
  // data).
  // ============================================================
  function seedDefaultData() {
    [Businesses, Goals, Projects, Series, Products, Content, Customers, Operations, FinanceTx, FinanceInvoices, FinanceBudgets, FinanceSubs, AIPrompts, Knowledge, Notes, Files, Tasks, Captures]
      .forEach(function (col) { col.replaceAll([]); });

    const pub = Businesses.add({
      name: 'Count Damula', logo: '📖', description: 'Independent publishing — fiction and non-fiction, direct-to-reader.',
      mission: 'Publish books that outlast trends.', vision: 'A self-sustaining publishing house releasing 12+ titles a year.',
      revenueCents: 840000, goalRevenueCents: 1200000, profitCents: 310000, goalProfitCents: 500000,
      growthPercent: 18, trafficMonthly: 24000, conversionRate: 2.4,
      monthlyGoalText: 'Ship "The Long Winter" to editing and launch pre-orders.', currentFocus: 'Manuscript #3 — final draft',
      status: 'active', color: BIZ_COLORS[0], order: 0
    });
    const studio = Businesses.add({
      name: 'Northline Studio', logo: '🎬', description: 'YouTube + short-form content studio for creators and small brands.',
      mission: 'Make video production fast enough that ideas do not go stale.', vision: 'A repeatable content engine other creators license.',
      revenueCents: 520000, goalRevenueCents: 900000, profitCents: 140000, goalProfitCents: 300000,
      growthPercent: 34, trafficMonthly: 61000, conversionRate: 1.1,
      monthlyGoalText: 'Land 3 new retainer clients.', currentFocus: 'Q3 client onboarding pipeline',
      status: 'active', color: BIZ_COLORS[2], order: 1
    });
    const kit = Businesses.add({
      name: 'Kindred Kit', logo: '🧴', description: 'A small-batch skincare product line, direct-to-consumer.',
      mission: 'Simple, honest formulations — no filler ingredients.', vision: 'Carried in 200 independent retailers by year 3.',
      revenueCents: 210000, goalRevenueCents: 400000, profitCents: 40000, goalProfitCents: 120000,
      growthPercent: 9, trafficMonthly: 9800, conversionRate: 3.1,
      monthlyGoalText: 'Restock the Calm Balm SKU before it sells out again.', currentFocus: 'Supplier renegotiation',
      status: 'paused', color: BIZ_COLORS[4], order: 2
    });

    // Goals
    [
      { businessId: pub.id, scope: 'quarter', text: 'Release 2 new titles', order: 0 },
      { businessId: pub.id, scope: 'month', text: 'Finish final draft of "The Long Winter"', order: 0 },
      { businessId: pub.id, scope: 'week', text: 'Send chapter 14 to editor', order: 0 },
      { businessId: studio.id, scope: 'quarter', text: 'Grow retainer roster to 8 clients', order: 0 },
      { businessId: studio.id, scope: 'month', text: 'Close 3 new retainer clients', order: 0 },
      { businessId: studio.id, scope: 'week', text: 'Deliver Client B\'s edit', order: 0 },
      { businessId: kit.id, scope: 'quarter', text: 'Land first 3 retail accounts', order: 0 },
      { businessId: kit.id, scope: 'month', text: 'Resolve Calm Balm restock', order: 0 }
    ].forEach(function (g) { Goals.add(g); });

    // Series — a Scrivener-style grouping for manuscripts (see the
    // Projects section's own "Manuscripts & Series" view).
    const riverbend = Series.add({ businessId: pub.id, name: 'The Riverbend Saga', color: BIZ_COLORS[2], description: 'A three-book literary saga set in a fictional river town.', order: 0 });

    // Projects
    [
      { businessId: pub.id, title: 'Finish "The Long Winter" manuscript', status: 'in-progress', priority: 'high', owner: 'Me', deadline: isoDaysFromNow(9), progress: 72, order: 0,
        kind: 'manuscript', synopsis: 'A widowed innkeeper takes in a stranger the night the first snow falls — by spring, neither of them is who they claimed to be.', labelColor: BIZ_COLORS[0], manuscriptStatus: 'first-draft', wordCountCurrent: 41000, wordCountGoal: 95000 },
      { businessId: pub.id, title: 'Cover design — final round', status: 'review', priority: 'medium', owner: 'Designer', deadline: isoDaysFromNow(4), progress: 90, order: 1 },
      { businessId: pub.id, title: 'Set up pre-order landing page', status: 'todo', priority: 'medium', owner: 'Me', deadline: isoDaysFromNow(16), progress: 0, order: 2 },
      { businessId: pub.id, title: 'Audiobook narrator search', status: 'backlog', priority: 'low', owner: 'Me', deadline: '', progress: 0, order: 3 },
      { businessId: pub.id, title: 'Riverbend: Book One — "The Ferry House"', status: 'done', priority: 'medium', owner: 'Me', deadline: isoDaysAgo(180), progress: 100, order: 4,
        kind: 'manuscript', seriesId: riverbend.id, synopsis: 'The ferryman\'s daughter inherits a house full of other people\'s secrets — and one of her own she can\'t outrun.', labelColor: BIZ_COLORS[2], manuscriptStatus: 'final-draft', wordCountCurrent: 82000, wordCountGoal: 80000 },
      { businessId: pub.id, title: 'Riverbend: Book Two — "The Low Water Mark"', status: 'in-progress', priority: 'medium', owner: 'Me', deadline: isoDaysFromNow(45), progress: 55, order: 5,
        kind: 'manuscript', seriesId: riverbend.id, synopsis: 'Ten years later, a drought exposes what the river was hiding — and drags the whole town back into it.', labelColor: BIZ_COLORS[2], manuscriptStatus: 'revised-draft', wordCountCurrent: 62000, wordCountGoal: 85000 },
      { businessId: pub.id, title: 'Riverbend: Book Three — "Where the Current Turns"', status: 'backlog', priority: 'low', owner: 'Me', deadline: '', progress: 5, order: 6,
        kind: 'manuscript', seriesId: riverbend.id, synopsis: 'The closing volume — not yet outlined beyond the last line, which has been written since Book One.', labelColor: BIZ_COLORS[2], manuscriptStatus: 'outline', wordCountCurrent: 3000, wordCountGoal: 90000 },
      { businessId: studio.id, title: 'Client B — March edit package', status: 'in-progress', priority: 'high', owner: 'Editor', deadline: isoDaysFromNow(2), progress: 55, order: 0 },
      { businessId: studio.id, title: 'Retainer proposal — new lead', status: 'todo', priority: 'high', owner: 'Me', deadline: isoDaysFromNow(3), progress: 0, order: 1 },
      { businessId: studio.id, title: 'Refresh studio reel', status: 'done', priority: 'medium', owner: 'Me', deadline: isoDaysAgo(3), progress: 100, order: 2 },
      { businessId: kit.id, title: 'Renegotiate supplier contract', status: 'in-progress', priority: 'high', owner: 'Me', deadline: isoDaysFromNow(7), progress: 30, order: 0 },
      { businessId: kit.id, title: 'Restock Calm Balm', status: 'todo', priority: 'high', owner: 'Me', deadline: isoDaysFromNow(1), progress: 0, order: 1 }
    ].forEach(function (p) { Projects.add(p); });

    // Products
    [
      { businessId: pub.id, name: 'The Quiet Hour (novel)', status: 'launched', launchDate: isoDaysAgo(200), revenueCents: 410000, inventory: 0, priceCents: 1499, description: 'Debut literary fiction title.', order: 0 },
      { businessId: pub.id, name: 'The Long Winter (novel)', status: 'development', launchDate: isoDaysFromNow(60), revenueCents: 0, inventory: 0, priceCents: 1599, description: 'Third title, currently in final draft.', order: 1 },
      { businessId: studio.id, name: 'Creator Starter Package', status: 'launched', launchDate: isoDaysAgo(120), revenueCents: 320000, inventory: 0, priceCents: 250000, description: '4-video monthly retainer package.', order: 0 },
      { businessId: kit.id, name: 'Calm Balm', status: 'launched', launchDate: isoDaysAgo(300), revenueCents: 130000, inventory: 4, priceCents: 2800, description: 'Best-selling SKU, chronically low on stock.', order: 0 },
      { businessId: kit.id, name: 'Bright Serum', status: 'idea', launchDate: '', revenueCents: 0, inventory: 0, priceCents: 3400, description: 'Next SKU under consideration.', order: 1 }
    ].forEach(function (p) { Products.add(p); });

    // Content
    [
      { businessId: pub.id, platform: 'instagram', stage: 'scheduled', title: 'Cover reveal teaser', scheduledDate: isoDaysFromNow(5), url: '', order: 0 },
      { businessId: pub.id, platform: 'newsletter', stage: 'draft', title: 'March reader update', scheduledDate: isoDaysFromNow(2), url: '', order: 1 },
      { businessId: pub.id, platform: 'blog', stage: 'published', title: 'How "The Quiet Hour" got its ending', scheduledDate: isoDaysAgo(30), publishedDate: isoDaysAgo(30), url: '', order: 2 },
      { businessId: studio.id, platform: 'youtube', stage: 'idea', title: 'Behind the scenes: Client B shoot', scheduledDate: '', url: '', order: 0 },
      { businessId: studio.id, platform: 'tiktok', stage: 'scheduled', title: 'Studio setup walkthrough', scheduledDate: isoDaysFromNow(1), url: '', order: 1 },
      { businessId: studio.id, platform: 'youtube', stage: 'published', title: '3 shots every brand video needs', scheduledDate: isoDaysAgo(10), publishedDate: isoDaysAgo(10), url: '', order: 2 },
      { businessId: kit.id, platform: 'instagram', stage: 'draft', title: 'Restock announcement', scheduledDate: isoDaysFromNow(3), url: '', order: 0 }
    ].forEach(function (c) { Content.add(c); });

    // Customers
    [
      { businessId: pub.id, name: 'Riverstone Books', type: 'customer', email: 'orders@riverstonebooks.example', ltvCents: 84000, segment: 'Retail', status: 'won', orders: 6, order: 0 },
      { businessId: pub.id, name: 'Maya T.', type: 'lead', email: 'maya.t@example.com', ltvCents: 0, segment: 'Reader', status: 'contacted', orders: 0, order: 1 },
      { businessId: studio.id, name: 'Client B — Aurora Fitness', type: 'customer', email: 'hello@aurorafit.example', ltvCents: 720000, segment: 'Retainer', status: 'won', orders: 4, order: 0 },
      { businessId: studio.id, name: 'Delonte M.', type: 'lead', email: 'delonte@example.com', ltvCents: 0, segment: 'Prospect', status: 'qualified', orders: 0, order: 1 },
      { businessId: kit.id, name: 'Greenleaf Market', type: 'lead', email: 'buyer@greenleafmkt.example', ltvCents: 0, segment: 'Retail', status: 'new', orders: 0, order: 0 }
    ].forEach(function (c) { Customers.add(c); });

    // Operations
    [
      { businessId: pub.id, title: 'Manuscript → Launch checklist', kind: 'checklist', body: 'Every book, every time.', checklist: [
        { id: uid('chk'), text: 'Final proofread pass', done: true }, { id: uid('chk'), text: 'ISBN registered', done: true },
        { id: uid('chk'), text: 'Pre-order page live', done: false }, { id: uid('chk'), text: 'ARC copies sent', done: false }
      ], order: 0 },
      { businessId: studio.id, title: 'New client onboarding SOP', kind: 'sop', body: '1. Kickoff call\n2. Brand brief doc\n3. First-draft turnaround in 5 business days\n4. Retainer contract signed before shoot #1.', checklist: [], order: 0 },
      { businessId: kit.id, title: 'Reorder trigger automation', kind: 'automation', body: 'Alert when any SKU drops below 10 units on hand.', checklist: [], order: 0 }
    ].forEach(function (o) { Operations.add(o); });

    // Finance
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 8);
      const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-08';
      FinanceTx.add({ businessId: pub.id, type: 'revenue', amountCents: 60000 + i * 4000, category: 'Sales', date: date, note: 'Book sales' });
      FinanceTx.add({ businessId: pub.id, type: 'expense', amountCents: 12000, category: 'Contractors', date: date, note: 'Editor + cover design' });
      FinanceTx.add({ businessId: studio.id, type: 'revenue', amountCents: 90000 + i * 6000, category: 'Services', date: date, note: 'Retainer invoices' });
      FinanceTx.add({ businessId: studio.id, type: 'expense', amountCents: 30000, category: 'Software', date: date, note: 'Editing suite + hosting' });
      FinanceTx.add({ businessId: kit.id, type: 'revenue', amountCents: 15000 + i * 1500, category: 'Sales', date: date, note: 'Direct-to-consumer orders' });
      FinanceTx.add({ businessId: kit.id, type: 'expense', amountCents: 9000, category: 'Other', date: date, note: 'Manufacturing' });
    }
    FinanceInvoices.add({ businessId: studio.id, client: 'Aurora Fitness', amountCents: 250000, status: 'sent', dueDate: isoDaysFromNow(6) });
    FinanceInvoices.add({ businessId: studio.id, client: 'Client C', amountCents: 180000, status: 'overdue', dueDate: isoDaysAgo(4) });
    FinanceBudgets.add({ businessId: studio.id, category: 'Software', limitCents: 40000 });
    FinanceBudgets.add({ businessId: pub.id, category: 'Contractors', limitCents: 20000 });
    FinanceSubs.add({ businessId: studio.id, name: 'Editing Suite Pro', amountCents: 5900, cadence: 'monthly', nextRenewal: isoDaysFromNow(11) });
    FinanceSubs.add({ businessId: pub.id, name: 'ISBN Registry', amountCents: 15000, cadence: 'yearly', nextRenewal: isoDaysFromNow(120) });

    // AI Workspace
    [
      { businessId: null, title: 'Book blurb generator', body: 'Write a 100-word back-cover blurb for a novel about {topic}, in the tone of {comp title}. End on a hook, not a summary.', category: 'writing', favorite: true, order: 0 },
      { businessId: studio.id, title: 'Video hook script (first 3 seconds)', body: 'Write 5 alternate opening hooks for a short-form video about {topic}, each under 8 words, punchy, no clichés.', category: 'writing', favorite: true, order: 1 },
      { businessId: null, title: 'Weekly CEO brief', body: 'Summarize this week\'s revenue, top blockers, and top 3 priorities for next week across all my businesses, in under 200 words.', category: 'brainstorm', favorite: false, order: 2 },
      { businessId: kit.id, title: 'Supplier negotiation prep', body: 'Given these unit costs and volumes, draft 3 negotiation angles to bring cost per unit down without changing formulation.', category: 'research', favorite: false, order: 3 }
    ].forEach(function (p) { AIPrompts.add(p); });

    // Knowledge Base
    [
      { businessId: null, type: 'lesson', title: 'Never launch on a Friday', body: 'Every Friday launch across all three businesses has had worse first-72-hour numbers than a Tuesday one. Confirmed twice, not a fluke.', order: 0 },
      { businessId: pub.id, type: 'playbook', title: 'Book launch playbook', body: '6 weeks out: cover reveal.\n4 weeks out: pre-order open.\nLaunch week: ARC reviews go live, newsletter push, retail outreach.', order: 1 },
      { businessId: studio.id, type: 'framework', title: 'How I price a retainer', body: 'Base rate × expected monthly deliverables × 1.3 buffer for revisions. Never quote below the buffer.', order: 2 },
      { businessId: kit.id, type: 'competitor', title: 'Competitor: Bramblewell Skincare', body: 'Similar price point, weaker DTC presence, strong in 3 regional retail chains we don\'t have yet.', order: 3 }
    ].forEach(function (k) { Knowledge.add(k); });

    // Notes
    Notes.add({ businessId: null, title: 'Ideas to revisit later', body: 'Bundle "The Quiet Hour" + a signed bookplate as a limited run.\nOffer Northline retainer clients a quarterly strategy call.', tags: ['ideas'], order: 0 });
    Notes.add({ businessId: pub.id, title: 'Editor feedback — ch. 12', body: 'Pacing drags in the middle third. Cut two scenes, move the reveal earlier.', tags: ['editing'], order: 1 });

    // Files (link-based — this app has no file storage backend, see the
    // header comment on FileItem's shape)
    Files.add({ businessId: pub.id, name: 'The Long Winter — manuscript draft', url: 'https://docs.google.com/', type: 'doc', notes: 'Live editing doc', order: 0 });
    Files.add({ businessId: studio.id, name: 'Q3 client roster', url: 'https://docs.google.com/spreadsheets/', type: 'sheet', notes: '', order: 0 });

    // Tasks (Today's Priorities on the CEO Dashboard)
    Tasks.add({ businessId: pub.id, title: 'Send chapter 14 to editor', status: 'todo', priority: 'high', dueDate: todayISO(), order: 0 });
    Tasks.add({ businessId: studio.id, title: 'Follow up with Delonte M.', status: 'todo', priority: 'high', dueDate: todayISO(), order: 1 });
    Tasks.add({ businessId: kit.id, title: 'Call supplier re: contract terms', status: 'todo', priority: 'medium', dueDate: isoDaysFromNow(1), order: 2 });
    Tasks.add({ businessId: studio.id, title: 'Approve Client B rough cut', status: 'done', priority: 'medium', dueDate: isoDaysAgo(1), order: 3 });
    Tasks.add({ businessId: null, title: 'Review this month\'s combined P&L', status: 'todo', priority: 'medium', dueDate: isoDaysFromNow(2), order: 4 });

    // Quick Capture inbox — a couple of unprocessed items, to demonstrate it.
    Captures.add({ type: 'business-idea', businessId: null, text: 'A quarterly print anthology pulling short pieces from Count Damula authors — subscription model.', processed: false });
    Captures.add({ type: 'idea', businessId: studio.id, text: 'Offer a "content audit" as a paid discovery call before the full retainer pitch.', processed: false });

    saveSettings({});
    storeSet(KEYS.seeded, true);
  }

  function isEmptyEverywhere() {
    return !Businesses.list().length && !Projects.list().length && !Products.list().length &&
      !Content.list().length && !Customers.list().length && !Operations.list().length &&
      !FinanceTx.list().length && !AIPrompts.list().length && !Knowledge.list().length &&
      !Notes.list().length && !Files.list().length && !Tasks.list().length && !Captures.list().length;
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (!isEmptyEverywhere()) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.BusinessOSData = {
    KEYS: KEYS,
    BIZ_STATUSES: BIZ_STATUSES, BIZ_COLORS: BIZ_COLORS,
    PROJECT_STATUSES: PROJECT_STATUSES, PROJECT_STATUS_LABELS: PROJECT_STATUS_LABELS,
    PROJECT_KINDS: PROJECT_KINDS, MANUSCRIPT_STATUSES: MANUSCRIPT_STATUSES,
    MANUSCRIPT_STATUS_LABELS: MANUSCRIPT_STATUS_LABELS, MANUSCRIPT_STATUS_COLOR: MANUSCRIPT_STATUS_COLOR,
    PRIORITIES: PRIORITIES, PRODUCT_STATUSES: PRODUCT_STATUSES,
    CONTENT_PLATFORMS: CONTENT_PLATFORMS, CONTENT_PLATFORM_ICONS: CONTENT_PLATFORM_ICONS,
    CONTENT_STAGES: CONTENT_STAGES, CONTENT_STAGE_LABELS: CONTENT_STAGE_LABELS,
    CUSTOMER_TYPES: CUSTOMER_TYPES, CUSTOMER_STATUSES: CUSTOMER_STATUSES,
    OPS_KINDS: OPS_KINDS, OPS_KIND_LABELS: OPS_KIND_LABELS,
    TX_TYPES: TX_TYPES, TX_CATEGORIES: TX_CATEGORIES, INVOICE_STATUSES: INVOICE_STATUSES, SUB_CADENCES: SUB_CADENCES,
    AI_CATEGORIES: AI_CATEGORIES, AI_CATEGORY_LABELS: AI_CATEGORY_LABELS,
    KNOWLEDGE_TYPES: KNOWLEDGE_TYPES, KNOWLEDGE_TYPE_LABELS: KNOWLEDGE_TYPE_LABELS,
    FILE_TYPES: FILE_TYPES, TASK_STATUSES: TASK_STATUSES,
    CAPTURE_TYPES: CAPTURE_TYPES, CAPTURE_TYPE_LABELS: CAPTURE_TYPE_LABELS,
    GOAL_SCOPES: GOAL_SCOPES, GOAL_SCOPE_LABELS: GOAL_SCOPE_LABELS,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo, isoDaysFromNow: isoDaysFromNow, monthKey: monthKey,
    parseToCents: parseToCents, formatCents: formatCents,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl, escapeHtml: escapeHtml,
    Businesses: Object.assign({}, Businesses, { remove: removeBusiness }),
    Goals: Goals, Projects: Projects, Series: Object.assign({}, Series, { remove: removeSeries }),
    Products: Products, Content: Content, Customers: Customers,
    Operations: Operations, FinanceTx: FinanceTx, FinanceInvoices: FinanceInvoices, FinanceBudgets: FinanceBudgets,
    FinanceSubs: FinanceSubs, AIPrompts: AIPrompts, Knowledge: Knowledge, Notes: Notes, Files: Files,
    Tasks: Tasks, Captures: Captures,
    getSettings: getSettings, saveSettings: saveSettings,
    nextOrder: nextOrder, reorderCollection: reorderCollection, forBiz: forBiz,
    businessesSorted: businessesSorted, activeBusinesses: activeBusinesses, business: business,
    revenueProgress: revenueProgress, profitProgress: profitProgress, projectCompletionPct: projectCompletionPct,
    healthScore: healthScore, overallHealthScore: overallHealthScore,
    totalRevenueCents: totalRevenueCents, totalProfitCents: totalProfitCents,
    totalGoalRevenueCents: totalGoalRevenueCents, totalGoalProfitCents: totalGoalProfitCents,
    goalsFor: goalsFor, allMonthlyGoals: allMonthlyGoals,
    txFor: txFor, sumTx: sumTx, monthlyTxTotals: monthlyTxTotals, spendByCategory: spendByCategory,
    projectsFor: projectsFor, projectsByStatus: projectsByStatus, upcomingDeadlines: upcomingDeadlines,
    seriesFor: seriesFor, manuscriptsFor: manuscriptsFor, manuscriptsInSeries: manuscriptsInSeries,
    standaloneManuscripts: standaloneManuscripts, wordProgressPct: wordProgressPct,
    tasksFor: tasksFor, todaysPriorities: todaysPriorities, pendingTasksCount: pendingTasksCount,
    customersFor: customersFor, leadsFor: leadsFor, activeCustomersFor: activeCustomersFor, totalLtvCents: totalLtvCents,
    contentFor: contentFor, upcomingContent: upcomingContent,
    operationsFor: operationsFor, productsFor: productsFor, filesFor: filesFor,
    aiPromptsFor: aiPromptsFor, knowledgeFor: knowledgeFor, notesFor: notesFor, recentNotes: recentNotes,
    activityFeed: activityFeed, weekWindow: weekWindow, weeklyProgressPct: weeklyProgressPct,
    searchAll: searchAll,
    seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty, isEmptyEverywhere: isEmptyEverywhere
  };
})(window);
