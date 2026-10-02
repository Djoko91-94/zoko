/**
 * ZOKO PRO — APPLICATION CONFIGURATION & STATE
 */
const STORAGE_KEYS = {
    USERS: 'zoko_users',
    TASKS: 'zoko_tasks',
    CURRENT_USER: 'zoko_current_user',
    AUTH_TOKEN: 'zoko_auth_token',
    THEME: 'zoko_theme',
    LANG: 'zoko_lang',
    NEXT_WEEK_REMINDER: 'zoko_next_week_reminder',
    NEXT_WEEK_LAST_CHECK: 'zoko_next_week_last_check',
    UNFINISHED_EMAIL_LAST_SENT: 'zoko_unfinished_email_last_sent'
};

function escapeHtml(input) {
    if (input == null) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function evaluatePasswordStrength(password) {
    const value = String(password || '');
    const checks = {
        minLength: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        digit: /\d/.test(value),
        special: /[^A-Za-z0-9]/.test(value)
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { score, checks, isStrong: score === 5 };
}

function updatePasswordStrengthUI(inputId, barId, textId) {
    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    if (!input || !bar || !text) return;

    const value = input.value || '';
    const { score } = evaluatePasswordStrength(value);
    let width = '0%';
    let className = 'h-full rounded-full transition-all duration-300 bg-slate-700';
    let label = '';

    if (!value) {
        label = '';
    } else if (score <= 2) {
        width = '35%';
        className = 'h-full rounded-full transition-all duration-300 bg-rose-500';
        label = t('passwordStrengthWeak');
    } else if (score === 3) {
        width = '60%';
        className = 'h-full rounded-full transition-all duration-300 bg-amber-500';
        label = t('passwordStrengthMedium');
    } else if (score === 4) {
        width = '80%';
        className = 'h-full rounded-full transition-all duration-300 bg-lime-500';
        label = t('passwordStrengthStrong');
    } else {
        width = '100%';
        className = 'h-full rounded-full transition-all duration-300 bg-emerald-500';
        label = t('passwordStrengthVeryStrong');
    }

    bar.className = className;
    bar.style.width = width;
    text.textContent = label;
}

function initPasswordStrengthIndicators() {
    const bindings = [
        ['registerPassword', 'registerPasswordStrengthBar', 'registerPasswordStrengthText'],
        ['forgotNewPassword', 'forgotPasswordStrengthBar', 'forgotPasswordStrengthText']
    ];

    bindings.forEach(([inputId, barId, textId]) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        const render = () => updatePasswordStrengthUI(inputId, barId, textId);
        input.addEventListener('input', render);
        render();
    });
}

function initPasswordVisibilityToggles() {
    const bindings = [
        ['forgotNewPassword', 'toggleForgotNewPasswordBtn'],
        ['forgotConfirmPassword', 'toggleForgotConfirmPasswordBtn']
    ];

    bindings.forEach(([inputId, buttonId]) => {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        if (!input || !button) return;

        button.addEventListener('click', () => {
            const willShow = input.type === 'password';
            input.type = willShow ? 'text' : 'password';
            button.textContent = willShow ? '🙈' : '👁';
            button.setAttribute('aria-label', willShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
            button.setAttribute('title', willShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        });
    });
}

let currentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || null;
let authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || null;
let currentLang = localStorage.getItem(STORAGE_KEYS.LANG) || null;
let currentFilter = 'all';
let currentCategoryFilter = 'all';
let currentSortMode = 'date-desc';
let calendarDate = new Date();
let deferredInstallPrompt = null;
let lastFocusedBeforeModal = null;
let editingTaskId = null;
let resetRequested = false;

function getVisibleTasks() {
    const searchQuery = document.getElementById('searchTask')?.value.toLowerCase().trim() || '';
    let tasks = DataManager.getTasks().filter(task => task.owner === currentUser);

    if (currentCategoryFilter !== 'all') {
        tasks = tasks.filter(task => (task.category || 'Général') === currentCategoryFilter);
    }

    const todayStr = getLocalDateKey();
    if (currentFilter === 'today') {
        tasks = tasks.filter(task => task.date === todayStr);
    } else if (currentFilter === 'week') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        tasks = tasks.filter(task => {
            if (!task.date) return false;
            const taskDate = new Date(`${task.date}T00:00:00`);
            return taskDate >= weekStart && taskDate < weekEnd;
        });
    } else if (currentFilter === 'completed') {
        tasks = tasks.filter(task => task.status === 'completed');
    }

    if (searchQuery) {
        tasks = tasks.filter(task => task.text.toLowerCase().includes(searchQuery) || (task.category || '').toLowerCase().includes(searchQuery));
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...tasks].sort((a, b) => {
        if (currentSortMode === 'priority') {
            const aPriority = priorityOrder[a.priority] ?? 99;
            const bPriority = priorityOrder[b.priority] ?? 99;
            return aPriority - bPriority;
        }
        if (currentSortMode === 'status') {
            return (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0);
        }
        const aDate = a.date || '';
        const bDate = b.date || '';
        if (currentSortMode === 'date-asc') {
            return aDate.localeCompare(bDate);
        }
        return bDate.localeCompare(aDate);
    });
}

const translations = {
    fr: {
        pageTitle: "Zoko Pro — Gestionnaire de tâches",
        mainSectionLabel: "Tableau de bord Zoko",
        title: "Zoko Pro",
        heroNote: "Interface rapide • Multilingue • Gestion sécurisée",
        heroDescription: "Organisez vos tâches, gérez vos projets et restez concentré avec une interface claire.",
        learnMoreTitle: "Liquid Glass Light",
        learnMoreDescription: "Une interface fluide et lumineuse refaite à 100% avec les classes utilitaires de Tailwind CSS.",
        learnMorePoint1: "Verre dépoli clair et lisible",
        learnMorePoint2: "Design rapide à faire évoluer",
        learnMorePoint3: "Base moderne pour le tableau de bord",
        learnMoreOpenBtn: "En savoir plus",
        learnMoreActionBtn: "Voir les tâches",
        learnMoreCloseBtn: "Fermer",
        footerContactTitle: "Contact",
        footerContactText: "Besoin d'aide ou d'informations ? Contactez-nous.",
        footerContactAvailability: "Disponible du lundi au vendredi, 08:00 - 18:00.",
        footerNavTitle: "Navigation",
        footerLegalTitle: "Légal",
        footerLinkDashboard: "Tableau de bord",
        footerLinkTasks: "Tâches",
        footerLinkProfile: "Profil",
        footerLinkUsers: "Utilisateurs",
        footerLinkAbout: "À propos",
        footerLinkPrivacy: "Politique de confidentialité",
        footerLinkTerms: "Conditions d'utilisation",
        footerRights: "Tous droits réservés.",
        footerTagline: "Productivité simple. Résultats solides.",
        headerDescription: "Gestionnaire de tâches moderne pour votre quotidien.",
        dashboardTab: "Tableau de bord",
        tasksTab: "Tâches",
        profileTab: "Profil",
        addTaskTab: "Profil",
        usersTab: "Utilisateurs",
        dashboardTotalLabel: "Total de tâches",
        dashboardCompletedLabel: "Terminées",
        dashboardPendingLabel: "En cours",
        dashboardTodayLabel: "À faire aujourd’hui",
        dashboardOverdueLabel: "En retard",
        chartPieTitle: "Graphique circulaire",
        pieChartLabel: "Tâches terminées vs en cours",
        chartProgressTitle: "Graphique de progression",
        progressSuffix: "complété",
        chartWeeklyTitle: "Productivité hebdomadaire",
        weeklyLegend: "Barres colorées selon le taux de complétion.",
        calendarTitle: "Calendrier",
        calendarSubTitle: "Vue mensuelle",
        tasksTitle: "📋 Mes tâches",
        searchBtn: "OK",
        searchPlaceholder: "🔍 Rechercher",
        filterAll: "Toutes",
        filterToday: "Aujourd'hui",
        filterWeek: "Cette semaine",
        filterCompleted: "Terminées",
        usernameLabel: "Identifiant",
        passwordLabel: "Mot de passe",
        registerFullNameLabel: "Nom complet",
        registerBirthdateLabel: "Date de naissance",
        genderLabel: "Genre",
        genderPlaceholder: "Sélectionnez un genre",
        genderMale: "Masculin",
        genderFemale: "Féminin",
        birthdateHint: "Utilisez une année sur 4 chiffres (ex: 2002).",
        registerPhoneLabel: "Numéro de téléphone",
        emailLabel: "Adresse mail",
        emailReminderLabel: "Recevoir des emails pour les tâches non terminées",
        submitProfileBtn: "Valider l'inscription",
        logoutUserBtn: "Déconnexion",
        resetAllDataBtn: "Réinitialiser l'application",
        enableNotificationsBtn: "Activer notifications",
        nextWeekReminderTitle: "Rappel semaine prochaine",
        nextWeekReminderDescription: "Recevoir un rappel des tâches prévues pour la semaine prochaine.",
        nextWeekReminderToggleLabel: "Activer le rappel hebdomadaire",
        testNextWeekReminderBtn: "Tester le rappel",
        nextWeekReminderEnabled: "Rappel semaine prochaine activé.",
        nextWeekReminderDisabled: "Rappel semaine prochaine désactivé.",
        nextWeekReminderNone: "Aucune tâche prévue la semaine prochaine.",
        nextWeekReminderFound: "tâche(s) prévue(s) pour la semaine prochaine.",
        syncBtn: "Synchroniser",
        downloadBackupBtn: "Sauvegarde cloud",
        restoreBackupBtn: "Restaurer cloud",
        clearCompletedBtn: "Supprimer terminées",
        installAppBtn: "Installer l'app",
        addTaskBtn: "Ajouter la tâche",
        addTaskTitle: "✍️ Ajouter une tâche",
        taskInputPlaceholder: "Nouvelle tâche",
        categoryPlaceholder: "Catégorie",
        categoryGeneral: "📌 Général",
        categorySchool: "📚 École",
        categoryWork: "💻 Travail",
        categoryPersonal: "🧡 Personnel",
        categoryJapanese: "🎌 Japonais",
        categorySport: "🏃 Sport",
        priorityPlaceholder: "Priorité",
        priorityHigh: "🔴 Haute",
        priorityMedium: "🟠 Moyenne",
        priorityLow: "🟢 Basse",
        statusActive: "En cours",
        statusCompleted: "Terminée",
        usersSectionTitle: "Utilisateurs",
        usersSectionDescription: "Consultez les profils créés et gérez les accès.",
        manageUsersTitle: "Gestion des profils",
        selectUserToEditLabel: "Choisir un utilisateur à modifier",
        selectUserPlaceholder: "Sélectionnez un utilisateur",
        editSelectedUserBtn: "Modifier",
        deleteSelectedUserBtn: "Supprimer",
        showUsersBtn: "Charger la liste",
        userListTitle: "Liste des utilisateurs",
        editProfileBtn: "Modifier",
        editProfileTitle: "Modifier le profil",
        saveProfileBtn: "Enregistrer",
        cancelEditProfileBtn: "Annuler",
        loginUserBtn: "Se connecter",
        forgotPasswordBtn: "Mot de passe oublié ?",
        createUserBtn: "Créer un compte",
        submitRegisterBtn: "Valider l'inscription",
        cancelRegisterBtn: "Retour",
        forgotPanelTitle: "Réinitialiser le mot de passe",
        newPasswordLabel: "Nouveau mot de passe",
        confirmPasswordLabel: "Confirmer le mot de passe",
        resetPasswordBtn: "Réinitialiser",
        resetTokenLabel: "Code reçu par email",
        resetTokenSent: "Code envoyé. Consultez votre email puis saisissez-le.",
        resetTokenInvalid: "Code invalide ou expiré.",
        cancelForgotBtn: "Retour",
        loginPanelTitle: "🔐 Connexion",
        registerPanelTitle: "🧾 Inscription",
        registerHelpText: "Si vous n'avez pas encore de compte, créez-en un ici.",
        authStatusConnected: "🟢 Profil actif :",
        authStatusDisconnected: "🔴 Aucun profil actif. Créez un profil pour commencer.",
        fieldRequired: "Tous les champs sont requis.",
        invalidPhone: "Numéro de téléphone invalide.",
        invalidEmail: "Adresse mail invalide.",
        duplicateEmail: "Cette adresse mail est déjà utilisée.",
        unfinishedReminderTitle: "Tâches non terminées",
        unfinishedReminderBody: "tâche(s) non terminée(s) à revoir.",
        unfinishedEmailSent: "Rappel email envoyé pour vos tâches non terminées.",
        unfinishedEmailUnavailable: "Envoi email indisponible. Vérifiez le backend de notification.",
        invalidBirthdate: "Date de naissance invalide. Utilisez une année sur 4 chiffres.",
        passwordPolicyHint: "8+ caractères avec majuscule, minuscule, chiffre et symbole.",
        passwordStrengthWeak: "Sécurité faible",
        passwordStrengthMedium: "Sécurité moyenne",
        passwordStrengthStrong: "Sécurité forte",
        passwordStrengthVeryStrong: "Sécurité excellente",
        passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères.",
        passwordNotStrong: "Mot de passe trop faible. Ajoutez majuscule, minuscule, chiffre et symbole.",
        passwordMismatch: "Les mots de passe ne correspondent pas.",
        resetVerificationFailed: "Informations de vérification incorrectes.",
        passwordResetSuccess: "Mot de passe réinitialisé avec succès.",
        profileCreated: "Profil créé avec succès.",
        registrationSuccess: "Compte créé avec succès. Vous êtes maintenant connecté.",
        profileUpdated: "Profil mis à jour.",
        profileDeleted: "Profil supprimé.",
        profileExists: "Un profil existe déjà avec ce téléphone.",
        noProfileSelected: "Aucun profil sélectionné.",
        deleteProfileConfirm: "Supprimer ce profil et toutes ses tâches ?",
        duplicateUsername: "Ce nom d'utilisateur existe déjà.",
        installationUnavailable: "Installation non disponible pour le moment.",
        invalidCredentials: "Identifiant ou mot de passe incorrect.",
        backendUnavailable: "Serveur indisponible. Vérifiez votre connexion et réessayez.",
        passwordResetUnavailable: "La réinitialisation doit être faite depuis le serveur.",
        taskRequired: "Veuillez saisir une tâche.",
        taskAdded: "Tâche ajoutée.",
        taskSyncWarning: "La tâche a été mise à jour localement, mais la synchronisation avec le serveur a échoué.",
        tasksCompleted: "Les tâches visibles sont terminées.",
        tasksReopened: "Les tâches visibles ont été rouvertes.",
        taskDeleted: "Tâche supprimée.",
        cleanupCompleted: "Nettoyage des archives terminé.",
        noTasksToBackup: "Aucune tâche à sauvegarder.",
        createProfilePrompt: "Créez un profil pour commencer.",
        noTasksAvailable: "Aucune tâche disponible.",
        calendarNoProfile: "Créez un profil pour voir vos tâches dans le calendrier.",
        calendarEmptyMonth: "Aucune tâche programmée ce mois-ci.",
        calendarPreviewActive: "En cours",
        calendarPreviewCompleted: "Terminées",
        pieLegendCompleted: "Fait",
        pieLegendPending: "En cours",
        noUsersDetected: "Aucun profil détecté sur cette machine.",
        userFieldFullName: "Nom complet",
        userFieldBirthdate: "Date de naissance",
        userFieldGender: "Genre",
        userFieldPhone: "Téléphone",
        userFieldEmail: "Email",
        notificationsUnsupported: "Notifications non supportées par ce navigateur.",
        notificationsAlreadyAllowed: "Notifications déjà autorisées.",
        notificationsEnabled: "Notifications activées.",
        notificationsDenied: "Notifications non autorisées.",
        taskDueReminderTitle: "Rappel de tâche",
        taskDueReminderBody: "C'est l'heure de : {task}",
        taskDueReminderDescription: "Recevez un rappel à la date et l'heure de vos tâches. L'application doit rester ouverte.",
        taskDueReminderMarkDone: "Marquer comme faite",
        taskDueReminderOpen: "Voir la tâche",
        taskDueReminderCompleted: "Tâche marquée comme faite.",
        resetAllConfirm: "⚠️ Effacer TOUS les profils et tâches du site ?",
        resetAllDone: "Site réinitialisé !",
        logoutSuccess: "Déconnexion effectuée.",
        backupDownloaded: "Sauvegarde téléchargée avec succès.",
        restoreSuccess: "Restauration terminée. Les tâches ont été importées.",
        backupInvalid: "Fichier de sauvegarde invalide ou endommagé.",
        installCompleted: "Application installée !",
        installCancelled: "Installation annulée."
    },
    en: {
        pageTitle: "Zoko Pro — Task Manager",
        mainSectionLabel: "Zoko Dashboard",
        title: "Zoko Pro",
        heroNote: "Fast interface • Multilingual • Secure management",
        heroDescription: "Organize your tasks, manage projects and stay focused with a clean interface.",
        learnMoreTitle: "Liquid Glass Light",
        learnMoreDescription: "A bright, fluid interface rebuilt entirely with Tailwind CSS utility classes.",
        learnMorePoint1: "Clear, readable frosted glass",
        learnMorePoint2: "Fast-to-evolve design system",
        learnMorePoint3: "Modern base for the dashboard",
        learnMoreOpenBtn: "Learn more",
        learnMoreActionBtn: "See tasks",
        learnMoreCloseBtn: "Close",
        footerContactTitle: "Contact",
        footerContactText: "Need help or more information? Contact us.",
        footerContactAvailability: "Available Monday to Friday, 08:00 - 18:00.",
        footerNavTitle: "Navigation",
        footerLegalTitle: "Legal",
        footerLinkDashboard: "Dashboard",
        footerLinkTasks: "Tasks",
        footerLinkProfile: "Profile",
        footerLinkUsers: "Users",
        footerLinkAbout: "About",
        footerLinkPrivacy: "Privacy Policy",
        footerLinkTerms: "Terms of Use",
        footerRights: "All rights reserved.",
        footerTagline: "Simple productivity. Solid results.",
        headerDescription: "A modern task manager for your daily flow.",
        dashboardTab: "Dashboard",
        tasksTab: "Tasks",
        profileTab: "Profile",
        addTaskTab: "Profile",
        usersTab: "Users",
        dashboardTotalLabel: "Total tasks",
        dashboardCompletedLabel: "Completed",
        dashboardPendingLabel: "In progress",
        dashboardTodayLabel: "Due today",
        dashboardOverdueLabel: "Overdue",
        chartPieTitle: "Pie chart",
        pieChartLabel: "Completed vs in progress tasks",
        chartProgressTitle: "Progress chart",
        progressSuffix: "completed",
        chartWeeklyTitle: "Weekly productivity",
        weeklyLegend: "Bars show completion rate.",
        calendarTitle: "Calendar",
        calendarSubTitle: "Monthly view",
        tasksTitle: "📋 My tasks",
        searchBtn: "Search",
        searchPlaceholder: "Search tasks...",
        filterAll: "All",
        filterToday: "Today",
        filterWeek: "This week",
        filterCompleted: "Completed",
        usernameLabel: "Username",
        passwordLabel: "Password",
        registerFullNameLabel: "Full name",
        registerBirthdateLabel: "Birthdate",
        genderLabel: "Gender",
        genderPlaceholder: "Select a gender",
        genderMale: "Male",
        genderFemale: "Female",
        birthdateHint: "Use a 4-digit year (e.g. 2002).",
        registerPhoneLabel: "Phone number",
        emailLabel: "Email address",
        emailReminderLabel: "Receive emails for unfinished tasks",
        submitProfileBtn: "Submit registration",
        logoutUserBtn: "Logout",
        resetAllDataBtn: "Reset app",
        enableNotificationsBtn: "Enable notifications",
        nextWeekReminderTitle: "Next week reminder",
        nextWeekReminderDescription: "Receive a reminder for tasks planned next week.",
        nextWeekReminderToggleLabel: "Enable weekly reminder",
        testNextWeekReminderBtn: "Test reminder",
        nextWeekReminderEnabled: "Next week reminder enabled.",
        nextWeekReminderDisabled: "Next week reminder disabled.",
        nextWeekReminderNone: "No tasks planned for next week.",
        nextWeekReminderFound: "task(s) planned for next week.",
        syncBtn: "Sync",
        downloadBackupBtn: "Cloud backup",
        restoreBackupBtn: "Restore backup",
        clearCompletedBtn: "Clear completed",
        installAppBtn: "Install app",
        addTaskBtn: "Add task",
        addTaskTitle: "✍️ Add a task",
        taskInputPlaceholder: "New task",
        categoryPlaceholder: "Category",
        categoryGeneral: "📌 General",
        categorySchool: "📚 School",
        categoryWork: "💻 Work",
        categoryPersonal: "🧡 Personal",
        categoryJapanese: "🎌 Japanese",
        categorySport: "🏃 Sport",
        priorityPlaceholder: "Priority",
        priorityHigh: "🔴 High",
        priorityMedium: "🟠 Medium",
        priorityLow: "🟢 Low",
        statusActive: "Active",
        statusCompleted: "Completed",
        usersSectionTitle: "Users",
        usersSectionDescription: "Review created profiles and manage access.",
        manageUsersTitle: "Profile management",
        selectUserToEditLabel: "Choose a user to edit",
        selectUserPlaceholder: "Select a user",
        editSelectedUserBtn: "Edit",
        deleteSelectedUserBtn: "Delete",
        showUsersBtn: "Load list",
        userListTitle: "User list",
        editProfileBtn: "Edit",
        editProfileTitle: "Edit profile",
        saveProfileBtn: "Save",
        cancelEditProfileBtn: "Cancel",
        loginUserBtn: "Log in",
        forgotPasswordBtn: "Forgot password?",
        createUserBtn: "Create account",
        submitRegisterBtn: "Submit registration",
        cancelRegisterBtn: "Back",
        forgotPanelTitle: "Reset password",
        newPasswordLabel: "New password",
        confirmPasswordLabel: "Confirm password",
        resetPasswordBtn: "Reset",
        resetTokenLabel: "Email reset code",
        resetTokenSent: "Code sent. Check your email and enter it here.",
        resetTokenInvalid: "Invalid or expired code.",
        cancelForgotBtn: "Back",
        loginPanelTitle: "🔐 Login",
        registerPanelTitle: "🧾 Registration",
        registerHelpText: "If you do not have an account yet, create one here.",
        authStatusConnected: "🟢 Active profile:",
        authStatusDisconnected: "🔴 No active profile. Create one to get started.",
        fieldRequired: "All fields are required.",
        invalidPhone: "Invalid phone number.",
        invalidEmail: "Invalid email address.",
        duplicateEmail: "This email address is already used.",
        unfinishedReminderTitle: "Unfinished tasks",
        unfinishedReminderBody: "unfinished task(s) to review.",
        unfinishedEmailSent: "Email reminder sent for your unfinished tasks.",
        unfinishedEmailUnavailable: "Email sending unavailable. Check notification backend.",
        invalidBirthdate: "Invalid birthdate. Use a 4-digit year.",
        passwordPolicyHint: "Use 8+ chars with uppercase, lowercase, number and symbol.",
        passwordStrengthWeak: "Weak strength",
        passwordStrengthMedium: "Medium strength",
        passwordStrengthStrong: "Strong strength",
        passwordStrengthVeryStrong: "Excellent strength",
        passwordTooShort: "Password must be at least 8 characters.",
        passwordNotStrong: "Password is too weak. Add uppercase, lowercase, number and symbol.",
        passwordMismatch: "Passwords do not match.",
        resetVerificationFailed: "Verification details are incorrect.",
        passwordResetSuccess: "Password reset successfully.",
        profileCreated: "Profile created successfully.",
        registrationSuccess: "Account created successfully. You are now signed in.",
        profileUpdated: "Profile updated.",
        profileDeleted: "Profile deleted.",
        profileExists: "A profile already exists with this phone.",
        noProfileSelected: "No profile selected.",
        deleteProfileConfirm: "Delete this profile and all its tasks?",
        duplicateUsername: "That username already exists.",
        installationUnavailable: "Installation is not available right now.",
        invalidCredentials: "Incorrect username or password.",
        backendUnavailable: "Server unavailable. Check your connection and try again.",
        passwordResetUnavailable: "Password reset must be completed through the server.",
        taskRequired: "Please enter a task.",
        taskAdded: "Task added.",
        taskSyncWarning: "The tasks were updated locally, but synchronization with the server failed.",
        tasksCompleted: "Visible tasks marked as completed.",
        tasksReopened: "Visible tasks reopened.",
        taskDeleted: "Task deleted.",
        cleanupCompleted: "Archive cleanup completed.",
        noTasksToBackup: "No tasks available to backup.",
        createProfilePrompt: "Create a profile to get started.",
        noTasksAvailable: "No tasks available.",
        calendarNoProfile: "Create a profile to see tasks in the calendar.",
        calendarEmptyMonth: "No tasks scheduled this month.",
        calendarPreviewActive: "Active",
        calendarPreviewCompleted: "Completed",
        pieLegendCompleted: "Done",
        pieLegendPending: "In progress",
        noUsersDetected: "No profile detected on this device.",
        userFieldFullName: "Full name",
        userFieldBirthdate: "Birthdate",
        userFieldGender: "Gender",
        userFieldPhone: "Phone",
        userFieldEmail: "Email",
        notificationsUnsupported: "Notifications are not supported by this browser.",
        notificationsAlreadyAllowed: "Notifications are already enabled.",
        notificationsEnabled: "Notifications enabled.",
        notificationsDenied: "Notifications not allowed.",
        taskDueReminderTitle: "Task reminder",
        taskDueReminderBody: "It's time for: {task}",
        taskDueReminderDescription: "Get a reminder when a task is due. Keep the app open to receive reminders.",
        taskDueReminderMarkDone: "Mark as done",
        taskDueReminderOpen: "View task",
        taskDueReminderCompleted: "Task marked as done.",
        resetAllConfirm: "⚠️ Delete ALL profiles and tasks from this app?",
        resetAllDone: "App reset complete!",
        logoutSuccess: "Logged out successfully.",
        backupDownloaded: "Backup downloaded successfully.",
        restoreSuccess: "Restore completed. Tasks have been imported.",
        backupInvalid: "Invalid or damaged backup file.",
        installCompleted: "App installed!",
        installCancelled: "Installation canceled."
    },
    jp: {
        pageTitle: "Zoko Pro — タスク管理",
        mainSectionLabel: "Zoko ダッシュボード",
        title: "Zoko Pro",
        heroNote: "高速インターフェース • 多言語対応 • 安全な管理",
        heroDescription: "タスクを整理し、プロジェクトを管理し、使いやすいインターフェースで集中を保ちます。",
        learnMoreTitle: "リキッドガラスライト",
        learnMoreDescription: "Tailwind CSS のユーティリティクラスだけで再構築した、明るく滑らかな UI です。",
        learnMorePoint1: "見やすいすりガラス表現",
        learnMorePoint2: "素早く拡張できるデザイン",
        learnMorePoint3: "ダッシュボードのための最新ベース",
        learnMoreOpenBtn: "詳しく見る",
        learnMoreActionBtn: "タスクを見る",
        learnMoreCloseBtn: "閉じる",
        footerContactTitle: "お問い合わせ",
        footerContactText: "ご質問や詳細が必要な場合は、お気軽にご連絡ください。",
        footerContactAvailability: "対応時間: 月曜日から金曜日 08:00 - 18:00。",
        footerNavTitle: "ナビゲーション",
        footerLegalTitle: "法的情報",
        footerLinkDashboard: "ダッシュボード",
        footerLinkTasks: "タスク",
        footerLinkProfile: "プロフィール",
        footerLinkUsers: "ユーザー",
        footerLinkAbout: "会社概要",
        footerLinkPrivacy: "プライバシーポリシー",
        footerLinkTerms: "利用規約",
        footerRights: "無断転載を禁じます。",
        footerTagline: "シンプルな生産性。確かな成果。",
        headerDescription: "日々のワークフローのためのモダンなタスクマネージャーです。",
        dashboardTab: "ダッシュボード",
        tasksTab: "タスク",
        profileTab: "プロフィール",
        addTaskTab: "プロフィール",
        usersTab: "ユーザー",
        dashboardTotalLabel: "合計タスク数",
        dashboardCompletedLabel: "完了済み",
        dashboardPendingLabel: "進行中",
        dashboardTodayLabel: "今日の予定",
        dashboardOverdueLabel: "期限切れ",
        chartPieTitle: "円グラフ",
        pieChartLabel: "完了したタスクと進行中のタスク",
        chartProgressTitle: "進捗グラフ",
        progressSuffix: "完了",
        chartWeeklyTitle: "週間の生産性",
        weeklyLegend: "バーは完了率を示します。",
        calendarTitle: "カレンダー",
        calendarSubTitle: "月表示",
        tasksTitle: "📋 タスク",
        searchBtn: "検索",
        searchPlaceholder: "タスクを検索...",
        filterAll: "すべて",
        filterToday: "今日",
        filterWeek: "今週",
        filterCompleted: "完了済み",
        usernameLabel: "ユーザー名",
        passwordLabel: "パスワード",
        registerFullNameLabel: "氏名",
        registerBirthdateLabel: "生年月日",
        genderLabel: "性別",
        genderPlaceholder: "性別を選択",
        genderMale: "男性",
        genderFemale: "女性",
        birthdateHint: "年は4桁で入力してください（例: 2002）。",
        registerPhoneLabel: "電話番号",
        emailLabel: "メールアドレス",
        emailReminderLabel: "未完了タスクのメール通知を受け取る",
        submitProfileBtn: "登録を確定",
        logoutUserBtn: "ログアウト",
        resetAllDataBtn: "アプリをリセット",
        enableNotificationsBtn: "通知を有効にする",
        nextWeekReminderTitle: "来週のリマインダー",
        nextWeekReminderDescription: "来週予定されているタスクのリマインダーを受け取る。",
        nextWeekReminderToggleLabel: "週間リマインダーを有効にする",
        testNextWeekReminderBtn: "リマインダーをテスト",
        nextWeekReminderEnabled: "来週のリマインダーを有効化しました。",
        nextWeekReminderDisabled: "来週のリマインダーを無効化しました。",
        nextWeekReminderNone: "来週の予定タスクはありません。",
        nextWeekReminderFound: "件のタスクが来週に予定されています。",
        syncBtn: "同期",
        downloadBackupBtn: "クラウド保存",
        restoreBackupBtn: "クラウド復元",
        clearCompletedBtn: "完了済みを削除",
        installAppBtn: "アプリをインストール",
        addTaskBtn: "タスクを追加",
        addTaskTitle: "✍️ タスクを追加",
        taskInputPlaceholder: "新しいタスク",
        categoryPlaceholder: "カテゴリー",
        categoryGeneral: "📌 一般",
        categorySchool: "📚 学校",
        categoryWork: "💻 仕事",
        categoryPersonal: "🧡 個人",
        categoryJapanese: "🎌 日本語",
        categorySport: "🏃 スポーツ",
        priorityPlaceholder: "優先度",
        priorityHigh: "🔴 高",
        priorityMedium: "🟠 中",
        priorityLow: "🟢 低",
        statusActive: "進行中",
        statusCompleted: "完了",
        usersSectionTitle: "ユーザー",
        usersSectionDescription: "作成されたプロフィールを確認し、アクセスを管理します。",
        manageUsersTitle: "プロフィール管理",
        selectUserToEditLabel: "編集するユーザーを選択",
        selectUserPlaceholder: "ユーザーを選択",
        editSelectedUserBtn: "編集",
        deleteSelectedUserBtn: "削除",
        showUsersBtn: "リストを読み込む",
        userListTitle: "ユーザーリスト",
        editProfileBtn: "編集",
        editProfileTitle: "プロフィールを編集",
        saveProfileBtn: "保存",
        cancelEditProfileBtn: "キャンセル",
        loginUserBtn: "ログイン",
        forgotPasswordBtn: "パスワードを忘れた場合",
        createUserBtn: "アカウントを作成",
        submitRegisterBtn: "登録を確定",
        cancelRegisterBtn: "戻る",
        forgotPanelTitle: "パスワード再設定",
        newPasswordLabel: "新しいパスワード",
        confirmPasswordLabel: "パスワード確認",
        resetPasswordBtn: "再設定",
        resetTokenLabel: "メールで届いたコード",
        resetTokenSent: "コードを送信しました。メールを確認して入力してください。",
        resetTokenInvalid: "コードが無効または期限切れです。",
        cancelForgotBtn: "戻る",
        loginPanelTitle: "🔐 ログイン",
        registerPanelTitle: "🧾 登録",
        registerHelpText: "アカウントがまだない場合は、ここで作成してください。",
        authStatusConnected: "🟢 アクティブなプロフィール：",
        authStatusDisconnected: "🔴 アクティブなプロフィールがありません。開始するには作成してください。",
        fieldRequired: "すべてのフィールドを入力してください。",
        invalidPhone: "無効な電話番号です。",
        invalidEmail: "メールアドレスが無効です。",
        duplicateEmail: "このメールアドレスは既に使用されています。",
        unfinishedReminderTitle: "未完了タスク",
        unfinishedReminderBody: "未完了タスクがあります。確認してください。",
        unfinishedEmailSent: "未完了タスクのメール通知を送信しました。",
        unfinishedEmailUnavailable: "メール送信を利用できません。通知バックエンドを確認してください。",
        invalidBirthdate: "生年月日が無効です。年は4桁で入力してください。",
        passwordPolicyHint: "8文字以上で、大文字・小文字・数字・記号を含めてください。",
        passwordStrengthWeak: "強度: 弱い",
        passwordStrengthMedium: "強度: 普通",
        passwordStrengthStrong: "強度: 強い",
        passwordStrengthVeryStrong: "強度: 非常に強い",
        passwordTooShort: "パスワードは8文字以上にしてください。",
        passwordNotStrong: "パスワードが弱すぎます。大文字・小文字・数字・記号を追加してください。",
        passwordMismatch: "パスワードが一致しません。",
        resetVerificationFailed: "確認情報が正しくありません。",
        passwordResetSuccess: "パスワードを再設定しました。",
        profileCreated: "プロフィールが作成されました。",
        registrationSuccess: "アカウントを作成しました。ログイン済みです。",
        profileUpdated: "プロフィールを更新しました。",
        profileDeleted: "プロフィールを削除しました。",
        profileExists: "この電話番号はすでに使用されています。",
        noProfileSelected: "プロフィールが選択されていません。",
        deleteProfileConfirm: "このプロフィールと関連タスクを削除しますか？",
        duplicateUsername: "このユーザー名は既に存在します。",
        installationUnavailable: "現在インストールできません。",
        invalidCredentials: "ユーザー名またはパスワードが正しくありません。",
        backendUnavailable: "サーバーを利用できません。接続を確認して再試行してください。",
        passwordResetUnavailable: "パスワードのリセットはサーバーで行う必要があります。",
        taskRequired: "タスクを入力してください。",
        taskAdded: "タスクが追加されました。",
        taskSyncWarning: "タスクは端末に保存されましたが、サーバーとの同期に失敗しました。",
        tasksCompleted: "表示中のタスクを完了しました。",
        tasksReopened: "表示中のタスクを再開しました。",
        taskDeleted: "タスクが削除されました。",
        cleanupCompleted: "完了済みタスクの整理が完了しました。",
        noTasksToBackup: "バックアップするタスクがありません。",
        createProfilePrompt: "開始するにはプロフィールを作成してください。",
        noTasksAvailable: "利用可能なタスクがありません。",
        calendarNoProfile: "カレンダーでタスクを見るにはプロフィールを作成してください。",
        calendarEmptyMonth: "今月に予定されたタスクはありません。",
        calendarPreviewActive: "進行中",
        calendarPreviewCompleted: "完了",
        pieLegendCompleted: "完了",
        pieLegendPending: "進行中",
        noUsersDetected: "この端末にプロフィールはありません。",
        userFieldFullName: "氏名",
        userFieldBirthdate: "生年月日",
        userFieldGender: "性別",
        userFieldPhone: "電話番号",
        userFieldEmail: "メール",
        notificationsUnsupported: "このブラウザは通知に対応していません。",
        notificationsAlreadyAllowed: "通知は既に許可されています。",
        notificationsEnabled: "通知を有効にしました。",
        notificationsDenied: "通知は許可されませんでした。",
        taskDueReminderTitle: "タスクのリマインダー",
        taskDueReminderBody: "タスクの時間です: {task}",
        taskDueReminderDescription: "タスクの日時に通知します。通知を受け取るにはアプリを開いたままにしてください。",
        taskDueReminderMarkDone: "完了にする",
        taskDueReminderOpen: "タスクを表示",
        taskDueReminderCompleted: "タスクを完了にしました。",
        resetAllConfirm: "⚠️ このアプリの全プロフィールとタスクを削除しますか？",
        resetAllDone: "アプリをリセットしました。",
        logoutSuccess: "ログアウトしました。",
        backupDownloaded: "バックアップが正常にダウンロードされました。",
        restoreSuccess: "復元が完了しました。タスクがインポートされました。",
        backupInvalid: "無効または破損したバックアップファイルです。",
        installCompleted: "アプリがインストールされました！",
        installCancelled: "インストールがキャンセルされました。"
    }
};

function t(key) {
    return translations[currentLang || 'fr']?.[key] || translations.fr[key] || '';
}

function polarToCartesian(cx, cy, radius, angleDeg) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad)
    };
}

