export interface KeyRef {
  keys: string;
  meaning: string;
}

/** A file to seed into the session when the drill starts. */
export interface SeedFile {
  name: string;
  text: string;
}

/**
 * A goal about the *session* (windows, buffers, tabs, registers) rather than
 * the buffer text. Used by window / file / tab / register drills.
 */
export type SessionGoal =
  | { kind: "windowCount"; count: number }
  | { kind: "activeFile"; name: string }
  | { kind: "openFiles"; names: string[] }
  | { kind: "savedFiles"; names: string[] }
  | { kind: "modifiedCount"; count: number }
  | { kind: "tabCount"; count: number }
  | { kind: "activeTab"; index: number }
  | { kind: "register"; name: string; text: string }
  | { kind: "cursorInFile"; name: string; row: number; col: number };

export interface Drill {
  id: string;
  prompt: string;
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
  goal?: SessionGoal;
  /** canonical solution, shown as a hint and used to score accuracy */
  solution: string;
  /** keys that must appear in the user's input for the drill to count as solved */
  mustUse?: string[];
}

export interface Lesson {
  slug: string;
  title: string;
  tagline: string;
  concept: string;
  keys: KeyRef[];
  drills: Drill[];
}

export interface Category {
  slug: string;
  title: string;
  blurb: string;
  accent: string;
  lessons: Lesson[];
}
