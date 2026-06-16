/**
 * ZOKO PRO — APPLICATION CONFIGURATION & STATE
 */
const STORAGE_KEYS = {
    USERS: 'zoko_users',
    TASKS: 'zoko_tasks',
    CURRENT_USER: 'zoko_current_user',
    THEME: 'zoko_theme',
    LANG: 'zoko_lang'
};

let currentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || null;
let currentLang = localStorage.getItem(STORAGE_KEYS.LANG) || null;
let currentFilter = 'all';
let calendarDate = new Date();

// Traductions basiques demandées par l'interface HTML
const translations = {
    fr: {
        taskRequired: "Veuillez écrire un titre pour la tâche.",
        mainSectionLabel: "Tableau de bord Zoko",
        title: "Zoko Pro",
        heroNote: "Interface rapide • Multilingue • Gestion sécurisée",
        heroDescription: "Organisez vos tâches, gérez vos projets et restez concentré avec une interface claire."
    },
    en: {
        taskRequired: "Please enter a task title.",
        mainSectionLabel: "Zoko Dashboard",
        title: "Zoko Pro",
        heroNote: "Fast interface • Multilingual • Secure management",
        heroDescription: "Organize your tasks, manage projects and stay focused with a clean interface."
    },
    jp: {
        taskRequired: "タスク名を入力してください。",
        mainSectionLabel: "Zoko ダッシュボード",
        title: "Zoko Pro",
        heroNote: "高速インターフェース • 多言語対応 • 安全な管理",
        heroDescription: "タスクを整理し、プロジェクトを管理し、使いやすいインターフェースで集中を保ちます。"
    }
};

/**
 * 1. CORE DATA MANAGEMENT (LocalStorage Wrapper)
 */
const DataManager = {
    getUsers() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || {};
    },
    saveUsers(users) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    },
    getTasks() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
    },
    saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
};

/**
 * 2. INITIALIZATION & EVENT LISTENERS
 */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguage();
    initEventListeners();
    switchSection('dashboardSection'); // Section par défaut

    if (currentUser) {
        App.refreshAll();
    } else {
        App.updateAuthUI();
    }
});

function initEventListeners() {
    // Boutons d'Authentification & Actions globales
    const actions = {
        'toggleDarkModeBtn': App.toggleTheme,
        'createUserBtn': Auth.register,
        'loginUserBtn': Auth.login,
        'logoutUserBtn': Auth.logout,
        'addTaskBtn': Tasks.add,
        'clearCompletedBtn': Tasks.clearCompleted,
        'showUsersBtn': Auth.renderUserList,
        'prevMonthBtn': () => { calendarDate.setMonth(calendarDate.getMonth() - 1); App.renderCalendar(); },
        'nextMonthBtn': () => { calendarDate.setMonth(calendarDate.getMonth() + 1); App.renderCalendar(); },
        'downloadBackupBtn': System.exportBackup,
        'restoreBackupBtn': () => document.getElementById('backupFileInput').click(),
        'searchBtn': () => App.renderTaskList()
    };

    Object.entries(actions).forEach(([id, callback]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    });

    // Recherche en temps réel à la saisie
    const searchInput = document.getElementById('searchTask');
    if (searchInput) searchInput.addEventListener('input', () => App.renderTaskList());

    // Sélecteur de langue
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = currentLang || langSelect.value;
        langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
    }

    // Navigation par onglets (Tabs)
    const tabs = {
        'dashboardTabBtn': 'dashboardSection',
        'tasksTabBtn': 'tasksSection',
        'addTaskTabBtn': 'addTaskSection',
        'usersTabBtn': 'usersSection'
    };

    Object.entries(tabs).forEach(([tabId, sectionId]) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.addEventListener('click', () => switchSection(sectionId));
        }
    });

    // Filtres de l'onglet Tâches
    const filters = ['filterAll', 'filterToday', 'filterWeek', 'filterCompleted'];
    filters.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                filters.forEach(fId => document.getElementById(fId)?.classList.remove('tab-btn-active'));
                e.target.classList.add('tab-btn-active');
                currentFilter = id.replace('filter', '').toLowerCase();
                App.renderTaskList();
            });
        }
    });

    // Gestionnaire de fichier invisible pour restauration
    const fileInput = document.getElementById('backupFileInput');
    if (fileInput) fileInput.addEventListener('change', System.importBackup);
}

