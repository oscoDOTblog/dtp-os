/**
 * coss-aligned Field primitives for vanilla DOM (dtp-os has no React/coss runtime).
 * Mirrors @coss/field composition: Field > FieldLabel + control + FieldDescription.
 */

/**
 * @param {object} [options]
 * @param {"vertical"|"horizontal"} [options.orientation]
 * @param {string} [options.className]
 * @returns {HTMLDivElement}
 */
export function createCossField({ orientation = "vertical", className = "" } = {}) {
  const field = document.createElement("div");
  field.dataset.slot = "field";
  if (orientation === "horizontal") {
    field.dataset.orientation = "horizontal";
  }
  if (className) {
    field.className = className;
  }
  return field;
}

/** Stacks several fields with consistent spacing. */
export function createCossFieldGroup({ className = "" } = {}) {
  const group = document.createElement("div");
  group.dataset.slot = "field-group";
  if (className) {
    group.className = className;
  }
  return group;
}

/** Label + description column, used when a control sits beside its text. */
export function createCossFieldContent() {
  const content = document.createElement("div");
  content.dataset.slot = "field-content";
  return content;
}

/**
 * `button` is a labelable element, so `htmlFor` works for coss Switch triggers
 * as well as native inputs.
 */
export function createCossFieldLabel({ text = "", htmlFor, id } = {}) {
  const label = document.createElement("label");
  label.dataset.slot = "field-label";
  if (htmlFor) {
    label.htmlFor = htmlFor;
  }
  if (id) {
    label.id = id;
  }
  if (text) {
    label.textContent = text;
  }
  return label;
}

export function createCossFieldDescription({ text = "", id } = {}) {
  const description = document.createElement("p");
  description.dataset.slot = "field-description";
  if (id) {
    description.id = id;
  }
  if (text) {
    description.textContent = text;
  }
  return description;
}

export function setCossFieldDisabled(field, disabled) {
  if (!field) {
    return;
  }
  if (disabled) {
    field.dataset.disabled = "";
  } else {
    delete field.dataset.disabled;
  }
}
