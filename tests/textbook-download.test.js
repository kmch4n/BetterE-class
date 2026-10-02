const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadDownloadHelpers() {
    const source = fs.readFileSync("extension/textbook-chapter-buttons.js", "utf8");
    const exposedSource = source.replace(
        /\}\)\(\);\s*$/,
        "window.__textbookDownloadTest = { isStreamManifestUrl, selectDownloadTarget };\n})();",
    );
    const context = {
        URL,
        Array,
        BetterEclassUtils: {
            settings: {
                getSettings() {
                    return new Promise(() => {});
                },
                onSettingsChanged() {},
            },
        },
        chrome: {
            storage: {
                sync: {
                    get() {},
                },
                onChanged: {
                    addListener() {},
                },
            },
        },
        console,
        window: null,
    };
    context.window = context;
    context.location = {
        href: "https://eclass.doshisha.ac.jp/webclass/txtbk_show_chapter.php",
        origin: "https://eclass.doshisha.ac.jp",
    };
    context.addEventListener = () => {};
    vm.createContext(context);
    vm.runInContext(exposedSource, context);
    return context.window.__textbookDownloadTest;
}

test("prefers a downloadable file over a higher-priority stream manifest", () => {
    const helpers = loadDownloadHelpers();
    const result = helpers.selectDownloadTarget({
        fileDownloadUrl: "https://eclass.doshisha.ac.jp/webclass/file_down.php?file=master.m3u8",
        fileUrl: "https://eclass.doshisha.ac.jp/webclass/data/course/lecture.mp4",
    });

    assert.equal(result.selected.source, "fileUrl");
    assert.equal(result.selected.url, "https://eclass.doshisha.ac.jp/webclass/data/course/lecture.mp4");
    assert.equal(result.streamOnly, false);
});

test("reports stream-only content when every candidate is an m3u8 manifest", () => {
    const helpers = loadDownloadHelpers();
    const result = helpers.selectDownloadTarget({
        fileDownloadUrl: "https://eclass.doshisha.ac.jp/webclass/file_down.php?file=MASTER.M3U8",
        fileUrl: "https://eclass.doshisha.ac.jp/video/master.m3u8?token=abc#play",
    });

    assert.equal(result.selected, null);
    assert.equal(result.streamOnly, true);
});
