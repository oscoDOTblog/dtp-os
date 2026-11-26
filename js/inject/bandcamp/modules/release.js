/**
 * dtp-os addition (no upstream equivalent): dtp-tunes-style player bar for
 * release pages (/album/ + /track/).
 *
 * Unlike the artist backend, this drives Bandcamp's own native player
 * instead of a separate Audio element: transport clicks the page's
 * `.playbutton` / `.prevbutton` / `.nextbutton`, seeks through the
 * player's `seek()`, and reads position/duration from the page's own
 * `.time_elapsed` / `.time_total` spans. No second audio pipeline, so the
 * native controls and the bar can never play over each other.
 *
 * Track metadata comes from the release embed. On albums, the tab title
 * identifies the current track. Shuffle jumps through row play links
 * in a shuffled order with a pause-then-jump preempt so the native player
 * doesn't auto-advance down the page order first; repeat-one seeks back to
 * zero just before the end; repeat-all restarts the release when playback
 * is observed stopping at the end.
 *
 * No volume slider here: Bandcamp's release bundle exposes no volume API
 * (verified against the shipped `tralbum-*` bundle).
 */

import { createPlayerBar, formatTime, sanitizeFilename } from "./bar.js";

const PLAYER_BAR_ID = "dtp-player-bar";
const POLL_MS = 500;

