const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

class FrameElement extends EventTarget {}

class MutationObserverMock {
    observe() {}

    disconnect() {}
}

function createQuestionDocument(number) {
    const text = `Question ${number}`;
    return {
        body: {
            innerHTML: `<div class="question">${text}</div>`,
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
            if (selector.includes(".option-label")) return { textContent: text };
            return null;
        },
    };
    return {
        body: {
            innerHTML: `<table class="seloptions"><tr>${text}</tr></table>`,
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

function createUnsupportedAnswerDocument() {
    return {
        body: {
            innerHTML: '<select name="answer"></select>',
            textContent: "Select an answer",
        },
        querySelector(selector) {
            return selector === "select, input, button" ? {} : null;
        },
        querySelectorAll() {
            return [];
        },
    };
}

function createNavigationButton(number, options = {}) {
    const attributes = {
        onclick: `setpage(${number})`,
        ...options.attributes,
    };
    return {
        value: `Q${number}`,
        className: options.className || "",
        disabled: options.disabled || false,
        getAttribute(name) {
            return attributes[name] ?? null;
        },
        click() {
            options.onClick?.();
        },
    };
}

function createHarness(options = {}) {
    const questionFrameElement = new FrameElement();
    const answerFrameElement = new FrameElement();
    const buttonFrameElement = new FrameElement();
    const frames = {
        question: {
            document: createQuestionDocument(options.initialQuestion || 1),
            frameElement: questionFrameElement,
            location: { search: "" },
        },
        answer: {
            document: options.unsupportedAnswers ? createUnsupportedAnswerDocument() : createAnswerDocument(options.initialQuestion || 1),
            frameElement: answerFrameElement,
            location: { search: "" },
        },
        button: {
            document: null,
            frameElement: buttonFrameElement,
            location: { search: "?contents_name=Quiz" },
            navigator: {
                clipboard: {
                    async writeText(content) {
                        if (options.copyReject) throw new Error("Clipboard unavailable");
                        harness.clipboardContent = content;
                    },
                },
            },
            __betterEclassQuizExportUI: {
                render(view) {
                    harness.views.push(view);
                },
                showMessage(tone, text) {
                    harness.messages.push({ tone, text });
                },
            },
            postMessage() {},
        },
    };
    const clickCounts = new Map();
    const activeState = { number: options.activeQuestion ?? null };

    function navigate(number) {
        clickCounts.set(number, (clickCounts.get(number) || 0) + 1);
        if (options.noOpCurrentClick && number === (options.initialQuestion || 1) && clickCounts.get(number) === 1) return;
        const updateQuestion = () => {
            frames.question.document = createQuestionDocument(number);
            questionFrameElement.dispatchEvent(new Event("load"));
            if (options.duplicateLoads) questionFrameElement.dispatchEvent(new Event("load"));
        };
        const updateAnswer = () => {
            frames.answer.document = options.unsupportedAnswers ? createUnsupportedAnswerDocument() : createAnswerDocument(number);
            answerFrameElement.dispatchEvent(new Event("load"));
            if (options.duplicateLoads) answerFrameElement.dispatchEvent(new Event("load"));
        };
        if (options.answerFirst) {
            setTimeout(updateAnswer, 5);
            setTimeout(updateQuestion, 15);
        } else {
            setTimeout(updateQuestion, 5);
            setTimeout(updateAnswer, 15);
        }
        if (activeState.number !== null) {
            if (options.delayedActive) {
                setTimeout(() => {
                    activeState.number = number;
                    buttonFrameElement.dispatchEvent(new Event("load"));
                }, 25);
            } else {
                activeState.number = number;
            }
        }
    }

    const buttons = [3, 1, 2].map((number) =>
        createNavigationButton(number, {
            get disabled() {
                return activeState.number === number;
            },
            onClick: () => navigate(number),
        }),
    );
    Object.defineProperty(buttons[0], "disabled", { get: () => activeState.number === 3 });
    Object.defineProperty(buttons[1], "disabled", { get: () => activeState.number === 1 });
    Object.defineProperty(buttons[2], "disabled", { get: () => activeState.number === 2 });

    frames.button.document = {
        body: {
            appendChild() {},
        },
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            return selector === 'input[name="page_num"]' ? buttons : [];
        },
        createElement() {
            return {
                style: {},
                focus() {},
                select() {},
                remove() {},
            };
        },
        execCommand() {
            return false;
        },
    };

    const harness = {
        messages: [],
        views: [],
        buttons,
        clickCounts,
        clipboardContent: null,
        frames,
        focused: options.focused ?? true,
    };
    if (options.detachedButtonFrame) {
        const quizFrameRoot = {
            question: frames.question,
            answer: frames.answer,
            frames: {
                question: frames.question,
                answer: frames.answer,
            },
        };
        frames.button.parent = { parent: quizFrameRoot, frames: { length: 0 } };
    }
    const discoverableFrames = options.detachedButtonFrame ? {} : frames;
    const directFrameCollection = Object.assign(discoverableFrames, {
        0: frames.button,
        1: frames.question,
        2: frames.answer,
        length: options.detachedButtonFrame ? 0 : 3,
    });
    const nestedFrameCollection = options.nestedFrames
        ? {
              0: {
                  name: "quiz-layout",
                  frames: directFrameCollection,
              },
              length: 1,
          }
        : directFrameCollection;
    const context = {
        Blob,
        Event,
        Map,
        MutationObserver: MutationObserverMock,
        URL,
        URLSearchParams,
        clearTimeout,
        console,
        crypto: { randomUUID: () => "run-1" },
        document: {
            visibilityState: options.hidden ? "hidden" : "visible",
            hasFocus() {
                return harness.focused;
            },
        },
        frames: nestedFrameCollection,
        location: {
            href: "https://eclass.doshisha.ac.jp/webclass/qstn_frame.php",
            origin: "https://eclass.doshisha.ac.jp",
        },
        addEventListener() {},
        setTimeout,
    };
    context.window = context;
    context.window.frames = nestedFrameCollection;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/utils/quiz-text.js", "utf8"), context);
    vm.runInContext(fs.readFileSync("extension/quiz-export-controller.js", "utf8"), context);
    harness.controller = context.window.__betterEclassQuizExportController;
    harness.rootDocument = context.document;
    return harness;
}

async function waitForPhase(controller, phase) {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (controller.getViewState().phase === phase) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`Controller never reached phase '${phase}'`);
}

test("controller resets from a known active Q2 and collects in numeric order", async () => {
    const harness = createHarness({ initialQuestion: 2, activeQuestion: 2, answerFirst: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
    assert.equal(harness.clickCounts.get(1), 2);
    assert.equal(harness.clickCounts.get(2), 1);
    assert.equal(harness.clickCounts.get(3), 1);
    assert.equal(harness.frames.question.document.body.textContent, "Question 1");
    assert.ok(harness.clipboardContent.includes("Q1. Question 1"));
    assert.ok(harness.clipboardContent.indexOf("Q1. Question 1") < harness.clipboardContent.indexOf("Q2. Question 2"));
});

test("controller finds quiz frames through a nested frameset", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, nestedFrames: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
});

test("button frame registration supplies navigation when tree discovery cannot", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, detachedButtonFrame: true });
    harness.controller.registerButtonFrame(harness.frames.button);

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
});

