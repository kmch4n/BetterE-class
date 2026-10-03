// Display list of courses with approaching deadlines
(function createDeadlineList() {
    // Settings
    let settings = {
        enableDeadlineHighlight: true,
    };

    // Load settings
    async function loadSettings() {
        try {
            const result = await window.BetterEclassUtils.settings.getSettings(["enableDeadlineHighlight"]);
            settings = result;
            return result;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return settings;
        }
    }

    // Extract courses with deadlines
    function getCoursesWithDeadlines() {
        const courses = [];
        const seen = new Set(); // Track unique deadline entries
        const deadlineElements = document.querySelectorAll(".course-contents-info");

        deadlineElements.forEach((element) => {
            let courseLink = null;

            // Strategy 1: Check if warning is inside a link (schedule table)
            courseLink = element.closest("a");

            // Strategy 2: Check parent container for a link (other courses section)
            if (!courseLink) {
                const container = element.closest("li") || element.closest(".course-data-box-normal");
                if (container) {
                    courseLink = container.querySelector('a[href*="course.php"]');
                }
            }

            // Strategy 3: Check parent td for a link (fallback for schedule table)
            if (!courseLink) {
                const td = element.closest("td");
                if (td) {
                    courseLink = td.querySelector('a[href*="course.php"]');
                }
            }

            if (courseLink) {
                const courseUrl = courseLink.href;
                const warning = element.textContent.trim();
                const assignmentId = element.getAttribute("data-assignment-id");

                // A shared course, message, or link cannot establish that two warnings are the same assignment.
                if (assignmentId) {
                    const normalizedWarning = warning.replace(/\s+/g, " ");
                    const deadlineKey = `${courseUrl}\n${assignmentId}\n${normalizedWarning}`;
                    if (seen.has(deadlineKey)) {
                        return;
                    }
                    seen.add(deadlineKey);
                }

                const courseName = courseLink.textContent.trim().replace(/^»\s*/, "");

                // Extract just the subject name without the code
                const cleanCourseName = courseName.replace(/^△/, "").split("-")[0].trim();

                courses.push({
                    name: cleanCourseName,
                    fullName: courseName,
                    url: courseUrl,
                    warning,
                });
            }
        });

        return courses;
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    // Create deadline list UI. Page-derived text is set with textContent, never parsed as HTML.
    function createDeadlineListUI(courses) {
        if (courses.length === 0) return null;

        // Reuses e-class's side-block shell so the widget sits in the sidebar like a native block
        const container = createElement("div", "side-block-outer bec-scope bec-side-widget");
        container.id = "betterEclassDeadlineList";

        const block = createElement("div", "side-block");
        const title = createElement("h4", "side-block-title bec-side-widget-title");
        const icons = window.BetterEclassUtils.icons;
        if (icons) title.appendChild(icons.create("clock", { size: 14, className: "bec-side-widget-icon" }));
        title.append(createElement("span", "bec-side-widget-label", "締切が近い課題"), createElement("span", "bec-side-widget-count", `${courses.length}件`));

        const content = createElement("div", "side-block-content");
        const list = createElement("ul", "bec-side-widget-list");
        courses.forEach((course) => {
            const item = createElement("li", "bec-side-widget-item");

            const link = createElement("a", "bec-side-widget-link", course.name);
            link.setAttribute("href", course.url);
            link.setAttribute("target", "_top");
            link.title = course.fullName;
            item.appendChild(link);

            // The generic e-class notice only repeats the widget title; show anything more specific
            const warning = course.warning.replace(/^⚠\s*/, "");
            if (warning && !/^締切が近い課題があります。?$/.test(warning)) {
                item.appendChild(createElement("span", "bec-side-widget-meta", warning));
            }

            list.appendChild(item);
        });

        content.appendChild(list);
        block.append(title, content);
        container.appendChild(block);
        return container;
    }

    // Insert deadline list into the page
    function insertDeadlineList() {
        // First, remove any existing deadline list to prevent duplicates
        const existingList = document.getElementById("betterEclassDeadlineList");
        if (existingList) {
            existingList.remove();
        }

        // If feature is disabled, don't show the list
        if (!settings.enableDeadlineHighlight) {
            return;
        }

        const courses = getCoursesWithDeadlines();

        if (courses.length === 0) return;

        const deadlineListUI = createDeadlineListUI(courses);
        if (!deadlineListUI) return;

        // Find the sidebar (where 課題実施状況一覧 is)
        const sidebar = document.querySelector(".col-sm-3");

        if (sidebar) {
            // Insert at the top of the sidebar, before the direct child that holds the first block
            // (e-class may wrap the blocks, e.g. in #plugin-links)
            const firstBlock = sidebar.querySelector(".side-block-outer");
            const anchor = firstBlock && Array.from(sidebar.children).find((child) => child.contains(firstBlock));
            sidebar.insertBefore(deadlineListUI, anchor || sidebar.firstChild);
        } else {
            // Fallback: insert after UserTopInfo
            const userTopInfo = document.getElementById("UserTopInfo");
            if (userTopInfo) {
                userTopInfo.after(deadlineListUI);
            }
        }
    }

    // Initialize
    async function init() {
        await loadSettings();

        // Insert immediately for faster display
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", insertDeadlineList);
        } else {
            // Small delay to ensure deadline highlights are applied first
            requestAnimationFrame(() => {
                setTimeout(insertDeadlineList, 50);
            });
        }
    }

    init();
})();
