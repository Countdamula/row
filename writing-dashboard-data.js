// writing-dashboard-data.js
//
// Data layer for writing-dashboard.html — the Writing Operating System
// living in the new "Business" nav folder (between Fitness Studio and
// Entertainment). Same conventions as every other page's own -data.js in
// this app: plain localStorage, JSON-serialized, one key per collection,
// model-factory + makeCollection() CRUD (the same recipe knowledge-hub-
// data.js / businessdash-data.js / aitech-data.js already use). Every key
// lives under a `wds:` prefix so writing-dashboard.html's own
// initCloudSync({ syncedPrefixes: ['wds:'] }) call covers every collection
// with no per-key list.
//
// ARCHITECTURE — one generic engine reused across every scale, the same
// "generic model + fixed vocabulary table, not N bespoke databases"
// precedent knowledge-hub-data.js's 11 departments and mediaverse-data.js's
// single MediaItem collection already established:
//   Series -> Books -> Acts -> Chapters -> Scenes   (the manuscript tree)
//   Characters, WikiPages (56 fixed worldbuilding categories, one generic
//     model + CATEGORY_META table), TimelineEvents  — all scoped by seriesId
//   Beats (from 6 real, standard structure templates), Trackers (subplot/
//     foreshadowing/reveal/mystery/conflict/theme/motif/character-arc/
//     relationship-arc), ConsistencyChecks, PublishingRecords — scoped by
//     bookId
//   Sections — the same generic, reorderable, "generated on demand" note-
//     block collection business.html's Platform Detail pages and
//     system.html's Page Notes already established (scope + scopeId),
//     used here for a WikiPage's rich content and a Character's extra notes
//   MindMapNodes — three levels (trilogy/book/character-relationships is
//     its own computed graph, not stored nodes — see buildRelationshipGraph),
//     same tidy-tree layout + SVG bezier canvas technique knowledge-hub-
//     data.js's computeMindMapLayout already established
//   QuickCaptures (Brain Dump, 17 capture types), Documents (Tools &
//     Documents, 14 kinds), WritingSessions (drives analytics/streak)
//
// CONFIRMED ADAPTATIONS (flagged, not silently narrowed — same discipline
// every other AI-shaped feature in this app already follows):
//   - "Automatic Consistency Checker" / "Automatic Consistency" are real,
//     honestly-computed heuristics (word-count outliers, open trackers with
//     no resolution near a book's end, characters referenced in a
//     relationship but never marked as appearing in this book, beats with
//     no linked chapter) — not real NLP/grammar analysis. An "🤖 AI Review"
//     button additionally calls a real Anthropic API when a key is pasted
//     into Settings (same fetch('https://api.anthropic.com/v1/messages')
//     pattern mainpillar.html/fitnessstudio.html/knowledge-hub.html already
//     use), with the local heuristic as the always-available fallback.
//   - The AI Prompt Library is real, genuinely useful copy-ready prompt
//     text (not filler) — a static reference table, not a live-generated
//     database, since this app has no active AI key by default.
//   - "Export to PDF" is the same established precedent as every other
//     export feature in this app: a print-formatted compiled view +
//     window.print(), not a hand-rolled PDF byte generator.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('wds:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('wds:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    series: 'wds:series',
    books: 'wds:books',
    acts: 'wds:acts',
    chapters: 'wds:chapters',
    scenes: 'wds:scenes',
    characters: 'wds:characters',
    wikiPages: 'wds:wikiPages',
    timelineEvents: 'wds:timelineEvents',
    beats: 'wds:beats',
    trackers: 'wds:trackers',
    consistencyChecks: 'wds:consistencyChecks',
    publishing: 'wds:publishing',
    sections: 'wds:sections',
    mindMapNodes: 'wds:mindMapNodes',
    quickCaptures: 'wds:quickCaptures',
    documents: 'wds:documents',
    writingSessions: 'wds:writingSessions',
    actChapterTemplates: 'wds:actChapterTemplates',
    characterTemplates: 'wds:characterTemplates',
    wikiTemplates: 'wds:wikiTemplates',
    plotPoints: 'wds:plotPoints',
    plotTemplates: 'wds:plotTemplates',
    compositionPresets: 'wds:compositionPresets',
    hero: 'wds:hero',
    settings: 'wds:settings',
    state: 'wds:state',
    seeded: 'wds:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoDaysFromNow(n) { return isoDaysAgo(-n); }

  // ============================================================
  // IMAGE / URL / TEXT HELPERS — same canvas-downscale + http(s)-only
  // guard + DOM-not-markup escaping every other page in this app uses.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900; quality = quality == null ? 0.8 : quality;
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
    try { const u = new URL(String(value)); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function wordCount(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function readingMinutes(words) { return Math.max(1, Math.round(words / 220)); }

  // ============================================================
  // FIXED VOCABULARIES
  // ============================================================
  const GENRES = ['Fantasy', 'Horror', 'Thriller', 'Romance', 'Science Fiction', 'Mystery', 'Literary', 'YA', 'Historical', 'Other'];
  const SERIES_STATUSES = ['planning', 'drafting', 'revising', 'complete', 'on-hold'];
  const SERIES_STATUS_LABELS = { planning: 'Planning', drafting: 'Drafting', revising: 'Revising', complete: 'Complete', 'on-hold': 'On Hold' };
  const BOOK_STATUSES = ['outlining', 'drafting', 'revising', 'editing', 'complete', 'on-hold'];
  const BOOK_STATUS_LABELS = { outlining: 'Outlining', drafting: 'Drafting', revising: 'Revising', editing: 'Editing', complete: 'Complete', 'on-hold': 'On Hold' };
  const CHAPTER_STATUSES = ['outline', 'drafting', 'revised', 'final'];
  const CHAPTER_STATUS_LABELS = { outline: 'Outline', drafting: 'Drafting', revised: 'Revised', final: 'Final' };
  const SCENE_STATUSES = ['idea', 'outlined', 'drafted', 'revised', 'final'];
  const REVISION_STATUSES = ['not-started', 'first-pass', 'second-pass', 'polished', 'locked'];
  const REVISION_STATUS_LABELS = { 'not-started': 'Not Started', 'first-pass': 'First Pass', 'second-pass': 'Second Pass', polished: 'Polished', locked: 'Locked' };
  const POVS = ['First Person', 'Third Limited', 'Third Omniscient', 'Second Person', 'Multiple POV'];

  // ============================================================
  // COMPOSITION MODE — built-in background gallery + ambient-audio
  // category shells. Backgrounds use Lorem Picsum seeded URLs (real,
  // working, license-friendly placeholder photography — the same
  // swap-for-your-own-assets role placehold.co plays elsewhere in this
  // app's sibling project) so the gallery is never a wall of broken
  // images during development; every entry is meant to be replaced with a
  // real upload or pasted URL. There is no equivalent free, keyless CDN
  // for categorized stock video/ambient audio, so those two ship as empty
  // "upload your own or paste a URL" shells — same as every other media
  // field in this app (book/chapter covers already work this way via
  // openImageUpload()).
  // ============================================================
  const COMPOSITION_BG_CATEGORIES = [
    { id: 'fantasy', label: 'Fantasy', icon: '🧙' },
    { id: 'dark-fantasy', label: 'Dark Fantasy', icon: '🕯️' },
    { id: 'romance', label: 'Romance', icon: '🌹' },
    { id: 'horror', label: 'Horror', icon: '🕷️' },
    { id: 'ancient-kingdoms', label: 'Ancient Kingdoms', icon: '🏛️' },
    { id: 'castles', label: 'Castles', icon: '🏰' },
    { id: 'libraries', label: 'Libraries', icon: '📚' },
    { id: 'magic-academies', label: 'Magic Academies', icon: '🔮' },
    { id: 'forests', label: 'Forests', icon: '🌲' },
    { id: 'rain', label: 'Rain', icon: '🌧️' },
    { id: 'snow', label: 'Snow', icon: '❄️' },
    { id: 'campfires', label: 'Campfires', icon: '🔥' },
    { id: 'ocean', label: 'Ocean', icon: '🌊' },
    { id: 'mountains', label: 'Mountains', icon: '⛰️' },
    { id: 'cities', label: 'Cities', icon: '🏙️' },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆' },
    { id: 'space', label: 'Space', icon: '🌌' },
    { id: 'coffee-shops', label: 'Coffee Shops', icon: '☕' },
    { id: 'cozy-rooms', label: 'Cozy Rooms', icon: '🕯️' },
    { id: 'night-sky', label: 'Night Sky', icon: '🌠' },
    { id: 'dreamscapes', label: 'Dreamscapes', icon: '💭' },
    { id: 'storms', label: 'Storms', icon: '⛈️' },
    { id: 'deserts', label: 'Deserts', icon: '🏜️' },
    { id: 'taverns', label: 'Taverns', icon: '🍺' },
    { id: 'dungeons', label: 'Dungeons', icon: '⛓️' }
  ];
  // 3 seeded Picsum images per category = a real, browsable gallery
  // without any API key. Seeds are just the category id + an index, so
  // they're stable across reloads.
  const COMPOSITION_BACKGROUND_LIBRARY = COMPOSITION_BG_CATEGORIES.map(function (cat) {
    return {
      id: cat.id, label: cat.label, icon: cat.icon, tags: [cat.id],
      images: [0, 1, 2].map(function (i) {
        return {
          id: cat.id + '-' + i,
          url: 'https://picsum.photos/seed/' + cat.id + '-' + i + '/1920/1080',
          thumb: 'https://picsum.photos/seed/' + cat.id + '-' + i + '/320/180'
        };
      })
    };
  });
  const COMPOSITION_AMBIENT_LIBRARY = [
    { id: 'rain', label: 'Rain', icon: '🌧️' }, { id: 'thunderstorm', label: 'Thunderstorm', icon: '⛈️' },
    { id: 'ocean', label: 'Ocean', icon: '🌊' }, { id: 'wind', label: 'Wind', icon: '🍃' },
    { id: 'forest', label: 'Forest', icon: '🌲' }, { id: 'coffee-shop', label: 'Coffee Shop', icon: '☕' },
    { id: 'fireplace', label: 'Fireplace', icon: '🔥' }, { id: 'fantasy-tavern', label: 'Fantasy Tavern', icon: '🍺' },
    { id: 'dungeon', label: 'Dungeon', icon: '⛓️' }, { id: 'castle', label: 'Castle', icon: '🏰' },
    { id: 'space', label: 'Space', icon: '🌌' }, { id: 'white-noise', label: 'White Noise', icon: '📻' },
    { id: 'brown-noise', label: 'Brown Noise', icon: '📻' }, { id: 'pink-noise', label: 'Pink Noise', icon: '📻' },
    { id: 'lofi', label: 'Lo-fi', icon: '🎧' }, { id: 'classical', label: 'Classical', icon: '🎻' },
    { id: 'movie-score', label: 'Movie Score', icon: '🎬' }
  ].map(function (a) { return Object.assign({ url: '' }, a); });
  const COMPOSITION_FONTS = ['Cormorant Garamond', 'EB Garamond', 'Literata', 'Merriweather', 'Lora', 'Inter', 'IBM Plex Serif', 'JetBrains Mono', 'Bookerly', 'Georgia', 'Times New Roman'];
  const COMPOSITION_PARTICLE_TYPES = ['snow', 'rain', 'fog', 'embers', 'dust', 'leaves', 'sparks', 'fireflies', 'stars', 'lightning'];

  const RELATIONSHIP_TYPES = ['friend', 'enemy', 'family', 'political', 'romantic', 'mentor', 'student', 'alliance', 'rival', 'former-ally', 'unknown'];
  const RELATIONSHIP_TYPE_LABELS = { friend: 'Friend', enemy: 'Enemy', family: 'Family', political: 'Political', romantic: 'Romantic', mentor: 'Mentor', student: 'Student', alliance: 'Alliance', rival: 'Rival', 'former-ally': 'Former Ally', unknown: 'Unknown' };
  const RELATIONSHIP_COLORS = { friend: '#6ee7b7', enemy: '#ff8a8a', family: '#fbbf24', political: '#7dd3fc', romantic: '#e0546f', mentor: '#c9a876', student: '#c9a876', alliance: '#6ee7b7', rival: '#ff8a8a', 'former-ally': 'rgba(255,255,255,0.4)', unknown: 'rgba(255,255,255,0.3)' };

  const QUICK_CAPTURE_TYPES = ['quote', 'dialogue', 'character-idea', 'magic-idea', 'world-idea', 'scene-idea', 'inspiration', 'research', 'dream', 'plot-twist', 'name', 'setting', 'object', 'lore', 'question', 'image', 'voice-note'];
  const QUICK_CAPTURE_META = {
    quote: { icon: '💬', label: 'Quote' }, dialogue: { icon: '🗨️', label: 'Dialogue' },
    'character-idea': { icon: '🧑', label: 'Character Idea' }, 'magic-idea': { icon: '✨', label: 'Magic Idea' },
    'world-idea': { icon: '🌍', label: 'World Idea' }, 'scene-idea': { icon: '🎬', label: 'Scene Idea' },
    inspiration: { icon: '💡', label: 'Random Inspiration' }, research: { icon: '🔍', label: 'Research' },
    dream: { icon: '🌙', label: 'Dream Journal' }, 'plot-twist': { icon: '🌀', label: 'Plot Twist' },
    name: { icon: '🏷️', label: 'Name' }, setting: { icon: '🏞️', label: 'Setting' },
    object: { icon: '🗝️', label: 'Object' }, lore: { icon: '📜', label: 'Lore' },
    question: { icon: '❓', label: 'Question' }, image: { icon: '🖼️', label: 'Image' },
    'voice-note': { icon: '🎙️', label: 'Voice Note Link' }
  };

  const DOCUMENT_KINDS = ['template', 'writing-guide', 'style-guide', 'research', 'contract', 'publishing-doc', 'marketing', 'cover-design', 'map', 'reference-image', 'checklist', 'book-bible', 'export', 'version-history'];
  const DOCUMENT_KIND_LABELS = {
    template: 'Template', 'writing-guide': 'Writing Guide', 'style-guide': 'Style Guide', research: 'Research',
    contract: 'Contract', 'publishing-doc': 'Publishing Document', marketing: 'Marketing', 'cover-design': 'Cover Design',
    map: 'Map', 'reference-image': 'Reference Image', checklist: 'Checklist', 'book-bible': 'Book Bible',
    export: 'Export Folder', 'version-history': 'Version History'
  };

  const CONSISTENCY_CATEGORIES = ['plot-hole', 'timeline', 'character', 'magic', 'relationship', 'romance-pacing', 'foreshadowing', 'continuity', 'worldbuilding', 'revision', 'grammar', 'scene-balance', 'conflict-balance', 'emotional-pacing', 'tension'];
  const CONSISTENCY_LABELS = {
    'plot-hole': 'Plot Hole', timeline: 'Timeline Issue', character: 'Character Inconsistency', magic: 'Magic Inconsistency',
    relationship: 'Relationship Inconsistency', 'romance-pacing': 'Romance Pacing', foreshadowing: 'Foreshadowing',
    continuity: 'Continuity', worldbuilding: 'Worldbuilding Contradiction', revision: 'Revision Suggestion',
    grammar: 'Grammar Review', 'scene-balance': 'Scene Balance', 'conflict-balance': 'Conflict Balance',
    'emotional-pacing': 'Emotional Pacing', tension: 'Tension'
  };

  const TRACKER_TYPES = ['subplot', 'foreshadowing', 'reveal', 'mystery', 'conflict', 'theme', 'motif', 'character-arc', 'relationship-arc'];
  const TRACKER_TYPE_LABELS = {
    subplot: 'Subplot', foreshadowing: 'Foreshadowing', reveal: 'Reveal', mystery: 'Mystery', conflict: 'Conflict',
    theme: 'Theme', motif: 'Motif', 'character-arc': 'Character Arc', 'relationship-arc': 'Relationship Arc'
  };
  const TRACKER_STATUSES = ['open', 'planted', 'in-progress', 'resolved'];

  // ---------- Story Architecture: General/Romance Plot Points, one
  // series-wide running list per kind, each point tagged to a real book
  // (bookId) so the series-level Story Architecture tab can group/label
  // them "Book 1 / Book 2 / Book 3…", and the book's own chapter editor
  // sidebar can show just that book's own points. A deliberately separate,
  // more visible feature from the existing Threads & Trackers Kanban above
  // (which already has a generic 'relationship-arc' type) — this app's own
  // "don't force-fit an explicit new request into an existing, differently-
  // shaped feature" precedent.
  const PLOT_KINDS = ['general', 'romance'];
  const PLOT_KIND_LABELS = { general: 'General Plot', romance: 'Romance Plot' };
  const PLOT_STATUSES = ['planned', 'drafted', 'resolved'];
  const PLOT_STATUS_LABELS = { planned: 'Planned', drafted: 'Drafted', resolved: 'Resolved' };

  const PUBLISH_STATUSES = ['drafting', 'querying', 'self-publishing', 'traditional', 'published'];
  const PUBLISH_STATUS_LABELS = { drafting: 'Drafting', querying: 'Querying Agents', 'self-publishing': 'Self-Publishing', traditional: 'Traditional Deal', published: 'Published' };

  // ---------- Story Architecture: real, standard beat-sheet templates ----------
  const STRUCTURE_TEMPLATES = {
    'three-act': {
      label: 'Three Act Structure', beats: [
        { key: 'setup', name: 'Setup', desc: 'Establish the ordinary world, the protagonist, and what is at stake before it changes.' },
        { key: 'inciting', name: 'Inciting Incident', desc: 'The event that disrupts the ordinary world and sets the story in motion.' },
        { key: 'pp1', name: 'Plot Point 1 (End of Act I)', desc: 'The protagonist commits to the journey — there is no going back.' },
        { key: 'rising', name: 'Rising Action', desc: 'Obstacles escalate as the protagonist pursues their goal.' },
        { key: 'midpoint', name: 'Midpoint', desc: 'A major shift — a reveal, reversal, or raised stake — that changes the direction of the story.' },
        { key: 'complications', name: 'Complications & Higher Stakes', desc: 'Setbacks mount; the plan starts to fail.' },
        { key: 'pp2', name: 'Plot Point 2 (Low Point)', desc: 'The protagonist\'s lowest moment — all seems lost.' },
        { key: 'climax', name: 'Climax', desc: 'The final confrontation where the central conflict is decided.' },
        { key: 'falling', name: 'Falling Action', desc: 'The immediate aftermath of the climax.' },
        { key: 'resolution', name: 'Resolution (End of Act III)', desc: 'The new normal — how the world and characters have changed.' }
      ]
    },
    'save-the-cat': {
      label: 'Save the Cat (Blake Snyder)', beats: [
        { key: 'opening-image', name: 'Opening Image', desc: 'A snapshot of the protagonist\'s "before" state.' },
        { key: 'theme-stated', name: 'Theme Stated', desc: 'Someone states the story\'s theme, usually to the protagonist, who doesn\'t yet understand it.' },
        { key: 'setup', name: 'Set-Up', desc: 'Introduce the protagonist\'s world, flaws, and supporting cast.' },
        { key: 'catalyst', name: 'Catalyst', desc: 'The inciting incident that kicks the story into gear.' },
        { key: 'debate', name: 'Debate', desc: 'The protagonist hesitates — should they really go?' },
        { key: 'break-2', name: 'Break Into Two', desc: 'The protagonist makes an active choice and enters the new world of Act II.' },
        { key: 'b-story', name: 'B Story', desc: 'A secondary story begins — often the relationship that carries the theme.' },
        { key: 'fun-games', name: 'Fun and Games', desc: 'The "promise of the premise" — the trailer moments.' },
        { key: 'midpoint', name: 'Midpoint', desc: 'Stakes are raised; a false victory or false defeat.' },
        { key: 'bad-guys-close-in', name: 'Bad Guys Close In', desc: 'External and internal pressure mounts.' },
        { key: 'all-is-lost', name: 'All Is Lost', desc: 'The lowest point — often marked by a "whiff of death."' },
        { key: 'dark-night', name: 'Dark Night of the Soul', desc: 'The protagonist grieves and searches for the truth they need.' },
        { key: 'break-3', name: 'Break Into Three', desc: 'A new idea, born from the B Story, shows the protagonist how to win.' },
        { key: 'finale', name: 'Finale', desc: 'The protagonist executes the new plan and resolves the A and B stories.' },
        { key: 'final-image', name: 'Final Image', desc: 'A mirror of the opening image, showing how much has changed.' }
      ]
    },
    'heros-journey': {
      label: "Hero's Journey (Vogler)", beats: [
        { key: 'ordinary-world', name: 'Ordinary World', desc: 'The hero\'s life before the adventure begins.' },
        { key: 'call', name: 'Call to Adventure', desc: 'A problem or challenge is presented.' },
        { key: 'refusal', name: 'Refusal of the Call', desc: 'The hero hesitates, afraid of the unknown.' },
        { key: 'mentor', name: 'Meeting the Mentor', desc: 'A guide provides advice, training, or a magical gift.' },
        { key: 'threshold', name: 'Crossing the Threshold', desc: 'The hero commits and leaves the ordinary world behind.' },
        { key: 'tests', name: 'Tests, Allies & Enemies', desc: 'The hero learns the rules of the new world.' },
        { key: 'approach', name: 'Approach to the Inmost Cave', desc: 'Preparation for the major challenge ahead.' },
        { key: 'ordeal', name: 'Ordeal', desc: 'The hero faces their greatest fear — a crisis, often a "death" of some kind.' },
        { key: 'reward', name: 'Reward (Seizing the Sword)', desc: 'The hero survives and takes possession of what they came for.' },
        { key: 'road-back', name: 'The Road Back', desc: 'The hero commits to finishing the journey, facing new consequences.' },
        { key: 'resurrection', name: 'Resurrection', desc: 'A final, most dangerous test where the hero is transformed.' },
        { key: 'return', name: 'Return with the Elixir', desc: 'The hero returns home, changed, with something to share.' }
      ]
    },
    'seven-point': {
      label: 'Seven Point Structure', beats: [
        { key: 'hook', name: 'Hook', desc: 'The opposite of the ending — establishes where the protagonist starts.' },
        { key: 'pt1', name: 'Plot Turn 1', desc: 'An event that sets the protagonist on the story\'s true path.' },
        { key: 'pinch1', name: 'Pinch Point 1', desc: 'Pressure applied — often the antagonist\'s force is shown.' },
        { key: 'midpoint', name: 'Midpoint', desc: 'The protagonist shifts from reaction to action.' },
        { key: 'pinch2', name: 'Pinch Point 2', desc: 'More pressure — often the low point, resources are depleted.' },
        { key: 'pt2', name: 'Plot Turn 2', desc: 'The protagonist gets the final piece needed to win.' },
        { key: 'resolution', name: 'Resolution', desc: 'The climax and the new equilibrium — the mirror of the Hook.' }
      ]
    },
    'story-circle': {
      label: "Dan Harmon's Story Circle", beats: [
        { key: 'you', name: 'You (Comfort Zone)', desc: 'A character is in a zone of comfort.' },
        { key: 'need', name: 'Need', desc: 'They want something.' },
        { key: 'go', name: 'Go', desc: 'They enter an unfamiliar situation.' },
        { key: 'search', name: 'Search', desc: 'They adapt to it.' },
        { key: 'find', name: 'Find', desc: 'They get what they wanted.' },
        { key: 'take', name: 'Take', desc: 'They pay a heavy price for it.' },
        { key: 'return', name: 'Return', desc: 'They return to their familiar situation.' },
        { key: 'change', name: 'Change', desc: 'Having changed, they are now capable of more.' }
      ]
    },
    'romance-arc': {
      label: 'Romance Beat Sheet', beats: [
        { key: 'meet-cute', name: 'Meet Cute / First Impression', desc: 'The love interests first encounter each other.' },
        { key: 'attraction', name: 'Attraction & Spark', desc: 'A pull between them, even if resisted.' },
        { key: 'deepening', name: 'Deepening Bond', desc: 'Shared vulnerability builds real connection.' },
        { key: 'first-moment', name: 'First Kiss / Moment of Connection', desc: 'The relationship crosses a real threshold.' },
        { key: 'falling', name: 'Falling in Love', desc: 'The relationship deepens against rising external/internal obstacles.' },
        { key: 'black-moment', name: 'Black Moment (Betrayal or Misunderstanding)', desc: 'The relationship seems to break beyond repair.' },
        { key: 'gesture', name: 'Grand Gesture', desc: 'One partner risks everything to prove their commitment.' },
        { key: 'reconciliation', name: 'Reconciliation', desc: 'Honest communication repairs the break.' },
        { key: 'hea', name: 'Happily Ever After / Commitment', desc: 'The relationship is affirmed for the long term.' }
      ]
    },
    // The two default row-sets for the Trilogy Plot Grid / Romance Plot
    // Grid — worded to match the writer's own requested beat names exactly
    // (existing 'save-the-cat'/'romance-arc' above use different wording
    // for overlapping beats), kept as real STRUCTURE_TEMPLATES entries so
    // they flow through the same apply/Beats/Templates-tab pipeline as
    // every other template rather than being a one-off row list baked into
    // the grid renderer.
    'trilogy-grid-default': {
      label: 'Trilogy Plot Grid (default)', beats: [
        { key: 'opening-image', name: 'Opening Image', desc: 'A snapshot of the world/protagonist before the story begins.' },
        { key: 'theme', name: 'Theme', desc: 'What the story is really about, planted early.' },
        { key: 'hook', name: 'Hook', desc: 'The moment that pulls the reader in.' },
        { key: 'inciting-incident', name: 'Inciting Incident', desc: 'The event that sets the story in motion.' },
        { key: 'debate', name: 'Debate', desc: 'The protagonist hesitates before committing.' },
        { key: 'break-into-2', name: 'Break Into Act II', desc: 'The protagonist commits and enters the new situation.' },
        { key: 'fun-and-games', name: 'Fun & Games', desc: 'The "promise of the premise" plays out.' },
        { key: 'midpoint', name: 'Midpoint', desc: 'A major shift that raises the stakes or reverses the direction.' },
        { key: 'bad-guys-close-in', name: 'Bad Guys Close In', desc: 'Pressure mounts, internally and externally.' },
        { key: 'dark-night', name: 'Dark Night', desc: 'The lowest point — all seems lost.' },
        { key: 'break-into-3', name: 'Break Into Act III', desc: 'A new understanding shows the protagonist how to win.' },
        { key: 'climax', name: 'Climax', desc: 'The final confrontation where the central conflict is decided.' },
        { key: 'resolution', name: 'Resolution', desc: 'The aftermath — how the world and characters have changed.' },
        { key: 'final-image', name: 'Final Image', desc: 'A mirror of the opening image, showing what changed.' }
      ]
    },
    'romance-grid-default': {
      label: 'Romance Plot Grid (default)', beats: [
        { key: 'meet-cute', name: 'Meet Cute', desc: 'The love interests first encounter each other.' },
        { key: 'first-attraction', name: 'First Attraction', desc: 'An initial pull between them.' },
        { key: 'chemistry', name: 'Chemistry', desc: 'Their dynamic sparks, even if resisted.' },
        { key: 'growing-feelings', name: 'Growing Feelings', desc: 'The connection deepens.' },
        { key: 'trust', name: 'Trust', desc: 'Real vulnerability is shared.' },
        { key: 'first-kiss', name: 'First Kiss', desc: 'The relationship crosses a real threshold.' },
        { key: 'intimacy', name: 'Intimacy', desc: 'The bond deepens further, physically and/or emotionally.' },
        { key: 'relationship-high', name: 'Relationship High', desc: 'Things are at their best between them.' },
        { key: 'conflict', name: 'Conflict', desc: 'A real obstacle threatens the relationship.' },
        { key: 'breakup', name: 'Breakup', desc: 'The relationship fractures.' },
        { key: 'reconciliation', name: 'Reconciliation', desc: 'Honest communication begins repairing the break.' },
        { key: 'sacrifice', name: 'Sacrifice', desc: 'One partner risks something real to prove commitment.' },
        { key: 'commitment', name: 'Commitment', desc: 'The relationship is affirmed.' },
        { key: 'hea-hfn', name: 'HEA / HFN', desc: 'Happily Ever After / Happy For Now — the relationship\'s resolution.' }
      ]
    }
  };

  // ---------- Worldbuilding: 56 fixed categories, grouped ----------
  const WIKI_CATEGORIES = [
    { id: 'world-overview', label: 'World Overview', icon: '🌍', group: 'Geography' },
    { id: 'continents', label: 'Continents', icon: '🗺️', group: 'Geography' },
    { id: 'countries', label: 'Countries', icon: '🏳️', group: 'Geography' },
    { id: 'kingdoms', label: 'Kingdoms', icon: '👑', group: 'Geography' },
    { id: 'cities', label: 'Cities', icon: '🏙️', group: 'Geography' },
    { id: 'villages', label: 'Villages', icon: '🏘️', group: 'Geography' },
    { id: 'regions', label: 'Regions', icon: '📍', group: 'Geography' },
    { id: 'landmarks', label: 'Landmarks', icon: '🗿', group: 'Geography' },
    { id: 'maps', label: 'Maps', icon: '🧭', group: 'Geography' },
    { id: 'climate', label: 'Climate', icon: '🌦️', group: 'Geography' },
    { id: 'history', label: 'History', icon: '📜', group: 'History & Politics' },
    { id: 'timeline', label: 'Timeline', icon: '⏳', group: 'History & Politics' },
    { id: 'politics', label: 'Politics', icon: '⚖️', group: 'History & Politics' },
    { id: 'governments', label: 'Governments', icon: '🏛️', group: 'History & Politics' },
    { id: 'laws', label: 'Laws', icon: '📖', group: 'History & Politics' },
    { id: 'crime', label: 'Crime', icon: '🗡️', group: 'History & Politics' },
    { id: 'military', label: 'Military', icon: '⚔️', group: 'History & Politics' },
    { id: 'cultures', label: 'Cultures', icon: '🎭', group: 'Society & Culture' },
    { id: 'religions', label: 'Religions', icon: '🙏', group: 'Society & Culture' },
    { id: 'languages', label: 'Languages', icon: '🗣️', group: 'Society & Culture' },
    { id: 'currencies', label: 'Currencies', icon: '💰', group: 'Society & Culture' },
    { id: 'economics', label: 'Economics', icon: '📈', group: 'Society & Culture' },
    { id: 'trade', label: 'Trade', icon: '⛵', group: 'Society & Culture' },
    { id: 'guilds', label: 'Guilds', icon: '🛠️', group: 'Society & Culture' },
    { id: 'factions', label: 'Factions', icon: '🚩', group: 'Society & Culture' },
    { id: 'organizations', label: 'Organizations', icon: '🏢', group: 'Society & Culture' },
    { id: 'education', label: 'Education', icon: '🎓', group: 'Society & Culture' },
    { id: 'fashion', label: 'Fashion', icon: '👗', group: 'Society & Culture' },
    { id: 'food', label: 'Food', icon: '🍞', group: 'Society & Culture' },
    { id: 'festivals', label: 'Festivals', icon: '🎉', group: 'Society & Culture' },
    { id: 'architecture', label: 'Architecture', icon: '🏰', group: 'Society & Culture' },
    { id: 'transportation', label: 'Transportation', icon: '🐎', group: 'Society & Culture' },
    { id: 'magic-systems', label: 'Magic Systems', icon: '✨', group: 'Magic & Technology' },
    { id: 'technology', label: 'Technology', icon: '⚙️', group: 'Magic & Technology' },
    { id: 'alchemy', label: 'Alchemy', icon: '🧪', group: 'Magic & Technology' },
    { id: 'artifacts', label: 'Artifacts', icon: '🔮', group: 'Magic & Technology' },
    { id: 'weapons', label: 'Weapons', icon: '🔪', group: 'Magic & Technology' },
    { id: 'armor', label: 'Armor', icon: '🛡️', group: 'Magic & Technology' },
    { id: 'creatures', label: 'Creatures', icon: '🐉', group: 'Nature & Beings' },
    { id: 'monsters', label: 'Monsters', icon: '👹', group: 'Nature & Beings' },
    { id: 'plants', label: 'Plants', icon: '🌿', group: 'Nature & Beings' },
    { id: 'races-species', label: 'Races & Species', icon: '🧬', group: 'Nature & Beings' },
    { id: 'astronomy', label: 'Astronomy', icon: '🌌', group: 'Cosmology & Myth' },
    { id: 'dimensions', label: 'Dimensions', icon: '🌀', group: 'Cosmology & Myth' },
    { id: 'gods', label: 'Gods', icon: '⚡', group: 'Cosmology & Myth' },
    { id: 'pantheon', label: 'Pantheon', icon: '🏔️', group: 'Cosmology & Myth' },
    { id: 'cosmology', label: 'Cosmology', icon: '🕳️', group: 'Cosmology & Myth' },
    { id: 'legends', label: 'Legends', icon: '📯', group: 'Cosmology & Myth' },
    { id: 'myths', label: 'Myths', icon: '🐺', group: 'Cosmology & Myth' },
    { id: 'prophecies', label: 'Prophecies', icon: '🔥', group: 'Cosmology & Myth' },
    { id: 'books', label: 'Books (in-world)', icon: '📚', group: 'Reference & Media' },
    { id: 'songs', label: 'Songs', icon: '🎵', group: 'Reference & Media' },
    { id: 'poems', label: 'Poems', icon: '✒️', group: 'Reference & Media' },
    { id: 'glossary', label: 'Glossary', icon: '🔤', group: 'Reference & Media' },
    { id: 'reference-images', label: 'Reference Images', icon: '🖼️', group: 'Reference & Media' },
    { id: 'research', label: 'Research', icon: '🔎', group: 'Reference & Media' },
    { id: 'miscellaneous', label: 'Miscellaneous', icon: '📦', group: 'Reference & Media' }
  ];
  const WIKI_CATEGORY_IDS = WIKI_CATEGORIES.map(function (c) { return c.id; });
  function wikiCategoryMeta(id) { return WIKI_CATEGORIES.find(function (c) { return c.id === id; }) || { id: id, label: id, icon: '📄', group: 'Reference & Media' }; }
  function wikiCategoryGroups() {
    const groups = [];
    WIKI_CATEGORIES.forEach(function (c) {
      let g = groups.find(function (x) { return x.name === c.group; });
      if (!g) { g = { name: c.group, categories: [] }; groups.push(g); }
      g.categories.push(c);
    });
    return groups;
  }
  // Ten named templates from the spec — every other category gets a
  // sensible generic default. Lazily seeded on a wiki page's first open
  // (ensureDefaultWikiSections below), same "generated on first visit,
  // fully editable afterward" precedent business.html's Platform Detail
  // pages already established — never re-applied to a page that already
  // has sections.
  const CATEGORY_SECTION_TEMPLATES = {
    'magic-systems': ['Source of Power', 'Rules & Limitations', 'Cost & Consequences', 'Who Can Use It', 'Famous Practitioners', 'History & Origins'],
    factions: ['Goals & Motives', 'Leadership', 'Structure & Ranks', 'Territory & Resources', 'Allies & Enemies', 'Notable Members'],
    religions: ['Core Beliefs', 'Deities & Figures', 'Practices & Rituals', 'Holy Sites', 'Clergy & Hierarchy', 'Sects & Schisms'],
    kingdoms: ['Ruler & Government', 'Geography & Borders', 'Culture & People', 'Military Strength', 'History', 'Current Conflicts'],
    languages: ['Alphabet & Phonetics', 'Grammar Notes', 'Common Phrases', 'Speakers & Regions', 'History & Origin'],
    creatures: ['Physical Description', 'Habitat', 'Behavior', 'Abilities & Weaknesses', 'Role in the World', 'Encounters'],
    cities: ['Geography & Layout', 'Population & Demographics', 'Government & Laws', 'Economy & Trade', 'Notable Locations', 'History'],
    governments: ['Structure', 'Leadership', 'Laws & Enforcement', 'Relations with Other Powers', 'History'],
    history: ['Key Events', 'Major Figures', 'Causes', 'Consequences', 'Related Eras'],
    artifacts: ['Appearance', 'Powers & Abilities', 'Origin & Creation', 'Current Location', 'Previous Owners']
  };
  function defaultSectionTitlesFor(category) { return CATEGORY_SECTION_TEMPLATES[category] || ['Overview', 'Details', 'Notes']; }

  // ---------- AI Prompt Library — real, copy-ready prompts ----------
  const PROMPT_LIBRARY = [
    { category: 'Brainstorming', title: 'Generate story directions', text: 'I\'m writing a [genre] novel about [one-sentence premise]. Give me 8 possible directions this could go, each in 2-3 sentences, ranging from safe/expected to bold/unconventional. For each, note the central tension it creates.' },
    { category: 'Dialogue', title: 'Punch up flat dialogue', text: 'Here is a scene of dialogue between [Character A] and [Character B]:\n\n[paste dialogue]\n\nRewrite it so each character has a distinct voice (consider their background, education, and personality). Cut anything that\'s just characters stating facts at each other — replace it with subtext, conflict, or things left unsaid.' },
    { category: 'Descriptions', title: 'Ground a setting in sensory detail', text: 'Here is a description of [setting]:\n\n[paste description]\n\nRewrite it using at least 3 of the 5 senses (not just sight). Avoid generic fantasy/horror/thriller cliches. Root it in one strong, specific image rather than a list of features.' },
    { category: 'Romance', title: 'Build tension without dialogue', text: 'Write a 200-word scene where [Character A] and [Character B] are in the same room but NOT speaking to each other directly, and the romantic tension between them is conveyed entirely through body language, proximity, and internal thought.' },
    { category: 'Action', title: 'Choreograph a fight sequence', text: 'I\'m writing an action scene where [describe the conflict/combatants/stakes]. Help me choreograph it beat by beat, focusing on: (1) what each side wants moment-to-moment, (2) a mid-fight reversal, (3) sensory/physical detail I can use, and (4) how the fight should end given the stakes.' },
    { category: 'Fantasy', title: 'Stress-test a magic system', text: 'Here is how magic works in my world:\n\n[paste magic system rules]\n\nAsk me the hardest questions a sharp reader would ask about this system\'s consistency, limitations, and cost. Then point out any ways a clever character could exploit or break these rules as currently written.' },
    { category: 'Horror', title: 'Escalate dread in a scene', text: 'Here is a scene meant to be unsettling:\n\n[paste scene]\n\nIdentify where the tension currently peaks and rewrite the scene so dread builds more gradually beforehand — use environment, sound, and the character\'s own denial/rationalization rather than jump-scare reveals.' },
    { category: 'Mystery', title: 'Audit clue fairness', text: 'Here is my mystery\'s solution: [explain who did it and why]. Here are the clues I\'ve planted so far: [list them]. Tell me honestly whether a careful reader could solve this before the reveal, whether any clue is unfair (relies on info the reader can\'t access), and whether I have enough credible red herrings.' },
    { category: 'Character consistency', title: 'Check a character against their profile', text: 'Here is my character\'s profile:\n\n[paste character sheet: personality, values, voice, fears]\n\nHere is a scene featuring them:\n\n[paste scene]\n\nFlag any moment where their actions, choices, or dialogue seem inconsistent with the profile above, and suggest how to fix it while keeping the scene\'s plot function intact.' },
    { category: 'World consistency', title: 'Cross-check worldbuilding facts', text: 'Here are established facts about my world:\n\n[paste relevant lore]\n\nHere is a new scene/chapter:\n\n[paste text]\n\nFlag anything in the new text that contradicts the established facts above, including things implied indirectly (geography, timeline, technology/magic availability, social norms).' },
    { category: 'Plot holes', title: 'Stress-test the plot', text: 'Here is a summary of my plot from beginning to end: [paste synopsis]. Play devil\'s advocate: identify any point where a character\'s actions don\'t logically follow from what they know, where a problem is solved too conveniently, or where a simpler solution to the central conflict is available but never addressed.' },
    { category: 'Editing', title: 'Line-edit for clarity and rhythm', text: 'Line-edit this passage for clarity, rhythm, and word economy without changing its voice or content:\n\n[paste passage]\n\nFor each change, briefly note WHY (e.g. "cut redundant modifier," "varied sentence length," "removed filter word").' },
    { category: 'Rewriting', title: 'Rewrite in a different POV/tense', text: 'Rewrite this passage from [new POV/tense — e.g. "third person limited, past tense"] instead of its current [current POV/tense]:\n\n[paste passage]\n\nPreserve the events and emotional beats exactly; only the narrative distance and grammar should change.' },
    { category: 'Show don\'t tell', title: 'Convert telling into showing', text: 'Here is a passage that tells the reader how a character feels or what is happening, rather than showing it:\n\n[paste passage]\n\nRewrite it to show the same information through action, dialogue, physical sensation, or environmental detail — without adding a summary sentence at the end that states the emotion outright.' },
    { category: 'Emotional depth', title: 'Deepen an emotional beat', text: 'Here is a scene meant to be emotionally significant, but it currently reads as flat:\n\n[paste scene]\n\nSuggest 3 specific ways to deepen the emotional impact — consider internal contradiction (what the character wants to feel vs. what they actually feel), physical sensation, and a concrete detail that will stick with the reader.' },
    { category: 'Sensory writing', title: 'Add texture through the underused senses', text: 'This passage relies almost entirely on sight:\n\n[paste passage]\n\nRewrite it to incorporate sound, smell, touch, or taste — pick whichever senses would be most natural and evocative for this specific setting, without turning it into a checklist.' },
    { category: 'Chapter critique', title: 'Full chapter critique', text: 'Critique this chapter as a developmental editor would: does it open with enough momentum, does every scene earn its place, does it end on a hook or a satisfying beat, and is the pacing consistent with its role in the book? Chapter:\n\n[paste chapter]' },
    { category: 'Developmental editing', title: 'Big-picture structural notes', text: 'Here is my full outline/synopsis: [paste it]. Give me developmental editing notes at the structural level: is the midpoint doing enough work, is the second act sagging, does the ending pay off what the opening promised, and is the protagonist\'s arc clear across the whole book?' },
    { category: 'Scene expansion', title: 'Expand a scene that feels rushed', text: 'This scene feels rushed and needs more room to breathe:\n\n[paste scene]\n\nSuggest where to slow down — a beat of internal reaction, a sensory grounding moment, a piece of dialogue that reveals character — without adding events that don\'t belong in this scene.' },
    { category: 'Scene compression', title: 'Tighten a scene that drags', text: 'This scene is too slow and needs to move faster:\n\n[paste scene]\n\nIdentify what\'s essential to the scene\'s function (plot, character, or emotional purpose) and suggest specific cuts or compressions — combine beats, cut redundant dialogue, and start the scene closer to its point of conflict.' },
    { category: 'Conflict generation', title: 'Inject more conflict into a scene', text: 'This scene currently has little to no conflict:\n\n[paste scene]\n\nSuggest 3 ways to introduce tension — it can be external (an obstacle, a ticking clock), interpersonal (characters wanting different things), or internal (a character torn between two impulses) — while keeping the scene\'s core purpose intact.' },
    { category: 'Twist generation', title: 'Generate plausible twists', text: 'Here\'s my current plot direction: [explain what the reader currently expects to happen]. Give me 5 possible twists that would subvert this expectation, each with a one-line explanation of how it would need to be foreshadowed earlier in the manuscript to feel earned rather than arbitrary.' },
    { category: 'Naming', title: 'Generate names that fit a culture', text: 'I need [number] names for [characters/places] belonging to a culture with these linguistic/cultural traits: [describe — e.g. "harsh consonants, influenced by Old Norse, a warrior culture"]. Give me options with a one-word note on the meaning or etymology behind each.' },
    { category: 'Worldbuilding', title: 'Extrapolate the consequences of a world rule', text: 'My world has this rule/premise: [describe]. Walk through the second- and third-order consequences of this rule on daily life, economics, politics, and culture that I might not have considered yet — the kind of details that make a world feel lived-in rather than a stage set.' },
    { category: 'Magic', title: 'Design a magic system\'s cost', text: 'I want a magic system where the core power is [describe the power]. Help me design a cost/limitation system for it using Sanderson\'s Second Law as a guide (limitations are more interesting than powers) — give me 3 different cost models (physical, social, resource-based) with the dramatic possibilities each one opens up.' },
    { category: 'Villains', title: 'Deepen a villain\'s motivation', text: 'Here is my villain\'s current motivation: [describe]. Help me make it more compelling by identifying what they believe about themselves that makes their actions feel justified from the inside — a villain who believes they are the hero of their own story. Suggest one scene that could dramatize this belief directly.' },
    { category: 'Character arcs', title: 'Map a character\'s transformation', text: 'Here is my character at the start of the story: [describe their flaw/wound/worldview]. Here is roughly where I want them to end up: [describe]. Map out 4-5 turning points across the manuscript where their worldview should visibly crack, shift, or be tested, so the change feels earned rather than sudden.' }
  ];

  // ============================================================
  // MODELS
  // ============================================================
  function seriesModel(d) {
    d = d || {};
    return {
      id: d.id || uid('series'),
      title: d.title || 'Untitled Series',
      cover: d.cover || '',
      genre: GENRES.indexOf(d.genre) !== -1 ? d.genre : 'Fantasy',
      status: SERIES_STATUSES.indexOf(d.status) !== -1 ? d.status : 'planning',
      description: d.description || '',
      order: d.order == null ? 0 : d.order,
      archived: !!d.archived,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function bookModel(d) {
    d = d || {};
    return {
      id: d.id || uid('book'),
      seriesId: d.seriesId || null,
      title: d.title || 'Untitled Book',
      cover: d.cover || '',
      editorBgPhoto: d.editorBgPhoto || '',
      genre: GENRES.indexOf(d.genre) !== -1 ? d.genre : 'Fantasy',
      pov: d.pov || 'Third Limited',
      status: BOOK_STATUSES.indexOf(d.status) !== -1 ? d.status : 'outlining',
      revisionStatus: REVISION_STATUSES.indexOf(d.revisionStatus) !== -1 ? d.revisionStatus : 'not-started',
      targetWordCount: d.targetWordCount == null ? 90000 : Number(d.targetWordCount) || 0,
      dailyGoal: d.dailyGoal == null ? 1000 : Number(d.dailyGoal) || 0,
      currentChapterId: d.currentChapterId || null,
      deadline: d.deadline || '',
      mood: d.mood || '',
      theme: d.theme || '',
      // Which STRUCTURE_TEMPLATES key each of this book's two parallel beat
      // sets (general + romance) belongs to — lets a book carry both at
      // once and tells the Trilogy/Romance Plot Grids which of its Beats
      // rows are "active," since beatKey alone isn't unique across templates.
      generalStructureTemplate: d.generalStructureTemplate || 'trilogy-grid-default',
      romanceStructureTemplate: d.romanceStructureTemplate || 'romance-grid-default',
      order: d.order == null ? 0 : d.order,
      archived: !!d.archived,
      lastEditedAt: d.lastEditedAt || new Date().toISOString(),
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function actModel(d) {
    d = d || {};
    return { id: d.id || uid('act'), bookId: d.bookId || null, title: d.title || 'Act I', order: d.order == null ? 0 : d.order };
  }
  function chapterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ch'),
      bookId: d.bookId || null,
      actId: d.actId || null,
      title: d.title || 'Untitled Chapter',
      cover: d.cover || '',
      order: d.order == null ? 0 : d.order,
      status: CHAPTER_STATUSES.indexOf(d.status) !== -1 ? d.status : 'outline',
      pov: d.pov || '',
      content: d.content || '',
      summary: d.summary || '',
      notes: d.notes || '',
      wordGoal: d.wordGoal == null ? 0 : Number(d.wordGoal) || 0,
      revisionStatus: REVISION_STATUSES.indexOf(d.revisionStatus) !== -1 ? d.revisionStatus : 'not-started',
      compositionPresetId: d.compositionPresetId || null,
      // Story-craft fields (Chapter Details) — Main/Romance Plot,
      // Character Arc, Theme, Foreshadowing, Reveal, and Timeline are
      // deliberately NOT duplicated here; they already live as real
      // records (Beats/PlotPoints/Trackers/TimelineEvents) joined to a
      // chapter via linkedChapterId, and are shown as a read-only,
      // click-through Connections panel instead of a second copy that
      // could drift out of sync with the record it mirrors.
      purpose: d.purpose || '', goal: d.goal || '', obstacle: d.obstacle || '', stakes: d.stakes || '', outcome: d.outcome || '',
      conflict: d.conflict || '', emotionalBeat: d.emotionalBeat || '',
      revisionNotes: d.revisionNotes || '', dialogueNotes: d.dialogueNotes || '', researchNotes: d.researchNotes || '', callbackNotes: d.callbackNotes || '',
      characterIds: Array.isArray(d.characterIds) ? d.characterIds : [],
      // Generalized beyond just "Location" to every Worldbuilding Wiki
      // category (culture/magic system/organization/object etc.), since
      // WikiPages already spans all 56 — a location-only field would
      // undersell what a chapter can actually reference.
      linkedWikiPageIds: Array.isArray(d.linkedWikiPageIds) ? d.linkedWikiPageIds : [],
      checklist: Array.isArray(d.checklist) ? d.checklist.map(function (item) { return { id: (item && item.id) || uid('chk'), text: (item && item.text) || '', done: !!(item && item.done) }; }) : []
    };
  }
  // A reusable Acts + Chapters skeleton — global (not scoped to any one
  // series/book), same "one shared library, applied per-book" precedent as
  // STRUCTURE_TEMPLATES' beat sheets, just for the Acts & Chapters tree
  // itself rather than beats. acts[] holds plain {title, chapters:[{title,
  // wordGoal}]} snapshots, not live references — applying a template
  // creates brand-new real Act/Chapter records, so editing/deleting a
  // template afterward never touches anything it was already applied to.
  function actChapterTemplateModel(d) {
    d = d || {};
    return {
      id: d.id || uid('acttpl'),
      name: d.name || 'Untitled Template',
      description: d.description || '',
      acts: Array.isArray(d.acts) ? d.acts.map(function (a) {
        a = a || {};
        return {
          title: a.title || 'Act',
          chapters: Array.isArray(a.chapters) ? a.chapters.map(function (c) {
            c = c || {};
            return { title: c.title || 'Chapter', wordGoal: c.wordGoal == null ? 0 : Number(c.wordGoal) || 0 };
          }) : []
        };
      }) : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  // A saved Composition Mode environment — background/overlay/glass/
  // typography/focus/audio/particle settings bundled under one name, same
  // "one shared library, applied per-item" precedent as
  // actChapterTemplateModel above. compositionPresetId on a chapter is how
  // a preset gets auto-loaded for that chapter.
  function compositionPresetModel(d) {
    d = d || {};
    const bg = d.background || {};
    const ov = d.overlay || {};
    const tint = ov.tint || {};
    const gl = d.glass || {};
    const ty = d.typography || {};
    const aa = d.ambientAudio || {};
    return {
      id: d.id || uid('comppreset'),
      name: d.name || 'Untitled Scene',
      background: { type: bg.type === 'video' ? 'video' : 'image', url: bg.url || '', category: bg.category || '' },
      overlay: {
        blur: bg.type === 'video' ? clampNum(ov.blur, 0, 20, 6) : clampNum(ov.blur, 0, 20, 6),
        darkOverlay: clampNum(ov.darkOverlay, 0, 90, 45),
        gradientType: ['top', 'bottom', 'center', 'radial', 'none'].indexOf(ov.gradientType) !== -1 ? ov.gradientType : 'bottom',
        tint: { color: tint.color || '#6b5bd6', opacity: clampNum(tint.opacity, 0, 100, 0) }
      },
      glass: {
        opacity: clampNum(gl.opacity, 0, 100, 55),
        blurIntensity: clampNum(gl.blurIntensity, 0, 40, 22),
        radius: clampNum(gl.radius, 0, 40, 20),
        shadowStrength: clampNum(gl.shadowStrength, 0, 100, 50),
        padding: clampNum(gl.padding, 12, 96, 48),
        width: ['centered', 'left', 'full', 'book', 'narrow'].indexOf(gl.width) !== -1 ? gl.width : 'book',
        alignment: gl.alignment === 'left' ? 'left' : 'center'
      },
      typography: {
        font: ty.font || 'Literata',
        fontSize: clampNum(ty.fontSize, 14, 32, 19),
        letterSpacing: ty.letterSpacing == null ? 0 : Number(ty.letterSpacing) || 0,
        lineHeight: ty.lineHeight == null ? 1.7 : Number(ty.lineHeight) || 1.7,
        paragraphSpacing: clampNum(ty.paragraphSpacing, 0, 48, 16),
        textWidth: clampNum(ty.textWidth, 400, 1000, 680),
        margins: clampNum(ty.margins, 0, 120, 48),
        justification: ty.justification === 'justify' ? 'justify' : 'left',
        themePreset: ty.themePreset || 'custom'
      },
      focusMode: ['none', 'line', 'sentence', 'paragraph', 'block', 'scene'].indexOf(d.focusMode) !== -1 ? d.focusMode : 'none',
      typewriterMode: !!d.typewriterMode,
      ambientAudio: { url: aa.url || '', category: aa.category || '', volume: clampNum(aa.volume, 0, 100, 60), loop: aa.loop !== false, fadeIn: clampNum(aa.fadeIn, 0, 10000, 1500), fadeOut: clampNum(aa.fadeOut, 0, 10000, 1500), autoplay: !!aa.autoplay },
      particles: Array.isArray(d.particles) ? d.particles.slice() : [],
      toolbarVisible: d.toolbarVisible !== false,
      hudVisible: d.hudVisible !== false,
      zenDefault: !!d.zenDefault,
      favorite: !!d.favorite,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function clampNum(v, min, max, dflt) {
    const n = v == null || v === '' ? dflt : Number(v);
    if (isNaN(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }
  function sceneModel(d) {
    d = d || {};
    return {
      id: d.id || uid('sc'),
      chapterId: d.chapterId || null,
      title: d.title || 'Untitled Scene',
      order: d.order == null ? 0 : d.order,
      status: SCENE_STATUSES.indexOf(d.status) !== -1 ? d.status : 'idea',
      goal: d.goal || '', conflict: d.conflict || '', emotion: d.emotion || '', setting: d.setting || '',
      characterIds: Array.isArray(d.characterIds) ? d.characterIds : [],
      summary: d.summary || ''
    };
  }
  function relationshipEntry(d) {
    d = d || {};
    return { targetId: d.targetId || '', type: RELATIONSHIP_TYPES.indexOf(d.type) !== -1 ? d.type : 'unknown', notes: d.notes || '' };
  }
  function characterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('char'),
      seriesId: d.seriesId || null,
      name: d.name || 'Unnamed Character',
      aliases: d.aliases || '', portrait: d.portrait || '',
      age: d.age || '', birthday: d.birthday || '', species: d.species || '', race: d.race || '',
      occupation: d.occupation || '', status: d.status || 'Alive', role: d.role || '',
      personality: d.personality || '', motivations: d.motivations || '', goals: d.goals || '',
      strengths: d.strengths || '', weaknesses: d.weaknesses || '', fear: d.fear || '',
      internalConflict: d.internalConflict || '', externalConflict: d.externalConflict || '', arc: d.arc || '',
      voice: d.voice || '', secrets: d.secrets || '', trauma: d.trauma || '', beliefs: d.beliefs || '',
      skills: d.skills || '', magic: d.magic || '', weapons: d.weapons || '', equipment: d.equipment || '', appearance: d.appearance || '',
      physicalDescription: d.physicalDescription || '',
      backstory: d.backstory || '', biography: d.biography || '',
      quotes: Array.isArray(d.quotes) ? d.quotes : [],
      trivia: d.trivia || '',
      bookIds: Array.isArray(d.bookIds) ? d.bookIds : [],
      linkedWikiPageIds: Array.isArray(d.linkedWikiPageIds) ? d.linkedWikiPageIds : [],
      galleryUrls: Array.isArray(d.galleryUrls) ? d.galleryUrls : [],
      relationships: Array.isArray(d.relationships) ? d.relationships.map(relationshipEntry) : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function wikiPageModel(d) {
    d = d || {};
    return {
      id: d.id || uid('wiki'),
      seriesId: d.seriesId || null,
      category: WIKI_CATEGORY_IDS.indexOf(d.category) !== -1 ? d.category : 'miscellaneous',
      title: d.title || 'Untitled Entry',
      cover: d.cover || '',
      summary: d.summary || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      links: Array.isArray(d.links) ? d.links : [],
      bookIds: Array.isArray(d.bookIds) ? d.bookIds : [],
      linkedCharacterIds: Array.isArray(d.linkedCharacterIds) ? d.linkedCharacterIds : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  // A reusable worldbuilding-entry skeleton — global (not scoped to any
  // one series), same "snapshot, not a live reference" precedent as
  // actChapterTemplateModel above: category/summary/tags/sectionTitles are
  // copied values, so editing or deleting a template afterward never
  // touches an entry already created from it.
  function wikiTemplateModel(d) {
    d = d || {};
    return {
      id: d.id || uid('wikitpl'),
      name: d.name || 'Untitled Template',
      description: d.description || '',
      category: WIKI_CATEGORY_IDS.indexOf(d.category) !== -1 ? d.category : 'miscellaneous',
      summary: d.summary || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      sectionTitles: Array.isArray(d.sectionTitles) ? d.sectionTitles.filter(Boolean) : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  // Which Character fields a template snapshots/prefills — identity-
  // specific fields (name, portrait, quotes, gallery, bookIds,
  // relationships) are deliberately excluded, since those belong to one
  // specific character, not a reusable archetype.
  var CHARACTER_TEMPLATE_FIELD_KEYS = ['role', 'species', 'race', 'occupation', 'status', 'personality', 'motivations', 'goals', 'strengths', 'weaknesses', 'fear', 'internalConflict', 'externalConflict', 'arc', 'voice', 'secrets', 'trauma', 'beliefs', 'skills', 'magic', 'weapons', 'equipment', 'appearance', 'physicalDescription', 'backstory', 'biography'];
  // A reusable character-archetype skeleton — global, same snapshot
  // (not-live-reference) precedent as wikiTemplateModel/
  // actChapterTemplateModel above. `sections` snapshots the character's
  // free-form Sections block (scope:'character') the same way `fields`
  // snapshots its named fields — long-form archetype writeups (Core
  // Archetype, Essential Traits, Quick Build Template, etc.) live here.
  function characterTemplateModel(d) {
    d = d || {};
    var fields = {};
    CHARACTER_TEMPLATE_FIELD_KEYS.forEach(function (k) { fields[k] = (d.fields && d.fields[k]) || ''; });
    return {
      id: d.id || uid('chartpl'),
      name: d.name || 'Untitled Template',
      description: d.description || '',
      fields: fields,
      sections: Array.isArray(d.sections) ? d.sections.map(function (s) { return { title: (s && s.title) || 'Section', body: (s && s.body) || '' }; }) : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  // A reusable General/Romance Plot skeleton (Story Architecture) —
  // same snapshot precedent as actChapterTemplateModel: `points` are
  // plain {title, description} copies, never live PlotPoint references.
  function plotTemplateModel(d) {
    d = d || {};
    return {
      id: d.id || uid('plottpl'),
      name: d.name || 'Untitled Template',
      description: d.description || '',
      kind: PLOT_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'general',
      points: Array.isArray(d.points) ? d.points.map(function (p) { return { title: (p && p.title) || 'Untitled Plot Point', description: (p && p.description) || '' }; }) : [],
      order: d.order == null ? 0 : d.order,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function timelineEventModel(d) {
    d = d || {};
    return {
      id: d.id || uid('tl'), seriesId: d.seriesId || null, title: d.title || 'Untitled Event',
      date: d.date || '', description: d.description || '',
      linkedCharacterIds: Array.isArray(d.linkedCharacterIds) ? d.linkedCharacterIds : [],
      linkedWikiPageIds: Array.isArray(d.linkedWikiPageIds) ? d.linkedWikiPageIds : [],
      linkedChapterId: d.linkedChapterId || null,
      order: d.order == null ? 0 : d.order
    };
  }
  function beatModel(d) {
    d = d || {};
    return {
      id: d.id || uid('beat'), bookId: d.bookId || null, template: d.template || 'three-act',
      beatKey: d.beatKey || '', beatName: d.beatName || '', description: d.description || '',
      notes: d.notes || '', order: d.order == null ? 0 : d.order,
      linkedChapterId: d.linkedChapterId || null,
      status: ['not-started', 'drafted', 'done'].indexOf(d.status) !== -1 ? d.status : 'not-started'
    };
  }
  function trackerModel(d) {
    d = d || {};
    return {
      id: d.id || uid('trk'), bookId: d.bookId || null,
      type: TRACKER_TYPES.indexOf(d.type) !== -1 ? d.type : 'subplot',
      title: d.title || 'Untitled Thread', description: d.description || '',
      status: TRACKER_STATUSES.indexOf(d.status) !== -1 ? d.status : 'open',
      linkedChapterId: d.linkedChapterId || null, linkedCharacterId: d.linkedCharacterId || null,
      order: d.order == null ? 0 : d.order
    };
  }
  function plotPointModel(d) {
    d = d || {};
    return {
      id: d.id || uid('plot'), bookId: d.bookId || null,
      kind: PLOT_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'general',
      title: d.title || 'Untitled Plot Point', description: d.description || '',
      status: PLOT_STATUSES.indexOf(d.status) !== -1 ? d.status : 'planned',
      linkedChapterId: d.linkedChapterId || null,
      order: d.order == null ? 0 : d.order, createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function consistencyCheckModel(d) {
    d = d || {};
    return {
      id: d.id || uid('cc'), bookId: d.bookId || null,
      category: CONSISTENCY_CATEGORIES.indexOf(d.category) !== -1 ? d.category : 'continuity',
      note: d.note || '', status: ['open', 'resolved'].indexOf(d.status) !== -1 ? d.status : 'open',
      linkedChapterId: d.linkedChapterId || null, auto: !!d.auto,
      createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function publishingModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pub'), bookId: d.bookId || null,
      publishStatus: PUBLISH_STATUSES.indexOf(d.publishStatus) !== -1 ? d.publishStatus : 'drafting',
      platform: d.platform || '', publishDate: d.publishDate || '', isbn: d.isbn || '', notes: d.notes || ''
    };
  }
  // Generic "generated on demand, editable, reorderable" note section —
  // same shape as business.html's Platform Detail sections / system.html's
  // Page Notes: scope + scopeId names what it's attached to.
  function sectionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('sec'), scope: d.scope || 'wikipage', scopeId: d.scopeId || '',
      title: d.title || 'Section', body: d.body || '',
      order: d.order == null ? 0 : d.order, createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function mindMapNodeModel(d) {
    d = d || {};
    return {
      id: d.id || uid('mm'), mapLevel: d.mapLevel || 'trilogy', scopeId: d.scopeId || '',
      parentId: d.parentId || null, title: d.title || 'New Branch', notes: d.notes || '',
      tag: d.tag || '', linkedCharacterId: d.linkedCharacterId || null, linkedChapterId: d.linkedChapterId || null,
      order: d.order == null ? 0 : d.order
    };
  }
  function quickCaptureModel(d) {
    d = d || {};
    return {
      id: d.id || uid('qc'), seriesId: d.seriesId || null,
      type: QUICK_CAPTURE_TYPES.indexOf(d.type) !== -1 ? d.type : 'inspiration',
      title: d.title || '', text: d.text || '', link: d.link || '',
      tags: Array.isArray(d.tags) ? d.tags : [], processed: !!d.processed,
      order: d.order == null ? 0 : d.order, createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function documentModel(d) {
    d = d || {};
    return {
      id: d.id || uid('doc'), seriesId: d.seriesId || null,
      kind: DOCUMENT_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'template',
      title: d.title || 'Untitled Document', url: d.url || '', notes: d.notes || '',
      order: d.order == null ? 0 : d.order, createdAt: d.createdAt || new Date().toISOString()
    };
  }
  function writingSessionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ws'), bookId: d.bookId || null, seriesId: d.seriesId || null,
      date: d.date || todayISO(), words: d.words == null ? 0 : Number(d.words) || 0,
      minutes: d.minutes == null ? 0 : Number(d.minutes) || 0, note: d.note || ''
    };
  }
  function heroModel(d) {
    d = d || {};
    return {
      eyebrow: d.eyebrow || 'WRITING HEADQUARTERS', title: d.title || 'Your Worlds, Assembled.',
      subtext: d.subtext || 'Every series, every character, every word — one command center.',
      ctaLabel: d.ctaLabel || 'Enter the Studio', photo: d.photo || '', photoColor: d.photoColor || ''
    };
  }
  function settingsModel(d) {
    d = d || {};
    return {
      dailyGoal: d.dailyGoal == null ? 1000 : Number(d.dailyGoal) || 0, anthropicKey: d.anthropicKey || '',
      // The Composition Mode preset applied to any chapter that has no
      // preset of its own AND has never been individually tweaked —
      // "save as a template for all future chapters." A chapter's own
      // assignment (chapter.compositionPresetId) or its own prior tweaks
      // always take precedence over this — see composition-mode.js's
      // loadDraftForChapter().
      defaultCompositionPresetId: d.defaultCompositionPresetId || null
    };
  }

  // ============================================================
  // COLLECTIONS
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list(); all.push(record); storeSet(key, all);
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

  const Series = makeCollection(KEYS.series, seriesModel);
  const Books = makeCollection(KEYS.books, bookModel);
  const Acts = makeCollection(KEYS.acts, actModel);
  const Chapters = makeCollection(KEYS.chapters, chapterModel);
  const CompositionPresets = makeCollection(KEYS.compositionPresets, compositionPresetModel);
  const Scenes = makeCollection(KEYS.scenes, sceneModel);
  const Characters = makeCollection(KEYS.characters, characterModel);
  const WikiPages = makeCollection(KEYS.wikiPages, wikiPageModel);
  const TimelineEvents = makeCollection(KEYS.timelineEvents, timelineEventModel);
  const Beats = makeCollection(KEYS.beats, beatModel);
  const Trackers = makeCollection(KEYS.trackers, trackerModel);
  const ConsistencyChecks = makeCollection(KEYS.consistencyChecks, consistencyCheckModel);
  const Publishing = makeCollection(KEYS.publishing, publishingModel);
  const Sections = makeCollection(KEYS.sections, sectionModel);
  const MindMapNodes = makeCollection(KEYS.mindMapNodes, mindMapNodeModel);
  const QuickCaptures = makeCollection(KEYS.quickCaptures, quickCaptureModel);
  const Documents = makeCollection(KEYS.documents, documentModel);
  const WritingSessions = makeCollection(KEYS.writingSessions, writingSessionModel);
  const ActChapterTemplates = makeCollection(KEYS.actChapterTemplates, actChapterTemplateModel);
  const CharacterTemplates = makeCollection(KEYS.characterTemplates, characterTemplateModel);
  const WikiTemplates = makeCollection(KEYS.wikiTemplates, wikiTemplateModel);
  const PlotPoints = makeCollection(KEYS.plotPoints, plotPointModel);
  const PlotTemplates = makeCollection(KEYS.plotTemplates, plotTemplateModel);

  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order || 0; })) + 1 : 0; }
  function reorderCollection(col, orderedIds) {
    const all = col.list();
    const byId = {}; all.forEach(function (x) { byId[x.id] = x; });
    orderedIds.forEach(function (id, idx) { if (byId[id]) byId[id].order = idx; });
    col.replaceAll(all);
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function seriesSorted() { return Series.list().filter(function (s) { return !s.archived; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function seriesArchived() { return Series.list().filter(function (s) { return s.archived; }); }
  function booksForSeries(seriesId) { return Books.list().filter(function (b) { return b.seriesId === seriesId && !b.archived; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function actsForBook(bookId) { return Acts.list().filter(function (a) { return a.bookId === bookId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function chaptersForBook(bookId) { return Chapters.list().filter(function (c) { return c.bookId === bookId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function chaptersForAct(actId) { return Chapters.list().filter(function (c) { return c.actId === actId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }

  // ---------- Reusable Acts & Chapters templates ----------
  function actChapterTemplatesSorted() { return ActChapterTemplates.list().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function captureActChapterTemplateFromBook(bookId, name, description) {
    const acts = actsForBook(bookId);
    const unassigned = chaptersForBook(bookId).filter(function (c) { return !c.actId; });
    const tplActs = acts.map(function (a) {
      return { title: a.title, chapters: chaptersForAct(a.id).map(function (c) { return { title: c.title, wordGoal: c.wordGoal }; }) };
    });
    if (unassigned.length) tplActs.push({ title: 'Unassigned Chapters', chapters: unassigned.map(function (c) { return { title: c.title, wordGoal: c.wordGoal }; }) });
    return ActChapterTemplates.add({ name: name || 'Untitled Template', description: description || '', acts: tplActs, order: nextOrder(ActChapterTemplates.list()) });
  }
  // Applies a template by creating brand-new Act/Chapter records on the
  // target book, appended after whatever's already there (never replaces
  // or reorders existing acts/chapters) — safe to apply more than once,
  // and safe on a book that already has real content.
  function applyActChapterTemplate(templateId, bookId) {
    const tpl = ActChapterTemplates.get(templateId);
    if (!tpl) return { acts: 0, chapters: 0 };
    let actOrder = nextOrder(actsForBook(bookId));
    let chapterOrder = nextOrder(chaptersForBook(bookId));
    let actCount = 0, chapterCount = 0;
    tpl.acts.forEach(function (a) {
      const actRec = Acts.add({ bookId: bookId, title: a.title, order: actOrder++ });
      actCount++;
      a.chapters.forEach(function (c) {
        Chapters.add({ bookId: bookId, actId: actRec.id, title: c.title, wordGoal: c.wordGoal, order: chapterOrder++ });
        chapterCount++;
      });
    });
    return { acts: actCount, chapters: chapterCount };
  }
  // Applies a STRUCTURE_TEMPLATES beat sheet to a book by creating the
  // Beats it's still missing — additive and idempotent per (bookId,
  // templateKey) pair, same "safe to apply more than once, never touches
  // what's already there" contract as applyActChapterTemplate/
  // applyPlotTemplate above. Always keys off beatKey+template together
  // (never beatKey alone — several templates reuse keys like 'midpoint').
  function applyStructureTemplate(templateKey, bookId) {
    const tpl = STRUCTURE_TEMPLATES[templateKey]; if (!tpl) return { beats: 0 };
    const existingKeys = beatsForBook(bookId).filter(function (b) { return b.template === templateKey; }).map(function (b) { return b.beatKey; });
    let order = nextOrder(beatsForBook(bookId));
    let count = 0;
    tpl.beats.forEach(function (beat) {
      if (existingKeys.indexOf(beat.key) !== -1) return;
      Beats.add({ bookId: bookId, template: templateKey, beatKey: beat.key, beatName: beat.name, description: beat.desc, order: order++ });
      count++;
    });
    return { beats: count };
  }
  // ---------- Reusable Character templates (archetypes) ----------
  function characterTemplatesSorted() { return CharacterTemplates.list().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function captureCharacterTemplateFromCharacter(characterId, name, description) {
    const c = Characters.get(characterId); if (!c) return null;
    const fields = {};
    CHARACTER_TEMPLATE_FIELD_KEYS.forEach(function (k) { fields[k] = c[k] || ''; });
    const sections = sectionsFor('character', characterId).map(function (s) { return { title: s.title, body: s.body }; });
    return CharacterTemplates.add({ name: name || 'Untitled Template', description: description || '', fields: fields, sections: sections, order: nextOrder(CharacterTemplates.list()) });
  }
  // Creates a brand-new real Character on the target series, prefilled
  // from the template's own field snapshot — never a live reference, so
  // editing/deleting the template afterward never touches it — plus one
  // generated Section per saved template section (same generated-on-
  // demand-notes precedent applyWikiTemplate below already uses).
  function applyCharacterTemplate(templateId, seriesId, bookId) {
    const tpl = CharacterTemplates.get(templateId); if (!tpl) return null;
    const base = { seriesId: seriesId, name: 'New ' + tpl.name, order: nextOrder(charactersForSeries(seriesId)) };
    if (bookId) base.bookIds = [bookId];
    const rec = Characters.add(Object.assign(base, tpl.fields));
    tpl.sections.forEach(function (sec, i) { Sections.add({ scope: 'character', scopeId: rec.id, title: sec.title, body: sec.body, order: i }); });
    return rec;
  }
  // ---------- Reusable General/Romance Plot templates (Story Architecture) ----------
  function plotTemplatesSorted(kind) {
    return PlotTemplates.list().filter(function (t) { return !kind || t.kind === kind; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function capturePlotTemplateFromBook(bookId, kind, name, description) {
    const points = plotPointsForBook(bookId, kind).map(function (p) { return { title: p.title, description: p.description }; });
    return PlotTemplates.add({ name: name || 'Untitled Template', description: description || '', kind: kind, points: points, order: nextOrder(PlotTemplates.list()) });
  }
  // Creates brand-new PlotPoint records on the target book, appended
  // after whatever's already there for that kind (never replaces or
  // reorders existing plot points) — same safe-to-reapply contract as
  // applyActChapterTemplate above.
  function applyPlotTemplate(templateId, bookId) {
    const tpl = PlotTemplates.get(templateId); if (!tpl) return { points: 0 };
    let order = nextOrder(plotPointsForBook(bookId, tpl.kind));
    tpl.points.forEach(function (p) { PlotPoints.add({ bookId: bookId, kind: tpl.kind, title: p.title, description: p.description, order: order++ }); });
    return { points: tpl.points.length };
  }
  // ---------- Reusable Worldbuilding templates ----------
  function wikiTemplatesSorted() { return WikiTemplates.list().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function captureWikiTemplateFromPage(wikiPageId, name, description) {
    const w = WikiPages.get(wikiPageId); if (!w) return null;
    const sectionTitles = sectionsFor('wikipage', wikiPageId).map(function (s) { return s.title; });
    return WikiTemplates.add({ name: name || 'Untitled Template', description: description || '', category: w.category, summary: w.summary, tags: w.tags.slice(), sectionTitles: sectionTitles, order: nextOrder(WikiTemplates.list()) });
  }
  // Creates a brand-new real WikiPage on the target series, prefilled
  // from the template's category/summary/tags, plus one generated Section
  // per saved section title (same generated-on-demand-notes precedent
  // ensureDefaultWikiSections already uses) — never live references.
  function applyWikiTemplate(templateId, seriesId) {
    const tpl = WikiTemplates.get(templateId); if (!tpl) return null;
    const rec = WikiPages.add({ seriesId: seriesId, category: tpl.category, title: 'New ' + tpl.name, summary: tpl.summary, tags: tpl.tags.slice(), order: nextOrder(wikiPagesForSeries(seriesId)) });
    tpl.sectionTitles.forEach(function (title) { addSection('wikipage', rec.id, title); });
    return rec;
  }
  function scenesForChapter(chapterId) { return Scenes.list().filter(function (s) { return s.chapterId === chapterId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function charactersForSeries(seriesId) { return Characters.list().filter(function (c) { return c.seriesId === seriesId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function wikiPagesForSeries(seriesId) { return WikiPages.list().filter(function (w) { return w.seriesId === seriesId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function wikiPagesForCategory(seriesId, category) { return wikiPagesForSeries(seriesId).filter(function (w) { return w.category === category; }); }
  function timelineForSeries(seriesId) { return TimelineEvents.list().filter(function (t) { return t.seriesId === seriesId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function beatsForBook(bookId) { return Beats.list().filter(function (b) { return b.bookId === bookId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function trackersForBook(bookId, type) { return Trackers.list().filter(function (t) { return t.bookId === bookId && (!type || t.type === type); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function plotPointsForBook(bookId, kind) { return PlotPoints.list().filter(function (p) { return p.bookId === bookId && (!kind || p.kind === kind); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function plotPointsForSeries(seriesId, kind) {
    const bookIds = booksForSeries(seriesId).map(function (b) { return b.id; });
    return PlotPoints.list().filter(function (p) { return bookIds.indexOf(p.bookId) !== -1 && (!kind || p.kind === kind); });
  }
  // Series-wide Trackers of one type, across every book in the trilogy —
  // same "Book N:" grouping precedent as plotPointsForSeries above, used
  // by the Story Architecture section's Plot Threads/Character Arcs/Theme/
  // Foreshadowing/Payoff filtered views.
  function trackersForSeries(seriesId, type) {
    const books = booksForSeries(seriesId);
    const bookIndex = {}; books.forEach(function (b, i) { bookIndex[b.id] = i + 1; });
    return Trackers.list()
      .filter(function (t) { return bookIndex[t.bookId] && (!type || t.type === type); })
      .map(function (t) { return Object.assign({}, t, { bookNumber: bookIndex[t.bookId] }); })
      .sort(function (a, b) { return a.bookNumber - b.bookNumber || (a.order || 0) - (b.order || 0); });
  }
  function consistencyChecksForBook(bookId) { return ConsistencyChecks.list().filter(function (c) { return c.bookId === bookId; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }); }
  function publishingForBook(bookId) {
    let rec = Publishing.list().find(function (p) { return p.bookId === bookId; });
    if (!rec) rec = Publishing.add({ bookId: bookId });
    return rec;
  }
  function sectionsFor(scope, scopeId) { return Sections.list().filter(function (s) { return s.scope === scope && s.scopeId === scopeId; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function addSection(scope, scopeId, title) { return Sections.add({ scope: scope, scopeId: scopeId, title: title || 'Section', order: nextOrder(sectionsFor(scope, scopeId)) }); }
  function moveSection(id, dir) {
    const s = Sections.get(id); if (!s) return;
    const siblings = sectionsFor(s.scope, s.scopeId);
    const idx = siblings.findIndex(function (x) { return x.id === id; });
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    Sections.update(a.id, { order: b.order }); Sections.update(b.id, { order: a.order });
  }
  // ============================================================
  // LABEL/VALUE PROFILE PARSER — shared by Character and Worldbuilding
  // "paste a filled-in profile, everything updates" flows. Pure, no DOM.
  // A line is a label boundary if the text before its first ':' matches
  // one of `knownLabels` (case-insensitive) — or, if `knownLabels` is
  // omitted, a loose Title-Case-ish heuristic. Everything after that
  // colon plus every following non-label line becomes the label's value,
  // up to the next label boundary. Repeated labels: last occurrence wins.
  // ============================================================
  function parseLabelBlock(text, knownLabels) {
    text = text || '';
    const knownSet = Array.isArray(knownLabels) && knownLabels.length
      ? knownLabels.map(function (l) { return l.trim().toLowerCase(); })
      : null;
    function isLabelLine(line) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return false;
      const pre = line.slice(0, colonIdx).trim();
      if (!pre || pre.length > 40) return false;
      if (knownSet) return knownSet.indexOf(pre.toLowerCase()) !== -1;
      if (/[.!?]/.test(pre)) return false;
      return /^[A-Za-z][A-Za-z0-9 /'&()-]*$/.test(pre);
    }
    const entries = [];
    const preambleLines = [];
    let current = null;
    text.split('\n').forEach(function (line) {
      if (isLabelLine(line)) {
        if (current) entries.push({ label: current.label, value: current.valueLines.join('\n').trim() });
        const colonIdx = line.indexOf(':');
        const rest = line.slice(colonIdx + 1);
        current = { label: line.slice(0, colonIdx).trim(), valueLines: rest.trim() ? [rest.trim()] : [] };
      } else if (current) {
        current.valueLines.push(line);
      } else {
        preambleLines.push(line);
      }
    });
    if (current) entries.push({ label: current.label, value: current.valueLines.join('\n').trim() });
    // Last occurrence wins, but keep first-seen order for readability.
    const byLabel = {}, order = [];
    entries.forEach(function (e) {
      const key = e.label.trim().toLowerCase();
      if (!(key in byLabel)) order.push(key);
      byLabel[key] = e;
    });
    return { entries: order.map(function (k) { return byLabel[k]; }), unmatchedPreamble: preambleLines.join('\n').trim() };
  }
  // Small, hand-curated table of labels that trigger auto-linking instead
  // of (or in addition to) being stored as plain text. Not every label
  // links — unrecognized labels are simply left as text in the profile.
  var LABEL_LINK_VOCAB = {
    'book': { collection: 'books' },
    'character': { collection: 'characters' }, 'linked character': { collection: 'characters' },
    'ruler': { collection: 'characters' }, 'founder': { collection: 'characters' }, 'leader': { collection: 'characters' },
    'location': { collection: 'wikiPages' }, 'faction': { collection: 'wikiPages' },
    'organization': { collection: 'wikiPages' }, 'religion': { collection: 'wikiPages' }
  };
  // Exact case-insensitive name match only — no fuzzy matching, so
  // unresolved names are reported back for the UI to offer "Create?"
  // rather than silently guessing at the wrong record.
  function resolveLabelLink(vocabEntry, valueText, seriesId) {
    const names = (valueText || '').split(/,|&|\band\b/i).map(function (n) { return n.trim(); }).filter(Boolean);
    const pool = vocabEntry.collection === 'characters' ? charactersForSeries(seriesId)
      : vocabEntry.collection === 'books' ? booksForSeries(seriesId)
      : wikiPagesForSeries(seriesId);
    const nameKey = vocabEntry.collection === 'characters' ? 'name' : 'title';
    const resolved = [], unresolved = [];
    names.forEach(function (n) {
      const match = pool.find(function (r) { return (r[nameKey] || '').trim().toLowerCase() === n.toLowerCase(); });
      if (match) resolved.push({ id: match.id, name: match[nameKey] }); else unresolved.push(n);
    });
    return { resolved: resolved, unresolved: unresolved };
  }
  // Labels with a real 1:1 characterModel field. Labels with no entry
  // here (e.g. archetype-flavor lines from the built-in Quick Build
  // templates) just stay as inert text in the stored profile — not every
  // label needs a matching field.
  var CHARACTER_LABEL_FIELD_MAP = {
    name: 'name', age: 'age', birthday: 'birthday', species: 'species', race: 'race',
    occupation: 'occupation', status: 'status', role: 'role',
    personality: 'personality', motivations: 'motivations', goals: 'goals',
    strengths: 'strengths', weaknesses: 'weaknesses', fear: 'fear',
    'internal conflict': 'internalConflict', 'external conflict': 'externalConflict',
    arc: 'arc', 'character arc': 'arc', voice: 'voice', secrets: 'secrets', trauma: 'trauma', beliefs: 'beliefs',
    skills: 'skills', 'powers/skills': 'skills', powers: 'skills', magic: 'magic', weapons: 'weapons', equipment: 'equipment',
    appearance: 'appearance', 'physical description': 'physicalDescription',
    backstory: 'backstory', biography: 'biography'
  };
  var CHARACTER_PROFILE_LABELS = ['Name', 'Age', 'Biography', 'Physical Description', 'Personality', 'Motivations', 'Internal Conflict', 'External Conflict', 'Character Arc', 'Powers/Skills', 'Equipment', 'Secrets', 'Goals', 'Quotes', 'Notes'];
  // Relational sections (Relationships, Timeline, POV Chapters, Important
  // Scenes) are deliberately excluded from the blank text — those stay
  // driven by their own existing chip/graph UI, not duplicated as text.
  function buildBlankCharacterProfileText() {
    return CHARACTER_PROFILE_LABELS.map(function (l) { return l + ':'; }).join('\n');
  }
  // Applies a parsed profile onto a real Character record. Additive only:
  // resolved links are unioned with whatever links already exist, never
  // removed. Returns patched field names + resolved/unresolved links so
  // the UI can render an "Unresolved — Create?" banner.
  function applyParsedLabelsToCharacter(characterId, parsed, seriesId, bookId) {
    const character = Characters.get(characterId); if (!character) return null;
    const patch = {};
    const linksResolved = [], linksUnresolved = [], relationshipAdds = [];
    (parsed.entries || []).forEach(function (entry) {
      const key = entry.label.trim().toLowerCase();
      if (key === 'quotes') {
        const existing = Array.isArray(character.quotes) ? character.quotes.slice() : [];
        entry.value.split('\n').map(function (q) { return q.trim(); }).filter(Boolean).forEach(function (q) { if (existing.indexOf(q) === -1) existing.push(q); });
        patch.quotes = existing;
        return;
      }
      const vocab = LABEL_LINK_VOCAB[key];
      if (vocab) {
        const result = resolveLabelLink(vocab, entry.value, seriesId);
        result.resolved.forEach(function (r) { linksResolved.push({ collection: vocab.collection, id: r.id, name: r.name, label: entry.label }); });
        result.unresolved.forEach(function (n) { linksUnresolved.push({ collection: vocab.collection, name: n, label: entry.label }); });
        if (vocab.collection === 'books') {
          const existing = Array.isArray(patch.bookIds) ? patch.bookIds : (Array.isArray(character.bookIds) ? character.bookIds.slice() : []);
          result.resolved.forEach(function (r) { if (existing.indexOf(r.id) === -1) existing.push(r.id); });
          patch.bookIds = existing;
        } else if (vocab.collection === 'wikiPages') {
          const existing = Array.isArray(patch.linkedWikiPageIds) ? patch.linkedWikiPageIds : (Array.isArray(character.linkedWikiPageIds) ? character.linkedWikiPageIds.slice() : []);
          result.resolved.forEach(function (r) { if (existing.indexOf(r.id) === -1) existing.push(r.id); });
          patch.linkedWikiPageIds = existing;
        } else if (vocab.collection === 'characters') {
          result.resolved.forEach(function (r) { if (r.id !== characterId) relationshipAdds.push(r.id); });
        }
        return;
      }
      const fieldKey = CHARACTER_LABEL_FIELD_MAP[key];
      if (fieldKey) patch[fieldKey] = entry.value;
    });
    if (relationshipAdds.length) {
      const existingRel = Array.isArray(character.relationships) ? character.relationships.slice() : [];
      const existingTargets = existingRel.map(function (r) { return r.targetId; });
      relationshipAdds.forEach(function (id) { if (existingTargets.indexOf(id) === -1) { existingRel.push({ targetId: id, type: 'unknown', notes: '' }); existingTargets.push(id); } });
      patch.relationships = existingRel;
    }
    if (bookId) {
      const existing = Array.isArray(patch.bookIds) ? patch.bookIds : (Array.isArray(character.bookIds) ? character.bookIds.slice() : []);
      if (existing.indexOf(bookId) === -1) existing.push(bookId);
      patch.bookIds = existing;
    }
    const updated = Characters.update(characterId, patch);
    return { character: updated, patchedFields: Object.keys(patch), links: { resolved: linksResolved, unresolved: linksUnresolved } };
  }
  // ============================================================
  // WORLDBUILDING PASTE/GENERATE PROFILE — same mechanism as Character
  // (reuses parseLabelBlock/LABEL_LINK_VOCAB/resolveLabelLink above
  // unmodified). Structure lives entirely in the parsed text plus the
  // link arrays below — deliberately NO per-shape scalar fields (e.g. no
  // real `ruler` column) — WikiPages stays a generic model; "shape" only
  // selects which blank label list to generate.
  // ============================================================
  var WIKI_PROFILE_SHAPES = {
    kingdom: ['Name', 'Ruler', 'Government Type', 'Capital City', 'Territory', 'Military Strength', 'Key Exports', 'Allies', 'Rivals', 'Founding History', 'Culture Summary', 'Current Threats'],
    settlement: ['Name', 'Type', 'Region', 'Population', 'Government', 'Notable Districts', 'Economy', 'Defenses', 'Culture', 'History', 'Current Events'],
    location: ['Name', 'Type', 'Region', 'Geography', 'Notable Features', 'Inhabitants', 'History', 'Dangers', 'Significance'],
    creature: ['Name', 'Classification', 'Habitat', 'Diet', 'Abilities', 'Danger Level', 'Weaknesses', 'Known Sightings', 'Folklore', 'Relationship to Characters'],
    'magic-system': ['Name', 'Source of Power', 'Rules & Limitations', 'Cost & Consequences', 'Who Can Use It', 'Famous Practitioners', 'History & Origins'],
    religion: ['Name', 'Deity or Deities', 'Domain', 'Core Beliefs', 'Clergy Structure', 'Worship Practices', 'Symbols', 'Holy Sites', 'Relationship to Other Faiths'],
    organization: ['Name', 'Type', 'Leader', 'Goals', 'Membership', 'Resources', 'Allies', 'Enemies', 'Reputation', 'History'],
    item: ['Name', 'Type', 'Origin', 'Powers', 'Limitations', 'Current Owner', 'Appearance', 'History', 'Significance'],
    plant: ['Name', 'Type', 'Habitat', 'Appearance', 'Properties', 'Danger Level', 'Rarity', 'Folklore'],
    'race-species': ['Name', 'Physiology', 'Homeland', 'Culture', 'Lifespan', 'Abilities', 'Society Structure', 'Relationship to Other Races', 'Notable Members'],
    event: ['Name', 'Date', 'Location', 'Key Participants', 'Causes', 'Outcome', 'Consequences', 'Legacy'],
    'historical-figure': ['Name', 'Title', 'Era', 'Achievements', 'Legacy', 'Death', 'Relationship to Current Story'],
    generic: ['Name', 'Overview', 'Details', 'Significance', 'Notes']
  };
  var WIKI_SHAPE_LABELS = { kingdom: 'Kingdom', settlement: 'City / Village', location: 'Location', creature: 'Creature', 'magic-system': 'Magic System', religion: 'Religion', organization: 'Organization / Faction', item: 'Item / Artifact', plant: 'Plant', 'race-species': 'Race / Species', event: 'Event', 'historical-figure': 'Historical Figure', generic: 'Generic' };
  var WIKI_CATEGORY_TO_SHAPE = {
    'world-overview': 'location', continents: 'location', countries: 'kingdom', kingdoms: 'kingdom', cities: 'settlement', villages: 'settlement', regions: 'location', landmarks: 'location', maps: 'generic', climate: 'generic',
    history: 'event', timeline: 'event', politics: 'organization', governments: 'organization', laws: 'generic', crime: 'organization', military: 'organization',
    cultures: 'generic', religions: 'religion', languages: 'generic', currencies: 'generic', economics: 'generic', trade: 'organization', guilds: 'organization', factions: 'organization', organizations: 'organization', education: 'organization', fashion: 'generic', food: 'generic', festivals: 'event', architecture: 'generic', transportation: 'generic',
    'magic-systems': 'magic-system', technology: 'magic-system', alchemy: 'magic-system', artifacts: 'item', weapons: 'item', armor: 'item',
    creatures: 'creature', monsters: 'creature', plants: 'plant', 'races-species': 'race-species',
    astronomy: 'location', dimensions: 'location', gods: 'religion', pantheon: 'religion', cosmology: 'generic', legends: 'event', myths: 'event', prophecies: 'generic',
    books: 'generic', songs: 'generic', poems: 'generic', glossary: 'generic', 'reference-images': 'generic', research: 'generic', miscellaneous: 'generic'
  };
  function wikiShapeForCategory(category) { return WIKI_CATEGORY_TO_SHAPE[category] || 'generic'; }
  var WIKI_LABEL_FIELD_MAP = { name: 'title', title: 'title', summary: 'summary', overview: 'summary' };
  function buildBlankWikiProfileText(shapeKey) {
    var labels = WIKI_PROFILE_SHAPES[shapeKey] || WIKI_PROFILE_SHAPES.generic;
    return labels.map(function (l) { return l + ':'; }).join('\n');
  }
  function applyParsedLabelsToWikiPage(wikiPageId, parsed, seriesId) {
    const page = WikiPages.get(wikiPageId); if (!page) return null;
    const patch = {};
    const linksResolved = [], linksUnresolved = [], wikiLinkAdds = [];
    (parsed.entries || []).forEach(function (entry) {
      const key = entry.label.trim().toLowerCase();
      if (key === 'tags') { patch.tags = entry.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean); return; }
      const vocab = LABEL_LINK_VOCAB[key];
      if (vocab) {
        const result = resolveLabelLink(vocab, entry.value, seriesId);
        result.resolved.forEach(function (r) { linksResolved.push({ collection: vocab.collection, id: r.id, name: r.name, label: entry.label }); });
        result.unresolved.forEach(function (n) { linksUnresolved.push({ collection: vocab.collection, name: n, label: entry.label }); });
        if (vocab.collection === 'books') {
          const existing = Array.isArray(patch.bookIds) ? patch.bookIds : (Array.isArray(page.bookIds) ? page.bookIds.slice() : []);
          result.resolved.forEach(function (r) { if (existing.indexOf(r.id) === -1) existing.push(r.id); });
          patch.bookIds = existing;
        } else if (vocab.collection === 'characters') {
          const existing = Array.isArray(patch.linkedCharacterIds) ? patch.linkedCharacterIds : (Array.isArray(page.linkedCharacterIds) ? page.linkedCharacterIds.slice() : []);
          result.resolved.forEach(function (r) { if (existing.indexOf(r.id) === -1) existing.push(r.id); });
          patch.linkedCharacterIds = existing;
        } else if (vocab.collection === 'wikiPages') {
          result.resolved.forEach(function (r) { if (r.id !== wikiPageId) wikiLinkAdds.push(r.id); });
        }
        return;
      }
      const fieldKey = WIKI_LABEL_FIELD_MAP[key];
      if (fieldKey) patch[fieldKey] = entry.value;
    });
    if (wikiLinkAdds.length) {
      const existingLinks = Array.isArray(page.links) ? page.links.slice() : [];
      wikiLinkAdds.forEach(function (id) { if (existingLinks.indexOf(id) === -1) existingLinks.push(id); });
      patch.links = existingLinks;
    }
    const updated = WikiPages.update(wikiPageId, patch);
    return { page: updated, patchedFields: Object.keys(patch), links: { resolved: linksResolved, unresolved: linksUnresolved } };
  }
  function ensureDefaultWikiSections(wikiPageId) {
    const page = WikiPages.get(wikiPageId); if (!page) return;
    if (sectionsFor('wikipage', wikiPageId).length) return;
    defaultSectionTitlesFor(page.category).forEach(function (title, i) { addSection('wikipage', wikiPageId, title); });
  }
  function quickCapturesFor(seriesId) { return QuickCaptures.list().filter(function (q) { return !seriesId || q.seriesId === seriesId; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }); }
  function documentsFor(seriesId, kind) { return Documents.list().filter(function (d) { return (!seriesId || d.seriesId === seriesId) && (!kind || d.kind === kind); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function writingSessionsForBook(bookId) { return WritingSessions.list().filter(function (w) { return w.bookId === bookId; }); }
  function writingSessionsForSeries(seriesId) { return WritingSessions.list().filter(function (w) { return w.seriesId === seriesId; }); }

  // ============================================================
  // COMPUTED — word counts, streaks, analytics
  // ============================================================
  function bookWordCount(bookId) {
    return chaptersForBook(bookId).reduce(function (sum, c) { return sum + wordCount(c.content); }, 0);
  }
  function seriesWordCount(seriesId) {
    return booksForSeries(seriesId).reduce(function (sum, b) { return sum + bookWordCount(b.id); }, 0);
  }
  function totalWordCount() { return Chapters.list().reduce(function (sum, c) { return sum + wordCount(c.content); }, 0); }
  function totalYearlyWords() {
    const year = new Date().getFullYear();
    return WritingSessions.list().filter(function (w) { return w.date && w.date.slice(0, 4) === String(year); }).reduce(function (s, w) { return s + w.words; }, 0);
  }
  function wordsOnDate(dateISO) { return WritingSessions.list().filter(function (w) { return w.date === dateISO; }).reduce(function (s, w) { return s + w.words; }, 0); }
  function wordsInLastNDays(n) {
    let total = 0;
    for (let i = 0; i < n; i++) total += wordsOnDate(isoDaysAgo(i));
    return total;
  }
  function currentWritingStreak() {
    let streak = 0, i = 0;
    // Today doesn't break the streak if it's simply not written yet.
    if (wordsOnDate(todayISO()) === 0) i = 1;
    while (wordsOnDate(isoDaysAgo(i)) > 0) { streak++; i++; }
    return streak;
  }
  function booksInProgressCount() { return Books.list().filter(function (b) { return !b.archived && b.status !== 'complete'; }).length; }
  function booksPublishedCount() { return Books.list().filter(function (b) { return b.status === 'complete' || (Publishing.list().find(function (p) { return p.bookId === b.id; }) || {}).publishStatus === 'published'; }).length; }
  function avgChapterLength() {
    const chapters = Chapters.list(); if (!chapters.length) return 0;
    return Math.round(chapters.reduce(function (s, c) { return s + wordCount(c.content); }, 0) / chapters.length);
  }
  function avgSceneLength() {
    const scenes = Scenes.list(); if (!scenes.length) return 0;
    return Math.round(scenes.reduce(function (s, sc) { return s + wordCount(sc.summary); }, 0) / scenes.length);
  }
  function writingHeatmap(days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) { const d = isoDaysAgo(i); out.push({ date: d, words: wordsOnDate(d) }); }
    return out;
  }
  function mostProductiveDays(days) {
    const map = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    writingHeatmap(days || 90).forEach(function (row) {
      const d = new Date(row.date + 'T00:00:00');
      if (!isNaN(d.getTime())) map[names[d.getDay()]] += row.words;
    });
    return names.map(function (n) { return { day: n, words: map[n] }; }).sort(function (a, b) { return b.words - a.words; });
  }
  function averageSessionMinutes() {
    const sessions = WritingSessions.list().filter(function (w) { return w.minutes > 0; });
    if (!sessions.length) return 0;
    return Math.round(sessions.reduce(function (s, w) { return s + w.minutes; }, 0) / sessions.length);
  }

  // Logs (or upserts, one row per book+date) a writing session — the
  // "automatic logging" mechanism: writing-dashboard.html calls this with
  // a positive word DELTA whenever a chapter's content is saved and has
  // grown since the last save.
  function logWritingProgress(bookId, seriesId, wordDelta, minutesDelta) {
    if (wordDelta <= 0 && (!minutesDelta || minutesDelta <= 0)) return;
    const date = todayISO();
    const existing = WritingSessions.list().find(function (w) { return w.bookId === bookId && w.date === date; });
    if (existing) {
      WritingSessions.update(existing.id, { words: existing.words + Math.max(0, wordDelta), minutes: existing.minutes + Math.max(0, minutesDelta || 0) });
    } else {
      WritingSessions.add({ bookId: bookId, seriesId: seriesId, date: date, words: Math.max(0, wordDelta), minutes: Math.max(0, minutesDelta || 0) });
    }
  }

  // ============================================================
  // RELATIONSHIP GRAPH — computed live from Character.relationships[],
  // same circular-layout technique knowledge-hub-data.js's Knowledge
  // Graph already established (buildDepartmentGraph/layoutCircle).
  // ============================================================
  function buildRelationshipGraph(seriesId) {
    const chars = charactersForSeries(seriesId);
    const nodes = chars.map(function (c) { return { id: c.id, label: c.name }; });
    const edges = []; const seen = {};
    chars.forEach(function (c) {
      (c.relationships || []).forEach(function (r) {
        if (!r.targetId || !chars.find(function (x) { return x.id === r.targetId; })) return;
        const key = [c.id, r.targetId].sort().join('|') + '|' + r.type;
        if (seen[key]) return;
        seen[key] = true;
        edges.push({ a: c.id, b: r.targetId, type: r.type });
      });
    });
    return { nodes: nodes, edges: edges };
  }

  // ============================================================
  // MIND MAP — tidy-tree layout, same technique knowledge-hub-data.js's
  // computeMindMapLayout already established.
  // ============================================================
  function mindMapNodesForScope(mapLevel, scopeId) { return MindMapNodes.list().filter(function (n) { return n.mapLevel === mapLevel && n.scopeId === scopeId; }); }
  function ensureMindMapRoot(mapLevel, scopeId, rootTitle) {
    let nodes = mindMapNodesForScope(mapLevel, scopeId);
    let root = nodes.find(function (n) { return !n.parentId; });
    if (!root) root = MindMapNodes.add({ mapLevel: mapLevel, scopeId: scopeId, parentId: null, title: rootTitle || 'Root', order: 0 });
    return root;
  }
  function addMindMapBranch(mapLevel, scopeId, parentId, title) {
    const siblings = MindMapNodes.list().filter(function (n) { return n.parentId === parentId; });
    return MindMapNodes.add({ mapLevel: mapLevel, scopeId: scopeId, parentId: parentId, title: title || 'New Branch', order: nextOrder(siblings) });
  }
  function removeMindMapNodeCascade(id) {
    const all = MindMapNodes.list();
    const toRemove = {}; toRemove[id] = true;
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach(function (n) { if (n.parentId && toRemove[n.parentId] && !toRemove[n.id]) { toRemove[n.id] = true; changed = true; } });
    }
    MindMapNodes.replaceAll(all.filter(function (n) { return !toRemove[n.id]; }));
  }
  function computeMindMapLayout(nodes, rootId) {
    const byParent = {};
    nodes.forEach(function (n) { const key = n.parentId || '__root__'; (byParent[key] = byParent[key] || []).push(n); });
    Object.keys(byParent).forEach(function (k) { byParent[k].sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); });
    const positions = {};
    let leafCounter = 0;
    function layout(nodeId, depth) {
      const children = byParent[nodeId] || [];
      if (!children.length) { positions[nodeId] = { depth: depth, slot: leafCounter }; leafCounter++; return positions[nodeId].slot; }
      const slots = children.map(function (c) { return layout(c.id, depth + 1); });
      const slot = slots.reduce(function (a, b) { return a + b; }, 0) / slots.length;
      positions[nodeId] = { depth: depth, slot: slot };
      return slot;
    }
    if (rootId) layout(rootId, 0);
    return positions;
  }

  // ============================================================
  // CONSISTENCY CHECKER — honest, computed heuristics (see the
  // "CONFIRMED ADAPTATIONS" note at the top of this file).
  // ============================================================
  function computeConsistencySuggestions(bookId) {
    const out = [];
    const chapters = chaptersForBook(bookId);
    const wordsPerChapter = chapters.map(function (c) { return wordCount(c.content); }).filter(function (w) { return w > 0; });
    if (wordsPerChapter.length >= 3) {
      const avg = wordsPerChapter.reduce(function (a, b) { return a + b; }, 0) / wordsPerChapter.length;
      chapters.forEach(function (c) {
        const w = wordCount(c.content);
        if (w > 0 && (w < avg * 0.35 || w > avg * 2.2)) {
          out.push({ category: 'scene-balance', note: '"' + c.title + '" is ' + w + ' words — noticeably ' + (w < avg ? 'shorter' : 'longer') + ' than this book\'s average chapter (~' + Math.round(avg) + ' words). Worth a pacing check.', linkedChapterId: c.id });
        }
      });
    }
    const openTrackers = trackersForBook(bookId).filter(function (t) { return t.status === 'open' || t.status === 'planted'; });
    const lastChapters = chapters.slice(-3);
    if (openTrackers.length && lastChapters.length) {
      openTrackers.forEach(function (t) {
        out.push({ category: t.type === 'foreshadowing' ? 'foreshadowing' : t.type === 'mystery' ? 'plot-hole' : 'continuity', note: '"' + t.title + '" (' + TRACKER_TYPE_LABELS[t.type] + ') is still marked "' + t.status + '" — confirm it gets resolved or intentionally left open before you finish drafting.' });
      });
    }
    const notStartedBeats = beatsForBook(bookId).filter(function (b) { return b.status === 'not-started' && !b.linkedChapterId; });
    if (notStartedBeats.length) {
      notStartedBeats.forEach(function (b) {
        out.push({ category: 'plot-hole', note: 'The "' + b.beatName + '" beat has no chapter linked yet — make sure it actually lands somewhere in the manuscript.' });
      });
    }
    const seriesId = (Books.get(bookId) || {}).seriesId;
    if (seriesId) {
      const chars = charactersForSeries(seriesId);
      chars.forEach(function (c) {
        const referencedByOthers = chars.some(function (other) { return other.id !== c.id && (other.relationships || []).some(function (r) { return r.targetId === c.id; }); });
        if (referencedByOthers && (c.bookIds || []).indexOf(bookId) === -1 && chars.some(function (other) { return (other.bookIds || []).indexOf(bookId) !== -1 && (other.relationships || []).some(function (r) { return r.targetId === c.id; }); })) {
          out.push({ category: 'character', note: '"' + c.name + '" is referenced in a relationship by a character who appears in this book, but "' + c.name + '" isn\'t marked as appearing in this book — confirm that\'s intentional.', });
        }
      });
    }
    return out;
  }

  // ============================================================
  // AI ASSISTANT — real fetch() when a key is configured (Settings),
  // an honest local fallback otherwise. Same pattern mainpillar.html /
  // fitnessstudio.html / knowledge-hub.html already established.
  // ============================================================
  function getSettings() { return settingsModel(storeGet(KEYS.settings)); }
  function saveSettings(patch) { const next = settingsModel(Object.assign({}, getSettings(), patch)); storeSet(KEYS.settings, next); return next; }

  function callAnthropic(prompt) {
    const key = getSettings().anthropicKey;
    if (!key) return Promise.resolve(null);
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { return data && data.content && data.content[0] ? data.content[0].text : null; })
      .catch(function () { return null; });
  }

  function aiReviewBook(bookId) {
    const book = Books.get(bookId);
    const suggestions = computeConsistencySuggestions(bookId);
    const localSummary = suggestions.length
      ? 'Local review found ' + suggestions.length + ' item(s) worth a look:\n' + suggestions.map(function (s) { return '• [' + CONSISTENCY_LABELS[s.category] + '] ' + s.note; }).join('\n')
      : 'Local review found nothing obviously off — chapter lengths look consistent, every tracked thread is resolved or intentionally open, and every planned beat has a home.';
    const prompt = 'You are a developmental editor. Here is a summary of my manuscript "' + (book ? book.title : '') + '": ' +
      chaptersForBook(bookId).map(function (c) { return c.title + ' (' + wordCount(c.content) + ' words): ' + (c.summary || '(no summary)'); }).join(' | ') +
      '. Give me 3-5 honest developmental notes on pacing, plot holes, or consistency.';
    return callAnthropic(prompt).then(function (aiText) {
      return { isAI: !!aiText, text: aiText || localSummary };
    });
  }

  // ============================================================
  // CASCADE DELETES — null-out-the-reference where it can stand alone,
  // cascade where it can't (same precedent every -data.js in this app
  // already follows).
  // ============================================================
  function removeSeries(id) {
    Series.remove(id);
    booksForSeries(id).concat(Books.list().filter(function (b) { return b.seriesId === id; })).forEach(function (b) { removeBook(b.id); });
    Characters.replaceAll(Characters.list().filter(function (c) { return c.seriesId !== id; }));
    WikiPages.list().filter(function (w) { return w.seriesId === id; }).forEach(function (w) { removeWikiPage(w.id); });
    TimelineEvents.replaceAll(TimelineEvents.list().filter(function (t) { return t.seriesId !== id; }));
    QuickCaptures.replaceAll(QuickCaptures.list().filter(function (q) { return q.seriesId !== id; }));
    Documents.replaceAll(Documents.list().filter(function (d) { return d.seriesId !== id; }));
    MindMapNodes.replaceAll(MindMapNodes.list().filter(function (n) { return !(n.mapLevel === 'trilogy' && n.scopeId === id); }));
    WritingSessions.replaceAll(WritingSessions.list().filter(function (w) { return w.seriesId !== id; }));
  }
  function removeBook(id) {
    Books.remove(id);
    chaptersForBook(id).forEach(function (c) { removeChapter(c.id); });
    Acts.replaceAll(Acts.list().filter(function (a) { return a.bookId !== id; }));
    Beats.replaceAll(Beats.list().filter(function (b) { return b.bookId !== id; }));
    Trackers.replaceAll(Trackers.list().filter(function (t) { return t.bookId !== id; }));
    ConsistencyChecks.replaceAll(ConsistencyChecks.list().filter(function (c) { return c.bookId !== id; }));
    Publishing.replaceAll(Publishing.list().filter(function (p) { return p.bookId !== id; }));
    MindMapNodes.replaceAll(MindMapNodes.list().filter(function (n) { return !(n.mapLevel === 'book' && n.scopeId === id); }));
    WritingSessions.replaceAll(WritingSessions.list().filter(function (w) { return w.bookId !== id; }));
    PlotPoints.replaceAll(PlotPoints.list().filter(function (p) { return p.bookId !== id; }));
    Characters.list().forEach(function (c) {
      if ((c.bookIds || []).indexOf(id) !== -1) Characters.update(c.id, { bookIds: c.bookIds.filter(function (x) { return x !== id; }) });
    });
  }
  function removeChapter(id) {
    Chapters.remove(id);
    Scenes.replaceAll(Scenes.list().filter(function (s) { return s.chapterId !== id; }));
    Beats.list().forEach(function (b) { if (b.linkedChapterId === id) Beats.update(b.id, { linkedChapterId: null }); });
    Trackers.list().forEach(function (t) { if (t.linkedChapterId === id) Trackers.update(t.id, { linkedChapterId: null }); });
    ConsistencyChecks.list().forEach(function (c) { if (c.linkedChapterId === id) ConsistencyChecks.update(c.id, { linkedChapterId: null }); });
    MindMapNodes.list().forEach(function (n) { if (n.linkedChapterId === id) MindMapNodes.update(n.id, { linkedChapterId: null }); });
    PlotPoints.list().forEach(function (p) { if (p.linkedChapterId === id) PlotPoints.update(p.id, { linkedChapterId: null }); });
    TimelineEvents.list().forEach(function (t) { if (t.linkedChapterId === id) TimelineEvents.update(t.id, { linkedChapterId: null }); });
  }
  function removeCharacter(id) {
    Characters.remove(id);
    Characters.list().forEach(function (c) {
      if ((c.relationships || []).some(function (r) { return r.targetId === id; })) {
        Characters.update(c.id, { relationships: c.relationships.filter(function (r) { return r.targetId !== id; }) });
      }
    });
    Scenes.list().forEach(function (s) { if ((s.characterIds || []).indexOf(id) !== -1) Scenes.update(s.id, { characterIds: s.characterIds.filter(function (x) { return x !== id; }) }); });
    Trackers.list().forEach(function (t) { if (t.linkedCharacterId === id) Trackers.update(t.id, { linkedCharacterId: null }); });
    MindMapNodes.list().forEach(function (n) { if (n.linkedCharacterId === id) MindMapNodes.update(n.id, { linkedCharacterId: null }); });
    Chapters.list().forEach(function (c) { if ((c.characterIds || []).indexOf(id) !== -1) Chapters.update(c.id, { characterIds: c.characterIds.filter(function (x) { return x !== id; }) }); });
    Sections.replaceAll(Sections.list().filter(function (s) { return !(s.scope === 'character' && s.scopeId === id); }));
  }
  function removeWikiPage(id) {
    WikiPages.remove(id);
    Sections.replaceAll(Sections.list().filter(function (s) { return !(s.scope === 'wikipage' && s.scopeId === id); }));
    WikiPages.list().forEach(function (w) { if ((w.links || []).indexOf(id) !== -1) WikiPages.update(w.id, { links: w.links.filter(function (x) { return x !== id; }) }); });
    Chapters.list().forEach(function (c) { if ((c.linkedWikiPageIds || []).indexOf(id) !== -1) Chapters.update(c.id, { linkedWikiPageIds: c.linkedWikiPageIds.filter(function (x) { return x !== id; }) }); });
  }

  // ============================================================
  // ENSURE / SEED — same empty-storage seed-race-safety contract as
  // every other synced page in this app (dreamboard.html/business.html/
  // aitech.html's own maybeSeedAfterSyncAttempt()).
  // ============================================================
  function isEmptyEverywhere() {
    return !Series.list().length && !Books.list().length && !Characters.list().length && !WikiPages.list().length && !QuickCaptures.list().length;
  }
  // ---------- Default Character Templates (global archetype library) ----------
  // Four full archetype writeups — Core Archetype, Character Foundation,
  // Essential Traits, Character Voice, Visual Design, Fatal Flaws, and a
  // Quick Build Template — stored as `sections` (the long-form document)
  // plus a light `fields` prefill (short, usable defaults for an actual
  // new Character created from the template). Supersedes the old
  // three-template starter set (The Mentor / The Chosen One / The
  // Antagonist) below via ensureDefaultCharacterTemplates().
  var OBSOLETE_CHARACTER_TEMPLATE_NAMES = ['The Mentor', 'The Chosen One / Protagonist', 'The Antagonist'];
  var DEFAULT_CHARACTER_TEMPLATES = [
    {
      name: 'The Intellectual Underdog Protagonist',
      description: 'The character everyone assumes will die first — survives through intelligence, adaptability, and sheer refusal to break, not raw power.',
      fields: {
        role: 'Protagonist — Intellectual Underdog',
        personality: 'Sharp, observant, quietly defiant. Compassionate but capable of terrifying resolve when cornered.',
        motivations: 'Prove that intelligence and endurance matter as much as raw strength — and protect the people who see past their reputation.',
        goals: 'Survive an environment built for people stronger than them, without losing who they are.',
        strengths: 'Observation, strategy, pattern recognition, emotional intelligence, creativity under pressure — wins fights indirectly (poison, traps, terrain, exploiting arrogance).',
        weaknesses: 'A genuine physical disadvantage that never fully disappears (chronic illness, small stature, lack of training, a trauma-based limitation, etc).',
        fear: 'Becoming as monstrous as the world they\'re forced to survive in.',
        internalConflict: 'Staying emotionally human — compassionate, loyal, afraid — while being pushed into increasingly violent circumstances.',
        externalConflict: 'A world that has already decided they\'re a liability, and waits for them to fail or die first.',
        arc: 'From underestimated and dismissed to impossible to ignore — without power ever replacing who they fundamentally are.',
        voice: 'Dry humor and sharp internal observations hide real fear; constantly thinking three moves ahead.',
        appearance: 'Visually contrasts their environment — smaller, paler, or more elegant than the people around them; one distinctive symbolic trait.',
        backstory: 'A psychological wound and a social status that explain exactly why everyone underestimates them.'
      },
      sections: [
        { title: 'Core Archetype', body: '"The character everyone assumes will die first… who survives through intelligence, adaptability, emotional resilience, and sheer refusal to break."\n\nThis protagonist is not the strongest, fastest, richest, or most naturally gifted fighter.\nThey survive because:\n- They think faster than others.\n- They adapt under pressure.\n- They weaponize perceived weakness.\n- They refuse to surrender emotionally.\n- They endure pain better than people expect.' },
        { title: 'Character Foundation — Public Identity', body: 'The world sees them as:\n- Weak\n- Frail\n- Unsuitable\n- Too soft\n- Too intelligent for a brutal environment\n- A liability\n- Someone protected by privilege/family reputation\n- Someone who doesn\'t belong\n\nThe protagonist knows:\n- Some of this is true.\n- Most people underestimate them.\n- Underestimation is useful.' },
        { title: 'The Core Contradiction', body: 'The best underdog protagonists are built around contradiction.\n\nExternal Trait → Internal Truth\n- Physically weak → Mentally relentless\n- Emotionally compassionate → Capable of terrifying violence when cornered\n- Intelligent/bookish → Learns combat through adaptation\n- Afraid → Still acts\n- Socially overlooked → Eventually becomes impossible to ignore' },
        { title: 'Essential Underdog Traits', body: '1. Physical Disadvantage\nGive them a genuine disadvantage that cannot simply disappear.\nExamples: chronic illness, small stature, injury-prone body, lack of formal training, lower social class, late entry into an elite institution, trauma-induced limitation, magical deficiency, physical disability.\nThe key: the disadvantage must remain relevant even after they grow stronger. (Violet\'s fragility never truly disappears.)\n\n2. Intelligence as Survival\nThe protagonist wins through observation, preparation, strategy, pattern recognition, emotional intelligence, manipulation when necessary, creativity under pressure.\nThey should often defeat stronger opponents indirectly — poison, traps, psychological warfare, political maneuvering, exploiting arrogance, using terrain/environment.\n\n3. Emotional Core\nCore emotional traits: compassion, loyalty, empathy, protective instincts, fear of losing loved ones, desire to prove themselves, survivor\'s guilt, fear of becoming monstrous.\nThis creates tension: they are forced into increasingly violent worlds while trying not to lose themselves.\n\n4. Defiance\nThe underdog needs moments where they refuse to submit despite overwhelming odds — not because they think they\'ll win, but because their pride refuses surrender, someone weaker needs protection, their moral code demands action, or they\'d rather die than become cowardly. These moments create audience attachment.' },
        { title: 'Character Voice', body: 'Internal Monologue Style\nUse: sharp observations, dry humor, self-awareness, fear hidden beneath sarcasm, constant tactical thinking.\nAvoid: endless self-pity, passive reactions, excessive whining.' },
        { title: 'Visual Design', body: 'Underdog protagonists often visually contrast their environment.\nExamples: smaller silhouette among soldiers, pale/sickly appearance in warrior culture, elegant features in a brutal setting, visible scars/braces/wrappings, a distinctive symbolic trait (silver hair, strange eyes, ritual marks).\nThe goal: make them visually memorable while appearing vulnerable.' },
        { title: 'Fatal Flaw Options', body: 'Choose 1–2 major flaws.\nGood Underdog Flaws: recklessness when loved ones are threatened, refusal to ask for help, self-sacrificial tendencies, stubbornness, emotional avoidance, trust issues, desire to prove themselves, fear of weakness, mercy toward dangerous enemies.' },
        { title: 'The Most Important Rule', body: 'The protagonist cannot become interesting because they become powerful.\nThey become interesting because: they suffer, they adapt, they persist, they remain emotionally human while surviving inhuman circumstances.\nPower is only meaningful if it threatens to change who they are.' },
        { title: 'Quick Build Template', body: 'Name:\nAge:\nEnvironment:\nSocial Status:\nPhysical Limitation:\nPsychological Wound:\nGreatest Fear:\nHidden Strength:\nPublic Reputation:\nCombat Style:\nSurvival Strategy:\nMoral Line They Refuse to Cross:\nPerson They Would Burn The World For:\nSymbolic Trait:\nFatal Flaw:\nCore Internal Conflict:\nExternal Goal:\nEmotional Need:\nWhat Makes Them Dangerous:\nWhat Makes Readers Root For Them:' }
      ]
    },
    {
      name: 'The Dangerous Love Interest',
      description: 'Inspired by the "dangerous protector with hidden softness" archetype (Xaden Riorson, Fourth Wing) — feared by everyone except the one person he lets in.',
      fields: {
        role: 'Love Interest — Dangerous Protector',
        personality: 'Ruthless and untouchable on the outside; loyal, exhausted, and quietly lonely underneath.',
        motivations: 'Protect the people (or person) he\'s claimed, whatever the cost to himself.',
        goals: 'Keep control of everything and everyone around him so no one else he loves gets taken from him.',
        strengths: 'Overwhelming competence — combat, strategy, leadership, reading people; makes difficult things look effortless.',
        weaknesses: 'Emotional repression, self-sacrificial to a fault, terrified that attachment is what gets people killed.',
        fear: 'That loving someone openly will get them killed — or reveal how much he needs them.',
        internalConflict: 'Wants peace and connection but was raised to believe love is a liability.',
        externalConflict: 'A reputation as a monster/weapon that he never bothers to correct, even when it costs him.',
        arc: 'From controlled and untouchable to devastatingly gentle with exactly one person, without ever fully losing his edge.',
        voice: 'Short sentences, dry humor, controlled intensity — rare emotional admissions that land hard because they\'re so rare.',
        secrets: 'The rumors about him are only partly true — he never corrects the rest.',
        trauma: 'Learned early that love leads to loss; responsibility was forced on him before he was ready.',
        appearance: '"Beautiful enough to be dangerous" — dark clothing, scars, sharp features, predatory stillness.',
        backstory: 'A war, betrayal, or forced leadership that taught him survival requires emotional suppression.'
      },
      sections: [
        { title: 'Core Archetype', body: 'A male love interest template inspired by Fourth Wing character Xaden Riorson — built around the "dangerous protector with hidden softness" archetype.\n\n"The man everyone fears… who becomes devastatingly gentle with only one person."\n\nThis character is: powerful, emotionally guarded, highly competent, morally gray, dangerous to everyone except the protagonist.\nBut underneath: he carries enormous guilt, he protects people through sacrifice, he secretly wants peace more than violence, love terrifies him because attachment creates weakness.' },
        { title: 'The Core Fantasy', body: 'The appeal of this archetype comes from contradiction.\n\nExternal Persona → Internal Reality\n- Ruthless → Deeply loyal\n- Emotionally cold → Feels everything intensely\n- Feared leader → Exhausted protector\n- Violent → Selectively gentle\n- Untouchable → Secretly lonely\n- In control → One emotional trigger away from collapse' },
        { title: 'Character Foundation — Public Reputation', body: 'The world sees him as: a monster, a weapon, a killer, a war hero, untouchable, dangerous, morally corrupt, the last person anyone should trust.\n\nRumors about him should circulate constantly, e.g.:\n- "He killed someone during initiation."\n- "He\'s never lost a fight."\n- "He executes traitors personally."\n- "He enjoys violence."\n- "He\'s incapable of love."\nSome rumors are true. Some are exaggerated. He never corrects them.' },
        { title: 'Essential Traits', body: '1. Competence\nThis archetype must feel overwhelmingly capable — combat, strategy, leadership, reading people, manipulation, survival, crisis management. The key: he makes difficult things look effortless. Competence creates attraction before romance even begins.\n\n2. Emotional Restraint\nHe rarely shows vulnerability openly. Emotion leaks through actions — protection replaces confession, sacrifice replaces vulnerability, physical closeness replaces emotional honesty.\nExamples: standing guard outside her door, quietly patching wounds, remembering tiny details, watching exits automatically, positioning himself between danger and others.\n\n3. Controlled Violence\nViolence is part of his identity, but he uses it surgically and never loses control publicly. His rage becomes frightening because it is usually restrained. Important: he should feel dangerous even when calm.\n\n4. Buried Softness\nThe softness must exist beneath layers of discipline. Soft moments should feel rare and earned — dry humor, protective gestures, quiet intimacy, exhaustion slipping through, unexpected tenderness, gentle physical contact, revealing personal rituals or scars. This contrast is the emotional payoff.' },
        { title: 'The Traumatized Protector Formula', body: 'This archetype works best when he learned early that love leads to loss, responsibility was forced onto him too young, and survival required emotional suppression.\nCommon backstory elements: failed rebellion, war orphan, betrayal, political hostage, dead family, forced leadership, childhood violence, burden of protecting others.' },
        { title: 'The "Only Soft For Them" Dynamic', body: 'This is the emotional center of the archetype.\nEveryone else gets: coldness, discipline, intimidation, distance.\nThe protagonist gets: patience, honesty, protection, vulnerability, emotional attention.\nThe shift should happen gradually.' },
        { title: 'Relationship Dynamics', body: 'With the Underdog Protagonist\nThe love interest initially underestimates them, or becomes fascinated immediately. Then realizes: they are emotionally dangerous to him, he cares too much, their survival affects his decisions. This terrifies him.\n\nWhy He Falls In Love\nHe doesn\'t fall for beauty alone. He falls because the protagonist challenges him, sees through him, refuses to fear him, makes him want to become better, survives despite impossible odds, understands loneliness, treats him like a human instead of a weapon.' },
        { title: 'Visual Design', body: 'The visual goal: "Beautiful enough to be dangerous."\nCommon design elements: dark clothing, scars, tattoos/relics/marks, large silhouette, sharp features, intense eye contact, predatory stillness, elegant violence, black leather / military aesthetic, a distinct symbolic weapon.\nXaden\'s visual identity emphasizes shadows, scars, dark clothing, and lethal composure.' },
        { title: 'Character Voice', body: 'Dialogue Style\nUse: short sentences, dry humor, controlled intensity, teasing dominance, strategic honesty, rare emotional admissions.\nExamples of tone: "Careful." / "You\'re staring." / "That\'s a terrible idea." / "Stay behind me." / "You\'re safer with me." / "I said I\'d protect you."' },
        { title: 'The Mask vs. The Real Person', body: 'The Mask (what people see): ruthless, unfeeling, cold, arrogant, violent.\nThe Real Person (what the protagonist slowly discovers): exhausted, lonely, loyal to a fault, secretly compassionate, terrified of failure, self-sacrificial.\nThe romance works because the protagonist becomes one of the few people allowed behind the mask.' },
        { title: 'The Moral Grayness', body: 'This archetype should not be morally clean. He should lie when necessary, kill without hesitation, manipulate strategically, break rules, commit morally questionable acts for survival. But he has lines he refuses to cross — his morality is rooted in protection, loyalty, and survival.' },
        { title: 'Fatal Flaws', body: 'Choose 2–3: emotional repression, self-sacrificial behavior, obsessive protectiveness, trust issues, ruthlessness, martyr complex, belief he is unlovable, difficulty communicating, extreme independence, anger issues hidden beneath composure, need for control.' },
        { title: 'The Secret Wound', body: 'Every version of this archetype needs a deep internal wound. Examples:\n- "Everyone I love dies."\n- "I am becoming the monster I hate."\n- "My usefulness is the only reason people keep me."\n- "If people truly knew me, they\'d fear me."\n- "I was raised to be a weapon, not a person."\nThis wound should drive most of his choices.' },
        { title: 'The Power Dynamic', body: 'The relationship becomes compelling when the protagonist emotionally destabilizes him, he physically protects them, and they emotionally humanize him — both save each other differently.\nHe protects their body. They protect his soul.' },
        { title: 'The Most Important Rule', body: 'The character should not just be "hot because he\'s dangerous." He becomes compelling because he carries unbearable responsibility, hides pain behind control, love forces him to become emotionally vulnerable, and the protagonist makes him want to live instead of merely survive.' },
        { title: 'Quick Build Template', body: 'Name:\nAge:\nPublic Reputation:\nLeadership Position:\nCombat Specialty:\nSignature Weapon:\nDistinct Physical Trait:\nHidden Vulnerability:\nGreatest Fear:\nCore Trauma:\nWhat He Protects At All Costs:\nLove Language:\nEmotional Weakness:\nFatal Flaws:\nSecret Soft Spot:\nMoral Line He Won\'t Cross:\nWhat Makes Him Dangerous:\nWhat Makes Readers Fall In Love With Him:\nWhat Makes Him Terrifying:' }
      ]
    },
    {
      name: 'The Antagonist — Misguided Protector',
      description: 'Inspired by Dain Aetos — a morally rigid, system-loyal antagonist who hurts the protagonist by loving them incorrectly, not by hating them.',
      fields: {
        role: 'Antagonist — Misguided Protector',
        personality: 'Disciplined, dependable, rule-bound — genuinely convinced they know what\'s best for the protagonist.',
        motivations: 'Keep the protagonist (and the world) safe by keeping them controlled, protected, and inside the rules.',
        goals: 'Maintain order and protect the people they love, even if it means overriding those people\'s choices.',
        strengths: 'Discipline, leadership, social trust — respected by authority figures for following the system without hesitation.',
        weaknesses: 'Cannot accept the protagonist\'s growth; mistakes control for love.',
        fear: 'Chaos — losing people, losing control, being powerless to stop disaster.',
        internalConflict: 'Genuinely loves the protagonist but is loyal to systems over people when the two conflict.',
        externalConflict: 'The protagonist keeps outgrowing the protection the antagonist insists on giving them.',
        arc: 'Either admits they were wrong and chooses the protagonist over the system (redemption), or doubles down and becomes what they feared (tragic fall).',
        voice: 'Controlled, rational, protectively worded — dangerous because they always sound reasonable.',
        trauma: 'A childhood built on conditional love and pressure to perform, where usefulness became identity.',
        beliefs: 'Rules and order are the only things standing between the world and catastrophe.',
        backstory: 'Once the protagonist\'s emotional safe place — a friendship built long before it curdled into control.'
      },
      sections: [
        { title: 'Core Archetype', body: 'A morally complex antagonist template inspired by Dain Aetos — built around control, loyalty to systems, emotional intimacy with the protagonist, and the tragedy of becoming the obstacle instead of the protector.\n\n"The person who genuinely believes they are protecting the protagonist… while slowly destroying their trust, freedom, and identity."\n\nThis antagonist is not: pure evil, sadistic, chaotic, power-hungry in an obvious way.\nInstead, they are: loyal to order, emotionally attached to the protagonist, morally rigid, terrified of losing control, convinced they know what\'s best.\nThe tragedy: they hurt the protagonist because they love them incorrectly.' },
        { title: 'The Core Contradiction', body: 'External Persona → Internal Reality\n- Dependable → Emotionally controlling\n- Protective → Deeply insecure\n- Morally upright → Capable of violating trust\n- Loyal → Loyal to systems over people\n- Caring → Unable to truly listen\n- Safe → Emotionally dangerous' },
        { title: 'The "Misguided Protector" Formula', body: 'This archetype becomes compelling when their intentions are understandable, their methods become unforgivable, and they never fully realize the damage until too late.\nThe audience should constantly feel: "If they had trusted the protagonist instead of controlling them, none of this would\'ve happened."' },
        { title: 'Character Foundation — Public Reputation', body: 'The world sees them as: reliable, disciplined, honorable, responsible, leadership material, a model soldier/student/heir, someone people should trust.\nAuthority figures love them because they follow rules, value stability, obey systems, and make difficult choices without hesitation.\nUnlike chaotic antagonists, this character is socially respected.' },
        { title: 'The Core Fear', body: 'At the center of this archetype is usually fear of chaos.\nExamples: fear of losing people, fear of disorder, fear of rebellion, fear of emotional unpredictability, fear of becoming powerless, fear of failing their duty, fear that love will destroy objectivity.\nThis fear drives their need for control, rules, structure, surveillance, certainty.' },
        { title: 'Essential Traits', body: '1. Genuine Care\nThe audience must believe: "They really do care about the protagonist." Without this, they become a generic antagonist. They should worry constantly, try to protect the protagonist, remember small details, show emotional history, be unable to let go emotionally. The problem: their care becomes suffocating.\n\n2. Moral Rigidity\nThis character believes rules exist for survival, order prevents catastrophe, personal feelings cannot override duty. They often say things like: "There are reasons these rules exist." / "You don\'t understand the bigger picture." / "I\'m trying to protect you." / "You\'re being reckless." / "Someone has to think rationally."\n\n3. Infantilization Of The Protagonist\nThey cannot emotionally accept the protagonist\'s growth. They continue seeing them as fragile, naive, vulnerable, in need of protection — even after the protagonist proves themselves repeatedly. This becomes emotionally infuriating because the antagonist loves an outdated version of the protagonist. (Dain\'s conflict with Violet heavily stems from his inability to stop viewing her as fragile despite her growth and survival.)\n\n4. The "Crossed A Line" Moment\nThis archetype requires one major violation of trust — invading privacy, reporting the protagonist, choosing authority over friendship, revealing secrets, betraying confidence, making decisions for them, sacrificing someone "for the greater good." The key: they justify it completely at first.' },
        { title: 'The System-Loyal Antagonist', body: 'This archetype often represents institutions, tradition, militarism, religion, political order, authority structures.\nThey are dangerous because they genuinely believe the system is morally correct — even when the system is corrupt, the protagonist suffers under it, and innocent people die.' },
        { title: 'The Emotional Tragedy', body: 'This antagonist is strongest when they were once the protagonist\'s emotional safe place, they know the protagonist intimately, and they slowly become emotionally incompatible.\nThe audience mourns who they used to be together. (Dain\'s emotional impact comes largely from being Violet\'s childhood best friend before becoming someone she can no longer fully trust.)' },
        { title: 'The Foil to the Love Interest', body: 'This archetype often exists as a foil.\nThe Antagonist Represents: safety, stability, rules, familiarity, predictability, approved choices.\nThe Love Interest Represents: freedom, risk, emotional truth, growth, rebellion, transformation.\nThe protagonist choosing the love interest symbolizes choosing self-actualization over safety.' },
        { title: 'Relationship Dynamics', body: 'With The Protagonist\nThe antagonist often thinks they know the protagonist best, believes they understand what\'s good for them, becomes frustrated when ignored, feels replaced emotionally, resents losing influence.\nTheir emotional arc becomes: "Why won\'t you trust me anymore?" — without realizing they destroyed trust themselves.' },
        { title: 'The Best Scenes For This Archetype', body: 'Scene Types: emotional arguments disguised as concern; "I\'m doing this for your own good"; rule-versus-morality conflicts; forced betrayals; watching the protagonist choose someone else; discovering they were wrong too late; realizing authority manipulated them; failed attempts at reconciliation; protectiveness becoming possessiveness; quiet regret after irreversible damage.' },
        { title: 'Character Voice', body: 'Dialogue Style\nUse: controlled language, rational explanations, emotional restraint, protective wording, frustrated concern.\nExamples: "Think for one second." / "I\'m trying to keep you alive." / "You\'re acting emotionally." / "This isn\'t about trust." / "You don\'t understand what\'s at stake." / "I did what I had to do."\nTheir tone becomes dangerous because they sound reasonable.' },
        { title: 'Visual Design', body: 'The visual goal: "Trusted authority figure hiding emotional instability."\nCommon elements: clean uniform/clothing, precise grooming, structured silhouette, military/academic aesthetic, controlled posture, warm eyes with tense expressions, subtle signs of exhaustion beneath perfection.\nUnlike chaotic villains, their appearance communicates control.' },
        { title: 'The Secret Wound', body: 'This archetype usually has a foundational wound tied to conditional love, pressure to perform, fear of failure, parental expectations, emotional repression, identity built around usefulness.\nExamples: "If I stop being useful, I become worthless." / "Rules are the only thing keeping the world from collapsing." / "Love makes people weak." / "If I lose control, people die." / "Duty matters more than feelings."' },
        { title: 'Fatal Flaws', body: 'Choose 2–3: need for control, moral rigidity, inability to adapt, emotional repression, fear of uncertainty, blind trust in authority, jealousy, possessiveness disguised as protection, inability to admit wrongdoing, viewing vulnerability as weakness, savior complex.' },
        { title: 'The Fall Or Redemption', body: 'This archetype works best when they eventually face the horrifying realization: "I became part of the thing I thought I was protecting people from." This creates two paths.\n\nRedemption Path: they admit they were wrong, break from authority, choose the protagonist over the system, accept consequences, learn to trust instead of control. (Dain\'s later arc increasingly centers around guilt, shattered faith in authority, and attempts to repair the damage he caused.)\n\nTragic Fall Path: they double down, refuse accountability, become increasingly authoritarian, lose the protagonist permanently, become what they once feared. Most tragic version: they realize the truth too late to fix anything.' },
        { title: 'The Most Important Rule', body: 'This antagonist should make readers feel angry, frustrated, sympathetic, heartbroken — sometimes simultaneously. Because the real emotional pain comes from watching someone who loves the protagonist become incapable of truly seeing them anymore.' },
        { title: 'Quick Build Template', body: 'Name:\nPublic Reputation:\nRelationship To Protagonist:\nPosition Of Authority:\nCore Belief System:\nGreatest Fear:\nWhat They Think They\'re Protecting:\nWhat They\'re Actually Protecting:\nFatal Flaws:\nEmotional Weakness:\nChildhood Wound:\nHow They Control Situations:\nWhat They Cannot Accept About The Protagonist:\nThe Line They Cross:\nHow They Justify It:\nMoment They Realize They Were Wrong:\nRedemption Or Downfall?:\nFinal Relationship With Protagonist:\nMost Painful Thing They Say:\nMost Painful Thing They Realize Too Late:' },
        { title: 'The Emotional Formula', body: 'Why this archetype works: villains who hate the protagonist are predictable. But someone who loves the protagonist while hurting them creates emotional devastation.' }
      ]
    },
    {
      name: 'The Betrayer Best Friend',
      description: 'A once-real friendship that fractures under fear, ideology, jealousy, or duty — the betrayal that hurts because the love was real.',
      fields: {
        role: 'Best Friend — Eventual Betrayer',
        personality: 'Warm, funny, emotionally open — the kind of friend the protagonist never thought to doubt.',
        motivations: 'Depends on the betrayal type chosen: ideology, fear, jealousy, protection, or slow corruption.',
        goals: 'Before the break: stand by the protagonist no matter what. After: justify why they didn\'t.',
        strengths: 'Emotional accessibility and real history with the protagonist — they know exactly how to comfort them, and later, exactly how to hurt them.',
        weaknesses: 'Fear of abandonment, need for validation, or blind loyalty to authority — whichever fuels their eventual breaking point.',
        fear: 'Being left behind, replaced, or proven irrelevant as the protagonist grows beyond them.',
        internalConflict: 'Still loves the protagonist even while betraying them — and knows it.',
        externalConflict: 'A breaking point (ideological, fear-driven, jealous, protective, or corrupting) that outside pressure pushes them past.',
        arc: 'Either seeks forgiveness and redemption, or lets pride keep them from reconciliation even though both still care.',
        voice: 'Before: easy teasing and comforting honesty. After: sharper, more formal — notably, they stop using the protagonist\'s nickname.',
        secrets: 'A resentment or fear they never said out loud until it was too late.',
        backstory: 'A real, earned friendship — inside jokes, shared history, mutual survival — that makes the eventual betrayal feel personal, not villainous.'
      },
      sections: [
        { title: 'Core Archetype', body: 'A best-friend-turned-betrayer template inspired by the emotional role characters like Rhiannon Matthias and Dain Aetos play in The Empyrean series — built around loyalty, emotional intimacy, fractured trust, and devastating ideological conflict.\n\n"The person who knew the protagonist best… and became the one capable of hurting them most."\n\nThis character is not evil. That\'s what makes the betrayal devastating.\nThey are: loyal, loving, protective, deeply bonded to the protagonist.\nBut eventually fear, ideology, jealousy, duty, survival, resentment, or love itself pushes them into betrayal.\nThe audience should think: "I understand why they did it… but it still hurts."' },
        { title: 'The Core Emotional Formula', body: 'The betrayer works because they once represented safety, the protagonist trusted them completely, and their betrayal feels emotionally intimate.\nThis archetype is strongest when the betrayal feels PERSONAL rather than villainous.' },
        { title: 'The Foundation of the Friendship', body: 'Before betrayal, the friendship must feel real. The best friend should defend the protagonist early, help them survive, share secrets, train/study/work together, develop rituals and inside jokes, become emotionally dependable.\nThe reader must genuinely believe: "These two would die for each other."' },
        { title: 'The Core Contradiction', body: 'External Role → Internal Conflict\n- Loyal friend → Growing resentment\n- Supportive ally → Feels abandoned\n- Moral compass → Secretly compromised\n- Protector → Capable of betrayal\n- Trusted confidant → Hiding dangerous truths' },
        { title: 'Types of Betrayal', body: 'Choose the emotional flavor carefully.\n\n1. The Ideological Betrayal — they believe the protagonist is wrong, duty outweighs friendship, the system matters more than personal loyalty. The "I thought I was saving you" betrayal.\n\n2. The Fear Betrayal — they\'re terrified, the consequences feel too large, survival instincts override loyalty. Most realistic version.\n\n3. The Jealousy Betrayal — the protagonist changes while they remain stagnant; they begin feeling left behind, replaced, inferior, invisible. Especially effective when the protagonist gains power/status/romance and the friendship becomes emotionally imbalanced.\n\n4. The Protective Betrayal — they betray because they think "This is the only way to save you." Usually tragic rather than malicious.\n\n5. The Slow Corruption Betrayal — the character gradually changes through power, trauma, manipulation, political pressure, forbidden magic, obsession. The protagonist notices too late.' },
        { title: 'Essential Traits', body: '1. Genuine Loyalty (At First)\nThe betrayal only works if the loyalty was once real. The friendship cannot be fake from the beginning. They should save the protagonist, defend them publicly, know personal vulnerabilities, provide emotional stability. The betrayal hurts because the love was real.\n\n2. Emotional Accessibility\nUnlike colder characters, this archetype is emotionally open — they talk easily, joke often, show affection naturally, express emotion openly, feel approachable and human. This creates contrast with later emotional distance.\n\n3. Moral Conviction\nThe betrayer should believe they are justified. Even at their worst, they rationalize their actions morally, believe the protagonist forced their hand, see themselves as necessary. The audience should occasionally agree with them.\n\n4. Lingering Love\nEven after betrayal, they still care, they hesitate, they regret things, they try to justify themselves, they still know the protagonist intimately. This makes scenes emotionally volatile.' },
        { title: 'The Betrayal Scene', body: 'The betrayal should attack trust, emotional intimacy, vulnerability — not just physical safety.\nThe best betrayal moments include lines like:\n- "I did this for you."\n- "You left me behind."\n- "You stopped trusting me first."\n- "I had no choice."\n- "You were becoming someone I didn\'t recognize."\n- "I still love you."\n- "I thought I was saving everyone."' },
        { title: 'Aftermath of the Betrayal', body: 'The betrayer should not immediately become cartoonishly evil, fully detached, or emotionless. Instead, they still know the protagonist deeply, understand exactly how to hurt them, still care, may want forgiveness, may hate themselves.\nThis creates emotional warfare instead of simple hero-villain conflict.' },
        { title: 'Visual Design', body: 'Before betrayal: warm colors, open posture, relaxed body language, expressive face, casual touch.\nAfter betrayal: sharper silhouette, colder emotional presentation, controlled expressions, more distance physically and emotionally.\nThe visual shift should feel subtle but painful.' },
        { title: 'Character Voice', body: 'Before Betrayal — use humor, familiar teasing, emotional honesty, comforting language, easy rhythm.\nAfter Betrayal — the same voice becomes sharper, controlled, defensive, bitter, formal.\nMost painful technique: they stop using the protagonist\'s nickname.' },
        { title: 'Fatal Flaws', body: 'Choose 2–3: fear of abandonment, need for validation, moral rigidity, jealousy, dependency, martyr complex, desire for control, fear of irrelevance, inability to adapt, blind loyalty to authority, emotional impulsiveness.' },
        { title: 'The Secret Wound', body: 'The betrayal should stem from a deeper wound. Examples:\n- "People always leave me."\n- "I\'m never chosen first."\n- "I sacrificed everything and got nothing."\n- "Rules are the only thing keeping the world together."\n- "Without purpose, I\'m nothing."\n- "You outgrew me."' },
        { title: 'Redemption or Tragedy?', body: 'Choose one early.\n\nRedemption Path: betrayal was misguided, they regret it, they seek forgiveness, they sacrifice themselves later. (Dain\'s arc in The Empyrean increasingly moves toward guilt, self-awareness, and attempted redemption after violating Violet\'s trust.)\n\nTragedy Path: they double down, pride prevents reconciliation, they become consumed by ideology/power, the friendship dies permanently.\nMost emotionally devastating version: both still love each other, but reconciliation becomes impossible.' },
        { title: 'The Most Important Rule', body: 'The betrayal must feel emotionally inevitable AND emotionally avoidable.\nThe audience should think: "If they had just talked honestly sooner, this might never have happened." That tension creates obsession-level emotional investment.' },
        { title: 'Quick Build Template', body: 'Name:\nRole In Protagonist\'s Life:\nHow They First Bonded:\nWhat Makes The Friendship Special:\nCore Personality:\nGreatest Fear:\nFatal Flaws:\nSecret Resentment:\nWhat They Admire About The Protagonist:\nWhat They Envy About The Protagonist:\nBreaking Point:\nNature Of The Betrayal:\nDid They Mean To Hurt The Protagonist?:\nDo They Regret It?:\nRedemption Or Tragedy?:\nFinal Dynamic With Protagonist:\nMost Painful Thing They Say:\nMost Painful Thing They Realize Too Late:' }
      ]
    }
  ];
  // Idempotent — safe to call on every boot. Removes the old three-
  // template starter set (by exact name; anything the user has since
  // renamed is left alone) and adds any of the four archetype templates
  // above that aren't already present by name.
  function ensureDefaultCharacterTemplates() {
    CharacterTemplates.list().filter(function (t) { return OBSOLETE_CHARACTER_TEMPLATE_NAMES.indexOf(t.name) !== -1; }).forEach(function (t) { CharacterTemplates.remove(t.id); });
    var names = CharacterTemplates.list().map(function (t) { return t.name; });
    DEFAULT_CHARACTER_TEMPLATES.forEach(function (def) {
      if (names.indexOf(def.name) === -1) CharacterTemplates.add(Object.assign({ order: nextOrder(CharacterTemplates.list()) }, def));
    });
  }
  // ---------- Default Plot Templates (General/Romance Plot starter skeletons) ----------
  var DEFAULT_PLOT_TEMPLATES = [
    {
      name: 'Rebellion Arc — General Plot', kind: 'general',
      description: 'A reusable skeleton for a political/rebellion-driven main plot — apply it to any book\'s General Plot, then adjust the specifics.',
      points: [
        { title: 'Inciting incident exposes the rot in power', description: '' },
        { title: 'Protagonist refuses the call, then is forced into it', description: '' },
        { title: 'First real victory — and its cost', description: '' },
        { title: 'Midpoint betrayal or reveal reshapes the stakes', description: '' },
        { title: 'All is lost — the plan collapses', description: '' },
        { title: 'Final confrontation with the true source of power', description: '' }
      ]
    },
    {
      name: 'Slow Burn — Romance Plot', kind: 'romance',
      description: 'A reusable romance-beat skeleton — apply it to any book\'s Romance Plot, then adjust the specifics.',
      points: [
        { title: 'Antagonistic or wary first meeting', description: '' },
        { title: 'Forced proximity builds reluctant respect', description: '' },
        { title: 'First crack in the wall — a moment of real honesty', description: '' },
        { title: 'Growing tension neither of them will name out loud', description: '' },
        { title: 'Betrayal or misunderstanding threatens the bond', description: '' },
        { title: 'Full emotional confession and commitment', description: '' }
      ]
    }
  ];
  // Idempotent — safe to call on every boot. Adds any default plot
  // template not already present by name; never touches existing ones.
  function ensureDefaultPlotTemplates() {
    var names = PlotTemplates.list().map(function (t) { return t.name; });
    DEFAULT_PLOT_TEMPLATES.forEach(function (def) {
      if (names.indexOf(def.name) === -1) PlotTemplates.add(Object.assign({ order: nextOrder(PlotTemplates.list()) }, def));
    });
  }
  function seedIfEmpty() {
    if (!isEmptyEverywhere()) return;
    storeSet(KEYS.seeded, true);
    const s1 = Series.add({ title: 'The Ashen Crown', genre: 'Fantasy', status: 'drafting', description: 'A dethroned princess and a reformed assassin race to reclaim a shattered kingdom before its dying god wakes.', order: 0 });
    const s2 = Series.add({ title: 'Hollow Signal', genre: 'Horror', status: 'planning', description: 'A radio station in a dying mining town keeps broadcasting a show that was cancelled forty years ago.', order: 1 });

    const b1 = Books.add({ seriesId: s1.id, title: 'Book One: The Ashen Crown', pov: 'Third Limited', status: 'drafting', targetWordCount: 95000, currentChapter: 1, order: 0, mood: 'Grim, defiant, occasionally tender', theme: 'What we owe the crowns we never asked for' });
    Books.add({ seriesId: s1.id, title: 'Book Two: The Salt Regent', pov: 'Third Limited', status: 'outlining', targetWordCount: 95000, order: 1 });
    Books.add({ seriesId: s2.id, title: 'Hollow Signal', pov: 'First Person', status: 'outlining', targetWordCount: 80000, order: 0 });

    const actI = Acts.add({ bookId: b1.id, title: 'Act I', order: 0 });
    const actII = Acts.add({ bookId: b1.id, title: 'Act II', order: 1 });
    Acts.add({ bookId: b1.id, title: 'Act III', order: 2 });
    const ch1 = Chapters.add({ bookId: b1.id, actId: actI.id, title: 'Chapter 1: Ash on the Water', order: 0, status: 'final', pov: 'Wren', content: 'The last of the royal fleet burned on the horizon, and Wren watched it from the servants\' stair, counting masts the way her mother had taught her to count sheep — one for grief, two for anger, three for the plan that hadn\'t come yet.\n\nShe had four hundred words of that plan and no ending.', summary: 'Wren watches the royal fleet burn and resolves to reclaim the crown.', wordGoal: 2500 });
    Chapters.add({ bookId: b1.id, actId: actI.id, title: 'Chapter 2: A Blade for Hire', order: 1, status: 'drafting', pov: 'Kael', content: 'Kael had sworn off crowns the way other men swore off drink — loudly, publicly, and with every intention of breaking that promise the moment it was profitable.', summary: 'Introduce Kael, hired to kill the princess he ends up protecting.', wordGoal: 2500 });
    Chapters.add({ bookId: b1.id, actId: actII.id, title: 'Chapter 9: The Ember Court', order: 2, status: 'outline', summary: 'Wren and Kael infiltrate the Ember Court disguised as tribute-bearers.', wordGoal: 3000 });

    const wren = Characters.add({ seriesId: s1.id, name: 'Wren Ashmark', aliases: 'The Cinder Princess', age: '22', species: 'Human', occupation: 'Deposed Princess', role: 'Protagonist', status: 'Alive', personality: 'Controlled on the outside, furious underneath. Plans three moves ahead and hates that she has to.', motivations: 'Reclaim the crown to protect the people her family failed.', goals: 'Unite the fractured houses under a single banner before the dying god wakes.', strengths: 'Strategic, disciplined, quietly charismatic.', weaknesses: 'Struggles to trust anyone who wasn\'t staff in the palace.', fear: 'Becoming the kind of ruler her father was.', internalConflict: 'Wants to be loved as a person, not obeyed as a crown.', externalConflict: 'Every house that could help her also wants her dead.', arc: 'From a girl following her mother\'s rules to a ruler who writes her own.', voice: 'Formal in public, dry and sharp in private.', appearance: 'Ash-grey eyes, a burn scar along one forearm she keeps covered.', backstory: 'Escaped the palace the night it fell, hidden by a servant who died getting her out.', quotes: ['"I have counted every mast on that horizon. I intend to make them count me back."'], bookIds: [b1.id], order: 0 });
    const kael = Characters.add({ seriesId: s1.id, name: 'Kael Vantry', aliases: 'The Reformed Blade', age: '29', species: 'Human', occupation: 'Former Royal Assassin', role: 'Deuteragonist / Love Interest', status: 'Alive', personality: 'Charming as armor. Funnier the more scared he actually is.', motivations: 'Atone for the crowns he\'s already helped topple.', arc: 'From a man who kills kings for coin to one who dies, if it comes to it, protecting one.', appearance: 'A scar through one eyebrow from the job that made him quit.', quotes: ['"I was hired to end a princess. Turns out I\'m better at the opposite work."'], bookIds: [b1.id], order: 1, relationships: [{ targetId: wren.id, type: 'romantic', notes: 'Slow-burn — starts as employer/hired blade, becomes something neither of them planned.' }] });
    Characters.update(wren.id, { relationships: [{ targetId: kael.id, type: 'romantic', notes: 'She does not trust him for the first third of the book, on purpose.' }] });

    const kingdomPage = WikiPages.add({ seriesId: s1.id, category: 'kingdoms', title: 'The Ashmark Crown', summary: 'The fallen royal house Wren is trying to reclaim.', tags: ['royalty', 'central-conflict'], order: 0 });
    ensureDefaultWikiSections(kingdomPage.id);
    Sections.update(sectionsFor('wikipage', kingdomPage.id)[0].id, { body: 'Ruled by the Ashmark line for eleven generations, until the Ember Court burned the palace and scattered the royal fleet.' });
    const magicPage = WikiPages.add({ seriesId: s1.id, category: 'magic-systems', title: 'Ashbinding', summary: 'The dying magic that ties the royal bloodline to the sleeping god beneath the capital.', tags: ['magic', 'central-conflict'], order: 1 });
    ensureDefaultWikiSections(magicPage.id);

    Beats.replaceAll(STRUCTURE_TEMPLATES['three-act'].beats.map(function (bt, i) {
      return beatModel({ bookId: b1.id, template: 'three-act', beatKey: bt.key, beatName: bt.name, description: bt.desc, order: i, linkedChapterId: i === 0 ? ch1.id : null, status: i === 0 ? 'done' : 'not-started' });
    }));
    Trackers.add({ bookId: b1.id, type: 'foreshadowing', title: 'The burn scar on Wren\'s arm', description: 'Planted in Ch.1 — pays off in Act III when we learn how she really got it.', status: 'planted', linkedChapterId: ch1.id, order: 0 });
    Trackers.add({ bookId: b1.id, type: 'mystery', title: 'Who tipped off the Ember Court', description: 'Someone inside the palace warned them the night it fell.', status: 'open', order: 1 });

    TimelineEvents.add({ seriesId: s1.id, title: 'The Fall of the Ashmark Palace', date: 'Year 0, Ember Season', description: 'The Ember Court burns the royal fleet and scatters the royal line.', linkedCharacterIds: [wren.id], order: 0 });

    QuickCaptures.add({ seriesId: s1.id, type: 'plot-twist', text: 'What if the servant who saved Wren was working for the Ember Court all along — and regrets it?', order: 0 });
    QuickCaptures.add({ seriesId: null, type: 'inspiration', text: 'A magic system where spells get weaker every time they\'re repeated with the same words — forces improvisation.', order: 1 });
    QuickCaptures.add({ seriesId: s2.id, type: 'scene-idea', text: 'Open on the radio host reading tonight\'s script and realizing it\'s word-for-word the script from the night the station "went dark."', order: 2 });

    Documents.add({ seriesId: s1.id, kind: 'book-bible', title: 'Ashen Crown Series Bible', notes: 'Master reference doc for names, timeline, and magic rules.', order: 0 });
    Documents.add({ seriesId: null, kind: 'writing-guide', title: 'Personal Style Guide', notes: 'Oxford commas, em dashes not en dashes, no adverb-heavy dialogue tags.', order: 1 });

    WritingSessions.add({ bookId: b1.id, seriesId: s1.id, date: isoDaysAgo(1), words: 1180, minutes: 62 });
    WritingSessions.add({ bookId: b1.id, seriesId: s1.id, date: isoDaysAgo(2), words: 940, minutes: 48 });
    WritingSessions.add({ bookId: b1.id, seriesId: s1.id, date: isoDaysAgo(3), words: 1500, minutes: 70 });
    WritingSessions.add({ bookId: b1.id, seriesId: s1.id, date: isoDaysAgo(4), words: 0, minutes: 0 });
    WritingSessions.add({ bookId: b1.id, seriesId: s1.id, date: isoDaysAgo(5), words: 820, minutes: 40 });

    Books.update(b1.id, { currentChapterId: ch1.id });

    ActChapterTemplates.add({
      name: 'Three-Act Novel — 9 Chapters', order: 0,
      description: 'A reusable starting skeleton: three acts, three chapters each, with typical word goals — apply it to any manuscript, in any series, then rename the chapters as you outline.',
      acts: [
        { title: 'Act I — Setup', chapters: [{ title: 'Chapter 1', wordGoal: 2500 }, { title: 'Chapter 2', wordGoal: 2500 }, { title: 'Chapter 3', wordGoal: 2500 }] },
        { title: 'Act II — Confrontation', chapters: [{ title: 'Chapter 4', wordGoal: 3000 }, { title: 'Chapter 5', wordGoal: 3000 }, { title: 'Chapter 6', wordGoal: 3000 }] },
        { title: 'Act III — Resolution', chapters: [{ title: 'Chapter 7', wordGoal: 2500 }, { title: 'Chapter 8', wordGoal: 2500 }, { title: 'Chapter 9', wordGoal: 3000 }] }
      ]
    });

    ensureDefaultCharacterTemplates();

    WikiTemplates.add({
      name: 'Fantasy Kingdom', order: 0, category: 'kingdoms',
      description: 'A starting structure for a ruled territory — apply it, then fill in the specifics.',
      summary: 'A kingdom or realm with its own ruler, culture, and conflicts.', tags: ['kingdom'],
      sectionTitles: ['Ruler & Government', 'Geography & Borders', 'Culture & People', 'Military Strength', 'History', 'Current Conflicts']
    });
    WikiTemplates.add({
      name: 'Magic System', order: 1, category: 'magic-systems',
      description: 'A starting structure for a new source of magic in your world.',
      summary: 'A distinct magic system with its own rules and costs.', tags: ['magic'],
      sectionTitles: ['Source of Power', 'Rules & Limitations', 'Cost & Consequences', 'Who Can Use It', 'Famous Practitioners', 'History & Origins']
    });
    WikiTemplates.add({
      name: 'Deity / God', order: 2, category: 'gods',
      description: 'A starting structure for a god, deity, or divine figure.',
      summary: 'A deity worshipped or feared within this world.', tags: ['deity'],
      sectionTitles: ['Domain & Portfolio', 'Worshippers & Clergy', 'Symbols & Iconography', 'Known Interventions', 'Relationship to Other Gods']
    });

    PlotPoints.add({ bookId: b1.id, kind: 'general', title: 'The Ember Court\'s true target', description: 'What the Ember Court is actually after isn\'t the throne — it\'s the sleeping god beneath it.', status: 'planted', order: 0 });
    PlotPoints.add({ bookId: b1.id, kind: 'general', title: 'Wren reclaims a fractured house', description: 'The first house to swear back to Wren, setting up the alliance she\'ll need for Act III.', status: 'planned', order: 1 });
    PlotPoints.add({ bookId: b1.id, kind: 'romance', title: 'Wren stops flinching when Kael stands close', description: 'A small, physical beat marking the shift from wary employer to something else.', status: 'planned', order: 0, linkedChapterId: ch1.id });
    PlotPoints.add({ bookId: b1.id, kind: 'romance', title: 'Kael turns down a contract to kill her', description: 'The moment his loyalty stops being about the coin.', status: 'planned', order: 1 });

    ensureDefaultPlotTemplates();
  }
  function resetToDefault() {
    [Series, Books, Acts, Chapters, Scenes, Characters, WikiPages, TimelineEvents, Beats, Trackers, ConsistencyChecks, Publishing, Sections, MindMapNodes, QuickCaptures, Documents, WritingSessions, ActChapterTemplates, CharacterTemplates, WikiTemplates, PlotPoints, PlotTemplates, CompositionPresets].forEach(function (c) { c.replaceAll([]); });
    storeSet(KEYS.hero, null);
    seedIfEmpty();
  }

  global.WritingDashboardData = {
    KEYS: KEYS,
    uid: uid, todayISO: todayISO, isoDaysAgo: isoDaysAgo, isoDaysFromNow: isoDaysFromNow,
    compressImageDataUrl: compressImageDataUrl, isValidMediaUrl: isValidMediaUrl, escapeHtml: escapeHtml, wordCount: wordCount, readingMinutes: readingMinutes,
    GENRES: GENRES, SERIES_STATUSES: SERIES_STATUSES, SERIES_STATUS_LABELS: SERIES_STATUS_LABELS,
    BOOK_STATUSES: BOOK_STATUSES, BOOK_STATUS_LABELS: BOOK_STATUS_LABELS,
    CHAPTER_STATUSES: CHAPTER_STATUSES, CHAPTER_STATUS_LABELS: CHAPTER_STATUS_LABELS,
    SCENE_STATUSES: SCENE_STATUSES, REVISION_STATUSES: REVISION_STATUSES, REVISION_STATUS_LABELS: REVISION_STATUS_LABELS, POVS: POVS,
    COMPOSITION_BG_CATEGORIES: COMPOSITION_BG_CATEGORIES, COMPOSITION_BACKGROUND_LIBRARY: COMPOSITION_BACKGROUND_LIBRARY,
    COMPOSITION_AMBIENT_LIBRARY: COMPOSITION_AMBIENT_LIBRARY, COMPOSITION_FONTS: COMPOSITION_FONTS, COMPOSITION_PARTICLE_TYPES: COMPOSITION_PARTICLE_TYPES,
    RELATIONSHIP_TYPES: RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS: RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_COLORS: RELATIONSHIP_COLORS,
    QUICK_CAPTURE_TYPES: QUICK_CAPTURE_TYPES, QUICK_CAPTURE_META: QUICK_CAPTURE_META,
    DOCUMENT_KINDS: DOCUMENT_KINDS, DOCUMENT_KIND_LABELS: DOCUMENT_KIND_LABELS,
    CONSISTENCY_CATEGORIES: CONSISTENCY_CATEGORIES, CONSISTENCY_LABELS: CONSISTENCY_LABELS,
    TRACKER_TYPES: TRACKER_TYPES, TRACKER_TYPE_LABELS: TRACKER_TYPE_LABELS, TRACKER_STATUSES: TRACKER_STATUSES,
    PLOT_KINDS: PLOT_KINDS, PLOT_KIND_LABELS: PLOT_KIND_LABELS, PLOT_STATUSES: PLOT_STATUSES, PLOT_STATUS_LABELS: PLOT_STATUS_LABELS,
    PUBLISH_STATUSES: PUBLISH_STATUSES, PUBLISH_STATUS_LABELS: PUBLISH_STATUS_LABELS,
    STRUCTURE_TEMPLATES: STRUCTURE_TEMPLATES,
    WIKI_CATEGORIES: WIKI_CATEGORIES, WIKI_CATEGORY_IDS: WIKI_CATEGORY_IDS, wikiCategoryMeta: wikiCategoryMeta, wikiCategoryGroups: wikiCategoryGroups, defaultSectionTitlesFor: defaultSectionTitlesFor,
    PROMPT_LIBRARY: PROMPT_LIBRARY,
    Series: Series, Books: Books, Acts: Acts, Chapters: Chapters, Scenes: Scenes, Characters: Characters,
    WikiPages: WikiPages, TimelineEvents: TimelineEvents, Beats: Beats, Trackers: Trackers,
    ConsistencyChecks: ConsistencyChecks, Publishing: Publishing, Sections: Sections, MindMapNodes: MindMapNodes,
    QuickCaptures: QuickCaptures, Documents: Documents, WritingSessions: WritingSessions,
    ActChapterTemplates: ActChapterTemplates, CharacterTemplates: CharacterTemplates, WikiTemplates: WikiTemplates, PlotPoints: PlotPoints, PlotTemplates: PlotTemplates,
    CompositionPresets: CompositionPresets, compositionPresetModel: compositionPresetModel,
    nextOrder: nextOrder, reorderCollection: reorderCollection,
    seriesSorted: seriesSorted, seriesArchived: seriesArchived, booksForSeries: booksForSeries,
    actsForBook: actsForBook, chaptersForBook: chaptersForBook, chaptersForAct: chaptersForAct, scenesForChapter: scenesForChapter,
    actChapterTemplatesSorted: actChapterTemplatesSorted, captureActChapterTemplateFromBook: captureActChapterTemplateFromBook, applyActChapterTemplate: applyActChapterTemplate,
    applyStructureTemplate: applyStructureTemplate,
    characterTemplatesSorted: characterTemplatesSorted, captureCharacterTemplateFromCharacter: captureCharacterTemplateFromCharacter, applyCharacterTemplate: applyCharacterTemplate,
    wikiTemplatesSorted: wikiTemplatesSorted, captureWikiTemplateFromPage: captureWikiTemplateFromPage, applyWikiTemplate: applyWikiTemplate,
    plotTemplatesSorted: plotTemplatesSorted, capturePlotTemplateFromBook: capturePlotTemplateFromBook, applyPlotTemplate: applyPlotTemplate,
    charactersForSeries: charactersForSeries, wikiPagesForSeries: wikiPagesForSeries, wikiPagesForCategory: wikiPagesForCategory,
    timelineForSeries: timelineForSeries, beatsForBook: beatsForBook, trackersForBook: trackersForBook,
    plotPointsForBook: plotPointsForBook, plotPointsForSeries: plotPointsForSeries, trackersForSeries: trackersForSeries,
    consistencyChecksForBook: consistencyChecksForBook, publishingForBook: publishingForBook,
    sectionsFor: sectionsFor, addSection: addSection, moveSection: moveSection, ensureDefaultWikiSections: ensureDefaultWikiSections,
    parseLabelBlock: parseLabelBlock, LABEL_LINK_VOCAB: LABEL_LINK_VOCAB, resolveLabelLink: resolveLabelLink,
    CHARACTER_LABEL_FIELD_MAP: CHARACTER_LABEL_FIELD_MAP, CHARACTER_PROFILE_LABELS: CHARACTER_PROFILE_LABELS,
    buildBlankCharacterProfileText: buildBlankCharacterProfileText, applyParsedLabelsToCharacter: applyParsedLabelsToCharacter,
    WIKI_PROFILE_SHAPES: WIKI_PROFILE_SHAPES, WIKI_SHAPE_LABELS: WIKI_SHAPE_LABELS, wikiShapeForCategory: wikiShapeForCategory,
    WIKI_LABEL_FIELD_MAP: WIKI_LABEL_FIELD_MAP, buildBlankWikiProfileText: buildBlankWikiProfileText, applyParsedLabelsToWikiPage: applyParsedLabelsToWikiPage,
    quickCapturesFor: quickCapturesFor, documentsFor: documentsFor, writingSessionsForBook: writingSessionsForBook, writingSessionsForSeries: writingSessionsForSeries,
    bookWordCount: bookWordCount, seriesWordCount: seriesWordCount, totalWordCount: totalWordCount, totalYearlyWords: totalYearlyWords,
    wordsOnDate: wordsOnDate, wordsInLastNDays: wordsInLastNDays, currentWritingStreak: currentWritingStreak,
    booksInProgressCount: booksInProgressCount, booksPublishedCount: booksPublishedCount,
    avgChapterLength: avgChapterLength, avgSceneLength: avgSceneLength, writingHeatmap: writingHeatmap, mostProductiveDays: mostProductiveDays, averageSessionMinutes: averageSessionMinutes,
    logWritingProgress: logWritingProgress,
    buildRelationshipGraph: buildRelationshipGraph,
    mindMapNodesForScope: mindMapNodesForScope, ensureMindMapRoot: ensureMindMapRoot, addMindMapBranch: addMindMapBranch, removeMindMapNodeCascade: removeMindMapNodeCascade, computeMindMapLayout: computeMindMapLayout,
    computeConsistencySuggestions: computeConsistencySuggestions,
    getSettings: getSettings, saveSettings: saveSettings, callAnthropic: callAnthropic, aiReviewBook: aiReviewBook,
    removeSeries: removeSeries, removeBook: removeBook, removeChapter: removeChapter, removeCharacter: removeCharacter, removeWikiPage: removeWikiPage,
    getHero: function () { return heroModel(storeGet(KEYS.hero)); },
    saveHero: function (patch) { const next = heroModel(Object.assign({}, heroModel(storeGet(KEYS.hero)), patch)); storeSet(KEYS.hero, next); return next; },
    isEmptyEverywhere: isEmptyEverywhere, seedIfEmpty: seedIfEmpty, resetToDefault: resetToDefault,
    ensureDefaultCharacterTemplates: ensureDefaultCharacterTemplates, ensureDefaultPlotTemplates: ensureDefaultPlotTemplates
  };
})(window);