function describeArcPath(cx, cy, radius, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const arcSweep = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${arcSweep} 0 ${end.x} ${end.y}`;
}

const DataManager = {
    getUsers() {
        const raw = localStorage.getItem(STORAGE_KEYS.USERS);
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            console.warn('Storage utilisateur invalide, réinitialisation.', error);
            localStorage.removeItem(STORAGE_KEYS.USERS);
            return {};
        }
    },
    saveUsers(users) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    },
    getTasks() {
        const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Storage tâches invalide, réinitialisation.', error);
            localStorage.removeItem(STORAGE_KEYS.TASKS);
            return [];
        }
    },
    saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
};

function normalizeTask(task) {
    return {
        id: String(task?.id ?? ''),
        owner: task?.owner || currentUser || '',
        text: task?.text || '',
        date: task?.date || '',
        time: task?.time || '',
        category: task?.category || 'General',
        priority: task?.priority || 'medium',
        status: task?.status === 'completed' ? 'completed' : 'active',
        createdAt: task?.createdAt,
        updatedAt: task?.updatedAt
    };
}

const Api = {
    async request(path, { method = 'GET', body, requireAuth = true } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (requireAuth && authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(path, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const message = payload?.error || `HTTP ${response.status}`;
            throw new Error(message);
        }

        return payload;
    },

    persistSession(username, token) {
        currentUser = username;
        authToken = token;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, username);
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    },

    clearSession() {
        currentUser = null;
        authToken = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    async logout() {
        if (authToken) {
            try {
                await this.request('/api/logout', { method: 'POST' });
            } catch {
                // Ignore logout transport errors and still clear local session.
            }
        }
        this.clearSession();
    },

    async register(payload) {
        return this.request('/api/users', {
            method: 'POST',
            requireAuth: false,
            body: payload
        });
    },

    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            requireAuth: false,
            body: { username, password }
        });
    },

    async requestPasswordReset(username, dateNaissance, telephone) {
        return this.request('/api/password/reset/request', {
            method: 'POST',
            requireAuth: false,
            body: { username, dateNaissance, telephone }
        });
    },

    async confirmPasswordReset(token, password) {
        return this.request('/api/password/reset/confirm', {
            method: 'POST',
            requireAuth: false,
            body: { token, password }
        });
    },

    async fetchTasks() {
        const tasks = await this.request('/api/tasks');
        return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
    },

    async createTask(task) {
        const payload = await this.request('/api/tasks', {
            method: 'POST',
            body: task
        });
        return normalizeTask(payload?.task || payload);
    },

    async updateTask(id, updates) {
        const payload = await this.request(`/api/tasks/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: updates
        });
        return normalizeTask(payload);
    },

    async deleteTask(id) {
        return this.request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async downloadBackup() {
        return this.request('/api/backup');
    },

    async restoreBackup(tasks) {
        return this.request('/api/backup', {
            method: 'POST',
            body: { tasks }
        });
    },

    async syncTasksFromServer() {
        if (!authToken || !currentUser) return false;
        try {
            const tasks = await this.fetchTasks();
            DataManager.saveTasks(tasks);
            return true;
        } catch {
            return false;
        }
    }
};

