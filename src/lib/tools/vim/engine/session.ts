import type { Register, Snapshot, SplitNode, Tab, VimState, Window } from "./types";
import { allWindowIds, cycleWindow, moveWindow, removeWindow, splitWindow, type MoveDir } from "./layout";

export const NO_NAME = "[No Name]";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function createInitialState(text: string, name: string = NO_NAME): VimState {
  const bufferId = 1;
  const windowId = 1;
  const tabId = 1;
  const lines = text.split("\n");
  return {
    lines,
    row: 0,
    col: 0,
    desiredCol: 0,
    mode: "normal",
    register: null,
    undoStack: [],
    redoStack: [],
    pendingOp: null,
    count: "",
    pendingG: false,
    pendingZ: false,
    pendingReplace: false,
    visualAnchor: null,
    echo: "",
    edits: 0,
    buffers: [
      { id: bufferId, name, lines, original: [...lines], modified: false, undoStack: [], redoStack: [] },
    ],
    windows: [{ id: windowId, bufferId, row: 0, col: 0, desiredCol: 0 }],
    tabs: [{ id: tabId, layout: { kind: "leaf", windowId }, activeWindowId: windowId }],
    activeTab: 0,
    nextBufferId: bufferId + 1,
    nextWindowId: windowId + 1,
    nextTabId: tabId + 1,
    registers: {},
    marks: {},
    cmdline: null,
    statusMessage: "",
    pendingCtrlW: false,
    pendingRegister: false,
    pendingMarkSet: false,
    pendingMarkJump: false,
    markJumpExact: false,
    activeRegister: null,
    pendingFind: null,
    lastFind: null,
    pendingTextObject: null,
    searchPattern: "",
    searchForward: true,
    pendingCase: null,
    jumplist: [],
    jumpIndex: 0,
    topRow: 0,
    pendingRecord: false,
    recording: null,
    recordingKeys: [],
    macros: {},
    pendingPlay: false,
    lastMacro: null,
    lastChange: null,
    cmdKeys: null,
    cmdEdited: false,
    replaying: false,
  };
}

/**
 * Build a session for a drill. `initial` is always the primary buffer's text.
 * When `files` is given, `files[0].name` names that primary buffer and every
 * further entry is opened as an additional buffer.
 */
export function createSeeded(
  initial: string,
  files?: { name: string; text: string }[],
  start?: { row: number; col: number },
  startModified?: boolean,
): VimState {
  let s = createInitialState(initial, files?.[0]?.name ?? NO_NAME);
  if (start) s = { ...s, row: start.row, col: start.col, desiredCol: start.col };
  if (files) {
    for (const f of files.slice(1)) {
      s = openFile(s, f.name, f.text).state;
    }
  }
  if (startModified) {
    const id = s.buffers[0].id;
    s = { ...s, buffers: s.buffers.map((b) => (b.id === id ? { ...b, modified: true } : b)) };
  }
  return s;
}

export function activeTab(state: VimState): Tab {  return state.tabs[state.activeTab];
}

export function activeWindow(state: VimState): Window {
  const tab = activeTab(state);
  return state.windows.find((w) => w.id === tab.activeWindowId) ?? state.windows[0];
}

export function findBuffer(state: VimState, bufferId: number) {
  return state.buffers.find((b) => b.id === bufferId);
}

export function activeBuffer(state: VimState) {
  return findBuffer(state, activeWindow(state).bufferId)!;
}

export function bufferByName(state: VimState, name: string) {
  return state.buffers.find((b) => b.name === name);
}

/** Write the active window's live view back into its buffer and window record. */
export function commitView(state: VimState): VimState {
  const win = activeWindow(state);
  const buf = findBuffer(state, win.bufferId);
  if (!buf) return state;
  const modified = buf.modified || !arraysEqual(buf.lines, state.lines);
  const buffers = state.buffers.map((b) =>
    b.id === buf.id
      ? {
          ...b,
          lines: state.lines,
          undoStack: state.undoStack,
          redoStack: state.redoStack,
          modified,
        }
      : b,
  );
  const windows = state.windows.map((w) =>
    w.id === win.id ? { ...w, row: state.row, col: state.col, desiredCol: state.desiredCol } : w,
  );
  return { ...state, buffers, windows };
}

