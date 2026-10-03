const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const FIXTURE_DIR = path.join("tests", "fixtures", "hls");

function loadHlsMp4() {
    const context = { URL, Blob, console, setTimeout };
    context.window = context;
    context.self = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/vendor/mux.js/mux-mp4.min.js", "utf8"), context);
    vm.runInContext(fs.readFileSync("extension/utils/hls-mp4.js", "utf8"), context);
    return { hlsMp4: context.BetterEclassUtils.hlsMp4, muxjs: context.muxjs };
}

function loadFixtureSection(hlsMp4, name) {
    const manifestUrl = `https://eclass.example/${name}/index.m3u8`;
    const playlist = hlsMp4.parsePlaylist(fs.readFileSync(path.join(FIXTURE_DIR, name, "index.m3u8"), "utf8"), manifestUrl);
    return {
        segments: playlist.segments.map((segment) => new Uint8Array(fs.readFileSync(path.join(FIXTURE_DIR, name, segment.url.split("/").pop())))),
        duration: playlist.duration,
    };
}

function readBoxes(bytes) {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const boxes = [];
    const containers = new Set(["moov", "trak", "mdia", "moof", "traf"]);
    (function walk(start, end) {
        let offset = start;
        while (offset + 8 <= end) {
            const size = buffer.readUInt32BE(offset);
            const type = buffer.toString("ascii", offset + 4, offset + 8);
            boxes.push({ type, offset, buffer });
            if (containers.has(type)) walk(offset + 8, offset + size);
            offset += size;
        }
    })(0, buffer.length);
    return boxes;
}

function concat(parts) {
    return new Uint8Array(Buffer.concat(parts.map((part) => Buffer.from(part))));
}

function sampleEntryType(mp4) {
    // The avcC box sits 86 bytes into the visual sample entry; read the entry's own type.
    // (A plain search would hit the "avc1" brand in ftyp.)
    const text = Buffer.from(mp4).toString("latin1");
    const avcCType = text.indexOf("avcC");
    return avcCType < 0 ? null : text.slice(avcCType - 86, avcCType - 82);
}

/**
 * Presentation intervals of every fragment of one track, in seconds (tfdt + trun durations).
 */
function trackIntervals(boxes, trackId) {
    const tkhdIndex = boxes.findIndex((box) => box.type === "tkhd" && box.buffer.readUInt32BE(box.offset + 20) === trackId);
    const mdhd = boxes.slice(tkhdIndex).find((box) => box.type === "mdhd");
    const timescale = mdhd.buffer.readUInt32BE(mdhd.offset + 20);
    const intervals = [];
    boxes.forEach((box, index) => {
        if (box.type !== "tfhd" || box.buffer.readUInt32BE(box.offset + 12) !== trackId) return;
        const tfdt = boxes.slice(index).find((candidate) => candidate.type === "tfdt");
        const trun = boxes.slice(index).find((candidate) => candidate.type === "trun");
        const start = tfdt.buffer[tfdt.offset + 8] === 1 ? Number(tfdt.buffer.readBigUInt64BE(tfdt.offset + 12)) : tfdt.buffer.readUInt32BE(tfdt.offset + 12);
        const flags = trun.buffer.readUIntBE(trun.offset + 9, 3);
        assert.ok(flags & 0x100, "mux.js writes per-sample durations");
        let field = trun.offset + 16 + (flags & 0x1 ? 4 : 0) + (flags & 0x4 ? 4 : 0);
        const stride = [0x100, 0x200, 0x400, 0x800].filter((flag) => flags & flag).length * 4;
        let end = start;
        for (let i = 0; i < trun.buffer.readUInt32BE(trun.offset + 12); i++, field += stride) end += trun.buffer.readUInt32BE(field);
        intervals.push({ start: start / timescale, end: end / timescale });
    });
    return intervals;
}

function movieDurationSeconds(boxes) {
    const mvhd = boxes.find((box) => box.type === "mvhd");
    return mvhd.buffer.readUInt32BE(mvhd.offset + 24) / mvhd.buffer.readUInt32BE(mvhd.offset + 20);
}

/**
 * Assert that two merged sections join without overlap and with at most a short gap.
 */
