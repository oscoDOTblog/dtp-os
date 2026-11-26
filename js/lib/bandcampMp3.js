// Minimal ID3v2.3 writer: title/artist/album/year/track + cover art.
// Falls back to the raw stream bytes whenever anything here fails.
function syncsafe(n) {
  return [(n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f];
}

function be32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function latin1(str) {
  const out = [];
  const s = String(str);
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

function utf16(str) {
  const out = [0xff, 0xfe];
  const s = String(str);
  for (const ch of s) {
    let cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      cp -= 0x10000;
      const hi = 0xd800 + (cp >>> 10),
        lo = 0xdc00 + (cp & 0x3ff);
      out.push(hi & 0xff, hi >>> 8, lo & 0xff, lo >>> 8);
    } else {
      out.push(cp & 0xff, (cp >>> 8) & 0xff);
    }
  }
  return out;
}

function textFrame(id, str) {
  const body = [0x01, ...utf16(str)];
  return [...latin1(id), ...be32(body.length), 0x00, 0x00, ...body];
}

function latinFrame(id, str) {
  const body = [0x00, ...latin1(str)];
  return [...latin1(id), ...be32(body.length), 0x00, 0x00, ...body];
}

function apicFrame(mime, imgBytes) {
  const prefix = [0x01, ...latin1(mime), 0x00, 0x03, 0xff, 0xfe, 0x00, 0x00];
  const size = prefix.length + imgBytes.length;
  const frame = new Uint8Array(10 + size);
  frame.set([...latin1("APIC"), ...be32(size), 0x00, 0x00]);
  frame.set(prefix, 10);
  frame.set(imgBytes, 10 + prefix.length);
  return frame;
}

function buildId3v23(tags) {
  const frames = [];
  if (tags.title) frames.push(textFrame("TIT2", tags.title));
  if (tags.artist) frames.push(textFrame("TPE1", tags.artist));
  if (tags.album) frames.push(textFrame("TALB", tags.album));
  if (tags.year) frames.push(latinFrame("TYER", tags.year));
  if (tags.num) {
    frames.push(
      latinFrame(
        "TRCK",
        tags.total ? `${tags.num}/${tags.total}` : String(tags.num)
      )
    );
  }
  if (tags.artBytes && tags.mime) {
    frames.push(apicFrame(tags.mime, tags.artBytes));
  }
  const size = frames.reduce((total, frame) => total + frame.length, 0);
  const tag = new Uint8Array(10 + size);
  tag.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, ...syncsafe(size)]);
  let offset = 10;
  for (const frame of frames) {
    tag.set(frame, offset);
    offset += frame.length;
  }
  return tag;
}

function stripId3(bytes) {
  let start = 0,
    end = bytes.length;
  if (
    bytes.length > 10 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33 &&
    (bytes[3] === 3 || bytes[3] === 4) &&
    bytes[4] === 0
  ) {
    const size =
      (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    if (size >= 0 && 10 + size <= bytes.length) start = 10 + size;
  }
  if (
    end - start >= 128 &&
    bytes[end - 128] === 0x54 &&
    bytes[end - 127] === 0x41 &&
    bytes[end - 126] === 0x47
  ) {
    end -= 128;
  }
  return bytes.slice(start, end);
}

function sniffImage(bytes) {
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length > 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return "";
}

function cleanText(value) {
  return String(value || "").slice(0, 500);
}

function cleanInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}


