// Display pinned courses widget
(function pinnedCourses() {
  const STORAGE_KEY = 'betterEclassPinnedCourses';

  // Pinned courses data
  let pinnedCourses = [];

  // Load pinned courses from localStorage
  function loadPinnedCourses() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        pinnedCourses = JSON.parse(saved);
      }
      return pinnedCourses;
    } catch (error) {
      console.error('Failed to load pinned courses:', error);
      return [];
    }
  }

  // Save pinned courses to localStorage
  function savePinnedCourses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedCourses));
    } catch (error) {
      console.error('Failed to save pinned courses:', error);
    }
  }

  // Add course to pinned list
  function pinCourse(name, url) {
    // Check if already pinned
    if (pinnedCourses.some(course => course.url === url)) {
      return false;
    }

    pinnedCourses.push({ name, url });
    savePinnedCourses();
    return true;
  }

  // Remove course from pinned list
  function unpinCourse(url) {
    pinnedCourses = pinnedCourses.filter(course => course.url !== url);
    savePinnedCourses();
  }

  // Create pinned courses UI
  function createPinnedCoursesUI() {
    if (pinnedCourses.length === 0) return null;

    const container = document.createElement('div');
    container.id = 'betterEclassPinnedCourses';
    container.className = 'side-block-outer';
    container.style.cssText = `
      margin-bottom: 20px;
      animation: slideIn 0.3s ease-out;
    `;

    container.innerHTML = `
      <style>
        #betterEclassPinnedCourses .side-block {
          border: 2px solid #4a90e2;
          border-radius: 6px;
          overflow: hidden;
        }

        #betterEclassPinnedCourses .side-block-title {
          background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
          color: white;
          padding: 12px 15px;
          margin: 0;
          font-size: 14px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        #betterEclassPinnedCourses .side-block-content {
          background-color: #f9fcff;
          padding: 0;
        }

        #betterEclassPinnedCourses .pinned-item {
          padding: 12px 15px;
          border-bottom: 1px solid #e0f0ff;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        #betterEclassPinnedCourses .pinned-item:last-child {
          border-bottom: none;
        }

        #betterEclassPinnedCourses .pinned-item:hover {
          background-color: #e8f4ff;
        }

        #betterEclassPinnedCourses .pinned-course-name {
          color: #357abd;
          font-weight: bold;
          font-size: 13px;
          text-decoration: none;
          flex: 1;
        }

        #betterEclassPinnedCourses .pinned-course-name:hover {
          color: #4a90e2;
          text-decoration: underline;
        }

        #betterEclassPinnedCourses .unpin-button {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 0 5px;
          transition: color 0.2s;
        }

        #betterEclassPinnedCourses .unpin-button:hover {
          color: #ff4444;
        }

        #betterEclassPinnedCourses .pinned-count {
          background-color: white;
          color: #4a90e2;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
      </style>
      <div class="side-block">
        <h4 class="side-block-title">
          <span style="font-size: 18px;">📌</span>
          ピン留め科目
          <span class="pinned-count">${pinnedCourses.length}件</span>
        </h4>
        <div class="side-block-content">
          ${pinnedCourses.map((course, index) => `
            <div class="pinned-item">
              <a href="${course.url}" class="pinned-course-name" target="_top">
                ${course.name}
              </a>
              <button class="unpin-button" data-index="${index}" title="ピン留めを解除">
                ✕
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Add event listeners for unpin buttons
    container.querySelectorAll('.unpin-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(button.getAttribute('data-index'));
        pinnedCourses.splice(index, 1);
        savePinnedCourses();
        refreshPinnedCoursesUI();
      });
    });

    return container;
  }

  // Insert or update pinned courses UI
  function refreshPinnedCoursesUI() {
    // Remove existing widget
    const existing = document.getElementById('betterEclassPinnedCourses');
    if (existing) {
      existing.remove();
    }

    if (pinnedCourses.length === 0) return;

    const widget = createPinnedCoursesUI();
    if (!widget) return;

    // Find the deadline list or sidebar
    const deadlineList = document.getElementById('betterEclassDeadlineList');
    const sidebar = document.querySelector('.col-sm-3');

    if (deadlineList) {
      // Insert after deadline list
      deadlineList.after(widget);
    } else if (sidebar) {
      // Insert at top of sidebar
      const firstBlock = sidebar.querySelector('.side-block-outer');
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
    if (link.parentElement.querySelector('.betterEclass-pin-button')) return;

    const url = link.href;
    const isPinned = pinnedCourses.some(course => course.url === url);

    const pinButton = document.createElement('span');
    pinButton.className = 'betterEclass-pin-button';
    pinButton.innerHTML = isPinned ? '📌' : '📍';
    pinButton.title = isPinned ? 'ピン留めを解除' : 'ピン留めする';
    pinButton.style.cssText = `
      cursor: pointer;
      margin-left: 5px;
      font-size: 0.9em;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    link.parentElement.addEventListener('mouseenter', () => {
      pinButton.style.opacity = '0.6';
    });
    link.parentElement.addEventListener('mouseleave', () => {
      pinButton.style.opacity = '0';
    });

    link.after(pinButton);

    pinButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const courseName = link.textContent.trim().replace(/^»\s*/, '').replace(/^△/, '');

      if (isPinned) {
        unpinCourse(url);
        pinButton.innerHTML = '📍';
        pinButton.title = 'ピン留めする';
      } else {
        pinCourse(courseName, url);
        pinButton.innerHTML = '📌';
        pinButton.title = 'ピン留めを解除';
      }

      refreshPinnedCoursesUI();
    });
  }

  // Initialize
  function init() {
    loadPinnedCourses();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          refreshPinnedCoursesUI();
          addPinButtons();
        }, 600);
      });
    } else {
      setTimeout(() => {
        refreshPinnedCoursesUI();
        addPinButtons();
      }, 600);
    }

    console.log('[BetterE-class] Pinned courses initialized');
  }

  init();
})();
