// Add download button for attachments and prevent popup windows
(function() {
  'use strict';

  let settings = {
    enableAttachmentTab: true,
    enableDirectDownload: true
  };

  // Load settings
  chrome.storage.sync.get(['enableAttachmentTab', 'enableDirectDownload'], (result) => {
    try {
      settings.enableAttachmentTab = result.enableAttachmentTab !== undefined
        ? result.enableAttachmentTab
        : true;
      settings.enableDirectDownload = result.enableDirectDownload !== undefined
        ? result.enableDirectDownload
        : true;

      init();
    } catch (error) {
      console.error('Failed to load attachment settings:', error);
    }
  });

  function init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(processAttachments, 100);
      });
    } else {
      setTimeout(processAttachments, 100);
    }
  }

  function processAttachments() {
    // Find all attachment links (type 1: with filedownload onclick)
    const attachmentLinks = document.querySelectorAll('a[onclick*="filedownload"]');

    attachmentLinks.forEach(link => {
      try {
        const href = link.getAttribute('href');
        const onclickAttr = link.getAttribute('onclick');

        if (!href || !onclickAttr) return;

        // Prevent popup window from opening
        if (settings.enableAttachmentTab) {
          // Add click event listener to prevent default popup behavior
          link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Open in new tab directly
            window.open(href, '_blank', 'noopener,noreferrer');
          }, true); // Use capture phase to intercept before onclick

          // Also remove onclick attribute as backup
          link.removeAttribute('onclick');
        }

        // Add download button if enabled
        if (settings.enableDirectDownload) {
          addDownloadButton(link, href);
        }
      } catch (error) {
        console.error('Error processing attachment link:', error);
      }
    });

    // Find direct PDF links (type 2: "別ウインドウ" links)
    const directPdfLinks = document.querySelectorAll('a[href*=".pdf"][target="_blank"]');

    directPdfLinks.forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (!href) return;

        // Skip if this link was already processed as type 1
        if (link.getAttribute('onclick')?.includes('filedownload')) return;

        // Add download button if enabled
        if (settings.enableDirectDownload) {
          addDownloadButtonForDirectLink(link, href);
        }
      } catch (error) {
        console.error('Error processing direct PDF link:', error);
      }
    });

    // Find assignment page loadit.php links (type 3: in framesets)
    processAssignmentPageAttachments();
  }

  function processAssignmentPageAttachments() {
    // Look for frame elements pointing to loadit.php
    const frames = document.querySelectorAll('frame[src*="loadit.php"]');

    frames.forEach(frame => {
      try {
        const src = frame.getAttribute('src');
        if (!src) return;

        // Extract file URL from loadit.php parameters
        const url = new URL(src, window.location.origin);
        const fileParam = url.searchParams.get('file');

        if (fileParam && fileParam.includes('.pdf')) {
          // Create a visual indicator/button near the frame or in a dedicated area
          addDownloadButtonForFramedFile(frame, src, fileParam);
        }
      } catch (error) {
        console.error('Error processing assignment page frame:', error);
      }
    });

    // Also check for direct loadit.php links in the page
    const loaditLinks = document.querySelectorAll('a[href*="loadit.php"]');

    loaditLinks.forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (!href) return;

        // Skip if already processed
        if (link.closest('.betterEclass-download-btns')) return;

        const url = new URL(href, window.location.origin);
        const fileParam = url.searchParams.get('file');

        if (fileParam) {
          if (settings.enableDirectDownload) {
            addDownloadButtonForLoaditLink(link, href, fileParam);
          }
        }
      } catch (error) {
        console.error('Error processing loadit.php link:', error);
      }
    });
  }

  function addDownloadButtonForFramedFile(frameElement, loaditUrl, filePath) {
    // Create a floating button overlay near the frame
    const frameContainer = frameElement.parentElement;
    if (!frameContainer) return;

    // Check if button already exists
    if (frameContainer.querySelector('.betterEclass-frame-download')) {
      return;
    }

    // Extract filename from path
    const fileName = filePath.split('/').pop();
    const decodedFileName = decodeURIComponent(fileName);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'betterEclass-frame-download';
    buttonContainer.style.cssText = 'position: absolute; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 4px; background: rgba(255, 255, 255, 0.95); padding: 6px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';

    // Create direct download button
    const downloadBtn = createDownloadButton('⬇️', 'ダウンロード', loaditUrl, decodedFileName);
    buttonContainer.appendChild(downloadBtn);

    // Create "save as" button
    const saveAsBtn = createSaveAsButton('💾', '名前を付けて保存', loaditUrl, decodedFileName);
    buttonContainer.appendChild(saveAsBtn);

    // Insert button container
    if (frameContainer.style.position === '' || frameContainer.style.position === 'static') {
      frameContainer.style.position = 'relative';
    }
    frameContainer.appendChild(buttonContainer);
  }

  function addDownloadButtonForLoaditLink(link, loaditUrl, filePath) {
    // Check if button already exists
    const parent = link.parentElement;
    if (!parent || parent.querySelector('.betterEclass-download-btns')) {
      return;
    }

    // Extract filename from path
    const fileName = filePath.split('/').pop();
    const decodedFileName = decodeURIComponent(fileName);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'betterEclass-download-btns';
    buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;';

    // Create direct download button
    const downloadBtn = createDownloadButton('⬇️', 'ダウンロード', loaditUrl, decodedFileName);
    buttonContainer.appendChild(downloadBtn);

    // Create "save as" button
    const saveAsBtn = createSaveAsButton('💾', '名前を付けて保存', loaditUrl, decodedFileName);
    buttonContainer.appendChild(saveAsBtn);

    // Create preview button
    const previewBtn = createPreviewButton('👁️', 'プレビュー', loaditUrl, decodedFileName);
    buttonContainer.appendChild(previewBtn);

    // Insert button after the link
    parent.appendChild(buttonContainer);
  }

  function addDownloadButton(attachmentLink, downloadUrl) {
    // Check if button already exists
    const parent = attachmentLink.closest('td');
    if (!parent || parent.querySelector('.betterEclass-download-btns')) {
      return;
    }

    // Extract file name from URL
    const urlParams = new URLSearchParams(downloadUrl.split('?')[1]);
    const fileName = urlParams.get('file_name');
    const decodedFileName = fileName ? decodeURIComponent(fileName) : 'file';

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'betterEclass-download-btns';
    buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;';

    // Create direct download button
    const downloadBtn = createDownloadButton('⬇️', 'ダウンロード', downloadUrl, decodedFileName);
    buttonContainer.appendChild(downloadBtn);

    // Create "save as" button
    const saveAsBtn = createSaveAsButton('💾', '名前を付けて保存', downloadUrl, decodedFileName);
    buttonContainer.appendChild(saveAsBtn);

    // Create preview button
    const previewBtn = createPreviewButton('👁️', 'プレビュー', downloadUrl, decodedFileName);
    buttonContainer.appendChild(previewBtn);

    // Insert button after the attachment link
    parent.appendChild(buttonContainer);
  }

  function addDownloadButtonForDirectLink(pdfLink, pdfUrl) {
    // Check if button already exists
    if (pdfLink.nextElementSibling?.classList.contains('betterEclass-download-btns')) {
      return;
    }

    // Extract file name from URL path
    const urlPath = pdfUrl.split('?')[0];
    const fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1);
    const decodedFileName = decodeURIComponent(fileName);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'betterEclass-download-btns';
    buttonContainer.style.cssText = 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;';

    // Create direct download button
    const downloadBtn = createDownloadButton('⬇️', 'ダウンロード', pdfUrl, decodedFileName);
    buttonContainer.appendChild(downloadBtn);

    // Create "save as" button
    const saveAsBtn = createSaveAsButton('💾', '名前を付けて保存', pdfUrl, decodedFileName);
    buttonContainer.appendChild(saveAsBtn);

    // Create preview button (for direct PDF links, preview is just opening in new tab)
    const previewBtn = createPreviewButton('👁️', 'プレビュー', pdfUrl, decodedFileName);
    buttonContainer.appendChild(previewBtn);

    // Insert button container after the link
    pdfLink.parentNode.insertBefore(buttonContainer, pdfLink.nextSibling);
  }

  function createDownloadButton(icon, text, downloadUrl, fileName) {
    const button = document.createElement('a');
    button.href = downloadUrl;

    // Direct download with download attribute
    button.download = fileName || 'file';

    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #4a90e2; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = text;

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

  function createSaveAsButton(icon, text, downloadUrl, fileName) {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #52c41a; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer; border: none;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = text;

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Click event to trigger Chrome download with save dialog
    button.addEventListener('click', () => {
      try {
        // Convert relative URL to absolute URL
        const absoluteUrl = downloadUrl.startsWith('http')
          ? downloadUrl
          : `${window.location.origin}/webclass/${downloadUrl}`;

        // Use Chrome downloads API to prompt save dialog
        chrome.runtime.sendMessage({
          type: 'downloadWithDialog',
          url: absoluteUrl,
          filename: fileName
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[BetterE-class] Runtime error:', chrome.runtime.lastError);
            // Fallback to regular download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.click();
            return;
          }

          if (response && response.error) {
            console.error('[BetterE-class] Download error:', response.error);
            // Fallback to regular download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.click();
          }
        });
      } catch (error) {
        console.error('[BetterE-class] Error triggering save as:', error);
        // Fallback to regular download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
      }
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#389e0d';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#52c41a';
    });

    return button;
  }

  function createPreviewButton(icon, text, downloadUrl, fileName) {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #ff9800; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; transition: background 0.2s ease; cursor: pointer; border: none;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = text;

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    // Click event to open file in new tab for preview
    button.addEventListener('click', () => {
      try {
        // Convert relative URL to absolute URL
        const absoluteUrl = downloadUrl.startsWith('http')
          ? downloadUrl
          : `${window.location.origin}/webclass/${downloadUrl}`;

        // Use background service worker to extract actual file URL
        chrome.runtime.sendMessage({
          type: 'previewFile',
          url: absoluteUrl,
          filename: fileName
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[BetterE-class] Runtime error:', chrome.runtime.lastError);
            // Fallback to opening the download page
            window.open(downloadUrl, '_blank', 'noopener,noreferrer');
            return;
          }

          if (response && response.error) {
            console.error('[BetterE-class] Preview error:', response.error);
            // Fallback to opening the download page
            window.open(downloadUrl, '_blank', 'noopener,noreferrer');
          }
          // If successful, the background script will open the tab
        });
      } catch (error) {
        console.error('[BetterE-class] Error triggering preview:', error);
        // Fallback to opening the download page
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      }
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f57c00';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#ff9800';
    });

    return button;
  }

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged') {
      settings = message.settings;

      // Re-process attachments with new settings
      // Remove existing download buttons
      document.querySelectorAll('.betterEclass-download-btns').forEach(btn => btn.remove());
      document.querySelectorAll('.betterEclass-frame-download').forEach(btn => btn.remove());

      processAttachments();
    }
  });
})();
