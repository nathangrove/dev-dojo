import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { getLesson } from "@/lib/dojo";
import Markdownish from "@/components/Markdownish";
import LessonPlayer from "@/components/LessonPlayer";
import NotFound from "@/routes/NotFound";

export default function LessonPage() {
  const { tool, slug } = useParams<{ tool: string; slug: string }>();
  const ref = tool && slug ? getLesson(tool, slug) : undefined;

  useEffect(() => {
    if (ref) document.title = `${ref.lesson.title} · Dev Dojo`;
    return () => {
      document.title = "Dev Dojo";
    };
  }, [ref]);

  if (!ref || !tool) return <NotFound />;
  const { category, lesson } = ref;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Link
          to={`/${tool}/category/${category.slug}`}
          className="w-fit text-xs text-muted transition-colors hover:text-foreground"
        >
          ← {category.title}
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lesson.title}</h1>
          <span className="font-mono text-sm text-muted">{lesson.tagline}</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Concept</h2>
          <Markdownish text={lesson.concept} />
        </section>
        <aside className="flex flex-col gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Commands</h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
            {lesson.keys.map((k) => (
              <li key={k.keys} className="flex items-center gap-3 px-3 py-2">
                <kbd className="rounded bg-panel-2 px-2 py-1 font-mono text-xs text-cyan">
                  {k.keys}
                </kbd>
                <span className="text-xs text-muted">{k.meaning}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Practice</h2>
        <LessonPlayer toolSlug={tool} lesson={lesson} category={category} />
      </section>
    </div>
  );
}
