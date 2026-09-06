# Kavranta product website

Standalone Korean product guide with a synchronized application/terminal demo.
It uses the repository's React and Vite dependencies, without loading the desktop
entry point, Tauri APIs, Broker, local registry, or provider adapters.

Run from the repository root:

```sh
npm run dev:website
npm run build:website
npm run test:website
```

The development URL is http://127.0.0.1:1430. Static output goes to `website/dist`.
The Vite configuration disables env-file loading. Assets are served locally.
There are no analytics, remote embeds, credentials, or API calls.

## Architecture

- `demoStory.ts`: static scenarios and pure frame projection; no React or browser APIs.
- `useDemoPlayback.ts`: browser timer, visibility and motion-preference lifecycle.
- `WorkflowDemo.tsx`: presentation and playback controls, with no application services.
- `DemoAppWindow.tsx`, `DemoTerminal.tsx`: independent views of the same frame.
- `LandingPage.tsx`: product narrative and navigation.

Dependencies point from the view to the playback adapter to the pure story model.
The website never imports desktop implementation modules. Its build and browser tests
have separate configurations and output directories.

## Demo behavior

`src/demoStory.ts` owns the three illustrative scenarios: create and fill a variable,
explicitly link two files, and push one GitHub Actions Secret to a named staging
Environment. Local and Development are file display aliases. Every value is a
decorative fixed mask, never an actual value or a prefix of one.

The terminal types the request and reveals results progressively. The app reflects
the same timeline. Scene buttons select a scenario; pause and replay are explicit.
Offscreen and hidden-page playback pauses. Reduced-motion users see a completed
static scene by default and can select another scene or explicitly play. A text
transcript is available below the demo.

Download links lead to the official release selector. The Windows unsigned beta
status and limits of agent protection are disclosed. This page does not imply that
GitHub Secret push proves current remote equality.

Public hosting is a separate deployment step. Never serve the repository root;
publish only the generated `website/dist` directory.
