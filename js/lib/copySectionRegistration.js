import { syncRegisteredContentScript } from "./contentScriptRegistration.js";

const SCRIPT_ID = "dtp-copy-section";
const MATCHES = ["http://*/*", "https://*/*"];

export const COPY_SECTION_ENGINE_FILE = "js/inject/copySectionEngine.global.js";
export const COPY_SECTION_CSS_FILE = "css/copySection.css";

const PARENT_MENU_ID = "dtp-copy-section-parent";

export const COPY_SECTION_MENU_MODES = {
  "dtp-copy-section-here": "section",
  "dtp-copy-section-main": "main",
  "dtp-copy-section-page": "page",
};

const MENU_ITEMS = [
  { id: "dtp-copy-section-here", title: "Copy this section" },
  { id: "dtp-copy-section-main", title: "Copy main content" },
  { id: "dtp-copy-section-page", title: "Copy whole page" },
];

/** Serialize menu rebuild so concurrent syncs cannot race. */
let menuSyncChain = Promise.resolve();

function removeMenu(id) {
  return new Promise((resolve) => {
    chrome.contextMenus.remove(id, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function createMenu(properties) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(properties, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

async function syncContextMenusUnqueued(enabled) {
  if (!chrome.contextMenus?.create) {
    return;
  }

  await removeMenu(PARENT_MENU_ID);
  for (const item of MENU_ITEMS) {
    await removeMenu(item.id);
  }

  if (!enabled) {
    return;
  }

  await createMenu({
    id: PARENT_MENU_ID,
    title: "dtp-os",
    contexts: ["page", "selection", "link", "image"],
    documentUrlPatterns: MATCHES,
  });

  for (const item of MENU_ITEMS) {
    await createMenu({
      id: item.id,
      parentId: PARENT_MENU_ID,
      title: item.title,
      contexts: ["page", "selection", "link", "image"],
      documentUrlPatterns: MATCHES,
    });
  }
}

function syncContextMenus(enabled) {
  const run = () => syncContextMenusUnqueued(enabled);
  const result = menuSyncChain.then(run, run);
  menuSyncChain = result.catch(() => {});
  return result;
}

export async function syncCopySectionRegistration(enabled) {
  await syncRegisteredContentScript({
    id: SCRIPT_ID,
    enabled: Boolean(enabled),
    definition: {
      js: [COPY_SECTION_ENGINE_FILE],
      css: [COPY_SECTION_CSS_FILE],
      matches: MATCHES,
      runAt: "document_idle",
      world: "ISOLATED",
      allFrames: true,
      persistAcrossSessions: true,
    },
  });
  await syncContextMenus(enabled);
}
