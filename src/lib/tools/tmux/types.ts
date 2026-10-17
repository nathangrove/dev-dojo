import type { BaseDrill } from "@/lib/dojo/types";

/**
 * A tmux window's pane layout. Splits are always binary and halve the parent's
 * space (verified against tmux 3.4: splitting a pane nests rather than
 * rebalancing).
 * - `row` — panes side by side, produced by `%` / `split-window -h` (new pane right)
 * - `col` — panes stacked, produced by `"` / `split-window` (new pane below)
 */
export type TmuxSplit =
  | { kind: "leaf"; paneId: number }
  | { kind: "split"; dir: "row" | "col"; children: TmuxSplit[] };

export interface TmuxPane {
  id: number;
  /** e.g. "bash" */
  title: string;
}

export interface TmuxWindow {
  id: number;
  /** e.g. "bash" */
  name: string;
  layout: TmuxSplit;
  panes: TmuxPane[];
  activePaneId: number;
  zoomed: boolean;
}

export interface TmuxSession {
  id: number;
  windows: TmuxWindow[];
  activeWindowId: number;
}

export interface TmuxState {
  session: TmuxSession;
  /** true immediately after the prefix key (Ctrl-b) */
  prefix: boolean;
  /** command prompt text after `:` (including the colon); null when closed */
  cmdline: string | null;
  statusMessage: string;
  echo: string;
  /** after `x` — waiting for a y/n confirmation */
  pendingKill: boolean;
  /** pane to toggle back to with `;` */
  lastPaneId: number | null;
  nextPaneId: number;
  nextWindowId: number;
  nextSessionId: number;
}

export type TmuxGoal =
  | { kind: "paneCount"; count: number }
  | { kind: "windowCount"; count: number }
  /** 0-based index in the spatial ring (left→right, top→bottom) */
  | { kind: "activePane"; index: number }
  /** 0-based window index in the session */
  | { kind: "activeWindow"; index: number }
  | { kind: "zoomed" };

export interface TmuxDrill extends BaseDrill {
  /** how many panes to open the single window with (default 1) */
  initialPanes?: number;
  /** 0-based ring index of the initially active pane (default: the newest) */
  activePane?: number;
  /** how many windows to open initially (default 1) */
  initialWindows?: number;
  goal: TmuxGoal;
}
