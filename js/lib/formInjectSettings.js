import {
  DEFAULT_FIELD_VALUES,
  buildStarterDefaultsObject,
  mergeFieldDefaults,
  parseCustomDefaultsJson,
  serializeDefaultsForEditor,
} from "./formInjectDefaults.js";

const STORAGE_KEYS = {
  customDefaultsJson: "formInjectCustomDefaultsJson",
  fillMode: "formInjectFillMode",
  profiles: "formInjectProfiles",
};

const DEFAULT_FILL_MODE = "auto";
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_NAME = "Default";

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultProfilesState(defaultsJson = "") {
  return {
    version: 1,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        defaultsJson: typeof defaultsJson === "string" ? defaultsJson : "",
      },
    ],
  };
}

function normalizeProfile(entry, index = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id =
    typeof entry.id === "string" && entry.id.trim()
      ? entry.id.trim()
      : index === 0
        ? DEFAULT_PROFILE_ID
        : createProfileId();
  const name =
    typeof entry.name === "string" && entry.name.trim()
      ? entry.name.trim()
      : index === 0
        ? DEFAULT_PROFILE_NAME
        : `Profile ${index + 1}`;
  const defaultsJson =
    typeof entry.defaultsJson === "string" ? entry.defaultsJson : "";

  return { id, name, defaultsJson };
}

function normalizeProfilesState(raw, legacyDefaultsJson = "") {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.profiles)) {
    return createDefaultProfilesState(legacyDefaultsJson);
  }

  const profiles = raw.profiles
    .map((entry, index) => normalizeProfile(entry, index))
    .filter(Boolean);

  if (profiles.length === 0) {
    return createDefaultProfilesState(legacyDefaultsJson);
  }

  const ids = new Set();
  const uniqueProfiles = [];
  for (const profile of profiles) {
    let id = profile.id;
    while (ids.has(id)) {
      id = createProfileId();
    }
    ids.add(id);
    uniqueProfiles.push({ ...profile, id });
  }

  const activeProfileId =
    typeof raw.activeProfileId === "string" &&
    uniqueProfiles.some((profile) => profile.id === raw.activeProfileId)
      ? raw.activeProfileId
      : uniqueProfiles[0].id;

  return {
    version: 1,
    activeProfileId,
    profiles: uniqueProfiles,
  };
}

function storageGet(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(defaults, (items) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(items);
    });
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

export function getDefaultFieldValues() {
  return { ...DEFAULT_FIELD_VALUES };
}

export async function getProfilesState() {
  const items = await storageGet({
    [STORAGE_KEYS.profiles]: null,
    [STORAGE_KEYS.customDefaultsJson]: "",
  });

  const legacyDefaultsJson = items[STORAGE_KEYS.customDefaultsJson] ?? "";
  const state = normalizeProfilesState(
    items[STORAGE_KEYS.profiles],
    legacyDefaultsJson
  );

  const needsPersist =
    !items[STORAGE_KEYS.profiles] ||
    !items[STORAGE_KEYS.profiles].profiles?.length;

  if (needsPersist) {
    await storageSet({ [STORAGE_KEYS.profiles]: state });
  }

  return state;
}

async function saveProfilesState(state) {
  const normalized = normalizeProfilesState(state);
  const active = normalized.profiles.find(
    (profile) => profile.id === normalized.activeProfileId
  );

  await storageSet({
    [STORAGE_KEYS.profiles]: normalized,
    // Keep legacy key in sync for any older readers.
    [STORAGE_KEYS.customDefaultsJson]: active?.defaultsJson ?? "",
  });

  return normalized;
}

export async function listFormInjectProfiles() {
  const state = await getProfilesState();
  return {
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    })),
  };
}

export async function getActiveProfile() {
  const state = await getProfilesState();
  return (
    state.profiles.find((profile) => profile.id === state.activeProfileId) ||
    state.profiles[0]
  );
}

export async function getProfileById(profileId) {
  const state = await getProfilesState();
  return state.profiles.find((profile) => profile.id === profileId) || null;
}

/** Active profile's defaults JSON (empty string means starter defaults at edit time). */
export async function getCustomDefaultsJson() {
  const profile = await getActiveProfile();
  return profile?.defaultsJson ?? "";
}

export function getCustomDefaults() {
  return getCustomDefaultsJson().then((raw) => {
    const parsed = parseCustomDefaultsJson(raw);
    return parsed.ok ? parsed.value : {};
  });
}

