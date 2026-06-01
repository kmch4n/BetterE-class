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

    function getQuizFrames() {
        const questionFrame = parent.parent.question || parent.parent.frames["question"];
        const answerFrame = parent.parent.answer || parent.parent.frames["answer"];

        return {
            questionFrame,
            answerFrame,
        };
    }

    function getQuestionElement(questionDoc) {
        let questionElement = questionDoc.querySelector(".question p, .question .content");
        if (!questionElement) {
            questionElement = questionDoc.querySelector(".question.previewPlace, .question, .previewPlace");
        }

        return questionElement;
    }

    function getQuestionText(questionDoc) {
        const questionElement = getQuestionElement(questionDoc);
        return questionElement ? questionElement.textContent.trim() : "";
    }

    function detectAnswerLayout(answerDoc) {
        if (!answerDoc || !answerDoc.body) {
            return "not-ready";
        }

        if (answerDoc.querySelector(".seloptions")) {
            return "option-table";
        }

        if (answerDoc.querySelector("textarea")) {
            return "textarea";
        }

        if (
            answerDoc.querySelector(
                'input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], input:not([type])',
            )
        ) {
            return "text-input";
        }

        if (answerDoc.querySelector("select, input, button")) {
            return "unsupported";
        }

        const bodyText = answerDoc.body.textContent.trim();
        if (!bodyText) {
            return "not-ready";
        }

        return "unsupported";
    }

    function createAnswerLayoutNotice(layoutType) {
        if (layoutType === "text-input") {
            return "[Text input answer field detected]";
        }

        if (layoutType === "textarea") {
            return "[Text area answer field detected]";
        }

        return "[Unsupported answer layout detected]";
    }

    function collectAnswerData(answerDoc, questionNumber) {
        const layoutType = detectAnswerLayout(answerDoc);
        const answers = [];
        const warnings = [];

        if (layoutType === "option-table") {
            const answerElements = answerDoc.querySelectorAll(".seloptions tr");

            answerElements.forEach((row) => {
                const prefixLabel = row.querySelector(".prefix label");

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

            return {
                answers,
                layoutType,
                warnings,
            };
        }

        if (layoutType === "not-ready") {
            warnings.push(`Question ${questionNumber}: answer frame was not ready for export.`);
            return {
                answers: ["[Answer frame was not ready]"],
                layoutType,
                warnings,
            };
        }

        answers.push(createAnswerLayoutNotice(layoutType));
        warnings.push(
            `Question ${questionNumber}: exported the prompt only because answer layout '${layoutType}' is not option-based.`,
        );

        return {
            answers,
            layoutType,
            warnings,
        };
    }

    function getExportWarningsMessage(warnings) {
        if (!warnings || warnings.length === 0) {
            return "";
        }

        return ["Export completed with notes:", ...warnings.map((warning) => `- ${warning}`)].join("\n");
    }

    // Check if this page has quiz navigation buttons
    const hasQuizButtons = () => {
        const hasNavButtons = document.querySelector('input[name="page_num"]') !== null;
        if (!hasNavButtons) {
            return false;
        }

        try {
            const { questionFrame, answerFrame } = getQuizFrames();
            if (!questionFrame || !answerFrame) {
                return false;
            }

            const questionDoc = questionFrame.document;
            const answerDoc = answerFrame.document;
            if (!questionDoc || !answerDoc) {
                return false;
            }

            return !!questionDoc.body && !!answerDoc.body;
        } catch (error) {
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

        return true;
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
                warnings: [],
                totalQuestions: 0,
                currentQuestion: 0,
                exportMode: "file", // 'copy' or 'file'
                lastFingerprint: null, // fingerprint of the last captured question
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
        state.warnings = [];
        state.currentQuestion = 0;
        state.exportMode = mode;
        state.lastFingerprint = null;

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

                const warningsMessage = getExportWarningsMessage(state.warnings);
                if (warningsMessage) {
                    alert(warningsMessage);
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

        // Wait until the frames show FRESH content for this question. Right after
        // navigation the previous question's DOM lingers for a moment; collecting
        // it would capture the wrong question, so we wait for content that differs
        // from the previously captured question instead of guessing with a delay.
        const wait = await waitForFreshQuestion(state.lastFingerprint);
        if (!wait.ok) {
            console.error("[BetterE-class] Timeout waiting for fresh question content");
            state.isExporting = false;
            alert("問題の読み込みに失敗しました。Q1から再度お試しください。");

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
            const questionData = await collectQuestionData(state.currentQuestion);
            if (questionData) {
                // Guard against accidental double-collection by question number.
                // The fresh-content wait already prevents capturing stale duplicates,
                // so distinct questions with similar text are no longer dropped.
                const alreadyCollected = state.exportData.some((item) => item.number === questionData.number);

                if (!alreadyCollected) {
                    state.exportData.push(questionData);
                    state.lastFingerprint = wait.fingerprint;
                    if (questionData.warnings && questionData.warnings.length > 0) {
                        state.warnings.push(...questionData.warnings);
                    }
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

    // Build a fingerprint identifying the question currently shown in the frames.
    // Uses innerHTML (not textContent) so layouts without visible answer text
    // (textarea / text-input) still differ between questions, because their
    // per-question input name/id attributes are part of the markup.
    function getQuestionFingerprint(questionDoc, answerDoc) {
        const questionPart = questionDoc && questionDoc.body ? questionDoc.body.innerHTML.trim() : "";
        const answerPart = answerDoc && answerDoc.body ? answerDoc.body.innerHTML.trim() : "";
        return `${questionPart}${answerPart}`;
    }

    // Wait until the frames show fresh, ready content for the question being
    // collected. "Fresh" means the fingerprint differs from the previously
    // captured question AND has stayed stable across two consecutive polls, so we
    // never capture stale (previous) content or a transient mid-render state.
    // Returns { ok, fingerprint }; ok is false on timeout (treated as an error).
    async function waitForFreshQuestion(previousFingerprint, maxAttempts = 60, intervalMs = 200) {
        let lastSeen = null;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const { questionFrame, answerFrame } = getQuizFrames();

                let questionDoc = null;
                let answerDoc = null;
                if (questionFrame && answerFrame) {
                    try {
                        questionDoc = questionFrame.document;
                        answerDoc = answerFrame.document;
                    } catch (e) {
                        // Frame not accessible yet, retry
                    }
                }

                if (questionDoc && answerDoc && questionDoc.body && answerDoc.body) {
                    const ready = !!getQuestionText(questionDoc) && detectAnswerLayout(answerDoc) !== "not-ready";

                    if (ready) {
                        const fingerprint = getQuestionFingerprint(questionDoc, answerDoc);
                        const isFresh = previousFingerprint == null || fingerprint !== previousFingerprint;
                        const isStable = fingerprint === lastSeen;

                        if (isFresh && isStable) {
                            return { ok: true, fingerprint };
                        }

                        lastSeen = fingerprint;
                    }
                }
            } catch (error) {
                console.error("[BetterE-class] Error while waiting for fresh question:", error);
            }

            await sleep(intervalMs);
        }

        console.error("[BetterE-class] Timeout: fresh question content never appeared after", maxAttempts, "attempts");
        return { ok: false, fingerprint: lastSeen };
    }

    async function collectQuestionData(questionNumber) {
        try {
            const { questionFrame, answerFrame } = getQuizFrames();

            if (!questionFrame || !answerFrame) {
                console.error("[BetterE-class] Frames not found for question", questionNumber);
                return null;
            }

            // Extract question text
            let questionText = "";
            try {
                const questionDoc = questionFrame.document;
                questionText = getQuestionText(questionDoc);
            } catch (error) {
                console.error("[BetterE-class] Error accessing question text:", error);
            }

            let answers = [];
            let answerType = "unsupported";
            let warnings = [];
            try {
                const answerDoc = answerFrame.document;
                const answerData = collectAnswerData(answerDoc, questionNumber);
                answers = answerData.answers;
                answerType = answerData.layoutType;
                warnings = answerData.warnings;
            } catch (error) {
                console.error("[BetterE-class] Error accessing answer options:", error);
                warnings.push(`Question ${questionNumber}: failed to inspect answer layout.`);
                answers = ["[Failed to inspect answer layout]"];
            }

            return {
                number: questionNumber,
                question: questionText,
                answers: answers,
                answerType: answerType,
                warnings: warnings,
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
