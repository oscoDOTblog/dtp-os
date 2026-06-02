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

const backgroundLayer = document.getElementById("backgroundLayer");
const embedLayer = document.getElementById("embedLayer");
const controlsPanel = document.getElementById("controls");
const controlsToggle = document.getElementById("controlsToggle");
const fileInput = document.getElementById("fileInput");
const gallery = document.getElementById("gallery");
const galleryMeta = document.getElementById("galleryMeta");
const statusMessage = document.getElementById("statusMessage");
const modeWallpaperBtn = document.getElementById("modeWallpaper");
const modeEmbedBtn = document.getElementById("modeEmbed");
const shuffleBtn = document.getElementById("shuffleBtn");

let activeObjectUrl = null;
let currentWallpaperId = null;
const galleryObjectUrls = new Set();

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
  const show =
    mode === DISPLAY_MODES.WALLPAPER && wallpaperCount > 0;
  shuffleBtn.hidden = !show;
}

function applyMode(mode, wallpaperCount = 0) {
  const isWallpaper = mode === DISPLAY_MODES.WALLPAPER;

  embedLayer.classList.toggle("is-visible", !isWallpaper);
  backgroundLayer.setAttribute("aria-hidden", isWallpaper ? "false" : "true");

  modeWallpaperBtn.classList.toggle("is-active", isWallpaper);
  modeEmbedBtn.classList.toggle("is-active", !isWallpaper);
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
    await setBackgroundFromId(id);
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
  setStatus("Shuffled.");
}

function renderGallery(items) {
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
    setStatus(
      added === 1 ? "Wallpaper added." : `${added} wallpapers added.`
    );
  }

  fileInput.value = "";
}

function wireControls() {
  controlsToggle.addEventListener("click", () => {
    const isHidden = controlsPanel.hasAttribute("hidden");
    if (isHidden) {
      controlsPanel.removeAttribute("hidden");
      controlsToggle.setAttribute("aria-expanded", "true");
    } else {
      controlsPanel.setAttribute("hidden", "");
      controlsToggle.setAttribute("aria-expanded", "false");
    }
  });

  fileInput.addEventListener("change", () => {
    handleFilesSelected(fileInput.files);
  });

  modeWallpaperBtn.addEventListener("click", () => {
    handleModeChange(DISPLAY_MODES.WALLPAPER);
  });

  modeEmbedBtn.addEventListener("click", () => {
    handleModeChange(DISPLAY_MODES.EMBED);
  });

  shuffleBtn.addEventListener("click", () => {
    shuffleWallpaper().catch((error) => {
      setStatus(error.message || "Could not shuffle.", true);
    });
  });
}

async function init() {
  wireControls();
  const items = await refreshGallery();
  const mode = await getDisplayMode();
  applyMode(mode, items.length);
  await loadRandomWallpaperIfNeeded(mode);
}

init().catch((error) => {
  setStatus(error.message || "Failed to load wallpapers.", true);
});