export function getFillMode() {
  return storageGet({ [STORAGE_KEYS.fillMode]: DEFAULT_FILL_MODE }).then(
    (items) => {
      const mode = items[STORAGE_KEYS.fillMode] ?? DEFAULT_FILL_MODE;
      return mode === "generic" ? "generic" : "auto";
    }
  );
}

export async function saveCustomDefaultsJson(raw) {
  const parsed = parseCustomDefaultsJson(raw);
  if (!parsed.ok) {
    return Promise.reject(new Error(parsed.error));
  }

  const state = await getProfilesState();
  const nextProfiles = state.profiles.map((profile) =>
    profile.id === state.activeProfileId
      ? { ...profile, defaultsJson: raw.trim() }
      : profile
  );

  await saveProfilesState({
    ...state,
    profiles: nextProfiles,
  });

  return parsed.value;
}

export async function saveProfileDefaultsJson(profileId, raw) {
  const parsed = parseCustomDefaultsJson(raw);
  if (!parsed.ok) {
    return Promise.reject(new Error(parsed.error));
  }

  const state = await getProfilesState();
  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("Profile not found.");
  }

  const nextProfiles = state.profiles.map((profile) =>
    profile.id === profileId
      ? { ...profile, defaultsJson: raw.trim() }
      : profile
  );

  await saveProfilesState({
    ...state,
    profiles: nextProfiles,
  });

  return parsed.value;
}

export function saveFillMode(mode) {
  const normalized = mode === "generic" ? "generic" : "auto";
  return storageSet({ [STORAGE_KEYS.fillMode]: normalized }).then(
    () => normalized
  );
}

export async function setActiveProfileId(profileId) {
  const state = await getProfilesState();
  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("Profile not found.");
  }

  return saveProfilesState({
    ...state,
    activeProfileId: profileId,
  });
}

export async function createFormInjectProfile({
  name,
  defaultsJson,
  makeActive = true,
} = {}) {
  const state = await getProfilesState();
  const active = state.profiles.find(
    (profile) => profile.id === state.activeProfileId
  );
  const trimmedName =
    typeof name === "string" && name.trim() ? name.trim() : "";
  const existingNames = new Set(
    state.profiles.map((profile) => profile.name.toLowerCase())
  );

  let nextName = trimmedName || "New profile";
  if (existingNames.has(nextName.toLowerCase())) {
    let suffix = 2;
    while (existingNames.has(`${nextName} ${suffix}`.toLowerCase())) {
      suffix += 1;
    }
    nextName = `${nextName} ${suffix}`;
  }

  const profile = {
    id: createProfileId(),
    name: nextName,
    defaultsJson:
      typeof defaultsJson === "string"
        ? defaultsJson
        : active?.defaultsJson || "",
  };

  const nextState = {
    ...state,
    activeProfileId: makeActive ? profile.id : state.activeProfileId,
    profiles: [...state.profiles, profile],
  };

  await saveProfilesState(nextState);
  return profile;
}

export async function renameFormInjectProfile(profileId, name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    throw new Error("Profile name cannot be empty.");
  }

  const state = await getProfilesState();
  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("Profile not found.");
  }

  const duplicate = state.profiles.some(
    (profile) =>
      profile.id !== profileId &&
      profile.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    throw new Error("A profile with that name already exists.");
  }

  const nextState = {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, name: trimmed } : profile
    ),
  };

  await saveProfilesState(nextState);
  return nextState.profiles.find((profile) => profile.id === profileId);
}

export async function deleteFormInjectProfile(profileId) {
  const state = await getProfilesState();
  if (state.profiles.length <= 1) {
    throw new Error("Keep at least one profile.");
  }

  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("Profile not found.");
  }

  const nextProfiles = state.profiles.filter(
    (profile) => profile.id !== profileId
  );
  const activeProfileId =
    state.activeProfileId === profileId
      ? nextProfiles[0].id
      : state.activeProfileId;

  return saveProfilesState({
    ...state,
    activeProfileId,
    profiles: nextProfiles,
  });
}

export function getMergedDefaults(customOverrides = {}) {
  return mergeFieldDefaults(customOverrides);
}

export function buildStarterDefaultsJson() {
  return serializeDefaultsForEditor(buildStarterDefaultsObject());
}

export { parseCustomDefaultsJson, serializeDefaultsForEditor };
