import { describe, expect, it } from "vitest";
import {
  createInitialGit,
  evaluateGitGoal,
  runGitCommand,
  handleGitKey,
} from "./engine";
import type { GitDrill } from "./types";

const drill = (over: Partial<GitDrill> & { goal: GitDrill["goal"] }): GitDrill => ({
  id: "g",
  prompt: "",
  solution: "",
  ...over,
});

function type(state: ReturnType<typeof createInitialGit>, text: string) {
  let s = state;
  for (const ch of text) s = handleGitKey(s, ch);
  return s;
}

function cmd(state: ReturnType<typeof createInitialGit>, text: string) {
  return handleGitKey(type(state, text), "Enter");
}

describe("git engine basics", () => {
  it("starts with a repo by default", () => {
    const s = createInitialGit();
    expect(s.head).toBe("main");
    expect(evaluateGitGoal(s, { kind: "initialized" })).toBe(true);
  });

  it("stages and commits", () => {
    const drill: GitDrill = {
      id: "g",
      prompt: "",
      solution: "git add a.txt && git commit -m init",
      goal: { kind: "committed", count: 1, message: "init" },
      files: [{ name: "a.txt", text: "hello" }],
    };
    let s = cmd(createInitialGit(drill), "git add a.txt");
    expect(s.output).toMatch(/added a\.txt/);
    s = cmd(s, "git commit -m init");
    expect(evaluateGitGoal(s, { kind: "committed", count: 1, message: "init" })).toBe(true);
    expect(evaluateGitGoal(s, { kind: "clean" })).toBe(true);
  });

  it("creates and switches branches", () => {
    const drill: GitDrill = {
      id: "g2",
      prompt: "",
      solution: "git branch dev",
      goal: { kind: "branch", name: "dev" },
      files: [{ name: "a.txt", text: "a" }],
    };
    let s = cmd(createInitialGit(drill), "git branch dev");
    expect(evaluateGitGoal(s, { kind: "branch", name: "dev" })).toBe(true);
    s = cmd(s, "git checkout dev");
    expect(s.head).toBe("dev");
  });

  it("staged goal is exact", () => {
    const s = runGitCommand(
      createInitialGit({
        id: "g3",
        prompt: "",
        solution: "",
        goal: { kind: "staged", names: ["a.txt"] },
        files: [{ name: "a.txt", text: "1" }],
      }),
      "git add a.txt",
    );
    expect(evaluateGitGoal(s, { kind: "staged", names: ["a.txt"] })).toBe(true);
  });
});

describe("git engine extensions", () => {
  it("adds and lists remotes", () => {
    let s = cmd(createInitialGit(), "git remote add origin url");
    expect(evaluateGitGoal(s, { kind: "remote", name: "origin" })).toBe(true);
    expect(s.remotes.origin).toBe("url");
    s = cmd(s, "git remote");
    expect(s.output).toBe("origin");
  });

  it("refuses duplicate remotes", () => {
    let s = cmd(createInitialGit(), "git remote add origin url");
    s = cmd(s, "git remote add origin other");
    expect(s.error).toBe(true);
  });

  it("tags the current commit", () => {
    const s = cmd(createInitialGit(drill({ commits: 1, goal: { kind: "tag", name: "v1.0" } })), "git tag v1.0");
    expect(evaluateGitGoal(s, { kind: "tag", name: "v1.0" })).toBe(true);
    expect(s.tags["v1.0"]).toBe("c1");
  });

  it("stashes and pops changes", () => {
    const d = drill({
      solution: "git stash",
      files: [{ name: "a.txt", text: "wip" }],
      goal: { kind: "stashed" },
    });
    let s = cmd(createInitialGit(d), "git stash");
    expect(evaluateGitGoal(s, { kind: "stashed" })).toBe(true);
    expect(s.modified).toEqual([]);
    expect(s.worktree["a.txt"]).toBe("wip");
    s = cmd(s, "git stash pop");
    expect(evaluateGitGoal(s, { kind: "stashed" })).toBe(false);
    expect(s.worktree["a.txt"]).toBe("wip");
  });

  it("fails to stash a clean tree", () => {
    const s = cmd(createInitialGit(), "git stash");
    expect(s.error).toBe(true);
  });

  it("log --oneline records the exact command", () => {
    const s = cmd(createInitialGit(drill({ commits: 2, goal: { kind: "ranCommand", command: "git log --oneline" } })), "git log --oneline");
    expect(
      evaluateGitGoal(s, { kind: "ranCommand", command: "git log --oneline" }),
    ).toBe(true);
    expect(s.output.split("\n")).toHaveLength(2);
  });

  it("diff --staged shows only the index", () => {
    const d = drill({
      solution: "git diff --staged",
      files: [{ name: "a.txt", text: "x", staged: true }],
      goal: { kind: "ranCommand", command: "git diff --staged" },
    });
    const s = cmd(createInitialGit(d), "git diff --staged");
    expect(s.output).toContain("a/a.txt");
    expect(s.lastCommand).toBe("git diff --staged");
  });

  it("reset unstages everything", () => {
    const d = drill({
      solution: "git reset",
      files: [{ name: "a.txt", text: "x", staged: true }],
      goal: { kind: "staged", names: [] },
    });
    const s = cmd(createInitialGit(d), "git reset");
    expect(s.index).toEqual([]);
    expect(evaluateGitGoal(s, { kind: "staged", names: [] })).toBe(true);
  });

  it("reset --hard cleans the working tree", () => {
    const d = drill({
      solution: "git reset --hard",
      files: [{ name: "a.txt", text: "x", staged: true }],
      goal: { kind: "clean" },
    });
    const s = cmd(createInitialGit(d), "git reset --hard");
    expect(evaluateGitGoal(s, { kind: "clean" })).toBe(true);
  });

  it("merge records the command and rejects an unknown branch", () => {
    const s = cmd(createInitialGit(drill({ branches: ["dev"], goal: { kind: "ranCommand", command: "git merge dev" } })), "git merge dev");
    expect(s.error).toBe(false);
    expect(evaluateGitGoal(s, { kind: "ranCommand", command: "git merge dev" })).toBe(true);
    const bad = cmd(createInitialGit(), "git merge nope");
    expect(bad.error).toBe(true);
  });
});
