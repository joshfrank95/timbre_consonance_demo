import { FUNDAMENTAL_HZ, N_PARTIALS } from "./constants.js";
import { createIntervalAnswer } from "./answers.js";
import { IntervalAudioEngine } from "./audio.js";
import {
  centsFromReference,
  equalTemperamentRatio,
  intervalRatioBounds,
  intervalTimbresWithPartials,
} from "./math.js";

const RAIL_PADDING = 0.06;
const USABLE_SPAN = 1 - 2 * RAIL_PADDING;

function formatRatio(ratio) {
  return `${ratio.toFixed(3)}:1`;
}

function formatCents(cents) {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}${cents.toFixed(1)} cents`;
}

function playbackModeLabel(mode) {
  if (mode === "lower") {
    return "lower tone only";
  }
  if (mode === "upper") {
    return "upper tone only";
  }
  return "both tones";
}

function ratioToFraction(ratio, minLog, logSpan) {
  const clampedLog = Math.max(minLog, Math.min(minLog + logSpan, Math.log(ratio)));
  const linear = (clampedLog - minLog) / logSpan;
  return RAIL_PADDING + linear * USABLE_SPAN;
}

function fractionToRatio(fraction, minLog, logSpan) {
  const clamped = Math.max(RAIL_PADDING, Math.min(1 - RAIL_PADDING, fraction));
  const linear = (clamped - RAIL_PADDING) / USABLE_SPAN;
  return Math.exp(minLog + linear * logSpan);
}

function pointerFractionFromRail(rail, clientX) {
  const rect = rail.getBoundingClientRect();
  return (clientX - rect.left) / rect.width;
}

function conditionTemplate(timbre) {
  return `
    <div class="interval-condition" id="condition-${timbre.key}" data-condition="${timbre.key}">
      <div class="interval-condition-title">
        ${timbre.name} timbre (${timbre.octaveRatio}:1 octave)
      </div>
      <div class="interval-readout">
        Chosen f0 ratio: <strong class="ratio-readout">-</strong>
        <span class="text-muted mx-1">|</span>
        Deviation from JI: <strong class="cents-readout">-</strong>
      </div>
      <div class="interval-rail-wrap">
        <div class="interval-rail-labels">
          <span class="min-label">-</span>
          <span class="max-label">-</span>
        </div>
        <div class="interval-reference-labels">
          <button type="button" class="interval-snap-btn interval-snap-ji">-</button>
          <button type="button" class="interval-snap-btn interval-snap-tet">-</button>
        </div>
        <div class="interval-rail">
          <button type="button" class="interval-ji-marker" aria-label="Snap to just intonation"></button>
          <button type="button" class="interval-tet-marker" aria-label="Snap to 12-TET"></button>
          <div class="interval-knob"></div>
        </div>
      </div>
      <div class="interval-playback-buttons" role="group" aria-label="Playback mode">
        <button type="button" class="interval-playback-btn" data-mode="lower">Lower only</button>
        <button type="button" class="interval-playback-btn" data-mode="upper">Upper only</button>
        <button type="button" class="interval-playback-btn active" data-mode="both">Both</button>
      </div>
    </div>
  `;
}

export function renderIntervalTrial({ mount, trial, trialIndex, totalTrials, onSubmit }) {
  const tetRatio = equalTemperamentRatio(trial.tetSemitones);
  const { minRatio, maxRatio } = intervalRatioBounds(trial.jiRatio);
  const minLog = Math.log(minRatio);
  const logSpan = Math.log(maxRatio) - minLog;
  const timbres = intervalTimbresWithPartials(N_PARTIALS);
  const state = new Map(
    timbres.map((timbre) => [
      timbre.key,
      {
        ...timbre,
        f0Ratio: trial.jiRatio,
        playbackMode: "both",
      },
    ]),
  );
  let activeCondition = timbres[0].key;
  let audioUnavailable = false;

  mount.innerHTML = `
    <section class="card shadow-sm">
      <div class="card-body p-4 p-lg-5">
        <p class="text-uppercase text-primary fw-semibold small mb-2">
          Trial ${trialIndex + 1} of ${totalTrials}
        </p>
        <h1 class="h3 mb-3">Tune a ${trial.name.toLowerCase()}</h1>
        <p>
          You will hear two complex tones at once with a lower fundamental of
          <strong>middle C</strong> (${FUNDAMENTAL_HZ.toFixed(1)} Hz). Tune the
          interval separately for harmonic, compressed, and stretched timbres.
        </p>
        <p>
          Drag a slider to hear that timbre. Use <strong>Lower only</strong>,
          <strong>Upper only</strong>, and <strong>Both</strong> to preview each
          tone, or snap to the JI and 12-TET reference tunings.
        </p>

        <div id="interval-panel" class="mt-4">
          <div class="interval-meta">
            Target interval: <strong>${trial.name}</strong>
            <span class="text-muted mx-1">|</span>
            Fundamental: <strong>middle C</strong>
          </div>
          ${timbres.map(conditionTemplate).join("")}
          <div id="interval-audio-hint">
            Drag a slider, click JI or 12-TET markers to snap, or use the playback buttons.
            Only one timbre plays at a time.
          </div>
        </div>

        <div class="d-flex justify-content-between gap-3 mt-4">
          <div class="text-muted small align-self-center">
            Slider range: ${formatRatio(minRatio)} to ${formatRatio(maxRatio)}
          </div>
          <button type="button" class="btn btn-primary" id="continue-trial">
            ${trialIndex + 1 === totalTrials ? "Show results" : "Next interval"}
          </button>
        </div>
      </div>
    </section>
  `;

  const audioHint = mount.querySelector("#interval-audio-hint");
  const conditionEls = new Map(
    timbres.map((timbre) => [timbre.key, mount.querySelector(`#condition-${timbre.key}`)]),
  );

  const audioEngine = new IntervalAudioEngine({
    fundamentalHz: FUNDAMENTAL_HZ,
    nPartials: N_PARTIALS,
    timbres,
    getF0Ratio: (key) => state.get(key).f0Ratio,
    getPlaybackMode: (key) => state.get(key).playbackMode,
  });

  function getConditionEl(conditionKey) {
    return conditionEls.get(conditionKey);
  }

  function updateConditionHighlight() {
    conditionEls.forEach((el, key) => {
      el.classList.toggle("interval-condition-active", key === activeCondition);
    });
  }

  function updateReadout(conditionKey) {
    const condition = state.get(conditionKey);
    const el = getConditionEl(conditionKey);
    el.querySelector(".ratio-readout").textContent = formatRatio(condition.f0Ratio);
    el.querySelector(".cents-readout").textContent = formatCents(
      centsFromReference(condition.f0Ratio, trial.jiRatio),
    );
  }

  function setF0Ratio(conditionKey, ratio, updateAudio) {
    const condition = state.get(conditionKey);
    condition.f0Ratio = Math.max(minRatio, Math.min(maxRatio, ratio));

    const el = getConditionEl(conditionKey);
    el.querySelector(".interval-knob").style.left =
      `${ratioToFraction(condition.f0Ratio, minLog, logSpan) * 100}%`;
    updateReadout(conditionKey);

    if (updateAudio) {
      audioEngine.updateUpperFrequencies(conditionKey);
    }
  }

  function setActiveCondition(conditionKey) {
    activeCondition = conditionKey;
    audioEngine.setActiveKey(conditionKey);
    updateConditionHighlight();

    const condition = state.get(conditionKey);
    audioHint.textContent =
      `Playing ${condition.name.toLowerCase()} timbre (${playbackModeLabel(condition.playbackMode)}) - ` +
      "drag any slider to switch.";
  }

  function updatePlaybackButtons(conditionKey) {
    const el = getConditionEl(conditionKey);
    const mode = state.get(conditionKey).playbackMode;
    el.querySelectorAll(".interval-playback-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  }

  function setPlaybackMode(conditionKey, mode) {
    state.get(conditionKey).playbackMode = mode;
    updatePlaybackButtons(conditionKey);
    audioEngine.updatePlaybackGains();
  }

  function startAudio() {
    if (audioUnavailable) {
      return;
    }

    try {
      audioEngine.start();
    } catch (error) {
      audioUnavailable = true;
      audioHint.textContent = error.message;
      audioHint.classList.add("text-danger");
    }
  }

  function snapToRatio(conditionKey, ratio) {
    startAudio();
    setActiveCondition(conditionKey);
    setPlaybackMode(conditionKey, "both");
    setF0Ratio(conditionKey, ratio, true);
  }

  function initSlider(conditionKey) {
    const el = getConditionEl(conditionKey);
    const rail = el.querySelector(".interval-rail");
    const knob = el.querySelector(".interval-knob");
    const jiMarker = el.querySelector(".interval-ji-marker");
    const tetMarker = el.querySelector(".interval-tet-marker");
    const jiSnapBtn = el.querySelector(".interval-snap-ji");
    const tetSnapBtn = el.querySelector(".interval-snap-tet");
    const markersOverlap = Math.abs(trial.jiRatio - tetRatio) < 1e-6;
    let dragging = false;

    el.querySelector(".min-label").textContent = formatRatio(minRatio);
    el.querySelector(".max-label").textContent = formatRatio(maxRatio);
    jiSnapBtn.textContent = `Snap to JI ${formatRatio(trial.jiRatio)}`;
    tetSnapBtn.textContent = `Snap to 12-TET ${formatRatio(tetRatio)}`;
    jiMarker.style.left = `${ratioToFraction(trial.jiRatio, minLog, logSpan) * 100}%`;
    tetMarker.style.left = `${ratioToFraction(tetRatio, minLog, logSpan) * 100}%`;

    if (markersOverlap) {
      tetMarker.classList.add("overlap-ji");
      jiMarker.style.display = "none";
      jiSnapBtn.style.display = "none";
      tetSnapBtn.textContent = `Snap to JI / 12-TET ${formatRatio(trial.jiRatio)}`;
    }

    setF0Ratio(conditionKey, trial.jiRatio, false);
    updateReadout(conditionKey);

    [
      [jiMarker, trial.jiRatio],
      [tetMarker, tetRatio],
      [jiSnapBtn, trial.jiRatio],
      [tetSnapBtn, tetRatio],
    ].forEach(([control, ratio]) => {
      control.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        snapToRatio(conditionKey, ratio);
      });
    });

    el.querySelectorAll(".interval-playback-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        startAudio();
        setActiveCondition(conditionKey);
        setPlaybackMode(conditionKey, button.dataset.mode);
        audioHint.textContent =
          `Playing ${state.get(conditionKey).name.toLowerCase()} timbre ` +
          `(${playbackModeLabel(button.dataset.mode)}) - drag any slider to switch.`;
      });
    });

    function onPointerDown(event) {
      event.preventDefault();
      event.stopPropagation();
      startAudio();
      setActiveCondition(conditionKey);
      setPlaybackMode(conditionKey, "both");
      dragging = true;
      knob.setPointerCapture(event.pointerId);
      onPointerMove(event);
    }

    function onPointerMove(event) {
      if (!dragging) {
        return;
      }

      setF0Ratio(
        conditionKey,
        fractionToRatio(pointerFractionFromRail(rail, event.clientX), minLog, logSpan),
        true,
      );
    }

    function onPointerUp(event) {
      dragging = false;
      try {
        knob.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture may have already ended.
      }
    }

    knob.addEventListener("pointerdown", onPointerDown);
    knob.addEventListener("pointermove", onPointerMove);
    knob.addEventListener("pointerup", onPointerUp);
    knob.addEventListener("pointercancel", onPointerUp);

    rail.addEventListener("pointerdown", (event) => {
      if (event.target !== rail) {
        return;
      }

      startAudio();
      setActiveCondition(conditionKey);
      setPlaybackMode(conditionKey, "both");
      setF0Ratio(
        conditionKey,
        fractionToRatio(pointerFractionFromRail(rail, event.clientX), minLog, logSpan),
        true,
      );
    });

    el.addEventListener("pointerdown", () => {
      if (!dragging) {
        startAudio();
        setActiveCondition(conditionKey);
      }
    });
  }

  timbres.forEach((timbre) => initSlider(timbre.key));
  updateConditionHighlight();

  mount.querySelector("#continue-trial").addEventListener("click", () => {
    const answer = createIntervalAnswer({
      trial,
      fundamentalHz: FUNDAMENTAL_HZ,
      jiRatio: trial.jiRatio,
      timbreStates: Array.from(state.values()),
    });
    audioEngine.stop();
    onSubmit(answer);
  });

  return {
    destroy() {
      audioEngine.stop();
      mount.innerHTML = "";
    },
  };
}
