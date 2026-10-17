import type { Track } from "@/lib/dojo/types";
import { VIM_CATEGORIES } from "./curriculum";
import type { VimDrill } from "./types";

export { VIM_CATEGORIES } from "./curriculum";
export * from "./types";

export const VIM_TRACK: Track<VimDrill> = {
  slug: "vim",
  title: "Vim",
  badge: "hjkl",
  blurb: "Modal editing at the speed of thought — motions, operators, windows, buffers and more.",
  accent: "#7aa2f7",
  status: "available",
  categories: VIM_CATEGORIES,
};
