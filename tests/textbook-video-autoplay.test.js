const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadAutoplayHelpers() {
    const source = fs.readFileSync("extension/textbook-video-autoplay.js", "utf8");
    const exposedSource = source.replace(
        /\n\s*if \(!settingsAPI\) return;/,
        "\n    window.__videoAutoplayTest = { findNextPageNumber, decideEndedAction };\n    if (!settingsAPI) return;",
    );
    const context = {
        Number,
        console,
        window: null,
    };
    context.window = context;
    context.location = {
        pathname: "/webclass/other.php",
        origin: "https://eclass.doshisha.ac.jp",
    };
    vm.createContext(context);
    vm.runInContext(exposedSource, context);
    return context.window.__videoAutoplayTest;
}

test("finds the next section number in numeric order", () => {
    const { findNextPageNumber } = loadAutoplayHelpers();

    assert.equal(findNextPageNumber("1", ["1", "2", "3"]), 2);
    assert.equal(findNextPageNumber("2", ["10", "3", "2", "1"]), 3);
    assert.equal(findNextPageNumber("3", ["1", "2", "3"]), null);
    assert.equal(findNextPageNumber(null, ["1", "2"]), null);
});

test("does nothing after a video ends while auto-advance is disabled", () => {
    const { decideEndedAction } = loadAutoplayHelpers();
    const result = decideEndedAction({ enabled: false, index: 0, count: 1, nextPage: 2 });

    assert.equal(result.action, "none");
});

test("plays the next video on the same page before moving on", () => {
    const { decideEndedAction } = loadAutoplayHelpers();
    const result = decideEndedAction({ enabled: true, index: 0, count: 2, nextPage: 2 });

    assert.equal(result.action, "playIndex");
    assert.equal(result.index, 1);
});

test("moves to the next section after the last video on the page", () => {
    const { decideEndedAction } = loadAutoplayHelpers();
    const result = decideEndedAction({ enabled: true, index: 1, count: 2, nextPage: 3 });

    assert.equal(result.action, "goPage");
    assert.equal(result.page, 3);
});

test("stops after the last video of the last section", () => {
    const { decideEndedAction } = loadAutoplayHelpers();
    const result = decideEndedAction({ enabled: true, index: 0, count: 1, nextPage: null });

    assert.equal(result.action, "none");
});
