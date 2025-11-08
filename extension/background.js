// Background service worker for BetterE-class

console.log('[BetterE-class] Background service worker loaded');

// Handle download and preview requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BetterE-class] Message received in background:', message);

  if (message.type === 'downloadWithDialog') {
    console.log('[BetterE-class] Processing download request:', message.filename);

    // Check if this is a direct PDF URL or needs extraction from file_down.php
    const isDirectPdf = message.url.includes('.pdf') && !message.url.includes('file_down.php');

    if (isDirectPdf) {
      // Direct PDF link - download immediately
      console.log('[BetterE-class] Direct PDF link detected for download:', message.url);

      chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[BetterE-class] Download error:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          console.log('[BetterE-class] Download started with ID:', downloadId);
          sendResponse({ success: true, downloadId: downloadId });
        }
      });

      return true;
    }

    // Fetch the file_down.php page to extract actual file URL
    fetch(message.url)
      .then(response => response.text())
      .then(html => {
        console.log('[BetterE-class] Fetched download page, length:', html.length);

        // Extract URL from the download link
        // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
        let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

        console.log('[BetterE-class] Link match result:', linkMatch);

        if (linkMatch && linkMatch[1]) {
          let actualFileUrl = linkMatch[1];
          console.log('[BetterE-class] Extracted file URL:', actualFileUrl);

          // Decode HTML entities (&amp; -> &)
          actualFileUrl = actualFileUrl
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          console.log('[BetterE-class] Decoded URL:', actualFileUrl);

          // Convert relative URL to absolute if needed
          if (!actualFileUrl.startsWith('http')) {
            // Extract base URL from message.url
            const urlObj = new URL(message.url);
            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith('/') ? '' : '/webclass/'}${actualFileUrl}`;
          }

          console.log('[BetterE-class] Final file URL:', actualFileUrl);

          // Now download the actual file with save dialog
          chrome.downloads.download({
            url: actualFileUrl,
            filename: message.filename,
            saveAs: true // This prompts the user to choose location
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('[BetterE-class] Download error:', chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              console.log('[BetterE-class] Download started with ID:', downloadId);
              sendResponse({ success: true, downloadId: downloadId });
            }
          });
        } else {
          console.error('[BetterE-class] Could not find file link in HTML');
          console.log('[BetterE-class] Full HTML:', html);
          sendResponse({ error: 'Could not find file URL' });
        }
      })
      .catch(error => {
        console.error('[BetterE-class] Fetch error:', error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate async response
    return true;
  }

  if (message.type === 'previewFile') {
    console.log('[BetterE-class] Processing preview request:', message.filename);

    // Check if this is a direct PDF URL or needs extraction from file_down.php
    const isDirectPdf = message.url.includes('.pdf') && !message.url.includes('file_down.php');

    if (isDirectPdf) {
      // Direct PDF link - open immediately with preview parameter
      console.log('[BetterE-class] Direct PDF link detected:', message.url);

      const previewUrl = message.url + (message.url.includes('?') ? '&' : '?') + '_preview=1';
      console.log('[BetterE-class] Preview URL with parameter:', previewUrl);

      const tabOptions = {
        url: previewUrl,
        active: true
      };

      if (sender.tab && sender.tab.index !== undefined) {
        tabOptions.index = sender.tab.index + 1;
      }

      chrome.tabs.create(tabOptions, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('[BetterE-class] Tab creation error:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          console.log('[BetterE-class] Preview tab opened with ID:', tab.id);
          sendResponse({ success: true, tabId: tab.id });
        }
      });

      return true;
    }

    // Fetch the file_down.php page to extract actual file URL
    fetch(message.url)
      .then(response => response.text())
      .then(html => {
        console.log('[BetterE-class] Fetched download page for preview, length:', html.length);

        // Extract URL from the download link
        // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
        let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

        console.log('[BetterE-class] Link match result for preview:', linkMatch);

        if (linkMatch && linkMatch[1]) {
          let actualFileUrl = linkMatch[1];
          console.log('[BetterE-class] Extracted file URL for preview:', actualFileUrl);

          // Decode HTML entities (&amp; -> &)
          actualFileUrl = actualFileUrl
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          console.log('[BetterE-class] Decoded URL for preview:', actualFileUrl);

          // Convert relative URL to absolute if needed
          if (!actualFileUrl.startsWith('http')) {
            // Extract base URL from message.url
            const urlObj = new URL(message.url);
            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith('/') ? '' : '/webclass/'}${actualFileUrl}`;
          }

          console.log('[BetterE-class] Final file URL for preview:', actualFileUrl);

          // Add preview parameter to URL to trigger header removal
          const previewUrl = actualFileUrl + (actualFileUrl.includes('?') ? '&' : '?') + '_preview=1';
          console.log('[BetterE-class] Preview URL with parameter:', previewUrl);

          // Open the file in a new tab for preview (next to current tab)
          const tabOptions = {
            url: previewUrl,
            active: true
          };

          // If we know the sender tab, open next to it
          if (sender.tab && sender.tab.index !== undefined) {
            tabOptions.index = sender.tab.index + 1;
          }

          chrome.tabs.create(tabOptions, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('[BetterE-class] Tab creation error:', chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              console.log('[BetterE-class] Preview tab opened with ID:', tab.id);
              sendResponse({ success: true, tabId: tab.id });
            }
          });
        } else {
          console.error('[BetterE-class] Could not find file link in HTML for preview');
          console.log('[BetterE-class] Full HTML:', html);
          sendResponse({ error: 'Could not find file URL' });
        }
      })
      .catch(error => {
        console.error('[BetterE-class] Fetch error for preview:', error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate async response
    return true;
  }
});
