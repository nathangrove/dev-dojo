"use client";

import type { TmuxSplit, TmuxState, TmuxWindow } from "@/lib/tools/tmux/types";
import {
  activeWindow,
  activeWindowIndex,
  paneSize,
} from "@/lib/tools/tmux/engine";

/** flex-grow proportional to a pane's cell size, so resized panes look right. */
function flexFor(win: TmuxWindow, paneId: number): number {
  return Math.max(1, paneSize(win, paneId).width);
}

function Pane({
  paneId,
  win,
  showNumber,
}: {
  paneId: number;
  win: TmuxWindow;
  showNumber?: boolean;
}) {
  const pane = win.panes.find((p) => p.id === paneId);
  if (!pane) return null;
  const active = pane.id === win.activePaneId;
  return (
    <div
      className="min-h-0 min-w-0 p-0.5"
      style={{ flexGrow: flexFor(win, paneId), flexBasis: 0 }}
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded border ${
          active ? "border-green" : "border-border"
        } bg-panel`}
      >
        {showNumber && (
          <span className="absolute right-1 top-1 rounded bg-accent px-1 font-mono text-[10px] text-background">
            {pane.id}
          </span>
        )}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] ${
            active ? "bg-green/20 text-green" : "text-muted"
          }`}
        >
          <span>
            {pane.id}:{pane.title}
          </span>
          {active && <span className="ml-auto">*</span>}
        </div>
        <div className="min-h-0 flex-1 px-2 py-1 font-mono text-[11px] leading-relaxed text-foreground">
          <div>
            <span className="text-green">user@dev</span>
            <span className="text-muted">:</span>
            <span className="text-accent">~</span>
            <span className="text-muted">$</span>
            {active && (
              <span className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-green/60 align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderNode(
  node: TmuxSplit,
  win: TmuxWindow,
  showNumbers: boolean,
): React.ReactNode {
  if (node.kind === "leaf")
    return <Pane paneId={node.paneId} win={win} showNumber={showNumbers} />;
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 ${
        node.dir === "row" ? "flex-row" : "flex-col"
      }`}
    >
      {node.children.map((child, i) => (
        <div key={i} className="flex min-h-0 min-w-0 flex-1">
          {renderNode(child, win, showNumbers)}
        </div>
      ))}
    </div>
  );
}

/** Detached screen — mimics the shell after `tmux detach`. */
function DetachedScreen({ state }: { state: TmuxState }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 font-mono text-sm">
      <div className="text-muted">$ tmux attach</div>
      <div className="text-foreground">
        [detached from session{" "}
        <span className="text-accent">{state.session.name}</span>]
      </div>
      <div className="text-xs text-muted">
        Press <kbd className="rounded bg-panel px-1">C-b s</kbd> or run{" "}
        <span className="text-cyan">attach-session</span> to reattach.
      </div>
    </div>
  );
}

/** choose-tree overlay — pick a window by number or with arrow keys + Enter. */
function ChooseTreeOverlay({ state }: { state: TmuxState }) {
  const winIndex = activeWindowIndex(state);
  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-2 bg-panel-2/95 p-4 font-mono text-sm">
      <div className="text-muted">choose-tree</div>
      <ul className="flex flex-col gap-1">
        {state.session.windows.map((w, i) => (
          <li
            key={w.id}
            className={
              i === winIndex ? "rounded bg-accent/20 px-2 text-foreground" : "px-2 text-muted"
            }
          >
            ({state.session.id}:{i}) {w.name}
            {i === winIndex ? " * (active)" : ""}
          </li>
        ))}
      </ul>
      <div className="mt-auto text-xs text-muted">
        Press a number to jump, <kbd className="rounded bg-panel px-1">Enter</kbd> to select,{" "}
        <kbd className="rounded bg-panel px-1">Esc</kbd> to cancel.
      </div>
    </div>
  );
}

interface TmuxViewProps {
  state: TmuxState;
  height?: number;
}

export default function TmuxView({ state, height = 420 }: TmuxViewProps) {
  const win = activeWindow(state);
  const winIndex = activeWindowIndex(state);

  if (!state.attached) {
    return (
      <div
        className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-panel-2"
        style={{ height }}
      >
        <DetachedScreen state={state} />
      </div>
    );
  }

  const right = state.pendingKill
    ? "kill-pane? (y/n)"
    : state.prefix
      ? "^B-"
      : state.echo || state.statusMessage;

  return (
    <div
      className="relative flex w-full flex-col overflow-hidden rounded-lg border border-border bg-panel-2"
      style={{ height }}
    >
      <div className="flex min-h-0 flex-1 gap-0 p-1">
        {win.zoomed ? (
          <Pane paneId={win.activePaneId} win={win} />
        ) : (
          renderNode(win.layout, win, state.showPaneNumbers)
        )}
      </div>

      {state.copyMode && (
        <div className="border-t border-border bg-green/10 px-2 py-0.5 font-mono text-[11px] text-green">
          COPY MODE — <kbd className="rounded bg-panel px-1">C-b q</kbd> to exit
        </div>
      )}

      {state.choosingTree && <ChooseTreeOverlay state={state} />}

      {state.cmdline !== null && (
        <div className="border-t border-border bg-panel px-2 py-0.5 font-mono text-[11px] text-cyan">
          {state.cmdline}
          <span className="ml-px inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-cyan/60 align-middle" />
        </div>
      )}

      <div className="flex min-h-6 items-center gap-2 border-t border-border bg-accent/10 px-2 font-mono text-[11px]">
        <span className="rounded bg-accent px-1.5 text-background">
          [{state.session.name}:{winIndex}]
        </span>
        <div className="flex items-center gap-2">
          {state.session.windows.map((w, i) => (
            <span key={w.id} className={i === winIndex ? "text-foreground" : "text-muted"}>
              {i}:{w.name}
              {i === winIndex ? "*" : ""}
            </span>
          ))}
        </div>
        <span className="ml-auto text-muted">{right}</span>
      </div>
    </div>
  );
}
