import { syncTwitchAdBlockRegistration } from "./js/lib/twitchAdBlockRegistration.js";
import { getTwitchAdBlockEnabled } from "./js/lib/twitchAdBlockSettings.js";
import { syncEmojiAutocompleteRegistration } from "./js/lib/emojiAutocompleteRegistration.js";
import { getEmojiAutocompleteEnabled } from "./js/lib/emojiAutocompleteSettings.js";
import { syncBandcampStreamerRegistration } from "./js/lib/bandcampStreamerRegistration.js";
import { getBandcampStreamerEnabled } from "./js/lib/bandcampStreamerSettings.js";
import {
  COPY_SECTION_CSS_FILE,
  COPY_SECTION_ENGINE_FILE,
  COPY_SECTION_MENU_MODES,
  syncCopySectionRegistration,
} from "./js/lib/copySectionRegistration.js";
import {
  getCopySectionEnabled,
  getCopySectionFormat,
} from "./js/lib/copySectionSettings.js";
import { ALARM_NAME, SETTINGS_KEY } from "./js/lib/videodlCookieSettings.js";
import {
  syncVideodlCookieAlarm,
  syncVideodlCookies,
} from "./js/lib/videodlCookieSync.js";

const FORM_INJECT_ENGINE_FILE = "js/inject/formInjectEngine.global.js";

async function syncTwitchAdBlockFromStorage() {
  const enabled = await getTwitchAdBlockEnabled();
  await syncTwitchAdBlockRegistration(enabled);
}

async function syncEmojiAutocompleteFromStorage() {
  const enabled = await getEmojiAutocompleteEnabled();
  await syncEmojiAutocompleteRegistration(enabled);
}

async function syncBandcampStreamerFromStorage() {
  const enabled = await getBandcampStreamerEnabled();
  await syncBandcampStreamerRegistration(enabled);
}

async function syncCopySectionFromStorage() {
  const enabled = await getCopySectionEnabled();
  await syncCopySectionRegistration(enabled);
}

async function syncAllContentScriptsFromStorage() {
  await Promise.all([
    syncTwitchAdBlockFromStorage(),
    syncEmojiAutocompleteFromStorage(),
    syncCopySectionFromStorage(),
    syncBandcampStreamerFromStorage(),
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  syncAllContentScriptsFromStorage().catch((err) => {
    console.error("Content script install sync failed:", err);
  });
  syncVideodlCookieAlarm().catch((err) => {
    console.error("VideoDL cookie alarm install sync failed:", err);
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncAllContentScriptsFromStorage().catch((err) => {
    console.error("Content script startup sync failed:", err);
  });
  syncVideodlCookieAlarm().catch((err) => {
    console.error("VideoDL cookie alarm startup sync failed:", err);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.twitchAdBlockEnabled) {
    const enabled = changes.twitchAdBlockEnabled.newValue === true;
    syncTwitchAdBlockRegistration(enabled).catch((err) => {
      console.error("Twitch Ad Block storage sync failed:", err);
    });
  }

  if (changes.emojiAutocompleteEnabled) {
    const enabled = changes.emojiAutocompleteEnabled.newValue !== false;
    syncEmojiAutocompleteRegistration(enabled).catch((err) => {
      console.error("Emoji autocomplete storage sync failed:", err);
    });
  }

  if (changes.copySectionEnabled) {
    const enabled = changes.copySectionEnabled.newValue !== false;
    syncCopySectionRegistration(enabled).catch((err) => {
      console.error("Copy Section storage sync failed:", err);
    });
  }

  if (changes.bandcampStreamerEnabled) {
    const enabled = changes.bandcampStreamerEnabled.newValue === true;
    syncBandcampStreamerRegistration(enabled).catch((err) => {
      console.error("Bandcamp Streamer storage sync failed:", err);
    });
  }

  if (changes[SETTINGS_KEY]) {
    syncVideodlCookieAlarm().catch((err) => {
      console.error("VideoDL cookie alarm storage sync failed:", err);
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== ALARM_NAME) {
    return;
  }
  syncVideodlCookies({ requestPermission: false }).catch((err) => {
    console.error("VideoDL cookie auto-sync failed:", err?.message || err);
  });
});

async function runCopySectionInTab(tabId, frameId, mode) {
  const format = await getCopySectionFormat();
  const target =
    typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId };

  await chrome.scripting
    .insertCSS({ target, files: [COPY_SECTION_CSS_FILE] })
    .catch(() => {});

  await chrome.scripting.executeScript({
    target,
    files: [COPY_SECTION_ENGINE_FILE],
  });

  await chrome.scripting.executeScript({
    target,
    func: (payload) => {
      const engine = globalThis.DtpCopySectionEngine;
      if (!engine) {
        throw new Error("Copy Section engine failed to load.");
      }
      return engine.run(payload);
    },
    args: [{ mode, format, copyInPage: true }],
  });
}

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  const mode = COPY_SECTION_MENU_MODES[info.menuItemId];
  if (!mode || !tab?.id) {
    return;
  }

  runCopySectionInTab(tab.id, info.frameId, mode).catch((err) => {
    console.error("Copy Section failed:", err);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "dtp-ping") {
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "dtp-twitch-adblock-sync") {
    (async () => {
      try {
        const enabled =
          typeof message.enabled === "boolean"
            ? message.enabled
            : await getTwitchAdBlockEnabled();
        await syncTwitchAdBlockRegistration(enabled);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
  }

  if (message?.type === "dtp-emoji-autocomplete-sync") {
    (async () => {
      try {
        const enabled =
          typeof message.enabled === "boolean"
            ? message.enabled
            : await getEmojiAutocompleteEnabled();
        await syncEmojiAutocompleteRegistration(enabled);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
  }

  if (message?.type === "dtp-bandcamp-streamer-sync") {
    (async () => {
      try {
        const enabled =
          typeof message.enabled === "boolean"
            ? message.enabled
            : await getBandcampStreamerEnabled();
        await syncBandcampStreamerRegistration(enabled);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
  }

  if (message?.type === "dtp-copy-section-sync") {
    (async () => {
      try {
        const enabled =
          typeof message.enabled === "boolean"
            ? message.enabled
            : await getCopySectionEnabled();
        await syncCopySectionRegistration(enabled);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
  }

  if (message?.type === "dtp-videodl-cookies-sync") {
    (async () => {
      try {
        const result = await syncVideodlCookies({ requestPermission: false });
        sendResponse({ ok: true, ...result });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
  }

  if (message?.type === "dtp-videodl-cookies-alarm-sync") {
    (async () => {
      try {
        await syncVideodlCookieAlarm();
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();

    return true;
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
