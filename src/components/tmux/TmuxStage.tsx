"use client";

import type { TmuxDrill, TmuxState } from "@/lib/tools/tmux/types";
import { describeTmuxGoal } from "@/lib/tools/tmux/engine";
import TmuxView from "./TmuxView";

interface TmuxStageProps {
  state: TmuxState;
  drill: TmuxDrill;
}

export default function TmuxStage({ state, drill }: TmuxStageProps) {
  return (
    <div className="flex flex-col gap-3">
      <TmuxView state={state} />
      <div className="flex items-center gap-2 rounded-lg border border-green/40 bg-green/10 px-4 py-2.5 text-xs text-green">
        <span className="font-medium uppercase tracking-wide">Goal</span>
        <span>{describeTmuxGoal(drill.goal, state)}</span>
      </div>
    </div>
  );
}
