// Background service worker for BetterE-class

// Handle download and preview requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "downloadDirect" || message.type === "downloadWithDialog") {
        const saveAs = message.type === "downloadWithDialog";

        // Check if this is a file_down.php or loadit.php URL that needs HTML extraction
        if (message.url.includes("file_down.php") || message.url.includes("loadit.php")) {
            // Fetch the page to extract actual file URL (include credentials for session-protected pages)
            fetch(message.url, { credentials: "include" })
                .then((response) => response.text())
                .then((html) => {
                    // Extract URL from the download link
                    // Pattern 1: <a href='/webclass/download.php/filename.pdf?...'>
                    // Pattern 2: <a href='https://eclass.doshisha.ac.jp/webclass/data/course/.../filename.pdf' target="_blank">
                    let linkMatch = html.match(/<a\s+href=['"]([^'"]+(?:download\.php|\.pdf)[^'"]*)['"]/);

                    if (linkMatch && linkMatch[1]) {
                        let actualFileUrl = linkMatch[1];

                        // Decode HTML entities (&amp; -> &)
                        actualFileUrl = actualFileUrl
                            .replace(/&amp;/g, "&")
                            .replace(/&lt;/g, "<")
                            .replace(/&gt;/g, ">")
                            .replace(/&quot;/g, '"')
                            .replace(/&#039;/g, "'");

                        // Convert relative URL to absolute if needed
                        if (!actualFileUrl.startsWith("http")) {
                            const urlObj = new URL(message.url);
                            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith("/") ? "" : "/webclass/"}${actualFileUrl}`;
                        }

                        // Now download the actual file
                        chrome.downloads.download(
                            {
                                url: actualFileUrl,
                                filename: message.filename,
                                saveAs: saveAs,
                            },
                            (downloadId) => {
                                if (chrome.runtime.lastError) {
                                    console.error("[BetterE-class] Download error:", chrome.runtime.lastError);
                                    sendResponse({
                                        error: chrome.runtime.lastError.message,
                                    });
                                } else {
                                    sendResponse({
                                        success: true,
                                        downloadId: downloadId,
                                    });
                                }
                            },
                        );
                    } else {
                        console.error("[BetterE-class] Could not find file link in HTML");
                        sendResponse({ error: "Could not find file URL" });
                    }
                })
                .catch((error) => {
                    console.error("[BetterE-class] Fetch error:", error);
                    sendResponse({ error: error.message });
                });

            return true; // Indicate async response
        } else {
            // For direct file URLs, download directly
            chrome.downloads.download(
                {
                    url: message.url,
                    filename: message.filename,
                    saveAs: saveAs,
                },
                (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error("[BetterE-class] Download error:", chrome.runtime.lastError);
                        sendResponse({
                            error: chrome.runtime.lastError.message,
                        });
                    } else {
                        sendResponse({ success: true, downloadId: downloadId });
                    }
                },
            );

            return true; // Indicate async response
        }
    }

    // Legacy code for loadit.php PDF extraction (kept for backwards compatibility)
    if (message.type === "downloadWithDialog_OLD") {
        // Fetch the file_down.php page to extract actual file URL
        fetch(message.url, { credentials: "include" })
            .then((response) => response.text())
            .then((html) => {
                // Extract URL from the download link
                // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
                let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

                if (linkMatch && linkMatch[1]) {
                    let actualFileUrl = linkMatch[1];

                    // Decode HTML entities (&amp; -> &)
                    actualFileUrl = actualFileUrl
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'");

                    // Convert relative URL to absolute if needed
                    if (!actualFileUrl.startsWith("http")) {
                        // Extract base URL from message.url
                        const urlObj = new URL(message.url);
                        actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith("/") ? "" : "/webclass/"}${actualFileUrl}`;
                    }

                    // Now download the actual file with save dialog
                    chrome.downloads.download(
                        {
                            url: actualFileUrl,
                            filename: message.filename,
                            saveAs: true, // This prompts the user to choose location
                        },
                        (downloadId) => {
                            if (chrome.runtime.lastError) {
                                console.error("[BetterE-class] Download error:", chrome.runtime.lastError);
                                sendResponse({
                                    error: chrome.runtime.lastError.message,
                                });
                            } else {
                                sendResponse({
                                    success: true,
                                    downloadId: downloadId,
                                });
                            }
                        },
                    );
                } else {
                    console.error("[BetterE-class] Could not find file link in HTML");
                    sendResponse({ error: "Could not find file URL" });
                }
            })
            .catch((error) => {
                console.error("[BetterE-class] Fetch error:", error);
                sendResponse({ error: error.message });
            });

        // Return true to indicate async response
        return true;
    }

    if (message.type === "previewFile") {
        // Check if this is a file_down.php or loadit.php URL that needs HTML extraction
        if (message.url.includes("file_down.php") || message.url.includes("loadit.php")) {
            // Fetch the page to extract actual file URL (include credentials for session-protected pages)
            fetch(message.url, { credentials: "include" })
                .then((response) => response.text())
                .then((html) => {
                    // Extract URL from the download link
                    // Pattern 1: <a href='/webclass/download.php/filename.pdf?...'>
                    // Pattern 2: <a href='https://eclass.doshisha.ac.jp/webclass/data/course/.../filename.pdf' target="_blank">
                    let linkMatch = html.match(/<a\s+href=['"]([^'"]+(?:download\.php|\.pdf)[^'"]*)['"]/);

                    if (linkMatch && linkMatch[1]) {
                        let actualFileUrl = linkMatch[1];

                        // Decode HTML entities (&amp; -> &)
                        actualFileUrl = actualFileUrl
                            .replace(/&amp;/g, "&")
                            .replace(/&lt;/g, "<")
                            .replace(/&gt;/g, ">")
                            .replace(/&quot;/g, '"')
                            .replace(/&#039;/g, "'");

                        // Convert relative URL to absolute if needed
                        if (!actualFileUrl.startsWith("http")) {
                            const urlObj = new URL(message.url);
                            actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith("/") ? "" : "/webclass/"}${actualFileUrl}`;
                        }

                        // Add preview parameter to URL to trigger header removal
                        const previewUrl = actualFileUrl + (actualFileUrl.includes("?") ? "&" : "?") + "_preview=1";

                        // Open the file in a new tab for preview (next to current tab)
                        const tabOptions = {
                            url: previewUrl,
                            active: true,
                        };

                        if (sender.tab && sender.tab.index !== undefined) {
                            tabOptions.index = sender.tab.index + 1;
                        }

                        chrome.tabs.create(tabOptions, (tab) => {
                            if (chrome.runtime.lastError) {
                                console.error("[BetterE-class] Tab creation error:", chrome.runtime.lastError);
                                sendResponse({
                                    error: chrome.runtime.lastError.message,
                                });
                            } else {
                                sendResponse({ success: true, tabId: tab.id });
                            }
                        });
                    } else {
                        console.error("[BetterE-class] Could not find file link in HTML for preview");
                        sendResponse({ error: "Could not find file URL" });
                    }
                })
                .catch((error) => {
                    console.error("[BetterE-class] Fetch error for preview:", error);
                    sendResponse({ error: error.message });
                });

            return true; // Indicate async response
        } else {
            // For direct file URLs, open directly in a new tab for preview
            const tabOptions = {
                url: message.url,
                active: true,
            };

            if (sender.tab && sender.tab.index !== undefined) {
                tabOptions.index = sender.tab.index + 1;
            }

            chrome.tabs.create(tabOptions, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error("[BetterE-class] Tab creation error:", chrome.runtime.lastError);
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, tabId: tab.id });
                }
            });

            return true; // Indicate async response
        }
    }

    // Legacy code for loadit.php PDF extraction (kept for backwards compatibility)
    if (message.type === "previewFile_OLD") {
        // Fetch the file_down.php page to extract actual file URL
        fetch(message.url, { credentials: "include" })
            .then((response) => response.text())
            .then((html) => {
                // Extract URL from the download link
                // Pattern: <a href='/webclass/download.php/filename.pdf?...'>
                let linkMatch = html.match(/<a\s+href=['"]([^'"]+download\.php[^'"]+)['"]/);

                if (linkMatch && linkMatch[1]) {
                    let actualFileUrl = linkMatch[1];

                    // Decode HTML entities (&amp; -> &)
                    actualFileUrl = actualFileUrl
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'");

                    // Convert relative URL to absolute if needed
                    if (!actualFileUrl.startsWith("http")) {
                        // Extract base URL from message.url
                        const urlObj = new URL(message.url);
                        actualFileUrl = `${urlObj.origin}${actualFileUrl.startsWith("/") ? "" : "/webclass/"}${actualFileUrl}`;
                    }

                    // Add preview parameter to URL to trigger header removal
                    const previewUrl = actualFileUrl + (actualFileUrl.includes("?") ? "&" : "?") + "_preview=1";

                    // Open the file in a new tab for preview (next to current tab)
                    const tabOptions = {
                        url: previewUrl,
                        active: true,
                    };

                    // If we know the sender tab, open next to it
                    if (sender.tab && sender.tab.index !== undefined) {
                        tabOptions.index = sender.tab.index + 1;
                    }

                    chrome.tabs.create(tabOptions, (tab) => {
                        if (chrome.runtime.lastError) {
                            console.error("[BetterE-class] Tab creation error:", chrome.runtime.lastError);
                            sendResponse({
                                error: chrome.runtime.lastError.message,
                            });
                        } else {
                            sendResponse({ success: true, tabId: tab.id });
                        }
                    });
                } else {
                    console.error("[BetterE-class] Could not find file link in HTML for preview");
                    sendResponse({ error: "Could not find file URL" });
                }
            })
            .catch((error) => {
                console.error("[BetterE-class] Fetch error for preview:", error);
                sendResponse({ error: error.message });
            });

        // Return true to indicate async response
        return true;
    }
});
