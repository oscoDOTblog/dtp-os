const STORAGE_KEY = "toolFavoriteIds";

export function getToolFavorites() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (items) => {
      const saved = items[STORAGE_KEY];
      resolve(Array.isArray(saved) ? saved : []);
    });
  });
}

export function saveToolFavorites(favoriteIds) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: favoriteIds }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

export function toggleToolFavorite(favoriteIds, toolId) {
  if (favoriteIds.includes(toolId)) {
    return favoriteIds.filter((id) => id !== toolId);
  }
  return [...favoriteIds, toolId];
}

function compareToolsByLabel(a, b) {
  return a.label.localeCompare(b.label);
}

export function sortToolsByFavorites(tools, favoriteIds) {
  const favoriteSet = new Set(favoriteIds);
  const favorites = tools
    .filter((tool) => favoriteSet.has(tool.id))
    .sort(compareToolsByLabel);
  const rest = tools
    .filter((tool) => !favoriteSet.has(tool.id))
    .sort(compareToolsByLabel);
  return [...favorites, ...rest];
}
