import { describe, expect, it } from "vitest";
import { parseKeys, solutionLength } from "@/lib/dojo/tokens";
import { createInitialTmux, evaluateTmuxGoal, handleTmuxKey } from "./engine";
import type { TmuxDrill, TmuxState } from "./types";
import { TMUX_CATEGORIES } from "./curriculum";

const drills = TMUX_CATEGORIES.flatMap((category) =>
  category.lessons.flatMap((lesson) =>
    lesson.drills.map((drill) => ({ category, lesson, drill })),
  ),
);

function buildState(drill: TmuxDrill): TmuxState {
  return createInitialTmux(drill);
}

function applySolution(state: TmuxState, solution: string): TmuxState {
  let s = state;
  for (const key of parseKeys(solution)) s = handleTmuxKey(s, key);
  return s;
}

describe("tmux curriculum validity", () => {
  it("has a healthy number of drills", () => {
    expect(drills.length).toBeGreaterThanOrEqual(20);
  });

  it("uses unique drill ids and lesson slugs", () => {
    const ids = drills.map((d) => d.drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lessonSlugs = TMUX_CATEGORIES.flatMap((c) => c.lessons.map((l) => l.slug));
    expect(new Set(lessonSlugs).size).toBe(lessonSlugs.length);
  });

  it("every drill has exactly one goal", () => {
    for (const { drill } of drills) {
      expect(drill.goal, `drill ${drill.id}`).toBeDefined();
    }
  });

  it("is not already solved before the user does anything", () => {
    for (const { drill } of drills) {
      if (drill.mustUse) continue;
      const state = buildState(drill);
      expect(
        evaluateTmuxGoal(state, drill.goal),
        `drill ${drill.id} starts solved`,
      ).toBe(false);
    }
  });

  it("every canonical solution reaches its goal", () => {
    for (const { drill } of drills) {
      const state = applySolution(buildState(drill), drill.solution);
      expect(
        evaluateTmuxGoal(state, drill.goal),
        `drill ${drill.id} solution did not reach goal (${drill.solution})`,
      ).toBe(true);
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
