// Background service worker for BetterE-class

// Handle download and preview requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'downloadWithDialog') {
    // file_down.php URLs are direct download links - no need to fetch HTML
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[BetterE-class] Download error:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });

    return true;
  }

  // Legacy code for loadit.php PDF extraction (kept for backwards compatibility)
  if (message.type === 'downloadWithDialog_OLD') {
    // Fetch the file_down.php page to extract actual file URL
    fetch(message.url)
      .then(response => response.text())
      .then(html => {
        // Extract URL from the download link
        // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
        let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

        if (linkMatch && linkMatch[1]) {
          let actualFileUrl = linkMatch[1];

          // Decode HTML entities (&amp; -> &)
          actualFileUrl = actualFileUrl
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          // Convert relative URL to absolute if needed
          if (!actualFileUrl.startsWith('http')) {
            // Extract base URL from message.url
            const urlObj = new URL(message.url);
            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith('/') ? '' : '/webclass/'}${actualFileUrl}`;
          }

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
              sendResponse({ success: true, downloadId: downloadId });
            }
          });
        } else {
          console.error('[BetterE-class] Could not find file link in HTML');
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
    // file_down.php URLs can be opened directly in a new tab for preview
    const tabOptions = {
      url: message.url,
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
        sendResponse({ success: true, tabId: tab.id });
      }
    });

    return true;
  }

  // Legacy code for loadit.php PDF extraction (kept for backwards compatibility)
  if (message.type === 'previewFile_OLD') {
    // Fetch the file_down.php page to extract actual file URL
    fetch(message.url)
      .then(response => response.text())
      .then(html => {
        // Extract URL from the download link
        // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
        let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

        if (linkMatch && linkMatch[1]) {
          let actualFileUrl = linkMatch[1];

          // Decode HTML entities (&amp; -> &)
          actualFileUrl = actualFileUrl
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          // Convert relative URL to absolute if needed
          if (!actualFileUrl.startsWith('http')) {
            // Extract base URL from message.url
            const urlObj = new URL(message.url);
            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith('/') ? '' : '/webclass/'}${actualFileUrl}`;
          }

          // Add preview parameter to URL to trigger header removal
          const previewUrl = actualFileUrl + (actualFileUrl.includes('?') ? '&' : '?') + '_preview=1';

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
              sendResponse({ success: true, tabId: tab.id });
            }
          });
        } else {
          console.error('[BetterE-class] Could not find file link in HTML for preview');
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