const App = {
    refreshAll() {
        this.updateAuthUI();
        this.renderTaskList();
        this.renderDashboardStats();
        this.renderCalendar();
    },

    updateAuthUI() {
        const statusEl = document.getElementById('authStatus');
        if (!statusEl) return;
        statusEl.textContent = currentUser
            ? `${translations[currentLang || 'fr'].authStatusConnected} ${this.getActiveProfileName()}`
            : translations[currentLang || 'fr'].authStatusDisconnected;
        Notifications.syncReminderUI();
    },

    getActiveProfileName() {
        const users = DataManager.getUsers();
        const profile = users[currentUser];
        return profile ? profile.nom || profile.username || 'Utilisateur' : 'Utilisateur';
    },

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;

        const colors = {
            success: 'bg-emerald-600 border border-emerald-500 text-white',
            error: 'bg-rose-600 border border-rose-500 text-white',
            info: 'bg-slate-800 border border-slate-700 text-slate-200'
        };

        toast.className = `fixed top-5 right-5 px-5 py-3 rounded-2xl shadow-2xl z-50 transition-all duration-300 transform translate-y-0 ${colors[type]}`;
        toast.classList.remove('hidden');

        clearTimeout(toast.hideTimeout);
        toast.hideTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3500);
    },

    highlightInvalidField(input) {
        if (!input) return;
        input.classList.add('border-red-500');
        input.classList.remove('border-slate-700');
        input.setAttribute('aria-invalid', 'true');
    },

    clearInvalidField(input) {
        if (!input) return;
        input.classList.remove('border-red-500');
        input.classList.add('border-slate-700');
        input.removeAttribute('aria-invalid');
    },

    validateLoginFields() {
        const fields = ['loginUsername', 'loginPassword'];
        const missing = [];

        fields.forEach(id => {
            const input = document.getElementById(id);
            if (!input || !input.value.trim()) missing.push(input);
        });

        if (missing.length > 0) {
            missing.forEach(input => this.highlightInvalidField(input));
            missing[0]?.focus();
            this.showToast(translations[currentLang || 'fr'].fieldRequired, 'error');
            return false;
        }

        return true;
    },

    validateRegistrationFields() {
        const fields = [
            'registerUsername',
            'registerPassword',
            'registerBirthdate',
            'registerGender',
            'registerPhone',
            'registerEmail'
        ];
        const missing = [];

        fields.forEach(id => {
            const input = document.getElementById(id);
            if (!input || !input.value.trim()) missing.push(input);
        });

        if (missing.length > 0) {
            missing.forEach(input => this.highlightInvalidField(input));
            missing[0]?.focus();
            this.showToast(translations[currentLang || 'fr'].fieldRequired, 'error');
            return false;
        }

        const birthdateInput = document.getElementById('registerBirthdate');
        const birthdateValue = birthdateInput?.value.trim() || '';
        const birthdateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdateValue);
        const birthYear = birthdateMatch ? Number(birthdateMatch[1]) : 0;
        const birthMonth = birthdateMatch ? Number(birthdateMatch[2]) : 0;
        const birthDay = birthdateMatch ? Number(birthdateMatch[3]) : 0;
        const parsedBirthdate = birthdateMatch
            ? new Date(birthYear, birthMonth - 1, birthDay)
            : null;
        const isBirthdateValid = Boolean(birthdateMatch)
            && birthYear >= 1900
            && parsedBirthdate.getFullYear() === birthYear
            && parsedBirthdate.getMonth() === birthMonth - 1
            && parsedBirthdate.getDate() === birthDay
            && birthdateValue <= getLocalDateKey();

        if (!isBirthdateValid) {
            this.highlightInvalidField(birthdateInput);
            this.showToast(translations[currentLang || 'fr'].invalidBirthdate, 'error');
            return false;
        }

        const registerPasswordInput = document.getElementById('registerPassword');
        const registerPassword = registerPasswordInput?.value.trim() || '';
        const passwordStrength = evaluatePasswordStrength(registerPassword);
        if (!passwordStrength.isStrong) {
            this.highlightInvalidField(registerPasswordInput);
            this.showToast(t('passwordNotStrong'), 'error');
            return false;
        }

        const phoneInput = document.getElementById('registerPhone');
        const phoneValue = phoneInput?.value.trim() || '';
        const phoneRegex = /^[0-9\s+\-().]{6,20}$/;
        if (!phoneRegex.test(phoneValue)) {
            this.highlightInvalidField(phoneInput);
            this.showToast(translations[currentLang || 'fr'].invalidPhone, 'error');
            return false;
        }

        const emailInput = document.getElementById('registerEmail');
        const emailValue = emailInput?.value.trim() || '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(emailValue)) {
            this.highlightInvalidField(emailInput);
            this.showToast(t('invalidEmail'), 'error');
            return false;
        }

        return true;
    },

    bindRegistrationInputValidation() {
        ['loginUsername', 'loginPassword', 'registerUsername', 'registerPassword', 'registerBirthdate', 'registerGender', 'registerPhone', 'registerEmail', 'forgotUsername', 'forgotBirthdate', 'forgotPhone', 'forgotNewPassword', 'forgotConfirmPassword', 'editUsername', 'editBirthdate', 'editGender', 'editPhone', 'editEmail'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            const clearFieldError = () => this.clearInvalidField(input);
            input.addEventListener('input', clearFieldError);
            input.addEventListener('change', clearFieldError);
        });
    },

    promptInstall() {
        if (!deferredInstallPrompt) {
            App.showToast(translations[currentLang || 'fr'].installationUnavailable, 'info');
            return;
        }
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
                App.showToast(t('installCompleted'), 'success');
            } else {
                App.showToast(t('installCancelled'), 'info');
            }
            deferredInstallPrompt = null;
            const installBtn = document.getElementById('installBtn');
            if (installBtn) installBtn.classList.add('hidden');
        });
    },

    toggleTheme() {
        const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        updateThemeUI(nextTheme);
        localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
    },

    renderTaskList() {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;
        taskList.innerHTML = '';

        if (!currentUser) {
            taskList.innerHTML = `<p class="text-center text-slate-400 py-6">${escapeHtml(t('createProfilePrompt'))}</p>`;
            return;
        }

        const searchQuery = document.getElementById('searchTask')?.value.toLowerCase().trim() || '';
        const tasks = getVisibleTasks();

        const statsContainer = document.getElementById('taskStats');
        if (statsContainer) {
            statsContainer.textContent = `📊 ${tasks.length} tâche(s) correspondante(s) trouvée(s).`;
        }

        if (tasks.length === 0) {
            const emptyMessage = searchQuery
                ? 'Aucune tâche ne correspond à votre recherche.'
                : currentFilter === 'completed'
                    ? 'Aucune tâche terminée pour le moment.'
                    : currentFilter === 'today'
                        ? 'Aucune tâche prévue aujourd\'hui.'
                        : currentFilter === 'week'
                            ? 'Aucune tâche prévue cette semaine.'
                            : t('noTasksAvailable');
            taskList.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center text-slate-400">${escapeHtml(emptyMessage)}</div>`;
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            const isCompleted = task.status === 'completed';
            li.className = `flex justify-between items-center p-4 rounded-2xl border transition ${isCompleted ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-slate-900/40 backdrop-blur border-white/5 hover:border-slate-700'}`;

            const priorityIcons = { high: '🔴', medium: '🟠', low: '🟢' };

            const left = document.createElement('div');
            left.className = `flex items-start gap-3 ${isCompleted ? 'opacity-60' : ''}`;

            const icon = document.createElement('div');
            icon.className = 'mt-1 task-icon text-lg';
            icon.textContent = priorityIcons[task.priority] || '⚪';

            const body = document.createElement('div');
            const title = document.createElement('p');
            title.className = `font-medium ${isCompleted ? 'line-through text-slate-400' : 'text-white'}`;
            title.textContent = task.text || '';

            const meta = document.createElement('p');
            meta.className = 'text-xs text-slate-400 mt-0.5';
            meta.textContent = `📅 ${task.date || 'Sans date'} ${task.time ? 'à ' + task.time : ''} | 📁 ${task.category || 'Général'}`;

            body.appendChild(title);
            body.appendChild(meta);
            left.appendChild(icon);
            left.appendChild(body);

            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-2';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = `p-2 rounded-xl text-sm transition ${isCompleted ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}`;
            toggleBtn.dataset.action = 'toggle';
            toggleBtn.dataset.id = task.id;
            toggleBtn.type = 'button';
            toggleBtn.setAttribute('aria-label', 'Changer le statut');
            toggleBtn.textContent = isCompleted ? '↺' : '✅';

            const editBtn = document.createElement('button');
            editBtn.className = 'p-2 rounded-xl bg-sky-950/40 text-sky-300 text-sm hover:bg-sky-900/50 transition';
            editBtn.dataset.action = 'edit';
            editBtn.dataset.id = task.id;
            editBtn.type = 'button';
            editBtn.setAttribute('aria-label', 'Modifier la tâche');
            editBtn.textContent = '✏️';

            const delBtn = document.createElement('button');
            delBtn.className = 'p-2 rounded-xl bg-rose-950/30 text-rose-400 text-sm hover:bg-rose-900/50 transition';
            delBtn.dataset.action = 'delete';
            delBtn.dataset.id = task.id;
            delBtn.type = 'button';
            delBtn.setAttribute('aria-label', 'Supprimer la tâche');
            delBtn.textContent = '🗑️';

            actions.appendChild(toggleBtn);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            li.appendChild(left);
            li.appendChild(actions);
            taskList.appendChild(li);
        });
    },

    renderDashboardStats() {
        const tasks = currentUser ? getVisibleTasks() : [];

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = total - completed;

        const todayStr = getLocalDateKey();
        const todayCount = tasks.filter(t => t.date === todayStr && t.status !== 'completed').length;
        const overdueCount = tasks.filter(t => t.date && t.date < todayStr && t.status !== 'completed').length;

        const selectors = {
            dashboardTotal: total, dashboardCompleted: completed, dashboardPending: pending,
            dashboardToday: todayCount, dashboardOverdue: overdueCount
        };
        Object.entries(selectors).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        });

        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const progressPercent = document.getElementById('progressPercent');
        const progressBar = document.getElementById('dashboardProgressBar');
        if (progressPercent) progressPercent.textContent = `${percentage}%`;
        if (progressBar) progressBar.style.width = `${percentage}%`;

        const pieChart = document.getElementById('dashboardPieChart');
        const pieTooltip = document.getElementById('pieTooltip');
        if (pieChart) {
            if (total === 0) {
                pieChart.innerHTML = `
                    <circle class="pie-track" cx="21" cy="21" r="15.915" fill="transparent" stroke="#334155" stroke-width="5"></circle>
                    <text class="pie-center-value" x="21" y="20">0%</text>
                    <text class="pie-center-label" x="21" y="25">${escapeHtml(t('progressSuffix'))}</text>
                `;
            } else {
                const cx = 21;
                const cy = 21;
                const radius = 15.915;
                const minSlice = 8;
                let completedDeg = (completed / total) * 360;
                let pendingDeg = (pending / total) * 360;

                if (completed > 0 && pending > 0) {
                    if (completedDeg < minSlice) {
                        pendingDeg -= (minSlice - completedDeg);
                        completedDeg = minSlice;
                    }
                    if (pendingDeg < minSlice) {
                        completedDeg -= (minSlice - pendingDeg);
                        pendingDeg = minSlice;
                    }
                }

                const start = -90;
                const completedEnd = start + completedDeg;
                const pendingEnd = completedEnd + pendingDeg;
                const completedPct = Math.round((completed / total) * 100);
                const pendingPct = Math.round((pending / total) * 100);

                const completedPath = completed > 0
                    ? `<path class="pie-segment completed" data-label="${escapeHtml(t('pieLegendCompleted'))}" data-value="${completed}" data-percent="${completedPct}%" d="${describeArcPath(cx, cy, radius, start, completedEnd)}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"></path>`
                    : '';
                const pendingPath = pending > 0
                    ? `<path class="pie-segment pending" data-label="${escapeHtml(t('pieLegendPending'))}" data-value="${pending}" data-percent="${pendingPct}%" d="${describeArcPath(cx, cy, radius, completedEnd, pendingEnd)}" fill="none" stroke="#f43f5e" stroke-width="5" stroke-linecap="round"></path>`
                    : '';

                pieChart.innerHTML = `
                    <circle class="pie-track" cx="${cx}" cy="${cy}" r="${radius}" fill="transparent" stroke="#334155" stroke-width="5"></circle>
                    ${completedPath}
                    ${pendingPath}
                    <text class="pie-center-value" x="${cx}" y="20">${percentage}%</text>
                    <text class="pie-center-label" x="${cx}" y="25">${escapeHtml(t('progressSuffix'))}</text>
                `;
            }

            const pieSegments = pieChart.querySelectorAll('.pie-segment');
            if (pieTooltip) {
                pieTooltip.classList.add('hidden');
                pieSegments.forEach((segment) => {
                    segment.addEventListener('mousemove', (event) => {
                        const { label, value, percent } = segment.dataset;
                        pieTooltip.innerHTML = `${label}: ${value} (${percent})`;
                        pieTooltip.classList.remove('hidden');

                        const chartRect = pieChart.getBoundingClientRect();
                        const offsetX = event.clientX - chartRect.left;
                        const offsetY = event.clientY - chartRect.top;
                        pieTooltip.style.left = `${Math.max(offsetX + 10, 0)}px`;
                        pieTooltip.style.top = `${Math.max(offsetY - 30, 0)}px`;
                    });

                    segment.addEventListener('mouseleave', () => {
                        pieTooltip.classList.add('hidden');
                    });
                });
            }
        }
        const legend = document.getElementById('pieLegend');
        if (legend) {
            const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
            legend.innerHTML = `<span>🔵 ${escapeHtml(t('pieLegendCompleted'))} (${completed} | ${completedPct}%)</span> <span>🔴 ${escapeHtml(t('pieLegendPending'))} (${pending} | ${pendingPct}%)</span>`;
        }

        const weeklyContainer = document.getElementById('dashboardWeeklyProd');
        if (weeklyContainer) {
            weeklyContainer.innerHTML = '';
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            days.forEach((day, index) => {
                const heightFactor = total > 0 ? (completed / total) * (40 + (index * 8)) : 10;
                const bar = document.createElement('div');
                bar.className = 'w-full bg-sky-500 rounded-t-md transition-all duration-500';
                bar.style.height = `${Math.min(heightFactor, 100)}%`;

                const wrapper = document.createElement('div');
                wrapper.className = 'bar-group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-xs text-slate-400';
                wrapper.appendChild(bar);

                const label = document.createElement('span');
                label.innerText = day;
                wrapper.appendChild(label);
                weeklyContainer.appendChild(wrapper);
            });
        }
    },

    renderCalendar() {
        const grid = document.getElementById('dashboardCalendar');
        const monthLabel = document.getElementById('calendarMonthLabel');
        const legend = document.getElementById('calendarLegend');
        if (!grid || !monthLabel || !legend) return;

        grid.innerHTML = '';
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const langMap = { fr: 'fr-FR', en: 'en-US', jp: 'ja-JP' };
        monthLabel.textContent = calendarDate.toLocaleDateString(langMap[currentLang || 'fr'], { month: 'long', year: 'numeric' }).toUpperCase();

        const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        dayLabels.forEach(label => {
            const header = document.createElement('div');
            header.className = 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 text-center';
            header.textContent = label;
            grid.appendChild(header);
        });

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        for (let i = 0; i < startOffset; i++) {
            const spacer = document.createElement('div');
            spacer.className = 'h-12';
            grid.appendChild(spacer);
        }

        const tasks = currentUser ? DataManager.getTasks().filter(t => t.owner === currentUser) : [];
        const tasksByDate = tasks.reduce((map, task) => {
            if (!task.date) return map;
            const dateKey = task.date;
            const existing = map.get(dateKey) || { active: 0, completed: 0 };
            if (task.status === 'completed') existing.completed += 1;
            else existing.active += 1;
            map.set(dateKey, existing);
            return map;
        }, new Map());

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = tasksByDate.get(cellDateStr);
            const isToday = cellDateStr === todayStr;

            cell.className = 'relative min-h-[4.25rem] rounded-3xl border border-white/5 bg-slate-950/30 p-2 text-left text-sm text-slate-300 transition hover:border-slate-400/25 hover:bg-slate-900/50';
            if (isToday) {
                cell.classList.add('border-cyan-400/50', 'bg-slate-900/70');
            }

            const label = document.createElement('div');
            label.className = 'font-semibold text-sm mb-2';
            label.textContent = day;
            cell.appendChild(label);

            if (status) {
                const dot = document.createElement('span');
                dot.className = 'absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex h-2.5 w-2.5 rounded-full shadow-lg';
                if (status.active > 0) {
                    dot.classList.add('bg-amber-400');
                    cell.classList.add('shadow-[0_0_0_1px_rgba(245,158,11,0.16)]');
                } else {
                    dot.classList.add('bg-sky-400');
                }
                cell.appendChild(dot);

                const preview = document.createElement('div');
                preview.className = 'space-y-1 text-[11px] text-slate-400';
                if (status.active) preview.innerHTML = `<span>${escapeHtml(t('calendarPreviewActive'))}: ${status.active}</span>`;
                if (status.completed) preview.innerHTML += `<span>${escapeHtml(t('calendarPreviewCompleted'))}: ${status.completed}</span>`;
                cell.appendChild(preview);
            }

            grid.appendChild(cell);
        }

        if (!currentUser) {
            legend.textContent = t('calendarNoProfile');
        } else if (tasksByDate.size === 0) {
            legend.textContent = t('calendarEmptyMonth');
        } else {
            legend.innerHTML = `<span class="text-sky-400">• ${escapeHtml(t('calendarPreviewCompleted'))}</span> <span class="text-amber-400 ml-4">• ${escapeHtml(t('calendarPreviewActive'))}</span>`;
        }
    }
};

