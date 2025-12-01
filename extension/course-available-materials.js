// course-available-materials.js
// Displays a list of all available materials above the timeline

(function () {
    "use strict";

    console.log("[BetterE-class] Course available materials initialized");

    let settings = {
        enableAvailableMaterials: true,
    };

    // Load settings
    chrome.storage.sync.get(
        {
            enableAvailableMaterials: true,
        },
        (items) => {
            settings = items;

            if (settings.enableAvailableMaterials) {
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
        if (namespace === "sync" && changes.enableAvailableMaterials) {
            settings.enableAvailableMaterials =
                changes.enableAvailableMaterials.newValue;

            if (settings.enableAvailableMaterials) {
                location.reload();
            } else {
                const widget = document.getElementById(
                    "betterEclass-available-materials",
                );
                const styles = document.getElementById(
                    "betterEclass-available-materials-styles",
                );
                if (widget) widget.remove();
                if (styles) styles.remove();
            }
        }
    });

    function init() {
        // Find the timeline section
        const timelineSection = document.querySelector(".col-sm-4.col-md-3");
        if (!timelineSection) {
            return;
        }

        // Collect all available materials
        const materials = collectAvailableMaterials();

        if (materials.length === 0) {
            return;
        }

        // Create the widget
        const widget = createWidget(materials);

        // Insert before the timeline
        timelineSection.insertBefore(widget, timelineSection.firstChild);

        // Add styles
        addStyles();
    }

    // Use shared utility function from utils/material-icons.js
    const getMaterialTypeIcon = window.BetterEclassUtils.getMaterialTypeIcon;

    function collectAvailableMaterials() {
        const materials = [];

        // Find all sections
        const sections = document.querySelectorAll("section.panel-default");

        sections.forEach((section) => {
            const sectionTitle = section.querySelector(".panel-title");
            if (!sectionTitle) return;

            const sectionName = sectionTitle.textContent.trim();

            // Find all materials within this section
            const items = section.querySelectorAll(".list-group-item");

            items.forEach((item) => {
                const titleElement = item.querySelector("h4");
                if (!titleElement) return;

                // Check if there's a link (available item)
                const linkElement = titleElement.querySelector("a");
                if (!linkElement) return; // Skip if no link

                // Check for New badge
                const newBadge = titleElement.querySelector(
                    ".cl-contentsList_new",
                );
                const isNew = !!newBadge;

                // Check if unread (no "利用回数" text)
                const itemText = item.textContent;
                const isUnread = !itemText.includes("利用回数");

                // Get material type
                const categoryLabel = item.querySelector(
                    ".cl-contentsList_categoryLabel",
                );
                const materialType = categoryLabel
                    ? categoryLabel.textContent.trim()
                    : "";

                // Get title
                let title = titleElement.textContent.trim();
                if (isNew && title.startsWith("New")) {
                    title = title.replace(/^New\s*/, "").trim();
                }

                // Get link URL
                const url = linkElement.getAttribute("href");

                // Check for deadline info
                const deadlineInfo = item.querySelector(
                    ".course-contents-info",
                );
                let deadline = null;
                if (deadlineInfo) {
                    deadline = deadlineInfo.textContent.trim();
                }

                materials.push({
                    section: sectionName,
                    title: title,
                    url: url,
                    isNew: isNew,
                    isUnread: isUnread,
                    materialType: materialType,
                    deadline: deadline,
                    element: item,
                });
            });
        });

        return materials;
    }

    function createWidget(materials) {
        const widget = document.createElement("div");
        widget.id = "betterEclass-available-materials";
        widget.className = "betterEclass-widget";

        const header = document.createElement("div");
        header.className = "widget-header";
        header.innerHTML = `
      <h3 class="page-header">利用可能な教材</h3>
      <span class="material-count">${materials.length}件</span>
    `;

        const list = document.createElement("div");
        list.className = "materials-list";

        // Group materials by section
        const groupedMaterials = {};
        materials.forEach((material) => {
            if (!groupedMaterials[material.section]) {
                groupedMaterials[material.section] = [];
            }
            groupedMaterials[material.section].push(material);
        });

        // Create sections
        Object.keys(groupedMaterials).forEach((sectionName) => {
            const sectionMaterials = groupedMaterials[sectionName];

            const sectionGroup = document.createElement("div");
            sectionGroup.className = "material-section";

            // Section header
            const sectionHeader = document.createElement("div");
            sectionHeader.className = "section-header";

            const toggleIcon = document.createElement("span");
            toggleIcon.className = "section-toggle";
            toggleIcon.textContent = "▶";

            const sectionTitle = document.createElement("span");
            sectionTitle.className = "section-title";
            sectionTitle.textContent = sectionName;

            const sectionCount = document.createElement("span");
            sectionCount.className = "section-count";
            sectionCount.textContent = `${sectionMaterials.length}件`;

            sectionHeader.appendChild(toggleIcon);
            sectionHeader.appendChild(sectionTitle);
            sectionHeader.appendChild(sectionCount);

            // Section content
            const sectionContent = document.createElement("div");
            sectionContent.className = "section-content";

            sectionMaterials.forEach((material) => {
                const item = document.createElement("div");
                item.className = "material-item";

                const link = document.createElement("a");
                link.href = material.url;
                link.className = "material-link";

                // Title container
                const titleContainer = document.createElement("div");
                titleContainer.style.display = "flex";
                titleContainer.style.alignItems = "center";
                titleContainer.style.gap = "6px";

                // Material type icon
                const typeIcon = getMaterialTypeIcon(material.materialType);
                if (typeIcon) {
                    const iconSpan = document.createElement("span");
                    iconSpan.className = "material-type-icon";
                    iconSpan.textContent = typeIcon;
                    iconSpan.title = material.materialType;
                    iconSpan.style.fontSize = "14px";
                    iconSpan.style.opacity = "0.8";
                    titleContainer.appendChild(iconSpan);
                }

                // New badge (at the beginning)
                if (material.isNew) {
                    const newBadge = document.createElement("span");
                    newBadge.className = "new-badge-prefix";
                    newBadge.textContent = "New";
                    newBadge.style.background = "#ff9800";
                    newBadge.style.color = "white";
                    newBadge.style.fontSize = "10px";
                    newBadge.style.padding = "2px 6px";
                    newBadge.style.borderRadius = "4px";
                    newBadge.style.marginRight = "6px";
                    newBadge.style.fontWeight = "700";
                    titleContainer.appendChild(newBadge);
                }

                // Unread indicator
                if (material.isUnread) {
                    const unreadDot = document.createElement("span");
                    unreadDot.className = "unread-dot";
                    unreadDot.title = "未読";
                    titleContainer.appendChild(unreadDot);
                }

                // Title
                const titleSpan = document.createElement("span");
                titleSpan.className = "material-title";
                titleSpan.textContent = material.title;

                titleContainer.appendChild(titleSpan);
                link.appendChild(titleContainer);

                // Deadline if exists
                if (material.deadline) {
                    const deadlineSpan = document.createElement("div");
                    deadlineSpan.className = "material-deadline";
                    deadlineSpan.textContent = material.deadline;
                    link.appendChild(deadlineSpan);
                }

                // Click handler to scroll to material
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    material.element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });

                    // Highlight the material briefly
                    material.element.style.transition = "background-color 0.5s";
                    material.element.style.backgroundColor = "#fff3cd";
                    setTimeout(() => {
                        material.element.style.backgroundColor = "";
                    }, 2000);
                });

                item.appendChild(link);
                sectionContent.appendChild(item);
            });

            // Toggle functionality
            sectionHeader.addEventListener("click", () => {
                sectionGroup.classList.toggle("expanded");
                toggleIcon.textContent = sectionGroup.classList.contains(
                    "expanded",
                )
                    ? "▼"
                    : "▶";
            });

            sectionGroup.appendChild(sectionHeader);
            sectionGroup.appendChild(sectionContent);
            list.appendChild(sectionGroup);
        });

        widget.appendChild(header);
        widget.appendChild(list);

        return widget;
    }

    function addStyles() {
        const style = document.createElement("style");
        style.id = "betterEclass-available-materials-styles";
        style.textContent = `
      #betterEclass-available-materials {
        margin-bottom: 24px;
      }

      #betterEclass-available-materials .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      #betterEclass-available-materials .page-header {
        margin: 0;
        font-size: 18px;
        padding-bottom: 8px;
        border-bottom: 2px solid #4a90e2;
      }

      #betterEclass-available-materials .material-count {
        background: #4a90e2;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
      }

      .materials-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      /* Section grouping */
      .material-section {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #f8f8f8;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s;
      }

      .section-header:hover {
        background: #f0f0f0;
      }

      .section-toggle {
        font-size: 10px;
        color: #666;
        transition: transform 0.2s;
      }

      .section-title {
        font-weight: 600;
        font-size: 13px;
        color: #333;
        flex: 1;
      }

      .section-count {
        font-size: 11px;
        color: #666;
        background: #e8e8e8;
        padding: 2px 8px;
        border-radius: 10px;
      }

      .section-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .material-section.expanded .section-content {
        max-height: 1000px;
      }

      .material-item {
        border-top: 1px solid #f0f0f0;
      }

      .material-item:hover {
        background: #f9f9f9;
      }

      .material-link {
        display: block;
        padding: 10px 12px 10px 32px;
        text-decoration: none;
        color: #333;
        transition: padding-left 0.2s;
      }

      .material-link:hover {
        padding-left: 36px;
        color: #4a90e2;
      }

      .material-title {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
      }

      .material-title .new-badge {
        display: inline-block;
        background: #ff9800;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
        font-weight: 700;
      }

      .material-deadline {
        font-size: 12px;
        color: #ff4444;
        font-weight: 600;
        margin-top: 4px;
      }

      .material-link:hover .material-title {
        color: #4a90e2;
      }

      /* Unread indicator */
      .unread-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        background: #ff4444;
        border-radius: 50%;
        flex-shrink: 0;
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

      /* Responsive */
      @media (max-width: 768px) {
        #betterEclass-available-materials {
          margin-bottom: 16px;
        }
      }
    `;
        document.head.appendChild(style);
    }
})();
