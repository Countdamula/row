// =============================================================
// selfcare-ui.js — Main's Self-Care tab.
//
// LIFTED VERBATIM out of index.html's inline script on 2026-08-22,
// when Main was rebuilt around Today and the four other tabs were
// removed. Not one line of the renderer below the helpers changed:
// the instruction was "keep the Self-Care page intact", and the only
// safe reading of that is a byte-for-byte move plus a restyle in CSS.
//
// It is a classic script, not a module, so its top-level `let`s land
// in the same global lexical environment they were already in and
// index.html's own boot code still sees them. Load order therefore
// matters: this must come before the inline boot script.
//
// WHAT IT DEPENDS ON
//   window.MainSelfCareData   mainselfcare-data.js  (prefix `mainselfcare:`)
//   window.PhotoStore         photo-store.js        (cover uploads)
//   switchMainTab()           index.html            (the Ritual cross-links)
//   $(), escapeHtml(), compressImageDataUrl()  — the three shared
//     helpers it used from the old inline script, carried here
//     unchanged so nothing else has to be.
//
// Its own styling lives in main-theme.css under the ORIGINAL `.bs-*`
// / `.sci-*` class names — see that file's "THE INHERITED SURFACE"
// section for why they were restyled in place rather than renamed.
// =============================================================

// ---- the three shared helpers, carried over unchanged ----------
function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// The renderer below still calls switchMainTab() and reads
// activeMainTab — both lived in the old inline script, which is gone.
// Rather than edit the renderer (the instruction was to keep Self-Care
// intact), the two names are re-provided here against the new tabs.
function switchMainTab(tab) {
  if (window.TodayUI) window.TodayUI.switchTab(tab);
}
function selfCareTabIsOpen() {
  var p = document.querySelector('.mn-tabpanel[data-mainpanel="selfcare"]');
  return !!(p && p.classList.contains('active'));
}

/**
 * Downscale and re-encode a data URL before it is stored or uploaded.
 * A raw phone photo is several megabytes of base64, and sync.js
 * re-uploads a row's whole data column on every debounced save.
 */
