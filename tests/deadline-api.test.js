const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadDeadlines(fetchImpl = async () => ({ ok: true, json: async () => [] })) {
    const context = { URL, Intl, AbortController, setTimeout, clearTimeout, location: { origin: "https://eclass.example.test" }, fetch: fetchImpl };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/utils/deadline-api.js", "utf8"), context);
    return context.BetterEclassUtils.deadlines;
}

const NOW = new Date("2026-10-03T12:00:00+09:00");

function content(overrides) {
    return {
        contents_id: "c1",
        contents_name: "第２回　提出課題",
        start_date: "2026-10-02 12:00:00",
        end_date: "2026-10-09 12:00:59",
        hidden_content: false,
        scores: [{ answer_datetime: null }],
        ...overrides,
    };
}

test("parses e-class server time as JST", () => {
    const { parseServerDate } = loadDeadlines();
    assert.equal(parseServerDate("2026-10-09 12:00:59").toISOString(), "2026-10-09T03:00:59.000Z");
    assert.equal(parseServerDate(""), null);
    assert.equal(parseServerDate(null), null);
    assert.equal(parseServerDate("10/9 12:00"), null);
});

test("keeps open tasks due within seven days, nearest first", () => {
    const { selectApproachingTasks } = loadDeadlines();
    const tasks = selectApproachingTasks(
        [
            content({ contents_id: "later", end_date: "2026-10-08 23:59:59" }),
            content({ contents_id: "soon", end_date: "2026-10-04 09:00:00" }),
            content({ contents_id: "too-far", end_date: "2026-10-20 12:00:00" }),
            content({ contents_id: "not-open", start_date: "2026-10-05 00:00:00", end_date: "2026-10-06 00:00:00" }),
            content({ contents_id: "past", end_date: "2026-10-01 00:00:00" }),
            content({ contents_id: "hidden", hidden_content: true }),
            content({ contents_id: "no-deadline", end_date: null }),
        ],
        NOW,
    );
    assert.deepEqual(
        tasks.map((task) => task.id),
        ["soon", "later"],
    );
});

test("flags submitted tasks instead of dropping them", () => {
    const { selectApproachingTasks } = loadDeadlines();
    const [task] = selectApproachingTasks([content({ scores: [{ answer_datetime: "2026-10-03 10:00:00" }] })], NOW);
    assert.equal(task.submitted, true);
});

test("ignores malformed responses", () => {
    const { selectApproachingTasks } = loadDeadlines();
    assert.equal(selectApproachingTasks(null, NOW).length, 0);
    assert.equal(selectApproachingTasks([null, "x", content({ contents_name: "" })], NOW).length, 0);
});

test("formats remaining time and due date", () => {
    const { formatRemaining, formatDue } = loadDeadlines();
    const minute = 60 * 1000;
    assert.equal(formatRemaining(0), "締切を過ぎました");
    assert.equal(formatRemaining(30 * 1000), "あと1分");
    assert.equal(formatRemaining(45 * minute), "あと45分");
    assert.equal(formatRemaining(5 * 60 * minute), "あと5時間");
    assert.equal(formatRemaining(6 * 24 * 60 * minute), "あと6日");
    assert.equal(formatRemaining((2 * 24 + 3) * 60 * minute), "あと2日3時間");
    assert.equal(formatDue(new Date("2026-10-09T12:00:59+09:00")), "10/9(金) 12:00");
});

test("requests the course's contents and rejects non-numeric course IDs", async () => {
    let requested = null;
    const { fetchApproachingTasks } = loadDeadlines(async (url, options) => {
        requested = { url, options };
        return { ok: true, json: async () => [content({})] };
    });
    const tasks = await fetchApproachingTasks("2616002335055", NOW);
    assert.equal(requested.url, "https://eclass.example.test/webclass/ip_mods.php/plugin/score_summary_table/contents?group_id=2616002335055");
    assert.equal(requested.options.credentials, "same-origin");
    assert.equal(tasks.length, 1);
    await assert.rejects(fetchApproachingTasks("../x", NOW));
});

test("rejects failed or unexpected responses", async () => {
    const failing = loadDeadlines(async () => ({ ok: false, status: 500, json: async () => [] }));
    await assert.rejects(failing.fetchApproachingTasks("1", NOW));
    const wrongShape = loadDeadlines(async () => ({ ok: true, json: async () => ({ error: "x" }) }));
    await assert.rejects(wrongShape.fetchApproachingTasks("1", NOW));
});
