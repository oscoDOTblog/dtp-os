export const TOOLS = {
  EMOJIS: "emojis",
  YOUTUBE_PLAYLIST: "youtube-playlist",
  VIDEO_DOWNLOADER: "video-downloader",
  CLOUDFLARE_DOCKER: "cloudflare-docker",
  COLORS: "colors",
};

export const IMPLEMENTED_TOOLS = new Set([
  TOOLS.EMOJIS,
  TOOLS.YOUTUBE_PLAYLIST,
  TOOLS.VIDEO_DOWNLOADER,
  TOOLS.CLOUDFLARE_DOCKER,
]);

const DEFAULT_SETTINGS = {
  lastTool: null,
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      resolve({
        lastTool: items.lastTool ?? DEFAULT_SETTINGS.lastTool,
      });
    });
  });
}

function saveSettings(partial) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(partial, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

export async function getLastTool() {
  const settings = await getSettings();
  const lastTool = settings.lastTool;
  if (!lastTool || !IMPLEMENTED_TOOLS.has(lastTool)) {
    return null;
  }
  return lastTool;
}

export async function setLastTool(id) {
  if (!Object.values(TOOLS).includes(id)) {
    throw new Error("Invalid tool id");
  }
  await saveSettings({ lastTool: id });
}
