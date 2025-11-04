// Display list of courses with approaching deadlines
(function createDeadlineList() {
  // Settings
  let settings = {
    enableDeadlineHighlight: true
  };

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableDeadlineHighlight: true
      });
      settings = result;
      return result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return settings;
    }
  }

  // Extract courses with deadlines
  function getCoursesWithDeadlines() {
    const courses = [];
    const seen = new Set(); // Track unique courses by URL
    const deadlineElements = document.querySelectorAll('.course-contents-info');

    deadlineElements.forEach(element => {
      // Find the parent link (course link)
      const courseLink = element.closest('a') || element.closest('td')?.querySelector('a');

      if (courseLink) {
        const courseUrl = courseLink.href;

        // Skip if we've already seen this course URL
        if (seen.has(courseUrl)) {
          return;
        }
        seen.add(courseUrl);

        const courseName = courseLink.textContent.trim().replace(/^»\s*/, '');

        // Extract just the subject name without the code
        const cleanCourseName = courseName.replace(/^△/, '').split('-')[0].trim();

        courses.push({
          name: cleanCourseName,
          fullName: courseName,
          url: courseUrl,
          warning: element.textContent.trim()
        });
      }
    });

    return courses;
  }

  // Create deadline list UI
  function createDeadlineListUI(courses) {
    if (courses.length === 0) return null;

    const container = document.createElement('div');
    container.id = 'betterEclassDeadlineList';
    container.className = 'side-block-outer';
    container.style.cssText = `
      margin-bottom: 20px;
      animation: slideIn 0.3s ease-out;
    `;

    container.innerHTML = `
      <style>
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        #betterEclassDeadlineList .side-block {
          border: 2px solid #ff4444;
          border-radius: 6px;
          overflow: hidden;
        }

        #betterEclassDeadlineList .side-block-title {
          background: linear-gradient(135deg, #ff4444 0%, #cc3333 100%);
          color: white;
          padding: 12px 15px;
          margin: 0;
          font-size: 14px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        #betterEclassDeadlineList .side-block-content {
          background-color: #fff9f9;
          padding: 0;
        }

        #betterEclassDeadlineList .deadline-item {
          padding: 12px 15px;
          border-bottom: 1px solid #ffe0e0;
          transition: background-color 0.2s;
        }

        #betterEclassDeadlineList .deadline-item:last-child {
          border-bottom: none;
        }

        #betterEclassDeadlineList .deadline-item:hover {
          background-color: #ffebeb;
        }

        #betterEclassDeadlineList .deadline-course-name {
          color: #cc3333;
          font-weight: bold;
          font-size: 13px;
          text-decoration: none;
          display: block;
          margin-bottom: 4px;
        }

        #betterEclassDeadlineList .deadline-course-name:hover {
          color: #ff4444;
          text-decoration: underline;
        }

        #betterEclassDeadlineList .deadline-warning {
          color: #666;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        #betterEclassDeadlineList .deadline-count {
          background-color: white;
          color: #ff4444;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
      </style>
      <div class="side-block">
        <h4 class="side-block-title">
          <span style="font-size: 18px;">⚠</span>
          締切が近い課題
          <span class="deadline-count">${courses.length}件</span>
        </h4>
        <div class="side-block-content">
          ${courses.map(course => `
            <div class="deadline-item">
              <a href="${course.url}" class="deadline-course-name" target="_top">
                ${course.name}
              </a>
              <div class="deadline-warning">
                <span style="color: #ff4444;">📌</span>
                ${course.warning.replace('⚠ ', '')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return container;
  }

  // Insert deadline list into the page
  function insertDeadlineList() {
    // First, remove any existing deadline list to prevent duplicates
    const existingList = document.getElementById('betterEclassDeadlineList');
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
    const sidebar = document.querySelector('.col-sm-3');

    if (sidebar) {
      // Insert at the top of the sidebar
      const firstBlock = sidebar.querySelector('.side-block-outer');
      if (firstBlock) {
        sidebar.insertBefore(deadlineListUI, firstBlock);
      } else {
        sidebar.insertBefore(deadlineListUI, sidebar.firstChild);
      }
    } else {
      // Fallback: insert after UserTopInfo
      const userTopInfo = document.getElementById('UserTopInfo');
      if (userTopInfo) {
        userTopInfo.after(deadlineListUI);
      }
    }

    console.log(`[BetterE-class] 締切が近い課題: ${courses.length}件を表示しました`);
  }

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsChanged') {
      settings = message.settings;
      insertDeadlineList();
    }
  });

  // Initialize
  async function init() {
    await loadSettings();

    // Wait for the page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(insertDeadlineList, 500);
      });
    } else {
      setTimeout(insertDeadlineList, 500);
    }
  }

  init();
})();
