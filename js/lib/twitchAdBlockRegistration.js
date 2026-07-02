const SCRIPT_ID = "dtp-twitch-ad-block";
const TWITCH_MATCHES = ["*://*.twitch.tv/*"];
const ENGINE_FILE = "js/inject/twitchAdBlockEngine.global.js";

export async function syncTwitchAdBlockRegistration(enabled) {
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
      js: [ENGINE_FILE],
      matches: TWITCH_MATCHES,
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    },
  ]);
}
