/* ============================================================
   HABIT TRACKER — app.js
   ============================================================ */

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_HABITS = 'habitTracker_habits';
const STORAGE_LOGS   = 'habitTracker_logs';

const PRESET_COLORS = [
  '#bb86fc', '#03dac6', '#cf6679', '#81c784',
  '#ffb74d', '#4fc3f7', '#f06292', '#ffe082'
];

const PRESET_ICONS = [
  'bi-sun',           'bi-book',            'bi-droplet',        'bi-bicycle',
  'bi-capsule',       'bi-journal-richtext', 'bi-lightning',      'bi-moon',
  'bi-heart-pulse',   'bi-peace',            'bi-music-note-beamed', 'bi-cup-hot'
];

// ── State ─────────────────────────────────────────────────────────────────────
let habits        = [];
let logs          = {};
let currentTab    = 'grid';
let editingId     = null;   // habit id being edited (null = new)
let dayDate       = null;   // currently open day sheet date
let selColor      = PRESET_COLORS[0];
let selIcon       = PRESET_ICONS[0];
let activeSheet   = null;   // 'daySheet' | 'habitSheet'
let moreOpen      = false;

// ── Data Layer ────────────────────────────────────────────────────────────────
function loadData() {
  try {
    habits = JSON.parse(localStorage.getItem(STORAGE_HABITS) || '[]');
    logs   = JSON.parse(localStorage.getItem(STORAGE_LOGS)   || '{}');
  } catch (e) {
    habits = [];
    logs   = {};
  }
}
function saveHabits() { localStorage.setItem(STORAGE_HABITS, JSON.stringify(habits)); }
function saveLogs()   { localStorage.setItem(STORAGE_LOGS,   JSON.stringify(logs));   }

