import type { VimState } from "./types";
import {
  activeBuffer,
  activeTab,
  activeWindow,
  addSplit,
  bufferByName,
  closeActiveWindow,
  closeTab,
  findBuffer,
  forceCloseActiveWindow,
  newTab,
  nextBuffer,
  NO_NAME,
  openFile,
  switchTab,
  switchToBuffer,
} from "./session";

function msg(state: VimState, statusMessage: string): VimState {
  return { ...state, statusMessage };
}

/** Write the active buffer to disk (modelled as clearing its modified flag). */
function writeBuffer(state: VimState, file?: string): VimState {
  const s = file ? renameActive(state, file) : state;
  const buf = activeBuffer(s);
  if (buf.name === NO_NAME && !file) {
    return msg(s, "E32: No file name");
  }
  const buffers = s.buffers.map((b) =>
    b.id === buf.id ? { ...b, original: [...buf.lines], modified: false } : b,
  );
  return msg({ ...s, buffers }, `"${buf.name}" ${buf.lines.length}L written`);
}

/** `:e!` — reload the active buffer from disk, dropping unsaved edits. */
function reloadBuffer(state: VimState): VimState {
  const win = activeWindow(state);
  const buf = findBuffer(state, win.bufferId);
  if (!buf) return state;
  const lines = [...buf.original];
  const buffers = state.buffers.map((b) =>
    b.id === buf.id ? { ...b, lines, modified: false, undoStack: [], redoStack: [] } : b,
  );
  return msg(
    { ...state, buffers, lines, row: 0, col: 0, desiredCol: 0, undoStack: [], redoStack: [] },
    `"${buf.name}" reloaded`,
  );
}

/** `:s/old/new/[g]` and `:%s/old/new/[g]`. `spec` starts at the delimiter. */
function substitute(state: VimState, spec: string, wholeFile: boolean): VimState {
  const delim = spec[0];
  if (!delim || /[A-Za-z0-9\\]/.test(delim)) {
    return msg(state, "E492: Not an editor command: s");
  }
  const parts = spec.slice(1).split(delim);
  const search = parts[0] ?? "";
  const replacement = parts[1] ?? "";
  const flags = parts[2] ?? "";
  if (!search) return msg(state, "E486: Pattern not found");

  const global = flags.includes("g");
  const lines = [...state.lines];
  const rows = wholeFile ? lines.map((_, i) => i) : [state.row];
  let count = 0;

  for (const r of rows) {
    const line = lines[r];
    if (!line.includes(search)) continue;
    if (global) {
      count += line.split(search).length - 1;
      lines[r] = line.split(search).join(replacement);
    } else {
      const at = line.indexOf(search);
      count += 1;
      lines[r] = line.slice(0, at) + replacement + line.slice(at + search.length);
    }
  }

  if (count === 0) return msg(state, "E486: Pattern not found");
  const snapshot = { lines: [...state.lines], row: state.row, col: state.col };
  const row = Math.min(state.row, lines.length - 1);
  const col = Math.min(state.col, Math.max(0, lines[row].length - 1));
  return msg(
    {
      ...state,
      lines,
      row,
      col,
      desiredCol: col,
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
      edits: state.edits + 1,
    },
    `${count} substitution${count === 1 ? "" : "s"}`,
  );
}

function renameActive(state: VimState, file: string): VimState {
  const win = activeWindow(state);
  const buffers = state.buffers.map((b) => (b.id === win.bufferId ? { ...b, name: file } : b));
  return { ...state, buffers };
}

function editFile(state: VimState, file: string, force: boolean): VimState {
  const s = state;
  if (activeBuffer(s).modified && !force) {
    return msg(s, "E37: No write since last change (add ! to override)");
  }
  const { state: opened, bufferId } = openFile(s, file);
  return switchToBuffer({ ...opened, statusMessage: `"${file}"` }, bufferId);
}

function deleteBuffer(state: VimState): VimState {
  const s = state;
  if (s.buffers.length === 1) return msg(s, 'E85: There is no listed buffer');
  const cur = activeWindow(s).bufferId;
  const remaining = s.buffers.filter((b) => b.id !== cur);
  const winIds = new Set(s.windows.map((w) => w.id));
  // point every window that showed the deleted buffer at another buffer
  const fallback = remaining[0].id;
  const windows = s.windows.map((w) => (w.bufferId === cur ? { ...w, bufferId: fallback } : w));
  const next: VimState = { ...s, buffers: remaining, windows };
  void winIds;
  return switchToBuffer(next, activeWindow(next).bufferId);
}

function listBuffers(state: VimState): VimState {
  const active = activeWindow(state).bufferId;
  const parts = state.buffers.map((b) => {
    const marker = b.id === active ? "%" : " ";
    const mod = b.modified ? "+" : " ";
    return `${marker}${mod}${b.id} "${b.name}"`;
  });
  return msg(state, parts.join("  "));
}

function listRegisters(state: VimState): VimState {
  const names = Object.keys(state.registers).sort();
  const parts: string[] = [];
  if (state.register) parts.push(`""  ${state.register.lines.join("\\n")}`);
  for (const n of names) {
    const r = state.registers[n];
    parts.push(`"${n}  ${r.lines.join("\\n")}`);
  }
  return msg(state, parts.length ? parts.join("   ") : "--- Registers ---");
}

