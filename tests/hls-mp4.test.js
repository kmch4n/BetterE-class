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
 * Decode times (tfdt) of every fragment for one track, in that track's timescale.
 */
function trackBaseTimes(boxes, trackId) {
    const times = [];
    boxes.forEach((box, index) => {
        if (box.type !== "tfhd" || box.buffer.readUInt32BE(box.offset + 12) !== trackId) return;
        const tfdt = boxes.slice(index).find((candidate) => candidate.type === "tfdt");
        const version = tfdt.buffer[tfdt.offset + 8];
        times.push(version === 1 ? Number(tfdt.buffer.readBigUInt64BE(tfdt.offset + 12)) : tfdt.buffer.readUInt32BE(tfdt.offset + 12));
    });
    return times;
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
    const mvhd = boxes.find((box) => box.type === "mvhd");
    const timescale = mvhd.buffer.readUInt32BE(mvhd.offset + 20);

    assert.deepEqual(
        boxes.filter((box) => ["ftyp", "moov", "moof", "mdat"].includes(box.type)).map((box) => box.type).slice(0, 2),
        ["ftyp", "moov"],
    );
    assert.equal(mvhd.buffer.readUInt32BE(mvhd.offset + 24) / timescale, 2);
});

test("places merged sections back-to-back with increasing fragment numbers", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "b")];
    const boxes = readBoxes(concat(hlsMp4.transmuxSections(sections, muxjs)));

    const mvhd = boxes.find((box) => box.type === "mvhd");
    assert.equal(mvhd.buffer.readUInt32BE(mvhd.offset + 24) / mvhd.buffer.readUInt32BE(mvhd.offset + 20), 3);

    const sequences = boxes.filter((box) => box.type === "mfhd").map((box) => box.buffer.readUInt32BE(box.offset + 12));
    assert.deepEqual(
        sequences,
        sequences.map((_, index) => index + 1),
    );

    assert.deepEqual(trackBaseTimes(boxes, 1), [0, 2 * 90000]);
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
    assert.deepEqual(trackBaseTimes(boxes, 1), [0, 2 * 90000]);
    assert.equal(trackBaseTimes(boxes, 2).length, 2);
});

test("keeps avc1 when every video shares the same parameter sets", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const mp4 = concat(hlsMp4.transmuxSections([loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "b")], muxjs));

    assert.equal(sampleEntryType(mp4), "avc1");
});

test("refuses to merge videos with different resolutions", () => {
    const { hlsMp4, muxjs } = loadHlsMp4();
    const sections = [loadFixtureSection(hlsMp4, "a"), loadFixtureSection(hlsMp4, "d")];

    assert.throws(() => hlsMp4.transmuxSections(sections, muxjs), /解像度や音声の形式が異なる/);
});

test("rejects merging when no converter is available", () => {
    const { hlsMp4 } = loadHlsMp4();

    assert.throws(() => hlsMp4.transmuxSections([], null), /動画変換ライブラリ/);
});
