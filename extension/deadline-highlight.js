// Style e-class's deadline notices ("締切が近い課題があります。") as a compact chip
(function highlightDeadlineWarnings() {
    // Settings
    let settings = {
        enableDeadlineHighlight: true,
    };

    // Load settings
    async function loadSettings() {
        try {
            const result = await window.BetterEclassUtils.settings.getSettings(["enableDeadlineHighlight"]);
            settings = result;
            return result;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return settings;
        }
    }

    const CHIP_CLASSES = ["bec-scope", "bec-deadline-chip"];

    // Mark e-class's deadline notices so deadline-highlight.css styles them; unmark when disabled
    function applyHighlight() {
        const selector = settings.enableDeadlineHighlight ? ".course-contents-info:not(.bec-deadline-chip)" : ".course-contents-info.bec-deadline-chip";
        document.querySelectorAll(selector).forEach((warning) => {
            CHIP_CLASSES.forEach((className) => warning.classList.toggle(className, settings.enableDeadlineHighlight));
        });
    }

    // Initialize
    async function init() {
        await loadSettings();
        applyHighlight();
        if (!settings.enableDeadlineHighlight) return;

        // Watch for dynamically added deadline warnings
        const observer = new MutationObserver(applyHighlight);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    // Run when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
