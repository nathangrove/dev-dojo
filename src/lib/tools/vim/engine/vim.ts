import type { FindKind, Pos, Register, Snapshot, VimState } from "./types";
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
// WORD motions (W / B / E): punctuation counts as part of the word
// ---------------------------------------------------------------------------

function bigCls(ch: string | undefined): "word" | "space" {
  return ch === undefined || ch === "" || /\s/.test(ch) ? "space" : "word";
}

function moveWordForwardBig(t: string, p: number): number {
  const n = t.length;
  if (n === 0) return 0;
  let i = p;
  if (i < n && bigCls(t[i]) !== "space") {
    while (i < n && bigCls(t[i]) === "word") i++;
  }
  while (i < n && bigCls(t[i]) === "space") i++;
  return i >= n ? n - 1 : i;
}

function moveWordEndBig(t: string, p: number): number {
  const n = t.length;
  if (n === 0) return 0;
  let i = Math.min(p, n - 1);
  if (bigCls(t[i]) === "space") {
    while (i < n && bigCls(t[i]) === "space") i++;
    if (i >= n) return n - 1;
  }
  while (i + 1 < n && bigCls(t[i + 1]) === "word") i++;
  return i;
}

function moveWordBackBig(t: string, p: number): number {
  if (p <= 0) return 0;
  let i = p - 1;
  while (i > 0 && bigCls(t[i]) === "space") i--;
  if (bigCls(t[i]) === "space") return i;
  while (i > 0 && bigCls(t[i - 1]) === "word") i--;
  return i;
}

// ---------------------------------------------------------------------------
// paragraph motions ({ / })
// ---------------------------------------------------------------------------

/** Row `count` paragraphs away: `}` forward, `{` backward. Blank lines separate. */
function paragraphRow(lines: string[], row: number, forward: boolean, count: number): number {
  const n = lines.length;
  let r = row;
  for (let c = 0; c < count; c++) {
    if (forward) {
      while (r + 1 < n && lines[r + 1].trim() !== "") r++;
      while (r + 1 < n && lines[r + 1].trim() === "") r++;
    } else {
      while (r > 0 && lines[r - 1].trim() !== "") r--;
      while (r > 0 && lines[r - 1].trim() === "") r--;
    }
  }
  return Math.max(0, Math.min(n - 1, r));
}

// ---------------------------------------------------------------------------
// bracket matching (%)
// ---------------------------------------------------------------------------

const CLOSER_FOR: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const OPENER_FOR: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function isPairChar(ch: string | undefined): boolean {
  return ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "{" || ch === "}";
}