const Auth = {
    showRegisterPanel() {
        document.getElementById('loginPanel')?.classList.add('hidden');
        document.getElementById('forgotPasswordPanel')?.classList.add('hidden');
        document.getElementById('registrationSuccessMessage')?.classList.add('hidden');
        document.getElementById('registerPanel')?.classList.remove('hidden');
    },

    showForgotPanel() {
        document.getElementById('loginPanel')?.classList.add('hidden');
        document.getElementById('registerPanel')?.classList.add('hidden');
        document.getElementById('forgotPasswordPanel')?.classList.remove('hidden');
        resetRequested = false;
        document.getElementById('forgotResetTokenGroup')?.classList.add('hidden');
    },

    showLoginPanel() {
        document.getElementById('registerPanel')?.classList.add('hidden');
        document.getElementById('forgotPasswordPanel')?.classList.add('hidden');
        document.getElementById('loginPanel')?.classList.remove('hidden');
    },

    clearAuthInputs() {
        ['loginUsername', 'loginPassword', 'registerUsername', 'registerPassword', 'registerBirthdate', 'registerGender', 'registerPhone', 'registerEmail', 'forgotUsername', 'forgotBirthdate', 'forgotPhone', 'forgotResetToken', 'forgotNewPassword', 'forgotConfirmPassword'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            input.value = '';
            App.clearInvalidField(input);
        });
        resetRequested = false;
        document.getElementById('forgotResetTokenGroup')?.classList.add('hidden');
    },

    async login() {
        if (!App.validateLoginFields()) return false;

        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value.trim();

        try {
            const response = await Api.login(username, password);
            Api.persistSession(response.username, response.token);

            const users = DataManager.getUsers();
            const existingProfile = Object.values(users).find(profile => profile.username === response.username);
            if (existingProfile) {
                if (existingProfile.id !== response.username) {
                    delete users[existingProfile.id];
                    users[response.username] = { ...existingProfile, id: response.username, username: response.username };
                }
            } else {
                users[response.username] = {
                    id: response.username,
                    username: response.username,
                    nom: response.username,
                    dateNaissance: '',
                    gender: '',
                    telephone: '',
                    email: '',
                    emailReminderEnabled: false,
                    createdAt: new Date().toISOString()
                };
            }
            DataManager.saveUsers(users);

            await Api.syncTasksFromServer();
            App.refreshAll();
            Notifications.checkUnfinishedTasksReminders(false);
            App.showToast(`Bienvenue, ${response.username} !`, 'success');
            return;
        } catch (error) {
            const message = error?.message === 'Invalid credentials'
                ? t('invalidCredentials')
                : t('backendUnavailable');
            App.showToast(message, 'error');
            return false;
        }
    },

    async register() {
        if (!App.validateRegistrationFields()) return false;

        const username = document.getElementById('registerUsername')?.value.trim();
        const password = document.getElementById('registerPassword')?.value.trim();
        const dateNaissance = document.getElementById('registerBirthdate')?.value.trim();
        const gender = document.getElementById('registerGender')?.value.trim();
        const telephone = document.getElementById('registerPhone')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim().toLowerCase();
        const emailReminderEnabled = Boolean(document.getElementById('registerEmailReminder')?.checked);

        const users = DataManager.getUsers();
        const duplicateUsername = Object.values(users).find(profile => profile.username === username);
        if (duplicateUsername) {
            App.highlightInvalidField(document.getElementById('registerUsername'));
            return App.showToast(t('duplicateUsername'), 'error');
        }

        const duplicateTelephone = Object.values(users).find(profile => profile.telephone === telephone);
        if (duplicateTelephone) {
            App.highlightInvalidField(document.getElementById('registerPhone'));
            return App.showToast(translations[currentLang || 'fr'].profileExists, 'error');
        }

        const duplicateEmail = Object.values(users).find(profile => (profile.email || '').toLowerCase() === email);
        if (duplicateEmail) {
            App.highlightInvalidField(document.getElementById('registerEmail'));
            return App.showToast(t('duplicateEmail'), 'error');
        }

        const profileId = username;
        const newUser = {
            id: profileId,
            username,
            nom: username,
            dateNaissance,
            gender,
            telephone,
            email,
            emailReminderEnabled,
            createdAt: new Date().toISOString()
        };

        const submitButton = document.getElementById('submitRegisterBtn');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');
        }

        let response;
        try {
            response = await Api.register({
                username,
                password,
                dateNaissance,
                gender,
                telephone,
                email,
                emailReminderEnabled
            });
        } catch (error) {
            const registrationErrors = {
                'User exists': t('duplicateUsername'),
                'username and password required': t('fieldRequired'),
                'Password must be at least 8 characters': t('passwordTooShort'),
                'Password must include uppercase, lowercase, number and symbol': t('passwordNotStrong'),
                'Invalid birthdate': t('invalidBirthdate'),
                'Invalid gender': t('fieldRequired'),
                'Invalid phone': t('invalidPhone'),
                'Invalid email': t('invalidEmail')
            };
            const message = registrationErrors[error?.message]
                || (error instanceof TypeError ? t('backendUnavailable') : error?.message)
                || t('backendUnavailable');
            App.showToast(message, 'error');
            return false;
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.removeAttribute('aria-busy');
            }
        }

        Api.persistSession(response.username, response.token);
        users[profileId] = newUser;
        DataManager.saveUsers(users);

        await Api.syncTasksFromServer();
        this.clearAuthInputs();

        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        Profile.renderUserList();
        this.showLoginPanel();
        const successMessage = document.getElementById('registrationSuccessMessage');
        if (successMessage) {
            successMessage.textContent = t('registrationSuccess');
            successMessage.classList.remove('hidden');
            successMessage.focus();
        }
        App.showToast(t('registrationSuccess'), 'success');
    },

    async resetPassword() {
        const username = document.getElementById('forgotUsername')?.value.trim() || '';
        const dateNaissance = document.getElementById('forgotBirthdate')?.value.trim() || '';
        const telephone = document.getElementById('forgotPhone')?.value.trim() || '';

        if (!resetRequested) {
            const requiredFields = [
                ['forgotUsername', username],
                ['forgotBirthdate', dateNaissance],
                ['forgotPhone', telephone]
            ];
            const missing = requiredFields.filter(([, value]) => !value);
            if (missing.length) {
                missing.forEach(([id]) => App.highlightInvalidField(document.getElementById(id)));
                return App.showToast(t('fieldRequired'), 'error');
            }

            try {
                await Api.requestPasswordReset(username, dateNaissance, telephone);
                resetRequested = true;
                document.getElementById('forgotResetTokenGroup')?.classList.remove('hidden');
                return App.showToast(t('resetTokenSent'), 'info');
            } catch (error) {
                return App.showToast(error?.message || t('backendUnavailable'), 'error');
            }
        }

        const token = document.getElementById('forgotResetToken')?.value.trim() || '';
        const password = document.getElementById('forgotNewPassword')?.value || '';
        const confirmation = document.getElementById('forgotConfirmPassword')?.value || '';
        if (!token || !password || !confirmation) {
            return App.showToast(t('fieldRequired'), 'error');
        }
        if (password !== confirmation) {
            return App.showToast(t('passwordMismatch'), 'error');
        }
        const strength = evaluatePasswordStrength(password);
        if (!strength.isStrong) {
            return App.showToast(t('passwordNotStrong'), 'error');
        }

        try {
            await Api.confirmPasswordReset(token, password);
            this.clearAuthInputs();
            const loginUsername = document.getElementById('loginUsername');
            if (loginUsername) loginUsername.value = username;
            this.showLoginPanel();
            return App.showToast(t('passwordResetSuccess'), 'success');
        } catch (error) {
            return App.showToast(error?.message || t('resetTokenInvalid'), 'error');
        }

        /*
        const fields = ['forgotUsername', 'forgotBirthdate', 'forgotPhone', 'forgotNewPassword', 'forgotConfirmPassword'];
        const values = {};
        const missing = [];

        fields.forEach(id => {
            const input = document.getElementById(id);
            const value = input?.value.trim() || '';
            values[id] = value;
            if (!value) missing.push(input);
        });

        if (missing.length > 0) {
            missing.forEach(input => App.highlightInvalidField(input));
            return App.showToast(t('fieldRequired'), 'error');
        }

        if (values.forgotNewPassword.length < 8) {
            App.highlightInvalidField(document.getElementById('forgotNewPassword'));
            return App.showToast(t('passwordTooShort'), 'error');
        }

        const forgotStrength = evaluatePasswordStrength(values.forgotNewPassword);
        if (!forgotStrength.isStrong) {
            App.highlightInvalidField(document.getElementById('forgotNewPassword'));
            return App.showToast(t('passwordNotStrong'), 'error');
        }

        if (values.forgotNewPassword !== values.forgotConfirmPassword) {
            App.highlightInvalidField(document.getElementById('forgotNewPassword'));
            App.highlightInvalidField(document.getElementById('forgotConfirmPassword'));
            return App.showToast(t('passwordMismatch'), 'error');
        }

        const users = DataManager.getUsers();
        const user = Object.values(users).find(profile => profile.username === values.forgotUsername);
        if (!user || user.telephone !== values.forgotPhone || user.dateNaissance !== values.forgotBirthdate) {
            App.highlightInvalidField(document.getElementById('forgotUsername'));
            App.highlightInvalidField(document.getElementById('forgotBirthdate'));
            App.highlightInvalidField(document.getElementById('forgotPhone'));
            return App.showToast(t('resetVerificationFailed'), 'error');
        }

        user.password = values.forgotNewPassword;
        DataManager.saveUsers(users);
        this.clearAuthInputs();

        const loginUsername = document.getElementById('loginUsername');
        if (loginUsername) loginUsername.value = values.forgotUsername;

        this.showLoginPanel();
        return App.showToast(t('passwordResetSuccess'), 'success');
        */
    }
};

