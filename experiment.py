import math
import random
from pathlib import Path

from markupsafe import Markup

import psynet.experiment
from psynet.consent import NoConsent
from psynet.modular_page import Control, ModularPage
from psynet.page import InfoPage
from psynet.timeline import EndPage, Event, PageMaker, Timeline

OCTAVE_RATIOS = [round(1.9 + i * 0.01, 2) for i in range(21)]  # 1.90 … 2.10
FUNDAMENTAL_HZ = 440.0 * (2 ** ((60 - 69) / 12))  # Middle C (C4), ~261.63 Hz
N_PARTIALS = 10
INTERVAL_CENTS_TOLERANCE = 100

INTERVAL_TARGETS = [
    {"label": "major_third", "name": "Major third", "ji_ratio": 5 / 4, "tet_semitones": 4},
    {"label": "perfect_fifth", "name": "Perfect fifth", "ji_ratio": 3 / 2, "tet_semitones": 7},
    {"label": "major_sixth", "name": "Major sixth", "ji_ratio": 5 / 3, "tet_semitones": 9},
    {"label": "octave", "name": "Octave", "ji_ratio": 2.0, "tet_semitones": 12},
]

INTERVAL_TIMBRES = [
    {"key": "harmonic", "name": "Harmonic", "octave_ratio": 2.0},
    {"key": "compressed", "name": "Compressed", "octave_ratio": 1.9},
    {"key": "stretched", "name": "Stretched", "octave_ratio": 2.1},
]


def sample_octave_ratio() -> float:
    return random.choice(OCTAVE_RATIOS)


def fixed_ratios(octave_ratio: float, n_partials: int = N_PARTIALS) -> list[float]:
    return [1 + (n - 1) * (octave_ratio - 1) for n in range(1, n_partials + 1)]


def fixed_hz_values(
    octave_ratio: float,
    fundamental_hz: float = FUNDAMENTAL_HZ,
    n_partials: int = N_PARTIALS,
) -> list[float]:
    return [fundamental_hz * ratio for ratio in fixed_ratios(octave_ratio, n_partials)]


def cents_to_ratio(cents: float) -> float:
    return 2 ** (cents / 1200)


def ratio_to_cents(ratio: float) -> float:
    return 1200 * math.log2(ratio)


def interval_ratio_bounds(ji_ratio: float, tolerance_cents: float = INTERVAL_CENTS_TOLERANCE):
    factor = cents_to_ratio(tolerance_cents)
    return ji_ratio / factor, ji_ratio * factor


def equal_temperament_ratio(semitones: int) -> float:
    return 2 ** (semitones / 12)


def interval_timbres_with_partials(n_partials: int = N_PARTIALS) -> list[dict]:
    return [
        {
            **timbre,
            "partial_ratios": fixed_ratios(timbre["octave_ratio"], n_partials),
        }
        for timbre in INTERVAL_TIMBRES
    ]


class TimbreSliderControl(Control):
    macro = "timbre_sliders"
    external_template = "timbre-sliders.html"

    def __init__(
        self,
        octave_ratio: float,
        fundamental_hz: float = FUNDAMENTAL_HZ,
        n_partials: int = N_PARTIALS,
    ):
        super().__init__()
        self.octave_ratio = octave_ratio
        self.fundamental_hz = fundamental_hz
        self.n_partials = n_partials
        self.fixed_ratios = fixed_ratios(octave_ratio, n_partials)
        self.fixed_hz = fixed_hz_values(octave_ratio, self.fundamental_hz, n_partials)
        self.max_hz = self.fundamental_hz * self.fixed_ratios[-1] * 1.5

    @property
    def metadata(self):
        return {
            "octave_ratio": self.octave_ratio,
            "fundamental_hz": self.fundamental_hz,
            "fixed_hz": self.fixed_hz,
        }

    def format_answer(self, raw_answer, **kwargs):
        return raw_answer

    def get_bot_response(self, experiment, bot, page, prompt):
        hz_range = self.max_hz - self.fundamental_hz
        free_hz = [
            min(hz + 0.05 * hz_range, self.max_hz) for hz in self.fixed_hz
        ]
        return {
            "octave_ratio": self.octave_ratio,
            "fundamental_hz": self.fundamental_hz,
            "fixed_hz": self.fixed_hz,
            "free_hz": free_hz,
            "tone_ratios": [free / fixed for free, fixed in zip(free_hz, self.fixed_hz)],
            "playback_mode": "full",
            "selected_partial": 1,
        }