/** Offset of the bracket matching the one at/after the cursor, or null. */
function matchPairOffset(lines: string[], row: number, col: number): number | null {
  const t = lines.join("\n");
  const p = offsetOf(lines, row, col);
  let i = p;
  while (i < t.length && !isPairChar(t[i])) i++;
  if (i >= t.length) return null;
  const ch = t[i];

  if (CLOSER_FOR[ch]) {
    // on ( [ { — find its closer
    const close = CLOSER_FOR[ch];
    let depth = 0;
    for (let j = i; j < t.length; j++) {
      if (t[j] === ch) depth++;
      else if (t[j] === close) {
        depth--;
        if (depth === 0) return j;
      }
    }
    return null;
  }

  // on ) ] } — jump to the enclosing opener
  const open = OPENER_FOR[ch];
  let depth = 0;
  for (let j = i; j >= 0; j--) {
    if (t[j] === ch) depth++;
    else if (t[j] === open) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// jump list (Ctrl-o / Ctrl-i)
// ---------------------------------------------------------------------------

function pushJump(state: VimState): VimState {
  const cur = { row: state.row, col: state.col };
  const last = state.jumplist[state.jumpIndex - 1];
  if (last && last.row === cur.row && last.col === cur.col) return state;
  const jumplist = [...state.jumplist.slice(0, state.jumpIndex), cur];
  return { ...state, jumplist, jumpIndex: jumplist.length };
}

function jumpBack(state: VimState): VimState {
  if (state.jumpIndex <= 0) return resetPending(state);
  const cur = { row: state.row, col: state.col };
  const jumplist = [...state.jumplist];
  const fwd = jumplist[state.jumpIndex];
  if (!fwd || fwd.row !== cur.row || fwd.col !== cur.col) {
    jumplist.splice(state.jumpIndex, 0, cur);
  }
  const target = jumplist[state.jumpIndex - 1];
  const c = clampNormal(state.lines, target);
  return resetPending({ ...state, jumplist, jumpIndex: state.jumpIndex - 1, row: c.row, col: c.col, desiredCol: c.col });
}

function jumpForward(state: VimState): VimState {
  if (state.jumpIndex + 1 >= state.jumplist.length) return resetPending(state);
  const target = state.jumplist[state.jumpIndex + 1];
  const c = clampNormal(state.lines, target);
  return resetPending({ ...state, jumpIndex: state.jumpIndex + 1, row: c.row, col: c.col, desiredCol: c.col });
}

// ---------------------------------------------------------------------------
// viewport (H / M / L, zz / zt / zb, Ctrl-d / Ctrl-u)
// ---------------------------------------------------------------------------

export const SCREEN_ROWS = 20;
export const SHIFT_WIDTH = 2;

function ensureVisible(state: VimState): VimState {
  const maxTop = Math.max(0, state.lines.length - SCREEN_ROWS);
  let topRow = Math.max(0, Math.min(state.topRow, maxTop));
  if (state.row < topRow) topRow = state.row;
  else if (state.row >= topRow + SCREEN_ROWS) topRow = state.row - SCREEN_ROWS + 1;
  topRow = Math.max(0, Math.min(topRow, maxTop));
  return topRow === state.topRow ? state : { ...state, topRow };
}

function pageMove(state: VimState, down: boolean): VimState {
  const half = Math.floor(SCREEN_ROWS / 2);
  const maxTop = Math.max(0, state.lines.length - SCREEN_ROWS);
  const row = Math.max(0, Math.min(state.lines.length - 1, state.row + (down ? half : -half)));
  const topRow = Math.max(0, Math.min(state.topRow + (down ? half : -half), maxTop));
  const c = clampNormal(state.lines, { row, col: state.col });
  return resetPending({ ...state, row: c.row, col: c.col, desiredCol: c.col, topRow });
}

function scrollCursor(state: VimState, where: "top" | "middle" | "bottom"): VimState {
  const maxTop = Math.max(0, state.lines.length - SCREEN_ROWS);
  const topRow = Math.max(0, Math.min(state.topRow, maxTop));
  let row: number;
  if (where === "top") row = topRow;
  else if (where === "bottom") row = Math.min(topRow + SCREEN_ROWS - 1, state.lines.length - 1);
  else row = Math.min(topRow + Math.floor(SCREEN_ROWS / 2), state.lines.length - 1);
  const line = state.lines[row] ?? "";
  const col = clampNormal(state.lines, { row, col: firstNonBlank(line) }).col;
  return resetPending({ ...state, row, col, desiredCol: col, topRow });
}

/** zz / zt / zb — scroll the view without moving the cursor. */
function scrollView(state: VimState, where: "center" | "top" | "bottom"): VimState {
  const maxTop = Math.max(0, state.lines.length - SCREEN_ROWS);
  let topRow: number;
  if (where === "center") topRow = state.row - Math.floor(SCREEN_ROWS / 2);
  else if (where === "top") topRow = state.row;
  else topRow = state.row - SCREEN_ROWS + 1;
  topRow = Math.max(0, Math.min(topRow, maxTop));
  return resetPending({ ...state, topRow });
}

// ---------------------------------------------------------------------------
// indent (> <)
// ---------------------------------------------------------------------------

function indentLines(
  state: VimState,
  r1: number,
  r2: number,
  count: number,
  outdent: boolean,
): VimState {
  const edited = markEdit(state);
  const next = [...edited.lines];
  const lo = Math.max(0, r1);
  const hi = Math.min(r2, next.length - 1);
  for (let r = lo; r <= hi; r++) {
    if (outdent) {
      const lead = (next[r].match(/^ */) ?? [""])[0].length;
      next[r] = next[r].slice(Math.min(count * SHIFT_WIDTH, lead));
    } else {
      next[r] = " ".repeat(count * SHIFT_WIDTH) + next[r];
    }
  }
  const row = Math.min(state.row, next.length - 1);
  const col = firstNonBlank(next[row] ?? "");
  return resetPending({ ...edited, lines: next, row, col, desiredCol: col });
}

function applyVisualIndent(state: VimState, outdent: boolean): VimState {
  const sel = selectionRange(state);
  const r1 = Math.min(sel.r1, sel.r2);
  const r2 = Math.max(sel.r1, sel.r2);
  const count = state.count ? parseInt(state.count, 10) : 1;
  const s = indentLines(state, r1, r2, count, outdent);
  return { ...s, mode: "normal", visualAnchor: null };
}

// ---------------------------------------------------------------------------
// case (gU / gu / g~, ~, visual u/U)
// ---------------------------------------------------------------------------

function caseChar(ch: string, how: "upper" | "lower" | "toggle"): string {
  if (how === "upper") return ch.toUpperCase();
  if (how === "lower") return ch.toLowerCase();
  return ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? ch.toUpperCase() : ch.toLowerCase();
}

function applyCaseRange(
  state: VimState,
  how: "upper" | "lower" | "toggle",
  a: number,
  b: number,
): VimState {
  const t = state.lines.join("\n");
  const changed = t.slice(a, b + 1).replace(/[^\n]/g, (ch) => caseChar(ch, how));
  const edited = markEdit(state);
  const next = (t.slice(0, a) + changed + t.slice(b + 1)).split("\n");
  return resetPending({ ...edited, lines: next });
}

function applyCaseLines(
  state: VimState,
  how: "upper" | "lower" | "toggle",
  r1: number,
  r2: number,
): VimState {
  const edited = markEdit(state);
  const next = [...edited.lines];
  const lo = Math.max(0, r1);
  const hi = Math.min(r2, next.length - 1);
  for (let r = lo; r <= hi; r++) {
    next[r] = [...next[r]].map((ch) => caseChar(ch, how)).join("");
  }
  return resetPending({ ...edited, lines: next });
}

function applyVisualCase(state: VimState, how: "upper" | "lower" | "toggle"): VimState {
  const sel = selectionRange(state);
  if (state.mode === "visual-line") {
    const s = applyCaseLines(state, how, Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2));
    return { ...s, mode: "normal", visualAnchor: null };
  }
  const a = offsetOf(state.lines, sel.r1, sel.c1);
  const b = offsetOf(state.lines, sel.r2, sel.c2);
  const s = applyCaseRange(state, how, a, b);
  return { ...s, mode: "normal", visualAnchor: null };
}

// ---------------------------------------------------------------------------
// join (J)
// ---------------------------------------------------------------------------

function joinLines(state: VimState, count: number): VimState {
  const lines = [...state.lines];
  if (state.row + 1 >= lines.length) return resetPending(state);
  const joinPos = Math.max(0, lines[state.row].replace(/\s+$/, "").length);
  let r = state.row;
  for (let i = 0; i < count && r + 1 < lines.length; i++) {
    const cur = lines[r];
    const nxt = lines[r + 1];
    const lead = (nxt.match(/^ */) ?? [""])[0].length;
    const body = nxt.slice(lead);
    const sep = cur.replace(/\s+$/, "").length === 0 || body.length === 0 ? "" : " ";
    lines[r] = cur.replace(/\s+$/, "") + sep + body;
    lines.splice(r + 1, 1);
  }
  const edited = markEdit(state);
  const c = clampNormal(lines, { row: r, col: joinPos });
  return resetPending({ ...edited, lines, row: c.row, col: c.col, desiredCol: c.col });
}

// ---------------------------------------------------------------------------
// character search (f / t / F / T)
// ---------------------------------------------------------------------------

function findDest(
  state: VimState,
  kind: FindKind,
  char: string,
  count: number,
): MotionDest | null {
  const { lines, row, col } = state;
  const line = lines[row] ?? "";
  const forward = kind === "f" || kind === "t";
  const till = kind === "t" || kind === "T";
  const hits: number[] = [];
  if (forward) {
    for (let c = col + 1; c < line.length; c++) if (line[c] === char) hits.push(c);
  } else {
    for (let c = col - 1; c >= 0; c--) if (line[c] === char) hits.push(c);
  }
  const hit = hits[count - 1];
  if (hit === undefined) return null;
  const destCol = till ? (forward ? hit - 1 : hit + 1) : hit;
  if (forward && destCol <= col) return null;
  if (!forward && destCol >= col) return null;
  // the cursor lands on the last char before/at the target, which operators include
  return { pos: { row, col: destCol }, kind: "char", inclusive: true, wordForward: false };
}

function applyFind(state: VimState, kind: FindKind, char: string, count: number): VimState {
  const dest = findDest(state, kind, char, count);
  if (!dest) return resetPending(state);
  const found = { ...state, lastFind: { kind, char } };
  if (found.pendingOp) {
    const op = found.pendingOp;
    if (op === ">" || op === "<") {
      const r1 = Math.min(found.row, dest.pos.row);
      const r2 = Math.max(found.row, dest.pos.row);
      return indentLines({ ...found, pendingOp: null }, r1, r2, 1, op === "<");
    }
    return applyOperatorDest({ ...found, pendingOp: null }, op, dest);
  }
  const c = clampNormal(found.lines, dest.pos);
  if (found.mode === "visual" || found.mode === "visual-line") {
    return { ...found, row: c.row, col: c.col, desiredCol: c.col, count: "", echo: "" };
  }
  return resetPending({ ...found, row: c.row, col: c.col, desiredCol: c.col });
}

// ---------------------------------------------------------------------------
// search (/ ? n N)
// ---------------------------------------------------------------------------

function searchFrom(
  state: VimState,
  pattern: string,
  forward: boolean,
  count = 1,
): VimState {
  if (!pattern) return state;
  const lines = state.lines;
  const text = lines.join("\n");
  let from = offsetOf(lines, state.row, state.col);
  let at = -1;
  for (let i = 0; i < count; i++) {
    if (forward) {
      at = text.indexOf(pattern, from + 1);
      if (at === -1) at = text.indexOf(pattern);
    } else {
      at = from > 0 ? text.lastIndexOf(pattern, from - 1) : -1;
      if (at === -1) at = text.lastIndexOf(pattern);
    }
    if (at === -1) {
      return { ...state, statusMessage: `E486: Pattern not found: ${pattern}` };
    }
    from = at;
  }
  const pos = posOf(lines, at);
  return {
    ...state,
    row: pos.row,
    col: pos.col,
    desiredCol: pos.col,
    searchPattern: pattern,
    searchForward: forward,
    statusMessage: `/${pattern}`,
  };
}

// ---------------------------------------------------------------------------
// text objects (iw, aw, i", a", i(, a( …)
// ---------------------------------------------------------------------------

function wordObjectOffsets(state: VimState, inner: boolean): [number, number] {
  const lines = state.lines;
  const t = lines.join("\n");
  const p = offsetOf(lines, state.row, state.col);
  const c = cls(t[p]);
  let a = p;
  let b = p;
  if (c !== "space") {
    while (a > 0 && cls(t[a - 1]) === c) a--;
    while (b + 1 < t.length && cls(t[b + 1]) === c) b++;
  } else {
    while (a > 0 && t[a - 1] !== "\n" && cls(t[a - 1]) === "space") a--;
    while (b + 1 < t.length && t[b + 1] !== "\n" && cls(t[b + 1]) === "space") b++;
  }
  if (!inner) {
    let e = b;
    while (e + 1 < t.length && t[e + 1] !== "\n" && cls(t[e + 1]) === "space") e++;
    if (e > b) {
      b = e;
    } else {
      let s = a;
      while (s > 0 && t[s - 1] !== "\n" && cls(t[s - 1]) === "space") s--;
      a = s;
    }
  }
  return [a, b];
}

const PAIR_OBJECTS: Record<string, [string, string]> = {
  "(": ["(", ")"],
  ")": ["(", ")"],
  b: ["(", ")"],
  "[": ["[", "]"],
  "]": ["[", "]"],
  "{": ["{", "}"],
  "}": ["{", "}"],
  B: ["{", "}"],
  "<": ["<", ">"],
  ">": ["<", ">"],
};

function pairObjectOffsets(
  state: VimState,
  open: string,
  close: string,
  inner: boolean,
): [number, number] | null {
  const lines = state.lines;
  const t = lines.join("\n");
  const p = offsetOf(lines, state.row, state.col);

  if (open === close) {
    let a: number;
    let b: number;
    if (t[p] === open) {
      a = p;
      b = t.indexOf(close, p + 1);
    } else {
      a = p > 0 ? t.lastIndexOf(open, p - 1) : -1;
      b = t.indexOf(close, p);
    }
    if (a === -1 || b === -1 || b <= a) return null;
    return inner ? [a + 1, b - 1] : [a, b];
  }

  let depth = 0;
  let a = -1;
  for (let i = t[p] === close ? p - 1 : p; i >= 0; i--) {
    if (t[i] === close) depth++;
    else if (t[i] === open) {
      if (depth === 0) {
        a = i;
        break;
      }
      depth--;
    }
  }
  if (a === -1) return null;

  depth = 0;
  let b = -1;
  for (let i = a; i < t.length; i++) {
    if (t[i] === open) depth++;
    else if (t[i] === close) {
      depth--;
      if (depth === 0) {
        b = i;
        break;
      }
    }
  }
  if (b === -1) return null;
  return inner ? [a + 1, b - 1] : [a, b];
}

function textObjectOffsets(
  state: VimState,
  prefix: "i" | "a",
  key: string,
): [number, number] | null {
  if (key === "w" || key === "W") return wordObjectOffsets(state, prefix === "i");
  const pair = PAIR_OBJECTS[key];
  if (pair) return pairObjectOffsets(state, pair[0], pair[1], prefix === "i");
  if (key === '"' || key === "'" || key === "`") {
    return pairObjectOffsets(state, key, key, prefix === "i");
  }
  return null;
}

function applyTextObject(state: VimState, prefix: "i" | "a", key: string): VimState {
  const range = textObjectOffsets(state, prefix, key);
  const s: VimState = { ...state, pendingTextObject: null, count: "" };
  if (!range) return resetPending(s);
  const [a, b] = range;
  if (s.pendingCase) {
    const how = s.pendingCase;
    return applyCaseRange({ ...s, pendingCase: null }, how, a, b);
  }
  if (s.pendingOp) {
    const op = s.pendingOp;
    if (op === ">" || op === "<") {
      const r1 = posOf(s.lines, a).row;
      const r2 = posOf(s.lines, b).row;
      return indentLines({ ...s, pendingOp: null }, r1, r2, 1, op === "<");
    }
    return applyCharwiseRange({ ...s, pendingOp: null }, op, a, b);
  }
  if (s.mode === "visual" || s.mode === "visual-line") {
    const anchor = posOf(s.lines, a);
    const end = posOf(s.lines, b);
    return {
      ...s,
      mode: "visual",
      visualAnchor: anchor,
      row: end.row,
      col: end.col,
      desiredCol: end.col,
      echo: "",
    };
  }
  return resetPending(s);
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

const CHAR_MOTIONS = new Set([
  "h", "j", "k", "l", "w", "b", "e",
  "W", "B", "E",
  "^", "$", "0", "{", "}",
  "%",
]);

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
    case "W": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordForwardBig(t, p);
      return { pos: forward(p), kind: "char", inclusive: false, wordForward: true };
    }
    case "e": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordEnd(t, p);
      return { pos: forward(p), kind: "char", inclusive: true, wordForward: false };
    }
    case "E": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordEndBig(t, p);
      return { pos: forward(p), kind: "char", inclusive: true, wordForward: false };
    }
    case "b": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordBack(t, p);
      return { pos: forward(p), kind: "char", inclusive: false, wordForward: false };
    }
    case "B": {
      let p = offsetOf(lines, row, col);
      for (let i = 0; i < count; i++) p = moveWordBackBig(t, p);
      return { pos: forward(p), kind: "char", inclusive: false, wordForward: false };
    }
    case "{": {
      const r = paragraphRow(lines, row, false, count);
      return { pos: { row: r, col: firstNonBlank(lines[r]) }, kind: "char", inclusive: false, wordForward: false };
    }
    case "}": {
      const r = paragraphRow(lines, row, true, count);
      return { pos: { row: r, col: firstNonBlank(lines[r]) }, kind: "char", inclusive: false, wordForward: false };
    }
    case "%": {
      const m = matchPairOffset(lines, row, col);
      if (m === null) return null;
      const p = posOf(lines, m);
      return { pos: p, kind: "char", inclusive: true, wordForward: false };
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
  const caseKey =
    state.pendingCase === "upper" ? "gU" : state.pendingCase === "lower" ? "gu" : state.pendingCase === "toggle" ? "g~" : "";
  const zKey = state.pendingZ ? "z" : "";
  return `${state.count}${state.pendingOp ?? ""}${state.pendingG ? "g" : ""}${caseKey}${zKey}${state.pendingReplace ? "r" : ""}`;
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
  return applyOperatorDest(state, op, destInfo);
}

