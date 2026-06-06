import { DEFAULT_GREETINGS } from "./defaultGreetings.js";

export const DEFAULT_APP_NAME = "dtp-os";

const STORAGE_KEYS = {
  appName: "appName",
  customGreetingsJson: "customGreetingsJson",
  brandingEnabled: "brandingEnabled",
};

const DEFAULT_STORAGE = {
  [STORAGE_KEYS.appName]: DEFAULT_APP_NAME,
  [STORAGE_KEYS.customGreetingsJson]: "",
  [STORAGE_KEYS.brandingEnabled]: true,
};

function readStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_STORAGE, (items) => {
      resolve({
        appName: items[STORAGE_KEYS.appName] ?? DEFAULT_APP_NAME,
        customGreetingsJson:
          items[STORAGE_KEYS.customGreetingsJson] ??
          DEFAULT_STORAGE[STORAGE_KEYS.customGreetingsJson],
        brandingEnabled:
          items[STORAGE_KEYS.brandingEnabled] ??
          DEFAULT_STORAGE[STORAGE_KEYS.brandingEnabled],
      });
    });
  });
}

function writeStorage(partial) {
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

export function parseGreetingsJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { greetings: null, error: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { greetings: null, error: "Greetings must be valid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { greetings: null, error: "Greetings must be a JSON array of strings." };
  }

  const greetings = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") {
      return {
        greetings: null,
        error: "Each greeting must be a string.",
      };
    }
    const message = entry.trim();
    if (message) {
      greetings.push(message);
    }
  }

  if (greetings.length === 0) {
    return {
      greetings: null,
      error: "Add at least one non-empty greeting string.",
    };
  }

  return { greetings, error: null };
}

export async function getBrandingEnabled() {
  const settings = await readStorage();
  return settings.brandingEnabled !== false;
}

export async function setBrandingEnabled(enabled) {
  await writeStorage({ [STORAGE_KEYS.brandingEnabled]: Boolean(enabled) });
}

export async function getAppName() {
  const settings = await readStorage();
  const name = settings.appName.trim();
  return name || DEFAULT_APP_NAME;
}

export async function setAppName(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("App name cannot be empty.");
  }
  await writeStorage({ [STORAGE_KEYS.appName]: trimmed });
}

export async function getCustomGreetingsJson() {
  const settings = await readStorage();
  return settings.customGreetingsJson;
}

export async function setCustomGreetingsJson(raw) {
  const { error } = parseGreetingsJson(raw);
  if (error) {
    throw new Error(error);
  }
  await writeStorage({ [STORAGE_KEYS.customGreetingsJson]: raw.trim() });
}

export async function getActiveGreetings() {
  const settings = await readStorage();
  const { greetings, error } = parseGreetingsJson(settings.customGreetingsJson);
  if (error) {
    return DEFAULT_GREETINGS;
  }
  return greetings ?? DEFAULT_GREETINGS;
}

export function pickRandomGreeting(greetings, previousMessage = null) {
  if (!greetings.length) {
    return DEFAULT_GREETINGS[0];
  }
  if (greetings.length === 1) {
    return greetings[0];
  }

  let message = greetings[Math.floor(Math.random() * greetings.length)];
  let attempts = 0;
  while (message === previousMessage && attempts < 8) {
    message = greetings[Math.floor(Math.random() * greetings.length)];
    attempts += 1;
  }
  return message;
}

export async function pickRandomGreetingForNewTab() {
  const greetings = await getActiveGreetings();
  return pickRandomGreeting(greetings);
}
