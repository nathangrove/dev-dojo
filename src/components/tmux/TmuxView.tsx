"use client";

import type { TmuxSplit, TmuxState, TmuxWindow } from "@/lib/tools/tmux/types";
import { activeWindow, activeWindowIndex } from "@/lib/tools/tmux/engine";

function Pane({
  paneId,
  win,
}: {
  paneId: number;
  win: TmuxWindow;
}) {
  const pane = win.panes.find((p) => p.id === paneId);
  if (!pane) return null;
  const active = pane.id === win.activePaneId;
  return (
    <div className="min-h-0 min-w-0 flex-1 p-0.5">
      <div
        className={`flex h-full flex-col overflow-hidden rounded border ${
          active ? "border-green" : "border-border"
        } bg-panel`}
      >
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

function renderNode(node: TmuxSplit, win: TmuxWindow): React.ReactNode {
  if (node.kind === "leaf") return <Pane paneId={node.paneId} win={win} />;
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 ${
        node.dir === "row" ? "flex-row" : "flex-col"
      }`}
    >
      {node.children.map((child, i) => (
        <div key={i} className="flex min-h-0 min-w-0 flex-1">
          {renderNode(child, win)}
        </div>
      ))}
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

  const right = state.pendingKill
    ? "kill-pane? (y/n)"
    : state.prefix
      ? "^B-"
      : state.echo || state.statusMessage;

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-panel-2"
      style={{ height }}
    >
      <div className="flex min-h-0 flex-1 gap-0 p-1">
        {win.zoomed ? (
          <Pane paneId={win.activePaneId} win={win} />
        ) : (
          renderNode(win.layout, win)
        )}
      </div>

      {state.cmdline !== null && (
        <div className="border-t border-border bg-panel px-2 py-0.5 font-mono text-[11px] text-cyan">
          {state.cmdline}
          <span className="ml-px inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-cyan/60 align-middle" />
        </div>
      )}

      <div className="flex min-h-6 items-center gap-2 border-t border-border bg-accent/10 px-2 font-mono text-[11px]">
        <span className="rounded bg-accent px-1.5 text-background">
          [{state.session.id}:{winIndex}]
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
