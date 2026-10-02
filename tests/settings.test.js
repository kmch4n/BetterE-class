const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function createStorageArea(initial = {}) {
    const data = { ...initial };
    return {
        data,
        async get(keys) {
            if (keys === null || keys === undefined) return { ...data };
            const result = {};
            const requestedKeys = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
            requestedKeys.forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = data[key];
                } else if (!Array.isArray(keys) && typeof keys === "object") {
                    result[key] = keys[key];
                }
            });
            return result;
        },
        async set(values) {
            Object.assign(data, values);
        },
    };
}

function createSettingsHarness({ local = {}, sync = {} } = {}) {
    const localArea = createStorageArea(local);
    const syncArea = createStorageArea(sync);
    const context = {
        chrome: {
            storage: {
                local: localArea,
                sync: syncArea,
                onChanged: {
                    addListener() {},
                    removeListener() {},
                },
            },
        },
        console,
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/utils/settings.js", "utf8"), context);
    return {
        api: context.BetterEclassUtils.settings,
        local: localArea.data,
        sync: syncArea.data,
    };
}

test("canonical values win even when they equal the default", async () => {
    const harness = createSettingsHarness({
        local: { betterEclass_debugMode: false },
        sync: { debugMode: true },
    });

    assert.equal(await harness.api.getSetting("debugMode"), false);
    assert.equal(harness.local.betterEclass_debugMode, false);
});

test("legacy local values take precedence over sync and migrate once", async () => {
    const harness = createSettingsHarness({
        local: { enableDarkMode: true },
        sync: { enableDarkMode: false },
    });

    assert.equal(await harness.api.getSetting("enableDarkMode"), true);
    assert.equal(harness.local.betterEclass_enableDarkMode, true);
});

test("legacy sync values migrate when no local value exists", async () => {
    const harness = createSettingsHarness({
        sync: { hideSaturday: true },
    });

    assert.equal(await harness.api.getSetting("hideSaturday"), true);
    assert.equal(harness.local.betterEclass_hideSaturday, true);
});

test("missing settings use defaults without creating legacy values", async () => {
    const harness = createSettingsHarness();

    assert.equal(await harness.api.getSetting("enableDirectDownload"), true);
    assert.equal(harness.local.enableDirectDownload, undefined);
    assert.equal(harness.sync.enableDirectDownload, undefined);
});

test("writes settings only to canonical prefixed local storage", async () => {
    const harness = createSettingsHarness();

    assert.equal(await harness.api.setSettings({ debugMode: true }), true);
    assert.equal(harness.local.betterEclass_debugMode, true);
    assert.equal(harness.local.debugMode, undefined);
    assert.equal(harness.sync.debugMode, undefined);
});

test("manifest loads the settings utility before all e-class content scripts", () => {
    const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
    const settingsEntry = manifest.content_scripts[0];

    assert.deepEqual(Array.from(settingsEntry.matches), ["*://eclass.doshisha.ac.jp/*"]);
    assert.deepEqual(Array.from(settingsEntry.js), ["utils/settings.js"]);
    assert.equal(settingsEntry.run_at, "document_start");
    assert.equal(settingsEntry.all_frames, true);
});
