import { EMOJI_LIST } from "./emoji-data.js";

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

export function mountEmojisTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "emojis-panel";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "emoji-search";
  searchInput.placeholder = "Search emojis…";
  searchInput.setAttribute("aria-label", "Search emojis");

  const gridWrap = document.createElement("div");
  gridWrap.className = "emoji-grid-wrap";

  const grid = document.createElement("div");
  grid.className = "emoji-grid";
  gridWrap.appendChild(grid);

  panel.append(searchInput, gridWrap);
  container.appendChild(panel);

  async function handleEmojiSelect(emoji) {
    try {
      await navigator.clipboard.writeText(emoji);
      showToast("Copied!");
      window.setTimeout(() => {
        window.close();
      }, TOAST_MS);
    } catch {
      showToast("Could not copy", true);
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

  function handleSearchInput() {
    renderGrid(searchInput.value);
  }

  searchInput.addEventListener("input", handleSearchInput);

  renderGrid("");
  searchInput.focus();

  return () => {
    searchInput.removeEventListener("input", handleSearchInput);
  };
}
