import { describe, expect, it } from "vitest";
import { createState, handleKey, stateText, type KeyEvent } from "./vim";
import type { VimState } from "./types";

function run(text: string, keys: string | string[], start?: { row: number; col: number }): VimState {
  const seq: KeyEvent[] = Array.isArray(keys) ? keys : keys.split("");
  let s = createState(text);
  if (start) s = { ...s, row: start.row, col: start.col, desiredCol: start.col };
  for (const k of seq) s = handleKey(s, k);
  return s;
}

function result(text: string, keys: string | string[], start?: { row: number; col: number }) {
  const s = run(text, keys, start);
  return { text: stateText(s), row: s.row, col: s.col, mode: s.mode };
}

// Every expectation below was verified against Vim 9.1 with `:normal!`.

describe("motions", () => {
  it("h l move within a line and clamp", () => {
    expect(result("foo bar", "lllll").col).toBe(5);
    expect(result("foo bar", "h").col).toBe(0);
    expect(result("foo bar", "hhhh").col).toBe(0);
  });

  it("w moves between words and across lines", () => {
    expect(result("foo bar baz", "w").col).toBe(4);
    expect(result("foo bar baz", "ww").col).toBe(8);
    expect(result("foo bar\nbaz qux", "w", { row: 0, col: 4 })).toMatchObject({ row: 1, col: 0 });
    expect(result("foo.bar baz", "w").col).toBe(3);
  });

  it("b moves back to word starts", () => {
    expect(result("foo bar baz", "b", { row: 0, col: 8 }).col).toBe(4);
    expect(result("foo.bar baz", "b", { row: 0, col: 4 }).col).toBe(3);
    expect(result("  indented text", "b", { row: 0, col: 2 }).col).toBe(0);
  });

  it("e moves to word ends (inclusive)", () => {
    expect(result("foo bar baz", "e").col).toBe(2);
    expect(result("foo.bar baz", "e").col).toBe(2);
    expect(result("foo bar baz", "ee").col).toBe(6);
  });

  it("0 ^ $ move within the line", () => {
    expect(result("  hi there", "0", { row: 0, col: 4 }).col).toBe(0);
    expect(result("  hi there", "^", { row: 0, col: 4 }).col).toBe(2);
    expect(result("  hi there", "$", { row: 0, col: 4 }).col).toBe(9);
  });

  it("gg and G jump to buffer extremes", () => {
    expect(result("one\ntwo\nthree", "G")).toMatchObject({ row: 2, col: 0 });
    expect(result("one\ntwo\nthree", "G", { row: 0, col: 0 }).row).toBe(2);
    expect(result("one\ntwo\nthree", "gg", { row: 2, col: 1 })).toMatchObject({ row: 0, col: 0 });
    expect(result("one\ntwo\nthree", "2G")).toMatchObject({ row: 1, col: 0 });
  });
});

