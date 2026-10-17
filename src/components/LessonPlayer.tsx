"use client";

import Link from "next/link";
import { useState } from "react";
import { type Category, type Lesson, allLessons } from "@/lib/curriculum";
import { useProgress, computeLessonProgress } from "@/lib/progress";
import type { AttemptResult } from "@/lib/progress";
import Practice from "./Practice";

interface LessonPlayerProps {
  lesson: Lesson;
  category: Category;
}

export default function LessonPlayer({ lesson, category }: LessonPlayerProps) {
  const { progress, record } = useProgress();
  const [index, setIndex] = useState(0);

  const drills = lesson.drills;
  const finished = index >= drills.length;
  const current = drills[index] ?? drills[drills.length - 1];

  const refs = allLessons();
  const pos = refs.findIndex((r) => r.lesson.slug === lesson.slug);
  const nextRef = pos >= 0 ? refs[pos + 1] : undefined;

  const handleSolved = (result: AttemptResult) => {
    if (current) record(current.id, result);
  };

  if (finished) {
    const lp = computeLessonProgress(      progress,
      drills.map((d) => d.id),
    );
    return (
      <div className="flex flex-col gap-5 rounded-xl border border-green/40 bg-green/5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lesson complete</h2>
          <p className="mt-1 text-sm text-muted">
            You worked through all {drills.length} drills.{" "}
            {lp.mastered >= lp.total
              ? "Every drill is mastered."
              : `Mastered ${lp.mastered} of ${lp.total} — repeat the rest without hints to lock them in.`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {drills.map((d) => {
            const p = progress[d.id];
            return (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-border bg-panel px-3 py-2 text-xs"
              >
                <span className="text-foreground/90">{d.prompt}</span>
                <span className="flex items-center gap-3 font-mono text-muted">
                  {p?.bestMs != null && <span>{p.bestMs}ms</span>}
                  {p?.bestAccuracy != null && <span>{p.bestAccuracy}%</span>}
                  <span
                    className={
                      p?.mastered ? "text-green" : p?.completed ? "text-orange" : "text-muted"
                    }
                  >
                    {p?.mastered ? "mastered" : p?.completed ? "done" : "—"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent"
          >
            Practice again
          </button>
          <Link
            href={`/category/${category.slug}`}
            className="rounded-md px-2 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            ← {category.title}
          </Link>
          {nextRef && (
            <Link
              href={`/lesson/${nextRef.lesson.slug}`}
              className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Next: {nextRef.lesson.title} →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <Practice
      key={current.id}
      drill={current}
      drillNumber={index + 1}
      drillTotal={drills.length}
      isLast={index === drills.length - 1}
      onSolved={handleSolved}
      onNext={() => setIndex((i) => i + 1)}
    />
  );
}
