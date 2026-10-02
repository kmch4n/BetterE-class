// settings.js
// Centralized settings management for BetterE-class extension

(function () {
    "use strict";

    // All extension settings with their default values
    const DEFAULT_SETTINGS = {
        // File viewing and download features
        enableNewTab: true,
        enableAttachmentTab: true,
        enableDirectDownload: true,

        // Textbook video features
        enableVideoAutoAdvance: false,

        // Message tool features
        preventMessagePopup: true,

        // Deadline features
        enableDeadlineHighlight: true,

        // Course page features
        enableTocSidebar: true,
        enableAvailableMaterials: true,

        // Schedule customization
        hideSaturday: false,
        hide67thPeriod: false,

        // UI features
        enableDarkMode: false,

        // Developer options
        debugMode: false,
    };

    // Storage key prefix to avoid conflicts
    const STORAGE_PREFIX = "betterEclass_";

    function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    /**
     * Get a single setting value
     * @param {string} key - Setting key
     * @returns {Promise<any>} Setting value
     */
    async function getSetting(key) {
        const settings = await getSettings([key]);
        return settings[key];
    }

    /**
     * Get multiple settings
     * @param {string[]} keys - Array of setting keys. If not provided, returns all settings
     * @returns {Promise<Object>} Object with setting key-value pairs
     */
    async function getSettings(keys = null) {
        try {
            const keysToGet = keys || Object.keys(DEFAULT_SETTINGS);
            const prefixedKeys = keysToGet.map((key) => STORAGE_PREFIX + key);
            const [localResult, syncResult] = await Promise.all([
                chrome.storage.local.get([...prefixedKeys, ...keysToGet]),
                chrome.storage.sync.get(keysToGet),
            ]);
            const settings = {};
            const toMigrate = {};

            keysToGet.forEach((key) => {
                const prefixedKey = STORAGE_PREFIX + key;
                if (hasOwn(localResult, prefixedKey)) {
                    settings[key] = localResult[prefixedKey];
                } else if (hasOwn(localResult, key)) {
                    settings[key] = localResult[key];
                    toMigrate[key] = localResult[key];
                } else if (hasOwn(syncResult, key)) {
                    settings[key] = syncResult[key];
                    toMigrate[key] = syncResult[key];
                } else {
                    settings[key] = DEFAULT_SETTINGS[key];
                }
            });

            if (Object.keys(toMigrate).length > 0) {
                const migrationData = {};
                Object.keys(toMigrate).forEach((key) => {
                    migrationData[STORAGE_PREFIX + key] = toMigrate[key];
                });
                await chrome.storage.local.set(migrationData);
            }

            return settings;
        } catch (error) {
            console.error("[BetterE-class] Failed to get settings:", error);
            // Return defaults for requested keys
            const defaults = {};
            const keysToGet = keys || Object.keys(DEFAULT_SETTINGS);
            keysToGet.forEach((key) => {
                defaults[key] = DEFAULT_SETTINGS[key];
            });
            return defaults;
        }
    }

    /**
     * Set a single setting value
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise<boolean>} Success status
     */
    async function setSetting(key, value) {
        try {
            const storageKey = STORAGE_PREFIX + key;
            await chrome.storage.local.set({ [storageKey]: value });
            return true;
        } catch (error) {
            console.error(`[BetterE-class] Failed to set setting ${key}:`, error);
            return false;
        }
    }

    /**
     * Set multiple settings
     * @param {Object} settings - Object with setting key-value pairs
     * @returns {Promise<boolean>} Success status
     */
    async function setSettings(settings) {
        try {
            // Add prefix to keys for new location
            const storageData = {};
            Object.keys(settings).forEach((key) => {
                const storageKey = STORAGE_PREFIX + key;
                storageData[storageKey] = settings[key];
            });

            await chrome.storage.local.set(storageData);

            return true;
        } catch (error) {
            console.error("[BetterE-class] Failed to set settings:", error);
            return false;
        }
    }

    /**
     * Listen for setting changes
     * @param {Function} callback - Function to call when settings change. Receives (changes, area)
     * @returns {Function} Unsubscribe function
     */
    function onSettingsChanged(callback) {
        const listener = (changes, area) => {
            if (area !== "local") return;

            // Filter only BetterE-class settings and remove prefix
            const filteredChanges = {};
            Object.keys(changes).forEach((storageKey) => {
                if (storageKey.startsWith(STORAGE_PREFIX)) {
                    const key = storageKey.replace(STORAGE_PREFIX, "");
                    filteredChanges[key] = changes[storageKey];
                }
            });

            if (Object.keys(filteredChanges).length > 0) {
                callback(filteredChanges, area);
            }
        };

        chrome.storage.onChanged.addListener(listener);

        // Return unsubscribe function
        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }

    /**
     * Migrate old settings from sync storage to local storage
     * This should be called once on extension update
     */
    async function migrateFromSync() {
        try {
            await getSettings();
            return true;
        } catch (error) {
            console.error("[BetterE-class] Failed to migrate settings:", error);
            return false;
        }
    }

    // Export to global scope for use in content scripts
    const root = typeof window !== "undefined" ? window : globalThis;
    root.BetterEclassUtils = root.BetterEclassUtils || {};
    root.BetterEclassUtils.settings = {
        getSetting,
        getSettings,
        setSetting,
        setSettings,
        onSettingsChanged,
        migrateFromSync,
        DEFAULT_SETTINGS,
    };
})();
