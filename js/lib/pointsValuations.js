/**
 * US airline miles/points planning benchmarks (cents per mile).
 * Editorial estimates — not official airline valuations.
 */

export const VALUATIONS_LAST_UPDATED = "2026-06";

const PROGRAMS = [
  { id: "aa", label: "American AAdvantage", centsPerMile: 1.7 },
  { id: "ua", label: "United MileagePlus", centsPerMile: 1.2 },
  { id: "dl", label: "Delta SkyMiles", centsPerMile: 1.2 },
  { id: "wn", label: "Southwest Rapid Rewards", centsPerMile: 1.4 },
  { id: "as", label: "Alaska Atmos Rewards", centsPerMile: 1.5 },
  { id: "b6", label: "JetBlue TrueBlue", centsPerMile: 1.4 },
  { id: "f9", label: "Frontier miles", centsPerMile: 0.9 },
  { id: "nk", label: "Spirit Free Spirit", centsPerMile: 0.9 },
  { id: "ha", label: "HawaiianMiles", centsPerMile: 1.2 },
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
  };
}
