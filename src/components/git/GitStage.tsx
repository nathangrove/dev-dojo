"use client";

import type { GitDrill, GitState } from "@/lib/tools/git/types";
import { describeGitGoal } from "@/lib/tools/git/engine";
import GitView from "./GitView";

interface GitStageProps {
  state: GitState;
  drill: GitDrill;
}

export default function GitStage({ state, drill }: GitStageProps) {
  return (
    <div className="flex flex-col gap-3">
      <GitView state={state} />
      <div className="flex items-center gap-2 rounded-lg border border-orange/40 bg-orange/10 px-4 py-2.5 text-xs text-orange">
        <span className="font-medium uppercase tracking-wide">Goal</span>
        <span>{describeGitGoal(drill.goal)}</span>
      </div>
    </div>
  );
}
