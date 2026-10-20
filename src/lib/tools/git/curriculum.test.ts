import { describe, expect, it } from "vitest";
import { solutionLength } from "@/lib/dojo/tokens";
import { createInitialGit, evaluateGitGoal, handleGitKey } from "./engine";
import type { GitState } from "./types";
import { GIT_CATEGORIES } from "./curriculum";

const drills = GIT_CATEGORIES.flatMap((category) =>
  category.lessons.flatMap((lesson) =>
    lesson.drills.map((drill) => ({ category, lesson, drill })),
  ),
);

function applySolution(state: GitState, solution: string): GitState {
  let s = state;
  for (const ch of solution) s = handleGitKey(s, ch);
  return handleGitKey(s, "Enter");
}

describe("git curriculum validity", () => {
  it("has a healthy number of drills", () => {
    expect(drills.length).toBeGreaterThanOrEqual(12);
  });

  it("uses unique drill ids and lesson slugs", () => {
    const ids = drills.map((d) => d.drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = GIT_CATEGORIES.flatMap((c) => c.lessons.map((l) => l.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every drill declares a goal", () => {
    for (const { drill } of drills) {
      expect(drill.goal, `drill ${drill.id}`).toBeDefined();
    }
  });

  it("is not already solved before the user does anything", () => {
    for (const { drill } of drills) {
      const state = createInitialGit(drill);
      expect(evaluateGitGoal(state, drill.goal), `drill ${drill.id} starts solved`).toBe(false);
    }
  });

  it("every canonical solution reaches its goal", () => {
    for (const { drill } of drills) {
      const state = applySolution(createInitialGit(drill), drill.solution);
      expect(
        evaluateGitGoal(state, drill.goal),
        `drill ${drill.id}: "${drill.solution}" did not reach goal`,
      ).toBe(true);
    }
  });

  it("solutions are reasonably short", () => {
    for (const { drill } of drills) {
      expect(solutionLength(drill.solution), `drill ${drill.id}`).toBeLessThan(40);
    }
  });
});
