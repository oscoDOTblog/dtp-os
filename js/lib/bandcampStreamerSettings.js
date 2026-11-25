const ENABLED_KEY = "bandcampStreamerEnabled";
const PREFS_KEY = "bandcampStreamerPrefs";

export const BANDCAMP_STREAMER_DEFAULT_PREFS = {
  playpause: "Space",
  previous: "ArrowLeft",
  next: "ArrowRight",
  seekback: "Comma",
  seekforward: "Period",
  seekrate: 10,
  accent: "pink",
  theme: "dark",
};

// Same accent tones as dtp-tunes.
export const BANDCAMP_STREAMER_ACCENTS = {
  pink: "#ff1493",
  green: "#1db954",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
};

function read(keys, resolve) {
  chrome.storage.local.get(keys, (items) => {
    resolve(items || {});
  });
}

export function getBandcampStreamerEnabled() {
  return new Promise((resolve) => {
    read({ [ENABLED_KEY]: false }, (items) => {
      resolve(items[ENABLED_KEY] === true);
    });
  });
}

export function setBandcampStreamerEnabled(enabled) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [ENABLED_KEY]: Boolean(enabled) }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(Boolean(enabled));
    });
  });
}

export function getBandcampStreamerPrefs() {
  return new Promise((resolve) => {
    read({ [PREFS_KEY]: null }, (items) => {
      resolve({
        ...BANDCAMP_STREAMER_DEFAULT_PREFS,
        ...(items[PREFS_KEY] || {}),
      });
    });
  });
}

export function setBandcampStreamerPrefs(prefs) {
  const next = {
    ...BANDCAMP_STREAMER_DEFAULT_PREFS,
    ...(prefs || {}),
  };
  next.seekrate = Math.min(30, Math.max(1, Number(next.seekrate) || 10));
  if (!BANDCAMP_STREAMER_ACCENTS[next.accent]) {
    next.accent = "pink";
  }
  if (next.theme !== "light" && next.theme !== "dark") {
    next.theme = "dark";
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [PREFS_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(next);
    });
  });
}
