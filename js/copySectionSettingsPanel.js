import {
  createCossField,
  createCossFieldDescription,
  createCossFieldGroup,
  createCossFieldLabel,
  setCossFieldDisabled,
} from "./lib/cossField.js";
import {
  createCossSwitchField,
  setCossSwitchChecked,
} from "./lib/cossSwitch.js";
import { createCossToggleGroup } from "./lib/cossToggleGroup.js";
import {
  COPY_SECTION_CORNER_OPTIONS,
  COPY_SECTION_FORMAT_OPTIONS,
  DEFAULT_COPY_SECTION_CORNER,
  DEFAULT_COPY_SECTION_FORMAT,
  getCopySectionButtonCorner,
  getCopySectionButtonEnabled,
  getCopySectionEnabled,
  getCopySectionFormat,
  setCopySectionButtonCorner,
  setCopySectionButtonEnabled,
  setCopySectionEnabled,
  setCopySectionFormat,
} from "./lib/copySectionSettings.js";

/** Outlined frame with a filled dot in the corner the option represents. */
function cornerIcon(corner) {
  const [vertical, horizontal] = corner.split("-");
  const cx = horizontal === "left" ? 7.5 : 16.5;
  const cy = vertical === "top" ? 7.5 : 16.5;

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"/><circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/></svg>`;
}

// Visual order so the 2x2 grid matches the corners it selects
const CORNER_GRID_ORDER = ["top-left", "top-right", "bottom-left", "bottom-right"];

function cornerItems() {
  return CORNER_GRID_ORDER.map((corner) => {
    const option = COPY_SECTION_CORNER_OPTIONS.find(
      (candidate) => candidate.value === corner
    );
    return {
      value: corner,
      ariaLabel: option?.label || corner,
      iconHtml: cornerIcon(corner),
    };
  });
}

function syncCopySectionInBackground(enabled) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "dtp-copy-section-sync", enabled },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Could not sync Copy Section."));
          return;
        }

        resolve(response);
      }
    );
  });
}

/**
 * Settings panel for the in-page copy controls.
 * Works in the popup Settings stack and new-tab settings sections.
 */
