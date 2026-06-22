const STORAGE_KEY = "pointsConverterLastSet";

const DEFAULTS = {
  miles: "10000",
  programId: "b6",
};

export function getLastPointsSet() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULTS }, (items) => {
      const saved = items[STORAGE_KEY] ?? DEFAULTS;
      resolve({
        miles: String(saved.miles ?? DEFAULTS.miles),
        programId: saved.programId ?? DEFAULTS.programId,
      });
    });
  });
}

export function saveLastPointsSet({ miles, programId }) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: {
          miles: String(miles),
          programId,
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
