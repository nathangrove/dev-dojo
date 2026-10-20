import { describe, expect, it } from "vitest";
import { createState, handleKey, stateText, type KeyEvent } from "./vim";
import type { SplitNode, VimState } from "./types";
import { activeBuffer, activeWindow, createSeeded } from "./session";
import { allWindowIds } from "./layout";
import { countWindows, evaluateGoal } from "./goals";

function keys(s: VimState, seq: KeyEvent[]): VimState {
  let st = s;
  for (const k of seq) st = handleKey(st, k);
  return st;
}

/** Type an Ex command character-by-character then press Enter. */
function ex(cmd: string): KeyEvent[] {
  return [":", ...cmd.split(""), "Enter"];
}

const leaf = (windowId: number): SplitNode => ({ kind: "leaf", windowId });

describe("ex: writing and quitting", () => {
  it(":w clears the modified flag", () => {
    let s = createState("hello");
    s = keys(s, ["x"]);
    expect(activeBuffer(s).modified).toBe(true);
    s = keys(s, ex("w out.txt"));
    expect(activeBuffer(s).modified).toBe(false);
    expect(s.statusMessage).toContain("written");
  });

  it(":w on an unnamed buffer reports E32", () => {
    let s = createState("hello");
    s = keys(s, ["x"]);
    s = keys(s, ex("w"));
    expect(activeBuffer(s).modified).toBe(true);
    expect(s.statusMessage).toContain("E32");
  });

  it(":q refuses to close a modified buffer", () => {
    let s = createState("hello");
    s = keys(s, ["x"]);
    s = keys(s, ex("q"));
    expect(s.windows.length).toBe(1);
    expect(s.statusMessage).toContain("E37");
  });

  it(":q closes a window once the buffer is written", () => {
    let s = createState("hello");
    s = keys(s, ["x"]);
    // open a split so there is a window we are allowed to close
    s = keys(s, ["ctrl+w", "v"]);
    s = keys(s, ex("w out.txt"));
    s = keys(s, ex("q"));
    expect(s.windows.length).toBe(1);
  });

  it(":wq writes then closes the window", () => {
    let s = createState("hello");
    s = keys(s, ["ctrl+w", "v", "x"]);
    s = keys(s, ex("wq out.txt"));
    expect(s.windows.length).toBe(1);
    expect(s.buffers[0].modified).toBe(false);
  });

  it(":w filename names an unnamed buffer", () => {
    let s = createState("draft");
    s = keys(s, ex("w notes.txt"));
    expect(activeBuffer(s).name).toBe("notes.txt");
    expect(activeBuffer(s).modified).toBe(false);
  });
});

describe("ex: editing files", () => {
  it(":e opens a new file in the current window", () => {
    let s = createState("first");
    s = keys(s, ex("e second.txt"));
    expect(activeBuffer(s).name).toBe("second.txt");
    expect(s.buffers.length).toBe(2);
  });

  it(":e refuses when the buffer is modified", () => {
    let s = createState("first");
    s = keys(s, ["x"]);
    s = keys(s, ex("e other.txt"));
    expect(activeBuffer(s).name).toBe("[No Name]");
    expect(s.statusMessage).toContain("E37");
  });

  it(":e! overrides the modified check", () => {
    let s = createState("first");
    s = keys(s, ["x"]);
    s = keys(s, ex("e! other.txt"));
    expect(activeBuffer(s).name).toBe("other.txt");
  });

  it(":sp and :vsp open named files in new windows", () => {
    let s = createState("main");
    s = keys(s, ex("sp left.txt"));
    expect(s.windows.length).toBe(2);
    expect(activeBuffer(s).name).toBe("left.txt");
    s = keys(s, ex("vsp right.txt"));
    expect(s.windows.length).toBe(3);
    expect(activeBuffer(s).name).toBe("right.txt");
  });

  it(":bn and :bp cycle buffers", () => {
    let s = createState("one");
    s = keys(s, ex("e two"));
    expect(activeBuffer(s).name).toBe("two");
    s = keys(s, ex("bn"));
    expect(activeBuffer(s).name).toBe("[No Name]");
    s = keys(s, ex("bp"));
    expect(activeBuffer(s).name).toBe("two");
  });

  it(":ls reports the buffer list", () => {
    let s = createState("one");
    s = keys(s, ex("e two"));
    s = keys(s, ex("ls"));
    expect(s.statusMessage).toContain("two");
  });
});