const Profile = {
    editingProfileId: null,

    syncUserSelector() {
        const select = document.getElementById('userSelectForEdit');
        if (!select) return;

        const selectedValue = select.value;
        const users = DataManager.getUsers();
        const profiles = Object.values(users);

        select.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('selectUserPlaceholder');
        select.appendChild(placeholder);

        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.username || profile.nom || 'Utilisateur';
            select.appendChild(option);
        });

        const canRestorePrevious = selectedValue && profiles.some(profile => profile.id === selectedValue);
        if (canRestorePrevious) select.value = selectedValue;
        else select.value = '';
    },

    editSelectedProfile() {
        const select = document.getElementById('userSelectForEdit');
        const profileId = select?.value || '';
        if (!profileId) return App.showToast(t('noProfileSelected'), 'error');
        this.showEditPanel(profileId);
    },

    deleteSelectedProfile() {
        const select = document.getElementById('userSelectForEdit');
        const profileId = select?.value || '';
        if (!profileId) return App.showToast(t('noProfileSelected'), 'error');

        const users = DataManager.getUsers();
        const profile = users[profileId];
        if (!profile) return App.showToast(t('noProfileSelected'), 'error');

        const label = profile.username || profile.nom || 'Utilisateur';
        const confirmed = window.confirm(`${t('deleteProfileConfirm')}\n${label}`);
        if (!confirmed) return;

        delete users[profileId];
        DataManager.saveUsers(users);

        const remainingTasks = DataManager.getTasks().filter(task => task.owner !== profileId);
        DataManager.saveTasks(remainingTasks);

        if (currentUser === profileId) {
            currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            this.hideEditPanel(true);
        }

        this.syncUserSelector();
        this.renderUserList();
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(t('profileDeleted'), 'info');
    },

    showEditPanel(profileId) {
        const users = DataManager.getUsers();
        const profile = users[profileId];
        if (!profile) return App.showToast(t('noProfileSelected'), 'error');

        this.editingProfileId = profileId;

        const usernameInput = document.getElementById('editUsername');
        const birthdateInput = document.getElementById('editBirthdate');
        const genderInput = document.getElementById('editGender');
        const phoneInput = document.getElementById('editPhone');
        const emailInput = document.getElementById('editEmail');
        const emailReminderInput = document.getElementById('editEmailReminder');

        if (usernameInput) {
            usernameInput.value = profile.username || '';
            App.clearInvalidField(usernameInput);
        }
        if (birthdateInput) {
            birthdateInput.value = profile.dateNaissance || '';
            App.clearInvalidField(birthdateInput);
        }
        if (genderInput) {
            genderInput.value = profile.gender || '';
            App.clearInvalidField(genderInput);
        }
        if (phoneInput) {
            phoneInput.value = profile.telephone || '';
            App.clearInvalidField(phoneInput);
        }
        if (emailInput) {
            emailInput.value = profile.email || '';
            App.clearInvalidField(emailInput);
        }
        if (emailReminderInput) emailReminderInput.checked = Boolean(profile.emailReminderEnabled);
        const select = document.getElementById('userSelectForEdit');
        if (select) select.value = profileId;

        document.getElementById('editProfilePanel')?.classList.remove('hidden');
    },

    hideEditPanel(clearFields = false) {
        document.getElementById('editProfilePanel')?.classList.add('hidden');
        this.editingProfileId = null;

        if (!clearFields) return;
        ['editUsername', 'editBirthdate', 'editGender', 'editPhone', 'editEmail'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            input.value = '';
            App.clearInvalidField(input);
        });
        const emailReminderInput = document.getElementById('editEmailReminder');
        if (emailReminderInput) emailReminderInput.checked = false;
    },

    saveProfileEdits() {
        if (!this.editingProfileId) return App.showToast(t('noProfileSelected'), 'error');

        const usernameInput = document.getElementById('editUsername');
        const birthdateInput = document.getElementById('editBirthdate');
        const genderInput = document.getElementById('editGender');
        const phoneInput = document.getElementById('editPhone');
        const emailInput = document.getElementById('editEmail');
        const emailReminderInput = document.getElementById('editEmailReminder');

        const username = usernameInput?.value.trim() || '';
        const dateNaissance = birthdateInput?.value.trim() || '';
        const gender = genderInput?.value.trim() || '';
        const telephone = phoneInput?.value.trim() || '';
        const email = (emailInput?.value.trim() || '').toLowerCase();
        const emailReminderEnabled = Boolean(emailReminderInput?.checked);

        const requiredInputs = [usernameInput, birthdateInput, genderInput, phoneInput, emailInput];
        const missingInputs = requiredInputs.filter(input => !input || !input.value.trim());
        if (missingInputs.length > 0) {
            missingInputs.forEach(input => App.highlightInvalidField(input));
            return App.showToast(t('fieldRequired'), 'error');
        }

        const birthdateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const parsedBirthdate = new Date(`${dateNaissance}T00:00:00`);
        const currentYear = new Date().getFullYear();
        const birthYear = Number(dateNaissance.slice(0, 4));
        const isBirthdateValid = birthdateRegex.test(dateNaissance)
            && Number.isFinite(birthYear)
            && birthYear >= 1900
            && birthYear <= currentYear
            && !Number.isNaN(parsedBirthdate.getTime())
            && parsedBirthdate <= new Date();
        if (!isBirthdateValid) {
            App.highlightInvalidField(birthdateInput);
            return App.showToast(t('invalidBirthdate'), 'error');
        }

        if (!['male', 'female'].includes(gender)) {
            App.highlightInvalidField(genderInput);
            return App.showToast(t('fieldRequired'), 'error');
        }

        const phoneRegex = /^[0-9\s+\-().]{6,20}$/;
        if (!phoneRegex.test(telephone)) {
            App.highlightInvalidField(phoneInput);
            return App.showToast(t('invalidPhone'), 'error');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(email)) {
            App.highlightInvalidField(emailInput);
            return App.showToast(t('invalidEmail'), 'error');
        }

        const users = DataManager.getUsers();
        const activeProfile = users[this.editingProfileId];
        if (!activeProfile) return App.showToast(t('noProfileSelected'), 'error');

        const duplicateUsername = Object.values(users).find(profile => profile.id !== this.editingProfileId && profile.username === username);
        if (duplicateUsername) {
            App.highlightInvalidField(usernameInput);
            return App.showToast(t('duplicateUsername'), 'error');
        }

        const duplicateTelephone = Object.values(users).find(profile => profile.id !== this.editingProfileId && profile.telephone === telephone);
        if (duplicateTelephone) {
            App.highlightInvalidField(phoneInput);
            return App.showToast(t('profileExists'), 'error');
        }

        const duplicateEmail = Object.values(users).find(profile => profile.id !== this.editingProfileId && (profile.email || '').toLowerCase() === email);
        if (duplicateEmail) {
            App.highlightInvalidField(emailInput);
            return App.showToast(t('duplicateEmail'), 'error');
        }

        users[this.editingProfileId] = {
            ...activeProfile,
            username,
            nom: username,
            dateNaissance,
            gender,
            telephone,
            email,
            emailReminderEnabled,
            updatedAt: new Date().toISOString()
        };

        DataManager.saveUsers(users);
        this.hideEditPanel(true);
        this.syncUserSelector();
        this.renderUserList();
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(t('profileUpdated'), 'success');
    },

    renderUserList() {
        const container = document.getElementById('userListContainer');
        const list = document.getElementById('userList');
        if (!container || !list) return;

        const rawUsers = DataManager.getUsers();
        const profiles = Object.values(rawUsers);
        list.innerHTML = '';

        if (profiles.length === 0) {
            list.innerHTML = `<li class="text-slate-500 text-sm">${escapeHtml(t('noUsersDetected'))}</li>`;
            container.classList.remove('hidden');
            return;
        }

        profiles.forEach(profile => {
            const birthdate = profile.dateNaissance ? new Date(profile.dateNaissance).toLocaleDateString(currentLang === 'jp' ? 'ja-JP' : currentLang === 'en' ? 'en-US' : 'fr-FR') : '—';
            const gender = profile.gender === 'male'
                ? t('genderMale')
                : profile.gender === 'female'
                    ? t('genderFemale')
                    : '—';
            const li = document.createElement('li');
            li.className = 'rounded-3xl border border-slate-700 bg-slate-950/50 p-4 shadow-lg shadow-slate-950/20 text-slate-100';
            li.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                        <p class="text-sm text-slate-400">${escapeHtml(t('userFieldFullName'))}</p>
                        <p class="font-semibold text-white">${escapeHtml(profile.nom || '—')}</p>
                    </div>
                    ${profile.id === currentUser ? '<span class="text-xs uppercase tracking-[0.2em] text-sky-400 bg-sky-500/10 px-2 py-1 rounded-full">Actif</span>' : ''}
                </div>
                <div class="mb-3">
                    <button type="button" class="btn-secondary rounded-xl px-3 py-2 text-sm" data-action="edit-profile" data-id="${escapeHtml(profile.id || '')}">${escapeHtml(t('editProfileBtn'))}</button>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
                    <div class="bg-slate-900/70 rounded-2xl p-3">
                        <p class="text-slate-400 text-[11px] uppercase tracking-[0.15em] mb-1">${escapeHtml(t('userFieldBirthdate'))}</p>
                        <p>${escapeHtml(birthdate)}</p>
                    </div>
                    <div class="bg-slate-900/70 rounded-2xl p-3">
                        <p class="text-slate-400 text-[11px] uppercase tracking-[0.15em] mb-1">${escapeHtml(t('userFieldGender'))}</p>
                        <p>${escapeHtml(gender)}</p>
                    </div>
                    <div class="bg-slate-900/70 rounded-2xl p-3">
                        <p class="text-slate-400 text-[11px] uppercase tracking-[0.15em] mb-1">${escapeHtml(t('userFieldPhone'))}</p>
                        <p>${escapeHtml(profile.telephone || '—')}</p>
                    </div>
                    <div class="bg-slate-900/70 rounded-2xl p-3 sm:col-span-2">
                        <p class="text-slate-400 text-[11px] uppercase tracking-[0.15em] mb-1">${escapeHtml(t('userFieldEmail'))}</p>
                        <p>${escapeHtml(profile.email || '—')}</p>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });

        this.syncUserSelector();
        container.classList.remove('hidden');
    }
};