function compressImageDataUrl(dataUrl, maxDim, quality) {
  return new Promise(function (resolve) {
    try {
      const img = new Image();
      img.onload = function () {
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.82));
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
}

// ============================================================
// SELF-CARE (5th main tab) — a native, dedicated self-care system inside
// Main. Separate data/collections from the standalone selfcare.html page
// of the same name (see CLAUDE.md) — nothing here reads or writes
// selfcare.html's own `selfcare:` data.
// ============================================================
let MSC = null;
let activeSciTab = 'checklist';
let editingSciMedId = null, editingSciBrwId = null;
let sciMedCurrentCover = '', sciMedTitleManuallyEdited = false;
let sciPacer = { technique: null, phases: [], phaseIdx: 0, phaseStart: 0, cycle: 1, timer: null, running: false };

// -------- link preview auto-fetch — same YouTube/Spotify oEmbed
// technique entertainment.html's Media tab already uses, ported here so
// pasting a meditation's video link auto-fills its title and cover
// thumbnail the same way. --------
function detectSciMedSource(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'youtube';
    if (h.endsWith('spotify.com')) return 'spotify';
  } catch (e) {}
  return null;
}
function getSciMedYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.indexOf('youtube.com') !== -1) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch (e) {}
  return null;
}
async function fetchSciMedPreview(url, source) {
  const result = { title: '', thumbnail: '' };
  if (source === 'youtube') {
    const id = getSciMedYouTubeId(url);
    if (id) result.thumbnail = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
    try {
      const res = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');
      if (res.ok) {
        const data = await res.json();
        if (data.title) result.title = data.title;
        if (data.thumbnail_url) result.thumbnail = data.thumbnail_url;
      }
    } catch (e) {}
    return result;
  }
  if (source === 'spotify') {
    try {
      const res2 = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url));
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.title) result.title = data2.title;
        if (data2.thumbnail_url) result.thumbnail = data2.thumbnail_url;
      }
    } catch (e) {}
    return result;
  }
  return result;
}
function updateSciMedCoverPreview() {
  const img = $('sciMeditationCoverPreview');
  if (!img) return;
  if (sciMedCurrentCover) { img.src = sciMedCurrentCover; img.style.display = 'block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; }
}
async function maybeAutoFetchSciMedPreview() {
  const url = $('sciMeditationUrlInput').value.trim();
  const hint = $('sciMeditationUrlHint');
  if (!url) return;
  const source = detectSciMedSource(url);
  if (!source) {
    hint.textContent = "Doesn't look like a YouTube or Spotify link — you can still save it and set the cover manually.";
    return;
  }
  hint.textContent = 'Fetching preview…';
  const preview = await fetchSciMedPreview(url, source);
  if (!sciMedTitleManuallyEdited && preview.title) $('sciMeditationTitleInput').value = preview.title;
  if (preview.thumbnail) { sciMedCurrentCover = preview.thumbnail; updateSciMedCoverPreview(); }
  hint.textContent = (preview.title || preview.thumbnail)
    ? ''
    : "Couldn't auto-fetch a preview — paste an image URL or upload a cover below.";
}

function switchSciTab(tab) {
  const panels = document.querySelectorAll('[data-mainpanel="selfcare"] .bs-panel');
  const valid = Array.prototype.some.call(panels, function (p) { return p.dataset.scipanel === tab; });
  activeSciTab = valid ? tab : 'checklist';
  document.querySelectorAll('#sciTabsRow .bs-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.scitab === activeSciTab); });
  panels.forEach(function (p) { p.classList.toggle('active', p.dataset.scipanel === activeSciTab); });
  try { localStorage.setItem(MSC.KEYS.activeTab, activeSciTab); } catch (e) {}
  renderSciTabContent();
}
function renderSciTabContent() {
  if (!MSC) return;
  if (activeSciTab === 'checklist') { renderSciTips(); renderSciChecklist(); }
  else if (activeSciTab === 'journal') renderSciJournal();
  else if (activeSciTab === 'meditation') { renderSciMeditations(); renderSciBreathwork(); }
}
function renderAllSelfCarePanels() { renderSciTabContent(); }

// ---------- CHECKLIST ----------
function renderSciChecklist() {
  const box = $('sciChecklistList'); if (!box) return;
  const sorted = MSC.checklistSorted();
  box.innerHTML = '';
  if (!sorted.length) { box.innerHTML = '<div class="bs-empty">Nothing on the checklist yet.</div>'; }
  sorted.forEach(function (item, i) {
    const row = document.createElement('div'); row.className = 'bs-card sci-check-row' + (item.done ? ' is-done' : '');
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = item.done;
    check.addEventListener('change', function () { MSC.toggleChecklistItem(item.id); renderSciChecklist(); });
    const text = document.createElement('span'); text.className = 'sci-check-text'; text.textContent = item.text;
    const actions = document.createElement('div'); actions.className = 'bs-card-actions';
    const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'bs-icon-btn'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
    upBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.ChecklistItems, item.id, -1); renderSciChecklist(); });
    const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'bs-icon-btn'; downBtn.textContent = '▼'; downBtn.disabled = i === sorted.length - 1;
    downBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.ChecklistItems, item.id, 1); renderSciChecklist(); });
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'bs-icon-btn is-del'; delBtn.textContent = '✕';
    delBtn.addEventListener('click', function () { MSC.ChecklistItems.remove(item.id); renderSciChecklist(); });
    actions.appendChild(upBtn); actions.appendChild(downBtn); actions.appendChild(delBtn);
    row.appendChild(check); row.appendChild(text); row.appendChild(actions);
    box.appendChild(row);
  });
}
function addSciChecklistItem() {
  const input = $('sciChecklistAddInput');
  const text = input.value.trim();
  if (!text) return;
  MSC.ChecklistItems.add({ text: text, order: MSC.nextOrder(MSC.ChecklistItems.list()) });
  input.value = '';
  renderSciChecklist();
}

// ---------- SELF-CARE TIPS ----------
function renderSciTips() {
  const box = $('sciTipsList'); if (!box) return;
  const sorted = MSC.tipsSorted();
  box.innerHTML = '';
  if (!sorted.length) { box.innerHTML = '<div class="bs-empty">No tips yet.</div>'; }
  sorted.forEach(function (item, i) {
    const row = document.createElement('div'); row.className = 'bs-card sci-check-row';
    const text = document.createElement('span'); text.className = 'sci-check-text'; text.textContent = item.text;
    const actions = document.createElement('div'); actions.className = 'bs-card-actions';
    const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'bs-icon-btn'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
    upBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Tips, item.id, -1); renderSciTips(); });
    const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'bs-icon-btn'; downBtn.textContent = '▼'; downBtn.disabled = i === sorted.length - 1;
    downBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Tips, item.id, 1); renderSciTips(); });
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'bs-icon-btn is-del'; delBtn.textContent = '✕';
    delBtn.addEventListener('click', function () { MSC.Tips.remove(item.id); renderSciTips(); });
    actions.appendChild(upBtn); actions.appendChild(downBtn); actions.appendChild(delBtn);
    row.appendChild(text); row.appendChild(actions);
    box.appendChild(row);
  });
}
function addSciTipItem() {
  const input = $('sciTipsAddInput');
  const text = input.value.trim();
  if (!text) return;
  MSC.Tips.add({ text: text, order: MSC.nextOrder(MSC.Tips.list()) });
  input.value = '';
  renderSciTips();
}

