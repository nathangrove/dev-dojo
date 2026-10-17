"use client";

import type { BaseDrill } from "@/lib/dojo/types";
import type { StageProps, Tool } from "@/lib/dojo/tool";
import { createInitialTmux, evaluateTmuxGoal, handleTmuxKey } from "./engine";
import type { TmuxDrill, TmuxState } from "./types";
import TmuxStage from "@/components/tmux/TmuxStage";

function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.metaKey) return null;
  if (e.ctrlKey && (e.key === "b" || e.key === "B")) return "ctrl+b";
  if (e.key === "Escape") return "Escape";
  if (e.key === "Enter") return "Enter";
  if (e.key === "Backspace") return "Backspace";
  if (e.key === "Tab") return "Tab";
  if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")
    return e.key;
  if (e.ctrlKey || e.altKey) return null;
  if (e.key.length === 1) return e.key;
  return null;
}

function TmuxStageAdapter({ state, drill }: StageProps) {
  return <TmuxStage state={state as TmuxState} drill={drill as TmuxDrill} />;
}

export const tmuxTool: Tool = {
  slug: "tmux",
  label: "tmux",
  createInitial: (d: BaseDrill) => createInitialTmux(d as TmuxDrill),
  keyFromEvent,
  reduce: (state, key) => handleTmuxKey(state as TmuxState, key),
  isSolved: (state, drill, used) => {
    const d = drill as TmuxDrill;
    if (d.mustUse && !d.mustUse.every((k) => used.has(k))) return false;
    return evaluateTmuxGoal(state as TmuxState, d.goal);
  },
  Stage: TmuxStageAdapter,
};
