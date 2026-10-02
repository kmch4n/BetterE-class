// Display pinned courses widget
(function pinnedCourses() {
    const LEGACY_STORAGE_KEY = "betterEclassPinnedCourses";
    const STATE_KEY = "pinnedCourses";
    const uiState = window.BetterEclassUtils.uiState;

    // Pinned courses data
    let pinnedCourses = [];

    async function loadPinnedCourses() {
        try {
            const saved = await uiState.migrateFromLocalStorage(LEGACY_STORAGE_KEY, STATE_KEY, []);
            pinnedCourses = Array.isArray(saved) ? saved : [];
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
        if (pinnedCourses.some((course) => course.url === url)) {
            return false;
        }

        pinnedCourses.push({ name, url });
        void savePinnedCourses();
        return true;
    }

    // Remove course from pinned list
    function unpinCourse(url) {
        pinnedCourses = pinnedCourses.filter((course) => course.url !== url);
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

    // Create pinned courses UI. Stored names are set with textContent, never parsed as HTML.
    function createPinnedCoursesUI() {
        if (pinnedCourses.length === 0) return null;

        const container = createElement("div", "side-block-outer");
        container.id = "betterEclassPinnedCourses";

        const block = createElement("div", "side-block");
        const title = createElement("h4", "side-block-title");
        title.append(createElement("span", "betterEclass-pin-icon", "📌"), "ピン留め科目", createElement("span", "pinned-count", `${pinnedCourses.length}件`));

        const content = createElement("div", "side-block-content");
        pinnedCourses.forEach((course, index) => {
            const item = createElement("div", "pinned-item");

            const link = createElement("a", "pinned-course-name", String(course.name ?? ""));
            if (isWebUrl(course.url)) link.setAttribute("href", course.url);
            link.setAttribute("target", "_top");

            const unpinButton = createElement("button", "unpin-button", "✕");
            unpinButton.setAttribute("data-index", String(index));
            unpinButton.title = "ピン留めを解除";
            unpinButton.addEventListener("click", (e) => {
                e.preventDefault();
                pinnedCourses.splice(index, 1);
                void savePinnedCourses();
                syncPinButtons();
                refreshPinnedCoursesUI();
            });

            item.append(link, unpinButton);
            content.appendChild(item);
        });

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
            // Insert at top of sidebar
            const firstBlock = sidebar.querySelector(".side-block-outer");
            if (firstBlock) {
                sidebar.insertBefore(widget, firstBlock);
            } else {
                sidebar.insertBefore(widget, sidebar.firstChild);
            }
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
        return pinnedCourses.some((course) => course.url === url);
    }

    // Reflect the current pinned state on every pin button, including duplicates of the same course
    function syncPinButtons() {
        document.querySelectorAll(".betterEclass-pin-button").forEach((pinButton) => {
            const isPinned = isCoursePinned(pinButton.dataset.courseUrl);
            pinButton.textContent = isPinned ? "📌" : "📍";
            pinButton.title = isPinned ? "ピン留めを解除" : "ピン留めする";
        });
    }

    function addPinButton(link) {
        // Skip if already has pin button
        if (link.parentElement.querySelector(".betterEclass-pin-button")) return;

        const url = link.href;

        const pinButton = document.createElement("span");
        pinButton.className = "betterEclass-pin-button";
        pinButton.dataset.courseUrl = url;

        // Add course-item class to parent for CSS hover effect
        if (!link.parentElement.classList.contains("betterEclass-course-item")) {
            link.parentElement.classList.add("betterEclass-course-item");
        }

        link.after(pinButton);

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

    // Initialize
    async function init() {
        await loadPinnedCourses();

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                // Small delay to ensure deadline list is inserted first
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        refreshPinnedCoursesUI();
                        addPinButtons();
                    }, 100);
                });
            });
        } else {
            // Small delay to ensure deadline list is inserted first
            requestAnimationFrame(() => {
                setTimeout(() => {
                    refreshPinnedCoursesUI();
                    addPinButtons();
                }, 100);
            });
        }
    }

    void init();
})();
