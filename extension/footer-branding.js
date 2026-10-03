// footer-branding.js
// Adds BetterE-class branding to the footer

(function () {
    "use strict";

    console.log("[BetterE-class] Footer branding script initialized");

    // Get version from manifest
    const version = chrome.runtime.getManifest().version;

    // Find the footer message
    const footerMessage = document.querySelector(".ft-footer_message");

    if (!footerMessage) {
        return;
    }

    // Add BetterE-class branding as a quiet link that inherits the footer's colour,
    // matching "Powered by WebClass" next to it.
    const link = document.createElement("a");
    link.href = "https://github.com/kmch4n/BetterE-class";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `BetterE-class v${version}`;
    link.title = "BetterE-class - E-classを便利にする拡張機能";
    link.style.color = "inherit";

    footerMessage.append(" | ", link);
})();
