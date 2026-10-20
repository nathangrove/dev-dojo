import { describe, expect, it } from "vitest";
import {
  activePaneIndex,
  activeWindow,
  activeWindowIndex,
  attach,
  createInitialTmux,
  detach,
  evaluateTmuxGoal,
  executeTmuxCommand,
  handleTmuxKey,
  killPane,
  lastPane,
  moveDir,
  newWindow,
  nextPane,
  openChooseTree,
  paneRing,
  renameSession,
  renameWindow,
  resizeActive,
  spatialOrder,
  splitActive,
  swapPane,
  toggleCopyMode,
  toggleZoom,
} from "./engine";
import type { TmuxDrill } from "./types";

function run(state: ReturnType<typeof createInitialTmux>, keys: string[]) {
  return keys.reduce((s, k) => handleTmuxKey(s, k), state);
}

describe("createInitialTmux", () => {
  it("opens with a single window and pane", () => {
    const s = createInitialTmux();
    expect(s.session.windows).toHaveLength(1);
    expect(activeWindow(s).panes).toHaveLength(1);
    expect(s.prefix).toBe(false);
  });

  it("can seed panes and windows", () => {
    const drill: TmuxDrill = {
      id: "t",
      prompt: "seed",
      solution: "",
      goal: { kind: "paneCount", count: 3 },
      initialPanes: 3,
      initialWindows: 2,
    };
    const s = createInitialTmux(drill);
    expect(s.session.windows).toHaveLength(2);
    expect(s.session.windows[0].panes).toHaveLength(3);
    expect(s.session.windows[1].panes).toHaveLength(1);
  });
});

describe("splitting", () => {
  it("split -h puts the new pane on the right and activates it", () => {
    const s = splitActive(createInitialTmux(), "row");
    const win = activeWindow(s);
    expect(win.panes).toHaveLength(2);
    expect(win.activePaneId).toBe(1);
    expect(paneRing(win)).toEqual([0, 1]);
    expect(win.layout).toEqual({
      kind: "split",
      dir: "row",
      children: [
        { kind: "leaf", paneId: 0 },
        { kind: "leaf", paneId: 1 },
      ],
    });
  });

  it("split -v puts the new pane below", () => {
    const s = splitActive(createInitialTmux(), "col");
    expect(activeWindow(s).layout).toMatchObject({ dir: "col" });
  });

  it("nests rather than rebalancing (matches tmux geometry)", () => {
    let s = splitActive(createInitialTmux(), "row");
    s = splitActive(s, "row");
    expect(activeWindow(s).layout).toEqual({
      kind: "split",
      dir: "row",
      children: [
        { kind: "leaf", paneId: 0 },
        {
          kind: "split",
          dir: "row",
          children: [
            { kind: "leaf", paneId: 1 },
            { kind: "leaf", paneId: 2 },
          ],
        },
      ],
    });
    expect(spatialOrder(activeWindow(s).layout)).toEqual([0, 1, 2]);
    expect(activePaneIndex(activeWindow(s))).toBe(2);
  });
});

describe("navigation", () => {
  it("moves around the spatial ring and wraps", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]);
    s = run(s, ["ctrl+b", "%"]); // ring [0,1,2], active 2
    s = moveDir(s, 1); // wrap to 0
    expect(activePaneIndex(activeWindow(s))).toBe(0);
    s = moveDir(s, -1); // wrap back to 2
    expect(activePaneIndex(activeWindow(s))).toBe(2);
  });

  it("o moves in creation order", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]);
    s = nextPane(s); // active 1 -> creation order next wraps to 0
    expect(activeWindow(s).activePaneId).toBe(0);
  });

  it("; toggles back to the previous pane", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]);
    expect(activeWindow(s).activePaneId).toBe(1);
    s = lastPane(s);
    expect(activeWindow(s).activePaneId).toBe(0);
  });
});

describe("zoom", () => {
  it("toggles", () => {
    const s = toggleZoom(createInitialTmux());
    expect(activeWindow(s).zoomed).toBe(true);
    expect(activeWindow(toggleZoom(s)).zoomed).toBe(false);
  });
});

describe("kill", () => {
  it("removes the active pane and collapses the layout", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]);
    s = killPane(s);
    const win = activeWindow(s);
    expect(win.panes).toHaveLength(1);
    expect(win.activePaneId).toBe(0);
    expect(win.layout).toEqual({ kind: "leaf", paneId: 0 });
  });

  it("x y confirms a kill via keys", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]);
    s = run(s, ["ctrl+b", "x"]);
    expect(s.pendingKill).toBe(true);
    s = handleTmuxKey(s, "y");
    expect(activeWindow(s).panes).toHaveLength(1);
  });
});

describe("windows", () => {
  it("new-window appends and activates", () => {
    const s = newWindow(createInitialTmux());
    expect(s.session.windows).toHaveLength(2);
    expect(activeWindowIndex(s)).toBe(1);
    expect(s.session.windows[1].name).toBe("bash");
  });

  it("n and p cycle with wrap", () => {
    let s = newWindow(createInitialTmux());
    s = run(s, ["ctrl+b", "n"]);
    expect(activeWindowIndex(s)).toBe(0);
    s = run(s, ["ctrl+b", "p"]);
    expect(activeWindowIndex(s)).toBe(1);
  });

  it("digit selects a window", () => {
    let s = newWindow(createInitialTmux());
    s = run(s, ["ctrl+b", "0"]);
    expect(activeWindowIndex(s)).toBe(0);
  });
});

