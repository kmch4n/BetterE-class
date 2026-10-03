// icons.js
// Line icons for injected UI. Path data adapted from Lucide (https://lucide.dev, ISC License).

(function () {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";

    // Each entry lists child elements as [tagName, attributes].
    const ICONS = {
        download: [
            ["path", { d: "M12 15V3" }],
            ["path", { d: "m7 10 5 5 5-5" }],
            ["path", { d: "M5 21h14" }],
        ],
        saveAs: [
            ["path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }],
            ["path", { d: "M12 10v6" }],
            ["path", { d: "m15 13-3 3-3-3" }],
        ],
        preview: [
            ["path", { d: "M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" }],
            ["circle", { cx: "12", cy: "12", r: "3" }],
        ],
        merge: [
            ["path", { d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" }],
            ["path", { d: "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" }],
            ["path", { d: "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" }],
        ],
        alert: [
            ["circle", { cx: "12", cy: "12", r: "10" }],
            ["path", { d: "M12 8v4" }],
            ["path", { d: "M12 16h.01" }],
        ],
        check: [["path", { d: "M20 6 9 17l-5-5" }]],
        spinner: [["path", { d: "M21 12a9 9 0 1 1-6.22-8.56" }]],
        chevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
        chevronLeft: [["path", { d: "m15 18-6-6 6-6" }]],
        lock: [
            ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }],
            ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
        ],
        // Material types
        file: [
            ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
            ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
        ],
        fileText: [
            ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
            ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
            ["path", { d: "M16 13H8" }],
            ["path", { d: "M16 17H8" }],
        ],
        pencil: [
            ["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }],
            ["path", { d: "m15 5 4 4" }],
        ],
        clipboard: [
            ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
            ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
            ["path", { d: "M12 11h4" }],
            ["path", { d: "M12 16h4" }],
            ["path", { d: "M8 11h.01" }],
            ["path", { d: "M8 16h.01" }],
        ],
        chart: [
            ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
            ["path", { d: "M18 17V9" }],
            ["path", { d: "M13 17V5" }],
            ["path", { d: "M8 17v-3" }],
        ],
        message: [["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]],
        paperclip: [["path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" }]],
        link: [
            ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
            ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }],
        ],
        video: [
            ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2" }],
            ["path", { d: "m10 9 5 3-5 3z" }],
        ],
    };

    /**
     * Create an inline SVG icon that inherits the text colour.
     * @param {keyof ICONS} name
     * @param {{size?: number, className?: string}} [options]
     * @returns {SVGSVGElement}
     */
    function createIcon(name, { size = 16, className = "" } = {}) {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        if (className) svg.setAttribute("class", className);

        (ICONS[name] || []).forEach(([tag, attributes]) => {
            const child = document.createElementNS(SVG_NS, tag);
            Object.entries(attributes).forEach(([key, value]) => child.setAttribute(key, value));
            svg.appendChild(child);
        });
        return svg;
    }

    window.BetterEclassUtils = window.BetterEclassUtils || {};
    window.BetterEclassUtils.icons = { create: createIcon, names: Object.keys(ICONS) };
})();
