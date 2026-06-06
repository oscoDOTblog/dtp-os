import {
  DISPLAY_MODES,
  addWallpaper,
  getDisplayMode,
  getWallpaperBlob,
  listWallpapersForGallery,
  pickRandomWallpaperId,
  removeWallpaper,
  setDisplayMode,
  syncWallpaperOrderWithDatabase,
} from "./wallpapers.js";
import { getAppName, getActiveGreetings, getBrandingEnabled, pickRandomGreeting, DEFAULT_APP_NAME } from "./appSettings.js";
import { mountBrandingPanel } from "./settingsTool.js";
import { initNewtabSettings } from "./newtabSettings.js";

const backgroundLayer = document.getElementById("backgroundLayer");
const embedLayer = document.getElementById("embedLayer");
const appNameDisplay = document.getElementById("appNameDisplay");
const greetingMessage = document.getElementById("greetingMessage");
const greetingLayer = document.getElementById("greetingLayer");
const statusMessage = document.getElementById("statusMessage");
const shuffleBtn = document.getElementById("shuffleBtn");

let activeObjectUrl = null;
let currentWallpaperId = null;
let currentGreeting = "";
const galleryObjectUrls = new Set();

let modeWallpaperBtn = null;
let modeEmbedBtn = null;
let fileInput = null;
let gallery = null;
let galleryMeta = null;

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function revokeActiveObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function revokeGalleryUrls() {
  for (const url of galleryObjectUrls) {
    URL.revokeObjectURL(url);
  }
  galleryObjectUrls.clear();
}

async function setBackgroundFromId(id) {
  const blob = await getWallpaperBlob(id);
  if (!blob) {
    currentWallpaperId = null;
    return;
  }

  revokeActiveObjectUrl();
  activeObjectUrl = URL.createObjectURL(blob);
  backgroundLayer.style.backgroundImage = `url("${activeObjectUrl}")`;
  currentWallpaperId = id;
}

function updateShuffleButton(mode, wallpaperCount) {
  const show = mode === DISPLAY_MODES.WALLPAPER && wallpaperCount > 0;
  shuffleBtn.hidden = !show;
}

function applyMode(mode, wallpaperCount = 0) {
  const isWallpaper = mode === DISPLAY_MODES.WALLPAPER;

  embedLayer.classList.toggle("is-visible", !isWallpaper);
  backgroundLayer.setAttribute("aria-hidden", isWallpaper ? "false" : "true");

  if (modeWallpaperBtn && modeEmbedBtn) {
    modeWallpaperBtn.classList.toggle("is-active", isWallpaper);
    modeEmbedBtn.classList.toggle("is-active", !isWallpaper);
  }

  updateShuffleButton(mode, wallpaperCount);
}

async function loadRandomWallpaperIfNeeded(mode) {
  if (mode !== DISPLAY_MODES.WALLPAPER) {
    revokeActiveObjectUrl();
    backgroundLayer.style.backgroundImage = "";
    currentWallpaperId = null;
    return;
  }

  const id = await pickRandomWallpaperId(currentWallpaperId);
  if (id) {
    const previousId = currentWallpaperId;
    await setBackgroundFromId(id);
    if (id !== previousId) {
      await rotateGreeting();
    }
  } else {
    revokeActiveObjectUrl();
    backgroundLayer.style.backgroundImage = "";
    currentWallpaperId = null;
  }
}

async function shuffleWallpaper() {
  const mode = await getDisplayMode();
  if (mode !== DISPLAY_MODES.WALLPAPER) {
    return;
  }

  const id = await pickRandomWallpaperId(currentWallpaperId);
  if (!id) {
    setStatus("Upload a wallpaper first.", true);
    return;
  }

  await setBackgroundFromId(id);
  await rotateGreeting();
}

