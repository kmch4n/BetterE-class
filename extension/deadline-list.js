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

                const groupIdMatch = /\/course\.php\/(\d+)/.exec(courseUrl);

                courses.push({
                    name: cleanCourseName,
                    fullName: courseName,
                    url: courseUrl,
                    groupId: groupIdMatch ? groupIdMatch[1] : null,
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

    // One row per page warning; with fetched details, one row per course listing its unsubmitted tasks.
    // details maps a course ID to its approaching tasks; courses without an entry keep the plain row.
    function buildRows(courses, details) {
        const rows = [];
        const seenGroups = new Set();
        courses.forEach((course) => {
            const tasks = course.groupId ? details.get(course.groupId) : undefined;
            if (!tasks) {
                rows.push({ course, tasks: null });
                return;
            }
            if (seenGroups.has(course.groupId)) return;
            seenGroups.add(course.groupId);

            const pending = tasks.filter((task) => !task.submitted);
            // Everything due soon is already submitted
            if (tasks.length > 0 && pending.length === 0) return;
            rows.push({ course, tasks: pending.length > 0 ? pending : null });
        });

        // Nearest deadline first; rows without details keep page order after them
        return rows.map((row, index) => ({ row, index, due: row.tasks ? row.tasks[0].due.getTime() : Infinity })).sort((a, b) => a.due - b.due || a.index - b.index).map(({ row }) => row);
    }

    function createTaskList(tasks) {
        const deadlines = window.BetterEclassUtils.deadlines;
        const list = createElement("ul", "bec-deadline-tasks");
        tasks.forEach((task) => {
            const item = createElement("li", "bec-deadline-task");
            const due = createElement("span", "bec-deadline-task-due");
            const remaining = createElement("time", "bec-deadline-task-remaining");
            remaining.setAttribute("datetime", task.due.toISOString());
            remaining.dataset.due = String(task.due.getTime());
            due.append(remaining, createElement("span", "bec-deadline-task-date", deadlines.formatDue(task.due)));
            item.append(createElement("span", "bec-deadline-task-name", task.name), due);
            list.appendChild(item);
        });
        return list;
    }

    // Refresh "あと…" labels and the urgent state; the page can stay open for hours
    function updateRemaining(root = document) {
        const deadlines = window.BetterEclassUtils.deadlines;
        if (!deadlines) return;
        const now = Date.now();
        root.querySelectorAll(".bec-deadline-task-remaining[data-due]").forEach((element) => {
            const left = Number(element.dataset.due) - now;
            element.textContent = deadlines.formatRemaining(left);
            element.closest(".bec-deadline-task").classList.toggle("is-urgent", left < deadlines.URGENT_MS);
        });
    }

    // Create deadline list UI. Page-derived text is set with textContent, never parsed as HTML.
    function createDeadlineListUI(courses, details = new Map()) {
        const rows = buildRows(courses, details);
        if (rows.length === 0) return null;
        const count = rows.reduce((sum, row) => sum + (row.tasks ? row.tasks.length : 1), 0);

        // Reuses e-class's side-block shell so the widget sits in the sidebar like a native block
        const container = createElement("div", "side-block-outer bec-scope bec-side-widget");
        container.id = "betterEclassDeadlineList";

        const block = createElement("div", "side-block");
        const title = createElement("h4", "side-block-title bec-side-widget-title");
        const icons = window.BetterEclassUtils.icons;
        if (icons) title.appendChild(icons.create("clock", { size: 14, className: "bec-side-widget-icon" }));
        title.append(createElement("span", "bec-side-widget-label", "締切が近い課題"), createElement("span", "bec-side-widget-count", `${count}件`));

        const content = createElement("div", "side-block-content");
        const list = createElement("ul", "bec-side-widget-list");
        rows.forEach(({ course, tasks }) => {
            const item = createElement("li", "bec-side-widget-item");

            const link = createElement("a", "bec-side-widget-link", course.name);
            link.setAttribute("href", course.url);
            link.setAttribute("target", "_top");
            link.title = course.fullName;
            item.appendChild(link);

            if (tasks) {
                item.appendChild(createTaskList(tasks));
            } else {
                // The generic e-class notice only repeats the widget title; show anything more specific
                const warning = course.warning.replace(/^⚠\s*/, "");
                if (warning && !/^締切が近い課題があります。?$/.test(warning)) {
                    item.appendChild(createElement("span", "bec-side-widget-meta", warning));
                }
            }

            list.appendChild(item);
        });

        content.appendChild(list);
        block.append(title, content);
        container.appendChild(block);
        return container;
    }

    // Fetch approaching tasks per course; a course whose request fails is simply left out of the map
    async function loadTaskDetails(courses) {
        const details = new Map();
        const deadlines = window.BetterEclassUtils.deadlines;
        if (!deadlines) return details;

        const groupIds = [...new Set(courses.map((course) => course.groupId).filter(Boolean))];
        await Promise.all(
            groupIds.map(async (groupId) => {
                try {
                    details.set(groupId, await deadlines.fetchApproachingTasks(groupId));
                } catch (error) {
                    console.warn("[BetterE-class] Failed to load deadlines for a course:", error);
                }
            }),
        );
        return details;
    }

    // Swap the plain list for one with task names and due times once they arrive
    async function enrichDeadlineList(courses, currentList) {
        const details = await loadTaskDetails(courses);
        if (details.size === 0 || !currentList.isConnected) return;

        const enriched = createDeadlineListUI(courses, details);
        if (enriched) {
            currentList.replaceWith(enriched);
            updateRemaining(enriched);
            setInterval(() => updateRemaining(document.getElementById("betterEclassDeadlineList") || enriched), 60 * 1000);
        } else {
            // Every approaching task is already submitted
            currentList.remove();
        }
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

        void enrichDeadlineList(courses, deadlineListUI);
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
