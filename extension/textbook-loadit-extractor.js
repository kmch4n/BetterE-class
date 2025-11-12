// textbook-loadit-extractor.js
// Extracts PDF URL from "別ウィンドウ" link in loadit.php and sends to parent frame

(function() {
  'use strict';

  function findAndSendPdfUrl() {
    // Find the "別ウィンドウ" link
    const betsuWindowLink = document.querySelector('a[target="_blank"]');

    if (betsuWindowLink) {
      const pdfUrl = betsuWindowLink.href;

      // Extract filename from URL
      const urlParts = pdfUrl.split('/');
      const filename = decodeURIComponent(urlParts[urlParts.length - 1]);

      // Send message to parent frames (going up through the frame hierarchy)
      try {
        const message = {
          type: 'betterEclass_pdfUrl',
          url: pdfUrl,
          filename: filename
        };

        // Find and send to chapter frame by name
        // Frame structure: top has 3 children - title, webclass_chapter, webclass_content
        if (window.top) {
          // Try to find the chapter frame by name
          let chapterFrame = null;
          try {
            // Try accessing by name
            if (window.top.frames['webclass_chapter']) {
              chapterFrame = window.top.frames['webclass_chapter'];
            } else {
              // Try iterating through frames
              for (let i = 0; i < window.top.frames.length; i++) {
                if (window.top.frames[i].name === 'webclass_chapter') {
                  chapterFrame = window.top.frames[i];
                  break;
                }
              }
            }
          } catch (e) {
            console.warn('[BetterE-class] Error accessing frames:', e);
          }

          if (chapterFrame) {
            chapterFrame.postMessage(message, '*');
          } else {
            console.warn('[BetterE-class] Could not find chapter frame, broadcasting to all');
            // Fallback: broadcast to all frames
            window.top.postMessage(message, '*');
            for (let i = 0; i < window.top.frames.length; i++) {
              try {
                window.top.frames[i].postMessage(message, '*');
              } catch (e) {
                console.warn(`[BetterE-class] Could not send to frame ${i}:`, e);
              }
            }
          }
        }

      } catch (error) {
        console.error('[BetterE-class] Error sending message to parent:', error);
      }
      return true;
    }
    return false;
  }

  // Try immediately
  if (!findAndSendPdfUrl()) {
    // If not found, retry after delays (in case of late loading)
    setTimeout(() => {
      if (!findAndSendPdfUrl()) {
        setTimeout(findAndSendPdfUrl, 1000);
      }
    }, 500);
  }
})();
