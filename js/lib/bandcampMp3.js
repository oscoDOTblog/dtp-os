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


async function createTaggedMp3({ url, tags }) {
  const audio = await fetch(url, { credentials: "omit" });
  if (!audio.ok) throw new Error(`Audio fetch failed with HTTP ${audio.status}`);
  const audioBytes = stripId3(new Uint8Array(await audio.arrayBuffer()));
  let artBytes;
  let mime = "";
  if (tags.art) {
    try {
      const art = await fetch(tags.art, { credentials: "omit" });
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
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return blobUrl;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message?.type !== "dtp-bandcamp-tag-mp3" ||
    sender.id !== chrome.runtime.id ||
    sender.tab
  ) {
    return;
  }
  createTaggedMp3(message).then(
    (url) => sendResponse({ url }),
    (err) => sendResponse({ error: err.message })
  );
  return true;
});
