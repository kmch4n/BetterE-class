// Display pinned courses widget
(function pinnedCourses() {
    const LEGACY_STORAGE_KEY = "betterEclassPinnedCourses";
    const STATE_KEY = "pinnedCourses";
    const uiState = window.BetterEclassUtils.uiState;
    const icons = window.BetterEclassUtils.icons;

    // Pinned courses data
    let pinnedCourses = [];

    // Course links carry a per-login token ("…/course.php/<id>/login?acs_=…"), so a course is
    // identified by its ID; the full URL only serves as a fallback for unexpected link shapes.
    function courseKey(url) {
        const match = /\/course\.php\/(\d+)/.exec(String(url ?? ""));
        return match ? match[1] : String(url ?? "").split("?")[0];
    }

    // One entry per course; earlier versions could pin the same course again after a new login.
    function dedupe(courses) {
        const seen = new Set();
        return courses.filter((course) => {
            const key = courseKey(course && course.url);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async function loadPinnedCourses() {
        try {
            const saved = await uiState.migrateFromLocalStorage(LEGACY_STORAGE_KEY, STATE_KEY, []);
            pinnedCourses = Array.isArray(saved) ? dedupe(saved) : [];
            return pinnedCourses;
        } catch (error) {
            console.error("Failed to load pinned courses:", error);
            return [];
        }
    }

    async function savePinnedCourses() {
        try {
            await uiState.setState(STATE_KEY, pinnedCourses);
        } catch (error) {
            console.error("Failed to save pinned courses:", error);
        }
    }

    // Add course to pinned list
    function pinCourse(name, url) {
        // Check if already pinned
        if (isCoursePinned(url)) {
            return false;
        }

        pinnedCourses.push({ name, url });
        void savePinnedCourses();
        return true;
    }

    // Remove course from pinned list
    function unpinCourse(url) {
        pinnedCourses = pinnedCourses.filter((course) => courseKey(course.url) !== courseKey(url));
        void savePinnedCourses();
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    // Stored entries are only rendered as links when they are web URLs
    function isWebUrl(url) {
        try {
            return ["http:", "https:"].includes(new URL(url).protocol);
        } catch (_) {
            return false;
        }
    }

    // "福祉経済１-000(2026-秋学期…)" -> "福祉経済１", matching the deadline widget
    function shortCourseName(name) {
        return name.replace(/^△/, "").split("-")[0].trim() || name;
    }

    // Create pinned courses UI. Stored names are set with textContent, never parsed as HTML.
    function createPinnedCoursesUI() {
        if (pinnedCourses.length === 0) return null;

        // Reuses e-class's side-block shell so the widget sits in the sidebar like a native block
        const container = createElement("div", "side-block-outer bec-scope bec-side-widget");
        container.id = "betterEclassPinnedCourses";

        const block = createElement("div", "side-block");
        const title = createElement("h4", "side-block-title bec-side-widget-title");
        if (icons) title.appendChild(icons.create("pin", { size: 14, className: "bec-side-widget-icon" }));
        title.append(createElement("span", "bec-side-widget-label", "ピン留め科目"), createElement("span", "bec-side-widget-count", `${pinnedCourses.length}件`));

        const content = createElement("div", "side-block-content");
        const list = createElement("ul", "bec-side-widget-list");
        pinnedCourses.forEach((course, index) => {
            const item = createElement("li", "bec-side-widget-item has-action");
            const fullName = String(course.name ?? "");

            const link = createElement("a", "bec-side-widget-link", shortCourseName(fullName));
            if (isWebUrl(course.url)) link.setAttribute("href", course.url);
            link.setAttribute("target", "_top");
            link.title = fullName;

            const unpinButton = createElement("button", "bec-side-widget-action");
            unpinButton.type = "button";
            unpinButton.title = "ピン留めを解除";
            unpinButton.setAttribute("aria-label", `${fullName} のピン留めを解除`);
            if (icons) unpinButton.appendChild(icons.create("close", { size: 14 }));
            unpinButton.addEventListener("click", (e) => {
                e.preventDefault();
                pinnedCourses.splice(index, 1);
                void savePinnedCourses();
                syncPinButtons();
                refreshPinnedCoursesUI();
                // Keep keyboard focus in the widget after the row disappears
                const next = document.querySelectorAll("#betterEclassPinnedCourses .bec-side-widget-action")[Math.min(index, pinnedCourses.length - 1)];
                if (next) next.focus();
            });

            item.append(link, unpinButton);
            list.appendChild(item);
        });

        content.appendChild(list);
        block.append(title, content);
        container.appendChild(block);
        return container;
    }

    // Insert or update pinned courses UI
    function refreshPinnedCoursesUI() {
        // Remove existing widget
        const existing = document.getElementById("betterEclassPinnedCourses");
        if (existing) {
            existing.remove();
        }

        if (pinnedCourses.length === 0) return;

        const widget = createPinnedCoursesUI();
        if (!widget) return;

        // Find the deadline list or sidebar
        const deadlineList = document.getElementById("betterEclassDeadlineList");
        const sidebar = document.querySelector(".col-sm-3");

        if (deadlineList) {
            // Insert after deadline list
            deadlineList.after(widget);
        } else if (sidebar) {
            // Insert at top of sidebar, before the direct child that holds the first block
            // (e-class may wrap the blocks, e.g. in #plugin-links)
            const firstBlock = sidebar.querySelector(".side-block-outer");
            const anchor = firstBlock && Array.from(sidebar.children).find((child) => child.contains(firstBlock));
            sidebar.insertBefore(widget, anchor || sidebar.firstChild);
        }
    }

    // Add pin buttons to course links
    function addPinButtons() {
        // Add to schedule table
        const scheduleLinks = document.querySelectorAll('#schedule-table a[href*="/course.php/"]');
        scheduleLinks.forEach(addPinButton);

        // Add to course list
        const courseListLinks = document.querySelectorAll('.courseTree a[href*="/course.php/"]');
        courseListLinks.forEach(addPinButton);
    }

    function isCoursePinned(url) {
        const key = courseKey(url);
        return pinnedCourses.some((course) => courseKey(course.url) === key);
    }

    // Point stored links at this login's URLs so the widget links keep working after the token changes.
    function refreshStoredUrls() {
        const current = new Map();
        // Only e-class's own course links: the widget's links still hold the stored URLs.
        document.querySelectorAll('#schedule-table a[href*="/course.php/"], .courseTree a[href*="/course.php/"]').forEach((link) => {
            const key = courseKey(link.href);
            if (!current.has(key)) current.set(key, link.href);
        });
        let changed = false;
        pinnedCourses.forEach((course) => {
            const url = current.get(courseKey(course.url));
            if (url && url !== course.url) {
                course.url = url;
                changed = true;
            }
        });
        if (changed) void savePinnedCourses();
    }

    // Reflect the current pinned state on every pin button, including duplicates of the same course
    function syncPinButtons() {
        document.querySelectorAll(".betterEclass-pin-button").forEach((pinButton) => {
            const isPinned = isCoursePinned(pinButton.dataset.courseUrl);
            pinButton.classList.toggle("is-pinned", isPinned);
            pinButton.setAttribute("aria-pressed", String(isPinned));
            pinButton.title = isPinned ? "ピン留めを解除" : "ピン留めする";
        });
    }

    function addPinButton(link) {
        // Skip if already has pin button
        if (link.parentElement.querySelector(".betterEclass-pin-button")) return;

        const url = link.href;

        // The .bec-scope wrapper carries the design tokens and keeps dark-mode button rules off the button
        const wrapper = createElement("span", "bec-scope betterEclass-pin");
        const pinButton = createElement("button", "betterEclass-pin-button");
        pinButton.type = "button";
        pinButton.dataset.courseUrl = url;
        pinButton.setAttribute("aria-label", `${link.textContent.trim().replace(/^»\s*/, "")} をピン留め`);
        if (icons) pinButton.appendChild(icons.create("pin", { size: 14 }));
        wrapper.appendChild(pinButton);

        // Add course-item class to parent for CSS hover effect
        if (!link.parentElement.classList.contains("betterEclass-course-item")) {
            link.parentElement.classList.add("betterEclass-course-item");
        }

        link.after(wrapper);

        pinButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const courseName = link.textContent.trim().replace(/^»\s*/, "").replace(/^△/, "");

            if (isCoursePinned(url)) {
                unpinCourse(url);
            } else {
                pinCourse(courseName, url);
            }

            syncPinButtons();
            refreshPinnedCoursesUI();
        });

        syncPinButtons();
    }

    // Render the widget and pin buttons independently so a widget failure keeps the buttons
    function render() {
        try {
            refreshStoredUrls();
            refreshPinnedCoursesUI();
        } catch (error) {
            console.error("[BetterE-class] Failed to render pinned courses:", error);
        }
        addPinButtons();
    }

    // Initialize
    async function init() {
        await loadPinnedCourses();

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                // Small delay to ensure deadline list is inserted first
                requestAnimationFrame(() => {
                    setTimeout(render, 100);
                });
            });
        } else {
            // Small delay to ensure deadline list is inserted first
            requestAnimationFrame(() => {
                setTimeout(render, 100);
            });
        }
    }

    void init();
})();
