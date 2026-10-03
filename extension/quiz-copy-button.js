// quiz-copy-button.js
// Add a copy button to quiz/survey pages to copy question and answers to clipboard

(function () {
    "use strict";

    console.log("[BetterE-class] Quiz copy button script initialized");

    // Declared before init() runs, which can happen synchronously below.
    let message = null;

    // Check if we're in the question frame
    if (window.name !== "question") {
        return;
    }

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        // Try to add button immediately
        if (addCopyButton()) {
            return;
        }

        // If not found, wait for the element to appear (Vue app might be loading)
        const observer = new MutationObserver((mutations, obs) => {
            if (addCopyButton()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Stop observing after 10 seconds
        setTimeout(() => observer.disconnect(), 10000);
    }

    function addCopyButton() {
        // Find the question element
        const questionElement = document.querySelector(".question.previewPlace, .question, .previewPlace");
        if (!questionElement) {
            return false;
        }

        // Check if button already exists
        if (questionElement.parentElement?.querySelector(".betterEclass-quiz-copy-btn")) {
            return true;
        }

        const controls = window.BetterEclassUtils && window.BetterEclassUtils.controls;
        if (!controls) return true;

        const wrapper = document.createElement("div");
        wrapper.className = "bec-scope bec-quiz-copy";
        const button = controls.createButton({
            icon: "clipboard",
            label: "問題をコピー",
            title: "この問題と選択肢をクリップボードにコピーします",
            onClick: () => copyQuizToClipboard(button),
        });
        button.classList.add("betterEclass-quiz-copy-btn");
        message = document.createElement("span");
        message.className = "bec-message";
        message.setAttribute("role", "status");
        message.hidden = true;
        wrapper.append(button, message);

        // Insert above the question
        questionElement.parentElement.insertBefore(wrapper, questionElement);

        return true;
    }

    async function copyQuizToClipboard(button) {
        try {
            // We're already in the question frame, so access answer frame from parent
            const answerFrame = window.parent.frames["answer"];

            if (!answerFrame) {
                showNotification("解答フレームが見つかりません", "error");
                return;
            }

            // Extract question text from current document
            let questionText = "";
            try {
                questionText = window.BetterEclassUtils.quizText.getQuestionText(document);
            } catch (error) {
                console.error("[BetterE-class] Error accessing question text:", error);
            }

            // Extract answer options from answer frame
            const answers = [];
            try {
                const answerDoc = answerFrame.document;
                const answerElements = answerDoc.querySelectorAll(".seloptions tr");

                answerElements.forEach((row) => {
                    const prefixLabel = row.querySelector(".prefix label");

                    // Try multiple selectors for option label
                    let optionLabel = row.querySelector(".option-label label");
                    if (!optionLabel) {
                        optionLabel = row.querySelector(".option-label p, .option-label .content");
                    }
                    if (!optionLabel) {
                        optionLabel = row.querySelector(".option-label");
                    }

                    if (prefixLabel && optionLabel) {
                        const number = prefixLabel.textContent.trim();
                        const text = optionLabel.textContent.trim();
                        answers.push(`${number} ${text}`);
                    }
                });
            } catch (error) {
                console.error("[BetterE-class] Error accessing answer frame:", error);
            }

            // Format text
            let formattedText = "";
            if (questionText) {
                formattedText = questionText;
            }
            if (answers.length > 0) {
                formattedText += "\n" + answers.join("\n");
            }

            if (!formattedText) {
                showNotification("問題テキストが見つかりません", "error");
                return;
            }

            // Copy to clipboard
            await navigator.clipboard.writeText(formattedText);
            showNotification("コピーしました", "success");
        } catch (error) {
            console.error("[BetterE-class] Error copying quiz:", error);
            showNotification("コピーに失敗しました", "error");
        }
    }

    // Success shows only as the button's check mark; errors are explained next to the button.
    function showNotification(text, type = "success") {
        const controls = window.BetterEclassUtils.controls;
        const button = document.querySelector(".betterEclass-quiz-copy-btn");
        controls.setButtonState(button, type === "success" ? "success" : "error");
        controls.setMessage(message, "error", type === "success" ? "" : text);
    }
})();
