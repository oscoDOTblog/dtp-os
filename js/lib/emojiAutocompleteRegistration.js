const SCRIPT_ID = "dtp-emoji-autocomplete";
const MATCHES = ["http://*/*", "https://*/*"];
const DATA_FILE = "js/emojiData.global.js";
const ENGINE_FILE = "js/inject/emojiAutocompleteEngine.global.js";
const CSS_FILE = "css/emojiAutocomplete.css";

export async function syncEmojiAutocompleteRegistration(enabled) {
  if (!chrome.scripting?.registerContentScripts) {
    throw new Error("chrome.scripting is unavailable.");
  }

  await chrome.scripting
    .unregisterContentScripts({ ids: [SCRIPT_ID] })
    .catch(() => {});

  if (!enabled) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: SCRIPT_ID,
      js: [DATA_FILE, ENGINE_FILE],
      css: [CSS_FILE],
      matches: MATCHES,
      runAt: "document_idle",
      world: "ISOLATED",
      allFrames: false,
      persistAcrossSessions: true,
    },
  ]);
}
