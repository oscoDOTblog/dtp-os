const ENGINE_FILE = "js/inject/formInjectEngine.global.js";
const MESSAGE_TYPE = "dtp-form-inject";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

function isBlockedTabUrl(url) {
  if (!url) {
    return true;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

async function runViaScripting(tabId, options) {
  if (!chrome.scripting?.executeScript) {
    throw new Error("chrome.scripting is not available in this context.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [ENGINE_FILE],
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (payload) => {
      const engine = globalThis.DtpFormInjectEngine;
      if (!engine) {
        throw new Error("Form Inject engine failed to load.");
      }
      return engine.fillForms(payload);
    },
    args: [options],
  });

  if (!results?.length) {
    throw new Error("Form Inject returned no result.");
  }

  if (results[0].error) {
    throw new Error(results[0].error.message || "Form Inject failed on this page.");
  }

  return results[0].result;
}

async function runViaBackground(tabId, options) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPE,
      tabId,
      options,
    });
  } catch (err) {
    const message = err?.message || String(err);
    if (message.includes("Receiving end does not exist")) {
      throw new Error(
        "dtp-os background worker is not running. Open chrome://extensions and click Reload on dtp-os."
      );
    }
    throw new Error(message || "Form Inject could not reach the extension background.");
  }

  if (!response?.ok) {
    throw new Error(response?.error || "Form Inject failed.");
  }

  return response.result;
}

export async function runFormInjectOnActiveTab(options) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found. Focus the page tab, then try again.");
  }

  if (isBlockedTabUrl(tab.url)) {
    throw new Error("Form Inject cannot run on browser internal pages.");
  }

  let result;
  if (chrome.scripting?.executeScript) {
    result = await runViaScripting(tab.id, options);
  } else {
    result = await runViaBackground(tab.id, options);
  }

  return {
    tabUrl: tab.url || "",
    result,
  };
}
