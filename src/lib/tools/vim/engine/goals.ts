import type { VimGoal } from "../types";
import { activeBuffer, activeTab } from "./session";
import type { SplitNode, VimState } from "./types";

export function evaluateGoal(state: VimState, goal: VimGoal): boolean {
  switch (goal.kind) {
    case "windowCount":
      return countWindows(state) === goal.count;
    case "activeFile":
      return activeBuffer(state).name === goal.name;
    case "openFiles": {
      const names = state.buffers.map((b) => b.name).sort();
      return names.length === goal.names.length && names.every((n, i) => n === [...goal.names].sort()[i]);
    }
    case "savedFiles":
      return goal.names.every((n) => {
        const b = state.buffers.find((x) => x.name === n);
        return b !== undefined && !b.modified;
      });
    case "modifiedCount":
      return state.buffers.filter((b) => b.modified).length === goal.count;
    case "tabCount":
      return state.tabs.length === goal.count;
    case "activeTab":
      return state.activeTab === goal.index;
    case "register": {
      const r = goal.name === '"' ? state.register : state.registers[goal.name];
      return !!r && r.lines.join("\n") === goal.text;
    }
    case "cursorInFile":
      return (
        activeBuffer(state).name === goal.name &&
        state.row === goal.row &&
        state.col === goal.col
      );
    default:
      return false;
  }
}

export function countWindows(state: VimState): number {
  const walk = (node: SplitNode): number =>
    node.kind === "leaf" ? 1 : node.children.reduce((a, c) => a + walk(c), 0);
  return walk(activeTab(state).layout);
}

export function describeGoal(goal: VimGoal): string {
  switch (goal.kind) {
    case "windowCount":
      return `${goal.count} window${goal.count === 1 ? "" : "s"} open`;
    case "activeFile":
      return `Active file is ${goal.name}`;
    case "openFiles":
      return `Open files: ${goal.names.join(", ")}`;
    case "savedFiles":
      return `These files are saved: ${goal.names.join(", ")}`;
    case "modifiedCount":
      return `${goal.count} unsaved buffer${goal.count === 1 ? "" : "s"}`;
    case "tabCount":
      return `${goal.count} tab${goal.count === 1 ? "" : "s"} open`;
    case "activeTab":
      return `Active tab is #${goal.index + 1}`;
    case "register":
      return `Register "${goal.name}" holds: ${goal.text}`;
    case "cursorInFile":
      return `Cursor is in ${goal.name} at line ${goal.row + 1}, col ${goal.col}`;
    default:
      return "";
  }
}

export function isSessionDrill(goal: VimGoal | undefined): boolean {
  return goal !== undefined;
}
