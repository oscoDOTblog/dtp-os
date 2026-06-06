import {
  getAppName,
  getBrandingEnabled,
  getCustomGreetingsJson,
  setAppName,
  setBrandingEnabled,
  setCustomGreetingsJson,
} from "./appSettings.js";

const GREETINGS_HELP_ID = "custom-greetings-help";

const AI_GREETINGS_PROMPT = `Convert these quotes into a valid JSON array of strings for a browser extension. One quote per array item, double-quoted, comma-separated, no trailing comma. Output only the JSON, nothing else:

[paste your quotes here, one per line]`;

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

function createGreetingsHelpPanel(helpId) {
  const helpPanel = document.createElement("div");
  helpPanel.id = helpId;
  helpPanel.className = "settings-help-panel";
  helpPanel.hidden = true;
  helpPanel.setAttribute("role", "region");
  helpPanel.setAttribute("aria-label", "How to format custom greetings");
  helpPanel.innerHTML = `
    <h3>JSON array format</h3>
    <p>Custom greetings must be a JSON <strong>array of strings</strong>. Each string is one quote shown on your new tab.</p>
    <h3>Example</h3>
    <pre class="settings-help-code">[
  "Let's build something great.",
  "You've got this.",
  "Make today count."
]</pre>
    <h3>Tips</h3>
    <ol>
      <li>Wrap the list in square brackets <code>[ ]</code>.</li>
      <li>Put each quote in double quotes, separated by commas.</li>
      <li>Use a backslash before quotes inside a quote: <code>"Say \\"hello\\""</code></li>
      <li>Leave the field blank to use 105 built-in rotating messages.</li>
    </ol>
    <h3>Have a list of quotes?</h3>
    <p>Paste your quotes into ChatGPT, Claude, or any AI chat and ask it to format them. Copy the result into the field above.</p>
  `;

  const promptHeader = document.createElement("div");
  promptHeader.className = "settings-help-prompt-header";

  const promptLabel = document.createElement("p");
  promptLabel.className = "settings-help-prompt-label";
  promptLabel.textContent = "Suggested prompt:";

  const copyPromptBtn = document.createElement("button");
  copyPromptBtn.type = "button";
  copyPromptBtn.className = "settings-help-copy-btn";
  copyPromptBtn.textContent = "Copy prompt";

  promptHeader.append(promptLabel, copyPromptBtn);

  const promptPre = document.createElement("pre");
  promptPre.className = "settings-help-code";
  promptPre.textContent = AI_GREETINGS_PROMPT;

  helpPanel.append(promptHeader, promptPre);

  let copiedTimeout = null;

  async function handleCopyPrompt() {
    try {
      await copyText(AI_GREETINGS_PROMPT);
      copyPromptBtn.textContent = "Copied!";
      window.clearTimeout(copiedTimeout);
      copiedTimeout = window.setTimeout(() => {
        copyPromptBtn.textContent = "Copy prompt";
      }, 2000);
    } catch {
      copyPromptBtn.textContent = "Copy failed";
      window.clearTimeout(copiedTimeout);
      copiedTimeout = window.setTimeout(() => {
        copyPromptBtn.textContent = "Copy prompt";
      }, 2000);
    }
  }

  copyPromptBtn.addEventListener("click", handleCopyPrompt);

  helpPanel.cleanup = () => {
    copyPromptBtn.removeEventListener("click", handleCopyPrompt);
    window.clearTimeout(copiedTimeout);
  };

  return helpPanel;
}

function wireHelpToggle(helpBtn, helpPanel) {
  function toggleHelp() {
    const open = helpPanel.hidden;
    helpPanel.hidden = !open;
    helpBtn.setAttribute("aria-expanded", String(open));
    helpBtn.setAttribute("aria-label", open ? "Hide instructions" : "Show instructions");
  }

  helpBtn.addEventListener("click", toggleHelp);
  return () => {
    helpBtn.removeEventListener("click", toggleHelp);
  };
}

