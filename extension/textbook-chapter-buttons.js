// textbook-chapter-buttons.js
// Adds download buttons next to chapter items in txtbk_show_chapter.php
// Supports both loadit.php (PDF preview) and file_down.php (attachments)

(function () {
    "use strict";

    // Debug mode - loaded from settings
    let DEBUG = false;

    let settings = {
        enableDirectDownload: true,
        debugMode: false,
    };

    // Store current PDF URL and filename
    let currentPdfUrl = null;
    let currentPdfFilename = null;

    // Store page information from JSON
    let pageInfo = null;

    // Load settings and initialize
    chrome.storage.sync.get(
        {
            enableDirectDownload: true,
            debugMode: false,
        },
        (items) => {
            settings = items;
            DEBUG = items.debugMode || false;

            // Parse JSON data to get page information
            parsePageInfo();

            // Detect file_down.php attachment links
            detectAttachmentLinks();

            // Add buttons to current page
            updateButtonsForCurrentPage();

            // Watch for page changes
            observePageChanges();

            // Process file_down.php attachments
            processFileDownAttachments();
        },
    );

    /**
     * Extract file extension from file path
     * @param {string} filePath - File path from JSON data
     * @returns {string} File extension (lowercase, without dot)
     */
    function getFileExtension(filePath) {
        if (!filePath) return "";
        const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : "";
    }

    /**
     * Check if file type supports preview (PDF only)
     * @param {string} extension - File extension
     * @returns {boolean}
     */
    function isPreviewableFile(extension) {
        return extension === "pdf";
    }

    // Parse JSON data from the page
    function parsePageInfo() {
        try {
            const jsonScript = document.querySelector("script#json-data");
            if (!jsonScript) {
                if (DEBUG) console.warn("[BetterE-class] JSON data not found");
                return;
            }

            const data = JSON.parse(jsonScript.textContent);
            const textUrls = data.text_urls || {};

            if (DEBUG) {
                console.log("[BetterE-class] === parsePageInfo START (v1.7.8-fix) ===");
            }

            pageInfo = {};
            for (const pageNum in textUrls) {
                const url = textUrls[pageNum];
                const urlParams = new URLSearchParams(url.split("?")[1]);
                const file = urlParams.get("file") || "";

                const pageData = {
                    url: url,
                    hasFile: file && file.length > 0,
                    file: file,
                    fileUrl: null,
                    fileExtension: null,
                    isPdf: false,
                    fileDownloadUrl: null
                };

                // Construct loadit.php URL if file exists
                if (file && file.length > 0) {
                    const contentsUrl = urlParams.get("contents_url") || data.contents_url || "";

                    // Build absolute file URL
                    const fileUrl = window.location.origin + contentsUrl + file;

                    // Detect file extension
                    const extension = getFileExtension(file);

                    pageData.fileUrl = fileUrl;
                    pageData.fileExtension = extension;
                    pageData.isPdf = extension === "pdf";

                    if (DEBUG) {
                        console.log(`[BetterE-class] Page ${pageNum}: ${file} (${extension})`);
                    }
                }

                pageInfo[pageNum] = pageData;
            }

            if (DEBUG) console.log("[BetterE-class] Parsed page info:", pageInfo);
        } catch (error) {
            console.error("[BetterE-class] Error parsing page info:", error);
        }
    }

    /**
     * Detect file_down.php attachment links in chapter list
     * Updates pageInfo with file_down.php URLs
     */
    function detectAttachmentLinks() {
        if (!pageInfo) return;

        const rows = document.querySelectorAll("#TOCLayout tr[data-page]");
        rows.forEach(row => {
            const pageNum = row.getAttribute("data-page");
            if (!pageInfo[pageNum]) return;

            // Find file_down.php link in this row
            const attachmentLink = row.querySelector('a[href*="file_down.php"]');
            if (attachmentLink) {
                let href = attachmentLink.getAttribute("href");

                // Convert to absolute URL
                if (!href.startsWith("http")) {
                    if (href.startsWith("/")) {
                        href = window.location.origin + href;
                    } else {
                        href = window.location.origin + "/webclass/" + href;
                    }
                }

                // Extract filename from URL
                const urlParams = new URLSearchParams(href.split("?")[1]);
                const filename = urlParams.get("file_name") || "";

                // Update pageInfo
                pageInfo[pageNum].fileDownloadUrl = href;

                // Always update extension from attachment filename (more reliable than file parameter)
                if (filename) {
                    const ext = getFileExtension(filename);

                    if (DEBUG) {
                        console.log(`[BetterE-class] Found attachment for page ${pageNum}:`);
                        console.log(`  - Filename: ${filename}`);
                        console.log(`  - Extension (before): ${pageInfo[pageNum].fileExtension}`);
                        console.log(`  - Extension (extracted): ${ext}`);
                    }

                    pageInfo[pageNum].fileExtension = ext;
                    pageInfo[pageNum].isPdf = ext === "pdf";

                    if (DEBUG) {
                        console.log(`  - Extension (after): ${pageInfo[pageNum].fileExtension}`);
                        console.log(`  - isPdf: ${pageInfo[pageNum].isPdf}`);
                    }
                }
            }
        });
    }

    // Get current page number from highlighted row
    function getCurrentPageNumber() {
        // Find the row with class "bkkhaki" (current page indicator)
        const currentRow = document.querySelector("#TOCLayout tr.bkkhaki[data-page]");
        if (currentRow) {
            const pageNum = currentRow.getAttribute("data-page");
            if (DEBUG) console.log(`[BetterE-class] Current page from highlighted row: ${pageNum}`);
            return pageNum;
        }

        // Fallback to JSON data
        try {
            const jsonScript = document.querySelector("script#json-data");
            if (jsonScript) {
                const data = JSON.parse(jsonScript.textContent);
                if (data.page) {
                    if (DEBUG) console.log(`[BetterE-class] Current page from JSON (fallback): ${data.page}`);
                    return String(data.page);
                }
            }
        } catch (error) {
            console.error("[BetterE-class] Error getting current page number:", error);
        }
        return null;
    }

    // Update buttons for the current page
    function updateButtonsForCurrentPage() {
        if (!pageInfo || !settings.enableDirectDownload) {
            return;
        }

        const currentPage = getCurrentPageNumber();
        if (!currentPage) {
            if (DEBUG) console.warn("[BetterE-class] Could not determine current page");
            return;
        }

        const pageData = pageInfo[currentPage];
        if (!pageData || !pageData.hasFile) {
            if (DEBUG) console.log(`[BetterE-class] Current page ${currentPage} has no file, removing buttons`);
            // Remove all buttons if current page has no file
            document.querySelectorAll(".betterEclass-chapter-download-btns").forEach((btn) => btn.remove());
            return;
        }

        // Remove all existing buttons
        document.querySelectorAll(".betterEclass-chapter-download-btns").forEach((btn) => btn.remove());

        // Find the row for the current page
        const currentRow = document.querySelector(`#TOCLayout tr[data-page="${currentPage}"]`);
        if (!currentRow) {
            if (DEBUG) console.warn(`[BetterE-class] Could not find row for page ${currentPage}`);
            return;
        }

        // Find the title cell
        const cells = currentRow.querySelectorAll("td");
        if (cells.length < 3) {
            return;
        }

        const titleCell = cells[2];

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "betterEclass-chapter-download-btns";
        buttonContainer.style.cssText = "margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;";

        // Add buttons
        buttonContainer.appendChild(createDownloadButton());
        buttonContainer.appendChild(createSaveAsButton());
        buttonContainer.appendChild(createPreviewButton());

        titleCell.appendChild(buttonContainer);

        if (DEBUG) console.log(`[BetterE-class] Added buttons for page ${currentPage}`);
    }

    // Observe page changes using MutationObserver
    function observePageChanges() {
        const tocTable = document.querySelector("#TOCLayout");
        if (!tocTable) {
            if (DEBUG) console.warn("[BetterE-class] TOC table not found");
            return;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Check if a row's class changed (page navigation)
                if (mutation.type === "attributes" && mutation.attributeName === "class") {
                    const target = mutation.target;
                    if (target.tagName === "TR" && target.hasAttribute("data-page")) {
                        if (DEBUG) console.log("[BetterE-class] Page change detected");
                        // Reset PDF URL when page changes
                        currentPdfUrl = null;
                        currentPdfFilename = null;
                        // Update buttons after a short delay to ensure DOM is updated
                        setTimeout(() => {
                            updateButtonsForCurrentPage();
                        }, 100);
                        break;
                    }
                }
            }
        });

        observer.observe(tocTable, {
            attributes: true,
            attributeFilter: ["class"],
            subtree: true,
        });

        if (DEBUG) console.log("[BetterE-class] Started observing page changes");
    }

    // Listen for PDF URL from loadit.php frame
    window.addEventListener("message", (event) => {
        const isValidOrigin = event.origin === window.location.origin || event.origin === "https://eclass.doshisha.ac.jp";

        if (!isValidOrigin) {
            return;
        }

        if (event.data && event.data.type === "betterEclass_pdfUrl") {
            currentPdfUrl = event.data.url;
            currentPdfFilename = event.data.filename;
            if (DEBUG) console.log(`[BetterE-class] Received PDF URL:`, currentPdfUrl);
        }
    });

    // Create download button
    function createDownloadButton() {
        return window.BetterEclassUtils.createDownloadButton(
            "⬇️",
            "ダウンロード",
            () => {
                const currentPage = getCurrentPageNumber();
                if (!currentPage || !pageInfo[currentPage]) {
                    alert("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                // Priority 1: fileDownloadUrl (file_down.php link) - most reliable for all file types
                // Priority 2: currentPdfUrl (from loadit.php frame message) - works for PDFs
                // Priority 3: fileUrl (constructed URL from JSON) - fallback
                const downloadUrl = pageData.fileDownloadUrl || currentPdfUrl || pageData.fileUrl;

                if (DEBUG) {
                    console.log("[BetterE-class] === Download URL Selection ===");
                    console.log("  - fileDownloadUrl:", pageData.fileDownloadUrl || "(not set)");
                    console.log("  - currentPdfUrl:", currentPdfUrl || "(not set)");
                    console.log("  - fileUrl:", pageData.fileUrl || "(not set)");
                    console.log("  - Selected URL:", downloadUrl);
                }

                if (!downloadUrl) {
                    alert("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for download");
                    return;
                }

                // Determine filename
                let filename = currentPdfFilename;
                if (!filename) {
                    // Extract from fileDownloadUrl or use generic name
                    if (pageData.fileDownloadUrl) {
                        const urlParams = new URLSearchParams(pageData.fileDownloadUrl.split("?")[1]);
                        filename = decodeURIComponent(urlParams.get("file_name") || "");
                    }
                    if (!filename) {
                        filename = `document.${pageData.fileExtension || "pdf"}`;
                    }
                }

                if (DEBUG) {
                    console.log(`[BetterE-class] Downloading: ${downloadUrl}`);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadDirect",
                        url: downloadUrl,
                        filename: filename,
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                            alert(`ダウンロードエラー: ${response.error}`);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );
    }

    // Create save as button
    function createSaveAsButton() {
        return window.BetterEclassUtils.createSaveAsButton(
            "💾",
            "名前を付けて保存",
            () => {
                const currentPage = getCurrentPageNumber();
                if (!currentPage || !pageInfo[currentPage]) {
                    alert("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                // Priority 1: fileDownloadUrl (file_down.php link) - most reliable for all file types
                // Priority 2: currentPdfUrl (from loadit.php frame message) - works for PDFs
                // Priority 3: fileUrl (constructed URL from JSON) - fallback
                const downloadUrl = pageData.fileDownloadUrl || currentPdfUrl || pageData.fileUrl;

                if (!downloadUrl) {
                    alert("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for save");
                    return;
                }

                // Determine filename
                let filename = currentPdfFilename;
                if (!filename) {
                    // Extract from fileDownloadUrl or use generic name
                    if (pageData.fileDownloadUrl) {
                        const urlParams = new URLSearchParams(pageData.fileDownloadUrl.split("?")[1]);
                        filename = decodeURIComponent(urlParams.get("file_name") || "");
                    }
                    if (!filename) {
                        filename = `document.${pageData.fileExtension || "pdf"}`;
                    }
                }

                if (DEBUG) {
                    console.log(`[BetterE-class] Save as: ${downloadUrl}`);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadWithDialog",
                        url: downloadUrl,
                        filename: filename,
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                            alert(`保存エラー: ${response.error}`);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );
    }

    // Create preview button
    function createPreviewButton() {
        const currentPage = getCurrentPageNumber();
        const pageData = currentPage && pageInfo ? pageInfo[currentPage] : null;

        // Disable preview for non-PDF files
        const isDisabled = pageData && !pageData.isPdf;

        const button = window.BetterEclassUtils.createPreviewButton(
            "👁️",
            isDisabled ? "プレビュー（PDFのみ）" : "プレビュー",
            () => {
                if (isDisabled) {
                    alert("プレビューはPDFファイルのみ対応しています。");
                    return;
                }

                if (!currentPage || !pageInfo[currentPage]) {
                    alert("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                // Priority 1: fileDownloadUrl (file_down.php link) - most reliable for all file types
                // Priority 2: currentPdfUrl (from loadit.php frame message) - works for PDFs
                // Priority 3: fileUrl (constructed URL from JSON) - fallback
                const downloadUrl = pageData.fileDownloadUrl || currentPdfUrl || pageData.fileUrl;

                if (!downloadUrl) {
                    alert("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for preview");
                    return;
                }

                // Determine filename
                let filename = currentPdfFilename;
                if (!filename) {
                    // Extract from fileDownloadUrl or use generic name
                    if (pageData.fileDownloadUrl) {
                        const urlParams = new URLSearchParams(pageData.fileDownloadUrl.split("?")[1]);
                        filename = decodeURIComponent(urlParams.get("file_name") || "");
                    }
                    if (!filename) {
                        filename = `document.${pageData.fileExtension || "pdf"}`;
                    }
                }

                if (DEBUG) {
                    console.log(`[BetterE-class] Preview: ${downloadUrl}`);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "previewFile",
                        url: downloadUrl,
                        filename: filename,
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Preview error:", response.error);
                            alert(`プレビューエラー: ${response.error}`);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );

        // Apply disabled styling
        if (isDisabled) {
            button.style.opacity = "0.5";
            button.style.cursor = "not-allowed";
        }

        return button;
    }

    // Process file_down.php attachments (direct attachment links in chapter list)
    function processFileDownAttachments() {
        if (!settings.enableDirectDownload) {
            return;
        }

        // Find all file_down.php links (attachment links in chapter list)
        const attachmentLinks = document.querySelectorAll('a[href*="file_down.php"]');

        attachmentLinks.forEach((link) => {
            try {
                // Prevent popup window - open in new tab instead
                link.setAttribute("target", "_blank");
                link.removeAttribute("onclick");

                // Also prevent default onclick behavior by replacing the onclick with null
                link.onclick = null;

                const href = link.getAttribute("href");
                if (!href || !href.includes("file_down.php")) {
                    return;
                }

                // Convert relative URL to absolute URL
                let absoluteUrl = href;
                if (!href.startsWith("http")) {
                    if (href.startsWith("/")) {
                        absoluteUrl = window.location.origin + href;
                    } else {
                        absoluteUrl = window.location.origin + "/webclass/" + href;
                    }
                }

                // Extract filename from URL
                const urlParams = new URLSearchParams(href.split("?")[1]);
                const filename = urlParams.get("file_name") || "document.pdf";
                const decodedFilename = decodeURIComponent(filename);

                // Find the parent row
                const row = link.closest("tr[data-page]");
                if (!row) {
                    if (DEBUG) console.warn("[BetterE-class] Could not find parent row for attachment");
                    return;
                }

                // Check if buttons already exist
                if (row.querySelector(".betterEclass-chapter-download-btns")) {
                    return;
                }

                // Find the cell with the attachment link
                const attachmentCell = link.closest("td");
                if (!attachmentCell) {
                    return;
                }

                // Create button container
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "betterEclass-chapter-download-btns";
                buttonContainer.style.cssText = "margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;";

                // Add buttons (use absolute URL for save/preview)
                buttonContainer.appendChild(createDownloadButtonForAttachment(absoluteUrl, decodedFilename));
                buttonContainer.appendChild(createSaveAsButtonForAttachment(absoluteUrl, decodedFilename));
                buttonContainer.appendChild(createPreviewButtonForAttachment(absoluteUrl, decodedFilename));

                attachmentCell.appendChild(buttonContainer);
            } catch (error) {
                console.error("[BetterE-class] Error processing attachment link:", error);
            }
        });
    }

    function createDownloadButtonForAttachment(url, filename) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createDownloadButton(
            "⬇️",
            "ダウンロード",
            () => {
                chrome.runtime.sendMessage(
                    {
                        type: "downloadDirect",
                        url: url,
                        filename: filename || "document.pdf",
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );
    }

    function createSaveAsButtonForAttachment(url, filename) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createSaveAsButton(
            "💾",
            "名前を付けて保存",
            () => {
                chrome.runtime.sendMessage(
                    {
                        type: "downloadWithDialog",
                        url: url,
                        filename: filename || "document.pdf",
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );
    }

    function createPreviewButtonForAttachment(url, filename) {
        // Use shared button factory from utils/button-factory.js
        return window.BetterEclassUtils.createPreviewButton(
            "👁️",
            "プレビュー",
            () => {
                chrome.runtime.sendMessage(
                    {
                        type: "previewFile",
                        url: url,
                        filename: filename || "document.pdf",
                    },
                    (response) => {
                        if (response && response.error) {
                            console.error("[BetterE-class] Preview error:", response.error);
                        }
                    },
                );
            },
            true, // iconOnly mode
        );
    }

    // Monitor for changes in settings
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "sync") {
            if (changes.enableDirectDownload) {
                settings.enableDirectDownload = changes.enableDirectDownload.newValue;
            }
            if (changes.debugMode) {
                settings.debugMode = changes.debugMode.newValue;
                DEBUG = changes.debugMode.newValue || false;
                if (DEBUG) console.log("[BetterE-class] Debug mode enabled");
            }
        }
    });
})();
