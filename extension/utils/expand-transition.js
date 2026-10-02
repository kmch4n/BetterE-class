// expand-transition.js
// Animates max-height when expanding or collapsing content without capping the expanded height.
// The element's stylesheet must set `overflow: hidden` and a `max-height` transition.

(function () {
    "use strict";

    // Slightly longer than the 0.3s transitions used by the callers, in case transitionend never fires
    const FALLBACK_MS = 400;
    const pendingCleanups = new WeakMap();

    function cancelPending(element) {
        const cleanup = pendingCleanups.get(element);
        if (cleanup) cleanup();
    }

    /**
     * Animate to the content height, then release the limit so later growth is not clipped.
     * @param {HTMLElement} element
     */
    function expand(element) {
        if (!element) return;
        cancelPending(element);

        const height = element.scrollHeight;
        // Content inside a display:none ancestor has no height to animate to
        if (height === 0) {
            element.style.maxHeight = "none";
            return;
        }

        let timer = null;
        const onTransitionEnd = (event) => {
            if (event.target === element && event.propertyName === "max-height") finish();
        };
        function cleanup() {
            clearTimeout(timer);
            element.removeEventListener("transitionend", onTransitionEnd);
            pendingCleanups.delete(element);
        }
        function finish() {
            cleanup();
            element.style.maxHeight = "none";
        }

        element.style.maxHeight = `${height}px`;
        element.addEventListener("transitionend", onTransitionEnd);
        timer = setTimeout(finish, FALLBACK_MS);
        pendingCleanups.set(element, cleanup);
    }

    /**
     * Animate from the current height to zero.
     * @param {HTMLElement} element
     */
    function collapse(element) {
        if (!element) return;
        cancelPending(element);

        element.style.maxHeight = `${element.scrollHeight}px`;
        // Flush the start height so the change to 0 is animated
        void element.offsetHeight;
        element.style.maxHeight = "0px";
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.expandTransition = { expand, collapse };
})();
