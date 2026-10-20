export type Mode = "normal" | "insert" | "visual" | "visual-line" | "cmdline";

/** Character-search motions: f/t forward, F/T backward. */
export type FindKind = "f" | "t" | "F" | "T";

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
  /** the text last written to (or loaded from) disk; `:e!` restores it */
  original: string[];
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
  pendingOp: "d" | "c" | "y" | ">" | "<" | null;
  count: string;
  pendingG: boolean;
  /** after `z` — next key picks the scroll command (zz / zt / zb) */
  pendingZ: boolean;
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
  /** after f/t/F/T — the next printable key picks the target character */
  pendingFind: FindKind | null;
  /** last f/t/F/T command, replayed by `;` and reversed by `,` */
  lastFind: { kind: FindKind; char: string } | null;
  /** after i/a with an operator or selection pending — next key picks the object */
  pendingTextObject: "i" | "a" | null;
  /** last search pattern and whether it was forward (`/`) or backward (`?`) */
  searchPattern: string;
  searchForward: boolean;
  /** after gU / gu / g~ — next key picks the case operator target */
  pendingCase: "upper" | "lower" | "toggle" | null;
  /** jump list for Ctrl-o / Ctrl-i */
  jumplist: Pos[];
  jumpIndex: number;
  /** top row of the simulated screen (viewport) */
  topRow: number;
  /** after q — the next key picks the register to record a macro into */
  pendingRecord: boolean;
  /** register currently being recorded (null when not recording) */
  recording: string | null;
  /** keys captured for the macro in progress */
  recordingKeys: string[];
  /** recorded macros, keyed by register name */
  macros: Record<string, string[]>;
  /** after @ — the next key picks the macro to play */
  pendingPlay: boolean;
  /** last played macro, replayed by @@ */
  lastMacro: string | null;
  /** keys of the last change, replayed by `.` */
  lastChange: string[] | null;
  /** keys of the normal-mode command currently being assembled */
  cmdKeys: string[] | null;
  /** whether the command in progress has mutated the buffer */
  cmdEdited: boolean;
  /** true while replaying keys from `.` or a macro, to avoid re-recording */
  replaying: boolean;
}