function updateTaskFormMode() {
    const addButton = document.getElementById('addTaskBtn');
    const cancelButton = document.getElementById('cancelEditTaskBtn');
    if (addButton) {
        addButton.textContent = editingTaskId ? 'Enregistrer les modifications' : 'Ajouter la tâche';
    }
    if (cancelButton) {
        cancelButton.classList.toggle('hidden', !editingTaskId);
    }
}

function resetTaskForm() {
    editingTaskId = null;
    const fields = ['taskInput', 'taskDate', 'taskTime', 'taskCategory', 'taskPriority', 'taskStatus'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        if (field.tagName === 'SELECT') {
            field.value = field.options[0]?.value || '';
        } else {
            field.value = '';
        }
    });
    updateTaskFormMode();
}

const Tasks = {
    async add() {
        if (!currentUser) return App.showToast(t('createProfilePrompt'), 'error');

        const textInput = document.getElementById('taskInput');
        const text = textInput?.value.trim();
        if (!text) return App.showToast(translations[currentLang || 'fr'].taskRequired, 'error');

        const formTask = {
            owner: currentUser,
            text,
            date: document.getElementById('taskDate')?.value || '',
            time: document.getElementById('taskTime')?.value || '',
            category: document.getElementById('taskCategory')?.value || 'Général',
            priority: document.getElementById('taskPriority')?.value || 'medium',
            status: document.getElementById('taskStatus')?.value || 'active'
        };

        if (editingTaskId) {
            const tasks = DataManager.getTasks();
            const existingTask = tasks.find(task => String(task.id) === String(editingTaskId));
            if (!existingTask) {
                resetTaskForm();
                return App.showToast('Tâche introuvable.', 'error');
            }

            Object.assign(existingTask, formTask);
            existingTask.text = text;
            existingTask.updatedAt = new Date().toISOString();

            if (authToken) {
                try {
                    await Api.updateTask(existingTask.id, formTask);
                } catch {
                    // Keep local changes if the API request fails.
                }
            }

            DataManager.saveTasks(tasks);
            resetTaskForm();
            App.refreshAll();
            Notifications.checkUnfinishedTasksReminders(false);
            App.showToast('Tâche mise à jour.', 'success');
            return;
        }

        const newTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            ...formTask
        };

        let savedTask = normalizeTask(newTask);
        if (authToken) {
            try {
                savedTask = await Api.createTask(newTask);
            } catch {
                // Keep local fallback when backend is not available.
            }
        }

        const tasks = DataManager.getTasks();
        tasks.push(savedTask);
        DataManager.saveTasks(tasks);

        resetTaskForm();
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(t('taskAdded'), 'success');
    },

    startEdit(id) {
        const tasks = DataManager.getTasks();
        const task = tasks.find(item => String(item.id) === String(id));
        if (!task) return;

        editingTaskId = task.id;
        const fields = {
            taskInput: task.text || '',
            taskDate: task.date || '',
            taskTime: task.time || '',
            taskCategory: task.category || 'Général',
            taskPriority: task.priority || 'medium',
            taskStatus: task.status || 'active'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (!field) return;
            field.value = value;
        });

        updateTaskFormMode();
        document.getElementById('taskInput')?.focus();
        App.showToast('Édition de tâche activée.', 'info');
    },

    cancelEdit() {
        resetTaskForm();
    },

    async toggleStatus(id) {
        const tasks = DataManager.getTasks();
        const task = tasks.find(t => String(t.id) === String(id));
        if (!task) return;

        const nextStatus = task.status === 'completed' ? 'active' : 'completed';
        task.status = nextStatus;

        if (authToken) {
            try {
                await Api.updateTask(task.id, { status: nextStatus });
            } catch {
                // Keep local state if API update fails.
            }
        }

        DataManager.saveTasks(tasks);
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
    },

    async completeFromReminder(id) {
        const task = DataManager.getTasks().find(item =>
            String(item.id) === String(id) && item.owner === currentUser
        );
        if (!task || task.status === 'completed') return;

        await this.toggleStatus(task.id);
        App.showToast(t('taskDueReminderCompleted'), 'success');
    },

    async delete(id) {
        if (authToken) {
            try {
                await Api.deleteTask(id);
            } catch {
                // Keep local fallback when backend is unavailable.
            }
        }

        let tasks = DataManager.getTasks();
        tasks = tasks.filter(t => String(t.id) !== String(id));
        DataManager.saveTasks(tasks);
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(t('taskDeleted'), 'info');
    },

    async clearCompleted() {
        if (!currentUser) return;

        let tasks = DataManager.getTasks();
        const completed = tasks.filter(t => t.owner === currentUser && t.status === 'completed');
        if (authToken) {
            await Promise.all(completed.map(async task => {
                try {
                    await Api.deleteTask(task.id);
                } catch {
                    // Keep local cleanup regardless of API failures.
                }
            }));
        }

        tasks = tasks.filter(t => !(t.owner === currentUser && t.status === 'completed'));
        DataManager.saveTasks(tasks);
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(t('cleanupCompleted'), 'info');
    },

    async completeVisible() {
        if (!currentUser) return;

        const visibleTasks = getVisibleTasks();
        if (visibleTasks.length === 0) return App.showToast('Aucune tâche visible à compléter.', 'info');

        const tasks = DataManager.getTasks();
        visibleTasks.forEach(task => {
            const match = tasks.find(item => String(item.id) === String(task.id));
            if (match) match.status = 'completed';
        });

        let syncFailed = false;
        if (authToken) {
            await Promise.all(visibleTasks.map(async task => {
                try {
                    await Api.updateTask(task.id, { status: 'completed' });
                } catch (error) {
                    syncFailed = true;
                    console.error('Impossible de synchroniser le statut de la tâche.', error);
                }
            }));
        }

        DataManager.saveTasks(tasks);
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(syncFailed ? t('taskSyncWarning') : t('tasksCompleted'), syncFailed ? 'error' : 'success');
    },

    async reopenVisible() {
        if (!currentUser) return;

        const visibleTasks = getVisibleTasks();
        if (visibleTasks.length === 0) return App.showToast('Aucune tâche visible à rouvrir.', 'info');

        const tasks = DataManager.getTasks();
        visibleTasks.forEach(task => {
            const match = tasks.find(item => String(item.id) === String(task.id));
            if (match) match.status = 'active';
        });

        let syncFailed = false;
        if (authToken) {
            await Promise.all(visibleTasks.map(async task => {
                try {
                    await Api.updateTask(task.id, { status: 'active' });
                } catch (error) {
                    syncFailed = true;
                    console.error('Impossible de synchroniser le statut de la tâche.', error);
                }
            }));
        }

        DataManager.saveTasks(tasks);
        App.refreshAll();
        Notifications.checkUnfinishedTasksReminders(false);
        App.showToast(syncFailed ? t('taskSyncWarning') : t('tasksReopened'), syncFailed ? 'error' : 'info');
    }
};