function renderGallery(items) {
  if (!gallery || !galleryMeta) {
    return;
  }

  revokeGalleryUrls();
  gallery.innerHTML = "";

  galleryMeta.textContent = `${items.length} saved · random on each new tab`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "gallery-empty";
    empty.textContent = "No wallpapers yet. Upload an image to get started.";
    gallery.appendChild(empty);
    return;
  }

  for (const item of items) {
    const thumbUrl = URL.createObjectURL(item.blob);
    galleryObjectUrls.add(thumbUrl);

    const wrapper = document.createElement("div");
    wrapper.className = "gallery-item";

    const img = document.createElement("img");
    img.src = thumbUrl;
    img.alt = "Saved wallpaper";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.title = "Delete wallpaper";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", async () => {
      try {
        await removeWallpaper(item.id);
        const items = await refreshGallery();
        const mode = await getDisplayMode();
        applyMode(mode, items.length);
        await loadRandomWallpaperIfNeeded(mode);
        setStatus("Wallpaper removed.");
      } catch (error) {
        setStatus(error.message || "Could not delete wallpaper.", true);
      }
    });

    wrapper.appendChild(img);
    wrapper.appendChild(deleteBtn);
    gallery.appendChild(wrapper);
  }
}

async function refreshGallery() {
  await syncWallpaperOrderWithDatabase();
  const items = await listWallpapersForGallery();
  renderGallery(items);
  return items;
}

async function handleModeChange(mode) {
  await setDisplayMode(mode);
  const items = await refreshGallery();
  applyMode(mode, items.length);
  await loadRandomWallpaperIfNeeded(mode);
  setStatus(
    mode === DISPLAY_MODES.WALLPAPER
      ? "Wallpaper mode — a random image loads on each new tab."
      : "Embedded site mode."
  );
}

async function handleFilesSelected(fileList) {
  const files = Array.from(fileList);
  if (files.length === 0) {
    return;
  }

  let added = 0;
  for (const file of files) {
    try {
      await addWallpaper(file);
      added += 1;
    } catch (error) {
      setStatus(error.message || "Upload failed.", true);
    }
  }

  const items = await refreshGallery();
  const mode = await getDisplayMode();
  applyMode(mode, items.length);

  if (added > 0) {
    if (mode === DISPLAY_MODES.WALLPAPER) {
      await loadRandomWallpaperIfNeeded(mode);
    }
    setStatus(added === 1 ? "Wallpaper added." : `${added} wallpapers added.`);
  }

  if (fileInput) {
    fileInput.value = "";
  }
}

function mountWallpaperPanel(container) {
  const panel = document.createElement("div");
  panel.className = "settings-section-panel";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Upload backgrounds and switch modes. In wallpaper mode, a random saved image appears each time you open a new tab. Use the shuffle button to change the background on this tab.";

  const modeToggle = document.createElement("div");
  modeToggle.className = "mode-toggle";
  modeToggle.setAttribute("role", "group");
  modeToggle.setAttribute("aria-label", "Display mode");

  modeWallpaperBtn = document.createElement("button");
  modeWallpaperBtn.type = "button";
  modeWallpaperBtn.id = "modeWallpaper";
  modeWallpaperBtn.textContent = "Wallpaper";

  modeEmbedBtn = document.createElement("button");
  modeEmbedBtn.type = "button";
  modeEmbedBtn.id = "modeEmbed";
  modeEmbedBtn.textContent = "Embedded site";

  modeToggle.append(modeWallpaperBtn, modeEmbedBtn);

  const uploadLabel = document.createElement("label");
  uploadLabel.className = "upload-label";
  uploadLabel.htmlFor = "fileInput";
  uploadLabel.textContent = "Upload images (JPEG, PNG, WebP)";

  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "fileInput";
  fileInput.accept = "image/jpeg,image/png,image/webp";
  fileInput.multiple = true;
  fileInput.hidden = true;

  galleryMeta = document.createElement("p");
  galleryMeta.id = "galleryMeta";
  galleryMeta.className = "gallery-meta";
  galleryMeta.textContent = "0 saved · random on each new tab";

  gallery = document.createElement("div");
  gallery.id = "gallery";

  panel.append(hint, modeToggle, uploadLabel, fileInput, galleryMeta, gallery);
  container.appendChild(panel);

  modeWallpaperBtn.addEventListener("click", () => {
    handleModeChange(DISPLAY_MODES.WALLPAPER);
  });

  modeEmbedBtn.addEventListener("click", () => {
    handleModeChange(DISPLAY_MODES.EMBED);
  });

  fileInput.addEventListener("change", () => {
    handleFilesSelected(fileInput.files);
  });

  getDisplayMode()
    .then((mode) => {
      applyMode(mode, 0);
      return refreshGallery();
    })
    .then((items) => getDisplayMode().then((mode) => applyMode(mode, items.length)))
    .catch(() => {});

  return () => {
    modeWallpaperBtn = null;
    modeEmbedBtn = null;
    fileInput = null;
    gallery = null;
    galleryMeta = null;
  };
}

