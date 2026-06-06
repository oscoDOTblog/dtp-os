import { mountEmojisTool } from "./emojis.js";
import { mountYoutubePlaylistTool } from "./youtubePlaylist.js";
import { mountVideoDownloaderTool } from "./videoDownloader.js";
import { mountCloudflareDockerTool } from "./cloudflareDocker.js";
import { TOOLS } from "./toolSettings.js";

const TOOL_DEFINITIONS = [
  { id: TOOLS.EMOJIS, label: "Emojis", implemented: true },
  { id: TOOLS.YOUTUBE_PLAYLIST, label: "YouTube Playlist", implemented: true },
  { id: TOOLS.VIDEO_DOWNLOADER, label: "Video Downloader", implemented: true },
  { id: TOOLS.CLOUDFLARE_DOCKER, label: "Cloudflare Docker", implemented: true },
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

const TOOL_MOUNTERS = {
  [TOOLS.EMOJIS]: mountEmojisTool,
  [TOOLS.YOUTUBE_PLAYLIST]: mountYoutubePlaylistTool,
  [TOOLS.VIDEO_DOWNLOADER]: mountVideoDownloaderTool,
  [TOOLS.CLOUDFLARE_DOCKER]: mountCloudflareDockerTool,
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

function init() {
  renderToolList();
  showToolList();
}

init();