function listMarks(state: VimState): VimState {
  const names = Object.keys(state.marks).sort();
  if (!names.length) return msg(state, "No marks set");
  const parts = names.map((n) => {
    const m = state.marks[n];
    const buf = findBuffer(state, m.bufferId);
    return `${n}  ${buf?.name ?? "?"}  line ${m.row + 1}`;
  });
  return msg(state, parts.join("   "));
}

/** Execute an Ex command. `input` includes the leading ':'. */
export function executeEx(state: VimState, input: string): VimState {
  let body = input.startsWith(":") ? input.slice(1) : input;
  body = body.trim();
  if (body === "") return msg(state, "");

  let bang = body.endsWith("!");
  if (bang) body = body.slice(0, -1).trim();

  // split command from argument at first whitespace
  const m = body.match(/^(\S+)\s*(.*)$/);
  if (!m) return msg(state, "");
  let rawCmd = m[1];
  const arg = m[2].trim();
  // the bang may be attached to the command word, e.g. `:e! file`
  if (rawCmd.endsWith("!")) {
    bang = true;
    rawCmd = rawCmd.slice(0, -1);
  }

  // `:%s/old/new/g` — the % range runs the command on every line
  let wholeFile = false;
  if (rawCmd.startsWith("%")) {
    wholeFile = true;
    rawCmd = rawCmd.slice(1);
    if (!rawCmd) return msg(state, "");
  }
  // substitute: `s/old/new/` or `s!old!new!`
  if (rawCmd === "s") return substitute(state, arg, wholeFile);
  if (rawCmd.length > 1 && rawCmd[0] === "s" && !/[A-Za-z0-9]/.test(rawCmd[1])) {
    return substitute(state, rawCmd.slice(1), wholeFile);
  }

  switch (rawCmd) {
    case "w":
      return writeBuffer(state, arg || undefined);
    case "wa":
    case "wall": {
      const buffers = state.buffers.map((b) => ({ ...b, modified: false }));
      return msg({ ...state, buffers }, "All files written");
    }
    case "wq":
    case "x":
      return closeActiveWindow(writeBuffer(state, arg || undefined));
    case "q":
      if (activeBuffer(state).modified && !bang) {
        return msg(state, "E37: No write since last change (add ! to override)");
      }
      return bang ? forceCloseActiveWindow(state) : closeActiveWindow(state);
    case "qa":
    case "quit":
      return msg(state, "E37: No write since last change (use :wqa to write all)");
    case "wqa":
    case "wqall": {
      const buffers = state.buffers.map((b) => ({ ...b, modified: false }));
      return msg({ ...state, buffers }, "All files written");
    }
    case "e":
    case "edit":
      if (!arg) {
        if (bang) return reloadBuffer(state);
        return msg(state, "E32: No file name");
      }
      return editFile(state, arg, bang);
    case "sp":
    case "split":
      return addSplit(state, "col", arg || undefined);
    case "vs":
    case "vsp":
    case "vsplit":
      return addSplit(state, "row", arg || undefined);
    case "bn":
    case "bnext":
      return nextBuffer(state, 1);
    case "bp":
    case "bprevious":
      return nextBuffer(state, -1);
    case "b": {
      if (!arg) return msg(state, "E93: No buffer specified");
      const byId = Number.parseInt(arg, 10);
      const target = Number.isNaN(byId)
        ? bufferByName(state, arg)
        : findBuffer(state, byId);
      if (!target) return msg(state, `E94: No matching buffer for ${arg}`);
      return switchToBuffer(state, target.id);
    }
    case "bd":
    case "bdelete":
      return deleteBuffer(state);
    case "ls":
    case "buffers":
    case "files":
      return listBuffers(state);
    case "tabnew":
    case "tabedit":
      return newTab(state, arg || undefined);
    case "tabclose":
      return closeTab(state);
    case "tabn":
    case "tabnext":
      return switchTab(state, state.activeTab + 1);
    case "tabp":
    case "tabprevious":
      return switchTab(state, state.activeTab - 1);
    case "tabonly":
      return msg(state, "Tab pages reduced");
    case "tabs":
      return msg(
        state,
        state.tabs
          .map((t, i) => `${i + 1}${i === state.activeTab ? "%" : ""} [active window ${t.activeWindowId}]`)
          .join("   "),
      );
    case "reg":
    case "registers":
      return listRegisters(state);
    case "marks":
      return listMarks(state);
    case "n":
    case "next":
      return nextBuffer(state, 1);
    case "prev":
    case "previous":
      return nextBuffer(state, -1);
    case "argadd":
      return msg(state, `Adding ${arg} to argument list`);
    case "args":
      return listBuffers(state);
    case "set":
      return msg(state, `set ${arg}`);
    case "help":
      return msg(state, "Dev Dojo has no help — you are the help.");
    default:
      return msg(state, `E492: Not an editor command: ${rawCmd}`);
  }
}

/** Ex commands exposed for autocomplete / hints. */
export const EX_COMMANDS = [
  "w", "wa", "wq", "x", "q", "q!", "wqa",
  "e", "e!", "sp", "vsp", "s", "%s", "bn", "bp", "ls", "bd",
  "tabnew", "tabclose", "tabnext", "tabprevious",
  "reg", "marks",
] as const;

export { activeTab };