describe("command prompt", () => {
  it("runs split-window -h", () => {
    const s = executeTmuxCommand(createInitialTmux(), ":split-window -h");
    expect(activeWindow(s).layout).toMatchObject({ dir: "row" });
  });

  it("runs resize-pane -Z", () => {
    const s = executeTmuxCommand(createInitialTmux(), ":resize-pane -Z");
    expect(activeWindow(s).zoomed).toBe(true);
  });

  it("types and executes via keys", () => {
    let s = run(createInitialTmux(), ["ctrl+b", ":"]);
    expect(s.cmdline).toBe(":");
    for (const ch of "split-window") s = handleTmuxKey(s, ch);
    s = handleTmuxKey(s, "Enter");
    expect(s.cmdline).toBeNull();
    expect(activeWindow(s).panes).toHaveLength(2);
  });
});

describe("goals", () => {
  it("evaluates paneCount", () => {
    const s = run(createInitialTmux(), ["ctrl+b", "%"]);
    expect(
      evaluateTmuxGoal(s, { kind: "paneCount", count: 2 }),
    ).toBe(true);
    expect(
      evaluateTmuxGoal(s, { kind: "paneCount", count: 1 }),
    ).toBe(false);
  });

  it("evaluates activePane index", () => {
    const s = run(createInitialTmux(), ["ctrl+b", "%"]);
    expect(evaluateTmuxGoal(s, { kind: "activePane", index: 1 })).toBe(true);
    expect(evaluateTmuxGoal(s, { kind: "activePane", index: 0 })).toBe(false);
  });

  it("evaluates windowCount and activeWindow", () => {
    const s = newWindow(createInitialTmux());
    expect(evaluateTmuxGoal(s, { kind: "windowCount", count: 2 })).toBe(true);
    expect(evaluateTmuxGoal(s, { kind: "activeWindow", index: 1 })).toBe(true);
  });
});

describe("resize", () => {
  it("resizeActive sets the active pane size and persists it", () => {
    const s = resizeActive(createInitialTmux(), "width", 100);
    const win = activeWindow(s);
    expect(win.resized[win.activePaneId].width).toBe(100);
    expect(evaluateTmuxGoal(s, { kind: "paneWidth", cells: 100 })).toBe(true);
  });

  it("resize-pane -x runs through the command prompt", () => {
    const s = executeTmuxCommand(createInitialTmux(), ":resize-pane -x 100");
    expect(evaluateTmuxGoal(s, { kind: "paneWidth", cells: 100 })).toBe(true);
  });

  it("resize-pane -y sets the height", () => {
    const s = executeTmuxCommand(createInitialTmux(), ":resize-pane -y 10");
    expect(evaluateTmuxGoal(s, { kind: "paneHeight", cells: 10 })).toBe(true);
  });
});

describe("swap", () => {
  it("swapPane next exchanges the active pane with its neighbor", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "%"]); // ring [0,1], active 1
    s = swapPane(s, "next"); // active 1 swaps with ring[0]
    // The panes trade positions; focus follows the active pane, whose id is unchanged.
    expect(activeWindow(s).activePaneId).toBe(1);
    expect(spatialOrder(activeWindow(s).layout)).toEqual([1, 0]);
  });
});

describe("rename", () => {
  it("renameWindow updates the active window name", () => {
    const s = renameWindow(createInitialTmux(), "editor");
    expect(activeWindow(s).name).toBe("editor");
    expect(evaluateTmuxGoal(s, { kind: "windowName", name: "editor" })).toBe(true);
  });

  it("rename-session updates the session name", () => {
    const s = renameSession(createInitialTmux(), "work");
    expect(s.session.name).toBe("work");
    expect(evaluateTmuxGoal(s, { kind: "sessionName", name: "work" })).toBe(true);
  });
});

describe("detach / attach", () => {
  it("detach marks detached and attach restores the session", () => {
    let s = detach(createInitialTmux());
    expect(s.attached).toBe(false);
    expect(evaluateTmuxGoal(s, { kind: "detached" })).toBe(true);
    s = attach(s);
    expect(s.attached).toBe(true);
  });
});

describe("copy mode", () => {
  it("C-b [ toggles copy mode on and off", () => {
    let s = run(createInitialTmux(), ["ctrl+b", "["]);
    expect(s.copyMode).toBe(true);
    expect(evaluateTmuxGoal(s, { kind: "copyMode" })).toBe(true);
    s = run(s, ["ctrl+b", "["]);
    expect(s.copyMode).toBe(false);
  });
});

describe("choose-tree", () => {
  it("C-b w opens the overlay and a digit picks a window", () => {
    let s = newWindow(createInitialTmux());
    s = run(s, ["ctrl+b", "w"]);
    expect(s.choosingTree).toBe(true);
    s = handleTmuxKey(s, "0");
    expect(s.choosingTree).toBe(false);
    expect(activeWindowIndex(s)).toBe(0);
  });
});
