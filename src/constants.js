export const OCTAVE_RATIOS = Array.from({ length: 21 }, (_, index) =>
  Number((1.9 + index * 0.01).toFixed(2)),
);

export const FUNDAMENTAL_HZ = 440.0 * 2 ** ((60 - 69) / 12);
export const N_PARTIALS = 10;
export const INTERVAL_CENTS_TOLERANCE = 100;

export const INTERVAL_TARGETS = [
  { label: "major_third", name: "Major third", jiRatio: 5 / 4, tetSemitones: 4 },
  { label: "perfect_fifth", name: "Perfect fifth", jiRatio: 3 / 2, tetSemitones: 7 },
  { label: "major_sixth", name: "Major sixth", jiRatio: 5 / 3, tetSemitones: 9 },
  { label: "octave", name: "Octave", jiRatio: 2.0, tetSemitones: 12 },
];

export const INTERVAL_TIMBRES = [
  { key: "harmonic", name: "Harmonic", octaveRatio: 2.0 },
  { key: "compressed", name: "Compressed", octaveRatio: 1.9 },
  { key: "stretched", name: "Stretched", octaveRatio: 2.1 },
];
