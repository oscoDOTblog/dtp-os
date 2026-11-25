/**
 * coss-aligned Switch for vanilla DOM (dtp-os has no React/coss runtime).
 * Mirrors @coss/switch: a role="switch" button with a thumb, using Base UI's
 * data-checked / data-unchecked attributes for styling.
 *
 * Per coss guidance, Switch is the control for binary preference toggles in
 * settings flows; Checkbox is reserved for consent and multi-select rows.
 */
import {
  createCossField,
  createCossFieldContent,
  createCossFieldDescription,
  createCossFieldLabel,
  setCossFieldDisabled,
} from "./cossField.js";

export function createCossSwitch({
  id,
  checked = false,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
} = {}) {
  const control = document.createElement("button");
  control.type = "button";
  control.dataset.slot = "switch";
  control.setAttribute("role", "switch");
  control.disabled = Boolean(disabled);

  if (id) {
    control.id = id;
  }
  if (ariaLabel) {
    control.setAttribute("aria-label", ariaLabel);
  }
  if (ariaDescribedBy) {
    control.setAttribute("aria-describedby", ariaDescribedBy);
  }

  const thumb = document.createElement("span");
  thumb.dataset.slot = "switch-thumb";
  control.appendChild(thumb);

  setCossSwitchChecked(control, checked);

  return control;
}

export function setCossSwitchChecked(control, checked) {
  if (!control) {
    return;
  }

  const on = Boolean(checked);
  control.setAttribute("aria-checked", on ? "true" : "false");

  if (on) {
    control.dataset.checked = "";
    delete control.dataset.unchecked;
  } else {
    control.dataset.unchecked = "";
    delete control.dataset.checked;
  }
}

export function isCossSwitchChecked(control) {
  return control?.getAttribute("aria-checked") === "true";
}

/**
 * Switch beside a label and description, matching the coss `p-switch-3` pattern.
 *
 * @returns {{ field: HTMLDivElement, control: HTMLButtonElement, setDisabled: (disabled: boolean) => void }}
 */
export function createCossSwitchField({
  id,
  label,
  description,
  checked = false,
  onChange,
} = {}) {
  const field = createCossField({ orientation: "horizontal" });
  const content = createCossFieldContent();

  content.appendChild(createCossFieldLabel({ text: label, htmlFor: id }));

  let describedBy;
  if (description) {
    describedBy = `${id}-description`;
    content.appendChild(
      createCossFieldDescription({ text: description, id: describedBy })
    );
  }

  const control = createCossSwitch({
    id,
    checked,
    ariaDescribedBy: describedBy,
  });

  control.addEventListener("click", () => {
    const next = !isCossSwitchChecked(control);
    setCossSwitchChecked(control, next);
    onChange?.(next);
  });

  field.append(content, control);

  return {
    field,
    control,
    setDisabled(disabled) {
      control.disabled = Boolean(disabled);
      setCossFieldDisabled(field, disabled);
    },
  };
}
