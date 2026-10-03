// Add download button for attachments and prevent popup windows
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

    let settings = {
        enableAttachmentTab: true,
        enableDirectDownload: true,
    };
    const settingsAPI = window.BetterEclassUtils.settings;

    // Load settings
    settingsAPI.getSettings(["enableAttachmentTab", "enableDirectDownload", "debugMode"]).then((result) => {
        try {
            settings.enableAttachmentTab = result.enableAttachmentTab;
            settings.enableDirectDownload = result.enableDirectDownload;
            DEBUG = result.debugMode;

            init();
        } catch (error) {
            console.error("Failed to load attachment settings:", error);
        }
    });

    settingsAPI.onSettingsChanged((changes) => {
        if (changes.debugMode) DEBUG = changes.debugMode.newValue;
    });

    function init() {
        // Check if this is the button frame (dqstn_button.php) and listen for PDF messages
        if (window.name === "button" || window.location.href.includes("dqstn_button.php")) {
            window.addEventListener("message", handleButtonFrameMessage);
        }

        // Wait for page to load
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                setTimeout(processAttachments, 100);
            });
        } else {
            setTimeout(processAttachments, 100);
        }
    }

    // Handle messages in button frame
    function handleButtonFrameMessage(event) {
        const isValidOrigin = event.origin === window.location.origin || event.origin === "https://eclass.doshisha.ac.jp";

        if (!isValidOrigin) return;

        if (event.data && event.data.type === "betterEclass_quizPdfUrl") {
            const { url, filename } = event.data;
            addButtonsToSidebar(url, filename);
        }
    }

    // Send PDF URL to button frame
    function sendPdfToButtonFrame(pdfUrl) {
        try {
            // Extract filename from URL
            const urlParts = pdfUrl.split("/");
            const filename = safeDecodeURIComponent(urlParts[urlParts.length - 1]);

            const message = {
                type: "betterEclass_quizPdfUrl",
                url: pdfUrl,
                filename: filename,
            };

            // Find button frame (it's at the top level frameset)
            let buttonFrame = null;
            try {
                // Try accessing from top level
                if (window.top && window.top.frames && window.top.frames["button"]) {
                    buttonFrame = window.top.frames["button"];
                } else if (window.top && window.top.frames) {
                    // Try iterating through all frames at top level
                    for (let i = 0; i < window.top.frames.length; i++) {
                        if (window.top.frames[i].name === "button") {
                            buttonFrame = window.top.frames[i];
                            break;
                        }
                    }
                }
            } catch (e) {
                if (DEBUG) console.warn("[BetterE-class] Error accessing button frame:", e);
            }

            if (buttonFrame) {
                buttonFrame.postMessage(message, "*");
            } else {
                if (DEBUG) console.warn("[BetterE-class] buttonFrame not found, skipping postMessage");
            }
            // Note: If button frame not found, isQuizPage check should prevent this from being called
        } catch (error) {
            console.error("[BetterE-class] Error sending PDF to button frame:", error);
        }
    }

    // Add buttons to quiz/survey sidebar
    function addButtonsToSidebar(pdfUrl, filename) {
        // Find the table in the sidebar
        const table = document.querySelector('table[align="CENTER"]');
        if (!table) return;

        // Check if buttons already exist
        if (document.querySelector(".betterEclass-quiz-download-btns")) return;

        // Create a new row for buttons
        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const newRow = document.createElement("tr");
        const cell = document.createElement("td");
        cell.setAttribute("colspan", "2");
        cell.className = "bec-file-actions-cell";
        cell.appendChild(createFileActions(pdfUrl, filename, { layout: "labeled", className: "betterEclass-quiz-download-btns" }));
        newRow.appendChild(cell);

        // Insert after the Q.1 row (first row)
        const firstRow = tbody.querySelector("tr");
        if (firstRow && firstRow.nextSibling) {
            tbody.insertBefore(newRow, firstRow.nextSibling);
        } else {
            tbody.appendChild(newRow);
        }
    }

    function processAttachments() {
        // Find all attachment links (type 1: with filedownload onclick)
        const attachmentLinks = document.querySelectorAll('a[onclick*="filedownload"]');

        attachmentLinks.forEach((link) => {
            try {
                const href = link.getAttribute("href");
                const onclickAttr = link.getAttribute("onclick");

                if (!href || !onclickAttr) return;

                // Prevent popup window from opening
                if (settings.enableAttachmentTab) {
                    // Add click event listener to prevent default popup behavior
                    link.addEventListener(
                        "click",
                        function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Open in new tab directly
                            window.open(href, "_blank", "noopener,noreferrer");
                        },
                        true,
                    ); // Use capture phase to intercept before onclick

                    // Also remove onclick attribute as backup
                    link.removeAttribute("onclick");
                }

                // Add download button if enabled
                if (settings.enableDirectDownload) {
                    addDownloadButton(link, href);
                }
            } catch (error) {
                console.error("Error processing attachment link:", error);
            }
        });

        // Find direct PDF links (type 2: "別ウインドウ" links)
        const directPdfLinks = document.querySelectorAll('a[href*=".pdf"][target="_blank"]');

        directPdfLinks.forEach((link) => {
            try {
                // Use link.href property (not getAttribute) to get absolute URL
                const href = link.href;
                if (!href) return;

                // Skip if this link was already processed as type 1
                if (link.getAttribute("onclick")?.includes("filedownload")) return;

                // Check if this is a quiz/survey page (loadit.php in question frame of qstn_frame.php)
                // More strict check: look for button frame in parent frameset to confirm it's a quiz page
                const isQuizPage =
                    (window.name === "question" || window.location.href.includes("loadit.php")) &&
                    window.parent &&
                    window.parent !== window &&
                    (() => {
                        try {
                            // Check if button frame exists (indicates quiz/survey page)
                            return window.top && window.top.frames && window.top.frames["button"];
                        } catch (e) {
                            return false;
                        }
                    })();

                // Check if this is inside a textbook frameset (loadit.php in a frame, but not quiz page)
                // In this case, buttons are already in the chapter list, so skip adding here
                const isTextbookFrameset = window.location.href.includes("loadit.php") && window.parent && window.parent !== window && !isQuizPage;

                if (isQuizPage && settings.enableDirectDownload) {
                    // Send PDF URL to button frame instead of adding buttons here
                    sendPdfToButtonFrame(href);
                    // Still hide the original "別ウインドウ" text
                    const textBefore = link.previousSibling;
                    if (textBefore && textBefore.nodeType === Node.TEXT_NODE) {
                        textBefore.textContent = "";
                    }
                    const textAfter = link.nextSibling;
                    if (textAfter && textAfter.nodeType === Node.TEXT_NODE) {
                        textAfter.textContent = "";
                    }
                    link.style.display = "none";
                } else if (isTextbookFrameset) {
                    // Skip adding buttons - they're already in the chapter list sidebar
                    // No action needed, buttons will be added by textbook-chapter-buttons.js
                    return;
                } else if (settings.enableDirectDownload) {
                    // Normal behavior: add buttons next to link
                    addDownloadButtonForDirectLink(link, href);
                }
            } catch (error) {
                console.error("Error processing direct PDF link:", error);
            }
        });

        // Find assignment page loadit.php links (type 3: in framesets)
        processAssignmentPageAttachments();
    }

    function processAssignmentPageAttachments() {
        // Look for frame elements pointing to loadit.php
        const frames = document.querySelectorAll('frame[src*="loadit.php"]');

        frames.forEach((frame) => {
            try {
                const src = frame.getAttribute("src");
                if (!src) return;

                // Extract file URL from loadit.php parameters
                const url = new URL(src, window.location.origin);
                const fileParam = url.searchParams.get("file");

                if (fileParam && fileParam.includes(".pdf")) {
                    // Create a visual indicator/button near the frame or in a dedicated area
                    addDownloadButtonForFramedFile(frame, src, fileParam);
                }
            } catch (error) {
                console.error("Error processing assignment page frame:", error);
            }
        });

        // Also check for direct loadit.php links in the page
        const loaditLinks = document.querySelectorAll('a[href*="loadit.php"]');

        loaditLinks.forEach((link) => {
            try {
                const href = link.getAttribute("href");
                if (!href) return;

                // Skip if already processed
                if (link.closest(".betterEclass-download-btns")) return;

                const url = new URL(href, window.location.origin);
                const fileParam = url.searchParams.get("file");
                const actionParam = url.searchParams.get("action");

                // Skip redirect links (external links like Panopto videos)
                if (actionParam === "redirect") {
                    return;
                }

                // Only process if file parameter exists and appears to be a PDF
                if (fileParam && (fileParam.toLowerCase().endsWith(".pdf") || fileParam.includes(".pdf"))) {
                    if (settings.enableDirectDownload) {
                        addDownloadButtonForLoaditLink(link, href, fileParam);
                    }
                }
            } catch (error) {
                console.error("Error processing loadit.php link:", error);
            }
        });
    }

    function addDownloadButtonForFramedFile(frameElement, loaditUrl, filePath) {
        // Create a floating button overlay near the frame
        const frameContainer = frameElement.parentElement;
        if (!frameContainer) return;

        // Skip if parent is a frameset (buttons should be added inside the frame content, not on frameset)
        if (frameContainer.tagName === "FRAMESET") {
            return;
        }

        // Check if button already exists
        if (frameContainer.querySelector(".betterEclass-frame-download")) {
            return;
        }

        const decodedFileName = safeDecodeURIComponent(filePath.split("/").pop());
        const actions = createFileActions(loaditUrl, decodedFileName, {
            layout: "floating",
            preview: false,
            className: "betterEclass-frame-download",
        });

        if (frameContainer.style.position === "" || frameContainer.style.position === "static") {
            frameContainer.style.position = "relative";
        }
        frameContainer.appendChild(actions);
    }

    function addDownloadButtonForLoaditLink(link, loaditUrl, filePath) {
        // Check if button already exists
        const parent = link.parentElement;
        if (!parent || parent.querySelector(".betterEclass-download-btns")) {
            return;
        }

        const decodedFileName = safeDecodeURIComponent(filePath.split("/").pop());
        parent.appendChild(createFileActions(loaditUrl, decodedFileName, { layout: "block", className: "betterEclass-download-btns" }));
    }

    function addDownloadButton(attachmentLink, downloadUrl) {
        // Check if button already exists
        const parent = attachmentLink.closest("td");
        if (!parent || parent.querySelector(".betterEclass-download-btns")) {
            return;
        }

        const fileName = new URLSearchParams(downloadUrl.split("?")[1]).get("file_name");
        const decodedFileName = fileName ? safeDecodeURIComponent(fileName) : "file";
        parent.appendChild(createFileActions(downloadUrl, decodedFileName, { layout: "block", className: "betterEclass-download-btns" }));
    }

    function addDownloadButtonForDirectLink(pdfLink, pdfUrl) {
        // Check if button already exists
        if (pdfLink.nextElementSibling?.classList.contains("betterEclass-download-btns")) {
            return;
        }

        const urlPath = pdfUrl.split("?")[0];
        const decodedFileName = safeDecodeURIComponent(urlPath.substring(urlPath.lastIndexOf("/") + 1));
        const actions = createFileActions(pdfUrl, decodedFileName, { layout: "block", className: "betterEclass-download-btns" });
        pdfLink.parentNode.insertBefore(actions, pdfLink.nextSibling);
    }

    /**
     * Save / save-as / preview buttons for one file, built on utils/controls.js.
     * "labeled" shows text labels (narrow quiz column), "block" sits under a link,
     * "floating" overlays the top-right corner of a framed file.
     * @param {string} url
     * @param {string} fileName
     * @param {{layout: "labeled"|"block"|"floating", preview?: boolean, className?: string}} options
     * @returns {HTMLElement}
     */
    function createFileActions(url, fileName, { layout, preview = true, className = "" }) {
        const controls = window.BetterEclassUtils.controls;
        const labeled = layout === "labeled";
        const container = document.createElement("div");
        container.className = `bec-scope bec-file-actions bec-file-actions--${layout} ${className}`.trim();
        container.setAttribute("role", "group");
        container.setAttribute("aria-label", fileName);

        const actions = [
            { icon: "download", label: "ダウンロード", title: `${fileName} をダウンロードします`, run: () => downloadFile(url, fileName) },
            { icon: "saveAs", label: "保存先を選ぶ", title: "保存先と名前を選んで保存します", run: () => requestBackground("downloadWithDialog", url, fileName) },
        ];
        if (preview) {
            actions.push({ icon: "preview", label: "プレビュー", title: "新しいタブでプレビューします", run: () => requestBackground("previewFile", url, fileName) });
        }

        actions.forEach(({ icon, label, title, run }) => {
            const button = controls.createButton({
                icon,
                label,
                title,
                variant: labeled ? "default" : "icon",
                onClick: async (_event, target) => {
                    controls.setButtonState(target, "busy");
                    const error = await run().catch((caught) => caught.message || String(caught));
                    controls.setButtonState(target, error ? "error" : "idle");
                    target.title = error ? `できませんでした: ${error}` : title;
                },
            });
            container.appendChild(button);
        });
        return container;
    }

    /**
     * Ask background.js to handle a file. Resolves with an error message, or null on success.
     * @returns {Promise<string|null>}
     */
    function requestBackground(type, url, fileName) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type, url: resolveAbsoluteUrl(url), filename: fileName }, (response) => {
                const error = chrome.runtime.lastError?.message || response?.error || null;
                if (error) console.error(`[BetterE-class] ${type} failed:`, error);
                resolve(error);
            });
        });
    }

    async function downloadFile(url, fileName) {
        const absoluteUrl = resolveAbsoluteUrl(url);

        // Intermediate pages return HTML, so let the background resolve the real file
        if (needsHtmlExtraction(absoluteUrl)) return requestBackground("downloadDirect", url, fileName);

        // Fetch the file with credentials to maintain session
        const response = await fetch(absoluteUrl, { credentials: "include" });
        if (!response.ok) return `HTTP ${response.status}`;

        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName || "download";
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
        return null;
    }

    function resolveAbsoluteUrl(url) {
        return new URL(url, `${window.location.origin}/webclass/`).href;
    }

    // Must match needsHtmlExtraction in background.js
    function needsHtmlExtraction(url) {
        return url.includes("loadit.php") || url.includes("file_down.php");
    }
})();
