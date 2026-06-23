import { parseCustomDefaultsJson } from "./lib/formInjectDefaults.js";
import {
  getCustomDefaultsJson,
  getFillMode,
  getMergedDefaults,
} from "./lib/formInjectSettings.js";
import { matchFormInjectPreset } from "./lib/formInjectPresets.js";
import { runFormInjectOnActiveTab } from "./lib/formInjectClient.js";

export function mountFormInjectTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Fill form fields on the active tab with mock data. Configure defaults in Settings. Does not submit.";

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

  panel.append(desc, actionRow, previewWrap, errorEl);
  container.appendChild(panel);

  function setError(message) {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function formatPreview(result, presetLabel) {
    const lines = [];
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

    return { result, preset, fillMode };
  }

  async function handleScan() {
    setError("");
    scanBtn.disabled = true;
    fillBtn.disabled = true;

    try {
      const { result, preset } = await buildPayload(true);
      preview.textContent = formatPreview(result, preset?.label);
      previewWrap.hidden = false;
      showToast(`Found ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err.message || "Scan failed.");
      showToast(err.message || "Scan failed.", true);
    } finally {
      scanBtn.disabled = false;
      fillBtn.disabled = false;
    }
  }

  async function handleFill() {
    setError("");
    scanBtn.disabled = true;
    fillBtn.disabled = true;

    try {
      const { result, preset, fillMode } = await buildPayload(false);
      preview.textContent = formatPreview(result, preset?.label);
      previewWrap.hidden = false;

      const suffix = preset
        ? ` (${preset.label})`
        : fillMode === "generic"
          ? " (generic)"
          : "";
      showToast(
        `Filled ${result.filledCount} field${result.filledCount === 1 ? "" : "s"}${suffix}`
      );
    } catch (err) {
      setError(err.message || "Fill failed.");
      showToast(err.message || "Fill failed.", true);
    } finally {
      scanBtn.disabled = false;
      fillBtn.disabled = false;
    }
  }

  scanBtn.addEventListener("click", handleScan);
  fillBtn.addEventListener("click", handleFill);

  return () => {
    scanBtn.removeEventListener("click", handleScan);
    fillBtn.removeEventListener("click", handleFill);
  };
}
