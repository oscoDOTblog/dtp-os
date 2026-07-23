/**
 * dtp-os emoji autocomplete — native input/textarea :query picker.
 * Expects globalThis.DTP_EMOJI_LIST from emojiData.global.js.
 */
(function () {
  "use strict";

  if (globalThis.__DTP_EMOJI_AUTOCOMPLETE__) {
    return;
  }
  globalThis.__DTP_EMOJI_AUTOCOMPLETE__ = true;

  const MAX_RESULTS = 8;
  const ROOT_ID = "dtp-emoji-autocomplete-root";
  const SKIP_INPUT_TYPES = new Set([
    "password",
    "email",
    "url",
    "number",
    "tel",
    "date",
    "datetime-local",
    "month",
    "week",
    "time",
    "color",
    "file",
    "hidden",
    "range",
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "image",
  ]);

  // Letter required after colon; avoids times like 12:30
  const SHORTCODE_RE = /(?:^|[\s(\[{])(:([a-zA-Z][a-zA-Z0-9_+-]*))$/;

  let activeField = null;
  let matchStart = -1;
  let matchEnd = -1;
  let results = [];
  let highlightIndex = 0;
  let rootEl = null;
  let listEl = null;

  function getEmojiList() {
    return Array.isArray(globalThis.DTP_EMOJI_LIST)
      ? globalThis.DTP_EMOJI_LIST
      : [];
  }

  function normalizeQuery(query) {
    return String(query ?? "")
      .trim()
      .toLowerCase();
  }

  function matchesEmoji(entry, query) {
    if (!query) {
      return true;
    }
    if (entry.emoji.includes(query)) {
      return true;
    }
    return entry.keywords.some((keyword) => keyword.includes(query));
  }

  function filterEmojis(list, query, limit) {
    const normalized = normalizeQuery(query);
    const out = [];
    for (const entry of list) {
      if (!matchesEmoji(entry, normalized)) {
        continue;
      }
      out.push(entry);
      if (out.length >= limit) {
        break;
      }
    }
    return out;
  }

  function isEditableField(el) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
      return false;
    }
    if (el.readOnly || el.disabled) {
      return false;
    }
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      if (SKIP_INPUT_TYPES.has(type)) {
        return false;
      }
    }
    return true;
  }

  function findShortcode(value, caret) {
    const before = value.slice(0, caret);
    const match = before.match(SHORTCODE_RE);
    if (!match) {
      return null;
    }
    const full = match[1];
    const query = match[2];
    const start = caret - full.length;
    return { start, end: caret, query, full };
  }

  function ensureRoot() {
    if (rootEl && rootEl.isConnected) {
      return rootEl;
    }

    rootEl = document.createElement("div");
    rootEl.id = ROOT_ID;
    rootEl.className = "dtp-emoji-ac";
    rootEl.setAttribute("role", "listbox");
    rootEl.setAttribute("aria-label", "Emoji suggestions");
    rootEl.hidden = true;

    listEl = document.createElement("ul");
    listEl.className = "dtp-emoji-ac-list";
    rootEl.appendChild(listEl);

    (document.documentElement || document.body).appendChild(rootEl);
    return rootEl;
  }

  function dismiss() {
    activeField = null;
    matchStart = -1;
    matchEnd = -1;
    results = [];
    highlightIndex = 0;
    if (rootEl) {
      rootEl.hidden = true;
      if (listEl) {
        listEl.replaceChildren();
      }
    }
  }

  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertEmoji(emoji) {
    if (!activeField || matchStart < 0) {
      return;
    }

    const field = activeField;
    const value = field.value;
    const before = value.slice(0, matchStart);
    const after = value.slice(matchEnd);
    const next = `${before}${emoji}${after}`;
    const caret = before.length + emoji.length;

    setNativeValue(field, next);
    field.setSelectionRange(caret, caret);
    field.focus();
    dismiss();
  }

  function getCaretViewportPoint(field, position) {
    const rect = field.getBoundingClientRect();

    if (field instanceof HTMLInputElement) {
      return {
        left: rect.left + 8,
        top: rect.bottom + 4,
        width: rect.width,
      };
    }

    // Textarea: approximate with mirror element
    const style = window.getComputedStyle(field);
    const mirror = document.createElement("div");
    const properties = [
      "boxSizing",
      "width",
      "height",
      "overflowX",
      "overflowY",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontStyle",
      "fontVariant",
      "fontWeight",
      "fontStretch",
      "fontSize",
      "fontSizeAdjust",
      "lineHeight",
      "fontFamily",
      "textAlign",
      "textTransform",
      "textIndent",
      "textDecoration",
      "letterSpacing",
      "wordSpacing",
      "tabSize",
      "whiteSpace",
      "wordWrap",
      "wordBreak",
    ];

    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.top = "0";
    mirror.style.left = "-9999px";

    for (const prop of properties) {
      mirror.style[prop] = style[prop];
    }

    mirror.style.width = `${field.clientWidth}px`;
    mirror.textContent = field.value.slice(0, position);

    const marker = document.createElement("span");
    marker.textContent = field.value.slice(position) || ".";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);

    const top =
      rect.top +
      (markerRect.top - mirrorRect.top) -
      field.scrollTop +
      markerRect.height +
      4;
    const left =
      rect.left + (markerRect.left - mirrorRect.left) - field.scrollLeft;

    return {
      left: Math.max(8, Math.min(left, window.innerWidth - 280)),
      top: Math.max(8, Math.min(top, window.innerHeight - 220)),
      width: rect.width,
    };
  }

  function positionRoot(field) {
    const root = ensureRoot();
    const point = getCaretViewportPoint(field, matchEnd);
    root.style.left = `${Math.round(point.left)}px`;
    root.style.top = `${Math.round(point.top)}px`;
  }

  function renderList() {
    const root = ensureRoot();
    listEl.replaceChildren();

    if (results.length === 0) {
      root.hidden = true;
      return;
    }

    results.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "dtp-emoji-ac-item";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", index === highlightIndex ? "true" : "false");
      if (index === highlightIndex) {
        item.classList.add("dtp-emoji-ac-item-active");
      }

      const glyph = document.createElement("span");
      glyph.className = "dtp-emoji-ac-glyph";
      glyph.textContent = entry.emoji;

      const label = document.createElement("span");
      label.className = "dtp-emoji-ac-label";
      label.textContent = `:${entry.keywords[0] || "emoji"}:`;

      item.append(glyph, label);
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        insertEmoji(entry.emoji);
      });
      listEl.appendChild(item);
    });

    root.hidden = false;
    if (activeField) {
      positionRoot(activeField);
    }
  }

  function updateFromField(field) {
    if (!isEditableField(field)) {
      dismiss();
      return;
    }

    const caret = field.selectionStart;
    if (typeof caret !== "number") {
      dismiss();
      return;
    }

    const found = findShortcode(field.value, caret);
    if (!found) {
      dismiss();
      return;
    }

    activeField = field;
    matchStart = found.start;
    matchEnd = found.end;
    results = filterEmojis(getEmojiList(), found.query, MAX_RESULTS);
    highlightIndex = 0;

    if (results.length === 0) {
      dismiss();
      return;
    }

    renderList();
  }

  function onInput(event) {
    const target = event.target;
    if (!isEditableField(target)) {
      return;
    }
    updateFromField(target);
  }

  function onKeyDown(event) {
    if (!activeField || rootEl?.hidden) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      highlightIndex = (highlightIndex + 1) % results.length;
      renderList();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      highlightIndex = (highlightIndex - 1 + results.length) % results.length;
      renderList();
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      if (results[highlightIndex]) {
        event.preventDefault();
        event.stopPropagation();
        insertEmoji(results[highlightIndex].emoji);
      }
    }
  }

  function onBlur(event) {
    const target = event.target;
    if (target !== activeField) {
      return;
    }
    // Allow mousedown on picker to fire first
    window.setTimeout(() => {
      if (document.activeElement !== activeField) {
        dismiss();
      }
    }, 0);
  }

  function onScrollOrResize() {
    if (activeField && rootEl && !rootEl.hidden) {
      positionRoot(activeField);
    }
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("blur", onBlur, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
})();
