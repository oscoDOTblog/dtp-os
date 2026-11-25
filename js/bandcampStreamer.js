import {
  BANDCAMP_STREAMER_ACCENTS,
  BANDCAMP_STREAMER_DEFAULT_PREFS,
  getBandcampStreamerEnabled,
  getBandcampStreamerPrefs,
  setBandcampStreamerEnabled,
  setBandcampStreamerPrefs,
} from "./lib/bandcampStreamerSettings.js";

// Valid `event.code` values for hotkey remapping (from upstream options.js).
const KEYBOARD_EVENT_CODES = [
  "Backspace", "Tab", "Enter", "ShiftLeft", "ShiftRight", "ControlLeft",
  "ControlRight", "AltLeft", "AltRight", "Pause", "CapsLock", "Escape",
  "Space", "PageUp", "PageDown", "End", "Home", "ArrowLeft", "ArrowUp",
  "ArrowRight", "ArrowDown", "PrintScreen", "Insert", "Delete",
  "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",
  "Digit7", "Digit8", "Digit9", "KeyA", "KeyB", "KeyC", "KeyD", "KeyE",
  "KeyF", "KeyG", "KeyH", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyM", "KeyN",
  "KeyO", "KeyP", "KeyQ", "KeyR", "KeyS", "KeyT", "KeyU", "KeyV", "KeyW",
  "KeyX", "KeyY", "KeyZ", "MetaLeft", "MetaRight", "ContextMenu",
  "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5",
  "Numpad6", "Numpad7", "Numpad8", "Numpad9", "NumpadMultiply",
  "NumpadAdd", "NumpadSubtract", "NumpadDecimal", "NumpadDivide",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11",
  "F12", "NumLock", "ScrollLock", "Semicolon", "Equal", "Comma",
  "Minus", "Period", "Slash", "Backquote", "BracketLeft", "Backslash",
  "BracketRight", "Quote",
];

const HOTKEY_FIELDS = [
  { id: "playpause", label: "Play/Pause" },
  { id: "previous", label: "Previous track" },
  { id: "next", label: "Next track" },
  { id: "seekback", label: "Seek back" },
  { id: "seekforward", label: "Seek forward" },
];

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

