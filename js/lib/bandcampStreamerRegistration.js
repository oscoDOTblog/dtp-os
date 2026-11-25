import { syncRegisteredContentScript } from "./contentScriptRegistration.js";

const SCRIPT_ID = "dtp-bandcamp-streamer";
const MATCHES = ["*://*.bandcamp.com/*"];
const LOADER_FILE = "js/inject/bandcampLoader.global.js";
const CSS_FILE = "js/inject/bandcamp/bandcamp-streamer.css";

export function syncBandcampStreamerRegistration(enabled) {
  return syncRegisteredContentScript({
    id: SCRIPT_ID,
    enabled: Boolean(enabled),
    definition: {
      js: [LOADER_FILE],
      css: [CSS_FILE],
      matches: MATCHES,
      runAt: "document_idle",
      world: "ISOLATED",
      allFrames: false,
      persistAcrossSessions: true,
    },
  });
}
