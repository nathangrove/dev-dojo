/** Shared, tool-agnostic curriculum types for every dev-dojo track. */

export interface KeyRef {
  keys: string;
  meaning: string;
}

/** Every drill in every tool has at least these fields. */
export interface BaseDrill {
  id: string;
  prompt: string;
  /** canonical solution string (keys for keystroke tools, commands for REPL tools) */
  solution: string;
  /** inputs that must appear in the user's session for the drill to count as solved */
  mustUse?: string[];
}

export interface Lesson<D extends BaseDrill = BaseDrill> {
  slug: string;
  title: string;
  tagline: string;
  concept: string;
  keys: KeyRef[];
  drills: D[];
}

export interface Category<D extends BaseDrill = BaseDrill> {
  slug: string;
  title: string;
  /** one-line summary shown on track home cards */
  blurb: string;
  /** longer "why it matters" explanation shown on the category page */
  overview: string;
  accent: string;
  lessons: Lesson<D>[];
}

/** A tool is a top-level track: vim, tmux, git, … */
export interface Track<D extends BaseDrill = BaseDrill> {
  slug: string;
  title: string;
  blurb: string;
  /** short monospace badge shown on track cards (e.g. "hjkl", "C-b", "git") */
  badge: string;
  accent: string;
  /** "available" tracks are fully wired; others show as coming soon */
  status?: "available" | "coming-soon";
  categories: Category<D>[];
}

export interface LessonRef<D extends BaseDrill = BaseDrill> {
  track: Track<D>;
  category: Category<D>;
  lesson: Lesson<D>;
  drillCount: number;
}
