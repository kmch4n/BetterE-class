// Default settings
const DEFAULT_SETTINGS = {
  enableNewTab: true
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
}

// Setup event listeners
function setupEventListeners() {
  const enableNewTabEl = document.getElementById('enableNewTab');
  
  enableNewTabEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableNewTab = e.target.checked;
    
    const success = await saveSettings(settings);
    showStatus(success ? 'Settings saved' : 'Failed to save settings', success);
    
    // Notify content scripts
    notifyContentScripts(settings);
  });
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  setupEventListeners();
});