function parseTimeText(str) {
  const parts = (str || "").trim().split(":");
  if (
    parts.length === 0 ||
    parts.some((p) => p === "" || Number.isNaN(Number(p)))
  ) {
    return 0;
  }
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// Bandcamp keeps the tab title current (`▶︎ Track | …`) on both album and
// single-track pages, where the inline title span may still be empty.
function tabTrackTitle() {
  const t = document.title.replace(/^▶[\uFE0E\uFE0F]?\s*/, "");
  const pipe = t.indexOf(" | ");
  return ((pipe === -1 ? t : t.slice(0, pipe)) || "").trim();
}

function fallbackTitle() {
  const el =
    document.querySelector("#trackInfoInner a.primaryText") ||
    document.querySelector("#trackInfoInner .title");
  return (el && el.textContent.trim()) || "";
}

function readReleaseData() {
  try {
    return JSON.parse(document.querySelector("[data-tralbum]")?.getAttribute("data-tralbum")) || {};
  } catch {
    return {};
  }
}

function stripArtistSuffix(title, artist) {
  if (!artist) return title;
  const suffix = [` by ${artist}`, ` - ${artist}`].find((s) => title.endsWith(s));
  return suffix ? title.slice(0, -suffix.length) : title;
}

function elapsedSecs() {
  return parseTimeText(document.querySelector(".time_elapsed")?.textContent);
}

function totalSecs() {
  return parseTimeText(document.querySelector(".time_total")?.textContent);
}

function isPlaying() {
  // Bandcamp adds/removes a ▶︎ in the tab title on play/pause.
  return (window.document.title || "").includes("▶");
}

// Full tracklist straight from the page's track table rows
// (absent on single-track pages).
function pageTracks() {
  return [...document.querySelectorAll("#track_table tr.track_row_view")].map(
    (row) => ({
      title:
        row.querySelector(".track-title")?.textContent.trim() || "Untitled",
      duration: parseTimeText(
        row.querySelector(".time.secondaryText")?.textContent
      ),
    })
  );
}

export function initReleasePage(albumplayer) {
  if (document.getElementById(PLAYER_BAR_ID)) return true;
  if (!document.querySelector(".playbutton")) return false;

  const release = readReleaseData();
  const tracks = release.trackinfo || [];
  const pageArt = document.querySelector("#tralbumArt img");
  const art = pageArt?.currentSrc || pageArt?.src || "";
  const pageArtist = document.querySelector("#band-name-location .title")?.textContent.trim() || "";
  const artist = release.artist || pageArtist;
  const singleTrack = release.current?.type === "track" &&
    tracks.find((track) => track.track_id === release.current.id);

  function cleanTabTitle(title) {
    return stripArtistSuffix(stripArtistSuffix(title, artist), pageArtist);
  }

  function currentTrack() {
    if (singleTrack) return singleTrack;
    const tabTitle = tabTrackTitle();
    const candidates = [tabTitle, cleanTabTitle(tabTitle), fallbackTitle()];
    for (const title of candidates) {
      const track = tracks.find((entry) => entry.title === title);
      if (track) return track;
    }
    return null;
  }

  function currentTitle() {
    return currentTrack()?.title || cleanTabTitle(tabTrackTitle() || fallbackTitle());
  }

  let rShuffle = false;
  let rRepeat = "off"; // off | all | one
  let rOrder = null; // shuffled row order, or null (= page order)
  let rPos = 0;
  let lastPlayingAt = 0;
  let lastJumpAt = 0;

  const clickNative = (selector) => {
    const el = document.querySelector(selector);
    if (el) el.click();
  };

  function jumpToRow(i) {
    const links = document.querySelectorAll(
      "#track_table tr.track_row_view .play-col > a"
    );
    if (links[i]) {
      lastJumpAt = Date.now();
      links[i].click();
    }
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

  function streamUrlOf(track) {
    const file = track?.file || {};
    return (
      file["mp3-128"] ||
      Object.values(file).find(
        (value) => typeof value === "string" && value.startsWith("https://")
      )
    );
  }

  // Build the download message body for one track. `folder` nests it under
  // "Artist - Album/NN - Title.mp3" (album batch only; single downloads
  // keep landing as "Artist - Title.mp3").
  function trackDownloadPayload(track, { folder = false } = {}) {
    const url = streamUrlOf(track);
    if (!url) return null;
    const title = track.title || "track";
    const current = release.current || {};
    const album = release.album_title || cleanTabTitle(current.title || "");
    const num = track.track_num || tracks.indexOf(track) + 1;
    let filename;
    if (folder && album) {
      const dir = sanitizeFilename(artist ? `${artist} - ${album}` : album);
      filename = `${dir}/${sanitizeFilename(
        `${String(num).padStart(2, "0")} - ${title}`
      )}.mp3`;
    } else {
      filename = sanitizeFilename(`${artist ? artist + " - " : ""}${title}.mp3`);
    }
    return {
      url,
      filename,
      tags: {
        title,
        artist,
        album,
        year: yearFrom(release.album_release_date || current.release_date),
        art: fullArtUrl(release.art_id || current.art_id) || art,
        num,
        total: tracks.length,
      },
    };
  }

  // The ISOLATED relay echoes per-request results back tagged with reqId
  // (see bandcampLoader.global.js); resolves null on failure/timeout, else
  // { ok, url? } — url is the staged blob for album zip staging.
  function waitForDownloadResult(reqId, timeoutMs = 90000) {
    return new Promise((resolve) => {
      const finish = (result) => {
        window.removeEventListener("message", onResult);
        clearTimeout(timer);
        resolve(result);
      };
      const onResult = (event) => {
        if (
          event.source === window &&
          event.data?.type === "dtp-bandcamp-download-result" &&
          event.data.reqId === reqId
        ) {
          finish({
            ok: Boolean(event.data.ok),
            url: event.data.url,
            error: event.data.error,
          });
        }
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      window.addEventListener("message", onResult);
    });
  }

  // Byte-progress pings from the offscreen document (relayed through the
  // service worker + loader) for the track currently being staged, so the
  // strip moves within a track instead of jumping per finished track.
  let activeStage = null;
  window.addEventListener("message", (event) => {
    const d = event.data;
    if (
      event.source === window &&
      d?.type === "dtp-bandcamp-stage-progress" &&
      activeStage &&
      d.reqId === activeStage.reqId
    ) {
      activeStage.loaded = d.loaded;
      if (d.total) activeStage.total = d.total;
    }
  });

  function mkReqId() {
    return `dtp-dl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  let downloadBusy = false;

  async function downloadCurrent() {
    if (downloadBusy) return;
    const payload = trackDownloadPayload(currentTrack());
    if (!payload) {
      console.warn("Bandcamp download unavailable for the current track");
      bar.setStatus("Download unavailable");
      return;
    }
    downloadBusy = true;
    bar.setDownloadProgress({ active: true });
    const reqId = mkReqId();
    window.postMessage(
      { type: "dtp-bandcamp-download", reqId, ...payload },
      "*"
    );
    const result = await waitForDownloadResult(reqId);
    downloadBusy = false;
    bar.setDownloadProgress({ active: false });
    if (result && !result.ok) {
      bar.setStatus("Track download failed");
    }
  }

  // Album = whole release as one zip: stage each tagged track in the
  // offscreen document (no downloads yet), then hand the blob list back
  // for a single zip download. Progress steps per staged track, then the
  // button keeps spinning while the zip is built.
  async function downloadAlbum() {
    if (downloadBusy) return;
    const payloads = tracks
      .map((track) => trackDownloadPayload(track, { folder: true }))
      .filter(Boolean);
    if (!payloads.length) {
      console.warn("Bandcamp album download unavailable: no stream URLs exposed");
      bar.setStatus("Album download unavailable");
      return;
    }
    downloadBusy = true;
    const entries = [];
    let failed = 0;
    for (let i = 0; i < payloads.length; i++) {
      const reqId = mkReqId();
      activeStage = { reqId, loaded: 0, total: 0 };
      const report = () => {
        const frac =
          activeStage.total > 0
            ? Math.min(1, activeStage.loaded / activeStage.total)
            : 0;
        bar.setDownloadProgress({
          active: true,
          done: i,
          total: payloads.length,
          failed,
          pct: ((i + frac) / payloads.length) * 100,
        });
      };
      report();
      window.postMessage(
        { type: "dtp-bandcamp-stage-mp3", reqId, ...payloads[i] },
        "*"
      );
      const result = await waitForDownloadResult(reqId);
      activeStage = null;
      if (result?.ok && result.url) {
        entries.push({
          url: result.url,
          name: payloads[i].filename.split("/").pop(),
        });
      } else {
        failed++;
        bar.setStatus(`Track ${i + 1} failed: ${result?.error || "timed out"}`);
      }
      bar.setDownloadProgress({
        active: true,
        done: i + 1,
        total: payloads.length,
        failed,
      });
    }
    const album = release.album_title || cleanTabTitle(release.current?.title || "");
    let ok = false;
    if (entries.length) {
      bar.setStatus("Building album zip…");
      const reqId = mkReqId();
      window.postMessage(
        {
          type: "dtp-bandcamp-download-zip",
          reqId,
          filename: `${sanitizeFilename(
            `${artist ? artist + " - " : ""}${album || "bandcamp"}`
          )}.zip`,
          entries,
          cover: fullArtUrl(release.art_id || release.current?.art_id) || art,
        },
        "*"
      );
      const result = await waitForDownloadResult(reqId);
      ok = Boolean(result?.ok);
    }
    downloadBusy = false;
    // Let the 100% fill register before removing the strip.
    setTimeout(() => bar.setDownloadProgress({ active: false }), 600);
    bar.setStatus(
      `Album download finished${
        entries.length ? (ok ? `: ${album}` : " (zip failed)") : ""
      }${failed ? ` — ${failed} track(s) skipped` : ""}`
    );
  }

  function manualStep(dir) {
    const rows = pageTracks();
    if (!rShuffle || !rows.length) {
      clickNative(dir < 0 ? ".prevbutton" : ".nextbutton");
      return;
    }
    let p = rPos + dir;
    if (p < 0 || p >= rOrder.length) {
      if (rRepeat !== "all") return;
      p = dir > 0 ? 0 : rOrder.length - 1;
    }
    rPos = p;
    jumpToRow(rOrder[p]);
  }

  function setReleaseShuffle(on) {
    rShuffle = on;
    const rows = pageTracks();
    const cur = Math.max(
      0,
      rows.findIndex((t) => t.title && t.title === currentTitle())
    );
    if (on && rows.length > 1) {
      rOrder = shuffleArray(rows.map((_, i) => i));
      const at = rOrder.indexOf(cur);
      if (at > 0) {
        const t = rOrder[0];
        rOrder[0] = rOrder[at];
        rOrder[at] = t;
      }
      rPos = 0;
    } else {
      rOrder = null;
      rPos = cur;
    }
    bar.setShuffleActive(on);
  }

  function setReleaseRepeatCycle() {
    rRepeat = rRepeat === "off" ? "all" : rRepeat === "all" ? "one" : "off";
    bar.setRepeatMode(rRepeat);
  }

  const bar = createPlayerBar({
    idleLabel: "Play this release",
    showVolume: false,
    onToggle: () => clickNative(".playbutton"),
    onPrev: () => manualStep(-1),
    onNext: () => manualStep(1),
    onSeek: (value) => {
      try {
        albumplayer.seek(Math.floor(value));
      } catch (e) {
        console.log("release player: seek failed", e);
      }
    },
    onQueueJump: (i) => {
      const rows = pageTracks();
      if (!rows.length) return;
      const order = rShuffle && rOrder ? rOrder : rows.map((_, n) => n);
      if (i < 0 || i >= order.length) return;
      if (rShuffle) rPos = i;
      jumpToRow(order[i]);
    },
    onShuffle: () => setReleaseShuffle(!rShuffle),
    onRepeat: () => setReleaseRepeatCycle(),
    onDownload: downloadCurrent,
    // Album zip download only makes sense on album pages (not /track/),
    // and only when the release exposes more than one track.
    onDownloadAlbum:
      !singleTrack && tracks.length > 1 ? downloadAlbum : undefined,
  });
  document.body.appendChild(bar.element);

  setInterval(() => {
    const playing = isPlaying();
    if (playing) lastPlayingAt = Date.now();
    const total = totalSecs();
    const elapsed = elapsedSecs();
    const title = currentTitle();
    // Before first play the tab title holds the release (not track) name,
    // so only show a track once playback has measurably started.
    const show = title !== "" && (playing || elapsed > 0 || total > 0);
    bar.setTrack(show ? { title, artist, art } : null);
    bar.setPosition(elapsed);
    if (total > 0) bar.setDuration(total);
    bar.setPlaying(playing);

    const rows = pageTracks();
    const order =
      rShuffle && rOrder && rOrder.length === rows.length
        ? rOrder
        : rows.map((_, i) => i);

    if (rows.length) {
      // Re-anchor the shuffle pointer when the page moved on its own
      // (user clicked a row, or a preempt was missed under throttling).
      // Never yank playback back: the pointer follows, it doesn't lead.
      const curIdx = title
        ? rows.findIndex((t) => t.title && t.title === title)
        : -1;
      if (
        rShuffle &&
        curIdx !== -1 &&
        curIdx !== order[rPos] &&
        Date.now() - lastJumpAt > 2000
      ) {
        const p = order.indexOf(curIdx);
        if (p !== -1) rPos = p;
      }

      // Repeat-one: seek back just before the end so the track never turns.
      if (rRepeat === "one" && playing && total > 0 && total - elapsed < 1.0) {
        try {
          albumplayer.seek(0);
        } catch (e) {}
        return;
      }
      // Shuffle preempt: pause before the native player would advance down
      // page order, then jump the shuffled next track.
      if (
        rShuffle &&
        playing &&
        total > 0 &&
        total - elapsed < 1.0
      ) {
        const last = rPos >= order.length - 1;
        if (!last || rRepeat === "all") {
          clickNative(".playbutton");
          rPos = last ? 0 : rPos + 1;
          jumpToRow(order[rPos]);
        }
        // Repeat-all without shuffle: restart once playback is observed
        // stopping at the very end (recency guard ignores an old pause).
      } else if (
        !rShuffle &&
        rRepeat === "all" &&
        !playing &&
        total > 0 &&
        elapsed >= total - 1.0 &&
        Date.now() - lastPlayingAt < 2500
      ) {
        jumpToRow(0);
      }

      bar.setQueue(
        order.map((rowIdx) => ({
          title: rows[rowIdx].title,
          subtitle:
            rows[rowIdx].duration > 0
              ? formatTime(rows[rowIdx].duration)
              : "",
        })),
        rShuffle ? rPos : curIdx
      );
    } else if (title) {
      // Single-track page: no table, so the queue is just this track.
      bar.setQueue(
        [{ title, subtitle: total > 0 ? formatTime(total) : "" }],
        0
      );
    } else {
      bar.setQueue([], -1);
    }
  }, POLL_MS);

  console.log("release player ready");
  return true;
}
