const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

async function createHarness(currentUrl = "https://eclass.doshisha.ac.jp/webclass/course.php/1") {
    let clickListener = null;
    const opened = [];
    const originalOpen = (url, target) => {
        opened.push({ url, target });
    };
    const context = {
        BetterEclassUtils: {
            settings: {
                async getSettings() {
                    return { preventMessagePopup: true };
                },
                onSettingsChanged() {},
            },
        },
        chrome: {
            storage: {
                sync: {
                    async get(defaults) {
                        return defaults;
                    },
                },
            },
        },
        console,
        document: {
            addEventListener(type, listener) {
                if (type === "click") clickListener = listener;
            },
        },
        location: { href: currentUrl },
        open: originalOpen,
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/message-interceptor.js", "utf8"), context);
    await new Promise((resolve) => setImmediate(resolve));

    return {
        click(event) {
            return clickListener(event);
        },
        context,
        opened,
        originalOpen,
    };
}

function createClickEvent({ href = "", onclick = "" }) {
    let prevented = false;
    let stopped = false;
    const link = href ? { href, getAttribute: () => null } : null;
    const onclickTarget = onclick
        ? {
              getAttribute(name) {
                  return name === "onclick" ? onclick : null;
              },
          }
        : null;

    return {
        event: {
            preventDefault() {
                prevented = true;
            },
            stopPropagation() {
                stopped = true;
            },
            target: {
                closest(selector) {
                    if (selector === "a") return link;
                    if (selector === "[onclick]") return onclickTarget;
                    return null;
                },
            },
        },
        wasPrevented: () => prevented,
        wasStopped: () => stopped,
    };
}

test("does not replace the global window.open function", async () => {
    const harness = await createHarness();

    assert.equal(harness.context.open, harness.originalOpen);
    assert.equal(harness.context.filedownload, undefined);
});

test("opens explicit message helper navigation in a normal tab", async () => {
    const harness = await createHarness();
    const click = createClickEvent({ onclick: "openMessageWindow('msg_viewer.php?id=10')" });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), true);
    assert.equal(click.wasStopped(), true);
    assert.deepEqual(harness.opened, [{ url: "msg_viewer.php?id=10", target: "_blank" }]);
});

test("keeps message-to-message navigation in the current tab", async () => {
    const harness = await createHarness("https://eclass.doshisha.ac.jp/webclass/msg_viewer.php?id=1");
    const targetUrl = "https://eclass.doshisha.ac.jp/webclass/msg_editor.php?id=2";
    const click = createClickEvent({ href: targetUrl });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), true);
    assert.equal(harness.context.location.href, targetUrl);
});

test("does not intercept quiz filedownload handlers", async () => {
    const harness = await createHarness("https://eclass.doshisha.ac.jp/webclass/qstn_frame.php");
    const click = createClickEvent({ onclick: "filedownload('file_down.php?id=1')" });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), false);
    assert.equal(click.wasStopped(), false);
    assert.equal(harness.opened.length, 0);
});

test("keeps navigation inside the new messages.php inbox in the current tab", async () => {
    const harness = await createHarness("https://eclass.doshisha.ac.jp/webclass/messages.php/inbox");
    const targetUrl = "https://eclass.doshisha.ac.jp/webclass/messages.php/inbox/abc?page=1";
    const click = createClickEvent({ href: targetUrl });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), true);
    assert.equal(harness.context.location.href, targetUrl);
});

test("opens the top-page message window helper for messages.php in a normal tab", async () => {
    const harness = await createHarness("https://eclass.doshisha.ac.jp/webclass/");
    const click = createClickEvent({ onclick: "return openMessageWindow('/webclass/messages.php/inbox')" });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), true);
    assert.deepEqual(harness.opened, [{ url: "/webclass/messages.php/inbox", target: "_blank" }]);
});

test("does not treat other pages as message pages", async () => {
    const harness = await createHarness("https://eclass.doshisha.ac.jp/webclass/messages.php/inbox");
    const click = createClickEvent({ href: "https://eclass.doshisha.ac.jp/webclass/information.php/post/1/" });

    harness.click(click.event);

    assert.equal(click.wasPrevented(), false);
});
