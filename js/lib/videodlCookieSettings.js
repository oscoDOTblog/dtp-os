const SETTINGS_KEY = "videodlCookieSettings";
const STATE_KEY = "videodlCookieSyncState";

export const DEFAULT_API_URL = "http://127.0.0.1:8545";
export const DEFAULT_INTERVAL_MINUTES = 360;
export const COOKIES_PERMISSION = "cookies";
export const ALARM_NAME = "dtp-videodl-cookie-sync";

export const DEFAULT_SETTINGS = {
  videodlCookieApiUrl: DEFAULT_API_URL,
  videodlCookieAutoSync: false,
  videodlCookieIntervalMinutes: DEFAULT_INTERVAL_MINUTES,
};

const EMPTY_STATE = {
  lastSyncedAt: null,
  cookieCount: 0,
  lastError: null,
  signedIn: null,
};

function clampIntervalMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INTERVAL_MINUTES;
  }
  return Math.min(10080, Math.max(1, Math.round(parsed)));
}

export function normalizeVideodlCookieApiUrl(url) {
  const trimmed = String(url || "").trim();
  return trimmed || DEFAULT_API_URL;
}

export async function getVideodlCookieSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] || {};
  return {
    videodlCookieApiUrl: normalizeVideodlCookieApiUrl(raw.videodlCookieApiUrl),
    videodlCookieAutoSync: raw.videodlCookieAutoSync === true,
    videodlCookieIntervalMinutes: clampIntervalMinutes(
      raw.videodlCookieIntervalMinutes
    ),
  };
}

export async function saveVideodlCookieSettings(partial = {}) {
  const current = await getVideodlCookieSettings();
  const next = {
    videodlCookieApiUrl:
      partial.videodlCookieApiUrl !== undefined
        ? normalizeVideodlCookieApiUrl(partial.videodlCookieApiUrl)
        : current.videodlCookieApiUrl,
    videodlCookieAutoSync:
      partial.videodlCookieAutoSync !== undefined
        ? Boolean(partial.videodlCookieAutoSync)
        : current.videodlCookieAutoSync,
    videodlCookieIntervalMinutes:
      partial.videodlCookieIntervalMinutes !== undefined
        ? clampIntervalMinutes(partial.videodlCookieIntervalMinutes)
        : current.videodlCookieIntervalMinutes,
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getVideodlCookieSyncState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  const raw = stored[STATE_KEY] || {};
  return {
    lastSyncedAt:
      typeof raw.lastSyncedAt === "string" && raw.lastSyncedAt
        ? raw.lastSyncedAt
        : null,
    cookieCount: Number.isFinite(Number(raw.cookieCount))
      ? Math.max(0, Math.round(Number(raw.cookieCount)))
      : 0,
    lastError:
      typeof raw.lastError === "string" && raw.lastError ? raw.lastError : null,
    signedIn: typeof raw.signedIn === "boolean" ? raw.signedIn : null,
  };
}

export async function saveVideodlCookieSyncState(partial = {}) {
  const current = await getVideodlCookieSyncState();
  const next = {
    ...current,
    ...partial,
  };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  return next;
}

export { EMPTY_STATE as EMPTY_VIDEODL_COOKIE_SYNC_STATE, SETTINGS_KEY, STATE_KEY };