function createBrandingForm({ setStatus, onSaved, ids }) {
  const panel = document.createElement("div");
  panel.className = "settings-section-panel";

  const hint = document.createElement("p");
  hint.className = "settings-section-hint";
  hint.textContent =
    "Customize the app name and greeting quotes on your new tab. Turn branding off to hide them completely.";

  const enableRow = document.createElement("label");
  enableRow.className = "branding-enable-row";
  enableRow.htmlFor = ids.brandingEnabled;

  const enableInput = document.createElement("input");
  enableInput.type = "checkbox";
  enableInput.id = ids.brandingEnabled;
  enableInput.className = "branding-enable-input";

  const enableText = document.createElement("span");
  enableText.textContent = "Show branding on new tab";

  enableRow.append(enableInput, enableText);

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "branding-fields";

  const appNameLabel = document.createElement("label");
  appNameLabel.className = "field-label";
  appNameLabel.htmlFor = ids.appName;
  appNameLabel.textContent = "App name";

  const appNameInput = document.createElement("input");
  appNameInput.type = "text";
  appNameInput.id = ids.appName;
  appNameInput.className = "field-input";
  appNameInput.maxLength = 48;
  appNameInput.placeholder = "dtp-os";

  const greetingsLabelRow = document.createElement("div");
  greetingsLabelRow.className = "field-label-row";

  const greetingsLabel = document.createElement("label");
  greetingsLabel.className = "field-label";
  greetingsLabel.htmlFor = ids.greetings;
  greetingsLabel.textContent = "Custom greetings (JSON array)";

  const helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className = "settings-help-toggle";
  helpBtn.setAttribute("aria-expanded", "false");
  helpBtn.setAttribute("aria-controls", ids.greetingsHelp);
  helpBtn.setAttribute("aria-label", "Show instructions");
  helpBtn.title = "How to format JSON greetings";
  helpBtn.textContent = "?";

  greetingsLabelRow.append(greetingsLabel, helpBtn);

  const helpPanel = createGreetingsHelpPanel(ids.greetingsHelp);

  const greetingsInput = document.createElement("textarea");
  greetingsInput.id = ids.greetings;
  greetingsInput.className = "field-textarea";
  greetingsInput.rows = 6;
  greetingsInput.placeholder =
    '[\n  "Let\'s build something great.",\n  "You\'ve got this."\n]';

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "field-save-btn";
  saveButton.textContent = "Save branding";

  fieldsWrap.append(
    appNameLabel,
    appNameInput,
    greetingsLabelRow,
    helpPanel,
    greetingsInput
  );

  panel.append(hint, enableRow, fieldsWrap, saveButton);

  function syncFieldsEnabled() {
    const enabled = enableInput.checked;
    fieldsWrap.classList.toggle("is-disabled", !enabled);
    appNameInput.disabled = !enabled;
    greetingsInput.disabled = !enabled;
    helpBtn.disabled = !enabled;
  }

  enableInput.addEventListener("change", syncFieldsEnabled);

  const removeHelpListener = wireHelpToggle(helpBtn, helpPanel);

  async function loadFields() {
    enableInput.checked = await getBrandingEnabled();
    appNameInput.value = await getAppName();
    greetingsInput.value = await getCustomGreetingsJson();
    syncFieldsEnabled();
  }

  saveButton.addEventListener("click", async () => {
    try {
      await setBrandingEnabled(enableInput.checked);
      await setAppName(appNameInput.value);
      await setCustomGreetingsJson(greetingsInput.value);
      setStatus("Branding saved.");
      onSaved?.();
    } catch (error) {
      setStatus(error.message || "Could not save branding.", true);
    }
  });

  loadFields().catch((error) => {
    setStatus(error.message || "Could not load branding settings.", true);
  });

  panel.cleanup = () => {
    removeHelpListener();
    helpPanel.cleanup?.();
  };

  return panel;
}

export function mountSettingsTool(container, { showToast }) {
  const panel = createBrandingForm({
    ids: {
      brandingEnabled: "settingsBrandingEnabled",
      appName: "settingsAppName",
      greetings: "settingsGreetings",
      greetingsHelp: "settingsGreetingsHelp",
    },
    setStatus: (message, isError = false) => {
      showToast(message, isError);
    },
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}

export function mountBrandingPanel(container, { setStatus, onSaved }) {
  const panel = createBrandingForm({
    ids: {
      brandingEnabled: "newtabBrandingEnabled",
      appName: "newtabBrandingAppName",
      greetings: "newtabBrandingGreetings",
      greetingsHelp: GREETINGS_HELP_ID,
    },
    setStatus,
    onSaved,
  });
  container.appendChild(panel);
  return () => {
    panel.cleanup?.();
  };
}

export const mountBrandingFields = mountBrandingPanel;
