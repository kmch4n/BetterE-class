// Background service worker for BetterE-class
importScripts("utils/settings.js");

const settingsAPI = globalThis.BetterEclassUtils.settings;

// File extension whitelist. Must stay in sync with extWhitelist in content.js
// (service workers cannot import shared modules in Manifest V3).
const FILE_EXT_WHITELIST = new Set([
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "csv", "txt", "rtf", "odt", "odp", "ods",
    "png", "jpg", "jpeg", "gif", "svg", "webp",
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
    "mp4", "webm", "ogg", "mp3", "wav",
]);

function decodeHtmlEntities(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

function resolveRelativeUrl(candidate, sourceUrl) {
    return new URL(candidate, sourceUrl).href;
}

function hasAllowedExtension(url) {
    const match = url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
    if (!match) return false;
    return FILE_EXT_WHITELIST.has(match[1].toLowerCase());
}

function isStreamManifestUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname.toLowerCase().endsWith(".m3u8")) return true;
        return Array.from(parsedUrl.searchParams.values()).some((value) => value.split(/[?#]/)[0].toLowerCase().endsWith(".m3u8"));
    } catch (_) {
        return url.split(/[?#]/)[0].toLowerCase().endsWith(".m3u8");
    }
}

// Extract a real file URL from an intermediate page (loadit.php / file_down.php).
// Returns { url, reason, candidateCount } so callers can log extraction failures.
function extractFileUrlFromHtml(html, sourceUrl) {
    const anchorRegex = /<a\b[^>]*?href\s*=\s*(['"])([^'"]+)\1[^>]*>/gi;
    const candidates = [];
    let match;
    while ((match = anchorRegex.exec(html)) !== null) {
        const rawHref = decodeHtmlEntities(match[2]);
        const attrs = match[0];
        candidates.push({
            href: rawHref,
            hasTargetBlank: /target\s*=\s*(['"])_blank\1/i.test(attrs),
        });
    }

    const pickByDownloadPhp = candidates.find((c) => /download\.php/i.test(c.href));
    if (pickByDownloadPhp) {
        return {
            url: resolveRelativeUrl(pickByDownloadPhp.href, sourceUrl),
            reason: "download.php",
            candidateCount: candidates.length,
        };
    }

    const pickByTargetBlank = candidates.find((c) => c.hasTargetBlank && hasAllowedExtension(c.href));
    if (pickByTargetBlank) {
        return {
            url: resolveRelativeUrl(pickByTargetBlank.href, sourceUrl),
            reason: "target=_blank+extension",
            candidateCount: candidates.length,
        };
    }

    const pickByExtension = candidates.find((c) => hasAllowedExtension(c.href));
    if (pickByExtension) {
        return {
            url: resolveRelativeUrl(pickByExtension.href, sourceUrl),
            reason: "extension",
            candidateCount: candidates.length,
        };
    }

    return {
        url: null,
        reason: candidates.length === 0 ? "no-anchors" : "no-matching-extension",
        candidateCount: candidates.length,
    };
}

async function getDebugMode() {
    return await settingsAPI.getSetting("debugMode");
}

async function logExtractionFailure(sourceUrl, html, extraction) {
    const debug = await getDebugMode();
    if (!debug) return;
    console.warn("[BetterE-class] File URL extraction failed", {
        sourceUrl,
        htmlLength: html.length,
        candidateCount: extraction.candidateCount,
        reason: extraction.reason,
    });
}

function needsHtmlExtraction(url) {
    return url.includes("loadit.php") || url.includes("file_down.php");
}

async function resolveActualFileUrl(sourceUrl) {
    const response = await fetch(sourceUrl, { credentials: "include" });
    if (!response.ok) {
        throw new Error(`Failed to resolve file URL (HTTP ${response.status})`);
    }
    const html = await response.text();
    const extraction = extractFileUrlFromHtml(html, sourceUrl);
    if (!extraction.url) {
        await logExtractionFailure(sourceUrl, html, extraction);
    }
    return extraction.url;
}

function performDownload(url, filename, saveAs, sendResponse) {
    chrome.downloads.download({ url, filename, saveAs }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error("[BetterE-class] Download error:", chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
        } else {
            sendResponse({ success: true, downloadId });
        }
    });
}

function openPreviewTab(previewUrl, sender, sendResponse) {
    const tabOptions = { url: previewUrl, active: true };
    if (sender.tab && sender.tab.index !== undefined) {
        tabOptions.index = sender.tab.index + 1;
    }
    chrome.tabs.create(tabOptions, (tab) => {
        if (chrome.runtime.lastError) {
            console.error("[BetterE-class] Tab creation error:", chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
        } else {
            sendResponse({ success: true, tabId: tab.id });
        }
    });
}

function buildPreviewUrl(url) {
    const previewUrl = new URL(url);
    if (previewUrl.hostname !== "eclass.doshisha.ac.jp") return url;
    previewUrl.searchParams.set("_preview", "1");
    return previewUrl.href;
}

// Handle download and preview requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "downloadDirect" || message.type === "downloadWithDialog") {
        const saveAs = message.type === "downloadWithDialog";

        if (needsHtmlExtraction(message.url)) {
            resolveActualFileUrl(message.url)
                .then((actualFileUrl) => {
                    if (!actualFileUrl) {
                        sendResponse({ error: "ファイルのダウンロードリンクが見つかりませんでした。" });
                        return;
                    }
                    if (message.rejectStreamManifest && isStreamManifestUrl(actualFileUrl)) {
                        sendResponse({ streamOnly: true });
                        return;
                    }
                    performDownload(actualFileUrl, message.filename, saveAs, sendResponse);
                })
                .catch((error) => {
                    console.error("[BetterE-class] Fetch error:", error);
                    sendResponse({ error: error.message });
                });
        } else {
            if (message.rejectStreamManifest && isStreamManifestUrl(message.url)) {
                sendResponse({ streamOnly: true });
                return false;
            }
            performDownload(message.url, message.filename, saveAs, sendResponse);
        }

        return true; // Indicate async response
    }

    if (message.type === "previewFile") {
        if (needsHtmlExtraction(message.url)) {
            resolveActualFileUrl(message.url)
                .then((actualFileUrl) => {
                    if (!actualFileUrl) {
                        sendResponse({ error: "ファイルのプレビューリンクが見つかりませんでした。" });
                        return;
                    }
                    const previewUrl = buildPreviewUrl(actualFileUrl);
                    openPreviewTab(previewUrl, sender, sendResponse);
                })
                .catch((error) => {
                    console.error("[BetterE-class] Fetch error for preview:", error);
                    sendResponse({ error: error.message });
                });
        } else {
            openPreviewTab(buildPreviewUrl(message.url), sender, sendResponse);
        }

        return true; // Indicate async response
    }
});
