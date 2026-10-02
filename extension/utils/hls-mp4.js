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
     * @returns {{segments: Array<{url: string, duration: number}>, duration: number, isMaster: boolean, encrypted: boolean, hasInitMap: boolean, hasEndList: boolean, hasDiscontinuity: boolean, hasByteRange: boolean, hasSeparateAudio: boolean}}
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
        let hasEndList = false;
        let hasDiscontinuity = false;
        let hasByteRange = false;
        let hasSeparateAudio = false;

        lines.forEach((line) => {
            if (line.startsWith("#EXT-X-STREAM-INF")) {
                isMaster = true;
            } else if (line.startsWith("#EXT-X-KEY")) {
                encrypted = encrypted || !/METHOD=NONE/i.test(line);
            } else if (line.startsWith("#EXT-X-MAP")) {
                hasInitMap = true;
            } else if (line.startsWith("#EXT-X-ENDLIST")) {
                hasEndList = true;
            } else if (line.startsWith("#EXT-X-DISCONTINUITY") && !line.startsWith("#EXT-X-DISCONTINUITY-SEQUENCE")) {
                hasDiscontinuity = true;
            } else if (line.startsWith("#EXT-X-BYTERANGE")) {
                hasByteRange = true;
            } else if (line.startsWith("#EXT-X-MEDIA:") && /TYPE=AUDIO/i.test(line) && /URI=/i.test(line)) {
                // Audio delivered as its own rendition; the video variant alone would be silent.
                hasSeparateAudio = true;
            } else if (line.startsWith("#EXTINF:")) {
                pendingDuration = parseFloat(line.slice("#EXTINF:".length)) || 0;
            } else if (!line.startsWith("#")) {
                segments.push({ url: new URL(line, manifestUrl).href, duration: pendingDuration });
                pendingDuration = 0;
            }
        });

        const duration = segments.reduce((sum, segment) => sum + segment.duration, 0);
        return {
            segments,
            duration,
            isMaster,
            encrypted,
            hasInitMap,
            hasEndList,
            hasDiscontinuity,
            hasByteRange,
            hasSeparateAudio,
        };
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
            if (playlist.hasSeparateAudio) throw new Error("音声が別配信になっている動画には対応していません");
            const variantUrl = pickBestVariant(await fetchText(url), url);
            if (!variantUrl) throw new Error("再生可能な動画が見つかりませんでした");
            url = variantUrl;
            playlist = parsePlaylist(await fetchText(url), url);
        }
        if (playlist.encrypted) throw new Error("暗号化された動画のため変換できません");
        if (playlist.hasInitMap) throw new Error("この形式の動画（fMP4）には対応していません");
        if (playlist.hasByteRange) throw new Error("この形式の動画（バイト範囲指定）には対応していません");
        if (playlist.hasDiscontinuity) throw new Error("途中で区切りのある動画（DISCONTINUITY）には対応していません");
        if (!playlist.hasEndList) throw new Error("配信が完了していない動画のため保存できません");
        if (playlist.segments.length === 0) throw new Error("動画のセグメントが見つかりませんでした");
        return playlist;
    }

    const TS_PACKET_SIZE = 188;
    const TS_SYNC_BYTE = 0x47;

    /**
     * Check that bytes look like an MPEG-TS segment. An expired session returns an HTML login
     * page with status 200, which mux.js would silently skip and leave a gap in the video.
     * @param {Uint8Array} bytes
     * @returns {boolean}
     */
    function isTransportStream(bytes) {
        if (!bytes || bytes.byteLength < TS_PACKET_SIZE || bytes.byteLength % TS_PACKET_SIZE !== 0) return false;
        // Every packet must start with the sync byte; a truncated or corrupted body would
        // otherwise make mux.js resynchronize and drop data without reporting it.
        for (let packet = 0; packet < bytes.byteLength; packet += TS_PACKET_SIZE) {
            if (bytes[packet] !== TS_SYNC_BYTE) return false;
        }
        return true;
    }

    async function fetchSegment(url) {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, { credentials: "include" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const bytes = new Uint8Array(await response.arrayBuffer());
                if (!isTransportStream(bytes)) {
                    throw new Error("動画データではない応答を受け取りました（ログインが切れた可能性があります）");
                }
                return bytes;
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

    // PMT stream_type values. mux.js only converts H.264 video and ADTS AAC audio.
    const SUPPORTED_STREAM_TYPES = { 0x1b: "video", 0x0f: "audio" };
    const UNSUPPORTED_STREAM_TYPES = {
        0x01: ["video", "MPEG-1"],
        0x02: ["video", "MPEG-2"],
        0x10: ["video", "MPEG-4 Part 2"],
        0x24: ["video", "HEVC"],
        0x03: ["audio", "MP3"],
        0x04: ["audio", "MP3"],
        0x11: ["audio", "AAC (LATM)"],
        0x81: ["audio", "AC-3"],
        0x87: ["audio", "E-AC-3"],
    };
    // Non-media streams that commonly ride along in HLS and can be ignored safely.
    const IGNORABLE_STREAM_TYPES = new Set([
        0x15, // ID3 timed metadata
        0x86, // SCTE-35 cue messages
    ]);
    // Descriptors that mark a private (0x06) stream as audio mux.js cannot convert.
    const PRIVATE_AUDIO_DESCRIPTORS = { 0x6a: "AC-3", 0x7a: "E-AC-3", 0x7b: "DTS", 0x7c: "AAC (DVB)" };
    const PRIVATE_AUDIO_REGISTRATIONS = ["AC-3", "EAC3", "Opus", "DTS1", "DTS2", "DTS3"];

    function tsPayloadStart(bytes, packet) {
        const adaptation = (bytes[packet + 3] >> 4) & 0x3;
        if (!(adaptation & 0x1)) return -1;
        return adaptation === 0x3 ? packet + 5 + bytes[packet + 4] : packet + 4;
    }

    function readPsiSection(bytes, packet, expectedTableId) {
        if (!(bytes[packet + 1] & 0x40)) return null; // needs payload_unit_start_indicator
        const payload = tsPayloadStart(bytes, packet);
        if (payload < 0) return null;
        const start = payload + 1 + bytes[payload]; // skip pointer_field
        if (start + 3 > packet + TS_PACKET_SIZE || bytes[start] !== expectedTableId) return null;
        const sectionLength = ((bytes[start + 1] & 0x0f) << 8) | bytes[start + 2];
        // The trailing CRC32 is not part of the entries.
        const end = start + 3 + sectionLength - 4;
        return { start, end, truncated: start + 3 + sectionLength > packet + TS_PACKET_SIZE };
    }

    function describePrivateStream(bytes, start, end) {
        for (let offset = start; offset + 2 <= end; offset += 2 + bytes[offset + 1]) {
            const tag = bytes[offset];
            if (PRIVATE_AUDIO_DESCRIPTORS[tag]) return PRIVATE_AUDIO_DESCRIPTORS[tag];
            if (tag === 0x05 && bytes[offset + 1] >= 4) {
                const id = String.fromCharCode(...bytes.subarray(offset + 2, offset + 6));
                if (PRIVATE_AUDIO_REGISTRATIONS.includes(id)) return id;
            }
        }
        return null;
    }

    /**
     * Read the elementary streams declared in the first PMT of the given TS segments.
     * Fails closed: any stream it cannot vouch for is reported as unsupported.
     * @param {Uint8Array[]} segments
     * @returns {{found: boolean, video: boolean, audio: boolean, videoPid: number, unsupported: string[]}}
     */
    function probeTsStreams(segments) {
        const result = { found: false, video: false, audio: false, videoPid: -1, unsupported: [] };
        let pmtPid = -1;

        for (const bytes of segments) {
            for (let packet = 0; packet + TS_PACKET_SIZE <= bytes.byteLength; packet += TS_PACKET_SIZE) {
                if (bytes[packet] !== TS_SYNC_BYTE) continue;
                const pid = ((bytes[packet + 1] & 0x1f) << 8) | bytes[packet + 2];

                if (pid === 0 && pmtPid < 0) {
                    const pat = readPsiSection(bytes, packet, 0x00);
                    if (!pat || pat.truncated) continue;
                    for (let entry = pat.start + 8; entry + 4 <= pat.end; entry += 4) {
                        const programNumber = (bytes[entry] << 8) | bytes[entry + 1];
                        if (programNumber === 0) continue; // network PID
                        pmtPid = ((bytes[entry + 2] & 0x1f) << 8) | bytes[entry + 3];
                        break;
                    }
                } else if (pid === pmtPid) {
                    const pmt = readPsiSection(bytes, packet, 0x02);
                    if (!pmt) continue;
                    result.found = true;
                    if (pmt.truncated) {
                        // A PMT split across packets is not parsed; refuse rather than guess.
                        result.unsupported.push("複数パケットにまたがる構成情報");
                        return result;
                    }
                    const programInfoLength = ((bytes[pmt.start + 10] & 0x0f) << 8) | bytes[pmt.start + 11];
                    let entry = pmt.start + 12 + programInfoLength;
                    while (entry + 5 <= pmt.end) {
                        const streamType = bytes[entry];
                        const elementaryPid = ((bytes[entry + 1] & 0x1f) << 8) | bytes[entry + 2];
                        const esInfoLength = ((bytes[entry + 3] & 0x0f) << 8) | bytes[entry + 4];
                        const kind = SUPPORTED_STREAM_TYPES[streamType];

                        if (kind) {
                            result[kind] = true;
                            if (kind === "video" && result.videoPid < 0) result.videoPid = elementaryPid;
                        } else if (UNSUPPORTED_STREAM_TYPES[streamType]) {
                            const [unsupportedKind, name] = UNSUPPORTED_STREAM_TYPES[streamType];
                            result.unsupported.push(`${unsupportedKind === "video" ? "映像" : "音声"}: ${name}`);
                        } else if (streamType === 0x06) {
                            const audioName = describePrivateStream(bytes, entry + 5, Math.min(entry + 5 + esInfoLength, pmt.end));
                            if (audioName) result.unsupported.push(`音声: ${audioName}`);
                        } else if (!IGNORABLE_STREAM_TYPES.has(streamType)) {
                            result.unsupported.push(`不明な形式 0x${streamType.toString(16).padStart(2, "0")}`);
                        }
                        entry += 5 + esInfoLength;
                    }
                    return result;
                }
            }
        }
        return result;
    }

    /**
     * Measure the source video timeline from PES DTS values. Compared against the converted
     * output to detect frames dropped during conversion, without relying on EXTINF and without
     * flagging sources that legitimately hold frames for a long time (e.g. static slides).
     * @param {Uint8Array[]} segments
     * @param {number} videoPid
     * @returns {{largestGapSeconds: number, spanSeconds: number} | null} null when fewer than two timestamps
     */
    function measureSourceVideo(segments, videoPid) {
        let previous = null;
        let largest = -1;
        let lastDelta = 0;
        let span = 0;
        for (const bytes of segments) {
            for (let packet = 0; packet + TS_PACKET_SIZE <= bytes.byteLength; packet += TS_PACKET_SIZE) {
                if (!(bytes[packet + 1] & 0x40)) continue; // PES headers start a payload unit
                const pid = ((bytes[packet + 1] & 0x1f) << 8) | bytes[packet + 2];
                if (pid !== videoPid) continue;
                const pes = tsPayloadStart(bytes, packet);
                if (pes < 0 || pes + 19 > packet + TS_PACKET_SIZE) continue;
                if (bytes[pes] !== 0 || bytes[pes + 1] !== 0 || bytes[pes + 2] !== 1) continue;
                const ptsDtsFlags = bytes[pes + 7] >> 6;
                if (!(ptsDtsFlags & 0x2)) continue;
                const field = ptsDtsFlags === 0x3 ? pes + 14 : pes + 9;
                const dts =
                    (bytes[field] & 0x0e) * 2 ** 29 +
                    ((bytes[field + 1] << 22) | ((bytes[field + 2] & 0xfe) << 14) | (bytes[field + 3] << 7) | (bytes[field + 4] >> 1));
                if (previous !== null) {
                    // Handle the 33-bit timestamp wrap.
                    const delta = (dts - previous + 2 ** 33) % 2 ** 33;
                    largest = Math.max(largest, delta);
                    span += delta;
                    lastDelta = delta;
                }
                previous = dts;
            }
        }
        if (largest < 0) return null;
        // The last frame lasts about as long as the one before it, as in the converted output.
        return { largestGapSeconds: largest / TS_CLOCK_RATE, spanSeconds: (span + lastDelta) / TS_CLOCK_RATE };
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
                current = { id: 0, tkhdOffset: -1, handler: "", timescale: 0, entryOffset: -1, signature: "", avcC: null };
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
            } else if (type === "mdhd" && initSegment[offset + 8] === 0) {
                current.timescale = readUint32(initSegment, offset + 20);
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

    /**
     * Delay every sample of a section by the same amount (rewrites tfdt in each track's timescale).
     * @param {Uint8Array[]} fragments - Modified in place; track IDs must still be the original ones
     * @param {ReturnType<typeof describeInitSegment>} description
     * @param {number} seconds
     */
    function shiftFragmentTimes(fragments, description, seconds) {
        const timescales = new Map(description.tracks.map((track) => [track.id, track.timescale || TS_CLOCK_RATE]));
        fragments.forEach((fragment) => {
            let trackId = 0;
            walkBoxes(fragment, (type, offset) => {
                if (type === "tfhd") {
                    trackId = readUint32(fragment, offset + 12);
                } else if (type === "tfdt") {
                    const delta = Math.round(seconds * (timescales.get(trackId) || TS_CLOCK_RATE));
                    if (fragment[offset + 8] === 1) {
                        const value = readUint32(fragment, offset + 12) * 2 ** 32 + readUint32(fragment, offset + 16) + delta;
                        writeUint32(fragment, offset + 12, Math.floor(value / 2 ** 32));
                        writeUint32(fragment, offset + 16, value % 2 ** 32);
                    } else {
                        writeUint32(fragment, offset + 12, readUint32(fragment, offset + 12) + delta);
                    }
                }
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

    // Allowed gap between the playlist duration (EXTINF total) and the converted media. Real
    // e-class videos differ by under 0.1 s, while the shortest observed segment is 1.2 s.
    const DURATION_TOLERANCE_SECONDS = 1;
    // Allowed gap between the video and audio lengths of one video. Real e-class videos differ by
    // about 0.05 s (AAC priming); a larger gap means part of one track is missing.
    const AV_TOLERANCE_SECONDS = 0.5;
    // Extra length a converted video frame may have over the longest frame in the source before
    // it is treated as data dropped during conversion.
    const FRAME_GAP_TOLERANCE_SECONDS = 0.1;

    function readUint24(bytes, offset) {
        return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
    }

    /**
     * Measure each track of transmuxed fragments from their tfhd/tfdt/trun boxes.
     * @param {Uint8Array[]} fragments
     * @param {Uint8Array} initSegment
     * @param {ReturnType<typeof describeInitSegment>} description
     * @returns {Array<{id: number, handler: string, samples: number, startSeconds: number, endSeconds: number, durationSeconds: number, longestSampleSeconds: number}>}
     */
    function analyzeFragments(fragments, initSegment, description) {
        const defaultDurations = new Map();
        description.trexOffsets.forEach((offset) => {
            defaultDurations.set(readUint32(initSegment, offset + 12), readUint32(initSegment, offset + 20));
        });

        const ticks = new Map();
        fragments.forEach((fragment) => {
            let traf = null;
            walkBoxes(fragment, (type, offset) => {
                if (type === "traf") {
                    traf = { trackId: 0, defaultDuration: 0, cursor: 0 };
                } else if (!traf) {
                    return;
                } else if (type === "tfhd") {
                    const flags = readUint24(fragment, offset + 9);
                    traf.trackId = readUint32(fragment, offset + 12);
                    let field = offset + 16;
                    if (flags & 0x1) field += 8; // base_data_offset
                    if (flags & 0x2) field += 4; // sample_description_index
                    traf.defaultDuration = flags & 0x8 ? readUint32(fragment, field) : defaultDurations.get(traf.trackId) || 0;
                } else if (type === "tfdt") {
                    traf.cursor =
                        fragment[offset + 8] === 1
                            ? readUint32(fragment, offset + 12) * 2 ** 32 + readUint32(fragment, offset + 16)
                            : readUint32(fragment, offset + 12);
                } else if (type === "trun") {
                    const flags = readUint24(fragment, offset + 9);
                    const sampleCount = readUint32(fragment, offset + 12);
                    let field = offset + 16;
                    if (flags & 0x1) field += 4; // data_offset
                    if (flags & 0x4) field += 4; // first_sample_flags
                    const stride = [0x100, 0x200, 0x400, 0x800].filter((flag) => flags & flag).length * 4;

                    const stats = ticks.get(traf.trackId) || { samples: 0, start: Infinity, end: 0, longest: 0 };
                    stats.start = Math.min(stats.start, traf.cursor);
                    for (let i = 0; i < sampleCount; i++) {
                        const duration = flags & 0x100 ? readUint32(fragment, field) : traf.defaultDuration;
                        stats.longest = Math.max(stats.longest, duration);
                        traf.cursor += duration;
                        field += stride;
                    }
                    stats.samples += sampleCount;
                    stats.end = Math.max(stats.end, traf.cursor);
                    ticks.set(traf.trackId, stats);
                }
            });
        });

        return description.tracks.map((track) => {
            const stats = ticks.get(track.id) || { samples: 0, start: 0, end: 0, longest: 0 };
            const timescale = track.timescale || TS_CLOCK_RATE;
            const startSeconds = stats.samples ? stats.start / timescale : 0;
            const endSeconds = stats.samples ? stats.end / timescale : 0;
            return {
                id: track.id,
                handler: track.handler,
                samples: stats.samples,
                startSeconds,
                endSeconds,
                durationSeconds: endSeconds - startSeconds,
                longestSampleSeconds: stats.longest / timescale,
            };
        });
    }

    /**
     * Stop instead of saving a file that would play back silent, blank, or with gaps.
     * @param {string} label - e.g. "2本目の動画"
     * @param {ReturnType<typeof probeTsStreams>} streams - What the source declares
     * @param {ReturnType<typeof analyzeFragments>} tracks - What the conversion produced
     * @param {{duration: number, segments: Uint8Array[], integerDurations?: boolean}} section
     * @param {ReturnType<typeof measureSourceVideo>} source - Source video timeline, if measurable
     */
    function verifySection(label, streams, tracks, section, source) {
        const video = tracks.find((track) => track.handler === "vide");
        const audio = tracks.find((track) => track.handler === "soun");

        if (streams.video && !(video && video.samples > 0)) {
            throw new Error(`${label}の映像を変換できませんでした（映像が欠けるため保存を中止しました）`);
        }
        if (streams.audio && !(audio && audio.samples > 0)) {
            throw new Error(`${label}の音声を変換できませんでした（無音になるため保存を中止しました）`);
        }

        if (video && video.samples && source) {
            // Frames dropped mid-stream leave one long frame; dropped trailing frames shorten it.
            if (video.longestSampleSeconds > source.largestGapSeconds + FRAME_GAP_TOLERANCE_SECONDS) {
                throw new Error(
                    `${label}の映像に途切れ（${video.longestSampleSeconds.toFixed(1)}秒）が見つかりました。データの一部が欠けている可能性があるため保存を中止しました`,
                );
            }
            if (Math.abs(video.durationSeconds - source.spanSeconds) > DURATION_TOLERANCE_SECONDS) {
                throw new Error(
                    `${label}の映像の長さ（${video.durationSeconds.toFixed(1)}秒）が元データ（${source.spanSeconds.toFixed(1)}秒）と一致しません。データの一部が欠けている可能性があるため保存を中止しました`,
                );
            }
        }

        // Integer EXTINF values can be rounded in one direction for every segment, so they are
        // too coarse to compare; the source-timeline and audio/video checks still apply.
        [
            [video, "映像"],
            [audio, "音声"],
        ].forEach(([track, name]) => {
            if (!track || !track.samples || !(section.duration > 0) || section.integerDurations) return;
            if (Math.abs(track.durationSeconds - section.duration) > DURATION_TOLERANCE_SECONDS) {
                throw new Error(
                    `${label}の${name}の長さ（${track.durationSeconds.toFixed(1)}秒）が配信情報（${section.duration.toFixed(1)}秒）と一致しません。データの一部が欠けている可能性があるため保存を中止しました`,
                );
            }
        });

        if (video && audio && video.samples && audio.samples) {
            if (Math.abs(video.durationSeconds - audio.durationSeconds) > AV_TOLERANCE_SECONDS) {
                throw new Error(
                    `${label}の映像（${video.durationSeconds.toFixed(1)}秒）と音声（${audio.durationSeconds.toFixed(1)}秒）の長さが一致しません。どちらかの一部が欠けている可能性があるため保存を中止しました`,
                );
            }
        }
    }

    /**
     * Transmux one or more TS sections into a single fragmented MP4, placing each section
     * right after the previous one on the timeline, and verify every section before returning.
     * Sections must share resolution and audio format. When only the H.264 parameter sets differ
     * (e.g. High vs Main profile), the video sample entry becomes avc3 so decoders follow the
     * parameter sets that mux.js keeps in-band at each keyframe.
     * @param {Array<{segments: Uint8Array[], duration: number, integerDurations?: boolean}>} sections
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
        let previousAudioEndSeconds = 0;
        let totalSeconds = 0;

        sections.forEach((section, index) => {
            const label = sections.length > 1 ? `${index + 1}本目の動画` : "動画";

            const streams = probeTsStreams(section.segments);
            if (!streams.found) throw new Error(`${label}の構成（映像・音声）を読み取れませんでした`);
            if (streams.unsupported.length > 0) {
                throw new Error(`${label}に未対応の形式（${streams.unsupported.join("、")}）が含まれているため変換できません`);
            }

            // mux.js applies baseMediaDecodeTime only when a track is first created, so each
            // section gets its own transmuxer that starts where the previous section ended.
            const result = transmuxSection(section, mux, Math.round(timelineSeconds * TS_CLOCK_RATE));
            if (!result.initSegment) throw new Error(`${label}を変換できませんでした`);

            const description = describeInitSegment(result.initSegment);
            const tracks = analyzeFragments(result.fragments, result.initSegment, description);
            const source = streams.videoPid >= 0 ? measureSourceVideo(section.segments, streams.videoPid) : null;
            verifySection(label, streams, tracks, section, source);

            // Each section starts at the previous video end, which keeps video continuous. mux.js
            // places audio relative to video presentation time, so the previous section's audio
            // can run past this section's first audio sample; delay the whole section by that
            // overlap (usually tens of milliseconds) so audio never plays twice at once.
            const audioTrack = tracks.find((track) => track.handler === "soun" && track.samples);
            const overlapSeconds = audioTrack ? previousAudioEndSeconds - audioTrack.startSeconds : 0;
            if (overlapSeconds > 0) {
                shiftFragmentTimes(result.fragments, description, overlapSeconds);
                tracks.forEach((track) => {
                    track.startSeconds += overlapSeconds;
                    track.endSeconds += overlapSeconds;
                });
            }

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

            // Continue from where this section's video actually ends rather than its EXTINF total,
            // so an inaccurate playlist cannot leave a gap or overlap at the join.
            const videoTrack = tracks.find((track) => track.handler === "vide" && track.samples);
            const ends = tracks.filter((track) => track.samples).map((track) => track.endSeconds);
            timelineSeconds = videoTrack ? videoTrack.endSeconds : ends.length > 0 ? Math.max(...ends) : timelineSeconds + section.duration;
            if (audioTrack) previousAudioEndSeconds = audioTrack.endSeconds;
            totalSeconds = Math.max(totalSeconds, ...ends);
        });

        if (parameterSetsDiffer) {
            const video = initDescription.tracks.find((track) => track.handler === "vide");
            initSegment.set([0x61, 0x76, 0x63, 0x33], video.entryOffset + 4); // "avc3"
        }
        setInitSegmentDuration(initSegment, totalSeconds);
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
            sections.push({
                segments,
                duration: playlist.duration,
                integerDurations: playlist.segments.every((segment) => Number.isInteger(segment.duration)),
            });
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
        isTransportStream,
        probeTsStreams,
        pickBestVariant,
        transmuxSections,
        downloadAsMp4,
        toMp4Filename,
        saveBlob,
    };
})();
