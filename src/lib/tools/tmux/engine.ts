import type {
  TmuxDrill,
  TmuxGoal,
  TmuxPane,
  TmuxSession,
  TmuxSplit,
  TmuxState,
  TmuxWindow,
} from "./types";

export const TMUX_PREFIX = "ctrl+b";

/* ------------------------------------------------------------------ */
/* construction                                                        */
/* ------------------------------------------------------------------ */

function makePane(id: number): TmuxPane {
  return { id, title: "bash" };
}

function makeWindow(id: number, paneId: number, name: string): TmuxWindow {
  return {
    id,
    name,
    layout: { kind: "leaf", paneId },
    panes: [makePane(paneId)],
    activePaneId: paneId,
    zoomed: false,
  };
}

export function createInitialTmux(drill?: TmuxDrill): TmuxState {
  const windowCount = Math.max(1, drill?.initialWindows ?? 1);
  const paneCount = Math.max(1, drill?.initialPanes ?? 1);

  let nextPaneId = 0;
  let nextWindowId = 0;
  const windows: TmuxWindow[] = [];

  for (let w = 0; w < windowCount; w++) {
    const win = makeWindow(nextWindowId++, nextPaneId++, "bash");
    if (w === 0) {
      for (let p = 1; p < paneCount; p++) {
        splitWindow(win, win.activePaneId, "row", nextPaneId++);
      }
      if (drill?.activePane !== undefined) {
        const ring = spatialOrder(win.layout);
        if (ring.length > 0) {
          const i = ((drill.activePane % ring.length) + ring.length) % ring.length;
          win.activePaneId = ring[i];
        }
      }
    }
    windows.push(win);
  }

  return {
    session: { id: 0, windows, activeWindowId: windows[windows.length - 1].id },
    prefix: false,
    cmdline: null,
    statusMessage: "",
    echo: "",
    pendingKill: false,
    lastPaneId: null,
    nextPaneId,
    nextWindowId,
    nextSessionId: 1,
  };
}

/* ------------------------------------------------------------------ */
/* layout helpers                                                      */
/* ------------------------------------------------------------------ */

/** pane ids in spatial order (in-order walk = left→right, top→bottom) */
export function spatialOrder(node: TmuxSplit): number[] {
  if (node.kind === "leaf") return [node.paneId];
  return node.children.flatMap(spatialOrder);
}

function replaceLeaf(
  node: TmuxSplit,
  targetId: number,
  repl: TmuxSplit,
): TmuxSplit {
  if (node.kind === "leaf") return node.paneId === targetId ? repl : node;
  return {
    ...node,
    children: node.children.map((c) => replaceLeaf(c, targetId, repl)),
  };
}

function removeLeaf(node: TmuxSplit, targetId: number): TmuxSplit | null {
  if (node.kind === "leaf") return node.paneId === targetId ? null : node;
  const kids = node.children
    .map((c) => removeLeaf(c, targetId))
    .filter((x): x is TmuxSplit => x !== null);
  if (kids.length === 0) return null;
  if (kids.length === 1) return kids[0];
  return { ...node, children: kids };
}

function splitWindow(
  win: TmuxWindow,
  targetPaneId: number,
  dir: "row" | "col",
  newPaneId: number,
): void {
  win.layout = replaceLeaf(win.layout, targetPaneId, {
    kind: "split",
    dir,
    children: [
      { kind: "leaf", paneId: targetPaneId },
      { kind: "leaf", paneId: newPaneId },
    ],
  });
  win.panes.push(makePane(newPaneId));
  win.activePaneId = newPaneId;
  win.zoomed = false;
}

/* ------------------------------------------------------------------ */
/* accessors                                                           */
/* ------------------------------------------------------------------ */

export function activeWindow(state: TmuxState): TmuxWindow {
  return (
    state.session.windows.find((w) => w.id === state.session.activeWindowId) ??
    state.session.windows[0]
  );
}

/** 0-based index of the active window in the session */
export function activeWindowIndex(state: TmuxState): number {
  return state.session.windows.findIndex(
    (w) => w.id === state.session.activeWindowId,
  );
}

export function paneRing(win: TmuxWindow): number[] {
  return spatialOrder(win.layout);
}

export function activePaneIndex(win: TmuxWindow): number {
  return paneRing(win).indexOf(win.activePaneId);
}

/* ------------------------------------------------------------------ */
/* mutations (pure)                                                    */
/* ------------------------------------------------------------------ */

export function splitActive(state: TmuxState, dir: "row" | "col"): TmuxState {
  const win = activeWindow(state);
  const newPaneId = state.nextPaneId;
  const next: TmuxWindow = { ...win, panes: [...win.panes] };
  splitWindow(next, win.activePaneId, dir, newPaneId);
  return {
    ...state,
    session: replaceWindow(state.session, next),
    lastPaneId: win.activePaneId,
    nextPaneId: newPaneId + 1,
    echo: dir === "row" ? "split-window -h" : "split-window -v",
    statusMessage: "",
  };
}