class IntervalSliderControl(Control):
    macro = "interval_slider"
    external_template = "interval-slider.html"

    def __init__(
        self,
        target_name: str,
        ji_ratio: float,
        tet_ratio: float,
        trial_label: str,
        fundamental_hz: float = FUNDAMENTAL_HZ,
        n_partials: int = N_PARTIALS,
        tolerance_cents: float = INTERVAL_CENTS_TOLERANCE,
    ):
        super().__init__()
        self.target_name = target_name
        self.ji_ratio = ji_ratio
        self.tet_ratio = tet_ratio
        self.trial_label = trial_label
        self.fundamental_hz = fundamental_hz
        self.n_partials = n_partials
        self.timbres = interval_timbres_with_partials(n_partials)
        self.min_ratio, self.max_ratio = interval_ratio_bounds(ji_ratio, tolerance_cents)

    @property
    def metadata(self):
        return {
            "target_name": self.target_name,
            "ji_ratio": self.ji_ratio,
            "tet_ratio": self.tet_ratio,
            "trial_label": self.trial_label,
            "timbres": self.timbres,
        }

    def format_answer(self, raw_answer, **kwargs):
        return raw_answer

    def get_bot_response(self, experiment, bot, page, prompt):
        answer = {
            "trial_label": self.trial_label,
            "target_name": self.target_name,
            "fundamental_hz": self.fundamental_hz,
            "ji_ratio": self.ji_ratio,
        }
        for timbre in INTERVAL_TIMBRES:
            answer[f"f0_ratio_{timbre['key']}"] = self.ji_ratio
            answer[f"cents_from_ji_{timbre['key']}"] = 0.0
        return answer


def make_interval_trial_page(target: dict) -> ModularPage:
    return ModularPage(
        f"interval_{target['label']}",
        prompt=Markup(
            f"""
            <p>
                You will hear two complex tones at once (fundamental
                <strong>middle C</strong>, {FUNDAMENTAL_HZ:.1f} Hz). Use the three
                sliders to tune the interval for each timbre: <strong>harmonic</strong>
                (2:1), <strong>compressed</strong> (1.9:1), and <strong>stretched</strong>
                (2.1:1). Only one timbre plays at a time — drag a slider to hear it.
                Use the <strong>Lower</strong>, <strong>Upper</strong>, and <strong>Both</strong>
                buttons to preview each tone in isolation. Click the <strong>JI</strong> or
                <strong>12-TET</strong> markers (or snap buttons) to jump to those reference
                tunings. Sliders are marked for just-intonation (JI) and 12-tone equal
                temperament (12-TET) tunings.
            </p>
            <p>
                Adjust each slider until the interval sounds as pleasant as possible for a
                <strong>{target["name"]}</strong>. Each slider is limited to
                ±{INTERVAL_CENTS_TOLERANCE} cents around the just-intonation
                {target["name"].lower()} ({target["ji_ratio"]:.3f}:1).
            </p>
            """
        ),
        control=IntervalSliderControl(
            target_name=target["name"],
            ji_ratio=target["ji_ratio"],
            tet_ratio=equal_temperament_ratio(target["tet_semitones"]),
            trial_label=target["label"],
        ),
        time_estimate=60,
        save_answer=f"interval_{target['label']}",
        events={
            "stopAudio": Event(
                is_triggered_by="trialEnd",
                js="if (typeof stopIntervalAudio === 'function') stopIntervalAudio();",
            ),
        },
    )


def make_interval_trials(participant):
    return [make_interval_trial_page(target) for target in INTERVAL_TARGETS]


def format_interval_results_html(answers: list[dict]) -> Markup:
    timbre_headers = "".join(
        f"<th>{timbre['name']} f0 ratio</th><th>{timbre['name']} Δ from JI</th>"
        for timbre in INTERVAL_TIMBRES
    )
    rows = []
    for answer in answers:
        timbre_cells = "".join(
            f"""
            <td>{answer[f"f0_ratio_{timbre['key']}"]:.3f}:1</td>
            <td>{answer[f"cents_from_ji_{timbre['key']}"]:+.1f} cents</td>
            """
            for timbre in INTERVAL_TIMBRES
        )
        rows.append(
            f"""
            <tr>
                <td>{answer["target_name"]}</td>
                <td>{answer["ji_ratio"]:.3f}:1</td>
                {timbre_cells}
            </tr>
            """
        )

    timbre_summary = ", ".join(
        f"{timbre['name']} ({timbre['octave_ratio']}:1)" for timbre in INTERVAL_TIMBRES
    )

    return Markup(
        f"""
        <h3>Interval tuning results</h3>
        <p>
            Timbres: <strong>{timbre_summary}</strong>
            <br>
            Fundamental: <strong>middle C ({FUNDAMENTAL_HZ:.1f} Hz)</strong>
        </p>
        <table class="table table-striped table-sm" style="max-width: 1100px; margin: 0 auto;">
            <thead>
                <tr>
                    <th>Target interval</th>
                    <th>Just intonation</th>
                    {timbre_headers}
                </tr>
            </thead>
            <tbody>
                {"".join(rows)}
            </tbody>
        </table>
        """
    )


def make_interval_results_page(participant) -> InfoPage:
    answers = [
        participant.var.get(f"interval_{target['label']}") for target in INTERVAL_TARGETS
    ]
    return InfoPage(
        format_interval_results_html(answers),
        time_estimate=30,
    )


DEBRIEF_PATH = Path(__file__).resolve().parent / "debrief.html"


