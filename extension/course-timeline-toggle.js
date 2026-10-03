// course-timeline-toggle.js
// Turns the course page's "タイムライン" heading into a disclosure button so the timeline can be
// hidden, leaving room for the table of contents below it. The open/closed state is remembered.
// Styles live in course-sidebars.css.

(function () {
    "use strict";

    const STATE_KEY = "courseTimelineCollapsed";
    const BODY_ID = "betterEclass-timeline-body";
    const uiState = window.BetterEclassUtils.uiState;
    const icons = window.BetterEclassUtils.icons;

    function findTimeline() {
        const column = document.querySelector(".col-sm-4.col-md-3");
        if (!column) return null;
        const heading = Array.from(column.querySelectorAll(":scope > h3.page-header")).find(
            (element) => element.textContent.trim() === "タイムライン",
        );
        const body = heading && heading.nextElementSibling;
        return heading && body ? { heading, body } : null;
    }

    function setCollapsed(timeline, button, collapsed) {
        timeline.body.hidden = collapsed;
        timeline.heading.classList.toggle("is-collapsed", collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
    }

    async function init() {
        const timeline = findTimeline();
        if (!timeline || timeline.heading.querySelector(".bec-heading-toggle")) return;

        const label = timeline.heading.textContent.trim();
        timeline.body.id = timeline.body.id || BODY_ID;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "bec-heading-toggle";
        button.setAttribute("aria-controls", timeline.body.id);
        if (icons) button.appendChild(icons.create("chevronRight", { size: 14, className: "bec-heading-chevron" }));
        const text = document.createElement("span");
        text.textContent = label;
        button.appendChild(text);

        timeline.heading.classList.add("bec-scope", "bec-collapsible-heading");
        timeline.heading.replaceChildren(button);

        let collapsed = false;
        try {
            collapsed = Boolean(await uiState.getState(STATE_KEY, false));
        } catch (error) {
            console.warn("[BetterE-class] Failed to read timeline state:", error);
        }
        setCollapsed(timeline, button, collapsed);

        button.addEventListener("click", () => {
            const next = button.getAttribute("aria-expanded") === "true";
            setCollapsed(timeline, button, next);
            uiState.setState(STATE_KEY, next).catch((error) => {
                console.warn("[BetterE-class] Failed to save timeline state:", error);
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
