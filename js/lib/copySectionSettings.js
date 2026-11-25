const ENABLED_KEY = "copySectionEnabled";
const FORMAT_KEY = "copySectionFormat";
const BUTTON_ENABLED_KEY = "copySectionButtonEnabled";
const BUTTON_CORNER_KEY = "copySectionButtonCorner";

export const DEFAULT_COPY_SECTION_CORNER = "bottom-left";

export const COPY_SECTION_CORNER_OPTIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

export const COPY_SECTION_FORMATS = {
  MARKDOWN: "markdown",
  PLAIN: "plain",
};

export const DEFAULT_COPY_SECTION_FORMAT = COPY_SECTION_FORMATS.MARKDOWN;

export const COPY_SECTION_FORMAT_OPTIONS = [
  { value: COPY_SECTION_FORMATS.MARKDOWN, label: "Markdown" },
  { value: COPY_SECTION_FORMATS.PLAIN, label: "Plain text" },
];

export function normalizeCopySectionFormat(format) {
  return format === COPY_SECTION_FORMATS.PLAIN
    ? COPY_SECTION_FORMATS.PLAIN
    : COPY_SECTION_FORMATS.MARKDOWN;
}

export function getCopySectionEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [ENABLED_KEY]: true }, (items) => {
      resolve(items[ENABLED_KEY] !== false);
    });
  });
}

export function setCopySectionEnabled(enabled) {
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

export function getCopySectionFormat() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [FORMAT_KEY]: DEFAULT_COPY_SECTION_FORMAT },
      (items) => {
        resolve(normalizeCopySectionFormat(items[FORMAT_KEY]));
      }
    );
  });
}

export function setCopySectionFormat(format) {
  const normalized = normalizeCopySectionFormat(format);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [FORMAT_KEY]: normalized }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(normalized);
    });
  });
}

export function getCopySectionButtonEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [BUTTON_ENABLED_KEY]: true }, (items) => {
      resolve(items[BUTTON_ENABLED_KEY] !== false);
    });
  });
}

export function setCopySectionButtonEnabled(enabled) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [BUTTON_ENABLED_KEY]: Boolean(enabled) }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(Boolean(enabled));
    });
  });
}

export function normalizeCopySectionCorner(corner) {
  return COPY_SECTION_CORNER_OPTIONS.some((option) => option.value === corner)
    ? corner
    : DEFAULT_COPY_SECTION_CORNER;
}

export function getCopySectionButtonCorner() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [BUTTON_CORNER_KEY]: DEFAULT_COPY_SECTION_CORNER },
      (items) => {
        resolve(normalizeCopySectionCorner(items[BUTTON_CORNER_KEY]));
      }
    );
  });
}

export function setCopySectionButtonCorner(corner) {
  const normalized = normalizeCopySectionCorner(corner);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [BUTTON_CORNER_KEY]: normalized }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(normalized);
    });
  });
}
