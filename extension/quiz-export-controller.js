// quiz-export-controller.js
// Coordinates quiz export from the stable qstn_frame.php window.

(function () {
    "use strict";

    // Names may already be decoded by URLSearchParams; a literal "%" must not throw
    function safeDecodeURIComponent(value) {
        try {
            return decodeURIComponent(value);
        } catch (_) {
            return value;
        }
    }

    const CONTROLLER_KEY = "__betterEclassQuizExportController";
    const COMPLETION_RESET_MS = 3000;
    const FRAME_WAIT_TIMEOUT_MS = 30000;
    const FIRST_QUESTION_NOOP_GRACE_MS = 2000;
    const SNAPSHOT_SETTLE_MS = 150;

    if (!window.location.href.includes("qstn_frame.php") || window[CONTROLLER_KEY]) {
        return;
    }

    let registeredButtonFrame = null;

    function findFrameFromRegisteredButton(name) {
        if (!registeredButtonFrame) return null;
        if (name === "button") return registeredButtonFrame;

        let current = registeredButtonFrame;
        for (let depth = 0; depth < 4; depth++) {
            try {
                if (current.name === name) return current;
                const directFrame = current.frames?.[name] || current[name];
                if (directFrame) return directFrame;
                if (current === current.parent) break;
                current = current.parent;
            } catch (_error) {
                break;
            }
        }
        return null;
    }

    function findFrame(rootWindow, name, visited, depth = 0) {
        if (!rootWindow || visited.has(rootWindow) || depth > 6) return null;
        visited.add(rootWindow);

        try {
            if (rootWindow.name === name) return rootWindow;
            const directFrame = rootWindow.frames?.[name] || rootWindow[name];
            if (directFrame) return directFrame;

            const frameCount = rootWindow.frames?.length || 0;
            for (let index = 0; index < frameCount; index++) {
                const nestedFrame = findFrame(rootWindow.frames[index], name, visited, depth + 1);
                if (nestedFrame) return nestedFrame;
            }
        } catch (_error) {
            return null;
        }
        return null;
    }

    function getFrame(name) {
        const registeredFrame = findFrameFromRegisteredButton(name);
        if (registeredFrame) return registeredFrame;

        const roots = [];
        let current = window;
        for (let depth = 0; depth < 6; depth++) {
            roots.push(current);
            try {
                if (current === current.parent) break;
                current = current.parent;
            } catch (_error) {
                break;
            }
        }

        const visited = new Set();
        for (const root of roots.reverse()) {
            const frame = findFrame(root, name, visited);
            if (frame) return frame;
        }
        return null;
    }

    function registerButtonFrame(buttonFrame) {
        if (!buttonFrame) return;
        registeredButtonFrame = buttonFrame;
        syncUI();
    }

    function getFrameDocument(name) {
        try {
            return getFrame(name)?.document || null;
        } catch (_error) {
            return null;
        }
    }

    function getButtonDocument() {
        return getFrameDocument("button");
    }

    function getQuestionElement(questionDoc) {
        return questionDoc.querySelector(".question p, .question .content") || questionDoc.querySelector(".question.previewPlace, .question, .previewPlace");
    }

    function getQuestionText(questionDoc) {
        return getQuestionElement(questionDoc)?.textContent.trim() || "";
    }

    function detectAnswerLayout(answerDoc) {
        if (!answerDoc?.body) return "not-ready";
        if (answerDoc.querySelector(".seloptions")) return "option-table";
        if (answerDoc.querySelector("textarea")) return "textarea";
        if (answerDoc.querySelector('input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], input:not([type])')) return "text-input";
        if (answerDoc.querySelector("select, input, button")) return "unsupported";
        return answerDoc.body.textContent.trim() ? "unsupported" : "not-ready";
    }

    function createAnswerLayoutNotice(layoutType) {
        if (layoutType === "text-input") return "[Text input answer field detected]";
        if (layoutType === "textarea") return "[Text area answer field detected]";
        return "";
    }

    function collectAnswerData(answerDoc, questionNumber) {
        const layoutType = detectAnswerLayout(answerDoc);
        const answers = [];
        const warnings = [];

        if (layoutType === "option-table") {
            answerDoc.querySelectorAll(".seloptions tr").forEach((row) => {
                const prefixLabel = row.querySelector(".prefix label");
                const optionLabel = row.querySelector(".option-label label") || row.querySelector(".option-label p, .option-label .content") || row.querySelector(".option-label");
                if (prefixLabel && optionLabel) {
                    answers.push(`${prefixLabel.textContent.trim()} ${optionLabel.textContent.trim()}`);
                }
            });
            return { answers, layoutType, warnings };
        }

        if (layoutType === "not-ready") {
            warnings.push(`Question ${questionNumber}: answer frame was not ready for export.`);
            return { answers: ["[Answer frame was not ready]"], layoutType, warnings };
        }

        const layoutNotice = createAnswerLayoutNotice(layoutType);
        if (layoutNotice) answers.push(layoutNotice);
        console.info(`[BetterE-class] Question ${questionNumber}: exported the prompt without option extraction because answer layout '${layoutType}' is not option-based.`);
        return { answers, layoutType, warnings };
    }

    function collectQuestionData(questionNumber, questionDoc, answerDoc) {
        if (!questionDoc || !answerDoc) {
            throw new Error(`Frame documents not found for question ${questionNumber}`);
        }

        const question = getQuestionText(questionDoc);
        if (!question) {
            throw new Error(`Question text not found for question ${questionNumber}`);
        }

        const answerData = collectAnswerData(answerDoc, questionNumber);
        return {
            number: questionNumber,
            question,
            answers: answerData.answers,
            answerType: answerData.layoutType,
            warnings: answerData.warnings,
        };
    }

    function getQuestionNumber(button, fallbackNumber = null) {
        const onclick = button.getAttribute("onclick") || "";
        const onclickMatch = onclick.match(/setpage\s*\(\s*['"]?(\d+)/i);
        if (onclickMatch) return Number.parseInt(onclickMatch[1], 10);

        const candidates = [button.getAttribute("data-page"), button.getAttribute("data-page-num"), button.getAttribute("data-question-number"), button.value];
        for (const candidate of candidates) {
            const match = String(candidate || "").match(/\d+/);
            if (match) return Number.parseInt(match[0], 10);
        }
        return fallbackNumber;
    }

    function isQuestionButtonActive(button) {
        const ariaCurrent = button.getAttribute("aria-current");
        const className = typeof button.className === "string" ? button.className : "";
        return button.disabled || ariaCurrent === "page" || ariaCurrent === "true" || button.getAttribute("aria-pressed") === "true" || /(^|\s)(active|current|selected)(\s|$)/i.test(className);
    }

    function getQuestionNavigationButtons() {
        const buttonDoc = getButtonDocument();
        if (!buttonDoc) return [];

        const uniqueButtons = new Map();
        Array.from(buttonDoc.querySelectorAll('input[name="page_num"]')).forEach((button, index) => {
            const questionNumber = getQuestionNumber(button, index + 1);
            const existingButton = uniqueButtons.get(questionNumber);
            if (!existingButton || isQuestionButtonActive(button)) {
                uniqueButtons.set(questionNumber, button);
            }
        });

        return Array.from(uniqueButtons, ([questionNumber, button]) => ({ questionNumber, button })).sort((a, b) => a.questionNumber - b.questionNumber);
    }

    function getQuestionFingerprint(questionDoc, answerDoc) {
        const questionPart = questionDoc?.body?.innerHTML.trim() || "";
        const answerPart = answerDoc?.body?.innerHTML.trim() || "";
        return `${questionPart}\u0001${answerPart}`;
    }

    function formatQuestionsText(exportData) {
        return exportData.map((item) => [`Q${item.number}. ${item.question}`, ...item.answers, ""].join("\n")).join("\n");
    }

    function createRunId() {
        return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    const state = {
        runId: null,
        phase: "idle",
        mode: "file",
        questionNumbers: [],
        currentIndex: 0,
        cycle: 0,
        exportData: [],
        warnings: [],
        outputText: "",
        lastError: null,
    };
    let completionResetTimer = null;

    function isRunning() {
        return ["preparing", "waiting-initial", "navigating", "collecting", "returning", "finalizing"].includes(state.phase);
    }

    function getViewState() {
        return {
            phase: state.phase,
            mode: state.mode,
            current: Math.min(state.currentIndex + 1, state.questionNumbers.length),
            total: state.questionNumbers.length,
            lastError: state.lastError,
        };
    }

    function syncUI() {
        const buttonDoc = getButtonDocument();
        if (!buttonDoc) return;
        const copyButton = buttonDoc.querySelector(".betterEclass-quiz-copy-all-btn");
        const exportButton = buttonDoc.querySelector(".betterEclass-quiz-export-all-btn");
        if (!copyButton || !exportButton) return;

        const running = isRunning();
        copyButton.disabled = running;
        exportButton.disabled = running;
        copyButton.style.opacity = running ? "0.6" : "1";
        exportButton.style.opacity = running ? "0.6" : "1";
        copyButton.style.cursor = running ? "not-allowed" : "pointer";
        exportButton.style.cursor = running ? "not-allowed" : "pointer";

        if (state.phase === "completed-awaiting-copy") {
            copyButton.textContent = "📋 収集完了・クリックしてコピー";
            exportButton.textContent = "💾 全て出力";
        } else if (running) {
            const progress = `${Math.min(state.currentIndex + 1, state.questionNumbers.length)}/${state.questionNumbers.length}`;
            copyButton.textContent = `📋 収集中... (${progress})`;
            exportButton.textContent = `💾 収集中... (${progress})`;
        } else if (state.phase === "completed") {
            copyButton.textContent = state.mode === "copy" ? "✅ コピー完了!" : "📋 全てコピー";
            exportButton.textContent = state.mode === "file" ? "✅ エクスポート完了!" : "💾 全て出力";
        } else {
            copyButton.textContent = "📋 全てコピー";
            exportButton.textContent = "💾 全て出力";
        }
    }

    function showAlert(message) {
        try {
            getFrame("button")?.alert(message);
        } catch (_error) {
            window.alert(message);
        }
    }

    function clearCompletionReset() {
        if (!completionResetTimer) return;
        clearTimeout(completionResetTimer);
        completionResetTimer = null;
    }

    function scheduleCompletionReset(runId) {
        clearCompletionReset();
        completionResetTimer = setTimeout(() => {
            completionResetTimer = null;
            if (state.runId !== runId || state.phase !== "completed") return;
            state.phase = "idle";
            syncUI();
        }, COMPLETION_RESET_MS);
    }

    function getFrameElement(frameName) {
        try {
            return getFrame(frameName)?.frameElement || null;
        } catch (_error) {
            return null;
        }
    }

    function waitForSnapshot({ runId, cycle, expectedQuestionNumber, previousQuestionDocument = null, previousAnswerDocument = null, allowUnchangedAfterMs = null }) {
        let cancelled = false;
        let settleTimer = null;
        let timeoutTimer = null;
        let unchangedTimer = null;
        let questionObserver = null;
        let answerObserver = null;
        let buttonObserver = null;
        let observedQuestionDocument = null;
        let observedAnswerDocument = null;
        let observedButtonDocument = null;
        const cleanupCallbacks = [];

        function cleanup() {
            if (settleTimer) clearTimeout(settleTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (unchangedTimer) clearTimeout(unchangedTimer);
            questionObserver?.disconnect();
            answerObserver?.disconnect();
            buttonObserver?.disconnect();
            cleanupCallbacks.forEach((callback) => callback());
        }

        function attachLoadListener(frameName, callback) {
            const frameElement = getFrameElement(frameName);
            if (!frameElement) return;
            frameElement.addEventListener("load", callback);
            cleanupCallbacks.push(() => frameElement.removeEventListener("load", callback));
        }

        function attachObserver(doc, kind, callback) {
            if (!doc?.body) return;
            if (kind === "question") {
                if (doc === observedQuestionDocument) return;
                questionObserver?.disconnect();
                observedQuestionDocument = doc;
                questionObserver = new MutationObserver(callback);
                questionObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
                return;
            }
            if (kind === "answer") {
                if (doc === observedAnswerDocument) return;
                answerObserver?.disconnect();
                observedAnswerDocument = doc;
                answerObserver = new MutationObserver(callback);
                answerObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
                return;
            }
            if (doc === observedButtonDocument) return;
            buttonObserver?.disconnect();
            observedButtonDocument = doc;
            buttonObserver = new MutationObserver(callback);
            buttonObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
        }

        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        function check() {
            if (cancelled || state.runId !== runId || state.cycle !== cycle) return;
            if (settleTimer) {
                clearTimeout(settleTimer);
                settleTimer = null;
            }

            const questionDoc = getFrameDocument("question");
            const answerDoc = getFrameDocument("answer");
            const buttonDoc = getButtonDocument();
            attachObserver(questionDoc, "question", check);
            attachObserver(answerDoc, "answer", check);
            attachObserver(buttonDoc, "button", check);
            if (!questionDoc?.body || !answerDoc?.body) return;

            const questionChanged = !previousQuestionDocument || questionDoc !== previousQuestionDocument;
            const answerChanged = !previousAnswerDocument || answerDoc !== previousAnswerDocument;
            const bothDocumentsChanged = questionChanged && answerChanged;
            const bothDocumentsUnchanged = !questionChanged && !answerChanged;
            const unchangedFallbackReady = allowUnchangedAfterMs !== null && bothDocumentsUnchanged && unchangedTimer === null;
            const activeNavigation = getQuestionNavigationButtons().find(({ button }) => isQuestionButtonActive(button));
            const targetMatches = !activeNavigation || activeNavigation.questionNumber === expectedQuestionNumber;
            const ready = !!getQuestionText(questionDoc) && detectAnswerLayout(answerDoc) !== "not-ready";
            if ((!bothDocumentsChanged && !unchangedFallbackReady) || !targetMatches || !ready) return;

            const fingerprint = getQuestionFingerprint(questionDoc, answerDoc);
            settleTimer = setTimeout(() => {
                if (cancelled || state.runId !== runId || state.cycle !== cycle) return;
                const currentQuestionDoc = getFrameDocument("question");
                const currentAnswerDoc = getFrameDocument("answer");
                if (currentQuestionDoc !== questionDoc || currentAnswerDoc !== answerDoc || getQuestionFingerprint(currentQuestionDoc, currentAnswerDoc) !== fingerprint) {
                    check();
                    return;
                }
                cleanup();
                resolvePromise({ questionDocument: questionDoc, answerDocument: answerDoc, fingerprint });
            }, SNAPSHOT_SETTLE_MS);
        }

        const onFrameLoad = () => check();
        attachLoadListener("question", onFrameLoad);
        attachLoadListener("answer", onFrameLoad);
        attachLoadListener("button", onFrameLoad);
        timeoutTimer = setTimeout(() => {
            cleanup();
            rejectPromise(new Error(`Timed out waiting for question ${expectedQuestionNumber} in cycle ${cycle}`));
        }, FRAME_WAIT_TIMEOUT_MS);
        if (allowUnchangedAfterMs !== null) {
            unchangedTimer = setTimeout(() => {
                unchangedTimer = null;
                check();
            }, allowUnchangedAfterMs);
        }
        check();

        return {
            promise,
            cancel() {
                cancelled = true;
                cleanup();
            },
        };
    }

    async function getInitialSnapshot(runId, questionNumber) {
        state.phase = "waiting-initial";
        state.cycle++;
        syncUI();
        return waitForSnapshot({ runId, cycle: state.cycle, expectedQuestionNumber: questionNumber }).promise;
    }

    async function navigateToQuestion(runId, questionNumber, previousSnapshot, options = {}) {
        const navigation = getQuestionNavigationButtons().find((item) => item.questionNumber === questionNumber);
        if (!navigation) throw new Error(`Navigation button not found for question ${questionNumber}`);

        state.phase = "navigating";
        state.cycle++;
        syncUI();
        const wait = waitForSnapshot({
            runId,
            cycle: state.cycle,
            expectedQuestionNumber: questionNumber,
            previousQuestionDocument: previousSnapshot.questionDocument,
            previousAnswerDocument: previousSnapshot.answerDocument,
            allowUnchangedAfterMs: options.allowUnchangedAfterMs ?? null,
        });
        try {
            navigation.button.click();
        } catch (error) {
            wait.cancel();
            throw error;
        }
        return wait.promise;
    }

    function getQuizTitle() {
        for (const frameName of ["button", "question", "answer"]) {
            try {
                const contentsName = new URLSearchParams(getFrame(frameName)?.location.search || "").get("contents_name");
                if (contentsName) return safeDecodeURIComponent(contentsName);
            } catch (_error) {
                // Try the next same-origin frame.
            }
        }
        return "quiz_export";
    }

    async function copyText(content) {
        const buttonFrame = getFrame("button");
        const buttonDoc = getButtonDocument();
        if (!buttonFrame || !buttonDoc) throw new Error("Button frame is unavailable");

        try {
            await buttonFrame.navigator.clipboard.writeText(content);
            return;
        } catch (_error) {
            const textarea = buttonDoc.createElement("textarea");
            textarea.value = content;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            buttonDoc.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const successful = buttonDoc.execCommand("copy");
            textarea.remove();
            if (!successful) throw new Error("Copy command failed");
        }
    }

    function exportToFile(content) {
        const buttonDoc = getButtonDocument();
        if (!buttonDoc) throw new Error("Button frame is unavailable");
        const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
        const anchor = buttonDoc.createElement("a");
        anchor.href = url;
        anchor.download = `${getQuizTitle()}.txt`;
        buttonDoc.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function getWarningsMessage() {
        return state.warnings.length > 0 ? ["Export completed with notes:", ...state.warnings.map((warning) => `- ${warning}`)].join("\n") : "";
    }

    async function finalize(runId) {
        if (state.runId !== runId) return;
        state.phase = "finalizing";
        state.outputText = formatQuestionsText(state.exportData);
        syncUI();

        if (state.mode === "copy") {
            try {
                await copyText(state.outputText);
                state.phase = "completed";
            } catch (error) {
                console.info("[BetterE-class] Quiz collection completed; waiting for a focused copy action:", error.message);
                state.phase = "completed-awaiting-copy";
            }
        } else {
            exportToFile(state.outputText);
            state.phase = "completed";
        }

        syncUI();
        const warningsMessage = getWarningsMessage();
        if (warningsMessage) showAlert(warningsMessage);
        if (state.phase === "completed") scheduleCompletionReset(runId);
    }

    async function restoreFirstQuestion(runId, snapshot) {
        const firstQuestionNumber = state.questionNumbers[0];
        const currentQuestionNumber = state.questionNumbers[state.questionNumbers.length - 1];
        if (firstQuestionNumber === undefined || firstQuestionNumber === currentQuestionNumber) return;

        state.phase = "returning";
        syncUI();
        try {
            await navigateToQuestion(runId, firstQuestionNumber, snapshot);
        } catch (error) {
            console.warn("[BetterE-class] Export completed, but the first question could not be restored:", error);
        }
    }

    async function runExport(runId) {
        let snapshot;
        const firstQuestionNumber = state.questionNumbers[0];
        const activeNavigation = getQuestionNavigationButtons().find(({ button }) => isQuestionButtonActive(button));

        if (!activeNavigation || activeNavigation.questionNumber !== firstQuestionNumber) {
            const baseline = {
                questionDocument: getFrameDocument("question"),
                answerDocument: getFrameDocument("answer"),
            };
            snapshot = await navigateToQuestion(runId, firstQuestionNumber, baseline, {
                allowUnchangedAfterMs: activeNavigation ? null : FIRST_QUESTION_NOOP_GRACE_MS,
            });
        } else {
            snapshot = await getInitialSnapshot(runId, firstQuestionNumber);
        }

        for (let index = 0; index < state.questionNumbers.length; index++) {
            if (state.runId !== runId) return;
            const questionNumber = state.questionNumbers[index];
            state.currentIndex = index;
            state.phase = "collecting";
            syncUI();

            const questionData = collectQuestionData(questionNumber, snapshot.questionDocument, snapshot.answerDocument);
            if (state.exportData.some((item) => item.number === questionNumber)) {
                throw new Error(`Question ${questionNumber} was collected more than once`);
            }
            state.exportData.push(questionData);
            state.warnings.push(...questionData.warnings);

            const nextQuestionNumber = state.questionNumbers[index + 1];
            if (nextQuestionNumber !== undefined) {
                snapshot = await navigateToQuestion(runId, nextQuestionNumber, snapshot);
            }
        }

        state.currentIndex = state.questionNumbers.length;
        await restoreFirstQuestion(runId, snapshot);
        await finalize(runId);
    }

    async function start(mode) {
        if (isRunning()) {
            showAlert("エクスポート中です。しばらくお待ちください。");
            return;
        }
        if (state.phase === "completed-awaiting-copy" && mode === "copy") {
            await retryCopy();
            return;
        }

        const navigationButtons = getQuestionNavigationButtons();
        if (navigationButtons.length === 0) {
            showAlert("問題が見つかりませんでした。");
            return;
        }

        const activeNavigation = navigationButtons.find(({ button }) => isQuestionButtonActive(button));
        const firstQuestionNumber = navigationButtons[0].questionNumber;
        const modeText = mode === "copy" ? "コピー" : "エクスポート";
        const startNotice = activeNavigation ? "最初の問題から順番に収集します。" : `現在位置を判定できないため、${firstQuestionNumber}番の問題を表示してから実行してください。`;
        if (!getFrame("button")?.confirm(`${navigationButtons.length}問の問題を${modeText}します。\n\n${startNotice}`)) return;

        state.runId = createRunId();
        state.phase = "preparing";
        state.mode = mode;
        state.questionNumbers = navigationButtons.map(({ questionNumber }) => questionNumber);
        state.currentIndex = 0;
        state.cycle = 0;
        state.exportData = [];
        state.warnings = [];
        state.outputText = "";
        state.lastError = null;
        clearCompletionReset();
        syncUI();

        const runId = state.runId;
        try {
            await runExport(runId);
        } catch (error) {
            if (state.runId !== runId) return;
            console.error("[BetterE-class] Quiz export failed:", error);
            state.phase = "failed";
            state.lastError = error.message;
            syncUI();
            showAlert("問題の収集に失敗しました。もう一度お試しください。");
        }
    }

    async function retryCopy() {
        if (state.phase !== "completed-awaiting-copy" || !state.outputText) return;
        try {
            await copyText(state.outputText);
            state.phase = "completed";
            state.lastError = null;
            scheduleCompletionReset(state.runId);
        } catch (error) {
            state.lastError = error.message;
            showAlert("クリップボードへのコピーに失敗しました。タブを表示した状態でもう一度お試しください。");
        }
        syncUI();
    }

    window[CONTROLLER_KEY] = {
        start,
        retryCopy,
        registerButtonFrame,
        syncUI,
        getViewState,
        getState: () => state,
    };

    window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.source === "better-eclass" && event.data.type === "quiz-export-ui-ready") {
            syncUI();
        }
    });

    try {
        getFrame("button")?.postMessage({ source: "better-eclass", type: "quiz-export-controller-ready" }, window.location.origin);
    } catch (_error) {
        // The button frame may not be available yet; its content script also probes the controller.
    }
})();