export function createCopySectionSettingsPanel({ ids = {}, setStatus } = {}) {
  const enableId = ids.enabled || "copySectionEnabled";
  const buttonId = ids.button || "copySectionButtonEnabled";
  const formatId = ids.format || "copySectionSettingsFormat";
  const cornerId = ids.corner || "copySectionButtonCorner";

  const panel = document.createElement("section");
  panel.className = "settings-section-panel";

  const heading = document.createElement("h3");
  heading.className = "settings-section-heading";
  heading.textContent = "Copy Section";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Copies readable page text, skipping nav, sidebars, and footers.";

  const fields = createCossFieldGroup();

  const enableField = createCossSwitchField({
    id: enableId,
    label: "Enable on pages",
    description:
      "Adds the dtp-os right-click menu on http(s) pages. Refresh open tabs after toggling.",
    onChange: (checked) => applyEnabled(checked),
  });

  const buttonField = createCossSwitchField({
    id: buttonId,
    label: "Floating copy button",
    description: "A one-click button for main content, applied to open tabs immediately.",
    onChange: (checked) => {
      syncDependentControls();
      setCopySectionButtonEnabled(checked).catch(() => {
        setStatus?.("Could not save the floating button setting.", true);
      });
    },
  });

  const formatField = createCossField();
  const formatLabel = createCossFieldLabel({
    text: "Clipboard format",
    id: `${formatId}-label`,
  });
  const formatGroup = createCossToggleGroup({
    items: COPY_SECTION_FORMAT_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    value: DEFAULT_COPY_SECTION_FORMAT,
    ariaLabel: "Clipboard format",
    onChange: (value) => {
      setCopySectionFormat(value).catch(() => {
        setStatus?.("Could not save the Copy Section format.", true);
      });
    },
  });
  formatGroup.element.setAttribute("aria-labelledby", formatLabel.id);
  formatField.append(
    formatLabel,
    formatGroup.element,
    createCossFieldDescription({
      text: "Markdown keeps headings, lists, and links.",
    })
  );

  const cornerField = createCossField();
  const cornerLabel = createCossFieldLabel({
    text: "Button position",
    id: `${cornerId}-label`,
  });
  const cornerGroup = createCossToggleGroup({
    items: cornerItems(),
    value: DEFAULT_COPY_SECTION_CORNER,
    ariaLabel: "Button position",
    layout: "grid",
    onChange: (value) => {
      setCopySectionButtonCorner(value).catch(() => {
        setStatus?.("Could not save the button position.", true);
      });
    },
  });
  cornerGroup.element.setAttribute("aria-labelledby", cornerLabel.id);
  cornerField.append(
    cornerLabel,
    cornerGroup.element,
    createCossFieldDescription({
      text: "Move the button if it collides with a site's own widgets.",
    })
  );

  fields.append(
    enableField.field,
    buttonField.field,
    formatField,
    cornerField
  );

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc";

  panel.append(heading, hint, fields, statusEl);

  let isSaving = false;

  function isEnabled() {
    return enableField.control.getAttribute("aria-checked") === "true";
  }

  function isButtonEnabled() {
    return buttonField.control.getAttribute("aria-checked") === "true";
  }

  function setLocalStatus(enabled) {
    statusEl.textContent = enabled
      ? "Active — refresh open tabs for changes to apply."
      : "Disabled — the popup tool still works on the active tab.";
  }

  function syncDependentControls() {
    const enabled = isEnabled();
    buttonField.setDisabled(!enabled);

    const cornerAvailable = enabled && isButtonEnabled();
    cornerGroup.setDisabled(!cornerAvailable);
    setCossFieldDisabled(cornerField, !cornerAvailable);
  }

  async function applyEnabled(enabled) {
    if (isSaving) {
      return;
    }

    isSaving = true;
    enableField.setDisabled(true);

    try {
      await setCopySectionEnabled(enabled);
      await syncCopySectionInBackground(enabled);
      setLocalStatus(enabled);
      setStatus?.(enabled ? "Copy Section enabled." : "Copy Section disabled.");
    } catch (err) {
      setCossSwitchChecked(enableField.control, !enabled);
      setStatus?.(err?.message || "Could not save Copy Section.", true);
    } finally {
      isSaving = false;
      enableField.setDisabled(false);
      syncDependentControls();
    }
  }

  getCopySectionEnabled()
    .then((enabled) => {
      setCossSwitchChecked(enableField.control, enabled);
      setLocalStatus(enabled);
      syncDependentControls();
    })
    .catch(() => {
      setCossSwitchChecked(enableField.control, true);
      setLocalStatus(true);
      syncDependentControls();
    });

  getCopySectionButtonEnabled()
    .then((enabled) => {
      setCossSwitchChecked(buttonField.control, enabled);
      syncDependentControls();
    })
    .catch(() => {
      setCossSwitchChecked(buttonField.control, true);
      syncDependentControls();
    });

  getCopySectionFormat()
    .then((format) => formatGroup.setValue(format))
    .catch(() => formatGroup.setValue(DEFAULT_COPY_SECTION_FORMAT));

  getCopySectionButtonCorner()
    .then((corner) => cornerGroup.setValue(corner))
    .catch(() => cornerGroup.setValue(DEFAULT_COPY_SECTION_CORNER));

  panel.cleanup = () => {};

  return panel;
}

export function mountCopySectionSettingsPanel(container, { setStatus }) {
  const panel = createCopySectionSettingsPanel({
    ids: {
      enabled: "newtabCopySectionEnabled",
      button: "newtabCopySectionButton",
      format: "newtabCopySectionFormat",
      corner: "newtabCopySectionCorner",
    },
    setStatus,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}
