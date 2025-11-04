// Highlight deadline warnings with RED text and warning icon
(function highlightDeadlineWarnings() {
  // Settings
  let settings = {
    enableDeadlineHighlight: true
  };

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableDeadlineHighlight: true
      });
      settings = result;
      return result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return settings;
    }
  }

  // Apply styles for deadline warnings
  function applyDeadlineStyles() {
    if (!settings.enableDeadlineHighlight) {
      removeDeadlineStyles();
      return;
    }

    // Check if style already exists
    if (document.getElementById('betterEclassDeadlineStyles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'betterEclassDeadlineStyles';
    style.textContent = `
      /* Deadline warning - RED EMPHASIS */
      .course-contents-info,
      div.course-contents-info,
      .list-group-item-text .course-contents-info,
      td .course-contents-info {
        color: #ff4444 !important;
        font-weight: bold !important;
        font-size: 110% !important;
        background-color: rgba(255, 68, 68, 0.15) !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        border: 1px solid #ff4444 !important;
        margin-top: 6px !important;
        display: inline-block !important;
        text-shadow: 0 0 2px rgba(255, 68, 68, 0.5) !important;
      }

      /* No warning icon needed */

      /* Override any inherited text color */
      .course-contents-info * {
        color: #ff4444 !important;
      }
    `;

    document.head.appendChild(style);
  }

  // Remove deadline styles
  function removeDeadlineStyles() {
    const styleElement = document.getElementById('betterEclassDeadlineStyles');
    if (styleElement) {
      styleElement.remove();
    }

    // Remove inline styles
    const deadlineWarnings = document.querySelectorAll('.course-contents-info');
    deadlineWarnings.forEach(warning => {
      warning.style.color = '';
      warning.style.fontWeight = '';
      warning.style.fontSize = '';
      warning.style.backgroundColor = '';
      warning.style.padding = '';
      warning.style.borderRadius = '';
      warning.style.border = '';
      warning.style.marginTop = '';
      warning.style.display = '';
      warning.style.textShadow = '';
    });
  }

  // Force apply styles to deadline warnings
  function forceApplyDeadlineWarnings() {
    if (!settings.enableDeadlineHighlight) {
      return;
    }

    const deadlineWarnings = document.querySelectorAll('.course-contents-info');

    deadlineWarnings.forEach(warning => {
      warning.style.color = '#ff4444';
      warning.style.fontWeight = 'bold';
      warning.style.fontSize = '110%';
      warning.style.backgroundColor = 'rgba(255, 68, 68, 0.15)';
      warning.style.padding = '4px 8px';
      warning.style.borderRadius = '4px';
      warning.style.border = '1px solid #ff4444';
      warning.style.marginTop = '6px';
      warning.style.display = 'inline-block';
      warning.style.textShadow = '0 0 2px rgba(255, 68, 68, 0.5)';
    });
  }

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged') {
      settings = message.settings;
      applyDeadlineStyles();
      forceApplyDeadlineWarnings();
    }
  });

  // Initialize
  async function init() {
    await loadSettings();
    applyDeadlineStyles();
    forceApplyDeadlineWarnings();

    // Watch for dynamically added deadline warnings
    const observer = new MutationObserver(() => {
      forceApplyDeadlineWarnings();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
