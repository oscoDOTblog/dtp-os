import {
  getEmojiAutocompleteEnabled,
  setEmojiAutocompleteEnabled,
} from "./lib/emojiAutocompleteSettings.js";

function syncEmojiAutocompleteInBackground(enabled) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "dtp-emoji-autocomplete-sync", enabled },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!response?.ok) {
          reject(
            new Error(response?.error || "Could not sync emoji autocomplete.")
          );
          return;
        }

        resolve(response);
      }
    );
  });
}

/**
 * Settings panel for page :query emoji autocomplete.
 * Works in popup Settings stack and new-tab settings sections.
 */
export function createEmojiAutocompleteSettingsPanel({
  ids = {},
  setStatus,
} = {}) {
  const enableId = ids.enabled || "emojiAutocompleteEnabled";

  const panel = document.createElement("section");
  panel.className = "settings-section-panel";

  const heading = document.createElement("h3");
  heading.className = "settings-section-heading";
  heading.textContent = "Emoji Autocomplete";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "On http(s) pages, typing :smile in text fields shows matching emoji suggestions. Refresh open tabs after toggling.";

  const enableRow = document.createElement("label");
  enableRow.className = "branding-enable-row";

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.id = enableId;
  enableInput.className = "branding-enable-input";

  const enableLabel = document.createElement("span");
  enableLabel.textContent =
    "Suggest emojis while typing :query in text fields";

  enableRow.append(enableInput, enableLabel);

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc";

  panel.append(heading, hint, enableRow, statusEl);

  let isSaving = false;

  function setLocalStatus(enabled) {
    statusEl.textContent = enabled
      ? "Active — refresh open tabs for changes to apply."
      : "Disabled — refresh open tabs to fully stop suggestions.";
  }

  async function applyEnabled(enabled) {
    isSaving = true;
    enableInput.disabled = true;

    try {
      await setEmojiAutocompleteEnabled(enabled);
      await syncEmojiAutocompleteInBackground(enabled);
      setLocalStatus(enabled);
      setStatus?.(
        enabled ? "Emoji autocomplete enabled." : "Emoji autocomplete disabled."
      );
    } catch (err) {
      enableInput.checked = !enabled;
      setStatus?.(err?.message || "Could not save emoji autocomplete.", true);
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

  getEmojiAutocompleteEnabled()
    .then((enabled) => {
      enableInput.checked = enabled;
      setLocalStatus(enabled);
    })
    .catch(() => {
      enableInput.checked = true;
      setLocalStatus(true);
    });

  panel.cleanup = () => {};

  return panel;
}

export function mountEmojiAutocompleteSettingsPanel(container, { setStatus }) {
  const panel = createEmojiAutocompleteSettingsPanel({
    ids: {
      enabled: "newtabEmojiAutocompleteEnabled",
    },
    setStatus,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}
