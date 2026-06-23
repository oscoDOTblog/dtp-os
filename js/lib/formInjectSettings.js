import {
  DEFAULT_FIELD_VALUES,
  buildStarterDefaultsObject,
  parseCustomDefaultsJson,
  serializeDefaultsForEditor,
} from "./formInjectDefaults.js";

const STORAGE_KEYS = {
  customDefaultsJson: "formInjectCustomDefaultsJson",
  fillMode: "formInjectFillMode",
};

const DEFAULT_FILL_MODE = "auto";

export function getDefaultFieldValues() {
  return { ...DEFAULT_FIELD_VALUES };
}

export function getCustomDefaultsJson() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [STORAGE_KEYS.customDefaultsJson]: "" },
      (items) => {
        resolve(items[STORAGE_KEYS.customDefaultsJson] ?? "");
      }
    );
  });
}

export function getCustomDefaults() {
  return getCustomDefaultsJson().then((raw) => {
    const parsed = parseCustomDefaultsJson(raw);
    return parsed.ok ? parsed.value : {};
  });
}

export function getFillMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [STORAGE_KEYS.fillMode]: DEFAULT_FILL_MODE },
      (items) => {
        const mode = items[STORAGE_KEYS.fillMode] ?? DEFAULT_FILL_MODE;
        resolve(mode === "generic" ? "generic" : "auto");
      }
    );
  });
}

export function saveCustomDefaultsJson(raw) {
  const parsed = parseCustomDefaultsJson(raw);
  if (!parsed.ok) {
    return Promise.reject(new Error(parsed.error));
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      { [STORAGE_KEYS.customDefaultsJson]: raw.trim() },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(parsed.value);
      }
    );
  });
}

export function saveFillMode(mode) {
  const normalized = mode === "generic" ? "generic" : "auto";
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.fillMode]: normalized }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(normalized);
    });
  });
}

export function getMergedDefaults(customOverrides = {}) {
  return {
    ...DEFAULT_FIELD_VALUES,
    ...customOverrides,
  };
}

export function buildStarterDefaultsJson() {
  return serializeDefaultsForEditor(buildStarterDefaultsObject());
}

export { parseCustomDefaultsJson, serializeDefaultsForEditor };
