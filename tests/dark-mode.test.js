const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadDarkModeHelpers() {
    const source = fs.readFileSync("extension/dark-mode.js", "utf8");
    const end = source.lastIndexOf("})();");
    const exposedSource = `${source.slice(0, end)}window.__darkModeTest = { rewriteInlineStyle, setTrackedAttribute, trackStyleMutation, restoreTrackedAttributes };\n})();`;
    const context = {
        console,
        window: null,
        chrome: {
            runtime: {
                onMessage: {
                    addListener() {},
                },
            },
        },
        BetterEclassUtils: {
            settings: {
                getSettings() {
                    return new Promise(() => {});
                },
                onSettingsChanged() {},
            },
        },
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(exposedSource, context);
    return context.window.__darkModeTest;
}

test("keeps black backgrounds and borders dark", () => {
    const { rewriteInlineStyle } = loadDarkModeHelpers();

    assert.equal(rewriteInlineStyle("background-color: black; color: white"), "background-color: black; color: white");
    assert.equal(rewriteInlineStyle("background-color: #000; color: #fff"), "background-color: #000; color: #fff");
    assert.equal(rewriteInlineStyle("border-color: #000000"), "border-color: #000000");
});

test("rewrites black text color declarations", () => {
    const { rewriteInlineStyle } = loadDarkModeHelpers();

    assert.equal(rewriteInlineStyle("color: black"), "color: #c9d1d9");
    assert.equal(rewriteInlineStyle("font-weight: bold;color:#000"), "font-weight: bold;color: #c9d1d9");
    assert.equal(rewriteInlineStyle("COLOR: #000000 !important"), "color: #c9d1d9 !important");
    assert.equal(rewriteInlineStyle("color: #0001a2"), "color: #0001a2");
});

test("rewrites white backgrounds including the trailing-semicolon form", () => {
    const { rewriteInlineStyle } = loadDarkModeHelpers();

    assert.equal(rewriteInlineStyle("background: white;"), "background: #161b22;");
    assert.equal(rewriteInlineStyle("padding: 2px; background-color: #fff"), "padding: 2px; background-color: #161b22");
    assert.equal(rewriteInlineStyle("border: 1px solid #ffffff"), "border: 1px solid #30363d");
    assert.equal(rewriteInlineStyle("border: solid white"), "border: solid #30363d");
});

test("leaves similar but different values untouched", () => {
    const { rewriteInlineStyle } = loadDarkModeHelpers();

    assert.equal(rewriteInlineStyle("background-color: whitesmoke"), "background-color: whitesmoke");
    assert.equal(rewriteInlineStyle("-webkit-background: white"), "-webkit-background: white");
    assert.equal(rewriteInlineStyle("background-color: #fff3cd"), "background-color: rgba(210, 153, 34, 0.3)");
});

class FakeElement {
    constructor(attributes = {}) {
        this.attributes = new Map(Object.entries(attributes));
        const element = this;
        this.style = {
            set backgroundColor(value) {
                element.appendStyle(`background-color: ${value};`);
            },
        };
    }

    appendStyle(declaration) {
        const current = this.getAttribute("style");
        this.setAttribute("style", current ? `${current} ${declaration}` : declaration);
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }
}

test("restores rewritten attributes and removes added style attributes", () => {
    const helpers = loadDarkModeHelpers();
    const cell = new FakeElement({ bgcolor: "#ffffff" });
    const box = new FakeElement({ style: "color: black" });

    helpers.setTrackedAttribute(cell, "bgcolor", "#161b22");
    helpers.trackStyleMutation(cell, (style) => {
        style.backgroundColor = "#161b22";
    });
    helpers.setTrackedAttribute(box, "style", "color: #c9d1d9");
    helpers.restoreTrackedAttributes();

    assert.equal(cell.getAttribute("bgcolor"), "#ffffff");
    assert.equal(cell.getAttribute("style"), null);
    assert.equal(box.getAttribute("style"), "color: black");
});

test("keeps the first original across repeated writes", () => {
    const helpers = loadDarkModeHelpers();
    const element = new FakeElement({ style: "color: black" });

    helpers.setTrackedAttribute(element, "style", "color: #c9d1d9");
    helpers.trackStyleMutation(element, (style) => {
        style.backgroundColor = "transparent";
    });
    helpers.restoreTrackedAttributes();

    assert.equal(element.getAttribute("style"), "color: black");
});

test("does not overwrite values the page changed after dark mode wrote them", () => {
    const helpers = loadDarkModeHelpers();
    const element = new FakeElement({ style: "color: black" });

    helpers.setTrackedAttribute(element, "style", "color: #c9d1d9");
    element.setAttribute("style", "display: none");
    helpers.restoreTrackedAttributes();

    assert.equal(element.getAttribute("style"), "display: none");
});

test("treats a page change between writes as the new original", () => {
    const helpers = loadDarkModeHelpers();
    const element = new FakeElement({ style: "color: black" });

    helpers.setTrackedAttribute(element, "style", "color: #c9d1d9");
    element.setAttribute("style", "color: black; display: none");
    helpers.setTrackedAttribute(element, "style", "color: #c9d1d9; display: none");
    helpers.restoreTrackedAttributes();

    assert.equal(element.getAttribute("style"), "color: black; display: none");
});
