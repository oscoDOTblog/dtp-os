(function () {
  const SKIP_TYPES = new Set([
    "hidden",
    "submit",
    "button",
    "reset",
    "image",
    "file",
  ]);

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function applyTimestampTokens(value) {
    if (typeof value !== "string") {
      return value;
    }
    return value.replace(/\{timestamp\}/g, String(Date.now()));
  }

  function getFieldLabel(element) {
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    const parentLabel = element.closest("label");
    if (parentLabel) {
      return parentLabel.textContent.trim();
    }

    return (
      element.getAttribute("aria-label") ||
      element.getAttribute("placeholder") ||
      ""
    );
  }

  function fieldTokens(element) {
    const tokens = [
      element.name,
      element.id,
      getFieldLabel(element),
      element.getAttribute("autocomplete"),
    ];

    return tokens
      .filter(Boolean)
      .flatMap((token) => String(token).split(/[\s_\-./[\]]+/))
      .map(normalizeKey)
      .filter(Boolean);
  }

  function lookupDefault(tokens, defaultsMap) {
    for (const token of tokens) {
      if (defaultsMap[token] !== undefined) {
        return defaultsMap[token];
      }
    }

    for (const [key, value] of Object.entries(defaultsMap)) {
      const normalizedKey = normalizeKey(key);
      if (tokens.some((token) => token === normalizedKey || token.includes(normalizedKey) || normalizedKey.includes(token))) {
        return value;
      }
    }

    return undefined;
  }

  function inferGenericValue(element, tokens) {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
    const joined = tokens.join(" ");

    if (type === "email" || joined.includes("email")) {
      if (joined.includes("confirm") || joined.includes("verify")) {
        return applyTimestampTokens("test+{timestamp}@example.com");
      }
      if (joined.includes("alternate") || joined.includes("secondary")) {
        return applyTimestampTokens("alt+{timestamp}@example.com");
      }
      return applyTimestampTokens("test+{timestamp}@example.com");
    }
    if (type === "tel" || joined.includes("phone") || joined.includes("mobile") || joined.includes("tel") || joined.includes("fax")) {
      if (joined.includes("emergency")) {
        return "5555550111";
      }
      if (joined.includes("work")) {
        return "5555550102";
      }
      if (joined.includes("home")) {
        return "5555550100";
      }
      if (joined.includes("cell") || joined.includes("mobile")) {
        return "5555550101";
      }
      return "5555550100";
    }
    if (type === "url" || joined.includes("website") || joined.includes("url")) {
      return "https://example.com";
    }
    if (type === "date" || joined.includes("dob") || joined.includes("birth")) {
      return "1990-01-15";
    }
    if (type === "number" || joined.includes("age")) {
      return joined.includes("age") ? "32" : "42";
    }
    if (autocomplete === "given-name" || joined.includes("firstname") || joined.includes("fname")) {
      return "Jane";
    }
    if (autocomplete === "family-name" || joined.includes("lastname") || joined.includes("lname") || joined.includes("surname")) {
      return "Doe";
    }
    if (joined.includes("middlename") || joined.includes("middle")) {
      return "Marie";
    }
    if (joined.includes("guardian") || (joined.includes("parent") && joined.includes("name"))) {
      return "John Doe";
    }
    if (joined.includes("emergency") && joined.includes("name")) {
      return "John Doe";
    }
    if (joined.includes("emergency") && joined.includes("relationship")) {
      return "Spouse";
    }
    if (autocomplete === "name" || joined === "name" || joined.includes("fullname")) {
      return "Jane Doe";
    }
    if (joined.includes("address") && (joined.includes("2") || joined.includes("line2") || joined.includes("apt"))) {
      return "Apt 4B";
    }
    if (joined.includes("street") || joined.includes("address")) {
      return "123 Main Street";
    }
    if (joined.includes("city") || joined.includes("locality") || joined.includes("town")) {
      return "Richmond";
    }
    if (joined.includes("state") || joined.includes("province") || joined.includes("region")) {
      return "VA";
    }
    if (joined.includes("county")) {
      return "Orange County";
    }
    if (joined.includes("zip") || joined.includes("postal")) {
      return "23220";
    }
    if (joined.includes("country")) {
      return "United States";
    }
    if (joined.includes("company") || joined.includes("organization") || joined.includes("employer")) {
      return "Example Corp";
    }
    if (joined.includes("insurance") && (joined.includes("member") || joined.includes("id"))) {
      return "MEM123456";
    }
    if (joined.includes("insurance") && joined.includes("group")) {
      return "GRP789";
    }
    if (joined.includes("policy") || joined.includes("memberid")) {
      return "POL456789";
    }
    if (joined.includes("insurance") || joined.includes("provider")) {
      return "Example Health";
    }
    if (joined.includes("school")) {
      return "Example Elementary";
    }
    if (joined.includes("grade")) {
      return "5";
    }
    if (joined.includes("marital")) {
      return "Single";
    }
    if (joined.includes("language")) {
      return "English";
    }
    if (joined.includes("occupation")) {
      return "Software Engineer";
    }
    if (joined.includes("job") || joined.includes("title") || joined.includes("position")) {
      return "Software Engineer";
    }
    if (joined.includes("hear") || joined.includes("referral") || joined.includes("source")) {
      return "Web search";
    }
    if (joined.includes("preferred") && (joined.includes("date") || joined.includes("time"))) {
      return joined.includes("time") ? "10:00 AM" : "2026-07-01";
    }
    if (joined.includes("appointment") && joined.includes("time")) {
      return "10:00 AM";
    }
    if (joined.includes("appointment") && joined.includes("date")) {
      return "2026-07-01";
    }
    if (joined.includes("timezone") || joined.includes("time zone")) {
      return "America/New_York";
    }
    if (joined.includes("subject")) {
      return "Test inquiry";
    }
    if (joined.includes("message") || joined.includes("comment") || joined.includes("reason") || joined.includes("inquiry")) {
      return "This is test content for form development.";
    }
    if (type === "checkbox") {
      return element.required ? "true" : "false";
    }
    if (element.tagName === "SELECT") {
      const option = Array.from(element.options).find((entry) => entry.value);
      return option ? option.value : "";
    }
    if (element.tagName === "TEXTAREA") {
      return "This is test content for form development.";
    }
    if (type === "password") {
      return "TestPassword123!";
    }

    return "Test value";
  }

  function buildDefaultsMap(defaults, presetFields, mode) {
    const normalized = {};

    for (const [key, value] of Object.entries(defaults || {})) {
      normalized[normalizeKey(key)] = applyTimestampTokens(String(value));
    }

    if (mode !== "generic" && presetFields) {
      for (const [key, value] of Object.entries(presetFields)) {
        normalized[normalizeKey(key)] = applyTimestampTokens(String(value));
      }
    }

    return normalized;
  }

  function isFillable(element) {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }

    const type = (element.getAttribute("type") || "text").toLowerCase();
    if (SKIP_TYPES.has(type)) {
      return false;
    }

    return true;
  }

  function collectFields() {
    const selector = "form input, form select, form textarea, input, select, textarea";
    const elements = Array.from(document.querySelectorAll(selector)).filter(isFillable);
    const seen = new Set();

    return elements
      .filter((element) => {
        const key = element.name || element.id || element.outerHTML.slice(0, 120);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((element) => {
        const tokens = fieldTokens(element);
        return {
          element,
          name: element.name || "",
          id: element.id || "",
          tag: element.tagName.toLowerCase(),
          type: (element.getAttribute("type") || element.tagName.toLowerCase()).toLowerCase(),
          label: getFieldLabel(element),
          tokens,
        };
      });
  }

  function resolveValue(field, defaultsMap, mode) {
    const directKeys = [field.name, field.id].filter(Boolean);
    for (const key of directKeys) {
      const normalized = normalizeKey(key);
      if (defaultsMap[normalized] !== undefined) {
        return defaultsMap[normalized];
      }
    }

    const fromDefaults = lookupDefault(field.tokens, defaultsMap);
    if (fromDefaults !== undefined) {
      return fromDefaults;
    }

    if (mode === "generic") {
      return inferGenericValue(field.element, field.tokens);
    }

    return inferGenericValue(field.element, field.tokens);
  }

  function setNativeValue(element, value) {
    if (element.tagName === "SELECT") {
      element.value = value;
      if (element.value !== value) {
        const option = Array.from(element.options).find((entry) => entry.value === value);
        if (option) {
          element.selectedIndex = option.index;
        } else {
          const first = Array.from(element.options).find((entry) => entry.value);
          if (first) {
            element.selectedIndex = first.index;
          }
        }
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (element.type === "checkbox") {
      element.checked = value === "true" || value === true;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (element.type === "radio") {
      if (String(element.value) === String(value)) {
        element.checked = true;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    const setter = descriptor && descriptor.set;

    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function scanForms() {
    const fields = collectFields();
    return {
      fieldCount: fields.length,
      fields: fields.map((field) => ({
        name: field.name,
        id: field.id,
        tag: field.tag,
        type: field.type,
        label: field.label,
      })),
    };
  }

  function fillForms(options) {
    const {
      defaults = {},
      presetFields = null,
      mode = "auto",
      scanOnly = false,
    } = options || {};

    const defaultsMap = buildDefaultsMap(defaults, presetFields, mode);
    const fields = collectFields();

    if (scanOnly) {
      return {
        scanOnly: true,
        fieldCount: fields.length,
        filledCount: 0,
        fields: fields.map((field) => ({
          name: field.name,
          id: field.id,
          tag: field.tag,
          type: field.type,
          label: field.label,
          previewValue: resolveValue(field, defaultsMap, mode),
        })),
      };
    }

    let filledCount = 0;
    const filledFields = [];

    for (const field of fields) {
      const value = resolveValue(field, defaultsMap, mode);
      if (value === undefined || value === "") {
        continue;
      }

      if (field.type === "radio") {
        const group = document.querySelectorAll(
          `input[type="radio"][name="${CSS.escape(field.name)}"]`
        );
        let matched = false;
        group.forEach((radio) => {
          if (String(radio.value) === String(value)) {
            setNativeValue(radio, value);
            matched = true;
          }
        });
        if (!matched && group.length > 0) {
          setNativeValue(group[0], group[0].value);
          matched = true;
        }
        if (matched) {
          filledCount += 1;
          filledFields.push({
            name: field.name,
            id: field.id,
            value,
          });
        }
        continue;
      }

      setNativeValue(field.element, value);
      filledCount += 1;
      filledFields.push({
        name: field.name,
        id: field.id,
        value,
      });
    }

    return {
      scanOnly: false,
      fieldCount: fields.length,
      filledCount,
      fields: filledFields,
    };
  }

  globalThis.DtpFormInjectEngine = {
    scanForms,
    fillForms,
  };
})();
