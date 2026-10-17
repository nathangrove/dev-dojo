import { describe, expect, it } from "vitest";
import { isGoal, normalizeText, stateText, handleKey } from "../engine/vim";
import { createSeeded } from "../engine/session";
import { evaluateGoal } from "../engine/goals";
import type { Drill } from "./types";
import type { VimState } from "../engine/types";
import { allDrills, allLessons, parseKeys, solutionLength } from "./index";

function buildState(drill: Drill): VimState {
  return createSeeded(drill.initial, drill.files, drill.start, drill.startModified);
}

function applySolution(state: VimState, solution: string): VimState {
  let s = state;
  for (const key of parseKeys(solution)) s = handleKey(s, key);
  return s;
}

describe("curriculum validity", () => {
  const drills = allDrills();

  it("has a healthy number of drills", () => {
    expect(drills.length).toBeGreaterThanOrEqual(30);
  });

  it("uses unique drill ids and lesson slugs", () => {
    const ids = drills.map((d) => d.drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lessonSlugs = allLessons().map((ref) => ref.lesson.slug);
    expect(new Set(lessonSlugs).size).toBe(lessonSlugs.length);
  });

  it("every drill has exactly one goal type", () => {
    for (const { drill } of drills) {
      const goals = [
        drill.target !== undefined,
        drill.targetCursor !== undefined,
        drill.goal !== undefined,
      ].filter(Boolean);
      expect(goals.length, `drill ${drill.id}`).toBe(1);
    }
  });

  it("starts from a legal cursor position", () => {
    for (const { drill } of drills) {
      if (!drill.start) continue;
      const lines = drill.initial.split("\n");
      expect(drill.start.row, `drill ${drill.id} row`).toBeLessThan(lines.length);
      expect(drill.start.col, `drill ${drill.id} col`).toBeLessThanOrEqual(
        lines[drill.start.row].length,
      );
    }
  });

  it("is not already solved before the user does anything", () => {
    for (const { drill } of drills) {
      if (drill.mustUse) continue;
      const state = buildState(drill);
      if (drill.goal) {
        expect(evaluateGoal(state, drill.goal), `drill ${drill.id} starts solved`).toBe(false);
      } else if (drill.targetCursor) {
        const solved = state.row === drill.targetCursor.row && state.col === drill.targetCursor.col;
        expect(solved, `drill ${drill.id} starts solved`).toBe(false);
      } else if (drill.target) {
        expect(isGoal(state, drill.target), `drill ${drill.id} starts solved`).toBe(false);
      }
    }
  });

  it("every canonical solution reaches its goal", () => {
    for (const { drill } of drills) {
      const state = applySolution(buildState(drill), drill.solution);
      if (drill.goal) {
        expect(
          evaluateGoal(state, drill.goal),
          `drill ${drill.id} solution did not reach session goal (${drill.solution})`,
        ).toBe(true);
      } else if (drill.targetCursor) {
        expect(
          { row: state.row, col: state.col, mode: state.mode },
          `drill ${drill.id} solution ended at ${state.row},${state.col} (${state.mode})`,
        ).toMatchObject({ ...drill.targetCursor, mode: "normal" });
        expect(normalizeText(stateText(state)), `drill ${drill.id} text changed`).toBe(
          normalizeText(drill.initial),
        );
      } else if (drill.target) {
        expect(state.mode, `drill ${drill.id} not in normal mode`).toBe("normal");
        expect(normalizeText(stateText(state)), `drill ${drill.id} text mismatch`).toBe(
          normalizeText(drill.target),
        );
      }
    }
  });

  it("every mustUse key appears in its solution", () => {
    for (const { drill } of drills) {
      if (!drill.mustUse) continue;
      const keys = new Set(parseKeys(drill.solution));
      for (const required of drill.mustUse) {
        expect(keys.has(required), `drill ${drill.id} missing ${required}`).toBe(true);
      }
    }
  });

  it("solutions are reasonably short", () => {
    for (const { drill } of drills) {
      expect(solutionLength(drill.solution), `drill ${drill.id}`).toBeLessThan(40);
    }
  });
});