function replaceWindow(session: TmuxSession, win: TmuxWindow): TmuxSession {
  return {
    ...session,
    windows: session.windows.map((w) => (w.id === win.id ? win : w)),
  };
}

function setActivePane(state: TmuxState, paneId: number): TmuxState {
  const win = activeWindow(state);
  if (win.activePaneId === paneId) return state;
  return {
    ...state,
    session: replaceWindow(state.session, { ...win, activePaneId: paneId }),
    lastPaneId: win.activePaneId,
  };
}

/** move `delta` steps around the spatial ring (wraps) — arrows and `o` */
export function moveDir(state: TmuxState, delta: number): TmuxState {
  const win = activeWindow(state);
  const ring = paneRing(win);
  if (ring.length < 2) return state;
  const i = ring.indexOf(win.activePaneId);
  const j = (((i + delta) % ring.length) + ring.length) % ring.length;
  return setActivePane(state, ring[j]);
}

/** next pane in creation order (prefix `o`) */
export function nextPane(state: TmuxState): TmuxState {
  const win = activeWindow(state);
  const ids = win.panes.map((p) => p.id).sort((a, b) => a - b);
  if (ids.length < 2) return state;
  const i = ids.indexOf(win.activePaneId);
  const j = (i + 1) % ids.length;
  return setActivePane(state, ids[j]);
}

/** toggle to the previous pane (prefix `;`) */
export function lastPane(state: TmuxState): TmuxState {
  if (state.lastPaneId === null) return state;
  const win = activeWindow(state);
  if (!win.panes.some((p) => p.id === state.lastPaneId)) return state;
  return setActivePane(state, state.lastPaneId);
}

export function toggleZoom(state: TmuxState): TmuxState {
  const win = activeWindow(state);
  return {
    ...state,
    session: replaceWindow(state.session, { ...win, zoomed: !win.zoomed }),
    echo: "resize-pane -Z",
    statusMessage: "",
  };
}

export function killPane(state: TmuxState): TmuxState {
  const win = activeWindow(state);
  if (win.panes.length <= 1) {
    return killWindow(state);
  }
  const layout = removeLeaf(win.layout, win.activePaneId);
  const panes = win.panes.filter((p) => p.id !== win.activePaneId);
  if (!layout) return state;
  const ring = spatialOrder(layout);
  const next: TmuxWindow = {
    ...win,
    layout,
    panes,
    activePaneId: ring[0],
    zoomed: false,
  };
  return {
    ...state,
    session: replaceWindow(state.session, next),
    lastPaneId: null,
    echo: "kill-pane",
    statusMessage: "",
  };
}

export function newWindow(state: TmuxState): TmuxState {
  const win = makeWindow(state.nextWindowId, state.nextPaneId, "bash");
  return {
    ...state,
    session: {
      ...state.session,
      windows: [...state.session.windows, win],
      activeWindowId: win.id,
    },
    nextWindowId: state.nextWindowId + 1,
    nextPaneId: state.nextPaneId + 1,
    echo: "new-window",
    statusMessage: "",
  };
}

export function killWindow(state: TmuxState): TmuxState {
  const { windows } = state.session;
  if (windows.length <= 1) {
    return { ...state, statusMessage: "can't close the last window" };
  }
  const idx = activeWindowIndex(state);
  const next = windows.filter((w) => w.id !== state.session.activeWindowId);
  const activeWindowId = next[Math.min(idx, next.length - 1)].id;
  return {
    ...state,
    session: { ...state.session, windows: next, activeWindowId },
    echo: "kill-window",
    statusMessage: "",
  };
}

export function cycleWindow(state: TmuxState, delta: number): TmuxState {
  const { windows } = state.session;
  if (windows.length < 2) return state;
  const i = activeWindowIndex(state);
  const j = (((i + delta) % windows.length) + windows.length) % windows.length;
  return {
    ...state,
    session: { ...state.session, activeWindowId: windows[j].id },
    echo: delta >= 0 ? "next-window" : "previous-window",
    statusMessage: "",
  };
}

export function selectWindow(state: TmuxState, index: number): TmuxState {
  const { windows } = state.session;
  if (index < 0 || index >= windows.length) return state;
  return {
    ...state,
    session: { ...state.session, activeWindowId: windows[index].id },
    echo: `select-window -t ${index}`,
    statusMessage: "",
  };
}

/* ------------------------------------------------------------------ */
/* command prompt                                                      */
/* ------------------------------------------------------------------ */

