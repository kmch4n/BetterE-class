// deadline-api.js
// Reads assignment deadlines for a course from the read-only JSON endpoint behind e-class's
// "課題実施状況一覧" dashboard, so the top page can show what is due and when.
// The endpoint is internal to e-class and may change; callers must fall back when it fails.

(function () {
    "use strict";

    const ENDPOINT = "/webclass/ip_mods.php/plugin/score_summary_table/contents";
    // e-class flags a course when an open assignment is due within 7 days (same rule as the dashboard)
    const APPROACHING_MS = 7 * 24 * 60 * 60 * 1000;
    const URGENT_MS = 24 * 60 * 60 * 1000;
    const TIMEOUT_MS = 5000;

    // "2026-10-09 12:00:59" is e-class server time (JST)
    function parseServerDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? "").trim());
        if (!match) return null;
        const [, year, month, day, hour, minute, second = "00"] = match;
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function isSubmitted(content) {
        return Array.isArray(content.scores) && content.scores.some((score) => Boolean(score && score.answer_datetime));
    }

    /**
     * Open, visible contents due within the approaching window, nearest first.
     * Submitted ones are kept (flagged) so callers can tell "all done" from "nothing found".
     */
    function selectApproachingTasks(contents, now = new Date()) {
        if (!Array.isArray(contents)) return [];
        return contents
            .filter((content) => content && typeof content === "object" && !content.hidden_content)
            .map((content) => ({
                id: String(content.contents_id ?? ""),
                name: String(content.contents_name ?? "").trim(),
                start: parseServerDate(content.start_date),
                due: parseServerDate(content.end_date),
                submitted: isSubmitted(content),
            }))
            .filter((task) => task.name && task.due && (!task.start || task.start <= now) && task.due > now && task.due - now <= APPROACHING_MS)
            .sort((a, b) => a.due - b.due);
    }

    async function fetchCourseContents(groupId) {
        if (!/^\d+$/.test(String(groupId))) throw new Error("Invalid course ID");
        const url = new URL(ENDPOINT, location.origin);
        url.searchParams.set("group_id", groupId);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url.href, { credentials: "same-origin", signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const body = await response.json();
            if (!Array.isArray(body)) throw new Error("Unexpected response shape");
            return body;
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchApproachingTasks(groupId, now = new Date()) {
        return selectApproachingTasks(await fetchCourseContents(groupId), now);
    }

    function formatRemaining(ms) {
        if (ms <= 0) return "締切を過ぎました";
        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) return `あと${Math.max(1, minutes)}分`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `あと${hours}時間`;
        const days = Math.floor(hours / 24);
        const restHours = hours % 24;
        return restHours ? `あと${days}日${restHours}時間` : `あと${days}日`;
    }

    // "10/9(金) 12:00" in e-class time
    function formatDue(date) {
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                .formatToParts(date)
                .map((part) => [part.type, part.value]),
        );
        return `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}`;
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.deadlines = { URGENT_MS, parseServerDate, selectApproachingTasks, fetchApproachingTasks, formatRemaining, formatDue };
})();