function assertSeamlessJoin(boxes) {
    const video = trackIntervals(boxes, 1);
    const audio = trackIntervals(boxes, 2);
    assert.equal(video.length, 2);
    assert.equal(audio.length, 2);
    // Video: the second section starts where the first ends (allowing a frame-sized delay).
    assert.ok(video[1].start >= video[0].end - 1e-6, "video sections must not overlap");
    assert.ok(video[1].start - video[0].end < 0.2, "video gap at the join must stay short");
    // Audio: never plays twice at once.
    assert.ok(audio[1].start >= audio[0].end - 1e-3, "audio sections must not overlap");
    assert.ok(audio[1].start - audio[0].end < 0.2, "audio gap at the join must stay short");
    // The header length covers the last sample of either track.
    assert.ok(Math.abs(movieDurationSeconds(boxes) - Math.max(video[1].end, audio[1].end)) < 0.01);
}

test("parses segment URLs and durations relative to the playlist", () => {
    const { hlsMp4 } = loadHlsMp4();
    const playlist = hlsMp4.parsePlaylist(
        "#EXTM3U\n#EXTINF:2.5,\nseg0.ts\n#EXTINF:1.5,\nsub/seg1.ts\n#EXT-X-ENDLIST\n",
        "https://eclass.example/data/course/video/index.m3u8",
    );

    assert.equal(playlist.segments.length, 2);
    assert.equal(playlist.segments[1].url, "https://eclass.example/data/course/video/sub/seg1.ts");
    assert.equal(playlist.duration, 4);
    assert.equal(playlist.encrypted, false);
    assert.equal(playlist.isMaster, false);
});

test("detects encrypted playlists but ignores METHOD=NONE", () => {
    const { hlsMp4 } = loadHlsMp4();
    const base = "https://eclass.example/v/index.m3u8";

    assert.equal(hlsMp4.parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:1,\na.ts\n', base).encrypted, true);
    assert.equal(hlsMp4.parsePlaylist("#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:1,\na.ts\n", base).encrypted, false);
});

test("picks the highest-bandwidth variant from a master playlist", () => {
    const { hlsMp4 } = loadHlsMp4();
    const master = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=300000",
        "low/index.m3u8",
        "#EXT-X-STREAM-INF:BANDWIDTH=900000",
        "high/index.m3u8",
    ].join("\n");

    assert.equal(hlsMp4.parsePlaylist(master, "https://eclass.example/v/master.m3u8").isMaster, true);
    assert.equal(hlsMp4.pickBestVariant(master, "https://eclass.example/v/master.m3u8"), "https://eclass.example/v/high/index.m3u8");
});

test("builds safe MP4 filenames", () => {
    const { hlsMp4 } = loadHlsMp4();

    assert.equal(hlsMp4.toMp4Filename("2-1-福祉経済1-1-1再掲"), "2-1-福祉経済1-1-1再掲.mp4");
    assert.equal(hlsMp4.toMp4Filename("講義/第２回:資料　前半.m3u8"), "講義_第２回_資料 前半.mp4");
    assert.equal(hlsMp4.toMp4Filename(""), "video.mp4");
});

test("converts a single TS stream into an MP4 with a known duration", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const mp4 = concat(hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "a")], muxjs));
    const boxes = readBoxes(mp4);

    assert.deepEqual(
        boxes.filter((box) => ["ftyp", "moov", "moof", "mdat"].includes(box.type)).map((box) => box.type).slice(0, 2),
        ["ftyp", "moov"],
    );
    const [video] = trackIntervals(boxes, 1);
    const [audio] = trackIntervals(boxes, 2);
    assert.equal(video.end - video.start, 2);
    assert.ok(Math.abs(movieDurationSeconds(boxes) - Math.max(video.end, audio.end)) < 0.01);
});

test("places merged sections back-to-back with increasing fragment numbers", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "b")];
    const boxes = readBoxes(concat(hlsMp4.transmuxSections(sections, muxjs)));

    const sequences = boxes.filter((box) => box.type === "mfhd").map((box) => box.buffer.readUInt32BE(box.offset + 12));
    assert.deepEqual(
        sequences,
        sequences.map((_, index) => index + 1),
    );
    assertSeamlessJoin(boxes);
});

test("merges videos whose H.264 profile and stream PIDs differ", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    // Fixture "c" is Main profile with audio/video PIDs swapped, like some e-class uploads.
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "c")];
    const mp4 = concat(hlsMp4.transmuxSections(sections, muxjs));
    const boxes = readBoxes(mp4);

    assert.equal(sampleEntryType(mp4), "avc3");
    assert.deepEqual(
        boxes.filter((box) => box.type === "tkhd").map((box) => box.buffer.readUInt32BE(box.offset + 20)).sort(),
        [1, 2],
    );
    assertSeamlessJoin(boxes);
});

