const CONFIG = {
  AUTOPUSH_URL: 'https://steep-mountain-53d8.sarsamavladut.workers.dev',
  STORAGE_KEY: 'inventare-app-db-v4',
  AUTH_KEY: 'inventare-app-auth-v4',
  SESSION_KEY: 'inventare-app-session-v4'
};

const emptyDatabase = () => ({
  version: 4,
  updatedAt: new Date().toISOString(),
  users: {},
  authUsers: {}
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
  openFiltersBtn: document.getElementById('openFiltersBtn'),
  closeFiltersBtn: document.getElementById('closeFiltersBtn'),
  filtersDrawer: document.getElementById('filtersDrawer'),
  filtersForm: document.getElementById('filtersForm'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  filterSummary: document.getElementById('filterSummary'),
  filterCountBadge: document.getElementById('filterCountBadge'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  historyList: document.getElementById('historyList'),
  profileCurrentUser: document.getElementById('profileCurrentUser'),
  profileForm: document.getElementById('profileForm'),
  profileUsername: document.getElementById('profileUsername'),
  profileCurrentPassword: document.getElementById('profileCurrentPassword'),
  profileNewPassword: document.getElementById('profileNewPassword'),
  profileMessage: document.getElementById('profileMessage'),
  profileLogoutBtn: document.getElementById('profileLogoutBtn'),
  toast: document.getElementById('toast')
};

const viewTitles = {
  dashboardView: ['Dashboard', 'Banii și inventarele tale'],
  calendarView: ['Calendar', 'Zilele cu inventare'],
  statsView: ['Statistici', 'Grafice și medii'],
  historyView: ['Istoric', 'Toate inventarele'],
  profileView: ['Profil', 'Contul tău']
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

function formatNumber(value) {
  return new Intl.NumberFormat('ro-RO', {
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

function normalizeAuthUsers(users) {
  const normalized = {};
  if (!users || typeof users !== 'object') return normalized;

  Object.keys(users).forEach((username) => {
    const user = users[username];
    if (!user || typeof user !== 'object' || !user.salt || !user.passwordHash) return;
    const normalizedUsername = normalizeUsername(user.username || username);
    if (!normalizedUsername) return;
    normalized[normalizedUsername] = {
      username: normalizedUsername,
      salt: String(user.salt),
      passwordHash: String(user.passwordHash),
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || user.createdAt || new Date().toISOString()
    };
  });

  return normalized;
}

function mergeAuthUsers(baseUsers, incomingUsers) {
  const merged = { ...normalizeAuthUsers(baseUsers) };
  const incoming = normalizeAuthUsers(incomingUsers);

  Object.keys(incoming).forEach((username) => {
    const existing = merged[username];
    if (!existing || new Date(incoming[username].updatedAt) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
      merged[username] = incoming[username];
    }
  });

  return merged;
}

function hydrateAuthFromDatabase() {
  const merged = mergeAuthUsers(getAuthUsers(), database.authUsers);
  saveAuthUsers(merged);
  database.authUsers = merged;
}

function syncAuthToDatabase() {
  database.authUsers = mergeAuthUsers(database.authUsers, getAuthUsers());
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
      authUsers: getAuthUsers(),
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
    users: data.users || {},
    authUsers: normalizeAuthUsers(data.authUsers)
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
    deleted: Boolean(item.deleted),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function getAllCurrentInventories() {
  if (!currentUser) return [];
  ensureUser(currentUser);
  return database.users[currentUser].inventare;
}

function getCurrentInventories() {
  return getAllCurrentInventories().filter((item) => !item.deleted);
}

function setCurrentInventories(items) {
  ensureUser(currentUser);
  const deletedItems = getAllCurrentInventories().filter((item) => item.deleted);
  const activeItems = items.map(normalizeInventory).filter((item) => !item.deleted);
  database.users[currentUser].inventare = [...activeItems, ...deletedItems];
  database.updatedAt = new Date().toISOString();
}

async function loadDatabase() {
  let loaded = null;

  if (CONFIG.AUTOPUSH_URL) {
    try {
      const response = await fetch(`${CONFIG.AUTOPUSH_URL.replace(/\/$/, '')}/db`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Nu pot citi datele.');
      loaded = await response.json();
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(loaded));
      els.storageModeLabel.textContent = 'activ';
    } catch (error) {
      showToast('Nu am putut actualiza datele. Folosesc ultima copie disponibilă.', 'error');
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
  hydrateAuthFromDatabase();
  if (currentUser) ensureUser(currentUser);
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(database));
}

async function saveDatabase(message = 'Operațiune finalizată cu succes.') {
  syncAuthToDatabase();
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
        throw new Error(text || 'Sincronizarea a eșuat.');
      }
      const result = await response.json();
      if (result.database) {
        database = migrateDatabase(result.database);
        hydrateAuthFromDatabase();
        if (currentUser) ensureUser(currentUser);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(database));
      }
      showToast(message);
    } catch (error) {
      showToast('Datele au fost salvate. Sincronizarea nu este disponibilă momentan.', 'error');
    } finally {
      syncInProgress = false;
    }
  } else {
    showToast(message);
  }
}

async function syncNow() {
  if (!CONFIG.AUTOPUSH_URL) {
    showToast('Sincronizarea nu este disponibilă momentan.', 'error');
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

  if (CONFIG.AUTOPUSH_URL) {
    await loadDatabase();
  }

  const authUsers = getAuthUsers();
  if (authUsers[username] || database.users?.[username]) {
    showAuthMessage('Există deja un cont cu acest username.');
    return;
  }

  const salt = randomId();
  authUsers[username] = {
    username,
    salt,
    passwordHash: await sha256(`${salt}:${password}`),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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

  if (CONFIG.AUTOPUSH_URL) {
    await loadDatabase();
  }

  const authUsers = getAuthUsers();
  const user = authUsers[username];
  const legacyUser = database.users?.[username];
  let passwordOk = false;

  if (user) {
    const hash = await sha256(`${user.salt}:${password}`);
    passwordOk = hash === user.passwordHash;
  } else if (legacyUser?.password) {
    passwordOk = String(legacyUser.password) === password;
  }

  if (!user && !legacyUser?.password) {
    showAuthMessage('Nu există acest cont. Creează-l din tabul „Cont nou”.');
    return;
  }

  if (!passwordOk) {
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
  els.storageModeLabel.textContent = 'activ';
  els.loginScreen.classList.add('hidden');
  els.appShell.classList.remove('hidden');
  renderAll();
}

function setView(viewId) {
  if (!document.getElementById(viewId)) viewId = 'dashboardView';
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

function openFilters() {
  els.filtersDrawer.classList.remove('hidden');
  window.setTimeout(() => els.searchInput.focus(), 70);
}

function closeFilters() {
  els.filtersDrawer.classList.add('hidden');
}

function resetFilters() {
  els.searchInput.value = '';
  els.statusFilter.value = 'toate';
  els.typeFilter.value = 'toate';
  renderHistory();
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
  const items = getAllCurrentInventories();
  const inventory = items.find((item) => item.id === id);
  if (!inventory) return;

  if (!confirm(`Ștergi inventarul „${inventory.denumire}”?`)) return;

  inventory.deleted = true;
  inventory.updatedAt = new Date().toISOString();
  database.updatedAt = new Date().toISOString();
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

  const workedHoursData = keys.map((key) => ({
    label: monthLabel(key),
    value: past
      .filter((item) => item.data.startsWith(key))
      .reduce((sum, item) => sum + Number(item.orePlecatAcasa || 0), 0),
    suffix: 'ore'
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

  renderBarChart(els.paidMoneyChart, paidData, true, 6000);
  renderBarChart(els.dueMoneyChart, dueData, true);
  renderBarChart(els.workedDaysChart, workedHoursData, false, 160);
  renderBarChart(els.hourlyChart, hourlyData, true, 37.5);
}

function renderBarChart(container, data, isMoney, target = null) {
  const max = target || Math.max(...data.map((item) => item.value), 1);
  container.innerHTML = data.map((item) => {
    const rawWidth = (item.value / max) * 100;
    const width = Math.min(Math.max(rawWidth, item.value ? 4 : 0), 100);
    const percent = Math.max(rawWidth, 0);
    const value = formatChartValue(item, isMoney);
    return `
      <div class="chart-row">
        <span class="chart-label">${escapeHtml(item.label)}</span>
        <span class="chart-track">
          <span class="chart-fill" style="width: ${width}%"></span>
          <span class="chart-percent">${formatPercent(percent)}</span>
        </span>
        <span class="chart-value">${value}</span>
      </div>
    `;
  }).join('');
}

function formatChartValue(item, isMoney) {
  if (item.suffix === 'lei/h') return `${formatNumber(item.value)} lei/h`;
  if (isMoney) return formatMoney(item.value);
  return `${formatNumber(item.value)} ${item.suffix}`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: value >= 10 ? 0 : 1
  }).format(Number(value || 0))}%`;
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

function updateFilterSummary() {
  const parts = [];
  let activeCount = 0;
  const query = els.searchInput.value.trim();

  if (query) {
    activeCount += 1;
    parts.push(`Căutare: ${query}`);
  }

  if (els.statusFilter.value !== 'toate') {
    activeCount += 1;
    parts.push(els.statusFilter.options[els.statusFilter.selectedIndex].text);
  }

  if (els.typeFilter.value !== 'toate') {
    activeCount += 1;
    parts.push(els.typeFilter.options[els.typeFilter.selectedIndex].text);
  }

  els.filterSummary.textContent = parts.length ? parts.join(' · ') : 'Toate inventarele';
  els.filterCountBadge.textContent = activeCount;
  els.filterCountBadge.classList.toggle('hidden', activeCount === 0);
}

function renderHistory() {
  const items = getFilteredHistory();
  updateFilterSummary();
  els.historyList.innerHTML = items.length
    ? items.map(renderInventoryCard).join('')
    : emptyCard('Nu există inventare pentru filtrele selectate.');
}

function renderProfile() {
  els.profileCurrentUser.textContent = currentUser || '-';
  if (document.activeElement !== els.profileUsername) {
    els.profileUsername.value = currentUser || '';
  }
}

function showProfileMessage(message, type = 'error') {
  els.profileMessage.textContent = message;
  els.profileMessage.style.color = type === 'error' ? '#fb7185' : '#34d399';
}

async function updateProfile(event) {
  event.preventDefault();

  const newUsername = normalizeUsername(els.profileUsername.value);
  const currentPassword = els.profileCurrentPassword.value;
  const newPassword = els.profileNewPassword.value;
  const authUsers = getAuthUsers();
  const user = authUsers[currentUser];

  if (!user) {
    showProfileMessage('Sesiunea curentă nu mai este validă. Autentifică-te din nou.');
    return;
  }

  if (!newUsername || newUsername.length < 2) {
    showProfileMessage('Username-ul trebuie să aibă minimum 2 caractere.');
    return;
  }

  if (newUsername !== currentUser && authUsers[newUsername]) {
    showProfileMessage('Există deja un cont cu acest username.');
    return;
  }

  if (newUsername !== currentUser && database.users?.[newUsername]) {
    showProfileMessage('Există deja date pentru acest username. Alege alt username.');
    return;
  }

  if (newPassword && newPassword.length < 4) {
    showProfileMessage('Parola nouă trebuie să aibă minimum 4 caractere.');
    return;
  }

  const currentHash = await sha256(`${user.salt}:${currentPassword}`);
  if (currentHash !== user.passwordHash) {
    showProfileMessage('Parola actuală nu este corectă.');
    return;
  }

  const oldUsername = currentUser;
  const updatedUser = {
    ...user,
    username: newUsername,
    updatedAt: new Date().toISOString()
  };

  if (newPassword) {
    updatedUser.salt = randomId();
    updatedUser.passwordHash = await sha256(`${updatedUser.salt}:${newPassword}`);
  }

  delete authUsers[oldUsername];
  authUsers[newUsername] = updatedUser;
  saveAuthUsers(authUsers);

  if (newUsername !== oldUsername) {
    ensureUser(oldUsername);
    database.users[newUsername] = {
      ...database.users[oldUsername],
      username: newUsername
    };
    delete database.users[oldUsername];
    currentUser = newUsername;
    localStorage.setItem(CONFIG.SESSION_KEY, currentUser);
  }

  els.currentUserLabel.textContent = currentUser;
  els.profileCurrentPassword.value = '';
  els.profileNewPassword.value = '';
  await saveDatabase('Profil actualizat.');
  renderProfile();
  showProfileMessage('Profil actualizat.', 'success');
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderStats();
  renderHistory();
  renderProfile();
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
  els.profileLogoutBtn.addEventListener('click', logout);
  els.profileForm.addEventListener('submit', updateProfile);

  els.navItems.forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
  els.shortcutButtons.forEach((item) => item.addEventListener('click', () => setView(item.dataset.viewShortcut)));

  els.openAddBtn.addEventListener('click', () => openDrawer());
  els.closeDrawerBtn.addEventListener('click', closeDrawer);
  els.drawer.addEventListener('click', (event) => {
    if (event.target === els.drawer) closeDrawer();
  });
  els.openFiltersBtn.addEventListener('click', openFilters);
  els.closeFiltersBtn.addEventListener('click', closeFilters);
  els.filtersDrawer.addEventListener('click', (event) => {
    if (event.target === els.filtersDrawer) closeFilters();
  });
  els.filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderHistory();
    closeFilters();
  });
  els.resetFiltersBtn.addEventListener('click', resetFilters);

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
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeDrawer();
    closeFilters();
  });
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
