const STORAGE_KEY = "applyCopilotSettings";

const DEFAULTS = {
  cdpUrl: "http://127.0.0.1:9222",
  scriptPath:
    "/Users/argo/Code/dtp/dtp-yui/cv/services/agent/scripts/relaunch-chrome-cdp.sh",
};

export async function getApplyCopilotSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const raw = stored[STORAGE_KEY] || {};
  return {
    cdpUrl: String(raw.cdpUrl || DEFAULTS.cdpUrl).trim() || DEFAULTS.cdpUrl,
    scriptPath:
      String(raw.scriptPath || DEFAULTS.scriptPath).trim() || DEFAULTS.scriptPath,
  };
}

export async function saveApplyCopilotSettings(partial = {}) {
  const current = await getApplyCopilotSettings();
  const next = {
    cdpUrl:
      partial.cdpUrl !== undefined
        ? String(partial.cdpUrl).trim() || DEFAULTS.cdpUrl
        : current.cdpUrl,
    scriptPath:
      partial.scriptPath !== undefined
        ? String(partial.scriptPath).trim() || DEFAULTS.scriptPath
        : current.scriptPath,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export { DEFAULTS as APPLY_COPILOT_DEFAULTS };