// ---------- JOURNAL ----------
function buildSciJournalSectionEl(entry, section, i, sortedLen) {
  const card = document.createElement('div'); card.className = 'bs-card bs-note-card';
  const titleRow = document.createElement('div'); titleRow.className = 'bs-note-title-row';
  const titleInput = document.createElement('input'); titleInput.className = 'bs-note-title-input'; titleInput.value = section.label;
  titleInput.addEventListener('blur', function () { MSC.updateJournalSection(entry.id, section.id, { label: this.value }); });
  const actions = document.createElement('div'); actions.className = 'bs-card-actions';
  const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'bs-icon-btn'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
  upBtn.addEventListener('click', function () { MSC.moveJournalSection(entry.id, section.id, -1); renderSciJournal(); });
  const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'bs-icon-btn'; downBtn.textContent = '▼'; downBtn.disabled = i === sortedLen - 1;
  downBtn.addEventListener('click', function () { MSC.moveJournalSection(entry.id, section.id, 1); renderSciJournal(); });
  const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'bs-icon-btn is-del'; delBtn.textContent = '✕';
  delBtn.addEventListener('click', function () { if (confirm('Delete this section?')) { MSC.removeJournalSection(entry.id, section.id); renderSciJournal(); } });
  actions.appendChild(upBtn); actions.appendChild(downBtn); actions.appendChild(delBtn);
  titleRow.appendChild(titleInput); titleRow.appendChild(actions);
  const body = document.createElement('textarea'); body.className = 'bs-note-body-input'; body.value = section.body; body.rows = 1;
  const grow = function () { body.style.height = 'auto'; body.style.height = body.scrollHeight + 'px'; };
  setTimeout(grow, 0);
  body.addEventListener('input', grow);
  body.addEventListener('blur', function () { MSC.updateJournalSection(entry.id, section.id, { body: this.value }); });
  card.appendChild(titleRow); card.appendChild(body);
  return card;
}
function buildSciJournalEntryCard(entry) {
  const templateLabel = (MSC.JOURNAL_TEMPLATES.find(function (t) { return t.key === entry.template; }) || {}).label || entry.template;
  const card = document.createElement('div'); card.className = 'bs-card';
  const top = document.createElement('div'); top.className = 'bs-card-top';
  const titleWrap = document.createElement('div'); titleWrap.className = 'bs-card-title-wrap';
  const tag = document.createElement('span'); tag.className = 'bs-tag is-accent'; tag.textContent = templateLabel;
  const dateSpan = document.createElement('span'); dateSpan.className = 'bs-card-title'; dateSpan.textContent = entry.date;
  titleWrap.appendChild(tag); titleWrap.appendChild(dateSpan);
  const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'bs-icon-btn is-del'; delBtn.textContent = '✕';
  delBtn.addEventListener('click', function () { if (confirm('Delete this journal entry?')) { MSC.JournalEntries.remove(entry.id); renderSciJournal(); } });
  top.appendChild(titleWrap); top.appendChild(delBtn);
  card.appendChild(top);
  const titleInput = document.createElement('input');
  titleInput.type = 'text'; titleInput.placeholder = 'Untitled entry'; titleInput.value = entry.title;
  titleInput.style.cssText = 'width:100%;background:transparent;border:none;font-size:13.5px;color:var(--text-primary);margin:6px 0;font-family:var(--font);';
  titleInput.addEventListener('blur', function () { MSC.JournalEntries.update(entry.id, { title: this.value }); });
  card.appendChild(titleInput);
  const sorted = entry.sections.slice().sort(function (a, b) { return a.order - b.order; });
  sorted.forEach(function (s, i) { card.appendChild(buildSciJournalSectionEl(entry, s, i, sorted.length)); });
  const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'bs-btn-secondary bs-btn-sm'; addBtn.style.marginTop = '8px'; addBtn.textContent = '+ Add Section';
  addBtn.addEventListener('click', function () { MSC.addJournalSection(entry.id); renderSciJournal(); });
  card.appendChild(addBtn);
  return card;
}
function renderSciJournal() {
  const box = $('sciJournalList'); if (!box) return;
  const sorted = MSC.journalEntriesSorted();
  box.innerHTML = '';
  if (!sorted.length) { box.innerHTML = '<div class="bs-empty">No journal entries yet — start one above.</div>'; }
  sorted.forEach(function (entry) { box.appendChild(buildSciJournalEntryCard(entry)); });
}
function newSciJournalEntry(template) { MSC.addJournalEntry(template); renderSciJournal(); }

