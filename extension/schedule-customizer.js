// Customize the course schedule table (hide Saturday and 6-7th period)
(function scheduleCustomizer() {
  // Settings
  let settings = {
    hideSaturday: false,
    hide67thPeriod: false
  };

  // Load settings from chrome.storage
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        hideSaturday: false,
        hide67thPeriod: false
      });
      settings = result;
      return result;
    } catch (error) {
      console.error('Failed to load schedule settings:', error);
      return settings;
    }
  }

  // Hide Saturday column
  function applySaturdayVisibility() {
    const table = document.querySelector('#schedule-table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    const saturdayIndex = Array.from(headers).findIndex(th => th.textContent.includes('土曜日'));

    if (saturdayIndex === -1) return;

    // Hide/show Saturday column
    headers[saturdayIndex].style.display = settings.hideSaturday ? 'none' : '';

    // Hide/show Saturday cells in all rows
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[saturdayIndex]) {
        cells[saturdayIndex].style.display = settings.hideSaturday ? 'none' : '';
      }
    });
  }

  // Hide 6-7th period rows
  function apply67thPeriodVisibility() {
    const table = document.querySelector('#schedule-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const classOrder = row.getAttribute('data-class_order');
      if (classOrder === '6' || classOrder === '7') {
        row.style.display = settings.hide67thPeriod ? 'none' : '';
      }
    });
  }

  // Apply all customizations
  function applyAll() {
    applySaturdayVisibility();
    apply67thPeriodVisibility();

    console.log('[BetterE-class] Schedule customizer initialized');
  }

  // Listen for settings changes from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'scheduleSettingsChanged') {
      settings.hideSaturday = message.settings.hideSaturday || false;
      settings.hide67thPeriod = message.settings.hide67thPeriod || false;
      applyAll();
    }
  });

  // Initialize
  async function init() {
    await loadSettings();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(applyAll, 100);
      });
    } else {
      setTimeout(applyAll, 100);
    }
  }

  init();
})();