// ── Date Helpers ──────────────────────────────────────────────────────────────
function todayStr()          { return fmtDate(new Date()); }
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function isToday(s)  { return s === todayStr(); }
function isFuture(s) { return s > todayStr(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function fmtDisplay(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
}
function fmtShort(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// ── Habit CRUD ────────────────────────────────────────────────────────────────
function addHabit(name, color, icon) {
  const h = { id: uid(), name, color, icon, createdAt: todayStr() };
  habits.push(h);
  saveHabits();
  return h;
}
function updateHabit(id, name, color, icon) {
  const h = habits.find(x => x.id === id);
  if (h) { h.name = name; h.color = color; h.icon = icon; saveHabits(); }
}
function deleteHabit(id) {
  habits = habits.filter(x => x.id !== id);
  Object.keys(logs).forEach(date => {
    logs[date] = logs[date].filter(hId => hId !== id);
    if (!logs[date].length) delete logs[date];
  });
  saveHabits();
  saveLogs();
}

// ── Log CRUD ──────────────────────────────────────────────────────────────────
function getLog(dateStr) { return logs[dateStr] || []; }
function toggleLog(dateStr, habitId) {
  const log = getLog(dateStr);
  const idx = log.indexOf(habitId);
  if (idx === -1) logs[dateStr] = [...log, habitId];
  else {
    logs[dateStr] = log.filter(id => id !== habitId);
    if (!logs[dateStr].length) delete logs[dateStr];
  }
  saveLogs();
}

// ── Statistics ────────────────────────────────────────────────────────────────
function getCurrentStreak() {
  const today = todayStr();
  const d     = new Date();
  if (!logs[today]?.length) d.setDate(d.getDate() - 1); // start from yesterday if today empty
  let streak = 0;
  while (true) {
    const s = fmtDate(d);
    if (logs[s]?.length) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function getBestStreak() {
  const dates = Object.keys(logs).filter(d => logs[d]?.length).sort();
  if (!dates.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (parseDate(dates[i]) - parseDate(dates[i-1])) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

function getMonthRate() {
  const now = new Date();
  const today = now.getDate();
  let filled = 0;
  for (let d = 1; d <= today; d++) {
    const s = fmtDate(new Date(now.getFullYear(), now.getMonth(), d));
    if (logs[s]?.length) filled++;
  }
  return today > 0 ? Math.round((filled / today) * 100) : 0;
}

function getMonthCount() {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return Object.keys(logs).filter(d => d.startsWith(prefix) && logs[d]?.length).length;
}

function habitTotal(id)  { return Object.values(logs).filter(a => a.includes(id)).length; }
function habitStreak(id) {
  const d = new Date();
  if (!getLog(todayStr()).includes(id)) d.setDate(d.getDate() - 1);
  let s = 0;
  while (true) {
    if (getLog(fmtDate(d)).includes(id)) { s++; d.setDate(d.getDate()-1); }
    else break;
  }
  return s;
}
function habitLast14(id) {
  const d = new Date(); d.setDate(d.getDate()-13);
  return Array.from({length:14}, () => {
    const done = getLog(fmtDate(d)).includes(id);
    d.setDate(d.getDate()+1);
    return done;
  });
}

// ── Grid Rendering ────────────────────────────────────────────────────────────
function gridStart() {
  const jan1 = new Date(new Date().getFullYear(), 0, 1);
  const dow  = jan1.getDay(); // 0=Sun
  jan1.setDate(jan1.getDate() - (dow === 0 ? 6 : dow - 1));
  return jan1;
}
function gridEnd() {
  const d   = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow) + 7); // through this week's Sunday + 1 week
  return d;
}

function renderGrid() {
  const grid = document.getElementById('habitGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const start = gridStart(), end = gridEnd();
  let cur = new Date(start), lastMonth = -1;

  while (cur <= end) {
    const month = cur.getMonth();

    // Month label row (spans all 7 columns)
    if (month !== lastMonth) {
      const lbl = document.createElement('div');
      lbl.className = 'month-label';
      lbl.textContent = cur.toLocaleDateString('en-US', {month:'long', year:'numeric'});
      grid.appendChild(lbl);
      lastMonth = month;
    }

    const dateStr = fmtDate(cur);
    const tile    = document.createElement('div');
    tile.className = 'day-tile';
    tile.dataset.date = dateStr;

    if      (isToday(dateStr))  tile.classList.add('today');
    else if (isFuture(dateStr)) tile.classList.add('future');

    const log = getLog(dateStr);
    if (log.length) tile.classList.add('has-entries');

    // Date number (top)
    const dn = document.createElement('div');
    dn.className = 'tile-date';
    dn.textContent = cur.getDate();
    tile.appendChild(dn);

    // Completion dots (bottom)
    const dotsEl = buildDotRow(log);
    tile.appendChild(dotsEl);

    if (!isFuture(dateStr)) {
      tile.addEventListener('click', () => openDaySheet(dateStr));
    }

    grid.appendChild(tile);
    cur.setDate(cur.getDate() + 1);
  }

  // Scroll today into view
  requestAnimationFrame(() => {
    grid.querySelector('.day-tile.today')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function buildDotRow(log) {
  const dotsEl = document.createElement('div');
  dotsEl.className = 'tile-dots';
  const maxDots = 4;
  log.slice(0, maxDots).forEach(hId => {
    const h = habits.find(x => x.id === hId);
    if (!h) return;
    const dot = document.createElement('div');
    dot.className = 'tile-dot';
    dot.style.background = h.color;
    dotsEl.appendChild(dot);
  });
  if (log.length > maxDots) {
    const ov = document.createElement('div');
    ov.className = 'tile-dot-overflow';
    ov.textContent = `+${log.length - maxDots}`;
    dotsEl.appendChild(ov);
  }
  return dotsEl;
}

function refreshTile(dateStr) {
  const tile = document.querySelector(`.day-tile[data-date="${dateStr}"]`);
  if (!tile) return;
  const log = getLog(dateStr);
  tile.classList.toggle('has-entries', log.length > 0);
  const old = tile.querySelector('.tile-dots');
  if (old) tile.replaceChild(buildDotRow(log), old);
}

// ── Day Sheet ─────────────────────────────────────────────────────────────────
function openDaySheet(dateStr) {
  dayDate = dateStr;
  document.getElementById('daySheetTitle').textContent = fmtDisplay(dateStr);
  renderDayBody(dateStr);
  openSheet('daySheet');
}

function renderDayBody(dateStr) {
  const body = document.getElementById('daySheetBody');
  if (!body) return;

  if (!habits.length) {
    body.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-list-check"></i>
        <p>No habits yet</p>
        <small>Go to the <strong style="color:var(--secondary-color)">Habits</strong> tab to add your first habit.</small>
      </div>`;
    return;
  }

  const log = getLog(dateStr);
  body.innerHTML = habits.map(h => {
    const checked = log.includes(h.id);
    return `<div class="habit-check-item ${checked ? 'checked' : ''}" data-id="${h.id}">
      <div class="habit-check-icon" style="color:${h.color};"><i class="bi ${h.icon}"></i></div>
      <span class="habit-check-name">${esc(h.name)}</span>
      <div class="habit-check-toggle"></div>
    </div>`;
  }).join('');

  body.querySelectorAll('.habit-check-item').forEach(item => {
    item.addEventListener('click', () => {
      toggleLog(dateStr, item.dataset.id);
      item.classList.toggle('checked');
      refreshTile(dateStr);
      updateChips();
    });
  });
}

// ── Habits Screen ─────────────────────────────────────────────────────────────
function renderHabitsScreen() {
  const list = document.getElementById('habitList');
  if (!list) return;

  if (!habits.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-list-check"></i>
        <p>No habits yet</p>
        <small>Tap the <strong style="color:var(--secondary-color)">+</strong> button below to create your first habit.</small>
      </div>`;
    return;
  }

  list.innerHTML = habits.map(h => `
    <div class="habit-card" style="border-left-color:${h.color};">
      <div class="habit-icon-badge" style="color:${h.color}; background:${h.color}1a;">
        <i class="bi ${h.icon}"></i>
      </div>
      <div class="habit-card-info">
        <div class="habit-card-name">${esc(h.name)}</div>
        <div class="habit-card-meta">Since ${fmtShort(h.createdAt)} · ${habitTotal(h.id)} completions</div>
      </div>
      <div class="habit-card-actions">
        <button class="icon-btn js-edit" data-id="${h.id}" aria-label="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="icon-btn danger js-del" data-id="${h.id}" aria-label="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>`
  ).join('');

  list.querySelectorAll('.js-edit').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openEditHabitSheet(btn.dataset.id); })
  );
  list.querySelectorAll('.js-del').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const h = habits.find(x => x.id === btn.dataset.id);
      if (h && confirm(`Delete "${h.name}"?`)) {
        deleteHabit(btn.dataset.id);
        renderHabitsScreen();
        renderGrid();
        updateChips();
      }
    })
  );
}

// ── Habit Sheet (Add / Edit) ──────────────────────────────────────────────────
function buildColorPicker() {
  const cp = document.getElementById('colorPicker');
  if (!cp) return;
  cp.innerHTML = PRESET_COLORS.map(c =>
    `<div class="color-swatch${c===selColor?' selected':''}" data-c="${c}" style="background:${c};"></div>`
  ).join('');
  cp.querySelectorAll('.color-swatch').forEach(sw =>
    sw.addEventListener('click', () => {
      selColor = sw.dataset.c;
      cp.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    })
  );
}

function buildIconPicker() {
  const ip = document.getElementById('iconPicker');
  if (!ip) return;
  ip.innerHTML = PRESET_ICONS.map(ic =>
    `<div class="icon-option${ic===selIcon?' selected':''}" data-ic="${ic}"><i class="bi ${ic}"></i></div>`
  ).join('');
  ip.querySelectorAll('.icon-option').forEach(opt =>
    opt.addEventListener('click', () => {
      selIcon = opt.dataset.ic;
      ip.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    })
  );
}

function openAddHabitSheet() {
  editingId = null;
  selColor  = PRESET_COLORS[0];
  selIcon   = PRESET_ICONS[0];
  document.getElementById('habitSheetTitle').textContent = 'New Habit';
  document.getElementById('habitNameInput').value = '';
  document.getElementById('habitDeleteBtn').style.display = 'none';
  buildColorPicker();
  buildIconPicker();
  openSheet('habitSheet');
  requestAnimationFrame(() => document.getElementById('habitNameInput').focus());
}

function openEditHabitSheet(id) {
  const h = habits.find(x => x.id === id);
  if (!h) return;
  editingId = id;
  selColor  = h.color;
  selIcon   = h.icon;
  document.getElementById('habitSheetTitle').textContent = 'Edit Habit';
  document.getElementById('habitNameInput').value = h.name;
  document.getElementById('habitDeleteBtn').style.display = '';
  buildColorPicker();
  buildIconPicker();
  openSheet('habitSheet');
}

function onHabitFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('habitNameInput').value.trim();
  if (!name) return;
  if (editingId) updateHabit(editingId, name, selColor, selIcon);
  else           addHabit(name, selColor, selIcon);
  closeSheet();
  renderHabitsScreen();
  renderGrid();
  updateChips();
}

// ── Stats Screen ──────────────────────────────────────────────────────────────
function renderStatsScreen() {
  const summary = document.getElementById('statsSummary');
  if (summary) {
    const total = Object.values(logs).reduce((s,a) => s + a.length, 0);
    summary.innerHTML = `
      <div class="stat-card">
        <span class="stat-value">${getCurrentStreak()}</span>
        <span class="stat-label">🔥 Current Streak</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${getBestStreak()}</span>
        <span class="stat-label">⭐ Best Streak</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${total}</span>
        <span class="stat-label">✅ All-time Logs</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${getMonthRate()}%</span>
        <span class="stat-label">📅 This Month</span>
      </div>`;
  }

  const habitEl = document.getElementById('statsHabitList');
  if (!habitEl) return;

  if (!habits.length) {
    habitEl.innerHTML = `<div class="empty-state" style="padding:24px 0;">
      <i class="bi bi-bar-chart-line"></i><p>No habits to analyse yet</p></div>`;
    return;
  }

  habitEl.innerHTML = habits.map(h => {
    const last14 = habitLast14(h.id);
    const bars   = last14.map(done =>
      `<div class="spark-bar ${done?'done':'miss'}" ${done ? `style="background:${h.color};opacity:.85;"` : ''}></div>`
    ).join('');
    return `
      <div class="stats-habit-row" style="border-left-color:${h.color};">
        <div class="stats-habit-header">
          <span class="stats-habit-icon" style="color:${h.color};"><i class="bi ${h.icon}"></i></span>
          <span class="stats-habit-name">${esc(h.name)}</span>
          <div class="stats-habit-counts">
            <div class="stats-count-item">
              <span class="stats-count-value">${habitTotal(h.id)}</span>
              <span class="stats-count-label">Total</span>
            </div>
            <div class="stats-count-item">
              <span class="stats-count-value">${habitStreak(h.id)}</span>
              <span class="stats-count-label">Streak</span>
            </div>
          </div>
        </div>
        <div class="sparkline">${bars}</div>
      </div>`;
  }).join('');
}

// ── Header Chips ──────────────────────────────────────────────────────────────
function updateChips() {
  const sc = document.getElementById('streakCount');
  const mc = document.getElementById('monthCount');
  if (sc) sc.textContent = getCurrentStreak();
  if (mc) mc.textContent = getMonthCount();
}

// ── Sheet Management ──────────────────────────────────────────────────────────
function openSheet(id) {
  if (activeSheet) { document.getElementById(activeSheet)?.classList.remove('open'); }
  activeSheet = id;
  document.getElementById(id)?.classList.add('open');
  document.getElementById('sheetBackdrop')?.classList.add('visible');
}
function closeSheet() {
  if (!activeSheet) return;
  document.getElementById(activeSheet)?.classList.remove('open');
  document.getElementById('sheetBackdrop')?.classList.remove('visible');
  activeSheet = null;
  dayDate     = null;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const map = { grid:'screenGrid', habits:'screenHabits', stats:'screenStats' };
  document.getElementById(map[tab])?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'habits') renderHabitsScreen();
  if (tab === 'stats')  renderStatsScreen();
  closeMoreMenu();
}

// ── More Menu ─────────────────────────────────────────────────────────────────
function toggleMoreMenu() {
  moreOpen = !moreOpen;
  const m = document.getElementById('moreMenu');
  if (m) m.style.display = moreOpen ? 'block' : 'none';
}
function closeMoreMenu() {
  moreOpen = false;
  const m = document.getElementById('moreMenu');
  if (m) m.style.display = 'none';
}

// ── Export / Import / Clear ───────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify({habits, logs, exportedAt: new Date().toISOString()}, null, 2)],
    {type:'application/json'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download:`habits-${todayStr()}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
  closeMoreMenu();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.habits) || typeof data.logs !== 'object') throw new Error();
      if (!confirm(`Import ${data.habits.length} habits? This will replace existing data.`)) return;
      habits = data.habits; logs = data.logs;
      saveHabits(); saveLogs();
      renderGrid(); updateChips();
      if (currentTab === 'habits') renderHabitsScreen();
      if (currentTab === 'stats')  renderStatsScreen();
    } catch { alert('Import failed: invalid file format.'); }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('Delete ALL habits and log data? This cannot be undone.')) return;
  habits = []; logs = {};
  saveHabits(); saveLogs();
  renderGrid(); updateChips();
  if (currentTab === 'habits') renderHabitsScreen();
  if (currentTab === 'stats')  renderStatsScreen();
  closeMoreMenu();
}

// ── Swipe-to-close ────────────────────────────────────────────────────────────
function swipeToClose(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  let startY = 0;

  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, {passive: true});

  sheet.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) { sheet.style.transform = `translateY(${dy}px)`; sheet.style.transition = 'none'; }
  }, {passive: true});

  sheet.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    sheet.style.transform = ''; sheet.style.transition = '';
    if (dy > 90) closeSheet();
  }, {passive: true});
}

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Wire Events ───────────────────────────────────────────────────────────────
function wireEvents() {
  // Bottom navigation
  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      if (t === 'more') toggleMoreMenu();
      else switchTab(t);
    })
  );

  // Sheet backdrop closes any open sheet
  document.getElementById('sheetBackdrop')?.addEventListener('click', closeSheet);

  // Day sheet close btn
  document.getElementById('daySheetClose')?.addEventListener('click', closeSheet);

  // Habit sheet close btn
  document.getElementById('habitSheetClose')?.addEventListener('click', closeSheet);

  // Habit form
  document.getElementById('habitForm')?.addEventListener('submit', onHabitFormSubmit);

  // Delete habit (inside sheet)
  document.getElementById('habitDeleteBtn')?.addEventListener('click', () => {
    const h = habits.find(x => x.id === editingId);
    if (h && confirm(`Delete "${h.name}"?`)) {
      deleteHabit(editingId);
      closeSheet();
      renderHabitsScreen();
      renderGrid();
      updateChips();
    }
  });

  // FAB
  document.getElementById('addHabitFab')?.addEventListener('click', openAddHabitSheet);

  // More menu items
  document.getElementById('exportBtn')?.addEventListener('click', e => { e.preventDefault(); exportData(); });
  document.getElementById('importBtn')?.addEventListener('click', e => {
    e.preventDefault(); closeMoreMenu();
    document.getElementById('importFile')?.click();
  });
  document.getElementById('importFile')?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '';
  });
  document.getElementById('clearBtn')?.addEventListener('click', e => { e.preventDefault(); clearAll(); });

  // Click outside more menu to close
  document.addEventListener('click', e => {
    if (!moreOpen) return;
    const menu    = document.getElementById('moreMenu');
    const moreBtn = document.getElementById('tabMore');
    if (!menu?.contains(e.target) && !moreBtn?.contains(e.target)) closeMoreMenu();
  });

  // Swipe-to-close on both sheets
  swipeToClose('daySheet');
  swipeToClose('habitSheet');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  loadData();
  wireEvents();
  renderGrid();
  updateChips();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
