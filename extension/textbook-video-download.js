// textbook-video-download.js
// Saves HLS-streamed textbook videos as MP4 from the chapter frame (txtbk_show_chapter.php).
// - Per-section download is used by textbook-chapter-buttons.js for stream-only pages.
// - An optional button merges every video section into one MP4.

(function () {
    "use strict";

    const MERGE_BUTTON_ID = "betterEclass-video-merge-download";
    const settingsAPI = window.BetterEclassUtils && window.BetterEclassUtils.settings;
    const hlsMp4 = window.BetterEclassUtils && window.BetterEclassUtils.hlsMp4;
    let busy = false;

    function isManifestPath(path) {
        return String(path || "")
            .split(/[?#]/)[0]
            .toLowerCase()
            .endsWith(".m3u8");
    }

    function readPageData() {
        const jsonScript = document.querySelector("script#json-data");
        if (!jsonScript) return null;
        try {
            return JSON.parse(jsonScript.textContent);
        } catch (_) {
            return null;
        }
    }

    function getRowTitle(page) {
        const row = document.querySelector(`#TOCLayout tr[data-page="${page}"]`);
        const titleNode = row && row.querySelector("td:nth-child(3) span");
        return titleNode ? titleNode.textContent.trim() : "";
    }

    /**
     * List the sections whose material is an HLS stream, in page order.
     * @returns {Array<{page: string, manifestUrl: string, title: string}>}
     */
    function getVideoPages() {
        const data = readPageData();
        const textUrls = (data && data.text_urls) || {};
        return Object.keys(textUrls)
            .sort((a, b) => Number(a) - Number(b))
            .map((page) => {
                const params = new URLSearchParams(String(textUrls[page]).split("?")[1] || "");
                const file = params.get("file") || "";
                if (!isManifestPath(file)) return null;
                const contentsUrl = params.get("contents_url") || data.contents_url || "";
                return {
                    page,
                    manifestUrl: new URL(contentsUrl + file, window.location.origin).href,
                    title: getRowTitle(page) || `section-${page}`,
                };
            })
            .filter(Boolean);
    }

    function getMaterialTitle() {
        const parts = Array.from(document.querySelectorAll("#WsTitle"))
            .map((element) => element.textContent.replace(/^\s*>\s*/, "").trim())
            .filter(Boolean);
        return parts.join("_");
    }

    function setButtonProgress(button, text) {
        if (!button) return;
        const label = button.querySelector("span:last-child") || button;
        if (!button.dataset.betterEclassOriginalLabel) {
            button.dataset.betterEclassOriginalLabel = label.textContent;
        }
        label.textContent = text;
        button.disabled = true;
        button.style.opacity = "0.7";
        button.style.cursor = "progress";
    }

    function resetButton(button) {
        if (!button) return;
        const label = button.querySelector("span:last-child") || button;
        if (button.dataset.betterEclassOriginalLabel) {
            label.textContent = button.dataset.betterEclassOriginalLabel;
            delete button.dataset.betterEclassOriginalLabel;
        }
        button.disabled = false;
        button.style.opacity = "";
        button.style.cursor = "pointer";
    }

    async function pickSaveTarget(filename) {
        if (typeof window.showSaveFilePicker !== "function") return null;
        return window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: "MP4 動画", accept: { "video/mp4": [".mp4"] } }],
        });
    }

    /**
     * Download one or more video sections as a single MP4.
     * @param {Array<{manifestUrl: string}>} pages
     * @param {{filename: string, button?: HTMLElement, saveAs?: boolean}} options
     */
    async function downloadPages(pages, { filename, button, saveAs = false }) {
        if (busy) {
            alert("動画を変換中です。完了してから再度お試しください。");
            return;
        }
        if (!hlsMp4 || pages.length === 0) {
            alert("ダウンロードできる動画が見つかりませんでした。");
            return;
        }

        const mp4Name = hlsMp4.toMp4Filename(filename);
        let fileHandle = null;
        if (saveAs) {
            // The picker needs the click's user activation, so open it before any fetch.
            try {
                fileHandle = await pickSaveTarget(mp4Name);
            } catch (error) {
                if (error && error.name === "AbortError") return;
                throw error;
            }
        }

        busy = true;
        try {
            setButtonProgress(button, "0%");
            const blob = await hlsMp4.downloadAsMp4(
                pages.map((page) => page.manifestUrl),
                ({ phase, ratio }) => {
                    setButtonProgress(button, phase === "convert" ? "変換中" : `${Math.floor(ratio * 100)}%`);
                },
            );

            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                hlsMp4.saveBlob(blob, mp4Name);
            }
        } catch (error) {
            console.error("[BetterE-class] Video download failed:", error);
            alert(`動画のダウンロードに失敗しました: ${error && error.message ? error.message : error}`);
        } finally {
            busy = false;
            resetButton(button);
        }
    }

    /**
     * Download a single section by page number.
     * @param {string} page
     * @param {{button?: HTMLElement, saveAs?: boolean}} [options]
     * @returns {boolean} false when the page is not a video section
     */
    function downloadPage(page, options = {}) {
        const target = getVideoPages().find((videoPage) => videoPage.page === String(page));
        if (!target) return false;
        downloadPages([target], { ...options, filename: target.title });
        return true;
    }

    function removeMergeButton() {
        const existing = document.getElementById(MERGE_BUTTON_ID);
        if (existing) existing.closest(".betterEclass-video-merge")?.remove();
    }

    function ensureMergeButton() {
        if (document.getElementById(MERGE_BUTTON_ID)) return;
        const videoPages = getVideoPages();
        if (videoPages.length < 2) return;

        const button = window.BetterEclassUtils.createDownloadButton("🎞️", "全動画を結合して保存", () => {
            const pages = getVideoPages();
            downloadPages(pages, { filename: getMaterialTitle() || pages[0].title, button });
        });
        button.id = MERGE_BUTTON_ID;
        button.title = `この教材の動画${videoPages.length}本を順番に結合し、1つのMP4として保存します`;

        const wrapper = document.createElement("div");
        wrapper.className = "betterEclass-video-merge";
        wrapper.style.cssText = "margin:6px 4px;";
        wrapper.appendChild(button);

        const nextButton = document.querySelector('button[onclick^="nextPage"]');
        const anchor = nextButton ? nextButton.parentElement : null;
        const tocTable = document.querySelector("#TOCLayout");
        if (anchor) {
            anchor.appendChild(wrapper);
        } else if (tocTable && tocTable.parentElement) {
            tocTable.parentElement.insertBefore(wrapper, tocTable);
        }
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.textbookVideo = { getVideoPages, downloadPage };

    if (!settingsAPI) return;

    settingsAPI.getSettings(["enableVideoMergeDownload"]).then((items) => {
        if (items.enableVideoMergeDownload) ensureMergeButton();
    });

    settingsAPI.onSettingsChanged((changes) => {
        if (!changes.enableVideoMergeDownload) return;
        if (changes.enableVideoMergeDownload.newValue) {
            ensureMergeButton();
        } else {
            removeMergeButton();
        }
    });
})();
