// Get settings utility (loaded from utils/settings.js)
const settingsAPI = window.BetterEclassUtils.settings;
const popupSettingKeys = [
    "enableNewTab",
    "enableAttachmentTab",
    "enableDirectDownload",
    "enableVideoAutoAdvance",
    "enableVideoMute",
    "enableVideoMergeDownload",
    "preventMessagePopup",
    "enableDeadlineHighlight",
    "enableDarkMode",
    "hideSaturday",
    "hide67thPeriod",
    "enableTocSidebar",
    "debugMode",
];

const fallbackSettings = {
    enableNewTab: true,
    enableAttachmentTab: true,
    enableDirectDownload: true,
    enableVideoAutoAdvance: false,
    enableVideoMute: false,
    enableVideoMergeDownload: false,
    preventMessagePopup: true,
    enableDeadlineHighlight: true,
    enableDarkMode: false,
    hideSaturday: false,
    hide67thPeriod: false,
    enableTocSidebar: true,
    debugMode: false,
};

// How each setting reaches open e-class tabs after it is saved.
// Keys not listed here are read by content scripts through onSettingsChanged.
const applySettingChange = {
    enableNewTab: reloadEclassPages,
    enableAttachmentTab: reloadEclassPages,
    enableDirectDownload: reloadEclassPages,
    preventMessagePopup: reloadEclassPages,
    enableDeadlineHighlight: reloadEclassPages,
    enableTocSidebar: reloadCoursePages,
    enableDarkMode: notifyDarkMode,
    hideSaturday: notifyScheduleCustomizer,
    hide67thPeriod: notifyScheduleCustomizer,
};

const LAST_CATEGORY_KEY = "betterEclass_popupCategory";

// Load settings
async function loadSettings() {
    try {
        return await settingsAPI.getSettings(popupSettingKeys);
    } catch (error) {
        console.error("Failed to load settings:", error);
        return { ...fallbackSettings };
    }
}

// Show an error; success stays silent because the switch already shows the new state.
function showError(message) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = message;
    clearTimeout(showError.timer);
    showError.timer = setTimeout(() => {
        statusEl.textContent = "";
    }, 4000);
}

// Categories

const tabs = () => Array.from(document.querySelectorAll('.category[role="tab"]'));
const panels = () => Array.from(document.querySelectorAll('.panel[role="tabpanel"]'));

function selectCategory(category, { focus = false } = {}) {
    let found = false;
    tabs().forEach((tab) => {
        const selected = tab.dataset.category === category;
        found = found || selected;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
    });
    if (!found) return selectCategory(tabs()[0].dataset.category, { focus });

    panels().forEach((panel) => {
        panel.hidden = panel.dataset.category !== category;
    });
    try {
        localStorage.setItem(LAST_CATEGORY_KEY, category);
    } catch (_) {
        // Remembering the category is only a convenience.
    }
}

function restoreCategory() {
    let category = null;
    try {
        category = localStorage.getItem(LAST_CATEGORY_KEY);
    } catch (_) {
        // Fall back to the first category.
    }
    selectCategory(category || tabs()[0].dataset.category);
}

function currentCategory() {
    const tab = tabs().find((t) => t.getAttribute("aria-selected") === "true");
    return tab ? tab.dataset.category : tabs()[0].dataset.category;
}

function updateCounts() {
    panels().forEach((panel) => {
        const switches = Array.from(panel.querySelectorAll(".switch"));
        const on = switches.filter((input) => input.checked).length;
        const countEl = document.querySelector(`[data-count-for="${panel.dataset.category}"]`);
        if (!countEl) return;
        countEl.textContent = `${on}/${switches.length}`;
        countEl.title = `${switches.length}項目中${on}項目がオン`;
    });
}

function setupCategories() {
    const list = tabs();
    list.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            clearSearch();
            selectCategory(tab.dataset.category);
        });
        tab.addEventListener("keydown", (event) => {
            const moves = {
                ArrowDown: (index + 1) % list.length,
                ArrowUp: (index - 1 + list.length) % list.length,
                Home: 0,
                End: list.length - 1,
            };
            if (!(event.key in moves)) return;
            event.preventDefault();
            clearSearch();
            selectCategory(list[moves[event.key]].dataset.category, { focus: true });
        });
    });
}

// Search

const normalize = (text) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

