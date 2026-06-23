/**
 * Built-in mock values for commonly requested form fields.
 * Keys cover typical name/id/autocomplete variants; matched case-insensitively in the engine.
 * Use {timestamp} in a value to insert Date.now() at fill time.
 */
export const DEFAULT_FIELD_VALUES = {
  // —— Name ——
  firstName: "Jane",
  first_name: "Jane",
  fname: "Jane",
  givenName: "Jane",
  given_name: "Jane",
  lastName: "Doe",
  last_name: "Doe",
  lname: "Doe",
  surname: "Doe",
  familyName: "Doe",
  family_name: "Doe",
  name: "Jane Doe",
  fullName: "Jane Doe",
  full_name: "Jane Doe",
  displayName: "Jane Doe",
  display_name: "Jane Doe",
  middleName: "Marie",
  middle_name: "Marie",
  preferredName: "Jane",
  preferred_name: "Jane",
  nickname: "Janie",
  prefix: "Ms.",
  suffix: "Jr.",
  maidenName: "Smith",
  maiden_name: "Smith",

  // —— Contact ——
  email: "test+{timestamp}@example.com",
  emailAddress: "test+{timestamp}@example.com",
  email_address: "test+{timestamp}@example.com",
  confirmEmail: "test+{timestamp}@example.com",
  confirm_email: "test+{timestamp}@example.com",
  emailConfirm: "test+{timestamp}@example.com",
  alternateEmail: "alt+{timestamp}@example.com",
  alternate_email: "alt+{timestamp}@example.com",
  phone: "5555550100",
  phoneNumber: "5555550100",
  phone_number: "5555550100",
  tel: "5555550100",
  telephone: "5555550100",
  homePhone: "5555550100",
  home_phone: "5555550100",
  workPhone: "5555550102",
  work_phone: "5555550102",
  mobile: "5555550101",
  cell: "5555550101",
  cellPhone: "5555550101",
  cell_phone: "5555550101",
  secondaryPhone: "5555550103",
  secondary_phone: "5555550103",
  fax: "5555550199",
  preferredContactMethod: "Email",
  preferred_contact_method: "Email",

  // —— Address ——
  address: "123 Main Street",
  address1: "123 Main Street",
  addressLine1: "123 Main Street",
  address_line1: "123 Main Street",
  street: "123 Main Street",
  streetAddress: "123 Main Street",
  street_address: "123 Main Street",
  mailingAddress: "123 Main Street",
  mailing_address: "123 Main Street",
  billingAddress: "123 Main Street",
  billing_address: "123 Main Street",
  address2: "Apt 4B",
  addressLine2: "Apt 4B",
  address_line2: "Apt 4B",
  apt: "4B",
  unit: "4B",
  suite: "4B",
  city: "Richmond",
  locality: "Richmond",
  town: "Richmond",
  state: "VA",
  province: "VA",
  region: "VA",
  county: "Orange County",
  zip: "23220",
  zipCode: "23220",
  zip_code: "23220",
  postalCode: "23220",
  postal_code: "23220",
  postCode: "23220",
  country: "United States",
  countryCode: "US",
  country_code: "US",

  // —— Work / org ——
  company: "Example Corp",
  organization: "Example Corp",
  organisation: "Example Corp",
  org: "Example Corp",
  employer: "Example Corp",
  jobTitle: "Software Engineer",
  job_title: "Software Engineer",
  title: "Software Engineer",
  position: "Software Engineer",
  occupation: "Software Engineer",
  department: "Engineering",
  website: "https://example.com",
  url: "https://example.com",
  linkedIn: "https://linkedin.com/in/example",
  linkedin: "https://linkedin.com/in/example",

  // —— Demographics ——
  age: "32",
  dob: "1990-01-15",
  dateOfBirth: "1990-01-15",
  date_of_birth: "1990-01-15",
  birthDate: "1990-01-15",
  gender: "Prefer not to say",
  sex: "Prefer not to say",
  maritalStatus: "Single",
  marital_status: "Single",
  preferredLanguage: "English",
  preferred_language: "English",
  language: "English",
  ethnicity: "Prefer not to say",
  race: "Prefer not to say",

  // —— Emergency / guardian (common on intake forms) ——
  emergencyContactName: "John Doe",
  emergency_contact_name: "John Doe",
  emergencyContactPhone: "5555550111",
  emergency_contact_phone: "5555550111",
  emergencyContactRelationship: "Spouse",
  emergency_contact_relationship: "Spouse",
  guardianName: "John Doe",
  guardian_name: "John Doe",
  parentName: "John Doe",
  parent_name: "John Doe",
  parentGuardianName: "John Doe",
  parent_guardian_name: "John Doe",

  // —— Insurance / healthcare ——
  insuranceProvider: "Example Health",
  insurance_provider: "Example Health",
  insuranceCompany: "Example Health",
  insurance_company: "Example Health",
  insuranceType: "Other",
  insurance_type: "Other",
  insuranceMemberId: "MEM123456",
  insurance_member_id: "MEM123456",
  memberId: "MEM123456",
  member_id: "MEM123456",
  insuranceGroupNumber: "GRP789",
  insurance_group_number: "GRP789",
  groupNumber: "GRP789",
  group_number: "GRP789",
  policyNumber: "POL456789",
  policy_number: "POL456789",
  primaryCarePhysician: "Dr. Example",
  primary_care_physician: "Dr. Example",

  // —— Education (common on pediatric / school forms) ——
  school: "Example Elementary",
  schoolName: "Example Elementary",
  school_name: "Example Elementary",
  grade: "5",
  gradeLevel: "5",
  grade_level: "5",

  // —— Scheduling ——
  preferredDate: "2026-07-01",
  preferred_date: "2026-07-01",
  appointmentDate: "2026-07-01",
  appointment_date: "2026-07-01",
  preferredTime: "10:00 AM",
  preferred_time: "10:00 AM",
  appointmentTime: "10:00 AM",
  appointment_time: "10:00 AM",
  timeZone: "America/New_York",
  timezone: "America/New_York",

  // —— Inquiry / message ——
  subject: "Test inquiry",
  message: "This is test content for form development.",
  comments: "This is test content for form development.",
  comment: "This is test content for form development.",
  reason: "Looking for general information.",
  description: "This is test content for form development.",
  notes: "Test notes for form development.",
  inquiry: "General inquiry for testing purposes.",
  question: "This is a test question.",
  howCanWeHelp: "I would like more information about your services.",
  howDidYouHear: "Web search",
  how_did_you_hear: "Web search",
  hearAboutUs: "Web search",
  hear_about_us: "Web search",
  referralSource: "Web search",
  referral_source: "Web search",
  source: "Web search",

  // —— Service-specific (Wendy intake) ——
  serviceSeeking: "Counseling",
  service_seeking: "Counseling",

  // —— Account (dev/testing only — never real secrets) ——
  username: "testuser",
  userName: "testuser",
  password: "TestPassword123!",
};

