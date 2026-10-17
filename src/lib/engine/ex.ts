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
  const buffers = s.buffers.map((b) => (b.id === buf.id ? { ...b, modified: false } : b));
  return msg({ ...s, buffers }, `"${buf.name}" ${buf.lines.length}L written`);
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
      if (!arg) return msg(state, "E32: No file name");
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
      return msg(state, "Vim Dojo has no help — you are the help.");
    default:
      return msg(state, `E492: Not an editor command: ${rawCmd}`);
  }
}

/** Ex commands exposed for autocomplete / hints. */
export const EX_COMMANDS = [
  "w", "wa", "wq", "x", "q", "q!", "wqa",
  "e", "sp", "vsp", "bn", "bp", "ls", "bd",
  "tabnew", "tabclose", "tabnext", "tabprevious",
  "reg", "marks",
] as const;

export { activeTab };
