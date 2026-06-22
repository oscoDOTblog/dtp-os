const STORAGE_KEY = "currencyConverterLastSet";

const DEFAULTS = {
  amount: "1",
  from: "USD",
  to: "EUR",
};

export function getLastConversionSet() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULTS }, (items) => {
      const saved = items[STORAGE_KEY] ?? DEFAULTS;
      resolve({
        amount: String(saved.amount ?? DEFAULTS.amount),
        from: saved.from ?? DEFAULTS.from,
        to: saved.to ?? DEFAULTS.to,
      });
    });
  });
}

export function saveLastConversionSet({ amount, from, to }) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: {
          amount: String(amount),
          from,
          to,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      }
    );
  });
}
