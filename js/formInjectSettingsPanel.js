import { DEFAULT_FIELD_GROUPS } from "./lib/formInjectDefaults.js";
import {
  createCossButton,
  setCossButtonPressed,
} from "./lib/cossButton.js";
import {
  buildStarterDefaultsJson,
  createFormInjectProfile,
  deleteFormInjectProfile,
  getFillMode,
  getProfilesState,
  renameFormInjectProfile,
  saveFillMode,
  saveProfileDefaultsJson,
  setActiveProfileId,
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
    "Keys should match field name attributes on the page (e.g. firstName, lastName, address, city, zip). Use {timestamp} in email values for uniqueness. Free-text keys (subject, message, question, reason, …) are not filled unless you add them to the active profile.";

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

function promptProfileName(title, initialValue) {
  const result = window.prompt(title, initialValue);
  if (result === null) {
    return null;
  }
  const trimmed = result.trim();
  if (!trimmed) {
    throw new Error("Profile name cannot be empty.");
  }
  return trimmed;
}

export function createFormInjectSettingsPanel({ setStatus, ids }) {
  const panel = document.createElement("div");
  panel.className = "settings-section-panel";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Mock value profiles for Form Inject. Auto fills only known profile/default/preset fields and leaves unknowns blank. Generic only invents values for recognized types (email, phone, name) — free-text questions stay empty unless your profile defines them. Site presets (e.g. Wendy intake) still apply in Auto mode.";

  const profileLabel = document.createElement("label");
  profileLabel.className = "field-label";
  profileLabel.htmlFor = ids.profileSelect;
  profileLabel.textContent = "Profile";

  const profileShell = document.createElement("div");
  profileShell.className = "form-inject-profile-shell";

  const profileRow = document.createElement("div");
  profileRow.className = "form-inject-profile-row";

  const profileSelect = document.createElement("select");
  profileSelect.id = ids.profileSelect;
  profileSelect.className = "field-input form-inject-profile-select";

  const profileActions = document.createElement("div");
  profileActions.className = "form-inject-profile-actions";

  const newBtn = createCossButton({
    text: "New",
    variant: "outline",
    size: "sm",
  });

  const renameBtn = createCossButton({
    text: "Rename",
    variant: "outline",
    size: "sm",
  });

  const deleteBtn = createCossButton({
    text: "Delete",
    variant: "destructive-outline",
    size: "sm",
  });

  const setActiveBtn = createCossButton({
    text: "Set active",
    variant: "default",
    size: "sm",
  });

  profileActions.append(newBtn, renameBtn, deleteBtn, setActiveBtn);
  profileRow.append(profileSelect, profileActions);

  const activeHint = document.createElement("p");
  activeHint.className = "form-inject-active-hint";

  profileShell.append(profileRow, activeHint);

  const modeRow = document.createElement("div");
  modeRow.className = "tool-format-row form-inject-settings-mode";

  const modeLabel = document.createElement("span");
  modeLabel.className = "tool-format-label";
  modeLabel.textContent = "Fill mode";

  const autoModeBtn = createCossButton({
    text: "Auto",
    variant: "outline",
    size: "sm",
  });

  const genericModeBtn = createCossButton({
    text: "Generic only",
    variant: "outline",
    size: "sm",
  });

  modeRow.append(modeLabel, autoModeBtn, genericModeBtn);

  const defaultsLabelRow = document.createElement("div");
  defaultsLabelRow.className = "field-label-row";

  const defaultsLabel = document.createElement("label");
  defaultsLabel.className = "field-label";
  defaultsLabel.htmlFor = ids.defaults;
  defaultsLabel.textContent = "Custom defaults (JSON)";

  const helpBtn = createCossButton({
    text: "?",
    variant: "ghost",
    size: "icon-xs",
    ariaLabel: "Show field key help",
  });
  helpBtn.setAttribute("aria-expanded", "false");
  helpBtn.setAttribute("aria-controls", ids.defaultsHelp);
  helpBtn.title = "Common field keys";

  defaultsLabelRow.append(defaultsLabel, helpBtn);

  const helpPanel = createFormInjectHelpPanel(ids.defaultsHelp);

  const defaultsInput = document.createElement("textarea");
  defaultsInput.id = ids.defaults;
  defaultsInput.className = "field-textarea";
  defaultsInput.rows = 12;
  defaultsInput.spellcheck = false;

  const actionsRow = document.createElement("div");
  actionsRow.className = "tool-actions-row";

  const loadCommonBtn = createCossButton({
    text: "Load common fields",
    variant: "outline",
    size: "sm",
  });

  const saveBtn = createCossButton({
    text: "Save Form Inject",
    variant: "default",
    size: "sm",
  });

  actionsRow.append(loadCommonBtn, saveBtn);

  panel.append(
    hint,
    profileLabel,
    profileShell,
    modeRow,
    defaultsLabelRow,
    helpPanel,
    defaultsInput,
    actionsRow
  );

  let fillMode = "auto";
  let profilesState = null;
  let selectedProfileId = null;
  let loadedDefaultsJson = "";

  function selectedProfile() {
    return (
      profilesState?.profiles.find((profile) => profile.id === selectedProfileId) ||
      null
    );
  }

  function isDirty() {
    return defaultsInput.value !== loadedDefaultsJson;
  }

  function confirmDiscardIfDirty() {
    if (!isDirty()) {
      return true;
    }
    return window.confirm("Discard unsaved changes to this profile?");
  }

  function updateActiveHint() {
    const active = profilesState?.profiles.find(
      (profile) => profile.id === profilesState.activeProfileId
    );
    const editing = selectedProfile();
    if (!active || !editing) {
      activeHint.textContent = "";
      return;
    }

    if (editing.id === active.id) {
      activeHint.textContent = `"${active.name}" is the active profile for fills.`;
      setActiveBtn.disabled = true;
    } else {
      activeHint.textContent = `Active for fills: "${active.name}". Editing "${editing.name}".`;
      setActiveBtn.disabled = false;
    }

    deleteBtn.disabled = (profilesState?.profiles.length || 0) <= 1;
  }

  function renderProfileOptions() {
    profileSelect.replaceChildren();
    for (const profile of profilesState?.profiles || []) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent =
        profile.id === profilesState.activeProfileId
          ? `${profile.name} (active)`
          : profile.name;
      profileSelect.appendChild(option);
    }
    profileSelect.value = selectedProfileId;
    updateActiveHint();
  }

  function loadSelectedProfileIntoEditor() {
    const profile = selectedProfile();
    const json = profile?.defaultsJson || "";
    loadedDefaultsJson = json || buildStarterDefaultsJson();
    defaultsInput.value = loadedDefaultsJson;
    // Empty stored JSON still shows starter in the editor; treat displayed value as clean.
    if (!json) {
      loadedDefaultsJson = defaultsInput.value;
    }
  }

  function setMode(nextMode) {
    fillMode = nextMode === "generic" ? "generic" : "auto";
    setCossButtonPressed(autoModeBtn, fillMode === "auto");
    setCossButtonPressed(genericModeBtn, fillMode === "generic");
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
      if (!selectedProfileId) {
        throw new Error("No profile selected.");
      }
      await saveProfileDefaultsJson(selectedProfileId, defaultsInput.value);
      await saveFillMode(fillMode);
      loadedDefaultsJson = defaultsInput.value;
      const profile = selectedProfile();
      setStatus(
        `Saved Form Inject profile "${profile?.name || "profile"}".`
      );
      await refreshState({ keepSelectedId: selectedProfileId });
    } catch (error) {
      setStatus(error.message || "Could not save Form Inject settings.", true);
    }
  }

  async function refreshState({ keepSelectedId } = {}) {
    profilesState = await getProfilesState();
    selectedProfileId =
      keepSelectedId &&
      profilesState.profiles.some((profile) => profile.id === keepSelectedId)
        ? keepSelectedId
        : profilesState.activeProfileId;
    renderProfileOptions();
    loadSelectedProfileIntoEditor();
  }

  async function handleProfileChange() {
    const nextId = profileSelect.value;
    if (nextId === selectedProfileId) {
      return;
    }
    if (!confirmDiscardIfDirty()) {
      profileSelect.value = selectedProfileId;
      return;
    }
    selectedProfileId = nextId;
    loadSelectedProfileIntoEditor();
    updateActiveHint();
  }

  async function handleNewProfile() {
    try {
      if (!confirmDiscardIfDirty()) {
        return;
      }
      const name = promptProfileName("New profile name", "New profile");
      if (name === null) {
        return;
      }
      const profile = await createFormInjectProfile({
        name,
        defaultsJson: defaultsInput.value.trim()
          ? defaultsInput.value
          : buildStarterDefaultsJson(),
        makeActive: false,
      });
      profilesState = await getProfilesState();
      selectedProfileId = profile.id;
      renderProfileOptions();
      loadSelectedProfileIntoEditor();
      setStatus(`Created profile "${profile.name}".`);
    } catch (error) {
      setStatus(error.message || "Could not create profile.", true);
    }
  }

  async function handleRenameProfile() {
    try {
      const profile = selectedProfile();
      if (!profile) {
        throw new Error("No profile selected.");
      }
      const name = promptProfileName("Rename profile", profile.name);
      if (name === null) {
        return;
      }
      const updated = await renameFormInjectProfile(profile.id, name);
      await refreshState({ keepSelectedId: updated.id });
      setStatus(`Renamed profile to "${updated.name}".`);
    } catch (error) {
      setStatus(error.message || "Could not rename profile.", true);
    }
  }

  async function handleDeleteProfile() {
    try {
      const profile = selectedProfile();
      if (!profile) {
        throw new Error("No profile selected.");
      }
      if ((profilesState?.profiles.length || 0) <= 1) {
        throw new Error("Keep at least one profile.");
      }
      if (
        !window.confirm(
          `Delete profile "${profile.name}"? This cannot be undone.`
        )
      ) {
        return;
      }
      await deleteFormInjectProfile(profile.id);
      await refreshState();
      setStatus(`Deleted profile "${profile.name}".`);
    } catch (error) {
      setStatus(error.message || "Could not delete profile.", true);
    }
  }

  async function handleSetActive() {
    try {
      if (!selectedProfileId) {
        throw new Error("No profile selected.");
      }
      if (isDirty()) {
        await saveProfileDefaultsJson(selectedProfileId, defaultsInput.value);
        loadedDefaultsJson = defaultsInput.value;
      }
      await setActiveProfileId(selectedProfileId);
      await refreshState({ keepSelectedId: selectedProfileId });
      const profile = selectedProfile();
      setStatus(`Active profile set to "${profile?.name || "profile"}".`);
    } catch (error) {
      setStatus(error.message || "Could not set active profile.", true);
    }
  }

  async function loadFields() {
    const mode = await getFillMode();
    setMode(mode);
    await refreshState();
  }

  autoModeBtn.addEventListener("click", handleAutoMode);
  genericModeBtn.addEventListener("click", handleGenericMode);
  loadCommonBtn.addEventListener("click", handleLoadCommon);
  saveBtn.addEventListener("click", handleSave);
  profileSelect.addEventListener("change", handleProfileChange);
  newBtn.addEventListener("click", handleNewProfile);
  renameBtn.addEventListener("click", handleRenameProfile);
  deleteBtn.addEventListener("click", handleDeleteProfile);
  setActiveBtn.addEventListener("click", handleSetActive);

  const removeHelpListener = wireHelpToggle(helpBtn, helpPanel);

  loadFields().catch((error) => {
    setStatus(error.message || "Could not load Form Inject settings.", true);
  });

  panel.cleanup = () => {
    autoModeBtn.removeEventListener("click", handleAutoMode);
    genericModeBtn.removeEventListener("click", handleGenericMode);
    loadCommonBtn.removeEventListener("click", handleLoadCommon);
    saveBtn.removeEventListener("click", handleSave);
    profileSelect.removeEventListener("change", handleProfileChange);
    newBtn.removeEventListener("click", handleNewProfile);
    renameBtn.removeEventListener("click", handleRenameProfile);
    deleteBtn.removeEventListener("click", handleDeleteProfile);
    setActiveBtn.removeEventListener("click", handleSetActive);
    removeHelpListener();
  };

  return panel;
}

export function mountFormInjectSettingsPanel(container, { setStatus }) {
  const panel = createFormInjectSettingsPanel({
    ids: {
      defaults: "formInjectDefaults",
      defaultsHelp: "formInjectDefaultsHelp",
      profileSelect: "formInjectProfileSelect",
    },
    setStatus,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}
