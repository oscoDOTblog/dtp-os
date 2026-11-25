import { syncRegisteredContentScript } from "./contentScriptRegistration.js";

const SCRIPT_ID = "dtp-emoji-autocomplete";
const MATCHES = ["http://*/*", "https://*/*"];
const DATA_FILE = "js/emojiData.global.js";
const ENGINE_FILE = "js/inject/emojiAutocompleteEngine.global.js";
const CSS_FILE = "css/emojiAutocomplete.css";

export function syncEmojiAutocompleteRegistration(enabled) {
  return syncRegisteredContentScript({
    id: SCRIPT_ID,
    enabled: Boolean(enabled),
    definition: {
      js: [DATA_FILE, ENGINE_FILE],
      css: [CSS_FILE],
      matches: MATCHES,
      runAt: "document_idle",
      world: "ISOLATED",
      allFrames: false,
      persistAcrossSessions: true,
    },
  });
}
