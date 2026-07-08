import { INTERVAL_CENTS_TOLERANCE, INTERVAL_TIMBRES, N_PARTIALS } from "./constants.js";

export function fixedRatios(octaveRatio, nPartials = N_PARTIALS) {
  return Array.from(
    { length: nPartials },
    (_, index) => 1 + index * (octaveRatio - 1),
  );
}

export function centsToRatio(cents) {
  return 2 ** (cents / 1200);
}

export function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio);
}

export function centsFromReference(ratio, referenceRatio) {
  return ratioToCents(ratio / referenceRatio);
}

export function intervalRatioBounds(
  jiRatio,
  toleranceCents = INTERVAL_CENTS_TOLERANCE,
) {
  const factor = centsToRatio(toleranceCents);
  return {
    minRatio: jiRatio / factor,
    maxRatio: jiRatio * factor,
  };
}

export function equalTemperamentRatio(semitones) {
  return 2 ** (semitones / 12);
}

export function intervalTimbresWithPartials(nPartials = N_PARTIALS) {
  return INTERVAL_TIMBRES.map((timbre) => ({
    ...timbre,
    partialRatios: fixedRatios(timbre.octaveRatio, nPartials),
  }));
}

export function harmonicWeights(partialRatios) {
  return partialRatios.map((_, index) => 1 / (index + 1) ** 2);
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
