// Persistent UI state that is separate from user-facing extension settings.
(function () {
    "use strict";

    const STORAGE_PREFIX = "betterEclass_ui_";

    async function getState(key, defaultValue) {
        const storageKey = STORAGE_PREFIX + key;
        const result = await chrome.storage.local.get(storageKey);
        return Object.prototype.hasOwnProperty.call(result, storageKey) ? result[storageKey] : defaultValue;
    }

    async function setState(key, value) {
        await chrome.storage.local.set({ [STORAGE_PREFIX + key]: value });
    }

    async function migrateFromLocalStorage(oldKey, newKey, defaultValue) {
        const storageKey = STORAGE_PREFIX + newKey;
        const existing = await chrome.storage.local.get(storageKey);
        if (Object.prototype.hasOwnProperty.call(existing, storageKey)) {
            return existing[storageKey];
        }

        let value = defaultValue;
        const legacyValue = localStorage.getItem(oldKey);
        if (legacyValue !== null) {
            try {
                value = JSON.parse(legacyValue);
            } catch (error) {
                console.warn(`[BetterE-class] Ignoring invalid legacy UI state: ${oldKey}`, error);
            }
        }
        await setState(newKey, value);
        return value;
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.uiState = {
        getState,
        setState,
        migrateFromLocalStorage,
    };
})();