/** Apply an operator to a resolved motion destination. */
function applyOperatorDest(state: VimState, op: "d" | "c" | "y", destInfo: MotionDest): VimState {
  const lines = state.lines;
  const start: Pos = { row: state.row, col: state.col };
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

/** Apply a charwise operator to an explicit flat-buffer range (used by text objects). */
function applyCharwiseRange(state: VimState, op: "d" | "c" | "y", a: number, b: number): VimState {
  const lines = state.lines;
  const register = registerFromRange(lines, a, b);
  if (op === "y") {
    return resetPending({ ...state, register });
  }
  const edited = markEdit(state);
  const next = deleteOffsets(lines, a, b);
  if (op === "c") {
    const c = clampInsert(next, posOf(next, a));
    return {
      ...edited,
      lines: next,
      register,
      mode: "insert",
      row: c.row,
      col: c.col,
      desiredCol: c.col,
      echo: "",
    };
  }
  const c = clampNormal(next, posOf(next, a));
  return { ...edited, lines: next, register, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
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

  // pending g (from `g` motion prefix, or gU / gu / g~ case operators)
  if (state.pendingG) {
    if (key === "g") {
      const dest = motionDest(state, "gg", countOf(state))!;
      const c = clampNormal(state.lines, dest.pos);
      return resetPending(pushJump({ ...state, row: c.row, col: c.col, desiredCol: c.col }));
    }
    if (key === "t") {
      const n = state.tabs.length;
      return switchTab(resetPending(state), (state.activeTab + countOf(state)) % n);
    }
    if (key === "T") {
      const n = state.tabs.length;
      return switchTab(resetPending(state), (((state.activeTab - countOf(state)) % n) + n) % n);
    }
    if (key === "U" || key === "u" || key === "~") {
      const how = key === "U" ? "upper" : key === "u" ? "lower" : "toggle";
      const next: VimState = { ...state, pendingG: false, pendingCase: how };
      return { ...next, echo: echoFor(next) };
    }
    return resetPending(state);
  }

  // pending z (zz / zt / zb scroll commands)
  if (state.pendingZ) {
    if (key === "z") return scrollView(state, "center");
    if (key === "t") return scrollView(state, "top");
    if (key === "b") return scrollView(state, "bottom");
    return resetPending(state);
  }

  // pending case operator (gU / gu / g~ waits for a motion, text object, or self)
  if (state.pendingCase) {
    const how = state.pendingCase;
    const count = countOf(state);
    if ((key === "U" && how === "upper") || (key === "u" && how === "lower") || (key === "~" && how === "toggle")) {
      return applyCaseLines({ ...state, pendingCase: null }, how, state.row, state.row + count - 1);
    }
    if (/[0-9]/.test(key) && !(key === "0" && state.count === "")) {
      const c = state.count + key;
      return { ...state, count: c, echo: echoFor({ ...state, count: c }) };
    }
    if (key === "i" || key === "a") {
      return { ...state, pendingTextObject: key, echo: echoFor(state) + key };
    }
    const dest = motionDest(state, key, count);
    if (!dest) return resetPending(state);
    if (dest.kind === "line") {
      const r1 = Math.min(state.row, dest.pos.row);
      const r2 = Math.max(state.row, dest.pos.row);
      return applyCaseLines({ ...state, pendingCase: null }, how, r1, r2);
    }
    const [a, b] = rangeOffsets(state.lines, { row: state.row, col: state.col }, dest.pos, dest.inclusive);
    return applyCaseRange({ ...state, pendingCase: null }, how, a, b);
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

  // character search: f/t/F/T wait for the target character
  if (key === "f" || key === "t" || key === "F" || key === "T") {
    return { ...state, pendingFind: key, echo: key };
  }
  // repeat the last character search (; same way, , reversed)
  if ((key === ";" || key === ",") && state.lastFind) {
    const kind = key === ";" ? state.lastFind.kind : reverseFind(state.lastFind.kind);
    return applyFind(state, kind, state.lastFind.char, countOf(state));
  }
  // a text object after an operator, e.g. ciw / da"
  if ((key === "i" || key === "a") && state.pendingOp) {
    return { ...state, pendingTextObject: key, echo: echoFor(state) + key };
  }

  // operator pending
  if (state.pendingOp) {
    const op = state.pendingOp;
    if (op === ">" || op === "<") {
      const outdent = op === "<";
      if (key === op) {
        return indentLines(state, state.row, state.row + countOf(state) - 1, 1, outdent);
      }
      if (/[0-9]/.test(key) && !(key === "0" && state.count === "")) {
        const count = state.count + key;
        return { ...state, count, echo: echoFor({ ...state, count }) };
      }
      if (CHAR_MOTIONS.has(key) || key === "G") {
        const dest = motionDest(state, key, countOf(state));
        if (!dest) return resetPending(state);
        const count = countOf(state);
        let r1 = Math.min(state.row, dest.pos.row);
        let r2 = Math.max(state.row, dest.pos.row);
        // an explicit count caps how many lines the indent touches: `2>j` == 2 lines
        if (count > 1) {
          if (dest.pos.row >= state.row) r2 = Math.min(r2, state.row + count - 1);
          else r1 = Math.max(r1, state.row - count + 1);
        }
        return indentLines(state, r1, r2, 1, outdent);
      }
      return resetPending(state);
    }
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

  // repeat the last search in the same / opposite direction
  if (key === "n" && state.searchPattern) {
    return resetPending(searchFrom(pushJump(state), state.searchPattern, state.searchForward, countOf(state)));
  }
  if (key === "N" && state.searchPattern) {
    return resetPending(searchFrom(pushJump(state), state.searchPattern, !state.searchForward, countOf(state)));
  }

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
  if (key === "d" || key === "c" || key === "y" || key === ">" || key === "<") {
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
  if (key === "J") return joinLines(state, countOf(state));
  if (key === "s") {
    const line = state.lines[state.row];
    const edited = markEdit(state);
    if (!line.length) return resetPending(edited);
    const next = [...edited.lines];
    next[state.row] = line.slice(0, state.col) + line.slice(state.col + 1);
    return { ...edited, lines: next, mode: "insert", row: state.row, col: state.col, desiredCol: state.col, echo: "" };
  }
  if (key === "S") {
    const edited = markEdit(state);
    const next = [...edited.lines];
    next[state.row] = "";
    return { ...edited, lines: next, mode: "insert", row: state.row, col: 0, desiredCol: 0, echo: "" };
  }
  if (key === "~") {
    const count = countOf(state);
    const edited = markEdit(state);
    const next = [...edited.lines];
    const line = state.lines[state.row];
    let col = state.col;
    for (let i = 0; i < count && col < line.length; i++, col++) {
      next[state.row] =
        next[state.row].slice(0, col) + caseChar(line[col], "toggle") + next[state.row].slice(col + 1);
    }
    const c = clampNormal(next, { row: state.row, col: Math.min(col, Math.max(0, next[state.row].length - 1)) });
    return { ...edited, lines: next, row: c.row, col: c.col, desiredCol: c.col, echo: "" };
  }

  // star / hash: search for the word under the cursor
  if (key === "*" || key === "#") {
    const t = state.lines.join("\n");
    const p = offsetOf(state.lines, state.row, state.col);
    const ch = t[p];
    if (!ch || cls(ch) === "space") return resetPending(state);
    const c = cls(ch);
    let a = p;
    let b = p;
    while (a > 0 && t[a - 1] !== "\n" && cls(t[a - 1]) === c) a--;
    while (b + 1 < t.length && t[b + 1] !== "\n" && cls(t[b + 1]) === c) b++;
    const word = t.slice(a, b + 1);
    if (!word) return resetPending(state);
    return resetPending(searchFrom(pushJump(state), word, key === "*", countOf(state)));
  }

  // jump list
  if (key === "ctrl+o") return jumpBack(state);
  if (key === "ctrl+i") return jumpForward(state);

  // viewport movement
  if (key === "ctrl+d") return pageMove(state, true);
  if (key === "ctrl+u") return pageMove(state, false);
  if (key === "H") return scrollCursor(state, "top");
  if (key === "M") return scrollCursor(state, "middle");
  if (key === "L") return scrollCursor(state, "bottom");

  // visual
  if (key === "v") {
    return { ...state, mode: "visual", visualAnchor: { row: state.row, col: state.col }, count: "", echo: "" };
  }
  if (key === "V") {
    return { ...state, mode: "visual-line", visualAnchor: { row: state.row, col: state.col }, count: "", echo: "" };
  }

  // motions
  if (key === "g") return { ...state, pendingG: true, echo: echoFor({ ...state, pendingG: true }) };
  if (key === "z") return { ...state, pendingZ: true, echo: echoFor({ ...state, pendingZ: true }) };
  if (CHAR_MOTIONS.has(key) || key === "G") {
    const destInfo = motionDest(state, key, countOf(state));
    if (!destInfo) return resetPending(state);
    let s = state;
    if (key === "%" || key === "G") s = pushJump(state);
    if (key === "j" || key === "k") {
      const row = Math.max(0, Math.min(s.lines.length - 1, destInfo.pos.row));
      const col = Math.min(s.desiredCol, Math.max(0, s.lines[row].length - 1));
      return resetPending({ ...s, row, col });
    }
    const c = clampNormal(s.lines, destInfo.pos);
    return resetPending({ ...s, row: c.row, col: c.col, desiredCol: c.col });
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
    if (cur.startsWith("/") || cur.startsWith("?")) {
      const forward = cur.startsWith("/");
      const pattern = cur.slice(1) || state.searchPattern;
      const searched = searchFrom(pushJump(state), pattern, forward);
      return { ...searched, mode: "normal", cmdline: null };
    }
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
  if (state.pendingRecord) {
    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      return {
        ...state,
        pendingRecord: false,
        recording: key,
        recordingKeys: [],
        echo: `recording @${key}`,
      };
    }
    return { ...state, pendingRecord: false, echo: "" };
  }

  if (state.pendingPlay) {
    const name = key === "@" ? state.lastMacro : key;
    if (name && state.macros[name]) return playMacro(state, name);
    return { ...state, pendingPlay: false, echo: "" };
  }

  if (state.recording && key === "q" && isIdle(state)) {
    return {
      ...state,
      recording: null,
      recordingKeys: [],
      macros: { ...state.macros, [state.recording]: state.recordingKeys },
      echo: `recorded @${state.recording}`,
    };
  }

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
      let s = pushJump(state);
      const win = activeWindow(state);
      if (marker.bufferId !== win.bufferId) s = switchToBuffer(s, marker.bufferId);
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
    if (key === ">") return applyVisualIndent(state, false);
    if (key === "<") return applyVisualIndent(state, true);
    if (key === "u") return applyVisualCase(state, "lower");
    if (key === "U") return applyVisualCase(state, "upper");
    if (key === "~") return applyVisualCase(state, "toggle");
    if (key === "f" || key === "t" || key === "F" || key === "T") {
      return { ...state, pendingFind: key, echo: key };
    }
    if ((key === ";" || key === ",") && state.lastFind) {
      const kind = key === ";" ? state.lastFind.kind : reverseFind(state.lastFind.kind);
      return applyFind(state, kind, state.lastFind.char, countOf(state));
    }
    if (key === "i" || key === "a") {
      return { ...state, pendingTextObject: key, echo: key };
    }
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

function handleKeyInner(state: VimState, key: string): VimState {
  const finish = (s: VimState) => ensureVisible(commit(s));
  if (state.mode === "cmdline") return finish(handleCmdline(state, key));

  if (state.pendingFind) {
    const kind = state.pendingFind;
    return finish(applyFind({ ...state, pendingFind: null }, kind, key, countOf(state)));
  }
  if (state.pendingTextObject) {
    const prefix = state.pendingTextObject;
    return finish(applyTextObject({ ...state, pendingTextObject: null }, prefix, key));
  }

  if (state.mode === "normal") {
    const pending = handlePending(state, key);
    if (pending) return finish(pending);

    if (key === "ctrl+w") return finish({ ...state, pendingCtrlW: true, echo: "^W" });
    if (key === '"') return finish({ ...state, pendingRegister: true, echo: '"' });
    if (key === "m") return finish({ ...state, pendingMarkSet: true, echo: "m" });
    if (key === "'") return finish({ ...state, pendingMarkJump: true, markJumpExact: false, echo: "'" });
    if (key === "`") return finish({ ...state, pendingMarkJump: true, markJumpExact: true, echo: "`" });
    if (!state.recording && key === "q") {
      return finish({ ...state, pendingRecord: true, echo: "q" });
    }
    if (key === "@") return finish({ ...state, pendingPlay: true, echo: "@" });
    if (key === "/") return finish({ ...state, mode: "cmdline", cmdline: "/", echo: "" });
    if (key === "?") return finish({ ...state, mode: "cmdline", cmdline: "?", echo: "" });
    if (key === ":") return finish({ ...state, mode: "cmdline", cmdline: ":", echo: "" });
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

  return finish(next);
}

// ---------------------------------------------------------------------------
// macros, repeat (.), and the public wrapper
// ---------------------------------------------------------------------------

function reverseFind(kind: FindKind): FindKind {
  switch (kind) {
    case "f":
      return "F";
    case "F":
      return "f";
    case "t":
      return "T";
    case "T":
      return "t";
  }
}

/** True when no multi-key command is half-finished in normal mode. */
function isIdle(state: VimState): boolean {
  return (
    state.mode === "normal" &&
    !state.pendingOp &&
    !state.pendingG &&
    !state.pendingZ &&
    !state.pendingCase &&
    !state.pendingReplace &&
    !state.pendingCtrlW &&
    !state.pendingRegister &&
    !state.pendingMarkSet &&
    !state.pendingMarkJump &&
    !state.pendingFind &&
    !state.pendingTextObject &&
    !state.pendingRecord &&
    !state.pendingPlay &&
    state.count === ""
  );
}

function playMacro(state: VimState, name: string): VimState {
  const seq = state.macros[name] ?? [];
  let next: VimState = {
    ...state,
    pendingPlay: false,
    lastMacro: name,
    replaying: true,
    echo: `@${name}`,
  };
  for (const key of seq) next = handleKey(next, key);
  return { ...next, replaying: false };
}

function replayKeys(state: VimState, keys: string[]): VimState {
  let next: VimState = { ...state, replaying: true };
  for (const key of keys) next = handleKey(next, key);
  return { ...next, replaying: false };
}

/** Track the keys of each normal-mode command so `.` can replay the last edit. */
function trackChange(prev: VimState, next: VimState, key: string): VimState {
  if (prev.replaying) return next;
  const cmdKeys = prev.cmdKeys === null ? [key] : [...prev.cmdKeys, key];
  const cmdEdited = prev.cmdEdited || next.edits > prev.edits;
  if (!isIdle(next)) return { ...next, cmdKeys, cmdEdited };
  const lastChange = cmdEdited ? cmdKeys : next.lastChange;
  return { ...next, cmdKeys: null, cmdEdited: false, lastChange };
}

export function handleKey(state: VimState, key: string): VimState {
  // capture keys for macro recording; the q that stops recording is skipped
  let base = state;
  if (state.recording && !state.replaying) {
    const stops = state.mode === "normal" && key === "q" && isIdle(state);
    if (!stops) base = { ...state, recordingKeys: [...state.recordingKeys, key] };
  }

  // `.` replays the last change
  if (base.mode === "normal" && key === "." && isIdle(base) && base.lastChange && !base.replaying) {
    const replayed = replayKeys(base, base.lastChange);
    return { ...replayed, cmdKeys: null, cmdEdited: false, lastChange: base.lastChange };
  }

  return trackChange(base, handleKeyInner(base, key), key);
}

export { offsetOf, posOf };