test("controller waits for a delayed button-frame active update", async () => {
    const harness = createHarness({ initialQuestion: 2, activeQuestion: 2, delayedActive: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
});

test("controller keeps an unmarked first question and requires both frame loads", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: null, answerFirst: true });

    await harness.controller.start("copy");

    assert.equal(harness.clickCounts.get(1), 2);
    assert.equal(harness.clickCounts.get(2), 1);
    assert.equal(harness.clickCounts.get(3), 1);
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
});

test("controller resets an unmarked later question to the first question", async () => {
    const harness = createHarness({ initialQuestion: 2, activeQuestion: null });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.equal(harness.clickCounts.get(1), 2);
    assert.ok(harness.clipboardContent.includes("Q1. Question 1"));
    assert.equal(harness.frames.question.document.body.textContent, "Question 1");
});

test("controller accepts an unmarked first-question click that is a no-op", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: null, noOpCurrentClick: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.equal(harness.clickCounts.get(1), 2);
    assert.ok(harness.clipboardContent.includes("Q1. Question 1"));
});

test("duplicate and reverse-order load events do not duplicate collection", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, answerFirst: true, duplicateLoads: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.equal(harness.controller.getState().exportData.length, 3);
    assert.deepEqual(
        Array.from(harness.controller.getState().exportData, ({ number }) => number),
        [1, 2, 3],
    );
});

test("a second start request cannot create a concurrent export run", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1 });

    const firstRun = harness.controller.start("copy");
    await harness.controller.start("file");
    await firstRun;

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.equal(harness.controller.getState().exportData.length, 3);
    assert.equal(harness.clickCounts.get(2), 1);
    assert.equal(harness.clickCounts.get(3), 1);
    assert.ok(harness.messages.some(({ tone, text }) => tone === "error" && text === "エクスポート中です。しばらくお待ちください。"));
});