// ---------- MEDITATIONS ----------
function renderSciMeditationTypeSelect() {
  const sel = $('sciMeditationTypeInput'); if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';
  MSC.MEDITATION_TYPES.forEach(function (t) { const opt = document.createElement('option'); opt.value = t; opt.textContent = t; sel.appendChild(opt); });
  sel.value = current || MSC.MEDITATION_TYPES[0];
}
function openSciMeditationModal(id) {
  editingSciMedId = id || null;
  const m = id ? MSC.Meditations.get(id) : null;
  renderSciMeditationTypeSelect();
  $('sciMeditationModalTitle').textContent = m ? 'Edit Meditation' : 'Add Meditation';
  $('sciMeditationTitleInput').value = m ? m.title : '';
  $('sciMeditationUrlHint').textContent = '';
  $('sciMeditationCoverUrlInput').value = '';
  sciMedCurrentCover = m ? (m.cover || '') : '';
  sciMedTitleManuallyEdited = !!(m && m.title);
  updateSciMedCoverPreview();
  $('sciMeditationTypeInput').value = m ? m.type : MSC.MEDITATION_TYPES[0];
  $('sciMeditationDurationInput').value = m && m.durationMin !== null ? m.durationMin : '';
  $('sciMeditationUrlInput').value = m ? m.url : '';
  $('sciMeditationDescInput').value = m ? m.description : '';
  $('sciMeditationFavoriteInput').checked = m ? m.favorite : false;
  $('sciMeditationModalDelete').style.display = m ? 'block' : 'none';
  $('sciMeditationModalBg').classList.add('show');
}
function closeSciMeditationModal() { $('sciMeditationModalBg').classList.remove('show'); editingSciMedId = null; }
function saveSciMeditationModal() {
  const title = $('sciMeditationTitleInput').value.trim();
  if (!title) { alert('Give the meditation a title.'); return; }
  const url = $('sciMeditationUrlInput').value.trim();
  if (url && !MSC.isValidMediaUrl(url)) { alert('Link must be a valid http(s) URL.'); return; }
  const durationRaw = $('sciMeditationDurationInput').value;
  const patch = {
    title: title, type: $('sciMeditationTypeInput').value,
    durationMin: durationRaw === '' ? null : (parseInt(durationRaw, 10) || 0),
    url: url, cover: sciMedCurrentCover, description: $('sciMeditationDescInput').value.trim(),
    favorite: $('sciMeditationFavoriteInput').checked
  };
  if (editingSciMedId) MSC.Meditations.update(editingSciMedId, patch);
  else MSC.Meditations.add(Object.assign({}, patch, { order: MSC.nextOrder(MSC.Meditations.list()) }));
  closeSciMeditationModal();
  renderSciMeditations();
}
function deleteSciMeditationModal() {
  if (!editingSciMedId) return;
  if (!confirm('Delete this meditation?')) return;
  MSC.Meditations.remove(editingSciMedId);
  closeSciMeditationModal();
  renderSciMeditations();
}
function buildSciMeditationCard(m, i, sortedLen) {
  const card = document.createElement('div'); card.className = 'bs-card';
  const top = document.createElement('div'); top.className = 'bs-card-top';
  const titleWrap = document.createElement('div'); titleWrap.className = 'bs-card-title-wrap';
  if (m.cover) {
    // Built via DOM property assignment, not innerHTML — m.cover is a
    // user-pasted URL, same "DOM not markup" precedent this app already
    // established for other pasted-URL image fields (e.g. Habit media).
    const thumb = document.createElement('img');
    thumb.className = 'sci-med-thumb';
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.src = m.cover;
    titleWrap.appendChild(thumb);
  }
  const titleSpan = document.createElement('span'); titleSpan.className = 'bs-card-title'; titleSpan.textContent = m.title || 'Untitled';
  const typeTag = document.createElement('span'); typeTag.className = 'bs-tag'; typeTag.textContent = m.type;
  titleWrap.appendChild(titleSpan); titleWrap.appendChild(typeTag);
  if (m.durationMin) { const durTag = document.createElement('span'); durTag.className = 'bs-tag'; durTag.textContent = m.durationMin + ' min'; titleWrap.appendChild(durTag); }
  const actions = document.createElement('div'); actions.className = 'bs-card-actions';
  const favBtn = document.createElement('button'); favBtn.type = 'button'; favBtn.className = 'bs-icon-btn is-star' + (m.favorite ? ' is-active' : ''); favBtn.textContent = m.favorite ? '★' : '☆';
  favBtn.addEventListener('click', function () { MSC.Meditations.update(m.id, { favorite: !m.favorite }); renderSciMeditations(); });
  const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'bs-icon-btn'; editBtn.textContent = '✎';
  editBtn.addEventListener('click', function () { openSciMeditationModal(m.id); });
  const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'bs-icon-btn'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
  upBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Meditations, m.id, -1); renderSciMeditations(); });
  const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'bs-icon-btn'; downBtn.textContent = '▼'; downBtn.disabled = i === sortedLen - 1;
  downBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Meditations, m.id, 1); renderSciMeditations(); });
  actions.appendChild(favBtn); actions.appendChild(editBtn); actions.appendChild(upBtn); actions.appendChild(downBtn);
  top.appendChild(titleWrap); top.appendChild(actions);
  card.appendChild(top);
  if (m.description) { const body = document.createElement('div'); body.className = 'bs-card-body'; body.textContent = m.description; card.appendChild(body); }
  if (MSC.isValidMediaUrl(m.url)) {
    const openBtn = document.createElement('button'); openBtn.type = 'button'; openBtn.className = 'bs-btn-secondary bs-btn-sm'; openBtn.style.marginTop = '6px'; openBtn.textContent = '↗ Open';
    openBtn.addEventListener('click', function () { window.open(m.url, '_blank', 'noopener'); });
    card.appendChild(openBtn);
  }
  return card;
}
function renderSciMeditations() {
  const box = $('sciMeditationList'); if (!box) return;
  const sorted = MSC.meditationsSorted();
  box.innerHTML = '';
  if (!sorted.length) { box.innerHTML = '<div class="bs-empty">No meditations logged yet.</div>'; }
  sorted.forEach(function (m, i) { box.appendChild(buildSciMeditationCard(m, i, sorted.length)); });
}

