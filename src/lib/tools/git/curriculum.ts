import type { Category } from "@/lib/dojo/types";
import type { GitDrill } from "./types";

export const GIT_CATEGORIES: Category<GitDrill>[] = [
  {
    slug: "basics",
    title: "Basics",
    blurb: "Start tracking your work with the essentials.",
    overview:
      "Every Git workflow starts small: initialize a repository, check its status, stage changes, and write commits that capture intent.",
    accent: "#f7768e",
    lessons: [
      {
        slug: "init-status",
        title: "Initialize & Status",
        tagline: "git init, git status",
        concept:
          "Run `git init` to create a repository in this directory. `git status` shows which files are untracked, which are staged, and whether the working tree is clean.",
        keys: [
          { keys: "git init", meaning: "create a new git repository" },
          { keys: "git status", meaning: "show repository state" },
        ],
        drills: [
          {
            id: "git-init-1",
            prompt: "Initialize a new Git repository.",
            solution: "git init",
            goal: { kind: "initialized" },
            startRepo: false,
          },
          {
            id: "git-status-1",
            prompt: "Check the repository status.",
            solution: "git status",
            goal: { kind: "ranCommand", command: "git status" },
          },
        ],
      },
      {
        slug: "add-commit",
        title: "Stage & Commit",
        tagline: "git add, git commit",
        concept:
          "Stage files with `git add <file>` so they go into the next snapshot. Commit staged changes with `git commit -m <message>` to record a checkpoint in history.",
        keys: [
          { keys: "git add", meaning: "stage changes" },
          { keys: "git commit -m", meaning: "commit staged changes" },
        ],
        drills: [
          {
            id: "git-add-1",
            prompt: "Stage the new file so it can be committed.",
            solution: "git add a.txt",
            goal: { kind: "staged", names: ["a.txt"] },
            files: [{ name: "a.txt", text: "hello", untracked: true }],
          },
          {
            id: "git-commit-1",
            prompt: "Commit the staged file with the message 'init'.",
            solution: "git commit -m init",
            goal: { kind: "committed", count: 1, message: "init" },
            files: [{ name: "a.txt", text: "hello", staged: true }],
          },
        ],
      },
    ],
  },
  {
    slug: "branches",
    title: "Branches",
    blurb: "Work on ideas in parallel without breaking main.",
    overview:
      "Branches let you explore features and fixes in isolation. Switch between branches as your focus changes, and create new ones to experiment safely.",
    accent: "#7aa2f7",
    lessons: [
      {
        slug: "branch-switch",
        title: "Creating & Switching Branches",
        tagline: "git branch, git checkout",
        concept:
          "`git branch <name>` creates a branch pointing at the current commit. `git checkout <name>` (or `git switch <name>`) moves HEAD to that branch.",
        keys: [
          { keys: "git branch", meaning: "list or create branches" },
          { keys: "git checkout", meaning: "switch branches" },
        ],
        drills: [
          {
            id: "git-branch-1",
            prompt: "Create a new branch called 'dev'.",
            solution: "git branch dev",
            goal: { kind: "branch", name: "dev" },
          },
          {
            id: "git-checkout-1",
            prompt: "Switch to the 'dev' branch.",
            solution: "git checkout dev",
            goal: { kind: "head", name: "dev" },
            branches: ["dev"],
          },
          {
            id: "git-switch-c-1",
            prompt: "Create and switch to a new branch called 'feature' in one step.",
            solution: "git switch -c feature",
            goal: { kind: "head", name: "feature" },
          },
        ],
      },
    ],
  },
  {
    slug: "inspect",
    title: "Inspecting History",
    blurb: "See what changed and when it happened.",
    overview:
      "Look back at your history and spot differences between the working tree and tracked files. Read commits to understand the story, and diff to understand the details.",
    accent: "#9ece6a",
    lessons: [
      {
        slug: "log-diff",
        title: "Log & Diff",
        tagline: "git log, git diff",
        concept:
          "`git log` prints recent commits on the current branch. `git diff` shows unstaged changes to tracked files.",
        keys: [
          { keys: "git log", meaning: "show commit history" },
          { keys: "git diff", meaning: "show unstaged changes" },
        ],
        drills: [
          {
            id: "git-log-1",
            prompt: "View the commit history.",
            solution: "git log",
            goal: { kind: "ranCommand", command: "git log" },
            commits: 1,
          },
          {
            id: "git-log-oneline-1",
            prompt: "View the commit history in one-line format.",
            solution: "git log --oneline",
            goal: { kind: "ranCommand", command: "git log --oneline" },
            commits: 2,
          },
          {
            id: "git-diff-1",
            prompt: "Check for unstaged changes to tracked files.",
            solution: "git diff",
            goal: { kind: "ranCommand", command: "git diff" },
            files: [{ name: "a.txt", text: "changed" }],
          },
          {
            id: "git-diff-staged-1",
            prompt: "Check what is staged and ready to commit.",
            solution: "git diff --staged",
            goal: { kind: "ranCommand", command: "git diff --staged" },
            files: [{ name: "a.txt", text: "changed", staged: true }],
          },
        ],
      },
    ],
  },
  {
    slug: "undo",
    title: "Undoing Changes",
    blurb: "Back out of mistakes without losing work.",
    overview:
      "`git reset` and `git restore` unwind staged or working-tree changes. Learn the difference between clearing the index and discarding edits entirely.",
    accent: "#bb9af7",
    lessons: [
      {
        slug: "reset-restore",
        title: "Reset & Restore",
        tagline: "git reset, git restore",
        concept:
          "`git reset` clears the staging area, putting changes back to unstaged. `git reset --hard` also discards working-tree edits. `git restore <file>` reverts a file to its last committed state.",
        keys: [
          { keys: "git reset", meaning: "unstage all staged changes" },
          { keys: "git reset --hard", meaning: "discard all local changes" },
          { keys: "git restore", meaning: "revert a file to HEAD" },
        ],
        drills: [
          {
            id: "git-reset-1",
            prompt: "Unstage everything so nothing is staged.",
            solution: "git reset",
            goal: { kind: "staged", names: [] },
            files: [{ name: "a.txt", text: "x", staged: true }],
          },
          {
            id: "git-reset-hard-1",
            prompt: "Discard all local changes so the working tree is clean.",
            solution: "git reset --hard",
            goal: { kind: "clean" },
            files: [{ name: "a.txt", text: "x", staged: true }],
          },
        ],
      },
    ],
  },
  {
    slug: "remotes",
    title: "Remotes & Stash",
    blurb: "Share work and park changes for later.",
    overview:
      "Remotes connect your repository to a shared copy on GitHub or elsewhere. Stash lets you set local changes aside temporarily so you can switch context cleanly.",
    accent: "#e0af68",
    lessons: [
      {
        slug: "remote-add",
        title: "Adding a Remote",
        tagline: "git remote add",
        concept:
          "`git remote add <name> <url>` registers a named remote repository. `git remote` lists the ones you have configured.",
        keys: [{ keys: "git remote add", meaning: "register a remote repository" }],
        drills: [
          {
            id: "git-remote-1",
            prompt: "Add a remote called 'origin' pointing at 'url'.",
            solution: "git remote add origin url",
            goal: { kind: "remote", name: "origin" },
          },
        ],
      },
      {
        slug: "stash",
        title: "Stashing Changes",
        tagline: "git stash, git stash pop",
        concept:
          "`git stash` saves your uncommitted changes and clears the working tree. `git stash pop` restores the most recent stash and drops it from the list.",
        keys: [
          { keys: "git stash", meaning: "save uncommitted changes and clear the tree" },
          { keys: "git stash pop", meaning: "restore the latest stash" },
        ],
        drills: [
          {
            id: "git-stash-1",
            prompt: "Stash the current local changes.",
            solution: "git stash",
            goal: { kind: "stashed" },
            files: [{ name: "a.txt", text: "wip" }],
          },
        ],
      },
    ],
  },
  {
    slug: "tags",
    title: "Tags",
    blurb: "Mark important commits with names.",
    overview:
      "Tags point at a fixed commit, usually a release. Create one at the current HEAD so you can find that exact point later.",
    accent: "#73daca",
    lessons: [
      {
        slug: "tag-create",
        title: "Creating a Tag",
        tagline: "git tag",
        concept:
          "`git tag <name>` marks the current commit with a named tag. `git tag` with no arguments lists existing tags.",
        keys: [{ keys: "git tag", meaning: "create or list tags" }],
        drills: [
          {
            id: "git-tag-1",
            prompt: "Tag the current commit as 'v1.0'.",
            solution: "git tag v1.0",
            goal: { kind: "tag", name: "v1.0" },
            commits: 1,
          },
        ],
      },
    ],
  },
  {
    slug: "merge",
    title: "Merging",
    blurb: "Bring a branch's work back into your current branch.",
    overview:
      "Merging integrates the history of another branch into the one you are on. It is the final step after a branch has served its purpose.",
    accent: "#ff9e64",
    lessons: [
      {
        slug: "merge-branch",
        title: "Merging a Branch",
        tagline: "git merge",
        concept:
          "`git merge <name>` incorporates the commits from `<name>` into the current branch. Always make sure your work is committed before merging.",
        keys: [{ keys: "git merge", meaning: "merge another branch into HEAD" }],
        drills: [
          {
            id: "git-merge-1",
            prompt: "Merge the 'dev' branch into your current branch.",
            solution: "git merge dev",
            goal: { kind: "ranCommand", command: "git merge dev" },
            branches: ["dev"],
          },
        ],
      },
    ],
  },
];
