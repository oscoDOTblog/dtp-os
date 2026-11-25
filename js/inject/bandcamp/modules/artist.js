/**
 * dtp-os addition (no upstream equivalent): continuous playback for
 * artist/label discography (.../music) pages.
 *
 * Those pages expose no Bandcamp player object (which is why upstream
 * init.js returns early there), so this drives a native Audio element.
 * Release tracklists resolve lazily, just in time: each release page is
 * fetched same-origin and its embedded `data-tralbum` JSON (the same
 * embed downloaders like yt-dlp parse) is read for streamable tracks.
 * Unstreamable/private releases are skipped, never stalling the queue.
 */

import { createPlayerBar, sanitizeFilename } from "./bar.js";

const PLAYER_BAR_ID = "dtp-player-bar";
const RESTART_THRESHOLD_SECS = 3;

function pickStream(file) {
  if (!file) return "";
  return (
    file["mp3-128"] ||
    file["mp3-v0"] ||
    file["mp3-320"] ||
    Object.values(file).find((v) => typeof v === "string" && v.startsWith("http")) ||
    ""
  );
}

function releaseTitleFromAnchor(anchor, url) {
  const titled = anchor.querySelector(".title");
  const text = ((titled && titled.textContent) || anchor.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text;
  const slug = url.pathname.split("/").filter(Boolean).pop() || "";
  return decodeURIComponent(slug).replace(/-/g, " ");
}

function collectReleases() {
  const seen = new Set();
  const releases = [];
  const anchors = document.querySelectorAll(
    'a[href*="/album/"], a[href*="/track/"]'
  );
  anchors.forEach((anchor) => {
    let url;
    try {
      url = new URL(anchor.getAttribute("href"), document.baseURI);
    } catch (e) {
      return;
    }
    // Same-artist links only: recommendations point at other subdomains.
    if (url.hostname !== location.hostname) return;
    if (!/^\/(album|track)\/[^/?#]+\/?$/.test(url.pathname)) return;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) return;
    seen.add(key);
    releases.push({
      url: key,
      title: releaseTitleFromAnchor(anchor, url),
      art: anchor.querySelector("img")?.src || "",
    });
  });
  return releases;
}

function yearFrom(dateStr) {
  const m = /(\d{4})/.exec(dateStr || "");
  return m ? m[1] : "";
}

function fullArtUrl(artId) {
  const id = Number(artId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `https://f4.bcbits.com/img/a${String(id).padStart(10, "0")}_10.jpg`;
}

async function fetchReleaseTracks(releaseUrl) {
  const empty = { tracks: [], year: "", art: "" };
  const res = await fetch(releaseUrl, { credentials: "same-origin" });
  if (!res.ok) return empty;
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector("[data-tralbum]");
  if (!el) return empty;
  let data;
  try {
    data = JSON.parse(el.getAttribute("data-tralbum"));
  } catch (e) {
    return empty;
  }
  const artist = data.artist || "";
  const tracks = (data.trackinfo || [])
    .map((t) => ({
      title: t.title || "Untitled",
      artist,
      duration: t.duration || 0,
      url: pickStream(t.file),
    }))
    .filter((t) => t.url);
  return {
    tracks,
    year: yearFrom(data.album_release_date),
    art: fullArtUrl(data.art_id),
  };
}

export function initArtistPage() {
  if (document.getElementById(PLAYER_BAR_ID)) return true;

  const releases = collectReleases();
  if (releases.length === 0) return false;

  window.originalTitle = window.originalTitle || window.document.title;
  const prefs = window.prefs || {};

  const audio = new Audio();
  audio.preload = "auto";

  const cache = new Map(); // releaseUrl -> track array
  const releaseMeta = new Map(); // releaseUrl -> { year, art }
  let playToken = 0; // guards the error handler against stale track failures
  let releaseIndex = 0;
  let tracklist = [];
  let trackIndex = -1;
  let started = false;
  let session = 0; // guards against stale async loads after skips

  const bar = createPlayerBar({
    idleLabel: `Play all ${releases.length} releases`,
    onToggle: () => toggle(),
    onPrev: () => prev(),
    onNext: () => next(),
    onSeek: (value) => {
      if (audio.src) audio.currentTime = value;
    },
    onVolume: (value) => {
      audio.volume = value;
    },
    onQueueJump: (i) => {
      const item = lastQueueItems[i];
      if (!item) return;
      posR = item.rPos;
      posT = item.tPos;
      const mySession = ++session;
      started = true;
      playSlot(mySession, 1);
    },
    onShuffle: () => setShuffle(!shuffleOn),
    onRepeat: () => setRepeatCycle(),
    onDownload: () => {
      const t = tracklist[trackIndex];
      if (!t || !t.url) return;
      const meta = releaseMeta.get(releases[releaseIndex]?.url) || {};
      window.postMessage(
        {
          type: "dtp-bandcamp-download",
          url: t.url,
          filename: sanitizeFilename(
            `${t.artist ? t.artist + " - " : ""}${t.title || "track"}.mp3`
          ),
          tags: {
            title: t.title || "",
            artist: t.artist || "",
            album: releases[releaseIndex]?.title || "",
            year: meta.year || "",
            art: meta.art || "",
            num: trackIndex + 1,
            total: tracklist.length,
          },
        },
        "*"
      );
    },
  });
  document.body.appendChild(bar.element);
  bar.setRepeatMode("off");

  // Flat queue model: loaded releases expand to their tracks,
  // unloaded ones stay a single tap-to-load row.
  let lastQueueItems = [];

  function refreshQueue(forceActive) {
    const items = [];
    let active = forceActive === undefined ? -1 : forceActive;
    const wantActive = forceActive === undefined && started;
    releaseOrder.forEach((ri, rPos) => {
      const rel = releases[ri];
      const tracks = cache.get(rel.url);
      if (tracks && tracks.length) {
        const order = ensureTrackOrder(ri);
        order.forEach((ti, tPos) => {
          if (wantActive && rPos === posR && tPos === posT) {
            active = items.length;
          }
          const t = tracks[ti];
          items.push({
            title: t.title,
            subtitle: `${t.artist ? t.artist + " — " : ""}${rel.title}`,
            rPos,
            tPos,
          });
        });
      } else {
        if (wantActive && rPos === posR) active = items.length;
        items.push({
          title: rel.title,
          subtitle: "Release — tap to load",
          rPos,
          tPos: 0,
        });
      }
    });
    lastQueueItems = items;
    bar.setQueue(items, active);
  }

  function setStatus(text) {
    bar.setStatus(text);
  }

  function setNowPlaying(track) {
    bar.setTrack(track);
    window.document.title = track
      ? `${track.title}${track.artist ? " by " + track.artist : ""} | ${
          window.originalTitle
        }`
      : window.originalTitle;
  }

  function updateToggle() {
    bar.setPlaying(!audio.paused);
  }

  async function ensureRelease(i) {
    const release = releases[i];
    if (!release) return false;
    if (!cache.has(release.url)) {
      setStatus(`Loading ${release.title}…`);
      try {
        const loaded = await fetchReleaseTracks(release.url);
        cache.set(release.url, loaded.tracks);
        releaseMeta.set(release.url, {
          year: loaded.year,
          art: loaded.art,
        });
      } catch (e) {
        console.log("artist player: failed to load", release.url, e);
        cache.set(release.url, []);
      }
    }
    tracklist = cache.get(release.url);
    releaseIndex = i;
    return tracklist.length > 0;
  }

  // Playback order state. Linear mode walks releases and tracks in page
  // order; shuffle mode shuffles the release order (current first) and each
  // loaded release's track order. Unloaded releases resolve to a single
  // slot and expand on arrival.
  let releaseOrder = releases.map((_, i) => i);
  const trackOrders = new Map(); // releaseUrl -> [ti...]
  let posR = 0;
  let posT = 0;
  let shuffleOn = false;
  let repeatMode = "off"; // off | all | one

  function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function ensureTrackOrder(ri) {
    const url = releases[ri].url;
    if (trackOrders.has(url)) return trackOrders.get(url);
    const n = (cache.get(url) || []).length;
    let order = [...Array(n).keys()];
    if (shuffleOn && n > 1) order = shuffleArray(order);
    trackOrders.set(url, order);
    return order;
  }

  function pointerSlot() {
    const ri = releaseOrder[posR];
    const order = trackOrders.get(releases[ri]?.url);
    return { ri, ti: order ? order[posT] ?? 0 : 0 };
  }

  // Step the pointer, mutating only on success.
  function stepPointer(dir) {
    let r = posR;
    let t = posT + dir;
    for (;;) {
      const url = releases[releaseOrder[r]]?.url;
      const order = url ? trackOrders.get(url) : undefined;
      const len = order ? order.length : 1;
      if (t >= 0 && t < len) {
        posR = r;
        posT = t;
        return true;
      }
      r += dir;
      if (r < 0 || r >= releaseOrder.length) return false;
      const norder = trackOrders.get(releases[releaseOrder[r]].url);
      t = dir > 0 ? 0 : norder ? norder.length - 1 : 0;
    }
  }

  function endOfQueueUI() {
    setStatus("End of discography.");
    setNowPlaying(null);
    updateToggle();
    refreshQueue(-1);
  }

  async function playCurrentSlot(mySession) {
    const { ri } = pointerSlot();
    const order = trackOrders.get(releases[ri].url) || [];
    const ti = order[posT] !== undefined ? order[posT] : 0;
    trackIndex = ti;
    releaseIndex = ri;
    const track = tracklist[ti];
    setStatus(
      `Release ${releaseIndex + 1}/${releases.length} • Track ${
        trackIndex + 1
      }/${tracklist.length}`
    );
    setNowPlaying({
      title: track.title,
      artist: track.artist,
      art: releases[ri].art,
    });
    bar.setPosition(0);
    bar.setDuration(track.duration);
    audio.src = track.url;
    audio.dataset.token = String(++playToken);
    try {
      await audio.play();
    } catch (e) {
      console.log("artist player: play failed, skipping", e);
      await autoAdvance(true);
      return;
    }
    updateToggle();
    refreshQueue();
  }

  // Play whatever the pointer aims at, stepping in `dir` past
  // unplayable releases. Returns false when nothing playable remains
  // (or the action was superseded).
  async function playSlot(mySession, dir = 1, toEnd = false) {
    let guard = releases.length + 2;
    while (guard-- > 0) {
      if (mySession !== session) return false;
      const { ri } = pointerSlot();
      if (await ensureRelease(ri)) {
        ensureTrackOrder(ri);
        if (toEnd) {
          const order = trackOrders.get(releases[ri].url) || [];
          if (order.length) posT = order.length - 1;
          toEnd = false;
        }
        if (mySession !== session) return false;
        await playCurrentSlot(mySession);
        return true;
      }
      if (!stepPointer(dir)) break;
    }
    return false;
  }

  async function next() {
    const mySession = ++session;
    if (!started) {
      started = true;
    } else if (!stepPointer(1)) {
      if (repeatMode === "all") {
        posR = 0;
        posT = 0;
      } else {
        endOfQueueUI();
        return;
      }
    }
    const ok = await playSlot(mySession, 1);
    if (!ok && mySession === session) endOfQueueUI();
  }

  async function prev() {
    const mySession = ++session;
    if (audio.currentTime > RESTART_THRESHOLD_SECS) {
      audio.currentTime = 0;
      return;
    }
    if (stepPointer(-1)) {
      const ok = await playSlot(mySession, -1);
      if (!ok && mySession === session) endOfQueueUI();
      return;
    }
    if (repeatMode === "all" && releaseOrder.length) {
      posR = releaseOrder.length - 1;
      posT = 0;
      const ok = await playSlot(mySession, -1, true);
      if (!ok && mySession === session) endOfQueueUI();
      return;
    }
    audio.currentTime = 0;
  }

  async function autoAdvance(skipRepeatOne = false) {
    const mySession = session;
    if (repeatMode === "one" && !skipRepeatOne) {
      try {
        audio.currentTime = 0;
        await audio.play();
        updateToggle();
        return;
      } catch (e) {
        // Replay failed; fall through to advancing.
      }
    }
    if (stepPointer(1)) {
      const ok = await playSlot(mySession, 1);
      if (!ok && mySession === session) endOfQueueUI();
      return;
    }
    if (repeatMode === "all") {
      posR = 0;
      posT = 0;
      const ok = await playSlot(mySession, 1);
      if (!ok && mySession === session) endOfQueueUI();
      return;
    }
    endOfQueueUI();
  }

  function setShuffle(on) {
    shuffleOn = on;
    const curRi = releaseIndex;
    const curTi = trackIndex >= 0 ? trackIndex : 0;
    if (on) {
      releaseOrder = shuffleArray(releases.map((_, i) => i));
      const at = releaseOrder.indexOf(curRi);
      if (at > 0) {
        const t = releaseOrder[0];
        releaseOrder[0] = releaseOrder[at];
        releaseOrder[at] = t;
      }
      posR = 0;
    } else {
      releaseOrder = releases.map((_, i) => i);
      posR = Math.max(0, curRi);
    }
    trackOrders.clear();
    releases.forEach((rel, ri) => {
      const n = (cache.get(rel.url) || []).length;
      if (!n) return;
      let order = [...Array(n).keys()];
      if (on && n > 1) order = shuffleArray(order);
      if (ri === curRi && trackIndex >= 0) {
        const at = order.indexOf(curTi);
        if (at > 0) {
          const t = order[0];
          order[0] = order[at];
          order[at] = t;
        }
      }
      trackOrders.set(rel.url, order);
    });
    const curOrder = trackOrders.get(releases[curRi]?.url);
    posT = curOrder ? Math.max(0, curOrder.indexOf(curTi)) : 0;
    bar.setShuffleActive(on);
    refreshQueue();
  }

  function setRepeatCycle() {
    repeatMode =
      repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    bar.setRepeatMode(repeatMode);
  }

  function toggle() {
    if (!started || (audio.paused && !audio.src)) {
      started = true;
      next();
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    updateToggle();
  }

  function seek(direction) {
    if (!audio.src) return;
    const rate = Number(prefs.seekrate) || 10;
    const target =
      direction === "forward"
        ? audio.currentTime + rate
        : audio.currentTime - rate;
    audio.currentTime = Math.max(
      0,
      Math.min(target, Number.isFinite(audio.duration) ? audio.duration : target)
    );
  }

  function bindKeys() {
    document.addEventListener("keyup", (e) => {
      const controlKeys = [
        prefs.playpause,
        prefs.previous,
        prefs.next,
        prefs.seekback,
        prefs.seekforward,
      ];
      if (controlKeys.indexOf(e.code) === -1) return;
      if (e.target != document.body) return;
      switch (e.code) {
        case prefs.playpause:
          toggle();
          break;
        case prefs.previous:
          prev();
          break;
        case prefs.next:
          next();
          break;
        case prefs.seekback:
          seek("back");
          break;
        case prefs.seekforward:
          seek("forward");
          break;
      }
    });
  }

  audio.addEventListener("ended", () => autoAdvance(false));
  audio.addEventListener("error", () => {
    // Ignore failures from a track that has already been left behind.
    if (audio.dataset.token !== String(playToken)) return;
    console.log("artist player: stream error, skipping to next track");
    autoAdvance(true);
  });
  audio.addEventListener("play", updateToggle);
  audio.addEventListener("pause", updateToggle);
  audio.addEventListener("timeupdate", () => {
    bar.setPosition(audio.currentTime);
  });
  audio.addEventListener("loadedmetadata", () => {
    bar.setDuration(audio.duration);
  });

  bindKeys();
  refreshQueue();
  console.log(`artist player ready: ${releases.length} releases`);
  return true;
}
