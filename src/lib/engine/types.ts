export type Mode = "normal" | "insert" | "visual" | "visual-line" | "cmdline";

export interface Pos {
  row: number;
  col: number;
}

export interface Register {
  lines: string[];
  linewise: boolean;
}

export interface Snapshot {
  lines: string[];
  row: number;
  col: number;
}

/** An in-memory file. Buffers are shared across windows and tabs. */
export interface Buffer {
  id: number;
  name: string;
  lines: string[];
  modified: boolean;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
}

/** A viewport onto a buffer with its own cursor. Lives in exactly one tab. */
export interface Window {
  id: number;
  bufferId: number;
  row: number;
  col: number;
  desiredCol: number;
}

/**
 * A split tree, mirroring Vim's `winlayout()`:
 * - `row`  — children laid out left-to-right (produced by `:vsplit`, `<C-w>v`)
 * - `col`  — children laid out top-to-bottom (produced by `:split`, `<C-w>s`)
 */
export type SplitNode =
  | { kind: "leaf"; windowId: number }
  | { kind: "split"; dir: "row" | "col"; children: SplitNode[] };

export interface Tab {
  id: number;
  layout: SplitNode;
  activeWindowId: number;
}

export interface Mark {
  bufferId: number;
  row: number;
  col: number;
}

export interface VimState {
  // ---- active window's editing view (mirror of its buffer + cursor) ----
  lines: string[];
  row: number;
  col: number;
  desiredCol: number;
  mode: Mode;
  register: Register | null;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  pendingOp: "d" | "c" | "y" | null;
  count: string;
  pendingG: boolean;
  pendingReplace: boolean;
  visualAnchor: Pos | null;
  echo: string;
  /** number of buffer-mutating commands performed, used for stats */
  edits: number;

  // ---- session ----
  buffers: Buffer[];
  windows: Window[];
  tabs: Tab[];
  activeTab: number;
  nextBufferId: number;
  nextWindowId: number;
  nextTabId: number;

  /** named registers plus the unnamed one under the `"` key */
  registers: Record<string, Register>;

  /** marks: single lowercase letter -> position */
  marks: Record<string, Mark>;

  /** command line: the text typed after `:` (including the colon); null when closed */
  cmdline: string | null;
  /** last message shown on the command line */
  statusMessage: string;

  // ---- pending multi-key prefixes ----
  pendingCtrlW: boolean;
  /** after `"` — the next yank/delete/put uses this register */
  pendingRegister: boolean;
  /** the register name chosen by `"`, consumed by the next yank/delete/put */
  activeRegister: string | null;
  /** after `m` — the next letter sets a mark */
  pendingMarkSet: boolean;
  /** after `'` or a backtick — the next letter jumps to a mark */
  pendingMarkJump: boolean;
  /** true when the jump was `` ` `` (exact column) vs `'` (first non-blank) */
  markJumpExact: boolean;
}
