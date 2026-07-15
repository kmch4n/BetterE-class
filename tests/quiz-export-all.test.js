const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function createDocument(questionText, answerHtml = '<table class="seloptions"></table>') {
    const questionElement = { textContent: questionText };
    const answerTable = {};

    return {
        body: {
            innerHTML: questionText ? `<div class=\"question\">${questionText}</div>` : answerHtml,
            textContent: questionText || "answer",
        },
        querySelector(selector) {
            if (selector.includes(".question")) return questionText ? questionElement : null;
            if (selector === ".seloptions") return questionText ? null : answerTable;
            return null;
        },
    };
}

function createButton(onclick, value, options = {}) {
    const attributes = {
        onclick,
        value,
        ...options.attributes,
    };

    const button = {
        value,
        className: options.className || "",
        disabled: options.disabled || false,
        getAttribute(name) {
            return attributes[name] ?? null;
        },
        click() {
            if (options.onClick) options.onClick(button);
        },
    };
    return button;
}

function loadHelpers(buttons, frames, options = {}) {
    const source = fs.readFileSync("extension/quiz-export-all.js", "utf8");
    const instrumented = source.replace(/\}\)\(\);\s*$/, "globalThis.__testExports = { getQuestionNumber, getQuestionNavigationButtons, isQuestionButtonActive, getQuestionFingerprint, waitForFreshQuestion, collectAnswerData, startExport, getExportState, formatQuestionsText }; })();");
    const copyButton = options.copyButton || null;
    const exportButton = options.exportButton || null;
    const context = {
        URLSearchParams,
        alert(message) {
            if (options.onAlert) options.onAlert(message);
        },
        confirm(message) {
            if (options.onConfirm) options.onConfirm(message);
            return options.confirm ?? false;
        },
        chrome: {
            storage: {
                local: {
                    get(_defaults, callback) {
                        callback({ debugMode: false });
                    },
                },
            },
        },
        console: options.console || console,
        document: {
            readyState: "loading",
            addEventListener() {},
            body: {
                appendChild() {},
                removeChild() {},
            },
            createElement() {
                return {
                    style: {},
                    focus() {},
                    select() {},
                };
            },
            querySelector(selector) {
                if (selector === 'input[name="page_num"]') return buttons[0] || null;
                if (selector === ".betterEclass-quiz-copy-all-btn") return copyButton;
                if (selector === ".betterEclass-quiz-export-all-btn") return exportButton;
                return null;
            },
            querySelectorAll(selector) {
                return selector === 'input[name="page_num"]' ? buttons : [];
            },
        },
        navigator: {
            clipboard: {
                async writeText(content) {
                    if (options.onClipboardWrite) options.onClipboardWrite(content);
                },
            },
        },
        parent: {
            parent: {
                frames,
                question: frames.question,
                answer: frames.answer,
            },
        },
        setTimeout,
        clearTimeout,
    };
    context.window = context;
    context.window.name = options.windowName;
    context.window.location = { href: "https://example.test/question", search: "" };
    context.window.parent = context.parent;
    context.window.top = context.parent.parent;
    vm.createContext(context);
    vm.runInContext(instrumented, context);
    return context.__testExports;
}

test("question navigation follows setpage numbers instead of DOM order", () => {
    const buttons = [createButton("setpage(3)", "Q3"), createButton("setpage(1)", "Q1", { disabled: true }), createButton("setpage(2)", "Q2"), createButton("setpage(2)", "Q2 duplicate")];
    const frames = {
        question: { document: createDocument("Q1") },
        answer: { document: createDocument("") },
    };
    const helpers = loadHelpers(buttons, frames);

    assert.deepEqual(
        Array.from(helpers.getQuestionNavigationButtons(), ({ questionNumber }) => questionNumber),
        [1, 2, 3],
    );
    assert.equal(helpers.isQuestionButtonActive(buttons[1]), true);
});

test("an unmarked first button is not treated as an active mismatch", () => {
    const buttons = [createButton("setpage(1)", "Q1"), createButton("setpage(2)", "Q2")];
    const frames = {
        question: { document: createDocument("Q1") },
        answer: { document: createDocument("") },
    };
    const helpers = loadHelpers(buttons, frames);

    assert.equal(
        buttons.some((button) => helpers.isQuestionButtonActive(button)),
        false,
    );
});

