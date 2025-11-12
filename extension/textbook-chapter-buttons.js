// textbook-chapter-buttons.js
// Adds download buttons next to chapter items in txtbk_show_chapter.php
// Supports both loadit.php (PDF preview) and file_down.php (attachments)

(function() {
  'use strict';

  let settings = {
    enableDirectDownload: true
  };

  // Load settings
  chrome.storage.sync.get({
    enableDirectDownload: true
  }, (items) => {
    settings = items;

    // Process both types of attachments
    processLoaditAttachments();
    processFileDownAttachments();
  });

  // Listen for PDF URL from loadit.php frame (for PDF preview pages)
  window.addEventListener('message', (event) => {
    const isValidOrigin = event.origin === window.location.origin ||
                          event.origin === 'https://eclass.doshisha.ac.jp';

    if (!isValidOrigin) {
      return;
    }

    if (event.data && event.data.type === 'betterEclass_pdfUrl') {
      const pdfUrl = event.data.url;
      const filename = event.data.filename;

      // Add download buttons to the row with loadit-style PDF
      addDownloadButtonsForLoadit(pdfUrl, filename);
    }
  });

  // Process file_down.php attachments (direct attachment links in chapter list)
  function processFileDownAttachments() {
    if (!settings.enableDirectDownload) {
      return;
    }

    // Find all attachment links with onclick="filedownload(...)" or target="download"
    const attachmentLinks = document.querySelectorAll('a[onclick*="filedownload"], a[target="download"]');

    attachmentLinks.forEach((link, index) => {
      try {
        // Prevent popup window - open in new tab instead
        link.setAttribute('target', '_blank');
        link.removeAttribute('onclick');

        // Also prevent default onclick behavior by replacing the onclick with null
        link.onclick = null;

        const href = link.getAttribute('href');
        if (!href || !href.includes('file_down.php')) {
          return;
        }

        // Convert relative URL to absolute URL
        let absoluteUrl = href;
        if (!href.startsWith('http')) {
          if (href.startsWith('/')) {
            absoluteUrl = window.location.origin + href;
          } else {
            absoluteUrl = window.location.origin + '/webclass/' + href;
          }
        }

        // Extract filename from URL
        const urlParams = new URLSearchParams(href.split('?')[1]);
        const filename = urlParams.get('file_name') || 'document.pdf';
        const decodedFilename = decodeURIComponent(filename);

        // Find the parent row
        const row = link.closest('tr[data-page]');
        if (!row) {
          console.warn('[BetterE-class] Could not find parent row for attachment');
          return;
        }

        // Check if buttons already exist
        if (row.querySelector('.betterEclass-chapter-download-btns')) {
          return;
        }

        // Find the cell with the attachment link
        const attachmentCell = link.closest('td');
        if (!attachmentCell) {
          return;
        }

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'betterEclass-chapter-download-btns';
        buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;';

        // Add buttons (use absolute URL for save/preview)
        buttonContainer.appendChild(createDownloadButton(absoluteUrl, decodedFilename));
        buttonContainer.appendChild(createSaveAsButton(absoluteUrl, decodedFilename));
        buttonContainer.appendChild(createPreviewButton(absoluteUrl, decodedFilename));

        attachmentCell.appendChild(buttonContainer);

      } catch (error) {
        console.error('[BetterE-class] Error processing attachment link:', error);
      }
    });
  }

  // Process loadit.php style (receives PDF URL via postMessage)
  function processLoaditAttachments() {
    // This is handled by the message listener above
  }

  // Add download buttons for loadit-style PDF (from postMessage)
  function addDownloadButtonsForLoadit(pdfUrl, filename) {
    if (!settings.enableDirectDownload || !pdfUrl) {
      return;
    }

    // Find all chapter rows in the table
    const chapterRows = document.querySelectorAll('#TOCLayout tr[data-page]');

    chapterRows.forEach((row, index) => {
      // Check if buttons already exist
      if (row.querySelector('.betterEclass-chapter-download-btns')) {
        return;
      }

      // Find the cell with the chapter title (after "第1節" etc.)
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) {
        return;
      }

      // The third cell (index 2) contains the chapter title area
      const titleCell = cells[2];

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'betterEclass-chapter-download-btns';
      buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;';

      // Add buttons
      buttonContainer.appendChild(createDownloadButton(pdfUrl, filename));
      buttonContainer.appendChild(createSaveAsButton(pdfUrl, filename));
      buttonContainer.appendChild(createPreviewButton(pdfUrl, filename));

      titleCell.appendChild(buttonContainer);
    });
  }

  function createDownloadButton(url, filename) {
    const button = document.createElement('a');
    button.href = url;
    button.download = filename || 'document.pdf';
    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #4a90e2; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '⬇️';
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'ダウンロード';

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#357abd';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#4a90e2';
    });

    return button;
  }

  function createSaveAsButton(url, filename) {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #52c41a; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer; border: none;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '💾';
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = '名前を付けて保存';

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#3da80f';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#52c41a';
    });

    // Click event to trigger Chrome download with save dialog
    button.addEventListener('click', () => {
      // Send message to background script to trigger download with dialog
      chrome.runtime.sendMessage({
        type: 'downloadWithDialog',
        url: url,
        filename: filename || 'document.pdf'
      }, (response) => {
        if (response && response.error) {
          console.error('[BetterE-class] Download error:', response.error);
        }
      });
    });

    return button;
  }

  function createPreviewButton(url, filename) {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #ff9800; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer; border: none;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '👁️';
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'プレビュー';

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e68900';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#ff9800';
    });

    // Click event to open file in new tab for preview
    button.addEventListener('click', () => {
      // Send message to background script to open preview
      chrome.runtime.sendMessage({
        type: 'previewFile',
        url: url,
        filename: filename || 'document.pdf'
      }, (response) => {
        if (response && response.error) {
          console.error('[BetterE-class] Preview error:', response.error);
        }
      });
    });

    return button;
  }

  // Monitor for changes in settings
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.enableDirectDownload) {
        settings.enableDirectDownload = changes.enableDirectDownload.newValue;
      }
    }
  });
})();
