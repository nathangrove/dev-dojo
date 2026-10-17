import type { Track } from "@/lib/dojo/types";
import { TMUX_CATEGORIES } from "./curriculum";
import type { TmuxDrill } from "./types";

export { TMUX_CATEGORIES } from "./curriculum";
export * from "./types";

export const TMUX_TRACK: Track<TmuxDrill> = {
  slug: "tmux",
  title: "tmux",
  badge: "C-b",
  blurb:
    "Sessions, windows and panes — keep many terminals under control from one keyboard.",
  accent: "#9ece6a",
  status: "available",
  categories: TMUX_CATEGORIES,
};
