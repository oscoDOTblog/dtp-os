/**
 * coss-aligned single-select ToggleGroup for vanilla DOM.
 * Mirrors @coss/toggle-group: a role="group" root with aria-pressed items and
 * roving arrow-key focus, as Base UI provides.
 *
 * Preferred over a Select for short option lists that fit inline, per the coss
 * Select guidance ("if the list is very short with visible options").
 */

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * @param {object} options
 * @param {Array<{value: string, label?: string, iconHtml?: string, ariaLabel?: string}>} options.items
 * @param {string} [options.value] Initially pressed value
 * @param {string} [options.ariaLabel] Required when items are icon-only
 * @param {"row"|"grid"} [options.layout]
 * @param {(value: string) => void} [options.onChange]
 * @returns {{ element: HTMLDivElement, setValue: (value: string) => void, getValue: () => string | null, setDisabled: (disabled: boolean) => void }}
 */
export function createCossToggleGroup({
  items = [],
  value = null,
  ariaLabel,
  layout = "row",
  onChange,
} = {}) {
  const root = document.createElement("div");
  root.dataset.slot = "toggle-group";
  root.setAttribute("role", "group");

  if (ariaLabel) {
    root.setAttribute("aria-label", ariaLabel);
  }
  if (layout === "grid") {
    root.dataset.layout = "grid";
  }

  const controls = [];
  let current = value;

  function paint() {
    for (const control of controls) {
      const pressed = control.dataset.value === current;
      control.setAttribute("aria-pressed", pressed ? "true" : "false");
      if (pressed) {
        control.dataset.pressed = "";
      } else {
        delete control.dataset.pressed;
      }
      // Roving tabindex: only the active item is in the tab order
      control.tabIndex = pressed ? 0 : -1;
    }

    if (!controls.some((control) => control.tabIndex === 0) && controls[0]) {
      controls[0].tabIndex = 0;
    }
  }

  function setValue(next, notify) {
    if (next === current) {
      return;
    }
    current = next;
    paint();
    if (notify) {
      onChange?.(next);
    }
  }

  for (const item of items) {
    const control = document.createElement("button");
    control.type = "button";
    control.dataset.slot = "toggle-group-item";
    control.dataset.value = item.value;

    if (item.ariaLabel) {
      control.setAttribute("aria-label", item.ariaLabel);
    }

    if (item.iconHtml) {
      control.innerHTML = item.iconHtml;
    }
    if (item.label) {
      const label = document.createElement("span");
      label.dataset.slot = "toggle-group-item-label";
      label.textContent = item.label;
      control.appendChild(label);
    }

    control.addEventListener("click", () => setValue(item.value, true));

    controls.push(control);
    root.appendChild(control);
  }

  root.addEventListener("keydown", (event) => {
    const index = controls.indexOf(document.activeElement);
    if (index === -1) {
      return;
    }

    let target = -1;
    if (NEXT_KEYS.has(event.key)) {
      target = (index + 1) % controls.length;
    } else if (PREVIOUS_KEYS.has(event.key)) {
      target = (index - 1 + controls.length) % controls.length;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = controls.length - 1;
    }

    if (target === -1 || controls[target].disabled) {
      return;
    }

    event.preventDefault();
    controls[target].focus();
  });

  paint();

  return {
    element: root,
    setValue: (next) => setValue(next, false),
    getValue: () => current,
    setDisabled(disabled) {
      const off = Boolean(disabled);
      for (const control of controls) {
        control.disabled = off;
      }
      if (off) {
        root.dataset.disabled = "";
      } else {
        delete root.dataset.disabled;
      }
    },
  };
}
