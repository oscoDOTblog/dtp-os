import { downloadVideoAsync } from "./lib/videodlClient.js";
import { setLastTool, TOOLS } from "./toolSettings.js";

const PROGRESS_BY_STATUS = {
  starting: 5,
  pending: 10,
  processing: 50,
  downloading: 90,
  completed: 80,
  error: 0,
};

/** Phase copy aligned with sway-player-ios `VideoLinkImportPhase` / `Localizable.strings`. */
const STATUS_LABELS = {
  starting: "Connecting…",
  pending: "Getting ready…",
  processing: "Downloading your clip…",
  downloading: "Saving to your device…",
  completed: "Almost done…",
  error: "An error occurred",
};

function triggerAnchorDownload(href, downloadName) {
  const link = document.createElement("a");
  link.href = href;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function detectPlatform(value) {
  if (value.includes("tiktok.com")) return "TikTok";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "YouTube";
  if (value.includes("instagram.com")) return "Instagram";
  if (value.includes("twitter.com") || value.includes("x.com")) return "Twitter";
  if (value.includes("facebook.com")) return "Facebook";
  if (value.includes("reddit.com")) return "Reddit";
  return "Social Media";
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function mountVideoDownloaderTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Paste a social media link to download without ads or tracking. Downloading may take up to several minutes depending on length and connectivity.";

  const urlWrap = document.createElement("div");
  urlWrap.className = "tool-url-wrap";

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "tool-input";
  urlInput.placeholder =
    "Paste TikTok, YouTube, Instagram, or other links...";

  const platformBadge = document.createElement("span");
  platformBadge.className = "tool-platform-badge";
  platformBadge.hidden = true;

  urlWrap.appendChild(urlInput);
  urlWrap.appendChild(platformBadge);

  const formatRow = document.createElement("div");
  formatRow.className = "tool-format-row";

  const formatLabel = document.createElement("span");
  formatLabel.className = "tool-format-label";
  formatLabel.textContent = "Format:";

  const mp4Btn = document.createElement("button");
  mp4Btn.type = "button";
  mp4Btn.className = "tool-format-btn tool-format-btn-active";
  mp4Btn.textContent = "MP4";

  const mp3Btn = document.createElement("button");
  mp3Btn.type = "button";
  mp3Btn.className = "tool-format-btn";
  mp3Btn.textContent = "MP3";

  formatRow.appendChild(formatLabel);
  formatRow.appendChild(mp4Btn);
  formatRow.appendChild(mp3Btn);

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "tool-btn tool-btn-primary tool-btn-block";
  downloadBtn.textContent = "Download MP4";

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  const statusWrap = document.createElement("div");
  statusWrap.className = "tool-download-status";
  statusWrap.hidden = true;

  const statusMessage = document.createElement("div");
  statusMessage.className = "tool-status-message";

  const progressContainer = document.createElement("div");
  progressContainer.className = "tool-progress-container";

  const progressBar = document.createElement("div");
  progressBar.className = "tool-progress-bar";

  const progressFill = document.createElement("div");
  progressFill.className = "tool-progress-fill";

  const progressText = document.createElement("div");
  progressText.className = "tool-progress-text";
  progressText.textContent = "0%";

  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);

  const fileSizeInfo = document.createElement("div");
  fileSizeInfo.className = "tool-file-size";
  fileSizeInfo.hidden = true;

  statusWrap.appendChild(statusMessage);
  statusWrap.appendChild(progressContainer);
  statusWrap.appendChild(fileSizeInfo);

  panel.appendChild(desc);
  panel.appendChild(urlWrap);
  panel.appendChild(formatRow);
  panel.appendChild(downloadBtn);
  panel.appendChild(errorEl);
  panel.appendChild(statusWrap);
  container.appendChild(panel);

  let format = "mp4";
  let isDownloading = false;
  let pendingBlobUrl = null;
  let abortRequested = false;

  function setFormat(next) {
    format = next;
    mp4Btn.classList.toggle("tool-format-btn-active", format === "mp4");
    mp3Btn.classList.toggle("tool-format-btn-active", format === "mp3");
    if (!isDownloading) {
      downloadBtn.textContent = `Download ${format.toUpperCase()}`;
    }
  }

  function setDisabled(disabled) {
    urlInput.disabled = disabled;
    mp4Btn.disabled = disabled;
    mp3Btn.disabled = disabled;
    downloadBtn.disabled = disabled || !urlInput.value.trim();
  }

  function applyStatus(status) {
    statusMessage.textContent = STATUS_LABELS[status] || `Status: ${status}`;
    const step = PROGRESS_BY_STATUS[status];
    if (step !== undefined) {
      const current = parseInt(progressText.textContent, 10) || 0;
      const next = Math.max(current, step);
      progressFill.style.width = `${next}%`;
      progressText.textContent = `${next}%`;
    }
  }

  function handleUrlChange() {
    const value = urlInput.value;
    errorEl.hidden = true;
    errorEl.textContent = "";
    downloadBtn.disabled = isDownloading || !value.trim();

    if (value && isValidUrl(value)) {
      platformBadge.textContent = detectPlatform(value);
      platformBadge.hidden = false;
    } else {
      platformBadge.hidden = true;
    }
  }

  async function handleDownload() {
    const url = urlInput.value.trim();
    if (!url || !isValidUrl(url)) {
      errorEl.textContent = "Please enter a valid URL";
      errorEl.hidden = false;
      return;
    }

    isDownloading = true;
    abortRequested = false;
    setDisabled(true);
    errorEl.hidden = true;
    statusWrap.hidden = false;
    fileSizeInfo.hidden = true;
    progressFill.style.width = "0%";
    progressText.textContent = "0%";
    downloadBtn.textContent = "Downloading...";
    applyStatus("starting");

    const platform = detectPlatform(url);
    const filename = `${platform}-${Date.now()}.${format}`;

    try {
      await setLastTool(TOOLS.VIDEO_DOWNLOADER);

      const result = await downloadVideoAsync(url, true, (status) => {
        if (!abortRequested) applyStatus(status);
      }, format);

      const downloadUrl = result.downloadUrl || result.url;
      if (!downloadUrl) {
        throw new Error("No download URL returned");
      }

      applyStatus("downloading");
      progressFill.style.width = "90%";
      progressText.textContent = "90%";

      let savedViaBlob = false;

      try {
        const videoResponse = await fetch(downloadUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch file: ${videoResponse.status}`);
        }
        const blob = await videoResponse.blob();
        const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
        fileSizeInfo.textContent = `File ready: ${sizeMb} MB`;
        fileSizeInfo.hidden = false;

        if (pendingBlobUrl) {
          URL.revokeObjectURL(pendingBlobUrl);
        }
        const objectUrl = URL.createObjectURL(blob);
        pendingBlobUrl = objectUrl;

        triggerAnchorDownload(objectUrl, filename);
        savedViaBlob = true;

        setTimeout(() => {
          if (pendingBlobUrl === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            pendingBlobUrl = null;
          }
        }, 2500);
      } catch (fetchErr) {
        console.warn("Blob download path failed, using direct URL:", fetchErr);
        triggerAnchorDownload(downloadUrl, filename);
        statusMessage.textContent =
          "Opening download link (direct save may use server file name).";
      }

      progressFill.style.width = "100%";
      progressText.textContent = "100%";
      statusMessage.textContent = savedViaBlob
        ? "Download complete — check your Downloads folder."
        : "Download started — check your Downloads folder.";
      showToast(savedViaBlob ? "Download complete" : "Download started");

      setTimeout(() => {
        isDownloading = false;
        statusWrap.hidden = true;
        urlInput.value = "";
        platformBadge.hidden = true;
        setDisabled(false);
        downloadBtn.textContent = `Download ${format.toUpperCase()}`;
        progressFill.style.width = "0%";
        progressText.textContent = "0%";
        fileSizeInfo.hidden = true;
      }, savedViaBlob ? 2200 : 2800);
    } catch (err) {
      console.error("Download error:", err);
      errorEl.textContent = err.message || "Download failed. Please try again.";
      errorEl.hidden = false;
      isDownloading = false;
      statusWrap.hidden = true;
      setDisabled(false);
      downloadBtn.textContent = `Download ${format.toUpperCase()}`;
      showToast(err.message || "Download failed", true);
    }
  }

  function onMp4Click() {
    if (!isDownloading) setFormat("mp4");
  }

  function onMp3Click() {
    if (!isDownloading) setFormat("mp3");
  }

  urlInput.addEventListener("input", handleUrlChange);
  mp4Btn.addEventListener("click", onMp4Click);
  mp3Btn.addEventListener("click", onMp3Click);
  downloadBtn.addEventListener("click", handleDownload);

  urlInput.focus();

  return () => {
    abortRequested = true;
    urlInput.removeEventListener("input", handleUrlChange);
    mp4Btn.removeEventListener("click", onMp4Click);
    mp3Btn.removeEventListener("click", onMp3Click);
    downloadBtn.removeEventListener("click", handleDownload);
    if (pendingBlobUrl) {
      URL.revokeObjectURL(pendingBlobUrl);
      pendingBlobUrl = null;
    }
  };
}