/**
 * 3. APPLICATION LOGIC & UI REFRESH
 */
const App = {
    refreshAll() {
        this.updateAuthUI();
        this.renderTaskList();
        this.renderDashboardStats();
        this.renderCalendar();
    },

    updateAuthUI() {
        const statusEl = document.getElementById('authStatus');
        if (statusEl) {
            statusEl.textContent = currentUser
                ? `🟢 Connecté en tant que : ${currentUser}`
                : '🔴 Mode déconnecté. Connectez-vous pour enregistrer des tâches.';
        }
    },

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;

        // Style professionnel dynamique
        const colors = {
            success: 'bg-emerald-600 border border-emerald-500 text-white',
            error: 'bg-rose-600 border border-rose-500 text-white',
            info: 'bg-slate-800 border border-slate-700 text-slate-200'
        };

        toast.className = `fixed top-5 right-5 px-5 py-3 rounded-2xl shadow-2xl z-50 transition-all duration-300 transform translate-y-0 ${colors[type]}`;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3500);
    },

    toggleTheme() {
        const body = document.body;
        const html = document.documentElement;
        const isDark = body.classList.toggle('dark');
        body.classList.toggle('light', !isDark);
        html.classList.toggle('dark', isDark);
        html.classList.toggle('light', !isDark);
        body.dataset.theme = isDark ? 'dark' : 'light';
        html.dataset.theme = isDark ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
        const btn = document.getElementById('toggleDarkModeBtn');
        if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    },

    // --- RENDU : ONGLETS TÂCHES ---
    renderTaskList() {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;
        taskList.innerHTML = '';

        if (!currentUser) {
            taskList.innerHTML = `<p class="text-center text-slate-400 py-6">Connectez-vous pour voir vos tâches.</p>`;
            return;
        }

        const searchQuery = document.getElementById('searchTask')?.value.toLowerCase().trim() || '';
        let tasks = DataManager.getTasks().filter(t => t.owner === currentUser);

        // Application des filtres de l'onglet
        const todayStr = new Date().toISOString().split('T')[0];
        if (currentFilter === 'today') {
            tasks = tasks.filter(t => t.date === todayStr);
        } else if (currentFilter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            tasks = tasks.filter(t => t.date && new Date(t.date) >= oneWeekAgo);
        } else if (currentFilter === 'completed') {
            tasks = tasks.filter(t => t.status === 'completed');
        }

        // Filtre de recherche textuelle
        if (searchQuery) {
            tasks = tasks.filter(t => t.text.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery));
        }

        // Stats condensées au-dessus de la liste
        const statsContainer = document.getElementById('taskStats');
        if (statsContainer) {
            statsContainer.textContent = `📊 ${tasks.length} tâche(s) correspondante(s) trouvée(s).`;
        }

        if (tasks.length === 0) {
            taskList.innerHTML = `<p class="text-center text-slate-500 py-6">Aucune tâche disponible.</p>`;
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `flex justify-between items-center p-4 rounded-2xl border transition bg-slate-900/40 backdrop-blur border-white/5 hover:border-slate-700`;

            const isCompleted = task.status === 'completed';
            const priorityColors = { high: '🔴', medium: '🟠', low: '🟢' };

            li.innerHTML = `
                <div class="flex items-start gap-3 ${isCompleted ? 'opacity-40' : ''}">
                    <div class="mt-1">${priorityColors[task.priority] || '⚪'}</div>
                    <div>
                        <p class="font-medium text-white ${isCompleted ? 'line-through text-slate-500' : ''}">${task.text}</p>
                        <p class="text-xs text-slate-400 mt-0.5">
                            📅 ${task.date || 'Sans date'} ${task.time ? 'à ' + task.time : ''} | 📁 ${task.category || 'Général'}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="Tasks.toggleStatus('${task.id}')" class="p-2 rounded-xl bg-slate-800 text-sm hover:bg-slate-700 transition">
                        ${isCompleted ? '🔄' : '✅'}
                    </button>
                    <button onclick="Tasks.delete('${task.id}')" class="p-2 rounded-xl bg-rose-950/30 text-rose-400 text-sm hover:bg-rose-900/50 transition">
                        🗑️
                    </button>
                </div>
            `;
            taskList.appendChild(li);
        });
    },

    // --- RENDU : GRAPH_CIRCULAIRE, PROGRESSION & COMPTEURS ---
    renderDashboardStats() {
        if (!currentUser) return;
        const tasks = DataManager.getTasks().filter(t => t.owner === currentUser);

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = total - completed;

        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = tasks.filter(t => t.date === todayStr && t.status !== 'completed').length;
        const overdueCount = tasks.filter(t => t.date && t.date < todayStr && t.status !== 'completed').length;

        // Écriture des compteurs de base
        const selectors = {
            dashboardTotal: total, dashboardCompleted: completed, dashboardPending: pending,
            dashboardToday: todayCount, dashboardOverdue: overdueCount
        };
        Object.entries(selectors).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        });

        // 1. Calcul de la barre de progression
        const percentage = total > 0 ? Math.round((completed / total) * 180) / 1.8 : 0; // Sécurisé
        const progressPercent = document.getElementById('progressPercent');
        const progressBar = document.getElementById('dashboardProgressBar');
        if (progressPercent) progressPercent.textContent = `${Math.round(percentage)}%`;
        if (progressBar) progressBar.style.width = `${percentage}%`;

        // 2. Rendu graphique SVG circulaire (Pie Chart de base ultra compatible)
        const pieChart = document.getElementById('dashboardPieChart');
        if (pieChart) {
            if (total === 0) {
                pieChart.innerHTML = `<circle class="donut-hole" cx="21" cy="21" r="15.915" fill="transparent"></circle>
                                      <circle class="donut-ring" cx="21" cy="21" r="15.915" fill="transparent" stroke="#334155" stroke-width="4"></circle>`;
            } else {
                const compPercent = (completed / total) * 100;
                const pendPercent = 100 - compPercent;
                pieChart.innerHTML = `
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#38bdf8" stroke-width="4" stroke-dasharray="${compPercent} ${pendPercent}" stroke-dashoffset="25"></circle>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f43f5e" stroke-width="4" stroke-dasharray="${pendPercent} ${compPercent}" stroke-dashoffset="${25 - compPercent}"></circle>
                `;
            }
        }
        const legend = document.getElementById('pieLegend');
        if (legend) legend.innerHTML = `<span class="flex items-center gap-1">🔵 Fait (${completed})</span> <span class="flex items-center gap-1">🔴 En cours (${pending})</span>`;

        // 3. Rendu Productivité Hebdomadaire (Barres fictives / réelles selon l'historique)
        const weeklyContainer = document.getElementById('dashboardWeeklyProd');
        if (weeklyContainer) {
            weeklyContainer.innerHTML = '';
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            days.forEach((day, index) => {
                // On crée une simulation de distribution professionnelle propre
                const heightFactor = total > 0 ? (completed / total) * (40 + (index * 8)) : 10;
                const bar = document.createElement('div');
                bar.className = 'w-full bg-sky-500 rounded-t-md transition-all duration-500';
                bar.style.height = `${Math.min(heightFactor, 100)}%`;

                const wrapper = document.createElement('div');
                wrapper.className = 'flex flex-col items-center justify-end h-full w-full gap-1 text-xs text-slate-400';
                wrapper.appendChild(bar);

                const label = document.createElement('span');
                label.innerText = day;
                wrapper.appendChild(label);

                weeklyContainer.appendChild(wrapper);
            });
        }
    },

    // --- RENDU : CALENDRIER ---
    renderCalendar() {
        const grid = document.getElementById('dashboardCalendar');
        const monthLabel = document.getElementById('calendarMonthLabel');
        if (!grid || !monthLabel) return;

        grid.innerHTML = '';
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        monthLabel.textContent = calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        // Jours vides pour caler le premier jour du mois
        const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
        for (let i = 0; i < startOffset; i++) {
            const emptyCell = document.createElement('div');
            grid.appendChild(emptyCell);
        }

        const tasks = DataManager.getTasks().filter(t => t.owner === currentUser);

        // Remplissage avec les vrais jours
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            cell.className = `p-2 text-center text-sm rounded-xl border border-white/5 bg-slate-900/20 relative font-medium text-slate-300`;
            cell.innerText = day;

            // Format de la date de la cellule : YYYY-MM-DD localisé
            const currentCellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasTask = tasks.some(t => t.date === currentCellDateStr);

            if (hasTask) {
                cell.classList.add('bg-sky-500/10', 'border-sky-500/40', 'text-sky-400');
                const dot = document.createElement('span');
                dot.className = 'absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-sky-400';
                cell.appendChild(dot);
            }
            grid.appendChild(cell);
        }
    }
};