// ---------- BREATHWORK ----------
function renderSciBreathworkGoalSelect() {
  const sel = $('sciBreathworkGoalInput'); if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';
  MSC.BREATHWORK_GOALS.forEach(function (g) { const opt = document.createElement('option'); opt.value = g; opt.textContent = g; sel.appendChild(opt); });
  sel.value = current || MSC.BREATHWORK_GOALS[0];
}
function openSciBreathworkModal(id) {
  editingSciBrwId = id || null;
  const b = id ? MSC.Breathwork.get(id) : null;
  renderSciBreathworkGoalSelect();
  $('sciBreathworkModalTitle').textContent = b ? 'Edit Breathwork Technique' : 'Add Breathwork Technique';
  $('sciBreathworkNameInput').value = b ? b.name : '';
  $('sciBreathworkGoalInput').value = b ? b.goal : MSC.BREATHWORK_GOALS[0];
  $('sciBreathworkInhaleInput').value = b ? b.inhaleSec : 4;
  $('sciBreathworkHoldInput').value = b ? b.holdSec : 4;
  $('sciBreathworkExhaleInput').value = b ? b.exhaleSec : 4;
  $('sciBreathworkHold2Input').value = b ? b.hold2Sec : 4;
  $('sciBreathworkCyclesInput').value = b ? b.cycles : 6;
  $('sciBreathworkDescInput').value = b ? b.description : '';
  $('sciBreathworkFavoriteInput').checked = b ? b.favorite : false;
  $('sciBreathworkModalDelete').style.display = b ? 'block' : 'none';
  $('sciBreathworkModalBg').classList.add('show');
}
function closeSciBreathworkModal() { $('sciBreathworkModalBg').classList.remove('show'); editingSciBrwId = null; }
function saveSciBreathworkModal() {
  const name = $('sciBreathworkNameInput').value.trim();
  if (!name) { alert('Give the technique a name.'); return; }
  const patch = {
    name: name, goal: $('sciBreathworkGoalInput').value,
    inhaleSec: parseInt($('sciBreathworkInhaleInput').value, 10) || 0,
    holdSec: parseInt($('sciBreathworkHoldInput').value, 10) || 0,
    exhaleSec: parseInt($('sciBreathworkExhaleInput').value, 10) || 0,
    hold2Sec: parseInt($('sciBreathworkHold2Input').value, 10) || 0,
    cycles: parseInt($('sciBreathworkCyclesInput').value, 10) || 1,
    description: $('sciBreathworkDescInput').value.trim(),
    favorite: $('sciBreathworkFavoriteInput').checked
  };
  if (editingSciBrwId) MSC.Breathwork.update(editingSciBrwId, patch);
  else MSC.Breathwork.add(Object.assign({}, patch, { order: MSC.nextOrder(MSC.Breathwork.list()) }));
  closeSciBreathworkModal();
  renderSciBreathwork();
}
function deleteSciBreathworkModal() {
  if (!editingSciBrwId) return;
  if (!confirm('Delete this technique?')) return;
  MSC.Breathwork.remove(editingSciBrwId);
  closeSciBreathworkModal();
  renderSciBreathwork();
}
function buildSciBreathworkCard(b, i, sortedLen) {
  const card = document.createElement('div'); card.className = 'bs-card';
  const top = document.createElement('div'); top.className = 'bs-card-top';
  const titleWrap = document.createElement('div'); titleWrap.className = 'bs-card-title-wrap';
  titleWrap.innerHTML = '<span class="bs-card-title">' + escapeHtml(b.name || 'Untitled') + '</span><span class="bs-tag">' + escapeHtml(b.goal) + '</span>';
  const actions = document.createElement('div'); actions.className = 'bs-card-actions';
  const favBtn = document.createElement('button'); favBtn.type = 'button'; favBtn.className = 'bs-icon-btn is-star' + (b.favorite ? ' is-active' : ''); favBtn.textContent = b.favorite ? '★' : '☆';
  favBtn.addEventListener('click', function () { MSC.Breathwork.update(b.id, { favorite: !b.favorite }); renderSciBreathwork(); });
  const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'bs-icon-btn'; editBtn.textContent = '✎';
  editBtn.addEventListener('click', function () { openSciBreathworkModal(b.id); });
  const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'bs-icon-btn'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
  upBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Breathwork, b.id, -1); renderSciBreathwork(); });
  const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'bs-icon-btn'; downBtn.textContent = '▼'; downBtn.disabled = i === sortedLen - 1;
  downBtn.addEventListener('click', function () { MSC.moveInCollection(MSC.Breathwork, b.id, 1); renderSciBreathwork(); });
  actions.appendChild(favBtn); actions.appendChild(editBtn); actions.appendChild(upBtn); actions.appendChild(downBtn);
  top.appendChild(titleWrap); top.appendChild(actions);
  card.appendChild(top);
  const meta = document.createElement('div'); meta.className = 'sci-brw-meta';
  meta.textContent = b.inhaleSec + '-' + b.holdSec + '-' + b.exhaleSec + '-' + b.hold2Sec + ' · ' + b.cycles + ' cycles';
  card.appendChild(meta);
  if (b.description) { const body = document.createElement('div'); body.className = 'bs-card-body'; body.textContent = b.description; card.appendChild(body); }
  const startBtn = document.createElement('button'); startBtn.type = 'button'; startBtn.className = 'bs-btn-secondary bs-btn-sm'; startBtn.style.marginTop = '6px'; startBtn.textContent = '▶ Start';
  startBtn.addEventListener('click', function () { openSciPacer(b.id); });
  card.appendChild(startBtn);
  return card;
}
function renderSciBreathwork() {
  const box = $('sciBreathworkList'); if (!box) return;
  const sorted = MSC.breathworkSorted();
  box.innerHTML = '';
  if (!sorted.length) { box.innerHTML = '<div class="bs-empty">No breathwork techniques logged yet.</div>'; }
  sorted.forEach(function (b, i) { box.appendChild(buildSciBreathworkCard(b, i, sorted.length)); });
}