test("keeps avc1 when every video shares the same parameter sets", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const mp4 = concat(hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "b")], muxjs));

    assert.equal(sampleEntryType(mp4), "avc1");
});

test("refuses to merge videos with different resolutions and names both sizes", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [
        { ...loadFixtureSection(hlsMp4, "a"), label: "第1節 講義の概要" },
        { ...loadFixtureSection(hlsMp4, "d"), label: "第2節 統計学と確率論" },
    ];

    assert.throws(
        () => hlsMp4.transmuxSections(sections, muxjs),
        {
            message:
                "動画ごとに画面の大きさが異なるため結合できません（第1節 講義の概要は160×90、第2節 統計学と確率論は128×72）。保存ボタンで1本ずつ保存してください",
        },
    );
});

test("falls back to numbered names when sections have no titles", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "d")];

    assert.throws(() => hlsMp4.transmuxSections(sections, muxjs), /1本目の動画は160×90、2本目の動画は128×72/);
});

test("names the section without audio when only one has it", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), { ...loadFixtureSection(hlsMp4, "g"), label: "第2節" }];

    assert.throws(() => hlsMp4.transmuxSections(sections, muxjs), /音声の有無が異なるため結合できません（第2節には音声がありません）/);
});

test("groups each section's values when size and audio both differ", () => {
    const { hlsMp4 } = loadHlsMp4();
    const describe = (size, audio) => ({
        tracks: [
            { handler: "vide", signature: `video:${size}`, format: size },
            { handler: "soun", signature: `audio:${audio}`, format: audio },
        ],
    });

    assert.equal(
        hlsMp4.describeMismatch(
            { name: "第1節「講義の概要」", description: describe("1920×1080", "48kHz・ステレオ") },
            { name: "第2節「統計学と確率論」", description: describe("1920×1200", "32kHz・モノラル") },
        ),
        "動画ごとに画面の大きさと音声の形式が異なるため結合できません（第1節「講義の概要」は1920×1080・48kHz・ステレオ、第2節「統計学と確率論」は1920×1200・32kHz・モノラル）。保存ボタンで1本ずつ保存してください",
    );
});

test("describes a differing audio format by rate and channels", () => {
    const { hlsMp4 } = loadHlsMp4();
    const describe = (audio) => ({
        tracks: [
            { handler: "vide", signature: "video:1920x1080", format: "1920×1080" },
            { handler: "soun", signature: `audio:${audio}`, format: audio },
        ],
    });

    assert.equal(
        hlsMp4.describeMismatch({ name: "第1節", description: describe("48kHz・ステレオ") }, { name: "第2節", description: describe("44.1kHz・モノラル") }),
        "動画ごとに音声の形式が異なるため結合できません（第1節は48kHz・ステレオ、第2節は44.1kHz・モノラル）。保存ボタンで1本ずつ保存してください",
    );
});

test("rejects merging when no converter is available", () => {
    const { hlsMp4 } = loadHlsMp4();

    assert.throws(() => hlsMp4.transmuxSections([], null), /動画変換ライブラリ/);
});

test("treats an HTML login page as an invalid segment", () => {
    const { hlsMp4 } = loadHlsMp4();
    const html = new TextEncoder().encode("<!DOCTYPE html><html><body>login</body></html>".padEnd(400, " "));
    const ts = new Uint8Array(fs.readFileSync(path.join(FIXTURE_DIR, "a", "seg0.ts")));

    assert.equal(hlsMp4.isTransportStream(html), false);
    assert.equal(hlsMp4.isTransportStream(ts), true);
});

test("reads the declared streams from the PMT", () => {
    const { hlsMp4 } = loadHlsMp4();
    const read = (name) => JSON.parse(JSON.stringify(hlsMp4.probeTsStreams(loadFixtureSection(hlsMp4, name).segments)));

    assert.deepEqual(read("a"), { found: true, video: true, audio: true, videoPid: 256, unsupported: [] });
    assert.deepEqual(read("c"), { found: true, video: true, audio: true, videoPid: 257, unsupported: [] });
    assert.deepEqual(read("g"), { found: true, video: true, audio: false, videoPid: 256, unsupported: [] });
    assert.deepEqual(read("e"), { found: true, video: true, audio: false, videoPid: 256, unsupported: ["音声: MP3"] });
});

