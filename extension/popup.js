// Default settings
// Most features are always enabled, only schedule display options are configurable
const DEFAULT_SETTINGS = {
  enableDarkMode: false,
  hideSaturday: false,
  hide67thPeriod: false,
  enableTocSidebar: true,
  enableAvailableMaterials: true
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
    // Save to both local (for speed) and sync (for cross-device sync)
    await Promise.all([
      chrome.storage.local.set(settings),
      chrome.storage.sync.set(settings)
    ]);
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
  // Set version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = `v${manifest.version}`;

  // Load and set settings
  const settings = await loadSettings();
  document.getElementById('enableDarkMode').checked = settings.enableDarkMode;
  document.getElementById('hideSaturday').checked = settings.hideSaturday;
  document.getElementById('hide67thPeriod').checked = settings.hide67thPeriod;
  document.getElementById('enableTocSidebar').checked = settings.enableTocSidebar;
  document.getElementById('enableAvailableMaterials').checked = settings.enableAvailableMaterials;
}

// Setup event listeners
function setupEventListeners() {
  const enableDarkModeEl = document.getElementById('enableDarkMode');
  const hideSaturdayEl = document.getElementById('hideSaturday');
  const hide67thPeriodEl = document.getElementById('hide67thPeriod');
  const enableTocSidebarEl = document.getElementById('enableTocSidebar');
  const enableAvailableMaterialsEl = document.getElementById('enableAvailableMaterials');

  enableDarkModeEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableDarkMode = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? '設定を保存しました' : '設定の保存に失敗しました', success);

    // Notify dark mode script
    notifyDarkMode(settings);
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

  enableTocSidebarEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableTocSidebar = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? '設定を保存しました' : '設定の保存に失敗しました', success);
  });

  enableAvailableMaterialsEl.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.enableAvailableMaterials = e.target.checked;

    const success = await saveSettings(settings);
    showStatus(success ? '設定を保存しました' : '設定の保存に失敗しました', success);
  });
}

// Helper: send a message without throwing on older Chrome (Promise/callback safe)
function sendMessageSafe(tabId, message) {
  try {
    const maybePromise = chrome.tabs.sendMessage(tabId, message, () => {
      // Swallow callback errors silently
      void chrome.runtime.lastError;
    });
    // If Promise is returned (modern Chrome), attach a catch to swallow errors
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise.catch(() => {});
    }
  } catch (_) {
    // Ignore if API throws synchronously
  }
}

// Notify dark mode content script
async function notifyDarkMode(settings) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://eclass.doshisha.ac.jp/*' });
    for (const tab of tabs) {
      sendMessageSafe(tab.id, {
        type: 'darkModeSettingChanged',
        settings: { enableDarkMode: settings.enableDarkMode }
      });
    }
  } catch (error) {
    console.error('Failed to notify dark mode:', error);
  }
}

// Notify schedule customizer content script
async function notifyScheduleCustomizer(settings) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://eclass.doshisha.ac.jp/webclass/*' });
    for (const tab of tabs) {
      sendMessageSafe(tab.id, {
        type: 'scheduleSettingsChanged',
        settings: {
          hideSaturday: settings.hideSaturday,
          hide67thPeriod: settings.hide67thPeriod
        }
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
