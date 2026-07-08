# Timbre consonance demo

This is a single-page JavaScript app for exploring how preferred interval
tunings change across harmonic, compressed, and stretched timbres. The app uses
the Web Audio API to synthesize tones directly in the browser.

## Run locally

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Run the test suite:

```sh
npm test
```

Build the static app:

```sh
npm run build
```

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that deploys the Vite build
to GitHub Pages whenever changes are pushed to `main`.

To activate it in GitHub:

1. Open the repository settings.
2. Go to **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push this workflow to `main`, or run **Deploy GitHub Pages** manually from
   the **Actions** tab.

The site will be published at the Pages URL shown in the workflow summary.

## Architecture

This port is browser-only. It does not require PsyNet, Python, Docker, or a
backend service for normal use.
