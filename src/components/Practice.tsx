"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BaseDrill } from "@/lib/dojo/types";
import type { Tool } from "@/lib/dojo/tool";
import { solutionLength } from "@/lib/dojo/tokens";
import type { AttemptResult } from "@/lib/progress";

function accuracyFor(optimal: number, used: number): number {
  return Math.max(1, Math.min(100, Math.round((optimal / Math.max(1, used)) * 100)));
}

interface PracticeProps {
  tool: Tool;
  drill: BaseDrill;
  drillNumber: number;
  drillTotal: number;
  onSolved?: (result: AttemptResult) => void;
  onNext?: () => void;
  isLast?: boolean;
}

export default function Practice({
  tool,
  drill,
  drillNumber,
  drillTotal,
  onSolved,
  onNext,
  isLast,
}: PracticeProps) {
  const [state, setState] = useState<unknown>(() => tool.createInitial(drill));
  const [keys, setKeys] = useState(0);
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const engineRef = useRef<unknown>(tool.createInitial(drill));
  const usedRef = useRef<Set<string>>(new Set());
  const keysRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const solvedRef = useRef(false);
  const hintRef = useRef(false);

  const optimal = solutionLength(drill.solution);
  const liveAccuracy = accuracyFor(optimal, keys);
  const Stage = tool.Stage;

  const reset = useCallback(() => {
    engineRef.current = tool.createInitial(drill);
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
  }, [tool, drill]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (solvedRef.current) {
        if (e.key === "Enter" && !e.repeat && onNext) {
          e.preventDefault();
          onNext();
        }
        return;
      }
      const key = tool.keyFromEvent(e);
      if (key === null) return;
      e.preventDefault();

      if (startRef.current === null) startRef.current = performance.now();
      keysRef.current += 1;
      usedRef.current.add(key);
      const next = tool.reduce(engineRef.current, key);
      engineRef.current = next;
      setState(next);
      setKeys(keysRef.current);

      if (tool.isSolved(next, drill, usedRef.current)) {
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
  }, [tool, drill, optimal, onSolved, onNext]);

  // Global capture-phase handler to prevent browser defaults for Ctrl+<letter>
  // (e.g. Ctrl+O opens File dialog, Ctrl+S saves, etc.)
  useEffect(() => {
    function preventBrowserShortcuts(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.length === 1 && /[a-z]/i.test(e.key)) {
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", preventBrowserShortcuts, true); // capture phase
    return () => document.removeEventListener("keydown", preventBrowserShortcuts, true);
  }, []);

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

      <Stage state={state} drill={drill} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel-2 px-4 py-3">
        <div className="text-xs text-muted">
          {solved ? (
            <span className="text-green">
              Solved in {result?.ms}ms with {result?.accuracy}% accuracy.{" "}
              {onNext && (
                <span className="text-muted">
                  Press <kbd className="rounded bg-panel px-1 text-foreground">Enter</kbd> to{" "}
                  {isLast ? "finish" : "continue"}.
                </span>
              )}
            </span>
          ) : (
            <span>Start typing — your keystrokes drive the live simulator.</span>
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
