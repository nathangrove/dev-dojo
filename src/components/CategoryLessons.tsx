"use client";

import { Link } from "react-router-dom";
import type { Category } from "@/lib/dojo";
import { useProgress, computeLessonProgress } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

export default function CategoryLessons({
  toolSlug,
  category,
}: {
  toolSlug: string;
  category: Category;
}) {
  const { progress } = useProgress();

  const ids = category.lessons.flatMap((l) => l.drills.map((d) => d.id));
  const total = computeLessonProgress(progress, ids);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          to={`/${toolSlug}`}
          className="w-fit text-xs text-muted transition-colors hover:text-foreground"
        >
          ← All skills
        </Link>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.accent }} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{category.title}</h1>
        </div>
        <p className="max-w-xl text-sm text-muted">{category.blurb}</p>
        <p className="max-w-2xl text-sm text-foreground/80">{category.overview}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>
              {total.mastered}/{total.total} drills mastered
            </span>
            <span>{total.percent}%</span>
          </div>
          <ProgressBar value={total.percent} accent={category.accent} className="max-w-md" />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {category.lessons.map((lesson, i) => {
          const lp = computeLessonProgress(
            progress,
            lesson.drills.map((d) => d.id),
          );
          const complete = lp.completed >= lp.total;
          return (
            <li key={lesson.slug}>
              <Link
                to={`/${toolSlug}/lesson/${lesson.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-panel p-4 transition-colors hover:border-accent/60"
              >
                <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">{lesson.title}</h2>
                    <span className="font-mono text-[11px] text-muted">{lesson.tagline}</span>
                  </div>
                  <ProgressBar value={lp.percent} accent={category.accent} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    {lp.mastered}/{lp.total}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      complete
                        ? "bg-green/15 text-green"
                        : lp.completed > 0
                          ? "bg-orange/15 text-orange"
                          : "border border-border text-muted"
                    }`}
                  >
                    {complete ? "complete" : lp.completed > 0 ? "in progress" : "start"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
