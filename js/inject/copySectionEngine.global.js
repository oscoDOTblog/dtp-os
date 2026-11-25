/**
 * dtp-os copy section — extracts a page region as Markdown or plain text.
 *
 * Two entry points share one extractor:
 *   - context menu, which acts on the element tracked by the last `contextmenu` event
 *   - popup, which asks for auto-detected main content or the full page
 */
(function () {
  "use strict";

  if (globalThis.DtpCopySectionEngine) {
    return;
  }

  const UI_HOST_ID = "dtp-copy-section-ui";
  const HIGHLIGHT_CLASS = "dtp-copy-section-highlight";
  const TOAST_MS = 2200;

  const SETTINGS_DEFAULTS = {
    copySectionEnabled: true,
    copySectionButtonEnabled: true,
    copySectionButtonCorner: "bottom-left",
    copySectionFormat: "markdown",
  };

  const settings = { ...SETTINGS_DEFAULTS };

  let isTopFrame = true;
  try {
    isTopFrame = window.top === window;
  } catch {
    isTopFrame = false;
  }

  // Never contribute text
  const SKIP_TAGS = new Set([
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "canvas",
    "iframe",
    "object",
    "embed",
    "video",
    "audio",
    "map",
    "area",
    "link",
    "meta",
    "input",
    "select",
    "option",
    "textarea",
    "button",
    "dialog",
  ]);

  // Page furniture stripped from inside an extracted region
  const CHROME_TAGS = new Set(["nav", "header", "footer", "aside"]);

  const CHROME_PATTERN =
    /(^|[\s_-])(nav|navbar|menu|sidebar|side-bar|footer|header|masthead|breadcrumb|pagination|comment|comments|disqus|share|social|subscribe|newsletter|related|recommend|promo|advert|advertisement|banner|cookie|consent|popup|modal|toolbar|skip-link|widget)([\s_-]|$)/i;

  // Ordered by how strongly each signals real article content
  const MAIN_SELECTOR_TIERS = [
    ["main", "[role='main']"],
    ["article", "[role='article']"],
    [
      "#main-content",
      "#maincontent",
      "#main",
      "#content",
      "#primary",
      "#article",
      "#post",
    ],
    [
      ".main-content",
      ".post-content",
      ".entry-content",
      ".article-content",
      ".article-body",
      ".post-body",
      ".story-body",
      ".markdown-body",
      ".prose",
      ".content-body",
    ],
  ];

  const SECTION_ANCESTOR_SELECTOR =
    "article, section, main, aside, nav, [role='main'], [role='article'], [role='region'], [role='complementary'], [role='navigation'], [role='contentinfo'], [role='banner']";

  // List indentation is emitted as sentinels so the whitespace cleanup pass
  // cannot collapse it, then expanded back to spaces at the very end.
  const INDENT_UNIT = "\u0000";
  const INDENT_PAD = "\u0001";

  const MIN_MAIN_TEXT = 200;
  const MIN_SECTION_TEXT = 30;
  const WHOLE_PAGE_RATIO = 0.9;

  let lastContextTarget = null;

  document.addEventListener(
    "contextmenu",
    (event) => {
      lastContextTarget = event.target || null;
    },
    true
  );

  // --- element inspection -------------------------------------------------

  function tagOf(node) {
    return node?.tagName ? node.tagName.toLowerCase() : "";
  }

  function isHidden(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    if (el.hidden || el.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const style = window.getComputedStyle(el);
    return (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    );
  }

  function textLength(el) {
    return (el?.textContent || "").trim().length;
  }

  function looksLikeChrome(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    const id = el.id || "";
    const className =
      typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    const role = el.getAttribute("role") || "";
    return CHROME_PATTERN.test(`${id} ${className} ${role}`);
  }

  function linkDensity(el) {
    const total = textLength(el);
    if (!total) {
      return 1;
    }
    let linkChars = 0;
    for (const anchor of el.querySelectorAll("a")) {
      linkChars += textLength(anchor);
    }
    return Math.min(1, linkChars / total);
  }

  // --- main content detection ---------------------------------------------

  function pickLargest(elements) {
    let best = null;
    let bestLength = 0;
    for (const el of elements) {
      if (isHidden(el)) {
        continue;
      }
      const length = textLength(el);
      if (length >= MIN_MAIN_TEXT && length > bestLength) {
        best = el;
        bestLength = length;
      }
    }
    return best;
  }

  function findSemanticMain() {
    for (const tier of MAIN_SELECTOR_TIERS) {
      const matches = [];
      for (const selector of tier) {
        try {
          matches.push(...document.querySelectorAll(selector));
        } catch {
          // Ignore selectors the browser rejects
        }
      }
      const best = pickLargest(matches);
      if (best) {
        return best;
      }
    }
    return null;
  }

  /**
   * Readability-style fallback: score the parents of text-bearing blocks rather
   * than the blocks themselves, so the winner is the smallest container that
   * still holds the bulk of the prose.
   */
  function findByTextDensity() {
    const scores = new Map();

    function addScore(el, amount) {
      if (!(el instanceof Element) || el === document.body) {
        return;
      }
      scores.set(el, (scores.get(el) || 0) + amount);
    }

    const blocks = document.querySelectorAll("p, pre, blockquote, li, dd, td, h2, h3");
    for (const block of blocks) {
      const length = textLength(block);
      if (length < 25 || isHidden(block)) {
        continue;
      }

      const base = 1 + Math.min(length / 100, 3);
      addScore(block.parentElement, base);
      addScore(block.parentElement?.parentElement, base / 2);
      addScore(block.parentElement?.parentElement?.parentElement, base / 4);
    }

    let best = null;
    let bestScore = 0;
    for (const [el, rawScore] of scores) {
      let score = rawScore * (1 - linkDensity(el));
      if (looksLikeChrome(el)) {
        score *= 0.3;
      }
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function findMainContent() {
    const semantic = findSemanticMain();
    if (semantic) {
      return { element: semantic, strategy: "semantic" };
    }

    const dense = findByTextDensity();
    if (dense) {
      return { element: dense, strategy: "density" };
    }

    return { element: document.body, strategy: "page" };
  }

  // --- clicked-section detection ------------------------------------------

  function isBlockLevel(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    const display = window.getComputedStyle(el).display;
    return (
      display.startsWith("block") ||
      display.startsWith("flow") ||
      display.startsWith("grid") ||
      display.startsWith("flex") ||
      display === "list-item" ||
      display === "table"
    );
  }

  function blockCount(el) {
    return el.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, figure"
    ).length;
  }

  /**
   * Climbs to the smallest container that reads as a section rather than a
   * single paragraph: it holds at least two text blocks but is still clearly
   * narrower than the page itself.
   */
  function walkUpToSection(start) {
    const bodyLength = textLength(document.body) || 1;
    let node = start;
    let candidate = null;

    while (node && node !== document.body) {
      if (isBlockLevel(node)) {
        const length = textLength(node);
        if (length >= MIN_SECTION_TEXT && blockCount(node) >= 2) {
          return node;
        }
        // Climbed into the page wrapper without ever finding a section
        if (length / bodyLength >= WHOLE_PAGE_RATIO) {
          break;
        }
        candidate = node;
      }
      node = node.parentElement;
    }

    return candidate || start;
  }

  function findSectionFromTarget(target) {
    const start =
      target instanceof Element ? target : target?.parentElement || null;
    if (!start) {
      return null;
    }

    const bodyLength = textLength(document.body) || 1;
    const semantic = start.closest(SECTION_ANCESTOR_SELECTOR);

    // A <section> wrapping the whole document is not a useful "section"
    if (
      semantic &&
      textLength(semantic) >= MIN_SECTION_TEXT &&
      textLength(semantic) / bodyLength < WHOLE_PAGE_RATIO
    ) {
      return semantic;
    }

    return walkUpToSection(start);
  }

  // --- serialization ------------------------------------------------------

  function absoluteUrl(value) {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value;
    }
  }

  function collapse(text) {
    return text.replace(/\s+/g, " ");
  }

  function block(text) {
    const trimmed = text.trim();
    return trimmed ? `\n\n${trimmed}\n\n` : "";
  }

  function prefixLines(text, prefix) {
    return text
      .split("\n")
      .map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
      .join("\n");
  }

  function codeLanguage(el) {
    const source = `${el.className || ""} ${el.querySelector("code")?.className || ""}`;
    const match = source.match(/language-([a-z0-9+#-]+)/i);
    return match ? match[1] : "";
  }

  function renderChildren(node, ctx) {
    let out = "";
    for (const child of node.childNodes) {
      out += renderNode(child, ctx);
    }
    return out;
  }

  function renderList(node, ctx) {
    const ordered = tagOf(node) === "ol";
    let index = Number(node.getAttribute("start")) || 1;
    const indent = INDENT_UNIT.repeat(ctx.listDepth);
    const lines = [];

    for (const child of node.children) {
      if (tagOf(child) !== "li" || isHidden(child)) {
        continue;
      }

      const marker = ordered ? `${index++}. ` : "- ";
      const content = renderChildren(child, { ...ctx, listDepth: ctx.listDepth + 1 })
        .replace(/\n{2,}/g, "\n")
        .trim();

      if (!content) {
        continue;
      }

      const [first, ...rest] = content.split("\n");
      const continuation = rest
        .map((line) => {
          if (!line) {
            return "";
          }
          // Nested lists already carry their own absolute indentation
          if (line.startsWith(INDENT_UNIT)) {
            return line;
          }
          return `${indent}${INDENT_PAD.repeat(marker.length)}${line}`;
        })
        .join("\n");

      lines.push(`${indent}${marker}${first}${rest.length ? `\n${continuation}` : ""}`);
    }

    return block(lines.join("\n"));
  }

  function renderTable(node, ctx) {
    const rows = [];
    for (const row of node.querySelectorAll("tr")) {
      if (isHidden(row)) {
        continue;
      }
      const cells = [];
      for (const cell of row.children) {
        if (!/^(td|th)$/.test(tagOf(cell))) {
          continue;
        }
        cells.push(
          collapse(renderChildren(cell, ctx)).replace(/\|/g, "\\|").trim()
        );
      }
      if (cells.length) {
        rows.push(cells);
      }
    }

    if (!rows.length) {
      return "";
    }

    if (ctx.plain) {
      return block(rows.map((cells) => cells.join("\t")).join("\n"));
    }

    const width = Math.max(...rows.map((cells) => cells.length));
    const pad = (cells) =>
      `| ${Array.from({ length: width }, (_, i) => cells[i] || "").join(" | ")} |`;

    const [head, ...body] = rows;
    const separator = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;

    return block([pad(head), separator, ...body.map(pad)].join("\n"));
  }

  function renderNode(node, ctx) {
    if (node.nodeType === Node.TEXT_NODE) {
      return ctx.pre ? node.textContent : collapse(node.textContent);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = tagOf(node);

    if (SKIP_TAGS.has(tag) || isHidden(node)) {
      return "";
    }

    // Strip page furniture, but never the region the user explicitly asked for
    if (node !== ctx.root && (CHROME_TAGS.has(tag) || looksLikeChrome(node))) {
      return "";
    }

    switch (tag) {
      case "br":
        return "\n";

      case "hr":
        return ctx.plain ? "\n\n" : block("---");

      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const text = collapse(renderChildren(node, ctx)).trim();
        if (!text) {
          return "";
        }
        return ctx.plain
          ? block(text)
          : block(`${"#".repeat(Number(tag[1]))} ${text}`);
      }

      case "a": {
        const text = renderChildren(node, ctx).trim();
        const href = node.getAttribute("href");
        if (!text) {
          return "";
        }
        if (ctx.plain || !href || /^(javascript:|#)/i.test(href)) {
          return text;
        }
        return `[${text}](${absoluteUrl(href)})`;
      }

      case "img": {
        if (ctx.plain) {
          return "";
        }
        const src = node.currentSrc || node.getAttribute("src") || "";
        if (!/^https?:/i.test(absoluteUrl(src))) {
          return "";
        }
        return `![${collapse(node.getAttribute("alt") || "").trim()}](${absoluteUrl(src)})`;
      }

      case "strong":
      case "b": {
        const text = renderChildren(node, ctx);
        return ctx.plain || !text.trim() ? text : `**${text.trim()}**`;
      }

      case "em":
      case "i": {
        const text = renderChildren(node, ctx);
        return ctx.plain || !text.trim() ? text : `*${text.trim()}*`;
      }

      case "del":
      case "s": {
        const text = renderChildren(node, ctx);
        return ctx.plain || !text.trim() ? text : `~~${text.trim()}~~`;
      }

      case "code": {
        if (ctx.pre || ctx.plain) {
          return renderChildren(node, ctx);
        }
        const text = collapse(node.textContent).trim();
        return text ? `\`${text}\`` : "";
      }

      case "pre": {
        const text = node.textContent.replace(/\s+$/, "");
        if (!text.trim()) {
          return "";
        }
        if (ctx.plain) {
          return block(text);
        }
        return block(`\`\`\`${codeLanguage(node)}\n${text}\n\`\`\``);
      }

      case "blockquote": {
        const text = renderChildren(node, ctx).replace(/\n{3,}/g, "\n\n").trim();
        if (!text) {
          return "";
        }
        return block(ctx.plain ? text : prefixLines(text, "> "));
      }

      case "ul":
      case "ol":
        return renderList(node, ctx);

      case "table":
        return renderTable(node, ctx);

      case "p":
      case "div":
      case "section":
      case "article":
      case "main":
      case "figure":
      case "figcaption":
      case "dl":
      case "dt":
      case "dd":
      case "address":
      case "details":
      case "summary":
      case "tr":
        return block(renderChildren(node, ctx));

      default:
        return renderChildren(node, ctx);
    }
  }

  function serialize(root, format) {
    const ctx = {
      root,
      plain: format === "plain",
      pre: false,
      listDepth: 0,
    };

    return renderNode(root, ctx)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(\S)[ \t]{2,}/g, "$1 ")
      .replace(new RegExp(INDENT_UNIT, "g"), "  ")
      .replace(new RegExp(INDENT_PAD, "g"), " ")
      .trim();
  }

  // --- clipboard ----------------------------------------------------------

  function legacyCopy(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText =
      "position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;";

    const host = document.body || document.documentElement;
    host.appendChild(field);

    const selection = document.getSelection();
    const previousRange =
      selection && selection.rangeCount ? selection.getRangeAt(0) : null;

    field.select();
    field.setSelectionRange(0, field.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    field.remove();

    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }

    return copied;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Context-menu clicks carry no user activation, so fall back to execCommand
      return legacyCopy(text);
    }
  }

  // --- feedback -----------------------------------------------------------

  /**
   * The outline stays put so the copied region remains identifiable. It is
   * cleared by the next copy or by a reload, never on a timer.
   */
  function highlightElement(el) {
    for (const previous of document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)) {
      previous.classList.remove(HIGHLIGHT_CLASS);
    }

    if (!(el instanceof Element) || el === document.body) {
      return;
    }

    // Forces the intro animation to replay when the same region is re-copied
    void el.offsetWidth;
    el.classList.add(HIGHLIGHT_CLASS);
  }

  // --- injected UI --------------------------------------------------------

  // Rendered in a shadow root so the host page's stylesheet cannot reach in,
  // and our rules cannot leak out onto the page.
  const UI_STYLES = `
    .stack {
      all: initial;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
      line-height: 1.35;
    }

    .stack[data-corner^="top"] {
      flex-direction: column-reverse;
    }

    .stack[data-corner$="left"] {
      align-items: flex-start;
    }

    .toast {
      box-sizing: border-box;
      max-width: min(320px, calc(100vw - 32px));
      padding: 10px 14px;
      border: 1px solid rgba(255, 20, 147, 0.45);
      border-radius: 10px;
      background: #141414;
      color: #f5f5f5;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.04);
      font-size: 13px;
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .toast[data-visible="true"] {
      opacity: 1;
      transform: translateY(0);
    }

    .toast[data-error="true"] {
      border-color: rgba(239, 68, 68, 0.55);
      color: #fca5a5;
    }

    .fab {
      display: inline-flex;
      align-items: center;
      gap: 0;
      box-sizing: border-box;
      height: 34px;
      margin: 0;
      padding: 0 8px;
      border: 1px solid rgba(255, 20, 147, 0.5);
      border-radius: 999px;
      background: rgba(20, 20, 20, 0.92);
      color: #ff69b4;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      pointer-events: auto;
      opacity: 0.4;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
      transition: opacity 0.16s ease, gap 0.16s ease, border-color 0.16s ease,
        background 0.16s ease;
    }

    .fab:hover,
    .fab:focus-visible {
      gap: 6px;
      opacity: 1;
      border-color: #ff1493;
      background: rgba(28, 28, 28, 0.98);
      outline: none;
    }

    .fab:focus-visible {
      box-shadow: 0 0 0 3px rgba(255, 20, 147, 0.35);
    }

    .fab[data-copied="true"] {
      gap: 6px;
      opacity: 1;
      color: #ffb6d9;
    }

    .fab svg {
      flex: 0 0 auto;
      width: 15px;
      height: 15px;
    }

    .fab-label {
      max-width: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: max-width 0.16s ease;
    }

    .fab:hover .fab-label,
    .fab:focus-visible .fab-label,
    .fab[data-copied="true"] .fab-label {
      max-width: 90px;
    }

    @media (prefers-reduced-motion: reduce) {
      .toast,
      .fab,
      .fab-label {
        transition: none;
      }
    }
  `;

  const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const DONE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

  const CORNER_OFFSETS = {
    "bottom-right": { bottom: "16px", right: "16px" },
    "bottom-left": { bottom: "16px", left: "16px" },
    "top-right": { top: "16px", right: "16px" },
    "top-left": { top: "16px", left: "16px" },
  };

  let uiHost = null;
  let stackEl = null;
  let toastEl = null;
  let fabEl = null;
  let toastTimer = 0;
  let fabResetTimer = 0;

  function ensureUi() {
    if (uiHost?.isConnected) {
      return;
    }

    uiHost = document.createElement("div");
    uiHost.id = UI_HOST_ID;

    // Inline + !important so page rules cannot hide or reposition the host
    const hostStyles = {
      position: "fixed",
      "z-index": "2147483647",
      margin: "0",
      padding: "0",
      border: "0",
      width: "auto",
      height: "auto",
      display: "block",
      visibility: "visible",
      opacity: "1",
      "pointer-events": "none",
    };
    for (const [property, value] of Object.entries(hostStyles)) {
      uiHost.style.setProperty(property, value, "important");
    }

    const shadow = uiHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = UI_STYLES;

    stackEl = document.createElement("div");
    stackEl.className = "stack";

    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");

    stackEl.appendChild(toastEl);
    shadow.append(style, stackEl);

    // documentElement survives SPA frameworks that replace the body's children
    (document.documentElement || document.body).appendChild(uiHost);

    applyCorner();
  }

  function applyCorner() {
    if (!uiHost) {
      return;
    }

    const corner = CORNER_OFFSETS[settings.copySectionButtonCorner]
      ? settings.copySectionButtonCorner
      : "bottom-left";

    for (const side of ["top", "right", "bottom", "left"]) {
      uiHost.style.removeProperty(side);
    }
    for (const [side, value] of Object.entries(CORNER_OFFSETS[corner])) {
      uiHost.style.setProperty(side, value, "important");
    }

    stackEl?.setAttribute("data-corner", corner);
  }

  function setFabState(copied) {
    if (!fabEl) {
      return;
    }

    fabEl.dataset.copied = copied ? "true" : "false";
    fabEl.querySelector(".fab-icon").innerHTML = copied ? DONE_ICON : COPY_ICON;
    fabEl.querySelector(".fab-label").textContent = copied ? "Copied" : "Copy";
  }

  async function onFabClick() {
    // A real click in the page carries user activation, so the async clipboard
    // API works here without the execCommand fallback.
    const result = await run({
      mode: "main",
      format: settings.copySectionFormat,
      copyInPage: true,
    });

    if (!result.ok) {
      return;
    }

    setFabState(true);
    window.clearTimeout(fabResetTimer);
    fabResetTimer = window.setTimeout(() => setFabState(false), 1600);
  }

  function showFab() {
    ensureUi();

    if (fabEl) {
      return;
    }

    fabEl = document.createElement("button");
    fabEl.type = "button";
    fabEl.className = "fab";
    fabEl.setAttribute("aria-label", "Copy main content to clipboard");
    fabEl.innerHTML = `<span class="fab-icon">${COPY_ICON}</span><span class="fab-label">Copy</span>`;
    fabEl.addEventListener("click", onFabClick);

    stackEl.appendChild(fabEl);
  }

  function hideFab() {
    if (!fabEl) {
      return;
    }
    fabEl.removeEventListener("click", onFabClick);
    fabEl.remove();
    fabEl = null;
  }

  function syncFab() {
    const wanted =
      isTopFrame &&
      settings.copySectionEnabled &&
      settings.copySectionButtonEnabled;

    if (wanted) {
      showFab();
      applyCorner();
      return;
    }

    hideFab();
  }

  function showToast(message, isError) {
    ensureUi();

    toastEl.textContent = message;
    toastEl.dataset.error = isError ? "true" : "false";
    toastEl.dataset.visible = "true";

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.dataset.visible = "false";
    }, TOAST_MS);
  }

  // --- entry point --------------------------------------------------------

  function resolveTarget(mode) {
    if (mode === "page") {
      return { element: document.body, strategy: "page", label: "Full page" };
    }

    if (mode === "section") {
      const section = findSectionFromTarget(lastContextTarget);
      if (section) {
        return { element: section, strategy: "clicked", label: "Section" };
      }
      // Cold tab: no contextmenu event was ever observed here
      const fallback = findMainContent();
      return { ...fallback, label: "Main content" };
    }

    const main = findMainContent();
    return { ...main, label: "Main content" };
  }

  async function run(options) {
    const mode = options?.mode || "main";
    const format = options?.format === "plain" ? "plain" : "markdown";
    const copyInPage = options?.copyInPage !== false;

    const { element, strategy, label } = resolveTarget(mode);

    if (!element) {
      const error = "Nothing to copy on this page.";
      if (copyInPage) {
        showToast(error, true);
      }
      return { ok: false, error };
    }

    const text = serialize(element, format);

    if (!text) {
      const error = "That area has no readable text.";
      if (copyInPage) {
        showToast(error, true);
      }
      return { ok: false, error };
    }

    const result = {
      ok: true,
      text,
      chars: text.length,
      strategy,
      label,
      format,
      title: document.title || "",
      url: location.href,
    };

    highlightElement(element);

    if (!copyInPage) {
      return result;
    }

    const copied = await copyToClipboard(text);
    showToast(
      copied
        ? `${label} copied — ${text.length.toLocaleString()} characters`
        : "Could not write to the clipboard.",
      !copied
    );

    return { ...result, ok: copied, copied };
  }

  globalThis.DtpCopySectionEngine = { run };

  // --- settings -----------------------------------------------------------

  function applySettings(values) {
    Object.assign(settings, values);
    syncFab();
  }

  // globalThis lookup: optional chaining does not guard an undeclared identifier
  const storage = globalThis.chrome?.storage;

  function loadSettings() {
    if (!storage?.local) {
      return;
    }

    storage.local.get(SETTINGS_DEFAULTS, (items) => {
      if (globalThis.chrome?.runtime?.lastError) {
        return;
      }
      applySettings(items);
    });
  }

  storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const next = {};
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
      if (changes[key]) {
        next[key] =
          changes[key].newValue === undefined
            ? SETTINGS_DEFAULTS[key]
            : changes[key].newValue;
      }
    }

    if (Object.keys(next).length) {
      applySettings(next);
    }
  });

  loadSettings();
})();