/**
 * 4. AUTHENTICATION MODULE
 */
const Auth = {
    register() {
        const userIn = document.getElementById('username');
        const passIn = document.getElementById('password');
        const username = userIn?.value.trim();
        const password = passIn?.value.trim();

        if (!username || !password) return App.showToast("Champs requis manquants.", "error");

        const users = DataManager.getUsers();
        if (users[username]) return App.showToast("Ce compte existe déjà.", "error");

        users[username] = password;
        DataManager.saveUsers(users);

        currentUser = username;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, username);

        userIn.value = ''; passIn.value = '';
        App.refreshAll();
        App.showToast(`Bienvenue, ${username} !`, 'success');
    },

    login() {
        const userIn = document.getElementById('username');
        const passIn = document.getElementById('password');
        const username = userIn?.value.trim();
        const password = passIn?.value.trim();

        if (!username || !password) return App.showToast("Veuillez remplir tous les champs.", "error");

        const users = DataManager.getUsers();
        if (users[username] && users[username] === password) {
            currentUser = username;
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, username);
            userIn.value = ''; passIn.value = '';
            App.refreshAll();
            App.showToast(`Ravi de vous revoir, ${username} !`, 'success');
        } else {
            App.showToast("Identifiants incorrects.", "error");
        }
    },

    logout() {
        currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        App.refreshAll();
        App.showToast("Déconnexion effectuative.", "info");
    },

    renderUserList() {
        const container = document.getElementById('userListContainer');
        const list = document.getElementById('userList');
        if (!container || !list) return;

        list.innerHTML = '';
        const users = Object.keys(DataManager.getUsers());

        if (users.length === 0) {
            list.innerHTML = `<li class="text-slate-500 text-sm">Aucun profil détecté sur cette machine.</li>`;
        } else {
            users.forEach(u => {
                const li = document.createElement('li');
                li.className = "flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 text-sm text-slate-300 border border-white/5";
                li.innerHTML = `<span>👤</span> <strong>${u}</strong> ${u === currentUser ? '<span class="text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">Actif</span>' : ''}`;
                list.appendChild(li);
            });
        }
        container.classList.remove('hidden');
    }
};

