import type { Pos, Register, Snapshot, VimState } from "./types";
import {
  activeWindow,
  addSplit,
  closeActiveWindow,
  commitView,
  createInitialState,
  cycleActiveWindow,
  getRegister,
  moveActiveWindow,
  onlyActiveWindow,
  setRegister,
  switchTab,
  switchToBuffer,
} from "./session";
import { executeEx } from "./ex";

/** A single key event fed to the reducer (e.g. "h", "Escape", "ctrl+r"). */
export type KeyEvent = string;

/** Persist the active window's live view into its buffer/window before returning. */
function commit(next: VimState): VimState {
  return commitView(next);
}

const WORD_RE = /[A-Za-z0-9_]/;

type CharClass = "word" | "punct" | "space";

function cls(ch: string | undefined): CharClass {
  if (ch === undefined || ch === "") return "space";
  if (/\s/.test(ch)) return "space";
  if (WORD_RE.test(ch)) return "word";
  return "punct";
}

export function firstNonBlank(line: string): number {
  const m = line.search(/\S/);
  return m === -1 ? 0 : m;
}

// ---------------------------------------------------------------------------
// construction / comparison
// ---------------------------------------------------------------------------

export function createState(text: string): VimState {
  return createInitialState(text);
}

export function stateText(state: VimState): string {
  return state.lines.join("\n");
}

export function normalizeText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function isGoal(state: VimState, target: string): boolean {
  return normalizeText(stateText(state)) === normalizeText(target);
}

// ---------------------------------------------------------------------------
// offset <-> position helpers (flat buffer model, '\n' between lines)
// ---------------------------------------------------------------------------

function offsetOf(lines: string[], row: number, col: number): number {
  let o = 0;
  for (let i = 0; i < row && i < lines.length; i++) o += lines[i].length + 1;
  const len = lines[row]?.length ?? 0;
  return o + Math.min(col, len);
}

function posOf(lines: string[], offset: number): Pos {
  let o = Math.max(0, offset);
  for (let r = 0; r < lines.length; r++) {
    const len = lines[r].length;
    if (o <= len) return { row: r, col: o };
    o -= len + 1;
  }
  const last = lines.length - 1;
  return { row: last, col: lines[last].length };
}

function clampNormal(lines: string[], pos: Pos): Pos {
  const row = Math.max(0, Math.min(lines.length - 1, pos.row));
  const len = lines[row].length;
  const col = Math.max(0, Math.min(Math.max(0, len - 1), pos.col));
  return { row, col };
}

function clampInsert(lines: string[], pos: Pos): Pos {
  const row = Math.max(0, Math.min(lines.length - 1, pos.row));
  const len = lines[row].length;
  const col = Math.max(0, Math.min(len, pos.col));
  return { row, col };
}

// ---------------------------------------------------------------------------
// word motions on the flat buffer string
// ---------------------------------------------------------------------------

function moveWordForward(t: string, p: number): number {
  const n = t.length;
  if (n === 0) return 0;
  let i = p;
  if (i < n && cls(t[i]) !== "space") {
    const c = cls(t[i]);
    while (i < n && cls(t[i]) === c) i++;
  }
  while (i < n && cls(t[i]) === "space") i++;
  return i >= n ? n - 1 : i;
}

function moveWordEnd(t: string, p: number): number {
  const n = t.length;
  if (n === 0) return 0;
  let i = Math.min(p, n - 1);
  const c = cls(t[i]);
  if (c === "space") {
    while (i < n && cls(t[i]) === "space") i++;
    if (i >= n) return n - 1;
    const c2 = cls(t[i]);
    while (i + 1 < n && cls(t[i + 1]) === c2) i++;
    return i;
  }
  if (i + 1 < n && cls(t[i + 1]) === c) {
    while (i + 1 < n && cls(t[i + 1]) === c) i++;
    return i;
  }
  i++;
  while (i < n && cls(t[i]) === "space") i++;
  if (i >= n) return Math.min(p, n - 1);
  const c2 = cls(t[i]);
  while (i + 1 < n && cls(t[i + 1]) === c2) i++;
  return i;
}

