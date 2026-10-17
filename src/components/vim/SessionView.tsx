"use client";

import type { SplitNode, VimState } from "@/lib/tools/vim/engine/types";
import { activeTab, activeWindow, findBuffer } from "@/lib/tools/vim/engine/session";
import VimBuffer from "./VimBuffer";

interface SessionViewProps {
  state: VimState;
  targetCursor?: { row: number; col: number } | null;
  height?: number;
}

function renderNode(
  node: SplitNode,
  state: VimState,
  activeWindowId: number,
  targetCursor: { row: number; col: number } | null | undefined,
): React.ReactNode {
  if (node.kind === "leaf") {
    const win = state.windows.find((w) => w.id === node.windowId);
    if (!win) return null;
    const buf = findBuffer(state, win.bufferId);
    if (!buf) return null;
    const isActive = win.id === activeWindowId;
    return (
      <div className="min-h-0 min-w-0 flex-1 p-0.5">
        <VimBuffer
          lines={isActive ? state.lines : buf.lines}
          row={isActive ? state.row : win.row}
          col={isActive ? state.col : win.col}
          mode={isActive ? state.mode : "normal"}
          visualAnchor={isActive ? state.visualAnchor : null}
          targetCursor={isActive ? targetCursor : null}
          showCursor
          filename={buf.name}
          modified={buf.modified}
          active={isActive}
          echo={isActive && state.mode !== "cmdline" ? state.echo : ""}
        />
      </div>
    );
  }
  return (
    <div className={`flex min-h-0 min-w-0 flex-1 ${node.dir === "row" ? "flex-row" : "flex-col"}`}>
      {node.children.map((child, i) => (
        <div key={i} className="flex min-h-0 min-w-0 flex-1">
          {renderNode(child, state, activeWindowId, targetCursor)}
        </div>
      ))}
    </div>
  );
}

export default function SessionView({ state, targetCursor, height = 420 }: SessionViewProps) {
  const tab = activeTab(state);
  const win = activeWindow(state);
  const showTabs = state.tabs.length > 1;
  const cmdline = state.mode === "cmdline" ? state.cmdline ?? ":" : null;

  return (
    <div className="flex w-full flex-col gap-1" style={{ height }}>
      {showTabs && (
        <div className="flex items-center gap-1 border-b border-border px-2 pb-1 text-[11px] font-mono">
          {state.tabs.map((t, i) => (
            <span
              key={t.id}
              className={
                i === state.activeTab
                  ? "rounded-t bg-accent px-2 py-0.5 text-background"
                  : "rounded-t bg-panel px-2 py-0.5 text-muted"
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {renderNode(tab.layout, state, win.id, targetCursor)}
      </div>

      <div className="flex min-h-6 items-center gap-2 border-t border-border px-2 font-mono text-[11px]">
        {cmdline !== null ? (
          <span className="flex-1 text-cyan">
            {cmdline}
            <span className="ml-px inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-cyan/60 align-middle" />
          </span>
        ) : (
          <>
            <span className="text-muted">{state.statusMessage}</span>
            <span className="ml-auto text-accent">
              {state.mode === "normal"
                ? "-- NORMAL --"
                : state.mode === "insert"
                  ? "-- INSERT --"
                  : state.mode === "visual"
                    ? "-- VISUAL --"
                    : state.mode === "visual-line"
                      ? "-- V-LINE --"
                      : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
