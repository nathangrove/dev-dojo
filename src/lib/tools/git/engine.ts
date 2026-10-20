import type {
  Branch,
  Commit,
  GitDrill,
  GitGoal,
  GitState,
} from "./types";

/* ------------------------------------------------------------------ */
/* construction                                                        */
/* ------------------------------------------------------------------ */

export function seedCommit(n: number): Commit {
  return {
    id: `c${n}`,
    message: `commit ${n}`,
    files: [],
    parent: n > 1 ? `c${n - 1}` : null,
  };
}

export function createInitialGit(drill?: GitDrill): GitState {
  const repo = drill?.startRepo ?? true;
  const files = drill?.files ?? [];

  const worktree: Record<string, string> = {};
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const f of files) {
    worktree[f.name] = f.text;
    if (f.untracked) {
      untracked.push(f.name);
      continue;
    }
    modified.push(f.name);
    if (f.staged) staged.push(f.name);
  }

  const commitCount = Math.max(0, drill?.commits ?? 0);
  const commits: Commit[] = [];
  for (let i = commitCount; i >= 1; i--) commits.push(seedCommit(i));

  const head = drill?.branch ?? "main";
  const branches: Branch[] = repo
    ? [{ name: head, target: commits[0]?.id ?? null }]
    : [];
  if (repo) {
    for (const name of drill?.branches ?? []) {
      if (name !== head) branches.push({ name, target: null });
    }
  }

  // files seeded as staged go into the index
  for (const f of files) if (!f.untracked && f.staged) staged.push(f.name);

  return {
    commits,
    branches,
    head,
    index: repo ? staged.reverse() : [],
    worktree,
    modified: repo ? [...modified] : [],
    untracked,
    remotes: {},
    tags: {},
    stash: [],
    echo: "",
    lastCommand: "",
    output: "",
    error: false,
  };
}

/* ------------------------------------------------------------------ */
/* accessors                                                           */
/* ------------------------------------------------------------------ */

export function currentBranch(state: GitState): Branch {
  return state.branches.find((b) => b.name === state.head) ?? state.branches[0];
}

export function hasRepo(state: GitState): boolean {
  return state.branches.length > 0;
}

function nextCommitId(state: GitState): string {
  let max = 0;
  for (const c of state.commits) {
    const n = Number(c.id.replace(/^c/, ""));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `c${max + 1}`;
}

/* ------------------------------------------------------------------ */
/* commands                                                            */
/* ------------------------------------------------------------------ */

function ok(state: GitState, output: string, echo: string): GitState {
  return { ...state, echo: "", lastCommand: echo, output, error: false };
}

function fail(state: GitState, output: string, echo: string): GitState {
  return { ...state, echo: "", lastCommand: echo, output, error: true };
}

/** Parse a `git ...` command line (leading `git` optional). */
export function runGitCommand(state: GitState, line: string): GitState {
  const raw = line.trim().replace(/^git\s+/, "");
  const [cmd, ...args] = raw.split(/\s+/).filter(Boolean);

  switch (cmd) {
    case undefined:
      return fail(state, "usage: git <command>", "git");
    case "init":
      return gitInit(state);
    case "status":
      return gitStatus(state);
    case "add":
      return gitAdd(state, args);
    case "commit":
      return gitCommit(state, args);
    case "branch":
      return gitBranch(state, args);
    case "checkout":
    case "switch":
      return gitCheckout(state, args);
    case "log":
      return gitLog(state, args);
    case "diff":
      return gitDiff(state, args);
    case "remote":
      return gitRemote(state, args);
    case "tag":
      return gitTag(state, args);
    case "stash":
      return gitStash(state, args);
    case "merge":
      return gitMerge(state, args);
    case "reset":
      return gitReset(state, args);
    case "restore":
      return gitRestore(state, args);
    default:
      return fail(state, `git: '${cmd}' is not a git command.`, raw);
  }
}

function gitInit(state: GitState): GitState {
  if (hasRepo(state)) return fail(state, "Reinitialized existing Git repository", "git init");
  return ok(
    { ...state, branches: [{ name: "main", target: null }], head: "main" },
    "Initialized empty Git repository",
    "git init",
  );
}

function gitStatus(state: GitState): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git status");
  const lines: string[] = [`On branch ${state.head}`];
  if (state.index.length > 0) {
    lines.push("", "Changes to be committed:");
    for (const f of state.index) lines.push(`\tnew file:   ${f}`);
  }
  const unstaged = state.modified.filter((f) => !state.index.includes(f));
  if (unstaged.length > 0) {
    lines.push("", "Changes not staged for commit:");
    for (const f of unstaged) lines.push(`\tmodified:   ${f}`);
  }
  if (state.untracked.length > 0) {
    lines.push("", "Untracked files:");
    for (const f of state.untracked) lines.push(`\t${f}`);
  }
  if (
    state.index.length === 0 &&
    unstaged.length === 0 &&
    state.untracked.length === 0
  ) {
    lines.push("", "nothing to commit, working tree clean");
  }
  return ok(state, lines.join("\n"), "git status");
}

