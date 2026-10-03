// controls.js
// Shared buttons for BetterE-class UI injected into e-class pages. Styles live in bec-controls.css,
// and the buttons must sit inside a .bec-scope element so the bec-tokens.css tokens apply.

(function () {
    "use strict";

    const icons = () => window.BetterEclassUtils && window.BetterEclassUtils.icons;
    const outcomeTimers = new WeakMap();

    /**
     * Create a button.
     * @param {{icon: string, label: string, title?: string, variant?: "default"|"primary"|"icon", onClick: (event: MouseEvent, button: HTMLButtonElement) => void}} options
     * @returns {HTMLButtonElement}
     */
    function createButton({ icon, label, title, variant = "default", onClick }) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bec-btn${variant === "default" ? "" : ` bec-btn--${variant}`}`;
        button.dataset.icon = icon;
        if (title) button.title = title;
        if (icons()) button.appendChild(icons().create(icon));

        if (variant === "icon") {
            button.setAttribute("aria-label", label);
            if (!title) button.title = label;
        } else {
            const text = document.createElement("span");
            text.className = "bec-btn__label";
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
        if (!icons()) return;
        const current = button.querySelector("svg");
        const next = icons().create(name);
        if (current) current.replaceWith(next);
        else button.prepend(next);
    }

    function setButtonLabel(button, label) {
        const text = button.querySelector(".bec-btn__label");
        if (text) text.textContent = label;
        else button.setAttribute("aria-label", label);
    }

    /**
     * Reflect a button's state. "disabled" needs a reason, shown as the tooltip.
     * Outcome states ("error", "success") return to idle after three seconds.
     * @param {HTMLButtonElement} button
     * @param {"idle"|"busy"|"disabled"|"error"|"success"} state
     * @param {{reason?: string}} [options]
     */
    function setButtonState(button, state, { reason } = {}) {
        if (!button) return;
        clearTimeout(outcomeTimers.get(button));
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
            outcomeTimers.set(
                button,
                setTimeout(() => {
                    if (button.dataset.state === state) setButtonState(button, "idle");
                }, 3000),
            );
        }
    }

    /**
     * Fill a .bec-message element; an empty text hides it.
     * @param {HTMLElement} element
     * @param {"info"|"success"|"error"} tone
     * @param {string} text
     */
    function setMessage(element, tone, text) {
        if (!element) return;
        if (!text) {
            element.hidden = true;
            element.replaceChildren();
            return;
        }
        element.dataset.tone = tone;
        const content = [];
        if (icons() && tone !== "info") content.push(icons().create(tone === "error" ? "alert" : "check", { size: 14 }));
        const span = document.createElement("span");
        span.textContent = text;
        content.push(span);
        element.replaceChildren(...content);
        element.hidden = false;
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.controls = { createButton, setButtonLabel, setButtonState, setMessage, swapIcon };
})();
