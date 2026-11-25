import {
  getApplyCopilotSettings,
  saveApplyCopilotSettings,
} from "./lib/applyCopilotSettings.js";

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textField = document.createElement("textarea");
  textField.value = text;
  textField.style.position = "fixed";
  textField.style.opacity = "0";
  document.body.appendChild(textField);
  textField.select();
  document.execCommand("copy");
  document.body.removeChild(textField);
}

function versionUrl(cdpUrl) {
  const base = String(cdpUrl || "").replace(/\/$/, "");
  return `${base}/json/version`;
}

async function probeCdp(cdpUrl) {
  const url = versionUrl(cdpUrl);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Apply Copilot CDP setup — probe localhost DevTools, copy relaunch command.
 * @returns {() => void} cleanup
 */
export function mountApplyCopilotTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel apply-copilot-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.textContent =
    "Attach Apply Copilot to your normal Chrome session. Chrome must be restarted once with remote debugging — it cannot be enabled on an already-running window.";

  const statusRow = document.createElement("div");
  statusRow.className = "apply-copilot-status-row";

  const statusBadge = document.createElement("span");
  statusBadge.className = "apply-copilot-badge apply-copilot-badge-unknown";
  statusBadge.textContent = "Checking…";

  const statusDetail = document.createElement("p");
  statusDetail.className = "apply-copilot-status-detail";
  statusDetail.textContent = "";

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "tool-btn";
  refreshBtn.textContent = "Refresh";

  statusRow.appendChild(statusBadge);
  statusRow.appendChild(refreshBtn);

  const steps = document.createElement("ol");
  steps.className = "apply-copilot-steps";
  steps.innerHTML = `
    <li>Run the relaunch script (quits and restarts Chrome with DevTools on :9222).</li>
    <li>Confirm status shows <strong>Ready</strong> below.</li>
    <li>Start the CV agent with <code>CV_AGENT_CDP_URL</code> pointing at that endpoint.</li>
    <li>Use Copilot as usual — the agent attaches; it will not quit Chrome when a run ends.</li>
  `;

  const warn = document.createElement("p");
  warn.className = "apply-copilot-warn";
  warn.textContent =
    "Security: localhost CDP gives full control of that Chrome. Keep the port on 127.0.0.1 only.";

  const cdpLabel = document.createElement("label");
  cdpLabel.className = "tool-label";
  cdpLabel.htmlFor = "apply-copilot-cdp-url";
  cdpLabel.textContent = "CDP URL";

  const cdpInput = document.createElement("input");
  cdpInput.id = "apply-copilot-cdp-url";
  cdpInput.className = "tool-input";
  cdpInput.type = "url";
  cdpInput.autocomplete = "off";

  const scriptLabel = document.createElement("label");
  scriptLabel.className = "tool-label";
  scriptLabel.htmlFor = "apply-copilot-script-path";
  scriptLabel.textContent = "Relaunch script path";

  const scriptInput = document.createElement("input");
  scriptInput.id = "apply-copilot-script-path";
  scriptInput.className = "tool-input";
  scriptInput.type = "text";
  scriptInput.autocomplete = "off";

  const actions = document.createElement("div");
  actions.className = "apply-copilot-actions";

  const copyCmdBtn = document.createElement("button");
  copyCmdBtn.type = "button";
  copyCmdBtn.className = "tool-btn tool-btn-primary tool-btn-block";
  copyCmdBtn.textContent = "Copy relaunch command";

  const copyUrlBtn = document.createElement("button");
  copyUrlBtn.type = "button";
  copyUrlBtn.className = "tool-btn tool-btn-block";
  copyUrlBtn.textContent = "Copy CDP URL";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "tool-btn tool-btn-block";
  saveBtn.textContent = "Save paths";

  actions.appendChild(copyCmdBtn);
  actions.appendChild(copyUrlBtn);
  actions.appendChild(saveBtn);

  panel.appendChild(desc);
  panel.appendChild(statusRow);
  panel.appendChild(statusDetail);
  panel.appendChild(steps);
  panel.appendChild(warn);
  panel.appendChild(cdpLabel);
  panel.appendChild(cdpInput);
  panel.appendChild(scriptLabel);
  panel.appendChild(scriptInput);
  panel.appendChild(actions);
  container.appendChild(panel);

  let pollTimer = null;
  let disposed = false;

  function setStatus(kind, detail) {
    statusBadge.className = `apply-copilot-badge apply-copilot-badge-${kind}`;
    if (kind === "ready") statusBadge.textContent = "Ready";
    else if (kind === "down") statusBadge.textContent = "Not listening";
    else statusBadge.textContent = "Checking…";
    statusDetail.textContent = detail || "";
  }

  async function refreshStatus() {
    if (disposed) return;
    const cdpUrl = cdpInput.value.trim() || "http://127.0.0.1:9222";
    setStatus("unknown", `Probing ${versionUrl(cdpUrl)}…`);
    try {
      const body = await probeCdp(cdpUrl);
      if (disposed) return;
      const browser = body.Browser || body.browser || "Chrome";
      const ws = body.webSocketDebuggerUrl || "";
      setStatus(
        "ready",
        ws ? `${browser} — ${ws}` : `${browser} — DevTools OK`
      );
    } catch (err) {
      if (disposed) return;
      setStatus(
        "down",
        `Not ready (${err.message || err}). Run the relaunch script, then Refresh.`
      );
    }
  }

  async function persistFields() {
    await saveApplyCopilotSettings({
      cdpUrl: cdpInput.value.trim(),
      scriptPath: scriptInput.value.trim(),
    });
  }

  copyCmdBtn.addEventListener("click", async () => {
    const scriptPath = scriptInput.value.trim();
    const cmd = `bash "${scriptPath}"`;
    try {
      await copyText(cmd);
      showToast("Relaunch command copied");
    } catch {
      showToast("Copy failed", true);
    }
  });

  copyUrlBtn.addEventListener("click", async () => {
    try {
      await copyText(cdpInput.value.trim() || "http://127.0.0.1:9222");
      showToast("CDP URL copied");
    } catch {
      showToast("Copy failed", true);
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      await persistFields();
      showToast("Saved");
      await refreshStatus();
    } catch {
      showToast("Save failed", true);
    }
  });

  refreshBtn.addEventListener("click", () => {
    refreshStatus();
  });

  getApplyCopilotSettings().then((settings) => {
    if (disposed) return;
    cdpInput.value = settings.cdpUrl;
    scriptInput.value = settings.scriptPath;
    refreshStatus();
    pollTimer = setInterval(() => {
      refreshStatus();
    }, 4000);
  });

  return () => {
    disposed = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
