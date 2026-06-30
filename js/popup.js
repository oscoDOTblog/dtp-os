import { getAppName } from "./appSettings.js";
import { mountEmojisTool } from "./emojis.js";
import { mountYoutubePlaylistTool } from "./youtubePlaylist.js";
import { mountVideoDownloaderTool } from "./videoDownloader.js";
import { mountCloudflareDockerTool } from "./cloudflareDocker.js";
import { mountCurrencyConverterTool } from "./currencyConverter.js";
import { mountPointsConverterTool } from "./pointsConverter.js";
import { mountFormInjectTool } from "./formInject.js";
import { TOOLS } from "./toolSettings.js";
import { getToolIconPath } from "./toolIcons.js";
import {
  getToolFavorites,
  saveToolFavorites,
  sortToolsByFavorites,
  toggleToolFavorite,
} from "./lib/toolFavorites.js";

const TOOL_DEFINITIONS = [
  { id: TOOLS.CLOUDFLARE_DOCKER, label: "Cloudflare Docker", implemented: true },
  { id: TOOLS.COLORS, label: "Colors", implemented: false },
  { id: TOOLS.CURRENCY_CONVERTER, label: "Currency Converter", implemented: true },
  { id: TOOLS.EMOJIS, label: "Emojis", implemented: true },
  { id: TOOLS.FORM_INJECT, label: "Form Inject", implemented: true },
  { id: TOOLS.POINTS_CONVERTER, label: "Points Conversion", implemented: true },
  { id: TOOLS.VIDEO_DOWNLOADER, label: "Video Downloader", implemented: true },
  { id: TOOLS.YOUTUBE_PLAYLIST, label: "YouTube Playlist", implemented: true },
];

const toolListView = document.getElementById("toolListView");
const toolPanelView = document.getElementById("toolPanelView");
const toolList = document.getElementById("toolList");
const toolPanelTitle = document.getElementById("toolPanelTitle");
const toolPanelContent = document.getElementById("toolPanelContent");
const backButton = document.getElementById("backButton");
const toast = document.getElementById("toast");

let panelCleanup = null;
let favoriteIds = [];

const popupTitle = document.querySelector(".popup-title");

const TOOL_MOUNTERS = {
  [TOOLS.EMOJIS]: mountEmojisTool,
  [TOOLS.YOUTUBE_PLAYLIST]: mountYoutubePlaylistTool,
  [TOOLS.VIDEO_DOWNLOADER]: mountVideoDownloaderTool,
  [TOOLS.CLOUDFLARE_DOCKER]: mountCloudflareDockerTool,
  [TOOLS.CURRENCY_CONVERTER]: mountCurrencyConverterTool,
  [TOOLS.POINTS_CONVERTER]: mountPointsConverterTool,
  [TOOLS.FORM_INJECT]: mountFormInjectTool,
};

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
}

function hideToast() {
  toast.hidden = true;
  toast.classList.remove("is-error");
}

function runPanelCleanup() {
  if (panelCleanup) {
    panelCleanup();
    panelCleanup = null;
  }
}

function showToolList() {
  runPanelCleanup();
  toolPanelView.hidden = true;
  toolListView.hidden = false;
  hideToast();
}

function showToolPanel(toolId) {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === toolId);
  if (!tool) {
    return;
  }

  runPanelCleanup();
  toolListView.hidden = true;
  toolPanelView.hidden = false;
  toolPanelTitle.textContent = tool.label;
  toolPanelContent.replaceChildren();

  const mounter = TOOL_MOUNTERS[toolId];
  if (mounter) {
    panelCleanup = mounter(toolPanelContent, { showToast, hideToast });
    return;
  }

  const stub = document.createElement("p");
  stub.className = "stub-message";
  stub.textContent = "Coming soon";
  toolPanelContent.appendChild(stub);
}

function openTool(toolId) {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === toolId);
  if (!tool || !tool.implemented) {
    return;
  }
  showToolPanel(toolId);
}

function createFavoriteButton(tool) {
  const isFavorite = favoriteIds.includes(tool.id);

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = "tool-favorite-btn";
  favoriteBtn.classList.toggle("is-favorite", isFavorite);
  favoriteBtn.setAttribute(
    "aria-label",
    isFavorite ? `Unfavorite ${tool.label}` : `Favorite ${tool.label}`
  );
  favoriteBtn.setAttribute("aria-pressed", String(isFavorite));
  favoriteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9H22l-5.6 4.6 2.1 6.9L12 16.9 5.5 20.4l2.1-6.9L2 8.9h7.1z"/></svg>`;

  favoriteBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    favoriteIds = toggleToolFavorite(favoriteIds, tool.id);
    try {
      await saveToolFavorites(favoriteIds);
      renderToolList();
    } catch {
      showToast("Could not save favorite.", true);
    }
  });

  return favoriteBtn;
}

function renderToolList() {
  toolList.replaceChildren();

  const sortedTools = sortToolsByFavorites(TOOL_DEFINITIONS, favoriteIds);

  for (const tool of sortedTools) {
    const item = document.createElement("li");
    item.className = "tool-list-item";

    const row = document.createElement("div");
    row.className = "tool-list-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-button";
    button.disabled = !tool.implemented;

    const main = document.createElement("span");
    main.className = "tool-button-main";

    const icon = document.createElement("img");
    icon.className = "tool-button-icon";
    icon.src = getToolIconPath(tool.id);
    icon.alt = "";
    icon.width = 22;
    icon.height = 22;
    icon.decoding = "async";

    const label = document.createElement("span");
    label.className = "tool-button-label";
    label.textContent = tool.label;

    main.appendChild(icon);
    main.appendChild(label);
    button.appendChild(main);

    if (!tool.implemented) {
      const badge = document.createElement("span");
      badge.className = "tool-button-badge";
      badge.textContent = "Soon";
      button.appendChild(badge);
    } else {
      button.addEventListener("click", () => {
        openTool(tool.id);
      });
    }

    row.appendChild(button);
    row.appendChild(createFavoriteButton(tool));
    item.appendChild(row);
    toolList.appendChild(item);
  }
}

backButton.addEventListener("click", () => {
  showToolList();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !toolPanelView.hidden) {
    showToolList();
  }
});

async function applyAppName() {
  if (!popupTitle) {
    return;
  }
  popupTitle.textContent = await getAppName();
}

async function init() {
  const savedFavorites = await getToolFavorites();
  const validIds = new Set(TOOL_DEFINITIONS.map((tool) => tool.id));
  favoriteIds = savedFavorites.filter((id) => validIds.has(id));
  if (favoriteIds.length !== savedFavorites.length) {
    saveToolFavorites(favoriteIds).catch(() => {});
  }
  renderToolList();
  showToolList();
  applyAppName().catch(() => {});
}

init();
