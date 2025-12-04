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

    /**
     * Get a single setting value
     * @param {string} key - Setting key
     * @returns {Promise<any>} Setting value
     */
    async function getSetting(key) {
        try {
            const storageKey = STORAGE_PREFIX + key;
            const result = await chrome.storage.local.get({
                [storageKey]: DEFAULT_SETTINGS[key],
            });
            return result[storageKey];
        } catch (error) {
            console.error(`[BetterE-class] Failed to get setting ${key}:`, error);
            return DEFAULT_SETTINGS[key];
        }
    }

    /**
     * Get multiple settings
     * @param {string[]} keys - Array of setting keys. If not provided, returns all settings
     * @returns {Promise<Object>} Object with setting key-value pairs
     */
    async function getSettings(keys = null) {
        try {
            const keysToGet = keys || Object.keys(DEFAULT_SETTINGS);

            // Build storage keys with prefix for new location
            const storageKeys = {};
            keysToGet.forEach((key) => {
                const storageKey = STORAGE_PREFIX + key;
                storageKeys[storageKey] = DEFAULT_SETTINGS[key];
            });

            // Check new prefixed location in local storage
            const result = await chrome.storage.local.get(storageKeys);

            // Remove prefix from returned keys
            const settings = {};
            Object.keys(result).forEach((storageKey) => {
                const key = storageKey.replace(STORAGE_PREFIX, "");
                settings[key] = result[storageKey];
            });

            // Backward compatibility: check old sync storage for keys that still have default values
            const keysToCheckOld = keysToGet.filter((key) => settings[key] === DEFAULT_SETTINGS[key]);
            if (keysToCheckOld.length > 0) {
                try {
                    const oldDefaults = {};
                    keysToCheckOld.forEach((key) => {
                        oldDefaults[key] = DEFAULT_SETTINGS[key];
                    });
                    const oldResult = await chrome.storage.sync.get(oldDefaults);

                    // Merge old values and migrate them
                    const toMigrate = {};
                    keysToCheckOld.forEach((key) => {
                        if (oldResult[key] !== undefined && oldResult[key] !== DEFAULT_SETTINGS[key]) {
                            settings[key] = oldResult[key];
                            toMigrate[key] = oldResult[key];
                        }
                    });

                    // Migrate old values to new location
                    if (Object.keys(toMigrate).length > 0) {
                        await setSettings(toMigrate);
                    }
                } catch (error) {
                    console.warn("[BetterE-class] Could not check old sync storage:", error);
                }
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

            // Save to THREE locations for maximum backward compatibility:
            // 1. local with prefix (new standard)
            // 2. local without prefix (for dark-mode.js, deadline-list.js which use local)
            // 3. sync without prefix (for other content scripts which use sync)
            await Promise.all([
                chrome.storage.local.set(storageData), // New prefixed location
                chrome.storage.local.set(settings), // Old local location (for dark-mode, deadline-list)
                chrome.storage.sync.set(settings), // Old sync location (for other scripts)
            ]);

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
            // Get all old settings from sync storage
            const oldSettings = await chrome.storage.sync.get(null);

            if (Object.keys(oldSettings).length > 0) {
                // Migrate to local with prefix
                const newSettings = {};
                Object.keys(DEFAULT_SETTINGS).forEach((key) => {
                    if (oldSettings[key] !== undefined) {
                        newSettings[key] = oldSettings[key];
                    }
                });

                if (Object.keys(newSettings).length > 0) {
                    await setSettings(newSettings);
                }
            }

            return true;
        } catch (error) {
            console.error("[BetterE-class] Failed to migrate settings:", error);
            return false;
        }
    }

    /**
     * Migrate localStorage data to chrome.storage.local
     * @param {string} oldKey - Old localStorage key
     * @param {string} newKey - New storage key (without prefix)
     * @param {any} defaultValue - Default value if migration fails
     */
    async function migrateFromLocalStorage(oldKey, newKey, defaultValue = null) {
        try {
            // Check if already migrated
            const existing = await getSetting(newKey);
            if (existing !== DEFAULT_SETTINGS[newKey] && existing !== defaultValue) {
                return true; // Already migrated
            }

            // Get data from localStorage
            const oldData = localStorage.getItem(oldKey);
            if (oldData) {
                const parsed = JSON.parse(oldData);
                await setSetting(newKey, parsed);

                // Optionally remove from localStorage after successful migration
                // localStorage.removeItem(oldKey);

                return true;
            }

            return false;
        } catch (error) {
            console.error(`[BetterE-class] Failed to migrate ${oldKey}:`, error);
            return false;
        }
    }

    // Export to global scope for use in content scripts
    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.settings = {
        getSetting,
        getSettings,
        setSetting,
        setSettings,
        onSettingsChanged,
        migrateFromSync,
        migrateFromLocalStorage,
        DEFAULT_SETTINGS,
    };
})();
