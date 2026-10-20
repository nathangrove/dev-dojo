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

describe("character search", () => {
  it("f jumps to the next character and t stops before it", () => {
    expect(result("abcdefxgh", "fx").col).toBe(6);
    expect(result("call(arg)", "t)").col).toBe(7);
    expect(result("abcdefxgh", "fz").col).toBe(0);
  });

  it("F and T jump backward", () => {
    expect(result("one two", "Fo", { row: 0, col: 6 }).col).toBe(0);
    expect(result("a-b-c-d", "Tb", { row: 0, col: 6 }).col).toBe(3);
  });

  it("; repeats and , reverses the search", () => {
    expect(result("axbxc", "fx;").col).toBe(3);
    expect(result("a.b.c", "f.;,").col).toBe(1);
  });

  it("works as an operator motion", () => {
    expect(result("keep(remove)", "f(dt)").text).toBe("keep)");
    expect(result("one two", "dt ").text).toBe(" two");
  });
});

describe("search", () => {
  const keys = (s: string) => ["/", ...s.split(""), "Enter"];
  const back = (s: string) => ["?", ...s.split(""), "Enter"];

  it("/ searches forward and ? searches backward", () => {
    const text = "the cat\nthe fox\nthe dog";
    expect(result(text, keys("fox"))).toMatchObject({ row: 1, col: 4 });
    expect(result(text, back("cat"), { row: 2, col: 0 })).toMatchObject({ row: 0, col: 4 });
  });

  it("n and N repeat the search", () => {
    const text = "the cat\nthe fox\nthe dog";
    expect(result(text, [...keys("the"), "n"])).toMatchObject({ row: 2, col: 0 });
    expect(result(text, [...keys("the"), "n", "N"])).toMatchObject({ row: 1, col: 0 });
  });

  it("wraps around the buffer", () => {
    const text = "dog one\ncat two\ndog three";
    expect(result(text, keys("dog"), { row: 2, col: 0 })).toMatchObject({ row: 0, col: 0 });
  });
});

describe("text objects", () => {
  it("ciw changes the word under the cursor", () => {
    const s = run("the quick fox", ["c", "i", "w", "s", "l", "o", "w", "Escape"], {
      row: 0,
      col: 4,
    });
    expect(stateText(s)).toBe("the slow fox");
    expect(s.mode).toBe("normal");
  });

  it("daw deletes a word plus its trailing space", () => {
    expect(result("one two three", "daw", { row: 0, col: 4 }).text).toBe("one three");
    expect(result("one two three", "diw", { row: 0, col: 4 }).text).toBe("one  three");
  });

  it("quote objects work inside and around", () => {
    expect(result('name = "secret";', 'di"', { row: 0, col: 9 }).text).toBe('name = "";');
    expect(result('say "hello" now', 'da"', { row: 0, col: 6 }).text).toBe("say  now");
  });

  it("paren objects work inside and around", () => {
    expect(result("call(remove me)", "ci(", { row: 0, col: 6 }).text).toBe("call()");
    expect(result("f(abc) rest", "da(", { row: 0, col: 3 }).text).toBe("f rest");
  });

  it("extends a visual selection", () => {
    expect(result('say "hello" now', ["v", "i", '"', "d"], { row: 0, col: 7 }).text).toBe(
      'say "" now',
    );
  });
});

describe("visual mode", () => {
  it("v selects characterwise and d deletes the selection", () => {
    expect(result("abcdef", "vlld").text).toBe("def");
    expect(result("keep remove", ["v", "$", "d"], { row: 0, col: 5 }).text).toBe("keep ");
  });

  it("V selects whole lines", () => {
    expect(result("one\ntwo\nthree", "Vd").text).toBe("two\nthree");
    expect(result("one\ntwo\nthree\nfour", "Vjd").text).toBe("three\nfour");
  });

  it("visual yank and change work", () => {
    expect(result("a\nb\nc", "Vjyp").text).toBe("a\nb\na\nb\nc");
    expect(result("small cat", ["v", "e", "c", "b", "i", "g", "Escape"]).text).toBe("big cat");
  });
});

