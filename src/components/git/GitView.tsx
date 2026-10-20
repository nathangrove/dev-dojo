"use client";

import type { GitState } from "@/lib/tools/git/types";

interface GitViewProps {
  state: GitState;
  height?: number;
}

export default function GitView({ state, height = 420 }: GitViewProps) {
  const branchNames = state.branches.map((b) => (b.name === state.head ? `* ${b.name}` : `  ${b.name}`));
  const commits = state.commits.slice(0, 6);
  const untracked = [...state.untracked];
  const unstaged = state.modified.filter((f) => !state.index.includes(f));
  const staged = [...state.index];

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-panel-2"
      style={{ height }}
    >
      <div className="flex min-h-0 flex-1 divide-x divide-border">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-panel p-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">Working tree</h4>
          {Object.keys(state.worktree).length === 0 ? (
            <span className="text-xs text-muted">(empty)</span>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-xs text-foreground/90">
              {Object.keys(state.worktree)
                .sort()
                .map((f) => (
                  <li key={f} className="truncate">
                    {f}
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-panel p-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">Staging (index)</h4>
          {staged.length === 0 ? (
            <span className="text-xs text-muted">(empty)</span>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-xs text-foreground/90">
              {staged.map((f) => (
                <li key={f} className="truncate">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-panel p-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">Commits</h4>
          {commits.length === 0 ? (
            <span className="text-xs text-muted">(no commits)</span>
          ) : (
            <ul className="flex flex-col gap-2">
              {commits.map((c) => (
                <li key={c.id} className="rounded border border-border bg-panel-2 px-2 py-1.5 text-xs">
                  <div className="font-mono text-accent">{c.id} {c.parent ? `← ${c.parent}` : "root"}</div>
                  <p className="truncate text-foreground/90">{c.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-panel p-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">Branches</h4>
          <pre className="whitespace-pre font-mono text-xs text-foreground/90">{branchNames.join("\n")}</pre>
          {Object.keys(state.tags).length > 0 && (
            <>
              <h4 className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Tags</h4>
              <pre className="whitespace-pre font-mono text-xs text-foreground/90">
                {Object.keys(state.tags).join("\n")}
              </pre>
            </>
          )}
          {Object.keys(state.remotes).length > 0 && (
            <>
              <h4 className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Remotes</h4>
              <ul className="flex flex-col gap-0.5 font-mono text-xs text-foreground/90">
                {Object.entries(state.remotes).map(([name, url]) => (
                  <li key={name} className="truncate">
                    {name} <span className="text-muted">{url}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {state.stash.length > 0 && (
            <>
              <h4 className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Stash</h4>
              <ul className="flex flex-col gap-0.5 font-mono text-xs text-foreground/90">
                {state.stash.map((entry, i) => (
                  <li key={i} className="truncate">
                    stash@{"{"}{i}{"}"} <span className="text-muted">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-border bg-panel px-3 py-2">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-accent">$</span>
          <span className="flex-1 truncate text-cyan">
            {state.echo}
            <span className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-cyan/60 align-middle" />
          </span>
          {state.lastCommand && <span className="text-muted">{state.lastCommand}</span>}
          <span className={state.error ? "text-red" : "text-green"}>
            {state.error ? "ERR" : "OK"}
          </span>
        </div>
        {state.output && (
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/90">
            {state.output}
          </pre>
        )}
        <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-muted">
          {staged.length > 0 && <span>staged {staged.length}</span>}
          {unstaged.length > 0 && <span>unstaged {unstaged.length}</span>}
          {untracked.length > 0 && <span>untracked {untracked.length}</span>}
        </div>
      </div>
    </div>
  );
}
