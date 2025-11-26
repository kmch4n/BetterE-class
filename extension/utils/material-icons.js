// material-icons.js
// Shared utility for mapping material types to emoji icons

(function() {
  'use strict';

  /**
   * Get emoji icon for material type
   * @param {string} materialType - The type of material (資料, 試験, レポート, etc.)
   * @returns {string} Emoji icon corresponding to the material type
   */
  function getMaterialTypeIcon(materialType) {
    const typeMap = {
      '資料': '📚',
      '試験': '✏️',
      'レポート': '📋',
      'レポート(成績非公開)': '📋',
      'アンケート': '📊',
      '掲示板': '💬',
      '教材': '📎',
      'リンク': '🔗',
      '動画': '🎥'
    };

    return typeMap[materialType] || '📌';
  }

  // Export to global scope for use in content scripts
  window.BetterEclassUtils = window.BetterEclassUtils || {};
  window.BetterEclassUtils.getMaterialTypeIcon = getMaterialTypeIcon;
})();
