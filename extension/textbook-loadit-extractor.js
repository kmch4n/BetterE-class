// textbook-loadit-extractor.js
// Extracts PDF URL from "別ウィンドウ" link in loadit.php and sends to parent frame

(function() {
  'use strict';

  console.log('[BetterE-class] Textbook loadit extractor initialized');
  console.log('[BetterE-class] Current URL:', window.location.href);

  function findAndSendPdfUrl() {
    console.log('[BetterE-class] Attempting to find PDF link...');
    console.log('[BetterE-class] Document body HTML:', document.body.innerHTML);

    // Find the "別ウィンドウ" link
    const betsuWindowLink = document.querySelector('a[target="_blank"]');
    console.log('[BetterE-class] Search result for a[target="_blank"]:', betsuWindowLink);

    // Also try finding by text content
    const allLinks = document.querySelectorAll('a');
    console.log('[BetterE-class] Total links found:', allLinks.length);
    allLinks.forEach((link, index) => {
      console.log(`[BetterE-class] Link ${index}:`, {
        href: link.href,
        target: link.target,
        text: link.textContent,
        innerHTML: link.innerHTML
      });
    });

    if (betsuWindowLink) {
      const pdfUrl = betsuWindowLink.href;
      console.log('[BetterE-class] Found PDF URL:', pdfUrl);

      // Extract filename from URL
      const urlParts = pdfUrl.split('/');
      const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
      console.log('[BetterE-class] Extracted filename:', filename);

      // Send message to parent frames (going up through the frame hierarchy)
      try {
        console.log('[BetterE-class] Window hierarchy check:');
        console.log('[BetterE-class] - window.self:', window.self);
        console.log('[BetterE-class] - window.parent:', window.parent);
        console.log('[BetterE-class] - window.parent.parent:', window.parent?.parent);
        console.log('[BetterE-class] - window.top:', window.top);

        const message = {
          type: 'betterEclass_pdfUrl',
          url: pdfUrl,
          filename: filename
        };
        console.log('[BetterE-class] Sending message:', message);

        // Find and send to chapter frame by name
        // Frame structure: top has 3 children - title, webclass_chapter, webclass_content
        if (window.top) {
          console.log('[BetterE-class] Top window has', window.top.frames.length, 'frames');

          // Try to find the chapter frame by name
          let chapterFrame = null;
          try {
            // Try accessing by name
            if (window.top.frames['webclass_chapter']) {
              chapterFrame = window.top.frames['webclass_chapter'];
              console.log('[BetterE-class] Found chapter frame by name');
            } else {
              // Try iterating through frames
              for (let i = 0; i < window.top.frames.length; i++) {
                console.log(`[BetterE-class] Frame ${i} name:`, window.top.frames[i].name);
                if (window.top.frames[i].name === 'webclass_chapter') {
                  chapterFrame = window.top.frames[i];
                  console.log('[BetterE-class] Found chapter frame at index', i);
                  break;
                }
              }
            }
          } catch (e) {
            console.warn('[BetterE-class] Error accessing frames:', e);
          }

          if (chapterFrame) {
            chapterFrame.postMessage(message, '*');
            console.log('[BetterE-class] ✓ Sent PDF URL directly to chapter frame');
          } else {
            console.warn('[BetterE-class] Could not find chapter frame, broadcasting to all');
            // Fallback: broadcast to all frames
            window.top.postMessage(message, '*');
            for (let i = 0; i < window.top.frames.length; i++) {
              try {
                window.top.frames[i].postMessage(message, '*');
                console.log(`[BetterE-class] Sent to frame ${i}`);
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
    } else {
      console.log('[BetterE-class] No "別ウィンドウ" link found on this page');
      return false;
    }
  }

  // Try immediately
  if (!findAndSendPdfUrl()) {
    // If not found, retry after delays (in case of late loading)
    console.log('[BetterE-class] Retrying after 500ms...');
    setTimeout(() => {
      if (!findAndSendPdfUrl()) {
        console.log('[BetterE-class] Retrying after 1000ms...');
        setTimeout(findAndSendPdfUrl, 1000);
      }
    }, 500);
  }
})();