// Streams the audio with byte-progress posts (album staging) so the page
// can show per-track progress, and aborts if the stream stalls.
async function fetchAudioWithProgress(url, { reqId, tabId }, timeoutMs = 60000) {
  const res = await fetch(url, {
    credentials: "omit",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Audio fetch failed with HTTP ${res.status}`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastPosted = 0;
  const post = (force = false) => {
    if (!reqId || typeof tabId !== "number") return;
    if (!force && loaded - lastPosted < 131072) return;
    lastPosted = loaded;
    try {
      // Goes page-ward via the service worker; delivery failures are
      // non-fatal (the progress strip just pauses).
      chrome.runtime.sendMessage({
        type: "dtp-bandcamp-stage-progress",
        tabId,
        reqId,
        loaded,
        total,
      }).catch(() => {});
    } catch {}
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    post();
  }
  post(true);
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function createTaggedMp3({ url, tags, keep, reqId, tabId }) {
  const audioBytes = stripId3(await fetchAudioWithProgress(url, { reqId, tabId }));
  let artBytes;
  let mime = "";
  if (tags.art) {
    try {
      const art = await fetch(tags.art, {
        credentials: "omit",
        signal: AbortSignal.timeout(15000),
      });
      if (art.ok) {
        artBytes = new Uint8Array(await art.arrayBuffer());
        mime = sniffImage(artBytes);
      }
    } catch {
      // The track can still be tagged without cover art.
    }
  }
  const tag = buildId3v23({
    title: cleanText(tags.title),
    artist: cleanText(tags.artist),
    album: cleanText(tags.album),
    year: cleanText(tags.year),
    num: cleanInt(tags.num),
    total: cleanInt(tags.total),
    artBytes,
    mime,
  });
  const blobUrl = URL.createObjectURL(
    new Blob([tag, audioBytes], { type: "audio/mpeg" })
  );
  // Staged tracks (album ZIP flow) are revoked by the zip builder; the
  // safety timeout only guards against a batch that never completes.
  setTimeout(() => URL.revokeObjectURL(blobUrl), keep ? 600000 : 60000);
  return blobUrl;
}

// Minimal stored-entry ZIP writer (MP3s are already compressed, so no
// deflate): local headers + central directory + EOCD, UTF-8 names.
let crcTable;
function crc32(bytes) {
  crcTable ??= (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() >> 1) & 0x1f),
    day:
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

function buildZip(entries) {
  const stamp = dosDateTime(new Date());
  const chunks = [];
  const central = [];
  const encoder = new TextEncoder();
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.bytes.length, true);
    lv.setUint32(22, entry.bytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, entry.bytes);
    const header = new Uint8Array(46 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x02014b50, true);
    hv.setUint16(4, 20, true); // version made by
    hv.setUint16(6, 20, true); // version needed
    hv.setUint16(8, 0x0800, true);
    hv.setUint16(10, 0, true);
    hv.setUint16(12, stamp.time, true);
    hv.setUint16(14, stamp.day, true);
    hv.setUint32(16, crc, true);
    hv.setUint32(20, entry.bytes.length, true);
    hv.setUint32(24, entry.bytes.length, true);
    hv.setUint16(28, nameBytes.length, true);
    hv.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    central.push(header);
    offset += local.length + entry.bytes.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const header of central) {
    chunks.push(header);
    centralSize += header.length;
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  chunks.push(eocd);
  return new Blob(chunks, { type: "application/zip" });
}

async function buildZipFromBlobs(entries, coverUrl) {
  const decoded = [];
  try {
    for (const entry of entries) {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error(`Blob fetch failed with HTTP ${res.status}`);
      decoded.push({
        name: entry.name,
        bytes: new Uint8Array(await res.arrayBuffer()),
      });
    }
    if (coverUrl) {
      // Album cover rides along as cover.jpg/png; optional — the zip is
      // still delivered if it can't be fetched.
      try {
        const art = await fetch(coverUrl, {
          credentials: "omit",
          signal: AbortSignal.timeout(15000),
        });
        if (art.ok) {
          const bytes = new Uint8Array(await art.arrayBuffer());
          const mime = sniffImage(bytes);
          if (mime) {
            decoded.push({
              name: mime === "image/png" ? "cover.png" : "cover.jpg",
              bytes,
            });
          }
        }
      } catch {}
    }
    const blobUrl = URL.createObjectURL(buildZip(decoded));
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return blobUrl;
  } finally {
    // Staged tracks are consumed either way on success; on failure the
    // caller already has nothing to gain from them.
    for (const entry of entries) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {}
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const fromExtension =
    sender.id === chrome.runtime.id && !sender.tab;
  if (fromExtension && message?.type === "dtp-bandcamp-tag-mp3") {
    createTaggedMp3(message).then(
      (url) => sendResponse({ url }),
      (err) => sendResponse({ error: err.message })
    );
    return true;
  }
  if (fromExtension && message?.type === "dtp-bandcamp-zip-blobs") {
    buildZipFromBlobs(
      Array.isArray(message.entries) ? message.entries : [],
      message.cover
    ).then(
      (url) => sendResponse({ url }),
      (err) => sendResponse({ error: err.message })
    );
    return true;
  }
});
