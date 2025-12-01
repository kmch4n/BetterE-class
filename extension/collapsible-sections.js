// Make sections collapsible on the course list page
(function makeCollapsibleSections() {
    const STORAGE_KEY = "betterEclassCollapsedSections";

    // Load collapsed state from localStorage
    function loadCollapsedState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error("Failed to load collapsed state:", error);
            return {};
        }
    }

    // Save collapsed state to localStorage
    function saveCollapsedState(sectionId, isCollapsed) {
        try {
            const state = loadCollapsedState();
            state[sectionId] = isCollapsed;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save collapsed state:", error);
        }
    }

    // Create toggle button
    function createToggleButton(isCollapsed) {
        const button = document.createElement("span");
        button.className = "betterEclass-collapse-toggle";
        button.innerHTML = isCollapsed ? "▶" : "▼";
        return button;
    }

    // Make a section collapsible
    function makeCollapsible(sectionId, headerElement, contentElement) {
        if (!headerElement || !contentElement) {
            return;
        }

        // Check if already made collapsible
        if (headerElement.classList.contains("betterEclass-collapsible-header")) {
            return;
        }

        const collapsedState = loadCollapsedState();
        const isCollapsed = collapsedState[sectionId] === true;

        // Add toggle button to header
        const toggleButton = createToggleButton(isCollapsed);
        headerElement.classList.add("betterEclass-collapsible-header");
        headerElement.insertBefore(toggleButton, headerElement.firstChild);

        // Setup content
        contentElement.classList.add("betterEclass-collapsible-content");

        // Set initial max-height for smooth animation
        if (!isCollapsed) {
            contentElement.style.maxHeight = contentElement.scrollHeight + "px";
        } else {
            contentElement.classList.add("collapsed");
        }

        // Toggle function
        function toggle() {
            const isCurrentlyCollapsed = contentElement.classList.contains("collapsed");

            if (isCurrentlyCollapsed) {
                // Expand - remove collapsed class first to get correct scrollHeight
                contentElement.classList.remove("collapsed");
                contentElement.style.maxHeight = contentElement.scrollHeight + "px";
                toggleButton.innerHTML = "▼";
                saveCollapsedState(sectionId, false);
            } else {
                // Collapse
                contentElement.style.maxHeight = contentElement.scrollHeight + "px";
                // Force reflow
                contentElement.offsetHeight;
                contentElement.style.maxHeight = "0";
                contentElement.classList.add("collapsed");
                toggleButton.innerHTML = "▶";
                saveCollapsedState(sectionId, true);
            }
        }

        // Add click event
        headerElement.addEventListener("click", toggle);

        // Update max-height on window resize
        window.addEventListener("resize", () => {
            if (!contentElement.classList.contains("collapsed")) {
                contentElement.style.maxHeight = contentElement.scrollHeight + "px";
            }
        });
    }

    // Make admin notices collapsible
    function makeAdminNoticesCollapsible() {
        const container = document.getElementById("UserTopInfo");
        if (!container) return;

        const h4 = container.querySelector("h4.page-header");
        const newsDiv = container.querySelector("#NewestInformations");

        if (h4 && newsDiv) {
            // Check if already wrapped
            if (newsDiv.parentElement.classList.contains("betterEclass-admin-notices-wrapper")) {
                return;
            }

            // Get the paragraph after newsDiv too
            const nextP = newsDiv.nextElementSibling;

            // Wrap content in a container
            const wrapper = document.createElement("div");
            wrapper.className = "betterEclass-admin-notices-wrapper";

            newsDiv.parentNode.insertBefore(wrapper, newsDiv);
            wrapper.appendChild(newsDiv);
            if (nextP && nextP.tagName === "P") {
                wrapper.appendChild(nextP);
            }

            makeCollapsible("adminNotices", h4, wrapper);
        }
    }

    // Make course schedule collapsible
    function makeCourseScheduleCollapsible() {
        const header = document.querySelector("h3.page-header");

        if (header && header.textContent.includes("参加している科目")) {
            // Check if already made collapsible
            if (header.classList.contains("betterEclass-collapsible-header")) {
                return;
            }

            // Find the next elements (form and schedule table)
            let contentElements = [];
            let nextElement = header.nextElementSibling;

            // Collect elements until the next h3 or end
            while (nextElement && nextElement.tagName !== "H3" && nextElement.tagName !== "H2") {
                contentElements.push(nextElement);
                nextElement = nextElement.nextElementSibling;
            }

            if (contentElements.length > 0) {
                // Wrap all content in a container
                const wrapper = document.createElement("div");
                wrapper.className = "betterEclass-course-schedule-wrapper";

                contentElements[0].parentNode.insertBefore(wrapper, contentElements[0]);
                contentElements.forEach((el) => wrapper.appendChild(el));

                makeCollapsible("courseSchedule", header, wrapper);
            }
        }
    }

    // Make "other courses" collapsible
    function makeOtherCoursesCollapsible() {
        // Find all h4 elements with "その他の科目" (not limited to sidebar)
        const headers = document.querySelectorAll("h4");

        headers.forEach((header) => {
            if (header.textContent.includes("その他の科目")) {
                // Check if already made collapsible
                if (header.classList.contains("betterEclass-collapsible-header")) {
                    return;
                }

                // Find the next elements (input, br, and div)
                let contentElements = [];
                let nextElement = header.nextElementSibling;

                // Collect the search input and courses list
                while (nextElement && contentElements.length < 3) {
                    if (nextElement.tagName === "INPUT" || nextElement.tagName === "BR" || nextElement.tagName === "DIV") {
                        contentElements.push(nextElement);

                        // Stop after finding the main courses div
                        if (nextElement.tagName === "DIV" && nextElement.id === "courses_list_left") {
                            break;
                        }
                    }
                    nextElement = nextElement.nextElementSibling;
                }

                if (contentElements.length > 0) {
                    // Wrap all content in a container
                    const wrapper = document.createElement("div");
                    wrapper.className = "betterEclass-other-courses-wrapper";

                    contentElements[0].parentNode.insertBefore(wrapper, contentElements[0]);
                    contentElements.forEach((el) => wrapper.appendChild(el));

                    makeCollapsible("otherCourses", header, wrapper);
                }
            }
        });
    }

    // Make semester filter collapsible
    function makeSemesterFilterCollapsible() {
        const headers = document.querySelectorAll("h4");

        headers.forEach((header) => {
            if (header.textContent.includes("表示する学期")) {
                // Check if already made collapsible
                if (header.classList.contains("betterEclass-collapsible-header")) {
                    return;
                }

                // Find the next div element
                const nextDiv = header.nextElementSibling;

                if (nextDiv && nextDiv.tagName === "DIV") {
                    makeCollapsible("semesterFilter", header, nextDiv);
                }
            }
        });
    }

    // Initialize
    function init() {
        // Wait for DOM to be ready
        setTimeout(() => {
            makeAdminNoticesCollapsible();
            makeCourseScheduleCollapsible();
            makeOtherCoursesCollapsible();
            makeSemesterFilterCollapsible();
        }, 500);
    }

    // Run when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
