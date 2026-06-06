import { buildUploadsPlaylistFromInput } from "./lib/youtubeChannelPlaylist.js";

const HELP_PANEL_ID = "youtube-playlist-help";

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textField = document.createElement("textarea");
  textField.value = text;
  textField.style.position = "fixed";
  textField.style.opacity = "0";
  document.body.appendChild(textField);
  textField.select();
  document.execCommand("copy");
  document.body.removeChild(textField);
}

export function mountYoutubePlaylistTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const headerRow = document.createElement("div");
  headerRow.className = "tool-form-header-row";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Paste View Page Source from a YouTube channel page, a channel URL, or a channel ID to get an uploads playlist URL.";

  const helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className = "tool-help-toggle";
  helpBtn.setAttribute("aria-expanded", "false");
  helpBtn.setAttribute("aria-controls", HELP_PANEL_ID);
  helpBtn.setAttribute("aria-label", "Show instructions");
  helpBtn.textContent = "?";

  headerRow.appendChild(desc);
  headerRow.appendChild(helpBtn);

  const helpPanel = document.createElement("div");
  helpPanel.id = HELP_PANEL_ID;
  helpPanel.className = "tool-help-panel";
  helpPanel.hidden = true;
  helpPanel.setAttribute("role", "region");
  helpPanel.setAttribute("aria-label", "How to use");
  helpPanel.innerHTML = `
    <h3>How it works</h3>
    <p>YouTube channel IDs start with <code>UC</code>. The uploads playlist uses <code>UU</code> instead, as <code>https://www.youtube.com/playlist?list=UU...</code></p>
    <h3>Desktop: get channel ID from page source</h3>
    <ol>
      <li>Open the channel page on YouTube.</li>
      <li>Right-click and choose <strong>View Page Source</strong>, or press <code>Ctrl+U</code> / <code>Cmd+Option+U</code>.</li>
      <li>Search for <code>channelId</code> and copy the <code>UC...</code> value, or paste the entire page source here.</li>
    </ol>
    <h3>Other options</h3>
    <ol>
      <li>Paste a channel URL like <code>https://www.youtube.com/channel/UC...</code></li>
      <li>In YouTube Studio: Settings → Channel → Advanced settings → Channel ID.</li>
    </ol>
    <p><strong>Note:</strong> A handle like <code>@channelname</code> alone cannot be converted—you need the <code>UC...</code> ID.</p>
  `;

  const inputLabel = document.createElement("label");
  inputLabel.className = "tool-label";
  inputLabel.htmlFor = "youtube-playlist-input";
  inputLabel.textContent = "Page source, channel URL, or channel ID";

  const input = document.createElement("textarea");
  input.id = "youtube-playlist-input";
  input.className = "tool-textarea";
  input.rows = 5;
  input.placeholder = 'Paste page source or search for "channelId":"UC..." ...';

  const outputsWrap = document.createElement("div");
  outputsWrap.className = "tool-outputs";
  outputsWrap.hidden = true;

  const channelIdLabel = document.createElement("label");
  channelIdLabel.className = "tool-label";
  channelIdLabel.htmlFor = "youtube-channel-id-output";
  channelIdLabel.textContent = "Channel ID";

  const channelIdOut = document.createElement("textarea");
  channelIdOut.id = "youtube-channel-id-output";
  channelIdOut.className = "tool-output";
  channelIdOut.rows = 1;
  channelIdOut.readOnly = true;

  const playlistLabel = document.createElement("label");
  playlistLabel.className = "tool-label";
  playlistLabel.htmlFor = "youtube-playlist-url-output";
  playlistLabel.textContent = "Uploads playlist URL";

  const playlistOut = document.createElement("textarea");
  playlistOut.id = "youtube-playlist-url-output";
  playlistOut.className = "tool-output";
  playlistOut.rows = 2;
  playlistOut.readOnly = true;

  const actionRow = document.createElement("div");
  actionRow.className = "tool-action-row";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "tool-btn tool-btn-primary";
  copyBtn.textContent = "Copy playlist URL";

  const openLink = document.createElement("a");
  openLink.className = "tool-link";
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.textContent = "Open in YouTube";

  actionRow.appendChild(copyBtn);
  actionRow.appendChild(openLink);

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  outputsWrap.appendChild(channelIdLabel);
  outputsWrap.appendChild(channelIdOut);
  outputsWrap.appendChild(playlistLabel);
  outputsWrap.appendChild(playlistOut);
  outputsWrap.appendChild(actionRow);

  panel.appendChild(headerRow);
  panel.appendChild(helpPanel);
  panel.appendChild(inputLabel);
  panel.appendChild(input);
  panel.appendChild(outputsWrap);
  panel.appendChild(errorEl);
  container.appendChild(panel);

  let playlistUrl = "";

  function toggleHelp() {
    const open = helpPanel.hidden;
    helpPanel.hidden = !open;
    helpBtn.setAttribute("aria-expanded", String(open));
    helpBtn.setAttribute(
      "aria-label",
      open ? "Hide instructions" : "Show instructions"
    );
  }

  function handleInput() {
    const value = input.value;
    errorEl.hidden = true;
    errorEl.textContent = "";

    if (!value.trim()) {
      outputsWrap.hidden = true;
      playlistUrl = "";
      openLink.removeAttribute("href");
      return;
    }

    try {
      const result = buildUploadsPlaylistFromInput(value);
      playlistUrl = result.playlistUrl;
      channelIdOut.value = result.channelId;
      playlistOut.value = result.playlistUrl;
      openLink.href = result.playlistUrl;
      outputsWrap.hidden = false;
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      outputsWrap.hidden = true;
      playlistUrl = "";
      openLink.removeAttribute("href");
    }
  }

  async function handleCopy() {
    if (!playlistUrl) return;
    try {
      await copyText(playlistUrl);
      copyBtn.textContent = "✓ Copied!";
      showToast("Copied!");
      setTimeout(() => {
        copyBtn.textContent = "Copy playlist URL";
      }, 2000);
    } catch {
      errorEl.textContent = "Failed to copy to clipboard";
      errorEl.hidden = false;
    }
  }

  helpBtn.addEventListener("click", toggleHelp);
  input.addEventListener("input", handleInput);
  copyBtn.addEventListener("click", handleCopy);

  input.focus();

  return () => {
    helpBtn.removeEventListener("click", toggleHelp);
    input.removeEventListener("input", handleInput);
    copyBtn.removeEventListener("click", handleCopy);
  };
}