describe("repeat with dot", () => {
  it("repeats the last text change", () => {
    expect(result("one two three", "dw.").text).toBe("three");
    expect(result("a\nb\nc\nd", "2dd.").text).toBe("");
  });

  it("repeats changes that include inserted text", () => {
    expect(result("red green blue", ["c", "w", "b", "l", "u", "e", "Escape", "w", "."]).text).toBe(
      "blue blue blue",
    );
  });

  it("does not treat plain motions as changes", () => {
    expect(result("one two three", "w.").text).toBe("one two three");
  });
});

describe("macros", () => {
  it("records and replays with q and @", () => {
    expect(result("one two three", ["q", "a", "d", "w", "q", "@", "a"]).text).toBe("three");
  });

  it("replays the last macro with @@", () => {
    const s = run("one\ntwo\nthree", [
      "q", "a", "A", "!", "Escape", "q", "j", "@", "a", "j", "@", "@",
    ]);
    expect(stateText(s)).toBe("one!\ntwo!\nthree!");
  });

  it("records insert-mode text", () => {
    expect(result("foo\nbar", ["q", "a", "A", "!", "Escape", "q", "j", "@", "a"]).text).toBe(
      "foo!\nbar!",
    );
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


const NAMED_KEYS = new Set([
  "Escape", "Enter", "Tab", "Backspace",
  "ctrl+o", "ctrl+i", "ctrl+d", "ctrl+u", "ctrl+r", "ctrl+w",
]);

function runKeys(s: VimState, ...ks: string[]): VimState {
  const expanded = ks.flatMap((k) => (NAMED_KEYS.has(k) || k.length <= 1 ? [k] : [...k]));
  return expanded.reduce((acc, k) => handleKey(acc, k), s);
}

describe("new vim commands", () => {
  it("W skips punctuation words", () => {
    let s = createState("foo-bar baz");
    s = runKeys(s, "W");
    expect([s.row, s.col]).toEqual([0, 8]);
    s = runKeys(s, "W");
    expect(s.col).toBe(10); // clamped to last char of "baz"
    s = runKeys(s, "B");
    expect(s.col).toBe(8);
  });

  it("J joins lines with a space", () => {
    let s = createState("hello\n  world");
    s = runKeys(s, "J");
    expect(stateText(s)).toBe("hello world");
    expect([s.row, s.col]).toEqual([0, 5]);
  });

  it("J with count joins several lines", () => {
    let s = createState("a\nb\nc\nd");
    s = runKeys(s, "2J");
    expect(stateText(s)).toBe("a b c\nd");
  });

  it("s substitutes char and enters insert", () => {
    let s = createState("cat");
    s = runKeys(s, "l", "s", "u", "Escape");
    expect(stateText(s)).toBe("cut");
  });

  it("S substitutes the line", () => {
    let s = createState("cat\ndog");
    s = runKeys(s, "S", "bird", "Escape");
    expect(stateText(s)).toBe("bird\ndog");
  });

  it("~ toggles case and advances", () => {
    let s = createState("abc");
    s = runKeys(s, "~");
    expect(stateText(s)).toBe("Abc");
    expect(s.col).toBe(1);
    s = runKeys(s, "3~");
    expect(stateText(s)).toBe("ABC");
  });

  it(">> indents, << outdents", () => {
    let s = createState("foo\nbar");
    s = runKeys(s, ">>");
    expect(stateText(s)).toBe("  foo\nbar");
    expect(s.col).toBe(2);
    s = runKeys(s, "<<");
    expect(stateText(s)).toBe("foo\nbar");
  });

  it("> motion indents covered lines", () => {
    let s = createState("a\nb\nc\nd");
    s = runKeys(s, "2>j");
    expect(stateText(s)).toBe("  a\n  b\nc\nd");
  });

  it("gUiw uppercases a word", () => {
    let s = createState("hello world");
    s = runKeys(s, "g", "U", "i", "w");
    expect(stateText(s)).toBe("HELLO world");
  });

  it("gUU uppercases the line", () => {
    let s = createState("hello world");
    s = runKeys(s, "g", "U", "U");
    expect(stateText(s)).toBe("HELLO WORLD");
  });

  it("guu lowercases the line", () => {
    let s = createState("HELLO");
    s = runKeys(s, "g", "u", "u");
    expect(stateText(s)).toBe("hello");
  });

  it("guw lowercases a word", () => {
    let s = createState("HELLO world");
    s = runKeys(s, "g", "u", "w");
    expect(stateText(s)).toBe("hello world");
  });

  it("% jumps to matching bracket", () => {
    let s = createState("foo(bar)baz");
    s = runKeys(s, "l", "l", "l", "%");
    expect(s.col).toBe(7);
    s = runKeys(s, "%");
    expect(s.col).toBe(3);
  });

  it("d% deletes to and including the match", () => {
    let s = createState("x(foo)y");
    s = runKeys(s, "l", "d", "%");
    expect(stateText(s)).toBe("xy");
  });

  it("* searches word under cursor", () => {
    let s = createState("alpha beta\ngamma alpha\ndelta");
    s = runKeys(s, "*");
    expect([s.row, s.col]).toEqual([1, 6]);
    s = runKeys(s, "n");
    expect([s.row, s.col]).toEqual([0, 0]); // wraps around
  });

  it("d} deletes to next paragraph", () => {
    let s = createState("one\ntwo\n\nthree\nfour");
    s = runKeys(s, "d", "}");
    expect(stateText(s)).toBe("\nthree\nfour");
  });

  it("ctrl-o returns to previous jump", () => {
    let s = createState("a\nb\nc\nd\ne");
    s = runKeys(s, "G");
    expect(s.row).toBe(4);
    s = runKeys(s, "ctrl+o");
    expect(s.row).toBe(0);
    s = runKeys(s, "ctrl+i");
    expect(s.row).toBe(4);
  });

  it("H/M/L move cursor within viewport", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line${i}`).join("\n");
    let s = createState(text);
    s = runKeys(s, "G");
    expect(s.topRow).toBe(20);
    s = runKeys(s, "H");
    expect(s.row).toBe(20);
    s = runKeys(s, "L");
    expect(s.row).toBe(39);
    s = runKeys(s, "M");
    expect(s.row).toBe(30); // topRow 20 + half of 20-line screen
  });

  it("zz centers the cursor", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line${i}`).join("\n");
    let s = createState(text);
    s = runKeys(s, "20G");
    expect(s.row).toBe(19);
    s = runKeys(s, "z", "z");
    expect(s.topRow).toBe(9);
    expect(s.row).toBe(19);
  });

  it("ctrl-d / ctrl-u move half a page", () => {
    const text = Array.from({ length: 60 }, (_, i) => `line${i}`).join("\n");
    let s = createState(text);
    s = runKeys(s, "ctrl+d");
    expect(s.row).toBe(10);
    s = runKeys(s, "ctrl+u");
    expect(s.row).toBe(0);
  });

  it("i{ works as a text object", () => {
    let s = createState("foo(bar)baz");
    s = runKeys(s, "l", "v", "i", "b");
    // visual selection from ( to )
    expect(s.mode).toBe("visual");
  });

  it("visual U uppercases selection", () => {
    let s = createState("hello world");
    s = runKeys(s, "v", "w", "U");
    expect(stateText(s)).toBe("HELLO World"); // inclusive selection includes the w
  });

  it("visual > indents selection lines", () => {
    let s = createState("a\nb\nc");
    s = runKeys(s, "V", "j", ">");
    expect(stateText(s)).toBe("  a\n  b\nc");
  });
});
