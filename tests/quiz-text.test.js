const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadQuizText() {
    const context = {};
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/utils/quiz-text.js", "utf8"), context);
    return context.BetterEclassUtils.quizText;
}

function createDocument(element) {
    return {
        querySelector(selector) {
            return selector.includes(".question") ? element : null;
        },
    };
}

// e-class prompts are written as one <p> per line; a wrapped sentence continues in the next <p>.
function createPrompt(lines, { rendered = true } = {}) {
    const paragraphs = lines.map((line) => (rendered ? { innerText: line, textContent: line } : { textContent: line }));
    return createDocument({
        textContent: lines.join(""),
        querySelectorAll: (selector) => (selector === "p" ? paragraphs : []),
    });
}

test("reads every paragraph as one line each", () => {
    const { getQuestionText } = loadQuizText();
    const lines = [
        "第2回 提出課題",
        "（１）日本に限らず、有史以来、世界的に平均寿命が延びて来ているが、",
        "　　　どのような理由で人類の平均寿命は延びてきたのかについて答えよ。",
        "※提出期限があります。順守してください。",
    ];

    assert.equal(getQuestionText(createPrompt(lines)), lines.join("\n"));
});

test("keeps full-width indentation and a single blank line for empty paragraphs", () => {
    const { getQuestionText } = loadQuizText();
    const lines = ["「第2回 資料」を見て", "　要点を1000字程度で記せ。", "", "", "提出ファイルは、Word形式です。"];

    assert.equal(
        getQuestionText(createPrompt(lines)),
        "「第2回 資料」を見て\n　要点を1000字程度で記せ。\n\n提出ファイルは、Word形式です。",
    );
});

test("uses textContent when the frame is not rendered", () => {
    const { getQuestionText } = loadQuizText();

    assert.equal(getQuestionText(createPrompt(["Line 1", "Line 2"], { rendered: false })), "Line 1\nLine 2");
});

test("falls back to the whole element when there are no paragraphs", () => {
    const { getQuestionText } = loadQuizText();

    assert.equal(getQuestionText(createDocument({ innerText: "  Question 1\r\n\r\n\r\nDetails  " })), "Question 1\n\nDetails");
    assert.equal(getQuestionText(createDocument({ textContent: "  Question 1  " })), "Question 1");
    assert.equal(getQuestionText({ querySelector: () => null }), "");
});
