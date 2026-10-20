# Dev Dojo

**Live site: [nathangrove.github.io/dev-dojo](https://nathangrove.github.io/dev-dojo/)**

An interactive playground for building muscle memory across developer tools. Practice
Vim, tmux and Git in the browser with a simulated stage that responds to every keystroke,
a per-drill goal, and progress that is saved locally.

**Tracks:** Vim (163 drills) · tmux (26 drills) · Git (17 drills) — 206 drills across 58 lessons.

## Features

- **Real simulators, not quizzes.** Each track ships an engine that models the tool's
  state: buffers, cursors and registers for Vim; panes, windows and sessions for tmux;
  commits, branches and the index for Git.
- **Goal-driven drills.** Every drill states one concrete goal and reports whether your
  keystrokes reached it. Solutions are validated by the same engine the UI uses.
- **Mastery tracking.** Progress is stored in `localStorage`. A drill is *completed* once
  solved, and *mastered* when you solve it at **85% accuracy or better without hints**.
- **Hints and retries.** Ask for the canonical solution when stuck, then repeat it to
  lock the pattern in.
- **Keyboard-first.** The vim and tmux stages capture real key events, including
  `Ctrl-b` prefixes and named keys (`Esc`, `Enter`, `Backspace`).

## Getting started

Requires **Node 22+**.

```bash
npm install
npm run dev
```

Vite serves the app at [http://localhost:5173/dev-dojo/](http://localhost:5173/dev-dojo/)
(the `/dev-dojo/` base path matches the GitHub Pages deployment; deep links use
`HashRouter` so no server rewrites are needed).

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Start the Vite dev server with HMR            |
| `npm run build`  | Typecheck (`tsc --noEmit`) then build to `dist/` |
| `npm run preview`| Serve the production build locally            |
| `npm test`       | Run the Vitest suite                          |
| `npm run lint`   | Run ESLint                                    |

## Project structure

```
src/
  components/          shared UI + per-tool stage components
    vim/ tmux/ git/
  routes/              pages for home, track, category and lesson views
  lib/
    dojo/              generic practice framework
      types.ts         Track / Category / Lesson / Drill shapes
      tool.ts          Tool adapter interface (createInitial, reduce, isSolved, Stage)
      tools.ts         tool registry
      tokens.ts        key-token parsing (`<C-b>` → `ctrl+b`, `<Esc>` → `Escape`, …)
      index.ts         track registry + lookup helpers
    progress.ts        localStorage-backed progress and mastery
    tools/
      vim/             engine, curriculum, tests, adapter, types
      tmux/
      git/
```

Each track is self-contained: a **curriculum** (categories → lessons → drills), an
**engine** (pure state reducer), a **tool adapter** (bridges the engine to the generic
runner), and **tests**.

## Testing

```bash
npm test
```

The suite includes *curriculum validity* tests for every track. They assert that drill
ids and lesson slugs are unique, that each drill has exactly one goal and is **not
already solved** at start, and that every canonical `solution` reaches its goal when
replayed through the engine. This keeps lessons honest: a broken solution or an
unreachable goal fails CI.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes
`dist/` to GitHub Pages. The site is served under the `/dev-dojo/` base path (set in
`vite.config.ts`).
