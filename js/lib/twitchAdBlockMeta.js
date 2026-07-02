export const TWITCH_AD_BLOCK_UPSTREAM =
  "https://github.com/ryanbr/TwitchAdSolutions";

export const TWITCH_AD_BLOCK_RELEASES_URL =
  "https://github.com/ryanbr/TwitchAdSolutions/releases";

export const VENDORED_VERSION = "v68.4.0";

export const VENDORED_DATE = "2026-06-06";

export function formatVendoredDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
