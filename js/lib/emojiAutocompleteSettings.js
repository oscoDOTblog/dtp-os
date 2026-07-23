const STORAGE_KEY = "emojiAutocompleteEnabled";

export function getEmojiAutocompleteEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: true }, (items) => {
      resolve(items[STORAGE_KEY] !== false);
    });
  });
}

export function setEmojiAutocompleteEnabled(enabled) {
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
