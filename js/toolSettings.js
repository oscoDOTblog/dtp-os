export const TOOLS = {
  EMOJIS: "emojis",
  COLORS: "colors",
  TBD: "tbd",
};

export const IMPLEMENTED_TOOLS = new Set([TOOLS.EMOJIS]);

const MAX_RECENT_EMOJIS = 12;

const DEFAULT_SETTINGS = {
  lastTool: null,
  recentEmojis: [],
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      resolve({
        lastTool: items.lastTool ?? DEFAULT_SETTINGS.lastTool,
        recentEmojis: items.recentEmojis ?? DEFAULT_SETTINGS.recentEmojis,
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

export async function getRecentEmojis() {
  const settings = await getSettings();
  return settings.recentEmojis;
}

export async function recordEmojiUse(emoji) {
  const settings = await getSettings();
  const recent = settings.recentEmojis.filter((item) => item !== emoji);
  recent.unshift(emoji);
  await saveSettings({ recentEmojis: recent.slice(0, MAX_RECENT_EMOJIS) });
}
