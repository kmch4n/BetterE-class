// quiz-attachment-buttons.js
// Adds download buttons to quiz/assignment attachment links

(function () {
    "use strict";

    // Debug mode - loaded from settings
    let DEBUG = false;

    // Load debug mode setting
    chrome.storage.sync.get({ debugMode: false }, (items) => {
        DEBUG = items.debugMode || false;
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
            return filename ? decodeURIComponent(filename) : "download";
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

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-attachment-btns";
        buttonContainer.style.cssText = `
            display: inline-flex;
            gap: 4px;
            margin-left: 8px;
            vertical-align: middle;
        `;

        // Create Download button
        const downloadButton = window.BetterEclassUtils.createDownloadButton(
            "⬇️",
            "ダウンロード",
            () => {
                if (DEBUG) {
                    console.log("[BetterE-class] Downloading:", filename);
                    console.log("[BetterE-class] URL:", absoluteUrl);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadDirect",
                        url: absoluteUrl,
                        filename: filename,
                    },
                    (response) => {
                        if (response && response.error) {
                            alert(`ダウンロードエラー: ${response.error}`);
                        }
                    }
                );
            },
            true // iconOnly
        );

        // Create Save As button
        const saveAsButton = window.BetterEclassUtils.createSaveAsButton(
            "💾",
            "名前を付けて保存",
            () => {
                if (DEBUG) {
                    console.log("[BetterE-class] Save As:", filename);
                    console.log("[BetterE-class] URL:", absoluteUrl);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadWithDialog",
                        url: absoluteUrl,
                        filename: filename,
                    },
                    (response) => {
                        if (response && response.error) {
                            alert(`ダウンロードエラー: ${response.error}`);
                        }
                    }
                );
            },
            true // iconOnly
        );

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

        // Check if button factory is available
        if (!window.BetterEclassUtils?.createDownloadButton) {
            console.warn("[BetterE-class] Button factory not available");
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
