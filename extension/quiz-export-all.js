// quiz-export-all.js
// Export all quiz questions to a text file

(function () {
    "use strict";

    // Debug mode - loaded from settings
    let DEBUG = false;

    // Load debug mode setting
    chrome.storage.local.get({ debugMode: false }, (items) => {
        DEBUG = items.debugMode || false;
    });

    console.log("[BetterE-class] Quiz export all script initialized, frame name:", window.name);

    // Check if this page has quiz navigation buttons AND answer options
    const hasQuizButtons = () => {
        // First check if page has navigation buttons
        const hasNavButtons = document.querySelector('input[name="page_num"]') !== null;
        if (!hasNavButtons) {
            return false;
        }

        // Check if answer frame has .seloptions (answer options table)
        // This distinguishes quiz pages from file submission/PDF pages
        try {
            const answerFrame = parent.frames["answer"] || parent.parent.frames["answer"];
            if (!answerFrame) {
                return false;
            }

            const answerDoc = answerFrame.document;
            if (!answerDoc) {
                return false;
            }

            // Check for .seloptions in answer frame
            const hasAnswerOptions = answerDoc.querySelector(".seloptions") !== null;
            return hasAnswerOptions;
        } catch (error) {
            // If we can't access the answer frame, assume it's not a quiz page
            if (DEBUG) console.log("[BetterE-class] Cannot access answer frame:", error);
            return false;
        }
    };

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        // Try to add button immediately
        if (addExportButton()) {
            return;
        }

        // If not found, wait for the element to appear
        const observer = new MutationObserver((_mutations, obs) => {
            if (addExportButton()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Stop observing after 5 seconds
        setTimeout(() => observer.disconnect(), 5000);
    }

    function addExportButton() {
        // Check if this page has quiz navigation buttons
        if (!hasQuizButtons()) {
            return false;
        }

        // Check if button already exists
        if (document.querySelector(".betterEclass-quiz-export-all-btn")) {
            return true;
        }

        // Find the table containing the question buttons
        const table = document.querySelector("table");
        if (!table) {
            return false;
        }

        // Create a container div for the buttons
        const container = document.createElement("div");
        container.style.cssText = `
      text-align: center;
      padding: 10px;
      background: #eeeeee;
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
      align-items: stretch;
    `;

        // Create copy to clipboard button
        const copyButton = document.createElement("button");
        copyButton.className = "betterEclass-quiz-copy-all-btn";
        copyButton.textContent = "📋 全てコピー";
        copyButton.type = "button";
        copyButton.style.cssText = `
      padding: 10px 20px;
      background: #4a90e2;
      color: white;
      border: 2px solid #357abd;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    `;

        // Copy button hover effect
        copyButton.addEventListener("mouseenter", () => {
            copyButton.style.background = "#357abd";
            copyButton.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
            copyButton.style.transform = "translateY(-1px)";
        });

        copyButton.addEventListener("mouseleave", () => {
            copyButton.style.background = "#4a90e2";
            copyButton.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
            copyButton.style.transform = "translateY(0)";
        });

        // Copy button click event
        copyButton.addEventListener("click", () => startExport("copy"));

        // Create export to file button
        const exportButton = document.createElement("button");
        exportButton.className = "betterEclass-quiz-export-all-btn";
        exportButton.textContent = "💾 全て出力";
        exportButton.type = "button";
        exportButton.style.cssText = `
      padding: 10px 20px;
      background: #52c41a;
      color: white;
      border: 2px solid #3da016;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    `;

        // Export button hover effect
        exportButton.addEventListener("mouseenter", () => {
            exportButton.style.background = "#3da016";
            exportButton.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
            exportButton.style.transform = "translateY(-1px)";
        });

        exportButton.addEventListener("mouseleave", () => {
            exportButton.style.background = "#52c41a";
            exportButton.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
            exportButton.style.transform = "translateY(0)";
        });

        // Export button click event
        exportButton.addEventListener("click", () => startExport("file"));

        // Add buttons to container
        container.appendChild(copyButton);
        container.appendChild(exportButton);

        // Insert container at the top of the body (before the table)
        document.body.insertBefore(container, document.body.firstChild);
    }

    // Get quiz title from URL parameters
    function getQuizTitle() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const contentsName = urlParams.get("contents_name");
            if (contentsName) {
                return decodeURIComponent(contentsName);
            }
        } catch (error) {
            console.error("[BetterE-class] Error getting quiz title:", error);
        }
        return "quiz_export";
    }

    // Store export state in top window to survive frame reloads
    function getExportState() {
        // Access the same parent level as question/answer frames
        const stateHolder = parent.parent || window.parent || window.top;

        if (!stateHolder.__betterEclassExportState) {
            stateHolder.__betterEclassExportState = {
                isExporting: false,
                exportData: [],
                totalQuestions: 0,
                currentQuestion: 0,
                exportMode: "file", // 'copy' or 'file'
            };
        }
        return stateHolder.__betterEclassExportState;
    }

    // Initialize: check if export is in progress and resume if needed
    // Only check in buttons frame to avoid unnecessary operations
    if (hasQuizButtons()) {
        let resumeChecked = false;

        function checkAndResume() {
            if (resumeChecked) return false; // Already checked, don't check again

            const state = getExportState();

            // Resume if exporting and on a question
            if (state.isExporting && state.currentQuestion > 0) {
                resumeChecked = true;
                resumeExport();
                return true;
            }

            resumeChecked = true;
            return false;
        }

        // Try with a single delay (increased for stable loading)
        setTimeout(() => {
            checkAndResume();
        }, 1500);
    }

    async function startExport(mode = "file") {
        const state = getExportState();

        if (state.isExporting) {
            alert("エクスポート中です。しばらくお待ちください。");
            return;
        }

        // Get total number of questions
        const questionButtons = document.querySelectorAll('input[name="page_num"]');
        state.totalQuestions = questionButtons.length;

        if (state.totalQuestions === 0) {
            alert("問題が見つかりませんでした。");
            return;
        }

        const modeText = mode === "copy" ? "コピー" : "エクスポート";
        const confirmed = confirm(`${state.totalQuestions}問の問題を${modeText}します。\n\n※ Q1から実行してください。Q1以外から実行すると、途中の問題から収集されます。`);
        if (!confirmed) {
            return;
        }

        // Start collecting from current question
        state.isExporting = true;
        state.exportData = [];
        state.currentQuestion = 0;
        state.exportMode = mode;

        // Start collecting from question 1
        collectNextQuestion();
    }

    async function resumeExport() {
        // Continue collecting from current question
        collectNextQuestion();
    }

    async function collectNextQuestion() {
        const state = getExportState();
        const copyButton = document.querySelector(".betterEclass-quiz-copy-all-btn");
        const exportButton = document.querySelector(".betterEclass-quiz-export-all-btn");

        if (!copyButton || !exportButton) {
            // Buttons not found, wait and try again
            setTimeout(collectNextQuestion, 500);
            return;
        }

        // Disable both buttons during collection
        copyButton.disabled = true;
        copyButton.style.opacity = "0.6";
        copyButton.style.cursor = "not-allowed";
        exportButton.disabled = true;
        exportButton.style.opacity = "0.6";
        exportButton.style.cursor = "not-allowed";

        if (state.currentQuestion >= state.totalQuestions) {
            // All questions collected, export based on mode
            try {
                if (state.exportMode === "copy") {
                    await copyToClipboard();
                    copyButton.textContent = "✅ コピー完了!";
                    exportButton.textContent = "💾 全て出力";
                } else {
                    exportToFile();
                    exportButton.textContent = "✅ エクスポート完了!";
                    copyButton.textContent = "📋 全てコピー";
                }

                setTimeout(() => {
                    copyButton.textContent = "📋 全てコピー";
                    copyButton.disabled = false;
                    copyButton.style.opacity = "1";
                    copyButton.style.cursor = "pointer";
                    exportButton.textContent = "💾 全て出力";
                    exportButton.disabled = false;
                    exportButton.style.opacity = "1";
                    exportButton.style.cursor = "pointer";
                }, 3000);
            } catch (error) {
                console.error("[BetterE-class] Export failed:", error);
                alert("エクスポートに失敗しました。");

                // Re-enable buttons on error
                copyButton.textContent = "📋 全てコピー";
                copyButton.disabled = false;
                copyButton.style.opacity = "1";
                copyButton.style.cursor = "pointer";
                exportButton.textContent = "💾 全て出力";
                exportButton.disabled = false;
                exportButton.style.opacity = "1";
                exportButton.style.cursor = "pointer";
            } finally {
                state.isExporting = false;
                state.currentQuestion = 0;
            }
            return;
        }

        // Collect current question
        state.currentQuestion++;
        const icon = state.exportMode === "copy" ? "📋" : "💾";
        copyButton.textContent = `${icon} 収集中... (${state.currentQuestion}/${state.totalQuestions})`;
        exportButton.textContent = `${icon} 収集中... (${state.currentQuestion}/${state.totalQuestions})`;

        // Wait for frames to be ready
        const framesReady = await waitForFrames();
        if (!framesReady) {
            console.error("[BetterE-class] Timeout waiting for frames");
            state.isExporting = false;
            alert("フレームの読み込みに失敗しました。");

            // Re-enable buttons on error
            copyButton.textContent = "📋 全てコピー";
            copyButton.disabled = false;
            copyButton.style.opacity = "1";
            copyButton.style.cursor = "pointer";
            exportButton.textContent = "💾 全て出力";
            exportButton.disabled = false;
            exportButton.style.opacity = "1";
            exportButton.style.cursor = "pointer";
            return;
        }

        try {
            // Wait a bit more to ensure content is fully loaded
            await sleep(500);

            const questionData = await collectQuestionData(state.currentQuestion);
            if (questionData) {
                // Check for duplicate questions (same question text already collected)
                const isDuplicate = state.exportData.some((item) => item.question.trim() === questionData.question.trim());

                if (!isDuplicate) {
                    state.exportData.push(questionData);
                }
            }
        } catch (error) {
            console.error(`[BetterE-class] Error collecting question ${state.currentQuestion}:`, error);
        }

        // Navigate to next question
        if (state.currentQuestion < state.totalQuestions) {
            const nextQuestionNumber = state.currentQuestion + 1;

            try {
                // Find the navigation button for the next question
                const navigationButtons = document.querySelectorAll('input[name="page_num"]');

                // Since we always start from Q1, use simple index-based navigation
                // Q1 = index 0, Q2 = index 1, Q3 = index 2, etc.
                const buttonIndex = nextQuestionNumber - 1;

                if (buttonIndex < navigationButtons.length) {
                    const nextButton = navigationButtons[buttonIndex];

                    // Add a delay before navigation to ensure current question is fully processed
                    await sleep(600);

                    // Trigger click event - this will execute the onclick="setpage(X)"
                    nextButton.click();
                    // The frame will reload and resumeExport will be called
                } else {
                    throw new Error(`Navigation button not found at index ${buttonIndex}`);
                }
            } catch (error) {
                console.error("[BetterE-class] Error navigating to next question:", error);
                state.isExporting = false;
            }
        } else {
            // This was the last question, export now
            collectNextQuestion();
        }
    }

    // Wait for question and answer frames to be ready
    async function waitForFrames(maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const questionFrame = parent.parent.question || parent.parent.frames["question"];
                const answerFrame = parent.parent.answer || parent.parent.frames["answer"];

                // Basic frame existence check
                const framesExist = !!questionFrame && !!answerFrame;

                // Document accessibility check
                let docsAccessible = false;
                let questionDoc = null;
                let answerDoc = null;

                if (framesExist) {
                    try {
                        questionDoc = questionFrame.document;
                        answerDoc = answerFrame.document;
                        docsAccessible = !!questionDoc && !!answerDoc;
                    } catch (e) {
                        // Silently retry
                    }
                }

                // If frames and documents are accessible, check for content elements
                if (docsAccessible && questionDoc.body && answerDoc.body) {
                    // Try multiple selectors for question element
                    let questionElement = questionDoc.querySelector(".question p, .question .content");
                    if (!questionElement) {
                        questionElement = questionDoc.querySelector(".question");
                    }
                    const answerElement = answerDoc.querySelector(".seloptions");

                    if (questionElement && answerElement) {
                        return true;
                    }
                }
            } catch (error) {
                console.error("[BetterE-class] Error in frame check:", error);
            }

            await sleep(800);
        }

        console.error("[BetterE-class] Timeout: Frames never became ready after", maxAttempts, "attempts");
        return false;
    }

    async function collectQuestionData(questionNumber) {
        try {
            // Access the question and answer frames from buttons frame
            const questionFrame = parent.parent.question || parent.parent.frames["question"];
            const answerFrame = parent.parent.answer || parent.parent.frames["answer"];

            if (!questionFrame || !answerFrame) {
                console.error("[BetterE-class] Frames not found for question", questionNumber);
                return null;
            }

            // Extract question text
            let questionText = "";
            try {
                const questionDoc = questionFrame.document;
                // Try multiple selectors for question element
                let questionElement = questionDoc.querySelector(".question p, .question .content");
                if (!questionElement) {
                    questionElement = questionDoc.querySelector(".question");
                }
                if (questionElement) {
                    questionText = questionElement.textContent.trim();
                }
            } catch (error) {
                console.error("[BetterE-class] Error accessing question text:", error);
            }

            // Extract answer options
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
                console.error("[BetterE-class] Error accessing answer options:", error);
            }

            return {
                number: questionNumber,
                question: questionText,
                answers: answers,
            };
        } catch (error) {
            console.error(`[BetterE-class] Error collecting question ${questionNumber}:`, error);
            return null;
        }
    }

    // Format the collected data as text
    function formatQuestionsText() {
        const state = getExportState();
        let content = "";

        state.exportData.forEach((item) => {
            content += `Q${item.number}. ${item.question}\n`;
            item.answers.forEach((answer) => {
                content += `${answer}\n`;
            });
            content += "\n"; // Empty line between questions
        });

        return content;
    }

    // Copy all questions to clipboard
    async function copyToClipboard() {
        const state = getExportState();
        const content = formatQuestionsText();

        try {
            // Use current frame (buttons frame) for clipboard operations
            // Create textarea in current document
            const textarea = document.createElement("textarea");
            textarea.value = content;
            textarea.style.position = "fixed";
            textarea.style.top = "0";
            textarea.style.left = "0";
            textarea.style.width = "2em";
            textarea.style.height = "2em";
            textarea.style.padding = "0";
            textarea.style.border = "none";
            textarea.style.outline = "none";
            textarea.style.boxShadow = "none";
            textarea.style.background = "transparent";
            document.body.appendChild(textarea);

            // Focus and select
            textarea.focus();
            textarea.select();

            // Try modern API first, fallback to execCommand
            let successful = false;
            try {
                await navigator.clipboard.writeText(content);
                successful = true;
            } catch (e) {
                // Fallback to execCommand
                successful = document.execCommand("copy");
            }

            document.body.removeChild(textarea);

            if (!successful) {
                throw new Error("Copy command failed");
            }
        } catch (error) {
            console.error("[BetterE-class] Failed to copy to clipboard:", error);
            throw error;
        }
    }

    // Export all questions to file
    function exportToFile() {
        const state = getExportState();
        const content = formatQuestionsText();

        // Create blob and download
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        // Use quiz title as filename
        const quizTitle = getQuizTitle();
        a.download = `${quizTitle}.txt`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
})();
