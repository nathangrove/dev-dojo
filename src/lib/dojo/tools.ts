"use client";

import type { Tool } from "./tool";
import { vimTool } from "@/lib/tools/vim/tool";
import { tmuxTool } from "@/lib/tools/tmux/tool";
import { gitTool } from "@/lib/tools/git/tool";

/** Every available tool adapter, keyed by slug. Client-only: holds components. */
export const TOOLS: Record<string, Tool> = {
  [vimTool.slug]: vimTool,
  [tmuxTool.slug]: tmuxTool,
  [gitTool.slug]: gitTool,
};

export function getTool(slug: string): Tool | undefined {
  return TOOLS[slug];
}
