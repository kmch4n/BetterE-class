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
        console.log("[BetterE-class] Footer message not found");
        return;
    }

    console.log(
        "[BetterE-class] Found footer message:",
        footerMessage.textContent,
    );

    // Add BetterE-class branding
    const betterEclassBrand = document.createElement("span");
    betterEclassBrand.textContent = ` | 🚀 BetterE-class v${version}`;
    betterEclassBrand.style.cssText = "color: #4a90e2; font-weight: 500;";

    // Optionally make it clickable to link to GitHub
    betterEclassBrand.style.cursor = "pointer";
    betterEclassBrand.title = "BetterE-class - E-classを便利にする拡張機能";

    betterEclassBrand.addEventListener("click", () => {
        console.log("[BetterE-class] Footer branding clicked");
        window.open("https://github.com/kmch4n/BetterE-class", "_blank");
    });

    footerMessage.appendChild(betterEclassBrand);

    console.log("[BetterE-class] Footer branding added successfully");
})();
