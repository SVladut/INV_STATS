/*
  Pentru GitHub Pages:
  - lasa AUTOPUSH_URL gol daca vrei doar salvare locala in browser + export/import JSON;
  - seteaza AUTOPUSH_URL cu URL-ul Cloudflare Worker daca vrei autopush in data/inventare.json din GitHub.

  Nu pune niciodata token GitHub aici. Token-ul sta doar in Worker, ca secret.
*/
const CONFIG = {
  AUTOPUSH_URL: '',
  STORAGE_KEY: 'inventare-app-db-v4',
  AUTH_KEY: 'inventare-app-auth-v4',
  SESSION_KEY: 'inventare-app-session-v4'
};

const emptyDatabase = () => ({
  version: 4,
  updatedAt: new Date().toISOString(),
  users: {}
});

let database = emptyDatabase();
let currentUser = '';
let currentView = 'dashboardView';
let selectedDate = toDateInputValue(new Date());
let calendarCursor = new Date();
let syncInProgress = false;

const els = {
  loginScreen: document.getElementById('loginScreen'),
  appShell: document.getElementById('appShell'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  showLoginBtn: document.getElementById('showLoginBtn'),
  showRegisterBtn: document.getElementById('showRegisterBtn'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  registerUsername: document.getElementById('registerUsername'),
  registerPassword: document.getElementById('registerPassword'),
  authMessage: document.getElementById('authMessage'),
  currentUserLabel: document.getElementById('currentUserLabel'),
  storageModeLabel: document.getElementById('storageModeLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  navItems: document.querySelectorAll('.nav-item, .mobile-nav-item'),
  shortcutButtons: document.querySelectorAll('[data-view-shortcut]'),
  pageKicker: document.getElementById('pageKicker'),
  pageTitle: document.getElementById('pageTitle'),
  openAddBtn: document.getElementById('openAddBtn'),
  drawer: document.getElementById('inventoryDrawer'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerTitle: document.getElementById('drawerTitle'),
  inventoryForm: document.getElementById('inventoryForm'),
  inventoryId: document.getElementById('inventoryId'),
  dateInput: document.getElementById('dateInput'),
  nameInput: document.getElementById('nameInput'),
  amountInput: document.getElementById('amountInput'),
  hoursInput: document.getElementById('hoursInput'),
  driverInput: document.getElementById('driverInput'),
  travelInput: document.getElementById('travelInput'),
  paidInput: document.getElementById('paidInput'),
  notesInput: document.getElementById('notesInput'),
  inventoryFormMessage: document.getElementById('inventoryFormMessage'),
  deleteFromFormBtn: document.getElementById('deleteFromFormBtn'),
  moneyDueHero: document.getElementById('moneyDueHero'),
  moneyHeroSubtitle: document.getElementById('moneyHeroSubtitle'),
  paidPercent: document.getElementById('paidPercent'),
  moneyTaken: document.getElementById('moneyTaken'),
  moneyDue: document.getElementById('moneyDue'),
  moneyPlanned: document.getElementById('moneyPlanned'),
  monthHourlyAverage: document.getElementById('monthHourlyAverage'),
  upcomingList: document.getElementById('upcomingList'),
  dueList: document.getElementById('dueList'),
  calendarTitle: document.getElementById('calendarTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  selectedDateTitle: document.getElementById('selectedDateTitle'),
  selectedDayList: document.getElementById('selectedDayList'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  paidMoneyChart: document.getElementById('paidMoneyChart'),
  dueMoneyChart: document.getElementById('dueMoneyChart'),
  workedDaysChart: document.getElementById('workedDaysChart'),
  hourlyChart: document.getElementById('hourlyChart'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  historyList: document.getElementById('historyList'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  syncBtn: document.getElementById('syncBtn'),
  toast: document.getElementById('toast')
};

const viewTitles = {
  dashboardView: ['Dashboard', 'Banii și inventarele tale'],
  calendarView: ['Calendar', 'Zilele cu inventare'],
  statsView: ['Statistici', 'Grafice și medii'],
  historyView: ['Istoric', 'Toate inventarele'],
  settingsView: ['Setări', 'Backup și sincronizare']
};

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayValue() {
  return toDateInputValue(new Date());
}

function isFuture(inventar) {
  return inventar.data > todayValue();
}

function isPastOrToday(inventar) {
  return inventar.data <= todayValue();
}

function formatMoney(value) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatMoneyDetailed(value) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`));
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('ro-RO', { month: 'short', year: '2-digit' }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getAuthUsers() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.AUTH_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAuthUsers(users) {
  localStorage.setItem(CONFIG.AUTH_KEY, JSON.stringify(users));
}

function showAuthMessage(message, type = 'error') {
  els.authMessage.textContent = message;
  els.authMessage.style.color = type === 'error' ? '#fb7185' : '#2dd4bf';
}

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`;
  window.setTimeout(() => {
    els.toast.className = 'toast';
  }, 2800);
}

function ensureUser(username) {
  if (!database.users) database.users = {};
  if (!database.users[username]) {
    database.users[username] = {
      username,
      createdAt: new Date().toISOString(),
      inventare: []
    };
  }
  if (!Array.isArray(database.users[username].inventare)) {
    database.users[username].inventare = [];
  }
}

function migrateDatabase(data) {
  if (!data) return emptyDatabase();

  if (Array.isArray(data)) {
    const username = currentUser || 'default';
    return {
      version: 4,
      updatedAt: new Date().toISOString(),
      users: {
        [username]: {
          username,
          createdAt: new Date().toISOString(),
          inventare: data.map(normalizeInventory)
        }
      }
    };
  }

  const migrated = {
    version: 4,
    updatedAt: data.updatedAt || new Date().toISOString(),
    users: data.users || {}
  };

  Object.keys(migrated.users).forEach((username) => {
    const user = migrated.users[username];
    user.username = user.username || username;
    user.createdAt = user.createdAt || new Date().toISOString();
    user.inventare = Array.isArray(user.inventare) ? user.inventare.map(normalizeInventory) : [];
  });

  return migrated;
}

function normalizeInventory(item) {
  return {
    id: item.id || randomId(),
    data: item.data || todayValue(),
    denumire: item.denumire || item.name || '',
    suma: Number(item.suma || item.amount || 0),
    orePlecatAcasa: Number(item.orePlecatAcasa || item.hours || 0),
    sofer: item.sofer === 'da' || item.sofer === true ? 'da' : 'nu',
    deplasare: item.deplasare === 'da' || item.deplasare === true ? 'da' : 'nu',
    achitat: Boolean(item.achitat),
    observatii: item.observatii || item.notes || '',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function getCurrentInventories() {
  if (!currentUser) return [];
  ensureUser(currentUser);
  return database.users[currentUser].inventare;
}

function setCurrentInventories(items) {
  ensureUser(currentUser);
  database.users[currentUser].inventare = items.map(normalizeInventory);
  database.updatedAt = new Date().toISOString();
}

async function loadDatabase() {
  let loaded = null;

  if (CONFIG.AUTOPUSH_URL) {
    try {
      const response = await fetch(`${CONFIG.AUTOPUSH_URL.replace(/\/$/, '')}/db`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Nu pot citi JSON-ul din GitHub.');
      loaded = await response.json();
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(loaded));
      els.storageModeLabel.textContent = 'autopush';
    } catch (error) {
      showToast(`Autopush indisponibil. Folosesc copia locală. ${error.message}`, 'error');
    }
  }

  if (!loaded) {
    try {
      loaded = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
    } catch {
      loaded = null;
    }
  }

  if (!loaded) {
    try {
      const response = await fetch('data/inventare.json', { cache: 'no-store' });
      loaded = response.ok ? await response.json() : emptyDatabase();
    } catch {
      loaded = emptyDatabase();
    }
  }

  database = migrateDatabase(loaded);
  ensureUser(currentUser);
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(database));
}

async function saveDatabase(message = 'Date salvate.') {
  database.updatedAt = new Date().toISOString();
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(database));

  if (CONFIG.AUTOPUSH_URL) {
    try {
      syncInProgress = true;
      const response = await fetch(`${CONFIG.AUTOPUSH_URL.replace(/\/$/, '')}/db`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(database)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Autopush a eșuat.');
      }
      showToast(`${message} Autopush făcut în GitHub.`);
    } catch (error) {
      showToast(`Salvat local, dar autopush a eșuat: ${error.message}`, 'error');
    } finally {
      syncInProgress = false;
    }
  } else {
    showToast(message);
  }
}

async function syncNow() {
  if (!CONFIG.AUTOPUSH_URL) {
    showToast('Nu ai setat AUTOPUSH_URL în script.js.', 'error');
    return;
  }

  if (syncInProgress) return;
  await saveDatabase('Sincronizare finalizată.');
}

function showAuthMode(mode) {
  const isLogin = mode === 'login';
  els.loginForm.classList.toggle('hidden', !isLogin);
  els.registerForm.classList.toggle('hidden', isLogin);
  els.showLoginBtn.classList.toggle('active', isLogin);
  els.showRegisterBtn.classList.toggle('active', !isLogin);
  showAuthMessage('', 'success');
}

async function register(event) {
  event.preventDefault();
  const username = normalizeUsername(els.registerUsername.value);
  const password = els.registerPassword.value;

  if (!username || username.length < 2) {
    showAuthMessage('Username-ul trebuie să aibă minimum 2 caractere.');
    return;
  }

  if (!password || password.length < 4) {
    showAuthMessage('Parola trebuie să aibă minimum 4 caractere.');
    return;
  }

  const authUsers = getAuthUsers();
  if (authUsers[username]) {
    showAuthMessage('Există deja un cont local cu acest username.');
    return;
  }

  const salt = randomId();
  authUsers[username] = {
    username,
    salt,
    passwordHash: await sha256(`${salt}:${password}`),
    createdAt: new Date().toISOString()
  };
  saveAuthUsers(authUsers);

  currentUser = username;
  localStorage.setItem(CONFIG.SESSION_KEY, currentUser);
  await loadDatabase();
  ensureUser(currentUser);
  await saveDatabase('Cont creat și date inițializate.');
  enterApp();
}

async function login(event) {
  event.preventDefault();
  const username = normalizeUsername(els.loginUsername.value);
  const password = els.loginPassword.value;
  const authUsers = getAuthUsers();
  const user = authUsers[username];

  if (!user) {
    showAuthMessage('Nu există acest cont local. Creează-l din tabul „Cont nou”.');
    return;
  }

  const hash = await sha256(`${user.salt}:${password}`);
  if (hash !== user.passwordHash) {
    showAuthMessage('Parola nu este corectă.');
    return;
  }

  currentUser = username;
  localStorage.setItem(CONFIG.SESSION_KEY, currentUser);
  await loadDatabase();
  enterApp();
}

function logout() {
  currentUser = '';
  localStorage.removeItem(CONFIG.SESSION_KEY);
  els.appShell.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  document.querySelector('.mobile-nav').style.display = '';
  showAuthMessage('', 'success');
}

function enterApp() {
  ensureUser(currentUser);
  els.currentUserLabel.textContent = currentUser;
  els.storageModeLabel.textContent = CONFIG.AUTOPUSH_URL ? 'autopush' : 'local';
  els.loginScreen.classList.add('hidden');
  els.appShell.classList.remove('hidden');
  renderAll();
}

function setView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active-view', view.id === viewId));
  els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === viewId));
  const [kicker, title] = viewTitles[viewId] || viewTitles.dashboardView;
  els.pageKicker.textContent = kicker;
  els.pageTitle.textContent = title;
  renderAll();
}

function openDrawer(inventory = null) {
  els.inventoryForm.reset();
  els.inventoryFormMessage.textContent = '';

  if (inventory) {
    els.drawerTitle.textContent = 'Editează inventar';
    els.inventoryId.value = inventory.id;
    els.dateInput.value = inventory.data;
    els.nameInput.value = inventory.denumire;
    els.amountInput.value = inventory.suma;
    els.hoursInput.value = inventory.orePlecatAcasa || '';
    els.driverInput.checked = inventory.sofer === 'da';
    els.travelInput.checked = inventory.deplasare === 'da';
    els.paidInput.checked = Boolean(inventory.achitat);
    els.notesInput.value = inventory.observatii || '';
    els.deleteFromFormBtn.classList.remove('hidden');
  } else {
    els.drawerTitle.textContent = 'Adaugă inventar';
    els.inventoryId.value = '';
    els.dateInput.value = selectedDate || todayValue();
    els.paidInput.checked = false;
    els.deleteFromFormBtn.classList.add('hidden');
  }

  els.drawer.classList.remove('hidden');
  window.setTimeout(() => els.nameInput.focus(), 70);
}

function closeDrawer() {
  els.drawer.classList.add('hidden');
}

function validateInventoryForm(data) {
  if (!data.data) return 'Alege data inventarului.';
  if (!data.denumire) return 'Completează denumirea.';
  if (!Number.isFinite(data.suma) || data.suma <= 0) return 'Suma trebuie să fie un număr pozitiv.';
  if (data.orePlecatAcasa < 0) return 'Numărul de ore nu poate fi negativ.';
  return '';
}

async function saveInventory(event) {
  event.preventDefault();

  const id = els.inventoryId.value;
  const payload = normalizeInventory({
    id: id || randomId(),
    data: els.dateInput.value,
    denumire: els.nameInput.value.trim(),
    suma: Number(els.amountInput.value),
    orePlecatAcasa: Number(els.hoursInput.value || 0),
    sofer: els.driverInput.checked ? 'da' : 'nu',
    deplasare: els.travelInput.checked ? 'da' : 'nu',
    achitat: els.paidInput.checked,
    observatii: els.notesInput.value.trim()
  });

  const error = validateInventoryForm(payload);
  if (error) {
    els.inventoryFormMessage.textContent = error;
    els.inventoryFormMessage.style.color = '#fb7185';
    return;
  }

  const items = getCurrentInventories();
  const index = items.findIndex((item) => item.id === payload.id);

  if (index >= 0) {
    payload.createdAt = items[index].createdAt;
    payload.updatedAt = new Date().toISOString();
    items[index] = payload;
  } else {
    payload.createdAt = new Date().toISOString();
    payload.updatedAt = new Date().toISOString();
    items.push(payload);
  }

  setCurrentInventories(items);
  await saveDatabase(index >= 0 ? 'Inventar actualizat.' : 'Inventar adăugat.');
  closeDrawer();
  renderAll();
}

async function deleteInventory(id) {
  const items = getCurrentInventories();
  const inventory = items.find((item) => item.id === id);
  if (!inventory) return;

  if (!confirm(`Ștergi inventarul „${inventory.denumire}”?`)) return;

  setCurrentInventories(items.filter((item) => item.id !== id));
  await saveDatabase('Inventar șters.');
  closeDrawer();
  renderAll();
}

async function togglePaid(id) {
  const items = getCurrentInventories();
  const inventory = items.find((item) => item.id === id);
  if (!inventory) return;

  inventory.achitat = !inventory.achitat;
  inventory.updatedAt = new Date().toISOString();
  setCurrentInventories(items);
  await saveDatabase(inventory.achitat ? 'Inventar marcat achitat.' : 'Inventar marcat neachitat.');
  renderAll();
}

function getTotals() {
  const items = getCurrentInventories();
  const past = items.filter(isPastOrToday);
  const future = items.filter(isFuture);
  const paidPast = past.filter((item) => item.achitat);
  const duePast = past.filter((item) => !item.achitat);
  const moneyTaken = paidPast.reduce((sum, item) => sum + item.suma, 0);
  const moneyDue = duePast.reduce((sum, item) => sum + item.suma, 0);
  const moneyPlanned = future.reduce((sum, item) => sum + item.suma, 0);
  const totalPast = past.reduce((sum, item) => sum + item.suma, 0);
  const totalHoursMonth = getCurrentMonthItems(past).reduce((sum, item) => sum + Number(item.orePlecatAcasa || 0), 0);
  const totalMoneyMonth = getCurrentMonthItems(past).reduce((sum, item) => sum + Number(item.suma || 0), 0);

  return {
    past,
    future,
    paidPast,
    duePast,
    moneyTaken,
    moneyDue,
    moneyPlanned,
    paidPercent: totalPast ? Math.round((moneyTaken / totalPast) * 100) : 0,
    monthAverage: totalHoursMonth ? totalMoneyMonth / totalHoursMonth : 0
  };
}

function getCurrentMonthItems(items) {
  const key = todayValue().slice(0, 7);
  return items.filter((item) => item.data.slice(0, 7) === key);
}

function renderDashboard() {
  const totals = getTotals();
  els.moneyDueHero.textContent = formatMoney(totals.moneyDue);
  els.moneyHeroSubtitle.textContent = totals.moneyDue
    ? `${totals.duePast.length} inventare trecute sunt încă neachitate.`
    : 'Nu ai inventare restante.';
  els.paidPercent.textContent = `${totals.paidPercent}%`;
  els.moneyTaken.textContent = formatMoney(totals.moneyTaken);
  els.moneyDue.textContent = formatMoney(totals.moneyDue);
  els.moneyPlanned.textContent = formatMoney(totals.moneyPlanned);
  els.monthHourlyAverage.textContent = `${formatMoneyDetailed(totals.monthAverage)}/h`;

  const upcoming = sortByDate(totals.future).slice(0, 5);
  const due = sortByDate(totals.duePast).slice(0, 5);
  els.upcomingList.innerHTML = upcoming.length ? upcoming.map(renderMiniItem).join('') : emptyCard('Nu ai inventare viitoare programate.');
  els.dueList.innerHTML = due.length ? due.map(renderMiniItem).join('') : emptyCard('Nu ai bani restanți de încasat.');
}

function renderMiniItem(item) {
  return `
    <article class="mini-item" role="button" tabindex="0" onclick="editById('${item.id}')">
      <div>
        <h3 class="item-title">${escapeHtml(item.denumire)}</h3>
        <div class="item-meta">${formatDate(item.data)} · ${item.orePlecatAcasa || 0} ore · ${rateText(item)}</div>
      </div>
      <strong class="item-money">${formatMoney(item.suma)}</strong>
    </article>
  `;
}

function emptyCard(message) {
  return `<div class="empty-card">${escapeHtml(message)}</div>`;
}

function rateText(item) {
  const hours = Number(item.orePlecatAcasa || 0);
  if (!hours) return 'fără ore';
  return `${formatMoneyDetailed(item.suma / hours)}/h`;
}

function sortByDate(items) {
  return [...items].sort((a, b) => a.data.localeCompare(b.data) || a.denumire.localeCompare(b.denumire, 'ro'));
}

function renderInventoryCard(item) {
  const statusBadge = isFuture(item)
    ? '<span class="badge future">Viitor</span>'
    : item.achitat
      ? '<span class="badge ok">Achitat</span>'
      : '<span class="badge due">De luat</span>';

  const paidBtn = item.achitat ? 'Marchează neachitat' : 'Marchează achitat';

  return `
    <article class="inventory-card">
      <div class="card-top">
        <div>
          <h3 class="item-title">${escapeHtml(item.denumire)}</h3>
          <div class="item-meta">${formatDate(item.data)} · ${item.orePlecatAcasa || 0} ore · <span class="rate-label">${rateText(item)}</span></div>
        </div>
        <strong class="item-money">${formatMoneyDetailed(item.suma)}</strong>
      </div>

      <div class="badges">
        ${statusBadge}
        <span class="badge ${item.sofer === 'da' ? 'info' : 'no'}">Șofer: ${item.sofer}</span>
        <span class="badge ${item.deplasare === 'da' ? 'info' : 'no'}">Deplasare: ${item.deplasare}</span>
      </div>

      ${item.observatii ? `<p class="item-notes">${escapeHtml(item.observatii)}</p>` : ''}

      <div class="card-actions">
        <button class="btn btn-secondary" type="button" onclick="editById('${item.id}')">Editează</button>
        <button class="btn ${item.achitat ? 'btn-secondary' : 'btn-primary'}" type="button" onclick="togglePaid('${item.id}')">${paidBtn}</button>
      </div>
    </article>
  `;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - mondayOffset);

  els.calendarTitle.textContent = new Intl.DateTimeFormat('ro-RO', {
    month: 'long',
    year: 'numeric'
  }).format(firstDay);

  const items = getCurrentInventories();
  const html = [];

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const value = toDateInputValue(day);
    const dayItems = items.filter((item) => item.data === value);
    const classes = [
      'day-btn',
      day.getMonth() !== month ? 'other-month' : '',
      value === todayValue() ? 'today' : '',
      value === selectedDate ? 'selected' : ''
    ].filter(Boolean).join(' ');

    const dots = dayItems.slice(0, 4).map((item) => {
      const cls = isFuture(item) ? 'future' : item.achitat ? 'paid' : 'due';
      return `<span class="dot ${cls}"></span>`;
    }).join('');

    html.push(`
      <button class="${classes}" type="button" onclick="selectCalendarDate('${value}')">
        <span class="day-number">${day.getDate()}</span>
        <span class="day-dots">${dots}</span>
      </button>
    `);
  }

  els.calendarGrid.innerHTML = html.join('');
  renderSelectedDay();
}

function selectCalendarDate(value) {
  selectedDate = value;
  calendarCursor = new Date(`${value}T00:00:00`);
  renderCalendar();
}

function renderSelectedDay() {
  const items = sortByDate(getCurrentInventories().filter((item) => item.data === selectedDate));
  els.selectedDateTitle.textContent = formatDate(selectedDate);
  els.selectedDayList.innerHTML = items.length
    ? items.map(renderInventoryCard).join('')
    : emptyCard('Nu ai inventare în ziua selectată.');
}

function getMonthKeys(items) {
  const set = new Set(items.map((item) => item.data.slice(0, 7)));
  const nowKey = todayValue().slice(0, 7);
  set.add(nowKey);
  return [...set].sort().slice(-8);
}

function renderStats() {
  const items = getCurrentInventories();
  const past = items.filter(isPastOrToday);
  const keys = getMonthKeys(items);

  const paidData = keys.map((key) => ({
    label: monthLabel(key),
    value: past.filter((item) => item.data.startsWith(key) && item.achitat).reduce((sum, item) => sum + item.suma, 0),
    suffix: 'lei'
  }));

  const dueData = keys.map((key) => ({
    label: monthLabel(key),
    value: past.filter((item) => item.data.startsWith(key) && !item.achitat).reduce((sum, item) => sum + item.suma, 0),
    suffix: 'lei'
  }));

  const workedDaysData = keys.map((key) => ({
    label: monthLabel(key),
    value: new Set(past.filter((item) => item.data.startsWith(key)).map((item) => item.data)).size,
    suffix: 'zile'
  }));

  const hourlyData = keys.map((key) => {
    const monthItems = past.filter((item) => item.data.startsWith(key));
    const money = monthItems.reduce((sum, item) => sum + item.suma, 0);
    const hours = monthItems.reduce((sum, item) => sum + Number(item.orePlecatAcasa || 0), 0);
    return {
      label: monthLabel(key),
      value: hours ? money / hours : 0,
      suffix: 'lei/h'
    };
  });

  renderBarChart(els.paidMoneyChart, paidData, true);
  renderBarChart(els.dueMoneyChart, dueData, true);
  renderBarChart(els.workedDaysChart, workedDaysData, false);
  renderBarChart(els.hourlyChart, hourlyData, true);
}

function renderBarChart(container, data, isMoney) {
  const max = Math.max(...data.map((item) => item.value), 1);
  container.innerHTML = data.map((item) => {
    const width = Math.max((item.value / max) * 100, item.value ? 4 : 0);
    const value = isMoney ? formatMoney(item.value) : `${item.value} ${item.suffix}`;
    return `
      <div class="chart-row">
        <span class="chart-label">${escapeHtml(item.label)}</span>
        <span class="chart-track"><span class="chart-fill" style="width: ${width}%"></span></span>
        <span class="chart-value">${value}</span>
      </div>
    `;
  }).join('');
}

function getFilteredHistory() {
  const query = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const type = els.typeFilter.value;

  return sortByDate(getCurrentInventories()).reverse().filter((item) => {
    const text = [item.denumire, item.data, item.observatii, item.sofer, item.deplasare].join(' ').toLowerCase();
    const matchesQuery = !query || text.includes(query);

    const matchesStatus =
      status === 'toate' ||
      (status === 'achitate' && isPastOrToday(item) && item.achitat) ||
      (status === 'neachitate' && isPastOrToday(item) && !item.achitat) ||
      (status === 'viitoare' && isFuture(item));

    const matchesType =
      type === 'toate' ||
      (type === 'sofer-da' && item.sofer === 'da') ||
      (type === 'sofer-nu' && item.sofer === 'nu') ||
      (type === 'deplasare-da' && item.deplasare === 'da') ||
      (type === 'deplasare-nu' && item.deplasare === 'nu');

    return matchesQuery && matchesStatus && matchesType;
  });
}

function renderHistory() {
  const items = getFilteredHistory();
  els.historyList.innerHTML = items.length
    ? items.map(renderInventoryCard).join('')
    : emptyCard('Nu există inventare pentru filtrele selectate.');
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderStats();
  renderHistory();
}

function editById(id) {
  const item = getCurrentInventories().find((inventory) => inventory.id === id);
  if (item) openDrawer(item);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventare-backup-${todayValue()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    database = migrateDatabase(imported);
    ensureUser(currentUser);
    await saveDatabase('Import finalizat.');
    renderAll();
  } catch (error) {
    showToast(`Import eșuat: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}

function attachEvents() {
  els.showLoginBtn.addEventListener('click', () => showAuthMode('login'));
  els.showRegisterBtn.addEventListener('click', () => showAuthMode('register'));
  els.loginForm.addEventListener('submit', login);
  els.registerForm.addEventListener('submit', register);
  els.logoutBtn.addEventListener('click', logout);

  els.navItems.forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
  els.shortcutButtons.forEach((item) => item.addEventListener('click', () => setView(item.dataset.viewShortcut)));

  els.openAddBtn.addEventListener('click', () => openDrawer());
  els.closeDrawerBtn.addEventListener('click', closeDrawer);
  els.drawer.addEventListener('click', (event) => {
    if (event.target === els.drawer) closeDrawer();
  });

  els.inventoryForm.addEventListener('submit', saveInventory);
  els.deleteFromFormBtn.addEventListener('click', () => {
    const id = els.inventoryId.value;
    if (id) deleteInventory(id);
  });

  els.prevMonthBtn.addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendar();
  });
  els.nextMonthBtn.addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendar();
  });

  els.searchInput.addEventListener('input', renderHistory);
  els.statusFilter.addEventListener('change', renderHistory);
  els.typeFilter.addEventListener('change', renderHistory);
  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', importJson);
  els.syncBtn.addEventListener('click', syncNow);
}

async function boot() {
  attachEvents();
  currentUser = localStorage.getItem(CONFIG.SESSION_KEY) || '';

  if (currentUser) {
    await loadDatabase();
    enterApp();
  } else {
    els.loginScreen.classList.remove('hidden');
    els.appShell.classList.add('hidden');
  }
}

window.editById = editById;
window.togglePaid = togglePaid;
window.selectCalendarDate = selectCalendarDate;

boot();
