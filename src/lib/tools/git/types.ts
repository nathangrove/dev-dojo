import type { BaseDrill } from "@/lib/dojo/types";

/** A file seeded into the simulated working tree when a drill starts. */
export interface SeedFile {
  name: string;
  text: string;
  /** true when the file is already staged in the index */
  staged?: boolean;
  /** true when the file is brand new and not yet tracked by git */
  untracked?: boolean;
}

export interface Commit {
  id: string;
  message: string;
  /** whether the commit was made on the default branch (for the graph view) */
  files: string[];
  /** parent commit id, or null for the root */
  parent: string | null;
}

export interface Branch {
  name: string;
  /** commit the branch points at */
  target: string | null;
}

export interface GitState {
  /** commit history, newest first */
  commits: Commit[];
  branches: Branch[];
  /** current branch name */
  head: string;
  /** paths currently staged in the index, newest first */
  index: string[];
  /** working-tree files by name */
  worktree: Record<string, string>;
  /** files that differ from HEAD (staged or unstaged) */
  modified: string[];
  /** files that exist in the worktree but not in the repo/index (untracked) */
  untracked: string[];
  /** remote repositories by name -> url */
  remotes: Record<string, string>;
  /** tag names pointing at a commit id */
  tags: Record<string, string>;
  /** stashed snapshots, newest first */
  stash: { message: string; files: Record<string, string> }[];
  /** the command line currently being typed */
  echo: string;
  /** the most recently executed command (for display) */
  lastCommand: string;
  /** message shown in the status area (output of the command) */
  output: string;
  /** true when the last command failed */
  error: boolean;
}

export type GitGoal =
  | { kind: "initialized" }
  | { kind: "staged"; names: string[] }
  | { kind: "committed"; count: number; message?: string }
  | { kind: "branch"; name: string }
  | { kind: "head"; name: string }
  | { kind: "uncommitted"; count: number }
  | { kind: "clean" }
  | { kind: "remote"; name: string }
  | { kind: "tag"; name: string }
  | { kind: "stashed" }
  | { kind: "ranCommand"; command: string };

export interface GitDrill extends BaseDrill {
  /** seed these files into the working tree (default: none) */
  files?: SeedFile[];
  /** start with a repo already initialized (default true) */
  startRepo?: boolean;
  /** number of commits to seed at the start (default 0) */
  commits?: number;
  /** seed this branch as HEAD */
  branch?: string;
  /** seed extra branches */
  branches?: string[];
  goal: GitGoal;
}

/** Backwards-compatible alias. */
export type Drill = GitDrill;
