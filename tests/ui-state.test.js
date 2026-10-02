const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function createHarness({ chromeState = {}, legacyState = {} } = {}) {
    const stored = { ...chromeState };
    const legacy = { ...legacyState };
    const context = {
        chrome: {
            storage: {
                local: {
                    async get(key) {
                        return Object.prototype.hasOwnProperty.call(stored, key) ? { [key]: stored[key] } : {};
                    },
                    async set(values) {
                        Object.assign(stored, values);
                    },
                },
            },
        },
        localStorage: {
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(legacy, key) ? legacy[key] : null;
            },
        },
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/utils/ui-state.js", "utf8"), context);
    return { api: context.BetterEclassUtils.uiState, legacy, stored };
}

test("migrates pinned courses from page localStorage", async () => {
    const courses = [{ name: "Course A", url: "https://example.test/course/1" }];
    const harness = createHarness({
        legacyState: { betterEclassPinnedCourses: JSON.stringify(courses) },
    });

    const result = await harness.api.migrateFromLocalStorage("betterEclassPinnedCourses", "pinnedCourses", []);

    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Course A");
    assert.equal(harness.stored.betterEclass_ui_pinnedCourses.length, 1);
});

test("keeps canonical UI state when legacy data still exists", async () => {
    const harness = createHarness({
        chromeState: { betterEclass_ui_collapsedSections: { adminNotices: false } },
        legacyState: { betterEclassCollapsedSections: JSON.stringify({ adminNotices: true }) },
    });

    const result = await harness.api.migrateFromLocalStorage("betterEclassCollapsedSections", "collapsedSections", {});

    assert.equal(result.adminNotices, false);
    assert.equal(harness.stored.betterEclass_ui_collapsedSections.adminNotices, false);
});
