import type { BaseDrill, Category, LessonRef, Track } from "./types";
import { VIM_TRACK } from "@/lib/tools/vim";
import { TMUX_TRACK } from "@/lib/tools/tmux";

export * from "./types";
export * from "./tokens";

/** Every track, in display order. */
export const TRACKS: Track[] = [VIM_TRACK, TMUX_TRACK];

export function allTracks(): Track[] {
  return TRACKS;
}

export function getTrack(slug: string): Track | undefined {
  return TRACKS.find((t) => t.slug === slug);
}

export function getCategory(tool: string, slug: string): Category | undefined {
  return getTrack(tool)?.categories.find((c) => c.slug === slug);
}

export function allLessons(): LessonRef[] {
  return TRACKS.flatMap((track) =>
    track.categories.flatMap((category) =>
      category.lessons.map((lesson) => ({
        track,
        category,
        lesson,
        drillCount: lesson.drills.length,
      })),
    ),
  );
}

export function getLesson(tool: string, slug: string): LessonRef | undefined {
  return allLessons().find((ref) => ref.track.slug === tool && ref.lesson.slug === slug);
}

export interface DrillRef {
  track: Track;
  category: Category;
  lesson: LessonRef["lesson"];
  drill: BaseDrill;
}

export function allDrills(): DrillRef[] {
  return TRACKS.flatMap((track) =>
    track.categories.flatMap((category) =>
      category.lessons.flatMap((lesson) =>
        lesson.drills.map((drill) => ({ track, category, lesson, drill })),
      ),
    ),
  );
}

export function totalDrills(): number {
  return allDrills().length;
}

/** Flat list of every drill id across all tracks (for aggregate progress). */
export function allDrillIds(): string[] {
  return allDrills().map((d) => d.drill.id);
}

/** Ids for one track. */
export function trackDrillIds(track: Track): string[] {
  return track.categories.flatMap((c) => c.lessons.flatMap((l) => l.drills.map((d) => d.id)));
}
