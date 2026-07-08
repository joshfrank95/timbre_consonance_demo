import { describe, expect, it } from "vitest";

import { FUNDAMENTAL_HZ, INTERVAL_TIMBRES } from "../src/constants.js";
import { createIntervalAnswer } from "../src/answers.js";
import {
  centsFromReference,
  centsToRatio,
  equalTemperamentRatio,
  fixedRatios,
  intervalRatioBounds,
  intervalTimbresWithPartials,
} from "../src/math.js";

describe("tuning math", () => {
  it("keeps middle C as the shared fundamental", () => {
    expect(FUNDAMENTAL_HZ).toBeCloseTo(261.6256, 4);
  });

  it("builds linear partial ratios from an octave stretch ratio", () => {
    expect(fixedRatios(1.9, 4)).toEqual([
      expect.closeTo(1),
      expect.closeTo(1.9),
      expect.closeTo(2.8),
      expect.closeTo(3.7),
    ]);
    expect(fixedRatios(2.1, 4)).toEqual([
      expect.closeTo(1),
      expect.closeTo(2.1),
      expect.closeTo(3.2),
      expect.closeTo(4.3),
    ]);
  });

  it("converts cents and equal-temperament steps to ratios", () => {
    expect(centsToRatio(1200)).toBeCloseTo(2);
    expect(equalTemperamentRatio(7)).toBeCloseTo(1.498307, 6);
  });

  it("computes symmetric ratio bounds around just intonation", () => {
    const bounds = intervalRatioBounds(3 / 2, 100);

    expect(centsFromReference(bounds.minRatio, 3 / 2)).toBeCloseTo(-100);
    expect(centsFromReference(bounds.maxRatio, 3 / 2)).toBeCloseTo(100);
  });

  it("adds partial ratios to each interval timbre", () => {
    const timbres = intervalTimbresWithPartials(3);

    expect(timbres).toHaveLength(INTERVAL_TIMBRES.length);
    expect(timbres.map((timbre) => timbre.partialRatios)).toEqual([
      [1, 2, 3],
      [1, 1.9, 2.8],
      [1, 2.1, 3.2],
    ]);
  });
});

describe("interval answers", () => {
  it("records f0 ratios and cents from just intonation for each timbre", () => {
    const answer = createIntervalAnswer({
      trial: { label: "perfect_fifth", name: "Perfect fifth" },
      fundamentalHz: FUNDAMENTAL_HZ,
      jiRatio: 3 / 2,
      timbreStates: [
        { key: "harmonic", f0Ratio: 3 / 2 },
        { key: "compressed", f0Ratio: equalTemperamentRatio(7) },
      ],
    });

    expect(answer).toMatchObject({
      trial_label: "perfect_fifth",
      target_name: "Perfect fifth",
      ji_ratio: 3 / 2,
      f0_ratio_harmonic: 3 / 2,
      f0_ratio_compressed: equalTemperamentRatio(7),
    });
    expect(answer.cents_from_ji_harmonic).toBeCloseTo(0);
    expect(answer.cents_from_ji_compressed).toBeCloseTo(-1.955, 3);
  });
});
