import { parseCustomDefaultsJson } from "./lib/formInjectDefaults.js";
import {
  getCustomDefaultsJson,
  getFillMode,
  getMergedDefaults,
  listFormInjectProfiles,
  setActiveProfileId,
} from "./lib/formInjectSettings.js";
import { matchFormInjectPreset } from "./lib/formInjectPresets.js";
import { runFormInjectOnActiveTab } from "./lib/formInjectClient.js";

export function mountFormInjectTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Fill known form fields on the active tab from your mock profile. Unknown fields are left blank. Configure profiles in Settings. Does not submit.";

  const profileRow = document.createElement("div");
  profileRow.className = "form-inject-popup-profile-row";

  const profileLabel = document.createElement("label");
  profileLabel.className = "tool-label";
  profileLabel.htmlFor = "formInjectActiveProfile";
  profileLabel.textContent = "Profile";

  const profileSelect = document.createElement("select");
  profileSelect.id = "formInjectActiveProfile";
  profileSelect.className = "field-input form-inject-profile-select";

  profileRow.append(profileLabel, profileSelect);

  const actionRow = document.createElement("div");
  actionRow.className = "tool-actions-row";

  const scanBtn = document.createElement("button");
  scanBtn.type = "button";
  scanBtn.className = "tool-btn";
  scanBtn.textContent = "Scan";

  const fillBtn = document.createElement("button");
  fillBtn.type = "button";
  fillBtn.className = "tool-btn tool-btn-primary";
  fillBtn.textContent = "Fill form";

  actionRow.append(scanBtn, fillBtn);

  const previewWrap = document.createElement("div");
  previewWrap.className = "tool-outputs";
  previewWrap.hidden = true;

  const previewLabel = document.createElement("label");
  previewLabel.className = "tool-label";
  previewLabel.textContent = "Detected fields";

  const preview = document.createElement("pre");
  preview.className = "tool-output form-inject-preview";

  previewWrap.append(previewLabel, preview);

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  panel.append(desc, profileRow, actionRow, previewWrap, errorEl);
  container.appendChild(panel);

  let profilesList = { activeProfileId: "", profiles: [] };

  function setError(message) {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function renderProfileSelect() {
    profileSelect.replaceChildren();
    for (const profile of profilesList.profiles) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      profileSelect.appendChild(option);
    }
    profileSelect.value = profilesList.activeProfileId;
    profileSelect.disabled = profilesList.profiles.length === 0;
  }

  async function loadProfiles() {
    profilesList = await listFormInjectProfiles();
    renderProfileSelect();
  }

  function formatPreview(result, presetLabel, profileName) {
    const lines = [];
    if (profileName) {
      lines.push(`Profile: ${profileName}`);
    }
    if (presetLabel) {
      lines.push(`Preset: ${presetLabel}`);
    }
    lines.push(`Fields found: ${result.fieldCount}`);
    if (result.filledCount !== undefined && !result.scanOnly) {
      lines.push(`Filled: ${result.filledCount}`);
    }
    lines.push("");
    for (const field of result.fields || []) {
      const label = field.label ? ` (${field.label})` : "";
      const previewValue =
        field.previewValue !== undefined
          ? ` → ${field.previewValue}`
          : field.value !== undefined
            ? ` → ${field.value}`
            : "";
      lines.push(
        `${field.name || field.id || "(unnamed)"} [${field.tag}/${field.type}]${label}${previewValue}`
      );
    }
    return lines.join("\n");
  }

  async function buildPayload(scanOnly) {
    const customJson = await getCustomDefaultsJson();
    const parsed = parseCustomDefaultsJson(customJson);
    if (!parsed.ok) {
      throw new Error(
        `${parsed.error} Fix Form Inject defaults in Settings.`
      );
    }

    const fillMode = await getFillMode();
    const mergedDefaults = getMergedDefaults(parsed.value);
    const tab = await chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => tabs[0]);
    const preset =
      fillMode === "auto" && tab?.url ? matchFormInjectPreset(tab.url) : null;

    const { result } = await runFormInjectOnActiveTab({
      defaults: mergedDefaults,
      presetFields: preset?.fields ?? null,
      mode: fillMode,
      scanOnly,
    });

    const activeProfile = profilesList.profiles.find(
      (profile) => profile.id === profilesList.activeProfileId
    );

    return { result, preset, fillMode, profileName: activeProfile?.name };
  }

  async function handleProfileChange() {
    const nextId = profileSelect.value;
    if (!nextId || nextId === profilesList.activeProfileId) {
      return;
    }

    try {
      setError("");
      await setActiveProfileId(nextId);
      profilesList = await listFormInjectProfiles();
      renderProfileSelect();
      const active = profilesList.profiles.find(
        (profile) => profile.id === profilesList.activeProfileId
      );
      showToast(`Active profile: ${active?.name || "profile"}`);
    } catch (err) {
      profileSelect.value = profilesList.activeProfileId;
      setError(err.message || "Could not switch profile.");
      showToast(err.message || "Could not switch profile.", true);
    }
  }

  async function handleScan() {
    setError("");
    scanBtn.disabled = true;
    fillBtn.disabled = true;
    profileSelect.disabled = true;

    try {
      const { result, preset, profileName } = await buildPayload(true);
      preview.textContent = formatPreview(result, preset?.label, profileName);
      previewWrap.hidden = false;
      showToast(`Found ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err.message || "Scan failed.");
      showToast(err.message || "Scan failed.", true);
    } finally {
      scanBtn.disabled = false;
      fillBtn.disabled = false;
      profileSelect.disabled = profilesList.profiles.length === 0;
    }
  }

  async function handleFill() {
    setError("");
    scanBtn.disabled = true;
    fillBtn.disabled = true;
    profileSelect.disabled = true;

    try {
      const { result, preset, fillMode, profileName } = await buildPayload(false);
      preview.textContent = formatPreview(result, preset?.label, profileName);
      previewWrap.hidden = false;

      const parts = [];
      if (profileName) {
        parts.push(profileName);
      }
      if (preset) {
        parts.push(preset.label);
      } else if (fillMode === "generic") {
        parts.push("generic");
      }
      const suffix = parts.length ? ` (${parts.join(" · ")})` : "";
      showToast(
        `Filled ${result.filledCount} field${result.filledCount === 1 ? "" : "s"}${suffix}`
      );
    } catch (err) {
      setError(err.message || "Fill failed.");
      showToast(err.message || "Fill failed.", true);
    } finally {
      scanBtn.disabled = false;
      fillBtn.disabled = false;
      profileSelect.disabled = profilesList.profiles.length === 0;
    }
  }

  scanBtn.addEventListener("click", handleScan);
  fillBtn.addEventListener("click", handleFill);
  profileSelect.addEventListener("change", handleProfileChange);

  loadProfiles().catch((err) => {
    setError(err.message || "Could not load profiles.");
  });

  return () => {
    scanBtn.removeEventListener("click", handleScan);
    fillBtn.removeEventListener("click", handleFill);
    profileSelect.removeEventListener("change", handleProfileChange);
  };
}
