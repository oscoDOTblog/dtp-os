const OFFSCREEN_PAGE = "bandcamp-download.html";
let offscreenSetup;

function ensureOffscreenPage() {
  offscreenSetup ??= (async () => {
    const url = chrome.runtime.getURL(OFFSCREEN_PAGE);
    const documents = chrome.runtime.getContexts
      ? await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
          documentUrls: [url],
        })
      : await self.clients.matchAll();
    if (!documents.some((doc) => (doc.documentUrl || doc.url) === url)) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PAGE,
        reasons: ["BLOBS"],
        justification: "Create a downloadable MP3 with Bandcamp track metadata.",
      });
    }
  })().finally(() => {
    offscreenSetup = undefined;
  });
  return offscreenSetup;
}

function isBandcampUrl(value, allowCdn = false) {
  if (typeof value !== "string") return false;
  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== "https:" && (allowCdn || protocol !== "http:")) return false;
    return hostname === "bandcamp.com" ||
      hostname.endsWith(".bandcamp.com") ||
      (allowCdn && hostname.endsWith(".bcbits.com"));
  } catch {
    return false;
  }
}

export async function downloadBandcampTrack({ url, filename, tags }, sender) {
  if (!sender.tab || !isBandcampUrl(sender.url) || !isBandcampUrl(url, true)) {
    throw new Error("Invalid Bandcamp download source");
  }
  const options = {
    url,
    filename: typeof filename === "string" && filename ? filename : "bandcamp.mp3",
    saveAs: false,
  };
  if (tags?.title || tags?.art) {
    try {
      await ensureOffscreenPage();
      const tagged = await chrome.runtime.sendMessage({
        type: "dtp-bandcamp-tag-mp3",
        url,
        tags: { ...tags, art: isBandcampUrl(tags.art, true) ? tags.art : "" },
      });
      if (!tagged?.url?.startsWith(`blob:${chrome.runtime.getURL("")}`)) {
        throw new Error(tagged?.error || "No tagged MP3 was generated");
      }
      return await chrome.downloads.download({ ...options, url: tagged.url });
    } catch (err) {
      console.warn("Bandcamp tagged download failed, retrying raw:", err.message);
    }
  }
  return chrome.downloads.download(options);
}

function validBlobUrl(url) {
  return (
    typeof url === "string" && url.startsWith(`blob:${chrome.runtime.getURL("")}`)
  );
}

// Album ZIP flow step 1: tag a track in the offscreen document and keep the
// staged blob URL around instead of starting a download. The page collects
// these and hands the full list back via downloadBandcampZip.
export async function stageBandcampTrack({ url, tags, reqId }, sender) {
  if (!sender.tab || !isBandcampUrl(sender.url) || !isBandcampUrl(url, true)) {
    throw new Error("Invalid Bandcamp download source");
  }
  await ensureOffscreenPage();
  const tagged = await chrome.runtime.sendMessage({
    type: "dtp-bandcamp-tag-mp3",
    url,
    keep: true,
    reqId,
    tabId: sender.tab.id,
    tags: { ...tags, art: isBandcampUrl(tags.art, true) ? tags.art : "" },
  });
  if (!validBlobUrl(tagged?.url)) {
    throw new Error(tagged?.error || "No tagged MP3 was generated");
  }
  return tagged.url;
}

// Entry names live inside the zip: flat files only, no traversal.
function safeEntryName(name) {
  return typeof name === "string" &&
    name.length > 0 &&
    name.length <= 180 &&
    !/[\\/:]/.test(name) &&
    name !== "." &&
    name !== ".."
    ? name
    : "";
}

// Album ZIP flow step 2: hand the staged blob URLs to the offscreen
// document, which builds one zip blob for a single Chrome download.
export async function downloadBandcampZip({ filename, entries, cover }, sender) {
  if (!sender.tab || !isBandcampUrl(sender.url)) {
    throw new Error("Invalid Bandcamp download source");
  }
  const clean = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({ url: entry?.url, name: safeEntryName(entry?.name) }))
    .filter((entry) => validBlobUrl(entry.url) && entry.name);
  if (!clean.length) {
    throw new Error("No staged tracks to zip");
  }
  const coverUrl =
    typeof cover === "string" && isBandcampUrl(cover, true) ? cover : "";
  await ensureOffscreenPage();
  const zipped = await chrome.runtime.sendMessage({
    type: "dtp-bandcamp-zip-blobs",
    entries: clean,
    cover: coverUrl,
  });
  if (!validBlobUrl(zipped?.url)) {
    throw new Error(zipped?.error || "No zip was generated");
  }
  return chrome.downloads.download({
    url: zipped.url,
    filename:
      typeof filename === "string" && filename ? filename : "bandcamp.zip",
    saveAs: false,
  });
}
