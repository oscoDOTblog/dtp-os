import {
  formatVendoredDate,
  TWITCH_AD_BLOCK_RELEASES_URL,
  VENDORED_DATE,
  VENDORED_VERSION,
} from "./lib/twitchAdBlockMeta.js";
import {
  getTwitchAdBlockEnabled,
  setTwitchAdBlockEnabled,
} from "./lib/twitchAdBlockSettings.js";
import { checkForVaftUpdate } from "./lib/twitchAdBlockUpdateClient.js";

function syncTwitchAdBlockInBackground(enabled) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "dtp-twitch-adblock-sync", enabled },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Could not sync Twitch Ad Block."));
          return;
        }

        resolve(response);
      }
    );
  });
}

export function mountTwitchAdBlockTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Blocks in-stream and overlay ads on Twitch using the vaft engine. Refresh open Twitch tabs after toggling. May conflict with 7TV, Purple AdBlock, or TTV-AB.";

  const enableRow = document.createElement("label");
  enableRow.className = "branding-enable-row";

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.id = "twitch-ad-block-enabled";

  const enableLabel = document.createElement("span");
  enableLabel.textContent = "Block Twitch ads";

  enableRow.append(enableInput, enableLabel);

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc twitch-ad-block-status";

  const updateStatusEl = document.createElement("p");
  updateStatusEl.className = "tool-form-desc twitch-ad-block-update-status";
  updateStatusEl.hidden = true;

  const footer = document.createElement("div");
  footer.className = "twitch-ad-block-footer";

  const versionEl = document.createElement("p");
  versionEl.className = "twitch-ad-block-meta";
  versionEl.textContent = `Engine: vaft ${VENDORED_VERSION}`;

  const updatedEl = document.createElement("p");
  updatedEl.className = "twitch-ad-block-meta";
  updatedEl.textContent = `Last updated: ${formatVendoredDate(VENDORED_DATE)}`;

  const upstreamLink = document.createElement("a");
  upstreamLink.className = "twitch-ad-block-link";
  upstreamLink.href = TWITCH_AD_BLOCK_RELEASES_URL;
  upstreamLink.target = "_blank";
  upstreamLink.rel = "noopener noreferrer";
  upstreamLink.textContent = "View releases";

  const checkBtn = document.createElement("button");
  checkBtn.type = "button";
  checkBtn.className = "tool-btn";
  checkBtn.textContent = "Check for updates";

  footer.append(versionEl, updatedEl, upstreamLink, checkBtn);

  const note = document.createElement("p");
  note.className = "tool-form-desc twitch-ad-block-note";
  note.textContent =
    "Ad blocking may violate Twitch ToS. Twitch Turbo is the official ad-free option.";

  panel.append(desc, enableRow, statusEl, updateStatusEl, footer, note);
  container.appendChild(panel);

  let isSaving = false;
  let isChecking = false;

  function setStatus(enabled) {
    statusEl.textContent = enabled
      ? "Active — refresh open Twitch tabs for changes to apply."
      : "Disabled — refresh open Twitch tabs to fully stop blocking.";
  }

  async function applyEnabled(enabled) {
    isSaving = true;
    enableInput.disabled = true;

    try {
      await setTwitchAdBlockEnabled(enabled);
      await syncTwitchAdBlockInBackground(enabled);
      setStatus(enabled);
      showToast(enabled ? "Twitch Ad Block enabled." : "Twitch Ad Block disabled.");
    } catch (err) {
      enableInput.checked = !enabled;
      showToast(err?.message || "Could not save Twitch Ad Block setting.", true);
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

  checkBtn.addEventListener("click", async () => {
    if (isChecking) {
      return;
    }

    isChecking = true;
    checkBtn.disabled = true;
    checkBtn.textContent = "Checking…";
    updateStatusEl.hidden = true;
    updateStatusEl.textContent = "";

    try {
      const result = await checkForVaftUpdate();

      if (result.isNewer) {
        updateStatusEl.hidden = false;
        updateStatusEl.innerHTML = `Update available: <a class="twitch-ad-block-link" href="${result.releaseUrl}" target="_blank" rel="noopener noreferrer">${result.latest}</a>. Re-vendor vaft and reload the extension.`;
        showToast(`Update available: ${result.latest}`);
        return;
      }

      showToast(`You're on the latest (${result.current}).`);
    } catch (err) {
      showToast(err?.message || "Could not check for updates.", true);
    } finally {
      isChecking = false;
      checkBtn.disabled = false;
      checkBtn.textContent = "Check for updates";
    }
  });

  getTwitchAdBlockEnabled()
    .then((enabled) => {
      enableInput.checked = enabled;
      setStatus(enabled);
    })
    .catch(() => {
      enableInput.checked = false;
      setStatus(false);
    });

  return () => {};
}
