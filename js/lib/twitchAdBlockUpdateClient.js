import { VENDORED_VERSION } from "./twitchAdBlockMeta.js";

const RELEASES_URL =
  "https://api.github.com/repos/ryanbr/TwitchAdSolutions/releases/latest";

function parseVersionSegments(version) {
  return String(version)
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareSemver(left, right) {
  const leftParts = parseVersionSegments(left);
  const rightParts = parseVersionSegments(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export async function checkForVaftUpdate() {
  const response = await fetch(RELEASES_URL, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not reach GitHub.");
  }

  const data = await response.json();
  const latest = data.tag_name;

  if (!latest) {
    throw new Error("GitHub response did not include a release tag.");
  }

  return {
    latest,
    current: VENDORED_VERSION,
    isNewer: compareSemver(latest, VENDORED_VERSION) > 0,
    releaseUrl: data.html_url ?? "https://github.com/ryanbr/TwitchAdSolutions/releases",
  };
}
