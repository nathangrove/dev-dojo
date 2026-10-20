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
  /**
   * per-pane size overrides in cells, from resize-pane -x / -y. Any pane
   * missing here takes its half-split size computed from the layout tree.
   */
  resized: Record<number, { width: number; height: number }>;
}

export interface TmuxSession {
  id: number;
  /** session name for `rename-session` / attach goals (default "0") */
  name: string;
  windows: TmuxWindow[];
  activeWindowId: number;
}

export interface TmuxState {
  /** false after `C-b d` — later attached with a new-session command */
  attached: boolean;
  session: TmuxSession;
  /** sessions we can re-attach to (name + id), for s / attach-session drills */
  detached: { id: number; name: string }[];
  /** true immediately after the prefix key (Ctrl-b) */
  prefix: boolean;
  /** command prompt text after `:` (including the colon); null when closed */
  cmdline: string | null;
  statusMessage: string;
  echo: string;
  /** after `x` — waiting for a y/n confirmation */
  pendingKill: boolean;
  /** after `[` — viewport-style copy mode (C-b q leaves) */
  copyMode: boolean;
  /** after `C-b w` — choose-tree overlay; number keys pick a window */
  choosingTree: boolean;
  /** after `C-b q` — briefly show pane numbers; any key dismisses */
  showPaneNumbers: boolean;
  /** rename prompt target after `,` (window) or `$` (session) */
  renaming: "window" | "session" | null;
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
  /** direction of the split that holds the active pane */
  | { kind: "splitDir"; dir: "row" | "col" }
  | { kind: "zoomed" }
  /** size of the active pane in cells */
  | { kind: "paneWidth"; cells: number }
  | { kind: "paneHeight"; cells: number }
  | { kind: "sessionName"; name: string }
  | { kind: "windowName"; name: string }
  | { kind: "detached" }
  | { kind: "copyMode" };

export interface TmuxDrill extends BaseDrill {
  /** how many panes to open the single window with (default 1) */
  initialPanes?: number;
  /** 0-based ring index of the initially active pane (default: the newest) */
  activePane?: number;
  /** how many windows to open initially (default 1) */
  initialWindows?: number;
  /** 0-based index of the initially active window (default 0) */
  activeWindow?: number;
  /** session name for the seeded session (default "0") */
  sessionName?: string;
  /** name the first window starts with (default "bash") */
  windowName?: string;
  goal: TmuxGoal;
}