// ---------- BREATHWORK PACER — timestamp-based (not a naive tick
// counter) so a backgrounded/throttled tab can't drift, same precedent
// gym.html's own workout timer already established. ----------
function stopSciPacer(){
  if (sciPacer.timer) clearInterval(sciPacer.timer);
  sciPacer.timer = null; sciPacer.running = false;
}
function openSciPacer(breathworkId){
  const b = MSC.Breathwork.get(breathworkId);
  if (!b) return;
  stopSciPacer();
  const phases = [];
  if (b.inhaleSec > 0) phases.push({ name: 'Inhale', seconds: b.inhaleSec, scale: 1 });
  if (b.holdSec > 0) phases.push({ name: 'Hold', seconds: b.holdSec, scale: 1 });
  if (b.exhaleSec > 0) phases.push({ name: 'Exhale', seconds: b.exhaleSec, scale: 0.7 });
  if (b.hold2Sec > 0) phases.push({ name: 'Hold', seconds: b.hold2Sec, scale: 0.7 });
  sciPacer = { technique: b, phases: phases.length ? phases : [{ name: 'Inhale', seconds: 4, scale: 1 }], phaseIdx: 0, phaseStart: 0, cycle: 1, timer: null, running: false };
  $('sciPacerModalTitle').textContent = b.name || 'Breathe';
  $('sciPacerCircle').style.transform = 'scale(0.7)';
  $('sciPacerPhase').textContent = 'Ready';
  $('sciPacerCount').textContent = '—';
  $('sciPacerCycle').textContent = 'Cycle 1 of ' + b.cycles;
  $('sciPacerModalBg').classList.add('show');
}
function closeSciPacer(){ stopSciPacer(); $('sciPacerModalBg').classList.remove('show'); }
function startSciPacer(){
  if (!sciPacer.technique || sciPacer.running) return;
  sciPacer.running = true; sciPacer.phaseIdx = 0; sciPacer.cycle = 1;
  sciPacer.phaseStart = Date.now();
  applySciPacerPhase();
  sciPacer.timer = setInterval(tickSciPacer, 200);
}
function applySciPacerPhase(){
  const phase = sciPacer.phases[sciPacer.phaseIdx];
  $('sciPacerCircle').style.transitionDuration = phase.seconds + 's';
  $('sciPacerCircle').style.transform = 'scale(' + phase.scale + ')';
  $('sciPacerPhase').textContent = phase.name;
  $('sciPacerCycle').textContent = 'Cycle ' + sciPacer.cycle + ' of ' + sciPacer.technique.cycles;
}
function tickSciPacer(){
  if (!sciPacer.running) return;
  const phase = sciPacer.phases[sciPacer.phaseIdx];
  const elapsed = (Date.now() - sciPacer.phaseStart) / 1000;
  const remaining = Math.max(0, Math.ceil(phase.seconds - elapsed));
  $('sciPacerCount').textContent = remaining;
  if (elapsed >= phase.seconds) {
    sciPacer.phaseIdx++;
    if (sciPacer.phaseIdx >= sciPacer.phases.length) {
      sciPacer.phaseIdx = 0;
      sciPacer.cycle++;
      if (sciPacer.cycle > sciPacer.technique.cycles) {
        stopSciPacer();
        $('sciPacerPhase').textContent = '✓ Nice work';
        $('sciPacerCount').textContent = '—';
        return;
      }
    }
    sciPacer.phaseStart = Date.now() - (elapsed - phase.seconds) * 1000;
    applySciPacerPhase();
  }
}

