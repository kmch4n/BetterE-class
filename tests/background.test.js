const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function createBackgroundContext(fetchImplementation = async () => ({ ok: true, status: 200, text: async () => "" })) {
    const context = {
        URL,
        BetterEclassUtils: {
            settings: {
                async getSetting() {
                    return false;
                },
            },
        },
        chrome: {
            downloads: {
                download() {},
            },
            runtime: {
                lastError: null,
                onMessage: {
                    addListener(listener) {
                        context.messageListener = listener;
                    },
                },
            },
            storage: {
                local: {
                    get(defaults, callback) {
                        callback(defaults);
                    },
                },
            },
            tabs: {
                create() {},
            },
        },
        console,
        fetch: fetchImplementation,
        importScripts() {},
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/background.js", "utf8"), context);
    return context;
}

function extract(context, html, sourceUrl = "https://eclass.doshisha.ac.jp/webclass/loadit.php?id=1") {
    context.fixtureHtml = html;
    context.fixtureSourceUrl = sourceUrl;
    return vm.runInContext("extractFileUrlFromHtml(fixtureHtml, fixtureSourceUrl)", context);
}

test("resolves relative attachment URLs against the intermediate page", () => {
    const context = createBackgroundContext();
    const result = extract(
        context,
        '<a href="../data/course/report.pdf?download=1" target="_blank">Report</a>',
        "https://eclass.doshisha.ac.jp/webclass/tools/loadit.php?id=1",
    );

    assert.equal(result.url, "https://eclass.doshisha.ac.jp/webclass/data/course/report.pdf?download=1");
    assert.equal(result.reason, "target=_blank+extension");
});

test("decodes HTML entities in download links", () => {
    const context = createBackgroundContext();
    const result = extract(context, '<a href="download.php?file=report.pdf&amp;token=abc">Report</a>');

    assert.equal(result.url, "https://eclass.doshisha.ac.jp/webclass/download.php?file=report.pdf&token=abc");
    assert.equal(result.reason, "download.php");
});

test("recognizes supported office attachment formats", () => {
    const context = createBackgroundContext();
    const result = extract(context, '<a href="files/grades.xlsx">Grades</a>');

    assert.equal(result.url, "https://eclass.doshisha.ac.jp/webclass/files/grades.xlsx");
    assert.equal(result.reason, "extension");
});

test("reports why an intermediate page has no attachment candidates", () => {
    const context = createBackgroundContext();
    const result = extract(context, "<html><body>Login required</body></html>");

    assert.equal(result.url, null);
    assert.equal(result.reason, "no-anchors");
    assert.equal(result.candidateCount, 0);
});

test("rejects unsuccessful intermediate-page responses", async () => {
    const context = createBackgroundContext(async () => ({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
    }));
    context.fixtureSourceUrl = "https://eclass.doshisha.ac.jp/webclass/loadit.php?id=1";

    await assert.rejects(
        vm.runInContext("resolveActualFileUrl(fixtureSourceUrl)", context),
        /Failed to resolve file URL \(HTTP 403\)/,
    );
});

test("adds the preview marker before URL fragments", () => {
    const context = createBackgroundContext();
    context.fixtureUrl = "https://eclass.doshisha.ac.jp/webclass/files/report.pdf?download=1#page=2";

    const result = vm.runInContext("buildPreviewUrl(fixtureUrl)", context);

    assert.equal(result, "https://eclass.doshisha.ac.jp/webclass/files/report.pdf?download=1&_preview=1#page=2");
});

test("does not add preview markers to external URLs", () => {
    const context = createBackgroundContext();
    context.fixtureUrl = "https://example.test/report.pdf";

    assert.equal(vm.runInContext("buildPreviewUrl(fixtureUrl)", context), context.fixtureUrl);
});

test("preview header rule covers marked e-class URLs without affecting unmarked requests", () => {
    const rules = JSON.parse(fs.readFileSync("extension/rules.json", "utf8"));
    const previewRule = rules.find((rule) => rule.id === 2);

    assert.equal(previewRule.condition.urlFilter, "||eclass.doshisha.ac.jp/*_preview=1*");
    assert.deepEqual(previewRule.condition.resourceTypes, ["main_frame", "sub_frame"]);
});

test("recognizes stream manifests in paths and encoded query values", () => {
    const context = createBackgroundContext();
    context.pathManifest = "https://eclass.doshisha.ac.jp/video/MASTER.M3U8?token=abc#play";
    context.queryManifest = "https://eclass.doshisha.ac.jp/webclass/file_down.php?file=video%2Fmaster.m3u8";
    context.videoFile = "https://eclass.doshisha.ac.jp/video/lecture.mp4?token=abc";

    assert.equal(vm.runInContext("isStreamManifestUrl(pathManifest)", context), true);
    assert.equal(vm.runInContext("isStreamManifestUrl(queryManifest)", context), true);
    assert.equal(vm.runInContext("isStreamManifestUrl(videoFile)", context), false);
});

test("does not start a guarded download for a stream manifest", () => {
    const context = createBackgroundContext();
    let downloadStarted = false;
    let response = null;
    context.chrome.downloads.download = () => {
        downloadStarted = true;
    };

    const asynchronous = context.messageListener(
        {
            type: "downloadDirect",
            url: "https://eclass.doshisha.ac.jp/video/master.m3u8",
            filename: "master.m3u8",
            rejectStreamManifest: true,
        },
        {},
        (value) => {
            response = value;
        },
    );

    assert.equal(asynchronous, false);
    assert.equal(response.streamOnly, true);
    assert.equal(downloadStarted, false);
});
