/* dtp-os Bandcamp Streamer loader (ISOLATED world).
 *
 * Reads hotkey prefs from chrome.storage.local, then injects the MAIN-world
 * player module, which needs direct access to Bandcamp page globals
 * (window.playerview, window.collectionPlayer, jQuery, BCEvents, ...).
 * Mirrors upstream bandcamp-streamer inject.js, minus chrome.storage.sync.
 */
(function () {
  const SCRIPT_ID = "bandcamp-streamer";
  const MODULE_URL = chrome.runtime.getURL("js/inject/bandcamp/init.js");
  const CSS_URL = chrome.runtime.getURL("js/inject/bandcamp/bandcamp-streamer.css");
  const CSS_MARKER = "data-dtp-bandcamp-css";

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
    const body = [
      0x01,
      ...latin1(mime),
      0x00,
      0x03,
      0xff,
      0xfe,
      0x00,
      0x00,
      ...imgBytes,
    ];
    return [...latin1("APIC"), ...be32(body.length), 0x00, 0x00, ...body];
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
    const body = frames.flat();
    return new Uint8Array([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, ...syncsafe(body.length), ...body,
    ]);
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

  function directDownload(url, filename) {
    try {
      chrome.downloads.download({ url, filename, saveAs: false }, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "Bandcamp download failed:",
            chrome.runtime.lastError.message
          );
        }
      });
    } catch (err) {
      console.warn("Bandcamp download failed:", err);
    }
  }

  async function runDownload({ url, filename, tags }) {
    const safeName =
      typeof filename === "string" && filename ? filename : "bandcamp.mp3";
    if (!tags || (!tags.title && !tags.art)) {
      directDownload(url, safeName);
      return;
    }
    try {
      const audioRes = await fetch(url, { credentials: "omit" });
      if (!audioRes.ok) throw new Error(`audio fetch: ${audioRes.status}`);
      const audioBytes = stripId3(new Uint8Array(await audioRes.arrayBuffer()));
      let artBytes = null,
        mime = "";
      if (tags.art) {
        try {
          const artRes = await fetch(tags.art, { credentials: "omit" });
          if (artRes.ok) {
            const cand = new Uint8Array(await artRes.arrayBuffer());
            const m = sniffImage(cand);
            if (m) {
              artBytes = [...cand];
              mime = m;
            }
          }
        } catch (e) {}
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
      chrome.downloads.download(
        { url: blobUrl, filename: safeName, saveAs: false },
        () => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          if (chrome.runtime.lastError) {
            console.warn(
              "Bandcamp tagged download failed, retrying raw:",
              chrome.runtime.lastError.message
            );
            directDownload(url, safeName);
          }
        }
      );
    } catch (err) {
      console.warn("Bandcamp tagged download failed, retrying raw:", err);
      directDownload(url, safeName);
    }
  }

  // Download bridge: the MAIN-world player bar can't touch chrome APIs,
  // so it posts the stream URL (+ tag metadata) here and the download
  // runs privileged. Only Bandcamp stream/file hosts are accepted.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== "dtp-bandcamp-download") return;
    if (typeof data.url !== "string") return;
    let host = "";
    try {
      host = new URL(data.url).hostname;
    } catch (e) {
      return;
    }
    if (
      host !== "bandcamp.com" &&
      !host.endsWith(".bandcamp.com") &&
      !host.endsWith(".bcbits.com")
    ) {
      return;
    }
    runDownload(data);
  });

  // Stylesheet as a plain <link>: does not depend on the dynamic
  // content-script `css` delivery path.
  function injectCss() {
    if (document.querySelector(`link[${CSS_MARKER}]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_URL;
    link.setAttribute(CSS_MARKER, "1");
    (document.head || document.documentElement).appendChild(link);
  }
  const DEFAULT_PREFS = {
    playpause: "Space",
    previous: "ArrowLeft",
    next: "ArrowRight",
    seekback: "Comma",
    seekforward: "Period",
    seekrate: 10,
    accent: "pink",
    theme: "dark",
  };

  function inject(prefs) {
    if (document.getElementById(SCRIPT_ID)) {
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.setAttribute("type", "module");
    script.setAttribute("src", MODULE_URL);
    script.setAttribute("data-prefs", JSON.stringify(prefs));
    (document.body || document.documentElement).appendChild(script);
  }

  injectCss();

  // Accent for page-level player theming (mirrors the popup tool's tones).
  const ACCENT_HEX = {
    pink: "#ff1493",
    green: "#1db954",
    blue: "#3b82f6",
    purple: "#a855f7",
    orange: "#f97316",
  };

  function applyAccent(prefs) {
    const hex = (prefs && ACCENT_HEX[prefs.accent]) || ACCENT_HEX.pink;
    document.documentElement.style.setProperty("--dtp-accent", hex);
  }

  function applyPlayerTheme(prefs) {
    document.documentElement.dataset.dtpPlayerTheme =
      prefs && prefs.theme === "light" ? "light" : "dark";
  }

  try {
    chrome.storage.local.get(
      { bandcampStreamerPrefs: DEFAULT_PREFS },
      (items) => {
        const prefs = {
          ...DEFAULT_PREFS,
          ...((items && items.bandcampStreamerPrefs) || {}),
        };
        applyAccent(prefs);
        applyPlayerTheme(prefs);
        inject(prefs);
      }
    );
  } catch (err) {
    applyAccent(DEFAULT_PREFS);
    applyPlayerTheme(DEFAULT_PREFS);
    inject(DEFAULT_PREFS);
  }
})();