class DebriefEndPage(EndPage):
    """Terminal debrief page with no Next button."""

    def __init__(self, content: str, time_estimate: float = 60):
        from psynet.timeline import Page

        Page.__init__(
            self,
            time_estimate=time_estimate,
            template_str=(
                '{% extends "timeline-page.html" %}'
                "{% block main_body %}"
                "{{ content | safe }}"
                "{% endblock %}"
            ),
            template_arg={"content": content},
            label="debrief",
        )

    def finalize_participant(self, experiment, participant):
        participant.complete = True


def debrief_page(time_estimate: float = 60) -> DebriefEndPage:
    content = DEBRIEF_PATH.read_text(encoding="utf-8")
    return DebriefEndPage(content, time_estimate=time_estimate)


def make_game_page() -> ModularPage:
    octave_ratio = sample_octave_ratio()
    return ModularPage(
        "timbre_game",
        prompt=Markup(
            f"""
            <p>
                Move the <strong>open circles</strong> to make the chord sound as
                pleasant as possible. The <strong>filled circles</strong> show the
                timbre spacing for this trial. Sound plays continuously as you adjust
                the knobs.
            </p>
            <p>
                Fundamental frequency: <strong>middle C</strong> ({FUNDAMENTAL_HZ:.1f} Hz).
            </p>
            <p>
                Use <strong>Full chord</strong> to hear all chosen tones together, or
                <strong>Pair</strong> to focus on the fixed and chosen tones from a
                single partial (click a row to select which one).
            </p>
            """
        ),
        control=TimbreSliderControl(octave_ratio=octave_ratio),
        time_estimate=120,
        save_answer="timbre_game",
        events={
            "stopAudio": Event(
                is_triggered_by="trialEnd",
                js="if (typeof stopTimbreAudio === 'function') stopTimbreAudio();",
            ),
        },
    )


def format_results_html(answer: dict) -> Markup:
    fixed_hz = answer["fixed_hz"]
    free_hz = answer["free_hz"]
    rows = []
    for index, (fixed, free) in enumerate(zip(fixed_hz, free_hz), start=1):
        ratio = free / fixed if fixed else 0.0
        rows.append(
            f"""
            <tr>
                <td>Partial {index}</td>
                <td>{fixed:.1f} Hz</td>
                <td>{free:.1f} Hz</td>
                <td>{ratio:.3f}:1</td>
            </tr>
            """
        )

    return Markup(
        f"""
        <h3>Your tuning results</h3>
        <p>
            Octave stretch ratio for this trial:
            <strong>{answer["octave_ratio"]}:1</strong>
            &nbsp;|&nbsp;
            Fundamental:
            <strong>middle C ({answer["fundamental_hz"]:.1f} Hz)</strong>
        </p>
        <table class="table table-striped table-sm" style="max-width: 640px; margin: 0 auto;">
            <thead>
                <tr>
                    <th>Partial</th>
                    <th>Set tone (fixed)</th>
                    <th>Chosen tone (free)</th>
                    <th>Chosen / set ratio</th>
                </tr>
            </thead>
            <tbody>
                {"".join(rows)}
            </tbody>
        </table>
        """
    )


def make_results_page(participant) -> InfoPage:
    if participant.var.has("timbre_game"):
        answer = participant.var.get("timbre_game")
    else:
        answer = participant.answer
    return InfoPage(
        format_results_html(answer),
        time_estimate=30,
    )


class Exp(psynet.experiment.Experiment):
    label = "Timbre consonance demo"

    timeline = Timeline(
        NoConsent(),
        # InfoPage(
        #     Markup(
        #         """
        #         <h3>Timbre and consonance</h3>
        #         <p>
        #             In this demo you will hear a chord made from ten pure tones
        #             (partials). Each partial has a fixed reference pitch (filled
        #             circle) determined by a stretched or compressed timbre. Your
        #             task is to move the open circles to higher pitches until the
        #             overall sound feels consonant and pleasant.
        #         </p>
        #         <p>
        #             You can switch between hearing the <strong>full chord</strong>
        #             or a <strong>pair</strong> of tones from one partial at a time.
        #         </p>
        #         <p>
        #             Please use <strong>headphones</strong> and adjust your volume to a
        #             comfortable level before continuing.
        #         </p>
        #         """
        #     ),
        #     time_estimate=30,
        # ),
        # PageMaker(make_game_page, time_estimate=120),
        # PageMaker(make_results_page, time_estimate=30),
        InfoPage(
            Markup(
                """
                <h3>Interval tuning</h3>
                <p>
                    On each trial you will see <strong>three sliders</strong> for
                    harmonic (2:1), compressed (1.9:1), and stretched (2.1:1)
                    timbres. Adjust each to find a pleasant interval; only one timbre
                    plays at a time.
                </p>
                """
            ),
            time_estimate=30,
        ),
        PageMaker(make_interval_trials, time_estimate=240),
        PageMaker(make_interval_results_page, time_estimate=30),
        debrief_page(),
    )
