import {
  deleteWallpaper,
  getAllWallpapers,
  getWallpaperById,
  putWallpaper,
} from "./storage.js";

export const DISPLAY_MODES = {
  WALLPAPER: "wallpaper",
  EMBED: "embed",
};

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_WALLPAPERS = 50;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DEFAULT_SETTINGS = {
  displayMode: DISPLAY_MODES.EMBED,
  wallpaperOrder: [],
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      resolve({
        displayMode: items.displayMode ?? DEFAULT_SETTINGS.displayMode,
        wallpaperOrder: items.wallpaperOrder ?? DEFAULT_SETTINGS.wallpaperOrder,
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

export async function getDisplayMode() {
  const settings = await getSettings();
  return settings.displayMode;
}

export async function setDisplayMode(mode) {
  if (mode !== DISPLAY_MODES.WALLPAPER && mode !== DISPLAY_MODES.EMBED) {
    throw new Error("Invalid display mode");
  }
  await saveSettings({ displayMode: mode });
}

export async function getWallpaperOrder() {
  const settings = await getSettings();
  return settings.wallpaperOrder;
}

async function setWallpaperOrder(order) {
  await saveSettings({ wallpaperOrder: order });
}

export function validateImageFile(file) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Only JPEG, PNG, and WebP images are supported.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Each image must be 5 MB or smaller.";
  }
  return null;
}

export async function addWallpaper(file) {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const order = await getWallpaperOrder();
  if (order.length >= MAX_WALLPAPERS) {
    throw new Error(`You can save up to ${MAX_WALLPAPERS} wallpapers.`);
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    blob: file,
    mimeType: file.type,
    addedAt: Date.now(),
  };

  await putWallpaper(record);
  await setWallpaperOrder([...order, id]);
  return id;
}

export async function removeWallpaper(id) {
  await deleteWallpaper(id);
  const order = await getWallpaperOrder();
  await setWallpaperOrder(order.filter((entryId) => entryId !== id));
}

export async function pickRandomWallpaperId(excludeId = null) {
  const order = await getWallpaperOrder();
  if (order.length === 0) {
    return null;
  }

  const candidates =
    excludeId && order.length > 1
      ? order.filter((id) => id !== excludeId)
      : order;

  const pool = candidates.length > 0 ? candidates : order;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export async function getWallpaperBlob(id) {
  const record = await getWallpaperById(id);
  return record?.blob ?? null;
}

export async function listWallpapersForGallery() {
  const order = await getWallpaperOrder();
  const records = await getAllWallpapers();
  const byId = new Map(records.map((record) => [record.id, record]));

  return order
    .map((id) => {
      const record = byId.get(id);
      if (!record) {
        return null;
      }
      return {
        id: record.id,
        mimeType: record.mimeType,
        addedAt: record.addedAt,
        blob: record.blob,
      };
    })
    .filter(Boolean);
}

export async function syncWallpaperOrderWithDatabase() {
  const order = await getWallpaperOrder();
  const records = await getAllWallpapers();
  const existingIds = new Set(records.map((record) => record.id));
  const cleaned = order.filter((id) => existingIds.has(id));

  for (const record of records) {
    if (!cleaned.includes(record.id)) {
      cleaned.push(record.id);
    }
  }

  if (cleaned.length !== order.length) {
    await setWallpaperOrder(cleaned);
  }

  return cleaned;
}
