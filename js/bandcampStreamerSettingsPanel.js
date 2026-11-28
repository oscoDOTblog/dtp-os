import {
  getBandcampStreamerEnabled,
  setBandcampStreamerEnabled,
  getBandcampStreamerPrefs,
  setBandcampStreamerPrefs,
} from "./lib/bandcampStreamerSettings.js";

function syncBandcampStreamerInBackground(enabled) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "dtp-bandcamp-streamer-sync", enabled },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Could not sync Bandcamp Streamer."));
          return;
        }

        resolve(response);
      }
    );
  });
}

/**
 * Settings panel for Bandcamp Streamer (enable toggle only;
 * hotkey remapping lives in the popup Bandcamp tool).
 * Works in popup Settings stack and new-tab settings sections.
 */
export function createBandcampStreamerSettingsPanel({
  ids = {},
  setStatus,
} = {}) {
  const enableId = ids.enabled || "bandcampStreamerEnabled";

  const panel = document.createElement("section");
  panel.className = "settings-section-panel";

  const heading = document.createElement("h3");
  heading.className = "settings-section-heading";
  heading.textContent = "Bandcamp Streamer";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Continuous streaming from Bandcamp feeds, collections, wishlists, and artist pages. Refresh open Bandcamp tabs after toggling. Hotkeys are remapped in the popup Bandcamp tool. The download button can be toggled below.";

  const enableRow = document.createElement("label");
  enableRow.className = "branding-enable-row";

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.id = enableId;
  enableInput.className = "branding-enable-input";

  const enableLabel = document.createElement("span");
  enableLabel.textContent = "Stream from Bandcamp pages";

  enableRow.append(enableInput, enableLabel);

  const downloadRow = document.createElement("label");
  downloadRow.className = "branding-enable-row";

  const downloadInput = document.createElement("input");
  downloadInput.type = "checkbox";
  downloadInput.id = ids.downloadButton || "bandcampStreamerDownloadButton";
  downloadInput.className = "branding-enable-input";

  const downloadLabel = document.createElement("span");
  downloadLabel.textContent = "Show download button (MP3 / album ZIP)";

  downloadRow.append(downloadInput, downloadLabel);

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc";

  panel.append(heading, hint, enableRow, downloadRow, statusEl);

  let isSaving = false;

  function setLocalStatus(enabled) {
    statusEl.textContent = enabled
      ? "Active — refresh open Bandcamp tabs for changes to apply."
      : "Disabled — Bandcamp pages are untouched.";
  }

  async function applyEnabled(enabled) {
    isSaving = true;
    enableInput.disabled = true;

    try {
      await setBandcampStreamerEnabled(enabled);
      await syncBandcampStreamerInBackground(enabled);
      setLocalStatus(enabled);
      setStatus?.(
        enabled ? "Bandcamp Streamer enabled." : "Bandcamp Streamer disabled."
      );
    } catch (err) {
      enableInput.checked = !enabled;
      setStatus?.(err?.message || "Could not save Bandcamp Streamer.", true);
    } finally {
      isSaving = false;
      enableInput.disabled = false;
    }
  }

  enableInput.addEventListener("change", () => {
    if (isSaving) {
      return;
    }
    applyEnabled(enableInput.checked);
  });

  let isSavingPrefs = false;

  downloadInput.addEventListener("change", async () => {
    if (isSavingPrefs) {
      downloadInput.checked = !downloadInput.checked;
      return;
    }
    isSavingPrefs = true;
    downloadInput.disabled = true;
    try {
      const prefs = await getBandcampStreamerPrefs();
      await setBandcampStreamerPrefs({
        ...prefs,
        downloadButton: downloadInput.checked,
      });
      setStatus?.(
        downloadInput.checked
          ? "Download button enabled — refresh open Bandcamp tabs."
          : "Download button hidden — refresh open Bandcamp tabs."
      );
    } catch (err) {
      downloadInput.checked = !downloadInput.checked;
      setStatus?.(
        err?.message || "Could not save Bandcamp Streamer settings.",
        true
      );
    } finally {
      isSavingPrefs = false;
      downloadInput.disabled = false;
    }
  });

  getBandcampStreamerEnabled()
    .then((enabled) => {
      enableInput.checked = enabled;
      setLocalStatus(enabled);
    })
    .catch(() => {
      enableInput.checked = false;
      setLocalStatus(false);
    });

  getBandcampStreamerPrefs()
    .then((prefs) => {
      downloadInput.checked = Boolean(prefs.downloadButton);
    })
    .catch(() => {
      downloadInput.checked = false;
    });

  panel.cleanup = () => {};

  return panel;
}

export function mountBandcampStreamerSettingsPanel(container, { setStatus }) {
  const panel = createBandcampStreamerSettingsPanel({
    ids: {
      enabled: "newtabBandcampStreamerEnabled",
      downloadButton: "newtabBandcampStreamerDownloadButton",
    },
    setStatus,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}