describe("ctrl-w window commands", () => {
  it("<C-w>v splits vertically (row) with the new window on the left", () => {
    const s = keys(createState("a"), ["ctrl+w", "v"]);
    expect(s.tabs[0].layout).toEqual({
      kind: "split",
      dir: "row",
      children: [leaf(2), leaf(1)],
    });
    expect(activeWindow(s).id).toBe(2);
  });

  it("<C-w>s splits horizontally (col) with the new window on top", () => {
    const s = keys(createState("a"), ["ctrl+w", "s"]);
    expect(s.tabs[0].layout).toEqual({
      kind: "split",
      dir: "col",
      children: [leaf(2), leaf(1)],
    });
  });

  it("same-direction splits flatten", () => {
    const s = keys(createState("a"), ["ctrl+w", "v", "ctrl+w", "v"]);
    expect(s.tabs[0].layout).toEqual({
      kind: "split",
      dir: "row",
      children: [leaf(3), leaf(2), leaf(1)],
    });
  });

  it("a cross-direction split nests", () => {
    const s = keys(createState("a"), ["ctrl+w", "v", "ctrl+w", "s"]);
    expect(s.tabs[0].layout).toEqual({
      kind: "split",
      dir: "row",
      children: [{ kind: "split", dir: "col", children: [leaf(3), leaf(2)] }, leaf(1)],
    });
  });

  it("<C-w>h/j/k/l move by geometry", () => {
    let s = keys(createState("a"), ["ctrl+w", "v"]); // row[2,1], active 2 (left)
    expect(activeWindow(s).id).toBe(2);
    s = keys(s, ["ctrl+w", "l"]); // right -> window 1
    expect(activeWindow(s).id).toBe(1);
    s = keys(s, ["ctrl+w", "h"]); // left -> window 2
    expect(activeWindow(s).id).toBe(2);
  });

  it("<C-w>j/k move between stacked windows", () => {
    let s = keys(createState("a"), ["ctrl+w", "s"]); // col[2,1], active 2 (top)
    expect(activeWindow(s).id).toBe(2);
    s = keys(s, ["ctrl+w", "j"]); // down -> window 1
    expect(activeWindow(s).id).toBe(1);
    s = keys(s, ["ctrl+w", "k"]); // up -> window 2
    expect(activeWindow(s).id).toBe(2);
  });

  it("<C-w>w cycles windows", () => {
    let s = keys(createState("a"), ["ctrl+w", "v", "ctrl+w", "v"]); // row[3,2,1], active 3
    expect(activeWindow(s).id).toBe(3);
    s = keys(s, ["ctrl+w", "w"]);
    expect(activeWindow(s).id).toBe(2);
    s = keys(s, ["ctrl+w", "w"]);
    expect(activeWindow(s).id).toBe(1);
    s = keys(s, ["ctrl+w", "w"]);
    expect(activeWindow(s).id).toBe(3);
  });

  it("<C-w>c closes the current window", () => {
    let s = keys(createState("a"), ["ctrl+w", "v"]);
    expect(s.windows.length).toBe(2);
    s = keys(s, ["ctrl+w", "c"]);
    expect(s.windows.length).toBe(1);
    expect(allWindowIds(s.tabs[0].layout).length).toBe(1);
  });

  it("<C-w>o closes every other window", () => {
    let s = keys(createState("a"), ["ctrl+w", "v", "ctrl+w", "v"]);
    expect(s.windows.length).toBe(3);
    s = keys(s, ["ctrl+w", "o"]);
    expect(s.windows.length).toBe(1);
  });

  it("<C-w>c cannot close the last window", () => {
    const s = keys(createState("a"), ["ctrl+w", "c"]);
    expect(s.windows.length).toBe(1);
    expect(s.statusMessage).toContain("E444");
  });
});

describe("tabs", () => {
  it(":tabnew opens a tab and gt/gT cycle", () => {
    let s = createState("a");
    s = keys(s, ex("tabnew"));
    expect(s.tabs.length).toBe(2);
    expect(s.activeTab).toBe(1);
    s = keys(s, ["g", "t"]); // wraps to tab 0
    expect(s.activeTab).toBe(0);
    s = keys(s, ["g", "T"]); // back to tab 1
    expect(s.activeTab).toBe(1);
  });

  it(":tabclose closes the current tab", () => {
    let s = createState("a");
    s = keys(s, ex("tabnew"));
    s = keys(s, ex("tabclose"));
    expect(s.tabs.length).toBe(1);
  });
});

describe("registers", () => {
  it('"ayy yanks into register a and "ap pastes it', () => {
    let s = createState("hello world");
    s = keys(s, ['"', "a", "y", "y"]);
    expect(s.registers.a.lines).toEqual(["hello world"]);
    s = keys(s, ['"', "a", "p"]);
    expect(stateText(s)).toBe("hello world\nhello world");
  });

  it("a named delete does not disturb the paste of another register", () => {
    let s = createState("aaa\nbbb");
    s = keys(s, ['"', "a", "y", "y"]); // a = "aaa"
    s = keys(s, ["j"]); // move to bbb
    s = keys(s, ['"', "a", "p"]); // paste a below bbb
    expect(stateText(s)).toBe("aaa\nbbb\naaa");
  });
});

