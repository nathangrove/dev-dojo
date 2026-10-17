import { describe, expect, it } from "vitest";
import { TRACKS, allDrills, allLessons, getCategory, getLesson, getTrack } from "./index";

describe("dojo registry", () => {
  it("has at least one track", () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(1);
  });

  it("uses unique track slugs", () => {
    const slugs = TRACKS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every track has the required display fields", () => {
    for (const track of TRACKS) {
      expect(track.title, `track ${track.slug}`).toBeTruthy();
      expect(track.blurb, `track ${track.slug}`).toBeTruthy();
      expect(track.badge, `track ${track.slug}`).toBeTruthy();
      expect(track.accent, `track ${track.slug}`).toMatch(/^#/);
    }
  });

  it("drill ids are globally unique across all tracks", () => {
    const ids = allDrills().map((d) => d.drill.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate drill ids: ${[...new Set(dupes)].join(", ")}`).toEqual([]);
  });

  it("lesson slugs are unique within each track", () => {
    for (const track of TRACKS) {
      const slugs = track.categories.flatMap((c) => c.lessons.map((l) => l.slug));
      expect(new Set(slugs).size, `track ${track.slug}`).toBe(slugs.length);
    }
  });

  it("lookups resolve by tool slug", () => {
    const vim = getTrack("vim");
    expect(vim).toBeDefined();
    const firstLesson = allLessons().find((r) => r.track.slug === "vim");
    expect(firstLesson).toBeDefined();
    if (firstLesson && vim) {
      expect(getLesson("vim", firstLesson.lesson.slug)?.lesson.slug).toBe(firstLesson.lesson.slug);
      const cat = vim.categories[0];
      expect(getCategory("vim", cat.slug)?.slug).toBe(cat.slug);
    }
    expect(getLesson("vim", "does-not-exist")).toBeUndefined();
  });
});
