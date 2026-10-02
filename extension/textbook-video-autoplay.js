// textbook-video-autoplay.js
// Plays every video section of a textbook in sequence.
// The chapter frame (txtbk_show_chapter.php) persists across section changes, so it acts as the
// controller. The content frame (txtbk_show_text.php) reports video events and plays on request.

(function () {
    "use strict";

    const MESSAGE_TYPES = {
        READY: "betterEclass_videoReady",
        ENDED: "betterEclass_videoEnded",
        PLAY: "betterEclass_videoPlay",
    };
    const CHAPTER_FRAME_NAME = "webclass_chapter";
    const CONTENT_FRAME_NAME = "webclass_content";
    const PENDING_TIMEOUT_MS = 30000;
    const VIDEO_WAIT_TIMEOUT_MS = 10000;
    const MUTED_NOTICE_ID = "betterEclass-video-muted-notice";

    const settingsAPI = window.BetterEclassUtils && window.BetterEclassUtils.settings;
    let DEBUG = false;

    function log(...args) {
        if (DEBUG) console.log("[BetterE-class] [VideoAutoplay]", ...args);
    }

    /**
     * Return the first page number after the current one, or null when the current page is last.
     * @param {string|number} currentPage
     * @param {Array<string|number>} pageNumbers
     * @returns {number|null}
     */
    function findNextPageNumber(currentPage, pageNumbers) {
        if (currentPage === null || currentPage === undefined || currentPage === "") return null;
        const current = Number(currentPage);
        if (!Number.isFinite(current)) return null;
        const later = pageNumbers
            .map(Number)
            .filter((page) => Number.isFinite(page) && page > current)
            .sort((a, b) => a - b);
        return later.length > 0 ? later[0] : null;
    }

    /**
     * Decide what to do after a video finishes.
     * @param {{enabled: boolean, index: number, count: number, nextPage: number|null}} state
     * @returns {{action: "none"} | {action: "playIndex", index: number} | {action: "goPage", page: number}}
     */
    function decideEndedAction({ enabled, index, count, nextPage }) {
        if (!enabled) return { action: "none" };
        if (Number.isInteger(index) && Number.isInteger(count) && index + 1 < count) {
            return { action: "playIndex", index: index + 1 };
        }
        if (nextPage !== null && nextPage !== undefined) {
            return { action: "goPage", page: nextPage };
        }
        return { action: "none" };
    }

    function findFrameByName(name) {
        try {
            const sibling = window.parent && window.parent !== window ? window.parent.frames[name] : null;
            if (sibling) return sibling;
        } catch (_) {
            // Fall back to a full search below.
        }

        const stack = [window.top];
        while (stack.length > 0) {
            const current = stack.pop();
            try {
                for (let i = 0; i < current.frames.length; i++) {
                    const child = current.frames[i];
                    try {
                        if (child.name === name) return child;
                    } catch (_) {
                        // Cross-origin frame; skip its name.
                    }
                    stack.push(child);
                }
            } catch (_) {
                // Cross-origin frame; skip its children.
            }
        }
        return null;
    }

    function isTrustedMessage(event, expectedSource) {
        return event.origin === window.location.origin && expectedSource !== null && event.source === expectedSource;
    }

    // ===== Chapter frame: controller =====

    function initChapterController() {
        let enabled = false;
        let pendingPage = null;
        let pendingTimer = null;

        const getContentWindow = () => findFrameByName(CONTENT_FRAME_NAME);

        function getCurrentPageNumber() {
            const row = document.querySelector("#TOCLayout tr.bkkhaki[data-page]");
            return row ? row.getAttribute("data-page") : null;
        }

        function getPageNumbers() {
            return Array.from(document.querySelectorAll("#TOCLayout tr[data-page]")).map((row) =>
                row.getAttribute("data-page"),
            );
        }

        function clearPending() {
            pendingPage = null;
            if (pendingTimer) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
        }

        function goToPage(page) {
            const row = document.querySelector(`#TOCLayout tr[data-page="${page}"]`);
            const pageButton = row && row.querySelector('input[onclick^="gopage"]');
            if (!pageButton) {
                log("Page button not found:", page);
                return false;
            }

            clearPending();
            pendingPage = String(page);
            // A section without a video never reports READY; drop the request so a later manual
            // visit does not start playing unexpectedly.
            pendingTimer = setTimeout(clearPending, PENDING_TIMEOUT_MS);
            pageButton.click();
            log("Moved to page", page);
            return true;
        }

        function postToContent(message) {
            const contentWindow = getContentWindow();
            if (contentWindow) contentWindow.postMessage(message, window.location.origin);
        }

        window.addEventListener("message", (event) => {
            const data = event.data;
            if (!data || !Object.values(MESSAGE_TYPES).includes(data.type)) return;
            if (!isTrustedMessage(event, getContentWindow())) return;

            if (data.type === MESSAGE_TYPES.READY) {
                if (enabled && pendingPage !== null && pendingPage === getCurrentPageNumber()) {
                    clearPending();
                    postToContent({ type: MESSAGE_TYPES.PLAY, index: 0 });
                    log("Requested autoplay on page", getCurrentPageNumber());
                }
                return;
            }

            if (data.type === MESSAGE_TYPES.ENDED) {
                const decision = decideEndedAction({
                    enabled,
                    index: data.index,
                    count: data.count,
                    nextPage: findNextPageNumber(getCurrentPageNumber(), getPageNumbers()),
                });
                log("Video ended:", data, decision);

                if (decision.action === "playIndex") {
                    postToContent({ type: MESSAGE_TYPES.PLAY, index: decision.index });
                } else if (decision.action === "goPage") {
                    goToPage(decision.page);
                }
            }
        });

        settingsAPI.getSettings(["enableVideoAutoAdvance", "debugMode"]).then((items) => {
            enabled = Boolean(items.enableVideoAutoAdvance);
            DEBUG = Boolean(items.debugMode);
        });

        settingsAPI.onSettingsChanged((changes) => {
            if (changes.enableVideoAutoAdvance) {
                enabled = Boolean(changes.enableVideoAutoAdvance.newValue);
                if (!enabled) clearPending();
            }
            if (changes.debugMode) DEBUG = Boolean(changes.debugMode.newValue);
        });
    }

    // ===== Content frame: player =====

    function initContentPlayer() {
        const getChapterWindow = () => findFrameByName(CHAPTER_FRAME_NAME);
        const getVideos = () => Array.from(document.querySelectorAll("video"));
        let readySent = false;

        function postToChapter(message) {
            const chapterWindow = getChapterWindow();
            if (chapterWindow) chapterWindow.postMessage(message, window.location.origin);
        }

        function showMutedNotice(video) {
            if (document.getElementById(MUTED_NOTICE_ID)) return;
            const notice = document.createElement("div");
            notice.id = MUTED_NOTICE_ID;
            notice.setAttribute("role", "status");
            notice.textContent = "ブラウザの自動再生制限により、ミュートで再生しています。音声はプレーヤーで戻してください。";
            notice.style.cssText = "margin:4px 0;padding:4px 8px;font-size:12px;background:#fff3cd;color:#664d03;";
            video.insertAdjacentElement("afterend", notice);
            video.addEventListener("volumechange", function onVolumeChange() {
                if (!video.muted) {
                    notice.remove();
                    video.removeEventListener("volumechange", onVolumeChange);
                }
            });
        }

        async function playVideo(video) {
            try {
                await video.play();
            } catch (error) {
                if (error && error.name === "NotAllowedError") {
                    video.muted = true;
                    try {
                        await video.play();
                        showMutedNotice(video);
                    } catch (mutedError) {
                        console.warn("[BetterE-class] Video autoplay failed:", mutedError);
                    }
                } else {
                    console.warn("[BetterE-class] Video autoplay failed:", error);
                }
            }
        }

        function sendReady() {
            if (readySent) return;
            readySent = true;
            postToChapter({ type: MESSAGE_TYPES.READY, count: getVideos().length });
        }

        function bindVideos() {
            const videos = getVideos();
            videos.forEach((video) => {
                if (video.dataset.betterEclassAutoplayBound) return;
                video.dataset.betterEclassAutoplayBound = "true";
                video.addEventListener("ended", () => {
                    const current = getVideos();
                    postToChapter({
                        type: MESSAGE_TYPES.ENDED,
                        index: current.indexOf(video),
                        count: current.length,
                    });
                });
            });

            // The page script pauses on MANIFEST_PARSED, which precedes loadedmetadata,
            // so reporting READY after metadata keeps that pause from cancelling autoplay.
            const first = videos[0];
            if (!first) return false;
            if (first.readyState >= HTMLMediaElement.HAVE_METADATA) {
                sendReady();
            } else {
                first.addEventListener("loadedmetadata", sendReady, { once: true });
            }
            return true;
        }

        window.addEventListener("message", (event) => {
            const data = event.data;
            if (!data || data.type !== MESSAGE_TYPES.PLAY) return;
            if (!isTrustedMessage(event, getChapterWindow())) return;

            const video = getVideos()[data.index];
            if (video) playVideo(video);
        });

        if (bindVideos()) return;

        // Some layouts insert the player after document_end.
        const observer = new MutationObserver(() => {
            if (bindVideos()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), VIDEO_WAIT_TIMEOUT_MS);
    }

    if (!settingsAPI) return;

    if (window.location.pathname.includes("/txtbk_show_chapter.php")) {
        initChapterController();
    } else if (window.location.pathname.includes("/txtbk_show_text.php")) {
        initContentPlayer();
    }
})();
