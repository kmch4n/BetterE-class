// hls-mp4.js
// Downloads unencrypted HLS (MPEG-TS) streams and converts them into a single MP4 in the browser.
// Relies on the vendored mux.js MP4 build (vendor/mux.js/mux-mp4.min.js), exposed as `muxjs`.

(function () {
    "use strict";

    const TS_CLOCK_RATE = 90000;
    const DEFAULT_CONCURRENCY = 4;
    const MAX_RETRIES = 2;

    /**
     * Parse an HLS media playlist.
     * @param {string} text - Playlist body
     * @param {string} manifestUrl - Absolute playlist URL used to resolve segment URIs
     * @returns {{segments: Array<{url: string, duration: number}>, duration: number, isMaster: boolean, encrypted: boolean, hasInitMap: boolean}}
     */
    function parsePlaylist(text, manifestUrl) {
        const lines = String(text)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const segments = [];
        let pendingDuration = 0;
        let isMaster = false;
        let encrypted = false;
        let hasInitMap = false;

        lines.forEach((line) => {
            if (line.startsWith("#EXT-X-STREAM-INF")) {
                isMaster = true;
            } else if (line.startsWith("#EXT-X-KEY")) {
                encrypted = encrypted || !/METHOD=NONE/i.test(line);
            } else if (line.startsWith("#EXT-X-MAP")) {
                hasInitMap = true;
            } else if (line.startsWith("#EXTINF:")) {
                pendingDuration = parseFloat(line.slice("#EXTINF:".length)) || 0;
            } else if (!line.startsWith("#")) {
                segments.push({ url: new URL(line, manifestUrl).href, duration: pendingDuration });
                pendingDuration = 0;
            }
        });

        const duration = segments.reduce((sum, segment) => sum + segment.duration, 0);
        return { segments, duration, isMaster, encrypted, hasInitMap };
    }

    /**
     * Pick the highest-bandwidth variant URI from a master playlist.
     * @param {string} text
     * @param {string} manifestUrl
     * @returns {string|null}
     */
    function pickBestVariant(text, manifestUrl) {
        const lines = String(text).split(/\r?\n/).map((line) => line.trim());
        let best = null;
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
            const bandwidth = Number((lines[i].match(/BANDWIDTH=(\d+)/) || [])[1] || 0);
            const uri = lines.slice(i + 1).find((line) => line && !line.startsWith("#"));
            if (uri && (!best || bandwidth > best.bandwidth)) {
                best = { bandwidth, url: new URL(uri, manifestUrl).href };
            }
        }
        return best ? best.url : null;
    }

    async function fetchText(url) {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    }

    /**
     * Load a media playlist, following one master-playlist hop if needed.
     * @param {string} manifestUrl
     */
    async function loadPlaylist(manifestUrl) {
        let url = new URL(manifestUrl, window.location.href).href;
        let playlist = parsePlaylist(await fetchText(url), url);

        if (playlist.isMaster) {
            const variantUrl = pickBestVariant(await fetchText(url), url);
            if (!variantUrl) throw new Error("再生可能な動画が見つかりませんでした");
            url = variantUrl;
            playlist = parsePlaylist(await fetchText(url), url);
        }
        if (playlist.encrypted) throw new Error("暗号化された動画のため変換できません");
        if (playlist.hasInitMap) throw new Error("この形式の動画（fMP4）には対応していません");
        if (playlist.segments.length === 0) throw new Error("動画のセグメントが見つかりませんでした");
        return playlist;
    }

    async function fetchSegment(url) {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, { credentials: "include" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return new Uint8Array(await response.arrayBuffer());
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    /**
     * Fetch segments in order with limited concurrency.
     * @param {Array<{url: string}>} segments
     * @param {(done: number) => void} [onSegment]
     * @returns {Promise<Uint8Array[]>}
     */
    async function fetchSegments(segments, onSegment) {
        const results = new Array(segments.length);
        let nextIndex = 0;
        let done = 0;

        async function worker() {
            while (nextIndex < segments.length) {
                const index = nextIndex++;
                results[index] = await fetchSegment(segments[index].url);
                done++;
                if (onSegment) onSegment(done);
            }
        }

        const workers = Array.from({ length: Math.min(DEFAULT_CONCURRENCY, segments.length) }, worker);
        await Promise.all(workers);
        return results;
    }

    function bytesEqual(a, b) {
        if (!a || !b || a.byteLength !== b.byteLength) return false;
        for (let i = 0; i < a.byteLength; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function readUint16(bytes, offset) {
        return (bytes[offset] << 8) | bytes[offset + 1];
    }

    function readUint32(bytes, offset) {
        return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }

    function writeUint32(bytes, offset, value) {
        bytes[offset] = (value >>> 24) & 0xff;
        bytes[offset + 1] = (value >>> 16) & 0xff;
        bytes[offset + 2] = (value >>> 8) & 0xff;
        bytes[offset + 3] = value & 0xff;
    }

    function readType(bytes, offset) {
        return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    }

    // Offset of the first child box inside each container this module walks into.
    const CHILD_OFFSETS = {
        moov: 8,
        trak: 8,
        mdia: 8,
        minf: 8,
        stbl: 8,
        mvex: 8,
        moof: 8,
        traf: 8,
        stsd: 16, // full box header + entry_count
        avc1: 86, // visual sample entry fields
        avc3: 86,
    };

    /**
     * Visit ISO BMFF boxes depth-first (parents before children).
     * @param {Uint8Array} bytes
     * @param {(type: string, offset: number, size: number) => void} visit
     */
    function walkBoxes(bytes, visit, start = 0, end = bytes.byteLength) {
        let offset = start;
        while (offset + 8 <= end) {
            const size = readUint32(bytes, offset);
            if (size < 8 || offset + size > end) break;
            const type = readType(bytes, offset + 4);
            visit(type, offset, size);
            if (CHILD_OFFSETS[type]) walkBoxes(bytes, visit, offset + CHILD_OFFSETS[type], offset + size);
            offset += size;
        }
    }

    /**
     * Collect the per-track details needed to merge init segments.
     * @param {Uint8Array} initSegment
     */
    function describeInitSegment(initSegment) {
        const tracks = [];
        const trexOffsets = [];
        let mvhdOffset = -1;
        let current = null;

        walkBoxes(initSegment, (type, offset, size) => {
            if (type === "mvhd") {
                mvhdOffset = offset;
            } else if (type === "trak") {
                current = { id: 0, tkhdOffset: -1, handler: "", entryOffset: -1, signature: "", avcC: null };
                tracks.push(current);
            } else if (type === "trex") {
                trexOffsets.push(offset);
            } else if (!current) {
                return;
            } else if (type === "tkhd") {
                current.tkhdOffset = offset;
                current.id = readUint32(initSegment, offset + 20);
            } else if (type === "hdlr") {
                current.handler = readType(initSegment, offset + 16);
            } else if (type === "avc1" || type === "avc3") {
                current.entryOffset = offset;
                current.signature = `video:${readUint16(initSegment, offset + 32)}x${readUint16(initSegment, offset + 34)}`;
            } else if (type === "avcC") {
                current.avcC = initSegment.subarray(offset, offset + size);
            } else if (type === "mp4a") {
                current.signature = `audio:${Array.from(initSegment.subarray(offset, offset + size)).join(",")}`;
            }
        });

        return { tracks, trexOffsets, mvhdOffset };
    }

    /**
     * Map each track ID to a stable ID by media type, because the TS PIDs that mux.js reuses as
     * track IDs can differ between videos (e.g. video on 257 in one file and on 256 in the next).
     * @param {Array<{id: number, handler: string}>} tracks
     * @returns {Map<number, number>}
     */
    function buildTrackIdMap(tracks) {
        const map = new Map();
        const used = new Set();
        let nextId = 3;
        tracks.forEach((track) => {
            let newId;
            if (track.handler === "vide" && !used.has(1)) {
                newId = 1;
            } else if (track.handler === "soun" && !used.has(2)) {
                newId = 2;
            } else {
                newId = nextId++;
            }
            used.add(newId);
            map.set(track.id, newId);
        });
        return map;
    }

    function trackSignature(description, idMap) {
        return description.tracks
            .map((track) => `${idMap.get(track.id)}:${track.handler}:${track.signature}`)
            .sort()
            .join("|");
    }

    /**
     * Rewrite track IDs in the init segment (tkhd, trex, mvhd next_track_ID).
     */
    function remapInitTrackIds(initSegment, description, idMap) {
        description.tracks.forEach((track) => {
            if (track.tkhdOffset >= 0) writeUint32(initSegment, track.tkhdOffset + 20, idMap.get(track.id));
        });
        description.trexOffsets.forEach((offset) => {
            const oldId = readUint32(initSegment, offset + 12);
            if (idMap.has(oldId)) writeUint32(initSegment, offset + 12, idMap.get(oldId));
        });
        if (description.mvhdOffset >= 0 && initSegment[description.mvhdOffset + 8] === 0) {
            writeUint32(initSegment, description.mvhdOffset + 104, Math.max(...idMap.values()) + 1);
        }
    }

    function remapFragmentTrackIds(fragment, idMap) {
        walkBoxes(fragment, (type, offset) => {
            if (type !== "tfhd") return;
            const oldId = readUint32(fragment, offset + 12);
            if (idMap.has(oldId)) writeUint32(fragment, offset + 12, idMap.get(oldId));
        });
    }

    /**
     * Replace the "unknown" durations mux.js writes into the init segment with the real length,
     * so players that read the header show the correct duration.
     * @param {Uint8Array} initSegment - Modified in place
     * @param {number} seconds
     */
    function setInitSegmentDuration(initSegment, seconds) {
        let movieTimescale = TS_CLOCK_RATE;
        walkBoxes(initSegment, (type, offset) => {
            if (type !== "mvhd" && type !== "tkhd" && type !== "mdhd") return;
            // Only version 0 boxes (32-bit fields) are produced by mux.js.
            if (initSegment[offset + 8] !== 0) return;
            if (type === "mvhd") {
                movieTimescale = readUint32(initSegment, offset + 20) || movieTimescale;
                writeUint32(initSegment, offset + 24, Math.round(seconds * movieTimescale));
            } else if (type === "tkhd") {
                writeUint32(initSegment, offset + 28, Math.round(seconds * movieTimescale));
            } else {
                const timescale = readUint32(initSegment, offset + 20);
                if (timescale) writeUint32(initSegment, offset + 24, Math.round(seconds * timescale));
            }
        });
    }

    /**
     * Number every movie fragment sequentially, since each section restarts at zero.
     * @param {Uint8Array[]} fragments - Modified in place
     */
    function renumberFragments(fragments) {
        let sequence = 1;
        fragments.forEach((fragment) => {
            walkBoxes(fragment, (type, offset) => {
                if (type === "mfhd") writeUint32(fragment, offset + 12, sequence++);
            });
        });
    }

    function transmuxSection(section, mux, baseMediaDecodeTime) {
        const transmuxer = new mux.Transmuxer({ remux: true, baseMediaDecodeTime });
        const fragments = [];
        let initSegment = null;
        transmuxer.on("data", (event) => {
            if (!event.data || event.data.byteLength === 0) return;
            initSegment = initSegment || event.initSegment;
            fragments.push(event.data);
        });
        section.segments.forEach((bytes) => transmuxer.push(bytes));
        transmuxer.flush();
        return { initSegment, fragments };
    }

    /**
     * Transmux one or more TS sections into a single fragmented MP4, placing each section
     * right after the previous one on the timeline.
     * Sections must share resolution and audio format. When only the H.264 parameter sets differ
     * (e.g. High vs Main profile), the video sample entry becomes avc3 so decoders follow the
     * parameter sets that mux.js keeps in-band at each keyframe.
     * @param {Array<{segments: Uint8Array[], duration: number}>} sections
     * @param {object} mux - The `muxjs` MP4 namespace (must expose Transmuxer)
     * @returns {Uint8Array[]} MP4 parts in order (init segment first)
     */
    function transmuxSections(sections, mux) {
        if (!mux || typeof mux.Transmuxer !== "function") {
            throw new Error("動画変換ライブラリを読み込めませんでした");
        }

        const fragments = [];
        let initSegment = null;
        let initDescription = null;
        let expectedSignature = "";
        let parameterSetsDiffer = false;
        let timelineSeconds = 0;

        sections.forEach((section, index) => {
            // mux.js applies baseMediaDecodeTime only when a track is first created, so each
            // section gets its own transmuxer that starts where the previous section ended.
            const result = transmuxSection(section, mux, Math.round(timelineSeconds * TS_CLOCK_RATE));
            if (!result.initSegment) throw new Error(`${index + 1}本目の動画を変換できませんでした`);

            const description = describeInitSegment(result.initSegment);
            const idMap = buildTrackIdMap(description.tracks);
            const signature = trackSignature(description, idMap);

            if (!initSegment) {
                initSegment = result.initSegment;
                initDescription = description;
                expectedSignature = signature;
                remapInitTrackIds(initSegment, description, idMap);
            } else if (signature !== expectedSignature) {
                throw new Error("動画ごとに解像度や音声の形式が異なるため結合できません");
            } else {
                const firstVideo = initDescription.tracks.find((track) => track.handler === "vide");
                const video = description.tracks.find((track) => track.handler === "vide");
                if (firstVideo && video && !bytesEqual(firstVideo.avcC, video.avcC)) parameterSetsDiffer = true;
            }

            result.fragments.forEach((fragment) => remapFragmentTrackIds(fragment, idMap));
            fragments.push(...result.fragments);
            timelineSeconds += section.duration;
        });

        if (parameterSetsDiffer) {
            const video = initDescription.tracks.find((track) => track.handler === "vide");
            initSegment.set([0x61, 0x76, 0x63, 0x33], video.entryOffset + 4); // "avc3"
        }
        setInitSegmentDuration(initSegment, timelineSeconds);
        renumberFragments(fragments);
        return [initSegment, ...fragments];
    }

    /**
     * Download one or more HLS streams and return them as one MP4 blob.
     * @param {string[]} manifestUrls - Played back-to-back in this order
     * @param {(progress: {phase: "fetch"|"convert", ratio: number}) => void} [onProgress]
     * @returns {Promise<Blob>}
     */
    async function downloadAsMp4(manifestUrls, onProgress) {
        const report = (phase, ratio) => {
            if (onProgress) onProgress({ phase, ratio: Math.max(0, Math.min(1, ratio)) });
        };

        report("fetch", 0);
        const playlists = [];
        for (const url of manifestUrls) {
            playlists.push(await loadPlaylist(url));
        }

        const totalSegments = playlists.reduce((sum, playlist) => sum + playlist.segments.length, 0);
        let fetchedBefore = 0;
        const sections = [];
        for (const playlist of playlists) {
            const segments = await fetchSegments(playlist.segments, (done) => {
                report("fetch", (fetchedBefore + done) / totalSegments);
            });
            fetchedBefore += playlist.segments.length;
            sections.push({ segments, duration: playlist.duration });
        }

        report("convert", 0);
        const parts = transmuxSections(sections, window.muxjs);
        report("convert", 1);
        return new Blob(parts, { type: "video/mp4" });
    }

    /**
     * Turn a source filename into a safe .mp4 filename.
     * @param {string} name
     * @returns {string}
     */
    function toMp4Filename(name) {
        const base = String(name || "")
            .replace(/\.[^./\\]+$/, "")
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
            .replace(/\s+/g, " ")
            .trim();
        return `${base || "video"}.mp4`;
    }

    /**
     * Save a blob through a temporary download link.
     * @param {Blob} blob
     * @param {string} filename
     */
    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Give the download manager time to read the blob before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    const root = typeof window !== "undefined" ? window : globalThis;
    root.BetterEclassUtils = root.BetterEclassUtils || {};
    root.BetterEclassUtils.hlsMp4 = {
        parsePlaylist,
        pickBestVariant,
        transmuxSections,
        downloadAsMp4,
        toMp4Filename,
        saveBlob,
    };
})();
