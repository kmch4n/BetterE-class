// Prevent popup windows for explicit message-tool navigation.
(function preventMessagePopup() {
    // Settings
    let settings = {
        preventMessagePopup: true,
    };

    // Load settings
    async function loadSettings() {
        try {
            const result = await window.BetterEclassUtils.settings.getSettings(["preventMessagePopup"]);
            settings = result;
            return result;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return settings;
        }
    }

    // Intercept clicks that explicitly invoke message popup helpers.
    function interceptOnclickHandlers() {
        document.addEventListener(
            "click",
            function (e) {
                if (!settings.preventMessagePopup) return;

                // First, check for <a> tags with target attribute (msg_viewer.php links)
                const link = e.target.closest("a");
                if (link && link.href) {
                    const href = link.href;
                    const linkTarget = link.getAttribute("target");

                    // Check if this is a message tool navigation (msg_editor.php <-> msg_viewer.php)
                    const currentIsMessagePage = window.location.href.includes("msg_editor.php") || window.location.href.includes("msg_viewer.php");
                    const targetIsMessagePage = href.includes("msg_editor.php") || href.includes("msg_viewer.php");

                    if (currentIsMessagePage && targetIsMessagePage) {
                        // Intercept msg_viewer.php links and open in same tab
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = href;
                        return false;
                    }
                }

                // Then, check for onclick handlers
                const target = e.target.closest("[onclick]");
                if (!target) return;

                const onclickAttr = target.getAttribute("onclick");
                if (!onclickAttr) return;

                // Check if it's calling openMessageWindow or openMessage
                const messageWindowMatch = onclickAttr.match(/openMessageWindow\s*\(\s*['"]([^'"]+)['"]/);
                const messageMatch = onclickAttr.match(/openMessage\s*\(\s*['"]([^'"]+)['"]/);

                if (messageWindowMatch || messageMatch) {
                    e.preventDefault();
                    e.stopPropagation();

                    const url = messageWindowMatch ? messageWindowMatch[1] : messageMatch[1];

                    // Check if this is a message tool navigation (msg_editor.php <-> msg_viewer.php)
                    const currentIsMessagePage = window.location.href.includes("msg_editor.php") || window.location.href.includes("msg_viewer.php");
                    const targetIsMessagePage = url.includes("msg_editor.php") || url.includes("msg_viewer.php");

                    if (currentIsMessagePage && targetIsMessagePage) {
                        // Open in the current tab to avoid multiple tabs
                        window.location.href = url;
                    } else {
                        // Open in a new tab
                        window.open(url, "_blank");
                    }
                    return false;
                }
            },
            true,
        );
    }

    // Initialize
    loadSettings().then(() => {
        interceptOnclickHandlers();
    });
})();
