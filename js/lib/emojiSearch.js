export function normalizeEmojiQuery(query) {
  return String(query ?? "")
    .trim()
    .toLowerCase();
}

export function matchesEmoji(entry, query) {
  if (!query) {
    return true;
  }
  if (entry.emoji.includes(query)) {
    return true;
  }
  return entry.keywords.some((keyword) => keyword.includes(query));
}

export function filterEmojis(list, query, limit = Infinity) {
  const normalized = normalizeEmojiQuery(query);
  const results = [];

  for (const entry of list) {
    if (!matchesEmoji(entry, normalized)) {
      continue;
    }
    results.push(entry);
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
