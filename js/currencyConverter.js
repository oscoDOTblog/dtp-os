import { convert, fetchCurrencies } from "./lib/exchangeRateClient.js";
import {
  getLastConversionSet,
  saveLastConversionSet,
} from "./lib/currencyConverterSettings.js";

const DEBOUNCE_MS = 300;
const DEFAULT_FROM = "USD";
const DEFAULT_TO = "EUR";

function formatAmount(value, currencyCode) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function populateSelect(select, currencies, selectedCode) {
  select.replaceChildren();

  for (const { code, name } of currencies) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} — ${name}`;
    if (code === selectedCode) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

export function mountCurrencyConverterTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel currency-converter-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Convert amounts using live ECB exchange rates via Frankfurter.";

  const amountLabel = document.createElement("label");
  amountLabel.className = "tool-label";
  amountLabel.htmlFor = "currency-amount";
  amountLabel.textContent = "Amount";

  const amountInput = document.createElement("input");
  amountInput.id = "currency-amount";
  amountInput.type = "number";
  amountInput.className = "tool-input";
  amountInput.min = "0";
  amountInput.step = "any";
  amountInput.value = "1";
  amountInput.placeholder = "100";

  const currencyRow = document.createElement("div");
  currencyRow.className = "currency-converter-row";

  const fromWrap = document.createElement("div");
  fromWrap.className = "currency-converter-field";

  const fromLabel = document.createElement("label");
  fromLabel.className = "tool-label";
  fromLabel.htmlFor = "currency-from";
  fromLabel.textContent = "From";

  const fromSelect = document.createElement("select");
  fromSelect.id = "currency-from";
  fromSelect.className = "tool-input currency-select";

  const swapBtn = document.createElement("button");
  swapBtn.type = "button";
  swapBtn.className = "currency-swap-btn";
  swapBtn.title = "Swap currencies";
  swapBtn.setAttribute("aria-label", "Swap currencies");
  swapBtn.textContent = "⇄";

  const toWrap = document.createElement("div");
  toWrap.className = "currency-converter-field";

  const toLabel = document.createElement("label");
  toLabel.className = "tool-label";
  toLabel.htmlFor = "currency-to";
  toLabel.textContent = "To";

  const toSelect = document.createElement("select");
  toSelect.id = "currency-to";
  toSelect.className = "tool-input currency-select";

  fromWrap.appendChild(fromLabel);
  fromWrap.appendChild(fromSelect);
  toWrap.appendChild(toLabel);
  toWrap.appendChild(toSelect);
  currencyRow.appendChild(fromWrap);
  currencyRow.appendChild(swapBtn);
  currencyRow.appendChild(toWrap);

  const resultWrap = document.createElement("div");
  resultWrap.className = "tool-outputs";
  resultWrap.hidden = true;

  const resultLabel = document.createElement("label");
  resultLabel.className = "tool-label";
  resultLabel.htmlFor = "currency-result";
  resultLabel.textContent = "Converted";

  const resultOutput = document.createElement("div");
  resultOutput.id = "currency-result";
  resultOutput.className = "tool-output currency-result";
  resultOutput.setAttribute("aria-live", "polite");

  const rateDate = document.createElement("p");
  rateDate.className = "currency-rate-date";

  resultWrap.appendChild(resultLabel);
  resultWrap.appendChild(resultOutput);
  resultWrap.appendChild(rateDate);

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  const loadingEl = document.createElement("p");
  loadingEl.className = "currency-loading";
  loadingEl.hidden = true;
  loadingEl.textContent = "Fetching rates…";

  panel.appendChild(desc);
  panel.appendChild(amountLabel);
  panel.appendChild(amountInput);
  panel.appendChild(currencyRow);
  panel.appendChild(loadingEl);
  panel.appendChild(resultWrap);
  panel.appendChild(errorEl);
  container.appendChild(panel);

  let currencies = [];
  let debounceTimer = null;
  let saveTimer = null;
  let abortController = null;
  let disposed = false;

  function setControlsDisabled(disabled) {
    amountInput.disabled = disabled;
    fromSelect.disabled = disabled;
    toSelect.disabled = disabled;
    swapBtn.disabled = disabled;
    loadingEl.hidden = !disabled;
  }

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
    const amountValue = amountInput.value.trim();
    const numericAmount = Number(amountValue);
    if (!amountValue || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    saveLastConversionSet({
      amount: amountValue,
      from: fromSelect.value,
      to: toSelect.value,
    }).catch(() => {});
  }

  function schedulePersistSettings() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistSettings();
    }, DEBOUNCE_MS);
  }

  function persistSettingsNow() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persistSettings();
  }

  async function runConversion() {
    if (disposed) {
      return;
    }

    clearError();

    const amountValue = amountInput.value.trim();
    if (!amountValue) {
      resultWrap.hidden = true;
      showError("Enter an amount to convert");
      return;
    }

    const numericAmount = Number(amountValue);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      resultWrap.hidden = true;
      showError("Enter a valid amount greater than zero");
      return;
    }

    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    const { signal } = abortController;

    setControlsDisabled(true);

    try {
      const from = fromSelect.value;
      const to = toSelect.value;
      const result = await convert(numericAmount, from, to, signal);

      if (disposed || signal.aborted) {
        return;
      }

      const converted = result.rates[to];
      resultOutput.textContent = formatAmount(converted, to);
      rateDate.textContent = `Rate date: ${result.date}`;
      resultWrap.hidden = false;
      persistSettingsNow();
    } catch (err) {
      if (disposed || err.name === "AbortError") {
        return;
      }
      resultWrap.hidden = true;
      const message =
        err.message || "Failed to fetch exchange rates. Check your connection.";
      showError(message);
      showToast(message, true);
    } finally {
      if (!disposed && !abortController?.signal.aborted) {
        setControlsDisabled(false);
      }
    }
  }

  function scheduleConversion() {
    schedulePersistSettings();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runConversion();
    }, DEBOUNCE_MS);
  }

  function handleSwap() {
    const fromValue = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = fromValue;
    persistSettingsNow();
    scheduleConversion();
  }

  async function loadCurrencies() {
    setControlsDisabled(true);

    try {
      const [fetchedCurrencies, saved] = await Promise.all([
        fetchCurrencies(),
        getLastConversionSet(),
      ]);
      currencies = fetchedCurrencies;
      if (disposed) {
        return;
      }

      const codes = new Set(currencies.map((item) => item.code));
      const fromCode = codes.has(saved.from)
        ? saved.from
        : codes.has(DEFAULT_FROM)
          ? DEFAULT_FROM
          : currencies[0]?.code;
      const toCode = codes.has(saved.to)
        ? saved.to
        : codes.has(DEFAULT_TO)
          ? DEFAULT_TO
          : currencies[1]?.code;

      populateSelect(fromSelect, currencies, fromCode);
      populateSelect(toSelect, currencies, toCode);

      const numericAmount = Number(saved.amount);
      if (Number.isFinite(numericAmount) && numericAmount > 0) {
        amountInput.value = saved.amount;
      }

      await runConversion();
    } catch (err) {
      if (disposed) {
        return;
      }
      const message =
        err.message || "Failed to load currencies. Check your connection.";
      showError(message);
      showToast(message, true);
      setControlsDisabled(false);
    }
  }

  amountInput.addEventListener("input", scheduleConversion);
  fromSelect.addEventListener("change", scheduleConversion);
  toSelect.addEventListener("change", scheduleConversion);
  swapBtn.addEventListener("click", handleSwap);

  amountInput.focus();
  loadCurrencies();

  return () => {
    disposed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    if (abortController) {
      abortController.abort();
    }
    amountInput.removeEventListener("input", scheduleConversion);
    fromSelect.removeEventListener("change", scheduleConversion);
    toSelect.removeEventListener("change", scheduleConversion);
    swapBtn.removeEventListener("click", handleSwap);
  };
}
