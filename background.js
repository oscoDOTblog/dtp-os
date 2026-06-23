const FORM_INJECT_ENGINE_FILE = "js/inject/formInjectEngine.global.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "dtp-ping") {
    sendResponse({ ok: true });
    return;
  }

  if (message?.type !== "dtp-form-inject") {
    return;
  }

  const { tabId, options } = message;

  if (!tabId) {
    sendResponse({ ok: false, error: "Missing tab id." });
    return;
  }

  if (!chrome.scripting?.executeScript) {
    sendResponse({
      ok: false,
      error: "chrome.scripting is unavailable in the background worker.",
    });
    return;
  }

  (async () => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [FORM_INJECT_ENGINE_FILE],
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
        sendResponse({ ok: false, error: "Form Inject returned no result." });
        return;
      }

      if (results[0].error) {
        sendResponse({
          ok: false,
          error: results[0].error.message || "Form Inject failed on this page.",
        });
        return;
      }

      sendResponse({ ok: true, result: results[0].result });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err?.message || String(err),
      });
    }
  })();

  return true;
});

chrome.tabs.onCreated.addListener(function (tab) {
  if (!tab.url) {
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.url) {
        console.log("Updated tab URL:", changeInfo.url);
        if (changeInfo.url.startsWith("chrome://startpageshared/")) {
          chrome.tabs.update(tab.id, { url: "tab_override.html" });
        }
      }
    });
  }
});
