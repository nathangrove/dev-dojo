"use client";

import type { BaseDrill } from "@/lib/dojo/types";
import type { AttemptResult } from "@/lib/progress";
import { getTool } from "@/lib/dojo/tools";
import Practice from "./Practice";

interface ToolRunnerProps {
  toolSlug: string;
  drill: BaseDrill;
  drillNumber: number;
  drillTotal: number;
  onSolved?: (result: AttemptResult) => void;
  onNext?: () => void;
  isLast?: boolean;
}

export default function ToolRunner({ toolSlug, ...rest }: ToolRunnerProps) {
  const tool = getTool(toolSlug);
  if (!tool) {
    return (
      <div className="rounded-lg border border-red/40 bg-red/10 px-4 py-3 text-xs text-red">
        No simulator registered for “{toolSlug}”.
      </div>
    );
  }
  return <Practice tool={tool} {...rest} />;
}
