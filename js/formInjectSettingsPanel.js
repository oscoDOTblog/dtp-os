import { DEFAULT_FIELD_GROUPS } from "./lib/formInjectDefaults.js";
import {
  buildStarterDefaultsJson,
  getCustomDefaultsJson,
  getFillMode,
  saveCustomDefaultsJson,
  saveFillMode,
} from "./lib/formInjectSettings.js";

function createFormInjectHelpPanel(helpId) {
  const panel = document.createElement("div");
  panel.id = helpId;
  panel.className = "settings-help-panel";
  panel.hidden = true;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Form Inject field keys");

  const intro = document.createElement("p");
  intro.textContent =
    "Keys should match field name attributes on the page (e.g. firstName, lastName, address, city, zip). Use {timestamp} in email values for uniqueness.";

  panel.appendChild(intro);

  for (const group of DEFAULT_FIELD_GROUPS) {
    const heading = document.createElement("h3");
    heading.textContent = group.label;
    panel.appendChild(heading);

    const list = document.createElement("ul");
    for (const key of group.keys) {
      const item = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = key;
      item.appendChild(code);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  return panel;
}

function wireHelpToggle(helpBtn, helpPanel) {
  function toggleHelp() {
    const open = helpPanel.hidden;
    helpPanel.hidden = !open;
    helpBtn.setAttribute("aria-expanded", String(open));
    helpBtn.setAttribute("aria-label", open ? "Hide field key help" : "Show field key help");
  }

  helpBtn.addEventListener("click", toggleHelp);
  return () => {
    helpBtn.removeEventListener("click", toggleHelp);
  };
}

export function createFormInjectSettingsPanel({ setStatus, ids }) {
  const panel = document.createElement("div");
  panel.className = "settings-section-panel";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Mock values used when filling forms from the Form Inject tool. Site presets (e.g. Wendy intake) apply in Auto mode.";

  const modeRow = document.createElement("div");
  modeRow.className = "tool-format-row form-inject-settings-mode";

  const modeLabel = document.createElement("span");
  modeLabel.className = "tool-format-label";
  modeLabel.textContent = "Fill mode";

  const autoModeBtn = document.createElement("button");
  autoModeBtn.type = "button";
  autoModeBtn.className = "tool-format-btn tool-format-btn-active";
  autoModeBtn.textContent = "Auto";

  const genericModeBtn = document.createElement("button");
  genericModeBtn.type = "button";
  genericModeBtn.className = "tool-format-btn";
  genericModeBtn.textContent = "Generic only";

  modeRow.append(modeLabel, autoModeBtn, genericModeBtn);

  const defaultsLabelRow = document.createElement("div");
  defaultsLabelRow.className = "field-label-row";

  const defaultsLabel = document.createElement("label");
  defaultsLabel.className = "field-label";
  defaultsLabel.htmlFor = ids.defaults;
  defaultsLabel.textContent = "Custom defaults (JSON)";

  const helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className = "settings-help-toggle";
  helpBtn.setAttribute("aria-expanded", "false");
  helpBtn.setAttribute("aria-controls", ids.defaultsHelp);
  helpBtn.setAttribute("aria-label", "Show field key help");
  helpBtn.title = "Common field keys";
  helpBtn.textContent = "?";

  defaultsLabelRow.append(defaultsLabel, helpBtn);

  const helpPanel = createFormInjectHelpPanel(ids.defaultsHelp);

  const defaultsInput = document.createElement("textarea");
  defaultsInput.id = ids.defaults;
  defaultsInput.className = "field-textarea";
  defaultsInput.rows = 12;
  defaultsInput.spellcheck = false;

  const actionsRow = document.createElement("div");
  actionsRow.className = "tool-actions-row";

  const loadCommonBtn = document.createElement("button");
  loadCommonBtn.type = "button";
  loadCommonBtn.className = "tool-btn";
  loadCommonBtn.textContent = "Load common fields";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "field-save-btn";
  saveBtn.textContent = "Save Form Inject";

  actionsRow.append(loadCommonBtn, saveBtn);

  panel.append(hint, modeRow, defaultsLabelRow, helpPanel, defaultsInput, actionsRow);

  let fillMode = "auto";

  function setMode(nextMode) {
    fillMode = nextMode === "generic" ? "generic" : "auto";
    autoModeBtn.classList.toggle("tool-format-btn-active", fillMode === "auto");
    genericModeBtn.classList.toggle("tool-format-btn-active", fillMode === "generic");
  }

  function handleAutoMode() {
    setMode("auto");
  }

  function handleGenericMode() {
    setMode("generic");
  }

  function handleLoadCommon() {
    defaultsInput.value = buildStarterDefaultsJson();
  }

  async function handleSave() {
    try {
      await saveCustomDefaultsJson(defaultsInput.value);
      await saveFillMode(fillMode);
      setStatus("Form Inject settings saved.");
    } catch (error) {
      setStatus(error.message || "Could not save Form Inject settings.", true);
    }
  }

  async function loadFields() {
    const [customJson, mode] = await Promise.all([getCustomDefaultsJson(), getFillMode()]);
    defaultsInput.value = customJson || buildStarterDefaultsJson();
    setMode(mode);
  }

  autoModeBtn.addEventListener("click", handleAutoMode);
  genericModeBtn.addEventListener("click", handleGenericMode);
  loadCommonBtn.addEventListener("click", handleLoadCommon);
  saveBtn.addEventListener("click", handleSave);

  const removeHelpListener = wireHelpToggle(helpBtn, helpPanel);

  loadFields().catch((error) => {
    setStatus(error.message || "Could not load Form Inject settings.", true);
  });

  panel.cleanup = () => {
    autoModeBtn.removeEventListener("click", handleAutoMode);
    genericModeBtn.removeEventListener("click", handleGenericMode);
    loadCommonBtn.removeEventListener("click", handleLoadCommon);
    saveBtn.removeEventListener("click", handleSave);
    removeHelpListener();
  };

  return panel;
}

export function mountFormInjectSettingsPanel(container, { setStatus }) {
  const panel = createFormInjectSettingsPanel({
    ids: {
      defaults: "formInjectDefaults",
      defaultsHelp: "formInjectDefaultsHelp",
    },
    setStatus,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}
