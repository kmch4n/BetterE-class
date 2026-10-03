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

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.className = "";
        this.id = "";
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.ownText = "";
        this.dataset = {};
        this.isConnected = true;
        this.replacedWith = null;
    }

    replaceWith(node) {
        this.replacedWith = node;
    }

    querySelectorAll() {
        return [];
    }

    append(...nodes) {
        nodes.forEach((node) => this.children.push(typeof node === "string" ? { text: node } : node));
    }

    appendChild(node) {
        this.append(node);
        return node;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    set textContent(value) {
        this.ownText = String(value);
        this.children = [];
    }

    get textContent() {
        return this.ownText + this.children.map((child) => child.textContent ?? child.text).join("");
    }
}

function countByClass(element, className) {
    const own = element.className.split(" ").includes(className) ? 1 : 0;
    return own + element.children.filter((child) => child instanceof FakeElement).reduce((sum, child) => sum + countByClass(child, className), 0);
}

function findByClass(element, className) {
    if (element.className.split(" ").includes(className)) return [element];
    return element.children.filter((child) => child instanceof FakeElement).flatMap((child) => findByClass(child, className));
}

async function renderDeadlineList(deadlineElements, deadlines = undefined) {
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
        createElement(tagName) {
            return new FakeElement(tagName);
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
            deadlines,
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
        setInterval() {},
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

    assert.match(list.textContent, /2件/);
    assert.match(list.textContent, /Report due tomorrow/);
    assert.match(list.textContent, /Quiz due Friday/);
});

test("keeps separate linkless deadlines with identical warning text", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due tomorrow"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due tomorrow"),
    ]);

    assert.match(list.textContent, /2件/);
    assert.equal(countByClass(list, "bec-side-widget-item"), 2);
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

    assert.match(list.textContent, /1件/);
    assert.equal(countByClass(list, "bec-side-widget-item"), 1);
});

test("keeps warnings with a shared link but no explicit assignment ID", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
    ]);

    assert.match(list.textContent, /2件/);
    assert.equal(countByClass(list, "bec-side-widget-item"), 2);
});

test("keeps equal warning text when assignment links differ", async () => {
    const list = await renderDeadlineList([
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/10"),
        createDeadlineElement("https://example.test/course/1", "⚠ Submission due", "https://example.test/assignment/11"),
    ]);

    assert.match(list.textContent, /2件/);
    assert.equal(countByClass(list, "bec-side-widget-item"), 2);
});

test("renders course names and warnings as text instead of markup", async () => {
    const deadline = createDeadlineElement("https://example.test/course/1", "⚠ <img src=x onerror=alert(1)> due");
    const list = await renderDeadlineList([deadline]);
    const [link] = findByClass(list, "bec-side-widget-link");
    const [warning] = findByClass(list, "bec-side-widget-meta");

    assert.equal(link.textContent, "Sample Course");
    assert.equal(link.attributes.href, "https://example.test/course/1");
    assert.equal(link.attributes.target, "_top");
    assert.match(warning.textContent, /<img src=x onerror=alert\(1\)> due$/);
    assert.equal(countByClass(list, "bec-side-widget-item"), 1);
});

function fakeDeadlines(tasksByGroup) {
    return {
        URGENT_MS: 24 * 60 * 60 * 1000,
        async fetchApproachingTasks(groupId) {
            if (!(groupId in tasksByGroup)) throw new Error("request failed");
            return tasksByGroup[groupId];
        },
        formatRemaining: () => "",
        formatDue: (date) => date.toISOString(),
    };
}

function task(name, due, submitted = false) {
    return { id: name, name, due: new Date(due), submitted };
}

async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
}

test("replaces course rows with unsubmitted tasks, nearest course first", async () => {
    const deadlines = fakeDeadlines({
        1: [task("Report 1", "2026-10-09T03:00:00Z"), task("Done", "2026-10-05T03:00:00Z", true)],
        2: [task("Quiz 2", "2026-10-04T03:00:00Z")],
    });
    const list = await renderDeadlineList(
        [createDeadlineElement("https://example.test/webclass/course.php/1/login", "⚠ 締切が近い課題があります。"), createDeadlineElement("https://example.test/webclass/course.php/2/login", "⚠ 締切が近い課題があります。")],
        deadlines,
    );
    await settle();

    const enriched = list.replacedWith;
    assert.ok(enriched);
    assert.match(enriched.textContent, /2件/);
    assert.deepEqual(
        findByClass(enriched, "bec-deadline-task-name").map((element) => element.textContent),
        ["Quiz 2", "Report 1"],
    );
    assert.doesNotMatch(enriched.textContent, /Done/);
});

test("keeps the plain row when a course's deadlines cannot be loaded", async () => {
    const list = await renderDeadlineList([createDeadlineElement("https://example.test/webclass/course.php/9/login", "⚠ 締切が近い課題があります。")], fakeDeadlines({}));
    await settle();

    assert.equal(list.replacedWith, null);
    assert.equal(countByClass(list, "bec-side-widget-item"), 1);
});
