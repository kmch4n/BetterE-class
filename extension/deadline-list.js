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

    // Create deadline list UI
    function createDeadlineListUI(courses) {
        if (courses.length === 0) return null;

        const container = document.createElement("div");
        container.id = "betterEclassDeadlineList";
        container.className = "side-block-outer";

        container.innerHTML = `
      <div class="side-block">
        <h4 class="side-block-title">
          <span class="betterEclass-deadline-icon">⚠</span>
          締切が近い課題
          <span class="deadline-count">${courses.length}件</span>
        </h4>
        <div class="side-block-content">
          ${courses
              .map(
                  (course) => `
            <div class="deadline-item">
              <a href="${course.url}" class="deadline-course-name" target="_top">
                ${course.name}
              </a>
              <div class="deadline-warning">
                <span style="color: #ff4444;">📌</span>
                ${course.warning.replace("⚠ ", "")}
              </div>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>
    `;

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
            // Insert at the top of the sidebar
            const firstBlock = sidebar.querySelector(".side-block-outer");
            if (firstBlock) {
                sidebar.insertBefore(deadlineListUI, firstBlock);
            } else {
                sidebar.insertBefore(deadlineListUI, sidebar.firstChild);
            }
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