function wireShuffleButton() {
  shuffleBtn.addEventListener("click", () => {
    shuffleWallpaper().catch((error) => {
      setStatus(error.message || "Could not shuffle.", true);
    });
  });
}

async function applyAppName() {
  const appName = await getAppName();
  document.title = appName;
  appNameDisplay.textContent = appName;

  if (chrome.action?.setTitle) {
    chrome.action.setTitle({ title: appName });
  }
}

function applyBrandingVisibility(enabled) {
  greetingLayer.hidden = !enabled;
}

async function rotateGreeting() {
  if (!(await getBrandingEnabled())) {
    return;
  }

  const greetings = await getActiveGreetings();
  const greeting = pickRandomGreeting(greetings, currentGreeting);
  currentGreeting = greeting;
  greetingMessage.textContent = greeting;
}

async function applyBranding() {
  const enabled = await getBrandingEnabled();
  applyBrandingVisibility(enabled);

  if (!enabled) {
    document.title = DEFAULT_APP_NAME;
    currentGreeting = "";
    greetingMessage.textContent = "";
    return;
  }

  await applyAppName();
  await rotateGreeting();
}

async function init() {
  wireShuffleButton();

  initNewtabSettings({
    toggleButton: document.getElementById("controlsToggle"),
    modal: document.getElementById("settingsModal"),
    listView: document.getElementById("settingsListView"),
    panelView: document.getElementById("settingsPanelView"),
    listContainer: document.getElementById("settingsList"),
    panelTitle: document.getElementById("settingsPanelTitle"),
    panelContent: document.getElementById("settingsPanelContent"),
    closeButton: document.getElementById("settingsCloseBtn"),
    backdrop: document.getElementById("settingsBackdrop"),
    sections: [
      {
        id: "branding",
        label: "Branding",
        description: "App name and greeting messages",
        mount: (container) =>
          mountBrandingPanel(container, {
            setStatus,
            onSaved: () => {
              applyBranding().catch(() => {});
            },
          }),
      },
      {
        id: "wallpapers",
        label: "Wallpapers",
        description: "Backgrounds and display mode",
        mount: (container) => mountWallpaperPanel(container),
      },
    ],
  });

  await syncWallpaperOrderWithDatabase();
  const items = await listWallpapersForGallery();
  const mode = await getDisplayMode();
  applyMode(mode, items.length);

  const brandingEnabled = await getBrandingEnabled();
  applyBrandingVisibility(brandingEnabled);
  if (brandingEnabled) {
    await applyAppName();
  } else {
    document.title = DEFAULT_APP_NAME;
  }

  await loadRandomWallpaperIfNeeded(mode);
  if (brandingEnabled && (mode !== DISPLAY_MODES.WALLPAPER || items.length === 0)) {
    await rotateGreeting();
  }
}

init().catch((error) => {
  setStatus(error.message || "Failed to load new tab.", true);
});