/** Point the active tab at `windowId` and load its buffer/cursor into the live view. */
export function loadWindow(state: VimState, windowId: number): VimState {
  const win = state.windows.find((w) => w.id === windowId);
  if (!win) return state;
  const buf = findBuffer(state, win.bufferId);
  if (!buf) return state;
  const tabs = state.tabs.map((t, i) =>
    i === state.activeTab ? { ...t, activeWindowId: windowId } : t,
  );
  return {
    ...state,
    tabs,
    lines: buf.lines,
    row: win.row,
    col: win.col,
    desiredCol: win.desiredCol,
    undoStack: buf.undoStack,
    redoStack: buf.redoStack,
    mode: "normal",
    visualAnchor: null,
    pendingOp: null,
    count: "",
    pendingG: false,
    pendingZ: false,
    pendingReplace: false,
    pendingCtrlW: false,
    activeRegister: null,
    pendingFind: null,
    pendingTextObject: null,
    pendingRecord: false,
    pendingPlay: false,
    cmdline: null,
    echo: "",
  };
}

export function switchWindow(state: VimState, windowId: number): VimState {
  return loadWindow(commitView(state), windowId);
}

function setLayout(tab: Tab, layout: SplitNode, activeWindowId: number): Tab {
  return { ...tab, layout, activeWindowId };
}

/** Add a new window (optionally showing `file`) by splitting the active window. */
export function addSplit(state: VimState, dir: "row" | "col", file?: string): VimState {
  const s = commitView(state);
  const windowId = s.nextWindowId;
  const win = activeWindow(s);

  let buffers = s.buffers;
  let nextBufferId = s.nextBufferId;
  let bufferId = win.bufferId;
  const statusMessage = s.statusMessage;

  if (file) {
    const existing = bufferByName(s, file);
    if (existing) {
      bufferId = existing.id;
    } else {
      bufferId = nextBufferId;
      nextBufferId += 1;
      buffers = [
        ...buffers,
        { id: bufferId, name: file, lines: [""], original: [""], modified: false, undoStack: [], redoStack: [] },
      ];
    }
  }

  const newWindow: Window = { id: windowId, bufferId, row: 0, col: 0, desiredCol: 0 };
  const windows = [...s.windows, newWindow];
  const tabs = s.tabs.map((t, i) =>
    i === s.activeTab
      ? setLayout(t, splitWindow(t.layout, win.id, dir, windowId), windowId)
      : t,
  );

  const next: VimState = {
    ...s,
    buffers,
    windows,
    tabs,
    nextWindowId: windowId + 1,
    nextBufferId,
    statusMessage,
  };
  return loadWindow(next, windowId);
}

export function closeActiveWindow(state: VimState): VimState {
  const s = commitView(state);
  const win = activeWindow(s);
  const tab = activeTab(s);

  if (findBuffer(s, win.bufferId)?.modified) {
    return { ...s, statusMessage: "E37: No write since last change (add ! to override)" };
  }
  if (allWindowIds(tab.layout).length === 1) {
    return { ...s, statusMessage: "E444: Cannot close last window" };
  }

  const layout = removeWindow(tab.layout, win.id);
  const windows = s.windows.filter((w) => w.id !== win.id);
  const remaining = layout ? allWindowIds(layout) : [];
  const activeWindowId = remaining[0];
  const tabs = s.tabs.map((t, i) =>
    i === s.activeTab ? setLayout(t, layout ?? t.layout, activeWindowId) : t,
  );
  return loadWindow({ ...s, windows, tabs }, activeWindowId);
}

/** `:close!` / forced window close, ignoring the modified check. */
export function forceCloseActiveWindow(state: VimState): VimState {
  const s = commitView(state);
  const win = activeWindow(s);
  const tab = activeTab(s);
  if (allWindowIds(tab.layout).length === 1) {
    return { ...s, statusMessage: "E444: Cannot close last window" };
  }
  const layout = removeWindow(tab.layout, win.id);
  const windows = s.windows.filter((w) => w.id !== win.id);
  const remaining = layout ? allWindowIds(layout) : [];
  const activeWindowId = remaining[0];
  const tabs = s.tabs.map((t, i) =>
    i === s.activeTab ? setLayout(t, layout ?? t.layout, activeWindowId) : t,
  );
  return loadWindow({ ...s, windows, tabs }, activeWindowId);
}

export function onlyActiveWindow(state: VimState): VimState {
  const s = commitView(state);
  const keep = activeWindow(s).id;
  const windows = s.windows.filter((w) => w.id === keep);
  const tabs = s.tabs.map((t, i) =>
    i === s.activeTab
      ? setLayout(t, { kind: "leaf", windowId: keep }, keep)
      : t,
  );
  return loadWindow({ ...s, windows, tabs }, keep);
}

export function moveActiveWindow(state: VimState, dir: MoveDir): VimState {
  const s = commitView(state);
  const tab = activeTab(s);
  const target = moveWindow(tab.layout, tab.activeWindowId, dir);
  return loadWindow(s, target);
}

