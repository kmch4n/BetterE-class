// Intercept window.open calls to prevent popup windows for message tool
(function preventMessagePopup() {
  // Settings
  let settings = {
    preventMessagePopup: true
  };

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        preventMessagePopup: true
      });
      settings = result;
      return result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return settings;
    }
  }

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged') {
      settings = message.settings;
    }
  });

  // Save original window.open
  const originalWindowOpen = window.open;

  // Override filedownload function used in quiz/survey pages
  window.filedownload = function(url) {
    if (!settings.preventMessagePopup) {
      // Use original popup behavior
      return originalWindowOpen.call(window, url, "download",
        "toolbar=no,location=no,directories=no,status=yes,menubar=no,scrollbars=yes,resizable=yes,width=320,height=250");
    }
    // Open in new tab instead
    return originalWindowOpen.call(window, url, '_blank');
  };

  // Override window.open
  window.open = function(url, target, features) {
    // If feature is disabled, use original behavior
    if (!settings.preventMessagePopup) {
      return originalWindowOpen.call(window, url, target, features);
    }

    // If features contain popup-like properties (width, height, toolbar=no, etc.)
    // and it's an e-class URL, open in a new tab instead
    if (features && typeof features === 'string') {
      const hasPopupFeatures = /width=|height=|toolbar=no|menubar=no|location=no/.test(features);
      const isEclassUrl = url && (url.includes('eclass.doshisha.ac.jp') || url.startsWith('/'));
      
      if (hasPopupFeatures && isEclassUrl) {
        // Open in a new tab instead of popup window
        return originalWindowOpen.call(window, url, '_blank');
      }
    }

    // Otherwise, use original behavior
    return originalWindowOpen.call(window, url, target, features);
  };

  // Override onclick handlers that use openMessageWindow, openMessage, or filedownload
  function interceptOnclickHandlers() {
    document.addEventListener('click', function(e) {
      if (!settings.preventMessagePopup) return;

      const target = e.target.closest('[onclick]');
      if (!target) return;

      const onclickAttr = target.getAttribute('onclick');
      if (!onclickAttr) return;

      // Check if it's calling openMessageWindow or openMessage
      const messageWindowMatch = onclickAttr.match(/openMessageWindow\s*\(\s*['"]([^'"]+)['"]/);
      const messageMatch = onclickAttr.match(/openMessage\s*\(\s*['"]([^'"]+)['"]/);
      const filedownloadMatch = onclickAttr.match(/filedownload\s*\(\s*['"]([^'"]+)['"]/);

      if (messageWindowMatch || messageMatch || filedownloadMatch) {
        e.preventDefault();
        e.stopPropagation();

        const url = messageWindowMatch ? messageWindowMatch[1]
                  : messageMatch ? messageMatch[1]
                  : filedownloadMatch[1];
        window.open(url, '_blank');
        return false;
      }
    }, true);
  }

  // Initialize
  loadSettings().then(() => {
    interceptOnclickHandlers();
  });
})();
