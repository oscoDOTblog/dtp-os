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
