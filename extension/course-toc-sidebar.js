// course-toc-sidebar.js
// Creates a fixed sidebar for course table of contents navigation

(function () {
    "use strict";

    console.log("[BetterE-class] Course TOC sidebar initialized");

    let settings = {
        enableTocSidebar: true,
    };

    // Load settings
    chrome.storage.sync.get(
        {
            enableTocSidebar: true,
        },
        (items) => {
            settings = items;

            if (settings.enableTocSidebar) {
                // Wait for the page to load
                if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", init);
                } else {
                    init();
                }
            }
        },
    );

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "sync" && changes.enableTocSidebar) {
            settings.enableTocSidebar = changes.enableTocSidebar.newValue;

            // Reload the page to apply changes
            if (settings.enableTocSidebar) {
                location.reload();
            } else {
                // Remove sidebar if disabled
                const sidebar = document.getElementById("betterEclass-toc-sidebar");
                const styles = document.getElementById("betterEclass-toc-sidebar-styles");
                const hideOriginalStyles = document.getElementById("betterEclass-hide-original-toc");
                if (sidebar) sidebar.remove();
                if (styles) styles.remove();
                if (hideOriginalStyles) hideOriginalStyles.remove();
            }
        }
    });

    function init() {
        // Find the TOC list in the modal
        const tocList = document.querySelector("ul.cm-sideNav_folders");

        if (!tocList) {
            return;
        }

        // Check if TOC is empty
        const tocItems = tocList.querySelectorAll("li");
        if (tocItems.length === 0) {
            createFlatSidebar();
            return;
        }

        // Create sidebar container
        const sidebar = document.createElement("div");
        sidebar.id = "betterEclass-toc-sidebar";
        sidebar.innerHTML = `
      <div class="toc-sidebar-header">
        <h4>目次</h4>
        <button class="toc-toggle-btn" title="折りたたむ">
          <span class="toggle-icon">◀</span>
        </button>
      </div>
      <div class="toc-expand-controls">
        <button class="toc-expand-all-btn" title="すべて展開">すべて展開</button>
        <button class="toc-collapse-all-btn" title="すべて折りたたむ">すべて折りたたむ</button>
      </div>
      <div class="toc-sidebar-content">
        <ul class="toc-list"></ul>
      </div>
    `;

        // Clone the TOC items and add sub-items
        const originalItems = tocList.querySelectorAll("li");
        const newList = sidebar.querySelector(".toc-list");

        originalItems.forEach((item) => {
            const link = item.querySelector("a");
            if (!link) return;

            const newItem = document.createElement("li");
            newItem.className = "toc-item";

            // Create header with toggle button
            const header = document.createElement("div");
            header.className = "toc-item-header";

            const toggleBtn = document.createElement("span");
            toggleBtn.className = "toc-toggle";
            toggleBtn.textContent = "▶";

            const newLink = document.createElement("a");
            newLink.href = "javascript:void(0)";
            newLink.textContent = link.textContent;
            newLink.className = "toc-link";

            // Copy the onclick behavior
            const onclickMatch = link.getAttribute("href").match(/switchQuestion\('([^']+)'\)/);
            if (onclickMatch) {
                const targetId = onclickMatch[1];

                // Add sub-items (materials within each section)
                const subListResult = createSubItems(targetId);

                if (subListResult) {
                    const { subList, hasAvailable, hasNew, allLocked } = subListResult;

                    // Add status icons (can show multiple)
                    const statusIcon = document.createElement("span");
                    statusIcon.className = "toc-status-icon";

                    let icons = [];
                    let titles = [];

                    if (hasNew) {
                        icons.push("✨");
                        titles.push("New content available");
                    }

                    // Only show ✅ if ALL items are available
                    if (hasAvailable) {
                        icons.push("✅");
                        titles.push("All content available");
                    } else if (allLocked) {
                        // Show lock icon only if ALL items are locked
                        icons.push("🔒");
                        titles.push("All items locked");
                    }
                    // Show nothing if some items are available and some are locked

                    if (icons.length > 0) {
                        statusIcon.textContent = " " + icons.join(" ");
                        statusIcon.title = titles.join(", ");
                    }

                    header.appendChild(toggleBtn);
                    header.appendChild(newLink);
                    header.appendChild(statusIcon);

                    newItem.appendChild(header);
                    newItem.appendChild(subList);

                    // Toggle functionality
                    toggleBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        newItem.classList.toggle("expanded");
                        toggleBtn.textContent = newItem.classList.contains("expanded") ? "▼" : "▶";
                    });

                    // Click on link also toggles
                    newLink.addEventListener("click", (e) => {
                        e.preventDefault();
                        newItem.classList.toggle("expanded");
                        toggleBtn.textContent = newItem.classList.contains("expanded") ? "▼" : "▶";
                    });

                    newList.appendChild(newItem);
                } else {
                    // No sub-items, just add the link
                    newLink.addEventListener("click", (e) => {
                        e.preventDefault();
                        const targetElement = document.getElementById(targetId.replace("#", ""));
                        if (targetElement) {
                            targetElement.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                            });

                            // Highlight active item
                            document.querySelectorAll(".toc-link").forEach((l) => l.classList.remove("active"));
                            newLink.classList.add("active");
                        }
                    });

                    header.appendChild(newLink);
                    newItem.appendChild(header);
                    newList.appendChild(newItem);
                }
            } else {
                header.appendChild(newLink);
                newItem.appendChild(header);
                newList.appendChild(newItem);
            }
        });

        // Add to page
        document.body.appendChild(sidebar);

        // Setup scroll spy to highlight active section
        setupScrollSpy(sidebar);

        // Add toggle functionality
        const toggleBtn = sidebar.querySelector(".toc-toggle-btn");
        const toggleIcon = sidebar.querySelector(".toggle-icon");

        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            toggleIcon.textContent = sidebar.classList.contains("collapsed") ? "▶" : "◀";
        });

        // Add expand/collapse all functionality
        const expandAllBtn = sidebar.querySelector(".toc-expand-all-btn");
        const collapseAllBtn = sidebar.querySelector(".toc-collapse-all-btn");

        expandAllBtn.addEventListener("click", () => {
            const allItems = sidebar.querySelectorAll(".toc-item");
            allItems.forEach((item) => {
                if (!item.classList.contains("expanded")) {
                    item.classList.add("expanded");
                    const toggle = item.querySelector(".toc-toggle");
                    if (toggle) toggle.textContent = "▼";
                }
            });
        });

        collapseAllBtn.addEventListener("click", () => {
            const allItems = sidebar.querySelectorAll(".toc-item");
            allItems.forEach((item) => {
                if (item.classList.contains("expanded")) {
                    item.classList.remove("expanded");
                    const toggle = item.querySelector(".toc-toggle");
                    if (toggle) toggle.textContent = "▶";
                }
            });
        });

        // Add styles
        addStyles();

        // Hide the original TOC modal button
        hideOriginalToc();
    }

    function setupScrollSpy(sidebar) {
        // Get all sections on the page
        const sections = document.querySelectorAll("section.panel-default[id]");
        if (sections.length === 0) return;

        // Build a map of section IDs to TOC items
        const sectionMap = new Map();
        const tocItems = sidebar.querySelectorAll(".toc-item");

        tocItems.forEach((item) => {
            const tocLink = item.querySelector(".toc-link");
            if (tocLink) {
                // Try to find section ID from the original TOC structure
                const tocText = tocLink.textContent.trim();
                sections.forEach((section) => {
                    const sectionTitle = section.querySelector(".panel-title");
                    if (sectionTitle && sectionTitle.textContent.trim() === tocText) {
                        sectionMap.set(section.id, item);
                    }
                });
            }
        });

        let isScrolling = false;

        // Function to update active section
        function updateActiveSection() {
            if (isScrolling) return;

            const scrollPosition = window.scrollY + 150; // Offset for better UX

            // Find the current section
            let currentSection = null;
            let maxTop = -1;

            sections.forEach((section) => {
                const sectionTop = section.offsetTop;

                if (scrollPosition >= sectionTop && sectionTop > maxTop) {
                    currentSection = section;
                    maxTop = sectionTop;
                }
            });

            // Remove all active classes and collapse past sections
            tocItems.forEach((item) => {
                const wasActive = item.classList.contains("active-section");
                item.classList.remove("active-section");

                // Collapse sections that are no longer active
                if (wasActive && item.classList.contains("expanded")) {
                    // Check if this is the current section
                    let shouldCollapse = true;
                    if (currentSection && sectionMap.has(currentSection.id)) {
                        const currentItem = sectionMap.get(currentSection.id);
                        if (currentItem === item) {
                            shouldCollapse = false;
                        }
                    }

                    if (shouldCollapse) {
                        item.classList.remove("expanded");
                        const toggle = item.querySelector(".toc-toggle");
                        if (toggle) toggle.textContent = "▶";
                    }
                }
            });

            // Add active class to current section
            if (currentSection && sectionMap.has(currentSection.id)) {
                const tocItem = sectionMap.get(currentSection.id);
                tocItem.classList.add("active-section");

                // Auto-expand the active section
                if (!tocItem.classList.contains("expanded")) {
                    tocItem.classList.add("expanded");
                    const toggle = tocItem.querySelector(".toc-toggle");
                    if (toggle) toggle.textContent = "▼";
                }
            }
        }

        // Throttle scroll event for performance
        let scrollTimeout;
        window.addEventListener(
            "scroll",
            () => {
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }
                scrollTimeout = setTimeout(updateActiveSection, 100);
            },
            { passive: true },
        );

        // Initial update
        updateActiveSection();

        // Prevent scroll spy during manual navigation
        sidebar.querySelectorAll(".toc-link, .toc-sublink").forEach((link) => {
            link.addEventListener("click", () => {
                isScrolling = true;
                setTimeout(() => {
                    isScrolling = false;
                }, 1000);
            });
        });
    }

    // Use shared utility function from utils/material-icons.js
    const getMaterialTypeIcon = window.BetterEclassUtils.getMaterialTypeIcon;

    function createFlatSidebar() {
        // Find all materials directly on the page (no parent sections)
        const allMaterials = document.querySelectorAll("section.panel-default .list-group-item");

        if (allMaterials.length === 0) {
            return;
        }

        // Create sidebar container
        const sidebar = document.createElement("div");
        sidebar.id = "betterEclass-toc-sidebar";
        sidebar.innerHTML = `
      <div class="toc-sidebar-header">
        <h4>教材一覧</h4>
        <button class="toc-toggle-btn" title="折りたたむ">
          <span class="toggle-icon">◀</span>
        </button>
      </div>
      <div class="toc-sidebar-content">
        <ul class="toc-list flat-list"></ul>
      </div>
    `;

        const list = sidebar.querySelector(".toc-list");

        // Add each material as a flat list item
        allMaterials.forEach((material) => {
            const titleElement = material.querySelector("h4");
            if (!titleElement) return;

            // Check if there's a link (available item)
            const linkElement = titleElement.querySelector("a");
            const hasLink = !!linkElement;

            // Check for New badge
            const newBadge = titleElement.querySelector(".cl-contentsList_new");
            const isNew = !!newBadge;

            // Check if unread (no "利用回数" text)
            const itemText = material.textContent;
            const isUnread = hasLink && !itemText.includes("利用回数");

            // Get material type
            const categoryLabel = material.querySelector(".cl-contentsList_categoryLabel");
            const materialType = categoryLabel ? categoryLabel.textContent.trim() : "";

            // Get title text (remove New text if present)
            let title = titleElement.textContent.trim();
            if (isNew && title.startsWith("New")) {
                title = title.replace(/^New\s*/, "").trim();
            }

            const item = document.createElement("li");
            item.className = "toc-item flat-item";

            const link = document.createElement("a");
            link.href = "javascript:void(0)";
            link.className = "toc-link";

            // Add material type icon
            const typeIcon = getMaterialTypeIcon(materialType);
            if (typeIcon) {
                const iconSpan = document.createElement("span");
                iconSpan.className = "material-type-icon";
                iconSpan.textContent = typeIcon + " ";
                iconSpan.title = materialType;
                link.appendChild(iconSpan);
            }

            // Add lock icon if not available
            if (!hasLink) {
                link.classList.add("locked");
                const lockIcon = document.createElement("span");
                lockIcon.textContent = "🔏 ";
                lockIcon.className = "lock-icon";
                link.appendChild(lockIcon);
            }

            // Add unread indicator
            if (isUnread) {
                const unreadDot = document.createElement("span");
                unreadDot.className = "unread-dot";
                unreadDot.title = "未読";
                link.appendChild(unreadDot);
            }

            // Add title text
            const titleSpan = document.createElement("span");
            titleSpan.textContent = title;
            link.appendChild(titleSpan);

            // Add New badge if present
            if (isNew) {
                const newSpan = document.createElement("span");
                newSpan.textContent = " ✨";
                newSpan.className = "new-badge";
                newSpan.title = "New";
                link.appendChild(newSpan);
            }

            // Only add click handler if item is available
            if (hasLink) {
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    material.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });

                    // Highlight the material briefly
                    material.style.transition = "background-color 0.5s";
                    material.style.backgroundColor = "#fff3cd";
                    setTimeout(() => {
                        material.style.backgroundColor = "";
                    }, 2000);

                    // Highlight active item
                    document.querySelectorAll(".toc-link").forEach((l) => l.classList.remove("active"));
                    link.classList.add("active");
                });
            } else {
                // Disabled style for locked items
                link.style.cursor = "not-allowed";
            }

            item.appendChild(link);
            list.appendChild(item);
        });

        // Add to page
        document.body.appendChild(sidebar);

        // Add toggle functionality
        const toggleBtn = sidebar.querySelector(".toc-toggle-btn");
        const toggleIcon = sidebar.querySelector(".toggle-icon");

        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            toggleIcon.textContent = sidebar.classList.contains("collapsed") ? "▶" : "◀";
        });

        // Add styles
        addStyles();

        // Hide the original TOC modal button
        hideOriginalToc();
    }

    function createSubItems(sectionId) {
        // Find the section element
        // Remove the # prefix and use getElementById or escape the selector
        const id = sectionId.replace("#", "");
        const section = document.getElementById(id);
        if (!section) return null;

        // Find all materials within this section
        const materials = section.querySelectorAll(".list-group-item");
        if (materials.length === 0) return null;

        // Create sub-list
        const subList = document.createElement("ul");
        subList.className = "toc-sublist";

        // Track status
        let totalCount = 0;
        let availableCount = 0;
        let hasNew = false;

        materials.forEach((material, index) => {
            const titleElement = material.querySelector("h4");
            if (!titleElement) return;

            totalCount++;

            // Check if there's a link (available item)
            const linkElement = titleElement.querySelector("a");
            const hasLink = !!linkElement;

            // Check for New badge
            const newBadge = titleElement.querySelector(".cl-contentsList_new");
            const isNew = !!newBadge;

            // Check if unread (no "利用回数" text)
            const itemText = material.textContent;
            const isUnread = hasLink && !itemText.includes("利用回数");

            // Get material type
            const categoryLabel = material.querySelector(".cl-contentsList_categoryLabel");
            const materialType = categoryLabel ? categoryLabel.textContent.trim() : "";

            // Update status flags
            if (hasLink) availableCount++;
            if (isNew) hasNew = true;

            // Get title text (remove New text if present)
            let title = titleElement.textContent.trim();
            if (isNew && title.startsWith("New")) {
                title = title.replace(/^New\s*/, "").trim();
            }

            const subItem = document.createElement("li");
            subItem.className = "toc-subitem";

            const subLink = document.createElement("a");
            subLink.href = "javascript:void(0)";
            subLink.className = "toc-sublink";

            // Add material type icon
            const typeIcon = getMaterialTypeIcon(materialType);
            if (typeIcon) {
                const iconSpan = document.createElement("span");
                iconSpan.className = "material-type-icon";
                iconSpan.textContent = typeIcon + " ";
                iconSpan.title = materialType;
                subLink.appendChild(iconSpan);
            }

            // Add lock icon if not available
            if (!hasLink) {
                subLink.classList.add("locked");
                const lockIcon = document.createElement("span");
                lockIcon.textContent = "🔏 ";
                lockIcon.className = "lock-icon";
                subLink.appendChild(lockIcon);
            }

            // Add unread indicator
            if (isUnread) {
                const unreadDot = document.createElement("span");
                unreadDot.className = "unread-dot";
                unreadDot.title = "未読";
                subLink.appendChild(unreadDot);
            }

            // Add title text
            const titleSpan = document.createElement("span");
            titleSpan.textContent = title;
            subLink.appendChild(titleSpan);

            // Add New badge if present
            if (isNew) {
                const newSpan = document.createElement("span");
                newSpan.textContent = " ✨";
                newSpan.className = "new-badge";
                newSpan.title = "New";
                subLink.appendChild(newSpan);
            }

            // Only add click handler if item is available
            if (hasLink) {
                subLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    material.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });

                    // Highlight active item
                    document.querySelectorAll(".toc-sublink").forEach((l) => l.classList.remove("active"));
                    subLink.classList.add("active");
                });
            } else {
                // Disabled style for locked items
                subLink.style.cursor = "not-allowed";
            }

            subItem.appendChild(subLink);
            subList.appendChild(subItem);
        });

        // Check if ALL items are available (not just some)
        const allAvailable = totalCount > 0 && availableCount === totalCount;
        const allLocked = availableCount === 0;

        return subList.children.length > 0
            ? {
                  subList,
                  hasAvailable: allAvailable, // Only true if ALL items are available
                  hasNew,
                  allLocked, // All items are locked
              }
            : null;
    }

    function hideOriginalToc() {
        const hideStyle = document.createElement("style");
        hideStyle.id = "betterEclass-hide-original-toc";
        hideStyle.textContent = `
      /* Hide all original TOC lists */
      ul.cm-sideNav_folders {
        display: none !important;
      }

      /* Hide the original TOC modal button */
      button[data-target="#labelModal"],
      .modalBtn[data-target="#labelModal"] {
        display: none !important;
      }

      /* Hide the label modal itself */
      #labelModal {
        display: none !important;
      }

      /* Hide the parent container of the TOC if it becomes empty */
      .cm-sideNav_folders:empty {
        display: none !important;
      }
    `;
        document.head.appendChild(hideStyle);
    }

    function addStyles() {
        const style = document.createElement("style");
        style.id = "betterEclass-toc-sidebar-styles";
        style.textContent = `
      #betterEclass-toc-sidebar {
        position: fixed;
        top: 60px;
        right: 0;
        width: 250px;
        max-height: calc(100vh - 80px);
        background: white;
        border-left: 2px solid #ddd;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        transition: transform 0.3s ease;
      }

      #betterEclass-toc-sidebar.collapsed {
        width: 40px;
      }

      #betterEclass-toc-sidebar.collapsed .toc-sidebar-content {
        display: none;
      }

      #betterEclass-toc-sidebar.collapsed .toc-sidebar-header h4 {
        display: none;
      }

      #betterEclass-toc-sidebar.collapsed .toc-sidebar-header {
        justify-content: center;
        padding: 12px 8px;
      }

      #betterEclass-toc-sidebar.collapsed .toc-expand-controls {
        display: none;
      }

      .toc-sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
      }

      .toc-sidebar-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }

      .toc-toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 14px;
        color: #666;
        transition: color 0.2s;
      }

      .toc-toggle-btn:hover {
        color: #333;
      }

      .toc-expand-controls {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        background: #f9f9f9;
        border-bottom: 1px solid #e0e0e0;
      }

      .toc-expand-all-btn,
      .toc-collapse-all-btn {
        flex: 1;
        padding: 6px 8px;
        font-size: 11px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        color: #555;
      }

      .toc-expand-all-btn:hover {
        background: #4a90e2;
        color: white;
        border-color: #4a90e2;
      }

      .toc-collapse-all-btn:hover {
        background: #999;
        color: white;
        border-color: #999;
      }

      .toc-sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }

      .toc-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .toc-item {
        margin: 0;
      }

      .toc-item-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .toc-toggle {
        font-size: 10px;
        color: #666;
        cursor: pointer;
        padding: 10px 4px 10px 12px;
        user-select: none;
        transition: transform 0.2s ease;
      }

      .toc-status-icon {
        margin-left: auto;
        padding-right: 12px;
        font-size: 14px;
      }

      .toc-link {
        display: block;
        padding: 10px 4px;
        color: #555;
        text-decoration: none;
        font-size: 14px;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
        flex: 1;
      }

      .toc-link:hover {
        background: #f8f8f8;
        color: #4a90e2;
        border-left-color: #4a90e2;
      }

      .toc-link.active {
        background: #e8f4ff;
        color: #4a90e2;
        font-weight: 600;
        border-left-color: #4a90e2;
      }

      /* Active section highlighting */
      .toc-item.active-section {
        background: #f0f8ff;
      }

      .toc-item.active-section > .toc-item-header {
        background: #e3f2fd;
      }

      .toc-item.active-section > .toc-item-header .toc-link {
        color: #1976d2;
        font-weight: 600;
      }

      /* Flat list items (for courses without parent groups) */
      .flat-list .toc-item {
        border-bottom: 1px solid #f0f0f0;
      }

      .flat-list .toc-item:last-child {
        border-bottom: none;
      }

      .flat-list .toc-link {
        padding-left: 12px;
      }

      .flat-list .toc-link.locked {
        color: #999;
        cursor: not-allowed;
      }

      .flat-list .toc-link.locked:hover {
        background: #fafafa;
        padding-left: 12px;
      }

      /* Collapsible sub-items */
      .toc-sublist {
        list-style: none;
        margin: 0;
        padding: 0;
        background: #fafafa;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .toc-item.expanded .toc-sublist {
        max-height: 1000px;
      }

      .toc-subitem {
        margin: 0;
      }

      .toc-sublink {
        display: block;
        padding: 8px 16px 8px 32px;
        color: #666;
        text-decoration: none;
        font-size: 13px;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
      }

      .toc-sublink:hover {
        background: #f0f0f0;
        color: #4a90e2;
        padding-left: 34px;
      }

      .toc-sublink.active {
        background: #e8f4ff;
        color: #4a90e2;
        font-weight: 500;
      }

      /* Locked items */
      .toc-sublink.locked {
        color: #999;
        cursor: not-allowed;
      }

      .toc-sublink.locked:hover {
        background: #fafafa;
        padding-left: 32px;
      }

      .lock-icon {
        opacity: 0.6;
      }

      /* New badge */
      .new-badge {
        color: #ff9800;
        font-weight: bold;
        font-size: 14px;
        margin-left: 4px;
      }

      /* Material type icon */
      .material-type-icon {
        font-size: 14px;
        opacity: 0.8;
      }

      /* Unread indicator */
      .unread-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        background: #ff4444;
        border-radius: 50%;
        margin-right: 6px;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.6;
          transform: scale(0.9);
        }
      }

      /* Scrollbar styling */
      .toc-sidebar-content::-webkit-scrollbar {
        width: 6px;
      }

      .toc-sidebar-content::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      .toc-sidebar-content::-webkit-scrollbar-thumb {
        background: #ccc;
        border-radius: 3px;
      }

      .toc-sidebar-content::-webkit-scrollbar-thumb:hover {
        background: #999;
      }

      /* Responsive: hide on small screens */
      @media (max-width: 768px) {
        #betterEclass-toc-sidebar {
          display: none;
        }
      }
    `;
        document.head.appendChild(style);
    }
})();
