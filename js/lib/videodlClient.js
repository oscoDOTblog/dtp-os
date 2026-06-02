/**
 * Client for async video download service (sway-sls Lambda)
 */

import { VIDEO_DL_API_URL } from "./config.js";

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 600000;

export async function startDownload(url, forceH264 = true, format = "mp4") {
  const response = await fetch(`${VIDEO_DL_API_URL}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, force_h264: forceH264, format }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to start download: ${response.status}`);
  }

  return await response.json();
}

export async function getJobStatus(jobId) {
  const response = await fetch(`${VIDEO_DL_API_URL}/status/${jobId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to get status: ${response.status}`);
  }

  return await response.json();
}

export async function getJobResult(jobId) {
  const response = await fetch(`${VIDEO_DL_API_URL}/result/${jobId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 202) {
    const error = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to get result: ${response.status}`);
  }

  return await response.json();
}

export async function pollForCompletion(jobId, onStatus = null) {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    const status = await getJobStatus(jobId);

    if (onStatus) {
      onStatus(status.status);
    }

    if (status.status === "completed") {
      const result = await getJobResult(jobId);
      if (result.url) {
        return {
          url: result.url,
          key: result.key,
          bucket: result.bucket,
        };
      }
      throw new Error("Job completed but no URL returned");
    }

    if (status.status === "failed") {
      const result = await getJobResult(jobId);
      throw new Error(result.error || "Download failed");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Polling timeout exceeded");
}

/**
 * @param {string} url
 * @param {boolean} [forceH264=true]
 * @param {(status: string) => void} [onProgress]
 * @param {string} [format='mp4']
 * @returns {Promise<{ url: string, downloadUrl: string, key?: string, bucket?: string }>}
 */
export async function downloadVideoAsync(
  url,
  forceH264 = true,
  onProgress = null,
  format = "mp4"
) {
  try {
    if (onProgress) onProgress("starting");
    const { jobId } = await startDownload(url, forceH264, format);

    if (onProgress) onProgress("processing");
    const result = await pollForCompletion(jobId, (status) => {
      if (onProgress) onProgress(status);
    });

    const { url: downloadUrl, key, bucket } = result;

    if (onProgress) onProgress("completed");
    return { url: downloadUrl, downloadUrl, key, bucket };
  } catch (error) {
    if (onProgress) onProgress("error");
    throw error;
  }
}
