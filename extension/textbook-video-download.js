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

    // "第2節「統計学と確率論」", used to point at a section in error messages.
    function sectionLabel(page) {
        const title = getRowTitle(page.page);
        return title ? `第${page.page}節「${title}」` : `第${page.page}節`;
    }

    function getMaterialTitle() {
        const parts = Array.from(document.querySelectorAll("#WsTitle"))
            .map((element) => element.textContent.replace(/^\s*>\s*/, "").trim())
            .filter(Boolean);
        return parts.join("_");
    }

    function getPanel() {
        return (window.BetterEclassUtils && window.BetterEclassUtils.textbookPanel) || null;
    }

    function notify(tone, text) {
        const panel = getPanel();
        if (panel) {
            panel.showMessage(tone, text);
        } else if (tone === "error") {
            alert(text);
        }
    }

    function reportProgress({ phase, ratio }, sectionCount) {
        const panel = getPanel();
        if (!panel) return;
        if (phase === "convert") {
            panel.showProgress({ text: "MP4に変換して検証しています…" });
        } else {
            const target = sectionCount > 1 ? `動画${sectionCount}本` : "動画";
            panel.showProgress({ ratio, text: `${target}を取得しています ${Math.floor(ratio * 100)}%` });
        }
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
            notify("error", "別の動画を保存しています。完了してから再度お試しください。");
            return;
        }
        if (!hlsMp4 || pages.length === 0) {
            notify("error", "ダウンロードできる動画が見つかりませんでした。");
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

        const panel = getPanel();
        busy = true;
        if (panel) {
            panel.clearMessage();
            panel.setButtonState(button, "busy");
        }
        let outcome = "idle";
        try {
            reportProgress({ phase: "fetch", ratio: 0 }, pages.length);
            const blob = await hlsMp4.downloadAsMp4(
                pages.map((page) => page.manifestUrl),
                (progress) => reportProgress(progress, pages.length),
                { labels: pages.map(sectionLabel) },
            );

            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                hlsMp4.saveBlob(blob, mp4Name);
            }
            outcome = "success";
            notify("success", `保存しました: ${mp4Name}`);
        } catch (error) {
            console.error("[BetterE-class] Video download failed:", error);
            outcome = "error";
            notify("error", `動画を保存できませんでした。${error && error.message ? error.message : error}`);
        } finally {
            busy = false;
            if (panel) {
                panel.hideProgress();
                panel.setButtonState(button, outcome);
            }
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
        const panel = getPanel();
        if (panel) panel.setMergeAction(null);
    }

    function ensureMergeButton() {
        const panel = getPanel();
        if (!panel || document.getElementById(MERGE_BUTTON_ID)) return;
        const videoPages = getVideoPages();
        if (videoPages.length < 2) return;

        const button = panel.createButton({
            icon: "merge",
            label: `全${videoPages.length}本を結合して保存`,
            title: `この教材の動画${videoPages.length}本を順番に結合し、1つのMP4として保存します`,
            variant: "primary",
            onClick: () => {
                const pages = getVideoPages();
                downloadPages(pages, { filename: getMaterialTitle() || pages[0].title, button });
            },
        });
        button.id = MERGE_BUTTON_ID;
        panel.setMergeAction(button);
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