test("unsupported answer layouts log a notice without producing an alert warning", () => {
    const logs = [];
    const answerDocument = {
        body: {
            innerHTML: '<select name="answer"></select>',
            textContent: "Select an answer",
        },
        querySelector(selector) {
            return selector === "select, input, button" ? {} : null;
        },
    };
    const helpers = loadHelpers(
        [],
        { question: null, answer: null },
        {
            console: {
                ...console,
                info(message) {
                    logs.push(message);
                },
            },
        },
    );
    const result = helpers.collectAnswerData(answerDocument, 91);

    assert.equal(result.layoutType, "unsupported");
    assert.deepEqual(Array.from(result.warnings), []);
    assert.deepEqual(Array.from(result.answers), ["[Unsupported answer layout detected]"]);
    assert.match(logs[0], /Question 91.*without option extraction.*'unsupported'/);
});

test("freshness rejects a loaded question whose active number is not the target", async () => {
    const oldQuestion = createDocument("Q1");
    const oldAnswer = createDocument("");
    const newQuestion = createDocument("Q3");
    const newAnswer = createDocument("");
    const buttons = [createButton("setpage(2)", "Q2"), createButton("setpage(3)", "Q3", { disabled: true })];
    const frames = {
        question: { document: newQuestion },
        answer: { document: newAnswer },
    };
    const helpers = loadHelpers(buttons, frames);
    const result = await helpers.waitForFreshQuestion(helpers.getQuestionFingerprint(oldQuestion, oldAnswer), oldQuestion, oldAnswer, 2, 5, 5);

    assert.equal(result.ok, false);
});

test("freshness waits until both frame documents have changed and stabilized", async () => {
    const oldQuestion = createDocument("Q1");
    const oldAnswer = createDocument("");
    const frames = {
        question: { document: oldQuestion },
        answer: { document: oldAnswer },
    };
    const helpers = loadHelpers([], frames);
    const oldFingerprint = helpers.getQuestionFingerprint(oldQuestion, oldAnswer);
    const newQuestion = createDocument("Q2");
    const newAnswer = createDocument("");

    setTimeout(() => {
        frames.question.document = newQuestion;
    }, 10);
    setTimeout(() => {
        frames.answer.document = newAnswer;
    }, 50);

    const result = await helpers.waitForFreshQuestion(oldFingerprint, oldQuestion, oldAnswer, null, 30, 10);

    assert.equal(result.ok, true);
    assert.equal(result.questionDocument, newQuestion);
    assert.equal(result.answerDocument, newAnswer);
});

test("freshness accepts a target without an active marker after both documents change", async () => {
    const oldQuestion = createDocument("Q1");
    const oldAnswer = createDocument("");
    const newQuestion = createDocument("Q2");
    const newAnswer = createDocument("");
    const buttons = [createButton("setpage(1)", "Q1"), createButton("setpage(2)", "Q2")];
    const frames = {
        question: { document: newQuestion },
        answer: { document: newAnswer },
    };
    const helpers = loadHelpers(buttons, frames);
    const result = await helpers.waitForFreshQuestion(helpers.getQuestionFingerprint(oldQuestion, oldAnswer), oldQuestion, oldAnswer, 2, 10, 5);

    assert.equal(result.ok, true);
    assert.equal(result.questionDocument, newQuestion);
    assert.equal(result.answerDocument, newAnswer);
});

test("document replacement accepts consecutive questions with identical markup", async () => {
    const oldQuestion = createDocument("Same question");
    const oldAnswer = createDocument("");
    const frames = {
        question: { document: oldQuestion },
        answer: { document: oldAnswer },
    };
    const helpers = loadHelpers([], frames);
    const oldFingerprint = helpers.getQuestionFingerprint(oldQuestion, oldAnswer);
    const newQuestion = createDocument("Same question");
    const newAnswer = createDocument("");

    setTimeout(() => {
        frames.question.document = newQuestion;
        frames.answer.document = newAnswer;
    }, 10);

    const result = await helpers.waitForFreshQuestion(oldFingerprint, oldQuestion, oldAnswer, null, 20, 10);

    assert.equal(result.ok, true);
    assert.equal(result.fingerprint, oldFingerprint);
});

function createQuestionDocument(number) {
    const text = `Question ${number}`;
    return {
        body: {
            innerHTML: `<div class=\"question\">${text}</div>`,
            textContent: text,
        },
        querySelector(selector) {
            return selector.includes(".question") ? { textContent: text } : null;
        },
    };
}

