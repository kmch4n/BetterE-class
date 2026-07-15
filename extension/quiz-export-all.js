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

        if (answerDoc.querySelector('input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], input:not([type])')) {
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
        warnings.push(`Question ${questionNumber}: exported the prompt only because answer layout '${layoutType}' is not option-based.`);

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

    function getQuestionNumber(button, fallbackNumber = null) {
        const onclick = button.getAttribute("onclick") || "";
        const onclickMatch = onclick.match(/setpage\s*\(\s*['"]?(\d+)/i);
        if (onclickMatch) {
            return Number.parseInt(onclickMatch[1], 10);
        }

        const candidates = [button.getAttribute("data-page"), button.getAttribute("data-page-num"), button.getAttribute("data-question-number"), button.value];

        for (const candidate of candidates) {
            const match = String(candidate || "").match(/\d+/);
            if (match) {
                return Number.parseInt(match[0], 10);
            }
        }

        return fallbackNumber;
    }

    function getQuestionNavigationButtons() {
        const buttons = Array.from(document.querySelectorAll('input[name="page_num"]'));
        const uniqueButtons = new Map();

        buttons.forEach((button, index) => {
            const questionNumber = getQuestionNumber(button, index + 1);
            const existingButton = uniqueButtons.get(questionNumber);
            if (!existingButton || isQuestionButtonActive(button)) {
                uniqueButtons.set(questionNumber, button);
            }
        });

        return Array.from(uniqueButtons, ([questionNumber, button]) => ({
            questionNumber,
            button,
        })).sort((a, b) => a.questionNumber - b.questionNumber);
    }

    function isQuestionButtonActive(button) {
        const ariaCurrent = button.getAttribute("aria-current");
        const className = typeof button.className === "string" ? button.className : "";

        return button.disabled || ariaCurrent === "page" || ariaCurrent === "true" || button.getAttribute("aria-pressed") === "true" || /(^|\s)(active|current|selected)(\s|$)/i.test(className);
    }

    function isQuizButtonFrame() {
        return window.name === "button" || window.location.href.includes("dqstn_button.php");
    }

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
                questionNumbers: [],
                pendingQuestionNumber: null,
                exportMode: "file", // 'copy' or 'file'
                lastFingerprint: null, // fingerprint of the last captured question
                previousQuestionDocument: null,
                previousAnswerDocument: null,
            };
        }
        return stateHolder.__betterEclassExportState;
    }

    if (isQuizButtonFrame() && getExportState().isExporting) {
        resumeExportWhenReady();
    }

    function resumeExportWhenReady(attempt = 0) {
        const state = getExportState();
        if (!state.isExporting) return;

        if (hasQuizButtons()) {
            resumeExport();
            return;
        }

        if (attempt >= 50) {
            state.isExporting = false;
            state.pendingQuestionNumber = null;
            alert("クイズ画面の再読み込みを確認できませんでした。もう一度お試しください。");
            return;
        }

        setTimeout(() => resumeExportWhenReady(attempt + 1), 200);
    }

    async function startExport(mode = "file") {
        const state = getExportState();

        if (state.isExporting) {
            alert("エクスポート中です。しばらくお待ちください。");
            return;
        }

        const navigationButtons = getQuestionNavigationButtons();
        state.totalQuestions = navigationButtons.length;

        if (state.totalQuestions === 0) {
            alert("問題が見つかりませんでした。");
            return;
        }

        const modeText = mode === "copy" ? "コピー" : "エクスポート";
        const confirmed = confirm(`${state.totalQuestions}問の問題を${modeText}します。\n\n最初の問題から順番に収集します。`);
        if (!confirmed) {
            return;
        }

        state.isExporting = true;
        state.exportData = [];
        state.warnings = [];
        state.currentQuestion = 0;
        state.questionNumbers = navigationButtons.map(({ questionNumber }) => questionNumber);
        state.pendingQuestionNumber = state.questionNumbers[0];
        state.exportMode = mode;
        state.lastFingerprint = null;
        state.previousQuestionDocument = null;
        state.previousAnswerDocument = null;

        const firstNavigation = navigationButtons[0];
        const activeNavigation = navigationButtons.find(({ button }) => isQuestionButtonActive(button));
        if (activeNavigation?.questionNumber === firstNavigation.questionNumber) {
            collectNextQuestion();
            return;
        }

        const { questionFrame, answerFrame } = getQuizFrames();
        state.previousQuestionDocument = questionFrame ? questionFrame.document : null;
        state.previousAnswerDocument = answerFrame ? answerFrame.document : null;
        state.lastFingerprint = getQuestionFingerprint(state.previousQuestionDocument, state.previousAnswerDocument);
        firstNavigation.button.click();
        setTimeout(collectNextQuestion, 500);
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

        const targetQuestionNumber = state.pendingQuestionNumber;
        if (targetQuestionNumber == null) {
            stopExportWithError(state, copyButton, exportButton, "次の問題番号を特定できませんでした。");
            return;
        }

        const progressNumber = state.currentQuestion + 1;
        const icon = state.exportMode === "copy" ? "📋" : "💾";
        copyButton.textContent = `${icon} 収集中... (${progressNumber}/${state.totalQuestions})`;
        exportButton.textContent = `${icon} 収集中... (${progressNumber}/${state.totalQuestions})`;

        // Wait until the frames show FRESH content for this question. Right after
        // navigation the previous question's DOM lingers for a moment; collecting
        // it would capture the wrong question, so we wait for content that differs
        // from the previously captured question instead of guessing with a delay.
        const wait = await waitForFreshQuestion(state.lastFingerprint, state.previousQuestionDocument, state.previousAnswerDocument, targetQuestionNumber);
        if (!wait.ok) {
            console.error("[BetterE-class] Timeout waiting for fresh question content");
            stopExportWithError(state, copyButton, exportButton, "問題の読み込みに失敗しました。もう一度お試しください。");
            return;
        }

        try {
            const questionData = collectQuestionData(targetQuestionNumber, wait.questionDocument, wait.answerDocument);
            if (!questionData) {
                throw new Error(`Question ${targetQuestionNumber} could not be collected`);
            }

            const alreadyCollected = state.exportData.some((item) => item.number === questionData.number);
            if (alreadyCollected) {
                throw new Error(`Question ${targetQuestionNumber} was collected more than once`);
            }

            state.exportData.push(questionData);
            state.currentQuestion++;
            state.pendingQuestionNumber = null;
            state.lastFingerprint = wait.fingerprint;
            state.previousQuestionDocument = wait.questionDocument;
            state.previousAnswerDocument = wait.answerDocument;
            if (questionData.warnings && questionData.warnings.length > 0) {
                state.warnings.push(...questionData.warnings);
            }
        } catch (error) {
            console.error(`[BetterE-class] Error collecting question ${targetQuestionNumber}:`, error);
            stopExportWithError(state, copyButton, exportButton, "問題の収集に失敗しました。もう一度お試しください。");
            return;
        }

        // Navigate to next question
        if (state.currentQuestion < state.totalQuestions) {
            const nextQuestionNumber = state.questionNumbers[state.currentQuestion];

            try {
                const nextNavigation = getQuestionNavigationButtons().find(({ questionNumber }) => questionNumber === nextQuestionNumber);
                if (!nextNavigation) {
                    throw new Error(`Navigation button not found for question ${nextQuestionNumber}`);
                }

                state.pendingQuestionNumber = nextQuestionNumber;
                await sleep(300);
                nextNavigation.button.click();
                setTimeout(collectNextQuestion, 500);
            } catch (error) {
                console.error("[BetterE-class] Error navigating to next question:", error);
                stopExportWithError(state, copyButton, exportButton, "次の問題への移動に失敗しました。");
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
    // captured question AND has stayed stable across three consecutive polls, so we
    // never capture stale (previous) content or a transient mid-render state.
    // Returns { ok, fingerprint }; ok is false on timeout (treated as an error).
    async function waitForFreshQuestion(previousFingerprint, previousQuestionDocument = null, previousAnswerDocument = null, expectedQuestionNumber = null, maxAttempts = 60, intervalMs = 200) {
        let lastSeen = null;
        let stablePolls = 0;

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
                    const activeNavigation = getQuestionNavigationButtons().find(({ button }) => isQuestionButtonActive(button));
                    const targetMatches = expectedQuestionNumber == null || activeNavigation?.questionNumber === expectedQuestionNumber;
                    const documentsChanged = (!previousQuestionDocument || questionDoc !== previousQuestionDocument) && (!previousAnswerDocument || answerDoc !== previousAnswerDocument);
                    const ready = !!getQuestionText(questionDoc) && detectAnswerLayout(answerDoc) !== "not-ready";

                    if (targetMatches && documentsChanged && ready) {
                        const fingerprint = getQuestionFingerprint(questionDoc, answerDoc);
                        const hasPreviousDocuments = previousQuestionDocument !== null || previousAnswerDocument !== null;
                        const isFresh = hasPreviousDocuments ? documentsChanged : previousFingerprint == null || fingerprint !== previousFingerprint;
                        stablePolls = fingerprint === lastSeen ? stablePolls + 1 : 1;
                        const isStable = stablePolls >= 3;

                        if (isFresh && isStable) {
                            return {
                                ok: true,
                                fingerprint,
                                questionDocument: questionDoc,
                                answerDocument: answerDoc,
                            };
                        }

                        lastSeen = fingerprint;
                    } else {
                        lastSeen = null;
                        stablePolls = 0;
                    }
                }
            } catch (error) {
                console.error("[BetterE-class] Error while waiting for fresh question:", error);
            }

            await sleep(intervalMs);
        }

        console.error("[BetterE-class] Timeout: fresh question content never appeared after", maxAttempts, "attempts");
        return {
            ok: false,
            fingerprint: lastSeen,
            questionDocument: null,
            answerDocument: null,
        };
    }

    function collectQuestionData(questionNumber, questionDoc, answerDoc) {
        try {
            if (!questionDoc || !answerDoc) {
                console.error("[BetterE-class] Frame documents not found for question", questionNumber);
                return null;
            }

            // Extract question text
            let questionText = "";
            try {
                questionText = getQuestionText(questionDoc);
            } catch (error) {
                console.error("[BetterE-class] Error accessing question text:", error);
            }

            let answers = [];
            let answerType = "unsupported";
            let warnings = [];
            try {
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

    function stopExportWithError(state, copyButton, exportButton, message) {
        state.isExporting = false;
        state.pendingQuestionNumber = null;
        copyButton.textContent = "📋 全てコピー";
        copyButton.disabled = false;
        copyButton.style.opacity = "1";
        copyButton.style.cursor = "pointer";
        exportButton.textContent = "💾 全て出力";
        exportButton.disabled = false;
        exportButton.style.opacity = "1";
        exportButton.style.cursor = "pointer";
        alert(message);
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
