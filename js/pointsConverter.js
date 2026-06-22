import {
  estimateUsd,
  POINTS_PROGRAMS,
  VALUATIONS_SOURCE,
} from "./lib/pointsValuations.js";
import {
  getLastPointsSet,
  saveLastPointsSet,
} from "./lib/pointsConverterSettings.js";

const SAVE_DEBOUNCE_MS = 300;
const DEFAULT_PROGRAM_ID = "b6";

function formatUsd(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCpp(centsPerMile) {
  return centsPerMile.toFixed(2);
}

function populateProgramSelect(select, selectedId) {
  select.replaceChildren();

  for (const program of POINTS_PROGRAMS) {
    const option = document.createElement("option");
    option.value = program.id;
    option.textContent = `${program.label} (${formatCpp(program.centsPerMile)}¢)`;
    if (program.id === selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

export function mountPointsConverterTool(container) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel points-converter-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Estimate Capital One travel partner miles in rough USD using bundled planning benchmarks.";

  const milesLabel = document.createElement("label");
  milesLabel.className = "tool-label";
  milesLabel.htmlFor = "points-miles";
  milesLabel.textContent = "Miles";

  const milesInput = document.createElement("input");
  milesInput.id = "points-miles";
  milesInput.type = "number";
  milesInput.className = "tool-input";
  milesInput.min = "0";
  milesInput.step = "1";
  milesInput.value = "10000";
  milesInput.placeholder = "50000";

  const programLabel = document.createElement("label");
  programLabel.className = "tool-label";
  programLabel.htmlFor = "points-program";
  programLabel.textContent = "Program";

  const programSelect = document.createElement("select");
  programSelect.id = "points-program";
  programSelect.className = "tool-input currency-select";

  const resultWrap = document.createElement("div");
  resultWrap.className = "tool-outputs";
  resultWrap.hidden = true;

  const resultLabel = document.createElement("label");
  resultLabel.className = "tool-label";
  resultLabel.htmlFor = "points-result";
  resultLabel.textContent = "Estimated value";

  const resultOutput = document.createElement("div");
  resultOutput.id = "points-result";
  resultOutput.className = "tool-output currency-result";
  resultOutput.setAttribute("aria-live", "polite");

  const rateLine = document.createElement("p");
  rateLine.className = "currency-rate-date";

  const regionsLine = document.createElement("p");
  regionsLine.className = "points-converter-regions";

  resultWrap.appendChild(resultLabel);
  resultWrap.appendChild(resultOutput);
  resultWrap.appendChild(rateLine);
  resultWrap.appendChild(regionsLine);

  const disclaimer = document.createElement("p");
  disclaimer.className = "points-converter-note";
  disclaimer.textContent =
    "Rough planning estimate only. Actual redemption value varies by route, cabin, and fees.";

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  panel.appendChild(desc);
  panel.appendChild(milesLabel);
  panel.appendChild(milesInput);
  panel.appendChild(programLabel);
  panel.appendChild(programSelect);
  panel.appendChild(resultWrap);
  panel.appendChild(disclaimer);
  panel.appendChild(errorEl);
  container.appendChild(panel);

  let saveTimer = null;
  let disposed = false;

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    resultWrap.hidden = true;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function persistSettings() {
    const milesValue = milesInput.value.trim();
    const numericMiles = Number(milesValue);
    if (!milesValue || !Number.isFinite(numericMiles) || numericMiles <= 0) {
      return;
    }

    saveLastPointsSet({
      miles: milesValue,
      programId: programSelect.value,
    }).catch(() => {});
  }

  function schedulePersistSettings() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistSettings();
    }, SAVE_DEBOUNCE_MS);
  }

  function updateEstimate() {
    if (disposed) {
      return;
    }

    clearError();

    const milesValue = milesInput.value.trim();
    if (!milesValue) {
      resultWrap.hidden = true;
      showError("Enter a miles amount to estimate");
      return;
    }

    try {
      const result = estimateUsd(milesValue, programSelect.value);
      resultOutput.textContent = formatUsd(result.usd);
      rateLine.textContent = `Estimate @ ${formatCpp(result.centsPerMile)}¢ per mile · ${VALUATIONS_SOURCE}`;
      regionsLine.textContent = `Regions: ${result.regions}`;
      resultWrap.hidden = false;
      schedulePersistSettings();
    } catch (err) {
      resultWrap.hidden = true;
      showError(err.message);
    }
  }

  async function init() {
    const saved = await getLastPointsSet();
    if (disposed) {
      return;
    }

    const programIds = new Set(POINTS_PROGRAMS.map((program) => program.id));
    const programId = programIds.has(saved.programId)
      ? saved.programId
      : DEFAULT_PROGRAM_ID;

    populateProgramSelect(programSelect, programId);

    const numericMiles = Number(saved.miles);
    if (Number.isFinite(numericMiles) && numericMiles > 0) {
      milesInput.value = saved.miles;
    }

    updateEstimate();
  }

  milesInput.addEventListener("input", updateEstimate);
  programSelect.addEventListener("change", updateEstimate);

  milesInput.focus();
  init();

  return () => {
    disposed = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    milesInput.removeEventListener("input", updateEstimate);
    programSelect.removeEventListener("change", updateEstimate);
  };
}
