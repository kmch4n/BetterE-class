// button-factory.js
// Shared utility for creating styled buttons with consistent appearance

(function() {
  'use strict';

  /**
   * Create a styled button with icon and text
   * @param {Object} options - Button configuration
   * @param {string} options.icon - Emoji icon to display
   * @param {string} options.text - Button text
   * @param {string} options.backgroundColor - Background color (default: #4a90e2)
   * @param {string} options.hoverBackgroundColor - Hover background color (default: #357abd)
   * @param {Function} options.onClick - Click event handler
   * @returns {HTMLButtonElement} Styled button element
   */
  function createStyledButton(options) {
    const {
      icon,
      text,
      backgroundColor = '#4a90e2',
      hoverBackgroundColor = '#357abd',
      onClick
    } = options;

    // Create button element
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: ${backgroundColor};
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.2s ease;
      cursor: pointer;
      border: none;
    `.replace(/\s+/g, ' ').trim();

    // Create icon span
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '14px';

    // Create text span
    const textSpan = document.createElement('span');
    textSpan.textContent = text;

    // Append elements
    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Add click handler if provided
    if (onClick && typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    }

    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.background = hoverBackgroundColor;
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = backgroundColor;
    });

    return button;
  }

  /**
   * Create a download button (blue theme)
   * @param {string} icon - Emoji icon
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement}
   */
  function createDownloadButton(icon, text, onClick) {
    return createStyledButton({
      icon,
      text,
      backgroundColor: '#4a90e2',
      hoverBackgroundColor: '#357abd',
      onClick
    });
  }

  /**
   * Create a save-as button (green theme)
   * @param {string} icon - Emoji icon
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement}
   */
  function createSaveAsButton(icon, text, onClick) {
    return createStyledButton({
      icon,
      text,
      backgroundColor: '#52c41a',
      hoverBackgroundColor: '#389e0d',
      onClick
    });
  }

  /**
   * Create a preview button (orange theme)
   * @param {string} icon - Emoji icon
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement}
   */
  function createPreviewButton(icon, text, onClick) {
    return createStyledButton({
      icon,
      text,
      backgroundColor: '#ff9800',
      hoverBackgroundColor: '#f57c00',
      onClick
    });
  }

  // Export to global scope for use in content scripts
  window.BetterEclassUtils = window.BetterEclassUtils || {};
  window.BetterEclassUtils.createStyledButton = createStyledButton;
  window.BetterEclassUtils.createDownloadButton = createDownloadButton;
  window.BetterEclassUtils.createSaveAsButton = createSaveAsButton;
  window.BetterEclassUtils.createPreviewButton = createPreviewButton;
})();
