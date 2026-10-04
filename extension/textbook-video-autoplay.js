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
        MUTE_STATE: "betterEclass_videoMuteState",
        MUTE_SYNC: "betterEclass_videoMuteSync",
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

    /**
     * Change a video's mute state from script. The change is counted so the volumechange it
     * causes is not mistaken for the user's choice.
     * @param {HTMLVideoElement} video
     * @param {boolean} muted
     */
    function setMutedByScript(video, muted) {
        if (video.muted === muted) return;
        video.dataset.betterEclassMutePending = String(Number(video.dataset.betterEclassMutePending || 0) + 1);
        video.muted = muted;
    }

    /**
     * @param {HTMLVideoElement} video
     * @returns {boolean} true when the pending volumechange came from setMutedByScript
     */
    function consumeScriptMute(video) {
        const pending = Number(video.dataset.betterEclassMutePending || 0);
        if (pending <= 0) return false;
        video.dataset.betterEclassMutePending = String(pending - 1);
        return true;
    }

    /**
     * Set a video's starting mute state once, so later changes by the user are left alone.
     * @param {HTMLVideoElement} video
     * @param {boolean} muted
     * @returns {boolean} whether this call decided the video's state
     */
    function applyStartMute(video, muted) {
        if (video.dataset.betterEclassMuteDecided) return false;
        video.dataset.betterEclassMuteDecided = "true";
        setMutedByScript(video, muted);
        return true;
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
        let muteVideos = false;
        // Last mute state the user chose; the chapter frame outlives section changes, so it carries it over.
        let lastMuted = null;
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

            if (data.type === MESSAGE_TYPES.MUTE_STATE) {
                if (typeof data.muted === "boolean") lastMuted = data.muted;
                return;
            }

            if (data.type === MESSAGE_TYPES.READY) {
                const muted = muteVideos ? true : lastMuted;
                if (muted !== null) postToContent({ type: MESSAGE_TYPES.MUTE_SYNC, muted });
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

        settingsAPI.getSettings(["enableVideoAutoAdvance", "enableVideoMute", "debugMode"]).then((items) => {
            enabled = Boolean(items.enableVideoAutoAdvance);
            muteVideos = Boolean(items.enableVideoMute);
            DEBUG = Boolean(items.debugMode);
        });

        settingsAPI.onSettingsChanged((changes) => {
            if (changes.enableVideoAutoAdvance) {
                enabled = Boolean(changes.enableVideoAutoAdvance.newValue);
                if (!enabled) clearPending();
            }
            if (changes.enableVideoMute) muteVideos = Boolean(changes.enableVideoMute.newValue);
            if (changes.debugMode) DEBUG = Boolean(changes.debugMode.newValue);
        });
    }

    // ===== Content frame: player =====

    function initContentPlayer() {
        const getChapterWindow = () => findFrameByName(CHAPTER_FRAME_NAME);
        const getVideos = () => Array.from(document.querySelectorAll("video"));
        let readySent = false;
        let muteVideos = false;
        let rememberedMuted = null;

        // The "always muted" setting wins; otherwise new videos follow the user's last choice.
        const startMuted = () => (muteVideos ? true : rememberedMuted);

        function applyStartMuteToVideos() {
            const muted = startMuted();
            if (muted === null) return;
            getVideos().forEach((video) => applyStartMute(video, muted));
        }

        function postToChapter(message) {
            const chapterWindow = getChapterWindow();
            if (chapterWindow) chapterWindow.postMessage(message, window.location.origin);
        }

        function showMutedNotice(video) {
            if (document.getElementById(MUTED_NOTICE_ID)) return;
            const notice = document.createElement("div");
            notice.id = MUTED_NOTICE_ID;
            notice.setAttribute("role", "status");
            notice.className = "bec-scope bec-notice";
            notice.textContent = "ブラウザの自動再生制限により、ミュートで再生しています。音声はプレーヤーで戻してください。";
            video.insertAdjacentElement("afterend", notice);
            video.addEventListener("volumechange", function onVolumeChange() {
                if (!video.muted) {
                    notice.remove();
                    video.removeEventListener("volumechange", onVolumeChange);
                }
            });
        }

        async function playVideo(video) {
            const muted = startMuted();
            if (muted !== null) applyStartMute(video, muted);
            try {
                await video.play();
            } catch (error) {
                if (error && error.name === "NotAllowedError") {
                    setMutedByScript(video, true);
                    try {
                        await video.play();
                        showMutedNotice(video);
                    } catch (mutedError) {
                        console.warn("[BetterE-class] Video autoplay failed:", mutedError);
                    }
                } else if (error && error.name === "AbortError") {
                    // The page paused or reloaded the video before playback started.
                    if (DEBUG) console.log("[BetterE-class] Video autoplay interrupted:", error);
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
            applyStartMuteToVideos();
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
            if (!data || (data.type !== MESSAGE_TYPES.PLAY && data.type !== MESSAGE_TYPES.MUTE_SYNC)) return;
            if (!isTrustedMessage(event, getChapterWindow())) return;

            if (data.type === MESSAGE_TYPES.MUTE_SYNC) {
                if (typeof data.muted === "boolean") {
                    rememberedMuted = data.muted;
                    applyStartMuteToVideos();
                }
                return;
            }

            const video = getVideos()[data.index];
            if (video) playVideo(video);
        });

        // Media events do not bubble, so listen in the capture phase.
        // "play" is a safety net for players inserted after the observer stops.
        document.addEventListener(
            "play",
            (event) => {
                const video = event.target;
                if (!(video instanceof HTMLVideoElement)) return;
                const muted = startMuted();
                if (muted === null) {
                    // Nothing to carry over yet; keep a late sync from changing a playing video.
                    video.dataset.betterEclassMuteDecided = "true";
                } else {
                    applyStartMute(video, muted);
                }
            },
            true,
        );

        document.addEventListener(
            "volumechange",
            (event) => {
                const video = event.target;
                if (!(video instanceof HTMLVideoElement) || consumeScriptMute(video)) return;
                if (video.muted === rememberedMuted) return;
                rememberedMuted = video.muted;
                postToChapter({ type: MESSAGE_TYPES.MUTE_STATE, muted: video.muted });
            },
            true,
        );

        settingsAPI.getSettings(["enableVideoMute"]).then((items) => {
            muteVideos = Boolean(items.enableVideoMute);
            applyStartMuteToVideos();
        });

        settingsAPI.onSettingsChanged((changes) => {
            if (!changes.enableVideoMute) return;
            muteVideos = Boolean(changes.enableVideoMute.newValue);
            applyStartMuteToVideos();
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