export function executeTmuxCommand(state: TmuxState, line: string): TmuxState {
  const raw = line.replace(/^:?/, "").trim();
  const [cmd, ...args] = raw.split(/\s+/);
  switch (cmd) {
    case "split-window":
    case "splitw": {
      const dir = args.includes("-h") ? "row" : "col";
      return splitActive(state, dir);
    }
    case "select-pane":
    case "selectp": {
      if (args.includes("-L") || args.includes("-U")) return moveDir(state, -1);
      if (args.includes("-R") || args.includes("-D")) return moveDir(state, 1);
      return state;
    }
    case "new-window":
    case "neww":
      return newWindow(state);
    case "next-window":
    case "next":
      return cycleWindow(state, 1);
    case "previous-window":
    case "prev":
      return cycleWindow(state, -1);
    case "kill-pane":
    case "killp":
      return killPane(state);
    case "kill-window":
    case "killw":
      return killWindow(state);
    case "resize-pane":
    case "resizep":
      return args.includes("-Z") ? toggleZoom(state) : state;
    case "select-window":
    case "selectw": {
      const t = args.indexOf("-t");
      const n = t >= 0 ? Number(args[t + 1]) : NaN;
      return Number.isFinite(n) ? selectWindow(state, n) : state;
    }
    default:
      return { ...state, statusMessage: `unknown command: ${cmd}` };
  }
}

/* ------------------------------------------------------------------ */
/* key handling                                                        */
/* ------------------------------------------------------------------ */

export function handleTmuxKey(state: TmuxState, key: string): TmuxState {
  if (state.cmdline !== null) {
    if (key === "Escape") return { ...state, cmdline: null, echo: "" };
    if (key === "Enter")
      return { ...executeTmuxCommand(state, state.cmdline), cmdline: null };
    if (key === "Backspace")
      return { ...state, cmdline: state.cmdline.slice(0, -1) || ":" };
    if (key.length === 1) return { ...state, cmdline: state.cmdline + key };
    return state;
  }

  if (state.pendingKill) {
    if (key === "y" || key === "Y")
      return killPane({ ...state, pendingKill: false, echo: "x y" });
    return { ...state, pendingKill: false, echo: "" };
  }

  if (state.prefix) return handlePrefix({ ...state, prefix: false }, key);

  if (key === TMUX_PREFIX)
    return { ...state, prefix: true, echo: "^B", statusMessage: "" };
  return state;
}

function handlePrefix(state: TmuxState, key: string): TmuxState {
  switch (key) {
    case "%":
      return splitActive(state, "row");
    case '"':
      return splitActive(state, "col");
    case "o":
      return nextPane(state);
    case ";":
      return lastPane(state);
    case "ArrowLeft":
    case "ArrowUp":
      return moveDir(state, -1);
    case "ArrowRight":
    case "ArrowDown":
      return moveDir(state, 1);
    case "x":
      return { ...state, pendingKill: true, echo: "x" };
    case "z":
      return toggleZoom(state);
    case "c":
      return newWindow(state);
    case "n":
      return cycleWindow(state, 1);
    case "p":
      return cycleWindow(state, -1);
    case ":":
      return { ...state, cmdline: ":", echo: ":" };
    case "d":
      return { ...state, statusMessage: "[detached]", echo: "^B d" };
    case "Escape":
      return { ...state, echo: "" };
    default:
      if (key.length === 1 && key >= "0" && key <= "9") {
        return selectWindow(state, Number(key));
      }
      return { ...state, statusMessage: "not a command", echo: `${key}` };
  }
}

/* ------------------------------------------------------------------ */
/* goals                                                               */
/* ------------------------------------------------------------------ */

export function evaluateTmuxGoal(state: TmuxState, goal: TmuxGoal): boolean {
  const win = activeWindow(state);
  switch (goal.kind) {
    case "paneCount":
      return win.panes.length === goal.count;
    case "windowCount":
      return state.session.windows.length === goal.count;
    case "activePane":
      return activePaneIndex(win) === goal.index;
    case "activeWindow":
      return activeWindowIndex(state) === goal.index;
    case "zoomed":
      return win.zoomed;
  }
}

export function describeTmuxGoal(
  goal: TmuxGoal,
  state: TmuxState,
): string {
  const win = activeWindow(state);
  switch (goal.kind) {
    case "paneCount":
      return `the window ${goal.count === 1 ? "has" : "has"} ${goal.count} pane${goal.count === 1 ? "" : "s"}`;
    case "windowCount":
      return `the session has ${goal.count} window${goal.count === 1 ? "" : "s"}`;
    case "activePane":
      return `pane #${goal.index + 1} of ${paneRing(win).length} is active`;
    case "activeWindow":
      return `window ${goal.index + 1} is active`;
    case "zoomed":
      return "the active pane is zoomed";
  }
}
