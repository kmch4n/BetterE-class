// quiz-text.js
// Reads a quiz question's prompt as the user sees it. Shared by the per-question copy button
// (question frame) and the copy all / export all controller (top frame).

(function () {
    "use strict";

    function getQuestionElement(doc) {
        return doc.querySelector(".question.previewPlace, .question, .previewPlace");
    }

    // Only ASCII whitespace is trimmed: a full-width space (U+3000) is the prompt's own indentation.
    const trimAscii = (text) => text.replace(/^[ \t\n]+|[ \t\n]+$/g, "");

    function normalize(text) {
        return trimAscii(
            text
                .replace(/\r\n?/g, "\n")
                .replace(/[ \t]+$/gm, "")
                .replace(/\n{3,}/g, "\n\n"),
        );
    }

    // innerText keeps <br> breaks; it falls back to textContent when the frame is not rendered.
    const textOf = (element) => (typeof element.innerText === "string" ? element.innerText : element.textContent || "");

    /**
     * The whole prompt as e-class shows it: one line per paragraph.
     * Prompts are written as one <p> per line (wrapped sentences continue in the next <p>),
     * so paragraphs join with a single line break; an empty paragraph stays as a blank line.
     * @param {Document} doc
     * @returns {string}
     */
    function getQuestionText(doc) {
        const element = getQuestionElement(doc);
        if (!element) return "";

        const paragraphs = typeof element.querySelectorAll === "function" ? Array.from(element.querySelectorAll("p")) : [];
        if (paragraphs.length > 0) {
            return normalize(paragraphs.map((paragraph) => trimAscii(textOf(paragraph))).join("\n"));
        }
        return normalize(textOf(element));
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.quizText = { getQuestionElement, getQuestionText };
})();
