import { syncRegisteredContentScript } from "./contentScriptRegistration.js";

const SCRIPT_ID = "dtp-twitch-ad-block";
const TWITCH_MATCHES = ["*://*.twitch.tv/*"];
const ENGINE_FILE = "js/inject/twitchAdBlockEngine.global.js";

export function syncTwitchAdBlockRegistration(enabled) {
  return syncRegisteredContentScript({
    id: SCRIPT_ID,
    enabled: Boolean(enabled),
    definition: {
      js: [ENGINE_FILE],
      matches: TWITCH_MATCHES,
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    },
  });
}