test("stops before saving a video whose audio codec cannot be converted", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();

    assert.throws(() => hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "e")], muxjs), /未対応の形式（音声: MP3）/);
});

test("stops when audio ends partway through a video", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();

    assert.throws(() => hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "f")], muxjs), /音声の長さ.*一致しません/);
});

test("names the section whose audio is missing when merging", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "f")];

    assert.throws(() => hlsMp4.transmuxSections(sections, muxjs), /^Error: 2本目の動画の音声/);
});

test("stops when a segment is missing from the downloaded data", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const section = loadFixtureSection(hlsMp4, "a");
    section.segments = section.segments.slice(0, 1);

    assert.throws(() => hlsMp4.transmuxSections([section], muxjs), /長さ.*一致しません/);
});

test("saves a video that has no audio track at all", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const boxes = readBoxes(concat(hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "g")], muxjs)));

    assert.deepEqual(
        boxes.filter((box) => box.type === "hdlr").map((box) => box.buffer.toString("ascii", box.offset + 16, box.offset + 20)),
        ["vide"],
    );
});

/**
 * Load hls-mp4.js with fetch() served from the fixture directory, so the whole
 * download pipeline (playlist -> segments -> conversion -> checks) runs end to end.
 * @param {(url: URL) => {status?: number, body: string|Buffer}|null} [override]
 */
function loadHlsMp4WithFixtureFetch(override) {
    const context = { URL, Blob, console, setTimeout, Promise, Uint8Array };
    context.window = context;
    context.self = context;
    context.globalThis = context;
    context.location = { href: "https://eclass.example/webclass/txtbk_show_chapter.php", origin: "https://eclass.example" };
    context.fetch = async (input) => {
        const url = new URL(input);
        const custom = override && override(url);
        const { status = 200, body } = custom || { body: fs.readFileSync(path.join(FIXTURE_DIR, ...url.pathname.split("/").filter(Boolean))) };
        const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => bytes.toString("utf8"),
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        };
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/vendor/mux.js/mux-mp4.min.js", "utf8"), context);
    vm.runInContext(fs.readFileSync("extension/utils/hls-mp4.js", "utf8"), context);
    return context.BetterEclassUtils.hlsMp4;
}

test("downloads and merges playlists end to end", async () => {
    const hlsMp4 = loadHlsMp4WithFixtureFetch();
    const phases = [];
    const blob = await hlsMp4.downloadAsMp4(["https://eclass.example/a/index.m3u8", "https://eclass.example/c/index.m3u8"], ({ phase, ratio }) =>
        phases.push(`${phase}:${ratio}`),
    );
    const boxes = readBoxes(new Uint8Array(await blob.arrayBuffer()));

    assert.equal(blob.type, "video/mp4");
    assert.ok(phases.includes("fetch:1") && phases.includes("convert:1"));
    assertSeamlessJoin(boxes);
});

test("aborts the download when a segment comes back as an HTML page", async () => {
    const hlsMp4 = loadHlsMp4WithFixtureFetch((url) => (url.pathname.endsWith("seg1.ts") ? { body: "<!DOCTYPE html><html>login</html>".padEnd(376, " ") } : null));

    await assert.rejects(hlsMp4.downloadAsMp4(["https://eclass.example/a/index.m3u8"]), /ログインが切れた可能性/);
});

test("refuses playlists that are still being recorded", async () => {
    const playlist = fs.readFileSync(path.join(FIXTURE_DIR, "a", "index.m3u8"), "utf8").replace("#EXT-X-ENDLIST", "");
    const hlsMp4 = loadHlsMp4WithFixtureFetch((url) => (url.pathname.endsWith("index.m3u8") ? { body: playlist } : null));

    await assert.rejects(hlsMp4.downloadAsMp4(["https://eclass.example/a/index.m3u8"]), /配信が完了していない/);
});

test("refuses master playlists that carry audio as a separate rendition", async () => {
    const master = [
        "#EXTM3U",
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="ja",URI="audio/index.m3u8"',
        '#EXT-X-STREAM-INF:BANDWIDTH=300000,AUDIO="aud"',
        "a/index.m3u8",
    ].join("\n");
    const hlsMp4 = loadHlsMp4WithFixtureFetch((url) => (url.pathname.endsWith("master.m3u8") ? { body: master } : null));

    await assert.rejects(hlsMp4.downloadAsMp4(["https://eclass.example/master.m3u8"]), /音声が別配信/);
});
