// quiz-export-all.js
// Adds Export All controls to the quiz button frame.

(function () {
    "use strict";

    const CONTROLLER_KEY = "__betterEclassQuizExportController";
    const CONTAINER_CLASS = "betterEclass-quiz-export-controls";

    if (window.name !== "button" && !window.location.href.includes("dqstn_button.php")) {
        return;
    }

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

    function createButton(className, text, background, border) {
        const button = document.createElement("button");
        button.className = className;
        button.textContent = text;
        button.type = "button";
        button.style.cssText = `
            padding: 10px 20px;
            background: ${background};
            color: white;
            border: 2px solid ${border};
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        `;
        return button;
    }

    function syncController() {
        const controller = getController();
        const copyButton = document.querySelector(".betterEclass-quiz-copy-all-btn");
        const exportButton = document.querySelector(".betterEclass-quiz-export-all-btn");
        if (!copyButton || !exportButton) return;

        if (!controller) {
            copyButton.disabled = true;
            exportButton.disabled = true;
            copyButton.textContent = "📋 準備中...";
            exportButton.textContent = "💾 準備中...";
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

        const container = document.createElement("div");
        container.className = CONTAINER_CLASS;
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

        const copyButton = createButton("betterEclass-quiz-copy-all-btn", "📋 全てコピー", "#4a90e2", "#357abd");
        const exportButton = createButton("betterEclass-quiz-export-all-btn", "💾 全て出力", "#52c41a", "#3da016");
        copyButton.addEventListener("click", async () => {
            const controller = getController();
            if (!controller) {
                alert("エクスポート機能を準備しています。少し待ってからもう一度お試しください。");
                return;
            }
            controller.registerButtonFrame?.(window);
            const viewState = controller.getViewState();
            if (viewState.phase === "completed-awaiting-copy") {
                await controller.retryCopy();
            } else {
                await controller.start("copy");
            }
        });
        exportButton.addEventListener("click", async () => {
            const controller = getController();
            if (!controller) {
                alert("エクスポート機能を準備しています。少し待ってからもう一度お試しください。");
                return;
            }
            controller.registerButtonFrame?.(window);
            await controller.start("file");
        });

        container.appendChild(copyButton);
        container.appendChild(exportButton);
        const anchor = navigationButton.closest("table") || navigationButton.parentElement;
        if (anchor?.parentNode) {
            anchor.parentNode.insertBefore(container, anchor);
        } else {
            document.body.insertBefore(container, document.body.firstChild);
        }
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