const System = {
    async exportBackup() {
        if (!currentUser) return App.showToast(t('createProfilePrompt'), 'error');
        let userTasks = DataManager.getTasks().filter(t => t.owner === currentUser);
        if (authToken) {
            try {
                const payload = await Api.downloadBackup();
                userTasks = Array.isArray(payload?.tasks) ? payload.tasks.map(normalizeTask) : userTasks;
                DataManager.saveTasks(userTasks);
            } catch {
                // Continue with local backup if backend fetch fails.
            }
        }
        if (userTasks.length === 0) return App.showToast(t('noTasksToBackup'), 'info');

        const payload = {
            version: 'zoko-pro-v1',
            exportedAt: new Date().toISOString(),
            user: currentUser,
            tasks: userTasks
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = `zoko_backup_${currentUser}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        URL.revokeObjectURL(url);

        App.showToast(t('backupDownloaded'), 'success');
    },

    async importBackup(e) {
        if (!currentUser) return App.showToast(t('createProfilePrompt'), 'error');
        const file = e.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const raw = event.target.result;
                const parsed = JSON.parse(raw);
                const importedTasks = Array.isArray(parsed)
                    ? parsed
                    : parsed && Array.isArray(parsed.tasks)
                        ? parsed.tasks
                        : null;

                if (!Array.isArray(importedTasks)) throw new Error('Format JSON invalide');

                const existingTasks = DataManager.getTasks();
                const preservedOthers = existingTasks.filter(t => t.owner !== currentUser);
                const currentUserTasks = existingTasks.filter(t => t.owner === currentUser);
                const existingIds = new Set(currentUserTasks.map(t => t.id));
                const mergedTasks = [...preservedOthers, ...currentUserTasks];

                importedTasks.forEach(task => {
                    const normalized = {
                        id: task.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
                        owner: currentUser,
                        text: task.text || '',
                        date: task.date || '',
                        time: task.time || '',
                        category: task.category || 'Général',
                        priority: task.priority || 'medium',
                        status: task.status || 'active'
                    };
                    if (existingIds.has(normalized.id)) {
                        normalized.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
                    }
                    existingIds.add(normalized.id);
                    mergedTasks.push(normalized);
                });

                if (authToken) {
                    try {
                        await Api.restoreBackup(mergedTasks.filter(t => t.owner === currentUser));
                        const synced = await Api.fetchTasks();
                        DataManager.saveTasks(synced);
                    } catch {
                        DataManager.saveTasks(mergedTasks);
                    }
                } else {
                    DataManager.saveTasks(mergedTasks);
                }

                App.refreshAll();
                App.showToast(t('restoreSuccess'), 'success');
            } catch (err) {
                console.error('Import Backup Error:', err);
                App.showToast(t('backupInvalid'), 'error');
            } finally {
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsText(file);
    }
};

window.Tasks = Tasks;

function switchSection(sectionId) {
    const sections = ['dashboardSection', 'tasksSection', 'profileSection', 'usersSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== sectionId);
    });

    const tabButtons = {
        dashboardSection: 'dashboardTabBtn',
        tasksSection: 'tasksTabBtn',
        profileSection: 'profileTabBtn',
        usersSection: 'usersTabBtn'
    };

    Object.entries(tabButtons).forEach(([sId, bId]) => {
        const btn = document.getElementById(bId);
        if (btn) {
            const isActive = sId === sectionId;
            btn.classList.toggle('tab-btn-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    });
}

function openLearnMoreModal() {
    const modal = document.getElementById('learnMoreModal');
    const openBtn = document.getElementById('learnMoreBtn');
    if (!modal) return;
    lastFocusedBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
    modal.setAttribute('aria-hidden', 'false');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('closeLearnMoreBtn');
    if (closeBtn) closeBtn.focus();
}

function closeLearnMoreModal() {
    const modal = document.getElementById('learnMoreModal');
    const openBtn = document.getElementById('learnMoreBtn');
    if (!modal) return;
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.setAttribute('aria-hidden', 'true');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    if (lastFocusedBeforeModal) {
        lastFocusedBeforeModal.focus();
        lastFocusedBeforeModal = null;
    }
}

function updateThemeUI(theme) {
    const html = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';
    html.classList.toggle('dark', isDark);
    html.classList.toggle('light', !isDark);
    body.classList.toggle('dark', isDark);
    body.classList.toggle('light', !isDark);
    html.dataset.theme = theme;
    body.dataset.theme = theme;

    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.innerHTML = isDark
            ? '<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />'
            : '<circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />';
    }

    const themeButton = document.getElementById('toggleDarkModeBtn');
    if (themeButton) {
        const label = isDark ? 'Activer le thème clair' : 'Activer le thème sombre';
        themeButton.setAttribute('aria-pressed', String(isDark));
        themeButton.setAttribute('aria-label', label);
        themeButton.setAttribute('title', label);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : (systemPrefersDark ? 'dark' : 'light');
    updateThemeUI(theme);
}

const Notifications = {
    permissionKey: 'zoko_notifications_allowed',
    taskDueReminderKey: 'zoko_task_due_reminders',
    dueReminderInterval: null,
    lastDueTaskCheckAt: Date.now() - 60_000,
    dueTaskCheckInProgress: false,

    getSentDueReminders() {
        try {
            const reminders = JSON.parse(localStorage.getItem(this.taskDueReminderKey) || '{}');
            return reminders && typeof reminders === 'object' && !Array.isArray(reminders) ? reminders : {};
        } catch (error) {
            console.warn('Impossible de lire les rappels de tâches déjà envoyés.', error);
            return {};
        }
    },

    async checkDueTaskReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (this.dueTaskCheckInProgress) return;

        const checkedAt = Date.now();
        const previousCheckAt = this.lastDueTaskCheckAt;
        this.lastDueTaskCheckAt = checkedAt;
        if (!currentUser) return;

        this.dueTaskCheckInProgress = true;
        try {
            const reminders = this.getSentDueReminders();
            const oldestReminder = checkedAt - 30 * 24 * 60 * 60 * 1000;
            Object.entries(reminders).forEach(([key, sentAt]) => {
                if (typeof sentAt !== 'number' || sentAt < oldestReminder) delete reminders[key];
            });

            const dueTasks = DataManager.getTasks().filter(task => {
                if (task.owner !== currentUser || task.status === 'completed' || !task.date || !task.time) return false;
                const dueAt = new Date(`${task.date}T${task.time}:00`).getTime();
                const reminderKey = `${task.id}:${task.date}T${task.time}`;
                return Number.isFinite(dueAt)
                    && dueAt >= previousCheckAt
                    && dueAt <= checkedAt
                    && !reminders[reminderKey];
            });

            for (const task of dueTasks) {
                const reminderKey = `${task.id}:${task.date}T${task.time}`;
                const body = t('taskDueReminderBody').replace('{task}', task.text || '');
                const sent = await this.sendNotification(t('taskDueReminderTitle'), {
                    body,
                    icon: './icons/icon.svg',
                    badge: './icons/icon.svg',
                    tag: `zoko-task-due-${task.id}`,
                    renotify: true,
                    requireInteraction: true,
                    actions: [
                        { action: 'mark-task-done', title: t('taskDueReminderMarkDone') },
                        { action: 'open-task', title: t('taskDueReminderOpen') }
                    ],
                    data: { type: 'task-due-reminder', taskId: String(task.id) }
                });
                if (sent) reminders[reminderKey] = checkedAt;
            }

            localStorage.setItem(this.taskDueReminderKey, JSON.stringify(reminders));
        } finally {
            this.dueTaskCheckInProgress = false;
        }
    },

    openTaskFromNotification(taskId) {
        if (!currentUser || !taskId) return;
        const task = DataManager.getTasks().find(item =>
            String(item.id) === String(taskId) && item.owner === currentUser
        );
        if (!task) return;

        switchSection('tasksSection');
        App.renderTaskList();
        requestAnimationFrame(() => {
            const taskItem = [...document.querySelectorAll('#taskList [data-id]')]
                .find(element => element.dataset.id === String(taskId))
                ?.closest('li');
            taskItem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    },

    async handleServiceWorkerMessage(message) {
        if (message?.type === 'zoko-complete-task') {
            await Tasks.completeFromReminder(message.taskId);
        } else if (message?.type === 'zoko-open-task') {
            this.openTaskFromNotification(message.taskId);
        }
    },

    async handlePendingNotificationAction() {
        const url = new URL(window.location.href);
        const taskId = url.searchParams.get('taskId');
        const completeTaskId = url.searchParams.get('completeTaskId');
        if (!taskId && !completeTaskId) return;

        url.searchParams.delete('taskId');
        url.searchParams.delete('completeTaskId');
        window.history.replaceState({}, '', url);
        if (completeTaskId) {
            await Tasks.completeFromReminder(completeTaskId);
        } else {
            this.openTaskFromNotification(taskId);
        }
    },

    isNextWeekReminderEnabled() {
        return localStorage.getItem(STORAGE_KEYS.NEXT_WEEK_REMINDER) === 'true';
    },

    setNextWeekReminder(enabled) {
        localStorage.setItem(STORAGE_KEYS.NEXT_WEEK_REMINDER, enabled ? 'true' : 'false');
        App.showToast(enabled ? t('nextWeekReminderEnabled') : t('nextWeekReminderDisabled'), 'info');
    },

    getNextWeekBounds() {
        const today = new Date();
        const day = today.getDay();
        const daysUntilNextMonday = ((8 - day) % 7) || 7;
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        start.setDate(today.getDate() + daysUntilNextMonday);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    },

    getNextWeekTasks() {
        if (!currentUser) return [];
        const { start, end } = this.getNextWeekBounds();
        return DataManager.getTasks().filter(task => {
            if (task.owner !== currentUser || !task.date || task.status === 'completed') return false;
            const dueDate = new Date(`${task.date}T00:00:00`);
            if (Number.isNaN(dueDate.getTime())) return false;
            return dueDate >= start && dueDate <= end;
        });
    },

    getUnfinishedTasks() {
        if (!currentUser) return [];
        return DataManager.getTasks().filter(task => task.owner === currentUser && task.status !== 'completed');
    },

    getCurrentUserProfile() {
        if (!currentUser) return null;
        const users = DataManager.getUsers();
        return users[currentUser] || null;
    },

    async sendUnfinishedTasksEmail(profile, tasks) {
        if (!profile?.email) return false;

        const payload = {
            subject: `[Zoko] ${t('unfinishedReminderTitle')}`,
            text: [
                t('unfinishedReminderBody'),
                '',
                ...tasks.slice(0, 10).map(task => `- ${task.text}${task.date ? ` (${task.date})` : ''}`)
            ].join('\n')
        };

        try {
            await Api.request('/api/reminders/email', {
                method: 'POST',
                body: payload
            });
            return true;
        } catch {
            return false;
        }
    },

    async checkUnfinishedTasksReminders(forceNotify = false) {
        const profile = this.getCurrentUserProfile();
        if (!profile?.emailReminderEnabled) return;

        const todayKey = getLocalDateKey();
        const lastSent = localStorage.getItem(STORAGE_KEYS.UNFINISHED_EMAIL_LAST_SENT);
        if (!forceNotify && lastSent === todayKey) return;

        const unfinishedTasks = this.getUnfinishedTasks();
        if (unfinishedTasks.length === 0) return;

        localStorage.setItem(STORAGE_KEYS.UNFINISHED_EMAIL_LAST_SENT, todayKey);
        const body = `${unfinishedTasks.length} ${t('unfinishedReminderBody')}`;
        App.showToast(body, 'info');

        if (Notification.permission === 'granted') {
            this.sendNotification(t('unfinishedReminderTitle'), {
                body,
                icon: './icons/icon.svg',
                badge: './icons/icon.svg',
                tag: 'zoko-unfinished-reminder',
                renotify: false,
                data: { type: 'unfinished-reminder' }
            });
        }

        const emailSent = await this.sendUnfinishedTasksEmail(profile, unfinishedTasks);
        if (forceNotify) {
            App.showToast(emailSent ? t('unfinishedEmailSent') : t('unfinishedEmailUnavailable'), emailSent ? 'success' : 'info');
        }
    },

    async checkNextWeekTasks(forceNotify = false) {
        if (!currentUser) {
            if (forceNotify) App.showToast(t('createProfilePrompt'), 'error');
            return;
        }
        if (!this.isNextWeekReminderEnabled() && !forceNotify) return;

        const todayKey = getLocalDateKey();
        const lastCheck = localStorage.getItem(STORAGE_KEYS.NEXT_WEEK_LAST_CHECK);
        if (!forceNotify && lastCheck === todayKey) return;

        localStorage.setItem(STORAGE_KEYS.NEXT_WEEK_LAST_CHECK, todayKey);
        const tasks = this.getNextWeekTasks();

        if (tasks.length === 0) {
            if (forceNotify) App.showToast(t('nextWeekReminderNone'), 'info');
            return;
        }

        const body = `${tasks.length} ${t('nextWeekReminderFound')}`;
        App.showToast(body, 'success');

        if (Notification.permission === 'granted') {
            this.sendNotification('Rappel Zoko', {
                body,
                icon: './icons/icon.svg',
                badge: './icons/icon.svg',
                tag: 'zoko-next-week-reminder',
                renotify: true,
                data: { type: 'next-week-reminder' }
            });
        }
    },

    syncReminderUI() {
        const toggle = document.getElementById('nextWeekReminderToggle');
        if (toggle) toggle.checked = this.isNextWeekReminderEnabled();

        const notificationButton = document.getElementById('enableNotificationsBtn');
        if (notificationButton) {
            const supported = 'Notification' in window;
            notificationButton.disabled = !supported;
            notificationButton.title = supported ? '' : t('notificationsUnsupported');
        }

        const testBtn = document.getElementById('testNextWeekReminderBtn');
        if (!testBtn) return;
        const canTest = Boolean(currentUser);
        testBtn.disabled = !canTest;
        testBtn.setAttribute('aria-disabled', canTest ? 'false' : 'true');
        testBtn.classList.toggle('opacity-50', !canTest);
        testBtn.classList.toggle('cursor-not-allowed', !canTest);
        testBtn.title = canTest ? '' : t('createProfilePrompt');
    },

    async init() {
        if ('serviceWorker' in navigator) {
            const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

            if (isLocalhost) {
                // Avoid stale caches during local development (Live Server/Vite).
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
            } else {
                try {
                    await navigator.serviceWorker.register('./sw.js');
                    console.log('Service Worker enregistre.');
                } catch (error) {
                    console.warn('Impossible d enregistrer le service worker.', error);
                }
            }
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                this.handleServiceWorkerMessage(event.data);
            });
        }
        if ('Notification' in window && Notification.permission === 'granted') {
            localStorage.setItem(this.permissionKey, 'true');
        }
        await this.checkDueTaskReminders();
        if (!this.dueReminderInterval) {
            this.dueReminderInterval = window.setInterval(() => {
                this.checkDueTaskReminders().catch(error => {
                    console.error('Impossible de vérifier les rappels de tâches.', error);
                });
            }, 15_000);
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkDueTaskReminders().catch(error => {
                    console.error('Impossible de vérifier les rappels de tâches.', error);
                });
            }
        });
    },

    async requestAccess() {
        if (!('Notification' in window)) {
            return App.showToast(t('notificationsUnsupported'), 'error');
        }
        if (Notification.permission === 'granted') {
            localStorage.setItem(this.permissionKey, 'true');
            App.showToast(t('notificationsAlreadyAllowed'), 'success');
            this.lastDueTaskCheckAt = Date.now() - 60_000;
            return this.checkDueTaskReminders();
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem(this.permissionKey, 'true');
            App.showToast(t('notificationsEnabled'), 'success');
            this.lastDueTaskCheckAt = Date.now() - 60_000;
            await this.checkDueTaskReminders();
        } else {
            localStorage.removeItem(this.permissionKey);
            App.showToast(t('notificationsDenied'), 'info');
        }
    },

    getOverdueTasks() {
        if (!currentUser) return [];
        const todayStr = getLocalDateKey();
        return DataManager.getTasks().filter(t => t.owner === currentUser && t.date && t.date < todayStr && t.status !== 'completed');
    },

    async checkOverdueTasks(forceNotify = false) {
        if (Notification.permission !== 'granted') return;
        const overdueTasks = this.getOverdueTasks();
        if (overdueTasks.length === 0 && !forceNotify) return;
        const title = 'Rappel Zoko';
        const body = overdueTasks.length === 0
            ? 'Aucune tâche en retard pour le moment.'
            : `Vous avez ${overdueTasks.length} tâche(s) en retard. Ouvrez l'application pour les revoir.`;
        this.sendNotification(title, {
            body,
            icon: './icons/icon.svg',
            badge: './icons/icon.svg',
            tag: 'zoko-overdue-reminder',
            renotify: true,
            data: { type: 'overdue-reminder' }
        });
    },

    async sendNotification(title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration?.active) {
                    await registration.showNotification(title, options);
                    return true;
                }
            } catch (err) {
                console.warn('Notification via service worker échouée', err);
            }
        }
        try {
            const notification = new Notification(title, options);
            if (options.data?.taskId) {
                notification.onclick = () => {
                    window.focus();
                    this.openTaskFromNotification(options.data.taskId);
                    notification.close();
                };
            }
            return true;
        } catch (error) {
            console.warn('Impossible d afficher la notification.', error);
            return false;
        }
    }
};