describe("operators", () => {
  it("dw deletes a word plus following space", () => {
    expect(result("foo bar baz", "dw").text).toBe("bar baz");
  });

  it("dw stops at end of line instead of crossing", () => {
    expect(result("foo bar\nbaz qux", "dw", { row: 0, col: 4 }).text).toBe("foo \nbaz qux");
  });

  it("de and d$ delete to the word/line end inclusively", () => {
    expect(result("foo bar baz", "de").text).toBe(" bar baz");
    expect(result("foo bar baz", "d$").text).toBe("");
  });

  it("d0 and db delete backwards", () => {
    expect(result("foo bar baz", "d0", { row: 0, col: 6 }).text).toBe("r baz");
    expect(result("foo bar baz", "db", { row: 0, col: 5 }).text).toBe("foo ar baz");
  });

  it("dh behaves like X", () => {
    expect(result("foo bar baz", "dh", { row: 0, col: 6 }).text).toBe("foo br baz");
  });

  it("supports counts", () => {
    expect(result("foo bar baz", "d2w").text).toBe("baz");
    expect(result("foo bar baz", "d2e").text).toBe(" baz");
    expect(result("one\ntwo\nthree\nfour", "2dd").text).toBe("three\nfour");
  });

  it("dd is linewise", () => {
    expect(result("foo bar\nbaz qux", "dd").text).toBe("baz qux");
    expect(result("foo bar\nbaz qux", "dj").text).toBe("");
  });

  it("deleting every line leaves a single empty line", () => {
    expect(result("foo bar\nbaz qux", "2dd").text).toBe("");
  });

  it("cw on a word behaves like ce", () => {
    const s = run("foo bar baz", ["c", "w", "X"], { row: 0, col: 5 });
    expect(stateText(s)).toBe("foo bX baz");
    expect(s.mode).toBe("insert");
  });

  it("c$ changes to end of line and enters insert", () => {
    const s = run("foo bar baz", ["c", "$", "X"], { row: 0, col: 5 });
    expect(stateText(s)).toBe("foo bX");
    expect(s.mode).toBe("insert");
  });

  it("cc clears the line and enters insert", () => {
    const s = run("foo bar\nbaz qux", ["c", "c"]);
    expect(stateText(s)).toBe("\nbaz qux");
    expect(s.mode).toBe("insert");
  });

  it("D and C work like d$/c$", () => {
    expect(result("one two", "D", { row: 0, col: 3 }).text).toBe("one");
    const s = run("one two", ["C", "!"], { row: 0, col: 3 });
    expect(stateText(s)).toBe("one!");
  });
});

describe("yank and put", () => {
  it("yy then p pastes a line below", () => {
    expect(result("foo bar\nbaz qux", "yyp").text).toBe("foo bar\nfoo bar\nbaz qux");
  });

  it("dd then p swaps lines", () => {
    expect(result("foo bar\nbaz qux", "ddp").text).toBe("baz qux\nfoo bar");
  });

  it("yw is charwise and P pastes before the cursor", () => {
    expect(result("foo bar", "ywP").text).toBe("foo foo bar");
  });
});

describe("insert entries", () => {
  it("i inserts before, a after", () => {
    expect(result("foo", ["i", "Z"]).text).toBe("Zfoo");
    expect(result("foo", ["a", "Z"]).text).toBe("fZoo");
  });
  it("I and A insert at line start / end", () => {
    expect(result("  foo", ["I", "Z"]).text).toBe("  Zfoo");
    expect(result("foo bar", ["A", "!"]).text).toBe("foo bar!");
  });
  it("o and O open lines", () => {
    expect(result("foo\nbar", ["o", "Z"]).text).toBe("foo\nZ\nbar");
    expect(result("foo\nbar", ["O", "Z"]).text).toBe("Z\nfoo\nbar");
  });
  it("Escape returns to normal", () => {
    expect(run("foo", ["i", "Z", "Escape"]).mode).toBe("normal");
  });
});

describe("editing", () => {
  it("x and X delete characters", () => {
    expect(result("foo bar", "x").text).toBe("oo bar");
    expect(result("foo bar", "X", { row: 0, col: 6 }).text).toBe("foo br");
    expect(result("ab", "xx").text).toBe("");
  });
  it("r replaces a single character", () => {
    expect(result("foo bar", ["r", "Z"]).text).toBe("Zoo bar");
  });
});

describe("undo and redo", () => {
  it("u undoes the last command", () => {
    expect(result("foo bar", "xu").text).toBe("foo bar");
    expect(result("foo bar", "dd u".split(" ")).text).toBe("foo bar");
  });
  it("ctrl+r redoes", () => {
    expect(result("foo bar", ["x", "u", "ctrl+r"]).text).toBe("oo bar");
  });
  it("a new edit clears the redo stack", () => {
    expect(result("foo bar baz", ["x", "u", "x", "ctrl+r"]).text).toBe("oo bar baz");
  });
  it("an insert session is undone as one block", () => {
    expect(result("foo", ["i", "a", "b", "c", "Escape", "u"]).text).toBe("foo");
  });
});