function resetSelfCare() {
  if (!confirm('Reset Self-Care (Checklist, Tips, Journal, Meditations, and Breathwork) to its defaults? This deletes everything currently in it.')) return;
  MSC.seedDefaultData();
  renderSciTabContent();
}

// ---------- LINKS FROM MORNING RITUAL (Breathe/Sit/Page steps) ----------
function openSelfCareSection(subtab, sectionId) {
  switchMainTab('selfcare');
  switchSciTab(subtab);
  setTimeout(function () {
    const target = sectionId ? document.getElementById(sectionId) : document.getElementById('sciTabsRow');
    if (target) target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, 60);
}

// ---------- SEED-RACE SAFETY ----------
function isSelfCareEmptyEverywhere() { return MSC.isEmpty(); }
let selfcareRemoteAppliedOnce = false;
function maybeSeedSelfCareAfterSyncAttempt() {
  if (selfcareRemoteAppliedOnce) return;
  if (!isSelfCareEmptyEverywhere()) return;
  MSC.seedIfEmpty();
  if (selfCareTabIsOpen()) renderSciTabContent();
}
function setupSelfCareSeedRaceSafety() {
  if (typeof initCloudSync !== 'function') { MSC.seedIfEmpty(); return; }
  setTimeout(maybeSeedSelfCareAfterSyncAttempt, 5000);
}

function bootSelfCareMain() {
  MSC = window.MainSelfCareData;
  if (!MSC) return;

  let startTab = 'checklist';
  try { startTab = localStorage.getItem(MSC.KEYS.activeTab) || 'checklist'; } catch (e) {}

  document.querySelectorAll('#sciTabsRow .bs-tab').forEach(function (b) { b.addEventListener('click', function () { switchSciTab(b.dataset.scitab); }); });
  $('sciResetBtn').addEventListener('click', resetSelfCare);

  $('sciChecklistAddInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSciChecklistItem(); });
  $('sciTipsAddInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSciTipItem(); });

  $('sciNewBraindumpBtn').addEventListener('click', function () { newSciJournalEntry('braindump'); });
  $('sciNewGratitudeBtn').addEventListener('click', function () { newSciJournalEntry('gratitude'); });
  $('sciNewDayplannerBtn').addEventListener('click', function () { newSciJournalEntry('dayplanner'); });

  $('sciAddMeditationBtn').addEventListener('click', function () { openSciMeditationModal(null); });
  $('sciMeditationModalCloseBtn').addEventListener('click', closeSciMeditationModal);
  $('sciMeditationModalCancel').addEventListener('click', closeSciMeditationModal);
  $('sciMeditationModalBg').addEventListener('click', function (e) { if (e.target === this) closeSciMeditationModal(); });
  $('sciMeditationModalSave').addEventListener('click', saveSciMeditationModal);
  $('sciMeditationModalDelete').addEventListener('click', deleteSciMeditationModal);
  $('sciMeditationUrlInput').addEventListener('change', maybeAutoFetchSciMedPreview);
  $('sciMeditationFetchBtn').addEventListener('click', maybeAutoFetchSciMedPreview);
  $('sciMeditationTitleInput').addEventListener('input', function () { sciMedTitleManuallyEdited = true; });
  $('sciMeditationCoverUrlInput').addEventListener('change', function () {
    const v = $('sciMeditationCoverUrlInput').value.trim();
    if (v) { sciMedCurrentCover = v; updateSciMedCoverPreview(); }
  });
  $('sciMeditationCoverFile').addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function () {
      const compressed = await compressImageDataUrl(String(reader.result), 480, 0.82);
      sciMedCurrentCover = compressed;
      updateSciMedCoverPreview();
      if (window.PhotoStore) {
        window.PhotoStore.upload(compressed, function (url) {
          if (sciMedCurrentCover === compressed) { sciMedCurrentCover = url; updateSciMedCoverPreview(); }
        });
      }
    };
    reader.readAsDataURL(file);
  });

  $('sciAddBreathworkBtn').addEventListener('click', function () { openSciBreathworkModal(null); });
  $('sciBreathworkModalCloseBtn').addEventListener('click', closeSciBreathworkModal);
  $('sciBreathworkModalCancel').addEventListener('click', closeSciBreathworkModal);
  $('sciBreathworkModalBg').addEventListener('click', function (e) { if (e.target === this) closeSciBreathworkModal(); });
  $('sciBreathworkModalSave').addEventListener('click', saveSciBreathworkModal);
  $('sciBreathworkModalDelete').addEventListener('click', deleteSciBreathworkModal);

  $('sciPacerModalCloseBtn').addEventListener('click', closeSciPacer);
  $('sciPacerModalBg').addEventListener('click', function (e) { if (e.target === this) closeSciPacer(); });
  $('sciPacerStartBtn').addEventListener('click', startSciPacer);
  $('sciPacerStopBtn').addEventListener('click', stopSciPacer);

  switchSciTab(startTab);
  setupSelfCareSeedRaceSafety();
}
function showSciBootErrorBanner(err) {
  try {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#3a0d0d;color:#ffdada;padding:14px 16px;font:13px/1.5 monospace;white-space:pre-wrap;';
    bar.textContent = 'Self-Care failed to load: ' + (err && err.message ? err.message : err);
    document.body.appendChild(bar);
  } catch (e2) {}
}
function safeBootSelfCareMain() { try { bootSelfCareMain(); } catch (err) { showSciBootErrorBanner(err); } }
