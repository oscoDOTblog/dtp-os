import { createCossButton } from "./lib/cossButton.js";
import {
  createCossField,
  createCossFieldDescription,
  createCossFieldGroup,
  createCossFieldLabel,
} from "./lib/cossField.js";
import {
  createCossSwitchField,
  setCossSwitchChecked,
} from "./lib/cossSwitch.js";
import {
  DEFAULT_API_URL,
  getVideodlCookieSettings,
  getVideodlCookieSyncState,
  saveVideodlCookieSettings,
} from "./lib/videodlCookieSettings.js";
import {
  assertLoopbackApiUrl,
  probeVideodlCookies,
  requestCookiesPermission,
} from "./lib/videodlCookieSync.js";

function sendBackgroundMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "VideoDL cookie sync failed."));
        return;
      }
      resolve(response);
    });
  });
}

function formatTimestamp(value) {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }
  return date.toLocaleString();
}

/**
 * Push YouTube cookies from this Chrome profile to local VideoDL.
 * @returns {() => void} cleanup
 */
export function mountVideodlCookiesTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel videodl-cookies-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Pushes YouTube cookies from this Chrome profile to local VideoDL. Stay signed in on youtube.com. VideoDL must be running on loopback.";

  const statusCard = document.createElement("div");
  statusCard.className = "videodl-cookies-status-card";

  const statusRow = document.createElement("div");
  statusRow.className = "videodl-cookies-status-row";

  const statusBadge = document.createElement("span");
  statusBadge.className =
    "videodl-cookies-badge videodl-cookies-badge-unknown";
  statusBadge.textContent = "Checking…";

  const refreshBtn = createCossButton({
    text: "Refresh",
    variant: "outline",
    size: "sm",
  });

  statusRow.append(statusBadge, refreshBtn);

  const statusDetail = document.createElement("p");
  statusDetail.className = "videodl-cookies-status-detail";

  const ledger = document.createElement("dl");
  ledger.className = "videodl-cookies-ledger";

  const lastSyncRow = document.createElement("div");
  const lastSyncTerm = document.createElement("dt");
  lastSyncTerm.textContent = "Last sync";
  const lastSyncValue = document.createElement("dd");
  lastSyncValue.textContent = "Never";
  lastSyncRow.append(lastSyncTerm, lastSyncValue);

  const countRow = document.createElement("div");
  const countTerm = document.createElement("dt");
  countTerm.textContent = "Cookies";
  const countValue = document.createElement("dd");
  countValue.textContent = "—";
  countRow.append(countTerm, countValue);

  ledger.append(lastSyncRow, countRow);

  const signedInWarn = document.createElement("p");
  signedInWarn.className = "videodl-cookies-warn";
  signedInWarn.hidden = true;
  signedInWarn.textContent =
    "No YouTube login cookies found. Open youtube.com while signed in, then sync again.";

  const errorEl = document.createElement("p");
  errorEl.className = "videodl-cookies-error";
  errorEl.hidden = true;

  statusCard.append(statusRow, statusDetail, ledger, signedInWarn, errorEl);

  const fields = createCossFieldGroup();

  const {
    field: autoSyncField,
    control: autoSyncControl,
    setDisabled: setAutoSyncDisabled,
  } = createCossSwitchField({
    id: "videodlCookieAutoSync",
    label: "Auto-sync",
    description: "Refresh cookies every 6 hours while Chrome is running.",
    checked: false,
    onChange: onAutoSyncChange,
  });

  const apiField = createCossField();
  const apiLabel = createCossFieldLabel({
    text: "VideoDL API",
    htmlFor: "videodl-cookie-api-url",
  });
  const apiInput = document.createElement("input");
  apiInput.id = "videodl-cookie-api-url";
  apiInput.className = "tool-input";
  apiInput.type = "url";
  apiInput.autocomplete = "off";
  apiInput.spellcheck = false;
  apiInput.placeholder = DEFAULT_API_URL;
  const apiDescription = createCossFieldDescription({
    text: "Loopback only (127.0.0.1 or localhost).",
    id: "videodl-cookie-api-url-help",
  });
  apiInput.setAttribute("aria-describedby", apiDescription.id);
  apiField.append(apiLabel, apiInput, apiDescription);

  fields.append(autoSyncField, apiField);

  const actions = document.createElement("div");
  actions.className = "videodl-cookies-actions";

  const syncBtn = createCossButton({
    text: "Sync now",
    variant: "default",
    size: "sm",
  });
  const saveUrlBtn = createCossButton({
    text: "Save API URL",
    variant: "outline",
    size: "sm",
  });
  actions.append(syncBtn, saveUrlBtn);

  panel.append(desc, statusCard, fields, actions);
  container.appendChild(panel);

  let disposed = false;
  let busy = false;

  function setBusy(nextBusy) {
    busy = nextBusy;
    syncBtn.disabled = busy;
    saveUrlBtn.disabled = busy;
    refreshBtn.disabled = busy;
    apiInput.disabled = busy;
    setAutoSyncDisabled(busy);
  }

  function setReachable(kind, detail) {
    statusBadge.className = `videodl-cookies-badge videodl-cookies-badge-${kind}`;
    if (kind === "ready") {
      statusBadge.textContent = "VideoDL ready";
    } else if (kind === "down") {
      statusBadge.textContent = "Not running";
    } else {
      statusBadge.textContent = "Checking…";
    }
    statusDetail.textContent = detail || "";
  }

  function renderSyncState(state) {
    lastSyncValue.textContent = formatTimestamp(state?.lastSyncedAt);
    countValue.textContent =
      Number.isFinite(state?.cookieCount) && state.cookieCount > 0
        ? String(state.cookieCount)
        : "—";
    signedInWarn.hidden = state?.signedIn !== false;
    if (state?.lastError) {
      errorEl.hidden = false;
      errorEl.textContent = state.lastError;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  async function refreshStatus() {
    if (disposed) {
      return;
    }
    const apiUrl = apiInput.value.trim() || DEFAULT_API_URL;
    setReachable("unknown", `Checking ${apiUrl}…`);
    try {
      assertLoopbackApiUrl(apiUrl);
      const status = await probeVideodlCookies(apiUrl);
      if (disposed) {
        return;
      }
      const uploaded = status?.uploadedAt
        ? `Cookies on disk: ${formatTimestamp(status.uploadedAt)}`
        : "No cookies on disk yet.";
      setReachable("ready", uploaded);
    } catch (error) {
      if (disposed) {
        return;
      }
      setReachable("down", error?.message || String(error));
    }

    const state = await getVideodlCookieSyncState();
    if (!disposed) {
      renderSyncState(state);
    }
  }

  async function persistApiUrl() {
    const apiUrl = assertLoopbackApiUrl(apiInput.value.trim() || DEFAULT_API_URL);
    apiInput.value = apiUrl;
    await saveVideodlCookieSettings({ videodlCookieApiUrl: apiUrl });
    return apiUrl;
  }

  async function onAutoSyncChange(enabled) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (enabled) {
        const granted = await requestCookiesPermission();
        if (!granted) {
          setCossSwitchChecked(autoSyncControl, false);
          showToast("Cookie access is required for auto-sync.", true);
          return;
        }
        await persistApiUrl();
      }
      await saveVideodlCookieSettings({ videodlCookieAutoSync: enabled });
      await sendBackgroundMessage({
        type: "dtp-videodl-cookies-alarm-sync",
      });
      showToast(enabled ? "Auto-sync on" : "Auto-sync off");
    } catch (error) {
      setCossSwitchChecked(autoSyncControl, !enabled);
      showToast(error?.message || "Could not update auto-sync.", true);
    } finally {
      setBusy(false);
    }
  }

  syncBtn.addEventListener("click", async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const granted = await requestCookiesPermission();
      if (!granted) {
        showToast("Cookie access was not granted.", true);
        return;
      }
      await persistApiUrl();
      const result = await sendBackgroundMessage({
        type: "dtp-videodl-cookies-sync",
      });
      renderSyncState(result);
      await refreshStatus();
      if (result?.signedIn === false) {
        showToast("Synced, but no YouTube login cookies were found.", true);
      } else {
        showToast("Cookies synced to VideoDL");
      }
    } catch (error) {
      const state = await getVideodlCookieSyncState();
      renderSyncState(state);
      showToast(error?.message || "Cookie sync failed.", true);
    } finally {
      setBusy(false);
    }
  });

  saveUrlBtn.addEventListener("click", async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await persistApiUrl();
      showToast("Saved");
      await refreshStatus();
    } catch (error) {
      showToast(error?.message || "Could not save API URL.", true);
    } finally {
      setBusy(false);
    }
  });

  refreshBtn.addEventListener("click", () => {
    refreshStatus();
  });

  getVideodlCookieSettings().then(async (settings) => {
    if (disposed) {
      return;
    }
    apiInput.value = settings.videodlCookieApiUrl;
    setCossSwitchChecked(autoSyncControl, settings.videodlCookieAutoSync);
    await refreshStatus();
  });

  return () => {
    disposed = true;
  };
}
