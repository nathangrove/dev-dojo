"use client";

import type { BaseDrill } from "@/lib/dojo/types";
import type { StageProps, Tool } from "@/lib/dojo/tool";
import { createInitialGit, evaluateGitGoal, handleGitKey } from "./engine";
import type { GitDrill, GitState } from "./types";
import GitStage from "@/components/git/GitStage";

function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.metaKey) return null;
  if (e.key === "Escape") return "Escape";
  if (e.key === "Enter") return "Enter";
  if (e.key === "Backspace") return "Backspace";
  if (e.key === "ArrowUp") return "ArrowUp";
  if (e.key === "ArrowDown") return "ArrowDown";
  if (e.key === "Tab") return "Tab";
  if (e.ctrlKey || e.altKey) return null;
  if (e.key.length === 1) return e.key;
  return null;
}

function GitStageAdapter({ state, drill }: StageProps) {
  return <GitStage state={state as GitState} drill={drill as GitDrill} />;
}

export const gitTool: Tool = {
  slug: "git",
  label: "Git",
  createInitial: (d: BaseDrill) => createInitialGit(d as GitDrill),
  keyFromEvent,
  reduce: (state, key) => handleGitKey(state as GitState, key),
  isSolved: (state, drill, used) => {
    const d = drill as GitDrill;
    if (d.mustUse && !d.mustUse.every((k) => used.has(k))) return false;
    return evaluateGitGoal(state as GitState, d.goal);
  },
  Stage: GitStageAdapter,
};
