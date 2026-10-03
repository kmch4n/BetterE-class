const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const courseUrl = (id, token) => `https://eclass.doshisha.ac.jp/webclass/course.php/${id}/login?acs_=${token}`;

// Runs pinned-courses.js against stored pins and the course links on the current page,
// and resolves with the pins it saves back.
function runWithPins(saved, pageLinks) {
    return new Promise((resolve, reject) => {
        const writes = [];
        const links = pageLinks.map((href) => ({ href, textContent: "» course", parentElement: { querySelector: () => ({}) } }));
        const context = {
            // The widget itself needs a real DOM; its render error is logged and does not affect the pins.
            console: { ...console, error() {} },
            setTimeout: (callback) => callback(),
            requestAnimationFrame: (callback) => callback(),
            document: {
                readyState: "complete",
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: (selector) => (selector.includes("course.php") ? links : []),
            },
            BetterEclassUtils: {
                icons: null,
                uiState: {
                    migrateFromLocalStorage: async () => saved,
                    setState: async (_key, value) => {
                        writes.push(JSON.parse(JSON.stringify(value)));
                    },
                },
            },
        };
        context.window = context;
        vm.createContext(context);
        try {
            vm.runInContext(fs.readFileSync("extension/pinned-courses.js", "utf8"), context);
        } catch (error) {
            reject(error);
        }
        setImmediate(() => resolve(writes));
    });
}

test("pins follow the course ID when the login token changes", async () => {
    const saved = [
        { name: "Course A", url: courseUrl("111", "old") },
        { name: "Course B", url: courseUrl("222", "old") },
    ];

    const writes = await runWithPins(saved, [courseUrl("111", "new"), courseUrl("222", "new")]);

    assert.deepEqual(writes.at(-1), [
        { name: "Course A", url: courseUrl("111", "new") },
        { name: "Course B", url: courseUrl("222", "new") },
    ]);
});

test("a course pinned twice under different tokens is kept once", async () => {
    const saved = [
        { name: "Course A", url: courseUrl("111", "first") },
        { name: "Course A again", url: courseUrl("111", "second") },
    ];

    const writes = await runWithPins(saved, [courseUrl("111", "now")]);

    assert.deepEqual(writes.at(-1), [{ name: "Course A", url: courseUrl("111", "now") }]);
});

test("pins are left alone when the page has no matching course link", async () => {
    const saved = [{ name: "Course A", url: courseUrl("111", "old") }];

    const writes = await runWithPins(saved, []);

    assert.deepEqual(writes, []);
});
