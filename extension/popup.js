// Default settings
// Most features are always enabled, only schedule display options are configurable
const DEFAULT_SETTINGS = {
  hideSaturday: false,
  hide67thPeriod: false
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
  document.getElementById('hideSaturday').checked = settings.hideSaturday;
  document.getElementById('hide67thPeriod').checked = settings.hide67thPeriod;
}

// Setup event listeners
function setupEventListeners() {
  const hideSaturdayEl = document.getElementById('hideSaturday');
  const hide67thPeriodEl = document.getElementById('hide67thPeriod');

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  setupEventListeners();
});
