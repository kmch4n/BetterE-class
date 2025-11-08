// textbook-chapter-buttons.js
// Adds download buttons next to chapter items in txtbk_show_chapter.php

(function() {
  'use strict';

  console.log('[BetterE-class] Textbook chapter buttons initialized');
  console.log('[BetterE-class] Current URL:', window.location.href);
  console.log('[BetterE-class] Is in frame:', window.self !== window.top);
  console.log('[BetterE-class] Window name:', window.name);

  let currentPdfUrl = null;
  let currentFilename = null;
  let settings = {
    enableDirectDownload: true
  };

  // Test: Send a test message to ourselves to verify message listener works
  setTimeout(() => {
    console.log('[BetterE-class] Sending test message to self...');
    window.postMessage({ type: 'test', data: 'test message' }, '*');
  }, 100);

  // Load settings
  chrome.storage.sync.get({
    enableDirectDownload: true
  }, (items) => {
    settings = items;
    console.log('[BetterE-class] Settings loaded:', settings);
  });

  // Listen for PDF URL from loadit.php frame
  window.addEventListener('message', (event) => {
    console.log('[BetterE-class] Message received:', {
      origin: event.origin,
      expectedOrigin: window.location.origin,
      data: event.data,
      source: event.source
    });

    // Security check: only accept messages from same origin OR from our own frames
    const isValidOrigin = event.origin === window.location.origin ||
                          event.origin === 'https://eclass.doshisha.ac.jp';

    if (!isValidOrigin) {
      console.warn('[BetterE-class] Message rejected - origin mismatch:', event.origin);
      return;
    }

    if (event.data && event.data.type === 'betterEclass_pdfUrl') {
      currentPdfUrl = event.data.url;
      currentFilename = event.data.filename;
      console.log('[BetterE-class] ✓ Received PDF URL:', currentPdfUrl);
      console.log('[BetterE-class] ✓ Filename:', currentFilename);

      // Add download buttons to current chapter
      addDownloadButtons();
    } else {
      console.log('[BetterE-class] Message ignored - not betterEclass_pdfUrl type, data:', event.data);
    }
  });

  function addDownloadButtons() {
    console.log('[BetterE-class] addDownloadButtons called');
    console.log('[BetterE-class] - enableDirectDownload:', settings.enableDirectDownload);
    console.log('[BetterE-class] - currentPdfUrl:', currentPdfUrl);

    if (!settings.enableDirectDownload) {
      console.warn('[BetterE-class] Direct download disabled in settings');
      return;
    }

    if (!currentPdfUrl) {
      console.warn('[BetterE-class] No PDF URL available yet');
      return;
    }

    // Find all chapter rows in the table
    const chapterRows = document.querySelectorAll('#TOCLayout tr[data-page]');
    console.log('[BetterE-class] Found chapter rows:', chapterRows.length);

    if (chapterRows.length === 0) {
      console.warn('[BetterE-class] No chapter rows found! Checking DOM structure...');
      console.log('[BetterE-class] Document body:', document.body.innerHTML.substring(0, 500));

      // Try alternative selectors
      const allRows = document.querySelectorAll('#TOCLayout tr');
      console.log('[BetterE-class] Total rows in #TOCLayout:', allRows.length);

      const tableElement = document.querySelector('#TOCLayout');
      console.log('[BetterE-class] #TOCLayout element:', tableElement);
    }

    chapterRows.forEach((row, index) => {
      console.log(`[BetterE-class] Processing row ${index}`);

      // Check if buttons already exist
      if (row.querySelector('.betterEclass-chapter-download-btns')) {
        console.log(`[BetterE-class] Row ${index} already has buttons, skipping`);
        return;
      }

      // Find the cell with the chapter title (after "第1節" etc.)
      const cells = row.querySelectorAll('td');
      console.log(`[BetterE-class] Row ${index} has ${cells.length} cells`);

      if (cells.length < 3) {
        console.warn(`[BetterE-class] Row ${index} has insufficient cells, skipping`);
        return;
      }

      // The third cell (index 2) contains the chapter title area
      const titleCell = cells[2];
      console.log(`[BetterE-class] Title cell content:`, titleCell.innerHTML);

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'betterEclass-chapter-download-btns';
      buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;';

      // Create download button
      const downloadBtn = createDownloadButton();
      buttonContainer.appendChild(downloadBtn);

      // Create save as button
      const saveAsBtn = createSaveAsButton();
      buttonContainer.appendChild(saveAsBtn);

      // Create preview button
      const previewBtn = createPreviewButton();
      buttonContainer.appendChild(previewBtn);

      // Append to title cell
      titleCell.appendChild(buttonContainer);
      console.log(`[BetterE-class] ✓ Buttons added to row ${index}`);
    });

    console.log('[BetterE-class] ✓ addDownloadButtons completed');
  }

  function createDownloadButton() {
    const button = document.createElement('a');
    button.href = currentPdfUrl;
    button.download = currentFilename || 'document.pdf';
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

    button.addEventListener('click', () => {
      console.log('[BetterE-class] Downloading:', currentFilename);
    });

    return button;
  }

  function createSaveAsButton() {
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
      console.log('[BetterE-class] Save As button clicked:', currentFilename);

      if (!currentPdfUrl) {
        console.error('[BetterE-class] No PDF URL available');
        return;
      }

      // Send message to background script to trigger download with dialog
      chrome.runtime.sendMessage({
        type: 'downloadWithDialog',
        url: currentPdfUrl,
        filename: currentFilename || 'document.pdf'
      }, (response) => {
        if (response && response.error) {
          console.error('[BetterE-class] Download error:', response.error);
        }
      });
    });

    return button;
  }

  function createPreviewButton() {
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
      console.log('[BetterE-class] Preview button clicked:', currentFilename);

      if (!currentPdfUrl) {
        console.error('[BetterE-class] No PDF URL available');
        return;
      }

      // Send message to background script to open preview
      chrome.runtime.sendMessage({
        type: 'previewFile',
        url: currentPdfUrl,
        filename: currentFilename || 'document.pdf'
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
        console.log('[BetterE-class] Settings updated:', settings);
      }
    }
  });
})();