export function mountBandcampStreamerTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Continuous streaming from Bandcamp fan feeds, collections, wishlists, and artist pages. Refresh open Bandcamp tabs after toggling.";

  const enableRow = document.createElement("label");
  enableRow.className = "branding-enable-row";

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.id = "bandcamp-streamer-enabled";

  const enableLabel = document.createElement("span");
  enableLabel.textContent = "Stream from Bandcamp pages";

  enableRow.append(enableInput, enableLabel);

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc bandcamp-streamer-status";

  const themeRow = document.createElement("label");
  themeRow.className = "branding-enable-row";

  const themeInput = document.createElement("input");
  themeInput.type = "checkbox";
  themeInput.id = "bandcamp-streamer-theme-light";

  const themeLabel = document.createElement("span");
  themeLabel.textContent = "Light player theme (unchecked = dark)";

  themeRow.append(themeInput, themeLabel);

  const hotkeyHeading = document.createElement("h3");
  hotkeyHeading.className = "settings-section-heading";
  hotkeyHeading.textContent = "Hotkeys";

  const hotkeyHint = document.createElement("p");
  hotkeyHint.className = "tool-form-desc";
  hotkeyHint.textContent =
    "Key values must match JavaScript event.code names (e.g. Space, ArrowLeft, Comma). Takes effect on Bandcamp tabs after refresh.";

  const hotkeyForm = document.createElement("div");
  hotkeyForm.className = "bandcamp-streamer-hotkeys";

  const inputs = {};
  HOTKEY_FIELDS.forEach(({ id, label }) => {
    const row = document.createElement("label");
    row.className = "bandcamp-streamer-row";

    const span = document.createElement("span");
    span.textContent = label;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `bandcamp-streamer-${id}`;
    input.autocomplete = "off";
    input.spellcheck = false;

    row.append(span, input);
    hotkeyForm.appendChild(row);
    inputs[id] = input;
  });

  const rateRow = document.createElement("label");
  rateRow.className = "bandcamp-streamer-row";

  const rateSpan = document.createElement("span");
  rateSpan.textContent = "Seek rate (seconds, 1-30)";

  const rateInput = document.createElement("input");
  rateInput.type = "number";
  rateInput.id = "bandcamp-streamer-seekrate";
  rateInput.min = "1";
  rateInput.max = "30";

  rateRow.append(rateSpan, rateInput);
  hotkeyForm.appendChild(rateRow);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "tool-btn";
  saveBtn.textContent = "Save hotkeys";

  const accentHeading = document.createElement("h3");
  accentHeading.className = "settings-section-heading";
  accentHeading.textContent = "Accent";

  const accentHint = document.createElement("p");
  accentHint.className = "tool-form-desc";
  accentHint.textContent =
    "Player bar accent, same tones as dtp-tunes. Takes effect on Bandcamp tabs after refresh.";

  const swatches = document.createElement("div");
  swatches.className = "bandcamp-streamer-swatches";

  let currentAccent = BANDCAMP_STREAMER_DEFAULT_PREFS.accent;
  const swatchBtns = {};

  function paintSwatches() {
    Object.entries(swatchBtns).forEach(([name, btn]) => {
      const active = name === currentAccent;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  Object.entries(BANDCAMP_STREAMER_ACCENTS).forEach(([name, hex]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bandcamp-streamer-swatch";
    btn.style.backgroundColor = hex;
    btn.title = name;
    btn.setAttribute("aria-label", `${name} accent`);
    btn.addEventListener("click", async () => {
      if (btn.disabled) {
        return;
      }
      btn.disabled = true;
      try {
        const prefs = await getBandcampStreamerPrefs();
        const saved = await setBandcampStreamerPrefs({ ...prefs, accent: name });
        currentAccent = saved.accent;
        paintSwatches();
        showToast("Accent saved. Refresh Bandcamp tabs to apply.");
      } catch (err) {
        showToast(err?.message || "Could not save accent.", true);
      } finally {
        btn.disabled = false;
      }
    });
    swatchBtns[name] = btn;
    swatches.appendChild(btn);
  });

  const links = document.createElement("p");
  links.className = "tool-form-desc";
  const feedLink = document.createElement("a");
  feedLink.href = "https://bandcamp.com/feed";
  feedLink.target = "_blank";
  feedLink.rel = "noopener noreferrer";
  feedLink.textContent = "Bandcamp feed";
  links.append(feedLink, document.createTextNode(" • Ported from bandcamp-streamer by A Flow of Code."));

  panel.append(desc, enableRow, statusEl, themeRow, hotkeyHeading, hotkeyHint, hotkeyForm, saveBtn, accentHeading, accentHint, swatches, links);
  container.appendChild(panel);

  let isSaving = false;

  function setStatus(enabled) {
    statusEl.textContent = enabled
      ? "Active — refresh open Bandcamp tabs for changes to apply."
      : "Disabled.";
  }

  async function applyEnabled(enabled) {
    isSaving = true;
    enableInput.disabled = true;

    try {
      await setBandcampStreamerEnabled(enabled);
      await syncBandcampStreamerInBackground(enabled);
      setStatus(enabled);
      showToast(enabled ? "Bandcamp Streamer enabled." : "Bandcamp Streamer disabled.");
    } catch (err) {
      enableInput.checked = !enabled;
      showToast(err?.message || "Could not save Bandcamp Streamer setting.", true);
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

  let isSavingTheme = false;

  themeInput.addEventListener("change", async () => {
    if (isSavingTheme) {
      return;
    }
    isSavingTheme = true;
    themeInput.disabled = true;

    try {
      const prefs = await getBandcampStreamerPrefs();
      const saved = await setBandcampStreamerPrefs({
        ...prefs,
        theme: themeInput.checked ? "light" : "dark",
      });
      themeInput.checked = saved.theme === "light";
      showToast("Player theme saved. Refresh Bandcamp tabs to apply.");
    } catch (err) {
      themeInput.checked = !themeInput.checked;
      showToast(err?.message || "Could not save player theme.", true);
    } finally {
      isSavingTheme = false;
      themeInput.disabled = false;
    }
  });

  function markInvalid(input) {
    input.classList.add("error");
    input.style.outline = "1px solid red";
  }

  function markValid(input) {
    input.classList.remove("error");
    input.style.outline = "initial";
  }

  saveBtn.addEventListener("click", async () => {
    let invalid = 0;

    HOTKEY_FIELDS.forEach(({ id }) => {
      const value = inputs[id].value.trim();
      if (KEYBOARD_EVENT_CODES.indexOf(value) === -1) {
        markInvalid(inputs[id]);
        invalid++;
      } else {
        markValid(inputs[id]);
      }
    });

    const rate = Number(rateInput.value);
    if (!Number.isFinite(rate) || rate < 1 || rate > 30) {
      markInvalid(rateInput);
      invalid++;
    } else {
      markValid(rateInput);
    }

    if (invalid > 0) {
      showToast("Fix the highlighted hotkey fields.", true);
      return;
    }

    const prefs = {
      seekrate: Math.round(rate),
      accent: currentAccent,
      theme: themeInput.checked ? "light" : "dark",
    };
    HOTKEY_FIELDS.forEach(({ id }) => {
      prefs[id] = inputs[id].value.trim();
    });

    saveBtn.disabled = true;
    try {
      const saved = await setBandcampStreamerPrefs(prefs);
      HOTKEY_FIELDS.forEach(({ id }) => {
        inputs[id].value = saved[id];
      });
      rateInput.value = String(saved.seekrate);
      currentAccent = saved.accent;
      paintSwatches();
      themeInput.checked = saved.theme === "light";
      showToast("Hotkeys saved. Refresh Bandcamp tabs to apply.");
    } catch (err) {
      showToast(err?.message || "Could not save hotkeys.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  getBandcampStreamerEnabled()
    .then((enabled) => {
      enableInput.checked = enabled;
      setStatus(enabled);
    })
    .catch(() => {
      enableInput.checked = false;
      setStatus(false);
    });

  getBandcampStreamerPrefs()
    .then((prefs) => {
      HOTKEY_FIELDS.forEach(({ id }) => {
        inputs[id].value = prefs[id] ?? BANDCAMP_STREAMER_DEFAULT_PREFS[id];
      });
      rateInput.value = String(prefs.seekrate);
      currentAccent = prefs.accent;
      paintSwatches();
      themeInput.checked = prefs.theme === "light";
    })
    .catch(() => {
      HOTKEY_FIELDS.forEach(({ id }) => {
        inputs[id].value = BANDCAMP_STREAMER_DEFAULT_PREFS[id];
      });
      rateInput.value = String(BANDCAMP_STREAMER_DEFAULT_PREFS.seekrate);
      paintSwatches();
    });

  return () => {};
}
