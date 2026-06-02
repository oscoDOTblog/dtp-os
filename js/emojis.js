import { EMOJI_LIST } from "./emoji-data.js";
import { getRecentEmojis, recordEmojiUse, setLastTool, TOOLS } from "./toolSettings.js";

const TOAST_MS = 400;

function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

function matchesEmoji(entry, query) {
  if (!query) {
    return true;
  }
  if (entry.emoji.includes(query)) {
    return true;
  }
  return entry.keywords.some((keyword) => keyword.includes(query));
}

function createEmojiButton(emoji, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "emoji-button";
  button.textContent = emoji;
  button.setAttribute("aria-label", `Copy ${emoji}`);
  button.addEventListener("click", () => onSelect(emoji));
  return button;
}

export function mountEmojisTool(container, { showToast, hideToast }) {
  const panel = document.createElement("div");
  panel.className = "emojis-panel";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "emoji-search";
  searchInput.placeholder = "Search emojis…";
  searchInput.setAttribute("aria-label", "Search emojis");

  const recentSection = document.createElement("div");
  recentSection.className = "recent-section";

  const recentLabel = document.createElement("span");
  recentLabel.className = "recent-label";
  recentLabel.textContent = "Recent";

  const recentRow = document.createElement("div");
  recentRow.className = "recent-row";
  recentSection.append(recentLabel, recentRow);

  const gridWrap = document.createElement("div");
  gridWrap.className = "emoji-grid-wrap";

  const grid = document.createElement("div");
  grid.className = "emoji-grid";
  gridWrap.appendChild(grid);

  panel.append(searchInput, recentSection, gridWrap);
  container.appendChild(panel);

  let recentEmojis = [];

  async function handleEmojiSelect(emoji) {
    try {
      await navigator.clipboard.writeText(emoji);
      await recordEmojiUse(emoji);
      await setLastTool(TOOLS.EMOJIS);
      showToast("Copied!");
      window.setTimeout(() => {
        window.close();
      }, TOAST_MS);
    } catch {
      showToast("Could not copy", true);
    }
  }

  function renderRecentRow() {
    recentRow.replaceChildren();
    if (recentEmojis.length === 0) {
      recentSection.hidden = true;
      return;
    }
    recentSection.hidden = false;
    for (const emoji of recentEmojis) {
      recentRow.appendChild(createEmojiButton(emoji, handleEmojiSelect));
    }
  }

  function renderGrid(query) {
    const normalized = normalizeQuery(query);
    const results = EMOJI_LIST.filter((entry) => matchesEmoji(entry, normalized));

    grid.replaceChildren();

    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "emoji-empty";
      empty.textContent = "No emojis found";
      grid.appendChild(empty);
      return;
    }

    for (const entry of results) {
      grid.appendChild(createEmojiButton(entry.emoji, handleEmojiSelect));
    }
  }

  function updateRecentVisibility(query) {
    if (query.trim().length > 0) {
      recentSection.hidden = true;
      return;
    }
    recentSection.hidden = recentEmojis.length === 0;
  }

  function handleSearchInput() {
    const query = searchInput.value;
    updateRecentVisibility(query);
    renderGrid(query);
  }

  searchInput.addEventListener("input", handleSearchInput);

  getRecentEmojis().then((recents) => {
    recentEmojis = recents;
    renderRecentRow();
    updateRecentVisibility(searchInput.value);
  });

  renderGrid("");
  searchInput.focus();

  return () => {
    searchInput.removeEventListener("input", handleSearchInput);
  };
}
