(function () {
    "use strict";

    const settingsAPI = window.BetterEclassUtils.settings;
    let DEBUG = false;
    let pendingStyleFixFrame = null;
    let styleScanCount = 0;
    let darkModeActive = false;
    // Element -> Map(attribute name -> { original, written }) for every attribute dark mode rewrote
    const trackedAttributes = new Map();

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
      /* .bec-scope UI is themed through bec-tokens.css instead */
      a:not(.bec-scope *),
      a:link:not(.bec-scope *),
      a:visited:not(.bec-scope *) {
        color: ${DARK_COLORS.text.primary} !important;
        text-decoration: none !important;
        border-bottom: 1px dotted ${DARK_COLORS.text.secondary} !important;
        transition: all 0.2s ease !important;
      }
      a:hover:not(.bec-scope *),
      a:focus:not(.bec-scope *),
      a:active:not(.bec-scope *) {
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
      .btn:not(.bec-scope *), button:not(.bec-scope *) {
        background-color: ${DARK_COLORS.bg.hover} !important;
        color: ${DARK_COLORS.text.primary} !important;
        border-color: ${DARK_COLORS.border.primary} !important;
      }
      .btn:hover:not(.bec-scope *), button:hover:not(.bec-scope *) {
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

      /* Deadline warning - keep red emphasis (the highlight chip is themed through bec-tokens.css) */
      .course-contents-info:not(.bec-deadline-chip) {
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

      /* Navbar active items - fix blue text */
      .navbar-default .navbar-nav > .active > a {
        color: ${DARK_COLORS.text.primary} !important;
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

    // Every pattern starts at a declaration boundary ("(^|;)\s*") so that, for example, the text
    // "color:" rule cannot match the tail of "background-color:" or "border-color:".
    function rewriteInlineStyle(style) {
        const { bg, border, text } = DARK_COLORS;
        return (
            style
                // Background colors
                .replace(/(^|;)(\s*)background:\s*#ffffff(?![0-9a-fA-F])/gi, `$1$2background: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background:\s*#fff(?![0-9a-fA-F])/gi, `$1$2background: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background:\s*white\b(?!-)/gi, `$1$2background: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*#ffffff(?![0-9a-fA-F])/gi, `$1$2background-color: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*#fff(?![0-9a-fA-F])/gi, `$1$2background-color: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*white\b(?!-)/gi, `$1$2background-color: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*#eaf4fc/gi, `$1$2background-color: ${bg.tertiary}`)
                .replace(/(^|;)(\s*)background-color:\s*#f8f8f8/gi, `$1$2background-color: ${bg.tertiary}`)
                .replace(/(^|;)(\s*)background-color:\s*#f9f9f9/gi, `$1$2background-color: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*#f7f7f7/gi, `$1$2background-color: ${bg.secondary}`)
                .replace(/(^|;)(\s*)background-color:\s*#f0f0f0/gi, `$1$2background-color: ${bg.secondary}`)
                // Scroll highlight animation - yellow background
                .replace(/(^|;)(\s*)background-color:\s*#fff3cd/gi, "$1$2background-color: rgba(210, 153, 34, 0.3)")
                .replace(/(^|;)(\s*)background-color:\s*rgb\(255,\s*243,\s*205\)/gi, "$1$2background-color: rgba(210, 153, 34, 0.3)")
                // Border colors
                .replace(/(^|;)(\s*)border:\s*(\d+px\s+)?solid\s+#ffffff/gi, `$1$2border: $3solid ${border.primary}`)
                .replace(/(^|;)(\s*)border:\s*(\d+px\s+)?solid\s+#fff(?![0-9a-fA-F])/gi, `$1$2border: $3solid ${border.primary}`)
                .replace(/(^|;)(\s*)border:\s*(\d+px\s+)?solid\s+white\b(?!-)/gi, `$1$2border: $3solid ${border.primary}`)
                .replace(/(^|;)(\s*)border-color:\s*#ffffff/gi, `$1$2border-color: ${border.primary}`)
                .replace(/(^|;)(\s*)border-color:\s*#fff(?![0-9a-fA-F])/gi, `$1$2border-color: ${border.primary}`)
                .replace(/(^|;)(\s*)border-color:\s*white\b(?!-)/gi, `$1$2border-color: ${border.primary}`)
                // Text colors - only fix black text
                .replace(/(^|;)(\s*)color:\s*#000000(?![0-9a-fA-F])/gi, `$1$2color: ${text.primary}`)
                .replace(/(^|;)(\s*)color:\s*#000(?![0-9a-fA-F])/gi, `$1$2color: ${text.primary}`)
                .replace(/(^|;)(\s*)color:\s*black\b/gi, `$1$2color: ${text.primary}`)
        );
    }

    // Remember the value before our first write and our latest write, so turning dark mode off can
    // restore the page without a reload.
    function recordAttributeWrite(element, name, previousValue) {
        let attributes = trackedAttributes.get(element);
        if (!attributes) {
            attributes = new Map();
            trackedAttributes.set(element, attributes);
        }
        const entry = attributes.get(name);
        // A value that differs from our last write came from the page, so it becomes the new original
        if (!entry || previousValue !== entry.written) {
            attributes.set(name, { original: previousValue, written: element.getAttribute(name) });
        } else {
            entry.written = element.getAttribute(name);
        }
    }

    function setTrackedAttribute(element, name, value) {
        const previousValue = element.getAttribute(name);
        element.setAttribute(name, value);
        recordAttributeWrite(element, name, previousValue);
    }

    function trackStyleMutation(element, mutate) {
        const previousValue = element.getAttribute("style");
        mutate(element.style);
        recordAttributeWrite(element, "style", previousValue);
    }

    function restoreTrackedAttributes() {
        trackedAttributes.forEach((attributes, element) => {
            attributes.forEach((entry, name) => {
                // Keep values the page changed after our write
                if (element.getAttribute(name) !== entry.written) return;
                if (entry.original === null) {
                    element.removeAttribute(name);
                } else {
                    element.setAttribute(name, entry.original);
                }
            });
        });
        trackedAttributes.clear();
    }

    function pruneDetachedElements() {
        trackedAttributes.forEach((_attributes, element) => {
            if (!element.isConnected) trackedAttributes.delete(element);
        });
    }

    function fixInlineStyles(trigger = "manual") {
        // Delayed scans scheduled before dark mode was turned off must not re-apply it
        if (!darkModeActive) return;
        pruneDetachedElements();

        const startedAt = performance.now();
        let scannedElements = 0;
        const allElements = document.querySelectorAll("*[style]");
        scannedElements += allElements.length;

        allElements.forEach((element) => {
            const style = element.getAttribute("style");
            if (!style) return;

            // Skip navbar bar itself but allow dropdown menus to be styled
            if (element.closest(".navbar-header, .navbar-brand, .navbar-toggle")) return;
            // Allow navbar dropdown menus and user icon to be processed
            const isNavbarDropdown = element.closest(".navbar .dropdown-menu");
            const isNavbarImage = element.tagName === "IMG" && element.closest(".navbar");
            if (!isNavbarDropdown && !isNavbarImage && element.closest(".navbar-nav > li > a")) return;

            const newStyle = rewriteInlineStyle(style);

            if (newStyle !== style) {
                setTrackedAttribute(element, "style", newStyle);
            }
        });

        // Fix HTML attributes
        const elementsWithBorderColorAttr = document.querySelectorAll("[bordercolor]");
        scannedElements += elementsWithBorderColorAttr.length;
        elementsWithBorderColorAttr.forEach((element) => {
            const borderColor = element.getAttribute("bordercolor");
            if (borderColor && (borderColor.toLowerCase() === "#ffffff" || borderColor.toLowerCase() === "#fff" || borderColor.toLowerCase() === "white")) {
                setTrackedAttribute(element, "bordercolor", DARK_COLORS.border.primary);
                trackStyleMutation(element, (style) => {
                    style.borderColor = DARK_COLORS.border.primary;
                });
            }
        });

        const elementsWithBgColorAttr = document.querySelectorAll("[bgcolor]");
        scannedElements += elementsWithBgColorAttr.length;
        elementsWithBgColorAttr.forEach((element) => {
            const bgColor = element.getAttribute("bgcolor");
            const lowerBgColor = bgColor ? bgColor.toLowerCase() : "";
            if (["#ffffff", "#fff", "white", "#eeeeee", "#eee"].includes(lowerBgColor)) {
                setTrackedAttribute(element, "bgcolor", DARK_COLORS.bg.secondary);
                trackStyleMutation(element, (style) => {
                    style.backgroundColor = DARK_COLORS.bg.secondary;
                });
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
            scannedElements += elements.length;
            elements.forEach((el) => {
                const computedStyle = window.getComputedStyle(el);
                const bgColor = computedStyle.backgroundColor;

                if (bgColor === "rgb(255, 255, 255)" || bgColor === "white") {
                    // Skip if it has bgc_main class or specific bgcolor attribute
                    if (!el.classList.contains("bgc_main") && !el.hasAttribute("bgcolor")) {
                        trackStyleMutation(el, (style) => {
                            style.backgroundColor = "transparent";
                        });
                    }
                }
            });
        });

        styleScanCount += 1;
        if (DEBUG) {
            console.debug("[BetterE-class] Dark mode DOM scan", {
                trigger,
                scan: styleScanCount,
                elements: scannedElements,
                durationMs: Number((performance.now() - startedAt).toFixed(2)),
            });
        }
    }

    function scheduleInlineStyleFix(trigger) {
        if (!darkModeActive || pendingStyleFixFrame !== null) return;
        pendingStyleFixFrame = requestAnimationFrame(() => {
            pendingStyleFixFrame = null;
            fixInlineStyles(trigger);
        });
    }

    async function checkDarkModeEnabled() {
        try {
            const settings = await settingsAPI.getSettings(["enableDarkMode", "debugMode"]);
            DEBUG = settings.debugMode;
            return settings.enableDarkMode;
        } catch (error) {
            console.error("[BetterE-class] Failed to load dark mode setting:", error);
            return false;
        }
    }

    async function applyDarkMode() {
        // Check if this is a message page
        const isMessagePage = window.location.href.includes("msg_editor.php") || window.location.href.includes("msg_viewer.php");

        if (isMessagePage) {
            // Show warning banner for message pages
            showMessagePageWarning();
            return;
        }

        darkModeActive = true;
        // Lets bec-tokens.css switch the extension's own UI to its dark palette
        document.documentElement.classList.add("betterEclass-dark");

        // Inject styles immediately to prevent white flash
        if (!document.getElementById("betterEclassDarkMode")) {
            const styleElement = createDarkModeStyles();
            (document.head || document.documentElement).appendChild(styleElement);
        }

        // Fix inline styles immediately and on delay
        fixInlineStyles("initial");
        setTimeout(() => scheduleInlineStyleFix("delayed-100ms"), 100);
        setTimeout(() => scheduleInlineStyleFix("delayed-500ms"), 500);
        setTimeout(() => scheduleInlineStyleFix("delayed-1000ms"), 1000);

        // Watch for dynamic changes
        if (!window.betterEclassDarkModeObserver) {
            window.betterEclassDarkModeObserver = new MutationObserver(() => {
                scheduleInlineStyleFix("mutation");
            });

            window.betterEclassDarkModeObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["style", "border", "bordercolor", "bgcolor"],
            });
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
        banner.textContent = "⚠️ ダークモードはメッセージページに対応していません";

        document.body.appendChild(banner);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            banner.style.transition = "opacity 0.5s";
            banner.style.opacity = "0";
            setTimeout(() => banner.remove(), 500);
        }, 5000);
    }

    function removeDarkMode() {
        darkModeActive = false;
        document.documentElement.classList.remove("betterEclass-dark");

        // Stop observing first so the restore below does not schedule another scan
        if (window.betterEclassDarkModeObserver) {
            window.betterEclassDarkModeObserver.disconnect();
            window.betterEclassDarkModeObserver = null;
        }
        if (pendingStyleFixFrame !== null) {
            cancelAnimationFrame(pendingStyleFixFrame);
            pendingStyleFixFrame = null;
        }

        const styleElement = document.getElementById("betterEclassDarkMode");
        if (styleElement) {
            styleElement.remove();
        }

        restoreTrackedAttributes();
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

    settingsAPI.onSettingsChanged((changes) => {
        if (changes.debugMode) DEBUG = changes.debugMode.newValue;
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