function createAnswerDocument(number) {
    const text = `Answer ${number}`;
    const row = {
        querySelector(selector) {
            if (selector === ".prefix label") return { textContent: "1" };
            if (selector === ".option-label label") return { textContent: text };
            return null;
        },
    };
    return {
        body: {
            innerHTML: `<table class=\"seloptions\"><tr>${text}</tr></table>`,
            textContent: text,
        },
        querySelector(selector) {
            return selector === ".seloptions" ? {} : null;
        },
        querySelectorAll(selector) {
            return selector === ".seloptions tr" ? [row] : [];
        },
    };
}

test("full copy flow resets from a known active Q2 and follows numeric order", async () => {
    const frames = {
        question: { document: createQuestionDocument(2) },
        answer: { document: createAnswerDocument(2) },
    };
    const buttons = [];
    const activate = (number) => {
        buttons.forEach((button) => {
            button.disabled = Number.parseInt(button.value.replace("Q", ""), 10) === number;
        });
        setTimeout(() => {
            frames.question.document = createQuestionDocument(number);
        }, 20);
        setTimeout(() => {
            frames.answer.document = createAnswerDocument(number);
        }, 60);
    };
    buttons.push(createButton("setpage(3)", "Q3", { onClick: () => activate(3) }), createButton("setpage(1)", "Q1", { onClick: () => activate(1) }), createButton("setpage(2)", "Q2", { onClick: () => activate(2) }));
    buttons[2].disabled = true;
    const copyButton = { disabled: false, style: {}, textContent: "" };
    const exportButton = { disabled: false, style: {}, textContent: "" };
    let clipboardContent = null;
    const helpers = loadHelpers(buttons, frames, {
        confirm: true,
        copyButton,
        exportButton,
        onClipboardWrite(content) {
            clipboardContent = content;
        },
    });

    await helpers.startExport("copy");
    for (let attempt = 0; attempt < 100 && clipboardContent === null; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.notEqual(clipboardContent, null);
    assert.deepEqual(
        Array.from(helpers.getExportState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
    assert.ok(clipboardContent.includes("Q1. Question 1"));
    assert.ok(clipboardContent.indexOf("Q1. Question 1") < clipboardContent.indexOf("Q2. Question 2"));
    assert.ok(clipboardContent.indexOf("Q2. Question 2") < clipboardContent.indexOf("Q3. Question 3"));
});

test("full copy flow keeps an unmarked first question and navigates without active markers", async () => {
    const frames = {
        question: { document: createQuestionDocument(1) },
        answer: { document: createAnswerDocument(1) },
    };
    const buttons = [];
    const clickCounts = new Map();
    const navigate = (number) => {
        clickCounts.set(number, (clickCounts.get(number) || 0) + 1);
        setTimeout(() => {
            frames.question.document = createQuestionDocument(number);
        }, 20);
        setTimeout(() => {
            frames.answer.document = createAnswerDocument(number);
        }, 60);
    };
    buttons.push(createButton("setpage(3)", "Q3", { onClick: () => navigate(3) }), createButton("setpage(1)", "Q1", { onClick: () => navigate(1) }), createButton("setpage(2)", "Q2", { onClick: () => navigate(2) }));
    const copyButton = { disabled: false, style: {}, textContent: "" };
    const exportButton = { disabled: false, style: {}, textContent: "" };
    let clipboardContent = null;
    let confirmMessage = "";
    const helpers = loadHelpers(buttons, frames, {
        confirm: true,
        copyButton,
        exportButton,
        onConfirm(message) {
            confirmMessage = message;
        },
        onClipboardWrite(content) {
            clipboardContent = content;
        },
    });

    await helpers.startExport("copy");
    for (let attempt = 0; attempt < 100 && clipboardContent === null; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.notEqual(clipboardContent, null);
    assert.match(confirmMessage, /1番の問題を表示してから実行/);
    assert.equal(clickCounts.get(1), undefined);
    assert.equal(clickCounts.get(2), 1);
    assert.equal(clickCounts.get(3), 1);
    assert.deepEqual(
        Array.from(helpers.getExportState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
    assert.ok(clipboardContent.includes("Q1. Question 1"));
    assert.ok(clipboardContent.includes("Q2. Question 2"));
    assert.ok(clipboardContent.includes("Q3. Question 3"));
});