/**
 * 5. TASKS LOGIC MODULE
 */
const Tasks = {
    add() {
        if (!currentUser) return App.showToast("Veuillez d'abord vous connecter.", "error");

        const textInput = document.getElementById('taskInput');
        const text = textInput?.value.trim();
        if (!text) return App.showToast(translations[currentLang || 'fr'].taskRequired, "error");

        const newTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            owner: currentUser,
            text: text,
            date: document.getElementById('taskDate')?.value || '',
            time: document.getElementById('taskTime')?.value || '',
            category: document.getElementById('taskCategory')?.value || 'Général',
            priority: document.getElementById('taskPriority')?.value || 'medium',
            status: document.getElementById('taskStatus')?.value || 'active'
        };

        const tasks = DataManager.getTasks();
        tasks.push(newTask);
        DataManager.saveTasks(tasks);

        if (textInput) textInput.value = '';
        App.refreshAll();
        App.showToast("Tâche ajoutée au registre local.", "success");
    },

    toggleStatus(id) {
        const tasks = DataManager.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = task.status === 'completed' ? 'active' : 'completed';
            DataManager.saveTasks(tasks);
            App.refreshAll();
        }
    },

    delete(id) {
        let tasks = DataManager.getTasks();
        tasks = tasks.filter(t => t.id !== id);
        DataManager.saveTasks(tasks);
        App.refreshAll();
        App.showToast("Tâche supprimée.", "info");
    },

    clearCompleted() {
        if (!currentUser) return;
        let tasks = DataManager.getTasks();
        tasks = tasks.filter(t => !(t.owner === currentUser && t.status === 'completed'));
        DataManager.saveTasks(tasks);
        App.refreshAll();
        App.showToast("Nettoyage des archives terminé.", "info");
    }
};

/**
 * 6. CLOUD SIMULATION & SYSTEM BACKUPS
 */