describe("marks", () => {
  it("ma sets a mark and `a jumps back to it exactly", () => {
    let s = createState("one\ntwo\nthree");
    s = keys(s, ["j", "m", "a"]); // mark at row 1 col 0
    s = keys(s, ["G"]); // row 2
    expect(s.row).toBe(2);
    s = keys(s, ["`", "a"]);
    expect(s.row).toBe(1);
    expect(s.col).toBe(0);
  });

  it("'a jumps to the first non-blank of the marked line", () => {
    let s = createState("one\n    indented\nthree");
    s = keys(s, ["j", "$", "m", "a"]); // mark at end of indented line
    s = keys(s, ["G"]);
    s = keys(s, ["'", "a"]);
    expect(s.row).toBe(1);
    expect(s.col).toBe(4);
  });
});

describe("command line entry", () => {
  it(": enters cmdline mode and Escape cancels", () => {
    let s = keys(createState("x"), [":", "q"]);
    expect(s.mode).toBe("cmdline");
    expect(s.cmdline).toBe(":q");
    s = keys(s, ["Escape"]);
    expect(s.mode).toBe("normal");
    expect(s.cmdline).toBe(null);
  });

  it("Backspace edits the command line", () => {
    const s = keys(createState("x"), [":", "w", "q", "Backspace"]);
    expect(s.cmdline).toBe(":w");
  });
});

describe("createSeeded", () => {
  it("names the primary buffer from files[0] and opens the rest", () => {
    const s = createSeeded("alpha", [
      { name: "a.txt", text: "ignored" },
      { name: "b.txt", text: "beta" },
    ]);
    expect(activeBuffer(s).name).toBe("a.txt");
    expect(activeBuffer(s).lines).toEqual(["alpha"]);
    expect(s.buffers.map((b) => b.name)).toEqual(["a.txt", "b.txt"]);
  });

  it("places the cursor and marks the buffer modified when asked", () => {
    const s = createSeeded("alpha\nbravo", [{ name: "a.txt", text: "" }], { row: 1, col: 2 }, true);
    expect({ row: s.row, col: s.col }).toEqual({ row: 1, col: 2 });
    expect(activeBuffer(s).modified).toBe(true);
  });
});

describe("evaluateGoal", () => {
  it("matches window counts from the split tree", () => {
    const s = keys(createState("a"), ["ctrl+w", "v", "ctrl+w", "s"]);
    expect(countWindows(s)).toBe(3);
    expect(evaluateGoal(s, { kind: "windowCount", count: 3 })).toBe(true);
    expect(evaluateGoal(s, { kind: "windowCount", count: 2 })).toBe(false);
  });

  it("checks named registers by joined text", () => {
    const s = keys(createState("hello world"), ['"', "a", "y", "y"]);
    expect(evaluateGoal(s, { kind: "register", name: "a", text: "hello world" })).toBe(true);
    expect(evaluateGoal(s, { kind: "register", name: "a", text: "nope" })).toBe(false);
  });

  it("reports open files as an unordered set", () => {
    const s = createSeeded("a", [
      { name: "a.txt", text: "a" },
      { name: "b.txt", text: "b" },
    ]);
    expect(evaluateGoal(s, { kind: "openFiles", names: ["b.txt", "a.txt"] })).toBe(true);
    expect(evaluateGoal(s, { kind: "openFiles", names: ["a.txt"] })).toBe(false);
  });
});

describe("ex: substitute", () => {
  it(":s replaces the first match on the current line", () => {
    const s = keys(createState("cat and cat"), ex("s/cat/dog/"));
    expect(stateText(s)).toBe("dog and cat");
  });

  it(":s with g replaces every match on the line", () => {
    const s = keys(createState("cat and cat"), ex("s/cat/dog/g"));
    expect(stateText(s)).toBe("dog and dog");
  });

  it(":%s replaces across the whole file", () => {
    const s = keys(createState("TODO one\nTODO two\nthree"), ex("%s/TODO/DONE/g"));
    expect(stateText(s)).toBe("DONE one\nDONE two\nthree");
  });

  it("is undoable", () => {
    const s = keys(createState("cat"), [...ex("s/cat/dog/"), "u"]);
    expect(stateText(s)).toBe("cat");
  });

  it("reports when the pattern is missing", () => {
    const s = keys(createState("cat"), ex("s/dog/bird/"));
    expect(stateText(s)).toBe("cat");
    expect(s.statusMessage).toContain("E486");
  });
});

describe("ex: reload", () => {
  it(":e! discards unsaved edits", () => {
    let s = createState("original");
    s = keys(s, ["x"]);
    expect(activeBuffer(s).modified).toBe(true);
    s = keys(s, ex("e!"));
    expect(stateText(s)).toBe("original");
    expect(activeBuffer(s).modified).toBe(false);
  });
});
