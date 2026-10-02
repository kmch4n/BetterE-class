const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("popup exposes every user-facing default setting", () => {
    const popupHtml = fs.readFileSync("extension/popup.html", "utf8");
    const userFacingSettings = [
        "enableNewTab",
        "enableAttachmentTab",
        "enableDirectDownload",
        "enableVideoAutoAdvance",
        "preventMessagePopup",
        "enableDeadlineHighlight",
        "enableTocSidebar",
        "enableAvailableMaterials",
        "hideSaturday",
        "hide67thPeriod",
        "enableDarkMode",
        "debugMode",
    ];

    userFacingSettings.forEach((key) => {
        assert.match(popupHtml, new RegExp(`id=["']${key}["']`));
    });
});
