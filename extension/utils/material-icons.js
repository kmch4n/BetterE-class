// material-icons.js
// Shared utility for mapping material types to icons

(function () {
    "use strict";

    /**
     * Get the utils/icons.js icon name for a material type
     * @param {string} materialType - The type of material (資料, 試験, レポート, etc.)
     * @returns {string} Icon name
     */
    function getMaterialTypeIconName(materialType) {
        const typeMap = {
            資料: "fileText",
            試験: "pencil",
            レポート: "clipboard",
            "レポート(成績非公開)": "clipboard",
            アンケート: "chart",
            掲示板: "message",
            教材: "paperclip",
            リンク: "link",
            動画: "video",
        };

        return typeMap[materialType] || "file";
    }

    // Export to global scope for use in content scripts
    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.getMaterialTypeIconName = getMaterialTypeIconName;
})();
