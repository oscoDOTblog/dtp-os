const STORAGE_KEY = "twitchAdBlockEnabled";

export function getTwitchAdBlockEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: false }, (items) => {
      resolve(items[STORAGE_KEY] === true);
    });
  });
}

export function setTwitchAdBlockEnabled(enabled) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: Boolean(enabled) }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(Boolean(enabled));
    });
  });
}
