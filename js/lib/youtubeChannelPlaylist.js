const CHANNEL_ID_PATTERN = "UC[\\w-]{22}";

const EXTRACTION_PATTERNS = [
  new RegExp(`"channelId"\\s*:\\s*"(${CHANNEL_ID_PATTERN})"`),
  new RegExp(`"externalId"\\s*:\\s*"(${CHANNEL_ID_PATTERN})"`),
  new RegExp(`"browseId"\\s*:\\s*"(${CHANNEL_ID_PATTERN})"`),
  new RegExp(`/channel/(${CHANNEL_ID_PATTERN})`),
  new RegExp(`^(${CHANNEL_ID_PATTERN})$`),
];

const CHANNEL_ID_ONLY = new RegExp(`^${CHANNEL_ID_PATTERN}$`);

/**
 * Extract a YouTube channel ID (UC + 22 chars) from page source, URL, or raw ID.
 * @param {string} input
 * @returns {string|null}
 */
export function extractChannelId(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;

  for (const pattern of EXTRACTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) return match[1];
  }

  const fallback = trimmed.match(new RegExp(CHANNEL_ID_PATTERN));
  return fallback ? fallback[0] : null;
}

/**
 * Build the uploads playlist URL by changing UC prefix to UU.
 * @param {string} channelId
 * @returns {string}
 */
export function toUploadsPlaylistUrl(channelId) {
  if (!CHANNEL_ID_ONLY.test(channelId)) {
    throw new Error(
      "Invalid channel ID. Expected 24 characters starting with UC."
    );
  }

  const playlistId = `UU${channelId.slice(2)}`;
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

const NOT_FOUND_MESSAGE =
  'Could not find a channel ID. Paste View Page Source from the channel page, a /channel/UC... URL, or a channel ID starting with UC. @handles alone cannot be converted.';

/**
 * @param {string} input
 * @returns {{ channelId: string, playlistUrl: string }}
 */
export function buildUploadsPlaylistFromInput(input) {
  const channelId = extractChannelId(input);
  if (!channelId) {
    throw new Error(NOT_FOUND_MESSAGE);
  }

  return {
    channelId,
    playlistUrl: toUploadsPlaylistUrl(channelId),
  };
}
