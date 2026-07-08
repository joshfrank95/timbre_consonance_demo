import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";

import { INTERVAL_TARGETS, INTERVAL_TIMBRES } from "./constants.js";
import { renderIntervalTrial } from "./intervalTrial.js";

const app = document.querySelector("#app");
let activeController = null;
let answers = [];

function formatRatio(ratio) {
  return `${ratio.toFixed(3)}:1`;
}

function formatCents(cents) {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}${cents.toFixed(1)} cents`;
}

function clearActiveController() {
  if (activeController) {
    activeController.destroy();
    activeController = null;
  }
}

function renderShell(content) {
  clearActiveController();
  app.innerHTML = `
    <main class="app-shell">
      ${content}
    </main>
  `;
}

function renderIntro() {
  answers = [];
  renderShell(`
    <section class="card hero-card shadow-sm">
      <div class="card-body p-4 p-lg-5">
        <p class="text-uppercase text-primary fw-semibold small mb-2">Timbre consonance demo</p>
        <h1 class="display-6 mb-3">Tune pleasant intervals for different timbres</h1>
        <p class="lead">
          On each trial you will see three sliders for harmonic (2:1), compressed
          (1.9:1), and stretched (2.1:1) timbres. Adjust each to find a pleasant
          interval; only one timbre plays at a time.
        </p>
        <p>
          The sound is generated in your browser using pure tones. Please use
          headphones if you have them, and set your volume to a comfortable level
          before starting.
        </p>
        <button type="button" class="btn btn-primary btn-lg" id="start-demo">
          Start tuning
        </button>
      </div>
    </section>
  `);

  app.querySelector("#start-demo").addEventListener("click", () => renderTrial(0));
}

function renderTrial(index) {
  clearActiveController();
  app.innerHTML = `<main class="app-shell" id="trial-mount"></main>`;

  activeController = renderIntervalTrial({
    mount: app.querySelector("#trial-mount"),
    trial: INTERVAL_TARGETS[index],
    trialIndex: index,
    totalTrials: INTERVAL_TARGETS.length,
    onSubmit(answer) {
      answers.push(answer);
      activeController = null;

      if (index + 1 < INTERVAL_TARGETS.length) {
        renderTrial(index + 1);
      } else {
        renderResults();
      }
    },
  });
}

function resultHeaderCells() {
  return INTERVAL_TIMBRES.map(
    (timbre) => `
      <th>${timbre.name} f0 ratio</th>
      <th>${timbre.name} delta from JI</th>
    `,
  ).join("");
}

function resultRows() {
  return answers.map((answer) => {
    const timbreCells = INTERVAL_TIMBRES.map(
      (timbre) => `
        <td>${formatRatio(answer[`f0_ratio_${timbre.key}`])}</td>
        <td>${formatCents(answer[`cents_from_ji_${timbre.key}`])}</td>
      `,
    ).join("");

    return `
      <tr>
        <td>${answer.target_name}</td>
        <td>${formatRatio(answer.ji_ratio)}</td>
        ${timbreCells}
      </tr>
    `;
  }).join("");
}

function renderResults() {
  const timbreSummary = INTERVAL_TIMBRES.map(
    (timbre) => `${timbre.name} (${timbre.octaveRatio}:1)`,
  ).join(", ");

  renderShell(`
    <section class="card shadow-sm">
      <div class="card-body p-4 p-lg-5">
        <p class="text-uppercase text-primary fw-semibold small mb-2">Results</p>
        <h1 class="h3 mb-3">Interval tuning results</h1>
        <p>
          Timbres: <strong>${timbreSummary}</strong><br>
          Fundamental: <strong>middle C</strong>
        </p>

        <div class="table-responsive">
          <table class="table table-striped table-sm align-middle results-table">
            <thead>
              <tr>
                <th>Target interval</th>
                <th>Just intonation</th>
                ${resultHeaderCells()}
              </tr>
            </thead>
            <tbody>
              ${resultRows()}
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <button type="button" class="btn btn-outline-secondary" id="restart-demo">
            Start over
          </button>
          <button type="button" class="btn btn-primary" id="show-debrief">
            Continue to debrief
          </button>
        </div>
      </div>
    </section>
  `);

  app.querySelector("#restart-demo").addEventListener("click", renderIntro);
  app.querySelector("#show-debrief").addEventListener("click", renderDebrief);
}

function renderDebrief() {
  renderShell(`
    <section class="card shadow-sm">
      <div class="card-body p-4 p-lg-5 debrief-copy">
        <p class="text-uppercase text-primary fw-semibold small mb-2">Debrief</p>
        <h1 class="h3 mb-3">Thank you for participating!</h1>

        <p>
          Did you notice how you tuned the intervals very differently for the
          different timbres?
        </p>

        <p>
          In general, we usually hear harmonic timbres, because most Western
          instruments and the human voice produce them. When we make intervals
          from harmonic timbres, we usually prefer either the just-intonation
          tunings (theoretically the most pure) or the 12-tone equal temperament
          tunings (quite close to just intonation, and what we are all most
          accustomed to hearing). However, some instruments have different
          timbres, and this can dramatically impact the way intervals sound.
          Different musical scales around the world are, in part, a result of
          different timbres. For example, research has shown that the scales used
          in the Javanese gamelan optimise the consonance of intervals for the
          specific timbre of the bonang, the pitched percussion instruments used
          in the gamelan ensemble.
        </p>

        <p>
          You might have tuned the intervals to decrease roughness (the
          unpleasant grating sound), or to increase slow beating, or a number of
          other factors. One of the research subjects at the CMS is exactly this.
          We want to know which factors are important to listeners in general, as
          well as how individual listeners differ in which factors they prefer.
        </p>

        <button type="button" class="btn btn-outline-primary mt-3" id="restart-demo">
          Tune again
        </button>
      </div>
    </section>
  `);

  app.querySelector("#restart-demo").addEventListener("click", renderIntro);
}

renderIntro();
