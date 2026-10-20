import { Link } from "react-router-dom";
import { TRACKS, allLessons, totalDrills, trackDrillIds } from "@/lib/dojo";
import { useProgress, computeLessonProgress } from "@/lib/progress";
import ProgressBar from "@/components/ProgressBar";

export default function HomePage() {
  const { progress } = useProgress();
  const lessons = allLessons();

  const overall = computeLessonProgress(
    progress,
    lessons.flatMap((r) => r.lesson.drills.map((d) => d.id)),
  );

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
          <span className="font-mono text-accent">:~$</span>
          <span>learn developer tools by doing, not reading</span>
        </div>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Master your tools, one command at a time.
        </h1>
        <p className="max-w-xl text-base text-muted">
          Real simulators that run in your browser, focused lessons grouped by skill, and hands-on
          drills with instant feedback. Start with Vim, tmux, or Git.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {nextLesson && (
            <Link
              to={`/${nextLesson.track.slug}/lesson/${nextLesson.lesson.slug}`}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {overall.completed > 0 ? "Continue learning" : "Start learning"}
            </Link>
          )}
          <div className="font-mono text-xs text-muted">
            {overall.mastered}/{totalDrills()} drills mastered
          </div>
        </div>
        {overall.total > 0 && <ProgressBar value={overall.percent} className="max-w-sm" />}
      </section>

      {/* Tracks */}
      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">Tools</h2>
          <span className="font-mono text-xs text-muted">{TRACKS.length} tracks</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TRACKS.map((track) => {
            const lp = computeLessonProgress(progress, trackDrillIds(track));
            const started = lp.completed > 0;
            const soon = track.status === "coming-soon";
            const card = (
              <div className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{track.title}</h3>
                    <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-cyan">
                      {track.badge}
                    </span>
                  </div>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: track.accent }}
                  />
                </div>
                <p className="text-sm text-muted">{track.blurb}</p>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between font-mono text-xs text-muted">
                    <span>{track.categories.length} categories</span>
                    <span>
                      {soon
                        ? "coming soon"
                        : started
                          ? `${lp.mastered}/${lp.total} mastered`
                          : "not started"}
                    </span>
                  </div>
                  <ProgressBar value={lp.percent} accent={track.accent} />
                </div>
              </div>
            );
            return soon ? (
              <div key={track.slug} className="cursor-not-allowed opacity-70">
                {card}
              </div>
            ) : (
              <Link key={track.slug} to={`/${track.slug}`} className="block h-full">
                {card}
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            k: "01",
            t: "Learn the concept",
            d: "Each lesson opens with a short, plain-English explanation of the commands.",
          },
          {
            k: "02",
            t: "Practice for real",
            d: "Drills run on a live simulator — reach the goal state with your own keystrokes.",
          },
          {
            k: "03",
            t: "Earn mastery",
            d: "Finish drills efficiently and without hints to mark them mastered.",
          },
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