export function cycleActiveWindow(state: VimState, reverse = false): VimState {
  const s = commitView(state);
  const tab = activeTab(s);
  const target = cycleWindow(tab.layout, tab.activeWindowId, reverse);
  return loadWindow(s, target);
}

/** Create (or reuse) a buffer and show it in the active window. */
export function switchToBuffer(state: VimState, bufferId: number): VimState {
  const s = commitView(state);
  const win = activeWindow(s);
  if (!findBuffer(s, bufferId)) return s;
  const windows = s.windows.map((w) => (w.id === win.id ? { ...w, bufferId, row: 0, col: 0, desiredCol: 0 } : w));
  return loadWindow({ ...s, windows }, win.id);
}

export function openFile(state: VimState, name: string, text = ""): { state: VimState; bufferId: number } {
  const existing = bufferByName(state, name);
  if (existing) return { state, bufferId: existing.id };
  const bufferId = state.nextBufferId;
  const buffers = [
    ...state.buffers,
    {
      id: bufferId,
      name,
      lines: text.split("\n"),
      original: text.split("\n"),
      modified: false,
      undoStack: [],
      redoStack: [],
    },
  ];
  return { state: { ...state, buffers, nextBufferId: bufferId + 1 }, bufferId };
}

export function nextBuffer(state: VimState, delta: number): VimState {
  const s = commitView(state);
  const ids = s.buffers.map((b) => b.id);
  if (ids.length <= 1) return s;
  const cur = activeWindow(s).bufferId;
  const i = ids.indexOf(cur);
  const n = ((i + delta) % ids.length + ids.length) % ids.length;
  return switchToBuffer(s, ids[n]);
}

// ---------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------

export function newTab(state: VimState, file?: string): VimState {
  const s = commitView(state);
  let buffers = s.buffers;
  let nextBufferId = s.nextBufferId;
  let bufferId: number;
  if (file) {
    const existing = bufferByName(s, file);
    if (existing) {
      bufferId = existing.id;
    } else {
      bufferId = nextBufferId;
      nextBufferId += 1;
      buffers = [
        ...buffers,
        { id: bufferId, name: file, lines: [""], original: [""], modified: false, undoStack: [], redoStack: [] },
      ];
    }
  } else {
    bufferId = nextBufferId;
    nextBufferId += 1;
    buffers = [
      ...buffers,
      { id: bufferId, name: NO_NAME, lines: [""], original: [""], modified: false, undoStack: [], redoStack: [] },
    ];
  }
  const windowId = s.nextWindowId;
  const tabId = s.nextTabId;
  const window: Window = { id: windowId, bufferId, row: 0, col: 0, desiredCol: 0 };
  const tab: Tab = { id: tabId, layout: { kind: "leaf", windowId }, activeWindowId: windowId };
  const tabs = [...s.tabs, tab];
  const next: VimState = {
    ...s,
    buffers,
    windows: [...s.windows, window],
    tabs,
    activeTab: tabs.length - 1,
    nextWindowId: windowId + 1,
    nextTabId: tabId + 1,
    nextBufferId,
  };
  return loadWindow(next, windowId);
}

export function switchTab(state: VimState, index: number): VimState {
  const s = commitView(state);
  if (index < 0 || index >= s.tabs.length) return s;
  const tab = s.tabs[index];
  return loadWindow({ ...s, activeTab: index }, tab.activeWindowId);
}

export function closeTab(state: VimState): VimState {
  const s = commitView(state);
  if (s.tabs.length === 1) return { ...s, statusMessage: "E784: Cannot close last tab page" };
  const tab = activeTab(s);
  const winIds = new Set(allWindowIds(tab.layout));
  const windows = s.windows.filter((w) => !winIds.has(w.id));
  const tabs = s.tabs.filter((_, i) => i !== s.activeTab);
  const activeTabIndex = Math.max(0, s.activeTab - 1);
  const next: VimState = { ...s, windows, tabs, activeTab: activeTabIndex };
  return loadWindow(next, tabs[activeTabIndex].activeWindowId);
}

// ---------------------------------------------------------------------------
// registers
// ---------------------------------------------------------------------------

export function getRegister(state: VimState, name: string | null): Register | null {
  if (!name || name === '"') return state.register;
  return state.registers[name] ?? null;
}

export function setRegister(state: VimState, name: string | null, reg: Register): VimState {
  const registers = { ...state.registers };
  if (name && name !== '"') registers[name] = reg;
  return { ...state, register: reg, registers };
}

export type { Snapshot };