function initLanguage() {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    if (saved) currentLang = saved;
    if (!currentLang) {
        const nav = navigator.language || 'en';
        if (nav.startsWith('en')) currentLang = 'en';
        else if (nav.startsWith('ja') || nav.startsWith('jp')) currentLang = 'jp';
        else currentLang = 'en';
    }
    applyLanguage();
}

function setLanguage(lang) {
    const nextLang = lang || 'en';
    if (currentLang === nextLang) {
        applyLanguage();
        App.refreshAll();
        return;
    }

    currentLang = nextLang;
    localStorage.setItem(STORAGE_KEYS.LANG, currentLang);
    applyLanguage();
    App.refreshAll();
    App.showToast(`Language: ${currentLang.toUpperCase()}`, 'info');
}

function applyLanguage() {
    document.documentElement.lang = currentLang;
    const elementKeyMap = {
        dashboardTabBtn: 'dashboardTab',
        tasksTabBtn: 'tasksTab',
        profileTabBtn: 'profileTab',
        addTaskTabBtn: 'addTaskTab',
        usersTabBtn: 'usersTab'
    };
    const keys = [
        'mainSectionLabel', 'title', 'heroNote', 'heroDescription', 'addTaskTitle',
        'headerDescription', 'dashboardTotalLabel', 'dashboardCompletedLabel', 'dashboardPendingLabel', 'dashboardTodayLabel', 'dashboardOverdueLabel',
        'chartPieTitle', 'pieChartLabel', 'chartProgressTitle', 'progressSuffix', 'chartWeeklyTitle', 'weeklyLegend',
        'calendarTitle', 'calendarSubTitle', 'tasksTitle', 'searchBtn', 'filterAll', 'filterToday', 'filterWeek', 'filterCompleted',
        'nextWeekReminderTitle', 'nextWeekReminderDescription', 'nextWeekReminderToggleLabel', 'testNextWeekReminderBtn',
        'logoutUserBtn', 'resetAllDataBtn', 'enableNotificationsBtn', 'syncBtn', 'downloadBackupBtn', 'restoreBackupBtn', 'clearCompletedBtn', 'installAppBtn',
        'addTaskBtn', 'usersSectionTitle', 'usersSectionDescription', 'manageUsersTitle', 'selectUserToEditLabel', 'editSelectedUserBtn', 'deleteSelectedUserBtn', 'showUsersBtn', 'userListTitle',
        'editProfileTitle', 'saveProfileBtn', 'cancelEditProfileBtn',
        'loginUserBtn', 'forgotPasswordBtn', 'createUserBtn', 'submitRegisterBtn', 'cancelRegisterBtn',
        'forgotPanelTitle', 'newPasswordLabel', 'confirmPasswordLabel', 'resetPasswordBtn', 'cancelForgotBtn',
        'emailLabel', 'emailReminderLabel', 'footerContactTitle', 'footerContactText', 'footerContactAvailability',
        'footerNavTitle', 'footerLegalTitle', 'footerLinkDashboard', 'footerLinkTasks', 'footerLinkProfile', 'footerLinkUsers',
        'footerLinkAbout', 'footerLinkPrivacy', 'footerLinkTerms', 'footerRights', 'footerTagline'
    ];
    const applyText = (element, value) => {
        if (!element || value == null) return;
        const tag = element.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            element.placeholder = value;
            return;
        }
        if (tag === 'SELECT') {
            const option = element.querySelector('option[value=""]');
            if (option) option.textContent = value;
            element.setAttribute('aria-label', value);
            return;
        }
        element.textContent = value;
    };

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        const value = translations[currentLang]?.[key];
        if (!key || value == null) return;
        applyText(element, value);
    });

    keys.forEach(k => {
        const el = document.getElementById(k);
        const value = translations[currentLang]?.[k];
        if (!el || value == null) return;
        applyText(el, value);
    });
    Object.entries(elementKeyMap).forEach(([elementId, translationKey]) => {
        const el = document.getElementById(elementId);
        const value = translations[currentLang]?.[translationKey];
        if (!el || value == null) return;
        applyText(el, value);
    });
    const pageTitle = translations[currentLang]?.pageTitle;
    if (pageTitle) document.title = pageTitle;
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) langSelect.value = currentLang;
    const userSelect = document.getElementById('userSelectForEdit');
    if (userSelect) {
        const placeholder = userSelect.querySelector('option[value=""]');
        if (placeholder) placeholder.textContent = t('selectUserPlaceholder');
    }
    updatePasswordStrengthUI('registerPassword', 'registerPasswordStrengthBar', 'registerPasswordStrengthText');
    updatePasswordStrengthUI('forgotNewPassword', 'forgotPasswordStrengthBar', 'forgotPasswordStrengthText');
}

function initEventListeners() {
    const actions = {
        'toggleDarkModeBtn': App.toggleTheme,
        'loginUserBtn': () => Auth.login(),
        'forgotPasswordBtn': () => Auth.showForgotPanel(),
        'createUserBtn': () => Auth.showRegisterPanel(),
        'cancelRegisterBtn': () => { Auth.showLoginPanel(); Auth.clearAuthInputs(); },
        'resetPasswordBtn': () => Auth.resetPassword(),
        'cancelForgotBtn': () => { Auth.showLoginPanel(); Auth.clearAuthInputs(); },
        'logoutUserBtn': async () => {
            await Api.logout();
            App.refreshAll();
            App.showToast(translations[currentLang || 'fr'].logoutSuccess, 'info');
        },
        'addTaskBtn': Tasks.add,
        'cancelEditTaskBtn': () => Tasks.cancelEdit(),
        'clearCompletedBtn': Tasks.clearCompleted,
        'completeVisibleBtn': () => Tasks.completeVisible(),
        'reopenVisibleBtn': () => Tasks.reopenVisible(),
        'showUsersBtn': () => Profile.renderUserList(),
        'editSelectedUserBtn': () => Profile.editSelectedProfile(),
        'deleteSelectedUserBtn': () => Profile.deleteSelectedProfile(),
        'saveProfileBtn': () => Profile.saveProfileEdits(),
        'cancelEditProfileBtn': () => Profile.hideEditPanel(true),
        'installBtn': App.promptInstall,
        'enableNotificationsBtn': () => Notifications.requestAccess(),
        'testNextWeekReminderBtn': () => Notifications.checkNextWeekTasks(true),
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

    document.getElementById('registerPanel')?.addEventListener('submit', event => {
        event.preventDefault();
        Auth.register();
    });

    const learnMoreBtn = document.getElementById('learnMoreBtn');
    if (learnMoreBtn) {
        learnMoreBtn.addEventListener('click', openLearnMoreModal);
    }

    const learnMoreGoTasksBtn = document.getElementById('learnMoreGoTasksBtn');
    if (learnMoreGoTasksBtn) {
        learnMoreGoTasksBtn.addEventListener('click', () => {
            closeLearnMoreModal();
            switchSection('tasksSection');
            const tasksSection = document.getElementById('tasksSection');
            if (tasksSection) {
                tasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    const closeLearnMoreBtn = document.getElementById('closeLearnMoreBtn');
    if (closeLearnMoreBtn) {
        closeLearnMoreBtn.addEventListener('click', closeLearnMoreModal);
    }

    const learnMoreModal = document.getElementById('learnMoreModal');
    if (learnMoreModal) {
        learnMoreModal.addEventListener('click', event => {
            if (event.target === learnMoreModal || event.target.closest('[data-modal-close]')) {
                closeLearnMoreModal();
            }
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeLearnMoreModal();
        }
    });

    const taskListEl = document.getElementById('taskList');
    if (taskListEl) {
        taskListEl.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (!id) return;
            if (action === 'toggle') Tasks.toggleStatus(id);
            else if (action === 'edit') Tasks.startEdit(id);
            else if (action === 'delete') {
                const task = DataManager.getTasks().find(t => String(t.id) === String(id));
                const label = task?.text ? task.text : 'cette tâche';
                if (window.confirm(`Supprimer « ${label} » ?`)) {
                    Tasks.delete(id);
                }
            }
        });
    }
    const userListEl = document.getElementById('userList');
    if (userListEl) {
        userListEl.addEventListener('click', e => {
            const btn = e.target.closest('[data-action="edit-profile"]');
            if (!btn) return;
            const profileId = btn.dataset.id;
            if (profileId) Profile.showEditPanel(profileId);
        });
    }
    document.getElementById('searchTask')?.addEventListener('input', () => App.renderTaskList());
    document.getElementById('categoryFilter')?.addEventListener('change', e => {
        currentCategoryFilter = e.target.value || 'all';
        App.renderTaskList();
    });
    document.getElementById('sortTasks')?.addEventListener('change', e => {
        currentSortMode = e.target.value || 'date-desc';
        App.renderTaskList();
    });
    document.getElementById('taskInput')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            Tasks.add();
        }
    });
    document.getElementById('nextWeekReminderToggle')?.addEventListener('change', e => {
        const enabled = Boolean(e.target?.checked);
        Notifications.setNextWeekReminder(enabled);
        if (enabled) Notifications.checkNextWeekTasks(true);
    });
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        document.getElementById('installBtn')?.classList.remove('hidden');
    });
    document.getElementById('resetAllDataBtn')?.addEventListener('click', () => {
        if (confirm(t('resetAllConfirm'))) {
            localStorage.clear();
            alert(t('resetAllDone'));
            window.location.reload();
        }
    });
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = currentLang || langSelect.value;
        langSelect.addEventListener('change', e => setLanguage(e.target.value));
    }
    const tabs = {
        dashboardTabBtn: 'dashboardSection',
        tasksTabBtn: 'tasksSection',
        profileTabBtn: 'profileSection',
        usersTabBtn: 'usersSection'
    };
    Object.entries(tabs).forEach(([tabId, sectionId]) => {
        document.getElementById(tabId)?.addEventListener('click', () => switchSection(sectionId));
    });
    const filters = ['filterAll', 'filterToday', 'filterWeek', 'filterCompleted'];
    filters.forEach(id => {
        document.getElementById(id)?.addEventListener('click', e => {
            filters.forEach(fId => document.getElementById(fId)?.classList.remove('tab-btn-active'));
            e.target.classList.add('tab-btn-active');
            currentFilter = id.replace('filter', '').toLowerCase();
            App.renderTaskList();
        });
    });
    document.getElementById('backupFileInput')?.addEventListener('change', System.importBackup);
}

function initRegistrationValidation() {
    ['loginUsername', 'loginPassword', 'registerUsername', 'registerPassword', 'registerBirthdate', 'registerGender', 'registerPhone', 'registerEmail', 'forgotUsername', 'forgotBirthdate', 'forgotPhone', 'forgotNewPassword', 'forgotConfirmPassword', 'editUsername', 'editBirthdate', 'editGender', 'editPhone', 'editEmail'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => App.clearInvalidField(input));
    });
}

function configureBirthdateInput() {
    const today = new Date();
    const todayISO = getLocalDateKey(today);
    ['registerBirthdate', 'forgotBirthdate', 'editBirthdate'].forEach(id => {
        const birthdateInput = document.getElementById(id);
        if (!birthdateInput) return;
        birthdateInput.setAttribute('min', '1900-01-01');
        birthdateInput.setAttribute('max', todayISO);
    });
}

function setFooterYear() {
    const footerYear = document.getElementById('footerYear');
    if (!footerYear) return;
    footerYear.textContent = String(new Date().getFullYear());
}

async function init() {
    configureBirthdateInput();
    setFooterYear();
    initTheme();
    initLanguage();
    initEventListeners();
    initRegistrationValidation();
    App.bindRegistrationInputValidation();
    initPasswordStrengthIndicators();
    initPasswordVisibilityToggles();
    Profile.syncUserSelector();
    Notifications.syncReminderUI();

    if (currentUser) {
        const users = DataManager.getUsers();
        if (!users[currentUser]) {
            users[currentUser] = {
                id: currentUser,
                username: currentUser,
                nom: currentUser,
                dateNaissance: '',
                gender: '',
                telephone: '',
                email: '',
                emailReminderEnabled: false,
                createdAt: new Date().toISOString()
            };
            DataManager.saveUsers(users);
        }
    }

    await Api.syncTasksFromServer();
    switchSection('dashboardSection');
    App.refreshAll();
    await Notifications.init();
    await Notifications.handlePendingNotificationAction();
}

document.addEventListener('DOMContentLoaded', init);
