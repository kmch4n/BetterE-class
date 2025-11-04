(function addMarkAllAsReadButton() {
  // Settings
  let settings = {
    enableMarkAllAsRead: true
  };

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableMarkAllAsRead: true
      });
      settings = result;
      return result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return settings;
    }
  }

  // Listen for settings changes and action requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged') {
      settings = message.settings;
      updateButtonVisibility();
    } else if (message.type === 'executeMarkAllAsRead') {
      // Execute mark all as read action
      markAllMessagesAsRead();
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });

  // Create "すべて既読にする" button
  function createMarkAllAsReadButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '✓ すべて既読にする';
    button.id = 'betterEclassMarkAllAsRead';
    
    // Modern button styling
    Object.assign(button.style, {
      backgroundColor: '#1a73e8',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 16px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      marginLeft: '1.5em',
      marginRight: '1em',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(26, 115, 232, 0.3)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    
    // Hover effect
    button.addEventListener('mouseenter', function() {
      this.style.backgroundColor = '#1557b0';
      this.style.boxShadow = '0 4px 8px rgba(26, 115, 232, 0.4)';
      this.style.transform = 'translateY(-1px)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '#1a73e8';
      this.style.boxShadow = '0 2px 4px rgba(26, 115, 232, 0.3)';
      this.style.transform = 'translateY(0)';
    });
    
    // Active effect
    button.addEventListener('mousedown', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 1px 2px rgba(26, 115, 232, 0.3)';
    });
    
    button.addEventListener('mouseup', function() {
      this.style.transform = 'translateY(-1px)';
      this.style.boxShadow = '0 4px 8px rgba(26, 115, 232, 0.4)';
    });
    
    button.onclick = function(e) {
      e.preventDefault();
      markAllMessagesAsRead();
    };
    
    return button;
  }

  // Mark all messages as read
  function markAllMessagesAsRead() {
    try {
      // 1. Click the "select all" checkbox
      const selectAllCheckbox = document.querySelector('input[type="checkbox"][name="autochecker"]');
      if (!selectAllCheckbox) {
        console.error('Select all checkbox not found');
        return;
      }
      
      // Check if already checked, if not, click it
      if (!selectAllCheckbox.checked) {
        selectAllCheckbox.click();
      }
      
      // 2. Use requestAnimationFrame for smoother execution
      requestAnimationFrame(() => {
        // Click the "mark as read" button
        const markAsReadButton = document.querySelector('input[type="submit"][name="UNSET_UNREADFLAG"]');
        if (!markAsReadButton) {
          console.error('Mark as read button not found');
          return;
        }
        
        markAsReadButton.click();
      });
      
    } catch (error) {
      console.error('Error marking all messages as read:', error);
    }
  }

  // Insert the button into the page
  function insertButton() {
    if (!settings.enableMarkAllAsRead) {
      return;
    }

    // Find the download button
    const downloadButton = document.querySelector('input[type="submit"][name="downloadmsg"][value="ダウンロード"]');
    if (!downloadButton) {
      return;
    }

    // Check if button already exists
    if (document.getElementById('betterEclassMarkAllAsRead')) {
      return;
    }

    // Create and insert the new button
    const newButton = createMarkAllAsReadButton();
    
    // Insert after "ダウンロード" button (at the end)
    downloadButton.parentNode.insertBefore(newButton, downloadButton.nextSibling);
  }

  // Update button visibility based on settings
  function updateButtonVisibility() {
    const existingButton = document.getElementById('betterEclassMarkAllAsRead');
    
    if (settings.enableMarkAllAsRead) {
      if (!existingButton) {
        insertButton();
      }
    } else {
      if (existingButton) {
        existingButton.remove();
      }
    }
  }

  // Initialize
  async function init() {
    await loadSettings();
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insertButton);
    } else {
      insertButton();
    }
  }

  init();
})();

