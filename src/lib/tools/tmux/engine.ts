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

/** window size in cells — the seed size every half-split is derived from */
const WINDOW_W = 120;
const WINDOW_H = 24;

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
    resized: {},
  };
}

export function createInitialTmux(drill?: TmuxDrill): TmuxState {
  const windowCount = Math.max(1, drill?.initialWindows ?? 1);
  const paneCount = Math.max(1, drill?.initialPanes ?? 1);
  const sessionName = drill?.sessionName ?? "0";
  const windowName = drill?.windowName ?? "bash";
  const activeWindowIdx = drill?.activeWindow ?? 0;

  let nextPaneId = 0;
  let nextWindowId = 0;
  const windows: TmuxWindow[] = [];

  for (let w = 0; w < windowCount; w++) {
    const win = makeWindow(nextWindowId++, nextPaneId++, windowName);
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

  const activeIdx =
    ((activeWindowIdx % windows.length) + windows.length) % windows.length;
  return {
    attached: true,
    session: {
      id: 0,
      name: sessionName,
      windows,
      activeWindowId: windows[activeIdx].id,
    },
    detached: [],
    prefix: false,
    cmdline: null,
    statusMessage: "",
    echo: "",
    pendingKill: false,
    copyMode: false,
    choosingTree: false,
    showPaneNumbers: false,
    renaming: null,
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

function findPane(node: TmuxSplit, paneId: number): TmuxPane | null {
  if (node.kind === "leaf") return node.paneId === paneId ? makePane(node.paneId) : null;
  for (const c of node.children) {
    const p = findPane(c, paneId);
    if (p) return p;
  }
  return null;
}

function walkSized(
  node: TmuxSplit,
  width: number,
  height: number,
  visit: (paneId: number, size: { width: number; height: number }) => void,
): void {
  if (node.kind === "leaf") {
    visit(node.paneId, { width, height });
    return;
  }
  const n = Math.max(1, node.children.length);
  node.children.forEach((child, i) => {
    if (node.dir === "row") {
      const w = Math.floor(width / n);
      const offset = i * w;
      walkSized(child, i === n - 1 ? width - offset : w, height, visit);
    } else {
      const h = Math.floor(height / n);
      const offset = i * h;
      walkSized(child, width, i === n - 1 ? height - offset : h, visit);
    }
  });
}

/** effective cell size: resize-pane overrides win, else the half-split size */
export function paneSize(win: TmuxWindow, paneId: number): { width: number; height: number } {
  const over = win.resized[paneId];
  if (over) return over;
  let size = { width: WINDOW_W, height: WINDOW_H };
  walkSized(win.layout, WINDOW_W, WINDOW_H, (id, s) => {
    if (id === paneId) size = s;
  });
  return size;
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

/** direction of the split that directly contains the given pane, if any */
function parentDir(node: TmuxSplit, paneId: number): "row" | "col" | null {
  if (node.kind === "leaf") return null;
  for (const c of node.children) {
    if (c.kind === "leaf" && c.paneId === paneId) return node.dir;
  }
  for (const c of node.children) {
    if (c.kind === "split") {
      const d = parentDir(c, paneId);
      if (d) return d;
    }
  }
  return null;
}

export function activeSplitDir(win: TmuxWindow): "row" | "col" | null {
  return parentDir(win.layout, win.activePaneId);
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

/** nudge the active pane's width/height within its split group */
/** Set the active pane's size in cells (matches `resize-pane -x/-y N`). */
export function resizeActive(
  state: TmuxState,
  axis: "width" | "height",
  value: number,
): TmuxState {
  const win = activeWindow(state);
  const size = paneSize(win, win.activePaneId);
  const next =
    axis === "width"
      ? { ...size, width: Math.max(20, value) }
      : { ...size, height: Math.max(4, value) };
  const updated: TmuxWindow = {
    ...win,
    resized: { ...win.resized, [win.activePaneId]: next },
  };
  return {
    ...state,
    session: replaceWindow(state.session, updated),
    echo: `resize-pane ${axis === "width" ? "-x" : "-y"} ${value}`,
    statusMessage: "",
  };
}

/** swap the active pane with the pane to its left/top (`{`) or right/bottom (`}`) */
export function swapPane(state: TmuxState, dir: "prev" | "next"): TmuxState {
  const win = activeWindow(state);
  const ring = spatialOrder(win.layout);
  if (ring.length < 2) return state;
  const i = ring.indexOf(win.activePaneId);
  const j =
    dir === "prev"
      ? (i - 1 + ring.length) % ring.length
      : (i + 1) % ring.length;
  const layout = swapLeaves(win.layout, ring[i], ring[j]);
  // The active pane trades places with its neighbor: the pane keeps identity
  // but moves into the neighbor's old slot. Focus follows the pane, not the
  // slot, so the active pane id is unchanged.
  const activePaneId = win.activePaneId;
  return {
    ...state,
    session: replaceWindow(state.session, { ...win, layout, activePaneId }),
    echo: `swap-pane ${dir === "prev" ? "{" : "}"}`,
    statusMessage: "",
  };
}

function swapLeaves(node: TmuxSplit, a: number, b: number): TmuxSplit {
  if (node.kind === "leaf") {
    if (node.paneId === a) return { kind: "leaf", paneId: b };
    if (node.paneId === b) return { kind: "leaf", paneId: a };
    return node;
  }
  return { ...node, children: node.children.map((c) => swapLeaves(c, a, b)) };
}

export function renameWindow(state: TmuxState, name: string): TmuxState {
  const win = activeWindow(state);
  return {
    ...state,
    session: replaceWindow(state.session, { ...win, name }),
    echo: `rename-window ${name}`,
    statusMessage: "",
  };
}

export function renameSession(state: TmuxState, name: string): TmuxState {
  return {
    ...state,
    session: { ...state.session, name },
    echo: `rename-session ${name}`,
    statusMessage: "",
  };
}

export function detach(state: TmuxState): TmuxState {
  if (!state.attached) return state;
  return {
    ...state,
    attached: false,
    prefix: false,
    detached: [
      ...state.detached.filter((d) => d.id !== state.session.id),
      { id: state.session.id, name: state.session.name },
    ],
    echo: "[detached]",
    statusMessage: "[detached from session]",
  };
}

export function attach(state: TmuxState): TmuxState {
  if (state.attached) return state;
  const back = state.detached[0];
  if (!back) return state;
  return {
    ...state,
    attached: true,
    session: { ...state.session, id: back.id, name: back.name },
    detached: state.detached.slice(1),
    echo: `[attached to ${back.name}]`,
    statusMessage: "",
  };
}

export function toggleCopyMode(state: TmuxState): TmuxState {
  return {
    ...state,
    copyMode: !state.copyMode,
    echo: state.copyMode ? "copy-mode (exit)" : "copy-mode",
    statusMessage: "",
  };
}

export function openChooseTree(state: TmuxState): TmuxState {
  return { ...state, choosingTree: true, prefix: false, echo: "choose-tree" };
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

function renameSessionOrWindow(
  state: TmuxState,
  target: "window" | "session",
  name: string,
): TmuxState {
  return target === "session" ? renameSession(state, name) : renameWindow(state, name);
}

/** move focus to the given pane index in the spatial ring */
function selectPane(state: TmuxState, index: number): TmuxState {
  const win = activeWindow(state);
  const ring = paneRing(win);
  if (index < 0 || index >= ring.length) return state;
  return setActivePane(state, ring[index]);
}

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
      const t = args.indexOf("-t");
      const n = t >= 0 ? Number(args[t + 1]) : NaN;
      return Number.isFinite(n) ? selectPane(state, n) : state;
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
    case "resizep": {
      if (args.includes("-Z")) return toggleZoom(state);
      const axis = args.includes("-x") ? "width" : "height";
      const i = args.indexOf(axis === "width" ? "-x" : "-y");
      const n = i >= 0 ? Number(args[i + 1]) : NaN;
      return Number.isFinite(n) ? resizeActive(state, axis, n) : state;
    }
    case "swap-pane":
    case "swapp":
      return swapPane(state, args.includes("{") ? "prev" : "next");
    case "rename-window":
    case "renamew": {
      const name = args.find((a) => !a.startsWith("-"));
      return name ? renameWindow(state, name) : state;
    }
    case "rename-session":
    case "renames": {
      const name = args.find((a) => !a.startsWith("-"));
      return name ? renameSession(state, name) : state;
    }
    case "detach-client":
    case "detach":
      return detach(state);
    case "attach-session":
    case "attach":
      return attach(state);
    case "copy-mode":
      return state.copyMode ? state : toggleCopyMode(state);
    case "choose-tree":
      return openChooseTree(state);
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

  if (state.choosingTree) {
    if (key === "Escape") return { ...state, choosingTree: false, echo: "" };
    if (key === "Enter") return { ...state, choosingTree: false, echo: "choose-tree (select)" };
    if (key.length === 1 && key >= "0" && key <= "9")
      return selectWindow({ ...state, choosingTree: false }, Number(key));
    return state;
  }

  if (state.renaming !== null && state.cmdline !== null) {
    const cmdline: string = state.cmdline;
    if (key === "Escape") return { ...state, renaming: null, cmdline: null, echo: "" };
    if (key === "Enter") {
      const line = cmdline.replace(/^:?/, "").trim();
      const name = line.split(/\s+/).slice(1).join(" ") || line;
      const target = state.renaming;
      return {
        ...renameSessionOrWindow({ ...state, renaming: null, cmdline: null }, target, name),
      };
    }
    if (key === "Backspace")
      return { ...state, cmdline: cmdline.slice(0, -1) || ":" };
    if (key.length === 1) return { ...state, cmdline: cmdline + key };
    return state;
  }

  if (state.showPaneNumbers) {
    // Any key dismisses the pane-number overlay (matches tmux's brief display).
    return { ...state, showPaneNumbers: false };
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
    case "{":
      return swapPane(state, "prev");
    case "}":
      return swapPane(state, "next");
    case ",":
      return { ...state, renaming: "window", cmdline: "rename-window ", echo: "," };
    case "$":
      return { ...state, renaming: "session", cmdline: "rename-session ", echo: "$" };
    case "[":
      return toggleCopyMode(state);
    case "w":
      return openChooseTree(state);
    case "&":
      return killWindow(state);
    case "q":
      // Outside copy mode, q displays pane numbers until the next keypress.
      if (state.copyMode) return toggleCopyMode(state);
      return { ...state, showPaneNumbers: true, echo: "display-panes" };
    case "s":
      // Switch to (reattach) the most recently detached session.
      if (state.attached) return state;
      return attach(state);
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
      return detach(state);
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
    case "splitDir":
      return activeSplitDir(win) === goal.dir;
    case "zoomed":
      return win.zoomed;
    case "paneWidth":
      return paneSize(win, win.activePaneId).width === goal.cells;
    case "paneHeight":
      return paneSize(win, win.activePaneId).height === goal.cells;
    case "sessionName":
      return state.session.name === goal.name;
    case "windowName":
      return win.name === goal.name;
    case "detached":
      return !state.attached;
    case "copyMode":
      return state.copyMode;
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
      return `window ${goal.index} is active`;
    case "splitDir":
      return goal.dir === "row"
        ? "the active pane is in a left/right split"
        : "the active pane is in a top/bottom split";
    case "zoomed":
      return "the active pane is zoomed";
    case "paneWidth":
      return `the active pane is ${goal.cells} cells wide`;
    case "paneHeight":
      return `the active pane is ${goal.cells} cells tall`;
    case "sessionName":
      return `the session is named "${goal.name}"`;
    case "windowName":
      return `the active window is named "${goal.name}"`;
    case "detached":
      return "you are detached from the session";
    case "copyMode":
      return "copy mode is active";
  }
}
