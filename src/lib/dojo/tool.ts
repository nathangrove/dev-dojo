import type { ComponentType } from "react";
import type { BaseDrill } from "./types";

/**
 * What a tool's visual stage receives. `state` is the tool's own state object
 * (typed as unknown here so a single registry can hold heterogeneous tools);
 * each tool's Stage component narrows it back to its own state type.
 */
export interface StageProps {
  state: unknown;
  drill: BaseDrill;
}

/**
 * A tool adapter is the bridge between the generic practice runner and a
 * specific simulator. Keystroke tools (vim, tmux) implement all of these.
 */
export interface Tool {
  slug: string;
  /** short human label, e.g. "Vim" */
  label: string;
  /** build the initial simulator state for a drill */
  createInitial(drill: BaseDrill): unknown;
  /** map a browser keyboard event to a token, or null to ignore it */
  keyFromEvent(e: KeyboardEvent): string | null;
  /** advance the simulator by one input token */
  reduce(state: unknown, key: string): unknown;
  /** has the drill's goal been reached (given the keys/inputs used so far)? */
  isSolved(state: unknown, drill: BaseDrill, used: Set<string>): boolean;
  /** the interactive visualization for this tool */
  Stage: ComponentType<StageProps>;
}
