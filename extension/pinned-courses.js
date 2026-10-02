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

    // Create pinned courses UI
    function createPinnedCoursesUI() {
        if (pinnedCourses.length === 0) return null;

        const container = document.createElement("div");
        container.id = "betterEclassPinnedCourses";
        container.className = "side-block-outer";

        container.innerHTML = `
      <div class="side-block">
        <h4 class="side-block-title">
          <span class="betterEclass-pin-icon">📌</span>
          ピン留め科目
          <span class="pinned-count">${pinnedCourses.length}件</span>
        </h4>
        <div class="side-block-content">
          ${pinnedCourses
              .map(
                  (course, index) => `
            <div class="pinned-item">
              <a href="${course.url}" class="pinned-course-name" target="_top">
                ${course.name}
              </a>
              <button class="unpin-button" data-index="${index}" title="ピン留めを解除">
                ✕
              </button>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;

        // Add event listeners for unpin buttons
        container.querySelectorAll(".unpin-button").forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();
                const index = parseInt(button.getAttribute("data-index"));
                pinnedCourses.splice(index, 1);
                void savePinnedCourses();
                refreshPinnedCoursesUI();
            });
        });

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

    function addPinButton(link) {
        // Skip if already has pin button
        if (link.parentElement.querySelector(".betterEclass-pin-button")) return;

        const url = link.href;
        const isPinned = pinnedCourses.some((course) => course.url === url);

        const pinButton = document.createElement("span");
        pinButton.className = "betterEclass-pin-button";
        pinButton.innerHTML = isPinned ? "📌" : "📍";
        pinButton.title = isPinned ? "ピン留めを解除" : "ピン留めする";

        // Add course-item class to parent for CSS hover effect
        if (!link.parentElement.classList.contains("betterEclass-course-item")) {
            link.parentElement.classList.add("betterEclass-course-item");
        }

        link.after(pinButton);

        pinButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const courseName = link.textContent.trim().replace(/^»\s*/, "").replace(/^△/, "");

            if (isPinned) {
                unpinCourse(url);
                pinButton.innerHTML = "📍";
                pinButton.title = "ピン留めする";
            } else {
                pinCourse(courseName, url);
                pinButton.innerHTML = "📌";
                pinButton.title = "ピン留めを解除";
            }

            refreshPinnedCoursesUI();
        });
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
