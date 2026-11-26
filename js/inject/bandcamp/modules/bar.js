/**
 * Shared dtp-tunes-style bottom player bar for dtp-os Bandcamp backends
 * (artist discography pages + release/album/track pages).
 *
 * Click-only: keyboard shortcuts are owned by each backend's context
 * (artist.js binds its own hotkeys; release pages reuse the upstream
 * bindControlKeys album branch).
 */

const ACCENT_HEX = {
  pink: "#ff1493",
  green: "#1db954",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
};

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function paintSlider(slider) {
  const max = Number(slider.max) || 0;
  const pct = max > 0 ? (Number(slider.value) / max) * 100 : 0;
  slider.style.setProperty("--range-fill", `${pct}%`);
}

export { formatTime };

// Lucide-style icons (stroke = currentColor), no emoji.
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="5" width="2" height="14" rx="1"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="5" width="2" height="14" rx="1"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  repeatOne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>',
  // Vinyl with a down arrow: the download button's busy state.
  vinyl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><path d="M12 6.5v3"/><path d="m10.2 8.2 1.8 1.8 1.8-1.8"/></svg>',
};

export function sanitizeFilename(name) {
  return (
    (name || "bandcamp.mp3").replace(/[\\/:*?"<>|]/g, "-").trim() ||
    "bandcamp.mp3"
  );
}

export function createPlayerBar({
  idleLabel,
  statusText = "",
  showVolume = true,
  showShuffle = true,
  showRepeat = true,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  onVolume,
  onQueueJump,
  onShuffle,
  onRepeat,
  onDownload,
  onDownloadAlbum,
} = {}) {
  const prefs = window.prefs || {};
  let curEl, durEl, seekSlider, volSlider;
  let scrubbing = false;
  let idle = true;

  const bar = document.createElement("div");
  bar.id = "dtp-player-bar";
  bar.style.setProperty(
    "--dtp-accent",
    ACCENT_HEX[prefs.accent] || ACCENT_HEX.pink
  );

  // Left: cover art + now-playing meta.
  const meta = document.createElement("div");
  meta.className = "dtp-a-meta";
  const coverEl = document.createElement("img");
  coverEl.className = "dtp-a-cover";
  coverEl.alt = "";
  coverEl.width = 56;
  coverEl.height = 56;
  coverEl.hidden = true;
  const metaText = document.createElement("div");
  metaText.className = "dtp-a-metatext";
  const nowEl = document.createElement("span");
  nowEl.id = "dtp-player-now";
  nowEl.textContent = "";
  nowEl.title = idleLabel || "";
  nowEl.classList.add("is-idle");
  nowEl.addEventListener("click", () => {
    if (idle && typeof onToggle === "function") onToggle();
  });
  const artistEl = document.createElement("span");
  artistEl.id = "dtp-player-artist";
  artistEl.hidden = true;
  const statusEl = document.createElement("span");
  statusEl.id = "dtp-player-status";
  statusEl.textContent = statusText;
  metaText.append(nowEl, artistEl, statusEl);
  meta.append(coverEl, metaText);

  // Center: transport + seek slider.
  const center = document.createElement("div");
  center.className = "dtp-a-center";
  const transport = document.createElement("div");
  transport.className = "dtp-a-transport";

  const mkBtn = (svg, hint, fn, primary = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = svg;
    b.title = hint;
    b.setAttribute("aria-label", hint);
    b.className = primary ? "dtp-a-btn dtp-a-play" : "dtp-a-btn";
    b.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof fn === "function") fn();
    });
    return b;
  };

  const toggleBtn = mkBtn(ICONS.play, "Play/pause (Space)", onToggle, true);
  const prevBtn = mkBtn(ICONS.prev, "Previous track (←)", onPrev);
  const nextBtn = mkBtn(ICONS.next, "Next track (→)", onNext);
  let shuffleBtn = null;
  if (showShuffle) {
    shuffleBtn = mkBtn(ICONS.shuffle, "Shuffle", onShuffle);
    transport.appendChild(shuffleBtn);
  }
  transport.append(prevBtn, toggleBtn, nextBtn);
  let repeatBtn = null;
  if (showRepeat) {
    repeatBtn = mkBtn(ICONS.repeat, "Repeat: off", onRepeat);
    transport.appendChild(repeatBtn);
  }

  const seekRow = document.createElement("div");
  seekRow.className = "dtp-a-seek";
  curEl = document.createElement("span");
  curEl.id = "dtp-player-cur";
  curEl.textContent = "0:00";
  seekSlider = document.createElement("input");
  seekSlider.type = "range";
  seekSlider.min = "0";
  seekSlider.max = "0";
  seekSlider.value = "0";
  seekSlider.setAttribute("aria-label", "Seek");
  paintSlider(seekSlider);
  seekSlider.addEventListener("pointerdown", () => {
    scrubbing = true;
  });
  window.addEventListener("pointerup", () => {
    scrubbing = false;
  });
  seekSlider.addEventListener("input", () => {
    if (typeof onSeek === "function") onSeek(Number(seekSlider.value) || 0);
    paintSlider(seekSlider);
  });
  durEl = document.createElement("span");
  durEl.id = "dtp-player-dur";
  durEl.textContent = "0:00";
  seekRow.append(curEl, seekSlider, durEl);
  center.append(transport, seekRow);

  // Right: queue button, then volume slider.
  const right = document.createElement("div");
  right.className = "dtp-a-right";
  const queueBtn = mkBtn(ICONS.queue, "Queue", () => {
    queuePanel.hidden = !queuePanel.hidden;
    if (!queuePanel.hidden) scrollToActive();
  });
  right.appendChild(queueBtn);
  // Download: one button. With both actions available (album pages) it
  // opens a small menu; with only one it acts directly.
  const DOWNLOAD_TITLE = "Download";
  const dlMenu = document.createElement("div");
  dlMenu.className = "dtp-a-dl-menu";
  dlMenu.hidden = true;
  const dlRows = [];
  const mkDlRow = (icon, title, sub, fn) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "dtp-a-dl-row";
    const iconEl = document.createElement("span");
    iconEl.className = "dtp-a-dl-row-icon";
    iconEl.innerHTML = icon;
    const text = document.createElement("span");
    text.className = "dtp-a-dl-row-text";
    const titleEl = document.createElement("span");
    titleEl.className = "dtp-a-dl-row-title";
    titleEl.textContent = title;
    const subEl = document.createElement("span");
    subEl.className = "dtp-a-dl-row-sub";
    subEl.textContent = sub;
    text.append(titleEl, subEl);
    row.append(iconEl, text);
    row.addEventListener("click", () => {
      dlMenu.hidden = true;
      if (typeof fn === "function") fn();
    });
    dlMenu.appendChild(row);
    dlRows.push(row);
  };
  if (typeof onDownload === "function") {
    mkDlRow(ICONS.music, "Current track", "MP3 · tagged", onDownload);
  }
  if (typeof onDownloadAlbum === "function") {
    mkDlRow(ICONS.disc, "Whole album", "ZIP · tracks + cover", onDownloadAlbum);
  }
  const downloadBtn = mkBtn(ICONS.download, DOWNLOAD_TITLE, () => {
    if (!dlRows.length) return;
    if (dlRows.length === 1) {
      dlRows[0].click();
      return;
    }
    dlMenu.hidden = !dlMenu.hidden;
  });
  right.appendChild(downloadBtn);
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (
        !dlMenu.hidden &&
        !dlMenu.contains(e.target) &&
        !downloadBtn.contains(e.target)
      ) {
        dlMenu.hidden = true;
      }
    },
    true
  );
  const vol = document.createElement("div");
  vol.className = "dtp-a-vol";
  if (showVolume) {
    volSlider = document.createElement("input");
    volSlider.type = "range";
    volSlider.min = "0";
    volSlider.max = "1";
    volSlider.step = "0.01";
    volSlider.value = "1";
    volSlider.setAttribute("aria-label", "Volume");
    paintSlider(volSlider);
    volSlider.addEventListener("input", () => {
      if (typeof onVolume === "function") onVolume(Number(volSlider.value));
      paintSlider(volSlider);
    });
    vol.appendChild(volSlider);
    right.appendChild(vol);
  }

  // Queue panel: upcoming tracks, like the native player's queue.
  const queuePanel = document.createElement("div");
  queuePanel.className = "dtp-a-queue";
  queuePanel.hidden = true;
  const queueList = document.createElement("ol");
  queuePanel.appendChild(queueList);

  function scrollToActive() {
    const active = queueList.querySelector(".is-active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  // items: [{ title, subtitle }], activeIndex: number (-1 = none).
  // Re-renders only when the signature changes so open-panel scroll
  // position survives position polls.
  let queueSig = "";
  function setQueue(items, activeIndex = -1) {
    const list = items || [];
    const sig = `${activeIndex}|${list
      .map((item) => `${item.title}~${item.subtitle || ""}`)
      .join("`")}`;
    if (sig === queueSig) return;
    queueSig = sig;
    queueList.replaceChildren();
    list.forEach((item, i) => {
      const row = document.createElement("li");
      row.className = "dtp-a-queue-row" + (i === activeIndex ? " is-active" : "");
      const title = document.createElement("span");
      title.className = "dtp-a-queue-title";
      title.textContent = item.title;
      const sub = document.createElement("span");
      sub.className = "dtp-a-queue-sub";
      sub.textContent = item.subtitle || "";
      row.append(title, sub);
      row.addEventListener("click", () => {
        if (typeof onQueueJump === "function") onQueueJump(i);
      });
      queueList.appendChild(row);
    });
    if (!queuePanel.hidden) scrollToActive();
  }

  bar.append(meta, center, right, queuePanel, dlMenu);

  function setTrack(track) {
    if (!track || !track.title) {
      idle = true;
      nowEl.textContent = "";
      nowEl.classList.add("is-idle");
      artistEl.textContent = "";
      artistEl.hidden = true;
      coverEl.hidden = true;
      coverEl.removeAttribute("src");
    } else {
      idle = false;
      nowEl.textContent = track.title;
      nowEl.classList.remove("is-idle");
      if (track.artist) {
        artistEl.textContent = track.artist;
        artistEl.hidden = false;
      } else {
        artistEl.textContent = "";
        artistEl.hidden = true;
      }
      if (track.art) {
        if (coverEl.getAttribute("src") !== track.art) {
          coverEl.setAttribute("src", track.art);
        }
        coverEl.hidden = false;
      } else {
        coverEl.hidden = true;
        coverEl.removeAttribute("src");
      }
    }
  }

  function setShuffleActive(on) {
    if (shuffleBtn) shuffleBtn.classList.toggle("is-active", on);
  }

  function setRepeatMode(mode) {
    if (!repeatBtn) return;
    repeatBtn.innerHTML = mode === "one" ? ICONS.repeatOne : ICONS.repeat;
    repeatBtn.title = `Repeat: ${mode}`;
    repeatBtn.classList.toggle("is-active", mode !== "off");
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // Download feedback: the button spins (record-like) while anything
  // downloads; with a known total a thin determinate strip runs along the
  // bar's top edge. Self-contained so backends that never call it are
  // unaffected.
  let progressEl = null;
  let progressFill = null;
  let progressLabel = null;
  function ensureProgress() {
    if (progressEl) return;
    progressEl = document.createElement("div");
    progressEl.className = "dtp-a-dl-progress";
    progressEl.hidden = true;
    progressFill = document.createElement("div");
    progressFill.className = "dtp-a-dl-progress-fill";
    progressEl.appendChild(progressFill);
    bar.appendChild(progressEl);
    progressLabel = document.createElement("span");
    progressLabel.className = "dtp-a-dl-progress-label";
    progressLabel.hidden = true;
    bar.appendChild(progressLabel);
  }

  function setDownloadProgress({ active, done = 0, total = 0, failed = 0, pct } = {}) {
    const busy = Boolean(active);
    downloadBtn.classList.toggle("is-busy", busy);
    downloadBtn.disabled = busy;
    // Swap the tray icon for the vinyl record while downloading; the
    // is-busy CSS spins it like a turntable.
    downloadBtn.innerHTML = busy ? ICONS.vinyl : ICONS.download;
    ensureProgress();
    const shown =
      typeof pct === "number"
        ? Math.min(100, Math.max(0, Math.round(pct)))
        : total > 0
          ? Math.round((done / total) * 100)
          : 0;
    progressEl.hidden = !busy || !(total > 0);
    progressLabel.hidden = !busy || !(total > 0);
    if (busy) {
      progressFill.style.width = `${shown}%`;
      progressLabel.textContent = `${shown}% · ${done}/${total}`;
      const label = total > 0
        ? `Downloading… ${shown}% (${done}/${total})${failed ? ` — ${failed} failed` : ""}`
        : "Downloading…";
      downloadBtn.title = label;
      downloadBtn.setAttribute("aria-label", label);
    } else {
      progressFill.style.width = "0%";
      downloadBtn.title = DOWNLOAD_TITLE;
      downloadBtn.setAttribute("aria-label", DOWNLOAD_TITLE);
    }
  }

  function setPosition(secs) {
    const cur = Number(secs) || 0;
    curEl.textContent = formatTime(cur);
    if (!scrubbing && seekSlider) {
      seekSlider.value = String(Math.floor(cur));
      paintSlider(seekSlider);
    }
  }

  function setDuration(secs) {
    const dur = Number(secs) || 0;
    durEl.textContent = formatTime(dur);
    if (seekSlider) {
      seekSlider.max = String(Math.floor(dur));
      paintSlider(seekSlider);
    }
  }

  function setPlaying(isPlaying) {
    toggleBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
  }

  return {
    element: bar,
    setTrack,
    setStatus,
    setDownloadProgress,
    setPosition,
    setDuration,
    setPlaying,
    setQueue,
    setShuffleActive,
    setRepeatMode,
  };
}
