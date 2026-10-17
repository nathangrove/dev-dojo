"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { handleKey, isGoal } from "@/lib/engine/vim";
import { createSeeded } from "@/lib/engine/session";
import { evaluateGoal, describeGoal } from "@/lib/engine/goals";
import type { VimState } from "@/lib/engine/types";
import type { Drill } from "@/lib/curriculum";
import { solutionLength } from "@/lib/curriculum";
import type { AttemptResult } from "@/lib/progress";
import VimBuffer from "./VimBuffer";
import SessionView from "./SessionView";

function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.metaKey) return null;
  if (e.key === "Escape") return "Escape";
  if (e.key === "Enter") return "Enter";
  if (e.key === "Backspace") return "Backspace";
  if (e.key === "Tab") return "Tab";
  if (e.ctrlKey && (e.key === "r" || e.key === "R")) return "ctrl+r";
  if (e.ctrlKey && (e.key === "w" || e.key === "W")) return "ctrl+w";
  if (e.ctrlKey || e.altKey || e.shiftKey) return null;
  if (e.key.length === 1) return e.key;
  return null;
}

function init(drill: Drill): VimState {
  return createSeeded(drill.initial, drill.files, drill.start, drill.startModified);
}

function isSolved(state: VimState, drill: Drill, used: Set<string>): boolean {
  if (drill.mustUse && !drill.mustUse.every((k) => used.has(k))) return false;
  if (drill.goal) return evaluateGoal(state, drill.goal);
  if (state.mode !== "normal") return false;
  if (drill.targetCursor) {
    return state.row === drill.targetCursor.row && state.col === drill.targetCursor.col;
  }
  return isGoal(state, drill.target ?? "");
}

function accuracyFor(optimal: number, used: number): number {
  return Math.max(1, Math.min(100, Math.round((optimal / Math.max(1, used)) * 100)));
}

interface PracticeProps {
  drill: Drill;
  drillNumber: number;
  drillTotal: number;
  onSolved?: (result: AttemptResult) => void;
  onNext?: () => void;
  isLast?: boolean;
}

export default function Practice({
  drill,
  drillNumber,
  drillTotal,
  onSolved,
  onNext,
  isLast,
}: PracticeProps) {
  const [state, setState] = useState<VimState>(() => init(drill));
  const [keys, setKeys] = useState(0);
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const engineRef = useRef<VimState>(init(drill));
  const usedRef = useRef<Set<string>>(new Set());
  const keysRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const solvedRef = useRef(false);
  const hintRef = useRef(false);

  const optimal = solutionLength(drill.solution);
  const liveAccuracy = accuracyFor(optimal, keys);

  const reset = useCallback(() => {
    engineRef.current = init(drill);
    usedRef.current = new Set();
    keysRef.current = 0;
    startRef.current = null;
    solvedRef.current = false;
    hintRef.current = false;
    setState(engineRef.current);
    setKeys(0);
    setSolved(false);
    setHintShown(false);
    setResult(null);
  }, [drill]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (solvedRef.current) return;
      const key = keyFromEvent(e);
      if (key === null) return;
      e.preventDefault();

      if (startRef.current === null) startRef.current = performance.now();
      keysRef.current += 1;
      usedRef.current.add(key);
      const next = handleKey(engineRef.current, key);
      engineRef.current = next;
      setState(next);
      setKeys(keysRef.current);

      if (isSolved(next, drill, usedRef.current)) {
        solvedRef.current = true;
        const ms = Math.round(performance.now() - (startRef.current ?? performance.now()));
        const res: AttemptResult = {
          accuracy: accuracyFor(optimal, keysRef.current),
          ms,
          hintUsed: hintRef.current,
        };
        setResult(res);
        setSolved(true);
        onSolved?.(res);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drill, optimal, onSolved]);

  const targetLines = drill.targetCursor
    ? drill.initial.split("\n")
    : (drill.target ?? "").split("\n");
  const targetAnchor = drill.targetCursor ? drill.targetCursor : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-foreground">
          <span className="text-muted">Drill </span>
          <span className="font-mono">{drillNumber}</span>
          <span className="text-muted"> / {drillTotal}</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span>
            keys <span className="text-foreground">{keys}</span>
            <span className="text-muted">/{optimal}</span>
          </span>
          <span>
            accuracy <span className="text-foreground">{liveAccuracy}%</span>
          </span>
        </div>
      </div>

      <p className="text-sm text-foreground/90">{drill.prompt}</p>

      {drill.goal ? (
        <div className="flex flex-col gap-3">
          <SessionView state={state} />
          <div className="flex items-center gap-2 rounded-lg border border-orange/40 bg-orange/10 px-4 py-2.5 text-xs text-orange">
            <span className="font-medium uppercase tracking-wide">Goal</span>
            <span>{describeGoal(drill.goal)}</span>
          </div>
        </div>
      ) : (
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
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel-2 px-4 py-3">
        <div className="text-xs text-muted">
          {solved ? (
            <span className="text-green">
              Solved in {result?.ms}ms with {result?.accuracy}% accuracy.
            </span>
          ) : (
            <>
              Start typing — keys are captured by the buffer.{" "}
              {drill.mustUse?.includes("ctrl+r") ? (
                <span className="text-muted/80">(Ctrl-r = redo)</span>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!solved && (
            <button
              type="button"
              onClick={() => {
                hintRef.current = true;
                setHintShown(true);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              {hintShown ? "Hint shown" : "Hint"}
            </button>
          )}
          {!solved && (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              Reset
            </button>
          )}
          {solved && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              {isLast ? "Finish lesson" : "Next drill"}
            </button>
          )}
        </div>
      </div>

      {hintShown && !solved && (
        <div className="rounded-lg border border-orange/40 bg-orange/10 px-4 py-3 text-xs text-orange">
          <span className="font-medium">Solution: </span>
          <code className="font-mono">{drill.solution}</code>
          <span className="ml-2 text-orange/70">
            (using the hint blocks mastery — try again on your own)
          </span>
        </div>
      )}

      {solved && (
        <div className="rounded-lg border border-green/40 bg-green/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-green">
            <span>
              <span className="font-medium">Nice.</span>{" "}
              {result?.hintUsed
                ? "Hint used — repeat it without the hint to master it."
                : "Clean run."}
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>{result?.ms}ms</span>
              <span>{result?.accuracy}% acc</span>
              <span>{keys} keys</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
