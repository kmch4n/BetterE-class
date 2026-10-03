// course-toc-sidebar.js
// Shows the course table of contents in the left column, below the timeline.
// Styles live in course-sidebars.css; colours and spacing come from bec-tokens.css.

(function () {
    "use strict";

    console.log("[BetterE-class] Course TOC sidebar initialized");

    let settings = {
        enableTocSidebar: true,
    };

    const settingsAPI = window.BetterEclassUtils.settings;
    const icons = window.BetterEclassUtils.icons;
    const getMaterialTypeIconName = window.BetterEclassUtils.getMaterialTypeIconName;
    const FLASH_MS = 1600;

    settingsAPI.getSettings(["enableTocSidebar"]).then((items) => {
        settings = items;

        if (settings.enableTocSidebar) {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", init);
            } else {
                init();
            }
        }
    });

    // Listen for settings changes
    settingsAPI.onSettingsChanged((changes) => {
        if (changes.enableTocSidebar) {
            settings.enableTocSidebar = changes.enableTocSidebar.newValue;

            // Reload the page to apply changes
            if (settings.enableTocSidebar) {
                location.reload();
            } else {
                // Remove sidebar if disabled
                const sidebar = document.getElementById("betterEclass-toc-sidebar");
                const hideOriginalStyles = document.getElementById("betterEclass-hide-original-toc");
                if (sidebar) sidebar.remove();
                if (hideOriginalStyles) hideOriginalStyles.remove();
            }
        }
    });

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function createIcon(name, className) {
        return icons ? icons.create(name, { size: 14, className }) : document.createTextNode("");
    }

    /**
     * Build the TOC block: a page-header title like e-class's own "タイムライン", optional
     * expand/collapse-all links, and the list container.
     * @param {string} title
     * @param {boolean} withExpandControls
     */
    function createSidebarShell(title, withExpandControls) {
        const sidebar = createElement("section", "bec-scope bec-toc");
        sidebar.id = "betterEclass-toc-sidebar";
        sidebar.setAttribute("aria-label", title);

        const header = createElement("div", "toc-sidebar-header");
        header.appendChild(createElement("h3", "page-header toc-sidebar-title", title));

        if (withExpandControls) {
            const controls = createElement("div", "toc-expand-controls");
            const expandAll = createElement("button", "toc-expand-all-btn", "すべて展開");
            const collapseAll = createElement("button", "toc-collapse-all-btn", "すべて閉じる");
            expandAll.type = "button";
            collapseAll.type = "button";
            controls.append(expandAll, collapseAll);
            header.appendChild(controls);
        }
        sidebar.appendChild(header);

        const content = createElement("div", "toc-sidebar-content");
        content.appendChild(createElement("ul", "toc-list"));
        sidebar.appendChild(content);
        return sidebar;
    }

    /**
     * Put the TOC at the end of the left column (after the timeline). Pages without that column
     * fall back to a panel fixed to the right edge.
     * @param {HTMLElement} sidebar
     */
    function placeSidebar(sidebar) {
        const column = document.querySelector(".col-sm-4.col-md-3");
        if (column) {
            column.appendChild(sidebar);
        } else {
            sidebar.classList.add("is-floating");
            document.body.appendChild(sidebar);
        }
    }

    /**
     * Read one e-class material row.
     * @param {Element} material - .list-group-item
     */
    function readMaterial(material) {
        const titleElement = material.querySelector("h4");
        if (!titleElement) return null;

        const hasLink = !!titleElement.querySelector("a");
        const isNew = !!titleElement.querySelector(".cl-contentsList_new");
        // Materials never opened have no "利用回数" (use count) line
        const isUnread = hasLink && !material.textContent.includes("利用回数");
        const categoryLabel = material.querySelector(".cl-contentsList_categoryLabel");
        const materialType = categoryLabel ? categoryLabel.textContent.trim() : "";

        let title = titleElement.textContent.trim();
        if (isNew && title.startsWith("New")) {
            title = title.replace(/^New\s*/, "").trim();
        }
        return { element: material, hasLink, isNew, isUnread, materialType, title };
    }

    function flash(element) {
        element.classList.add("bec-flash");
        setTimeout(() => element.classList.remove("bec-flash"), FLASH_MS);
    }

    /**
     * Build the sidebar link for a material. Locked materials stay readable but inert.
     * @param {ReturnType<typeof readMaterial>} material
     * @param {string} className - "toc-link" (flat list) or "toc-sublink" (inside a section)
     * @param {() => void} onActivate
     */
    function createMaterialLink(material, className, onActivate) {
        const link = createElement("a", className);
        link.href = "javascript:void(0)";

        const typeIcon = createIcon(getMaterialTypeIconName ? getMaterialTypeIconName(material.materialType) : "file", "toc-type-icon");
        if (material.materialType && typeIcon.setAttribute) {
            typeIcon.setAttribute("aria-hidden", "false");
            typeIcon.setAttribute("role", "img");
            typeIcon.setAttribute("aria-label", material.materialType);
        }
        link.appendChild(typeIcon);

        const titleSpan = createElement("span", "toc-title", material.title);
        link.appendChild(titleSpan);

        if (material.isUnread) {
            const unreadDot = createElement("span", "unread-dot");
            unreadDot.title = "未読";
            unreadDot.setAttribute("role", "img");
            unreadDot.setAttribute("aria-label", "未読");
            link.appendChild(unreadDot);
        }
        if (material.isNew) {
            link.appendChild(createElement("span", "new-badge", "New"));
        }

        if (material.hasLink) {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                material.element.scrollIntoView({ behavior: "smooth", block: "center" });
                flash(material.element);
                onActivate(link);
            });
        } else {
            link.classList.add("locked");
            link.setAttribute("aria-disabled", "true");
            link.title = "現在は利用できません";
            link.appendChild(createIcon("lock", "toc-lock-icon"));
            link.addEventListener("click", (event) => event.preventDefault());
        }
        return link;
    }

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

        const sidebar = createSidebarShell("目次", true);
        const newList = sidebar.querySelector(".toc-list");

        tocList.querySelectorAll("li").forEach((item) => {
            const link = item.querySelector("a");
            if (!link) return;

            const newItem = createElement("li", "toc-item");
            const header = createElement("div", "toc-item-header");
            const newLink = createElement("a", "toc-link", link.textContent);
            newLink.href = "javascript:void(0)";

            const onclickMatch = link.getAttribute("href").match(/switchQuestion\('([^']+)'\)/);
            if (!onclickMatch) {
                header.appendChild(newLink);
                newItem.appendChild(header);
                newList.appendChild(newItem);
                return;
            }

            const targetId = onclickMatch[1];
            const subListResult = createSubItems(targetId);

            if (!subListResult) {
                // No sub-items, just add the link
                newLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    const targetElement = document.getElementById(targetId.replace("#", ""));
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                        sidebar.querySelectorAll(".toc-link").forEach((l) => l.classList.remove("active"));
                        newLink.classList.add("active");
                    }
                });
                header.appendChild(newLink);
                newItem.appendChild(header);
                newList.appendChild(newItem);
                return;
            }

            const { subList, hasNew, allLocked } = subListResult;
            const subListId = `betterEclass-toc-${targetId.replace(/[^\w-]/g, "")}`;
            subList.id = subListId;

            const toggleBtn = createElement("button", "toc-toggle");
            toggleBtn.type = "button";
            toggleBtn.setAttribute("aria-expanded", "false");
            toggleBtn.setAttribute("aria-controls", subListId);
            toggleBtn.setAttribute("aria-label", `${link.textContent.trim()}の教材を表示`);
            toggleBtn.appendChild(createIcon("chevronRight"));

            // Quiet status: "available" is the normal case and shows nothing.
            const status = createElement("span", "toc-status");
            if (hasNew) status.appendChild(createElement("span", "new-badge", "New"));
            if (allLocked) {
                newItem.classList.add("locked");
                const lock = createIcon("lock", "toc-lock-icon");
                if (lock.setAttribute) {
                    lock.setAttribute("aria-hidden", "false");
                    lock.setAttribute("role", "img");
                    lock.setAttribute("aria-label", "すべての教材が利用できません");
                }
                status.appendChild(lock);
                status.title = "すべての教材が利用できません";
            }

            header.append(toggleBtn, newLink, status);
            newItem.append(header, subList);

            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                setItemExpanded(newItem, !newItem.classList.contains("expanded"));
            });
            newLink.addEventListener("click", (e) => {
                e.preventDefault();
                setItemExpanded(newItem, !newItem.classList.contains("expanded"));
            });

            newList.appendChild(newItem);
        });

        placeSidebar(sidebar);

        // Setup scroll spy to highlight active section
        setupScrollSpy(sidebar);

        sidebar.querySelector(".toc-expand-all-btn").addEventListener("click", () => {
            sidebar.querySelectorAll(".toc-item").forEach((item) => setItemExpanded(item, true));
        });
        sidebar.querySelector(".toc-collapse-all-btn").addEventListener("click", () => {
            sidebar.querySelectorAll(".toc-item").forEach((item) => setItemExpanded(item, false));
        });

        // Hide the original TOC modal button
        hideOriginalToc();
    }

    // Expand or collapse a TOC item, animating its sub-list to its full height
    function setItemExpanded(item, expanded) {
        if (item.classList.contains("expanded") === expanded) return;
        item.classList.toggle("expanded", expanded);

        const toggle = item.querySelector(".toc-toggle");
        if (toggle) toggle.setAttribute("aria-expanded", String(expanded));

        const subList = item.querySelector(".toc-sublist");
        if (!subList) return;
        const { expand, collapse } = window.BetterEclassUtils.expandTransition;
        if (expanded) {
            expand(subList);
        } else {
            collapse(subList);
        }
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
                        setItemExpanded(item, false);
                    }
                }
            });

            // Add active class to current section
            if (currentSection && sectionMap.has(currentSection.id)) {
                const tocItem = sectionMap.get(currentSection.id);
                tocItem.classList.add("active-section");

                // Auto-expand the active section
                setItemExpanded(tocItem, true);
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

    function createFlatSidebar() {
        // Find all materials directly on the page (no parent sections)
        const materials = Array.from(document.querySelectorAll("section.panel-default .list-group-item")).map(readMaterial).filter(Boolean);
        if (materials.length === 0) {
            return;
        }

        const sidebar = createSidebarShell("教材一覧", false);
        const list = sidebar.querySelector(".toc-list");
        list.classList.add("flat-list");

        materials.forEach((material) => {
            const item = createElement("li", "toc-item");
            item.appendChild(
                createMaterialLink(material, "toc-link", (link) => {
                    sidebar.querySelectorAll(".toc-link").forEach((l) => l.classList.remove("active"));
                    link.classList.add("active");
                }),
            );
            list.appendChild(item);
        });

        placeSidebar(sidebar);

        // Hide the original TOC modal button
        hideOriginalToc();
    }

    function createSubItems(sectionId) {
        // Remove the # prefix and use getElementById instead of escaping the selector
        const section = document.getElementById(sectionId.replace("#", ""));
        if (!section) return null;

        const materials = Array.from(section.querySelectorAll(".list-group-item")).map(readMaterial).filter(Boolean);
        if (materials.length === 0) return null;

        const subList = createElement("ul", "toc-sublist");
        materials.forEach((material) => {
            const subItem = createElement("li", "toc-subitem");
            subItem.appendChild(
                createMaterialLink(material, "toc-sublink", (link) => {
                    document.querySelectorAll("#betterEclass-toc-sidebar .toc-sublink").forEach((l) => l.classList.remove("active"));
                    link.classList.add("active");
                }),
            );
            subList.appendChild(subItem);
        });

        return {
            subList,
            hasNew: materials.some((material) => material.isNew),
            allLocked: materials.every((material) => !material.hasLink),
        };
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
})();
