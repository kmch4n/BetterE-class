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

// Load settings
async function loadSettings() {
    try {
        const result = await settingsAPI.getSettings(popupSettingKeys);
        return result;
    } catch (error) {
        console.error("Failed to load settings:", error);
        return {
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
    }
}

// Save settings
async function saveSettings(settings) {
    try {
        return await settingsAPI.setSettings(settings);
    } catch (error) {
        console.error("Failed to save settings:", error);
        return false;
    }
}

// Show status message
function showStatus(message, isSuccess = true) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = message;
    statusEl.className = `status ${isSuccess ? "success" : "error"} show`;

    setTimeout(() => {
        statusEl.classList.remove("show");
    }, 2000);
}

// Initialize UI
async function initializeUI() {
    // Set version from manifest
    const manifest = chrome.runtime.getManifest();
    document.getElementById("version").textContent = `v${manifest.version}`;

    // Migrate old settings from sync storage to local storage (one-time migration)
    await settingsAPI.migrateFromSync();

    // Load and set settings
    const settings = await loadSettings();
    popupSettingKeys.forEach((key) => {
        document.getElementById(key).checked = Boolean(settings[key]);
    });
}

// Setup event listeners
function setupEventListeners() {
    const enableDarkModeEl = document.getElementById("enableDarkMode");
    const hideSaturdayEl = document.getElementById("hideSaturday");
    const hide67thPeriodEl = document.getElementById("hide67thPeriod");
    const enableTocSidebarEl = document.getElementById("enableTocSidebar");
    const debugModeEl = document.getElementById("debugMode");

    ["enableNewTab", "enableAttachmentTab", "enableDirectDownload", "preventMessagePopup", "enableDeadlineHighlight"].forEach((key) => {
        document.getElementById(key).addEventListener("change", async (e) => {
            const settings = await loadSettings();
            settings[key] = e.target.checked;

            const success = await saveSettings(settings);
            showStatus(success ? "設定を保存しました" : "設定の保存に失敗しました", success);
            if (success) reloadEclassPages();
        });
    });

    enableDarkModeEl.addEventListener("change", async (e) => {
        const settings = await loadSettings();
        settings.enableDarkMode = e.target.checked;

        const success = await saveSettings(settings);
        showStatus(success ? "設定を保存しました" : "設定の保存に失敗しました", success);

        // Notify dark mode script
        notifyDarkMode(settings);
    });

    hideSaturdayEl.addEventListener("change", async (e) => {
        const settings = await loadSettings();
        settings.hideSaturday = e.target.checked;

        const success = await saveSettings(settings);
        showStatus(success ? "Settings saved" : "Failed to save settings", success);

        // Notify schedule customizer
        notifyScheduleCustomizer(settings);
    });

    hide67thPeriodEl.addEventListener("change", async (e) => {
        const settings = await loadSettings();
        settings.hide67thPeriod = e.target.checked;

        const success = await saveSettings(settings);
        showStatus(success ? "Settings saved" : "Failed to save settings", success);

        // Notify schedule customizer
        notifyScheduleCustomizer(settings);
    });

    enableTocSidebarEl.addEventListener("change", async (e) => {
        const settings = await loadSettings();
        settings.enableTocSidebar = e.target.checked;

        const success = await saveSettings(settings);
        showStatus(success ? "設定を保存しました" : "設定の保存に失敗しました", success);

        // Reload course pages to apply the change
        if (success) {
            reloadCoursePages();
        }
    });

    // Read by content scripts through onSettingsChanged, so no reload is needed.
    ["enableVideoAutoAdvance", "enableVideoMute", "enableVideoMergeDownload"].forEach((key) => {
        document.getElementById(key).addEventListener("change", async (e) => {
            const settings = await loadSettings();
            settings[key] = e.target.checked;

            const success = await saveSettings(settings);
            showStatus(success ? "設定を保存しました" : "設定の保存に失敗しました", success);
        });
    });

    debugModeEl.addEventListener("change", async (e) => {
        const settings = await loadSettings();
        settings.debugMode = e.target.checked;

        const success = await saveSettings(settings);
        showStatus(success ? "設定を保存しました" : "設定の保存に失敗しました", success);
    });
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

// Reload course pages to apply TOC sidebar and available materials changes
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
    initializeUI();
    setupEventListeners();
});
