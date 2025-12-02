// quiz-copy-button.js
// Add a copy button to quiz/survey pages to copy question and answers to clipboard

(function () {
    "use strict";

    console.log("[BetterE-class] Quiz copy button script initialized");

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
        const existingButton = questionElement.parentElement?.querySelector(".betterEclass-quiz-copy-btn");
        if (existingButton) {
            return true;
        }

        // Create copy button
        const button = document.createElement("button");
        button.className = "betterEclass-quiz-copy-btn";
        button.textContent = "📋 問題をコピー";
        button.type = "button";
        button.style.cssText = `
      padding: 8px 16px;
      margin-bottom: 12px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    `;

        // Hover effect
        button.addEventListener("mouseenter", () => {
            button.style.background = "#357abd";
            button.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            button.style.transform = "translateY(-1px)";
        });

        button.addEventListener("mouseleave", () => {
            button.style.background = "#4a90e2";
            button.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
            button.style.transform = "translateY(0)";
        });

        // Click event
        button.addEventListener("click", copyQuizToClipboard);

        // Insert button above the question
        questionElement.parentElement.insertBefore(button, questionElement);

        return true;
    }

    async function copyQuizToClipboard() {
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
                // First try to find p or .content inside .question
                let questionElement = document.querySelector(".question p, .question .content");

                // If not found, get text directly from .question element
                if (!questionElement) {
                    questionElement = document.querySelector(".question");
                }

                if (questionElement) {
                    questionText = questionElement.textContent.trim();
                }
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
            showNotification("問題をコピーしました！", "success");
        } catch (error) {
            console.error("[BetterE-class] Error copying quiz:", error);
            showNotification("コピーに失敗しました", "error");
        }
    }

    function showNotification(message, type = "success") {
        // Create notification element
        const notification = document.createElement("div");
        notification.textContent = message;
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${type === "success" ? "#52c41a" : "#ff4444"};
      color: white;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideDown 0.3s ease;
    `;

        // Add animation
        const style = document.createElement("style");
        style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove notification after 2 seconds
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transition = "opacity 0.3s ease";
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        }, 2000);
    }
})();
