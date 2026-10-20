"use client";

import type { BaseDrill } from "@/lib/dojo/types";
import type { StageProps, Tool } from "@/lib/dojo/tool";
import { createSeeded } from "./engine/session";
import { handleKey, isGoal } from "./engine/vim";
import { evaluateGoal } from "./engine/goals";
import type { VimState } from "./engine/types";
import type { VimDrill } from "./types";
import VimStage from "@/components/vim/VimStage";

function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.metaKey) return null;
  if (e.key === "Escape") return "Escape";
  if (e.key === "Enter") return "Enter";
  if (e.key === "Backspace") return "Backspace";
  if (e.ctrlKey && e.key === "Tab") return "ctrl+i"; // browsers report Ctrl+I as Tab
  if (e.key === "Tab") return "Tab";
  if (e.ctrlKey && e.key.length === 1 && /[a-z]/i.test(e.key)) return `ctrl+${e.key.toLowerCase()}`;
  if (e.ctrlKey || e.altKey) return null;
  if (e.key.length === 1) return e.key;
  return null;
}

function vimSolve(state: VimState, drill: VimDrill, used: Set<string>): boolean {
  if (drill.mustUse && !drill.mustUse.every((k) => used.has(k))) return false;
  if (drill.goal) return evaluateGoal(state, drill.goal);
  if (state.mode !== "normal") return false;
  if (drill.targetCursor) {
    return state.row === drill.targetCursor.row && state.col === drill.targetCursor.col;
  }
  return isGoal(state, drill.target ?? "");
}

function VimStageAdapter({ state, drill }: StageProps) {
  return <VimStage state={state as VimState} drill={drill as VimDrill} />;
}

export const vimTool: Tool = {
  slug: "vim",
  label: "Vim",
  createInitial: (d: BaseDrill) => {
    const drill = d as VimDrill;
    return createSeeded(drill.initial, drill.files, drill.start, drill.startModified);
  },
  keyFromEvent,
  reduce: (state, key) => handleKey(state as VimState, key),
  isSolved: (state, drill, used) => vimSolve(state as VimState, drill as VimDrill, used),
  Stage: VimStageAdapter,
};
