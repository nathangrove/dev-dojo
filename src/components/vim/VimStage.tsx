"use client";

import type { VimState } from "@/lib/tools/vim/engine/types";
import type { VimDrill } from "@/lib/tools/vim/types";
import { describeGoal } from "@/lib/tools/vim/engine/goals";
import VimBuffer from "./VimBuffer";
import SessionView from "./SessionView";

interface VimStageProps {
  state: VimState;
  drill: VimDrill;
}

export default function VimStage({ state, drill }: VimStageProps) {
  if (drill.goal) {
    return (
      <div className="flex flex-col gap-3">
        <SessionView state={state} />
        <div className="flex items-center gap-2 rounded-lg border border-orange/40 bg-orange/10 px-4 py-2.5 text-xs text-orange">
          <span className="font-medium uppercase tracking-wide">Goal</span>
          <span>{describeGoal(drill.goal)}</span>
        </div>
      </div>
    );
  }

  const targetLines = drill.targetCursor
    ? drill.initial.split("\n")
    : (drill.target ?? "").split("\n");
  const targetAnchor = drill.targetCursor ? drill.targetCursor : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          Your buffer
        </div>
        <VimBuffer
          lines={state.lines}
          row={state.row}
          col={state.col}
          mode={state.mode}
          visualAnchor={state.visualAnchor}
          showCursor
          filename="practice.txt"
          echo={state.mode === "normal" ? state.echo : ""}
          tone="live"
        />
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          {drill.targetCursor ? "Target cell" : "Goal"}
        </div>
        <VimBuffer
          lines={targetLines}
          row={-1}
          col={-1}
          mode="normal"
          targetCursor={targetAnchor}
          showCursor={false}
          filename={drill.targetCursor ? "target.txt" : "goal.txt"}
          tone="target"
        />
      </div>
    </div>
  );
}
