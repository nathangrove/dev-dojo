import type { Category } from "@/lib/dojo/types";
import type { TmuxDrill } from "./types";

export const TMUX_CATEGORIES: Category<TmuxDrill>[] = [
  {
    slug: "panes",
    title: "Panes",
    blurb: "Split one window into many terminals and move between them.",
    accent: "#9ece6a",
    lessons: [
      {
        slug: "splitting",
        title: "Splitting panes",
        tagline: "C-b % and C-b \"",
        concept:
          "Every tmux command starts with the **prefix**: press `Ctrl-b`, release it, then press the command key.\n\n`%` splits the active pane into left/right halves — the new pane opens on the **right**. `\"` splits top/bottom with the new pane **below**. Splits nest instead of re-balancing, so each new pane halves the pane you split.",
        keys: [
          { keys: "C-b %", meaning: "split left / right" },
          { keys: "C-b \"", meaning: "split top / bottom" },
        ],
        drills: [
          {
            id: "tmux-split-1",
            prompt: "Split the window into a left and a right pane.",
            solution: "<C-b>%",
            goal: { kind: "paneCount", count: 2 },
          },
          {
            id: "tmux-split-2",
            prompt: "Split again so you have three panes side by side.",
            solution: "<C-b>%",
            goal: { kind: "paneCount", count: 3 },
            initialPanes: 2,
          },
          {
            id: "tmux-split-3",
            prompt: "Open a pane below the current one.",
            solution: '<C-b>"',
            goal: { kind: "paneCount", count: 2 },
          },
          {
            id: "tmux-split-4",
            prompt: "With two panes open, open a third one below the right pane.",
            solution: '<C-b>"',
            goal: { kind: "paneCount", count: 3 },
            initialPanes: 2,
          },
        ],
      },
      {
        slug: "pane-navigation",
        title: "Moving between panes",
        tagline: "arrow keys, o, ;",
        concept:
          "The arrow keys move focus to the pane in that direction and **wrap** around the ring of panes. `o` cycles to the next pane in creation order, and `;` jumps back to the pane you were on last.",
        keys: [
          { keys: "C-b ←↑↓→", meaning: "move to the pane in that direction (wraps)" },
          { keys: "C-b o", meaning: "next pane" },
          { keys: "C-b ;", meaning: "last (previously active) pane" },
        ],
        drills: [
          {
            id: "tmux-nav-1",
            prompt: "Focus is on the right pane. Move to the left pane.",
            solution: "<C-b><Left>",
            goal: { kind: "activePane", index: 0 },
            initialPanes: 2,
          },
          {
            id: "tmux-nav-2",
            prompt: "You are on the last of three panes. Move right and watch it wrap to the first.",
            solution: "<C-b><Right>",
            goal: { kind: "activePane", index: 0 },
            initialPanes: 3,
          },
          {
            id: "tmux-nav-3",
            prompt:
              "From the left pane, move right twice, then jump back one with the last-pane key to land on the middle pane.",
            solution: "<C-b><Right><C-b><Right><C-b>;",
            goal: { kind: "activePane", index: 1 },
            initialPanes: 3,
            activePane: 0,
          },
          {
            id: "tmux-nav-4",
            prompt: "Cycle to the next pane with o.",
            solution: "<C-b>o",
            goal: { kind: "activePane", index: 0 },
            initialPanes: 3,
          },
        ],
      },
      {
        slug: "pane-management",
        title: "Closing and zooming panes",
        tagline: "x and z",
        concept:
          "`x` closes the active pane (tmux asks for a **y/n** confirmation). `z` **zooms** the active pane so it fills the whole window — press it again to restore the layout.",
        keys: [
          { keys: "C-b x y", meaning: "kill the active pane (confirm)" },
          { keys: "C-b z", meaning: "zoom / unzoom the active pane" },
        ],
        drills: [
          {
            id: "tmux-kill-1",
            prompt: "Close the active pane (confirm when tmux asks).",
            solution: "<C-b>xy",
            goal: { kind: "paneCount", count: 1 },
            initialPanes: 2,
          },
          {
            id: "tmux-zoom-1",
            prompt: "Zoom the active pane so it fills the window.",
            solution: "<C-b>z",
            goal: { kind: "zoomed" },
            initialPanes: 2,
          },
        ],
      },
    ],
  },
  {
    slug: "windows",
    title: "Windows",
    blurb: "Tabs for your terminal — create, switch and jump between windows.",
    accent: "#7aa2f7",
    lessons: [
      {
        slug: "window-basics",
        title: "Creating and switching windows",
        tagline: "c, n, p and number keys",
        concept:
          "A **window** is like a tab inside a session. `c` creates a new window; `n` and `p` move to the next/previous one (both wrap). Pressing a **number key** jumps straight to that window.",
        keys: [
          { keys: "C-b c", meaning: "create a new window" },
          { keys: "C-b n", meaning: "next window" },
          { keys: "C-b p", meaning: "previous window" },
          { keys: "C-b 0-9", meaning: "go to window by number" },
        ],
        drills: [
          {
            id: "tmux-win-1",
            prompt: "Create a second window.",
            solution: "<C-b>c",
            goal: { kind: "windowCount", count: 2 },
          },
          {
            id: "tmux-win-2",
            prompt: "You are on window 1. Jump back to window 0 by number.",
            solution: "<C-b>0",
            goal: { kind: "activeWindow", index: 0 },
            initialWindows: 2,
          },
          {
            id: "tmux-win-3",
            prompt: "Move to the next window (it wraps around).",
            solution: "<C-b>n",
            goal: { kind: "activeWindow", index: 0 },
            initialWindows: 2,
          },
          {
            id: "tmux-win-4",
            prompt: "You are on the last of three windows. Step back one.",
            solution: "<C-b>p",
            goal: { kind: "activeWindow", index: 1 },
            initialWindows: 3,
          },
        ],
      },
    ],
  },
  {
    slug: "commands",
    title: "Command prompt",
    blurb: "Every key binding is a shortcut for a tmux command — type them directly.",
    accent: "#bb9af7",
    lessons: [
      {
        slug: "command-prompt",
        title: "The command prompt",
        tagline: "C-b :",
        concept:
          "Press `Ctrl-b` then `:` to open tmux's command prompt. Everything you can bind to a key is a command here: `split-window`, `select-pane`, `resize-pane`, `new-window` and more. Press **Enter** to run it.",
        keys: [
          { keys: "C-b :", meaning: "open the command prompt" },
          { keys: "split-window -h", meaning: "split left / right" },
          { keys: "select-pane -L", meaning: "move to the pane on the left" },
          { keys: "resize-pane -Z", meaning: "zoom the active pane" },
        ],
        drills: [
          {
            id: "tmux-cmd-1",
            prompt: "Open the command prompt and split the window left/right by command.",
            solution: "<C-b>:split-window -h<CR>",
            goal: { kind: "paneCount", count: 2 },
          },
          {
            id: "tmux-cmd-2",
            prompt: "Move to the previous pane using the command prompt instead of arrow keys.",
            solution: "<C-b>:select-pane -L<CR>",
            goal: { kind: "activePane", index: 1 },
            initialPanes: 3,
          },
          {
            id: "tmux-cmd-3",
            prompt: "Zoom the active pane with a command.",
            solution: "<C-b>:resize-pane -Z<CR>",
            goal: { kind: "zoomed" },
            initialPanes: 2,
          },
        ],
      },
    ],
  },
];
