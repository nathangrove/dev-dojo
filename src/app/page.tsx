"use client";

import Link from "next/link";
import { CATEGORIES, allLessons, totalDrills } from "@/lib/curriculum";
import { useProgress, computeLessonProgress } from "@/lib/progress";
import ProgressBar from "@/components/ProgressBar";

export default function HomePage() {
  const { progress } = useProgress();
  const lessons = allLessons();

  const drillIds = lessons.flatMap((r) => r.lesson.drills.map((d) => d.id));
  const overall = computeLessonProgress(progress, drillIds);

  const nextLesson =
    lessons.find((r) => {
      const lp = computeLessonProgress(
        progress,
        r.lesson.drills.map((d) => d.id),
      );
      return lp.completed < lp.total;
    }) ?? lessons[0];

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="flex flex-col gap-6 pt-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted">
          <span className="font-mono text-accent">hjkl</span>
          <span>learn Vim by doing, not reading</span>
        </div>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Master Vim, one command at a time.
        </h1>
        <p className="max-w-xl text-base text-muted">
          Focused lessons grouped by skill, each ending in hands-on drills with a real Vim engine
          running in your browser. Get instant feedback and track your mastery.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/lesson/${nextLesson.lesson.slug}`}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {overall.completed > 0 ? "Continue learning" : "Start learning"}
          </Link>
          <div className="font-mono text-xs text-muted">
            {overall.mastered}/{totalDrills()} drills mastered
          </div>
        </div>
        {overall.total > 0 && (
          <ProgressBar value={overall.percent} className="max-w-sm" />
        )}
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <span className="font-mono text-xs text-muted">{CATEGORIES.length} categories</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((category) => {
            const ids = category.lessons.flatMap((l) => l.drills.map((d) => d.id));
            const lp = computeLessonProgress(progress, ids);
            const started = lp.completed > 0;
            return (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
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
      </section>

      {/* How it works */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "01", t: "Learn the concept", d: "Each lesson opens with a short, plain-English explanation of the commands." },
          { k: "02", t: "Practice for real", d: "Drills run on a live Vim engine — reach the goal buffer or target cell." },
          { k: "03", t: "Earn mastery", d: "Finish drills efficiently and without hints to mark them mastered." },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-5">
            <span className="font-mono text-xs text-accent">{s.k}</span>
            <h4 className="text-sm font-semibold text-foreground">{s.t}</h4>
            <p className="text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
