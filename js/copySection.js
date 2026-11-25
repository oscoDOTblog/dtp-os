import { extractFromActiveTab } from "./lib/copySectionClient.js";
import { createCossButton } from "./lib/cossButton.js";
import { createCossField, createCossFieldLabel } from "./lib/cossField.js";
import { createCossToggleGroup } from "./lib/cossToggleGroup.js";
import {
  COPY_SECTION_FORMAT_OPTIONS,
  DEFAULT_COPY_SECTION_FORMAT,
  getCopySectionFormat,
  setCopySectionFormat,
} from "./lib/copySectionSettings.js";

const PREVIEW_LIMIT = 600;

const STRATEGY_LABELS = {
  semantic: "Matched a semantic content element",
  density: "Detected by text density",
  clicked: "Section under the last right-click",
  page: "Whole page",
};

export function mountCopySectionTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Grabs readable text from the active tab, skipping nav, sidebars, and footers. Pages also get a floating copy button and a dtp-os right-click menu.";

  const formatField = createCossField();
  const formatLabel = createCossFieldLabel({
    text: "Format",
    id: "copySectionFormatLabel",
  });
  const formatGroup = createCossToggleGroup({
    items: COPY_SECTION_FORMAT_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    value: DEFAULT_COPY_SECTION_FORMAT,
    ariaLabel: "Format",
    onChange: onFormatChange,
  });
  formatGroup.element.setAttribute("aria-labelledby", formatLabel.id);
  formatField.append(formatLabel, formatGroup.element);

  const actions = document.createElement("div");
  actions.className = "tool-actions-row";

  const mainBtn = createCossButton({
    text: "Copy main content",
    variant: "default",
    size: "sm",
  });

  const pageBtn = createCossButton({
    text: "Copy whole page",
    variant: "outline",
    size: "sm",
  });

  actions.append(mainBtn, pageBtn);

  const statusEl = document.createElement("p");
  statusEl.className = "tool-form-desc copy-section-status";
  statusEl.hidden = true;

  const preview = document.createElement("pre");
  preview.className = "tool-output copy-section-preview";
  preview.hidden = true;

  panel.append(desc, formatField, actions, statusEl, preview);
  container.appendChild(panel);

  let isRunning = false;

  function setBusy(busy) {
    isRunning = busy;
    mainBtn.disabled = busy;
    pageBtn.disabled = busy;
    formatGroup.setDisabled(busy);
  }

  function renderResult(result) {
    statusEl.hidden = false;
    const strategy = STRATEGY_LABELS[result.strategy] || "Detected content";
    statusEl.textContent = `${strategy} — ${result.chars.toLocaleString()} characters copied.`;

    preview.hidden = false;
    preview.textContent =
      result.text.length > PREVIEW_LIMIT
        ? `${result.text.slice(0, PREVIEW_LIMIT)}…`
        : result.text;
  }

  async function copy(mode) {
    if (isRunning) {
      return;
    }

    setBusy(true);
    statusEl.hidden = true;
    preview.hidden = true;

    try {
      const result = await extractFromActiveTab({
        mode,
        format: formatGroup.getValue(),
      });
      await navigator.clipboard.writeText(result.text);
      renderResult(result);
      showToast(`Copied ${result.chars.toLocaleString()} characters.`);
    } catch (err) {
      showToast(err?.message || "Could not copy from this page.", true);
    } finally {
      setBusy(false);
    }
  }

  // Hoisted: referenced by the toggle group above
  function onFormatChange(value) {
    setCopySectionFormat(value).catch(() => {
      showToast("Could not save the format preference.", true);
    });
  }

  function onMainClick() {
    copy("main");
  }

  function onPageClick() {
    copy("page");
  }

  mainBtn.addEventListener("click", onMainClick);
  pageBtn.addEventListener("click", onPageClick);

  getCopySectionFormat()
    .then((saved) => formatGroup.setValue(saved))
    .catch(() => formatGroup.setValue(DEFAULT_COPY_SECTION_FORMAT));

  return () => {
    mainBtn.removeEventListener("click", onMainClick);
    pageBtn.removeEventListener("click", onPageClick);
  };
}
