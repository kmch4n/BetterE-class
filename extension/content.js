(function enableOpenInNewTab() {
    // Settings
    let settings = {
        enableNewTab: true,
    };

    // Load settings
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get({
                enableNewTab: true,
            });
            settings = result;
            return result;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return settings;
        }
    }

    function isFileLikeUrl(url) {
        try {
            const u = new URL(url, location.href);
            // Explicitly exclude: logout and normal navigation
            if (/\/logout\/?$/i.test(u.pathname)) return false;

            // Path contains download (e.g., /my-reports/download)
            if (/\/download\b/i.test(u.pathname)) return true;

            // Query suggests file
            const queryKeys = Array.from(u.searchParams.keys());
            const fileHint = queryKeys.some((k) =>
                /^(file|download|attachment|content|view)$/i.test(k),
            );

            // File extension
            const fileExt = (u.pathname.match(/\.([a-z0-9]+)$/i) || [
                ,
                "",
            ])[1].toLowerCase();
            const extWhitelist = new Set([
                "pdf",
                "doc",
                "docx",
                "ppt",
                "pptx",
                "xls",
                "xlsx",
                "csv",
                "txt",
                "rtf",
                "odt",
                "odp",
                "ods",
                "png",
                "jpg",
                "jpeg",
                "gif",
                "svg",
                "webp",
                "zip",
                "rar",
                "7z",
                "tar",
                "gz",
                "bz2",
                "xz",
                "mp4",
                "webm",
                "ogg",
                "mp3",
                "wav",
            ]);

            return fileHint || extWhitelist.has(fileExt);
        } catch (_) {
            return false;
        }
    }

    function shouldRetarget(anchor) {
        if (!anchor) return false;
        if (!settings.enableNewTab) return false;
        const href = anchor.getAttribute("href") || "";
        if (!href || href.startsWith("#") || href.startsWith("javascript:"))
            return false;
        return isFileLikeUrl(href);
    }

    function isInternalNav(url) {
        try {
            const u = new URL(url, location.href);
            const sameOrigin = u.origin === location.origin;
            const underCourse = /^\/webclass\/course\.php\//.test(u.pathname);
            return sameOrigin && underCourse && !isFileLikeUrl(u.href);
        } catch (_) {
            return false;
        }
    }

    function retargetAllAnchors(root) {
        const anchors = (root || document).querySelectorAll("a[href]");
        for (const a of anchors) {
            if (shouldRetarget(a)) {
                a.setAttribute("target", "_blank");
                a.setAttribute("rel", "noopener");
            } else if (isInternalNav(a.href)) {
                if (a.getAttribute("target") === "_blank")
                    a.removeAttribute("target");
            }
        }
    }

    // Listen for settings changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "settingsChanged") {
            settings = message.settings;
            retargetAllAnchors(document);
        }
    });

    // Initialize
    async function init() {
        await loadSettings();
        retargetAllAnchors(document);
    }

    init();

    // Observe dynamic changes
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === "childList") {
                for (const node of m.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === "A") {
                            if (shouldRetarget(node)) {
                                node.setAttribute("target", "_blank");
                                node.setAttribute("rel", "noopener");
                            } else if (isInternalNav(node.href)) {
                                if (node.getAttribute("target") === "_blank")
                                    node.removeAttribute("target");
                            }
                        } else {
                            retargetAllAnchors(node);
                        }
                    }
                }
            } else if (
                m.type === "attributes" &&
                m.target.tagName === "A" &&
                m.attributeName === "href"
            ) {
                const a = m.target;
                if (shouldRetarget(a)) {
                    a.setAttribute("target", "_blank");
                    a.setAttribute("rel", "noopener");
                } else {
                    if (
                        isInternalNav(a.href) &&
                        a.getAttribute("target") === "_blank"
                    )
                        a.removeAttribute("target");
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["href"],
    });
})();
