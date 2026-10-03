// textbook-chapter-buttons.js
// Adds download buttons next to chapter items in txtbk_show_chapter.php
// Supports both loadit.php (PDF preview) and file_down.php (attachments)

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
        enableDirectDownload: true,
        debugMode: false,
    };

    // Store current PDF URL and filename
    let currentPdfUrl = null;
    let currentPdfFilename = null;

    // Store page information from JSON
    let pageInfo = null;
    const settingsAPI = window.BetterEclassUtils.settings;

    function getPanel() {
        return window.BetterEclassUtils.textbookPanel || null;
    }

    // Report problems inside the action panel instead of blocking the page with alert().
    function notifyError(text) {
        const panel = getPanel();
        if (panel) {
            panel.showMessage("error", text);
        } else {
            alert(text);
        }
    }

    /**
     * Create a button styled by textbook-panel.css.
     * @param {{icon: string, label: string, title?: string, variant?: string}} options
     * @param {(event: MouseEvent) => void} onClick
     */
    function createPanelButton(options, onClick) {
        return getPanel().createButton({ ...options, onClick });
    }

    // Load settings and initialize
    settingsAPI.getSettings(["enableDirectDownload", "debugMode"]).then((items) => {
            settings = items;
            DEBUG = items.debugMode;

            // Parse JSON data to get page information
            parsePageInfo();

            // Detect file_down.php attachment links
            detectAttachmentLinks();

            // Add buttons to current page
            updateButtonsForCurrentPage();

            // Watch for page changes
            observePageChanges();
        });

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

    function isStreamManifestUrl(url) {
        if (!url) return false;
        try {
            const parsedUrl = new URL(url, window.location.origin);
            if (parsedUrl.pathname.toLowerCase().endsWith(".m3u8")) return true;
            return Array.from(parsedUrl.searchParams.values()).some((value) => value.split(/[?#]/)[0].toLowerCase().endsWith(".m3u8"));
        } catch (_) {
            return url.split(/[?#]/)[0].toLowerCase().endsWith(".m3u8");
        }
    }

    function selectDownloadTarget(pageData) {
        const candidates = [
            { source: "fileDownloadUrl", url: pageData.fileDownloadUrl },
            { source: "currentPdfUrl", url: currentPdfUrl },
            { source: "fileUrl", url: pageData.fileUrl },
        ].filter((candidate) => candidate.url);
        const selected = candidates.find((candidate) => !isStreamManifestUrl(candidate.url));

        return {
            selected: selected || null,
            streamOnly: !selected && candidates.some((candidate) => isStreamManifestUrl(candidate.url)),
        };
    }

    function getDownloadFilename(pageData, target) {
        if (target.source === "currentPdfUrl" && currentPdfFilename) {
            return currentPdfFilename;
        }
        try {
            const parsedUrl = new URL(target.url, window.location.origin);
            const fileNameParam = parsedUrl.searchParams.get("file_name");
            if (fileNameParam) return safeDecodeURIComponent(fileNameParam);
            const pathName = safeDecodeURIComponent(parsedUrl.pathname.split("/").pop() || "");
            if (pathName.includes(".")) return pathName;
        } catch (_) {
            // Fall through to a generic filename.
        }
        return `document.${pageData.fileExtension || "pdf"}`;
    }

    function showStreamOnlyNotice() {
        notifyError("この動画はストリーミング配信のため、動画ファイルとしてダウンロードできません。");
    }

    /**
     * Save a stream-only page as MP4 through textbook-video-download.js.
     * @returns {boolean} true when the page was handled as a video
     */
    function downloadStreamPage(page, button, saveAs) {
        const textbookVideo = window.BetterEclassUtils.textbookVideo;
        return Boolean(textbookVideo && textbookVideo.downloadPage(page, { button, saveAs }));
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

    // Refresh the action panel for the current page, then add any per-row attachment buttons that
    // are still missing (the attachment pass skips rows that already have them)
    function updateButtonsForCurrentPage() {
        renderCurrentPageButtons();
        processFileDownAttachments();
    }

    // Render buttons for the current page
    function renderCurrentPageButtons() {
        if (!pageInfo || !settings.enableDirectDownload) {
            return;
        }

        const currentPage = getCurrentPageNumber();
        if (!currentPage) {
            if (DEBUG) console.warn("[BetterE-class] Could not determine current page");
            return;
        }

        const panel = getPanel();
        if (!panel) return;

        const pageData = pageInfo[currentPage];
        if (!pageData || !pageData.hasFile) {
            if (DEBUG) console.log(`[BetterE-class] Current page ${currentPage} has no file, hiding actions`);
            panel.setCurrentActions(null, []);
            return;
        }

        panel.setCurrentActions(getSectionTitle(currentPage), [createDownloadButton(), createSaveAsButton(), createPreviewButton()]);

        if (DEBUG) console.log(`[BetterE-class] Showing actions for page ${currentPage}`);
    }

    /**
     * Read the TOC row label, e.g. "第1節 2-1-2026福祉経済1-1-1再掲".
     * @param {string} page
     * @returns {string}
     */
    function getSectionTitle(page) {
        const row = document.querySelector(`#TOCLayout tr[data-page="${page}"]`);
        if (!row) return "";
        return Array.from(row.querySelectorAll("td"))
            .slice(0, 3)
            .map((cell) => {
                const label = cell.querySelector("span");
                return (label || cell).textContent.replace(/\s+/g, " ").trim();
            })
            .filter(Boolean)
            .join(" ");
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
        const button = createPanelButton(
            { icon: "download", label: "保存", title: "この節の資料をダウンロードします" },
            () => {
                const currentPage = getCurrentPageNumber();
                if (!currentPage || !pageInfo[currentPage]) {
                    notifyError("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                const target = selectDownloadTarget(pageData);
                const downloadUrl = target.selected ? target.selected.url : null;

                if (DEBUG) {
                    console.log("[BetterE-class] === Download URL Selection ===");
                    console.log("  - fileDownloadUrl:", pageData.fileDownloadUrl || "(not set)");
                    console.log("  - currentPdfUrl:", currentPdfUrl || "(not set)");
                    console.log("  - fileUrl:", pageData.fileUrl || "(not set)");
                    console.log("  - Selected URL:", downloadUrl);
                    console.log("  - Selected source:", target.selected ? target.selected.source : "(none)");
                }

                if (!downloadUrl) {
                    if (target.streamOnly) {
                        if (!downloadStreamPage(currentPage, button, false)) showStreamOnlyNotice();
                        return;
                    }
                    notifyError("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for download");
                    return;
                }

                const filename = getDownloadFilename(pageData, target.selected);

                if (DEBUG) {
                    console.log(`[BetterE-class] Downloading: ${downloadUrl}`);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadDirect",
                        url: downloadUrl,
                        filename: filename,
                        rejectStreamManifest: true,
                    },
                    (response) => {
                        if (response && response.streamOnly) {
                            showStreamOnlyNotice();
                            return;
                        }
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                            notifyError(`ダウンロードエラー: ${response.error}`);
                        }
                    },
                );
            },
        );
        return button;
    }

    // Create save as button
    function createSaveAsButton() {
        const button = createPanelButton(
            { icon: "saveAs", label: "保存先", title: "保存先と名前を選んで保存します" },
            () => {
                const currentPage = getCurrentPageNumber();
                if (!currentPage || !pageInfo[currentPage]) {
                    notifyError("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                const target = selectDownloadTarget(pageData);
                const downloadUrl = target.selected ? target.selected.url : null;

                if (!downloadUrl) {
                    if (target.streamOnly) {
                        if (!downloadStreamPage(currentPage, button, true)) showStreamOnlyNotice();
                        return;
                    }
                    notifyError("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for save");
                    return;
                }

                const filename = getDownloadFilename(pageData, target.selected);

                if (DEBUG) {
                    console.log(`[BetterE-class] Save as: ${downloadUrl}`);
                }

                chrome.runtime.sendMessage(
                    {
                        type: "downloadWithDialog",
                        url: downloadUrl,
                        filename: filename,
                        rejectStreamManifest: true,
                    },
                    (response) => {
                        if (response && response.streamOnly) {
                            showStreamOnlyNotice();
                            return;
                        }
                        if (response && response.error) {
                            console.error("[BetterE-class] Download error:", response.error);
                            notifyError(`保存エラー: ${response.error}`);
                        }
                    },
                );
            },
        );
        return button;
    }

    // Create preview button
    function createPreviewButton() {
        const currentPage = getCurrentPageNumber();
        const pageData = currentPage && pageInfo ? pageInfo[currentPage] : null;

        // Disable preview for non-PDF files
        const isDisabled = pageData && !pageData.isPdf;

        const button = createPanelButton(
            { icon: "preview", label: "表示", title: "新しいタブでプレビューします" },
            () => {
                if (isDisabled) {
                    notifyError("プレビューはPDFファイルのみ対応しています。");
                    return;
                }

                if (!currentPage || !pageInfo[currentPage]) {
                    notifyError("ページ情報が取得できませんでした。");
                    return;
                }

                const pageData = pageInfo[currentPage];

                // Priority 1: fileDownloadUrl (file_down.php link) - most reliable for all file types
                // Priority 2: currentPdfUrl (from loadit.php frame message) - works for PDFs
                // Priority 3: fileUrl (constructed URL from JSON) - fallback
                const downloadUrl = pageData.fileDownloadUrl || currentPdfUrl || pageData.fileUrl;

                if (!downloadUrl) {
                    notifyError("ファイルURLが取得できませんでした。");
                    if (DEBUG) console.error("[BetterE-class] No URL available for preview");
                    return;
                }

                // Determine filename
                let filename = currentPdfFilename;
                if (!filename) {
                    // Extract from fileDownloadUrl or use generic name
                    if (pageData.fileDownloadUrl) {
                        const urlParams = new URLSearchParams(pageData.fileDownloadUrl.split("?")[1]);
                        filename = safeDecodeURIComponent(urlParams.get("file_name") || "");
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
                            notifyError(`プレビューエラー: ${response.error}`);
                        }
                    },
                );
            },
        );

        if (isDisabled) {
            getPanel().setButtonState(button, "disabled", { reason: "プレビューはPDFファイルのみ対応しています" });
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
                const decodedFilename = safeDecodeURIComponent(filename);

                // Find the parent row
                const row = link.closest("tr[data-page]");
                if (!row) {
                    if (DEBUG) console.warn("[BetterE-class] Could not find parent row for attachment");
                    return;
                }

                // Check if buttons already exist
                if (row.querySelector(".betterEclass-attachment-btns")) {
                    return;
                }

                // Find the cell with the attachment link
                const attachmentCell = link.closest("td");
                if (!attachmentCell) {
                    return;
                }

                // Create button container
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "bec-scope bec-row-actions betterEclass-attachment-btns";
                buttonContainer.setAttribute("role", "group");
                buttonContainer.setAttribute("aria-label", decodedFilename);

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
        return createPanelButton(
            { icon: "download", label: `${filename || "添付ファイル"}をダウンロード`, variant: "icon" },
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
        );
    }

    function createSaveAsButtonForAttachment(url, filename) {
        return createPanelButton(
            { icon: "saveAs", label: `${filename || "添付ファイル"}を保存先を選んで保存`, variant: "icon" },
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
        );
    }

    function createPreviewButtonForAttachment(url, filename) {
        return createPanelButton(
            { icon: "preview", label: `${filename || "添付ファイル"}をプレビュー`, variant: "icon" },
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
        );
    }

    // Monitor for changes in settings
    settingsAPI.onSettingsChanged((changes) => {
        if (changes.enableDirectDownload) {
            settings.enableDirectDownload = changes.enableDirectDownload.newValue;
        }
        if (changes.debugMode) {
            settings.debugMode = changes.debugMode.newValue;
            DEBUG = changes.debugMode.newValue;
            if (DEBUG) console.log("[BetterE-class] Debug mode enabled");
        }
    });
})();
