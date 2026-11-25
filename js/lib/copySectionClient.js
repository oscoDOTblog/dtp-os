import {
  COPY_SECTION_CSS_FILE,
  COPY_SECTION_ENGINE_FILE,
} from "./copySectionRegistration.js";

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

/**
 * Runs the extractor in the active tab and returns the text without copying.
 * The popup writes to the clipboard itself, where user activation is reliable.
 */
export async function extractFromActiveTab({ mode, format }) {
  if (!chrome.scripting?.executeScript) {
    throw new Error("chrome.scripting is not available in this context.");
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found. Focus the page tab, then try again.");
  }

  if (isBlockedTabUrl(tab.url)) {
    throw new Error("Copy Section cannot run on browser internal pages.");
  }

  await chrome.scripting
    .insertCSS({ target: { tabId: tab.id }, files: [COPY_SECTION_CSS_FILE] })
    .catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [COPY_SECTION_ENGINE_FILE],
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (payload) => {
      const engine = globalThis.DtpCopySectionEngine;
      if (!engine) {
        throw new Error("Copy Section engine failed to load.");
      }
      return engine.run(payload);
    },
    args: [{ mode, format, copyInPage: false }],
  });

  if (!results?.length) {
    throw new Error("Copy Section returned no result.");
  }

  if (results[0].error) {
    throw new Error(
      results[0].error.message || "Copy Section failed on this page."
    );
  }

  const result = results[0].result;
  if (!result?.ok) {
    throw new Error(result?.error || "Nothing to copy on this page.");
  }

  return result;
}
