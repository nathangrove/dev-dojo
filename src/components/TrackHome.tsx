"use client";

import { Link } from "react-router-dom";
import type { Track } from "@/lib/dojo";
import { trackDrillIds } from "@/lib/dojo";
import { useProgress, computeLessonProgress } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

export default function TrackHome({ track }: { track: Track }) {
  const { progress } = useProgress();
  const total = computeLessonProgress(progress, trackDrillIds(track));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link to="/" className="w-fit text-xs text-muted transition-colors hover:text-foreground">
          ← All tools
        </Link>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.accent }} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{track.title}</h1>
          <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-cyan">
            {track.badge}
          </span>
        </div>
        <p className="max-w-xl text-sm text-muted">{track.blurb}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>
              {total.mastered}/{total.total} drills mastered
            </span>
            <span>{total.percent}%</span>
          </div>
          <ProgressBar value={total.percent} accent={track.accent} className="max-w-md" />
        </div>
      </div>

      {track.status === "coming-soon" || track.categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-sm text-muted">
          This track is still being built. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {track.categories.map((category) => {
            const ids = category.lessons.flatMap((l) => l.drills.map((d) => d.id));
            const lp = computeLessonProgress(progress, ids);
            const started = lp.completed > 0;
            return (
              <Link
                key={category.slug}
                to={`/${track.slug}/category/${category.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/60"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">{category.title}</h3>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: category.accent }}
                  />
                </div>
                <p className="text-sm text-muted">{category.blurb}</p>
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-mono text-xs text-muted">
                    <span>{category.lessons.length} lessons</span>
                    <span>
                      {started ? `${lp.mastered}/${lp.total} mastered` : "not started"}
                    </span>
                  </div>
                  <ProgressBar value={lp.percent} accent={category.accent} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
