/**
 * Capital One travel partner miles planning benchmarks (cents per mile).
 * Editorial estimates — not official airline valuations.
 *
 * Sources (June 2026):
 * - The Points Guy monthly valuations (primary where listed)
 * - Upgraded Points June 2026 (Qatar Avios; programs TPG omits)
 * - Industry planning estimates for EVA Air (not on TPG list)
 *
 * @see https://thepointsguy.com/loyalty-programs/monthly-valuations/
 * @see https://upgradedpoints.com/travel/points-and-miles-valuations/
 */

export const VALUATIONS_LAST_UPDATED = "2026-06";
export const VALUATIONS_SOURCE = "TPG June 2026 (+ supplements)";

const PROGRAMS = [
  {
    id: "am",
    label: "Aeromexico Club Premier",
    centsPerMile: 0.8,
    regions:
      "Mexico, the U.S., Canada, Central America, parts of South America",
  },
  {
    id: "ac",
    label: "Air Canada Aeroplan",
    centsPerMile: 1.4,
    regions: "Canada, the U.S., Europe, Asia, Latin America",
  },
  {
    id: "af",
    label: "Air France-KLM Flying Blue",
    centsPerMile: 1.3,
    regions:
      "France, Europe, North Africa, the Middle East, North America, Asia, Africa",
  },
  {
    id: "av",
    label: "Avianca LifeMiles",
    centsPerMile: 1.4,
    regions: "Colombia, Latin America, the U.S., Europe",
  },
  {
    id: "ba",
    label: "British Airways Avios",
    centsPerMile: 1.4,
    regions: "UK, Europe, North America, Middle East, Africa, Asia",
  },
  {
    id: "cx",
    label: "Cathay Pacific Asia Miles",
    centsPerMile: 1.3,
    regions: "Hong Kong, Asia, Australia, North America, Europe",
  },
  {
    id: "ek",
    label: "Emirates Skywards",
    centsPerMile: 1.2,
    regions:
      "Middle East, Europe, Asia, Africa, Australia, North America",
  },
  {
    id: "ey",
    label: "Etihad Guest",
    centsPerMile: 1.2,
    regions:
      "Middle East, Europe, Asia, Africa, Australia, North America",
  },
  {
    id: "br",
    label: "EVA Air Infinity MileageLands",
    centsPerMile: 1.2,
    regions: "Taiwan, Asia, North America, Europe, Australia",
  },
  {
    id: "ay",
    label: "Finnair Plus",
    centsPerMile: 1.4,
    regions: "Finland, Europe, North America, Asia",
  },
  {
    id: "jl",
    label: "Japan Airlines Mileage Bank",
    centsPerMile: 1.4,
    regions: "Japan, Asia, North America, Europe, Australia",
  },
  {
    id: "b6",
    label: "JetBlue TrueBlue",
    centsPerMile: 1.35,
    regions: "U.S., Caribbean, Latin America, limited Europe",
  },
  {
    id: "qf",
    label: "Qantas Frequent Flyer",
    centsPerMile: 1.3,
    regions: "Australia, New Zealand, Asia, North America, Europe",
  },
  {
    id: "qr",
    label: "Qatar Airways Privilege Club",
    centsPerMile: 1.25,
    regions:
      "Middle East, Europe, Asia, Africa, North America, Australia",
  },
  {
    id: "sq",
    label: "Singapore Airlines KrisFlyer",
    centsPerMile: 1.3,
    regions:
      "Singapore, Asia, Europe, North America, Australia, Africa",
  },
  {
    id: "tp",
    label: "TAP Miles&Go",
    centsPerMile: 1.3,
    regions: "Portugal, Europe, North America, Africa, South America",
  },
  {
    id: "tk",
    label: "Turkish Airlines Miles&Smiles",
    centsPerMile: 1.1,
    regions:
      "Turkey, Europe, Asia, Africa, North America, South America",
  },
  {
    id: "ua",
    label: "United MileagePlus",
    centsPerMile: 1.35,
    regions:
      "U.S., Europe, Asia, Latin America, global Star Alliance partners",
  },
  {
    id: "vs",
    label: "Virgin Red",
    centsPerMile: 1.3,
    regions:
      "UK, Europe, North America, Caribbean, limited long-haul partner coverage",
  },
];

export const POINTS_PROGRAMS = [...PROGRAMS].sort((a, b) =>
  a.label.localeCompare(b.label)
);

const programById = new Map(PROGRAMS.map((program) => [program.id, program]));

export function getProgram(programId) {
  return programById.get(programId) ?? null;
}

export function estimateUsd(miles, programId) {
  const numericMiles = Number(miles);

  if (!Number.isFinite(numericMiles) || numericMiles <= 0) {
    throw new Error("Enter a valid miles amount greater than zero");
  }

  const program = getProgram(programId);
  if (!program) {
    throw new Error("Select a loyalty program");
  }

  const usd = (numericMiles * program.centsPerMile) / 100;

  return {
    usd,
    centsPerMile: program.centsPerMile,
    programLabel: program.label,
    regions: program.regions,
  };
}
