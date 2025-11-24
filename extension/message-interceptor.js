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

    // Check if this is a message tool navigation (msg_editor.php <-> msg_viewer.php)
    const currentIsMessagePage = window.location.href.includes('msg_editor.php') ||
                                 window.location.href.includes('msg_viewer.php');
    const targetIsMessagePage = url && (url.includes('msg_editor.php') || url.includes('msg_viewer.php'));

    // If navigating within message tool, preserve named targets (like "msgeditor")
    // or open in current tab if target is _self or empty
    if (currentIsMessagePage && targetIsMessagePage) {
      // Use named target if provided, otherwise open in current tab
      if (target && target !== '_blank' && target !== '_self' && target !== '_parent' && target !== '_top') {
        // Named target like "msgeditor" - use original behavior (reuse same window)
        return originalWindowOpen.call(window, url, target, features);
      } else {
        // Open in current tab
        window.location.href = url;
        return null;
      }
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

      // First, check for <a> tags with target attribute (msg_viewer.php links)
      const link = e.target.closest('a');
      if (link && link.href) {
        const href = link.href;
        const linkTarget = link.getAttribute('target');

        // Check if this is a message tool navigation (msg_editor.php <-> msg_viewer.php)
        const currentIsMessagePage = window.location.href.includes('msg_editor.php') ||
                                     window.location.href.includes('msg_viewer.php');
        const targetIsMessagePage = href.includes('msg_editor.php') || href.includes('msg_viewer.php');

        if (currentIsMessagePage && targetIsMessagePage) {
          // Intercept msg_viewer.php links and open in same tab
          e.preventDefault();
          e.stopPropagation();
          window.location.href = href;
          return false;
        }
      }

      // Then, check for onclick handlers
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

        // Check if this is a message tool navigation (msg_editor.php <-> msg_viewer.php)
        const currentIsMessagePage = window.location.href.includes('msg_editor.php') ||
                                     window.location.href.includes('msg_viewer.php');
        const targetIsMessagePage = url.includes('msg_editor.php') || url.includes('msg_viewer.php');

        if (currentIsMessagePage && targetIsMessagePage) {
          // Open in the current tab to avoid multiple tabs
          window.location.href = url;
        } else {
          // Open in a new tab
          window.open(url, '_blank');
        }
        return false;
      }
    }, true);
  }

  // Initialize
  loadSettings().then(() => {
    interceptOnclickHandlers();
  });
})();
