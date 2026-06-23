import { getAppName } from "./appSettings.js";
import { mountEmojisTool } from "./emojis.js";
import { mountYoutubePlaylistTool } from "./youtubePlaylist.js";
import { mountVideoDownloaderTool } from "./videoDownloader.js";
import { mountCloudflareDockerTool } from "./cloudflareDocker.js";
import { mountCurrencyConverterTool } from "./currencyConverter.js";
import { mountPointsConverterTool } from "./pointsConverter.js";
import { mountSettingsTool } from "./settingsTool.js";
import { mountFormInjectTool } from "./formInject.js";
import { TOOLS } from "./toolSettings.js";

const TOOL_DEFINITIONS = [
  { id: TOOLS.SETTINGS, label: "Settings", implemented: true },
  { id: TOOLS.EMOJIS, label: "Emojis", implemented: true },
  { id: TOOLS.YOUTUBE_PLAYLIST, label: "YouTube Playlist", implemented: true },
  { id: TOOLS.VIDEO_DOWNLOADER, label: "Video Downloader", implemented: true },
  { id: TOOLS.CLOUDFLARE_DOCKER, label: "Cloudflare Docker", implemented: true },
  { id: TOOLS.CURRENCY_CONVERTER, label: "Currency Converter", implemented: true },
  { id: TOOLS.POINTS_CONVERTER, label: "Points Conversion", implemented: true },
  { id: TOOLS.FORM_INJECT, label: "Form Inject", implemented: true },
  { id: TOOLS.COLORS, label: "Colors", implemented: false },
];

const toolListView = document.getElementById("toolListView");
const toolPanelView = document.getElementById("toolPanelView");
const toolList = document.getElementById("toolList");
const toolPanelTitle = document.getElementById("toolPanelTitle");
const toolPanelContent = document.getElementById("toolPanelContent");
const backButton = document.getElementById("backButton");
const toast = document.getElementById("toast");

let panelCleanup = null;

const popupTitle = document.querySelector(".popup-title");

const TOOL_MOUNTERS = {
  [TOOLS.SETTINGS]: mountSettingsTool,
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

function renderToolList() {
  toolList.replaceChildren();

  for (const tool of TOOL_DEFINITIONS) {
    const item = document.createElement("li");
    item.className = "tool-list-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-button";
    button.disabled = !tool.implemented;

    const label = document.createElement("span");
    label.className = "tool-button-label";
    label.textContent = tool.label;

    button.appendChild(label);

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

    item.appendChild(button);
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

function init() {
  renderToolList();
  showToolList();
  applyAppName().catch(() => {});
}

init();
