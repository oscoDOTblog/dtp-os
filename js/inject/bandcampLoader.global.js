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

  // The extension service worker handles privileged downloads. Messages
  // carrying a reqId (album zip flow + batch progress) get the full result
  // echoed back to the page so the sender can step its progress; plain
  // single downloads stay fire-and-forget.
  const DOWNLOAD_TYPES = new Set([
    "dtp-bandcamp-download",
    "dtp-bandcamp-stage-mp3",
    "dtp-bandcamp-download-zip",
  ]);
  window.addEventListener("message", (event) => {
    if (event.source !== window || !DOWNLOAD_TYPES.has(event.data?.type)) {
      return;
    }
    const reqId = event.data.reqId;
    chrome.runtime.sendMessage(event.data).then((result) => {
      if (!result?.ok) throw new Error(result?.error || "No download response");
      if (reqId) {
        window.postMessage(
          { type: "dtp-bandcamp-download-result", reqId, ok: true, url: result.url },
          "*"
        );
      }
    }).catch((err) => {
      console.warn("Bandcamp download failed:", err.message);
      if (reqId) {
        window.postMessage(
          { type: "dtp-bandcamp-download-result", reqId, ok: false, error: err.message },
          "*"
        );
      }
    });
  });

  // Byte-progress pings for album staging: straight through to the page,
  // where the download queue matches them against the active reqId.
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "dtp-bandcamp-stage-progress") {
      window.postMessage(message, "*");
    }
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
    downloadButton: true,
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
