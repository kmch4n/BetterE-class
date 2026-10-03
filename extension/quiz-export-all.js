// quiz-export-all.js
// Adds the copy all / export all controls to the quiz button frame (left column).
// quiz-export-controller.js runs the collection and reports back through window[UI_KEY].

(function () {
    "use strict";

    const CONTROLLER_KEY = "__betterEclassQuizExportController";
    const UI_KEY = "__betterEclassQuizExportUI";
    const CONTAINER_CLASS = "betterEclass-quiz-export-controls";
    const ARM_TIMEOUT_MS = 6000;

    if (window.name !== "button" && !window.location.href.includes("dqstn_button.php")) {
        return;
    }

    const controls = window.BetterEclassUtils && window.BetterEclassUtils.controls;
    if (!controls) return;

    const LABELS = {
        copy: { idle: "全てコピー", armed: "もう一度押して開始", awaiting: "コピーする" },
        file: { idle: "全て出力", armed: "もう一度押して開始" },
    };

    const ui = {
        copyButton: null,
        exportButton: null,
        progress: null,
        message: null,
        armedMode: null,
        armTimer: null,
        lastView: null,
    };

    function getController() {
        let current = window;
        for (let depth = 0; depth < 4; depth++) {
            try {
                if (current[CONTROLLER_KEY]) return current[CONTROLLER_KEY];
                if (current === current.parent) break;
                current = current.parent;
            } catch (_error) {
                break;
            }
        }
        return null;
    }

    const RUNNING_PHASES = ["preparing", "waiting-initial", "navigating", "collecting", "returning", "finalizing"];

    function progressText(view) {
        if (view.phase === "preparing" || view.phase === "waiting-initial") return "準備しています…";
        if (view.phase === "returning") return "最初の問題に戻しています…";
        if (view.phase === "finalizing") return "まとめています…";
        return `問題を集めています ${view.current}/${view.total}`;
    }

    function renderProgress(view) {
        const running = RUNNING_PHASES.includes(view.phase);
        ui.progress.hidden = !running;
        if (!running) return;
        const ratio = view.total > 0 ? view.collected / view.total : 0;
        const indeterminate = view.phase === "preparing" || view.phase === "waiting-initial";
        ui.progress.dataset.indeterminate = String(indeterminate);
        const track = ui.progress.querySelector(".bec-progress__track");
        track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
        ui.progress.querySelector(".bec-progress__bar").style.transform = indeterminate ? "" : `scaleX(${ratio})`;
        ui.progress.querySelector(".bec-progress__text").textContent = progressText(view);
    }

    function disarm() {
        clearTimeout(ui.armTimer);
        ui.armTimer = null;
        ui.armedMode = null;
        controls.setButtonLabel(ui.copyButton, LABELS.copy.idle);
        controls.setButtonLabel(ui.exportButton, LABELS.file.idle);
    }

    /**
     * Mirror the controller's state on the buttons.
     * @param {{phase: string, mode: string, current: number, total: number, collected: number} | null} view
     */
    function render(view) {
        if (!ui.copyButton) return;
        const previous = ui.lastView;
        ui.lastView = view;

        if (!view) {
            controls.setButtonState(ui.copyButton, "disabled", { reason: "準備しています" });
            controls.setButtonState(ui.exportButton, "disabled", { reason: "準備しています" });
            return;
        }

        const running = RUNNING_PHASES.includes(view.phase);
        const buttons = { copy: ui.copyButton, file: ui.exportButton };
        if (running) {
            disarm();
            Object.entries(buttons).forEach(([mode, button]) => {
                controls.setButtonState(button, mode === view.mode ? "busy" : "disabled", { reason: "問題を集めています" });
            });
        } else if (view.phase === "completed" && previous && previous.phase !== "completed") {
            controls.setButtonState(buttons[view.mode], "success");
            controls.setButtonState(buttons[view.mode === "copy" ? "file" : "copy"], "idle");
        } else if (view.phase === "failed" && previous && previous.phase !== "failed") {
            controls.setButtonState(buttons[view.mode], "error");
            controls.setButtonState(buttons[view.mode === "copy" ? "file" : "copy"], "idle");
        } else if (!["completed", "failed"].includes(view.phase)) {
            controls.setButtonState(ui.copyButton, "idle");
            controls.setButtonState(ui.exportButton, "idle");
        }
        ui.copyButton.title = "すべての問題を集めてクリップボードにコピーします";
        ui.exportButton.title = "すべての問題を集めてテキストファイルに保存します";

        if (!ui.armedMode) {
            controls.setButtonLabel(ui.copyButton, view.phase === "completed-awaiting-copy" ? LABELS.copy.awaiting : LABELS.copy.idle);
        }
        renderProgress(view);
    }

    function showMessage(tone, text) {
        controls.setMessage(ui.message, tone, text);
    }

    // The first click explains what will happen; a second click within a few seconds starts the run.
    async function handleClick(mode) {
        const controller = getController();
        if (!controller) {
            showMessage("info", "準備しています。少し待ってからもう一度押してください");
            return;
        }
        controller.registerButtonFrame?.(window);

        if (mode === "copy" && controller.getViewState().phase === "completed-awaiting-copy") {
            await controller.retryCopy();
            return;
        }

        if (ui.armedMode !== mode) {
            const plan = controller.describeStart();
            if (plan.error) {
                showMessage("error", plan.error);
                return;
            }
            disarm();
            ui.armedMode = mode;
            controls.setButtonLabel(mode === "copy" ? ui.copyButton : ui.exportButton, LABELS[mode].armed);
            showMessage("info", plan.notice);
            ui.armTimer = setTimeout(() => {
                disarm();
                showMessage("info", "");
            }, ARM_TIMEOUT_MS);
            return;
        }

        disarm();
        showMessage("info", "");
        await controller.start(mode);
    }

    function createProgress() {
        const progress = document.createElement("div");
        progress.className = "bec-progress";
        progress.hidden = true;
        const track = document.createElement("div");
        track.className = "bec-progress__track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        const bar = document.createElement("div");
        bar.className = "bec-progress__bar";
        track.appendChild(bar);
        const text = document.createElement("p");
        text.className = "bec-progress__text";
        progress.append(track, text);
        return progress;
    }

    function syncController() {
        const controller = getController();
        if (!controller) {
            render(null);
            return;
        }
        controller.registerButtonFrame?.(window);
        controller.syncUI();
    }

    function addExportButtons() {
        const navigationButton = document.querySelector('input[name="page_num"]');
        if (!navigationButton) return false;
        if (document.querySelector(`.${CONTAINER_CLASS}`)) {
            syncController();
            return true;
        }

        const container = document.createElement("section");
        container.className = `bec-scope bec-quiz-export ${CONTAINER_CLASS}`;
        container.setAttribute("aria-label", "BetterE-class: 問題のコピーと出力");

        const actions = document.createElement("div");
        actions.className = "bec-quiz-export__actions";
        ui.copyButton = controls.createButton({ icon: "clipboard", label: LABELS.copy.idle, onClick: () => handleClick("copy") });
        ui.copyButton.classList.add("betterEclass-quiz-copy-all-btn");
        ui.exportButton = controls.createButton({ icon: "download", label: LABELS.file.idle, onClick: () => handleClick("file") });
        ui.exportButton.classList.add("betterEclass-quiz-export-all-btn");
        actions.append(ui.copyButton, ui.exportButton);

        ui.progress = createProgress();
        ui.message = document.createElement("p");
        ui.message.className = "bec-message";
        ui.message.setAttribute("role", "status");
        ui.message.hidden = true;

        container.append(actions, ui.progress, ui.message);
        const anchor = navigationButton.closest("table") || navigationButton.parentElement;
        if (anchor?.parentNode) {
            anchor.parentNode.insertBefore(container, anchor);
        } else {
            document.body.insertBefore(container, document.body.firstChild);
        }

        window[UI_KEY] = { render, showMessage };
        syncController();
        try {
            window.parent.parent.postMessage({ source: "better-eclass", type: "quiz-export-ui-ready" }, window.location.origin);
        } catch (_error) {
            // The root controller may still be loading; it also sends a ready message.
        }
        return true;
    }

    function init() {
        if (addExportButtons()) return;
        const observer = new MutationObserver((_mutations, activeObserver) => {
            if (addExportButtons()) activeObserver.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.source === "better-eclass" && event.data.type === "quiz-export-controller-ready") {
            syncController();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