/**
 * Canonical keys shown in the settings editor and help panel.
 * One entry per logical field — aliases live in DEFAULT_FIELD_VALUES above.
 */
export const STARTER_FIELD_KEYS = [
  "firstName",
  "lastName",
  "middleName",
  "name",
  "email",
  "confirmEmail",
  "phone",
  "mobile",
  "homePhone",
  "workPhone",
  "address",
  "address2",
  "city",
  "state",
  "county",
  "zip",
  "country",
  "company",
  "jobTitle",
  "occupation",
  "website",
  "dateOfBirth",
  "age",
  "gender",
  "maritalStatus",
  "preferredLanguage",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
  "guardianName",
  "insuranceProvider",
  "insuranceType",
  "insuranceMemberId",
  "insuranceGroupNumber",
  "policyNumber",
  "school",
  "grade",
  "preferredDate",
  "preferredTime",
  "howDidYouHear",
  "subject",
  "message",
  "reason",
  "comments",
];

/** Human-readable groups for the settings help panel in the popup. */
export const DEFAULT_FIELD_GROUPS = [
  {
    label: "Name",
    keys: ["firstName", "lastName", "middleName", "name", "preferredName", "nickname"],
  },
  {
    label: "Contact",
    keys: [
      "email",
      "confirmEmail",
      "alternateEmail",
      "phone",
      "mobile",
      "homePhone",
      "workPhone",
      "fax",
      "preferredContactMethod",
    ],
  },
  {
    label: "Address",
    keys: [
      "address",
      "address2",
      "city",
      "state",
      "county",
      "zip",
      "postalCode",
      "country",
      "mailingAddress",
      "billingAddress",
    ],
  },
  {
    label: "Work",
    keys: ["company", "jobTitle", "occupation", "department", "website", "linkedIn"],
  },
  {
    label: "Demographics",
    keys: ["dateOfBirth", "age", "gender", "maritalStatus", "preferredLanguage"],
  },
  {
    label: "Emergency / guardian",
    keys: [
      "emergencyContactName",
      "emergencyContactPhone",
      "emergencyContactRelationship",
      "guardianName",
      "parentName",
    ],
  },
  {
    label: "Insurance / healthcare",
    keys: [
      "insuranceProvider",
      "insuranceType",
      "insuranceMemberId",
      "insuranceGroupNumber",
      "policyNumber",
      "primaryCarePhysician",
    ],
  },
  {
    label: "Education",
    keys: ["school", "grade"],
  },
  {
    label: "Scheduling",
    keys: ["preferredDate", "preferredTime", "appointmentDate", "timeZone"],
  },
  {
    label: "Inquiry / message",
    keys: [
      "subject",
      "message",
      "reason",
      "comments",
      "howDidYouHear",
      "referralSource",
      "howCanWeHelp",
    ],
  },
];

export function applyTimestampTokens(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/\{timestamp\}/g, String(Date.now()));
}

export function serializeDefaultsForEditor(defaults) {
  return JSON.stringify(defaults, null, 2);
}

export function buildStarterDefaultsObject() {
  const starter = {};
  for (const key of STARTER_FIELD_KEYS) {
    if (DEFAULT_FIELD_VALUES[key] !== undefined) {
      starter[key] = DEFAULT_FIELD_VALUES[key];
    }
  }
  return starter;
}

export function parseCustomDefaultsJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Invalid JSON. Check brackets, quotes, and commas." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Defaults must be a JSON object (not an array)." };
  }

  const value = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") {
      return { ok: false, error: `Value for "${key}" must be a string, number, or boolean.` };
    }
    value[key] = String(entry);
  }

  return { ok: true, value };
}
