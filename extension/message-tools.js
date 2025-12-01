// message-tools.js
// Adds "Mark All as Read" button on message page

(function addMarkAllAsReadButton() {
    "use strict";

    console.log("[BetterE-class] Message tools initialized");

    // Create "すべて既読にする" button
    function createMarkAllAsReadButton() {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "✓ すべて既読にする";
        button.id = "betterEclassMarkAllAsRead";

        // Modern button styling
        Object.assign(button.style, {
            backgroundColor: "#1a73e8",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            marginLeft: "1.5em",
            marginRight: "1em",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(26, 115, 232, 0.3)",
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        });

        // Hover effect
        button.addEventListener("mouseenter", function () {
            this.style.backgroundColor = "#1557b0";
            this.style.boxShadow = "0 4px 8px rgba(26, 115, 232, 0.4)";
            this.style.transform = "translateY(-1px)";
        });

        button.addEventListener("mouseleave", function () {
            this.style.backgroundColor = "#1a73e8";
            this.style.boxShadow = "0 2px 4px rgba(26, 115, 232, 0.3)";
            this.style.transform = "translateY(0)";
        });

        // Active effect
        button.addEventListener("mousedown", function () {
            this.style.transform = "translateY(0)";
            this.style.boxShadow = "0 1px 2px rgba(26, 115, 232, 0.3)";
        });

        button.addEventListener("mouseup", function () {
            this.style.transform = "translateY(-1px)";
            this.style.boxShadow = "0 4px 8px rgba(26, 115, 232, 0.4)";
        });

        button.onclick = function (e) {
            e.preventDefault();
            markAllMessagesAsRead();
        };

        return button;
    }

    // Mark all messages as read
    function markAllMessagesAsRead() {
        try {
            console.log("[BetterE-class] Marking all messages as read...");

            // 1. Click the "select all" checkbox
            const selectAllCheckbox = document.querySelector(
                'input[type="checkbox"][name="autochecker"]',
            );
            if (!selectAllCheckbox) {
                console.error("[BetterE-class] Select all checkbox not found");
                return;
            }

            // Check if already checked, if not, click it
            if (!selectAllCheckbox.checked) {
                selectAllCheckbox.click();
            }

            // 2. Use requestAnimationFrame for smoother execution
            requestAnimationFrame(() => {
                // Click the "mark as read" button
                const markAsReadButton = document.querySelector(
                    'input[type="submit"][name="UNSET_UNREADFLAG"]',
                );
                if (!markAsReadButton) {
                    console.error(
                        "[BetterE-class] Mark as read button not found",
                    );
                    return;
                }

                markAsReadButton.click();
                console.log("[BetterE-class] Mark all as read action executed");
            });
        } catch (error) {
            console.error(
                "[BetterE-class] Error marking all messages as read:",
                error,
            );
        }
    }

    // Insert the button into the page
    function insertButton() {
        // Find the download button
        const downloadButton = document.querySelector(
            'input[type="submit"][name="downloadmsg"][value="ダウンロード"]',
        );
        if (!downloadButton) {
            console.log(
                "[BetterE-class] Download button not found, retrying...",
            );
            return;
        }

        // Check if button already exists
        if (document.getElementById("betterEclassMarkAllAsRead")) {
            console.log(
                "[BetterE-class] Mark all as read button already exists",
            );
            return;
        }

        // Create and insert the new button
        const newButton = createMarkAllAsReadButton();

        // Insert after "ダウンロード" button (at the end)
        downloadButton.parentNode.insertBefore(
            newButton,
            downloadButton.nextSibling,
        );
        console.log(
            "[BetterE-class] Mark all as read button added successfully",
        );
    }

    // Initialize
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", insertButton);
        } else {
            insertButton();
        }
    }

    init();
})();
