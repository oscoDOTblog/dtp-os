import { setLastTool, TOOLS } from "./toolSettings.js";

function convertCommand(command) {
  const trimmed = command.trim();

  if (!trimmed.startsWith("docker run")) {
    throw new Error('Command must start with "docker run"');
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length < 3) {
    throw new Error("Invalid docker command format");
  }

  if (parts[0] !== "docker" || parts[1] !== "run") {
    throw new Error('Command must start with "docker run"');
  }

  return [
    parts[0],
    parts[1],
    "-d",
    "--restart",
    "unless-stopped",
    ...parts.slice(2),
  ].join(" ");
}

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

export function mountCloudflareDockerTool(container, { showToast }) {
  const panel = document.createElement("div");
  panel.className = "tool-form-panel";

  const desc = document.createElement("p");
  desc.className = "tool-form-desc";
  desc.innerHTML =
    'Paste your Cloudflare docker command below to add <code>-d --restart unless-stopped</code> flags.';

  const inputLabel = document.createElement("label");
  inputLabel.className = "tool-label";
  inputLabel.htmlFor = "docker-input";
  inputLabel.textContent = "Docker Command";

  const input = document.createElement("textarea");
  input.id = "docker-input";
  input.className = "tool-textarea";
  input.rows = 3;
  input.placeholder =
    "docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ...";

  const outputWrap = document.createElement("div");
  outputWrap.className = "tool-outputs";
  outputWrap.hidden = true;

  const outputLabel = document.createElement("label");
  outputLabel.className = "tool-label";
  outputLabel.htmlFor = "docker-output";
  outputLabel.textContent = "Converted Command";

  const output = document.createElement("textarea");
  output.id = "docker-output";
  output.className = "tool-output";
  output.rows = 3;
  output.readOnly = true;

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "tool-btn tool-btn-primary";
  copyBtn.textContent = "Copy to Clipboard";

  const errorEl = document.createElement("div");
  errorEl.className = "tool-error";
  errorEl.hidden = true;

  outputWrap.appendChild(outputLabel);
  outputWrap.appendChild(output);
  outputWrap.appendChild(copyBtn);

  panel.appendChild(desc);
  panel.appendChild(inputLabel);
  panel.appendChild(input);
  panel.appendChild(outputWrap);
  panel.appendChild(errorEl);
  container.appendChild(panel);

  let outputCommand = "";

  function handleInput() {
    const value = input.value;
    errorEl.hidden = true;
    errorEl.textContent = "";
    copyBtn.textContent = "Copy to Clipboard";

    if (!value.trim()) {
      outputWrap.hidden = true;
      outputCommand = "";
      output.value = "";
      return;
    }

    try {
      outputCommand = convertCommand(value);
      output.value = outputCommand;
      outputWrap.hidden = false;
      setLastTool(TOOLS.CLOUDFLARE_DOCKER);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      outputWrap.hidden = true;
      outputCommand = "";
      output.value = "";
    }
  }

  async function handleCopy() {
    if (!outputCommand) return;
    try {
      await copyText(outputCommand);
      copyBtn.textContent = "✓ Copied!";
      showToast("Copied!");
      setTimeout(() => {
        copyBtn.textContent = "Copy to Clipboard";
      }, 2000);
    } catch {
      errorEl.textContent = "Failed to copy to clipboard";
      errorEl.hidden = false;
    }
  }

  input.addEventListener("input", handleInput);
  copyBtn.addEventListener("click", handleCopy);

  input.focus();

  return () => {
    input.removeEventListener("input", handleInput);
    copyBtn.removeEventListener("click", handleCopy);
  };
}
