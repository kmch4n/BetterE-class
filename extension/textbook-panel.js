// textbook-panel.js
// Action panel shown above the table of contents in txtbk_show_chapter.php.
// Groups the current section's file actions, the merge-all-videos action, and progress/messages
// in one place so the TOC rows themselves stay untouched. Styles live in textbook-panel.css.

(function () {
    "use strict";

    const PANEL_ID = "betterEclass-textbook-panel";
    const icons = window.BetterEclassUtils && window.BetterEclassUtils.icons;
    let messageTimer = null;

    function createElement(tag, className, attributes = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    }

    /**
     * Create a panel-styled button.
     * @param {{icon: string, label: string, title?: string, variant?: "default"|"primary"|"icon", onClick: (event: MouseEvent, button: HTMLButtonElement) => void}} options
     * @returns {HTMLButtonElement}
     */
    function createButton({ icon, label, title, variant = "default", onClick }) {
        const button = createElement("button", `bec-btn${variant === "default" ? "" : ` bec-btn--${variant}`}`, { type: "button" });
        button.dataset.icon = icon;
        if (title) button.title = title;
        if (icons) button.appendChild(icons.create(icon));

        if (variant === "icon") {
            button.setAttribute("aria-label", label);
            if (!title) button.title = label;
        } else {
            const text = createElement("span", "bec-btn__label");
            text.textContent = label;
            button.appendChild(text);
        }

        button.addEventListener("click", (event) => {
            // aria-disabled keeps the button focusable so its tooltip explains why it is unavailable.
            if (button.getAttribute("aria-disabled") === "true" || button.getAttribute("aria-busy") === "true") {
                event.preventDefault();
                return;
            }
            onClick(event, button);
        });
        return button;
    }

    function swapIcon(button, name) {
        if (!icons) return;
        const current = button.querySelector("svg");
        const next = icons.create(name);
        if (current) current.replaceWith(next);
        else button.prepend(next);
    }

    /**
     * Reflect a button's state. "disabled" needs a reason, shown as the tooltip.
     * @param {HTMLButtonElement} button
     * @param {"idle"|"busy"|"disabled"|"error"|"success"} state
     * @param {{reason?: string}} [options]
     */
    function setButtonState(button, state, { reason } = {}) {
        if (!button) return;
        button.removeAttribute("aria-busy");
        button.removeAttribute("aria-disabled");
        delete button.dataset.state;
        swapIcon(button, button.dataset.icon);

        if (state === "busy") {
            button.setAttribute("aria-busy", "true");
            swapIcon(button, "spinner");
        } else if (state === "disabled") {
            button.setAttribute("aria-disabled", "true");
            if (reason) button.title = reason;
        } else if (state === "error" || state === "success") {
            button.dataset.state = state;
            swapIcon(button, state === "error" ? "alert" : "check");
            // Return to idle so the state reads as an event, not a mode.
            setTimeout(() => {
                if (button.dataset.state === state) setButtonState(button, "idle");
            }, 3000);
        }
    }

    function getPanel() {
        return document.getElementById(PANEL_ID);
    }

    function ensurePanel() {
        const existing = getPanel();
        if (existing) return existing;

        const toc = document.querySelector("#TOCLayout");
        if (!toc || !toc.parentElement) return null;

        const panel = createElement("section", "bec-scope bec-panel", { id: PANEL_ID, "aria-label": "BetterE-class: 教材の操作" });
        panel.hidden = true;

        const current = createElement("div", "bec-panel__section", { "data-role": "current" });
        current.hidden = true;
        const title = createElement("p", "bec-panel__title");
        const actions = createElement("div", "bec-panel__actions", { role: "group", "aria-label": "この節の資料" });
        current.append(title, actions);

        const merge = createElement("div", "bec-panel__section", { "data-role": "merge" });
        merge.hidden = true;

        const status = createElement("div", "bec-panel__status");
        const progress = createElement("div", "bec-progress", { "data-role": "progress" });
        progress.hidden = true;
        const track = createElement("div", "bec-progress__track", { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" });
        track.appendChild(createElement("div", "bec-progress__bar"));
        const progressText = createElement("p", "bec-progress__text");
        progress.append(track, progressText);
        const message = createElement("p", "bec-message", { role: "status", "data-role": "message" });
        message.hidden = true;
        status.append(progress, message);

        panel.append(current, merge, status);
        toc.parentElement.insertBefore(panel, toc);
        return panel;
    }

    function updateVisibility() {
        const panel = getPanel();
        if (!panel) return;
        const visible = Array.from(panel.querySelectorAll("[data-role]")).some(
            (element) => !element.hidden && ["current", "merge", "progress", "message"].includes(element.dataset.role),
        );
        panel.hidden = !visible;
    }

    /**
     * Show the actions for the current section, or hide that part when there are none.
     * @param {string|null} title
     * @param {HTMLButtonElement[]} buttons
     */
    function setCurrentActions(title, buttons) {
        const panel = ensurePanel();
        if (!panel) return;
        const current = panel.querySelector('[data-role="current"]');
        const titleElement = current.querySelector(".bec-panel__title");
        const actions = current.querySelector(".bec-panel__actions");

        actions.replaceChildren(...buttons);
        titleElement.textContent = title || "";
        titleElement.title = title || "";
        current.hidden = buttons.length === 0;
        updateVisibility();
    }

    /**
     * @param {HTMLButtonElement|null} button
     */
    function setMergeAction(button) {
        const panel = ensurePanel();
        if (!panel) return;
        const merge = panel.querySelector('[data-role="merge"]');
        merge.replaceChildren(...(button ? [button] : []));
        merge.hidden = !button;
        updateVisibility();
    }

    /**
     * @param {{ratio?: number, text: string}} progress - Omit ratio for an indeterminate bar
     */
    function showProgress({ ratio, text }) {
        const panel = ensurePanel();
        if (!panel) return;
        const progress = panel.querySelector('[data-role="progress"]');
        const track = progress.querySelector(".bec-progress__track");
        const bar = progress.querySelector(".bec-progress__bar");
        const indeterminate = typeof ratio !== "number";

        progress.dataset.indeterminate = String(indeterminate);
        if (indeterminate) {
            track.removeAttribute("aria-valuenow");
            bar.style.removeProperty("transform");
        } else {
            const clamped = Math.max(0, Math.min(1, ratio));
            track.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
            bar.style.transform = `scaleX(${clamped})`;
        }
        track.setAttribute("aria-valuetext", text);
        progress.querySelector(".bec-progress__text").textContent = text;
        progress.hidden = false;
        updateVisibility();
    }

    function hideProgress() {
        const panel = getPanel();
        if (!panel) return;
        panel.querySelector('[data-role="progress"]').hidden = true;
        updateVisibility();
    }

    /**
     * @param {"info"|"success"|"error"} tone
     * @param {string} text
     * @param {{autoHideMs?: number}} [options] - Errors stay until replaced; others hide after 5 s by default
     */
    function showMessage(tone, text, { autoHideMs = tone === "error" ? 0 : 5000 } = {}) {
        const panel = ensurePanel();
        if (!panel) return;
        const message = panel.querySelector('[data-role="message"]');
        if (messageTimer) clearTimeout(messageTimer);

        message.dataset.tone = tone;
        message.setAttribute("role", tone === "error" ? "alert" : "status");
        const content = [];
        if (icons && tone !== "info") content.push(icons.create(tone === "error" ? "alert" : "check", { size: 14 }));
        const span = document.createElement("span");
        span.textContent = text;
        content.push(span);
        message.replaceChildren(...content);
        message.hidden = false;
        updateVisibility();

        if (autoHideMs > 0) {
            messageTimer = setTimeout(clearMessage, autoHideMs);
        }
    }

    function clearMessage() {
        const panel = getPanel();
        if (!panel) return;
        const message = panel.querySelector('[data-role="message"]');
        message.hidden = true;
        message.replaceChildren();
        updateVisibility();
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.textbookPanel = {
        createButton,
        setButtonState,
        setCurrentActions,
        setMergeAction,
        showProgress,
        hideProgress,
        showMessage,
        clearMessage,
    };
})();
