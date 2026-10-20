import type { Track } from "@/lib/dojo/types";
import { GIT_CATEGORIES } from "./curriculum";
import type { GitDrill } from "./types";

export { GIT_CATEGORIES } from "./curriculum";
export * from "./types";

export const GIT_TRACK: Track<GitDrill> = {
  slug: "git",
  title: "Git",
  badge: "git",
  blurb:
    "Version control from the command line — track, stage, commit, branch and inspect history.",
  accent: "#f7768e",
  status: "available",
  categories: GIT_CATEGORIES,
};
