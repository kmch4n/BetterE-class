const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function createDeadlineElement(courseUrl, warning, warningUrl = "", assignmentId = "") {
    const courseLink = {
        href: courseUrl,
        textContent: "Sample Course - 2026",
    };

    return {
        textContent: warning,
        closest(selector) {
            return selector === "a" ? courseLink : null;
        },
        querySelector(selector) {
            if (selector === "a[href]" && warningUrl) {
                return { href: warningUrl };
            }
            return null;
        },
        getAttribute(name) {
            return name === "data-assignment-id" ? assignmentId : null;
        },
    };
}

async function renderDeadlineList(deadlineElements) {
    let onDomContentLoaded = null;
    let insertedList = null;
    const sidebar = {
        firstChild: null,
        querySelector() {
            return null;
        },
        insertBefore(element) {
            insertedList = element;
        },
    };
    const document = {
        readyState: "loading",
        addEventListener(type, callback) {
            if (type === "DOMContentLoaded") onDomContentLoaded = callback;
        },
        createElement() {
            return {
                className: "",
                id: "",
                innerHTML: "",
            };
        },
        getElementById() {
            return null;
        },
        querySelector(selector) {
            return selector === ".col-sm-3" ? sidebar : null;
        },
        querySelectorAll(selector) {
            return selector === ".course-contents-info" ? deadlineElements : [];
        },
    };
    const context = {
        BetterEclassUtils: {
            settings: {
                async getSettings() {
                    return { enableDeadlineHighlight: true };
                },
            },
        },
        chrome: {
            storage: {
                local: {
                    async get(defaults) {
                        return defaults;
                    },
                },
            },
        },
        console,
        document,
        requestAnimationFrame(callback) {
            callback();
        },
        setTimeout,
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/deadline-list.js", "utf8"), context);

    await new Promise((resolve) => setImmediate(resolve));
    assert.notEqual(onDomContentLoaded, null);
    onDomContentLoaded();
    return insertedList;
}

test("keeps distinct deadline warnings from the same course", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Report due tomorrow"),
        createDeadlineElement("https://example.test/course/1", "⚠ Quiz due Friday"),
    ]);

    assert.match(list.innerHTML, /2件/);
    assert.match(list.innerHTML, /Report due tomorrow/);
    assert.match(list.innerHTML, /Quiz due Friday/);
});

test("keeps separate linkless deadlines with identical warning text", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due tomorrow"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due tomorrow"),
    ]);

    assert.match(list.innerHTML, /2件/);
    assert.equal((list.innerHTML.match(/deadline-item/g) || []).length, 2);
});

test("removes repeated warnings with the same explicit assignment ID", async () => {
    const deadline = createDeadlineElement(
        "https://example.test/course/1",
        "⚠  Report   due tomorrow",
        "https://example.test/assignment/10",
        "assignment-10",
    );
    const duplicate = createDeadlineElement(
        "https://example.test/course/1",
        "⚠ Report due tomorrow",
        "https://example.test/assignment/10",
        "assignment-10",
    );
    const list = await renderDeadlineList([deadline, duplicate]);

    assert.match(list.innerHTML, /1件/);
    assert.equal((list.innerHTML.match(/deadline-item/g) || []).length, 1);
});

test("keeps warnings with a shared link but no explicit assignment ID", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
    ]);

    assert.match(list.innerHTML, /2件/);
    assert.equal((list.innerHTML.match(/deadline-item/g) || []).length, 2);
});

test("keeps equal warning text when assignment links differ", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/11"),
    ]);

    assert.match(list.innerHTML, /2件/);
    assert.equal((list.innerHTML.match(/deadline-item/g) || []).length, 2);
});
