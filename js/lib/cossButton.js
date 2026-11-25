/**
 * Create a coss-aligned button element (vanilla stand-in for @coss/button).
 *
 * @param {object} options
 * @param {string} [options.text]
 * @param {"default"|"outline"|"secondary"|"destructive"|"destructive-outline"|"ghost"|"link"} [options.variant]
 * @param {"xs"|"sm"|"default"|"lg"|"icon"|"icon-sm"|"icon-xs"} [options.size]
 * @param {"button"|"submit"|"reset"} [options.type]
 * @param {string} [options.className] Extra classes
 * @param {string} [options.ariaLabel]
 * @returns {HTMLButtonElement}
 */
export function createCossButton({
  text = "",
  variant = "default",
  size = "default",
  type = "button",
  className = "",
  ariaLabel,
} = {}) {
  const button = document.createElement("button");
  button.type = type;
  button.dataset.slot = "button";
  button.className = [
    "coss-btn",
    `coss-btn--${size === "default" ? "default" : size}`,
    `coss-btn--variant-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }

  if (text) {
    button.textContent = text;
  }

  return button;
}

export function setCossButtonPressed(button, pressed) {
  if (!button) {
    return;
  }
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  if (pressed) {
    button.dataset.active = "";
  } else {
    delete button.dataset.active;
  }
}
