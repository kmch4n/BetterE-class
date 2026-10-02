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

// Extensions that identify web pages or scripts rather than downloadable files.
const NON_FILE_EXTENSIONS = new Set(["php", "html", "htm", "js", "css", "m3u8"]);

// Elements that can embed the real file on an intermediate page.
const EMBED_TAG_PATTERN = /<(iframe|frame|embed|video|audio|source|object)\b[^>]*>/gi;

function decodeHtmlEntities(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&amp;/g, "&");
}

function resolveRelativeUrl(candidate, sourceUrl) {
    return new URL(candidate, sourceUrl).href;
}

// Read an attribute value from a raw start tag. Supports quoted and unquoted values.
function getTagAttribute(tag, name) {
    const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
    const match = tag.match(pattern);
    if (!match) return null;
    return decodeHtmlEntities(match[1] ?? match[2] ?? match[3]).trim();
}

function getUrlExtension(url) {
    const match = url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : "";
}

function hasAllowedExtension(url) {
    return FILE_EXT_WHITELIST.has(getUrlExtension(url));
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

function isDownloadPhpUrl(url) {
    return /download\.php/i.test(url);
}

function isSameOrigin(url, sourceUrl) {
    return new URL(url).origin === new URL(sourceUrl).origin;
}

// Course files are stored under /webclass/data/ on the same host as the intermediate page.
function isCourseDataUrl(url, sourceUrl) {
    const parsedUrl = new URL(url);
    if (!isSameOrigin(url, sourceUrl)) return false;
    if (!/\/webclass\/data\//i.test(parsedUrl.pathname)) return false;
    const extension = getUrlExtension(parsedUrl.pathname);
    return extension !== "" && !NON_FILE_EXTENSIONS.has(extension);
}

function isIgnorableHref(href) {
    return !href || href.startsWith("#") || /^(javascript|mailto|data):/i.test(href);
}

// Resolve a raw attribute value; returns null when it cannot be a file URL.
function toCandidateUrl(rawValue, sourceUrl) {
    if (isIgnorableHref(rawValue)) return null;
    try {
        return resolveRelativeUrl(rawValue, sourceUrl);
    } catch (_) {
        return null;
    }
}

function collectAnchorCandidates(html, sourceUrl) {
    const candidates = [];
    const anchorRegex = /<a\b[^>]*>/gi;
    let match;
    while ((match = anchorRegex.exec(html)) !== null) {
        const tag = match[0];
        const url = toCandidateUrl(getTagAttribute(tag, "href"), sourceUrl);
        if (!url) continue;
        candidates.push({
            url,
            hasTargetBlank: (getTagAttribute(tag, "target") || "").toLowerCase() === "_blank",
        });
    }
    return candidates;
}

function collectEmbeddedCandidates(html, sourceUrl) {
    const candidates = [];
    let match;
    EMBED_TAG_PATTERN.lastIndex = 0;
    while ((match = EMBED_TAG_PATTERN.exec(html)) !== null) {
        const tag = match[0];
        const attribute = match[1].toLowerCase() === "object" ? "data" : "src";
        const url = toCandidateUrl(getTagAttribute(tag, attribute), sourceUrl);
        if (url) candidates.push({ url });
    }
    return candidates;
}

// Extract a real file URL from an intermediate page (loadit.php / file_down.php).
// Returns { url, reason, candidateCount } so callers can log extraction failures.
function extractFileUrlFromHtml(html, sourceUrl) {
    const anchors = collectAnchorCandidates(html, sourceUrl);
    const embedded = collectEmbeddedCandidates(html, sourceUrl);
    const candidateCount = anchors.length + embedded.length;

    // Ordered from most to least reliable. Anchors keep their historical priority.
    const strategies = [
        ["download.php", () => anchors.find((c) => isDownloadPhpUrl(c.url))],
        ["target=_blank+extension", () => anchors.find((c) => c.hasTargetBlank && hasAllowedExtension(c.url))],
        ["extension", () => anchors.find((c) => hasAllowedExtension(c.url))],
        ["embedded", () => embedded.find((c) => isSameOrigin(c.url, sourceUrl) && (isDownloadPhpUrl(c.url) || (hasAllowedExtension(c.url) && isCourseDataUrl(c.url, sourceUrl))))],
        ["course-data", () => anchors.find((c) => isCourseDataUrl(c.url, sourceUrl))],
    ];

    for (const [reason, pick] of strategies) {
        const candidate = pick();
        if (candidate) {
            return { url: candidate.url, reason, candidateCount };
        }
    }

    return {
        url: null,
        reason: candidateCount === 0 ? "no-anchors" : "no-matching-extension",
        candidateCount,
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
