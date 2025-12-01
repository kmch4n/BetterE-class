// Add download button for attachments and prevent popup windows
(function () {
    "use strict";

    let settings = {
        enableAttachmentTab: true,
        enableDirectDownload: true,
    };

    // Load settings
    chrome.storage.sync.get(["enableAttachmentTab", "enableDirectDownload"], (result) => {
        try {
            settings.enableAttachmentTab = result.enableAttachmentTab !== undefined ? result.enableAttachmentTab : true;
            settings.enableDirectDownload = result.enableDirectDownload !== undefined ? result.enableDirectDownload : true;

            init();
        } catch (error) {
            console.error("Failed to load attachment settings:", error);
        }
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
            const filename = decodeURIComponent(urlParts[urlParts.length - 1]);

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
                console.warn("[BetterE-class] Error accessing button frame:", e);
            }

            if (buttonFrame) {
                buttonFrame.postMessage(message, "*");
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
        cell.style.cssText = "padding: 10px 5px;";

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-quiz-download-btns";
        buttonContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

        // Create buttons
        const downloadBtn = createDownloadButton("⬇️", "ダウンロード", pdfUrl, filename);
        const saveAsBtn = createSaveAsButton("💾", "名前を付けて保存", pdfUrl, filename);
        const previewBtn = createPreviewButton("👁️", "プレビュー", pdfUrl, filename);

        downloadBtn.style.width = "100%";
        downloadBtn.style.justifyContent = "center";
        saveAsBtn.style.width = "100%";
        saveAsBtn.style.justifyContent = "center";
        previewBtn.style.width = "100%";
        previewBtn.style.justifyContent = "center";

        buttonContainer.appendChild(downloadBtn);
        buttonContainer.appendChild(saveAsBtn);
        buttonContainer.appendChild(previewBtn);

        cell.appendChild(buttonContainer);
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

        // Extract filename from path
        const fileName = filePath.split("/").pop();
        const decodedFileName = decodeURIComponent(fileName);

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-frame-download";
        buttonContainer.style.cssText = "position: absolute; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 4px; background: rgba(255, 255, 255, 0.95); padding: 6px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);";

        // Create direct download button
        const downloadBtn = createDownloadButton("⬇️", "ダウンロード", loaditUrl, decodedFileName);
        buttonContainer.appendChild(downloadBtn);

        // Create "save as" button
        const saveAsBtn = createSaveAsButton("💾", "名前を付けて保存", loaditUrl, decodedFileName);
        buttonContainer.appendChild(saveAsBtn);

        // Insert button container
        if (frameContainer.style.position === "" || frameContainer.style.position === "static") {
            frameContainer.style.position = "relative";
        }
        frameContainer.appendChild(buttonContainer);
    }

    function addDownloadButtonForLoaditLink(link, loaditUrl, filePath) {
        // Check if button already exists
        const parent = link.parentElement;
        if (!parent || parent.querySelector(".betterEclass-download-btns")) {
            return;
        }

        // Extract filename from path
        const fileName = filePath.split("/").pop();
        const decodedFileName = decodeURIComponent(fileName);

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-download-btns";
        buttonContainer.style.cssText = "margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;";

        // Create direct download button
        const downloadBtn = createDownloadButton("⬇️", "ダウンロード", loaditUrl, decodedFileName);
        buttonContainer.appendChild(downloadBtn);

        // Create "save as" button
        const saveAsBtn = createSaveAsButton("💾", "名前を付けて保存", loaditUrl, decodedFileName);
        buttonContainer.appendChild(saveAsBtn);

        // Create preview button
        const previewBtn = createPreviewButton("👁️", "プレビュー", loaditUrl, decodedFileName);
        buttonContainer.appendChild(previewBtn);

        // Insert button after the link
        parent.appendChild(buttonContainer);
    }

    function addDownloadButton(attachmentLink, downloadUrl) {
        // Check if button already exists
        const parent = attachmentLink.closest("td");
        if (!parent || parent.querySelector(".betterEclass-download-btns")) {
            return;
        }

        // Extract file name from URL
        const urlParams = new URLSearchParams(downloadUrl.split("?")[1]);
        const fileName = urlParams.get("file_name");
        const decodedFileName = fileName ? decodeURIComponent(fileName) : "file";

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-download-btns";
        buttonContainer.style.cssText = "margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;";

        // Create direct download button
        const downloadBtn = createDownloadButton("⬇️", "ダウンロード", downloadUrl, decodedFileName);
        buttonContainer.appendChild(downloadBtn);

        // Create "save as" button
        const saveAsBtn = createSaveAsButton("💾", "名前を付けて保存", downloadUrl, decodedFileName);
        buttonContainer.appendChild(saveAsBtn);

        // Create preview button
        const previewBtn = createPreviewButton("👁️", "プレビュー", downloadUrl, decodedFileName);
        buttonContainer.appendChild(previewBtn);

        // Insert button after the attachment link
        parent.appendChild(buttonContainer);
    }

    function addDownloadButtonForDirectLink(pdfLink, pdfUrl) {
        // Check if button already exists
        if (pdfLink.nextElementSibling?.classList.contains("betterEclass-download-btns")) {
            return;
        }

        // Extract file name from URL path
        const urlPath = pdfUrl.split("?")[0];
        const fileName = urlPath.substring(urlPath.lastIndexOf("/") + 1);
        const decodedFileName = decodeURIComponent(fileName);

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-download-btns";
        buttonContainer.style.cssText = "margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;";

        // Create direct download button
        const downloadBtn = createDownloadButton("⬇️", "ダウンロード", pdfUrl, decodedFileName);
        buttonContainer.appendChild(downloadBtn);

        // Create "save as" button
        const saveAsBtn = createSaveAsButton("💾", "名前を付けて保存", pdfUrl, decodedFileName);
        buttonContainer.appendChild(saveAsBtn);

        // Create preview button (for direct PDF links, preview is just opening in new tab)
        const previewBtn = createPreviewButton("👁️", "プレビュー", pdfUrl, decodedFileName);
        buttonContainer.appendChild(previewBtn);

        // Insert button container after the link
        pdfLink.parentNode.insertBefore(buttonContainer, pdfLink.nextSibling);
    }

    function createDownloadButton(icon, text, downloadUrl, fileName) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createDownloadButton(icon, text, async () => {
            try {
                // Ensure we have an absolute URL
                let absoluteUrl;
                if (downloadUrl.startsWith("http")) {
                    absoluteUrl = downloadUrl;
                } else if (downloadUrl.startsWith("/")) {
                    absoluteUrl = `${window.location.origin}${downloadUrl}`;
                } else {
                    absoluteUrl = `${window.location.origin}/webclass/${downloadUrl}`;
                }

                // Fetch the file with credentials to maintain session
                const response = await fetch(absoluteUrl, {
                    credentials: "include",
                });
                if (!response.ok) {
                    console.error("[BetterE-class] Download failed:", response.status);
                    return;
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);

                // Create a temporary link and click it
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName || "download";
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the URL object
                setTimeout(() => URL.revokeObjectURL(url), 100);
            } catch (error) {
                console.error("[BetterE-class] Error triggering download:", error);
            }
        });
    }

    function createSaveAsButton(icon, text, downloadUrl, fileName) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createSaveAsButton(icon, text, () => {
            try {
                // Ensure we have an absolute URL
                let absoluteUrl;
                if (downloadUrl.startsWith("http")) {
                    absoluteUrl = downloadUrl;
                } else if (downloadUrl.startsWith("/")) {
                    absoluteUrl = `${window.location.origin}${downloadUrl}`;
                } else {
                    absoluteUrl = `${window.location.origin}/webclass/${downloadUrl}`;
                }

                // Use Chrome downloads API to prompt save dialog
                chrome.runtime.sendMessage(
                    {
                        type: "downloadWithDialog",
                        url: absoluteUrl,
                        filename: fileName,
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("[BetterE-class] Runtime error:", chrome.runtime.lastError);
                        }

                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                        }
                    },
                );
            } catch (error) {
                console.error("[BetterE-class] Error triggering save as:", error);
            }
        });
    }

    function createPreviewButton(icon, text, downloadUrl, fileName) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createPreviewButton(icon, text, () => {
            try {
                // Ensure we have an absolute URL
                let absoluteUrl;
                if (downloadUrl.startsWith("http")) {
                    absoluteUrl = downloadUrl;
                } else if (downloadUrl.startsWith("/")) {
                    absoluteUrl = `${window.location.origin}${downloadUrl}`;
                } else {
                    absoluteUrl = `${window.location.origin}/webclass/${downloadUrl}`;
                }

                // For direct PDF URLs, just open in new tab
                // The browser will handle the preview
                window.open(absoluteUrl, "_blank", "noopener,noreferrer");
            } catch (error) {
                console.error("[BetterE-class] Error triggering preview:", error);
            }
        });
    }

    // Listen for settings changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "settingsChanged") {
            settings = message.settings;

            // Re-process attachments with new settings
            // Remove existing download buttons
            document.querySelectorAll(".betterEclass-download-btns").forEach((btn) => btn.remove());
            document.querySelectorAll(".betterEclass-frame-download").forEach((btn) => btn.remove());

            processAttachments();
        }
    });
})();
