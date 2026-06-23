/**
 * Site-specific form presets. Matched against the active tab URL before fill.
 */
export const FORM_INJECT_PRESETS = [
  {
    id: "clients-wendy-intake",
    label: "Wendy intake (/contact)",
    matchPath: /\/contact\/?(\?|#|$)/i,
    fields: {
      name: "Alex Testpatient",
      email: "test.intake+{timestamp}@example.com",
      phone: "5405550100",
      age: "34",
      serviceSeeking: "Counseling",
      insuranceType: "Other",
      reason:
        "Looking for counseling support for stress management. This is a test submission.",
    },
  },
];

export function matchFormInjectPreset(urlString) {
  let pathname = "";
  try {
    pathname = new URL(urlString).pathname;
  } catch {
    return null;
  }

  for (const preset of FORM_INJECT_PRESETS) {
    if (preset.matchPath.test(pathname)) {
      return preset;
    }
  }

  return null;
}