function gitAdd(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git add");
  const paths = args.filter((a) => !a.startsWith("-"));
  const all = args.includes("-A") || args.includes("--all") || paths.includes(".");
  if (paths.length === 0 && !all) return fail(state, "Nothing specified, nothing added.", "git add");

  let names: string[];
  if (all) {
    names = [...state.modified, ...state.untracked];
  } else {
    names = paths.filter(
      (p) => state.modified.includes(p) || state.untracked.includes(p),
    );
  }
  if (names.length === 0) return fail(state, `pathspec '${paths[0] ?? "."}' did not match any files`, "git add");
  const index = [...state.untracked, ...names, ...state.index].filter(
    (name, i, arr) => arr.indexOf(name) === i,
  );
  const untracked = state.untracked.filter((f) => !names.includes(f));
  return ok(
    { ...state, index, untracked },
    `added ${names.join(", ")}`,
    `git add ${args.join(" ")}`.trim(),
  );
}

function gitCommit(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git commit");
  const m = args.indexOf("-m");
  const message = m >= 0 ? args.slice(m + 1).join(" ").replace(/^["']|["']$/g, "") : "";
  if (!message) return fail(state, "error: switch 'm' requires a value", "git commit");
  if (state.index.length === 0)
    return fail(state, "nothing added to commit but untracked files present", "git commit");

  const branch = currentBranch(state);
  const id = nextCommitId(state);
  const commit: Commit = {
    id,
    message,
    files: [...state.index],
    parent: branch.target,
  };
  const branches = state.branches.map((b) =>
    b.name === state.head ? { ...b, target: id } : b,
  );
  return ok(
    {
      ...state,
      commits: [commit, ...state.commits],
      branches,
      index: [],
      modified: state.modified.filter((f) => !commit.files.includes(f)),
    },
    `[${state.head} ${id}] ${message}`,
    `git commit -m "${message}"`,
  );
}

function gitBranch(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git branch");
  if (args.length === 0) {
    const lines = state.branches.map((b) =>
      b.name === state.head ? `* ${b.name}` : `  ${b.name}`,
    );
    return ok(state, lines.join("\n"), "git branch");
  }
  const name = args[0];
  if (state.branches.some((b) => b.name === name))
    return fail(state, `fatal: a branch named '${name}' already exists`, "git branch");
  const branches = [...state.branches, { name, target: currentBranch(state).target }];
  return ok({ ...state, branches }, `created branch ${name}`, `git branch ${name}`);
}

function gitCheckout(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git checkout");
  const create = args.includes("-b") || args.includes("-c");
  const name = args.filter((a) => !a.startsWith("-"))[0];
  if (!name) return fail(state, "error: you must specify a branch", "git checkout");
  let branches = state.branches;
  if (create && !branches.some((b) => b.name === name)) {
    branches = [...branches, { name, target: currentBranch(state).target }];
  }
  if (!branches.some((b) => b.name === name))
    return fail(state, `error: pathspec '${name}' did not match any file(s) known to git`, "git checkout");
  return ok({ ...state, branches, head: name }, `Switched to branch '${name}'`, `git checkout ${name}`);
}

function gitLog(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git log");
  if (state.commits.length === 0)
    return fail(state, "fatal: your current branch does not have any commits yet", "git log");
  const oneline = args.includes("--oneline");
  const lines = oneline
    ? state.commits.map((c) => `${c.id} ${c.message}`)
    : state.commits.map((c) => `commit ${c.id}\n    ${c.message}`);
  return ok(state, oneline ? lines.join("\n") : lines.join("\n\n"), `git log${oneline ? " --oneline" : ""}`);
}

function gitDiff(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git diff");
  const staged = args.includes("--staged") || args.includes("--cached");
  const files = staged ? state.index : state.modified.filter((f) => !state.index.includes(f));
  if (files.length === 0) return ok(state, "", "git diff");
  const lines = files.map((f) => `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}`);
  return ok(state, lines.join("\n"), `git diff${staged ? " --staged" : ""}`);
}

function gitRemote(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git remote");
  if (args.length === 0) {
    const names = Object.keys(state.remotes);
    return ok(state, names.join("\n"), "git remote");
  }
  const sub = args[0];
  if (sub === "add") {
    const [name, url] = args.slice(1);
    if (!name || !url) return fail(state, "usage: git remote add <name> <url>", "git remote add");
    if (state.remotes[name])
      return fail(state, `fatal: a remote named '${name}' already exists`, `git remote add ${name}`);
    return ok(
      { ...state, remotes: { ...state.remotes, [name]: url } },
      "",
      `git remote add ${name} ${url}`,
    );
  }
  return fail(state, `error: unknown subcommand '${sub}'`, "git remote");
}

function gitTag(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git tag");
  if (args.length === 0) {
    const names = Object.keys(state.tags);
    return ok(state, names.length ? names.join("\n") : "", "git tag");
  }
  const name = args[0];
  const branch = currentBranch(state);
  if (!branch?.target) return fail(state, "fatal: cannot tag an empty branch", `git tag ${name}`);
  if (state.tags[name]) return fail(state, `fatal: tag '${name}' already exists`, `git tag ${name}`);
  return ok(
    { ...state, tags: { ...state.tags, [name]: branch.target } },
    "",
    `git tag ${name}`,
  );
}

function gitStash(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git stash");
  const sub = args[0];
  if (sub === "pop") {
    if (state.stash.length === 0) return fail(state, "No stash entries found", "git stash pop");
    const [entry, ...rest] = state.stash;
    return ok(
      { ...state, stash: rest, worktree: entry.files },
      `Dropped stash@{0} (${entry.message})`,
      "git stash pop",
    );
  }
  if (sub === "list") {
    const lines = state.stash.map((_, i) => `stash@{${i}}: ${state.stash[i].message}`);
    return ok(state, lines.join("\n"), "git stash list");
  }
  const dirty = state.modified.length > 0 || state.untracked.length > 0 || state.index.length > 0;
  if (!dirty) return fail(state, "No local changes to save", "git stash");
  return ok(
    {
      ...state,
      stash: [{ message: "WIP on " + state.head, files: { ...state.worktree } }, ...state.stash],
      index: [],
      modified: [],
      untracked: [],
    },
    "Saved working directory and index state WIP on " + state.head,
    "git stash",
  );
}

function gitMerge(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git merge");
  const name = args.filter((a) => !a.startsWith("-"))[0];
  if (!name) return fail(state, "fatal: need a branch to merge", "git merge");
  const branch = state.branches.find((b) => b.name === name);
  if (!branch) return fail(state, `fatal: '${name}' does not point to a commit`, `git merge ${name}`);
  if (name === state.head) return fail(state, "Already up to date.", `git merge ${name}`);
  return ok(
    state,
    `Merge made by the 'ort' strategy.\nFast-forward (simulated).`,
    `git merge ${name}`,
  );
}

function gitReset(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git reset");
  if (args.includes("--hard")) {
    return ok({ ...state, index: [], modified: [] }, "HEAD is now at " + (currentBranch(state)?.target ?? ""), "git reset --hard");
  }
  return ok({ ...state, index: [] }, "Unstaged changes after reset:", "git reset");
}

function gitRestore(state: GitState, args: string[]): GitState {
  if (!hasRepo(state)) return fail(state, "fatal: not a git repository", "git restore");
  return ok({ ...state, modified: [], index: [] }, "", "git restore " + args.join(" ").trim());
}

/* ------------------------------------------------------------------ */
/* key handling                                                        */
/* ------------------------------------------------------------------ */

export function handleGitKey(state: GitState, key: string): GitState {
  if (key === "Enter") {
    if (state.echo.trim() === "") return state;
    return runGitCommand(state, state.echo);
  }
  if (key === "Backspace") {
    return { ...state, echo: state.echo.slice(0, -1), error: false };
  }
  if (key === "Escape") {
    return { ...state, echo: "", error: false };
  }
  if (key === "ArrowUp" || key === "ArrowDown") return state;
  if (key.length === 1) return { ...state, echo: state.echo + key, error: false };
  return state;
}

/* ------------------------------------------------------------------ */
/* goals                                                               */
/* ------------------------------------------------------------------ */

export function evaluateGitGoal(state: GitState, goal: GitGoal): boolean {
  switch (goal.kind) {
    case "initialized":
      return hasRepo(state);
    case "staged":
      return goal.names.every((n) => state.index.includes(n)) && state.index.length === goal.names.length;
    case "committed":
      return (
        state.commits.length === goal.count &&
        (goal.message === undefined ||
          state.commits.some((c) => c.message === goal.message))
      );
    case "branch":
      return state.branches.some((b) => b.name === goal.name);
    case "head":
      return state.head === goal.name;
    case "uncommitted":
      return state.index.length + state.modified.filter((f) => !state.index.includes(f)).length ===
        goal.count;
    case "clean":
      return (
        state.index.length === 0 &&
        state.modified.length === 0 &&
        state.untracked.length === 0
      );
    case "remote":
      return goal.name in state.remotes;
    case "tag":
      return goal.name in state.tags;
    case "stashed":
      return state.stash.length > 0;
    case "ranCommand": {
      const norm = (s: string) => s.trim().replace(/^git\s+/, "");
      return state.lastCommand !== "" && norm(state.lastCommand) === norm(goal.command);
    }
    default:
      return false;
  }
}

export function describeGitGoal(goal: GitGoal): string {
  switch (goal.kind) {
    case "initialized":
      return "A Git repository is initialized";
    case "staged":
      return `Staged: ${goal.names.join(", ")}`;
    case "committed":
      return goal.message
        ? `${goal.count} commit(s), including "${goal.message}"`
        : `${goal.count} commit(s)`;
    case "branch":
      return `Branch "${goal.name}" exists`;
    case "head":
      return `HEAD is on "${goal.name}"`;
    case "uncommitted":
      return `${goal.count} uncommitted change(s)`;
    case "clean":
      return "Working tree is clean";
    case "remote":
      return `Remote "${goal.name}" exists`;
    case "tag":
      return `Tag "${goal.name}" exists`;
    case "stashed":
      return "There is at least one stash entry";
    case "ranCommand":
      return `Run: ${goal.command}`;
    default:
      return "";
  }
}
