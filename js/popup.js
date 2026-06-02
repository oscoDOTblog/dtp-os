import { mountEmojisTool } from "./emojis.js";
import {
  getLastTool,
  IMPLEMENTED_TOOLS,
  setLastTool,
  TOOLS,
} from "./toolSettings.js";

const TOOL_DEFINITIONS = [
  { id: TOOLS.EMOJIS, label: "Emojis", implemented: true },
  { id: TOOLS.COLORS, label: "Colors", implemented: false },
  { id: TOOLS.TBD, label: "TBD", implemented: false },
];

const toolListView = document.getElementById("toolListView");
const toolPanelView = document.getElementById("toolPanelView");
const toolList = document.getElementById("toolList");
const toolPanelTitle = document.getElementById("toolPanelTitle");
const toolPanelContent = document.getElementById("toolPanelContent");
const backButton = document.getElementById("backButton");
const toast = document.getElementById("toast");

let emojiCleanup = null;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
}

function hideToast() {
  toast.hidden = true;
  toast.classList.remove("is-error");
}

function showToolList() {
  if (emojiCleanup) {
    emojiCleanup();
    emojiCleanup = null;
  }
  toolPanelView.hidden = true;
  toolListView.hidden = false;
  hideToast();
}

function showToolPanel(toolId) {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === toolId);
  if (!tool) {
    return;
  }

  toolListView.hidden = true;
  toolPanelView.hidden = false;
  toolPanelTitle.textContent = tool.label;
  toolPanelContent.replaceChildren();

  if (toolId === TOOLS.EMOJIS) {
    emojiCleanup = mountEmojisTool(toolPanelContent, { showToast, hideToast });
    return;
  }

  const stub = document.createElement("p");
  stub.className = "stub-message";
  stub.textContent = "Coming soon";
  toolPanelContent.appendChild(stub);
}

async function openTool(toolId) {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === toolId);
  if (!tool || !tool.implemented) {
    return;
  }
  await setLastTool(toolId);
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

async function init() {
  renderToolList();
  const lastTool = await getLastTool();
  if (lastTool && IMPLEMENTED_TOOLS.has(lastTool)) {
    showToolPanel(lastTool);
    return;
  }
  showToolList();
}

init();