test("hidden collection preserves output for a focused retry without recollecting", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, hidden: true, copyReject: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed-awaiting-copy");
    const collectedBeforeRetry = harness.controller.getState().exportData;
    const clicksBeforeRetry = new Map(harness.clickCounts);
    harness.focused = true;
    harness.rootDocument.visibilityState = "visible";
    harness.frames.button.navigator.clipboard.writeText = async (content) => {
        harness.clipboardContent = content;
    };

    await harness.controller.retryCopy();

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.notEqual(harness.clipboardContent, null);
    assert.equal(harness.controller.getState().exportData, collectedBeforeRetry);
    assert.deepEqual(harness.clickCounts, clicksBeforeRetry);
});

test("copy attempts the clipboard without requiring root-document focus", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, focused: false });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.notEqual(harness.clipboardContent, null);
});

test("completion is reported as a message and the view returns to idle", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1 });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.deepEqual(harness.messages.at(-1), { tone: "success", text: "3問をコピーしました" });
    await waitForPhase(harness.controller, "idle");
    assert.equal(harness.views.at(-1).phase, "idle");
});

test("describeStart explains the run without starting it", () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1 });

    const plan = harness.controller.describeStart();

    assert.equal(plan.count, 3);
    assert.match(plan.notice, /3問/);
    assert.equal(harness.controller.getViewState().phase, "idle");
    assert.equal(harness.clickCounts.size, 0);
});

test("unsupported answer layouts do not add placeholder text", async () => {
    const harness = createHarness({ initialQuestion: 1, activeQuestion: 1, unsupportedAnswers: true });

    await harness.controller.start("copy");

    assert.equal(harness.controller.getViewState().phase, "completed");
    assert.doesNotMatch(harness.clipboardContent, /\[Unsupported answer layout detected\]/);
    assert.ok(harness.clipboardContent.includes("Q1. Question 1"));
});

test("source keeps the UI guard and removes fixed polling from the controller", () => {
    const uiSource = fs.readFileSync("extension/quiz-export-all.js", "utf8");
    const controllerSource = fs.readFileSync("extension/quiz-export-controller.js", "utf8");
    const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));

    assert.match(uiSource, /window\.name !== "button"/);
    assert.match(uiSource, /input\[name=\"page_num\"\]/);
    assert.doesNotMatch(uiSource, /5000/);
    assert.doesNotMatch(controllerSource, /setInterval/);
    assert.match(controllerSource, /completed-awaiting-copy/);
    assert.match(uiSource, /registerButtonFrame\?\.\(window\)/);
    assert.ok(manifest.permissions.includes("clipboardWrite"));
});

test("button controls render before sibling quiz frames are ready", () => {
    let insertedContainer = null;
    const buttonStates = new Map();
    const anchor = {
        parentNode: {
            insertBefore(node) {
                insertedContainer = node;
            },
        },
    };
    const navigationButton = {
        closest() {
            return anchor;
        },
        parentElement: anchor,
    };
    function createElementMock(tagName) {
        const element = {
            tagName,
            children: [],
            className: "",
            dataset: {},
            hidden: false,
            style: {},
            setAttribute() {},
            appendChild(child) {
                element.children.push(child);
            },
            append(...children) {
                element.children.push(...children);
            },
        };
        element.classList = {
            add(name) {
                element.className += ` ${name}`;
            },
        };
        return element;
    }
    const controls = {
        createButton({ label }) {
            const button = createElementMock("button");
            button.label = label;
            return button;
        },
        setButtonLabel(button, label) {
            button.label = label;
        },
        setButtonState(button, state, options = {}) {
            buttonStates.set(button.label, { state, reason: options.reason });
        },
        setMessage() {},
    };
    const documentMock = {
        readyState: "complete",
        body: {
            firstChild: null,
            insertBefore(node) {
                insertedContainer = node;
            },
        },
        createElement: createElementMock,
        querySelector(selector) {
            if (selector === 'input[name="page_num"]') return navigationButton;
            if (selector === ".betterEclass-quiz-export-controls") return insertedContainer;
            return null;
        },
    };
    const context = {
        BetterEclassUtils: { controls },
        MutationObserver: MutationObserverMock,
        document: documentMock,
        location: {
            href: "https://eclass.doshisha.ac.jp/webclass/dqstn_button.php",
            origin: "https://eclass.doshisha.ac.jp",
        },
        name: "button",
        addEventListener() {},
    };
    context.window = context;
    context.parent = context;
    vm.createContext(context);

    vm.runInContext(fs.readFileSync("extension/quiz-export-all.js", "utf8"), context);

    assert.notEqual(insertedContainer, null);
    assert.match(insertedContainer.className, /bec-scope/);
    assert.deepEqual(buttonStates.get("全てコピー"), { state: "disabled", reason: "準備しています" });
    assert.deepEqual(buttonStates.get("全て出力"), { state: "disabled", reason: "準備しています" });
    assert.equal(typeof context.__betterEclassQuizExportUI.render, "function");
});
