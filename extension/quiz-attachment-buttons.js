// quiz-attachment-buttons.js
// Adds download buttons to quiz/assignment attachment links

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

    // Debug mode - loaded from settings
    let DEBUG = false;
    const settingsAPI = window.BetterEclassUtils.settings;

    // Load debug mode setting
    settingsAPI.getSetting("debugMode").then((debugMode) => {
        DEBUG = debugMode;
    });
    settingsAPI.onSettingsChanged((changes) => {
        if (changes.debugMode) DEBUG = changes.debugMode.newValue;
    });

    console.log("[BetterE-class] Quiz attachment buttons script initialized");

    /**
     * Check if current frame is answer frame in quiz/survey page
     */
    function isQuizAnswerFrame() {
        // Check if this is answer frame
        if (window.name !== "answer") {
            return false;
        }

        // Check if parent has button frame (quiz/survey indicator)
        try {
            return (
                window.parent &&
                window.parent !== window &&
                window.parent.frames &&
                window.parent.frames["button"]
            );
        } catch (e) {
            return false;
        }
    }

    /**
     * Extract filename from URL
     */
    function extractFilename(url) {
        try {
            const urlParams = new URLSearchParams(url.split("?")[1]);
            const filename = urlParams.get("file_name");
            return filename ? safeDecodeURIComponent(filename) : "download";
        } catch (e) {
            return "download";
        }
    }

    /**
     * Add download buttons to an attachment link
     */
    function addButtonsToAttachment(link) {
        // Check if buttons already added
        if (link.nextElementSibling?.classList.contains("betterEclass-attachment-btns")) {
            return true;
        }

        const url = link.getAttribute("href");
        if (!url) return false;

        // Convert to absolute URL
        let absoluteUrl = url;
        if (!url.startsWith("http")) {
            absoluteUrl = url.startsWith("/")
                ? window.location.origin + url
                : window.location.origin + "/webclass/" + url;
        }

        const filename = extractFilename(url);

        const controls = window.BetterEclassUtils.controls;
        const buttonContainer = document.createElement("span");
        buttonContainer.className = "bec-scope bec-quiz-attachment betterEclass-attachment-btns";

        // Errors show on the button itself (icon + tooltip) instead of an alert().
        function requestDownload(type, button) {
            if (DEBUG) console.log(`[BetterE-class] ${type}:`, filename, absoluteUrl);
            controls.setButtonState(button, "busy");
            chrome.runtime.sendMessage({ type, url: absoluteUrl, filename }, (response) => {
                const error = chrome.runtime.lastError?.message || response?.error;
                if (error) {
                    controls.setButtonState(button, "error");
                    button.title = `保存できませんでした: ${error}`;
                    return;
                }
                controls.setButtonState(button, "idle");
            });
        }

        const downloadButton = controls.createButton({
            icon: "download",
            label: "保存",
            title: `${filename} をダウンロードします`,
            variant: "icon",
            onClick: (_event, button) => requestDownload("downloadDirect", button),
        });
        const saveAsButton = controls.createButton({
            icon: "saveAs",
            label: "保存先を選んで保存",
            title: "保存先と名前を選んで保存します",
            variant: "icon",
            onClick: (_event, button) => requestDownload("downloadWithDialog", button),
        });

        buttonContainer.appendChild(downloadButton);
        buttonContainer.appendChild(saveAsButton);

        // Insert buttons after the link
        link.parentNode.insertBefore(buttonContainer, link.nextSibling);

        if (DEBUG) {
            console.log("[BetterE-class] Added buttons to:", filename);
        }

        return true;
    }

    /**
     * Process all attachment links in the page
     */
    function processAttachmentLinks() {
        // Find all attachment links
        // Pattern: <a href="...file_down.php..." target="download">
        const links = document.querySelectorAll('a[href*="file_down.php"][target="download"]');

        if (DEBUG) {
            console.log(`[BetterE-class] Found ${links.length} attachment link(s)`);
        }

        let addedCount = 0;
        links.forEach((link) => {
            if (addButtonsToAttachment(link)) {
                addedCount++;
            }
        });

        if (DEBUG && addedCount > 0) {
            console.log(`[BetterE-class] Added buttons to ${addedCount} attachment(s)`);
        }

        return addedCount > 0;
    }

    /**
     * Initialize the script
     */
    function init() {
        // Check if we're in quiz answer frame
        if (!isQuizAnswerFrame()) {
            if (DEBUG) console.log("[BetterE-class] Not in quiz answer frame, skipping");
            return;
        }

        if (!window.BetterEclassUtils?.controls) {
            console.warn("[BetterE-class] Shared controls not available");
            return;
        }

        // Try to process links immediately
        if (processAttachmentLinks()) {
            return; // Success, no need for observer
        }

        // If not found, use MutationObserver
        const observer = new MutationObserver((mutations, obs) => {
            if (processAttachmentLinks()) {
                obs.disconnect(); // Stop observing after success
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            observer.disconnect();
            if (DEBUG) console.log("[BetterE-class] Observer timeout");
        }, 10000);
    }

    // Initialize when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
