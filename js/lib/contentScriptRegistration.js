/**
 * Idempotent dynamic content-script sync for MV3.
 * Prefer getRegistered → update/register/unregister over blind
 * unregister→register, which races and throws "Duplicate script ID"
 * when scripts persist across extension reloads.
 */

const queues = new Map();

function isDuplicateScriptError(err) {
  const message = err?.message || String(err || "");
  return /duplicate script id/i.test(message);
}

function enqueue(scriptId, task) {
  const prev = queues.get(scriptId) || Promise.resolve();
  const result = prev.then(task, task);
  queues.set(
    scriptId,
    result.catch(() => {})
  );
  return result;
}

/**
 * @param {{
 *   id: string,
 *   enabled: boolean,
 *   definition: Omit<chrome.scripting.RegisteredContentScript, "id">,
 * }} options
 */
export function syncRegisteredContentScript({ id, enabled, definition }) {
  return enqueue(id, async () => {
    if (!chrome.scripting?.registerContentScripts) {
      throw new Error("chrome.scripting is unavailable.");
    }

    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [id],
    });
    const isRegistered = existing.length > 0;

    if (!enabled) {
      if (isRegistered) {
        await chrome.scripting.unregisterContentScripts({ ids: [id] });
      }
      return;
    }

    const script = { id, ...definition };

    if (isRegistered) {
      await chrome.scripting.updateContentScripts([script]);
      return;
    }

    try {
      await chrome.scripting.registerContentScripts([script]);
    } catch (err) {
      if (!isDuplicateScriptError(err)) {
        throw err;
      }
      // Registered between get and register (reload race, or persistAcrossSessions).
      await chrome.scripting.updateContentScripts([script]);
    }
  });
}
