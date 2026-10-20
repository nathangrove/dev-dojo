import type { BaseDrill } from "@/lib/dojo/types";

/** A file to seed into the session when the drill starts. */
export interface SeedFile {
  name: string;
  text: string;
}

/**
 * A goal about the *session* (windows, buffers, tabs, registers) rather than
 * the buffer text. Used by window / file / tab / register drills.
 */
export type VimGoal =
  | { kind: "windowCount"; count: number }
  | { kind: "activeFile"; name: string }
  | { kind: "openFiles"; names: string[] }
  | { kind: "savedFiles"; names: string[] }
  | { kind: "modifiedCount"; count: number }
  | { kind: "tabCount"; count: number }
  | { kind: "activeTab"; index: number }
  | { kind: "register"; name: string; text: string }
  | { kind: "cursorInFile"; name: string; row: number; col: number }
  | { kind: "topRow"; row: number };

export interface VimDrill extends BaseDrill {
  initial: string;
  /** seed extra buffers so the drill can talk about files/tabs */
  files?: SeedFile[];
  /** where the cursor begins (defaults to the top-left) */
  start?: { row: number; col: number };
  /** start the primary buffer in a modified (unsaved) state */
  startModified?: boolean;
  /** text-goal: buffer must match this */
  target?: string;
  /** cursor-goal: cursor must reach this cell (text is unchanged) */
  targetCursor?: { row: number; col: number };
  /** session-goal: the session must reach this state */
  goal?: VimGoal;
}

/** Backwards-compatible aliases. */
export type Drill = VimDrill;
export type SessionGoal = VimGoal;
