// message-tools.js
// Adds a "すべて既読にする" button next to each message toolbar on the inbox
// (messages.php/inbox and the per-course messages.php/course/<id>/inbox).
// It checks every message on the current page and submits e-class's own "既読にする" action.

(function addMarkAllAsReadButton() {
    "use strict";

    const BUTTON_CLASS = "betterEclass-mark-all-read";

    function getMessageForm() {
        return document.getElementById("message-form") || document.querySelector("form:has(#MsgListTable)");
    }

    // Mark every message on this page as read using e-class's own form action
    function markAllMessagesAsRead(button) {
        const form = getMessageForm();
        const markAsReadButton = form && form.querySelector('[name="UNSET_UNREADFLAG"]');
        if (!markAsReadButton) {
            console.error("[BetterE-class] Mark as read button not found");
            return;
        }

        // The inbox renders the list twice (desktop table and a hidden mobile list); check the visible one
        const allCheckboxes = Array.from(form.querySelectorAll('input[type="checkbox"][name="id[]"]'));
        const visible = allCheckboxes.filter((checkbox) => checkbox.getClientRects().length > 0);
        const checkboxes = visible.length > 0 ? visible : allCheckboxes.filter((checkbox) => checkbox.closest("#MsgListTable"));
        if (checkboxes.length === 0) return;

        checkboxes.forEach((checkbox) => {
            checkbox.checked = true;
        });
        const selectAll = form.querySelector('input[type="checkbox"][name="autochecker"]');
        if (selectAll) selectAll.checked = true;

        // Prevent double submission while the page reloads
        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((element) => {
            element.disabled = true;
        });
        button.textContent = "既読にしています…";

        if (typeof form.requestSubmit === "function") {
            form.requestSubmit(markAsReadButton);
        } else {
            markAsReadButton.click();
        }
    }

    function createMarkAllAsReadButton() {
        const button = document.createElement("button");
        button.type = "button";
        // Same look as e-class's own toolbar buttons
        button.className = `btn btn-default btn-sm ${BUTTON_CLASS}`;
        button.textContent = "すべて既読にする";
        button.title = "このページのメッセージをすべて既読にします";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            markAllMessagesAsRead(button);
        });
        return button;
    }

    // The inbox has a toolbar above and below the list; add the button after each "ダウンロード"
    function insertButtons() {
        const form = getMessageForm();
        // Nothing to mark on an empty inbox
        if (!form || !form.querySelector('input[type="checkbox"][name="id[]"]')) return;

        form.querySelectorAll('[name="downloadmsg"]').forEach((downloadButton) => {
            const next = downloadButton.nextElementSibling;
            if (next && next.classList.contains(BUTTON_CLASS)) return;
            downloadButton.after(" ", createMarkAllAsReadButton());
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", insertButtons);
    } else {
        insertButtons();
    }
})();
