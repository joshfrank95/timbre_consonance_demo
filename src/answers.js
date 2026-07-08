import { centsFromReference } from "./math.js";

export function createIntervalAnswer({ trial, fundamentalHz, jiRatio, timbreStates }) {
  const answer = {
    trial_label: trial.label,
    target_name: trial.name,
    fundamental_hz: fundamentalHz,
    ji_ratio: jiRatio,
  };

  timbreStates.forEach(({ key, f0Ratio }) => {
    answer[`f0_ratio_${key}`] = f0Ratio;
    answer[`cents_from_ji_${key}`] = centsFromReference(f0Ratio, jiRatio);
  });

  return answer;
}
