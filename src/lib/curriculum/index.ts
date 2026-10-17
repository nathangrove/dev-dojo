import { CATEGORIES } from "./data";
import type { Category, Drill, Lesson } from "./types";

export * from "./types";
export { CATEGORIES };

export interface LessonRef {
  category: Category;
  lesson: Lesson;
  drillCount: number;
}

export function allLessons(): LessonRef[] {
  return CATEGORIES.flatMap((category) =>
    category.lessons.map((lesson) => ({ category, lesson, drillCount: lesson.drills.length })),
  );
}

export function totalDrills(): number {
  return CATEGORIES.reduce(
    (sum, c) => sum + c.lessons.reduce((s, l) => s + l.drills.length, 0),
    0,
  );
}

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getLesson(slug: string): LessonRef | undefined {
  return allLessons().find((ref) => ref.lesson.slug === slug);
}

export function drillLessons(): { category: Category; lesson: Lesson }[] {
  return CATEGORIES.flatMap((category) => category.lessons.map((lesson) => ({ category, lesson })));
}

const TOKEN_RE = /<[^>]+>|[\s\S]/g;

/** Split a canonical solution string into individual key events. */
export function parseKeys(s: string): string[] {
  const tokens = s.match(TOKEN_RE) ?? [];
  return tokens.map((t) => {
    switch (t) {
      case "<Esc>":
        return "Escape";
      case "<C-r>":
        return "ctrl+r";
      case "<C-w>":
        return "ctrl+w";
      case "<Tab>":
        return "Tab";
      case "<Enter>":
      case "<CR>":
        return "Enter";
      case "<BS>":
        return "Backspace";
      default:
        return t;
    }
  });
}

/** Number of physical keystrokes a canonical solution needs. */
export function solutionLength(s: string): number {
  return (s.match(TOKEN_RE) ?? []).length;
}

export function drillCountInLesson(lesson: Lesson): number {
  return lesson.drills.length;
}

export function allDrills(): { category: Category; lesson: Lesson; drill: Drill }[] {
  return CATEGORIES.flatMap((category) =>
    category.lessons.flatMap((lesson) => lesson.drills.map((drill) => ({ category, lesson, drill }))),
  );
}