function moveWordBack(t: string, p: number): number {
  if (p <= 0) return 0;
  let i = p - 1;
  while (i > 0 && cls(t[i]) === "space") i--;
  if (cls(t[i]) === "space") return i;
  const c = cls(t[i]);
  while (i > 0 && cls(t[i - 1]) === c) i--;
  return i;
}

// ---------------------------------------------------------------------------
// motions
// ---------------------------------------------------------------------------

type MotionKind = "char" | "line";

interface MotionDest {
  pos: Pos;
  kind: MotionKind;
  inclusive: boolean;
  /** true for w / W so operators can clamp at end-of-line */
  wordForward: boolean;
}

const CHAR_MOTIONS = new Set(["h", "j", "k", "l", "w", "b", "e", "^", "$", "0"]);

export function motionDest(
  state: VimState,
  key: string,
  count: number,
): MotionDest | null {
  const { lines, row, col } = state;
  const t = lines.join("\n");
  const forward = (p: number) => posOf(lines, p);
  switch (key) {
    case "h":
      return { pos: { row, col: col - count }, kind: "char", inclusive: false, wordForward: false };
    case "l":
      return { pos: { row, col: col + count }, kind: "char", inclusive: false, wordForward: false };
    case "j":
      return { pos: { row: row + count, col }, kind: "line", inclusive: false, wordForward: false };
    case "k":
      return { pos: { row: row - count, col }, kind: "line", inclusive: false, wordForward: false };
    case "0":
      return { pos: { row, col: 0 }, kind: "char", inclusive: false, wordForward: false };
    case "^":
      return { pos: { row, col: firstNonBlank(lines[row]) }, kind: "char", inclusive: false, wordForward: false };
    case "$":
      return { pos: { row, col: Math.max(0, lines[row].length - 1) }, kind: "char", inclusive: true, wordForward: false };
    case "w": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordForward(t, p);
      return { pos: forward(p), kind: "char", inclusive: false, wordForward: true };
    }
    case "e": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordEnd(t, p);
      return { pos: forward(p), kind: "char", inclusive: true, wordForward: false };
    }
    case "b": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordBack(t, p);
      return { pos: forward(p), kind: "char", inclusive: false, wordForward: false };
    }
    case "G": {
      const r = count > 1 ? Math.min(count - 1, lines.length - 1) : lines.length - 1;
      return { pos: { row: r, col: firstNonBlank(lines[r]) }, kind: "line", inclusive: false, wordForward: false };
    }
    case "gg": {
      const r = count > 1 ? Math.min(count - 1, lines.length - 1) : 0;
      return { pos: { row: r, col: firstNonBlank(lines[r]) }, kind: "line", inclusive: false, wordForward: false };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// range + mutation helpers
// ---------------------------------------------------------------------------

function rangeOffsets(
  lines: string[],
  start: Pos,
  dest: Pos,
  inclusive: boolean,
): [number, number] {
  const so = offsetOf(lines, start.row, start.col);
  const d = offsetOf(lines, dest.row, dest.col);
  let a: number;
  let b: number;
  if (d >= so) {
    a = so;
    b = inclusive ? d : d - 1;
  } else {
    a = d;
    b = inclusive ? so : so - 1;
  }
  if (b < a) b = a;
  return [a, b];
}

function deleteOffsets(lines: string[], a: number, b: number): string[] {
  const t = lines.join("\n");
  return (t.slice(0, a) + t.slice(b + 1)).split("\n");
}

function deleteLines(lines: string[], r1: number, r2: number): string[] {
  const remaining = lines.filter((_, i) => i < r1 || i > r2);
  return remaining.length ? remaining : [""];
}

function registerFromRange(lines: string[], a: number, b: number): Register {
  const t = lines.join("\n");
  return { lines: t.slice(a, b + 1).split("\n"), linewise: false };
}

function registerFromLines(lines: string[], r1: number, r2: number): Register {
  return { lines: lines.slice(r1, r2 + 1), linewise: true };
}

function snapshot(state: VimState): Snapshot {
  return { lines: [...state.lines], row: state.row, col: state.col };
}

function markEdit(state: VimState): VimState {
  return {
    ...state,
    undoStack: [...state.undoStack, snapshot({ ...state, pendingOp: null, count: "", pendingG: false })],
    redoStack: [],
    edits: state.edits + 1,
    pendingOp: null,
    count: "",
    pendingG: false,
    pendingReplace: false,
    echo: "",
  };
}

function countOf(state: VimState): number {
  return state.count ? parseInt(state.count, 10) : 1;
}

function resetPending(state: VimState): VimState {
  return { ...state, pendingOp: null, count: "", pendingG: false, pendingReplace: false, echo: "" };
}

function echoFor(state: VimState): string {
  return `${state.count}${state.pendingOp ?? ""}${state.pendingG ? "g" : ""}${state.pendingReplace ? "r" : ""}`;
}

// ---------------------------------------------------------------------------
// operators
// ---------------------------------------------------------------------------

function resolveOperator(
  state: VimState,
  op: "d" | "c" | "y",
  motionKey: string,
  count: number,
): VimState {
  const lines = state.lines;
  const start: Pos = { row: state.row, col: state.col };

  let destInfo: MotionDest | null;

  // `cw` changes from the cursor to the end of the current word run (inclusive).
  const startChar = lines[start.row]?.[start.col];
  if (op === "c" && motionKey === "w" && count === 1 && startChar !== undefined && cls(startChar) !== "space") {
    const t = lines.join("\n");
    const c = cls(startChar);
    let e = offsetOf(lines, start.row, start.col);
    while (e + 1 < t.length && cls(t[e + 1]) === c) e++;
    destInfo = { pos: posOf(lines, e), kind: "char", inclusive: true, wordForward: false };
  } else {
    destInfo = motionDest(state, motionKey, count);
  }
  if (!destInfo) return resetPending(state);

  const { kind, inclusive, wordForward } = destInfo;
  let dest = destInfo.pos;

  // `dw` stops at end-of-line instead of crossing a line break.
  if (wordForward && dest.row !== start.row) {
    dest = { row: start.row, col: lines[start.row].length };
  }

  if (kind === "line") {
    const r1 = Math.min(start.row, dest.row);
    const r2 = Math.max(start.row, dest.row);
    const register = registerFromLines(lines, r1, r2);
    if (op === "y") {
      return resetPending({ ...state, register });
    }
    const edited = markEdit(state);
    const next = deleteLines(lines, r1, r2);
    if (op === "c") {
      const at = Math.min(r1, next.length);
      const withLine = [...next.slice(0, at), "", ...next.slice(at)];
      return { ...edited, lines: withLine, register, mode: "insert", row: at, col: 0, desiredCol: 0, echo: "" };
    }
    const row = Math.min(r1, next.length - 1);
    const col = firstNonBlank(next[row]);
    return { ...edited, lines: next, register, row, col, desiredCol: col, echo: "" };
  }

  const [a, b] = rangeOffsets(lines, start, dest, inclusive);
  if (op === "y") {
    return resetPending({ ...state, register: registerFromRange(lines, a, b) });
  }
  const register = registerFromRange(lines, a, b);
  const edited = markEdit(state);
  const next = deleteOffsets(lines, a, b);
  if (op === "c") {
    const c = clampInsert(next, posOf(next, a));
    return { ...edited, lines: next, register, mode: "insert", row: c.row, col: c.col, desiredCol: c.col, echo: "" };
  }
  const c = clampNormal(next, posOf(next, a));
  return { ...edited, lines: next, register, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
}

// linewise variant used by dd/cc/yy and Y
function resolveLinewise(state: VimState, op: "d" | "c" | "y", count: number): VimState {
  const lines = state.lines;
  const r1 = state.row;
  const r2 = Math.min(state.row + count - 1, lines.length - 1);
  const register = registerFromLines(lines, r1, r2);
  if (op === "y") {
    return resetPending({ ...state, register });
  }
  const edited = markEdit(state);
  const next = deleteLines(lines, r1, r2);
  if (op === "c") {
    const at = Math.min(r1, next.length);
    const withLine = [...next.slice(0, at), "", ...next.slice(at)];
    return { ...edited, lines: withLine, register, mode: "insert", row: at, col: 0, desiredCol: 0, echo: "" };
  }
  const row = Math.min(r1, next.length - 1);
  const col = firstNonBlank(next[row]);
  return { ...edited, lines: next, register, row, col, desiredCol: col, echo: "" };
}

// ---------------------------------------------------------------------------
// put
// ---------------------------------------------------------------------------

function put(state: VimState, before: boolean): VimState {
  const reg = state.register;
  if (!reg) return resetPending(state);
  const lines = state.lines;
  const edited = markEdit(state);

  if (reg.linewise) {
    const at = before ? state.row : state.row + 1;
    const next = [...lines.slice(0, at), ...reg.lines, ...lines.slice(at)];
    const col = firstNonBlank(next[at] ?? "");
    return { ...edited, lines: next, row: at, col, desiredCol: col, echo: "" };
  }

  const t = lines.join("\n");
  let ins = offsetOf(lines, state.row, state.col);
  if (!before) ins = Math.min(ins + 1, t.length);
  const text = reg.lines.join("\n");
  const next = (t.slice(0, ins) + text + t.slice(ins)).split("\n");
  const end = posOf(next, Math.max(0, ins + text.length - 1));
  const c = clampNormal(next, end);
  return { ...edited, lines: next, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
}

// ---------------------------------------------------------------------------
// undo / redo
// ---------------------------------------------------------------------------

function undo(state: VimState): VimState {
  if (!state.undoStack.length) return resetPending(state);
  const prev = state.undoStack[state.undoStack.length - 1];
  return {
    ...state,
    lines: prev.lines,
    row: prev.row,
    col: prev.col,
    desiredCol: prev.col,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, snapshot(state)],
    mode: "normal",
    pendingOp: null,
    count: "",
    pendingG: false,
    pendingReplace: false,
    visualAnchor: null,
    echo: "",
  };
}

function redo(state: VimState): VimState {
  if (!state.redoStack.length) return resetPending(state);
  const next = state.redoStack[state.redoStack.length - 1];
  return {
    ...state,
    lines: next.lines,
    row: next.row,
    col: next.col,
    desiredCol: next.col,
    undoStack: [...state.undoStack, snapshot(state)],
    redoStack: state.redoStack.slice(0, -1),
    mode: "normal",
    pendingOp: null,
    count: "",
    pendingG: false,
    pendingReplace: false,
    visualAnchor: null,
    echo: "",
  };
}

// ---------------------------------------------------------------------------
// insert mode
// ---------------------------------------------------------------------------

function enterInsert(state: VimState, pos: Pos): VimState {
  const edited = markEdit(state);
  const c = clampInsert(edited.lines, pos);
  return { ...edited, mode: "insert", row: c.row, col: c.col, desiredCol: c.col, echo: "" };
}

function handleInsert(state: VimState, key: string): VimState {
  const lines = state.lines;
  const { row, col } = state;

  if (key === "Escape") {
    const c = clampNormal(lines, { row, col: Math.max(0, col - 1) });
    return { ...state, mode: "normal", row: c.row, col: c.col, desiredCol: c.col, echo: "" };
  }
  if (key === "Enter") {
    const line = lines[row];
    const next = [...lines];
    next.splice(row, 1, line.slice(0, col), line.slice(col));
    return { ...state, lines: next, row: row + 1, col: 0, desiredCol: 0 };
  }
  if (key === "Tab") {
    const line = lines[row];
    const next = [...lines];
    next[row] = line.slice(0, col) + "  " + line.slice(col);
    return { ...state, lines: next, col: col + 2, desiredCol: col + 2 };
  }
  if (key === "Backspace") {
    if (col > 0) {
      const next = [...lines];
      next[row] = lines[row].slice(0, col - 1) + lines[row].slice(col);
      return { ...state, lines: next, col: col - 1, desiredCol: col - 1 };
    }
    if (row > 0) {
      const next = [...lines];
      const prevLen = next[row - 1].length;
      next[row - 1] = next[row - 1] + next[row];
      next.splice(row, 1);
      return { ...state, lines: next, row: row - 1, col: prevLen, desiredCol: prevLen };
    }
    return state;
  }
  if (key.length === 1) {
    const next = [...lines];
    next[row] = lines[row].slice(0, col) + key + lines[row].slice(col);
    return { ...state, lines: next, col: col + 1, desiredCol: col + 1 };
  }
  return state;
}

// ---------------------------------------------------------------------------
// visual mode
// ---------------------------------------------------------------------------

interface Selection {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

function selectionRange(state: VimState): Selection {
  const a = state.visualAnchor ?? { row: state.row, col: state.col };
  const p2 = { row: state.row, col: state.col };
  if (p2.row < a.row || (p2.row === a.row && p2.col < a.col)) {
    return { r1: p2.row, c1: p2.col, r2: a.row, c2: a.col };
  }
  return { r1: a.row, c1: a.col, r2: p2.row, c2: p2.col };
}

function applyVisualOperator(state: VimState, op: "d" | "c" | "y"): VimState {
  const lines = state.lines;
  const sel = selectionRange(state);

  if (state.mode === "visual-line") {
    const r1 = Math.min(sel.r1, sel.r2);
    const r2 = Math.max(sel.r1, sel.r2);
    if (op === "y") {
      return { ...state, mode: "normal", register: registerFromLines(lines, r1, r2), visualAnchor: null, echo: "" };
    }
    const edited = markEdit(state);
    const next = deleteLines(lines, r1, r2);
    if (op === "c") {
      const at = Math.min(r1, next.length);
      const withLine = [...next.slice(0, at), "", ...next.slice(at)];
      return { ...edited, lines: withLine, mode: "insert", row: at, col: 0, desiredCol: 0, visualAnchor: null, echo: "" };
    }
    const row = Math.min(r1, next.length - 1);
    const col = firstNonBlank(next[row]);
    return { ...edited, lines: next, mode: "normal", row, col, desiredCol: col, visualAnchor: null, echo: "" };
  }

  const a = offsetOf(lines, sel.r1, sel.c1);
  const b = offsetOf(lines, sel.r2, sel.c2);
  if (op === "y") {
    return { ...state, mode: "normal", register: registerFromRange(lines, a, b), visualAnchor: null, echo: "" };
  }
  const edited = markEdit(state);
  const next = deleteOffsets(lines, a, b);
  const c = clampNormal(next, posOf(next, a));
  if (op === "c") {
    return { ...edited, lines: next, mode: "insert", row: c.row, col: c.col, desiredCol: c.col, visualAnchor: null, echo: "" };
  }
  return { ...edited, lines: next, mode: "normal", row: c.row, col: c.col, desiredCol: c.col, visualAnchor: null, echo: "" };
}

function visualMotion(state: VimState, key: string, count: number): VimState {
  const destInfo = motionDest(state, key, count);
  if (!destInfo) return { ...state, count: "", echo: "" };
  const c = clampNormal(state.lines, destInfo.pos);
  return { ...state, row: c.row, col: c.col, desiredCol: c.col, count: "", echo: "" };
}

// ---------------------------------------------------------------------------
// normal mode
// ---------------------------------------------------------------------------

function handleNormal(state: VimState, key: string): VimState {
  if (key === "Escape") return resetPending(state);

  // pending g (from `g` motion prefix)
  if (state.pendingG) {
    if (key === "g") {
      const dest = motionDest(state, "gg", countOf(state))!;
      const c = clampNormal(state.lines, dest.pos);
      return resetPending({ ...state, row: c.row, col: c.col, desiredCol: c.col });
    }
    if (key === "t") {
      const n = state.tabs.length;
      return switchTab(resetPending(state), (state.activeTab + countOf(state)) % n);
    }
    if (key === "T") {
      const n = state.tabs.length;
      return switchTab(resetPending(state), (((state.activeTab - countOf(state)) % n) + n) % n);
    }
    return resetPending(state);
  }

  // replace char: next key replaces the character under the cursor
  if (state.pendingReplace) {
    if (key === "Escape") return resetPending(state);
    if (key.length === 1) {
      const line = state.lines[state.row];
      if (line.length === 0) return resetPending(state);
      const edited = markEdit(state);
      const next = [...edited.lines];
      next[state.row] = line.slice(0, state.col) + key + line.slice(state.col + 1);
      return resetPending({ ...edited, lines: next });
    }
    return resetPending(state);
  }

  // operator pending
  if (state.pendingOp) {
    const op = state.pendingOp;
    if (/[0-9]/.test(key) && !(key === "0" && state.count === "")) {
      const count = state.count + key;
      return { ...state, count, echo: echoFor({ ...state, count }) };
    }
    if (key === op) return resolveLinewise(state, op, countOf(state));
    if (key === "g") return { ...state, pendingG: true, echo: echoFor({ ...state, pendingG: true }) };
    if (CHAR_MOTIONS.has(key) || key === "G") {
      return resolveOperator(state, op, key, countOf(state));
    }
    return resetPending(state);
  }

  if (key === "u") return undo(state);
  if (key === "ctrl+r") return redo(state);

  // build a count
  if (/[1-9]/.test(key)) {
    const count = state.count + key;
    return { ...state, count, echo: echoFor({ ...state, count }) };
  }
  if (/[0-9]/.test(key)) {
    // '0' is a motion when no count is in progress, otherwise a count digit
    if (key === "0" && state.count === "") {
      const c = clampNormal(state.lines, { row: state.row, col: 0 });
      return { ...state, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
    }
    const count = state.count + key;
    return { ...state, count, echo: echoFor({ ...state, count }) };
  }

  // start an operator
  if (key === "d" || key === "c" || key === "y") {
    return { ...state, pendingOp: key, echo: echoFor({ ...state, pendingOp: key }) };
  }
  if (key === "D") return resolveOperator(state, "d", "$", countOf(state));
  if (key === "C") return resolveOperator(state, "c", "$", countOf(state));
  if (key === "Y") return resolveLinewise(state, "y", countOf(state));

  // entering insert
  if (key === "i") return enterInsert(state, { row: state.row, col: state.col });
  if (key === "a") return enterInsert(state, { row: state.row, col: state.col + 1 });
  if (key === "I") return enterInsert(state, { row: state.row, col: firstNonBlank(state.lines[state.row]) });
  if (key === "A") return enterInsert(state, { row: state.row, col: state.lines[state.row].length });
  if (key === "o") {
    const edited = markEdit(state);
    const next = [...edited.lines];
    next.splice(state.row + 1, 0, "");
    return { ...edited, lines: next, mode: "insert", row: state.row + 1, col: 0, desiredCol: 0, echo: "" };
  }
  if (key === "O") {
    const edited = markEdit(state);
    const next = [...edited.lines];
    next.splice(state.row, 0, "");
    return { ...edited, lines: next, mode: "insert", row: state.row, col: 0, desiredCol: 0, echo: "" };
  }

  // simple edits
  if (key === "x") {
    const line = state.lines[state.row];
    const edited = markEdit(state);
    if (!line.length) return resetPending(edited);
    const next = [...edited.lines];
    next[state.row] = line.slice(0, state.col) + line.slice(state.col + 1);
    const c = clampNormal(next, { row: state.row, col: state.col });
    return { ...edited, lines: next, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
  }
  if (key === "X") {
    const edited = markEdit(state);
    if (state.col === 0) return resetPending(edited);
    const next = [...edited.lines];
    next[state.row] = state.lines[state.row].slice(0, state.col - 1) + state.lines[state.row].slice(state.col);
    return { ...edited, lines: next, row: state.row, col: state.col - 1, desiredCol: state.col - 1, echo: "" };
  }
  if (key === "r") {
    return { ...state, pendingReplace: true, echo: echoFor({ ...state, pendingReplace: true }) };
  }
  if (key === "p") return put(state, false);
  if (key === "P") return put(state, true);

  // visual
  if (key === "v") {
    return { ...state, mode: "visual", visualAnchor: { row: state.row, col: state.col }, count: "", echo: "" };
  }
  if (key === "V") {
    return { ...state, mode: "visual-line", visualAnchor: { row: state.row, col: state.col }, count: "", echo: "" };
  }

  // motions
  if (key === "g") return { ...state, pendingG: true, echo: echoFor({ ...state, pendingG: true }) };
  if (CHAR_MOTIONS.has(key) || key === "G") {
    const destInfo = motionDest(state, key, countOf(state));
    if (!destInfo) return resetPending(state);
    if (key === "j" || key === "k") {
      const row = Math.max(0, Math.min(state.lines.length - 1, destInfo.pos.row));
      const col = Math.min(state.desiredCol, Math.max(0, state.lines[row].length - 1));
      return resetPending({ ...state, row, col });
    }
    const c = clampNormal(state.lines, destInfo.pos);
    return resetPending({ ...state, row: c.row, col: c.col, desiredCol: c.col });
  }

  return resetPending(state);
}

// ---------------------------------------------------------------------------
// command line / ctrl-w / register & mark prefixes
// ---------------------------------------------------------------------------

function handleCmdline(state: VimState, key: string): VimState {
  const cur = state.cmdline ?? ":";
  if (key === "Escape") return { ...state, mode: "normal", cmdline: null, echo: "" };
  if (key === "Enter") {
    const result = executeEx(state, cur);
    return { ...result, mode: "normal", cmdline: null };
  }
  if (key === "Backspace") {
    if (cur.length <= 1) return { ...state, mode: "normal", cmdline: null };
    return { ...state, cmdline: cur.slice(0, -1) };
  }
  if (key.length === 1) return { ...state, cmdline: cur + key };
  return state;
}

function handleCtrlW(state: VimState, key: string): VimState {
  switch (key) {
    case "s":
      return addSplit(state, "col");
    case "v":
      return addSplit(state, "row");
    case "h":
    case "j":
    case "k":
    case "l":
      return moveActiveWindow(state, key);
    case "w":
      return cycleActiveWindow(state, false);
    case "W":
      return cycleActiveWindow(state, true);
    case "c":
    case "q":
      return closeActiveWindow(state);
    case "o":
      return onlyActiveWindow(state);
    case "=":
      return { ...state, pendingCtrlW: false, statusMessage: "Windows equalized" };
    default:
      return { ...state, pendingCtrlW: false };
  }
}

/** Handle the pending multi-key prefixes, if any. Returns null when none apply. */
function handlePending(state: VimState, key: string): VimState | null {
  if (state.pendingCtrlW) return handleCtrlW(state, key);

  if (state.pendingRegister) {
    if (key.length === 1) {
      return { ...state, pendingRegister: false, activeRegister: key, echo: `"${key}` };
    }
    return { ...state, pendingRegister: false, echo: "" };
  }

  if (state.pendingMarkSet) {
    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      const win = activeWindow(state);
      const marks = {
        ...state.marks,
        [key]: { bufferId: win.bufferId, row: state.row, col: state.col },
      };
      return { ...state, marks, pendingMarkSet: false, echo: "" };
    }
    return { ...state, pendingMarkSet: false, echo: "" };
  }

  if (state.pendingMarkJump) {
    const exact = state.markJumpExact;
    const marker = state.marks[key];
    if (marker) {
      let s = state;
      const win = activeWindow(state);
      if (marker.bufferId !== win.bufferId) s = switchToBuffer(state, marker.bufferId);
      const col = exact ? marker.col : firstNonBlank(s.lines[marker.row] ?? "");
      const c = clampNormal(s.lines, { row: marker.row, col });
      return {
        ...s,
        row: c.row,
        col: c.col,
        desiredCol: c.col,
        pendingMarkJump: false,
        markJumpExact: false,
        echo: "",
      };
    }
    return { ...state, pendingMarkJump: false, markJumpExact: false, echo: "" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// public reducer
// ---------------------------------------------------------------------------

function baseHandleKey(state: VimState, key: string): VimState {
  if (state.mode === "insert") return handleInsert(state, key);

  if (state.mode === "visual" || state.mode === "visual-line") {
    if (key === "Escape") return { ...state, mode: "normal", visualAnchor: null, count: "", echo: "" };
    if (key === "d" || key === "x") return applyVisualOperator(state, "d");
    if (key === "c") return applyVisualOperator(state, "c");
    if (key === "y") return applyVisualOperator(state, "y");
    if (/[0-9]/.test(key)) {
      if (key === "0" && state.count === "") return visualMotion(state, "0", 1);
      return { ...state, count: state.count + key };
    }
    if (key === "g") return { ...state, pendingG: true };
    if (state.pendingG) {
      if (key === "g") return visualMotion(state, "gg", countOf(state));
      return { ...state, pendingG: false };
    }
    if (CHAR_MOTIONS.has(key) || key === "G") return visualMotion(state, key, countOf(state));
    return state;
  }

  return handleNormal(state, key);
}

export function handleKey(state: VimState, key: string): VimState {
  if (state.mode === "cmdline") return commit(handleCmdline(state, key));

  if (state.mode === "normal") {
    const pending = handlePending(state, key);
    if (pending) return commit(pending);

    if (key === "ctrl+w") return commit({ ...state, pendingCtrlW: true, echo: "^W" });
    if (key === '"') return commit({ ...state, pendingRegister: true, echo: '"' });
    if (key === "m") return commit({ ...state, pendingMarkSet: true, echo: "m" });
    if (key === "'") return commit({ ...state, pendingMarkJump: true, markJumpExact: false, echo: "'" });
    if (key === "`") return commit({ ...state, pendingMarkJump: true, markJumpExact: true, echo: "`" });
    if (key === ":") return commit({ ...state, mode: "cmdline", cmdline: ":", echo: "" });
  }

  // a chosen register applies to the next put
  const regName = state.activeRegister;
  let working = state;
  if (regName && (key === "p" || key === "P")) {
    const r = getRegister(state, regName);
    if (r) working = { ...state, register: r };
  }

  const regBefore = working.register;
  let next = baseHandleKey(working, key);

  // a completed yank/delete stores into the chosen register too
  if (regName && next.register && next.register !== regBefore) {
    next = setRegister(next, regName, next.register);
  }
  // clear the chosen register once the command that uses it has finished
  if (regName && !next.pendingOp && next.mode !== "insert" && next.mode !== "cmdline") {
    next = { ...next, activeRegister: null };
  }

  return commit(next);
}

export { offsetOf, posOf };