function applySearch(query) {
    const needle = normalize(query);
    const searching = needle.length > 0;
    document.querySelector(".categories").classList.toggle("is-searching", searching);

    if (!searching) {
        document.querySelectorAll(".setting").forEach((item) => {
            item.hidden = false;
        });
        document.getElementById("searchEmpty").hidden = true;
        selectCategory(currentCategory());
        return;
    }

    let matches = 0;
    panels().forEach((panel) => {
        let panelMatches = 0;
        panel.querySelectorAll(".setting").forEach((item) => {
            const hit = normalize(item.textContent).includes(needle);
            item.hidden = !hit;
            if (hit) panelMatches++;
        });
        panel.hidden = panelMatches === 0;
        matches += panelMatches;
    });

    const emptyEl = document.getElementById("searchEmpty");
    emptyEl.hidden = matches > 0;
    emptyEl.textContent = matches > 0 ? "" : `「${query.trim()}」に一致する設定はありません`;
}

function clearSearch() {
    const input = document.getElementById("settingSearch");
    if (!input.value) return;
    input.value = "";
    applySearch("");
}

function setupSearch() {
    const input = document.getElementById("settingSearch");
    input.addEventListener("input", () => applySearch(input.value));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && input.value) {
            event.preventDefault();
            clearSearch();
        }
    });
}

// Settings

function setupSwitches() {
    popupSettingKeys.forEach((key) => {
        const input = document.getElementById(key);
        input.addEventListener("change", async () => {
            const checked = input.checked;
            input.removeAttribute("aria-invalid");
            updateCounts();

            const success = await settingsAPI.setSettings({ [key]: checked });
            if (!success) {
                input.checked = !checked;
                input.setAttribute("aria-invalid", "true");
                updateCounts();
                showError("設定を保存できませんでした。もう一度切り替えてください");
                return;
            }

            const apply = applySettingChange[key];
            if (apply) apply(await loadSettings());
        });
    });
}

// Initialize UI
async function initializeUI() {
    const manifest = chrome.runtime.getManifest();
    document.getElementById("version").textContent = `v${manifest.version}`;

    // Migrate old settings from sync storage to local storage (one-time migration)
    await settingsAPI.migrateFromSync();

    const settings = await loadSettings();
    popupSettingKeys.forEach((key) => {
        document.getElementById(key).checked = Boolean(settings[key]);
    });
    updateCounts();
}

// Helper: send a message without throwing on older Chrome (Promise/callback safe)
function sendMessageSafe(tabId, message) {
    try {
        const maybePromise = chrome.tabs.sendMessage(tabId, message, () => {
            // Swallow callback errors silently
            void chrome.runtime.lastError;
        });
        // If Promise is returned (modern Chrome), attach a catch to swallow errors
        if (maybePromise && typeof maybePromise.then === "function") {
            return maybePromise.catch(() => {});
        }
    } catch (_) {
        // Ignore if API throws synchronously
    }
}

// Notify dark mode content script
async function notifyDarkMode(settings) {
    try {
        const tabs = await chrome.tabs.query({
            url: "*://eclass.doshisha.ac.jp/*",
        });
        for (const tab of tabs) {
            sendMessageSafe(tab.id, {
                type: "darkModeSettingChanged",
                settings: { enableDarkMode: settings.enableDarkMode },
            });
        }
    } catch (error) {
        console.error("Failed to notify dark mode:", error);
    }
}

// Notify schedule customizer content script
async function notifyScheduleCustomizer(settings) {
    try {
        const tabs = await chrome.tabs.query({
            url: "*://eclass.doshisha.ac.jp/webclass/*",
        });
        for (const tab of tabs) {
            sendMessageSafe(tab.id, {
                type: "scheduleSettingsChanged",
                settings: {
                    hideSaturday: settings.hideSaturday,
                    hide67thPeriod: settings.hide67thPeriod,
                },
            });
        }
    } catch (error) {
        console.error("Failed to notify schedule customizer:", error);
    }
}

// Reload course pages to apply TOC sidebar changes
async function reloadCoursePages() {
    try {
        const tabs = await chrome.tabs.query({
            url: "*://eclass.doshisha.ac.jp/webclass/course.php*",
        });
        for (const tab of tabs) {
            chrome.tabs.reload(tab.id);
        }
    } catch (error) {
        console.error("Failed to reload course pages:", error);
    }
}

// Reload e-class pages for settings that are read during script initialization.
async function reloadEclassPages() {
    try {
        const tabs = await chrome.tabs.query({
            url: "*://eclass.doshisha.ac.jp/*",
        });
        for (const tab of tabs) {
            chrome.tabs.reload(tab.id);
        }
    } catch (error) {
        console.error("Failed to reload e-class pages:", error);
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    restoreCategory();
    setupCategories();
    setupSearch();
    setupSwitches();
    initializeUI();
});
