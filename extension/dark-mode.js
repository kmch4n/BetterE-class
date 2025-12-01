(function () {
    "use strict";

    const DARK_COLORS = {
        bg: {
            primary: "#0d1117",
            secondary: "#161b22",
            tertiary: "#21262d",
            hover: "#30363d",
        },
        text: {
            primary: "#c9d1d9",
            secondary: "#8b949e",
            link: "#58a6ff",
            linkVisited: "#a371f7",
        },
        border: {
            primary: "#30363d",
            secondary: "#21262d",
        },
        accent: {
            blue: "#58a6ff",
            red: "#ff7b72",
            green: "#7ee787",
            yellow: "#d29922",
            orange: "#ffa657",
        },
    };

    function createDarkModeStyles() {
        const style = document.createElement("style");
        style.id = "betterEclassDarkMode";
        style.textContent = `
      /* Base elements */
      html, body {
        background-color: ${DARK_COLORS.bg.primary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Links - GitHub style with subtle underline for accessibility */
      a,
      a:link,
      a:visited {
        color: ${DARK_COLORS.text.primary} !important;
        text-decoration: none !important;
        border-bottom: 1px dotted ${DARK_COLORS.text.secondary} !important;
        transition: all 0.2s ease !important;
      }
      a:hover,
      a:focus,
      a:active {
        color: ${DARK_COLORS.accent.blue} !important;
        border-bottom-style: solid !important;
        border-bottom-color: ${DARK_COLORS.accent.blue} !important;
      }

      /* Remove underline from navigation links */
      .navbar a,
      .nav a,
      .breadcrumb a {
        border-bottom: none !important;
      }

      /* Tables */
      table {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table td, table th {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table tr:hover td {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }

      /* Panels and cards */
      .panel, .panel-default, .panel-body, .panel-heading {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Navbar - dark theme with subtle accent */
      .navbar-default {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .navbar-default .navbar-brand {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .navbar-default .navbar-brand a {
        color: ${DARK_COLORS.accent.blue} !important;
        font-weight: 600 !important;
      }
      .navbar-default .navbar-nav > li > a {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .navbar-default .navbar-nav > li > a:hover,
      .navbar-default .navbar-nav > li > a:focus {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .navbar-default .navbar-nav > .active > a,
      .navbar-default .navbar-nav > .active > a:hover,
      .navbar-default .navbar-nav > .active > a:focus {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .navbar-toggle {
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .navbar-toggle .icon-bar {
        background-color: ${DARK_COLORS.text.primary} !important;
      }

      /* Navbar dropdown menus */
      .navbar .dropdown-menu {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .navbar .dropdown-menu > li > a {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .navbar .dropdown-menu > li > a:hover,
      .navbar .dropdown-menu > li > a:focus {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .navbar .dropdown-menu .divider {
        background-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Footer */
      footer,
      .ft-footer {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
        color: ${DARK_COLORS.text.secondary} !important;
      }
      .ft-footer_message {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* Information boxes */
      .info-list li, .infopkg {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Course tree */
      .courseTree, .courseTree li,
      .courseLevelOne, .courseLevelOne li,
      .courseLevelTwo, .courseLevelTwo li {
        background-color: transparent !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Inputs and textareas */
      input[type="text"],
      input[type="password"],
      input[type="email"],
      input[type="number"],
      input[type="search"],
      textarea,
      select {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      input::placeholder,
      textarea::placeholder {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* Buttons */
      .btn, button {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .btn:hover, button:hover {
        background-color: ${DARK_COLORS.border.primary} !important;
      }
      .btn-primary {
        background-color: ${DARK_COLORS.accent.blue} !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
        color: #0d1117 !important;
      }
      .btn-primary:hover {
        background-color: #479de8 !important;
      }

      /* Alerts */
      .alert {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .alert-info {
        background-color: rgba(88, 166, 255, 0.1) !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .alert-warning {
        background-color: rgba(210, 153, 34, 0.1) !important;
        border-color: ${DARK_COLORS.accent.yellow} !important;
        color: ${DARK_COLORS.accent.yellow} !important;
      }
      .alert-danger {
        background-color: rgba(255, 123, 114, 0.1) !important;
        border-color: ${DARK_COLORS.accent.red} !important;
        color: ${DARK_COLORS.accent.red} !important;
      }

      /* Modals */
      .modal,
      .modal-dialog,
      .modal-content {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .modal-header,
      .modal-body,
      .modal-footer {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .modal-title {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .modal-backdrop {
        background-color: #000000 !important;
      }

      /* Breadcrumbs */
      .breadcrumb {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Schedule table */
      .schedule-table td {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Side blocks */
      .side_block, .sideblock, .side-block {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* BetterE-class Deadline List Widget - Dark Mode */
      #betterEclassDeadlineList .side-block {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.accent.red} !important;
      }
      #betterEclassDeadlineList .side-block-content {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      #betterEclassDeadlineList .deadline-item {
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclassDeadlineList .deadline-item:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      #betterEclassDeadlineList .deadline-course-name {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclassDeadlineList .deadline-course-name:hover {
        color: ${DARK_COLORS.accent.red} !important;
      }
      #betterEclassDeadlineList .deadline-warning {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclassDeadlineList .deadline-count {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.red} !important;
      }

      /* BetterE-class Pinned Courses Widget - Dark Mode */
      #betterEclassPinnedCourses .side-block {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclassPinnedCourses .side-block-content {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      #betterEclassPinnedCourses .pinned-item {
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclassPinnedCourses .pinned-item:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      #betterEclassPinnedCourses .pinned-course-name {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclassPinnedCourses .pinned-course-name:hover {
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclassPinnedCourses .unpin-button {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclassPinnedCourses .unpin-button:hover {
        color: ${DARK_COLORS.accent.red} !important;
      }
      #betterEclassPinnedCourses .pinned-count {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }

      /* Deadline warning - keep red emphasis */
      .course-contents-info {
        color: ${DARK_COLORS.accent.red} !important;
        font-weight: bold !important;
        background-color: rgba(255, 123, 114, 0.15) !important;
        border: 1px solid ${DARK_COLORS.accent.red} !important;
      }

      /* List groups */
      .list-group-item {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Wells */
      .well {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Course tree titles and backgrounds */
      .courseTree-levelTitle {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .courseLevelTwo li .title {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .courseLevelTwo li h5 {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .courseList li {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Course links and info */
      .course-title a,
      .course-data-box-normal a {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .course-title a:hover,
      .course-data-box-normal a:hover {
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .course-info,
      .course-memo,
      .course-message {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* Side block titles */
      .side-block-title,
      #UserTopInfo .page-header {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Schedule table enhancements */
      .schedule-table thead td,
      .schedule-table thead th {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .schedule-table thead th.active {
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .schedule-table tbody td {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      .schedule-table tbody td.active {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      .schedule-table tbody td.blank,
      .schedule-table tbody td.active-blank {
        background-color: ${DARK_COLORS.bg.primary} !important;
      }
      .schedule-table-class_order {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Schedule list for mobile */
      .schedule-list .class-order {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .list-group-label-item {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Admin notices section */
      #UserTopInfo,
      #NewestInformations,
      #AjaxInfoBox,
      .infopkg {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      #UserTopInfo .page-header {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Info list */
      .info-list,
      .info-list li {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .info-list li.head {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .info-list li.odd,
      .info-list li.eve {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .info-list .exhibitionInfo {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      .info-list a {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .info-list a:hover {
        color: ${DARK_COLORS.accent.blue} !important;
      }

      /* Dropdown menus */
      .dropdown-menu {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .dropdown-menu > li > a {
        color: ${DARK_COLORS.text.primary} !important;
      }
      .dropdown-menu > li > a:hover,
      .dropdown-menu > li > a:focus {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .dropdown-menu .divider {
        background-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Fix white backgrounds from inline styles */
      [style*="background: #fff"],
      [style*="background: #ffffff"],
      [style*="background-color: #fff"],
      [style*="background-color: #ffffff"],
      [style*="background-color: white"],
      [style*="background: white"] {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Fix specific inline background colors */
      [style*="background-color: #eaf4fc"],
      [style*="background-color: #f8f8f8"],
      [style*="background-color: #f9f9f9"],
      [style*="background-color: #f7f7f7"],
      [style*="background-color: #f0f0f0"] {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Fix white borders from inline styles */
      [style*="border: solid #fff"],
      [style*="border: solid #ffffff"],
      [style*="border-color: #fff"],
      [style*="border-color: #ffffff"],
      [style*="border-color: white"] {
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* HTML table attributes */
      table[bordercolor="#ffffff"],
      table[bordercolor="#fff"],
      table[bordercolor="white"] {
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table[bgcolor="#ffffff"],
      table[bgcolor="#fff"],
      table[bgcolor="white"],
      td[bgcolor="#ffffff"],
      td[bgcolor="#fff"],
      td[bgcolor="white"],
      tr[bgcolor="#ffffff"],
      tr[bgcolor="#fff"],
      tr[bgcolor="white"] {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Images and icons - ensure they remain visible */
      img {
        opacity: 0.9;
      }

      /* Code blocks */
      pre, code {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Scrollbars */
      ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }
      ::-webkit-scrollbar-track {
        background: ${DARK_COLORS.bg.primary};
      }
      ::-webkit-scrollbar-thumb {
        background: ${DARK_COLORS.bg.hover};
        border-radius: 6px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: ${DARK_COLORS.border.primary};
      }

      /* Timeline (course.php specific) */
      .timeline-action {
        background-color: transparent !important;
      }
      .timeline-messages {
        background-color: transparent !important;
      }
      .timeline-post-form {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Tab navigation */
      .nav-tabs {
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      .nav-tabs > li > a {
        color: ${DARK_COLORS.text.primary} !important;
        background-color: transparent !important;
        border-color: transparent !important;
      }
      .nav-tabs > li > a:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      .nav-tabs > li.active > a,
      .nav-tabs > li.active > a:hover,
      .nav-tabs > li.active > a:focus {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
        border-bottom-color: transparent !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }

      /* Tab content */
      .tab-content {
        background-color: transparent !important;
      }
      .tab-pane {
        background-color: transparent !important;
      }

      /* Form controls */
      .form-control {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .form-control:focus {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Labels and badges */
      .label {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .badge {
        background-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.bg.primary} !important;
      }

      /* Page header */
      .page-header {
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Close button */
      .close {
        color: ${DARK_COLORS.text.primary} !important;
        opacity: 0.6 !important;
      }
      .close:hover {
        color: ${DARK_COLORS.text.primary} !important;
        opacity: 1 !important;
      }

      /* BetterE-class TOC Sidebar - Dark Mode */
      #betterEclass-toc-sidebar {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-sidebar-header {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-sidebar-header h4 {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-toggle-btn {
        background: none !important;
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .toc-toggle-btn:hover {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-expand-controls {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      #betterEclass-toc-sidebar .toc-expand-all-btn,
      #betterEclass-toc-sidebar .toc-collapse-all-btn {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-expand-all-btn:hover,
      #betterEclass-toc-sidebar .toc-collapse-all-btn:hover {
        background-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-sidebar-content {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      #betterEclass-toc-sidebar .toc-list {
        background-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-item {
        background-color: transparent !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-item-header {
        background-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-item.active-section > .toc-item-header {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      #betterEclass-toc-sidebar .toc-link,
      #betterEclass-toc-sidebar .toc-item-link {
        color: ${DARK_COLORS.text.primary} !important;
        background-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-link:hover,
      #betterEclass-toc-sidebar .toc-item-link:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
        border-left-color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .toc-link.active,
      #betterEclass-toc-sidebar .toc-item-link.active {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.accent.blue} !important;
        border-left-color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .toc-link.locked,
      #betterEclass-toc-sidebar .toc-item-link.locked {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .toc-link.locked:hover,
      #betterEclass-toc-sidebar .toc-item-link.locked:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }

      /* Sublist (expanded items) */
      #betterEclass-toc-sidebar .toc-sublist {
        background-color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-subitem {
        background-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-sublink {
        color: ${DARK_COLORS.text.secondary} !important;
        background-color: transparent !important;
        border-left-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-sublink:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .toc-sublink.active {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .toc-sublink.locked {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .toc-sublink.locked:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }

      /* Flat list */
      #betterEclass-toc-sidebar .flat-list .toc-item {
        border-bottom-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-toc-sidebar .flat-list .toc-link.locked:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }

      /* Other elements */
      #betterEclass-toc-sidebar .toc-sub-list {
        background-color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-toc-sidebar .toc-sub-item-link {
        color: ${DARK_COLORS.text.secondary} !important;
        background-color: transparent !important;
      }
      #betterEclass-toc-sidebar .toc-sub-item-link:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .toc-sub-item-link.active {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-toc-sidebar .material-type-badge {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .material-type-icon {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .new-badge {
        color: ${DARK_COLORS.accent.orange} !important;
      }
      #betterEclass-toc-sidebar .toc-expand-icon {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-toc-sidebar .lock-icon {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* Navbar active items - fix blue text */
      .navbar-default .navbar-nav > .active > a {
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* BetterE-class Available Materials Widget - Dark Mode */
      #betterEclass-available-materials {
        background-color: transparent !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-available-materials .widget-header {
        background-color: transparent !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-available-materials .widget-header h4,
      #betterEclass-available-materials .page-header {
        color: ${DARK_COLORS.text.primary} !important;
        border-bottom-color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-available-materials .material-count {
        background-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-available-materials .materials-list {
        background-color: transparent !important;
      }
      #betterEclass-available-materials .material-section {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-available-materials .section-header {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-available-materials .section-header:hover {
        background-color: ${DARK_COLORS.bg.hover} !important;
      }
      #betterEclass-available-materials .section-toggle {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-available-materials .section-title {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-available-materials .section-count {
        color: ${DARK_COLORS.text.secondary} !important;
        background-color: ${DARK_COLORS.bg.hover} !important;
      }
      #betterEclass-available-materials .section-content {
        background-color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-available-materials .material-item {
        background-color: transparent !important;
        border-top-color: ${DARK_COLORS.border.primary} !important;
      }
      #betterEclass-available-materials .material-item:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      #betterEclass-available-materials .material-link {
        color: ${DARK_COLORS.text.primary} !important;
        background-color: transparent !important;
      }
      #betterEclass-available-materials .material-link:hover {
        color: ${DARK_COLORS.accent.blue} !important;
      }
      #betterEclass-available-materials .material-title {
        color: ${DARK_COLORS.text.primary} !important;
      }
      #betterEclass-available-materials .material-type-icon {
        color: ${DARK_COLORS.text.secondary} !important;
      }
      #betterEclass-available-materials .new-badge,
      #betterEclass-available-materials .new-badge-prefix {
        background-color: ${DARK_COLORS.accent.orange} !important;
        color: ${DARK_COLORS.bg.primary} !important;
      }
      #betterEclass-available-materials .unread-dot {
        background-color: ${DARK_COLORS.accent.red} !important;
      }
      #betterEclass-available-materials .material-deadline,
      #betterEclass-available-materials .deadline-badge {
        background-color: ${DARK_COLORS.accent.red} !important;
        color: ${DARK_COLORS.bg.primary} !important;
      }

      /* Scroll highlight animation - use dark yellow instead of light yellow */
      [style*="background-color: rgb(255, 243, 205)"],
      [style*="background-color:#fff3cd"] {
        background-color: rgba(210, 153, 34, 0.3) !important;
      }

      /* Message page specific styles */
      .pkgtitle.bgc_main {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      dt.bgc_main {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      th.bgc_main {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .bgc_main {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Message editinfo table */
      table.editinfo {
        background-color: transparent !important;
      }
      table.editinfo th {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table.editinfo td {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table.editinfo tr.opsection td {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      table.editinfo input,
      table.editinfo textarea,
      table.editinfo select {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }

      /* Message list styles */
      .msg table {
        background-color: transparent !important;
      }
      .msg table th {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      .msg table td {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .msg table tr:hover td {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }

      /* Message header compose */
      .msg .header_compose td {
        background-color: ${DARK_COLORS.bg.secondary} !important;
        color: ${DARK_COLORS.text.primary} !important;
      }

      /* Sort icons in message table headers */
      .sorticon {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* BetterE-class Mark All as Read button */
      #betterEclassMarkAllAsRead {
        background-color: ${DARK_COLORS.accent.blue} !important;
        color: ${DARK_COLORS.bg.primary} !important;
        box-shadow: 0 2px 4px rgba(88, 166, 255, 0.3) !important;
      }
      #betterEclassMarkAllAsRead:hover {
        background-color: #479de8 !important;
        box-shadow: 0 4px 8px rgba(88, 166, 255, 0.4) !important;
      }

      /* Checkboxes - dark mode styling */
      input[type="checkbox"] {
        appearance: none !important;
        -webkit-appearance: none !important;
        width: 16px !important;
        height: 16px !important;
        border: 2px solid ${DARK_COLORS.border.primary} !important;
        border-radius: 3px !important;
        background-color: ${DARK_COLORS.bg.hover} !important;
        cursor: pointer !important;
        position: relative !important;
        vertical-align: middle !important;
      }
      input[type="checkbox"]:hover {
        border-color: ${DARK_COLORS.accent.blue} !important;
      }
      input[type="checkbox"]:checked {
        background-color: ${DARK_COLORS.accent.blue} !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
      }
      input[type="checkbox"]:checked::after {
        content: "✓" !important;
        position: absolute !important;
        top: -2px !important;
        left: 2px !important;
        color: ${DARK_COLORS.bg.primary} !important;
        font-size: 12px !important;
        font-weight: bold !important;
      }

      /* Message page table rows */
      #MsgBox,
      #MsgBox tbody,
      #MsgBox thead {
        background-color: transparent !important;
      }
      #MsgBox tr,
      #MsgBox tr.odd,
      #MsgBox tr.eve {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }
      #MsgBox td {
        background-color: transparent !important;
        color: ${DARK_COLORS.text.primary} !important;
      }
      #MsgBox tr:hover,
      #MsgBox tr:hover td {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
      }
      #MsgBox td[bgcolor="#EEEEEE"],
      #MsgBox td[bgcolor="#161b22"] {
        background-color: ${DARK_COLORS.bg.secondary} !important;
      }

      /* Message page buttons (削除, 既読にする, ダウンロード) */
      .msg input[type="submit"],
      form[name="condition"] input[type="submit"] {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border: 1px solid ${DARK_COLORS.border.primary} !important;
        padding: 6px 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }
      .msg input[type="submit"]:hover,
      form[name="condition"] input[type="submit"]:hover {
        background-color: ${DARK_COLORS.bg.tertiary} !important;
        border-color: ${DARK_COLORS.accent.blue} !important;
      }

      /* Message page header area */
      .msg table[align="center"],
      form[name="condition"] > table,
      form[name="condition"] table {
        background-color: transparent !important;
      }
      .msg table[align="center"] td,
      form[name="condition"] > table td,
      form[name="condition"] table td,
      form[name="condition"] td {
        background-color: transparent !important;
      }

      /* Message page dimgray text */
      .dimgray {
        color: ${DARK_COLORS.text.secondary} !important;
      }

      /* Message page - force all tables and cells to be dark */
      form[enctype="multipart/form-data"] table,
      form[enctype="multipart/form-data"] tbody,
      form[enctype="multipart/form-data"] tr,
      form[enctype="multipart/form-data"] td:not([class*="bgc_"]) {
        background-color: transparent !important;
      }

      /* Message page specific - white background override */
      body table,
      body table tbody,
      body table tr {
        background-color: transparent !important;
      }
      body table td:not(.bgc_main):not([bgcolor]) {
        background-color: transparent !important;
      }
    `;
        return style;
    }

    function fixInlineStyles() {
        const allElements = document.querySelectorAll("*[style]");

        allElements.forEach((element) => {
            const style = element.getAttribute("style");
            if (!style) return;

            // Skip navbar bar itself but allow dropdown menus to be styled
            if (
                element.closest(".navbar-header, .navbar-brand, .navbar-toggle")
            )
                return;
            // Allow navbar dropdown menus and user icon to be processed
            const isNavbarDropdown = element.closest(".navbar .dropdown-menu");
            const isNavbarImage =
                element.tagName === "IMG" && element.closest(".navbar");
            if (
                !isNavbarDropdown &&
                !isNavbarImage &&
                element.closest(".navbar-nav > li > a")
            )
                return;

            let newStyle = style
                // Background colors
                .replace(
                    /background:\s*#ffffff(?![0-9a-fA-F])/gi,
                    `background: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background:\s*#fff(?![0-9a-fA-F])/gi,
                    `background: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background:\s*white(?![;])/gi,
                    `background: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*#ffffff(?![0-9a-fA-F])/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*#fff(?![0-9a-fA-F])/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*white/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*#eaf4fc/gi,
                    `background-color: ${DARK_COLORS.bg.tertiary}`,
                )
                .replace(
                    /background-color:\s*#f8f8f8/gi,
                    `background-color: ${DARK_COLORS.bg.tertiary}`,
                )
                .replace(
                    /background-color:\s*#f9f9f9/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*#f7f7f7/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                .replace(
                    /background-color:\s*#f0f0f0/gi,
                    `background-color: ${DARK_COLORS.bg.secondary}`,
                )
                // Scroll highlight animation - yellow background
                .replace(
                    /background-color:\s*#fff3cd/gi,
                    `background-color: rgba(210, 153, 34, 0.3)`,
                )
                .replace(
                    /background-color:\s*rgb\(255,\s*243,\s*205\)/gi,
                    `background-color: rgba(210, 153, 34, 0.3)`,
                )
                // Border colors
                .replace(
                    /border:\s*(\d+px\s+)?solid\s+#ffffff/gi,
                    `border: $1solid ${DARK_COLORS.border.primary}`,
                )
                .replace(
                    /border:\s*(\d+px\s+)?solid\s+#fff(?![0-9a-fA-F])/gi,
                    `border: $1solid ${DARK_COLORS.border.primary}`,
                )
                .replace(
                    /border:\s*(\d+px\s+)?solid\s+white/gi,
                    `border: $1solid ${DARK_COLORS.border.primary}`,
                )
                .replace(
                    /border-color:\s*#ffffff/gi,
                    `border-color: ${DARK_COLORS.border.primary}`,
                )
                .replace(
                    /border-color:\s*#fff(?![0-9a-fA-F])/gi,
                    `border-color: ${DARK_COLORS.border.primary}`,
                )
                .replace(
                    /border-color:\s*white/gi,
                    `border-color: ${DARK_COLORS.border.primary}`,
                )
                // Text colors - only fix black text
                .replace(
                    /color:\s*#000000(?![0-9a-fA-F])/gi,
                    `color: ${DARK_COLORS.text.primary}`,
                )
                .replace(
                    /color:\s*#000(?![0-9a-fA-F])/gi,
                    `color: ${DARK_COLORS.text.primary}`,
                )
                .replace(
                    /color:\s*black/gi,
                    `color: ${DARK_COLORS.text.primary}`,
                );

            if (newStyle !== style) {
                element.setAttribute("style", newStyle);
            }
        });

        // Fix HTML attributes
        const elementsWithBorderColorAttr =
            document.querySelectorAll("[bordercolor]");
        elementsWithBorderColorAttr.forEach((element) => {
            const borderColor = element.getAttribute("bordercolor");
            if (
                borderColor &&
                (borderColor.toLowerCase() === "#ffffff" ||
                    borderColor.toLowerCase() === "#fff" ||
                    borderColor.toLowerCase() === "white")
            ) {
                element.setAttribute("bordercolor", DARK_COLORS.border.primary);
                element.style.borderColor = DARK_COLORS.border.primary;
            }
        });

        const elementsWithBgColorAttr = document.querySelectorAll("[bgcolor]");
        elementsWithBgColorAttr.forEach((element) => {
            const bgColor = element.getAttribute("bgcolor");
            const lowerBgColor = bgColor ? bgColor.toLowerCase() : "";
            if (
                lowerBgColor === "#ffffff" ||
                lowerBgColor === "#fff" ||
                lowerBgColor === "white"
            ) {
                element.setAttribute("bgcolor", DARK_COLORS.bg.secondary);
                element.style.backgroundColor = DARK_COLORS.bg.secondary;
            } else if (lowerBgColor === "#eeeeee" || lowerBgColor === "#eee") {
                element.setAttribute("bgcolor", DARK_COLORS.bg.secondary);
                element.style.backgroundColor = DARK_COLORS.bg.secondary;
            }
        });

        // Fix computed white backgrounds
        const whiteBackgroundSelectors = [
            ".infopkg",
            ".info-list li",
            ".schedule-table td",
            ".courseTree li",
            ".courseLevelOne li",
            ".courseLevelTwo li",
            ".panel",
            ".panel-body",
            ".list-group-item",
            ".well",
            // Message page specific
            "table",
            "tbody",
            "tr",
            "td",
        ];

        whiteBackgroundSelectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
                const computedStyle = window.getComputedStyle(el);
                const bgColor = computedStyle.backgroundColor;

                if (bgColor === "rgb(255, 255, 255)" || bgColor === "white") {
                    // Skip if it has bgc_main class or specific bgcolor attribute
                    if (
                        !el.classList.contains("bgc_main") &&
                        !el.hasAttribute("bgcolor")
                    ) {
                        el.style.backgroundColor = "transparent";
                    }
                }
            });
        });
    }

    async function checkDarkModeEnabled() {
        try {
            // Use storage.local for faster access to prevent white flash
            const result = await chrome.storage.local.get({
                enableDarkMode: false,
            });
            return result.enableDarkMode;
        } catch (error) {
            console.error(
                "[BetterE-class] Failed to load dark mode setting:",
                error,
            );
            return false;
        }
    }

    async function applyDarkMode() {
        console.log("[BetterE-class] Applying dark mode");

        // Check if this is a message page
        const isMessagePage =
            window.location.href.includes("msg_editor.php") ||
            window.location.href.includes("msg_viewer.php");

        if (isMessagePage) {
            // Show warning banner for message pages
            showMessagePageWarning();
            return;
        }

        // Inject styles immediately to prevent white flash
        if (!document.getElementById("betterEclassDarkMode")) {
            const styleElement = createDarkModeStyles();
            (document.head || document.documentElement).appendChild(
                styleElement,
            );
        }

        // Fix inline styles immediately and on delay
        fixInlineStyles();
        setTimeout(() => fixInlineStyles(), 100);
        setTimeout(() => fixInlineStyles(), 500);
        setTimeout(() => fixInlineStyles(), 1000);

        // Watch for dynamic changes
        if (!window.betterEclassDarkModeObserver) {
            window.betterEclassDarkModeObserver = new MutationObserver(
                (mutations) => {
                    requestAnimationFrame(() => fixInlineStyles());
                },
            );

            window.betterEclassDarkModeObserver.observe(
                document.documentElement,
                {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: [
                        "style",
                        "border",
                        "bordercolor",
                        "bgcolor",
                    ],
                },
            );
        }
    }

    function showMessagePageWarning() {
        if (document.getElementById("betterEclassDarkModeWarning")) return;

        const banner = document.createElement("div");
        banner.id = "betterEclassDarkModeWarning";
        banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #d29922;
      color: #0d1117;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
        banner.textContent =
            "⚠️ ダークモードはメッセージページに対応していません";

        document.body.appendChild(banner);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            banner.style.transition = "opacity 0.5s";
            banner.style.opacity = "0";
            setTimeout(() => banner.remove(), 500);
        }, 5000);
    }

    function removeDarkMode() {
        const styleElement = document.getElementById("betterEclassDarkMode");
        if (styleElement) {
            styleElement.remove();
        }

        if (window.betterEclassDarkModeObserver) {
            window.betterEclassDarkModeObserver.disconnect();
            window.betterEclassDarkModeObserver = null;
        }
    }

    // Listen for settings changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "darkModeSettingChanged") {
            checkDarkModeEnabled().then((enabled) => {
                if (enabled) {
                    applyDarkMode();
                } else {
                    removeDarkMode();
                }
            });
        }
    });

    // Initialize: Apply CSS immediately if enabled, to prevent white flash
    (async function initDarkMode() {
        const enabled = await checkDarkModeEnabled();
        if (enabled) {
            // Apply dark mode immediately
            applyDarkMode();
        }
    })();
})();
