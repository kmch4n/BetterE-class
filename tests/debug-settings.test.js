const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("debug consumers update from canonical storage changes", () => {
    const consumers = [
        "extension/attachment-opener.js",
        "extension/dark-mode.js",
        "extension/eclass-top-button.js",
        "extension/quiz-attachment-buttons.js",
        "extension/textbook-chapter-buttons.js",
        "extension/textbook-loadit-extractor.js",
    ];

    consumers.forEach((path) => {
        const source = fs.readFileSync(path, "utf8");
        assert.match(source, /onSettingsChanged/);
        assert.match(source, /changes\.debugMode/);
    });
});

test("dark mode coalesces repeated mutation scans and exposes debug metrics", () => {
    const source = fs.readFileSync("extension/dark-mode.js", "utf8");

    assert.match(source, /pendingStyleFixFrame !== null/);
    assert.match(source, /scheduleInlineStyleFix\("mutation"\)/);
    assert.match(source, /Dark mode DOM scan/);
    assert.match(source, /durationMs/);
});

test("popup no longer reloads only textbook tabs for debug changes", () => {
    const popupSource = fs.readFileSync("extension/popup.js", "utf8");

    assert.doesNotMatch(popupSource, /reloadTextbookPages/);
    assert.doesNotMatch(popupSource, /txtbk_\*\.php/);
});
