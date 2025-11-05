// Default settings
const DEFAULT_SETTINGS = {
  enableNewTab: true,
  preventMessagePopup: true,
  enableMarkAllAsRead: true,
  enableDeadlineHighlight: true,
  hideSaturday: false,
  hide67thPeriod: false,
  enableAttachmentTab: true,
  enableDirectDownload: true
};

// Load settings
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return result;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set(settings);
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

// Show status message
function showStatus(message, isSuccess = true) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${isSuccess ? 'success' : 'error'} show`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 2000);
}

// Initialize UI
async function initializeUI() {
  const settings = await loadSettings();
  document.getElementById('enableNewTab').checked = settings.enableNewTab;
  document.getElementById('preventMessagePopup').checked = settings.preventMessagePopup;
  document.getElementById('enableMarkAllAsRead').checked = settings.enableMarkAllAsRead;
  document.getElementById('enableDeadlineHighlight').checked = settings.enableDeadlineHighlight;
  document.getElementById('hideSaturday').checked = settings.hideSaturday;
  document.getElementById('hide67thPeriod').checked = settings.hide67thPeriod;
  document.getElementById('enableAttachmentTab').checked = settings.enableAttachmentTab;
  document.getElementById('enableDirectDownload').checked = settings.enableDirectDownload;
}

// Setup event listeners
function setupEventListeners() {
  const enableNewTabEl = document.getElementById('enableNewTab');
  const preventMessagePopupEl = document.getElementById('preventMessagePopup');
  const enableMarkAllAsReadEl = document.getElementById('enableMarkAllAsRead');
  const enableDeadlineHighlightEl = document.getElementById('enableDeadlineHighlight');
  const hideSaturdayEl = document.getElementById('hideSaturday');
  const hide67thPeriodEl = document.getElementById('hide67thPeriod');
  const enableAttachmentTabEl = document.getElementById('enableAttachmentTab');
  const enableDirectDownloadEl = document.getElementById('enableDirectDownload');

  enableNewTabEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableNewTab = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });

  preventMessagePopupEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.preventMessagePopup = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });

  enableMarkAllAsReadEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableMarkAllAsRead = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });

  enableDeadlineHighlightEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableDeadlineHighlight = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });

  hideSaturdayEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.hideSaturday = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify schedule customizer
    notifyScheduleCustomizer(settings);
  });

  hide67thPeriodEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.hide67thPeriod = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify schedule customizer
    notifyScheduleCustomizer(settings);
  });

  enableAttachmentTabEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableAttachmentTab = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });

  enableDirectDownloadEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableDirectDownload = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);

    // Notify content scripts
    notifyContentScripts(settings);
  });
}

// Notify schedule customizer content script
async function notifyScheduleCustomizer(settings) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://eclass.doshisha.ac.jp/webclass/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'scheduleSettingsChanged',
        settings: {
          hideSaturday: settings.hideSaturday,
          hide67thPeriod: settings.hide67thPeriod
        }
      }).catch(() => {
        // Ignore if tab doesn't respond
      });
    }
  } catch (error) {
    console.error('Failed to notify schedule customizer:', error);
  }
}

// Notify all tabs' content scripts of settings change
async function notifyContentScripts(settings) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://eclass.doshisha.ac.jp/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', settings }).catch(() => {
        // Ignore if tab doesn't respond
      });
    }
  } catch (error) {
    console.error('Failed to notify content scripts:', error);
  }
}

// Mark all messages as read action
async function executeMarkAllAsRead() {
  const button = document.getElementById('markAllAsReadAction');
  button.disabled = true;
  button.textContent = 'Processing...';
  
  try {
    // Get all tabs with e-class message page
    const tabs = await chrome.tabs.query({ 
      url: '*://eclass.doshisha.ac.jp/webclass/msg_editor.php*' 
    });
    
    if (tabs.length > 0) {
      // If message page is already open, use it
      const tab = tabs[0];
      
      // Send message to content script to execute mark all as read
      chrome.tabs.sendMessage(tab.id, { 
        type: 'executeMarkAllAsRead' 
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Please reload the message page and try again', false);
        } else {
          showStatus('All messages marked as read!', true);
        }
        button.disabled = false;
        button.textContent = '✓ Mark All Messages as Read';
      });
      
      // Focus the tab
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
      
    } else {
      // If no message page is open, open one
      const newTab = await chrome.tabs.create({
        url: 'https://eclass.doshisha.ac.jp/webclass/msg_editor.php?msgappmode=inbox',
        active: false
      });
      
      // Wait for the page to load and then execute
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Small delay to ensure content script is loaded
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { 
              type: 'executeMarkAllAsRead' 
            }, (response) => {
              if (chrome.runtime.lastError) {
                showStatus('Please try again', false);
              } else {
                showStatus('All messages marked as read!', true);
              }
              button.disabled = false;
              button.textContent = '✓ Mark All Messages as Read';
              
              // Close the tab after a short delay
              setTimeout(() => {
                chrome.tabs.remove(tabId);
              }, 1000);
            });
          }, 500);
        }
      });
      
      showStatus('Opening message page...', true);
    }
    
  } catch (error) {
    console.error('Error executing mark all as read:', error);
    showStatus('Failed to execute action', false);
    button.disabled = false;
    button.textContent = '✓ Mark All Messages as Read';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  setupEventListeners();
  
  // Setup action button
  const markAllAsReadButton = document.getElementById('markAllAsReadAction');
  markAllAsReadButton.addEventListener('click', executeMarkAllAsRead);
});