const System = {
    exportBackup() {
        if (!currentUser) return App.showToast("Connectez-vous pour exporter.", "error");
        const allTasks = DataManager.getTasks().filter(t => t.owner === currentUser);

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allTasks, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `zoko_backup_${currentUser}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        App.showToast("Fichier de sauvegarde généré !", "success");
    },

    importBackup(e) {
        if (!currentUser) return App.showToast("Connectez-vous d'abord !", "error");
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const importedTasks = JSON.parse(event.target.result);
                if (Array.isArray(importedTasks)) {
                    let currentTasks = DataManager.getTasks();
                    // On nettoie les anciennes tâches de l'utilisateur pour éviter les doublons
                    currentTasks = currentTasks.filter(t => t.owner !== currentUser);

                    // On force le propriétaire sur les tâches importées par sécurité
                    importedTasks.forEach(t => t.owner = currentUser);

                    const merged = [...currentTasks, ...importedTasks];
                    DataManager.saveTasks(merged);
                    App.refreshAll();
                    App.showToast("Données restaurées avec succès.", "success");
                }
            } catch (err) {
                App.showToast("Fichier de sauvegarde invalide.", "error");
            }
        };
        reader.readAsText(file);
    }
};

/**
 * UTILS SYSTEM
 */
function switchSection(sectionId) {
    const sections = ["dashboardSection", "tasksSection", "addTaskSection", "usersSection"];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== sectionId);
    });

    const tabButtons = {
        'dashboardSection': 'dashboardTabBtn',
        'tasksSection': 'tasksTabBtn',
        'addTaskSection': 'addTaskTabBtn',
        'usersSection': 'usersTabBtn'
    };

    Object.entries(tabButtons).forEach(([sId, bId]) => {
        const btn = document.getElementById(bId);
        if (btn) {
            btn.classList.toggle('tab-btn-active', sId === sectionId);
        }
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    const body = document.body;
    const html = document.documentElement;
    body.classList.add(savedTheme);
    body.classList.toggle('light', savedTheme === 'light');
    html.classList.add(savedTheme);
    html.classList.toggle('light', savedTheme === 'light');
    body.dataset.theme = savedTheme;
    html.dataset.theme = savedTheme;
    const btn = document.getElementById('toggleDarkModeBtn');
    if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function initLanguage() {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    if (saved) currentLang = saved;
    if (!currentLang) {
        const nav = navigator.language || navigator.userLanguage || 'fr';
        if (nav.startsWith('en')) currentLang = 'en';
        else if (nav.startsWith('ja') || nav.startsWith('jp')) currentLang = 'jp';
        else currentLang = 'fr';
    }
    applyLanguage();
}

function setLanguage(lang) {
    currentLang = lang || 'fr';
    localStorage.setItem(STORAGE_KEYS.LANG, currentLang);
    applyLanguage();
    App.showToast(`Langue sélectionnée : ${currentLang.toUpperCase()}`, 'info');
}

function applyLanguage() {
    try {
        document.documentElement.lang = currentLang;
    } catch (e) { }

    const keys = ['mainSectionLabel', 'title', 'heroNote', 'heroDescription', 'addTaskTitle'];
    keys.forEach(k => {
        const el = document.getElementById(k);
        if (el && translations[currentLang] && translations[currentLang][k]) {
            el.textContent = translations[currentLang][k];
        }
    });

    const langSelect = document.getElementById('languageSelect');
    if (langSelect) langSelect.value = currentLang;
}
// --- FONCTIONNALITÉS DE SECOURS (RESET & OUBLI) ---
document.addEventListener("DOMContentLoaded", () => {
    const forgotBtn = document.getElementById("forgotPasswordBtn");
    const resetAllBtn = document.getElementById("resetAllDataBtn");

    if (forgotBtn) {
        forgotBtn.addEventListener("click", () => {
            const localUsers = JSON.parse(localStorage.getItem("zoko_users")) || {};
            const usernames = Object.keys(localUsers);

            if (usernames.length === 0) {
                alert("Aucun compte n'existe sur ce navigateur. Créez-en un d'abord !");
                return;
            }

            let message = "Comptes trouvés sur cet appareil :\n";
            usernames.forEach(user => {
                message += `- Identifiant : ${user} (Mot de passe : ${localUsers[user].password})\n`;
            });
            alert(message);
        });
    }

    if (resetAllBtn) {
        resetAllBtn.addEventListener("click", () => {
            if (confirm("⚠️ Effacer TOUS les comptes et tâches du site ?")) {
                localStorage.clear();
                alert("Site réinitialisé !");
                window.location.reload();
            }
        });
    }
});